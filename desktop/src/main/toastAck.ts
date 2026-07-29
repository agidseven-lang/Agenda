/**
 * F3.5.3 — toastAck.ts — PROVA DE RENDER do TOAST in-app (paridade com o ACK da bg-window).
 * =====================================================================================
 * Causa corrigida: o HUB enviava "notif-toast" ao renderer e marcava a entrega como vista
 * IMEDIATAMENTE, sem prova de render (o caminho background já tinha ACK desde a F3.4.7; o
 * toast NÃO). Renderer com falha silenciosa (listener ainda não registrado, erro de JS,
 * recarga) = notificação perdida PARA SEMPRE com a janela aberta.
 *
 * Contrato: arm(key, onNoAck) arma um prazo; ack(key) cancela; sem ACK no prazo, onNoAck
 * dispara UMA única vez (fallback bg-window/nativa do chamador). clear() no teardown.
 * Puro (timers injetáveis) — testável sem Electron.
 */
export type ToastAckTracker = {
  arm: (key: string, onNoAck: () => void) => void;
  ack: (key: string) => boolean;
  pending: () => number;
  clear: () => void;
};

export function createToastAckTracker(opts?: {
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (h: any) => void;
  onLog?: (tag: string, data?: unknown) => void;
}): ToastAckTracker {
  const timeoutMs = (opts && opts.timeoutMs) || 4000;
  const setTimer = (opts && opts.setTimer) || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = (opts && opts.clearTimer) || ((h: any) => clearTimeout(h));
  const log = (opts && opts.onLog) || (() => { /* */ });
  const pend = new Map<string, { timer: any; onNoAck: () => void }>();

  function cancel(key: string): boolean {
    const p = pend.get(key);
    if (!p) return false;
    try { clearTimer(p.timer); } catch { /* */ }
    pend.delete(key);
    return true;
  }
  return {
    arm(key: string, onNoAck: () => void): void {
      if (!key) return;
      cancel(key); // rearmar substitui o prazo anterior (um card por dedupKey)
      const timer = setTimer(() => {
        pend.delete(key);
        try { log("toast.ack.timeout", { dedupKey: key, timeoutMs }); } catch { /* */ }
        try { onNoAck(); } catch { /* fallback nunca derruba o main */ }
      }, timeoutMs);
      pend.set(key, { timer, onNoAck });
    },
    ack(key: string): boolean {
      const ok = cancel(String(key || ""));
      if (ok) { try { log("toast.ack.ok", { dedupKey: key }); } catch { /* */ } }
      return ok;
    },
    pending(): number { return pend.size; },
    clear(): void { pend.forEach((p) => { try { clearTimer(p.timer); } catch { /* */ } }); pend.clear(); },
  };
}
