/**
 * I7.27.1-EXT — slaEscalationRules.js — ESCALAÇÃO DE PRAZO PARA TAREFA NÃO INICIADA (CommonJS, PURO).
 * =====================================================================================
 * LACUNA PROVADA NA AUDITORIA (§0/§1 do mandato): o SLA do designer (slaRules) só nasce quando a
 * tarefa é INICIADA (designerSla é semeado no move para "Em andamento"); Edição de Cards tem o
 * regime próprio T-30/T-10 (cardsRules) e o check-in de atividade (taskIdle) só cobre "andamento".
 * NENHUMA regra cobrava o designer que recebeu a tarefa, a deixou em "A Fazer" e viu o prazo se
 * aproximar. Este módulo fecha essa lacuna — SEM novo engine: é um PRODUTOR PURO plugado no
 * slaScheduler EXISTENTE (mesmo listener Firestore, MESMO timer único auto-reagendável ≤60s,
 * MESMO seen-store persistente, MESMO deliverNotification). Padrão idêntico ao cardsRules (F3.5.2).
 *
 * VERDADE "NÃO INICIOU" (§2): a coluna canônica do designer (designerCol) ainda é 'afazer' — ou
 * seja, nenhuma transição válida ocorreu desde a atribuição (o move para andamento troca a coluna
 * E semeia designerSla). NÃO usa updatedAt (muda por edições irrelevantes).
 *   idleSince = designerAssignment.assignedAt (momento REAL em que a responsabilidade passou ao
 *   designer) → fallback createdAt.  dueAt = t.dueAt canônico (ms) → slaPanelFinishMs (mesma
 *   precedência do Painel SLA: plannedFinishAt → planDueAt → assignment.end → dueDate/dueTime).
 *
 * POLÍTICA (§3, banda ATUAL = 0 ou 1 payload; a banda mais alta SUBSTITUI as anteriores — nunca
 * catch-up retroativo de bandas inferiores no boot):
 *   LEVEL 1 WARNING   ≤ 24h  → deadline_warning     (toast/premium + sino; severidade warning)
 *   LEVEL 2 HIGH RISK ≤ 6h   → deadline_high_risk   (toast/premium + sino; severidade critical)
 *   LEVEL 3 CRITICAL  ≤ 2h   → sla_deadline_critical (JANELA CENTRAL persistente até reconhecer)
 *   LEVEL 4 OVERDUE   vencido→ sla_deadline_overdue  (JANELA CENTRAL crítica)
 * O prefixo "sla_" é o contrato EXISTENTE do HUB (classifyReminderLevel) para a janela central; os
 * níveis 1/2 deliberadamente NÃO o usam para seguirem pelo toast/premium comum.
 *
 * DEDUPE (§7) — chave semântica: sla_deadline:<nível>:<taskId>:<uid>:<dueAtMs>. Cruzar um novo
 * threshold = chave nova (permitido); repetir a avaliação = mesma chave (seen-store bloqueia).
 * RESET (§8): mover para andamento ⇒ designerCol ≠ 'afazer' ⇒ nenhuma emissão; trocar designer ⇒
 * uid diferente ⇒ chaves novas para o novo responsável (o antigo deixa de ser destinatário);
 * mudar prazo ⇒ dueAtMs diferente ⇒ thresholds recalculados; concluir/cancelar/remover ⇒ inelegível.
 * DESTINATÁRIO (§6): somente o DESIGNER RESPONSÁVEL ATUAL (resolveNotificationTargets sla_personal).
 * Read-side puro: NUNCA grava Firestore; nenhum timer próprio; nenhum listener próprio.
 */
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
var S = require('./slaRules');   // SOMENTE helpers puros (slaRules permanece intacto)
// eslint-disable-next-line @typescript-eslint/no-var-requires
var NE = require('./notifEvents'); // isRetiredSector (chave canônica de setor)

var H = 3600000, MIN = 60000;
var THRESHOLDS = { warning: 24 * H, high: 6 * H, critical: 2 * H };  // overdue = no prazo
var LEVELS = ['warning', 'high', 'critical', 'overdue'];
var LEVEL_EVENT = { warning: 'deadline_warning', high: 'deadline_high_risk', critical: 'sla_deadline_critical', overdue: 'sla_deadline_overdue' };
var LEVEL_SEVERITY = { warning: 'warning', high: 'critical', critical: 'critical', overdue: 'critical' };
var LEVEL_THRESHOLD_TAG = { warning: 'T_MINUS_24H', high: 'T_MINUS_6H', critical: 'T_MINUS_2H', overdue: 'OVERDUE' };

function num(v){ var n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }
function sectorKeyOf(t){ try{ return String(((S.secOf(t && t.sector) || {}).key) || ''); }catch(_e){ return String((t && t.sector) || ''); } }

/* prazo canônico (ms): dueAt persistido → precedência do Painel SLA (slaPanelFinishMs). */
function deadlineMs(t){
  var d = num(t && t.dueAt); if(d) return d;
  try{ return num(S.slaPanelFinishMs(t)); }catch(_e){ return 0; }
}
/* momento REAL em que a responsabilidade passou ao designer. */
function idleSinceMs(t){
  var da = (t && t.designerAssignment) || {};
  return num(da.assignedAt) || num(da.assignedAtMs) || num(t && t.designerAssignedAt) || num(t && t.createdAt) || 0;
}
function isCompleted(t){
  try{ if(S.isTaskCompleted && S.isTaskCompleted(t)) return true; }catch(_e){}
  try{ if(S.slaPanelDelivered(t)) return true; }catch(_e){}
  var st = String((t && t.status) || '');
  return st === 'concluido' || st === 'cancelado' || st === 'removido';
}

/**
 * isEscalationEligible(task, nowMs) — condições INTRÍNSECAS (sempre devolve contexto + reason).
 * Elegível = tarefa viva, setor com designer (não retirado, não roteiro, não edicao_cards — regime
 * T-30/T-10 próprio), designer atribuído, coluna do designer ainda 'afazer', sem espera externa,
 * prazo canônico conhecido.
 */
function isEscalationEligible(t, nowMs){
  var now = num(nowMs);
  var da = (t && t.designerAssignment) || {};
  var base = { recipientUid: String(da.designerId || ''), dueAtMs: deadlineMs(t), idleSinceMs: idleSinceMs(t), status: '', sector: sectorKeyOf(t) };
  try{ base.status = String(S.designerCol(t) || ''); }catch(_e){ base.status = String((t && t.status) || ''); }
  var no = function(reason){ return Object.assign({ eligible: false, reason: reason }, base); };
  if(!t || !t.id) return no('no_task');
  var raw = String((t && t.sector) || '');
  if(raw === 'edicao_cards') return no('cards_own_regime');
  try{ if(NE.isRetiredSector(raw)) return no('retired_sector'); }catch(_e){}
  if(base.sector === 'roteiro') return no('no_designer_sla');
  if(!base.recipientUid) return no('no_designer');
  if(isCompleted(t)) return no('completed_or_gone');
  if(base.status !== 'afazer') return no('started');
  try{ if(S.externalWaitOf && S.externalWaitOf(t)) return no('waiting_client'); }catch(_e){}
  if(!base.dueAtMs) return no('no_due');
  if(!(now > 0)) return no('no_now');
  return Object.assign({ eligible: true, reason: 'eligible' }, base);
}

/** banda ATUAL pelo prazo (a mais alta vence) ou '' se ainda longe. */
function escalationBand(dueAtMs, nowMs){
  var due = num(dueAtMs), now = num(nowMs); if(!due || !now) return '';
  if(now >= due) return 'overdue';
  if(now >= due - THRESHOLDS.critical) return 'critical';
  if(now >= due - THRESHOLDS.high) return 'high';
  if(now >= due - THRESHOLDS.warning) return 'warning';
  return '';
}

/* ── textos objetivos (§13: sem linguagem hostil) ── */
function pad2(n){ return (n < 10 ? '0' : '') + n; }
function fmtHM(ms){ try{ var d = new Date(ms); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }catch(_e){ return ''; } }
function fmtRemaining(ms){
  ms = Math.max(0, Number(ms) || 0);
  var m = Math.floor(ms / MIN);
  if(m < 1) return 'menos de 1min';
  if(m < 60) return m + 'min';
  var h = Math.floor(m / 60), r = m % 60;
  return r ? (h + 'h ' + r + 'min') : (h + 'h');
}
function sameDay(a, b){ var x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); }
function whenText(dueAtMs, nowMs){
  var hm = fmtHM(dueAtMs);
  if(sameDay(dueAtMs, nowMs)) return 'hoje às ' + hm;
  if(sameDay(dueAtMs, nowMs + 86400000)) return 'amanhã às ' + hm;
  try{ var d = new Date(dueAtMs); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' às ' + hm; }catch(_e){ return hm; }
}
function textsFor(level, dueAtMs, nowMs){
  var w = whenText(dueAtMs, nowMs), rem = fmtRemaining(dueAtMs - nowMs), over = fmtRemaining(nowMs - dueAtMs);
  if(level === 'overdue') return { title: 'Prazo vencido — tarefa não iniciada', body: 'Esta tarefa ainda não foi iniciada e o prazo terminou ' + w + '.', context: 'Prazo vencido há ' + over };
  if(level === 'critical') return { title: 'Prazo crítico — tarefa não iniciada', body: 'Esta tarefa ainda não foi iniciada e o prazo termina ' + w + '.', context: 'Prazo crítico · faltam ' + rem };
  if(level === 'high') return { title: 'Prazo em risco — tarefa não iniciada', body: 'Esta tarefa ainda não foi iniciada e o prazo termina ' + w + '.', context: 'Faltam ' + rem };
  return { title: 'Prazo em 24h — tarefa não iniciada', body: 'Esta tarefa ainda não foi iniciada e o prazo termina ' + w + '.', context: 'Faltam ' + rem };
}

/** chave semântica (§7): taskId + assignee + threshold + dueAt. */
function escalationKey(level, taskId, uid, dueAtMs){ return 'sla_deadline:' + String(level) + ':' + String(taskId) + ':' + String(uid) + ':' + String(dueAtMs); }

/**
 * escalationEmissionsFor(task, uid, nowMs) — [payload] da banda ATUAL (0 ou 1), roteado SÓ ao
 * designer responsável logado. eventType/severity/dedupKey por nível; campos ADITIVOS anexados
 * após o notifBuildPayload (allowlist fixa do construtor congelado): kind/deadlineLevel/dueAtMs/
 * idleSinceMs/slaThreshold/recipientUid.
 */
function escalationEmissionsFor(task, uid, nowMs){
  var out = [];
  try{
    var t = task; if(!t) return out;
    var now = (typeof nowMs === 'number') ? nowMs : Date.now();
    var el = isEscalationEligible(t, now); if(!el.eligible) return out;
    var tg = S.resolveNotificationTargets({ eventType: 'sla_warning', task: t, currentUser: { id: uid } });
    if(!tg.shouldNotifyCurrentUser) return out;                      // pessoal: só o designer responsável
    var level = escalationBand(el.dueAtMs, now); if(!level) return out;
    var resp = S.notifResponsibleDenorm(t);
    var tx = textsFor(level, el.dueAtMs, now);
    var tl = (t.title || 'Tarefa') + (t.client ? (' — ' + t.client) : '');
    var pl = S.notifBuildPayload({
      eventType: LEVEL_EVENT[level], severity: LEVEL_SEVERITY[level], sound: true,
      taskId: t.id, taskTitle: t.title || 'Tarefa', clientName: t.client || '',
      actorId: resp.id, actorName: resp.name, actorAvatar: resp.avatar,
      responsibleId: resp.id, responsibleName: resp.name, responsibleAvatar: resp.avatar,
      targetUserId: uid, notificationType: 'sla_personal', etapa: 'A Fazer', status: 'afazer',
      subtitle: tl, title: tx.title, body: tx.body, context: tx.context,
      anchor: el.dueAtMs, createdAt: now, action: { type: 'detail', deep: 'detail/' + t.id },
      dedupKey: escalationKey(level, t.id, uid, el.dueAtMs), source: 'sla-escalation',
    });
    pl.kind = 'deadline'; pl.deadlineLevel = level; pl.dueAtMs = el.dueAtMs; pl.idleSinceMs = el.idleSinceMs;
    pl.slaThreshold = LEVEL_THRESHOLD_TAG[level]; pl.recipientUid = uid; pl._premiumCommon = false;
    out.push(pl);
  }catch(_e){}
  return out;
}

/** PRÓXIMO marco futuro (due−24h / due−6h / due−2h / due) p/ ESTA tarefa, ou 0 — integra o timer único. */
function escalationNextBoundaryMs(task, nowMs){
  try{
    var now = (typeof nowMs === 'number') ? nowMs : Date.now();
    var el = isEscalationEligible(task, now); if(!el.eligible) return 0;
    var due = el.dueAtMs;
    var bs = [due - THRESHOLDS.warning, due - THRESHOLDS.high, due - THRESHOLDS.critical, due], best = 0;
    for(var k = 0; k < bs.length; k++){ if(bs[k] > now && (!best || bs[k] < best)) best = bs[k]; }
    return best;
  }catch(_e){ return 0; }
}

module.exports = {
  THRESHOLDS: THRESHOLDS, LEVELS: LEVELS, LEVEL_EVENT: LEVEL_EVENT, LEVEL_SEVERITY: LEVEL_SEVERITY, LEVEL_THRESHOLD_TAG: LEVEL_THRESHOLD_TAG,
  deadlineMs: deadlineMs, idleSinceMs: idleSinceMs, isEscalationEligible: isEscalationEligible, escalationBand: escalationBand,
  fmtRemaining: fmtRemaining, whenText: whenText, textsFor: textsFor, escalationKey: escalationKey,
  escalationEmissionsFor: escalationEmissionsFor, escalationNextBoundaryMs: escalationNextBoundaryMs,
};
