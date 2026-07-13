#!/usr/bin/env node
/* =====================================================================
 * F3.3.71A — Testes HERMETICOS da troca segura de e-mail de login.
 * Extrai a logica REAL de functions/index.js (crypto real; Firestore MOCK):
 *   changeLoginEmail: 401 sem sessao/senha errada; 400 sem senha/email
 *   invalido/vazio/igual; 409 em uso por OUTRO (case-insensitive); 200 com
 *   update normalizado + AUDITORIA usersAudit; rate-limit 429; sem PII.
 *   adminChangeUserEmail: 403 nao-admin; 400 sem confirm literal; 404 alvo
 *   inexistente; 400 canario/nao-ativo; 409 duplicado; 200 com auditoria
 *   by/target/emailOld/emailNew/reason; sem PII.
 * Puro/offline: NAO deploya; NAO toca producao. Rodar: node <este arquivo>
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
  "notifMaskUid", "notifSignToken", "notifVerifyToken", "notifTimingSafeEq", "notifVerifyPassword",
  "authSessionSecret", "authVerifySessionToken",
  "notifRlBlocked", "notifRlFail", "notifRlClear", "notifDb",
  "uwValidStr", "uwTargetId", "authRequireAdminSession",
  "uwValidColor", "uwValidPhoto", "uwValidReminder",
  "emailInUseByOther", "emailAuditWrite",
  "handleChangeLoginEmail", "handleAdminChangeUserEmail",
  "handleUpdateUserSelf", "handleAdminUpdateUser",
];
const CONST_NAMES = ["AUTH_SESSION_TTL_MS", "EMAILCHG_CONFIRM", "EMAILCHG_MAX", "USER_SELF_UPDATE_KEYS", "USER_ADMIN_UPDATE_KEYS"];

let BODY = "";
for (const n of CONST_NAMES) BODY += grabConst(n) + "\n";
for (const n of FN_NAMES) BODY += grab(n) + "\n";

const PRELUDE = `
  var NOTIF_RL_MAX = 5, NOTIF_RL_WINDOW_MS = 5 * 60 * 1000, NOTIF_RL_BLOCK_MS = 15 * 60 * 1000;
  var __notifRlState = new Map();
  var __users = {}; var __writes = []; var __logs = []; var __addSeq = 0;
  function _mkdocs() { var ds = []; for (var k in __users) { ds.push({ id: k, data: (function (kk) { return function () { return __users[kk]; }; })(k) }); } return ds; }
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = (c === "users") ? __users[id] : undefined; return { exists: !!d, data: function () { return d || null; } }; },
      update: async function (patch) { __writes.push({ coll: c, id: id, op: "update", patch: patch }); if (c === "users" && __users[id]) { for (var k in patch) __users[id][k] = patch[k]; } return {}; }
    }; },
    get: async function () { var ds = (c === "users") ? _mkdocs() : []; return { docs: ds, forEach: function (fn) { ds.forEach(fn); } }; },
    add: async function (v) { __addSeq++; var id = "aud-" + __addSeq; __writes.push({ coll: c, id: id, op: "add", v: v }); return { id: id }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  var logger = { info: function(){__logs.push(arguments);}, warn: function(){__logs.push(arguments);}, error: function(){__logs.push(arguments);} };
`;

const SECRET = "test-secret-f3371a";
process.env.AUTH_SESSION_SECRET = SECRET;

const make = new Function("crypto", PRELUDE + BODY + `
  return {
    signToken: notifSignToken, TTL: AUTH_SESSION_TTL_MS, hashPw: hashPw, randSalt: randSalt,
    reset: function (u) { for (var k in __users) delete __users[k]; if (u) for (var kk in u) __users[kk] = u[kk]; __writes.length = 0; __logs.length = 0; __notifRlState.clear(); },
    writes: function () { return __writes; }, users: function () { return __users; },
    changeLoginEmail: handleChangeLoginEmail, adminChangeUserEmail: handleAdminChangeUserEmail,
    updateUserSelf: handleUpdateUserSelf, adminUpdateUser: handleAdminUpdateUser,
    emailAuditWrite: emailAuditWrite, selfKeys: USER_SELF_UPDATE_KEYS, adminKeys: USER_ADMIN_UPDATE_KEYS,
  };
`);
const H = make(crypto);

const NOW = 1_700_000_000_000;
function sess(uid) { return "Bearer " + H.signToken({ uid: uid, admin: false, role: "", scope: "session", iat: NOW, exp: NOW + H.TTL }, SECRET); }
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };
const call = (fn, ctx) => H[fn](Object.assign({ now: NOW, method: "POST" }, ctx));
const noSecret = (j) => !/pass|salt|token|fcm/i.test(JSON.stringify(j || {}));

const SALT_O = "aabb", PW_O = "senha-owner-123";
function seed() {
  H.reset({
    ownerU: { name: "Owner", role: "CEO", admin: true, status: "ativo", email: "owner@x.com", phone: "5511999", pass: H.hashPw(PW_O, SALT_O), salt: SALT_O },
    userB: { name: "B", role: "Editor", admin: false, status: "ativo", email: "b@x.com", pass: H.hashPw("pw-b", "s1"), salt: "s1" },
    userC: { name: "C", role: "Social", admin: false, status: "ativo", email: "c@x.com", pass: H.hashPw("pw-c", "s2"), salt: "s2" },
    dupP: { name: "Dup", role: "ceo", admin: false, status: "pendente", email: "idseven+dup@x.com", canary: false },
    canY: { name: "Canary", role: "tester", admin: false, status: "ativo", email: "canary@x.com", canary: true },
  });
}

(async () => {
  console.log("F3.3.71A — testes herméticos (handlers reais + Firestore mock)");
  // ---- S: changeLoginEmail (self) ----
  seed();
  ok("S1 sem sessao -> 401", (await call("changeLoginEmail", { authHeader: "", body: { currentPassword: PW_O, newEmail: "novo@x.com" } })).status === 401);
  seed();
  const s2 = await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: "errada", newEmail: "novo@x.com" } });
  ok("S2 senha errada -> 401 invalid_current_password", s2.status === 401 && s2.json.error === "invalid_current_password");
  seed();
  ok("S3 sem senha -> 400 missing_password", (await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { newEmail: "novo@x.com" } })).json.error === "missing_password");
  ok("S4 email invalido -> 400 bad_email", (await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: PW_O, newEmail: "nao-eh-email" } })).json.error === "bad_email");
  ok("S5 email vazio NUNCA limpa -> 400 bad_email", (await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: PW_O, newEmail: "" } })).json.error === "bad_email");
  const s6 = await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: PW_O, newEmail: "B@X.com" } });
  ok("S6 email de OUTRO (case-insensitive) -> 409 email_in_use", s6.status === 409 && s6.json.error === "email_in_use");
  ok("S7 mesmo email -> 400 same_email", (await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: PW_O, newEmail: "OWNER@x.com" } })).json.error === "same_email");
  seed();
  const s8 = await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: PW_O, newEmail: "Novo.Email@IDSeven.com.br" } });
  const w8 = H.writes();
  const upd8 = w8.find(w => w.coll === "users" && w.op === "update" && w.id === "ownerU");
  const aud8 = w8.find(w => w.coll === "usersAudit" && w.op === "add");
  ok("S8a sucesso -> 200 ok", s8.status === 200 && s8.json.ok === true);
  ok("S8b email gravado NORMALIZADO (lowercase) so no campo email", !!upd8 && upd8.patch.email === "novo.email@idseven.com.br" && Object.keys(upd8.patch).length === 1);
  ok("S8c auditoria usersAudit: type/by/target/emailOld/emailNew", !!aud8 && aud8.v.type === "email_change_self" && aud8.v.by === "ownerU" && aud8.v.target === "ownerU" && aud8.v.emailOld === "owner@x.com" && aud8.v.emailNew === "novo.email@idseven.com.br");
  ok("S8d resposta sem PII/segredo", noSecret(s8.json));
  ok("S8e estado final: users.ownerU.email atualizado", H.users().ownerU.email === "novo.email@idseven.com.br");
  seed();
  for (let i = 0; i < 5; i++) await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: "errada", newEmail: "novo@x.com" }, ip: "9.9.9.9" });
  const s10 = await call("changeLoginEmail", { authHeader: sess("ownerU"), body: { currentPassword: PW_O, newEmail: "novo@x.com" }, ip: "9.9.9.9" });
  ok("S9 rate-limit apos 5 falhas -> 429", s10.status === 429 && s10.json.error === "rate_limited");

  // ---- A: adminChangeUserEmail ----
  const CONFIRM = "ALTERAR EMAIL";
  seed();
  ok("A1 nao-admin -> 403", (await call("adminChangeUserEmail", { authHeader: sess("userB"), body: { targetId: "userC", newEmail: "n@x.com", confirm: CONFIRM } })).status === 403);
  ok("A2 sem confirm literal -> 400 missing_confirm", (await call("adminChangeUserEmail", { authHeader: sess("ownerU"), body: { targetId: "userC", newEmail: "n@x.com", confirm: "alterar email" } })).json.error === "missing_confirm");
  ok("A3 alvo inexistente -> 404", (await call("adminChangeUserEmail", { authHeader: sess("ownerU"), body: { targetId: "nope", newEmail: "n@x.com", confirm: CONFIRM } })).status === 404);
  ok("A4 alvo CANARIO -> 400 target_is_canary", (await call("adminChangeUserEmail", { authHeader: sess("ownerU"), body: { targetId: "canY", newEmail: "n@x.com", confirm: CONFIRM } })).json.error === "target_is_canary");
  ok("A5 alvo nao-ativo (pendente/removido) -> 400 target_not_active", (await call("adminChangeUserEmail", { authHeader: sess("ownerU"), body: { targetId: "dupP", newEmail: "n@x.com", confirm: CONFIRM } })).json.error === "target_not_active");
  const a6 = await call("adminChangeUserEmail", { authHeader: sess("ownerU"), body: { targetId: "userC", newEmail: "B@x.com", confirm: CONFIRM } });
  ok("A6 duplicidade com OUTRO -> 409 email_in_use", a6.status === 409 && a6.json.error === "email_in_use");
  ok("A7 mesmo email do alvo -> 400 same_email", (await call("adminChangeUserEmail", { authHeader: sess("ownerU"), body: { targetId: "userC", newEmail: "C@x.com", confirm: CONFIRM } })).json.error === "same_email");
  seed();
  const a8 = await call("adminChangeUserEmail", { authHeader: sess("ownerU"), body: { targetId: "userC", newEmail: "novo-c@x.com", confirm: CONFIRM, reason: "perdeu acesso ao e-mail antigo" } });
  const w9 = H.writes();
  const aud9 = w9.find(w => w.coll === "usersAudit" && w.op === "add");
  ok("A8a sucesso admin -> 200", a8.status === 200 && a8.json.ok === true);
  ok("A8b auditoria: by=admin, target, emailOld/New, reason", !!aud9 && aud9.v.type === "email_change_admin" && aud9.v.by === "ownerU" && aud9.v.target === "userC" && aud9.v.emailOld === "c@x.com" && aud9.v.emailNew === "novo-c@x.com" && aud9.v.reason.indexOf("perdeu") === 0);
  ok("A8c email do alvo atualizado", H.users().userC.email === "novo-c@x.com");
  ok("A8d resposta sem PII/segredo", noSecret(a8.json));
  ok("A9 permanece: alvo troca nao mexe em pass/salt/status/admin", H.users().userC.pass && H.users().userC.salt === "s2" && H.users().userC.status === "ativo" && H.users().userC.admin === false);

  // ---- U: F3.3.72C — corte de e-mail nos endpoints LEGADOS + retry da auditoria ----
  seed();
  const u1 = await call("updateUserSelf", { authHeader: sess("ownerU"), body: { email: "hack@x.com" } });
  ok("U1 self com email -> 400 email_change_dedicated_flow", u1.status === 400 && u1.json.error === "email_change_dedicated_flow");
  const u2 = await call("updateUserSelf", { authHeader: sess("ownerU"), body: { email: "" } });
  ok("U2 self com email VAZIO -> 400 (nunca limpa e-mail)", u2.status === 400 && u2.json.error === "email_change_dedicated_flow");
  seed();
  const u3 = await call("updateUserSelf", { authHeader: sess("ownerU"), body: { name: "Owner Novo", color: "#112233" } });
  const wu3 = H.writes().find(w => w.coll === "users" && w.op === "update" && w.id === "ownerU");
  ok("U3 self demais campos seguem OK (name/color) sem email", u3.status === 200 && !!wu3 && wu3.patch.name === "Owner Novo" && wu3.patch.color === "#112233" && !("email" in wu3.patch));
  ok("U4 self sem sessao -> 401", (await call("updateUserSelf", { authHeader: "", body: { name: "x" } })).status === 401);
  seed();
  const u5 = await call("adminUpdateUser", { authHeader: sess("ownerU"), body: { targetId: "userB", patch: { email: "hack@x.com" } } });
  ok("U5 admin patch com email -> 400 email_change_dedicated_flow", u5.status === 400 && u5.json.error === "email_change_dedicated_flow");
  const u6 = await call("adminUpdateUser", { authHeader: sess("ownerU"), body: { targetId: "userB", patch: { email: "" } } });
  ok("U6 admin patch com email VAZIO -> 400 (nunca limpa e-mail)", u6.status === 400 && u6.json.error === "email_change_dedicated_flow");
  seed();
  const u7 = await call("adminUpdateUser", { authHeader: sess("ownerU"), body: { targetId: "userB", patch: { name: "B2", role: "Editor2" } } });
  const wu7 = H.writes().find(w => w.coll === "users" && w.op === "update" && w.id === "userB");
  ok("U7 admin demais campos seguem OK (name/role) sem email", u7.status === 200 && !!wu7 && wu7.patch.name === "B2" && wu7.patch.role === "Editor2" && !("email" in wu7.patch));
  ok("U8 admin nao-admin segue bloqueado -> 403", (await call("adminUpdateUser", { authHeader: sess("userB"), body: { targetId: "userC", patch: { name: "x" } } })).status === 403);
  ok("U9 allowlists sem email (self e admin)", H.selfKeys.indexOf("email") < 0 && H.adminKeys.indexOf("email") < 0);
  ok("U10 email do alvo INTACTO apos tentativas", H.users().userB.email === "b@x.com" && H.users().ownerU.email === "owner@x.com");
  // retry do audit-write: falha 1x -> sucesso na 2a (true); falha 2x -> false, sem lancar
  let fails = 1;
  const dbFlaky = { collection: () => ({ add: async () => { if (fails-- > 0) throw new Error("indisponivel"); return { id: "a1" }; } }) };
  ok("U11 emailAuditWrite: 1 falha + retry -> true", (await H.emailAuditWrite(dbFlaky, { type: "t", by: "u", target: "u" })) === true);
  const dbDead = { collection: () => ({ add: async () => { throw new Error("indisponivel"); } }) };
  ok("U12 emailAuditWrite: 2 falhas -> false (best-effort, sem lancar)", (await H.emailAuditWrite(dbDead, { type: "t", by: "u", target: "u" })) === false);

  console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
  process.exit(fail ? 1 : 0);
})();
