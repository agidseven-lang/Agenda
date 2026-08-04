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
// F3.5.4U — largura RESPONSIVA do card premium (antes fixa 430). Preferencial ~500px; faixa segura
// 440–560; NUNCA maior que a workArea do monitor ativo (com margem lateral). Em telas estreitas encolhe
// abaixo de 440 até um piso (respeitando as margens) — evita corte de conteúdo em 1366×768 / escala
// 125–150% / dois monitores / barra de tarefas lateral. A ALTURA segue adaptável ao conteúdo (resize).
const WIDTH_PREF = 500;
const WIDTH_MAX = 560;
const WIDTH_MIN = 440;
const WIDTH_FLOOR = 360;   // piso absoluto p/ telas muito estreitas (margens preservadas)
const EDGE_MARGIN = 14;    // margem até a borda direita/inferior do workArea (idêntico ao 1.0.208)
function computeWidth(wa: Electron.Rectangle | null | undefined): number {
  const avail = Math.max(1, (wa ? wa.width : 1200) - EDGE_MARGIN * 2);
  let w = Math.min(WIDTH_PREF, WIDTH_MAX, avail);           // preferencial, com teto e nunca fora da tela
  if (w < WIDTH_MIN) w = Math.min(Math.max(w, WIDTH_FLOOR), avail); // faixa segura, cedendo em telas estreitas
  return Math.round(Math.max(WIDTH_FLOOR, Math.min(w, avail)));
}
function bgVersion(): string { try { return app.getVersion(); } catch { return "dev"; } }
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
    // F3.5.4K — MULTIMONITOR: posiciona no MONITOR ATIVO (display mais próximo do cursor); fallback ao
    // primário. Canto inferior direito do workArea daquele display (respeita taskbar/DPI). Nunca fora da tela.
    let wa: Electron.Rectangle;
    try { wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea; }
    catch { wa = screen.getPrimaryDisplay().workArea; }
    if (!wa) wa = screen.getPrimaryDisplay().workArea;
    const WIDTH = computeWidth(wa); // F3.5.4U — largura RESPONSIVA ao monitor ativo (nunca fora da tela; contrato canto-inferior-direito/workArea preservado)
    const height = Math.max(1, Math.min(Math.round(h) || 160, wa.height - 24));
    const x = wa.x + wa.width - WIDTH - EDGE_MARGIN;
    const y = wa.y + wa.height - height - EDGE_MARGIN;
    bgWin.setBounds({ x, y, width: WIDTH, height });
  } catch { /* nunca quebrar por causa de posicionamento */ }
}

function wireIpc(): void {
  if (wired) return; wired = true;
  // bg renderer -> main: ajustar altura ao conteúdo (mantém ancorado no canto inferior direito)
  ipcMain.on("bgnotify-resize", (_e, h: number) => position(Number(h) || 160));
  // bg renderer -> main: fila vazia -> esconder a janela (não fica um retângulo invisível na tela)
  ipcMain.on("bgnotify-empty", () => { try { diag("notification.premium.closed", { eventType: "", deliverySurface: "premium_window", appVersion: bgVersion(), timestamp: Date.now() }); } catch { /* F3.5.4U — observabilidade sanitizada */ } try { if (bgWin && !bgWin.isDestroyed()) bgWin.hide(); } catch { /* */ } });
  // bg renderer -> main: clique em "Abrir tarefa" -> reabrir mainWindow + navegar (deep link)
  ipcMain.on("bgnotify-open", (_e, deep: string) => { diag("bg.open", { deep }); try { onOpen && onOpen(String(deep || "")); } catch { /* */ } });
  // bg renderer -> main: prova de render — confirma que o card premium foi montado.
  // F3.4.7 — além do log, o ACK cancela o fallback pendente daquele dedupKey.
  ipcMain.on("bgnotify-rendered", (_e, info: unknown) => {
    try { const inf = (info || {}) as Record<string, unknown>; diag("notification.sound.premium", { eventType: String(inf.eventType || ""), deliverySurface: "premium_window", severity: String(inf.severity || ""), grouped: false, firstInGroup: true, soundEnabled: String(inf.sound || "") !== "suppressed_by_payload", playbackResult: String(inf.sound || ""), appVersion: bgVersion(), timestamp: Date.now() }); } catch { /* F3.5.4W-H2 — observabilidade sanitizada do som da premium */ }
    try { diag("bg.rendered", info as any); } catch { /* */ }
    try { const k = info && (info as any).dedupKey; if (k) ackCancel(String(k)); } catch { /* */ }
  });
}

function ensureWin(): BrowserWindow {
  if (bgWin && !bgWin.isDestroyed()) return bgWin;
  let initW = WIDTH_PREF; try { initW = computeWidth(screen.getPrimaryDisplay().workArea); } catch { initW = WIDTH_PREF; } // F3.5.4U
  bgWin = new BrowserWindow({
    width: initW, height: 160, show: false, frame: false, transparent: true,
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

/** F3.5.4O — ATUALIZA um card de GRUPO comum já exibido (mesmo destinatário+tarefa dentro da janela
 *  de 5s). NÃO cria nova janela, NÃO toca som, NÃO rouba foco: envia o novo "view" do grupo p/ o
 *  renderer MORFAR em vigor o card existente (endereçado por data-group). No-op se a janela premium
 *  não existe ou se o card já sumiu (o renderer ignora um groupKey ausente). A janela auto-redimensiona
 *  via bgnotify-resize quando o conteúdo cresce. Read-side puro (sem Firestore/rede/write). */
export function updateBgGroup(view: any): void {
  try {
    if (!view || !view.groupKey) return;
    const win = bgWin;
    if (!win || win.isDestroyed()) return; // sem janela premium viva ⇒ nada a atualizar (1º evento caiu p/ nativa/toast)
    const send = () => { try { if (!win.isDestroyed()) win.webContents.send("bg-group-update", view); } catch { /* */ } };
    if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send); else send();
    diag("bg.group.update", { groupKey: String(view.groupKey || "").slice(0, 8) + "…", count: view.count, visible: view.items ? view.items.length : 0, extra: view.extraCount });
  } catch (e) { diag("bg.group.update.error", { err: String(((e as any) && (e as any).message) || e) }); }
}

export function stopBgNotify(): void {
  try { pendingAck.forEach((v) => { try { clearTimeout(v.timer); } catch { /* */ } }); pendingAck.clear(); } catch { /* */ } // F3.4.7 — nenhum fallback tardio após teardown
  try { if (bgWin && !bgWin.isDestroyed()) bgWin.destroy(); } catch { /* */ }
  bgWin = null;
}

/** F3.5.4K — status SANITIZADO da janela premium p/ o painel de diagnóstico (Configurações → Notificações).
 *  initialized = initBgNotify já registrado (wireIpc); hasWindow = janela premium instanciada e viva. */
export function bgStatus(): { initialized: boolean; hasWindow: boolean } {
  return { initialized: wired, hasWindow: !!(bgWin && !bgWin.isDestroyed()) };
}
