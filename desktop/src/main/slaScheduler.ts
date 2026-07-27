/**
 * F3.4.3 — slaScheduler.ts — PRODUTOR AUTORITATIVO DE SLA no PROCESSO MAIN.
 * =====================================================================================
 * O main NUNCA é suspenso pelo Chromium (ao contrário do renderer minimizado/bandeja),
 * então ele é a ÚNICA fonte confiável das notificações amarela/vermelha/crítica de SLA.
 *
 * Arquitetura:
 *  - Reaproveita o listener Firestore do MAIN (firebase.ts, long-polling) na coleção "tasks".
 *  - Mantém um MAPA de tasks a partir de docChanges() (added/modified/removed).
 *  - "Agora" canônico injetável (opts.now — offset do clockSync); default Date.now.
 *  - A cada mudança de snapshot E a cada reconcile(): calcula slaRules.slaEmissionsFor(task,uid,now)
 *    por task; entrega (deliver) UMA vez cada payload cujo boundary já foi atingido e cujo
 *    dedupKey ainda não foi visto (seen-set PERSISTENTE em userData, capado).
 *  - Arma UM ÚNICO setTimeout auto-reagendável para o PRÓXIMO boundary futuro (amarelo/vermelho/
 *    crítico) entre todas as tasks elegíveis, capado em 60s (≤1/min re-eval de segurança, LOCAL,
 *    sem rede). Ao disparar: reavalia (entrega os vencidos) e re-arma. Cancela/re-arma a cada
 *    mudança de tasks (prazo, conclusão, cancelamento, reatribuição, perda de elegibilidade, deleção).
 *  - reconcile(reason): reavalia tudo e re-arma; chamado no boot e exposto p/ boot/login/restart/
 *    resume/unlock (main.ts). Boundaries vencidos-mas-não-vistos são entregues EXATAMENTE UMA vez.
 *
 * Contrato de suspensão do Windows: NÃO afirma que timers rodam durante o sleep; o reconcile no
 * resume/unlock entrega os boundaries perdidos uma única vez. SEM bloqueio de suspensão de energia,
 * SEM prevenção de sleep, SEM polling agressivo (event-driven + boundary setTimeout + 1 re-eval ≤60s
 * que só reagenda). O renderer congela oculto; o main, não — por isso o produtor vive aqui.
 *
 * Read-side puro: NUNCA grava Firestore, NUNCA chama provider/FCM/WebPush/WhatsApp.
 */
import fs from "fs";
import path from "path";
import os from "os";
import { listen as fbListen } from "./firebase";
import { diag } from "./diag";

// slaRules.js é CommonJS puro (sem .d.ts): require dinâmico evita resolução de tipos e é o MESMO
// caminho relativo que o build copia p/ dist/main/slaRules.js (build:renderer → copy-renderer.js).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const slaRules: any = require("./slaRules");

type NotifPayload = { dedupKey?: string; eventType?: string; taskId?: string; [k: string]: unknown };
type Deliver = (p: NotifPayload) => unknown;

export type SeenStore = { has: (k: string) => boolean; add: (k: string) => void };

export type SlaSchedulerOpts = {
  now?: () => number;                                    // "agora" canônico (offset do clockSync)
  listen?: (name: string, cb: (snap: any) => void) => (() => void); // default: firebase.listen
  seen?: SeenStore;                                      // default: arquivo JSON em userData (capado)
  setTimer?: (fn: () => void, ms: number) => any;        // default: setTimeout (injetável p/ testes)
  clearTimer?: (h: any) => void;                         // default: clearTimeout
  onLog?: (tag: string, data?: unknown) => void;         // diag sanitizado
  safetyMaxMs?: number;                                  // teto do timer auto-reagendável (default 60000)
  // F3.4.3 — papel AUTENTICADO do usuário logado (auth-core getUserSelf/login → {id,role,admin}),
  // usado SÓ para o gate canSeeAll do operational_block. null enquanto o papel não é confirmado.
  authUser?: () => { id: string; role: string; admin: boolean } | null;
  // F3.5.2 — produtor ISOLADO de Edição de Cards. INJETÁVEL só para teste (mock explícito). Em
  // PRODUÇÃO opts.cardsRules é undefined ⇒ require("./cardsRules") RÍGIDO (falha alto se o módulo não
  // estiver empacotado — jamais no-op silencioso). O build exige cardsRules.js no app.asar.
  cardsRules?: { cardsEmissionsFor: (task: any, uid: string, now: number) => NotifPayload[]; cardsNextBoundaryMs: (task: any, now: number) => number };
};

/** Seen-set PERSISTENTE (JSON em userData) — padrão updater-snooze: { [dedupKey]: ts }, capado. */
function defaultSeenStore(log: (t: string, d?: unknown) => void): SeenStore {
  let file = "";
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
  }
  function save(): void { try { const f = resolveFile(); if (f) fs.writeFileSync(f, JSON.stringify(mem)); } catch { /* seen-set nunca pode quebrar a entrega */ } }
  return {
    has(k: string): boolean { load(); return !!mem[k]; },
    add(k: string): void {
      load(); mem[k] = Date.now();
      const ks = Object.keys(mem);
      if (ks.length > 3000) { ks.sort((a, b) => mem[a] - mem[b]); for (let i = 0; i < 1000; i++) delete mem[ks[i]]; } // evita crescer sem limite (evict mais antigos)
      save();
    },
  };
}

export function startSlaScheduler(getUid: () => string | null, deliver: Deliver, opts?: SlaSchedulerOpts): { stop: () => void; reconcile: (reason?: string) => void } {
  opts = opts || {};
  const log = opts.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const now = opts.now || (() => Date.now());
  const listen = opts.listen || fbListen;
  const seen = opts.seen || defaultSeenStore(log);
  const setTimer = opts.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer || ((h: any) => clearTimeout(h));
  const SAFETY_MAX_MS = opts.safetyMaxMs || 60000;
  const authUser = opts.authUser || (() => null); // F3.4.3 — papel autenticado p/ operational_block
  // F3.5.2 — produtor de Edição de Cards: mock injetável (teste) OU require RÍGIDO (produção). Sem
  // try/catch: módulo ausente na build empacotada ⇒ ERRO alto (nunca no-op). Gate de build garante
  // a presença em app.asar. O produtor de SLA dos demais setores é INDEPENDENTE disto (byte-idêntico).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cardsRules: any = opts.cardsRules || require("./cardsRules");

  const tasks = new Map<string, any>();
  let timer: any = null;
  let stopped = false;

  log("sla.scheduler.start", { safetyMaxMs: SAFETY_MAX_MS });

  // Entrega os payloads cujo boundary já foi atingido (slaEmissionsFor só retorna estados
  // warning/overdue/critical) e cujo dedupKey ainda não foi visto. Marca seen APÓS entregar
  // (falha transitória reentrega no próximo eval), igual ao renderer.
  function emitDue(): void {
    if (stopped) return;
    const uid = (getUid && getUid()) || "";
    if (!uid) return;
    const t0 = now();
    const emitList = (payloads: NotifPayload[], taskId?: unknown): void => {
      for (const p of payloads || []) {
        const key = String((p && p.dedupKey) || "");
        if (!key || seen.has(key)) continue;
        // F3.4.7 — seen só é gravado quando o HUB ACEITA a entrega ({ok:true}). Antes, deliver()
        // (deliverNotification) NUNCA lança — devolve {ok:false} engolido — e a chave era marcada
        // mesmo com falha total: a transição ficava PERDIDA para sempre (viola o contrato de
        // dedupe: nenhum bloqueio permanente). Falha ⇒ chave livre ⇒ reentrega no próximo eval.
        try {
          const r: any = deliver(p);
          const accepted = !(r && typeof r === "object" && (r as any).ok === false);
          if (accepted) { seen.add(key); log("sla.emit", { dedupKey: key, eventType: p.eventType, taskId: p.taskId || taskId, nowMs: t0, channel: (r && (r as any).channel) || "" }); }
          else { log("sla.deliver.retry", { dedupKey: key, channel: (r && (r as any).channel) || "", nowMs: t0 }); }
        }
        catch (e) { log("sla.deliver.error", { dedupKey: key, err: String((e as any) && (e as any).message || e) }); }
      }
    };
    const all: any[] = [];
    tasks.forEach((task) => {
      all.push(task);
      let emissions: NotifPayload[] = [];
      try { emissions = slaRules.slaEmissionsFor(task, uid, t0) || []; } catch (e) { emissions = []; log("sla.emit.error", { taskId: task && task.id, err: String((e as any) && (e as any).message || e) }); }
      emitList(emissions, task && task.id);
      // F3.5.2 — EDIÇÃO DE CARDS: produtor ISOLADO (T-30 amarela / T-10 vermelha). Entrega pelo
      // MESMO emitList (⇒ MESMO deliver=deliverNotification + MESMA dedup persistente seen-store),
      // sem novo notifier/scheduler/listener/tray. Só emite p/ tarefas do setor 'edicao_cards'.
      let cardEmissions: NotifPayload[] = [];
      try { cardEmissions = cardsRules.cardsEmissionsFor(task, uid, t0) || []; } catch (e) { cardEmissions = []; log("cards.emit.error", { taskId: task && task.id, err: String((e as any) && (e as any).message || e) }); }
      emitList(cardEmissions, task && task.id);
    });
    // F3.4.3 — operational_block: varredura POR-USUÁRIO (gated em canSeeAll do papel AUTENTICADO).
    // Preserva integralmente o comportamento aprovado da 1.0.178 (condição/destinatário/título/texto/
    // cor/deep/dedupe) + a MESMA relação com sla_critical. Se o papel ainda não foi confirmado
    // (authUser()===null) NÃO emite (conservador: não bloqueia um possível supervisor).
    let opBlock: NotifPayload[] = [];
    try { opBlock = slaRules.operationalBlockFor(all, authUser(), t0) || []; } catch (e) { opBlock = []; log("sla.opblock.error", { err: String((e as any) && (e as any).message || e) }); }
    emitList(opBlock);
  }

  // O PRÓXIMO boundary futuro (amarelo/vermelho/crítico) entre TODAS as tasks elegíveis, ou 0.
  function nextBoundary(): number {
    const uid = (getUid && getUid()) || "";
    if (!uid) return 0;
    const t0 = now();
    let best = 0;
    tasks.forEach((task) => {
      let b = 0;
      try { b = Number(slaRules.nextBoundaryMs(task, t0)) || 0; } catch { b = 0; }
      if (b > t0 && (!best || b < best)) best = b;
      // F3.5.2 — contribui os marcos T-30/T-10 dos cards ao MESMO timer único (wake preciso), sem
      // criar segundo scheduler; 0 p/ tarefas não-cards.
      let bc = 0;
      try { bc = Number(cardsRules.cardsNextBoundaryMs(task, t0)) || 0; } catch { bc = 0; }
      if (bc > t0 && (!best || bc < best)) best = bc;
    });
    return best;
  }

  // UM ÚNICO timer auto-reagendável: dispara no próximo boundary (preciso) OU no teto de 60s
  // (re-eval de segurança, local). Cancela/re-arma sempre a partir do MAPA atual.
  function arm(): void {
    if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
    if (stopped) return;
    const t0 = now();
    const b = nextBoundary();
    const delay = b > 0 ? Math.max(250, Math.min(b - t0 + 120, SAFETY_MAX_MS)) : SAFETY_MAX_MS;
    log("sla.timer.arm", { boundaryMs: b, delayMs: delay, nowMs: t0, tasks: tasks.size });
    timer = setTimer(() => { timer = null; onFire(); }, delay);
  }

  function onFire(): void {
    if (stopped) return;
    log("sla.timer.fire", { nowMs: now() });
    emitDue();
    arm();
  }

  function reconcile(reason?: string): void {
    if (stopped) return;
    log("sla.reconcile", { reason: reason || "reconcile", tasks: tasks.size });
    emitDue();
    arm();
  }

  // Listener Firestore (long-polling no MAIN, nunca suspenso) — mantém o MAPA por docChanges.
  const unsub = listen("tasks", (snap: any) => {
    if (stopped) return;
    try {
      const changes = (snap && snap.docChanges && snap.docChanges()) || [];
      for (const ch of changes) {
        const id = ch && ch.doc && ch.doc.id;
        if (!id) continue;
        if (ch.type === "removed") tasks.delete(id);
        else tasks.set(id, Object.assign({ id }, (ch.doc.data && ch.doc.data()) || {}));
      }
      // Qualquer mudança de tasks: reavalia (entrega vencidos) + cancela/re-arma do MAPA atual.
      reconcile("snapshot");
    } catch (e) { log("sla.snapshot.error", { err: String((e as any) && (e as any).message || e) }); }
  });

  // Boot: primeira reconciliação + arma o timer.
  reconcile("boot");

  return {
    stop(): void {
      stopped = true;
      if (timer) { try { clearTimer(timer); } catch { /* */ } timer = null; }
      try { unsub(); } catch { /* */ }
      log("sla.scheduler.stop", {});
    },
    reconcile,
  };
}
