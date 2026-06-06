/* ============================================================================
   ID Seven — Cloudflare Worker  [V64.20-client-link-preview-premium]
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
      // V64.16 — estado JSON p/ tempo real (polling do portal; mesmo token/link, no-store).
      const stateMatch = url.pathname.match(/^\/cliente\/cronograma\/([A-Za-z0-9_-]{4,128})\/state\/?$/);
      if (stateMatch && request.method === "GET") {
        return handleClientCronogramaState(stateMatch[1], env);
      }
    }

    if (request.method === "POST") {
      return handlePushRelay(request, env);
    }

    return json({ ok: true, service: "idseven-push", version: "V64.20-client-link-preview-premium" }, 200, env);
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

  /* ───── ATRASO DO DESIGNER (V64.9): push URGENTE ao designer quando o prazo de término
     vence e a tarefa ainda não foi concluída. Dedup por `lateNotifiedAt` (uma vez por prazo).
     Escopo: tarefas no fluxo de designer (cronStatus IN [sent_to_designer, in_design]).
     Aditivo: não altera o lembrete normal nem o status da tarefa. ───── */
  report.late = [];
  try {
    const designerTasks = await queryTasksByCronStatusIn(env, accessToken, ["sent_to_designer", "in_design"]);
    console.log(`[LATE-DESIGNER] ${designerTasks.length} tarefa(s) no fluxo de designer`);
    for (const t of designerTasks) {
      if (!t || t.status === "concluido" || t.done || t.delivered) continue;
      const dueMs = taskDueMs(t, tzOffset);
      if (!dueMs || now <= dueMs) continue;                          // ainda dentro do prazo
      if (Number(t.lateNotifiedAt) >= dueMs) continue;               // já avisado deste prazo
      const designerId = (t.designerAssignment && t.designerAssignment.designerId) || t.assigneeId || null;
      if (!designerId) continue;
      const user = (userDocCache[designerId] !== undefined) ? userDocCache[designerId] : await getUser(env, accessToken, designerId);
      userDocCache[designerId] = user;
      const tokens = dedupeTokensByDevice((user && Array.isArray(user.fcmTokens)) ? user.fcmTokens.filter(Boolean) : [], user && user.fcmTokenMeta);
      const overdueMin = Math.round((now - dueMs) / 60000);
      report.late.push({ taskId: t.id, designerId, overdueMin, hasTokens: tokens.length > 0 });
      console.log(`[LATE-DESIGNER] task=${t.id} designer=${designerId} overdueMin=${overdueMin} tokens=${tokens.length}`);
      if (dryRun) continue;
      if (tokens.length) {
        const results = await sendToTokens(env, accessToken, tokens, designerLatePayload(t.id, t));
        console.log(`[LATE-DESIGNER] sent task=${t.id} ok=${results.filter((r) => r.ok).length}/${tokens.length}`);
      }
      await markField(env, accessToken, "tasks", t.id, "lateNotifiedAt", now);
    }
  } catch (e) { console.warn("[LATE-DESIGNER] erro:", e && e.message); }

  return report;
}

/* tarefas cujo cronStatus está em uma lista (IN) — usado p/ detecção de atraso do designer. */
async function queryTasksByCronStatusIn(env, accessToken, values) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId: "tasks" }],
      where: { fieldFilter: { field: { fieldPath: "cronStatus" }, op: "IN", value: { arrayValue: { values: values.map((v) => ({ stringValue: v })) } } } },
      limit: 300,
    },
  };
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) { console.error("[LATE-DESIGNER] runQuery falhou:", res.status, (await res.text()).slice(0, 200)); return []; }
  const rows = await res.json();
  const out = [];
  for (const row of rows) { if (!row.document) continue; const id = row.document.name.split("/").pop(); out.push(Object.assign({ id }, decodeFields(row.document.fields))); }
  return out;
}

/* Mensagem premium URGENTE de prazo vencido ao designer. */
function designerLatePayload(id, doc) {
  const cliente = doc.client || "";
  const titulo = doc.title || "Tarefa";
  const title = "⏰ Prazo vencido: entrega urgente necessária";
  const body = (cliente ? cliente + " — " : "") + titulo + " · entregue com urgência.";
  const data = stringifyData({
    type: "task", taskId: id, title, body,
    responsibleId: (doc.designerAssignment && doc.designerAssignment.designerId) || doc.assigneeId || "",
    deepLink: "task:" + id, channel: "designer_late", urgent: "true",
    tag: "late-" + id, renotify: "true",
  });
  return { title, body, data };
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
  try {
    if (!token) return htmlResponse(renderClientErrorHtml("Link inválido", "O link não contém um token válido."), 400);
    let accessToken;
    // Mesmo escopo usado pelo CRON p/ ler Firestore (comprovadamente funcional).
    try { accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE); }
    catch (e) {
      console.error("[CLIENT-VIEW] auth falhou:", e && e.message);
      return htmlResponse(renderClientErrorHtml("Indisponível", "Não foi possível carregar agora. Tente novamente em instantes."), 503);
    }
    const task = await queryTaskByToken(env, accessToken, token);
    if (!task) {
      console.log(`[CLIENT-VIEW] token nao encontrado: ${token.slice(0, 6)}…`);
      return htmlResponse(renderClientErrorHtml("Cronograma não encontrado",
        "Este link pode ter sido invalidado ou ainda não foi compartilhado. Fale com sua equipe ID Seven."), 404);
    }
    console.log(`[CLIENT-VIEW] ok task=${task.id} client=${task.client || ""}`);
    // P2: a tela de SUCESSO só aparece na aprovação FINAL REAL.
    // V64.14 (status-consistency): o gate usa SÓ os sinais deliberados de encerramento final
    // (finalApprovalCompleted / clientFlowStatus='concluido'). O status BRUTO do kanban
    // (task.status / workflowStage = 'concluido'), que pode vir de mover o card manualmente,
    // NÃO encerra mais a Visão do Cliente — evita tela final prematura.
    if (task.finalApprovalCompleted === true || task.clientFlowStatus === "concluido") {
      return htmlResponse(renderClientSuccessHtml(task, token), 200);
    }
    // V64.14: já aprovou a fase atual (temas/produção) e ainda NÃO é final? Mostra a
    // confirmação INTERMEDIÁRIA (não a página de ações aberta como se nada tivesse ocorrido).
    const acked = clientAckedPhase(task);
    if (acked) return htmlResponse(renderClientPhaseAckHtml(task, token, acked), 200);
    return htmlResponse(renderClientHtml(task, token, env), 200);
  } catch (e) {
    // Blindagem: qualquer erro inesperado de render/query → HTML amigável (NUNCA tela branca/JSON/corpo vazio).
    console.error("[CLIENT-VIEW] erro inesperado:", e && (e.stack || e.message));
    return htmlResponse(renderClientErrorHtml("Algo deu errado",
      "Tivemos um problema ao montar sua página. Tente novamente em instantes ou fale com a equipe ID Seven."), 500);
  }
}

async function handleClientCronogramaAction(token, request, env) {
  let payload = {};
  try { payload = await request.json(); } catch (_) { /* tolera body vazio */ }
  const type = (payload && typeof payload.action === "string") ? payload.action.trim() : "";
  // Globais + GRANULARES por conteúdo (V64.7). Back-compat: approve/revision/edit_request.
  const ALLOWED = [
    "approve", "approveAll", "revision", "edit_request",        // globais
    "approveItem", "reviseItem", "editTheme", "editLegenda", "noteItem", "comment", // por item
  ];
  if (ALLOWED.indexOf(type) < 0) {
    return json({ ok: false, error: "ação inválida" }, 400, env);
  }
  const note = (payload && typeof payload.note === "string") ? payload.note.slice(0, 1000) : "";
  const value = (payload && typeof payload.value === "string") ? payload.value.slice(0, 4000) : "";
  let ci = null;
  if (payload && typeof payload.contentIndex === "number" && payload.contentIndex >= 0) ci = Math.floor(payload.contentIndex);
  else if (payload && typeof payload.contentIndex === "string" && /^\d+$/.test(payload.contentIndex)) ci = parseInt(payload.contentIndex, 10);

  let accessToken;
  try { accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE); }
  catch (e) { return json({ ok: false, error: "auth falhou: " + (e && e.message) }, 200, env); }

  const task = await queryTaskByToken(env, accessToken, token);
  if (!task) return json({ ok: false, error: "token inválido" }, 404, env);

  const now = Date.now();
  const phaseIn = clientPhase(task);                                              // V64.13 — fase ANTES da escrita
  const g = await writeClientGranular(env, accessToken, task, { type, contentIndex: ci, note, value, at: now });
  // FINAL gating: só é "aprovação final" se a fase de entrada for 'final' E o eixo do cliente concluiu.
  const final = phaseIn === "final" && !!(g && (g.client === "concluido" || g.col === "concluido"));
  console.log(`[CLIENT-ACTION] task=${task.id} type=${type} item=${ci} phase=${phaseIn} final=${final} clientFlow=${(g && g.client) || ""}`);
  return json({ ok: true, type, contentIndex: ci, at: now, final, phase: phaseIn, col: (g && g.col) || null, clientFlowStatus: (g && g.client) || null }, 200, env);
}

/* V64.16 — ESTADO JSON p/ TEMPO REAL. O portal faz polling leve e atualiza tema/legenda/Feed/
   Story/badge sem recarregar, no MESMO link. Sem cache (no-store). */
async function handleClientCronogramaState(token, env) {
  try {
    let accessToken;
    try { accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE); }
    catch (e) { return json({ ok: false, error: "auth" }, 200, env); }
    const task = await queryTaskByToken(env, accessToken, token);
    if (!task) return json({ ok: false, error: "not_found" }, 200, env);
    const items = Array.isArray(task.cronWeeks) ? task.cronWeeks : (Array.isArray(task.cronContents) ? task.cronContents : []);
    const ci = (task.clientItems && typeof task.clientItems === "object") ? task.clientItems : {};
    const firstUrl = (v) => { if (!v) return ""; if (typeof v === "string") return v; if (Array.isArray(v)) { for (const z of v) { if (z && typeof z === "string") return z; if (z && z.url) return z.url; } return ""; } return v.url || ""; };
    const out = items.map((raw, i) => {
      const c = (raw && typeof raw === "object") ? raw : {};
      const ov = ci["i" + i] || {};
      const tema = (typeof ov.theme === "string" && ov.theme) ? ov.theme : (c.t || c.tema || ("Conteúdo " + (i + 1)));
      const legRaw = (typeof ov.legenda === "string") ? ov.legenda : (typeof c.legenda === "string" ? c.legenda : (typeof c.caption === "string" ? c.caption : (typeof c.lg === "string" ? c.lg : (typeof c.l === "string" ? c.l : ""))));
      return { i, cs: ov.cs || c.cs || "", tema, legenda: (legRaw || "").toString(),
        feed: firstUrl(c.feed) || (c.feedImageUrl || ""), story: firstUrl(c.story || c.stories) || (c.storyImageUrl || "") };
    });
    const pendingRevision = Object.keys(ci).some((k) => { const cs = ci[k] && ci[k].cs; return cs === "em_revisao" || cs === "editado"; })
      || (task.clientReview && task.clientReview.status === "revisao");
    const finalDone = task.finalApprovalCompleted === true || task.clientFlowStatus === "concluido";
    return json({ ok: true, phase: clientPhase(task), pendingRevision, finalDone, updatedAt: task.updatedAt || 0, items: out }, 200, env);
  } catch (e) {
    return json({ ok: false, error: "err" }, 200, env);
  }
}

/* Persistência ADITIVA e granular do feedback do cliente (V64.7).
   NÃO reescreve cronWeeks (evita clobber de edição concorrente do Desktop) e NÃO
   toca cronStatus/clientReview/history. Grava em 3 campos novos (merge por updateMask):
     - clientLastAction : map  {type, at, note, contentIndex} (compat com leitura existente)
     - clientActions.a<at> : map  log granular {type, at, contentIndex, field, newValue, note}
     - clientItems.i<idx>  : map  estado do item p/ o cliente {cs, theme, legenda, note, at}
   A Desktop lê clientItems/clientActions para mostrar exatamente o que o cliente mexeu. */
async function writeClientGranular(env, accessToken, task, e) {
  const taskId = task.id;
  const at = e.at;
  const aid = "a" + at;                  // chave de ação (começa com letra → field path válido)
  const perItem = ["approveItem", "reviseItem", "editTheme", "editLegenda", "noteItem"].indexOf(e.type) >= 0 && e.contentIndex != null;

  // log granular (clientActions.<aid>)
  const actFields = { type: { stringValue: e.type }, at: { integerValue: String(at) } };
  if (e.contentIndex != null) actFields.contentIndex = { integerValue: String(e.contentIndex) };
  if (e.note) actFields.note = { stringValue: e.note };
  if (e.type === "editTheme") { actFields.field = { stringValue: "tema" }; actFields.newValue = { stringValue: e.value }; }
  if (e.type === "editLegenda") { actFields.field = { stringValue: "legenda" }; actFields.newValue = { stringValue: e.value }; }

  // clientLastAction (compat de leitura)
  const lastActionFields = {
    type: { stringValue: e.type }, at: { integerValue: String(at) }, note: { stringValue: e.note || "" },
  };
  if (e.contentIndex != null) lastActionFields.contentIndex = { integerValue: String(e.contentIndex) };

  const fields = {
    clientLastAction: { mapValue: { fields: lastActionFields } },
    clientActions: { mapValue: { fields: { [aid]: { mapValue: { fields: actFields } } } } },
    updatedAt: { integerValue: String(at) },                 // sinaliza mudança p/ quem observa
  };
  const mask = ["clientLastAction", "clientActions." + aid, "updatedAt"];

  // estado POR item (clientItems.i<idx>)
  if (perItem) {
    const key = "i" + e.contentIndex;
    const itemFields = { at: { integerValue: String(at) } };
    if (e.type === "approveItem") itemFields.cs = { stringValue: "aprovado" };
    else if (e.type === "reviseItem") { itemFields.cs = { stringValue: "em_revisao" }; if (e.note) itemFields.note = { stringValue: e.note }; }
    else if (e.type === "editTheme") { itemFields.cs = { stringValue: "editado" }; itemFields.theme = { stringValue: e.value }; }
    else if (e.type === "editLegenda") { itemFields.cs = { stringValue: "editado" }; itemFields.legenda = { stringValue: e.value }; }
    else if (e.type === "noteItem") { if (e.note) itemFields.note = { stringValue: e.note }; }
    fields.clientItems = { mapValue: { fields: { [key]: { mapValue: { fields: itemFields } } } } };
    mask.push("clientItems." + key);
  }

  /* ───── V64.9 (fluxo lógico): além de cronStatus/clientReview, MOVE a coluna do
     kanban (campo `status`) conforme a fase, e registra `workflowStage` (aditivo):
       • aprovação INICIAL dos temas → status='andamento' (Em andamento), stage='producao'
       • aprovação FINAL (reenvio) → status='concluido', stage='concluido'
       • revisão / edição → status='revisao', stage='revisao'
     Fase detectada pelo cronStatus atual: 'ready_for_final_client_review' (reenvio) = final. ───── */
  // V64.13 — Fase de entrada (explícita via clientApprovalPhase OU derivada).
  // SÓ 'final' encerra. 'themes'/'production' continuam o fluxo com clientFlowStatus='aprovado'.
  const phaseIn = clientPhase(task);
  const isFinalPhase = phaseIn === "final";
  // V64.11 — EIXOS SEPARADOS: além de `status`/`workflowStage` (compat), grava o eixo
  // DO CLIENTE (`clientFlowStatus`/`clientWorkflowStage`). A tarefa NÃO sai do fluxo do
  // cliente quando vai ao designer; só sai de cena na aprovação FINAL (clientFlowStatus=concluido).
  //   client: 'aprovado' (temas aprovados) | 'revisao' (pediu ajuste) | 'concluido' (aprovação final)
  const approveG = isFinalPhase
    ? { cs: "aprovado_cliente", rev: "aprovado", htype: "cliente_aprovou_final", label: "Cliente aprovou a entrega final", col: "concluido", stage: "concluido", client: "concluido" }
    : { cs: "aprovado_cliente", rev: "aprovado", htype: "cliente_aprovou",       label: "Cliente aprovou os temas/cronograma", col: "andamento", stage: "producao", client: "aprovado" };
  const STAT = {
    approve:      approveG,
    approveAll:   approveG,
    revision:     { cs: "em_revisao_cliente", rev: "revisao", htype: "cliente_pediu_revisao", label: "Cliente pediu revisão geral",         col: "revisao", stage: "revisao", client: "revisao" },
    reviseItem:   { cs: "em_revisao_cliente", rev: "revisao", htype: "cliente_pediu_revisao", label: "Cliente pediu ajuste em um conteúdo", col: "revisao", stage: "revisao", client: "revisao" },
    edit_request: { cs: "editado_cliente",    rev: "editado", htype: "cliente_editou",        label: "Cliente solicitou edição",            col: "revisao", stage: "revisao", client: "revisao" },
    editTheme:    { cs: "editado_cliente",    rev: "editado", htype: "cliente_editou",        label: "Cliente editou o tema de um conteúdo",    col: "revisao", stage: "revisao", client: "revisao" },
    editLegenda:  { cs: "editado_cliente",    rev: "editado", htype: "cliente_editou",        label: "Cliente editou a legenda de um conteúdo", col: "revisao", stage: "revisao", client: "revisao" },
    noteItem:     { cs: null, rev: null, htype: "cliente_comentou", label: "Cliente deixou uma observação", col: null, stage: null, client: null },
    comment:      { cs: null, rev: null, htype: "cliente_comentou", label: "Cliente comentou no cronograma", col: null, stage: null, client: null },
  };
  let g = STAT[e.type] || { cs: null, rev: null, htype: "cliente_acao", label: "Ação do cliente", col: null, stage: null, client: null };

  // V64.16 — GATE de aprovação PARCIAL: se QUALQUER conteúdo tem ajuste/edição pendente,
  // 'approve'/'approveAll' NÃO pode marcar tudo aprovado nem liberar produção. Vira feedback
  // (revisão), preservando os aprovados individuais e o ajuste pedido. (bug do vídeo: T1 ok,
  // T2 ajuste, T3 ok → continuava virando "Temas aprovados").
  const _ci0 = (task.clientItems && typeof task.clientItems === "object") ? task.clientItems : {};
  const _pendingRev = Object.keys(_ci0).some((k) => { const cs = _ci0[k] && _ci0[k].cs; return cs === "em_revisao" || cs === "editado"; });
  if ((e.type === "approve" || e.type === "approveAll") && _pendingRev) {
    g = { cs: "em_revisao_cliente", rev: "revisao", htype: "cliente_enviou_feedback",
          label: "Cliente enviou feedback (há ajustes pendentes)", col: "revisao", stage: "revisao", client: "revisao" };
  }

  // approveItem: só conclui/avança quando TODOS os conteúdos estiverem aprovados.
  if (e.type === "approveItem") {
    const arr = Array.isArray(task.cronWeeks) ? task.cronWeeks : (Array.isArray(task.cronContents) ? task.cronContents : []);
    const total = arr.length;
    const ci = (task.clientItems && typeof task.clientItems === "object") ? task.clientItems : {};
    const approved = new Set();
    for (const k of Object.keys(ci)) { if (ci[k] && ci[k].cs === "aprovado") approved.add(k); }
    approved.add("i" + e.contentIndex);
    if (total > 0 && approved.size >= total) g = Object.assign({}, approveG, { label: "Cliente aprovou todos os conteúdos" });
    else g = { cs: null, rev: null, htype: "cliente_aprovou_item", label: "Cliente aprovou um conteúdo", col: null, stage: null, client: null };
  }

  if (g.cs) {
    fields.cronStatus = { stringValue: g.cs };
    fields.clientReview = { mapValue: { fields: {
      status: { stringValue: g.rev },
      note: { stringValue: e.note || "" },
      at: { integerValue: String(at) },
      byName: { stringValue: "Cliente" },
    } } };
    fields.clientReviewAt = { integerValue: String(at) };
    mask.push("cronStatus", "clientReview", "clientReviewAt");
  }
  const statusFrom = (task.status || "afazer");
  if (g.col) { fields.status = { stringValue: g.col }; mask.push("status"); }
  if (g.stage) { fields.workflowStage = { stringValue: g.stage }; mask.push("workflowStage"); }
  // V64.11 — eixo do CLIENTE (independente do designer; só conclui na aprovação final).
  const clientFrom = (task.clientFlowStatus || "");
  if (g.client) {
    fields.clientFlowStatus = { stringValue: g.client };
    fields.clientWorkflowStage = { stringValue: g.client };
    mask.push("clientFlowStatus", "clientWorkflowStage");
  }
  // V64.12 — APROVAÇÃO FINAL: registra encerramento do eixo do cliente + operacional.
  // NÃO apaga socialFlowStatus/designerFlowStatus (updateMask só toca os campos abaixo).
  if (g.client === "concluido") {
    fields.clientFinalApprovedAt = { integerValue: String(at) };
    fields.clientFinalApprovedBy = { stringValue: "Cliente" };
    fields.finalApprovalCompleted = { booleanValue: true };
    fields.operationalStatus = { stringValue: "concluido" };
    fields.clientClosedMessageShown = { booleanValue: true };
    mask.push("clientFinalApprovedAt", "clientFinalApprovedBy", "finalApprovalCompleted", "operationalStatus", "clientClosedMessageShown");
  }

  // entrada de histórico (arrayUnion via appendMissingElements — REST :commit)
  const histFields = {
    type: { stringValue: g.htype },
    label: { stringValue: g.label },
    at: { integerValue: String(at) },
    by: { stringValue: "Cliente" },
    channel: { stringValue: "client_public" },
    client: { stringValue: (task.client || "") },
    note: { stringValue: e.note || "" },
  };
  if (e.contentIndex != null) histFields.contentIndex = { integerValue: String(e.contentIndex) };
  if (g.col && g.col !== statusFrom) { histFields.statusFrom = { stringValue: statusFrom }; histFields.statusTo = { stringValue: g.col }; }
  if (g.client && g.client !== clientFrom) { histFields.clientFrom = { stringValue: clientFrom }; histFields.clientTo = { stringValue: g.client }; }
  const histValue = { mapValue: { fields: histFields } };

  const docName = `projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/tasks/${taskId}`;
  const body = {
    writes: [{
      update: { name: docName, fields },
      updateMask: { fieldPaths: mask },
      updateTransforms: [{ fieldPath: "history", appendMissingElements: { values: [histValue] } }],
    }],
  };
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:commit`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.warn("[CLIENT-ACTION] commit falhou:", res.status, (await res.text()).slice(0, 240));
    else console.log(`[CLIENT-ACTION] commit ok task=${taskId} type=${e.type} cronStatus=${g.cs || "(inalterado)"}`);
  } catch (err) {
    console.warn("[CLIENT-ACTION] erro ao gravar feedback granular:", err && err.message);
  }
  return g;   // {cs, rev, htype, label, col, stage} — handler usa p/ saber se concluiu (col==='concluido')
}

/* Query Firestore pela task que corresponde ao token público do cliente.
   O token pode estar em DOIS campos, conforme a origem do link:
     - clientReviewToken  → Desktop (genReviewToken → ensureReviewToken)
     - shareToken         → Web/PWA (genShareToken)
   Tenta clientReviewToken primeiro (origem dos links /cliente/cronograma/<token>),
   depois shareToken como fallback. Equality simples — não exige índice composto. */
async function queryTaskByToken(env, accessToken, token) {
  for (const field of ["clientReviewToken", "shareToken"]) {
    const task = await queryTaskByField(env, accessToken, field, token);
    if (task) { console.log(`[CLIENT-VIEW] task achada por ${field}`); return task; }
  }
  return null;
}

async function queryTaskByField(env, accessToken, field, value) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId: "tasks" }],
      where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } },
      limit: 1,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(q),
  });
  if (!res.ok) {
    // Distingue FALHA de query (auth/permissão/Firestore) de "não encontrado".
    // Lança para o handler cair no catch (página "Algo deu errado", 500) em vez de
    // mascarar como 404 — assim um problema de infra não vira "link inválido".
    const body = (await res.text()).slice(0, 200);
    console.error(`[CLIENT-VIEW] runQuery(${field}) falhou:`, res.status, body);
    throw new Error(`firestore runQuery ${field} ${res.status}: ${body}`);
  }
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

// V64.13 — Fase REAL da aprovação do cliente.
// 'themes' = primeiro envio (só temas) · 'production' = legendas/posts em validação
// 'final' = aprovação final (reenvio após produção). Explícito > derivado.
function clientPhase(task) {
  const explicit = (task.clientApprovalPhase || "").toString();
  if (explicit === "themes" || explicit === "production" || explicit === "final") return explicit;
  if (task.finalApprovalCompleted === true) return "final";
  if (task.cronStatus === "ready_for_final_client_review"
      || task.workflowStage === "entrega" || task.workflowStage === "revisao_final") return "final";
  // Deriva pela completude do conteúdo: todas com legenda E todas com Feed -> produção/final-prox.
  const arr = Array.isArray(task.cronWeeks) ? task.cronWeeks
    : (Array.isArray(task.cronContents) ? task.cronContents : []);
  const total = arr.length || 0;
  if (total > 0) {
    const withLegend = arr.filter((c) => c && c.legenda && String(c.legenda).trim()).length;
    const withFeed = arr.filter((c) => c && c.feedImageUrl).length;
    if (withLegend === total && withFeed === total) return "production";
  }
  return "themes";
}
function phaseCopy(phase) {
  if (phase === "final") return {
    kicker: "Aprovação final do cronograma",
    title: "Aprovação final do cronograma",
    sub: "Confira legendas, Feed e Story. Ao aprovar aqui, o processo é encerrado.",
    cta: "Aprovar versão final",
  };
  if (phase === "production") return {
    kicker: "Aprovação de legendas e artes",
    title: "Aprovação de legendas e artes",
    sub: "Confira as legendas e as artes. Ainda haverá uma etapa final.",
    cta: "Aprovar legendas e artes",
  };
  return {
    kicker: "Aprovação de temas",
    title: "Aprovação de temas",
    sub: "Você está aprovando apenas os temas. A equipe seguirá com a produção (designer + legendas + posts).",
    cta: "Aprovar temas e liberar produção",
  };
}
/* V64.14 — Fase JÁ aprovada pelo cliente (para mostrar confirmação intermediária no reabrir).
   Retorna 'themes' | 'production' | null. NUNCA esconde uma aprovação ainda necessária:
   - themes: aprovou e a produção ainda não está pronta (fase derivada continua 'themes').
   - production: só quando a fase está EXPLICITAMENTE marcada 'production' E já aprovada.
   - final é tratado pela tela de sucesso (não entra aqui). */
function clientAckedPhase(task) {
  const cr = (task.clientReview && task.clientReview.status) || "";
  const approved = cr === "aprovado" || task.cronStatus === "aprovado_cliente" || task.clientFlowStatus === "aprovado";
  if (!approved) return null;
  const ph = clientPhase(task);
  if (ph === "final") return null;
  if (ph === "themes") return "themes";
  if (ph === "production" && (task.clientApprovalPhase || "") === "production") return "production";
  return null;
}
/* V64.14 — Página INTERMEDIÁRIA server-rendered (reabrir após aprovar temas/produção).
   Mantém o MESMO link, sem botões de ação abertos, com linguagem da fase seguinte. */
function renderClientPhaseAckHtml(task, token, phase) {
  const cliente = escapeHtml(task.client || "Cliente");
  const titulo = escapeHtml(task.title || "Cronograma");
  const isThemes = phase === "themes";
  const h2 = isThemes ? "Temas aprovados!" : "Legendas e artes aprovadas!";
  const msg = isThemes
    ? "A equipe seguirá para a etapa de produção (designer, legendas e posts). Em breve você receberá a versão final neste mesmo link para a aprovação final."
    : "A equipe enviará a versão final completa para a sua aprovação. Em breve você receberá o aviso neste mesmo link.";
  const next = isThemes ? "Aguardando produção · legendas e artes" : "Aguardando aprovação final";
  return '<!doctype html>\n<html lang="pt-BR"><head>\n' +
'<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>\n' +
'<title>' + cliente + ' · ' + titulo + ' · Visão do Cliente</title>\n<meta name="theme-color" content="#070810"/>\n' +
'<meta name="robots" content="noindex,nofollow"/>\n' +
'<style>' + CV_CSS + '</style></head><body>\n' +
'<div class="wrap"><div class="topbar"><div class="brand">' + CV_LOGO + '<div class="bn">Agenda ID Seven<small>Visão do Cliente</small></div></div>' +
  '<div class="secure">' + ICN.shield + '<span class="lbl">Link seguro</span></div></div>' +
  '<div class="midwrap"><div class="midcard"><div class="mid-badge">' + ICN.check + '</div>' +
    '<h2>' + h2 + '</h2><p>' + msg + '</p>' +
    '<div class="phase-banner phase-' + (isThemes ? "production" : "final") + '" style="justify-content:center;margin-top:16px"><span class="phase-dot"></span><b>' + next + '</b></div>' +
    '<div class="mid-foot">Você pode fechar esta página — vamos te avisar. 💜</div></div></div>' +
'</div></body></html>';
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

/* ───── Visão do Cliente premium (V64.7) — assets server-rendered ───── */
const ICN = {
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  type:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2M9 19h6M12 5v14"/></svg>',
  text:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
  zoom:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  revise:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  chev:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
};
const CV_LOGO = '<svg class="logo" viewBox="0 0 96 96" aria-label="ID Seven"><defs><linearGradient id="gcv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#c64bd8"/></linearGradient></defs><circle cx="48" cy="48" r="43" fill="none" stroke="url(#gcv)" stroke-width="7"/><circle cx="48" cy="48" r="29" fill="#22d3b8"/><rect x="34" y="38" width="28" height="20" rx="3" fill="#fff"/><rect x="42" y="60" width="12" height="3" rx="1.5" fill="#fff"/><rect x="38" y="43" width="20" height="2.4" rx="1.2" fill="#0c2f2a"/><rect x="38" y="47.5" width="14" height="2.4" rx="1.2" fill="#0c2f2a"/><rect x="38" y="52" width="17" height="2.4" rx="1.2" fill="#0c2f2a"/></svg>';

const CV_CSS = `
:root{--bg:#070810;--bg2:#0c0e1a;--panel:#10131f;--panel2:#141826;--line:#1f2435;--line2:#2a3149;--txt:#EDEFF7;--mut:#9aa3bd;--faint:#6b7390;--brand1:#7c5cff;--brand2:#c64bd8;--teal:#22d3b8;--ok:#34d399;--okbg:rgba(52,211,153,.12);--warn:#f5a524;--rev:#fb7185;--revbg:rgba(251,113,133,.13);--info:#5b9bff;--infobg:rgba(91,155,255,.12);--radius:18px;--radius-sm:13px;--shadow:0 24px 70px -30px rgba(124,92,255,.55);--ff:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}
body{background:radial-gradient(1100px 520px at 12% -8%,rgba(124,92,255,.20),transparent 60%),radial-gradient(900px 480px at 105% 0%,rgba(198,75,216,.14),transparent 55%),radial-gradient(700px 600px at 50% 120%,rgba(34,211,184,.07),transparent 60%),var(--bg);color:var(--txt);font:15px/1.55 var(--ff);-webkit-font-smoothing:antialiased;min-height:100vh}
a{color:#b9a4ff;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:30px 22px 160px}
@media(max-width:560px){.wrap{padding:18px 14px 150px}}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:12px}.brand .logo{width:44px;height:44px;flex:0 0 44px;filter:drop-shadow(0 6px 16px rgba(124,92,255,.45))}
.brand .bn{font-weight:800;letter-spacing:.2px;font-size:15px}.brand .bn small{display:block;font-weight:600;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:var(--faint);margin-top:1px}
.secure{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--mut);background:rgba(255,255,255,.04);border:1px solid var(--line);padding:7px 12px;border-radius:999px}.secure svg{width:13px;height:13px}
@media(max-width:560px){.secure .lbl{display:none}.secure{padding:7px}}
.hero{position:relative;overflow:hidden;border-radius:24px;padding:30px 30px 26px;background:linear-gradient(135deg,rgba(124,92,255,.20),rgba(198,75,216,.08) 45%,rgba(34,211,184,.06)),var(--panel);border:1px solid var(--line2);box-shadow:var(--shadow)}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(600px 200px at 90% -20%,rgba(198,75,216,.22),transparent 60%);pointer-events:none}
.hero-top{position:relative;z-index:1}.kicker{font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--brand2)}
.hero h1{position:relative;z-index:1;margin:12px 0 4px;font-size:34px;line-height:1.1;letter-spacing:-.02em;font-weight:800}
@media(max-width:560px){.hero{padding:24px 20px}.hero h1{font-size:26px}}
.hero .cli{position:relative;z-index:1;color:var(--mut);font-size:15px}.hero .cli b{color:var(--txt);font-weight:700}
.hero-meta{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}
.mpill{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.05);border:1px solid var(--line2);padding:8px 13px;border-radius:12px;font-size:12.5px;color:var(--txt)}.mpill svg{width:14px;height:14px;color:var(--mut)}.mpill .mv{color:var(--mut)}
.mpill.status{border-color:rgba(34,211,184,.35);background:rgba(34,211,184,.10)}.mpill.status .dot{width:8px;height:8px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 3px rgba(34,211,184,.18)}
.prog{position:relative;z-index:1;margin-top:20px}.prog-h{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut);margin-bottom:7px}
.prog-bar{height:9px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;border:1px solid var(--line)}.prog-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--brand1),var(--brand2) 60%,var(--teal));box-shadow:0 0 18px rgba(124,92,255,.5);transition:width .4s ease}
.sec{margin:30px 2px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.sec.hide{display:none}
.sec h2{margin:0;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--faint)}
.sec .legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--mut)}.sec .legend i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:middle}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);margin-bottom:14px;overflow:hidden;transition:border-color .18s,box-shadow .18s}
.card:hover{border-color:var(--line2)}.card.is-open{border-color:rgba(124,92,255,.45);box-shadow:0 18px 50px -32px rgba(124,92,255,.6)}
.card.pad{padding:16px}
.chead{display:flex;align-items:center;gap:14px;padding:16px;cursor:pointer;user-select:none}
.cidx{flex:0 0 40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;background:linear-gradient(135deg,var(--brand1),var(--brand2));color:#fff;box-shadow:0 8px 18px -8px rgba(124,92,255,.8)}
.ctitle{flex:1;min-width:0}.ctitle .ck{font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--faint)}
.ctitle h3{margin:2px 0 0;font-size:16px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cstate{flex:0 0 auto}.badge{font-size:11px;font-weight:700;padding:5px 11px;border-radius:999px;border:1px solid transparent;white-space:nowrap}
.badge .bd{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle}
.b-pend{background:rgba(255,255,255,.05);color:var(--mut);border-color:var(--line2)}.b-ok{background:var(--okbg);color:var(--ok);border-color:rgba(52,211,153,.3)}
.b-rev{background:var(--revbg);color:var(--rev);border-color:rgba(251,113,133,.35)}.b-edit{background:rgba(124,92,255,.12);color:#b9a4ff;border-color:rgba(124,92,255,.35)}
.b-info{background:var(--infobg);color:var(--info);border-color:rgba(91,155,255,.3)}
.chev{flex:0 0 auto;color:var(--faint);transition:transform .22s}.card.is-open .chev{transform:rotate(180deg)}
.cbody{display:none;padding:0 16px 16px;border-top:1px solid var(--line)}.card.is-open .cbody{display:block;animation:fade .25s ease}
@keyframes fade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.field{margin-top:16px}.flabel{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.flabel .fl{font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--faint);display:flex;align-items:center;gap:7px}.flabel .fl svg{width:13px;height:13px;color:var(--brand2)}
.flabel .cnt{font-size:11px;color:var(--mut)}
.fval{background:var(--bg2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:13px 14px;font-size:14px;color:var(--txt);line-height:1.6;white-space:pre-wrap;word-break:break-word}
.fval.theme{font-weight:600;font-size:15px}.fval.note{border-color:rgba(251,113,133,.3)}
.pend{display:flex;align-items:center;gap:11px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.02),rgba(255,255,255,.02) 10px,transparent 10px,transparent 20px),var(--bg2);border:1px dashed var(--line2);border-radius:var(--radius-sm);padding:14px;color:var(--mut)}
.pend .pi{width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;color:var(--faint);flex:0 0 34px}.pend .pi svg{width:16px;height:16px}
.pend .pt{font-weight:600;color:var(--txt)}.pend .ps{font-size:12px;color:var(--faint)}
.media-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}@media(max-width:560px){.media-row{grid-template-columns:1fr}}
.media{position:relative;border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden;background:var(--bg2);display:block}
.media .mh{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;font-size:11px;font-weight:700;letter-spacing:.4px;color:var(--mut);text-transform:uppercase;border-bottom:1px solid var(--line)}.media .mh .on{color:var(--ok)}
.media .thumb{aspect-ratio:1/1;background:linear-gradient(135deg,#1a1f30,#0f1320);display:flex;align-items:center;justify-content:center;position:relative}
.media.story .thumb{aspect-ratio:9/16}.media .thumb img{width:100%;height:100%;object-fit:cover;display:block}
.media .zoom{position:absolute;right:9px;bottom:9px;background:rgba(7,8,16,.78);border:1px solid var(--line2);border-radius:9px;padding:6px 9px;font-size:11px;color:var(--txt);display:flex;align-items:center;gap:5px}.media .zoom svg{width:12px;height:12px}
.media .ph{aspect-ratio:1/1;display:flex;flex-direction:column;gap:7px;align-items:center;justify-content:center;color:var(--faint);background:repeating-linear-gradient(45deg,rgba(255,255,255,.02),rgba(255,255,255,.02) 10px,transparent 10px,transparent 20px)}
.media.story .ph{aspect-ratio:9/16}.media .ph svg{width:26px;height:26px;opacity:.6}.media .ph .pl{font-size:12px;font-weight:600;color:var(--mut)}
.iacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line2)}
.ibtn{appearance:none;border:1px solid var(--line2);background:rgba(255,255,255,.03);color:var(--txt);border-radius:11px;padding:9px 13px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:.14s}.ibtn svg{width:14px;height:14px}
.ibtn:hover{border-color:var(--brand1);background:rgba(124,92,255,.1)}.ibtn.ok{border-color:rgba(52,211,153,.4);color:#9beecb}.ibtn.ok:hover{background:var(--okbg)}
.ibtn.rev{border-color:rgba(251,113,133,.4);color:#ffb1bd}.ibtn.rev:hover{background:var(--revbg)}.ibtn[disabled]{opacity:.5;cursor:wait}
.card.pad textarea{width:100%;min-height:92px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--radius-sm);color:var(--txt);font:inherit;padding:13px;resize:vertical}.card.pad textarea:focus{outline:none;border-color:var(--brand1)}
.hist{display:flex;flex-direction:column;gap:10px}
.hitem{display:flex;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius-sm);padding:12px 13px}
.hicon{flex:0 0 32px;width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center}.hicon svg{width:15px;height:15px}
.hb-ok{background:var(--okbg);color:var(--ok)}.hb-rev{background:var(--revbg);color:var(--rev)}.hb-edit{background:rgba(124,92,255,.12);color:#b9a4ff}.hb-note{background:var(--infobg);color:var(--info)}
.hmain{flex:1;min-width:0}.hmain .ht{font-size:13.5px;font-weight:600}.hmain .hdiff{margin-top:7px;font-size:12px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:8px 10px}.hdiff .new{color:var(--ok)}
.htime{flex:0 0 auto;font-size:11px;color:var(--faint);white-space:nowrap}
.gactions{position:fixed;left:0;right:0;bottom:0;z-index:50;background:linear-gradient(180deg,rgba(7,8,16,0),rgba(7,8,16,.88) 34%,var(--bg) 70%);padding:20px 0 max(18px,env(safe-area-inset-bottom))}
.gactions .inner{max-width:1180px;margin:0 auto;padding:0 22px;display:flex;align-items:center;gap:12px}@media(max-width:560px){.gactions .inner{padding:0 14px;flex-wrap:wrap}}
.gstat{flex:1;min-width:0;font-size:12.5px;color:var(--mut)}.gstat b{color:var(--txt)}@media(max-width:560px){.gstat{flex:1 0 100%;order:-1;margin-bottom:2px}}
.btn{appearance:none;border:0;border-radius:14px;padding:14px 20px;font-size:14.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.14s;white-space:nowrap}.btn svg{width:16px;height:16px}
.btn:active{transform:translateY(1px)}.btn.ghost{background:rgba(255,255,255,.05);border:1px solid var(--line2);color:var(--txt)}.btn.ghost:hover{border-color:var(--brand1)}
.btn.warn{background:linear-gradient(135deg,#f5a524,#fb7185);color:#fff}.btn.primary{background:linear-gradient(135deg,var(--teal),#15b8a6);color:#04231d;box-shadow:0 14px 30px -14px rgba(34,211,184,.8)}.btn[disabled]{opacity:.6;cursor:wait}
@media(max-width:560px){.btn{flex:1;padding:13px 12px;font-size:13.5px}}
.scrim{position:fixed;inset:0;z-index:60;background:rgba(4,5,12,.72);backdrop-filter:blur(4px);display:none;align-items:flex-end;justify-content:center}.scrim.on{display:flex}
@media(min-width:680px){.scrim.on{align-items:center}}
.sheet{width:100%;max-width:560px;background:var(--panel2);border:1px solid var(--line2);border-radius:22px 22px 0 0;padding:20px;box-shadow:0 -30px 80px -20px rgba(0,0,0,.7);animation:up .26s cubic-bezier(.2,.8,.2,1)}
@media(min-width:680px){.sheet{border-radius:22px}}@keyframes up{from{transform:translateY(28px);opacity:.6}to{transform:none;opacity:1}}
.sheet h3{margin:2px 0 4px;font-size:18px;font-weight:800}.sheet .sd{color:var(--mut);font-size:13px;margin-bottom:14px}
.sheet textarea,.sheet input{width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:12px;color:var(--txt);font:inherit;padding:12px;resize:vertical}.sheet textarea{min-height:120px}.sheet textarea:focus,.sheet input:focus{outline:none;border-color:var(--brand1)}
.srow{display:flex;gap:10px;margin-top:14px}.srow .btn{flex:1;padding:13px}
.toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%) translateY(16px);z-index:80;opacity:0;pointer-events:none;background:var(--panel2);border:1px solid var(--line2);border-radius:13px;padding:12px 16px;font-size:13.5px;display:flex;align-items:center;gap:9px;box-shadow:0 18px 50px -18px rgba(0,0,0,.8);transition:.25s}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}.toast svg{width:16px;height:16px}.toast.ok{border-color:rgba(52,211,153,.45)}.toast.ok svg{color:var(--ok)}.toast.err{border-color:rgba(251,113,133,.45)}.toast.err svg{color:var(--rev)}
.foot{margin-top:28px;text-align:center;color:var(--faint);font-size:11.5px}
.errwrap{max-width:480px;margin:7vh auto 0;text-align:center;padding:0 8px}
.errcard{background:var(--panel);border:1px solid var(--line2);border-radius:22px;padding:38px 28px;box-shadow:var(--shadow)}
.erricon{width:64px;height:64px;border-radius:18px;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(124,92,255,.2),rgba(198,75,216,.12));border:1px solid var(--line2)}.erricon svg{width:30px;height:30px;color:#b9a4ff}
.errcard h1{margin:0 0 8px;font-size:22px;font-weight:800}.errcard p{margin:0 auto;max-width:340px;color:var(--mut)}.errcard .eb{margin-top:22px;color:var(--faint);font-size:11px;letter-spacing:1.4px;text-transform:uppercase}
/* tela final de sucesso (P2) */
.succwrap{max-width:560px;margin:6vh auto 0;text-align:center;padding:0 10px}
.succcard{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(52,211,153,.10),rgba(34,211,184,.04)),var(--panel);border:1px solid rgba(52,211,153,.32);border-radius:24px;padding:44px 30px 34px;box-shadow:0 24px 70px -30px rgba(34,211,184,.5)}
.succcard::after{content:"";position:absolute;inset:0;background:radial-gradient(440px 200px at 50% -10%,rgba(52,211,153,.22),transparent 60%);pointer-events:none}
.succ-badge{position:relative;z-index:1;width:78px;height:78px;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--ok),var(--teal));box-shadow:0 14px 36px -10px rgba(52,211,153,.7)}
.succ-badge svg{width:38px;height:38px;color:#04231d}
.succcard h1{position:relative;z-index:1;margin:0 0 10px;font-size:26px;font-weight:800;letter-spacing:-.01em}
.succcard p{position:relative;z-index:1;margin:0 auto;max-width:400px;color:var(--mut);font-size:15px;line-height:1.6}
.succ-meta{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:9px;justify-content:center;margin-top:22px}
.succ-meta .pill{background:rgba(255,255,255,.05);border:1px solid var(--line2);padding:8px 13px;border-radius:12px;font-size:12.5px;color:var(--txt)}
.succ-meta .pill.ok{border-color:rgba(52,211,153,.35);background:var(--okbg);color:var(--ok)}
.succ-foot{position:relative;z-index:1;margin-top:24px;color:var(--faint);font-size:12px}
/* V64.13 — Banner de FASE da aprovação no topo da hero (themes/production/final) */
.phase-banner{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px;border:1px solid;border-radius:13px;padding:10px 14px;font-size:13.5px;line-height:1.45}
.phase-banner b{font-weight:800}
.phase-banner .phase-sub{color:var(--mut);font-size:12.5px;width:100%;margin-top:2px}
.phase-banner .phase-dot{width:10px;height:10px;border-radius:50%;flex:none}
.phase-banner.phase-themes{background:rgba(91,108,255,.10);border-color:rgba(91,108,255,.35);color:#a6b4ff}
.phase-banner.phase-themes .phase-dot{background:#5B6CFF}
.phase-banner.phase-production{background:rgba(245,158,11,.10);border-color:rgba(245,158,11,.35);color:#fcd283}
.phase-banner.phase-production .phase-dot{background:#F59E0B}
.phase-banner.phase-final{background:rgba(52,211,153,.10);border-color:rgba(52,211,153,.35);color:#86e7c4}
.phase-banner.phase-final .phase-dot{background:#34D399}
/* Tela INTERMEDIÁRIA (temas/produção aprovados — NÃO encerra) */
.midwrap{max-width:560px;margin:18px auto 6px;padding:0 10px}
.midcard{background:linear-gradient(180deg,rgba(91,108,255,.10),rgba(91,108,255,.02)),var(--panel);border:1px solid rgba(91,108,255,.35);border-radius:20px;padding:24px 22px;text-align:center;box-shadow:0 16px 50px -25px rgba(91,108,255,.4)}
.mid-badge{width:54px;height:54px;border-radius:50%;background:rgba(91,108,255,.18);color:#a6b4ff;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px}
.mid-badge svg{width:28px;height:28px}
.midcard h2{margin:0 0 9px;font-size:22px;font-weight:800;color:var(--txt);letter-spacing:-.01em}
.midcard p{margin:0 auto;max-width:420px;color:var(--mut);font-size:14px;line-height:1.6}
.mid-foot{margin-top:16px;color:var(--faint);font-size:12px}
`;

const CV_JS = `
var CIC={check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',revise:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>'};
var URLX='/cliente/cronograma/'+encodeURIComponent(TOKEN)+'/action';
var scrim=document.getElementById('scrim'),sheet=document.getElementById('sheet'),toastEl=document.getElementById('toast'),pending=null,tt;
function toast(m,k){toastEl.className='toast on '+(k||'');toastEl.innerHTML=(k==='ok'?CIC.check:k==='err'?CIC.revise:CIC.note)+'<span></span>';toastEl.querySelector('span').textContent=m;clearTimeout(tt);tt=setTimeout(function(){toastEl.className='toast';},2800);}
function openSheet(h){sheet.innerHTML=h;scrim.classList.add('on');var f=sheet.querySelector('#sIn');if(f)setTimeout(function(){f.focus();},60);}
function closeSheet(){scrim.classList.remove('on');pending=null;}
function badgeInfo(cs){if(cs==='aprovado')return['b-ok','var(--ok)','Aprovado'];if(cs==='em_revisao')return['b-rev','var(--rev)','Ajuste pedido'];if(cs==='editado')return['b-edit','#b9a4ff','Editado'];return['b-pend','var(--faint)','Pendente'];}
function card(i){return document.querySelector('[data-card="'+i+'"]');}
function setBadge(i,cs){var c=card(i);if(!c)return;var b=c.querySelector('[data-badge]');var x=badgeInfo(cs);b.className='badge '+x[0];b.innerHTML='<span class="bd" style="background:'+x[1]+'"></span>'+x[2];}
function setItemNote(i,note){var c=card(i);if(!c)return;var slot=c.querySelector('[data-noteslot]');if(slot)slot.style.display='';var box=c.querySelector('[data-itemnote]');if(box)box.textContent=note;}
function setTheme(i,v){var c=card(i);if(!c)return;var el=c.querySelector('[data-field="tema"]');if(el)el.textContent=v;var h=c.querySelector('.ctitle h3');if(h)h.textContent=v;}
function setLegenda(i,v){var c=card(i);if(!c)return;var el=c.querySelector('[data-field="legenda"]');if(!el)return;var d=document.createElement('div');d.className='fval';d.setAttribute('data-field','legenda');d.textContent=v;el.parentNode.replaceChild(d,el);}
function bumpProgress(){var cards=document.querySelectorAll('#contents [data-card]');var done=0;cards.forEach(function(c){var b=c.querySelector('[data-badge]');if(b&&b.textContent.indexOf('Aprovado')>=0)done++;});var t=document.querySelector('[data-progtxt]');if(t)t.textContent=done+' de '+TOTAL+' aprovados';var f=document.querySelector('[data-progfill]');if(f)f.style.width=Math.max(TOTAL?Math.round(done/TOTAL*100):0,4)+'%';}
function addHist(kind,label){var sec=document.querySelector('[data-histsec]');if(sec)sec.classList.remove('hide');var h=document.getElementById('hist');var d=document.createElement('div');d.className='hitem';var ic=kind==='ok'?'hb-ok':kind==='rev'?'hb-rev':kind==='edit'?'hb-edit':'hb-note';var sv=kind==='ok'?CIC.check:kind==='rev'?CIC.revise:kind==='edit'?CIC.edit:CIC.note;d.innerHTML='<div class="hicon '+ic+'">'+sv+'</div><div class="hmain"><div class="ht"></div></div><div class="htime">agora</div>';d.querySelector('.ht').textContent=label;h.insertBefore(d,h.firstChild);}
function post(payload,btn,cb){if(btn)btn.disabled=true;fetch(URLX,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json().then(function(j){return{ok:r.ok&&j&&j.ok,j:j};});}).then(function(res){if(btn)btn.disabled=false;if(res.ok){if(cb)cb(res.j);}else{toast((res.j&&res.j.error)||'Falha ao enviar.','err');}}).catch(function(){if(btn)btn.disabled=false;toast('Sem conexão. Tente novamente.','err');});}
function clientSuccess(){var w=document.querySelector('.wrap');var ga=document.querySelector('.gactions');if(ga)ga.parentNode.removeChild(ga);if(!w)return;w.innerHTML='<div class="topbar"><div class="brand">'+(document.querySelector('.brand .logo')?document.querySelector('.brand .logo').outerHTML:'')+'<div class="bn">Agenda ID Seven<small>Visão do Cliente</small></div></div></div>'+'<div class="succwrap"><div class="succcard"><div class="succ-badge">'+CIC.check+'</div><h1>Cronograma aprovado com sucesso!</h1><p>Sua aprovação foi registrada. A equipe já foi notificada e seguirá com a finalização.</p><div class="succ-foot">Você já pode fechar esta página. 💜</div></div></div>';window.scrollTo(0,0);}
// V64.13 — Confirmação INTERMEDIÁRIA: temas aprovados (NÃO encerra; mantém o cronograma ativo).
// V64.17 — topbar premium reutilizável. Telas de ack/sucesso/feedback SUBSTITUEM a .wrap
// inteira (sem formulário/cards ativos empilhados abaixo). Corrige duplicação no portal.
function CV_TOP(){var lg=document.querySelector('.brand .logo');return '<div class="topbar"><div class="brand">'+(lg?lg.outerHTML:'')+'<div class="bn">Agenda ID Seven<small>Visão do Cliente</small></div></div><div class="secure">'+CIC.check+'<span class="lbl">Link seguro</span></div></div>';}
function clientThemesApproved(){var w=document.querySelector('.wrap');if(!w)return;w.innerHTML=CV_TOP()+'<div class="midwrap"><div class="midcard"><div class="mid-badge">'+CIC.check+'</div><h2>Temas aprovados!</h2><p>A equipe seguirá com a produção (designer, legendas e posts). Em breve você receberá a versão final neste mesmo link para a aprovação final.</p><div class="mid-foot">Você pode fechar esta página — vamos te avisar. 💜</div></div></div>';window.scrollTo(0,0);}
function clientProductionApproved(){var w=document.querySelector('.wrap');if(!w)return;w.innerHTML=CV_TOP()+'<div class="midwrap"><div class="midcard"><div class="mid-badge">'+CIC.check+'</div><h2>Legendas e artes aprovadas!</h2><p>A equipe enviará a versão final completa para sua aprovação. Em breve você receberá o aviso neste mesmo link.</p><div class="mid-foot">Você pode fechar esta página — vamos te avisar. 💜</div></div></div>';window.scrollTo(0,0);}
// V64.17 — feedback PARCIAL: SUBSTITUI a .wrap por resumo read-only + "Aguardando ajuste da equipe".
function clientFeedbackSent(){var w=document.querySelector('.wrap');if(!w)return;
  var rows='';document.querySelectorAll('#contents [data-card]').forEach(function(c){var i=+c.dataset.card;var b=c.querySelector('[data-badge]');var t=b?(b.textContent||''):'';
    var lbl=t.indexOf('Aprovado')>=0?'Aprovado':(t.indexOf('Ajuste')>=0?'Ajuste solicitado':(t.indexOf('Editado')>=0?'Editado':'Pendente'));
    rows+='<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--line);font-size:13.5px"><span style="color:var(--mut)">Conteúdo '+(i+1)+'</span><b>'+lbl+'</b></div>';});
  w.innerHTML=CV_TOP()+'<div class="midwrap"><div class="midcard"><div class="mid-badge">'+CIC.note+'</div><h2>Feedback enviado!</h2><p>Registramos suas aprovações e os ajustes solicitados. A equipe fará as correções e elas aparecerão <b>aqui mesmo, automaticamente</b> — você não precisa reabrir o link.</p>'+(rows?'<div style="margin:14px 0 4px;text-align:left">'+rows+'</div>':'')+'<div class="phase-banner phase-production" style="justify-content:center;margin-top:6px"><span class="phase-dot"></span><b>Aguardando ajuste da equipe</b></div><div id="teamupd" style="display:none;margin-top:14px"></div><div class="mid-foot">Atualização automática ativa — pode deixar esta página aberta. 💜</div></div></div>';
  // V64.18 — entra em modo "aguardando ajuste": o poller detecta quando a equipe corrige e
  // recarrega o MESMO link automaticamente para o cliente revisar de novo (sem reabrir o WhatsApp).
  FEEDBACK_MODE=true;FEEDBACK_BASE=null;window.scrollTo(0,0);}
function getText(i,field){var c=card(i);if(!c)return'';var el=c.querySelector('[data-field="'+field+'"]');if(!el||el.classList.contains('pend'))return'';return el.textContent||'';}
function sheetForm(title,desc,kind,val,multiline){var inp=multiline?'<textarea id="sIn" placeholder="Escreva aqui...">'+(val||'')+'</textarea>':'<input id="sIn" value="'+(val||'').replace(/"/g,'&quot;')+'"/>';return '<h3></h3><div class="sd"></div>'+inp+'<div class="srow"><button class="btn ghost" data-x="cancel">Cancelar</button><button class="btn '+(kind==='rev'?'warn':'primary')+'" data-x="send">'+(kind==='rev'?'Enviar':'Salvar')+'</button></div>';}
function openInput(title,desc,kind,val,multiline,cb){openSheet(sheetForm(title,desc,kind,val,multiline));sheet.querySelector('h3').textContent=title;sheet.querySelector('.sd').textContent=desc;pending=cb;}
document.addEventListener('click',function(e){
  var tg=e.target.closest&&e.target.closest('[data-toggle]');if(tg){tg.closest('.card').classList.toggle('is-open');return;}
  if(e.target===scrim){closeSheet();return;}
  var sx=e.target.closest&&e.target.closest('[data-x]');if(sx){if(sx.dataset.x==='cancel'){closeSheet();}else{var v=(sheet.querySelector('#sIn')||{}).value||'';var cb=pending;closeSheet();if(cb)cb(v);}return;}
  var a=e.target.closest&&e.target.closest('[data-act]');if(!a)return;
  var act=a.dataset.act,i=a.dataset.i!=null?+a.dataset.i:null;
  if(act==='approveItem'){post({action:'approveItem',contentIndex:i},a,function(){setBadge(i,'aprovado');bumpProgress();addHist('ok','Aprovou Conteúdo '+(i+1));toast('Conteúdo '+(i+1)+' aprovado','ok');});}
  else if(act==='reviseItem'){openInput('Pedir ajuste — Conteúdo '+(i+1),'Descreva o que ajustar neste conteúdo. A equipe é notificada.','rev','',true,function(v){if(!v.trim())return;post({action:'reviseItem',contentIndex:i,note:v},null,function(){setBadge(i,'em_revisao');setItemNote(i,v);addHist('rev','Pediu ajuste em Conteúdo '+(i+1));toast('Ajuste solicitado','ok');});});}
  else if(act==='editTheme'){openInput('Editar tema — Conteúdo '+(i+1),'Sugira um novo tema para este conteúdo.','ok',getText(i,'tema'),false,function(v){if(!v.trim())return;post({action:'editTheme',contentIndex:i,value:v},null,function(){setTheme(i,v);setBadge(i,'editado');addHist('edit','Editou o tema de Conteúdo '+(i+1));toast('Tema atualizado','ok');});});}
  else if(act==='editLegenda'){openInput('Editar legenda — Conteúdo '+(i+1),'Ajuste a legenda deste conteúdo do jeito que preferir.','ok',getText(i,'legenda'),true,function(v){post({action:'editLegenda',contentIndex:i,value:v},null,function(){setLegenda(i,v);setBadge(i,'editado');addHist('edit','Editou a legenda de Conteúdo '+(i+1));toast('Legenda atualizada','ok');});});}
  else if(act==='noteItem'){openInput('Observação — Conteúdo '+(i+1),'Deixe uma observação específica para este conteúdo.','ok','',true,function(v){if(!v.trim())return;post({action:'noteItem',contentIndex:i,note:v},null,function(){setItemNote(i,v);addHist('note','Comentou em Conteúdo '+(i+1));toast('Observação registrada','ok');});});}
  else if(act==='revision'){openInput('Pedir revisão geral','Conte o que precisa mudar no cronograma como um todo.','rev','',true,function(v){if(!v.trim())return;post({action:'revision',note:v},null,function(){addHist('rev','Pediu revisão geral');toast('Revisão enviada','ok');});});}
  else if(act==='ackFeedback'){clientFeedbackSent();return;}
  else if(act==='approveAll'){var ph=a.getAttribute('data-phase')||'themes';
    // V64.16 — GATE client-side: se algum conteúdo está com ajuste/edição pedido, NÃO aprova tudo.
    var anyRev=false;document.querySelectorAll('#contents [data-card] [data-badge]').forEach(function(b){var t=(b.textContent||'');if(t.indexOf('Ajuste')>=0||t.indexOf('Editado')>=0)anyRev=true;});
    if(anyRev){toast('Há ajuste pendente — enviando como feedback.','ok');post({action:'approveAll'},a,function(){addHist('rev','Enviou feedback (ajustes pendentes)');clientFeedbackSent();});return;}
    var msg=ph==='final'?'Confirmar APROVAÇÃO FINAL do cronograma? Esta é a etapa que encerra o processo.'
      :ph==='production'?'Confirmar aprovação das legendas e artes? A equipe ainda enviará a versão final para você.'
      :'Confirmar aprovação dos TEMAS? A equipe seguirá com a produção e enviará a versão final depois.';
    if(!confirm(msg))return;
    post({action:'approveAll'},a,function(j){
      // V64.16 — se o backend converteu em revisão (ajuste pendente), mostra FEEDBACK, não sucesso.
      if(j&&(j.clientFlowStatus==='revisao'||j.col==='revisao')){addHist('rev','Enviou feedback (ajustes pendentes)');clientFeedbackSent();return;}
      // Sucesso premium SOMENTE quando o backend confirmar que a fase é FINAL.
      if(j&&j.final===true&&(j.phase==='final'||j.phase==null)){clientSuccess();return;}
      var cs=document.querySelectorAll('#contents [data-card]');cs.forEach(function(c){setBadge(+c.dataset.card,'aprovado');});bumpProgress();
      // Intermediário: temas aprovados (fase themes) ou produção aprovada (production).
      if(j&&j.phase==='themes'){addHist('ok','Aprovou os temas');clientThemesApproved();return;}
      if(j&&j.phase==='production'){addHist('ok','Aprovou legendas e artes');clientProductionApproved();return;}
      addHist('ok','Aprovou o cronograma');toast('Aprovação registrada','ok');
    });}
  else if(act==='sendGenObs'){var ta=document.getElementById('genObs');var v=ta?ta.value.trim():'';if(!v){toast('Escreva uma observação primeiro.','err');return;}post({action:'comment',note:v},a,function(){if(ta)ta.value='';addHist('note','Comentou no cronograma');toast('Observação enviada','ok');});}
});
/* V64.16/18 — TEMPO REAL: polling leve do MESMO link (sem reabrir, sem gerar link novo). */
var LAST_SIG=null, FEEDBACK_MODE=false, FEEDBACK_BASE=null, LIVE_EL=null;
// Indicador discreto e PERSISTENTE de atualização automática (canto inferior).
function liveTick(ok){
  if(!LIVE_EL){LIVE_EL=document.createElement('div');LIVE_EL.id='livebar';
    LIVE_EL.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:50;display:flex;align-items:center;gap:8px;padding:7px 13px;border-radius:999px;background:rgba(20,22,30,.92);border:1px solid var(--line);color:var(--mut);font-size:12px;backdrop-filter:blur(6px);box-shadow:0 10px 30px -12px rgba(0,0,0,.6)';
    document.body.appendChild(LIVE_EL);}
  LIVE_EL.innerHTML='<span style="width:8px;height:8px;border-radius:50%;background:'+(ok?'#34D399':'#9aa0aa')+';box-shadow:0 0 0 3px '+(ok?'rgba(52,211,153,.18)':'rgba(154,160,170,.14)')+'"></span><span>Atualização automática ativa · verificado agora</span>';
}
// Mostra, na tela "Feedback enviado!", o aviso CLARO de que a equipe atualizou + recarrega o mesmo link.
function teamUpdated(){
  var box=document.getElementById('teamupd');
  if(box){box.style.display='block';
    box.innerHTML='<div style="border:1px solid rgba(52,211,153,.45);background:rgba(52,211,153,.12);border-radius:14px;padding:14px;text-align:center"><div style="font-weight:800;color:#34D399;margin-bottom:4px">A equipe atualizou seu cronograma ✦</div><div style="color:var(--mut);font-size:13px;margin-bottom:10px">As correções estão prontas. Vamos abrir a versão atualizada para você revisar novamente.</div><button class="btn primary" onclick="location.reload()" style="width:auto;padding:10px 18px">Revisar agora</button></div>';}
  toast('A equipe atualizou — abrindo a versão revisada…','ok');
  setTimeout(function(){location.reload();},2200);   // mesmo link, sem reabrir o WhatsApp
}
function applyState(j,changed){
  (j.items||[]).forEach(function(it){setTheme(it.i,it.tema);if(it.legenda)setLegenda(it.i,it.legenda);setBadge(it.i,it.cs==='aprovado'?'aprovado':it.cs==='em_revisao'?'em_revisao':it.cs==='editado'?'editado':'');});
  bumpProgress();
  // Destaca os conteúdos que a equipe mexeu (anel + scroll até o primeiro).
  (changed||[]).forEach(function(i){var c=card(i);if(!c)return;c.style.transition='box-shadow .3s';c.style.boxShadow='0 0 0 2px #34D399, 0 0 0 6px rgba(52,211,153,.18)';setTimeout(function(){c.style.boxShadow='';},4000);});
  if(changed&&changed.length){var f=card(changed[0]);if(f&&f.scrollIntoView)try{f.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}}
}
function pollState(){fetch('/cliente/cronograma/'+encodeURIComponent(TOKEN)+'/state',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
  if(!j||!j.ok){liveTick(false);return;}
  liveTick(true);
  var sig=JSON.stringify((j.items||[]).map(function(x){return [x.cs,x.tema,x.legenda,x.feed,x.story];}));
  // Em modo "Feedback enviado!": detecta a correção da equipe e recarrega o MESMO link.
  if(FEEDBACK_MODE){
    if(FEEDBACK_BASE===null){FEEDBACK_BASE=sig;return;}
    if(sig!==FEEDBACK_BASE||!j.pendingRevision){teamUpdated();FEEDBACK_MODE=false;}
    return;
  }
  if(j.finalDone){clientSuccess();return;}
  if(LAST_SIG===null){LAST_SIG=sig;return;}                 // baseline (página já renderizada)
  if(sig===LAST_SIG)return;
  var prev=JSON.parse(LAST_SIG),mediaChanged=false,changed=[];
  (j.items||[]).forEach(function(x,idx){var p=prev[idx]||[];
    if((x.feed||'')!==(p[3]||'')||(x.story||'')!==(p[4]||''))mediaChanged=true;
    if((x.tema||'')!==(p[1]||'')||(x.legenda||'')!==(p[2]||''))changed.push(idx);});
  LAST_SIG=sig;
  if(mediaChanged){location.reload();return;}               // Feed/Story novo: re-render completo 1x
  applyState(j,changed);
  toast(changed.length?('Tema atualizado pela equipe — revise o Conteúdo '+(changed[0]+1)):'Atualizado pela equipe.','ok');
}).catch(function(){liveTick(false);});}
setInterval(pollState,6000);
`;

function renderClientHtml(task, token, env) {
  const cliente = escapeHtml(task.client || "Cliente");
  const titulo = escapeHtml(task.title || "Cronograma");
  const freq = escapeHtml(frequencyLabel(task));
  const status = escapeHtml(statusLabel(task));
  const items = Array.isArray(task.cronWeeks) ? task.cronWeeks
    : (Array.isArray(task.cronContents) ? task.cronContents : []);
  const total = items.length;
  const cItems = (task.clientItems && typeof task.clientItems === "object") ? task.clientItems : {};
  // V64.13 — Fase REAL da aprovação do cliente. Botão e título ficam coerentes com a fase
  // ('themes' = só temas; 'production' = legendas/posts; 'final' = aprovação final).
  // Tela de sucesso só aparece quando a fase é 'final' (gating do clientSuccess).
  const phase = clientPhase(task);
  const phaseUi = phaseCopy(phase);
  // V64.15 — aprovação PARCIAL: algum conteúdo com ajuste/edição pedido? Então NÃO mostrar
  // o CTA global "Aprovar todos" como se tudo estivesse ok.
  const pendingRevision = Object.keys(cItems).some(function (k) {
    const cs = cItems[k] && cItems[k].cs; return cs === "em_revisao" || cs === "editado";
  }) || (task.clientReview && task.clientReview.status === "revisao");

  function firstUrl(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) { for (const z of v) { if (z && typeof z === "string") return z; if (z && z.url) return z.url; } return ""; }
    if (v.url) return v.url;
    return "";
  }
  function badge(cs) {
    if (cs === "aprovado") return { cls: "b-ok", dot: "var(--ok)", label: "Aprovado" };
    if (cs === "em_revisao") return { cls: "b-rev", dot: "var(--rev)", label: "Ajuste pedido" };
    if (cs === "editado") return { cls: "b-edit", dot: "#b9a4ff", label: "Editado" };
    if (cs === "em_analise") return { cls: "b-info", dot: "var(--info)", label: "Em análise" };
    if (cs === "enviado") return { cls: "b-pend", dot: "var(--faint)", label: "Enviado" };
    return { cls: "b-pend", dot: "var(--faint)", label: "Pendente" };
  }
  function media(kind, url) {
    const label = kind === "feed" ? "Feed" : "Story";
    const cls = kind === "story" ? "media story" : "media";
    if (url) {
      return '<a class="' + cls + '" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">' +
        '<div class="mh"><span>' + label + '</span><span class="on">anexado</span></div>' +
        '<div class="thumb"><img src="' + escapeHtml(url) + '" alt="' + label + '"/><span class="zoom">' + ICN.zoom + ' ampliar</span></div></a>';
    }
    return '<div class="' + cls + '"><div class="mh"><span>' + label + '</span><span>pendente</span></div>' +
      '<div class="ph">' + ICN.img + '<span class="pl">' + label + ' pendente</span></div></div>';
  }

  let doneCount = 0;
  let contentsHtml = "";
  if (!total) {
    contentsHtml = '<div class="empty">Os conteúdos ainda não foram publicados. Você será avisado assim que estiverem prontos para sua avaliação.</div>';
  } else {
    contentsHtml = items.map(function (raw, i) {
      const c = (raw && typeof raw === "object") ? raw : {};
      const ov = cItems["i" + i] || {};
      const cs = ov.cs || c.cs || "";
      if (cs === "aprovado") doneCount++;
      const tema = escapeHtml((typeof ov.theme === "string" && ov.theme) ? ov.theme : (c.t || c.tema || ("Conteúdo " + (i + 1))));
      const legRaw = (typeof ov.legenda === "string") ? ov.legenda : (typeof c.legenda === "string" ? c.legenda : (typeof c.caption === "string" ? c.caption : (typeof c.lg === "string" ? c.lg : (typeof c.l === "string" ? c.l : ""))));
      const leg = (legRaw || "").trim();
      const itemNote = (ov.note || c.csFeedback || "").toString().trim();
      const feedUrl = firstUrl(c.feed) || (c.feedImageUrl || "");
      const storyUrl = firstUrl(c.story || c.stories) || (c.storyImageUrl || "");
      const b = badge(cs);
      const open = "";   // V64.15 — conteúdos iniciam COLAPSADOS; cliente abre cada um ao tocar
      return '<div class="card' + open + '" data-card="' + i + '">' +
        '<div class="chead" data-toggle="' + i + '">' +
          '<div class="cidx">' + (i + 1) + '</div>' +
          '<div class="ctitle"><div class="ck">Conteúdo ' + (i + 1) + '</div><h3>' + tema + '</h3></div>' +
          '<div class="cstate"><span class="badge ' + b.cls + '" data-badge><span class="bd" style="background:' + b.dot + '"></span>' + b.label + '</span></div>' +
          '<div class="chev">' + ICN.chev + '</div>' +
        '</div>' +
        '<div class="cbody">' +
          '<div class="field"><div class="flabel"><span class="fl">' + ICN.type + 'Tema</span></div><div class="fval theme" data-field="tema">' + tema + '</div></div>' +
          '<div class="field"><div class="flabel"><span class="fl">' + ICN.text + 'Legenda</span>' + (leg ? '<span class="cnt">' + leg.length + ' caracteres</span>' : '') + '</div>' +
            (leg ? '<div class="fval" data-field="legenda">' + escapeHtml(leg) + '</div>'
                 : '<div class="pend" data-field="legenda"><div class="pi">' + ICN.text + '</div><div><div class="pt">Legenda pendente</div><div class="ps">Nossa equipe ainda está finalizando a legenda deste conteúdo.</div></div></div>') +
          '</div>' +
          '<div class="field"><div class="flabel"><span class="fl">' + ICN.img + 'Peças</span></div><div class="media-row">' + media("feed", feedUrl) + media("story", storyUrl) + '</div></div>' +
          (itemNote ? '<div class="field"><div class="flabel"><span class="fl">' + ICN.note + 'Sua observação</span></div><div class="fval note" data-itemnote>' + escapeHtml(itemNote) + '</div></div>'
                    : '<div class="field" data-noteslot style="display:none"><div class="flabel"><span class="fl">' + ICN.note + 'Sua observação</span></div><div class="fval note" data-itemnote></div></div>') +
          '<div class="iacts">' +
            '<button class="ibtn ok" data-act="approveItem" data-i="' + i + '">' + ICN.check + 'Aprovar conteúdo</button>' +
            '<button class="ibtn rev" data-act="reviseItem" data-i="' + i + '">' + ICN.revise + 'Pedir ajuste</button>' +
            '<button class="ibtn" data-act="editTheme" data-i="' + i + '">' + ICN.type + 'Editar tema</button>' +
            '<button class="ibtn" data-act="editLegenda" data-i="' + i + '">' + ICN.pen + 'Editar legenda</button>' +
            '<button class="ibtn" data-act="noteItem" data-i="' + i + '">' + ICN.note + 'Observação</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  // histórico granular (clientActions map -> lista)
  const actsMap = (task.clientActions && typeof task.clientActions === "object") ? task.clientActions : {};
  const acts = Object.keys(actsMap).map(function (k) { return actsMap[k] || {}; })
    .filter(function (a) { return a && a.at; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, 14);
  function hhmm(ms) { try { const d = new Date(Number(ms)); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); } catch (_) { return ""; } }
  let histHtml = "";
  if (acts.length) {
    histHtml = acts.map(function (a) {
      const map = {
        approve: ["hb-ok", ICN.check, "Aprovou o cronograma"], approveAll: ["hb-ok", ICN.check, "Aprovou o cronograma"],
        approveItem: ["hb-ok", ICN.check, "Aprovou"], reviseItem: ["hb-rev", ICN.revise, "Pediu ajuste em"],
        revision: ["hb-rev", ICN.revise, "Pediu revisão geral"], edit_request: ["hb-edit", ICN.edit, "Pediu edição"],
        editTheme: ["hb-edit", ICN.edit, "Editou o tema de"], editLegenda: ["hb-edit", ICN.edit, "Editou a legenda de"], noteItem: ["hb-note", ICN.note, "Comentou em"],
        comment: ["hb-note", ICN.note, "Comentou no cronograma"],
      };
      const m = map[a.type] || ["hb-note", ICN.note, "Ação em"];
      const tgt = (a.contentIndex != null && a.contentIndex !== "") ? (" Conteúdo " + (Number(a.contentIndex) + 1)) : "";
      let extra = "";
      if (a.newValue) extra = '<div class="hdiff"><span class="new">' + escapeHtml(String(a.newValue).slice(0, 160)) + '</span></div>';
      else if (a.note) extra = '<div class="hdiff">' + escapeHtml(String(a.note).slice(0, 200)) + '</div>';
      return '<div class="hitem"><div class="hicon ' + m[0] + '">' + m[1] + '</div><div class="hmain"><div class="ht">' + m[2] + escapeHtml(tgt) + '</div>' + extra + '</div><div class="htime">' + hhmm(a.at) + '</div></div>';
    }).join("");
  }

  const pct = total ? Math.round(doneCount / total * 100) : 0;
  const publicUrl = "https://idseven-push.agidseven.workers.dev/cliente/cronograma/" + escapeHtml(token);
  // V64.20 — PREVIEW PREMIUM do link (card grande e clicável no WhatsApp = o "botão" possível no
  // compartilhamento por link). Título de ação + descrição + IMAGEM: usa a 1ª arte do cronograma
  // (ImageKit 1200×630) quando já existir; senão, a marca. (Botão NATIVO no balão exige WhatsApp
  // Business API/templates — não existe no compartilhamento comum.)
  const ogTitleRaw = "Aprovar cronograma — " + (task.client || "Cliente");
  const ogDescRaw = "Sua área de aprovação está pronta. Toque para revisar os temas, aprovar o que estiver correto e solicitar ajustes. Link seguro · Agenda ID Seven.";
  const ogTitle = escapeHtml(ogTitleRaw);
  const ogDesc = escapeHtml(ogDescRaw);
  const ogArt = (function () {
    for (let k = 0; k < items.length; k++) {
      const c = (items[k] && typeof items[k] === "object") ? items[k] : {};
      let u = c.feedImageUrl || c.storyImageUrl || "";
      if (!u) { const f = c.feed, s = c.story; u = (typeof f === "string" ? f : (f && f.url) || "") || (typeof s === "string" ? s : (s && s.url) || ""); }
      if (u) return u;
    }
    return "";
  })();
  const ogImg = ogArt
    ? (ogArt.indexOf("ik.imagekit.io") >= 0 ? (ogArt + (ogArt.indexOf("?") >= 0 ? "&" : "?") + "tr=w-1200,h-630,fo-auto,q-82") : ogArt)
    : "https://agendaidseven.com.br/icon-512.png";

  return '<!doctype html>\n<html lang="pt-BR"><head>\n' +
'<meta charset="utf-8"/>\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>\n' +
'<title>' + ogTitle + ' · Aprovação de cronograma</title>\n' +
'<meta name="description" content="' + ogDesc + '"/>\n' +
'<meta name="theme-color" content="#5B6CFF"/>\n' +
'<meta property="og:type" content="website"/>\n' +
'<meta property="og:title" content="' + ogTitle + '"/>\n' +
'<meta property="og:description" content="' + ogDesc + '"/>\n' +
'<meta property="og:url" content="' + publicUrl + '"/>\n' +
'<meta property="og:site_name" content="Agenda ID Seven"/>\n' +
'<meta property="og:image" content="' + escapeHtml(ogImg) + '"/>\n' +
'<meta property="og:image:width" content="1200"/>\n<meta property="og:image:height" content="630"/>\n' +
'<meta property="og:image:alt" content="Aprovar cronograma — Agenda ID Seven"/>\n' +
'<meta name="twitter:card" content="summary_large_image"/>\n' +
'<meta name="twitter:title" content="' + ogTitle + '"/>\n' +
'<meta name="twitter:description" content="' + ogDesc + '"/>\n' +
'<meta name="twitter:image" content="' + escapeHtml(ogImg) + '"/>\n' +
'<meta name="robots" content="noindex,nofollow"/>\n' +
'<style>' + CV_CSS + '</style></head><body>\n' +
'<div class="wrap">' +
  '<div class="topbar"><div class="brand">' + CV_LOGO + '<div class="bn">Agenda ID Seven<small>Visão do Cliente</small></div></div>' +
    '<div class="secure">' + ICN.shield + '<span class="lbl">Link seguro</span></div></div>' +
  '<section class="hero"><div class="hero-top"><span class="kicker">' + escapeHtml(phaseUi.kicker) + '</span></div>' +
    '<h1>' + titulo + '</h1><div class="cli">Preparado para <b>' + cliente + '</b></div>' +
    '<div class="phase-banner phase-' + phase + '"><span class="phase-dot"></span><b>' + escapeHtml(phaseUi.title) + '</b><span class="phase-sub">' + escapeHtml(phaseUi.sub) + '</span></div>' +
    '<div class="hero-meta">' +
      '<span class="mpill">' + ICN.cal + '<span class="mv">Frequência</span> ' + freq + '</span>' +
      '<span class="mpill">' + ICN.layers + '<span class="mv">Conteúdos</span> ' + total + '</span>' +
      '<span class="mpill status"><span class="dot"></span>' + status + '</span>' +
    '</div>' +
    '<div class="prog"><div class="prog-h"><span>Progresso de aprovação</span><span data-progtxt>' + doneCount + ' de ' + total + ' aprovados</span></div>' +
      '<div class="prog-bar"><div class="prog-fill" data-progfill style="width:' + Math.max(pct, 4) + '%"></div></div></div>' +
  '</section>' +
  '<div class="sec"><h2>Conteúdos</h2><div class="legend"><span><i style="background:var(--ok)"></i>Aprovado</span><span><i style="background:var(--rev)"></i>Ajuste</span><span><i style="background:var(--faint)"></i>Pendente</span></div></div>' +
  '<div id="contents">' + contentsHtml + '</div>' +
  '<div class="sec"><h2>Observações gerais</h2></div>' +
  '<div class="card pad"><textarea id="genObs" placeholder="Quer deixar um recado para a equipe sobre o cronograma como um todo? (opcional)"></textarea>' +
    '<div style="text-align:right;margin-top:10px"><button class="ibtn" data-act="sendGenObs">' + ICN.note + 'Enviar observação geral</button></div></div>' +
  '<div class="sec' + (acts.length ? '' : ' hide') + '" data-histsec><h2>Histórico de feedback</h2></div>' +
  '<div class="hist" id="hist">' + histHtml + '</div>' +
  '<div class="foot">Link público seguro · Agenda ID Seven · ' + new Date().getFullYear() + '</div>' +
'</div>' +
'<div class="gactions"><div class="inner">' + (pendingRevision
  ? '<div class="gstat">Há <b>ajustes solicitados</b> em um ou mais conteúdos. A equipe foi notificada e fará as correções — você não precisa aprovar tudo agora.</div>' +
    '<button class="btn ghost" data-act="revision">' + ICN.revise + 'Pedir mais ajustes</button>' +
    '<button class="btn primary" data-act="ackFeedback">' + ICN.check + 'Enviar feedback para a equipe</button>'
  : '<div class="gstat">Você pode aprovar tudo, ajustar itens específicos ou pedir uma revisão geral — <b>sem obrigação de editar todos.</b></div>' +
    '<button class="btn ghost" data-act="revision">' + ICN.revise + 'Pedir revisão</button>' +
    '<button class="btn primary" data-act="approveAll" data-phase="' + phase + '">' + ICN.check + escapeHtml(phaseUi.cta) + '</button>'
) + '</div></div>' +
'<div class="scrim" id="scrim"><div class="sheet" id="sheet"></div></div>' +
'<div class="toast" id="toast"></div>' +
'<script>\nvar TOKEN=' + JSON.stringify(token) + ';var TOTAL=' + total + ';\n' + CV_JS + '\n</script>\n' +
'</body></html>';
}

function renderClientErrorHtml(title, msg) {
  const t = escapeHtml(title), m = escapeHtml(msg);
  return '<!doctype html>\n<html lang="pt-BR"><head>\n' +
'<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1"/>\n' +
'<title>' + t + ' · Agenda ID Seven</title>\n<meta name="theme-color" content="#070810"/>\n<meta name="robots" content="noindex,nofollow"/>\n' +
'<meta property="og:type" content="website"/>\n<meta property="og:title" content="' + t + ' · Agenda ID Seven"/>\n<meta property="og:description" content="' + m + '"/>\n' +
'<style>' + CV_CSS + '</style></head><body>\n' +
'<div class="wrap"><div class="topbar"><div class="brand">' + CV_LOGO + '<div class="bn">Agenda ID Seven<small>Visão do Cliente</small></div></div>' +
  '<div class="secure">' + ICN.shield + '<span class="lbl">Link seguro</span></div></div>' +
  '<div class="errwrap"><div class="errcard"><div class="erricon">' + ICN.lock + '</div>' +
    '<h1>' + t + '</h1><p>' + m + '</p><div class="eb">Agenda ID Seven</div></div></div>' +
'</div></body></html>';
}

/* P2: tela final PREMIUM de sucesso — exibida quando o cronograma já foi aprovado em definitivo
   (status/workflowStage = concluido). Sem botões de ação: o fluxo está encerrado. */
function renderClientSuccessHtml(task, token) {
  const cliente = escapeHtml(task.client || "Cliente");
  const titulo = escapeHtml(task.title || "Cronograma");
  const items = Array.isArray(task.cronWeeks) ? task.cronWeeks : (Array.isArray(task.cronContents) ? task.cronContents : []);
  const total = items.length;
  return '<!doctype html>\n<html lang="pt-BR"><head>\n' +
'<meta charset="utf-8"/>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>\n' +
'<title>Cronograma aprovado · ' + cliente + '</title>\n<meta name="theme-color" content="#070810"/>\n<meta name="robots" content="noindex,nofollow"/>\n' +
'<meta property="og:type" content="website"/>\n<meta property="og:title" content="Cronograma aprovado com sucesso"/>\n<meta property="og:description" content="A aprovação do cliente foi registrada."/>\n' +
'<style>' + CV_CSS + '</style></head><body>\n' +
'<div class="wrap"><div class="topbar"><div class="brand">' + CV_LOGO + '<div class="bn">Agenda ID Seven<small>Visão do Cliente</small></div></div>' +
  '<div class="secure">' + ICN.shield + '<span class="lbl">Link seguro</span></div></div>' +
  '<div class="succwrap"><div class="succcard">' +
    '<div class="succ-badge">' + ICN.check + '</div>' +
    '<h1>Cronograma aprovado com sucesso!</h1>' +
    '<p>Sua aprovação foi registrada. A equipe já foi notificada e seguirá com a finalização.</p>' +
    '<div class="succ-meta">' +
      '<span class="pill">' + cliente + '</span>' +
      '<span class="pill">' + titulo + '</span>' +
      '<span class="pill ok"><span class="bd" style="background:var(--ok)"></span>' + (total ? (total + ' ' + (total === 1 ? "conteúdo aprovado" : "conteúdos aprovados")) : "Aprovado") + '</span>' +
    '</div>' +
    '<div class="succ-foot">Você já pode fechar esta página. 💜</div>' +
  '</div></div>' +
  '<div class="foot">Link público seguro · Agenda ID Seven · ' + new Date().getFullYear() + '</div>' +
'</div></body></html>';
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
