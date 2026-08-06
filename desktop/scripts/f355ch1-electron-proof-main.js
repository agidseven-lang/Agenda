/* F3.5.5C-H1 — MAIN de prova (Electron REAL). Cada cenário = boot frio do renderer REAL
 * (mesmos bytes de src/renderer/index.html), medindo o DOM real (#authSplash/#login/#app),
 * os eventos auth.startup.* e capturando PNG. Padrão idêntico ao harness F3.5.4V-H1 aprovado,
 * com os cenários NOVOS do hotfix: retry-now, corrida do preload (no_bridge_race) e o
 * bloco-guarda do firebase offline (fb_guard, via cópia staged com gstatic inalcançável). */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = process.env.PROOF_OUT || path.join(__dirname, '..', '..', 'docs', 'f355ch1-qa');
const SHOTS = process.env.PROOF_SHOTS !== '0';
const SCENES = (process.env.PROOF_SCENES ||
  'ok,ok_autostart,net_then_ok,net_throw,net_persistent,no_session,expired,logout,no_bridge_race,fb_guard')
  .split(',').map(s => s.trim()).filter(Boolean);
const INDEX = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
const SCENE_FILE = path.join(os.tmpdir(), 'f355ch1-scene.json');
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function line(o) { process.stdout.write('PROOF_LINE ' + JSON.stringify(o) + '\n'); }
function setScene(scenario, tries) { fs.writeFileSync(SCENE_FILE, JSON.stringify({ scenario, tries: String(tries) })); }

/* fb_guard: cópia staged do index REAL com os <script src> do gstatic apontando p/ porta morta
   (127.0.0.1:9) — reproduz o autostart OFFLINE sem cache: firebase fica undefined, o script
   principal morre, e o BLOCO-GUARDA (script separado) deve assumir o splash e tentar reload. */
const STAGED = path.join(os.tmpdir(), 'f355ch1-fbguard', 'index.html');
function stageFbGuard() {
  const html = fs.readFileSync(INDEX, 'utf8')
    .replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+/g, 'http://127.0.0.1:9/absent.js');
  fs.mkdirSync(path.dirname(STAGED), { recursive: true });
  fs.writeFileSync(STAGED, html);
}

const MEASURE = `(function(){
  function box(id){var e=document.getElementById(id);if(!e)return{present:false,visible:false,hidden:true};
    var cs=getComputedStyle(e);return{present:true,hidden:e.classList.contains('hidden'),
      display:cs.display,visible:(e.offsetWidth>0||e.offsetHeight>0)};}
  var diag=(window.__DIAG||[]).map(function(d){return{ev:d.ev,reason:(d.p&&d.p.resultReason)||''};});
  var wp=null;try{wp=localStorage.getItem('wp_uid');}catch(_){}
  var msg='';try{msg=(document.getElementById('authSplashMsg')||{}).textContent||'';}catch(_){}
  var hintTxt='';try{hintTxt=(document.getElementById('authSplashHint')||{}).textContent||'';}catch(_){}
  return {authSplash:box('authSplash'),login:box('login'),app:box('app'),hint:box('authSplashHint'),
    manualLoginPresent:!!document.getElementById('authManualLogin'),
    retryNowPresent:!!document.getElementById('authRetryNow'),
    splashMsg:msg,hintTxt:hintTxt,title:document.title,
    authed:document.body.classList.contains('authed'),wpUid:wp,calls:window.__CALLS||{},diag:diag,
    loginRendered:diag.some(function(d){return d.ev==='auth.startup.login_rendered';}),
    events:diag.map(function(d){return d.ev;})};
})()`;

async function capture(win, tag) {
  if (!SHOTS) return 'skipped';
  try { const img = await win.capturePage(); const p = path.join(OUT, 'f355ch1-' + tag + '.png');
    fs.writeFileSync(p, img.toPNG()); return path.basename(p); } catch (e) { return 'ERR:' + e.message; }
}
function settleMs(scene) {
  if (scene === 'net_persistent') return 10500;   // 3 offline_cached (t≈0/3/9s) + hint + folga
  if (scene === 'net_then_ok') return 4800;
  if (scene === 'net_throw') return 4200;
  if (scene === 'no_bridge_race') return 1500;    // 1ª medição AINDA sem ponte (prova: sem login)
  if (scene === 'fb_guard') return 2500;
  return 1300;
}
function has(m, ev) { return m.events.indexOf(ev) >= 0; }
function reasonOf(m) { const d = m.diag.find(x => x.ev === 'auth.startup.login_rendered'); return d ? d.reason : ''; }

async function runScene(win, scene, idx) {
  const autostart = scene === 'ok_autostart';
  const qScene = autostart ? 'ok' : scene;
  const tag = String(idx).padStart(2, '0') + '-' + scene;
  try {
    setScene(scene === 'net_then_ok' ? 'net_then_ok' : qScene, scene === 'net_then_ok' ? 1 : 0);
    if (autostart) { try { win.hide(); } catch (_) {} } else { try { win.showInactive(); } catch (_) {} }

    if (scene === 'fb_guard') {
      stageFbGuard();
      let navAttempt = false;
      const onNav = () => { navAttempt = true; };
      win.webContents.on('will-navigate', onNav);
      await win.loadFile(STAGED);
      await sleep(settleMs(scene));
      const m = await win.webContents.executeJavaScript(MEASURE).catch(() => null);
      /* o guarda agenda location.reload() (com backoff 4s) e no evento 'online' — capturar a
         TENTATIVA de navegação como prova e encerrar o cenário. */
      await sleep(2600);
      win.webContents.removeListener('will-navigate', onNav);
      const shot = await capture(win, tag);
      const okv = !!(m && m.authSplash.visible && !m.login.visible &&
        /Aguardando conexão/.test(m.splashMsg) && /sessão está preservada/i.test(m.hintTxt));
      line({ scene, ok: okv && navAttempt, shot,
        why: okv ? (navAttempt ? 'ok' : 'sem tentativa de reload') : 'guarda não assumiu o splash',
        splashMsg: m && m.splashMsg, hintTxt: m && m.hintTxt, navAttempt });
      return okv && navAttempt;
    }

    await win.loadFile(INDEX);
    await sleep(settleMs(scene));
    let m = await win.webContents.executeJavaScript(MEASURE);
    m.winVisible = win.isVisible();
    const shot = await capture(win, tag);

    let extra = null;
    if (scene === 'no_bridge_race') {
      /* 1ª medição (t≈1.5s): ponte ainda AUSENTE ⇒ splash, sem login, sem no_bridge.
         2ª medição (t≈5s): ponte chegou (2s) + poll de 300ms ⇒ autenticado. */
      const early = m;
      await sleep(3500);
      m = await win.webContents.executeJavaScript(MEASURE);
      m.winVisible = win.isVisible();
      await capture(win, tag + '-after');
      const okv = early.authSplash.visible && !early.login.visible && !early.loginRendered &&
        m.app.visible && m.authed && !m.loginRendered && has(m, 'auth.startup.restore_succeeded');
      line({ scene, ok: okv, shot, why: okv ? 'ok' : 'esperado: splash sem login durante a corrida; autentica quando a ponte chega',
        early: { splash: early.authSplash.visible, login: early.login.visible }, late: { app: m.app.visible, authed: m.authed }, events: m.events });
      return okv;
    }
    if (scene === 'net_persistent') {
      /* prova do RETRY-NOW: com o hint visível, clicar "Tentar novamente" dispara tentativa
         IMEDIATA (sem esperar o backoff de ~12s). */
      const callsBefore = (m.calls && m.calls.authSelf) || 0;
      await win.webContents.executeJavaScript(`(function(){var b=document.getElementById('authRetryNow');if(b){b.click();return true;}return false;})()`);
      await sleep(900);
      const mid = await win.webContents.executeJavaScript(MEASURE);
      const retryOk = ((mid.calls && mid.calls.authSelf) || 0) >= callsBefore + 1;
      await win.webContents.executeJavaScript(`(function(){var b=document.getElementById('authManualLogin');if(b){b.click();return true;}return false;})()`);
      await sleep(700);
      extra = await win.webContents.executeJavaScript(MEASURE);
      await capture(win, tag + '-escape');
      const before = m.authSplash.visible && !m.login.visible && !m.authed && !m.loginRendered &&
        m.events.filter(e => e === 'auth.startup.offline_cached').length >= 3 &&
        m.hint.visible && m.manualLoginPresent && m.retryNowPresent && m.wpUid === 'u-real-1';
      const esc = extra && extra.login.visible && extra.authSplash.hidden && reasonOf(extra) === 'manual_escape' && extra.wpUid === 'u-real-1';
      const okv = before && retryOk && esc;
      line({ scene, ok: okv, shot, why: okv ? 'ok' : 'esperado: splash+hint c/ Tentar novamente (dispara já) e Entrar manualmente; sessão preservada',
        callsBefore, callsAfterRetry: mid.calls && mid.calls.authSelf, retryNowPresent: m.retryNowPresent, escapeLogin: extra && extra.login.visible });
      return okv;
    }
    if (scene === 'logout') {
      await win.webContents.executeJavaScript(`(function(){try{if(typeof logout==='function'){logout();return true;}}catch(_){}return false;})()`);
      await sleep(900);
      m = await win.webContents.executeJavaScript(MEASURE);
      await capture(win, tag + '-after');
    }

    const F = (c, why) => ({ ok: !!c, why: c ? 'ok' : why });
    let v;
    if (scene === 'ok' || scene === 'ok_autostart') {
      const hiddenOk = scene !== 'ok_autostart' || m.winVisible === false;
      v = F(m.authSplash.hidden && !m.login.visible && m.app.visible && m.authed &&
        has(m, 'auth.startup.restore_succeeded') && !m.loginRendered && m.wpUid === 'u-real-1' &&
        m.title.indexOf('1.0.222') >= 0 && hiddenOk,
        'esperado: app autenticado sem login, título 1.0.222' + (autostart ? ', janela oculta' : ''));
    } else if (scene === 'net_then_ok') {
      v = F(m.authSplash.hidden && m.app.visible && m.authed && has(m, 'auth.startup.offline_cached') &&
        has(m, 'auth.startup.restore_succeeded') && !m.loginRendered && m.wpUid === 'u-real-1',
        'esperado: offline_cached→restore_succeeded sem flash de login');
    } else if (scene === 'net_throw') {
      v = F(m.authSplash.visible && !m.login.visible && !m.authed && !m.loginRendered && m.wpUid === 'u-real-1',
        'esperado: exceção mantém splash, nunca login, sessão preservada');
    } else if (scene === 'no_session') {
      v = F(m.login.visible && m.authSplash.hidden && !m.app.visible && has(m, 'auth.startup.restore_empty') &&
        reasonOf(m) === 'no_session' && m.wpUid === null,
        'esperado: negativa real → login (restore_empty), sessão limpa');
    } else if (scene === 'expired') {
      v = F(m.login.visible && m.authSplash.hidden && has(m, 'auth.startup.revoked') &&
        reasonOf(m) === 'revoked' && m.wpUid === null,
        'esperado: revogação CONFIRMADA no main → login legítimo, sessão limpa');
    } else if (scene === 'logout') {
      v = F(m.login.visible && !m.app.visible && !m.authed && has(m, 'auth.startup.explicit_logout') &&
        (m.calls.authLogout || 0) === 1 && m.wpUid === null,
        'esperado: logout explícito → login, authLogout=1, sessão limpa');
    } else v = F(false, 'cenário desconhecido');

    line({ scene, ok: v.ok, why: v.why, shot, splash: m.authSplash.visible, login: m.login.visible,
      appVisible: m.app.visible, authed: m.authed, wpUid: m.wpUid, events: m.events, title: m.title });
    return v.ok;
  } catch (e) { line({ scene, ok: false, why: 'EXC:' + e.message }); return false; }
}

app.commandLine.appendSwitch('no-sandbox');
app.disableHardwareAcceleration();
const wd = setTimeout(() => { console.error('PROOF WATCHDOG'); app.exit(2); }, 480000);
app.whenReady().then(async () => {
  setScene('ok', 0);
  const win = new BrowserWindow({
    width: 1100, height: 760, show: false,
    webPreferences: { preload: path.join(__dirname, 'f355ch1-proof-preload.js'),
      contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  let scenes = 0, failures = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const okc = await runScene(win, SCENES[i], i + 1);
    scenes++; if (!okc) failures++;
  }
  clearTimeout(wd);
  try { win.destroy(); } catch (_) {}
  process.stdout.write('PROOF_DONE scenes=' + scenes + ' failures=' + failures + '\n');
  app.exit(failures === 0 ? 0 : 1);
});
