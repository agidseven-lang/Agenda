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
import { startReminder } from "./reminder";

let mainWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let stopNotifier: (() => void) | null = null;
let stopReminder: (() => void) | null = null;
let quitting = false;

// AUMID p/ toasts no Windows respeitarem o app
if (process.platform === "win32") app.setAppUserModelId("br.com.idseven.agenda.desktop");

// Locale pt-BR: faz os inputs nativos date/time exibirem dd/mm/aaaa e HH:mm.
app.commandLine.appendSwitch("lang", "pt-BR");

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
  // Zoom uniforme proporcional ao tamanho da janela (preserva proporção do print
  // 1366×768 em qualquer tela; mesmo template, em escala maior). Cálculo:
  // zoom = max(1, min(w/1366, h/768)). Reaplica em resize.
  const BASE_W = 1366, BASE_H = 768;
  const fitZoom = (): void => {
    if (!mainWin) return;
    const [w, h] = mainWin.getContentSize();
    const z = Math.max(1, Math.min(w / BASE_W, h / BASE_H));
    mainWin.webContents.setZoomFactor(z);
  };
  mainWin.webContents.on("did-finish-load", () => {
    mainWin?.webContents.setVisualZoomLevelLimits(1, 1);
    fitZoom();
  });
  mainWin.on("resize", fitZoom);

  // Fechar = esconde na tray (nao encerra). Quit real so pelo menu da tray.
  mainWin.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWin?.hide();
    }
  });
}

function realQuit() {
  quitting = true;
  if (stopNotifier) stopNotifier();
  if (stopReminder) stopReminder();
  app.quit();
}

app.whenReady().then(() => {
  createWindow();
  tray = createTray(
    () => mainWin,
    { isAutoStart, setAutoStart, quit: realQuit }
  );

  // IPC do renderer
  ipcMain.handle("notif-test", () => {
    new Notification({ title: "Agenda ID Seven", body: "Notificacao de teste OK." }).show();
    return true;
  });
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
    if (stopNotifier) stopNotifier();
    if (stopReminder) stopReminder();
    if (uid) {
      stopNotifier = startNotifier(() => mainWin, uid);
      stopReminder = startReminder(() => mainWin, uid);
    }
  });
  ipcMain.on("session-logout", () => {
    if (stopNotifier) { stopNotifier(); stopNotifier = null; }
    if (stopReminder) { stopReminder(); stopReminder = null; }
  });
});

// Nao encerrar quando todas as janelas fecharem (vivemos na tray).
app.on("window-all-closed", (e: any) => { if (!quitting) e.preventDefault?.(); });
app.on("before-quit", () => { quitting = true; });
