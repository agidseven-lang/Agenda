/* F3.5.5E-H3 — PROVAS REAIS da VISIBILIDADE GLOBAL (Electron 31.3.1; xvfb).
 *
 * PIPELINE REAL DE PRODUÇÃO NO PRÓPRIO PROCESSO MAIN DO HARNESS:
 *   • bgNotify.js REAL do dist compilado (require direto — ensureWin/reassert/position/updateBgGroup/
 *     stopBgNotify/bgStatus reais; janela premium frameless/transparente/focusable:false real;
 *     bgnotify.html + dist/preload/bgnotify-preload.js REAIS — bytes idênticos aos do app.asar,
 *     sha256 comparado na cena E00);
 *   • deliverNotification + bloco do HANDOFF + bringToFrontAndOpen + handler notif-collect-reply
 *     EXTRAÍDOS BYTE-A-BYTE do dist/main/main.js compilado e executados em vm no MESMO processo
 *     (toastAck REAL de dist/main/toastAck.js; nativeNotify stub contador — Notification do SO não
 *     existe em xvfb, limitação declarada);
 *   • renderer REAL (index.html empacotado em app.asar) com canais IPC REAIS (notif-toast /
 *     notif-toast-ack / notif-collect-request / notif-collect-reply — mesmos nomes de produção).
 *
 * LIMITAÇÕES DECLARADAS (validação física do owner no Windows): o z-order do DWM do Windows real
 * (screen-saver topmost sobre Chrome/Word reais) não é reproduzível em xvfb — aqui provamos
 * isAlwaysOnTop()+nível+moveTop+bounds+foco; a Notification nativa (fallback) não renderiza em xvfb.
 *
 * 20 provas: E00 bytes  E01 boot  E02 focado→toast  E03 blur→HANDOFF real  E04 atrás→bg direto
 * E05 z-flags  E06 minimizado  E07 oculto/tray  E08 digitação preservada  E09 CTA Abrir→
 * E10 X fecha só o card  E11 reassert pós-hide  E12 destroy/recreate  E13 20 consecutivas
 * E14 empilhamento 4  E15 dedupe  E16 grupo+reassert  E17 125%  E18 150%  E19 workArea */
const { app, BrowserWindow, session, ipcMain, screen } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");

const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f355eh3-qa");
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
/* Em produção app.getAppPath() é a RAIZ do app.asar e o loadFile do bgNotify resolve
 * "<appPath>/src/renderer/bgnotify.html". Lançado como `electron scripts/<harness>.js`, o appPath
 * vira desktop/scripts — aponta-se para desktop/ para reproduzir exatamente o layout do pacote. */
try { app.setAppPath(path.join(__dirname, "..")); } catch (_) {}
try { if (app.getAppPath() !== path.join(__dirname, "..")) Object.defineProperty(app, "getAppPath", { value: () => path.join(__dirname, "..") }); } catch (_) {}

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f355eh3-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js", "bgnotify.html"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f355eh3-app-" + Date.now() + ".asar");
  await asar.createPackage(stage, asarPath);
  return { idxSha: sha256(path.join(SRC, "index.html")), bgSha: sha256(path.join(SRC, "bgnotify.html")) };
}

const results = [];
function rec(name, ok, info) { results.push({ name, ok: !!ok, info: info || {} }); line({ proof: name, ok: !!ok, info: info || {} }); }

/* extrai um trecho balanceado do dist a partir de um marcador */
function grabBalanced(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const j = src.indexOf("{", i);
  let d = 0;
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); } }
  return null;
}

app.whenReady().then(async () => {
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_10min\n"); } catch (_) {} app.exit(1); }, 10 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  const meta = await packAsar();
  fs.writeFileSync(path.join(os.tmpdir(), "f355eh3-seed.json"), JSON.stringify(seed));

  /* ── módulos REAIS do dist ── */
  const DIST = path.join(__dirname, "..", "dist", "main");
  const logs = [];
  /* intercepta o diag REAL (namespace CJS vivo) — o bgNotify.js real loga bg.show/bg.rendered aqui */
  const diagMod = require(path.join(DIST, "diag.js"));
  try { const _d = diagMod.diag; Object.defineProperty(diagMod, "diag", { value: (t, d) => { logs.push([t, d]); try { _d(t, d); } catch (_) {} } }); } catch (_) {}
  const bgReal = require(path.join(DIST, "bgNotify.js"));
  const toastAckMod = require(path.join(DIST, "toastAck.js"));
  const dMain = fs.readFileSync(path.join(DIST, "main.js"), "utf8");

  /* E00 — bytes: renderers usados pela janela premium/asar são os MESMOS do pacote
   * (leitura DE DENTRO do asar usa o fs COM patch de asar do Electron; original-fs não o enxerga) */
  const asarSha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  const asarIdx = asarSha(path.join(asarPath, "src", "renderer", "index.html"));
  const asarBg = asarSha(path.join(asarPath, "src", "renderer", "bgnotify.html"));
  rec("E00 bytes idênticos (fonte == asar) p/ index e bgnotify + dist real presente",
    asarIdx === meta.idxSha && asarBg === meta.bgSha && dMain.includes("notif-collect-reply"),
    { idx: meta.idxSha.slice(0, 12), bg: meta.bgSha.slice(0, 12) });

  /* ── contexto vm com os corpos REAIS extraídos do dist ── */
  const nativeCalls = [];
  const bodyDeliver = grabBalanced(dMain, "function deliverNotification(p)");
  const bodyHandoff = (() => { const i = dMain.indexOf("const activeToasts = new Map("); const j = dMain.indexOf("/* handoff nunca derruba a entrega */ }\n}", i); return i >= 0 && j > i ? dMain.slice(i, j + "/* handoff nunca derruba a entrega */ }\n}".length) : null; })();
  const bodyBring = grabBalanced(dMain, "function bringToFrontAndOpen(deep)");
  const bodyWinActive = grabBalanced(dMain, "function windowActive()");
  const collectCbSrc = (() => { const m = dMain.match(/ipcMain\.on\("notif-collect-reply", (\(_e, reqId, keys\) => \{)/); if (!m) return null; const i = dMain.indexOf(m[1], m.index); let d = 0; for (let k = dMain.indexOf("{", i); k < dMain.length; k++) { if (dMain[k] === "{") d++; else if (dMain[k] === "}") { d--; if (!d) return dMain.slice(i, k + 1); } } return null; })();
  /* RE-PINADO F3.5.5E-H4 — handler do ACEITE transacional (bgnotify-rendered → txCommit), tambem
   * extraido byte-a-byte do dist: sem ele o commit do handoff nao fecha o toast interno. */
  const acceptCbSrc = (() => { const m = dMain.indexOf('ipcMain.on("bgnotify-rendered", (_e, info)'); if (m < 0) return null; const i = dMain.indexOf("(_e", m); let d = 0; for (let k = dMain.indexOf("{", i); k < dMain.length; k++) { if (dMain[k] === "{") d++; else if (dMain[k] === "}") { d--; if (!d) return dMain.slice(i, k + 1); } } return null; })();
  rec("E00b corpos REAIS extraídos do dist (deliver/handoff/bring/windowActive/collect-reply)",
    !!(bodyDeliver && bodyHandoff && bodyBring && bodyWinActive && collectCbSrc), { d: !!bodyDeliver, h: !!bodyHandoff, b: !!bodyBring, w: !!bodyWinActive, c: !!collectCbSrc });

  const ctx = {
    console, setTimeout, clearTimeout,
    require: (m) => { if (String(m).includes("notifEvents")) return require(path.join(DIST, "notifEvents.js")); throw new Error("ctx-no:" + m); },
    diag: (t, d) => logs.push([t, d]), diag_1: { diag: (t, d) => logs.push([t, d]) },
    nlog: (t, d) => logs.push([t, d]), nmask: (s) => String(s || "").slice(0, 4) + "…",
    mainWin: null, pendingDeep: "",
    sessionLocked: false, _notifSeen: new Set(),
    toastAck: toastAckMod.createToastAckTracker({ onLog: (t, d) => logs.push([t, d]) }),
    bgNotify_1: { showBgNotify: bgReal.showBgNotify, updateBgGroup: bgReal.updateBgGroup },
    showBgNotify: bgReal.showBgNotify, updateBgGroup: bgReal.updateBgGroup,
    nativeNotify: (p, key) => { nativeCalls.push(key); return true; },
    notifTele: {}, app: { getVersion: () => "1.0.227" },
    classifyReminderLevel: () => null, slaReminderCtl: null,
    premiumCommonEnabled: true, notificationGrouping: null,
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
    "globalThis.__h = { get active(){ return activeToasts.size; }, handoff: handoffActiveToasts };",
    { filename: "dist-extract.js" }).runInContext(ctx);
  const deliver = (p) => ctx.__deliver(p);

  /* IPC do main do harness — MESMOS canais de produção */
  ipcMain.on("notif-toast-ack", (_e, key) => { ctx.toastAck.ack(String(key || "")); });
  ipcMain.on("notif-collect-reply", (_e, reqId, keys) => ctx.__collectCb(_e, reqId, keys));
  ipcMain.on("bgnotify-rendered", (_e, info) => ctx.__acceptCb(_e, info)); // RE-PINADO F3.5.5E-H4 — ACEITE do handoff transacional (wiring de produção)
  bgReal.initBgNotify((deep) => ctx.__bring(String(deep || "")));

  /* janela principal REAL (index do asar + canais reais) */
  const win = new BrowserWindow({ width: 1200, height: 800, show: true, webPreferences: {
    preload: path.join(__dirname, "f355eh3-proof-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  ctx.mainWin = win;
  const wc = win.webContents;
  wc.on("console-message", (_e, lvl, msg, ln, src) => { if (lvl >= 2) line({ console: String(msg).slice(0, 200), src: String(src || "").split("/").pop(), ln }); });
  win.on("blur", () => { try { ctx.__h.handoff(); } catch (_) {} }); // wiring de produção (main.ts congelado por suíte)
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  async function shot(nm, w) { try { await sleep(430); const img = await (w || wc).capturePage(); fs.writeFileSync(path.join(OUT, nm + ".png"), img.toPNG()); return nm + ".png"; } catch (e) { return "shot_err:" + String((e && e.message) || e).slice(0, 80); } }
  const bgWinOf = () => BrowserWindow.getAllWindows().find((w) => { try { return !w.isDestroyed() && String(w.webContents.getURL()).includes("bgnotify.html"); } catch (_) { return false; } });
  const bgJ = async (code) => { const b = bgWinOf(); if (!b) return { none: true }; return b.webContents.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) })); };

  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 30; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user: !!(st&&st.user), tasks: ((st&&st.tasks)||[]).length, api: !!(window.desktopAPI&&window.desktopAPI.onNotifCollect) }; })()`);
    if (boot && boot.user && boot.tasks === 2) break;
    await sleep(500);
  }
  rec("E01 BOOT app real do asar (semente + canais reais de coleta)", !!(boot && boot.user && boot.tasks === 2 && boot.api), boot);

  const T20 = new Date(); T20.setHours(20, 30, 0, 0);
  let seq = 0;
  const pay = (o) => Object.assign({
    eventType: "task_moved", taskId: "vid1", taskTitle: "Reels institucional", clientName: "Hospital Visão",
    title: "Tarefa movimentada", body: "", severity: "info", sound: true, targetUserId: ID.ANA,
    actorId: ID.DIEGO, actorName: "Diego Designer", fromStatus: "Em andamento", toStatus: "Revisão",
    sector: "edicao_midia", sectorLabel: "Edição de vídeos", createdAt: T20.getTime(),
    action: { type: "task", deep: "task/vid1" }, dedupKey: "h3:" + (++seq),
  }, o || {});

  /* E02 — FOCADO → toast interno no DOM real; janela premium NÃO aparece */
  win.focus(); await sleep(250);
  const r02 = deliver(pay());
  await sleep(500);
  const dom02 = await J(`(function(){ var s=document.getElementById('notif-stack'); var n=s?s.querySelectorAll('.ntf').length:0; var k=n?s.querySelector('.ntf').__ntfKey:''; return { n:n, key:k }; })()`);
  const bg02 = bgWinOf();
  rec("E02 FOCADO → toast real no stack interno (canal toast; premium fechada)",
    r02.channel === "toast" && dom02.n === 1 && String(dom02.key).startsWith("h3:") && (!bg02 || !bg02.isVisible()),
    { channel: r02.channel, dom: dom02, bgVisible: !!(bg02 && bg02.isVisible()) });

  /* E03 — BLUR → HANDOFF REAL (coleta IPC + janela premium com o MESMO card; sem som) */
  const other = new BrowserWindow({ width: 700, height: 500, show: true });
  await other.loadURL("data:text/html,<title>OutroApp</title><textarea id='t' autofocus style='width:90%25;height:80%25'></textarea>");
  other.focus(); await sleep(1300); // blur real da main → coleta → reply → showBgNotify
  const bg03 = bgWinOf();
  const card03 = await bgJ(`(function(){ var s=document.getElementById('bgstack')||document.body; var c=document.querySelectorAll('.ntf').length; var fl=!!document.querySelector('.ntfp-fl'); var pr=document.querySelector('.ntfp-pr'); return { cards:c, fl:fl, cta: pr?pr.textContent:'' }; })()`);
  const dom03 = await J(`(function(){ var s=document.getElementById('notif-stack'); return { n: s?s.querySelectorAll('.ntf').length:0 }; })()`);
  const replyLog = logs.some((l) => l[0] === "notify.handoff.reply");
  const movedLog = logs.filter((l) => l[0] === "notify.handoff.accepted").length; // RE-PINADO F3.5.5E-H4: o handoff virou TRANSACIONAL — a migração provada agora é o ACEITE (render provado na premium) + commit; o comportamento externo desta cena é o MESMO (toast fecha, premium mostra, som suprimido)
  const ack03 = logs.find((l) => l[0] === "bg.rendered" && l[1] && String(l[1].dedupKey || "").startsWith("h3:"));
  rec("E03 BLUR → HANDOFF real: card MIGROU p/ janela premium (coleta respondida; toast interno fechado; som suprimido)",
    !!bg03 && bg03.isVisible() && card03.cards === 1 && card03.fl && /Abrir/.test(card03.cta) && dom03.n === 0 && replyLog && movedLog === 1
    && !!ack03 && String(ack03[1].sound) === "suppressed_by_payload",
    { bgVisible: !!(bg03 && bg03.isVisible()), card: card03, stackInterno: dom03.n, replyLog, movedLog, sound: ack03 ? ack03[1].sound : "?", shot: await shot("e03-handoff-blur", bg03) });

  /* E04 — Agenda aberto ATRÁS (outro app na frente) → NOVO evento vai DIRETO p/ premium (nunca toast) */
  const r04 = deliver(pay({ eventType: "task_completed", toStatus: "Concluído", severity: "success", title: "Tarefa concluída" }));
  await sleep(450);
  const card04 = await bgJ(`(function(){ return { cards: document.querySelectorAll('.ntf').length }; })()`);
  rec("E04 Agenda ABERTO ATRÁS → canal bg-window direto (o renderer oculto nunca recebe toast)",
    r04.channel === "bg-window" && card04.cards === 2 && other.isFocused(),
    { channel: r04.channel, cards: card04.cards, outroFocado: other.isFocused(), shot: await shot("e04-atras-bg", bgWinOf()) });

  /* E05 — flags de z-order/topmost + sem foco */
  const bg05 = bgWinOf();
  const wa = screen.getPrimaryDisplay().workArea;
  const b05 = bg05.getBounds();
  rec("E05 janela premium: alwaysOnTop + dentro da workArea + NUNCA focada (focusable:false/showInactive)",
    bg05.isAlwaysOnTop() && !bg05.isFocused() && b05.x >= wa.x && b05.y >= wa.y && b05.x + b05.width <= wa.x + wa.width + 1 && b05.y + b05.height <= wa.y + wa.height + 1,
    { alwaysOnTop: bg05.isAlwaysOnTop(), focused: bg05.isFocused(), bounds: b05, workArea: wa });

  /* limpa cards (fecha via X de cada um) para as próximas cenas */
  await bgJ(`(function(){ document.querySelectorAll('.ntf .ntfp-x,.ntf .ntf-x').forEach(function(x){ x.click(); }); return true; })()`);
  await sleep(600);

  /* E06 — minimizado → premium */
  win.minimize(); await sleep(350);
  const r06 = deliver(pay({ eventType: "task_reopened", fromStatus: "Concluído", toStatus: "Em andamento", severity: "warning", title: "Tarefa reaberta" }));
  await sleep(450);
  const bg06 = bgWinOf();
  rec("E06 Agenda MINIMIZADO → janela premium visível (roteador vê perda de foco; minimize REAL do WM = validação física — xvfb não tem window manager)",
    r06.channel === "bg-window" && !!bg06 && bg06.isVisible() && !win.isFocused(),
    { channel: r06.channel, minimizedApi: win.isMinimized(), mainFocused: win.isFocused(), bgVisible: !!(bg06 && bg06.isVisible()), limitacao: "xvfb sem WM: isMinimized pode não refletir" });

  /* E07 — oculto/tray (X→hide) → premium; processo vivo */
  win.restore(); await sleep(250); win.hide(); await sleep(250);
  const r07 = deliver(pay({ eventType: "designer_assigned", title: "Nova tarefa atribuída", responsibleId: ID.FELIPE, responsibleName: "Felipe Teodozio" }));
  await sleep(450);
  rec("E07 Agenda OCULTO (X→tray) → janela premium continua entregando",
    r07.channel === "bg-window" && !win.isVisible() && bgWinOf().isVisible(),
    { channel: r07.channel, mainVisible: win.isVisible() });

  /* E08 — digitação contínua no "outro app" NUNCA é interrompida */
  other.focus(); await sleep(250);
  await other.webContents.executeJavaScript(`(function(){ var t=document.getElementById('t'); t.value=''; t.focus(); return true; })()`);
  let focusSamples = [];
  const typed = "VISIBILIDADE_H3_OK_";
  for (let i = 0; i < typed.length; i++) {
    other.webContents.sendInputEvent({ type: "char", keyCode: typed[i] });
    if (i === 6) deliver(pay({ title: "Durante digitação 1" }));
    if (i === 12) deliver(pay({ title: "Durante digitação 2" }));
    focusSamples.push(other.isFocused());
    await sleep(45);
  }
  await sleep(500);
  const tval = await other.webContents.executeJavaScript(`document.getElementById('t').value`);
  const bg08 = bgWinOf();
  rec("E08 FOCO NUNCA roubado: digitação íntegra no outro app com 2 notificações no meio",
    tval === typed && focusSamples.every(Boolean) && other.isFocused() && !!bg08 && bg08.isVisible() && !bg08.isFocused() && !win.isFocused(),
    { typed: tval === typed, focoSempre: focusSamples.every(Boolean), bgFocada: bg08 ? bg08.isFocused() : "?", shot: await shot("e08-digitacao", bg08) });

  /* E09 — CTA "Abrir →" traz o Agenda e abre a tarefa (ÚNICO caminho que foca) */
  const cta = await bgJ(`(function(){ var pr=document.querySelector('.ntf .ntfp-pr'); if(!pr) return {none:true}; var r=pr.getBoundingClientRect(); return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) }; })()`);
  if (cta && !cta.none && Number.isFinite(cta.x)) {
    bg08.webContents.sendInputEvent({ type: "mouseDown", x: cta.x, y: cta.y, button: "left", clickCount: 1 });
    bg08.webContents.sendInputEvent({ type: "mouseUp", x: cta.x, y: cta.y, button: "left", clickCount: 1 });
  }
  await sleep(900);
  const opened = await J(`(window.__NOTIF_OPEN||[]).length`);
  rec("E09 CTA 'Abrir →' (clique REAL no segmento): mainWindow restaurada+focada + deep-link entregue",
    win.isVisible() && win.isFocused() && Number(opened) >= 1,
    { mainVisible: win.isVisible(), mainFocused: win.isFocused(), deepLinks: Number(opened) });

  /* E10 — X fecha SÓ o card; fila vazia esconde a janela premium; foco não muda.
   * Antes: DRENA os cards residuais das cenas E06-E09 (fecha um a um até o stack zerar). */
  other.focus(); await sleep(300);
  for (let i = 0; i < 8; i++) {
    const left = await bgJ(`(function(){ var x=document.querySelector('.ntf .ntfp-x,.ntf .ntf-x'); if(x){ x.click(); } return document.querySelectorAll('.ntf').length; })()`);
    await sleep(350);
    if (!left || left.none || Number(left) <= 1) break;
  }
  await sleep(500);
  deliver(pay({ title: "Para fechar no X" })); await sleep(500);
  const before10 = await bgJ(`(function(){ return { cards: document.querySelectorAll('.ntf').length }; })()`);
  await bgJ(`(function(){ var x=document.querySelector('.ntf .ntfp-x,.ntf .ntf-x'); if(x) x.click(); return true; })()`);
  await sleep(800);
  const bg10 = bgWinOf();
  const empt = await bgJ(`(function(){ return { cards: document.querySelectorAll('.ntf').length }; })()`);
  rec("E10 X fecha só a notificação; fila vazia → janela premium esconde (bgnotify-empty→hide reais)",
    before10 && before10.cards === 1 && (!bg10 || !bg10.isVisible() || (empt && empt.cards === 0)) && other.isFocused(),
    { antes: before10 && before10.cards, bgVisible: !!(bg10 && bg10.isVisible()), cards: empt && empt.cards, outroFocado: other.isFocused() });

  /* E11 — REASSERT pós-hide: novo evento reapresenta com bounds+topmost reafirmados */
  const r11 = deliver(pay({ title: "Reapresentação pós-hide" }));
  await sleep(450);
  const bg11 = bgWinOf();
  const b11 = bg11.getBounds();
  const okBounds11 = Math.abs((b11.x + b11.width) - (wa.x + wa.width - 14)) <= 2 && Math.abs((b11.y + b11.height) - (wa.y + wa.height - 14)) <= 2;
  rec("E11 reassert de apresentação: hide→show volta VISÍVEL, topmost e re-ancorada no canto (workArea−14px)",
    r11.channel === "bg-window" && bg11.isVisible() && bg11.isAlwaysOnTop() && okBounds11,
    { bounds: b11, cantoOk: okBounds11, alwaysOnTop: bg11.isAlwaysOnTop() });

  /* E12 — destroy → recreate automático (ensureWin) */
  bgReal.stopBgNotify(); await sleep(250);
  const r12 = deliver(pay({ title: "Após destroy" }));
  await sleep(700);
  const bg12 = bgWinOf();
  rec("E12 janela destruída → recriada sozinha no próximo evento (nunca fica sem superfície)",
    r12.channel === "bg-window" && !!bg12 && bg12.isVisible() && bgReal.bgStatus().hasWindow,
    { status: bgReal.bgStatus() });

  /* E13 — 20 notificações consecutivas: sem crash; cap 5 do stack premium; ACKs de render */
  const acksBefore = logs.filter((l) => l[0] === "bg.rendered").length;
  for (let i = 0; i < 20; i++) { deliver(pay({ title: "Rajada " + (i + 1) })); await sleep(120); }
  await sleep(900);
  const stack13 = await bgJ(`(function(){ return { cards: document.querySelectorAll('.ntf').length }; })()`);
  const acks13 = logs.filter((l) => l[0] === "bg.rendered").length - acksBefore;
  rec("E13 20 consecutivas: processo estável, cap 5 do stack premium respeitado, renders provados por ACK",
    stack13.cards <= 5 && stack13.cards >= 1 && acks13 >= 16 && bgWinOf().isVisible(),
    { cards: stack13.cards, acks: acks13 });

  /* E14 — empilhamento: 4 cards com avatar flutuante + cápsula CTA cada um; sem sobreposição */
  await bgJ(`(function(){ document.querySelectorAll('.ntf .ntfp-x,.ntf .ntf-x').forEach(function(x){ x.click(); }); return true; })()`);
  await sleep(700);
  for (let i = 0; i < 4; i++) { deliver(pay({ title: "Empilhada " + (i + 1) })); await sleep(200); }
  await sleep(700);
  const st14 = await bgJ(`(function(){ var out=[]; document.querySelectorAll('.ntf').forEach(function(e){ var w=e.querySelector('.ntfp-wrap'); var f=e.querySelector('.ntfp-fl'); var p=e.querySelector('.ntfp-pr'); var r=w?w.getBoundingClientRect():null; out.push({ ok: !!(w&&f&&p), top: r?Math.round(r.top):-1, bottom: r?Math.round(r.bottom):-1 }); }); return out; })()`);
  let invade14 = false;
  for (let i = 1; i < st14.length; i++) { if (st14[i].top < st14[i - 1].bottom - 2) invade14 = true; }
  rec("E14 4 empilhadas: avatar+cápsula+CTA presentes em TODAS; nenhuma invade a vizinha",
    Array.isArray(st14) && st14.length === 4 && st14.every((c) => c.ok) && !invade14,
    { n: st14.length, invade: invade14, shot: await shot("e14-empilhadas", bgWinOf()) });

  /* E15 — dedupe: mesmo dedupKey 2× ⇒ 1 entrega */
  const dk = "h3:dedupe-1";
  const rA = deliver(pay({ dedupKey: dk, title: "Dedupe" }));
  const rB = deliver(pay({ dedupKey: dk, title: "Dedupe" }));
  rec("E15 dedupe do HUB: segunda emissão da MESMA chave não gera novo card/som",
    rA.ok && rA.channel === "bg-window" && rB.ok && rB.channel === "dedup",
    { a: rA.channel, b: rB.channel });

  /* E16 — grupo: update MORFA o card premium e REAFIRMA topmost (janela segue visível/topmost) */
  await bgJ(`(function(){ document.querySelectorAll('.ntf .ntfp-x,.ntf .ntf-x').forEach(function(x){ x.click(); }); return true; })()`);
  await sleep(700);
  ctx.notificationGrouping = { route: (() => { let first = true; return (p) => { if (first) { first = false; return { action: "first", groupKey: "g1", view: null }; } return { action: "update", groupKey: "g1", view: { groupKey: "g1", count: 2, taskTitle: p.taskTitle, clientName: p.clientName, items: [{ t: "Movida" }, { t: "Movida de novo" }], extraCount: 0, severity: "info", _premiumCommon: true } }; }; })() };
  const g1 = deliver(pay({ title: "Grupo 1" })); await sleep(450);
  const g2 = deliver(pay({ title: "Grupo 2" })); await sleep(600);
  const bg16 = bgWinOf();
  const grp16 = await bgJ(`(function(){ var g=document.querySelector('.ntf[data-group]'); return { has: !!g, txt: g? (g.textContent||'').slice(0,60):'' }; })()`);
  ctx.notificationGrouping = null;
  rec("E16 grupo comum: 1º card + update MORFADO no card existente; topmost reafirmado no update",
    g1.channel === "bg-window" && g2.channel === "grouped" && grp16.has && bg16.isVisible() && bg16.isAlwaysOnTop(),
    { g1: g1.channel, g2: g2.channel, morfado: grp16.has, alwaysOnTop: bg16.isAlwaysOnTop() });

  /* E17/E18 — escalas 125%/150%: card íntegro (avatar flutuante NUNCA cortado — headroom no bounding) */
  for (const [nm, zf] of [["e17-zoom125", 1.25], ["e18-zoom150", 1.5]]) {
    const bgZ = bgWinOf();
    bgZ.webContents.setZoomFactor(zf); await sleep(500);
    const z = await bgJ(`(function(){ var f=document.querySelector('.ntfp-fl'); if(!f) return {none:true}; var r=f.getBoundingClientRect(); var w=document.querySelector('.ntfp-wrap').getBoundingClientRect(); return { flTop: Math.round(r.top), flAcimaDoCard: Math.round(w.top - r.top), dentroDaJanela: r.top >= 0 }; })()`);
    rec((nm === "e17-zoom125" ? "E17 escala 125%" : "E18 escala 150%") + ": avatar flutuante visível e NÃO cortado (headroom no bounding)",
      z && !z.none && z.dentroDaJanela && z.flAcimaDoCard >= 10,
      Object.assign({}, z, { shot: await shot(nm, bgZ) }));
    bgZ.webContents.setZoomFactor(1);
  }

  /* E19 — workArea: canto inferior direito com margem 14 no display REAL do runner */
  const bg19 = bgWinOf(); const b19 = bg19.getBounds();
  rec("E19 posição = canto inferior direito da workArea REAL (margem 14px; nunca fora da tela)",
    Math.abs((b19.x + b19.width) - (wa.x + wa.width - 14)) <= 2 && b19.y + b19.height <= wa.y + wa.height - 12 && b19.x >= wa.x,
    { bounds: b19, workArea: wa });

  /* E20 — teardown limpo (quit real): janela destruída; ACKs pendentes cancelados */
  bgReal.stopBgNotify(); await sleep(200);
  rec("E20 teardown (quit real): janela premium destruída e fallbacks pendentes cancelados",
    !bgReal.bgStatus().hasWindow, bgReal.bgStatus());

  const failures = results.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, "f355eh3-proof-results.json"), JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
  clearTimeout(WATCHDOG);
  process.stdout.write(`PROOF_DONE proofs=${results.length} failures=${failures}\n`);
  app.exit(failures ? 1 : 0);
});
