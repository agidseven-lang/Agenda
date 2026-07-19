#!/usr/bin/env node
/* =====================================================================
 * F3.3.76A — SLA do Designer em tempo real (laranja 30 / vermelho 10),
 * ancorado na ATRIBUIÇÃO (assignedAt+30 / +10). SELF-ADAPTING (RED×GREEN)
 * + matriz de contrato (FASE 10, itens de EMISSÃO — os testáveis por extração;
 * UI/nativa/clique 26-33 são prova FÍSICA, FASE 13).
 *
 * Executa o notifScanSla REAL (com designerOpSla/resolveTaskDisplayState/
 * slaPanelFinishMs/slaPanelDelivered/resolveNotificationTargets reais) e
 * captura os notifEmit.
 *   • fonte SEM designerOpSla  → BASELINE (1.0.175) → prova o BUG (RED).
 *   • fonte COM designerOpSla  → CORRIGIDA → prova o contrato (GREEN).
 *
 * Rodar: /opt/node22/bin/node desktop/scripts/f3376a-sla-red.test.mjs
 *   SRC=<outro index.html> força outra fonte (ex.: baseline p/ RED).
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = process.env.SRC || path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const HTML = fs.readFileSync(SRC_PATH, 'utf8');
const HAS_FIX = /function designerOpSla\(/.test(HTML);

function grab(n) {
  let a = HTML.indexOf('function ' + n + '(');
  if (a < 0) throw new Error('não encontrei: ' + n);
  let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } }
  throw new Error('sem fim: ' + n);
}
const BASE_NAMES = ['notifScanSla', 'resolveTaskDisplayState', 'slaPanelFinishMs', 'slaPanelDelivered', 'resolveNotificationTargets'];
const NAMES = HAS_FIX ? ['designerOpSla', ...BASE_NAMES] : BASE_NAMES;
let SRC = ''; for (const n of NAMES) SRC += grab(n) + '\n';

const PRELUDE =
  'var SLA_PANEL_WARN_MS=30*60000, SLA_PANEL_GRACE_MS=10*60000, SLA_ASSIGNMENT_GRACE_MS=2*60000;\n' +
  'var SLA_OP_DEADLINE_MS=30*60000, SLA_OP_GRACE_MS=10*60000;\n' +
  'var CAP=[]; var __TASKS=[]; var state={user:{id:"dz1"}};\n' +
  'function slaibVisible(u){return __TASKS;}\n' +
  'function notifResponsible(t){var da=(t&&t.designerAssignment)||{};return {id:da.designerId||"dz1",name:"Designer Teste",avatar:""};}\n' +
  'function notifBuildPayload(p){return p;}\n' +
  'function notifEmit(p){CAP.push(p);}\n' +
  'function slaibFmtHM(ms){return "16:15";}\n' +
  'function slaCount(ms){return "27:16";}\n' +
  'function slaElapsed(ms){return "5:00";}\n' +
  'function slaCriticalFor(u){return null;}\n' +
  'function first(s){return (s||"").split(" ")[0];}\n' +
  'function dtMs(){return 0;}\n' +
  'function secOf(s){return {key:(s==="cronograma"?"cronograma":(s==="roteiro"?"roteiro":(s==="edicao"?"edicao":"outro")))};}\n';
const R = new Function(PRELUDE + SRC +
  '\n; return { notifScanSla, cap:function(){return CAP;}, setTasks:function(a){__TASKS=a;}, setUser:function(u){state.user=u;} };')();

const NOW = Date.now(), MIN = 60000, DAY = 86400000;
const task = (o) => Object.assign({
  id: 't1', title: 'Cronograma semanal', client: 'Hospital Visão', sector: 'cronograma',
  designerAssignment: { designerId: 'dz1', assignedAt: NOW, assignedBy: 'soc1' },
  designerFlowStatus: 'afazer', designerSla: { planDueAt: NOW + 3 * DAY },
}, o || {});
// roda notifScanSla p/ 1 tarefa vista pelo usuário `uid`; devolve os payloads capturados.
const run = (t, uid) => { R.cap().length = 0; R.setUser({ id: uid || 'dz1' }); R.setTasks([t]); R.notifScanSla(); return R.cap().slice(); };
const evs = (t, uid) => run(t, uid).map(p => p.eventType);

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

/* patch de designerAssignment mantendo o resto */
const withDa = (o, extra) => task(Object.assign({}, o, { designerAssignment: Object.assign({ designerId: 'dz1', assignedAt: NOW, assignedBy: 'soc1' }, (o && o.designerAssignment) || {}, extra || {}) }));

if (!HAS_FIX) {
  /* ===================== BASELINE — RED (bug reproduzido) ===================== */
  const A = evs(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW, assignedBy: 'soc1' } }), 'dz1');
  const B = evs(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW - 31 * MIN, assignedBy: 'soc1' } }), 'dz1');
  const C = evs(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW - 3 * MIN, assignedBy: 'soc1' }, designerSla: { planDueAt: NOW + 27 * MIN } }), 'dz1');
  ok('RED-A: atribuição agora + término default (+3d) → NÃO emite laranja (BUG)', !A.includes('sla_warning'));
  ok('RED-A2: idem → NÃO emite vermelho', !A.includes('sla_overdue'));
  ok('RED-B: 31min após atribuição + término +3d → NÃO emite vermelho (ancorado no prazo planejado)', !B.includes('sla_overdue') && !B.includes('sla_warning'));
  ok('CTRL-C: com término curto (27min) a cadeia emite laranja → quebra é a ÂNCORA, não o disparo/entrega', C.includes('sla_warning'));
  console.log('\n(BASELINE / RED) A=' + JSON.stringify(A) + ' B=' + JSON.stringify(B) + ' C=' + JSON.stringify(C));
} else {
  /* ===================== CORRIGIDA — GREEN (contrato FASE 3-6) ===================== */
  // --- LARANJA (SLA inicial) ---
  const y1 = run(task(), 'dz1');
  ok('Y1: atribuição AGORA → laranja imediato (independe do término planejado)', y1.map(p => p.eventType).includes('sla_warning'));
  ok('Y2: só o DESIGNER correto recebe (dz2 não recebe)', !evs(task(), 'dz2').includes('sla_warning'));
  ok('Y3: Social/autor (soc1) NÃO recebe', !evs(task(), 'soc1').includes('sla_warning'));
  const yWarn = y1.find(p => p.eventType === 'sla_warning') || {};
  ok('Y4: texto canônico exato (30 min)', yWarn.body === 'Você tem 30 minutos para concluir esta tarefa.');
  ok('Y5: cor/severidade = warning (laranja)', yWarn.severity === 'warning');
  ok('Y6: dedupKey estável = taskId+designerId+assignedAt+deadline_30', yWarn.dedupKey === 'sla_warning:t1:dz1:' + NOW + ':deadline_30');
  const yReassign = run(withDa({}, { designerId: 'dz1', assignedAt: NOW + 5 * MIN }), 'dz1').find(p => p.eventType === 'sla_warning') || {};
  ok('Y7: reatribuição (novo assignedAt) → dedupKey NOVO', yReassign.dedupKey === 'sla_warning:t1:dz1:' + (NOW + 5 * MIN) + ':deadline_30');
  ok('Y8: ROTEIRO NÃO gera laranja', !evs(task({ sector: 'roteiro' }), 'dz1').includes('sla_warning'));
  ok('Y9: CRONOGRAMA gera laranja', evs(task({ sector: 'cronograma' }), 'dz1').includes('sla_warning'));
  ok('Y10: EDIÇÃO DE MÍDIA gera laranja', evs(task({ sector: 'edicao' }), 'dz1').includes('sla_warning'));
  ok('Y11: sem designer (sem designerId) → nada', evs(task({ designerAssignment: { assignedAt: NOW } }), 'dz1').length === 0);

  // --- VERMELHO (prazo ultrapassado) ---
  const before = evs(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW, assignedBy: 'soc1' } }), 'dz1');
  ok('R12: antes do prazo (atribuição agora) → NÃO emite vermelho', !before.includes('sla_overdue'));
  const rOver = run(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW - 31 * MIN, assignedBy: 'soc1' } }), 'dz1');
  ok('R13: 31min após atribuição (assignedAt+30 ultrapassado) → emite vermelho', rOver.map(p => p.eventType).includes('sla_overdue'));
  const rBody = rOver.find(p => p.eventType === 'sla_overdue') || {};
  ok('R14: texto canônico exato (10 min)', rBody.body === 'Você tem 10 minutos para concluir esta tarefa.');
  ok('R15: cor/severidade = critical (vermelho)', rBody.severity === 'critical');
  ok('R16: só o DESIGNER correto recebe o vermelho', !evs(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW - 31 * MIN } }), 'dz2').includes('sla_overdue'));
  ok('R17: dedupKey vermelho = taskId+designerId+deadlineAt+overdue_10', rBody.dedupKey === 'sla_overdue:t1:dz1:' + (NOW - 31 * MIN + SLA_OP_DEADLINE()) + ':overdue_10');
  ok('R18: tarefa CONCLUÍDA (designerFlowStatus=concluido) → não gera', evs(task({ designerFlowStatus: 'concluido', designerAssignment: { designerId: 'dz1', assignedAt: NOW - 31 * MIN } }), 'dz1').length === 0);
  ok('R19: tarefa CANCELADA (status=cancelado) → não gera', evs(task({ status: 'cancelado', designerAssignment: { designerId: 'dz1', assignedAt: NOW - 31 * MIN } }), 'dz1').length === 0);
  ok('R20: designer SUBSTITUÍDO (agora dz2) → dz1 não recebe', !evs(task({ designerAssignment: { designerId: 'dz2', assignedAt: NOW } }), 'dz1').includes('sla_warning'));

  // --- PERSISTÊNCIA / reconstrução ---
  ok('P21: reconstrói SÓ do assignedAt persistido (sem campo de prazo) → laranja', run(task({ designerSla: undefined }), 'dz1').map(p => p.eventType).includes('sla_warning'));
  ok('P23: suspensão/retomada — assignedAt há 35min (dentro da tolerância) → detecta atraso (vermelho)', evs(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW - 35 * MIN } }), 'dz1').includes('sla_overdue'));
  ok('P23b: assignedAt há 45min (esgotada a tolerância de 10min) → escalona p/ crítico', evs(task({ designerAssignment: { designerId: 'dz1', assignedAt: NOW - 45 * MIN } }), 'dz1').includes('sla_critical'));
  ok('P24: alteração irrelevante NÃO muda o dedupKey (mesmo assignedAt)', (run(task({ title: 'X' }), 'dz1').find(p => p.eventType === 'sla_warning') || {}).dedupKey === 'sla_warning:t1:dz1:' + NOW + ':deadline_30');

  // --- PRESERVAÇÕES (card/painel intocados) ---
  ok('PR34: Roteiro sem SLA (designerOpSla exclui roteiro)', !evs(task({ sector: 'roteiro', designerAssignment: { designerId: 'dz1', assignedAt: NOW - 31 * MIN } }), 'dz1').length);
  ok('PR-src1: resolveTaskDisplayState (card) NÃO referencia designerOpSla/SLA_OP (card intocado)', (() => { const s = grab('resolveTaskDisplayState'); return !/designerOpSla|SLA_OP_/.test(s); })());
  ok('PR-src2: slaPanelFinishMs (prazo do card) segue por planDueAt (intocado)', /planDueAt/.test(grab('slaPanelFinishMs')) && !/SLA_OP_/.test(grab('slaPanelFinishMs')));
  ok('PR-src3: designerOpSla exclui roteiro e ancora em assignedAt+SLA_OP_DEADLINE_MS', (() => { const s = grab('designerOpSla'); return /key==='roteiro'\)\s*return null/.test(s) && /assignedAt\+SLA_OP_DEADLINE_MS/.test(s); })());
  ok('PR-src4: textos canônicos presentes na fonte', /Você tem 30 minutos para concluir esta tarefa\./.test(HTML) && /Você tem 10 minutos para concluir esta tarefa\./.test(HTML));
  ok('PR-src5: dedupKeys novos presentes (deadline_30 / overdue_10)', /:deadline_30'/.test(HTML) && /:overdue_10'/.test(HTML));

  function SLA_OP_DEADLINE() { return 30 * 60000; }
  console.log('\n(CORRIGIDA / GREEN)');
}

console.log('\n========= F3.3.76A — SLA designer (' + (HAS_FIX ? 'GREEN/corrigida' : 'RED/baseline') + ') =========');
console.log('SRC=' + SRC_PATH);
console.log('F3.3.76A-SLA: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
