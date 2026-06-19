#!/usr/bin/env node
/* F3.3.1 — teste unitário da NOTIFICATION ENGINE v2 LOG-ONLY (finish-based).
   Importa __slaCore do Worker e exercita buildSlaNotificationPlanV2 + a resolução
   de prazo (slaPlanFromAssignment). Um espião de fetch lança erro se QUALQUER
   provider (FCM/Web Push/WhatsApp) for chamado → prova zero envio real.
   Puro/offline. Não toca produção, não envia nada, não escreve Firestore. */
import { __slaCore } from "../../cloudflare-worker.js";
const { buildSlaNotificationPlanV2, slaPlanFromAssignment, slaDedupKey, SLA_NOTIFY_FINISH_EVENTS } = __slaCore;

// ESPIÃO: qualquer chamada de rede explode o teste (prova providerCalled=false).
globalThis.fetch = () => { throw new Error("PROVIDER-CALL-DETECTED (envio real proibido na F3.3.1)"); };

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } };

const NOW = 1781800000000, MIN = 60000;
const comp = (over = {}) => Object.assign({
  taskId: "T1", title: "Cronograma semanal", designerId: "D1", client: "Boa Forma",
  demandType: "semanal", slaStatus: "em_producao", slaSeverity: "ok", blockedCandidate: false,
  overdueMs: 0, plannedStartAt: NOW - 120 * MIN, plannedFinishAt: NOW + 60 * MIN,
}, over);
const rep = (computed, flags = {}) => ({ computed, flags: Object.assign({ slaNotifications: false }, flags) });
const build = (computed, env = {}, flags = {}) => buildSlaNotificationPlanV2(rep(computed, flags), env, NOW, -180);

// 1 — laranja exatamente 30 min antes do término
{ const r = build([comp({ plannedFinishAt: NOW + 30 * MIN })]);
  ok("1 laranja em -30min", r.plan.length === 1 && r.plan[0].eventType === "designer_finish_warning" && r.plan[0].minutesRemaining === 30); }
// 2 — laranja com 18 min restantes
{ const r = build([comp({ plannedFinishAt: NOW + 18 * MIN })]);
  ok("2 laranja 18min", r.plan.length === 1 && r.plan[0].severityColor === "laranja" && r.plan[0].minutesRemaining === 18); }
// 3 — vermelho 1 min após o término
{ const r = build([comp({ plannedFinishAt: NOW - 1 * MIN })]);
  ok("3 vermelho +1min", r.plan.length === 1 && r.plan[0].eventType === "designer_finish_overdue" && r.plan[0].minutesOverdue === 1); }
// 4 — vermelho com 7 min de atraso
{ const r = build([comp({ plannedFinishAt: NOW - 7 * MIN })]);
  ok("4 vermelho +7min", r.plan.length === 1 && r.plan[0].severityColor === "vermelho" && r.plan[0].minutesOverdue === 7); }
// 5 — tarefa concluída (entregue) não gera alerta (mesmo com prazo estourado)
ok("5 concluida=>0", build([comp({ slaStatus: "entregue", plannedFinishAt: NOW - 7 * MIN })]).plan.length === 0);
// 6 — entregue dentro da janela laranja também não gera
ok("6 entregue janela=>0", build([comp({ slaStatus: "entregue", plannedFinishAt: NOW + 10 * MIN })]).plan.length === 0);
// 7 — sem designer não gera alerta
ok("7 sem designer=>0", build([comp({ designerId: null, plannedFinishAt: NOW - 7 * MIN })]).plan.length === 0);
// 8 — sem prazo final não gera alerta
ok("8 sem prazo=>0", build([comp({ plannedFinishAt: 0 })]).plan.length === 0);
// 9 — removida/cancelada não gera alerta
ok("9 cancelada=>0", build([comp({ slaStatus: "cancelada", plannedFinishAt: NOW - 7 * MIN })]).plan.length === 0);
// 10 — dedup: duas computed idênticas (mesmo task/anchor) → 1 plano
{ const c = comp({ plannedFinishAt: NOW - 7 * MIN }); const r = build([c, Object.assign({}, c)]);
  ok("10 dedup => 1", r.plan.length === 1); }
// 11 — cooldown: mesma tarefa vermelha com 2 âncoras diferentes → 1 vermelho
{ const r = build([comp({ taskId: "TX", plannedFinishAt: NOW - 7 * MIN }), comp({ taskId: "TX", plannedFinishAt: NOW - 40 * MIN })]);
  ok("11 cooldown vermelho => 1", r.plan.filter((p) => p.taskId === "TX").length === 1); }
// 12 — payload contém deepLink
{ const r = build([comp({ plannedFinishAt: NOW - 7 * MIN })]);
  ok("12 deepLink", r.plan[0].deepLink === "idseven://task/T1"); }
// 13 — severity correta (laranja=warning / vermelho=critical)
{ const w = build([comp({ plannedFinishAt: NOW + 10 * MIN })]).plan[0];
  const v = build([comp({ plannedFinishAt: NOW - 10 * MIN })]).plan[0];
  ok("13 severity", w.severity === "warning" && v.severity === "critical"); }
// 14 — canais previstos presentes, mas providerCalled=false
{ const p = build([comp({ plannedFinishAt: NOW - 7 * MIN })]).plan[0];
  ok("14 canais + providerCalled=false", p.channels.includes("android_fcm") && p.channels.includes("desktop_inapp") && p.providerCalled === false); }
// 15/16/17 — mesmo com TODOS os gates ON: zero provider, ainda log-only/dry-run
{ const r = build([comp({ plannedFinishAt: NOW - 7 * MIN })], { SLA_NOTIFY_ENABLED: "true", SLA_NOTIFY_DRYRUN: "false", SLA_NOTIFY_ALLOWLIST: "D1" }, { slaNotifications: true });
  const p = r.plan[0];
  ok("15 zero FCM (sem throw + providerCalled false)", r.providerCalled === false && p.providerCalled === false);
  ok("16 zero Web Push (dryRun engine true)", r.dryRun === true && p.dryRun === true);
  ok("17 zero WhatsApp (hard-block log-only sempre presente)", p.blockedReason.includes("F3.3.1-log-only")); }
// 18 — fallback planDueAt funciona quando não há plannedFinishAt
{ const plan = slaPlanFromAssignment({ designerSla: { planDueAt: 1781805600000 } }, -180);
  ok("18 fallback planDueAt", plan.plannedFinishAt === 1781805600000); }
// 19 — plannedFinishAt prevalece sobre planDueAt
{ const plan = slaPlanFromAssignment({ designerSla: { plannedFinishAt: 1781805600000, planDueAt: 1700000000000 } }, -180);
  ok("19 plannedFinishAt prevalece", plan.plannedFinishAt === 1781805600000); }
// 20 — engine NÃO usa start_warning como evento principal
{ const r = build([comp({ plannedFinishAt: NOW + 10 * MIN }), comp({ taskId: "T2", plannedFinishAt: NOW - 5 * MIN })]);
  const types = new Set(r.plan.map((p) => p.eventType));
  ok("20 sem start_warning; só finish",
    !types.has("designer_start_warning") && [...types].every((t) => SLA_NOTIFY_FINISH_EVENTS.includes(t)) &&
    JSON.stringify(r.scope) === JSON.stringify(["designer_finish_warning", "designer_finish_overdue"])); }

// Bônus — texto base exato (laranja) e título (vermelho)
{ const w = build([comp({ plannedFinishAt: NOW + 30 * MIN })]).plan[0];
  ok("B1 titulo laranja", w.title === "Prazo próximo — conclua em breve");
  ok("B2 corpo laranja com 'Prazo final:' e HH:mm", /Faltam 30 minutos para concluir 'Cronograma semanal'\. Prazo final: \d{2}:\d{2}\./.test(w.body));
  const v = build([comp({ plannedFinishAt: NOW - 7 * MIN })]).plan[0];
  ok("B3 titulo vermelho", v.title === "Prazo encerrado — ação urgente");
  ok("B4 corpo vermelho urgência", /acabou\. Conclua a demanda imediatamente ou sinalize atraso em até 10 minutos\./.test(v.body)); }

console.log("\nF3.3.1 RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
