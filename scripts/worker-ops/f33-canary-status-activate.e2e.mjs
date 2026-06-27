#!/usr/bin/env node
/* =====================================================================
   F3.3.20-B1.7-E — Ativa SOMENTE o usuário CANÁRIO (Admin SDK).
   Atualiza SOMENTE users/<CANARY_UID>.status = "ativo", para o canário sair
   da pendingScreen (route()/meIsActive reprova status pendente/removido/excluido).
   DRY_RUN=true (default): lê o doc, valida canário, reporta o status atual e NÃO escreve.
   DRY_RUN=false: exige CONFIRM_STATUS=ACTIVATE_CANARY_STATUS e escreve {status:"ativo"}.
   GUARDS: só toca doc cujo id parece canário E cujo campo canary===true (nunca usuário real).
   NÃO altera pass/salt/fcmTokens/notifPrefs/email/name/role/admin — só status.
   NUNCA imprime segredo/valor sensível. Sem acesso a segredo de servidor. Sem publicacao.
   Credencial Admin via GOOGLE_APPLICATION_CREDENTIALS (ADC).
   ===================================================================== */
import { writeFileSync, mkdirSync } from "node:fs";
import admin from "firebase-admin";

const DRY_RUN = (process.env.DRY_RUN ?? "true") !== "false";
const CONFIRM = process.env.CONFIRM_STATUS || "";
const REQUIRED = "ACTIVATE_CANARY_STATUS";
const CANARY_UID = process.env.CANARY_UID || "canary-pwa-staging-notifprefs";
const TARGET_STATUS = "ativo";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "./status-activate-artifacts";

// ---- GUARD 1: só canário (nunca usuário real) ----
if (!/canary|canario|teste|test|qa/i.test(CANARY_UID)) {
  console.error("NO-GO: CANARY_UID nao parece canario (protecao usuario real)."); process.exit(1);
}

// presença booleana de campos sensíveis (NUNCA o valor) — prova de não-toque
const presence = (d) => ({
  hasPass: typeof d.pass === "string",
  hasSalt: typeof d.salt === "string",
  fcmTokensCount: Array.isArray(d.fcmTokens) ? d.fcmTokens.length : (d.fcmTokens ? -1 : 0),
  hasNotifPrefs: !!d.notifPrefs,
  hasEmail: typeof d.email === "string",
});

function writeSummary(o) {
  try { mkdirSync(ARTIFACT_DIR, { recursive: true }); writeFileSync(ARTIFACT_DIR + "/status-activate-summary.json", JSON.stringify(o, null, 2)); } catch (_) {}
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

  const before = presence(d);
  const summary = {
    uid: CANARY_UID, canaryConfirmed: d.canary === true,
    purposeOk: !!(d.canaryPurpose || d.createdFor),
    statusBefore: typeof d.status === "string" ? d.status : "(unset)",
    targetStatus: TARGET_STATUS, willUpdateFields: ["status"],
    alreadyActive: d.status === TARGET_STATUS,
    sensitiveBefore: before,
    dryRun: DRY_RUN, updated: false,
  };

  if (DRY_RUN) {
    console.log("DRY-RUN status-activate (sem escrita):", JSON.stringify(summary));
    writeSummary(summary); process.exit(0);
  }

  // ---- APPLY real ----
  if (CONFIRM !== REQUIRED) { console.error("NO-GO: CONFIRM_STATUS != ACTIVATE_CANARY_STATUS."); process.exit(1); }

  if (d.status === TARGET_STATUS) {
    summary.noop = true;
    console.log("NO-OP: canario ja esta ativo (sem escrita):", JSON.stringify(summary));
    writeSummary(summary); process.exit(0);
  }

  await ref.update({ status: TARGET_STATUS }); // SOMENTE status; preserva todo o resto

  // re-read p/ provar que só status mudou e sensíveis seguem intactos
  const after = (await ref.get()).data() || {};
  const aft = presence(after);
  summary.updated = after.status === TARGET_STATUS;
  summary.statusAfter = after.status;
  summary.sensitiveAfter = aft;
  summary.passUnchanged = aft.hasPass === before.hasPass;
  summary.saltUnchanged = aft.hasSalt === before.hasSalt;
  summary.fcmTokensUnchanged = aft.fcmTokensCount === before.fcmTokensCount;
  summary.notifPrefsUnchanged = aft.hasNotifPrefs === before.hasNotifPrefs;
  summary.emailUnchanged = aft.hasEmail === before.hasEmail;

  console.log("APPLY status-activate OK (sem segredo em log):", JSON.stringify(summary));
  writeSummary(summary);
  process.exit(summary.updated ? 0 : 1);
}

main().catch((e) => { console.error("erro:", e && (e.message || "").slice(0, 160)); process.exit(1); });
