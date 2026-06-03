import { app } from "electron";

export function isAutoStart(): boolean {
  if (process.platform !== "win32") return false;
  const s = app.getLoginItemSettings({ args: ["--hidden"] });
  return !!s.openAtLogin;
}

export function setAutoStart(v: boolean) {
  if (process.platform !== "win32") return;
  app.setLoginItemSettings({
    openAtLogin: v,
    args: ["--hidden"], // sobe minimizado na tray
  });
}
