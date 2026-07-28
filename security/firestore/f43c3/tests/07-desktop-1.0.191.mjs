// =====================================================================
// F4.3C3 — SUÍTE 7: DESKTOP 1.0.191 (GOLDEN MASTER) sob as Rules-alvo.
// A Desktop NÃO usa Firebase Auth => TODAS as suas ops carregam request.auth==null.
// Ops REAIS auditadas: onSnapshot(usersPublic), onSnapshot(events)+add/update,
// onSnapshot(tasks)+add/update. Sob as Rules-alvo (request.auth obrigatório) TUDO
// resulta em DENY. ISSO É ESPERADO e PROVA que as Rules-alvo NÃO podem ser
// implantadas com a Desktop 1.0.191 — sem enfraquecer as Rules nem criar exceção
// anônima. NÃO corrigimos a Desktop nesta fase. Ver F4.3C3-DESKTOP-MIGRATION-CONSTRAINT.md.
// =====================================================================
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from "firebase/firestore";
import { anon, seed, assertFails, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("07-desktop-1.0.191");

  await seed(env, async (db) => {
    await setDoc(doc(db, "usersPublic/U1"), { id: "U1", name: "U", role: "designer", admin: false, status: "ativo", photo: "", color: "#000" });
    await setDoc(doc(db, "events/EV1"), { title: "e", by: "U1", ownerId: "U1", createdAt: 1, src: "webpreview" });
    await setDoc(doc(db, "tasks/T1"), { title: "t", by: "U1", status: "afazer", createdAt: 1, src: "webpreview" });
  });

  // Desktop = cliente SEM request.auth (contexto não autenticado do emulador).
  const dk = anon(env);

  await t("D1", "Desktop lê roster usersPublic (onSnapshot) → DENY (sem request.auth)", () => assertFails(getDocs(collection(dk, "usersPublic"))));
  await t("D2", "Desktop lê events (onSnapshot) → DENY", () => assertFails(getDocs(collection(dk, "events"))));
  await t("D3", "Desktop cria event → DENY", () => assertFails(setDoc(doc(dk, "events/EVX"), { title: "x", by: "U1", ownerId: "U1", createdAt: 2, src: "webpreview" })));
  await t("D4", "Desktop atualiza event → DENY", () => assertFails(updateDoc(doc(dk, "events/EV1"), { title: "z" })));
  await t("D5", "Desktop lê tasks (onSnapshot) → DENY", () => assertFails(getDocs(collection(dk, "tasks"))));
  await t("D6", "Desktop cria task → DENY", () => assertFails(setDoc(doc(dk, "tasks/TX"), { title: "x", by: "U1", status: "afazer", createdAt: 2, src: "webpreview" })));
  await t("D7", "Desktop atualiza task (mover card) → DENY", () => assertFails(updateDoc(doc(dk, "tasks/T1"), { status: "andamento" })));
  await t("D8", "Desktop lê 1 doc usersPublic → DENY", () => assertFails(getDoc(doc(dk, "usersPublic/U1"))));

  return summary();
}
