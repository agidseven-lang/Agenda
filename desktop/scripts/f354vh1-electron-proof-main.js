/* F3.5.4V-H1 — MAIN de prova (Electron REAL 31.3.1). Para cada CENÁRIO reescreve o arquivo de
 * cenário e RECARREGA o index.html REAL (mesmos bytes do pacote) numa janela — cada carga é um
 * "boot frio" independente (como o autostart do Windows). Deixa a MÁQUINA DE ESTADOS real rodar
 * e mede o DOM REAL (#authSplash/#login/#app + body.authed), os eventos auth.startup.*
 * (window.__DIAG), o estado da "sessão local" (localStorage.wp_uid) e captura PNG REAL
 * (win.capturePage()). Sem file:///setContent/IA/mockup — é o renderer de produção de verdade. */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = process.env.PROOF_OUT || path.join(__dirname, 'out');
const SCALE = process.env.PROOF_SCALE || '1x';
const SCENES = (process.env.PROOF_SCENES || 'ok').split(',').map(s => s.trim()).filter(Boolean);
const INDEX = path.join(__dirname, 'src', 'renderer', 'index.html');
const SCENE_FILE = path.join(os.tmpdir(), 'f354vh1-scene.json');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function line(o) { process.stdout.write('PROOF_LINE ' + JSON.stringify(o) + '\n'); }
function setScene(scenario, tries) { fs.writeFileSync(SCENE_FILE, JSON.stringify({ scenario: scenario, tries: String(tries) })); }

const MEASURE = `(function(){
  function box(id){var e=document.getElementById(id);if(!e)return{present:false,visible:false,hidden:true};
    var cs=getComputedStyle(e);return{present:true,hidden:e.classList.contains('hidden'),
      display:cs.display,visible:(e.offsetWidth>0||e.offsetHeight>0)};}
  var diag=(window.__DIAG||[]).map(function(d){return{ev:d.ev,reason:(d.p&&d.p.resultReason)||'',mode:(d.p&&d.p.manualOrAutostart)||''};});
  var wp=null;try{wp=localStorage.getItem('wp_uid');}catch(_){}
  return {authSplash:box('authSplash'),login:box('login'),app:box('app'),hint:box('authSplashHint'),
    manualLoginPresent:!!document.getElementById('authManualLogin'),
    authed:document.body.classList.contains('authed'),wpUid:wp,calls:window.__CALLS||{},diag:diag,
    loginRendered:diag.some(function(d){return d.ev==='auth.startup.login_rendered';}),
    events:diag.map(function(d){return d.ev;})};
})()`;

async function capture(win, tag) {
  try { const img = await win.capturePage(); const p = path.join(OUT, 'f354vh1-' + SCALE + '-' + tag + '.png');
    fs.writeFileSync(p, img.toPNG()); return path.basename(p); } catch (e) { return 'ERR:' + e.message; }
}
function settleMs(scene) {
  if (scene === 'net_persistent') return 10500;   // ver _tries===3 (t≈9s) + folga
  if (scene === 'net_then_ok') return 4800;       // 1 retry (3s) + sucesso + folga
  if (scene === 'net_throw') return 4200;         // 1 ciclo de catch/backoff
  return 1300;
}

async function runScene(win, scene, idx) {
  const autostart = scene === 'ok_autostart';
  const qScene = autostart ? 'ok' : scene;
  const tries = scene === 'net_then_ok' ? 1 : 0;
  const tag = String(idx).padStart(2, '0') + '-' + scene;
  try {
    setScene(qScene, tries);
    if (autostart) { try { win.hide(); } catch (_) {} } else { try { win.showInactive(); } catch (_) {} }
    await win.loadFile(INDEX);              // recarrega o renderer real (preload lê o cenário do arquivo)
    await sleep(settleMs(scene));
    const winVisible = win.isVisible();     // prova REAL do estado da janela (autostart ⇒ oculta)
    let m = await win.webContents.executeJavaScript(MEASURE);
    m.winVisible = winVisible;
    const shot = await capture(win, tag);
    let escape = null;
    if (scene === 'net_persistent') {
      await win.webContents.executeJavaScript(`(function(){var b=document.getElementById('authManualLogin');if(b){b.click();return true;}return false;})()`);
      await sleep(700);
      escape = await win.webContents.executeJavaScript(MEASURE);
      await capture(win, tag + '-escape');
    }
    if (scene === 'logout') {
      await win.webContents.executeJavaScript(`(function(){try{if(typeof logout==='function'){logout();return true;}}catch(_){}return false;})()`);
      await sleep(900);
      m = await win.webContents.executeJavaScript(MEASURE);
      await capture(win, tag + '-after');
    }
    const verdict = assess(scene, m, escape);
    line({ scene: scene, scale: SCALE, ok: verdict.ok, why: verdict.why, shot: shot,
      splashVisible: m.authSplash.visible, loginVisible: m.login.visible, appVisible: m.app.visible,
      authed: m.authed, wpUid: m.wpUid, loginRendered: m.loginRendered, hintVisible: m.hint.visible,
      events: m.events, calls: m.calls,
      escape: escape ? { loginVisible: escape.login.visible, wpUid: escape.wpUid, loginRendered: escape.loginRendered,
        reason: (escape.diag.find(d => d.ev === 'auth.startup.login_rendered') || {}).reason } : undefined });
    return verdict.ok;
  } catch (e) { line({ scene: scene, scale: SCALE, ok: false, why: 'EXC:' + e.message }); return false; }
}

function has(m, ev) { return m.events.indexOf(ev) >= 0; }
function reasonOf(m) { const d = m.diag.find(x => x.ev === 'auth.startup.login_rendered'); return d ? d.reason : ''; }

function assess(scene, m, escape) {
  const F = (c, why) => ({ ok: !!c, why: c ? 'ok' : why });
  if (scene === 'ok' || scene === 'ok_autostart') {
    /* autostart: prova REAL de janela oculta (win.isVisible()===false, como o --hidden do Windows);
       o boot autentica de qualquer modo por ter UM único caminho (independe de visibilidade). */
    const hiddenOk = scene !== 'ok_autostart' || m.winVisible === false;
    return F(m.authSplash.hidden && !m.login.visible && m.app.visible && m.authed &&
      has(m, 'auth.startup.restore_succeeded') && !m.loginRendered && m.wpUid === 'u-real-1' && (m.calls.authLogout || 0) === 0 && hiddenOk,
      'esperado: splash oculto, app+authed, SEM login_rendered, sessão preservada' + (scene === 'ok_autostart' ? ', janela OCULTA (autostart)' : ''));
  }
  if (scene === 'net_then_ok') {
    return F(m.authSplash.hidden && m.app.visible && m.authed && has(m, 'auth.startup.offline_cached') &&
      has(m, 'auth.startup.restore_succeeded') && !m.loginRendered && m.wpUid === 'u-real-1',
      'esperado: offline_cached→restore_succeeded, autentica SEM flash de login, sessão preservada');
  }
  if (scene === 'net_throw') {
    return F(m.authSplash.visible && !m.login.visible && !m.authed && !m.loginRendered && m.wpUid === 'u-real-1',
      'esperado: authSelf lança → splash PERMANECE, nunca login, sessão preservada');
  }
  if (scene === 'net_persistent') {
    const before = m.authSplash.visible && !m.login.visible && !m.authed && !m.loginRendered &&
      m.events.filter(e => e === 'auth.startup.offline_cached').length >= 3 && m.hint.visible && m.manualLoginPresent && m.wpUid === 'u-real-1';
    const esc = escape && escape.login.visible && escape.authSplash.hidden && escape.loginRendered &&
      reasonOf(escape) === 'manual_escape' && escape.wpUid === 'u-real-1';
    return F(before && esc, 'esperado: splash+aviso persistem (≥3 offline_cached, sem login); escape manual revela login SEM apagar sessão');
  }
  if (scene === 'no_session') {
    return F(m.login.visible && m.authSplash.hidden && !m.app.visible && !m.authed &&
      has(m, 'auth.startup.restore_empty') && m.loginRendered && reasonOf(m) === 'no_session' && m.wpUid === null,
      'esperado: negativa real → login visível, restore_empty+login_rendered(no_session), sessão LIMPA');
  }
  if (scene === 'expired') {
    return F(m.login.visible && m.authSplash.hidden && !m.authed &&
      has(m, 'auth.startup.revoked') && m.loginRendered && reasonOf(m) === 'revoked' && m.wpUid === null,
      'esperado: revogação → login visível, revoked+login_rendered(revoked), sessão LIMPA');
  }
  if (scene === 'logout') {
    return F(m.login.visible && !m.app.visible && !m.authed &&
      has(m, 'auth.startup.explicit_logout') && (m.calls.authLogout || 0) === 1 && m.wpUid === null,
      'esperado: logout explícito → login visível, explicit_logout, authLogout chamado, sessão LIMPA');
  }
  return F(false, 'cenário desconhecido: ' + scene);
}

app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  setScene('ok', 0);
  const win = new BrowserWindow({
    width: 1100, height: 760, show: false,
    webPreferences: { preload: path.join(__dirname, 'proof-preload.js'),
      contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false }
  });
  let scenes = 0, failures = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const okc = await runScene(win, SCENES[i], i + 1);
    scenes++; if (!okc) failures++;
  }
  try { win.destroy(); } catch (_) {}
  process.stdout.write('PROOF_DONE scale=' + SCALE + ' scenes=' + scenes + ' failures=' + failures + '\n');
  app.exit(failures === 0 ? 0 : 1);
});
