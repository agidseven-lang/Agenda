/**
 * F3.5.4N — listenerWatchdog.ts — SUPERVISÃO DE SAÚDE + AUTOCORREÇÃO do canal de notificações.
 * =====================================================================================
 * Camada NOVA no processo MAIN. NÃO substitui o listener atual (notifierA/slaScheduler): apenas
 * SUPERVISIONA a saúde e, diante de falha REAL, recria uma NOVA geração do listener existente,
 * garantindo UMA única assinatura ativa, backoff controlado e reconciliação única. A entrega,
 * os recibos, o cursor e a deduplicação continuam 100% no notifierA/notifStore (congelados) —
 * este módulo só chama o start/stop/reconcile que já existem.
 *
 * Controlador PURO e injetável (sem Electron): testável por unidade com timers/rede/auth fakes.
 *
 * Estados (contrato F3.5.4N):
 *   STARTING · HEALTHY · IDLE_HEALTHY · OFFLINE · RECONNECTING · DEGRADED · FAILED ·
 *   STOPPED_BY_LOGOUT · STOPPED_BY_QUIT
 *
 * Regra de ouro: "sem novos eventos" NÃO é falha (IDLE_HEALTHY). Só é falha um sinal REAL
 * (erro do Firestore/assinatura caída) com auth válida e rede on-line — nunca logout/quit/
 * instalação de update/suspensão/rede caída.
 *
 * Backoff: tentativa 1 imediata · 2 após 5s · 3 após 15s · 4 após 30s · demais ≤1/min.
 * Após N falhas consecutivas na janela → DEGRADED + alerta ao admin (uma vez), mantendo
 * tentativas controladas (≤1/min). Nunca loop infinito.
 */
import { diag } from "./diag";

export type WatchdogState =
  | "STARTING" | "HEALTHY" | "IDLE_HEALTHY" | "OFFLINE" | "RECONNECTING"
  | "DEGRADED" | "FAILED" | "STOPPED_BY_LOGOUT" | "STOPPED_BY_QUIT";

/** Handle de UMA geração do listener (o que notifierA/slaScheduler já expõem). */
export type ListenerHandle = { stop: () => void; reconcile: (reason?: string) => void };

export type WatchdogDeps = {
  /** Cria/inicia uma NOVA geração do listener (main.ts injeta: start notifierA+slaScheduler). */
  spawn: (generation: number) => ListenerHandle;
  isAuthValid: () => boolean;         // sessão válida? (sem auth ⇒ não recria; espera login)
  isOnline: () => boolean;            // rede on-line? (offline ⇒ não churn de listeners)
  selfHealingEnabled: () => boolean;  // feature flag notificationSelfHealingEnabled (ON=autocorrige)
  onAdminAlert?: (info: { consecutiveFailures: number; reasonCode: string; generation: number }) => void;
  onLog?: (tag: string, data?: unknown) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (h: any) => void;
  backoffMs?: number[];               // default [0,5000,15000,30000]
  minIntervalMs?: number;             // teto p/ tentativas seguintes (default 60000)
  degradedAfter?: number;             // falhas consecutivas p/ DEGRADED (default 4)
};

const DEFAULT_BACKOFF = [0, 5000, 15000, 30000];
const NON_FAILURE = new Set(["logout", "quit", "update", "suspend"]); // encerramentos/pausas legítimas

export function createListenerWatchdog(deps: WatchdogDeps) {
  const log = deps.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const now = deps.now || (() => Date.now());
  const setTimer = deps.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer || ((h: any) => clearTimeout(h));
  const backoff = deps.backoffMs && deps.backoffMs.length ? deps.backoffMs.slice() : DEFAULT_BACKOFF.slice();
  const minInterval = deps.minIntervalMs || 60000;
  const degradedAfter = deps.degradedAfter || 4;

  let state: WatchdogState = "STARTING";
  let generation = 0;
  let handle: ListenerHandle | null = null;
  let consecutiveFailures = 0;
  let restartTimer: any = null;
  let stopped = false;
  let alertedForBurst = false;
  const tele = {
    lastActivityAt: 0, lastFailureAt: 0, lastFailureReason: "",
    lastRestartAt: 0, lastRecoveryAt: 0, lastReconcileAt: 0,
    recoveredEvents: 0, duplicateEvents: 0, restarts: 0,
  };

  function setState(s: WatchdogState, reasonCode?: string): void {
    if (state === s) return;
    state = s;
    log("listener.health." + s.toLowerCase(), { generation, reasonCode: reasonCode || "", consecutiveFailures });
  }

  function clearRestart(): void { if (restartTimer) { try { clearTimer(restartTimer); } catch { /* */ } restartTimer = null; } }

  /** Garante assinatura ÚNICA: encerra a geração vigente antes de qualquer nova. */
  function stopCurrent(): void {
    if (handle) { try { handle.stop(); } catch { /* */ } handle = null; }
  }

  /** Sobe uma NOVA geração (única). Chamado no start inicial e em cada autocorreção. */
  function spawnGeneration(kind: "start" | "restart"): void {
    stopCurrent();
    generation += 1;
    if (kind === "restart") { tele.lastRestartAt = now(); tele.restarts += 1; log("listener.restart.started", { generation }); }
    setState("STARTING");
    try {
      handle = deps.spawn(generation);
      log(kind === "start" ? "listener.health.starting" : "listener.restart.started", { generation });
    } catch (e) {
      handle = null;
      log("listener.restart.failed", { generation, err: String((e as any) && (e as any).message || e) });
      registerFailure("spawn_error");
    }
  }

  function scheduleRestart(reasonCode: string): void {
    if (stopped) return;
    if (!deps.selfHealingEnabled()) { log("listener.health.failed", { generation, reasonCode, selfHealing: false }); setState("FAILED", reasonCode); return; }
    clearRestart();
    const idx = consecutiveFailures; // 0-based → 1ª tentativa usa backoff[0]=imediata
    const delay = idx < backoff.length ? backoff[idx] : minInterval;
    setState("RECONNECTING", reasonCode);
    log("listener.restart.requested", { generation, reasonCode, attempt: consecutiveFailures + 1, delayMs: delay });
    restartTimer = setTimer(() => {
      restartTimer = null;
      if (stopped) return;
      if (!deps.isAuthValid()) { log("listener.restart.skip", { why: "no_auth" }); setState("FAILED", "auth_invalid"); return; }
      if (!deps.isOnline()) { setState("OFFLINE", "offline"); return; } // rede caiu no meio: espera reconexão
      spawnGeneration("restart");
    }, delay);
  }

  /** Contabiliza uma falha REAL e decide DEGRADED/alerta + reagenda. */
  function registerFailure(reasonCode: string): void {
    consecutiveFailures += 1;
    tele.lastFailureAt = now(); tele.lastFailureReason = reasonCode;
    log("listener.health.failed", { generation, reasonCode, consecutiveFailures });
    if (consecutiveFailures >= degradedAfter) {
      setState("DEGRADED", reasonCode);
      if (!alertedForBurst) { alertedForBurst = true; try { deps.onAdminAlert && deps.onAdminAlert({ consecutiveFailures, reasonCode, generation }); } catch { /* */ } log("listener.admin.alerted", { consecutiveFailures, reasonCode, generation }); }
    }
    scheduleRestart(reasonCode);
  }

  return {
    /** Início inicial (chamado no login/boot com auth válida). */
    start(): void {
      if (stopped) return;
      if (!deps.isAuthValid()) { log("listener.start.skip", { why: "no_auth" }); return; }
      consecutiveFailures = 0; alertedForBurst = false;
      spawnGeneration("start");
    },

    /** Primeiro snapshot/atividade real ⇒ saudável; zera falhas; se veio de restart, reconcilia 1x. */
    noteHealthy(fromRestart?: boolean): void {
      if (stopped) return;
      const wasRecovering = state === "STARTING" || state === "RECONNECTING" || state === "DEGRADED" || fromRestart === true;
      consecutiveFailures = 0; alertedForBurst = false;
      tele.lastActivityAt = now();
      setState("HEALTHY");
      if (wasRecovering && handle) {
        tele.lastRecoveryAt = now();
        log("listener.restart.success", { generation });
        try { handle.reconcile("watchdog-recovery"); } catch { /* */ }
        tele.lastReconcileAt = now();
        log("listener.reconcile.success", { generation, reason: "recovery" });
      }
    },

    /** Assinatura viva porém sem eventos novos: NÃO é falha. */
    noteIdle(): void { if (stopped) return; if (state === "HEALTHY" || state === "IDLE_HEALTHY" || state === "STARTING") { tele.lastActivityAt = now(); setState("IDLE_HEALTHY"); } },

    /** Erro REAL vindo da assinatura/transporte. Classifica antes de recriar. */
    noteError(reasonCode: string): void {
      if (stopped) return;
      const rc = String(reasonCode || "unknown");
      if (NON_FAILURE.has(rc)) { log("listener.error.ignored", { reasonCode: rc }); return; }
      if (!deps.isAuthValid()) { setState("FAILED", "auth_invalid"); return; }   // sem sessão: espera login (não churn)
      if (!deps.isOnline()) { setState("OFFLINE", "offline"); return; }          // rede caída: trata como OFFLINE
      registerFailure(rc);
    },

    /** Rede: offline preserva cursores/recibos (sem churn); reconexão = 1 assinatura + reconcile único. */
    setNetwork(online: boolean): void {
      if (stopped) return;
      if (!online) { clearRestart(); setState("OFFLINE", "offline"); log("listener.health.offline", { generation }); return; }
      // reconectou
      if (state === "OFFLINE" || state === "RECONNECTING" || state === "FAILED" || state === "DEGRADED") {
        if (!deps.isAuthValid()) { setState("FAILED", "auth_invalid"); return; }
        setState("RECONNECTING", "reconnect");
        // se a assinatura ainda existe, só reconcilia 1x; senão recria única.
        if (handle) { try { handle.reconcile("reconnect"); } catch { /* */ } tele.lastReconcileAt = now(); log("listener.reconcile.success", { generation, reason: "reconnect" }); setState("HEALTHY"); }
        else { consecutiveFailures = 0; spawnGeneration("restart"); }
      }
    },

    onSuspend(): void { if (stopped) return; clearRestart(); log("listener.suspend", { generation }); }, // pausa checagens agressivas; não é falha
    onResume(): void {
      if (stopped) return;
      if (!deps.isAuthValid()) { setState("FAILED", "auth_invalid"); return; }
      if (!deps.isOnline()) { setState("OFFLINE", "offline"); return; }
      if (handle) { try { handle.reconcile("resume"); } catch { /* */ } tele.lastReconcileAt = now(); log("listener.reconcile.success", { generation, reason: "resume" }); if (state !== "HEALTHY") setState("HEALTHY"); }
      else { spawnGeneration("restart"); }
    },
    onUnlock(): void {
      if (stopped) return;
      if (handle && deps.isAuthValid() && deps.isOnline()) { try { handle.reconcile("unlock"); } catch { /* */ } tele.lastReconcileAt = now(); log("listener.reconcile.success", { generation, reason: "unlock" }); }
    },

    onLogout(): void { stopped = false; clearRestart(); stopCurrent(); consecutiveFailures = 0; alertedForBurst = false; setState("STOPPED_BY_LOGOUT"); },
    onQuit(): void { stopped = true; clearRestart(); stopCurrent(); setState("STOPPED_BY_QUIT"); },

    /** Reinício explícito por troca de usuário (novo login recria com auth novo). */
    resetForLogin(): void { stopped = false; clearRestart(); stopCurrent(); consecutiveFailures = 0; alertedForBurst = false; state = "STARTING"; },

    /** Contadores p/ o painel de diagnóstico (sanitizados). */
    snapshot(): { state: WatchdogState; generation: number; consecutiveFailures: number } & typeof tele {
      return Object.assign({ state, generation, consecutiveFailures }, tele);
    },
  };
}
