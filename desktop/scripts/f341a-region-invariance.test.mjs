#!/usr/bin/env node
/* =====================================================================
   F3.4.1A — GATE DE PRESERVAÇÃO REGION-SCOPED (FASE 13).
   Prova que a candidata bootstrap canário (1.0.178-canary.1) difere da
   PRODUÇÃO FÍSICA APROVADA 1.0.177 (commit 2963927) SOMENTE nas regiões
   `UPDATER:BEGIN … UPDATER:END` e nos arquivos whitelisted. Fora disso,
   BYTE-IDENTIDADE (HARD NO-GO em qualquer diferença fora da whitelist).

   Whitelist de mudanças permitida (mandato, Decisão C):
     - novo desktop/src/main/updaterService.ts
     - fiação IPC no main (main.ts, só em UPDATER:*)
     - API mínima no preload (preload.ts, só em UPDATER:*)
     - seção Atualizações no renderer (index.html, só em UPDATER:*)
     - dependência electron-updater (package.json / package-lock.json)
     - publish config (electron-builder.yml, só o bloco publish anexado)
     - versão + banner canário (versão em package*.json; banner é JS no
       bloco UPDATER do renderer, condicionado à versão de pré-lançamento)
     - workflows do updater + testes exclusivos do updater (fora do app.asar)

   Baseline lido via `git show 2963927:desktop/<rel>` (funciona local e no
   CI com fetch-depth 0). Sem rede, sem build, sem escrita. Fail-closed.
   ===================================================================== */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');              // desktop/
const BASE_SHA = process.env.QA_BASELINE_SHA || '2963927'; // produção 1.0.177 (F3.3.77B)

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };
// Normaliza EOL: no runner Windows o checkout aplica autocrlf (working tree CRLF) enquanto
// `git show <sha>` retorna o blob LF. É artefato de checkout, NÃO mudança de conteúdo — e ambos
// os builds (1.0.177 e canário) rodam no MESMO windows-latest com a MESMA conversão, então os
// arquivos EMPACOTADOS ficam byte-idênticos. Aqui comparamos o CONTEÚDO, normalizado a LF.
const norm = (s) => String(s).replace(/\r\n/g, '\n');
const baseline = (rel) => norm(execSync(`git show ${BASE_SHA}:desktop/${rel}`, { cwd: ROOT, maxBuffer: 96 * 1024 * 1024 }).toString('utf8'));
const baselineMissing = (rel) => { try { execSync(`git show ${BASE_SHA}:desktop/${rel}`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] }); return false; } catch { return true; } };
const current = (rel) => norm(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// Remove blocos UPDATER:BEGIN … UPDATER:END (linhas inteiras, inclusive as sentinelas).
function stripUpdater(src) {
  const out = []; let skip = false;
  for (const ln of src.split('\n')) {
    if (!skip && /UPDATER:BEGIN/.test(ln)) { skip = true; continue; }
    if (skip) { if (/UPDATER:END/.test(ln)) skip = false; continue; }
    out.push(ln);
  }
  return out.join('\n');
}
// contagem balanceada de sentinelas
function sentinelCount(src) {
  const b = (src.match(/UPDATER:BEGIN/g) || []).length;
  const e = (src.match(/UPDATER:END/g) || []).length;
  return { b, e };
}
// extrai `function <name>(...) { ... }` por chaves balanceadas (mesma âncora do f3374k)
function fnSrc(SRC, name) {
  const m = SRC.match(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
  if (!m) return null;
  const st = SRC.indexOf(m[0]); let d = 0;
  for (let j = SRC.indexOf('{', st); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); }
  }
  return null;
}

console.log(`F3.4.1A — region-scoped invariance (candidata 1.0.178-canary.1 vs produção ${BASE_SHA})`);

// ---------- 1) RENDERER: fora das regiões UPDATER, byte-idêntico ----------
{
  const base = baseline('src/renderer/index.html');
  const cur = current('src/renderer/index.html');
  const stripped = stripUpdater(cur);
  ok('R1 renderer SEM regiões UPDATER === produção 1.0.177 (byte-idêntico)', stripped === base);
  const sc = sentinelCount(cur);
  ok('R2 sentinelas balanceadas no renderer (BEGIN==END, >=2 regiões)', sc.b === sc.e && sc.b >= 2);
  ok('R3 produção NÃO contém sentinelas UPDATER (baseline limpo)', !/UPDATER:BEGIN/.test(base));
  // RED self-check: adulterar UMA linha de negócio quebra o gate.
  const tampered = base.replace("Português (Brasil)", "Português (ADULTERADO)");
  ok('R4 RED: adulteração de função de negócio É detectada pelo gate', stripUpdater(tampered) !== base && tampered !== base);
  // banner canário existe SOMENTE dentro de região UPDATER (não vaza p/ o negócio)
  ok('R5 banner canário só existe dentro de região UPDATER (removido pelo strip)', /upd-canary-banner/.test(cur) && !/upd-canary-banner/.test(stripped));
}

// ---------- 2) MAIN + PRELOAD: fora das regiões UPDATER, byte-idêntico ----------
for (const rel of ['src/main/main.ts', 'src/preload/preload.ts']) {
  const base = baseline(rel);
  const stripped = stripUpdater(current(rel));
  ok(`M ${rel} SEM regiões UPDATER === produção 1.0.177`, stripped === base);
  ok(`M ${rel} produção sem sentinelas`, !/UPDATER:BEGIN/.test(base));
}

// ---------- 3) MÓDULOS DE NEGÓCIO INTOCADOS: byte-idênticos ----------
for (const rel of [
  'src/main/clockSync.ts', 'src/main/notifier.ts', 'src/main/bgNotify.ts', 'src/main/firebase.ts',
  'src/main/auth-core.ts', 'src/main/auth.ts', 'src/main/autostart.ts', 'src/main/reminder.ts',
  'src/main/prewarm.ts', 'src/main/tray.ts', 'src/main/diag.ts',
]) {
  ok(`U ${rel} byte-idêntico à produção (intocado)`, baseline(rel) === current(rel));
}

// ---------- 4) updaterService.ts: NOVO (ausente na produção) ----------
{
  ok('N updaterService.ts AUSENTE na produção 1.0.177', baselineMissing('src/main/updaterService.ts'));
  const svc = current('src/main/updaterService.ts');
  ok('N updaterService.ts presente e substancial na candidata', svc.length > 2000 && /createUpdaterService/.test(svc));
  ok('N updaterService: autoDownload/allowDowngrade/autoInstallOnAppQuit=false', /autoDownload\s*=\s*false/.test(svc) && /allowDowngrade\s*=\s*false/.test(svc) && /autoInstallOnAppQuit\s*=\s*false/.test(svc));
  ok('N updaterService: forceDevUpdateConfig=false (sem dev-app-update)', /forceDevUpdateConfig\s*=\s*false/.test(svc));
  ok('N updaterService: allowPrerelease=true (canário) setado ANTES de allowDowngrade=false', /allowPrerelease\s*=\s*true/.test(svc) && svc.indexOf('allowPrerelease = true') >= 0 && svc.indexOf('allowPrerelease = true') < svc.indexOf('allowDowngrade = false'));
}

// ---------- 5) package.json: só version + dependência electron-updater ----------
{
  const b = JSON.parse(baseline('package.json'));
  const c = JSON.parse(current('package.json'));
  ok('P version 1.0.177 → 1.0.178-canary.1', b.version === '1.0.177' && c.version === '1.0.178-canary.1');
  ok('P electron-updater ausente na produção, presente na candidata', !(b.dependencies && b.dependencies['electron-updater']) && c.dependencies && c.dependencies['electron-updater'] === '6.8.9');
  // zera version + remove electron-updater dos deps → o resto deve ser idêntico
  const nb = { ...b, version: null }; const nc = { ...c, version: null, dependencies: { ...c.dependencies } };
  delete nc.dependencies['electron-updater'];
  ok('P package.json idêntico exceto version + electron-updater', JSON.stringify(nb) === JSON.stringify(nc));
}

// ---------- 6) electron-builder.yml: produção é PREFIXO; sufixo = só bloco publish ----------
{
  const b = baseline('electron-builder.yml');
  const c = current('electron-builder.yml');
  ok('EB produção é prefixo exato da candidata (nada acima do publish mudou)', c.startsWith(b));
  const suffix = c.slice(b.length);
  ok('EB sufixo adicionado contém SOMENTE o provider github público (owner/repo), sem segredo embutido', /provider:\s*github/.test(suffix) && /owner:\s*agidseven-lang/.test(suffix) && /repo:\s*Agenda/.test(suffix) && !/\b(token|secret|password|gh_token|pat)\b\s*[:=]/i.test(suffix));
  ok('EB identidade NSIS/appId/productName/artifactName intacta no prefixo', /appId:\s*br\.com\.idseven\.agenda\.desktop/.test(b) && /productName:\s*Agenda ID Seven Desktop/.test(b) && !/appId/.test(suffix) && !/productName/.test(suffix) && !/artifactName/.test(suffix));
}

// ---------- 7) package-lock.json: version bump + electron-updater no fecho ----------
{
  const b = baseline('package-lock.json');
  const c = current('package-lock.json');
  ok('L produção sem electron-updater no lock', !/"node_modules\/electron-updater"/.test(b));
  ok('L candidata com electron-updater no lock', /"node_modules\/electron-updater"/.test(c));
  ok('L lock version 1.0.177 → 1.0.178-canary.1', /"version":\s*"1\.0\.177"/.test(b) && /"version":\s*"1\.0\.178-canary\.1"/.test(c));
}

// ---------- 8) FUNÇÕES CRÍTICAS DE NEGÓCIO: byte-idênticas (mandato FASE 13) ----------
// Extraídas do renderer SEM regiões UPDATER (prova explícita além do R1).
{
  const base = baseline('src/renderer/index.html');
  const cur = stripUpdater(current('src/renderer/index.html'));
  const FUNCS = [
    'renderConfig', 'renderForm', 'newForm', 'openNewTaskWizard', 'ncCaptureBusy',
    'notifShowToast', 'notifNormalize', 'buildClientMessage', 'buildShareClientUrl',
    'validateShareUrl', 'resolveCanonicalSlaTimeline', 'canonicalNowMs',
  ];
  for (const fn of FUNCS) {
    const a = fnSrc(base, fn), b = fnSrc(cur, fn);
    if (a === null && b === null) { ok(`F ${fn} (ausente em ambos — n/a)`, true); continue; }
    ok(`F ${fn} byte-idêntica produção×candidata`, a !== null && b !== null && a === b);
  }
}

// ---------- 9) módulos de negócio no MAIN (login/logout/sessão/clock/notifier/tray) ----------
{
  ok('B9 login/logout/sessão (auth-core.ts) byte-idêntico', baseline('src/main/auth-core.ts') === current('src/main/auth-core.ts'));
  ok('B9 clockSync byte-idêntico', baseline('src/main/clockSync.ts') === current('src/main/clockSync.ts'));
  ok('B9 notifier (notificação azul/SLA) byte-idêntico', baseline('src/main/notifier.ts') === current('src/main/notifier.ts'));
  ok('B9 tray byte-idêntico', baseline('src/main/tray.ts') === current('src/main/tray.ts'));
}

console.log(`\nf341a-region-invariance: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
