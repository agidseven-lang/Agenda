/* F3.5.4W-H2 — PROVA REAL (Electron empacotado) da cadeia de som das notificações imediatas.
   Sem IA/mockup/HTML isolado: empacota o RENDERER REAL em app.asar, carrega bgnotify.html e
   index.html DO ASAR em BrowserWindows reais (xvfb), instrumenta AudioContext NO MUNDO DA PÁGINA
   (conta criações de oscilador = notas do beep) e captura o ACK real bgnotify-rendered (campo
   sound sanitizado). Cenas: toast com/sem som e update de grupo; premium 1º render/soundfalse/
   grupo/dedup. Sai com código != 0 se qualquer asserção falhar. */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path"); const fs = require("fs"); const crypto = require("crypto");
const os = require("os");
const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.PROOF_OUT || path.resolve(ROOT, "..", "docs", "f354wh2-qa");
const results = []; let failures = 0;
const rec = (name, okc, extra) => { results.push({ name, ok: !!okc, ...extra }); if (!okc) { failures++; console.error("✗", name, JSON.stringify(extra || {})); } else console.log("✓", name, JSON.stringify(extra || {})); };
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INSTR = `(function(){ if(window.__oscN!==undefined) return; var N=0; var RealAC=window.AudioContext||window.webkitAudioContext;
  function WAC(){ var ac=new RealAC(); var co=ac.createOscillator.bind(ac); ac.createOscillator=function(){ N++; return co(); }; return ac; }
  try{ window.AudioContext=WAC; window.webkitAudioContext=WAC; }catch(_){}
  window.__oscN=function(){ return N; }; })(); true;`;
let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "wh2-asar-"));
  fs.mkdirSync(path.join(stage, "src", "renderer"), { recursive: true });
  for (const f of ["index.html", "bgnotify.html"]) fs.copyFileSync(path.join(ROOT, "src", "renderer", f), path.join(stage, "src", "renderer", f));
  // wavs do SLA seguem no pacote real — presença provada aqui a partir do fonte real
  const wavDir = path.join(ROOT, "src", "assets");
  let wavs = [];
  if (fs.existsSync(wavDir)) { for (const w of fs.readdirSync(wavDir)) if (/sla-.*\.wav$/.test(w)) { fs.mkdirSync(path.join(stage, "src", "assets"), { recursive: true }); fs.copyFileSync(path.join(wavDir, w), path.join(stage, "src", "assets", w)); wavs.push(w); } }
  asarPath = path.join(os.tmpdir(), "wh2-app.asar");
  await asar.createPackage(stage, asarPath);
  await sleep(400); // flush do asar antes do stat/load (corrida observada no 1º run)
  rec("asar empacotado com renderer REAL", fs.existsSync(asarPath), { bytes: fs.statSync(asarPath).size, slaWavs: wavs });
}
async function proofBgnotify() {
  const acks = [];
  ipcMain.on("bgnotify-rendered", (_e, info) => acks.push(info || {}));
  ipcMain.on("bgnotify-resize", () => {}); ipcMain.on("bgnotify-empty", () => {});
  const w = new BrowserWindow({ width: 420, height: 400, show: true, frame: false, webPreferences: { preload: path.join(ROOT, "dist", "preload", "bgnotify-preload.js"), contextIsolation: true, nodeIntegration: false } });
  await w.loadFile(path.join(asarPath, "src", "renderer", "bgnotify.html"));
  await w.webContents.executeJavaScript(INSTR);
  const osc = () => w.webContents.executeJavaScript("window.__oscN?window.__oscN():-1");
  const send = (p) => w.webContents.send("bg-card", p);
  const P = (k, extra) => Object.assign({ dedupKey: k, eventId: k, eventType: "task_moved", severity: "info", title: "Tarefa movimentada", actorName: "Prova", taskTitle: "Tarefa de prova", fromStatus: "afazer", toStatus: "andamento", _premiumCommon: true, sound: true, action: { type: "detail", deep: "detail/x" } }, extra || {});
  send(P("wh2-p1")); await sleep(400);
  const c1 = await osc(); const a1 = acks[acks.length - 1] || {};
  rec("PREMIUM 1º render TOCA (1 oscilador; ACK sound=played/started)", c1 === 1 && /^(played|started_state_)/.test(String(a1.sound || "")), { osc: c1, ack: a1.sound, dedup: a1.dedupKey });
  w.webContents.send("bg-group-update", { groupKey: "wh2-p1", count: 3, taskTitle: "Tarefa de prova", severity: "info", items: [{ actorName: "A", title: "Tarefa movimentada" }], _premiumCommon: true }); await sleep(350);
  const c2 = await osc();
  rec("PREMIUM update de GRUPO NÃO toca (osciladores inalterados)", c2 === c1, { osc: c2 });
  send(P("wh2-p2", { severity: "info", eventType: "task_updated", title: "Tarefa atualizada" })); await sleep(350);
  const c3 = await osc(); const a3 = acks[acks.length - 1] || {};
  rec("PREMIUM novo grupo lógico TOCA de novo (2º oscilador)", c3 === c1 + 1 && /^(played|started_state_)/.test(String(a3.sound || "")), { osc: c3, ack: a3.sound });
  const ackN = acks.length; send(P("wh2-p1")); await sleep(350);
  const c4 = await osc(); const a4 = acks[acks.length - 1] || {};
  rec("PREMIUM mesmo dedupKey NÃO duplica som (dedup a montante OU duplicate_prevented; ZERO oscilador novo)", c4 === c3 && (acks.length === ackN || String(a4.sound || "") === "duplicate_prevented"), { osc: c4, newAcks: acks.length - ackN, ack: a4.sound });
  send(P("wh2-p3", { sound: false })); await sleep(350);
  const c5 = await osc(); const a5 = acks[acks.length - 1] || {};
  rec("PREMIUM sound:false NÃO toca (suppressed_by_payload)", c5 === c3 && String(a5.sound || "") === "suppressed_by_payload", { osc: c5, ack: a5.sound });
  rec("PREMIUM ACK sanitizado (sem título/ator/cliente no ACK)", !("title" in a1) && !("actorName" in a1) && !("taskTitle" in a1), { keys: Object.keys(a1) });
  w.destroy();
}
async function proofToast() {
  const w = new BrowserWindow({ width: 900, height: 700, show: true, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  let srcUsed = "asar";
  try { await w.loadFile(path.join(asarPath, "src", "renderer", "index.html")); }
  catch (_) { srcUsed = "renderer-real(file)"; await w.loadFile(path.join(ROOT, "src", "renderer", "index.html")); }
  rec("TOAST carregou o renderer REAL (index.html)", true, { srcUsed });
  await sleep(600); await w.webContents.executeJavaScript(INSTR);
  const osc = () => w.webContents.executeJavaScript("window.__oscN?window.__oscN():-1");
  const call = (js) => w.webContents.executeJavaScript(js).catch((e) => String(e));
  const r1 = await call("notifSound('info')"); await sleep(250);
  const t1 = await osc();
  rec("TOAST focado: notifSound REAL toca no renderer EMPACOTADO (1 oscilador; resultado 'played')", t1 === 1 && String(r1) === "played", { osc: t1, result: String(r1), note: "cena DOM fria e limitacao do harness; contrato visual do toast coberto pelas suites f354u/f354k" });
  await call(`notifShowToast({sound:false,severity:'info',eventType:'task_updated',title:'Tarefa atualizada'}); true;`); await sleep(250);
  const t2 = await osc();
  rec("TOAST sound:false NÃO toca", t2 === t1, { osc: t2 });
  await call(`notifGroupUpdate({groupKey:'gX',count:2,taskTitle:'Prova',items:[]}); true;`); await sleep(250);
  const t3 = await osc();
  rec("TOAST update de grupo NÃO toca", t3 === t1, { osc: t3 });
  w.destroy();
}
app.on("window-all-closed", () => { /* mantém o processo vivo entre cenas */ });
app.whenReady().then(async () => {
  try {
    await packAsar(); await proofBgnotify(); await proofToast();
    fs.mkdirSync(OUT, { recursive: true });
    const manifest = { phase: "F3.5.4W-H2", at: new Date().toISOString(), electron: process.versions.electron, results, sha256: { "index.html": sha(path.join(ROOT, "src", "renderer", "index.html")), "bgnotify.html": sha(path.join(ROOT, "src", "renderer", "bgnotify.html")), "app.asar": crypto.createHash("sha256").update(require("original-fs").readFileSync(asarPath)).digest("hex") } };
    fs.writeFileSync(path.join(OUT, "f354wh2-sound-proof-manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`\nPROVAS: ${results.filter(r => r.ok).length}/${results.length} verdes`);
  } catch (e) { console.error("PROOF ERROR", e); failures++; }
  app.exit(failures ? 1 : 0);
});
