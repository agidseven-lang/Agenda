/* F3.5.6A-H1 — RED DE SUPERFÍCIE (P0 da falha física): o elo que o harness da fase ESTUBOU.
 * Cadeia 100% REAL a partir do snapshot: workflowNotifier.js REAL do dist (produtor) →
 * deliverNotification REAL (corpo extraído byte-a-byte do dist/main/main.js, mesma técnica
 * aprovada F3.5.5E-H4) → bgNotify.js REAL (janela premium) / renderer REAL do asar (toast) →
 * bgnotify.html REAL. Docs de entrada: gerados pelo WORKER REAL em vm (dump-f356a-docs.mjs) —
 * o MESMO commit que a produção gravou na aprovação física.
 *
 * CENÁRIO FÍSICO (owner): Desktop logado como a Social, janela SEM FOCO (owner no navegador
 * clicando 'Aprovar cronograma'); a tarefa muda em tempo real; a notificação deve nascer na
 * janela premium (canto inferior direito) com som ÚNICO e zero duplicação.
 *
 * S0 boot: eventos da própria Social suprimidos (zero ingresso)
 * S1 desfocado + cliente VISUALIZA → 1 ingresso, canal bg-window, card real na premium (sem som)
 * S2 desfocado + cliente APROVA → 1 ingresso wf_client_themes_approved, canal bg-window,
 *    card real 'Temas aprovados' + ACK de render do dedupKey + som 1× (política) [PROVA-CHAVE]
 * S3 re-snapshot ×2 → zero duplicação (recibo) nas DUAS camadas
 * S4 FOCADO + segunda tarefa aprovada → toast REAL no renderer do asar (ACK, sem fallback)
 * S5 nativa NUNCA chamada (premium/toast provaram render) */
const { app, BrowserWindow, session, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const vm = require("vm");
const crypto = require("crypto");

// F3.5.6A-H1 — prova da fase: docs REAIS do Worker (f356ah1-dump-docs.mjs) via tmpdir; saídas em docs/f356ah1-qa.
const OUT = process.env.PROOF_OUT || path.join(__dirname, "..", "..", "docs", "f356ah1-qa");
try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function line(o) { try { process.stdout.write("PROOF_LINE " + JSON.stringify(o) + "\n"); } catch (_) {} }
process.on("uncaughtException", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=uncaught:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });
process.on("unhandledRejection", (e) => { try { process.stdout.write("PROOF_DONE proofs=? failures=999 FATAL=unhandled:" + String((e && e.stack) || e).slice(0, 300) + "\n"); } catch (_) {} app.exit(1); });

const DOCS = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "f356ah1-docs.json"), "utf8"));
const ANA = DOCS.ANA;

app.on("window-all-closed", () => {});
app.disableHardwareAcceleration();
try { app.setAppPath(path.join(__dirname, "..")); } catch (_) {}
try { if (app.getAppPath() !== path.join(__dirname, "..")) Object.defineProperty(app, "getAppPath", { value: () => path.join(__dirname, "..") }); } catch (_) {}

let asarPath = "";
async function packAsar() {
  const asar = require("@electron/asar");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "f356ah1-asar-"));
  const rdir = path.join(stage, "src", "renderer");
  fs.mkdirSync(rdir, { recursive: true });
  const SRC = path.join(__dirname, "..", "src", "renderer");
  for (const f of ["index.html", "priorityEngine.js", "bgnotify.html"]) fs.copyFileSync(path.join(SRC, f), path.join(rdir, f));
  asarPath = path.join(os.tmpdir(), "f356ah1-app-" + Date.now() + ".asar");
  await asar.createPackage(stage, asarPath);
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
  const WATCHDOG = setTimeout(() => { try { process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=999 FATAL=watchdog_timeout_8min\n"); } catch (_) {} app.exit(1); }, 8 * 60 * 1000);
  try { session.defaultSession.webRequest.onBeforeRequest((d, cb) => { cb({ cancel: /^https?:/i.test(d.url) }); }); } catch (_) {}
  await packAsar();

  /* semente do renderer real (mesma infraestrutura do eh4) */
  const seed = {
    self: { id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", admin: false, status: "ativo" },
    users: [{ id: ANA, name: "Ana Beatriz Social Media", role: "Social Media", status: "ativo" }],
    tasks: [DOCS.s1.boot, DOCS.s2.boot], events: [],
  };
  fs.writeFileSync(path.join(os.tmpdir(), "f356ah1-seed.json"), JSON.stringify(seed));

  const DIST = path.join(__dirname, "..", "dist", "main");
  const logs = [];
  const bgReal = require(path.join(DIST, "bgNotify.js"));
  const toastAckMod = require(path.join(DIST, "toastAck.js"));
  const groupingMod = require(path.join(DIST, "notificationGrouping.js"));
  const slaRemMod = require(path.join(DIST, "slaReminder.js"));
  const WN = require(path.join(DIST, "workflowNotifier.js"));
  const dMain = fs.readFileSync(path.join(DIST, "main.js"), "utf8");

  const nativeCalls = [];
  const renderedAcks = [];   // ACKs bgnotify-rendered (info sanitizada: dedupKey/severity/eventType/sound)
  const bodyDeliver = grabBalanced(dMain, "function deliverNotification(p)");
  const bodyHandoff = (() => { const i = dMain.indexOf("const activeToasts = new Map("); const j = dMain.indexOf("/* handoff nunca derruba a entrega */ }\n}", i); return i >= 0 && j > i ? dMain.slice(i, j + "/* handoff nunca derruba a entrega */ }\n}".length) : null; })();
  const bodyBring = grabBalanced(dMain, "function bringToFrontAndOpen(deep)");
  const bodyWinActive = grabBalanced(dMain, "function windowActive()");
  const collectCbSrc = grabHandler(dMain, 'ipcMain.on("notif-collect-reply"');
  const acceptCbSrc = grabHandler(dMain, 'ipcMain.on("bgnotify-rendered", (_e, info)');
  rec("R00 corpos REAIS extraídos do dist 1.0.230 (deliver/handoff/bring/windowActive/collect/aceite) + classify real",
    !!(bodyDeliver && bodyHandoff && bodyBring && bodyWinActive && collectCbSrc && acceptCbSrc && typeof slaRemMod.classifyReminderLevel === "function"),
    { d: !!bodyDeliver, h: !!bodyHandoff, b: !!bodyBring, w: !!bodyWinActive, c: !!collectCbSrc, a: !!acceptCbSrc, cls: typeof slaRemMod.classifyReminderLevel });

  const grouping = groupingMod.createNotificationGrouping({ onLog: (t, d) => logs.push([t, d]) });   // REAL (janela 5s)
  const slaEnqueues = [];
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
    nativeNotify: (p, key) => { nativeCalls.push(String(key || "")); return true; },
    notifTele: {}, groupTele: { updates: 0, opens: 0 }, app: { getVersion: () => "1.0.230" },
    electron_1: { app: { getVersion: () => "1.0.230" } },
    /* classificação REAL da 1.0.228 (não stub): wf_* deve retornar null e seguir p/ toast/premium.
     * O dist compilado referencia slaReminder_1.classifyReminderLevel — módulo REAL no contexto
     * (a produção o tem importado; sem ele o gate lançaria ReferenceError com ctl truthy). */
    slaReminder_1: slaRemMod,
    classifyReminderLevel: (p) => slaRemMod.classifyReminderLevel(p),
    slaReminderCtl: { enqueue: (p) => { slaEnqueues.push(p); return { ok: true, channel: "sla-central" }; }, status: () => ({ queueLen: slaEnqueues.length }) },
    slaReminderTele: {},
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
    "globalThis.__acceptCb = " + acceptCbSrc + ";\n",
    { filename: "dist-extract-red-f356a.js" }).runInContext(ctx);

  /* IPC — MESMOS canais/handlers de produção */
  ipcMain.on("notif-toast-ack", (_e, key) => { ctx.toastAck.ack(String(key || "")); });
  ipcMain.on("notif-collect-reply", (_e, reqId, keys) => ctx.__collectCb(_e, reqId, keys));
  ipcMain.on("bgnotify-rendered", (_e, info) => { try { renderedAcks.push(JSON.parse(JSON.stringify(info || {}))); } catch (_) {} ctx.__acceptCb(_e, info); });
  bgReal.initBgNotify((deep) => ctx.__bring(String(deep || "")));

  const win = new BrowserWindow({ width: 1200, height: 800, show: true, webPreferences: {
    preload: path.join(__dirname, "f356ah1-surface-preload.js"),
    contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  ctx.mainWin = win;
  const wc = win.webContents;
  wc.on("console-message", (_e, lvl, msg, ln, src) => { if (lvl >= 2) line({ console: String(msg).slice(0, 200), src: String(src || "").split("/").pop(), ln }); });
  win.on("blur", () => { try { vm.runInContext("handoffActiveToasts()", ctx); } catch (_) {} });   // wiring de produção (H4)
  const J = (code) => wc.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) }));
  const bgWinOf = () => BrowserWindow.getAllWindows().find((w) => { try { return !w.isDestroyed() && String(w.webContents.getURL()).includes("bgnotify.html"); } catch (_) { return false; } });
  const bgJ = async (code) => { const b = bgWinOf(); if (!b) return { none: true }; return b.webContents.executeJavaScript(code).catch((e) => ({ err: String((e && e.message) || e) })); };
  async function shot(nm, w) { try { await sleep(430); const img = await (w ? w.webContents : wc).capturePage(); fs.writeFileSync(path.join(OUT, nm + ".png"), img.toPNG()); return nm + ".png"; } catch (e) { return "shot_err:" + String((e && e.message) || e).slice(0, 80); } }
  const stackN = async () => { const r = await J(`(function(){ var s=document.getElementById('notif-stack'); return s?s.querySelectorAll('.ntf').length:0; })()`); return Number(r) || 0; };

  await win.loadURL("file://" + asarPath.replace(/\\/g, "/") + "/src/renderer/index.html");
  let boot = null;
  for (let i = 0; i < 30; i++) {
    boot = await J(`(function(){ var st=(typeof state!=='undefined')?state:null; return { user: !!(st&&st.user), tasks: ((st&&st.tasks)||[]).length, api: !!(window.desktopAPI&&window.desktopAPI.onNotifToast) }; })()`);
    if (boot && boot.user && boot.tasks === 2) break;
    await sleep(500);
  }
  rec("R01 renderer REAL do asar bootado (Social logada, 2 tarefas, canais de notificação vivos)",
    !!(boot && boot.user && boot.tasks === 2 && boot.api), boot);

  /* ── PRODUTOR REAL: workflowNotifier do dist, ingresso = deliverNotification REAL ── */
  const ingress = [];
  const cbs = {};
  const storeFile = path.join(os.tmpdir(), "f356ah1-cursor-" + Date.now() + ".json");
  const wn = WN.startWorkflowNotifier(ANA, (p) => {
    ingress.push({ eventType: String(p && p.eventType || ""), dedupKey: String(p && p.dedupKey || "") });
    return ctx.__deliver(p);
  }, {
    listen: (name, cb) => { cbs[name] = cb; return () => {}; },
    storeFile,
    authUser: () => ({ id: ANA, role: "Social Media", admin: false }),
    onLog: (t, d) => logs.push([t, d]),
  });
  const snap = (docs) => ({ docChanges: () => docs.map((d) => ({ type: "modified", doc: { id: d.id, data: () => { const c = { ...d }; delete c.id; return c; } } })) });
  cbs["usersPublic"] && cbs["usersPublic"]({ docChanges: () => [{ type: "added", doc: { id: ANA, data: () => ({ name: "Ana Beatriz Social Media", photo: "" }) } }] });

  /* outra janela p/ tirar o foco do Agenda (estado físico: owner no navegador/portal) */
  const other = new BrowserWindow({ width: 700, height: 500, show: true });
  await other.loadURL("data:text/html,<title>NavegadorPortal</title><textarea autofocus style='width:90%25;height:80%25'></textarea>");

  /* S0 — boot: snapshot com as tarefas AGUARDANDO CLIENTE (eventos da própria Social) */
  win.focus(); await sleep(400);
  cbs["tasks"](snap([DOCS.s1.boot, DOCS.s2.boot]));
  await sleep(600);
  rec("S0 boot: THEMES_READY/APPROVAL_REQUESTED da própria Social NÃO notificam (zero ingresso)",
    ingress.length === 0 && (await stackN()) === 0, { ingresso: ingress.length });

  /* S1 — DESFOCADO (cenário físico) + cliente VISUALIZA os temas */
  other.focus(); await sleep(1200);
  const focusState1 = { agendaFocused: win.isFocused(), otherFocused: other.isFocused() };
  cbs["tasks"](snap([DOCS.s1.afterView, DOCS.s2.boot]));
  await sleep(1400);
  const bg1 = bgWinOf();
  const bgDom1 = await bgJ(`(function(){ var n=document.querySelectorAll('.ntf').length; return { n:n, txt:(document.body.textContent||'').replace(/\\s+/g,' ').slice(0,300) }; })()`);
  const ack1 = renderedAcks.filter((a) => String(a.dedupKey || "") === "wf:task-cron-fisico:ev_view_ar_themes_r1");
  rec("S1 desfocado: cliente VISUALIZOU → 1 ingresso info + CARD REAL na janela premium (sem som)",
    ingress.length === 1 && ingress[0].eventType === "wf_client_themes_first_viewed"
    && !!bg1 && bg1.isVisible() && bgDom1.n === 1 && ack1.length === 1 && ack1[0].sound === "suppressed_by_payload",
    { foco: focusState1, ingresso: ingress, bg: bgDom1, ack: ack1[0] || null, shot: await shot("s1-premium-visualizou", bg1) });

  /* S2 — DESFOCADO + cliente APROVA (o instante exato da falha física) */
  cbs["tasks"](snap([DOCS.s1.afterDec, DOCS.s2.boot]));
  await sleep(1500);
  const bg2 = bgWinOf();
  const bgDom2 = await bgJ(`(function(){ var n=document.querySelectorAll('.ntf').length; var t=(document.body.textContent||'').replace(/\\s+/g,' '); return { n:n, aprovado:t.indexOf('Temas aprovados')>=0, atribuir:/atribuir aos Designers/i.test(t), tarefa:t.indexOf('Cronograma teste')>=0, cliente:t.indexOf('Cliente Físico LTDA')>=0, txt:t.slice(0,400) }; })()`);
  const ack2 = renderedAcks.filter((a) => String(a.dedupKey || "") === "wf:task-cron-fisico:ev_dec_ar_themes_r1");
  const wfDecIngress = ingress.filter((i) => i.eventType === "wf_client_themes_approved");
  rec("S2 [PROVA-CHAVE] desfocado: cliente APROVOU → 1 ingresso + CARD REAL 'Temas aprovados' na premium + ACK de render + som de política (success, NÃO suprimido)",
    wfDecIngress.length === 1 && ingress.length === 2
    && !!bg2 && bg2.isVisible() && bgDom2.aprovado === true && bgDom2.atribuir === true && bgDom2.tarefa === true && bgDom2.cliente === true
    && ack2.length === 1 && ack2[0].severity === "success" && ack2[0].sound !== "suppressed_by_payload" && ack2[0].sound !== "duplicate_prevented",
    { ingresso: ingress, bg: bgDom2, ack: ack2[0] || null, shot: await shot("s2-premium-temas-aprovados", bg2) });

  /* S3 — re-snapshot ×2 (listener re-emite) ⇒ zero duplicação nas DUAS camadas */
  cbs["tasks"](snap([DOCS.s1.afterDec, DOCS.s2.boot]));
  await sleep(500);
  cbs["tasks"](snap([DOCS.s1.afterDec, DOCS.s2.boot]));
  await sleep(800);
  const bgDom3 = await bgJ(`document.querySelectorAll('.ntf').length`);
  rec("S3 zero duplicação: re-snapshots não geram novo ingresso nem novo card (recibo + dedupe)",
    ingress.filter((i) => i.eventType === "wf_client_themes_approved").length === 1
    && renderedAcks.filter((a) => String(a.dedupKey || "") === "wf:task-cron-fisico:ev_dec_ar_themes_r1").length === 1
    && Number(bgDom3) <= 2,
    { ingresso: ingress.length, acks: renderedAcks.length, bgCards: Number(bgDom3) });

  /* S4 — FOCADO: segunda tarefa aprovada → TOAST REAL no renderer do asar (sem fallback) */
  win.focus(); await sleep(800);
  const nativeBefore4 = nativeCalls.length;
  cbs["tasks"](snap([DOCS.s1.afterDec, DOCS.s2.afterDec]));
  await sleep(1200);
  const toast4 = await J(`(function(){ var s=document.getElementById('notif-stack'); if(!s) return { n:0 }; var t=(s.textContent||'').replace(/\\s+/g,' '); return { n:s.querySelectorAll('.ntf').length, aprovado:t.indexOf('Temas aprovados')>=0, tarefa2:t.indexOf('Cronograma teste 2')>=0, txt:t.slice(0,300) }; })()`);
  const diag4 = await J(`(function(){ return (window.__DIAG||[]).filter(function(d){ return d.ev==='notification.sound.playback'&&String((d.p||{}).eventType||'')==='wf_client_themes_approved'; }).length; })()`);
  await sleep(3600);   // janela do watchdog toastAck (4s) — fallback NÃO pode disparar
  const s2ViewIngress = ingress.filter((i) => i.eventType === "wf_client_themes_first_viewed").length;
  rec("S4 focado: aprovação da 2ª tarefa → TOAST REAL no renderer ('Temas aprovados' + tarefa), som 1× no toast, SEM fallback pós-watchdog",
    ingress.filter((i) => i.eventType === "wf_client_themes_approved").length === 2
    && toast4.n >= 1 && toast4.aprovado === true && toast4.tarefa2 === true && Number(diag4) === 1
    && nativeCalls.length === nativeBefore4
    && renderedAcks.filter((a) => String(a.dedupKey || "") === "wf:task-cron-fisico:ev_dec_ar_themes_r1" && a.eventType === "wf_client_themes_approved").length === 1,
    { toast: toast4, somToast: Number(diag4), viewIngressos: s2ViewIngress, shot: await shot("s4-toast-focado-aprovado") });

  /* S5 — a NATIVA nunca foi necessária (premium/toast provaram render em todos os cenários) */
  rec("S5 nativa 0× (toda entrega provou render na premium ou no toast)", nativeCalls.length === 0, { nativeCalls });

  /* encerramento */
  try { wn.stop(); } catch (_) {}
  try { fs.rmSync(storeFile, { force: true }); } catch (_) {}
  clearTimeout(WATCHDOG);
  const failures = results.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, "f356ah1-surface-results.json"), JSON.stringify({ results, ingress, renderedAcks, nativeCalls, slaEnqueues: slaEnqueues.length, logs: logs.slice(-200) }, null, 2));
  process.stdout.write("PROOF_DONE proofs=" + results.length + " failures=" + failures + "\n");
  app.exit(failures ? 1 : 0);
});
