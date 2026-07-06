#!/usr/bin/env node
/* =====================================================================
 * F3.3.61-R1 — resetMyFcmTokens (endpoint self-only) + cutover do write
 * DIRETO de FCM em /users no force-reregister do cliente.
 * Extrai a logica REAL de functions/index.js (authVerifySessionToken/
 * authSessionSecret/notifSignToken/notifVerifyToken/notifMaskUid/notifDb +
 * handleResetMyFcmTokens) com crypto real e admin.firestore() MOCKADO.
 * Prova (server): POST-only (GET=>405), sessao obrigatoria (=>401), self-only
 * (escreve users/<auth.uid>, IGNORA targetId do body), limpa fcmTokens=[]/
 * fcmTokenMeta={}, resposta { ok:true } sem token/fcmTokens/fcmTokenMeta/
 * pass/salt/hash, logs sem token.
 * Prova (client, estatico): resetMyFcmTokensClient POST+Bearer, contrato
 * {ok:true}<=>res.ok&&data.ok; force-rereg chama o endpoint com fcm_token_server
 * ON e mantem o write direto SO no fallback OFF (unico e gated).
 * Regressao: f3361C + f3361J passam; node --check; diff so nos 3 arquivos.
 * Puro/offline: NAO deploya; NAO toca producao; NAO usa Firestore/FCM real.
 * Rodar: node scripts/worker-ops/f3361R1-fcm-direct-write-cutoff.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FSRC = fs.readFileSync(path.join(ROOT, "functions", "index.js"), "utf8");
const HSRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function grab(src, n) {
  let a = src.indexOf("async function " + n + "(");
  if (a < 0) a = src.indexOf("function " + n + "(");
  if (a < 0) throw new Error("nao encontrei fn: " + n);
  let d = 0;
  for (let j = src.indexOf("{", a); j < src.length; j++) {
    const c = src[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return src.slice(a, j + 1); }
  }
  throw new Error("sem fim: " + n);
}
function grabConst(src, n) {
  const m = new RegExp("^const " + n + "\\b[^\\n]*$", "m").exec(src);
  if (!m) throw new Error("nao encontrei const: " + n);
  return m[0];
}
function grabH(n) { try { return grab(HSRC, n); } catch (_) { return ""; } }

const FN_NAMES = [
  "sha256Hex", "notifMaskUid", "notifSignToken", "notifVerifyToken",
  "authSessionSecret", "authVerifySessionToken", "notifDb",
  "handleResetMyFcmTokens",
];
const CONST_NAMES = ["AUTH_SESSION_TTL_MS"];

let BODY = "";
for (const n of CONST_NAMES) BODY += grabConst(FSRC, n) + "\n";
for (const n of FN_NAMES) BODY += grab(FSRC, n) + "\n";

const PRELUDE = `
  var __users = {}; var __writes = []; var __logs = [];
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = (c === "users") ? __users[id] : undefined; return { exists: !!d, data: function () { return d || null; } }; },
      update: async function (patch) { __writes.push({ coll: c, id: id, op: "update", patch: patch }); if (c === "users" && __users[id]) { for (var k in patch) __users[id][k] = patch[k]; } return {}; },
      set: async function (v) { __writes.push({ coll: c, id: id, op: "set", v: v }); if (c === "users") __users[id] = v; return {}; }
    }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  var logger = {
    info: function () { __logs.push(Array.prototype.slice.call(arguments)); },
    warn: function () { __logs.push(Array.prototype.slice.call(arguments)); },
    error: function () { __logs.push(Array.prototype.slice.call(arguments)); }
  };
`;

const SECRET = "test-secret-f3361r1";
process.env.AUTH_SESSION_SECRET = SECRET;

const make = new Function("crypto", PRELUDE + BODY + `
  return {
    signToken: notifSignToken, TTL: AUTH_SESSION_TTL_MS,
    reset: function (u) { for (var k in __users) delete __users[k]; if (u) for (var kk in u) __users[kk] = u[kk]; __writes.length = 0; __logs.length = 0; },
    writes: function () { return __writes; }, logs: function () { return __logs; }, users: function () { return __users; },
    resetFcm: handleResetMyFcmTokens,
  };
`);
const H = make(crypto);

const NOW = 1_700_000_000_000;
function sess(uid) { return "Bearer " + H.signToken({ uid: uid, admin: false, role: "", scope: "session", iat: NOW, exp: NOW + H.TTL }, SECRET); }
const call = (ctx) => H.resetFcm(Object.assign({ now: NOW }, ctx));
function seed() { H.reset({
  userB:  { name: "B", fcmTokens: ["tok-secret-B"], fcmTokenMeta: { "tok-secret-B": { deviceId: "d1" } } },
  adminA: { name: "A", fcmTokens: ["tok-secret-A"], fcmTokenMeta: { "tok-secret-A": { deviceId: "d2" } } },
}); }

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };

(async () => {
  // ---------- SERVER (1-15) ----------
  ok("1 export resetMyFcmTokens + harness", /exports\.resetMyFcmTokens = onRequest/.test(FSRC) && /exports\._handleResetMyFcmTokens = handleResetMyFcmTokens/.test(FSRC));
  { const w = FSRC.slice(FSRC.indexOf("exports.resetMyFcmTokens = onRequest"), FSRC.indexOf("exports.resetMyFcmTokens = onRequest") + 700);
    ok("2 OPTIONS -> 204", /req\.method === "OPTIONS"[\s\S]{0,40}res\.status\(204\)\.send/.test(w)); }
  seed(); ok("3 GET -> 405", (await call({ method: "GET", authHeader: sess("userB") })).status === 405);
  seed(); ok("4 POST sem sessao -> 401", (await call({ method: "POST", authHeader: "" })).status === 401);
  seed(); { const r = await call({ method: "POST", authHeader: sess("userB") }); const w = H.writes();
    ok("5 usa uid da sessao", w.length === 1 && w[0].id === "userB");
    ok("7 write em users/{auth.uid}", w[0].coll === "users" && w[0].op === "update");
    ok("8 limpa fcmTokens = []", Array.isArray(w[0].patch.fcmTokens) && w[0].patch.fcmTokens.length === 0);
    ok("9 limpa fcmTokenMeta = {}", w[0].patch.fcmTokenMeta && typeof w[0].patch.fcmTokenMeta === "object" && !Array.isArray(w[0].patch.fcmTokenMeta) && Object.keys(w[0].patch.fcmTokenMeta).length === 0);
    ok("10 resposta { ok:true }", r.status === 200 && r.json && r.json.ok === true);
    const s = JSON.stringify(r.json);
    ok("11 resposta sem token", !/token/i.test(s));
    ok("12 resposta sem fcmTokens", !/fcmTokens/.test(s));
    ok("13 resposta sem fcmTokenMeta", !/fcmTokenMeta/.test(s));
    ok("14 resposta sem pass/salt/hash", !/pass|salt|hash/i.test(s));
    ok("15 logs sem token", !/tok-secret/.test(JSON.stringify(H.logs()))); }
  seed(); { const r = await call({ method: "POST", authHeader: sess("userB"), body: { targetId: "adminA", uid: "adminA", userId: "adminA" } }); const w = H.writes();
    ok("6 IGNORA targetId (self-only): so o proprio uid muda", r.status === 200 && w.length === 1 && w[0].id === "userB"
       && Array.isArray(H.users().adminA.fcmTokens) && H.users().adminA.fcmTokens.length === 1 && H.users().adminA.fcmTokens[0] === "tok-secret-A"); }

  // ---------- CLIENT estatico (16-29) ----------
  const C = grabH("resetMyFcmTokensClient");
  ok("16 client resetMyFcmTokensClient existe", C.length > 0);
  ok("17 usa POST", /method:"POST"/.test(C));
  ok("18 usa sessao/Bearer", /authGetSession\(\)/.test(C) && /Authorization":"Bearer "\+s\.token/.test(C));
  ok("19 contrato {ok:true}<=>res.ok&&data.ok", /if\(!res\.ok \|\| !data \|\| data\.ok!==true\) return \{ ok:false/.test(C) && /return \{ ok:true \};/.test(C));
  ok("20 corpo vazio (nao envia token)", /body: "\{\}"/.test(C));
  ok("21 nao envia targetId", !/targetId/.test(C));

  const ci = HSRC.indexOf("Apaga tokens do Firestore");
  const cut = ci >= 0 ? HSRC.slice(ci, ci + 800) : "";
  ok("22 force-rereg chama resetMyFcmTokensClient com fcm_token_server ON", /if\(fcmTokenServerEnabled\(\)\)\{[\s\S]*?const rr2 = await resetMyFcmTokensClient\(\)/.test(cut));
  ok("23 write direto so no fallback OFF (else)", /\} else \{[\s\S]*?db\.collection\("users"\)\.doc\(me\.id\)\.update\(\{ fcmTokens: \[\], fcmTokenMeta: \{\} \}\)/.test(cut));
  const dwCount = (HSRC.match(/update\(\{ fcmTokens: \[\], fcmTokenMeta: \{\} \}\)/g) || []).length;
  ok("24 nenhum write direto INCONDICIONAL (unico e gated)", dwCount === 1 && /if\(fcmTokenServerEnabled\(\)\)\{[\s\S]*?\} else \{[\s\S]*?update\(\{ fcmTokens: \[\], fcmTokenMeta: \{\} \}\)/.test(cut));
  ok("25 fcm_token_server default ON preservado", /function fcmTokenServerEnabled\(\)\{ try\{ return lsGet\("fcm_token_server"\)!=="off"; \}catch\(_\)\{ return true; \} \}/.test(HSRC));
  ok("26 users_write_endpoints intacto (default OFF)", /function usersWriteEndpointsEnabled\(\)\{ try\{ return lsGet\("users_write_endpoints"\)==="on"; \}catch\(_\)\{ return false; \} \}/.test(HSRC));
  ok("27 deleteMyAccount intacto", grabH("deleteMyAccountClient").length > 0 && /async function handleDeleteMyAccount\(/.test(FSRC));
  ok("28 registerFcmToken intacto", /async function handleRegisterFcmToken\(/.test(FSRC) && /exports\.registerFcmToken = onRequest/.test(FSRC));
  ok("29 removeFcmToken intacto", /async function handleRemoveFcmToken\(/.test(FSRC) && /exports\.removeMyFcmToken = onRequest/.test(FSRC));

  // ---------- REGRESSAO (30-34) ----------
  let reg = true;
  try { execSync("node " + JSON.stringify(path.join(__dirname, "f3361C-users-write-endpoints.test.mjs")), { stdio: "ignore" }); } catch (_) { reg = false; }
  try { execSync("node " + JSON.stringify(path.join(__dirname, "f3361J-web-users-write-client-cutover.test.mjs")), { stdio: "ignore" }); } catch (_) { reg = false; }
  ok("30 f3361C + f3361J continuam passando", reg);
  let syn = true;
  try { execSync("node --check " + JSON.stringify(path.join(ROOT, "functions", "index.js")), { stdio: "ignore" }); } catch (_) { syn = false; }
  ok("31 functions/index.js sintaxe valida", syn);
  let st = "__gitfail__";
  try { st = execSync("git -C " + JSON.stringify(ROOT) + " status --porcelain", { encoding: "utf8" }); } catch (_) { st = "__gitfail__"; }
  const changed = st === "__gitfail__" ? [] : st.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
  const allowed = new Set(["functions/index.js", "index.html", "scripts/worker-ops/f3361R1-fcm-direct-write-cutoff.test.mjs"]);
  const disallowed = changed.filter((f) => !allowed.has(f));
  ok("32 sem Rules change", !disallowed.some((f) => /rules|firestore\.rules/i.test(f)));
  ok("33 sem Hosting workflow change", !disallowed.some((f) => /\.github\/workflows/.test(f)));
  ok("34 sem Desktop/Android/Worker/Card change", !disallowed.some((f) => /desktop|android|worker|card/i.test(f)));

  console.log("\nF3.3.61-R1: " + pass + " passaram, " + fail + " falharam (de " + (pass + fail) + ").");
  process.exit(fail ? 1 : 0);
})();
