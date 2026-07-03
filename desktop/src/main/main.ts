/**
 * Agenda ID Seven Desktop — Main process
 * - Janela com renderer de paridade APK (UI igual a Web Preview 1.0.65)
 * - Fechar = esconde na Tray (nao encerra); "Sair" so pelo menu da Tray
 * - Autostart Windows opcional (sobe oculto na tray no login)
 * - Notifier + Reminder rodam aqui (sobrevivem a janela escondida)
 */
import { app, BrowserWindow, Tray, ipcMain, Notification, shell, clipboard, nativeImage, dialog } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { createTray } from "./tray";
import { isAutoStart, setAutoStart } from "./autostart";
import { startNotifier } from "./notifier";
import { diag, diagPath } from "./diag"; // F3.3.10-DIAG (logger local; build instrumentada)
import { startReminder } from "./reminder";
import { initBgNotify, showBgNotify, stopBgNotify } from "./bgNotify"; // F3.3.10-BG (janela premium própria)
import { registerAuthIpc } from "./auth"; // F3.3.56-G2 — auth server-side (token confinado ao main)

let mainWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let stopNotifier: (() => void) | null = null;
let stopReminder: (() => void) | null = null;
let quitting = false;

// AUMID p/ toasts no Windows respeitarem o app
if (process.platform === "win32") app.setAppUserModelId("br.com.idseven.agenda.desktop");

// ===================================================================
// F3.3.3 — HUB de NOTIFICAÇÕES DESKTOP (local, sem provider externo).
// Canal único: se a janela está FOCADA/visível -> TOAST in-app premium
// (renderer); senão (minimizado/tray/sem foco) -> Notification NATIVA do
// SO. Dedup por dedupKey. Som por severidade só no toast (a nativa usa o
// som padrão do SO; limitação documentada). NUNCA chama FCM/Web Push/
// WhatsApp/Firestore — só Electron Notification local.
// ===================================================================
type NotifPayload = {
  eventId?: string; eventType?: string; taskId?: string; taskTitle?: string; clientName?: string;
  actorId?: string; actorName?: string; actorAvatar?: string;
  responsibleId?: string; responsibleName?: string; responsibleAvatar?: string;
  targetUserId?: string; notificationType?: string; etapa?: string; status?: string;
  title?: string; body?: string; context?: string; createdAt?: number;
  severity?: "info" | "success" | "warning" | "critical"; sound?: boolean;
  action?: { type?: string; deep?: string }; dedupKey?: string; source?: string; providerCalled?: boolean;
};
const _notifSeen = new Set<string>();
function _appIcon(): string | undefined {
  try { return path.join(app.getAppPath(), "build", "icon.png"); } catch { return undefined; }
}
function windowActive(): boolean {
  // REGRA DE CANAL (correção de regressão): janela ABERTA e VISÍVEL ⇒ TOAST premium in-app —
  // mesmo SEM foco (usuário pode estar olhando o app atrás de outra janela). Só cai p/ a nativa
  // do SO quando minimizada/bandeja/oculta (isVisible()=false). NÃO exigir isFocused() — exigir
  // foco fazia "aberto sem foco" virar nativo genérico (a regressão reportada).
  const w = mainWin;
  return !!(w && !w.isDestroyed() && w.isVisible() && !w.isMinimized());
}
function deliverNotification(p: NotifPayload): { ok: boolean; channel: string } {
  try {
    if (!p || typeof p !== "object") return { ok: false, channel: "none" };
    const key = String(p.dedupKey || `${p.eventType || "evt"}:${p.taskId || ""}:${p.createdAt || ""}`);
    if (_notifSeen.has(key)) { diag("deliver.dedup", { key }); return { ok: true, channel: "dedup" }; }
    _notifSeen.add(key);
    diag("deliver.begin", { eventType: p.eventType, taskId: p.taskId, targetUserId: p.targetUserId, actorId: p.actorId, responsibleId: p.responsibleId, dedupKey: key, windowActive: windowActive(), visible: !!(mainWin && !mainWin.isDestroyed() && mainWin.isVisible()), minimized: !!(mainWin && !mainWin.isDestroyed() && mainWin.isMinimized()) });
    if (_notifSeen.size > 4000) { const it = _notifSeen.values(); for (let i = 0; i < 1000; i++) { const v = it.next(); if (v.done) break; _notifSeen.delete(v.value); } }
    // F3.3.10 — CAPTURA p/ a Central (histórico local no renderer). CAPTURE-ONLY: encaminha o MESMO
    // payload já deduplicado, sem alterar roteamento/toast/nativa/dedup/som/severidade/destino. Nunca
    // pode impedir a entrega — por isso vem em try/catch isolado e ANTES da decisão toast×nativa.
    try { mainWin?.webContents.send("notif-history", p); } catch { /* captura nunca afeta a notificação real */ }
    const deep = (p.action && p.action.deep) ? String(p.action.deep) : "";
    if (windowActive()) {
      mainWin?.webContents.send("notif-toast", p);
      diag("deliver.toast", { dedupKey: key, taskId: p.taskId });
      return { ok: true, channel: "toast" };
    }
    // BACKGROUND (minimizado/oculto/bandeja) — F3.3.10-BG: a entrega visual CONFIÁVEL é a janela
    // PREMIUM própria do app (controlada pelo main, aparece mesmo com a mainWindow hidden e NÃO
    // depende da Notification nativa do Windows). A nativa do SO vira FALLBACK só se a janela
    // premium não puder ser exibida. Clique → reabre a mainWindow e navega (deep link). A captura
    // p/ a Central já foi feita acima (notif-history), independente do canal.
    const bgOk = showBgNotify(p);
    let nativeOk = false;
    if (!bgOk) {
      try {
        const n = new Notification({
          title: String(p.title || "Agenda ID Seven"),
          body: String(p.body || ""),
          silent: p.sound === false,
          icon: _appIcon(),
        });
        n.on("click", () => {
          diag("native.click", { dedupKey: key, deep });
          const w = mainWin;
          if (w) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); if (deep) w.webContents.send("notif-open", deep); }
        });
        n.show();
        nativeOk = true;
      } catch (e2) { diag("native.fallback.error", { err: String(((e2 as any) && (e2 as any).message) || e2) }); }
    }
    const channel = bgOk ? "bg-window" : (nativeOk ? "native" : "none");
    diag("deliver.bg", { dedupKey: key, deep, taskId: p.taskId, title: String(p.title || ""), channel, fallbackNative: !bgOk });
    return { ok: bgOk || nativeOk, channel };
  } catch (e) { diag("deliver.error", { err: String(((e as any) && (e as any).message) || e) }); return { ok: false, channel: "error" }; }
}

// F3.3.10-DIAG SELFTEST — GATED por IDSEVEN_SELFTEST=1 (NUNCA setado em produção → zero efeito).
// Prova, em Windows REAL (runner de CI), o CANAL do deliverNotification nos 3 estados, SEM
// Firestore/rede/write (payload sintético): visível→toast, minimizado→NATIVA, oculto/bandeja→NATIVA.
// Também loga Notification.isSupported(). O app se encerra sozinho ao fim. Removível (sentinela DIAG).
function runNotifSelfTest() {
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const synth = (n: number, state: string) => ({
    eventType: "selftest", source: "selftest", providerCalled: false,
    taskId: "ST" + n, taskTitle: "Selftest " + n, title: "Selftest " + n,
    body: "estado: " + state, severity: "info" as const, sound: false,
    action: { type: "board", deep: "board/" }, dedupKey: "selftest:" + n,
    targetUserId: "selftest", createdAt: Date.now(),
  });
  // failsafe: encerra o processo mesmo se algo travar (CI não pode pendurar)
  const hardExit = setTimeout(() => { try { quitting = true; app.exit(0); } catch { /* */ } }, 30000);
  (async () => {
    let stopST: (() => void) | null = null;
    try {
      diag("selftest.begin", { notificationSupported: Notification.isSupported(), platform: process.platform, aumidWin: process.platform === "win32" });
      // Liga o notifier REAL (read-only) p/ PROVAR que o listener Firestore do MAIN conecta e
      // recebe snapshot em Windows (transporte long-polling). uid sintético → não entrega nada
      // (nenhum doc casa), só comprova firestore.listen.attach + firestore.snapshot no main.
      try { stopST = startNotifier(() => mainWin, "selftest-uid", deliverNotification); diag("selftest.notifier.started", {}); }
      catch (e2) { diag("selftest.notifier.error", { err: String(((e2 as any) && (e2 as any).message) || e2) }); }
      const w = mainWin;
      if (w && !w.isDestroyed()) { w.show(); w.focus(); }
      await wait(2000);
      diag("selftest.state", { phase: "visible", windowActive: windowActive() });
      diag("selftest.deliver", { n: 1, expect: "toast", channel: deliverNotification(synth(1, "visible")).channel });
      await wait(2500);
      if (w && !w.isDestroyed()) w.minimize();
      await wait(2000);
      diag("selftest.state", { phase: "minimized", windowActive: windowActive() });
      diag("selftest.deliver", { n: 2, expect: "native", channel: deliverNotification(synth(2, "minimized")).channel });
      await wait(3000);
      if (w && !w.isDestroyed()) w.hide();
      await wait(2000);
      diag("selftest.state", { phase: "hidden(tray)", windowActive: windowActive() });
      diag("selftest.deliver", { n: 3, expect: "native", channel: deliverNotification(synth(3, "hidden")).channel });
      await wait(3000);
      diag("selftest.end", { ok: true });
    } catch (e) {
      diag("selftest.error", { err: String(((e as any) && (e as any).message) || e) });
    } finally {
      try { if (stopST) stopST(); } catch { /* */ }
      clearTimeout(hardExit);
      quitting = true;
      setTimeout(() => { try { app.exit(0); } catch { /* */ } }, 1200);
    }
  })();
}

// Locale pt-BR: faz os inputs nativos date/time exibirem dd/mm/aaaa e HH:mm.
app.commandLine.appendSwitch("lang", "pt-BR");
// F3.3.10-FIX (minimizado/bandeja) — mantém o renderer e seus timers (scan de SLA, boundary timer)
// rodando em velocidade normal quando a janela está minimizada/oculta/ocluída na bandeja. Sem isso,
// o Chromium "backgrounda" o renderer e laranja/vermelho/crítico podem atrasar/não disparar a NATIVA.
// (Complementa backgroundThrottling:false da janela — sozinho às vezes não basta.) Não altera
// roteamento/dedup/severidade/som; só garante que o tempo seja respeitado em background.
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

// Deep link idseven:// -> abre a tela "Visão do cliente" no Desktop.
// Registra o app como handler do esquema (sem backend). Em dev usa argv.
try {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("idseven", process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient("idseven");
  }
} catch { /* nao bloquear o boot por causa do registro de protocolo */ }

// Extrai "client/<id>" (ou outro alvo) de um idseven://<alvo> presente no argv/url.
function deepLinkTarget(list: string[]): string | null {
  const hit = list.find((a) => typeof a === "string" && a.indexOf("idseven://") === 0);
  if (!hit) return null;
  return hit.replace(/^idseven:\/\//, "").replace(/\/+$/, "");
}
function routeDeepLink(target: string | null) {
  if (!target || !mainWin) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  mainWin.webContents.send("notif-open", target);
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
    routeDeepLink(deepLinkTarget(argv));
  });
}

// macOS: deep link chega por open-url.
app.on("open-url", (_e, url) => { routeDeepLink(deepLinkTarget([url])); });

function createWindow() {
  const startHidden = process.argv.includes("--hidden");
  mainWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: !startHidden,
    backgroundColor: "#0A0B10",
    title: "Agenda ID Seven Desktop",
    icon: path.join(app.getAppPath(), "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  mainWin.removeMenu();
  mainWin.loadFile(path.join(app.getAppPath(), "src", "renderer", "index.html"));
  // Garante nitidez 1:1 (sem zoom acidental). Windows respeita HiDPI nativamente.
  mainWin.webContents.on("did-finish-load", () => {
    mainWin?.webContents.setZoomFactor(1.0);
    mainWin?.webContents.setVisualZoomLevelLimits(1, 1);
  });

  // Fechar = esconde na tray (nao encerra). Quit real so pelo menu da tray.
  mainWin.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWin?.hide();
      diag("window.close→hide(tray)", { quitting }); // F3.3.10-DIAG: prova que X vai p/ bandeja (não quit)
    } else {
      diag("window.close→quit", { quitting });
    }
  });
  // F3.3.10-DIAG — lifecycle (só log; não altera comportamento)
  mainWin.on("minimize", () => diag("window.minimize"));
  mainWin.on("restore", () => diag("window.restore"));
  mainWin.on("show", () => diag("window.show"));
  mainWin.on("hide", () => diag("window.hide(tray)"));
}

function realQuit() {
  quitting = true;
  if (stopNotifier) stopNotifier();
  if (stopReminder) stopReminder();
  try { stopBgNotify(); } catch { /* */ }
  app.quit();
}

app.whenReady().then(() => {
  diag("app.ready", { diagPath: diagPath() }); // F3.3.10-DIAG: caminho do log impresso no próprio log
  createWindow();
  tray = createTray(
    () => mainWin,
    { isAutoStart, setAutoStart, quit: realQuit }
  );

  // F3.3.10-BG — registra a janela premium de background + callback de "Abrir tarefa"
  // (reabre a mainWindow minimizada/oculta e navega via deep link). NÃO rouba foco do SO.
  initBgNotify((deep: string) => {
    const w = mainWin;
    if (w && !w.isDestroyed()) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); if (deep) w.webContents.send("notif-open", deep); }
  });

  // IPC do renderer
  registerAuthIpc(); // F3.3.56-G2 — auth-login/auth-self/auth-change-password/auth-logout/auth-session-status
  ipcMain.handle("notif-test", () => {
    new Notification({ title: "Agenda ID Seven", body: "Notificacao de teste OK." }).show();
    diag("notif-test.shown");
    return true;
  });
  // F3.3.10-DIAG — renderer envia eventos p/ o MESMO arquivo de log local (scan/Central/visibility).
  ipcMain.on("diag-log", (_e, tag: string, data?: unknown) => { try { diag("renderer." + String(tag), data); } catch { /* */ } });
  ipcMain.handle("diag-path", () => diagPath());
  // F3.3.3 — renderer pede notificação (fluxo/SLA/bloqueio detectados no renderer).
  // O HUB decide o canal (toast in-app x nativa) e faz dedup. Sem provider externo.
  ipcMain.handle("notify", (_e, payload: NotifPayload) => deliverNotification(payload));
  ipcMain.handle("autostart-get", () => isAutoStart());
  ipcMain.handle("autostart-set", (_e, v: boolean) => { setAutoStart(v); return isAutoStart(); });
  ipcMain.handle("app-quit", () => { realQuit(); });

  // Abrir URL no app externo (WhatsApp Desktop via whatsapp://, ou browser no
  // fallback web). Retorna false se o SO nao conseguiu abrir -> renderer cai
  // para o fallback web. Evita abrir a landing intermediaria dentro do app.
  ipcMain.handle("open-external", async (_e, url: string) => {
    try { await shell.openExternal(String(url)); return true; }
    catch { return false; }
  });

  // ===== 1.0.114 — ENVIO PREMIUM (imagem real do card p/ WhatsApp) =====
  // Salva os bytes do card (JPG) em disco e devolve o caminho. Pasta padrão: Downloads.
  ipcMain.handle("save-card-image", (_e, payload: { bytes: ArrayBuffer | Uint8Array; filename: string }) => {
    try {
      const dir = app.getPath("downloads") || os.tmpdir();
      const safe = String(payload?.filename || "agenda-id-seven-card.jpg").replace(/[^A-Za-z0-9._-]/g, "_");
      const dest = path.join(dir, safe);
      fs.writeFileSync(dest, Buffer.from(payload.bytes as any));
      return { ok: true, path: dest };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });
  // Copia a IMAGEM do card para a área de transferência (usuário cola direto no WhatsApp).
  ipcMain.handle("copy-card-image", (_e, bytes: ArrayBuffer | Uint8Array) => {
    try {
      const img = nativeImage.createFromBuffer(Buffer.from(bytes as any));
      if (img.isEmpty()) return { ok: false, error: "imagem vazia" };
      clipboard.writeImage(img);
      return { ok: true };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });
  // Revela o arquivo salvo no explorador de arquivos.
  ipcMain.handle("show-in-folder", (_e, p: string) => {
    try { shell.showItemInFolder(String(p)); return true; } catch { return false; }
  });
  // Diálogo "Salvar como…" (opcional) — devolve caminho escolhido + grava.
  ipcMain.handle("save-card-image-as", async (_e, payload: { bytes: ArrayBuffer | Uint8Array; filename: string }) => {
    try {
      const safe = String(payload?.filename || "agenda-id-seven-card.jpg").replace(/[^A-Za-z0-9._-]/g, "_");
      const r = await dialog.showSaveDialog({ defaultPath: safe, filters: [{ name: "Imagem", extensions: ["jpg", "jpeg", "png"] }] });
      if (r.canceled || !r.filePath) return { ok: false, canceled: true };
      fs.writeFileSync(r.filePath, Buffer.from(payload.bytes as any));
      return { ok: true, path: r.filePath };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });

  // Deep link no cold start (app aberto pelo proprio idseven://...).
  const coldTarget = deepLinkTarget(process.argv);
  if (coldTarget && mainWin) {
    mainWin.webContents.once("did-finish-load", () => {
      setTimeout(() => mainWin?.webContents.send("notif-open", coldTarget), 600);
    });
  }

  // Renderer avisa o uid logado -> ligamos os listeners de notificacao
  ipcMain.on("session-login", (_e, uid: string) => {
    diag("session-login", { uid }); // F3.3.10-DIAG
    if (stopNotifier) stopNotifier();
    if (stopReminder) stopReminder();
    if (uid) {
      // F3.3.3 — notifier/reminder roteiam pelo HUB (ganham toast in-app quando focado,
      // mantêm a nativa quando minimizado/tray). Mesmos eventos/dedup de antes.
      stopNotifier = startNotifier(() => mainWin, uid, deliverNotification);
      stopReminder = startReminder(() => mainWin, uid, deliverNotification);
    }
  });
  ipcMain.on("session-logout", () => {
    diag("session-logout"); // F3.3.10-DIAG
    if (stopNotifier) { stopNotifier(); stopNotifier = null; }
    if (stopReminder) { stopReminder(); stopReminder = null; }
  });

  // F3.3.10-DIAG — HEARTBEAT do MAIN: prova que o processo principal (e o notifier) seguem VIVOS
  // com a janela minimizada/oculta/bandeja. Se após uma atribuição em background não houver
  // firestore.snapshot mas houver main.alive, isola "listener silencioso" de "processo morto".
  // Só log local (sem rede/Firestore/efeito). Removível com as sentinelas F3.3.10-DIAG.
  setInterval(() => {
    try {
      const w = mainWin;
      diag("main.alive", {
        notifier: !!stopNotifier, reminder: !!stopReminder,
        visible: !!(w && !w.isDestroyed() && w.isVisible()),
        minimized: !!(w && !w.isDestroyed() && w.isMinimized()),
      });
    } catch { /* heartbeat de diagnóstico nunca pode quebrar o app */ }
  }, 30000);

  // F3.3.10-DIAG SELFTEST — só roda sob IDSEVEN_SELFTEST=1 (prova de canal em Windows REAL no CI).
  if (process.env.IDSEVEN_SELFTEST === "1") { try { runNotifSelfTest(); } catch { /* */ } }
});

// Nao encerrar quando todas as janelas fecharem (vivemos na tray).
app.on("window-all-closed", (e: any) => { if (!quitting) e.preventDefault?.(); });
app.on("before-quit", () => { quitting = true; });
