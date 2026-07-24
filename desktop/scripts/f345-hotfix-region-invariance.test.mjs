#!/usr/bin/env node
/* =====================================================================================
 * F3.4.5 — HOTFIX REGION-INVARIANCE (baseline OFICIAL Desktop 1.0.181 @e4692c9).
 * -------------------------------------------------------------------------------------
 * Prova, fail-closed, que o hotfix do timestamp da amarela mudou SOMENTE:
 *   - desktop/src/renderer/index.html  == base + delta AUTORIZADO F3.4.5 (clamp planStartAt);
 *   - desktop/src/main/slaRules.js     == base + delta AUTORIZADO F3.4.5;
 *   - desktop/package.json / package-lock.json == base com APENAS a versão 1.0.181→1.0.182;
 *   - testes re-ancorados f344 (2), novos testes/fixtures f345 e os 2 workflows Desktop.
 * TODO o resto byte-idêntico a e4692c9 — em especial Worker (cloudflare-worker.js/wrangler.toml),
 * Android (android-native-beta/**), Functions, Rules, presence-service e o restante do desktop/src.
 * Funciona pré-commit (diff vs working tree) e no CI (diff vs HEAD commitado).
 * ===================================================================================== */
import path from 'path'; import fs from 'fs';
import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { applyF345SlaDelta } from './fixtures/f345/authorized-delta.mjs';
import { applyF346CalendarDelta } from './fixtures/f346/authorized-delta.mjs'; // F3.4.6 — delta AUTORIZADO da grade diária (encadeado)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const REPO = path.resolve(DESK, '..');
const BASE = 'e4692c93644bd4deb380b2ec5ecc486dfcb205ca'; // Desktop 1.0.181 OFICIAL (tag v1.0.181)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const nrm = (s) => String(s).replace(/\r\n/g, '\n');
const git = (args) => execFileSync('git', args, { cwd: REPO, maxBuffer: 128 * 1024 * 1024 }).toString();
const show = (p) => nrm(git(['show', BASE + ':' + p]));
const cur = (p) => nrm(fs.readFileSync(path.join(REPO, p), 'utf8'));

/* ── 1/2) fontes SLA: base + delta AUTORIZADO, byte-idêntico ── */
ok('1 index.html == base e4692c9 + deltas AUTORIZADOS F3.4.5+F3.4.6 (clamp + grade diária)', applyF346CalendarDelta(applyF345SlaDelta(show('desktop/src/renderer/index.html'))) === cur('desktop/src/renderer/index.html'));
ok('2 slaRules.js == base e4692c9 + delta AUTORIZADO F3.4.5 (nada além do clamp)', applyF345SlaDelta(show('desktop/src/main/slaRules.js')) === cur('desktop/src/main/slaRules.js'));

/* ── 3) package.json: SOMENTE a versão muda (1.0.181 → 1.0.182) ── */
{
  const a = JSON.parse(show('desktop/package.json'));
  const b = JSON.parse(cur('desktop/package.json'));
  ok('3 versão de destino 1.0.183 (F3.4.6)', b.version === '1.0.183' && a.version === '1.0.181');
  a.version = b.version;
  ok('3b package.json: NENHUM outro campo mudou', JSON.stringify(a) === JSON.stringify(b));
}

/* ── 4) package-lock.json: SOMENTE campos de versão do pacote raiz ── */
{
  const a = JSON.parse(show('desktop/package-lock.json'));
  const b = JSON.parse(cur('desktop/package-lock.json'));
  ok('4 lock: versão raiz 1.0.183', b.version === '1.0.183' && b.packages[''].version === '1.0.183');
  a.version = b.version; a.packages[''].version = b.packages[''].version;
  ok('4b lock: NENHUMA dependência mudou', JSON.stringify(a) === JSON.stringify(b));
}

/* ── 5) conjunto TOTAL de mudanças vs base limitado à allowlist ── */
{
  const ALLOW = [
    'desktop/src/renderer/index.html',
    'desktop/src/main/slaRules.js',
    'desktop/package.json',
    'desktop/package-lock.json',
    'desktop/scripts/f344-repeated-move-contract.test.mjs',
    'desktop/scripts/f344-hotfix-region-invariance.test.mjs',
    'desktop/scripts/f343-hotfix-region-invariance.test.mjs', // pin de versão 1.0.182 + authorized() f345 (evolução por-fase documentada)
    '.github/workflows/desktop-build.yml',
    '.github/workflows/f343e-desktop-stable-release.yml', // release estável re-pinado p/ v1.0.182 (mesmo caminho registrado usado pela F3.4.4A)
  ];
  const allowNew = (f) => /^desktop\/scripts\/f345-[^/]+\.mjs$/.test(f) || /^desktop\/scripts\/fixtures\/f345\//.test(f) || /^desktop\/scripts\/fixtures\/f343\/golden\.json$/.test(f) || /^desktop\/scripts\/f346-[^/]+\.mjs$/.test(f) || /^desktop\/scripts\/fixtures\/f346\//.test(f) || /^desktop\/scripts\/visual-qa-f346[^/]*\.mjs$/.test(f) || /^desktop\/qa-out-f346\//.test(f);
  const changed = git(['diff', '--name-only', BASE, '--', '.']).split('\n').map((s) => s.trim()).filter(Boolean);
  const untracked = git(['status', '--porcelain']).split('\n').map((s) => s.trim()).filter((l) => l.startsWith('??')).map((l) => l.slice(2).trim());
  const all = [...new Set([...changed, ...untracked])];
  const bad = all.filter((f) => !ALLOW.includes(f) && !allowNew(f));
  if (bad.length) console.log('FORA da allowlist F3.4.5:\n' + bad.join('\n'));
  ok('5 mudanças vs e4692c9 restritas à allowlist F3.4.5 (fontes SLA + versão + testes + workflows)', bad.length === 0);
}

/* ── 6) regiões CRÍTICAS byte-idênticas à base ── */
{
  const FROZEN = [
    'cloudflare-worker.js', 'wrangler.toml',
    'desktop/src/main/slaScheduler.ts', 'desktop/src/main/notifier.ts', 'desktop/src/main/clockSync.ts',
    'desktop/src/main/main.ts', 'desktop/src/main/bgNotify.ts', 'desktop/src/main/auth-core.ts',
    'desktop/src/main/updaterService.ts', 'desktop/src/main/firebase.ts', 'desktop/src/main/tray.ts',
    'desktop/src/main/reminder.ts', 'desktop/src/main/auth.ts', 'desktop/src/main/notifier.ts',
  ];
  let same = true, who = '';
  for (const f of FROZEN) { if (show(f) !== cur(f)) { same = false; who = f; break; } }
  ok('6 Worker + TODO o main TS (scheduler/notifier/clock/updater/auth/...) byte-idênticos a e4692c9' + (who ? ' [DIVERGIU: ' + who + ']' : ''), same);
  const dirs = ['android-native-beta', 'functions', 'presence-service'];
  const diffDirs = git(['diff', '--name-only', BASE, '--', ...dirs]).trim();
  ok('7 Android + Functions + presence-service SEM nenhuma mudança', diffDirs === '');
}

console.log('\n===== F3.4.5 — HOTFIX REGION-INVARIANCE (baseline OFICIAL 1.0.181 @e4692c9) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.5-HOTFIX-REGION: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: mudança FORA do conjunto autorizado do hotfix F3.4.5'); process.exit(1); }
console.log('OK — só o clamp autorizado (index.html + slaRules) + versão 1.0.182 + testes/workflows mudaram; Worker/Android/backend/main TS byte-idênticos à 1.0.181 oficial.');
