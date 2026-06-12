/* ============================================================================
   ID Seven — Cloudflare Worker  [V64.4 / V64.3-worker-compat]
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
     POST /              → push imediato (relay): {tokens,title,body,data} → FCM HTTP v1
     POST /imagekit-auth → assinatura de upload do ImageKit
     POST /cron-test     → executa a lógica do lembrete sob demanda (DRY-RUN por padrão;
                           só envia de verdade com body {"send":true})
     GET  /              → status do serviço

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

    // ADITIVO (FASE 4.3 — autorização limitada): inspeção do Designer SLA Engine.
    // 403 se env SLA_ENGINE_ENABLED ausente (= estado de produção). Nunca envia push.
    if (url.pathname === "/sla-dryrun" && request.method === "POST") {
      return handleSlaDryRun(request, env);
    }

    // FASE 4.4-A2: plano de reprogramação SOMENTE dry-run (read-only, nunca aplica).
    if (url.pathname === "/sla-reschedule-plan" && request.method === "POST") {
      return handleSlaReschedulePlan(request, env);
    }

    if (request.method === "POST") {
      return handlePushRelay(request, env);
    }

    return json({ ok: true, service: "idseven-push", version: "V64.6-sla-core-dryrun" }, 200, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      handleCronTrigger(env, { dryRun: false }).catch((e) => {
        console.error("[CRON] erro fatal:", e && e.message);
      })
    );
    // FASE 4.3 (autorização limitada): passada do SLA Engine SEPARADA do cron
    // existente (não toca handleCronTrigger). Sem env SLA_ENGINE_ENABLED="true"
    // (estado atual do painel) este bloco é um no-op absoluto. Mesmo ligado:
    // dry-run, sem push, sem lock; escrita só com SLA_WRITE + flag slaEngine.
    if (env && env.SLA_ENGINE_ENABLED === "true") {
      ctx.waitUntil(
        runSlaEnginePass(env, { write: env.SLA_WRITE === "true" }).then((r) => {
          console.log("[SLA] pass:", JSON.stringify({ scanned: r.scanned, events: r.events.length, wouldNotify: r.wouldNotify.length, wouldLock: r.wouldLock.length, writes: r.writes, dedupSkipped: r.dedupSkipped }));
        }).catch((e) => console.error("[SLA] erro:", e && e.message))
      );
    }
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

/* ════════════════════════════════════════════════════════════════════════════
   DESIGNER SLA ENGINE — NÚCLEO SEGURO (FASE 4.1–4.3, AUTORIZAÇÃO LIMITADA)
   ════════════════════════════════════════════════════════════════════════════
   MODO SEGURO OBRIGATÓRIO:
   - O engine SÓ executa se env.SLA_ENGINE_ENABLED === "true" (var NÃO existe no
     painel → em produção o cron atual segue 100% intocado).
   - Mesmo executando, roda em DRY-RUN: NENHUMA escrita acontece a menos que
     env.SLA_WRITE === "true" E appConfig/flags.slaEngine === true (flag OFF).
   - PUSH REAL: NUNCA nesta fase — o "envio" é um stub que apenas registra
     wouldNotify (simulated). slaNotifications permanece OFF.
   - BLOQUEIO REAL: NUNCA nesta fase — calcula blockedCandidate, registra evento,
     NÃO escreve designerLocks. operationalBlocking permanece OFF.
   - Rota de inspeção: POST /sla-dryrun (sempre dry-run; nunca envia push).
   Rollback: remover a var SLA_ENGINE_ENABLED (ou nunca criá-la). Zero migração.
   ──────────────────────────────────────────────────────────────────────────── */

const SLA_DEFAULTS = {
  startWarningMinutes: 30,        // alerta laranja de INÍCIO: 30min antes (autorizado)
  finishWarningMinutes: 30,       // alerta laranja de ENTREGA: 30min antes (autorizado)
  criticalStartOverdueMinutes: 30,// início atrasado vira CRÍTICO (candidato a bloqueio) após 30min
  /* WIP (FASE 4.4-A2): separação observado/soft/hard/bloqueante-por-atraso.
     wipMode "observe" = NUNCA assume bloqueio hard sem calibração real (risco 1 da 4.4-A).
     Valores soft/hard são CALIBRÁVEIS (env/wipLimits) — hard 2 segue como ponto de partida. */
  wipMode: "observe",             // observe | enforce (enforce só em fase futura autorizada)
  wipSoftPerDesigner: 2,          // limiar de ALERTA (soft)
  wipHardPerDesigner: 2,          // limiar de BLOQUEIO (hard) — inerte em modo observe
  /* Backfill controlado (FASE 4.4-A2 — risco 2 da 4.4-A): */
  maxTasksPerPass: 200,           // teto de tarefas analisadas por passada
  maxEventsPerPass: 300,          // teto de eventos (simulados/elegíveis) por passada
};
const SLA_FLAG_DEFAULTS = {       // contrato de feature flags — TODAS OFF por padrão
  slaEngine: false, slaNotifications: false, operationalBlocking: false,
  wipLimits: false, slaPanel: false, slaCardBadges: false,
};
const SLA_EVENT_TYPES = [
  "designer_task_assigned", "designer_task_started", "designer_task_completed",
  "designer_start_warning", "designer_start_overdue",
  "designer_finish_warning", "designer_finish_overdue",
  "designer_blocked_by_overdue", "designer_unblocked",
  "designer_admin_override", "designer_wip_limit_reached",
];

/* "YYYY-MM-DD"+"HH:MM" (TZ local do app) → epoch ms UTC. Sem data → 0. */
function slaToMs(dateStr, timeStr, tzOffsetMinutes) {
  if (!dateStr) return 0;
  const dm = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return 0;
  let hh = 23, mm = 59;
  if (timeStr) { const tm = String(timeStr).match(/^(\d{1,2}):(\d{2})$/); if (tm) { hh = +tm[1]; mm = +tm[2]; } }
  return Date.UTC(+dm[1], +dm[2] - 1, +dm[3], hh, mm) - (tzOffsetMinutes == null ? -180 : tzOffsetMinutes) * 60000;
}

/* Plano de SLA a partir do designerAssignment EXISTENTE (modelo aditivo: nada renomeado).
   Fallback de término: dueDate/dueTime (já gravados pelo sendToDesigner desde 1.0.88). */
function slaPlanFromAssignment(t, tz) {
  const da = (t && t.designerAssignment) || {};
  const sla = (t && t.designerSla) || {};
  const plannedStartAt  = sla.plannedStartAt  || slaToMs(da.startDate || t.startDate, da.startTime || t.startTime, tz);
  const plannedFinishAt = sla.plannedFinishAt || slaToMs(da.endDate || t.endDate || t.dueDate, da.endTime || t.endTime || t.dueTime, tz);
  return { plannedStartAt, plannedFinishAt };
}

function slaStarted(t) {
  const df = (t && t.designerFlowStatus) || "";
  if (df === "andamento" || df === "revisao" || df === "concluido") return true;
  const assignedAt = (t && t.designerAssignment && t.designerAssignment.assignedAt) || 0;
  return !!(t && t.startedAt && (!assignedAt || t.startedAt >= assignedAt));
}
function slaDelivered(t) { return !!(t && (t.designerFlowStatus === "concluido")); }
function slaCancelled(t) { return !!(t && (t.cancelled === true || t.status === "cancelada")); }

/* ───── STATE MACHINE PURA (idempotente, relógio do SERVIDOR) ─────
   Estados: aguardando_inicio | inicio_proximo | inicio_atrasado | em_producao |
            entrega_proxima | entrega_atrasada | entregue | cancelada
   (bloqueada_por_atraso é DERIVADA: blockedCandidate=true; reprogramada é
    metadado: rescheduleCount>0 — o estado recalcula sobre o novo prazo.) */
function computeSlaStatus(task, nowMs, cfg, tz) {
  const C = Object.assign({}, SLA_DEFAULTS, cfg || {});
  const { plannedStartAt, plannedFinishAt } = slaPlanFromAssignment(task, tz);
  const startWarnMs  = C.startWarningMinutes * 60000;
  const finishWarnMs = C.finishWarningMinutes * 60000;
  const out = {
    plannedStartAt, plannedFinishAt,
    startWarningAt:  plannedStartAt  ? plannedStartAt  - startWarnMs  : 0,
    finishWarningAt: plannedFinishAt ? plannedFinishAt - finishWarnMs : 0,
    slaStatus: "aguardando_inicio", slaSeverity: "ok", blockedCandidate: false,
    overdueMs: 0,
  };
  if (slaCancelled(task)) { out.slaStatus = "cancelada"; return out; }
  if (slaDelivered(task)) { out.slaStatus = "entregue"; return out; }
  if (!slaStarted(task)) {
    if (plannedStartAt && nowMs > plannedStartAt) {
      out.slaStatus = "inicio_atrasado"; out.slaSeverity = "vermelho";
      out.overdueMs = nowMs - plannedStartAt;
      out.blockedCandidate = out.overdueMs >= C.criticalStartOverdueMinutes * 60000;
    } else if (plannedStartAt && nowMs >= out.startWarningAt) {
      out.slaStatus = "inicio_proximo"; out.slaSeverity = "laranja";
    }
    return out;
  }
  if (plannedFinishAt && nowMs > plannedFinishAt) {
    out.slaStatus = "entrega_atrasada"; out.slaSeverity = "vermelho";
    out.overdueMs = nowMs - plannedFinishAt;
    out.blockedCandidate = true;   // entrega atrasada = candidato a bloqueio (regra central)
  } else if (plannedFinishAt && nowMs >= out.finishWarningAt) {
    out.slaStatus = "entrega_proxima"; out.slaSeverity = "laranja";
  } else {
    out.slaStatus = "em_producao";
  }
  return out;
}

/* dedupKey determinístico = ID do doc em slaEvents → idempotência POR CONSTRUÇÃO
   (criar 2x o mesmo evento falha com ALREADY_EXISTS; reprogramar muda a âncora). */
function slaDedupKey(taskId, eventType, anchorMs) {
  return String(taskId) + "__" + String(eventType) + "__" + String(anchorMs || 0);
}

function buildSlaEvent(p) {
  return {
    tenantId: p.tenantId || "idseven", taskId: p.taskId, designerId: p.designerId || null,
    actorId: p.actorId || "sla-engine", actorRole: p.actorRole || "system",
    eventType: p.eventType, oldStatus: p.oldStatus || null, newStatus: p.newStatus || null,
    timestamp: p.timestamp, source: p.source || "worker-cron",
    dedupKey: slaDedupKey(p.taskId, p.eventType, p.anchorMs),
    metadata: p.metadata || {}, reason: p.reason || null,
    simulated: p.simulated !== false,   // FASE 4.x: tudo nasce simulado
  };
}

/* Deriva eventos NOVOS desta passada (warnings/overdues ancorados no prazo →
   reprogramação gera novas âncoras SEM duplicar as antigas). prevSla = designerSla
   gravado (ou {}); comp = computeSlaStatus(...).
   FASE 4.4-A2 — CORTE TEMPORAL OBRIGATÓRIO (slaActivatedAt): evento cuja ÂNCORA
   (prazo/atribuição/início/conclusão) é ANTERIOR à ativação é RETROATIVO e NÃO
   é emitido — vai para retro[] (contado/reportado). activatedAtMs ausente/0 =
   NADA é elegível (sem autorização explícita não há emissão alguma).
   Retorna { events:[], retro:[] }. */
function deriveSlaEvents(prevSla, comp, task, nowMs, activatedAtMs) {
  const ev = [];
  const t = task; const prev = prevSla || {};
  const cutMs = (typeof activatedAtMs === "number" && activatedAtMs > 0) ? activatedAtMs : Infinity;
  const retro = [];
  const base = { taskId: t.id, designerId: (t.designerAssignment && t.designerAssignment.designerId) || t.assigneeId || null, timestamp: nowMs };
  const push = (eventType, anchorMs, extra) => {
    if ((anchorMs || 0) < cutMs) { retro.push({ taskId: t.id, eventType, anchorMs: anchorMs || 0 }); return; }
    ev.push(buildSlaEvent(Object.assign({}, base, { eventType, anchorMs }, extra || {})));
  };
  if (!prev.assignedEventAt && t.designerAssignment && t.designerAssignment.assignedAt)
    push("designer_task_assigned", t.designerAssignment.assignedAt, { newStatus: "aguardando_inicio", metadata: { assignedBy: t.designerAssignment.assignedBy || null } });
  if (!prev.startedEventAt && slaStarted(t) && !slaDelivered(t))
    push("designer_task_started", t.startedAt || 0, { oldStatus: "aguardando_inicio", newStatus: "em_producao" });
  if (!prev.completedEventAt && slaDelivered(t))
    push("designer_task_completed", t.doneAt || comp.plannedFinishAt, { newStatus: "entregue" });
  if (comp.slaStatus === "inicio_proximo"   && !prev.startWarningSentAt)
    push("designer_start_warning",  comp.plannedStartAt,  { newStatus: comp.slaStatus });
  if (comp.slaStatus === "inicio_atrasado"  && !prev.startOverdueSentAt)
    push("designer_start_overdue",  comp.plannedStartAt,  { newStatus: comp.slaStatus, metadata: { overdueMs: comp.overdueMs } });
  if (comp.slaStatus === "entrega_proxima"  && !prev.finishWarningSentAt)
    push("designer_finish_warning", comp.plannedFinishAt, { newStatus: comp.slaStatus });
  if (comp.slaStatus === "entrega_atrasada" && !prev.finishOverdueSentAt)
    push("designer_finish_overdue", comp.plannedFinishAt, { newStatus: comp.slaStatus, metadata: { overdueMs: comp.overdueMs } });
  if (comp.blockedCandidate && !prev.blockedEventAt)
    push("designer_blocked_by_overdue", comp.plannedFinishAt || comp.plannedStartAt, { newStatus: "bloqueada_por_atraso", reason: "atraso ativo (simulação — bloqueio real OFF)" });
  if (!comp.blockedCandidate && prev.blockedEventAt && !prev.unblockedEventAt && (comp.slaStatus === "entregue" || comp.slaStatus === "em_producao"))
    push("designer_unblocked", nowMs, { oldStatus: "bloqueada_por_atraso", newStatus: comp.slaStatus });
  return { events: ev, retro };
}

/* ── FASE 4.4-A2: LOCK CONSOLIDADO POR DESIGNER (1 lock; tarefas críticas como
   metadata; prioridade = atraso mais grave/mais antigo). PURO — não escreve. ── */
function consolidateLocks(computedList) {
  const locks = {};
  for (const c of computedList) {
    if (!c.blockedCandidate || !c.designerId) continue;
    const L = locks[c.designerId] = locks[c.designerId] || { designerId: c.designerId, candidate: true, simulated: true, tasks: [], worstTaskId: null, worstOverdueMs: -1, oldestDeadlineMs: Infinity };
    L.tasks.push({ taskId: c.taskId, slaStatus: c.slaStatus, overdueMs: c.overdueMs || 0, deadlineMs: c.plannedFinishAt || c.plannedStartAt || 0 });
    if ((c.overdueMs || 0) > L.worstOverdueMs) { L.worstOverdueMs = c.overdueMs || 0; L.worstTaskId = c.taskId; }
    const dl = c.plannedFinishAt || c.plannedStartAt || 0;
    if (dl && dl < L.oldestDeadlineMs) L.oldestDeadlineMs = dl;
  }
  return locks;
}

/* ── FASE 4.4-A2: PLANO de reprogramação (dry-run, PURO — nada é aplicado).
   Quando o prazo muda: reseta os marcadores do deadline ANTIGO (novas âncoras
   poderão alertar), incrementa rescheduleCount e preserva histórico. ── */
function planReschedule(task, newPlan, nowMs, tz) {
  const prev = (task && task.designerSla) || {};
  const cur = slaPlanFromAssignment(task, tz);
  const newStartAt  = newPlan.startDate ? slaToMs(newPlan.startDate, newPlan.startTime, tz) : cur.plannedStartAt;
  const newFinishAt = newPlan.endDate   ? slaToMs(newPlan.endDate, newPlan.endTime, tz)     : cur.plannedFinishAt;
  const slaPatch = { plannedStartAt: newStartAt, plannedFinishAt: newFinishAt,
    rescheduleCount: (prev.rescheduleCount || 0) + 1, lastRescheduleAt: nowMs };
  const markersReset = [];
  if (newFinishAt !== cur.plannedFinishAt) { slaPatch.finishWarningSentAt = null; slaPatch.finishOverdueSentAt = null; markersReset.push("finishWarningSentAt", "finishOverdueSentAt"); }
  if (newStartAt !== cur.plannedStartAt)   { slaPatch.startWarningSentAt = null;  slaPatch.startOverdueSentAt = null;  markersReset.push("startWarningSentAt", "startOverdueSentAt"); }
  return {
    applied: false, dryRun: true,
    taskId: task && task.id, wouldPatch: { designerSla: slaPatch },
    historyEntry: { kind: "designer_deadline_rescheduled", at: nowMs,
      from: { plannedStartAt: cur.plannedStartAt, plannedFinishAt: cur.plannedFinishAt },
      to: { plannedStartAt: newStartAt, plannedFinishAt: newFinishAt } },
    markersReset,
    dedupAnchorChange: { oldFinishAnchor: cur.plannedFinishAt, newFinishAnchor: newFinishAt },
  };
}

/* WIP — SIMULAÇÃO CALIBRÁVEL (FASE 4.4-A2). Separa com clareza:
   - observed: contagem real de tarefas em produção (fato, sem juízo);
   - soft: limiar de ALERTA (softExceeded);
   - hard: limiar de BLOQUEIO (hardExceeded) — INERTE em wipMode "observe";
   - blockingByOverdue: atraso ativo ⇒ limite efetivo 0 (APENAS simulado).
   Em modo "observe" (default) NENHUM evento de limite é emitido — só observação
   no relatório, para calibração com dados reais antes de qualquer enforcement. */
function simulateWip(tasks, cfg, locksByDesigner) {
  const C = Object.assign({}, SLA_DEFAULTS, cfg || {});
  const byDesigner = {};
  for (const t of tasks) {
    const d = (t.designerAssignment && t.designerAssignment.designerId) || null;
    if (!d) continue;
    byDesigner[d] = byDesigner[d] || { designerId: d, observed: 0, taskIds: [],
      soft: C.wipSoftPerDesigner, hard: C.wipHardPerDesigner, mode: C.wipMode,
      softExceeded: false, hardExceeded: false, blockingByOverdue: false, effectiveLimit: C.wipHardPerDesigner };
    if (t.designerFlowStatus === "andamento") { byDesigner[d].observed++; byDesigner[d].taskIds.push(t.id); }
  }
  const events = [];
  for (const d of Object.keys(byDesigner)) {
    const w = byDesigner[d];
    w.softExceeded = w.observed > w.soft;
    w.hardExceeded = w.observed > w.hard;
    w.blockingByOverdue = !!(locksByDesigner && locksByDesigner[d]);
    w.effectiveLimit = w.blockingByOverdue ? 0 : w.hard;   // atraso ativo ⇒ 0 (simulação)
    if (w.hardExceeded && C.wipMode === "enforce")          // NUNCA em "observe"
      events.push(buildSlaEvent({ taskId: w.taskIds[w.taskIds.length - 1], designerId: d, eventType: "designer_wip_limit_reached", anchorMs: w.observed, timestamp: Date.now(), newStatus: null, metadata: { observed: w.observed, soft: w.soft, hard: w.hard }, reason: "WIP acima do hard (simulação — wipLimits OFF)" }));
  }
  return { byDesigner, events };
}

/* cria slaEvents/{dedupKey} — falha silenciosa se já existe (idempotência). */
async function slaCreateEvent(env, accessToken, ev) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/slaEvents?documentId=${encodeURIComponent(ev.dedupKey)}`;
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify({ fields: slaEncodeFields(ev) }) });
  if (res.status === 409) return { created: false, dedup: true };
  if (!res.ok) { console.warn("[SLA] createEvent falhou:", res.status); return { created: false, dedup: false }; }
  return { created: true, dedup: false };
}
function slaEncodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "object") return { mapValue: { fields: slaEncodeFields(v) } };
  return { stringValue: String(v) };
}
function slaEncodeFields(obj) { const f = {}; for (const k of Object.keys(obj || {})) f[k] = slaEncodeValue(obj[k]); return f; }

async function slaGetFlags(env, accessToken) {
  const doc = await getDoc(env, accessToken, "appConfig", "flags").catch(() => null);
  return Object.assign({}, SLA_FLAG_DEFAULTS, doc || {});
}

/* tarefas ativas no eixo do designer (IN-filter; índice single-field default). */
async function slaQueryActiveDesignerTasks(env, accessToken) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = { structuredQuery: { from: [{ collectionId: "tasks" }], where: { fieldFilter: { field: { fieldPath: "designerFlowStatus" }, op: "IN", value: { arrayValue: { values: [{ stringValue: "afazer" }, { stringValue: "andamento" }, { stringValue: "revisao" }, { stringValue: "concluido" }] } } } }, limit: 300 } };
  const res = await fetch(url, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) { console.warn("[SLA] query tasks falhou:", res.status); return []; }
  const rows = await res.json(); const out = [];
  for (const row of rows) { if (!row.document) continue; const id = row.document.name.split("/").pop(); out.push(Object.assign({ id }, decodeFields(row.document.fields))); }
  return out;
}

/* PASSADA DO ENGINE.
   write=false (DEFAULT): zero escrita — só computa e reporta (dry-run absoluto).
   write=true: exige env.SLA_WRITE==="true" + flags.slaEngine===true; grava
   slaEvents (ID=dedupKey) + task.designerSla (com marcadores *SentAt = registro
   do EVENTO, não de push — push real continua OFF). NUNCA envia FCM, NUNCA
   escreve designerLocks nesta fase. */
async function runSlaEnginePass(env, opts) {
  const o = opts || {}; const nowMs = Date.now();
  const tz = parseInt((env && env.APP_TZ_OFFSET_MINUTES) || "-180", 10);
  /* FASE 4.4-A2 — corte temporal OBRIGATÓRIO: sem env SLA_ACTIVATED_AT (epoch ms
     ou ISO) NENHUM evento é elegível (tudo retroativo). Impede rajada de backfill
     sem autorização explícita. */
  const activatedAtRaw = (env && env.SLA_ACTIVATED_AT) || "";
  const activatedAtMs = /^\d+$/.test(activatedAtRaw) ? parseInt(activatedAtRaw, 10) : (activatedAtRaw ? Date.parse(activatedAtRaw) : 0);
  const cfg = Object.assign({}, SLA_DEFAULTS, {
    maxTasksPerPass: parseInt((env && env.SLA_MAX_TASKS_PER_PASS) || "", 10) || SLA_DEFAULTS.maxTasksPerPass,
    maxEventsPerPass: parseInt((env && env.SLA_MAX_EVENTS_PER_PASS) || "", 10) || SLA_DEFAULTS.maxEventsPerPass,
    wipMode: (env && env.SLA_WIP_MODE) || SLA_DEFAULTS.wipMode,
  });
  const accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE);
  const flags = await slaGetFlags(env, accessToken);
  const writeAllowed = o.write === true && (env && env.SLA_WRITE === "true") && flags.slaEngine === true;
  const allTasks = await slaQueryActiveDesignerTasks(env, accessToken);
  /* backfill controlado: teto de tarefas por passada + relatório de paginação */
  const tasks = allTasks.slice(0, cfg.maxTasksPerPass);
  const report = { now: nowMs, activatedAt: activatedAtMs || null, scanned: tasks.length, flags, writeAllowed,
    pagination: { totalQueried: allTasks.length, analyzed: tasks.length, remaining: Math.max(0, allTasks.length - tasks.length), truncatedTasks: allTasks.length > tasks.length, maxTasksPerPass: cfg.maxTasksPerPass, maxEventsPerPass: cfg.maxEventsPerPass, eventsCapped: false },
    computed: [], events: [], retroIgnored: [], wouldNotify: [], wouldLock: [], writes: 0, dedupSkipped: 0 };
  for (const t of tasks) {
    if (!t.designerAssignment || !t.designerAssignment.designerId) continue;
    const prev = t.designerSla || {};
    const comp = computeSlaStatus(t, nowMs, cfg, tz);
    const der = deriveSlaEvents(prev, comp, t, nowMs, activatedAtMs);
    for (const r of der.retro) report.retroIgnored.push(r);
    let evs = der.events;
    if (report.events.length + evs.length > cfg.maxEventsPerPass) {       // teto de eventos
      evs = evs.slice(0, Math.max(0, cfg.maxEventsPerPass - report.events.length));
      report.pagination.eventsCapped = true;
    }
    report.computed.push({ taskId: t.id, designerId: t.designerAssignment.designerId, client: t.client || null, demandType: t.cronSub || t.sector || null, slaStatus: comp.slaStatus, slaSeverity: comp.slaSeverity, blockedCandidate: comp.blockedCandidate, overdueMs: comp.overdueMs || 0, plannedStartAt: comp.plannedStartAt, plannedFinishAt: comp.plannedFinishAt });
    for (const ev of evs) {
      report.events.push(ev);
      if (ev.eventType.indexOf("warning") >= 0 || ev.eventType.indexOf("overdue") >= 0)
        report.wouldNotify.push({ taskId: ev.taskId, designerId: ev.designerId, type: ev.eventType, simulated: true });
      if (ev.eventType === "designer_blocked_by_overdue")
        report.wouldLock.push({ designerId: ev.designerId, taskId: ev.taskId, simulated: true });
      if (writeAllowed) {
        const r = await slaCreateEvent(env, accessToken, ev);
        if (r.created) report.writes++; else if (r.dedup) report.dedupSkipped++;
      }
    }
    if (writeAllowed) {
      const markers = {};
      for (const ev of evs) {
        if (ev.eventType === "designer_start_warning")  markers.startWarningSentAt  = nowMs;
        if (ev.eventType === "designer_start_overdue")  markers.startOverdueSentAt  = nowMs;
        if (ev.eventType === "designer_finish_warning") markers.finishWarningSentAt = nowMs;
        if (ev.eventType === "designer_finish_overdue") markers.finishOverdueSentAt = nowMs;
        if (ev.eventType === "designer_task_assigned")  markers.assignedEventAt     = nowMs;
        if (ev.eventType === "designer_task_started")   markers.startedEventAt      = nowMs;
        if (ev.eventType === "designer_task_completed") markers.completedEventAt    = nowMs;
        if (ev.eventType === "designer_blocked_by_overdue") markers.blockedEventAt  = nowMs;
        if (ev.eventType === "designer_unblocked")      markers.unblockedEventAt    = nowMs;
      }
      const slaPatch = Object.assign({}, prev, markers, {
        assignedDesignerId: t.designerAssignment.designerId,
        plannedStartAt: comp.plannedStartAt, plannedFinishAt: comp.plannedFinishAt,
        startWarningAt: comp.startWarningAt, finishWarningAt: comp.finishWarningAt,
        slaStatus: comp.slaStatus, slaSeverity: comp.slaSeverity,
        blockedCandidate: comp.blockedCandidate, isBlocked: false,  // bloqueio REAL desligado
        lastComputedAt: nowMs, engineMode: "dry-run-phase-4.3",
      });
      const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/tasks/${t.id}?updateMask.fieldPaths=designerSla`;
      await fetch(url, { method: "PATCH", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { designerSla: { mapValue: { fields: slaEncodeFields(slaPatch) } } } }) }).catch((e) => console.warn("[SLA] patch designerSla:", e && e.message));
      report.writes++;
    }
  }
  /* FASE 4.4-A2 — lock CONSOLIDADO: 1 candidato por designer (tarefas críticas
     como metadata; prioridade pelo atraso mais grave/mais antigo). Só simulação. */
  const locks = consolidateLocks(report.computed);
  report.locksConsolidated = locks;
  report.wouldLock = Object.values(locks).map((L) => ({ designerId: L.designerId, worstTaskId: L.worstTaskId, worstOverdueMs: L.worstOverdueMs, tasks: L.tasks.length, simulated: true }));
  const wip = simulateWip(tasks, cfg, locks);
  report.wip = wip.byDesigner;
  for (const ev of wip.events) report.events.push(ev);
  /* agregados p/ calibração (FASE 4.4-A2): por designer / cliente / tipo */
  const agg = (key) => { const m = {}; for (const c of report.computed) { const k = c[key] || "?"; m[k] = m[k] || { total: 0, atrasadas: 0, laranja: 0 }; m[k].total++; if (c.slaSeverity === "vermelho") m[k].atrasadas++; if (c.slaSeverity === "laranja") m[k].laranja++; } return m; };
  report.totals = { byDesigner: agg("designerId"), byClient: agg("client"), byType: agg("demandType"),
    retroIgnored: report.retroIgnored.length, eligibleEvents: report.events.length };
  return report;
}

/* POST /sla-dryrun — inspeção sob demanda. SEMPRE sem push e sem lock.
   Sem body.write: zero escrita. Com {"write":true}: ainda exige SLA_WRITE +
   flag slaEngine (OFF por padrão → continua sem escrever). */
async function handleSlaDryRun(request, env) {
  if ((env && env.SLA_ENGINE_ENABLED) !== "true")
    return json({ ok: false, error: "SLA engine desabilitado (env SLA_ENGINE_ENABLED ausente) — comportamento de produção intocado." }, 403, env);
  let body = {}; try { body = await request.json(); } catch (_) {}
  const report = await runSlaEnginePass(env, { write: body && body.write === true });
  return json({ ok: true, mode: report.writeAllowed ? "write" : "dry-run", report }, 200, env);
}

/* POST /sla-reschedule-plan — FASE 4.4-A2: fluxo de reprogramação SOMENTE
   PLANEJADO (dry-run): lê a tarefa (read-only), devolve o patch que SERIA
   aplicado (reset de marcadores do prazo antigo + rescheduleCount + history).
   NUNCA escreve. Exige SLA_ENGINE_ENABLED (sem a env = 403, produção intocada). */
async function handleSlaReschedulePlan(request, env) {
  if ((env && env.SLA_ENGINE_ENABLED) !== "true")
    return json({ ok: false, error: "SLA engine desabilitado (env ausente)." }, 403, env);
  let body = {}; try { body = await request.json(); } catch (_) {}
  if (!body.taskId) return json({ ok: false, error: "taskId obrigatório" }, 400, env);
  const tz = parseInt((env && env.APP_TZ_OFFSET_MINUTES) || "-180", 10);
  const accessToken = await getAccessToken(env, FCM_SCOPE + " " + DATASTORE_SCOPE);
  const task = await getDoc(env, accessToken, "tasks", body.taskId);
  if (!task) return json({ ok: false, error: "tarefa não encontrada" }, 404, env);
  task.id = body.taskId;
  const plan = planReschedule(task, { startDate: body.startDate, startTime: body.startTime, endDate: body.endDate, endTime: body.endTime }, Date.now(), tz);
  return json({ ok: true, mode: "plan-only", plan }, 200, env);
}

/* export p/ testes unitários (node) — não interfere no runtime do Worker. */
export const __slaCore = { SLA_DEFAULTS, SLA_FLAG_DEFAULTS, SLA_EVENT_TYPES, slaToMs, slaPlanFromAssignment, slaStarted, computeSlaStatus, slaDedupKey, buildSlaEvent, deriveSlaEvents, simulateWip, consolidateLocks, planReschedule, slaEncodeFields, runSlaEnginePass };
