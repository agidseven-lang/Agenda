#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.6-L-B — Guard do workflow DORMANT-1
 * (.github/workflows/firebase-functions-deploy-dormant1.yml).
 * Le o YAML e prova (offline, sem executar o workflow):
 *  - allowlist FIXA = {onTaskCreated,onEventCreated,onChatMessageCreated}; rejeita
 *    'functions' (total)/updateNotifPrefs/issueNotifPrefsToken/vazio/desconhecido;
 *  - dry_run default "true"; deploy real so com confirm_deploy=DEPLOY + dry_run=false;
 *  - pin do blob ced2518; checkout fixo app/main; workflow_dispatch only; NENHUM deploy total;
 *  - NOTIF_PREFS_SECRET: preflight cria so PLACEHOLDER (gated dry_run=false), sem valor real,
 *    sem imprimir valor, sem ativar ENABLE_NOTIF_*;
 *  - POS-deploy valida DORMENCIA REAL: endpoints novos AUSENTES + flags OFF;
 *    NAO exige segredo ausente (placeholder inerte e tolerado).
 * Rodar: node scripts/worker-ops/f33W-dormant1-guard.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const YML = fs.readFileSync(
  path.resolve(__dirname, "..", "..", ".github", "workflows", "firebase-functions-deploy-dormant1.yml"),
  "utf8"
);

// Allowlist derivada do proprio YAML (linha:  ALLOW="onTaskCreated onEventCreated onChatMessageCreated")
const mAllow = YML.match(/ALLOW="([^"]+)"/);
const ALLOW = mAllow ? mAllow[1].trim().split(/\s+/) : [];

// Extrai o corpo de um step (do "- name: <nome>" ate o proximo "- name:").
function stepBody(name) {
  const tag = "- name: " + name;
  const i = YML.indexOf(tag);
  if (i < 0) return "";
  const rest = YML.slice(i + tag.length);
  const j = rest.indexOf("\n      - name:");
  return j < 0 ? rest : rest.slice(0, j);
}

// Validador que espelha as regras do guard de allowlist (usa ALLOW derivada do YAML).
function validate(csv) {
  const raw = String(csv).replace(/\s+/g, "");
  if (!raw) return { ok: false, reason: "vazio" };
  for (const t of raw.split(",")) {
    if (t === "functions") return { ok: false, reason: "total" };
    if (t === "updateNotifPrefs" || t === "issueNotifPrefsToken") return { ok: false, reason: "endpoint:" + t };
    if (!ALLOW.includes(t)) return { ok: false, reason: "fora-allowlist:" + (t || "<vazio>") };
  }
  return { ok: true, target: "functions:" + raw };
}

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

/* ===== 1-6) allowlist (bloqueia total/endpoints/vazio/desconhecido) ===== */
ok("1 allowlist = 3 triggers", ALLOW.length === 3 && ["onTaskCreated", "onEventCreated", "onChatMessageCreated"].every((x) => ALLOW.includes(x)));
ok("1b aceita csv default", validate("onTaskCreated,onEventCreated,onChatMessageCreated").ok === true);
ok("1c aceita subconjunto", validate("onTaskCreated").ok === true);
ok("6 bloqueia 'functions' total", validate("functions").ok === false && validate("functions").reason === "total");
ok("6b bloqueia lista com functions", validate("onTaskCreated,functions").ok === false);
ok("7 bloqueia updateNotifPrefs", validate("updateNotifPrefs").ok === false);
ok("8 bloqueia issueNotifPrefsToken", validate("issueNotifPrefsToken").ok === false);
ok("8b bloqueia endpoint no meio", validate("onTaskCreated,updateNotifPrefs").ok === false);
ok("R1 rejeita vazio", validate("").ok === false && validate("   ").ok === false);
ok("R2 rejeita desconhecido", validate("onFoo").ok === false && validate("onTaskCreated,onBar").ok === false);

/* ===== 9-10) dry_run default true; deploy real so com confirm + dry_run=false ===== */
ok("9 dry_run default \"true\"", /dry_run:[\s\S]*?required:\s*true[\s\S]*?default:\s*"true"/.test(YML));
ok("10 deploy real so com confirm_deploy=DEPLOY", /"\$CONFIRM"\s*!=\s*"DEPLOY"/.test(YML));
ok("10b deploy real so com dry_run=false", /if \[ "\$DRY_RUN" = "false" \]; then[\s\S]*?firebase deploy --only "\$TARGET"/.test(YML));

/* ===== pin + sem deploy total ===== */
ok("P1 pin blob ced2518", /PINNED_FUNCTIONS_BLOB:\s*"ced2518394d73b41512ac3da72b8b8de935b295c"/.test(YML) && /git rev-parse HEAD:functions\/index\.js/.test(YML));
ok("14/15 sem 'firebase deploy --only functions' (total)", !/firebase deploy --only\s+"?functions"?(\s|--|"|$)/.test(YML));
ok("15b deploy real usa --only \"$TARGET\"", /firebase deploy --only "\$TARGET" --project/.test(YML));
ok("15c trava final bloqueia alvo total", /case "\$TARGET" in[\s\S]*?functions\|functions:\)/.test(YML));

/* ===== 1-2) placeholder NOTIF_PREFS_SECRET: permitido, sem valor real, gated, nao ativa trilho ===== */
const PRE = stepBody("Placeholder NOTIF_PREFS_SECRET");
ok("L1 preflight do placeholder existe (secrets create)", PRE.length > 0 && /secrets create NOTIF_PREFS_SECRET/.test(PRE));
ok("L1b preflight gated em dry_run=false", /if:\s*\$\{\{\s*github\.event\.inputs\.dry_run\s*==\s*'false'\s*\}\}/.test(PRE));
ok("L1c valor e PLACEHOLDER (sem valor real/PII)", /PLACEHOLDER_NOT_CONFIGURED_DORMANT1/.test(PRE) && /--data-file=-/.test(PRE));
ok("L1d placeholder nao imprime valor (sem echo do valor)", !/echo[^\n]*PLACEHOLDER_NOT_CONFIGURED/.test(PRE));
ok("L2 placeholder nao ativa o trilho (sem ENABLE_NOTIF no preflight)", !/ENABLE_NOTIF/.test(PRE));

/* ===== 11-12) NAO ativa flags (sem escrita / set-env-vars / config:set) ===== */
ok("11 sem ativacao de ENABLE_NOTIF_PREFS",
  !/--set-env-vars[^\n]*ENABLE_NOTIF/.test(YML) &&
  !/functions:config:set[^\n]*ENABLE_NOTIF/.test(YML) &&
  !/printf[^\n]*ENABLE_NOTIF/.test(YML) &&
  !/echo[^\n]*ENABLE_NOTIF_[A-Z]+=true/.test(YML));
ok("12 .env aborta se contiver ENABLE_NOTIF_*", /grep -q 'ENABLE_NOTIF_'/.test(YML));

/* ===== 3-5) POS-deploy valida dormencia real (endpoints ausentes + flags OFF; segredo nao exigido ausente) ===== */
const POS = stepBody("Validacao POS-deploy");
ok("3 POS NAO exige mais segredo ausente", POS.length > 0 && !/NOTIF_PREFS_SECRET existe/.test(POS) && !/NOTIF_PREFS_SECRET existe/.test(YML));
ok("4 POS exige updateNotifPrefs AUSENTE", /updateNotifPrefs publicado/.test(POS) && /updateNotifPrefs\(\[\^A-Za-z\]/.test(POS));
ok("4b POS exige issueNotifPrefsToken AUSENTE", /issueNotifPrefsToken publicado/.test(POS) && /issueNotifPrefsToken\(\[\^A-Za-z\]/.test(POS));
ok("5 POS valida flags OFF (describe env)", /gcloud functions describe[\s\S]*?ENABLE_NOTIF_\(PREFS\|LOG\)=true/.test(POS) && /flag ativada em \$FN/.test(POS));

/* ===== 13) extras de seguranca ===== */
ok("13 somente workflow_dispatch (sem push/pull_request)", /on:\s*\n\s*workflow_dispatch:/.test(YML) && !/\n\s*push:/.test(YML) && !/\n\s*pull_request:/.test(YML));
ok("13b checkout ref fixo app/main", /ref:\s*app\/main/.test(YML));
ok("13c inputs via env (sem injecao do csv)", /FUNCTIONS_CSV:\s*\$\{\{\s*github\.event\.inputs\.functions_csv\s*\}\}/.test(YML) && /RAW="\$\{FUNCTIONS_CSV\/\/ \/\}"/.test(YML));
ok("13d nao toca Worker/Desktop/Android/Rules", !/wrangler|cloudflare-worker|electron-builder|gradlew|firestore:rules|--only hosting/.test(YML));

console.log("\n===== F3.3.20-B1.6-L-B — guard DORMANT-1 (placeholder + dormencia real) =====");
console.log("  allowlist 3 triggers · sem deploy total · dry_run default true");
console.log("  NOTIF_PREFS_SECRET: placeholder gated (dry_run=false), sem valor real, nao ativa trilho");
console.log("  POS-deploy: endpoints AUSENTES + flags OFF (placeholder de segredo inerte tolerado)");
console.log("=============================================================================\n");
console.log("F3.3.20-B1.6-L-B dormant1-guard: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
