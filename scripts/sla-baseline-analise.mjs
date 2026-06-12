/* ════════════════════════════════════════════════════════════════════════
   FASE 4.4-A4 — ANALISADOR DO BASELINE REAL READ-ONLY
   Consome os JSONs salvos das execuções de POST /sla-dryrun na janela real e
   produz o relatório exigido (itens 10-18 da autorização).
   Uso:
     curl -sX POST https://idseven-push.agidseven.workers.dev/sla-dryrun > run1.json
     (repetir 2x em horários distintos: run2.json run3.json)
     node scripts/sla-baseline-analise.mjs run1.json run2.json run3.json
   Validação automática de segurança: writeAllowed=false, writes=0,
   eligibleEvents=0 (sem SLA_ACTIVATED_AT) — qualquer violação => ABORTAR.
   ════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) { console.error("uso: node sla-baseline-analise.mjs run1.json [run2.json run3.json]"); process.exit(2); }
let abort = [];
const runs = files.map((f) => {
  const j = JSON.parse(readFileSync(f, "utf8"));
  const r = j.report || j;
  if (j.mode && j.mode !== "dry-run") abort.push(`${f}: mode=${j.mode} (esperado dry-run)`);
  if (r.writeAllowed !== false) abort.push(`${f}: writeAllowed=${r.writeAllowed} — ANOMALIA GRAVE`);
  if (r.writes !== 0) abort.push(`${f}: writes=${r.writes} — ANOMALIA GRAVE (deveria ser 0)`);
  if (r.totals && r.totals.eligibleEvents !== 0) abort.push(`${f}: eligibleEvents=${r.totals.eligibleEvents} (sem SLA_ACTIVATED_AT deveria ser 0)`);
  if (r.flags && Object.values(r.flags).some((v) => v === true)) abort.push(`${f}: alguma flag ligada: ${JSON.stringify(r.flags)}`);
  return { f, at: new Date(r.now).toISOString(), r };
});
if (abort.length) { console.error("✗ CRITÉRIO DE ABORTO ATINGIDO:\n  - " + abort.join("\n  - ") + "\n→ Remover SLA_ENGINE_ENABLED imediatamente."); process.exit(1); }

console.log("══════ BASELINE REAL READ-ONLY — ANÁLISE ══════");
for (const { f, at, r } of runs)
  console.log(`execução ${f} @ ${at}: tarefas=${r.scanned} (total na query=${r.pagination.totalQueried}, restantes=${r.pagination.remaining}) retroIgnored=${r.totals.retroIgnored} elegíveis=${r.totals.eligibleEvents} writes=${r.writes}`);

const last = runs[runs.length - 1].r;
const byStatus = {}; for (const c of last.computed) byStatus[c.slaStatus] = (byStatus[c.slaStatus] || 0) + 1;
console.log("\n11) tarefas analisadas (última execução):", last.scanned);
console.log("12) por status SLA:", JSON.stringify(byStatus));
console.log("13) WIP REAL observado por designer:");
for (const [d, w] of Object.entries(last.wip || {}))
  console.log(`   ${d}: observado=${w.observed} soft=${w.soft} hard=${w.hard} ${w.softExceeded ? "SOFT-EXCEDIDO " : ""}${w.hardExceeded ? "HARD-EXCEDIDO " : ""}${w.blockingByOverdue ? "(atraso ativo → efetivo 0)" : ""}`);
console.log("14) atrasos reais por designer:");
for (const [d, t] of Object.entries(last.totals.byDesigner || {}))
  console.log(`   ${d}: total=${t.total} vermelho=${t.atrasadas} laranja=${t.laranja}`);
console.log("15) bloqueios SIMULADOS (lock consolidado/designer):", JSON.stringify(last.wouldLock));
console.log("16) eventos retroativos ignorados:", last.totals.retroIgnored,
  "(amostra:", JSON.stringify((last.retroIgnored || []).slice(0, 5)), ")");
console.log("17) eventos elegíveis reais:", last.totals.eligibleEvents, "(esperado 0 sem SLA_ACTIVATED_AT)");
console.log("18) notificações que SERIAM enviadas (simulação):", (last.wouldNotify || []).length);
console.log("\nclientes:", JSON.stringify(last.totals.byClient));
console.log("tipos:", JSON.stringify(last.totals.byType));
console.log("\n✓ GATES: writeAllowed=false, writes=0, elegíveis=0, flags OFF em todas as execuções.");
console.log("→ Dados prontos para calibração de wipSoft/wipHard e decisão da 4.4-B.");
