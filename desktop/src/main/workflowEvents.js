/**
 * F3.5.6A — workflowEvents.js — MOTOR DE ORQUESTRAÇÃO + POLÍTICA DE NOTIFICAÇÃO (PURO, CommonJS).
 * =====================================================================================
 * Fica ANTES do sistema de notificações aprovado (1.0.228). Este módulo:
 *   1. DERIVA os EVENTOS OPERACIONAIS canônicos do LEDGER durável do doc da tarefa
 *      (tasks.workflowEvents — escrito pelo Worker nas decisões/envio/visualização do
 *      cliente e pelo próprio app nas ações da equipe), com eventId determinístico;
 *   2. DECIDE a política: QUEM deve ser avisado, SE deve, prioridade, som, agregação e o
 *      texto com a PRÓXIMA AÇÃO ("o que aconteceu + o que fazer agora");
 *   3. NÃO ENTREGA nada: a entrega é 100% do ingresso aprovado deliverNotification
 *      (main.ts) — visual/topmost/handoff/agrupamento/dedupe/sons CONGELADOS intactos.
 * PURO: sem Electron, sem Firestore, sem rede, sem relógio implícito (nowMs injetado).
 * Nada aqui carrega token/senha/conteúdo de tema/legenda — só metadados mínimos.
 */
'use strict';

var WF_RETENTION_MS_DEFAULT = 30 * 24 * 60 * 60 * 1000;   // mesmo contrato de retenção da Categoria A

/* Fases persistidas (espelho do enum gravado pelo Worker V64.61 / renderer 1.0.229). */
var WF_PHASES = {
  THEMES_PREPARATION: 'themes_preparation',
  THEMES_WAITING_CLIENT: 'themes_waiting_client',
  THEMES_ADJUSTMENT: 'themes_adjustment',
  ASSIGNMENT_PENDING: 'assignment_pending',
  DESIGN_PRODUCTION: 'design_production',
  DESIGN_REVIEW: 'design_review',
  CAPTIONS_PREPARATION: 'captions_preparation',
  CAPTIONS_WAITING_CLIENT: 'captions_waiting_client',
  CAPTIONS_ADJUSTMENT: 'captions_adjustment',
  COMPLETED: 'completed'
};

/* Rótulos humanos da fase (UI usa o espelho do renderer; aqui p/ payloads/diagnóstico). */
var WF_PHASE_LABELS = {
  themes_preparation: 'Preparação dos temas',
  themes_waiting_client: 'Aguardando cliente — temas',
  themes_adjustment: 'Ajuste dos temas',
  assignment_pending: 'Atribuir Designers',
  design_production: 'Produção (Design)',
  design_review: 'Revisão de design',
  captions_preparation: 'Preparação das legendas',
  captions_waiting_client: 'Aguardando cliente — legendas',
  captions_adjustment: 'Ajuste das legendas',
  completed: 'Concluída'
};

function wfIsWaitingClientPhase(p) {
  return p === WF_PHASES.THEMES_WAITING_CLIENT || p === WF_PHASES.CAPTIONS_WAITING_CLIENT;
}

/* ── LEDGER → eventos canônicos ─────────────────────────────────────────────── */
/** deriveLedgerEvents(t, {nowMs, retentionMs}) → [{id,lk,type,at,phase,roundKey,src,by,ru,ii,n,tot}] asc.
 *  F3.5.6A-H1 — o id do evento é GLOBAL (taskId + chave do ledger). A chave do ledger sozinha
 *  ('ev_dec_ar_themes_r1') se repete em TODA tarefa (toda tarefa começa na rodada 1): usar só ela
 *  colidia recibo persistente, dedupe do HUB e dedupe das superfícies ENTRE TAREFAS — a 1ª tarefa
 *  aprovada carimbava o recibo e silenciava para sempre a aprovação de todas as seguintes (causa
 *  provada da falha física da 1.0.229). lk preserva a chave crua p/ a migração dos recibos legados. */
function deriveLedgerEvents(t, o) {
  o = o || {};
  var nowMs = Number(o.nowMs) || 0;
  var retMs = Number(o.retentionMs) || WF_RETENTION_MS_DEFAULT;
  var minAt = nowMs > 0 ? (nowMs - retMs) : 0;
  var led = (t && t.workflowEvents && typeof t.workflowEvents === 'object') ? t.workflowEvents : {};
  var tid = String((t && t.id) || '');
  var out = [];
  for (var k in led) {
    if (!Object.prototype.hasOwnProperty.call(led, k)) continue;
    var e = led[k]; if (!e || typeof e !== 'object') continue;
    var at = Number(e.at) || 0; if (!(at > 0)) continue;
    if (minAt > 0 && at < minAt) continue;
    var type = String(e.t || ''); if (!type) continue;
    out.push({
      id: (tid ? (tid + ':') : '') + String(k), lk: String(k), type: type, at: at,
      phase: String(e.ph || ''), roundKey: String(e.rd || ''),
      src: String(e.src || ''), by: String(e.by || ''),
      ru: String(e.ru || ''), ii: (e.ii == null ? null : Number(e.ii)),
      n: Number(e.n) || 0, tot: Number(e.tot) || 0,
      taskId: (t && t.id) || ''
    });
  }
  out.sort(function (a, b) { return (a.at - b.at) || (a.id < b.id ? -1 : 1); });
  return out;
}

/* ── Estado canônico dos ITENS de design (fonte: designerItemStatus por índice) ── */
function designItemsSummary(t) {
  var arr = Array.isArray(t && t.cronContents) ? t.cronContents : [];
  var total = arr.length;
  var st = (t && t.designerItemStatus && typeof t.designerItemStatus === 'object') ? t.designerItemStatus : {};
  var withStatus = 0, concluded = 0, allConcluded = total > 0;
  for (var i = 0; i < total; i++) {
    var e = st['i' + i];
    var s = (e && typeof e === 'object') ? String(e.st || '') : '';
    if (s) withStatus++;
    if (s === 'concluido') concluded++;
    else allConcluded = false;
  }
  return { total: total, withStatus: withStatus, concluded: concluded,
    usesItemStatus: withStatus > 0, allConcluded: (total > 0 && allConcluded) };
}

/* Ciclo de produção = quantas rodadas de TEMAS já foram aprovadas (chaves idempotentes
   da equipe usam o ciclo p/ que reatribuição/reconclusão no MESMO ciclo não duplique). */
function wfCycleN(t) {
  var rounds = (t && t.approvalRounds && typeof t.approvalRounds === 'object') ? t.approvalRounds : {};
  var n = 0;
  for (var k in rounds) {
    if (!Object.prototype.hasOwnProperty.call(rounds, k)) continue;
    if (k.indexOf('ar_themes_r') !== 0) continue;
    var r = rounds[k];
    if (r && r.decision === 'approved') n++;
  }
  return n;
}

/* Rodada mais recente de um tipo (themes|captions) — para UI/follow-up/facts. */
function latestRoundOf(t, type) {
  var rounds = (t && t.approvalRounds && typeof t.approvalRounds === 'object') ? t.approvalRounds : {};
  var best = null, bestN = 0, bestKey = '';
  for (var k in rounds) {
    if (!Object.prototype.hasOwnProperty.call(rounds, k)) continue;
    if (k.indexOf('ar_' + type + '_r') !== 0) continue;
    var m = /_r(\d+)$/.exec(k); var n = m ? parseInt(m[1], 10) : 0;
    if (n > bestN) { bestN = n; best = rounds[k] || {}; bestKey = k; }
  }
  return best ? { key: bestKey, seq: bestN, round: best } : null;
}

/* Espera externa + follow-up (recomendação; NUNCA envia nada sozinho). */
function externalWaitInfo(t, nowMs) {
  var wp = String((t && t.workflowPhase) || '');
  var active = wfIsWaitingClientPhase(wp);
  var type = wp === WF_PHASES.CAPTIONS_WAITING_CLIENT ? 'captions' : 'themes';
  var lr = latestRoundOf(t, type);
  var r = lr ? lr.round : null;
  var sentAt = r ? (Number(r.sentAt) || 0) : 0;
  var firstViewedAt = r ? (Number(r.firstViewedAt) || 0) : 0;
  var decided = !!(r && r.decision);
  var waitingMs = (active && sentAt > 0 && nowMs > sentAt) ? (nowMs - sentAt) : 0;
  var sinceViewMs = (active && firstViewedAt > 0 && nowMs > firstViewedAt) ? (nowMs - firstViewedAt) : 0;
  var followUp = '';
  if (active && !decided && sentAt > 0) {
    if (!(firstViewedAt > 0)) followUp = 'SENT_NOT_VIEWED';
    else followUp = 'VIEWED_PENDING';
    if (waitingMs >= 24 * 60 * 60 * 1000) followUp = 'LONG_WAIT';   // recomendação, não SLA da equipe
  }
  return { active: active, type: type, roundKey: lr ? lr.key : '', sentAt: sentAt,
    firstViewedAt: firstViewedAt, viewed: firstViewedAt > 0, decided: decided,
    waitingMs: waitingMs, sinceViewMs: sinceViewMs, followUp: followUp };
}

/* ── POLÍTICA — NOTIFICAR QUEM PRECISA, NO MOMENTO EM QUE PRECISA ───────────────
   Níveis do mandato → severidade do payload aprovado (motor visual intocado):
   INFORMATIVA→info(sem som) · AÇÃO NECESSÁRIA→success(som) · PRIORITÁRIA→warning(som)
   · CRÍTICA→critical (nenhum evento desta fase usa critical — reservado).
   Audiências:
   social_resp  = responsável Social da tarefa (socialOwnerId||by); sem toast se o ATOR
                  do evento é o próprio destinatário ("sem toast se ela mesma iniciou");
   designer_ru  = SOMENTE o Designer indicado no evento (ru) — nunca os demais.
   Sem entrada na tabela ⇒ evento NÃO notifica (ex.: *_APPROVAL_REQUESTED tem confirmação
   inline na UI; WORKFLOW_COMPLETED é coberto pela aprovação de legendas; DESIGNER_STARTED
   atualiza status em tempo real sem interromper ninguém). */
var WF_POLICY = {
  CLIENT_THEMES_APPROVED:               { aud: 'social_resp', sev: 'success', sound: true },
  CLIENT_CAPTIONS_APPROVED:             { aud: 'social_resp', sev: 'success', sound: true },
  CLIENT_THEMES_ADJUSTMENT_REQUESTED:   { aud: 'social_resp', sev: 'warning', sound: true },
  CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED: { aud: 'social_resp', sev: 'warning', sound: true },
  CLIENT_THEMES_FIRST_VIEWED:           { aud: 'social_resp', sev: 'info', sound: false },
  CLIENT_CAPTIONS_FIRST_VIEWED:         { aud: 'social_resp', sev: 'info', sound: false },
  DESIGNER_ASSIGNED:                    { aud: 'designer_ru', sev: 'success', sound: true },
  DESIGNER_ITEM_COMPLETED:              { aud: 'social_resp', sev: 'info', sound: true, aggregate: true },
  DESIGN_PRODUCTION_COMPLETED:          { aud: 'social_resp', sev: 'success', sound: true },
  THEMES_READY:                         { aud: 'social_resp', sev: 'info', sound: true },
  CAPTIONS_READY:                       { aud: 'social_resp', sev: 'info', sound: true }
};

function socialResponsibleUid(t) {
  return String((t && (t.socialOwnerId || t.by)) || '');
}
function userIsSocial(user) {
  if (!user) return false;
  if (user.admin === true) return true;
  var r = String(user.role || '').toLowerCase();
  return r.indexOf('social') >= 0;
}

/** Decide se ESTE uid recebe o evento. ctx: {uid, user:{id,role,admin}}. */
function wfRecipientOk(ev, t, ctx) {
  var pol = WF_POLICY[ev.type]; if (!pol) return false;
  var uid = String((ctx && ctx.uid) || ''); if (!uid) return false;
  if (pol.aud === 'designer_ru') return !!ev.ru && String(ev.ru) === uid;
  if (pol.aud === 'social_resp') {
    if (ev.by && String(ev.by) === uid) return false;              // ator não se auto-notifica
    var resp = socialResponsibleUid(t);
    if (resp) return uid === resp;                                 // responsável definido: só ele
    return userIsSocial(ctx && ctx.user);                          // sem dono: qualquer Social/Admin
  }
  return false;
}

/* Conteúdo: o que aconteceu + PRÓXIMA AÇÃO. */
function wfTitleBody(ev, t, agg) {
  var total = designItemsSummary(t).total || (Array.isArray(t && t.cronContents) ? t.cronContents.length : 0);
  var nTxt = total > 0 ? (total + ' ') : '';
  switch (ev.type) {
    case 'CLIENT_THEMES_APPROVED':
      return { title: 'Temas aprovados', body: (nTxt ? nTxt + 'temas aprovados. ' : 'Temas aprovados. ') + 'Próxima ação: atribuir aos Designers.' };
    case 'CLIENT_CAPTIONS_APPROVED':
      return { title: 'Legendas aprovadas — fluxo concluído', body: 'Aprovação final registrada pelo cliente. Tarefa concluída.' };
    case 'CLIENT_THEMES_ADJUSTMENT_REQUESTED':
      return { title: 'Cliente solicitou ajustes nos temas', body: 'Próxima ação: revisar os temas e reenviar para aprovação.' };
    case 'CLIENT_CAPTIONS_ADJUSTMENT_REQUESTED':
      return { title: 'Cliente solicitou ajustes nas legendas', body: 'Próxima ação: revisar as legendas/artes e reenviar.' };
    case 'CLIENT_THEMES_FIRST_VIEWED':
      return { title: 'Cliente visualizou os temas', body: 'Primeira visualização do link de aprovação.' };
    case 'CLIENT_CAPTIONS_FIRST_VIEWED':
      return { title: 'Cliente visualizou as legendas', body: 'Primeira visualização do link de aprovação.' };
    case 'DESIGNER_ASSIGNED':
      return { title: 'Nova atribuição', body: (ev.n > 0 ? ev.n : (total || '')) + ' conteúdo(s) atribuído(s) a você. Próxima ação: iniciar a produção.' };
    case 'DESIGNER_ITEM_COMPLETED': {
      if (agg && agg.count > 1) {
        return { title: agg.count + ' cards concluídos',
          body: (agg.designerName ? agg.designerName + ' concluiu ' : 'Concluídos ') + agg.done + ' de ' + (agg.total || total) + '. Próxima ação: acompanhar a produção.' };
      }
      return { title: 'Card concluído', body: (ev.n > 0 && (ev.tot > 0 || total > 0)) ? ('Concluídos ' + ev.n + ' de ' + (ev.tot || total) + '.') : 'Um conteúdo foi finalizado.' };
    }
    case 'DESIGN_PRODUCTION_COMPLETED':
      return { title: 'Produção concluída', body: 'Todos os ' + (ev.tot || total || '') + ' conteúdos foram finalizados. Próxima ação: preparar e enviar as legendas.' };
    case 'THEMES_READY':
      return { title: 'Temas prontos', body: 'Próxima ação: enviar para aprovação do cliente.' };
    case 'CAPTIONS_READY':
      return { title: 'Legendas prontas', body: 'Próxima ação: enviar para aprovação do cliente.' };
    default:
      return { title: 'Atualização do fluxo', body: '' };
  }
}

/** Payload p/ o ingresso aprovado (mesma forma da Categoria A; dedupKey determinístico). */
function buildWorkflowPayload(ev, t, ctx, agg) {
  var pol = WF_POLICY[ev.type]; if (!pol) return null;
  var tb = wfTitleBody(ev, t, agg);
  var prof = null;
  try { prof = (ctx && typeof ctx.resolveProfile === 'function') ? ctx.resolveProfile(ev.by) : null; } catch (_e) { prof = null; }
  var respUid = pol.aud === 'designer_ru' ? String(ev.ru || '') : socialResponsibleUid(t);
  var respProf = null;
  try { respProf = (ctx && typeof ctx.resolveProfile === 'function') ? ctx.resolveProfile(respUid) : null; } catch (_e2) { respProf = null; }
  var dedup = agg && agg.count > 1 ? ('wf:agg:' + (t && t.id) + ':' + agg.lastId) : ('wf:' + ev.id);
  return {
    eventId: dedup,
    dedupKey: dedup,
    eventType: 'wf_' + String(ev.type || '').toLowerCase(),
    notificationType: pol.aud === 'designer_ru' ? 'assigned_designer' : 'workflow_social',
    taskId: (t && t.id) || ev.taskId || '',
    taskTitle: String((t && t.title) || ''),
    clientName: String((t && t.client) || ''),
    actorId: ev.by && ev.by !== 'client' ? ev.by : '',
    actorName: prof && prof.name ? prof.name : (ev.by === 'client' ? 'Cliente' : ''),
    actorAvatar: prof && prof.photo ? prof.photo : '',
    responsibleId: respUid,
    responsibleName: respProf && respProf.name ? respProf.name : '',
    responsibleAvatar: respProf && respProf.photo ? respProf.photo : '',
    targetUserId: String((ctx && ctx.uid) || ''),
    etapa: WF_PHASE_LABELS[ev.phase] || '',
    status: ev.phase || '',
    title: tb.title,
    body: tb.body,
    context: String((t && t.client) || ''),
    createdAt: ev.at,
    severity: pol.sev,
    sound: pol.sound === true,
    action: { type: 'detail', deep: 'detail/' + ((t && t.id) || ev.taskId || '') },
    source: 'workflowNotifier',
    providerCalled: false
  };
}

function wfIsAggregatable(type) {
  var pol = WF_POLICY[type];
  return !!(pol && pol.aggregate === true);
}

module.exports = {
  WF_RETENTION_MS_DEFAULT: WF_RETENTION_MS_DEFAULT,
  WF_PHASES: WF_PHASES,
  WF_PHASE_LABELS: WF_PHASE_LABELS,
  WF_POLICY: WF_POLICY,
  wfIsWaitingClientPhase: wfIsWaitingClientPhase,
  deriveLedgerEvents: deriveLedgerEvents,
  designItemsSummary: designItemsSummary,
  wfCycleN: wfCycleN,
  latestRoundOf: latestRoundOf,
  externalWaitInfo: externalWaitInfo,
  socialResponsibleUid: socialResponsibleUid,
  userIsSocial: userIsSocial,
  wfRecipientOk: wfRecipientOk,
  wfTitleBody: wfTitleBody,
  buildWorkflowPayload: buildWorkflowPayload,
  wfIsAggregatable: wfIsAggregatable
};
