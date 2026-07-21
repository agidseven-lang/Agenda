#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — GATE DE INVARIÂNCIA REGION-SCOPED do HOTFIX (branch privada rc 1.0.180).
 * ---------------------------------------------------------------------------------
 * Prova que ESTA branch de hotfix difere do baseline ESTÁVEL 1.0.178 (commit 9444e7f)
 * SOMENTE no conjunto AUTORIZADO de arquivos (o produtor-único-no-main + testes/fixtures do
 * hotfix). Para TODO OUTRO arquivo rastreado sob desktop/ exige BYTE-IDENTIDADE (igualdade de
 * blob git vs 9444e7f) — em especial bgNotify.ts, firebase.ts, updaterService.ts, tray.ts,
 * reminder.ts, clockSync.ts, auth-core.ts, preload/**. Também exige cloudflare-worker.js +
 * android-native-beta/** byte-idênticos. Fail-closed: qualquer diferença fora da whitelist = NO-GO.
 *
 * Este é o guard REGION-SCOPED do hotfix. NÃO substitui os guards ESTÁVEIS 1.0.178 f341a-region-
 * invariance / f3375a-* (que comparam contra a PRODUÇÃO 1.0.177 e são INTENCIONALMENTE vermelhos
 * nesta rc — versão prerelease + main editado); esses seguem intactos p/ produção (ver registry).
 * Baseline lido via `git` (funciona local e no CI com fetch-depth 0). Sem rede, sem build, sem escrita.
 * ===================================================================================== */
import path from 'path'; import crypto from 'crypto'; import fs from 'fs';
import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const BASE = '9444e7f';

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const git = (args) => execFileSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const gitTrim = (args) => git(args).trim();
const baseBlob = (rel) => { try { return gitTrim(['rev-parse', BASE + ':' + rel]); } catch { return null; } };   // blob sha no baseline
const workBlob = (rel) => { try { return gitTrim(['hash-object', rel]); } catch { return null; } };               // blob sha da árvore de trabalho
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/* ── conjunto AUTORIZADO (caminhos relativos à raiz do repo) ── */
const AUTH_EXACT = new Set([
  'desktop/src/main/main.ts', 'desktop/src/main/notifier.ts', 'desktop/src/main/auth.ts',
  'desktop/src/renderer/index.html', 'desktop/src/main/slaRules.js', 'desktop/src/main/slaScheduler.ts',
  'desktop/scripts/copy-renderer.js', 'desktop/package.json', 'desktop/package-lock.json',
  // testes obsoletos REESCRITOS ao novo contrato (rastreados; histórico no Git)
  'desktop/scripts/f3377a-r3-single-producer-clock.test.mjs', 'desktop/scripts/f3377a-r4b-http-date-clock.test.mjs',
  'desktop/scripts/f33D-background-notif.test.mjs', 'desktop/scripts/f33E-main-notifier.test.mjs',
  'desktop/scripts/f33N-assign-baseline-fix.test.mjs',
  // F3.4.3E — acoplamento BEHAVIOR-PRESERVING: o valor gravado por cronStatus/clientFlowStatus é
  // idêntico; a leitura da flag foi hasteada de `f._sendAfterSave?` para a cópia local `sendAfter?`
  // (consumo seguro em saveTask). A asserção D5 acompanha o literal equivalente — não afrouxa a prova.
  'desktop/scripts/f3373i6c16-roteiro-parity.test.mjs',
]);
function authorized(rel) {
  if (AUTH_EXACT.has(rel)) return true;
  if (/^desktop\/scripts\/f343[a-z0-9]*-[^/]*\.test\.mjs$/.test(rel)) return true;   // novos testes do hotfix (f343-, f343d-, …)
  if (/^desktop\/scripts\/fixtures\/f343\//.test(rel)) return true;         // fixtures do hotfix
  if (rel === 'desktop/scripts/F343-TEST-STATUS.md') return true;           // registro de status do hotfix
  return false;
}

/* ── 1) versão: PERMITE somente a rc exata 1.0.180-rc.2 (F3.4.3E — nova QA privada) ── */
{
  const pj = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8'));
  ok('1 package.json version === 1.0.180-rc.2 (rc exata permitida)', pj.version === '1.0.180-rc.2');
}

/* ── 2) git diff --name-only 9444e7f -- desktop: TODA mudança rastreada deve ser AUTORIZADA ── */
{
  const changed = git(['diff', '--name-only', BASE, '--', 'desktop']).split('\n').map((s) => s.trim()).filter(Boolean);
  const unauthorized = changed.filter((rel) => !authorized(rel));
  ok('2 nenhum arquivo rastreado NÃO-autorizado mudou vs 9444e7f' + (unauthorized.length ? ' → ' + unauthorized.join(', ') : ''), unauthorized.length === 0);
  // sanidade: os arquivos do produtor-único que ESPERAMOS mudados aparecem no diff (guard vivo, não vazio)
  const expectChanged = ['desktop/src/main/main.ts', 'desktop/src/main/notifier.ts', 'desktop/src/main/auth.ts', 'desktop/src/renderer/index.html', 'desktop/package.json'];
  ok('2 sanidade: o diff autorizado NÃO está vazio (contém os arquivos do hotfix)', expectChanged.every((r) => changed.includes(r)));
}

/* ── 3) BYTE-IDENTIDADE (blob git) de TODO OUTRO arquivo rastreado sob desktop/ ── */
{
  const baseFiles = git(['ls-tree', '-r', '--name-only', BASE, '--', 'desktop']).split('\n').map((s) => s.trim()).filter(Boolean);
  const violations = [];
  let checked = 0;
  for (const rel of baseFiles) {
    if (authorized(rel)) continue;                 // autorizado a mudar → fora do gate de byte-identidade
    checked++;
    const bb = baseBlob(rel), wb = workBlob(rel);
    if (bb === null || wb === null || bb !== wb) violations.push(rel);
  }
  ok('3 todos os ' + checked + ' outros arquivos rastreados de desktop/ são byte-idênticos a 9444e7f' + (violations.length ? ' → ' + violations.slice(0, 8).join(', ') : ''), violations.length === 0);
}

/* ── 4) BYTE-IDENTIDADE explícita dos módulos SENSÍVEIS (reforço além do #3) ── */
{
  const SENSITIVE = [
    'desktop/src/main/bgNotify.ts', 'desktop/src/main/firebase.ts', 'desktop/src/main/updaterService.ts',
    'desktop/src/main/tray.ts', 'desktop/src/main/reminder.ts', 'desktop/src/main/clockSync.ts',
    'desktop/src/main/auth-core.ts', 'desktop/src/main/autostart.ts', 'desktop/src/main/diag.ts',
    'desktop/src/main/prewarm.ts', 'desktop/src/preload/preload.ts', 'desktop/src/preload/bgnotify-preload.ts',
    'desktop/src/renderer/bgnotify.html',
  ];
  for (const rel of SENSITIVE) {
    const bb = baseBlob(rel), wb = workBlob(rel);
    ok('4 byte-idêntico a 9444e7f: ' + rel.replace('desktop/', ''), bb !== null && wb !== null && bb === wb);
  }
}

/* ── 5) nenhum arquivo NÃO-rastreado NÃO-autorizado sob desktop/src (sem impl stray) ── */
{
  const others = git(['ls-files', '--others', '--exclude-standard', '--', 'desktop/src']).split('\n').map((s) => s.trim()).filter(Boolean);
  const strayImpl = others.filter((rel) => !authorized(rel));
  ok('5 nenhum arquivo novo NÃO-autorizado sob desktop/src' + (strayImpl.length ? ' → ' + strayImpl.join(', ') : ''), strayImpl.length === 0);
  // os DOIS novos de impl autorizados devem existir (produtor único)
  ok('5 slaRules.js + slaScheduler.ts presentes (produtor único no main)', fs.existsSync(path.join(DESK, 'src', 'main', 'slaRules.js')) && fs.existsSync(path.join(DESK, 'src', 'main', 'slaScheduler.ts')));
}

/* ── 6) Worker Cloudflare + wrangler byte-idênticos (sha256 vs blob 9444e7f) ── */
{
  try {
    const curW = fs.readFileSync(path.join(ROOT, 'cloudflare-worker.js'));
    const baseW = execFileSync('git', ['-C', ROOT, 'show', BASE + ':cloudflare-worker.js'], { maxBuffer: 256 * 1024 * 1024 });
    ok('6 cloudflare-worker.js byte-idêntico a 9444e7f', sha(curW) === sha(baseW));
    const curWr = fs.readFileSync(path.join(ROOT, 'wrangler.toml'));
    const baseWr = execFileSync('git', ['-C', ROOT, 'show', BASE + ':wrangler.toml'], { maxBuffer: 16 * 1024 * 1024 });
    ok('6 wrangler.toml byte-idêntico a 9444e7f', sha(curWr) === sha(baseWr));
  } catch (e) { ok('6 worker/wrangler byte-idênticos', false); flog.push('  (6 erro: ' + (e && e.message || e) + ')'); }
}

/* ── 7) android-native-beta/** intocado (sem mudança rastreada nem arquivo novo) ── */
{
  const diffA = git(['diff', '--name-only', BASE, '--', 'android-native-beta']).trim();
  const othersA = git(['ls-files', '--others', '--exclude-standard', '--', 'android-native-beta']).trim();
  ok('7 android-native-beta/ sem mudança rastreada vs 9444e7f', diffA === '');
  ok('7 android-native-beta/ sem arquivo novo NÃO-rastreado', othersA === '');
}

/* ── 8) os guards ESTÁVEIS 1.0.178 (f341a/f3375a) NÃO foram enfraquecidos (byte-idênticos a 9444e7f) ── */
{
  for (const rel of ['desktop/scripts/f341a-region-invariance.test.mjs', 'desktop/scripts/f3375a-wizard-reset-roteiro-no-designer.test.mjs']) {
    const bb = baseBlob(rel), wb = workBlob(rel);
    ok('8 guard estável intacto (byte-idêntico a 9444e7f): ' + rel.replace('desktop/scripts/', ''), bb !== null && wb !== null && bb === wb);
  }
}

console.log('\n===== F3.4.3 — HOTFIX REGION-INVARIANCE (baseline ESTÁVEL 9444e7f / rc 1.0.180) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-HOTFIX-REGION: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: mudança FORA do conjunto autorizado do hotfix (region-invariance violada)'); process.exit(1); }
console.log('OK — só os arquivos autorizados do produtor-único + testes/fixtures do hotfix mudaram; todo o resto (bgNotify/firebase/updater/tray/reminder/clockSync/auth-core/preload/worker/android) byte-idêntico a 9444e7f; guards estáveis f341a/f3375a preservados.');
