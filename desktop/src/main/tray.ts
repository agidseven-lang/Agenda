import { app, Tray, Menu, BrowserWindow, nativeImage } from "electron";
import path from "path";
import { diag } from "./diag";

// F3.3.70D3R10U — fallback EMBUTIDO do icone do tray (32x32, gerado do build/icon.png real).
// Garante que a bandeja NUNCA seja criada com nativeImage.createEmpty() (icone invisivel):
// se todos os caminhos em disco falharem, este base64 assume e o icone continua visivel.
const TRAY_FALLBACK_B64 =
  "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";

// F3.3.70D3R10U — estado do tray exposto ao renderer (Configuracoes > Bandeja do sistema)
// via IPC tray-status. lastEvent: none|created|recreated|error.
type TrayState = {
  created: boolean;
  iconEmpty: boolean;
  iconPath: string;
  lastEvent: "none" | "created" | "recreated" | "error";
  error: string;
};
let currentTray: Tray | null = null;
const trayState: TrayState = { created: false, iconEmpty: true, iconPath: "", lastEvent: "none", error: "" };

export function getTrayState(): TrayState {
  // reflete destruicao externa sem depender de quem destruiu
  if (currentTray && currentTray.isDestroyed()) { currentTray = null; trayState.created = false; }
  return { ...trayState };
}

type TrayOpts = {
  isAutoStart: () => boolean;
  setAutoStart: (v: boolean) => void;
  quit: () => void;
};

function loadTrayIcon(): { img: Electron.NativeImage; usedPath: string } {
  const iconPath = path.join(process.resourcesPath || app.getAppPath(), "..", "build", "icon.png");
  // fallback: tenta de varios lugares (dev x packaged)
  const tryPaths = [
    path.join(app.getAppPath(), "build", "icon.png"),
    path.join(process.resourcesPath || "", "icon.png"),
    iconPath,
  ];
  let img = nativeImage.createEmpty();
  let usedPath = "";
  for (const p of tryPaths) {
    try {
      const i = nativeImage.createFromPath(p);
      if (!i.isEmpty()) { img = i.resize({ width: 16, height: 16 }); usedPath = p; break; }
    } catch {}
  }
  // F3.3.70D3R10U — NUNCA criar Tray com imagem vazia (icone invisivel na bandeja):
  // se todos os caminhos falharem, usa o icone EMBUTIDO (base64) como fonte final.
  if (img.isEmpty()) {
    try {
      const emb = nativeImage.createFromDataURL("data:image/png;base64," + TRAY_FALLBACK_B64);
      if (!emb.isEmpty()) { img = emb.resize({ width: 16, height: 16 }); usedPath = "(embedded-fallback)"; }
    } catch {}
  }
  return { img, usedPath };
}

function buildTray(getWin: () => BrowserWindow | null, opts: TrayOpts, event: "created" | "recreated"): Tray {
  const { img, usedPath } = loadTrayIcon();
  const tray = new Tray(img);
  currentTray = tray;
  trayState.created = true;
  trayState.iconEmpty = img.isEmpty();
  trayState.iconPath = usedPath || "(none)";
  trayState.lastEvent = event;
  trayState.error = "";
  // F3.3.70D3R10I/U — diagnostico runtime do tray (prova icone empacotado/na bandeja)
  try { diag("tray." + event, { iconEmpty: img.isEmpty(), iconPath: usedPath || "(none)" }); } catch { /* */ }
  tray.setToolTip("Agenda ID Seven Desktop");

  const rebuild = () => {
    const menu = Menu.buildFromTemplate([
      { label: "Abrir Agenda ID Seven", click: () => { const w = getWin(); if (w) { w.show(); w.focus(); } } },
      { type: "separator" },
      { label: "Iniciar com o Windows", type: "checkbox", checked: opts.isAutoStart(), click: (m) => opts.setAutoStart(m.checked) },
      { type: "separator" },
      { label: "Sair", click: () => opts.quit() },
    ]);
    tray.setContextMenu(menu);
  };
  tray.on("double-click", () => { const w = getWin(); if (w) { w.show(); w.focus(); } });
  rebuild();
  return tray;
}

// Cria o tray no startup. Assinatura preservada (compat com main.ts/testes).
export function createTray(getWin: () => BrowserWindow | null, opts: TrayOpts): Tray {
  return buildTray(getWin, opts, "created");
}

// F3.3.70D3R10U — garante que o tray exista (startup, session-login, heartbeat).
// Se ja existe e nao foi destruido: no-op. Se sumiu ou nunca existiu: (re)cria.
// Nunca lanca — registra tray.error no diag e devolve ok:false.
export function ensureTray(getWin: () => BrowserWindow | null, opts: TrayOpts): { ok: boolean; action: "kept" | "created" | "recreated" } {
  try {
    if (currentTray && !currentTray.isDestroyed()) return { ok: true, action: "kept" };
    const ev: "created" | "recreated" = trayState.lastEvent === "none" ? "created" : "recreated";
    buildTray(getWin, opts, ev);
    return { ok: true, action: ev };
  } catch (e: any) {
    trayState.created = false;
    trayState.lastEvent = "error";
    trayState.error = String((e && e.message) || e);
    try { diag("tray.error", { err: trayState.error }); } catch { /* */ }
    return { ok: false, action: "created" };
  }
}

// F3.3.70D3R10U — recriacao FORCADA (botao "Recriar icone da bandeja" em Configuracoes).
export function recreateTray(getWin: () => BrowserWindow | null, opts: TrayOpts): { ok: boolean } {
  try {
    if (currentTray && !currentTray.isDestroyed()) { try { currentTray.destroy(); } catch { /* */ } }
    currentTray = null;
    buildTray(getWin, opts, "recreated");
    return { ok: true };
  } catch (e: any) {
    trayState.created = false;
    trayState.lastEvent = "error";
    trayState.error = String((e && e.message) || e);
    try { diag("tray.error", { err: trayState.error }); } catch { /* */ }
    return { ok: false };
  }
}
