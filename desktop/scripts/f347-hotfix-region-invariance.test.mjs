#!/usr/bin/env node
/* =====================================================================================
 * F3.4.7 — HOTFIX REGION-INVARIANCE (baseline OFICIAL Desktop 1.0.183 @3981bf2).
 * -------------------------------------------------------------------------------------
 * Prova, fail-closed, que a correção da ENTREGA VISUAL IMEDIATA (amarela/vermelha) mudou
 * SOMENTE o necessário e NADA fora do escopo:
 *   - desktop/src/renderer/index.html == base + delta AUTORIZADO F3.4.7 (só a guarda única
 *     notifToastOnce + roteamento notif-toast/notif-history; nenhuma regra de SLA/fluxo/negócio);
 *   - desktop/src/main/{main,firebase,bgNotify,slaScheduler}.ts DIFEREM da 1.0.183 e carregam os
 *     marcadores da correção (prova de mudança AUTORIZADA e localizada — auto-cura do listener,
 *     prova de render/ACK, dedupe pós-aceite);
 *   - desktop/package.json / lock == base com APENAS a versão 1.0.183 → 1.0.184;
 *   - testes re-ancorados (f343/f344/f345/f346 region + f33A/f33C/f33F/f33D/f33E/f3311/f33G/f33H
 *     + f343-preexisting-registry + deliver-harness) e o novo suite/fixture f347;
 *   - TODO o resto byte-idêntico a 3981bf2 — em especial slaRules.js (regra de SLA INTOCADA),
 *     o restante do main TS (notifier/clockSync/updater/auth/reminder/tray/prewarm), Worker,
 *     Android, Functions, presence-service, electron-builder.
 * Funciona pré-commit (working tree) e no CI (HEAD commitado). Sem rede, sem build.
 * ===================================================================================== */
import path from 'path'; import fs from 'fs';
import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
import { applyF347IndexDelta, F347_MAIN_MARKERS, F347_SOURCE_FILES, isF347Authorized } from './fixtures/f347/authorized-delta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const REPO = path.resolve(DESK, '..');
const BASE = '3981bf2bf8611caf8bb7057e2245b5834bf66754'; // Desktop 1.0.183 OFICIAL (tag v1.0.183)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const nrm = (s) => String(s).replace(/\r\n/g, '\n');
const git = (args) => execFileSync('git', args, { cwd: REPO, maxBuffer: 256 * 1024 * 1024 }).toString();
const show = (p) => nrm(git(['show', BASE + ':' + p]));
const cur = (p) => nrm(fs.readFileSync(path.join(REPO, p), 'utf8'));

/* ── 1) index.html: base + delta AUTORIZADO, byte-idêntico (nada além da guarda de toast) ── */
ok('1 index.html == base 3981bf2 + delta AUTORIZADO F3.4.7 (só notifToastOnce + roteamento)',
  applyF347IndexDelta(show('desktop/src/renderer/index.html')) === cur('desktop/src/renderer/index.html'));

/* ── 2) SLA INTOCADO: slaRules.js byte-idêntico à 1.0.183 (regra amarelo/vermelho não muda) ── */
ok('2 slaRules.js byte-idêntico a 3981bf2 (regra de SLA fora do escopo F3.4.7)',
  show('desktop/src/main/slaRules.js') === cur('desktop/src/main/slaRules.js'));

/* ── 3) os 4 arquivos TS da correção: DIFEREM da base + carregam os MARCADORES (mudança localizada) ── */
for (const [rel, markers] of Object.entries(F347_MAIN_MARKERS)) {
  const src = cur(rel);
  ok('3 ' + rel.replace('desktop/src/main/', '') + ' modificado (difere de 3981bf2)', show(rel) !== src);
  for (const m of markers) ok('3 ' + rel.replace('desktop/src/main/', '') + ' contém marcador: ' + m, src.includes(m));
}

/* ── 4) package.json / lock: SOMENTE a versão muda (1.0.183 → 1.0.184) ── */
{
  const a = JSON.parse(show('desktop/package.json'));
  const b = JSON.parse(cur('desktop/package.json'));
  ok('4 versão de destino 1.0.184 (candidata F3.4.7)', b.version === '1.0.184' && a.version === '1.0.183');
  a.version = b.version;
  ok('4b package.json: NENHUM outro campo mudou', JSON.stringify(a) === JSON.stringify(b));
  const la = JSON.parse(show('desktop/package-lock.json'));
  const lb = JSON.parse(cur('desktop/package-lock.json'));
  ok('4c lock: versão raiz 1.0.184', lb.version === '1.0.184' && lb.packages[''].version === '1.0.184');
  la.version = lb.version; la.packages[''].version = lb.packages[''].version;
  ok('4d lock: NENHUMA dependência mudou', JSON.stringify(la) === JSON.stringify(lb));
}

/* ── 5) conjunto TOTAL de mudanças vs base limitado à allowlist AUTORIZADA ── */
{
  const ALLOW = [
    ...F347_SOURCE_FILES,                                   // 5 arquivos-fonte da correção
    'desktop/package.json',
    'desktop/package-lock.json',
    // testes re-ancorados (delta autorizado de fonte pinada por causa da correção)
    'desktop/scripts/f33A-notif-central.test.mjs',
    'desktop/scripts/f33C-assignment-toast.test.mjs',
    'desktop/scripts/f33F-bg-notify.test.mjs',
    'desktop/scripts/f33D-background-notif.test.mjs',
    'desktop/scripts/f33E-main-notifier.test.mjs',
    'desktop/scripts/f33G-editprazo-write.test.mjs',
    'desktop/scripts/f33H-hotfix-ui.test.mjs',
    'desktop/scripts/f3311-baseline-freeze.test.mjs',
    'desktop/scripts/f343-preexisting-registry.test.mjs',
    'desktop/scripts/f343-hotfix-region-invariance.test.mjs',
    'desktop/scripts/f344-hotfix-region-invariance.test.mjs',
    'desktop/scripts/f345-hotfix-region-invariance.test.mjs',
    'desktop/scripts/f346-hotfix-region-invariance.test.mjs',
    'desktop/scripts/fixtures/f343/deliver-harness.mjs',
  ];
  const allowNew = (f) => /^desktop\/scripts\/f347-[^/]+\.mjs$/.test(f) || /^desktop\/scripts\/fixtures\/f347\//.test(f);
  const changed = git(['diff', '--name-only', BASE, '--', '.']).split('\n').map((s) => s.trim()).filter(Boolean);
  const untracked = git(['status', '--porcelain']).split('\n').map((s) => s.trim()).filter((l) => l.startsWith('??')).map((l) => l.slice(2).trim());
  const all = [...new Set([...changed, ...untracked])];
  const bad = all.filter((f) => !ALLOW.includes(f) && !allowNew(f) && !isF347Authorized(f)); // + testes de env/harness/versão da fase de auditoria pré-publicação
  if (bad.length) console.log('FORA da allowlist F3.4.7:\n' + bad.join('\n'));
  ok('5 mudanças vs 3981bf2 restritas à allowlist F3.4.7 (5 fontes + versão + testes)', bad.length === 0);
}

/* ── 6) regiões CRÍTICAS byte-idênticas à base (TODO o resto do main TS + Worker + builder) ── */
{
  const FROZEN = [
    'cloudflare-worker.js', 'wrangler.toml',
    'desktop/src/main/notifier.ts', 'desktop/src/main/clockSync.ts',
    'desktop/src/main/auth-core.ts', 'desktop/src/main/auth.ts',
    'desktop/src/main/updaterService.ts', 'desktop/src/main/tray.ts',
    'desktop/src/main/reminder.ts', 'desktop/src/main/prewarm.ts',
    'desktop/src/main/slaRules.js', 'desktop/electron-builder.yml',
    'desktop/src/preload/preload.ts', 'desktop/src/preload/bgnotify-preload.ts',
    'desktop/src/renderer/bgnotify.html',
  ];
  let same = true, who = '';
  for (const f of FROZEN) { if (show(f) !== cur(f)) { same = false; who = f; break; } }
  ok('6 Worker + resto do main TS + preload + builder byte-idênticos a 3981bf2' + (who ? ' [DIVERGIU: ' + who + ']' : ''), same);
  const dirs = ['android-native-beta', 'functions', 'presence-service'];
  const diffDirs = git(['diff', '--name-only', BASE, '--', ...dirs]).trim();
  ok('7 Android + Functions + presence-service SEM nenhuma mudança', diffDirs === '');
}

console.log('\n===== F3.4.7 — HOTFIX REGION-INVARIANCE (baseline OFICIAL 1.0.183 @3981bf2) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.7-HOTFIX-REGION: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: mudança FORA do conjunto autorizado do hotfix F3.4.7'); process.exit(1); }
console.log('OK — só a entrega visual (index.html guarda de toast + 4 TS da cadeia de notificação) + versão 1.0.184 + testes mudaram; SLA/Worker/Android/backend/resto do main TS byte-idênticos à 1.0.183 oficial.');
