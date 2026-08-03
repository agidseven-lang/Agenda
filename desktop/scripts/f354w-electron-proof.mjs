/**
 * F3.5.4W — DRIVER das provas VISUAIS do APP EMPACOTADO (Electron REAL 31.3.1). Monta um app.asar
 * de prova com o renderer REAL (src/renderer/index.html — MESMOS bytes do pacote) + priorityEngine.js
 * + o main/preload de prova, empacota com @electron/asar (offline) e roda o Electron REAL sob Xvfb.
 * Prova, no app de verdade, as QUATRO entregas do F3.5.4W a partir de ESTADO REAL semeado (via o
 * Firestore stub → subscribeData → renderFromSnapshot → render): cards compactos, Central de
 * Detalhes, avatares e Social Medias. Cada cena gera PNG REAL (win.capturePage) + medições do DOM
 * REAL. Sem file:///setContent/IA/mockup — é o renderer de produção de verdade renderizando DOM real.
 *   node scripts/f354w-electron-proof.mjs
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
const OUT = path.resolve(ROOT, "docs", "f354w-qa");        // provas no docs/ da RAIZ (convenção f354*-qa + allowlist do CI)
const WORK = path.resolve(ROOT, ".f354w-electron-proof");  // dir de trabalho gitignorado
const APPDIR = path.join(WORK, "proof-app");
const ASAR = path.join(WORK, "proof-app.asar");
const ELECTRON = path.join(DESK, "node_modules", "electron", "dist", "electron");

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(APPDIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(ELECTRON)) { console.error("electron dist ausente: " + ELECTRON); process.exit(1); }

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const PKG = JSON.parse(fs.readFileSync(path.join(DESK, "package.json"), "utf8"));
if (PKG.version !== "1.0.214") { console.error("package.json version != 1.0.214 (=" + PKG.version + ")"); process.exit(1); }

// ── monta o app de prova: renderer REAL (mesmos bytes do pacote) + priorityEngine.js + main/preload de prova ──
fs.mkdirSync(path.join(APPDIR, "src", "renderer"), { recursive: true });
fs.copyFileSync(path.join(DESK, "src", "renderer", "index.html"), path.join(APPDIR, "src", "renderer", "index.html"));
fs.copyFileSync(path.join(DESK, "src", "renderer", "priorityEngine.js"), path.join(APPDIR, "src", "renderer", "priorityEngine.js"));
fs.copyFileSync(path.join(__dirname, "f354w-electron-proof-main.js"), path.join(APPDIR, "proof-main.js"));
fs.copyFileSync(path.join(__dirname, "f354w-proof-preload.js"), path.join(APPDIR, "proof-preload.js"));
fs.writeFileSync(path.join(APPDIR, "package.json"), JSON.stringify({
  name: "agenda-id-seven-desktop-f354w-proof", productName: "Agenda ID Seven Desktop (prova F3.5.4W)",
  version: PKG.version, main: "proof-main.js"
}, null, 2));

const rendererHash = sha(path.join(APPDIR, "src", "renderer", "index.html"));
const priorityHash = sha(path.join(APPDIR, "src", "renderer", "priorityEngine.js"));
await asar.createPackage(APPDIR, ASAR);
const asarStat = fs.statSync(ASAR);
const asarHash = sha(ASAR);
console.log("app.asar de prova: " + ASAR + " (" + asarStat.size + " bytes, sha256=" + asarHash.slice(0, 16) + "…)");
console.log("renderer index.html sha256=" + rendererHash.slice(0, 16) + "… (mesmos bytes do pacote oficial)");

// D1(9) + D2(10) + D3(4) + D4(8) = 31 cenas em 1x; 6 variações HiDPI (1.5x) → total 37.
const SCENES_1X = [
  "d1_cron12", "d1_cron6", "d1_cron3", "d1_cron_height_invariance", "d1_no_theme_nodes", "d1_roteiro", "d1_edicao_midia", "d1_edicao_cards", "d1_social_card",
  "d2_open_cron", "d2_cron_expand", "d2_cron_linebreaks", "d2_cron_collapse", "d2_cron_esc", "d2_open_roteiro", "d2_roteiro_expand", "d2_open_edicao_midia", "d2_open_edicao_cards", "d2_edicao_cards_labels",
  "d3_designers_strip", "d3_designers_notclip", "d3_social_strip", "d3_social_notclip",
  "d4_autopick_first", "d4_autopick_via_action", "d4_persist_saved", "d4_zero_task_columns", "d4_zero_task_col_labels", "d4_strip_chips", "d4_board_has_tasks", "d4_nonnull_guarantee"
];
const SCENES_HIDPI = ["d1_cron12", "d1_cron3", "d1_cron_height_invariance", "d3_designers_strip", "d3_social_strip", "d2_open_cron"];
const CARD_MAX = process.env.F354W_CARD_MAX || "540";

const JOBS = [
  { scale: "1x", scenes: SCENES_1X, screen: "1600x1050x24", dsf: "1" },
  { scale: "1.5x", scenes: SCENES_HIDPI, screen: "2400x1600x24", dsf: "1.5" }
];

let totalScenes = 0, totalFail = 0;
const runLogs = [];
for (const job of JOBS) {
  const args = ["-a", "-s", "-screen 0 " + job.screen, ELECTRON, "--no-sandbox", "--force-device-scale-factor=" + job.dsf, ASAR];
  const env = Object.assign({}, process.env, { PROOF_OUT: OUT, PROOF_SCALE: job.scale, PROOF_SCENES: job.scenes.join(","), F354W_CARD_MAX: CARD_MAX, ELECTRON_DISABLE_SECURITY_WARNINGS: "1" });
  let out = "";
  try { out = execFileSync("xvfb-run", args, { env, timeout: 300000, stdio: ["ignore", "pipe", "pipe"] }).toString(); }
  catch (e) { out = ((e.stdout && e.stdout.toString()) || "") + "\n" + ((e.stderr && e.stderr.toString()) || ""); }
  const done = (out.match(/PROOF_DONE scale=\S+ scenes=(\d+) failures=(\d+)/) || []);
  const sceneN = Number(done[1] || 0), failN = Number(done[2] || 999);
  totalScenes += sceneN; totalFail += failN;
  const sceneLines = out.split("\n").filter(l => /^PROOF_LINE /.test(l)).map(l => { try { return JSON.parse(l.slice(11)); } catch (_) { return null; } }).filter(Boolean);
  runLogs.push({ scale: job.scale, screen: job.screen, dsf: job.dsf, scenes: sceneN, failures: failN, ok: failN === 0 && sceneN > 0, lines: sceneLines });
  console.log("── [" + job.scale + "] " + job.screen + " → cenas=" + sceneN + " falhas=" + failN);
  for (const s of sceneLines) console.log("     " + (s.ok ? "·" : "✗") + " " + s.scene + " ok=" + s.ok + (s.ok ? "" : ("  WHY=" + s.why + "  m=" + JSON.stringify(s.m))));
  if (failN !== 0 || sceneN === 0) { const fatal = out.split("\n").filter(l => /FATAL|Error:|Cannot|Unhandled|PROOF_DONE/.test(l)).slice(0, 8); for (const l of fatal) console.log("     ! " + l.slice(0, 300)); }
}

const agg = {
  feature: "F3.5.4W", title: "Cards compactos · Central de Detalhes · Avatares · Social Medias",
  version: PKG.version, electron: "31.3.1(real)", ranAt: new Date().toISOString(),
  asar: { bytes: asarStat.size, sha256: asarHash }, rendererSha256: rendererHash, priorityEngineSha256: priorityHash,
  thresholds: { cardMaxPx: Number(CARD_MAX), invarDeltaPx: 8, minStripHeightPx: 58 },
  configs: runLogs.map(r => ({ scale: r.scale, screen: r.screen, dsf: r.dsf, scenes: r.scenes, failures: r.failures, ok: r.ok, lines: r.lines })),
  totalScenes, totalFailures: totalFail
};
fs.writeFileSync(path.join(OUT, "f354w-electron-proof-manifest.json"), JSON.stringify(agg, null, 2));
const pngs = fs.readdirSync(OUT).filter(f => f.endsWith(".png")).length;
console.log("\nmanifest: " + path.join(OUT, "f354w-electron-proof-manifest.json") + " · PNGs=" + pngs);
console.log("PROOF F3.5.4W scenes=" + totalScenes + " failures=" + totalFail);
process.exit(totalFail === 0 && totalScenes >= 30 ? 0 : 1);
