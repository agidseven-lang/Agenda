/* F3.5.5C-H1 — PROVA DE CICLOS REPETITIVOS (Electron REAL).
 * 20 aberturas/fechamentos consecutivos do renderer REAL (mesmos bytes de src/renderer/index.html)
 * no cenário 'ok' (sessão persistida + servidor aceita): TODOS os 20 boots devem terminar
 * AUTENTICADOS, sem NENHUM flash de tela de login e sem splash residual.
 * Cada ciclo = loadFile novo (boot frio do documento) na mesma janela — equivalente a abrir e
 * fechar o app 20 vezes seguidas. Padrão do harness f355ch1-electron-proof-main.js. */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CYCLES = parseInt(process.env.PROOF_CYCLES || '20', 10) || 20;
const INDEX = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
const SCENE_FILE = path.join(os.tmpdir(), 'f355ch1-scene.json');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function line(o) { process.stdout.write('PROOF_LINE ' + JSON.stringify(o) + '\n'); }

const MEASURE = `(function(){
  function vis(id){var e=document.getElementById(id);if(!e)return false;
    return (e.offsetWidth>0||e.offsetHeight>0);}
  var diag=(window.__DIAG||[]).map(function(d){return d.ev;});
  return {splashVisible:vis('authSplash'),loginVisible:vis('login'),appVisible:vis('app'),
    authed:document.body.classList.contains('authed'),
    loginRendered:diag.indexOf('auth.startup.login_rendered')>=0,
    restored:diag.indexOf('auth.startup.restore_succeeded')>=0};
})()`;

app.commandLine.appendSwitch('no-sandbox');
app.disableHardwareAcceleration();
const wd = setTimeout(() => { console.error('PROOF WATCHDOG'); app.exit(2); }, 300000);
app.whenReady().then(async () => {
  fs.writeFileSync(SCENE_FILE, JSON.stringify({ scenario: 'ok', tries: '0' }));
  const win = new BrowserWindow({
    width: 1100, height: 760, show: false,
    webPreferences: { preload: path.join(__dirname, 'f355ch1-proof-preload.js'),
      contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  let failures = 0;
  for (let c = 1; c <= CYCLES; c++) {
    try {
      await win.loadFile(INDEX);            // boot frio do documento (ciclo abrir)
      await sleep(1300);
      const m = await win.webContents.executeJavaScript(MEASURE, true);
      const ok = m.authed && m.appVisible && m.restored && !m.loginVisible &&
        !m.loginRendered && !m.splashVisible;
      if (!ok) failures++;
      line({ cycle: c, ok, authed: m.authed, appVisible: m.appVisible, restored: m.restored,
        loginVisible: m.loginVisible, loginRendered: m.loginRendered, splashVisible: m.splashVisible });
      await win.webContents.executeJavaScript('void 0', true).catch(() => {});
    } catch (e) { failures++; line({ cycle: c, ok: false, why: 'EXC:' + e.message }); }
  }
  clearTimeout(wd);
  try { win.destroy(); } catch (_) {}
  process.stdout.write('PROOF_DONE cycles=' + CYCLES + ' failures=' + failures + '\n');
  app.exit(failures === 0 ? 0 : 1);
});
