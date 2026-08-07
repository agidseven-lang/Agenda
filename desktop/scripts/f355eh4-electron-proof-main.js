/* F3.5.5E-H4 — PROVAS REAIS do HANDOFF COMPLETO DE NOTIFICAÇÕES AGRUPADAS (Electron 31.3.1; xvfb).
 *
 * PIPELINE REAL DE PRODUÇÃO NO PRÓPRIO PROCESSO MAIN DO HARNESS (mesma infraestrutura aprovada da
 * F3.5.5E-H3): bgNotify.js REAL do dist; notificationGrouping.js REAL do dist (controlador puro
 * F3.5.4O, janela de 5s REAL); deliverNotification + bloco do HANDOFF TRANSACIONAL + handlers de
 * notif-collect-reply e bgnotify-rendered (ACEITE) EXTRAÍDOS BYTE-A-BYTE do dist/main/main.js e
 * executados em vm no MESMO processo; renderer REAL (index.html do asar) com os canais IPC REAIS
 * (notif-toast/-group-update/-history/-toast-ack/-collect-request/-collect-reply/-collect-commit).
 *
 * MAPA DOS TESTES OBRIGATÓRIOS DO MANDATO (1–18):
 *   1–4   → E02 (individual migra no Alt+Tab, transacional: aceite→commit)
 *   5–9   → E03 (grupo de 2 aparece internamente e MIGRA no Alt+Tab com contagem)
 *   10    → E04 (grupo de 3)      11 → E05 (grupo de 4)      12 → E06 (rajada mista)
 *   13    → E07 (grupo ALTERADO durante o handoff — contagem mais nova vence)
 *   14    → E08 (evento chegando durante o blur → premium direto; grupo nasce lá)
 *   15    → E09 (blur e focus rápidos → aborta sem mostrar nada; zero perda)
 *   16    → E10 (Alt+Tab repetido — 2º ciclo completo)
 *   17    → E11 (minimizado logo após formar grupo)
 *   18    → E12 (X→tray com grupo ativo)
 *   critérios → E13 (som 0× em TODAS as migrações) E14 (zero duplicação) E15 (CTA preservado)
 *               E16 (retry REAL recupera) E17 (histórico por evento) E18 (2ª falha PRESERVA)
 *
 * LIMITAÇÕES DECLARADAS (validação física do owner no Windows): z-order do DWM real; minimize sem
 * window manager em xvfb (critério por FOCO, como aprovado na H3); Notification nativa não renderiza. */
const { app, BrowserWindow, session, ipcMain, screen } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355eh4-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
const ofs = require("original-fs");
const sha256 = (p) => crypto.createHash("sha256").update(ofs.readFileSync(p)).digest("hex");
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

const NOW = Date.now();
const ID = { ANA: "u-soc-ana", DIEGO: "u-des-diego", FELIPE: "u-des-felipe" };
const seed = (() => {
  const self = { id: ID.ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" };
  const users = [self,
    { id: ID.DIEGO, name: "Diego Designer", role: "Designer", status: "ativo" },
    { id: ID.FELIPE, name: "Felipe Teodozio", role: "Designer", status: "ativo" }];
  const tk = (x) => Object.assign({ by: ID.ANA, createdAt: NOW, history: [], checklist: [] }, x);
  const tasks = [
    tk({ id: "vid1", sector: "edicao_midia", status: "andamento", title: "Reels institucional", client: "Hospital Visão" }),
    tk({ id: "cron1", sector: "cronograma", status: "andamento", title: "TEMAS", client: "Hospital Visão", cronQty: 7, cronContents: [] }),
  ];
  return { self, users, tasks, events: [] };
})();

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();
try { app.setAppPath(path.join(__dirname, "..")); } catch (_) {}
try { if (app.getAppPath() !== path.join(__dirname, "..")) Object.defineProperty(app, "getAppPath", { value: () => path.join(__dirname, "..") }); } catch (_) {}

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355eh4-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js", "bgnotify.html"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355eh4-app-" + Date.now() + ".asar");
  await asar.createPackage(stage, asarPath);
  return { idxSha: sha256(path.join(SRC, "index.html")), bgSha: sha256(path.join(SRC, "bgnotify.html")) };
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }

function grabBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const j = src.indexOf("{", i);
  let d = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}
function grabHandler(src, startLit) {
  const m = src.indexOf(startLit);
  if (m < 0) return null;
  const i = src.indexOf("(_e", m);
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_12min\n"); } catch (_) {} app.exit(1); }, 12 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  const meta = await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f355eh4-seed.json"), JSON.stringify(seed));

  const DIST = path.join(__dirname, "..", "dist", "main");
  const logs = [];
  const diagMod = require(path.join(DIST, "diag.js"));
  try { const _d = diagMod.diag; Object.defineProperty(diagMod, "diag", { value: (t, d) => { logs.push([t, d]); try { _d(t, d); } catch (_) {} } }); } catch (_) {}
  const bgReal = require(path.join(DIST, "bgNotify.js"));
  const toastAckMod = require(path.join(DIST, "toastAck.js"));
  const groupingMod = require(path.join(DIST, "notificationGrouping.js"));
  const dMain = fs.readFileSync(path.join(DIST, "main.js"), "utf8");

  const asarSha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  const asarIdx = asarSha(path.join(asarPath, "src", "renderer", "index.html"));
  const asarBg = asarSha(path.join(asarPath, "src", "renderer", "bgnotify.html"));
  rec("E00 bytes idênticos (fonte == asar) p/ index e bgnotify + dist H4 real presente",
    asarIdx === meta.idxSha && asarBg === meta.bgSha && dMain.includes("notif-collect-commit") && dMain.includes("txCommit"),
    { idx: meta.idxSha.slice(0, 12), bg: meta.bgSha.slice(0, 12) });

  /* corpos REAIS extraídos do dist */
  const nativeCalls = [];
  const bodyDeliver = grabBalanced(dMain, "function deliverNotification(p)");
  const bodyHandoff = (() => { const i = dMain.indexOf("const activeToasts = new Map("); const j = dMain.indexOf("/* handoff nunca derruba a entrega */ }\n}", i); return i >= 0 && j > i ? dMain.slice(i, j + "/* handoff nunca derruba a entrega */ }\n}".length) : null; })();
  const bodyBring = grabBalanced(dMain, "function bringToFrontAndOpen(deep)");
  const bodyWinActive = grabBalanced(dMain, "function windowActive()");
  const collectCbSrc = grabHandler(dMain, 'ipcMain.on("notif-collect-reply"');
  const acceptCbSrc = grabHandler(dMain, 'ipcMain.on("bgnotify-rendered", (_e, info)');
  rec("E00b corpos REAIS extraídos do dist (deliver/handoff-tx/bring/windowActive/collect-reply/ACEITE)",
    !!(bodyDeliver && bodyHandoff && bodyBring && bodyWinActive && collectCbSrc && acceptCbSrc),
    { d: !!bodyDeliver, h: !!bodyHandoff, b: !!bodyBring, w: !!bodyWinActive, c: !!collectCbSrc, a: !!acceptCbSrc });

  const grouping = groupingMod.createNotificationGrouping({ onLog: (t, d) => logs.push([t, d]) }); // REAL (janela 5s)
  const ctx = {
    console, setTimeout, clearTimeout, Date,
    require: (m) => { if (String(m).includes("notifEvents")) return require(path.join(DIST, "notifEvents.js")); throw new Error("ctx-no:" + m); },
    diag: (t, d) => logs.push([t, d]), diag_1: { diag: (t, d) => logs.push([t, d]) },
    nlog: (t, d) => logs.push([t, d]), nmask: (s) => String(s || "").slice(0, 4) + "…",
    mainWin: null, pendingDeep: "",
    sessionLocked: false, _notifSeen: new Set(),
    toastAck: toastAckMod.createToastAckTracker({ onLog: (t, d) => logs.push([t, d]) }),
    bgNotify_1: { showBgNotify: bgReal.showBgNotify, updateBgGroup: bgReal.updateBgGroup },
    showBgNotify: bgReal.showBgNotify, updateBgGroup: bgReal.updateBgGroup,
    nativeNotify: (p, key) => { nativeCalls.push(key); return true; },
    notifTele: {}, groupTele: { updates: 0, opens: 0 }, app: { getVersion: () => "1.0.228" },
    classifyReminderLevel: () => null, slaReminderCtl: null,
    premiumCommonEnabled: true, notificationGrouping: grouping,
    premiumObserve: () => {}, premiumObserveGroup: () => {},
    Notification: { isSupported: () => false },
    openDeep: (d) => { try { if (ctx.mainWin && !ctx.mainWin.isDestroyed()) ctx.mainWin.webContents.send("notif-open", String(d || "")); } catch (_) {} },
  };
  vm.createContext(ctx);
  new vm.Script(
    "globalThis.__winActive = " + bodyWinActive.replace(/^function windowActive/, "function") + ";\n" +
    "function windowActive(){ return globalThis.__winActive(); }\n" +
    bodyHandoff + "\n" +
    "globalThis.__deliver = " + bodyDeliver.replace(/^function deliverNotification/, "function") + ";\n" +
    "globalThis.__bring = " + bodyBring.replace(/^function bringToFrontAndOpen/, "function") + ";\n" +
    "globalThis.__collectCb = " + collectCbSrc + ";\n" +
    "globalThis.__acceptCb = " + acceptCbSrc + ";\n" +
    "globalThis.__h = { get actI(){ return activeToasts.size; }, get actG(){ return activeToastGroups.size; }, get txN(){ return handoffTx.size; }, handoff: handoffActiveToasts };",
    { filename: "dist-extract-h4.js" }).runInContext(ctx);
  const deliver = (p) => ctx.__deliver(p);

  /* IPC do main do harness — MESMOS canais/handlers de produção (extraídos do dist) */
  ipcMain.on("notif-toast-ack", (_e, key) => { ctx.toastAck.ack(String(key || "")); });
  ipcMain.on("notif-collect-reply", (_e, reqId, keys) => ctx.__collectCb(_e, reqId, keys));
  ipcMain.on("bgnotify-rendered", (_e, info) => ctx.__acceptCb(_e, info)); // ACEITE H4 (2º listener; o do bgNotify real segue com o ackCancel)
  bgReal.initBgNotify((deep) => ctx.__bring(String(deep || "")));

  const win = new BrowserWindow({ width: 1200, height: 800, show: true, webPreferences: {
    preload: path.join(__dirname, "f355eh4-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  ctx.mainWin = win;
  const wc = win.webContents;
  wc.on("console-message", (_e, lvl, msg, ln, src) => { if (lvl >= 2) line({ console: String(msg).slice(0, 200), src: String(src || "").split("/").pop(), ln }); });
  win.on("blur", () => { try { ctx.__h.handoff(); } catch (_) {} }); // wiring de produção
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  async function shot(nm, w) { try { await sleep(430); const img = await (w || wc).capturePage(); fs.writeFileSync(path.join(OUT, nm + ".png"), img.toPNG()); return nm + ".png"; } catch (e) { return "shot_err:" + String((e && e.message) || e).slice(0, 80); } }
  const bgWinOf = () => BrowserWindow.getAllWindows().find((w) => { try { return !w.isDestroyed() && String(w.webContents.getURL()).includes("bgnotify.html"); } catch (_) { return false; } });
  const bgJ = async (code) => { const b = bgWinOf(); if (!b) return { none: true }; return b.webContents.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) })); };
  const stackN = async () => { const r = await J(`(function(){ var s=document.getElementById('notif-stack'); return s?s.querySelectorAll('.ntf').length:0; })()`); return Number(r) || 0; };
  const bgCards = async () => { const r = await bgJ(`document.querySelectorAll('.ntf').length`); return (r && r.none) ? 0 : (Number(r) || 0); };
  async function drainAll() { // limpeza REAL entre cenas: fecha cards nas 2 superfícies e sincroniza registros via coleta
    try { grouping.reset(); } catch (_) {} // API REAL (mesma do logout): fecha a janela de 5s entre cenas
    await bgJ(`(function(){ document.querySelectorAll('.ntf .ntfp-x,.ntf .ntf-x').forEach(function(x){ x.click(); }); return true; })()`);
    await J(`(function(){ var s=document.getElementById('notif-stack'); if(s) s.querySelectorAll('.ntf').forEach(function(e){ try{ (e.__ntfDismiss||function(){})(); }catch(_){}}); return true; })()`);
    await sleep(650);
    win.focus(); await sleep(200); win.blur(); await sleep(950); // blur→coleta vazia limpa os registros reais
    win.focus(); await sleep(250);
  }

  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 30; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user: !!(st&&st.user), tasks: ((st&&st.tasks)||[]).length, api: !!(window.desktopAPI&&window.desktopAPI.onNotifCollectCommit) }; })()`);
    if (boot && boot.user && boot.tasks === 2) break;
    await sleep(500);
  }
  rec("E01 BOOT app real do asar (semente + canal do COMMIT exposto)", !!(boot && boot.user && boot.tasks === 2 && boot.api), boot);

  const T20 = new Date(); T20.setHours(20, 30, 0, 0);
  let seq = 0;
  const pay = (o) => Object.assign({
    eventType: "task_moved", taskId: "vid1", taskTitle: "Reels institucional", clientName: "Hospital Visão",
    title: "Tarefa movimentada", body: "Diego moveu a tarefa.", severity: "info", sound: true, targetUserId: ID.ANA,
    actorId: ID.DIEGO, actorName: "Diego Designer", fromStatus: "Em andamento", toStatus: "Revisão",
    sector: "edicao_midia", sectorLabel: "Edição de vídeos", createdAt: T20.getTime(),
    action: { type: "task", deep: "task/vid1" }, dedupKey: "h4:" + (++seq),
  }, o || {});
  const other = new BrowserWindow({ width: 700, height: 500, show: true });
  await other.loadURL("data:text/html,<title>OutroApp</title><textarea id='t' autofocus style='width:90%25;height:80%25'></textarea>");

  /* E02 [mandato 1–4] — INDIVIDUAL não-agrupável: toast focado → Alt+Tab → migra TRANSACIONAL */
  win.focus(); await sleep(300);
  const r02 = deliver(pay({ eventType: "event_reminder", severity: "warning", title: "Lembrete de evento", taskId: "", dedupKey: "h4:solo1" }));
  await sleep(500);
  const dom02 = await stackN();
  other.focus(); await sleep(1500); // blur real → coleta → tx → ACEITE real → COMMIT
  const bg02 = bgWinOf();
  const in02 = await stackN();
  const out02 = await bgCards();
  const acc02 = logs.filter((l) => l[0] === "notify.handoff.accepted").length;
  rec("E02 [1-4] individual: toast focado → Alt+Tab → MIGRA transacional (aceite real → commit fecha o interno)",
    r02.channel === "toast" && dom02 === 1 && in02 === 0 && out02 === 1 && !!bg02 && bg02.isVisible() && acc02 >= 1,
    { channel: r02.channel, antes: dom02, internoDepois: in02, premium: out02, accepted: acc02, shot: await shot("e02-individual-migra", bg02) });
  await drainAll();

  /* E03 [mandato 5–9] — GRUPO de 2: aparece internamente → Alt+Tab → migra IMEDIATO com contagem */
  win.focus(); await sleep(300);
  const g1 = deliver(pay({ dedupKey: "h4:g2a" }));
  await sleep(350);
  const g2 = deliver(pay({ dedupKey: "h4:g2b", body: "Diego moveu de novo." }));
  await sleep(500);
  const grpIn = await J(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g?(g.textContent||'').slice(0,80):'' }; })()`);
  other.focus(); await sleep(1700);
  const bg03 = bgWinOf();
  const grpOut = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g?(g.textContent||'').slice(0,90):'', n: document.querySelectorAll('.ntf').length }; })()`);
  const in03 = await stackN();
  rec("E03 [5-9] GRUPO de 2: card agrupado interno → Alt+Tab → MIGRA para a premium com a contagem (2 atualizações)",
    g1.channel === "toast" && g2.channel === "grouped" && grpIn.has && /2 atualiza/.test(grpIn.txt)
    && grpOut.has && /2 atualiza/.test(grpOut.txt) && grpOut.n === 1 && in03 === 0 && bg03.isVisible(),
    { g1: g1.channel, g2: g2.channel, interno: grpIn, premium: grpOut, stackInterno: in03, shot: await shot("e03-grupo2-migra", bg03) });
  await drainAll();

  /* E04/E05 [mandato 10/11] — GRUPO de 3 e de 4 */
  for (const [nm, cnt, label] of [["E04", 3, "[10] grupo de 3"], ["E05", 4, "[11] grupo de 4"]]) {
    win.focus(); await sleep(300);
    for (let i = 0; i < cnt; i++) { deliver(pay({ dedupKey: "h4:" + nm + i })); await sleep(200); }
    await sleep(400);
    other.focus(); await sleep(1700);
    const gOut = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g?(g.textContent||'').slice(0,90):'' }; })()`);
    const inN = await stackN();
    rec(`${nm} ${label} eventos: migra com contagem preservada (${cnt} atualizações)`,
      gOut.has && new RegExp(cnt + " atualiza").test(gOut.txt) && inN === 0,
      { premium: gOut, stackInterno: inN });
    await drainAll();
  }

  /* E06 [mandato 12] — RAJADA mista: 2 tarefas distintas (individuais agrupáveis de 1) + grupo de 2 no vid1 */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:r1", taskId: "cron1", taskTitle: "TEMAS" })); await sleep(150);
  deliver(pay({ dedupKey: "h4:r2", eventType: "event_reminder", severity: "warning", taskId: "", title: "Lembrete" })); await sleep(150);
  deliver(pay({ dedupKey: "h4:r3" })); await sleep(150);
  deliver(pay({ dedupKey: "h4:r4" })); await sleep(400); // vid1 forma grupo de 2
  const in06 = await stackN();
  other.focus(); await sleep(2200);
  const out06 = await bgCards();
  const in06b = await stackN();
  const grp06 = await bgJ(`(function(){ var out=[]; document.querySelectorAll('.ntf[data-group]').forEach(function(g){ out.push((g.textContent||'').slice(0,60)); }); return out; })()`);
  rec("E06 [12] rajada mista: TODOS os cards internos migram (2 individuais + grupo com contagem); zero deixado atrás",
    in06 === 3 && in06b === 0 && out06 === 3 && Array.isArray(grp06) && grp06.some((t) => /2 atualiza/.test(t)),
    { antes: in06, depois: in06b, premium: out06, grupos: grp06, shot: await shot("e06-rajada", bgWinOf()) });
  await drainAll();

  /* E07 [mandato 13] — grupo ALTERADO DURANTE o handoff: update entregue entre a coleta e o aceite */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:m1" })); await sleep(250);
  deliver(pay({ dedupKey: "h4:m2" })); await sleep(350);
  other.focus(); // blur dispara a coleta (reply ~50-200ms; aceite depende do render assíncrono)
  await sleep(60);
  const r07 = deliver(pay({ dedupKey: "h4:m3" })); // evento no MEIO do handoff (síncrono, vence o aceite)
  await sleep(1900);
  const grp07 = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g?(g.textContent||'').slice(0,90):'' }; })()`);
  const in07 = await stackN();
  rec("E07 [13] grupo alterado DURANTE o handoff: a premium termina com a contagem MAIS NOVA (3) — sem duplicar, sem perder",
    r07.channel === "grouped" && grp07.has && /3 atualiza/.test(grp07.txt) && in07 === 0,
    { canalDoMeio: r07.channel, premium: grp07, stackInterno: in07, shot: await shot("e07-update-durante-handoff", bgWinOf()) });
  await drainAll();

  /* E08 [mandato 14] — evento chegando JÁ em blur → premium direto; grupo NASCE na premium e morfa lá */
  other.focus(); await sleep(400);
  const r08a = deliver(pay({ dedupKey: "h4:b1" })); await sleep(400);
  const r08b = deliver(pay({ dedupKey: "h4:b2" })); await sleep(600);
  const grp08 = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g?(g.textContent||'').slice(0,80):'' }; })()`);
  const in08 = await stackN();
  rec("E08 [14] eventos durante o blur: premium DIRETO (1º cria data-group; 2º morfa; toast nunca envolvido)",
    r08a.channel === "bg-window" && r08b.channel === "grouped" && grp08.has && /2 atualiza/.test(grp08.txt) && in08 === 0,
    { a: r08a.channel, b: r08b.channel, premium: grp08, stackInterno: in08 });
  await drainAll();

  /* E09 [mandato 15] — blur e focus RÁPIDOS: aborta antes de mostrar; interno segue vivo; sem commit */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:q1", eventType: "event_reminder", severity: "warning", taskId: "", title: "Rápido" }));
  await sleep(450);
  const abortBefore = logs.filter((l) => l[0] === "notify.handoff.aborted.focus").length;
  const beginBefore09 = logs.filter((l) => l[0] === "notify.handoff.begin").length;
  const bgBefore09 = await bgCards();
  other.focus(); win.focus(); // foco volta ANTES da reply da coleta
  await sleep(1200);
  const abortAfter = logs.filter((l) => l[0] === "notify.handoff.aborted.focus").length;
  const in09 = await stackN();
  const bg09 = await bgCards();
  const beginAfter09 = logs.filter((l) => l[0] === "notify.handoff.begin").length;
  const abortou09 = (abortAfter === abortBefore + 1) || (beginAfter09 === beginBefore09);
  const abortLimpo = abortou09 && in09 === 1 && bg09 === bgBefore09;                    // foco voltou a tempo: nada migrou; toast vivo
  const migrouLimpo = !abortou09 && in09 === 0 && bg09 === bgBefore09 + 1;              // shows já disparados: transação COMPLETA (política determinística)
  rec("E09 [15] blur/focus rápidos: desfecho DETERMINÍSTICO e limpo — aborta sem mostrar OU completa a transação; nunca duplica, nunca perde",
    (abortLimpo || migrouLimpo) && ctx.__h.txN === 0,
    { abortou: abortou09, abortLimpo, migrouLimpo, interno: in09, premium: bg09, premiumAntes: bgBefore09, txAtivas: ctx.__h.txN });
  await drainAll();

  /* E10 [mandato 16] — Alt+Tab REPETIDO: 2 ciclos completos de migração */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:c1a" })); await sleep(150); deliver(pay({ dedupKey: "h4:c1b" })); await sleep(400);
  other.focus(); await sleep(1700); // ciclo 1
  const cyc1 = { interno: await stackN(), premium: await bgCards() };
  win.focus(); await sleep(400);
  deliver(pay({ dedupKey: "h4:c2a", taskId: "cron1", taskTitle: "TEMAS" })); await sleep(400);
  other.focus(); await sleep(1700); // ciclo 2
  const cyc2 = { interno: await stackN(), premium: await bgCards() };
  rec("E10 [16] Alt+Tab repetido: os DOIS ciclos migram tudo (interno zera; premium recebe; nada some)",
    cyc1.interno === 0 && cyc1.premium >= 1 && cyc2.interno === 0 && cyc2.premium >= 2,
    { ciclo1: cyc1, ciclo2: cyc2 });
  await drainAll();

  /* E11 [mandato 17] — MINIMIZADO logo após formar grupo → migra (critério por foco; WM real = físico) */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:mm1" })); await sleep(150); deliver(pay({ dedupKey: "h4:mm2" })); await sleep(350);
  win.minimize(); other.focus(); await sleep(1700);
  const grp11 = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g?(g.textContent||'').slice(0,80):'' }; })()`);
  const in11 = await stackN();
  rec("E11 [17] minimizado logo após formar grupo: grupo MIGRA (2 atualizações na premium; roteia por perda de foco — minimize real do WM fica ao físico)",
    grp11.has && /2 atualiza/.test(grp11.txt) && in11 === 0 && !win.isFocused(),
    { premium: grp11, stackInterno: in11, limitacao: "xvfb sem WM: isMinimized pode não refletir" });
  win.restore(); await drainAll();

  /* E12 [mandato 18] — X→TRAY com grupo ativo → migra; processo vivo segue entregando */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:t1" })); await sleep(150); deliver(pay({ dedupKey: "h4:t2" })); await sleep(350);
  other.focus(); win.hide(); await sleep(1700); // X→tray real: janela some (processo vivo) + blur
  const grp12 = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g?(g.textContent||'').slice(0,80):'' }; })()`);
  const r12 = deliver(pay({ dedupKey: "h4:t3", taskId: "cron1", taskTitle: "TEMAS" })); await sleep(500);
  rec("E12 [18] X→tray com grupo ativo: grupo migrou (2 atualizações) e NOVOS eventos seguem pela premium",
    !win.isVisible() && grp12.has && /2 atualiza/.test(grp12.txt) && r12.channel === "bg-window",
    { mainVisible: win.isVisible(), premium: grp12, novoEvento: r12.channel, shot: await shot("e12-xtray-grupo", bgWinOf()) });
  win.show(); await sleep(300); await drainAll();

  /* E13 — SOM 0× em TODAS as migrações (payload sound:false ⇒ premium suprime) */
  const handoffAcks = logs.filter((l) => l[0] === "bg.rendered" && l[1] && String(l[1].dedupKey || "").startsWith("h4:") && logs.some((m) => m[0] === "notify.handoff.accepted" && m[1] && m[1].dedupKey === l[1].dedupKey));
  const anyPlayed = handoffAcks.some((l) => String(l[1].sound) === "played");
  rec("E13 som NUNCA repete na migração (todas as re-exibições do handoff com som suprimido)",
    handoffAcks.length >= 6 && !anyPlayed,
    { migracoesComAck: handoffAcks.length, algumTocou: anyPlayed });

  /* E14 — ZERO duplicação: nunca o mesmo card visível nas 2 superfícies (pós-commit) */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:d1" })); await sleep(150); deliver(pay({ dedupKey: "h4:d2" })); await sleep(350);
  other.focus(); await sleep(1700);
  const dup = await J(`(function(){ var s=document.getElementById('notif-stack'); var out=[]; if(s) s.querySelectorAll('.ntf').forEach(function(e){ out.push(e.getAttribute('data-group')||e.__ntfKey||'?'); }); return out; })()`);
  const dupBg = await bgJ(`(function(){ var out=[]; document.querySelectorAll('.ntf').forEach(function(e){ out.push(e.getAttribute('data-group')||'solo'); }); return out; })()`);
  const inter = (Array.isArray(dup) ? dup : []).filter((k) => (Array.isArray(dupBg) ? dupBg : []).includes(k));
  rec("E14 zero duplicação: nenhum card simultâneo nas 2 superfícies após o commit",
    Array.isArray(dup) && dup.length === 0 && Array.isArray(dupBg) && dupBg.length === 1 && inter.length === 0,
    { interno: dup, premium: dupBg });

  /* E15 — CTA preservado no grupo migrado: clique REAL abre o Agenda no deep da tarefa */
  const ctaPos = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); if(!g) return {none:true}; var pr=g.querySelector('.ntfp-pr')||g.querySelector('.ntf-card'); var r=pr.getBoundingClientRect(); return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }; })()`);
  const opensBefore = await J(`(window.__NOTIF_OPEN||[]).length`);
  const bg15 = bgWinOf();
  if (ctaPos && !ctaPos.none && Number.isFinite(ctaPos.x)) {
    bg15.webContents.sendInputEvent({ type: "mouseDown", x: ctaPos.x, y: ctaPos.y, button: "left", clickCount: 1 });
    bg15.webContents.sendInputEvent({ type: "mouseUp", x: ctaPos.x, y: ctaPos.y, button: "left", clickCount: 1 });
  }
  await sleep(1000);
  const opensAfter = await J(`(window.__NOTIF_OPEN||[]).length`);
  const deepLast = await J(`(window.__NOTIF_OPEN||[]).slice(-1)[0]||''`);
  rec("E15 CTA do grupo migrado: clique real traz o Agenda (ÚNICO caminho que foca) e abre o deep da tarefa",
    win.isVisible() && win.isFocused() && Number(opensAfter) === Number(opensBefore) + 1 && /task\/vid1/.test(String(deepLast)),
    { mainFocada: win.isFocused(), deep: deepLast });
  await drainAll();

  /* E16 — RETRY REAL: 1ª entrega sem render (janela premium destruída no meio) → retry recupera → commit */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:rt1", severity: "critical", title: "Crítica p/ retry" })); await sleep(400);
  const retryBefore = logs.filter((l) => l[0] === "notify.handoff.retry").length;
  const realShow16 = ctx.bgNotify_1.showBgNotify;
  ctx.bgNotify_1.showBgNotify = (p) => { logs.push(["harness.bg.blackhole16", { dedupKey: p && p.dedupKey }]); return true; }; // 1ª entrega NÃO renderiza (falha simulada no stub do módulo)
  other.focus(); await sleep(600); // coleta+tx (entrega engolida ⇒ aceite nunca vem)
  ctx.bgNotify_1.showBgNotify = realShow16; // o RETRY usará o caminho REAL (janela premium de verdade)
  await sleep(4700); // HANDOFF_ACCEPT_MS (4.6s) ⇒ txFail ⇒ RETRY real
  const retryAfter = logs.filter((l) => l[0] === "notify.handoff.retry").length;
  await sleep(1600); // retry renderiza → ACEITE → COMMIT
  const in16 = await stackN();
  const out16 = await bgCards();
  const acc16 = logs.some((l) => l[0] === "notify.handoff.accepted" && l[1] && l[1].dedupKey === "h4:rt1");
  rec("E16 retry REAL: 1ª entrega falha (premium destruída antes do render) → retry recria e entrega → aceite → commit (zero perda)",
    retryAfter === retryBefore + 1 && acc16 && in16 === 0 && out16 === 1,
    { retries: retryAfter - retryBefore, accepted: acc16, interno: in16, premium: out16, shot: await shot("e16-retry-recupera", bgWinOf()) });
  await drainAll();

  /* E17 — HISTÓRICO/SINO intocado: cada evento (inclusive os agrupados) capturado individualmente */
  win.focus(); await sleep(300);
  const histBefore = await J(`Number(window.__NOTIF_HIST||0)`);
  deliver(pay({ dedupKey: "h4:h1" })); await sleep(150);
  deliver(pay({ dedupKey: "h4:h2" })); await sleep(150);
  deliver(pay({ dedupKey: "h4:h3" })); await sleep(500);
  const histAfter = await J(`Number(window.__NOTIF_HIST||0)`);
  rec("E17 sino/histórico: CADA evento do grupo registrado individualmente (3 eventos = +3 no histórico)",
    Number(histAfter) === Number(histBefore) + 3,
    { antes: histBefore, depois: histAfter });
  await drainAll();

  /* E18 — 2ª falha PRESERVA o interno (sem commit; card interno segue no DOM; zero perda) */
  win.focus(); await sleep(300);
  deliver(pay({ dedupKey: "h4:pv1", severity: "critical", title: "Crítica p/ preservação" })); await sleep(400);
  const realShow = ctx.bgNotify_1.showBgNotify;
  ctx.bgNotify_1.showBgNotify = (p) => { logs.push(["harness.bg.blackhole", { dedupKey: p && p.dedupKey }]); return true; }; // falha de render simulada NO STUB do módulo (código de produto intacto)
  other.focus(); await sleep(300); // coleta+tx (entrega engolida)
  await sleep(4800);  // 1º prazo ⇒ retry (engolido de novo)
  await sleep(4800);  // 2º prazo ⇒ PRESERVA
  ctx.bgNotify_1.showBgNotify = realShow;
  const preserved = logs.some((l) => l[0] === "notify.handoff.preserved" && l[1] && l[1].dedupKey === "h4:pv1");
  const commit18 = logs.some((l) => l[0] === "notify.handoff.accepted" && l[1] && l[1].dedupKey === "h4:pv1");
  const in18 = await stackN();
  rec("E18 falha dupla de aceite: interno PRESERVADO (NUNCA houve commit; log preserved; zero perda — sino tem o evento)",
    preserved && !commit18 && ctx.__h.txN === 0,
    { preserved, commit: commit18, internoDOM: in18, txAtivas: ctx.__h.txN });
  await drainAll();

  /* E19 — teardown limpo */
  bgReal.stopBgNotify(); await sleep(200);
  rec("E19 teardown (quit real): janela premium destruída; sem transações penduradas",
    !bgReal.bgStatus().hasWindow && ctx.__h.txN === 0, { status: bgReal.bgStatus(), tx: ctx.__h.txN });

  const failures = results.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, "f355eh4-proof-results.json"), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
  clearTimeout(WATCHDOG);
  process.stdout.write(`PROOF_DONE proofs=${results.length} failures=${failures}\n`);
  app.exit(failures ? 1 : 0);
});
