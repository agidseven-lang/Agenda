// =====================================================================
// F4.3C4C — Harness dos testes do protótipo. Firebase Web SDK REAL contra os
// EMULADORES (Auth 9099 + Firestore 8080), project FICTÍCIO demo-agenda-id-seven-f43c4c.
// `signInWithCustomToken` é o REAL (contra o Auth Emulator). Rules-alvo F4.3C3
// byte-idênticas carregadas pelo Firestore Emulator (via firebase.json).
// =====================================================================
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth, connectAuthEmulator, signInWithCustomToken, signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection,
  onSnapshot, terminate,
} from "firebase/firestore";

export const PROJECT_ID = "demo-agenda-id-seven-f43c4c";
const AUTH_PORT = 9099;
const FS_PORT = 8080;
const HOST = "127.0.0.1";

let _seq = 0;
/** App Firebase isolado por teste (evita vazamento de auth-state entre casos). */
export function makeClient() {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT_ID }, `f43c4c-${_seq++}-${process.pid}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:${AUTH_PORT}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, FS_PORT);
  return {
    app, auth, db,
    // authAdapter injetado no DesktopAuthBridge (usa o SDK real).
    authAdapter: {
      signInWithCustomToken: async (t) => (await signInWithCustomToken(auth, t)).user.uid,
      signOut: () => signOut(auth),
      currentUid: () => auth.currentUser?.uid ?? null,
    },
    onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
    async cleanup() { try { await terminate(db); } catch {} try { await deleteApp(app); } catch {} },
  };
}

/** Cofre de sessão sintético em memória (equivalente ao SecureSessionStore). */
export function makeSessionStore(initial = null) {
  let cur = initial;
  return {
    load: () => cur,
    save: (s) => { cur = s; },
    clear: () => { cur = null; },
    _peek: () => cur,
  };
}

/** Seed do Firestore via REST do emulador (bypassa Rules — como Admin SDK/trigger). */
export async function seedDoc(path, data) {
  const url = `http://${HOST}:${FS_PORT}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const fields = toFields(data);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`seed falhou ${res.status} em ${path}`);
}
function toFields(obj) {
  const f = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") f[k] = { stringValue: v };
    else if (typeof v === "boolean") f[k] = { booleanValue: v };
    else if (typeof v === "number") f[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    else if (v === null) f[k] = { nullValue: null };
    else f[k] = { stringValue: String(v) };
  }
  return f;
}

/** Limpa TODOS os documentos do emulador entre suítes. */
export async function clearFirestore() {
  const url = `http://${HOST}:${FS_PORT}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  await fetch(url, { method: "DELETE" });
}

export { doc, getDoc, setDoc, collection, onSnapshot };

export async function assertFails(promise, label) {
  try { await promise; }
  catch (e) { if (e?.code === "permission-denied" || /PERMISSION_DENIED|Missing or insufficient/i.test(e?.message || "")) return; throw new Error(`${label}: erro inesperado (esperado permission-denied): ${e?.code || e?.message}`); }
  throw new Error(`${label}: esperado DENY mas a operação teve SUCESSO`);
}
export async function assertSucceeds(promise, label) {
  try { return await promise; }
  catch (e) { throw new Error(`${label}: esperado ALLOW mas falhou: ${e?.code || e?.message}`); }
}

export function makeReporter(suite) {
  let ok = 0, fail = 0; const failures = [];
  return {
    async t(id, desc, fn) {
      try { await fn(); ok++; console.log(`  ✓ ${id} ${desc}`); }
      catch (e) { fail++; failures.push(`${id} ${desc} :: ${e.message}`); console.log(`  ✗ ${id} ${desc}\n      ${e.message}`); }
    },
    summary() { return { suite, ok, fail, failures }; },
  };
}

/** Espera uma condição (polling curto) — para listeners em tempo real. */
export async function waitFor(pred, { tries = 50, delayMs = 60 } = {}) {
  for (let i = 0; i < tries; i++) { if (await pred()) return true; await new Promise((r) => setTimeout(r, delayMs)); }
  return false;
}
