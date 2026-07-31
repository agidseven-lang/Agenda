/**
 * F3.5.4L — slaReminderWindow.ts — SUPERFÍCIE ELECTRON do lembrete central (usada pelo main).
 * =====================================================================================
 * Janela ÚNICA, central no monitor ativo, always-on-top ("screen-saver"), showInactive (não rouba
 * foco), focusable:false + acceptFirstMouse (clicável), skipTaskbar, visível em todas as áreas de
 * trabalho e sobre tela cheia, SEM frame/X, SEM auto-close. Alt+F4 bloqueado até o OK: interceptamos
 * 'close' e só permitimos quando `acknowledged` (setado pelo controller via close()).
 *
 * Prova de render (mesmo contrato do bgNotify): se o card não sinalizar 'slareminder-rendered' em
 * ACK_TIMEOUT_MS, o onNoRender dispara (fallback nativo) — cobre o caso de overlay bloqueado por
 * app em tela cheia exclusiva.
 *
 * Sons: lidos UMA vez do pacote (fs funciona dentro do app.asar) e convertidos p/ data:audio/wav;base64
 * — 100% local, sem rede/stream/download em runtime, sem depender de path de mídia no asar.
 */
import { app, BrowserWindow, ipcMain, screen, Notification } from "electron";
import path from "path";
import fs from "fs";
import { diag } from "./diag";
import type { ReminderSurface, ReminderView } from "./slaReminder";

const WIDTH = 460;
const ACK_TIMEOUT_MS = 4000;

export function loadReminderSounds(): { warning: string; critical: string } {
  const read = (name: string): string => {
    try {
      const p = path.join(app.getAppPath(), "src", "renderer", "sounds", name);
      const b = fs.readFileSync(p);
      return "data:audio/wav;base64," + b.toString("base64");
    } catch { return ""; }
  };
  return { warning: read("sla-warning.wav"), critical: read("sla-critical.wav") };
}

export type SlaReminderSurfaceDeps = {
  onAck: (key: string, windowState: string) => void;   // OK do usuário
  onOpenTask: (deep: string) => void;                  // clique "Abrir tarefa" (traz Agenda + abre)
  nativeNotify?: (view: ReminderView) => boolean;      // fallback nativo (injeta o do main)
  onLog?: (tag: string, data?: unknown) => void;
};

export function createSlaReminderSurface(deps: SlaReminderSurfaceDeps): ReminderSurface & { destroy: () => void; ackState: () => string } {
  const log = deps.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  let win: BrowserWindow | null = null;
  let acknowledged = false;         // libera o 'close' (Alt+F4) só após ack
  let curKey = "";
  let renderTimer: any = null;
  let onNoRenderCb: (() => void) | null = null;
  let lastFocusedBefore: BrowserWindow | null = null;

  function winState(): string { return "reminder"; }

  function ensure(): BrowserWindow {
    if (win && !win.isDestroyed()) return win;
    acknowledged = false;
    win = new BrowserWindow({
      width: WIDTH, height: 260, show: false, frame: false, transparent: true,
      resizable: false, movable: false, minimizable: false, maximizable: false, closable: true,
      fullscreenable: false, skipTaskbar: true, focusable: false, hasShadow: false,
      alwaysOnTop: true, acceptFirstMouse: true, title: "Agenda ID Seven — Lembrete de SLA",
      backgroundColor: "#00000000",
      webPreferences: {
        preload: path.join(__dirname, "..", "preload", "slareminder-preload.js"),
        contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
      },
    });
    try { win.setAlwaysOnTop(true, "screen-saver"); } catch { /* */ }
    try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true } as any); } catch { /* */ }
    try { win.removeMenu(); } catch { /* */ }
    // Alt+F4 / qualquer close antes do OK ⇒ bloqueado
    win.on("close", (e) => { if (!acknowledged) { try { e.preventDefault(); } catch { /* */ } log("sla.reminder.close.blocked", { key: mask(curKey) }); } });
    win.loadFile(path.join(app.getAppPath(), "src", "renderer", "slareminder.html"));
    return win;
  }

  function center(h: number): void {
    if (!win || win.isDestroyed()) return;
    let disp;
    try { disp = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); } catch { /* */ }
    try { if (!disp) disp = screen.getPrimaryDisplay(); } catch { /* */ }
    const wa = (disp && disp.workArea) || { x: 0, y: 0, width: 1280, height: 800 };
    const height = Math.max(180, Math.min(Math.round(h) || 260, wa.height - 40));
    const x = Math.round(wa.x + (wa.width - WIDTH) / 2);
    const y = Math.round(wa.y + (wa.height - height) / 2);
    try { win.setBounds({ x, y, width: WIDTH, height }); } catch { /* */ }
  }

  function armRenderProof(key: string): void {
    clearRenderProof();
    renderTimer = setTimeout(() => {
      renderTimer = null;
      log("sla.reminder.render.timeout", { key: mask(key) });
      const cb = onNoRenderCb; onNoRenderCb = null;
      if (cb) { try { cb(); } catch { /* */ } }
    }, ACK_TIMEOUT_MS);
  }
  function clearRenderProof(): void { if (renderTimer) { try { clearTimeout(renderTimer); } catch { /* */ } renderTimer = null; } }

  function push(view: ReminderView): void {
    const w = ensure();
    curKey = view.key;
    const send = () => { try { w.webContents.send("slareminder-card", view); } catch { /* */ } };
    if (w.webContents.isLoading()) { w.webContents.once("did-finish-load", send); } else { send(); }
    try { w.showInactive(); } catch { /* */ }
    center(260);
  }

  const surface: ReminderSurface & { destroy: () => void; ackState: () => string } = {
    show(view: ReminderView): void {
      // guarda o foco atual só p/ garantir que NÃO roubamos foco (showInactive já garante)
      try { lastFocusedBefore = BrowserWindow.getFocusedWindow(); void lastFocusedBefore; } catch { /* */ }
      push(view);
      armRenderProof(view.key);
    },
    promote(view: ReminderView): void { push(view); armRenderProof(view.key); },
    close(): void {
      clearRenderProof();
      acknowledged = true; onNoRenderCb = null; curKey = "";
      if (win && !win.isDestroyed()) { try { win.destroy(); } catch { /* */ } }
      win = null;
    },
    isOpen(): boolean { return !!(win && !win.isDestroyed() && win.isVisible()); },
    native(view: ReminderView): boolean {
      if (deps.nativeNotify) { try { return deps.nativeNotify(view); } catch { return false; } }
      try {
        const n = new Notification({ title: view.title + " — " + (view.taskTitle || "SLA"), body: view.body || "", silent: false });
        n.on("click", () => { try { deps.onOpenTask(view.deep); } catch { /* */ } });
        (n as any).on && (n as any).on("close", () => { /* nativa fechada não reconhece: modal exigido no unlock */ });
        n.show();
        return true;
      } catch { return false; }
    },
    onNoRender(key: string, cb: () => void): void { onNoRenderCb = cb; if (curKey === key && !renderTimer) armRenderProof(key); },
    destroy(): void { clearRenderProof(); acknowledged = true; if (win && !win.isDestroyed()) { try { win.destroy(); } catch { /* */ } } win = null; },
    ackState(): string { return winState(); },
  };

  // IPC do card (registrado uma vez)
  ipcMain.on("slareminder-rendered", (_e, key) => { if (String(key || "") === curKey) { clearRenderProof(); log("sla.reminder.rendered", { key: mask(curKey) }); } });
  ipcMain.on("slareminder-resize", (_e, h) => { center(Number(h) || 260); });
  ipcMain.on("slareminder-ok", (_e, key) => { const k = String(key || ""); log("sla.reminder.ok.click", { key: mask(k) }); try { deps.onAck(k, winState()); } catch (e) { log("sla.reminder.ok.error", { err: String((e as any) && (e as any).message || e) }); } });
  ipcMain.on("slareminder-open", (_e, deep) => { try { deps.onOpenTask(String(deep || "")); } catch { /* */ } });

  return surface;
}

function mask(s: string): string { const v = String(s || ""); return v.length <= 8 ? v : v.slice(0, 4) + "…" + v.slice(-4); }
