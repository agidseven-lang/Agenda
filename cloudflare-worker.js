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

    // ADITIVO (Visão do Cliente pública, link HTTPS seguro por token).
    // Vem ANTES do POST generico de push para nao colidir com handlePushRelay.
    if (url.pathname.startsWith("/cliente/cronograma/")) {
      return handleClientReview(request, env, url);
    }

    if (request.method === "POST") {
      return handlePushRelay(request, env);
    }

    return json({ ok: true, service: "idseven-push", version: "V64.4 + client-review" }, 200, env);
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
    else if (createdAtMs && createdAtMs > reminderAt) skippedReason = "criado apos reminderAt (sem retroativo)";
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
    await markReminderSent(env, accessToken, e.id, now);
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

async function getUser(env, accessToken, uid) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, { headers: { "Authorization": "Bearer " + accessToken } });
  if (!res.ok) return null;
  const doc = await res.json();
  return decodeFields(doc.fields);
}

/* grava events/{id}.reminderSentAt = nowMs (dedup exactly-once via Firestore) */
async function markReminderSent(env, accessToken, eventId, nowMs) {
  const url = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents/events/${eventId}?updateMask.fieldPaths=reminderSentAt`;
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

/* ============================================================================
   VISÃO DO CLIENTE — página pública premium por token (ADITIVO)
   ----------------------------------------------------------------------------
   Rotas:
     GET  /cliente/cronograma/<token>        -> renderiza a Visão do Cliente
                                                (HTML server-side + Open Graph)
     POST /cliente/cronograma/<token>/acao   -> Aprovar / Pedir revisão / Editar
   Seguranca: o <token> e uma capability aleatoria (clientReviewToken) gravada
   na tarefa pelo Desktop. O Worker usa a SERVICE ACCOUNT (mesma do push) para
   ler/gravar SOMENTE a tarefa daquele token via Firestore REST. Nao expoe o
   Firestore publicamente; nao mexe em Firestore Rules; nao mostra outra tarefa.
   ============================================================================ */
const CRON_LABELS = {
  rascunho_social: "Em rascunho", pronto_cliente: "Pronto para envio",
  enviado_cliente: "Enviado ao cliente", cliente_visualizou: "Cliente visualizou",
  em_revisao_cliente: "Em revisão", aprovado_cliente: "Aprovado", editado_cliente: "Edição solicitada",
};
function cronColor(s) {
  return ({ enviado_cliente: "#22D3EE", em_revisao_cliente: "#F59E0B", aprovado_cliente: "#34D399",
    editado_cliente: "#A78BFA", pronto_cliente: "#60A5FA" })[s] || "#9BA0AB";
}
function htmlEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function cronTypeLabel(t) {
  const n = Array.isArray(t.cronContents) ? t.cronContents.length : 0;
  if (n >= 12) return "Mensal"; if (n >= 6) return "Quinzenal"; if (n >= 1) return "Semanal";
  return "Cronograma";
}

async function handleClientReview(request, env, url) {
  // path: /cliente/cronograma/<token>[/acao]
  const rest = url.pathname.replace(/^\/cliente\/cronograma\//, "").replace(/\/+$/, "");
  const parts = rest.split("/");
  const token = (parts[0] || "").trim();
  const isAction = parts[1] === "acao";
  if (!token || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return htmlResponse(renderClientNotFound("Link inválido."), 404);
  }
  let accessToken;
  try { accessToken = await getAccessToken(env, DATASTORE_SCOPE); }
  catch (e) { return htmlResponse(renderClientError(), 500); }

  const task = await findTaskByReviewToken(env, accessToken, token);
  if (!task) return htmlResponse(renderClientNotFound("Cronograma não encontrado ou link expirado."), 404);

  if (isAction && request.method === "POST") {
    let action = "", note = "", form = null, jbody = null;
    const ct = request.headers.get("content-type") || "";
    try {
      if (ct.indexOf("application/json") >= 0) { jbody = await request.json(); action = jbody.action || ""; note = jbody.note || ""; }
      else { form = await request.formData(); action = String(form.get("action") || ""); note = String(form.get("note") || ""); }
    } catch (_) {}
    const back = "/cliente/cronograma/" + encodeURIComponent(token);

    // EDITAR — coleta os temas editados (1 card por tema) + comentario.
    if (action === "editar") {
      const items = [];
      const orig = Array.isArray(task.cronContents) ? task.cronContents : [];
      if (jbody && Array.isArray(jbody.items)) {
        jbody.items.forEach(function (it, i) { items.push({ tema: String(it.tema || ""), legenda: (orig[i] && orig[i].legenda) || "" }); });
        note = jbody.comment || note;
      } else if (form) {
        for (let i = 0; i < orig.length; i++) {
          const v = form.get("theme_" + i);
          if (v === null) continue;
          items.push({ tema: String(v || ""), legenda: (orig[i] && orig[i].legenda) || "" });
        }
        note = String(form.get("comment") || "");
      }
      if (!items.length) return htmlResponse(renderClientPage(task, url, { editMode: true }), 200);
      await applyClientEdit(env, accessToken, task, items, note.trim());
      return new Response(null, { status: 303, headers: { Location: back + "?done=editar", ...corsHeaders(env) } });
    }

    const map = {
      aprovar: { cronStatus: "aprovado_cliente", rev: "aprovado", type: "cliente_aprovou", label: "Cliente aprovou o cronograma" },
      revisao: { cronStatus: "em_revisao_cliente", rev: "revisao", type: "cliente_pediu_revisao", label: "Cliente pediu revisão" },
    };
    const m = map[action];
    if (!m) return htmlResponse(renderClientNotFound("Ação inválida."), 400);
    if (action === "revisao" && !note.trim()) {
      return htmlResponse(renderClientPage(task, url, { needNote: action }), 200);
    }
    await applyClientReview(env, accessToken, task, m, note.trim());
    return new Response(null, { status: 303, headers: { Location: back + "?done=" + action, ...corsHeaders(env) } });
  }

  // GET -> renderiza a pagina
  const done = url.searchParams.get("done") || "";
  return htmlResponse(renderClientPage(task, url, { done }), 200);
}

async function findTaskByReviewToken(env, accessToken, token) {
  const endpoint = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:runQuery`;
  const q = {
    structuredQuery: {
      from: [{ collectionId: "tasks" }],
      where: { fieldFilter: { field: { fieldPath: "clientReviewToken" }, op: "EQUAL", value: { stringValue: token } } },
      limit: 1,
    },
  };
  const res = await fetch(endpoint, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(q) });
  if (!res.ok) { console.error("[CLIENT-REVIEW] runQuery falhou:", res.status); return null; }
  const rows = await res.json();
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split("/").pop();
    return Object.assign({ id, _name: row.document.name }, decodeFields(row.document.fields));
  }
  return null;
}

async function applyClientReview(env, accessToken, task, m, note) {
  const now = Date.now();
  const ev = { mapValue: { fields: {
    type: { stringValue: m.type }, label: { stringValue: m.label },
    at: { integerValue: String(now) }, channel: { stringValue: "client_public_link" },
    note: { stringValue: note || "" }, client: { stringValue: task.client || "" },
  } } };
  const review = { mapValue: { fields: {
    status: { stringValue: m.rev }, note: { stringValue: note || "" },
    at: { integerValue: String(now) }, byName: { stringValue: "Cliente" },
  } } };
  const commit = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:commit`;
  const body = { writes: [{
    update: { name: task._name, fields: {
      cronStatus: { stringValue: m.cronStatus }, clientReview: review, clientReviewAt: { integerValue: String(now) },
    } },
    updateMask: { fieldPaths: ["cronStatus", "clientReview", "clientReviewAt"] },
    updateTransforms: [{ fieldPath: "history", appendMissingElements: { values: [ev] } }],
    currentDocument: { exists: true },
  }] };
  const res = await fetch(commit, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) console.error("[CLIENT-REVIEW] commit falhou:", res.status, (await res.text()).slice(0, 300));
}

// Edicao do cliente: atualiza cronContents (temas) + cronStatus=editado_cliente + clientReview + history.
async function applyClientEdit(env, accessToken, task, items, comment) {
  const now = Date.now();
  const contentsVal = { arrayValue: { values: items.map(function (it) {
    const f = { tema: { stringValue: String(it.tema || "") } };
    if (it.legenda) f.legenda = { stringValue: String(it.legenda) };
    return { mapValue: { fields: f } };
  }) } };
  const editedItems = { arrayValue: { values: items.map(function (it, i) {
    return { mapValue: { fields: { index: { integerValue: String(i) }, tema: { stringValue: String(it.tema || "") } } } };
  }) } };
  const review = { mapValue: { fields: {
    status: { stringValue: "editado" }, note: { stringValue: comment || "" },
    at: { integerValue: String(now) }, byName: { stringValue: "Cliente" }, editedItems: editedItems,
  } } };
  const ev = { mapValue: { fields: {
    type: { stringValue: "cliente_editou" }, label: { stringValue: "Cliente editou os temas do cronograma" },
    at: { integerValue: String(now) }, channel: { stringValue: "client_public_link" },
    note: { stringValue: comment || "" }, client: { stringValue: task.client || "" },
  } } };
  const commit = `${FIRESTORE_BASE}/projects/${env.FCM_PROJECT_ID}/databases/(default)/documents:commit`;
  const body = { writes: [{
    update: { name: task._name, fields: {
      cronStatus: { stringValue: "editado_cliente" }, clientReview: review,
      clientReviewAt: { integerValue: String(now) }, cronContents: contentsVal,
    } },
    updateMask: { fieldPaths: ["cronStatus", "clientReview", "clientReviewAt", "cronContents"] },
    updateTransforms: [{ fieldPath: "history", appendMissingElements: { values: [ev] } }],
    currentDocument: { exists: true },
  }] };
  const res = await fetch(commit, { method: "POST", headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) console.error("[CLIENT-EDIT] commit falhou:", res.status, (await res.text()).slice(0, 300));
}

function clientPageHead(task, url) {
  const tipo = cronTypeLabel(task);
  const title = "Cronograma " + tipo.toLowerCase() + " — " + (task.client || "Cliente");
  const desc = "Acesse para visualizar, aprovar, pedir revisão ou editar o cronograma.";
  const ogUrl = url.origin + url.pathname;
  const ogImg = "https://agendaidseven.com.br/icon-512.png";
  return '<meta charset="utf-8"/>'
    + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>'
    + '<title>' + htmlEsc(title) + '</title>'
    + '<meta name="description" content="' + htmlEsc(desc) + '"/>'
    + '<meta property="og:type" content="website"/>'
    + '<meta property="og:site_name" content="Agenda ID Seven"/>'
    + '<meta property="og:title" content="' + htmlEsc(title) + '"/>'
    + '<meta property="og:description" content="' + htmlEsc(desc) + '"/>'
    + '<meta property="og:url" content="' + htmlEsc(ogUrl) + '"/>'
    + '<meta property="og:image" content="' + htmlEsc(ogImg) + '"/>'
    + '<meta name="twitter:card" content="summary_large_image"/>'
    + '<meta name="twitter:title" content="' + htmlEsc(title) + '"/>'
    + '<meta name="twitter:description" content="' + htmlEsc(desc) + '"/>'
    + '<meta name="twitter:image" content="' + htmlEsc(ogImg) + '"/>'
    + '<meta name="robots" content="noindex, nofollow"/>'
    + '<link rel="icon" href="https://agendaidseven.com.br/icon-192.png"/>';
}

function clientPageCss() {
  return ':root{--bg:#0A0B10;--surface:#12141C;--surface2:#171A24;--line:#262A38;--ink:#E8EAF0;--soft:#9BA0AB;--faint:#6B7180;--accent:#5B6CFF}'
    + '*{box-sizing:border-box}body{margin:0;background:radial-gradient(120% 80% at 50% -10%,rgba(34,211,238,.08),transparent 60%),var(--bg);color:var(--ink);font:15px/1.55 -apple-system,Segoe UI,Roboto,Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}'
    + '.wrap{max-width:680px;margin:0 auto;padding:22px 16px 60px}'
    + '.brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}'
    + '.logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#5B6CFF,#22D3EE);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff}'
    + '.brand b{font-size:15px}.brand span{color:var(--soft);font-size:12px;display:block}'
    + '.hero{background:linear-gradient(165deg,var(--surface2),var(--surface));border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:0 18px 50px -28px rgba(0,0,0,.8)}'
    + '.head{display:flex;align-items:center;gap:12px;margin-bottom:14px}'
    + '.av{width:46px;height:46px;border-radius:13px;background:rgba(34,211,238,.14);color:#22D3EE;display:flex;align-items:center;justify-content:center;flex:none}'
    + '.av svg{width:24px;height:24px}.hid{flex:1;min-width:0}.hn{font-size:16px;font-weight:800}.hr{font-size:12px;color:var(--faint)}'
    + '.st{display:inline-flex;align-items:center;gap:7px;flex:none;padding:6px 11px;border-radius:999px;font-size:11.5px;font-weight:800;border:1px solid}'
    + '.dot{width:6px;height:6px;border-radius:50%;background:currentColor}'
    + '.ttl{font-size:22px;font-weight:800;letter-spacing:-.01em;margin:6px 0 14px}'
    + '.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:560px){.grid{grid-template-columns:1fr}}'
    + '.m label{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}.m div{font-size:14px;font-weight:600;margin-top:2px}'
    + '.sec{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);margin:22px 0 10px}'
    + '.item{display:flex;flex-direction:column;background:var(--surface2);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:9px}'
    + '.item-h{display:flex;gap:12px;align-items:flex-start}'
    + '.n{width:26px;height:26px;border-radius:8px;background:rgba(91,108,255,.16);color:#8b96ff;font-size:12.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}'
    + '.it{font-size:14.5px;font-weight:700}.il{font-size:13px;color:var(--soft);margin-top:3px}'
    + '.arts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}'
    + '.art-l{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}'
    + '.feed,.story{width:100%;border-radius:10px;border:1px solid var(--line);object-fit:cover;display:block;background:var(--surface)}'
    + '.feed{aspect-ratio:1080/1440}.story{aspect-ratio:1080/1920}'
    + '@media(max-width:480px){.arts{grid-template-columns:1fr}}'
    + '.card{background:var(--surface2);border:1px solid var(--line);border-radius:13px;padding:14px;white-space:pre-wrap;font-size:13.5px;color:var(--ink)}'
    + '.resp{display:flex;gap:12px;align-items:flex-start;border:1px solid;border-radius:14px;padding:14px;margin:16px 0}'
    + '.actions{display:flex;flex-direction:column;gap:11px;margin-top:24px}'
    + '.btn{height:52px;border-radius:14px;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid transparent;cursor:pointer;width:100%;font-family:inherit}'
    + '.approve{color:#fff;background:linear-gradient(135deg,#34D399,#10B981);box-shadow:0 12px 28px -12px rgba(16,185,129,.6)}'
    + '.rev{color:#F59E0B;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.4)}'
    + '.edit{color:#A78BFA;background:rgba(167,139,250,.12);border-color:rgba(167,139,250,.4)}'
    + 'textarea{width:100%;min-height:90px;background:var(--surface);border:1px solid var(--line);border-radius:12px;color:var(--ink);padding:12px;font:inherit;resize:vertical}textarea:focus{outline:none;border-color:var(--accent)}'
    + '.note-box{margin-top:24px;background:var(--surface2);border:1px solid var(--line);border-radius:16px;padding:16px}.note-box label{font-size:13.5px;font-weight:800;display:block;margin-bottom:10px}'
    + '.row{display:flex;gap:10px;margin-top:12px}.row .btn{height:46px;font-size:14px}.ghost{background:var(--surface);border:1px solid var(--line);color:var(--soft)}'
    + '.ok{color:#34D399;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.34);border-radius:14px;padding:15px;text-align:center;font-weight:800;margin-top:22px}'
    + '.foot{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--soft);margin-top:22px;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:13px}'
    + '.center{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--soft)}'
    // stepper de etapas
    + '.stepper{display:flex;align-items:center;justify-content:space-between;gap:4px;margin:16px 2px 4px}'
    + '.stp{display:flex;flex-direction:column;align-items:center;gap:5px;flex:none}'
    + '.stp-d{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:var(--surface2);border:1px solid var(--line);color:var(--faint)}'
    + '.stp.on .stp-d{background:linear-gradient(135deg,#5B6CFF,#22D3EE);border-color:transparent;color:#fff}'
    + '.stp-l{font-size:10.5px;font-weight:700;color:var(--faint)}.stp.on .stp-l{color:var(--ink)}'
    + '.stp-line{flex:1;height:2px;background:var(--line);border-radius:2px;margin-bottom:18px}.stp-line.on{background:linear-gradient(90deg,#5B6CFF,#22D3EE)}'
    // editor de temas (cliente)
    + '.ed-form{margin-top:8px}'
    + '.ed-card{display:flex;gap:12px;background:var(--surface2);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:10px}'
    + '.ed-n{width:26px;height:26px;border-radius:8px;background:rgba(91,108,255,.16);color:#8b96ff;font-size:12.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}'
    + '.ed-f{flex:1;min-width:0}.ed-f label{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:6px}'
    + '.ed-in{width:100%;background:var(--surface);border:1px solid var(--line);border-radius:10px;color:var(--ink);padding:11px;font:inherit;font-size:14.5px}.ed-in:focus{outline:none;border-color:var(--accent)}'
    + '.ed-leg{font-size:12.5px;color:var(--soft);margin-top:6px}'
    // Observacoes da equipe — premium
    + '.ob-card{background:var(--surface2);border:1px solid var(--line);border-radius:14px;overflow:hidden}'
    + '.ob-head{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(91,108,255,.08),transparent)}'
    + '.ob-ic{width:30px;height:30px;border-radius:9px;background:rgba(91,108,255,.16);color:#8b96ff;display:flex;align-items:center;justify-content:center;flex:none}.ob-ic svg{width:17px;height:17px}'
    + '.ob-title{font-size:13.5px;font-weight:800}'
    + '.ob-body{padding:6px 14px 12px}'
    + '.ob-h{display:flex;align-items:center;gap:9px;margin:13px 0 6px;font-size:12.5px;font-weight:800;color:var(--ink)}'
    + '.ob-num{width:22px;height:22px;border-radius:7px;background:rgba(34,211,238,.16);color:#22D3EE;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}'
    + '.ob-kv{display:flex;gap:8px;padding:4px 0 4px 31px;font-size:13px;line-height:1.5}'
    + '.ob-k{color:var(--faint);font-weight:700;min-width:62px;flex:none}.ob-v{color:var(--ink)}'
    + '.ob-p{font-size:13.5px;color:var(--ink);line-height:1.55;padding:4px 0}';
}

function renderClientPage(task, url, opts) {
  opts = opts || {};
  const tipo = cronTypeLabel(task);
  const st = task.cronStatus || "enviado_cliente";
  const stLabel = CRON_LABELS[st] || st;
  const stColor = cronColor(st);
  const conts = (Array.isArray(task.cronContents) ? task.cronContents : [])
    .map(function (c) { return c || {}; })
    .filter(function (c) { return c.tema || c.legenda || c.feedImageUrl || c.storyImageUrl; });
  function artsHtml(c) {
    if (!c.feedImageUrl && !c.storyImageUrl) return "";
    return '<div class="arts">'
      + (c.feedImageUrl ? '<div class="art"><div class="art-l">Feed · 1080×1440</div><a href="' + htmlEsc(c.feedImageUrl) + '" target="_blank" rel="noopener"><img class="feed" src="' + htmlEsc(c.feedImageUrl) + '" alt="Feed" loading="lazy"></a></div>' : "")
      + (c.storyImageUrl ? '<div class="art"><div class="art-l">Story · 1080×1920</div><a href="' + htmlEsc(c.storyImageUrl) + '" target="_blank" rel="noopener"><img class="story" src="' + htmlEsc(c.storyImageUrl) + '" alt="Story" loading="lazy"></a></div>' : "")
      + '</div>';
  }
  const contHtml = conts.length
    ? conts.map(function (c, i) {
        return '<div class="item"><div class="item-h"><div class="n">' + (i + 1) + '</div><div><div class="it">'
          + htmlEsc(c.tema || "(sem tema)") + '</div>'
          + (c.legenda ? '<div class="il">' + htmlEsc(c.legenda) + '</div>' : '') + '</div></div>'
          + artsHtml(c) + '</div>';
      }).join("")
    : '<div class="il">Nenhum conteúdo cadastrado.</div>';
  const cr = task.clientReview && task.clientReview.status ? task.clientReview : null;
  const crColor = cr ? cronColor(cr.status === "aprovado" ? "aprovado_cliente" : cr.status === "revisao" ? "em_revisao_cliente" : "editado_cliente") : "#9BA0AB";
  const crLabel = cr ? ({ aprovado: "Você aprovou este cronograma", revisao: "Você solicitou revisão", editado: "Você solicitou edição" }[cr.status] || "Resposta registrada") : "";
  const respHtml = cr
    ? '<div class="resp" style="border-color:' + crColor + '55;background:' + crColor + '1a"><div style="color:' + crColor + ';font-weight:800;font-size:14.5px">' + htmlEsc(crLabel) + (cr.note ? '<div style="color:var(--ink);font-weight:400;font-style:italic;margin-top:5px">"' + htmlEsc(cr.note) + '"</div>' : '') + '</div></div>'
    : '';
  const obsHtml = renderObs(task.desc);
  const sentAt = task.clientSentAt ? new Date(task.clientSentAt).toLocaleDateString("pt-BR") : "—";

  const base = htmlEsc(url.pathname.replace(/\/$/, ""));
  // ui via querystring (sem JS): ?ui=revisao -> nota; ?ui=editar -> editor de temas.
  const ui = url.searchParams.get("ui");
  if (!opts.needNote && !opts.editMode && st !== "aprovado_cliente") {
    if (ui === "revisao") return renderClientPage(task, url, { needNote: "revisao" });
    if (ui === "editar") return renderClientPage(task, url, { editMode: true });
  }

  let actions = "";
  if (opts.editMode) {
    // Editor premium — 1 card por tema (Tema editavel) + comentario.
    const cards = (conts.length ? conts : [{ tema: "" }]).map(function (c, i) {
      return '<div class="ed-card"><div class="ed-n">' + (i + 1) + '</div><div class="ed-f">'
        + '<label>Tema do conteúdo ' + (i + 1) + '</label>'
        + '<input class="ed-in" type="text" name="theme_' + i + '" value="' + htmlEsc(c.tema || "") + '" placeholder="Tema do conteúdo"/>'
        + (c.legenda ? '<div class="ed-leg">Legenda: ' + htmlEsc(c.legenda) + '</div>' : '')
        + '</div></div>';
    }).join("");
    actions = '<form method="POST" action="' + base + '/acao" class="ed-form">'
      + '<input type="hidden" name="action" value="editar"/>'
      + '<div class="sec" style="margin-top:6px">Editar temas do cronograma</div>'
      + cards
      + '<div class="note-box" style="margin-top:14px"><label>Comentário para a equipe (opcional)</label>'
      + '<textarea name="comment" placeholder="Explique o que mudou ou o que deseja…"></textarea></div>'
      + '<div class="row"><a class="btn ghost" href="' + htmlEsc(url.pathname) + '" style="text-decoration:none">Cancelar</a>'
      + '<button class="btn edit" type="submit">Salvar alterações</button></div></form>';
  } else if (st === "aprovado_cliente") {
    actions = '<div class="ok">✓ Cronograma aprovado. A equipe foi notificada.</div>';
  } else if (opts.needNote === "revisao") {
    actions = '<form method="POST" action="' + base + '/acao" class="note-box">'
      + '<input type="hidden" name="action" value="revisao"/>'
      + '<label>O que precisa ser revisado?</label>'
      + '<textarea name="note" required placeholder="Descreva os pontos para revisão…"></textarea>'
      + '<div class="row"><a class="btn ghost" href="' + htmlEsc(url.pathname) + '" style="text-decoration:none">Cancelar</a>'
      + '<button class="btn rev" type="submit">Enviar revisão</button></div></form>';
  } else {
    actions = '<div class="actions">'
      + '<form method="POST" action="' + base + '/acao"><input type="hidden" name="action" value="aprovar"/><button class="btn approve" type="submit">✓ Aprovar cronograma</button></form>'
      + '<a class="btn rev" href="' + base + '?ui=revisao" style="text-decoration:none">⇄ Pedir revisão</a>'
      + '<a class="btn edit" href="' + base + '?ui=editar" style="text-decoration:none">✎ Editar cronograma</a>'
      + '</div>';
  }

  const body = '<div class="wrap">'
    + '<div class="brand"><div class="logo">7</div><div><b>Agenda ID Seven</b><span>Avaliação do cronograma</span></div></div>'
    + '<div class="hero">'
    + '<div class="head"><div class="av"><svg viewBox="0 0 24 24" fill="none"><path d="M5 21V5.5A1.5 1.5 0 0 1 6.5 4H13a1.5 1.5 0 0 1 1.5 1.5V21M14.5 9h3A1.5 1.5 0 0 1 19 10.5V21M3 21h18" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg></div>'
    + '<div class="hid"><div class="hn">' + htmlEsc(task.client || "Cliente") + '</div><div class="hr">Cliente</div></div>'
    + '<span class="st" style="color:' + stColor + ';background:' + stColor + '22;border-color:' + stColor + '44"><span class="dot"></span>' + htmlEsc(stLabel) + '</span></div>'
    + '<div class="ttl">' + htmlEsc(task.title || "Cronograma") + '</div>'
    + '<div class="grid">'
    + '<div class="m"><label>Tipo</label><div>Cronograma ' + tipo.toLowerCase() + '</div></div>'
    + '<div class="m"><label>Responsável</label><div>' + htmlEsc(task.assignee || "—") + '</div></div>'
    + (task.startDate ? '<div class="m"><label>Início</label><div>' + htmlEsc(task.startDate.split("-").reverse().join("/")) + (task.startTime ? " · " + htmlEsc(task.startTime) : "") + '</div></div>' : "")
    + (task.endDate ? '<div class="m"><label>Término</label><div>' + htmlEsc(task.endDate.split("-").reverse().join("/")) + (task.endTime ? " · " + htmlEsc(task.endTime) : "") + '</div></div>' : "")
    + '<div class="m"><label>Enviado em</label><div>' + sentAt + '</div></div>'
    + '<div class="m"><label>Prazo final</label><div>' + (task.dueDate ? htmlEsc(task.dueDate.split("-").reverse().join("/")) + (task.dueTime ? " · " + htmlEsc(task.dueTime) : "") : "Sem prazo") + '</div></div>'
    + '</div></div>'
    + clientStepper(st)
    + respHtml
    + (opts.done ? '<div class="ok">Resposta registrada. Obrigado!</div>' : '')
    + '<div class="sec">Conteúdos do cronograma (' + conts.length + ')</div>' + contHtml
    + obsHtml
    + actions
    + '<div class="foot"><span>Você está vendo apenas o seu cronograma. Sua resposta é registrada e enviada à equipe.</span></div>'
    + '</div>';
  return '<!doctype html><html lang="pt-BR"><head>' + clientPageHead(task, url) + '<style>' + clientPageCss() + '</style></head><body>' + body + '</body></html>';
}

// Observações da equipe — card premium com hierarquia (quebra "Conteúdo N" / "Tema:" /
// "Legenda:" em sub-itens). Nunca texto solto.
function renderObs(desc) {
  if (!desc) return "";
  const raw = String(desc).replace(/\r/g, "");
  const lines = raw.split("\n").map(function (l) { return l.replace(/\s+$/, ""); }).filter(function (l) { return l.trim() !== ""; });
  const rows = lines.map(function (l) {
    const t = l.trim();
    const mc = t.match(/^(Conte[úu]do|Item)\s*(\d+)\s*:?\s*$/i);
    if (mc) return '<div class="ob-h"><span class="ob-num">' + htmlEsc(mc[2]) + '</span><span>' + htmlEsc(mc[1].replace(/^./, function (c) { return c.toUpperCase(); })) + ' ' + htmlEsc(mc[2]) + '</span></div>';
    const mk = t.match(/^(Tema|Legenda|Canais?|Per[íi]odo|Semana|M[êe]s|Objetivo|Tom|CTA|Quantidade)\s*:\s*(.*)$/i);
    if (mk) return '<div class="ob-kv"><span class="ob-k">' + htmlEsc(mk[1]) + '</span><span class="ob-v">' + htmlEsc(mk[2]) + '</span></div>';
    return '<div class="ob-p">' + htmlEsc(t) + '</div>';
  }).join("");
  return '<div class="sec">Observações da equipe</div>'
    + '<div class="ob-card"><div class="ob-head"><span class="ob-ic">'
    + '<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 11h8M8 15h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    + '</span><span class="ob-title">Notas da equipe</span></div><div class="ob-body">' + rows + '</div></div>';
}

// Stepper premium das etapas do fluxo (destaca a etapa atual pelo cronStatus).
function clientStepper(st) {
  const steps = [
    { k: "envio", label: "Enviado", on: ["enviado_cliente", "em_revisao_cliente", "editado_cliente", "aprovado_cliente"] },
    { k: "aval", label: "Avaliação", on: ["em_revisao_cliente", "editado_cliente", "aprovado_cliente"] },
    { k: "aprov", label: "Aprovado", on: ["aprovado_cliente"] },
    { k: "design", label: "Produção", on: ["sent_to_designer", "designer_in_progress", "designer_done", "ready_for_final_client_review", "completed"] },
  ];
  const html = steps.map(function (s, i) {
    const done = s.on.indexOf(st) >= 0;
    return '<div class="stp ' + (done ? "on" : "") + '"><span class="stp-d">' + (done ? "✓" : (i + 1)) + '</span><span class="stp-l">' + s.label + '</span></div>'
      + (i < steps.length - 1 ? '<span class="stp-line ' + (done ? "on" : "") + '"></span>' : "");
  }).join("");
  return '<div class="stepper">' + html + '</div>';
}

function renderClientNotFound(msg) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Link indisponível — Agenda ID Seven</title><style>' + clientPageCss() + '</style></head><body><div class="center"><div class="logo" style="margin:0 auto 16px">7</div><h2 style="color:var(--ink)">Link indisponível</h2><p>' + htmlEsc(msg || "Não foi possível abrir este cronograma.") + '</p></div></body></html>';
}
function renderClientError() {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Erro — Agenda ID Seven</title><style>' + clientPageCss() + '</style></head><body><div class="center"><div class="logo" style="margin:0 auto 16px">7</div><h2 style="color:var(--ink)">Indisponível no momento</h2><p>Tente novamente em instantes.</p></div></body></html>';
}
function htmlResponse(html, status) {
  return new Response(html, { status: status || 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
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
