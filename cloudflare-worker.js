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
     REMINDER_WINDOW_SECONDS   default 60   (janela exata do disparo)
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

    if (request.method === "POST") {
      return handlePushRelay(request, env);
    }

    return json({ ok: true, service: "idseven-push", version: "V64.4" }, 200, env);
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

  const windowSec = parseInt(env.REMINDER_WINDOW_SECONDS, 10) > 0 ? parseInt(env.REMINDER_WINDOW_SECONDS, 10) : 60;
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
    if (!ownerId) { console.log(`[REMINDER] skipped: ${e.id} sem ownerId`); continue; }

    let minutes = ownerMinsCache[ownerId];
    if (minutes === undefined) {
      const u = userDocCache[ownerId] || await getUser(env, accessToken, ownerId);
      userDocCache[ownerId] = u;
      const m = u && parseInt(u.reminderMinutes, 10);
      minutes = (m > 0) ? m : defaultBefore;
      ownerMinsCache[ownerId] = minutes;
    }

    const reminderAt = startMs - minutes * 60000;
    console.log(`[REMINDER] eventStart=${new Date(startMs).toISOString()} reminderAt=${new Date(reminderAt).toISOString()} now=${new Date(now).toISOString()} (${e.id})`);

    let decision;
    if (now < reminderAt) decision = "skip: reminderAt no futuro";
    else if (now >= reminderAt + windowSec * 1000) decision = "skip: reminderAt já passou";
    else if (e.reminderSentAt) decision = "skip: já enviado (reminderSentAt)";
    else decision = "in-window";

    report.candidates.push({ id: e.id, eventStart: new Date(startMs).toISOString(), reminderAt: new Date(reminderAt).toISOString(), minutes, decision });

    if (decision !== "in-window") { console.log(`[REMINDER] ${decision} (${e.id})`); continue; }

    /* tokens do dono, deduplicados por dispositivo */
    const owner = userDocCache[ownerId] || await getUser(env, accessToken, ownerId);
    userDocCache[ownerId] = owner;
    const tokensBefore = (owner && Array.isArray(owner.fcmTokens)) ? owner.fcmTokens.filter(Boolean) : [];
    const tokens = dedupeTokensByDevice(tokensBefore, owner && owner.fcmTokenMeta);
    console.log(`[PUSH] tokens antes=${tokensBefore.length} depois=${tokens.length} (owner=${ownerId})`);
    if (!tokens.length) { console.log(`[REMINDER] skipped: dono ${ownerId} sem token (${e.id})`); continue; }

    const typeLabel = labelForType(e.type);
    const title = `⏰ ${typeLabel} em ${minutes} min`;
    let body = e.title || e.client || "Compromisso";
    if (e.client && e.title) body = `${e.title} · ${e.client}`;
    if (e.start) body += ` (${e.start})`;
    const data = stringifyData({ tag: "reminder-" + e.id, url: "?openEvent=" + e.id, eventId: e.id });

    if (dryRun) {
      report.sent.push({ id: e.id, wouldSendTo: tokens.length, title });
      console.log(`[REMINDER] dry-run: enviaria ownerId=${ownerId} event=${e.id} para ${tokens.length} token(s)`);
      continue;
    }

    const results = await sendToTokens(env, accessToken, tokens, { title, body, data });
    const okCount = results.filter((r) => r.ok).length;
    console.log(`[REMINDER] sent: ownerId=${ownerId} event=${e.id} ok=${okCount}/${tokens.length}`);
    report.sent.push({ id: e.id, sentTo: tokens.length, ok: okCount });

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
