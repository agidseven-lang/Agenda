#!/usr/bin/env node
/* =====================================================================
 * F4.2C — issueFirebaseAuthToken (Firebase Custom Token do PROPRIO usuario).
 * Extrai a logica REAL de functions/index.js (grab por chaves balanceadas,
 * mesmo padrao dos harnesses f33*) e roda OFFLINE: crypto real p/ o token de
 * sessao HMAC; Firestore MOCK injetado via ctx.db; createCustomToken MOCK via
 * ctx.createCustomToken. Sem rede, sem segredo real, sem usuario real, sem
 * deploy. Prova:
 *   1) metodo != POST => 405;
 *   2) sem/da Bearer invalido => 401 invalid_session (uniforme);
 *   3) sessao valida + usuario ATIVO => 200 {ok,uid,firebaseToken,expiresInSec};
 *   4) uid do token emitido == uid da SESSAO (deterministico; nunca outro uid);
 *   5) createCustomToken chamado com UID APENAS (SEM claims adicionais);
 *   6) status pendente/removido/excluido e disabled===true => 403 user_inactive
 *      (mesma politica do loginUser; fail-closed);
 *   7) usuario inexistente => 404; erro de leitura => 500 lookup_failed;
 *   8) falha na emissao => 500 token_issue_failed (resposta generica);
 *   9) resposta NUNCA contem pass/salt/fcmTokens/email/phone;
 *  10) o firebaseToken NAO aparece em nenhum log capturado (mascara ok);
 *  11) prova de fonte: wrapper onRequest com secrets AUTH_SESSION_SECRET,
 *      no-store, POST-only, export _handleIssueFirebaseAuthToken presente,
 *      SEM claims no createCustomToken do runtime (regex).
 * Rodar: node scripts/worker-ops/f42c-issue-firebase-auth-token.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

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

/* logica REAL extraida + ambiente controlado (secret de TESTE local; logger capturado) */
const NAMES = ["notifVerifyToken", "notifSignToken", "authVerifySessionToken", "notifRlBlocked", "notifRlClear", "notifMaskUid", "handleIssueFirebaseAuthToken"];
let BODY = "const AUTH_INACTIVE_STATUSES = [\"pendente\", \"removido\", \"excluido\"];\n";
for (const n of NAMES) BODY += grab(n) + "\n";
const LOGS = [];
const make = new Function("crypto", "authSessionSecret", "logger", "notifDb", "admin", "__notifRlState", BODY + `
  ; return { handleIssueFirebaseAuthToken, notifSignToken };
`);
const TEST_SECRET = "f42c-harness-secret-LOCAL-apenas";
const api = make(
  crypto,
  () => TEST_SECRET,
  { info: (...a) => LOGS.push(JSON.stringify(a)), error: (...a) => LOGS.push(JSON.stringify(a)), warn: (...a) => LOGS.push(JSON.stringify(a)) },
  () => { throw new Error("notifDb NAO pode ser tocado no teste (ctx.db obrigatorio)"); },
  { auth: () => ({ createCustomToken: () => { throw new Error("admin real proibido no teste"); } }) },
  new Map(),
);

const NOW = 1753500000000;
const UID = "f42cUserSintetico001";
const sess = (uid, expMs) => "Bearer " + api.notifSignToken({ uid, admin: false, role: "Designer", scope: "session", iat: NOW, exp: expMs || (NOW + 3600000) }, TEST_SECRET);
const mkDb = (docs) => ({ collection: (c) => ({ doc: (id) => ({ get: async () => {
  if (c !== "users") throw new Error("colecao inesperada: " + c);
  if (docs && Object.prototype.hasOwnProperty.call(docs, "__throw")) throw new Error("firestore indisponivel (sintetico)");
  const d = docs ? docs[id] : null;
  return d ? { exists: true, data: () => d } : { exists: false, data: () => null };
} }) }) });
const CAPTURE = { args: null };
const createOk = async (...args) => { CAPTURE.args = args; return "FAKE.CUSTOM.TOKEN.f42c.sintetico"; };

console.log("\n===== F4.2C — issueFirebaseAuthToken (harness offline) =====");
{
  const r = await api.handleIssueFirebaseAuthToken({ method: "GET", authHeader: sess(UID), now: NOW, db: mkDb({}), createCustomToken: createOk });
  ok("1 metodo GET => 405 method_not_allowed", r.status === 405 && r.json.error === "method_not_allowed");
}
{
  const r1 = await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: "", now: NOW, db: mkDb({}), createCustomToken: createOk });
  const r2 = await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: "Bearer lixo.invalido", now: NOW, db: mkDb({}), createCustomToken: createOk });
  const r3 = await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: sess(UID, NOW - 1000), now: NOW, db: mkDb({}), createCustomToken: createOk });
  ok("2 sem Bearer / token invalido / token EXPIRADO => 401 invalid_session uniforme",
    [r1, r2, r3].every((r) => r.status === 401 && r.json.error === "invalid_session"));
}
{
  CAPTURE.args = null;
  const db = mkDb({ [UID]: { name: "Sintetico", role: "Designer", status: "ativo", pass: "HASHSECRETO", salt: "SALZINHO", email: "x@y.z", phone: "119999", fcmTokens: ["tokfcm"] } });
  const r = await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: sess(UID), now: NOW, db, createCustomToken: createOk });
  ok("3 sessao valida + usuario ATIVO => 200 {ok, uid, firebaseToken, expiresInSec}",
    r.status === 200 && r.json.ok === true && r.json.uid === UID && r.json.firebaseToken === "FAKE.CUSTOM.TOKEN.f42c.sintetico" && r.json.expiresInSec === 3600);
  ok("4 uid do custom token == uid da SESSAO (deterministico)", CAPTURE.args && CAPTURE.args[0] === UID);
  ok("5 createCustomToken SEM claims adicionais (1 argumento apenas)", CAPTURE.args && CAPTURE.args.length === 1);
  const s = JSON.stringify(r.json);
  ok("9 resposta NUNCA contem pass/salt/fcmTokens/email/phone",
    !s.includes("HASHSECRETO") && !s.includes("SALZINHO") && !s.includes("tokfcm") && !s.includes("x@y.z") && !s.includes("119999"));
}
{
  const casos = ["pendente", "removido", "excluido"];
  const rs = [];
  for (const st of casos) {
    const db = mkDb({ [UID]: { status: st } });
    rs.push(await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: sess(UID), now: NOW, db, createCustomToken: createOk }));
  }
  const dbDis = mkDb({ [UID]: { status: "ativo", disabled: true } });
  rs.push(await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: sess(UID), now: NOW, db: dbDis, createCustomToken: createOk }));
  ok("6 pendente/removido/excluido/disabled => 403 user_inactive (fail-closed)",
    rs.every((r) => r.status === 403 && r.json.error === "user_inactive"));
}
{
  const r404 = await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: sess(UID), now: NOW, db: mkDb({}), createCustomToken: createOk });
  const r500 = await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: sess(UID), now: NOW, db: mkDb({ __throw: 1 }), createCustomToken: createOk });
  ok("7 inexistente => 404 not_found; leitura falhou => 500 lookup_failed",
    r404.status === 404 && r404.json.error === "not_found" && r500.status === 500 && r500.json.error === "lookup_failed");
}
{
  const db = mkDb({ [UID]: { status: "ativo" } });
  const r = await api.handleIssueFirebaseAuthToken({ method: "POST", authHeader: sess(UID), now: NOW, db, createCustomToken: async () => { throw new Error("Permission iam.serviceAccounts.signBlob denied (sintetico)"); } });
  ok("8 falha na emissao (ex.: IAM signBlob ausente) => 500 token_issue_failed generico",
    r.status === 500 && r.json.error === "token_issue_failed" && !JSON.stringify(r.json).includes("signBlob"));
}
{
  ok("10 firebaseToken NUNCA aparece nos logs; uid so MASCARADO (nunca completo)",
    LOGS.length > 0
    && !LOGS.some((l) => l.includes("FAKE.CUSTOM.TOKEN"))
    && !LOGS.some((l) => l.includes(UID)));
}

/* prova de FONTE (wrapper + export + sem-claims no runtime) */
{
  ok("11a wrapper onRequest com secrets [AUTH_SESSION_SECRET] + us-central1 + cors allowlist",
    /exports\.issueFirebaseAuthToken = onRequest\(\{ secrets: \[AUTH_SESSION_SECRET\], region: "us-central1", maxInstances: 10, cors: NOTIF_CORS_ORIGINS \}/.test(SRC));
  ok("11b wrapper seta Cache-Control no-store e trata OPTIONS 204",
    SRC.includes('exports.issueFirebaseAuthToken') && /issueFirebaseAuthToken[\s\S]{0,400}res\.set\("Cache-Control", "no-store"\)/.test(SRC));
  ok("11c export puro _handleIssueFirebaseAuthToken presente (harness)",
    SRC.includes("exports._handleIssueFirebaseAuthToken = handleIssueFirebaseAuthToken;"));
  ok("11d runtime cria token SEM claims (createCustomToken(uid) — 1 arg)",
    /createCustomToken\(uid\)\)/.test(SRC) && !/createCustomToken\(auth\.uid,\s*\{/.test(SRC));
  ok("11e POST-only no handler (405 p/ demais metodos)",
    /handleIssueFirebaseAuthToken[\s\S]{0,700}method !== "POST"\) return \{ status: 405/.test(SRC));
  ok("11f nenhum log do token no bloco do endpoint (regex: logger nunca recebe fbToken)",
    !/logger\.(info|error|warn)\([^)]*fbToken/.test(SRC));
}

console.log(`\nF42C-ISSUE-FIREBASE-AUTH-TOKEN: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
