#!/usr/bin/env node
/* =====================================================================
   F3.4.2A (Stage-1B) — GATE DE PRESERVAÇÃO REGION-SCOPED (canário 1.0.179-canary.5).
   Prova que a candidata CANÁRIO 1.0.179-canary.5 difere da PRODUÇÃO FÍSICA
   APROVADA 1.0.177 (commit 2963927) SOMENTE nas regiões sentinela
   `UPDATER:BEGIN…UPDATER:END` + `PRESENCE:BEGIN…PRESENCE:END` e em arquivos
   whitelisted (NOVOS). Fora disso, BYTE-IDENTIDADE (HARD NO-GO).

   Whitelist de mudança permitida (mandato):
     - NOVO desktop/src/main/updaterService.ts (atualizador nativo — canário)
     - NOVO desktop/src/main/presenceAuthProbe.ts (sonda /auth mínima — canário)
     - NOVO desktop/src/main/presenceClient.ts (cliente WebSocket de presença — canário)
     - fiação IPC no main (main.ts, só em UPDATER:* e PRESENCE:*)
     - API mínima no preload (preload.ts, só em UPDATER:* e PRESENCE:*)
     - seções Atualizações + Presença no renderer (index.html, só em UPDATER:* e PRESENCE:*)
     - deep-link config/updates em notifRoute (só dentro de UPDATER:*)
     - dependências electron-updater + ws (package.json / package-lock.json)
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

console.log(`F3.4.2A — region-scoped invariance (candidata CANÁRIO 1.0.179-canary.5 vs produção ${BASE_SHA})`);

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

// ---------- 5b) presenceClient.ts: NOVO + contrato de segurança (cliente WebSocket, Stage-2A) ----------
// Cross-check ESTÁTICO leve (a prova AUTORITATIVA é f342a-presence-client.test.mjs, runtime).
{
  ok('PC presenceClient.ts AUSENTE na produção 1.0.177', baselineMissing('src/main/presenceClient.ts'));
  const p = current('src/main/presenceClient.ts');
  const code = stripComments(p);
  ok('PC presente e substancial (createPresenceClient)', p.length > 2000 && /createPresenceClient/.test(code));
  ok('PC lê o token do MESMO session.json (0600); token só no main', /session\.json/.test(code) && /readToken/.test(code));
  ok('PC /auth usa Authorization: Bearer <token>', /Bearer\s*["']\s*\+\s*token/.test(code));
  // O corpo do /auth é LITERALMENTE { deviceId } (prova direta). O cliente LÊ `u.userId` do baseline do
  // servidor (inbound, roster) — legítimo; o que é proibido é ENVIAR userId (uma CHAVE `userId:` de saída).
  ok('PC body do /auth = { deviceId } (nunca ENVIA userId — sem chave userId:)', /body:\s*JSON\.stringify\(\{ deviceId \}\)/.test(code) && !/userId\s*:/.test(code));
  ok('PC deviceId = randomUUID persistido; sem hostname/MAC/IP/serial', /randomUUID\(\)/.test(code) && /presence-device\.json/.test(code) && !/hostname|networkInterfaces|macAddress|\bserial\b/i.test(code));
  ok('PC WSS /ws com ticket na URL + reconexão backoff + heartbeat', /wsEndpoint/.test(code) && /ticket/.test(code) && /scheduleReconnect/.test(code) && /heartbeat/i.test(code));
  ok('PC nenhuma chamada de log passa token/ticket', !/\blog\([^)]*\b(token|ticket)\b/i.test(code));
  ok('PC estado público sanitizado — nenhum literal token:/ticket: no código', !/\btoken\s*:/.test(code) && !/\bticket\s*:/.test(code));
  // Stage-2A-X2: SEM keep-alive (onActive/onIdle removidos) + DIAGNÓSTICO sanitizado (code/reason/quem/reconexão).
  ok('PC sem onActive/onIdle (keep-alive removido)', !/onActive/.test(code) && !/onIdle/.test(code));
  ok('PC diagnóstico: captura lastCloseCode/lastCloseReason/lastCloseWasClient + reconnectScheduled/Executed + onlineDroppedAt', /lastCloseCode/.test(code) && /lastCloseReason/.test(code) && /lastCloseWasClient/.test(code) && /reconnectScheduled/.test(code) && /reconnectExecuted/.test(code) && /onlineDroppedAt/.test(code) && /sanitizeReason/.test(code));
  ok('PC reason do close é sanitizado (só [a-z0-9_ -], curto) — nunca vaza dados privados', /replace\(\/\[\^a-zA-Z0-9_ -\]\/g/.test(code));
  // Stage-2B: disconnect(reason) ENVIA goodbye antes de fechar (logout/tray_exit/update) — remoção imediata no servidor.
  ok('PC disconnect(reason) envia goodbye {type,reason} antes de fechar', /function disconnect\(reason/.test(code) && /JSON\.stringify\(\{ type: "goodbye", reason: r \}\)/.test(code) && /"tray_exit"[\s\S]{0,20}"update"/.test(code));
}

// ---------- 6) main.ts: fiação Escopo A (onNotify->HUB) + PRESENCE (probe + WS) IPC (só em regiões) ----------
{
  const m = current('src/main/main.ts');
  ok('W1 onNotify monta NotifPayload e chama deliverNotification (produtor único no HUB)', /onNotify:\s*\(kind, st\)/.test(m) && /desktop_update_available/.test(m) && /deliverNotification\(/.test(m));
  ok('W2 dedupKey canônico de update (available/downloaded)', /dedupKey:\s*`desktop_update_available:/.test(m) && /dedupKey:\s*`desktop_update_downloaded:/.test(m));
  ok('W3 IPC presence-auth-probe + createPresenceProbe + createPresenceClient + presence-realtime-state', /ipcMain\.handle\("presence-auth-probe"/.test(m) && /createPresenceProbe\(/.test(m) && /createPresenceClient\(/.test(m) && /ipcMain\.handle\("presence-realtime-state"/.test(m));
  ok('W4 sonda pós-login diagnóstico sem token (só status/duração/campos)', /presence\.login\.probe/.test(m) && !/presence\.login\.probe[^\n]*token/i.test(m));
  ok('W4b WS liga no login (connect) e desliga no logout/Sair/update (disconnect com goodbye reason)', /presenceClient\.connect\(\)/.test(m) && /presenceClient\.disconnect\("logout"\)/.test(m) && /presenceClient\.disconnect\("tray_exit"\)/.test(m) && /presenceClient\.disconnect\("update"\)/.test(m));
  // Stage-2A-X2: SEM powerSaveBlocker (removido) + DIAGNÓSTICO sanitizado (contexto do main) só em PRESENCE.
  ok('W6 SEM powerSaveBlocker/prevent-app-suspension no CÓDIGO do main (removido)', !/powerSaveBlocker|prevent-app-suspension|presenceKeepAliveOn/.test(stripComments(m)));
  ok('W7 diagnóstico do main: presenceDiagCtx (uptime/janela/tray/rede) + suspend/resume + onLog enriquecido', /function presenceDiagCtx\(/.test(m) && /uptimeMs/.test(m) && /presence\.power\.suspend/.test(m) && /\.\.\.presenceDiagCtx\(\)/.test(m));
  ok('W7b reabrir-da-bandeja = verificação idempotente (show -> diag + connect; não é a recuperação principal)', /mainWin\.on\("show".*presence\.show\.verify/.test(m) && /presenceClient\.connect\(\)/.test(m));
  ok('W8 toda a fiação nova (diag/show/power) vive SÓ em regiões sentinela (strip remove presenceDiagCtx)', !/presenceDiagCtx/.test(stripSentinels(m)) && !/presence\.show\.verify/.test(stripSentinels(m)));
  ok('W5 fiação nova SÓ dentro de regiões sentinela (strip == 1.0.177)', stripSentinels(m) === baseline('src/main/main.ts'));
}

// ---------- 7) preload.ts: expõe SÓ estado/resultado sanitizado (nunca token/ticket) ----------
{
  const pl = current('src/preload/preload.ts');
  ok('PL preload expõe presence.authProbe + realtimeState (sanitizado, via IPC)', /presence:\s*\{[\s\S]*authProbe[\s\S]*ipcRenderer\.invoke\("presence-auth-probe"\)/.test(pl) && /presence-realtime-state/.test(pl));
  const segRaw = pl.split('PRESENCE:BEGIN')[1] ? pl.split('PRESENCE:BEGIN')[1].split('PRESENCE:END')[0] : '';
  const seg = stripComments(segRaw); // comentários citam "nunca token/ticket" de propósito — checamos o CÓDIGO
  ok('PL CÓDIGO da região PRESENCE do preload NÃO manipula token/ticket/Bearer', !/token/i.test(seg) && !/ticket/i.test(seg) && !/bearer/i.test(seg));
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

// ---------- 9) package.json: só version + deps electron-updater + ws (WebSocket client) ----------
{
  const b = JSON.parse(baseline('package.json'));
  const c = JSON.parse(current('package.json'));
  ok('P version 1.0.177 → 1.0.179-canary.5', b.version === '1.0.177' && c.version === '1.0.179-canary.5');
  ok('P electron-updater ausente na produção, presente na candidata', !(b.dependencies && b.dependencies['electron-updater']) && c.dependencies && c.dependencies['electron-updater'] === '6.8.9');
  ok('P ws (cliente WebSocket de presença) ausente na produção, presente na candidata', !(b.dependencies && b.dependencies['ws']) && c.dependencies && typeof c.dependencies['ws'] === 'string' && /^\^?8\./.test(c.dependencies['ws']));
  // zera version + remove electron-updater E ws dos deps → o restante deve ser idêntico à 1.0.177
  const nb = { ...b, version: null }; const nc = { ...c, version: null, dependencies: { ...c.dependencies } };
  delete nc.dependencies['electron-updater'];
  delete nc.dependencies['ws'];
  ok('P package.json idêntico exceto version + electron-updater + ws', JSON.stringify(nb) === JSON.stringify(nc));
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

// ---------- 11) package-lock.json: version bump + electron-updater + ws no fecho ----------
{
  const b = baseline('package-lock.json');
  const c = current('package-lock.json');
  ok('L produção sem electron-updater no lock', !/"node_modules\/electron-updater"/.test(b));
  ok('L candidata com electron-updater no lock', /"node_modules\/electron-updater"/.test(c));
  ok('L produção sem ws no lock', !/"node_modules\/ws"/.test(b));
  ok('L candidata com ws no lock', /"node_modules\/ws"/.test(c));
  ok('L lock version 1.0.177 → 1.0.179-canary.5', /"version":\s*"1\.0\.177"/.test(b) && /"version":\s*"1\.0\.179-canary\.5"/.test(c));
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

// ---------- 14) Stage-2C: broadcast/notificações de presença + snooze + tela Equipe + J6 intocado ----------
{
  const m = current('src/main/main.ts');
  const svc = current('src/main/updaterService.ts');
  const pc = stripComments(current('src/main/presenceClient.ts'));
  const cur = current('src/renderer/index.html');
  const stripped = stripSentinels(cur);

  // main.ts — produtor ÚNICO de entrada/saída via HUB + snooze injetado (só em regiões sentinela)
  ok('C1 main fia onPresenceEvent -> deliverNotification (ON-LINE/OFF-LINE, entrou/saiu)', /onPresenceEvent:\s*\(kind, user, meta\)/.test(m) && /"USU\S+RIO ON-LINE"/.test(m) && /"USU\S+RIO OFF-LINE"/.test(m) && /entrou no sistema/.test(m) && /saiu do sistema/.test(m) && /deliverNotification\(/.test(m));
  ok('C2 notificação de presença: dedupKey=eventId + deep equipe + severity verde/neutro', /dedupKey:\s*meta\.eventId/.test(m) && /deep:\s*"equipe"/.test(m) && /severity:\s*online\s*\?\s*"success"\s*:\s*"info"/.test(m));
  ok('C3 main injeta snooze (relógio canônico + readSnooze/writeSnooze em userData)', /now:\s*\(\)\s*=>[\s\S]{0,120}offsetMs/.test(m) && /readSnooze:/.test(m) && /writeSnooze:/.test(m) && /updater-snooze\.json/.test(m));
  ok('C4 fiação Stage-2C do main vive SÓ em regiões sentinela (strip == 1.0.177)', stripSentinels(m) === baseline('src/main/main.ts'));

  // updaterService.ts (NOVO/whitelisted) — "LEMBRAR MAIS TARDE" persistido, produtor único preservado
  ok('C5 updaterService: SNOOZE persistido (snoozeActiveFor suprime notify; defer grava; download/install limpam)', /SNOOZE_MS/.test(svc) && /snoozeActiveFor\(/.test(svc) && /writeSnooze\(\{/.test(svc) && /clearSnooze\("download"\)/.test(svc) && /clearSnooze\("install"\)/.test(svc));
  ok('C6 updaterService: notify de "available" é GATED pelo snooze (não repete a cada verificação)', /snoozeActiveFor\(ver\)/.test(svc) && /updater\.snooze\.suppress/.test(svc));

  // presenceClient.ts (NOVO/whitelisted) — consumo do wire + dedupe + guardião anti-self + roster sanitizado
  ok('C7 presenceClient consome presence_transition + baseline.self + dedupe (eventId + revision > baseline)', /presence_transition/.test(pc) && /m\.self/.test(pc) && /seenEvents/.test(pc) && /baselineRev/.test(pc));
  // roster SEM deviceId é provado em RUNTIME (f342a-presence-client + presence-notifications: roster.every(!('deviceId' in e))).
  // Aqui: guardião anti-self + gancho + tipo de roster sanitizado (id/name/photo/role/online/lastSeen/sessions — sem deviceId).
  ok('C8 presenceClient: guardião anti-auto-notificação + gancho onPresenceEvent + tipo de roster sanitizado', /uid === selfId/.test(pc) && /deps\.onPresenceEvent\(/.test(pc) && /PresenceRosterEntry/.test(pc) && !/PresenceRosterEntry\s*=\s*\{[^}]*deviceId/.test(pc));

  // renderer — tela Equipe em tempo real vive SÓ em PRESENCE (some no strip); sem deviceId
  ok('C9 painel Equipe (presEquipePanel) existe e some no strip (só em PRESENCE)', /presEquipePanel/.test(cur) && !/presEquipePanel/.test(stripped));
  ok('C10 painel Equipe: On-line agora / Visto por último / sessões só admin; sem deviceId', /On-line agora/.test(cur) && /Visto por .ltimo .s/.test(cur) && /state\.user\.admin/.test(cur) && !/presEquipePanel[\s\S]{0,4000}deviceId/.test(cur));
}

// ---------- 15) Worker J6 (idseven-push) BYTE-IDÊNTICO à baseline 1.0.177 (fora do escopo) ----------
{
  // idseven-push vive na RAIZ do repo (wrangler.toml). Stage-2C toca só desktop/ + presence-service/.
  const j6cur = norm(execSync('git show HEAD:wrangler.toml', { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }).toString('utf8'));
  const j6base = norm(execSync(`git show ${BASE_SHA}:wrangler.toml`, { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 }).toString('utf8'));
  ok('J6 wrangler.toml (idseven-push) byte-idêntico à produção 1.0.177 (Worker J6 intocado)', j6cur === j6base && /name\s*=\s*"idseven-push"/.test(j6cur));
}

console.log(`\nf342a-region-invariance: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
