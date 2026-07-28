// =====================================================================
// F4.3C3 — SUÍTE 6: CAMPOS / MASS ASSIGNMENT (testes 56..64).
// Prova que imutáveis não mudam nem "escondidos" num update grande, que campos
// privilegiados (users) são server-only, e que coleção desconhecida = deny.
// =====================================================================
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { authed, seed, assertFails, assertSucceeds, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("06-campos/mass-assignment");

  await seed(env, async (db) => {
    await setDoc(doc(db, "users/MA"), { name: "Ma", role: "designer", status: "ativo" });
    await setDoc(doc(db, "tasks/TMA"), { title: "t", by: "MA", assigneeId: "MA", status: "afazer", createdAt: 1000, src: "webpreview" });
    await setDoc(doc(db, "chats/CMA"), { participants: ["MA", "MB"], createdAt: 1 });
  });

  const me = authed(env, "MA");

  await t(56, "update SÓ campo de conteúdo (title) mantendo imutáveis → ALLOW", () => assertSucceeds(updateDoc(doc(me, "tasks/TMA"), { title: "novo" })));
  await t(57, "mass-assignment: altera 'by' junto com title → DENY", () => assertFails(updateDoc(doc(me, "tasks/TMA"), { title: "x", by: "MZ" })));
  await t(58, "zera/remove criador (by='') → DENY (imutável)", () => assertFails(updateDoc(doc(me, "tasks/TMA"), { by: "" })));
  await t(59, "altera timestamp imutável (createdAt) → DENY", () => assertFails(updateDoc(doc(me, "tasks/TMA"), { createdAt: 5 })));
  await t(60, "altera participants do chat (mass-assign) → DENY", () => assertFails(updateDoc(doc(me, "chats/CMA"), { participants: ["MA", "MB", "MZ"] })));
  await t(61, "create users com admin=true → DENY (server-only)", () => assertFails(setDoc(doc(me, "users/HX1"), { name: "H", admin: true, status: "ativo" })));
  await t(62, "create users com role → DENY (server-only)", () => assertFails(setDoc(doc(me, "users/HX2"), { name: "H", role: "gestor", status: "ativo" })));
  await t(63, "create users com status privilegiado → DENY (server-only)", () => assertFails(setDoc(doc(me, "users/HX3"), { name: "H", status: "ativo" })));
  await t(64, "cria doc em coleção DESCONHECIDA → DENY (deny-by-default)", () => assertFails(setDoc(doc(me, "segredos/x"), { a: 1 })));

  return summary();
}
