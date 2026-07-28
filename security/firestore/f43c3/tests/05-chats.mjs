// =====================================================================
// F4.3C3 — SUÍTE 5: CHATS + MESSAGES (testes 47..55). Escopo por participants.
// senderId = campo `by` (== uid, imutável). participants imutável no update.
// =====================================================================
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from "firebase/firestore";
import { authed, anon, seed, assertFails, assertSucceeds, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("05-chats");

  await seed(env, async (db) => {
    for (const u of ["UA", "UB", "UC"]) await setDoc(doc(db, "users/" + u), { name: u, role: "designer", status: "ativo" });
    await setDoc(doc(db, "chats/C_AB"), { participants: ["UA", "UB"], createdAt: 1, isGroup: false });
    await setDoc(doc(db, "chats/C_AB/messages/M1"), { by: "UA", text: "oi", at: 1 });
  });

  const a = authed(env, "UA");
  const c = authed(env, "UC");

  await t(47, "participante lê chat → ALLOW", () => assertSucceeds(getDoc(doc(a, "chats/C_AB"))));
  await t(48, "NÃO participante lê chat → DENY", () => assertFails(getDoc(doc(c, "chats/C_AB"))));
  await t(49, "participante cria mensagem (by==uid) → ALLOW", () => assertSucceeds(setDoc(doc(a, "chats/C_AB/messages/M2"), { by: "UA", text: "nova", at: 2 })));
  await t(50, "senderId (by) != uid (spoof) → DENY", () => assertFails(setDoc(doc(a, "chats/C_AB/messages/M3"), { by: "UB", text: "x", at: 3 })));
  await t(51, "altera mensagem (senderId/texto) → DENY (imutável)", () => assertFails(updateDoc(doc(a, "chats/C_AB/messages/M1"), { by: "UB" })));
  await t(52, "NÃO participante lê mensagens do chat → DENY", () => assertFails(getDocs(collection(c, "chats/C_AB/messages"))));
  await t(53, "cria chat sem incluir o próprio uid → DENY", () => assertFails(setDoc(doc(a, "chats/C_NEW"), { participants: ["UB", "UC"], createdAt: 4 })));
  await t(54, "adiciona participante (altera participants no update) → DENY (imutável)", () => assertFails(updateDoc(doc(a, "chats/C_AB"), { participants: ["UA", "UB", "UC"] })));
  await t(55, "anônimo acessa mensagens → DENY", () => assertFails(getDoc(doc(anon(env), "chats/C_AB/messages/M1"))));

  return summary();
}
