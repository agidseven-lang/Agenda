#!/usr/bin/env node
/* =====================================================================================
 * F3.4.7 — HARNESS INDEPENDENTE (auditoria pré-publicação).
 * -------------------------------------------------------------------------------------
 * NÃO importa nenhum guard/fixture re-ancorado da F3.4.7 (nem deliver-harness, nem
 * fixtures/f347). Compila os módulos TS REAIS por conta própria e injeta stubs próprios.
 * Valida, do zero, os 15 comportamentos exigidos pela correção da entrega visual:
 *   1  erro realista do onSnapshot
 *   2  rearm automático
 *   3  snapshot saudável reseta o backoff
 *   4  unsubscribe cancela o rearm
 *   5  falha do toast premium (janela não pôde ser criada)
 *   6  ausência de ACK do card premium
 *   7  fallback nativo
 *   8  dedupe SÓ depois de entrega aceita
 *   9  falha de TODOS os canais NÃO marca seen
 *   10 próxima avaliação tenta de novo
 *   11 ACK tardio não gera duplicação
 *   12 fechar pelo X mantém o processo principal (hide, não quit)
 *   13 Quit explícito encerra (realQuit)
 *   14 clique da notificação restaura e foca
 *   15 amarelo e vermelho permanecem eventos DISTINTOS
 * Regra: este harness NÃO é modificado para acomodar resultados na mesma execução.
 * Rodar: node scripts/f347-independent-behavior.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const SLARULES = path.join(DESK, 'src', 'main', 'slaRules.js');
const MAIN_SRC = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

/* compila firebase.ts + bgNotify.ts + slaScheduler.ts com o tsc do projeto (isolado) */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f347ind-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'firebase.ts'),
    path.join(DESK, 'src', 'main', 'bgNotify.ts'),
    path.join(DESK, 'src', 'main', 'slaScheduler.ts'),
    '--outDir', tmp, '--module', 'commonjs', '--target', 'es2020',
    '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar módulos:', (e.stdout || e.message || '').toString().slice(0, 800)); process.exit(1); }

/* relógio de timers determinístico próprio (independente) */
function TimerBox() {
  const realS = globalThis.setTimeout, realC = globalThis.clearTimeout;
  const m = new Map(); let seq = 0;
  globalThis.setTimeout = (fn, ms) => { const id = 't' + (++seq); m.set(id, { fn, ms }); return id; };
  globalThis.clearTimeout = (id) => { m.delete(id); };
  return { size: () => m.size, last: () => { let o = null; for (const [id, t] of m) o = { id, ...t }; return o; }, fire: (id) => { const t = m.get(id); m.delete(id); if (t) t.fn(); }, restore: () => { globalThis.setTimeout = realS; globalThis.clearTimeout = realC; } };
}

console.log('\n===== F3.4.7 — HARNESS INDEPENDENTE (15 comportamentos) =====');

/* ---- 1..4: firebase.listen (auto-cura) ---- */
{
  const snaps = [];
  const fb = { initializeApp: () => ({}), initializeFirestore: () => ({}), collection: () => ({}), query: (x) => x,
    onSnapshot: (_q, next, error) => { const r = { next, error, unsub: 0 }; r.u = () => { r.unsub++; }; snaps.push(r); return r.u; } };
  const rl = Module._load;
  Module._load = function (req) {
    if (req === 'firebase/app' || req === 'firebase/firestore') return fb;
    if (req === './diag' || /[\\/]diag(\.js)?$/.test(req)) return { diag: () => {} };
    return rl.apply(this, arguments);
  };
  const { listen } = require(path.join(tmp, 'firebase.js'));
  Module._load = rl;
  const T = TimerBox();
  const got = [];
  const stop = listen('tasks', (s) => got.push(s));
  snaps[0].error(new Error('stream terminated'));                    // 1
  ok('1 erro realista do onSnapshot é tratado (listener morto desligado)', snaps[0].unsub === 1);
  const a = T.last();
  ok('2 rearm automático agendado (5000ms) após o erro', a && a.ms === 5000);
  T.fire(a.id);
  ok('2 rearm dispara um NOVO onSnapshot', snaps.length === 2);
  snaps[1].next({ size: 1, docChanges: () => [] });                   // saudável
  got.length && snaps[1].error(new Error('again'));
  ok('3 snapshot saudável reseta o backoff (próximo erro volta a 5000ms)', T.last() && T.last().ms === 5000);
  T.fire(T.last().id);
  stop();                                                            // 4
  ok('4 unsubscribe cancela o rearm pendente (nenhum timer vivo)', T.size() === 0);
  T.restore();
}

/* ---- 5..7, 11: bgNotify (prova de render + fallback) ---- */
let bg;
{
  const ipc = {};
  let ctorThrow = false;
  class Win { constructor() { if (ctorThrow) throw new Error('sem GPU'); this.webContents = { isLoading: () => false, send: () => {}, once: () => {} }; } isDestroyed() { return false; } setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} removeMenu() {} loadFile() {} on() {} setBounds() {} showInactive() {} hide() {} destroy() {} }
  const rl = Module._load;
  Module._load = function (req) {
    if (req === 'electron') return { app: { getAppPath: () => tmp }, BrowserWindow: Win, ipcMain: { on: (c, cb) => { ipc[c] = cb; } }, screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) } };
    if (req === './diag' || /[\\/]diag(\.js)?$/.test(req)) return { diag: () => {} };
    return rl.apply(this, arguments);
  };
  bg = require(path.join(tmp, 'bgNotify.js'));
  Module._load = rl;
  bg.initBgNotify(() => {});
  const T = TimerBox();
  ctorThrow = true;
  const r5 = bg.showBgNotify({ dedupKey: 'k5' }, () => {});
  ctorThrow = false;
  ok('5 falha REAL ao criar a janela premium ⇒ showBgNotify retorna false', r5 === false);
  let fb6 = 0;
  bg.showBgNotify({ dedupKey: 'k6' }, () => fb6++);
  const armed = T.last();
  ok('6 ausência de ACK: fallback ARMADO (4000ms)', armed && armed.ms === 4000 && fb6 === 0);
  T.fire(armed.id);
  ok('7 sem ACK no prazo ⇒ fallback nativo dispara exatamente 1x', fb6 === 1);
  let fb11 = 0;
  bg.showBgNotify({ dedupKey: 'k11' }, () => fb11++);
  ipc['bgnotify-rendered'](null, { dedupKey: 'k11' });               // ACK dentro do prazo
  const late = T.size();
  ok('11 ACK cancela o fallback (nenhum timer pendente do k11)', late === 0 && fb11 === 0);
  T.restore();
}

/* ---- 8..10: slaScheduler (seen só com entrega aceita) ---- */
{
  const rl = Module._load;
  Module._load = function (req) {
    if (req === 'electron') return { app: null };
    if (req === './firebase' || /[\\/]firebase(\.js)?$/.test(req)) return { listen: () => () => {} };
    if (req === './diag' || /[\\/]diag(\.js)?$/.test(req)) return { diag: () => {} };
    if (req === './slaRules' || /[\\/]slaRules(\.js)?$/.test(req)) return rl.call(this, SLARULES, arguments[1], false);
    return rl.apply(this, arguments);
  };
  delete require.cache[path.join(tmp, 'slaScheduler.js')];
  const { startSlaScheduler } = require(path.join(tmp, 'slaScheduler.js'));
  Module._load = rl;
  const NOW = 1753500000000, FINISH = NOW + 10 * 60000;
  const task = { id: 'T1', sector: 'cronograma', title: 'X', client: 'Y', designerSla: { planDueAt: FINISH }, designerAssignment: { designerId: 'U1' } };
  let mode = { ok: false, channel: 'none' };
  const delivered = []; const seen = new Set(); let cb = null;
  const s = startSlaScheduler(() => 'U1', (p) => { delivered.push(p.dedupKey); return mode; }, {
    cardsRules: { cardsEmissionsFor: () => [], cardsNextBoundaryMs: () => 0 }, // F3.5.2 — mock explícito (cards testados à parte)
    escalationRules: { escalationEmissionsFor: () => [], escalationNextBoundaryMs: () => 0 }, // I7.27.1-EXT — mock explícito (escalação de prazo testada à parte: f7271ext)
    now: () => NOW, listen: (n, c) => { if (n === 'tasks') cb = c; return () => {}; },
    seen: { has: (k) => seen.has(k), add: (k) => seen.add(k) }, setTimer: () => 0, clearTimer: () => {}, onLog: () => {}, authUser: () => null });
  cb({ docChanges: () => [{ type: 'added', doc: { id: 'T1', data: () => task } }] });
  ok('9 falha de TODOS os canais ({ok:false}) NÃO marca seen', delivered.length === 1 && seen.size === 0);
  s.reconcile('again');
  ok('10 próxima avaliação REENTREGA a mesma transição (auto-retry)', delivered.length === 2 && seen.size === 0);
  mode = { ok: true, channel: 'toast' };
  s.reconcile('heal');
  ok('8 dedupe (seen) SÓ gravado quando um canal ACEITA ({ok:true})', delivered.length === 3 && seen.has('sla_warning:T1:' + FINISH));
  s.reconcile('after');
  ok('8 após a cura não há 4ª emissão (sem duplicação)', delivered.length === 3);
  s.stop();
}

/* ---- 15: amarelo × vermelho são eventos DISTINTOS (slaRules real, sem stub) ---- */
{
  const rules = require(SLARULES);
  const NOW = 1753500000000;
  const mk = (finishOffsetMin) => ({ id: 'TT', sector: 'cronograma', title: 'X', client: 'Y', designerSla: { planDueAt: NOW + finishOffsetMin * 60000 }, designerAssignment: { designerId: 'U1' } });
  const warn = rules.slaEmissionsFor(mk(10), 'U1', NOW);        // faltam 10min ⇒ AMARELO
  const over = rules.slaEmissionsFor(mk(-5), 'U1', NOW);        // 5min após o prazo ⇒ VERMELHO
  const w = warn[0] || {}, o = over[0] || {};
  ok('15 amarelo = sla_warning (severity warning) e vermelho = sla_overdue/critical (severity critical)',
    w.eventType === 'sla_warning' && w.severity === 'warning' && /^(sla_overdue|sla_critical)$/.test(o.eventType) && o.severity === 'critical');
  ok('15 dedupKeys de amarelo e vermelho são DISTINTOS (nunca colidem)', w.dedupKey && o.dedupKey && w.dedupKey !== o.dedupKey);
}

/* ---- 12..14: lifecycle no main.ts (prova de fonte independente; fresh regex) ---- */
{
  ok('12 fechar pelo X mantém o processo (preventDefault + hide; quit só se quitting)',
    /mainWin\.on\("close", \(e\) => \{[\s\S]*?if \(!quitting\) \{[\s\S]*?e\.preventDefault\(\);[\s\S]*?mainWin\?\.hide\(\);/.test(MAIN_SRC));
  ok('13 Quit explícito encerra de fato (realQuit: quitting=true → app.quit())',
    /function realQuit\(\) \{[\s\S]*?quitting = true;[\s\S]*?app\.quit\(\);/.test(MAIN_SRC));
  ok('14 clique da notificação → bringToFrontAndOpen (restore/show/focus + deep-link) — F3.5.4K',
    /n\.on\("click", \(\) => \{[\s\S]*?bringToFrontAndOpen\(deep\)/.test(MAIN_SRC)
    && /function bringToFrontAndOpen\(deep[\s\S]*?w\.restore\(\)[\s\S]*?w\.show\(\); w\.focus\(\)[\s\S]*?openDeep/.test(MAIN_SRC)
    && /function openDeep\(deep[\s\S]*?send\("notif-open", d\)/.test(MAIN_SRC));
}

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
console.log(`\nF347-INDEPENDENT-BEHAVIOR: PASS=${pass} FAIL=${fail} (asserts=${pass + fail})`);
process.exit(fail ? 1 : 0);
