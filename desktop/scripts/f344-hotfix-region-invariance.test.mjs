#!/usr/bin/env node
/* =====================================================================================
 * F3.4.4 — GATE DE INVARIÂNCIA REGION-SCOPED do HOTFIX (rc privada 1.0.181-rc.1).
 * ---------------------------------------------------------------------------------
 * Prova que ESTA branch difere da PRODUÇÃO OFICIAL Desktop 1.0.180 (tag v1.0.180, commit
 * 68598fa) SOMENTE no conjunto AUTORIZADO do F3.4.4 (produtor de FLUXO no main + testes):
 *   - desktop/src/main/slaRules.js        (aditivo: Flow Engine portado + detector)
 *   - desktop/src/main/notifier.ts        (u3: produtor de fluxo; u1/u1b/u2 VERBATIM)
 *   - desktop/src/main/main.ts            (1 linha: passa getAuthUser ao notifier)
 *   - desktop/src/renderer/index.html     (SÓ neutralização do notifScan; resto byte-idêntico)
 *   - desktop/package.json + package-lock (versão 1.0.181-rc.1)
 *   - desktop/scripts/f343-preservation.test.mjs + f343-hotfix-region-invariance.test.mjs
 *     (literais evoluídos ao novo contrato — documentado)
 *   - desktop/scripts/f344*-*.test.mjs    (novos testes/fixtures do hotfix)
 * Para TODO OUTRO arquivo rastreado sob desktop/ exige BYTE-IDENTIDADE (blob git) vs 68598fa —
 * em especial slaScheduler.ts, auth.ts, bgNotify.ts, firebase.ts, updaterService.ts, tray.ts,
 * reminder.ts, clockSync.ts, auth-core.ts, preload/**. Worker + wrangler + android-native-beta/**
 * byte-idênticos. Guards estáveis f341a/f3375a intactos. Fail-closed.
 * Baseline lido via `git` (local e CI com fetch-depth 0). Sem rede, sem build, sem escrita.
 * ===================================================================================== */
import path from 'path'; import fs from 'fs';
import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const BASE = '68598fae54e75dd34a399ffca65649cc8ff6d16c';   // Desktop 1.0.180 oficial (tag v1.0.180)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const git = (args) => execFileSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const gitTrim = (args) => git(args).trim();
const baseBlob = (rel) => { try { return gitTrim(['rev-parse', BASE + ':' + rel]); } catch { return null; } };
const workBlob = (rel) => { try { return gitTrim(['hash-object', rel]); } catch { return null; } };

/* ── conjunto AUTORIZADO F3.4.4 ── */
const AUTH_EXACT = new Set([
  'desktop/src/main/slaRules.js', 'desktop/src/main/notifier.ts', 'desktop/src/main/main.ts',
  'desktop/src/renderer/index.html', 'desktop/package.json', 'desktop/package-lock.json',
  'desktop/scripts/f343-preservation.test.mjs', 'desktop/scripts/f343-hotfix-region-invariance.test.mjs',
]);
function authorized(rel) {
  if (AUTH_EXACT.has(rel)) return true;
  if (/^desktop\/scripts\/f344[a-z0-9-]*\.test\.mjs$/.test(rel)) return true;   // testes do hotfix F3.4.4
  if (/^desktop\/scripts\/fixtures\/f344\//.test(rel)) return true;             // fixtures do hotfix
  return false;
}

/* ── 1) versão: SOMENTE o candidato ESTÁVEL exato 1.0.181 (F3.4.4A) ── */
{
  const pj = JSON.parse(fs.readFileSync(path.join(DESK, 'package.json'), 'utf8'));
  ok('1 package.json version === 1.0.181 (candidato ESTÁVEL exato do F3.4.4A)', pj.version === '1.0.181');
}

/* ── 2) git diff --name-only 68598fa -- desktop: TODA mudança deve ser AUTORIZADA ── */
{
  const changed = git(['diff', '--name-only', BASE, '--', 'desktop']).split('\n').map((s) => s.trim()).filter(Boolean);
  const unauthorized = changed.filter((rel) => !authorized(rel));
  ok('2 nenhum arquivo NÃO-autorizado mudou vs 68598fa' + (unauthorized.length ? ' → ' + unauthorized.join(', ') : ''), unauthorized.length === 0);
  const expectChanged = ['desktop/src/main/slaRules.js', 'desktop/src/main/notifier.ts', 'desktop/src/main/main.ts', 'desktop/src/renderer/index.html', 'desktop/package.json'];
  ok('2 sanidade: o diff autorizado contém os arquivos do hotfix F3.4.4', expectChanged.every((r) => changed.includes(r)));
}

/* ── 3) BYTE-IDENTIDADE (blob git) de TODO OUTRO arquivo rastreado sob desktop/ ── */
{
  const baseFiles = git(['ls-tree', '-r', '--name-only', BASE, '--', 'desktop']).split('\n').map((s) => s.trim()).filter(Boolean);
  const violations = [];
  let checked = 0;
  for (const rel of baseFiles) {
    if (authorized(rel)) continue;
    checked++;
    const bb = baseBlob(rel), wb = workBlob(rel);
    if (bb === null || wb === null || bb !== wb) violations.push(rel);
  }
  ok('3 todos os ' + checked + ' outros arquivos de desktop/ byte-idênticos a 68598fa' + (violations.length ? ' → ' + violations.slice(0, 8).join(', ') : ''), violations.length === 0);
}

/* ── 4) BYTE-IDENTIDADE explícita dos módulos SENSÍVEIS (reforço) ── */
{
  const SENSITIVE = [
    'desktop/src/main/slaScheduler.ts', 'desktop/src/main/auth.ts',
    'desktop/src/main/bgNotify.ts', 'desktop/src/main/firebase.ts', 'desktop/src/main/updaterService.ts',
    'desktop/src/main/tray.ts', 'desktop/src/main/reminder.ts', 'desktop/src/main/clockSync.ts',
    'desktop/src/main/auth-core.ts', 'desktop/src/main/autostart.ts', 'desktop/src/main/diag.ts',
    'desktop/src/main/prewarm.ts', 'desktop/src/preload/preload.ts', 'desktop/src/preload/bgnotify-preload.ts',
    'desktop/src/renderer/bgnotify.html', 'desktop/electron-builder.yml',
  ];
  for (const rel of SENSITIVE) {
    const bb = baseBlob(rel), wb = workBlob(rel);
    ok('4 byte-idêntico a 68598fa: ' + rel.replace('desktop/', ''), bb !== null && wb !== null && bb === wb);
  }
}

/* ── 5) nenhum arquivo NÃO-rastreado NÃO-autorizado sob desktop/src ── */
{
  const others = git(['ls-files', '--others', '--exclude-standard', '--', 'desktop/src']).split('\n').map((s) => s.trim()).filter(Boolean);
  const stray = others.filter((rel) => !authorized(rel));
  ok('5 nenhum arquivo novo NÃO-autorizado sob desktop/src' + (stray.length ? ' → ' + stray.join(', ') : ''), stray.length === 0);
}

/* ── 6) Worker Cloudflare + wrangler byte-idênticos (blob git vs 68598fa) ── */
{
  const cw = workBlob('cloudflare-worker.js'), cb = baseBlob('cloudflare-worker.js');
  ok('6 cloudflare-worker.js byte-idêntico a 68598fa (blob git)', cw !== null && cb !== null && cw === cb);
  const ww = workBlob('wrangler.toml'), wb = baseBlob('wrangler.toml');
  ok('6 wrangler.toml byte-idêntico a 68598fa (blob git)', ww !== null && wb !== null && ww === wb);
}

/* ── 7) android-native-beta/** intocado ── */
{
  const diffA = git(['diff', '--name-only', BASE, '--', 'android-native-beta']).trim();
  const othersA = git(['ls-files', '--others', '--exclude-standard', '--', 'android-native-beta']).trim();
  ok('7 android-native-beta/ sem mudança rastreada vs 68598fa', diffA === '');
  ok('7 android-native-beta/ sem arquivo novo NÃO-rastreado', othersA === '');
}

/* ── 8) guards ESTÁVEIS f341a/f3375a NÃO enfraquecidos (byte-idênticos a 68598fa) ── */
{
  for (const rel of ['desktop/scripts/f341a-region-invariance.test.mjs', 'desktop/scripts/f3375a-wizard-reset-roteiro-no-designer.test.mjs', 'desktop/scripts/f341a-updater-state-machine.test.mjs']) {
    const bb = baseBlob(rel), wb = workBlob(rel);
    ok('8 guard estável intacto (byte-idêntico a 68598fa): ' + rel.replace('desktop/scripts/', ''), bb !== null && wb !== null && bb === wb);
  }
}

/* ── 9) delta do index.html LIMITADO ao bloco notifScan (resto byte-idêntico) ──
 * EOL-normalizado (runner Windows: árvore CRLF via autocrlf × blob LF do git show — lição
 * F3.4.3). A byte-identidade rastreada EOL-imune já é provada nos itens #3/#4 (blob git). */
{
  const nrm = (s) => String(s).replace(/\r\n/g, '\n');
  const cur = nrm(fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8'));
  const base = nrm(git(['show', BASE + ':desktop/src/renderer/index.html']));
  const BLOCK = /\/\* F3\.4\.3 — PRODUTOR ÚNICO NO MAIN:[\s\S]*?function notifScan\(\)\{[^}]*\}/;
  ok('9 bloco notifScan presente nos dois lados', BLOCK.test(cur) && BLOCK.test(base));
  ok('9 index.html: FORA do bloco notifScan, byte-idêntico a 68598fa',
    cur.replace(BLOCK, '<NOTIFSCAN>') === base.replace(BLOCK, '<NOTIFSCAN>'));
}

console.log('\n===== F3.4.4 — HOTFIX REGION-INVARIANCE (baseline OFICIAL 68598fa / rc 1.0.181-rc.1) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.4-HOTFIX-REGION: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: mudança FORA do conjunto autorizado do hotfix F3.4.4'); process.exit(1); }
console.log('OK — só o produtor de fluxo no main + testes mudaram vs 1.0.180 oficial; renderer delta = SÓ notifScan; todo o resto (slaScheduler/auth/bgNotify/firebase/updater/tray/reminder/clockSync/auth-core/preload/worker/android) byte-idêntico a 68598fa.');
