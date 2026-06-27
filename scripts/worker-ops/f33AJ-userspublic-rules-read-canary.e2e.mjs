#!/usr/bin/env node
/* =====================================================================
   F3.3.20-B1.7-E — f33AJ — CANARIO de Firestore Rules (usersPublic read).
   Usa o SDK CLIENTE Firebase (modular) NAO-AUTENTICADO. O app nao tem
   Firebase Auth => request.auth==null, identico ao PWA em producao. Prova,
   contra as Rules LIVE de PRODUCAO (sem privilegio Admin), que:
     1) cliente LE/lista usersPublic (read: if true);
     2) cliente NAO cria usersPublic        => permission-denied;
     3) cliente NAO atualiza usersPublic     => permission-denied;
     4) cliente NAO deleta usersPublic       => permission-denied;
     5) cliente ainda LE users (temporario);
     6) cliente NAO le notifPrefs            => permission-denied;
     7) cliente NAO escreve notifPrefs       => permission-denied;
     8) catch-all (colecao aleatoria)        => permission-denied;
     9) cada doc usersPublic tem EXATAMENTE 7 chaves allowlisted
        (id,name,role,admin,status,photo,color);
    10) usersPublic e PII-free (sem pass/salt/phone/email/fcmTokens/...);
    11) nenhum write persiste (re-leitura confirma).
   NAO faz deploy, NAO altera Rules, NAO usa Admin SDK, NAO usa segredo/SA,
   NAO usa GOOGLE_APPLICATION_CREDENTIALS, NAO ativa Web Push. Artifacts
   SANITIZADOS (so contagens/booleans/nomes-de-campo/hashes/codigos de erro);
   NUNCA serializa valores de documentos. Self-check final bloqueia escrita
   se qualquer material de credencial (apiKey/private_key) aparecer.
   firebaseConfig (chave web PUBLICA) extraido de index.html; nunca impresso.
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { initializeApp } from "firebase/app";
import {
  initializeFirestore, collection, query, limit, getDocs,
  doc, getDoc, setDoc, updateDoc, deleteDoc, terminate,
} from "firebase/firestore";

const REQUIRED = "RUN_USERSPUBLIC_RULES_READ_CANARY";
const CONFIRM = process.env.CONFIRM_CANARY || "";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "./artifacts-canary";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const INDEX_HTML = process.env.INDEX_HTML || "index.html";
const PAGE_SIZE = Math.max(1, Math.min(500, parseInt(process.env.PAGE_SIZE || "50", 10) || 50));
const OP_TIMEOUT_MS = 25000;

const ALLOW = ["id", "name", "role", "admin", "status", "photo", "color"];
const FORBIDDEN_KEYS = [
  "pass", "salt", "phone", "email", "fcmtokens", "fcmtokenmeta",
  "token", "secret", "reset", "authorization", "private_key", "client_email",
];

if (CONFIRM !== REQUIRED) {
  console.error("::error:: CONFIRM_CANARY ausente/incorreto (esperado " + REQUIRED + ")");
  process.exit(1);
}

const sha256 = (s) => createHash("sha256").update(String(s)).digest("hex").slice(0, 16);
const isDenied = (e) =>
  !!e && (e.code === "permission-denied" ||
    /permission-denied|PERMISSION_DENIED|Missing or insufficient permissions/i.test(e && e.message || ""));
const codeOf = (e) => (e && (e.code || (e.message ? "err" : "unknown"))) || "unknown";

function withTimeout(p, label) {
  return Promise.race([
    Promise.resolve().then(() => p),
    new Promise((_, rej) =>
      setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "deadline-exceeded:" + label })), OP_TIMEOUT_MS)),
  ]);
}

// Extrai firebaseConfig (chave web PUBLICA) do index.html. So apiKey/projectId
// sao exigidos; nunca imprime/serializa os valores.
function extractFirebaseConfig(html) {
  const pick = (k) => {
    const m = html.match(new RegExp("\\b" + k + "\\s*:\\s*\"([^\"]*)\""));
    return m ? m[1] : "";
  };
  const cfg = {
    apiKey: pick("apiKey"),
    authDomain: pick("authDomain"),
    projectId: pick("projectId"),
    storageBucket: pick("storageBucket"),
    messagingSenderId: pick("messagingSenderId"),
    appId: pick("appId"),
  };
  if (!cfg.apiKey || !cfg.projectId) throw new Error("firebaseConfig incompleto no index.html");
  return cfg;
}

const results = [];
const rec = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || "" });

async function main() {
  const html = readFileSync(INDEX_HTML, "utf8");
  const cfg = extractFirebaseConfig(html);
  const app = initializeApp(cfg);
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });

  // ---- 1) READ usersPublic + schema/PII ----
  let upCount = 0;
  let eachExactly7 = true;
  const keysUnion = new Set();
  const forbiddenFound = new Set();
  let sampleId = null;
  let sampleIdHash = null;
  try {
    const snap = await withTimeout(getDocs(query(collection(db, "usersPublic"), limit(PAGE_SIZE))), "read usersPublic");
    upCount = snap.size;
    snap.forEach((d) => {
      const keys = Object.keys(d.data() || {}); // SO nomes de campo; valores descartados
      keys.forEach((k) => keysUnion.add(k));
      if (keys.length !== 7 || !keys.every((k) => ALLOW.includes(k))) eachExactly7 = false;
      keys.forEach((k) => { if (FORBIDDEN_KEYS.includes(String(k).toLowerCase())) forbiddenFound.add(String(k).toLowerCase()); });
      if (!sampleId) { sampleId = d.id; sampleIdHash = sha256(d.id); }
    });
    rec("usersPublic_read", true, "count=" + upCount);
  } catch (e) {
    rec("usersPublic_read", false, codeOf(e));
  }
  rec("usersPublic_nonempty", upCount > 0, "count=" + upCount);
  rec("usersPublic_schema_exactly7", eachExactly7 && upCount > 0, "keysUnion=" + [...keysUnion].sort().join(","));
  rec("usersPublic_pii_free", forbiddenFound.size === 0, forbiddenFound.size ? ("forbidden:" + [...forbiddenFound].join(",")) : "none");

  const tgt = sampleId || "__canary_write_test__";

  // ---- 2) CREATE usersPublic => deny ----
  try {
    await withTimeout(setDoc(doc(db, "usersPublic", "__canary_write_test__"),
      { id: "__canary_write_test__", name: "", role: "", admin: false, status: "", photo: "", color: "" }), "create usersPublic");
    rec("usersPublic_create_denied", false, "WRITE PERSISTIU (NO-GO)");
  } catch (e) { rec("usersPublic_create_denied", isDenied(e), codeOf(e)); }

  // ---- 3) UPDATE usersPublic => deny (alvo existente; rule if false nega antes de mutar) ----
  try {
    await withTimeout(updateDoc(doc(db, "usersPublic", tgt), { name: "__canary__" }), "update usersPublic");
    rec("usersPublic_update_denied", false, "WRITE PERSISTIU (NO-GO)");
  } catch (e) { rec("usersPublic_update_denied", isDenied(e), codeOf(e)); }

  // ---- 4) DELETE usersPublic => deny ----
  try {
    await withTimeout(deleteDoc(doc(db, "usersPublic", tgt)), "delete usersPublic");
    rec("usersPublic_delete_denied", false, "DELETE PERSISTIU (NO-GO)");
  } catch (e) { rec("usersPublic_delete_denied", isDenied(e), codeOf(e)); }

  // ---- 5) READ users (temporario) => sucesso; SO contagem, nunca conteudo ----
  let usersSampled = 0;
  try {
    const snap = await withTimeout(getDocs(query(collection(db, "users"), limit(PAGE_SIZE))), "read users");
    usersSampled = snap.size; // contagem amostrada (<= PAGE_SIZE); NUNCA serializa docs
    rec("users_read_temp", true, "sampled=" + usersSampled);
  } catch (e) { rec("users_read_temp", false, codeOf(e)); }

  // ---- 6) READ notifPrefs => deny ----
  try {
    await withTimeout(getDocs(query(collection(db, "notifPrefs"), limit(1))), "read notifPrefs");
    rec("notifPrefs_read_denied", false, "LEITURA PERMITIDA (NO-GO)");
  } catch (e) { rec("notifPrefs_read_denied", isDenied(e), codeOf(e)); }

  // ---- 7) WRITE notifPrefs => deny ----
  try {
    await withTimeout(setDoc(doc(db, "notifPrefs", "__canary_write_test__"), { x: 1 }), "write notifPrefs");
    rec("notifPrefs_write_denied", false, "WRITE PERSISTIU (NO-GO)");
  } catch (e) { rec("notifPrefs_write_denied", isDenied(e), codeOf(e)); }

  // ---- 8) catch-all (colecao aleatoria) => deny ----
  try {
    await withTimeout(getDoc(doc(db, "__canary_catchall__", "__no_doc__")), "read catchall");
    rec("catchall_denied", false, "LEITURA PERMITIDA (NO-GO)");
  } catch (e) { rec("catchall_denied", isDenied(e), codeOf(e)); }

  // ---- 11) nenhum write persistiu: re-leitura ----
  let persistOk = true;
  const persistDetail = [];
  try {
    const snap2 = await withTimeout(getDocs(query(collection(db, "usersPublic"), limit(PAGE_SIZE))), "reread usersPublic");
    if (snap2.size !== upCount) { persistOk = false; persistDetail.push("count " + upCount + "->" + snap2.size); }
    let canaryExists = false;
    snap2.forEach((d) => { if (d.id === "__canary_write_test__") canaryExists = true; });
    if (canaryExists) { persistOk = false; persistDetail.push("__canary_write_test__ existe"); }
  } catch (e) { persistOk = false; persistDetail.push("reread:" + codeOf(e)); }
  rec("no_write_persisted", persistOk, persistDetail.join(";") || "count igual; canary ausente");

  try { await terminate(db); } catch (_) { /* noop */ }

  // ---- agrega ----
  const by = (n) => results.find((r) => r.name === n) || { ok: false, detail: "ausente" };
  const go = results.every((r) => r.ok);
  const generatedAt = new Date().toISOString();

  const reportObj = { phase: "F3.3.20-B1.7-E-RULES-READ-CANARY", runId: RUN_ID, generatedAt, pageSize: PAGE_SIZE, go, results };
  const usersPublicReadSummary = {
    readOk: by("usersPublic_read").ok,
    docCount: upCount,
    keysObserved: [...keysUnion].sort(),
    eachDocExactly7: eachExactly7 && upCount > 0,
    forbiddenKeysFound: [...forbiddenFound],
    piiFree: forbiddenFound.size === 0,
    sampleIdHash,
  };
  const deniedWritesSummary = {
    createDenied: by("usersPublic_create_denied").ok,
    updateDenied: by("usersPublic_update_denied").ok,
    deleteDenied: by("usersPublic_delete_denied").ok,
    notifPrefsWriteDenied: by("notifPrefs_write_denied").ok,
    anyWritePersisted: !by("no_write_persisted").ok,
  };
  const rulesCanarySummary = {
    usersPublicRead: by("usersPublic_read").ok,
    usersReadTemp: by("users_read_temp").ok,
    usersSampled,
    notifPrefsReadDenied: by("notifPrefs_read_denied").ok,
    notifPrefsWriteDenied: by("notifPrefs_write_denied").ok,
    catchAllDenied: by("catchall_denied").ok,
    expectedRuleset: "projects/agenda-id-seven/rulesets/e650e1b5-0625-42d0-8a4a-5a2a07758c38",
  };

  // ---- self-check: bloqueia se material de credencial vazar nos artifacts ----
  const blob = JSON.stringify([reportObj, usersPublicReadSummary, deniedWritesSummary, rulesCanarySummary]);
  const leakPatterns = [
    cfg.apiKey, "AIzaSy", "-----BEGIN", "private_key", "client_email", "service_account",
  ].filter(Boolean);
  const leak = leakPatterns.find((p) => blob.includes(p));
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  if (leak) {
    writeFileSync(ARTIFACT_DIR + "/report.json", JSON.stringify({ go: false, error: "sanitizer_block" }, null, 2));
    console.error("::error:: sanitizer bloqueou artifact (material sensivel detectado)");
    process.exit(1);
  }

  writeFileSync(ARTIFACT_DIR + "/report.json", JSON.stringify(reportObj, null, 2));
  writeFileSync(ARTIFACT_DIR + "/userspublic-read-summary.json", JSON.stringify(usersPublicReadSummary, null, 2));
  writeFileSync(ARTIFACT_DIR + "/denied-writes-summary.json", JSON.stringify(deniedWritesSummary, null, 2));
  writeFileSync(ARTIFACT_DIR + "/rules-canary-summary.json", JSON.stringify(rulesCanarySummary, null, 2));

  console.log("CANARY go=" + go + " | " + results.map((r) => r.name + ":" + (r.ok ? "PASS" : "FAIL")).join(" "));
  for (const r of results) console.log("  - " + r.name + ": " + (r.ok ? "PASS" : "FAIL") + " (" + r.detail + ")");
  process.exit(go ? 0 : 1);
}

main().catch((e) => {
  console.error("::error:: canario falhou: " + codeOf(e));
  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(ARTIFACT_DIR + "/report.json", JSON.stringify({ go: false, error: "runner_exception", code: codeOf(e) }, null, 2));
  } catch (_) { /* noop */ }
  process.exit(1);
});
