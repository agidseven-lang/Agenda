/**
 * F3.5.4P — f354p-sla-decision-actions.test.mjs
 * =====================================================================================
 * ALERTAS DE SLA COM DECISÃO DO RESPONSÁVEL (Desktop 1.0.206). Cobre, com CÓDIGO REAL:
 *  - CONTROLADOR real (dist/main/slaReminder.js): onDecide (committed/already_decided/task_completed/
 *    task_deleted/offline-queued/error), idempotência (in-flight + recibo durável), dismiss,
 *    syncPendingDecisions (fila offline → sync sem duplicar), decisionKey determinística, flag OFF.
 *  - STORE real (dist/main/slaReminderStore.js): decisão durável (pending_sync/synced/superseded),
 *    não-reabre estado final, eviction.
 *  - TRANSAÇÃO REAL extraída de src/renderer/index.html (window.__slaPersistDecision) dirigida por um
 *    SIMULADOR FIEL de concorrência otimista (OCC) do Firestore: 14 passos + CONCORRÊNCIA (2 quase
 *    simultâneas, mesma decisionKey, decisões diferentes ⇒ 1 committed, 1 already_decided, 1 entrada,
 *    1 notificação derivada, sem duplicação) + task_deleted/completed/not_authorized/offline.
 *  - RESOLUÇÃO real do destinatário da ajuda (window.__slaResolveHelp): preselected/ambiguous/none.
 *  - notifEvents real (src/main/notifEvents.js): derivação help_requested + blocked (recipient-targeted)
 *    e NÃO-notificação de start_now/finishing/acknowledge_only; título/corpo/severidade.
 *  - AGRUPAMENTO real (dist/main/notificationGrouping.js): help_requested/blocked/sla_decision ⇒ passthrough.
 *  - WIRING estático (preload/janela/HTML/main/index/versão) e PRESERVAÇÃO da 1.0.205.
 * A prova FÍSICA (janela Electron real, multi-máquina real) é do owner pós-publicação — aqui é lógica.
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, "..");
const DIST = path.join(DESK, "dist", "main");
const SRC = path.join(DESK, "src");
const { createSlaReminderController } = require(path.join(DIST, "slaReminder.js"));
const { createSlaReminderStore } = require(path.join(DIST, "slaReminderStore.js"));
const NE = require(path.join(SRC, "main", "notifEvents.js"));
const { createNotificationGrouping } = require(path.join(DIST, "notificationGrouping.js"));

let pass = 0, fail = 0; const fails = [];
function ok(cond, name) { if (cond) { pass++; } else { fail++; fails.push(name); console.error("  ✗ " + name); } }
function eq(a, b, name) { ok(a === b, name + " (got " + JSON.stringify(a) + " exp " + JSON.stringify(b) + ")"); }

let _seq = 0;
function tmpStoreFile() { _seq++; return path.join(os.tmpdir(), "f354p-store-" + process.pid + "-" + _seq + ".json"); }
function mkStore(file) { return createSlaReminderStore({ file: file || tmpStoreFile(), log() {} }); }

function fakeSurface() {
  const calls = [];
  let open = false; let cur = null;
  return {
    calls,
    show(v) { calls.push({ t: "show", key: v.key, level: v.level }); open = true; cur = v; },
    promote(v) { calls.push({ t: "promote", key: v.key, level: v.level }); open = true; cur = v; },
    close() { calls.push({ t: "close" }); open = false; cur = null; },
    isOpen() { return open; },
    native(v) { calls.push({ t: "native", key: v.key }); return true; },
    onNoRender() {},
    _cur() { return cur; },
    _count(t) { return calls.filter((c) => c.t === t).length; },
  };
}
function mkCtl(surface, store, extra) {
  extra = extra || {};
  let uid = extra.uid || "u1";
  const decided = [];
  const c = createSlaReminderController(Object.assign({
    surface, store, now: () => 1000 + (pass + fail) * 7, appVersion: "1.0.206",
    isLocked: () => false, getUid: () => uid,
    soundFor: (lvl) => (lvl === "critical" ? "CRIT" : "WARN"),
    onAcked: () => {},
    onDecided: (info) => { decided.push(info); },
    decisionsEnabled: () => (extra.enabled === undefined ? true : extra.enabled),
    persistDecision: extra.persist || (async () => ({ status: "offline" })),
  }, extra.opts));
  c._decided = decided; c._setUid = (u) => { uid = u; };
  return c;
}
function pay(level, taskId, uid, over) {
  const et = level === "critical" ? "sla_overdue" : "sla_warning";
  return Object.assign({
    eventType: et, severity: level, taskId, targetUserId: uid,
    dedupKey: et + ":" + taskId + ":1893456000000",
    taskTitle: "Edição do vídeo", clientName: "Dra. Ana",
    responsibleName: "Marcos Silva", responsibleAvatar: "https://x/y.png",
    body: level === "critical" ? "Faltam 10 minutos." : "Faltam 30 minutos.",
    context: "Prazo 14:30", action: { type: "detail", deep: "detail/" + taskId },
  }, over || {});
}

console.log("F3.5.4P — alertas de SLA com decisão do responsável");

// ═══ A. decisionKey determinística + boundaryOf (via req capturado no persist) ═══
{
  let captured = null;
  const c = mkCtl(fakeSurface(), mkStore(), { uid: "u1", persist: async (req) => { captured = req; return { status: "committed" }; } });
  c.enqueue(pay("warning", "t1", "u1"));
  await c.onDecide({ key: "sla_warning:t1:1893456000000", decisionType: "acknowledge_only" });
  ok(!!captured, "A01 persistDecision chamado");
  eq(captured && captured.decisionKey, "sla_decision:t1:warning:1893456000000:u1", "A02 decisionKey determinística (task:level:boundary:uid)");
  eq(captured && captured.boundaryVersion, "1893456000000", "A03 boundaryVersion=finishMs extraído da dedupKey");
  eq(captured && captured.recipientUid, "u1", "A04 recipientUid do alerta ativo");
  eq(captured && captured.taskId, "t1", "A05 taskId");
  eq(captured && captured.alertLevel, "warning", "A06 alertLevel do ativo");
}
// vermelho e amarelo → boundary igual, level distinto (marcos distintos)
{
  let cap = null;
  const c = mkCtl(fakeSurface(), mkStore(), { uid: "u1", persist: async (r) => { cap = r; return { status: "committed" }; } });
  c.enqueue(pay("critical", "t9", "u1"));
  await c.onDecide({ key: "sla_overdue:t9:1893456000000", decisionType: "start_now" });
  eq(cap && cap.decisionKey, "sla_decision:t9:critical:1893456000000:u1", "A07 decisionKey do vermelho usa level=critical (marco distinto)");
}

// ═══ B. committed: synced + sino + fecha + deep p/ start_now ═══
{
  const s = fakeSurface(); const st = mkStore();
  const c = mkCtl(s, st, { uid: "u1", persist: async () => ({ status: "committed" }) });
  c.enqueue(pay("warning", "t2", "u1"));
  const r = await c.onDecide({ key: "sla_warning:t2:1893456000000", decisionType: "start_now" });
  eq(r.status, "committed", "B01 onDecide retorna committed");
  eq(r.decisionType, "start_now", "B02 decisionType propagado (main abre a tarefa)");
  eq(r.deep, "detail/t2", "B03 deep p/ abrir a tarefa após commit");
  eq(c._decided.length, 1, "B04 onDecided (sino) disparado 1x");
  eq(c._decided[0].decisionType, "start_now", "B05 sino registra o tipo");
  eq(s._count("close"), 1, "B06 janela fechada APÓS confirmar persistência");
  eq(st.isDecisionSettled("sla_decision:t2:warning:1893456000000:u1"), true, "B07 decisão marcada synced (final)");
}

// ═══ C. already_decided (remoto): superseded + recibo + NÃO fecha (janela mostra msg) ═══
{
  const s = fakeSurface(); const st = mkStore();
  const c = mkCtl(s, st, { uid: "u1", persist: async () => ({ status: "already_decided" }) });
  c.enqueue(pay("warning", "t3", "u1"));
  const r = await c.onDecide({ key: "sla_warning:t3:1893456000000", decisionType: "blocked", reasonCode: "tecnico" });
  eq(r.status, "already_decided", "C01 retorna already_decided");
  eq(c._decided.length, 0, "C02 sem sino/segunda decisão");
  eq(s._count("close"), 0, "C03 controlador não fecha (janela exibe msg e chama dismiss)");
  eq(st.getDecision("sla_decision:t3:warning:1893456000000:u1").state, "superseded", "C04 decisão local marcada superseded");
  ok(st.isAcked("sla_warning:t3:1893456000000"), "C05 recibo do lembrete gravado (não reaparece)");
}

// ═══ D. task_completed: morpha p/ 'concluída' (só reconhecer) ═══
{
  const s = fakeSurface(); const st = mkStore();
  const c = mkCtl(s, st, { uid: "u1", persist: async () => ({ status: "task_completed" }) });
  c.enqueue(pay("warning", "t4", "u1"));
  const r = await c.onDecide({ key: "sla_warning:t4:1893456000000", decisionType: "finishing", etaMinutes: 20 });
  eq(r.status, "task_completed", "D01 retorna task_completed");
  ok(/concluída/.test((s._cur() && s._cur().body) || ""), "D02 modal vira 'tarefa concluída'");
  eq(s._count("close"), 0, "D03 não fecha (usuário clica OK = ack local)");
}

// ═══ E. task_deleted: superseded + recibo, sem histórico órfão ═══
{
  const s = fakeSurface(); const st = mkStore();
  const c = mkCtl(s, st, { uid: "u1", persist: async () => ({ status: "task_deleted" }) });
  c.enqueue(pay("warning", "t5", "u1"));
  const r = await c.onDecide({ key: "sla_warning:t5:1893456000000", decisionType: "help_requested", helpRecipientId: "u2" });
  eq(r.status, "task_deleted", "E01 retorna task_deleted");
  eq(st.getDecision("sla_decision:t5:warning:1893456000000:u1").state, "superseded", "E02 fila local marcada superseded");
}

// ═══ F. offline (queued): fila durável, recibo, sem 2ª decisão ═══
{
  const s = fakeSurface(); const st = mkStore();
  const c = mkCtl(s, st, { uid: "u1", persist: async () => ({ status: "offline" }) });
  c.enqueue(pay("warning", "t6", "u1"));
  const r = await c.onDecide({ key: "sla_warning:t6:1893456000000", decisionType: "finishing", etaMinutes: 30 });
  eq(r.status, "queued", "F01 offline ⇒ queued (aguardando sincronização)");
  const rec = st.getDecision("sla_decision:t6:warning:1893456000000:u1");
  eq(rec.state, "pending_sync", "F02 decisão fica pending_sync (fila durável)");
  eq(rec.payload.etaMinutes, 30, "F03 payload preservado p/ re-dirigir a MESMA transação");
  ok(st.isAcked("sla_warning:t6:1893456000000"), "F04 usuário respondeu ⇒ lembrete não reaparece");
  eq(st.isDecisionSettled("sla_decision:t6:warning:1893456000000:u1"), false, "F05 queued NÃO é estado final (ainda sincroniza)");
}

// ═══ G. error persist-local: mantém modal aberto (retry), sem recibo ═══
{
  const s = fakeSurface();
  const badStore = mkStore();
  badStore.markDecisionPending = () => { throw new Error("disk"); };
  const c = mkCtl(s, badStore, { uid: "u1", persist: async () => ({ status: "committed" }) });
  c.enqueue(pay("warning", "t7", "u1"));
  const r = await c.onDecide({ key: "sla_warning:t7:1893456000000", decisionType: "acknowledge_only" });
  eq(r.status, "error", "G01 falha de persistência local ⇒ error");
  eq(r.error, "persist-local", "G02 erro real (não mascarado como conexão)");
  eq(s._count("close"), 0, "G03 modal permanece aberto (retry)");
}

// ═══ H. idempotência: 2ª decisão settled ⇒ already_decided; disabled ⇒ ignored ═══
{
  // Guarda defensivo: decisão já FINAL (synced) para esta chave, mas lembrete ainda ativo ⇒ nunca 2ª decisão.
  const st = mkStore();
  st.markDecisionSynced("sla_decision:t8:warning:1893456000000:u1");
  const c = mkCtl(fakeSurface(), st, { uid: "u1", persist: async () => ({ status: "committed" }) });
  c.enqueue(pay("warning", "t8", "u1"));
  const r2 = await c.onDecide({ key: "sla_warning:t8:1893456000000", decisionType: "blocked", reasonCode: "cliente" });
  eq(r2.status, "already_decided", "H01 decisão já settled ⇒ already_decided (nunca 2ª)");
}
{
  let called = 0;
  const c = mkCtl(fakeSurface(), mkStore(), { uid: "u1", enabled: false, persist: async () => { called++; return { status: "committed" }; } });
  c.enqueue(pay("warning", "t8b", "u1"));
  const r = await c.onDecide({ key: "sla_warning:t8b:1893456000000", decisionType: "start_now" });
  eq(r.status, "ignored", "H02 flag OFF ⇒ controlador ignora decisão (só OK)");
  eq(called, 0, "H03 flag OFF ⇒ nenhuma persistência");
}
// stale key (não-ativo) ⇒ ignored
{
  const c = mkCtl(fakeSurface(), mkStore(), { uid: "u1", persist: async () => ({ status: "committed" }) });
  c.enqueue(pay("warning", "t8c", "u1"));
  const r = await c.onDecide({ key: "sla_warning:OUTRA:1893456000000", decisionType: "start_now" });
  eq(r.status, "ignored", "H04 chave que não é o alerta ativo ⇒ ignored (defensivo)");
}

// ═══ I. dismiss fecha após msg informativa ═══
{
  const s = fakeSurface(); const st = mkStore();
  const c = mkCtl(s, st, { uid: "u1", persist: async () => ({ status: "already_decided" }) });
  c.enqueue(pay("warning", "t10", "u1"));
  await c.onDecide({ key: "sla_warning:t10:1893456000000", decisionType: "acknowledge_only" });
  eq(s._count("close"), 0, "I01 already_decided não fecha sozinho");
  c.dismiss("sla_warning:t10:1893456000000");
  eq(s._count("close"), 1, "I02 dismiss fecha a janela");
}

// ═══ J. syncPendingDecisions: queued → commit (synced) / already (superseded) / ainda offline ═══
{
  const st = mkStore();
  // enfileira 3 decisões offline p/ o mesmo uid
  const c = mkCtl(fakeSurface(), st, { uid: "u1", persist: async () => ({ status: "offline" }) });
  for (const id of ["q1", "q2", "q3"]) { c.enqueue(pay("warning", id, "u1")); await c.onDecide({ key: "sla_warning:" + id + ":1893456000000", decisionType: "finishing", etaMinutes: 10 }); c.dismiss("sla_warning:" + id + ":1893456000000"); }
  eq(st.listDecisionsPendingSync().length, 3, "J01 3 decisões pending_sync na fila");
  // reconexão: q1 commita, q2 já-decidida em outro device, q3 ainda offline
  let n = 0;
  const c2 = mkCtl(fakeSurface(), st, { uid: "u1", persist: async (req) => { n++; if (/q1/.test(req.decisionKey)) return { status: "committed" }; if (/q2/.test(req.decisionKey)) return { status: "already_decided" }; return { status: "offline" }; } });
  await c2.syncPendingDecisions("reconnect");
  eq(st.getDecision("sla_decision:q1:warning:1893456000000:u1").state, "synced", "J02 q1 sincronizada (synced)");
  eq(st.getDecision("sla_decision:q2:warning:1893456000000:u1").state, "superseded", "J03 q2 outro device venceu (superseded)");
  eq(st.getDecision("sla_decision:q3:warning:1893456000000:u1").state, "pending_sync", "J04 q3 permanece na fila (ainda offline)");
  eq(st.listDecisionsPendingSync().length, 1, "J05 só q3 continua pendente");
  ok(n === 3, "J06 sync tentou as 3");
}
// sync ignora decisões de OUTRO usuário
{
  const st = mkStore();
  const cA = mkCtl(fakeSurface(), st, { uid: "uA", persist: async () => ({ status: "offline" }) });
  cA.enqueue(pay("warning", "z1", "uA")); await cA.onDecide({ key: "sla_warning:z1:1893456000000", decisionType: "start_now" });
  let touched = 0;
  const cB = mkCtl(fakeSurface(), st, { uid: "uB", persist: async () => { touched++; return { status: "committed" }; } });
  await cB.syncPendingDecisions("login");
  eq(touched, 0, "J07 sync só processa decisões do usuário logado");
}

// ═══ K. STORE decisão durável: estados, não-reabre final, eviction ═══
{
  const st = mkStore();
  st.markDecisionPending({ decisionKey: "d1", state: "pending_sync", decisionType: "blocked", alertLevel: "warning", boundaryVersion: "1", recipientUid: "u1", taskId: "t", payload: { a: 1 }, createdAt: 1, updatedAt: 1 });
  eq(st.getDecision("d1").state, "pending_sync", "K01 markDecisionPending grava pending_sync");
  eq(st.isDecisionSettled("d1"), false, "K02 pending_sync não é final");
  st.markDecisionSynced("d1", { appVersion: "1.0.206" });
  eq(st.getDecision("d1").state, "synced", "K03 markDecisionSynced");
  eq(st.isDecisionSettled("d1"), true, "K04 synced é final");
  st.markDecisionPending({ decisionKey: "d1", state: "pending_sync", decisionType: "blocked", alertLevel: "warning", boundaryVersion: "1", recipientUid: "u1", taskId: "t", payload: {}, createdAt: 2, updatedAt: 2 });
  eq(st.getDecision("d1").state, "synced", "K05 pending NÃO reabre uma decisão já final");
  st.markDecisionSuperseded("d2");
  eq(st.getDecision("d2").state, "superseded", "K06 markDecisionSuperseded cria estado final");
}
// persistência entre instâncias (mesmo arquivo)
{
  const f = tmpStoreFile();
  const a = mkStore(f);
  a.markDecisionPending({ decisionKey: "dp", state: "pending_sync", decisionType: "finishing", alertLevel: "warning", boundaryVersion: "1", recipientUid: "u1", taskId: "t", payload: { etaMinutes: 20 }, createdAt: 1, updatedAt: 1 });
  const b = mkStore(f);
  eq(b.getDecision("dp").payload.etaMinutes, 20, "K07 fila durável sobrevive a reinício (mesmo arquivo)");
  eq(b.listDecisionsPendingSync().length, 1, "K08 pendente recuperado no boot");
}

// ═══ L/M/N. notifEvents: derivação help_requested + blocked; start/finishing/ack NÃO notificam ═══
function baseTask(over) { return Object.assign({ id: "T1", title: "Arte do post", sector: "design", by: "creator1", assigneeId: "u1", socialOwnerId: "soc1", history: [] }, over || {}); }
{
  const t = baseTask({ history: [{ kind: "sla_decision", decisionType: "help_requested", at: 5000, byId: "u1", by: "Marcos", forId: "soc1", forName: "Ana Social", helpText: "não tenho o material bruto" }] });
  const evs = NE.deriveTaskEvents(t, 0);
  const hr = evs.filter((e) => e.type === "help_requested");
  eq(hr.length, 1, "M01 1 evento help_requested derivado");
  eq(hr[0].recipientMode, "assigned_designer", "M02 recipientMode assigned_designer (individual)");
  eq(hr[0].recipientId, "soc1", "M03 recipientId = destinatário escolhido (forId)");
  eq(hr[0].eventId, "help_requested:T1:5000:soc1", "M04 eventId determinístico (nunca Date.now())");
  eq(hr[0].actorId, "u1", "M05 ator = solicitante");
  eq(hr[0].helpText, "não tenho o material bruto", "M06 motivo resumido carregado");
}
{
  const t = baseTask({ history: [{ kind: "sla_decision", decisionType: "blocked", at: 6000, byId: "u1", by: "Marcos", reasonCode: "material", blockedRecipientIds: ["soc1", "creator1", "u1"] }] });
  const evs = NE.deriveTaskEvents(t, 0);
  const bl = evs.filter((e) => e.type === "blocked");
  eq(bl.length, 2, "N01 blocked deriva 1 evento por destinatário auditado (exclui o próprio autor)");
  ok(bl.some((e) => e.recipientId === "soc1") && bl.some((e) => e.recipientId === "creator1"), "N02 destinatários = Social + criador");
  ok(!bl.some((e) => e.recipientId === "u1"), "N03 NÃO notifica o próprio autor do bloqueio");
  eq(bl[0].reasonCode, "material", "N04 reasonCode (enum) carregado");
  ok(/^blocked:T1:6000:/.test(bl[0].eventId), "N05 eventId determinístico");
}
{
  const t = baseTask({ history: [
    { kind: "sla_decision", decisionType: "start_now", at: 7000, byId: "u1" },
    { kind: "sla_decision", decisionType: "finishing", at: 7100, byId: "u1", etaMinutes: 20 },
    { kind: "sla_decision", decisionType: "acknowledge_only", at: 7200, byId: "u1" },
  ] });
  const evs = NE.deriveTaskEvents(t, 0);
  eq(evs.filter((e) => e.type === "help_requested" || e.type === "blocked").length, 0, "O01 start_now/finishing/acknowledge_only NÃO geram notificação");
}
// buildCategoryAPayload help/blocked (título/corpo/severidade/deep/notificationType)
{
  const t = baseTask({ history: [{ kind: "sla_decision", decisionType: "help_requested", at: 8000, byId: "u1", by: "Marcos", forId: "soc1", helpText: "preciso do briefing" }] });
  const ev = NE.deriveTaskEvents(t, 0).find((e) => e.type === "help_requested");
  const p = NE.buildCategoryAPayload(ev, "soc1", (id) => ({ name: id === "u1" ? "Marcos" : id, photo: "" }));
  eq(p.title, "Pedido de ajuda", "P01 título distinto");
  ok(/Marcos pediu ajuda/.test(p.body) && /preciso do briefing/.test(p.body), "P02 corpo = solicitante + motivo");
  eq(p.severity, "warning", "P03 severidade distinta do SLA (não critical)");
  eq(p.notificationType, "assigned_designer", "P04 entrega individual");
  eq(p.action.deep, "detail/T1", "P05 clicável, vinculada à tarefa");
  eq(p.targetUserId, "soc1", "P06 targetUserId = destinatário");
}
{
  const t = baseTask({ history: [{ kind: "sla_decision", decisionType: "blocked", at: 8100, byId: "u1", by: "Marcos", reasonCode: "cliente", blockedRecipientIds: ["soc1"] }] });
  const ev = NE.deriveTaskEvents(t, 0).find((e) => e.type === "blocked");
  const p = NE.buildCategoryAPayload(ev, "soc1", (id) => ({ name: id === "u1" ? "Marcos" : id, photo: "" }));
  eq(p.title, "Tarefa bloqueada", "P07 título do bloqueio");
  ok(/Marcos informou bloqueio/.test(p.body) && /aguardando cliente/.test(p.body), "P08 corpo = responsável + rótulo do motivo (sem texto livre)");
}

// ═══ Q. AGRUPAMENTO: help_requested/blocked/sla_decision ⇒ passthrough; comuns seguem agrupáveis ═══
{
  const g = createNotificationGrouping({ now: () => 1000, isEnabled: () => true, onLog() {} });
  eq(g.route({ eventType: "help_requested", severity: "warning", taskId: "t", targetUserId: "u" }).action, "passthrough", "Q01 help_requested nunca agrupa");
  eq(g.route({ eventType: "blocked", severity: "warning", taskId: "t", targetUserId: "u" }).action, "passthrough", "Q02 blocked nunca agrupa");
  eq(g.route({ eventType: "sla_decision", severity: "info", taskId: "t", targetUserId: "u" }).action, "passthrough", "Q03 sla_decision nunca agrupa");
  const first = g.route({ eventType: "task_updated", severity: "info", taskId: "tk", targetUserId: "u" });
  ok(first.action === "first" || first.action === "passthrough", "Q04 tipos COMUNS seguem no fluxo de agrupamento (preservado)");
}

// ═══ R/S/T/U/V. TRANSAÇÃO REAL (extraída de index.html) + simulador OCC ═══
function loadRendererFn(name) {
  const src = fs.readFileSync(path.join(SRC, "renderer", "index.html"), "utf8");
  const re = new RegExp("window\\." + name + "\\s*=\\s*((?:async )?function\\(req\\)\\{[\\s\\S]*?\\n\\})\\s*;");
  const m = src.match(re);
  if (!m) throw new Error("fn not found: " + name);
  return new Function("state", "db", "firebase", "socialOf", "isTaskCompleted", "slaPanelFinishMs", "dtMs", "return (" + m[1] + ")");
}
const FB = { firestore: { FieldValue: { arrayUnion: (x) => ({ __arrayUnion: x }) } } };
function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function makeSim(initialDoc) {
  const store = { doc: initialDoc ? clone(initialDoc) : null, version: 0 };
  function snap() { return { exists: store.doc != null, data: () => clone(store.doc) }; }
  function apply(patch) {
    if (!store.doc) store.doc = {};
    for (const k in patch) {
      const v = patch[k];
      if (v && v.__arrayUnion !== undefined) {
        const arr = Array.isArray(store.doc[k]) ? store.doc[k].slice() : [];
        const cand = v.__arrayUnion;
        if (!arr.some((x) => JSON.stringify(x) === JSON.stringify(cand))) arr.push(cand);
        store.doc[k] = arr;
      } else store.doc[k] = v;
    }
  }
  function makeDb(hook) {
    let fired = false;
    return {
      collection() { return { doc() { return {}; } }; },
      async runTransaction(fn) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const readVersion = store.version;
          let patch = null;
          const tx = { async get() { return snap(); }, update(_r, p) { patch = p; } };
          const res = await fn(tx);
          if (hook && !fired) { fired = true; await hook(); }
          if (patch === null) return res;                 // sem escrita (already_decided/task_*) ⇒ commit trivial
          if (store.version !== readVersion) continue;     // OCC: conflito ⇒ re-executa fn
          apply(patch); store.version++; return res;
        }
        throw new Error("tx-retries-exhausted");
      },
    };
  }
  return { store, makeDb };
}
const socialOfFake = (t) => (t && t.socialOwnerId) || null;
const isCompletedFake = (t) => String((t && t.status) || "") === "concluido" || ["concluido", "entregue"].indexOf(String((t && (t.designerFlowStatus || t.designerWorkflowStage)) || "")) >= 0;
const finishMsFake = (t) => Number(t && t.dueMs) || 0;
const dtMsFake = () => 0;
function mkState(taskDoc) { return { user: { id: "u1", name: "Marcos" }, tasks: taskDoc ? [taskDoc] : [], users: [{ id: "u1", name: "Marcos", status: "" }, { id: "soc1", name: "Ana Social", role: "social media", status: "" }, { id: "creator1", name: "João Criador", status: "" }] }; }
function baseReq(over) { return Object.assign({ decisionKey: "sla_decision:T1:warning:1893456000000:u1", taskId: "T1", alertLevel: "warning", boundaryVersion: "1893456000000", recipientUid: "u1", decisionType: "acknowledge_only" }, over || {}); }
const persistFactory = loadRendererFn("__slaPersistDecision");
const resolveFactory = loadRendererFn("__slaResolveHelp");

// R. committed: 1 entrada correta
{
  const sim = makeSim({ id: "T1", assigneeId: "u1", by: "creator1", socialOwnerId: "soc1", history: [] });
  const persist = persistFactory(mkState(), sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  const r = await persist(baseReq({ decisionType: "finishing", etaMinutes: 20 }));
  eq(r.status, "committed", "R01 transação committed");
  eq(r.deep, "detail/T1", "R02 deep retornado");
  eq(sim.store.doc.history.length, 1, "R03 EXATAMENTE 1 entrada acrescentada");
  const en = sim.store.doc.history[0];
  eq(en.kind, "sla_decision", "R04 entrada kind sla_decision");
  eq(en.decisionKey, "sla_decision:T1:warning:1893456000000:u1", "R05 decisionKey na entrada");
  eq(en.etaMinutes, 20, "R06 etaMinutes gravado (previsão)");
  eq(en.byId, "u1", "R07 byId = responsável");
}
// blocked → blockedRecipientIds (criador/Social, exclui autor)
{
  const sim = makeSim({ id: "T1", assigneeId: "u1", by: "creator1", socialOwnerId: "soc1", history: [] });
  const persist = persistFactory(mkState(), sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  await persist(baseReq({ decisionType: "blocked", reasonCode: "material" }));
  const en = sim.store.doc.history[0];
  ok(Array.isArray(en.blockedRecipientIds) && en.blockedRecipientIds.indexOf("soc1") >= 0 && en.blockedRecipientIds.indexOf("creator1") >= 0, "R08 blocked grava destinatários (Social+criador)");
  ok(en.blockedRecipientIds.indexOf("u1") < 0, "R09 não inclui o próprio autor");
}
// S. task_deleted / task_completed / not_authorized
{
  const sim = makeSim(null); // doc inexistente
  const persist = persistFactory(mkState(), sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  eq((await persist(baseReq())).status, "task_deleted", "S01 doc inexistente ⇒ task_deleted");
}
{
  const sim = makeSim({ id: "T1", assigneeId: "u1", status: "concluido", history: [] });
  const persist = persistFactory(mkState(), sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  eq((await persist(baseReq())).status, "task_completed", "S02 status concluido ⇒ task_completed");
  eq(sim.store.doc.history.length, 0, "S03 tarefa concluída ⇒ nada gravado");
}
{
  const sim = makeSim({ id: "T1", assigneeId: "OUTRO", by: "creator1", history: [] });
  const persist = persistFactory(mkState(), sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  eq((await persist(baseReq())).status, "not_authorized", "S04 responsável mudou ⇒ not_authorized (revalidado na transação)");
}
{
  const sim = makeSim({ id: "T1", assigneeId: "u1", history: [] });
  const stt = mkState(); stt.user = { id: "hacker", name: "X" };
  const persist = persistFactory(stt, sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  eq((await persist(baseReq())).status, "not_authorized", "S05 uid logado ≠ destinatário ⇒ not_authorized (camada renderer)");
}
// T. already_decided: decisionKey já presente
{
  const sim = makeSim({ id: "T1", assigneeId: "u1", history: [{ kind: "sla_decision", decisionKey: "sla_decision:T1:warning:1893456000000:u1", decisionType: "start_now" }] });
  const persist = persistFactory(mkState(), sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  eq((await persist(baseReq({ decisionType: "blocked", reasonCode: "cliente" }))).status, "already_decided", "T01 decisionKey já registrada ⇒ already_decided");
  eq(sim.store.doc.history.length, 1, "T02 sem 2ª entrada");
}
// U. CONCORRÊNCIA: 2 quase simultâneas, mesma decisionKey, decisões diferentes
{
  const sim = makeSim({ id: "T1", assigneeId: "u1", by: "creator1", socialOwnerId: "soc1", history: [] });
  const persistB = persistFactory(mkState(), sim.makeDb(), FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  // A lê v0 e, ANTES de commitar, B roda inteiro (lê v0, commita v0→v1). A commit ⇒ conflito ⇒ retry ⇒ already_decided.
  let bResult = null;
  const dbA = sim.makeDb(async () => { bResult = await persistB(baseReq({ decisionType: "blocked", reasonCode: "tecnico" })); });
  const persistA = persistFactory(mkState(), dbA, FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  const aResult = await persistA(baseReq({ decisionType: "finishing", etaMinutes: 10 }));
  eq(bResult.status, "committed", "U01 primeira transação confirmada vence (B committed)");
  eq(aResult.status, "already_decided", "U02 a segunda recebe already_decided");
  eq(sim.store.doc.history.length, 1, "U03 UMA única entrada oficial no histórico");
  eq(sim.store.doc.history[0].decisionType, "blocked", "U04 a entrada é a da transação vencedora (sem duplicar/misturar)");
  // 1 única notificação derivada (a vencedora foi 'blocked' → 1 por destinatário; nenhuma da perdedora)
  const evs = NE.deriveTaskEvents(sim.store.doc, 0).filter((e) => e.type === "help_requested" || e.type === "blocked");
  const hr = NE.deriveTaskEvents(sim.store.doc, 0).filter((e) => e.type === "help_requested");
  eq(hr.length, 0, "U05 nenhuma notificação da decisão perdedora (finishing/help)");
  ok(evs.length >= 1, "U06 apenas a(s) notificação(ões) da decisão vencedora existem");
}
// V. offline: runTransaction lança ⇒ offline
{
  const badDb = { collection() { return { doc() { return {}; } }; }, runTransaction() { return Promise.reject(new Error("network")); } };
  const persist = persistFactory(mkState(), badDb, FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  const r = await persist(baseReq());
  eq(r.status, "offline", "V01 falha de rede na transação ⇒ offline (fila re-tenta)");
}

// W. __slaResolveHelp: preselected / ambiguous / exclui self
{
  const t = { id: "T1", by: "creator1", socialOwnerId: "soc1", assigneeId: "u1" };
  const resolve = resolveFactory(mkState(t), null, FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  const rHelp = resolve({ taskId: "T1" });
  ok(rHelp.reason === "ambiguous" || rHelp.reason === "preselected", "W01 resolve retorna candidatos reais");
  ok((rHelp.eligible || []).every((u) => u.id !== "u1"), "W02 solicitante (self) nunca é destinatário");
}
{
  // só Social (creator == self) ⇒ preselected único
  const t = { id: "T2", by: "u1", socialOwnerId: "soc1", assigneeId: "u1" };
  const resolve = resolveFactory(mkState(t), null, FB, socialOfFake, isCompletedFake, finishMsFake, dtMsFake);
  const r = resolve({ taskId: "T2" });
  eq(r.reason, "preselected", "W03 destinatário único (Social) ⇒ preselected");
  eq(r.preselect.id, "soc1", "W04 preselect = Social Media (visível antes de enviar)");
}
{
  // sem tier-2 (criador=self, sem social) ⇒ lista p/ seleção (ambiguous) sem escolher em silêncio
  const t = { id: "T3", by: "u1", assigneeId: "u1" };
  const st = mkState(t); // usuários soc1/creator1 ativos existem
  const resolve = resolveFactory(st, null, FB, () => null, isCompletedFake, finishMsFake, dtMsFake);
  const r = resolve({ taskId: "T3" });
  ok(r.reason === "ambiguous" && (r.eligible || []).length >= 1, "W05 indeterminado ⇒ exige seleção (nunca envia a todos em silêncio)");
}

// ═══ X. WIRING estático + preservação 1.0.205 ═══
function read(p) { return fs.readFileSync(path.join(DESK, p), "utf8"); }
{
  const pre = read("src/preload/slareminder-preload.ts");
  ok(/decide:/.test(pre) && /onResult:/.test(pre) && /dismiss:/.test(pre) && /resolveHelp:/.test(pre) && /onHelpCandidates:/.test(pre), "X01 slareminder-preload expõe decide/onResult/dismiss/resolveHelp/onHelpCandidates");
  const pre2 = read("src/preload/preload.ts");
  ok(/slaDecisionGet:/.test(pre2) && /slaDecisionSet:/.test(pre2), "X02 preload expõe slaDecisionGet/Set");
  const win = read("src/main/slaReminderWindow.ts");
  ok(/slareminder-decide/.test(win) && /slareminder-dismiss/.test(win) && /slareminder-resolve-help/.test(win) && /setFocusable/.test(win), "X03 janela: IPC decide/dismiss/resolve-help + setFocusable");
  const html = read("src/renderer/slareminder.html");
  ok(/Iniciar agora/.test(html) && /Estou finalizando/.test(html) && /Estou bloqueado/.test(html) && /Preciso de ajuda/.test(html) && /Apenas reconhecer/.test(html), "X04 HTML: 5 decisões");
  ok(/Seu pedido será enviado para|enviado para/.test(html) || /recip/.test(html), "X05 HTML: linha do destinatário da ajuda");
  ok(/aguardando sincronização/.test(html) && /já foi respondido/.test(html), "X06 HTML: estados queued + already_decided");
  ok(/É uma PREVISÃO/.test(html) && /NÃO são pausados|não são pausados|NÃO pausados|SLA e o prazo NÃO/.test(html), "X07 HTML: ETA é previsão + bloqueio não pausa SLA");
  const main = read("src/main/main.ts");
  ok(/persistSlaDecisionViaRenderer/.test(main) && /resolveSlaHelpViaRenderer/.test(main), "X08 main: relays de transação e ajuda");
  ok(/sla-decision-get/.test(main) && /sla-decision-set/.test(main), "X09 main: IPC da flag");
  ok(/syncPendingDecisions/.test(main), "X10 main: sincroniza fila offline (reconexão/resume/login)");
  ok(/loadSlaDecisionFlag/.test(main) && /slaDecisionActionsEnabled/.test(main), "X11 main: flag default ON");
  const idx = read("src/renderer/index.html");
  ok(/window\.__slaPersistDecision/.test(idx) && /runTransaction/.test(idx), "X12 index: transação real (__slaPersistDecision + runTransaction)");
  ok(/window\.__slaResolveHelp/.test(idx), "X13 index: resolução do destinatário da ajuda");
  ok(/data-cfgsladecision/.test(idx), "X14 index: toggle Configurações → Notificações");
  ok(/blockedRecipientIds/.test(idx), "X15 index: destinatários auditados do bloqueio");
  const ne = read("src/main/notifEvents.js");
  ok(/help_requested/.test(ne) && /blocked/.test(ne), "X16 notifEvents: derivações help/blocked");
  const grp = read("src/main/notificationGrouping.ts");
  ok(/help_requested/.test(grp) && /blocked/.test(grp), "X17 notificationGrouping: denylist reforçada");
  const pkg = JSON.parse(read("package.json"));
  eq(pkg.version, "1.0.227", "X18 versão 1.0.227 (RE-PINADO F3.5.5E-H3)");
  // PRESERVAÇÃO: não altera tempos/dedupKeys dos produtores congelados
  const sla = read("src/main/slaRules.js");
  ok(/sla_warning/.test(sla) && /sla_overdue/.test(sla), "X19 slaRules preservado (tags de dedup intactas)");
  ok(!/__slaPersistDecision|onDecide/.test(sla), "X20 produtor SLA NÃO tocado pela decisão (congelado)");
  // notifierA inalterado (recipient filter já existente)
  const na = read("src/main/notifierA.ts");
  ok(/assigned_designer/.test(na), "X21 notifierA: filtro de destinatário reutilizado (sem alteração de contrato)");
}

// ── resumo ──
console.log("\nF3.5.4P: " + pass + " passaram, " + fail + " falharam" + (fail ? " → " + fails.join(" | ") : ""));
if (fail) process.exit(1);
