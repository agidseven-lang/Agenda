// F3.3.58-C — matriz de permissões no Firebase Firestore Emulator (rules-unit-testing).
// Cliente NAO-autenticado (request.auth==null, identico ao app sem Firebase Auth).
// Prova: pre-patch /users read ALLOWED; pos-patch /users read/list DENIED; usersPublic
// read OK; usersPublic writes DENIED; /users delete DENIED; /users create/update small
// ALLOWED (residual Opcao A); notifPrefs/catch-all DENIED.
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
    // users/u1 com PII (o que o fechamento protege) — via rules-disabled (bypassa rules)
    await setDoc(doc(db, "users/u1"), { name: "Canary", role: "R", pass: "s2:deadbeef", salt: "abc", fcmTokens: ["t1"], phone: "1", email: "e" });
    await setDoc(doc(db, "usersPublic/u1"), { id: "u1", name: "Canary", role: "R", admin: false, status: "active", photo: "", color: "#000" });
    await setDoc(doc(db, "notifPrefs/u1"), { pref: 1 });
  });
}

// ---------- PRE-patch (baseline: /users read: if true) ----------
{
  const env = await mkEnv(PRE, "demo-pre-users-read");
  await seed(env);
  const db = env.unauthenticatedContext().firestore();
  await succ("PRE  /users get -> ALLOWED (baseline aberto; prova o risco)", getDoc(doc(db, "users/u1")));
  await env.cleanup();
}

// ---------- POST-patch (fechado: /users read: if false) ----------
{
  const env = await mkEnv(POST, "demo-post-users-read");
  await seed(env);
  const db = env.unauthenticatedContext().firestore();
  await fails("A  /users get -> DENIED", getDoc(doc(db, "users/u1")));
  await fails("B  /users list -> DENIED", getDocs(query(collection(db, "users"), limit(5))));
  await succ("C  /usersPublic get -> ALLOWED", getDoc(doc(db, "usersPublic/u1")));
  await succ("D  /usersPublic list -> ALLOWED", getDocs(query(collection(db, "usersPublic"), limit(5))));
  await fails("E  /usersPublic create -> DENIED", setDoc(doc(db, "usersPublic/new1"), { name: "z" }));
  await fails("F  /usersPublic update -> DENIED", updateDoc(doc(db, "usersPublic/u1"), { name: "z" }));
  await fails("G  /usersPublic delete -> DENIED", deleteDoc(doc(db, "usersPublic/u1")));
  await succ("H  /users create (payload<60) -> ALLOWED (residual Opcao A)", setDoc(doc(db, "users/new1"), { a: 1, b: 2 }));
  await succ("I  /users update (payload<60) -> ALLOWED (residual Opcao A)", updateDoc(doc(db, "users/u1"), { a: 1 }));
  await fails("J  /users delete -> DENIED", deleteDoc(doc(db, "users/u1")));
  await fails("K1 notifPrefs get -> DENIED (isAdmin/unauth)", getDoc(doc(db, "notifPrefs/u1")));
  await fails("K2 catch-all random get -> DENIED", getDoc(doc(db, "randomColl/x")));
  await env.cleanup();
}

const pass = results.filter(r => r.ok).length, fail = results.length - pass;
console.log(results.map(r => (r.ok ? "PASS " : "FAIL ") + r.n).join("\n"));
console.log(`\n==== F3.3.58-C EMULATOR MATRIX ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail === 0 ? 0 : 1);
