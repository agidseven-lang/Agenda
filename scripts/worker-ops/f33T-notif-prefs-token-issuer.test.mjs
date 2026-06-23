#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.3-B — EMISSOR server-side de TOKEN HMAC p/ notifPrefs.
 * Extrai a lógica REAL de functions/index.js (notifPrefsSecret/notifDb/notifMaskUid/
 * notifDjb2/notifTimingSafeEq/notifVerifyPassword/notifSignToken/handleIssueNotifPrefsToken
 * + notifVerifyToken da B1.2) e roda com crypto real + admin.firestore() MOCKADO
 * (store de users; captura de escritas), provando:
 *   1-3) body/uid/senha ausentes => 400; 4) uid inexistente => 401; 5) senha errada => 401;
 *   6) usuário interno comum válido => token; 7) Designer => token; 8) Social => token;
 *   9) Admin => admin:true; 10) comum => admin:false; 11) claims uid/admin/scope/iat/exp;
 *  12) exp ≈ now+15min; 13/14) token emitido VERIFICA/é ACEITO pelo verificador B1.2;
 *  15) token expirado rejeitado; 16) token adulterado rejeitado; 17) sem segredo => 503;
 *  18) senha nunca em log/payload; 19) token completo nunca em log; 20) NÃO escreve Firestore;
 *  21) NÃO altera users/{uid}; 22-24) não toca fcmTokens/fcmTokenMeta/clientPushSubs;
 *  25) helpers B1.1-A/B1.2 verdes (round-trip + provas de fonte). Status inativo => 403.
 * Puro/offline: NÃO require() o módulo (sem deps), NÃO toca produção, NÃO envia.
 * Rodar: /opt/node22/bin/node scripts/worker-ops/f33T-notif-prefs-token-issuer.test.mjs
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

const NAMES = ["notifPrefsSecret", "notifDb", "notifMaskUid", "notifDjb2", "notifTimingSafeEq",
  "notifVerifyPassword", "notifSignToken", "handleIssueNotifPrefsToken", "notifVerifyToken"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

const PRELUDE = `
  var NOTIF_TOKEN_TTL_MS = 15 * 60 * 1000;
  var __users = {}; var __writes = []; var __logs = [];
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = (c === "users") ? __users[id] : undefined; return { exists: !!d, data: function () { return d || null; } }; },
      set: async function (data, opts) { __writes.push({ coll: c, id: id, op: "set" }); return {}; }
    }; },
    add: async function (o) { __writes.push({ coll: c, op: "add" }); return { id: "x" }; }
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
    handleIssueNotifPrefsToken: handleIssueNotifPrefsToken,
    notifVerifyToken: notifVerifyToken, notifSignToken: notifSignToken,
    notifVerifyPassword: notifVerifyPassword,
    _setUser: function (id, u) { __users[id] = u; },
    _writes: function () { return __writes; }, _logs: function () { return __logs; }
  };
`);
const api = make(crypto);

const SECRET = "S3cr3t-B13";
const NOW = 1781800000000;
const TTL = 15 * 60 * 1000;
const setSecret = (on) => { if (on) process.env.NOTIF_PREFS_SECRET = SECRET; else delete process.env.NOTIF_PREFS_SECRET; };
const mkPass = (pw, salt) => "s2:" + crypto.createHash("sha256").update(salt + "|" + pw).digest("hex");
const post = (body) => api.handleIssueNotifPrefsToken({ method: "POST", body, now: NOW });

// usuários de teste (internos válidos de várias roles + inativo)
api._setUser("uCommon", { pass: mkPass("pw1", "s1"), salt: "s1", role: "", admin: false, status: "" });
api._setUser("uDes", { pass: mkPass("pwD", "sD"), salt: "sD", role: "designer", admin: false, status: "aprovado" });
api._setUser("uSoc", { pass: mkPass("pwS", "sS"), salt: "sS", role: "social media", admin: false, status: "" });
api._setUser("uAdm", { pass: mkPass("pwA", "sA"), salt: "sA", role: "gestor", admin: true, status: "" });
api._setUser("uPend", { pass: mkPass("pwP", "sP"), salt: "sP", role: "designer", admin: false, status: "pendente" });

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  /* ===== 0) PROVAS DE FONTE (no-touch / onRequest / dormência) — sobre as funções grabbed ===== */
  const ISS = grab("handleIssueNotifPrefsToken") + grab("notifSignToken") + grab("notifVerifyPassword");
  const WRAP = SRC.slice(SRC.indexOf("exports.issueNotifPrefsToken"), SRC.indexOf("exports.issueNotifPrefsToken") + 400);
  ok("[src] emissor usa onRequest (NAO onCall) e sem req.auth/context.auth", /onRequest\(/.test(WRAP) && !/\breq\.auth\b|context\.auth/.test(ISS));
  ok("[src] dormência: sem NOTIF_PREFS_SECRET => 503", /notifPrefsSecret\(\)/.test(ISS) && /error: "endpoint_disabled"/.test(ISS));
  ok("[src] SÓ lê users/{uid} (sem .set/.add no emissor)", /collection\("users"\)\.doc\(uid\)\.get\(\)/.test(ISS) && !/\.set\(|\.add\(/.test(ISS));
  ok("[src#22-24] emissor não cita fcmTokens/fcmTokenMeta/clientPushSubs/notifPrefs/notifLog", !/fcmTokens|fcmTokenMeta|clientPushSubs|notifPrefs"|notifLog/.test(ISS));
  ok("[src] TTL = 15 min e scope notifPrefs:write", /NOTIF_TOKEN_TTL_MS = 15 \* 60 \* 1000/.test(SRC) && /scope: "notifPrefs:write"/.test(ISS));
  ok("[src] sem gate de role (não bloqueia Designer): emissor não usa MANAGER_KW/TEAM_ROLE_KW", !/MANAGER_KW|TEAM_ROLE_KW/.test(ISS));
  ok("[src] admin:true só se u.admin===true", /u\.admin === true/.test(ISS));

  /* ===== 1-3) validação de entrada ===== */
  setSecret(true);
  ok("1 body não-objeto => 400", (await post(123)).status === 400);
  ok("2 sem uid => 400", (await post({ password: "x" })).status === 400);
  ok("3 sem senha => 400", (await post({ uid: "uCommon" })).status === 400);

  /* ===== 4-5) credenciais ===== */
  ok("4 uid inexistente => 401 controlado", (await post({ uid: "naoExiste", password: "x" })).status === 401);
  ok("5 senha errada => 401", (await post({ uid: "uCommon", password: "ERRADA" })).status === 401);

  /* ===== 6-10) emissão por role + admin flag ===== */
  const rC = await post({ uid: "uCommon", password: "pw1" });
  ok("6 usuário interno comum válido => 200 + token", rC.status === 200 && typeof rC.json.token === "string" && rC.json.token.length > 20);
  const rD = await post({ uid: "uDes", password: "pwD" });
  ok("7 Designer válido => token p/ si mesmo", rD.status === 200 && rD.json.uid === "uDes" && rD.json.token);
  const rS = await post({ uid: "uSoc", password: "pwS" });
  ok("8 Social válido => token p/ si mesmo", rS.status === 200 && rS.json.uid === "uSoc" && rS.json.token);
  const rA = await post({ uid: "uAdm", password: "pwA" });
  ok("9 Admin válido => admin:true", rA.status === 200 && rA.json.admin === true);
  ok("10 usuário comum => admin:false", rC.json.admin === false && rD.json.admin === false && rS.json.admin === false);

  /* ===== inativo => 403 (após senha correta) ===== */
  ok("[extra] usuário inativo (status pendente) + senha correta => 403", (await post({ uid: "uPend", password: "pwP" })).status === 403);

  /* ===== 11-12) claims ===== */
  const claims = JSON.parse(Buffer.from(rD.json.token.split(".")[0], "base64url").toString("utf8"));
  ok("11 claims contém uid/admin/scope/iat/exp", claims.uid === "uDes" && typeof claims.admin === "boolean" && claims.scope === "notifPrefs:write" && typeof claims.iat === "number" && typeof claims.exp === "number");
  ok("12 exp ≈ now + 15min", claims.exp === NOW + TTL && claims.iat === NOW);

  /* ===== 13-16) interoperabilidade com o verificador B1.2 ===== */
  const v = api.notifVerifyToken("Bearer " + rD.json.token, SECRET, NOW);
  ok("13 assinatura verificável pelo helper B1.2", v.ok === true);
  ok("14 token emitido é ACEITO pela B1.2 (uid correto)", v.ok === true && v.uid === "uDes" && v.admin === false);
  const vAdm = api.notifVerifyToken("Bearer " + rA.json.token, SECRET, NOW);
  ok("14b token admin => B1.2 reconhece admin:true", vAdm.ok === true && vAdm.admin === true);
  // expirado: assina claims com exp no passado e verifica com now>exp
  const expiredTok = api.notifSignToken({ uid: "uDes", admin: false, scope: "notifPrefs:write", iat: NOW - 2 * TTL, exp: NOW - TTL }, SECRET);
  ok("15 token expirado é rejeitado pela B1.2", api.notifVerifyToken("Bearer " + expiredTok, SECRET, NOW).ok === false);
  // adulterado: altera 1 char do payload => assinatura não confere
  const parts = rD.json.token.split(".");
  const tamper = (parts[0].slice(0, -1) + (parts[0].slice(-1) === "A" ? "B" : "A")) + "." + parts[1];
  ok("16 token adulterado é rejeitado pela B1.2", api.notifVerifyToken("Bearer " + tamper, SECRET, NOW).ok === false);

  /* ===== 17) dormência ===== */
  setSecret(false);
  ok("17 sem NOTIF_PREFS_SECRET => 503", (await post({ uid: "uDes", password: "pwD" })).status === 503);
  setSecret(true);

  /* ===== 18-19) sem vazamento em log/payload ===== */
  const logStr = JSON.stringify(api._logs());
  ok("18 senha NUNCA em logs", logStr.indexOf("pwD") < 0 && logStr.indexOf("pwA") < 0 && logStr.indexOf("pw1") < 0);
  ok("18b senha não volta no payload de resposta", JSON.stringify(rD.json).indexOf("pwD") < 0);
  ok("19 token completo NUNCA em logs", logStr.indexOf(rD.json.token) < 0 && logStr.indexOf(rA.json.token) < 0);
  ok("19b log do emissor mascara uid", logStr.indexOf("uD…") >= 0 || logStr.indexOf("…") >= 0);

  /* ===== 20-24) sem escrita / não toca tokens ===== */
  ok("20 NÃO escreve no Firestore (zero set/add)", api._writes().length === 0);
  ok("21 NÃO altera users/{uid} (nenhuma escrita em users)", api._writes().every((w) => w.coll !== "users"));
  ok("22-24 nenhuma escrita em qualquer coleção (fcmTokens/etc preservados)", api._writes().length === 0);

  /* ===== 25) B1.1-A/B1.2 verdes (round-trip já provou B1.2; reconfirma verificação) ===== */
  ok("25 verificador B1.2 segue íntegro (aceita válido, rejeita inválido)",
    api.notifVerifyToken("Bearer " + rS.json.token, SECRET, NOW).ok === true && api.notifVerifyToken("Bearer xxx", SECRET, NOW).ok === false);

  console.log("\n========= F3.3.20-B1.3-B — emissor de token (handler real) =========");
  console.log("  400 body/uid/senha · 401 uid inexistente/senha errada · 403 inativo · 503 sem segredo");
  console.log("  Social/Designer/Admin internos => token p/ si; admin:true só p/ admin");
  console.log("  claims {uid,admin,scope:notifPrefs:write,iat,exp+15min}; HMAC aceito pela B1.2");
  console.log("  expirado/adulterado => rejeitados; zero escrita Firestore; sem vazar senha/token");
  console.log("====================================================================\n");
  console.log("F3.3.20-B1.3-B notif-prefs-token-issuer: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
