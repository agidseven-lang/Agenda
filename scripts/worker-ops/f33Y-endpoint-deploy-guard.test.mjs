#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-C — Guard do workflow ENDPOINT-ONLY
 * (.github/workflows/firebase-functions-deploy-endpoint.yml).
 * Le o YAML e prova (offline; sem executar; sem tocar Firebase):
 *  - workflow_dispatch only; inputs confirm_deploy/dry_run/function_name;
 *    confirm_deploy == DEPLOY_ENDPOINT; dry_run default "true";
 *  - allowlist FIXA {issueNotifPrefsToken, updateNotifPrefs}; rejeita
 *    'functions'(total) / 3 triggers / lista / virgula / espaco / curinga / desconhecido;
 *  - checkout fixo app/main; pin blob ced2518; prechecks f33R..f33V; auth via SA;
 *    functions:list antes; dry_run nao deploya; deploy real usa EXATAMENTE functions:<FN>;
 *  - sem deploy total; sem --set-env-vars; sem ENABLE_NOTIF_PREFS/LOG; sem WebPush/Hosting/
 *    Rules/Worker/Desktop/Android; sem 'versions access'; sem operacao no segredo;
 *  - pos-deploy valida (metadados) alvo presente + flags OFF; cleanup de SA + .env.
 * Rodar: node scripts/worker-ops/f33Y-endpoint-deploy-guard.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YML_PATH = path.resolve(__dirname, "..", "..", ".github", "workflows", "firebase-functions-deploy-endpoint.yml");

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

ok("1 workflow existe", fs.existsSync(YML_PATH));
const YML = fs.existsSync(YML_PATH) ? fs.readFileSync(YML_PATH, "utf8") : "";

// Extrai corpo de um step (do "- name: <nome>" ate o proximo "- name:").
function stepBody(name) {
  const tag = "- name: " + name;
  const i = YML.indexOf(tag); if (i < 0) return "";
  const rest = YML.slice(i + tag.length);
  const j = rest.indexOf("\n      - name:");
  return j < 0 ? rest : rest.slice(0, j);
}

// Allowlist derivada do YAML (linha:  ALLOW="issueNotifPrefsToken updateNotifPrefs")
const mAllow = YML.match(/ALLOW="([^"]+)"/);
const ALLOW = mAllow ? mAllow[1].trim().split(/\s+/) : [];

// Espelha o guard de allowlist do workflow.
function validate(fn) {
  const s = String(fn);
  if (s === "") return { ok: false, reason: "vazio" };
  if (s.includes(",")) return { ok: false, reason: "lista" };
  if (s.includes(" ")) return { ok: false, reason: "espaco" };
  if (s.includes("*")) return { ok: false, reason: "curinga" };
  if (s === "functions") return { ok: false, reason: "total" };
  if (!ALLOW.includes(s)) return { ok: false, reason: "fora-allowlist" };
  return { ok: true, target: "functions:" + s };
}

/* 2) workflow_dispatch only */
ok("2 workflow_dispatch only",
  /on:\s*\n\s*workflow_dispatch:/.test(YML) &&
  !/\n\s*push:/.test(YML) && !/\n\s*pull_request:/.test(YML) && !/\n\s*schedule:/.test(YML));

/* 3) inputs existem */
ok("3 inputs confirm_deploy/dry_run/function_name",
  /confirm_deploy:/.test(YML) && /dry_run:/.test(YML) && /function_name:/.test(YML));

/* 4) confirm_deploy == DEPLOY_ENDPOINT */
ok("4 confirm == DEPLOY_ENDPOINT", /"\$CONFIRM"\s*!=\s*"DEPLOY_ENDPOINT"/.test(YML));

/* 5) dry_run default true */
ok("5 dry_run default \"true\"", /dry_run:[\s\S]*?required:\s*true[\s\S]*?default:\s*"true"/.test(YML));

/* 6) allowlist exata {issueNotifPrefsToken, updateNotifPrefs} */
ok("6 allowlist = 2 endpoints",
  ALLOW.length === 2 && ALLOW.includes("issueNotifPrefsToken") && ALLOW.includes("updateNotifPrefs") &&
  validate("issueNotifPrefsToken").ok === true && validate("updateNotifPrefs").ok === true);

/* 7) bloqueia 'functions' (total) */
ok("7 bloqueia functions (total)", validate("functions").ok === false);

/* 8) bloqueia os 3 triggers */
ok("8 bloqueia 3 triggers",
  validate("onTaskCreated").ok === false && validate("onEventCreated").ok === false && validate("onChatMessageCreated").ok === false);

/* 9) bloqueia lista multipla */
ok("9 bloqueia lista/virgula",
  validate("issueNotifPrefsToken,updateNotifPrefs").ok === false && validate("issueNotifPrefsToken updateNotifPrefs").ok === false);

/* 10) bloqueia curinga */
ok("10 bloqueia curinga", validate("issue*").ok === false && validate("*").ok === false);

/* 11) bloqueia desconhecido + vazio */
ok("11 bloqueia desconhecido/vazio", validate("foo").ok === false && validate("").ok === false);

/* 12) checkout fixo app/main */
ok("12 checkout ref app/main", /ref:\s*app\/main/.test(YML) && /actions\/checkout/.test(YML));

/* 13) pin ced2518 */
ok("13 pin blob ced2518",
  /PINNED_FUNCTIONS_BLOB:\s*"ced2518394d73b41512ac3da72b8b8de935b295c"/.test(YML) && /git rev-parse HEAD:functions\/index\.js/.test(YML));

/* 14) prechecks f33R..f33V */
ok("14 prechecks f33R..f33V",
  /f33R-notif-prefs-log/.test(YML) && /f33S-notif-prefs-endpoint/.test(YML) && /f33T-notif-prefs-token-issuer/.test(YML) &&
  /f33U-notif-send-prefs-integration/.test(YML) && /f33V-notif-hardening/.test(YML) && /node --check functions\/index\.js/.test(YML));

/* 15) auth via GOOGLE_APPLICATION_CREDENTIALS_JSON */
ok("15 auth via SA secret", /secrets\.GOOGLE_APPLICATION_CREDENTIALS_JSON/.test(YML) && /gcloud auth activate-service-account/.test(YML));

/* 16) functions:list antes (leitura) */
ok("16 functions:list antes", /Estado ANTES/.test(YML) && /firebase functions:list/.test(YML));

/* 17) dry-run nao executa deploy */
ok("17 deploy gated em dry_run=false", /if \[ "\$DRY_RUN" = "false" \]; then[\s\S]*?firebase deploy --only "\$TARGET"/.test(YML));

/* 18) deploy real usa EXATAMENTE functions:<function_name> */
ok("18 alvo = functions:$FN, --only \"$TARGET\", --force",
  /TARGET="functions:\$FN"/.test(YML) &&
  /firebase deploy --only "\$TARGET" --project "\$GCP_PROJECT" --non-interactive --force/.test(YML));

/* 19) sem deploy total */
ok("19 sem deploy total",
  !/firebase deploy --only\s+"?functions"?(\s|--|"|$)/.test(YML) &&
  /case "\$TARGET" in[\s\S]*?functions\|functions:\)/.test(YML));

/* 20) sem --set-env-vars */
ok("20 sem --set-env-vars", !/set-env-vars/.test(YML));

/* 21) sem ENABLE_NOTIF_PREFS (nome completo) */
ok("21 sem ENABLE_NOTIF_PREFS", !/ENABLE_NOTIF_PREFS/.test(YML));

/* 22) sem ENABLE_NOTIF_LOG (nome completo) */
ok("22 sem ENABLE_NOTIF_LOG", !/ENABLE_NOTIF_LOG/.test(YML));

/* 23) sem Web Push */
ok("23 sem Web Push", !/web ?push/i.test(YML) && !/clientPushSubs/.test(YML) && !/vapid/i.test(YML));

/* 24) sem Hosting */
ok("24 sem hosting", !/hosting/i.test(YML));

/* 25) sem Firestore Rules */
ok("25 sem firestore:rules", !/firestore/i.test(YML) && !/\brules\b/i.test(YML));

/* 26) sem Worker/Desktop/Android */
ok("26 sem worker/desktop/android", !/wrangler/i.test(YML) && !/cloudflare/i.test(YML) && !/desktop/i.test(YML) && !/android/i.test(YML));

/* 27) sem 'versions access' */
ok("27 sem versions access", !/versions\s+access/.test(YML) && !/\baccess\b/.test(YML));

/* 28) nao opera/le o segredo (sem comandos gcloud secrets) */
ok("28 nenhuma operacao no segredo", !/gcloud secrets/.test(YML));

/* 29) pos-deploy valida flags OFF (metadados) */
const POS = stepBody("Validacao POS-deploy (metadados; somente se dry_run=false)");
ok("29 POS valida flags OFF + alvo presente",
  POS.length > 0 && /firebase functions:list/.test(POS) && /gcloud functions describe/.test(POS) && /ENABLE_NOTIF/.test(POS));

/* 30) cleanup (SA + .env) */
ok("30 cleanup SA + .env",
  /rm -f[^\n]*gcp-sa\.json/.test(YML) && /functions\/\.env\./.test(YML) && /if:\s*always\(\)/.test(YML));

console.log("\n===== F3.3.20-B1.7-C — guard ENDPOINT-ONLY (firebase-functions-deploy-endpoint.yml) =====");
console.log("  workflow_dispatch only · confirm DEPLOY_ENDPOINT · dry_run default true");
console.log("  allowlist {issueNotifPrefsToken, updateNotifPrefs} · 1 por vez · sem total/triggers/lista/curinga");
console.log("  pin ced2518 · prechecks f33R..f33V · checkout app/main · deploy --only functions:<FN>");
console.log("  sem flags/WebPush/Hosting/Rules/Worker/Desktop/Android/versions-access · pos-deploy so metadados");
console.log("=============================================================================\n");
console.log("F3.3.20-B1.7-C endpoint-deploy-guard: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
