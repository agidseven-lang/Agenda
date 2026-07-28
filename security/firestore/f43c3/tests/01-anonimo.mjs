// =====================================================================
// F4.3C3 — SUÍTE 1: ACESSO ANÔNIMO (testes 1..12). Tudo deve ser DENY.
// =====================================================================
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { anon, seed, assertFails, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("01-anônimo");

  // fixtures sintéticas (ignoram Rules): docs de partida em cada coleção.
  await seed(env, async (db) => {
    await setDoc(doc(db, "users/U1"), { name: "A", email: "a@x.com", pass: "s2:h", salt: "s", role: "designer", admin: false, status: "ativo", sessionVersion: 0 });
    await setDoc(doc(db, "tasks/T1"), { title: "t", createdBy: "U1", status: "A Fazer" });
    await setDoc(doc(db, "events/E1"), { title: "e", ownerId: "U1", participants: ["U1"] });
    await setDoc(doc(db, "chats/C1"), { participants: ["U1", "U2"] });
    await setDoc(doc(db, "chats/C1/messages/M1"), { senderId: "U1", text: "hi" });
  });

  const db = anon(env);

  await t(1, "anônimo lê users → DENY", () => assertFails(getDoc(doc(db, "users/U1"))));
  await t(2, "anônimo lista users → DENY", () => assertFails(getDocs(collection(db, "users"))));
  await t(3, "anônimo cria user → DENY", () => assertFails(setDoc(doc(db, "users/UX"), { name: "X" })));
  await t(4, "anônimo atualiza user → DENY", () => assertFails(updateDoc(doc(db, "users/U1"), { name: "Z" })));
  await t(5, "anônimo lê tasks → DENY", () => assertFails(getDoc(doc(db, "tasks/T1"))));
  await t(6, "anônimo cria task → DENY", () => assertFails(setDoc(doc(db, "tasks/TX"), { title: "x", createdBy: "U1", status: "A Fazer" })));
  await t(7, "anônimo atualiza task → DENY", () => assertFails(updateDoc(doc(db, "tasks/T1"), { title: "z" })));
  await t(8, "anônimo exclui task → DENY", () => assertFails(deleteDoc(doc(db, "tasks/T1"))));
  await t(9, "anônimo lê events → DENY", () => assertFails(getDoc(doc(db, "events/E1"))));
  await t(10, "anônimo escreve events → DENY", () => assertFails(setDoc(doc(db, "events/EX"), { title: "x", ownerId: "U1" })));
  await t(11, "anônimo lê chats → DENY", () => assertFails(getDoc(doc(db, "chats/C1"))));
  await t(12, "anônimo escreve messages → DENY", () => assertFails(setDoc(doc(db, "chats/C1/messages/MX"), { senderId: "U1", text: "x" })));

  return summary();
}
