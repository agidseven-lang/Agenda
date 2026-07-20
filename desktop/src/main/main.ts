/**
 * Agenda ID Seven Desktop — Main process
 * - Janela com renderer de paridade APK (UI igual a Web Preview 1.0.65)
 * - Fechar = esconde na Tray (nao encerra); "Sair" so pelo menu da Tray
 * - Autostart Windows opcional (sobe oculto na tray no login)
 * - Notifier + Reminder rodam aqui (sobrevivem a janela escondida)
 */
import { app, BrowserWindow, ipcMain, Notification, shell, clipboard, nativeImage, dialog, powerMonitor } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { ensureTray, recreateTray, getTrayState, destroyTray } from "./tray";
import { isAutoStart, setAutoStart } from "./autostart";
import { startNotifier } from "./notifier";
import { diag, diagPath } from "./diag"; // F3.3.10-DIAG (logger local; build instrumentada)
import { startReminder } from "./reminder";
import { initBgNotify, showBgNotify, stopBgNotify } from "./bgNotify"; // F3.3.10-BG (janela premium própria)
import { registerAuthIpc } from "./auth"; // F3.3.56-G2 — auth server-side (token confinado ao main)
import { registerPrewarmIpc } from "./prewarm"; // F3.3.73I6C18C — prewarm do Card Premium (IPC restrito ao /share)
import { createClockSync } from "./clockSync"; // F3.3.77A-R4B — relógio canônico via cabeçalho HTTP Date (Cloud Run read-only)
// UPDATER:BEGIN (F3.4.1A — atualizador nativo, processo main)
import { createUpdaterService } from "./updaterService";
// UPDATER:END
// PRESENCE:BEGIN (F3.4.2A — sonda MÍNIMA de /auth + cliente WebSocket de presença do Worker canário)
import { createPresenceProbe } from "./presenceAuthProbe";
import { createPresenceClient } from "./presenceClient";
// PRESENCE:END

let mainWin: BrowserWindow | null = null;
let stopNotifier: (() => void) | null = null;
let stopReminder: (() => void) | null = null;
let clockSync: ReturnType<typeof createClockSync> | null = null; // F3.3.77A-R4B — relógio canônico (main)
let quitting = false;
// F3.3.70D3R10U — opts do tray centralizados (usados por startup, session-login,
// heartbeat e IPC tray-recreate; a recriacao usa SEMPRE o mesmo menu/quit).
const trayWin = () => mainWin;
const trayOpts = { isAutoStart, setAutoStart, quit: realQuit };
// PRESENCE:BEGIN (F3.4.2A — instância da sonda de /auth + cliente WS; criadas no ready com userData real)
let presenceProbe: ReturnType<typeof createPresenceProbe> | null = null;
let presenceClient: ReturnType<typeof createPresenceClient> | null = null;
// F3.4.2A Stage-2A-X — KEEP-ALIVE da presença: enquanto a INTENÇÃO for "conectado" (login→logout/Sair/
// quit/update), seguramos powerSaveBlocker('prevent-app-suspension') para o processo (WebSocket+heartbeat
// no main) NÃO ser suspenso pelo SO quando a janela é fechada no X (bandeja). Assim o Durable Object, que
// remove o usuário no fechamento do socket, mantém o usuário on-line. Idempotente; require lazy (não muda
// o import de topo). Liberado só na transição de intenção true->false (onIdle).
let presencePsbId = -1;
function presenceKeepAliveOn(): void {
  try {
    const psb = require("electron").powerSaveBlocker;
    if (presencePsbId < 0 || !psb.isStarted(presencePsbId)) { presencePsbId = psb.start("prevent-app-suspension"); diag("presence.keepalive.on", { id: presencePsbId }); }
  } catch { /* keep-alive é best-effort; nunca quebra a presença */ }
}
function presenceKeepAliveOff(): void {
  try {
    const psb = require("electron").powerSaveBlocker;
    if (presencePsbId >= 0 && psb.isStarted(presencePsbId)) psb.stop(presencePsbId);
    diag("presence.keepalive.off", { id: presencePsbId });
  } catch { /* */ }
  presencePsbId = -1;
}
// PRESENCE:END
// UPDATER:BEGIN (F3.4.1A — instância do atualizador + teardown seguro para quitAndInstall)
let updater: ReturnType<typeof createUpdaterService> | null = null;
function updaterTeardownForInstall() {
  // Mesmo teardown do realQuit, porém SEM app.quit() (o quitAndInstall encerra e reabre).
  quitting = true;
  try { if (stopNotifier) stopNotifier(); } catch { /* */ }
  try { if (stopReminder) stopReminder(); } catch { /* */ }
  try { if (clockSync) { clockSync.stop(); clockSync = null; } } catch { /* */ }
  try { stopBgNotify(); } catch { /* */ }
  try { if (presenceClient) presenceClient.disconnect(); } catch { /* Stage-2A: encerra WS de presença antes de instalar */ }
  try { destroyTray(); } catch { /* */ }
  diag("updater.teardownForInstall");
}
// UPDATER:END

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
  // PRESENCE:BEGIN (F3.4.2A Stage-2A-X — reabrir da bandeja reconecta a presença SE tiver caído.
  // Idempotente: connect() é no-op se já conectado/conectando (reutiliza a MESMA conexão; sem 2ª sessão,
  // sem nova transição 0->1). Fechar no X só ESCONDE (acima); NUNCA chama disconnect.)
  mainWin.on("show", () => { if (presenceClient) { try { presenceClient.connect(); } catch { /* presença nunca quebra a UI */ } } });
  // PRESENCE:END
}

function realQuit() {
  quitting = true;
  if (stopNotifier) stopNotifier();
  if (stopReminder) stopReminder();
  if (clockSync) { try { clockSync.stop(); } catch { /* */ } clockSync = null; }
  try { stopBgNotify(); } catch { /* */ }
  // PRESENCE:BEGIN (F3.4.2A Stage-2A — "Sair" (tray) encerra a conexão WebSocket de presença)
  try { if (presenceClient) presenceClient.disconnect(); } catch { /* */ }
  // PRESENCE:END
  // F3.3.73I6C11 — "Sair do aplicativo" remove o icone da bandeja (evita tray-fantasma no Windows).
  try { destroyTray(); } catch { /* */ }
  diag("app.realQuit→destroyTray"); // F3.3.10-DIAG
  app.quit();
}

app.whenReady().then(() => {
  diag("app.ready", { diagPath: diagPath() }); // F3.3.10-DIAG: caminho do log impresso no próprio log
  createWindow();
  // F3.3.70D3R10U — tray via ensureTray (cria no startup; recriavel depois sem duplicar)
  ensureTray(trayWin, trayOpts);

  // F3.3.77A-R4B — RETOMADA/DESBLOQUEIO: ao voltar do sleep ou desbloquear a tela, ressincroniza o
  // relógio canônico (offset antigo pode estar defasado) e o renderer rearma as timelines de SLA.
  try {
    powerMonitor.on("resume", () => { diag("power.resume"); if (clockSync) void clockSync.requestSync("resume"); });
    powerMonitor.on("unlock-screen", () => { diag("power.unlock"); if (clockSync) void clockSync.requestSync("unlock"); });
  } catch { /* powerMonitor pode não existir em todas as plataformas */ }
  // UPDATER:BEGIN (F3.4.1A — ao retomar/desbloquear, reverifica atualização SE a verificação venceu)
  try {
    powerMonitor.on("resume", () => { if (updater) updater.maybeCheckOnResume(); });
    powerMonitor.on("unlock-screen", () => { if (updater) updater.maybeCheckOnResume(); });
  } catch { /* */ }
  // UPDATER:END
  // PRESENCE:BEGIN (F3.4.2A Stage-2A — ao retomar/desbloquear, reconecta o WebSocket de presença se caiu;
  // connect() é idempotente: no-op se já conectado. Sem tempestade — backoff próprio do cliente.)
  try {
    powerMonitor.on("resume", () => { if (presenceClient) { try { presenceClient.connect(); } catch { /* */ } } });
    powerMonitor.on("unlock-screen", () => { if (presenceClient) { try { presenceClient.connect(); } catch { /* */ } } });
  } catch { /* */ }
  // PRESENCE:END

  // F3.3.10-BG — registra a janela premium de background + callback de "Abrir tarefa"
  // (reabre a mainWindow minimizada/oculta e navega via deep link). NÃO rouba foco do SO.
  initBgNotify((deep: string) => {
    const w = mainWin;
    if (w && !w.isDestroyed()) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); if (deep) w.webContents.send("notif-open", deep); }
  });

  // IPC do renderer
  registerAuthIpc(); // F3.3.56-G2 — auth-login/auth-self/auth-change-password/auth-logout/auth-session-status
  registerPrewarmIpc(); // F3.3.73I6C18C — card-prewarm (GET read-only restrito ao /share; token redigido nos logs)
  ipcMain.handle("notif-test", () => {
    new Notification({ title: "Agenda ID Seven", body: "Notificacao de teste OK." }).show();
    diag("notif-test.shown");
    return true;
  });
  // F3.3.10-DIAG — renderer envia eventos p/ o MESMO arquivo de log local (scan/Central/visibility).
  ipcMain.on("diag-log", (_e, tag: string, data?: unknown) => { try { diag("renderer." + String(tag), data); } catch { /* */ } });
  ipcMain.handle("diag-path", () => diagPath());
  // F3.3.70D3R10I — fonte unica da versao p/ o renderer (Config mostra a versao real do build)
  ipcMain.on("app-version", (e) => { try { e.returnValue = app.getVersion(); } catch { e.returnValue = "dev"; } });
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
  // Copia a IMAGEM do card para a área de transferência (ferramenta opcional).
  // F3.3.70D3R10Z — READ-BACK: após o write, confere se o clipboard REALMENTE retém a
  // imagem; sem isso o SO pode recusar silenciosamente e o app mentiria "ok".
  ipcMain.handle("copy-card-image", (_e, bytes: ArrayBuffer | Uint8Array) => {
    try {
      const img = nativeImage.createFromBuffer(Buffer.from(bytes as any));
      if (img.isEmpty()) return { ok: false, error: "imagem vazia" };
      clipboard.writeImage(img);
      const back = clipboard.readImage();
      if (!back || back.isEmpty()) return { ok: false, error: "clipboard nao reteve a imagem" };
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
  // F3.3.70D3R10U — "Abrir imagem": grava o card em Downloads e abre no visualizador
  // padrao do SO (shell.openPath). Auto-contido: NAO abre caminho arbitrario do renderer.
  ipcMain.handle("open-card-image", async (_e, payload: { bytes: ArrayBuffer | Uint8Array; filename: string }) => {
    try {
      const dir = app.getPath("downloads") || os.tmpdir();
      const safe = String(payload?.filename || "agenda-id-seven-card.jpg").replace(/[^A-Za-z0-9._-]/g, "_");
      const dest = path.join(dir, safe);
      fs.writeFileSync(dest, Buffer.from(payload.bytes as any));
      const err = await shell.openPath(dest);
      if (err) return { ok: false, path: dest, error: String(err) };
      return { ok: true, path: dest };
    } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
  });

  // F3.3.70D3R10U — TRAY: status p/ Configuracoes (sincrono, payload minusculo) e
  // recriacao forcada pelo botao "Recriar icone da bandeja".
  ipcMain.on("tray-status", (e) => { try { e.returnValue = getTrayState(); } catch { e.returnValue = null; } });
  ipcMain.handle("tray-recreate", () => {
    const r = recreateTray(trayWin, trayOpts);
    return { ...r, state: getTrayState() };
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
    // F3.3.70D3R10U — garante o tray apos login (recria se sumiu; no-op se ok)
    try { ensureTray(trayWin, trayOpts); } catch { /* */ }
    if (stopNotifier) stopNotifier();
    if (stopReminder) stopReminder();
    if (uid) {
      // F3.3.3 — notifier/reminder roteiam pelo HUB (ganham toast in-app quando focado,
      // mantêm a nativa quando minimizado/tray). Mesmos eventos/dedup de antes.
      stopNotifier = startNotifier(() => mainWin, uid, deliverNotification);
      stopReminder = startReminder(() => mainWin, uid, deliverNotification);
      // F3.3.77A-R4B — RELÓGIO CANÔNICO: liga a sincronização (main) via cabeçalho HTTP Date do
      // getUserSelf (Cloud Run, read-only, SEM auth ⇒ zero mutação). Empurra o offset ao renderer,
      // que o aplica em canonicalNowMs()/_slaClockOffsetMs e rearma as timelines de SLA.
      if (clockSync) { try { clockSync.stop(); } catch { /* */ } }
      clockSync = createClockSync({
        emit: (s) => { try { const w = mainWin; if (w && !w.isDestroyed()) w.webContents.send("clock-state", s); } catch { /* */ } },
        onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
      });
      clockSync.start();
      // UPDATER:BEGIN (F3.4.1A — política de verificação item 2: após restauração da sessão)
      if (updater) updater.checkAuto("session-restore");
      // UPDATER:END
      // PRESENCE:BEGIN (F3.4.2A — 1 sonda SILENCIOSA pós-login/restauração; diagnóstico do /auth, SEM token no log)
      if (presenceProbe) {
        presenceProbe.probe()
          .then((r) => { try { diag("presence.login.probe", { validated: r.validated, httpStatus: r.httpStatus, durationMs: r.durationMs, wsEnabled: r.wsEnabled, errorCode: r.errorCode }); } catch { /* */ } })
          .catch(() => { /* diagnóstico best-effort; nunca afeta o login */ });
      }
      // F3.4.2A Stage-2A — liga o cliente WebSocket de presença (token→/auth→ticket→WSS /ws→heartbeat).
      // Idempotente: se já conectado/conectando, no-op. NÃO afeta login/notificações/relógio.
      if (presenceClient) { try { presenceClient.connect(); } catch { /* presença nunca quebra o login */ } }
      // PRESENCE:END
    }
  });
  ipcMain.on("session-logout", () => {
    diag("session-logout"); // F3.3.10-DIAG
    if (stopNotifier) { stopNotifier(); stopNotifier = null; }
    if (stopReminder) { stopReminder(); stopReminder = null; }
    if (clockSync) { try { clockSync.stop(); } catch { /* */ } clockSync = null; }
    // PRESENCE:BEGIN (F3.4.2A Stage-2A — logout encerra a conexão WebSocket de presença)
    if (presenceClient) { try { presenceClient.disconnect(); } catch { /* */ } }
    // PRESENCE:END
  });
  // F3.3.77A-R4B — o renderer consulta/força a sincronização do relógio (sem expor token/URL/headers).
  ipcMain.handle("clock-get-state", () => (clockSync ? clockSync.getState() : null));
  ipcMain.handle("clock-request-sync", () => (clockSync ? clockSync.requestSync("renderer") : null));
  // UPDATER:BEGIN (F3.4.1A — atualizador nativo: instância + IPC restrito + verificação pós-ready)
  updater = createUpdaterService({
    getWindow: () => mainWin,
    onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } },
    beforeInstall: () => updaterTeardownForInstall(),
    // F3.4.2A (Escopo A) — NOTIFICAÇÃO IMEDIATA de atualização, PRODUTOR ÚNICO: o updater
    // avisa, o main monta o payload e roteia pelo MESMO HUB (deliverNotification) de todas as
    // notificações — toast in-app quando a janela está visível, nativa/premium quando na bandeja.
    // O renderer NÃO emite mais toast próprio de update (updMaybeToast neutralizado). dedupKey
    // canônico impede repetição da MESMA versão. Sem download/instalação automáticos.
    onNotify: (kind, st) => {
      try {
        const installed = String(st.installedVersion || (function () { try { return app.getVersion(); } catch { return ""; } })());
        const avail = String(st.availableVersion || "");
        const channel = String(st.channel || "latest");
        if (kind === "available") {
          deliverNotification({
            eventId: `desktop_update_available:${installed}:${avail}:${channel}`,
            eventType: "desktop_update_available",
            title: "NOVA ATUALIZAÇÃO DISPONÍVEL",
            body: `Agenda ID Seven Desktop ${avail} está disponível.`,
            severity: "info", sound: false,
            action: { type: "deep", deep: "config/updates" },
            dedupKey: `desktop_update_available:${installed}:${avail}:${channel}`,
            source: "updater",
          });
        } else if (kind === "downloaded") {
          deliverNotification({
            eventId: `desktop_update_downloaded:${avail}:${channel}`,
            eventType: "desktop_update_downloaded",
            title: "ATUALIZAÇÃO PRONTA",
            body: `A versão ${avail} foi baixada e está pronta para instalação.`,
            severity: "success", sound: false,
            action: { type: "deep", deep: "config/updates" },
            dedupKey: `desktop_update_downloaded:${avail}:${channel}`,
            source: "updater",
          });
        }
      } catch { /* notificação nunca pode quebrar o updater */ }
    },
  });
  updater.start();
  ipcMain.handle("updater-get-state", () => (updater ? updater.getState() : null));
  ipcMain.handle("updater-check", () => (updater ? updater.check("manual") : { ok: false, reason: "no_updater" }));
  ipcMain.handle("updater-download", () => (updater ? updater.download() : { ok: false, reason: "no_updater" }));
  ipcMain.handle("updater-install", () => (updater ? updater.installAndRestart() : { ok: false, reason: "no_updater" }));
  ipcMain.handle("updater-defer", () => (updater ? updater.defer() : { ok: false }));
  // Política de verificação (item 1): após app.ready. (Respeita intervalo de 6h + guarda de in-flight.)
  updater.checkAuto("app-ready");
  // UPDATER:END
  // PRESENCE:BEGIN (F3.4.2A — sonda de autenticação de presença: instância + IPC restrito, sanitizado)
  presenceProbe = createPresenceProbe({
    userDataDir: app.getPath("userData"),
    onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } }, // logger sanitizado (NUNCA recebe token)
  });
  // Retorna SOMENTE o resultado SANITIZADO (booleans/status/duração). NUNCA token/ticket/headers/UID/e-mail.
  ipcMain.handle("presence-auth-probe", async () => (presenceProbe
    ? presenceProbe.probe()
    : { validated: false, httpStatus: 0, durationMs: 0, requiredFieldsPresent: { id: false, name: false, role: false, admin: false, status: false, photo: false, color: false }, testedAt: Date.now(), errorCode: "no_probe", service: "idseven-presence-canary", wsEnabled: false }));
  // F3.4.2A Stage-2A — CLIENTE WEBSOCKET de presença (tempo real). O ctor do WebSocket vem do pacote
  // `ws` (Node/main); se indisponível, a presença WS fica inativa (sem storm). Token/ticket FICAM no
  // main; o renderer recebe SOMENTE o estado sanitizado via 'presence-realtime-state'. Broadcast do
  // Worker está DESLIGADO (Stage 2A): recebemos baseline + estado, NUNCA notificações entrou/saiu.
  let PresenceWS: any = null;
  try { PresenceWS = require("ws"); } catch { PresenceWS = null; }
  if (PresenceWS) {
    presenceClient = createPresenceClient({
      userDataDir: app.getPath("userData"),
      WebSocketCtor: PresenceWS,
      onLog: (t, d) => { try { diag(t, d as any); } catch { /* */ } }, // sanitizado (NUNCA recebe token/ticket)
      onState: (s) => { try { const w = mainWin; if (w && !w.isDestroyed()) w.webContents.send("presence-realtime-state", s); } catch { /* */ } },
      // Stage-2A-X: mantém o processo vivo na bandeja enquanto a presença deve estar conectada.
      onActive: () => presenceKeepAliveOn(),
      onIdle: () => presenceKeepAliveOff(),
    });
  } else {
    diag("presence.ws.unavailable", {}); // pacote ws ausente — presença WS inativa nesta build
  }
  const presenceIdleState = { phase: "idle", wsConnected: false, authValidated: false, service: "idseven-presence-canary", lastConnectAt: null, lastMessageAt: null, heartbeatActive: false, baselineReceived: false, onlineCount: 0, wsEnabled: false, errorCode: null };
  ipcMain.handle("presence-realtime-state", () => (presenceClient ? presenceClient.getState() : presenceIdleState));
  ipcMain.handle("presence-realtime-connect", () => { try { if (presenceClient) presenceClient.connect(); } catch { /* */ } return { ok: !!presenceClient }; });
  ipcMain.handle("presence-realtime-disconnect", () => { try { if (presenceClient) presenceClient.disconnect(); } catch { /* */ } return { ok: !!presenceClient }; });
  // PRESENCE:END

  // F3.3.10-DIAG — HEARTBEAT do MAIN: prova que o processo principal (e o notifier) seguem VIVOS
  // com a janela minimizada/oculta/bandeja. Se após uma atribuição em background não houver
  // firestore.snapshot mas houver main.alive, isola "listener silencioso" de "processo morto".
  // Só log local (sem rede/Firestore/efeito). Removível com as sentinelas F3.3.10-DIAG.
  setInterval(() => {
    try {
      const w = mainWin;
      // F3.3.70D3R10U — watchdog do tray: se sumiu (ex.: Explorer reiniciou), recria.
      // F3.3.73I6C11 — NAO recria durante o quit (senao o destroyTray do realQuit seria desfeito).
      const ts = getTrayState();
      if (!quitting && !ts.created) { try { ensureTray(trayWin, trayOpts); } catch { /* */ } }
      diag("main.alive", {
        notifier: !!stopNotifier, reminder: !!stopReminder,
        visible: !!(w && !w.isDestroyed() && w.isVisible()),
        minimized: !!(w && !w.isDestroyed() && w.isMinimized()),
        tray: ts.created, trayIconEmpty: ts.iconEmpty,
      });
    } catch { /* heartbeat de diagnóstico nunca pode quebrar o app */ }
  }, 30000);

  // F3.3.10-DIAG SELFTEST — só roda sob IDSEVEN_SELFTEST=1 (prova de canal em Windows REAL no CI).
  if (process.env.IDSEVEN_SELFTEST === "1") { try { runNotifSelfTest(); } catch { /* */ } }
});

// Nao encerrar quando todas as janelas fecharem (vivemos na tray).
app.on("window-all-closed", (e: any) => { if (!quitting) e.preventDefault?.(); });
app.on("before-quit", () => { quitting = true; });
