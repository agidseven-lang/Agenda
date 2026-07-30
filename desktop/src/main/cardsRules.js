/**
 * F3.5.2 — cardsRules.js — PRODUTOR DE NOTIFICAÇÃO ISOLADO DE "EDIÇÃO DE CARDS" (CommonJS, PURO).
 * =====================================================================================
 * Módulo SEPARADO (não toca slaRules.js — o motor de SLA do designer permanece BYTE-IDÊNTICO).
 * O setor INTERNO 'edicao_cards' NÃO usa o SLA do designer (SECTOR_SLA/designerSla/
 * resolveTaskDisplayState — cujo VERMELHO nasce NO prazo). Aqui o VERMELHO nasce ANTES do prazo:
 *   AMARELA em due−30 · VERMELHA em due−10 (a vermelha SUBSTITUI a amarela).
 *
 * A PRODUÇÃO é 100% isolada por setor (estas funções). A ENTREGA reutiliza EXCLUSIVAMENTE o canal
 * oficial aprovado (slaScheduler.emitList → deliver → deliverNotification: toast premium / bg-window /
 * nativa do Windows / clique-restaura-foca) e a DEDUP PERSISTENTE (seen-store) com CHAVE PRÓPRIA —
 * sem novo notifier/scheduler/listener/tray. Reusa de slaRules SOMENTE helpers PUROS (dtMs, first,
 * slaibFmtHM, slaCount, slaPanelDelivered, notifResponsibleDenorm, resolveNotificationTargets,
 * notifBuildPayload) — nenhuma escrita/alteração no slaRules.
 *
 * ISOLAMENTO REVERSO: como os cards NUNCA semeiam designerSla, o produtor COMPARTILHADO de SLA
 * (slaRules.slaEmissionsFor → resolveTaskDisplayState) já retorna [] p/ eles (hasSla=false ⇒
 * inPanel=false). Assim cronograma/edicao_midia/roteiro ficam byte-idênticos, sem tocar slaRules.
 */
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
var S = require('./slaRules'); // SOMENTE leitura de helpers puros (slaRules permanece intacto)

var CARDS_WARN_MS = 30 * 60000;   // AMARELA: due − 30min
var CARDS_RED_MS  = 10 * 60000;   // VERMELHA: due − 10min

/* setor por STRING BRUTA (não usa secOf — 'edicao_cards' não tem alias; saveCardsBatch grava literal). */
function isCardsSector(t){ try{ return ((t && t.sector) || '') === 'edicao_cards'; }catch(_){ return false; } }
/* prazo do card — F3.5.4H: prioriza o TIMESTAMP CANÔNICO PERSISTIDO (t.dueAt em ms, gravado por
 * QUEM DEFINE o prazo). Antes, o instante era re-derivado POR MÁQUINA de dueDate/dueTime via
 * new Date local: fuso/hora-de-parede divergente do LEITOR deslocava TODOS os marcos (provado:
 * Recife×UTC ⇒ redAt −180min ⇒ vermelha nativa ANTES da janela real). Fallback compat: docs
 * antigos sem dueAt seguem no parse local (comportamento anterior, inalterado). */
function cardFinishMs(t, dtMsFn){
  var ca = Number(t && t.dueAt) || 0; if(ca > 0) return ca;
  var f = dtMsFn || S.dtMs;
  var dd = t && (t.dueDate || t.due); if(!dd) return 0;
  var ms = Number(f(dd, (t && t.dueTime) || '23:59')) || 0; return ms > 0 ? ms : 0;
}
/* ══ F3.5.4H — GATE TEMPORAL VERMELHO (função PURA central; única autorização de emissão T-10) ══
 * true SOMENTE quando: dueAtMs válido; tarefa NÃO concluída; destinatário É o designer atualmente
 * atribuído (uid canônico); nowMs >= dueAtMs−10min; nowMs < dueAtMs; ainda não consumida.
 * Antes de redAt ⇒ false. Em/void após dueAt ⇒ false (NÃO existe alerta de atraso p/ cards; o
 * crítico/bloqueio do designerSla é regra separada e intacta). Sem Math.abs; sem arredondamento;
 * comparações em ms crus. */
function shouldFireRedNotification(o){
  o = o || {};
  var due = Number(o.dueAtMs) || 0; if(!(due > 0)) return false;
  if(o.completed) return false;
  var uid = String(o.recipientUid || ''), cur = String(o.currentAssigneeUid || '');
  if(!uid || !cur || uid !== cur) return false;
  var now = Number(o.nowMs); if(!Number.isFinite(now)) return false;
  if(now < due - CARDS_RED_MS) return false;   // ANTES da janela T-10: PROIBIDO
  if(now >= due) return false;                 // no prazo/depois: T-10 nunca dispara (nem retroativo)
  if(o.alreadyConsumed) return false;
  return true;
}
/* revisão de prazo p/ dedup (default 1); o dueAt já cobre a maioria das mudanças. */
function cardDeadlineRev(t){ try{ return Number(t && t.cardDeadlineRev) || 1; }catch(_){ return 1; } }
function cardsDisplayState(t, now, dtMsFn){
  now = now || Date.now();
  if(!isCardsSector(t)) return { sev:'neutro', state:'none', finishMs:0, inPanel:false, remainingMs:0 };
  var finishMs = cardFinishMs(t, dtMsFn);
  if(S.slaPanelDelivered(t)) return { sev:'verde', state:'completed', finishMs:finishMs, inPanel:false, remainingMs:0 };
  if(!finishMs)              return { sev:'neutro', state:'none', finishMs:0, inPanel:false, remainingMs:0 };
  var warnAt = finishMs - CARDS_WARN_MS, redAt = finishMs - CARDS_RED_MS;
  if(now >= redAt)  return { sev:'vermelho', state:'overdue', finishMs:finishMs, inPanel:true, remainingMs:Math.max(0, finishMs - now) }; // VERMELHA (inclui após o prazo; dedup ⇒ 1 entrega)
  if(now >= warnAt) return { sev:'laranja',  state:'warning', finishMs:finishMs, inPanel:true, remainingMs:Math.max(0, finishMs - now) }; // AMARELA
  return { sev:'azul', state:'running', finishMs:finishMs, inPanel:false, remainingMs:Math.max(0, finishMs - now) };                        // ainda longe do prazo
}
/* EMISSÃO isolada — [payload] da banda ATUAL (0 ou 1), roteada SÓ ao designer responsável. eventType
 * 'sla_cards_*' (casa /^sla_/ ⇒ identidade designer-focada do toast oficial); severity warning/critical
 * ⇒ MESMO amarelo/vermelho aprovado; dedup própria cards_warning/cards_overdue:taskId:dueAt:rev. */
function cardsEmissionsFor(task, uid, nowMs, dtMsFn){
  var out = [];
  try{
    var t = task; if(!t || !isCardsSector(t)) return out;
    var now = (typeof nowMs === 'number') ? nowMs : Date.now();
    var f = dtMsFn || S.dtMs;
    var tg = S.resolveNotificationTargets({ eventType:'sla_warning', task:t, currentUser:{ id:uid } });
    if(!tg.shouldNotifyCurrentUser) return out;                 // pessoal: só o designer responsável
    var d = cardsDisplayState(t, now, f); if(!d || !d.inPanel) return out;
    var resp = S.notifResponsibleDenorm(t);
    var fn = S.first(resp.name || ''), pf = S.slaibFmtHM(d.finishMs), rev = cardDeadlineRev(t);
    var tl = (t.title || 'Card') + (t.client ? (' — ' + t.client) : '');
    var base = { taskId:t.id, taskTitle:t.title || 'Card', clientName:t.client || '',
      actorId:resp.id, actorName:resp.name, actorAvatar:resp.avatar,
      responsibleId:resp.id, responsibleName:resp.name, responsibleAvatar:resp.avatar,
      targetUserId:uid, notificationType:'sla_personal', etapa:'Edição de Cards', status:d.state,
      subtitle:tl, anchor:d.finishMs, action:{ type:'detail', deep:'detail/' + t.id } };
    /* F3.5.4H — chaves de dedup passam a INCLUIR o uid do destinatário (mandato:
     * task:uid:dueAt:rev). legacyDedupKeys carrega a chave 1.0.198 p/ o emitList do scheduler
     * NÃO reentregar a quem já recebeu antes do upgrade (migração sem duplicata). */
    if(d.state === 'warning'){
      var plW = S.notifBuildPayload(Object.assign({}, base, { eventType:'sla_cards_warning', severity:'warning', sound:true,
        title:(fn ? fn + ', ' : '') + 'prazo próximo — Edição de Cards', body:'Faltam 30 minutos para o prazo deste card.',
        context:'Prazo: ' + pf + ' · Vence em ' + S.slaCount(d.remainingMs),
        dedupKey:'cards_warning:' + t.id + ':' + uid + ':' + d.finishMs + ':r' + rev }));
      /* anexado APÓS o build: notifBuildPayload (slaRules congelado) retorna allowlist fixa e
       * descartaria o campo — a chave legada precisa chegar VIVA ao emitList do scheduler. */
      plW.legacyDedupKeys = ['cards_warning:' + t.id + ':' + d.finishMs + ':r' + rev];
      out.push(plW);
    } else if(d.state === 'overdue'){
      /* F3.5.4H — a VERMELHA só nasce pelo GATE TEMPORAL PURO: now ∈ [dueAt−10min, dueAt).
       * Antes, o estado 'overdue' (now>=redAt SEM teto) permitia catch-up RETROATIVO após o
       * prazo no boot/reconexão — com corpo falso "Faltam 10 minutos" (reproduzido). O gate
       * também revalida destinatário (uid) e conclusão. Pós-dueAt: nenhum evento de cards. */
      var okRed = shouldFireRedNotification({ nowMs:now, dueAtMs:d.finishMs, completed:S.slaPanelDelivered(t),
        recipientUid:uid, currentAssigneeUid:String(resp.id || ''), alreadyConsumed:false });
      if(okRed){
        var plR = S.notifBuildPayload(Object.assign({}, base, { eventType:'sla_cards_overdue', severity:'critical', sound:true,
          title:(fn ? fn + ', ' : '') + 'prazo crítico — Edição de Cards', body:'Faltam 10 minutos para o prazo deste card.',
          context:'Prazo: ' + pf + ' · Vence em ' + S.slaCount(d.remainingMs),
          dedupKey:'cards_overdue:' + t.id + ':' + uid + ':' + d.finishMs + ':r' + rev }));
        plR.legacyDedupKeys = ['cards_overdue:' + t.id + ':' + d.finishMs + ':r' + rev];
        out.push(plR);
      }
    }
  }catch(_e){}
  return out;
}
/* PRÓXIMO marco futuro (due−30 / due−10) p/ ESTE card, ou 0 — contribui ao MESMO timer único do
 * scheduler (wake preciso em T-30/T-10), sem criar segundo scheduler. */
function cardsNextBoundaryMs(task, nowMs, dtMsFn){
  try{
    var t = task; if(!t || !isCardsSector(t)) return 0;
    if(S.slaPanelDelivered(t)) return 0;
    var now = (typeof nowMs === 'number') ? nowMs : Date.now();
    var finishMs = cardFinishMs(t, dtMsFn || S.dtMs); if(!finishMs) return 0;
    var bs = [finishMs - CARDS_WARN_MS, finishMs - CARDS_RED_MS], best = 0;
    for(var k = 0; k < bs.length; k++){ if(bs[k] > now && (!best || bs[k] < best)) best = bs[k]; }
    return best;
  }catch(_e){ return 0; }
}

module.exports = {
  CARDS_WARN_MS: CARDS_WARN_MS, CARDS_RED_MS: CARDS_RED_MS,
  isCardsSector: isCardsSector, cardFinishMs: cardFinishMs, cardDeadlineRev: cardDeadlineRev,
  shouldFireRedNotification: shouldFireRedNotification,
  cardsDisplayState: cardsDisplayState, cardsEmissionsFor: cardsEmissionsFor, cardsNextBoundaryMs: cardsNextBoundaryMs
};
