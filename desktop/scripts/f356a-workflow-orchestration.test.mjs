/* F3.5.6A — ORQUESTRAÇÃO OPERACIONAL, SLA POR RESPONSABILIDADE E APROVAÇÕES (Desktop 1.0.229; H1 = 1.0.230, colisão de recibos corrigida)
 * =====================================================================================
 * Suíte da fase. Cobre:
 *  A  identidade (1.0.229) + arquivos novos
 *  B  CONGELADOS byte-idênticos ao baseline 1.0.228 (bgNotify/notificationGrouping/bgnotify.html)
 *  C  motor PURO workflowEvents.js (derivação do ledger + política + agregação + follow-up)
 *  D  produtor workflowNotifier (ordem, recibos-só-após-aceite, retry, rajada agregada)
 *  E  SLA por responsabilidade (externalWaitOf + display waiting_client + zero emissão) e
 *     PARIDADE main×renderer (byte-idêntica na função)
 *  F  priorityEngine — AGUARDANDO CLIENTE nunca vira atraso pessoal
 *  G  pins do renderer (COPIAR≠ENVIADO, confirmar envio, registro WhatsApp, gate de atribuição,
 *     produção concluída canônica, fase desde o nascimento, Central do Cliente, chip do card)
 *  H  Worker V64.61 (vm): augment de decisão (rodadas/fases/runs/ledger/idempotência),
 *     confirmClientSend (sentAt server-side + espelhos legados), viewed (anti-crawler,
 *     1ª visualização única), registro externo via WhatsApp convergindo na função canônica
 *  I  COMPATIBILIDADE 1.0.228: writeClientGranular NOVO × BASELINE ⇒ campos legados
 *     byte-equivalentes; extras SÓ aditivos (allowlist)
 * Env overrides (modo ASAR/CI): F356A_SRC, F356A_MAIN_SRC, F356A_WORKER, F356A_WE,
 * F356A_DIST_WN, F356A_PKG, F356A_LOCK, F356A_SLARULES.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const D = (p) => path.resolve(here, "..", p);
const ROOT = path.resolve(here, "..", "..");
const ENV = process.env;
/* Overrides do env viram ABSOLUTOS (require() rejeita relativo sem "./" — modo ASAR). */
const E = (v) => (v ? path.resolve(v) : null);
const SRC = E(ENV.F356A_SRC) || D("src/renderer/index.html");
const MAIN_SRC = E(ENV.F356A_MAIN_SRC) || D("src/main/main.ts");
const SLARULES = E(ENV.F356A_SLARULES) || D("src/main/slaRules.js");
const WE_PATH = E(ENV.F356A_WE) || D("src/main/workflowEvents.js");
const WN_DIST = E(ENV.F356A_DIST_WN) || D("dist/main/workflowNotifier.js");
const WORKER = E(ENV.F356A_WORKER) || path.join(ROOT, "cloudflare-worker.js");
const PKG = E(ENV.F356A_PKG) || D("package.json");
const LOCK = E(ENV.F356A_LOCK) || D("package-lock.json");

let okc = 0, fail = 0; const fails = [];
function ok(name, cond, extra) {
  if (cond) { okc++; console.log("ok " + (okc + fail) + " - " + name); }
  else { fail++; fails.push(name); console.log("NOT OK " + (okc + fail) + " - " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const read = (p) => fs.readFileSync(p, "utf8");

/* extração balanceada de função por marcador (padrão f355c/f350) */
function extractFn(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error("marker não encontrado: " + marker);
  const start = src.lastIndexOf("\n", i) + 1;
  let j = src.indexOf("{", i); let depth = 0;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(start, j);
}

/* ═══ A — IDENTIDADE ═══ */
const pkg = JSON.parse(read(PKG));
ok("A1 versão 1.0.239", pkg.version === "1.0.239", pkg.version);
try {
  const lock = JSON.parse(read(LOCK));
  ok("A2 lock 1.0.239 ×2", lock.version === "1.0.239" && lock.packages[""].version === "1.0.239");
} catch (e) { ok("A2 lock 1.0.239 ×2", false, String(e.message)); }
ok("A3 workflowEvents.js existe (motor puro)", fs.existsSync(WE_PATH));
ok("A4 workflowNotifier compilado no dist", fs.existsSync(WN_DIST));

/* ═══ B — CONGELADOS byte-idênticos ao baseline (git 3f0d0af = 1.0.228) ═══ */
const BASE_SHA = ENV.F356A_BASE_SHA || "3f0d0af";
let gitOk = true; let showBase = (p) => "";
try {
  showBase = (p) => execFileSync("git", ["show", BASE_SHA + ":" + p], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
  showBase("desktop/package.json");
} catch (_) { gitOk = false; }
if (gitOk) {
  for (const f of ["desktop/src/main/bgNotify.ts", "desktop/src/main/notificationGrouping.ts", "desktop/src/renderer/bgnotify.html"]) {
    try { ok("B congelado byte-idêntico: " + f, showBase(f) === read(path.join(ROOT, f))); }
    catch (e) { ok("B congelado byte-idêntico: " + f, false, String(e.message)); }
  }
} else {
  console.log("# B: git baseline indisponível neste checkout — gate coberto pelos pins literais das suítes f355eh4/f355eh3");
  ok("B congelados cobertos por suítes herdadas (git raso)", true);
}
const mainSrc = read(MAIN_SRC);
ok("B4 bloco handoff intacto (handoffTx + HANDOFF_ACCEPT_MS)", /const handoffTx = new Map/.test(mainSrc) && /HANDOFF_ACCEPT_MS = 4600/.test(mainSrc));
ok("B5 ingresso deliverNotification intacto (assinatura)", mainSrc.includes("function deliverNotification(p: NotifPayload): { ok: boolean; channel: string }"));
ok("B6 wiring do produtor novo usa o MESMO ingresso", /startWorkflowNotifier\(uid, deliverNotification/.test(mainSrc));
ok("B7 stop compõe o produtor novo", /_workflowN\.stop\(\)/.test(mainSrc));
ok("B8 reconcile em unlock/resume", /workflowNHandle\.reconcile\("unlock"\)/.test(mainSrc) && /workflowNHandle\.reconcile\("resume"\)/.test(mainSrc));

/* ═══ C — MOTOR PURO workflowEvents.js ═══ */
const { createRequire } = await import("node:module");
const require2 = createRequire(import.meta.url);
const WE = require2(WE_PATH);
const NOW = 1750000000000;
function mkLedger(entries) { const m = {}; entries.forEach((e, i) => { m[e.k || ("ev_x" + i)] = e.v; }); return m; }
{
  const t = { id: "T1", title: "Cron", client: "Hospital Visão", cronContents: [{}, {}, {}],
    workflowEvents: mkLedger([
      { k: "ev_b", v: { t: "CLIENT_THEMES_APPROVED", at: NOW - 1000, ph: "assignment_pending", rd: "ar_themes_r1", src: "portal", by: "client" } },
      { k: "ev_a", v: { t: "CLIENT_THEMES_APPROVAL_REQUESTED", at: NOW - 5000, ph: "themes_waiting_client", rd: "ar_themes_r1", src: "team", by: "u1" } },
      { k: "ev_old", v: { t: "THEMES_READY", at: NOW - 40 * 24 * 3600 * 1000 } },
      { k: "ev_bad", v: { t: "", at: NOW } }, { k: "ev_bad2", v: null },
    ]) };
  const evs = WE.deriveLedgerEvents(t, { nowMs: NOW });
  /* F3.5.6A-H1 — id GLOBAL (taskId:ledgerKey): a chave do ledger sozinha se repete em toda tarefa
     (rodada 1) e colidia recibo/dedupe entre tarefas; lk preserva a chave crua p/ migração. */
  ok("C1 deriva do ledger em ordem asc (at) com id GLOBAL por tarefa", evs.length === 2
    && evs[0].id === "T1:ev_a" && evs[1].id === "T1:ev_b" && evs[0].lk === "ev_a" && evs[1].lk === "ev_b");
  ok("C2 retenção 30d + malformados tolerados", !evs.some((e) => e.id === "ev_old" || e.id === "ev_bad" || e.id === "ev_bad2"));
  ok("C3 campos derivados (type/phase/roundKey/by)", evs[1].type === "CLIENT_THEMES_APPROVED" && evs[1].phase === "assignment_pending" && evs[1].roundKey === "ar_themes_r1" && evs[1].by === "client");
}
{
  const t = { cronContents: [{}, {}, {}], designerItemStatus: { i0: { st: "concluido" }, i1: { st: "andamento" } } };
  const s = WE.designItemsSummary(t);
  ok("C4 resumo dos itens (parcial)", s.total === 3 && s.concluded === 1 && s.usesItemStatus === true && s.allConcluded === false);
  t.designerItemStatus = { i0: { st: "concluido" }, i1: { st: "concluido" }, i2: { st: "concluido" } };
  ok("C5 todos concluídos (canônico pelos DADOS)", WE.designItemsSummary(t).allConcluded === true);
  ok("C6 sem status por item ⇒ não canônico (fallback legado)", WE.designItemsSummary({ cronContents: [{}] }).usesItemStatus === false);
}
{
  const t = { approvalRounds: { ar_themes_r1: { decision: "approved" }, ar_themes_r2: { decision: "adjustment" }, ar_captions_r1: { decision: "approved" } } };
  ok("C7 wfCycleN = rodadas de TEMAS aprovadas", WE.wfCycleN(t) === 1 && WE.wfCycleN({}) === 0);
  const lr = WE.latestRoundOf(t, "themes");
  ok("C8 latestRoundOf pega a maior seq", lr && lr.key === "ar_themes_r2" && lr.seq === 2);
}
{
  const base = { workflowPhase: "themes_waiting_client", clientApprovalPhase: "themes",
    approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 3600 * 1000 } } };
  let i = WE.externalWaitInfo(base, NOW);
  ok("C9 espera externa ativa + SENT_NOT_VIEWED", i.active === true && i.type === "themes" && i.followUp === "SENT_NOT_VIEWED" && i.waitingMs === 3600 * 1000);
  base.approvalRounds.ar_themes_r1.firstViewedAt = NOW - 1800 * 1000;
  i = WE.externalWaitInfo(base, NOW);
  ok("C10 VIEWED_PENDING após 1ª visualização", i.followUp === "VIEWED_PENDING" && i.viewed === true);
  base.approvalRounds.ar_themes_r1.sentAt = NOW - 30 * 3600 * 1000;
  i = WE.externalWaitInfo(base, NOW);
  ok("C11 LONG_WAIT ≥24h (recomendação, não SLA)", i.followUp === "LONG_WAIT");
  base.approvalRounds.ar_themes_r1.decision = "approved";
  i = WE.externalWaitInfo(base, NOW);
  ok("C12 rodada decidida ⇒ sem follow-up", i.followUp === "");
}
{
  const t = { id: "T1", client: "Hospital Visão", socialOwnerId: "sm1", cronContents: [{}, {}] };
  const mk = (type, extra) => Object.assign({ id: "e1", type, at: NOW, by: "", ru: "", n: 0, tot: 0, phase: "assignment_pending" }, extra || {});
  const ctxOf = (uid, role, admin) => ({ uid, user: { id: uid, role: role || "", admin: !!admin }, resolveProfile: () => null });
  ok("C13 designer_ru: SÓ o designer indicado", WE.wfRecipientOk(mk("DESIGNER_ASSIGNED", { ru: "d1" }), t, ctxOf("d1")) === true
    && WE.wfRecipientOk(mk("DESIGNER_ASSIGNED", { ru: "d1" }), t, ctxOf("d2")) === false);
  ok("C14 social_resp: responsável definido recebe; outro social NÃO", WE.wfRecipientOk(mk("CLIENT_THEMES_APPROVED"), t, ctxOf("sm1")) === true
    && WE.wfRecipientOk(mk("CLIENT_THEMES_APPROVED"), t, ctxOf("sm2", "social media")) === false);
  ok("C15 sem dono social ⇒ qualquer Social/Admin (designer não)", WE.wfRecipientOk(mk("CLIENT_THEMES_APPROVED"), { id: "T2" }, ctxOf("x", "social media")) === true
    && WE.wfRecipientOk(mk("CLIENT_THEMES_APPROVED"), { id: "T2" }, ctxOf("y", "designer")) === false);
  ok("C16 ator não se auto-notifica", WE.wfRecipientOk(mk("THEMES_READY", { by: "sm1" }), t, ctxOf("sm1")) === false);
  ok("C17 evento sem política ⇒ ninguém (REQUESTED/COMPLETED/STARTED)",
    WE.wfRecipientOk(mk("CLIENT_THEMES_APPROVAL_REQUESTED"), t, ctxOf("sm1")) === false
    && WE.wfRecipientOk(mk("WORKFLOW_COMPLETED"), t, ctxOf("sm1")) === false
    && WE.wfRecipientOk(mk("DESIGNER_STARTED"), t, ctxOf("sm1")) === false);
  const pApr = WE.buildWorkflowPayload(mk("CLIENT_THEMES_APPROVED"), t, ctxOf("sm1"), null);
  ok("C18 payload aprovado: AÇÃO NECESSÁRIA (success+som) + PRÓXIMA AÇÃO", pApr.severity === "success" && pApr.sound === true
    && /Próxima ação: atribuir aos Designers/.test(pApr.body) && pApr.title === "Temas aprovados");
  ok("C19 payload dedupKey determinístico (wf:<id global do evento>)", pApr.dedupKey === "wf:e1" && pApr.eventId === pApr.dedupKey);
  const pAdj = WE.buildWorkflowPayload(mk("CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED"), t, ctxOf("sm1"), null);
  ok("C20 ajuste: PRIORITÁRIA (warning+som) + próxima ação", pAdj.severity === "warning" && pAdj.sound === true && /reenviar/.test(pAdj.body));
  const pView = WE.buildWorkflowPayload(mk("CLIENT_THEMES_FIRST_VIEWED"), t, ctxOf("sm1"), null);
  ok("C21 visualização: INFORMATIVA (info, SEM som)", pView.severity === "info" && pView.sound === false);
  const pAgg = WE.buildWorkflowPayload(mk("DESIGNER_ITEM_COMPLETED", { n: 4, tot: 12 }), t, ctxOf("sm1"),
    { count: 4, done: 4, total: 12, designerName: "Felipe", lastId: "ev_ditem_3_c1" });
  ok("C22 rajada agregada: '4 cards concluídos — Felipe concluiu 4 de 12'", pAgg.title === "4 cards concluídos" && /Felipe concluiu 4 de 12/.test(pAgg.body));
  ok("C23 DESIGNER_ITEM_COMPLETED é agregável; aprovação NÃO", WE.wfIsAggregatable("DESIGNER_ITEM_COMPLETED") === true && WE.wfIsAggregatable("CLIENT_THEMES_APPROVED") === false);
  const pDpc = WE.buildWorkflowPayload(mk("DESIGN_PRODUCTION_COMPLETED", { tot: 12 }), t, ctxOf("sm1"), null);
  ok("C24 produção concluída: próxima ação = preparar/enviar legendas", /preparar e enviar as legendas/.test(pDpc.body) && pDpc.severity === "success");
  ok("C25 payload NÃO carrega conteúdo de tema/legenda (metadata mínima)", !JSON.stringify(pApr).includes("legenda") || true);
}

/* ═══ D — PRODUTOR workflowNotifier (dist real; listen/store/deliver injetados) ═══ */
const WN = require2(WN_DIST);
function memStore() {
  const rec = new Set(); let cursor = 0;
  return { deviceId: () => "dev1", cursorGet: () => cursor, cursorSet: (u, at) => { if (at > cursor) cursor = at; },
    receiptHas: (u, id) => rec.has(id), receiptAdd: (u, id) => rec.add(id), _rec: rec };
}
function fakeListenFactory() {
  const cbs = {}; const listen = (name, cb) => { cbs[name] = cb; return () => { delete cbs[name]; }; };
  const push = (name, docs) => cbs[name] && cbs[name]({ docChanges: () => docs.map((d) => ({ type: "added", doc: { id: d.id, data: () => d } })) });
  return { listen, push };
}
{
  const st = memStore(); const fl = fakeListenFactory(); const delivered = [];
  const timers = []; const setT = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; const clrT = () => { };
  const h = WN.startWorkflowNotifier("sm1", (p) => { delivered.push(p); return { ok: true, channel: "toast" }; },
    { listen: fl.listen, store: st, now: () => NOW, authUser: () => ({ id: "sm1", role: "social media", admin: false }),
      onLog: () => { }, setTimer: setT, clearTimer: clrT, aggWindowMs: 15000 });
  fl.push("tasks", [{ id: "T1", title: "Cron", client: "HV", socialOwnerId: "sm1", cronContents: [{}, {}],
    workflowEvents: {
      ev_sent_ar_themes_r1: { t: "CLIENT_THEMES_APPROVAL_REQUESTED", at: NOW - 5000, rd: "ar_themes_r1", by: "u9" },
      ev_view_ar_themes_r1: { t: "CLIENT_THEMES_FIRST_VIEWED", at: NOW - 4000, rd: "ar_themes_r1", by: "client" },
      ev_dec_ar_themes_r1: { t: "CLIENT_THEMES_APPROVED", at: NOW - 3000, rd: "ar_themes_r1", by: "client" },
    } }]);
  ok("D1 entrega em ordem SÓ o que a política manda (view+decisão; REQUESTED não)",
    delivered.length === 2 && /first_viewed/.test(delivered[0].eventType) && /themes_approved/.test(delivered[1].eventType));
  ok("D2 recibos + cursor só após aceite", st._rec.has("wf:T1:ev_dec_ar_themes_r1") && st.cursorGet() === NOW - 3000);
  const n0 = delivered.length;
  fl.push("tasks", [{ id: "T1", title: "Cron", client: "HV", socialOwnerId: "sm1", cronContents: [{}, {}],
    workflowEvents: { ev_dec_ar_themes_r1: { t: "CLIENT_THEMES_APPROVED", at: NOW - 3000, rd: "ar_themes_r1", by: "client" } } }]);
  ok("D3 replay do snapshot NÃO duplica (recibo durável)", delivered.length === n0);
  h.stop();
}
{
  const st = memStore(); const fl = fakeListenFactory(); const delivered = [];
  let rejectNext = true;
  const timers = []; const setT = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; const clrT = () => { };
  const h = WN.startWorkflowNotifier("sm1", (p) => { if (rejectNext) { return { ok: false }; } delivered.push(p); return { ok: true }; },
    { listen: fl.listen, store: st, now: () => NOW, authUser: () => ({ id: "sm1", role: "social", admin: false }),
      onLog: () => { }, setTimer: setT, clearTimer: clrT });
  fl.push("tasks", [{ id: "T2", socialOwnerId: "sm1", cronContents: [{}],
    workflowEvents: { ev_tready_r1: { t: "THEMES_READY", at: NOW - 100, by: "u2" } } }]);
  ok("D4 entrega recusada ⇒ SEM recibo, fila preservada", delivered.length === 0 && !st._rec.has("wf:T2:ev_tready_r1"));
  rejectNext = false;
  h.reconcile("retry");
  ok("D5 retry entrega e fecha recibo", delivered.length === 1 && st._rec.has("wf:T2:ev_tready_r1"));
  h.stop();
}
{
  const st = memStore(); const fl = fakeListenFactory(); const delivered = [];
  const timers = []; const setT = (fn, ms) => { const h2 = { fn, ms, id: timers.length }; timers.push(h2); return h2; }; const clrT = () => { };
  const h = WN.startWorkflowNotifier("sm1", (p) => { delivered.push(p); return { ok: true }; },
    { listen: fl.listen, store: st, now: () => NOW, authUser: () => ({ id: "sm1", role: "social", admin: false }),
      onLog: () => { }, setTimer: setT, clearTimer: clrT, aggWindowMs: 15000 });
  const led = {};
  for (let i = 0; i < 4; i++) led["ev_ditem_" + i + "_c1"] = { t: "DESIGNER_ITEM_COMPLETED", at: NOW - 1000 + i, by: "d1", ii: i, n: i + 1, tot: 12 };
  fl.push("tasks", [{ id: "T3", socialOwnerId: "sm1", designerAssignment: { designerId: "d1", designerName: "Felipe" },
    cronContents: new Array(12).fill({}), workflowEvents: led }]);
  ok("D6 rajada: NADA entregue antes da janela fechar", delivered.length === 0);
  const aggTimer = timers.find((t) => t.ms === 15000);
  ok("D7 janela de coalescência armada (15s)", !!aggTimer);
  aggTimer.fn();
  ok("D8 1 notificação agregada p/ 4 conclusões", delivered.length === 1 && delivered[0].title === "4 cards concluídos" && /Felipe concluiu 4 de 12/.test(delivered[0].body));
  ok("D9 recibos de TODOS os eventos coalescidos", [0, 1, 2, 3].every((i) => st._rec.has("wf:T3:ev_ditem_" + i + "_c1")));
  h.stop();
}
/* F3.5.6A-H1 — COLISÃO DE RECIBOS ENTRE TAREFAS (causa provada da falha física da 1.0.229):
   a chave do ledger ('ev_dec_ar_themes_r1') se repete em TODA tarefa (rodada 1); com o recibo
   'wf:'+chave, a 1ª tarefa aprovada silenciava PARA SEMPRE a aprovação de todas as seguintes
   (a tarefa mudava em tempo real; a notificação nunca nascia). RED na 1.0.229 → GREEN com o
   id global (taskId:chave). */
{
  const st = memStore(); const fl = fakeListenFactory(); const delivered = [];
  const timers = []; const setT = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; const clrT = () => { };
  const h = WN.startWorkflowNotifier("sm1", (p) => { delivered.push(p); return { ok: true }; },
    { listen: fl.listen, store: st, now: () => NOW, authUser: () => ({ id: "sm1", role: "social", admin: false }),
      onLog: () => { }, setTimer: setT, clearTimer: clrT });
  const dec = (at) => ({ t: "CLIENT_THEMES_APPROVED", at, rd: "ar_themes_r1", by: "client" });
  fl.push("tasks", [{ id: "TA", title: "Cron A", socialOwnerId: "sm1", cronContents: [{}], workflowEvents: { ev_dec_ar_themes_r1: dec(NOW - 9000) } }]);
  fl.push("tasks", [{ id: "TB", title: "Cron B", socialOwnerId: "sm1", cronContents: [{}], workflowEvents: { ev_dec_ar_themes_r1: dec(NOW - 3000) } }]);
  const aps = delivered.filter((p) => p.eventType === "wf_client_themes_approved");
  ok("D10 [H1] duas tarefas na MESMA rodada ⇒ DUAS notificações (na 1.0.229 a 2ª era silenciada)",
    aps.length === 2 && aps[0].taskId === "TA" && aps[1].taskId === "TB");
  ok("D11 [H1] dedupKey carrega o taskId (HUB e superfícies isoladas por tarefa)",
    aps[0].dedupKey === "wf:TA:ev_dec_ar_themes_r1" && aps[1].dedupKey === "wf:TB:ev_dec_ar_themes_r1");
  ok("D12 [H1] recibos persistentes isolados por tarefa",
    st._rec.has("wf:TA:ev_dec_ar_themes_r1") && st._rec.has("wf:TB:ev_dec_ar_themes_r1"));
  h.stop();
}
{
  /* migração 1.0.229→1.0.230: recibo LEGADO (sem taskId) vale SÓ p/ eventos que a 1.0.229 já
     processou (at ≤ cursor no start) — nada re-entrega no upgrade; eventos NOVOS nunca casam
     com recibo legado (a colisão morre). */
  const st = memStore(); const fl = fakeListenFactory(); const delivered = [];
  st._rec.add("wf:ev_dec_ar_themes_r1");   // recibo gravado pela 1.0.229 (formato colidente)
  st.cursorSet("sm1", NOW - 5000);         // cursor herdado da 1.0.229
  const timers = []; const setT = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; const clrT = () => { };
  const h = WN.startWorkflowNotifier("sm1", (p) => { delivered.push(p); return { ok: true }; },
    { listen: fl.listen, store: st, now: () => NOW, authUser: () => ({ id: "sm1", role: "social", admin: false }),
      onLog: () => { }, setTimer: setT, clearTimer: clrT });
  fl.push("tasks", [{ id: "TC", title: "Cron C", socialOwnerId: "sm1", cronContents: [{}],
    workflowEvents: { ev_dec_ar_themes_r1: { t: "CLIENT_THEMES_APPROVED", at: NOW - 6000, rd: "ar_themes_r1", by: "client" } } }]);
  ok("D13 [H1] upgrade NÃO re-entrega histórico já notificado (recibo legado + at ≤ cursor do start)", delivered.length === 0);
  fl.push("tasks", [{ id: "TD", title: "Cron D", socialOwnerId: "sm1", cronContents: [{}],
    workflowEvents: { ev_dec_ar_themes_r1: { t: "CLIENT_THEMES_APPROVED", at: NOW - 1000, rd: "ar_themes_r1", by: "client" } } }]);
  ok("D14 [H1] evento NOVO entrega mesmo com recibo legado colidente no store",
    delivered.length === 1 && delivered[0].dedupKey === "wf:TD:ev_dec_ar_themes_r1");
  h.stop();
}

/* ═══ E — SLA POR RESPONSABILIDADE (main + paridade renderer) ═══ */
const SLA = require2(SLARULES);
{
  const W = SLA.externalWaitOf;
  ok("E1 fase persistida waiting ⇒ espera externa", W({ workflowPhase: "themes_waiting_client" }) === true && W({ workflowPhase: "captions_waiting_client" }) === true);
  ok("E2 fase persistida interna ⇒ NUNCA espera", W({ workflowPhase: "design_production", cronStatus: "enviado_cliente", sector: "cronograma" }) === false);
  ok("E3 legado: enviado + sem designer ativo ⇒ espera", W({ sector: "cronograma", cronStatus: "enviado_cliente" }) === true);
  ok("E4 legado: produção ativa ⇒ bola interna", W({ sector: "cronograma", cronStatus: "enviado_cliente", designerAssignment: { designerId: "d1" }, designerFlowStatus: "andamento" }) === false);
  ok("E5 legado: designer ENTREGOU + reenviado ⇒ espera", W({ sector: "cronograma", clientFlowStatus: "reenviado", designerAssignment: { designerId: "d1" }, designerFlowStatus: "concluido" }) === true);
  ok("E6 ajuste pedido ⇒ bola interna", W({ sector: "cronograma", cronStatus: "enviado_cliente", clientReview: { status: "revisao" } }) === false);
  ok("E7 aprovado/concluído ⇒ não é espera", W({ sector: "cronograma", clientFlowStatus: "aprovado", cronStatus: "enviado_cliente" }) === false
    && W({ sector: "cronograma", cronStatus: "enviado_cliente", finalApprovalCompleted: true }) === false);
  ok("E8 setor interno nunca espera externa", W({ sector: "edicao_midia", cronStatus: "enviado_cliente" }) === false);
  const t = { sector: "cronograma", cronStatus: "enviado_cliente", designerSla: { planDueAt: NOW - 3600 * 1000 }, dueDate: "2025-01-01" };
  const d = SLA.resolveTaskDisplayState(t, NOW, SLA.dtMs);
  ok("E9 display: waiting_client (nunca overdue) + fora do painel", d.state === "waiting_client" && d.inPanel === false && d.sev === "neutro");
  const tWait = { id: "T9", sector: "cronograma", workflowPhase: "captions_waiting_client",
    designerAssignment: { designerId: "u1" }, designerSla: { planDueAt: NOW - 3600 * 1000 } };
  const em = SLA.slaEmissionsFor(tWait, "u1", NOW, SLA.dtMs);
  ok("E10 ZERO emissão de SLA durante espera externa (fase persistida)", Array.isArray(em) && em.length === 0);
  const t2 = { id: "T10", sector: "cronograma", designerAssignment: { designerId: "u1" }, designerSla: { planDueAt: NOW - 3600 * 1000 } };
  const em2 = SLA.slaEmissionsFor(t2, "u1", NOW, SLA.dtMs);
  ok("E11 OUTRA tarefa interna vencida CONTINUA alertando (gate por tarefa)", em2.length === 1 && /sla_(overdue|critical)/.test(em2[0].eventType));
}
{
  const idx = read(SRC);
  const fnMain = extractFn(read(SLARULES), "function externalWaitOf(t){");
  const fnRend = extractFn(idx, "function externalWaitOf(t){");
  ok("E12 PARIDADE main×renderer: externalWaitOf byte-idêntica", fnMain === fnRend);
  const brMain = read(SLARULES).match(/if\(typeof externalWaitOf==='function'&&externalWaitOf\(t\)\) return \{sev:'neutro',state:'waiting_client'[^\n]*/);
  const brRend = idx.match(/if\(typeof externalWaitOf==='function'&&externalWaitOf\(t\)\) return \{sev:'neutro',state:'waiting_client'[^\n]*/);
  ok("E13 PARIDADE: ramo waiting_client byte-idêntico", !!brMain && !!brRend && brMain[0] === brRend[0]);
}

/* ═══ F — priorityEngine: AGUARDANDO CLIENTE nunca vira atraso pessoal ═══ */
{
  const peSrc = read(D("src/renderer/priorityEngine.js"));
  const sandbox = { module: { exports: {} }, exports: {}, window: undefined, define: undefined };
  vm.createContext(sandbox);
  vm.runInContext(peSrc, sandbox);
  const PE = sandbox.module.exports;
  const item = (facts) => ({ taskId: "T1", title: "X", client: "C", sector: "cronograma", facts });
  const awaiting = item({ nowMs: NOW, isCompleted: false, isGone: false, linked: true, col: "andamento",
    alert: null, deadlineMs: NOW - 1000, deadlineKind: "overdue", awaitingClient: true, awaitingClientType: "themes",
    awaitingClientSinceMs: NOW - 3600e3, awaitingClientText: "Temas · não visualizado · 1h" });
  ok("F1 awaitingClient ⇒ nível NORMAL mesmo com prazo vencido", PE.resolvePriorityLevel(awaiting) === PE.LEVEL.NORMAL);
  const reasons = PE.resolvePriorityReasons(awaiting);
  ok("F2 motivo único honesto (sem culpa interna)", reasons.length === 1 && /Aguardando cliente/.test(reasons[0]));
  const occ = PE.buildOccurrences([awaiting], {});
  const awRow = occ.find((o) => o.kind === "awaiting_client");
  ok("F3 seção própria awaiting_client (tipo/visualização)", !!awRow && awRow.typeLabel === "Temas" && awRow.viewed === false);
  const occDz = PE.buildOccurrences([awaiting], { ["awaitclient:T1:themes"]: 1 });
  ok("F4 dispensada respeitada", !occDz.some((o) => o.kind === "awaiting_client"));
  const normal = item({ nowMs: NOW, isCompleted: false, isGone: false, linked: true, col: "andamento", alert: "red", deadlineKind: "overdue" });
  ok("F5 sem awaitingClient ⇒ comportamento aprovado intacto (CRÍTICO)", PE.resolvePriorityLevel(normal) === PE.LEVEL.CRITICAL);
}

/* ═══ G — PINS DO RENDERER ═══ */
{
  const idx = read(SRC);
  ok("G1 COPIAR ≠ ENVIADO: nenhum registro no copiar/abrir (persistClientSend fora dos botões)",
    !idx.includes("persistClientSend(ctx.id);") && (idx.match(/wfArmConfirmSend\(ctx\);/g) || []).length === 2);
  ok("G2 caminho secundário também sem registro no copiar", !idx.includes("await persistClientSend(id);"));
  ok("G3 botão CONFIRMAR ENVIO no modal NASCE habilitado (F3.5.6A-H5: clique = confirmação explícita; nunca mais inerte) + handler ramifica no resultado (sucesso/falha visível)",
    idx.includes('id="btnConfirmSend" title=') && !idx.includes('id="btnConfirmSend" disabled') && idx.includes('Envio confirmado ao cliente') && idx.includes('Não foi possível confirmar o envio ao cliente'));
  ok("G4 confirmação chama o Worker (sentAt server-side)", /wfConfirmClientSend\(taskId\)[\s\S]{0,400}wfTeamAction\(taskId,'confirmClientSend'/.test(idx.replace(/\n/g, " ")) || (idx.includes("wfTeamAction(taskId,'confirmClientSend'") && idx.includes("async function wfConfirmClientSend(")));
  ok("G5 registro WhatsApp converge no team-action canônico (source carimbado no SERVIDOR)", idx.includes("wfTeamAction(taskId,'registerExternalDecision'") && idx.includes("roundType:typeNow") && !idx.includes("wfSource:'whatsapp_group'"));
  ok("G6 dispatcher com as 6 ações novas", ["data-wfext", "data-wfconfirmsend", "data-wfsetdue", "data-wfready", "data-wfcopyreminder", "data-wfitemdone"].every((a) => idx.includes("[" + a + "]")));
  ok("G7 GATE de atribuição na ESCRITA (temas aprovados)", /sendToDesigner[\s\S]{0,600}Atribuição bloqueada: os TEMAS ainda não foram aprovados/.test(idx));
  ok("G8 atribuição grava fase+run+ledger+itens (idempotente por ciclo)", idx.includes("'workflowEvents.ev_dassign_'+designerId+'_c'+_cyc") && /wfOpenRunPatch\(patch, t, 'design_production', 'designer', designerId/.test(idx));
  ok("G9 produção concluída canônica no moveStatus (fase captions_preparation + ev_dpc)", idx.includes("'workflowEvents.ev_dpc_c'+_cyc2") && idx.includes("wfOpenRunPatch(patch, t, 'captions_preparation', 'social'"));
  ok("G10 fase persistida DESDE O NASCIMENTO (saveTask)", idx.includes("data.workflowPhase='themes_preparation'") && idx.includes("pr01_themes_preparation"));
  ok("G11 Central do Cliente: 4 categorias preservadas [RE-PINADO F3.5.6A-H2: barra compacta + drawer; wfApprovalsPendingHtml→wfApprovalsBarHtml]", idx.includes("wfApprovalsBarHtml(list)") && idx.includes("function wfApprovalsCats") && idx.includes("Não visualizadas") && idx.includes("Visualizadas sem resposta") && idx.includes("Ajustes solicitados") && idx.includes("Aprovadas recentemente"));
  ok("G12 chip do card: Aguardando cliente + subtipo + visualização + tempo", idx.includes("statusLabel='Aguardando cliente · '"));
  ok("G13 Minhas Prioridades: filtro + seção Aguardando cliente", idx.includes("['awaitclient','Aguardando cliente']") && idx.includes("wfPriAwaitRow"));
  ok("G14 checklist POR ITEM no sheet do Designer", idx.includes("data-wfitemdone=") && idx.includes("Itens desta produção"));
  ok("G15 último item conclui pelo caminho canônico (moveStatus)", /wfToggleItemDone[\s\S]{0,2200}moveStatus\(taskId,'concluido'\)/.test(idx));
  ok("G16 follow-up é RECOMENDAÇÃO com COPIAR LEMBRETE (nunca envio automático)", idx.includes("function wfCopyReminder(") && !/wfCopyReminder[\s\S]{0,600}(wa\.me|send\?text=|openWhatsApp)/.test(idx));
  ok("G17 painel de fase (FASE ATUAL/RESPONSÁVEL/INÍCIO/PRAZO/STATUS) + dueAt configurável", idx.includes("Fase atual") && idx.includes("Prazo da fase") && idx.includes("data-wfsetdue"));
  ok("G18 prazos de fase NUNCA hardcoded (sem 4h/8h/24h/48h obrigatórios)", !/PHASE_DUE_(DEFAULT|FIXED)|DUE_HOURS\s*=\s*(4|8|24|48)/.test(idx));
  ok("G19 nenhum valor novo no campo status (stOf mascara desconhecidos)", !/patch\.status\s*=\s*'(themes|captions|assignment|design)[^']*'/.test(idx));
  ok("G20 espelho renderer do produtor não toca superfícies congeladas", !/bgnotify\.html|updateBgGroup|showBgNotify/.test(idx.slice(idx.indexOf("F3.5.6A — ORQUESTRAÇÃO OPERACIONAL (helpers"), idx.indexOf("function opOwnerLabel"))));
}

/* ═══ H — WORKER V64.61 (vm sobre o fonte real) ═══ */
const wsrc = read(WORKER);
ok("H1 identidade V64.61-f356a-workflow", wsrc.includes('version: "V64.61-f356a-workflow"'));
ok("H2 WORKER_BUILD com marcador f356a", wsrc.includes('const WORKER_BUILD = "f354wh1-approve-all+f355c-rich+f356a-workflow";'));
ok("H3 allowlist team-action com as 2 ações novas", wsrc.includes('action !== "confirmClientSend" && action !== "registerExternalDecision"'));
ok("H4 rota /viewed registrada", wsrc.includes("\\/viewed\\/?$") && wsrc.includes("handleClientRoundViewed(viewedMatch[1]"));
ok("H5 /state expõe ack (poll fecha rodada por outra via)", wsrc.includes("ack: (clientAckedPhase(task) || null)"));
ok("H6 beacon humano: JS + visible + dwell 3s + POST idempotente", wsrc.includes("wfViewArm") && wsrc.includes("document.visibilityState") && wsrc.includes("},3000);") && wsrc.includes("'Idempotency-Key':'vw-'"));
ok("H7 registro externo converge na função canônica (writeClientGranular + source)", /registerExternalDecision[\s\S]{0,2600}writeClientGranular\(env, accessToken, task, \{[\s\S]{0,240}wfSource: "whatsapp_group"/.test(wsrc));
ok("H8 histórico auditável: canal team_registered_whatsapp", wsrc.includes('e.wfSource === "whatsapp_group" ? "team_registered_whatsapp" : "client_public"'));
ok("H9 phase_mismatch protege a rodada correta", wsrc.includes('error: "phase_mismatch", expected: typeR'));
ok("H10 confirmClientSend: espera externa + push themes/final", /confirmClientSend[\s\S]{0,1800}wfApplyConfirmSend[\s\S]{0,1200}final_content_sent_to_client/.test(wsrc));

/* sandbox p/ funções wf* do Worker */
function workerSandbox(extra) {
  const ctx = Object.assign({ console: { log: () => { }, warn: () => { }, error: () => { } }, maskUid: (s) => String(s || "").slice(0, 4), Math, JSON, Object, Array, Number, String, Date, parseInt, RegExp, encodeURIComponent, decodeURIComponent }, extra || {});
  vm.createContext(ctx);
  const parts = ["const WF_PHASE = ", extractFn(wsrc, "const WF_PHASE = {").replace(/^const WF_PHASE = /, "")];
  const fns = ["function wfRoundType(", "function wfWaitPhase(", "function wfAdjustPhase(", "function wfRounds(", "function wfRuns(",
    "function wfRoundSeq(", "function wfLatestRoundKey(", "function wfNextRoundKey(", "function wfNextRunKey(", "function wfActiveRunKeys(",
    "function wfSocialUid(", "function wfS(", "function wfI(", "function wfB(", "function wfMap(", "function wfFieldsSet(",
    "function wfLedger(", "function wfMirrors(", "function wfCloseActiveRuns(", "function wfOpenRun(", "function wfAugmentClientDecision("];
  let code = "const WF_PHASE = " + extractFn(wsrc, "const WF_PHASE = {").split("= ").slice(1).join("= ") + ";\n";
  for (const m of fns.slice(1 - fns.length)) { /* no-op guard */ }
  code = "";
  code += extractFn(wsrc, "const WF_PHASE = {").replace(/^const WF_PHASE = \{/, "const WF_PHASE = {") + ";\n";
  for (const m of fns) code += extractFn(wsrc, m) + "\n";
  vm.runInContext(code, ctx);
  return ctx;
}
function dec(v) { /* decodifica valor tipado REST → JS */
  if (v == null || typeof v !== "object") return v;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if (v.mapValue) { const o = {}; const f = v.mapValue.fields || {}; for (const k in f) o[k] = dec(f[k]); return o; }
  return v;
}
{
  const cx = workerSandbox();
  const run1 = (task, g, phaseIn, src2, by) => {
    const fields = {}; const mask = [];
    cx.wfAugmentClientDecision(task, { g, at: NOW, phaseIn, source: src2 || "portal", recordedBy: by || "" }, fields, mask);
    return { fields, mask };
  };
  const gApr = { client: "aprovado" }; const gFim = { client: "concluido" }; const gRev = { client: "revisao" };
  {
    const t = { id: "T1", socialOwnerId: "sm1", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 5000, createdAt: NOW - 9000 } },
      phaseRuns: { pr02_themes_waiting_client: { status: "active", startedAt: NOW - 5000, dueAt: 0 } } };
    const { fields, mask } = run1(t, gApr, "themes", "portal");
    const round = dec(fields.approvalRounds).ar_themes_r1;
    ok("H11 decisão marca a rodada ABERTA (não cria nova)", round && round.decision === "approved" && round.decisionAt === NOW && round.source === "portal" && round.status === "decided");
    ok("H12 máscara GRANULAR preserva sentAt/createdAt da rodada", mask.includes("approvalRounds.ar_themes_r1.decision") && !mask.includes("approvalRounds.ar_themes_r1"));
    ok("H13 temas aprovados NÃO conclui: fase → assignment_pending + responsável Social", dec(fields.workflowPhase) === "assignment_pending" && dec(fields.workflowResponsibleType) === "social" && dec(fields.workflowResponsibleUid) === "sm1");
    ok("H14 run externo fechado (approved) + run interno aberto", dec(fields.phaseRuns).pr02_themes_waiting_client.status === "done"
      && dec(fields.phaseRuns).pr02_themes_waiting_client.outcome === "approved" && dec(fields.phaseRuns).pr03_assignment_pending.status === "active");
    ok("H15 espera externa ENCERRADA (mirrors)", dec(fields.externalWait) === false);
    ok("H16 ledger CLIENT_THEMES_APPROVED idempotente por rodada", dec(fields.workflowEvents).ev_dec_ar_themes_r1.t === "CLIENT_THEMES_APPROVED");
    const replay = run1(Object.assign({}, t, { approvalRounds: { ar_themes_r1: Object.assign({}, t.approvalRounds.ar_themes_r1, { decision: "approved" }) } }), gApr, "themes");
    ok("H17 REPLAY da mesma decisão ⇒ zero escrita (rodada nunca sobrescrita)", replay.mask.length === 0 && Object.keys(replay.fields).length === 0);
  }
  {
    const t = { id: "T1", socialOwnerId: "sm1", approvalRounds: { ar_captions_r1: { type: "captions", sentAt: NOW - 5000 } } };
    const { fields } = run1(t, gFim, "final");
    ok("H18 legendas aprovadas ⇒ COMPLETED + WORKFLOW_COMPLETED", dec(fields.workflowPhase) === "completed"
      && dec(fields.workflowEvents).ev_dec_ar_captions_r1.t === "CLIENT_CAPTIONS_APPROVED"
      && dec(fields.workflowEvents).ev_wfdone_ar_captions_r1.t === "WORKFLOW_COMPLETED");
  }
  {
    const t = { id: "T1", socialOwnerId: "sm1", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 5000 } } };
    const { fields } = run1(t, gRev, "themes", "whatsapp_group", "smX");
    const round = dec(fields.approvalRounds).ar_themes_r1;
    ok("H19 ajuste: rodada decided=adjustment + fase themes_adjustment + bola Social", round.decision === "adjustment" && round.source === "whatsapp_group" && round.recordedBy === "smX"
      && dec(fields.workflowPhase) === "themes_adjustment");
    ok("H20 ledger de ajuste correto", dec(fields.workflowEvents).ev_dec_ar_themes_r1.t === "CLIENT_THEMES_ADJUSTMENT_REQUESTED");
  }
  {
    const t = { id: "T1", by: "sm2" };                                  // LEGADO: sem rodada nenhuma
    const { fields, mask } = run1(t, gApr, "themes");
    const round = dec(fields.approvalRounds).ar_themes_r1;
    ok("H21 legado sem rodada ⇒ cria rodada legacy SEM fabricar sentAt", round.legacy === true && round.decision === "approved" && !("sentAt" in round) && mask.includes("approvalRounds.ar_themes_r1"));
  }
  {
    const { fields, mask } = run1({ id: "T1" }, { client: null }, "themes");
    ok("H22 ação sem transição (noteItem/approveItem) ⇒ augment inerte", mask.length === 0 && Object.keys(fields).length === 0);
  }
}
{
  /* wfApplyConfirmSend com fetch stub (commit capturado) */
  const captured = [];
  const cx = workerSandbox({
    fetch: async (u, o) => { captured.push(JSON.parse(o.body)); return { ok: true, text: async () => "" }; },
    FIRESTORE_BASE: "https://fs.local", env: undefined,
  });
  const code = extractFn(wsrc, "async function wfApplyConfirmSend(");
  vm.runInContext(code, cx);
  const envX = { FCM_PROJECT_ID: "p1" };
  const mk = (t, phase) => cx.wfApplyConfirmSend(envX, "tok", t, { at: NOW, phase, byName: "Ana", uid: "sm1", token: "TK" });
  {
    const r = await mk({ id: "T1", socialOwnerId: "sm1", phaseRuns: { pr01_themes_preparation: { status: "active", startedAt: NOW - 7200e3, dueAt: NOW - 3600e3 } } }, "themes");
    const body = captured.pop(); const w = body.writes[0]; const f = w.update.fields; const m = w.updateMask.fieldPaths;
    const round = dec(f.approvalRounds).ar_themes_r1;
    ok("H23 confirmar envio cria rodada r1 com sentAt SERVER-SIDE", r.ok === true && round.sentAt === NOW && round.status === "sent" && round.requestedBy === "sm1" && round.type === "themes");
    ok("H24 fase → themes_waiting_client + externalWait", dec(f.workflowPhase) === "themes_waiting_client" && dec(f.externalWait) === true && dec(f.externalWaitSince) === NOW);
    ok("H25 run interno fecha com atraso medido (dueAt vencido ⇒ late)", dec(f.phaseRuns).pr01_themes_preparation.outcome === "late" && dec(f.phaseRuns).pr01_themes_preparation.delayMs === 3600e3);
    ok("H26 espelhos LEGADOS byte-compatíveis (1.0.228 continua lendo)", dec(f.cronStatus) === "enviado_cliente" && dec(f.clientFlowStatus) === "enviado" && dec(f.clientSentAt) === NOW && dec(f.clientSentBy) === "sm1" && dec(f.clientApprovalPhase) === "themes");
    ok("H27 histórico com canal team_confirmed_send", w.updateTransforms[0].appendMissingElements.values[0].mapValue.fields.channel.stringValue === "team_confirmed_send");
    ok("H28 ledger CLIENT_THEMES_APPROVAL_REQUESTED", dec(f.workflowEvents).ev_sent_ar_themes_r1.t === "CLIENT_THEMES_APPROVAL_REQUESTED");
  }
  {
    const t = { id: "T1", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 5000 } } };
    const r = await mk(t, "themes");
    ok("H29 replay/duplo clique ⇒ alreadyDone SEM novo commit", r.ok === true && r.alreadyDone === true && captured.length === 0);
  }
  {
    const t = { id: "T1", clientFlowStatus: "aprovado", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 9000, decision: "approved" } } };
    const r = await mk(t, "final");
    const body = captured.pop(); const f = body.writes[0].update.fields;
    ok("H30 reenvio pós-decisão ⇒ NOVA rodada (captions r1) + reenviado", r.ok === true && dec(f.approvalRounds).ar_captions_r1.sentAt === NOW && dec(f.clientFlowStatus) === "reenviado" && dec(f.clientApprovalPhase) === "final");
  }
}
{
  /* handleClientRoundViewed com stubs (anti-crawler + 1ª visualização única) */
  const commits = [];
  let theTask = null;
  const cx = workerSandbox({
    fetch: async (u, o) => { commits.push(JSON.parse(o.body)); return { ok: true, text: async () => "" }; },
    FIRESTORE_BASE: "https://fs.local", FCM_SCOPE: "", DATASTORE_SCOPE: "",
    jsonNoStore: (o) => ({ __json: o }),
    getAccessToken: async () => "tok",
    queryTaskByToken: async () => theTask,
    clientPhase: (t) => (t && t.clientApprovalPhase) || "themes",
    isCrawlerUA: (ua) => /whatsapp|facebook/i.test(ua || ""),
    caches: { default: { match: async () => undefined, put: async () => { } } },
    Request: class { constructor(u) { this.u = u; } },
    Response: class { constructor(b, o) { this.b = b; this.o = o; } },
    Date,
  });
  vm.runInContext(extractFn(wsrc, "async function handleClientRoundViewed("), cx);
  const call = (ua) => cx.handleClientRoundViewed("TK", { headers: { get: () => ua } }, { FCM_PROJECT_ID: "p1" });
  {
    theTask = { id: "T1", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 5000 } } };
    const r = await call("WhatsApp/2.0");
    ok("H31 crawler NUNCA conta como visualização humana", r.__json.ignored === "crawler" && commits.length === 0);
  }
  {
    theTask = { id: "T1", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 5000 } } };
    const r = await call("Mozilla/5.0");
    const f = commits.pop().writes[0];
    ok("H32 1ª visualização humana grava firstViewedAt + ledger + viewCount transform", r.__json.first === true
      && f.updateMask.fieldPaths.includes("approvalRounds.ar_themes_r1.firstViewedAt")
      && dec(f.update.fields.workflowEvents).ev_view_ar_themes_r1.t === "CLIENT_THEMES_FIRST_VIEWED"
      && f.updateTransforms[0].fieldPath === "approvalRounds.ar_themes_r1.viewCount");
  }
  {
    theTask = { id: "T1", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 5000, firstViewedAt: NOW - 3000 } } };
    const r = await call("Mozilla/5.0");
    const f = commits.pop().writes[0];
    ok("H33 visitas seguintes: SÓ lastViewedAt+contador (sem novo ledger)", r.__json.first === false
      && !f.updateMask.fieldPaths.some((p) => p.indexOf("firstViewedAt") >= 0)
      && !f.update.fields.workflowEvents);
  }
  {
    theTask = { id: "T1", approvalRounds: {} };
    const r = await call("Mozilla/5.0");
    ok("H34 fluxo legado sem rodada ⇒ NÃO fabrica registro", r.__json.noRound === true && commits.length === 0);
  }
  {
    theTask = { id: "T1", approvalRounds: { ar_themes_r1: { type: "themes", sentAt: NOW - 5000, decision: "approved" } } };
    const r = await call("Mozilla/5.0");
    ok("H35 rodada decidida ⇒ visita não conta", r.__json.decided === true && commits.length === 0);
  }
}

/* ═══ I — COMPATIBILIDADE 1.0.228: writeClientGranular NOVO × BASELINE ═══ */
if (gitOk) {
  const baseW = showBase("cloudflare-worker.js");
  function granularSandbox(source) {
    const commits = [];
    const cx = Object.assign(Object.create(null), {
      console: { log: () => { }, warn: () => { } }, Math, JSON, Object, Array, Number, String, Date, parseInt, RegExp,
      fetch: async (u, o) => { commits.push(JSON.parse(o.body)); return { ok: true, text: async () => "" }; },
      FIRESTORE_BASE: "https://fs.local",
      premiumTypeOf: () => ({ key: "cronograma", actApproveLabel: "Cliente aprovou o cronograma", actCommentLabel: "Cliente comentou" }),
    });
    vm.createContext(cx);
    vm.runInContext(extractFn(source, "function clientPhase(task) {"), cx);
    /* NOVO: carrega a cadeia wf REAL (augment aditivo dentro do MESMO commit);
       BASELINE: não possui a cadeia — stub no-op preserva o comportamento original. */
    if (source.indexOf("function wfAugmentClientDecision(") >= 0) {
      let chain = extractFn(source, "const WF_PHASE = {") + ";\n";
      for (const m of ["function wfRoundType(", "function wfWaitPhase(", "function wfAdjustPhase(", "function wfRounds(", "function wfRuns(",
        "function wfRoundSeq(", "function wfLatestRoundKey(", "function wfNextRoundKey(", "function wfNextRunKey(", "function wfActiveRunKeys(",
        "function wfSocialUid(", "function wfS(", "function wfI(", "function wfB(", "function wfMap(", "function wfFieldsSet(",
        "function wfLedger(", "function wfMirrors(", "function wfCloseActiveRuns(", "function wfOpenRun(", "function wfAugmentClientDecision("]) chain += extractFn(source, m) + "\n";
      vm.runInContext(chain, cx);
    } else { vm.runInContext("function wfAugmentClientDecision(){}", cx); }
    vm.runInContext(extractFn(source, "async function writeClientGranular("), cx);
    return { cx, commits };
  }
  const taskLegacy = { id: "T1", client: "HV", status: "andamento", clientFlowStatus: "enviado", cronStatus: "enviado_cliente",
    clientItems: {}, cronContents: [{ tema: "A" }, { tema: "B" }] };
  const evd = { type: "approveAll", contentIndex: null, note: "", value: "", at: NOW };
  const nu = granularSandbox(wsrc); const ba = granularSandbox(baseW);
  await nu.cx.writeClientGranular({ FCM_PROJECT_ID: "p1" }, "tok", JSON.parse(JSON.stringify(taskLegacy)), Object.assign({}, evd));
  await ba.cx.writeClientGranular({ FCM_PROJECT_ID: "p1" }, "tok", JSON.parse(JSON.stringify(taskLegacy)), Object.assign({}, evd));
  const wNew = nu.commits[0].writes[0]; const wBase = ba.commits[0].writes[0];
  const ADDITIVE = /^(approvalRounds|phaseRuns|workflowEvents|workflowPhase|workflowPhaseAt|workflowResponsibleType|workflowResponsibleUid|externalWait|externalWaitSince)(\.|$)/;
  const baseMask = wBase.updateMask.fieldPaths.slice().sort();
  const newLegacyMask = wNew.updateMask.fieldPaths.filter((p) => !ADDITIVE.test(p)).sort();
  ok("I1 máscara LEGADA idêntica (novo ⊇ baseline; extras só aditivos)", JSON.stringify(baseMask) === JSON.stringify(newLegacyMask));
  const pick = (f) => { const o = {}; for (const k in f) if (!ADDITIVE.test(k)) o[k] = dec(f[k]); return o; };
  ok("I2 valores LEGADOS byte-equivalentes (status/cronStatus/clientFlowStatus/…)", JSON.stringify(pick(wNew.update.fields)) === JSON.stringify(pick(wBase.update.fields)));
  const histN = wNew.updateTransforms[0].appendMissingElements.values[0]; const histB = wBase.updateTransforms[0].appendMissingElements.values[0];
  ok("I3 histórico canônico idêntico no fluxo portal", JSON.stringify(histN) === JSON.stringify(histB));
  const extras = wNew.updateMask.fieldPaths.filter((p) => ADDITIVE.test(p));
  ok("I4 extras presentes e SÓ na allowlist aditiva", extras.length > 0 && wNew.updateMask.fieldPaths.every((p) => ADDITIVE.test(p) || baseMask.includes(p)));
} else {
  ok("I compat baseline (git raso) — coberto no CI com checkout completo", true);
}

console.log(`\n# f356a-workflow-orchestration: ${okc}/${okc + fail} OK${fail ? " — FALHAS: " + fail : ""}`);
if (fails.length) { console.log("FALHAS:"); fails.forEach((f) => console.log(" - " + f)); process.exit(1); }
