#!/usr/bin/env node
/* =====================================================================
 * F3.3.19-G-INC01-A — GRACE pós-atribuição para o alerta SLA LARANJA (sla_warning).
 * READ-ONLY sobre index.html: executa o notifScanSla REAL (com resolveTaskDisplayState/
 * slaPanelFinishMs/slaPanelDelivered reais) e CAPTURA os notifEmit, provando:
 *   - atribuição com prazo <= 30min NÃO dispara o laranja dentro do grace (2 min);
 *   - após o grace (assignedAt mais antigo) o laranja dispara normal;
 *   - tarefa antiga perto do prazo (sem atribuição recente) dispara normal;
 *   - VERMELHO/atraso (sla_overdue) NÃO é afetado pelo grace;
 *   - dedupKey do SLA inalterado; ramo warning é o ÚNICO com o guard.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33Q-sla-assign-grace.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

function grab(n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '=');
  if (a < 0) a = HTML.indexOf('const ' + n + ' =');
  if (a < 0) throw new Error('não encontrei: ' + n);
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  throw new Error('sem fim: ' + n);
}
const NAMES = ['notifScanSla', 'resolveTaskDisplayState', 'slaPanelFinishMs', 'slaPanelDelivered'];
let SRC = ''; for (const n of NAMES) SRC += grab(n) + '\n';

// Constantes (var — não extraíveis pelo grab): definidas aqui com os MESMOS valores do source,
// e provadas por asserção de fonte abaixo.
const PRELUDE =
  'var SLA_PANEL_WARN_MS=30*60000, SLA_PANEL_GRACE_MS=10*60000, SLA_ASSIGNMENT_GRACE_MS=2*60000;\n' +
  'var CAP=[]; var __TASKS=[]; var state={user:{id:"dz1"}};\n' +
  'function slaibVisible(u){return __TASKS;}\n' +
  'function resolveNotificationTargets(o){return {shouldNotifyCurrentUser:true};}\n' +
  'function notifResponsible(t){return {id:"dz1",name:"Designer Teste",avatar:""};}\n' +
  'function notifBuildPayload(p){return p;}\n' +
  'function notifEmit(p){CAP.push(p);}\n' +
  'function slaibFmtHM(ms){return "16:15";}\n' +
  'function slaCount(ms){return "27:16";}\n' +
  'function slaElapsed(ms){return "5:00";}\n' +
  'function slaCriticalFor(u){return null;}\n' +
  'function first(s){return (s||"").split(" ")[0];}\n' +
  'function dtMs(){return 0;}\n' +
  'function secOf(s){return {key:(s==="cronograma"?"cronograma":"outro")};}\n';
const R = new Function(PRELUDE + SRC +
  '\n; return { notifScanSla, cap:function(){return CAP;}, setTasks:function(a){__TASKS=a;} };')();

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

const NOW = Date.now();
const MIN = 60000;
const task = (assignedAt, finishMs, dfs) => ({
  id: 't1', title: 'Post', client: 'Cliente X', sector: 'cronograma',
  designerAssignment: { designerId: 'dz1', assignedAt: assignedAt },
  designerFlowStatus: (dfs || 'afazer'),
  designerSla: { planDueAt: finishMs },
});
// roda notifScanSla com 1 tarefa e devolve a lista de eventTypes emitidos
const emit = (t) => { R.cap().length = 0; R.setTasks([t]); R.notifScanSla(); return R.cap().map(p => p.eventType); };

/* ===== 0) ASSERÇÕES DE FONTE (a correção está no código, confinada ao warning) ===== */
const SRC_scan = grab('notifScanSla');
ok('[src] constante SLA_ASSIGNMENT_GRACE_MS=2*60000 existe', /SLA_ASSIGNMENT_GRACE_MS=2\*60000/.test(HTML));
ok('[src] SLA_PANEL_WARN_MS=30*60000 inalterado', /SLA_PANEL_WARN_MS=30\*60000/.test(HTML));
ok('[src] guard de grace usa designerAssignment.assignedAt + SLA_ASSIGNMENT_GRACE_MS',
  /designerAssignment&&t\.designerAssignment\.assignedAt/.test(SRC_scan) && /now-_aAt\)<SLA_ASSIGNMENT_GRACE_MS/.test(SRC_scan));
ok('[src] guard envolve SOMENTE o emit do laranja (if(!_inGrace) antes do sla_warning)',
  /if\(!_inGrace\)\{[\s\S]*eventType:'sla_warning'/.test(SRC_scan));
ok('[src] ramo overdue/critical NÃO usa _inGrace (vermelho não suprimido)', (() => {
  const i = SRC_scan.indexOf("else if(d.state==='overdue')");
  return i > 0 && SRC_scan.slice(i).indexOf('_inGrace') < 0;
})());
ok('[src] dedupKeys do SLA inalterados', /dedupKey:'sla_warning:'\+t\.id\+':'\+d\.finishMs/.test(SRC_scan) && /dedupKey:'sla_overdue:'\+t\.id/.test(SRC_scan) && /dedupKey:'sla_critical:'\+t\.id/.test(SRC_scan));
ok('[src] notifScanAssign (R4) intocado — sem grace de SLA lá', (() => { const a = grab('notifScanAssign'); return a.includes('notifAssignKeyOf') && !a.includes('SLA_ASSIGNMENT_GRACE_MS'); })());

/* ===== 1) RUNTIME — comportamento do grace no notifScanSla REAL ===== */
// S1: atribuição NOVA (30s atrás) + prazo a 27min (dentro da janela de 30min) → laranja SUPRIMIDO
const s1 = emit(task(NOW - 30000, NOW + 27 * MIN));
ok('S1: atribuição recente (<2min) + prazo<=30min → NÃO emite sla_warning (só azul de atribuição vem do notifScanAssign)', !s1.includes('sla_warning'));

// S2: mesma tarefa, mas atribuída há 3min (> grace 2min) → laranja DISPARA
const s2 = emit(task(NOW - 3 * MIN, NOW + 27 * MIN));
ok('S2: após o grace (assignedAt 3min) + prazo<=30min → emite sla_warning', s2.includes('sla_warning'));

// S3a: tarefa ANTIGA (atribuída há 1h) entrando na janela → laranja DISPARA (não afetado)
const s3a = emit(task(NOW - 60 * MIN, NOW + 20 * MIN));
ok('S3a: tarefa antiga perto do prazo → emite sla_warning (SLA normal intacto)', s3a.includes('sla_warning'));
// S3b: tarefa SEM assignedAt (0) perto do prazo → laranja DISPARA (grace só vale c/ atribuição recente)
const s3b = emit(task(0, NOW + 20 * MIN));
ok('S3b: sem assignedAt + perto do prazo → emite sla_warning', s3b.includes('sla_warning'));

// S4: atribuição NOVA (30s) MAS já ATRASADA (prazo 5min no passado) → VERMELHO dispara (grace não afeta)
const s4 = emit(task(NOW - 30000, NOW - 5 * MIN));
ok('S4: atraso com atribuição recente → emite sla_overdue (vermelho NÃO suprimido)', s4.includes('sla_overdue') && !s4.includes('sla_warning'));

// S5: fora da janela (prazo daqui a 2h) → nada (nem laranja)
const s5 = emit(task(NOW - 30000, NOW + 120 * MIN));
ok('S5: prazo distante (>30min) → não emite SLA (running)', !s5.includes('sla_warning') && !s5.includes('sla_overdue'));

/* ===== 2) MATRIZ legível ===== */
const row = (lbl, evs) => '  ' + lbl.padEnd(46) + ' -> [' + evs.join(',') + ']';
console.log('\n========= F3.3.19-G-INC01-A — GRACE pós-atribuição (notifScanSla real) =========');
console.log(row('atribuição 30s + prazo 27min (DENTRO grace)', s1));
console.log(row('atribuição 3min + prazo 27min (pós-grace)', s2));
console.log(row('tarefa antiga 1h + prazo 20min', s3a));
console.log(row('sem assignedAt + prazo 20min', s3b));
console.log(row('atribuição 30s + ATRASADA 5min (vermelho)', s4));
console.log(row('atribuição 30s + prazo 2h (distante)', s5));
console.log('================================================================================\n');

console.log('F3.3.19-G-INC01-A sla-assign-grace: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
