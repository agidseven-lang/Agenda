/* F3.5.5B — PRELOAD de prova (offline, dirigido por SEMENTE). Mesmo padrão aprovado dos
 * harnesses F3.5.4W-H1/F3.5.5A-H1: injeta um STUB mínimo de `firebase` ANTES do script da
 * página (o renderer carrega firebase do CDN gstatic — sem rede isso falharia em
 * firebase.initializeApp) e ENTREGA uma SEMENTE REAL via collection(name).onSnapshot(cb)
 * no formato que o renderer de produção consome. TODO o DOM medido é produzido pelo
 * CÓDIGO DE PRODUÇÃO (renderHoje, renderAgenda, eventCard, openEventDetail…) a partir de
 * estado semeado — sem IA, sem mockup, sem HTML à mão.
 *
 * ESPECÍFICO DA F3.5.5B:
 *   • collection('events').doc(id).update(patch): REGISTRA {coll,id,patch} em
 *     window.__PATCHES e RESOLVE; .delete(): REGISTRA em window.__DELETES e RESOLVE
 *     (prova da exclusão definitiva SÓ após digitar EXCLUIR).
 *   • desktopAPI.version='1.0.222'; window.__DIAG registra cada diagLog. */
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

let SEED = { self: null, users: [], tasks: [], events: [] };
try {
  const _p = require('path').join(require('os').tmpdir(), 'f355b-seed.json');
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
function docStub(coll, id) {
  return { onSnapshot: function () { return noop; },
    get: function () { return Promise.resolve({ exists: false, data: function () { return {}; } }); },
    set: function () { return Promise.resolve(); },
    update: function (patch) {
      try { window.__PATCHES.push({ coll: coll, id: id, patch: patch }); } catch (_) {}
      if (window.__DB_FAIL) { const e = new Error('unavailable'); e.code = 'unavailable'; return Promise.reject(e); }
      return Promise.resolve();
    },
    delete: function () { try { window.__DELETES.push({ coll: coll, id: id }); } catch (_) {} return Promise.resolve(); } };
}
function collStub(name) {
  const known = (name === 'usersPublic' || name === 'tasks' || name === 'events');
  const docs = SEED_DOCS[name] || [];
  const c = {
    onSnapshot: function (cb) { if (known && typeof cb === 'function') { try { cb(makeSnap(docs)); } catch (_) {} } return noop; },
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
window.__DELETES = [];
window.__DB_FAIL = false;
function authSelf() { return Promise.resolve({ ok: true, self: Object.assign({}, SELF) }); }
function diagLog(ev, payload) { try { window.__DIAG.push({ ev: ev, p: payload || {} }); } catch (_) {} }

try {
  window.firebase = { initializeApp: function () { return {}; }, firestore: firestoreFn,
    auth: function () { return { onAuthStateChanged: function () { return noop; }, signInWithCustomToken: function () { return Promise.resolve(); }, signOut: function () { return Promise.resolve(); }, currentUser: null }; } };
  try { localStorage.removeItem('idseven.socialSel.v1'); localStorage.removeItem('idseven.designerSel.v1'); } catch (_) {}
  const desktopAPI = {
    authSelf: authSelf,
    diagLog: diagLog,
    clipboardWriteText: function (s) { return Promise.resolve(true); },
    version: '1.0.222',
    authLogout: function () { return Promise.resolve({ ok: true }); },
    sessionLogin: noop,
    sessionLogout: noop
  };
  window.desktopAPI = new Proxy(desktopAPI, { get: function (t, k) { return (k in t ? t[k] : fnProxy()); } });
  window.api = window.desktopAPI;
  window.__APP_VERSION = '1.0.222';
} catch (_) {}
