// =====================================================================
// F3.3.70D3R8 — Desambiguacao MINIMA da colisao de e-mail em /users.
// Muda EXATAMENTE 1 campo (email) de EXATAMENTE 1 doc (o obsoleto ...x3QHw3).
// DRY-RUN por padrao. APPLY exige CONFIRM exato. Rollback embutido (mode).
// NUNCA imprime pass/salt/hash/codeHash/fcmTokens/telefone completo.
// Logica pura injetavel (db) => testavel offline (mesmo padrao T1/B3.41).
// =====================================================================
export const TARGET_EMAIL = "idseven@idseven.com.br";
export const ARCHIVED_EMAIL = "idseven+dup-QHw3@idseven.com.br";
export const OBSOLETE_LAST6 = "x3QHw3";
export const CANONICAL_LAST6 = "vXV0lG";
export const CONFIRM_TOKEN_APPLY = "APPLY_USERS_EMAIL_DISAMBIGUATION_X3QHW3";
export const CONFIRM_TOKEN_ROLLBACK = "ROLLBACK_USERS_EMAIL_DISAMBIGUATION_X3QHW3";

const digits = (s) => (typeof s === "string" ? s.replace(/\D/g, "") : "");
const last6 = (id) => "..." + String(id).slice(-6);

// Predicado IDENTICO ao handleLoginUser (email lower OU phone digits).
export function loginMatches(users, identifier) {
  const idLower = String(identifier).trim().toLowerCase();
  const idDigits = digits(String(identifier).trim());
  return users.filter(({ d }) => {
    const email = (typeof d.email === "string" ? d.email : "").toLowerCase();
    const phone = digits(typeof d.phone === "string" ? d.phone : "");
    return (email && email === idLower) || (idDigits && phone && phone === idDigits);
  });
}

function snapshotSafe(d) {
  // Snapshot EM MEMORIA para comparacao byte-a-byte pos-apply (nunca impresso).
  return JSON.stringify(Object.entries(d).sort(([a], [b]) => (a < b ? -1 : 1)));
}
function fieldNames(d) { return Object.keys(d).sort().join(","); }

export async function runDisambiguation({ db, mode = "apply", dryRun = true, confirm = "", log = console.log }) {
  const fail = (code, msg) => { log(`GATE FAIL ${code}: ${msg}`); return { ok: false, code }; };
  if (mode !== "apply" && mode !== "rollback") return fail("G0", `mode invalido: ${mode}`);
  const FROM = mode === "apply" ? TARGET_EMAIL : ARCHIVED_EMAIL;
  const TO = mode === "apply" ? ARCHIVED_EMAIL : TARGET_EMAIL;

  // --- Leitura completa de /users (mesma base do loginUser) ---
  const usersSnap = await db.collection("users").get();
  const users = usersSnap.docs.map((doc) => ({ id: doc.id, d: doc.data() || {}, ref: doc.ref }));
  log(`[gate] /users total=${users.length}`);

  // G1: matches EXATOS do email real (estado pre-apply esperado: 2 | rollback: 1)
  const exactTarget = users.filter((u) => u.d.email === TARGET_EMAIL);
  const exactArchived = users.filter((u) => u.d.email === ARCHIVED_EMAIL);
  log(`[gate] exatos email-real=${exactTarget.length} email-arquivado=${exactArchived.length}`);
  if (mode === "apply" && exactTarget.length !== 2) return fail("G1", `esperado 2 docs com email real; encontrado ${exactTarget.length}`);
  if (mode === "rollback" && (exactTarget.length !== 1 || exactArchived.length !== 1)) return fail("G1R", `rollback espera 1+1; encontrado ${exactTarget.length}+${exactArchived.length}`);

  // G2: logica do loginUser deve enxergar o MESMO conjunto (ramo telefone inerte p/ alvo sem digitos)
  const lm = loginMatches(users, TARGET_EMAIL);
  log(`[gate] loginUser-logica matches=${lm.length} ramoTelefoneAtivo=${digits(TARGET_EMAIL) ? "SIM" : "NAO"}`);
  if (mode === "apply" && lm.length !== 2) return fail("G2", `loginUser-logica esperava 2; encontrou ${lm.length}`);

  // G3: identificar canonic0/obsoleto pelos sufixos PINADOS
  const pool = mode === "apply" ? exactTarget : [...exactTarget, ...exactArchived];
  const canonical = pool.find((u) => u.id.endsWith(CANONICAL_LAST6));
  const obsolete = pool.find((u) => u.id.endsWith(OBSOLETE_LAST6));
  if (!canonical || !obsolete) return fail("G3", `sufixos pinados nao encontrados (canonico=${!!canonical} obsoleto=${!!obsolete})`);
  log(`[gate] canonico=${last6(canonical.id)} obsoleto=${last6(obsolete.id)}`);

  // G4/G5: perfis compativeis (sem imprimir nada alem de flags)
  const obsSt = String(obsolete.d.status || ""); const canSt = String(canonical.d.status || "");
  log(`[gate] canonico status=${canSt} admin=${canonical.d.admin === true} | obsoleto status=${obsSt} admin=${obsolete.d.admin === true}`);
  if (canonical.d.admin !== true || canSt !== "ativo") return fail("G5", "canonico nao esta ativo/admin");
  if (obsolete.d.admin === true) return fail("G4", "obsoleto marcado admin=true — abortar");
  if (mode === "apply" && obsSt === "ativo") return fail("G4b", "obsoleto com status ativo — perfil incompativel com duplicata; abortar");

  // G6: valor atual do campo email do obsoleto e exatamente o esperado
  if (obsolete.d.email !== FROM) return fail("G6", `email atual do obsoleto nao e o esperado para mode=${mode}`);
  // G7: apply => destino inedito (0 donos); rollback => destino e o email real,
  // que DEVE existir exatamente no canonico (recriar a colisao e o objetivo do rollback).
  const destOwners = users.filter((u) => u.d.email === TO && u.id !== obsolete.id);
  const expDest = mode === "apply" ? 0 : 1;
  if (destOwners.length !== expDest) return fail("G7", `email destino com ${destOwners.length} dono(s); esperado ${expDest} para mode=${mode}`);
  if (mode === "rollback" && destOwners[0].id !== canonical.id) return fail("G7R", "email real pertence a doc inesperado");

  // G8 (INFO): alvo do reset mais recente => classifica Cenario 1/2 (nao bloqueia)
  let cenario = "INDETERMINADO";
  try {
    const codes = await db.collection("passwordResetCodes").get();
    let best = null;
    for (const doc of codes.docs) {
      const d = doc.data() || {}; const ca = Number(d.createdAt || 0);
      if (!best || ca > best.ca) best = { ca, userId: String(d.userId || "") };
    }
    if (best) {
      const hitCan = best.userId === canonical.id, hitObs = best.userId === obsolete.id;
      cenario = hitCan ? "CENARIO-1 (reset caiu no canonico)" : hitObs ? "CENARIO-2 (reset caiu no obsoleto; D3R9 precisara de novo reset)" : "CENARIO-? (reset aponta outro doc)";
      log(`[gate] resetCode+recente userId=${last6(best.userId)} => ${cenario}`);
    } else log("[gate] passwordResetCodes vazio");
  } catch (e) { log(`[gate] leitura passwordResetCodes indisponivel (${e && e.message ? "erro mascarado" : "erro"}) — segue sem classificar`); }

  // G9: snapshots pre-apply (em memoria) p/ prova de mutacao minima
  const beforeObs = snapshotSafe(obsolete.d); const beforeCan = snapshotSafe(canonical.d);
  log(`[gate] obsoleto campos=[${fieldNames(obsolete.d)}]`);
  log("GATE PASS G1..G9");

  if (dryRun) { log(`DRY-RUN (default): nenhuma escrita. Operacao planejada: update ${last6(obsolete.id)}.email -> "${TO}"`); return { ok: true, dryRun: true, cenario }; }
  const NEED_CONFIRM = mode === "apply" ? CONFIRM_TOKEN_APPLY : CONFIRM_TOKEN_ROLLBACK;
  if (confirm !== NEED_CONFIRM) { log(`${mode.toUpperCase()} RECUSADO: confirm invalido para mode=${mode} (nenhuma escrita).`); return { ok: false, code: "CONFIRM" }; }

  // ===== APPLY: update de CAMPO UNICO =====
  await obsolete.ref.update({ email: TO });
  log(`APPLY OK: ${last6(obsolete.id)}.email atualizado ("${FROM}" -> "${TO}")`);

  // ===== POSTCHECK (releitura completa) =====
  const afterSnap = await db.collection("users").get();
  const after = afterSnap.docs.map((doc) => ({ id: doc.id, d: doc.data() || {}, ref: doc.ref }));
  const aTarget = after.filter((u) => u.d.email === TARGET_EMAIL);
  const aArchived = after.filter((u) => u.d.email === ARCHIVED_EMAIL);
  const aLm = loginMatches(after, TARGET_EMAIL);
  const aObs = after.find((u) => u.id === obsolete.id);
  const aCan = after.find((u) => u.id === canonical.id);
  const expTarget = mode === "apply" ? 1 : 2, expArch = mode === "apply" ? 1 : 0;
  log(`[postcheck] email-real=${aTarget.length} (esperado ${expTarget}) email-arquivado=${aArchived.length} (esperado ${expArch}) loginUser-logica=${aLm.length}`);
  const okCounts = aTarget.length === expTarget && aArchived.length === expArch && aLm.length === expTarget;
  const okUnique = mode === "rollback" || (aTarget[0] && aTarget[0].id === canonical.id && aLm[0] && aLm[0].id === canonical.id);
  const okObsExists = !!aObs;
  const expObs = JSON.parse(beforeObs).map(([k, v]) => (k === "email" ? [k, TO] : [k, v]));
  const okObsMinimal = aObs && snapshotSafe(aObs.d) === JSON.stringify(expObs);
  const okCanIntact = aCan && snapshotSafe(aCan.d) === beforeCan;
  log(`[postcheck] matchUnicoEhCanonico=${okUnique} obsoletoPreservado=${okObsExists} mutacaoMinimaSoEmail=${!!okObsMinimal} canonicoIntacto=${!!okCanIntact}`);
  if (okCounts && okUnique && okObsExists && okObsMinimal && okCanIntact) { log("POSTCHECK OK"); log("RESULT: PASS"); return { ok: true, cenario }; }
  log("POSTCHECK FALHOU — avaliar rollback (mode=rollback restaura o email original)."); return { ok: false, code: "POSTCHECK", cenario };
}

// ---- main real (CI): firebase-admin com GOOGLE_APPLICATION_CREDENTIALS ----
const { pathToFileURL } = await import("node:url");
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { default: admin } = await import("firebase-admin");
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "agenda-id-seven" });
  const out = await runDisambiguation({
    db: admin.firestore(),
    mode: process.env.MODE || "apply",
    dryRun: String(process.env.DRY_RUN || "true") !== "false",
    confirm: process.env.CONFIRM || "",
  });
  process.exit(out.ok ? 0 : 1);
}
