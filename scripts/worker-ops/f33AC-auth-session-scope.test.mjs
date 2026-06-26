#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — Verificador ESTRITO de token de SESSAO (authVerifySessionToken).
 * Extrai a logica REAL de functions/index.js (notifVerifyToken/notifSignToken/
 * authVerifySessionToken) e roda com crypto real (sem Firestore, sem secret real,
 * sem usuario real). Prova o HARDENING de escopo:
 *   - token valido scope=session aceito (retorna uid/admin/role/scope);
 *   - rejeita: sem scope, scope!=session, sem exp, exp nao-numerico, expirado,
 *     sem uid, uid vazio, malformado, assinatura invalida, sem Bearer, sem secret,
 *     secret errado;
 *   - erro UNIFORME { ok:false, error:"invalid_session" } (sem payload bruto);
 *   - nao loga token; nao toca Firestore (prova de fonte);
 *   - notifVerifyToken segue compativel com tokens notifPrefs antigos;
 *   - loginUser continua emitindo scope=session (prova de fonte).
 * Puro/offline: NAO require() o modulo; NAO toca producao; NAO deploya.
 * Rodar: node scripts/worker-ops/f33AC-auth-session-scope.test.mjs
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

const NAMES = ["notifVerifyToken", "notifSignToken", "authVerifySessionToken"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";
const make = new Function("crypto", BODY + `
  ; return { notifVerifyToken, notifSignToken, authVerifySessionToken };
`);
const api = make(crypto);

const SECRET = "S3ss10n-AC";
const WRONG  = "outro-secret-distinto";
const NOW = 1781800000000;
const DAY = 24 * 60 * 60 * 1000;
const sign = (claims, secret) => api.notifSignToken(claims, secret || SECRET);
const verify = (token, secret) => api.authVerifySessionToken("Bearer " + token, (secret === undefined ? SECRET : secret), NOW);

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

// captura de console.log p/ provar que o helper nao loga token
const _log = console.log; const captured = [];
console.log = (...a) => { captured.push(a.join(" ")); };

try {
  /* ===== PROVAS DE FONTE ===== */
  const H = grab("authVerifySessionToken");
  ok("[src] helper exige scope===\"session\"", /claims\.scope !== "session"/.test(H));
  ok("[src] helper exige exp numerico", /typeof claims\.exp !== "number"/.test(H));
  ok("[src] helper reutiliza notifVerifyToken", /notifVerifyToken\(authHeader, secret, nowMs\)/.test(H));
  ok("[src] helper NAO toca Firestore", !/notifDb|firestore|collection\(/.test(H));
  ok("[src] helper NAO chama .value() (secret e parametro)", !/\.value\(\)/.test(H));
  ok("[src] erro uniforme invalid_session", /error: "invalid_session"/.test(H));
  ok("[src] NAO e CloudFunction (sem onRequest/onCall no helper)", !/onRequest|onCall/.test(H));
  ok("[src] exporta helper puro _authVerifySessionToken", /exports\._authVerifySessionToken = authVerifySessionToken/.test(SRC));
  ok("[src#22] loginUser ainda emite scope=session", /scope: "session"/.test(SRC));
  ok("[src#21] notifVerifyToken inalterado (sem checagem de scope)", !/scope/.test(grab("notifVerifyToken")));

  /* ===== 1) token valido scope=session aceito ===== */
  const tOk = sign({ uid: "u1", admin: false, role: "designer", scope: "session", iat: NOW, exp: NOW + DAY });
  const rOk = verify(tOk);
  ok("1 token valido session aceito", rOk.ok === true && rOk.uid === "u1" && rOk.scope === "session");

  /* ===== 2-4) escopo ===== */
  ok("2 sem scope => rejeitado", verify(sign({ uid: "u1", iat: NOW, exp: NOW + DAY })).ok === false);
  ok("3 scope=notifPrefs:write => rejeitado", verify(sign({ uid: "u1", scope: "notifPrefs:write", iat: NOW, exp: NOW + DAY })).ok === false);
  ok("4 scope=admin => rejeitado", verify(sign({ uid: "u1", scope: "admin", iat: NOW, exp: NOW + DAY })).ok === false);

  /* ===== 5) secret errado ===== */
  ok("5 secret errado => rejeitado", verify(sign({ uid: "u1", scope: "session", iat: NOW, exp: NOW + DAY }, WRONG), SECRET).ok === false);

  /* ===== 6) expirado ===== */
  ok("6 expirado => rejeitado", verify(sign({ uid: "u1", scope: "session", iat: NOW - 2 * DAY, exp: NOW - DAY })).ok === false);

  /* ===== 7-8) uid ===== */
  ok("7 sem uid => rejeitado", verify(sign({ scope: "session", iat: NOW, exp: NOW + DAY })).ok === false);
  ok("8 uid vazio => rejeitado", verify(sign({ uid: "", scope: "session", iat: NOW, exp: NOW + DAY })).ok === false);

  /* ===== 9-10) exp ===== */
  ok("9 sem exp => rejeitado", verify(sign({ uid: "u1", scope: "session", iat: NOW })).ok === false);
  ok("10 exp nao-numerico => rejeitado", verify(sign({ uid: "u1", scope: "session", iat: NOW, exp: "amanha" })).ok === false);

  /* ===== 11-13) formato / assinatura / bearer ===== */
  ok("11 malformado => rejeitado", api.authVerifySessionToken("Bearer abc", SECRET, NOW).ok === false);
  const parts = tOk.split(".");
  const tamper = parts[0] + "." + (parts[1].slice(0, -1) + (parts[1].slice(-1) === "A" ? "B" : "A"));
  ok("12 assinatura invalida => rejeitado", api.authVerifySessionToken("Bearer " + tamper, SECRET, NOW).ok === false);
  ok("13 sem Bearer => rejeitado", api.authVerifySessionToken(tOk, SECRET, NOW).ok === false);

  /* ===== 14) sem secret ===== */
  ok("14 sem secret => rejeitado", api.authVerifySessionToken("Bearer " + tOk, "", NOW).ok === false);

  /* ===== 15) erro sem payload bruto ===== */
  const rErr = verify(sign({ uid: "u1", scope: "admin", iat: NOW, exp: NOW + DAY }));
  ok("15 erro = shape uniforme sem payload bruto", JSON.stringify(rErr) === '{"ok":false,"error":"invalid_session"}');

  /* ===== 17-19) retorno seguro ===== */
  const rAdm = verify(sign({ uid: "uA", admin: true, role: "gestor", scope: "session", iat: NOW, exp: NOW + DAY }));
  ok("17 retorna admin", rAdm.admin === true);
  ok("18 retorna role", rAdm.role === "gestor");
  ok("19 retorna scope=session", rAdm.scope === "session");
  // chaves de retorno seguras (sem token/iat/payload)
  ok("19b retorno OK so com ok/uid/admin/role/scope", JSON.stringify(Object.keys(rAdm).sort()) === JSON.stringify(["admin", "ok", "role", "scope", "uid"]));

  /* ===== 21) notifVerifyToken compativel com notifPrefs antigos ===== */
  const tNotif = sign({ uid: "u9", admin: true, scope: "notifPrefs:write", iat: NOW, exp: NOW + 15 * 60 * 1000 });
  const vNotif = api.notifVerifyToken("Bearer " + tNotif, SECRET, NOW);
  ok("21 notifVerifyToken aceita token notifPrefs (fluxo antigo intacto)", vNotif.ok === true && vNotif.uid === "u9" && vNotif.admin === true);
} finally {
  console.log = _log;
}

/* ===== 16) logs nao contem token ===== */
const logStr = captured.join("\n");
ok("16 logs do helper nao contem token", logStr.indexOf("Bearer") < 0 && logStr.indexOf(".") < 0 || captured.length === 0);

/* ===== 20) helper nao toca Firestore (re-afirma via fonte) ===== */
ok("20 helper sem Firestore (fonte)", !/notifDb|admin\.firestore|collection\(/.test(grab("authVerifySessionToken")));

console.log("\n========= F3.3.20-B1.7-E — strict session token verifier =========");
console.log("  scope=session OBRIGATORIO; exp OBRIGATORIO; uid valido; assinatura AUTH_SESSION_SECRET");
console.log("  rejeita sem-scope/scope-errado/sem-exp/exp-nao-num/expirado/sem-uid/malformado/sig-invalida/sem-secret");
console.log("  erro uniforme invalid_session; retorno {ok,uid,admin,role,scope}; notifVerifyToken/loginUser preservados");
console.log("==================================================================");
console.log("F3.3.20-B1.7-E auth-session-scope: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
