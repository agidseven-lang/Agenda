/**
 * F3.5.5A — executionOrchestrator.ts — ORQUESTRADOR DE EXECUÇÃO (MAIN, evolução do mecanismo existente).
 * =====================================================================================================
 * NÃO é um novo scheduler competindo: este módulo NÃO tem listener nem timer próprios — ele é acoplado
 * ao taskIdleScheduler (F3.5.4Q) pelos hooks opcionais {onTasks, onEvaluate, extraBoundary, legacyGate},
 * usando o MESMO listener Firestore, o MESMO setTimeout auto-reagendável e a MESMA fila central
 * (slaReminderController.enqueueCheckin). Autoridade ÚNICA por tarefa (matriz etAuthority):
 *   - OFF    ⇒ legado 100% (este módulo fica inerte; comportamento 1.0.216).
 *   - SHADOW ⇒ legado segue autoridade REAL; aqui SÓ se computa plano/decisões + observabilidade
 *              sanitizada. NUNCA: janela, som, fila, notificação, sino, timeline, risco real, resposta.
 *   - ACTIVE + elegível ⇒ adaptativo é autoridade ÚNICA (legacyGate suprime o produtor legado para a
 *              tarefa); ACTIVE + inelegível ⇒ legado continua funcionando.
 * CLAIM/RESPOSTA SERVER-SIDE (correção arquitetural obrigatória): este módulo NUNCA decide lease/
 * expiração/takeover/concorrência — ele PEDE via opts.claim (HTTP autenticado claimExecutionCheckpoint;
 * transação atômica com relógio DO SERVIDOR) e só EXIBE depois de {claim confirmado ⇒ ainda elegível ⇒
 * entrou na fila central ⇒ virou ativo ⇒ ACK do renderer ⇒ só então som}. Offline ⇒ OFFLINE/
 * RETRY_ON_RECONNECT: sem claim local, sem alerta, sem som, sem backlog (reavaliação na reconexão;
 * checkpoints velhos ⇒ suppressed/superseded). Relógio local NUNCA é autoridade de lease.
 * Privacidade: só sinais operacionais da Agenda (docs de tasks); NENHUM monitoramento de teclado/mouse/
 * programas/janela/tela/arquivos; observabilidade só com campos sanitizados (hashes/buckets).
 */
import crypto from "crypto";
import { diag } from "./diag";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ET: any = require("./executionTracking");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const S: any = require("./slaRules");

type Cfg = any;
export type ExecutionOrchestratorOpts = {
  now?: () => number;
  getConfig: () => Cfg;                                   // f355a-execution.json (mode/schedule/limites)
  getUid: () => string | null;
  emit: (p: any) => { ok?: boolean; channel?: string } | unknown;   // MESMA fila central (enqueueCheckin)
  claim: (req: any) => Promise<any>;                      // HTTP claimExecutionCheckpoint (main; token confinado)
  isOnline?: () => boolean;                               // conectividade lógica (default true)
  isCentralBusySla?: () => boolean;                       // amarelo/vermelho ativo/na fila ⇒ laranja espera
  sectorWarn?: (task: any) => number;                     // minutos de amarelo do SETOR (slaCfgOf real)
  soundDataUri?: () => string;                            // wav laranja empacotado (data-uri)
  appVersion?: string;
  store?: { read: () => any; write: (o: any) => void };   // f355a-execution-state.json (dedup pós-restart)
  onRemoteClose?: (key: string) => void;                  // resposta em OUTRO device ⇒ fecha a superfície local
  onLog?: (tag: string, data?: unknown) => void;
};

function hash8(v: string): string { return crypto.createHash("sha256").update(String(v || "")).digest("hex").slice(0, 16); }

/** Adapta o doc REAL de tasks ao formato do planner puro (nunca inventa datas). */
export function adaptTask(raw: any, nowMs: number): any {
  const t = raw || {};
  let dueMs = 0;
  // Prazo CANÔNICO = o mesmo resolvedor do painel/SLA (plannedFinishAt → planDueAt →
  // assignment.end → dueDate/dueTime). Nunca inventa data.
  try { dueMs = Number(S.slaPanelFinishMs ? S.slaPanelFinishMs(t) : 0) || 0; } catch { dueMs = 0; }
  if (!(dueMs > 0)) { try { dueMs = Number(t.dueAt) || 0; } catch { dueMs = 0; } }
  return {
    id: String(t.id || ""),
    designerId: String(t.assigneeId || ""),
    dueMs,
    status: String(t.status || ""),
    removed: t.removed === true, cancelled: t.cancelled === true,
    designerActionPending: t.designerActionPending === true,
    waitingClientFormal: t.waitingClientFormal === true,
    blockedPaused: t.blockedPaused === true || !!(t.executionTracking && t.executionTracking.pausedUntil > nowMs),
    adminOnly: t.adminOnly === true,
    sector: String(t.sector || t.setor || ""),
    startMs: Number(t.startAt) || 0,                       // início explícito (F3.5.2A)
    assignedAtMs: Number(t.assignedAt) || Number(t.designerAssignment && t.designerAssignment.assignedAt) || 0, // momento REAL da atribuição (nunca inventado)
    deadlineVersion: Number(t.deadlineVersion) || 0,
    lastMeaningfulAtMs: Number(t.executionLastMeaningfulAt) || 0,
    title: String(t.title || "Tarefa"),
    client: String(t.client || ""),
    raw: t,
  };
}

export function createExecutionOrchestrator(opts: ExecutionOrchestratorOpts) {
  const log = opts.onLog || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const now = opts.now || (() => Date.now());
  const isOnline = opts.isOnline || (() => true);
  const busySla = opts.isCentralBusySla || (() => false);
  const sectorWarn = opts.sectorWarn || (() => 30);
  const appVersion = String(opts.appVersion || "");
  let tasks: Map<string, any> = new Map();
  const inFlight = new Set<string>();
  // estados locais por chave (dedup/ciclo): displayed/closed sobrevivem a restart via store
  let persisted: any = {};
  try { persisted = (opts.store && opts.store.read()) || {}; } catch { persisted = {}; }
  const closed: Record<string, string> = (persisted && persisted.closed) || {};   // key -> estado final local
  const displayed: Record<string, number> = (persisted && persisted.displayed) || {};
  let stopped = false;
  function save(): void { try { opts.store && opts.store.write({ closed, displayed }); } catch { /* */ } }

  function cfg(): Cfg { return opts.getConfig() || {}; }
  /** Modo EFETIVO (fail-safe): active com jornada incompleta NUNCA roda (etActiveAllowed). */
  function mode(): "off" | "shadow" | "active" {
    const c = cfg();
    const m = String(c.mode || "off");
    if (m === "active") { try { if (!ET.etActiveAllowed(c).allowed) return "off"; } catch { return "off"; } return "active"; }
    return (m === "shadow") ? "shadow" : "off";
  }
  function plannerCfg(): any {
    const c = cfg();
    const sch = c.schedule || {};
    return {
      sectors: Array.isArray(c.sectors) ? c.sectors : null,
      designers: Array.isArray(c.designers) ? c.designers : null,
      schedule: { configured: sch.configured === true, days: sch.days || [], startMin: Number(sch.startMin) || 0, endMin: Number(sch.endMin) || 0, tzOffsetMin: Number(sch.tzOffsetMin) || 0 },
      maxPerDay: Number(c.maxPerDay) || 3,
      maxPerTask: Number(c.maxPerTask) || 6,
      minGapMin: Number(c.minGapMin) || 20,
      slaMarginMin: Number(c.slaMarginMin) || 10,
    };
  }
  function obs(event: string, extra: any): void {
    // Observabilidade SANITIZADA (allowlist): nunca nome/cliente/título/observação/uid cru/token.
    const base = { mode: mode(), appVersion, timestamp: now() };
    log("execution_tracking." + event, Object.assign(base, extra || {}));
  }

  /** Autoridade por tarefa (matriz do COMPLEMENTO). Consultada pelo legacyGate do taskIdleScheduler. */
  function authorityFor(rawTask: any): "legacy" | "adaptive" {
    if (stopped) return "legacy";
    const m = mode();
    if (m !== "active") return "legacy";               // OFF e SHADOW: legado é a autoridade REAL
    const uid = opts.getUid() || "";
    if (!uid) return "legacy";
    const t = adaptTask(rawTask, now());
    if (t.designerId !== uid) return "legacy";
    try { return ET.etEligibility(t, plannerCfg()).eligible ? "adaptive" : "legacy"; } catch { return "legacy"; }
  }

  function planFor(t: any): any {
    const pc = plannerCfg();
    const w = ET.etWindowStart(t);
    if (!(w.startMs > 0)) return { checkpoints: [], reason: "janela_invalida" };
    const warnMin = Number(sectorWarn(t.raw)) || 30;
    return ET.etPlan({ startMs: w.startMs, dueMs: t.dueMs, nowMs: now(), warnMin, marginMin: pc.slaMarginMin, schedule: pc.schedule, maxPerDay: pc.maxPerDay, maxPerTask: pc.maxPerTask, minGapMin: pc.minGapMin });
  }

  /** Menor plannedAt futuro (integra o arm() do taskIdleScheduler via extraBoundary). */
  function nextBoundary(): number {
    if (stopped) return 0;
    const m = mode();
    if (m === "off") return 0;
    const uid = opts.getUid() || "";
    if (!uid) return 0;
    const t0 = now();
    let best = 0;
    tasks.forEach((raw) => {
      const t = adaptTask(raw, t0);
      if (t.designerId !== uid) return;
      let el: any = null; try { el = ET.etEligibility(t, plannerCfg()); } catch { return; }
      if (!el.eligible) return;
      let plan: any = null; try { plan = planFor(t); } catch { return; }
      for (const cp of (plan.checkpoints || [])) {
        const key = ET.etKey(t.id, uid, t.deadlineVersion, cp.index);
        if (closed[key] || displayed[key]) continue;
        const at0 = Number(cp.plannedAt) || 0; if (at0 > t0 && (!best || at0 < best)) best = at0;
      }
    });
    return best;
  }

  /** Ctx no CONTRATO REAL do etShouldSuppress(x): {task, tracking, cfg, now, slaCutoffAt, schedule, mode}. */
  function suppressCtx(t: any, t0: number, cutoffAt: number, m: string): any {
    const pc = plannerCfg();
    const tr = (t.raw && t.raw.executionTracking) || {};
    return {
      task: { status: t.status, blockedPaused: t.blockedPaused === true, waitingClientFormal: t.waitingClientFormal === true, startedAtMs: Number(t.raw && t.raw.startedAt) || 0 },
      tracking: { pauseUntil: Number(tr.pausedUntil) || 0, lastResponseAt: Number(tr.lastCheckin && tr.lastCheckin.at) || 0 },
      cfg: {},
      now: t0,
      slaCutoffAt: cutoffAt,
      schedule: pc.schedule,
      lastMeaningfulAt: t.lastMeaningfulAtMs,
      mode: (m === "shadow") ? "SHADOW" : "ACTIVE",
    };
  }

  /** Avaliação no MESMO tick do taskIdleScheduler (hook onEvaluate). */
  function evaluate(): void {
    if (stopped) return;
    const m = mode();
    if (m === "off") return;
    const uid = opts.getUid() || "";
    if (!uid) return;
    const t0 = now();
    tasks.forEach((raw) => {
      const t = adaptTask(raw, t0);
      if (t.designerId !== uid) return;
      // Invalidação MULTI-DEVICE: resposta/perda registrada pelo SERVIDOR (projeção no task doc,
      // via snapshot realtime que TODOS os devices já assinam) fecha a superfície local sem som novo.
      try {
        const lc = raw && raw.executionTracking && raw.executionTracking.lastCheckin;
        if (lc && lc.key && (lc.state === "RESPONDED" || lc.state === "MISSED") && !closed[lc.key]) {
          closed[lc.key] = String(lc.state); delete displayed[lc.key]; save();
          if (opts.onRemoteClose) { try { opts.onRemoteClose(String(lc.key)); } catch { /* */ } }
          obs("checkpoint_closed_by_other_device", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: Number(lc.checkpointIndex) || 0, deadlineVersion: Number(lc.deadlineVersion) || 0, responseType: String(lc.responseType || "") });
        }
      } catch { /* */ }
      let el: any = null; try { el = ET.etEligibility(t, plannerCfg()); } catch { return; }
      if (!el.eligible) return;
      let plan: any = null; try { plan = planFor(t); } catch { return; }
      const durBucket = (plan && plan.bucket) || "";
      const cutoffAt = Number(plan.slaCutoffAt) || (t.dueMs - ((Number(sectorWarn(t.raw)) || 30) + plannerCfg().slaMarginMin) * 60000);
      for (const cp of (plan.checkpoints || [])) {
        const cpAt = Number(cp.plannedAt) || 0;
        if (!(cpAt > 0) || cpAt > t0) continue;                            // ainda não devido (plannedAt do planner)
        const key = ET.etKey(t.id, uid, t.deadlineVersion, cp.index);
        if (closed[key] || displayed[key] || inFlight.has(key)) continue;
        // Sem backlog: checkpoint vencido irrelevante (offline/restart/zona SLA/prazo) ⇒ superseded local.
        let relevant = true;
        try { relevant = !!ET.etStillRelevant(cp, t0, cutoffAt, t.dueMs); } catch { relevant = false; }
        if (!relevant) { closed[key] = "SUPERSEDED"; save(); obs("checkpoint_superseded", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion, suppressionReason: "expired_offline_or_restart", durationBucket: durBucket }); continue; }
        // Supressão por sinais operacionais reais (inclui zona SLA e fora da jornada).
        let sup: any = { suppress: false };
        try { sup = ET.etShouldSuppress(suppressCtx(t, t0, cutoffAt, m)); } catch { /* */ }
        if (m === "shadow") {
          // SHADOW: totalmente silencioso — só decisão would-display + observabilidade sanitizada.
          obs("shadow_would_display", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, checkpointCount: (plan.checkpoints || []).length, deadlineVersion: t.deadlineVersion, durationBucket: durBucket, suppressionReason: String((sup && sup.reason) || "") });
          closed[key] = "SHADOW_LOGGED";                                    // 1 log por checkpoint (sem reemissão)
          save();
          continue;
        }
        if (sup && sup.suppress) {
          if (sup.reason === "sla_zone") { closed[key] = ET.etSlaZoneTransition("DUE"); save(); }
          obs("checkpoint_suppressed", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion, suppressionReason: String(sup.reason || ""), durationBucket: durBucket });
          continue;                                                          // (fora de jornada/atividade recente: reavalia depois)
        }
        if (busySla()) { obs("checkpoint_deferred", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion, suppressionReason: "sla_active", durationBucket: durBucket }); continue; }
        if (!isOnline()) { obs("checkpoint_offline_retry", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion, suppressionReason: "offline_retry_on_reconnect", durationBucket: durBucket }); continue; } // OFFLINE ⇒ sem claim/UI; reavalia na reconexão
        // ACTIVE devido ⇒ CLAIM server-side (transação; relógio do servidor). Só exibe após concessão.
        inFlight.add(key);
        const req = {
          taskId: t.id, checkinId: key, deadlineVersion: t.deadlineVersion, checkpointIndex: cp.index,
          dueAtMs: t.dueMs, sectorWarnMinutes: Number(sectorWarn(t.raw)) || 30,
          slaZone: false, leaseMs: Math.max(60000, (Number(cfg().responseMin) || 10) * 60000 + 12 * 60000),
        };
        Promise.resolve(opts.claim(req)).then((r: any) => {
          inFlight.delete(key);
          if (stopped) return;
          const dec = String((r && r.decision) || "");
          if (dec === "claimed" || dec === "resumed" || dec === "takeover") {
            // reelegibilidade no momento da exibição (claim→elegível→fila→ativo→ACK→som)
            const raw2 = tasks.get(t.id); const t2 = adaptTask(raw2 || {}, now());
            let el2: any = { eligible: false };
            try { el2 = ET.etEligibility(t2, plannerCfg()); } catch { /* */ }
            if (!raw2 || !el2.eligible || t2.deadlineVersion !== t.deadlineVersion) { obs("claim_dropped_ineligible", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion }); return; }
            if (busySla()) { obs("checkpoint_deferred", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion, suppressionReason: "sla_active_post_claim", durationBucket: durBucket }); return; } // fica CLAIMED no servidor; reemite no próximo tick (retomada idempotente)
            const payload = buildExecutionCheckinPayload(t2, cp, key, {
              soundDataUri: (opts.soundDataUri && opts.soundDataUri()) || "",
              leaseExpiresAt: Number(r.leaseExpiresAt) || 0, claimVersion: Number(r.claimVersion) || 0,
              responseMin: Number(cfg().responseMin) || 10, snoozeAllowed: cfg().snoozeAllowed !== false,
              requireObservationOnNegative: cfg().requireObservationOnNegative === true,
              appVersion,
            });
            let accepted = false;
            try { const rr: any = opts.emit(payload); accepted = !(rr && typeof rr === "object" && (rr as any).ok === false); } catch { accepted = false; }
            if (accepted) {
              displayed[key] = now(); save();
              obs("checkpoint_enqueued", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, checkpointCount: (plan.checkpoints || []).length, deadlineVersion: t.deadlineVersion, durationBucket: durBucket });
            }
          } else if (dec === "deny" && r && r.reason === "LEASED_BY_OTHER") {
            closed[key] = "SUPPRESSED"; save();
            obs("checkpoint_suppressed", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion, suppressionReason: "displayed_on_other_device", durationBucket: durBucket });
          } else if (dec === "closed" || dec === "deny") {
            closed[key] = String((r && r.state) || (r && r.reason) || "CLOSED").toUpperCase(); save();
            obs("checkpoint_closed_remote", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion, suppressionReason: String((r && r.reason) || "closed") });
          }
          // erro de rede/500: nada persiste — RETRY natural no próximo tick (sem som/janela)
        }).catch(() => { inFlight.delete(key); obs("claim_error_retry", { taskIdHash: hash8(t.id), designerIdHash: hash8(uid), checkpointIndex: cp.index, deadlineVersion: t.deadlineVersion }); });
      }
    });
  }

  return {
    authorityFor,
    onTasks(map: Map<string, any>): void { tasks = map; },
    evaluate,
    nextBoundary,
    /** Fechamento local (resposta/missed confirmados no servidor OU invalidação multi-device via snapshot). */
    notifyClosed(key: string, state: string): void { if (!key) return; closed[key] = String(state || "RESPONDED"); delete displayed[key]; save(); },
    /** Reavaliação pós-reconexão: NUNCA cria backlog (etStillRelevant descarta vencidos). */
    onReconnect(): void { obs("reconnect_reevaluate", {}); evaluate(); },
    mode,
    stop(): void { stopped = true; },
  };
}

/** Payload do check-in de EXECUÇÃO (laranja) — MESMA fila central, checkinKind próprio. */
export function buildExecutionCheckinPayload(t: any, cp: any, key: string, x: any): any {
  return {
    kind: "checkin",
    checkinKind: "execution",
    eventType: "execution_checkin",
    dedupKey: key, idleCheckKey: key, executionKey: key,
    taskId: t.id, taskTitle: t.title, clientName: t.client,
    recipientUid: t.designerId,
    checkpointIndex: Number(cp.index) || 0, deadlineVersion: Number(t.deadlineVersion) || 0,
    dueAtMs: Number(t.dueMs) || 0,
    title: "CHECK-IN DE EXECUÇÃO",
    message: "Você está executando esta tarefa neste momento?",
    severity: "info",
    soundDataUri: String((x && x.soundDataUri) || ""),
    leaseExpiresAt: Number(x && x.leaseExpiresAt) || 0,
    claimVersion: Number(x && x.claimVersion) || 0,
    responseMin: Number(x && x.responseMin) || 10,
    snoozeAllowed: !(x && x.snoozeAllowed === false),
    requireObservationOnNegative: !!(x && x.requireObservationOnNegative),
    action: { type: "detail", deep: t.id ? "detail/" + t.id : "" },
    source: "desktop-" + String((x && x.appVersion) || ""),
    createdAt: Date.now(),
  };
}
