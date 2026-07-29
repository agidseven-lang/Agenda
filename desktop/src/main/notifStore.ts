/**
 * F3.5.3 — notifStore.ts — CURSOR + RECIBOS + DEVICE ID persistentes (Categoria A).
 * =====================================================================================
 * Identidade composta do contrato: userId + deviceId + eventId.
 *  - deviceId: gerado UMA vez por instalação (crypto.randomUUID), persistido;
 *  - cursor POR USUÁRIO: maior `at` entregue de forma CONTÍGUA (só avança APÓS entrega aceita);
 *  - recibos POR USUÁRIO: { eventId: ts } — impedem duplicação (restart/reconexão/replay/
 *    janela recriada) mesmo com eventos fora de ordem dentro da janela de tolerância;
 *  - logout NÃO apaga cursor/recibos (ficam associados ao usuário; troca de usuário no MESMO
 *    computador não mistura nem apaga o histórico do outro).
 * Padrão de persistência: mesmo do seen-store aprovado do SLA (JSON em userData, capado,
 * gravação defensiva que nunca derruba a entrega). Arquivo separado: idseven-notif-cursor.json.
 */
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export type NotifStore = {
  deviceId: () => string;
  cursorGet: (uid: string) => number;
  cursorSet: (uid: string, at: number) => void;           // só avança (nunca retrocede)
  receiptHas: (uid: string, eventId: string) => boolean;
  receiptAdd: (uid: string, eventId: string) => void;
  _peek?: () => any;                                       // testes
};

type Shape = { deviceId?: string; users?: Record<string, { cursorAt?: number; receipts?: Record<string, number> }> };

const RECEIPTS_CAP = 5000;
const RECEIPTS_EVICT = 1500;

export function createNotifStore(opts?: { file?: string; log?: (t: string, d?: unknown) => void }): NotifStore {
  const log = (opts && opts.log) || (() => { /* */ });
  let file = (opts && opts.file) || "";
  let mem: Shape = {};
  let loaded = false;

  function resolveFile(): string {
    if (file) return file;
    let dir = "";
    try { const app = require("electron").app; dir = (app && typeof app.getPath === "function") ? app.getPath("userData") : os.tmpdir(); }
    catch { dir = os.tmpdir(); }
    file = path.join(dir, "idseven-notif-cursor.json");
    return file;
  }
  function load(): void {
    if (loaded) return; loaded = true;
    try { const f = resolveFile(); if (f && fs.existsSync(f)) mem = JSON.parse(fs.readFileSync(f, "utf8")) || {}; } catch { mem = {}; }
    if (!mem || typeof mem !== "object") mem = {};
    if (!mem.users || typeof mem.users !== "object") mem.users = {};
  }
  function save(): void {
    try { const f = resolveFile(); if (f) fs.writeFileSync(f, JSON.stringify(mem)); }
    catch (e) { try { log("notif.store.save.error", { err: String((e as any) && (e as any).message || e) }); } catch { /* */ } }
  }
  function userOf(uid: string): { cursorAt?: number; receipts?: Record<string, number> } {
    load();
    const u = String(uid || "");
    if (!mem.users![u] || typeof mem.users![u] !== "object") mem.users![u] = {};
    if (!mem.users![u].receipts || typeof mem.users![u].receipts !== "object") mem.users![u].receipts = {};
    return mem.users![u];
  }

  return {
    deviceId(): string {
      load();
      if (!mem.deviceId || typeof mem.deviceId !== "string" || mem.deviceId.length < 8) {
        mem.deviceId = (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"));
        save();
      }
      return mem.deviceId;
    },
    cursorGet(uid: string): number {
      const u = userOf(uid);
      const n = Number(u.cursorAt) || 0;
      return n > 0 ? n : 0;
    },
    cursorSet(uid: string, at: number): void {
      const u = userOf(uid);
      const n = Number(at) || 0;
      if (n > (Number(u.cursorAt) || 0)) { u.cursorAt = n; save(); }   // nunca retrocede
    },
    receiptHas(uid: string, eventId: string): boolean {
      const u = userOf(uid);
      return !!(u.receipts && u.receipts[String(eventId || "")]);
    },
    receiptAdd(uid: string, eventId: string): void {
      const u = userOf(uid);
      const k = String(eventId || "");
      if (!k) return;
      u.receipts![k] = Date.now();
      const ks = Object.keys(u.receipts!);
      if (ks.length > RECEIPTS_CAP) {
        ks.sort((a, b) => (u.receipts![a] || 0) - (u.receipts![b] || 0));
        for (let i = 0; i < RECEIPTS_EVICT; i++) delete u.receipts![ks[i]];
      }
      save();
    },
    _peek(): any { load(); return mem; },
  };
}
