/**
 * F3.5.3 — notifEvents.js — EVENTO CANÔNICO DURÁVEL da Categoria A (CommonJS, PURO).
 * =====================================================================================
 * Deriva os eventos de notificação GERAL (atribuição/reatribuição/movimentação/conclusão/
 * reabertura) diretamente do DOCUMENTO canônico da tarefa — a MESMA fonte que a Desktop
 * já grava hoje em toda ação real (history[] {kind:'moved'|'designer_moved',from,to,at,byId}
 * e designerAssignment {designerId,assignedAt,assignedBy,...}). Por ser derivado do doc
 * (level-based, como o SLA da Categoria B), o evento é RECUPERÁVEL a qualquer momento:
 * backlog pós-desligamento = re-derivar dos docs + filtrar por cursor/recibos.
 *
 * Identidade determinística (NUNCA Date.now() isolado):
 *   task_moved:<taskId>:<from>><to>:<at>:<byId>        (at/byId vêm do PRÓPRIO doc)
 *   task_completed / task_reopened — mesma base
 *   task_assigned:<taskId>:<designerId>:<assignedAt>   (campos do próprio doc)
 *
 * recipientMode: 'all_active_users' — Categoria A é GERAL (inclui o ator e o atribuído).
 * T-30/T-10 (Categoria B) NÃO passam por aqui — permanecem em slaRules/cardsRules
 * (sla_personal, somente o Designer responsável), byte-idênticas.
 *
 * PURO: sem Electron, sem Firestore, sem rede, sem relógio implícito (nowMs injetado).
 */
'use strict';

var RETENTION_MS_DEFAULT = 30 * 24 * 60 * 60 * 1000; // 30 dias (contrato de retenção)

/* Rótulos das colunas reais do quadro (renderer STATUS[] + eixo do designer). */
var COLUMN_LABEL = {
  afazer: 'A Fazer', andamento: 'Em andamento', revisao: 'Revisão',
  concluido: 'Concluído', entregue: 'Concluído'
};
function columnLabel(k) { return COLUMN_LABEL[String(k || '')] || String(k || ''); }

function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
function str(v) { return (v == null) ? '' : String(v); }

/** Classifica UMA entrada de history[] {kind,from,to,at,byId} no tipo Categoria A. */
function classifyMove(from, to) {
  var f = str(from), t = str(to);
  var toDone = (t === 'concluido' || t === 'entregue');
  var fromDone = (f === 'concluido' || f === 'entregue');
  if (toDone && !fromDone) return 'task_completed';
  if (fromDone && !toDone) return 'task_reopened';
  return 'task_moved';
}

/**
 * Deriva TODOS os eventos Categoria A recuperáveis do documento da tarefa.
 * @param {object} t  doc da tarefa (com id)
 * @param {object} o  { nowMs (obrigatório p/ retenção), retentionMs? }
 * @returns lista ordenada (at asc, eventId asc) de eventos canônicos:
 *   { eventId, type, recipientMode, taskId, taskTitle, sector, actorId, actorNameDenorm,
 *     assignedDesignerId, assignedDesignerNameDenorm, fromStatus, toStatus, at }
 */
function deriveTaskEvents(t, o) {
  var out = [];
  if (!t || !t.id) return out;
  o = o || {};
  var nowMs = num(o.nowMs) || 0;
  var retMs = num(o.retentionMs) || RETENTION_MS_DEFAULT;
  var minAt = nowMs ? (nowMs - retMs) : 0;
  var taskId = str(t.id), title = str(t.title) || 'Tarefa', sector = str(t.sector);

  // 1) MOVIMENTAÇÕES/CONCLUSÃO/REABERTURA — history[] gravado pelo PRÓPRIO escritor da ação.
  var hs = Array.isArray(t.history) ? t.history : [];
  for (var i = 0; i < hs.length; i++) {
    var e = hs[i] || {};
    var kind = str(e.kind);
    if (kind !== 'moved' && kind !== 'designer_moved') continue;
    var at = num(e.at) || num(e.atMs);
    if (!at || (minAt && at < minAt)) continue;
    var from = str(e.from), to = str(e.to);
    if (!to) continue;
    var type = classifyMove(from, to);
    var byId = str(e.byId || e.byUid);
    out.push({
      eventId: type + ':' + taskId + ':' + from + '>' + to + ':' + at + ':' + byId,
      type: type, recipientMode: 'all_active_users',
      taskId: taskId, taskTitle: title, sector: sector,
      actorId: byId, actorNameDenorm: (typeof e.by === 'string' ? e.by : ''),
      assignedDesignerId: '', assignedDesignerNameDenorm: '',
      fromStatus: from, toStatus: to, at: at
    });
  }

  // 2) ATRIBUIÇÃO (cronograma/designer) — designerAssignment do próprio doc (assignedAt carimba).
  var da = (t.designerAssignment && typeof t.designerAssignment === 'object') ? t.designerAssignment : null;
  if (da && da.designerId && num(da.assignedAt) && (!minAt || num(da.assignedAt) >= minAt)) {
    var aAt = num(da.assignedAt);
    out.push({
      eventId: 'task_assigned:' + taskId + ':' + str(da.designerId) + ':' + aAt,
      type: 'task_assigned', recipientMode: 'all_active_users',
      taskId: taskId, taskTitle: title, sector: sector,
      actorId: str(da.assignedBy), actorNameDenorm: str(da.assignedByName),
      assignedDesignerId: str(da.designerId), assignedDesignerNameDenorm: str(da.designerName),
      fromStatus: '', toStatus: '', at: aAt
    });
  }

  // 3) ATRIBUIÇÃO DIRETA (sem designerAssignment) — assigneeId + createdAt do próprio doc.
  if ((!da || !da.designerId) && t.assigneeId && num(t.createdAt) && (!minAt || num(t.createdAt) >= minAt)) {
    var cAt = num(t.createdAt);
    out.push({
      eventId: 'task_assigned:' + taskId + ':' + str(t.assigneeId) + ':' + cAt,
      type: 'task_assigned', recipientMode: 'all_active_users',
      taskId: taskId, taskTitle: title, sector: sector,
      actorId: str(t.by), actorNameDenorm: '',
      assignedDesignerId: str(t.assigneeId), assignedDesignerNameDenorm: str(t.assignee || t.assigneeName),
      fromStatus: '', toStatus: '', at: cAt
    });
  }

  out.sort(function (a, b) { return (a.at - b.at) || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0); });
  return out;
}

/* ---- CONTEÚDO OFICIAL (contrato F3.5.3 — títulos/corpos verbatim) ---- */
function evTitle(type) {
  if (type === 'task_assigned' || type === 'task_reassigned') return 'Tarefa atribuída';
  if (type === 'task_moved') return 'Tarefa movimentada';
  if (type === 'task_completed') return 'Tarefa concluída';
  if (type === 'task_reopened') return 'Tarefa reaberta';
  return 'Agenda ID Seven';
}
function evBody(ev, ator, designer) {
  var T = '‘' + (ev.taskTitle || 'Tarefa') + '’'; // ‘{TAREFA}’
  var A = ator || 'Equipe';
  if (ev.type === 'task_assigned' || ev.type === 'task_reassigned') {
    return A + ' atribuiu ' + T + ' para ' + (designer || 'a equipe') + '.';
  }
  if (ev.type === 'task_moved') {
    return A + ' moveu ' + T + ' de ' + columnLabel(ev.fromStatus) + ' para ' + columnLabel(ev.toStatus) + '.';
  }
  if (ev.type === 'task_completed') return A + ' concluiu ' + T + '.';
  if (ev.type === 'task_reopened') return A + ' reabriu ' + T + ' em ' + columnLabel(ev.toStatus) + '.';
  return T;
}
function evSeverity(type) {
  if (type === 'task_completed') return 'success';
  if (type === 'task_reopened') return 'warning';
  return 'info';
}

/**
 * Constrói o payload do HUB p/ o evento Categoria A (entrega a TODOS os usuários ativos —
 * o filtro antigo team_flow NÃO se aplica; ator INCLUÍDO por contrato).
 * resolveName(id) → nome real do diretório (usersPublic) ou ''.
 */
function buildCategoryAPayload(ev, uid, resolveName) {
  var rn = (typeof resolveName === 'function') ? resolveName : function () { return ''; };
  var ator = rn(ev.actorId) || ev.actorNameDenorm || '';
  var designer = rn(ev.assignedDesignerId) || ev.assignedDesignerNameDenorm || '';
  return {
    eventId: ev.eventId, dedupKey: ev.eventId,
    eventType: ev.type, notificationType: 'all_active_users',
    taskId: ev.taskId, taskTitle: ev.taskTitle, clientName: '',
    actorId: ev.actorId || '', actorName: ator, actorAvatar: '',
    responsibleId: ev.assignedDesignerId || '', responsibleName: designer, responsibleAvatar: '',
    targetUserId: uid, createdAt: ev.at,
    title: evTitle(ev.type), body: evBody(ev, ator, designer),
    context: ev.fromStatus ? (columnLabel(ev.fromStatus) + ' → ' + columnLabel(ev.toStatus)) : 'Tarefas',
    severity: evSeverity(ev.type), sound: true,
    action: { type: 'detail', deep: 'detail/' + ev.taskId },
    source: 'notifierA', providerCalled: false
  };
}

module.exports = {
  RETENTION_MS_DEFAULT: RETENTION_MS_DEFAULT,
  COLUMN_LABEL: COLUMN_LABEL, columnLabel: columnLabel,
  classifyMove: classifyMove, deriveTaskEvents: deriveTaskEvents,
  evTitle: evTitle, evBody: evBody, evSeverity: evSeverity,
  buildCategoryAPayload: buildCategoryAPayload
};
