// Ponte segura main <-> renderer (contextBridge)
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopAPI", {
  // notificacao de teste
  notifTest: (): Promise<boolean> => ipcRenderer.invoke("notif-test"),
  // autostart Windows
  autostartGet: (): Promise<boolean> => ipcRenderer.invoke("autostart-get"),
  autostartSet: (v: boolean): Promise<boolean> => ipcRenderer.invoke("autostart-set", v),
  // sessao -> liga/desliga listeners de notificacao no main
  sessionLogin: (uid: string) => ipcRenderer.send("session-login", uid),
  sessionLogout: () => ipcRenderer.send("session-logout"),
  // sair de verdade (fora da tray)
  appQuit: (): Promise<void> => ipcRenderer.invoke("app-quit"),
  // receber deep-link de clique em toast / protocolo idseven://
  onNotifOpen: (cb: (target: string) => void) => {
    ipcRenderer.on("notif-open", (_e, t: string) => cb(t));
  },
  // abrir URL externa (WhatsApp app/web, browser) via shell.openExternal
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("open-external", url),
  isDesktop: true,
  version: "1.0.86-desktop-login-render-hotfix",
});
