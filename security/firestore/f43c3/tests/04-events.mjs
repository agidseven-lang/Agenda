// =====================================================================
// F4.3C3 — SUÍTE 4: EVENTS (testes 39..46). Modelo REAL = agenda de EQUIPE
// single-owner. DIVERGÊNCIA: events NÃO têm participants[] (só ownerId+by);
// o modelo "participante x não-participante" da suposição NÃO existe. Leitura
// é de EQUIPE (membro ativo lê todos). Endurecimento na ESCRITA: by/ownerId/
// createdAt/src imutáveis; exclusão só por criador/responsável.
// =====================================================================
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { authed, seed, assertFails, assertSucceeds, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("04-events");

  await seed(env, async (db) => {
    for (const u of ["E1", "E2"]) await setDoc(doc(db, "users/" + u), { name: u, role: "designer", status: "ativo" });
    await setDoc(doc(db, "events/EV1"), { title: "ev1", by: "E1", ownerId: "E1", owner: "E1", date: "2026-08-01", createdAt: 1000, src: "webpreview" });
    await setDoc(doc(db, "events/EV2"), { title: "ev2", by: "E2", ownerId: "E2", owner: "E2", date: "2026-08-02", createdAt: 2000, src: "nativebeta" });
  });

  const e1 = authed(env, "E1");

  await t(39, "membro ATIVO lê evento → ALLOW", () => assertSucceeds(getDoc(doc(e1, "events/EV1"))));
  await t(40, "membro ATIVO lê evento de OUTRO → ALLOW (agenda de equipe; events sem participants; divergência documentada)", () => assertSucceeds(getDoc(doc(e1, "events/EV2"))));
  await t(41, "cria evento com by==uid → ALLOW", () => assertSucceeds(setDoc(doc(e1, "events/EV_NEW"), { title: "n", by: "E1", ownerId: "E1", date: "2026-08-03", createdAt: 5, src: "webpreview" })));
  await t(42, "altera ownerId (responsável) → DENY (imutável)", () => assertFails(updateDoc(doc(e1, "events/EV1"), { ownerId: "E2" })));
  await t(43, "altera CRIADOR (by) → DENY (imutável)", () => assertFails(updateDoc(doc(e1, "events/EV1"), { by: "E2" })));
  await t(44, "exclui evento SEM ser criador/responsável → DENY", () => assertFails(deleteDoc(doc(e1, "events/EV2"))));
  await t(45, "altera createdAt (imutável) → DENY", () => assertFails(updateDoc(doc(e1, "events/EV1"), { createdAt: 9 })));
  await t(46, "membro ATIVO lista events → ALLOW (equipe compartilhada; divergência vs 'listar alheios = deny')", () => assertSucceeds(getDocs(collection(e1, "events"))));

  return summary();
}
