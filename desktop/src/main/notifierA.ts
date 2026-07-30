/**
 * F3.5.3 — notifierA.ts — PRODUTOR DURÁVEL da Categoria A (processo MAIN).
 * =====================================================================================
 * Substitui os produtores FILTRADOS u1/u1b/u3 do notifier (que entregavam só ao designer
 * atribuído / equipe da tarefa+supervisão, excluíam o ator e DESCARTAVAM tudo que ocorria
 * com o app fechado — baseline seed). Contrato F3.5.3:
 *
 *   1. ação real ocorre → o escritor grava o doc (history[]/designerAssignment — JÁ ACONTECE);
 *   2. evento canônico é DERIVADO do doc (notifEvents.deriveTaskEvents — durável);
 *   3. ESTE produtor (main, vivo na bandeja) entrega via HUB para o usuário logado —
 *      TODOS os usuários ativos recebem (cada Desktop logada entrega ao seu usuário;
 *      inativo não recebe porque não possui sessão válida — login/sessão bloqueiam);
 *   4. entrega aceita → recibo (userId+deviceId+eventId) + cursor avança;
 *   5. duplicações impedidas pelos recibos persistentes (restart/reconexão/replay);
 *   6. BACKLOG sem lacuna: o PRIMEIRO snapshot do listener já contém o estado completo
 *      (Firestore entrega o estado inicial como 'added') — os eventos perdidos com o
 *      computador desligado são re-derivados DESSE MESMO snapshot e entregues em ordem
 *      (asc por at) ANTES/junto dos ao-vivo; não existe janela entre backlog e listener
 *      porque ambos são o MESMO stream.
 *
 * Falha de entrega: NÃO marca recibo, NÃO avança cursor, PARA a fila (ordem preservada)
 * e re-tenta no próximo snapshot ou no re-eval de segurança (≤60s, local). Backoff do
 * transporte é o do próprio listener (firebase.ts, F3.4.7 re-attach 5s→60s).
 *
 * Janela de tolerância (LATE_GRACE): eventos com `at` até 48h ATRÁS do cursor ainda são
 * elegíveis (docs que sincronizam atrasados); recibos impedem duplicação nesse intervalo.
 * Retenção: eventos mais antigos que 30 dias não são recuperados (contrato).
 *
 * Read-side puro: NUNCA grava Firestore; nomes reais resolvidos via diretório usersPublic
 * (leitura permitida pelas Rules vivas). T-30/T-10 (Categoria B) NÃO passam por aqui.
 */
import { listen as fbListen } from "./firebase";
import { diag } from "./diag";
import { createNotifStore, NotifStore } from "./notifStore";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NE: any = require("./notifEvents");

type Deliver = (p: any) => { ok: boolean; channel?: string } | unknown;

export type NotifierAOpts = {
  listen?: (name: string, cb: (snap: any) => void) => (() => void);
  store?: NotifStore;
  now?: () => number;
  onLog?: (tag: string, data?: unknown) => void;
  retentionMs?: number;
  lateGraceMs?: number;
  safetyMaxMs?: number;
  setTimer?: (fn: () => void, ms: number) => any;
  clearTimer?: (h: any) => void;
};

const LATE_GRACE_MS_DEFAULT = 48 * 60 * 60 * 1000; // 48h de tolerância p/ docs atrasados

export function startNotifierA(uid: string, deliver: Deliver, opts?: NotifierAOpts): { stop: () => void; reconcile: (reason?: string) => void } {
  opts = opts || {};
  const log = opts.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const listen = opts.listen || fbListen;
  const store = opts.store || createNotifStore({ log });
  const now = opts.now || (() => Date.now());
  const retentionMs = opts.retentionMs || NE.RETENTION_MS_DEFAULT;
  const lateGraceMs = opts.lateGraceMs || LATE_GRACE_MS_DEFAULT;
  const SAFETY_MAX_MS = opts.safetyMaxMs || 60000;
  const setTimer = opts.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || ((h: any) => clearTimeout(h));

  const tasks = new Map<string, any>();
  const names = new Map<string, { name: string; photo: string }>();   // usersPublic: id -> {name, photo} (F3.5.3A: nome REAL + FOTO canônica do ator)
  let stopped = false;
  let timer: any = null;
  const deviceId = store.deviceId();

  log("notifA.start", { uid, deviceId: String(deviceId).slice(0, 8), cursorAt: store.cursorGet(uid), retentionMs, lateGraceMs });

  function resolveName(id: string): { name: string; photo: string } | null { return (id && names.get(String(id))) || null; }

  /** Fila elegível: derivada dos docs ATUAIS, filtrada por retenção+cursor(-grace)+recibos, asc. */
  function pendingEvents(): any[] {
    const t0 = now();
    const cursor = store.cursorGet(uid);
    const floor = Math.max(0, cursor - lateGraceMs);
    const out: any[] = [];
    tasks.forEach((t) => {
      let evs: any[] = [];
      try { evs = NE.deriveTaskEvents(t, { nowMs: t0, retentionMs }) || []; } catch (e) { log("notifA.derive.error", { taskId: t && t.id, err: String((e as any) && (e as any).message || e) }); }
      for (const ev of evs) {
        if (!ev || !ev.eventId || !ev.at) continue;
        if (ev.at <= floor) continue;                          // atrás da janela de tolerância
        if (store.receiptHas(uid, ev.eventId)) continue;       // já entregue neste user+device
        // F3.5.4F — task_updated é PESSOAL: entrega SOMENTE ao designer que estava atribuído
        // no momento da edição (recipientId gravado na própria entrada do doc). Nunca todos os
        // Designers; nunca o antigo após reatribuição; inativo não recebe (sem sessão). Os
        // eventos existentes (all_active_users) seguem byte-idênticos.
        if ((ev as any).recipientMode === "assigned_designer" && String((ev as any).recipientId || "") !== String(uid)) continue;
        out.push(ev);
      }
    });
    out.sort((a, b) => (a.at - b.at) || (a.eventId < b.eventId ? -1 : 1));
    return out;
  }

  /** Entrega em ORDEM; recibo+cursor só após aceite; falha PARA a fila (retry depois). */
  function drain(reason: string): void {
    if (stopped) return;
    const q = pendingEvents();
    if (!q.length) return;
    log("notifA.drain.begin", { reason, pending: q.length, cursorAt: store.cursorGet(uid) });
    let delivered = 0;
    for (const ev of q) {
      const p = NE.buildCategoryAPayload(ev, uid, resolveName);
      let accepted = false;
      try {
        const r: any = deliver(p);
        accepted = !(r && typeof r === "object" && (r as any).ok === false);
      } catch (e) { accepted = false; log("notifA.deliver.error", { eventId: ev.eventId, err: String((e as any) && (e as any).message || e) }); }
      if (!accepted) { log("notifA.deliver.retry", { eventId: ev.eventId }); break; } // ordem preservada; re-tenta depois
      store.receiptAdd(uid, ev.eventId);
      store.cursorSet(uid, ev.at);
      delivered++;
      log("notifA.emit", { eventId: ev.eventId, type: ev.type, taskId: ev.taskId, at: ev.at });
    }
    log("notifA.drain.end", { reason, delivered, remaining: q.length - delivered, cursorAt: store.cursorGet(uid) });
  }

  function arm(): void {
    if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
    if (stopped) return;
    timer = setTimer(() => { timer = null; drain("safety"); arm(); }, SAFETY_MAX_MS); // re-eval local ≤60s (retry de falhas)
  }

  // Diretório PII-free p/ nomes reais (leitura permitida pelas Rules vivas; nunca grava).
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

  // Tarefas: o 1º snapshot É o backlog (estado completo); os demais são o tempo real.
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
    } catch (e) { log("notifA.snapshot.error", { err: String((e as any) && (e as any).message || e) }); }
  });

  arm();

  return {
    stop(): void {
      stopped = true;
      if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
      try { unsubTasks(); } catch { /* */ }
      try { unsubUsers(); } catch { /* */ }
      log("notifA.stop", { uid });
    },
    reconcile(reason?: string): void { drain(reason || "reconcile"); },
  };
}
