#!/usr/bin/env node
/* =====================================================================================
 * F3.4.7 — ENTREGA VISUAL IMEDIATA (amarela/vermelha) — suíte de causa-raiz e correção.
 * -------------------------------------------------------------------------------------
 * Executa o código REAL (compilado com o tsc do projeto, mesmo padrão f3377a-r3):
 *   A) firebase.ts listen() — AUTO-CURA: o SDK ENCERRA o listener quando o callback de
 *      erro dispara; sem re-attach o mapa de tasks congela e NENHUMA amarela/vermelha é
 *      emitida em NENHUM estado de janela (RC1). Prova o backoff 5s→60s + reset + teardown.
 *   B) bgNotify.ts — PROVA DE RENDER: bgnotify-rendered vira ACK; sem ACK no prazo, o
 *      fallback (onNoRender) dispara — a entrega em minimizado/bandeja deixa de ser
 *      OTIMISTA (RC2).
 *   C) main.ts deliverNotification — dedupe do HUB gravado SÓ após canal aceitar; falha
 *      total não bloqueia a transição para sempre (RC3). Provas de fonte.
 *   D) slaScheduler.ts — seen persistente gravado SÓ com {ok:true}; {ok:false} reentrega
 *      no próximo eval (RC3). dedupKey do cronograma BYTE-preservado.
 *   E) renderer (index.html) — compensação via captura estendida a TODOS os eventos com
 *      guarda once-por-dedupKey compartilhada (RC4): nunca duplica, nunca perde.
 * Rodar: node scripts/f347-immediate-visual-delivery.test.mjs
 * ===================================================================================== */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import Module from 'module';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const H = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const FB = fs.readFileSync(path.join(DESK, 'src', 'main', 'firebase.ts'), 'utf8');
const BGH = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'bgnotify.html'), 'utf8');
const BGT = fs.readFileSync(path.join(DESK, 'src', 'main', 'bgNotify.ts'), 'utf8');
const REAL_SLARULES = path.join(DESK, 'src', 'main', 'slaRules.js');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

/* ---- compila os módulos TS REAIS isoladamente (tsc do projeto) ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f347-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'firebase.ts'),
    path.join(DESK, 'src', 'main', 'bgNotify.ts'),
    path.join(DESK, 'src', 'main', 'slaScheduler.ts'),
    '--outDir', tmp, '--module', 'commonjs', '--target', 'es2020',
    '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar módulos F3.4.7:', (e.stdout || e.message || '').toString().slice(0, 800)); process.exit(1); }

/* ---- timers FALSOS (capturam setTimeout/clearTimeout globais dos módulos compilados) ---- */
function fakeTimers() {
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  const live = new Map(); let seq = 0;
  globalThis.setTimeout = (fn, ms) => { const id = 'ft' + (++seq); live.set(id, { fn, ms }); return id; };
  globalThis.clearTimeout = (id) => { live.delete(id); };
  return {
    live,
    last() { let out = null; for (const [id, t] of live) out = { id, ...t }; return out; },
    fire(id) { const t = live.get(id); live.delete(id); if (t) t.fn(); },
    restore() { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; },
  };
}

console.log('\n===== F3.4.7 — A) firebase.listen AUTO-CURA (módulo REAL compilado) =====');
{
  const diagLog = [];
  const snaps = [];               // cada attach: {next, error, unsub, unsubCalled}
  const fbStub = {
    initializeApp: () => ({}),
    initializeFirestore: () => ({}),
    collection: () => ({}), query: (x) => x,
    onSnapshot: (_q, next, error) => { const rec = { next, error, unsubCalled: 0 }; rec.unsub = () => { rec.unsubCalled++; }; snaps.push(rec); return rec.unsub; },
  };
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === 'firebase/app') return fbStub;
    if (request === 'firebase/firestore') return fbStub;
    if (request === './diag' || /[\\/]diag(\.js)?$/.test(request)) return { diag: (t, d) => diagLog.push([t, d || {}]) };
    return realLoad.apply(this, arguments);
  };
  const { listen } = require(path.join(tmp, 'firebase.js'));
  Module._load = realLoad;

  const ft = fakeTimers();
  const got = [];
  const stop = listen('tasks', (s) => got.push(s));
  ok('A1 attach inicial: onSnapshot ligado 1x na coleção', snaps.length === 1 && diagLog.some(([t, d]) => t === 'firestore.listen.attach' && d.col === 'tasks'));
  snaps[0].next({ size: 2, docChanges: () => [1, 2] });
  ok('A2 snapshot saudável é repassado ao cb', got.length === 1 && got[0].size === 2);

  snaps[0].error(new Error('stream terminated (sintetico)'));
  let t1 = ft.last();
  ok('A3 erro ⇒ listener morto é desligado + re-attach agendado em 5000ms', snaps[0].unsubCalled === 1 && t1 && t1.ms === 5000 && diagLog.some(([t]) => t === 'firestore.listen.rearm'));
  ft.fire(t1.id);
  ok('A4 timer dispara ⇒ NOVO onSnapshot (attach 2)', snaps.length === 2);

  snaps[1].error(new Error('again'));
  let t2 = ft.last();
  ok('A5 2º erro consecutivo ⇒ backoff dobra (10000ms)', t2 && t2.ms === 10000);
  ft.fire(t2.id);
  snaps[2].error(new Error('again'));
  ft.fire(ft.last().id);            // 20000
  snaps[3].error(new Error('again'));
  ft.fire(ft.last().id);            // 40000
  snaps[4].error(new Error('again'));
  const t5 = ft.last();
  ok('A6 backoff continua 20000→40000 e CAPA em 60000ms', t5 && t5.ms === 60000);
  ft.fire(t5.id);

  snaps[5].next({ size: 1, docChanges: () => [] });
  snaps[5].error(new Error('after healthy'));
  const t6 = ft.last();
  ok('A7 snapshot saudável RESETA o backoff (próximo erro volta a 5000ms)', t6 && t6.ms === 5000);

  stop();
  const before = snaps.length;
  ok('A8 unsubscribe: cancela o re-attach pendente (nenhum attach novo)', ft.live.size === 0 && snaps.length === before);
  snaps[5].error && ok('A9 unsubscribe: o listener corrente foi desligado no teardown', snaps[5].unsubCalled >= 1);
  ft.restore();
}

console.log('\n===== F3.4.7 — B) bgNotify PROVA DE RENDER + fallback (módulo REAL compilado) =====');
{
  const diagLog = [];
  const ipcHandlers = {};
  const sends = [];
  let ctorThrow = false;
  class FakeWin {
    constructor() { if (ctorThrow) throw new Error('sem GPU (sintetico)'); this.webContents = { isLoading: () => false, send: (ch, p) => sends.push([ch, p]), once: () => {} }; }
    isDestroyed() { return false; }
    setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} removeMenu() {} loadFile() {} on() {} setBounds() {} showInactive() {} hide() {} destroy() {}
  }
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === 'electron') return { app: { getAppPath: () => tmp }, BrowserWindow: FakeWin, ipcMain: { on: (ch, cb) => { ipcHandlers[ch] = cb; } }, screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) } };
    if (request === './diag' || /[\\/]diag(\.js)?$/.test(request)) return { diag: (t, d) => diagLog.push([t, d || {}]) };
    return realLoad.apply(this, arguments);
  };
  const bg = require(path.join(tmp, 'bgNotify.js'));
  Module._load = realLoad;

  bg.initBgNotify(() => {});
  ok('B1 initBgNotify liga o ACK bgnotify-rendered (e demais IPC)', typeof ipcHandlers['bgnotify-rendered'] === 'function' && typeof ipcHandlers['bgnotify-resize'] === 'function');

  const ft = fakeTimers();
  let fb1 = 0;
  const r1 = bg.showBgNotify({ dedupKey: 'sla_warning:T1:111', severity: 'warning', title: 'x' }, () => fb1++);
  const armed1 = ft.last();
  ok('B2 showBgNotify envia bg-card e retorna true', r1 === true && sends.some(([ch, p]) => ch === 'bg-card' && p.dedupKey === 'sla_warning:T1:111'));
  ok('B3 fallback ARMADO com prazo de 4000ms (deixou de ser otimista)', armed1 && armed1.ms === 4000);
  ft.fire(armed1.id);
  ok('B4 SEM ACK no prazo ⇒ onNoRender dispara exatamente 1x + diag bg.render.timeout', fb1 === 1 && diagLog.some(([t]) => t === 'bg.render.timeout'));

  let fb2 = 0;
  bg.showBgNotify({ dedupKey: 'sla_overdue:T1:111', severity: 'critical' }, () => fb2++);
  ipcHandlers['bgnotify-rendered'](null, { dedupKey: 'sla_overdue:T1:111', severity: 'critical' });
  ok('B5 ACK do MESMO dedupKey cancela o fallback (card provado na tela)', ft.live.size === 0 && fb2 === 0);

  let fb3 = 0;
  bg.showBgNotify({ dedupKey: 'sla_warning:T2:222', severity: 'warning' }, () => fb3++);
  ipcHandlers['bgnotify-rendered'](null, { dedupKey: 'OUTRA:CHAVE' });
  const still = ft.last();
  ok('B6 ACK de OUTRO dedupKey NÃO cancela (fallback segue armado)', still && still.ms === 4000 && fb3 === 0);
  ft.fire(still.id);
  ok('B7 ...e o fallback do T2 dispara no prazo', fb3 === 1);

  bg.showBgNotify({ dedupKey: 'sem:fallback' });
  ok('B8 sem onNoRender ⇒ nenhum prazo armado (compatível com chamadas legadas)', ft.live.size === 0);

  let fb4 = 0;
  bg.showBgNotify({ dedupKey: 'tardio:1' }, () => fb4++);
  bg.stopBgNotify();
  ok('B9 stopBgNotify limpa pendências (nenhum fallback tardio após teardown)', ft.live.size === 0 && fb4 === 0);

  ctorThrow = true;
  const r2 = bg.showBgNotify({ dedupKey: 'x' }, () => {});
  ctorThrow = false;
  ok('B10 falha REAL ao criar a janela ⇒ retorna false (fallback imediato do chamador preservado)', r2 === false && diagLog.some(([t]) => t === 'bg.error'));
  ft.restore();
}

console.log('\n===== F3.4.7 — C) deliverNotification (provas de FONTE, main.ts) =====');
{
  ok('C1 dedupe do HUB gravado SÓ após canal aceitar (markSeen pós-decisão; sem add pré-resultado)',
    /const markSeen = \(\) => \{\s*\n\s*_notifSeen\.add\(key\);/.test(MAIN)
    && /if \(bgOk \|\| nativeOk\) \{ markSeen\(\);/.test(MAIN)
    && !/_notifSeen\.add\(key\);\s*\n\s*diag\("deliver\.begin"/.test(MAIN));
  ok('C2 caminho TOAST (FOCADO) marca seen e devolve channel "toast" — F3.5.4K por foco',
    /markSeen\(\);[\s\S]{0,160}?return \{ ok: true, channel: "toast" \};/.test(MAIN)
    && /if \(windowActive\(\)\) \{[\s\S]{0,160}?mainWin\?\.webContents\.send\("notif-toast", p\);/.test(MAIN));
  ok('C3 janela premium com PROVA DE RENDER: fallback nativo no no-ACK (showBgNotify(p, ()=>…nativeNotify…))',
    /const bgOk = showBgNotify\(p, \(\) => \{\s*\n\s*const lateOk = nativeNotify\(p, key, deep\);/.test(MAIN)
    && /deliver\.bg\.noAck→native/.test(MAIN));
  ok('C4 nativa extraída em helper ÚNICO (nativeNotify); deliverNotification SEM construção inline',
    /function nativeNotify\(p: NotifPayload, key: string, deep: string\): boolean \{/.test(MAIN)
    && !MAIN.slice(MAIN.indexOf('function deliverNotification'), MAIN.indexOf('function runNotifSelfTest')).includes('new Notification(')
    && /if \(!bgOk\) nativeOk = nativeNotify\(p, key, deep\);/.test(MAIN));
  ok('C5 captura p/ Central (notif-history) segue ANTES da decisão toast×bg (capture-only intacto)',
    MAIN.indexOf('send("notif-history", p)') > -1
    && MAIN.indexOf('send("notif-history", p)') < MAIN.indexOf('if (windowActive()) {')
    && /diag\("deliver\.dedup", \{ key \}\)/.test(MAIN));
  ok('C6 falha total (nenhum canal) ⇒ chave NÃO gravada ⇒ produtor pode reentregar (ok:false)',
    /const channel = bgOk \? "bg-window" : \(nativeOk \? "native" : "none"\);/.test(MAIN)
    && /return \{ ok: bgOk \|\| nativeOk, channel \};/.test(MAIN));
}

console.log('\n===== F3.4.7 — D) slaScheduler: seen SÓ com entrega ACEITA (módulo REAL compilado) =====');
const MIN = 60000;
function newRig(deliverImpl) {
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === 'electron') return { app: null };
    if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { listen: () => () => {} };
    if (request === './diag' || /[\\/]diag(\.js)?$/.test(request)) return { diag: () => {} };
    if (request === './slaRules' || /[\\/]slaRules(\.js)?$/.test(request)) return realLoad.call(this, REAL_SLARULES, arguments[1], false);
    return realLoad.apply(this, arguments);
  };
  delete require.cache[path.join(tmp, 'slaScheduler.js')];
  const { startSlaScheduler } = require(path.join(tmp, 'slaScheduler.js'));
  Module._load = realLoad;
  const NOW = 1753500000000;
  const FINISH = NOW + 10 * MIN;                 // faltam 10min ⇒ dentro da janela AMARELA (30min)
  const task = { id: 'T1', sector: 'cronograma', title: 'Tarefa X', client: 'Cliente Y',
    designerSla: { planDueAt: FINISH }, designerAssignment: { designerId: 'U1' } };
  const delivered = []; const seen = new Set(); const logs = []; let listenCb = null;
  const sched = startSlaScheduler(() => 'U1', (p) => { delivered.push(p.dedupKey); return deliverImpl(p); }, {
    cardsRules: { cardsEmissionsFor: () => [], cardsNextBoundaryMs: () => 0 }, // F3.5.2 — mock explícito (cards testados à parte)
    escalationRules: { escalationEmissionsFor: () => [], escalationNextBoundaryMs: () => 0 }, // I7.27.1-EXT — mock explícito (escalação de prazo testada à parte: f7271ext)
    now: () => NOW,
    listen: (name, cb) => { if (name === 'tasks') listenCb = cb; return () => {}; },
    seen: { has: (k) => seen.has(k), add: (k) => seen.add(k) },
    setTimer: () => 0, clearTimer: () => {},
    onLog: (t, d) => logs.push([t, d || {}]),
    authUser: () => null,
  });
  listenCb({ docChanges: () => [{ type: 'added', doc: { id: 'T1', data: () => task } }] });
  return { sched, delivered, seen, logs, FINISH };
}
{
  const r = newRig(() => ({ ok: true, channel: 'toast' }));
  ok('D1 entrega ACEITA ({ok:true}) ⇒ seen persistente gravado, exatamente 1 emissão', r.delivered.length === 1 && r.seen.has('sla_warning:T1:' + r.FINISH));
  r.sched.reconcile('re');
  ok('D2 reconcile posterior NÃO duplica (dedupe intacto)', r.delivered.length === 1);
  ok('D3 dedupKey do cronograma BYTE-preservado (sla_warning:taskId:finishMs)', r.delivered[0] === 'sla_warning:T1:' + r.FINISH);
  r.sched.stop();
}
{
  let mode = { ok: false, channel: 'none' };
  const r = newRig(() => mode);
  ok('D4 entrega RECUSADA ({ok:false}) ⇒ seen NÃO gravado (transição não é perdida p/ sempre)', r.delivered.length === 1 && r.seen.size === 0 && r.logs.some(([t]) => t === 'sla.deliver.retry'));
  r.sched.reconcile('retry');
  ok('D5 próximo eval REENTREGA a mesma transição (auto-retry ≤60s)', r.delivered.length === 2 && r.seen.size === 0);
  mode = { ok: true, channel: 'bg-window' };
  r.sched.reconcile('heal');
  ok('D6 quando o canal aceita, seen é gravado e o retry PARA', r.delivered.length === 3 && r.seen.has('sla_warning:T1:' + r.FINISH));
  r.sched.reconcile('após');
  ok('D7 nenhuma 4ª emissão (sem duplicata após a cura)', r.delivered.length === 3);
  r.sched.stop();
}
{
  let boom = true;
  const r = newRig(() => { if (boom) throw new Error('hub morto (sintetico)'); return { ok: true, channel: 'native' }; });
  ok('D8 deliver LANÇANDO ⇒ seen não gravado (comportamento herdado preservado)', r.delivered.length === 1 && r.seen.size === 0 && r.logs.some(([t]) => t === 'sla.deliver.error'));
  boom = false;
  r.sched.reconcile('re');
  ok('D9 ...e a transição é recuperada no próximo eval', r.delivered.length === 2 && r.seen.size === 1);
  r.sched.stop();
}
{
  const r = newRig(() => undefined);
  ok('D10 retorno NÃO-objeto (contrato legado) segue ACEITO ⇒ sem loop infinito', r.delivered.length === 1 && r.seen.size === 1);
  r.sched.reconcile('re');
  ok('D11 ...e não duplica', r.delivered.length === 1);
  r.sched.stop();
}

console.log('\n===== F3.4.7 — E) renderer: compensação once-por-dedupKey p/ TODOS os eventos =====');
{
  const a = H.indexOf('var notifAttrToastSeen={};');
  const b = H.indexOf('function notifAttrToastOnce(p){ return notifToastOnce(p); }');
  ok('E1 fonte: guarda compartilhada + notifToastOnce + alias notifAttrToastOnce presentes', a > 0 && b > a);
  const src = H.slice(a, b + 'function notifAttrToastOnce(p){ return notifToastOnce(p); }'.length);
  let renders = [];
  const api = new Function('notifShowToast', src + '\n;return {notifToastOnce:notifToastOnce, notifAttrToastOnce:notifAttrToastOnce, notifIsAttrEvent:notifIsAttrEvent};')((p) => renders.push(p.dedupKey));
  const sla = { eventType: 'sla_warning', dedupKey: 'sla_warning:T1:999' };
  const ok1 = api.notifToastOnce(sla); const ok2 = api.notifToastOnce(sla);
  ok('E2 MESMO dedupKey pelos 2 canais ⇒ toast renderiza UMA vez (nunca duplica)', ok1 === true && ok2 === false && renders.length === 1);
  api.notifToastOnce({ eventType: 'sla_overdue', dedupKey: 'sla_overdue:T1:999' });
  ok('E3 dedupKey DIFERENTE renderiza normalmente (nunca perde)', renders.length === 2);
  ok('E4 alias notifAttrToastOnce usa a MESMA guarda (compatibilidade com o fluxo aprovado de atribuição)', api.notifAttrToastOnce(sla) === false && renders.length === 2);
  ok('E5 payload sem dedupKey/eventId é ignorado com segurança', api.notifToastOnce({ eventType: 'sla_warning' }) === false && renders.length === 2);
  ok('E6 fonte: canal notif-toast roteia TODOS os eventos pela guarda única',
    /onNotifToast\(function\(p\)\{ notifToastOnce\(p\);/.test(H));
  const histLine = (H.split('\n').find((l) => l.includes('onNotifHistory(function(p)')) || '');
  ok('E7 fonte: compensação via CAPTURA cobre TODOS os eventos (sem filtro attr) gated em janela visível',
    histLine.includes('notifToastOnce(p)') && histLine.includes("visibilityState!=='hidden'") && !histLine.includes('notifIsAttrEvent'));
  ok('E8 fonte: bgnotify.html envia ACK com dedupKey e bgNotify.ts cancela no ACK',
    /bgAPI\.rendered\(\{dedupKey:key/.test(BGH) && /ipcMain\.on\("bgnotify-rendered",[\s\S]{0,260}ackCancel\(String\(k\)\)/.test(BGT));
  ok('E9 fonte: produtor único preservado — renderer segue SEM produzir SLA (notifScan vazio)',
    /function notifScan\(\)\{\}/.test(H));
  ok('E10 fonte: firebase.ts documenta e implementa re-attach (rearm + backoff capado 60s)',
    /firestore\.listen\.rearm/.test(FB) && /Math\.min\(5000 \* Math\.pow\(2, attempt - 1\), 60000\)/.test(FB));
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
console.log(`\nF347-IMMEDIATE-VISUAL-DELIVERY: PASS=${pass} FAIL=${fail} (asserts=${pass + fail})`);
process.exit(fail ? 1 : 0);
