// F3.3.10-BG — ponte segura (contextIsolation) para a janela de notificação em background.
// Só expõe o necessário: receber card, reportar altura, abrir tarefa, esvaziar, prova de render.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("bgAPI", {
  onCard: (cb: (p: any) => void) => ipcRenderer.on("bg-card", (_e, p: any) => cb(p)),
  resize: (h: number) => ipcRenderer.send("bgnotify-resize", h),
  empty: () => ipcRenderer.send("bgnotify-empty"),
  open: (deep: string) => ipcRenderer.send("bgnotify-open", deep),
  rendered: (info: any) => ipcRenderer.send("bgnotify-rendered", info),
});
