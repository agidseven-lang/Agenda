/**
 * Agenda ID Seven Desktop — Main process
 * - Janela com renderer de paridade APK (UI igual a Web Preview 1.0.65)
 * - Fechar = esconde na Tray (nao encerra); "Sair" so pelo menu da Tray
 * - Autostart Windows opcional (sobe oculto na tray no login)
 * - Notifier + Reminder rodam aqui (sobrevivem a janela escondida)
 */
import { app, BrowserWindow, Tray, ipcMain, Notification } from "electron";
import path from "path";
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

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  });
}

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
