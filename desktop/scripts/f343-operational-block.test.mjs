#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — BLOQUEIO OPERACIONAL (operational_block) no MAIN — produtor único autoritativo.
 * Dirige o slaScheduler.ts REAL (compilado) + slaRules.operationalBlockFor REAL, roteando a
 * entrega pelo deliverNotification REAL (main.ts) nos 3 estados de janela. Cobre exatamente:
 *   1 designer ELEGÍVEL (papel OPERACIONAL) com tarefa em atraso crítico → 1× operational_block
 *     (título/corpo/severidade/dedupKey/deep corretos, preservando a 1.0.178);
 *   2 usuário NÃO-elegível (admin OU MANAGER 'social') → NENHUM operational_block;
 *   3 app visível  → toast · 4 minimizado → bg-window · 5 oculto (X→bandeja) → bg-window;
 *   6 sem duplicação (mesma tarefa crítica em re-avaliações/reconciles → 1 emissão; dedup canônico);
 *   7 deep link detail/<blk.id> + clique restaura/mostra a janela e abre a tarefa.
 *   + authUser()===null (papel desconhecido) → NENHUM operational_block (conservador).
 * O papel vem SOMENTE de fonte AUTENTICADA (auth.ts getAuthUser → {id,role,admin}) via opts.authUser
 * do scheduler; slaScheduler → slaRules.operationalBlockFor(tasks, authUser(), now). Relógio/timer/
 * listener/seen-set FAKES; electron/firebase/diag stubados; slaRules.js REAL.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f343ob-'));
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
const slaRules = require(REAL_SLARULES); // slaRules.js é CommonJS puro — acesso direto p/ prova de unidade

const MIN = 60000;
/* Tarefa de cronograma (crítico ON, grace 10min) em ATRASO CRÍTICO: finish 15min no passado (> grace). */
const criticalCron = (id, uid, NOW) => ({ id, title: 'Cronograma', client: 'Hosp', sector: 'cronograma',
  designerAssignment: { designerId: uid, designerName: 'Marina Dias' }, designerFlowStatus: 'afazer',
  designerSla: { planDueAt: NOW - 15 * MIN } });

/* ── rig isolado por teste: dirige o scheduler REAL e roteia a entrega pelo deliverNotification REAL ── */
function newRig(uid, authUser, sharedSeen) {
  const chan = extractDeliver(MAIN);
  let NOW = 1700000000000;
  let winState = 'visible';
  let pending = null, tid = 0;
  const delivered = [], payloads = [];
  const seen = sharedSeen || new Set();
  let listenCb = null;
  const sched = startSlaScheduler(() => uid, (p) => {
    const r = chan.deliver(winState, p);
    delivered.push({ eventType: p.eventType, dedupKey: p.dedupKey, title: p.title, body: p.body, severity: p.severity, deep: p.action && p.action.deep, targetUserId: p.targetUserId, channel: r.res.channel });
    payloads.push(p);
    return r.res;
  }, {
    now: () => NOW,
    listen: (name, cb) => { if (name === 'tasks') listenCb = cb; return () => {}; },
    seen: { has: (k) => seen.has(k), add: (k) => seen.add(k) },
    setTimer: (fn, ms) => { pending = { fn, ms, id: ++tid }; return pending; },
    clearTimer: (h) => { if (pending && h && pending.id === h.id) pending = null; },
    onLog: () => {},
    safetyMaxMs: 60000,
    authUser: () => authUser,
  });
  const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
  return {
    sched, delivered, payloads, seen,
    setWin: (w) => { winState = w; }, setNow: (n) => { NOW = n; }, now: () => NOW,
    fireSnap: (changes) => { if (listenCb) listenCb({ docChanges: () => changes }); },
    fireTimer: () => { const p = pending; if (p) { pending = null; p.fn(); } },
    ch,
    opBlocks: () => delivered.filter((d) => d.eventType === 'operational_block'),
    opPayload: () => payloads.find((p) => p.eventType === 'operational_block'),
  };
}
const OPERATIONAL = { id: 'dz1', role: 'designer', admin: false }; // papel autenticado operacional (não supervisiona)

/* ── 1 — designer ELEGÍVEL (OPERACIONAL) + tarefa em atraso crítico → 1× operational_block ── */
{
  const r = newRig('dz1', OPERATIONAL); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tc', criticalCron('tc', 'dz1', NOW))]);
  const ob = r.opBlocks();
  ok('1 designer OPERACIONAL c/ atraso crítico → EXATAMENTE 1 operational_block', ob.length === 1);
  const o = ob[0] || {};
  ok('1 título preservado 1.0.178 ("Tarefa em atraso crítico")', o.title === 'Tarefa em atraso crítico');
  ok('1 corpo preservado 1.0.178', o.body === 'Conclua ou sinalize atraso antes de continuar outras tarefas.');
  ok('1 severidade critical', o.severity === 'critical');
  ok('1 dedupKey canônico operational_block:<id>:<finishMs>', o.dedupKey === 'operational_block:tc:' + (NOW - 15 * MIN));
  ok('1 deep detail/<id>', o.deep === 'detail/tc');
  ok('1 destinatário = o designer autenticado (dz1)', o.targetUserId === 'dz1');
  // prova de UNIDADE direta (slaRules.operationalBlockFor) — coincide com o produtor real.
  const direct = slaRules.operationalBlockFor([criticalCron('tc', 'dz1', NOW)], OPERATIONAL, NOW);
  ok('1 unidade: operationalBlockFor retorna 1 payload equivalente', direct.length === 1 && direct[0].dedupKey === 'operational_block:tc:' + (NOW - 15 * MIN) && direct[0].title === 'Tarefa em atraso crítico');
}

/* ── 2 — NÃO-elegível (admin OU MANAGER 'social') → NENHUM operational_block ── */
{
  const rAdmin = newRig('dz1', { id: 'dz1', role: 'diretoria', admin: true }); const NA = rAdmin.now();
  rAdmin.fireSnap([rAdmin.ch('added', 'tc', criticalCron('tc', 'dz1', NA))]);
  ok('2a ADMIN supervisiona → NENHUM operational_block (mas sla_critical pessoal segue)', rAdmin.opBlocks().length === 0 && rAdmin.delivered.some((d) => d.eventType === 'sla_critical'));

  const rMgr = newRig('dz1', { id: 'dz1', role: 'social', admin: false }); const NM = rMgr.now();
  rMgr.fireSnap([rMgr.ch('added', 'tc', criticalCron('tc', 'dz1', NM))]);
  ok('2b MANAGER (role "social") supervisiona → NENHUM operational_block', rMgr.opBlocks().length === 0);
  ok('2 unidade: operationalBlockFor gated por canSeeAll (admin/manager ⇒ [])',
    slaRules.operationalBlockFor([criticalCron('tc', 'dz1', NM)], { id: 'dz1', role: 'x', admin: true }, NM).length === 0 &&
    slaRules.operationalBlockFor([criticalCron('tc', 'dz1', NM)], { id: 'dz1', role: 'social', admin: false }, NM).length === 0);
}

/* ── 3/4/5 — CANAL nas 3 janelas (visível→toast · minimizado/oculto→bg-window) ── */
for (const [state, canal, rot] of [['visible', 'toast', '3 app VISÍVEL'], ['minimized', 'bg-window', '4 app MINIMIZADO'], ['hidden', 'bg-window', '5 app OCULTO (X→bandeja)']]) {
  const r = newRig('dz1', OPERATIONAL); r.setWin(state); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tc', criticalCron('tc', 'dz1', NOW))]);
  const ob = r.opBlocks();
  ok(rot + ' → operational_block roteado ao canal ' + canal, ob.length === 1 && ob[0].channel === canal);
}

/* ── 6 — SEM duplicação: mesma tarefa crítica em re-eval/reconcile/snapshot → 1 emissão (dedup canônico) ── */
{
  const r = newRig('dz1', OPERATIONAL); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tc', criticalCron('tc', 'dz1', NOW))]);           // 1ª aparição → emite
  const after1 = r.opBlocks().length;
  r.fireSnap([r.ch('modified', 'tc', criticalCron('tc', 'dz1', NOW))]);         // re-snapshot idêntico
  r.sched.reconcile('resume');                                                  // reconcile de retomada
  r.sched.reconcile('unlock');                                                  // reconcile de unlock
  r.fireTimer();                                                                // re-eval de segurança (timer)
  ok('6 mesma tarefa crítica em re-avaliações/reconciles → 1 operational_block (seen-set + dedupKey)', after1 === 1 && r.opBlocks().length === 1);
}

/* ── 7 — deep link detail/<blk.id> + CLIQUE restaura/mostra a janela e abre a tarefa ── */
{
  // captura o payload REAL do operational_block (produzido pelo scheduler para um designer elegível).
  const cap = newRig('dz1', OPERATIONAL); cap.setWin('hidden'); const NOW = cap.now();
  cap.fireSnap([cap.ch('added', 'tc', criticalCron('tc', 'dz1', NOW))]);
  const opP = cap.opPayload();
  ok('7 payload carrega deep detail/<blk.id>', opP && opP.action && opP.action.deep === 'detail/tc');

  // 7a — canal BG-WINDOW (primário): openCb REAL do initBgNotify do main.ts, app MINIMIZADO.
  const m = MAIN.indexOf('initBgNotify((deep');
  const brace = MAIN.indexOf('{', MAIN.indexOf('=>', m));
  let d = 0, end = -1; for (let j = brace; j < MAIN.length; j++) { const c = MAIN[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j; break; } } }
  const body = MAIN.slice(brace, end + 1).replace(/: string/g, '');
  const runBgClick = (winState, deep) => {
    const winCalls = [], sent = [];
    const w = { isDestroyed: () => false, isMinimized: () => winState === 'minimized', restore: () => winCalls.push('restore'), show: () => winCalls.push('show'), focus: () => winCalls.push('focus'), webContents: { send: (ch, a) => sent.push([ch, a]) } };
    new Function('mainWin', 'deep', '(function(mainWin,deep)' + body + ')(mainWin,deep);')(w, deep);
    return { winCalls, sent };
  };
  const cm = runBgClick('minimized', opP.action.deep);
  ok('7a clique (bg-window, MINIMIZADO) → restore+show+focus + notif-open detail/tc',
    cm.winCalls.join(',') === 'restore,show,focus' && cm.sent[0] && cm.sent[0][0] === 'notif-open' && cm.sent[0][1] === 'detail/tc');

  // 7b — fallback NATIVO (bgOk:false): n.on('click') REAL do deliverNotification, app OCULTO.
  const chan2 = extractDeliver(MAIN);
  const rn = chan2.deliver('hidden', opP, { bgOk: false });
  ok('7b setup: caiu no fallback nativo com click handler', rn.res.channel === 'native' && rn.hadNativeClick());
  rn.fireNativeClick();
  const open = rn.sent.find((s) => Array.isArray(s) && s[0] === 'notif-open');
  ok('7b clique (nativo, OCULTO) → show+focus e abre a TAREFA certa (detail/tc)',
    rn.winCalls.indexOf('show') >= 0 && rn.winCalls.indexOf('focus') >= 0 && open && open[1] === 'detail/tc');
}

/* ── + authUser()===null (papel desconhecido) → NENHUM operational_block (conservador) ── */
{
  const r = newRig('dz1', null); const NOW = r.now();
  r.fireSnap([r.ch('added', 'tc', criticalCron('tc', 'dz1', NOW))]);
  ok('null authUser (papel não confirmado) → NENHUM operational_block (não bloqueia possível supervisor)', r.opBlocks().length === 0);
  ok('null authUser unidade: operationalBlockFor(tasks, null, now) === []', slaRules.operationalBlockFor([criticalCron('tc', 'dz1', NOW)], null, NOW).length === 0);
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\n===== F3.4.3 — OPERATIONAL BLOCK (slaScheduler + operationalBlockFor REAIS) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-OPBLOCK: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: operational_block divergiu do contrato (produtor único no main, gated por papel autenticado)'); process.exit(1); }
console.log('OK — operational_block só p/ designer OPERACIONAL em atraso crítico (admin/manager/null → nenhum); 3 janelas; sem duplicar; deep+clique abrem a tarefa.');
