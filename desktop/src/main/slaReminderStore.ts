/**
 * F3.5.4L — slaReminderStore.ts — RECIBO DE RECONHECIMENTO (OK) + PENDENTES PERSISTENTES.
 * =====================================================================================
 * Conceito NOVO e distinto do seen-store (que dedup a EMISSÃO) e dos recibos da Categoria A:
 *   - "seen" (idseven-sla-seen.json)      = o boundary JÁ FOI ENTREGUE a este usuário;
 *   - "reminder ack" (ESTE arquivo)       = o usuário CLICOU OK naquele lembrete central.
 * Um lembrete pode estar ENTREGUE (seen) e ainda NÃO reconhecido (sem ack) — é exatamente o
 * caso que deve SOBREVIVER a reload/minimizar/X/offline/suspend/lock/restart e ser reexibido.
 *
 * Por isso guardamos DOIS conjuntos no MESMO arquivo (padrão defensivo do notifStore, JSON em
 * userData, capado, gravação que nunca derruba a entrega):
 *   - acked:   { [reminderKey]: ackAt }         — reconhecido; nunca reexibir;
 *   - pending: { [reminderKey]: {snapshot...} } — mostrado e AINDA não reconhecido (reexibir no boot).
 * reminderKey := payload.dedupKey (já inclui taskId:uid:finishMs:rev:nível). Ack e pending são
 * POR CHAVE (logo, por destinatário e por marco): amarelo e vermelho da mesma tarefa são chaves
 * distintas ⇒ reconhecer o amarelo não reconhece o vermelho.
 *
 * NÃO cria coleção no Firestore, NÃO toca rede — arquivo local idseven-sla-reminder-ack.json.
 */
import fs from "fs";
import path from "path";
import os from "os";

export type ReminderPendingRec = {
  key: string;
  level: "warning" | "critical";
  recipientUid: string;
  taskId: string;
  eventId: string;
  base: string;              // taskId:uid — agrupa amarelo/vermelho da mesma tarefa (promoção)
  payload: any;              // snapshot mínimo p/ reexibir no boot
  shownAt: number;
};

export type ReminderAckMeta = {
  recipientUid?: string;
  taskId?: string;
  eventId?: string;
  level?: string;
  appVersion?: string;
  windowState?: string;
};

/**
 * F3.5.4P — RECIBO/FILA DURÁVEL DE DECISÃO DE SLA (idempotência local + fila offline).
 * decisionKey := sla_decision:<taskId>:<alertLevel>:<boundaryVersion>:<recipientUid> — POR ALERTA+DESTINATÁRIO
 * (NÃO inclui o tipo: uma ÚNICA decisão por alerta). Este registro é APENAS controle LOCAL de idempotência e
 * fila offline; a decisão COMPARTILHADA é a entrada sla_decision gravada por TRANSAÇÃO no history[] da tarefa
 * (fonte da verdade real, tempo real, para todos). Nunca declaramos "compartilhada" com base neste arquivo.
 *   - pending_sync : decidida localmente, aguardando a confirmação da TRANSAÇÃO no Firestore (fila offline);
 *   - synced       : transação confirmada (este dispositivo venceu / gravou o marco);
 *   - superseded   : a transação retornou already_decided (outro dispositivo já respondeu) — local superada.
 */
export type SlaDecisionState = "pending_sync" | "synced" | "superseded";
export type SlaDecisionRec = {
  decisionKey: string;
  state: SlaDecisionState;
  decisionType: string;
  alertLevel: "warning" | "critical";
  boundaryVersion: string;
  recipientUid: string;
  taskId: string;
  payload: any;            // decisão + destinatário (help/blocked) p/ re-dirigir a MESMA transação offline
  meta?: any;
  createdAt: number;
  updatedAt: number;
};

export type SlaReminderStore = {
  isAcked: (key: string) => boolean;
  markPending: (rec: ReminderPendingRec) => void;
  removePending: (key: string) => void;
  markAck: (key: string, meta?: ReminderAckMeta) => void;
  listPending: () => ReminderPendingRec[];
  // F3.5.4P — decisão durável (idempotência local + fila offline; NÃO é a decisão compartilhada)
  getDecision: (decisionKey: string) => SlaDecisionRec | null;
  isDecisionSettled: (decisionKey: string) => boolean;   // synced || superseded (estado final)
  markDecisionPending: (rec: SlaDecisionRec) => void;     // enfileira p/ sincronizar (offline)
  markDecisionSynced: (decisionKey: string, meta?: any) => void;
  markDecisionSuperseded: (decisionKey: string) => void;
  listDecisionsPendingSync: () => SlaDecisionRec[];
  _peek?: () => any;
};

type Shape = {
  acked?: Record<string, number>;
  ackMeta?: Record<string, ReminderAckMeta & { ackAt: number }>;
  pending?: Record<string, ReminderPendingRec>;
  decisions?: Record<string, SlaDecisionRec>;
};

const ACK_CAP = 5000, ACK_EVICT = 1500;
const PENDING_CAP = 400, PENDING_EVICT = 100;
const DECISION_CAP = 5000, DECISION_EVICT = 1500;

export function createSlaReminderStore(opts?: { file?: string; log?: (t: string, d?: unknown) => void }): SlaReminderStore {
  const log = (opts && opts.log) || (() => { /* */ });
  let file = (opts && opts.file) || "";
  let mem: Shape = {};
  let loaded = false;

  function resolveFile(): string {
    if (file) return file;
    let dir = "";
    try { const app = require("electron").app; dir = (app && typeof app.getPath === "function") ? app.getPath("userData") : os.tmpdir(); }
    catch { dir = os.tmpdir(); }
    file = path.join(dir, "idseven-sla-reminder-ack.json");
    return file;
  }
  function load(): void {
    if (loaded) return; loaded = true;
    try { const f = resolveFile(); if (f && fs.existsSync(f)) mem = JSON.parse(fs.readFileSync(f, "utf8")) || {}; } catch { mem = {}; }
    if (!mem || typeof mem !== "object") mem = {};
    if (!mem.acked || typeof mem.acked !== "object") mem.acked = {};
    if (!mem.ackMeta || typeof mem.ackMeta !== "object") mem.ackMeta = {};
    if (!mem.pending || typeof mem.pending !== "object") mem.pending = {};
    if (!mem.decisions || typeof mem.decisions !== "object") mem.decisions = {};
  }
  function save(): void {
    try { const f = resolveFile(); if (f) fs.writeFileSync(f, JSON.stringify(mem)); }
    catch (e) { try { log("sla.reminder.store.save.error", { err: String((e as any) && (e as any).message || e) }); } catch { /* */ } }
  }
  function evictDecisions(): void {
    const d = mem.decisions!; const ks = Object.keys(d);
    if (ks.length <= DECISION_CAP) return;
    let toEvict = ks.length - (DECISION_CAP - DECISION_EVICT);
    // Descartar SETTLED mais antigos primeiro; nunca perder pending_sync enquanto houver settled a remover.
    const settled = ks.filter((k) => d[k] && d[k].state !== "pending_sync").sort((a, b) => (d[a].updatedAt || 0) - (d[b].updatedAt || 0));
    for (const k of settled) { if (toEvict <= 0) break; delete d[k]; toEvict--; }
    if (toEvict > 0) { const rest = Object.keys(d).sort((a, b) => (d[a].updatedAt || 0) - (d[b].updatedAt || 0)); for (const k of rest) { if (toEvict <= 0) break; delete d[k]; toEvict--; } }
  }

  return {
    isAcked(key: string): boolean { load(); return !!(mem.acked && mem.acked[String(key || "")]); },
    markPending(rec: ReminderPendingRec): void {
      load();
      const k = String(rec && rec.key || "");
      if (!k) return;
      if (mem.acked![k]) return;                 // já reconhecido: nunca vira pendente de novo
      mem.pending![k] = rec;
      const ks = Object.keys(mem.pending!);
      if (ks.length > PENDING_CAP) {
        ks.sort((a, b) => (mem.pending![a].shownAt || 0) - (mem.pending![b].shownAt || 0));
        for (let i = 0; i < PENDING_EVICT; i++) delete mem.pending![ks[i]];
      }
      save();
    },
    removePending(key: string): void {
      load(); const k = String(key || ""); if (mem.pending![k]) { delete mem.pending![k]; save(); }
    },
    markAck(key: string, meta?: ReminderAckMeta): void {
      load();
      const k = String(key || ""); if (!k) return;
      mem.acked![k] = Date.now();
      mem.ackMeta![k] = Object.assign({}, meta || {}, { ackAt: Date.now() });
      if (mem.pending![k]) delete mem.pending![k];
      const ks = Object.keys(mem.acked!);
      if (ks.length > ACK_CAP) {
        ks.sort((a, b) => (mem.acked![a] || 0) - (mem.acked![b] || 0));
        for (let i = 0; i < ACK_EVICT; i++) { const kk = ks[i]; delete mem.acked![kk]; if (mem.ackMeta![kk]) delete mem.ackMeta![kk]; }
      }
      save();
    },
    listPending(): ReminderPendingRec[] {
      load();
      return Object.keys(mem.pending!).map((k) => mem.pending![k]).filter((r) => r && !mem.acked![r.key]).sort((a, b) => (a.shownAt || 0) - (b.shownAt || 0));
    },
    getDecision(decisionKey: string): SlaDecisionRec | null {
      load(); const k = String(decisionKey || ""); return (k && mem.decisions![k]) ? mem.decisions![k] : null;
    },
    isDecisionSettled(decisionKey: string): boolean {
      load(); const r = mem.decisions![String(decisionKey || "")];
      return !!(r && (r.state === "synced" || r.state === "superseded"));
    },
    markDecisionPending(rec: SlaDecisionRec): void {
      load();
      const k = String(rec && rec.decisionKey || ""); if (!k) return;
      const cur = mem.decisions![k];
      if (cur && (cur.state === "synced" || cur.state === "superseded")) return;   // já final: nunca reabrir
      const nowMs = Date.now();
      mem.decisions![k] = Object.assign({}, rec, {
        decisionKey: k, state: "pending_sync" as SlaDecisionState,
        createdAt: (cur && cur.createdAt) || rec.createdAt || nowMs, updatedAt: nowMs,
      });
      evictDecisions();
      save();
    },
    markDecisionSynced(decisionKey: string, meta?: any): void {
      load(); const k = String(decisionKey || ""); if (!k) return;
      const cur = mem.decisions![k] || ({} as SlaDecisionRec);
      mem.decisions![k] = Object.assign({}, cur, { decisionKey: k, state: "synced" as SlaDecisionState, meta: (meta !== undefined ? meta : (cur as any).meta), updatedAt: Date.now() });
      save();
    },
    markDecisionSuperseded(decisionKey: string): void {
      load(); const k = String(decisionKey || ""); if (!k) return;
      const cur = mem.decisions![k] || ({} as SlaDecisionRec);
      mem.decisions![k] = Object.assign({}, cur, { decisionKey: k, state: "superseded" as SlaDecisionState, updatedAt: Date.now() });
      save();
    },
    listDecisionsPendingSync(): SlaDecisionRec[] {
      load();
      return Object.keys(mem.decisions!).map((k) => mem.decisions![k]).filter((r) => r && r.state === "pending_sync").sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    },
    _peek(): any { load(); return mem; },
  };
}
