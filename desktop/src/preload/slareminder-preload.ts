/**
 * F3.5.4L — slareminder-preload.ts — bridge MÍNIMO da janela do lembrete central de SLA.
 * Exposto como window.slaAPI (contextIsolation). Só os canais desta janela; nada mais.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("slaAPI", {
  onCard: (cb: (view: unknown) => void) => ipcRenderer.on("slareminder-card", (_e, v) => cb(v)),
  rendered: (key: string) => ipcRenderer.send("slareminder-rendered", key),
  resize: (h: number) => ipcRenderer.send("slareminder-resize", h),
  ok: (key: string) => ipcRenderer.send("slareminder-ok", key),
  open: (deep: string) => ipcRenderer.send("slareminder-open", deep),
});
