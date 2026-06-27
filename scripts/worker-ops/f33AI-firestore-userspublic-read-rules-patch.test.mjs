#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — teste LOCAL do patcher de Rules usersPublic read.
 * Exercita scripts/worker-ops/patch-firestore-userspublic-read-rules.mjs em
 * fixtures sinteticas (sem Firebase, sem gcloud, sem deploy, sem Firestore).
 * Roda o patcher como subprocesso (node) sobre arquivos temporarios e valida:
 *   - injeta o bloco usersPublic ANTES do catch-all; preserva users/notifPrefs/
 *     password-reset/catch-all; idempotente; sem duplicar; falha em divergente,
 *     catch-all ausente e duplicado; output com read:if true / write:false / sem
 *     request.auth; report so com metadados (sem Rules completas).
 *   + guardas de fonte: patcher sem firebase deploy / gcloud / Secret Manager /
 *     Firestore / messaging / web push.
 * Rodar: node scripts/worker-ops/f33AI-firestore-userspublic-read-rules-patch.test.mjs
 * ===================================================================== */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATCHER = path.join(__dirname, "patch-firestore-userspublic-read-rules.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "f33AI-"));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

let seq = 0;
// roda o patcher; retorna { code, out, err, output, report }
function runPatcher(inputStr, withReport) {
  seq++;
  const inP = path.join(TMP, `in-${seq}.rules`);
  const outP = path.join(TMP, `out-${seq}.rules`);
  const repP = withReport ? path.join(TMP, `rep-${seq}.json`) : null;
  fs.writeFileSync(inP, inputStr, "utf8");
  const args = [PATCHER, inP, outP];
  if (repP) args.push(repP);
  let code = 0, out = "", err = "";
  try { out = execFileSync("node", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { code = e.status == null ? 1 : e.status; err = String(e.stderr || ""); out = String(e.stdout || ""); }
  const output = fs.existsSync(outP) ? fs.readFileSync(outP, "utf8") : null;
  const report = (repP && fs.existsSync(repP)) ? JSON.parse(fs.readFileSync(repP, "utf8")) : null;
  return { code, out, err, output, report };
}

const HEAD = [
  "rules_version = '2';",
  "service cloud.firestore {",
  "  match /databases/{database}/documents {",
  "    match /users/{id} {",
  "      allow read: if true;",
  "      allow create: if request.resource.data.size() < 60;",
  "      allow update: if request.resource.data.size() < 60;",
  "      allow delete: if false;",
  "    }",
  "    match /notifPrefs/{uid} {",
  "      allow read: if isAdmin();",
  "      allow write: if false;",
  "    }",
  "    match /passwordResetCodes/{codeId} {",
  "      allow read, list, write: if false;",
  "    }",
];
const CATCHALL = [
  "    match /{document=**} {",
  "      allow read, write: if false;",
  "    }",
  "  }",
  "}",
];
const UP_OK = [
  "    match /usersPublic/{uid} {",
  "      allow read: if true;",
  "      allow create, update, delete: if false;",
  "    }",
];
const UP_DIVERGENT = [
  "    match /usersPublic/{uid} {",
  "      allow read: if true;",
  "      allow write: if true;",
  "    }",
];
const baseNoUP = [...HEAD, ...CATCHALL].join("\n") + "\n";
const baseWithUP = [...HEAD, ...UP_OK, ...CATCHALL].join("\n") + "\n";
const baseDivergent = [...HEAD, ...UP_DIVERGENT, ...CATCHALL].join("\n") + "\n";
const baseNoCatch = [...HEAD, "  }", "}"].join("\n") + "\n";
const baseDup = [...HEAD, ...UP_OK, ...UP_OK, ...CATCHALL].join("\n") + "\n";

/* ===== 1) insere bloco antes do catch-all ===== */
const r1 = runPatcher(baseNoUP, true);
ok("0 patcher exit 0 (insercao)", r1.code === 0 && r1.output != null);
const upIdx = r1.output ? r1.output.indexOf("match /usersPublic/{uid}") : -1;
const caIdx = r1.output ? r1.output.indexOf("match /{document=**}") : -1;
ok("1 insere usersPublic ANTES do catch-all", upIdx > 0 && caIdx > 0 && upIdx < caIdx);

/* ===== 2-5) preserva blocos ===== */
ok("2 preserva users", /match\s+\/users\/\{id\}\s*\{/.test(r1.output) && /allow read: if true;/.test(r1.output));
ok("3 preserva notifPrefs", /match\s+\/notifPrefs\/\{uid\}\s*\{/.test(r1.output));
ok("4 preserva catch-all deny", /match\s+\/\{document=\*\*\}\s*\{[\s\S]*allow read, write: if false;/.test(r1.output));
ok("5 preserva password-reset", /match\s+\/passwordResetCodes\/\{codeId\}/.test(r1.output));

/* ===== 6-8) idempotencia ===== */
const r2 = runPatcher(r1.output, true);
ok("6 idempotente: 2a exec exit 0", r2.code === 0);
ok("7 idempotente: nao duplica (output == input)", r2.output === r1.output);
ok("8 alreadyPresent quando bloco correto", r2.report && r2.report.alreadyPresent === true && r2.report.patched === false);

/* ===== 9) divergente => falha ===== */
const r9 = runPatcher(baseDivergent, false);
ok("9 divergente => exit 1", r9.code === 1 && /DIVERGENTE/i.test(r9.err));

/* ===== 10) catch-all ausente => falha ===== */
const r10 = runPatcher(baseNoCatch, false);
ok("10 catch-all ausente => exit 1", r10.code === 1 && /catch-all/i.test(r10.err));

/* ===== 11) duplicado => falha ===== */
const r11 = runPatcher(baseDup, false);
ok("11 duplicado => exit 1 (anti-dup)", r11.code === 1 && /aparece 2x|2x \(esperado 1\)/i.test(r11.err));

/* ===== 12-15) conteudo do output (insercao limpa) ===== */
const occ = (r1.output.match(/match\s+\/usersPublic\/\{uid\}\s*\{/g) || []).length;
ok("12 output tem exatamente 1 match usersPublic", occ === 1);
ok("13 output tem 'allow read: if true'", /match\s+\/usersPublic\/\{uid\}\s*\{[\s\S]*?allow read: if true;[\s\S]*?\}/.test(r1.output));
ok("14 output tem 'allow create, update, delete: if false'", /allow create, update, delete: if false;/.test(r1.output));
ok("15 output usersPublic SEM request.auth", !/usersPublic[\s\S]*?request\.auth[\s\S]*?\n    \}/.test(r1.output));

/* ===== 16-18) nao altera users/notifPrefs/catch-all (comparacao por linhas: input ⊆ output) ===== */
const inLines = baseNoUP.split("\n"); const outLines = r1.output.split("\n");
let j = 0, allPresent = true;
for (const li of inLines) { while (j < outLines.length && outLines[j] !== li) j++; if (j >= outLines.length) { allPresent = false; break; } j++; }
ok("16 users read: if true inalterado (additive-only)", allPresent && /allow read: if true;/.test(r1.output));
ok("17 notifPrefs inalterado (additive-only)", allPresent && /match\s+\/notifPrefs\/\{uid\}\s*\{\n\s*allow read: if isAdmin\(\);\n\s*allow write: if false;/.test(r1.output));
ok("18 catch-all deny inalterado (additive-only)", allPresent);

/* ===== 19-20) report seguro ===== */
const repStr = JSON.stringify(r1.report || {});
ok("19 report SEM Rules completas", !/match \/|service cloud|allow read|document=/.test(repStr));
ok("20 report so metadados seguros", r1.report &&
  ["patched","alreadyPresent","inserted","anchorFound","duplicateCount","changed","inputBytes","outputBytes","blockHash","timestamp"]
    .every((k) => k in r1.report) &&
  Object.keys(r1.report).length === 10);

/* ===== 21-25) guardas de fonte do patcher ===== */
const SRC = fs.readFileSync(PATCHER, "utf8");
ok("21 patcher sem 'firebase deploy'", !/firebase deploy/.test(SRC));
ok("22 patcher sem 'gcloud'", !/gcloud/.test(SRC));
ok("23 patcher sem Secret Manager", !/secrets versions access|secretmanager|GOOGLE_APPLICATION_CREDENTIALS/.test(SRC));
ok("24 patcher sem Firestore doc / firebase-admin", !/firebase-admin|\.collection\(|\.doc\(|initializeApp/.test(SRC));
ok("25 patcher sem messaging/web push", !/messaging\(|web ?push/i.test(SRC));

/* cleanup */
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}

console.log("\n========= F3.3.20-B1.7-E — patcher usersPublic read (local) =========");
console.log("  injeta antes do catch-all; preserva users/notifPrefs/reset/catch-all;");
console.log("  idempotente; anti-dup; falha em divergente/sem-catch-all/duplicado;");
console.log("  read:if true / write:false / sem request.auth; report so metadados.");
console.log("====================================================================");
console.log("F3.3.20-B1.7-E f33AI userspublic-read-rules-patch: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
