/* F3.5.5C-H1 — PRELOAD de prova (cenário-dirigido; clone do padrão F3.5.4V-H1 aprovado).
 * O renderer REAL roda sem alteração; este preload só decide o que desktopAPI.authSelf()
 * responde por cenário, grava auth.startup.* em window.__DIAG e conta chamadas.
 * Cenários NOVOS da fase:
 *   no_bridge_race : desktopAPI SEM authSelf nos 1os 2s (corrida do preload no autostart);
 *                    o boot deve ESPERAR no splash (nunca login) e restaurar quando a ponte chegar.
 *   fb_guard       : NÃO injeta o stub do firebase (página com gstatic inalcançável) — prova o
 *                    bloco-guarda offline (mensagem + tentativa de reload), medida pelo runner.
 *   net_persistent : além do escape manual, o hint agora tem "Tentar novamente" (authRetryNow)
 *                    que dispara uma tentativa IMEDIATA (sem esperar o backoff). */
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

let SCEN = 'ok', TRIES = 0;
try {
  const _p = require('path').join(require('os').tmpdir(), 'f355ch1-scene.json');
  const _j = JSON.parse(require('fs').readFileSync(_p, 'utf8'));
  SCEN = _j.scenario || 'ok'; TRIES = parseInt(_j.tries || '0', 10) || 0;
} catch (_) {}

/* ---- firebase stub (fronteira de rede do Firestore; IGUAL ao harness vh1) ---- */
function docStub() {
  return { onSnapshot: () => (() => {}), get: () => Promise.resolve({ exists: false, data: () => ({}) }),
    set: () => Promise.resolve(), update: () => Promise.resolve(), delete: () => Promise.resolve() };
}
function collStub() {
  const c = { onSnapshot: () => (() => {}), doc: () => docStub(),
    get: () => Promise.resolve({ docs: [], forEach: () => {} }), add: () => Promise.resolve({ id: 'x' }) };
  c.where = function () { return c; }; c.orderBy = function () { return c; }; c.limit = function () { return c; };
  return c;
}
const fsdb = { collection: collStub, doc: () => docStub(),
  runTransaction: () => Promise.resolve(), batch: () => ({ set: noop, update: noop, delete: noop, commit: () => Promise.resolve() }),
  enablePersistence: () => Promise.resolve(), settings: noop };
const FieldValue = { arrayUnion: function () { return { __au: [].slice.call(arguments) }; }, arrayRemove: function () { return {}; },
  delete: function () { return { __del: true }; }, serverTimestamp: function () { return { __ts: true }; }, increment: function (n) { return { __inc: n }; } };
const firestoreFn = function () { return fsdb; };
firestoreFn.FieldValue = FieldValue;
firestoreFn.Timestamp = { now: () => ({ toMillis: () => Date.now() }), fromMillis: (m) => ({ toMillis: () => m }) };

const SELF = { id: 'u-real-1', name: 'Fulano de Tal', role: 'designer', team: 'ADM', email: 'x' };
let _authCalls = 0;
window.__DIAG = [];
window.__CALLS = { authSelf: 0, authLogout: 0 };
window.__SCEN = SCEN;

function authSelf() {
  _authCalls++; window.__CALLS.authSelf = _authCalls;
  if (SCEN === 'no_session') return Promise.resolve({ ok: false, error: 'no_session' });
  if (SCEN === 'expired') return Promise.resolve({ ok: false, error: 'expired' });
  if (SCEN === 'net_persistent') return Promise.resolve({ ok: false, error: 'network' });
  if (SCEN === 'net_throw') return Promise.reject(new Error('net down'));
  if (SCEN === 'net_then_ok') {
    if (_authCalls <= TRIES) return Promise.resolve({ ok: false, error: 'network' });
    return Promise.resolve({ ok: true, self: SELF });
  }
  return Promise.resolve({ ok: true, self: SELF }); // ok / ok_autostart / logout / no_bridge_race (pós-ponte)
}
function diagLog(ev, payload) { try { window.__DIAG.push({ ev: ev, p: payload || {} }); } catch (_) {} }

try {
  if (SCEN !== 'fb_guard') {
    window.firebase = { initializeApp: () => ({}), firestore: firestoreFn,
      auth: () => ({ onAuthStateChanged: () => (() => {}), signInWithCustomToken: () => Promise.resolve(), signOut: () => Promise.resolve(), currentUser: null }) };
  }
  try { localStorage.setItem('wp_uid', 'u-real-1'); localStorage.setItem('wp_name', 'Fulano de Tal'); } catch (_) {}
  const base = {
    diagLog: diagLog,
    version: '1.0.221',
    authLogout: function () { window.__CALLS.authLogout++; return Promise.resolve({ ok: true }); },
    sessionLogin: noop, sessionLogout: noop,
  };
  if (SCEN === 'no_bridge_race') {
    /* ponte SEM authSelf: objeto plano (sem Proxy) p/ que `typeof api.authSelf==='function'`
       seja realmente false até a ponte "chegar" (2s) — como no autostart real. */
    window.desktopAPI = Object.assign({}, base);
    window.api = window.desktopAPI;
    setTimeout(function () { try { window.desktopAPI.authSelf = authSelf; } catch (_) {} }, 2000);
  } else {
    const full = Object.assign({ authSelf: authSelf }, base);
    window.desktopAPI = new Proxy(full, { get: (t, k) => (k in t ? t[k] : fnProxy()) });
    window.api = window.desktopAPI;
  }
  window.__APP_VERSION = '1.0.221';
} catch (_) {}
