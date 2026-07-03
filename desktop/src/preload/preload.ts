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
  // F3.3.3 — NOTIFICAÇÕES DESKTOP EM TEMPO REAL (local, sem provider externo)
  // renderer -> main: pede uma notificação; o HUB do main decide toast in-app x nativa
  notify: (payload: any): Promise<{ ok: boolean; channel?: string }> => ipcRenderer.invoke("notify", payload),
  // main -> renderer: mostrar TOAST in-app premium (quando a janela está focada/visível)
  onNotifToast: (cb: (payload: any) => void) => {
    ipcRenderer.on("notif-toast", (_e, p: any) => cb(p));
  },
  // F3.3.10 — main -> renderer: CAPTURA p/ a Central de Notificações (histórico local). Capture-only:
  // o main encaminha o MESMO payload já entregue (toast OU nativa), sem alterar roteamento/entrega.
  onNotifHistory: (cb: (payload: any) => void) => {
    ipcRenderer.on("notif-history", (_e, p: any) => cb(p));
  },
  // F3.3.10-DIAG — renderer escreve eventos no log local do main (sem rede/Firestore). Build instrumentada.
  diagLog: (tag: string, data?: any) => { try { ipcRenderer.send("diag-log", tag, data); } catch { /* */ } },
  diagPath: (): Promise<string> => ipcRenderer.invoke("diag-path"),
  // abrir URL externa (WhatsApp app/web, browser) via shell.openExternal
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("open-external", url),
  // 1.0.114 — ENVIO PREMIUM: imagem real do card p/ anexar no WhatsApp.
  saveCardImage: (bytes: ArrayBuffer | Uint8Array, filename: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke("save-card-image", { bytes, filename }),
  saveCardImageAs: (bytes: ArrayBuffer | Uint8Array, filename: string): Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }> =>
    ipcRenderer.invoke("save-card-image-as", { bytes, filename }),
  copyCardImage: (bytes: ArrayBuffer | Uint8Array): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("copy-card-image", bytes),
  showInFolder: (p: string): Promise<boolean> => ipcRenderer.invoke("show-in-folder", p),
  // F3.3.56-G2 — AUTH SERVER-SIDE. O token de sessão vive SOMENTE no main;
  // estes métodos retornam apenas {ok, user/self/active/expiresAt/error} — nunca o token.
  authLogin: (identifier: string, password: string): Promise<any> => ipcRenderer.invoke("auth-login", identifier, password),
  authSelf: (): Promise<any> => ipcRenderer.invoke("auth-self"),
  authChangePassword: (oldPassword: string, newPassword: string): Promise<any> => ipcRenderer.invoke("auth-change-password", oldPassword, newPassword),
  authLogout: (): Promise<any> => ipcRenderer.invoke("auth-logout"),
  authSessionStatus: (): Promise<any> => ipcRenderer.invoke("auth-session-status"),
  isDesktop: true,
  version: "1.0.137-beta-portal-fix-v64-51-test",
});
