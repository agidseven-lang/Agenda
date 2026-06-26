#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — SLICE 2: getUserContact (leitura AUTENTICADA de contato).
 * Extrai a logica REAL de functions/index.js (notifVerifyToken/notifSignToken/
 * authVerifySessionToken/authSessionSecret, notifRlBlocked/Fail/Clear, notifMaskUid,
 * notifDb, handleGetUserContact) com crypto real + admin.firestore() MOCKADO (store de
 * users; captura de escritas e logs). Prova:
 *   - self GET/POST => 200; admin->other => 200; nao-admin->other => 403;
 *   - token ausente/invalido/expirado/scope-errado/sem-scope/sem-exp => 401;
 *   - uid ausente/vazio => 400; metodo invalido => 405; OPTIONS 204 (wrapper, fonte);
 *   - inexistente (admin/self) => 404; rate-limit => 429;
 *   - projecao SO contact{phone,email}; sem pass/salt/fcmTokens/fcmTokenMeta/doc cru/
 *     admin/role/status; logs sem token/PII; usa authVerifySessionToken; zero write;
 *   - loginUser e notifVerifyToken preservados (provas de fonte).
 * Puro/offline: NAO require() o modulo; NAO toca producao; NAO deploya.
 * Rodar: node scripts/worker-ops/f33AD-auth-get-user-contact.test.mjs
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

const NAMES = ["notifVerifyToken", "notifSignToken", "authVerifySessionToken", "authSessionSecret",
  "notifMaskUid", "notifRlBlocked", "notifRlFail", "notifRlClear", "notifDb", "handleGetUserContact"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

const PRELUDE = `
  var NOTIF_RL_MAX = 5, NOTIF_RL_WINDOW_MS = 5 * 60 * 1000, NOTIF_RL_BLOCK_MS = 15 * 60 * 1000;
  var __notifRlState = new Map();
  var __users = {}; var __writes = []; var __logs = [];
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = (c === "users") ? __users[id] : undefined; return { exists: !!d, data: function () { return d || null; } }; },
      set: async function () { __writes.push({ coll: c, id: id, op: "set" }); return {}; },
      update: async function () { __writes.push({ coll: c, id: id, op: "update" }); return {}; }
    }; },
    add: async function () { __writes.push({ coll: c, op: "add" }); return { id: "x" }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  var logger = {
    info: function () { __logs.push(Array.prototype.slice.call(arguments)); },
    warn: function () { __logs.push(Array.prototype.slice.call(arguments)); },
    error: function () { __logs.push(Array.prototype.slice.call(arguments)); }
  };
`;

const make = new Function("crypto", PRELUDE + BODY + `
  ; return {
    handleGetUserContact: handleGetUserContact, notifSignToken: notifSignToken,
    _setUser: function (id, u) { __users[id] = u; },
    _resetRl: function () { __notifRlState = new Map(); },
    _writes: function () { return __writes; }, _logs: function () { return __logs; }
  };
`);
const api = make(crypto);

const SECRET = "S3ss-AD";
const WRONG = "outro-AD";
const NOW = 1781800000000;
const DAY = 24 * 60 * 60 * 1000;
process.env.AUTH_SESSION_SECRET = SECRET;
const tok = (claims, secret) => "Bearer " + api.notifSignToken(claims, secret || SECRET);
const session = (uid, admin, role, extra) => Object.assign({ uid: uid, admin: !!admin, role: role || "", scope: "session", iat: NOW, exp: NOW + DAY }, extra || {});
const call = (method, uid, authHeader, ip) => { api._resetRl(); return api.handleGetUserContact({ method, uid, authHeader, ip: (ip || "1.1.1.1"), now: NOW }); };

api._setUser("uSelf",  { name: "Self",  phone: "11 90000-1111", email: "self@idseven.test",  pass: "s2:" + crypto.createHash("sha256").update("s|p").digest("hex"), salt: "s", fcmTokens: ["TKsecret"], fcmTokenMeta: { a: 1 }, admin: false, role: "designer", status: "ativo", photo: "ph", color: "#f00" });
api._setUser("uAdmin", { name: "Adm",   phone: "11 90000-2222", email: "adm@idseven.test",   pass: "s2:x", salt: "s2", admin: true, role: "gestor", status: "ativo" });
api._setUser("uOther", { name: "Other", phone: "11 90000-3333", email: "other@idseven.test", pass: "s2:y", salt: "s3", fcmTokens: ["TK2"], admin: false, role: "social media", status: "ativo" });

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  /* ===== PROVAS DE FONTE ===== */
  const H = grab("handleGetUserContact");
  const WRAP = SRC.slice(SRC.indexOf("exports.getUserContact = onRequest"), SRC.indexOf("exports._handleGetUserContact"));
  ok("27 usa authVerifySessionToken", /authVerifySessionToken\(ctx\.authHeader, authSessionSecret\(\), now\)/.test(H));
  ok("28 nao escreve Firestore (sem .set/.add/.update/.delete no handler)", !/\.set\(|\.add\(|\.update\(|\.delete\(/.test(H) && /\.doc\(targetUid\)\.get\(\)/.test(H));
  ok("14 wrapper OPTIONS => 204", /req\.method === "OPTIONS"[\s\S]*res\.status\(204\)/.test(WRAP));
  ok("[src] wrapper secrets:[AUTH_SESSION_SECRET] + cors", /secrets: \[AUTH_SESSION_SECRET\][\s\S]*cors: NOTIF_CORS_ORIGINS/.test(WRAP));
  ok("[src] projecao so contact{phone,email}", /contact: \{ phone:[\s\S]*email:/.test(H) && !/pass|fcmTokens|fcmTokenMeta/.test(H));
  ok("29 loginUser inalterado (presente + scope session)", /exports\.loginUser = onRequest/.test(SRC) && /scope: "session"/.test(SRC));
  ok("30 notifVerifyToken inalterado (sem checagem de scope)", !/scope/.test(grab("notifVerifyToken")));

  /* ===== 1-3) autorizacao OK ===== */
  const r1 = await call("GET", "uSelf", tok(session("uSelf", false, "designer")));
  ok("1 self GET => 200", r1.status === 200 && r1.json.ok === true && r1.json.uid === "uSelf");
  const r2 = await call("POST", "uSelf", tok(session("uSelf", false, "designer")));
  ok("2 self POST => 200", r2.status === 200 && r2.json.contact.email === "self@idseven.test");
  const r3 = await call("GET", "uOther", tok(session("uAdmin", true, "gestor")));
  ok("3 admin -> other => 200", r3.status === 200 && r3.json.uid === "uOther" && r3.json.contact.phone === "11 90000-3333");

  /* ===== 4) forbidden ===== */
  const r4 = await call("GET", "uOther", tok(session("uSelf", false, "designer")));
  ok("4 nao-admin -> other => 403", r4.status === 403 && r4.json.error === "forbidden");

  /* ===== 5-10) sessao invalida => 401 ===== */
  ok("5 token ausente => 401", (await call("GET", "uSelf", "")).status === 401);
  ok("6 token invalido => 401", (await call("GET", "uSelf", "Bearer lixo.naovale")).status === 401);
  ok("7 token expirado => 401", (await call("GET", "uSelf", tok(session("uSelf", false, "", { exp: NOW - 1 })))).status === 401);
  ok("8 scope errado => 401", (await call("GET", "uSelf", tok({ uid: "uSelf", admin: false, scope: "notifPrefs:write", iat: NOW, exp: NOW + DAY }))).status === 401);
  ok("9 sem scope => 401", (await call("GET", "uSelf", tok({ uid: "uSelf", admin: false, iat: NOW, exp: NOW + DAY }))).status === 401);
  ok("10 sem exp => 401", (await call("GET", "uSelf", tok({ uid: "uSelf", admin: false, scope: "session", iat: NOW }))).status === 401);
  ok("[extra] secret errado => 401", (await call("GET", "uSelf", tok(session("uSelf", false), WRONG))).status === 401);

  /* ===== 11-13) uid / metodo ===== */
  ok("11 uid ausente => 400", (await call("GET", "", tok(session("uSelf", false)))).status === 400);
  ok("12 uid vazio (espacos) => 400", (await call("GET", "   ", tok(session("uSelf", false)))).status === 400);
  ok("13 metodo invalido => 405", (await call("PUT", "uSelf", tok(session("uSelf", false)))).status === 405);

  /* ===== 15-16) inexistente => 404 ===== */
  ok("15 inexistente (admin) => 404", (await call("GET", "uGhost", tok(session("uAdmin", true)))).status === 404);
  ok("16 inexistente (self) => 404", (await call("GET", "uGone", tok(session("uGone", false)))).status === 404);

  /* ===== 17) rate-limit => 429 (5 forbidden + 6a) ===== */
  api._resetRl();
  const sForbid = tok(session("uSelf", false));
  let st = [];
  for (let i = 0; i < 6; i++) st.push((await api.handleGetUserContact({ method: "GET", uid: "uOther", authHeader: sForbid, ip: "9.9.9.9", now: NOW })).status);
  ok("17 rate-limit: 5x 403 e 6a => 429", st.slice(0, 5).every((s) => s === 403) && st[5] === 429);

  /* ===== 18-24) projecao segura ===== */
  const u = r1.json.contact;
  const respStr = JSON.stringify(r1.json);
  ok("18 contact tem phone+email", typeof u.phone === "string" && typeof u.email === "string" && Object.keys(u).sort().join(",") === "email,phone");
  ok("19 sem pass", respStr.indexOf("s2:") < 0 && !("pass" in u));
  ok("20 sem salt", respStr.indexOf('"salt"') < 0 && !("salt" in u));
  ok("21 sem fcmTokens", respStr.indexOf("TKsecret") < 0 && !("fcmTokens" in u));
  ok("22 sem fcmTokenMeta", respStr.indexOf("fcmTokenMeta") < 0);
  ok("23 sem doc inteiro (sem name/createdAt/etc.)", respStr.indexOf('"name"') < 0 && respStr.indexOf("photo") < 0);
  ok("24 sem admin/role/status na resposta", respStr.indexOf('"admin"') < 0 && respStr.indexOf('"role"') < 0 && respStr.indexOf('"status"') < 0);

  /* ===== 25-26) logs sem token / sem PII ===== */
  const logStr = JSON.stringify(api._logs());
  ok("25 logs sem token", logStr.indexOf("Bearer") < 0 && logStr.indexOf(sForbid.slice(7)) < 0);
  ok("26 logs sem phone/email", logStr.indexOf("self@idseven.test") < 0 && logStr.indexOf("90000-1111") < 0);

  /* ===== 28b) zero escrita Firestore (runtime) ===== */
  ok("28b zero escrita Firestore", api._writes().length === 0);

  console.log("\n========= F3.3.20-B1.7-E — getUserContact (handler real) =========");
  console.log("  self/admin 200 · nao-admin 403 · 401 sessao invalida · 400 uid · 405 metodo · 404 · 429 rate-limit");
  console.log("  projecao SO contact{phone,email}; sem pass/salt/fcmTokens/doc cru; logs sem token/PII; zero write");
  console.log("  authVerifySessionToken usado; loginUser/notifVerifyToken preservados");
  console.log("==================================================================");
  console.log("F3.3.20-B1.7-E auth-get-user-contact: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
