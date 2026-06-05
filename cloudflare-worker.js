/* ============================================================================
   ID Seven — Cloudflare Worker  [V64.6-public-client-route]
   ============================================================================
   COMPATIBILIDADE: esta versão usa EXATAMENTE o esquema de variáveis/secrets do
   Worker real `idseven-push` no Cloudflare (confirmado no painel):

     ALLOWED_ORIGIN        (var)     = https://agendaidseven.com.br
     FCM_PROJECT_ID        (var)     = agenda-id-seven
     FCM_CLIENT_EMAIL      (secret)  e-mail da service account (FCM HTTP v1 + Firestore)
     FCM_PRIVATE_KEY       (secret)  chave privada PEM da service account
     IMAGEKIT_PRIVATE_KEY  (secret)  chave privada do ImageKit (/imagekit-auth)

   Vars opcionais do lembrete (com default — não são secrets):
     REMINDER_BEFORE_MINUTES   default 60   (usado se o dono não tiver reminderMinutes)
     REMINDER_WINDOW_SECONDS   default 300  (janela do disparo — tolera atraso/jitter do cron)
     APP_TZ_OFFSET_MINUTES     default -180 (UTC-3, horário de Brasília)

   ENDPOINTS:
     POST /                                  → push imediato (relay): {tokens,title,body,data} → FCM HTTP v1
     POST /imagekit-auth                     → assinatura de upload do ImageKit
     POST /cron-test                         → executa a lógica do lembrete (DRY-RUN por padrão; {"send":true} envia)
     POST /notify-assignee                   → push imediato ao responsável (server re-lê o doc)
     POST /notify-designer                   → push premium ao designer (server re-lê a task)
     GET  /cliente/cronograma/:token         → [V64.6] Visão pública do CLIENTE em HTML premium responsivo
     POST /cliente/cronograma/:token/action  → [V64.6] Aprovar / Pedir revisão / Editar (aditivo: clientLastAction)
     GET  /                                  → status do serviço

   CRON: scheduled(event, env, ctx) → handleCronTrigger(env,{dryRun:false}) a cada minuto.

   REGRA DE NEGÓCIO:
     - Criar compromisso NÃO dispara push (isso é tratado no index.html).
     - O lembrete dispara somente em (eventStart - reminderMinutes), na janela exata:
         now >= reminderAt  AND  now < reminderAt + REMINDER_WINDOW_SECONDS
     - Nunca dispara retroativo.

   DEDUPLICAÇÃO: por campo `reminderSentAt` no doc do compromisso no Firestore
     (events/{id}.reminderSentAt). NÃO usa KV. Antes de enviar, se reminderSentAt já
     estiver setado, pula; após enviar, grava reminderSentAt = now.
   ============================================================================ */

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

/* ───────────────────────── ENTRYPOINTS ───────────────────────── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (url.pathname === "/imagekit-auth") {
      return handleImageKitAuth(request, env);
    }

    if (url.pathname === "/cron-test" && request.method === "POST") {
      return handleCronTest(request, env);
    }

    if (url.pathname === "/notify-assignee" && request.method === "POST") {
      return handleNotifyAssignee(request, env);
    }

    // ADITIVO (1.0.88): push premium imediato ao DESIGNER escolhido na reatribuicao.
    // Nao toca /notify-assignee, cron, nem schema existente — usa campo proprio designerNotifiedAt.
    if (url.pathname === "/notify-designer" && request.method === "POST") {
      return handleNotifyDesigner(request, env);
    }

    // ADITIVO (V64.6): Visão pública do CLIENTE em HTML premium.
    // Rota servida pelo Worker porque o link compartilhado via WhatsApp aponta para
    // https://idseven-push.agidseven.workers.dev/cliente/cronograma/<token>. Antes
    // dessa rota, GET caia no fallback JSON e o cliente via "tela branca" com JSON.
    // - GET  → renderiza HTML (Content-Type text/html) com dados da task.
    // - POST .../action → grava clientLastAction (CAMPO NOVO ADITIVO, sem alterar schema).
    {
      const cronoMatch = url.pathname.match(/^\/cliente\/cronograma\/([A-Za-z0-9_-]{4,128})\/?$/);
      if (cronoMatch && request.method === "GET") {
        return handleClientCronogramaView(cronoMatch[1], env);
      }
      const actionMatch = url.pathname.match(/^\/cliente\/cronograma\/([A-Za-z0-9_-]{4,128})\/action\/?$/);
      if (actionMatch && request.method === "POST") {
        return handleClientCronogramaAction(actionMatch[1], request, env);
      }
    }

    if (request.method === "POST") {
      return handlePushRelay(request, env);
    }

    return json({ ok: true, service: "idseven-push", version: "V64.6-public-client-route" }, 200, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      handleCronTrigger(env, { dryRun: false }).catch((e) => {
        console.error("[CRON] erro fatal:", e && e.message);
      })
    );
  },
};

/* ───────────────────────── 1. PUSH IMEDIATO (POST /) ───────────────────────── */
async function handlePushRelay(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ ok: false, error: "JSON inválido" }, 400, env);
  }

  let tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
  /* dedup com Set() — nunca enviar pro mesmo token 2x na mesma chamada */
  tokens = Array.from(new Set(tokens.filter(Boolean)));
  if (!tokens.length) {
    return json({ ok: false, error: "sem tokens", results: [] }, 200, env);
  }

  const title = payload.title || "ID Seven";
  const body = payload.body || "";
  const data = stringifyData(payload.data || {});

  let accessToken;
  try {
    accessToken = await getAccessToken(env, FCM_SCOPE);
  } catch (e) {
    console.error("[PUSH] falha ao obter access token:", e && e.message);
    return json({ ok: false, error: "auth FCM falhou: " + (e && e.message), results: [] }, 200, env);
  }

  const results = await sendToTokens(env, accessToken, tokens, { title, body, data });
  const okCount = results.filter((r) => r.ok).length;
  console.log(`[PUSH] enviados ${okCount}/${tokens.length} (relay)`);
  return json({ ok: true, results }, 200, env);
}

/* Envio FCM HTTP v1 — 1 request por token. */
async function sendToTokens(env, accessToken, tokens, msg) {
  const projectId = env.FCM_PROJECT_ID;
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const results = [];
  for (const token of tokens) {
    const fcmMessage = {
      message: {
        token,
        data: msg.data,
        android: {
          priority: "HIGH",
          ttl: "600s",
        },
        webpush: {
          headers: { Urgency: "high", TTL: "86400" },
          notification: {
            title: msg.title,
            body: msg.body,
            icon: (msg.data && msg.data.icon) || "https://agendaidseven.com.br/icon-192.png",
            badge: (msg.data && msg.data.badge) || "https://agendaidseven.com.br/icon-192.png",
            image: (msg.data && msg.data.image) || undefined,
            tag: (msg.data && msg.data.tag) || undefined,
            renotify: (msg.data && String(msg.data.renotify) === "true") ? true : undefined,
          },
        },
      },
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
        body: JSON.stringify(fcmMessage),
      });
      const text = await res.text();
      results.push({ ok: res.ok, status: res.status, response: text.slice(0, 400) });
    } catch (e) {
      results.push({ ok: false, status: 0, response: String(e && e.message || e) });
    }
  }
  return results;
}

/* ─────────────── 1b. PUSH IMEDIATO AO RESPONSÁVEL (POST /notify-assignee) ───────────────
   Segurança: o cliente envia APENAS { type, id }. O Worker RE-LÊ o doc no Firestore,
   extrai o responsável (events.ownerId | tasks.assigneeId), busca os tokens
   server-side (users/{uid}.fcmTokens) e envia. O app NUNCA manda tokens nem segredo,
   e não há envio arbitrário: só dispara para o responsável real de um item existente. */
async function handleNotifyAssignee(request, env) {
  let payload;
  try { payload = await request.json(); } catch (_) { return json({ ok: false, error: "JSON inválido" }, 400, env); }

  const type = (payload.type === "task") ? "task" : (payload.type === "event") ? "event" : null;
  const id = (typeof payload.id === "string") ? payload.id.trim() : "";
  console.log(`[ASSIGN] recebido type=${type} id=${id}`);
  if (!type || !id) return json({ ok: false, reason: "type/id obrigatórios", type, id }, 400, env);

  let accessToken;
  try { accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE); }
  catch (e) { return json({ ok: false, reason: "auth falhou: " + (e && e.message), type, id }, 200, env); }

  const collection = (type === "task") ? "tasks" : "events";
  const doc = await getDoc(env, accessToken, collection, id);
  console.log(`[ASSIGN] doc encontrado=${!!doc} colecao=${collection}`);
  if (!doc) return json({ ok: false, reason: "item nao encontrado", type, id }, 200, env);
  if (doc.immediateNotifiedAt) return json({ ok: true, reason: "ja notificado (immediateNotifiedAt)", type, id }, 200, env);

  const responsibleId = (type === "task")
    ? (doc.assigneeId || null)
    : (doc.ownerId || null);
  console.log(`[ASSIGN] responsibleId=${responsibleId} (assigneeId=${doc.assigneeId || ""} ownerId=${doc.ownerId || ""})`);
  if (!responsibleId) return json({ ok: false, reason: "sem responsavel (id)", type, id, assigneeId: doc.assigneeId || null, ownerId: doc.ownerId || null }, 200, env);

  const user = await getUser(env, accessToken, responsibleId);
  const tokensBefore = (user && Array.isArray(user.fcmTokens)) ? user.fcmTokens.filter(Boolean) : [];
  const tokens = dedupeTokensByDevice(tokensBefore, user && user.fcmTokenMeta);
  console.log(`[ASSIGN] responsavel=${responsibleId} tokens=${tokens.length}`);
  if (!tokens.length) return json({ ok: false, reason: "responsavel sem token", type, id, responsibleId }, 200, env);

  const m = immediatePayload(type, id, doc);
  const results = await sendToTokens(env, accessToken, tokens, m);
  const okCount = results.filter((r) => r.ok).length;
  if (okCount > 0) await markField(env, accessToken, collection, id, "immediateNotifiedAt", Date.now());
  console.log(`[ASSIGN] ${type}/${id} -> ${responsibleId}: ${okCount}/${tokens.length}`);
  return json({ ok: okCount > 0, reason: okCount > 0 ? "enviado" : "FCM nao aceitou", type, id, responsibleId, tokens: tokens.length, sent: okCount }, 200, env);
}

/* ─────────────── 1c. PUSH PREMIUM IMEDIATO AO DESIGNER (POST /notify-designer) ───────────────
   ADITIVO (1.0.88). Cliente envia APENAS { id } (taskId) — opcional { dryRun:true }.
   O Worker RE-LÊ a task, extrai o designer de designerAssignment.designerId (fallback assigneeId),
   busca tokens server-side e envia mensagem premium. Dedupe por designerNotifiedAt vs
   designerAssignment.assignedAt (uma nova atribuição re-notifica; a mesma não repete).
   NÃO usa immediateNotifiedAt — não interfere no /notify-assignee nem no CRON. */
async function handleNotifyDesigner(request, env) {
  let payload;
  try { payload = await request.json(); } catch (_) { return json({ ok: false, error: "JSON inválido" }, 400, env); }
  const id = (typeof payload.id === "string") ? payload.id.trim() : "";
  const dryRun = payload.dryRun === true || payload.dryRun === "true";
  console.log(`[DESIGNER] recebido id=${id} dryRun=${dryRun}`);
  if (!id) return json({ ok: false, reason: "id obrigatório" }, 400, env);

  let accessToken;
  try { accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE); }
  catch (e) { return json({ ok: false, reason: "auth falhou: " + (e && e.message), id }, 200, env); }

  const doc = await getDoc(env, accessToken, "tasks", id);
  if (!doc) return json({ ok: false, reason: "tarefa nao encontrada", id }, 200, env);
  const da = doc.designerAssignment || null;
  const designerId = (da && da.designerId) ? da.designerId : (doc.assigneeId || null);
  if (!designerId) return json({ ok: false, reason: "sem designer atribuido", id }, 200, env);

  const assignedAt = Number(da && da.assignedAt) || 0;
  const notifiedAt = Number(doc.designerNotifiedAt) || 0;
  if (!dryRun && assignedAt && notifiedAt && notifiedAt >= assignedAt) {
    return json({ ok: true, reason: "ja notificado (designerNotifiedAt)", id, designerId }, 200, env);
  }

  const user = await getUser(env, accessToken, designerId);
  const tokensBefore = (user && Array.isArray(user.fcmTokens)) ? user.fcmTokens.filter(Boolean) : [];
  const tokens = dedupeTokensByDevice(tokensBefore, user && user.fcmTokenMeta);
  const m = designerPayload(id, doc);
  console.log(`[DESIGNER] designer=${designerId} tokens=${tokens.length}`);

  if (dryRun) return json({ ok: true, dryRun: true, id, designerId, tokens: tokens.length, message: m }, 200, env);
  if (!tokens.length) return json({ ok: false, reason: "designer sem token", id, designerId }, 200, env);

  const results = await sendToTokens(env, accessToken, tokens, m);
  const okCount = results.filter((r) => r.ok).length;
  if (okCount > 0) await markField(env, accessToken, "tasks", id, "designerNotifiedAt", Date.now());
  console.log(`[DESIGNER] ${id} -> ${designerId}: ${okCount}/${tokens.length}`);
  return json({ ok: okCount > 0, reason: okCount > 0 ? "enviado" : "FCM nao aceitou", id, designerId, tokens: tokens.length, sent: okCount }, 200, env);
}

/* Mensagem premium do push ao designer (cronograma + cliente). */
function designerPayload(id, doc) {
  const cliente = doc.client || "";
  const titulo = doc.title || "Cronograma";
  const title = "Novo cronograma atribuído";
  const body = (cliente ? cliente + " — " : "") + titulo + " · inicie a produção.";
  const data = stringifyData({
    type: "task",
    taskId: id,
    title,
    body,
    responsibleId: (doc.designerAssignment && doc.designerAssignment.designerId) || doc.assigneeId || "",
    createdBy: (doc.designerAssignment && doc.designerAssignment.assignedBy) || doc.by || "",
    deepLink: "task:" + id,
    channel: "designer_flow",
  });
  return { title, body, data };
}

/* Monta título/corpo/data do push IMEDIATO (usado por /notify-assignee e pelo fallback do CRON). */
function immediatePayload(type, id, doc) {
  const titleBase = (type === "task") ? "Nova tarefa atribuída" : "Novo compromisso atribuído";
  const title = doc.title || doc.client || titleBase;
  const when = [doc.date || doc.dueDate, (doc.start || doc.dueTime)].filter(Boolean).join(" ");
  const body = (type === "task")
    ? ("Tarefa para você" + (when ? " · vence " + when : ""))
    : ("Compromisso para você" + (when ? " · " + when : ""));
  const responsibleId = (type === "task") ? (doc.assigneeId || "") : (doc.ownerId || "");
  const data = stringifyData({
    type,
    eventId: (type === "event") ? id : "",
    taskId: (type === "task") ? id : "",
    title,
    body,
    responsibleId,
    createdBy: doc.by || "",
    scheduledAt: String(doc.date || doc.dueDate || ""),
    deepLink: type + ":" + id,
  });
  return { title, body, data };
}

/* Lê um doc genérico (events/tasks) e decodifica os campos. */
async function getDoc(env, accessToken, collection, id) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/${collection}/${id}`;
  const res = await fetch(url, { headers: { "Authorization": "Bearer " + accessToken } });
  if (!res.ok) return null;
  const doc = await res.json();
  return decodeFields(doc.fields);
}

/* ───────────────────────── 2. CRON DE LEMBRETE ───────────────────────── */
/* POST /cron-test — executa a lógica do cron sob demanda. DRY-RUN por padrão:
   calcula reminderAt/now/janela e diz o que FARIA, sem enviar. Envia de verdade
   só com body {"send":true}. */
async function handleCronTest(request, env) {
  let opts = { dryRun: true };
  try {
    const b = await request.json();
    if (b && b.send === true) opts.dryRun = false;
  } catch (_) { /* sem body = dry-run */ }
  try {
    const report = await handleCronTrigger(env, opts);
    return json({ ok: true, mode: opts.dryRun ? "dry-run" : "send", report }, 200, env);
  } catch (e) {
    return json({ ok: false, error: e && e.message }, 200, env);
  }
}

async function handleCronTrigger(env, opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const projectId = env.FCM_PROJECT_ID;
  if (!projectId) { console.error("[CRON] FCM_PROJECT_ID ausente"); return { error: "FCM_PROJECT_ID ausente" }; }

  const windowSec = parseInt(env.REMINDER_WINDOW_SECONDS, 10) > 0 ? parseInt(env.REMINDER_WINDOW_SECONDS, 10) : 300;
  const defaultBefore = parseInt(env.REMINDER_BEFORE_MINUTES, 10) > 0 ? parseInt(env.REMINDER_BEFORE_MINUTES, 10) : 60;
  const tzOffset = Number.isFinite(parseInt(env.APP_TZ_OFFSET_MINUTES, 10)) ? parseInt(env.APP_TZ_OFFSET_MINUTES, 10) : -180;
  const now = Date.now();

  let accessToken;
  try {
    accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE);
  } catch (e) {
    console.error("[CRON] auth falhou:", e && e.message);
    return { error: "auth falhou: " + (e && e.message) };
  }

  const yesterdayStr = isoDate(now - 86400000);
  const events = await queryEvents(env, accessToken, yesterdayStr);
  console.log(`[CRON] ${events.length} compromisso(s) candidatos; now=${new Date(now).toISOString()}; dryRun=${dryRun}`);

  const ownerMinsCache = {};
  const userDocCache = {};
  const report = { now: new Date(now).toISOString(), dryRun, scanned: events.length, candidates: [], sent: [] };

  for (const e of events) {
    if (!e || e.done) continue;
    const startMs = eventStartMs(e, tzOffset);
    if (!startMs) continue;

    const ownerId = e.ownerId || null;

    /* Lê o dono UMA vez (reminderMinutes + tokens p/ diagnóstico) */
    let owner = null;
    if (ownerId) {
      owner = (userDocCache[ownerId] !== undefined) ? userDocCache[ownerId] : await getUser(env, accessToken, ownerId);
      userDocCache[ownerId] = owner;
    }
    let minutes = ownerMinsCache[ownerId];
    if (minutes === undefined) {
      const m = owner && parseInt(owner.reminderMinutes, 10);
      minutes = (m > 0) ? m : defaultBefore;
      ownerMinsCache[ownerId] = minutes;
    }

    const reminderAt = startMs - minutes * 60000;
    const tokensBefore = (owner && Array.isArray(owner.fcmTokens)) ? owner.fcmTokens.filter(Boolean) : [];
    const tokens = dedupeTokensByDevice(tokensBefore, owner && owner.fcmTokenMeta);
    const hasTokens = tokens.length > 0;
    const createdAtMs = (typeof e.createdAt === "number") ? e.createdAt : (parseInt(e.createdAt, 10) || null);

    /* ELEGIBILIDADE:
       enviar SE  now >= reminderAt
              AND now < reminderAt + windowSec  (tolerância operacional do cron)
              AND NÃO foi criado depois do reminderAt (sem retroativo)
              AND reminderSentAt não existe
              AND o dono tem token. */
    let eligible = false, skippedReason = null;
    if (!ownerId) skippedReason = "sem ownerId";
    else if (now < reminderAt) skippedReason = "reminderAt no futuro";
    else if (now >= reminderAt + windowSec * 1000) skippedReason = "janela expirada (reminderAt + " + windowSec + "s)";
    else if (createdAtMs && createdAtMs >= reminderAt + windowSec * 1000) skippedReason = "criado apos a janela do lembrete (sem retroativo)";
    else if (e.reminderSentAt) skippedReason = "ja enviado (reminderSentAt)";
    else if (!hasTokens) skippedReason = "owner sem token";
    else eligible = true;

    /* Diagnóstico rico (item do briefing) — usado especialmente no /cron-test dry-run */
    report.candidates.push({
      eventId: e.id,
      date: e.date || null,
      start: e.start || null,
      eventStart: new Date(startMs).toISOString(),
      reminderAt: new Date(reminderAt).toISOString(),
      now: new Date(now).toISOString(),
      windowSeconds: windowSec,
      minutes: minutes,
      eligible: eligible,
      skippedReason: skippedReason,
      createdAt: createdAtMs ? new Date(createdAtMs).toISOString() : null,
      reminderSentAt: e.reminderSentAt ? new Date(parseInt(e.reminderSentAt, 10)).toISOString() : null,
      ownerId: ownerId,
      hasTokens: hasTokens
    });
    console.log(`[REMINDER] ${e.id} eventStart=${new Date(startMs).toISOString()} reminderAt=${new Date(reminderAt).toISOString()} now=${new Date(now).toISOString()} window=${windowSec}s eligible=${eligible}${eligible ? "" : " reason=" + skippedReason}`);

    if (!eligible) continue;

    const typeLabel = labelForType(e.type);
    const title = `⏰ ${typeLabel} em ${minutes} min`;
    let body = e.title || e.client || "Compromisso";
    if (e.client && e.title) body = `${e.title} · ${e.client}`;
    if (e.start) body += ` (${e.start})`;
    const data = stringifyData({ tag: "reminder-" + e.id, url: "?openEvent=" + e.id, eventId: e.id });

    if (dryRun) {
      report.sent.push({ eventId: e.id, wouldSendTo: tokens.length, title });
      console.log(`[REMINDER] dry-run: enviaria ownerId=${ownerId} event=${e.id} para ${tokens.length} token(s)`);
      continue;
    }

    const results = await sendToTokens(env, accessToken, tokens, { title, body, data });
    const okCount = results.filter((r) => r.ok).length;
    console.log(`[REMINDER] sent: ownerId=${ownerId} event=${e.id} ok=${okCount}/${tokens.length}`);
    report.sent.push({ eventId: e.id, sentTo: tokens.length, ok: okCount });

    /* DEDUP: grava reminderSentAt no doc do compromisso (exactly-once via Firestore) */
    await markReminderSent(env, accessToken, "events", e.id, now);
  }

  /* ───── TAREFAS: lembrete `minutes` antes do vencimento, ao RESPONSÁVEL (assigneeId) ───── */
  const tasks = await queryTasks(env, accessToken, yesterdayStr);
  report.scannedTasks = tasks.length;
  console.log(`[CRON] ${tasks.length} tarefa(s) candidatas`);

  for (const t of tasks) {
    if (!t || t.status === "concluido") continue;
    if (!t.dueDate || !t.dueTime) continue;
    const dueMs = taskDueMs(t, tzOffset);
    if (!dueMs) continue;

    const assigneeId = t.assigneeId || null;
    let user = null;
    if (assigneeId) {
      user = (userDocCache[assigneeId] !== undefined) ? userDocCache[assigneeId] : await getUser(env, accessToken, assigneeId);
      userDocCache[assigneeId] = user;
    }
    let minutes = ownerMinsCache[assigneeId];
    if (minutes === undefined) {
      const m = user && parseInt(user.reminderMinutes, 10);
      minutes = (m > 0) ? m : defaultBefore;
      ownerMinsCache[assigneeId] = minutes;
    }

    const reminderAt = dueMs - minutes * 60000;
    const tokensBefore = (user && Array.isArray(user.fcmTokens)) ? user.fcmTokens.filter(Boolean) : [];
    const tokens = dedupeTokensByDevice(tokensBefore, user && user.fcmTokenMeta);
    const hasTokens = tokens.length > 0;
    const createdAtMs = (typeof t.createdAt === "number") ? t.createdAt : (parseInt(t.createdAt, 10) || null);

    let eligible = false, skippedReason = null;
    if (!assigneeId) skippedReason = "sem assigneeId";
    else if (now < reminderAt) skippedReason = "reminderAt no futuro";
    else if (now >= reminderAt + windowSec * 1000) skippedReason = "janela expirada (reminderAt + " + windowSec + "s)";
    else if (createdAtMs && createdAtMs >= reminderAt + windowSec * 1000) skippedReason = "criado apos a janela do lembrete (sem retroativo)";
    else if (t.reminderSentAt) skippedReason = "ja enviado (reminderSentAt)";
    else if (!hasTokens) skippedReason = "assignee sem token";
    else eligible = true;

    report.candidates.push({
      taskId: t.id,
      due: (t.dueDate || null) + (t.dueTime ? " " + t.dueTime : ""),
      reminderAt: new Date(reminderAt).toISOString(),
      now: new Date(now).toISOString(),
      windowSeconds: windowSec,
      minutes: minutes,
      eligible: eligible,
      skippedReason: skippedReason,
      assigneeId: assigneeId,
      hasTokens: hasTokens,
    });
    console.log(`[TASK-REMINDER] ${t.id} due=${new Date(dueMs).toISOString()} reminderAt=${new Date(reminderAt).toISOString()} eligible=${eligible}${eligible ? "" : " reason=" + skippedReason}`);

    if (!eligible) continue;

    const title = `⏰ Tarefa em ${minutes} min`;
    let body = t.title || t.client || "Tarefa";
    if (t.client && t.title) body = `${t.title} · ${t.client}`;
    if (t.dueTime) body += ` (vence ${t.dueTime})`;
    const data = stringifyData({ type: "task", tag: "task-reminder-" + t.id, taskId: t.id, deepLink: "task:" + t.id });

    if (dryRun) {
      report.sent.push({ taskId: t.id, wouldSendTo: tokens.length, title });
      console.log(`[TASK-REMINDER] dry-run: enviaria assigneeId=${assigneeId} task=${t.id} para ${tokens.length} token(s)`);
      continue;
    }

    const results = await sendToTokens(env, accessToken, tokens, { title, body, data });
    const okCount = results.filter((r) => r.ok).length;
    console.log(`[TASK-REMINDER] sent: assigneeId=${assigneeId} task=${t.id} ok=${okCount}/${tokens.length}`);
    report.sent.push({ taskId: t.id, sentTo: tokens.length, ok: okCount });

    await markReminderSent(env, accessToken, "tasks", t.id, now);
  }

  /* ───── FALLBACK SERVER-SIDE: push IMEDIATO ao responsável, p/ itens recém-criados
     pelo app nativo (src=nativebeta) que ainda não tiveram immediateNotifiedAt. Garante
     "quase tempo real" (<= 1 min) mesmo se a chamada /notify-assignee do app falhar.
     Escopo: só src=nativebeta (não duplica notificações de itens criados no PWA). ───── */
  const immediateWindowMin = parseInt(env.IMMEDIATE_WINDOW_MINUTES, 10) > 0 ? parseInt(env.IMMEDIATE_WINDOW_MINUTES, 10) : 15;
  const sinceMs = now - immediateWindowMin * 60000;
  report.immediate = [];
  const recents = [];
  for (const d of await queryRecentByCreatedAt(env, accessToken, "events", sinceMs)) recents.push({ type: "event", doc: d });
  for (const d of await queryRecentByCreatedAt(env, accessToken, "tasks", sinceMs)) recents.push({ type: "task", doc: d });
  console.log(`[IMMEDIATE-FALLBACK] ${recents.length} item(ns) recente(s) (janela ${immediateWindowMin}min)`);

  for (const { type, doc } of recents) {
    if (!doc) continue;
    if (doc.src !== "nativebeta") continue;                 // só itens do app nativo
    if (doc.immediateNotifiedAt) continue;                  // dedupe
    if (type === "event" && doc.done) continue;
    if (type === "task" && doc.status === "concluido") continue;
    const coll = (type === "task") ? "tasks" : "events";
    const responsibleId = (type === "task") ? (doc.assigneeId || null) : (doc.ownerId || null);
    if (!responsibleId) continue;
    // Não notificar o próprio criador; marca p/ não reprocessar todo minuto.
    if (responsibleId === (doc.by || null)) {
      if (!dryRun) await markField(env, accessToken, coll, doc.id, "immediateNotifiedAt", now);
      continue;
    }
    const user = (userDocCache[responsibleId] !== undefined) ? userDocCache[responsibleId] : await getUser(env, accessToken, responsibleId);
    userDocCache[responsibleId] = user;
    const tokens = dedupeTokensByDevice((user && Array.isArray(user.fcmTokens)) ? user.fcmTokens.filter(Boolean) : [], user && user.fcmTokenMeta);
    report.immediate.push({ type, id: doc.id, responsibleId, hasTokens: tokens.length > 0 });
    console.log(`[IMMEDIATE-FALLBACK] ${type}/${doc.id} -> ${responsibleId} tokens=${tokens.length}`);
    if (!tokens.length) continue;
    if (dryRun) continue;
    const m = immediatePayload(type, doc.id, doc);
    const results = await sendToTokens(env, accessToken, tokens, m);
    const okCount = results.filter((r) => r.ok).length;
    console.log(`[IMMEDIATE-FALLBACK] sent ${type}/${doc.id} -> ${responsibleId}: ${okCount}/${tokens.length}`);
    await markField(env, accessToken, coll, doc.id, "immediateNotifiedAt", now);
  }

  return report;
}

/* eventStart (UTC) a partir de date "YYYY-MM-DD" + start "HH:MM" em horário local. */
function eventStartMs(e, tzOffsetMinutes) {
  if (!e || !e.date) return 0;
  const dm = String(e.date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return 0;
  const y = +dm[1], mo = +dm[2], d = +dm[3];
  let hh = 0, mm = 0;
  if (e.start) {
    const tm = String(e.start).match(/^(\d{1,2}):(\d{2})$/);
    if (tm) { hh = +tm[1]; mm = +tm[2]; }
  }
  return Date.UTC(y, mo - 1, d, hh, mm) - tzOffsetMinutes * 60000;
}

/* mantém 1 token por deviceId (mais recente) + dedup com Set() */
function dedupeTokensByDevice(tokens, meta) {
  if (!Array.isArray(tokens)) return [];
  meta = (meta && typeof meta === "object") ? meta : {};
  const byDevice = {};
  const noMeta = [];
  for (const t of tokens) {
    if (!t) continue;
    const m = meta[t];
    if (m && m.deviceId) {
      const ts = (m.lastSeenAt || m.createdAt || 0);
      if (!byDevice[m.deviceId] || ts >= byDevice[m.deviceId].ts) byDevice[m.deviceId] = { token: t, ts };
    } else {
      noMeta.push(t);
    }
  }
  const out = Object.keys(byDevice).map((k) => byDevice[k].token).concat(noMeta);
  return Array.from(new Set(out.filter(Boolean)));
}

function labelForType(type) {
  const map = { gravacao: "Gravação", reuniao: "Reunião", trafego: "Tráfego", revisao: "Revisão", entrega: "Entrega", foto: "Foto", outro: "Compromisso" };
  return (type && map[type]) || "Compromisso";
}

/* ───────────────────────── FIRESTORE REST ───────────────────────── */
async function queryEvents(env, accessToken, fromDateStr) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId: "events" }],
      where: { fieldFilter: { field: { fieldPath: "date" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: fromDateStr } } },
      limit: 500,
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) { console.error("[CRON] runQuery falhou:", res.status, (await res.text()).slice(0, 300)); return []; }
  const rows = await res.json();
  const out = [];
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split("/").pop();
    out.push(Object.assign({ id }, decodeFields(row.document.fields)));
  }
  return out;
}

/* tarefas com dueDate >= ontem (sem dueDate são naturalmente excluídas: "" < data). */
async function queryTasks(env, accessToken, fromDateStr) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId: "tasks" }],
      where: { fieldFilter: { field: { fieldPath: "dueDate" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: fromDateStr } } },
      limit: 500,
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) { console.error("[CRON] runQuery tasks falhou:", res.status, (await res.text()).slice(0, 300)); return []; }
  const rows = await res.json();
  const out = [];
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split("/").pop();
    out.push(Object.assign({ id }, decodeFields(row.document.fields)));
  }
  return out;
}

/* itens recém-criados (createdAt epoch ms >= sinceMs) — usado pelo fallback de push imediato. */
async function queryRecentByCreatedAt(env, accessToken, collection, sinceMs) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: "createdAt" }, op: "GREATER_THAN_OR_EQUAL", value: { integerValue: String(sinceMs) } } },
      limit: 200,
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) { console.error("[IMMEDIATE-FALLBACK] runQuery " + collection + " falhou:", res.status, (await res.text()).slice(0, 300)); return []; }
  const rows = await res.json();
  const out = [];
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split("/").pop();
    out.push(Object.assign({ id }, decodeFields(row.document.fields)));
  }
  return out;
}

/* due (UTC) a partir de dueDate "YYYY-MM-DD" + dueTime "HH:MM" em horário local. */
function taskDueMs(t, tzOffsetMinutes) {
  if (!t || !t.dueDate) return 0;
  const dm = String(t.dueDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return 0;
  const y = +dm[1], mo = +dm[2], d = +dm[3];
  let hh = 0, mm = 0;
  if (t.dueTime) {
    const tm = String(t.dueTime).match(/^(\d{1,2}):(\d{2})$/);
    if (tm) { hh = +tm[1]; mm = +tm[2]; }
  }
  return Date.UTC(y, mo - 1, d, hh, mm) - tzOffsetMinutes * 60000;
}

async function getUser(env, accessToken, uid) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, { headers: { "Authorization": "Bearer " + accessToken } });
  if (!res.ok) return null;
  const doc = await res.json();
  return decodeFields(doc.fields);
}

/* grava {collection}/{id}.reminderSentAt = nowMs (dedup exactly-once via Firestore) */
async function markReminderSent(env, accessToken, collection, id, nowMs) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/${collection}/${id}?updateMask.fieldPaths=reminderSentAt`;
  try {
    await fetch(url, {
      method: "PATCH",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { reminderSentAt: { integerValue: String(nowMs) } } }),
    });
  } catch (e) {
    console.warn("[REMINDER] falha ao gravar reminderSentAt:", e && e.message);
  }
}

/* grava {collection}/{id}.{field} = nowMs (dedupe genérico: immediateNotifiedAt etc.) */
async function markField(env, accessToken, collection, id, field, nowMs) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/${collection}/${id}?updateMask.fieldPaths=${field}`;
  try {
    await fetch(url, {
      method: "PATCH",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { [field]: { integerValue: String(nowMs) } } }),
    });
  } catch (e) {
    console.warn("[MARK] falha ao gravar " + field + ":", e && e.message);
  }
}

function decodeFields(fields) {
  const out = {};
  if (!fields) return out;
  for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k]);
  return out;
}
function decodeValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return ((v.arrayValue.values) || []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  return null;
}

/* ───────────────────────── OAUTH (service account → access token) ───────────────────────── */
let _tokenCache = { value: null, exp: 0, scope: "" };
async function getAccessToken(env, scope) {
  const nowSec = Math.floor(Date.now() / 1000);
  if (_tokenCache.value && _tokenCache.exp - 60 > nowSec && _tokenCache.scope === scope) return _tokenCache.value;

  const clientEmail = env.FCM_CLIENT_EMAIL;
  const privateKey = env.FCM_PRIVATE_KEY;
  if (!clientEmail) throw new Error("FCM_CLIENT_EMAIL ausente");
  if (!privateKey) throw new Error("FCM_PRIVATE_KEY ausente");

  const header = { alg: "RS256", typ: "JWT" };
  const claim = { iss: clientEmail, scope, aud: "https://oauth2.googleapis.com/token", iat: nowSec, exp: nowSec + 3600 };
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const signature = await rs256Sign(unsigned, privateKey);
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error("oauth token " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  _tokenCache = { value: data.access_token, exp: nowSec + (data.expires_in || 3600), scope };
  return data.access_token;
}

async function rs256Sign(data, pem) {
  const key = await importPrivateKey(pem);
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}
async function importPrivateKey(pem) {
  const clean = String(pem).replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

/* ───────────────────────── 3. IMAGEKIT AUTH ───────────────────────── */
async function handleImageKitAuth(request, env) {
  const privateKey = env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) return json({ error: "IMAGEKIT_PRIVATE_KEY ausente" }, 500, env);
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 2400;
  const signature = await hmacSha1Hex(privateKey, token + expire);
  return json({ token, expire, signature }, 200, env);
}
async function hmacSha1Hex(key, msg) {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ───────────────────────── 4. VISÃO PÚBLICA DO CLIENTE (V64.6) ─────────────────────────
   GET /cliente/cronograma/:token  → HTML premium responsivo da Visão do Cliente.
   POST /cliente/cronograma/:token/action  → Aprovar / Pedir revisão / Editar (aditivo).

   Segurança: a única "credencial" é o shareToken (capability). Inválido → 404 HTML amigável.
   Aditivo: o POST grava clientLastAction = {type, at, note} (CAMPO NOVO), além de
   appendar a clientActions[] via array-merge — não toca cronWeeks, cs, lg, lgState, etc. */

async function handleClientCronogramaView(token, env) {
  if (!token) return htmlResponse(renderClientErrorHtml("Link inválido", "O link não contém um token válido."), 400);
  let accessToken;
  try { accessToken = await getAccessToken(env, DATASTORE_SCOPE); }
  catch (e) {
    console.error("[CLIENT-VIEW] auth falhou:", e && e.message);
    return htmlResponse(renderClientErrorHtml("Indisponível", "Não foi possível carregar agora. Tente novamente em instantes."), 503);
  }
  const task = await queryTaskByShareToken(env, accessToken, token);
  if (!task) {
    console.log(`[CLIENT-VIEW] token nao encontrado: ${token.slice(0, 6)}…`);
    return htmlResponse(renderClientErrorHtml("Cronograma não encontrado",
      "Este link pode ter sido invalidado ou ainda não foi compartilhado. Fale com sua equipe ID Seven."), 404);
  }
  console.log(`[CLIENT-VIEW] ok task=${task.id} client=${task.client || ""}`);
  return htmlResponse(renderClientHtml(task, token, env), 200);
}

async function handleClientCronogramaAction(token, request, env) {
  let payload = {};
  try { payload = await request.json(); } catch (_) { /* tolera body vazio */ }
  const type = (payload && typeof payload.action === "string") ? payload.action.trim() : "";
  const ALLOWED = ["approve", "revision", "edit_request"];
  if (ALLOWED.indexOf(type) < 0) {
    return json({ ok: false, error: "ação inválida (use: approve | revision | edit_request)" }, 400, env);
  }
  const note = (payload && typeof payload.note === "string") ? payload.note.slice(0, 1000) : "";

  let accessToken;
  try { accessToken = await getAccessToken(env, DATASTORE_SCOPE); }
  catch (e) { return json({ ok: false, error: "auth falhou: " + (e && e.message) }, 200, env); }

  const task = await queryTaskByShareToken(env, accessToken, token);
  if (!task) return json({ ok: false, error: "token inválido" }, 404, env);

  const now = Date.now();
  const action = { type, at: now, note };
  await writeClientLastAction(env, accessToken, task.id, action);
  console.log(`[CLIENT-ACTION] task=${task.id} type=${type} hasNote=${!!note}`);
  return json({ ok: true, action }, 200, env);
}

/* Query Firestore por shareToken (campo do doc tasks/{id}). */
async function queryTaskByShareToken(env, accessToken, token) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId: "tasks" }],
      where: { fieldFilter: { field: { fieldPath: "shareToken" }, op: "EQUAL", value: { stringValue: token } } },
      limit: 1,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(q),
  });
  if (!res.ok) { console.error("[CLIENT-VIEW] runQuery falhou:", res.status, (await res.text()).slice(0, 200)); return null; }
  const rows = await res.json();
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split("/").pop();
    return Object.assign({ id }, decodeFields(row.document.fields));
  }
  return null;
}

/* Grava tasks/{id}.clientLastAction (CAMPO NOVO ADITIVO) — não toca cronWeeks/cs/lg/lgState. */
async function writeClientLastAction(env, accessToken, taskId, action) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/tasks/${taskId}?updateMask.fieldPaths=clientLastAction`;
  try {
    await fetch(url, {
      method: "PATCH",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          clientLastAction: {
            mapValue: {
              fields: {
                type: { stringValue: action.type },
                at: { integerValue: String(action.at) },
                note: { stringValue: action.note || "" },
              },
            },
          },
        },
      }),
    });
  } catch (e) {
    console.warn("[CLIENT-ACTION] falha ao gravar clientLastAction:", e && e.message);
  }
}

function htmlResponse(html, status) {
  return new Response(html, {
    status: status || 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function frequencyLabel(t) {
  const f = (t.freq || t.frequencia || t.cronFrequency || "").toString().toLowerCase();
  const map = { semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", unico: "Único" };
  return map[f] || (f ? f.charAt(0).toUpperCase() + f.slice(1) : "Cronograma");
}

function statusLabel(t) {
  const cls = (t.cronStatus || "").toString();
  const map = {
    sent_to_designer: "Enviado ao designer",
    in_design: "Em produção",
    ready_for_client: "Pronto para o cliente",
    in_client_review: "Em análise do cliente",
    client_revision: "Cliente pediu revisão",
    client_approved: "Aprovado pelo cliente",
    delivered: "Entregue",
  };
  if (map[cls]) return map[cls];
  const s = (t.status || "").toString();
  const m2 = { afazer: "A fazer", andamento: "Em andamento", revisao: "Em revisão", concluido: "Concluído" };
  return m2[s] || "Em produção";
}

function csLabel(cs) {
  return {
    enviado: "Enviado ao cliente",
    em_analise: "Em análise",
    em_revisao: "Revisão pedida",
    aprovado: "Aprovado",
    concluido: "Entregue",
  }[cs] || "";
}

function lgStateLabel(s) {
  return {
    pendente: "Pendente",
    escrita: "Em escrita",
    enviada: "Enviada",
    em_analise: "Em análise",
    em_revisao: "Revisão pedida",
    aprovada: "Aprovada",
  }[s] || "Pendente";
}

function feedCount(c) {
  if (Array.isArray(c.feed)) return c.feed.length;
  if (c.feed && typeof c.feed === "object" && c.feed.url) return 1;
  return 0;
}
function storyCount(c) {
  if (Array.isArray(c.stories)) return c.stories.length;
  if (c.story && typeof c.story === "object" && c.story.url) return 1;
  return 0;
}

function renderClientHtml(task, token, env) {
  const cliente = escapeHtml(task.client || "Cliente");
  const titulo = escapeHtml(task.title || "Cronograma");
  const freq = escapeHtml(frequencyLabel(task));
  const status = escapeHtml(statusLabel(task));
  const items = Array.isArray(task.cronWeeks) ? task.cronWeeks
    : (Array.isArray(task.cronContents) ? task.cronContents : []);
  const total = items.length;

  let contentsHtml = "";
  if (!total) {
    contentsHtml = `<div class="empty">Os conteúdos ainda não foram publicados. Você será avisado quando estiverem prontos.</div>`;
  } else {
    contentsHtml = items.map((raw, i) => {
      const c = (raw && typeof raw === "object") ? raw : {};
      const tema = escapeHtml(c.t || c.tema || `Conteúdo ${i + 1}`);
      const data = escapeHtml(c.d || "");
      const lg = (typeof c.lg === "string" ? c.lg : (typeof c.l === "string" ? c.l : "")).trim();
      const lgPreview = lg ? escapeHtml(lg.length > 240 ? lg.slice(0, 240) + "…" : lg) : "";
      const lgSt = lgStateLabel(c.lgState);
      const fdN = feedCount(c);
      const stN = storyCount(c);
      const csL = csLabel(c.cs);
      const csClass = c.cs ? `cs-${escapeHtml(c.cs)}` : "";

      const chips = [];
      if (lg) chips.push(`<span class="chip chip-on">Legenda · ${escapeHtml(lgSt)}</span>`);
      else    chips.push(`<span class="chip chip-pending">Legenda · Pendente</span>`);
      if (fdN) chips.push(`<span class="chip chip-on">Feed · ${fdN}</span>`);
      else     chips.push(`<span class="chip chip-pending">Feed · Pendente</span>`);
      if (stN) chips.push(`<span class="chip chip-on">Story · ${stN}</span>`);
      else     chips.push(`<span class="chip chip-pending">Story · Pendente</span>`);
      if (csL) chips.push(`<span class="chip ${csClass}">${escapeHtml(csL)}</span>`);

      return `
        <article class="item">
          <header class="item-head">
            <div class="item-idx">${i + 1}</div>
            <div class="item-title">
              <h3>${tema}</h3>
              ${data ? `<div class="item-date">${data}</div>` : ""}
            </div>
          </header>
          ${lgPreview ? `<p class="item-legenda">${lgPreview}</p>` : ""}
          <div class="item-chips">${chips.join("")}</div>
        </article>`;
    }).join("");
  }

  const publicUrl = `https://idseven-push.agidseven.workers.dev/cliente/cronograma/${escapeHtml(token)}`;
  const ogTitle = `${cliente} · ${titulo}`;
  const ogDesc = total
    ? `Cronograma com ${total} ${total === 1 ? "conteúdo" : "conteúdos"} — ${status}.`
    : `Cronograma — ${status}.`;

  // Logo inline SVG (anel roxo→magenta + disco teal + monitor branco) — bate com a brand.
  const logoSvg = `
    <svg viewBox="0 0 96 96" aria-label="ID Seven" role="img">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="44" fill="none" stroke="url(#g1)" stroke-width="7"/>
      <circle cx="48" cy="48" r="30" fill="#22d3b8"/>
      <rect x="34" y="38" width="28" height="20" rx="3" fill="#ffffff"/>
      <rect x="42" y="60" width="12" height="3" rx="1.5" fill="#ffffff"/>
      <rect x="38" y="42" width="20" height="2" rx="1" fill="#22d3b8"/>
      <rect x="38" y="46" width="14" height="2" rx="1" fill="#22d3b8"/>
      <rect x="38" y="50" width="17" height="2" rx="1" fill="#22d3b8"/>
    </svg>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${ogTitle} · Visão do Cliente</title>
<meta name="description" content="${escapeHtml(ogDesc)}"/>
<meta name="theme-color" content="#0A0B10"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${ogTitle}"/>
<meta property="og:description" content="${escapeHtml(ogDesc)}"/>
<meta property="og:url" content="${publicUrl}"/>
<meta property="og:site_name" content="Agenda ID Seven"/>
<meta name="robots" content="noindex,nofollow"/>
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#0A0B10;color:#E6E8F0;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  body{min-height:100vh;display:flex;flex-direction:column}
  a{color:#a78bfa;text-decoration:none}
  .wrap{max-width:760px;width:100%;margin:0 auto;padding:24px 18px 120px}
  header.brand{display:flex;align-items:center;gap:12px;padding:6px 2px 22px}
  header.brand svg{width:42px;height:42px;display:block}
  header.brand .name{font-weight:700;letter-spacing:.2px;color:#fff}
  header.brand .name small{display:block;color:#9ca3af;font-weight:500;font-size:11px;letter-spacing:.6px;text-transform:uppercase;margin-top:2px}
  .card{background:linear-gradient(180deg,rgba(124,58,237,.10),rgba(34,211,184,.04)),#11131c;border:1px solid #20232f;border-radius:18px;padding:20px 18px;box-shadow:0 12px 40px -20px rgba(124,58,237,.40)}
  .card.title h1{margin:0 0 6px;font-size:22px;line-height:1.25;color:#fff;font-weight:700;letter-spacing:-.01em}
  .card.title .cli{color:#a78bfa;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
  .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
  .meta .pill{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);padding:6px 10px;border-radius:999px;font-size:12px;color:#cbd5e1}
  .meta .pill.status{background:rgba(34,211,184,.10);border-color:rgba(34,211,184,.28);color:#34d3b8}
  .section-title{font-size:11px;font-weight:700;letter-spacing:1.4px;color:#9ca3af;text-transform:uppercase;margin:28px 4px 12px}
  .list{display:flex;flex-direction:column;gap:12px}
  .item{background:#11131c;border:1px solid #20232f;border-radius:14px;padding:14px 14px 12px}
  .item-head{display:flex;align-items:flex-start;gap:12px}
  .item-idx{flex:0 0 30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:13px}
  .item-title h3{margin:2px 0 2px;font-size:15px;color:#fff;font-weight:600;line-height:1.3}
  .item-title .item-date{font-size:12px;color:#9ca3af}
  .item-legenda{margin:10px 0 0;font-size:13px;color:#cbd5e1;line-height:1.55;white-space:pre-wrap;word-break:break-word}
  .item-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .chip{font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#cbd5e1;letter-spacing:.2px}
  .chip-on{background:rgba(34,211,184,.10);border-color:rgba(34,211,184,.28);color:#34d3b8}
  .chip-pending{background:rgba(255,255,255,.03);color:#9ca3af}
  .chip.cs-aprovado{background:rgba(34,211,153,.12);border-color:rgba(34,211,153,.30);color:#22d399}
  .chip.cs-em_revisao{background:rgba(255,90,77,.12);border-color:rgba(255,90,77,.32);color:#ff7a6f}
  .chip.cs-em_analise{background:rgba(77,159,255,.10);border-color:rgba(77,159,255,.30);color:#4d9fff}
  .chip.cs-enviado{background:rgba(255,176,46,.10);border-color:rgba(255,176,46,.30);color:#ffb02e}
  .empty{background:#11131c;border:1px dashed #2a2f3d;border-radius:14px;padding:22px;text-align:center;color:#9ca3af}
  .actions{position:sticky;bottom:0;background:linear-gradient(180deg,rgba(10,11,16,0),rgba(10,11,16,.92) 30%,#0A0B10 65%);padding:18px 0 max(18px,env(safe-area-inset-bottom));margin-top:18px;display:flex;flex-direction:column;gap:10px}
  .btn{appearance:none;border:0;border-radius:14px;padding:14px 16px;font-size:15px;font-weight:600;letter-spacing:.1px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;color:#fff;transition:transform .08s ease,filter .12s ease}
  .btn:active{transform:translateY(1px)}
  .btn.primary{background:linear-gradient(135deg,#22d399,#34d3b8);color:#06251c}
  .btn.warn{background:linear-gradient(135deg,#f59e0b,#ec4899);color:#fff}
  .btn.ghost{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);color:#E6E8F0}
  .btn[disabled]{opacity:.55;cursor:wait}
  dialog{border:0;border-radius:18px;background:#11131c;color:#E6E8F0;padding:0;max-width:520px;width:calc(100% - 32px);box-shadow:0 24px 60px -20px rgba(0,0,0,.7)}
  dialog::backdrop{background:rgba(5,6,10,.72)}
  .dlg{padding:20px 18px}
  .dlg h2{margin:0 0 6px;font-size:17px;color:#fff;font-weight:700}
  .dlg p{margin:0 0 14px;color:#9ca3af;font-size:13.5px}
  .dlg textarea{width:100%;min-height:120px;background:#0A0B10;color:#E6E8F0;border:1px solid #2a2f3d;border-radius:12px;padding:12px;font:inherit;resize:vertical}
  .dlg-row{display:flex;gap:8px;margin-top:12px}
  .dlg-row .btn{flex:1;padding:12px 14px;font-size:14px}
  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#11131c;border:1px solid #2a2f3d;color:#E6E8F0;padding:12px 16px;border-radius:12px;box-shadow:0 12px 40px -16px rgba(0,0,0,.7);opacity:0;transition:transform .25s ease,opacity .25s ease;z-index:9999;font-size:14px}
  .toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
  .toast.ok{border-color:rgba(34,211,153,.40);color:#22d399}
  .toast.err{border-color:rgba(255,90,77,.40);color:#ff7a6f}
  .foot{margin-top:24px;color:#525a6e;font-size:11.5px;text-align:center;letter-spacing:.3px}
  @media (min-width:520px){
    .actions{flex-direction:row;justify-content:flex-end}
    .actions .btn{min-width:180px;flex:0 0 auto}
    .card.title h1{font-size:26px}
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="brand">
    ${logoSvg}
    <div class="name">Agenda ID Seven<small>Visão do Cliente</small></div>
  </header>

  <section class="card title" aria-labelledby="t">
    <div class="cli">${cliente}</div>
    <h1 id="t">${titulo}</h1>
    <div class="meta">
      <span class="pill">${freq}</span>
      <span class="pill status">${status}</span>
      <span class="pill">${total} ${total === 1 ? "conteúdo" : "conteúdos"}</span>
    </div>
  </section>

  <div class="section-title">Conteúdos</div>
  <div class="list">${contentsHtml}</div>

  <div class="actions" role="group" aria-label="Ações do cliente">
    <button class="btn ghost" id="btnEdit" type="button">Editar cronograma</button>
    <button class="btn warn"  id="btnRev"  type="button">Pedir revisão</button>
    <button class="btn primary" id="btnApprove" type="button">Aprovar</button>
  </div>

  <div class="foot">Link seguro · ID Seven · ${new Date().getFullYear()}</div>
</div>

<dialog id="dlg">
  <form method="dialog" class="dlg" id="dlgForm">
    <h2 id="dlgTitle">Conte para a equipe</h2>
    <p id="dlgHelp">Descreva o que precisa ser ajustado. A equipe ID Seven será notificada.</p>
    <textarea id="dlgNote" maxlength="1000" placeholder="Escreva sua mensagem…"></textarea>
    <div class="dlg-row">
      <button class="btn ghost" value="cancel" type="submit">Cancelar</button>
      <button class="btn warn"  id="dlgSend" value="send" type="submit">Enviar</button>
    </div>
  </form>
</dialog>
<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
(function(){
  var TOKEN = ${JSON.stringify(token)};
  var ACTION_URL = "/cliente/cronograma/" + encodeURIComponent(TOKEN) + "/action";
  var dlg = document.getElementById("dlg");
  var dlgTitle = document.getElementById("dlgTitle");
  var dlgHelp  = document.getElementById("dlgHelp");
  var dlgNote  = document.getElementById("dlgNote");
  var dlgForm  = document.getElementById("dlgForm");
  var dlgPendingType = null;
  var toast = document.getElementById("toast");
  var toastTimer = null;
  function showToast(msg, kind){
    toast.textContent = msg;
    toast.className = "toast on " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.className = "toast"; }, 3000);
  }
  function setBusy(btn, busy){
    if(!btn) return;
    btn.disabled = !!busy;
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.textContent = busy ? "Enviando…" : btn.dataset.label;
  }
  function send(type, note, btn){
    setBusy(btn, true);
    fetch(ACTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: type, note: note || "" }),
    }).then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
      .then(function(res){
        if(res.ok && res.j && res.j.ok){
          var msg = type === "approve" ? "Aprovado! Obrigado." :
                    type === "revision" ? "Revisão solicitada." :
                    "Mensagem enviada.";
          showToast(msg, "ok");
        } else {
          showToast((res.j && res.j.error) || "Falha ao enviar. Tente novamente.", "err");
        }
      })
      .catch(function(){ showToast("Sem conexão. Tente novamente.", "err"); })
      .finally(function(){ setBusy(btn, false); });
  }
  function openDlg(type, title, help, btn){
    dlgPendingType = { type: type, btn: btn };
    dlgTitle.textContent = title;
    dlgHelp.textContent = help;
    dlgNote.value = "";
    if(typeof dlg.showModal === "function") dlg.showModal();
    else { var n = prompt(help, ""); if(n !== null) send(type, n, btn); }
  }
  dlgForm.addEventListener("submit", function(ev){
    var which = (ev.submitter && ev.submitter.value) || "cancel";
    if(which === "send" && dlgPendingType){
      send(dlgPendingType.type, dlgNote.value.trim(), dlgPendingType.btn);
    }
    dlgPendingType = null;
  });

  document.getElementById("btnApprove").addEventListener("click", function(ev){
    if(confirm("Confirmar aprovação deste cronograma?")) send("approve", "", ev.currentTarget);
  });
  document.getElementById("btnRev").addEventListener("click", function(ev){
    openDlg("revision", "Pedir revisão", "Descreva o que deseja ajustar. A equipe será notificada.", ev.currentTarget);
  });
  document.getElementById("btnEdit").addEventListener("click", function(ev){
    openDlg("edit_request", "Editar cronograma", "Conte quais alterações você gostaria de fazer. A equipe abrirá o cronograma para edição.", ev.currentTarget);
  });
})();
</script>
</body>
</html>`;
}

function renderClientErrorHtml(title, msg) {
  const t = escapeHtml(title);
  const m = escapeHtml(msg);
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${t} · Agenda ID Seven</title>
<meta name="theme-color" content="#0A0B10"/>
<meta name="robots" content="noindex,nofollow"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${t} · Agenda ID Seven"/>
<meta property="og:description" content="${m}"/>
<style>
  html,body{margin:0;padding:0;background:#0A0B10;color:#E6E8F0;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif;min-height:100vh}
  .wrap{max-width:520px;margin:0 auto;padding:48px 22px;text-align:center}
  .icon{font-size:44px;margin-bottom:14px}
  h1{margin:0 0 10px;color:#fff;font-size:22px;font-weight:700}
  p{margin:0 auto;max-width:380px;color:#9ca3af}
  .brand{margin-top:36px;color:#525a6e;font-size:12px;letter-spacing:.4px;text-transform:uppercase}
</style></head>
<body><div class="wrap">
  <div class="icon">🔒</div>
  <h1>${t}</h1>
  <p>${m}</p>
  <div class="brand">Agenda ID Seven</div>
</div></body></html>`;
}

/* ───────────────────────── HELPERS ───────────────────────── */
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": (env && env.ALLOWED_ORIGIN) || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
function json(obj, status, env) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(env)) });
}
function stringifyData(data) {
  const out = {};
  for (const k of Object.keys(data || {})) {
    const v = data[k];
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}
function isoDate(ms) { return new Date(ms).toISOString().slice(0, 10); }
function b64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
