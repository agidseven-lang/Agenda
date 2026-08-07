/* F3.5.5E-H4 — PRELOAD de prova (offline, semente). Mesma infraestrutura aprovada dos harnesses
 * F3.5.5C/D/E (firebase stub + seed + desktopAPI Proxy), MAS com os CANAIS REAIS de notificação
 * ligados ao ipcRenderer — os MESMOS nomes de canal do preload de produção (contrato):
 *   main→renderer: notif-toast, notif-group-update, notif-history, notif-open, notif-collect-request
 *   renderer→main: notif-toast-ack, notif-collect-reply
 * Assim o RENDERER REAL do asar conversa com o PIPELINE REAL do main (deliverNotification+handoff
 * extraídos do dist compilado + bgNotify.js REAL) — o handoff no blur é provado de ponta a ponta. */
const { ipcRenderer } = require('electron');
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

let SEED = { self: null, users: [], tasks: [], events: [] };
try {
  const _p = require('path').join(require('os').tmpdir(), 'f355eh4-seed.json');
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
    update: function (patch) { try { window.__PATCHES.push({ coll: coll, id: id, patch: patch }); } catch (_) {} return Promise.resolve(); },
    delete: function () { return Promise.resolve(); } };
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
window.__NOTIF_OPEN = [];

try {
  window.firebase = { initializeApp: function () { return {}; }, firestore: firestoreFn,
    auth: function () { return { onAuthStateChanged: function () { return noop; }, signInWithCustomToken: function () { return Promise.resolve(); }, signOut: function () { return Promise.resolve(); }, currentUser: null }; } };
  const desktopAPI = {
    authSelf: function () { return Promise.resolve({ ok: true, self: Object.assign({}, SELF) }); },
    diagLog: function (ev, p) { try { window.__DIAG.push({ ev: ev, p: p || {} }); } catch (_) {} },
    version: '1.0.228',
    authLogout: function () { return Promise.resolve({ ok: true }); },
    sessionLogin: noop, sessionLogout: noop,
    /* CANAIS REAIS DE NOTIFICAÇÃO (mesmos nomes do preload de produção) */
    onNotifToast: function (cb) { ipcRenderer.on('notif-toast', function (_e, p) { cb(p); }); },
    onNotifGroupUpdate: function (cb) { ipcRenderer.on('notif-group-update', function (_e, v) { cb(v); }); },
    onNotifHistory: function (cb) { ipcRenderer.on('notif-history', function (_e, p) { try { window.__NOTIF_HIST = (window.__NOTIF_HIST || 0) + 1; } catch (_) {} cb(p); }); },
    onNotifOpen: function (cb) { ipcRenderer.on('notif-open', function (_e, d) { try { window.__NOTIF_OPEN.push(String(d || '')); } catch (_) {} cb(d); }); },
    notifToastAck: function (k) { try { ipcRenderer.send('notif-toast-ack', String(k || '')); } catch (_) {} },
    onNotifCollect: function (cb) { ipcRenderer.on('notif-collect-request', function (_e, r) { cb(Number(r) || 0); }); },
    notifCollectReply: function (reqId, keys) { try { ipcRenderer.send('notif-collect-reply', Number(reqId) || 0, (Array.isArray(keys) ? keys : []).map(function (k) { return String(k || ''); })); } catch (_) {} },
    /* F3.5.5E-H4 — canal do COMMIT do handoff transacional */
    onNotifCollectCommit: function (cb) { ipcRenderer.on('notif-collect-commit', function (_e, entries) { cb((Array.isArray(entries) ? entries : []).map(function (k) { return String(k || ''); })); }); }
  };
  window.desktopAPI = new Proxy(desktopAPI, { get: function (t, k) { return (k in t ? t[k] : fnProxy()); } });
  window.api = window.desktopAPI;
  window.__APP_VERSION = '1.0.228';
} catch (_) {}
