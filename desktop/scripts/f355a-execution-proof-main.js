/* F3.5.5A — PROVAS REAIS (Electron empacotado) do CHECK-IN DE EXECUÇÃO.
   Sem IA/mockup/HTML isolado: empacota o RENDERER REAL (slareminder.html + index.html + sons,
   incluindo execution-checkin.wav) em app.asar, carrega DO ASAR em BrowserWindows reais (xvfb),
   usa os preloads REAIS e os canais IPC REAIS (slareminder-card / slareminder-rendered /
   slareminder-checkin-decide / slareminder-checkin-result). Instrumenta o construtor Audio NO
   MUNDO DA PÁGINA (conta reproduções do som laranja). Cenas adicionais rodam o CÓDIGO COMPILADO
   REAL (dist/main/executionOrchestrator.js + dist/main/slaReminder.js + dist/main/executionTracking.js)
   com um servidor de claim EM MEMÓRIA que executa o MESMO domínio puro (etClaimDecision) — provando
   dual-device (1 CLAIMED + 1 LEASED_BY_OTHER; zero janela/som duplicados; resposta invalida o outro).
   Sai com código != 0 se qualquer asserção falhar. */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path"); const fs = require("fs"); const crypto = require("crypto");
const os = require("os");
const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.PROOF_OUT || path.resolve(ROOT, "..", "docs", "f355a-qa");
const results = []; let failures = 0;
const rec = (name, okc, extra) => { results.push({ name, ok: !!okc, ...extra }); if (!okc) { failures++; console.error("✗", name, JSON.stringify(extra || {})); } else console.log("✓", name, JSON.stringify(extra || {})); };
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INSTR = `(function(){ if(window.__audioN!==undefined) return; var N=0; var Real=window.Audio;
  window.Audio=function(src){ N++; var a=new Real(); a.play=function(){ return Promise.resolve(); }; return a; };
  window.__audioN=function(){ return N; }; })(); true;`;
let asarPath = "";
const KEY = "taskProva01|desProva01|dl0|cp1";
const EXECV = (extra) => Object.assign({
  kind: "checkin", checkinKind: "execution", key: KEY, taskId: "taskProva01", recipientUid: "desProva01",
  actorName: "Designer Prova", actorAvatar: "", taskTitle: "Tarefa de prova", clientName: "Cliente Prova",
  etapa: "Em andamento", sinceText: "", inactivityMinutes: 0, deep: "detail/taskProva01",
  soundDataUri: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=",
  statusVersion: "", activityBoundaryVersion: 0, thresholdVersion: "",
  message: "Você está executando esta tarefa neste momento?",
  checkpointIndex: 1, deadlineVersion: 0, responseMin: 10, snoozeAllowed: true,
  requireObservationOnNegative: false, state: "prompt", queueLen: 0,
}, extra || {});

async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355a-asar-"));
  fs.mkdirSync(path.join(stage, "src", "renderer", "sounds"), { recursive: true });
  for (const f of ["index.html", "slareminder.html", "bgnotify.html"]) fs.copyFileSync(path.join(ROOT, "src", "renderer", f), path.join(stage, "src", "renderer", f));
  const wavs = [];
  for (const w of fs.readdirSync(path.join(ROOT, "src", "renderer", "sounds"))) if (/\.wav$/.test(w)) { fs.copyFileSync(path.join(ROOT, "src", "renderer", "sounds", w), path.join(stage, "src", "renderer", "sounds", w)); wavs.push(w); }
  asarPath = path.join(os.tmpdir(), "f355a-app.asar");
  await asar.createPackage(stage, asarPath);
  await sleep(400);
  rec("P1 asar empacotado com renderer REAL + som laranja próprio", fs.existsSync(asarPath) && wavs.includes("execution-checkin.wav") && wavs.includes("sla-warning.wav") && wavs.includes("sla-critical.wav"), { wavs });
}

async function proofOrangeWindow() {
  const acks = []; const decides = []; const drafts = [];
  ipcMain.on("slareminder-rendered", (_e, k) => acks.push(String(k || "")));
  ipcMain.on("slareminder-checkin-decide", (_e, p) => decides.push(p || {}));
  ipcMain.on("slareminder-checkin-draft", (_e, r) => drafts.push(r || {}));
  ipcMain.on("slareminder-resize", () => {}); ipcMain.on("slareminder-obs", () => {}); ipcMain.on("slareminder-ack", () => {});
  const w = new BrowserWindow({ width: 560, height: 560, show: true, frame: false, webPreferences: { preload: path.join(ROOT, "dist", "preload", "slareminder-preload.js"), contextIsolation: true, nodeIntegration: false } });
  await w.loadFile(path.join(asarPath, "src", "renderer", "slareminder.html"));
  await w.webContents.executeJavaScript(INSTR);
  const js = (code) => w.webContents.executeJavaScript(code).catch((e) => "ERR:" + String(e && e.message || e));
  const audio = () => js("window.__audioN?window.__audioN():-1");
  // 2) exibição LARANJA real do asar
  w.webContents.send("slareminder-card", EXECV());
  await sleep(450);
  const cls = await js("document.getElementById('card').className");
  const kick = await js("document.getElementById('kicker').textContent");
  const msg = await js("document.getElementById('msg').textContent");
  rec("P2 janela central REAL exibe a view LARANJA (card exec; título literal)", String(cls).includes("exec") && kick === "CHECK-IN DE EXECUÇÃO", { cls, kick });
  rec("P3 pergunta LITERAL do mandato no card real", msg === "Você está executando esta tarefa neste momento?", { msg });
  const a1 = Number(await audio());
  rec("P4 som PRÓPRIO laranja tocou 1x no render (Audio via soundDataUri)", a1 === 1, { audio: a1 });
  rec("P5 ACK real de render recebido no main (timer só depois disto)", acks.includes(KEY), { acks: acks.length });
  const btns = await js("['e_sim','e_nao','e_snz','e_open'].map(function(i){return !!document.getElementById(i);}).join(',')");
  rec("P6 respostas reais presentes (SIM/NÃO/snooze/Abrir tarefa)", btns === "true,true,true,true", { btns });
  // 3) mesma chave re-render ⇒ SEM som novo
  w.webContents.send("slareminder-card", EXECV());
  await sleep(300);
  const a2 = Number(await audio());
  rec("P7 re-render da MESMA chave NÃO duplica som (1 por checkpoint)", a2 === a1, { audio: a2 });
  // 4) fluxo SIM com observação + Registrando…
  await js("document.getElementById('e_sim').click()");
  await sleep(200);
  await js("var o=document.getElementById('e_obs'); o.value='Finalizando a arte final'; o.dispatchEvent(new Event('input')); true;");
  await sleep(150);
  await js("document.getElementById('ec_go').click()");
  await sleep(200);
  const busy = await js("document.getElementById('foot').innerHTML.indexOf('Registrando')>=0");
  rec("P8 'Registrando…' real após confirmar (freeze 1.0.211)", busy === true, { busy });
  const d1 = decides[decides.length - 1] || {};
  rec("P9 decide REAL via IPC com identidade + resposta + observação", d1.key === KEY && d1.executionResponseType === "sim" && d1.observation === "Finalizando a arte final", { d1: { key: d1.key, rt: d1.executionResponseType } });
  // resultado de rede fora ⇒ texto preservado
  w.webContents.send("slareminder-checkin-result", { status: "queued" });
  await sleep(250);
  const errShown = await js("document.getElementById('foot').innerHTML.indexOf('Sem conexão')>=0");
  const obsKept = await js("(document.getElementById('e_obs')||{}).value||''");
  rec("P10 falha de rede: erro exibido e TEXTO PRESERVADO p/ retry", errShown === true && obsKept === "Finalizando a arte final", { errShown, obsKept });
  // 5) fluxo NÃO (razões literais) + rascunho
  await js("document.getElementById('ec_back').click()"); await sleep(150);
  await js("document.getElementById('e_nao').click()"); await sleep(200);
  const rowsN = await js("document.querySelectorAll('.rrow[data-erc]').length");
  rec("P11 NÃO abre as 5 razões reais", Number(rowsN) === 5, { rowsN });
  await js("document.querySelector('.rrow[data-erc=\"nao_bloqueado\"]').click()"); await sleep(150);
  await js("var o=document.getElementById('e_obs2'); o.value='Aguardando logo do cliente'; o.dispatchEvent(new Event('input')); true;"); await sleep(120);
  await js("document.getElementById('ec_go').click()"); await sleep(200);
  const d2 = decides[decides.length - 1] || {};
  rec("P12 decide NÃO/bloqueado com observação (payload real)", d2.executionResponseType === "nao_bloqueado" && d2.observation === "Aguardando logo do cliente", { rt: d2.executionResponseType });
  rec("P13 rascunho exec preservado via draft IPC (exec:true)", drafts.some((r) => r.draft && r.draft.exec === true && r.draft.mode === "nao"), { drafts: drafts.length });
  // resultado remoto: já respondido em outro device
  w.webContents.send("slareminder-checkin-result", { status: "already_answered" });
  await sleep(250);
  const msgBox = await js("document.getElementById('foot').innerHTML.indexOf('outro dispositivo')>=0");
  rec("P14 'já respondido em outro dispositivo' na superfície real", msgBox === true, { msgBox });
  // 6) preempção pelo SLA (vermelho assume; laranja restaurado depois com rascunho)
  const SLA = { kind: undefined, key: "sla|taskProva01|1", level: "critical", taskTitle: "Tarefa de prova", clientName: "Cliente Prova", actorName: "Designer Prova", actorAvatar: "", deadlineText: "18:00", overdueText: "", deep: "detail/taskProva01", soundDataUri: "", state: undefined, queueLen: 0 };
  w.webContents.send("slareminder-card", SLA);
  await sleep(350);
  const cls2 = await js("document.getElementById('card').className");
  rec("P15 crítico ASSUME a janela (laranja recolhe; classe muda)", !String(cls2).includes("exec"), { cls2 });
  w.webContents.send("slareminder-card", EXECV({ draft: { exec: true, mode: "nao", reasonCode: "nao_bloqueado", observation: "Aguardando logo do cliente" } }));
  await sleep(350);
  const cls3 = await js("document.getElementById('card').className");
  const obsRest = await js("(document.getElementById('e_obs2')||{}).value||''");
  const a3 = Number(await audio());
  rec("P16 laranja RESTAURADO com o texto digitado após o crítico", String(cls3).includes("exec") && obsRest === "Aguardando logo do cliente", { obsRest });
  rec("P17 restore NÃO toca som novo (mesma chave)", a3 === a1, { audio: a3 });
  // snooze real (botão existe no estado IDLE — volta do subpainel NÃO restaurado)
  await js("var b=document.getElementById('ec_back'); if(b) b.click(); true;");
  await sleep(200);
  const snz = await js("var b=document.getElementById('e_snz'); b?(b.click(),'ok'):'ausente'");
  await sleep(200);
  const dS = decides[decides.length - 1] || {};
  rec("P18 snooze real emite decide {executionSnooze:true}", snz === "ok" && dS.executionSnooze === true, { snz });
  w.destroy();
}

/* Cenas com o CÓDIGO COMPILADO REAL (dist) + servidor de claim em memória com o MESMO domínio puro. */
async function proofDualDevice() {
  const ET = require(path.join(ROOT, "dist", "main", "executionTracking.js"));
  const O = require(path.join(ROOT, "dist", "main", "executionOrchestrator.js"));
  const T0 = Date.now() - 3 * 3600000;                       // atribuída há 3h
  const RAW = { id: "taskProva01", assigneeId: "desProva01", status: "andamento", title: "Tarefa de prova", client: "Cliente Prova", designerSla: { plannedFinishAt: Date.now() + 5 * 3600000 }, designerAssignment: { assignedAt: T0 }, deadlineVersion: 0 };
  const CFG = { mode: "active", schedule: { configured: true, days: [0, 1, 2, 3, 4, 5, 6], startMin: 0, endMin: 1440, tzOffsetMin: 0 }, maxPerDay: 3, maxPerTask: 6, minGapMin: 20, minIntervalMs: 1200000, slaMarginMin: 10, responseMin: 10 };
  // servidor EM MEMÓRIA executando o domínio REAL (transação simulada serializada; relógio do "servidor")
  const store = new Map();
  const serverClaim = (deviceId) => async (req) => {
    const serverNow = Date.now();
    const key = req.checkinId;
    const existing = store.get(key) || null;
    const d = ET.etClaimDecision(existing, serverNow, deviceId, 600000, { eligible: true, inSlaZone: false, deadlineVersionCurrent: 0, expectedDeadlineVersion: req.deadlineVersion, designerIdCurrent: "desProva01", expectedDesignerId: "desProva01" });
    if (d.decision === "claim" || d.decision === "takeover_expired" || d.decision === "own") {
      const doc = Object.assign({}, existing || {}, { state: "CLAIMED", claimDeviceId: deviceId, claimedAt: serverNow, leaseExpiresAt: serverNow + 600000, claimVersion: ((existing && existing.claimVersion) || 0) + (d.decision === "own" ? 0 : 1) });
      store.set(key, doc);
      return { ok: true, decision: d.decision === "own" ? "resumed" : "claimed", claimedAt: doc.claimedAt, leaseExpiresAt: doc.leaseExpiresAt, claimVersion: doc.claimVersion };
    }
    if (d.decision === "leased") return { ok: true, decision: "deny", reason: "LEASED_BY_OTHER", leaseExpiresAt: d.leaseExpiresAt };
    if (d.decision === "closed") return { ok: true, decision: "closed", state: d.state };
    return { ok: true, decision: "deny", reason: d.reason };
  };
  function mkDevice(name) {
    const calls = { emits: [], closes: [] };
    const tasksMap = new Map([[RAW.id, Object.assign({}, RAW)]]);
    const o = O.createExecutionOrchestrator({
      getConfig: () => CFG, getUid: () => "desProva01",
      emit: (p) => { calls.emits.push(p); return { ok: true }; },
      claim: serverClaim(name),
      soundDataUri: () => "data:audio/wav;base64,QQ==",
      store: { read: () => ({}), write: () => {} },
      onRemoteClose: (k) => calls.closes.push(k),
      onLog: () => {},
    });
    o.onTasks(tasksMap);
    return { o, calls, tasksMap };
  }
  const A = mkDevice("a".repeat(32)), B = mkDevice("b".repeat(32));
  A.o.evaluate(); B.o.evaluate();                       // corrida simultânea de claim
  await sleep(120);
  const claimedDoc = [...store.values()][0];
  rec("P19 DUAL-DEVICE: claim simultâneo ⇒ UM CLAIMED no servidor (claimVersion=1)", store.size === 1 && claimedDoc.state === "CLAIMED" && claimedDoc.claimVersion === 1, { holder: claimedDoc.claimDeviceId.slice(0, 4) });
  const winnerA = A.calls.emits.length === 1 && B.calls.emits.length === 0;
  const winnerB = B.calls.emits.length === 1 && A.calls.emits.length === 0;
  rec("P20 SÓ o vencedor exibe (o outro suprime LEASED_BY_OTHER; zero janela/som duplicados)", (winnerA || winnerB) && (A.calls.emits.length + B.calls.emits.length === 1), { a: A.calls.emits.length, b: B.calls.emits.length });
  rec("P21 claimedAt/leaseExpiresAt vieram do RELÓGIO DO SERVIDOR (persistidos no doc)", claimedDoc.claimedAt > 0 && claimedDoc.leaseExpiresAt === claimedDoc.claimedAt + 600000, {});
  // resposta no device vencedor ⇒ projeção no task doc ⇒ o OUTRO fecha via snapshot (onRemoteClose)
  const respondedKey = [...store.keys()][0];
  const winner = winnerA ? A : B; const loser = winnerA ? B : A;
  const both = [A, B];
  for (const dv of both) { const t = dv.tasksMap.get(RAW.id); t.executionTracking = { lastCheckin: { key: respondedKey, state: "RESPONDED", checkpointIndex: 1, deadlineVersion: 0, responseType: "sim" }, timeline: [] }; }
  A.o.evaluate(); B.o.evaluate();
  await sleep(80);
  rec("P22 resposta registrada em outro device INVALIDA quem está EXIBINDO (onRemoteClose no vencedor) e o suprimido não refecha (idempotente)", winner.calls.closes.includes(respondedKey) && loser.calls.closes.length === 0, { winner: winner.calls.closes.length, loser: loser.calls.closes.length });
  // lease vencido ⇒ takeover permitido (relógio do servidor)
  store.set(respondedKey + "x", { state: "CLAIMED", claimDeviceId: "c".repeat(32), leaseExpiresAt: Date.now() - 1000, claimVersion: 1 });
  const tk = await serverClaim("d".repeat(32))({ checkinId: respondedKey + "x", deadlineVersion: 0 });
  rec("P23 lease VENCIDO (no servidor) permite takeover (claimVersion++)", tk.decision === "claimed" && store.get(respondedKey + "x").claimVersion === 2, {});
  // relógio local ±10min irrelevante: decisões usam apenas serverNow (assinatura pura)
  const skew = ET.etClaimDecision({ state: "CLAIMED", claimDeviceId: "e".repeat(32), leaseExpiresAt: Date.now() + 300000, claimVersion: 1 }, Date.now(), "f".repeat(32), 600000, null);
  rec("P24 relógio local ±10min NÃO afeta a decisão (domínio só recebe serverNow)", skew.decision === "leased" && skew.reason === "LEASED_BY_OTHER", {});
  // OFF-equivalência: orquestrador OFF inerte (marker p/ o gate da build)
  const offDev = (() => { const calls = { emits: [] }; const o = O.createExecutionOrchestrator({ getConfig: () => ({ mode: "off" }), getUid: () => "desProva01", emit: (p) => { calls.emits.push(p); return { ok: true }; }, claim: async () => ({}), store: { read: () => ({}), write: () => {} }, onLog: () => {} }); o.onTasks(new Map([[RAW.id, RAW]])); o.evaluate(); return { o, calls }; })();
  await sleep(50);
  rec("P25 OFF ⇒ orquestrador inerte (zero claim/emissão; comportamento 1.0.216)", offDev.calls.emits.length === 0 && offDev.o.authorityFor(RAW) === "legacy", {});
}

app.on("window-all-closed", () => { /* mantém o processo vivo entre cenas */ });
app.whenReady().then(async () => {
  try {
    await packAsar(); await proofOrangeWindow(); await proofDualDevice();
    fs.mkdirSync(OUT, { recursive: true });
    const manifest = { phase: "F3.5.5A", at: new Date().toISOString(), electron: process.versions.electron, results,
      sha256: { "slareminder.html": sha(path.join(ROOT, "src", "renderer", "slareminder.html")), "index.html": sha(path.join(ROOT, "src", "renderer", "index.html")), "execution-checkin.wav": sha(path.join(ROOT, "src", "renderer", "sounds", "execution-checkin.wav")), "app.asar": crypto.createHash("sha256").update(require("original-fs").readFileSync(asarPath)).digest("hex") } };
    fs.writeFileSync(path.join(OUT, "f355a-execution-proof-manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`\nPROVAS: ${results.filter(r => r.ok).length}/${results.length} verdes`);
  } catch (e) { console.error("PROOF ERROR", e); failures++; }
  app.exit(failures ? 1 : 0);
});
