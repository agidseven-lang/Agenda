/**
 * F3.5.6A — workflowNotifier.ts — PRODUTOR DURÁVEL dos eventos de ORQUESTRAÇÃO (main).
 * =====================================================================================
 * Mesmo contrato aprovado do notifierA (F3.5.3): o LEDGER do doc (tasks.workflowEvents)
 * é a fonte durável; eventos são derivados de CADA snapshot (o 1º snapshot É o backlog);
 * entrega aceita ⇒ recibo (userId+deviceId+eventId) + cursor avança; falha ⇒ NÃO marca,
 * PARA a fila (ordem preservada) e re-tenta no próximo snapshot ou no re-eval ≤60s.
 * A decisão de política (destinatário/severidade/som/agregação/próxima ação) é do módulo
 * PURO workflowEvents.js; a ENTREGA é 100% do ingresso aprovado deliverNotification —
 * nenhum arquivo congelado é tocado.
 *
 * AGREGAÇÃO (mandato): DESIGNER_ITEM_COMPLETED em rajada NÃO dispara N notificações —
 * eventos elegíveis são coalescidos por tarefa numa janela curta (AGG_WINDOW_MS, janela de
 * coalescência de rajada — NÃO é prazo de fase) e entregues como UMA notificação
 * ("4 cards concluídos — Fulano concluiu 4 de 12"), pelo MESMO ingresso. Recibos são
 * marcados para TODOS os eventos coalescidos somente após o aceite da entrega única.
 */
import { listen as fbListen } from "./firebase";
import { diag } from "./diag";
import { createNotifStore, NotifStore } from "./notifStore";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WE: any = require("./workflowEvents");

type Deliver = (p: any) => { ok: boolean; channel?: string } | unknown;

export type WorkflowNotifierOpts = {
  listen?: (name: string, cb: (snap: any) => void) => (() => void);
  store?: NotifStore;
  now?: () => number;
  authUser?: () => { id?: string; role?: string; admin?: boolean } | null;
  onLog?: (tag: string, data?: unknown) => void;
  retentionMs?: number;
  lateGraceMs?: number;
  safetyMaxMs?: number;
  aggWindowMs?: number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (h: any) => void;
  storeFile?: string;
};

const LATE_GRACE_MS_DEFAULT = 48 * 60 * 60 * 1000;   // mesma tolerância da Categoria A
const AGG_WINDOW_MS_DEFAULT = 15000;                 // coalescência de rajada (não é prazo)

export function startWorkflowNotifier(uid: string, deliver: Deliver, opts?: WorkflowNotifierOpts): { stop: () => void; reconcile: (reason?: string) => void } {
  opts = opts || {};
  const log = opts.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const listen = opts.listen || fbListen;
  let storeFile = opts.storeFile || "";
  if (!storeFile) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const app = require("electron").app;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require("path");
      storeFile = path.join(app.getPath("userData"), "idseven-workflow-cursor.json");
    } catch { storeFile = ""; }
  }
  const store = opts.store || createNotifStore(storeFile ? { file: storeFile, log } : { log });
  const now = opts.now || (() => Date.now());
  const authUser = opts.authUser || (() => null);
  const retentionMs = opts.retentionMs || WE.WF_RETENTION_MS_DEFAULT;
  const lateGraceMs = opts.lateGraceMs || LATE_GRACE_MS_DEFAULT;
  const SAFETY_MAX_MS = opts.safetyMaxMs || 60000;
  const AGG_WINDOW_MS = opts.aggWindowMs || AGG_WINDOW_MS_DEFAULT;
  const setTimer = opts.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || ((h: any) => clearTimeout(h));

  const tasks = new Map<string, any>();
  const names = new Map<string, { name: string; photo: string }>();
  // buffer de rajada POR TAREFA: eventos agregáveis aguardando a janela fechar
  const aggBuf = new Map<string, { events: any[]; timer: any; firstAt: number }>();
  let stopped = false;
  let timer: any = null;
  const deviceId = store.deviceId();

  log("wfnotif.start", { uid, deviceId: String(deviceId).slice(0, 8), cursorAt: store.cursorGet(uid), retentionMs, aggWindowMs: AGG_WINDOW_MS });

  function resolveProfile(id: string): { name: string; photo: string } | null { return (id && names.get(String(id))) || null; }
  function ctx() { return { uid, user: (() => { try { return authUser() || null; } catch { return null; } })(), resolveProfile }; }

  /** Fila elegível PARA ESTE uid (política aplicada), sem recibo, dentro da tolerância; asc. */
  function pendingEvents(): Array<{ ev: any; t: any }> {
    const t0 = now();
    const cursor = store.cursorGet(uid);
    const floor = Math.max(0, cursor - lateGraceMs);
    const c = ctx();
    const out: Array<{ ev: any; t: any }> = [];
    tasks.forEach((t) => {
      let evs: any[] = [];
      try { evs = WE.deriveLedgerEvents(t, { nowMs: t0, retentionMs }) || []; } catch (e) { log("wfnotif.derive.error", { taskId: t && t.id, err: String((e as any) && (e as any).message || e) }); }
      for (const ev of evs) {
        if (!ev || !ev.id || !ev.at) continue;
        if (ev.at <= floor) continue;
        if (store.receiptHas(uid, "wf:" + ev.id)) continue;
        let ok = false;
        try { ok = WE.wfRecipientOk(ev, t, c) === true; } catch { ok = false; }
        if (!ok) continue;
        out.push({ ev, t });
      }
    });
    out.sort((a, b) => (a.ev.at - b.ev.at) || (a.ev.id < b.ev.id ? -1 : 1));
    return out;
  }

  function acceptDelivery(p: any): boolean {
    try {
      const r: any = deliver(p);
      return !(r && typeof r === "object" && (r as any).ok === false);
    } catch (e) { log("wfnotif.deliver.error", { dedupKey: p && p.dedupKey, err: String((e as any) && (e as any).message || e) }); return false; }
  }

  /** Entrega imediata (não agregável) OU roteia p/ o buffer de rajada (agregável). */
  function drain(reason: string): void {
    if (stopped) return;
    const q = pendingEvents();
    if (!q.length) return;
    log("wfnotif.drain.begin", { reason, pending: q.length, cursorAt: store.cursorGet(uid) });
    let delivered = 0;
    for (const it of q) {
      const ev = it.ev, t = it.t;
      if (WE.wfIsAggregatable(ev.type)) {
        // rajada: acumula na janela da tarefa; recibo SÓ quando o agregado for aceito.
        const key = String(t && t.id);
        let b = aggBuf.get(key);
        if (!b) { b = { events: [], timer: null, firstAt: now() }; aggBuf.set(key, b); b.timer = setTimer(() => flushAgg(key), AGG_WINDOW_MS); }
        if (!b.events.some((e) => e.id === ev.id)) b.events.push(ev);
        continue;
      }
      const p = WE.buildWorkflowPayload(ev, t, ctx(), null);
      if (!p) { store.receiptAdd(uid, "wf:" + ev.id); store.cursorSet(uid, ev.at); continue; }
      if (!acceptDelivery(p)) { log("wfnotif.deliver.retry", { id: ev.id }); break; }   // ordem preservada
      store.receiptAdd(uid, "wf:" + ev.id);
      store.cursorSet(uid, ev.at);
      delivered++;
      log("wfnotif.emit", { id: ev.id, type: ev.type, taskId: ev.taskId, at: ev.at });
    }
    log("wfnotif.drain.end", { reason, delivered, cursorAt: store.cursorGet(uid) });
  }

  /** Fecha a janela de rajada da tarefa: UMA notificação agregada (ou 1:1 se único). */
  function flushAgg(taskId: string): void {
    const b = aggBuf.get(taskId);
    if (!b) return;
    aggBuf.delete(taskId);
    if (b.timer) { try { clearTimer(b.timer); } catch { /* */ } b.timer = null; }
    if (stopped || !b.events.length) return;
    const t = tasks.get(taskId);
    if (!t) return;
    // re-filtra recibos (podem ter sido marcados por outro drain/flush concorrente)
    const evs = b.events.filter((e) => !store.receiptHas(uid, "wf:" + e.id)).sort((a, b2) => a.at - b2.at);
    if (!evs.length) return;
    const last = evs[evs.length - 1];
    const summary = WE.designItemsSummary(t);
    const designerName = (() => {
      try { const da = t.designerAssignment || {}; return String(da.designerName || ""); } catch { return ""; }
    })();
    const agg = { count: evs.length, done: (last.n > 0 ? last.n : summary.concluded), total: (last.tot > 0 ? last.tot : summary.total), designerName, lastId: last.id };
    const p = WE.buildWorkflowPayload(last, t, ctx(), agg);
    if (!p) return;
    if (!acceptDelivery(p)) {
      // falha: preserva TODOS (sem recibo) e re-agenda uma nova janela curta
      const nb = { events: evs, timer: null as any, firstAt: b.firstAt };
      aggBuf.set(taskId, nb);
      nb.timer = setTimer(() => flushAgg(taskId), Math.max(2000, Math.floor(AGG_WINDOW_MS / 3)));
      log("wfnotif.agg.retry", { taskId, count: evs.length });
      return;
    }
    let maxAt = 0;
    for (const e of evs) { store.receiptAdd(uid, "wf:" + e.id); if (e.at > maxAt) maxAt = e.at; }
    if (maxAt > 0) store.cursorSet(uid, maxAt);
    log("wfnotif.agg.emit", { taskId, count: evs.length, lastId: last.id });
  }

  function arm(): void {
    if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
    if (stopped) return;
    timer = setTimer(() => { timer = null; drain("safety"); arm(); }, SAFETY_MAX_MS);
  }

  const unsubUsers = listen("usersPublic", (snap: any) => {
    if (stopped) return;
    try {
      const changes = (snap && snap.docChanges && snap.docChanges()) || [];
      for (const ch of changes) {
        const id = ch && ch.doc && ch.doc.id; if (!id) continue;
        if (ch.type === "removed") names.delete(id);
        else { const d: any = (ch.doc.data && ch.doc.data()) || {}; if (d && d.name) names.set(id, { name: String(d.name), photo: String(d.photo || "") }); }
      }
    } catch { /* diretório nunca derruba a entrega */ }
  });

  const unsubTasks = listen("tasks", (snap: any) => {
    if (stopped) return;
    try {
      const changes = (snap && snap.docChanges && snap.docChanges()) || [];
      for (const ch of changes) {
        const id = ch && ch.doc && ch.doc.id; if (!id) continue;
        if (ch.type === "removed") tasks.delete(id);
        else tasks.set(id, Object.assign({ id }, (ch.doc.data && ch.doc.data()) || {}));
      }
      drain("snapshot");
    } catch (e) { log("wfnotif.snapshot.error", { err: String((e as any) && (e as any).message || e) }); }
  });

  arm();

  return {
    stop(): void {
      stopped = true;
      if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
      aggBuf.forEach((b) => { if (b.timer) { try { clearTimer(b.timer); } catch { /* */ } } });
      aggBuf.clear();
      try { unsubTasks(); } catch { /* */ }
      try { unsubUsers(); } catch { /* */ }
      log("wfnotif.stop", { uid });
    },
    reconcile(reason?: string): void { drain(reason || "reconcile"); },
  };
}
