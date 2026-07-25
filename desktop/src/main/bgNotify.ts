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
// F3.4.7 — PROVA DE RENDER: o "bgnotify-rendered" (que antes era só log) vira ACK de entrega.
// Cada card enviado arma um prazo; se o ACK do dedupKey não chegar (janela não carregou, renderer
// morto, GPU/transparência falhou, load falhou), o main dispara o fallback (Notification nativa)
// via onNoRender — a entrega visual deixa de ser OTIMISTA. 4s cobre o load inicial da janela.
const ACK_TIMEOUT_MS = 4000;
const pendingAck = new Map<string, { timer: ReturnType<typeof setTimeout>; onNoRender: () => void }>();
function ackArm(key: string, onNoRender: () => void): void {
  ackCancel(key); // um card por dedupKey: rearmar substitui o prazo anterior
  const timer = setTimeout(() => {
    pendingAck.delete(key);
    diag("bg.render.timeout", { dedupKey: key, timeoutMs: ACK_TIMEOUT_MS });
    try { onNoRender(); } catch { /* fallback nunca pode derrubar o main */ }
  }, ACK_TIMEOUT_MS);
  pendingAck.set(key, { timer, onNoRender });
}
function ackCancel(key: string): void {
  const p = pendingAck.get(key);
  if (!p) return;
  try { clearTimeout(p.timer); } catch { /* */ }
  pendingAck.delete(key);
}

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
  // bg renderer -> main: prova de render — confirma que o card premium foi montado.
  // F3.4.7 — além do log, o ACK cancela o fallback pendente daquele dedupKey.
  ipcMain.on("bgnotify-rendered", (_e, info: unknown) => {
    try { diag("bg.rendered", info as any); } catch { /* */ }
    try { const k = info && (info as any).dedupKey; if (k) ackCancel(String(k)); } catch { /* */ }
  });
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

/** Exibe (ou enfileira) um card premium em background. Retorna false se não conseguiu exibir.
 *  F3.4.7 — onNoRender (opcional): chamado UMA vez se o card não provar render (ACK
 *  "bgnotify-rendered" do mesmo dedupKey) dentro de ACK_TIMEOUT_MS — fallback do chamador. */
export function showBgNotify(p: any, onNoRender?: () => void): boolean {
  try {
    const win = ensureWin();
    const send = () => { try { if (!win.isDestroyed()) { win.showInactive(); win.webContents.send("bg-card", p); } } catch { /* */ } };
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send); else send();
    const key = p && p.dedupKey ? String(p.dedupKey) : "";
    if (key && typeof onNoRender === "function") ackArm(key, onNoRender);
    diag("bg.show", { dedupKey: p && p.dedupKey, severity: p && p.severity, eventType: p && p.eventType, taskId: p && p.taskId, ackArmed: !!(key && typeof onNoRender === "function") });
    return true;
  } catch (e) { diag("bg.error", { err: String(((e as any) && (e as any).message) || e) }); return false; }
}

export function stopBgNotify(): void {
  try { pendingAck.forEach((v) => { try { clearTimeout(v.timer); } catch { /* */ } }); pendingAck.clear(); } catch { /* */ } // F3.4.7 — nenhum fallback tardio após teardown
  try { if (bgWin && !bgWin.isDestroyed()) bgWin.destroy(); } catch { /* */ }
  bgWin = null;
}
