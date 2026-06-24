#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-C-MONITORING-WORKFLOW-AUDIT — Guard do workflow READ-ONLY de
 * auditoria de Cloud Monitoring/Logging do emissor issueNotifPrefsToken
 * (.github/workflows/f3320-b17c-monitoring-audit.yml).
 * Le o YAML e prova (offline; sem executar o workflow; sem tocar GCP):
 *  - workflow_dispatch only; input obrigatorio mode == audit_only;
 *  - permissions: contents: read; concurrency propria; auth via GOOGLE_APPLICATION_CREDENTIALS_JSON;
 *  - SOMENTE comandos read-only de descoberta: monitoring channels list, monitoring policies
 *    list, metric-descriptors list, logging read, functions describe, run services describe;
 *  - NAO cria/edita/remove alertas, canais nem policies; NAO publica funcoes; NAO toca o
 *    segredo do trilho (sem gcloud secrets / versions add / versions access); NAO ativa flags;
 *    NAO altera variaveis de ambiente; NAO concede/edita IAM; SEM checkout; SEM wrangler/
 *    hosting/firestore; SEM updateNotifPrefs; SEM set -x;
 *  - filtros restritos a issueNotifPrefsToken / us-central1;
 *  - cleanup do arquivo temporario da service account (if: always()).
 * Rodar: node scripts/worker-ops/f33Z-monitoring-audit-guard.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YML_PATH = path.resolve(__dirname, "..", "..", ".github", "workflows", "f3320-b17c-monitoring-audit.yml");

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

/* 1) workflow existe */
ok("1 workflow existe", fs.existsSync(YML_PATH));
const YML = fs.existsSync(YML_PATH) ? fs.readFileSync(YML_PATH, "utf8") : "";

/* 2) workflow_dispatch only (sem push/pull_request/schedule) */
ok("2 workflow_dispatch only",
  /on:\s*\n\s*workflow_dispatch:/.test(YML) &&
  !/\n\s*push:/.test(YML) && !/\n\s*pull_request:/.test(YML) && !/\n\s*schedule:/.test(YML));

/* 3) input obrigatorio mode (required:true) */
ok("3 input mode (required:true)",
  /\bmode:/.test(YML) && /mode:[\s\S]*?required:\s*true/.test(YML));

/* 4) guard real mode == audit_only */
ok("4 guard mode == audit_only", /"\$MODE"\s*!=\s*"audit_only"/.test(YML));

/* 5) permissions: contents: read */
ok("5 permissions contents:read", /permissions:\s*\n\s*contents:\s*read/.test(YML));

/* 6) concurrency propria */
ok("6 concurrency propria", /concurrency:\s*\n\s*group:/.test(YML));

/* 7) auth via GOOGLE_APPLICATION_CREDENTIALS_JSON */
ok("7 auth via GOOGLE_APPLICATION_CREDENTIALS_JSON", /GOOGLE_APPLICATION_CREDENTIALS_JSON/.test(YML));

/* 8) SEM checkout (nao depende de codigo do repo) */
ok("8 sem checkout", !/checkout/.test(YML) && !/actions\/checkout/.test(YML));

/* 9) SEM firebase (auditoria usa gcloud direto) */
ok("9 sem firebase", !/firebase/i.test(YML));

/* 10) SEM deploy (nenhuma publicacao) */
ok("10 sem deploy", !/\bdeploy\b/i.test(YML));

/* 11) SEM --only */
ok("11 sem --only", !/--only/.test(YML));

/* 12) SEM set-env-vars / alteracao de variaveis de ambiente */
ok("12 sem set-env-vars", !/set-env-vars/.test(YML) && !/update-env-vars/.test(YML));

/* 13) SEM operacoes de segredo (gcloud secrets / versions add / versions access) */
ok("13 sem operacoes de segredo",
  !/gcloud\s+secrets/.test(YML) && !/versions\s+add/.test(YML) && !/versions\s+access/.test(YML) && !/--data-file/.test(YML));

/* 14) nunca o nome literal do segredo do trilho (evita exposicao acidental) */
ok("14 sem nome literal do segredo", !/NOTIF_PREFS_SECRET/.test(YML));

/* 15) SEM flags ENABLE_NOTIF_* */
ok("15 sem ENABLE_NOTIF", !/ENABLE_NOTIF/.test(YML));

/* 16) SEM updateNotifPrefs (auditoria so do emissor ja publicado) */
ok("16 sem updateNotifPrefs", !/updateNotifPrefs/.test(YML));

/* 17) SEM mutacao de alert policies (create/update/delete) */
ok("17 sem mutacao de policies",
  !/policies\s+create/.test(YML) && !/policies\s+update/.test(YML) && !/policies\s+delete/.test(YML));

/* 18) SEM mutacao de notification channels (create/update/delete) */
ok("18 sem mutacao de channels",
  !/channels\s+create/.test(YML) && !/channels\s+update/.test(YML) && !/channels\s+delete/.test(YML));

/* 19) SEM mutacao de IAM/invoker */
ok("19 sem mutacao de IAM",
  !/add-iam-policy-binding/.test(YML) && !/set-iam-policy/.test(YML) && !/remove-iam-policy-binding/.test(YML));

/* 20) SEM firestore / hosting / wrangler */
ok("20 sem firestore/hosting/wrangler",
  !/firestore/.test(YML) && !/hosting/.test(YML) && !/wrangler/.test(YML));

/* 21) SEM set -x (evita vazamento por trace) */
ok("21 sem set -x", !/set\s+-x/.test(YML));

/* 22) read-only: monitoring channels list */
ok("22 monitoring channels list", /gcloud\s+monitoring\s+channels\s+list/.test(YML));

/* 23) read-only: monitoring policies list (GA e/ou alpha) */
ok("23 monitoring policies list", /gcloud\s+(alpha\s+)?monitoring\s+policies\s+list/.test(YML));

/* 24) read-only: metric-descriptors list (run.googleapis.com) */
ok("24 metric-descriptors list (run.googleapis.com)",
  /metric-descriptors\s+list/.test(YML) && /run\.googleapis\.com/.test(YML));

/* 25) read-only: logging read filtrado ao servico (service_name + location) */
ok("25 logging read filtrado",
  /gcloud\s+logging\s+read/.test(YML) && /service_name=/.test(YML) && /location=/.test(YML));

/* 26) read-only: functions describe (gen2) do alvo */
ok("26 functions describe gen2",
  /gcloud\s+functions\s+describe/.test(YML) && /--gen2/.test(YML));

/* 27) read-only: run services describe do alvo */
ok("27 run services describe", /gcloud\s+run\s+services\s+describe/.test(YML));

/* 28) filtros restritos ao alvo e regiao (env FN + REGION) */
ok("28 filtros restritos (FN=issueNotifPrefsToken, REGION=us-central1)",
  /FN:\s*"issueNotifPrefsToken"/.test(YML) && /REGION:\s*"us-central1"/.test(YML));

/* 29) cleanup do SA temporario (if: always()) */
ok("29 cleanup do SA temp (if:always)", /rm -f[^\n]*gcp-sa\.json/.test(YML) && /if:\s*always\(\)/.test(YML));

/* 30) tolerancia a falha por comando (set +e) — auditoria nao aborta em lacuna de permissao */
ok("30 tolerancia a falha (set +e)", /set \+e/.test(YML));

console.log("\n===== F3.3.20-B1.7-C — guard MONITORING-AUDIT (f3320-b17c-monitoring-audit.yml) =====");
console.log("  workflow_dispatch only · mode==audit_only · permissions contents:read");
console.log("  SOMENTE read-only: channels/policies list · metric-descriptors · logging read · describe");
console.log("  SEM alertas/canais/policies (create/update/delete) · SEM publish/flags/segredo/IAM/checkout");
console.log("===================================================================================\n");
console.log("F3.3.20-B1.7-C monitoring-audit-guard: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
