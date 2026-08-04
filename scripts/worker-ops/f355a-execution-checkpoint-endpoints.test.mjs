#!/usr/bin/env node
/* =====================================================================
 * F3.5.5A — claim/lease e resposta SERVER-SIDE dos check-ins de execução.
 * Extrai a logica REAL de functions/index.js (grab por chaves balanceadas,
 * mesmo padrao do harness f42c) e roda OFFLINE: crypto real p/ o token de
 * sessao HMAC; Firestore MOCK transacional injetado via ctx.db. Sem rede,
 * sem segredo real, sem usuario real, sem deploy. Prova (37 asserts):
 *   A) contrato HTTP: 405 / 401 uniforme / 400 corpo invalido / rate-limit;
 *   B) CLAIM: doc ausente => CLAIMED com claimedAt/leaseExpiresAt do RELOGIO
 *      DO SERVIDOR (ctx.now sintetico; relogio "local do device" NAO entra);
 *      claim simultaneo de 2 devices => 1 CLAIMED + 1 deny LEASED_BY_OTHER;
 *      retomada idempotente do mesmo device (resumed; claimVersion estavel);
 *      lease vencido => takeover (claimVersion++); RESPONDED => closed;
 *      Designer nao-atribuido => deny designer_changed; deadlineVersion
 *      divergente => deny deadline_changed; tarefa concluida => deny
 *      task_not_eligible; zona SLA (slaZone/dueAtMs) => deny sla_zone;
 *   C) RESPOND: claim vigente do device => RESPONDED + respondedAt do servidor
 *      + projecao executionTracking (resumo+timeline) no task doc na MESMA
 *      transacao; segunda resposta => already_responded (idempotente, sem
 *      regravar); outro device com lease vigente => deny claim_held_by_other;
 *      kind=missed => MISSED + timeline; observacao cap 2000; timeline cap 40;
 *   D) autoridade do relogio: claim com ctx.now deslocado +10min/-10min decide
 *      APENAS pelo serverNow injetado (nunca por Date.now() do harness);
 *   E) privacidade: token/observacao NUNCA aparecem nos logs capturados;
 *   F) prova de fonte: wrappers onRequest com AUTH_SESSION_SECRET + no-store;
 *      dominio etClaimDecision/etRespondDecision/etKey BYTE-IDENTICO ao
 *      desktop/src/main/executionTracking.js (sha256 pinado).
 * Rodar: node scripts/worker-ops/f355a-execution-checkpoint-endpoints.test.mjs
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
function grabConst(n) {
  const a = SRC.indexOf("const " + n + " =");
  if (a < 0) throw new Error("nao encontrei const: " + n);
  return SRC.slice(a, SRC.indexOf(";", a) + 1);
}

/* F) dominio BYTE-IDENTICO ao Desktop (pin sha256 do trecho verbatim etKey+etClaimDecision+etRespondDecision) */
const DOMAIN = [grab("etKey"), grab("etClaimDecision"), grab("etRespondDecision")].join("\n\n") + "\n";
const DOMAIN_SHA = crypto.createHash("sha256").update(DOMAIN).digest("hex");
ok("F1 dominio puro byte-identico ao desktop/src/main/executionTracking.js (sha256 pinado)",
  DOMAIN_SHA === "5e849c603119393fdc877811cd6a7001a944b31f9ecabb0e226633cf939602c9");

/* logica REAL extraida + ambiente controlado (secret de TESTE local; logger capturado) */
const NAMES = ["notifVerifyToken", "notifSignToken", "authVerifySessionToken", "notifRlBlocked", "notifRlFail", "notifRlClear", "notifMaskUid",
  "etKey", "etClaimDecision", "etRespondDecision", "etSessionHash", "etParseCommon", "etTaskCtx",
  "handleClaimExecutionCheckpoint", "handleRespondExecutionCheckpoint"];
let BODY = ["NOTIF_RL_WINDOW_MS", "NOTIF_RL_MAX", "NOTIF_RL_BLOCK_MS", "ET_LEASE_DEFAULT_MS", "ET_LEASE_MIN_MS", "ET_LEASE_MAX_MS",
  "ET_OBS_MAX", "ET_TIMELINE_MAX", "ET_RESPONSE_TYPES", "ET_TASK_CLOSED_STATUSES"].map(grabConst).join("\n") + "\n";
for (const n of NAMES) BODY += grab(n) + "\n";
const LOGS = [];
const make = new Function("crypto", "authSessionSecret", "logger", "notifDb", "__notifRlState", BODY + `
  ; return { handleClaimExecutionCheckpoint, handleRespondExecutionCheckpoint, notifSignToken, etKey };
`);
const TEST_SECRET = "f355a-harness-secret-LOCAL-apenas";
const api = make(
  crypto,
  () => TEST_SECRET,
  { info: (...a) => LOGS.push(JSON.stringify(a)), error: (...a) => LOGS.push(JSON.stringify(a)), warn: (...a) => LOGS.push(JSON.stringify(a)) },
  () => { throw new Error("notifDb NAO pode ser tocado no teste (ctx.db obrigatorio)"); },
  new Map(),
);

const NOW = 1754300000000;                       // relogio SINTETICO do SERVIDOR
const UID = "designerSintetico01";
const TASK = "taskSintetica01";
const DEV_A = "a".repeat(32);                    // deviceHash device A
const DEV_B = "b".repeat(32);                    // deviceHash device B
const sess = (uid, expMs) => "Bearer " + api.notifSignToken({ uid, admin: false, role: "Designer", scope: "session", iat: NOW, exp: expMs || (NOW + 3600000) }, TEST_SECRET);
const KEY = api.etKey(TASK, UID, 0, 1);

/* Firestore MOCK transacional: store em memoria; runTransaction aplica writes ao fim. */
function mkDb(seed) {
  const store = new Map(Object.entries(seed || {}));   // "col/id" -> objeto
  const db = {
    __store: store,
    collection: (c) => ({ doc: (id) => ({ __path: c + "/" + id }) }),
    runTransaction: async (fn) => {
      const writes = [];
      const tx = {
        get: async (ref) => {
          const d = store.get(ref.__path);
          return { exists: !!d, data: () => (d ? JSON.parse(JSON.stringify(d)) : null) };
        },
        set: (ref, val, opts) => { writes.push({ path: ref.__path, val, merge: !!(opts && opts.merge) }); },
      };
      const out = await fn(tx);
      for (const w of writes) {
        const cur = store.get(w.path);
        store.set(w.path, (w.merge && cur) ? Object.assign({}, cur, w.val) : JSON.parse(JSON.stringify(w.val)));
      }
      return out;
    },
  };
  return db;
}
const TASK_DOC = { assigneeId: UID, status: "andamento", deadlineVersion: 0, title: "sintetica" };
const claim = (db, over) => api.handleClaimExecutionCheckpoint(Object.assign({ method: "POST", authHeader: sess(UID), now: NOW, db,
  body: Object.assign({ taskId: TASK, deadlineVersion: 0, checkpointIndex: 1, deviceHash: DEV_A, leaseMs: 600000 }, (over && over.body) || {}) }, over || {}, { body: Object.assign({ taskId: TASK, deadlineVersion: 0, checkpointIndex: 1, deviceHash: DEV_A, leaseMs: 600000 }, (over && over.body) || {}) }));
const respond = (db, over) => api.handleRespondExecutionCheckpoint(Object.assign({ method: "POST", authHeader: sess(UID), now: NOW, db,
  body: Object.assign({ taskId: TASK, deadlineVersion: 0, checkpointIndex: 1, deviceHash: DEV_A, kind: "respond", responseType: "sim", observation: "" }, (over && over.body) || {}) }, over || {}, { body: Object.assign({ taskId: TASK, deadlineVersion: 0, checkpointIndex: 1, deviceHash: DEV_A, kind: "respond", responseType: "sim", observation: "" }, (over && over.body) || {}) }));

console.log("\n===== F3.5.5A — claim/respond server-side (harness offline) =====");
{ // A) contrato HTTP
  const db = mkDb({ ["tasks/" + TASK]: TASK_DOC });
  const r1 = await claim(db, { method: "GET" });
  ok("A1 metodo GET => 405 method_not_allowed", r1.status === 405 && r1.json.error === "method_not_allowed");
  const r2 = await claim(db, { authHeader: "Bearer lixo" });
  ok("A2 Bearer invalido => 401 invalid_session (uniforme)", r2.status === 401 && r2.json.error === "invalid_session");
  const r3 = await claim(db, { authHeader: sess(UID, NOW - 1000) });
  ok("A3 sessao expirada => 401 invalid_session", r3.status === 401 && r3.json.error === "invalid_session");
  const r4 = await claim(db, { body: { deviceHash: "XYZ" } });
  ok("A4 deviceHash invalido => 400 bad_device_hash", r4.status === 400 && r4.json.error === "bad_device_hash");
  const r5 = await claim(db, { body: { checkpointIndex: 99 } });
  ok("A5 checkpointIndex fora do dominio => 400", r5.status === 400 && r5.json.error === "bad_checkpoint_index");
  const r6 = await claim(db, { body: { checkinId: "outro|id" } });
  ok("A6 checkinId != chave deterministica => 400 checkin_id_mismatch", r6.status === 400 && r6.json.error === "checkin_id_mismatch");
}
{ // B) CLAIM transacional
  const db = mkDb({ ["tasks/" + TASK]: TASK_DOC });
  const r1 = await claim(db);
  ok("B1 doc ausente => CLAIMED (decision claimed)", r1.status === 200 && r1.json.ok === true && r1.json.decision === "claimed" && r1.json.state === "CLAIMED");
  ok("B2 claimedAt/leaseExpiresAt do RELOGIO DO SERVIDOR (ctx.now)", r1.json.claimedAt === NOW && r1.json.leaseExpiresAt === NOW + 600000);
  const doc1 = db.__store.get("executionCheckins/" + KEY);
  ok("B3 doc persistido: state/claimVersion/claimDeviceId/sessionHash", doc1 && doc1.state === "CLAIMED" && doc1.claimVersion === 1 && doc1.claimDeviceId === DEV_A && /^[a-f0-9]{32}$/.test(String(doc1.claimedBySessionHash)));
  const r2 = await claim(db, { body: { deviceHash: DEV_B } });
  ok("B4 device B com lease vigente => deny LEASED_BY_OTHER (+leaseExpiresAt)", r2.status === 200 && r2.json.decision === "deny" && r2.json.reason === "LEASED_BY_OTHER" && r2.json.leaseExpiresAt === NOW + 600000);
  const r3 = await claim(db);
  ok("B5 retomada do MESMO device => resumed (idempotente; claimVersion estavel)", r3.json.decision === "resumed" && db.__store.get("executionCheckins/" + KEY).claimVersion === 1);
  const r4 = await claim(db, { now: NOW + 601000, body: { deviceHash: DEV_B } });
  ok("B6 lease vencido (relogio do SERVIDOR) => takeover pelo device B (claimVersion++)", r4.json.decision === "takeover" && db.__store.get("executionCheckins/" + KEY).claimDeviceId === DEV_B && db.__store.get("executionCheckins/" + KEY).claimVersion === 2);
  const r5 = await claim(mkDb({ ["tasks/" + TASK]: TASK_DOC, ["executionCheckins/" + KEY]: { state: "RESPONDED" } }));
  ok("B7 checkpoint RESPONDED => closed (nunca regrava historico)", r5.json.decision === "closed" && r5.json.state === "RESPONDED");
}
{ // B) deny-matrix do claim a partir do doc REAL da tarefa
  const r1 = await claim(mkDb({ ["tasks/" + TASK]: Object.assign({}, TASK_DOC, { assigneeId: "outroDesigner" }) }));
  ok("B8 Designer da tarefa != sessao => deny designer_changed", r1.json.decision === "deny" && r1.json.reason === "designer_changed");
  const r2 = await claim(mkDb({ ["tasks/" + TASK]: Object.assign({}, TASK_DOC, { deadlineVersion: 3 }) }));
  ok("B9 deadlineVersion divergente => deny deadline_changed", r2.json.decision === "deny" && r2.json.reason === "deadline_changed");
  const r3 = await claim(mkDb({ ["tasks/" + TASK]: Object.assign({}, TASK_DOC, { status: "concluido" }) }));
  ok("B10 tarefa concluida => deny task_not_eligible", r3.json.decision === "deny" && r3.json.reason === "task_not_eligible");
  const r4 = await claim(mkDb({}));
  ok("B11 tarefa inexistente => deny task_not_eligible", r4.json.decision === "deny" && r4.json.reason === "task_not_eligible");
  const r5 = await claim(mkDb({ ["tasks/" + TASK]: TASK_DOC }), { body: { slaZone: true } });
  ok("B12 zona SLA sinalizada => deny sla_zone (cliente so APERTA a protecao)", r5.json.decision === "deny" && r5.json.reason === "sla_zone");
  const r6 = await claim(mkDb({ ["tasks/" + TASK]: TASK_DOC }), { body: { dueAtMs: NOW + 35 * 60000 } });
  ok("B13 dueAtMs a 35min (warn30+margem10) => deny sla_zone no servidor", r6.json.decision === "deny" && r6.json.reason === "sla_zone");
  const r7 = await claim(mkDb({ ["tasks/" + TASK]: TASK_DOC }), { body: { dueAtMs: NOW + 120 * 60000 } });
  ok("B14 dueAtMs a 2h => claim permitido (fora da zona)", r7.json.decision === "claimed");
}
{ // D) autoridade do relogio: relogio local do device NAO participa
  const dbP = mkDb({ ["tasks/" + TASK]: TASK_DOC });
  await claim(dbP);
  const rP = await claim(dbP, { now: NOW + 300000, body: { deviceHash: DEV_B, localClockMs: NOW + 3600000 } });
  ok("D1 device B com relogio local +10min adiantado nao provoca takeover (lease decide por serverNow)", rP.json.decision === "deny" && rP.json.reason === "LEASED_BY_OTHER");
  const dbQ = mkDb({ ["tasks/" + TASK]: TASK_DOC, ["executionCheckins/" + KEY]: { state: "CLAIMED", claimDeviceId: DEV_A, leaseExpiresAt: NOW + 600000, claimVersion: 1 } });
  const rQ = await claim(dbQ, { now: NOW + 601000, body: { deviceHash: DEV_B, localClockMs: NOW - 3600000 } });
  ok("D2 device B com relogio local -10min atrasado ainda faz takeover apos expirar no SERVIDOR", rQ.json.decision === "takeover");
}
{ // C) RESPOND transacional + projecao no task doc
  const db = mkDb({ ["tasks/" + TASK]: TASK_DOC });
  await claim(db);
  const rB = await respond(db, { body: { deviceHash: DEV_B } });
  ok("C1 outro device com lease vigente => deny claim_held_by_other", rB.json.decision === "deny" && rB.json.reason === "claim_held_by_other");
  const r1 = await respond(db, { now: NOW + 60000, body: { observation: "Estou finalizando a arte" } });
  ok("C2 detentor responde => RESPONDED com respondedAt do SERVIDOR", r1.status === 200 && r1.json.decision === "responded" && r1.json.state === "RESPONDED" && r1.json.respondedAt === NOW + 60000);
  const cp = db.__store.get("executionCheckins/" + KEY);
  ok("C3 historico imutavel gravado (responseType/observation/respondedByDeviceHash)", cp.state === "RESPONDED" && cp.responseType === "sim" && cp.observation === "Estou finalizando a arte" && cp.respondedByDeviceHash === DEV_A);
  const tk = db.__store.get("tasks/" + TASK);
  ok("C4 projecao executionTracking no task doc NA MESMA transacao (resumo+timeline)", tk.executionTracking && tk.executionTracking.lastCheckin.state === "RESPONDED" && tk.executionTracking.timeline.length === 1 && tk.executionTracking.timeline[0].observation === "Estou finalizando a arte");
  ok("C5 demais campos da tarefa preservados (merge cirurgico)", tk.assigneeId === UID && tk.title === "sintetica" && tk.status === "andamento");
  const r2 = await respond(db, { now: NOW + 120000 });
  ok("C6 segunda resposta => already_responded (idempotente; historico intacto)", r2.json.decision === "already_responded" && db.__store.get("executionCheckins/" + KEY).respondedAt === NOW + 60000);
  const r3 = await respond(db, { body: { checkpointIndex: 9 } });
  ok("C7 checkpoint inexistente => deny checkpoint_not_found", r3.json.decision === "deny" && r3.json.reason === "checkpoint_not_found");
}
{ // C) kind=missed + validacoes de payload
  const db = mkDb({ ["tasks/" + TASK]: TASK_DOC });
  await claim(db);
  const r0 = await respond(db, { body: { responseType: "invalido" } });
  ok("C8 responseType fora da allowlist => 400 bad_response_type", r0.status === 400 && r0.json.error === "bad_response_type");
  const r1 = await respond(db, { now: NOW + 900000, body: { kind: "missed" } });
  ok("C9 kind=missed (timeout apos reapresentacao) => MISSED + missedAt do servidor", r1.json.decision === "missed" && r1.json.state === "MISSED" && db.__store.get("executionCheckins/" + KEY).missedAt === NOW + 900000);
  ok("C10 timeline registra kind missed p/ derivacao SM", db.__store.get("tasks/" + TASK).executionTracking.timeline[0].kind === "missed");
  const r2 = await respond(db, { now: NOW + 910000 });
  ok("C11 responder apos MISSED => deny checkpoint_closed_missed", r2.json.decision === "deny" && r2.json.reason === "checkpoint_closed_missed");
}
{ // C) caps de observacao e timeline
  const db = mkDb({ ["tasks/" + TASK]: Object.assign({}, TASK_DOC, { executionTracking: { v: 1, timeline: Array.from({ length: 45 }, (_, i) => ({ at: i, kind: "respond" })) } }) });
  await claim(db);
  const r = await respond(db, { body: { observation: "x".repeat(5000), responseType: "nao_bloqueado" } });
  const tk = db.__store.get("tasks/" + TASK);
  ok("C12 observacao cap 2000 chars no historico e na timeline", db.__store.get("executionCheckins/" + KEY).observation.length === 2000 && tk.executionTracking.timeline[tk.executionTracking.timeline.length - 1].observation.length === 2000);
  ok("C13 timeline cap 40 entradas (projecao limitada; historico integral na colecao server-only)", tk.executionTracking.timeline.length === 40 && r.json.decision === "responded");
}
{ // C) respond nega quando Designer/prazo mudaram (CORRECAO pontos 9-10)
  const db = mkDb({ ["tasks/" + TASK]: TASK_DOC });
  await claim(db);
  db.__store.set("tasks/" + TASK, Object.assign({}, TASK_DOC, { deadlineVersion: 5 }));
  const r1 = await respond(db);
  ok("C14 prazo mudou entre exibicao e resposta => deny deadline_changed", r1.json.decision === "deny" && r1.json.reason === "deadline_changed");
  db.__store.set("tasks/" + TASK, Object.assign({}, TASK_DOC, { assigneeId: "outro" }));
  const r2 = await respond(db);
  ok("C15 Designer mudou => deny designer_changed", r2.json.decision === "deny" && r2.json.reason === "designer_changed");
}
{ // E) privacidade dos logs
  const blob = LOGS.join("\n");
  ok("E1 nenhum token de sessao nos logs", blob.indexOf(sess(UID).slice(7, 40)) < 0);
  ok("E2 nenhuma observacao digitada nos logs", blob.indexOf("Estou finalizando a arte") < 0 && blob.indexOf("xxxxx") < 0);
  ok("E3 uid/taskId so mascarados nos logs", blob.indexOf(UID) < 0 && blob.indexOf(TASK) < 0);
}
{ // F) prova de fonte (wrappers reais)
  const wClaim = SRC.slice(SRC.indexOf('exports.claimExecutionCheckpoint = onRequest('), SRC.indexOf('exports.claimExecutionCheckpoint = onRequest(') + 1200);
  const wResp = SRC.slice(SRC.indexOf('exports.respondExecutionCheckpoint = onRequest('), SRC.indexOf('exports.respondExecutionCheckpoint = onRequest(') + 1200);
  ok("F2 wrapper claim: AUTH_SESSION_SECRET + no-store + Date.now() do servidor", /secrets: \[AUTH_SESSION_SECRET\]/.test(wClaim) && /Cache-Control", "no-store"/.test(wClaim) && /now: Date\.now\(\)/.test(wClaim));
  ok("F3 wrapper respond: AUTH_SESSION_SECRET + no-store + Date.now() do servidor", /secrets: \[AUTH_SESSION_SECRET\]/.test(wResp) && /Cache-Control", "no-store"/.test(wResp) && /now: Date\.now\(\)/.test(wResp));
  ok("F4 exports puros p/ harness presentes", /_handleClaimExecutionCheckpoint/.test(SRC) && /_handleRespondExecutionCheckpoint/.test(SRC));
  ok("F5 endpoints legados INTACTOS (loginUser/getUserSelf/issueFirebaseAuthToken presentes)", /exports\.loginUser = onRequest/.test(SRC) && /exports\.getUserSelf = onRequest/.test(SRC) && /exports\.issueFirebaseAuthToken = onRequest/.test(SRC));
}

console.log(`\nf355a-endpoints: ${pass}/${pass + fail} verdes`);
if (fail) process.exit(1);
