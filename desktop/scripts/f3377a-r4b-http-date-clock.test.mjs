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
   ===================================================================== */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module from 'module';
import { createRequire } from 'module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(DESK, p), 'utf8');
const CS = rd('src/main/clockSync.ts');
const MAIN = rd('src/main/main.ts');
const PRELOAD = rd('src/preload/preload.ts');
const H = rd('src/renderer/index.html');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.log('  FAIL — ' + n); } };

console.log('== F3.3.77A-R4B — relógio canônico por cabeçalho HTTP Date (Cloud Run read-only) ==');

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

/* ═══════════════ FUNÇÕES PURAS (execução real) ═══════════════ */
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
  const trueTime = 1700000000000;         // instante REAL do servidor
  const SKEW_A = +3 * MIN, SKEW_B = -2 * MIN;   // relógios locais divergentes
  // Cada máquina sonda: serverDate = trueTime (real); wall = relógio LOCAL (torto) no midpoint.
  const probeFor = (skew) => mkProbe({ serverDateMs: trueTime, t0Wall: trueTime + skew - 100, t1Wall: trueTime + skew + 100, t0Mono: 0, t1Mono: 200 });
  const offA = clk.evalSample(probeFor(SKEW_A), 4000).offsetMs;   // ≈ −3min
  const offB = clk.evalSample(probeFor(SKEW_B), 4000).offsetMs;   // ≈ +2min
  // canonicalNow = localNow + offset. localNow_X = trueTime + skew_X (no MESMO instante real).
  const canonA = (trueTime + SKEW_A) + offA;
  const canonB = (trueTime + SKEW_B) + offB;
  ok('RED1 SEM offset: máquinas +3min/−2min divergem ~5min (300s)', Math.abs((trueTime + SKEW_A) - (trueTime + SKEW_B)) === 5 * MIN);
  ok('GREEN10 máquina +3min corrigida (offset ≈ −180000)', Math.abs(offA - (-3 * MIN)) <= 1000);
  ok('GREEN11 máquina −2min corrigida (offset ≈ +120000)', Math.abs(offB - (+2 * MIN)) <= 1000);
  ok('GREEN12 cronômetros CONVERGEM: |canonA − canonB| ≤ 2000ms', Math.abs(canonA - canonB) <= 2000);
  ok('GREEN13 ambos apontam ao instante real do servidor (±1s)', Math.abs(canonA - trueTime) <= 1000 && Math.abs(canonB - trueTime) <= 1000);
}

/* ═══════════════ CONTRATO clockSync.ts (estático) ═══════════════ */
ok('C1 SONDA read-only por CONSTRUÇÃO: método GET, SEM header Authorization (zero mutação/lastSeen)',
  /method:\s*"GET"/.test(CS) && !/["']Authorization["']\s*:/.test(CS));
ok('C2 endpoint EXISTENTE (getUserSelf) — sem endpoint novo; override por env p/ testes',
  /IDS_AUTH_SELF_URL/.test(CS) && /getuserself-de36pi7vza-uc\.a\.run\.app/.test(CS));
ok('C3 no-store / no-cache (evita resposta de cache)', /cache:\s*"no-store"/.test(CS) && /"Cache-Control":\s*"no-store"/.test(CS));
ok('C4 midpoint (não serverAt−t1): offset = serverDate − (t0Wall+t1Wall)/2', /p\.serverDateMs\s*-\s*midpointMs/.test(CS) && /\(p\.t0Wall\s*\+\s*p\.t1Wall\)\s*\/\s*2/.test(CS));
ok('C5 FASE 5 — incerteza inclui a resolução de 1s do Date e gate de 2s', /HTTP_DATE_RESOLUTION_MS\s*=\s*1000/.test(CS) && /UNCERTAINTY_SYNCED_MS\s*=\s*2000/.test(CS));
ok('C6 FASE 6 — 5 amostras no login, 3 no ciclo; mediana das melhores', /LOGIN_SAMPLES\s*=\s*5/.test(CS) && /CYCLE_SAMPLES\s*=\s*3/.test(CS));
ok('C7 FASE 13 — TTL de 30min (stale→local_fallback); periódico 10min', /OFFSET_TTL_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/.test(CS) && /PERIODIC_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/.test(CS));
ok('C8 FASE 11 — detecção de salto por Date.now() vs performance.now()', /performance\.now\(\)/.test(CS) && /JUMP_THRESHOLD_MS/.test(CS) && /clock\.jump\.detected/.test(CS));
ok('C9 estado canônico (ClockState) NÃO carrega token/URL/headers/corpo — só offset/quality/uncertainty/...',
  (() => { const m = CS.match(/export type ClockState = \{[\s\S]*?\};/); const blk = (m ? m[0] : '').replace(/\/\/[^\n]*/g, ''); return /offsetMs:/.test(blk) && /quality:/.test(blk) && /uncertaintyMs:/.test(blk) && /endpointId:/.test(blk) && !/\b(token|authorization|headers|body|url)\s*[?:]/i.test(blk); })());
ok('C10 source = cloud_run_http_date; endpointId = host sanitizado (sem query/token)', /"cloud_run_http_date"/.test(CS) && /new URL\(url\)\.host/.test(CS));
ok('C11 FASE 13 — qualidades synced/degraded/stale/local_fallback/error', /"synced"\s*\|\s*"degraded"\s*\|\s*"stale"\s*\|\s*"local_fallback"\s*\|\s*"error"/.test(CS));
ok('C12 logs FASE 13 sanitizados (sample/reject/complete/offset/fallback/jump), sem UID/e-mail',
  /clock\.sync\.sample/.test(CS) && /clock\.sync\.reject\.cache/.test(CS) && /clock\.sync\.complete/.test(CS) && /clock\.offset\.changed/.test(CS) && /clock\.fallback\.local/.test(CS) && !/email/i.test(CS));

/* ═══════════════ WIRING no MAIN (estático) ═══════════════ */
ok('M1 clockSync LIGA no session-login e PARA no logout/realQuit', /clockSync = createClockSync\(/.test(MAIN) && /ipcMain\.on\("session-logout"[\s\S]{0,240}clockSync\.stop\(\)/.test(MAIN) && /function realQuit\(\)[\s\S]{0,200}clockSync\.stop\(\)/.test(MAIN));
ok('M2 emite estado ao renderer por "clock-state" (só o objeto sanitizado)', /webContents\.send\("clock-state", s\)/.test(MAIN));
ok('M3 IPC clock-get-state / clock-request-sync', /ipcMain\.handle\("clock-get-state"/.test(MAIN) && /ipcMain\.handle\("clock-request-sync"/.test(MAIN));
ok('M4 FASE 10 — powerMonitor resume/unlock → requestSync', /powerMonitor\.on\("resume"[\s\S]{0,120}requestSync\("resume"\)/.test(MAIN) && /powerMonitor\.on\("unlock-screen"[\s\S]{0,120}requestSync\("unlock"\)/.test(MAIN));
ok('M5 preserva o produtor único (notifier/reminder inalterados na sessão)', /startNotifier\(\(\) => mainWin, uid, deliverNotification\)/.test(MAIN));

/* ═══════════════ IPC no PRELOAD (estático) ═══════════════ */
ok('P1 preload expõe clockGetState/clockRequestSync/onClockState', /clockGetState:/.test(PRELOAD) && /clockRequestSync:/.test(PRELOAD) && /onClockState:/.test(PRELOAD));
ok('P2 preload NÃO expõe token/URL/headers do relógio (só o estado)', /nunca[\s\S]{0,80}token/.test(PRELOAD) && !/clockToken|clockUrl/.test(PRELOAD));

/* ═══════════════ RENDERER (estático) ═══════════════ */
ok('R1 _slaApplyClockState alimenta _slaClockOffsetMs a partir do estado do MAIN', /function _slaApplyClockState\(s\)\{/.test(H) && /_slaClockOffsetMs=newOffset;/.test(H));
ok('R2 synced/degraded/stale usam o offset; local_fallback/error = relógio local (offset 0)', /useOffset=\(q==='synced'\|\|q==='degraded'\|\|q==='stale'\)/.test(H) && /newOffset=useOffset\?Math\.round\(s\.offsetMs\):0/.test(H));
ok('R3 FASE 12 — mudança de offset CANCELA e REARMA (boundary + notifScanSla + slaibRefresh)', /if\(_slaBoundaryTimer\)\{ clearTimeout\(_slaBoundaryTimer\); _slaBoundaryTimer=null; \}[\s\S]{0,220}slaMonScheduleBoundary\(\)[\s\S]{0,120}notifScanSla\(\)/.test(H));
ok('R4 NÃO altera planDueAt nem scheduleRevision ao mudar offset (só rearma)', !/planDueAt=/.test((H.match(/function _slaApplyClockState[\s\S]{0,900}/) || [''])[0]) && !/scheduleRevision=/.test((H.match(/function _slaApplyClockState[\s\S]{0,900}/) || [''])[0]));
ok('R5 registra onClockState + consulta clockGetState no boot', /onClockState\(_slaApplyClockState\)/.test(H) && /clockGetState\(\)\.then\(function\(s\)\{ _slaApplyClockState\(s\)/.test(H));
ok('R6 retomada (resume/focus) também pede clockRequestSync', /typeof window\.desktopAPI\.clockRequestSync==='function'\) window\.desktopAPI\.clockRequestSync\(\)/.test(H));
ok('R7 canonicalNowMs() continua a fonte única (offset agora vem do relógio de servidor)', /function canonicalNowMs\(\)\{ return Date\.now\(\)\+_slaClockOffsetMs; \}/.test(H));

/* ═══════════════ PRESERVAÇÕES (FASE 14 — QA.3 intacta) ═══════════════ */
ok('K1 produtor único preservado: u1 ignora designerAssignment (notifier.ts)', /const _daT = \(t as any\)\.designerAssignment;\s*if \(_daT && _daT\.designerId === state\.uid\)/.test(rd('src/main/notifier.ts')));
ok('K2 eventId canônico designer_assigned:<id>:<designerId>:<at> (renderer)', /dedupKey:'designer_assigned:'\+t\.id\+':'\+\(da\.designerId\|\|''\)\+':'\+at/.test(H));
ok('K3 timeline canônica por setor preservada (media 40/20, cronograma 30/10, roteiro OFF)', /edicao_midia:\{designerSla:true,  warningMinutes:40, overdueGraceMinutes:20/.test(H) && /cronograma:  \{designerSla:true,  warningMinutes:30, overdueGraceMinutes:10/.test(H) && /roteiro:     \{designerSla:false/.test(H));
ok('K4 scheduleRevision + boundary timer + resume (R3) preservados', /scheduleRevision:1/.test(H) && /function slaMonScheduleBoundary\(\)/.test(H) && /sla\.resume\.recover/.test(H));
ok('K5 temas + criação atômica + campos de horário preservados', /data\.videos=_vids;/.test(H) && /data\.designerFlowStatus='afazer';/.test(H) && /function _isTimeDateEl\(el\)\{/.test(H));

console.log('');
console.log('RESULTADO: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('HONESTIDADE: as funções puras (offset/mediana/incerteza/rejeição de cache) rodam de VERDADE;');
console.log('a convergência entre máquinas é provada pela matemática do offset. A prova do cabeçalho Date');
console.log('do endpoint REAL (getUserSelf) é bloqueada pela política de egress do sandbox de CI — o Date é');
console.log('garantia do Cloud Run/GFE e o código valida em runtime + fallback; a prova FÍSICA confirma nas máquinas.');
if (fail) process.exit(1);
