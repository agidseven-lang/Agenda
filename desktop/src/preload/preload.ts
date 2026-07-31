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
  // F3.5.3 — renderer confirma o RENDER do toast (dedupKey): sem ACK, o main entrega pelo fallback.
  notifToastAck: (dedupKey: string) => { try { ipcRenderer.send("notif-toast-ack", String(dedupKey || "")); } catch { /* */ } },
  // F3.5.3 — COLAGEM explícita no formulário (Legenda/Tema/Observações): texto simples do clipboard
  // via módulo do Electron no main (determinístico; independe do accelerator nativo). Nunca HTML.
  clipboardReadText: (): Promise<string> => ipcRenderer.invoke("clipboard-read-text"),
  // F3.3.10 — main -> renderer: CAPTURA p/ a Central de Notificações (histórico local). Capture-only:
  // o main encaminha o MESMO payload já entregue (toast OU nativa), sem alterar roteamento/entrega.
  onNotifHistory: (cb: (payload: any) => void) => {
    ipcRenderer.on("notif-history", (_e, p: any) => cb(p));
  },
  // F3.3.77A-R4B — RELÓGIO CANÔNICO: offset derivado do cabeçalho HTTP Date (Cloud Run read-only) no
  // MAIN. O renderer recebe SOMENTE {offsetMs, quality, syncedAt*, uncertaintyMs, source, ...} — nunca
  // token, URL privada, headers de auth ou corpo da resposta.
  clockGetState: (): Promise<any> => ipcRenderer.invoke("clock-get-state"),
  clockRequestSync: (): Promise<any> => ipcRenderer.invoke("clock-request-sync"),
  onClockState: (cb: (state: any) => void) => {
    ipcRenderer.on("clock-state", (_e, s: any) => cb(s));
  },
  // F3.3.10-DIAG — renderer escreve eventos no log local do main (sem rede/Firestore). Build instrumentada.
  diagLog: (tag: string, data?: any) => { try { ipcRenderer.send("diag-log", tag, data); } catch { /* */ } },
  diagPath: (): Promise<string> => ipcRenderer.invoke("diag-path"),
  // F3.5.4K — status SANITIZADO das notificações p/ Configurações → Notificações (read-only; sem token/uid/conteúdo)
  notifDiag: (): Promise<any> => ipcRenderer.invoke("notif-diag"),
  // F3.5.4N — REDE: o renderer reporta o estado REAL do SO (navigator.onLine + eventos online/offline).
  // Sinal usado pelo watchdog (supervisor); o firebase.ts continua reconectando por conta própria.
  netStatus: (online: boolean) => { try { ipcRenderer.send("net-status", !!online); } catch { /* */ } },
  // F3.5.4N — INICIALIZAÇÃO COM O WINDOWS (Configurações → Inicialização): estado REAL do SO + toggle.
  startupGet: (): Promise<any> => ipcRenderer.invoke("startup-get"),
  startupSet: (v: boolean): Promise<any> => ipcRenderer.invoke("startup-set", v),
  // F3.5.4N — AUTOCORREÇÃO do canal (item 17): ligar/desligar SOMENTE a autocorreção (firebase reconecta sempre).
  selfHealGet: (): Promise<any> => ipcRenderer.invoke("selfheal-get"),
  selfHealSet: (v: boolean): Promise<any> => ipcRenderer.invoke("selfheal-set", v),
  // abrir URL externa (WhatsApp app/web, browser) via shell.openExternal
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke("open-external", url),
  // F3.3.73I6C18C — prepara/valida o Card Premium ANTES do WhatsApp (GET read-only no main,
  // RESTRITO a https://aprovar.agendaidseven.com.br/share/cronograma/<token>; token nunca logado)
  cardPrewarm: (url: string, expectedType: string): Promise<{ ok: boolean; reason?: string; cache?: string; get1Ms?: number; get2Ms?: number }> =>
    ipcRenderer.invoke("card-prewarm", url, expectedType),
  // 1.0.114 — ENVIO PREMIUM: imagem real do card p/ anexar no WhatsApp.
  saveCardImage: (bytes: ArrayBuffer | Uint8Array, filename: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke("save-card-image", { bytes, filename }),
  saveCardImageAs: (bytes: ArrayBuffer | Uint8Array, filename: string): Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }> =>
    ipcRenderer.invoke("save-card-image-as", { bytes, filename }),
  copyCardImage: (bytes: ArrayBuffer | Uint8Array): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("copy-card-image", bytes),
  // F3.3.70D3R10U — "Abrir imagem" do card (salva em Downloads + abre no visualizador do SO)
  openCardImage: (bytes: ArrayBuffer | Uint8Array, filename: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
    ipcRenderer.invoke("open-card-image", { bytes, filename }),
  showInFolder: (p: string): Promise<boolean> => ipcRenderer.invoke("show-in-folder", p),
  // F3.3.70D3R10U — TRAY: status p/ Configuracoes (sincrono, payload minusculo) + recriacao
  trayStatus: (): any => { try { return ipcRenderer.sendSync("tray-status"); } catch { return null; } },
  trayRecreate: (): Promise<any> => ipcRenderer.invoke("tray-recreate"),
  // F3.3.56-G2 — AUTH SERVER-SIDE. O token de sessão vive SOMENTE no main;
  // estes métodos retornam apenas {ok, user/self/active/expiresAt/error} — nunca o token.
  authLogin: (identifier: string, password: string): Promise<any> => ipcRenderer.invoke("auth-login", identifier, password),
  authSelf: (): Promise<any> => ipcRenderer.invoke("auth-self"),
  authChangePassword: (oldPassword: string, newPassword: string): Promise<any> => ipcRenderer.invoke("auth-change-password", oldPassword, newPassword),
  authLogout: (): Promise<any> => ipcRenderer.invoke("auth-logout"),
  // F3.3.71A — troca segura de e-mail de login (self/admin); nunca expoe token
  authChangeEmail: (currentPassword: string, newEmail: string): Promise<any> => ipcRenderer.invoke("auth-change-email", currentPassword, newEmail),
  authAdminChangeUserEmail: (targetId: string, newEmail: string, confirm: string, reason: string): Promise<any> => ipcRenderer.invoke("auth-admin-change-user-email", targetId, newEmail, confirm, reason),
  authSessionStatus: (): Promise<any> => ipcRenderer.invoke("auth-session-status"),
  // UPDATER:BEGIN (F3.4.1A — API mínima do atualizador; nunca token/URL/headers/fs/objetos Electron)
  updater: {
    getState: (): Promise<any> => ipcRenderer.invoke("updater-get-state"),
    check: (): Promise<any> => ipcRenderer.invoke("updater-check"),
    download: (): Promise<any> => ipcRenderer.invoke("updater-download"),
    installAndRestart: (): Promise<any> => ipcRenderer.invoke("updater-install"),
    defer: (): Promise<any> => ipcRenderer.invoke("updater-defer"),
    onStateChanged: (cb: (state: any) => void) => { ipcRenderer.on("updater-state", (_e, s: any) => cb(s)); },
  },
  // UPDATER:END
  isDesktop: true,
  // F3.3.70D3R10I — versao REAL do app (app.getVersion() via IPC sincrono; nunca mais string manual)
  version: (() => { try { return String(ipcRenderer.sendSync("app-version") || "dev"); } catch { return "dev"; } })(),
});
