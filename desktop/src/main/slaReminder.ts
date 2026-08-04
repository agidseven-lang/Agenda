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
  decisionsEnabled: boolean;   // F3.5.4P — exibe as 5 decisões (true) ou só OK (false = 1.0.205)
  taskId: string;              // F3.5.4P — p/ resolver destinatário da ajuda no renderer
};

/**
 * F3.5.4P — DECISÃO DO RESPONSÁVEL no alerta de SLA. A persistência OFICIAL é uma TRANSAÇÃO Firestore
 * (opts.persistDecision) sobre tasks/{taskId}: relê a tarefa, valida com os dados ATUAIS, confirma que a
 * decisionKey ainda não foi registrada e acrescenta EXATAMENTE UMA entrada sla_decision ao history[].
 * A primeira transação confirmada vence; a segunda recebe already_decided. O controlador é PURO: recebe
 * persistDecision injetável (produção = renderer; teste = simulador OCC).
 */
export type DecisionType = "start_now" | "finishing" | "blocked" | "help_requested" | "acknowledge_only";

export type DecisionInput = {
  key: string;                 // dedupKey do alerta ATIVO (a decisão é sobre o que está na tela)
  decisionType: DecisionType;
  etaMinutes?: number;         // finishing (PREVISÃO — não altera prazo)
  reasonCode?: string;         // blocked
  reasonText?: string;         // blocked 'outro' / observação curta
  helpText?: string;           // help (descrição curta)
  helpRecipientId?: string;    // help — destinatário já resolvido/escolhido no renderer (C5)
  helpRecipientName?: string;
};

export type DecisionPersistStatus =
  "committed" | "already_decided" | "task_completed" | "task_deleted" | "not_authorized" | "offline" | "error";
export type DecisionPersistResult = { status: DecisionPersistStatus; error?: string; deep?: string };

export type DecisionPersistRequest = {
  decisionKey: string;
  taskId: string;
  alertLevel: ReminderLevel;
  boundaryVersion: string;
  recipientUid: string;
  decisionType: DecisionType;
  etaMinutes?: number;
  reasonCode?: string;
  reasonText?: string;
  helpText?: string;
  helpRecipientId?: string;
  helpRecipientName?: string;
  actorId: string;
  actorName: string;
  taskTitle: string;
};

/** Resultado devolvido à janela (a janela mapeia status → texto exibido; controlador só decide o status). */
export type DecisionPublicResult =
  { status: "committed" | "already_decided" | "task_completed" | "task_deleted" | "queued" | "error" | "ignored";
    decisionType?: DecisionType; deep?: string; error?: string };

/**
 * F3.5.4Q — CHECK-IN DE TAREFA PARADA (view AZUL, não acusatória) — cidadão de PRIORIDADE MAIS BAIXA
 * da MESMA janela central (garante "nunca duas janelas centrais"). O SLA (amarelo/vermelho) SEMPRE
 * preempta: ao chegar um SLA com o check-in ativo, o rascunho é preservado, o check-in é suspenso
 * (recolocado na fila) e o SLA é exibido; ao esvaziar o SLA, o check-in é restaurado se o ciclo
 * continuar válido. A persistência é uma TRANSAÇÃO própria (persistIdleResponse) — NUNCA mistura com
 * a decisão de SLA (sla_decision permanece intacta).
 */
export type CheckinResponseType = "working" | "blocked" | "help_requested" | "return_to_todo";
export type CheckinState = "prompt" | "already_answered" | "activity_changed" | "task_completed" | "task_deleted" | "queued" | "error";

export type CheckinView = {
  kind: "checkin";
  key: string;                 // idleCheckKey (também é a dedupKey)
  taskId: string;
  recipientUid: string;
  actorName: string;
  actorAvatar: string;
  taskTitle: string;
  clientName: string;
  etapa: string;               // "Em andamento"
  sinceText: string;           // "há 2 horas"
  inactivityMinutes: number;
  deep: string;
  soundDataUri: string;
  statusVersion: string;
  activityBoundaryVersion: number;
  thresholdVersion: string;
  draft?: any;                 // rascunho preservado (suspend/restore): {responseType,reasonCode,reasonText,helpText,helpRecipientId,...}
  state?: CheckinState;        // estado exibido (default 'prompt')
  queueLen?: number;           // sempre 0 no check-in (não expõe contador de SLA)
  // F3.5.5A — CHECK-IN DE EXECUÇÃO (laranja) na MESMA janela/fila (subordinado ao SLA como o azul):
  checkinKind?: string;        // "execution" ⇒ view laranja + respostas próprias + decide server-side
  message?: string;            // "Você está executando esta tarefa neste momento?"
  checkpointIndex?: number;
  deadlineVersion?: number;
  responseMin?: number;        // janela de resposta (minutos) — timer SÓ após render+ACK
  snoozeAllowed?: boolean;     // "Responder em 10 minutos" (1x por checkpoint)
  requireObservationOnNegative?: boolean;
};

/** View central (SLA amarelo/vermelho OU check-in azul). */
export type CentralView = ReminderView | CheckinView;

export type CheckinDecisionInput = {
  key: string;                 // idleCheckKey ATIVO
  responseType: CheckinResponseType;
  reasonCode?: string;         // blocked
  reasonText?: string;         // blocked 'outro'
  helpText?: string;           // help
  helpRecipientId?: string;    // help — destinatário resolvido/escolhido no renderer (C5)
  helpRecipientName?: string;
  confirmReturn?: boolean;     // return_to_todo — confirmação explícita do usuário
};

export type IdlePersistStatus =
  "committed" | "already_answered" | "activity_changed" | "task_completed" | "task_deleted" | "not_authorized" | "offline" | "error";
export type IdlePersistResult = { status: IdlePersistStatus; error?: string; deep?: string };

export type IdlePersistRequest = {
  idleCheckKey: string;
  taskId: string;
  recipientUid: string;
  responseType: CheckinResponseType;
  activityBoundaryVersion: number;   // lastMeaningfulActivityAt (a transação revalida)
  statusVersion: string;
  thresholdVersion: string;
  reasonCode?: string;
  reasonText?: string;
  helpText?: string;
  helpRecipientId?: string;
  helpRecipientName?: string;
  actorId: string;
  actorName: string;
  taskTitle: string;
};

export type CheckinPublicResult =
  { status: "committed" | "already_answered" | "activity_changed" | "task_completed" | "task_deleted" | "queued" | "error" | "ignored";
    responseType?: CheckinResponseType; deep?: string; error?: string };

/** Superfície injetável (produção = Electron; teste = fake que registra chamadas). */
export type ReminderSurface = {
  show: (view: CentralView) => void;          // cria/exibe a janela central com este view (SLA ou check-in)
  promote: (view: ReminderView) => void;       // atualiza a MESMA janela (amarelo→vermelho) + som vermelho
  close: () => void;                           // destrói a janela (após ack)
  isOpen: () => boolean;
  native: (view: CentralView) => boolean;     // fallback nativo persistente (lock / overlay bloqueado)
  onNoRender?: (key: string, cb: () => void) => void; // prova de render; se não renderizar, cb (fallback)
};

type QueueItem = { key: string; base: string; level: ReminderLevel; view: ReminderView; enqueuedAt: number; taskId: string };

export type SlaReminderControllerOpts = {
  surface: ReminderSurface;
  // F3.5.5A — CHECK-IN DE EXECUÇÃO (laranja): resposta/perda via operação TRANSACIONAL server-side
  // (respondExecutionCheckpoint; relógio do SERVIDOR). Opcionais ⇒ ausentes, trilha azul intacta.
  executionRespond?: (req: any) => Promise<any>;
  onExecutionClosed?: (key: string, state: string) => void;
  store: {
    isAcked: (k: string) => boolean;
    markPending: (rec: any) => void;
    removePending: (k: string) => void;
    markAck: (k: string, meta?: any) => void;
    listPending: () => any[];
    // F3.5.4P — decisão durável (idempotência local + fila offline)
    isDecisionSettled: (decisionKey: string) => boolean;
    markDecisionPending: (rec: any) => void;
    markDecisionSynced: (decisionKey: string, meta?: any) => void;
    markDecisionSuperseded: (decisionKey: string) => void;
    listDecisionsPendingSync: () => any[];
  };
  now?: () => number;
  onLog?: (tag: string, data?: unknown) => void;
  appVersion?: string;
  isLocked?: () => boolean;
  taskValid?: (taskId: string, recipientUid: string) => boolean;  // tarefa ainda existe/pertinente/destinatário válido
  soundFor?: (level: ReminderLevel) => string;                    // data URI do som (main lê o .wav)
  getUid?: () => string;                                          // usuário logado (filtra reexibição de pendentes)
  onAcked?: (info: { key: string; level: ReminderLevel; actorName: string; taskTitle: string; taskId: string }) => void; // pós-OK (histórico do sino)
  // F3.5.4P — DECISÃO DO RESPONSÁVEL
  persistDecision?: (req: DecisionPersistRequest) => Promise<DecisionPersistResult>; // TRANSAÇÃO real (renderer); teste injeta simulador OCC
  onDecided?: (info: { decisionType: DecisionType; key: string; level: ReminderLevel; actorName: string; taskTitle: string; taskId: string; etaMinutes?: number; reasonCode?: string; recipientName?: string }) => void; // sino/observabilidade pós-commit
  decisionsEnabled?: () => boolean; // feature flag slaDecisionActionsEnabled (default ON); OFF ⇒ controlador ignora decisões (só OK)
  // F3.5.4Q — CHECK-IN DE TAREFA PARADA (aditivo; prioridade abaixo do SLA)
  persistIdleResponse?: (req: IdlePersistRequest) => Promise<IdlePersistResult>; // TRANSAÇÃO real (renderer); teste injeta simulador OCC
  onIdleResponded?: (info: { responseType: CheckinResponseType; idleCheckKey: string; actorName: string; taskTitle: string; taskId: string; reasonCode?: string; recipientName?: string }) => void; // sino/observabilidade pós-commit
  idleEnabled?: () => boolean;      // feature flag taskIdleDetectionEnabled (default ON); OFF ⇒ ignora check-in
  idleStore?: {
    getResponse: (idleCheckKey: string) => any;
    isResponseSettled: (idleCheckKey: string) => boolean;
    markResponsePending: (rec: any) => void;
    markResponseSynced: (idleCheckKey: string, meta?: any) => void;
    markResponseSuperseded: (idleCheckKey: string) => void;
    listResponsesPendingSync: () => any[];
  };
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
  // F3.5.4P — decisão do responsável
  const inFlight = new Set<string>();         // idempotência: decisionKeys em processamento (bloqueia duplo-clique/reentrância)
  const persistDecision = opts.persistDecision || (async () => ({ status: "offline" as DecisionPersistStatus }));
  const decisionsEnabled = opts.decisionsEnabled || (() => true);
  // F3.5.4Q — CHECK-IN DE TAREFA PARADA (estado ISOLADO; prioridade ABAIXO de qualquer SLA)
  type CheckinItem = { key: string; view: CheckinView; taskId: string; recipientUid: string; enqueuedAt: number;
    // F3.5.5A — máquina do CHECK-IN DE EXECUÇÃO (laranja): timer de resposta só pós-ACK; snooze 1x;
    // 1 reapresentação; depois MISSED (registrado server-side pelo detentor).
    execution?: { representedCount: number; snoozeUsed: boolean; notBefore?: number };
  };
  const checkinQueue: CheckinItem[] = [];
  let activeCheckin: CheckinItem | null = null;
  const checkinInFlight = new Set<string>();
  const persistIdleResponse = opts.persistIdleResponse || (async () => ({ status: "offline" as IdlePersistStatus }));
  const idleEnabled = opts.idleEnabled || (() => true);
  const idleStore = opts.idleStore || null;
  // F3.5.5A — resposta/perda do check-in de EXECUÇÃO via operação transacional server-side
  // (respondExecutionCheckpoint); relógio do SERVIDOR; nunca gravação local como autoridade.
  const executionRespond = (opts as any).executionRespond as ((req: any) => Promise<any>) | undefined;
  const onExecutionClosed = (opts as any).onExecutionClosed as ((key: string, state: string) => void) | undefined;
  let execTimer: any = null;                 // timer ÚNICO da trilha de execução (resposta/snooze/reshow)
  function execClearTimer(): void { if (execTimer) { try { clearTimeout(execTimer); } catch { /* */ } execTimer = null; } }

  function baseOf(p: any): string { return String((p && p.taskId) || "") + ":" + String((p && p.targetUserId) || (p && p.recipientUid) || ""); }
  function recipientOf(p: any): string { return String((p && p.targetUserId) || (p && p.recipientUid) || ""); }
  // F3.5.4P — boundaryVersion = finishMs (marco do prazo) extraído da dedupKey (epoch-ms de 12+ dígitos),
  // independente do produtor (SLA idx2 / cards|dedupByDesigner idx3) — SEM tocar os produtores congelados.
  function boundaryOf(dedupKey: string): string { const m = String(dedupKey || "").match(/(\d{12,})/); return m ? m[1] : ""; }
  // F3.5.4U-H1 (Defeito 2) — CHAVE LÓGICA do alerta (taskId+destinatário+nível+marco-do-prazo). Independe da
  // dedupKey crua do produtor: dois PRODUTORES/SOURCES que emitem o MESMO alerta lógico (dedupKeys diferentes)
  // colapsam numa única ocorrência. Prazo NOVO (outro marco) ⇒ chave diferente ⇒ novo alerta permitido.
  function logicalOf(p: any, level: ReminderLevel): string { return baseOf(p) + ":" + level + ":" + boundaryOf(String((p && p.dedupKey) || "")); }
  function logicalOfItem(it: QueueItem): string { return it.base + ":" + it.level + ":" + boundaryOf(it.key); }
  // hash NÃO reversível p/ observabilidade (nunca logar taskId/dedupKey crus).
  function hashId(s: string): string { let h = 5381; const v = String(s || ""); for (let i = 0; i < v.length; i++) h = ((h << 5) + h + v.charCodeAt(i)) >>> 0; return h.toString(36); }
  // F3.5.4U-H1 — observabilidade SANITIZADA do ciclo de vida (só nível/threshold/source/contagens/hashes).
  function centralObs(event: string, p: any, level: ReminderLevel | "", extra?: Record<string, unknown>): void {
    try { log(event, Object.assign({ alertType: level || "", threshold: String((p && (p.threshold || p.slaThreshold)) || ""), source: String((p && p.source) || "notifierA"), queueDepth: queue.length, activeExists: !!active, appVersion, timestamp: now(), taskIdHash: hashId(String((p && p.taskId) || "")), dedupKeyHash: hashId(String((p && p.dedupKey) || (p && p.key) || "")) }, extra || {})); } catch { /* */ }
  }
  function buildDecisionKey(taskId: string, level: ReminderLevel, boundary: string, uid: string): string {
    return "sla_decision:" + String(taskId || "") + ":" + String(level || "") + ":" + String(boundary || "") + ":" + String(uid || "");
  }

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
      decisionsEnabled: decisionsEnabled(),
      taskId: String((p && p.taskId) || ""),
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
    // F3.5.4Q — nenhum SLA pendente ⇒ tenta o check-in (prioridade mais baixa) ou fecha a janela.
    if (idx < 0) { showNextCheckin(); return; }
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
    centralObs("central_alert.activated", { taskId: it.taskId, dedupKey: it.key }, it.level, { queueDepth: queue.length });
    log("sla.reminder.shown", { key: mask(it.key), level: it.level, queueLen: it.view.queueLen });
    log("sla.reminder.sound.played", { key: mask(it.key), level: it.level });
    if (surface.onNoRender) {
      surface.onNoRender(it.key, () => {
        try { const ok = surface.native(it!.view); log("sla.reminder.native.sent", { key: mask(it.key), nativeOk: ok }); }
        catch (e) { log("sla.reminder.native.failed", { key: mask(it.key), err: errMsg(e) }); }
      });
    }
  }

  // ═══════════════ F3.5.4Q — CHECK-IN DE TAREFA PARADA (helpers internos) ═══════════════
  function checkinPendingCount(): number { return (activeCheckin ? 1 : 0) + checkinQueue.length; }

  function buildCheckinView(p: any): CheckinView {
    return {
      kind: "checkin",
      key: String((p && (p.idleCheckKey || p.dedupKey || p.key)) || ""),
      taskId: String((p && p.taskId) || ""),
      recipientUid: String((p && p.recipientUid) || ""),
      actorName: String((p && (p.responsibleName || p.actorName)) || ""),
      actorAvatar: String((p && (p.responsibleAvatar || p.actorAvatar)) || ""),
      taskTitle: String((p && p.taskTitle) || "Tarefa"),
      clientName: String((p && p.clientName) || ""),
      etapa: String((p && p.etapa) || "Em andamento"),
      sinceText: String((p && p.sinceText) || ""),
      inactivityMinutes: Number((p && p.inactivityMinutes)) || 0,
      deep: String((p && p.action && p.action.deep) || (p && p.taskId ? "detail/" + p.taskId : "")),
      soundDataUri: String((p && p.soundDataUri) || ""),   // som NEUTRO/discreto (opcional; default vazio)
      statusVersion: String((p && p.statusVersion) || ""),
      activityBoundaryVersion: Number((p && p.activityBoundaryVersion)) || 0,
      thresholdVersion: String((p && p.thresholdVersion) || ""),
      state: "prompt",
      queueLen: 0,
      // F3.5.5A — campos do CHECK-IN DE EXECUÇÃO (ausentes no azul ⇒ view azul intacta)
      checkinKind: String((p && p.checkinKind) || ""),
      message: String((p && p.message) || ""),
      checkpointIndex: Number((p && p.checkpointIndex)) || 0,
      deadlineVersion: Number((p && p.deadlineVersion)) || 0,
      responseMin: Number((p && p.responseMin)) || 10,
      snoozeAllowed: !(p && p.snoozeAllowed === false),
      requireObservationOnNegative: !!(p && p.requireObservationOnNegative),
    };
  }

  /* ══════ F3.5.5A — CHECK-IN DE EXECUÇÃO: timer pós-ACK, snooze 1x, 1 reapresentação, MISSED ══════ */
  function execIsExecution(it: CheckinItem | null): boolean { return !!(it && it.view && String((it.view as any).checkinKind || "") === "execution"); }
  /** Reagenda a reexibição do primeiro item com notBefore futuro (janela fechada nesse meio tempo). */
  function execArmReshow(): void {
    execClearTimer();
    if (stopped) return;
    let best = 0;
    for (const it of checkinQueue) { const nb = (it.execution && it.execution.notBefore) || 0; if (nb > now() && (!best || nb < best)) best = nb; }
    if (best) execTimer = setTimeout(() => { execTimer = null; try { showNext(); } catch { /* */ } }, Math.max(250, best - now() + 100));
  }
  /** ACK de render do check-in de EXECUÇÃO ⇒ inicia a janela de resposta (NUNCA antes do ACK). */
  function onExecutionRendered(key: string): void {
    const cur = activeCheckin;
    if (!cur || cur.key !== String(key || "") || !execIsExecution(cur)) return;
    execClearTimer();
    const mins = Number((cur.view as any).responseMin) || 10;
    log("execution.checkin.response_window_started", { key: mask(cur.key), responseMin: mins });
    execTimer = setTimeout(() => { execTimer = null; execOnResponseTimeout(cur.key); }, Math.max(60000, mins * 60000));
  }
  /** Timeout sem resposta: 1ª vez ⇒ oculta SEM perder (reapresenta 1x); 2ª ⇒ MISSED server-side. */
  function execOnResponseTimeout(key: string): void {
    const cur = activeCheckin;
    if (stopped || !cur || cur.key !== key || !execIsExecution(cur)) return;
    const st = cur.execution || { representedCount: 0, snoozeUsed: false };
    if (st.representedCount < 1) {
      st.representedCount += 1; st.notBefore = now() + 60000;    // reapresenta UMA vez (~1min depois, janela livre)
      cur.execution = st;
      checkinQueue.unshift(cur); activeCheckin = null;
      try { surface.close(); } catch { /* */ }
      log("execution.checkin.timeout_hidden_for_represent", { key: mask(key), representedCount: st.representedCount });
      execArmReshow();
      return;
    }
    // Segunda janela sem resposta ⇒ MISSED (transação server-side pelo DETENTOR do claim)
    log("execution.checkin.missed_timeout", { key: mask(key) });
    void execCommitRespond(cur, { kind: "missed" }, true);
  }
  /** Snooze "Responder em 10 minutos" — permitido UMA vez por checkpoint (config snoozeAllowed). */
  function execSnooze(key: string): { status: string } {
    const cur = activeCheckin;
    if (!cur || cur.key !== String(key || "") || !execIsExecution(cur)) return { status: "ignored" };
    const st = cur.execution || { representedCount: 0, snoozeUsed: false };
    if ((cur.view as any).snoozeAllowed === false || st.snoozeUsed) return { status: "ignored" };
    st.snoozeUsed = true; st.notBefore = now() + 10 * 60000;
    cur.execution = st;
    execClearTimer();
    checkinQueue.unshift(cur); activeCheckin = null;
    try { surface.close(); } catch { /* */ }
    log("execution.checkin.snoozed", { key: mask(key) });
    execArmReshow();
    return { status: "queued" };
  }
  /** Commit transacional da resposta/perda no SERVIDOR + fechamento local (histórico único). */
  async function execCommitRespond(cur: CheckinItem, input: any, isMissed: boolean): Promise<CheckinPublicResult> {
    const key = cur.key;
    if (checkinInFlight.has(key)) { log("execution.checkin.inflight.ignored", { key: mask(key) }); return { status: "ignored" }; }
    checkinInFlight.add(key);
    try {
      if (!executionRespond) return { status: "error", error: "no-respond-endpoint" };
      const v: any = cur.view;
      const req: any = {
        taskId: cur.taskId, checkinId: key,
        deadlineVersion: Number(v.deadlineVersion) || 0, checkpointIndex: Number(v.checkpointIndex) || 0,
        kind: isMissed ? "missed" : "respond",
        responseType: isMissed ? "missed" : String(input.executionResponseType || ""),
        observation: String(input.observation || "").slice(0, 2000),
        displayedAtMs: cur.enqueuedAt,
      };
      if (Number(input.progressPct) >= 0 && Number(input.progressPct) <= 100) req.progressPct = Math.round(Number(input.progressPct));
      if (input.waitingOrigin) req.waitingOrigin = String(input.waitingOrigin).slice(0, 200);
      if (Number(input.pauseUntilMs) > 0) req.pauseUntilMs = Number(input.pauseUntilMs);
      log("execution.checkin.persist_started", { key: mask(key), kind: req.kind, responseType: req.responseType });
      let r: any = null;
      try { r = await executionRespond(req); }
      catch (e) { log("execution.checkin.respond.threw", { key: mask(key), err: errMsg(e) }); return { status: "queued" }; } // offline/rede: mantém texto; retry manual
      const dec = String((r && r.decision) || "");
      const closeLocal = (state: string) => {
        execClearTimer();
        if (activeCheckin === cur) { activeCheckin = null; try { surface.close(); } catch { /* */ } showNext(); }
        else { for (let i = checkinQueue.length - 1; i >= 0; i--) if (checkinQueue[i].key === key) checkinQueue.splice(i, 1); }
        try { if (onExecutionClosed) onExecutionClosed(key, state); } catch { /* */ }
      };
      if (dec === "responded" || dec === "missed") { log("execution.checkin.persist_success", { key: mask(key), decision: dec }); closeLocal(dec === "missed" ? "MISSED" : "RESPONDED"); return { status: "committed", deep: (cur.view as any).deep }; }
      if (dec === "already_responded") { log("execution.checkin.already_responded", { key: mask(key) }); closeLocal("RESPONDED"); return { status: "already_answered" }; }
      if (dec === "deny") {
        const reason = String((r && r.reason) || "denied");
        if (reason === "claim_held_by_other") { log("execution.checkin.claim_held_by_other", { key: mask(key) }); closeLocal("SUPPRESSED"); return { status: "already_answered" }; }
        if (reason.indexOf("checkpoint_closed_") === 0 || reason === "deadline_changed" || reason === "designer_changed") { log("execution.checkin.superseded_remote", { key: mask(key), reason }); closeLocal("SUPERSEDED"); return { status: "activity_changed" }; }
        log("execution.checkin.deny", { key: mask(key), reason });
        return { status: "error", error: reason };
      }
      return { status: "queued" };  // resposta HTTP inesperada ⇒ preserva texto p/ retry
    } finally { checkinInFlight.delete(key); }
  }
  /** DECISÃO do check-in de EXECUÇÃO (mesma IPC do azul; branch por checkinKind). */
  async function execOnDecide(cur: CheckinItem, input: any): Promise<CheckinPublicResult> {
    if (input && input.executionSnooze === true) return execSnooze(cur.key) as CheckinPublicResult;
    const rt = String((input && input.executionResponseType) || "");
    const NEG = ["nao_nao_iniciei", "nao_bloqueado", "nao_aguardando_material", "nao_conclui_minha_parte", "nao_outro"];
    if (rt !== "sim" && NEG.indexOf(rt) < 0) return { status: "ignored" };
    if (rt === "nao_conclui_minha_parte" && !(input && input.confirmPartComplete === true)) return { status: "ignored" }; // confirmação explícita (flui p/ Revisão)
    if ((cur.view as any).requireObservationOnNegative && NEG.indexOf(rt) >= 0 && !String((input && input.observation) || "").trim()) {
      return { status: "error", error: "observation_required" };
    }
    return execCommitRespond(cur, input || {}, false);
  }

  /** Suspende (preservando rascunho) o check-in ativo quando um SLA precisa da janela central. */
  function suspendActiveCheckinForSla(): void {
    if (!activeCheckin) return;
    if (execIsExecution(activeCheckin)) execClearTimer();   // F3.5.5A — laranja recolhe: timer pausa; texto preservado no draft
    checkinQueue.unshift(activeCheckin);   // volta à FRENTE da fila; rascunho preservado em .view.draft
    log("task.idle.check_suspended_for_sla", { key: mask(activeCheckin.key) });
    activeCheckin = null;
    // NÃO fecha a janela: o showNext do SLA fará surface.show(sla), substituindo o conteúdo.
  }

  /** Mostra o próximo check-in (só quando NÃO há SLA ativo/na fila) ou fecha a janela. */
  function showNextCheckin(): void {
    if (stopped) return;
    if (active || queue.length) return;         // SLA tem PRIORIDADE absoluta sobre o check-in
    if (activeCheckin) return;
    // descarta itens já respondidos (qualquer estado) — o ciclo não deve reaparecer
    // (execução NÃO usa o idleStore: o ciclo dela fecha via servidor/execCommitRespond)
    while (checkinQueue.length && !checkinQueue[0].execution && idleStore && idleStore.getResponse(checkinQueue[0].key)) checkinQueue.shift();
    // F3.5.5A — snooze/reapresentação: item com notBefore FUTURO não exibe agora (reagenda e fecha)
    if (checkinQueue.length && checkinQueue[0].execution && ((checkinQueue[0].execution.notBefore || 0) > now())) {
      execArmReshow();
      if (surface.isOpen()) { try { surface.close(); } catch { /* */ } }
      return;
    }
    if (!checkinQueue.length) { centralObs("central_alert.queue_empty", {}, "", { queueDepth: 0 }); if (surface.isOpen()) { try { surface.close(); } catch { /* */ } } return; }
    const it = checkinQueue.shift()!;
    if (!taskValid(it.taskId, it.recipientUid)) { log("task.idle.cancelled_gone", { key: mask(it.key) }); return showNextCheckin(); }
    activeCheckin = it;
    if (isLocked()) { try { const ok = surface.native(it.view); log("task.idle.locked", { key: mask(it.key), nativeOk: ok }); } catch (e) { log("task.idle.native.failed", { key: mask(it.key), err: errMsg(e) }); } return; }
    try { surface.show(it.view); } catch (e) { log("task.idle.show.failed", { key: mask(it.key), err: errMsg(e) }); }
    log("task.idle.check_shown", { key: mask(it.key), taskId: it.taskId });
    if (surface.onNoRender) { surface.onNoRender(it.key, () => { try { surface.native(it!.view); } catch { /* */ } }); }
  }

  return {
    /** Entrada do HUB: recebe um payload de SLA amarelo/vermelho já classificado. */
    enqueue(p: any): { ok: boolean; channel: string } {
      if (stopped) return { ok: false, channel: "none" };
      const level = classifyReminderLevel(p);
      if (!level) return { ok: false, channel: "not-sla" };
      // F3.5.4Q — PRIORIDADE: um SLA chegando SUSPENDE (preservando rascunho) um check-in ativo.
      suspendActiveCheckinForSla();
      const key = String((p && p.dedupKey) || "");
      if (!key) return { ok: false, channel: "none" };
      if (store.isAcked(key)) { log("sla.reminder.dedup.skipped", { key: mask(key), reason: "acked" }); return { ok: true, channel: "sla-acked" }; }
      const base = baseOf(p);
      // já na fila ou ativo com a MESMA chave ⇒ duplicata (unlock/resume/reconexão/replay)
      if ((active && active.key === key) || queue.some((q) => q.key === key)) {
        centralObs("central_alert.duplicate_dropped", p, level, { reason: "inflight" });
        log("sla.reminder.dedup.skipped", { key: mask(key), reason: "inflight" }); return { ok: true, channel: "sla-dup" };
      }
      // F3.5.4U-H1 (Defeito 2) — DEDUP LÓGICO: mesmo alerta lógico (task+destinatário+nível+marco) vindo de OUTRA
      // source/dedupKey ⇒ UMA ocorrência (não mostra duas vezes). Não afeta promoção (nível difere) nem prazo novo
      // (marco difere) nem tarefas diferentes (base difere).
      const lk = logicalOf(p, level);
      if ((active && active.key !== key && active.level === level && logicalOfItem(active) === lk) || queue.some((q) => q.level === level && logicalOfItem(q) === lk)) {
        centralObs("central_alert.duplicate_dropped", p, level, { reason: "logical" });
        store.removePending(key);
        log("sla.reminder.dedup.skipped", { key: mask(key), reason: "logical" }); return { ok: true, channel: "sla-logical-dup" };
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
      centralObs("central_alert.enqueued", p, level, { queueDepth: queue.length });
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
      centralObs("central_alert.recognized", { taskId: active.taskId, dedupKey: k }, active.level, {});
      try { if (opts.onAcked) opts.onAcked({ key: k, level: active.level, actorName: active.view.actorName, taskTitle: active.view.taskTitle, taskId: active.taskId }); } catch { /* histórico nunca derruba o ack */ }
      active = null;
      try { surface.close(); } catch { /* */ }
      log("sla.reminder.closed", { key: mask(k) });
      if (queue.length) centralObs("central_alert.next_promoted", {}, "", { queueDepth: queue.length });
      showNext();
      return true;
    },

    /**
     * F3.5.4P — DECISÃO do responsável. Fluxo (REGRA DE FECHAMENTO + C1/C2): idempotência (in-flight +
     * recibo durável) → fila durável ANTES da tentativa → TRANSAÇÃO real (persistDecision) → confirmar →
     * só então fechar/side-effects. Primeira transação vence; a 2ª recebe already_decided. Offline ⇒ fica
     * na fila (queued) e sincroniza depois. Falha de persistência local ⇒ mantém modal aberto + retry.
     */
    async onDecide(input: DecisionInput): Promise<DecisionPublicResult> {
      if (stopped) return { status: "ignored" };
      if (!decisionsEnabled()) { log("sla.decision.disabled.ignored", {}); return { status: "ignored" }; }
      const k = String((input && input.key) || "");
      if (!k || !active || active.key !== k) { log("sla.decision.stale.ignored", { key: mask(k) }); return { status: "ignored" }; }
      const cur = active;   // item ATIVO no momento da decisão (estável ao longo do await; active pode mudar)
      centralObs("central_alert.action_received", { taskId: cur.taskId, dedupKey: cur.key }, cur.level, { decisionType: String((input && (input as any).decisionType) || "") });
      const decisionType = String((input && input.decisionType) || "") as DecisionType;
      const recipientUid = cur.base.split(":")[1] || "";
      const boundary = boundaryOf(cur.key);
      const decisionKey = buildDecisionKey(cur.taskId, cur.level, boundary, recipientUid);

      // idempotência 1: duplo-clique / reentrância (mesma decisionKey em voo)
      if (inFlight.has(decisionKey)) { log("sla.decision.inflight.ignored", { key: mask(decisionKey) }); return { status: "ignored" }; }
      inFlight.add(decisionKey);
      try {
        // idempotência 2: já resolvida localmente (synced/superseded) ⇒ nunca 2ª decisão
        if (store.isDecisionSettled(decisionKey)) { log("sla.decision.already.local", { key: mask(decisionKey) }); return { status: "already_decided" }; }

        const req: DecisionPersistRequest = {
          decisionKey, taskId: cur.taskId, alertLevel: cur.level, boundaryVersion: boundary, recipientUid,
          decisionType, etaMinutes: input.etaMinutes, reasonCode: input.reasonCode, reasonText: input.reasonText,
          helpText: input.helpText, helpRecipientId: input.helpRecipientId, helpRecipientName: input.helpRecipientName,
          actorId: getUid() || recipientUid, actorName: cur.view.actorName, taskTitle: cur.view.taskTitle,
        };
        // fila durável ANTES da tentativa (sobrevive a queda/offline). Falha aqui ⇒ NÃO fecha (retry).
        try {
          store.markDecisionPending({ decisionKey, state: "pending_sync", decisionType, alertLevel: cur.level,
            boundaryVersion: boundary, recipientUid, taskId: cur.taskId, payload: req, createdAt: now(), updatedAt: now() });
        } catch (e) { log("sla.decision.persist.local.failed", { key: mask(decisionKey), err: errMsg(e) }); return { status: "error", error: "persist-local" }; }
        log("sla.decision.attempt", { key: mask(decisionKey), decisionType, level: cur.level });

        let res: DecisionPersistResult;
        try { res = await persistDecision(req); }
        catch (e) { log("sla.decision.tx.threw", { key: mask(decisionKey), err: errMsg(e) }); res = { status: "offline" }; }

        const rememberReceipt = (state: string) => { try { store.markAck(cur.key, { recipientUid, taskId: cur.taskId, eventId: cur.key, level: cur.level, appVersion, windowState: state }); } catch { /* */ } store.removePending(cur.key); };
        const closeIfStillActive = () => { if (active === cur) { active = null; try { surface.close(); } catch { /* */ } showNext(); } };

        switch (res.status) {
          case "committed": {
            store.markDecisionSynced(decisionKey, { appVersion, syncedAt: now() });
            log("sla.decision.committed", { key: mask(decisionKey), decisionType, level: cur.level });
            try { if (opts.onDecided) opts.onDecided({ decisionType, key: cur.key, level: cur.level, actorName: cur.view.actorName, taskTitle: cur.view.taskTitle, taskId: cur.taskId, etaMinutes: input.etaMinutes, reasonCode: input.reasonCode, recipientName: input.helpRecipientName }); } catch { /* sino nunca derruba o commit */ }
            rememberReceipt("decision:" + decisionType);
            closeIfStillActive();
            log("sla.decision.closed", { key: mask(decisionKey) });
            return { status: "committed", decisionType, deep: cur.view.deep };
          }
          case "already_decided": {
            store.markDecisionSuperseded(decisionKey);
            rememberReceipt("already_decided");
            log("sla.decision.already.remote", { key: mask(decisionKey) });
            return { status: "already_decided" };   // janela mostra a mensagem e chama dismiss
          }
          case "task_completed": {
            completedTasks.add(cur.taskId);
            cur.view = Object.assign({}, cur.view, { body: "Esta tarefa foi concluída enquanto o alerta estava aberto.", context: "" });
            if (active === cur) { try { surface.show(cur.view); } catch { /* */ } }
            store.markDecisionSuperseded(decisionKey);
            log("sla.decision.task.completed", { key: mask(decisionKey) });
            return { status: "task_completed" };    // janela vira "só reconhecer" (OK ⇒ ack)
          }
          case "task_deleted": {
            store.markDecisionSuperseded(decisionKey);
            rememberReceipt("task_deleted");
            log("sla.decision.task.deleted", { key: mask(decisionKey) });
            return { status: "task_deleted" };
          }
          case "not_authorized": {
            store.markDecisionSuperseded(decisionKey);
            log("sla.decision.not.authorized", { key: mask(decisionKey) });
            return { status: "error", error: "not_authorized" };   // mantém modal aberto (mensagem real)
          }
          case "offline":
          default: {
            // fica pending_sync (durável). O usuário RESPONDEU ⇒ o lembrete não deve reaparecer; a decisão
            // sincroniza depois com a MESMA transação/decisionKey (C2). NÃO declara "compartilhada" ainda.
            rememberReceipt("queued");
            log("sla.decision.queued.offline", { key: mask(decisionKey) });
            return { status: "queued" };
          }
        }
      } finally { inFlight.delete(decisionKey); }
    },

    /** Fecha a janela após uma mensagem informativa (already_decided/task_deleted/queued); recibo já gravado. */
    dismiss(key: string): void {
      const kk = String(key || "");
      if (active && active.key === kk) { active = null; try { surface.close(); } catch { /* */ } log("sla.reminder.dismissed", { key: mask(kk) }); showNext(); }
      else { try { if (surface.isOpen()) surface.close(); } catch { /* */ } }
    },

    /** Reconexão/resume/boot: re-dirige a MESMA transação p/ decisões pendentes de sync (sem duplicar). */
    async syncPendingDecisions(reason?: string): Promise<void> {
      if (stopped) return;
      const pend = store.listDecisionsPendingSync() || [];
      if (!pend.length) return;
      const uid = getUid();
      log("sla.decision.sync.start", { reason: reason || "reconnect", count: pend.length });
      for (const rec of pend) {
        if (!rec || !rec.payload) continue;
        if (uid && String(rec.recipientUid || "") !== uid) continue;   // só do usuário logado
        if (inFlight.has(rec.decisionKey)) continue;
        inFlight.add(rec.decisionKey);
        try {
          let res: DecisionPersistResult;
          try { res = await persistDecision(rec.payload); } catch { res = { status: "offline" }; }
          if (res.status === "committed") {
            store.markDecisionSynced(rec.decisionKey, { appVersion, syncedAt: now(), viaSync: true });
            log("sla.decision.sync.committed", { key: mask(rec.decisionKey) });
            try { if (opts.onDecided) opts.onDecided({ decisionType: rec.decisionType as DecisionType, key: rec.decisionKey, level: rec.alertLevel, actorName: String((rec.payload && rec.payload.actorName) || ""), taskTitle: String((rec.payload && rec.payload.taskTitle) || ""), taskId: rec.taskId, etaMinutes: rec.payload && rec.payload.etaMinutes, reasonCode: rec.payload && rec.payload.reasonCode, recipientName: rec.payload && rec.payload.helpRecipientName }); } catch { /* */ }
          } else if (res.status === "already_decided" || res.status === "task_completed" || res.status === "task_deleted" || res.status === "not_authorized") {
            store.markDecisionSuperseded(rec.decisionKey);
            log("sla.decision.sync.superseded", { key: mask(rec.decisionKey), reason: res.status });
          } else { log("sla.decision.sync.stillPending", { key: mask(rec.decisionKey) }); /* permanece pending_sync */ }
        } finally { inFlight.delete(rec.decisionKey); }
      }
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
        else if (activeCheckin) { // F3.5.4Q — check-in ativo (sem SLA): nativa + recoloca na fila p/ reexibir no unlock
          try { const ok = surface.native(activeCheckin.view); log("task.idle.locked", { key: mask(activeCheckin.key), nativeOk: ok, switched: true }); } catch (e) { log("task.idle.native.failed", { err: errMsg(e) }); }
          checkinQueue.unshift(activeCheckin); activeCheckin = null; try { surface.close(); } catch { /* */ }
        }
      } else {
        // unlock: se havia ativo (mostrado em nativa), reabre central; e reconcilia pendentes
        if (active && !surface.isOpen()) { try { surface.show(active.view); log("sla.reminder.unlock.reshown", { key: mask(active.key), single: true }); } catch { /* */ } }
        this.reconcile("unlock");
        if (!active && !queue.length && !activeCheckin) showNextCheckin();   // F3.5.4Q — restaura o check-in suspenso
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
    // ═══════════════ F3.5.4Q — CHECK-IN DE TAREFA PARADA: API pública ═══════════════
    /** Produtor idle: há amarelo/vermelho ativo ou na fila? (o produtor não emite check-in enquanto sim) */
    hasPendingSla(): boolean { return !!active || queue.length > 0; },

    /** Enfileira uma pergunta de check-in (prioridade ABAIXO do SLA; persistente sem duplicar). */
    enqueueCheckin(p: any): { ok: boolean; channel: string } {
      if (stopped) return { ok: false, channel: "none" };
      if (!idleEnabled()) return { ok: false, channel: "idle-off" };
      const key = String((p && (p.idleCheckKey || p.dedupKey || p.key)) || "");
      if (!key) return { ok: false, channel: "none" };
      if (idleStore && idleStore.getResponse(key)) return { ok: true, channel: "idle-answered" };   // já respondido ⇒ não reabrir
      if ((activeCheckin && activeCheckin.key === key) || checkinQueue.some((q) => q.key === key)) return { ok: true, channel: "idle-dup" };
      const view = buildCheckinView(p);
      const item: CheckinItem = { key, view, taskId: view.taskId, recipientUid: view.recipientUid, enqueuedAt: now() };
      if (String((view as any).checkinKind || "") === "execution") item.execution = { representedCount: 0, snoozeUsed: false }; // F3.5.5A
      checkinQueue.push(item);
      log("task.idle.check_queued", { key: mask(key), pending: checkinPendingCount() });
      if (!active && !queue.length && !activeCheckin) showNextCheckin();   // só quando a janela central está livre de SLA
      return { ok: true, channel: "idle-central" };
    },

    /** Rascunho do check-in (preserva o preenchido p/ suspend/restore). */
    onCheckinDraft(key: string, draft: any): void {
      const k = String(key || "");
      if (activeCheckin && activeCheckin.key === k) { activeCheckin.view = Object.assign({}, activeCheckin.view, { draft }); return; }
      for (const it of checkinQueue) if (it.key === k) { it.view = Object.assign({}, it.view, { draft }); return; }
    },

    /** DECISÃO do check-in — TRANSAÇÃO real; 1ª vence; 2ª already_answered; nova atividade activity_changed. */
    async onCheckinDecide(input: CheckinDecisionInput): Promise<CheckinPublicResult> {
      if (stopped) return { status: "ignored" };
      const k0 = String((input && input.key) || "");
      // F3.5.5A — CHECK-IN DE EXECUÇÃO: mesma IPC, decide TRANSACIONAL server-side (nunca a via idle)
      if (activeCheckin && activeCheckin.key === k0 && execIsExecution(activeCheckin)) {
        return execOnDecide(activeCheckin, input as any);
      }
      if (!idleEnabled()) { log("task.idle.disabled.ignored", {}); return { status: "ignored" }; }
      const k = k0;
      if (!k || !activeCheckin || activeCheckin.key !== k) { log("task.idle.stale.ignored", { key: mask(k) }); return { status: "ignored" }; }
      const cur = activeCheckin;
      const responseType = String((input && input.responseType) || "") as CheckinResponseType;
      if (responseType === "return_to_todo" && !input.confirmReturn) return { status: "ignored" };   // exige confirmação explícita
      const idleCheckKey = cur.key;
      if (checkinInFlight.has(idleCheckKey)) { log("task.idle.inflight.ignored", { key: mask(idleCheckKey) }); return { status: "ignored" }; }
      checkinInFlight.add(idleCheckKey);
      try {
        if (idleStore && idleStore.isResponseSettled(idleCheckKey)) { log("task.idle.already.local", { key: mask(idleCheckKey) }); return { status: "already_answered" }; }
        const req: IdlePersistRequest = {
          idleCheckKey, taskId: cur.taskId, recipientUid: cur.recipientUid, responseType,
          activityBoundaryVersion: cur.view.activityBoundaryVersion, statusVersion: cur.view.statusVersion, thresholdVersion: cur.view.thresholdVersion,
          reasonCode: input.reasonCode, reasonText: input.reasonText, helpText: input.helpText,
          helpRecipientId: input.helpRecipientId, helpRecipientName: input.helpRecipientName,
          actorId: getUid() || cur.recipientUid, actorName: cur.view.actorName, taskTitle: cur.view.taskTitle,
        };
        try {
          if (idleStore) idleStore.markResponsePending({ idleCheckKey, state: "pending_sync", responseType, recipientUid: cur.recipientUid, taskId: cur.taskId, activityBoundaryVersion: cur.view.activityBoundaryVersion, payload: req, createdAt: now(), updatedAt: now() });
        } catch (e) { log("task.idle.persist.local.failed", { key: mask(idleCheckKey), err: errMsg(e) }); return { status: "error", error: "persist-local" }; }
        log("task.idle.persist_started", { key: mask(idleCheckKey), responseType });

        let res: IdlePersistResult;
        try { res = await persistIdleResponse(req); }
        catch (e) { log("task.idle.tx.threw", { key: mask(idleCheckKey), err: errMsg(e) }); res = { status: "offline" }; }

        const closeIfActive = () => { if (activeCheckin === cur) { activeCheckin = null; try { surface.close(); } catch { /* */ } showNext(); } };
        switch (res.status) {
          case "committed": {
            if (idleStore) idleStore.markResponseSynced(idleCheckKey, { syncedAt: now() });
            log("task.idle.persist_success", { key: mask(idleCheckKey), responseType });
            try { if (opts.onIdleResponded) opts.onIdleResponded({ responseType, idleCheckKey, actorName: cur.view.actorName, taskTitle: cur.view.taskTitle, taskId: cur.taskId, reasonCode: input.reasonCode, recipientName: input.helpRecipientName }); } catch { /* sino nunca derruba o commit */ }
            closeIfActive();
            return { status: "committed", responseType, deep: cur.view.deep };
          }
          case "already_answered": { if (idleStore) idleStore.markResponseSuperseded(idleCheckKey); log("task.idle.already_answered", { key: mask(idleCheckKey) }); return { status: "already_answered" }; }
          case "activity_changed": { if (idleStore) idleStore.markResponseSuperseded(idleCheckKey); log("task.idle.activity_changed", { key: mask(idleCheckKey) }); return { status: "activity_changed" }; }
          case "task_completed": { if (idleStore) idleStore.markResponseSuperseded(idleCheckKey); log("task.idle.cancelled_completed", { key: mask(idleCheckKey) }); return { status: "task_completed" }; }
          case "task_deleted": { if (idleStore) idleStore.markResponseSuperseded(idleCheckKey); log("task.idle.cancelled_deleted", { key: mask(idleCheckKey) }); return { status: "task_deleted" }; }
          case "not_authorized": { if (idleStore) idleStore.markResponseSuperseded(idleCheckKey); log("task.idle.not.authorized", { key: mask(idleCheckKey) }); return { status: "error", error: "not_authorized" }; }
          case "offline":
          default: { log("task.idle.offline_queued", { key: mask(idleCheckKey), responseType }); return { status: "queued" }; }   // fica pending_sync; sincroniza depois
        }
      } finally { checkinInFlight.delete(idleCheckKey); }
    },

    /** Fecha o check-in ativo após uma mensagem (already_answered / activity_changed / task_completed / task_deleted / queued). */
    dismissCheckin(key: string): void {
      const kk = String(key || "");
      if (activeCheckin && activeCheckin.key === kk) { if (execIsExecution(activeCheckin)) execClearTimer(); activeCheckin = null; try { surface.close(); } catch { /* */ } log("task.idle.dismissed", { key: mask(kk) }); showNext(); }
      else { for (let i = checkinQueue.length - 1; i >= 0; i--) if (checkinQueue[i].key === kk) checkinQueue.splice(i, 1); }
    },

    /** Reconexão/resume/boot: re-dirige a MESMA transação p/ respostas idle pendentes de sync (sem duplicar). */
    async syncPendingIdleResponses(reason?: string): Promise<void> {
      if (stopped || !idleStore) return;
      const pend = idleStore.listResponsesPendingSync() || [];
      if (!pend.length) return;
      const uid = getUid();
      log("task.idle.sync.start", { reason: reason || "reconnect", count: pend.length });
      for (const rec of pend) {
        if (!rec || !rec.payload) continue;
        if (uid && String(rec.recipientUid || "") !== uid) continue;
        if (checkinInFlight.has(rec.idleCheckKey)) continue;
        checkinInFlight.add(rec.idleCheckKey);
        try {
          let res: IdlePersistResult;
          try { res = await persistIdleResponse(rec.payload); } catch { res = { status: "offline" }; }
          if (res.status === "committed") {
            idleStore.markResponseSynced(rec.idleCheckKey, { syncedAt: now(), viaSync: true });
            log("task.idle.offline_synced", { key: mask(rec.idleCheckKey) });
            try { if (opts.onIdleResponded) opts.onIdleResponded({ responseType: rec.responseType as CheckinResponseType, idleCheckKey: rec.idleCheckKey, actorName: String((rec.payload && rec.payload.actorName) || ""), taskTitle: String((rec.payload && rec.payload.taskTitle) || ""), taskId: rec.taskId, reasonCode: rec.payload && rec.payload.reasonCode, recipientName: rec.payload && rec.payload.helpRecipientName }); } catch { /* */ }
          } else if (res.status === "already_answered" || res.status === "activity_changed" || res.status === "task_completed" || res.status === "task_deleted" || res.status === "not_authorized") {
            idleStore.markResponseSuperseded(rec.idleCheckKey);
            log("task.idle.superseded", { key: mask(rec.idleCheckKey), reason: res.status });
          } else { log("task.idle.sync.stillPending", { key: mask(rec.idleCheckKey) }); }
        } finally { checkinInFlight.delete(rec.idleCheckKey); }
      }
    },

    status() { return { open: surface.isOpen(), activeKey: active ? mask(active.key) : "", queueLen: pendingCount() }; },
    _debug() { return { active, queue: queue.slice() }; },
    /** Logout / troca de usuário: fecha a janela e limpa a memória (store PRESERVADO; o próximo login reexibe os pendentes do novo uid). */
    /** F3.5.5A — ACK de render do check-in de EXECUÇÃO ⇒ inicia a janela de resposta (nunca antes). */
    onExecutionRendered(key: string): void { onExecutionRendered(key); },
    clearActive() { try { surface.close(); } catch { /* */ } active = null; queue.length = 0; completedTasks.clear(); activeCheckin = null; checkinQueue.length = 0; execClearTimer(); },
    stop() { stopped = true; try { surface.close(); } catch { /* */ } queue.length = 0; active = null; checkinQueue.length = 0; activeCheckin = null; execClearTimer(); },
  };
}

function snapshot(p: any): any {
  if (!p || typeof p !== "object") return {};
  const keep = ["dedupKey", "eventId", "eventType", "severity", "taskId", "taskTitle", "clientName", "targetUserId", "responsibleName", "responsibleAvatar", "actorName", "actorAvatar", "title", "body", "context", "action", "subtitle"];
  const out: any = {}; for (const k of keep) if (p[k] !== undefined) out[k] = p[k]; return out;
}
function mask(s: string): string { const v = String(s || ""); return v.length <= 8 ? v : v.slice(0, 4) + "…" + v.slice(-4); }
function errMsg(e: unknown): string { try { return String((e as any) && (e as any).message || e); } catch { return "err"; } }
