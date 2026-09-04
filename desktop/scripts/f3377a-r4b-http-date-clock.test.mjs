#!/usr/bin/env node
/* =====================================================================
   F3.3.77A-R4B — RELÓGIO CANÔNICO por cabeçalho HTTP `Date` (Cloud Run read-only)
   ---------------------------------------------------------------------
   Prova a sincronização Desktop-only aprovada (Opção B): o MAIN deriva um offset do cabeçalho
   HTTP `Date` de um endpoint Cloud Run JÁ EXISTENTE (getUserSelf), sondado SEM autenticação
   (rejeitado antes da lógica de negócio ⇒ ZERO mutação/lastSeen), e empurra o offset ao renderer,
   que alimenta canonicalNowMs()/_slaClockOffsetMs e rearma as timelines de SLA. Máquinas com
   relógios locais divergentes passam a convergir para o MESMO instante canônico.

   Sem Firestore/Rules/Firebase Auth/endpoint novo/Worker/Cloud Functions/backend.

   Executa as funções PURAS reais de clockSync (evalSample/chooseOffset/uncertaintyOf/qualityOf)
   + asserções estáticas do contrato (main/preload/renderer). RED×GREEN. Puro Node.

   -----------------------------------------------------------------------------
   F3.4.3C — reescrito para o contrato produtor-único-no-main (substitui o contrato antigo;
   histórico no Git). O offset canônico continua a mesma matemática read-only do clockSync, mas
   quem CONSOME o "agora" canônico para EMITIR SLA agora é o PROCESSO MAIN (slaScheduler via
   slaNow), não o renderer. O renderer só aplica o offset ao VISUAL (_slaApplyClockState →
   _slaClockOffsetMs) e NÃO chama mais notifScanSla/notifScanAssign. Provado por EXECUÇÃO das
   funções puras do clockSync REAL + do slaScheduler REAL dirigido pelo relógio canônico injetável,
   e por estática do wiring (main slaNow/reconcile; renderer só-visual).
   ===================================================================== */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import Module from 'node:module';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
import { extractDeliver } from './fixtures/f343/deliver-harness.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(DESK, p), 'utf8');
const CS = rd('src/main/clockSync.ts');
const MAIN = rd('src/main/main.ts');
const PRELOAD = rd('src/preload/preload.ts');
const H = rd('src/renderer/index.html');
const SCHED = rd('src/main/slaScheduler.ts');
const NT = rd('src/main/notifier.ts');
const REAL_SLARULES = path.join(DESK, 'src', 'main', 'slaRules.js');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.log('  FAIL — ' + n); } };

console.log('== F3.3.77A-R4B (F3.4.3C) — relógio canônico HTTP Date + produtor de SLA no MAIN ==');

/* ─────────── carrega as funções PURAS REAIS do clockSync (dist ou compila on-the-fly) ─────────── */
function loadClockSync() {
  let target = path.join(DESK, 'dist', 'main', 'clockSync.js');
  if (!fs.existsSync(target)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r4b-'));
    execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
      path.join(DESK, 'src', 'main', 'clockSync.ts'), '--outDir', tmp, '--module', 'commonjs',
      '--target', 'es2020', '--lib', 'es2022,dom', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
    target = path.join(tmp, 'clockSync.js');
  }
  const realLoad = Module._load;
  Module._load = function (req) { if (req === 'electron') return { app: { getPath: () => os.tmpdir() } }; if (req === './diag' || /[\\/]diag(\.js)?$/.test(req)) return { diag: () => {}, diagPath: () => '' }; return realLoad.apply(this, arguments); };
  try { return require(target); } finally { Module._load = realLoad; }
}
const clk = loadClockSync();
const MIN = 60000;
const mkProbe = (over) => Object.assign({ ok: true, status: 401, serverDateMs: 1700000000000, t0Wall: 1700000000000, t1Wall: 1700000000200, t0Mono: 1000, t1Mono: 1200, ageSeconds: -1 }, over || {});

/* ═══════════════ FUNÇÕES PURAS (execução real do clockSync) ═══════════════ */
ok('U1 evalSample: offset = serverDate − midpoint(wall); rtt = t1Mono−t0Mono',
  (() => { const s = clk.evalSample(mkProbe({ serverDateMs: 1700000000100, t0Wall: 1700000000000, t1Wall: 1700000000200 }), 4000); return s && s.offsetMs === 0 && s.rttMs === 200; })());
ok('U2 [RED3] amostra CACHEADA (Age>0) é REJEITADA', clk.evalSample(mkProbe({ ageSeconds: 5 }), 4000) === null);
ok('U3 [RED2] amostra sem Date (serverDateMs=0) é rejeitada', clk.evalSample(mkProbe({ serverDateMs: 0 }), 4000) === null);
ok('U4 amostra com RTT acima do limite é rejeitada', clk.evalSample(mkProbe({ t0Mono: 0, t1Mono: 9000 }), 4000) === null);
ok('U5 status 5xx (servidor instável) é rejeitado', clk.evalSample(mkProbe({ status: 503 }), 4000) === null);
ok('U6 incerteza = rtt/2 + 1000 (resolução de 1s do Date)', clk.uncertaintyOf(600) === 1300 && clk.uncertaintyOf(2000) === 2000);
ok('U7 quality synced quando incerteza ≤ 2000; degraded acima', clk.qualityOf(2000) === 'synced' && clk.qualityOf(2001) === 'degraded');
ok('U8 chooseOffset = MEDIANA das 3 amostras de MENOR RTT (não média)',
  (() => { const s = clk.chooseOffset([{ offsetMs: 100, rttMs: 50 }, { offsetMs: 300, rttMs: 60 }, { offsetMs: 5000, rttMs: 3000 }, { offsetMs: 200, rttMs: 40 }]); return s && s.offsetMs === 200 && s.rttMs === 40; })());
ok('U9 chooseOffset sem amostras válidas → null', clk.chooseOffset([]) === null);

/* ═══════════════ RED×GREEN — CONVERGÊNCIA ENTRE MÁQUINAS ═══════════════ */
{
  const trueTime = 1700000000000;
  const SKEW_A = +3 * MIN, SKEW_B = -2 * MIN;
  const probeFor = (skew) => mkProbe({ serverDateMs: trueTime, t0Wall: trueTime + skew - 100, t1Wall: trueTime + skew + 100, t0Mono: 0, t1Mono: 200 });
  const offA = clk.evalSample(probeFor(SKEW_A), 4000).offsetMs;
  const offB = clk.evalSample(probeFor(SKEW_B), 4000).offsetMs;
  const canonA = (trueTime + SKEW_A) + offA, canonB = (trueTime + SKEW_B) + offB;
  ok('RED1 SEM offset: máquinas +3min/−2min divergem ~5min', Math.abs((trueTime + SKEW_A) - (trueTime + SKEW_B)) === 5 * MIN);
  ok('GREEN12 cronômetros CONVERGEM: |canonA − canonB| ≤ 2000ms', Math.abs(canonA - canonB) <= 2000);
  ok('GREEN13 ambos apontam ao instante real do servidor (±1s)', Math.abs(canonA - trueTime) <= 1000 && Math.abs(canonB - trueTime) <= 1000);
}

/* ═══════════════ CONTRATO clockSync.ts (estático; sonda read-only) ═══════════════ */
ok('C1 SONDA read-only: GET, SEM Authorization (zero mutação/lastSeen)', /method:\s*"GET"/.test(CS) && !/["']Authorization["']\s*:/.test(CS));
ok('C2 endpoint EXISTENTE (getUserSelf); override por env p/ testes', /IDS_AUTH_SELF_URL/.test(CS) && /getuserself-de36pi7vza-uc\.a\.run\.app/.test(CS));
ok('C3 no-store / no-cache', /cache:\s*"no-store"/.test(CS) && /"Cache-Control":\s*"no-store"/.test(CS));
ok('C4 midpoint: offset = serverDate − (t0Wall+t1Wall)/2', /p\.serverDateMs\s*-\s*midpointMs/.test(CS) && /\(p\.t0Wall\s*\+\s*p\.t1Wall\)\s*\/\s*2/.test(CS));
ok('C5 incerteza inclui a resolução de 1s do Date e gate de 2s', /HTTP_DATE_RESOLUTION_MS\s*=\s*1000/.test(CS) && /UNCERTAINTY_SYNCED_MS\s*=\s*2000/.test(CS));
ok('C6 5 amostras no login, 3 no ciclo; mediana das melhores', /LOGIN_SAMPLES\s*=\s*5/.test(CS) && /CYCLE_SAMPLES\s*=\s*3/.test(CS));
ok('C7 qualidades synced/degraded/stale/local_fallback/error', /"synced"\s*\|\s*"degraded"\s*\|\s*"stale"\s*\|\s*"local_fallback"\s*\|\s*"error"/.test(CS));
ok('C8 estado ClockState NÃO carrega token/URL/headers/corpo',
  (() => { const m = CS.match(/export type ClockState = \{[\s\S]*?\};/); const blk = (m ? m[0] : '').replace(/\/\/[^\n]*/g, ''); return /offsetMs:/.test(blk) && /quality:/.test(blk) && !/\b(token|authorization|headers|body|url)\s*[?:]/i.test(blk); })());

/* ═══════════════ WIRING NO MAIN — o offset canônico ALIMENTA o produtor de SLA do MAIN ═══════════════ */
ok('M1 clockSync LIGA no login e emite "clock-state" ao renderer (só o objeto sanitizado)',
  /clockSync = createClockSync\(/.test(MAIN) && /webContents\.send\("clock-state", s\)/.test(MAIN));
ok('M2 IPC clock-get-state / clock-request-sync', /ipcMain\.handle\("clock-get-state"/.test(MAIN) && /ipcMain\.handle\("clock-request-sync"/.test(MAIN));
ok('M3 resume/unlock → requestSync do relógio E reconcile do slaScheduler (SLA perdido no sleep)',
  /powerMonitor\.on\("resume"[\s\S]{0,160}requestSync\("resume"\)[\s\S]{0,120}slaScheduler\.reconcile\("resume"\)/.test(MAIN) &&
  /powerMonitor\.on\("unlock-screen"[\s\S]{0,160}requestSync\("unlock"\)[\s\S]{0,120}slaScheduler\.reconcile\("unlock"\)/.test(MAIN));
ok('M4 slaNow (agora canônico do MAIN) espelha o gate de offset do renderer',
  /function slaNow\(\): number/.test(MAIN) && /q === "synced" \|\| q === "degraded" \|\| q === "stale"/.test(MAIN) && /clockSync\.getState\(\)/.test(MAIN));
ok('M5 slaScheduler é o produtor único (now: slaNow) e o notifier segue no main',
  /slaScheduler = startSlaScheduler\(\(\) => uid, deliverNotification, \{ now: slaNow, authUser: getAuthUser \}\)/.test(MAIN) &&
  /startNotifier\(\(\) => mainWin, uid, deliverNotification, getAuthUser\)/.test(MAIN));

/* ═══════════════ PRELOAD (estático) ═══════════════ */
ok('P1 preload expõe clockGetState/clockRequestSync/onClockState', /clockGetState:/.test(PRELOAD) && /clockRequestSync:/.test(PRELOAD) && /onClockState:/.test(PRELOAD));
ok('P2 preload NÃO expõe token/URL/headers do relógio (só o estado)', !/clockToken|clockUrl/.test(PRELOAD));

/* ═══════════════ RENDERER — só VISUAL; NÃO emite mais SLA ═══════════════ */
ok('R1 _slaApplyClockState alimenta _slaClockOffsetMs (VISUAL) a partir do estado do MAIN', /function _slaApplyClockState\(s\)\{/.test(H) && /_slaClockOffsetMs=newOffset;/.test(H));
ok('R2 synced/degraded/stale usam o offset; senão relógio local (offset 0)', /useOffset=\(q==='synced'\|\|q==='degraded'\|\|q==='stale'\)/.test(H) && /newOffset=useOffset\?Math\.round\(s\.offsetMs\):0/.test(H));
ok('R3 [F3.4.3C] _slaApplyClockState NÃO chama notifScanSla (produtor migrou p/ o MAIN)', !/function _slaApplyClockState[\s\S]{0,900}notifScanSla\(\)/.test(H));
ok('R4 renderer não emite SLA/atribuição: notifScan só roda o fluxo; scans sem chamadores',
  /function notifScan\(\)\{\}/.test(H) && (H.match(/notifScanSla\(\)/g) || []).length === 1 && (H.match(/notifScanAssign\(\)/g) || []).length === 1);
ok('R5 registra onClockState + consulta clockGetState no boot', /onClockState\(_slaApplyClockState\)/.test(H) && /clockGetState\(\)\.then\(function\(s\)\{ _slaApplyClockState\(s\)/.test(H));
ok('R6 retomada (resume/focus) também pede clockRequestSync', /typeof window\.desktopAPI\.clockRequestSync==='function'\) window\.desktopAPI\.clockRequestSync\(\)/.test(H));
ok('R7 canonicalNowMs() continua a fonte única do VISUAL', /function canonicalNowMs\(\)\{ return Date\.now\(\)\+_slaClockOffsetMs; \}/.test(H));

/* ═══════════════ EXECUÇÃO — o relógio canônico DIRIGE o produtor de SLA do MAIN ═══════════════
   Prova que o "agora" canônico (offset do clockSync) é o que decide a emissão NO MAIN: um prazo que,
   pelo relógio LOCAL, ainda está "em prazo" vira AMARELO quando o offset canônico avança o relógio. */
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r4bsch-'));
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'slaScheduler.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
  const realLoad = Module._load;
  Module._load = function (request) {
    if (request === 'electron') return { app: null };
    if (/[\\/]firebase(\.js)?$/.test(request) || request === './firebase') return { listen: () => () => {} };
    if (/[\\/]diag(\.js)?$/.test(request) || request === './diag') return { diag: () => {} };
    if (/[\\/]slaRules(\.js)?$/.test(request) || request === './slaRules') return realLoad.call(this, REAL_SLARULES, arguments[1], false);
    return realLoad.apply(this, arguments);
  };
  const { startSlaScheduler } = require(path.join(tmp, 'slaScheduler.js'));
  Module._load = realLoad;

  const chan = extractDeliver(MAIN);
  const WALL = 1700000000000; let CANON = WALL; let listenCb = null; const delivered = [];
  const sched = startSlaScheduler(() => 'dz1', (p) => { const r = chan.deliver('visible', p); delivered.push(p.eventType); return r.res; }, {
    cardsRules: { cardsEmissionsFor: () => [], cardsNextBoundaryMs: () => 0 }, // F3.5.2 — mock explícito (cards testados à parte)
    escalationRules: { escalationEmissionsFor: () => [], escalationNextBoundaryMs: () => 0 }, // I7.27.1-EXT — mock explícito (escalação de prazo testada à parte: f7271ext)
    now: () => CANON, listen: (n, cb) => { if (n === 'tasks') listenCb = cb; return () => {}; },
    seen: new Set(), setTimer: () => ({}), clearTimer: () => {}, onLog: () => {}, safetyMaxMs: 60000,
  });
  const cron = (due) => ({ id: 'tk', title: 'Cronograma', client: 'H', sector: 'cronograma', designerAssignment: { designerId: 'dz1', designerName: 'M' }, designerFlowStatus: 'afazer', designerSla: { planDueAt: due } });
  listenCb({ docChanges: () => [{ type: 'added', doc: { id: 'tk', data: () => cron(WALL + 40 * MIN) } }] }); // prazo em +40min
  ok('X1 relógio LOCAL (offset 0): prazo +40min ainda em prazo → NENHUM SLA no MAIN', delivered.length === 0);
  CANON = WALL + 15 * MIN;                 // offset canônico +15min (relógio de servidor à frente)
  sched.reconcile('resume');
  ok('X2 offset canônico +15min entra na janela amarela (−30min) → o MAIN emite sla_warning', delivered.includes('sla_warning'));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

console.log('');
console.log('RESULTADO: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('HONESTIDADE (F3.4.3C): a matemática do offset (read-only, mediana, rejeição de cache) roda de');
console.log('VERDADE; o consumidor do "agora" canônico para EMITIR SLA é o MAIN (slaScheduler via slaNow),');
console.log('não o renderer (só-visual). A prova FÍSICA do cabeçalho Date do endpoint real é do Cloud Run/GFE.');
if (fail) process.exit(1);
