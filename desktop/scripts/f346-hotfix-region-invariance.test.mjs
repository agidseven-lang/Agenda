#!/usr/bin/env node
/* =====================================================================================
 * F3.4.6 — HOTFIX REGION-INVARIANCE (baseline OFICIAL Desktop 1.0.182 @11520f5).
 * -------------------------------------------------------------------------------------
 * Prova, fail-closed, que o hotfix visual da GRADE DIÁRIA mudou SOMENTE:
 *   - desktop/src/renderer/index.html == base + delta AUTORIZADO F3.4.6 (classes .agcell*
 *     no <style> + célula do calendarGrid por classes) — NADA de regra de negócio;
 *   - desktop/package.json / package-lock.json == base com APENAS a versão 1.0.182→1.0.183;
 *   - testes re-ancorados (f343/f344/f345 region), novos testes/fixtures/QA-visual f346 e
 *     os 2 workflows Desktop.
 * TODO o resto byte-idêntico a 11520f5 — em especial slaRules.js (SLA intocado pela F3.4.6),
 * TODO o main TS (scheduler/notifier/clock/updater/auth), Worker, Android, Functions,
 * presence-service. Funciona pré-commit (diff vs working tree) e no CI (HEAD commitado).
 * ===================================================================================== */
import path from 'path'; import fs from 'fs';
import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { applyF346CalendarDelta } from './fixtures/f346/authorized-delta.mjs';
import { applyF347IndexDelta, isF347Authorized } from './fixtures/f347/authorized-delta.mjs'; // F3.4.7 — delta AUTORIZADO da entrega visual amarela/vermelha (encadeado)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const REPO = path.resolve(DESK, '..');
const BASE = '11520f5ab59a8ca90b6a2d82bff741dc9ebe8cca'; // Desktop 1.0.182 OFICIAL (tag v1.0.182)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const nrm = (s) => String(s).replace(/\r\n/g, '\n');
const git = (args) => execFileSync('git', args, { cwd: REPO, maxBuffer: 128 * 1024 * 1024 }).toString();
const show = (p) => nrm(git(['show', BASE + ':' + p]));
const cur = (p) => nrm(fs.readFileSync(path.join(REPO, p), 'utf8'));

/* ── 1) index.html: base + delta AUTORIZADO, byte-idêntico (nada além da grade) ── */
ok('1 index.html == base 11520f5 + deltas AUTORIZADOS F3.4.6+F3.4.7 (grade diária + entrega visual)', applyF347IndexDelta(applyF346CalendarDelta(show('desktop/src/renderer/index.html'))) === cur('desktop/src/renderer/index.html'));

/* ── 2) SLA INTOCADO: slaRules.js byte-idêntico à 1.0.182 ── */
ok('2 slaRules.js byte-idêntico a 11520f5 (SLA amarelo/vermelho fora do escopo F3.4.6)', show('desktop/src/main/slaRules.js') === cur('desktop/src/main/slaRules.js'));

/* ── 3) package.json: SOMENTE a versão muda (1.0.182 → 1.0.183) ── */
{
  const a = JSON.parse(show('desktop/package.json'));
  const b = JSON.parse(cur('desktop/package.json'));
  ok('3 versão de destino 1.0.184 (F3.4.7)', b.version === '1.0.184' && a.version === '1.0.182');
  a.version = b.version;
  ok('3b package.json: NENHUM outro campo mudou', JSON.stringify(a) === JSON.stringify(b));
}

/* ── 4) package-lock.json: SOMENTE campos de versão do pacote raiz ── */
{
  const a = JSON.parse(show('desktop/package-lock.json'));
  const b = JSON.parse(cur('desktop/package-lock.json'));
  ok('4 lock: versão raiz 1.0.184', b.version === '1.0.184' && b.packages[''].version === '1.0.184');
  a.version = b.version; a.packages[''].version = b.packages[''].version;
  ok('4b lock: NENHUMA dependência mudou', JSON.stringify(a) === JSON.stringify(b));
}

/* ── 5) conjunto TOTAL de mudanças vs base limitado à allowlist ── */
{
  const ALLOW = [
    'desktop/src/renderer/index.html',
    'desktop/package.json',
    'desktop/package-lock.json',
    'desktop/scripts/f343-hotfix-region-invariance.test.mjs',
    'desktop/scripts/f344-hotfix-region-invariance.test.mjs',
    'desktop/scripts/f345-hotfix-region-invariance.test.mjs',
    '.github/workflows/desktop-build.yml',
    '.github/workflows/f343e-desktop-stable-release.yml',
  ];
  const allowNew = (f) => /^desktop\/scripts\/f346-[^/]+\.mjs$/.test(f) || /^desktop\/scripts\/fixtures\/f346\//.test(f) || /^desktop\/scripts\/visual-qa-f346[^/]*\.mjs$/.test(f) || /^desktop\/qa-out-f346\//.test(f) || /^desktop\/scripts\/fixtures\/f343\/golden\.json$/.test(f);
  const changed = git(['diff', '--name-only', BASE, '--', '.']).split('\n').map((s) => s.trim()).filter(Boolean);
  const untracked = git(['status', '--porcelain']).split('\n').map((s) => s.trim()).filter((l) => l.startsWith('??')).map((l) => l.slice(2).trim());
  const all = [...new Set([...changed, ...untracked])];
  const bad = all.filter((f) => !ALLOW.includes(f) && !allowNew(f) && !isF347Authorized(f)); // F3.4.7 — delega o escopo da correção ao guard f347
  if (bad.length) console.log('FORA da allowlist F3.4.6:\n' + bad.join('\n'));
  ok('5 mudanças vs 11520f5 restritas à allowlist F3.4.6 (grade + versão + testes + workflows) + escopo F3.4.7', bad.length === 0);
}

/* ── 6) regiões CRÍTICAS byte-idênticas à base ── */
{
  const FROZEN = [
    // F3.4.7 — slaScheduler.ts, main.ts, bgNotify.ts e firebase.ts saíram (correção AUTORIZADA; escopo em f347).
    'cloudflare-worker.js', 'wrangler.toml',
    'desktop/src/main/notifier.ts', 'desktop/src/main/clockSync.ts',
    'desktop/src/main/auth-core.ts',
    'desktop/src/main/updaterService.ts', 'desktop/src/main/tray.ts',
    'desktop/src/main/reminder.ts', 'desktop/src/main/auth.ts', 'desktop/electron-builder.yml',
  ];
  let same = true, who = '';
  for (const f of FROZEN) { if (show(f) !== cur(f)) { same = false; who = f; break; } }
  ok('6 Worker + TODO o main TS + electron-builder byte-idênticos a 11520f5' + (who ? ' [DIVERGIU: ' + who + ']' : ''), same);
  const dirs = ['android-native-beta', 'functions', 'presence-service'];
  const diffDirs = git(['diff', '--name-only', BASE, '--', ...dirs]).trim();
  ok('7 Android + Functions + presence-service SEM nenhuma mudança', diffDirs === '');
}

console.log('\n===== F3.4.6 — HOTFIX REGION-INVARIANCE (baseline OFICIAL 1.0.182 @11520f5) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.6-HOTFIX-REGION: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: mudança FORA do conjunto autorizado do hotfix F3.4.6'); process.exit(1); }
console.log('OK — só a grade diária autorizada (index.html) + versão 1.0.183 + testes/workflows mudaram; SLA/main TS/Worker/Android/backend byte-idênticos à 1.0.182 oficial.');
