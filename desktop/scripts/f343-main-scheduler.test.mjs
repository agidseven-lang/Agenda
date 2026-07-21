#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — SCHEDULER AUTORITATIVO DE SLA no MAIN (slaScheduler.ts REAL).
 * Cobre: 6-8 amarelo visível/min/oculto · 9-11 vermelho visível/min/oculto · 12 SLA não duplica ·
 * 13 alteração de prazo reagenda · 14 conclusão cancela · 15 cancelamento cancela · 16 troca de
 * responsável muda destinatário · 17 restart reconcilia · 18 resume reconcilia · 19 unlock reconcilia.
 * Compila o slaScheduler.ts REAL; stuba electron/firebase/diag; usa slaRules.js REAL; relógio/timer/
 * seen-set/listener FAKES; roteia a entrega pelo deliverNotification REAL (main.ts) nos 3 estados.
 * ===================================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { extractDeliver } from './fixtures/f343/deliver-harness.mjs';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const REAL_SLARULES = path.join(DESK, 'src', 'main', 'slaRules.js');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

/* ── compila o slaScheduler.ts REAL ── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f343sch-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'slaScheduler.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar slaScheduler.ts:', (e.stdout || e.message || '').toString().slice(0, 800)); process.exit(1); }
const schedulerJs = path.join(tmp, 'slaScheduler.js');

/* ── stub electron/firebase/diag; ./slaRules → REAL ── */
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { app: null };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { listen: () => () => {} };
  if (request === './diag' || /[\\/]diag(\.js)?$/.test(request)) return { diag: () => {} };
  if (request === './slaRules' || /[\\/]slaRules(\.js)?$/.test(request)) return realLoad.call(this, REAL_SLARULES, arguments[1], false);
  return realLoad.apply(this, arguments);
};
const { startSlaScheduler } = require(schedulerJs);
Module._load = realLoad;

/* ── rig isolado por teste (canal/HUB seen-set próprios = sessão limpa) ── */
function newRig(uid, sharedSeen) {
  const chan = extractDeliver(MAIN);
  let NOW = 1700000000000;
  let winState = 'visible';
  let pending = null, tid = 0;
  const delivered = [], armLog = [], emitLog = [];
  const seen = sharedSeen || new Set();
  let listenCb = null;
  const sched = startSlaScheduler(() => uid, (p) => { const r = chan.deliver(winState, p); delivered.push({ dedupKey: p.dedupKey, eventType: p.eventType, channel: r.res.channel, targetUserId: p.targetUserId }); return r.res; }, {
    now: () => NOW,
    listen: (name, cb) => { if (name === 'tasks') listenCb = cb; return () => {}; },
    seen: { has: (k) => seen.has(k), add: (k) => seen.add(k) },
    setTimer: (fn, ms) => { pending = { fn, ms, id: ++tid }; return pending; },
    clearTimer: (h) => { if (pending && h && pending.id === h.id) pending = null; },
    onLog: (t, d) => { if (t === 'sla.timer.arm') armLog.push(d); if (t === 'sla.emit') emitLog.push(d); },
    safetyMaxMs: 60000,
  });
  const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
  return {
    sched, delivered, armLog, emitLog, seen,
    setWin: (w) => { winState = w; }, setNow: (n) => { NOW = n; }, now: () => NOW,
    fireSnap: (changes) => { if (listenCb) listenCb({ docChanges: () => changes }); },
    fireTimer: () => { const p = pending; if (p) { pending = null; p.fn(); } },
    lastArm: () => armLog[armLog.length - 1],
    ch,
  };
}
const MIN = 60000, HOUR = 3600000;
const cronTask = (id, uid, planDueAt, extra) => Object.assign({ id, title: 'Cronograma', client: 'Hosp', sector: 'cronograma', designerAssignment: { designerId: uid, designerName: 'Marina Dias' }, designerFlowStatus: 'afazer', designerSla: { planDueAt } }, extra || {});

/* ── 6/7/8 — AMARELO nas 3 janelas ── */
for (const [state, ch2] of [['visible', 'toast'], ['minimized', 'bg-window'], ['hidden', 'bg-window']]) {
  const r = newRig('dz1'); r.setWin(state);
  const NOW = r.now();
  r.fireSnap([r.ch('added', 'ty', cronTask('ty', 'dz1', NOW + 20 * MIN))]); // amarelo (janela 30)
  const d = r.delivered.find((x) => x.eventType === 'sla_warning');
  ok('6-8 AMARELO ' + state + ' → 1× sla_warning canal ' + ch2, !!d && d.channel === ch2 && r.delivered.length === 1);
}
/* ── 9/10/11 — VERMELHO nas 3 janelas ── */
for (const [state, ch2] of [['visible', 'toast'], ['minimized', 'bg-window'], ['hidden', 'bg-window']]) {
  const r = newRig('dz1'); r.setWin(state);
  const NOW = r.now();
  r.fireSnap([r.ch('added', 'tr', cronTask('tr', 'dz1', NOW - 5 * MIN))]); // vermelho (grace 10)
  const d = r.delivered.find((x) => x.eventType === 'sla_overdue');
  ok('9-11 VERMELHO ' + state + ' → 1× sla_overdue canal ' + ch2, !!d && d.channel === ch2 && r.delivered.length === 1);
}
/* ── 12 — SLA não duplica (mesma fronteira) ── */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'td', cronTask('td', 'dz1', NOW + 20 * MIN))]);
  const after1 = r.delivered.length;
  r.fireSnap([r.ch('modified', 'td', cronTask('td', 'dz1', NOW + 20 * MIN))]); // re-snapshot idêntico
  r.fireTimer(); r.fireTimer();                                                // re-eval de segurança
  ok('12 SLA idêntico não duplica (seen-set + dedupKey)', after1 === 1 && r.delivered.length === 1);
}
/* ── 13 — alteração de prazo REAGENDA (boundary recomputado) ── */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tc', cronTask('tc', 'dz1', NOW + 20 * MIN))]); // amarelo; boundary=overdueAt=NOW+20min
  const armA = r.lastArm().boundaryMs;
  r.fireSnap([r.ch('modified', 'tc', cronTask('tc', 'dz1', NOW + 90 * MIN))]); // novo prazo → running; boundary=warningAt=NOW+60min
  const armB = r.lastArm().boundaryMs;
  ok('13 alteração de prazo REAGENDA (boundary muda)', armA === NOW + 20 * MIN && armB === NOW + 60 * MIN && armA !== armB);
}
/* ── 14 — conclusão CANCELA (sem boundary; sem nova emissão) ── */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tk', cronTask('tk', 'dz1', NOW + 20 * MIN))]);
  const emitted = r.delivered.length;
  r.fireSnap([r.ch('modified', 'tk', cronTask('tk', 'dz1', NOW + 20 * MIN, { designerFlowStatus: 'concluido' }))]);
  ok('14 conclusão CANCELA o boundary (arm boundaryMs=0) e não reemite', r.lastArm().boundaryMs === 0 && r.delivered.length === emitted);
}
/* ── 15 — cancelamento CANCELA ── */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tx', cronTask('tx', 'dz1', NOW + 20 * MIN))]);
  const emitted = r.delivered.length;
  r.fireSnap([r.ch('modified', 'tx', cronTask('tx', 'dz1', NOW + 20 * MIN, { status: 'cancelado' }))]);
  ok('15 cancelamento CANCELA o boundary e não reemite', r.lastArm().boundaryMs === 0 && r.delivered.length === emitted);
}
/* ── 16 — troca de responsável muda o DESTINATÁRIO ── */
{
  const r1 = newRig('dz1'); const NOW = r1.now();
  r1.fireSnap([r1.ch('added', 'tw', cronTask('tw', 'dz1', NOW + 20 * MIN))]);
  const d1 = r1.delivered.length;
  r1.fireSnap([r1.ch('modified', 'tw', cronTask('tw', 'dz2', NOW + 20 * MIN))]); // reatribuída a dz2
  ok('16a após reatribuição, o designer ANTERIOR (dz1) não recebe nada novo', r1.delivered.length === d1);
  const r2 = newRig('dz2');
  r2.fireSnap([r2.ch('added', 'tw', cronTask('tw', 'dz2', NOW + 20 * MIN))]); // mesmo doc, sob a sessão dz2
  const d2 = r2.delivered.find((x) => x.eventType === 'sla_warning');
  ok('16b o NOVO designer (dz2) passa a ser o destinatário', !!d2 && d2.targetUserId === 'dz2');
}
/* ── 17 — RESTART reconcilia (entrega o vencido UMA vez; 2º restart com seen persistente não reemite) ── */
{
  const shared = new Set();
  const r1 = newRig('dz1', shared); const NOW = r1.now();
  r1.fireSnap([r1.ch('added', 'to', cronTask('to', 'dz1', NOW - 5 * MIN))]); // já vermelho na entrada
  ok('17a restart#1 (reconcile boot) entrega o vermelho vencido 1×', r1.delivered.filter((x) => x.eventType === 'sla_overdue').length === 1);
  // restart#2: novo scheduler com o MESMO seen-set persistente + mesmo doc no snapshot inicial
  const r2 = newRig('dz1', shared);
  r2.fireSnap([r2.ch('added', 'to', cronTask('to', 'dz1', NOW - 5 * MIN))]);
  ok('17b restart#2 (seen persistente) NÃO reemite o mesmo vermelho', r2.delivered.length === 0);
}
/* ── 18 — RESUME reconcilia (boundary vencido durante o sleep entregue no resume) ── */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'ts', cronTask('ts', 'dz1', NOW + 20 * MIN))]); // amarelo agora; boundary=overdue em +20min
  const before = r.delivered.length;
  r.setNow(NOW + 21 * MIN);           // "voltou do sleep" já passado o prazo (vermelho), timer NÃO rodou
  r.sched.reconcile('resume');
  const red = r.delivered.find((x) => x.eventType === 'sla_overdue');
  ok('18 RESUME reconcilia e entrega o vermelho vencido no sleep', !!red && r.delivered.length > before);
}
/* ── 19 — UNLOCK reconcilia ── */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tu', cronTask('tu', 'dz1', NOW + 20 * MIN))]);
  r.setNow(NOW + 21 * MIN);
  const before = r.delivered.length;
  r.sched.reconcile('unlock');
  ok('19 UNLOCK reconcilia e entrega o vermelho vencido', r.delivered.some((x) => x.eventType === 'sla_overdue') && r.delivered.length > before);
}
/* ── boundary timer: dispara no marco e emite (mecanismo do produtor) ── */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tb', cronTask('tb', 'dz1', NOW + 20 * MIN))]); // amarelo; boundary=NOW+20min
  const beforeRed = r.delivered.filter((x) => x.eventType === 'sla_overdue').length;
  r.setNow(NOW + 20 * MIN + 1000);   // avança até o marco vermelho
  r.fireTimer();                     // dispara o boundary timer
  ok('boundary timer dispara no marco → emite vermelho', r.delivered.filter((x) => x.eventType === 'sla_overdue').length === beforeRed + 1);
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\n===== F3.4.3 — MAIN SLA SCHEDULER (slaScheduler.ts REAL) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-SCHEDULER: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: scheduler de SLA no main divergiu do contrato'); process.exit(1); }
console.log('OK — SLA amarelo/vermelho nas 3 janelas; sem duplicar; reagenda em prazo/conclusão/cancelamento; reconcilia em restart/resume/unlock.');
