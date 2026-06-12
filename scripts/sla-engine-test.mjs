/* ════════════════════════════════════════════════════════════════════════
   Testes unitários do Designer SLA Engine (FASE 4.3 — núcleo seguro).
   Importa o ARQUIVO REAL do worker (cópia .mjs verbatim) — testa o código
   que será deployado, não uma reimplementação.
   Uso:  node scripts/sla-engine-test.mjs
   ════════════════════════════════════════════════════════════════════════ */
import { copyFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "cloudflare-worker.js");
const TMP = "/tmp/idseven-worker-under-test.mjs";
copyFileSync(SRC, TMP);
const { __slaCore: S } = await import(pathToFileURL(TMP).href);
/* corte=1ms (tudo elegível) nos testes legados; o corte é testado em separado */
const derive = (prev, comp, task, now) => S.deriveSlaEvents(prev, comp, task, now, 1).events;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log("  PASS", name); }
  else { fail++; console.log("  FAIL", name, extra !== undefined ? JSON.stringify(extra) : ""); }
};
const MIN = 60000, TZ = -180;
/* tarefa-base: atribuída com início 10:00 e entrega 18:00 (horário local -3) */
const mk = (over) => Object.assign({
  id: "T1", status: "afazer", designerFlowStatus: "afazer",
  designerAssignment: { designerId: "D1", assignedBy: "S1", assignedAt: S.slaToMs("2026-06-15", "08:00", TZ),
    startDate: "2026-06-15", startTime: "10:00", endDate: "2026-06-15", endTime: "18:00" },
  startedAt: null, doneAt: null,
}, over || {});
const t0 = S.slaToMs("2026-06-15", "10:00", TZ);   // plannedStartAt
const tF = S.slaToMs("2026-06-15", "18:00", TZ);   // plannedFinishAt

console.log("== 1. atribuída com prazo de início e entrega ==");
let c = S.computeSlaStatus(mk(), t0 - 120 * MIN);
ok("estado=aguardando_inicio", c.slaStatus === "aguardando_inicio", c);
ok("plannedStartAt/FinishAt calculados do designerAssignment", c.plannedStartAt === t0 && c.plannedFinishAt === tF, c);
ok("janelas de alerta = prazo-30min (default autorizado)", c.startWarningAt === t0 - 30 * MIN && c.finishWarningAt === tF - 30 * MIN);

console.log("== 2. início dentro do prazo ==");
c = S.computeSlaStatus(mk({ designerFlowStatus: "andamento", startedAt: t0 - 5 * MIN }), t0 + 60 * MIN);
ok("estado=em_producao, severidade ok, sem bloqueio", c.slaStatus === "em_producao" && c.slaSeverity === "ok" && !c.blockedCandidate, c);
console.log("== 2b. alerta de INÍCIO próximo (laranja, 30min antes) ==");
c = S.computeSlaStatus(mk(), t0 - 20 * MIN);
ok("estado=inicio_proximo, severidade laranja", c.slaStatus === "inicio_proximo" && c.slaSeverity === "laranja", c);

console.log("== 3. início atrasado ==");
c = S.computeSlaStatus(mk(), t0 + 10 * MIN);
ok("estado=inicio_atrasado, vermelho, AINDA não-crítico (<30min)", c.slaStatus === "inicio_atrasado" && c.slaSeverity === "vermelho" && !c.blockedCandidate, c);
c = S.computeSlaStatus(mk(), t0 + 31 * MIN);
ok("início atrasado >30min vira candidato a bloqueio (SIMULAÇÃO)", c.blockedCandidate === true, c);

console.log("== 4. entrega próxima (laranja) ==");
c = S.computeSlaStatus(mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF - 15 * MIN);
ok("estado=entrega_proxima, laranja", c.slaStatus === "entrega_proxima" && c.slaSeverity === "laranja", c);

console.log("== 5. entrega atrasada (vermelho + candidato a bloqueio) ==");
c = S.computeSlaStatus(mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 5 * MIN);
ok("estado=entrega_atrasada, vermelho, blockedCandidate", c.slaStatus === "entrega_atrasada" && c.slaSeverity === "vermelho" && c.blockedCandidate === true, c);

console.log("== 6. conclusão encerra SLA/bloqueio ==");
c = S.computeSlaStatus(mk({ designerFlowStatus: "concluido", startedAt: t0, doneAt: tF + 60 * MIN }), tF + 61 * MIN);
ok("estado=entregue mesmo após atraso; sem candidato a bloqueio", c.slaStatus === "entregue" && !c.blockedCandidate, c);
{ const prev = { blockedEventAt: 1, finishOverdueSentAt: 1, assignedEventAt: 1, startedEventAt: 1 };
  const evs = derive(prev, c, mk({ designerFlowStatus: "concluido", startedAt: t0, doneAt: tF + 60 * MIN, id: "T1" }), tF + 61 * MIN);
  ok("gera designer_task_completed + designer_unblocked", evs.some(e => e.eventType === "designer_task_completed") && evs.some(e => e.eventType === "designer_unblocked"), evs.map(e => e.eventType)); }

console.log("== 7. reprogramação preserva histórico (âncora nova, sem duplicar antiga) ==");
{ const oldKey = S.slaDedupKey("T1", "designer_finish_warning", tF);
  const tF2 = S.slaToMs("2026-06-16", "18:00", TZ);
  const t2 = mk({ designerFlowStatus: "andamento", startedAt: t0,
    designerAssignment: Object.assign({}, mk().designerAssignment, { endDate: "2026-06-16" }) });
  const c2 = S.computeSlaStatus(t2, tF2 - 10 * MIN);
  const newKey = S.slaDedupKey("T1", "designer_finish_warning", c2.plannedFinishAt);
  ok("novo prazo → novo dedupKey (re-alerta permitido)", newKey !== oldKey, { oldKey, newKey });
  ok("estado recalculado sobre o novo prazo (entrega_proxima)", c2.slaStatus === "entrega_proxima", c2);
  const evs = derive({ finishWarningSentAt: 111, assignedEventAt: 1 }, c2, t2, tF2 - 10 * MIN);
  ok("marcador antigo NÃO suprime a nova âncora? (suprime até reset — comportamento documentado: reschedule zera marcadores na rota de reprogramação)", evs.every(e => e.eventType !== "designer_finish_warning"), evs.map(e => e.eventType)); }

console.log("== 8. dedupKey idempotente (mesma entrada → mesmo ID; evento não duplica) ==");
{ const k1 = S.slaDedupKey("T1", "designer_finish_overdue", tF);
  const k2 = S.slaDedupKey("T1", "designer_finish_overdue", tF);
  ok("determinístico", k1 === k2 && k1 === "T1__designer_finish_overdue__" + tF, k1);
  const cc = S.computeSlaStatus(mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 5 * MIN);
  const first = derive({ assignedEventAt: 1, startedEventAt: 1 }, cc, mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 5 * MIN);
  ok("1ª passada emite finish_overdue", first.some(e => e.eventType === "designer_finish_overdue"));
  const second = derive({ assignedEventAt: 1, startedEventAt: 1, finishOverdueSentAt: Date.now() }, cc, mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 6 * MIN);
  ok("2ª passada (marcador setado) NÃO re-emite", second.every(e => e.eventType !== "designer_finish_overdue"), second.map(e => e.eventType)); }

console.log("== 9. WIP simulado (hard=2) — sem bloquear ==");
{ const tasks = [
    mk({ id: "A", designerFlowStatus: "andamento" }), mk({ id: "B", designerFlowStatus: "andamento" }),
    mk({ id: "C", designerFlowStatus: "andamento" }), mk({ id: "D", designerFlowStatus: "afazer" })];
  const w = S.simulateWip(tasks);   // default = modo OBSERVE (4.4-A2)
  ok("WIP OBSERVADO=3 p/ D1; soft/hard excedidos MARCADOS", w.byDesigner.D1.observed === 3 && w.byDesigner.D1.softExceeded && w.byDesigner.D1.hardExceeded, w.byDesigner);
  ok("modo OBSERVE: NENHUM evento de limite (sem bloqueio assumido)", w.events.length === 0, w.events);
  const we = S.simulateWip(tasks, { wipMode: "enforce" });
  ok("modo ENFORCE (futuro): emite wip_limit_reached SIMULADO", we.events.length === 1 && we.events[0].eventType === "designer_wip_limit_reached" && we.events[0].simulated === true, we.events);
  const locks = { D1: { designerId: "D1" } };
  const wb = S.simulateWip(tasks, {}, locks);
  ok("atraso ativo ⇒ effectiveLimit 0 (bloqueante-por-atraso, simulado)", wb.byDesigner.D1.blockingByOverdue === true && wb.byDesigner.D1.effectiveLimit === 0, wb.byDesigner.D1); }

console.log("== 12. CORTE TEMPORAL slaActivatedAt (4.4-A2) ==");
{ const cc = S.computeSlaStatus(mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 5 * MIN);
  const semCorte = S.deriveSlaEvents({}, cc, mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 5 * MIN, 0);
  ok("SEM SLA_ACTIVATED_AT: ZERO eventos emitidos (tudo retroativo)", semCorte.events.length === 0 && semCorte.retro.length > 0, semCorte.retro.length);
  const corteFuturo = S.deriveSlaEvents({}, cc, mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 5 * MIN, tF + 999 * MIN);
  ok("corte APÓS as âncoras: tudo retroIgnored", corteFuturo.events.length === 0 && corteFuturo.retro.length > 0);
  const cortePassado = S.deriveSlaEvents({}, cc, mk({ designerFlowStatus: "andamento", startedAt: t0 }), tF + 5 * MIN, 1);
  ok("corte ANTES das âncoras: eventos elegíveis emitidos", cortePassado.events.length > 0 && cortePassado.retro.length === 0); }

console.log("== 13. LOCK CONSOLIDADO por designer (4.4-A2) ==");
{ const comps = [
    { taskId: "A", designerId: "D1", blockedCandidate: true, overdueMs: 50 * MIN, plannedFinishAt: tF },
    { taskId: "B", designerId: "D1", blockedCandidate: true, overdueMs: 200 * MIN, plannedFinishAt: tF - 100 * MIN },
    { taskId: "C", designerId: "D2", blockedCandidate: true, overdueMs: 10 * MIN, plannedFinishAt: tF },
    { taskId: "D", designerId: "D1", blockedCandidate: false, overdueMs: 0 }];
  const L = S.consolidateLocks(comps);
  ok("1 lock por designer (D1 e D2, não 3)", Object.keys(L).length === 2, Object.keys(L));
  ok("tarefas críticas viram METADATA (D1 com 2 tasks)", L.D1.tasks.length === 2);
  ok("prioridade = atraso mais grave (B, 200min) + deadline mais antigo", L.D1.worstTaskId === "B" && L.D1.oldestDeadlineMs === tF - 100 * MIN, L.D1);
  ok("simulated=true (nenhum lock real)", L.D1.simulated === true && L.D2.simulated === true); }

console.log("== 14. PLANO de reprogramação (dry-run, 4.4-A2) ==");
{ const t = mk({ designerFlowStatus: "andamento", startedAt: t0, designerSla: { rescheduleCount: 1, finishWarningSentAt: 123, finishOverdueSentAt: 456 } });
  const plan = S.planReschedule(t, { endDate: "2026-06-16", endTime: "18:00" }, tF, TZ);
  ok("NÃO aplica (applied=false, dryRun=true)", plan.applied === false && plan.dryRun === true);
  ok("reseta marcadores do prazo ANTIGO (finish*SentAt → null)", plan.wouldPatch.designerSla.finishWarningSentAt === null && plan.wouldPatch.designerSla.finishOverdueSentAt === null && plan.markersReset.includes("finishWarningSentAt"));
  ok("NÃO reseta marcadores de início (prazo de início inalterado)", !plan.markersReset.includes("startWarningSentAt"));
  ok("preserva histórico: rescheduleCount 1→2 + historyEntry from/to", plan.wouldPatch.designerSla.rescheduleCount === 2 && plan.historyEntry.kind === "designer_deadline_rescheduled" && plan.historyEntry.from.plannedFinishAt === tF, plan.historyEntry);
  ok("âncora de dedup MUDA (novo prazo pode alertar de novo)", plan.dedupAnchorChange.newFinishAnchor !== plan.dedupAnchorChange.oldFinishAnchor); }

console.log("== 10. transições de ciclo de vida (assigned/started) ==");
{ const cA = S.computeSlaStatus(mk(), t0 - 60 * MIN);
  const evs = derive({}, cA, mk(), t0 - 60 * MIN);
  ok("1ª vez: designer_task_assigned", evs.some(e => e.eventType === "designer_task_assigned"));
  const tS = mk({ designerFlowStatus: "andamento", startedAt: t0 - 1 * MIN });
  const cS = S.computeSlaStatus(tS, t0);
  const evs2 = derive({ assignedEventAt: 1 }, cS, tS, t0);
  ok("início real: designer_task_started (gancho startedAt existente)", evs2.some(e => e.eventType === "designer_task_started")); }

console.log("== 11. todo evento nasce SIMULADO e com envelope completo ==");
{ const ev = S.buildSlaEvent({ taskId: "T1", designerId: "D1", eventType: "designer_finish_warning", anchorMs: tF, timestamp: Date.now() });
  ok("simulated=true por padrão (fase segura)", ev.simulated === true);
  ok("envelope: tenant/task/designer/actor/role/type/ts/source/dedupKey/metadata", !!(ev.tenantId && ev.taskId && ev.designerId && ev.actorId && ev.actorRole && ev.eventType && ev.timestamp && ev.source && ev.dedupKey && ev.metadata)); }
ok("contrato de flags TODAS OFF", Object.values(S.SLA_FLAG_DEFAULTS).every(v => v === false), S.SLA_FLAG_DEFAULTS);
ok("11 tipos de evento autorizados", S.SLA_EVENT_TYPES.length === 11);

console.log(`\nRESULTADO: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
