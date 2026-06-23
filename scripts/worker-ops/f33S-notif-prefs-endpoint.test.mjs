#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.2 — ENDPOINT server-side AUTENTICADO p/ notifPrefs/{uid}.
 * Extrai a lógica REAL de functions/index.js (notifPrefsSecret/notifVerifyToken/
 * notifValidatePrefs/handleNotifPrefsUpdate/notifDb/getNotifPrefs/shouldNotifyByPrefs)
 * e a roda com crypto real (node:crypto) + admin.firestore() MOCKADO, provando:
 *   1) rejeita request sem autenticacao (401);
 *   2) rejeita payload invalido (400);
 *   3) aceita payload valido (200);
 *   4) normaliza prefs antes de gravar (updatedAt server-side; só campos conhecidos);
 *   5) grava em notifPrefs/{uid} no mock;
 *   6) NAO grava em users/{uid};
 *   7) NAO altera fcmTokens;  8) NAO altera fcmTokenMeta;  9) NAO altera clientPushSubs;
 *  10) impede alterar outro uid (403) salvo admin;
 *  11) erro de gravacao retorna erro controlado (500, sem throw);
 *  12) flags OFF mantem comportamento atual (pref gravada NAO afeta envio);
 *  13) helpers B1.1-A continuam ok (getNotifPrefs/shouldNotifyByPrefs);
 *  14) notificacoes atuais preservadas (prova de fonte: trigger/tokens intactos).
 * Puro/offline: NAO require() o modulo (sem deps), NAO toca producao, NAO envia.
 * Rodar: /opt/node22/bin/node scripts/worker-ops/f33S-notif-prefs-endpoint.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

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

const NAMES = ["notifFlag", "notifDb", "getNotifPrefs", "shouldNotifyByPrefs",
  "notifPrefsSecret", "notifVerifyToken", "notifValidatePrefs", "handleNotifPrefsUpdate"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

// Mock admin.firestore(): store por colecao + captura de set() + modo de erro.
const PRELUDE = `
  var __store = {}; var __setCalls = []; var __failSet = false;
  function _col(c) { return {
    doc: function (id) { return {
      set: async function (data, opts) {
        if (__failSet) throw new Error("set boom");
        __setCalls.push({ coll: c, id: id, data: data, opts: opts });
        if (!__store[c]) __store[c] = {};
        __store[c][id] = (opts && opts.merge && __store[c][id]) ? Object.assign({}, __store[c][id], data) : data;
        return {};
      },
      get: async function () { var d = (__store[c] || {})[id]; return { exists: !!d, data: function () { return d || null; } }; }
    }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  var logger = { warn: function () {}, info: function () {}, error: function () {} };
`;

const make = new Function("crypto", PRELUDE + BODY + `
  ; return {
    handleNotifPrefsUpdate: handleNotifPrefsUpdate,
    getNotifPrefs: getNotifPrefs, shouldNotifyByPrefs: shouldNotifyByPrefs,
    notifValidatePrefs: notifValidatePrefs,
    _setCalls: function () { return __setCalls; }, _store: function () { return __store; },
    _failSet: function (v) { __failSet = !!v; }, _reset: function () { __setCalls.length = 0; }
  };
`);
const api = make(crypto);

// Assinador local que casa com notifVerifyToken (HMAC-SHA256 sobre o payloadB64url).
const SECRET = "S3cr3t-B12";
function tok(claims) {
  const p = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const s = crypto.createHmac("sha256", SECRET).update(p).digest().toString("base64url");
  return "Bearer " + p + "." + s;
}
const setSecret = (on) => { if (on) process.env.NOTIF_PREFS_SECRET = SECRET; else delete process.env.NOTIF_PREFS_SECRET; };
const NOW = 1781800000000;
const post = (authHeader, body) => api.handleNotifPrefsUpdate({ method: "POST", authHeader, body, now: NOW });

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  /* ===== 0) PROVAS DE FONTE (no-touch / onRequest / dormencia) ===== */
  const B2 = SRC.slice(SRC.indexOf("F3.3.20-B1.2 — ENDPOINT"));
  const CODE2 = SRC.slice(SRC.indexOf("function notifPrefsSecret"));
  ok("[src] endpoint usa onRequest + token assinado (sem req.auth/context.auth no codigo)",
    /onRequest\(/.test(B2) && /notifVerifyToken\(/.test(CODE2) && !/\breq\.auth\b/.test(CODE2) && !/context\.auth/.test(CODE2));
  ok("[src] gate de dormencia: NOTIF_PREFS_SECRET ausente => 503", /code: 503, error: "endpoint_disabled"/.test(CODE2) && /notifPrefsSecret\(\)/.test(CODE2));
  ok("[src#5] grava SOMENTE em notifPrefs/{uid}", /collection\("notifPrefs"\)\.doc\(String\(targetUid\)\)\.set\(/.test(CODE2));
  ok("[src#6] endpoint NAO escreve em users", !/collection\("users"\)/.test(CODE2));
  ok("[src#7-9] endpoint NAO toca fcmTokens/fcmTokenMeta/clientPushSubs/deviceId", !/fcmTokens|fcmTokenMeta|clientPushSubs|deviceId/.test(CODE2));
  ok("[src#14] trigger notifyResponsible NAO chama o endpoint", (() => { const f = grab("notifyResponsible"); return !/handleNotifPrefsUpdate|updateNotifPrefs|notifVerifyToken/.test(f); })());
  ok("[src] dedupeTokensByDevice (deviceId) intacto", /function dedupeTokensByDevice/.test(SRC) && /m\.deviceId/.test(SRC));

  /* ===== 1) rejeita sem autenticacao ===== */
  setSecret(true); api._reset();
  ok("1a sem header => 401", (await post("", { enabled: true })).status === 401);
  ok("1b token malformado => 401", (await post("Bearer abc", { enabled: true })).status === 401);
  ok("1c assinatura invalida => 401", (await post("Bearer " + Buffer.from('{"uid":"u1"}').toString("base64url") + ".AAAA", { enabled: true })).status === 401);
  ok("1d token expirado => 401", (await post(tok({ uid: "u1", exp: NOW - 1 }), { enabled: true })).status === 401);
  ok("1e sem segredo no ambiente => 503 (dormente)", (setSecret(false), (await post(tok({ uid: "u1" }), { enabled: true })).status === 503));
  setSecret(true);

  /* ===== 2) rejeita payload invalido ===== */
  ok("2a enabled nao-boolean => 400", (await post(tok({ uid: "u1" }), { enabled: "yes" })).status === 400);
  ok("2b campo desconhecido => 400", (await post(tok({ uid: "u1" }), { foo: 1 })).status === 400);
  ok("2c update vazio => 400", (await post(tok({ uid: "u1" }), {})).status === 400);
  ok("2d body nao-objeto => 400", (await post(tok({ uid: "u1" }), 123)).status === 400);
  ok("2e byEvent invalido => 400", (await post(tok({ uid: "u1" }), { byEvent: { sla: "x" } })).status === 400);
  ok("2f quietHours invalido => 400", (await post(tok({ uid: "u1" }), { quietHours: { start: "9h", end: "23:00" } })).status === 400);

  /* ===== 3) aceita payload valido ===== */
  api._reset();
  const r3 = await post(tok({ uid: "u1" }), { enabled: true, byEvent: { sla_warning: false }, byPlatform: { desktop: true }, quietHours: { start: "22:00", end: "07:00" } });
  ok("3 payload valido => 200", r3.status === 200 && r3.json.ok === true && r3.json.uid === "u1");

  /* ===== 4) normaliza antes de gravar ===== */
  const w = api._setCalls()[0];
  ok("4a updatedAt server-side (= now)", w && w.data.updatedAt === NOW);
  ok("4b updatedAt do cliente e REJEITADO (campo server-side only => 400)", (await post(tok({ uid: "u1" }), { enabled: false, updatedAt: 999 })).status === 400);
  ok("4c só campos conhecidos persistidos", Object.keys(w.data).sort().join(",") === "byEvent,byPlatform,enabled,quietHours,updatedAt");

  /* ===== 5) grava em notifPrefs/{uid} ===== */
  api._reset(); await post(tok({ uid: "u9" }), { enabled: true });
  const c5 = api._setCalls()[0];
  ok("5 grava notifPrefs/u9 com merge", c5.coll === "notifPrefs" && c5.id === "u9" && c5.opts && c5.opts.merge === true);

  /* ===== 6-9) nao toca users/fcmTokens/fcmTokenMeta/clientPushSubs ===== */
  ok("6 nenhuma escrita em users", api._setCalls().every((x) => x.coll !== "users"));
  ok("7-9 nenhuma escrita fora de notifPrefs", api._setCalls().every((x) => x.coll === "notifPrefs"));
  ok("7-9b payload gravado nao tem fcmTokens/fcmTokenMeta/clientPushSubs", api._setCalls().every((x) => !("fcmTokens" in x.data) && !("fcmTokenMeta" in x.data) && !("clientPushSubs" in x.data)));

  /* ===== 10) impede alterar outro uid (salvo admin) ===== */
  ok("10a uid!=alvo e nao-admin => 403", (await post(tok({ uid: "u1", admin: false }), { uid: "u2", enabled: true })).status === 403);
  api._reset();
  const r10 = await post(tok({ uid: "admin1", admin: true }), { uid: "u2", enabled: true });
  ok("10b admin pode alterar outro uid => 200 grava notifPrefs/u2", r10.status === 200 && api._setCalls()[0].coll === "notifPrefs" && api._setCalls()[0].id === "u2");

  /* ===== 11) erro de gravacao => 500 controlado (sem throw) ===== */
  api._failSet(true);
  let threw11 = false, r11 = null;
  try { r11 = await post(tok({ uid: "u1" }), { enabled: true }); } catch (_) { threw11 = true; }
  ok("11 erro de gravacao => 500 sem throw", threw11 === false && r11 && r11.status === 500 && r11.json.error === "write_failed");
  api._failSet(false);

  /* ===== 12) flags OFF mantem comportamento atual (pref gravada NAO afeta envio) ===== */
  api._reset(); await post(tok({ uid: "uOff" }), { enabled: false }); // grava enabled:false
  process.env.ENABLE_NOTIF_PREFS = "false";
  ok("12a flag OFF: shouldNotifyByPrefs => true mesmo com enabled:false gravado", (await api.shouldNotifyByPrefs("uOff", "assign", "android")) === true);
  process.env.ENABLE_NOTIF_PREFS = "true";
  ok("12b flag ON: agora respeita o enabled:false gravado pelo endpoint => false", (await api.shouldNotifyByPrefs("uOff", "assign", "android")) === false);
  process.env.ENABLE_NOTIF_PREFS = "false";

  /* ===== 13) helpers B1.1-A continuam ok ===== */
  process.env.ENABLE_NOTIF_PREFS = "true";
  ok("13a getNotifPrefs le o doc gravado pelo endpoint", (await api.getNotifPrefs("u9")) && (await api.getNotifPrefs("u9")).enabled === true);
  ok("13b shouldNotifyByPrefs sem doc => true", (await api.shouldNotifyByPrefs("inexistente", "assign", "android")) === true);
  process.env.ENABLE_NOTIF_PREFS = "false";

  /* ===== matriz ===== */
  console.log("\n========= F3.3.20-B1.2 — endpoint notifPrefs (handler real) =========");
  console.log("  sem auth/expirado/sig invalida => 401 · sem segredo => 503");
  console.log("  payload invalido/desconhecido/vazio => 400 · valido => 200");
  console.log("  grava SOMENTE notifPrefs/{uid} (merge); users/fcmTokens/etc intocados");
  console.log("  outro uid => 403 (admin pode) · erro grava => 500 controlado");
  console.log("  flag OFF: pref gravada NAO afeta envio (dormente); flag ON: respeita");
  console.log("=====================================================================\n");

  console.log("F3.3.20-B1.2 notif-prefs-endpoint: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
