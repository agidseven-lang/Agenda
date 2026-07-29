/**
 * F3.5.4-C3 — SEEN de SLA POR USUÁRIO (injetado em opts.seen do slaScheduler SEM tocar nos bytes
 * aprovados do scheduler nem de nenhum arquivo da Categoria B).
 * CAUSA PROVADA (1.0.193): o seen-set default era por MÁQUINA ({dedupKey:ts} em
 * idseven-sla-seen.json) e uma chave consumida sob um usuário engolia o MESMO boundary para OUTRO
 * usuário no mesmo computador (ex.: tarefa reatribuída a um designer que divide a máquina).
 * CORREÇÃO: as chaves passam a ser gravadas NAMESPACED ("<uid>|<dedupKey>") no MESMO arquivo; as
 * chaves LEGADAS (sem uid, pré-F3.5.4) seguem honradas em LEITURA — nenhum alerta antigo é
 * reemitido, nenhum recibo é apagado, nenhum cursor é resetado. T-30/T-10 continuam SÓ do
 * Designer atribuído (slaRules/cardsRules byte-idênticas).
 */
import fs from "fs";
import path from "path";
import os from "os";

export type SlaSeen = { has: (k: string) => boolean; add: (k: string) => void };

export function createUserSlaSeen(uid: string, opts?: { file?: string; log?: (t: string, d?: unknown) => void }): SlaSeen {
  const log = (opts && opts.log) || (() => { /* */ });
  let file = (opts && opts.file) || "";
  let mem: Record<string, number> = {};
  let loaded = false;
  function resolveFile(): string {
    if (file) return file;
    let dir = "";
    try { const app = require("electron").app; dir = (app && typeof app.getPath === "function") ? app.getPath("userData") : os.tmpdir(); }
    catch { dir = os.tmpdir(); }
    file = path.join(dir, "idseven-sla-seen.json");
    return file;
  }
  function load(): void {
    if (loaded) return; loaded = true;
    try { const f = resolveFile(); if (f && fs.existsSync(f)) mem = JSON.parse(fs.readFileSync(f, "utf8")) || {}; } catch { mem = {}; }
    if (!mem || typeof mem !== "object") mem = {};
  }
  function save(): void {
    try { const f = resolveFile(); if (f) fs.writeFileSync(f, JSON.stringify(mem)); }
    catch (e) { try { log("sla.seen.user.save.error", { err: String((e as any) && (e as any).message || e) }); } catch { /* */ } }
  }
  const ns = (k: string) => String(uid || "") + "|" + String(k || "");
  return {
    has(k: string): boolean { load(); return !!(mem[ns(k)] || mem[String(k || "")]); }, // legado (pré-F3.5.4) honrado em leitura
    add(k: string): void {
      load();
      mem[ns(k)] = Date.now();
      const ks = Object.keys(mem);
      if (ks.length > 3000) { ks.sort((a, b) => mem[a] - mem[b]); for (let i = 0; i < 1000; i++) delete mem[ks[i]]; }
      save();
    },
  };
}
