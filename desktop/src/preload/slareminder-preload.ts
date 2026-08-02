/**
 * F3.5.4L — slareminder-preload.ts — bridge MÍNIMO da janela do lembrete central de SLA.
 * Exposto como window.slaAPI (contextIsolation). Só os canais desta janela; nada mais.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("slaAPI", {
  onCard: (cb: (view: unknown) => void) => ipcRenderer.on("slareminder-card", (_e, v) => cb(v)),
  rendered: (key: string) => ipcRenderer.send("slareminder-rendered", key),
  resize: (h: number) => ipcRenderer.send("slareminder-resize", h),
  // F3.5.4U-H2 (processamento atômico): informa o main que uma ação está em PROCESSAMENTO ⇒ o main
  // CONGELA os bounds da janela (não faz setBounds/move enquanto processando), eliminando o artefato
  // de sobreposição (backing-store antigo) do redimensionamento da janela transparente durante o clique.
  setProcessing: (on: boolean) => ipcRenderer.send("slareminder-set-processing", !!on),
  // F3.5.4U-H2 (prova sanitizada no clique): contagens de DOM/janela — SEM nome/título/cliente/UID/conteúdo.
  obs: (payload: unknown) => ipcRenderer.send("slareminder-obs", payload),
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
