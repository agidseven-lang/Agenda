/**
 * F3.5.4L — slaReminder.ts — LEMBRETE CENTRAL PERSISTENTE de SLA (amarelo/vermelho).
 * =====================================================================================
 * SUPERFÍCIE NOVA e ISOLADA (≠ janela premium do canto inferior direito, que segue intacta p/
 * notificações comuns da 1.0.201). Autoridade no MAIN: funciona com o renderer principal
 * indisponível, minimizado, e fechado no X/tray. Uma única janela central por vez, always-on-top,
 * sem roubar foco, SEM auto-close/X/ESC/Alt+F4 — fecha só após OK, gravando o reconhecimento antes.
 *
 * Este arquivo tem DUAS partes:
 *   1) createSlaReminderController(opts) — MÁQUINA DE ESTADO PURA (fila/prioridade/promoção/ack/
 *      persistência/lock/reconcile). Recebe uma `surface` injetável ⇒ testável sem Electron.
 *   2) createSlaReminderSurface(deps) — superfície REAL Electron (BrowserWindow central, showInactive,
 *      screen-saver, focusable:false, render-proof → fallback nativa). Usada pelo main.
 *
 * REGRAS (mandato F3.5.4L): SLA é PESSOAL (o produtor já roteia só ao designer). Um alerta por
 * tarefa por vez (base=taskId:uid); VERMELHO supera/promeve o AMARELO da mesma base; prioridade
 * vermelho-mais-antigo → vermelhos → amarelo-mais-antigo → amarelos; contador de pendentes; OK
 * exige recibo durável ANTES de fechar; tela bloqueada ⇒ nativa persistente; unlock reexibe o
 * pendente; sem duplicação renderer/main/modal/nativa. NÃO altera status/prazo/conclusão da tarefa.
 */

export type ReminderLevel = "warning" | "critical";

export type ReminderView = {
  key: string;
  base: string;
  level: ReminderLevel;
  title: string;              // "ATENÇÃO" | "URGENTE"
  actorName: string;
  actorAvatar: string;
  taskTitle: string;
  clientName: string;
  body: string;
  context: string;
  deep: string;
  queueLen: number;
  soundDataUri: string;
};

/** Superfície injetável (produção = Electron; teste = fake que registra chamadas). */
export type ReminderSurface = {
  show: (view: ReminderView) => void;          // cria/exibe a janela central com este view
  promote: (view: ReminderView) => void;       // atualiza a MESMA janela (amarelo→vermelho) + som vermelho
  close: () => void;                           // destrói a janela (após ack)
  isOpen: () => boolean;
  native: (view: ReminderView) => boolean;     // fallback nativo persistente (lock / overlay bloqueado)
  onNoRender?: (key: string, cb: () => void) => void; // prova de render; se não renderizar, cb (fallback)
};

type QueueItem = { key: string; base: string; level: ReminderLevel; view: ReminderView; enqueuedAt: number; taskId: string };

export type SlaReminderControllerOpts = {
  surface: ReminderSurface;
  store: {
    isAcked: (k: string) => boolean;
    markPending: (rec: any) => void;
    removePending: (k: string) => void;
    markAck: (k: string, meta?: any) => void;
    listPending: () => any[];
  };
  now?: () => number;
  onLog?: (tag: string, data?: unknown) => void;
  appVersion?: string;
  isLocked?: () => boolean;
  taskValid?: (taskId: string, recipientUid: string) => boolean;  // tarefa ainda existe/pertinente/destinatário válido
  soundFor?: (level: ReminderLevel) => string;                    // data URI do som (main lê o .wav)
  getUid?: () => string;                                          // usuário logado (filtra reexibição de pendentes)
  onAcked?: (info: { key: string; level: ReminderLevel; actorName: string; taskTitle: string; taskId: string }) => void; // pós-OK (histórico do sino)
};

const LEVEL_RANK: Record<ReminderLevel, number> = { critical: 0, warning: 1 };

export function classifyReminderLevel(p: any): ReminderLevel | null {
  const et = String((p && p.eventType) || "");
  const isSla = /^sla_/.test(et) || et === "operational_block";
  if (!isSla) return null;
  const sev = String((p && p.severity) || "");
  return sev === "warning" ? "warning" : "critical"; // critical/overdue/operational_block ⇒ vermelho
}

export function createSlaReminderController(opts: SlaReminderControllerOpts) {
  const now = opts.now || (() => Date.now());
  const log = opts.onLog || (() => { /* */ });
  const surface = opts.surface;
  const store = opts.store;
  const appVersion = opts.appVersion || "";
  const isLocked = opts.isLocked || (() => false);
  const taskValid = opts.taskValid || (() => true);
  const soundFor = opts.soundFor || (() => "");
  const getUid = opts.getUid || (() => "");

  const queue: QueueItem[] = [];
  const completedTasks = new Set<string>();   // tarefas concluídas com modal aberto ⇒ suprime vermelho futuro
  let active: QueueItem | null = null;   // item atualmente exibido (ou em nativa quando locked)
  let stopped = false;

  function baseOf(p: any): string { return String((p && p.taskId) || "") + ":" + String((p && p.targetUserId) || (p && p.recipientUid) || ""); }
  function recipientOf(p: any): string { return String((p && p.targetUserId) || (p && p.recipientUid) || ""); }

  function buildView(p: any, level: ReminderLevel, queueLen: number): ReminderView {
    const title = level === "critical" ? "URGENTE" : "ATENÇÃO";
    return {
      key: String((p && p.dedupKey) || ""),
      base: baseOf(p),
      level,
      title,
      actorName: String((p && (p.responsibleName || p.actorName)) || ""),
      actorAvatar: String((p && (p.responsibleAvatar || p.actorAvatar)) || ""),
      taskTitle: String((p && p.taskTitle) || (p && p.subtitle) || "Tarefa"),
      clientName: String((p && p.clientName) || ""),
      body: String((p && p.body) || ""),
      context: String((p && p.context) || ""),
      deep: String((p && p.action && p.action.deep) || (p && p.taskId ? "detail/" + p.taskId : "")),
      queueLen,
      soundDataUri: soundFor(level),
    };
  }

  function pendingCount(): number { return (active ? 1 : 0) + queue.length; }

  /** Escolhe o próximo item por prioridade: vermelho-mais-antigo → vermelhos → amarelo-mais-antigo → amarelos. */
  function pickNextIndex(): number {
    if (!queue.length) return -1;
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[best], b = queue[i];
      if (LEVEL_RANK[b.level] < LEVEL_RANK[a.level]) best = i;
      else if (LEVEL_RANK[b.level] === LEVEL_RANK[a.level] && b.enqueuedAt < a.enqueuedAt) best = i;
    }
    return best;
  }

  function refreshCounter(): void {
    if (active) { active.view.queueLen = pendingCount(); try { surface.show(active.view); } catch { /* update contador é best-effort */ } }
  }

  function showNext(): void {
    if (stopped || active) return;
    const idx = pickNextIndex();
    if (idx < 0) { if (surface.isOpen()) { try { surface.close(); } catch { /* */ } } return; }
    const it = queue.splice(idx, 1)[0];
    // valida antes de exibir (tarefa concluída/removida/destinatário inválido ⇒ pula, sem emitir)
    if (!taskValid(String(it.view.deep.replace(/^detail\//, "") || it.key), recipientOf({ dedupKey: it.key, targetUserId: it.base.split(":")[1] }))) {
      log("sla.reminder.cancelled.completed", { key: mask(it.key), level: it.level });
      store.removePending(it.key);
      return showNext();
    }
    active = it;
    it.view.queueLen = pendingCount();
    if (isLocked()) {
      const ok = surface.native(it.view);
      log("sla.reminder.locked", { key: mask(it.key), level: it.level, nativeOk: ok });
      return; // permanece "active" até ack/unlock; não abre BrowserWindow sobre o lock
    }
    surface.show(it.view);
    log("sla.reminder.shown", { key: mask(it.key), level: it.level, queueLen: it.view.queueLen });
    log("sla.reminder.sound.played", { key: mask(it.key), level: it.level });
    if (surface.onNoRender) {
      surface.onNoRender(it.key, () => {
        try { const ok = surface.native(it!.view); log("sla.reminder.native.sent", { key: mask(it.key), nativeOk: ok }); }
        catch (e) { log("sla.reminder.native.failed", { key: mask(it.key), err: errMsg(e) }); }
      });
    }
  }

  return {
    /** Entrada do HUB: recebe um payload de SLA amarelo/vermelho já classificado. */
    enqueue(p: any): { ok: boolean; channel: string } {
      if (stopped) return { ok: false, channel: "none" };
      const level = classifyReminderLevel(p);
      if (!level) return { ok: false, channel: "not-sla" };
      const key = String((p && p.dedupKey) || "");
      if (!key) return { ok: false, channel: "none" };
      if (store.isAcked(key)) { log("sla.reminder.dedup.skipped", { key: mask(key), reason: "acked" }); return { ok: true, channel: "sla-acked" }; }
      const base = baseOf(p);
      // já na fila ou ativo com a MESMA chave ⇒ duplicata (unlock/resume/reconexão/replay)
      if ((active && active.key === key) || queue.some((q) => q.key === key)) {
        log("sla.reminder.dedup.skipped", { key: mask(key), reason: "inflight" }); return { ok: true, channel: "sla-dup" };
      }
      const taskId = String((p && p.taskId) || "");
      // tarefa concluída com modal aberto ⇒ não gerar o alerta vermelho futuro (mandato)
      if (level === "critical" && taskId && completedTasks.has(taskId)) {
        store.removePending(key); log("sla.reminder.cancelled.completed", { key: mask(key), reason: "completed-while-open" });
        return { ok: true, channel: "sla-cancelled" };
      }
      log("sla.reminder.detected", { key: mask(key), level, base: mask(base) });
      const view = buildView(p, level, 0);
      const item: QueueItem = { key, base, level, view, enqueuedAt: now(), taskId };
      // persiste como PENDENTE (reexibir no boot enquanto não reconhecido)
      store.markPending({ key, level, recipientUid: recipientOf(p), taskId: String(p.taskId || ""), eventId: String(p.eventId || key), base, payload: snapshot(p), shownAt: now() });

      // PROMOÇÃO amarelo→vermelho da MESMA base (não abrir 2ª janela; não 2 na fila)
      if (level === "critical") {
        // remove qualquer AMARELO pendente/na fila da mesma base
        for (let i = queue.length - 1; i >= 0; i--) { if (queue[i].base === base && queue[i].level === "warning") { store.removePending(queue[i].key); queue.splice(i, 1); } }
        if (active && active.base === base && active.level === "warning" && !isLocked()) {
          store.removePending(active.key);          // amarelo superado na tela pelo vermelho
          active = item;
          item.view.queueLen = pendingCount();
          surface.promote(item.view);
          log("sla.reminder.promoted", { from: "warning", to: "critical", key: mask(key), base: mask(base) });
          log("sla.reminder.sound.played", { key: mask(key), level });
          return { ok: true, channel: "sla-central-promoted" };
        }
      } else {
        // amarelo chegando com vermelho da mesma base já ativo/na fila ⇒ vermelho supera; ignora amarelo
        if ((active && active.base === base && active.level === "critical") || queue.some((q) => q.base === base && q.level === "critical")) {
          store.removePending(key);
          log("sla.reminder.dedup.skipped", { key: mask(key), reason: "superseded-by-red" });
          return { ok: true, channel: "sla-superseded" };
        }
      }

      queue.push(item);
      log("sla.reminder.queued", { key: mask(key), level, pending: pendingCount() });
      if (!active) showNext(); else refreshCounter();
      return { ok: true, channel: "sla-central" };
    },

    /** OK do usuário: grava recibo ANTES de fechar; mostra o próximo. */
    ack(key: string, windowState?: string): boolean {
      const k = String(key || "");
      if (!active || active.key !== k) {
        // ack de item não-ativo (defensivo): apenas persiste
        if (k) { store.markAck(k, { appVersion, windowState }); store.removePending(k); log("sla.reminder.ack.success", { key: mask(k), stale: true }); return true; }
        return false;
      }
      log("sla.reminder.ack.start", { key: mask(k), level: active.level });
      try {
        store.markAck(k, { recipientUid: active.base.split(":")[1], taskId: active.view.deep.replace(/^detail\//, ""), eventId: k, level: active.level, appVersion, windowState });
      } catch (e) { log("sla.reminder.ack.failed", { key: mask(k), err: errMsg(e) }); return false; }
      store.removePending(k);
      log("sla.reminder.ack.success", { key: mask(k), level: active.level });
      try { if (opts.onAcked) opts.onAcked({ key: k, level: active.level, actorName: active.view.actorName, taskTitle: active.view.taskTitle, taskId: active.taskId }); } catch { /* histórico nunca derruba o ack */ }
      active = null;
      try { surface.close(); } catch { /* */ }
      log("sla.reminder.closed", { key: mask(k) });
      showNext();
      return true;
    },

    /** Boot/unlock/resume: reexibe pendentes não reconhecidos ainda válidos, sem duplicar. */
    reconcile(reason?: string): void {
      if (stopped) return;
      const pend = store.listPending() || [];
      const uid = getUid();
      let re = 0;
      for (const rec of pend) {
        if (!rec || store.isAcked(rec.key)) continue;
        if (uid && String(rec.recipientUid || "") !== uid) continue;   // só pendentes do usuário logado
        if ((active && active.key === rec.key) || queue.some((q) => q.key === rec.key)) continue;
        const lvl: ReminderLevel = rec.level === "critical" ? "critical" : "warning";
        const view = buildView(rec.payload || { dedupKey: rec.key, taskId: rec.taskId, targetUserId: rec.recipientUid, severity: lvl }, lvl, 0);
        queue.push({ key: rec.key, base: rec.base || baseOf(rec.payload || {}), level: lvl, view, enqueuedAt: rec.shownAt || now(), taskId: String(rec.taskId || "") });
        re++;
      }
      log("sla.reminder.unlock.reshown", { reason: reason || "reconcile", reshown: re, pending: pendingCount() });
      // só reexibe/atualiza se algo NOVO entrou; reconcile sem novidade não reabre nem re-renderiza
      // (evita duplicação após unlock/resume/offline quando o ativo já está em tela).
      if (!active) showNext(); else if (re > 0) refreshCounter();
    },

    /** Mudança de sessão: lock ⇒ troca o ativo para nativa; unlock ⇒ reexibe pendente. */
    onLockChange(locked: boolean): void {
      if (locked) {
        if (active) { try { const ok = surface.native(active.view); log("sla.reminder.locked", { key: mask(active.key), nativeOk: ok, switched: true }); } catch (e) { log("sla.reminder.native.failed", { err: errMsg(e) }); } try { surface.close(); } catch { /* */ } }
      } else {
        // unlock: se havia ativo (mostrado em nativa), reabre central; e reconcilia pendentes
        if (active && !surface.isOpen()) { try { surface.show(active.view); log("sla.reminder.unlock.reshown", { key: mask(active.key), single: true }); } catch { /* */ } }
        this.reconcile("unlock");
      }
    },

    /** Tarefa concluída (por qualquer um): suprime vermelho futuro; se o modal ativo é dela, vira "concluída" mantendo OK. */
    noteCompleted(taskId: string): void {
      const t = String(taskId || ""); if (!t) return;
      completedTasks.add(t);
      for (let i = queue.length - 1; i >= 0; i--) { if (queue[i].taskId === t) { store.removePending(queue[i].key); queue.splice(i, 1); } }
      if (active && active.taskId === t) {
        active.view = Object.assign({}, active.view, { body: "Esta tarefa foi concluída enquanto o alerta estava aberto.", context: "" });
        try { surface.show(active.view); } catch { /* */ }
        log("sla.reminder.cancelled.completed", { key: mask(active.key), active: true });
      } else { refreshCounter(); }
    },
    status() { return { open: surface.isOpen(), activeKey: active ? mask(active.key) : "", queueLen: pendingCount() }; },
    _debug() { return { active, queue: queue.slice() }; },
    /** Logout / troca de usuário: fecha a janela e limpa a memória (store PRESERVADO; o próximo login reexibe os pendentes do novo uid). */
    clearActive() { try { surface.close(); } catch { /* */ } active = null; queue.length = 0; completedTasks.clear(); },
    stop() { stopped = true; try { surface.close(); } catch { /* */ } queue.length = 0; active = null; },
  };
}

function snapshot(p: any): any {
  if (!p || typeof p !== "object") return {};
  const keep = ["dedupKey", "eventId", "eventType", "severity", "taskId", "taskTitle", "clientName", "targetUserId", "responsibleName", "responsibleAvatar", "actorName", "actorAvatar", "title", "body", "context", "action", "subtitle"];
  const out: any = {}; for (const k of keep) if (p[k] !== undefined) out[k] = p[k]; return out;
}
function mask(s: string): string { const v = String(s || ""); return v.length <= 8 ? v : v.slice(0, 4) + "…" + v.slice(-4); }
function errMsg(e: unknown): string { try { return String((e as any) && (e as any).message || e); } catch { return "err"; } }
