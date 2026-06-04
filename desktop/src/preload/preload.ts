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
  // receber deep-link de clique em toast
  onNotifOpen: (cb: (target: string) => void) => {
    ipcRenderer.on("notif-open", (_e, t: string) => cb(t));
  },
  isDesktop: true,
  version: "1.0.79-desktop-share-link-detail-footer-fix",
});
