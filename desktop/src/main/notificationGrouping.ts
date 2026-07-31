/**
 * F3.5.4O — notificationGrouping.ts — AGRUPAMENTO INTELIGENTE das notificações COMUNS.
 * =====================================================================================
 * CONTROLADOR PURO/INJETÁVEL (sem Electron, sem rede, sem relógio implícito ⇒ testável).
 * Evita que o usuário receba VÁRIAS notificações comuns repetidas sobre a MESMA tarefa +
 * MESMO destinatário: a PRIMEIRA aparece em tempo real (não espera 5s); as subsequentes,
 * dentro de uma janela de 5s, ATUALIZAM a MESMA superfície (contador + lista) — sem 2ª
 * janela, sem repetir o som, sem roubar foco. A janela fecha depois; evento posterior
 * inicia um NOVO grupo.
 *
 * POSIÇÃO NO PIPELINE (main.ts deliverNotification): APÓS o dedup individual (_notifSeen)
 * e a captura no sino (notif-history, POR EVENTO), e ANTES da criação da superfície visual
 * comum (toast/premium). NÃO substitui dedupKey/recibos/cursor/listener/notifierA/scheduler
 * nem as regras de destinatário. O sino continua guardando CADA evento individualmente.
 *
 * DENYLIST (nunca agrupar ⇒ passthrough individual): sla_ (amarelo/vermelho) e operational_block (SLA central),
 * qualquer severity 'critical', sessão bloqueada (tratada no main, não chega aqui como
 * agrupável), event_new (Agenda id único), flow_* (transições de etapa distintas), app_update,
 * e QUALQUER eventType desconhecido/não listado. "EVENTO DESCONHECIDO → NÃO AGRUPAR."
 *
 * ALLOWLIST (comuns auditados, recorrentes por tarefa): task_moved, task_updated,
 * task_assigned, task_reassigned, task_completed, task_reopened, designer_assigned.
 *
 * Chave de grupo: common_group:<recipientUid>:<taskId> — taskId é a AUTORIDADE (nunca só o
 * título). Sem taskId ou sem destinatário ⇒ passthrough (não há chave estável).
 *
 * Flag notificationCommonGroupingEnabled (default ON): OFF ⇒ passthrough sempre (1.0.204).
 *
 * Observabilidade SANITIZADA: emite via onLog eventos notification.group.* (ids mascarados;
 * nunca conteúdo/cliente/token/uid|taskId integral/email/base64).
 */

export type GroupAction = "first" | "update" | "passthrough";

export type GroupItemView = {
  title: string;      // título curto do evento (ex.: "Tarefa movimentada")
  body: string;       // corpo curto (ex.: "Fulano moveu ... de A para B.")
  actorName: string;  // quem fez (1º nome/nome real já resolvido a montante)
  severity: string;   // info|success|warning
  time: string;       // HH:MM local (carimbado pela superfície; aqui vazio — puro)
};

export type GroupView = {
  groupKey: string;
  taskId: string;
  taskTitle: string;
  count: number;             // total de eventos no grupo (inclui o 1º)
  items: GroupItemView[];    // até maxVisibleItems, MAIS RECENTES primeiro
  extraCount: number;        // count - items.length (para "+N outras atualizações")
  deep: string;              // deep-link da tarefa (clique abre a tarefa)
  primaryName: string;       // nome principal (ator do evento mais recente)
  primaryAvatar: string;     // avatar principal
  severity: string;          // severidade do evento mais recente (cor da faixa)
};

export type GroupDecision = { action: GroupAction; groupKey: string; view: GroupView | null };

export type NotificationGroupingOpts = {
  now?: () => number;
  groupWindowMs?: number;            // janela de agrupamento (default 5000; constante documentada)
  maxVisibleItems?: number;          // itens visíveis na janela premium (default 5)
  maxTrackedGroups?: number;         // teto defensivo de grupos ativos rastreados
  isEnabled?: () => boolean;         // feature flag (default ON)
  onLog?: (tag: string, data?: unknown) => void;
};

// F3.5.4O — allowlist EXPLÍCITA e EXCLUSIVA de eventTypes comuns auditados. Qualquer coisa
// fora daqui ⇒ NÃO agrupa (passthrough). Congela o universo do agrupamento a esta fase.
const GROUPABLE_EVENT_TYPES: Record<string, true> = {
  task_moved: true,
  task_updated: true,
  task_assigned: true,
  task_reassigned: true,
  task_completed: true,
  task_reopened: true,
  designer_assigned: true,
};

// F3.5.4O — denylist EXPLÍCITA (defesa em profundidade; a allowlist já exclui, mas isto
// documenta e blinda contra reintrodução acidental de um eventType sensível).
function isDenylisted(eventType: string, severity: string): boolean {
  if (/^sla_/.test(eventType)) return true;               // amarelo/vermelho de SLA
  if (eventType === "operational_block") return true;     // bloqueio operacional
  if (eventType === "event_new") return true;             // Agenda (id único)
  if (/^flow_/.test(eventType)) return true;              // transições de etapa distintas
  if (eventType === "app_update") return true;            // updater
  if (severity === "critical") return true;               // nunca agrupar crítico
  return false;
}

type GroupState = {
  groupKey: string;
  recipientUid: string;
  taskId: string;
  taskTitle: string;
  firstAt: number;
  lastAt: number;
  count: number;
  items: GroupItemView[];     // TODOS os itens em ordem de chegada (index 0 = 1º)
  lastSeverity: string;
  lastActorName: string;
  lastActorAvatar: string;
  deep: string;
};

function s(v: unknown): string { return v == null ? "" : String(v); }
function mask(v: unknown): string { const t = s(v); if (!t) return ""; return t.length <= 6 ? (t.slice(0, 2) + "…") : (t.slice(0, 4) + "…" + t.slice(-2)); }

export function isGroupableEventType(eventType: string): boolean {
  return GROUPABLE_EVENT_TYPES[String(eventType || "")] === true;
}

export function createNotificationGrouping(opts?: NotificationGroupingOpts) {
  opts = opts || {};
  const now = opts.now || (() => Date.now());
  const groupWindowMs = typeof opts.groupWindowMs === "number" && opts.groupWindowMs > 0 ? opts.groupWindowMs : 5000;
  const maxVisibleItems = typeof opts.maxVisibleItems === "number" && opts.maxVisibleItems > 0 ? opts.maxVisibleItems : 5;
  const maxTrackedGroups = typeof opts.maxTrackedGroups === "number" && opts.maxTrackedGroups > 0 ? opts.maxTrackedGroups : 200;
  const isEnabled = opts.isEnabled || (() => true);
  const log = opts.onLog || (() => { /* observabilidade nunca derruba a entrega */ });

  const groups = new Map<string, GroupState>();

  function keyOf(p: any): string {
    const uid = s(p && p.targetUserId);
    const taskId = s(p && p.taskId);
    if (!uid || !taskId) return "";
    return "common_group:" + uid + ":" + taskId;
  }

  function groupable(p: any): boolean {
    if (!isEnabled()) return false;
    if (!p || typeof p !== "object") return false;
    const eventType = s(p.eventType);
    const severity = s(p.severity);
    if (!isGroupableEventType(eventType)) return false;   // allowlist exclusiva
    if (isDenylisted(eventType, severity)) return false;  // defesa em profundidade
    if (!s(p.taskId) || !s(p.targetUserId)) return false; // sem chave estável
    return true;
  }

  function itemOf(p: any): GroupItemView {
    return {
      title: s(p.title),
      body: s(p.body),
      actorName: s(p.actorName || p.responsibleName),
      severity: s(p.severity) || "info",
      time: "", // a superfície carimba o HH:MM (puro aqui; sem relógio de parede)
    };
  }

  function viewOf(g: GroupState): GroupView {
    // MAIS RECENTES primeiro; até maxVisibleItems; o restante vira "+N outras atualizações".
    const recent = g.items.slice(-maxVisibleItems).reverse();
    const extraCount = Math.max(0, g.count - recent.length);
    return {
      groupKey: g.groupKey,
      taskId: g.taskId,
      taskTitle: g.taskTitle,
      count: g.count,
      items: recent,
      extraCount,
      deep: g.deep,
      primaryName: g.lastActorName,
      primaryAvatar: g.lastActorAvatar,
      severity: g.lastSeverity || "info",
    };
  }

  // Descarta grupos cuja janela já fechou (limpeza preguiçosa + teto defensivo).
  function sweep(t0: number): void {
    if (groups.size <= maxTrackedGroups) {
      // limpeza leve: remove janelas expiradas encontradas em O(n) só quando cresce
      if (groups.size < Math.floor(maxTrackedGroups / 2)) return;
    }
    for (const [k, g] of groups) {
      if (t0 - g.firstAt >= groupWindowMs) groups.delete(k);
    }
    // teto absoluto: se ainda excede, remove os mais antigos por firstAt
    if (groups.size > maxTrackedGroups) {
      const arr = Array.from(groups.values()).sort((a, b) => a.firstAt - b.firstAt);
      for (let i = 0; i < arr.length && groups.size > maxTrackedGroups; i++) groups.delete(arr[i].groupKey);
    }
  }

  return {
    /** Constantes/estado para observabilidade e testes. */
    windowMs: groupWindowMs,
    maxItems: maxVisibleItems,
    isGroupable(p: any): boolean { return groupable(p); },
    keyOf(p: any): string { return keyOf(p); },
    activeCount(): number { return groups.size; },

    /**
     * Decide o destino de um evento COMUM já deduplicado individualmente.
     * @returns {action:'passthrough'} entrega individual (1.0.204);
     *          {action:'first', groupKey} 1º do grupo (cria superfície normal, marca groupKey);
     *          {action:'update', groupKey, view} atualiza a MESMA superfície (sem 2ª janela/som/foco).
     */
    route(p: any): GroupDecision {
      const t0 = now();
      if (!groupable(p)) {
        // observabilidade só quando a flag está ligada mas o evento não é agrupável (auditoria)
        if (isEnabled() && p && typeof p === "object") {
          const et = s(p.eventType);
          if (!isGroupableEventType(et)) log("notification.group.skipped.unknown", { eventType: et, taskId: mask(p && p.taskId) });
          else log("notification.group.skipped.denylist", { eventType: et, severity: s(p && p.severity), taskId: mask(p && p.taskId) });
        } else if (!isEnabled()) {
          log("notification.group.skipped.flagoff", {});
        }
        return { action: "passthrough", groupKey: "", view: null };
      }
      const groupKey = keyOf(p);
      const existing = groups.get(groupKey);
      // Janela FIXA a partir do 1º evento: dentro de [firstAt, firstAt+window) ⇒ update; fora ⇒ novo grupo.
      if (existing && (t0 - existing.firstAt) < groupWindowMs) {
        existing.count++;
        existing.items.push(itemOf(p));
        existing.lastAt = t0;
        existing.lastSeverity = s(p.severity) || "info";
        existing.lastActorName = s(p.actorName || p.responsibleName) || existing.lastActorName;
        existing.lastActorAvatar = s(p.actorAvatar || p.responsibleAvatar) || existing.lastActorAvatar;
        if (s(p.taskTitle)) existing.taskTitle = s(p.taskTitle);
        const deep = (p.action && p.action.deep) ? s(p.action.deep) : existing.deep;
        existing.deep = deep;
        const view = viewOf(existing);
        log("notification.group.updated", { groupKey: mask(groupKey), count: existing.count, visible: view.items.length, extra: view.extraCount, taskId: mask(existing.taskId), recipientUid: mask(existing.recipientUid) });
        return { action: "update", groupKey, view };
      }
      // NOVO grupo (nenhum ativo OU janela do anterior já fechou). Substitui o estado expirado.
      const g: GroupState = {
        groupKey,
        recipientUid: s(p.targetUserId),
        taskId: s(p.taskId),
        taskTitle: s(p.taskTitle) || "Tarefa",
        firstAt: t0,
        lastAt: t0,
        count: 1,
        items: [itemOf(p)],
        lastSeverity: s(p.severity) || "info",
        lastActorName: s(p.actorName || p.responsibleName),
        lastActorAvatar: s(p.actorAvatar || p.responsibleAvatar),
        deep: (p.action && p.action.deep) ? s(p.action.deep) : (p.taskId ? "detail/" + s(p.taskId) : ""),
      };
      groups.set(groupKey, g);
      sweep(t0);
      log("notification.group.opened", { groupKey: mask(groupKey), taskId: mask(g.taskId), recipientUid: mask(g.recipientUid), reopened: !!existing, windowMs: groupWindowMs });
      return { action: "first", groupKey, view: null };
    },

    /** Fecha explicitamente um grupo (ex.: superfície informou dismiss). Best-effort. */
    close(groupKey: string): void {
      const k = s(groupKey); if (!k) return;
      if (groups.delete(k)) log("notification.group.closed", { groupKey: mask(k) });
    },

    /** Snapshot SANITIZADO p/ diagnóstico (sem conteúdo/uid|taskId integral). */
    snapshot(): { enabled: boolean; windowMs: number; maxItems: number; active: number } {
      return { enabled: !!isEnabled(), windowMs: groupWindowMs, maxItems: maxVisibleItems, active: groups.size };
    },

    /** Troca de usuário/logout: limpa grupos em memória (não afeta sino/recibos). */
    reset(): void { groups.clear(); log("notification.group.reset", {}); },
    stop(): void { groups.clear(); },
  };
}
