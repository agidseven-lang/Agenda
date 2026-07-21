#!/usr/bin/env node
/* =====================================================================
   F3.4.1A / F3.4.2A — MÁQUINA DE ESTADOS DO ATUALIZADOR (proteção técnica).
   SEM identidades, SEM rede, SEM electron real, SEM release real.
   Carrega dist/main/updaterService.js com `electron` e `electron-updater`
   STUBADOS via Module._load; dirige os eventos e prova as transições +
   as guardas (check/download/instalação únicos; app ocupado; shutdown).
   F3.4.2A: cobre também onNotify (produtor ÚNICO da notificação) — dispara
   SÓ em 'available' e 'downloaded', nunca em outros estados, e é OPCIONAL.
   Estes testes NÃO substituem a prova nativa física (mandato F3.4.1A).
   ===================================================================== */
import Module from 'module';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');            // desktop/
const SVC = path.join(ROOT, 'dist', 'main', 'updaterService.js');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };
const flush = () => new Promise((r) => setImmediate(r));

// ---------------- stubs ----------------
class FakeAuto {
  constructor() {
    this._h = {};
    this.autoDownload = null; this.autoInstallOnAppQuit = null; this.allowDowngrade = null;
    this.allowPrerelease = null; this.channel = null; this.fullChangelog = null; this.forceDevUpdateConfig = null; this.logger = null;
    this.checkCalls = 0; this.downloadCalls = 0; this.quitInstall = null;
  }
  on(e, h) { (this._h[e] = this._h[e] || []).push(h); return this; }
  removeAllListeners(e) { if (e) delete this._h[e]; else this._h = {}; return this; }
  emit(e, arg) { (this._h[e] || []).slice().forEach((h) => h(arg)); }
  async checkForUpdates() { this.checkCalls++; return {}; }
  async downloadUpdate() { this.downloadCalls++; return []; }
  quitAndInstall(isSilent, forceRun) { this.quitInstall = { isSilent, forceRun }; }
}

let FAKE_AUTO = null;
let FAKE_VERSION = '1.0.179-canary.1';
const guardBox = { result: { safe: true } };
const winBox = { sent: [] };
const notifyBox = { calls: [] }; // F3.4.2A — captura das chamadas onNotify(kind, state)
const fakeWin = {
  isDestroyed: () => false,
  webContents: {
    send: (ch, p) => winBox.sent.push({ ch, p }),
    executeJavaScript: async () => guardBox.result,
  },
};

const origLoad = Module._load;
Module._load = function (req) {
  if (req === 'electron') return { app: { getVersion: () => FAKE_VERSION }, BrowserWindow: function () {} };
  if (req === 'electron-updater') return { autoUpdater: FAKE_AUTO };
  return origLoad.apply(this, arguments);
};

function makeService(opts) {
  opts = opts || {};
  FAKE_VERSION = opts.version || '1.0.179-canary.1';
  FAKE_AUTO = new FakeAuto();
  winBox.sent = [];
  notifyBox.calls = [];
  guardBox.result = { safe: true };
  globalThis.__beforeInstall = 0;
  const nowBox = { t: opts.t0 || 1_000_000_000 };
  delete require.cache[require.resolve(SVC)];
  const mod = require(SVC);
  const svc = mod.createUpdaterService({
    getWindow: () => fakeWin,
    onLog: () => {},
    beforeInstall: () => { globalThis.__beforeInstall++; },
    now: () => nowBox.t,
    getVersion: () => FAKE_VERSION,
    onNotify: (kind, st) => { notifyBox.calls.push({ kind, status: st && st.status, availableVersion: st && st.availableVersion }); },
  });
  return { mod, svc, auto: FAKE_AUTO, nowBox };
}

// helper: leva o serviço até update_available
async function toAvailable(svc, auto, ver) {
  svc.check();               // status -> checking
  await flush();
  auto.emit('update-available', { version: ver || '1.0.179-canary.2', files: [{ size: 1000 }], releaseName: 'RC', releaseNotes: 'notas', releaseDate: '2026-07-20' });
}

(async () => {
  console.log('F3.4.1A/F3.4.2A — updater state machine (stubs; sem identidades)');

  // ---- Configuração obrigatória (mandato) ----
  {
    const { svc, auto } = makeService({ version: '1.0.179-canary.1' });
    ok('CFG allowPrerelease=true (setado 1º)', auto.allowPrerelease === true);
    ok('CFG channel="canary" (setado 2º, após allowPrerelease)', auto.channel === 'canary');
    ok('CFG allowDowngrade=false (setado por último — nunca rebaixa)', auto.allowDowngrade === false);
    ok('CFG autoDownload=false', auto.autoDownload === false);
    ok('CFG autoInstallOnAppQuit=false', auto.autoInstallOnAppQuit === false);
    ok('CFG forceDevUpdateConfig=false (sem dev-app-update.yml)', auto.forceDevUpdateConfig === false);
    ok('CFG fullChangelog=false', auto.fullChangelog === false);
    ok('CFG logger sanitizado (funções info/warn/error)', auto.logger && typeof auto.logger.info === 'function');
    ok('INIT estado inicial idle', svc.getState().status === 'idle');
    ok('INIT canal=canary (channel="canary")', svc.getState().channel === 'canary');
  }

  // 11) FLAGS reais no runtime empacotado — canal canary isolado (canário)
  {
    const { svc, auto } = makeService({ version: '1.0.179-canary.1' });
    const flagsOk = auto.allowPrerelease === true && auto.channel === 'canary' && auto.allowDowngrade === false && auto.autoDownload === false && auto.autoInstallOnAppQuit === false && auto.forceDevUpdateConfig === false;
    ok('11 flags reais no runtime (allowPrerelease=true; channel="canary"; allowDowngrade/autoDownload/autoInstallOnAppQuit/forceDevUpdateConfig=false)', flagsOk);
    ok('11 estado reflete channel=canary + allowPrerelease=true', svc.getState().channel === 'canary' && svc.getState().allowPrerelease === true);
    // No bootstrap ESTÁVEL (FASE 16): allowPrerelease=false + channel="latest" — nunca consulta canary.
  }

  // 1) idle -> checking
  {
    const { svc, auto } = makeService();
    ok('1 idle→checking (getState + checkForUpdates chamado)', (svc.check(), svc.getState().status === 'checking') && auto.checkCalls === 1);
    await flush();
  }

  // 2) checking -> update_available (+ metadados)
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto, '1.0.179-canary.2');
    const s = svc.getState();
    ok('2 checking→update_available', s.status === 'update_available');
    ok('2 availableVersion capturada', s.availableVersion === '1.0.179-canary.2');
    ok('2 sizeBytes somado dos files', s.sizeBytes === 1000);
    ok('2 releaseNotes/date capturados', s.releaseNotes === 'notas' && s.releaseDate === '2026-07-20');
  }

  // 3) checking -> up_to_date
  {
    const { svc, auto } = makeService();
    svc.check(); await flush();
    auto.emit('update-not-available', { version: '1.0.179-canary.1' });
    ok('3 checking→up_to_date', svc.getState().status === 'up_to_date');
  }

  // 4) update_available -> downloading (download só após ação; downloadUpdate chamado)
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto);
    const r = await svc.download();
    ok('4 update_available→downloading (ok)', r.ok === true && svc.getState().status === 'downloading');
    ok('4 downloadUpdate chamado exatamente 1x', auto.downloadCalls === 1);
  }

  // 5) progresso (clamp + arredondamento na UI; estado bruto preservado)
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto); await svc.download();
    auto.emit('download-progress', { percent: 142.7, transferred: 427, total: 1000, bytesPerSecond: 100 });
    const p = svc.getState().progress;
    ok('5 progresso: percent clampado a 100', p && p.percent === 100);
    ok('5 progresso: transferred/total/bps preservados', p.transferred === 427 && p.total === 1000 && p.bytesPerSecond === 100);
  }

  // 6) update-downloaded -> downloaded
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto); await svc.download();
    auto.emit('update-downloaded', { version: '1.0.179-canary.2' });
    const s = svc.getState();
    ok('6 downloaded + flag downloaded=true', s.status === 'downloaded' && s.downloaded === true);
  }

  // F3.4.2A A) onNotify — produtor ÚNICO: dispara em 'available' e 'downloaded'
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto, '1.0.179-canary.2');
    const avail = notifyBox.calls.filter((c) => c.kind === 'available');
    ok('A1 onNotify("available") disparado 1x em update-available', avail.length === 1);
    ok('A1 onNotify recebe estado update_available + versão', !!avail[0] && avail[0].status === 'update_available' && avail[0].availableVersion === '1.0.179-canary.2');
    await svc.download();
    auto.emit('update-downloaded', { version: '1.0.179-canary.2' });
    const dl = notifyBox.calls.filter((c) => c.kind === 'downloaded');
    ok('A2 onNotify("downloaded") disparado 1x em update-downloaded', dl.length === 1);
    ok('A2 onNotify downloaded reflete status downloaded', !!dl[0] && dl[0].status === 'downloaded');
    const other = notifyBox.calls.filter((c) => c.kind !== 'available' && c.kind !== 'downloaded');
    ok('A3 onNotify SÓ em available/downloaded (nunca outros kinds)', other.length === 0);
  }

  // F3.4.2A A4) up_to_date/checking/progress/error NÃO disparam onNotify
  {
    const { svc, auto } = makeService();
    svc.check(); await flush();
    auto.emit('update-not-available', { version: '1.0.179-canary.1' });
    auto.emit('download-progress', { percent: 10, transferred: 1, total: 10, bytesPerSecond: 1 });
    auto.emit('error', { message: 'x', code: 'E' });
    ok('A4 zero onNotify em up_to_date/progress/error', notifyBox.calls.length === 0);
  }

  // F3.4.2A A5) onNotify é OPCIONAL — ausência não quebra (compat 1.0.178)
  {
    FAKE_AUTO = new FakeAuto(); FAKE_VERSION = '1.0.179-canary.1'; winBox.sent = [];
    delete require.cache[require.resolve(SVC)];
    const mod = require(SVC);
    const svc = mod.createUpdaterService({ getWindow: () => fakeWin, onLog: () => {}, beforeInstall: () => {}, now: () => 1, getVersion: () => FAKE_VERSION });
    svc.check(); await flush();
    FAKE_AUTO.emit('update-available', { version: '1.0.179-canary.2', files: [{ size: 1 }] });
    ok('A5 sem onNotify: update-available não lança (compat 1.0.178)', svc.getState().status === 'update_available');
  }

  // 7) erro (mensagem+código preservados; sanitizados)
  {
    const { svc, auto } = makeService();
    svc.check(); await flush();
    auto.emit('error', { message: 'boom em https://x/latest.yml', code: 'ERR_X' });
    const s = svc.getState();
    ok('7 status error', s.status === 'error');
    ok('7 error.code preservado', s.error && s.error.code === 'ERR_X');
    ok('7 error.message REDIGE url', s.error && /<url>/.test(s.error.message) && !/https?:\/\//.test(s.error.message));
  }

  // 8) retry após erro
  {
    const { svc, auto } = makeService();
    svc.check(); await flush();
    auto.emit('error', { message: 'x', code: 'E' });
    const r = await svc.check();
    ok('8 retry: nova verificação permitida após erro', r.ok === true && auto.checkCalls === 2);
  }

  // 9) defer
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto);
    const r = svc.defer();
    ok('9 defer→deferred', r.ok === true && svc.getState().status === 'deferred');
    ok('9 defer preserva availableVersion (retomável)', svc.getState().availableVersion === '1.0.179-canary.2');
  }

  // 10) versão inferior rejeitada — garantida por allowDowngrade=false (config)
  {
    const { auto } = makeService();
    ok('10 downgrade barrado por config allowDowngrade=false', auto.allowDowngrade === false);
  }

  // 12/13/14) metadata/hash/tamanho inválidos -> 'error' e limpa in-flight
  {
    const { svc, auto } = makeService();
    svc.check(); await flush();
    auto.emit('error', { message: 'sha512 mismatch', code: 'ERR_UPDATER_INVALID_UPDATE_INFO' });
    ok('12-14 metadata/hash/tamanho inválidos → error', svc.getState().status === 'error' && svc.getState().error.code === 'ERR_UPDATER_INVALID_UPDATE_INFO');
    const r = await svc.check(); // in-flight limpo => nova checagem permitida
    ok('12-14 in-flight limpo após erro (checagem permitida)', r.ok === true);
  }

  // 15) checks sobrepostos — só 1 in-flight
  {
    const { svc, auto } = makeService();
    const p1 = svc.check();           // inicia (checking, in-flight)
    const r2 = await svc.check();     // deve recusar
    ok('15 check sobreposto recusado (busy)', r2.ok === false && r2.reason === 'busy');
    ok('15 checkForUpdates chamado só 1x', auto.checkCalls === 1);
    await p1;
  }

  // 16) download duplicado
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto);
    svc.download();                    // downloading
    const r2 = await svc.download();   // recusa
    ok('16 download duplicado recusado', r2.ok === false && r2.reason === 'already_downloading');
    ok('16 downloadUpdate chamado só 1x', auto.downloadCalls === 1);
  }

  // 17) instalação duplicada
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto); await svc.download();
    auto.emit('update-downloaded', { version: '1.0.179-canary.2' });
    const r1 = await svc.installAndRestart();
    const r2 = await svc.installAndRestart();
    ok('17 primeira instalação ok + quitAndInstall 1x', r1.ok === true && auto.quitInstall && auto.quitInstall.isSilent === false && auto.quitInstall.forceRun === true);
    ok('17 segunda instalação recusada (already_installing)', r2.ok === false && r2.reason === 'already_installing');
  }

  // 18/19) app ocupado / formulário não salvo -> instalação bloqueada, sem quitAndInstall
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto); await svc.download();
    auto.emit('update-downloaded', { version: '1.0.179-canary.2' });
    guardBox.result = { safe: false, reason: 'Há uma tarefa em edição' };
    const r = await svc.installAndRestart();
    ok('18/19 instalação bloqueada quando renderer reporta trabalho não salvo', r.ok === false && r.reason === 'busy');
    ok('18/19 NÃO chamou quitAndInstall', auto.quitInstall === null);
    ok('18/19 NÃO executou teardown (beforeInstall)', globalThis.__beforeInstall === 0);
    ok('18/19 permanece downloaded (não perde o update)', svc.getState().status === 'downloaded');
  }

  // 20) shutdown seguro: teardown ANTES do quitAndInstall
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto); await svc.download();
    auto.emit('update-downloaded', { version: '1.0.179-canary.2' });
    guardBox.result = { safe: true };
    const r = await svc.installAndRestart();
    ok('20 install ok + status installing', r.ok === true && svc.getState().status === 'installing');
    ok('20 beforeInstall (teardown) executado', globalThis.__beforeInstall === 1);
    ok('20 quitAndInstall(false,true): assistido visível + relaunch', auto.quitInstall.isSilent === false && auto.quitInstall.forceRun === true);
  }

  // guardas extra: install exige downloaded; download exige update disponível
  {
    const { svc } = makeService();
    const ri = await svc.installAndRestart();
    ok('G install recusa sem update baixado', ri.ok === false && ri.reason === 'no_update_downloaded');
    const rd = await svc.download();
    ok('G download recusa sem update disponível', rd.ok === false && rd.reason === 'no_update');
  }

  // política de verificação: sem tempestade — auto-check respeita intervalo de 6h
  {
    const { svc, auto, nowBox } = makeService({ t0: 5_000_000 });
    svc.checkAuto('a'); await flush();
    const c1 = auto.checkCalls;
    svc.checkAuto('b'); await flush();     // dentro de 6h -> pulado
    const c2 = auto.checkCalls;
    nowBox.t += 6 * 60 * 60 * 1000 + 1;     // passa 6h
    svc.checkAuto('c'); await flush();      // permitido
    const c3 = auto.checkCalls;
    ok('POL auto-check inicial executa', c1 === 1);
    ok('POL auto-check dentro de 6h é pulado (sem tempestade)', c2 === 1);
    ok('POL auto-check após 6h executa', c3 === 2);
  }

  // maybeCheckOnResume: só reverifica se venceu
  {
    const { svc, auto, nowBox } = makeService({ t0: 9_000_000 });
    svc.checkAuto('login'); await flush();
    ok('RES sync inicial no login', auto.checkCalls === 1);
    svc.maybeCheckOnResume(); await flush();        // recente -> não reverifica
    ok('RES resume recente não reverifica', auto.checkCalls === 1);
    nowBox.t += 6 * 60 * 60 * 1000 + 1;
    svc.maybeCheckOnResume(); await flush();        // vencido -> reverifica
    ok('RES resume vencido reverifica', auto.checkCalls === 2);
  }

  // estado público sanitizado: nunca token/url/headers/caminho de arquivo
  {
    const { svc, auto } = makeService();
    await toAvailable(svc, auto);
    const keys = Object.keys(svc.getState());
    const forbidden = keys.filter((k) => /token|url|header|cookie|path|file|feed|auth/i.test(k));
    ok('SAN estado público não expõe token/url/headers/path/feed', forbidden.length === 0);
    ok('SAN emit enviou "updater-state" ao renderer', winBox.sent.some((m) => m.ch === 'updater-state'));
  }

  // redact(): remove urls e segredos dos logs
  {
    const { mod } = makeService();
    const r = mod.redact('feed https://a.b/c?x=1 token=SECRET bearer: ZZZ');
    ok('RED redige url', /<url>/.test(r) && !/https?:\/\//.test(r));
    ok('RED redige token/bearer', /token=<redacted>/i.test(r) && /bearer=<redacted>/i.test(r));
  }

  // ---- Stage-2C: LEMBRAR MAIS TARDE (snooze persistido; gate da renotificação de "available") ----
  {
    const store = { s: null };
    delete require.cache[require.resolve(SVC)];
    FAKE_AUTO = new FakeAuto(); FAKE_VERSION = '1.0.179-canary.4';
    const nowBox = { t: 1000 };
    const notifies = [];
    const mod = require(SVC);
    const svc = mod.createUpdaterService({
      getWindow: () => fakeWin, onLog: () => {}, beforeInstall: () => {},
      now: () => nowBox.t, getVersion: () => FAKE_VERSION,
      onNotify: (kind, st) => notifies.push({ kind, v: st.availableVersion }),
      readSnooze: () => store.s, writeSnooze: (x) => { store.s = x; }, snoozeMs: 10000,
    });
    svc.check(); await flush();
    FAKE_AUTO.emit('update-available', { version: '1.0.179-canary.5', files: [{ size: 1 }] });
    ok('SNZ available (sem snooze) notifica 1x', notifies.length === 1 && notifies[0].kind === 'available');
    svc.defer();
    ok('SNZ defer grava snooze {version, channel=canary, until=now+snoozeMs}', !!store.s && store.s.version === '1.0.179-canary.5' && store.s.channel === 'canary' && store.s.until === 11000);
    nowBox.t = 5000; // < until: snooze ativo
    svc.check(); await flush();
    FAKE_AUTO.emit('update-available', { version: '1.0.179-canary.5', files: [{ size: 1 }] });
    ok('SNZ snooze ativo SUPRIME a renotificação da MESMA versão', notifies.length === 1);
    FAKE_AUTO.emit('update-available', { version: '1.0.179-canary.6', files: [{ size: 1 }] });
    ok('SNZ versão DIFERENTE ignora o snooze (nova versão notifica)', notifies.length === 2 && notifies[1].v === '1.0.179-canary.6');
    store.s = { version: '1.0.179-canary.5', channel: 'canary', until: 5000 };
    nowBox.t = 6000; // > until: snooze expirado
    FAKE_AUTO.emit('update-available', { version: '1.0.179-canary.5', files: [{ size: 1 }] });
    ok('SNZ snooze EXPIRADO volta a notificar', notifies.length === 3);
    store.s = { version: '1.0.179-canary.5', channel: 'canary', until: 999999 };
    await svc.download(); await flush();
    ok('SNZ download() LIMPA o snooze (usuário iniciou o download)', store.s === null);
    const before = notifies.length;
    store.s = { version: '1.0.179-canary.5', channel: 'canary', until: 999999 };
    FAKE_AUTO.emit('update-downloaded', { version: '1.0.179-canary.5' });
    ok('SNZ downloaded NUNCA é suprimido por snooze ("pronto para instalar" sempre chega)', notifies.length === before + 1 && notifies[notifies.length - 1].kind === 'downloaded');
  }

  console.log(`\nf341a-updater-state-machine: PASS=${pass} FAIL=${fail}`);
  Module._load = origLoad;
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
