// =====================================================================
// F4.3C3 — SUÍTE 8: IDENTIDADES F4.3C2 (sintéticas). Espelha o fluxo real:
// login -> sessão -> Custom Token -> request.auth.uid. As Rules dependem de
// request.auth.uid E do estado ATIVO do usuário (get() em users). Sem confiar
// em uid/campos enviados pelo cliente.
//
// NOTA: sessionVersion NÃO existe no backend canônico e NÃO é visível às Rules
// (é claim de token). A revogação FINA por sessionVersion é server-side (F4.3C2).
// As Rules bloqueiam por STATUS/disabled (usuário desativado/excluído perde acesso
// mesmo com token válido) — a ponte de revogação disponível na camada de Rules.
// =====================================================================
import { doc, getDoc, setDoc } from "firebase/firestore";
import { authed, seed, assertFails, assertSucceeds, makeReporter } from "./_harness.mjs";

export async function run(env) {
  const { t, summary } = makeReporter("08-f43c2-identidades");

  await seed(env, async (db) => {
    await setDoc(doc(db, "users/ATIVO"),    { name: "A", role: "designer", status: "ativo" });
    await setDoc(doc(db, "users/DISABLED"), { name: "D", role: "designer", status: "ativo", disabled: true });
    await setDoc(doc(db, "users/INATIVO"),  { name: "I", role: "designer", status: "inativo" });
    await setDoc(doc(db, "users/EXCLUIDO"), { name: "E", role: "designer", status: "excluido" });
    await setDoc(doc(db, "users/GESTOR"),   { name: "G", role: "gestor", status: "ativo" });   // role != designer, ativo
    await setDoc(doc(db, "usersPublic/ATIVO"), { id: "ATIVO", name: "A", role: "designer", admin: false, status: "ativo" });
  });

  await t("I1", "usuário ATIVO cria própria task (by==uid) → ALLOW", () =>
    assertSucceeds(setDoc(doc(authed(env, "ATIVO"), "tasks/IT1"), { title: "t", by: "ATIVO", status: "afazer", createdAt: 1, src: "nativebeta" })));
  await t("I2", "usuário DESATIVADO (disabled=true), token válido → DENY (revogação por estado)", () =>
    assertFails(setDoc(doc(authed(env, "DISABLED"), "tasks/IT2"), { title: "t", by: "DISABLED", status: "afazer" })));
  await t("I3", "usuário INATIVO (status=inativo) → DENY", () =>
    assertFails(setDoc(doc(authed(env, "INATIVO"), "tasks/IT3"), { title: "t", by: "INATIVO", status: "afazer" })));
  await t("I4", "usuário EXCLUÍDO (status=excluido) → DENY", () =>
    assertFails(getDoc(doc(authed(env, "EXCLUIDO"), "usersPublic/ATIVO"))));
  await t("I5", "usuário INEXISTENTE (autenticado, sem doc users) → DENY", () =>
    assertFails(getDoc(doc(authed(env, "FANTASMA"), "usersPublic/ATIVO"))));
  await t("I6", "uid vem SÓ de request.auth: spoof by=outro → DENY", () =>
    assertFails(setDoc(doc(authed(env, "ATIVO"), "tasks/IT6"), { title: "t", by: "GESTOR", status: "afazer" })));
  await t("I7", "sessão válida (uid casa) lê usersPublic → ALLOW", () =>
    assertSucceeds(getDoc(doc(authed(env, "ATIVO"), "usersPublic/ATIVO"))));
  await t("I8", "role alterada server-side mas ATIVO → acesso de equipe preservado (role-authz é server-side) → ALLOW", () =>
    assertSucceeds(getDoc(doc(authed(env, "GESTOR"), "usersPublic/ATIVO"))));

  return summary();
}
