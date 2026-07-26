// =====================================================================
// F3.5.1F — GATE de EQUIVALÊNCIA do roll-forward: Desktop 1.0.186 == 1.0.184 (produto byte-idêntico)
// ---------------------------------------------------------------------
// Prova, fail-closed, que a candidata 1.0.186 difere da 1.0.184 OFICIAL (tag v1.0.184 @03c5893)
// SOMENTE no versionamento indispensável (desktop/package.json + desktop/package-lock.json) e
// neste próprio script de gate. O CÓDIGO DE PRODUTO (desktop/src/**), a config de build
// (electron-builder.yml, tsconfig*) e os assets são BYTE-IDÊNTICOS à 1.0.184. Também prova a
// AUSÊNCIA TOTAL dos deltas F4.2F/1.0.185 (firebaseAuthBridge.js, firebase-auth-compat,
// signInWithCustomToken, IPC auth-firebase-token/authFirebaseToken, flags DESKTOP_FIREBASE_AUTH_*).
// Requer history completo (fetch-depth: 0) para enxergar a base 03c5893.
// =====================================================================
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const BASE = '03c5893f7c5baf810032bd2a922522a77c1b4680'; // Desktop 1.0.184 OFICIAL (tag v1.0.184)
const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const g = (args) => execSync(`git ${args}`, { cwd: ROOT }).toString();
const rd = (rel) => readFileSync(ROOT + '/' + rel, 'utf8');

let fail = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { console.error('  FAIL ' + m); fail++; };

// 1) base 1.0.184 acessível
try { g(`cat-file -e ${BASE}^{commit}`); ok('base 1.0.184 @' + BASE.slice(0, 7) + ' acessível'); }
catch { bad('base ' + BASE + ' inacessível — checkout precisa de fetch-depth: 0'); }

// 2) TODOS os arquivos alterados vs 1.0.184 ⊆ allowlist (só versionamento + este gate)
const ALLOW = new Set([
  'desktop/package.json',
  'desktop/package-lock.json',
  'desktop/scripts/f351f-rollforward-equivalence.test.mjs',
]);
const changed = g(`diff --name-only ${BASE} HEAD`).split('\n').map((s) => s.trim()).filter(Boolean);
const extra = changed.filter((f) => !ALLOW.has(f));
if (extra.length === 0) ok('arquivos alterados ⊆ allowlist [' + changed.join(', ') + ']');
else bad('arquivos de produto alterados fora da allowlist: ' + extra.join(', '));

// 3) código de PRODUTO + build config byte-idênticos à 1.0.184 (diff VAZIO)
const PRODUCT = ['desktop/src', 'desktop/electron-builder.yml', 'desktop/tsconfig.json', 'desktop/assets', 'desktop/build'];
const prodDiff = g(`diff --name-only ${BASE} HEAD -- ${PRODUCT.join(' ')}`).trim();
if (prodDiff === '') ok('produto (src/electron-builder/tsconfig/assets/build) byte-idêntico à 1.0.184');
else bad('produto DIVERGE da 1.0.184: ' + prodDiff.replace(/\n/g, ', '));

// 4) package.json muda SOMENTE a linha "version" (1.0.184 -> 1.0.186)
const pj = g(`diff ${BASE} HEAD -- desktop/package.json`);
const pjCh = pj.split('\n').filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l));
const pjOnlyVersion = pjCh.length === 2
  && pjCh.some((l) => l.startsWith('-') && /"version":\s*"1\.0\.184"/.test(l))
  && pjCh.some((l) => l.startsWith('+') && /"version":\s*"1\.0\.186"/.test(l));
pjOnlyVersion ? ok('package.json muda SÓ version 1.0.184 → 1.0.186') : bad('package.json muda além da version: ' + pjCh.join(' | '));

// 5) package-lock.json muda SOMENTE linhas "version" 1.0.184 -> 1.0.186 (sem alterar deps)
const pl = g(`diff ${BASE} HEAD -- desktop/package-lock.json`);
const plCh = pl.split('\n').filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l));
const plOnlyVersion = plCh.length > 0 && plCh.every((l) => /"version":\s*"1\.0\.18[46]"/.test(l));
plOnlyVersion ? ok('package-lock.json muda SÓ linhas de version (deps intactas)') : bad('package-lock.json muda além de version: ' + plCh.slice(0, 6).join(' | '));

// 6) versão efetiva == 1.0.186 (sem sufixo)
const ver = JSON.parse(rd('desktop/package.json')).version;
ver === '1.0.186' ? ok('package.json version == 1.0.186') : bad('version == ' + ver + ' (esperado 1.0.186)');

// 7) AUSÊNCIA TOTAL dos deltas F4.2F/1.0.185
existsSync(ROOT + '/desktop/src/renderer/firebaseAuthBridge.js')
  ? bad('firebaseAuthBridge.js PRESENTE (delta F4.2F não removido)')
  : ok('firebaseAuthBridge.js AUSENTE');
const idx = rd('desktop/src/renderer/index.html');
const F42F = ['firebase-auth-compat', 'startFirebaseAuthBridge', 'DESKTOP_FIREBASE_AUTH', 'signInWithCustomToken', 'firebaseAuthBridge'];
const hits = F42F.filter((k) => idx.includes(k));
hits.length === 0 ? ok('index.html sem qualquer ref F4.2F') : bad('index.html com refs F4.2F: ' + hits.join(', '));
for (const [f, k] of [['desktop/src/preload/preload.ts', 'authFirebaseToken'], ['desktop/src/main/auth.ts', 'auth-firebase-token']]) {
  if (existsSync(ROOT + '/' + f)) { rd(f).includes(k) ? bad(f + ' contém ' + k + ' (F4.2F)') : ok(f + ' sem ' + k); }
  else ok(f + ' (inexistente — n/a)');
}

// 8) proibido: ?v= / withWhatsAppPreviewBust NO LINK ENVIADO (buildClientMessage não pode chamá-lo)
const msgUsesBust = /buildClientMessage[\s\S]{0,400}withWhatsAppPreviewBust/.test(idx);
msgUsesBust ? bad('buildClientMessage usa withWhatsAppPreviewBust (?v= proibido no link enviado)') : ok('link enviado sem ?v= (buildClientMessage não usa cache-bust)');

if (fail) { console.error(`\nF3.5.1F equivalence GATE: ${fail} FALHA(S) — 1.0.186 NÃO é roll-forward byte-idêntico da 1.0.184. NÃO PUBLICAR.`); process.exit(1); }
console.log('\nF3.5.1F equivalence GATE: OK — Desktop 1.0.186 == 1.0.184 (produto byte-idêntico; F4.2F ausente; ?v= ausente; só versão muda).');
