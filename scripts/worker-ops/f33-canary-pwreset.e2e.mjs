#!/usr/bin/env node
/* =====================================================================
   F3.3.20-B1.7-E — Reset de senha do USUÁRIO CANÁRIO (Admin SDK).
   Atualiza SOMENTE {pass,salt} de users/<CANARY_UID>, no formato do login do app:
     pass = "s2:" + sha256hex(salt + "|" + senha)   ; salt = 16 bytes hex (randSalt)
   A SENHA vem do env CANARY_PASSWORD (secret definido pelo owner) — NUNCA gerada
   aqui, NUNCA impressa, NUNCA em artifact. O reset apenas SINCRONIZA o hash do doc
   canário com o secret CANARY_PASSWORD (mesmo secret que o UI-retest usa).
   DRY_RUN=true (default): valida doc/canary/plano e NÃO escreve.
   DRY_RUN=false: exige CONFIRM_PWRESET=RUN_CANARY_PWRESET e atualiza {pass,salt}.
   GUARDS: só toca doc cujo id parece canário E cujo campo canary===true (nunca
   usuário real). NÃO toca Web Push, Functions, Rules, Hosting, outros docs.
   Credencial Admin via GOOGLE_APPLICATION_CREDENTIALS (ADC). Sem segredo de servidor.
   ===================================================================== */
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import admin from "firebase-admin";

const DRY_RUN = (process.env.DRY_RUN ?? "true") !== "false";
const CONFIRM = process.env.CONFIRM_PWRESET || "";
const REQUIRED = "RUN_CANARY_PWRESET";
const CANARY_UID = process.env.CANARY_UID || "canary-pwa-staging-notifprefs";
const PWD = typeof process.env.CANARY_PASSWORD === "string" ? process.env.CANARY_PASSWORD : "";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "./pwreset-artifacts";
const MIN_PWD_LEN = 12;

// ---- GUARD 1: só canário (nunca usuário real) ----
if (!/canary|canario|teste|test|qa/i.test(CANARY_UID)) {
  console.error("NO-GO: CANARY_UID nao parece canario (protecao usuario real)."); process.exit(1);
}

const s2hash = (salt, pw) => "s2:" + createHash("sha256").update(salt + "|" + pw, "utf8").digest("hex");

function writeSummary(o) {
  try { mkdirSync(ARTIFACT_DIR, { recursive: true }); writeFileSync(ARTIFACT_DIR + "/pwreset-summary.json", JSON.stringify(o, null, 2)); } catch (_) {}
}

async function main() {
  admin.initializeApp(); // ADC via GOOGLE_APPLICATION_CREDENTIALS
  const db = admin.firestore();
  const ref = db.collection("users").doc(CANARY_UID);

  const snap = await ref.get();
  if (!snap.exists) { console.error("NO-GO: doc users/" + CANARY_UID + " inexistente."); process.exit(1); }
  const d = snap.data() || {};

  // ---- GUARD 2: campo canary===true (defesa dupla contra usuario real) ----
  if (d.canary !== true) { console.error("NO-GO: doc nao marca canary===true — abortando para nao tocar usuario real."); process.exit(1); }
  const purposeOk = !!(d.canaryPurpose || d.createdFor);

  const summary = {
    uid: CANARY_UID, canaryConfirmed: d.canary === true, purposeOk,
    willUpdateFields: ["pass", "salt"], passFormat: "s2:sha256(salt|senha)", saltLenHex: 32,
    dryRun: DRY_RUN, updated: false, ts: process.env.PWRESET_TS || "",
  };

  if (DRY_RUN) {
    // valida tudo, NÃO escreve; não exige senha no dry-run
    summary.passwordPresent = PWD.length > 0;
    console.log("DRY-RUN pwreset (sem escrita):", JSON.stringify(summary));
    writeSummary(summary);
    process.exit(0);
  }

  // ---- APPLY real ----
  if (CONFIRM !== REQUIRED) { console.error("NO-GO: CONFIRM_PWRESET != RUN_CANARY_PWRESET."); process.exit(1); }
  if (PWD.length < MIN_PWD_LEN) { console.error("NO-GO: CANARY_PASSWORD ausente/fraca (min " + MIN_PWD_LEN + " chars). Defina o secret."); process.exit(1); }

  const salt = randomBytes(16).toString("hex");   // == randSalt() do app
  const pass = s2hash(salt, PWD);                  // == hashPw(senha,salt) do app
  await ref.update({ pass, salt });                // SOMENTE pass+salt; preserva o resto

  summary.updated = true;
  console.log("APPLY pwreset OK (sem senha/hash em log):", JSON.stringify(summary));
  writeSummary(summary);
  process.exit(0);
}

main().catch((e) => { console.error("erro:", e && (e.message || "").slice(0, 160)); process.exit(1); });
