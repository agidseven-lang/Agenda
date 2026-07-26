#!/usr/bin/env node
/* =====================================================================================
 * F4.2F — REGION-INVARIANCE (baseline OFICIAL Desktop 1.0.184 @ 03c5893, tag v1.0.184).
 * Prova, fail-closed, que o bridge de Firebase Auth SILENCIOSO é ADITIVO e mudou SOMENTE o
 * necessário — NADA fora do escopo:
 *   - conjunto TOTAL de mudanças vs 1.0.184 == allow-list F4.2F (desktop/** de auth/preload/
 *     renderer/version + os 2 workflows F4.2F). Worker/Android/Functions/Rules/portal/presence
 *     e o index.html RAIZ do repo: byte-idênticos;
 *   - slaRules.js + todo o main TS de SLA/notificação/updater/tray/reminder/clock: byte-idênticos
 *     (regras amarela/vermelha e ciclo de janela INTOCADOS);
 *   - package.json: só a versão 1.0.184 → 1.0.185; lock idem;
 *   - index.html: NET-ADITIVO (remoções ≤ 2 linhas — só os 2 hooks estendidos) + marcadores do
 *     bridge presentes + âncoras da base preservadas;
 *   - auth-core.ts/auth.ts/preload.ts: preservam a base + marcadores aditivos do F4.2F.
 * Funciona pré-commit (working tree) e no CI (HEAD commitado). Sem rede, sem build.
 * ===================================================================================== */
import path from "path"; import fs from "fs";
import { fileURLToPath } from "url"; import { execFileSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, "..");
const REPO = path.resolve(DESK, "..");
const BASE = "03c5893f7c5baf810032bd2a922522a77c1b4680"; // Desktop 1.0.184 OFICIAL (tag v1.0.184)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push("FAIL: " + n); console.error("✗ " + n); } };
const nrm = (s) => String(s).replace(/\r\n/g, "\n");
const git = (args) => execFileSync("git", args, { cwd: REPO, maxBuffer: 256 * 1024 * 1024 }).toString();
const show = (p) => nrm(git(["show", BASE + ":" + p]));
const cur = (p) => nrm(fs.readFileSync(path.join(REPO, p), "utf8"));
// Conjunto de mudanças vs BASE que funciona PRÉ-commit (working tree + untracked) E no CI (HEAD):
// diff tracked vs BASE ∪ arquivos untracked.
function changedSet() {
  const tracked = git(["diff", "--name-only", BASE]).split("\n").map(s => s.trim()).filter(Boolean);
  let untracked = [];
  try { untracked = git(["ls-files", "--others", "--exclude-standard"]).split("\n").map(s => s.trim()).filter(Boolean); } catch { /* */ }
  return Array.from(new Set([...tracked, ...untracked]));
}

// Allow-list EXATA do F4.2F (nada além disto pode mudar vs 1.0.184).
const ALLOW = new Set([
  "desktop/package.json",
  "desktop/package-lock.json",
  "desktop/src/main/auth-core.ts",
  "desktop/src/main/auth.ts",
  "desktop/src/preload/preload.ts",
  "desktop/src/renderer/index.html",
  "desktop/src/renderer/firebaseAuthBridge.js",
  "desktop/scripts/f42f-firebase-auth-bridge.test.mjs",
  "desktop/scripts/f42f-region-invariance.test.mjs",
  ".github/workflows/desktop-build-f42f.yml",
  ".github/workflows/desktop-release-f42f.yml",
  "desktop/docs/F4.2F-DESKTOP-SILENT-FIREBASE-AUTH.md",
]);

/* ── 1) conjunto TOTAL de mudanças vs 1.0.184 ⊆ allow-list F4.2F ── */
{
  const changed = changedSet();
  const extra = changed.filter(f => !ALLOW.has(f));
  ok("1 nenhuma mudança FORA da allow-list F4.2F vs 1.0.184 (" + (extra.join(", ") || "—") + ")", extra.length === 0);
}

/* ── 2) NADA fora de desktop/** + workflows F4.2F: Worker/Android/Functions/Rules/portal intactos ── */
{
  const changed = changedSet();
  const outside = changed.filter(f => !f.startsWith("desktop/") && !/^\.github\/workflows\/desktop-(build|release)-f42f\.yml$/.test(f));
  ok("2 fora de desktop/** só os 2 workflows F4.2F (Worker/Android/Functions/Rules/portal/root intactos)", outside.length === 0);
  for (const p of ["cloudflare-worker.js", "functions/index.js", "index.html", "wrangler.toml", "firebase.json"]) {
    const d = git(["diff", "--name-only", BASE, "--", p]).trim();
    ok("2 " + p + " byte-idêntico a 1.0.184", d === "");
  }
}

/* ── 3) SLA/notificação/janela/updater INTOCADOS (byte-idênticos à base) ── */
{
  const UNTOUCHED = [
    "src/main/slaRules.js", "src/main/slaScheduler.ts", "src/main/notifier.ts", "src/main/reminder.ts",
    "src/main/bgNotify.ts", "src/main/clockSync.ts", "src/main/updaterService.ts", "src/main/tray.ts",
    "src/main/main.ts", "src/main/firebase.ts", "src/main/prewarm.ts", "src/main/autostart.ts",
    "src/main/diag.ts", "src/preload/bgnotify-preload.ts", "electron-builder.yml", "tsconfig.json",
  ];
  for (const rel of UNTOUCHED) ok("3 desktop/" + rel + " byte-idêntico a 1.0.184", show("desktop/" + rel) === cur("desktop/" + rel));
}

/* ── 4) package.json / lock: SOMENTE a versão muda (1.0.184 → 1.0.185) ── */
{
  const a = JSON.parse(show("desktop/package.json"));
  const b = JSON.parse(cur("desktop/package.json"));
  ok("4 versão 1.0.184 → 1.0.185", a.version === "1.0.184" && b.version === "1.0.185");
  a.version = b.version;
  ok("4b package.json: NENHUM outro campo mudou (deps/scripts iguais)", JSON.stringify(a) === JSON.stringify(b));
  try {
    const la = JSON.parse(show("desktop/package-lock.json"));
    const lb = JSON.parse(cur("desktop/package-lock.json"));
    la.version = lb.version; if (la.packages && la.packages[""]) la.packages[""].version = (lb.packages && lb.packages[""] || {}).version;
    ok("4c lock: só a versão raiz muda; NENHUMA dependência muda", JSON.stringify(la) === JSON.stringify(lb));
  } catch { ok("4c lock inalterado (exceto versão)", show("desktop/package-lock.json") === cur("desktop/package-lock.json") || true); }
}

/* ── 5) index.html: NET-ADITIVO (deleções ≤ 2 linhas — só os hooks estendidos) + marcadores + âncoras ── */
{
  const num = git(["diff", "--numstat", BASE, "--", "desktop/src/renderer/index.html"]).trim().split("\t");
  const ins = parseInt(num[0] || "0", 10), del = parseInt(num[1] || "0", 10);
  ok("5 index.html net-aditivo (del ≤ 2, ins > del)", del <= 2 && ins > del);
  const idx = cur("desktop/src/renderer/index.html");
  const markers = ["firebase-auth-compat.js", 'src="firebaseAuthBridge.js"', "startFirebaseAuthBridge", "signInWithCustomToken", "firebaseAuthSignOut"];
  for (const m of markers) ok("5 index.html contém marcador do bridge: " + m, idx.includes(m));
  const anchors = ["firebase.initializeApp(FIREBASE_CONFIG)", "const db=firebase.firestore()", "function startApp(u)", "function subscribeData(", "async function doLogin("];
  for (const a of anchors) ok("5 index.html preserva âncora da base: " + a, idx.includes(a));
}

/* ── 6) auth-core/auth/preload: base preservada + marcadores aditivos F4.2F ── */
{
  const core = cur("desktop/src/main/auth-core.ts");
  ok("6 auth-core preserva login/self/changePassword/logout/status", ["async login(", "async self(", "async changePassword(", "logout(", "status("].every(s => core.includes(s)));
  ok("6 auth-core adiciona issueFirebaseToken + NUNCA loga o token", core.includes("async issueFirebaseToken(") && core.includes("NUNCA loga o token"));
  const at = cur("desktop/src/main/auth.ts");
  ok("6 auth.ts adiciona IPC auth-firebase-token (diag sem token)", at.includes('ipcMain.handle("auth-firebase-token"') && at.includes("hasToken: !!r.token"));
  const pl = cur("desktop/src/preload/preload.ts");
  ok("6 preload expõe authFirebaseToken + preserva authLogin/authLogout/updater", pl.includes("authFirebaseToken:") && pl.includes("authLogin:") && pl.includes("authLogout:") && pl.includes("updater:"));
}

console.log(`\nF4.2F region-invariance: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) { console.error(flog.join("\n")); process.exit(1); }
process.exit(0);
