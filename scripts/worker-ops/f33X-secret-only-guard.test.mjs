#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-B' — Guard do workflow SECRET-ONLY de NOTIF_PREFS_SECRET
 * (.github/workflows/notif-prefs-secret-set.yml).
 * Le o YAML e prova (offline; sem executar o workflow; sem tocar Firebase):
 *  - workflow_dispatch only; input obrigatorio confirm_secret_update == UPDATE_NOTIF_PREFS_SECRET;
 *  - permissions: contents: read; concurrency propria; auth via GOOGLE_APPLICATION_CREDENTIALS_JSON;
 *  - geracao CSPRNG (randomBytes >= 32 bytes, base64url) canalizada DIRETO p/ versions add --data-file=-;
 *  - valor nunca em variavel / echo / log; sem "versions access"; sem "set -x";
 *  - SEM publicacao de funcoes, SEM flags, SEM endpoints, SEM regras/hosting/worker, SEM checkout, SEM .env;
 *  - cleanup do arquivo temporario da service account (if: always()).
 * Rodar: node scripts/worker-ops/f33X-secret-only-guard.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YML_PATH = path.resolve(__dirname, "..", "..", ".github", "workflows", "notif-prefs-secret-set.yml");

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

/* 1) workflow existe */
ok("1 workflow existe", fs.existsSync(YML_PATH));
const YML = fs.existsSync(YML_PATH) ? fs.readFileSync(YML_PATH, "utf8") : "";

/* 2) workflow_dispatch only (sem push/pull_request/schedule) */
ok("2 workflow_dispatch only",
  /on:\s*\n\s*workflow_dispatch:/.test(YML) &&
  !/\n\s*push:/.test(YML) && !/\n\s*pull_request:/.test(YML) && !/\n\s*schedule:/.test(YML));

/* 3) input obrigatorio confirm_secret_update */
ok("3 input confirm_secret_update (required:true)",
  /confirm_secret_update:/.test(YML) && /confirm_secret_update:[\s\S]*?required:\s*true/.test(YML));

/* 4) confirmacao exigida UPDATE_NOTIF_PREFS_SECRET (guard real) */
ok("4 confirma == UPDATE_NOTIF_PREFS_SECRET", /"\$CONFIRM"\s*!=\s*"UPDATE_NOTIF_PREFS_SECRET"/.test(YML));

/* 5) permissions: contents: read */
ok("5 permissions contents:read", /permissions:\s*\n\s*contents:\s*read/.test(YML));

/* 6) sem checkout */
ok("6 sem checkout", !/checkout/.test(YML));

/* 7) sem 'firebase deploy' (e sem a palavra deploy) */
ok("7 sem firebase deploy", !/firebase\s+deploy/.test(YML) && !/\bdeploy\b/.test(YML));

/* 8) sem deploy de functions (sem 'functions' e sem --only) */
ok("8 sem deploy de functions", !/\bfunctions\b/.test(YML) && !/--only/.test(YML));

/* 9) sem --set-env-vars */
ok("9 sem --set-env-vars", !/set-env-vars/.test(YML));

/* 10) sem ENABLE_NOTIF_PREFS */
ok("10 sem ENABLE_NOTIF_PREFS", !/ENABLE_NOTIF_PREFS/.test(YML));

/* 11) sem ENABLE_NOTIF_LOG */
ok("11 sem ENABLE_NOTIF_LOG", !/ENABLE_NOTIF_LOG/.test(YML));

/* 12) sem updateNotifPrefs */
ok("12 sem updateNotifPrefs", !/updateNotifPrefs/.test(YML));

/* 13) sem issueNotifPrefsToken */
ok("13 sem issueNotifPrefsToken", !/issueNotifPrefsToken/.test(YML));

/* 14) sem firestore:rules (e sem firestore) */
ok("14 sem firestore:rules", !/firestore/.test(YML));

/* 15) sem hosting */
ok("15 sem hosting", !/hosting/.test(YML));

/* 16) sem wrangler */
ok("16 sem wrangler", !/wrangler/.test(YML));

/* 17) sem .env */
ok("17 sem .env", !/\.env\b/.test(YML));

/* 18) sem 'versions access' (e sem a palavra access) */
ok("18 sem versions access", !/versions\s+access/.test(YML) && !/\baccess\b/.test(YML));

/* 19) sem 'set -x' */
ok("19 sem set -x", !/set\s+-x/.test(YML));

/* 20) usa --data-file=- */
ok("20 usa --data-file=-", /--data-file=-/.test(YML));

/* 21) geracao CSPRNG no runner (randomBytes >= 32 bytes, base64url) */
ok("21 CSPRNG no runner (randomBytes>=32, base64url)",
  /randomBytes\(\s*(3[2-9]|[4-9]\d|\d{3,})\s*\)/.test(YML) && /base64url/.test(YML));

/* 22) cleanup do arquivo temporario da service account (if: always()) */
ok("22 cleanup do SA temp (if:always)", /rm -f[^\n]*gcp-sa\.json/.test(YML) && /if:\s*always\(\)/.test(YML));

/* 23) valor real nao e impresso: gerado e canalizado DIRETO; nunca em var/echo */
ok("23 valor canalizado direto (sem var/echo do valor)",
  /randomBytes[\s\S]*?\|\s*gcloud secrets versions add/.test(YML) &&
  !/\b\w+=\$\([^)]*randomBytes/.test(YML) &&
  !/echo[^\n]*randomBytes/.test(YML));

/* 24) nao depende de checkout de codigo (sem actions/checkout; sem ler git/codigo) */
ok("24 nao depende de checkout de codigo", !/actions\/checkout/.test(YML) && !/git\s+rev-parse/.test(YML));

console.log("\n===== F3.3.20-B1.7-B' — guard SECRET-ONLY (notif-prefs-secret-set.yml) =====");
console.log("  workflow_dispatch only · confirm UPDATE_NOTIF_PREFS_SECRET · permissions contents:read");
console.log("  CSPRNG -> versions add --data-file=- · valor nunca impresso");
console.log("  SEM publish/flags/endpoints/regras/hosting/worker/checkout/.env/versions-access/set-x");
console.log("=============================================================================\n");
console.log("F3.3.20-B1.7-B' secret-only-guard: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
