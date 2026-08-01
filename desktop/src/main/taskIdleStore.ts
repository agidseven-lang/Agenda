/**
 * F3.5.4Q — taskIdleStore.ts — RECIBO DE CICLO EXIBIDO + FILA DURÁVEL DE RESPOSTA (offline).
 * =====================================================================================
 * Store LOCAL isolado do check-in de inatividade (arquivo próprio idseven-task-idle.json em
 * userData). NÃO toca o store de decisão de SLA (idseven-sla-reminder-ack.json permanece
 * byte-idêntico), NÃO cria coleção Firestore, NÃO toca rede. Dois conjuntos:
 *
 *   - shown:     { [idleCheckKey]: {shownAt,...} }  — ANTIASSÉDIO: o ciclo já foi exibido; não
 *     reexibir o MESMO ciclo (sobrevive a restart/reconexão/lock). Nova atividade ⇒ nova chave
 *     ⇒ novo ciclo (a chave inclui lastMeaningfulActivityAt + statusVersion + thresholdVersion).
 *   - responses: { [idleCheckKey]: IdleResponseRec } — idempotência local + fila offline. A
 *     resposta COMPARTILHADA (real, para todos) é a entrada task_idle_response gravada por
 *     TRANSAÇÃO no history[] da tarefa; este arquivo é APENAS controle local — nunca declaramos
 *     "compartilhada" com base nele.
 *       pending_sync : respondida localmente, aguardando confirmação da transação (fila offline);
 *       synced       : transação confirmada (este dispositivo gravou);
 *       superseded   : a transação retornou already_answered/activity_changed/task_* (superada).
 */
import fs from "fs";
import path from "path";
import os from "os";

export type IdleShownRec = { idleCheckKey: string; taskId: string; recipientUid: string; shownAt: number };

export type IdleResponseState = "pending_sync" | "synced" | "superseded";
export type IdleResponseRec = {
  idleCheckKey: string;
  state: IdleResponseState;
  responseType: string;               // working | blocked | help_requested | return_to_todo
  recipientUid: string;
  taskId: string;
  activityBoundaryVersion: number;    // lastMeaningfulActivityAt usado no cálculo
  payload: any;                       // resposta completa p/ re-dirigir a MESMA transação offline
  meta?: any;
  createdAt: number;
  updatedAt: number;
};

export type TaskIdleStore = {
  isShown: (idleCheckKey: string) => boolean;
  markShown: (rec: IdleShownRec) => void;
  getResponse: (idleCheckKey: string) => IdleResponseRec | null;
  isResponseSettled: (idleCheckKey: string) => boolean;   // synced || superseded
  markResponsePending: (rec: IdleResponseRec) => void;
  markResponseSynced: (idleCheckKey: string, meta?: any) => void;
  markResponseSuperseded: (idleCheckKey: string) => void;
  listResponsesPendingSync: () => IdleResponseRec[];
  _peek?: () => any;
};

type Shape = {
  shown?: Record<string, IdleShownRec>;
  responses?: Record<string, IdleResponseRec>;
};

const SHOWN_CAP = 5000, SHOWN_EVICT = 1500;
const RESP_CAP = 5000, RESP_EVICT = 1500;

export function createTaskIdleStore(opts?: { file?: string; log?: (t: string, d?: unknown) => void }): TaskIdleStore {
  const log = (opts && opts.log) || (() => { /* */ });
  let file = (opts && opts.file) || "";
  let mem: Shape = {};
  let loaded = false;

  function resolveFile(): string {
    if (file) return file;
    let dir = "";
    try { const app = require("electron").app; dir = (app && typeof app.getPath === "function") ? app.getPath("userData") : os.tmpdir(); }
    catch { dir = os.tmpdir(); }
    file = path.join(dir, "idseven-task-idle.json");
    return file;
  }
  function load(): void {
    if (loaded) return; loaded = true;
    try { const f = resolveFile(); if (f && fs.existsSync(f)) mem = JSON.parse(fs.readFileSync(f, "utf8")) || {}; } catch { mem = {}; }
    if (!mem || typeof mem !== "object") mem = {};
    if (!mem.shown || typeof mem.shown !== "object") mem.shown = {};
    if (!mem.responses || typeof mem.responses !== "object") mem.responses = {};
  }
  function save(): void {
    try { const f = resolveFile(); if (f) fs.writeFileSync(f, JSON.stringify(mem)); }
    catch (e) { try { log("task.idle.store.save.error", { err: String((e as any) && (e as any).message || e) }); } catch { /* */ } }
  }
  function evictShown(): void {
    const s = mem.shown!; const ks = Object.keys(s);
    if (ks.length <= SHOWN_CAP) return;
    ks.sort((a, b) => (s[a].shownAt || 0) - (s[b].shownAt || 0));
    for (let i = 0; i < SHOWN_EVICT; i++) delete s[ks[i]];
  }
  function evictResponses(): void {
    const d = mem.responses!; const ks = Object.keys(d);
    if (ks.length <= RESP_CAP) return;
    let toEvict = ks.length - (RESP_CAP - RESP_EVICT);
    const settled = ks.filter((k) => d[k] && d[k].state !== "pending_sync").sort((a, b) => (d[a].updatedAt || 0) - (d[b].updatedAt || 0));
    for (const k of settled) { if (toEvict <= 0) break; delete d[k]; toEvict--; }
    if (toEvict > 0) { const rest = Object.keys(d).sort((a, b) => (d[a].updatedAt || 0) - (d[b].updatedAt || 0)); for (const k of rest) { if (toEvict <= 0) break; delete d[k]; toEvict--; } }
  }

  return {
    isShown(idleCheckKey: string): boolean { load(); return !!(mem.shown && mem.shown[String(idleCheckKey || "")]); },
    markShown(rec: IdleShownRec): void {
      load();
      const k = String(rec && rec.idleCheckKey || ""); if (!k) return;
      if (mem.shown![k]) return;
      mem.shown![k] = { idleCheckKey: k, taskId: String(rec.taskId || ""), recipientUid: String(rec.recipientUid || ""), shownAt: Number(rec.shownAt) || Date.now() };
      evictShown();
      save();
    },
    getResponse(idleCheckKey: string): IdleResponseRec | null {
      load(); const k = String(idleCheckKey || ""); return (k && mem.responses![k]) ? mem.responses![k] : null;
    },
    isResponseSettled(idleCheckKey: string): boolean {
      load(); const r = mem.responses![String(idleCheckKey || "")];
      return !!(r && (r.state === "synced" || r.state === "superseded"));
    },
    markResponsePending(rec: IdleResponseRec): void {
      load();
      const k = String(rec && rec.idleCheckKey || ""); if (!k) return;
      const cur = mem.responses![k];
      if (cur && (cur.state === "synced" || cur.state === "superseded")) return;   // já final: nunca reabrir
      const nowMs = Date.now();
      mem.responses![k] = Object.assign({}, rec, {
        idleCheckKey: k, state: "pending_sync" as IdleResponseState,
        createdAt: (cur && cur.createdAt) || rec.createdAt || nowMs, updatedAt: nowMs,
      });
      evictResponses();
      save();
    },
    markResponseSynced(idleCheckKey: string, meta?: any): void {
      load(); const k = String(idleCheckKey || ""); if (!k) return;
      const cur = mem.responses![k] || ({} as IdleResponseRec);
      mem.responses![k] = Object.assign({}, cur, { idleCheckKey: k, state: "synced" as IdleResponseState, meta: (meta !== undefined ? meta : (cur as any).meta), updatedAt: Date.now() });
      save();
    },
    markResponseSuperseded(idleCheckKey: string): void {
      load(); const k = String(idleCheckKey || ""); if (!k) return;
      const cur = mem.responses![k] || ({} as IdleResponseRec);
      mem.responses![k] = Object.assign({}, cur, { idleCheckKey: k, state: "superseded" as IdleResponseState, updatedAt: Date.now() });
      save();
    },
    listResponsesPendingSync(): IdleResponseRec[] {
      load();
      return Object.keys(mem.responses!).map((k) => mem.responses![k]).filter((r) => r && r.state === "pending_sync").sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    },
    _peek(): any { load(); return mem; },
  };
}
