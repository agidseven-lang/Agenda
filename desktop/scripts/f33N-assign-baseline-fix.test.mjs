#!/usr/bin/env node
/* =====================================================================
 * F3.3.17-R4 — PROVA do BUG (antigo) e da CORREÇÃO (novo) do baseline da notificação
 * de atribuição (Social → Designer).
 *
 * Executa o CÓDIGO-FONTE REAL (sem reimplementar) em sequências de snapshots reais, com o
 * notifEmit + dedup PERSISTENTE REAIS:
 *   - ANTIGO  = gate por horário `at < _notifAssignSince` (relógio de quem lê) → SUPRIME
 *     atribuição nova sob clock-skew.
 *   - NOVO    = SEMEIA histórico na 1ª varredura e notifica só transições por dedup → robusto
 *     a clock-skew.
 *
 * -----------------------------------------------------------------------------
 * F3.4.3C — reescrito para o contrato produtor-único-no-main (substitui o contrato antigo;
 * histórico no Git). A correção do baseline (semente no 1º snapshot + detecção por TRANSIÇÃO,
 * sem comparar relógios) migrou do RENDERER para o PROCESSO MAIN (notifier.ts), que é o produtor
 * ÚNICO e autoritativo da azul e sobrevive à janela oculta. Aqui provamos, EXECUTANDO o
 * notifier.ts REAL (compilado): (1) o antigo gate por horário suprime — modelado — vs (2) o main
 * dispara a MESMA atribuição sob clock-skew; semente do 1º snapshot; transição/dedupe/reatribuição;
 * anti-eco; payload ator=Social/responsável=Designer; roteamento pelo deliverNotification (toast/
 * bg-window); generalidade (qualquer Social/Designer). Renderer NÃO emite mais atribuição.
 * Read-only; não grava produto; não builda.
 * ===================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { extractDeliver } from './fixtures/f343/deliver-harness.mjs';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const NOTIFIER = fs.readFileSync(path.join(DESK, 'src', 'main', 'notifier.ts'), 'utf8');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');

let pass = 0, fail = 0; const errs = [];
const ok = (n, c) => { if (c) pass++; else { fail++; errs.push('FAIL: ' + n); } };

/* atores */
const SOCIAL = { id: 'sm_ary', name: 'Arydyjany Carlôto', photo: 'https://img/ary.jpg' };
const DESIGNER = { id: 'dz_mier', name: 'Miercohévisk Nascimento', photo: 'https://img/mier.jpg' };
const READER_NOW = 1_700_000_000_000;
const AT_LIVE = READER_NOW + 30_000;      // atribuição ao vivo, relógios coerentes
const AT_SKEW = READER_NOW - 200_000;     // MESMA atribuição ao vivo, mas relógio da Social atrasado ~3min

function taskAssigned(at, by = SOCIAL.id, designerId = DESIGNER.id) {
  return { title: 'Carrossel Junho', client: 'Cliente X', sector: 'cronograma', by: SOCIAL.id, assigneeId: designerId, assignee: DESIGNER.name,
    designerAssignment: { designerId, designerName: DESIGNER.name, designerAvatar: DESIGNER.photo, assignedAt: at, assignedBy: by, assignedByName: (by === SOCIAL.id ? SOCIAL.name : ''), assignedByAvatar: (by === SOCIAL.id ? SOCIAL.photo : ''), status: 'sent' } };
}

/* ── compila o notifier.ts REAL; stub electron/firebase com captura POR-INSTÂNCIA ── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f33n-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'notifier.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar notifier.ts:', (e.stdout || e.message || '').toString().slice(0, 500)); process.exit(1); }
let curCapture = [];
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { BrowserWindow: class {} };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { db: {}, listen: (name, cb) => { curCapture.push([name, cb]); return () => {}; } };
  if (request === './slaRules' || /[\\/]slaRules(\.js)?$/.test(request)) return realLoad.call(this, path.join(DESK, 'src', 'main', 'slaRules.js'), arguments[1], false); // F3.4.7 harness fix: notifier.ts passou a require('./slaRules') na F3.4.4 (mock ausente desde 1.0.181)
  return realLoad.apply(this, arguments);
};
const { startNotifier } = require(path.join(tmp, 'notifier.js'));
Module._load = realLoad;

/* rig do notifier.ts REAL: instância isolada com seu próprio listener e captura de entregas */
function mkNotifier(uid) {
  curCapture = [];
  const delivered = [];
  startNotifier(() => ({}), uid, (p) => { delivered.push(p); return { ok: true, channel: 'x' }; });
  const cbs = curCapture.filter(([n]) => n === 'tasks').map(([, cb]) => cb);
  const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
  return { delivered, fire: (changes) => cbs.forEach((cb) => { try { cb({ docChanges: () => changes }); } catch (_) {} }), ch };
}

/* ===== 1) BUG ANTIGO (modelado): gate por horário suprime atribuição AO VIVO sob clock-skew ===== */
{
  const sinceMs = READER_NOW;                 // baseline do relógio de quem lê (antigo _notifAssignSince)
  const oldGate = (at) => (at >= sinceMs);    // antigo: só dispara se assignedAt >= sinceMs
  ok('[1] BUG (antigo): gate por horário SUPRIME atribuição nova sob clock-skew (at<sinceMs)', oldGate(AT_SKEW) === false);
}
/* ===== 2) CORREÇÃO no MAIN: a MESMA atribuição sob clock-skew DISPARA (transição, sem gate) ===== */
let livePayload = null;
{
  const r = mkNotifier(DESIGNER.id);
  r.fire([r.ch('added', 't1', { title: 'Carrossel Junho', client: 'Cliente X', sector: 'cronograma', by: SOCIAL.id })]); // 1º snapshot (sem atribuição) → seed
  r.fire([r.ch('modified', 't1', taskAssigned(AT_SKEW))]);   // atribuição AO VIVO, carimbo atrasado
  ok('[2] FIX (main): notifier.ts REAL DISPARA a atribuição mesmo sob clock-skew (1×)', r.delivered.length === 1);
  livePayload = r.delivered[0] || null;
}
/* ===== 3) 1º snapshot SEMEIA: atribuição já presente no 1º snapshot NÃO dispara ===== */
{
  const r = mkNotifier(DESIGNER.id);
  r.fire([r.ch('added', 't1', taskAssigned(AT_LIVE))]);      // já existia no 1º snapshot → histórico (seed)
  ok('[3] SEED: atribuição presente no 1º snapshot é semeada (0)', r.delivered.length === 0);
}
/* ===== 4) atribuição NOVA ao vivo (relógios coerentes) dispara 1x ===== */
{
  const r = mkNotifier(DESIGNER.id);
  r.fire([r.ch('added', 't1', { title: 'Carrossel Junho', client: 'X', sector: 'cronograma', by: SOCIAL.id })]);
  r.fire([r.ch('modified', 't1', taskAssigned(AT_LIVE))]);
  ok('[4] NOVA: atribuição ao vivo dispara (1)', r.delivered.length === 1);
}
/* ===== 5) DEDUPE: re-scan do MESMO estado não dispara de novo ===== */
{
  const r = mkNotifier(DESIGNER.id);
  r.fire([r.ch('added', 't1', { title: 'X', sector: 'cronograma', by: SOCIAL.id })]);
  r.fire([r.ch('modified', 't1', taskAssigned(AT_LIVE))]);   // dispara
  r.fire([r.ch('modified', 't1', taskAssigned(AT_LIVE))]);   // re-scan idêntico
  ok('[5] DEDUPE: re-scan do mesmo estado não duplica (total 1)', r.delivered.length === 1);
}
/* ===== 6) REATRIBUIÇÃO (novo assignedAt) dispara; mesma chave antiga não ===== */
{
  const r = mkNotifier(DESIGNER.id);
  r.fire([r.ch('added', 't1', { title: 'X', sector: 'cronograma', by: SOCIAL.id })]);
  r.fire([r.ch('modified', 't1', taskAssigned(AT_LIVE))]);            // 1ª → dispara
  r.fire([r.ch('modified', 't1', taskAssigned(AT_LIVE + 90_000))]);  // reatribuição (novo at) → dispara
  ok('[6] REATRIBUIÇÃO: novo assignedAt dispara (total 2)', r.delivered.length === 2 && r.delivered[1].dedupKey === 'designer_assigned:t1:' + DESIGNER.id + ':' + (AT_LIVE + 90_000));
}
/* ===== 7) ANTI-ECO: o AUTOR (Social) não recebe; auto-atribuição não dispara ===== */
{
  const rs = mkNotifier(SOCIAL.id);
  rs.fire([rs.ch('added', 't1', { title: 'X', sector: 'cronograma', by: SOCIAL.id })]);
  rs.fire([rs.ch('modified', 't1', taskAssigned(AT_LIVE))]);          // designerId=Designer ≠ Social
  ok('[7a] ANTI-ECO: a SOCIAL (autora) NÃO recebe (0)', rs.delivered.length === 0);
  const r2 = mkNotifier(DESIGNER.id);
  r2.fire([r2.ch('added', 't1', { title: 'X', sector: 'cronograma', by: SOCIAL.id })]);
  r2.fire([r2.ch('modified', 't1', taskAssigned(AT_LIVE, DESIGNER.id))]); // assignedBy=designer (auto)
  ok('[7b] ANTI-ECO: auto-atribuição (assignedBy===me) não dispara', r2.delivered.length === 0);
}
/* ===== 8) PAYLOAD: ator = Social, responsável = Designer ===== */
{
  const p = livePayload || {};
  ok('[8] payload eventType=designer_assigned', p.eventType === 'designer_assigned');
  ok('[8] payload actorId = Social', p.actorId === SOCIAL.id);
  ok('[8] payload actorName = Social', p.actorName === SOCIAL.name);
  ok('[8] payload responsibleId = Designer', p.responsibleId === DESIGNER.id);
  ok('[8] payload responsibleName = Designer', p.responsibleName === DESIGNER.name);
  ok('[8] payload targetUserId = Designer', p.targetUserId === DESIGNER.id);
  ok('[8] payload dedupKey designer_assigned:t1:<designerId>:' + AT_SKEW + ' (canônico)', p.dedupKey === 'designer_assigned:t1:' + DESIGNER.id + ':' + AT_SKEW);
  ok('[8] payload título "<Social> atribuiu uma tarefa"', /atribuiu uma tarefa/.test(p.title || '') && (p.title || '').indexOf(SOCIAL.name) === 0);
  ok('[8] payload deep = detail/t1 (abre a TAREFA)', p.action && p.action.deep === 'detail/t1');
}
/* ===== 9) HUB do main (deliverNotification REAL) roteia por janela: visível→toast, oculta→bg-window ===== */
{
  const chan = extractDeliver(MAIN);
  const vis = chan.deliver('visible', livePayload);
  const chan2 = extractDeliver(MAIN);
  const hid = chan2.deliver('hidden', livePayload);
  ok('[9] HUB: janela VISÍVEL → canal toast', vis.res.channel === 'toast' && vis.sent.some((s) => (Array.isArray(s) ? s[0] : s) === 'notif-toast'));
  ok('[9] HUB: janela OCULTA → janela premium bg-window', hid.res.channel === 'bg-window' && hid.bg.length === 1);
}
/* ===== 10) RENDERER não emite mais atribuição (produtor único no main) ===== */
{
  ok('[10] renderer: notifScan só roda o fluxo; notifScanAssign DEFINIDO mas SEM chamadores', /function notifScan\(\)\{\}/.test(HTML) && (HTML.match(/notifScanAssign\(\)/g) || []).length === 1);
  ok('[10] notifier: detecção por TRANSIÇÃO no MAIN (changed = designer novo OU novo assignedAt)', /const changed = \(prev !== cur\) \|\| \(at !== prevAt\);/.test(NOTIFIER));
}
/* ===== 11) GENERALIDADE — vale p/ qualquer Social/Designer (IDs/nomes/unicode), sem hardcode ===== */
{
  const COMBOS = [
    { s: { id: 'u_001', name: 'João da Silva', photo: 'a.jpg' }, d: { id: 'u_777', name: 'Zoé Müller', photo: 'b.jpg' } },
    { s: { id: 'X1', name: '社交媒体运营', photo: '' }, d: { id: 'Y2', name: 'Designer 测试', photo: 'p.png' } },
    { s: { id: 'admin-42', name: "O'Brien & Co.", photo: 'x' }, d: { id: 'dz.9', name: 'Ana-Lúcia Çörner', photo: 'y' } },
  ];
  let genOk = true, why = '';
  for (const c of COMBOS) {
    const mk = (at, by) => ({ title: 'T', client: 'C', sector: 'cronograma', by: c.s.id, assigneeId: c.d.id, designerAssignment: { designerId: c.d.id, designerName: c.d.name, designerAvatar: c.d.photo, assignedAt: at, assignedBy: by, assignedByName: c.s.name, assignedByAvatar: c.s.photo } });
    const rd = mkNotifier(c.d.id); rd.fire([rd.ch('added', 'tk', { title: 'T', sector: 'cronograma', by: c.s.id })]); rd.fire([rd.ch('modified', 'tk', mk(AT_SKEW, c.s.id))]);
    const p = rd.delivered[0] || {};
    const rs = mkNotifier(c.s.id); rs.fire([rs.ch('added', 'tk', { title: 'T', sector: 'cronograma', by: c.s.id })]); rs.fire([rs.ch('modified', 'tk', mk(AT_SKEW, c.s.id))]);
    if (!(rd.delivered.length === 1 && p.actorId === c.s.id && p.responsibleId === c.d.id && p.targetUserId === c.d.id && rs.delivered.length === 0)) { genOk = false; why = c.s.id + '→' + c.d.id + ' rd=' + rd.delivered.length + ' rs=' + rs.delivered.length; break; }
  }
  ok('[11] GENERALIDADE: dispara p/ QUALQUER Social/Designer (unicode/IDs), sem eco à Social' + (genOk ? '' : ' ' + why), genOk);
  ok('[11] fonte do fix (notifier.ts) sem nomes/IDs hardcoded de pessoas reais', !/Arydyjany|Miercohé|sm_ary|dz_mier/.test(NOTIFIER));
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\n==== F3.3.17-R4 (F3.4.3C) — baseline/transição da azul, agora NO MAIN ====');
if (errs.length) console.log('\n' + errs.join('\n') + '\n');
console.log('[1] antigo gate por horário           : SUPRIME (bug modelado)');
console.log('[2] notifier.ts REAL sob clock-skew    : DISPARA (corrigido no main)');
console.log('[3-6] seed/nova/dedupe/reatribuição    : contrato de transição no main');
console.log('[7] anti-eco                            : Social não recebe; auto-atribuição não dispara');
console.log('[8] payload                             : ator=Social, responsável=Designer, dedupKey canônico');
console.log('[9] HUB deliverNotification             : visível→toast, oculta→bg-window');
console.log('[10] renderer                           : NÃO emite mais atribuição (produtor único no main)');
console.log('[11] generalidade                       : qualquer Social/Designer (sem hardcode)');
console.log('\n' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: prova do baseline/transição no main falhou'); process.exit(1); }
console.log('OK — a correção do baseline (semente + transição, sem comparar relógios) vive NO MAIN (notifier.ts), produtor único autoritativo da azul; renderer só-visual.');
