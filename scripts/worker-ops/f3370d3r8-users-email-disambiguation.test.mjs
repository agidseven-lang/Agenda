// Teste offline do runner de desambiguacao (FakeDb; ZERO rede/producao).
import { runDisambiguation, TARGET_EMAIL, ARCHIVED_EMAIL, CONFIRM_TOKEN_APPLY, CONFIRM_TOKEN_ROLLBACK, loginMatches } from "./f3370d3r8-users-email-disambiguation.e2e.mjs";

const CAN_ID = "AAAAAAAAAAAAAAvXV0lG", OBS_ID = "ZZZZZZZZZZZZZZx3QHw3";
function baseDocs() {
  return {
    [CAN_ID]: { name: "Owner Real", email: TARGET_EMAIL, phone: "+55 88 91234-5678", status: "ativo", admin: true, role: "CEO", pass: "NUNCA_PASS_XYZ", salt: "NUNCA_SALT_XYZ", passwordChangedAt: 1751900000000, fcmTokens: ["NUNCA_FCM_XYZ"] },
    [OBS_ID]: { name: "Owner Real", email: TARGET_EMAIL, status: "pendente", admin: false, role: "ceo", pass: "NUNCA_PASS2_XYZ" },
    outro1: { name: "Outra Pessoa", email: "outra@x.com", phone: "+55 88 90000-0000", status: "ativo", admin: false, pass: "NUNCA_PASS3_XYZ", salt: "s" },
  };
}
function fakeDb(docs, codes, onUpdate) {
  const mk = (coll, store) => ({
    get: async () => ({ docs: Object.keys(store).map((id) => ({ id, data: () => ({ ...store[id] }), ref: { update: async (patch) => { if (onUpdate) onUpdate(coll, id, patch); Object.assign(store[id], patch); } } })) }),
  });
  return { collection: (n) => (n === "users" ? mk("users", docs) : mk("passwordResetCodes", codes)) };
}
const CODES = { c1: { userId: CAN_ID, createdAt: 1751900000000 }, c0: { userId: OBS_ID, createdAt: 1000 } };

let n = 0, pass = 0;
async function t(name, fn) { n++; try { await fn(); pass++; console.log(`TEST ${n} PASS — ${name}`); } catch (e) { console.log(`TEST ${n} FAIL — ${name}: ${e.message}`); } }
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };

await t("dry-run: gate passa, ZERO escrita", async () => {
  const ups = []; const db = fakeDb(baseDocs(), CODES, (...a) => ups.push(a));
  const out = await runDisambiguation({ db, dryRun: true, log: () => {} });
  eq(out.ok, true, "ok"); eq(out.dryRun, true, "dryRun"); eq(ups.length, 0, "escritas");
});
await t("apply: update unico {email} no obsoleto + postcheck PASS + cenario 1", async () => {
  const ups = []; const docs = baseDocs(); const logs = [];
  const out = await runDisambiguation({ db: fakeDb(docs, CODES, (...a) => ups.push(a)), dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: (m) => logs.push(m) });
  eq(out.ok, true, "ok"); eq(ups.length, 1, "1 escrita"); eq(ups[0][1], OBS_ID, "doc certo");
  eq(JSON.stringify(ups[0][2]), JSON.stringify({ email: ARCHIVED_EMAIL }), "patch campo unico");
  eq(docs[OBS_ID].email, ARCHIVED_EMAIL, "email trocado"); eq(docs[CAN_ID].email, TARGET_EMAIL, "canonico intacto");
  eq(logs.some((l) => l.includes("POSTCHECK OK")), true, "postcheck"); eq(out.cenario.includes("CENARIO-1"), true, "cenario");
});
await t("gate G1: 1 match apenas => abort sem escrita", async () => {
  const docs = baseDocs(); docs[OBS_ID].email = "ja-arquivado@x.com";
  const ups = []; const out = await runDisambiguation({ db: fakeDb(docs, CODES, (...a) => ups.push(a)), dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "G1", "code"); eq(ups.length, 0, "escritas");
});
await t("gate G1: 3 matches => abort", async () => {
  const docs = baseDocs(); docs.extra = { email: TARGET_EMAIL, status: "ativo", admin: false };
  const out = await runDisambiguation({ db: fakeDb(docs, CODES), dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "G1", "code");
});
await t("gate G4: obsoleto admin=true => abort", async () => {
  const docs = baseDocs(); docs[OBS_ID].admin = true;
  const out = await runDisambiguation({ db: fakeDb(docs, CODES), dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "G4", "code");
});
await t("gate G4b: obsoleto status ativo => abort", async () => {
  const docs = baseDocs(); docs[OBS_ID].status = "ativo";
  const out = await runDisambiguation({ db: fakeDb(docs, CODES), dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "G4b", "code");
});
await t("gate G7: email destino ja existe em outro doc => abort", async () => {
  const docs = baseDocs(); docs.outro1.email = ARCHIVED_EMAIL;
  const out = await runDisambiguation({ db: fakeDb(docs, CODES), dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "G7", "code");
});
await t("confirm errado => recusa APPLY sem escrita", async () => {
  const ups = []; const out = await runDisambiguation({ db: fakeDb(baseDocs(), CODES, (...a) => ups.push(a)), dryRun: false, confirm: "ERRADO", log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "CONFIRM", "code"); eq(ups.length, 0, "escritas");
});
await t("rollback: restaura email original", async () => {
  const docs = baseDocs(); docs[OBS_ID].email = ARCHIVED_EMAIL; const ups = [];
  const out = await runDisambiguation({ db: fakeDb(docs, CODES, (...a) => ups.push(a)), mode: "rollback", dryRun: false, confirm: CONFIRM_TOKEN_ROLLBACK, log: () => {} });
  eq(out.ok, true, "ok"); eq(docs[OBS_ID].email, TARGET_EMAIL, "restaurado"); eq(ups.length, 1, "1 escrita");
});
await t("postcheck detecta mutacao alem do email (drift) => FAIL", async () => {
  const docs = baseDocs();
  const db = fakeDb(docs, CODES, (coll, id, patch) => { if (id === OBS_ID) docs[OBS_ID].role = "ADULTERADO"; });
  const out = await runDisambiguation({ db, dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "POSTCHECK", "code");
});
await t("anti-vazamento: logs nunca contem pass/salt/fcm/telefone", async () => {
  const logs = []; const docs = baseDocs();
  await runDisambiguation({ db: fakeDb(docs, CODES), dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: (m) => logs.push(String(m)) });
  const all = logs.join("\n");
  for (const bad of ["NUNCA_PASS", "NUNCA_SALT", "NUNCA_FCM", "912345678", "91234-5678"]) {
    if (all.includes(bad)) throw new Error("VAZOU: " + bad);
  }
});
await t("loginMatches espelha produção (ramo telefone)", async () => {
  const users = Object.entries(baseDocs()).map(([id, d]) => ({ id, d }));
  eq(loginMatches(users, TARGET_EMAIL).length, 2, "email 2x");
  eq(loginMatches(users, "+55 88 91234-5678").length, 1, "phone 1x");
  eq(loginMatches(users, "IDSEVEN@IDSEVEN.COM.BR").length, 2, "case-insensitive");
});
await t("rollback com token de APPLY => recusa sem escrita", async () => {
  const docs = baseDocs(); docs[OBS_ID].email = ARCHIVED_EMAIL; const ups = [];
  const out = await runDisambiguation({ db: fakeDb(docs, CODES, (...a) => ups.push(a)), mode: "rollback", dryRun: false, confirm: CONFIRM_TOKEN_APPLY, log: () => {} });
  eq(out.ok, false, "ok"); eq(out.code, "CONFIRM", "code"); eq(ups.length, 0, "escritas");
});
console.log(`\nRESULTADO: ${pass}/${n} PASS${pass === n ? " — SUITE OK" : " — HA FALHAS"}`);
process.exit(pass === n ? 0 : 1);
