/* F3.5.4W — PRELOAD de prova (offline, dirigido por SEMENTE). Espelha o preload do harness
 * F3.5.4V-H1: injeta um STUB mínimo de `firebase` ANTES do script da página (o renderer carrega
 * firebase do CDN gstatic — sem rede isso falha e o script inline abortaria em
 * firebase.initializeApp). Diferença essencial: como aqui provamos a UI RENDERIZADA (cards
 * compactos, Central de Detalhes, avatares, Social Medias), o Firestore stub ENTREGA uma SEMENTE
 * REAL via collection(name).onSnapshot(cb) — exatamente o formato que o renderer de produção
 * consome:  state.users=s.docs.map(d=>Object.assign({id:d.id},d.data()))  e
 *           state.tasks=pwaCutoffFilter(dedupById(s.docs.map(...).filter(t=>!isTestTask(t)))).
 * Assim TODO o DOM medido é produzido pelo código de PRODUÇÃO (kbv2Card/kbv2ContentSlot/openDetails/
 * renderSocialBoard/f354SocialStrip/f354SocialAutoPick), a partir de estado semeado — sem IA, sem
 * mockup, sem HTML escrito à mão. A fronteira desktopAPI.authSelf() RESOLVE {ok:true, self:SELF}
 * (nunca rejeita) para o boot autenticar e chamar startApp()→subscribeData()→render(). */
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

/* ---- SEMENTE: lida de um arquivo temporário que o MAIN escreve antes de carregar a página.
   Evita query-string em caminho .asar (que falha em recargas) e é lida pelo contexto Node do
   preload (sandbox:false), fresca a cada carregamento de página. ---- */
let SEED = { self: null, users: [], tasks: [], events: [] };
try {
  const _p = require('path').join(require('os').tmpdir(), 'f354w-seed.json');
  SEED = JSON.parse(require('fs').readFileSync(_p, 'utf8')) || SEED;
} catch (_) {}
const SELF = SEED.self || { id: 'u-self', name: 'Admin', role: 'Administrador', admin: true };
const SEED_DOCS = { usersPublic: SEED.users || [], tasks: SEED.tasks || [], events: SEED.events || [] };

/* ---- Firestore stub — entrega a SEMENTE nas coleções que o renderer assina (usersPublic/tasks/
   events). Cada snapshot tem o mesmo formato do Firestore compat: {docs:[{id,data()}],forEach,size}. */
function makeSnap(arr) {
  const docs = (arr || []).map(function (o) {
    const data = Object.assign({}, o); delete data.id;
    return { id: o.id, exists: true, data: function () { return data; }, get: function (k) { return data[k]; } };
  });
  return { docs: docs, size: docs.length, empty: docs.length === 0, forEach: function (f) { docs.forEach(f); } };
}
function docStub() {
  return { onSnapshot: function () { return noop; },
    get: function () { return Promise.resolve({ exists: false, data: function () { return {}; } }); },
    set: function () { return Promise.resolve(); }, update: function () { return Promise.resolve(); }, delete: function () { return Promise.resolve(); } };
}
function collStub(name) {
  const known = (name === 'usersPublic' || name === 'tasks' || name === 'events');
  const docs = SEED_DOCS[name] || [];
  const c = {
    /* onSnapshot SÍNCRONO só nas 3 coleções semeadas (as que subscribeData assina): dispara
       renderFromSnapshot()→render() com o estado REAL. Demais coleções: não dispara (igual ao
       template), devolve unsubscribe. */
    onSnapshot: function (cb) { if (known && typeof cb === 'function') { try { cb(makeSnap(docs)); } catch (_) {} } return noop; },
    doc: function () { return docStub(); },
    get: function () { return Promise.resolve(makeSnap(known ? docs : [])); },
    add: function () { return Promise.resolve({ id: 'x' + Date.now() }); }
  };
  c.where = function () { return c; }; c.orderBy = function () { return c; }; c.limit = function () { return c; };
  return c;
}
const fsdb = { collection: function (name) { return collStub(name); }, doc: function () { return docStub(); },
  runTransaction: function () { return Promise.resolve(); },
  batch: function () { return { set: noop, update: noop, delete: noop, commit: function () { return Promise.resolve(); } }; },
  enablePersistence: function () { return Promise.resolve(); }, settings: noop };
const FieldValue = { arrayUnion: function () { return { __au: [].slice.call(arguments) }; }, arrayRemove: function () { return {}; },
  delete: function () { return { __del: true }; }, serverTimestamp: function () { return { __ts: true }; }, increment: function (n) { return { __inc: n }; } };
const firestoreFn = function () { return fsdb; };
firestoreFn.FieldValue = FieldValue;
firestoreFn.Timestamp = { now: function () { return { toMillis: function () { return Date.now(); } }; }, fromMillis: function (m) { return { toMillis: function () { return m; } }; } };

/* authSelf() — RESOLVE a sessão válida (nunca rejeita): o boot autentica, esconde o splash e
   chama startApp(SELF). SELF é ADMIN ⇒ canSeeAll ⇒ todas as abas/quadros (Cliente/Designers/
   Social Medias) renderizam. */
window.__DIAG = [];
function authSelf() { return Promise.resolve({ ok: true, self: Object.assign({}, SELF) }); }
function diagLog(ev, payload) { try { window.__DIAG.push({ ev: ev, p: payload || {} }); } catch (_) {} }

try {
  window.firebase = { initializeApp: function () { return {}; }, firestore: firestoreFn,
    auth: function () { return { onAuthStateChanged: function () { return noop; }, signInWithCustomToken: function () { return Promise.resolve(); }, signOut: function () { return Promise.resolve(); }, currentUser: null }; } };
  /* seleção Social/Designer limpa a cada carga fria (persistência é exercida DENTRO das cenas). */
  try { localStorage.removeItem('idseven.socialSel.v1'); localStorage.removeItem('idseven.designerSel.v1'); } catch (_) {}
  const desktopAPI = {
    authSelf: authSelf,
    diagLog: diagLog,
    authLogout: function () { return Promise.resolve({ ok: true }); },
    sessionLogin: noop,
    sessionLogout: noop
  };
  window.desktopAPI = new Proxy(desktopAPI, { get: function (t, k) { return (k in t ? t[k] : fnProxy()); } });
  window.api = window.desktopAPI;   // IS_ELECTRON_APP=!!window.api ⇒ isDesktop()=true ⇒ body.desktop
  window.__APP_VERSION = '1.0.214';
} catch (_) {}
