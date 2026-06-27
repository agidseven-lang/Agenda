#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — SLICE 2: BACKFILL runner de `usersPublic` (gated, idempotente).
 * ---------------------------------------------------------------------
 * Le a colecao `users` (Firebase Admin SDK), projeta cada doc com
 * `projectUserPublicOut` (EXTRAIDO de functions/index.js via grab — SEM importar o
 * modulo de Functions / sem side effects), e:
 *   - DRY_RUN (default)  => ZERO writes; so leitura/projecao/validacao/contagens;
 *   - APPLY (DRY_RUN=false + CONFIRM_BACKFILL=RUN_USERSPUBLIC_BACKFILL) => escreve
 *     SOMENTE `usersPublic/{uid}` (set COMPLETO, sem merge, batch <=500).
 * Seguranca:
 *   - destino unico `usersPublic/{uid}` (path guard: 2 segmentos, prefixo exato);
 *   - projecao allowlist de 7 chaves {id,name,role,admin,status,photo,color};
 *     valida por doc que NAO ha pass/salt/phone/email/fcmTokens/fcmTokenMeta/token/secret;
 *   - NUNCA escreve `users`/`notifPrefs`/`fcmTokens`/outra colecao; NUNCA messaging()/FCM;
 *   - NUNCA imprime doc completo nem valores; logs so contagens + uid mascarado/hash;
 *   - artifacts SANITIZADOS (contagens + hashes) + self-check que aborta se vazar PII;
 *   - idempotente (set completo = mesma saida da trigger syncUsersPublic).
 * NAO faz deploy; NAO acessa Secret Manager; NAO usa Playwright; NAO toca UI/Rules/Web Push.
 * Credencial via GOOGLE_APPLICATION_CREDENTIALS (applicationDefault). Roda runner-side
 * (workflow gated). NESTA FASE: somente `node --check` — nao executar contra Firestore.
 * Env: DRY_RUN(default true), CONFIRM_BACKFILL, LIMIT(0=todos), PAGE_SIZE(<=500),
 *      GITHUB_RUN_ID, ARTIFACT_DIR.
 * ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------- config / env ---------- */
const CONFIRM_TOKEN = "RUN_USERSPUBLIC_BACKFILL";
const SRC_COLLECTION = "users";
const DEST_COLLECTION = "usersPublic";
const ALLOW = ["admin", "color", "id", "name", "photo", "role", "status"]; // sorted
const BLOCKED = ["pass", "salt", "phone", "email", "fcmTokens", "fcmTokenMeta",
  "token", "tokens", "secret", "resetCode", "reset", "authorization", "privateKey"];

// default SEGURO: so o literal "false" liga APPLY; qualquer outra coisa => dry-run.
const DRY_RUN = String(process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const CONFIRM_BACKFILL = String(process.env.CONFIRM_BACKFILL ?? "");
const LIMIT = Math.max(0, parseInt(process.env.LIMIT ?? "0", 10) || 0); // 0 = todos
let PAGE_SIZE = parseInt(process.env.PAGE_SIZE ?? "200", 10) || 200;
if (PAGE_SIZE < 1) PAGE_SIZE = 200;
if (PAGE_SIZE > 500) PAGE_SIZE = 500; // teto do batch do Firestore
const RUN_ID = String(process.env.GITHUB_RUN_ID ?? "local");
const ARTIFACT_DIR = String(process.env.ARTIFACT_DIR ?? path.resolve(__dirname, "..", "..", "artifacts-backfill"));

const shortHash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
const maskUid = (u) => { const s = String(u || ""); return s ? s.slice(0, 3) + "…#" + shortHash(s).slice(0, 6) : "(vazio)"; };

/* ---------- gate de APPLY (antes de QUALQUER acesso a Firestore) ---------- */
if (!DRY_RUN && CONFIRM_BACKFILL !== CONFIRM_TOKEN) {
  console.error("::error:: APPLY (DRY_RUN=false) exige CONFIRM_BACKFILL=" + CONFIRM_TOKEN);
  process.exit(2);
}

/* ---------- projectUserPublicOut: EXTRAIDO de functions/index.js (sem importar o modulo) ---------- */
function grab(SRC, n) {
  let a = SRC.indexOf("async function " + n + "(");
  if (a < 0) a = SRC.indexOf("function " + n + "(");
  if (a < 0) throw new Error("nao encontrei: " + n);
  let d = 0;
  for (let j = SRC.indexOf("{", a); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return SRC.slice(a, j + 1); }
  }
  throw new Error("sem fim: " + n);
}
const FN_SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");
const projectUserPublicOut = new Function(grab(FN_SRC, "projectUserPublicOut") + "; return projectUserPublicOut;")();

/* self-check do SHAPE da projecao (allowlist) ANTES de tocar Firestore */
(function assertProjectionShape() {
  const probe = projectUserPublicOut("uPROBE", {
    name: "x", role: "y", admin: true, status: "z", photo: "p", color: "c",
    pass: "X", salt: "Y", phone: "P", email: "E", fcmTokens: ["T"], fcmTokenMeta: { a: 1 },
  });
  if (JSON.stringify(Object.keys(probe).sort()) !== JSON.stringify(ALLOW)) {
    console.error("::error:: projectUserPublicOut com shape inesperado"); process.exit(3);
  }
  for (const b of BLOCKED) if (b in probe) { console.error("::error:: projecao contem chave bloqueada"); process.exit(3); }
})();

/* ---------- validacao de uma projecao (por doc) ---------- */
function validateProjection(proj) {
  if (JSON.stringify(Object.keys(proj).sort()) !== JSON.stringify(ALLOW)) return false;
  for (const b of BLOCKED) if (b in proj) return false;
  return true;
}

/* ---------- path guard: destino sempre usersPublic/{uid} (2 segmentos) ---------- */
function assertDestPath(uid) {
  const p = DEST_COLLECTION + "/" + uid;
  const segs = p.split("/");
  if (segs.length !== 2 || segs[0] !== DEST_COLLECTION || !segs[1]) {
    console.error("::error:: path de destino invalido (esperado " + DEST_COLLECTION + "/{uid})"); process.exit(4);
  }
  return p;
}

/* ---------- artifacts (SANITIZADOS: contagens + hashes; nunca docs/valores) ---------- */
function writeArtifacts(o) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const counts = { read: o.read, projectable: o.projectable, wouldWrite: o.wouldWrite, written: o.written, skipped: o.skipped };
  const report = {
    runId: o.runId, dryRun: o.dryRun, limit: o.limit, pageSize: o.pageSize,
    destinationCollection: DEST_COLLECTION,
    read: o.read, projectable: o.projectable, wouldWrite: o.wouldWrite, written: o.written, skipped: o.skipped,
    inputDocsWithBlockedKeys: o.inputBlocked, outputProjectionsWithBlockedKeys: o.outputBlocked,
    sampleUidHashes: o.sampleHashes,
  };
  const fchk = {
    inputDocsScanned: o.read,
    inputDocsWithBlockedKeysCount: o.inputBlocked,
    outputProjectionsWithBlockedKeysCount: o.outputBlocked, // deve ser 0
    note: "saida e allowlist de 7 chaves; entradas com chaves bloqueadas foram normalizadas (sem valores).",
  };
  const summary = {
    mode: o.dryRun ? "dry-run" : "apply", runId: o.runId, dryRun: o.dryRun, wrote: !o.dryRun,
    limit: o.limit, pageSize: o.pageSize, destinationCollection: DEST_COLLECTION, totals: counts,
  };
  fs.writeFileSync(path.join(ARTIFACT_DIR, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_DIR, "counts.json"), JSON.stringify(counts, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_DIR, "forbidden-fields-check.json"), JSON.stringify(fchk, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_DIR, o.dryRun ? "dry-run-summary.json" : "apply-summary.json"), JSON.stringify(summary, null, 2));
}

/* ---------- self-check de artifacts: aborta se vazar substring sensivel ---------- */
function selfCheckArtifacts() {
  const NEEDLES = ["pass", "salt", "phone", "email", "fcmtokens", "fcmtokenmeta",
    "authorization", "secret", "private_key", "client_email"];
  for (const f of fs.readdirSync(ARTIFACT_DIR)) {
    if (!f.endsWith(".json")) continue;
    const body = fs.readFileSync(path.join(ARTIFACT_DIR, f), "utf8").toLowerCase();
    for (const n of NEEDLES) {
      if (body.includes(n)) { console.error("::error:: artifact " + f + " contem substring sensivel"); process.exit(5); }
    }
  }
}

/* ---------- main ---------- */
async function main() {
  const admin = (await import("firebase-admin")).default;
  if (!admin.apps.length) admin.initializeApp(); // applicationDefault via GOOGLE_APPLICATION_CREDENTIALS
  const db = admin.firestore();
  const FieldPath = admin.firestore.FieldPath;

  let read = 0, projectable = 0, wouldWrite = 0, written = 0, skipped = 0, inputBlocked = 0, outputBlocked = 0;
  const sampleHashes = [];
  let last = null, stop = false;

  while (!stop) {
    let q = db.collection(SRC_COLLECTION).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    let batch = DRY_RUN ? null : db.batch();
    let ops = 0;

    for (const doc of snap.docs) {
      if (LIMIT && read >= LIMIT) { stop = true; break; }
      read++;
      last = doc.id;
      const data = doc.data() || {};
      if (BLOCKED.some((b) => b in data)) inputBlocked++; // so contagem; sem valores/nomes em artifact

      const proj = projectUserPublicOut(doc.id, data);
      if (!validateProjection(proj)) { skipped++; continue; }
      if (BLOCKED.some((b) => b in proj)) { outputBlocked++; skipped++; continue; }
      projectable++;
      if (sampleHashes.length < 5) sampleHashes.push(shortHash(doc.id));

      assertDestPath(doc.id); // aborta se destino != usersPublic/{uid}
      wouldWrite++;
      if (!DRY_RUN) {
        batch.set(db.collection(DEST_COLLECTION).doc(doc.id), proj); // SET COMPLETO (sem merge)
        ops++;
        if (ops >= 500) { await batch.commit(); written += ops; batch = db.batch(); ops = 0; }
      }
    }
    if (!DRY_RUN && ops > 0) { await batch.commit(); written += ops; }
    if (snap.size < PAGE_SIZE) break;
  }

  writeArtifacts({ read, projectable, wouldWrite, written, skipped, inputBlocked, outputBlocked, dryRun: DRY_RUN, limit: LIMIT, pageSize: PAGE_SIZE, runId: RUN_ID, sampleHashes });
  selfCheckArtifacts();

  console.log("backfill " + (DRY_RUN ? "DRY-RUN" : "APPLY") + ": read=" + read + " projectable=" + projectable +
    " wouldWrite=" + wouldWrite + " written=" + written + " skipped=" + skipped + " inputWithBlocked=" + inputBlocked);
  console.log("destino unico: " + DEST_COLLECTION + "/{uid}; PII/credenciais excluidas pela projecao allowlist; idempotente.");
  if (sampleHashes.length) console.log("amostra (uid hashes): " + sampleHashes.join(", "));
}

main().catch((e) => { console.error("ERRO RUNNER:", (e && e.message) ? e.message : e); process.exit(1); });
