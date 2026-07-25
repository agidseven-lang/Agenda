#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — ATRIBUIÇÃO Social→Designer: MAIN autoritativo por TRANSIÇÃO (notifier.ts REAL).
 * Cobre: 1 atribuição visível→toast · 2 minimizado→bg · 3 oculto(X)→bg · 4 duplicada não duplica ·
 * 5 mudança de designer notifica UMA vez. Compila o notifier.ts REAL, stuba electron/firebase,
 * roteia cada entrega pelo deliverNotification REAL (extraído do main.ts) nos 3 estados de janela.
 * ===================================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { extractDeliver } from './fixtures/f343/deliver-harness.mjs';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

/* ── compila o notifier.ts REAL ── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f343at-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'notifier.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar notifier.ts:', (e.stdout || e.message || '').toString().slice(0, 600)); process.exit(1); }
const notifierJs = path.join(tmp, 'notifier.js');

/* ── stub de electron + ./firebase (captura os callbacks de listen) ── */
let listenCalls = [];
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { BrowserWindow: class {} };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { db: {}, listen: (name, cb) => { listenCalls.push([name, cb]); return () => {}; } };
  if (request === './slaRules' || /[\\/]slaRules(\.js)?$/.test(request)) return realLoad.call(this, path.join(DESK, 'src', 'main', 'slaRules.js'), arguments[1], false); // F3.4.7 harness fix: notifier.ts passou a require('./slaRules') na F3.4.4 (mock ausente desde 1.0.181)
  return realLoad.apply(this, arguments);
};
const { startNotifier } = require(notifierJs);
Module._load = realLoad;

/* ── canal REAL (deliverNotification do main.ts) com estado de janela ajustável ── */
const chan = extractDeliver(MAIN);
let winState = 'visible';
const delivered = [];
function routedDeliver(p) { const r = chan.deliver(winState, p); delivered.push({ taskId: p.taskId, channel: r.res.channel, dedupKey: p.dedupKey, eventType: p.eventType, actorName: p.actorName, responsibleName: p.responsibleName, deep: p.action && p.action.deep }); return r.res; }

const UID = 'dz1', SOC = 'soc1';
startNotifier(() => ({}), UID, routedDeliver);
const tasksCbs = listenCalls.filter(([n]) => n === 'tasks').map(([, cb]) => cb);
ok('notifier registrou listener(s) de tasks', tasksCbs.length >= 1);
const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
const fire = (changes) => tasksCbs.forEach((cb) => { try { cb({ docChanges: () => changes }); } catch (e) { /* */ } });
const da = (designerId, at, by) => ({ designerId, designerName: 'Marina Dias', designerAvatar: 'https://img/m.jpg', assignedBy: by || SOC, assignedByName: 'Social Ana', assignedAt: at });
const task = (id, designerId, at, by) => ({ title: 'Cronograma', client: 'Hosp', sector: 'cronograma', designerAssignment: da(designerId, at, by) });

const NOW = 1700000000000;
/* SEED: 1º snapshot = baseline (marca pré-existentes SEM emitir). Inclui uma atribuição ANTIGA p/ mim. */
fire([ch('added', 'tSeed', task('tSeed', UID, NOW - 3600000))]);
ok('SEED: atribuição pré-existente no 1º snapshot NÃO dispara (baseline)', delivered.length === 0);

/* 1 — VISÍVEL → toast */
winState = 'visible';
fire([ch('modified', 'tA', task('tA', UID, NOW + 1000))]);
const dA = delivered.find((d) => d.taskId === 'tA');
ok('1 atribuição com janela VISÍVEL → canal toast', dA && dA.channel === 'toast' && dA.eventType === 'designer_assigned');
ok('1 payload rico: ator=Social, responsável=Designer, deep=detail/tA', dA && dA.actorName === 'Social Ana' && dA.responsibleName === 'Marina Dias' && dA.deep === 'detail/tA');
ok('1 dedupKey canônico designer_assigned:tA:dz1:<at>', dA && dA.dedupKey === 'designer_assigned:tA:dz1:' + (NOW + 1000));

/* 2 — MINIMIZADO → bg-window */
winState = 'minimized';
fire([ch('modified', 'tB', task('tB', UID, NOW + 2000))]);
const dB = delivered.find((d) => d.taskId === 'tB');
ok('2 atribuição MINIMIZADO → canal bg-window', dB && dB.channel === 'bg-window');

/* 3 — OCULTO (X/bandeja) → bg-window */
winState = 'hidden';
fire([ch('modified', 'tC', task('tC', UID, NOW + 3000))]);
const dC = delivered.find((d) => d.taskId === 'tC');
ok('3 atribuição OCULTO (bandeja) → canal bg-window', dC && dC.channel === 'bg-window');

/* 4 — DUPLICADA (mesmo snapshot) não duplica */
const before4 = delivered.length;
winState = 'minimized';
fire([ch('modified', 'tB', task('tB', UID, NOW + 2000))]); // idêntico ao de tB
ok('4 atribuição idêntica reenviada NÃO duplica (guard de transição + dedup do HUB)', delivered.length === before4);

/* 5 — MUDANÇA DE DESIGNER notifica UMA vez */
// tE começa atribuída a OUTRO designer (seed-like via 1ª aparição = added pós-seed com outro designer).
fire([ch('added', 'tE', task('tE', 'dzOTHER', NOW + 4000))]);
const before5 = delivered.length;
ok('5a atribuição a OUTRO designer não me notifica', !delivered.find((d) => d.taskId === 'tE'));
// agora reatribuída A MIM (transição dzOTHER → dz1)
winState = 'visible';
fire([ch('modified', 'tE', task('tE', UID, NOW + 5000))]);
const dE = delivered.filter((d) => d.taskId === 'tE');
ok('5b mudança de designer p/ mim → notifica UMA vez', dE.length === 1 && dE[0].dedupKey === 'designer_assigned:tE:dz1:' + (NOW + 5000));
// re-scan idêntico → não duplica
fire([ch('modified', 'tE', task('tE', UID, NOW + 5000))]);
ok('5c re-scan da mesma atribuição → sem duplicar', delivered.filter((d) => d.taskId === 'tE').length === 1);

/* anti-eco: auto-atribuição (assignedBy===me) não dispara */
fire([ch('modified', 'tMine', task('tMine', UID, NOW + 6000, UID))]);
ok('anti-eco: auto-atribuição (assignedBy===me) não dispara', !delivered.find((d) => d.taskId === 'tMine'));
/* usuário errado (outro designer) não me notifica */
fire([ch('modified', 'tX', task('tX', 'dzZZZ', NOW + 7000))]);
ok('usuário errado (designerId≠me) não dispara', !delivered.find((d) => d.taskId === 'tX'));

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
console.log('\n===== F3.4.3 — ASSIGNMENT TRANSITION (notifier.ts REAL, 3 janelas) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-ASSIGN: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: atribuição autoritativa no main divergiu do contrato'); process.exit(1); }
console.log('OK — main detecta a atribuição por TRANSIÇÃO nas 3 janelas (visível→toast, min/oculto→bg), sem duplicar, mudança de designer 1×.');
