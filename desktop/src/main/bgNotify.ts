/**
 * F3.3.10-BG — backgroundNotificationWindow
 * Camada PRÓPRIA de notificação em background, controlada pelo MAIN process — NÃO depende
 * da Notification nativa do Windows (esta vira apenas FALLBACK).
 *
 * Janela: pequena, frameless, transparente, alwaysOnTop ("screen-saver"), skipTaskbar,
 * sem foco (focusable:false + showInactive — não rouba o foco do usuário), canto inferior
 * direito (respeita workArea/DPI), auto-resize ao conteúdo. Renderiza o CARD PREMIUM
 * (mesmo visual do toast aprovado), empilha/fila, auto-dismiss, clique "Abrir tarefa", X.
 *
 * Read-side puro: NÃO grava Firestore, NÃO chama provider/FCM/WebPush/WhatsApp, NÃO toca
 * write-path. Aparece mesmo com a mainWindow minimizada/oculta (processo vivo).
 */
import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "path";
import { diag } from "./diag";

let bgWin: BrowserWindow | null = null;
let onOpen: ((deep: string) => void) | null = null;
let wired = false;
const WIDTH = 430;

function position(h: number): void {
  if (!bgWin || bgWin.isDestroyed()) return;
  try {
    const wa = screen.getPrimaryDisplay().workArea;
    const height = Math.max(1, Math.min(Math.round(h) || 160, wa.height - 24));
    const x = wa.x + wa.width - WIDTH - 14;
    const y = wa.y + wa.height - height - 14;
    bgWin.setBounds({ x, y, width: WIDTH, height });
  } catch { /* nunca quebrar por causa de posicionamento */ }
}

function wireIpc(): void {
  if (wired) return; wired = true;
  // bg renderer -> main: ajustar altura ao conteúdo (mantém ancorado no canto inferior direito)
  ipcMain.on("bgnotify-resize", (_e, h: number) => position(Number(h) || 160));
  // bg renderer -> main: fila vazia -> esconder a janela (não fica um retângulo invisível na tela)
  ipcMain.on("bgnotify-empty", () => { try { if (bgWin && !bgWin.isDestroyed()) bgWin.hide(); } catch { /* */ } });
  // bg renderer -> main: clique em "Abrir tarefa" -> reabrir mainWindow + navegar (deep link)
  ipcMain.on("bgnotify-open", (_e, deep: string) => { diag("bg.open", { deep }); try { onOpen && onOpen(String(deep || "")); } catch { /* */ } });
  // bg renderer -> main: prova de render (diag local) — confirma que o card premium foi montado
  ipcMain.on("bgnotify-rendered", (_e, info: unknown) => { try { diag("bg.rendered", info as any); } catch { /* */ } });
}

function ensureWin(): BrowserWindow {
  if (bgWin && !bgWin.isDestroyed()) return bgWin;
  bgWin = new BrowserWindow({
    width: WIDTH, height: 160, show: false, frame: false, transparent: true,
    resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, skipTaskbar: true, focusable: false, hasShadow: false,
    alwaysOnTop: true, acceptFirstMouse: true, title: "Agenda ID Seven — Notificacao",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "bgnotify-preload.js"),
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
    },
  });
  try { bgWin.setAlwaysOnTop(true, "screen-saver"); } catch { /* */ }
  try { bgWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true } as any); } catch { /* */ }
  try { bgWin.removeMenu(); } catch { /* */ }
  bgWin.loadFile(path.join(app.getAppPath(), "src", "renderer", "bgnotify.html"));
  bgWin.on("closed", () => { bgWin = null; });
  position(160);
  return bgWin;
}

/** Registra o callback de "abrir tarefa" (reabrir mainWindow + deep link) e os IPC. */
export function initBgNotify(openCb: (deep: string) => void): void { onOpen = openCb; wireIpc(); }

/** Exibe (ou enfileira) um card premium em background. Retorna false se não conseguiu exibir. */
export function showBgNotify(p: any): boolean {
  try {
    const win = ensureWin();
    const send = () => { try { if (!win.isDestroyed()) { win.showInactive(); win.webContents.send("bg-card", p); } } catch { /* */ } };
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send); else send();
    diag("bg.show", { dedupKey: p && p.dedupKey, severity: p && p.severity, eventType: p && p.eventType, taskId: p && p.taskId });
    return true;
  } catch (e) { diag("bg.error", { err: String(((e as any) && (e as any).message) || e) }); return false; }
}

export function stopBgNotify(): void { try { if (bgWin && !bgWin.isDestroyed()) bgWin.destroy(); } catch { /* */ } bgWin = null; }
