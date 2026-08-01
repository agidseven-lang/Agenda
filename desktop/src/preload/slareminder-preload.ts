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
  // F3.5.4P — decisão do responsável (transação), dismiss e resolução de destinatário da ajuda
  decide: (payload: unknown) => ipcRenderer.send("slareminder-decide", payload),
  onResult: (cb: (result: unknown) => void) => ipcRenderer.on("slareminder-result", (_e, r) => cb(r)),
  dismiss: (key: string) => ipcRenderer.send("slareminder-dismiss", key),
  resolveHelp: (req: unknown) => ipcRenderer.send("slareminder-resolve-help", req),
  onHelpCandidates: (cb: (cands: unknown) => void) => ipcRenderer.on("slareminder-help-candidates", (_e, c) => cb(c)),
  // F3.5.4Q — check-in de tarefa parada (4 decisões, rascunho, dismiss, resolução de ajuda)
  checkinDecide: (payload: unknown) => ipcRenderer.send("slareminder-checkin-decide", payload),
  onCheckinResult: (cb: (result: unknown) => void) => ipcRenderer.on("slareminder-checkin-result", (_e, r) => cb(r)),
  checkinDraft: (req: unknown) => ipcRenderer.send("slareminder-checkin-draft", req),
  checkinDismiss: (key: string) => ipcRenderer.send("slareminder-checkin-dismiss", key),
  checkinResolveHelp: (req: unknown) => ipcRenderer.send("slareminder-checkin-resolve-help", req),
  onCheckinHelpCandidates: (cb: (cands: unknown) => void) => ipcRenderer.on("slareminder-checkin-help-candidates", (_e, c) => cb(c)),
});
