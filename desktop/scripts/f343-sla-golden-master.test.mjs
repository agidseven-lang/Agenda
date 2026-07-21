#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — GOLDEN MASTER de SLA (âncora de correção).
 *
 * PROVA que desktop/src/main/slaRules.js (produtor de SLA do MAIN) reproduz VALOR-A-VALOR as
 * regras de SLA do renderer (index.html base 1.0.178) para TODO o corpus de fixtures.
 *
 * BASELINE (verdade): extrai VERBATIM as funções de regra do index.html (notifScanSla +
 * resolveTaskDisplayState/slaPanelFinishMs/slaPanelDelivered/slaCfgOf/resolveCanonicalSlaTimeline/
 * resolveNotificationTargets/notifBuildPayload/… + tabelas SECTOR_SLA/SECTORS) e roda num harness
 * throwaway com um resolvedor de responsável DENORMALIZADO (igual ao notifResponsibleDenorm do main,
 * já que o main não tem diretório de usuários) + notifEmit capturado. Isso produz o GOLDEN.
 *
 * EQUIVALÊNCIA (gate): slaRules.slaEmissionsFor / resolveCanonicalSlaTimeline devem bater com o GOLDEN
 * em: {eligible, warningAtMs, overdueAtMs, criticalAtMs, responsibleId, dedupKeys, titles, bodies,
 * severities, deep} + deep-equal do payload completo (createdAt congelado). Qualquer divergência = FAIL.
 *
 * Rodar: node desktop/scripts/f343-sla-golden-master.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const slaRules = require(path.join(DESK, 'src', 'main', 'slaRules.js'));
const { buildCorpus } = await import('./fixtures/f343/corpus.mjs');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

/* ---------- extração VERBATIM do index.html ---------- */
function grabFn(name) {
  const a = HTML.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  let d = 0;
  for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
// Declaração var/const NAME=<literal>;  (para até o `;` na profundidade 0 de (){}[]).
function grabDecl(marker) {
  const a = HTML.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  let round = 0, sq = 0, cur = 0;
  for (let j = a + marker.length; j < HTML.length; j++) {
    const c = HTML[j];
    if (c === '(') round++; else if (c === ')') round--;
    else if (c === '[') sq++; else if (c === ']') sq--;
    else if (c === '{') cur++; else if (c === '}') cur--;
    else if (c === ';' && round === 0 && sq === 0 && cur === 0) return HTML.slice(a, j + 1);
  }
  throw new Error('decl sem ; : ' + marker);
}

const DECLS = [
  grabDecl('const SECTORS='),
  grabDecl('const SECTOR_ALIAS='),
  grabDecl('var SLA_PANEL_WARN_MS='),
  grabDecl('var SLA_PANEL_GRACE_MS='),
  grabDecl('var SECTOR_SLA='),
].join('\n');
const FNS = ['secOf', 'dtMs', 'first', 'slaibFmtHM', 'slaMMSSfmt', 'slaCount', 'slaElapsed',
  'slaPanelFinishMs', 'slaPanelDelivered', 'resolveTaskDisplayState', 'slaCfgDefault', 'slaCfgOf',
  '_slaScheduleRevOf', 'resolveCanonicalSlaTimeline', 'resolveNotificationTargets', 'notifBuildPayload',
  'notifScanSla'].map(grabFn).join('\n');

// Harness baseline: stubs + verbatim + API. notifResponsible = DENORM (igual ao main).
const PRELUDE =
  'var CAP=[]; var __NOW=0; var state={user:{id:""},tasks:[]};\n' +
  'function canonicalNowMs(){ return __NOW; }\n' +
  'function slaibVisible(u){ return state.tasks; }\n' +
  'function ncDiag(){}\n' +
  'function slaCriticalFor(u){ return null; }\n' +   // operational_block fora do escopo per-task
  'function notifEmit(p){ CAP.push(p); }\n' +
  // DENORM: idêntico a notifResponsibleDenorm do slaRules.js (main sem diretório de usuários).
  'function notifResponsible(t){ var da=(t&&t.designerAssignment)||{}; if(da.designerId){ return {id:da.designerId,name:da.designerName||"",avatar:da.designerAvatar||da.designerPhoto||""}; } return {id:(t&&t.assigneeId)||"",name:(t&&(t.assignee||t.assigneeName))||"",avatar:(t&&t.assigneePhoto)||""}; }\n';
const R = new Function(PRELUDE + DECLS + '\n' + FNS + '\n' +
  'return { run:function(task,uid,now){ CAP.length=0; state.user={id:uid}; state.tasks=[task]; __NOW=now; notifScanSla(); return CAP.slice(); },' +
  ' timeline:function(task,now){ __NOW=now; return resolveCanonicalSlaTimeline(task, dtMs); } };')();

/* ---------- comparação value-identical ---------- */
const NOW = 1700000000000;
const CORPUS = buildCorpus(NOW);
const pick = (arr, k) => arr.map((p) => (k === 'deep' ? (p.action && p.action.deep) : p[k]));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stripCreatedAt = (arr) => arr.map((p) => { const q = Object.assign({}, p); delete q.createdAt; return q; });

// Congela Date.now p/ createdAt determinístico (baseline e slaRules usam notifBuildPayload → Date.now).
const _now = Date.now; Date.now = () => NOW;

const goldenOut = [];
try {
  for (const fx of CORPUS) {
    const baseEm = R.run(fx.task, fx.uid, fx.now);
    const baseTl = R.timeline(fx.task, fx.now);
    const ruleEm = slaRules.slaEmissionsFor(fx.task, fx.uid, fx.now);
    const ruleTl = slaRules.resolveCanonicalSlaTimeline(fx.task, slaRules.dtMs);

    const golden = {
      name: fx.name, uid: fx.uid,
      eligible: baseEm.length > 0, count: baseEm.length,
      warningAtMs: baseTl.warningAtMs, overdueAtMs: baseTl.overdueAtMs, criticalAtMs: baseTl.criticalAtMs,
      responsibleId: pick(baseEm, 'responsibleId'),
      dedupKeys: pick(baseEm, 'dedupKey'), titles: pick(baseEm, 'title'), bodies: pick(baseEm, 'body'),
      severities: pick(baseEm, 'severity'), deep: pick(baseEm, 'deep'),
    };
    goldenOut.push(golden);

    const n = fx.name;
    ok(n + ' :: eligible', (ruleEm.length > 0) === golden.eligible && ruleEm.length === golden.count);
    ok(n + ' :: warningAtMs', ruleTl.warningAtMs === golden.warningAtMs);
    ok(n + ' :: overdueAtMs', ruleTl.overdueAtMs === golden.overdueAtMs);
    ok(n + ' :: criticalAtMs', ruleTl.criticalAtMs === golden.criticalAtMs);
    ok(n + ' :: responsibleId', eq(pick(ruleEm, 'responsibleId'), golden.responsibleId));
    ok(n + ' :: dedupKeys', eq(pick(ruleEm, 'dedupKey'), golden.dedupKeys));
    ok(n + ' :: titles', eq(pick(ruleEm, 'title'), golden.titles));
    ok(n + ' :: bodies', eq(pick(ruleEm, 'body'), golden.bodies));
    ok(n + ' :: severities', eq(pick(ruleEm, 'severity'), golden.severities));
    ok(n + ' :: deep', eq(pick(ruleEm, 'deep'), golden.deep));
    // deep-equal do payload COMPLETO (createdAt congelado) — pega qualquer divergência de campo.
    ok(n + ' :: full-payload deep-equal', eq(stripCreatedAt(ruleEm), stripCreatedAt(baseEm)));
  }
} finally { Date.now = _now; }

// Grava o golden como artefato durável (auditoria). Não é relatório .md; é fixture de teste.
try { fs.writeFileSync(path.join(__dirname, 'fixtures', 'f343', 'golden.json'), JSON.stringify(goldenOut, null, 2)); } catch (_) {}

// Sanidade do corpus: cobre todos os estados exigidos.
const names = CORPUS.map((f) => f.name);
const must = ['cron-running', 'cron-warning-20', 'cron-overdue-red', 'cron-overdue-critical', 'cron-none-nosla', 'cron-completed', 'cron-cancelled', 'edm-warning-35', 'edm-overdue-5', 'edm-critical-window-none', 'roteiro-warn-window', 'reassigned-to-dz2', 'non-eligible-other-uid', 'edm-deadline-changed-rev5', 'denorm-absent-assignee', 'denorm-name-only'];
ok('corpus cobre todos os estados exigidos', must.every((m) => names.includes(m)));
// Sanidade semântica do golden (não só igualdade): estados-chave produziram a emissão certa.
const g = Object.fromEntries(goldenOut.map((x) => [x.name, x]));
ok('semântica: cron-warning-20 → 1× sla_warning warning', g['cron-warning-20'].count === 1 && g['cron-warning-20'].severities[0] === 'warning' && /^sla_warning:/.test(g['cron-warning-20'].dedupKeys[0]));
ok('semântica: cron-overdue-red → 1× sla_overdue', g['cron-overdue-red'].count === 1 && /^sla_overdue:/.test(g['cron-overdue-red'].dedupKeys[0]));
ok('semântica: cron-overdue-critical → 1× sla_critical', g['cron-overdue-critical'].count === 1 && /^sla_critical:/.test(g['cron-overdue-critical'].dedupKeys[0]));
ok('semântica: edm-critical-window-none → 0 (critical:false)', g['edm-critical-window-none'].count === 0);
ok('semântica: roteiro-warn-window → 0 (sem SLA de designer)', g['roteiro-warn-window'].count === 0);
ok('semântica: non-eligible-other-uid → 0', g['non-eligible-other-uid'].count === 0);
ok('semântica: edm dedup inclui designerId+revisão', /^media_warning_40:t_edm:dz1:.*:r2$/.test(g['edm-warning-35'].dedupKeys[0]));
ok('semântica: bump de prazo (rev5) muda o dedupKey', g['edm-deadline-changed-rev5'].dedupKeys[0] !== g['edm-warning-35'].dedupKeys[0] && /:r5$/.test(g['edm-deadline-changed-rev5'].dedupKeys[0]));
ok('semântica: denorm-absent → responsável = assigneeId (dz1)', g['denorm-absent-assignee'].responsibleId[0] === 'dz1');

console.log('\n===== F3.4.3 — GOLDEN MASTER (slaRules.js ≡ renderer 1.0.178) =====');
console.log('fixtures: ' + CORPUS.length + ' | asserts: ' + (pass + fail) + ' | golden.json gravado');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-GOLDEN: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: slaRules.js divergiu do renderer (regra de SLA NÃO byte/valor-idêntica)'); process.exit(1); }
console.log('OK — slaRules.js reproduz as regras de SLA do renderer VALOR-A-VALOR em todo o corpus.');
