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

/* F3.5.5E — MÓDULOS RETIRADOS (Copywriting, Roteiro, Programação de Posts — ordem do owner).
   Identificação SOMENTE por chave canônica de setor + aliases legados oficiais (copy/postagem).
   NUNCA por título, cliente, descrição ou texto escrito pelo usuário. */
var RETIRED_SECTORS = { copywriting: 1, roteiro: 1, programacao_posts: 1, copy: 1, postagem: 1 };
function isRetiredSector(raw) { return !!RETIRED_SECTORS[str(raw)]; }
/* F3.5.5E — rótulo OFICIAL do setor p/ a superfície da notificação (a chave crua 'edicao_midia'/
   'cronograma' nunca mais aparece ao usuário). Espelha SECTORS/SECTOR_ALIAS do renderer. */
var SECTOR_LABELS = {
  edicao_midia: 'Edição de vídeos', design: 'Edição de vídeos',
  cronograma: 'Cronograma', edicao_cards: 'Edição de Cards',
  copywriting: 'Copywriting', copy: 'Copywriting',
  roteiro: 'Roteiro', programacao_posts: 'Programação de posts', postagem: 'Programação de posts'
};
function sectorLabelOf(raw) { return SECTOR_LABELS[str(raw)] || ''; }
/* F3.5.5E — contexto do Cronograma na notificação. REGRA DO OWNER: NUNCA inferir periodicidade
   pela contagem (3≠semanal, 6≠quinzenal, 12≠mensal). Legado = subtipo REAL gravado no doc
   (subtype/cronSub ∈ semanal|quinzenal|mensal) ⇒ 'Cronograma <sub> • N temas'. Personalizado
   (sem subtipo) ⇒ 'Cronograma • N temas' (N = comprimento REAL de cronContents → cronQty).
   Sem contagem conhecida ⇒ 'Cronograma' (fallback profissional; nunca vazio/undefined). */
function cronNotifContext(sector, subtype, cronQty, cronLen) {
  if (str(sector) !== 'cronograma') return '';
  var subMap = { semanal: 'semanal', quinzenal: 'quinzenal', mensal: 'mensal' };
  var sub = subMap[str(subtype)] || '';
  var n = num(cronLen) || num(cronQty) || 0;
  if (!n && sub) { var lm = { semanal: 3, quinzenal: 6, mensal: 12 }; n = lm[str(subtype)] || 0; }
  var base = 'Cronograma' + (sub ? (' ' + sub) : '');
  return n >= 1 ? (base + ' • ' + n + ' tema' + (n === 1 ? '' : 's')) : base;
}

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
  // F3.5.5E — tarefa de módulo retirado NUNCA gera evento novo (backlog pós-desligamento incluso).
  // Nada é apagado: o doc permanece intacto; apenas nenhuma notificação nasce dele.
  if (isRetiredSector(sector)) return out;
  // F3.5.5E — contexto canônico p/ a notificação premium (fonte: o PRÓPRIO doc; nunca o título):
  var evClient = str(t.client);
  var evSubtype = str(t.subtype || t.cronSub);
  var evCronQty = num(t.cronQty);
  var evCronLen = Array.isArray(t.cronContents) ? t.cronContents.length : 0;

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
      actorPhotoDenorm: '',
      assignedDesignerId: '', assignedDesignerNameDenorm: '', assignedDesignerPhotoDenorm: '',
      fromStatus: from, toStatus: to, at: at
    });
  }

  // 1b) F3.5.4F — EDIÇÃO DE TAREFA (task_updated): derivada das entradas history[]
  // {kind:'edited', at, byId, by, fields[], forId, forName, prevDue*/newDue*} gravadas pelo
  // PRÓPRIO escritor da edição (saveCardsEdit no renderer). Level-based e RECUPERÁVEL como
  // os demais (backlog pós-desligamento re-deriva do doc). DESTINATÁRIO: SOMENTE o designer
  // atribuído NO MOMENTO da edição (forId) — recipientMode 'assigned_designer' (o notifierA
  // filtra por uid): nunca todos, nunca o designer antigo pós-reatribuição, nunca inativo
  // (sem sessão ⇒ sem entrega, contrato F3.5.3).
  for (var j = 0; j < hs.length; j++) {
    var ee = hs[j] || {};
    if (str(ee.kind) !== 'edited') continue;
    var eat = num(ee.at) || num(ee.atMs);
    if (!eat || (minAt && eat < minAt)) continue;
    var ebyId = str(ee.byId || ee.byUid);
    var prevD = str(ee.prevDueDate), prevT = str(ee.prevDueTime);
    var newD = str(ee.newDueDate), newT = str(ee.newDueTime);
    var dueChanged = ((prevD + '|' + prevT) !== (newD + '|' + newT));
    out.push({
      eventId: 'task_updated:' + taskId + ':' + eat + ':' + ebyId,
      type: 'task_updated', recipientMode: 'assigned_designer',
      recipientId: str(ee.forId),
      taskId: taskId, taskTitle: title, sector: sector,
      actorId: ebyId, actorNameDenorm: (typeof ee.by === 'string' ? ee.by : ''),
      actorPhotoDenorm: '',
      assignedDesignerId: str(ee.forId), assignedDesignerNameDenorm: str(ee.forName),
      assignedDesignerPhotoDenorm: '',
      fromStatus: '', toStatus: '', at: eat,
      changedFields: Array.isArray(ee.fields) ? ee.fields.slice(0, 12) : [],
      dueChanged: dueChanged,
      prevDueDate: prevD, prevDueTime: prevT, newDueDate: newD, newDueTime: newT
    });
  }

  // 1c) F3.5.4P — DECISÃO DE SLA que gera notificação INDIVIDUAL: help_requested + blocked. Derivada das
  // entradas history[] {kind:'sla_decision', decisionType, forId (help), blockedRecipientIds (blocked)}
  // gravadas pela TRANSAÇÃO. start_now/finishing/acknowledge_only NÃO notificam ninguém (contrato).
  // Recipient-targeted (notifierA filtra por uid): help ⇒ forId (destinatário escolhido/visível, C5);
  // blocked ⇒ cada blockedRecipientId (criador/Social — regra auditada; NÃO todos os admins). eventId
  // determinístico (nunca Date.now()); NUNCA agrupada (allowlist exclui + denylist reforça).
  for (var q = 0; q < hs.length; q++) {
    var de = hs[q] || {};
    if (str(de.kind) !== 'sla_decision') continue;
    var dAt = num(de.at) || num(de.atMs);
    if (!dAt || (minAt && dAt < minAt)) continue;
    var dBy = str(de.byId || de.byUid);
    var dType = str(de.decisionType);
    if (dType === 'help_requested') {
      var hRec = str(de.forId);
      if (!hRec) continue;
      out.push({
        eventId: 'help_requested:' + taskId + ':' + dAt + ':' + hRec,
        type: 'help_requested', recipientMode: 'assigned_designer', recipientId: hRec,
        taskId: taskId, taskTitle: title, sector: sector,
        actorId: dBy, actorNameDenorm: (typeof de.by === 'string' ? de.by : ''), actorPhotoDenorm: '',
        assignedDesignerId: '', assignedDesignerNameDenorm: '', assignedDesignerPhotoDenorm: '',
        fromStatus: '', toStatus: '', at: dAt,
        helpText: (typeof de.helpText === 'string' ? de.helpText.slice(0, 140) : '')
      });
    } else if (dType === 'blocked') {
      var bRecs = Array.isArray(de.blockedRecipientIds) ? de.blockedRecipientIds : [];
      for (var b = 0; b < bRecs.length; b++) {
        var bRec = str(bRecs[b]);
        if (!bRec || bRec === dBy) continue;
        out.push({
          eventId: 'blocked:' + taskId + ':' + dAt + ':' + bRec,
          type: 'blocked', recipientMode: 'assigned_designer', recipientId: bRec,
          taskId: taskId, taskTitle: title, sector: sector,
          actorId: dBy, actorNameDenorm: (typeof de.by === 'string' ? de.by : ''), actorPhotoDenorm: '',
          assignedDesignerId: '', assignedDesignerNameDenorm: '', assignedDesignerPhotoDenorm: '',
          fromStatus: '', toStatus: '', at: dAt,
          reasonCode: str(de.reasonCode)
        });
      }
    }
  }

  // 1d) F3.5.4Q — RESPOSTA de CHECK-IN de tarefa parada que gera notificação INDIVIDUAL: help + blocked.
  // Derivada de history[] {kind:'task_idle_response', responseType, helpRecipientId (help), blockedRecipientIds
  // (blocked)} gravadas pela TRANSAÇÃO do check-in. working/return_to_todo NÃO notificam aqui (o
  // return_to_todo grava também a movimentação canônica → a notificação de movimentação existente cobre isso,
  // sem duplicar). REUSA os MESMOS tipos help_requested/blocked (mesma entrega/toast/sino/never-group da
  // 1.0.206) — sem novo tipo de payload. eventId determinístico; NUNCA agrupada.
  for (var qi = 0; qi < hs.length; qi++) {
    var ie = hs[qi] || {};
    if (str(ie.kind) !== 'task_idle_response') continue;
    var iAt = num(ie.at) || num(ie.atMs);
    if (!iAt || (minAt && iAt < minAt)) continue;
    var iBy = str(ie.byId || ie.byUid);
    var iType = str(ie.responseType);
    if (iType === 'help_requested') {
      var ihRec = str(ie.helpRecipientId || ie.forId);
      if (!ihRec) continue;
      out.push({
        eventId: 'help_requested:' + taskId + ':' + iAt + ':' + ihRec,
        type: 'help_requested', recipientMode: 'assigned_designer', recipientId: ihRec,
        taskId: taskId, taskTitle: title, sector: sector,
        actorId: iBy, actorNameDenorm: (typeof ie.by === 'string' ? ie.by : ''), actorPhotoDenorm: '',
        assignedDesignerId: '', assignedDesignerNameDenorm: '', assignedDesignerPhotoDenorm: '',
        fromStatus: '', toStatus: '', at: iAt,
        helpText: (typeof ie.helpText === 'string' ? ie.helpText.slice(0, 140) : '')
      });
    } else if (iType === 'blocked') {
      var ibRecs = Array.isArray(ie.blockedRecipientIds) ? ie.blockedRecipientIds : [];
      for (var ib = 0; ib < ibRecs.length; ib++) {
        var ibRec = str(ibRecs[ib]);
        if (!ibRec || ibRec === iBy) continue;
        out.push({
          eventId: 'blocked:' + taskId + ':' + iAt + ':' + ibRec,
          type: 'blocked', recipientMode: 'assigned_designer', recipientId: ibRec,
          taskId: taskId, taskTitle: title, sector: sector,
          actorId: iBy, actorNameDenorm: (typeof ie.by === 'string' ? ie.by : ''), actorPhotoDenorm: '',
          assignedDesignerId: '', assignedDesignerNameDenorm: '', assignedDesignerPhotoDenorm: '',
          fromStatus: '', toStatus: '', at: iAt,
          reasonCode: str(ie.reasonCode)
        });
      }
    }
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
      actorPhotoDenorm: str(da.assignedByAvatar || da.assignedByPhoto),
      assignedDesignerId: str(da.designerId), assignedDesignerNameDenorm: str(da.designerName),
      assignedDesignerPhotoDenorm: str(da.designerAvatar || da.designerPhoto),
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
      actorPhotoDenorm: '',
      assignedDesignerId: str(t.assigneeId), assignedDesignerNameDenorm: str(t.assignee || t.assigneeName),
      assignedDesignerPhotoDenorm: str(t.assigneePhoto),
      fromStatus: '', toStatus: '', at: cAt
    });
  }

  // F3.5.5E — contexto uniforme em TODOS os eventos derivados (dados do doc; aditivo; sem rede).
  for (var _x = 0; _x < out.length; _x++) {
    out[_x].client = evClient; out[_x].subtype = evSubtype;
    out[_x].cronQty = evCronQty; out[_x].cronLen = evCronLen;
  }
  out.sort(function (a, b) { return (a.at - b.at) || (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0); });
  return out;
}

/* ---- CONTEÚDO OFICIAL (contrato F3.5.3 — títulos/corpos verbatim) ---- */
/* F3.5.4F — 'YYYY-MM-DD','HH:MM' → 'DD/MM/YYYY às HH:MM' (transformação PURA de string;
   nenhum parse de Date, nenhum fuso). Campos incompletos degradam com segurança. */
function fmtBRDT(d, t) {
  d = str(d); t = str(t);
  var m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var dd = m ? (m[3] + '/' + m[2] + '/' + m[1]) : d;
  return t ? (dd + ' às ' + t) : dd;
}
function evTitle(type) {
  if (type === 'task_assigned' || type === 'task_reassigned') return 'Tarefa atribuída';
  if (type === 'task_moved') return 'Tarefa movimentada';
  if (type === 'task_completed') return 'Tarefa concluída';
  if (type === 'task_reopened') return 'Tarefa reaberta';
  if (type === 'task_updated') return 'Tarefa atualizada';   // F3.5.4F
  if (type === 'help_requested') return 'Pedido de ajuda';   // F3.5.4P
  if (type === 'blocked') return 'Tarefa bloqueada';         // F3.5.4P
  return 'Agenda ID Seven';
}
// F3.5.4P — rótulo humano do reasonCode (enum), p/ o corpo do bloqueio. NUNCA usa o texto livre.
function reasonLabelNE(rc) {
  var m = { material: 'aguardando material', social: 'aguardando Social Media', cliente: 'aguardando cliente', aprovacao: 'aguardando aprovação', tecnico: 'problema técnico', informacao: 'falta de informação', dependencia: 'dependência', demanda: 'demanda maior', outro: 'outro motivo' };
  return m[str(rc)] || 'motivo';
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
  // F3.5.4F — task_updated: corpo padrão do owner; com PRAZO alterado mostra anterior → novo.
  if (ev.type === 'task_updated') {
    if (ev.dueChanged) return A + ' atualizou o prazo: ' + fmtBRDT(ev.prevDueDate, ev.prevDueTime) + ' → ' + fmtBRDT(ev.newDueDate, ev.newDueTime);
    return A + ' atualizou ' + T + '.';
  }
  // F3.5.4P — pedido de ajuda: nome do solicitante + motivo resumido (sem dados sensíveis).
  if (ev.type === 'help_requested') return A + ' pediu ajuda em ' + T + (ev.helpText ? ': ' + ev.helpText : '.');
  // F3.5.4P — bloqueio: nome do responsável + rótulo do motivo (enum), nunca o texto livre.
  if (ev.type === 'blocked') return A + ' informou bloqueio em ' + T + (ev.reasonCode ? ' (' + reasonLabelNE(ev.reasonCode) + ').' : '.');
  return T;
}
function evSeverity(type) {
  if (type === 'task_completed') return 'success';
  if (type === 'task_reopened') return 'warning';
  if (type === 'help_requested' || type === 'blocked') return 'warning';   // F3.5.4P — distinto do SLA (vermelho)
  return 'info';
}

/**
 * Constrói o payload do HUB p/ o evento Categoria A (entrega a TODOS os usuários ativos —
 * o filtro antigo team_flow NÃO se aplica; ator INCLUÍDO por contrato).
 * resolveName(id) → nome real do diretório (usersPublic) ou ''.
 */
// F3.5.3A — resolveProfile(id) → {name, photo} (diretório usersPublic do notifierA). Retro-compat:
// funções antigas que retornavam só o NOME (string) seguem aceitas.
function buildCategoryAPayload(ev, uid, resolveProfile) {
  var AP = require('./actorProfile');
  var look = function (id) {
    if (!id || typeof resolveProfile !== 'function') return null;
    var r = null; try { r = resolveProfile(id); } catch (_e) { r = null; }
    if (r == null) return null;
    if (typeof r === 'string') return { name: r, photo: '' };
    return { name: (r && r.name) || '', photo: (r && r.photo) || '' };
  };
  var atorP = AP.resolveNotificationActorProfile({ actorId: ev.actorId, nameDenorm: ev.actorNameDenorm, photoDenorm: ev.actorPhotoDenorm }, look);
  var respP = AP.resolveNotificationActorProfile({ actorId: ev.assignedDesignerId, nameDenorm: ev.assignedDesignerNameDenorm, photoDenorm: ev.assignedDesignerPhotoDenorm }, look);
  var ator = atorP.name || '';
  var designer = respP.name || '';
  // F3.5.4F — contexto do task_updated: prazo anterior → novo quando o prazo mudou.
  var ctx = ev.fromStatus ? (columnLabel(ev.fromStatus) + ' → ' + columnLabel(ev.toStatus)) : 'Tarefas';
  if (ev.type === 'task_updated') ctx = ev.dueChanged ? ('Prazo: ' + fmtBRDT(ev.prevDueDate, ev.prevDueTime) + ' → ' + fmtBRDT(ev.newDueDate, ev.newDueTime)) : 'Tarefa atualizada';
  if (ev.type === 'help_requested') ctx = 'Pedido de ajuda';   // F3.5.4P
  if (ev.type === 'blocked') ctx = 'Bloqueio informado';       // F3.5.4P
  return {
    eventId: ev.eventId, dedupKey: ev.eventId,
    eventType: ev.type, notificationType: (ev.recipientMode === 'assigned_designer' ? 'assigned_designer' : 'all_active_users'),
    taskId: ev.taskId, taskTitle: ev.taskTitle, clientName: str(ev.client || ''),   /* F3.5.5E — cliente CANÔNICO do doc (antes: sempre vazio — causa provada do card sem cliente) */
    actorId: ev.actorId || '', actorName: ator, actorAvatar: atorP.photo,
    responsibleId: ev.assignedDesignerId || '', responsibleName: designer, responsibleAvatar: respP.photo,
    targetUserId: uid, createdAt: ev.at,
    title: evTitle(ev.type), body: evBody(ev, ator, designer),
    context: ctx,
    // F3.5.4U — campos ESTRUTURADOS OPCIONAIS (ADITIVOS) p/ o layout premium das notificações comuns.
    // Dado já existente no evento derivado (deriveTaskEvents) — NENHUM cálculo/rede/destinatário novo. A
    // superfície premium monta o card a partir destes campos (chips de movimento + setor) SEM depender do
    // body genérico (evita repetir ator/tarefa). O `body` e o `context` acima permanecem intactos p/ o
    // sino/histórico e p/ o fallback retrocompatível (flag OFF / payloads antigos). Chaves cruas de status
    // (afazer/andamento/revisao/concluido/entregue) — a superfície traduz via columnLabel e escolhe a cor.
    fromStatus: ev.fromStatus || '', toStatus: ev.toStatus || '', sector: ev.sector || '',
    // F3.5.5E — campos ADITIVOS da notificação premium: rótulo oficial do setor (chave crua nunca
    // aparece) + contexto do Cronograma (subtipo legado REAL ou 'Cronograma • N temas' — sem
    // periodicidade inventada). Payloads antigos continuam válidos (campos opcionais).
    sectorLabel: sectorLabelOf(ev.sector), cronContext: cronNotifContext(ev.sector, ev.subtype, ev.cronQty, ev.cronLen),
    severity: evSeverity(ev.type), sound: true,
    action: { type: 'detail', deep: 'detail/' + ev.taskId },
    source: 'notifierA', providerCalled: false
  };
}

module.exports = {
  RETENTION_MS_DEFAULT: RETENTION_MS_DEFAULT,
  COLUMN_LABEL: COLUMN_LABEL, columnLabel: columnLabel,
  classifyMove: classifyMove, deriveTaskEvents: deriveTaskEvents,
  evTitle: evTitle, evBody: evBody, evSeverity: evSeverity, fmtBRDT: fmtBRDT,
  buildCategoryAPayload: buildCategoryAPayload,
  /* F3.5.5E — módulos retirados + contexto premium */
  isRetiredSector: isRetiredSector, sectorLabelOf: sectorLabelOf, cronNotifContext: cronNotifContext
};
