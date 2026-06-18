#!/usr/bin/env node
/* F3.1 — teste unitário da camada de notificação SLA LOG-ONLY (puro, sem rede).
   Importa __slaCore do Worker e exercita simulateSlaNotifications. Um espião de
   fetch lança erro se QUALQUER provider for chamado → prova zero envio real.
   Não toca produção, não envia nada. */
import { __slaCore } from "../../cloudflare-worker.js";
const { simulateSlaNotifications, slaDedupKey } = __slaCore;

// ESPIÃO: qualquer chamada de rede (FCM/Web Push/WhatsApp) explode o teste.
globalThis.fetch = () => { throw new Error("PROVIDER-CALL-DETECTED (envio real é proibido na F3.1)"); };

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } };

const comp = (over = {}) => Object.assign({
  taskId: "T1", designerId: "D1", client: "Hospital Visão", demandType: "semanal",
  slaStatus: "inicio_proximo", slaSeverity: "laranja", blockedCandidate: false,
  overdueMs: 0, plannedStartAt: 1781802000000, plannedFinishAt: 1781805600000 }, over);
const rep = (computed, flags = {}) => ({ computed, flags: Object.assign({ slaNotifications: false }, flags) });

// 1 — inicio_proximo + designer válido → 1 entrada simulada
const r1 = simulateSlaNotifications(rep([comp()]), {});
ok("1 gera exatamente 1 plano", r1.plan.length === 1);
const p = r1.plan[0];
ok("1 simulated:true", p.simulated === true);
ok("1 canal fcm", p.channel === "fcm");
ok("1 papel designer + recipient=designerId", p.recipientRole === "designer" && p.recipientUserId === "D1");
ok("1 hard-block F3.1 presente", p.realSendBlockedBy.includes("F3.1-log-only"));
ok("1 eventType designer_start_warning", p.eventType === "designer_start_warning");

// 2 — sem designer → sem plano (nunca cliente, sem fallback)
ok("2 sem designer => 0 planos", simulateSlaNotifications(rep([comp({ designerId: null })]), {}).plan.length === 0);

// 3 — status não-notificáveis na F3.1 → sem plano
for (const st of ["aguardando_inicio", "inicio_atrasado", "em_producao", "entrega_proxima", "entrega_atrasada", "entregue", "cancelada"])
  ok("3 nao-notificavel " + st + " => 0 planos", simulateSlaNotifications(rep([comp({ slaStatus: st })]), {}).plan.length === 0);

// 4 — TODOS os gates "on" → ainda simulado e ainda hard-blocked (envio real proibido na F3.1)
const r4 = simulateSlaNotifications(rep([comp()], { slaNotifications: true }), { SLA_NOTIFY_ENABLED: "true", SLA_NOTIFY_DRYRUN: "false", SLA_NOTIFY_ALLOWLIST: "D1" });
ok("4 simulated mesmo com gates on", r4.plan[0].simulated === true);
ok("4 hard-block F3.1 mesmo com gates on", r4.plan[0].realSendBlockedBy.includes("F3.1-log-only"));
ok("4 com gates on, só o hard-block F3.1 bloqueia", r4.plan[0].realSendBlockedBy.length === 1);

// 5 — sem PII sensível no texto humano (sem email, sem telefone)
const human = p.title + " | " + p.body;
ok("5 sem email no texto", !/@/.test(human));
ok("5 sem telefone no texto", !/\d{7,}/.test(human));
ok("5 recipient é id de designer (não cliente)", p.recipientUserId === "D1" && p.recipientRole === "designer");

// 6 — dedupKey de entrega estável e determinístico
const expected = slaDedupKey("T1", "designer_start_warning", 1781802000000) + "__notify__fcm";
ok("6 dedupKey esperado", p.deliveryDedupKey === expected);
ok("6 dedupKey estável entre chamadas", simulateSlaNotifications(rep([comp()]), {}).plan[0].deliveryDedupKey === expected);

// 7 — deep link válido (app do designer; não é link de cliente)
ok("7 deepLink idseven://task/T1", p.deepLink === "idseven://task/T1");

// 8 — gates de bloqueio default + resumo + zero provider (fetch nunca lançou)
ok("8 allowlist vazia bloqueia (default)", r1.plan[0].realSendBlockedBy.includes("allowlist-empty"));
ok("8 slaNotifications=false bloqueia (default)", r1.plan[0].realSendBlockedBy.includes("flags.slaNotifications=false"));
ok("8 SLA_NOTIFY_DRYRUN default (true) bloqueia", r1.plan[0].realSendBlockedBy.includes("SLA_NOTIFY_DRYRUN!=false"));
ok("8 SLA_NOTIFY_ENABLED!=true bloqueia (default)", r1.plan[0].realSendBlockedBy.includes("SLA_NOTIFY_ENABLED!=true"));
ok("8 realSendImplemented=false", r1.realSendImplemented === false);
ok("8 resumo: scope só start_warning", JSON.stringify(r1.scope) === JSON.stringify(["designer_start_warning"]));

// 9 — multi-tarefa: só as inicio_proximo com designer geram plano
const multi = simulateSlaNotifications(rep([comp({ taskId: "A" }), comp({ taskId: "B", slaStatus: "inicio_atrasado" }), comp({ taskId: "C", designerId: null })]), {});
ok("9 multi: só 1 plano (A)", multi.plan.length === 1 && multi.plan[0].taskId === "A");

// 10 — scan vazio → plano vazio (estado atual de produção)
ok("10 computed vazio => plano vazio", simulateSlaNotifications(rep([]), {}).plan.length === 0);

console.log(`\nF3.1 NOTIFY-SIM: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
