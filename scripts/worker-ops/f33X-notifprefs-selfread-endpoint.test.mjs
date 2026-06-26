#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — SELF-READ endpoint notifPrefs (getNotifPrefs).
 * Parte A: extrai a lógica REAL de functions/index.js (notifPrefsSecret/
 *   notifVerifyToken/notifDb/notifProjectPrefsOut/handleNotifPrefsRead) e roda
 *   com crypto real + admin.firestore() MOCKADO + rate-limiter STUBADO, provando:
 *     1) token válido => 200 + prefs allowlisted;
 *     2) sem token => 401;  3) sig inválida => 401;  4) expirado => 401;  5) sem uid => 401;
 *     6) uid divergente (defensivo) => 403;
 *     7) doc ausente => 200 exists:false prefs:{};
 *     8) campos proibidos no doc (uid/fcmTokens/phone/pass/salt/email/admin/role) NÃO aparecem;
 *     9) task_assigned=false retorna false;  10-12) sem uid/fcmTokens/phone na resposta;
 *    13) POST => 405;  14) sem NOTIF_PREFS_SECRET => 503;  15) 429 quando rate-limited.
 *   + provas de fonte: lê SÓ notifPrefs (não users), independe de ENABLE_NOTIF_PREFS,
 *     projeção allowlist (não espalha doc cru), Cache-Control no-store, não loga token/segredo.
 * Parte B: extrai getNotifPrefsClient do bloco __NPC__ do index.html (fetch injetado):
 *     16) usa GET + Authorization Bearer;  17) não vaza token em erro;
 *     18/19) 200 exists true/false;  20) não-200 => {ok:false,status};  21) sem token => throw.
 * Puro/offline: NÃO require() o módulo, NÃO toca produção/Firestore real, NÃO envia, sem segredo real.
 * Rodar: node scripts/worker-ops/f33X-notifprefs-selfread-endpoint.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");
const HTML = fs.readFileSync(path.resolve(__dirname, "..", "..", "index.html"), "utf8");

function grab(n) {
  let a = SRC.indexOf("async function " + n + "(");
  if (a < 0) a = SRC.indexOf("function " + n + "(");
  if (a < 0) throw new Error("nao encontrei: " + n);
  let d = 0;
  for (let j = SRC.indexOf("{", a); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return SRC.slice(a, j + 1); }
  }
  throw new Error("sem fim: " + n);
}

const NAMES = ["notifPrefsSecret", "notifVerifyToken", "notifDb", "notifProjectPrefsOut", "handleNotifPrefsRead"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

// Mock admin.firestore() (somente get) + rate-limiter stubado (controlável) + logger no-op.
const PRELUDE = `
  var __store = {}; var __rlBlocked = false; var __rlCalls = [];
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = (__store[c] || {})[id]; return { exists: !!d, data: function () { return d || null; } }; }
    }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  var logger = { warn: function () {}, info: function () {}, error: function () {} };
  function notifRlBlocked(k, now) { __rlCalls.push(["blocked", k]); return __rlBlocked; }
  function notifRlFail(k, now) { __rlCalls.push(["fail", k]); }
  function notifRlClear(k) { __rlCalls.push(["clear", k]); }
`;

const make = new Function("crypto", PRELUDE + BODY + `
  ; return {
    handleNotifPrefsRead: handleNotifPrefsRead, notifProjectPrefsOut: notifProjectPrefsOut,
    _seed: function (id, d) { if (!__store.notifPrefs) __store.notifPrefs = {}; __store.notifPrefs[id] = d; },
    _setBlocked: function (v) { __rlBlocked = !!v; }, _rlCalls: function () { return __rlCalls; }
  };
`);
const api = make(crypto);

const SECRET = "S3cr3t-B17E";
const setSecret = (on) => { if (on) process.env.NOTIF_PREFS_SECRET = SECRET; else delete process.env.NOTIF_PREFS_SECRET; };
function tok(claims) {
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const s = crypto.createHmac("sha256", SECRET).update(p).digest().toString("base64url");
  return "Bearer " + p + "." + s;
}
const NOW = 1781800000000;
const get = (authHeader, extra) => api.handleNotifPrefsRead(Object.assign({ method: "GET", authHeader, now: NOW }, extra || {}));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  // Seed: doc do u1 com TODOS os campos proibidos presentes (devem ser removidos na saída).
  api._seed("u1", {
    enabled: true,
    byEvent: { task_assigned: false, event_assigned: true, chat_message: true },
    byPlatform: { android: true },
    quietHours: null, updatedAt: NOW,
    uid: "u1", fcmTokens: ["tkn-x"], fcmTokenMeta: { a: 1 }, clientPushSubs: [{ x: 1 }],
    phone: "5511999999999", pass: "s2:deadbeef", salt: "abc", email: "u1@x.com", admin: true, role: "tester", evil: "y"
  });

  /* ===== provas de fonte ===== */
  const READ = grab("handleNotifPrefsRead");
  const WRAP = SRC.slice(SRC.indexOf("exports.getNotifPrefs = onRequest"), SRC.indexOf("exports._handleNotifPrefsRead"));
  ok("[src] getNotifPrefs usa onRequest", /exports\.getNotifPrefs = onRequest\(/.test(SRC));
  ok("[src] Cache-Control no-store no wrapper", /Cache-Control".*no-store|set\("Cache-Control", "no-store"\)/.test(WRAP));
  ok("[src] handler lê SOMENTE notifPrefs (não users)", /collection\("notifPrefs"\)/.test(READ) && !/collection\("users"\)/.test(READ));
  ok("[src] handler independe de ENABLE_NOTIF_PREFS (sem notifFlag/ENABLE_NOTIF_PREFS)", !/notifFlag|ENABLE_NOTIF_PREFS/.test(READ));
  ok("[src] projeção allowlist (não espalha doc cru: sem spread/Object.assign do doc)", !/\.\.\.(snap|d|data)\b/.test(grab("notifProjectPrefsOut")) && !/Object\.assign\([^)]*data/.test(grab("notifProjectPrefsOut")));
  ok("[src] NÃO loga Authorization/Bearer/token/segredo/phone/fcmTokens", !/logger\.(info|warn|error)\([^)]*(authorization|Authorization|Bearer|\btoken\b|secret|segredo|phone|fcmTokens)/.test(READ + WRAP));

  /* ===== 1) token válido => 200 + prefs allowlisted ===== */
  setSecret(true); api._setBlocked(false);
  const r1 = await get(tok({ uid: "u1", exp: NOW + 60000 }));
  ok("1 token válido => 200 exists:true", r1.status === 200 && r1.json.ok === true && r1.json.exists === true);
  ok("9 task_assigned=false retorna false", r1.json.prefs && r1.json.prefs.byEvent && r1.json.prefs.byEvent.task_assigned === false);
  ok("1b demais prefs allowlisted presentes", r1.json.prefs.enabled === true && r1.json.prefs.byPlatform.android === true && r1.json.prefs.quietHours === null && r1.json.prefs.updatedAt === NOW);

  /* ===== 8/10/11/12) campos proibidos removidos ===== */
  const keys = Object.keys(r1.json.prefs);
  const banned = ["uid", "fcmTokens", "fcmTokenMeta", "clientPushSubs", "phone", "pass", "salt", "email", "admin", "role", "evil"];
  ok("8 nenhum campo proibido na resposta", banned.every((b) => !(b in r1.json.prefs)));
  ok("10 resposta sem uid", !("uid" in r1.json.prefs) && !("uid" in r1.json));
  ok("11 resposta sem fcmTokens", !("fcmTokens" in r1.json.prefs));
  ok("12 resposta sem phone", !("phone" in r1.json.prefs));
  ok("8b allowlist exata", keys.sort().join(",") === "byEvent,byPlatform,enabled,quietHours,updatedAt");

  /* ===== 2-5) auth negativa ===== */
  ok("2 sem token => 401", (await get("")).status === 401);
  ok("3 sig inválida => 401", (await get("Bearer " + Buffer.from('{"uid":"u1"}').toString("base64url") + ".AAAA")).status === 401);
  ok("4 expirado => 401", (await get(tok({ uid: "u1", exp: NOW - 1 }))).status === 401);
  ok("5 sem uid => 401", (await get(tok({ admin: false, exp: NOW + 60000 }))).status === 401);

  /* ===== 6) uid divergente defensivo => 403 ===== */
  ok("6 uid divergente (query) => 403", (await get(tok({ uid: "u1", exp: NOW + 60000 }), { uid: "u2" })).status === 403);
  ok("6b uid igual ao token => OK (200)", (await get(tok({ uid: "u1", exp: NOW + 60000 }), { uid: "u1" })).status === 200);

  /* ===== 7) doc ausente => exists:false ===== */
  const r7 = await get(tok({ uid: "u404", exp: NOW + 60000 }));
  ok("7 doc ausente => 200 exists:false prefs:{}", r7.status === 200 && r7.json.exists === false && JSON.stringify(r7.json.prefs) === "{}");

  /* ===== 13) método ===== */
  ok("13 POST => 405", (await api.handleNotifPrefsRead({ method: "POST", authHeader: tok({ uid: "u1", exp: NOW + 60000 }), now: NOW })).status === 405);

  /* ===== 14) sem segredo => 503 ===== */
  setSecret(false);
  ok("14 sem NOTIF_PREFS_SECRET => 503", (await get(tok({ uid: "u1", exp: NOW + 60000 }))).status === 503);
  setSecret(true);

  /* ===== 15) rate-limited => 429 ===== */
  api._setBlocked(true);
  ok("15 rate-limited => 429", (await get(tok({ uid: "u1", exp: NOW + 60000 }), { ip: "1.2.3.4" })).status === 429);
  api._setBlocked(false);

  /* ===== projeção pura: doc sem byEvent/byPlatform ===== */
  ok("proj: doc {} => {}", JSON.stringify(api.notifProjectPrefsOut({})) === "{}");
  ok("proj: enabled não-boolean ignorado", !("enabled" in api.notifProjectPrefsOut({ enabled: "yes" })));
  ok("proj: updatedAt Timestamp => millis", api.notifProjectPrefsOut({ updatedAt: { toMillis: () => 123 } }).updatedAt === 123);

  /* ===== Parte B: getNotifPrefsClient (UI, fetch injetado) ===== */
  const m = HTML.match(/\/\* __NPC_START__[\s\S]*?\/\* __NPC_END__ \*\//);
  ok("[ui] bloco __NPC__ presente", !!m);
  if (m) {
    const uiapi = (function () { const __e = {}; const NOTIF_GET_URL = "https://example/get"; eval(m[0] + "\n;Object.assign(__e,{getNotifPrefsClient});"); return __e; })();
    let cap = null;
    const mkFetch = (status, body) => async (url, init) => { cap = { url, init }; return { status, json: async () => body }; };
    const r16 = await uiapi.getNotifPrefsClient({ token: "TKN", url: "x", fetchImpl: mkFetch(200, { ok: true, exists: true, prefs: { enabled: true, byEvent: { task_assigned: false } } }) });
    ok("16 client usa GET + Authorization Bearer", cap && cap.init && cap.init.method === "GET" && cap.init.headers.authorization === "Bearer TKN");
    ok("18 200 exists:true => {ok,exists,prefs}", r16.ok === true && r16.exists === true && r16.prefs.byEvent.task_assigned === false);
    const r19 = await uiapi.getNotifPrefsClient({ token: "TKN", url: "x", fetchImpl: mkFetch(200, { ok: true, exists: false, prefs: {} }) });
    ok("19 200 exists:false => prefs {}", r19.ok === true && r19.exists === false && JSON.stringify(r19.prefs) === "{}");
    const r20 = await uiapi.getNotifPrefsClient({ token: "TKN", url: "x", fetchImpl: mkFetch(401, { ok: false, error: "expired" }) });
    ok("20 não-200 => {ok:false,status} sem token", r20.ok === false && r20.status === 401 && !("token" in r20));
    let th = false; try { await uiapi.getNotifPrefsClient({ url: "x", fetchImpl: mkFetch(200, {}) }); } catch (e) { th = /missing_token/.test(e.message); }
    ok("21 sem token => throw missing_token", th);
    ok("17 client nunca devolve token", !("token" in r16) && !("token" in r19) && !("token" in r20));
  }

  console.log("\n========= F3.3.20-B1.7-E — getNotifPrefs (self-read) =========");
  console.log("  401 sem/má/expirado/sem-uid · 403 uid divergente · 405 POST · 503 sem segredo · 429 rate-limit");
  console.log("  lê SÓ notifPrefs/{token.uid}; allowlist (uid/fcmTokens/phone/... removidos); doc ausente => exists:false");
  console.log("  client UI: GET + Bearer; nunca vaza token");
  console.log("=============================================================\n");
  console.log("F3.3.20-B1.7-E notifprefs-selfread: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
