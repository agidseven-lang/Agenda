/* ID Seven — F3.3.21-B3.41 — PROVISIONAMENTO CONTROLADO do usuario CANARIO em `users`.
 *
 * Motivo: o cadastro manual pela UI nao conclui (foto obrigatoria trava) e o canario
 * NAO existe em `users` (diagnostico CANARY_NOT_FOUND_IN_USERS). Este runner cria — em
 * fase posterior autorizada — EXATAMENTE 1 doc do canario, usando o MESMO schema e o
 * MESMO algoritmo de senha do app (cadastro doReg).
 *
 * DOIS MODOS:
 *   (1) DRY-RUN / PREP (PADRAO): valida alvo (== canario) + escopo (1 usuario). NAO
 *       conecta no Firestore, NAO escreve, NAO importa firebase-admin, NAO usa secret,
 *       NAO imprime senha/hash/salt/segredo/PII. Emite PREP_READY / PREP_BLOCKED.
 *   (2) APPLY (fase posterior, autorizada): com DRY_RUN=false E ALLOW_PROVISION=true E
 *       CONFIRM_PROVISION correto E alvo canario E CANARY_NEW_PASSWORD (secret) E
 *       FIREBASE_SERVICE_ACCOUNT (secret), LE `users` (read-only) e:
 *         - ABORTA se o canario JA existir (>=1 match case-insensitive) ou duplicado;
 *         - ABORTA se o telefone ja existir (dedup, igual ao cadastro);
 *         - senao CRIA 1 doc com o schema canonico (pass/salt "s2:"+sha256(salt|senha)).
 *       **NAO e executado nesta fase.** Defaults (DRY_RUN=true, ALLOW_PROVISION=false,
 *       sem secrets) tornam o APPLY inalcancavel.
 *
 * Seguranca: NUNCA imprime senha, pass/hash, salt, segredo ou PII (sem e-mail real de
 * outros usuarios, sem doc id). Reporta apenas booleanos, contagens e e-mail canario
 * mascarado. firebase-admin so e importado dentro do APPLY. Hashing identico ao app.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const lc = (v, d) => String(process.env[v] || d || "").toLowerCase();
const sv = (v, d) => String(process.env[v] || d || "");

const CONFIRM_PROVISION = sv("CONFIRM_PROVISION", "");
const DRY_RUN           = lc("DRY_RUN", "true") === "true";
const TARGET_EMAIL      = sv("TARGET_EMAIL", "").trim().toLowerCase();
const MAX_USERS         = sv("MAX_USERS", "1");
const ALLOW_PROVISION   = lc("ALLOW_PROVISION", "false") === "true";
const CANARY_NAME       = sv("CANARY_NAME", "Teste WebPush");
const CANARY_ROLE       = sv("CANARY_ROLE", "TESTE");
const CANARY_PHONE      = sv("CANARY_PHONE", "");
const CANARY_PHOTO      = sv("CANARY_PHOTO", "");
const HOSTING_PUBLISH   = lc("HOSTING_PUBLISH", "false") === "true";
const FCM_TOKEN_SERVER  = lc("FCM_TOKEN_SERVER", "false") === "true";
// Secrets — consumidos SO no APPLY gated; NUNCA impressos. Em DRY-RUN sao ignorados.
const CANARY_NEW_PASSWORD  = sv("CANARY_NEW_PASSWORD", "");   // senha; nunca impressa
const SERVICE_ACCOUNT_JSON = sv("FIREBASE_SERVICE_ACCOUNT", ""); // segredo; nunca impresso
const OUT = sv("RETEST_OUT", "canary-provision-artifacts");

const EXPECTED = { email: "teste.webpush@idseven.com.br", confirm: "PROVISION_CANARY_USER", project: "agenda-id-seven" };
const MIN_PW_LEN = 4; // mesma politica do cadastro do app (doReg)

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b341g] " + m);
const maskEmail = (e) => { const s = String(e || ""); const i = s.indexOf("@"); return i > 0 ? ("***@" + s.slice(i + 1)) : (s ? "***" : ""); };
const present = (s) => (String(s || "").length > 0);
const digits = (s) => String(s || "").replace(/\D/g, "");

// Hashing IDENTICO ao app (cadastro doReg / functions): "s2:" + sha256(salt + "|" + senha).
function sha256Hex(s) { return crypto.createHash("sha256").update(s, "utf8").digest("hex"); }
function hashPw(pw, salt) { return "s2:" + sha256Hex(`${salt}|${pw}`); }
function randSalt() { return crypto.randomBytes(16).toString("hex"); }
// Lookup case-insensitive (espelha login/cadastro do app). `users`: array de {email,phone}.
function matchUsersByEmailCI(users, targetLower) {
  const out = [];
  for (const u of (Array.isArray(users) ? users : [])) {
    const email = (u && typeof u.email === "string" ? u.email : "").toLowerCase();
    if (email !== "" && email === targetLower) out.push(u);
  }
  return out;
}
// Monta o doc canonico do canario (schema identico ao cadastro doReg). Puro/testavel.
// pass/salt ja calculados; nenhum valor sensivel e logado por esta funcao.
function buildCanaryDoc({ email, pass, salt, name, role, phone, photo, createdAt }) {
  return {
    email: String(email || "").toLowerCase(),
    pass, salt,
    status: "ativo",
    name: name || "Teste WebPush",
    role: role || "TESTE",
    phone: String(phone || ""),
    photo: photo || "",
    admin: false,
    createdAt: createdAt,
  };
}

const summary = {
  phase: "F3.3.21-B3.41-CANARY-PROVISION",
  target: "canaryProvision",
  dryRun: DRY_RUN,
  executed: false,
  firestoreWriteDone: false,
  userCreated: false,
  mode: null,
  result: null,
  targetEmailMasked: maskEmail(TARGET_EMAIL),
  targetIsCanary: TARGET_EMAIL === EXPECTED.email,
  maxUsers: MAX_USERS,
  scopeOneUser: MAX_USERS === "1",
  // schema (rotulos nao-sensiveis; sem PII de outros usuarios)
  canaryName: CANARY_NAME,
  canaryRole: CANARY_ROLE,
  canaryPhoneProvided: present(CANARY_PHONE),
  canaryPhotoProvided: present(CANARY_PHOTO),
  // presenca (NUNCA valores) de senha/credencial
  newPasswordProvided: present(CANARY_NEW_PASSWORD),
  newPasswordMeetsPolicy: String(CANARY_NEW_PASSWORD || "").length >= MIN_PW_LEN,
  serviceAccountProvided: present(SERVICE_ACCOUNT_JSON),
  // diagnostico de pre-criacao (sanitizado)
  usersCollectionCount: null,
  canaryCaseInsensitiveMatchCount: null,
  phoneAlreadyExists: null,
  provisionBlockReason: null,
  // status
  provisionAuthorizedThisPhase: false,
  realWriteBlocked: true,
  // seguranca (por construcao; nada sensivel e impresso)
  noPasswordPrinted: true, noHashPrinted: true, noSaltPrinted: true, noSecretPrinted: true,
  noPII: true, otherUsersUntouched: true, noWebPush: true, noNotification: true,
  noDeploy: true, noHostingPublish: true,
};

function finish(go) {
  summary.go = go;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.41 — Provisionamento do canario (controlado) =====");
  console.log("  mode=" + summary.mode + " · result=" + summary.result + " · executed=" + summary.executed +
              " · firestoreWriteDone=" + summary.firestoreWriteDone + " · userCreated=" + summary.userCreated +
              " · realWriteBlocked=" + summary.realWriteBlocked);
  console.log("  target=" + summary.targetEmailMasked + " · targetIsCanary=" + summary.targetIsCanary + " · maxUsers=" + MAX_USERS +
              " · name=" + summary.canaryName + " · role=" + summary.canaryRole);
  console.log("  newPasswordProvided=" + summary.newPasswordProvided + " · serviceAccountProvided=" + summary.serviceAccountProvided +
              " · noPasswordPrinted=true noHashPrinted=true noSaltPrinted=true noSecretPrinted=true noPII=true noDeploy=true");
  if (summary.usersCollectionCount !== null) {
    console.log("  [pre] usersCount=" + summary.usersCollectionCount + " canaryCI=" + summary.canaryCaseInsensitiveMatchCount +
                " phoneExists=" + summary.phoneAlreadyExists + " blockReason=" + summary.provisionBlockReason);
  }
  console.log("==================================================================");
  console.log("f3321-b341g canary provision: " + summary.result);
  process.exit(go ? 0 : 1);
}

// ---- Escopo / canario / travas (validas em ambos os modos) ----
function scopeGuards() {
  ok("confirm_provision == " + EXPECTED.confirm, CONFIRM_PROVISION === EXPECTED.confirm);
  ok("target_email == canario (somente ele)", TARGET_EMAIL === EXPECTED.email);
  ok("max_users == 1", MAX_USERS === "1");
  ok("name presente", present(CANARY_NAME));
  ok("role presente", present(CANARY_ROLE));
  ok("phone presente (>=10 digitos)", digits(CANARY_PHONE).length >= 10);
  ok("fcm_token_server=false (nao ativar)", FCM_TOKEN_SERVER === false);
  ok("hosting_publish=false", HOSTING_PUBLISH === false);
}

// ---- APPLY: existe apenas como codigo protegido por gate. NAO executado nesta fase. ----
async function provisionCanary() {
  // Defesa em profundidade: aborta ANTES de qualquer escrita se faltar pre-condicao.
  if (DRY_RUN) { fail("provision com DRY_RUN=true — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (!ALLOW_PROVISION) { fail("allow_provision=false — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (CONFIRM_PROVISION !== EXPECTED.confirm) { fail("confirm_provision invalido — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (TARGET_EMAIL !== EXPECTED.email) { fail("alvo nao-canario — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (MAX_USERS !== "1") { fail("escopo != 1 — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (digits(CANARY_PHONE).length < 10) { fail("phone invalido (<10 digitos) — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (!present(CANARY_NEW_PASSWORD)) { fail("CANARY_NEW_PASSWORD ausente — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (String(CANARY_NEW_PASSWORD).length < MIN_PW_LEN) { fail("senha < " + MIN_PW_LEN + " caracteres — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (!present(SERVICE_ACCOUNT_JSON)) { fail("credencial service account ausente — abortado"); summary.provisionBlockReason = "GATE"; return false; }
  if (fails.length > 0) return false;

  // Conecta no Firestore SOMENTE aqui. firebase-admin importado tardiamente.
  const readFail = (n) => { fail("leitura/admin falhou (sem vazar valores): " + n); summary.provisionBlockReason = "READ_FAILED"; return false; };
  let admin;
  try { admin = (await import("firebase-admin")).default; } catch (e) { return readFail(e && e.name); }
  let cred;
  try { cred = JSON.parse(SERVICE_ACCOUNT_JSON); } catch (_) { return readFail("cred_parse"); }
  try { if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(cred) }); } catch (e) { return readFail(e && e.name); }
  const db = admin.firestore();

  // Le `users` e checa duplicidade ANTES de criar (igual ao cadastro doReg).
  let snap;
  try { snap = await db.collection("users").get(); } catch (e) { return readFail(e && e.name); }
  const users = [];
  snap.forEach((doc) => { const d = (doc && typeof doc.data === "function") ? (doc.data() || {}) : {}; users.push({ email: d.email, phone: d.phone }); });
  summary.usersCollectionCount = users.length;
  const matches = matchUsersByEmailCI(users, EXPECTED.email);
  summary.canaryCaseInsensitiveMatchCount = matches.length;
  const pd = digits(CANARY_PHONE);
  summary.phoneAlreadyExists = users.some((u) => pd && digits(u.phone) === pd);

  // ABORTA se ja existir / duplicado / telefone colidir — nunca cria duplicata.
  if (matches.length >= 1) { fail("canario JA existe em users — abortado (nao duplicar)"); summary.provisionBlockReason = (matches.length > 1) ? "ALREADY_EXISTS_DUPLICATE" : "ALREADY_EXISTS"; return false; }
  if (summary.phoneAlreadyExists) { fail("telefone ja existe em users — abortado"); summary.provisionBlockReason = "PHONE_ALREADY_EXISTS"; return false; }

  // Cria EXATAMENTE 1 doc com o schema canonico. pass/salt nunca impressos.
  const salt = randSalt();
  const pass = hashPw(CANARY_NEW_PASSWORD, salt);
  const docObj = buildCanaryDoc({ email: EXPECTED.email, pass, salt, name: CANARY_NAME, role: CANARY_ROLE, phone: CANARY_PHONE, photo: CANARY_PHOTO, createdAt: Date.now() });
  try { await db.collection("users").add(docObj); }
  catch (e) { fail("create falhou (sem vazar valores): " + (e && e.name)); summary.provisionBlockReason = "WRITE_FAILED"; return false; }

  summary.executed = true;
  summary.firestoreWriteDone = true;
  summary.userCreated = true;
  summary.realWriteBlocked = false;
  summary.createdDoc = "users/***"; // id do doc nunca impresso
  return true;
}

function runPrep() {
  summary.mode = "PREP";
  scopeGuards();
  summary.readyForFutureProvision = (fails.length === 0);
  summary.result = (fails.length === 0) ? "PREP_READY" : "PREP_BLOCKED";
  return finish(fails.length === 0);
}

async function main() {
  log("canary provision (dry_run=" + DRY_RUN + "). APPLY exige gates explicitos.");
  const provisionRequested = (!DRY_RUN) && ALLOW_PROVISION && (CONFIRM_PROVISION === EXPECTED.confirm);
  if (!provisionRequested) {
    // DRY-RUN / PREP: nenhuma conexao, nenhuma escrita.
    return runPrep();
  }
  // ---- Abaixo: somente fase posterior autorizada. Mantido protegido por gate. ----
  summary.mode = "APPLY";
  scopeGuards();
  if (fails.length > 0) { summary.result = "PROVISION_BLOCKED"; summary.provisionBlockReason = summary.provisionBlockReason || "GATE"; return finish(false); }
  summary.provisionAuthorizedThisPhase = true;
  const done = await provisionCanary();
  if (!done) { summary.result = "PROVISION_BLOCKED"; return finish(false); }
  summary.result = "PROVISION_DONE";
  return finish(true);
}

// Exporta funcoes puras para teste local. NUNCA executam rede/escrita.
export { matchUsersByEmailCI, buildCanaryDoc };

// Executa main() SOMENTE quando rodado diretamente (node runner.mjs). Importar para teste
// NAO dispara main() (permite testar as funcoes puras sem firebase-admin).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
