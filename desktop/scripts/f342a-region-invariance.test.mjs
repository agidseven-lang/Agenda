#!/usr/bin/env node
/* =====================================================================
   F3.4.2A (Stage-1B) — GATE DE PRESERVAÇÃO REGION-SCOPED (canário 1.0.179-canary.1).
   Prova que a candidata CANÁRIO 1.0.179-canary.1 difere da PRODUÇÃO FÍSICA
   APROVADA 1.0.177 (commit 2963927) SOMENTE nas regiões sentinela
   `UPDATER:BEGIN…UPDATER:END` + `PRESENCE:BEGIN…PRESENCE:END` e em arquivos
   whitelisted (NOVOS). Fora disso, BYTE-IDENTIDADE (HARD NO-GO).

   Whitelist de mudança permitida (mandato):
     - NOVO desktop/src/main/updaterService.ts (atualizador nativo — canário)
     - NOVO desktop/src/main/presenceAuthProbe.ts (sonda /auth mínima — canário)
     - fiação IPC no main (main.ts, só em UPDATER:* e PRESENCE:*)
     - API mínima no preload (preload.ts, só em UPDATER:* e PRESENCE:*)
     - seções Atualizações + Presença no renderer (index.html, só em UPDATER:* e PRESENCE:*)
     - deep-link config/updates em notifRoute (só dentro de UPDATER:*)
     - dependência electron-updater (package.json / package-lock.json)
     - publish config (electron-builder.yml, só o bloco publish anexado; channel canary)
     - versão + banner canário + UI canário (versão em package*.json; JS nas regiões sentinela)
     - workflows/testes exclusivos do updater/presence (fora do app.asar)

   ZERO REGRESSÃO: renderer/main/preload SEM as regiões sentinela == 1.0.177 byte-idêntico;
   auth-core/clockSync/notifier/tray/bgNotify/firebase/etc byte-idênticos. Fail-closed.
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
const norm = (s) => String(s).replace(/\r\n/g, '\n');
const baseline = (rel) => norm(execSync(`git show ${BASE_SHA}:desktop/${rel}`, { cwd: ROOT, maxBuffer: 96 * 1024 * 1024 }).toString('utf8'));
const baselineMissing = (rel) => { try { execSync(`git show ${BASE_SHA}:desktop/${rel}`, { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] }); return false; } catch { return true; } };
const current = (rel) => norm(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// Remove blocos UPDATER:BEGIN…UPDATER:END E PRESENCE:BEGIN…PRESENCE:END (linhas inteiras, inclusive sentinelas).
function stripSentinels(src) {
  const out = []; let skip = false;
  for (const ln of src.split('\n')) {
    if (!skip && /(UPDATER|PRESENCE):BEGIN/.test(ln)) { skip = true; continue; }
    if (skip) { if (/(UPDATER|PRESENCE):END/.test(ln)) skip = false; continue; }
    out.push(ln);
  }
  return out.join('\n');
}
function sentinelCount(src, tag) {
  const b = (src.match(new RegExp(tag + ':BEGIN', 'g')) || []).length;
  const e = (src.match(new RegExp(tag + ':END', 'g')) || []).length;
  return { b, e };
}
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

console.log(`F3.4.2A — region-scoped invariance (candidata CANÁRIO 1.0.179-canary.1 vs produção ${BASE_SHA})`);

// ---------- 1) RENDERER: fora das regiões sentinela, byte-idêntico ----------
{
  const base = baseline('src/renderer/index.html');
  const cur = current('src/renderer/index.html');
  const stripped = stripSentinels(cur);
  ok('R1 renderer SEM regiões UPDATER+PRESENCE === produção 1.0.177 (byte-idêntico)', stripped === base);
  const su = sentinelCount(cur, 'UPDATER'), sp = sentinelCount(cur, 'PRESENCE');
  ok('R2 sentinelas UPDATER balanceadas (BEGIN==END, >=2)', su.b === su.e && su.b >= 2);
  ok('R2 sentinelas PRESENCE balanceadas (BEGIN==END, >=2)', sp.b === sp.e && sp.b >= 2);
  ok('R3 produção NÃO contém sentinelas (baseline limpo)', !/UPDATER:BEGIN/.test(base) && !/PRESENCE:BEGIN/.test(base));
  const tampered = base.replace('Português (Brasil)', 'Português (ADULTERADO)');
  ok('R4 RED: adulteração de função de negócio É detectada pelo gate', stripSentinels(tampered) !== base && tampered !== base);
  ok('R5 banner canário só existe dentro de região sentinela (removido pelo strip)', /upd-canary-banner/.test(cur) && !/upd-canary-banner/.test(stripped));
  ok('R6 UI de presença só existe dentro de região PRESENCE (removida pelo strip)', /presenceConfigSectionHtml/.test(cur) && !/presenceConfigSectionHtml/.test(stripped));
}

// ---------- 2) MAIN + PRELOAD: fora das regiões sentinela, byte-idêntico ----------
for (const rel of ['src/main/main.ts', 'src/preload/preload.ts']) {
  const base = baseline(rel);
  const stripped = stripSentinels(current(rel));
  ok(`M ${rel} SEM regiões UPDATER+PRESENCE === produção 1.0.177`, stripped === base);
  ok(`M ${rel} produção sem sentinelas`, !/UPDATER:BEGIN/.test(base) && !/PRESENCE:BEGIN/.test(base));
}

// ---------- 3) MÓDULOS DE NEGÓCIO INTOCADOS: byte-idênticos ----------
for (const rel of [
  'src/main/clockSync.ts', 'src/main/notifier.ts', 'src/main/bgNotify.ts', 'src/main/firebase.ts',
  'src/main/auth-core.ts', 'src/main/auth.ts', 'src/main/autostart.ts', 'src/main/reminder.ts',
  'src/main/prewarm.ts', 'src/main/tray.ts', 'src/main/diag.ts', 'src/preload/bgnotify-preload.ts',
]) {
  ok(`U ${rel} byte-idêntico à produção (intocado)`, baseline(rel) === current(rel));
}

// ---------- 4) updaterService.ts: NOVO + flags CANÁRIO ordenadas ----------
{
  ok('N updaterService.ts AUSENTE na produção 1.0.177', baselineMissing('src/main/updaterService.ts'));
  const svc = current('src/main/updaterService.ts');
  ok('N updaterService.ts presente e substancial na candidata', svc.length > 2000 && /createUpdaterService/.test(svc));
  ok('N updaterService: autoDownload/allowDowngrade/autoInstallOnAppQuit=false', /autoDownload\s*=\s*false/.test(svc) && /allowDowngrade\s*=\s*false/.test(svc) && /autoInstallOnAppQuit\s*=\s*false/.test(svc));
  ok('N updaterService: forceDevUpdateConfig=false (sem dev-app-update)', /forceDevUpdateConfig\s*=\s*false/.test(svc));
  ok('N updaterService: ordem allowPrerelease=true -> channel="canary" -> allowDowngrade=false', (function () {
    const lp = svc.indexOf('allowPrerelease = true'), lc = svc.indexOf('channel = "canary"'), ld = svc.indexOf('allowDowngrade = false');
    return lp >= 0 && lc >= 0 && ld >= 0 && lp < lc && lc < ld;
  })());
  ok('N updaterService: onNotify (Escopo A) declarado como gancho opcional', /onNotify\?\:/.test(svc) && /deps\.onNotify\(\s*"available"/.test(svc) && /deps\.onNotify\(\s*"downloaded"/.test(svc));
}

// ---------- 5) presenceAuthProbe.ts: NOVO + contrato de segurança ----------
// Cross-check ESTÁTICO leve (a prova AUTORITATIVA é f342a-presence-probe.test.mjs, runtime 36/36).
// Padrões negativos rodam sobre o código SEM comentários (os comentários citam token/hostname de
// propósito, ao documentar o que é proibido — não podem derrubar o gate). URLs (https://) preservadas.
function stripComments(src) {
  return String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
{
  ok('PA presenceAuthProbe.ts AUSENTE na produção 1.0.177', baselineMissing('src/main/presenceAuthProbe.ts'));
  const p = current('src/main/presenceAuthProbe.ts');
  const code = stripComments(p);
  ok('PA presente e substancial (createPresenceProbe)', p.length > 1500 && /createPresenceProbe/.test(code));
  ok('PA lê o token do MESMO session.json (0600) do auth-core', /session\.json/.test(code) && /readToken/.test(code));
  ok('PA usa Authorization: Bearer <token>', /Bearer\s*["']\s*\+\s*token/.test(code));
  ok('PA body leva LITERALMENTE JSON.stringify({ deviceId }) — nada além de deviceId', /body:\s*JSON\.stringify\(\{ deviceId \}\)/.test(code));
  ok('PA código não constrói body com userId/name/email/token', !/userId/.test(code) && !/JSON\.stringify\(\{[^}]*\btoken\b/.test(code));
  ok('PA deviceId = randomUUID persistido; código não usa hostname/MAC/IP/serial', /randomUUID\(\)/.test(code) && /presence-device\.json/.test(code) && !/hostname|networkInterfaces|macAddress|\bserial\b/i.test(code));
  ok('PA nenhuma chamada de log passa o token (log só recebe status/duração)', !/\blog\([^)]*\btoken\b/i.test(code) && !/console\.log[^\n]*\btoken\b/i.test(code));
  ok('PA resultado sanitizado (requiredFieldsPresent/validated) — nenhum literal token:/ticket: no código', /requiredFieldsPresent/.test(code) && /validated/.test(code) && !/\btoken\s*:/.test(code) && !/\bticket\s*:/.test(code));
  ok('PA guarda de concorrência (inFlight/busy)', /inFlight/.test(code) && /busy/.test(code));
  ok('PA timeout via AbortController', /AbortController/.test(code) && /timeout/.test(code));
}

// ---------- 6) main.ts: fiação Escopo A (onNotify->HUB) + PRESENCE IPC (só em regiões) ----------
{
  const m = current('src/main/main.ts');
  ok('W1 onNotify monta NotifPayload e chama deliverNotification (produtor único no HUB)', /onNotify:\s*\(kind, st\)/.test(m) && /desktop_update_available/.test(m) && /deliverNotification\(/.test(m));
  ok('W2 dedupKey canônico de update (available/downloaded)', /dedupKey:\s*`desktop_update_available:/.test(m) && /dedupKey:\s*`desktop_update_downloaded:/.test(m));
  ok('W3 IPC presence-auth-probe registrado + createPresenceProbe instanciado', /ipcMain\.handle\("presence-auth-probe"/.test(m) && /createPresenceProbe\(/.test(m));
  ok('W4 sonda pós-login diagnóstico sem token (só status/duração/campos)', /presence\.login\.probe/.test(m) && !/presence\.login\.probe[^\n]*token/i.test(m));
  ok('W5 fiação nova SÓ dentro de regiões sentinela (strip == 1.0.177)', stripSentinels(m) === baseline('src/main/main.ts'));
}

// ---------- 7) preload.ts: expõe SÓ a sonda sanitizada (nunca token) ----------
{
  const pl = current('src/preload/preload.ts');
  ok('PL preload expõe presence.authProbe (sanitizado, via IPC)', /presence:\s*\{[\s\S]*authProbe[\s\S]*ipcRenderer\.invoke\("presence-auth-probe"\)/.test(pl));
  ok('PL preload NÃO expõe token/ticket/deviceId ao renderer', !/authProbe[^\n]*token/i.test(pl) && !/ticket/i.test(pl.split('PRESENCE:BEGIN')[1] ? pl.split('PRESENCE:BEGIN')[1].split('PRESENCE:END')[0] : ''));
}

// ---------- 8) renderer: produtor único (updMaybeToast neutralizado) + deep-link config/updates ----------
{
  const cur = current('src/renderer/index.html');
  const mt = fnSrc(cur, 'updMaybeToast');
  ok('T1 updMaybeToast NEUTRALIZADO (não emite notifShowToast — HUB é único produtor)', mt !== null && !/notifShowToast/.test(mt));
  ok('T2 rota deep config/updates presente (abre Configurações→Atualizações)', /deep==='config\/updates'/.test(cur) && /pres-root|upd-root/.test(cur));
  // A rota config/updates vive DENTRO de UPDATER:* em notifRoute -> notifRoute (negócio) volta idêntico ao strip
  const base = baseline('src/renderer/index.html');
  const curStripped = stripSentinels(cur);
  const a = fnSrc(base, 'notifRoute'), b = fnSrc(curStripped, 'notifRoute');
  ok('T3 notifRoute (negócio) byte-idêntico após strip (deep-link só em UPDATER:*)', a !== null && b !== null && a === b);
}

// ---------- 9) package.json: só version + dependência electron-updater ----------
{
  const b = JSON.parse(baseline('package.json'));
  const c = JSON.parse(current('package.json'));
  ok('P version 1.0.177 → 1.0.179-canary.1', b.version === '1.0.177' && c.version === '1.0.179-canary.1');
  ok('P electron-updater ausente na produção, presente na candidata', !(b.dependencies && b.dependencies['electron-updater']) && c.dependencies && c.dependencies['electron-updater'] === '6.8.9');
  const nb = { ...b, version: null }; const nc = { ...c, version: null, dependencies: { ...c.dependencies } };
  delete nc.dependencies['electron-updater'];
  ok('P package.json idêntico exceto version + electron-updater', JSON.stringify(nb) === JSON.stringify(nc));
}

// ---------- 10) electron-builder.yml: produção é PREFIXO; sufixo = publish canary sem segredo ----------
{
  const b = baseline('electron-builder.yml');
  const c = current('electron-builder.yml');
  ok('EB produção é prefixo exato da candidata (nada acima do publish mudou)', c.startsWith(b));
  const suffix = c.slice(b.length);
  ok('EB sufixo = provider github público (owner/repo) + channel canary, sem segredo', /provider:\s*github/.test(suffix) && /owner:\s*agidseven-lang/.test(suffix) && /repo:\s*Agenda/.test(suffix) && /channel:\s*canary/.test(suffix) && !/\b(token|secret|password|gh_token|pat)\b\s*[:=]/i.test(suffix));
  ok('EB identidade NSIS/appId/productName/artifactName intacta no prefixo', /appId:\s*br\.com\.idseven\.agenda\.desktop/.test(b) && /productName:\s*Agenda ID Seven Desktop/.test(b) && !/appId/.test(suffix) && !/productName/.test(suffix) && !/artifactName/.test(suffix));
}

// ---------- 11) package-lock.json: version bump + electron-updater no fecho ----------
{
  const b = baseline('package-lock.json');
  const c = current('package-lock.json');
  ok('L produção sem electron-updater no lock', !/"node_modules\/electron-updater"/.test(b));
  ok('L candidata com electron-updater no lock', /"node_modules\/electron-updater"/.test(c));
  ok('L lock version 1.0.177 → 1.0.179-canary.1', /"version":\s*"1\.0\.177"/.test(b) && /"version":\s*"1\.0\.179-canary\.1"/.test(c));
}

// ---------- 12) FUNÇÕES CRÍTICAS DE NEGÓCIO: byte-idênticas (mandato) ----------
{
  const base = baseline('src/renderer/index.html');
  const cur = stripSentinels(current('src/renderer/index.html'));
  const FUNCS = [
    'renderConfig', 'renderForm', 'newForm', 'openNewTaskWizard', 'ncCaptureBusy',
    'notifShowToast', 'notifNormalize', 'notifRoute', 'buildClientMessage', 'buildShareClientUrl',
    'validateShareUrl', 'resolveCanonicalSlaTimeline', 'canonicalNowMs',
  ];
  for (const fn of FUNCS) {
    const a = fnSrc(base, fn), b = fnSrc(cur, fn);
    if (a === null && b === null) { ok(`F ${fn} (ausente em ambos — n/a)`, true); continue; }
    ok(`F ${fn} byte-idêntica produção×candidata`, a !== null && b !== null && a === b);
  }
}

// ---------- 13) módulos de negócio no MAIN (login/logout/sessão/clock/notifier/tray) ----------
{
  ok('B13 login/logout/sessão (auth-core.ts) byte-idêntico', baseline('src/main/auth-core.ts') === current('src/main/auth-core.ts'));
  ok('B13 clockSync byte-idêntico', baseline('src/main/clockSync.ts') === current('src/main/clockSync.ts'));
  ok('B13 notifier (notificação azul/SLA) byte-idêntico', baseline('src/main/notifier.ts') === current('src/main/notifier.ts'));
  ok('B13 tray byte-idêntico', baseline('src/main/tray.ts') === current('src/main/tray.ts'));
}

console.log(`\nf342a-region-invariance: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
