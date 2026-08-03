/* F3.5.4V-H1 — PRELOAD de prova (offline, cenário-dirigido).
 * O renderer REAL (index.html) carrega o firebase do CDN gstatic; num ambiente sem rede isso
 * falharia e o script inline abortaria em firebase.initializeApp. Este preload injeta um STUB
 * mínimo de `firebase` ANTES do script da página (idêntico ao harness F3.5.4V) e substitui a
 * FRONTEIRA de rede/IPC (window.desktopAPI) por um duplo controlado pelo CENÁRIO lido de
 * location.search — de modo que TODO o código real do renderer (splash + máquina de estados +
 * boot + startApp + logout) executa SEM alteração. NÃO altera nenhuma lógica de produto:
 * só decide o que desktopAPI.authSelf() responde (ok / no_session / expired / erro de rede),
 * grava os eventos auth.startup.* (diagLog) em window.__DIAG e registra chamadas sensíveis
 * (authLogout/clearSession-via-localStorage) para verificação. */
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

/* ---- firebase stub (mesmo do F3.5.4V; só a fronteira de rede do Firestore) ---- */
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

/* ---- cenário lido de um arquivo temporário (o main o reescreve antes de cada reload) ----
   Evita query-string em caminho .asar (que falha em recargas) e é lido pelo contexto Node do
   preload (sandbox:false), fresco a cada carregamento de página. ---- */
let SCEN = 'ok', TRIES = 0;
try {
  const _p = require('path').join(require('os').tmpdir(), 'f354vh1-scene.json');
  const _j = JSON.parse(require('fs').readFileSync(_p, 'utf8'));
  SCEN = _j.scenario || 'ok'; TRIES = parseInt(_j.tries || '0', 10) || 0;
} catch (_) {}
const SELF = { id: 'u-real-1', name: 'Fulano de Tal', role: 'designer', team: 'ADM', email: 'x' };

let _authCalls = 0;
window.__DIAG = [];
window.__CALLS = { authSelf: 0, authLogout: 0, sessionLogin: 0, sessionLogout: 0 };
window.__SCEN = SCEN;

/* authSelf() — a fronteira que reproduz cada cenário do autostart do Windows.
 *  ok / ok_autostart : sessão válida confirmada pelo servidor.
 *  no_session        : negativa REAL (sem sessão) → deve revelar login.
 *  expired           : sessão revogada → deve revelar login.
 *  net_persistent    : erro de rede sempre (autostart com rede fria) → splash永久, nunca login.
 *  net_then_ok       : erro de rede nas 1as TRIES chamadas, depois ok → autentica sem flash de login.
 *  logout            : autentica (ok) e depois o teste chama logout().
 *  offline_escape    : igual net_persistent; o teste clica "Entrar manualmente". */
function authSelf() {
  _authCalls++; window.__CALLS.authSelf = _authCalls;
  if (SCEN === 'no_session') return Promise.resolve({ ok: false, error: 'no_session' });
  if (SCEN === 'expired') return Promise.resolve({ ok: false, error: 'expired' });
  /* Contrato REAL do auth-core.self(): em rede fria RESOLVE {ok:false,error:"network"} (NUNCA
     rejeita, NUNCA apaga a sessão). É esse ramo que mantém o splash e reintenta. */
  if (SCEN === 'net_persistent' || SCEN === 'offline_escape') return Promise.resolve({ ok: false, error: 'network' });
  /* net_throw: prova defensiva — mesmo se authSelf LANÇAR, o catch do boot mantém o splash e
     reintenta (jamais login). */
  if (SCEN === 'net_throw') return Promise.reject(new Error('net down'));
  if (SCEN === 'net_then_ok') {
    if (_authCalls <= TRIES) return Promise.resolve({ ok: false, error: 'network' });
    return Promise.resolve({ ok: true, self: SELF });
  }
  /* ok / ok_autostart / logout */
  return Promise.resolve({ ok: true, self: SELF });
}

function diagLog(ev, payload) { try { window.__DIAG.push({ ev: ev, p: payload || {} }); } catch (_) {} }

try {
  window.firebase = { initializeApp: () => ({}), firestore: firestoreFn,
    auth: () => ({ onAuthStateChanged: () => (() => {}), signInWithCustomToken: () => Promise.resolve(), signOut: () => Promise.resolve(), currentUser: null }) };
  /* Semente de "sessão local" no localStorage do renderer (wp_uid/wp_name): permite provar que
     clearSession() SÓ roda em negativa real (no_session/expired) e NUNCA em erro de rede. */
  try { localStorage.setItem('wp_uid', 'u-real-1'); localStorage.setItem('wp_name', 'Fulano de Tal'); } catch (_) {}
  const desktopAPI = {
    authSelf: authSelf,
    diagLog: diagLog,
    authLogout: function () { window.__CALLS.authLogout++; return Promise.resolve({ ok: true }); },
    sessionLogin: function () { window.__CALLS.sessionLogin++; },
    sessionLogout: function () { window.__CALLS.sessionLogout++; },
  };
  window.desktopAPI = new Proxy(desktopAPI, { get: (t, k) => (k in t ? t[k] : fnProxy()) });
  window.api = window.desktopAPI;   // alguns caminhos legados usam `api`
  window.__APP_VERSION = '1.0.213';
} catch (_) {}
