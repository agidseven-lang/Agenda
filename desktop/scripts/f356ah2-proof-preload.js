/* F3.5.6A — PRELOAD de prova (offline, dirigido por SEMENTE; MESMO padrão aprovado da
 * F3.5.5A-H1/W-H1). Novidades desta fase:
 *   • RE-EMISSÃO AO VIVO: collection('tasks').onSnapshot registra o callback e
 *     window.__emitTasks(tasksArr) re-emite um snapshot NOVO (simula as escritas do Worker
 *     V64.61 — rodadas/ledger/fase — chegando em tempo real ao renderer de produção).
 *   • window.__CLIP captura clipboardWriteText (prova do COPIAR LEMBRETE sem envio).
 *   • fetch para .../team-action é interceptado: registra {url,{headers,body}} em
 *     window.__TEAM_POSTS e resolve {ok:true,...} — prova que CONFIRMAR ENVIO e o REGISTRO
 *     de decisão externa convergem no endpoint do servidor (renderer NUNCA grava sentAt).
 *   • wp_team_jwt sintético com exp futura (ensureTeamSession passa sem rede).
 *   • update(patch) segue registrando em window.__PATCHES (nunca aplica; otimismo é do
 *     código REAL). desktopAPI.version='1.0.229'. */
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

let SEED = { self: null, users: [], tasks: [], events: [] };
try {
  const _p = require('path').join(require('os').tmpdir(), 'f356ah2-seed.json');
  SEED = JSON.parse(require('fs').readFileSync(_p, 'utf8')) || SEED;
} catch (_) {}
const SELF = SEED.self || { id: 'u-self', name: 'Admin', role: 'Administrador', admin: true };
const SEED_DOCS = { usersPublic: SEED.users || [], tasks: SEED.tasks || [], events: SEED.events || [] };

function makeSnap(arr) {
  const docs = (arr || []).map(function (o) {
    const data = Object.assign({}, o); delete data.id;
    return { id: o.id, exists: true, data: function () { return data; }, get: function (k) { return data[k]; } };
  });
  return { docs: docs, size: docs.length, empty: docs.length === 0, forEach: function (f) { docs.forEach(f); } };
}
const LIVE = { tasks: [] };
function docStub(coll, id) {
  return { onSnapshot: function () { return noop; },
    get: function () { return Promise.resolve({ exists: false, data: function () { return {}; } }); },
    set: function () { return Promise.resolve(); },
    update: function (patch) {
      try { window.__PATCHES.push({ coll: coll, id: id, patch: patch }); } catch (_) {}
      if (window.__DB_FAIL) { const e = new Error('unavailable'); e.code = 'unavailable'; return Promise.reject(e); }
      return Promise.resolve();
    },
    delete: function () { return Promise.resolve(); } };
}
function collStub(name) {
  const known = (name === 'usersPublic' || name === 'tasks' || name === 'events');
  const docs = SEED_DOCS[name] || [];
  const c = {
    onSnapshot: function (cb) {
      if (known && typeof cb === 'function') {
        try { cb(makeSnap(docs)); } catch (_) {}
        if (name === 'tasks') LIVE.tasks.push(cb);
      }
      return noop;
    },
    doc: function (id) { return docStub(name, id); },
    get: function () { return Promise.resolve(makeSnap(known ? docs : [])); },
    add: function () { return Promise.resolve({ id: 'x' + Date.now() }); }
  };
  c.where = function () { return c; }; c.orderBy = function () { return c; }; c.limit = function () { return c; };
  return c;
}
const fsdb = { collection: function (name) { return collStub(name); }, doc: function () { return docStub('root', 'x'); },
  runTransaction: function () { return Promise.resolve(); },
  batch: function () { return { set: noop, update: noop, delete: noop, commit: function () { return Promise.resolve(); } }; },
  enablePersistence: function () { return Promise.resolve(); }, settings: noop };
const FieldValue = { arrayUnion: function () { return { __au: [].slice.call(arguments) }; }, arrayRemove: function () { return {}; },
  delete: function () { return { __del: true }; }, serverTimestamp: function () { return { __ts: true }; }, increment: function (n) { return { __inc: n }; } };
const firestoreFn = function () { return fsdb; };
firestoreFn.FieldValue = FieldValue;
firestoreFn.Timestamp = { now: function () { return { toMillis: function () { return Date.now(); } }; }, fromMillis: function (m) { return { toMillis: function () { return m; } }; } };

window.__DIAG = [];
window.__PATCHES = [];
window.__CLIP = [];
window.__TEAM_POSTS = [];
window.__DB_FAIL = false;
window.__emitTasks = function (tasks) { try { const s = makeSnap(tasks || []); LIVE.tasks.forEach(function (cb) { try { cb(s); } catch (_) {} }); return LIVE.tasks.length; } catch (_) { return -1; } };
function authSelf() { return Promise.resolve({ ok: true, self: Object.assign({}, SELF) }); }
function diagLog(ev, payload) { try { window.__DIAG.push({ ev: ev, p: payload || {} }); } catch (_) {} }

/* fetch interceptado (offline): team-action registrado e respondido; resto rejeita. */
(function () {
  const b64 = function (o) { return btoa(JSON.stringify(o)).replace(/=+$/, ''); };
  try { localStorage.setItem('wp_team_jwt', b64({ alg: 'HS256' }) + '.' + b64({ uid: SELF.id, exp: Math.floor(Date.now() / 1000) + 86400, aud: 'idseven-team' }) + '.sig'); } catch (_) {}
  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    const u = String(url || '');
    if (u.indexOf('/team-action') >= 0) {
      let body = {}; try { body = JSON.parse((opts && opts.body) || '{}'); } catch (_) {}
      try { window.__TEAM_POSTS.push({ url: u, headers: (opts && opts.headers) || {}, body: body }); } catch (_) {}
      const resp = body.action === 'confirmClientSend'
        ? { ok: true, action: 'confirmClientSend', roundKey: 'ar_themes_r1', workflowPhase: 'themes_waiting_client', alreadyDone: false, push: { sent: 0 } }
        : { ok: true, action: body.action || '', decision: body.decision || '', roundType: body.roundType || '', clientFlowStatus: (body.decision === 'adjustment' ? 'revisao' : 'aprovado'), convertedToFeedback: false };
      return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve(resp); } });
    }
    if (u.indexOf('/team/session') >= 0) {
      return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({ ok: true, token: localStorage.getItem('wp_team_jwt') || '' }); } });
    }
    const e = new Error('offline_proof'); return origFetch ? Promise.reject(e) : Promise.reject(e);
  };
})();

/* copyToClipboard/wfCopyReminder usam navigator.clipboard.writeText — capturado p/ prova. */
try {
  Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: function (s) { try { window.__CLIP.push(String(s)); } catch (_) {} return Promise.resolve(); } } });
} catch (_) {}

try {
  window.firebase = { initializeApp: function () { return {}; }, firestore: firestoreFn,
    auth: function () { return { onAuthStateChanged: function () { return noop; }, signInWithCustomToken: function () { return Promise.resolve(); }, signOut: function () { return Promise.resolve(); }, currentUser: null }; } };
  try { localStorage.removeItem('idseven.socialSel.v1'); localStorage.removeItem('idseven.designerSel.v1'); } catch (_) {}
  const desktopAPI = {
    authSelf: authSelf,
    diagLog: diagLog,
    clipboardWriteText: function (s) { try { window.__CLIP.push(String(s)); } catch (_) {} return Promise.resolve(true); },
    version: '1.0.231',
    authLogout: function () { return Promise.resolve({ ok: true }); },
    sessionLogin: noop,
    sessionLogout: noop
  };
  window.desktopAPI = new Proxy(desktopAPI, { get: function (t, k) { return (k in t ? t[k] : fnProxy()); } });
  window.api = window.desktopAPI;
  window.__APP_VERSION = '1.0.231';
} catch (_) {}
