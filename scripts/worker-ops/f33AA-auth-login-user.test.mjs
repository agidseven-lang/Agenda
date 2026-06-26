#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — LOGIN server-side (Slice 1): exports.loginUser.
 * Extrai a logica REAL de functions/index.js (authSessionSecret/notifDb/
 * notifMaskUid/notifDjb2/notifTimingSafeEq/notifVerifyPassword/notifSignToken/
 * notifRlBlocked/Fail/Clear, notifVerifyToken, authUserPublicOut, handleLoginUser) com crypto
 * real + admin.firestore() MOCKADO (store de users + leitura de colecao inteira;
 * captura de escritas e logs). Prova, sem rede / sem Firestore / sem segredo real
 * / sem usuario real:
 *   1-4) login OK por email (case/trim) e por telefone (digitos/formatado);
 *   5-8) senha errada / inexistente / anti-enumeracao identica / colisao => 401;
 *   9-10) usuario inativo (pendente/removido/excluido) + senha correta => 403;
 *  11-16) payload invalido (body/identifier/password/tipos/oversized) => 400;
 *  17) metodo != POST => 405; 18) rate-limit (6a tentativa) => 429; 19) sem
 *  AUTH_SESSION_SECRET => 503; 20-22) token de sessao: claims {uid,admin,role,
 *  scope:"session",iat,exp}, TTL 24h (ms), assinatura HMAC valida com
 *  AUTH_SESSION_SECRET (e rejeitada com segredo errado); 23-28) projecao segura
 *  (so 7 campos; sem pass/salt/fcmTokens/phone/email); 29) admin; 30) zero
 *  escrita Firestore; 31) sem vazar senha/token/identifier em log.
 *  + PROVAS DE FONTE (onRequest/dormencia/so-le-users/secret separado/scope/TTL/allowlist).
 * Puro/offline: NAO require() o modulo (sem deps), NAO toca producao, NAO deploya.
 * Rodar: node scripts/worker-ops/f33AA-auth-login-user.test.mjs
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

const NAMES = ["authSessionSecret", "notifDb", "notifMaskUid", "notifDjb2", "notifTimingSafeEq",
  "notifVerifyPassword", "notifSignToken", "notifRlBlocked", "notifRlFail", "notifRlClear",
  "notifVerifyToken", "authUserPublicOut", "handleLoginUser"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

const PRELUDE = `
  var AUTH_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
  var NOTIF_RL_MAX = 5, NOTIF_RL_WINDOW_MS = 5 * 60 * 1000, NOTIF_RL_BLOCK_MS = 15 * 60 * 1000;
  var __notifRlState = new Map();
  var __users = {}; var __writes = []; var __logs = [];
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = (c === "users") ? __users[id] : undefined; return { exists: !!d, data: function () { return d || null; } }; },
      set: async function () { __writes.push({ coll: c, id: id, op: "set" }); return {}; }
    }; },
    get: async function () {
      var ids = (c === "users") ? Object.keys(__users) : [];
      var docs = ids.map(function (id) { return { id: id, data: function () { return __users[id]; } }; });
      return { forEach: function (cb) { docs.forEach(function (dd) { cb(dd); }); }, size: docs.length, empty: docs.length === 0, docs: docs };
    },
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
    handleLoginUser: handleLoginUser,
    notifVerifyToken: notifVerifyToken, notifSignToken: notifSignToken,
    notifVerifyPassword: notifVerifyPassword, authUserPublicOut: authUserPublicOut,
    _setUser: function (id, u) { __users[id] = u; },
    _resetUsers: function () { __users = {}; },
    _resetRl: function () { __notifRlState = new Map(); },
    _writes: function () { return __writes; }, _logs: function () { return __logs; }
  };
`);
const api = make(crypto);

const SECRET = "S3ss10n-S3cr3t-AA";
const WRONG_SECRET = "outro-segredo-distinto";
const NOW = 1781800000000;
const DAY = 24 * 60 * 60 * 1000;
const setSecret = (on) => { if (on) process.env.AUTH_SESSION_SECRET = SECRET; else delete process.env.AUTH_SESSION_SECRET; };
const mkPass = (pw, salt) => "s2:" + crypto.createHash("sha256").update(salt + "|" + pw).digest("hex");
const post = (body, ip) => { api._resetRl(); return api.handleLoginUser({ method: "POST", body, ip: (ip || "1.2.3.4"), now: NOW }); };

// usuarios de teste. uAlice carrega campos sensiveis p/ provar a projecao.
api._setUser("uAlice", { name: "Alice", role: "designer", admin: false, status: "ativo",
  photo: "https://x/p.png", color: "#ff0000", email: "Alice@Example.com", phone: "(11) 91234-5678",
  pass: mkPass("pwA", "sA"), salt: "sA", fcmTokens: ["tokSECRET1", "tokSECRET2"], secretNote: "should-not-leak" });
api._setUser("uBoss", { name: "Boss", role: "gestor", admin: true, status: "ativo",
  photo: "", color: "", email: "boss@id7.com", phone: "+55 11 99999-0000", pass: mkPass("pwB", "sB"), salt: "sB" });
api._setUser("uPend", { name: "Pend", role: "social media", admin: false, status: "pendente",
  email: "pend@id7.com", phone: "11 90000-1111", pass: mkPass("pwP", "sP"), salt: "sP" });
api._setUser("uDup1", { name: "Dup1", role: "", admin: false, status: "ativo",
  email: "dup@id7.com", phone: "11 95555-0001", pass: mkPass("pwD1", "sD1"), salt: "sD1" });
api._setUser("uDup2", { name: "Dup2", role: "", admin: false, status: "ativo",
  email: "dup@id7.com", phone: "11 95555-0002", pass: mkPass("pwD2", "sD2"), salt: "sD2" });

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  /* ===== 0) PROVAS DE FONTE ===== */
  const H = grab("handleLoginUser");
  const PROJ = grab("authUserPublicOut");
  const WRAP = SRC.slice(SRC.indexOf("exports.loginUser = onRequest"), SRC.indexOf("exports._handleLoginUser"));
  ok("[src] loginUser usa onRequest (NAO onCall), sem req.auth/context.auth no handler",
    /exports\.loginUser = onRequest\(/.test(WRAP) && !/\breq\.auth\b|context\.auth/.test(H));
  ok("[src] dormencia: sem AUTH_SESSION_SECRET => 503", /authSessionSecret\(\)/.test(H) && /error: "endpoint_disabled"/.test(H));
  ok("[src] SO le users (collection(\"users\").get()); sem .set(/.add( no handler",
    /collection\("users"\)\.get\(\)/.test(H) && !/\.set\(|\.add\(/.test(H));
  ok("[src] secret SEPARADO: defineSecret(AUTH_SESSION_SECRET) + wrapper secrets:[AUTH_SESSION_SECRET]",
    /const AUTH_SESSION_SECRET = defineSecret\("AUTH_SESSION_SECRET"\)/.test(SRC) &&
    /exports\.loginUser = onRequest\(\{ secrets: \[AUTH_SESSION_SECRET\]/.test(SRC) && !/NOTIF_PREFS_SECRET/.test(H));
  ok("[src] scope \"session\" + TTL 24h", /scope: "session"/.test(H) && /AUTH_SESSION_TTL_MS = 24 \* 60 \* 60 \* 1000/.test(SRC));
  ok("[src] projecao allowlist: authUserPublicOut NAO cita pass/salt/fcmTokens/phone/email",
    !/pass|salt|fcmTokens|phone|email/.test(PROJ) && /id|name|role|admin|status|photo|color/.test(PROJ));
  ok("[src] handler NAO espalha doc cru (sem spread/Object.assign do registro)",
    !/\.\.\.u\b|Object\.assign\([^)]*u\.d/.test(H));

  /* ===== 1-4) login OK por email e telefone ===== */
  setSecret(true);
  const r1 = await post({ identifier: "alice@example.com", password: "pwA" });
  ok("1 login por email (case-insensitive) => 200 + token", r1.status === 200 && r1.json.ok === true && typeof r1.json.session.token === "string" && r1.json.user.id === "uAlice");
  const r2 = await post({ identifier: "  ALICE@EXAMPLE.COM  ", password: "pwA" });
  ok("2 email com espacos/maiusculas (trim+lowercase) => 200", r2.status === 200 && r2.json.user.id === "uAlice");
  const r3 = await post({ identifier: "11912345678", password: "pwA" });
  ok("3 login por telefone (digitos) => 200", r3.status === 200 && r3.json.user.id === "uAlice");
  const r4 = await post({ identifier: "(11) 91234-5678", password: "pwA" });
  ok("4 login por telefone formatado (normaliza digitos) => 200", r4.status === 200 && r4.json.user.id === "uAlice");

  /* ===== 5-8) credenciais invalidas / anti-enumeracao / colisao ===== */
  const r5 = await post({ identifier: "alice@example.com", password: "ERRADA" });
  ok("5 senha errada => 401 invalid_credentials", r5.status === 401 && r5.json.error === "invalid_credentials");
  const r6 = await post({ identifier: "ghost@id7.com", password: "qualquer" });
  ok("6 identifier inexistente => 401 invalid_credentials", r6.status === 401 && r6.json.error === "invalid_credentials");
  ok("7 anti-enumeracao: senha-errada e inexistente => resposta IDENTICA", r5.status === r6.status && JSON.stringify(r5.json) === JSON.stringify(r6.json));
  const r8 = await post({ identifier: "dup@id7.com", password: "pwD1" });
  ok("8 colisao (2 matches) => 401 generico (nao revela colisao)", r8.status === 401 && r8.json.error === "invalid_credentials");

  /* ===== 9-10) inativo => 403 (apos senha correta) ===== */
  const r9 = await post({ identifier: "pend@id7.com", password: "pwP" });
  ok("9 usuario pendente + senha correta => 403 user_inactive", r9.status === 403 && r9.json.error === "user_inactive");
  api._setUser("uPend", { name: "Pend", role: "social media", admin: false, status: "removido", email: "pend@id7.com", phone: "11 90000-1111", pass: mkPass("pwP", "sP"), salt: "sP" });
  const r10 = await post({ identifier: "pend@id7.com", password: "pwP" });
  ok("10 usuario removido + senha correta => 403 user_inactive", r10.status === 403 && r10.json.error === "user_inactive");
  api._setUser("uPend", { name: "Pend", role: "social media", admin: false, status: "pendente", email: "pend@id7.com", phone: "11 90000-1111", pass: mkPass("pwP", "sP"), salt: "sP" });

  /* ===== 11-16) payload invalido => 400 ===== */
  ok("11 body nao-objeto => 400", (await post(123)).status === 400);
  ok("12 sem identifier => 400", (await post({ password: "x" })).status === 400);
  ok("13 sem password => 400", (await post({ identifier: "alice@example.com" })).status === 400);
  ok("14 tipos nao-string => 400", (await post({ identifier: 123, password: 456 })).status === 400);
  ok("15 identifier oversized (>320) => 400", (await post({ identifier: "a".repeat(321) + "@x.com", password: "pwA" })).status === 400);
  ok("16 password oversized (>1024) => 400", (await post({ identifier: "alice@example.com", password: "p".repeat(1025) })).status === 400);

  /* ===== 17) metodo != POST => 405 ===== */
  api._resetRl();
  ok("17 GET => 405", (await api.handleLoginUser({ method: "GET", body: { identifier: "alice@example.com", password: "pwA" }, now: NOW })).status === 405);

  /* ===== 18) rate-limit: 5 invalidas + 6a => 429 (SEM reset entre tentativas) ===== */
  api._resetRl();
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await api.handleLoginUser({ method: "POST", body: { identifier: "alice@example.com", password: "ERRADA" }, ip: "5.5.5.5", now: NOW })).status);
  ok("18 rate-limit: 5 invalidas (401) e 6a => 429", statuses.slice(0, 5).every((s) => s === 401) && statuses[5] === 429);

  /* ===== 19) dormencia: sem segredo => 503 ===== */
  setSecret(false);
  ok("19 sem AUTH_SESSION_SECRET => 503", (await post({ identifier: "alice@example.com", password: "pwA" })).status === 503);
  setSecret(true);

  /* ===== 20-22) token de sessao ===== */
  const claims = JSON.parse(Buffer.from(r1.json.session.token.split(".")[0], "base64url").toString("utf8"));
  ok("20 claims {uid,admin,role,scope:session,iat,exp}", claims.uid === "uAlice" && claims.admin === false && claims.role === "designer" && claims.scope === "session" && typeof claims.iat === "number" && typeof claims.exp === "number");
  ok("21 TTL 24h (ms): exp-iat === 24h e expiresAt === exp", (claims.exp - claims.iat) === DAY && claims.exp === NOW + DAY && r1.json.session.expiresAt === claims.exp);
  const vOk = api.notifVerifyToken("Bearer " + r1.json.session.token, SECRET, NOW);
  const vBad = api.notifVerifyToken("Bearer " + r1.json.session.token, WRONG_SECRET, NOW);
  ok("22 assinatura HMAC valida c/ AUTH_SESSION_SECRET e rejeitada c/ segredo errado", vOk.ok === true && vOk.uid === "uAlice" && vBad.ok === false);

  /* ===== 23-28) projecao segura ===== */
  const userKeys = Object.keys(r1.json.user).sort();
  ok("23 user tem EXATAMENTE 7 campos da allowlist", JSON.stringify(userKeys) === JSON.stringify(["admin", "color", "id", "name", "photo", "role", "status"]));
  const uStr = JSON.stringify(r1.json.user);
  ok("24 user NAO contem pass", !("pass" in r1.json.user) && uStr.indexOf(mkPass("pwA", "sA")) < 0);
  ok("25 user NAO contem salt", !("salt" in r1.json.user) && uStr.indexOf("sA") < 0);
  ok("26 user NAO contem fcmTokens", !("fcmTokens" in r1.json.user) && uStr.indexOf("tokSECRET") < 0);
  ok("27 user NAO contem phone", !("phone" in r1.json.user) && uStr.indexOf("91234") < 0);
  ok("28 user NAO contem email (nem secretNote/doc cru)", !("email" in r1.json.user) && uStr.toLowerCase().indexOf("alice@example.com") < 0 && uStr.indexOf("should-not-leak") < 0);

  /* ===== 29) admin ===== */
  const rB = await post({ identifier: "boss@id7.com", password: "pwB" });
  const cB = JSON.parse(Buffer.from(rB.json.session.token.split(".")[0], "base64url").toString("utf8"));
  ok("29 admin: user.admin true + claims.admin true + role gestor", rB.json.user.admin === true && cB.admin === true && cB.role === "gestor");

  /* ===== 30) zero escrita Firestore ===== */
  ok("30 NAO escreve no Firestore (zero set/add)", api._writes().length === 0);

  /* ===== 31) sem vazar senha/token/identifier em log ===== */
  const logStr = JSON.stringify(api._logs());
  ok("31 logs sem senha/token/identifier", logStr.indexOf("pwA") < 0 && logStr.indexOf("pwB") < 0 && logStr.indexOf(r1.json.session.token) < 0 && logStr.toLowerCase().indexOf("alice@example.com") < 0);

  console.log("\n========= F3.3.20-B1.7-E — login server-side (handler real) =========");
  console.log("  200 email(case/trim)/telefone(digitos) · 401 senha/inexistente/colisao (anti-enum)");
  console.log("  403 inativo (apos senha) · 400 payload · 405 metodo · 429 rate-limit · 503 sem segredo");
  console.log("  token sessao {uid,admin,role,scope:session,iat,exp+24h} HMAC AUTH_SESSION_SECRET");
  console.log("  projecao allowlist (7 campos; sem pass/salt/fcmTokens/phone/email) · zero escrita · sem vazar");
  console.log("====================================================================\n");
  console.log("F3.3.20-B1.7-E auth-login-user: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
