// F3.3.61-T1 — matriz de permissoes no Firebase Firestore Emulator (rules-unit-testing).
// Cliente NAO-autenticado (request.auth==null, identico ao app sem Firebase Auth).
// Prova: PRE-patch /users create/update (payload<60) ALLOWED (o risco que T fecha);
// POS-patch /users create/update DENIED; /users read/delete seguem DENIED; usersPublic
// read OK / writes DENIED; notifPrefs/catch-all DENIED. NAO cria ruleset de producao.
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, query, limit } from "firebase/firestore";
import fs from "node:fs";

const PRE = fs.readFileSync(process.env.PRE_RULES, "utf8");
const POST = fs.readFileSync(process.env.POST_RULES, "utf8");
const HOST = "127.0.0.1", PORT = 8080;
const results = [];
const rec = (n, ok) => { results.push({ n, ok: !!ok }); };
const fails = async (n, p) => rec(n, await assertFails(p).then(() => true).catch(() => false));
const succ  = async (n, p) => rec(n, await assertSucceeds(p).then(() => true).catch(() => false));

async function mkEnv(rules, pid) {
  return initializeTestEnvironment({ projectId: pid, firestore: { rules, host: HOST, port: PORT } });
}
async function seed(env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // users/u1 com PII — via rules-disabled (bypassa rules), simula o doc existente.
    await setDoc(doc(db, "users/u1"), { name: "Canary", role: "R", pass: "s2:deadbeef", salt: "abc", fcmTokens: ["t1"], phone: "1", email: "e" });
    await setDoc(doc(db, "usersPublic/u1"), { id: "u1", name: "Canary", role: "R", admin: false, status: "active", photo: "", color: "#000" });
    await setDoc(doc(db, "notifPrefs/u1"), { pref: 1 });
  });
}

// ---------- PRE-patch (baseline: /users create/update abertos por size()<60) ----------
{
  const env = await mkEnv(PRE, "demo-pre-users-cu");
  await seed(env);
  const db = env.unauthenticatedContext().firestore();
  await succ("PRE-1 /users create (payload<60) -> ALLOWED (baseline aberto; prova o risco que T fecha)", setDoc(doc(db, "users/new1"), { a: 1, b: 2 }));
  await succ("PRE-2 /users update (payload<60) -> ALLOWED (baseline aberto)", updateDoc(doc(db, "users/u1"), { a: 1 }));
  await fails("PRE-3 /users get -> DENIED (read ja fechado pelo F3.3.58; confirma pre-condicao)", getDoc(doc(db, "users/u1")));
  await env.cleanup();
}

// ---------- POST-patch (fechado: /users create/update: if false) ----------
{
  const env = await mkEnv(POST, "demo-post-users-cu");
  await seed(env);
  const db = env.unauthenticatedContext().firestore();
  await fails("A  /users create (payload<60) -> DENIED (T fechou)", setDoc(doc(db, "users/new2"), { a: 1, b: 2 }));
  await fails("B  /users update (payload<60) -> DENIED (T fechou)", updateDoc(doc(db, "users/u1"), { a: 1 }));
  await fails("C  /users get -> DENIED (read permanece fechado)", getDoc(doc(db, "users/u1")));
  await fails("D  /users list -> DENIED", getDocs(query(collection(db, "users"), limit(5))));
  await fails("E  /users delete -> DENIED (permanece fechado)", deleteDoc(doc(db, "users/u1")));
  await succ("F  /usersPublic get -> ALLOWED", getDoc(doc(db, "usersPublic/u1")));
  await succ("G  /usersPublic list -> ALLOWED", getDocs(query(collection(db, "usersPublic"), limit(5))));
  await fails("H  /usersPublic create -> DENIED", setDoc(doc(db, "usersPublic/new1"), { name: "z" }));
  await fails("I  /usersPublic update -> DENIED", updateDoc(doc(db, "usersPublic/u1"), { name: "z" }));
  await fails("J  /usersPublic delete -> DENIED", deleteDoc(doc(db, "usersPublic/u1")));
  await fails("K1 notifPrefs get -> DENIED (isAdmin/unauth)", getDoc(doc(db, "notifPrefs/u1")));
  await fails("K2 catch-all random get -> DENIED", getDoc(doc(db, "randomColl/x")));
  await env.cleanup();
}

const pass = results.filter(r => r.ok).length, fail = results.length - pass;
console.log(results.map(r => (r.ok ? "PASS " : "FAIL ") + r.n).join("\n"));
console.log(`\n==== F3.3.61-T1 EMULATOR MATRIX ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail === 0 ? 0 : 1);
