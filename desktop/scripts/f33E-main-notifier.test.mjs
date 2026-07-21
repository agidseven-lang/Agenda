#!/usr/bin/env node
/* F3.3.10-DESKTOP — HARNESS (main process): atribuição Social→Designer notifica em BACKGROUND.
 *
 * Causa raiz (provada): o notifier do MAIN (notifier.ts) é o único caminho garantido em background
 * (o processo main NUNCA é suspenso pelo Chromium; o renderer pode congelar minimizado/bandeja). O
 * notifier estava OK no wiring, mas o transporte Firestore (WebChannel) no Node/Electron-main não
 * entrega onSnapshot em tempo real → o listener não dispara em background. Fix: long-polling
 * (firebase.ts), mantendo o notifier no main. Este harness RODA o notifier.ts REAL com `listen`
 * stubado (simula o docChange que o long-polling agora entrega).
 *
 * -----------------------------------------------------------------------------
 * F3.4.3C — reescrito para o contrato produtor-único-no-main (substitui o contrato antigo;
 * histórico no Git). O notifier do MAIN é o produtor ÚNICO e autoritativo da AZUL nas 3 janelas
 * (visível/minimizado/oculto), agora por DETECÇÃO POR TRANSIÇÃO (semente no 1º snapshot; emite só
 * mudança de designer OU novo assignedAt) — substitui o antigo gate `assignedAt < sinceMs`, que
 * HARD-DROPPAVA atribuições AO VIVO sob clock-skew. Entrega pelo MESMO deliverNotification (toast
 * visível / bg-window minimizado-oculto) com dedupKey canônico. Prova por EXECUÇÃO do notifier.ts
 * REAL nas 3 janelas + estática do wiring. Puro Node: sem rede, sem Firestore real, sem build.
 */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { extractDeliver } from './fixtures/f343/deliver-harness.mjs';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const mainTs = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const fbTs = fs.readFileSync(path.join(DESK, 'src', 'main', 'firebase.ts'), 'utf8');
const NT = fs.readFileSync(path.join(DESK, 'src', 'main', 'notifier.ts'), 'utf8');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };

/* ── estáticas: PRODUTOR ÚNICO no MAIN; transporte long-polling; canal; renderer só-visual ── */
ok('main: notifier inicia no session-login (produtor no main)', /ipcMain\.on\("session-login"[\s\S]*?startNotifier\(\(\) => mainWin, uid, deliverNotification\)/.test(mainTs));
ok('main: X (close) esconde na bandeja, processo vivo (hide, não quit)', /on\("close",[\s\S]*?if \(!quitting\)[\s\S]*?mainWin\?\.hide\(\)/.test(mainTs));
ok('main: notifier só para em logout/Sair (não no minimize/hide)', /function realQuit\(\)[\s\S]*?stopNotifier\(\)/.test(mainTs) && !/on\("minimize"[^\n]*stopNotifier/.test(mainTs) && !/on\("hide"[^\n]*stopNotifier/.test(mainTs));
ok('main: background = janela premium própria (showBgNotify); nativa = fallback', /return \{ ok: true, channel: "toast" \};\s*\}[\s\S]*?const bgOk = showBgNotify\(p\);/.test(mainTs) && /if \(!bgOk\) \{[\s\S]*?const n = new Notification\(/.test(mainTs));
ok('main: windowActive = visível e não-minimizado (minimizado/oculto → background)', /isVisible\(\) && !w\.isMinimized\(\)/.test(mainTs));
ok('main: Notification nativa tem click handler (abre a tarefa via deep link)', /n\.on\("click"[\s\S]*?send\("notif-open", deep\)/.test(mainTs));
ok('firebase(main): transporte long-polling (onSnapshot realtime em Node/main)', /initializeFirestore\(fbApp, \{ experimentalForceLongPolling: true \}\)/.test(fbTs));
ok('renderer: NÃO emite atribuição (notifScan só fluxo; notifScanAssign sem chamadores)', /function notifScan\(\)\{ notifScanFlow\(\); \}/.test(HTML) && (HTML.match(/notifScanAssign\(\)/g) || []).length === 1);
ok('notifier: DETECÇÃO POR TRANSIÇÃO (seed + changed), sem hard-drop por relógio no código',
  /const changed = \(prev !== cur\) \|\| \(at !== prevAt\);/.test(NT) && !/at < state\.sinceMs[\s\S]{0,20}return/.test(NT));

/* ── compila o notifier.ts REAL ── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f33e-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'notifier.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar notifier.ts:', (e.stdout || e.message || '').toString().slice(0, 500)); process.exit(1); }

/* ── stub de 'electron' e './firebase' (capturando os callbacks de listen) ── */
let listenCalls = [];
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { BrowserWindow: class {} };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { db: {}, listen: (name, cb) => { listenCalls.push([name, cb]); return () => {}; } };
  return realLoad.apply(this, arguments);
};
const { startNotifier } = require(path.join(tmp, 'notifier.js'));
Module._load = realLoad;

/* ── deliver = deliverNotification REAL (extraído do main.ts): toast × bg-window por windowActive ── */
const chan = extractDeliver(mainTs);
let winState = 'visible';
const delivered = [];
function deliver(p) { const r = chan.deliver(winState, p); delivered.push({ key: p.dedupKey, channel: r.res.channel, eventType: p.eventType, taskId: p.taskId, taskTitle: p.taskTitle, clientName: p.clientName, responsibleName: p.responsibleName, actorName: p.actorName, target: p.targetUserId, deep: p.action && p.action.deep }); return r.res; }

const UID = 'designer1';
startNotifier(() => ({}), UID, deliver);
const tasksCbs = listenCalls.filter(([n]) => n === 'tasks').map(([, cb]) => cb);
ok('notifier registrou listener de tasks (atribuição) no MAIN', tasksCbs.length >= 1);
const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
const fire = (changes) => tasksCbs.forEach((cb) => { try { cb({ docChanges: () => changes }); } catch (_) {} });
const NOW = 1700000000000;
const daNew = { designerId: 'designer1', assignedBy: 'social1', assignedByName: 'Arydyjany Carlôto', designerName: 'Marina Dias' };

/* SEED — 1º snapshot marca o baseline SEM emitir (Firestore entrega o estado inicial como added) */
fire([ch('added', 'tSeed', { title: 'Antiga', client: 'Y', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW - 3600000 } })]);
ok('SEED: atribuição pré-existente no 1º snapshot NÃO dispara (baseline)', delivered.length === 0);

/* A — app ABERTO → toast */
winState = 'visible';
fire([ch('modified', 'tA', { title: 'Cronograma semanal', client: 'Hospital Visão', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW + 1000 } })]);
/* B — MINIMIZADO → bg-window */
winState = 'minimized';
fire([ch('modified', 'tB', { title: 'Cronograma B', client: 'Cliente B', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW + 2000 } })]);
/* C — X / BANDEJA (hide → visible:false) → bg-window */
winState = 'hidden';
fire([ch('modified', 'tC', { title: 'Cronograma C', client: 'Cliente C', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW + 3000 } })]);
/* dedupe: reenviar o MESMO docChange de B não duplica */
winState = 'minimized';
fire([ch('modified', 'tB', { title: 'Cronograma B', client: 'Cliente B', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW + 2000 } })]);
/* usuário errado / auto-atribuição não disparam */
fire([ch('modified', 'tX', { title: 'De outro', designerAssignment: { designerId: 'designerZ', assignedBy: 'social1', assignedAt: NOW + 4000 } })]);
fire([ch('modified', 'tMine', { title: 'Eu', designerAssignment: { designerId: 'designer1', assignedBy: 'designer1', assignedAt: NOW + 5000 } })]);
/* NOVA transição AO VIVO com assignedAt ANTIGO — NÃO é hard-dropada (autoritativo, sem gate de relógio) */
fire([ch('modified', 'tLate', { title: 'Atrasada no relógio', client: 'Z', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW - 7200000 } })]);

const byTask = (t) => delivered.find((d) => d.taskId === t);
ok('A — app aberto: atribuição → canal TOAST', byTask('tA') && byTask('tA').channel === 'toast' && byTask('tA').eventType === 'designer_assigned');
ok('B — minimizado: atribuição → janela premium (bg-window)', byTask('tB') && byTask('tB').channel === 'bg-window');
ok('C — X/bandeja (hide): atribuição → janela premium (bg-window)', byTask('tC') && byTask('tC').channel === 'bg-window');
ok('payload completo: tarefa+cliente+responsável+deep', byTask('tA') && byTask('tA').taskTitle === 'Cronograma semanal' && byTask('tA').clientName === 'Hospital Visão' && byTask('tA').responsibleName === 'Marina Dias' && byTask('tA').deep === 'detail/tA');
ok('dedupKey CANÔNICO designer_assigned:<id>:<designerId>:<assignedAt>', byTask('tA') && byTask('tA').key === 'designer_assigned:tA:designer1:' + (NOW + 1000));
ok('dedupe: reenvio do mesmo docChange NÃO duplica', delivered.filter((d) => d.taskId === 'tB').length === 1);
ok('usuário errado (outro designer) NÃO recebe', !byTask('tX'));
ok('anti-eco: auto-atribuição (assignedBy===me) NÃO dispara', !byTask('tMine'));
ok('sem hard-drop por relógio: transição AO VIVO com assignedAt antigo AINDA dispara', !!byTask('tLate'));
ok('total entregue = 4 transições elegíveis (A,B,C,tLate)', delivered.length === 4);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\nF3.3.10 (F3.4.3C) MAIN-NOTIFIER — produtor único no MAIN: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: notifier de atribuição no main divergiu do contrato produtor-único'); process.exit(1); }
console.log('OK — notifier.ts REAL: produtor único da azul no MAIN por transição (seed + changed), 3 janelas (aberto→toast; min/bandeja→bg-window), dedupe canônico, usuário certo, sem hard-drop por relógio.');
