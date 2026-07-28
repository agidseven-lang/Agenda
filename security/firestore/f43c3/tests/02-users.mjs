// =====================================================================
// F4.3C3 — SUÍTE 2: USERS (testes 13..24). users é SERVER-ONLY (deny total ao
// cliente); roster do usuário vem de usersPublic (projeção segura).
// =====================================================================
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from "firebase/firestore";
import { authed, seed, assertFails, assertSucceeds, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("02-users");

  await seed(env, async (db) => {
    // usuário ativo do teste + outro usuário + projeção usersPublic
    await setDoc(doc(db, "users/ME"), { name: "Me", role: "designer", admin: false, status: "ativo", pass: "s2:h", salt: "s", fcmTokens: ["tk"], email: "me@x.com", phone: "1" });
    await setDoc(doc(db, "users/OTHER"), { name: "Ot", role: "designer", admin: false, status: "ativo", pass: "s2:z", salt: "s2" });
    await setDoc(doc(db, "usersPublic/ME"), { id: "ME", name: "Me", role: "designer", admin: false, status: "ativo", photo: "", color: "#000" });
    await setDoc(doc(db, "usersPublic/OTHER"), { id: "OTHER", name: "Ot", role: "designer", admin: false, status: "ativo", photo: "", color: "#111" });
  });

  const me = authed(env, "ME");

  await t(13, "usuário lê PRÓPRIO users → DENY (perfil vem de usersPublic)", () => assertFails(getDoc(doc(me, "users/ME"))));
  await t(14, "usuário lê users de OUTRO → DENY", () => assertFails(getDoc(doc(me, "users/OTHER"))));
  await t(15, "usuário LISTA users → DENY", () => assertFails(getDocs(collection(me, "users"))));
  await t(16, "usuário altera PRÓPRIO admin → DENY", () => assertFails(updateDoc(doc(me, "users/ME"), { admin: true })));
  await t(17, "usuário altera PRÓPRIA role → DENY", () => assertFails(updateDoc(doc(me, "users/ME"), { role: "gestor" })));
  await t(18, "usuário altera PRÓPRIO status → DENY", () => assertFails(updateDoc(doc(me, "users/ME"), { status: "ativo" })));
  await t(19, "usuário altera sessionVersion → DENY (users fechado; campo nem existe no canônico)", () => assertFails(updateDoc(doc(me, "users/ME"), { sessionVersion: 9 })));
  await t(20, "usuário tenta ler pass/salt (via get users) → DENY", () => assertFails(getDoc(doc(me, "users/ME"))));
  await t(21, "usuário ATIVO lê usersPublic → ALLOW", () => assertSucceeds(getDoc(doc(me, "usersPublic/OTHER"))));
  await t(22, "usuário modifica usersPublic → DENY", () => assertFails(updateDoc(doc(me, "usersPublic/ME"), { role: "gestor" })));
  await t(23, "usuário cria administrador (users/*.admin=true) → DENY", () => assertFails(setDoc(doc(me, "users/NEW"), { name: "N", admin: true, status: "ativo" })));
  await t(24, "usuário registra token FCM direto (users/self.fcmTokens) → DENY", () => assertFails(updateDoc(doc(me, "users/ME"), { fcmTokens: ["novo"] })));

  return summary();
}
