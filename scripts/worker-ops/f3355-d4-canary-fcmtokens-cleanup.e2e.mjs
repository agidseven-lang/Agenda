/* ID Seven — F3.3.55-D4 — LIMPEZA CONTROLADA dos fcmTokens do usuario CANARIO.
 *
 * DOIS MODOS (molde: f3321-b341a-canary-password-reset.e2e.mjs):
 *   (1) DRY-RUN / PREP (PADRAO): valida alvo (== canario) + escopo (1 usuario) e
 *       prova que NENHUMA escrita ocorre. NAO conecta no Firestore, NAO usa
 *       credencial, NAO importa firebase-admin, NAO imprime token/segredo.
 *       Emite PREP_READY ou PREP_BLOCKED.
 *   (2) APPLY (fase posterior, autorizada): com DRY_RUN=false E ALLOW_APPLY_CLEANUP=true
 *       E CONFIRM_CLEANUP correto E alvo canario E FIREBASE_SERVICE_ACCOUNT presente,
 *       limpa SOMENTE fcmTokens ([]) e fcmTokenMeta ({}) do doc do canario e reporta
 *       contadores antes/depois. Faltando qualquer pre-condicao => aborta ANTES de
 *       qualquer escrita. Defaults (DRY_RUN=true, ALLOW_APPLY_CLEANUP=false, sem
 *       secret) tornam o APPLY inalcancavel.
 *
 * Seguranca: NUNCA imprime valores de fcmTokens, chaves/valores de fcmTokenMeta,
 * session token, senha, pass, salt, hash ou segredo. Reporta APENAS contadores
 * (countBefore/metaCountBefore/countAfter/metaCountAfter), booleans e e-mail
 * mascarado. NAO toca pass/salt/mustChangePassword/passwordChangedAt/status/name/
 * role/admin/photo/color/reminderMinutes/phone/email/notifPrefs nem qualquer outro
 * doc/colecao. NAO chama sendPush; NAO envia FCM/Web Push; NAO faz deploy.
 * firebase-admin so e importado (dinamicamente) dentro do caminho APPLY gated.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const lc = (v, d) => String(process.env[v] || d || "").toLowerCase();
const sv = (v, d) => String(process.env[v] || d || "");

const CONFIRM_CLEANUP  = sv("CONFIRM_CLEANUP", "");
const DRY_RUN          = lc("DRY_RUN", "true") === "true";
const TARGET_EMAIL     = sv("TARGET_EMAIL", "").trim().toLowerCase();
const MAX_USERS        = sv("MAX_USERS", "1");
const ALLOW_APPLY      = lc("ALLOW_APPLY_CLEANUP", "false") === "true";
const HOSTING_PUBLISH  = lc("HOSTING_PUBLISH", "false") === "true";
const FCM_TOKEN_SERVER = lc("FCM_TOKEN_SERVER", "false") === "true";
// Secret — fornecido SO na fase APPLY autorizada; consumido SO no caminho gated;
// NUNCA impresso. Em DRY-RUN e ignorado (apenas presenca booleana e reportada).
const SERVICE_ACCOUNT_JSON = sv("FIREBASE_SERVICE_ACCOUNT", ""); // segredo; nunca impresso
const OUT = sv("RETEST_OUT", "canary-fcmtokens-cleanup-artifacts");

const EXPECTED = { email: "teste.webpush@idseven.com.br", confirm: "CLEAR_CANARY_FCM_TOKENS", project: "agenda-id-seven" };

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3355-d4] " + m);
const maskEmail = (e) => { const s = String(e || ""); const i = s.indexOf("@"); return i > 0 ? ("***@" + s.slice(i + 1)) : (s ? "***" : ""); };
const present = (s) => (String(s || "").length > 0);

// Lookup case-insensitive ESPELHANDO o login do app (mesma funcao do molde b341a).
// `users`: array de { id, email, ref? }. Retorna os objetos que casam (preserva ref).
function matchUsersByEmailCI(users, targetLower) {
  const out = [];
  for (const u of (Array.isArray(users) ? users : [])) {
    const email = (u && typeof u.email === "string" ? u.email : "").toLowerCase();
    if (email !== "" && email === targetLower) out.push(u);
  }
  return out;
}
// Contadores de push do doc (puro/testavel; NUNCA retorna valores — so numeros).
function pushFieldCounters(d) {
  const src = (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  const count = Array.isArray(src.fcmTokens) ? src.fcmTokens.filter(Boolean).length : 0;
  const metaCount = (src.fcmTokenMeta && typeof src.fcmTokenMeta === "object" && !Array.isArray(src.fcmTokenMeta)) ? Object.keys(src.fcmTokenMeta).length : 0;
  return { count, metaCount };
}

const summary = {
  phase: "F3.3.55-D4-CANARY-FCMTOKENS-CLEANUP",
  target: "canaryFcmTokensCleanup",
  dryRun: DRY_RUN,
  executed: false,
  firestoreWriteDone: false,
  mode: null,
  result: null,
  targetEmailMasked: maskEmail(TARGET_EMAIL),
  targetIsCanary: TARGET_EMAIL === EXPECTED.email,
  maxUsers: MAX_USERS,
  scopeOneUser: MAX_USERS === "1",
  serviceAccountProvided: present(SERVICE_ACCOUNT_JSON),
  applyAuthorizedThisPhase: false,
  realWriteBlocked: true,
  // contadores (numeros; NUNCA valores de token/meta)
  countBefore: null, metaCountBefore: null, countAfter: null, metaCountAfter: null,
  // seguranca (por construcao; nada sensivel e impresso)
  noTokenPrinted: true, noMetaPrinted: true, noSecretPrinted: true, noPasswordPrinted: true,
  fieldsTouchedOnlyPush: true, otherUsersUntouched: true,
  noSendPush: true, noWebPush: true, noNotification: true, noDeploy: true, noHostingPublish: true,
};

function finish(go) {
  summary.go = go;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.55-D4 — Limpeza fcmTokens canario (controlada) =====");
  console.log("  mode=" + summary.mode + " · result=" + summary.result + " · executed=" + summary.executed +
              " · firestoreWriteDone=" + summary.firestoreWriteDone + " · realWriteBlocked=" + summary.realWriteBlocked);
  console.log("  target=" + summary.targetEmailMasked + " · targetIsCanary=" + summary.targetIsCanary + " · maxUsers=" + MAX_USERS);
  console.log("  countBefore=" + summary.countBefore + " metaCountBefore=" + summary.metaCountBefore +
              " countAfter=" + summary.countAfter + " metaCountAfter=" + summary.metaCountAfter);
  console.log("  serviceAccountProvided=" + summary.serviceAccountProvided +
              " · noTokenPrinted=true noMetaPrinted=true noSecretPrinted=true noSendPush=true noDeploy=true");
  console.log("================================================================");
  console.log("f3355-d4 canary fcmtokens cleanup: " + summary.result);
  process.exit(go ? 0 : 1);
}

// ---- Escopo / canario / travas (validas em ambos os modos) ----
function scopeGuards() {
  ok("confirm_cleanup == " + EXPECTED.confirm, CONFIRM_CLEANUP === EXPECTED.confirm);
  ok("target_email == canario (somente ele)", TARGET_EMAIL === EXPECTED.email);
  ok("max_users == 1", MAX_USERS === "1");
  ok("fcm_token_server=false (nao ativar)", FCM_TOKEN_SERVER === false);
  ok("hosting_publish=false", HOSTING_PUBLISH === false);
}

// ---- APPLY: existe apenas como codigo protegido por gate. ----
async function applyCleanup() {
  // Defesa em profundidade: aborta ANTES de qualquer conexao/escrita se faltar pre-condicao.
  if (DRY_RUN) { fail("apply com DRY_RUN=true — abortado"); return false; }
  if (!ALLOW_APPLY) { fail("allow_apply_cleanup=false — abortado"); return false; }
  if (CONFIRM_CLEANUP !== EXPECTED.confirm) { fail("confirm_cleanup invalido — abortado"); return false; }
  if (TARGET_EMAIL !== EXPECTED.email) { fail("alvo nao-canario — abortado"); return false; }
  if (MAX_USERS !== "1") { fail("escopo != 1 — abortado"); return false; }
  if (!present(SERVICE_ACCOUNT_JSON)) { fail("credencial service account ausente — abortado"); return false; }
  if (fails.length > 0) return false;

  // Conecta no Firestore SOMENTE aqui (caminho gated). firebase-admin importado tardiamente.
  let admin;
  try { admin = (await import("firebase-admin")).default; }
  catch (e) { fail("firebase-admin indisponivel (sem vazar valores): " + (e && e.name)); return false; }
  let cred;
  try { cred = JSON.parse(SERVICE_ACCOUNT_JSON); }
  catch (_) { fail("service account JSON invalido"); return false; }
  try { if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) }); }
  catch (e) { fail("init admin falhou (sem vazar valores): " + (e && e.name)); return false; }

  const db = admin.firestore();
  // Le a colecao `users` e casa o e-mail em memoria (case-insensitive), IGUAL ao molde.
  // EXATAMENTE 1 match obrigatorio: aborta se 0 ou >1. Nenhum e-mail real e impresso.
  let snap;
  try { snap = await db.collection("users").get(); }
  catch (e) { fail("consulta users falhou (sem vazar valores): " + (e && e.name)); return false; }
  const users = [];
  snap.forEach((doc) => {
    const d = (doc && typeof doc.data === "function") ? (doc.data() || {}) : {};
    users.push({ id: doc.id, email: d.email, ref: doc.ref, data: d });
  });
  const matches = matchUsersByEmailCI(users, EXPECTED.email);
  summary.canaryMatchCount = matches.length; // contagem sanitizada (numero; sem e-mails)
  if (matches.length === 0) { fail("0 usuarios (case-insensitive) com o e-mail canario — abortado"); return false; }
  if (matches.length > 1) { fail(">1 usuario (case-insensitive) com o e-mail canario — abortado (ambiguo)"); return false; }

  const userRef = matches[0].ref;
  // Contadores ANTES (numeros apenas; valores NUNCA lidos para o log).
  const before = pushFieldCounters(matches[0].data);
  summary.countBefore = before.count;
  summary.metaCountBefore = before.metaCount;

  // Escrita UNICA e minima: somente os 2 campos de push. Nenhum outro campo tocado.
  try {
    await userRef.update({ fcmTokens: [], fcmTokenMeta: {} });
  } catch (e) { fail("update falhou (sem vazar valores): " + (e && e.name)); return false; }

  // Releitura do MESMO doc para os contadores DEPOIS (esperado 0/0).
  try {
    const after = await userRef.get();
    const dAfter = (after && typeof after.data === "function") ? (after.data() || {}) : {};
    const a = pushFieldCounters(dAfter);
    summary.countAfter = a.count;
    summary.metaCountAfter = a.metaCount;
  } catch (e) { fail("releitura falhou (sem vazar valores): " + (e && e.name)); return false; }
  if (summary.countAfter !== 0 || summary.metaCountAfter !== 0) { fail("contadores pos-limpeza != 0 — investigar"); return false; }

  summary.executed = true;
  summary.firestoreWriteDone = true;
  summary.realWriteBlocked = false;
  summary.updatedDoc = "users/***"; // id do doc nunca impresso
  return true;
}

function runPrep() {
  summary.mode = "PREP";
  scopeGuards();
  // dry_run=false SEM allow_apply_cleanup=true e bloqueio explicito (nao e PREP valido).
  if (!DRY_RUN && !ALLOW_APPLY) {
    fail("dry_run=false exige allow_apply_cleanup=true — abortado");
    summary.result = "APPLY_BLOCKED";
    return finish(false);
  }
  summary.readyForFutureApply = (fails.length === 0);
  summary.result = (fails.length === 0) ? "PREP_READY" : "PREP_BLOCKED";
  return finish(fails.length === 0);
}

async function main() {
  log("canary fcmtokens cleanup (dry_run=" + DRY_RUN + ").");
  const applyRequested = (!DRY_RUN) && ALLOW_APPLY && (CONFIRM_CLEANUP === EXPECTED.confirm);
  if (applyRequested) {
    summary.mode = "APPLY";
    scopeGuards();
    if (fails.length > 0) { summary.result = "APPLY_BLOCKED"; return finish(false); }
    summary.applyAuthorizedThisPhase = true;
    const done = await applyCleanup();
    if (!done) { summary.result = "APPLY_BLOCKED"; return finish(false); }
    summary.result = "APPLY_DONE";
    return finish(true);
  }
  // DRY-RUN / PREP: nenhuma conexao, nenhuma escrita.
  return runPrep();
}

// Exporta helpers puros p/ teste local (sem firebase-admin).
export { matchUsersByEmailCI, pushFieldCounters };

// Executa main() SOMENTE quando rodado diretamente (node runner.mjs).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
