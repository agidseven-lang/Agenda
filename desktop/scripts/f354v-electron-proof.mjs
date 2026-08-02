/**
 * F3.5.4V — DRIVER das provas do APP EMPACOTADO (Electron REAL). Monta um app.asar de prova com o
 * renderer REAL (src/renderer/index.html + priorityEngine.js) + o main/preload de prova, empacota
 * com @electron/asar (offline) e roda o Electron REAL 31.3.1 sob Xvfb em 3 escalas (100/125/150%).
 * Cada cena gera PNG REAL (win.capturePage) + medições do DOM REAL. Sem file:///setContent/IA/mockup.
 *   node scripts/f354v-electron-proof.mjs
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
const OUT = path.resolve(ROOT, "docs", "f354v-qa");
const WORK = path.resolve(ROOT, ".f354v-electron-proof");
const APPDIR = path.join(WORK, "proof-app");
const ASAR = path.join(WORK, "proof-app.asar");
const ELECTRON = path.join(DESK, "node_modules", "electron", "dist", "electron");

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(APPDIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(ELECTRON)) { console.error("electron dist ausente: " + ELECTRON); process.exit(1); }

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

const PKG = JSON.parse(fs.readFileSync(path.join(DESK, "package.json"), "utf8"));
if (PKG.version !== "1.0.212") { console.error("package.json version != 1.0.212 (=" + PKG.version + ")"); process.exit(1); }

// ── monta o app de prova: renderer REAL (mesmos bytes do pacote oficial) + main/preload de prova ──
fs.mkdirSync(path.join(APPDIR, "src", "renderer"), { recursive: true });
fs.copyFileSync(path.join(DESK, "src", "renderer", "index.html"), path.join(APPDIR, "src", "renderer", "index.html"));
fs.copyFileSync(path.join(DESK, "src", "renderer", "priorityEngine.js"), path.join(APPDIR, "src", "renderer", "priorityEngine.js"));
fs.copyFileSync(path.join(__dirname, "f354v-electron-proof-main.js"), path.join(APPDIR, "proof-main.js"));
fs.copyFileSync(path.join(__dirname, "f354v-proof-preload.js"), path.join(APPDIR, "proof-preload.js"));
fs.writeFileSync(path.join(APPDIR, "package.json"), JSON.stringify({
  name: "agenda-id-seven-desktop-f354v-proof", productName: "Agenda ID Seven Desktop (prova F3.5.4V)",
  version: PKG.version, main: "proof-main.js"
}, null, 2));

const rendererHash = sha(path.join(APPDIR, "src", "renderer", "index.html"));

await asar.createPackage(APPDIR, ASAR);
const asarStat = fs.statSync(ASAR);
console.log("app.asar de prova: " + ASAR + " (" + asarStat.size + " bytes, sha256=" + sha(ASAR).slice(0, 16) + "…)");
console.log("renderer index.html sha256=" + rendererHash.slice(0, 16) + "… (mesmos bytes do pacote oficial)");

const JOBS = [
  { scale: "1x", sceneEnv: "qty1,qty5,qty8,qty13,qty20,buttons,typed,review,legacy_p4,editreopen", screen: "1366x768x24", dsf: "1" },
  { scale: "1.25x", sceneEnv: "qty8", screen: "1600x1000x24", dsf: "1.25" },
  { scale: "1.5x", sceneEnv: "qty8", screen: "1600x1000x24", dsf: "1.5" }
];

let totalScenes = 0, totalFail = 0;
const runLogs = [];
for (const job of JOBS) {
  const args = ["-a", "-s", "-screen 0 " + job.screen, ELECTRON, "--no-sandbox", "--force-device-scale-factor=" + job.dsf, ASAR];
  const env = Object.assign({}, process.env, { PROOF_OUT: OUT, PROOF_SCALE: job.scale, PROOF_SCENES: job.sceneEnv, ELECTRON_DISABLE_SECURITY_WARNINGS: "1" });
  let out = "";
  try { out = execFileSync("xvfb-run", args, { env, timeout: 120000, stdio: ["ignore", "pipe", "pipe"] }).toString(); }
  catch (e) { out = ((e.stdout && e.stdout.toString()) || "") + "\n" + ((e.stderr && e.stderr.toString()) || ""); }
  const done = (out.match(/PROOF_DONE scale=\S+ scenes=(\d+) failures=(\d+)/) || []);
  const sceneN = Number(done[1] || 0), failN = Number(done[2] || 999);
  totalScenes += sceneN; totalFail += failN;
  const sceneLines = out.split("\n").filter(l => /^PROOF_LINE /.test(l)).map(l => { try { return JSON.parse(l.slice(11)); } catch (_) { return null; } }).filter(Boolean);
  runLogs.push({ scale: job.scale, screen: job.screen, dsf: job.dsf, scenes: sceneN, failures: failN, ok: failN === 0 && sceneN > 0 });
  console.log("── [" + job.scale + "] " + job.screen + " → cenas=" + sceneN + " falhas=" + failN);
  for (const s of sceneLines) { if (s.scene) console.log("     · " + s.scene + " ok=" + s.ok + " input=" + s.input + " temas=" + s.vtema + " rows=" + s.rows + " chips=" + s.chips + " esperado=" + s.expect + (s.err ? (" ERR=" + String(s.err).slice(0, 120)) : "")); if (s.setup) console.log("     setup=" + JSON.stringify(s.setup)); }
  if (failN !== 0 || sceneN === 0) { const fatal = out.split("\n").filter(l => /FATAL|Error:|PROOF_DONE/.test(l)).slice(0, 4); for (const l of fatal) console.log("     ! " + l.slice(0, 260)); }
}

const agg = { feature: "F3.5.4V", version: PKG.version, electron: "31.3.1(real)", asar: { bytes: asarStat.size, sha256: sha(ASAR) }, rendererSha256: rendererHash, configs: runLogs, totalScenes, totalFailures: totalFail };
fs.writeFileSync(path.join(OUT, "f354v-electron-proof-manifest.json"), JSON.stringify(agg, null, 2));
console.log("\n===== PROVAS ELECTRON REAIS: " + totalScenes + " cenas, " + totalFail + " falhas =====");
process.exit(totalFail === 0 && totalScenes >= 12 ? 0 : 1);
