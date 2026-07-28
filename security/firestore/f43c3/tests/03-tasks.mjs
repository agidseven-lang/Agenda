// =====================================================================
// F4.3C3 — SUÍTE 3: TASKS (testes 25..38). Modelo REAL = quadro de EQUIPE
// (single-tenant): membro ATIVO lê o quadro inteiro (listeners de coleção).
// DIVERGÊNCIA documentada: a suposição de "ler só tarefa própria" NÃO existe
// no código real (Desktop/Android usam onSnapshot da coleção inteira). O
// endurecimento recai sobre a ESCRITA: criador/createdAt/src/cardsBatchId
// imutáveis; status restrito aos 4 valores canônicos; sem spoof de criador;
// exclusão só por criador/responsável.
// =====================================================================
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { authed, seed, assertFails, assertSucceeds, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("03-tasks");

  await seed(env, async (db) => {
    for (const u of ["D1", "D2"]) await setDoc(doc(db, "users/" + u), { name: u, role: "designer", status: "ativo" });
    await setDoc(doc(db, "tasks/T_D1"), { title: "t1", by: "D1", assigneeId: "D1", sector: "edicao_cards", status: "afazer", designerFlowStatus: "afazer", createdAt: 1000, src: "webpreview", cardsBatchId: "B1" });
    await setDoc(doc(db, "tasks/T_D2"), { title: "t2", by: "D2", assigneeId: "D2", sector: "social", status: "andamento", createdAt: 2000, src: "nativebeta" });
  });

  const d1 = authed(env, "D1");

  await t(25, "usuário ATIVO lê tarefa → ALLOW", () => assertSucceeds(getDoc(doc(d1, "tasks/T_D1"))));
  await t(26, "usuário ATIVO lê tarefa de OUTRO → ALLOW (quadro de equipe; divergência documentada)", () => assertSucceeds(getDoc(doc(d1, "tasks/T_D2"))));
  await t(27, "Designer lê tarefa atribuída a si → ALLOW", () => assertSucceeds(getDoc(doc(d1, "tasks/T_D1"))));
  await t(28, "Designer lê tarefa de OUTRO Designer → ALLOW (equipe)", () => assertSucceeds(getDoc(doc(d1, "tasks/T_D2"))));
  await t(29, "move em transição permitida (status canônico 'andamento') → ALLOW", () => assertSucceeds(updateDoc(doc(d1, "tasks/T_D1"), { status: "andamento", designerFlowStatus: "andamento" })));
  await t(30, "status INVÁLIDO ('entregue'/'lixo') → DENY", () => assertFails(updateDoc(doc(d1, "tasks/T_D1"), { designerFlowStatus: "entregue" })));
  await t(31, "altera CRIADOR (by) → DENY (imutável)", () => assertFails(updateDoc(doc(d1, "tasks/T_D1"), { by: "D1x" })));
  await t(32, "altera createdAt → DENY (imutável)", () => assertFails(updateDoc(doc(d1, "tasks/T_D1"), { createdAt: 9999 })));
  await t(33, "altera src → DENY (imutável)", () => assertFails(updateDoc(doc(d1, "tasks/T_D1"), { src: "hack" })));
  await t(34, "altera cardsBatchId → DENY (imutável)", () => assertFails(updateDoc(doc(d1, "tasks/T_D1"), { cardsBatchId: "Bx" })));
  await t(35, "exclui tarefa SEM ser criador/responsável → DENY", () => assertFails(deleteDoc(doc(d1, "tasks/T_D2"))));
  await t(36, "exclui tarefa como CRIADOR → ALLOW", () => assertSucceeds(deleteDoc(doc(d1, "tasks/T_D1"))));
  await t(37, "cria tarefa com by==uid + status válido → ALLOW", () => assertSucceeds(setDoc(doc(d1, "tasks/T_NEW"), { title: "n", by: "D1", status: "afazer", createdAt: 5, src: "webpreview" })));
  await t(38, "cria tarefa com by de OUTRO (spoof criador) → DENY", () => assertFails(setDoc(doc(d1, "tasks/T_SPOOF"), { title: "s", by: "D2", status: "afazer" })));

  return summary();
}
