#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.6-G-B — Guard do workflow DORMANT-1
 * (.github/workflows/firebase-functions-deploy-dormant1.yml).
 * Le o YAML e prova (offline, sem executar o workflow):
 *  - allowlist FIXA = {onTaskCreated,onEventCreated,onChatMessageCreated};
 *  - rejeita 'functions' (total), updateNotifPrefs, issueNotifPrefsToken, vazio, token desconhecido;
 *  - dry_run default "true"; pin do blob ced2518; checkout fixo app/main; somente workflow_dispatch;
 *  - NENHUM comando de deploy total; NAO cria NOTIF_PREFS_SECRET; NAO ativa ENABLE_NOTIF_*.
 * O validador JS deriva a allowlist do PROPRIO YAML (linha ALLOW="..."), evitando drift.
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

// Validador que espelha as regras do guard do workflow (usa ALLOW derivada do YAML).
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

/* ===== 1) allowlist aceita exatamente os 3 triggers ===== */
ok("1 allowlist = exatamente os 3 triggers",
  ALLOW.length === 3 &&
  ["onTaskCreated", "onEventCreated", "onChatMessageCreated"].every((x) => ALLOW.includes(x)));
ok("1b aceita o csv default (3 triggers)",
  validate("onTaskCreated,onEventCreated,onChatMessageCreated").ok === true &&
  validate("onTaskCreated,onEventCreated,onChatMessageCreated").target === "functions:onTaskCreated,onEventCreated,onChatMessageCreated");
ok("1c aceita subconjunto (1 trigger)", validate("onTaskCreated").ok === true);

/* ===== 2) rejeita 'functions' (deploy total) ===== */
ok("2 rejeita 'functions'", validate("functions").ok === false && validate("functions").reason === "total");
ok("2b rejeita lista contendo functions", validate("onTaskCreated,functions").ok === false);

/* ===== 3-4) rejeita endpoints novos ===== */
ok("3 rejeita updateNotifPrefs", validate("updateNotifPrefs").ok === false);
ok("4 rejeita issueNotifPrefsToken", validate("issueNotifPrefsToken").ok === false);
ok("3b rejeita endpoint no meio da lista", validate("onTaskCreated,updateNotifPrefs").ok === false);

/* ===== 5) rejeita lista vazia ===== */
ok("5 rejeita vazio/espacos", validate("").ok === false && validate("   ").ok === false);

/* ===== 6) rejeita token desconhecido ===== */
ok("6 rejeita token desconhecido", validate("onFoo").ok === false && validate("onTaskCreated,onBar").ok === false);

/* ===== 7) dry_run default true ===== */
ok("7 dry_run default \"true\"", /dry_run:[\s\S]*?required:\s*true[\s\S]*?default:\s*"true"/.test(YML));

/* ===== 8) pin do blob ced2518 presente (env + step) ===== */
ok("8 pin blob ced2518 (PINNED_FUNCTIONS_BLOB)", /PINNED_FUNCTIONS_BLOB:\s*"ced2518394d73b41512ac3da72b8b8de935b295c"/.test(YML));
ok("8b step de pin compara HEAD:functions/index.js", /git rev-parse HEAD:functions\/index\.js/.test(YML) && /!=\s*"\$PINNED_FUNCTIONS_BLOB"/.test(YML));

/* ===== 9) NENHUM comando de deploy total ===== */
// o unico 'firebase deploy' deve usar --only "$TARGET"; nunca '--only functions' (sem ':')
ok("9 sem 'firebase deploy --only functions' (total)", !/firebase deploy --only\s+"?functions"?(\s|--|"|$)/.test(YML));
ok("9b deploy real usa --only \"$TARGET\"", /firebase deploy --only "\$TARGET" --project/.test(YML));
ok("9c trava final bloqueia alvo total", /case "\$TARGET" in[\s\S]*?functions\|functions:\)/.test(YML));

/* ===== 10) NAO cria/usa NOTIF_PREFS_SECRET ===== */
ok("10 sem 'secrets create NOTIF_PREFS_SECRET'", !/secrets\s+create\s+NOTIF_PREFS_SECRET/.test(YML));
ok("10b sem 'secrets versions add NOTIF_PREFS_SECRET'", !/secrets\s+versions\s+add\s+NOTIF_PREFS_SECRET/.test(YML));

/* ===== 11-12) NAO ativa flags (set-env-vars / =true sem aspas / config:set) ===== */
ok("11/12 sem ativacao de flags (set-env-vars / =true sem aspas / config:set)",
  !/--set-env-vars[^\n]*ENABLE_NOTIF/.test(YML) &&
  !/ENABLE_NOTIF_(PREFS|LOG)[ \t]*=[ \t]*true\b/.test(YML) &&        // detecta '="true"' (com aspas) NAO casa
  !/functions:config:set[^\n]*ENABLE_NOTIF/.test(YML));
ok("12b .env aborta se contiver ENABLE_NOTIF_*", /grep -q 'ENABLE_NOTIF_'/.test(YML));

/* ===== extras de seguranca ===== */
ok("E1 somente workflow_dispatch (sem push/pull_request)",
  /on:\s*\n\s*workflow_dispatch:/.test(YML) && !/\n\s*push:/.test(YML) && !/\n\s*pull_request:/.test(YML));
ok("E2 checkout ref fixo app/main", /ref:\s*app\/main/.test(YML));
ok("E3 guard confirm_deploy != DEPLOY", /\$CONFIRM"?\s*!=\s*"DEPLOY"|"\$CONFIRM"\s*!=\s*"DEPLOY"/.test(YML));
ok("E4 inputs via env (sem injecao direta no shell do csv)", /FUNCTIONS_CSV:\s*\$\{\{\s*github\.event\.inputs\.functions_csv\s*\}\}/.test(YML) && /RAW="\$\{FUNCTIONS_CSV\/\/ \/\}"/.test(YML));
ok("E5 pos-deploy valida endpoints ausentes + segredo ausente",
  /updateNotifPrefs presente/.test(YML) && /issueNotifPrefsToken presente/.test(YML) && /NOTIF_PREFS_SECRET existe/.test(YML));

console.log("\n========= F3.3.20-B1.6-G-B — guard workflow DORMANT-1 =========");
console.log("  allowlist {onTaskCreated,onEventCreated,onChatMessageCreated} derivada do YAML");
console.log("  rejeita: functions(total) · updateNotifPrefs · issueNotifPrefsToken · vazio · desconhecido");
console.log("  dry_run default true · pin ced2518 · sem deploy total · sem segredo · sem flags");
console.log("===============================================================\n");
console.log("F3.3.20-B1.6-G-B dormant1-guard: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
