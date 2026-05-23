/* ============================================================================
   ID Seven — Cloudflare Worker  [V64.3]
   ============================================================================
   Responsabilidades:
     1. RELAY DE PUSH  (POST /)            → recebe {tokens,title,body,data} do app
                                              e envia via FCM HTTP v1. Retorna
                                              {results:[{ok,status,response}]} na MESMA
                                              ordem dos tokens (o index.html usa isso
                                              pra limpar tokens mortos).
     2. CRON DE LEMBRETE (scheduled)       → a cada minuto lê os compromissos no
                                              Firestore, calcula reminderAt e dispara
                                              o lembrete SÓ na janela exata:
                                                now >= reminderAt
                                                AND now < reminderAt + REMINDER_WINDOW_SECONDS
                                              Lê a antecedência do DONO em
                                              users/{ownerId}.reminderMinutes (default 60).
     3. AUTH IMAGEKIT  (GET/POST /imagekit-auth) → assina upload do ImageKit.

   ----------------------------------------------------------------------------
   REGRA DE NEGÓCIO V64.3:
     - Compromisso/agenda NÃO recebe push imediato na criação (isso é tratado no
       index.html — aqui o Worker NUNCA dispara nada na criação).
     - O único push de compromisso é o LEMBRETE, em (eventStart - reminderMinutes).
     - Nunca dispara lembrete retroativo: se reminderAt já passou da janela, ignora.
   ----------------------------------------------------------------------------
   VARIÁVEIS / SECRETS necessários no Cloudflare (Settings → Variables):
     FIREBASE_PROJECT_ID        (var)     ex: "agenda-id-seven"
     FIREBASE_SERVICE_ACCOUNT   (secret)  JSON da service account (client_email +
                                          private_key) com permissão de FCM e Firestore.
     REMINDER_BEFORE_MINUTES    (var)     default 60  — usado se o dono não tiver
                                          users/{ownerId}.reminderMinutes salvo.
     REMINDER_WINDOW_SECONDS    (var)     default 60  — largura da janela do disparo.
     APP_TZ_OFFSET_MINUTES      (var)     default -180 (UTC-3, horário de Brasília).
                                          O app guarda date "YYYY-MM-DD" + start "HH:MM"
                                          em horário local; o Worker roda em UTC.
     IMAGEKIT_PRIVATE_KEY       (secret)  chave privada do ImageKit (pra /imagekit-auth).
     ALLOW_ORIGIN               (var)     default "*" — origem permitida no CORS.

   BINDINGS opcionais:
     SENT_REMINDERS (KV Namespace)  — usado pra garantir EXACTLY-ONCE no lembrete
                                      (evita reenvio se o cron pegar a janela 2x).
                                      Se não existir, o Worker ainda funciona, mas a
                                      janela curta passa a ser a única proteção.

   CRON sugerido (wrangler.toml):
     [triggers]
     crons = ["* * * * *"]   # a cada 1 minuto

   ============================================================================ */

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

/* ───────────────────────── ENTRYPOINTS ───────────────────────── */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* CORS preflight */
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (url.pathname === "/imagekit-auth") {
      return handleImageKitAuth(request, env);
    }

    if (request.method === "POST") {
      return handlePushRelay(request, env, ctx);
    }

    return json({ ok: true, service: "idseven-push", version: "V64.3" }, 200, env);
  },

  /* Cron: a cada minuto. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminderCron(env).catch((e) => {
      console.error("[CRON] erro fatal:", e && e.message);
    }));
  },
};

/* ───────────────────────── 1. PUSH RELAY ───────────────────────── */
async function handlePushRelay(request, env, ctx) {
  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ ok: false, error: "JSON inválido" }, 400, env);
  }

  let tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
  /* [V64.3] dedup com Set() — nunca enviar pro mesmo token 2x na mesma chamada */
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

/* Envia para uma lista de tokens (FCM HTTP v1 é 1 request por token). */
async function sendToTokens(env, accessToken, tokens, msg) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const results = [];
  for (const token of tokens) {
    const fcmMessage = {
      message: {
        token,
        data: msg.data,
        webpush: {
          headers: { Urgency: "high", TTL: "86400" }, /* [V64.1+] alta prioridade + TTL */
          notification: {
            title: msg.title,
            body: msg.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: (msg.data && msg.data.tag) || undefined,
          },
          /* Sem fcm_options.link de propósito: o clique é tratado pelo
             notificationclick do firebase-messaging-sw.js, que usa data.url
             pra focar a aba existente / abrir o deep link sem duplicar. */
        },
      },
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
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
async function runReminderCron(env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) { console.error("[CRON] FIREBASE_PROJECT_ID ausente"); return; }

  const windowSec = parseInt(env.REMINDER_WINDOW_SECONDS, 10) > 0
    ? parseInt(env.REMINDER_WINDOW_SECONDS, 10) : 60;
  const defaultBefore = parseInt(env.REMINDER_BEFORE_MINUTES, 10) > 0
    ? parseInt(env.REMINDER_BEFORE_MINUTES, 10) : 60;
  const tzOffset = Number.isFinite(parseInt(env.APP_TZ_OFFSET_MINUTES, 10))
    ? parseInt(env.APP_TZ_OFFSET_MINUTES, 10) : -180; /* UTC-3 (Brasília) */

  const now = Date.now();

  let accessToken;
  try {
    accessToken = await getAccessToken(env, FCM_SCOPE + " " + FIRESTORE_SCOPE);
  } catch (e) {
    console.error("[CRON] auth falhou:", e && e.message);
    return;
  }

  /* Busca compromissos não concluídos com data >= ontem (margem de TZ). */
  const yesterdayStr = isoDate(now - 86400000);
  const events = await queryEvents(env, accessToken, yesterdayStr);
  console.log(`[CRON] ${events.length} compromisso(s) candidatos; now=${new Date(now).toISOString()}`);

  /* Cache de reminderMinutes por owner pra não reler o mesmo user várias vezes. */
  const ownerMinsCache = {};
  const userDocCache = {};

  for (const e of events) {
    if (!e || e.done) continue;
    const startMs = eventStartMs(e, tzOffset);
    if (!startMs) continue;

    const ownerId = e.ownerId || null;
    if (!ownerId) {
      console.log(`[REMINDER] skipped: compromisso ${e.id} sem ownerId — sem destinatário`);
      continue;
    }

    /* reminderMinutes do DONO (Firestore) — default se não existir. */
    let minutes = ownerMinsCache[ownerId];
    if (minutes === undefined) {
      const u = userDocCache[ownerId] || await getUser(env, accessToken, ownerId);
      userDocCache[ownerId] = u;
      const m = u && parseInt(u.reminderMinutes, 10);
      minutes = (m > 0) ? m : defaultBefore;
      ownerMinsCache[ownerId] = minutes;
    }

    const reminderAt = startMs - minutes * 60000;
    console.log(`[REMINDER] eventStart=${new Date(startMs).toISOString()} (${e.id})`);
    console.log(`[REMINDER] reminderAt=${new Date(reminderAt).toISOString()} (${minutes} min antes)`);
    console.log(`[REMINDER] now=${new Date(now).toISOString()}`);

    /* JANELA EXATA: now >= reminderAt AND now < reminderAt + windowSec. */
    if (now < reminderAt) {
      console.log(`[REMINDER] skipped: reminderAt no futuro (${e.id})`);
      continue;
    }
    if (now >= reminderAt + windowSec * 1000) {
      console.log(`[REMINDER] skipped: reminderAt já passou (${e.id})`);
      continue;
    }

    /* EXACTLY-ONCE: se já mandamos esse lembrete, pula (proteção contra cron 2x). */
    const dedupeKey = `sent:${e.id}:${Math.floor(reminderAt / 60000)}`;
    if (await alreadySent(env, dedupeKey)) {
      console.log(`[REMINDER] skipped: já enviado (${e.id})`);
      continue;
    }

    /* Tokens do dono, deduplicados por dispositivo. */
    const owner = userDocCache[ownerId] || await getUser(env, accessToken, ownerId);
    userDocCache[ownerId] = owner;
    const tokensBefore = (owner && Array.isArray(owner.fcmTokens)) ? owner.fcmTokens.filter(Boolean) : [];
    const tokens = dedupeTokensByDevice(tokensBefore, owner && owner.fcmTokenMeta);
    console.log(`[PUSH] tokens antes=${tokensBefore.length} depois=${tokens.length} (owner=${ownerId})`);
    if (!tokens.length) {
      console.log(`[REMINDER] skipped: dono ${ownerId} sem token (${e.id})`);
      continue;
    }

    const typeLabel = labelForType(e.type);
    const title = `⏰ ${typeLabel} em ${minutes} min`;
    let body = e.title || e.client || "Compromisso";
    if (e.client && e.title) body = `${e.title} · ${e.client}`;
    if (e.start) body += ` (${e.start})`;

    const data = stringifyData({ tag: "reminder-" + e.id, url: "?openEvent=" + e.id, eventId: e.id });
    const results = await sendToTokens(env, accessToken, tokens, { title, body, data });
    const okCount = results.filter((r) => r.ok).length;
    console.log(`[REMINDER] sent: ownerId=${ownerId} event=${e.id} ok=${okCount}/${tokens.length}`);

    await markSent(env, dedupeKey);
  }
}

/* Calcula o timestamp UTC do início do compromisso a partir de date+start locais. */
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
  /* Wall clock (local) → UTC: UTC = local - offset. offset(-180) → +180min. */
  return Date.UTC(y, mo - 1, d, hh, mm) - tzOffsetMinutes * 60000;
}

/* [V64.3] Mantém só 1 token por deviceId (o mais recente por lastSeenAt/createdAt),
   e dedup final com Set(). Tokens sem metadados são mantidos como estão. */
function dedupeTokensByDevice(tokens, meta) {
  if (!Array.isArray(tokens)) return [];
  meta = (meta && typeof meta === "object") ? meta : {};
  const byDevice = {};   /* deviceId → {token, ts} */
  const noMeta = [];
  for (const t of tokens) {
    if (!t) continue;
    const m = meta[t];
    if (m && m.deviceId) {
      const ts = (m.lastSeenAt || m.createdAt || 0);
      if (!byDevice[m.deviceId] || ts >= byDevice[m.deviceId].ts) {
        byDevice[m.deviceId] = { token: t, ts };
      }
    } else {
      noMeta.push(t);
    }
  }
  const out = Object.keys(byDevice).map((k) => byDevice[k].token).concat(noMeta);
  return Array.from(new Set(out.filter(Boolean)));
}

function labelForType(type) {
  const map = {
    gravacao: "Gravação", reuniao: "Reunião", trafego: "Tráfego",
    revisao: "Revisão", entrega: "Entrega", foto: "Foto", outro: "Compromisso",
  };
  return (type && map[type]) || "Compromisso";
}

/* ───────────────────────── FIRESTORE REST ───────────────────────── */
async function queryEvents(env, accessToken, fromDateStr) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents:runQuery`;
  const structuredQuery = {
    structuredQuery: {
      from: [{ collectionId: "events" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "date" },
          op: "GREATER_THAN_OR_EQUAL",
          value: { stringValue: fromDateStr },
        },
      },
      limit: 500,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Authorization": "Bearer " + accessToken, "Content-Type": "application/json" },
    body: JSON.stringify(structuredQuery),
  });
  if (!res.ok) {
    console.error("[CRON] runQuery falhou:", res.status, (await res.text()).slice(0, 300));
    return [];
  }
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
  const projectId = env.FIREBASE_PROJECT_ID;
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, { headers: { "Authorization": "Bearer " + accessToken } });
  if (!res.ok) return null;
  const doc = await res.json();
  return decodeFields(doc.fields);
}

/* Converte os "fields" do formato REST do Firestore pra objeto JS simples. */
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

/* ───────────────────────── EXACTLY-ONCE (KV opcional) ───────────────────────── */
async function alreadySent(env, key) {
  try { if (env.SENT_REMINDERS) return (await env.SENT_REMINDERS.get(key)) !== null; } catch (_) {}
  return false;
}
async function markSent(env, key) {
  try { if (env.SENT_REMINDERS) await env.SENT_REMINDERS.put(key, "1", { expirationTtl: 7200 }); } catch (_) {}
}

/* ───────────────────────── OAUTH (service account → access token) ───────────────────────── */
let _tokenCache = { value: null, exp: 0, scope: "" };
async function getAccessToken(env, scope) {
  const nowSec = Math.floor(Date.now() / 1000);
  if (_tokenCache.value && _tokenCache.exp - 60 > nowSec && _tokenCache.scope === scope) {
    return _tokenCache.value;
  }
  const sa = parseServiceAccount(env);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const signature = await rs256Sign(unsigned, sa.private_key);
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

function parseServiceAccount(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT ausente");
  let sa;
  try { sa = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch (e) { throw new Error("FIREBASE_SERVICE_ACCOUNT não é JSON válido"); }
  if (!sa.client_email || !sa.private_key) throw new Error("service account sem client_email/private_key");
  return sa;
}

async function rs256Sign(data, pem) {
  const key = await importPrivateKey(pem);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(data),
  );
  return b64url(new Uint8Array(sig));
}

async function importPrivateKey(pem) {
  const clean = pem.replace(/\\n/g, "\n")
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

/* ───────────────────────── 3. IMAGEKIT AUTH ───────────────────────── */
async function handleImageKitAuth(request, env) {
  const privateKey = env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) return json({ error: "IMAGEKIT_PRIVATE_KEY ausente" }, 500, env);
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 2400; /* +40 min */
  const signature = await hmacSha1Hex(privateKey, token + expire);
  return json({ token, expire, signature }, 200, env);
}

async function hmacSha1Hex(key, msg) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ───────────────────────── HELPERS ───────────────────────── */
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": (env && env.ALLOW_ORIGIN) || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(env)),
  });
}
/* FCM data só aceita strings — normaliza tudo pra string. */
function stringifyData(data) {
  const out = {};
  for (const k of Object.keys(data || {})) {
    const v = data[k];
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : String(v);
  }
  return out;
}
function isoDate(ms) {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}
function b64url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
