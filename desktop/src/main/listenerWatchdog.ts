/**
 * F3.5.4N — listenerWatchdog.ts — SUPERVISÃO de saúde + ÚLTIMO RECURSO (NÃO é o reconectador).
 * =====================================================================================
 * O reconectador PRIMÁRIO é o firebase.ts (re-attach com backoff 5s→60s, timer ÚNICO por coleção,
 * resetado no 1º snapshot saudável). Este watchdog:
 *   - APENAS OBSERVA os sinais REAIS emitidos pelo firebase.ts (attach/snapshot/error/rearm+geração)
 *     e o estado de rede/energia — NÃO cria um segundo ciclo de reconexão;
 *   - reflete a saúde (STARTING/HEALTHY/IDLE_HEALTHY/OFFLINE/RECONNECTING/DEGRADED/FAILED/
 *     STOPPED_BY_LOGOUT/STOPPED_BY_QUIT);
 *   - reconcilia UMA vez (idempotente; recibos/dedup do notifier evitam duplicação) em
 *     reconexão/resume/unlock;
 *   - só como ÚLTIMO RECURSO, quando o re-attach do firebase falha de forma SUSTENTADA (DEGRADED),
 *     dispara UM ÚNICO restart completo (restartAll injetado pelo main, que PARA a geração antiga
 *     ANTES de iniciar a nova) — nunca um loop concorrente, nunca dois restarts simultâneos.
 * "Sem novos eventos" (snapshot ocioso) NUNCA é falha (IDLE_HEALTHY).
 *
 * Timers: o ÚNICO timer deste módulo é o de último recurso (≤1 por vez), armado só em DEGRADED e
 * limpo em qualquer snapshot saudável/offline/suspend/teardown. O timer de reconexão continua sendo
 * exclusivamente o do firebase.ts. Controlador PURO/injetável → testável.
 */
import { diag } from "./diag";

export type WatchdogState =
  | "STARTING" | "HEALTHY" | "IDLE_HEALTHY" | "OFFLINE" | "RECONNECTING"
  | "DEGRADED" | "FAILED" | "STOPPED_BY_LOGOUT" | "STOPPED_BY_QUIT";

export type ListenHealthSignal = { col: string; event: "attach" | "snapshot" | "error" | "rearm"; attempt: number; generation: number; size?: number; changes?: number };

export type WatchdogDeps = {
  restartAll: (reason: string) => void;   // ÚLTIMO RECURSO: main PARA a geração antiga e inicia UMA nova.
  reconcileAll: (reason: string) => void; // idempotente (drain; recibos/dedup impedem duplicação).
  isAuthValid: () => boolean;
  isOnline: () => boolean;
  selfHealingEnabled: () => boolean;      // flag notificationSelfHealingEnabled (OFF ⇒ nunca restart)
  onAdminAlert?: (info: { generation: number; reasonCode: string; attempts: number }) => void;
  onLog?: (tag: string, data?: unknown) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (h: any) => void;
  degradedAttempt?: number;   // attempt do firebase que caracteriza DEGRADED (default 4 ⇒ ~35s+ falhando)
  lastResortMs?: number;      // espera após DEGRADED antes de 1 restart de último recurso (default 120s)
  maxLastResortPerWindow?: number; // teto de últimos recursos até um snapshot saudável (default 3)
};

export function createListenerWatchdog(deps: WatchdogDeps) {
  const log = deps.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const now = deps.now || (() => Date.now());
  const setTimer = deps.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer || ((h: any) => clearTimeout(h));
  const degradedAttempt = deps.degradedAttempt || 4;
  const lastResortMs = deps.lastResortMs || 120000;
  const maxLastResort = deps.maxLastResortPerWindow || 3;

  let state: WatchdogState = "STARTING";
  let stopped = false;
  let sawHealthy = false;
  let lastResortTimer: any = null;   // ÚNICO timer do watchdog (≤1)
  let restarting = false;            // impede restart reentrante/simultâneo
  let lastResortCount = 0;
  let degradedAlerted = false;
  const tele = { lastSnapshotAt: 0, lastErrorAt: 0, lastReconcileAt: 0, lastRestartAt: 0, restarts: 0, reconciliations: 0, maxAttempt: 0, currentGeneration: 0 };

  function setState(s: WatchdogState, reason?: string): void { if (state !== s) { state = s; log("listener.health." + s.toLowerCase(), { reason: reason || "", generation: tele.currentGeneration }); } }
  function clearLastResort(): void { if (lastResortTimer) { try { clearTimer(lastResortTimer); } catch { /* */ } lastResortTimer = null; } }

  /** Reconciliação idempotente (uma passada); recibos/dedup do notifier evitam duplicação. */
  function reconcileOnce(reason: string): void {
    if (stopped || !deps.isAuthValid() || !deps.isOnline()) return;
    try { deps.reconcileAll(reason); } catch { /* */ }
    tele.lastReconcileAt = now(); tele.reconciliations++;
    log("listener.reconcile.success", { reason, generation: tele.currentGeneration });
  }

  function enterDegraded(reasonCode: string, attempts: number): void {
    setState("DEGRADED", reasonCode);
    if (!degradedAlerted) { degradedAlerted = true; try { deps.onAdminAlert && deps.onAdminAlert({ generation: tele.currentGeneration, reasonCode, attempts }); } catch { /* */ } log("listener.admin.alerted", { reasonCode, attempts, generation: tele.currentGeneration }); }
    // ÚLTIMO RECURSO: arma NO MÁXIMO um timer; nunca concorre com o re-attach do firebase.
    if (!deps.selfHealingEnabled()) { log("listener.selfheal.disabled", {}); return; }
    if (lastResortTimer || restarting) return;                // já há (no máx.) um armado/executando
    if (lastResortCount >= maxLastResort) { log("listener.lastresort.capped", { lastResortCount }); return; }
    // Se o firebase se curar nesse meio-tempo, o handler de snapshot chama clearLastResort() e este
    // callback NUNCA roda (timer removido). Portanto, se ele RODA, nenhum snapshot chegou na janela
    // ⇒ falha sustentada real. Ainda assim re-checa parada/flag/auth/rede antes do único restart.
    lastResortTimer = setTimer(() => {
      lastResortTimer = null;
      if (stopped || !deps.selfHealingEnabled()) return;
      if (!deps.isAuthValid()) { setState("FAILED", "auth_invalid"); return; }
      if (!deps.isOnline()) { setState("OFFLINE", "offline"); return; }
      doLastResortRestart(reasonCode);
    }, lastResortMs);
    log("listener.lastresort.armed", { delayMs: lastResortMs, reasonCode });
  }

  /** UM restart completo (último recurso). restartAll (main) PARA a geração antiga ANTES da nova. */
  function doLastResortRestart(reasonCode: string): void {
    if (restarting) return;                                    // sem restart simultâneo
    restarting = true;
    lastResortCount++;
    tele.lastRestartAt = now(); tele.restarts++;
    setState("RECONNECTING", "last-resort");
    log("listener.restart.started", { reasonCode, attempt: lastResortCount, generation: tele.currentGeneration });
    try { deps.restartAll("watchdog-last-resort"); } catch (e) { log("listener.restart.failed", { err: String((e as any) && (e as any).message || e) }); }
    restarting = false; // restartAll é síncrono no main (para antiga → inicia nova); a saúde volta via snapshot
  }

  return {
    start(): void { if (stopped) return; sawHealthy = false; setState("STARTING", "start"); },

    /** Sinal REAL do firebase.ts. NÃO reconecta aqui (isso é do firebase); só observa/escala. */
    onHealth(sig: ListenHealthSignal): void {
      if (stopped || !sig) return;
      tele.currentGeneration = sig.generation || tele.currentGeneration;
      if (sig.event === "snapshot") {
        tele.lastSnapshotAt = now();
        clearLastResort();                 // firebase saudável ⇒ desarma último recurso
        degradedAlerted = false; lastResortCount = 0; restarting = false;
        if ((sig.changes || 0) > 0 || !sawHealthy) { sawHealthy = true; setState("HEALTHY", "snapshot"); }
        else setState("IDLE_HEALTHY", "idle");   // sem eventos novos NUNCA é falha
        return;
      }
      if (sig.event === "attach") { if (state !== "HEALTHY" && state !== "IDLE_HEALTHY") setState((sig.attempt || 0) > 0 ? "RECONNECTING" : "STARTING", "attach"); return; }
      if (sig.event === "error") {
        tele.lastErrorAt = now();
        if (!deps.isOnline()) { setState("OFFLINE", "offline"); return; }
        setState("RECONNECTING", "sdk-error"); // firebase.ts fará o re-attach (timer dele); watchdog só observa
        return;
      }
      if (sig.event === "rearm") {
        tele.maxAttempt = Math.max(tele.maxAttempt, sig.attempt || 0);
        if (!deps.isOnline()) { setState("OFFLINE", "offline"); return; }
        if ((sig.attempt || 0) >= degradedAttempt) enterDegraded("firestore_reattach_failing", sig.attempt || 0);
        else setState("RECONNECTING", "rearm");
      }
    },

    /** Rede: offline preserva cursores (sem churn); reconexão = reconcile ÚNICO (sem restart). */
    setNetwork(online: boolean): void {
      if (stopped) return;
      if (!online) { clearLastResort(); setState("OFFLINE", "offline"); return; }
      if (state === "OFFLINE" || state === "RECONNECTING" || state === "DEGRADED") { setState("RECONNECTING", "reconnect"); reconcileOnce("reconnect"); }
    },

    onResume(): void { if (stopped) return; reconcileOnce("resume"); },   // firebase re-attacha; só reconcilia 1x
    onUnlock(): void { if (stopped) return; reconcileOnce("unlock"); },
    onSuspend(): void { if (stopped) return; clearLastResort(); log("listener.suspend", {}); }, // pausa; não é falha

    onLogout(): void { clearLastResort(); restarting = false; sawHealthy = false; lastResortCount = 0; degradedAlerted = false; setState("STOPPED_BY_LOGOUT", "logout"); },
    onQuit(): void { stopped = true; clearLastResort(); setState("STOPPED_BY_QUIT", "quit"); },
    resetForLogin(): void { stopped = false; clearLastResort(); restarting = false; sawHealthy = false; lastResortCount = 0; degradedAlerted = false; state = "STARTING"; },

    snapshot(): { state: WatchdogState; lastResortArmed: boolean; restarting: boolean } & typeof tele {
      return Object.assign({ state, lastResortArmed: !!lastResortTimer, restarting }, tele);
    },
  };
}
