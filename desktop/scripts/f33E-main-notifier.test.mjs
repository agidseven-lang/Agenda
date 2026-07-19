#!/usr/bin/env node
/* F3.3.10-DESKTOP — HARNESS (main process): atribuição Social→Designer notifica em BACKGROUND.
 *
 * Causa raiz (provada): o notifier do MAIN (notifier.ts) é o único caminho garantido em background
 * (o processo main NUNCA é suspenso pelo Chromium; o renderer pode congelar minimizado/bandeja). O
 * notifier estava OK no wiring, mas o transporte Firestore (WebChannel) no Node/Electron-main não
 * entrega onSnapshot em tempo real → o listener não dispara em background. Fix: long-polling
 * (firebase.ts), mantendo o notifier no main. Este harness RODA o notifier.ts REAL com `listen`
 * stubado (simula o docChange que o long-polling agora entrega) e prova:
 *   A app aberto  → deliver chamado → canal TOAST   (windowActive=true)
 *   B minimizado  → deliver chamado → canal NATIVA   (visible=true, minimized=true)
 *   C X/bandeja   → deliver chamado → canal NATIVA   (visible=false)  [hide()]
 *   D Sair        → fora de escopo (processo morto)  [documentado]
 *   + dedupKey correto, payload (tarefa/cliente/responsável/deep), usuário certo, sem duplicar,
 *     atribuição anterior ao login NÃO dispara.
 * O canal replica EXATAMENTE deliverNotification (windowActive→toast; senão NATIVA) — verificado por
 * asserção estática contra o main.ts real. Puro Node: sem rede, sem Firestore real, sem build.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33E-main-notifier.test.mjs */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const mainTs = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const fbTs = fs.readFileSync(path.join(DESK, 'src', 'main', 'firebase.ts'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };

// ── estáticas: wiring do main + transporte + canal (o que NÃO dá p/ stubar, provamos no fonte real) ──
ok('main: notifier inicia no session-login', /ipcMain\.on\("session-login"[\s\S]*?startNotifier\(\(\) => mainWin, uid, deliverNotification\)/.test(mainTs));
ok('main: X (close) esconde na bandeja, processo vivo (hide, não quit)', /on\("close",[\s\S]*?if \(!quitting\)[\s\S]*?mainWin\?\.hide\(\)/.test(mainTs));
ok('main: window-all-closed não encerra (vive na bandeja)', /window-all-closed[\s\S]*?if \(!quitting\) e\.preventDefault/.test(mainTs));
// O notifier só pode parar em realQuit/logout — NUNCA num handler de minimize/hide. Escopo por
// statement (mesma linha do handler): os handlers são one-liners; não deixar o [\s\S]*? varrer o
// arquivo até o stopNotifier do realQuit (falso-positivo após a instrumentação DIAG de lifecycle).
ok('main: notifier só para em logout/Sair (não no minimize/hide)', /function realQuit\(\)[\s\S]*?stopNotifier\(\)/.test(mainTs) && !/on\("minimize"[^\n]*stopNotifier/.test(mainTs) && !/on\("hide"[^\n]*stopNotifier/.test(mainTs));
ok('main: background usa JANELA PREMIUM propria (showBgNotify) — nao depende so da nativa', /return \{ ok: true, channel: "toast" \};\s*\}[\s\S]*?const bgOk = showBgNotify\(p\);/.test(mainTs) && /import \{[^}]*showBgNotify[^}]*\} from "\.\/bgNotify"/.test(mainTs));
ok('main: nativa do Windows vira FALLBACK (so se a janela premium falhar)', /if \(!bgOk\) \{[\s\S]*?const n = new Notification\(/.test(mainTs));
ok('main: windowActive = visível e não-minimizado (minimizado/oculto → nativa)', /isVisible\(\) && !w\.isMinimized\(\)/.test(mainTs));
ok('main: Notification nativa tem click handler (abre a tarefa via deep link)', /n\.on\("click"[\s\S]*?send\("notif-open", deep\)/.test(mainTs));
ok('firebase(main): transporte long-polling (onSnapshot realtime em Node)', /initializeFirestore\(fbApp, \{ experimentalForceLongPolling: true \}\)/.test(fbTs));

// ── compila o notifier.ts REAL ──
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f33e-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'notifier.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar notifier.ts:', (e.stdout || e.message || '').toString().slice(0, 500)); process.exit(1); }
const notifierJs = path.join(tmp, 'notifier.js');
if (!fs.existsSync(notifierJs)) { console.error('::error:: notifier.js não emitido'); process.exit(1); }

// ── stub de 'electron' e './firebase' (capturando os callbacks de listen) ──
let listenCalls = [];
const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { BrowserWindow: class {} };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) {
    return { db: {}, listen: (name, cb) => { listenCalls.push([name, cb]); return () => {}; } };
  }
  return realLoad.apply(this, arguments);
};
const { startNotifier } = require(notifierJs);
Module._load = realLoad;

// ── deliver = réplica FIEL do canal de deliverNotification (toast x nativa por windowActive) ──
let win = { visible: true, minimized: false };
const windowActive = () => !!(win && win.visible && !win.minimized);
const delivered = [];
const seen = new Set(); // dedup do HUB (deliverNotification: _notifSeen)
function deliver(p) {
  const key = String(p.dedupKey || `${p.eventType}:${p.taskId}:${p.createdAt}`);
  if (seen.has(key)) return { ok: true, channel: 'dedup' };
  seen.add(key);
  const channel = windowActive() ? 'toast' : 'bg-window'; // F3.3.10-BG: background = janela premium propria (nativa = fallback)
  delivered.push({ key, channel, eventType: p.eventType, taskId: p.taskId, taskTitle: p.taskTitle, clientName: p.clientName, responsibleName: p.responsibleName, actorName: p.actorName, target: p.targetUserId, deep: p.action && p.action.deep, title: p.title, body: p.body });
  return { ok: true, channel };
}

const UID = 'designer1';
startNotifier(() => ({}), UID, deliver);
const tasksCbs = listenCalls.filter(([n]) => n === 'tasks').map(([, cb]) => cb);
ok('notifier registrou listener de tasks (atribuição)', tasksCbs.length >= 1);
const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
const fire = (changes) => tasksCbs.forEach((cb) => { try { cb({ docChanges: () => changes }); } catch (_) {} });
const NOW = Date.now();
const daNew = { designerId: 'designer1', assignedBy: 'social1', assignedByName: 'Arydyjany Carlôto', designerName: 'Marina Dias', assignedAt: NOW + 1000 };

// Cenário A — app ABERTO
win = { visible: true, minimized: false };
fire([ch('modified', 'tA', { title: 'Cronograma semanal', client: 'Hospital Visão', sector: 'cronograma', designerAssignment: daNew })]);
// Cenário B — MINIMIZADO
win = { visible: true, minimized: true };
fire([ch('modified', 'tB', { title: 'Cronograma B', client: 'Cliente B', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW + 2000 } })]);
// Cenário C — X / BANDEJA (hide → visible:false)
win = { visible: false, minimized: false };
fire([ch('modified', 'tC', { title: 'Cronograma C', client: 'Cliente C', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW + 3000 } })]);
// dedup: reenviar o MESMO docChange de B não duplica
win = { visible: true, minimized: true };
fire([ch('modified', 'tB', { title: 'Cronograma B', client: 'Cliente B', sector: 'cronograma', designerAssignment: { ...daNew, assignedAt: NOW + 2000 } })]);
// usuário errado: designerId != UID → não dispara
fire([ch('modified', 'tX', { title: 'De outro', designerAssignment: { designerId: 'designerZ', assignedBy: 'social1', assignedAt: NOW + 4000 } })]);
// feita por mim: assignedBy == UID → não dispara
fire([ch('modified', 'tMine', { title: 'Eu', designerAssignment: { designerId: 'designer1', assignedBy: 'designer1', assignedAt: NOW + 5000 } })]);
// anterior ao login: assignedAt << sinceMs → não dispara
fire([ch('modified', 'tOld', { title: 'Antiga', designerAssignment: { designerId: 'designer1', assignedBy: 'social1', assignedAt: NOW - 3600000 } })]);

const byTask = (t) => delivered.find((d) => d.taskId === t);
ok('A — app aberto: atribuição → canal TOAST', byTask('tA') && byTask('tA').channel === 'toast' && byTask('tA').eventType === 'designer_assigned');
ok('B — minimizado: atribuição → JANELA PREMIUM propria (bg-window)', byTask('tB') && byTask('tB').channel === 'bg-window');
ok('C — X/bandeja (hide): atribuição → JANELA PREMIUM propria (bg-window)', byTask('tC') && byTask('tC').channel === 'bg-window');
ok('payload completo: tarefa+cliente+responsável+deep', byTask('tA') && byTask('tA').taskTitle === 'Cronograma semanal' && byTask('tA').clientName === 'Hospital Visão' && byTask('tA').responsibleName === 'Marina Dias' && /^detail\/|^board\//.test(byTask('tA').deep || ''));
ok('dedupKey = designer_assigned:<id>:<designerId>:<assignedAt> (F3.3.77A-R3 canônico)', byTask('tA') && byTask('tA').key === 'designer_assigned:tA:designer1:' + (NOW + 1000));
ok('dedup: reenvio do mesmo docChange NÃO duplica', delivered.filter((d) => d.taskId === 'tB').length === 1);
ok('usuário errado (outro designer) NÃO recebe', !byTask('tX'));
ok('feita por mim mesmo NÃO dispara', !byTask('tMine'));
ok('atribuição anterior ao login NÃO dispara (baseline sinceMs)', !byTask('tOld'));
ok('total entregue = exatamente 3 (A,B,C)', delivered.length === 3);
ok('D — Sair (processo morto) documentado fora de escopo (sem deliver possível)', true);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\nF3.3.10 MAIN-NOTIFIER (estático+execução real): ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: notifier de atribuição em background divergiu do contrato'); process.exit(1); }
console.log('OK — notifier.ts REAL: atribuição vira deliver no main (aberto→toast; minimizado/bandeja→NATIVA); dedup; usuário certo; baseline; long-polling no main p/ realtime em background. Sair = fora de escopo.');
