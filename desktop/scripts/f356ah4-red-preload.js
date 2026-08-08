/* F3.5.6A-H4 — PRELOAD do RED do CAMINHO REAL DE CRIAÇÃO. Diferente da H3 (que semeou o doc),
 * aqui o renderer REAL executa saveTask() e ESTE preload INTERCEPTA os writes reais do Firestore:
 *   • firebase.firestore() → db com collection('tasks').doc([id]).set/get/update + add(), tudo REAL:
 *       - .doc()            → id ESTÁVEL (o mesmo _draftId que a saveTask lê) — sem duplicar em retry.
 *       - .set(payload)     → ARMAZENA por id (para o read-back da própria saveTask passar) e captura
 *                             o payload EXATO em window.__WRITES (o doc que a criação de fato gravaria).
 *       - .get()            → devolve o doc armazenado (read-back divergente jamais mascara o teste).
 *       - window.__DB_FAIL  → set/update REJEITAM com {code:'unavailable'} (Cenário C — falha do servidor).
 *   • fetch /team-action  → confirmClientSend no MESMO contrato do Worker real (prova o wiring do botão).
 *   • wp_team_jwt sintético; desktopAPI/versão vêm da SEMENTE (tmpdir/f356ah4-seed.json). */
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

let SEED = { self: null, users: [], tasks: [], events: [], version: '1.0.233' };
try {
  const _p = require('path').join(require('os').tmpdir(), 'f356ah4-seed.json');
  SEED = JSON.parse(require('fs').readFileSync(_p, 'utf8')) || SEED;
} catch (_) {}
const SELF = SEED.self || { id: 'u-self', name: 'Admin', role: 'Administrador', admin: true };
const VERSION = SEED.version || '1.0.233';
const SEED_DOCS = { usersPublic: SEED.users || [], tasks: SEED.tasks || [], events: SEED.events || [] };

/* armazenamento REAL por coleção/id — o que a saveTask grava fica disponível para o read-back. */
const STORE = { tasks: {}, usersPublic: {}, events: {} };
let GEN = 1;
function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (_) { return o; } }

function makeSnap(arr) {
  const docs = (arr || []).map(function (o) {
    const data = Object.assign({}, o); delete data.id;
    return { id: o.id, exists: true, data: function () { return data; }, get: function (k) { return data[k]; } };
  });
  return { docs: docs, size: docs.length, empty: docs.length === 0, forEach: function (f) { docs.forEach(f); } };
}
const LIVE = { tasks: [] };
function failIfNeeded() { if (window.__DB_FAIL) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; } }
function docStub(coll, id) {
  const _id = id || ('gen_' + (GEN++) + '_' + Date.now());
  return {
    id: _id,
    onSnapshot: function () { return noop; },
    get: function () {
      const d = (STORE[coll] || {})[_id];
      return Promise.resolve({ id: _id, exists: !!d, data: function () { return d ? clone(d) : undefined; }, get: function (k) { return d ? d[k] : undefined; } });
    },
    set: function (payload, opts) {
      try { failIfNeeded(); } catch (e) { return Promise.reject(e); }
      STORE[coll] = STORE[coll] || {};
      /* honra .set(data,{merge:true}) — o Firestore REAL mescla; sem isso o write do token apagaria o doc. */
      if (opts && opts.merge) STORE[coll][_id] = Object.assign({}, STORE[coll][_id] || {}, clone(payload));
      else STORE[coll][_id] = clone(payload);
      try { window.__WRITES.push({ coll: coll, id: _id, op: 'set', merge: !!(opts && opts.merge), payload: clone(payload) }); } catch (_) {}
      return Promise.resolve();
    },
    update: function (patch) {
      try { window.__PATCHES.push({ coll: coll, id: _id, patch: patch }); } catch (_) {}
      try { failIfNeeded(); } catch (e) { return Promise.reject(e); }
      STORE[coll] = STORE[coll] || {}; STORE[coll][_id] = Object.assign({}, STORE[coll][_id] || {}, patch);
      return Promise.resolve();
    },
    delete: function () { return Promise.resolve(); }
  };
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
    add: function (payload) {
      try { failIfNeeded(); } catch (e) { return Promise.reject(e); }
      const _id = 'add_' + (GEN++) + '_' + Date.now();
      STORE[name] = STORE[name] || {}; STORE[name][_id] = clone(payload);
      try { window.__WRITES.push({ coll: name, id: _id, op: 'add', payload: clone(payload) }); } catch (_) {}
      return Promise.resolve({ id: _id });
    }
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
window.__WRITES = [];
window.__PATCHES = [];
window.__CLIP = [];
window.__TEAM_POSTS = [];
window.__DB_FAIL = false;
window.__STORE = STORE;
window.__resetWrites = function () { try { window.__WRITES.length = 0; } catch (_) {} };
window.__emitTasks = function (tasks) { try { const s = makeSnap(tasks || []); LIVE.tasks.forEach(function (cb) { try { cb(s); } catch (_) {} }); return LIVE.tasks.length; } catch (_) { return -1; } };
function authSelf() { return Promise.resolve({ ok: true, self: Object.assign({}, SELF) }); }
function diagLog(ev, payload) { try { window.__DIAG.push({ ev: ev, p: payload || {} }); } catch (_) {} }

/* fetch interceptado (offline): team-action registrado e respondido no contrato do Worker. */
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

try {
  Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: function (s) { try { window.__CLIP.push(String(s)); } catch (_) {} return Promise.resolve(); } } });
} catch (_) {}

/* silencia alert/confirm/prompt (a saveTask usa alert em validação/erro — não pode travar o headless). */
try { window.alert = function (m) { try { window.__DIAG.push({ ev: 'alert', p: { m: String(m || '') } }); } catch (_) {} }; } catch (_) {}
try { window.confirm = function () { return true; }; } catch (_) {}
try { window.prompt = function () { return ''; }; } catch (_) {}

try {
  window.firebase = { initializeApp: function () { return {}; }, firestore: firestoreFn,
    auth: function () { return { onAuthStateChanged: function () { return noop; }, signInWithCustomToken: function () { return Promise.resolve(); }, signOut: function () { return Promise.resolve(); }, currentUser: null }; } };
  try { localStorage.removeItem('idseven.socialSel.v1'); localStorage.removeItem('idseview.designerSel.v1'); localStorage.removeItem('idseven.designerSel.v1'); } catch (_) {}
  const desktopAPI = {
    authSelf: authSelf,
    diagLog: diagLog,
    clipboardWriteText: function (s) { try { window.__CLIP.push(String(s)); } catch (_) {} return Promise.resolve(true); },
    version: VERSION,
    authLogout: function () { return Promise.resolve({ ok: true }); },
    sessionLogin: noop,
    sessionLogout: noop
  };
  window.desktopAPI = new Proxy(desktopAPI, { get: function (t, k) { return (k in t ? t[k] : fnProxy()); } });
  window.api = window.desktopAPI;
  window.__APP_VERSION = VERSION;
} catch (_) {}
