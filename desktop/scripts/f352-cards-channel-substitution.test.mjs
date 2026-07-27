#!/usr/bin/env node
/* =====================================================================================
 * F3.5.2 — GATE 4 · SUBSTITUIÇÃO AMARELA→VERMELHA PELO CANAL OFICIAL (integrado, 3 estados)
 * -------------------------------------------------------------------------------------
 * Executa o slaScheduler.ts REAL (compilado com o tsc do projeto) em MODO PRODUÇÃO
 * (SEM opts.cardsRules ⇒ require("./cardsRules") RÍGIDO resolve o módulo REAL) e roteia CADA
 * emissão pelo deliverNotification REAL de main.ts (harness fixtures/f343/deliver-harness), nos
 * 3 estados de janela: ABERTA (toast) · MINIMIZADA (janela premium bg) · BANDEJA/oculta (bg).
 *
 * Prova, POR ESTADO, os 8 sub-checks do owner:
 *   (1) T-30 emite AMARELA pelo canal oficial;      (2) exatamente UMA amarela (sem repetição);
 *   (3) avança p/ T-10 e emite VERMELHA;            (4) a vermelha é entregue pelo canal oficial;
 *   (5) a VERMELHA SUBSTITUI a amarela (após ela);  (6) nunca amarela+vermelha concorrentes;
 *   (7) nenhuma amarela REAPARECE após a vermelha;  (8) clique abre a MESMA tarefa (restaura+foca).
 * + PROVA ARQUITETURAL (fonte): o setor cards NÃO cria segundo notifier/janela/listener/tray/
 *   scheduler — reusa o MESMO emitList→deliver e a MESMA dedup persistente (chave própria).
 *
 * Rodar: node desktop/scripts/f352-cards-channel-substitution.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import Module from 'module'; import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const SCHED_TS = fs.readFileSync(path.join(DESK, 'src', 'main', 'slaScheduler.ts'), 'utf8');
const CARDS_JS = fs.readFileSync(path.join(DESK, 'src', 'main', 'cardsRules.js'), 'utf8');
const REAL_SLARULES = path.join(DESK, 'src', 'main', 'slaRules.js');
const REAL_CARDSRULES = path.join(DESK, 'src', 'main', 'cardsRules.js');
const { extractDeliver } = await import('./fixtures/f343/deliver-harness.mjs');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const MIN = 60000, UID = 'designerA';

/* ---- compila o slaScheduler.ts REAL (mesmo padrão f347/f343) ---- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f352ch-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'firebase.ts'),
    path.join(DESK, 'src', 'main', 'slaScheduler.ts'),
    '--outDir', tmp, '--module', 'commonjs', '--target', 'es2020',
    '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar slaScheduler.ts:', (e.stdout || e.message || '').toString().slice(0, 800)); process.exit(1); }

const realSla = require(REAL_SLARULES);
const D = realSla.dtMs('2026-08-01', '15:00');   // prazo do card
function mkCard() {
  return { id: 't1', sector: 'edicao_cards', title: 'Card X', client: 'Cliente Y', status: 'afazer',
    dueDate: '2026-08-01', dueTime: '15:00', due: '2026-08-01',
    designerAssignment: { designerId: UID, designerName: 'Des A' } };
}

/* Carrega o startSlaScheduler REAL com require("./cardsRules") RESOLVIDO ao módulo REAL (produção). */
function loadStartScheduler() {
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === 'electron') return { app: null };
    if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { listen: () => () => {} };
    if (request === './diag' || /[\\/]diag(\.js)?$/.test(request)) return { diag: () => {} };
    if (request === './slaRules' || /[\\/]slaRules(\.js)?$/.test(request)) return realLoad.call(this, REAL_SLARULES, arguments[1], false);
    if (request === './cardsRules' || /[\\/]cardsRules(\.js)?$/.test(request)) return realLoad.call(this, REAL_CARDSRULES, arguments[1], false);
    return realLoad.apply(this, arguments);
  };
  delete require.cache[path.join(tmp, 'slaScheduler.js')];
  const mod = require(path.join(tmp, 'slaScheduler.js'));
  return { startSlaScheduler: mod.startSlaScheduler, restore: () => { Module._load = realLoad; } };
}

const expectedChannel = (state) => (state === 'visible' ? 'toast' : 'bg-window');

/* Um cenário completo por estado de janela. */
function runState(state) {
  const { startSlaScheduler, restore } = loadStartScheduler();
  const { deliver: official } = extractDeliver(MAIN);   // canal oficial (HUB seen persistente próprio)
  const events = [];                                    // cada ENTREGA visual real
  const seen = new Set();                               // dedup persistente do scheduler (chave própria)
  const clock = { now: D - 30 * MIN };
  let curTick = 'boot', listenCb = null;
  const schedDeliver = (p) => {
    const r = official(state, p);                       // deliverNotification REAL roteando por estado
    events.push({ tick: curTick, eventType: p.eventType, dedupKey: p.dedupKey,
      deep: p.action && p.action.deep, channel: r.res && r.res.channel, sent: r.sent, bg: r.bg, payload: p });
    return r.res;                                       // {ok,channel} de volta ao emitList
  };
  let h;
  try {
    h = startSlaScheduler(() => UID, schedDeliver, {
      // MODO PRODUÇÃO: NÃO injeta cardsRules ⇒ require("./cardsRules") real.
      now: () => clock.now,
      listen: (name, cb) => { if (name === 'tasks') listenCb = cb; return () => {}; },
      seen: { has: (k) => seen.has(k), add: (k) => seen.add(k) },
      setTimer: () => 0, clearTimer: () => {}, onLog: () => {}, authUser: () => null,
    });
  } finally { restore(); }
  const tickReconcile = (label, nowMs) => { curTick = label; clock.now = nowMs; h.reconcile(label); };

  // T-30: injeta o card via snapshot ⇒ reconcile("snapshot") em T-30 ⇒ AMARELA.
  curTick = 'T-30'; clock.now = D - 30 * MIN;
  listenCb({ docChanges: () => [{ type: 'added', doc: { id: 't1', data: () => mkCard() } }] });
  const warnsAfterT30 = events.filter((e) => e.eventType === 'sla_cards_warning').length;
  tickReconcile('T-25', D - 25 * MIN);   // ainda amarela ⇒ dedup ⇒ NADA novo
  const eventsBeforeRed = events.length;
  tickReconcile('T-10', D - 10 * MIN);   // vira VERMELHA
  const redsAfterT10 = events.filter((e) => e.eventType === 'sla_cards_overdue').length;
  tickReconcile('T-5', D - 5 * MIN);     // vermelha ⇒ dedup ⇒ NADA novo
  tickReconcile('T+1', D + 1 * MIN);     // pós-prazo ⇒ ainda dedup ⇒ NADA novo (amarela não reaparece)
  h.stop();

  const warns = events.filter((e) => e.eventType === 'sla_cards_warning');
  const reds = events.filter((e) => e.eventType === 'sla_cards_overdue');
  const iYellow = events.findIndex((e) => e.eventType === 'sla_cards_warning');
  const iRed = events.findIndex((e) => e.eventType === 'sla_cards_overdue');
  // por-tick: nenhum tick emitiu as DUAS e nenhum tick emitiu >1 card.
  const byTick = {}; for (const e of events) { (byTick[e.tick] = byTick[e.tick] || []).push(e.eventType); }
  const noTickBoth = Object.values(byTick).every((arr) => !(arr.includes('sla_cards_warning') && arr.includes('sla_cards_overdue')));
  const maxPerTick = Math.max(0, ...Object.values(byTick).map((a) => a.length));
  // canal oficial correto por estado (amarela e vermelha).
  const yellowCh = warns[0] && warns[0].channel, redCh = reds[0] && reds[0].channel;
  const yellowVisualOk = state === 'visible'
    ? (warns[0] && warns[0].sent.some(([ch]) => ch === 'notif-toast'))
    : (warns[0] && warns[0].bg.length === 1);
  const redVisualOk = state === 'visible'
    ? (reds[0] && reds[0].sent.some(([ch]) => ch === 'notif-toast'))
    : (reds[0] && reds[0].bg.length === 1);

  const P = 'estado ' + state + ' — ';
  ok(P + '(1) T-30 emite AMARELA pelo canal oficial', warnsAfterT30 === 1 && yellowCh === expectedChannel(state) && yellowVisualOk);
  // eventsBeforeRed foi capturado LOGO APÓS o tick T-25: deve valer 1 (só a amarela do T-30; T-25 nada
  // acrescentou — dedup persistente). warns.length===1 confirma amarela única em toda a linha do tempo.
  ok(P + '(2) exatamente UMA amarela (sem repetição em T-25)', warns.length === 1 && eventsBeforeRed === 1);
  ok(P + '(3) avança p/ T-10 e emite VERMELHA', redsAfterT10 === 1);
  ok(P + '(4) VERMELHA entregue pelo canal oficial', redCh === expectedChannel(state) && redVisualOk);
  ok(P + '(5) VERMELHA SUBSTITUI a amarela (vermelha após a amarela; sem amarela depois)', iRed > iYellow && iYellow >= 0 && warns.length === 1);
  ok(P + '(6) nunca amarela+vermelha concorrentes (≤1 card/tick; nenhum tick com as duas)', noTickBoth && maxPerTick <= 1);
  ok(P + '(7) nenhuma amarela REAPARECE após a vermelha (T-5 e pós-prazo)', warns.length === 1 && reds.length === 1);

  // (8) clique abre a MESMA tarefa. Toda entrega carrega deep detail/t1; no bg/nativa, o clique
  //     RESTAURA+FOCA e envia notif-open p/ a MESMA tarefa (prova via fallback nativo do canal).
  const allDeepSame = events.length > 0 && events.every((e) => e.deep === 'detail/t1');
  let clickOk;
  if (state === 'visible') {
    // toast: o payload roteado ao renderer carrega o deep ⇒ clique abre a MESMA tarefa.
    const toastP = warns[0].sent.find(([ch]) => ch === 'notif-toast');
    clickOk = !!(toastP && toastP[1] && toastP[1].action && toastP[1].action.deep === 'detail/t1');
  } else {
    // minimizada/bandeja: força o fallback NATIVO e dispara o clique real do deliverNotification.
    const { deliver: d2 } = extractDeliver(MAIN);
    const rr = d2(state, reds[0].payload, { bgOk: false });
    rr.fireNativeClick();
    const restoredIfMin = state === 'minimized' ? rr.winCalls.includes('restore') : true;
    clickOk = rr.hadNativeClick() && rr.winCalls.includes('show') && rr.winCalls.includes('focus')
      && restoredIfMin && rr.sent.some(([ch, arg]) => ch === 'notif-open' && arg === 'detail/t1');
  }
  ok(P + '(8) clique abre a MESMA tarefa (deep detail/t1; bg/nativa restaura+foca)', allDeepSame && clickOk);

  return { events, warns, reds };
}

const perState = {};
for (const state of ['visible', 'minimized', 'hidden']) { perState[state] = runState(state); }

/* ---- PROVA ARQUITETURAL (fonte): sem segundo notifier/janela/listener/tray/scheduler ---- */
// Todas as ENTREGAS observadas usaram SÓ os canais oficiais (toast | bg-window). Nenhum canal estranho.
const allChannels = new Set([].concat(...Object.values(perState).map((r) => r.events.map((e) => e.channel))));
ok('ARQ canais observados ⊆ {toast,bg-window} (canal oficial; nenhum canal novo)',
  [...allChannels].every((c) => c === 'toast' || c === 'bg-window'));
// slaScheduler.ts: cards passam pelo MESMO emitList (uma única função de entrega); sem 2º deliver.
ok('ARQ cards usam o MESMO emitList (uma entrega compartilhada)', /emitList\(cardEmissions/.test(SCHED_TS));
// cardsRules.js NÃO instancia janela/notificação/tray/listener próprios (produtor PURO).
for (const forbidden of ['new BrowserWindow', 'new Notification', 'new Tray', 'webContents', 'onSnapshot', 'ipcMain', 'showBgNotify', 'require(\'electron\')', 'require("electron")']) {
  ok('ARQ cardsRules.js NÃO contém "' + forbidden + '" (produtor puro; sem novo canal)', CARDS_JS.indexOf(forbidden) < 0);
}
// slaScheduler.ts NÃO ganhou 2º listener/tray/janela por causa dos cards (o listen("tasks") é único).
ok('ARQ slaScheduler.ts mantém UM único listen("tasks") (sem 2º listener global)',
  (SCHED_TS.match(/listen\("tasks"/g) || []).length === 1);
ok('ARQ slaScheduler.ts NÃO cria BrowserWindow/Notification/Tray (entrega delegada ao canal)',
  SCHED_TS.indexOf('new BrowserWindow') < 0 && SCHED_TS.indexOf('new Notification') < 0 && SCHED_TS.indexOf('new Tray') < 0);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\nF3.5.2 cards-channel-substitution: ' + pass + ' passaram, ' + fail + ' falharam (total ' + (pass + fail) + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
process.exit(0);
