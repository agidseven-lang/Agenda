/**
 * F3.5.4W-H1 — DRIVER das provas REAIS do APP EMPACOTADO (Electron REAL 31.3.1). Monta um app.asar
 * de prova com o renderer REAL (src/renderer/index.html — MESMOS bytes do pacote) + priorityEngine.js
 * + o main/preload de prova, empacota com @electron/asar (offline) e roda o Electron REAL sob Xvfb.
 * Prova, no app de verdade, as entregas E1/E2/E3/E5 do F3.5.4W-H1 a partir de ESTADO REAL semeado
 * (Firestore stub → subscribeData → renderFromSnapshot → render):
 *   E2 — Central de Detalhes: tipografia premium (.det-acc-k/.det-acc-t/.det-acc-l) + botões
 *        "Copiar tema/legenda" (clique REAL via sendInputEvent; clipboard interceptado no preload
 *        registra a STRING EXATA; summary NÃO expande/recolhe; observabilidade SANITIZADA).
 *   E3 — designer atribuído mas NÃO iniciado bucketiza em "A Fazer" na Social/Setores/Meu quadro
 *        (paridade com o Designer); vira "Em andamento" nos DOIS quadros quando o designer inicia.
 *   E5 — observações internas por tema: input (textarea[data-itemnote]) no modal "Prazo para o
 *        designer" (SÓ setor de cliente com temas) e callout .det-acc-note na Central (só não-vazia).
 *   E1 — card do quadro preservado: altura INVARIANTE ao nº de conteúdos (1/12/50) e ZERO nós de
 *        lista de temas no DOM do card.
 * Cada cena gera PNG REAL (win.capturePage) + medições do DOM REAL. Sem file:///setContent/IA/mockup.
 *   node scripts/f354wh1-electron-proof.mjs
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
const OUT = path.resolve(ROOT, "docs", "f354wh1-qa");          // provas no docs/ da RAIZ (convenção f354*-qa)
const WORK = path.resolve(ROOT, ".f354wh1-electron-proof");    // dir de trabalho gitignorado
const APPDIR = path.join(WORK, "proof-app");
const ASAR = path.join(WORK, "proof-app.asar");
const ELECTRON = path.join(DESK, "node_modules", "electron", "dist", "electron");

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(APPDIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(ELECTRON)) { console.error("electron dist ausente: " + ELECTRON); process.exit(1); }

const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const PKG = JSON.parse(fs.readFileSync(path.join(DESK, "package.json"), "utf8"));
if (PKG.version !== "1.0.215") { console.error("package.json version != 1.0.215 (=" + PKG.version + ")"); process.exit(1); }

// ── monta o app de prova: renderer REAL (mesmos bytes do pacote) + priorityEngine.js + main/preload de prova ──
fs.mkdirSync(path.join(APPDIR, "src", "renderer"), { recursive: true });
fs.copyFileSync(path.join(DESK, "src", "renderer", "index.html"), path.join(APPDIR, "src", "renderer", "index.html"));
fs.copyFileSync(path.join(DESK, "src", "renderer", "priorityEngine.js"), path.join(APPDIR, "src", "renderer", "priorityEngine.js"));
fs.copyFileSync(path.join(__dirname, "f354wh1-electron-proof-main.js"), path.join(APPDIR, "proof-main.js"));
fs.copyFileSync(path.join(__dirname, "f354wh1-proof-preload.js"), path.join(APPDIR, "proof-preload.js"));
fs.writeFileSync(path.join(APPDIR, "package.json"), JSON.stringify({
  name: "agenda-id-seven-desktop-f354wh1-proof", productName: "Agenda ID Seven Desktop (prova F3.5.4W-H1)",
  version: PKG.version, main: "proof-main.js"
}, null, 2));

const rendererHash = sha(path.join(APPDIR, "src", "renderer", "index.html"));
const priorityHash = sha(path.join(APPDIR, "src", "renderer", "priorityEngine.js"));
await asar.createPackage(APPDIR, ASAR);
const asarStat = fs.statSync(ASAR);
const asarHash = sha(ASAR);
console.log("app.asar de prova: " + ASAR + " (" + asarStat.size + " bytes, sha256=" + asarHash.slice(0, 16) + "…)");
console.log("renderer index.html sha256=" + rendererHash.slice(0, 16) + "… (mesmos bytes do pacote oficial)");

// E2(7) + E3(4) + E5(2) + E1(1) = 14 cenas em 1x; as 7 de cópia/tipografia repetem em 1.25x e 1.5x → 28.
const SCENES_1X = [
  "e2_typo_short", "e2_typo_long", "e2_copy_buttons", "e2_copy_theme_click", "e2_copy_caption_click", "e2_copy_obs", "e2_cards_copy",
  "e3_social_afazer", "e3_designer_afazer_parity", "e3_start_flips", "e3_setores_meuquadro",
  "e5_notes_input", "e5_notes_view",
  "e1_card_preserved"
];
const SCENES_HIDPI = ["e2_typo_short", "e2_typo_long", "e2_copy_buttons", "e2_copy_theme_click", "e2_copy_caption_click", "e2_copy_obs", "e2_cards_copy"];

const JOBS = [
  { scale: "1x", scenes: SCENES_1X, screen: "1600x1050x24", dsf: "1" },
  { scale: "1.25x", scenes: SCENES_HIDPI, screen: "2000x1320x24", dsf: "1.25" },
  { scale: "1.5x", scenes: SCENES_HIDPI, screen: "2400x1600x24", dsf: "1.5" }
];
const EXPECT_TOTAL = SCENES_1X.length + 2 * SCENES_HIDPI.length;

let totalScenes = 0, totalFail = 0;
const runLogs = [];
for (const job of JOBS) {
  const args = ["-a", "-s", "-screen 0 " + job.screen, ELECTRON, "--no-sandbox", "--force-device-scale-factor=" + job.dsf, ASAR];
  const env = Object.assign({}, process.env, { PROOF_OUT: OUT, PROOF_SCALE: job.scale, PROOF_SCENES: job.scenes.join(","), ELECTRON_DISABLE_SECURITY_WARNINGS: "1" });
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
  if (failN !== 0 || sceneN === 0) { const fatal = out.split("\n").filter(l => /FATAL|Error:|Cannot|Unhandled|PROOF_DONE/.test(l)).slice(0, 10); for (const l of fatal) console.log("     ! " + l.slice(0, 300)); }
}

const agg = {
  feature: "F3.5.4W-H1", title: "Central de Detalhes (tipografia + Copiar tema/legenda) · status Social/Designer · observações internas · card preservado",
  version: PKG.version, electron: "31.3.1(real)", ranAt: new Date().toISOString(),
  asar: { bytes: asarStat.size, sha256: asarHash }, rendererSha256: rendererHash, priorityEngineSha256: priorityHash,
  thresholds: { invarDeltaPx: 8, restoreMs: 1600 },
  configs: runLogs.map(r => ({ scale: r.scale, screen: r.screen, dsf: r.dsf, scenes: r.scenes, failures: r.failures, ok: r.ok, lines: r.lines })),
  totalScenes, totalFailures: totalFail
};
fs.writeFileSync(path.join(OUT, "f354wh1-electron-proof-manifest.json"), JSON.stringify(agg, null, 2));
const pngs = fs.readdirSync(OUT).filter(f => f.endsWith(".png")).length;
console.log("\nmanifest: " + path.join(OUT, "f354wh1-electron-proof-manifest.json") + " · PNGs=" + pngs);
console.log("PROOF F3.5.4W-H1 scenes=" + totalScenes + " failures=" + totalFail + " (esperado " + EXPECT_TOTAL + ")");
process.exit(totalFail === 0 && totalScenes === EXPECT_TOTAL ? 0 : 1);
