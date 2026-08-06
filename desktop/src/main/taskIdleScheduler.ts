/**
 * F3.5.4Q — taskIdleScheduler.ts — PRODUTOR ISOLADO DO CHECK-IN DE TAREFA PARADA (MAIN).
 * =====================================================================================
 * Por que ISOLADO (e não dentro do slaScheduler): o produtor de SLA (slaScheduler/notifierA) é
 * CONGELADO byte-a-byte (Golden Masters + gate CONGELADOS). Para não tocá-lo, o check-in tem seu
 * PRÓPRIO produtor, com a MESMA arquitetura já aprovada: um listener Firestore via o wrapper
 * compartilhado (firebase.listen, long-polling + auto-heal) + um MAPA de tasks por docChanges + UM
 * ÚNICO setTimeout auto-reagendável (teto 60s). NÃO cria 2º watchdog (reusa o auto-heal do
 * firebase.listen + o restartAll do watchdog existente, ao qual o main religa este listener) e NÃO
 * cria 2ª fila (emite para a MESMA janela central via slaReminderController.enqueueCheckin).
 *
 * Emite um check-in SOMENTE quando, para o USUÁRIO LOGADO nesta máquina:
 *   - a flag taskIdleDetectionEnabled está ON (isEnabled);
 *   - a tarefa é elegível (taskIdle.isIdleEligible: existe, não concluída/removida, em "andamento",
 *     responsável válido, última atividade confiável, limite atingido);
 *   - o responsável da tarefa É o usuário logado (recipientUid === getUid) — cada um só é lembrado
 *     das SUAS tarefas;
 *   - o ciclo ainda NÃO foi exibido (store.isShown — antiassédio, 1 por ciclo, sobrevive a restart);
 *   - o ciclo ainda NÃO foi respondido (store.isResponseSettled);
 *   - NÃO há alerta amarelo/vermelho ativo/na fila (isCentralBusy) — prioridade do SLA.
 *
 * Read-side puro: NUNCA grava Firestore; a resposta é gravada por TRANSAÇÃO (renderer) só quando o
 * usuário decide. Aqui só se DETECTA e ENFILEIRA a pergunta.
 */
import { listen as fbListen } from "./firebase";
import { diag } from "./diag";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TI: any = require("./taskIdle");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const S: any = require("./slaRules");

type IdlePayload = { dedupKey?: string; eventType?: string; taskId?: string; [k: string]: unknown };
type Emit = (p: IdlePayload) => { ok?: boolean; channel?: string } | unknown;

export type TaskIdleSchedulerOpts = {
  now?: () => number;                                    // "agora" canônico (offset do clockSync)
  listen?: (name: string, cb: (snap: any) => void) => (() => void); // default firebase.listen
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (h: any) => void;
  onLog?: (tag: string, data?: unknown) => void;
  safetyMaxMs?: number;                                  // teto do timer (default 60000)
  isEnabled?: () => boolean;                             // flag taskIdleDetectionEnabled (default ON)
  isCentralBusy?: () => boolean;                         // há amarelo/vermelho ativo/na fila? (default false)
  store: {
    // ANTIASSÉDIO/idempotência: uma resposta em QUALQUER estado (pending_sync/synced/superseded) ⇒ o
    // ciclo já foi respondido ⇒ NÃO reemitir. Um check-in NÃO respondido é PERSISTENTE: o scheduler
    // reemite e o controlador DEDUPLICA (ativo/na fila) — sem duplicar; reaparece só se a janela sumiu
    // (restart) e o ciclo continua não respondido.
    getResponse: (k: string) => any;
    markShown: (rec: { idleCheckKey: string; taskId: string; recipientUid: string; shownAt: number }) => void;
  };
  // F3.5.5A — orquestrador de EXECUÇÃO acoplado (evolução DESTE mecanismo; sem 2º listener/timer/fila).
  // Todos opcionais e no-op por default ⇒ ausentes/OFF, o comportamento é o de 1.0.216.
  execution?: {
    legacyGate?: (task: any) => boolean;                  // false ⇒ produtor legado SUPRIMIDO p/ a tarefa (ACTIVE+elegível: autoridade única adaptativa)
    onTasks?: (tasks: Map<string, any>) => void;          // espelho do MESMO mapa (mesmo listener)
    onEvaluate?: () => void;                              // avaliação adaptativa no MESMO tick do timer único
    extraBoundary?: () => number;                         // próximo checkpoint planejado integra o MESMO arm()
  };
};

function humanSince(mins: number): string {
  const m = Math.max(0, Math.floor(mins || 0));
  if (m < 60) return m + (m === 1 ? " minuto" : " minutos");
  const h = Math.floor(m / 60), r = m % 60;
  if (!r) return h + (h === 1 ? " hora" : " horas");
  return h + "h " + r + "min";
}

/** Monta o payload do check-in (view azul) a partir da tarefa + elegibilidade. */
export function buildCheckinPayload(task: any, elig: any, nowMs: number): IdlePayload {
  let resp: any = { id: "", name: "", avatar: "" };
  try { resp = (S.notifResponsibleDenorm ? S.notifResponsibleDenorm(task) : resp) || resp; } catch { /* */ }
  const taskId = String((task && task.id) || "");
  const since = humanSince(elig.inactivityMinutes);
  return {
    // identidade / roteamento (dedup no HUB pela dedupKey = idleCheckKey)
    kind: "checkin",
    eventType: "task_idle_checkin",
    dedupKey: String(elig.idleCheckKey || ""),
    idleCheckKey: String(elig.idleCheckKey || ""),
    taskId,
    taskTitle: String((task && task.title) || "Tarefa"),
    clientName: String((task && task.client) || ""),
    recipientUid: String(elig.recipientUid || ""),
    responsibleId: String(resp.id || ""),
    responsibleName: String(resp.name || ""),
    responsibleAvatar: String(resp.avatar || ""),
    actorName: String(resp.name || ""),
    actorAvatar: String(resp.avatar || ""),
    etapa: "Em andamento",
    status: "andamento",
    inactivityMinutes: Number(elig.inactivityMinutes) || 0,
    sinceText: since,
    statusVersion: String(elig.statusVersion || ""),
    activityBoundaryVersion: Number(elig.lastActivityAtMs) || 0,
    thresholdVersion: String(TI.THRESHOLD_VERSION || ""),
    severity: "info",
    action: { type: "detail", deep: taskId ? "detail/" + taskId : "" },
    source: "desktop-1.0.207",
    createdAt: Number(nowMs) || 0,
  };
}

export function startTaskIdleScheduler(getUid: () => string | null, emit: Emit, opts: TaskIdleSchedulerOpts): { stop: () => void; reconcile: (reason?: string) => void } {
  const log = (opts && opts.onLog) || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const now = (opts && opts.now) || (() => Date.now());
  const listen = (opts && opts.listen) || fbListen;
  const setTimer = (opts && opts.setTimer) || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = (opts && opts.clearTimer) || ((h: any) => clearTimeout(h));
  const SAFETY_MAX_MS = (opts && opts.safetyMaxMs) || 60000;
  const isEnabled = (opts && opts.isEnabled) || (() => true);
  const isCentralBusy = (opts && opts.isCentralBusy) || (() => false);
  const store = opts.store;
  const exec = (opts && opts.execution) || null;          // F3.5.5A — hooks opcionais (no-op ausentes)

  const tasks = new Map<string, any>();
  let timer: any = null;
  let stopped = false;

  log("task.idle.scheduler.start", { safetyMaxMs: SAFETY_MAX_MS, thresholdVersion: TI.THRESHOLD_VERSION });

  function evalDue(): void {
    if (stopped) return;
    // F3.5.5A — avaliação adaptativa no MESMO tick (antes do gate legado: o modo de execução tem
    // flag própria e o próprio orquestrador decide claim/supressão/SHADOW; no-op quando ausente/OFF).
    try { if (exec && exec.onEvaluate) exec.onEvaluate(); } catch { /* nunca derruba o legado */ }
    if (!isEnabled()) { log("task.idle.feature_disabled", {}); return; }
    const uid = (getUid && getUid()) || "";
    if (!uid) return;
    const t0 = now();
    if (isCentralBusy()) { log("task.idle.check_suspended_for_sla", { nowMs: t0 }); return; } // prioridade SLA
    tasks.forEach((task) => {
      if (stopped) return;
      let elig: any = null;
      try { elig = TI.isIdleEligible(task, t0); } catch (e) { log("task.idle.eval.error", { taskId: task && task.id, err: String((e as any) && (e as any).message || e) }); return; }
      if (!elig) return;
      log("task.idle.evaluation_started", { taskId: task && task.id, reason: elig.reason });
      if (!elig.eligible) { log("task.idle.not_eligible", { taskId: task && task.id, reason: elig.reason }); return; }
      if (String(elig.recipientUid || "") !== uid) return;              // só as tarefas DESTE usuário
      // F3.5.5A — autoridade ÚNICA por tarefa: ACTIVE+elegível ⇒ o adaptativo é o único produtor
      // (NUNCA dois check-ins p/ a mesma tarefa). OFF/SHADOW/inelegível ⇒ legado segue normal.
      try { if (exec && exec.legacyGate && exec.legacyGate(task) === false) { log("task.idle.suppressed_by_execution_authority", { taskId: task && task.id }); return; } } catch { /* */ }
      const key = String(elig.idleCheckKey || "");
      if (!key) return;
      if (store.getResponse(key)) return;                                // já respondido (pending_sync/synced/superseded) ⇒ não reemitir (o controlador deduplica o não respondido)
      log("task.idle.activity_resolved", { taskId: task && task.id, source: elig.lastActivitySource, inactivityMinutes: elig.inactivityMinutes });
      log("task.idle.threshold_reached", { taskId: task && task.id, thresholdMs: elig.thresholdMs });
      const payload = buildCheckinPayload(task, elig, t0);
      let accepted = false;
      try { const r: any = emit(payload); accepted = !(r && typeof r === "object" && r.ok === false); }
      catch (e) { log("task.idle.emit.error", { key, err: String((e as any) && (e as any).message || e) }); accepted = false; }
      if (accepted) {
        store.markShown({ idleCheckKey: key, taskId: String(task.id || ""), recipientUid: uid, shownAt: t0 });
        log("task.idle.check_created", { key, taskId: task && task.id, inactivityMinutes: elig.inactivityMinutes });
      } else {
        log("task.idle.emit.retry", { key });
      }
    });
  }

  function nextBoundary(): number {
    const uid = (getUid && getUid()) || "";
    if (!uid) return 0;
    const t0 = now();
    let best = 0;
    tasks.forEach((task) => {
      let b = 0;
      try { b = Number(TI.idleNextBoundaryMs(task, t0)) || 0; } catch { b = 0; }
      if (b > t0 && (!best || b < best)) best = b;
    });
    // F3.5.5A — próximo checkpoint de execução integra o MESMO timer (sem 2º scheduler).
    try { const eb = (exec && exec.extraBoundary && Number(exec.extraBoundary())) || 0; if (eb > t0 && (!best || eb < best)) best = eb; } catch { /* */ }
    return best;
  }

  function arm(): void {
    if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
    if (stopped) return;
    const t0 = now();
    const b = nextBoundary();
    const delay = b > 0 ? Math.max(250, Math.min(b - t0 + 120, SAFETY_MAX_MS)) : SAFETY_MAX_MS;
    log("task.idle.timer.arm", { boundaryMs: b, delayMs: delay, nowMs: t0, tasks: tasks.size });
    timer = setTimer(() => { timer = null; onFire(); }, delay);
  }
  function onFire(): void { if (stopped) return; evalDue(); arm(); }

  function reconcile(reason?: string): void {
    if (stopped) return;
    log("task.idle.reconcile", { reason: reason || "reconcile", tasks: tasks.size });
    evalDue(); arm();
  }

  const unsub = listen("tasks", (snap: any) => {
    if (stopped) return;
    try {
      const changes = (snap && snap.docChanges && snap.docChanges()) || [];
      for (const ch of changes) {
        const id = ch && ch.doc && ch.doc.id;
        if (!id) continue;
        if (ch.type === "removed") tasks.delete(id);
        else {
          const d = Object.assign({ id }, (ch.doc.data && ch.doc.data()) || {});
          // F3.5.5E — módulo retirado NUNCA entra no mapa do check-in NEM do Acompanhamento
          // (exec.onTasks recebe ESTE MESMO mapa). Chave canônica de setor; nada é apagado no banco.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          let retired = false; try { retired = !!require("./notifEvents").isRetiredSector(String((d as any).sector || "")); } catch { retired = false; }
          if (retired) tasks.delete(id); else tasks.set(id, d);
        }
      }
      try { if (exec && exec.onTasks) exec.onTasks(tasks); } catch { /* */ }   // F3.5.5A — MESMO mapa/listener
      reconcile("snapshot");
    } catch (e) { log("task.idle.snapshot.error", { err: String((e as any) && (e as any).message || e) }); }
  });

  try { if (exec && exec.onTasks) exec.onTasks(tasks); } catch { /* */ }     // F3.5.5A — referência do MESMO mapa
  reconcile("boot");

  return {
    stop(): void {
      stopped = true;
      if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
      try { unsub(); } catch { /* */ }
      log("task.idle.scheduler.stop", {});
    },
    reconcile,
  };
}
