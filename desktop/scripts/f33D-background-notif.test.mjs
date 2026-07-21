#!/usr/bin/env node
/* F3.3.10-DESKTOP — TESTE: ATRIBUIÇÃO confiável em BACKGROUND (minimizado/bandeja).
 *
 * Causa: a atribuição Social→Designer nascia só no notifier do MAIN (Firestore). Com o app em
 * background (minimizado/X→bandeja) o processo do main pode ser suspenso pelo SO e o listener
 * estagna → nenhuma nativa. Correção: o RENDERER também detecta a atribuição (notifScanAssign,
 * espelhando u1/u1b do main) e emite pelo MESMO caminho aprovado (notifEmit → api.notify → HUB:
 * toast com app aberto / NATIVA minimizado/bandeja), com dedupKey IDÊNTICO ao do main → o HUB
 * deduplica (nunca duplica). O renderer roda em background (backgroundThrottling:false + switches).
 *
 * -----------------------------------------------------------------------------
 * F3.4.3C — reescrito para o contrato produtor-único-no-main (substitui o contrato antigo;
 * histórico no Git). A confiabilidade em background NÃO depende mais de o RENDERER espelhar a
 * atribuição: o PROCESSO MAIN (notifier.ts) é o produtor ÚNICO e autoritativo — nunca é suspenso
 * pelo Chromium (ao contrário do renderer minimizado/bandeja). Ele detecta a atribuição por
 * TRANSIÇÃO (semente no 1º snapshot; emite só mudanças), usa o listener Firestore long-polling do
 * main e entrega pelo MESMO deliverNotification (toast visível / bg-window minimizado-oculto) com
 * dedupKey canônico. O renderer NÃO emite mais atribuição (notifScanAssign segue DEFINIDO mas SEM
 * chamadores). Prova por EXECUÇÃO do notifier.ts REAL (compilado) nas 3 janelas + estática do
 * renderer/main. Puro Node: sem Chromium, sem rede, sem build.
 */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { extractDeliver } from './fixtures/f343/deliver-harness.mjs';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const NT = fs.readFileSync(path.join(DESK, 'src', 'main', 'notifier.ts'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };

/* ── estáticas: PRODUTOR ÚNICO no MAIN; renderer só-visual ── */
ok('renderer: notifScan só roda o FLUXO (não emite SLA/atribuição)', /function notifScan\(\)\{ notifScanFlow\(\); \}/.test(HTML));
ok('renderer: notifScanAssign/notifScanSla DEFINIDOS mas SEM chamadores (visual preservado)',
  /function notifScanAssign\(\)/.test(HTML) && /function notifScanSla\(\)/.test(HTML) &&
  (HTML.match(/notifScanAssign\(\)/g) || []).length === 1 && (HTML.match(/notifScanSla\(\)/g) || []).length === 1);
ok('main: notifier é o produtor (startNotifier no login) + listener Firestore no main', /startNotifier\(\(\) => mainWin, uid, deliverNotification\)/.test(MAIN) && /listen<Task>\("tasks"/.test(NT));
ok('notifier: dedupKey CANÔNICO designer_assigned:<id>:<designerId>:<at> (fallback sem at)',
  /const _canonKey = at \? `designer_assigned:\$\{t\.id\}:\$\{da\.designerId \|\| ""\}:\$\{at\}` : `designer_assigned:\$\{t\.id\}:\$\{da\.designerId \|\| ""\}`;/.test(NT));
ok('notifier: detecção por TRANSIÇÃO (semente no 1º snapshot; emite mudança), sem hard-drop por assignedAt no CÓDIGO',
  /if \(firstRun\) return;\s*\/\/ BASELINE SEED/.test(NT) && /const changed = \(prev !== cur\) \|\| \(at !== prevAt\);/.test(NT) && !/if \([^)]*assignedAt[^)]*< [^)]*sinceMs[^)]*\)\s*return/.test(NT) && !/at < state\.sinceMs/.test(NT));
ok('main: canal windowActive → toast; background → janela premium (showBgNotify), nativa fallback',
  /if \(windowActive\(\)\) \{[\s\S]*?return \{ ok: true, channel: "toast" \};\s*\}[\s\S]*?const bgOk = showBgNotify\(p\);[\s\S]*?if \(!bgOk\) \{[\s\S]*?new Notification\(/.test(MAIN));
ok('main: windowActive = visível e não-minimizado (minimizado/oculto → background)', /isVisible\(\) && !w\.isMinimized\(\)/.test(MAIN));
ok('main: switches anti-suspensão de background (renderer não congela o visual)', /disable-renderer-backgrounding/.test(MAIN) && /disable-background-timer-throttling/.test(MAIN));

/* ── compila o notifier.ts REAL e stuba electron/firebase (captura os listeners) ── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f33d-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'notifier.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar notifier.ts:', (e.stdout || e.message || '').toString().slice(0, 600)); process.exit(1); }
let listenCalls = [];
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { BrowserWindow: class {} };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { db: {}, listen: (name, cb) => { listenCalls.push([name, cb]); return () => {}; } };
  return realLoad.apply(this, arguments);
};
const { startNotifier } = require(path.join(tmp, 'notifier.js'));
Module._load = realLoad;

/* ── canal REAL (deliverNotification do main.ts) com estado de janela ajustável ── */
const chan = extractDeliver(MAIN);
let winState = 'visible';
const delivered = [];
function routedDeliver(p) { const r = chan.deliver(winState, p); delivered.push({ taskId: p.taskId, channel: r.res.channel, dedupKey: p.dedupKey, eventType: p.eventType, target: p.targetUserId, deep: p.action && p.action.deep }); return r.res; }

const UID = 'designer1', SOC = 'social1';
startNotifier(() => ({}), UID, routedDeliver);
const tasksCbs = listenCalls.filter(([n]) => n === 'tasks').map(([, cb]) => cb);
ok('notifier registrou listener(s) de tasks no MAIN', tasksCbs.length >= 1);
const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
const fire = (changes) => tasksCbs.forEach((cb) => { try { cb({ docChanges: () => changes }); } catch (_) {} });
const da = (designerId, at) => ({ designerId, designerName: 'Marina Dias', assignedBy: SOC, assignedByName: 'Arydyjany Carlôto', assignedAt: at });
const task = (id, designerId, at) => ({ title: 'Cronograma semanal', client: 'Hospital Visão', sector: 'cronograma', designerAssignment: da(designerId, at) });
const NOW = 1700000000000;

/* SEED — 1º snapshot marca o histórico SEM emitir (baseline), robusto a clock-skew (sem comparar relógios) */
fire([ch('added', 'tOld', task('tOld', UID, NOW - 2 * 3600000)), ch('added', 'tOther', task('tOther', 'designerX', NOW))]);
ok('SEED: histórico do 1º snapshot NÃO dispara (baseline por semente)', delivered.length === 0);

/* app ABERTO/visível → toast */
winState = 'visible';
fire([ch('modified', 'tA', task('tA', UID, NOW + 1000))]);
const dA = delivered.find((d) => d.taskId === 'tA');
ok('app VISÍVEL: atribuição nova → canal toast (designer_assigned canônico)', dA && dA.channel === 'toast' && dA.eventType === 'designer_assigned' && dA.dedupKey === 'designer_assigned:tA:designer1:' + (NOW + 1000) && dA.deep === 'detail/tA');

/* MINIMIZADO → bg-window */
winState = 'minimized';
fire([ch('modified', 'tB', task('tB', UID, NOW + 2000))]);
ok('app MINIMIZADO: atribuição → janela premium (bg-window)', (delivered.find((d) => d.taskId === 'tB') || {}).channel === 'bg-window');

/* OCULTO (X/bandeja) → bg-window */
winState = 'hidden';
fire([ch('modified', 'tC', task('tC', UID, NOW + 3000))]);
ok('app OCULTO (bandeja): atribuição → janela premium (bg-window)', (delivered.find((d) => d.taskId === 'tC') || {}).channel === 'bg-window');

/* dedupe canônico: reenvio idêntico NÃO duplica */
const before = delivered.length;
fire([ch('modified', 'tB', task('tB', UID, NOW + 2000))]);
ok('dedupe canônico: reenvio idêntico NÃO duplica (guard de transição + HUB)', delivered.length === before);

/* usuário certo: outro designer / auto-atribuição não notificam a mim */
fire([ch('modified', 'tX', task('tX', 'designerZ', NOW + 4000))]);
ok('usuário errado (outro designer) NÃO me notifica', !delivered.find((d) => d.taskId === 'tX'));
fire([ch('modified', 'tMine', { title: 'Eu', designerAssignment: { designerId: UID, assignedBy: UID, assignedAt: NOW + 5000 } })]);
ok('anti-eco: auto-atribuição (assignedBy===me) não dispara', !delivered.find((d) => d.taskId === 'tMine'));

/* atribuição ANTIGA que chega AO VIVO (transição nova) NÃO é hard-dropada por assignedAt antigo */
fire([ch('modified', 'tLate', task('tLate', UID, NOW - 6 * 3600000))]);
ok('sem hard-drop por relógio: transição AO VIVO com assignedAt antigo AINDA dispara (autoritativo)', !!delivered.find((d) => d.taskId === 'tLate'));

ok('total: exatamente as transições elegíveis foram entregues (tA,tB,tC,tLate)', delivered.length === 4);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\nF3.3.10 (F3.4.3C) BACKGROUND-NOTIF — produtor único no MAIN: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: atribuição em background divergiu do contrato produtor-único-no-main'); process.exit(1); }
console.log('OK — atribuição detectada NO MAIN por transição (não no renderer), entregue pelo deliverNotification nas 3 janelas (visível→toast, min/oculto→bg-window), dedupe canônico, usuário certo, sem hard-drop por relógio.');
