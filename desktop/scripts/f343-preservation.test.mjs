#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — PRESERVAÇÃO / GUARD-RAILS.
 * Cobre: 25 sem powerSaveBlocker · 26 sem polling agressivo (boundary timers; re-eval ≤60s, sem rede) ·
 * 27 produtor ÚNICO de SLA no main (notifScanSla NÃO chamado por timer/scan no renderer; slaScheduler
 * presente) · 28 Worker J6 byte-idêntico (cloudflare-worker.js sha256 == blob 9444e7f) · 29 funções de
 * negócio byte/valor-idênticas (Golden Master passa) · 30 baseline Android intacto (android-native-beta/).
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const BASE_REF = '9444e7f';
const rd = (p) => fs.readFileSync(p, 'utf8');
const MAIN = rd(path.join(DESK, 'src', 'main', 'main.ts'));
const SCHED = rd(path.join(DESK, 'src', 'main', 'slaScheduler.ts'));
const RULES = rd(path.join(DESK, 'src', 'main', 'slaRules.js'));
const HTML = rd(path.join(DESK, 'src', 'renderer', 'index.html'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const git = (args) => { try { return execFileSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); } catch (e) { return '__GITERR__:' + (e && e.message || e); } };

/* ── 25 — SEM powerSaveBlocker / prevenção de sleep (main + scheduler + rules) ── */
ok('25 sem powerSaveBlocker no main/scheduler/rules', !/powerSaveBlocker/.test(MAIN + SCHED + RULES));
ok('25 sem prevenção de suspensão/sleep (preventDefault suspend / preventAppSuspension)', !/preventAppSuspension|prevent[- ]?sleep|blockAppSuspension|preventDefault[\s\S]{0,20}suspend/i.test(MAIN + SCHED + RULES));

/* ── 26 — SEM polling agressivo (scheduler = boundary setTimeout + re-eval ≤60s; sem rede) ── */
ok('26 scheduler NÃO usa setInterval (auto-reagenda 1 setTimeout)', !/setInterval/.test(SCHED));
ok('26 scheduler NÃO faz polling de REDE (sem fetch/http/XHR/WebSocket próprios)', !/\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//.test(SCHED));
ok('26 re-eval de segurança capado em ≤60s (SAFETY_MAX_MS default 60000)', /safetyMaxMs\s*\|\|\s*60000/.test(SCHED) && /Math\.min\(b - t0 \+ 120, SAFETY_MAX_MS\)/.test(SCHED));
ok('26 sem timer sub-segundo sustentado (floor 250ms só p/ acertar o marco iminente)', /Math\.max\(250,/.test(SCHED) && !/setTimeout\([^,]*,\s*\d{1,2}\)/.test(SCHED));
// Firestore reaproveita o listener long-polling do main (event-driven), não é polling do scheduler.
ok('26 scheduler reaproveita o listener Firestore do main (event-driven)', /listen\("tasks"/.test(SCHED) && /docChanges\(\)/.test(SCHED));

/* ── 27 — PRODUTOR ÚNICO de SLA no main; renderer não emite SLA por timer/scan ── */
ok('27 notifScanSla e notifScanAssign seguem DEFINIDOS (diff mínimo)', /function notifScanSla\(\)/.test(HTML) && /function notifScanAssign\(\)/.test(HTML));
ok('27 notifScan NÃO chama mais notifScanSla/notifScanAssign', /function notifScan\(\)\{ notifScanFlow\(\); \}/.test(HTML));
ok('27 boundary timer NÃO dispara notifScanSla (só slaibRefresh VISUAL)', !/_slaBoundaryTimer=setTimeout\(function\(\)\{[\s\S]{0,320}notifScanSla\(\)/.test(HTML));
ok('27 sem poll de 30s chamando notifScanSla/notifScanAssign', !/setInterval\(function\(\)\{ try\{ notifScanSla/.test(HTML));
ok('27 _slaResume NÃO chama notifScanSla', !/_slaResume=function\(\)\{[\s\S]{0,600}notifScanSla\(\)/.test(HTML));
ok('27 slaTick NÃO é mais embrulhado com notifScanSla', !/slaTick=function\(\)\{ var r=_notif_tk[\s\S]{0,80}notifScanSla\(\)/.test(HTML));
ok('27 _slaApplyClockState NÃO chama notifScanSla', !/function _slaApplyClockState[\s\S]{0,900}notifScanSla\(\)/.test(HTML));
// Nenhuma chamada REAL a notifScanSla()/notifScanAssign() além das DEFINIÇÕES (var()=empty parens).
const slaCallers = (HTML.match(/notifScanSla\(\)/g) || []).length;    // 1 = só a definição `function notifScanSla(){`
const asgCallers = (HTML.match(/notifScanAssign\(\)/g) || []).length; // 1 = só a definição
ok('27 notifScanSla sem chamador (só a definição casa `notifScanSla()`)', slaCallers === 1);
ok('27 notifScanAssign sem chamador (só a definição)', asgCallers === 1);
ok('27 VISUAL preservado (slaibRefresh/slaMonScheduleBoundary/slaibRender intactos)', /function slaibRefresh\(\)/.test(HTML) && /function slaMonScheduleBoundary\(\)/.test(HTML) && /function slaibRender\(\)/.test(HTML));
ok('27 main IMPORTA e INICIA o slaScheduler (produtor único)', /import \{ startSlaScheduler \} from "\.\/slaScheduler"/.test(MAIN) && /slaScheduler = startSlaScheduler\(\(\) => uid, deliverNotification, \{ now: slaNow(, authUser: getAuthUser)? \}\)/.test(MAIN));
ok('27 main reconcilia SLA em resume/unlock/boot', /slaScheduler\.reconcile\("resume"\)/.test(MAIN) && /slaScheduler\.reconcile\("unlock"\)/.test(MAIN) && /slaScheduler\.reconcile\("boot"\)/.test(MAIN));

/* ── 28 — Worker J6 byte-idêntico (blob git vs 9444e7f; CRLF-agnóstico, robusto no runner Windows) ──
   SHA de BLOB do git (hash-object da árvore vs rev-parse do baseline): imune à normalização de
   fim-de-linha do checkout; qualquer mudança REAL de conteúdo do Worker altera o blob. */
{
  const blobOf = (spec, rel) => { const r = git([spec, rel]); return (typeof r === 'string' && r.indexOf('__GITERR__') !== 0) ? r.trim() : null; };
  const wcur = blobOf('hash-object', 'cloudflare-worker.js'), wbase = blobOf('rev-parse', BASE_REF + ':cloudflare-worker.js');
  ok('28 cloudflare-worker.js byte-idêntico a 9444e7f (blob git)', wcur !== null && wbase !== null && wcur === wbase);
  const rcur = blobOf('hash-object', 'wrangler.toml'), rbase = blobOf('rev-parse', BASE_REF + ':wrangler.toml');
  ok('28 wrangler.toml byte-idêntico a 9444e7f (blob git)', rcur !== null && rbase !== null && rcur === rbase);
}

/* ── 29 — funções de negócio byte/valor-idênticas: o GOLDEN MASTER passa ── */
try {
  execFileSync(process.execPath, [path.join(DESK, 'scripts', 'f343-sla-golden-master.test.mjs')], { stdio: 'pipe' });
  ok('29 Golden Master passa (slaRules.js ≡ renderer 1.0.178, valor-a-valor)', true);
} catch (e) { ok('29 Golden Master passa', false); flog.push('  (29 golden falhou: ' + (e && (e.stdout || e.message) || e).toString().slice(0, 300) + ')'); }

/* ── 30 — baseline Android intacto (nada sob android-native-beta/ mudou vs 9444e7f) ── */
{
  const diff = git(['diff', '--name-only', BASE_REF, '--', 'android-native-beta']);
  ok('30 android-native-beta/ INTACTO vs 9444e7f (worktree desktop-only)', diff.indexOf('__GITERR__') !== 0 && diff.trim() === '');
}

console.log('\n===== F3.4.3 — PRESERVATION / GUARD-RAILS =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-PRESERVATION: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: guard-rail de preservação violado'); process.exit(1); }
console.log('OK — sem powerSaveBlocker/sleep-prevent; sem polling agressivo; produtor SLA único no main; worker/android intactos; golden ok.');
