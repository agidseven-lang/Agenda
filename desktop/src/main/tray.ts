import { app, Tray, Menu, BrowserWindow, nativeImage } from "electron";
import path from "path";
import { diag } from "./diag";

export function createTray(getWin: () => BrowserWindow | null, opts: {
  isAutoStart: () => boolean;
  setAutoStart: (v: boolean) => void;
  quit: () => void;
}): Tray {
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
  const tray = new Tray(img);
  // F3.3.70D3R10I — diagnostico runtime do tray (prova icone empacotado/na bandeja)
  try { diag("tray.created", { iconEmpty: img.isEmpty(), iconPath: usedPath || "(none)" }); } catch { /* */ }
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
