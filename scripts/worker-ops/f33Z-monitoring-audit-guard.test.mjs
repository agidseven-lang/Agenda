#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-C-MONITORING-WORKFLOW-FIX — Guard do workflow READ-ONLY de auditoria
 * de Cloud Monitoring/Logging (.github/workflows/f3320-b17c-monitoring-audit.yml),
 * agora autenticado via Workload Identity Federation com a identidade dedicada de
 * leitura monitoring-auditor. Le o YAML e prova (offline; sem executar; sem tocar GCP):
 *  - workflow_dispatch only; mode == audit_only; permissions contents:read + id-token:write;
 *  - auth via google-github-actions/auth@v2 com o WIF provider e a SA monitoring-auditor;
 *  - SEM chave JSON / SEM GOOGLE_APPLICATION_CREDENTIALS_JSON / SEM gcloud secrets/versions;
 *  - service names corretos (FUNCTION_NAME=issueNotifPrefsToken, RUN_SERVICE_NAME=issuenotifprefstoken);
 *  - rc real via ${PIPESTATUS[0]} e contagem so com rc==0 (linha de erro nunca vira recurso);
 *  - SOMENTE comandos read-only (channels/policies list, metric-descriptors, logging read,
 *    functions describe, run services describe); NADA de create/update/delete/IAM/deploy;
 *  - RELATORIO parse-friendly com ALERTAS/CANAIS/POLICIES/DEPLOY/SEGREDO = 0.
 * Rodar: node scripts/worker-ops/f33Z-monitoring-audit-guard.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YML_PATH = path.resolve(__dirname, "..", "..", ".github", "workflows", "f3320-b17c-monitoring-audit.yml");

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

/* 1 */ ok("1 workflow existe", fs.existsSync(YML_PATH));
const YML = fs.existsSync(YML_PATH) ? fs.readFileSync(YML_PATH, "utf8") : "";

/* 2 */ ok("2 workflow_dispatch only",
  /on:\s*\n\s*workflow_dispatch:/.test(YML) &&
  !/\n\s*push:/.test(YML) && !/\n\s*pull_request:/.test(YML) && !/\n\s*schedule:/.test(YML));
/* 3 */ ok("3 input mode (required:true)", /\bmode:/.test(YML) && /mode:[\s\S]*?required:\s*true/.test(YML));
/* 4 */ ok("4 guard mode == audit_only", /"\$MODE"\s*!=\s*"audit_only"/.test(YML));
/* 5 */ ok("5 permissions contents:read", /permissions:\s*\n[\s\S]*?contents:\s*read/.test(YML));
/* 6 */ ok("6 permissions id-token:write", /id-token:\s*write/.test(YML));

/* 7 */ ok("7 auth via google-github-actions/auth@v2", /google-github-actions\/auth@v2/.test(YML));
/* 8 */ ok("8 WIF provider correto",
  /workload_identity_provider:\s*"?projects\/391529908613\/locations\/global\/workloadIdentityPools\/github\/providers\/github/.test(YML));
/* 9 */ ok("9 service_account = monitoring-auditor",
  /service_account:\s*"?monitoring-auditor@agenda-id-seven\.iam\.gserviceaccount\.com/.test(YML));
/* 10 */ ok("10 setup-gcloud presente", /google-github-actions\/setup-gcloud@v2/.test(YML));

/* 11 */ ok("11 sem GOOGLE_APPLICATION_CREDENTIALS_JSON", !/GOOGLE_APPLICATION_CREDENTIALS_JSON/.test(YML));
/* 12 */ ok("12 sem chave JSON (keys create / key-file)", !/keys\s+create/.test(YML) && !/key-file/i.test(YML));
/* 13 */ ok("13 sem operacoes de segredo",
  !/gcloud\s+secrets/.test(YML) && !/versions\s+access/.test(YML) && !/versions\s+add/.test(YML) && !/--data-file/.test(YML));
/* 14 */ ok("14 sem nome literal do segredo", !/NOTIF_PREFS_SECRET/.test(YML));
/* 15 */ ok("15 sem ENABLE_NOTIF_PREFS", !/ENABLE_NOTIF_PREFS/.test(YML));
/* 16 */ ok("16 sem ENABLE_NOTIF_LOG", !/ENABLE_NOTIF_LOG/.test(YML));
/* 17 */ ok("17 sem firebase", !/firebase/i.test(YML));
/* 18 */ ok("18 sem deploy / --only", !/\bdeploy\b/i.test(YML) && !/--only/.test(YML));
/* 19 */ ok("19 sem mutacao de policies",
  !/policies\s+create/.test(YML) && !/policies\s+update/.test(YML) && !/policies\s+delete/.test(YML));
/* 20 */ ok("20 sem mutacao de channels",
  !/channels\s+create/.test(YML) && !/channels\s+update/.test(YML) && !/channels\s+delete/.test(YML));
/* 21 */ ok("21 sem mutacao de IAM",
  !/add-iam-policy-binding/.test(YML) && !/set-iam-policy/.test(YML) && !/remove-iam-policy-binding/.test(YML));
/* 22 */ ok("22 sem mutacao de service accounts / invoker",
  !/service-accounts/.test(YML) && !/run\.invoker/.test(YML) && !/add-invoker-policy-binding/.test(YML));
/* 23 */ ok("23 sem updateNotifPrefs", !/updateNotifPrefs/.test(YML));
/* 24 */ ok("24 sem firestore/hosting/wrangler/checkout/set -x",
  !/firestore/.test(YML) && !/hosting/.test(YML) && !/wrangler/.test(YML) && !/actions\/checkout/.test(YML) && !/set\s+-x/.test(YML));

/* 25 */ ok("25 service names corretos",
  /FUNCTION_NAME:\s*"issueNotifPrefsToken"/.test(YML) && /RUN_SERVICE_NAME:\s*"issuenotifprefstoken"/.test(YML) && /REGION:\s*"us-central1"/.test(YML));
/* 26 */ ok("26 run services describe usa RUN_SERVICE_NAME",
  /gcloud\s+run\s+services\s+describe\s+"\$RUN_SERVICE_NAME"/.test(YML));
/* 27 */ ok("27 logging read filtra service_name=issuenotifprefstoken",
  /gcloud\s+logging\s+read/.test(YML) && /service_name="'"\$RUN_SERVICE_NAME"'"/.test(YML));
/* 28 */ ok("28 functions describe gen2 usa FUNCTION_NAME",
  /gcloud\s+functions\s+describe\s+"\$FUNCTION_NAME"\s+--gen2/.test(YML));
/* 29 */ ok("29 channels list + metric-descriptors list (com fallback track)",
  /monitoring\s+channels\s+list/.test(YML) && /metric-descriptors\s+list/.test(YML) && /\$\{track\}monitoring/.test(YML));
/* 30 */ ok("30 policies list (read)", /gcloud\s+monitoring\s+policies\s+list/.test(YML));

/* 31 */ ok("31 usa PIPESTATUS (rc real)", /\$\{PIPESTATUS\[0\]\}/.test(YML));
/* 32 */ ok("32 contagem segura (UNKNOWN quando rc!=0) + stderr separado",
  /=UNKNOWN/.test(YML) && /2>[a-z_]+_err/.test(YML));
/* 33 */ ok("33 set +e (tolerancia a falha por comando)", /set \+e/.test(YML));

/* 34 */ ok("34 RELATORIO parse-friendly (begin/end + chaves)",
  /RELATORIO_BEGIN/.test(YML) && /RELATORIO_END/.test(YML) &&
  /SERVICE_ACCOUNT_USED=monitoring-auditor@/.test(YML) &&
  /WIF_PROVIDER=projects\/391529908613\//.test(YML));
/* 35 */ ok("35 contadores de nao-mutacao = 0",
  /ALERTAS_CRIADOS=0/.test(YML) && /CANAIS_CRIADOS=0/.test(YML) && /POLICIES_ALTERADAS=0/.test(YML) &&
  /DEPLOY_EXECUTADO=0/.test(YML) && /SEGREDO_ACESSADO=0/.test(YML));

console.log("\n===== F3.3.20-B1.7-C-FIX — guard MONITORING-AUDIT WIF (f3320-b17c-monitoring-audit.yml) =====");
console.log("  WIF auth@v2 · monitoring-auditor · id-token:write · contents:read · mode==audit_only");
console.log("  service_name=issuenotifprefstoken · PIPESTATUS · contagem so com rc==0 · RELATORIO_BEGIN/END");
console.log("  SOMENTE read-only · SEM chave/segredo/deploy/IAM/policies-channels create/update/delete");
console.log("=========================================================================================\n");
console.log("F3.3.20-B1.7-C-FIX monitoring-audit-guard: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
