/* F3.5.4V — PRELOAD de prova (offline). O renderer REAL (index.html) carrega o firebase do
 * CDN gstatic; num ambiente sem rede isso falharia e o script inline abortaria em
 * firebase.initializeApp. Este preload injeta um STUB mínimo de `firebase` (e desktopAPI)
 * ANTES do script da página, de modo que TODO o código real do renderer executa sem alteração.
 * NÃO altera nenhuma lógica de produto — só substitui a fronteira de rede/IPC no harness. */
const noop = function () {};
function fnProxy() { return new Proxy(noop, { get: () => fnProxy(), apply: () => undefined }); }

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
try {
  window.firebase = { initializeApp: () => ({}), firestore: firestoreFn,
    auth: () => ({ onAuthStateChanged: () => (() => {}), signInWithCustomToken: () => Promise.resolve(), signOut: () => Promise.resolve(), currentUser: null }) };
  window.desktopAPI = fnProxy();
  window.api = fnProxy();
} catch (_) {}
