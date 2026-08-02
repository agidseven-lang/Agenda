/**
 * F3.5.4U — DRIVER das provas visuais do APP EMPACOTADO (Electron REAL).
 *
 * 1) Monta um app.asar de PROVA contendo: o `main` de prova (f354u-electron-proof-main.js), o
 *    dist/main REAL (bgNotify.js/notifEvents.js/diag.js/actorProfile.js…), o dist/preload REAL
 *    (bgnotify-preload.js) e o renderer REAL (src/renderer/bgnotify.html) — os MESMOS bytes que
 *    vão no app.asar oficial (cmp separado contra o artefato do build verde).
 * 2) Empacota com @electron/asar (offline, sem rede).
 * 3) Roda o Electron REAL 31.3.1 sob Xvfb (--no-sandbox por ser root) em VÁRIAS resoluções/escalas:
 *    1600×900@1x (todas as cenas), 1366×768@1x, 1.5×(150%), 1.25×(125%) e tela estreita.
 * 4) Cada execução gera PNGs REAIS (win.capturePage) + manifesto sanitizado. Agrega tudo.
 *
 * NÃO usa file://, page.setContent, HTML montado, navegador comum, IA ou mockup.
 *   node scripts/f354u-electron-proof.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import asar from "@electron/asar";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, "..");
const ROOT = path.resolve(DESK, "..");
const OUT = path.resolve(ROOT, "docs", "f354u-qa");
const WORK = path.resolve(ROOT, ".f354u-electron-proof");
const APPDIR = path.join(WORK, "proof-app");
const ASAR = path.join(WORK, "proof-app.asar");
const ELECTRON = path.join(DESK, "node_modules", "electron", "dist", "electron");

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(APPDIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(ELECTRON)) { console.error("electron dist ausente: " + ELECTRON); process.exit(1); }

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

// versão REAL do produto (do package.json), asseverada dentro do app de prova
const PKG = JSON.parse(fs.readFileSync(path.join(DESK, "package.json"), "utf8"));
if (PKG.version !== "1.0.209") { console.error("package.json version != 1.0.209 (=" + PKG.version + ")"); process.exit(1); }

// ── monta o app de prova (bytes REAIS de produção) ──
copyDir(path.join(DESK, "dist", "main"), path.join(APPDIR, "dist", "main"));
copyDir(path.join(DESK, "dist", "preload"), path.join(APPDIR, "dist", "preload"));
fs.mkdirSync(path.join(APPDIR, "src", "renderer"), { recursive: true });
fs.copyFileSync(path.join(DESK, "src", "renderer", "bgnotify.html"), path.join(APPDIR, "src", "renderer", "bgnotify.html"));
fs.copyFileSync(path.join(__dirname, "f354u-electron-proof-main.js"), path.join(APPDIR, "proof-main.js"));
fs.writeFileSync(path.join(APPDIR, "package.json"), JSON.stringify({
  name: "agenda-id-seven-desktop-f354u-proof", productName: "Agenda ID Seven Desktop (prova F3.5.4U)",
  version: PKG.version, main: "proof-main.js"
}, null, 2));

// SHA-256 dos bytes de NOTIFICAÇÃO empacotados na prova (p/ amarrar ao artefato do build verde)
const codeHashes = {
  "dist/main/bgNotify.js": sha(path.join(APPDIR, "dist", "main", "bgNotify.js")),
  "dist/main/notifEvents.js": sha(path.join(APPDIR, "dist", "main", "notifEvents.js")),
  "dist/preload/bgnotify-preload.js": sha(path.join(APPDIR, "dist", "preload", "bgnotify-preload.js")),
  "src/renderer/bgnotify.html": sha(path.join(APPDIR, "src", "renderer", "bgnotify.html"))
};

// ── empacota o app.asar REAL (offline) ──
await asar.createPackage(APPDIR, ASAR);
const asarStat = fs.statSync(ASAR);
console.log("app.asar de prova: " + ASAR + " (" + asarStat.size + " bytes, sha256=" + sha(ASAR).slice(0, 16) + "…)");

// ── JOBS (UMA cena por processo Electron → isolamento perfeito, janela recriada limpa) ──
// std @1x cobre todas as 12 cenas; res/escala provam 1366×768, 150%, 125% e tela estreita (responsivo).
const STD_SCENES = ["01-move-premium", "02-completed-premium", "03-assign-premium", "04-updated-no-transition",
  "05-long-name", "06-long-title", "07-avatar-real", "08-avatar-fallback", "09-group-premium",
  "10-group-overflow", "11-fallback-flag-off", "12-click-deeplink"];
const JOBS = [];
for (const s of STD_SCENES) JOBS.push({ tag: "std", scene: s, screen: "1600x900x24", scale: "1" });
JOBS.push({ tag: "res1366", scene: "01-move-premium", screen: "1366x768x24", scale: "1" });
JOBS.push({ tag: "res1366", scene: "06-long-title", screen: "1366x768x24", scale: "1" });
JOBS.push({ tag: "scale150", scene: "01-move-premium", screen: "1600x1000x24", scale: "1.5" });
JOBS.push({ tag: "scale150", scene: "06-long-title", screen: "1600x1000x24", scale: "1.5" });
JOBS.push({ tag: "scale125", scene: "01-move-premium", screen: "1600x1000x24", scale: "1.25" });
JOBS.push({ tag: "narrow", scene: "01-move-premium", screen: "760x620x24", scale: "1.5" });

let totalScenes = 0, totalFail = 0;
const runLogs = [];
for (const job of JOBS) {
  const label = job.tag + ":" + job.scene;
  const args = ["-a", "-s", "-screen 0 " + job.screen, ELECTRON,
    "--no-sandbox", "--force-device-scale-factor=" + job.scale, ASAR];
  const env = Object.assign({}, process.env, {
    PROOF_OUT: OUT, PROOF_TAG: job.tag, PROOF_SCENES: job.scene, PROOF_SCALE: job.scale + "x @" + job.screen,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "1"
  });
  let out = "";
  try { out = execFileSync("xvfb-run", args, { env, timeout: 90000, stdio: ["ignore", "pipe", "pipe"] }).toString(); }
  catch (e) { out = ((e.stdout && e.stdout.toString()) || "") + "\n" + ((e.stderr && e.stderr.toString()) || ""); }
  const scLine = out.split("\n").find((l) => /^PROOF_SCENE /.test(l)) || "";
  const done = (out.match(/PROOF_DONE tag=\S+ scenes=(\d+) failures=(\d+)/) || []);
  const sceneN = Number(done[1] || 0), failN = Number(done[2] || 999);
  totalScenes += sceneN; totalFail += failN;
  runLogs.push({ tag: job.tag, scene: job.scene, screen: job.screen, scale: job.scale, scenes: sceneN, failures: failN, ok: failN === 0 && sceneN > 0 });
  console.log("── [" + label + "] " + job.screen + " @" + job.scale + "x → cenas=" + sceneN + " falhas=" + failN + (scLine ? ("  " + scLine.slice(11, 200)) : "  (SEM PROOF_SCENE)"));
  if (failN !== 0 || sceneN === 0) { const fatal = out.split("\n").filter((l) => /PROOF_FATAL|ERRO|Error:/.test(l)).slice(0, 3); for (const l of fatal) console.log("     ! " + l.slice(0, 200)); }
}

// ── manifesto agregado ──
const agg = { feature: "F3.5.4U", version: PKG.version, electron: "31.3.1(real)", asar: { path: path.basename(ASAR), bytes: asarStat.size, sha256: sha(ASAR) }, codeHashes, configs: runLogs, totalScenes, totalFailures: totalFail };
fs.writeFileSync(path.join(OUT, "electron-proof-manifest.json"), JSON.stringify(agg, null, 2));
console.log("\n===== PROVAS ELECTRON REAIS: " + totalScenes + " cenas, " + totalFail + " falhas =====");
console.log("hashes do código de notificação empacotado (amarrar ao artefato do build verde):");
for (const [k, v] of Object.entries(codeHashes)) console.log("  " + v.slice(0, 16) + "…  " + k);
process.exit(totalFail === 0 && totalScenes >= 16 ? 0 : 1);
