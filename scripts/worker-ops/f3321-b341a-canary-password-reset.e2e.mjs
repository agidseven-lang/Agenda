/* ID Seven — F3.3.21-B3.41 — Reset CONTROLADO da senha do usuario CANARIO.
 *
 * DOIS MODOS:
 *   (1) DRY-RUN / PREP (PADRAO): valida alvo (== canario) + escopo (1 usuario) e
 *       prova que NENHUMA escrita ocorre. NAO conecta no Firestore, NAO usa
 *       credencial, NAO importa firebase-admin, NAO imprime senha/hash/salt/segredo.
 *       Emite PREP_READY ou PREP_BLOCKED.
 *   (2) APPLY (fase posterior, autorizada): com DRY_RUN=false E ALLOW_APPLY_RESET=true
 *       E CONFIRM_RESET correto E alvo canario E CANARY_NEW_PASSWORD (secret) presente
 *       E FIREBASE_SERVICE_ACCOUNT (secret) presente, reseta SOMENTE o doc do canario,
 *       gravando pass/salt no MESMO formato do app. **NAO e executado nesta fase.**
 *       Faltando qualquer pre-condicao => aborta ANTES de qualquer escrita. Os defaults
 *       (DRY_RUN=true, ALLOW_APPLY_RESET=false, sem secrets) tornam o APPLY inalcancavel.
 *
 * Seguranca: NUNCA imprime senha, pass/hash, salt, session token ou segredo. Reporta
 * apenas presenca booleana e e-mail mascarado. firebase-admin so e importado
 * (dinamicamente) dentro do caminho APPLY. Hashing identico a
 * app/main:functions/index.js (sha256Hex/hashPw/randSalt).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const lc = (v, d) => String(process.env[v] || d || "").toLowerCase();
const sv = (v, d) => String(process.env[v] || d || "");

const CONFIRM_RESET    = sv("CONFIRM_RESET", "");
const DRY_RUN          = lc("DRY_RUN", "true") === "true";
const TARGET_EMAIL     = sv("TARGET_EMAIL", "").trim().toLowerCase();
const MAX_USERS        = sv("MAX_USERS", "1");
const ALLOW_APPLY      = lc("ALLOW_APPLY_RESET", "false") === "true";
const MUST_CHANGE      = lc("MUST_CHANGE_PASSWORD", "true") === "true";
const HOSTING_PUBLISH  = lc("HOSTING_PUBLISH", "false") === "true";
const FCM_TOKEN_SERVER = lc("FCM_TOKEN_SERVER", "false") === "true";
// Secrets — fornecidos SO na fase APPLY autorizada; consumidos SO no caminho gated;
// NUNCA impressos. Em DRY-RUN sao ignorados (apenas presenca booleana e reportada).
const CANARY_NEW_PASSWORD  = sv("CANARY_NEW_PASSWORD", "");   // nunca impresso
const SERVICE_ACCOUNT_JSON = sv("FIREBASE_SERVICE_ACCOUNT", ""); // segredo; nunca impresso
const OUT = sv("RETEST_OUT", "canary-password-reset-artifacts");

const EXPECTED = { email: "teste.webpush@idseven.com.br", confirm: "RESET_CANARY_PASSWORD" };
const MIN_PW_LEN = 6; // mesma politica do app (confirmPasswordReset)

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b341] " + m);
const maskEmail = (e) => { const s = String(e || ""); const i = s.indexOf("@"); return i > 0 ? ("***@" + s.slice(i + 1)) : (s ? "***" : ""); };
// Tokens/segredos/senha NUNCA sao impressos: reportamos apenas presenca booleana.
const present = (s) => (String(s || "").length > 0);

// Hashing IDENTICO ao app (app/main:functions/index.js linhas 322-324).
function sha256Hex(s) { return crypto.createHash("sha256").update(s, "utf8").digest("hex"); }
function hashPw(pw, salt) { return "s2:" + sha256Hex(`${salt}|${pw}`); }
function randSalt() { return crypto.randomBytes(16).toString("hex"); }
// Lookup case-insensitive ESPELHANDO o login do app (handleLoginUser): compara o campo
// `email` de cada doc, normalizado para minusculas, com o alvo (ja minusculo). A query
// exata where("email","==",...) do Firestore e case-sensitive e pode retornar 0 mesmo
// com o usuario existente (capitalizacao diferente) — por isso casamos em memoria.
// `users`: array de { id, email, ref? }. Retorna os objetos que casam (preserva ref).
function matchUsersByEmailCI(users, targetLower) {
  const out = [];
  for (const u of (Array.isArray(users) ? users : [])) {
    const email = (u && typeof u.email === "string" ? u.email : "").toLowerCase();
    if (email !== "" && email === targetLower) out.push(u);
  }
  return out;
}

const summary = {
  phase: "F3.3.21-B3.41-CANARY-PASSWORD-RESET",
  target: "canaryPasswordReset",
  dryRun: DRY_RUN,
  executed: false,
  firestoreWriteDone: false,
  mode: null,
  result: null,
  // alvo (e-mail mascarado; nunca o local-part)
  targetEmailMasked: maskEmail(TARGET_EMAIL),
  targetIsCanary: TARGET_EMAIL === EXPECTED.email,
  maxUsers: MAX_USERS,
  scopeOneUser: MAX_USERS === "1",
  mustChangePassword: MUST_CHANGE,
  // presenca (NUNCA valores) de senha/credencial e conformidade de politica (booleano)
  newPasswordProvided: present(CANARY_NEW_PASSWORD),
  newPasswordMeetsPolicy: String(CANARY_NEW_PASSWORD || "").length >= MIN_PW_LEN,
  serviceAccountProvided: present(SERVICE_ACCOUNT_JSON),
  // status
  applyAuthorizedThisPhase: false,
  realWriteBlocked: true,
  // seguranca (por construcao; nada sensivel e impresso)
  noPasswordPrinted: true, noHashPrinted: true, noSaltPrinted: true, noSecretPrinted: true,
  otherUsersUntouched: true, noWebPush: true, noNotification: true, noDeploy: true, noHostingPublish: true,
};

function finish(go) {
  summary.go = go;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.41 — Reset senha canario (controlado) =====");
  console.log("  mode=" + summary.mode + " · result=" + summary.result + " · executed=" + summary.executed +
              " · firestoreWriteDone=" + summary.firestoreWriteDone + " · realWriteBlocked=" + summary.realWriteBlocked);
  console.log("  target=" + summary.targetEmailMasked + " · targetIsCanary=" + summary.targetIsCanary + " · maxUsers=" + MAX_USERS);
  console.log("  newPasswordProvided=" + summary.newPasswordProvided + " · serviceAccountProvided=" + summary.serviceAccountProvided +
              " · noPasswordPrinted=true noHashPrinted=true noSaltPrinted=true noSecretPrinted=true noDeploy=true");
  console.log("============================================================");
  console.log("f3321-b341 canary password reset: " + summary.result);
  process.exit(go ? 0 : 1);
}

// ---- Escopo / canario / travas (validas em ambos os modos) ----
function scopeGuards() {
  ok("confirm_reset == " + EXPECTED.confirm, CONFIRM_RESET === EXPECTED.confirm);
  ok("target_email == canario (somente ele)", TARGET_EMAIL === EXPECTED.email);
  ok("max_users == 1", MAX_USERS === "1");
  ok("fcm_token_server=false (nao ativar)", FCM_TOKEN_SERVER === false);
  ok("hosting_publish=false", HOSTING_PUBLISH === false);
}

// ---- APPLY: existe apenas como codigo protegido por gate. NAO executado nesta fase. ----
async function applyReset() {
  // Defesa em profundidade: aborta ANTES de qualquer conexao/escrita se faltar pre-condicao.
  if (DRY_RUN) { fail("apply com DRY_RUN=true — abortado"); return false; }
  if (!ALLOW_APPLY) { fail("allow_apply_reset=false — abortado"); return false; }
  if (CONFIRM_RESET !== EXPECTED.confirm) { fail("confirm_reset invalido — abortado"); return false; }
  if (TARGET_EMAIL !== EXPECTED.email) { fail("alvo nao-canario — abortado"); return false; }
  if (MAX_USERS !== "1") { fail("escopo != 1 — abortado"); return false; }
  if (!present(CANARY_NEW_PASSWORD)) { fail("CANARY_NEW_PASSWORD ausente — abortado"); return false; }
  if (String(CANARY_NEW_PASSWORD).length < MIN_PW_LEN) { fail("nova senha < " + MIN_PW_LEN + " caracteres — abortado"); return false; }
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
  // Le a colecao `users` e casa o e-mail em memoria (case-insensitive), IGUAL ao login
  // (handleLoginUser). Robusto a capitalizacao do campo `email` no doc. EXATAMENTE 1
  // match obrigatorio: aborta se 0 ou >1. Nenhum e-mail real e impresso (so contagem).
  let snap;
  try { snap = await db.collection("users").get(); }
  catch (e) { fail("consulta users falhou (sem vazar valores): " + (e && e.name)); return false; }
  const users = [];
  snap.forEach((doc) => {
    const d = (doc && typeof doc.data === "function") ? (doc.data() || {}) : {};
    users.push({ id: doc.id, email: d.email, ref: doc.ref });
  });
  const matches = matchUsersByEmailCI(users, EXPECTED.email); // EXPECTED.email ja e minusculo
  summary.canaryMatchCount = matches.length; // contagem sanitizada (numero; sem e-mails)
  if (matches.length === 0) { fail("0 usuarios (case-insensitive) com o e-mail canario — abortado"); return false; }
  if (matches.length > 1) { fail(">1 usuario (case-insensitive) com o e-mail canario — abortado (ambiguo)"); return false; }

  const userRef = matches[0].ref;
  // pass/salt no MESMO formato do app. Valores NUNCA impressos.
  const salt = randSalt();
  const pass = hashPw(CANARY_NEW_PASSWORD, salt);
  try {
    await userRef.update({ pass, salt, mustChangePassword: MUST_CHANGE, passwordChangedAt: Date.now() });
  } catch (e) { fail("update falhou (sem vazar valores): " + (e && e.name)); return false; }

  summary.executed = true;
  summary.firestoreWriteDone = true;
  summary.realWriteBlocked = false;
  summary.updatedDoc = "users/***"; // id do doc nunca impresso
  return true;
}

function runPrep() {
  summary.mode = "PREP";
  scopeGuards();
  summary.readyForFutureApply = (fails.length === 0);
  summary.result = (fails.length === 0) ? "PREP_READY" : "PREP_BLOCKED";
  return finish(fails.length === 0);
}

async function main() {
  log("canary password reset (dry_run=" + DRY_RUN + "). APPLY NAO autorizado nesta fase.");
  const applyRequested = (!DRY_RUN) && ALLOW_APPLY && (CONFIRM_RESET === EXPECTED.confirm);
  if (!applyRequested) {
    // DRY-RUN / PREP: nenhuma conexao, nenhuma escrita. (Inclui allow_apply_reset=true sem dry_run=false.)
    return runPrep();
  }
  // ---- Abaixo: somente fase posterior autorizada. Mantido protegido por gate. ----
  summary.mode = "APPLY";
  scopeGuards();
  if (fails.length > 0) { summary.result = "APPLY_BLOCKED"; return finish(false); }
  summary.applyAuthorizedThisPhase = true;
  const done = await applyReset();
  if (!done) { summary.result = "APPLY_BLOCKED"; return finish(false); }
  summary.result = "APPLY_DONE";
  return finish(true);
}

// Exporta o matcher para teste local (case-insensitive). Espelha o login do app.
export { matchUsersByEmailCI };

// Executa main() SOMENTE quando rodado diretamente (node runner.mjs). Quando importado
// por um teste, main() NAO roda — permite testar matchUsersByEmailCI sem firebase-admin.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
