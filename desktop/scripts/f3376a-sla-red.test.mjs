#!/usr/bin/env node
/* =====================================================================
 * F3.3.76A — SLA do Designer ancorado no PRAZO FINAL da Social (designerSla.planDueAt).
 *   AMARELO em planDueAt-30min · VERMELHO em planDueAt · (CRÍTICO em planDueAt+10min).
 *   A notificação AZUL de atribuição é SEPARADA e permanece (notifScanAssign).
 *
 * SELF-ADAPTING (RED×GREEN) sobre o notifScanSla REAL (com resolveTaskDisplayState/
 * slaPanelFinishMs/slaPanelDelivered/resolveNotificationTargets reais) + captura de notifEmit:
 *   • fonte COM designerOpSla → candidata ERRADA (amarelo antecipado na atribuição) → RED.
 *   • fonte SEM designerOpSla → CORRIGIDA (âncora = planDueAt) → GREEN + matriz FASE-10.
 *
 * Rodar: /opt/node22/bin/node desktop/scripts/f3376a-sla-red.test.mjs   (SRC=<index.html> força fonte)
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = process.env.SRC || path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const HTML = fs.readFileSync(SRC_PATH, 'utf8');
const HAS_OP = /function designerOpSla\(/.test(HTML);   // presente = candidata ERRADA (assignedAt+30)

function grab(n) {
  let a = HTML.indexOf('function ' + n + '('); if (a < 0) throw new Error('não encontrei: ' + n);
  let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } }
  throw new Error('sem fim: ' + n);
}
const NAMES = ['notifScanSla', 'resolveTaskDisplayState', 'slaPanelFinishMs', 'slaPanelDelivered', 'resolveNotificationTargets'];
if (HAS_OP) NAMES.unshift('designerOpSla');
let SRC = ''; for (const n of NAMES) SRC += grab(n) + '\n';

const PRELUDE =
  'var SLA_PANEL_WARN_MS=30*60000, SLA_PANEL_GRACE_MS=10*60000, SLA_ASSIGNMENT_GRACE_MS=2*60000;\n' +
  'var SLA_OP_DEADLINE_MS=30*60000, SLA_OP_GRACE_MS=10*60000;\n' +
  'var CAP=[]; var __TASKS=[]; var state={user:{id:"dz1"}};\n' +
  'function slaibVisible(u){return __TASKS;}\n' +
  'function notifResponsible(t){var da=(t&&t.designerAssignment)||{};return {id:da.designerId||"dz1",name:"Designer Teste",avatar:""};}\n' +
  'function notifBuildPayload(p){return p;}\n' +
  'function notifEmit(p){CAP.push(p);}\n' +
  'function slaibFmtHM(ms){return "22:02";}\n' +
  'function slaCount(ms){return "29:58";}\n' +
  'function slaElapsed(ms){return "0:30";}\n' +
  'function slaCriticalFor(u){return null;}\n' +
  'function first(s){return (s||"").split(" ")[0];}\n' +
  'function dtMs(){return 0;}\n' +
  'function canonicalNowMs(){return Date.now();}\n' +                                                        /* F3.3.77A-R3 — relógio canônico (stub: offset 0) */
  'function _slaScheduleRevOf(t){return Number(t&&t.designerSla&&t.designerSla.scheduleRevision)||0;}\n' +   /* F3.3.77A-R3 — revisão de prazo (stub) */
  'function secOf(s){return {key:(s==="cronograma"?"cronograma":(s==="roteiro"?"roteiro":(s==="edicao"?"edicao":"outro")))};}\n';
const R = new Function(PRELUDE + SRC +
  '\n; return { notifScanSla, cap:function(){return CAP;}, setTasks:function(a){__TASKS=a;}, setUser:function(u){state.user=u;} };')();

const NOW = Date.now(), MIN = 60000, DAY = 86400000, HOUR = 3600000;
const task = (o) => Object.assign({
  id: 't1', title: 'Cronograma semanal', client: 'Hospital Visão', sector: 'cronograma',
  designerAssignment: { designerId: 'dz1', assignedAt: NOW, assignedBy: 'soc1' }, designerFlowStatus: 'afazer',
  designerSla: { planDueAt: NOW + 3 * DAY },
}, o || {});
const withSla = (pd, extra) => task(Object.assign({ designerSla: { planDueAt: pd } }, extra || {}));
const run = (t, uid) => { R.cap().length = 0; R.setUser({ id: uid || 'dz1' }); R.setTasks([t]); R.notifScanSla(); return R.cap().slice(); };
const evs = (t, uid) => run(t, uid).map(p => p.eventType);

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

if (HAS_OP) {
  /* RED — candidata ERRADA: atribuição AGORA + prazo 31min à frente → amarelo ANTECIPADO na atribuição. */
  const A = evs(withSla(NOW + 31 * MIN, { designerAssignment: { designerId: 'dz1', assignedAt: NOW, assignedBy: 'soc1' } }), 'dz1');
  ok('RED: atribuição agora + prazo 31min à frente → amarelo ANTECIPADO (bug: âncora na atribuição, não em planDueAt-30)', A.includes('sla_warning'));
  console.log('\n(CANDIDATA ERRADA / RED) A=' + JSON.stringify(A));
} else {
  /* GREEN — corrigida: âncora = designerSla.planDueAt. */
  // Cronologia (cenário do owner: prazo 22:02; 21:31 só azul; 21:32 amarelo; 22:02 vermelho).
  ok('Y1: prazo 31min à frente → SEM amarelo (só a azul de atribuição, separada)', !evs(withSla(NOW + 31 * MIN), 'dz1').includes('sla_warning'));
  ok('Y2: prazo 30min à frente (restam 30) → AMARELO', evs(withSla(NOW + 30 * MIN), 'dz1').includes('sla_warning'));
  const y = run(withSla(NOW + 25 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {};
  ok('Y3: texto canônico do amarelo', y.body === 'Você tem 30 minutos para concluir esta tarefa.');
  ok('Y4: severidade warning (laranja)', y.severity === 'warning');
  ok('Y5: dedupKey = sla_warning:taskId:finishMs (planDueAt)', y.dedupKey === 'sla_warning:t1:' + (NOW + 25 * MIN));
  ok('Y6: só o DESIGNER (dz2 não recebe)', !evs(withSla(NOW + 25 * MIN), 'dz2').includes('sla_warning'));
  ok('Y7: Social/autor (soc1) não recebe', !evs(withSla(NOW + 25 * MIN), 'soc1').includes('sla_warning'));
  // Durações (owner tests 1-4): amarelo só quando faltam 30, independente da duração.
  ok('T1: prazo 3 DIAS → SEM amarelo agora', !evs(withSla(NOW + 3 * DAY), 'dz1').includes('sla_warning'));
  ok('T2: prazo 2 HORAS → SEM amarelo agora', !evs(withSla(NOW + 2 * HOUR), 'dz1').includes('sla_warning'));
  ok('T3: prazo EXATO 30min → AMARELO', evs(withSla(NOW + 30 * MIN), 'dz1').includes('sla_warning'));
  ok('T4: prazo < 30min (20min) → AMARELO (já dentro da janela)', evs(withSla(NOW + 20 * MIN), 'dz1').includes('sla_warning'));
  // VERMELHO
  const r = run(withSla(NOW - 1 * MIN), 'dz1').find(p => p.eventType === 'sla_overdue') || {};
  ok('R1: prazo final atingido (planDueAt no passado) + aberta → VERMELHO', !!r.eventType);
  ok('R2: texto canônico do vermelho', r.body === 'Você tem 10 minutos para concluir esta tarefa.');
  ok('R3: antes do prazo (25min à frente) → SEM vermelho', !evs(withSla(NOW + 25 * MIN), 'dz1').includes('sla_overdue'));
  ok('R4: dedupKey vermelho = sla_overdue:taskId:finishMs', r.dedupKey === 'sla_overdue:t1:' + (NOW - 1 * MIN));
  // Conclusão / cancelamento (owner test 6)
  ok('C1: CONCLUÍDA (designerFlowStatus=concluido) + prazo passado → SEM vermelho', !evs(withSla(NOW - 1 * MIN, { designerFlowStatus: 'concluido' }), 'dz1').length);
  ok('C2: CANCELADA (status=cancelado) → SEM alerta', !evs(withSla(NOW - 1 * MIN, { status: 'cancelado' }), 'dz1').length);
  // Alteração de prazo (owner test 5) → recalcula (novo finishMs → novo dedup)
  ok('D1: mudança de prazo → novo dedupKey (finishMs novo)', (run(withSla(NOW + 18 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {}).dedupKey === 'sla_warning:t1:' + (NOW + 18 * MIN));
  // Reatribuição (owner test 7): baseada no prazo; o novo designer recebe, o anterior não.
  ok('RE1: reatribuído a dz2 (prazo na janela) → dz2 recebe amarelo', evs(withSla(NOW + 25 * MIN, { designerAssignment: { designerId: 'dz2', assignedAt: NOW } }), 'dz2').includes('sla_warning'));
  ok('RE2: reatribuído a dz2 → dz1 NÃO recebe', !evs(withSla(NOW + 25 * MIN, { designerAssignment: { designerId: 'dz2', assignedAt: NOW } }), 'dz1').includes('sla_warning'));
  // Snapshots repetidos (owner test 8) → mesmo dedupKey estável
  ok('SN1: snapshot repetido → mesmo dedupKey', (run(withSla(NOW + 25 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {}).dedupKey === (run(withSla(NOW + 25 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {}).dedupKey);
  // Restart (owner test 9): reconstrói do planDueAt persistido (sem estado local) → dispara
  ok('RS1: restart — reconstrói do planDueAt persistido → amarelo', evs(withSla(NOW + 25 * MIN), 'dz1').includes('sla_warning'));
  // Roteiro sem SLA (owner test 10)
  ok('RO1: ROTEIRO (prazo na janela) → SEM amarelo', !evs(withSla(NOW + 25 * MIN, { sector: 'roteiro' }), 'dz1').includes('sla_warning'));
  ok('RO2: ROTEIRO (prazo passado) → SEM vermelho', !evs(withSla(NOW - 1 * MIN, { sector: 'roteiro' }), 'dz1').includes('sla_overdue'));
  // Setores com designer
  ok('SE1: Cronograma → amarelo', evs(withSla(NOW + 25 * MIN, { sector: 'cronograma' }), 'dz1').includes('sla_warning'));
  ok('SE2: Edição de mídia → amarelo', evs(withSla(NOW + 25 * MIN, { sector: 'edicao' }), 'dz1').includes('sla_warning'));
  // Fonte
  ok('SRC1: SEM designerOpSla (âncora voltou ao PRAZO PLANEJADO)', !HAS_OP);
  ok('SRC2: notifScanSla usa resolveTaskDisplayState + exclui roteiro', (() => { const s = grab('notifScanSla'); return /resolveTaskDisplayState\(t,now,f\)/.test(s) && /secOf\(t\.sector\)\|\|\{\}\)\.key==='roteiro'/.test(s); })());
  ok('SRC3: SEM grace de atribuição no amarelo (SLA_ASSIGNMENT_GRACE_MS não gateia notifScanSla)', !/SLA_ASSIGNMENT_GRACE_MS/.test(grab('notifScanSla')));
  ok('SRC4: dedup por finishMs (planDueAt), não por assignedAt (F3.3.77A: via slaDk config-driven)', /slaDk=function\(tag\)\{ return \(cfg&&cfg\.dedupByDesigner\)/.test(grab('notifScanSla')) && /':'\+d\.finishMs/.test(grab('notifScanSla')) && !/assignedAt/.test(grab('notifScanSla')));
  console.log('\n(CORRIGIDA / GREEN)');
}

console.log('========= F3.3.76A — SLA planDueAt (' + (HAS_OP ? 'RED/errada' : 'GREEN/corrigida') + ') =========');
console.log('SRC=' + SRC_PATH);
console.log('F3.3.76A-SLA: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
