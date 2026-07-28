#!/usr/bin/env node
/* =====================================================================
 * F4.3C2 — REVOGAÇÃO server-side (sessionVersion) + endurecimento de endpoints.
 * Extrai a lógica REAL de functions/index.js (grab por nome) e roda com crypto
 * REAL + admin/Firestore MOCKADOS (transação com read-inside-tx e retry). Prova:
 * sessão ativa (reload+versão), revogação, incremento atômico em senha/reset/
 * status/admin/disable/delete, gate no issueFirebaseAuthToken e FCM, RateLimiter
 * substituível, auditoria sanitizada, TTL server-side e migração compat/strict.
 * Puro/offline; NÃO require(); NÃO rede; NÃO segredo real (env sintético).
 * Rodar: node scripts/worker-ops/f43c2-session-revocation.test.mjs
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

// Funções REAIS extraídas (F4.3C2 + primitivas reutilizadas).
const NAMES = [
  "notifMaskUid", "notifDjb2", "authUserPublicOut", "authFcmReadState", "authMaskFcmToken",
  "notifSignToken", "notifVerifyToken", "notifVerifyPassword", "notifTimingSafeEq",
  "authSessionSecret", "authVerifySessionToken",
  "authSessionTtlMs", "authSessionVersionOf", "authSessionMigrationMode", "authSessionMigrationDeadlineMs",
  "authSessionVersionDecision", "authRequireActiveSession", "authBumpUserSessionTx",
  "authNewCorrelationId", "authAuditEvent", "createRateLimiter",
  "notifRlBlocked", "notifRlFail", "notifRlClear",
  "handleLoginUser", "handleIssueFirebaseAuthToken", "handleRevokeMySession",
  "handleRegisterFcmToken", "handleRemoveFcmToken",
  "authRequireAdminSession", "handleChangePassword", "handleDeleteMyAccount",
];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

// PRELUDE: constantes de módulo (NÃO são funções → não são grabbed) + fakes de admin/logger/db.
const PRELUDE = `
  var AUTH_SESSION_SCHEMA_VERSION = 1;
  var AUTH_SESSION_TTL_DEFAULT_MS = 24*60*60*1000, AUTH_SESSION_TTL_MAX_MS = 24*60*60*1000, AUTH_SESSION_TTL_MIN_MS = 5*60*1000;
  var AUTH_INACTIVE_STATUSES = ["pendente","removido","excluido"];
  var AUTH_SESSION_TTL_MS = 24*60*60*1000;
  var FCM_TOKEN_MAX_LEN = 4096, FCM_DEVICE_MAX_LEN = 200, FCM_PLATFORM_MAX_LEN = 64;
  var CHPW_MIN_LEN = 6, CHPW_MAX_LEN = 512;   // limites de troca de senha (validacao de corpo)
  var NOTIF_RL_MAX = 5, NOTIF_RL_WINDOW_MS = 5*60*1000, NOTIF_RL_BLOCK_MS = 15*60*1000;
  var __notifRlState = new Map();   // estado do rate-limit login/notif (self-contained, sem PII)
  // Logger fake que CAPTURA eventos de auditoria ("[audit]") num buffer, p/ provar emissão
  // ponta-a-ponta (login_success/login_failure etc.) SEM vazar nada: guardamos só o objeto já
  // sanitizado que authAuditEvent passa (event/correlationId/uid-mascarado/status/sessionVersion/at).
  var __auditLog = [];
  var logger = {
    info: function(tag, obj){ if (tag === "[audit]" && obj) __auditLog.push(obj); },
    warn: function(){}, error: function(){}
  };
  var admin = { auth: function(){ return { createCustomToken: async function(uid){ return "CUSTOM:" + uid; } }; } };
  // ---- Firestore FAKE (store por chave "coll/id"; transação read-inside-tx + retry opcional) ----
  var __store = {};
  var __concurrentHook = null;   // função chamada 1x dentro do 1o get da tx (simula commit concorrente)
  function __ref(coll, id){
    var key = coll + "/" + id;
    return { id: id, _key: key,
      get: async function(){ var d = __store[key]; return { exists: d !== undefined && d !== null, id: id, data: function(){ return d ? Object.assign({}, d) : null; } }; },
      set: async function(data, opts){ __store[key] = (opts && opts.merge && __store[key]) ? Object.assign({}, __store[key], data) : Object.assign({}, data); return {}; },
      update: async function(data){ if (__store[key] == null) throw new Error("no-doc"); __store[key] = Object.assign({}, __store[key], data); return {}; }
    };
  }
  function __verOf(d){ return (d && Number.isInteger(d.sessionVersion)) ? d.sessionVersion : (d ? -1 : "none"); }
  var __fakeDb = {
    collection: function(c){ return {
      doc: function(id){ return __ref(c, id); },
      get: async function(){ var docs = []; Object.keys(__store).forEach(function(k){ if (k.indexOf(c + "/") === 0) { var id = k.slice((c+"/").length); var d = __store[k]; docs.push({ id: id, data: function(){ return Object.assign({}, d); } }); } }); return { forEach: function(cb){ docs.forEach(cb); }, docs: docs, size: docs.length }; }
    }; },
    runTransaction: async function(fn){
      for (var attempt = 0; attempt < 6; attempt++){
        var reads = {}; var hooked = false;
        var tx = { __ops: [],
          get: async function(ref){ var d = __store[ref._key]; reads[ref._key] = __verOf(d);
            if (!hooked && __concurrentHook) { hooked = true; var h = __concurrentHook; __concurrentHook = null; await h(); }
            var d2 = __store[ref._key]; return { exists: d2 !== undefined && d2 !== null, id: ref.id, data: function(){ return d2 ? Object.assign({}, d2) : null; } }; },
          set: function(ref, data, opts){ tx.__ops.push({ k: ref._key, data: data, merge: !!(opts && opts.merge) }); },
          update: function(ref, data){ tx.__ops.push({ k: ref._key, data: data, merge: true }); }
        };
        var result = await fn(tx);
        var conflict = false;
        Object.keys(reads).forEach(function(k){ if (__verOf(__store[k]) !== reads[k]) conflict = true; });
        if (conflict) continue;   // retenta (optimistic) — prova ausência de lost-update
        tx.__ops.forEach(function(op){ __store[op.k] = (op.merge && __store[op.k]) ? Object.assign({}, __store[op.k], op.data) : Object.assign({}, op.data); });
        return result;
      }
      throw new Error("tx_max_retries");
    }
  };
  function notifDb(){ return __fakeDb; }
  var __defaultRateLimiter, __adminRateLimiter;
`;

const api = new Function("crypto", "process", PRELUDE + BODY + `
  ; __defaultRateLimiter = createRateLimiter({ max: NOTIF_RL_MAX, windowMs: NOTIF_RL_WINDOW_MS, blockMs: NOTIF_RL_BLOCK_MS });
  __adminRateLimiter = createRateLimiter({ max: 30, windowMs: 60000, blockMs: 60000 });
  return {
    notifSignToken, notifVerifyToken, authVerifySessionToken, authSessionTtlMs, authSessionVersionOf,
    authSessionVersionDecision, authRequireActiveSession, authBumpUserSessionTx, authAuditEvent, authNewCorrelationId,
    createRateLimiter, handleLoginUser, handleIssueFirebaseAuthToken, handleRevokeMySession,
    handleRegisterFcmToken, handleRemoveFcmToken, authRequireAdminSession,
    handleChangePassword, handleDeleteMyAccount,
    db: __fakeDb,
    setUser: function(id, u){ __store["users/" + id] = u; },
    getUser: function(id){ return __store["users/" + id]; },
    reset: function(){ for (var k in __store) delete __store[k]; },
    setHook: function(fn){ __concurrentHook = fn; },
    auditLog: function(){ return __auditLog.slice(); },
    clearAudit: function(){ __auditLog.length = 0; },
  };
`)(crypto, process);

// ---------------- helpers de teste ----------------
const SECRET = "test_session_secret_f43c2";
process.env.AUTH_SESSION_SECRET = SECRET;
let PASS = 0, FAIL = 0;
function ok(cond, msg) { if (cond) { PASS++; } else { FAIL++; console.error("  ✗ FALHOU: " + msg); } }
function eq(a, b, msg) { ok(a === b, msg + " (esperado " + JSON.stringify(b) + ", obtido " + JSON.stringify(a) + ")"); }

function mkToken(claims) { return "Bearer " + api.notifSignToken(claims, SECRET); }
function sessionClaims(uid, over) { return Object.assign({ uid: uid, admin: false, role: "designer", scope: "session", schemaVersion: 1, sessionVersion: 0, iat: 1000, exp: 9e15 }, over || {}); }
function passHash(salt, pw) { return "s2:" + crypto.createHash("sha256").update(String(salt) + "|" + String(pw)).digest("hex"); }

async function run() {
  const A = api;

  // ============ SESSÃO (1..12) ============
  A.reset(); A.setUser("U1", { role: "designer", status: "ativo", sessionVersion: 0 });
  // 1. sessão válida + versão correta → ativa
  let r = await A.authRequireActiveSession({ authHeader: mkToken(sessionClaims("U1")), db: A.db, now: 2000 });
  ok(r.ok === true && r.uid === "U1", "1. sessão válida+versão correta = ativa");
  // 2. assinatura inválida → invalid_session
  let bad = mkToken(sessionClaims("U1")).slice(0, -3) + "zzz";
  r = await A.authRequireActiveSession({ authHeader: bad, db: A.db, now: 2000 });
  ok(r.ok === false && r.status === 401, "2. assinatura inválida = 401");
  // 3. sessão expirada → 401
  r = await A.authRequireActiveSession({ authHeader: mkToken(sessionClaims("U1", { exp: 500 })), db: A.db, now: 2000 });
  ok(r.ok === false && r.status === 401, "3. sessão expirada = 401");
  // 4. schemaVersion ausente (legado) + doc v0 + compat → aceita
  r = await A.authRequireActiveSession({ authHeader: mkToken({ uid: "U1", scope: "session", exp: 9e15 }), db: A.db, mode: "compat", now: 2000 });
  ok(r.ok === true, "4. schemaVersion ausente + compat + doc v0 = aceita");
  // 5. schemaVersion inválido (não-numérico) tratado como legado
  let d5 = A.authSessionVersionDecision({ schemaVersion: "x", sessionVersion: 0, uid: "U1" }, { sessionVersion: 0 }, { mode: "compat", nowMs: 1 });
  ok(d5.ok === true, "5. schemaVersion inválido → tratado como legado (compat, v0)");
  // 6. sessionVersion ausente → legado
  let d6 = A.authSessionVersionDecision({ schemaVersion: 1, uid: "U1" }, { sessionVersion: 0 }, { mode: "strict" });
  ok(d6.ok === false && d6.reason === "legacy_rejected", "6. sessionVersion ausente + strict = legacy_rejected");
  // 7. sessionVersion divergente → version_mismatch
  let d7 = A.authSessionVersionDecision({ schemaVersion: 1, sessionVersion: 0 }, { sessionVersion: 3 }, {});
  ok(d7.ok === false && d7.reason === "version_mismatch", "7. sessionVersion divergente = version_mismatch");
  // 8. usuário inexistente → 401 (anti-enumeração)
  A.reset();
  r = await A.authRequireActiveSession({ authHeader: mkToken(sessionClaims("GHOST")), db: A.db, now: 2000 });
  ok(r.ok === false && r.status === 401, "8. usuário inexistente = 401");
  // 9. usuário inativo → 403
  A.reset(); A.setUser("U1", { status: "removido", sessionVersion: 0 });
  r = await A.authRequireActiveSession({ authHeader: mkToken(sessionClaims("U1")), db: A.db, now: 2000 });
  ok(r.ok === false && r.status === 403, "9. usuário inativo = 403");
  // 10. usuário excluído (disabled) → 403
  A.reset(); A.setUser("U1", { status: "ativo", disabled: true, sessionVersion: 0 });
  r = await A.authRequireActiveSession({ authHeader: mkToken(sessionClaims("U1")), db: A.db, now: 2000 });
  ok(r.ok === false && r.status === 403, "10. usuário disabled = 403");
  // 11. token malformado → 401
  r = await A.authRequireActiveSession({ authHeader: "Bearer not-a-token", db: A.db, now: 2000 });
  ok(r.ok === false && r.status === 401, "11. token malformado = 401");
  // 12. TTL SEMPRE server-side (ignora qualquer TTL do cliente): default 24h; env reduz; nunca do body
  delete process.env.AUTH_SESSION_TTL_MS; eq(A.authSessionTtlMs(), 24 * 60 * 60 * 1000, "12a. TTL default = 24h (server)");
  process.env.AUTH_SESSION_TTL_MS = String(8 * 60 * 60 * 1000); eq(A.authSessionTtlMs(), 8 * 60 * 60 * 1000, "12b. TTL configurável via env = 8h");
  process.env.AUTH_SESSION_TTL_MS = String(99 * 60 * 60 * 1000); eq(A.authSessionTtlMs(), 24 * 60 * 60 * 1000, "12c. TTL acima do teto → clamp 24h");
  delete process.env.AUTH_SESSION_TTL_MS;

  // ============ REVOGAÇÃO (13..18) ============
  A.reset(); A.setUser("U1", { status: "ativo", role: "designer", sessionVersion: 0 });
  // 13. revokeMySession incrementa versão
  r = await A.handleRevokeMySession({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 0 })), body: {}, db: A.db, now: 3000 });
  ok(r.status === 200 && r.json.revoked === true, "13a. revoke = 200 revoked");
  eq(A.getUser("U1").sessionVersion, 1, "13b. sessionVersion 0→1");
  // 14. idempotente por estado: 2ª chamada com o MESMO token (v0, agora obsoleto) → 401; versão não muda
  r = await A.handleRevokeMySession({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 0 })), body: {}, db: A.db, now: 3100 });
  ok(r.status === 401, "14a. 2ª revoke com token obsoleto = 401");
  eq(A.getUser("U1").sessionVersion, 1, "14b. sem duplo incremento (segue 1)");
  // 15. não revoga outro uid (uid vem só da sessão; body ignorado)
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0 }); A.setUser("U2", { status: "ativo", sessionVersion: 0 });
  r = await A.handleRevokeMySession({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 0 })), body: { uid: "U2", targetId: "U2" }, db: A.db, now: 3000 });
  ok(r.status === 200 && A.getUser("U1").sessionVersion === 1 && A.getUser("U2").sessionVersion === 0, "15. revoke não afeta outro uid");
  // 16. logout (revoke) invalida a sessão anterior no issueFirebaseAuthToken
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0 });
  await A.handleRevokeMySession({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 0 })), body: {}, db: A.db, now: 3000 });
  r = await A.handleIssueFirebaseAuthToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 0 })), db: A.db, now: 3200 });
  ok(r.status === 401, "16. sessão anterior (v0) rejeitada após revogação (v1)");
  // 17. nova sessão após revogação funciona (mint lê v1)
  r = await A.handleIssueFirebaseAuthToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 1 })), db: A.db, now: 3200 });
  ok(r.status === 200 && r.json.ok === true, "17. nova sessão (v1) após revogação funciona");
  // 18. revogação concorrente NÃO perde incremento (transação re-lê e retenta)
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0 });
  A.setHook(async function () { await A.authBumpUserSessionTx(A.db, "U1", { concurrent: true }); }); // commit concorrente durante o get
  await A.authBumpUserSessionTx(A.db, "U1", { self: true });
  eq(A.getUser("U1").sessionVersion, 2, "18. concorrência: dois incrementos → v2 (sem lost-update)");

  // ============ SENHA E STATUS (19..25) — incremento atômico ============
  // 19. troca de senha incrementa versão (helper transacional é o mesmo path do handleChangePassword)
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 4, pass: "x", salt: "y" });
  await A.authBumpUserSessionTx(A.db, "U1", { pass: "new", salt: "s" });
  eq(A.getUser("U1").sessionVersion, 5, "19. troca de senha: v4→v5 (atômico)");
  ok(A.getUser("U1").pass === "new", "19b. senha aplicada na MESMA transação");
  // 20. reset confirmado incrementa versão
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0 });
  await A.authBumpUserSessionTx(A.db, "U1", { pass: "p", salt: "s", passwordChangedAt: 1 });
  eq(A.getUser("U1").sessionVersion, 1, "20. reset confirmado: v0→v1");
  // 21. desativação incrementa versão
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 2 });
  await A.authBumpUserSessionTx(A.db, "U1", { status: "inativo", disabled: true });
  eq(A.getUser("U1").sessionVersion, 3, "21. desativação: v2→v3");
  // 22. exclusão incrementa versão
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0 });
  await A.authBumpUserSessionTx(A.db, "U1", { status: "excluido" });
  eq(A.getUser("U1").sessionVersion, 1, "22. exclusão: v0→v1");
  // 23. mudança de role incrementa versão
  A.reset(); A.setUser("U1", { status: "ativo", role: "designer", sessionVersion: 0 });
  await A.authBumpUserSessionTx(A.db, "U1", { role: "admin" });
  eq(A.getUser("U1").sessionVersion, 1, "23. mudança de role: v0→v1");
  // 24. mudança de admin incrementa versão
  A.reset(); A.setUser("U1", { status: "ativo", admin: false, sessionVersion: 0 });
  await A.authBumpUserSessionTx(A.db, "U1", { admin: true });
  eq(A.getUser("U1").sessionVersion, 1, "24. mudança de admin: v0→v1");
  // 25. falha de autorização NÃO altera versão (admin gate barra não-admin ANTES de qualquer bump)
  A.reset(); A.setUser("CALLER", { status: "ativo", admin: false, sessionVersion: 0 });
  r = await A.authRequireAdminSession({ authHeader: mkToken(sessionClaims("CALLER")), db: A.db, now: 4000 });
  ok(r.ok === false && r.status === 403 && A.getUser("CALLER").sessionVersion === 0, "25. não-admin barrado; versão inalterada");

  // ============ CUSTOM TOKEN (26..30) ============
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0 });
  // 26. sessão revogada não recebe Custom Token
  A.setUser("U1", { status: "ativo", sessionVersion: 5 });
  r = await A.handleIssueFirebaseAuthToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 0 })), db: A.db, now: 5000 });
  ok(r.status === 401, "26. sessão revogada (v0 vs v5) = 401 sem token");
  // 27. sessão válida recebe token
  r = await A.handleIssueFirebaseAuthToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 5 })), db: A.db, now: 5000 });
  ok(r.status === 200 && typeof r.json.firebaseToken === "string" && r.json.uid === "U1", "27. sessão válida recebe Custom Token do próprio uid");
  // 28. uid do body é IGNORADO (uid vem só da sessão)
  r = await A.handleIssueFirebaseAuthToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 5 })), body: { uid: "INTRUSO" }, db: A.db, now: 5000 });
  ok(r.status === 200 && r.json.uid === "U1", "28. uid do body ignorado (retorna U1)");
  // 29. role/admin do body são ignorados (token sem claims extras; uid=U1)
  ok(r.json.firebaseToken === "CUSTOM:U1", "29. Custom Token do uid da sessão, sem claims do body");
  // 30. usuário desativado é negado
  A.reset(); A.setUser("U1", { status: "removido", sessionVersion: 0 });
  r = await A.handleIssueFirebaseAuthToken({ method: "POST", authHeader: mkToken(sessionClaims("U1")), db: A.db, now: 5000 });
  ok(r.status === 403, "30. usuário desativado negado (403)");

  // ============ FCM (31..37) ============
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0, fcmTokens: [], fcmTokenMeta: {} });
  // 31. sessão revogada NÃO registra FCM
  A.setUser("U1", { status: "ativo", sessionVersion: 3, fcmTokens: [], fcmTokenMeta: {} });
  r = await A.handleRegisterFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 0 })), body: { token: "tok-a", deviceId: "dev1" }, db: A.db, now: 6000 });
  ok(r.status === 401, "31. sessão revogada não registra FCM (401)");
  // 32. token inválido (ausente) rejeitado
  r = await A.handleRegisterFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 3 })), body: { deviceId: "dev1" }, db: A.db, now: 6000 });
  ok(r.status === 400, "32. token FCM ausente = 400");
  // 33. token oversized rejeitado
  r = await A.handleRegisterFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1", { sessionVersion: 3 })), body: { token: "x".repeat(5000), deviceId: "dev1" }, db: A.db, now: 6000 });
  ok(r.status === 400, "33. token FCM oversized = 400");
  // 34. dedup por deviceId (mesmo device, token novo substitui o antigo)
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0, fcmTokens: [], fcmTokenMeta: {} });
  await A.handleRegisterFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1")), body: { token: "tok-old", deviceId: "devA" }, db: A.db, now: 6000 });
  await A.handleRegisterFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1")), body: { token: "tok-new", deviceId: "devA" }, db: A.db, now: 6001 });
  ok(JSON.stringify(A.getUser("U1").fcmTokens) === JSON.stringify(["tok-new"]), "34. dedup por deviceId (só tok-new)");
  // 35. remoção idempotente (remover token inexistente não falha)
  r = await A.handleRemoveFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1")), body: { token: "nao-existe" }, db: A.db, now: 6002 });
  ok(r.status === 200, "35. remoção idempotente (token ausente) = 200");
  // 36. outro uid não pode ser informado (uid vem só da sessão)
  A.reset(); A.setUser("U1", { status: "ativo", sessionVersion: 0, fcmTokens: [], fcmTokenMeta: {} }); A.setUser("U2", { status: "ativo", sessionVersion: 0, fcmTokens: [], fcmTokenMeta: {} });
  await A.handleRegisterFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1")), body: { token: "t1", deviceId: "d", uid: "U2", targetId: "U2" }, db: A.db, now: 6000 });
  ok((A.getUser("U1").fcmTokens || []).length === 1 && (A.getUser("U2").fcmTokens || []).length === 0, "36. registro afeta só o uid da sessão (U1), não U2");
  // 37. resposta/estado sem token cru vazado nos logs — resposta só contadores
  r = await A.handleRegisterFcmToken({ method: "POST", authHeader: mkToken(sessionClaims("U1")), body: { token: "t2", deviceId: "d2" }, db: A.db, now: 6003 });
  ok(r.status === 200 && r.json.fcmTokens === undefined && r.json.count >= 1, "37. resposta FCM sem fcmTokens/fcmTokenMeta (só contadores)");

  // ============ RATE LIMIT (38..42) ============
  // 38. excesso bloqueia
  let rl = A.createRateLimiter({ max: 3, windowMs: 1000, blockMs: 1000 });
  rl.fail("k", 0); rl.fail("k", 1); rl.fail("k", 2);
  ok(rl.blocked("k", 3) === true, "38. excesso (3 falhas, max 3) = bloqueado");
  // 39. buckets independentes
  ok(rl.blocked("outro", 3) === false, "39. bucket 'outro' não é afetado");
  // 40. timeout recupera (após blockMs)
  ok(rl.blocked("k", 5000) === false, "40. após blockMs o bloqueio expira");
  // 41. endpoint administrativo possui limite (limiter injetável)
  A.reset(); A.setUser("ADM", { status: "ativo", admin: true, sessionVersion: 0 });
  let admRl = A.createRateLimiter({ max: 2, windowMs: 60000, blockMs: 60000 });
  let a1 = await A.authRequireAdminSession({ authHeader: mkToken(sessionClaims("ADM", { admin: true })), db: A.db, rateLimiter: admRl, now: 7000 });
  let a2 = await A.authRequireAdminSession({ authHeader: mkToken(sessionClaims("ADM", { admin: true })), db: A.db, rateLimiter: admRl, now: 7001 });
  let a3 = await A.authRequireAdminSession({ authHeader: mkToken(sessionClaims("ADM", { admin: true })), db: A.db, rateLimiter: admRl, now: 7002 });
  ok(a1.ok === true && a2.ok === true && a3.ok === false && a3.status === 429, "41. admin endpoint com limite (3ª chamada = 429)");
  // 42. nenhum segredo no estado do limiter (snapshot só contadores)
  let snap = admRl.snapshot();
  let snapStr = JSON.stringify(snap);
  ok(snapStr.indexOf("secret") < 0 && snapStr.indexOf("Bearer") < 0 && snapStr.indexOf("CUSTOM:") < 0 && /"fails":/.test(snapStr), "42. snapshot do limiter só tem contadores (sem segredo)");

  // ============ LOGS / AUDITORIA (43..47) ============
  // 43. nenhum token aparece; 44. nenhuma senha; 45. body completo não aparece
  let ev = A.authAuditEvent("session_revoked", { uid: "U1", correlationId: "cid-1", token: "SECRET_TOKEN", password: "hunter2", body: { a: 1 }, bearer: "Bearer XYZ", sessionVersion: 2, at: 9 });
  let evStr = JSON.stringify(ev);
  ok(evStr.indexOf("SECRET_TOKEN") < 0, "43. evento não contém token");
  ok(evStr.indexOf("hunter2") < 0, "44. evento não contém senha");
  ok(evStr.indexOf("\"body\"") < 0 && evStr.indexOf("Bearer") < 0, "45. evento não contém body/Bearer");
  // 46. correlationId presente; uid mascarado
  ok(ev.correlationId === "cid-1" && typeof ev.uid === "string" && ev.uid !== "U1", "46. correlationId presente + uid mascarado");
  // 47. eventos esperados são emitidos (nome do evento preservado; allowlist)
  ok(ev.event === "session_revoked", "47a. tipo de evento preservado");
  ok(A.authAuditEvent("firebase_token_issued", { uid: "U1" }).event === "firebase_token_issued", "47b. firebase_token_issued");
  ok(A.authAuditEvent("session_version_mismatch", { uid: "U1" }).event === "session_version_mismatch", "47c. session_version_mismatch");

  // ============ MIGRAÇÃO (48..50) ============
  // 48. compat aceita sessão antiga SOMENTE quando habilitado (compat) e dentro da janela
  let m48 = A.authSessionVersionDecision({ uid: "U1" }, { sessionVersion: 0 }, { mode: "compat", deadlineMs: 0, nowMs: 100 });
  ok(m48.ok === true, "48. compat + janela aberta + doc v0 = aceita legado");
  // 49. strict rejeita sessão antiga
  let m49 = A.authSessionVersionDecision({ uid: "U1" }, { sessionVersion: 0 }, { mode: "strict" });
  ok(m49.ok === false && m49.reason === "legacy_rejected", "49. strict rejeita legado");
  // 50. janela expirada rejeita legado (compat mas now > deadline)
  let m50 = A.authSessionVersionDecision({ uid: "U1" }, { sessionVersion: 0 }, { mode: "compat", deadlineMs: 100, nowMs: 200 });
  ok(m50.ok === false && m50.reason === "legacy_rejected", "50. janela expirada rejeita legado");

  // ============ REGRESSÃO: login mint carrega sessionVersion do doc ============
  A.reset(); const salt = "SALT1"; A.setUser("U9", { email: "u9@x.com", status: "ativo", role: "designer", admin: false, sessionVersion: 7, pass: passHash(salt, "senha123"), salt: salt });
  r = await A.handleLoginUser({ method: "POST", body: { identifier: "u9@x.com", password: "senha123" }, now: 8000 });
  ok(r.status === 200 && r.json.ok === true, "R1. login OK");
  let minted = JSON.parse(Buffer.from(r.json.session.token.split(".")[0], "base64url").toString("utf8"));
  eq(minted.sessionVersion, 7, "R2. token mintado carrega sessionVersion do doc (7)");
  eq(minted.schemaVersion, 1, "R3. token mintado carrega schemaVersion (1)");
  ok(minted.exp === 8000 + 24 * 60 * 60 * 1000, "R4. exp = now + TTL server-side (24h default)");

  // ============ AUDITORIA DE LOGIN ponta-a-ponta (R5..R9) ============
  // R5. login OK emite login_success (uid mascarado, sessionVersion, correlationId) e NADA sensível.
  A.reset(); A.clearAudit(); const saltA = "SALTA"; A.setUser("U5", { email: "a@x.com", status: "ativo", role: "designer", admin: false, sessionVersion: 3, pass: passHash(saltA, "senha123"), salt: saltA });
  r = await A.handleLoginUser({ method: "POST", body: { identifier: "a@x.com", password: "senha123" }, now: 100 });
  let succ = A.auditLog().filter((e) => e.event === "login_success");
  ok(r.status === 200 && succ.length === 1, "R5. login OK emite exatamente 1 login_success");
  ok(succ[0].uid !== "U5" && typeof succ[0].uid === "string" && succ[0].sessionVersion === 3 && !!succ[0].correlationId, "R6. login_success: uid mascarado + sessionVersion(3) + correlationId");
  let succStr = JSON.stringify(succ[0]);
  ok(succStr.indexOf("a@x.com") < 0 && succStr.indexOf("senha123") < 0 && succStr.indexOf("token") < 0, "R7. login_success NÃO contém email/senha/token");
  // R8. senha errada emite login_failure (uid mascarado, sem vazar identifier/senha).
  A.clearAudit();
  r = await A.handleLoginUser({ method: "POST", body: { identifier: "a@x.com", password: "ERRADA" }, now: 200 });
  let fail1 = A.auditLog().filter((e) => e.event === "login_failure");
  ok(r.status === 401 && fail1.length === 1 && fail1[0].uid !== "U5" && JSON.stringify(fail1[0]).indexOf("ERRADA") < 0, "R8. senha errada emite login_failure (mascarado, sem senha)");
  // R9. usuário inexistente emite login_failure SEM uid (não há usuário provado).
  A.clearAudit();
  r = await A.handleLoginUser({ method: "POST", body: { identifier: "naoexiste@x.com", password: "x" }, now: 300 });
  let fail2 = A.auditLog().filter((e) => e.event === "login_failure");
  ok(r.status === 401 && fail2.length === 1 && fail2[0].uid === undefined, "R9. login inexistente emite login_failure SEM uid");

  // ============ GATES DE REVOGAÇÃO EM ENDPOINTS SENSÍVEIS (R10..R16) ============
  // Fecham os bypasses: sessão REVOGADA/stale/inativa não pode manter privilégio admin, excluir
  // conta, nem trocar senha (a revogação incrementa sessionVersion; o token antigo fica stale).
  // R10. ADMIN stale (token v0, doc admin ativo v1) → 401 (revogação vale p/ admin).
  A.reset(); A.setUser("ADM", { admin: true, status: "ativo", role: "gestor", sessionVersion: 1 });
  let g = await A.authRequireAdminSession({ authHeader: mkToken(sessionClaims("ADM", { admin: true, sessionVersion: 0 })), db: A.db, now: 5000 });
  ok(g.ok === false && g.status === 401, "R10. admin com sessão REVOGADA (versão stale) = 401");
  // R11. ADMIN válido (versão casa) → ok (controle positivo).
  g = await A.authRequireAdminSession({ authHeader: mkToken(sessionClaims("ADM", { admin: true, sessionVersion: 1 })), db: A.db, now: 5001 });
  ok(g.ok === true && g.uid === "ADM", "R11. admin com sessão ATIVA (versão casa) = ok");
  // R12. deleteMyAccount com sessão stale (token v0, doc v1) → 401 (ação destrutiva bloqueada).
  A.reset(); A.setUser("U12", { status: "ativo", role: "designer", sessionVersion: 1 });
  r = await A.handleDeleteMyAccount({ method: "POST", authHeader: mkToken(sessionClaims("U12", { sessionVersion: 0 })), db: A.db, now: 6000 });
  ok(r.status === 401 && A.getUser("U12").status === "ativo", "R12. deleteMyAccount com sessão REVOGADA = 401 (conta intacta)");
  // R13. deleteMyAccount com usuário INATIVO → 403.
  A.reset(); A.setUser("U13", { status: "excluido", role: "designer", sessionVersion: 0 });
  r = await A.handleDeleteMyAccount({ method: "POST", authHeader: mkToken(sessionClaims("U13", { sessionVersion: 0 })), db: A.db, now: 6100 });
  ok(r.status === 403, "R13. deleteMyAccount com usuário INATIVO = 403");
  // R14. deleteMyAccount com sessão ATIVA → 200 (controle positivo; incrementa sessionVersion).
  A.reset(); A.setUser("U14", { status: "ativo", role: "designer", sessionVersion: 2 });
  r = await A.handleDeleteMyAccount({ method: "POST", authHeader: mkToken(sessionClaims("U14", { sessionVersion: 2 })), db: A.db, now: 6200 });
  ok(r.status === 200 && A.getUser("U14").status === "excluido" && A.getUser("U14").sessionVersion === 3 && A.getUser("U14").email === "", "R14. deleteMyAccount ATIVA = 200 (excluido + versão++ + PII limpa)");
  // R15. changePassword com sessão stale (token v0, doc v1) → 401 (antes de validar a senha).
  A.reset(); A.setUser("U15", { status: "ativo", role: "designer", sessionVersion: 1, pass: passHash("s", "atual123"), salt: "s" });
  r = await A.handleChangePassword({ method: "POST", authHeader: mkToken(sessionClaims("U15", { sessionVersion: 0 })), body: { oldPassword: "atual123", newPassword: "novasenha123" }, db: A.db, now: 7000 });
  ok(r.status === 401, "R15. changePassword com sessão REVOGADA = 401");
  // R16. changePassword com usuário INATIVO → 403.
  A.reset(); A.setUser("U16", { status: "inativo", disabled: true, role: "designer", sessionVersion: 0, pass: passHash("s", "atual123"), salt: "s" });
  r = await A.handleChangePassword({ method: "POST", authHeader: mkToken(sessionClaims("U16", { sessionVersion: 0 })), body: { oldPassword: "atual123", newPassword: "novasenha123" }, db: A.db, now: 7100 });
  ok(r.status === 403, "R16. changePassword com usuário INATIVO = 403");

  console.log("");
  console.log("F4.3C2 session-revocation: " + PASS + " OK, " + FAIL + " FALHOU (total " + (PASS + FAIL) + ")");
  if (FAIL > 0) process.exit(1);
}
run().catch((e) => { console.error("ERRO NO HARNESS:", e && e.stack || e); process.exit(1); });
