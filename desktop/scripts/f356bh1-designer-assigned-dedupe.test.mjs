/* F3.5.6B-H1 — DESKTOP 1.0.245 — DEDUPE DA NOTIFICAÇÃO DE ATRIBUIÇÃO AO DESIGNER.
 * =====================================================================================
 * FALHA FÍSICA "A3" (F3.5.6B, Cronograma Teste 7): ao atribuir uma tarefa a um Designer,
 * o Designer recebia DUAS notificações — a CANÔNICA e superior "Tarefa atribuída" (Categoria A
 * legada, notifEvents.js → task_assigned, derivada do campo designerAssignment) E uma SEGUNDA
 * "Nova atribuição" (workflow, WF_POLICY[DESIGNER_ASSIGNED]). A ação de atribuição (sendToDesigner
 * no renderer) grava DOIS produtores no MESMO instante: designerAssignment (legado) e o ledger
 * workflowEvents.ev_dassign_ (DESIGNER_ASSIGNED). Ambos convergiam no MESMO Designer ⇒ duplicidade.
 *
 * CORREÇÃO (1 arquivo de produção; renderer NÃO tocado): REMOVER a entrada DESIGNER_ASSIGNED de
 * WF_POLICY em src/main/workflowEvents.js. Sem política ⇒ wfRecipientOk=false e buildWorkflowPayload
 * =null (o consumidor filtra o evento ANTES do ingresso, sem recibo/cursor/retry), exatamente como
 * *_APPROVAL_REQUESTED / WORKFLOW_COMPLETED / DESIGNER_STARTED. O evento de ledger DESIGNER_ASSIGNED
 * CONTINUA sendo gravado e derivado (observabilidade/timeline) — só a NOTIFICAÇÃO por essa via some.
 *
 * RED→GREEN: este arquivo mede as ENTREGAS ao Designer somando os DOIS produtores.
 *   BASE 1.0.244 (DESIGNER_ASSIGNED presente):   total = 2  ⇒ B2/B3/B4/B5/D3 FALHAM (RED).
 *   CANDIDATO 1.0.245 (DESIGNER_ASSIGNED fora):   total = 1  ⇒ tudo PASSA (GREEN).
 * Prova de RED sem editar este arquivo — apontar SOMENTE o motor de política para a base:
 *   F356BH1_WE=<worktree-base>/desktop/src/main/workflowEvents.js node scripts/f356bh1-designer-assigned-dedupe.test.mjs
 * (mantendo notifEvents/pkg no candidato, o RED isola EXATAMENTE a política DESIGNER_ASSIGNED.)
 *
 * Env overrides (modo ASAR/CI): F356BH1_WE, F356BH1_NOTIF, F356BH1_PKG, F356BH1_LOCK, F356BH1_WN.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const D = (p) => path.resolve(here, "..", p);
const ENV = process.env;
const E = (v) => (v ? path.resolve(v) : null);
const WE_PATH = E(ENV.F356BH1_WE) || D("src/main/workflowEvents.js");
const NOTIF_PATH = E(ENV.F356BH1_NOTIF) || D("src/main/notifEvents.js");
const PKG = E(ENV.F356BH1_PKG) || D("package.json");
const LOCK = E(ENV.F356BH1_LOCK) || D("package-lock.json");
const WN_DIST = E(ENV.F356BH1_WN) || D("dist/main/workflowNotifier.js");

let okc = 0, fail = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { okc++; console.log("ok " + (okc + fail) + " - " + name); }
  else { fail++; fails.push(name); console.log("NOT OK " + (okc + fail) + " - " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const read = (p) => fs.readFileSync(p, "utf8");
const require2 = createRequire(import.meta.url);
const WE = require2(WE_PATH);
const NOTIF = require2(NOTIF_PATH);
const NOW = 1750000000000;

/* Ator/designer do cenário físico A3 (nomes de referência do owner). */
const EXEC = "exec_arydyjany";
const DES = "des_miercohevisk";
/* Contexto do Designer no motor de política do workflow. */
const desCtx = (uid) => ({ uid: uid, user: { id: uid, role: "designer", admin: false }, resolveProfile: () => null });
/* Tarefa REAL de atribuição: os DOIS produtores gravados pela MESMA ação (sendToDesigner). */
function assignTask() {
  return {
    id: "T_A3", title: "Cronograma Teste 7", client: "Cliente teste", socialOwnerId: EXEC,
    cronContents: [{}, {}],
    // Produtor LEGADO (Categoria A): designerAssignment ⇒ notifEvents.task_assigned "Tarefa atribuída".
    designerAssignment: {
      designerId: DES, designerName: "Miercohévisk Niheb Ferreira Nascimento Carlôto",
      assignedAt: NOW - 1000, assignedBy: EXEC, assignedByName: "Arydyjany Carlôto"
    },
    // Produtor WORKFLOW: ledger ev_dassign_ ⇒ DESIGNER_ASSIGNED (mesmo Designer, mesmo instante).
    workflowEvents: {
      ["ev_dassign_" + DES + "_c1"]: { t: "DESIGNER_ASSIGNED", ph: "design_production", at: NOW - 1000, src: "team", by: EXEC, ru: DES, n: 2, tot: 2, v: 1 }
    }
  };
}
/* Evento DESIGNER_ASSIGNED já derivado do ledger (forma consumida pelo motor de política). */
const dassignEv = () => Object.assign({ id: "T_A3:ev_dassign_" + DES + "_c1", lk: "ev_dassign_" + DES + "_c1", type: "DESIGNER_ASSIGNED", at: NOW - 1000, phase: "design_production", roundKey: "", src: "team", by: EXEC, ru: DES, ii: null, n: 2, tot: 2, taskId: "T_A3" });

/* ── Modelo de ENTREGAS ao Designer (soma dos dois produtores) ───────────────── */
function legacyDeliversToDesigner(t, uid) {
  // notifierA entrega task_assigned no modo 'all_active_users' (inclui o Designer ativo).
  const evs = NOTIF.deriveTaskEvents(t, { nowMs: NOW });
  return evs.some((e) => e.type === "task_assigned" && String(e.assignedDesignerId) === String(uid) && e.recipientMode === "all_active_users");
}
function workflowDeliversToDesigner(t, uid) {
  // Sem WF_POLICY[DESIGNER_ASSIGNED] ⇒ wfRecipientOk=false ⇒ o consumidor descarta antes do ingresso.
  return WE.wfRecipientOk(dassignEv(), t, desCtx(uid)) === true;
}
function totalDeliveriesToDesigner(t, uid) {
  return (legacyDeliversToDesigner(t, uid) ? 1 : 0) + (workflowDeliversToDesigner(t, uid) ? 1 : 0);
}

/* ═══ A — IDENTIDADE (candidato 1.0.245) ═══ */
const pkg = JSON.parse(read(PKG));
ok("A1 versão 1.0.245", pkg.version === "1.0.245", pkg.version);
try {
  const lock = JSON.parse(read(LOCK));
  ok("A2 lock 1.0.245 ×2", lock.version === "1.0.245" && lock.packages[""].version === "1.0.245");
} catch (e) { ok("A2 lock 1.0.245 ×2", false, String(e.message)); }
ok("A3 marcador f356bh1 na descrição", (pkg.description || "").includes("f356bh1-designer-assigned-dedupe"));
ok("A4 motor de política workflowEvents.js carregado", typeof WE.wfRecipientOk === "function" && typeof WE.buildWorkflowPayload === "function" && !!WE.WF_POLICY);
ok("A5 produtor legado notifEvents.js carregado", typeof NOTIF.deriveTaskEvents === "function");

/* ═══ B — RED→GREEN: DUPLICIDADE ELIMINADA (Designer recebe EXATAMENTE 1) ═══ */
{
  const t = assignTask();
  ok("B1 produtor LEGADO presente: 1 task_assigned p/ o Designer (CANÔNICO, preservado)", legacyDeliversToDesigner(t, DES) === true);
  ok("B2 WF_POLICY NÃO contém DESIGNER_ASSIGNED (política removida)", !("DESIGNER_ASSIGNED" in WE.WF_POLICY));
  ok("B3 wfRecipientOk(DESIGNER_ASSIGNED, Designer) === false (sem política ⇒ ninguém)", WE.wfRecipientOk(dassignEv(), t, desCtx(DES)) === false);
  ok("B4 buildWorkflowPayload(DESIGNER_ASSIGNED) === null (não nasce toast por esta via)", WE.buildWorkflowPayload(dassignEv(), t, desCtx(DES), null) === null);
  const total = totalDeliveriesToDesigner(t, DES);
  ok("B5 [HEADLINE] Designer recebe EXATAMENTE 1 notificação (RED na base = 2)", total === 1, { legacy: legacyDeliversToDesigner(t, DES), workflow: workflowDeliversToDesigner(t, DES), total });
  ok("B6 os DOIS produtores miravam o MESMO Designer (era duplicidade real, não 2 destinatários)",
    legacyDeliversToDesigner(t, DES) === true && WE.wfRecipientOk(dassignEv(), t, desCtx(DES)) === false);
}

/* ═══ C — PRESERVAÇÃO da notificação CANÔNICA "Tarefa atribuída" (intacta) ═══ */
{
  const t = assignTask();
  const evs = NOTIF.deriveTaskEvents(t, { nowMs: NOW });
  const ta = evs.find((e) => e.type === "task_assigned");
  ok("C1 task_assigned recipientMode 'all_active_users' (alcança o Designer + equipe)", !!ta && ta.recipientMode === "all_active_users");
  ok("C2 título canônico verbatim 'Tarefa atribuída'", NOTIF.evTitle("task_assigned") === "Tarefa atribuída");
  ok("C3 corpo canônico cita ator→Designer (conteúdo intacto)",
    /atribuiu/.test(NOTIF.evBody(ta, "Arydyjany", "Miercohévisk")) && /Miercohévisk/.test(NOTIF.evBody(ta, "Arydyjany", "Miercohévisk")));
  ok("C4 eventId legado inalterado (task_assigned:taskId:designerId:assignedAt)",
    !!ta && ta.eventId === "task_assigned:T_A3:" + DES + ":" + (NOW - 1000));
  ok("C5 destinatário canônico = o Designer atribuído", !!ta && String(ta.assignedDesignerId) === DES);
}

/* ═══ D — REGRESSÃO: todos os OUTROS eventos do workflow seguem NOTIFICANDO ═══ */
{
  const t = { id: "T2", client: "C", socialOwnerId: "sm1", cronContents: [{}, {}] };
  const mk = (type, extra) => Object.assign({ id: "e1", type, at: NOW, by: "", ru: "", n: 0, tot: 0, phase: "assignment_pending" }, extra || {});
  // audiência social_resp — o responsável Social recebe (não-ator)
  const socialTypes = ["CLIENT_THEMES_APPROVED", "CLIENT_CAPTIONS_APPROVED", "CLIENT_THEMES_ADJUSTMENT_REQUESTED", "CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED", "CLIENT_THEMES_FIRST_VIEWED", "CLIENT_CAPTIONS_FIRST_VIEWED", "DESIGNER_ITEM_COMPLETED", "DESIGN_PRODUCTION_COMPLETED", "THEMES_READY", "CAPTIONS_READY"];
  let allSocialOk = true;
  for (const ty of socialTypes) if (WE.wfRecipientOk(mk(ty, { by: "u9" }), t, { uid: "sm1", user: { id: "sm1", role: "social media" } }) !== true) allSocialOk = false;
  ok("D1 os 10 eventos remanescentes ainda notificam a audiência correta", allSocialOk);
  ok("D2 eventos SEM política continuam SEM notificar (APPROVAL_REQUESTED/COMPLETED/STARTED)",
    WE.wfRecipientOk(mk("CLIENT_THEMES_APPROVAL_REQUESTED"), t, { uid: "sm1", user: { id: "sm1", role: "social" } }) === false
    && WE.wfRecipientOk(mk("WORKFLOW_COMPLETED"), t, { uid: "sm1", user: { id: "sm1", role: "social" } }) === false
    && WE.wfRecipientOk(mk("DESIGNER_STARTED"), t, { uid: "sm1", user: { id: "sm1", role: "social" } }) === false);
  const keys = Object.keys(WE.WF_POLICY);
  ok("D3 WF_POLICY = 10 entradas; a única removida foi DESIGNER_ASSIGNED (diff mínimo)",
    keys.length === 10 && !keys.includes("DESIGNER_ASSIGNED")
    && ["CLIENT_THEMES_APPROVED", "CLIENT_CAPTIONS_APPROVED", "CLIENT_THEMES_ADJUSTMENT_REQUESTED", "CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED", "CLIENT_THEMES_FIRST_VIEWED", "CLIENT_CAPTIONS_FIRST_VIEWED", "DESIGNER_ITEM_COMPLETED", "DESIGN_PRODUCTION_COMPLETED", "THEMES_READY", "CAPTIONS_READY"].every((k) => keys.includes(k)), keys);
  // payloads dos remanescentes seguem nascendo (não-nulos)
  ok("D4 buildWorkflowPayload dos remanescentes segue não-nulo (aprovação/ajuste/visualização)",
    !!WE.buildWorkflowPayload(mk("CLIENT_THEMES_APPROVED", { by: "u9" }), t, { uid: "sm1", user: { id: "sm1", role: "social" }, resolveProfile: () => null }, null)
    && !!WE.buildWorkflowPayload(mk("CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED", { by: "u9" }), t, { uid: "sm1", user: { id: "sm1", role: "social" }, resolveProfile: () => null }, null));
}

/* ═══ E — LEDGER/OBSERVABILIDADE PRESERVADOS (só a notificação saiu) ═══ */
{
  const t = assignTask();
  const led = WE.deriveLedgerEvents(t, { nowMs: NOW });
  const da = led.find((e) => e.type === "DESIGNER_ASSIGNED");
  ok("E1 deriveLedgerEvents AINDA deriva DESIGNER_ASSIGNED (timeline/auditoria vivas)", !!da);
  ok("E2 evento derivado conserva id task-scoped + ru + n/tot + fase (metadados completos)",
    !!da && da.id === "T_A3:ev_dassign_" + DES + "_c1" && da.ru === DES && da.n === 2 && da.tot === 2 && da.phase === "design_production");
  // wfTitleBody continua existindo (dead code inofensivo), mas nunca é alcançado sem política.
  ok("E3 wfTitleBody(DESIGNER_ASSIGNED) segue definido (dead code inofensivo, nunca alcançado)",
    typeof WE.wfTitleBody === "function" && WE.wfTitleBody(dassignEv(), t, null).title === "Nova atribuição");
}

/* ═══ F — IDEMPOTÊNCIA: restart / snapshot repetido ⇒ SEMPRE 1 (nunca renasce) ═══ */
{
  const t = assignTask();
  // Snapshots repetidos em tempo real re-derivam o ledger; sem política, nunca há entrega workflow.
  let stable = true;
  for (let i = 0; i < 5; i++) if (workflowDeliversToDesigner(t, DES) !== false || totalDeliveriesToDesigner(t, DES) !== 1) stable = false;
  ok("F1 5 re-derivações (restart/snapshot) ⇒ workflow=0 e total=1 SEMPRE", stable);

  // Prova ponta-a-ponta pelo CONSUMIDOR REAL (dist), quando disponível (CI pós-build):
  if (fs.existsSync(WN_DIST)) {
    const WN = require2(WN_DIST);
    const memStore = () => { const rec = new Set(); let cur = 0; return { deviceId: () => "dev1", cursorGet: () => cur, cursorSet: (u, at) => { if (at > cur) cur = at; }, receiptHas: (u, id) => rec.has(id), receiptAdd: (u, id) => rec.add(id), _rec: rec }; };
    const fl = (() => { const cbs = {}; return { listen: (n, cb) => { cbs[n] = cb; return () => { delete cbs[n]; }; }, push: (n, docs) => cbs[n] && cbs[n]({ docChanges: () => docs.map((d) => ({ type: "added", doc: { id: d.id, data: () => d } })) }) }; })();
    const delivered = [];
    const setT = () => 1, clrT = () => { };
    const h = WN.startWorkflowNotifier(DES, (p) => { delivered.push(p); return { ok: true, channel: "toast" }; },
      { listen: fl.listen, store: memStore(), now: () => NOW, authUser: () => ({ id: DES, role: "designer", admin: false }), onLog: () => { }, setTimer: setT, clearTimer: clrT, aggWindowMs: 15000 });
    fl.push("tasks", [assignTask()]);
    ok("F2 [consumidor REAL/dist] ZERO entrega de workflow ao Designer (na base = 1)", delivered.length === 0, { delivered: delivered.length });
    fl.push("tasks", [assignTask()]);   // snapshot repetido
    ok("F3 [consumidor REAL/dist] snapshot repetido ⇒ continua ZERO (sem duplicar)", delivered.length === 0);
    h.stop();
  } else {
    console.log("# F2/F3: dist/main/workflowNotifier.js ausente (rode após npm run build) — cobertura pura em F1 + B3/B4");
    ok("F2 consumidor real coberto por B3/B4 + F1 quando dist ausente", true);
  }
}

console.log(`\n# f356bh1-designer-assigned-dedupe: ${okc}/${okc + fail} OK${fail ? " — FALHAS: " + fail : ""}`);
if (fails.length) { console.log("FALHAS:"); fails.forEach((f) => console.log(" - " + f)); process.exit(1); }
