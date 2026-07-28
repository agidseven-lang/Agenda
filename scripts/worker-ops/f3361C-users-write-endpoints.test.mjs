#!/usr/bin/env node
/* =====================================================================
 * F3.3.61-C — Testes dos endpoints Admin SDK de escrita em /users.
 * Extrai a logica REAL de functions/index.js (notifSignToken/notifVerifyToken/
 * authVerifySessionToken/authSessionSecret/notifMaskUid/notifRl*, hashPw/randSalt,
 * authUserPublicOut, uw*, authRequireAdminSession + handlers) com crypto real e
 * admin.firestore() MOCKADO (store __users; captura __writes; __logs). Prova:
 *   - authRequireAdminSession: sem sessao/invalida => 401; nao-admin/inativo => 403; admin => ok;
 *   - updateUserSelf: color/photo/reminderMinutes OK; admin/status/pass/salt/fcmTokens => 400;
 *     so escreve o proprio uid; nunca PII;
 *   - touchUserLastSeen: so lastSeen do self; campo extra => 400;
 *   - adminCreateUser: exige admin; gera pass/salt server-side; NUNCA retorna pass/salt;
 *   - adminUpdateUser: allowlist; rejeita pass/salt/admin/status; 404 se ausente;
 *   - adminSetUserStatus: admin; so status permitido;
 *   - adminSetUserAdmin: admin; boolean; bloqueia ULTIMO admin (409);
 *   - disableUser: admin; marca inativo/disabled sem delete; nao-self; nao ultimo-admin.
 *   - NENHUM handler retorna pass/salt/fcmTokens em nenhuma resposta.
 * Puro/offline: NAO deploya; NAO toca producao; NAO usa Firestore real.
 * Rodar: node scripts/worker-ops/f3361C-users-write-endpoints.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

function grab(n) {
  let a = SRC.indexOf("async function " + n + "(");
  if (a < 0) a = SRC.indexOf("function " + n + "(");
  if (a < 0) throw new Error("nao encontrei fn: " + n);
  let d = 0;
  for (let j = SRC.indexOf("{", a); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return SRC.slice(a, j + 1); }
  }
  throw new Error("sem fim: " + n);
}
function grabConst(n) {
  const m = new RegExp("^const " + n + "\\b[^\\n]*$", "m").exec(SRC);
  if (!m) throw new Error("nao encontrei const: " + n);
  return m[0];
}

const FN_NAMES = [
  "sha256Hex", "hashPw", "randSalt", "normEmail", "isValidEmail",
  "notifMaskUid", "notifSignToken", "notifVerifyToken",
  "authSessionSecret", "authVerifySessionToken", "authUserPublicOut",
  "notifRlBlocked", "notifRlFail", "notifRlClear", "notifDb",
  "uwValidColor", "uwValidPhoto", "uwValidReminder", "uwValidStr", "uwTargetId",
  "authRequireAdminSession", "handleUpdateUserSelf", "handleTouchUserLastSeen",
  "handleAdminCreateUser", "handleAdminUpdateUser", "handleAdminSetUserStatus",
  "handleAdminSetUserAdmin", "handleDisableUser",
  // F4.3C2: as mutacoes admin agora incrementam sessionVersion via este helper (revogacao server-side).
  // Grab aditivo p/ o harness linkar a nova dependencia; assercoes inalteradas (checam campos, nao o shape).
  "authBumpUserSessionTx",
];
const CONST_NAMES = ["AUTH_SESSION_TTL_MS", "CHPW_MIN_LEN", "CHPW_MAX_LEN",
  "USER_SELF_UPDATE_KEYS", "USER_ADMIN_UPDATE_KEYS", "USER_STATUS_VALUES"];

let BODY = "";
for (const n of CONST_NAMES) BODY += grabConst(n) + "\n";
for (const n of FN_NAMES) BODY += grab(n) + "\n";

const PRELUDE = `
  var NOTIF_RL_MAX = 5, NOTIF_RL_WINDOW_MS = 5 * 60 * 1000, NOTIF_RL_BLOCK_MS = 15 * 60 * 1000;
  var __notifRlState = new Map();
  var __users = {}; var __writes = []; var __logs = []; var __addSeq = 0;
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = (c === "users") ? __users[id] : undefined; return { exists: !!d, data: function () { return d || null; } }; },
      update: async function (patch) { __writes.push({ coll: c, id: id, op: "update", patch: patch }); if (c === "users" && __users[id]) { for (var k in patch) __users[id][k] = patch[k]; } return {}; },
      set: async function (v) { __writes.push({ coll: c, id: id, op: "set", v: v }); if (c === "users") __users[id] = v; return {}; }
    }; },
    add: async function (v) { __addSeq++; var id = "gen-" + __addSeq; __writes.push({ coll: c, id: id, op: "add", v: v }); if (c === "users") __users[id] = v; return { id: id }; },
    where: function (field, op, val) { return {
      get: async function () {
        var docs = [];
        for (var k in __users) { if (__users[k] && __users[k][field] === val) docs.push({ id: k, data: (function (kk) { return function () { return __users[kk]; }; })(k) }); }
        return { forEach: function (fn) { docs.forEach(fn); }, size: docs.length, docs: docs };
      }
    }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  var logger = {
    info: function () { __logs.push(Array.prototype.slice.call(arguments)); },
    warn: function () { __logs.push(Array.prototype.slice.call(arguments)); },
    error: function () { __logs.push(Array.prototype.slice.call(arguments)); }
  };
`;

const SECRET = "test-secret-f3361c";
process.env.AUTH_SESSION_SECRET = SECRET;

const make = new Function("crypto", PRELUDE + BODY + `
  return {
    signToken: notifSignToken, TTL: AUTH_SESSION_TTL_MS,
    reset: function (u) { for (var k in __users) delete __users[k]; if (u) for (var kk in u) __users[kk] = u[kk]; __writes.length = 0; __logs.length = 0; __notifRlState.clear(); },
    writes: function () { return __writes; }, logs: function () { return __logs; }, users: function () { return __users; },
    updateUserSelf: handleUpdateUserSelf, touchUserLastSeen: handleTouchUserLastSeen,
    adminCreateUser: handleAdminCreateUser, adminUpdateUser: handleAdminUpdateUser,
    adminSetUserStatus: handleAdminSetUserStatus, adminSetUserAdmin: handleAdminSetUserAdmin,
    disableUser: handleDisableUser,
  };
`);
const H = make(crypto);

const NOW = 1_700_000_000_000;
function sess(uid, admin) {
  const claims = { uid: uid, admin: admin === true, role: "", scope: "session", iat: NOW, exp: NOW + H.TTL };
  return "Bearer " + H.signToken(claims, SECRET);
}
function badSess() { return "Bearer eyJ.invalid.sig"; }

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };
const call = (fn, ctx) => H[fn](Object.assign({ now: NOW }, ctx));

// seed: adminA (admin), userB (comum), adminC (2o admin)
function seed() { H.reset({
  adminA: { name: "A", role: "R", admin: true, status: "ativo", pass: "s2:x", salt: "s", email: "a@x.com", phone: "1", fcmTokens: ["t"] },
  userB:  { name: "B", role: "R", admin: false, status: "ativo", pass: "s2:y", salt: "s2", color: "#000000" },
  adminC: { name: "C", role: "R", admin: true, status: "ativo", pass: "s2:z", salt: "s3" },
}); }

// nenhuma resposta pode conter pass/salt/fcmTokens
function noSecret(j) { const s = JSON.stringify(j || {}); return !/pass|salt|fcmTokens/i.test(s); }

(async () => {
  // ---- A. authRequireAdminSession (via adminSetUserStatus como porta) ----
  seed();
  ok("A1 sem sessao -> 401", (await call("adminSetUserStatus", { authHeader: "", body: { targetId: "userB", status: "ativo" } })).status === 401);
  ok("A2 sessao invalida -> 401", (await call("adminSetUserStatus", { authHeader: badSess(), body: { targetId: "userB", status: "ativo" } })).status === 401);
  ok("A3 nao-admin -> 403", (await call("adminSetUserStatus", { authHeader: sess("userB", false), body: { targetId: "adminA", status: "ativo" } })).status === 403);
  { const r = await call("adminSetUserStatus", { authHeader: sess("adminA", true), body: { targetId: "userB", status: "inativo" } }); ok("A4 admin -> 200", r.status === 200); }
  { seed(); H.users().adminA.status = "pendente"; const r = await call("adminSetUserStatus", { authHeader: sess("adminA", true), body: { targetId: "userB", status: "ativo" } }); ok("A5 admin inativo -> 403", r.status === 403); }
  { seed(); const r = await call("adminSetUserStatus", { authHeader: sess("ghost", true), body: { targetId: "userB", status: "ativo" } }); ok("A6 caller inexistente -> 403", r.status === 403); }

  // ---- B. updateUserSelf ----
  seed();
  { const r = await call("updateUserSelf", { authHeader: sess("userB", false), body: { color: "#112233", reminderMinutes: 30 } }); ok("B1 self color/reminder -> 200", r.status === 200 && H.users().userB.color === "#112233" && H.users().userB.reminderMinutes === 30); }
  ok("B2 rejeita admin", (await call("updateUserSelf", { authHeader: sess("userB", false), body: { admin: true } })).json.error === "forbidden_field");
  ok("B3 rejeita status", (await call("updateUserSelf", { authHeader: sess("userB", false), body: { status: "ativo" } })).json.error === "forbidden_field");
  ok("B4 rejeita pass/salt", (await call("updateUserSelf", { authHeader: sess("userB", false), body: { pass: "x", salt: "y" } })).json.error === "forbidden_field");
  ok("B5 rejeita fcmTokens", (await call("updateUserSelf", { authHeader: sess("userB", false), body: { fcmTokens: [] } })).json.error === "forbidden_field");
  ok("B6 rejeita vazio", (await call("updateUserSelf", { authHeader: sess("userB", false), body: {} })).status === 400);
  ok("B7 color invalida -> 400", (await call("updateUserSelf", { authHeader: sess("userB", false), body: { color: "red" } })).json.error === "bad_color");
  ok("B8 reminder fora de faixa -> 400", (await call("updateUserSelf", { authHeader: sess("userB", false), body: { reminderMinutes: 99999 } })).json.error === "bad_reminder");
  { seed(); await call("updateUserSelf", { authHeader: sess("userB", false), body: { photo: "u" } }); const w = H.writes(); ok("B9 so escreve o proprio uid", w.length === 1 && w[0].id === "userB"); }
  ok("B10 sem sessao -> 401", (await call("updateUserSelf", { authHeader: "", body: { color: "#000000" } })).status === 401);

  // ---- C. touchUserLastSeen ----
  seed();
  { const r = await call("touchUserLastSeen", { authHeader: sess("userB", false), body: {} }); ok("C1 lastSeen do self -> 200", r.status === 200 && H.users().userB.lastSeen === NOW && H.writes()[0].id === "userB"); }
  ok("C2 rejeita campo extra", (await call("touchUserLastSeen", { authHeader: sess("userB", false), body: { admin: true } })).status === 400);
  ok("C3 sem sessao -> 401", (await call("touchUserLastSeen", { authHeader: "", body: {} })).status === 401);

  // ---- D. adminCreateUser ----
  seed();
  { const r = await call("adminCreateUser", { authHeader: sess("adminA", true), body: { name: "Novo", role: "R", email: "n@x.com", status: "ativo", senhaInicial: "segredo123" } });
    ok("D1 admin cria -> 200 + id", r.status === 200 && r.json.ok && r.json.id);
    ok("D2 doc gerou pass/salt internamente", (() => { const id = r.json.id; const d = H.users()[id]; return d && typeof d.pass === "string" && d.pass.indexOf("s2:") === 0 && typeof d.salt === "string" && d.admin === false; })());
    ok("D3 resposta NUNCA retorna pass/salt", noSecret(r.json) && !("pass" in (r.json.user || {})) && !("salt" in (r.json.user || {})));
  }
  ok("D4 nao-admin -> 403", (await call("adminCreateUser", { authHeader: sess("userB", false), body: { name: "X", role: "R", status: "ativo", senhaInicial: "segredo123" } })).status === 403);
  ok("D5 senha fraca -> 400", (await call("adminCreateUser", { authHeader: sess("adminA", true), body: { name: "X", role: "R", status: "ativo", senhaInicial: "123" } })).json.error === "weak_password");
  ok("D6 status invalido -> 400", (await call("adminCreateUser", { authHeader: sess("adminA", true), body: { name: "X", role: "R", status: "hacker", senhaInicial: "segredo123" } })).json.error === "bad_status");

  // ---- E. adminUpdateUser ----
  seed();
  { const r = await call("adminUpdateUser", { authHeader: sess("adminA", true), body: { targetId: "userB", patch: { name: "B2", role: "X" } } }); ok("E1 admin edita allowlist -> 200", r.status === 200 && H.users().userB.name === "B2"); }
  ok("E2 rejeita campo sensivel (pass)", (await call("adminUpdateUser", { authHeader: sess("adminA", true), body: { targetId: "userB", patch: { pass: "x" } } })).json.error === "forbidden_field");
  ok("E3 rejeita admin/status", (await call("adminUpdateUser", { authHeader: sess("adminA", true), body: { targetId: "userB", patch: { admin: true } } })).json.error === "forbidden_field");
  ok("E4 target ausente -> 404", (await call("adminUpdateUser", { authHeader: sess("adminA", true), body: { targetId: "ghost", patch: { name: "Z" } } })).status === 404);
  ok("E5 nao-admin -> 403", (await call("adminUpdateUser", { authHeader: sess("userB", false), body: { targetId: "adminA", patch: { name: "Z" } } })).status === 403);

  // ---- F. adminSetUserStatus ----
  seed();
  { const r = await call("adminSetUserStatus", { authHeader: sess("adminA", true), body: { targetId: "userB", status: "inativo" } }); ok("F1 admin set status -> 200", r.status === 200 && H.users().userB.status === "inativo"); }
  ok("F2 status invalido -> 400", (await call("adminSetUserStatus", { authHeader: sess("adminA", true), body: { targetId: "userB", status: "zumbi" } })).json.error === "bad_status");

  // ---- G. adminSetUserAdmin ----
  seed();
  { const r = await call("adminSetUserAdmin", { authHeader: sess("adminA", true), body: { targetId: "userB", admin: true } }); ok("G1 promove -> 200", r.status === 200 && H.users().userB.admin === true); }
  ok("G2 admin nao-boolean -> 400", (await call("adminSetUserAdmin", { authHeader: sess("adminA", true), body: { targetId: "userB", admin: "yes" } })).json.error === "bad_admin");
  { const r = await call("adminSetUserAdmin", { authHeader: sess("adminA", true), body: { targetId: "userB", admin: false } }); ok("G3 rebaixa userB (adminA+C sobram) -> 200", r.status === 200); }
  { H.reset({ soloAdmin: { admin: true, status: "ativo" } }); const r = await call("adminSetUserAdmin", { authHeader: sess("soloAdmin", true), body: { targetId: "soloAdmin", admin: false } }); ok("G4 ULTIMO admin -> 409", r.status === 409 && r.json.error === "last_admin"); }

  // ---- H. disableUser ----
  seed();
  { const r = await call("disableUser", { authHeader: sess("adminA", true), body: { targetId: "userB" } }); ok("H1 desativa sem delete -> 200", r.status === 200 && H.users().userB.status === "inativo" && H.users().userB.disabled === true && H.users().userB.name === "B"); }
  ok("H2 nao-self", (await call("disableUser", { authHeader: sess("adminA", true), body: { targetId: "adminA" } })).json.error === "cannot_disable_self");
  { H.reset({ soloAdmin: { admin: true, status: "ativo" }, other: { admin: false, status: "ativo" } }); const r = await call("disableUser", { authHeader: sess("soloAdmin", true), body: { targetId: "soloAdmin" } }); ok("H3 disable self bloqueado antes de last-admin", r.json.error === "cannot_disable_self"); }
  ok("H4 nao-admin -> 403", (await call("disableUser", { authHeader: sess("userB", false), body: { targetId: "adminA" } })).status === 403);

  // ---- Global: nenhuma resposta 200 vaza pass/salt/fcmTokens ----
  seed();
  const resps = [
    await call("updateUserSelf", { authHeader: sess("userB", false), body: { color: "#010203" } }),
    await call("adminCreateUser", { authHeader: sess("adminA", true), body: { name: "Z", role: "R", status: "ativo", senhaInicial: "segredo123" } }),
    await call("adminSetUserStatus", { authHeader: sess("adminA", true), body: { targetId: "userB", status: "ativo" } }),
  ];
  ok("GLOBAL nenhuma resposta vaza pass/salt/fcmTokens", resps.every((r) => noSecret(r.json)));

  console.log(`\n==== F3.3.61-C USERS-WRITE ENDPOINTS ${pass} PASS / ${fail} FAIL ====`);
  process.exit(fail === 0 ? 0 : 1);
})();
