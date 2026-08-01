/* =====================================================================================
 * F3.5.4R — priorityEngine.js — MOTOR PURO E DETERMINÍSTICO do Assistente de Prioridades.
 * =====================================================================================
 * SOMENTE LEITURA. Recebe TAREFAS já pareadas com seus FATOS (calculados pelo renderer a
 * partir dos helpers puros existentes — SLA, prazo, fase, papel). O motor NÃO acessa Electron,
 * NÃO acessa Firestore, NÃO emite notificação, NÃO toca som, NÃO escreve nada, NÃO altera os
 * objetos recebidos. Apenas: classifica (nível), explica (motivos), ordena (desempate) e separa
 * ocorrências (ajuda/bloqueio) — que NUNCA sobem de nível sozinhas (regra do owner F3.5.4R).
 *
 * UMD: usável no renderer (window.PriorityEngine) e no Node (require) para os testes.
 * Determinístico: mesmos fatos ⇒ mesma ordem. Sem relógio próprio nem aleatoriedade (o "agora"
 * chega em facts.nowMs; o motor nunca lê o relógio do sistema).
 *
 * CONTRATO DE `item` (produzido pelo renderer; no teste, sintético):
 *   { taskId, title, client, sector, etapaLabel, responsibleName, facts: {
 *       nowMs, isCompleted, isGone, linked,
 *       col: 'afazer'|'andamento'|'revisao'|'concluido',
 *       alert: 'red'|'amber'|null,   alertText: string,      // SLA REAL direcionado ao usuário
 *       deadlineMs: number,          deadlineKind: 'overdue'|'today'|'tomorrow'|'future'|'none',
 *       deadlineText: string,        hasSla: boolean,
 *       changeRequestForMe: boolean, awaitingMyAction: boolean, awaitingText: string,
 *       helpForMe:   { atMs, fromName, taskId } | null,       // OCORRÊNCIA (não é fato de ranking)
 *       blockedForMe:{ atMs, reasonLabel, taskId } | null,    // OCORRÊNCIA (não é fato de ranking)
 *       createdAtMs, updatedAtMs } }
 * ===================================================================================== */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.PriorityEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEVEL = { CRITICAL: 1, ATTENTION: 2, NORMAL: 3 };
  var DEADLINE_RANK = { overdue: 0, today: 1, tomorrow: 2, future: 3, none: 4 };
  var ALERT_RANK = { red: 0, amber: 1 };          // menor = mais grave
  var COL_RANK = { andamento: 0, revisao: 1, afazer: 2, concluido: 3 };

  function f(item) { return (item && item.facts) || {}; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /* ── Elegibilidade: existe, não concluída, não removida/cancelada, com vínculo real; col≠concluído. ── */
  function isPriorityEligible(item) {
    var x = f(item);
    if (!item || !item.taskId) return false;
    if (x.isCompleted) return false;
    if (x.isGone) return false;
    if (!x.linked) return false;
    if (String(x.col) === 'concluido') return false;
    return true;
  }

  /* ── Prazo determinístico (echo dos fatos já classificados pelo renderer). ── */
  function resolvePriorityDeadline(item) {
    var x = f(item);
    var kind = x.deadlineKind || 'none';
    if (!DEADLINE_RANK.hasOwnProperty(kind)) kind = 'none';
    return { ms: num(x.deadlineMs), kind: kind, text: String(x.deadlineText || '') };
  }

  /* ── Nível: SÓ fatos ATUAIS e comprovados. Ajuda/bloqueio NUNCA elevam sozinhos. ──
   *  N1 CRÍTICO : alerta vermelho real direcionado ao usuário  OU  prazo oficial vencido e pendente.
   *  N2 ATENÇÃO : alerta amarelo real  OU  prazo termina hoje  OU  alteração pendente  OU  ação/aprovação direcionada ao usuário.
   *  N3 NORMAL  : em andamento · A Fazer · futura · sem prazo. */
  function resolvePriorityLevel(item) {
    var x = f(item);
    if (x.alert === 'red' || x.deadlineKind === 'overdue') return LEVEL.CRITICAL;
    if (x.alert === 'amber' || x.deadlineKind === 'today' || x.changeRequestForMe || x.awaitingMyAction) return LEVEL.ATTENTION;
    return LEVEL.NORMAL;
  }

  /* ── Motivos: cada linha derivada de um DADO real. Nunca "Prioridade alta" isolada. ──
   *  Ocorrências (ajuda/bloqueio) entram só como ENRIQUECIMENTO quando a tarefa já está no ranking
   *  por um fato atual — e com texto honesto ("registrado"/"reportado"), nunca "ativo/não resolvido". */
  function resolvePriorityReasons(item) {
    var x = f(item), r = [];
    if (x.alert === 'red') r.push('Alerta vermelho ativo' + (x.alertText ? ' — ' + x.alertText : ''));
    else if (x.alert === 'amber') r.push('Alerta amarelo ativo' + (x.alertText ? ' — ' + x.alertText : ''));
    if (x.deadlineKind === 'overdue') r.push('Prazo vencido' + (x.deadlineText ? ' — ' + x.deadlineText : ''));
    else if (x.deadlineKind === 'today') r.push('Prazo termina hoje' + (x.deadlineText ? ' — ' + x.deadlineText : ''));
    else if (x.deadlineKind === 'tomorrow') r.push('Prazo amanhã' + (x.deadlineText ? ' — ' + x.deadlineText : ''));
    else if (x.deadlineKind === 'future' && x.deadlineText) r.push('Prazo ' + x.deadlineText);
    if (x.changeRequestForMe) r.push('Cliente solicitou alteração');
    if (x.awaitingMyAction && x.awaitingText) r.push(x.awaitingText);
    if (String(x.col) === 'andamento') r.push('Tarefa em andamento');
    else if (String(x.col) === 'revisao') r.push('Tarefa em revisão/ajuste');
    else if (String(x.col) === 'afazer') r.push('Tarefa em A Fazer');
    if (x.deadlineKind === 'none' && !x.alert) r.push('Sem prazo definido');
    // Enriquecimento por ocorrência (texto honesto; não afirma que continua ativo).
    if (x.helpForMe) r.push('Pedido de ajuda registrado');
    if (x.blockedForMe) r.push('Bloqueio reportado' + (x.blockedForMe.reasonLabel ? ' — ' + x.blockedForMe.reasonLabel : ''));
    if (!r.length) r.push('Tarefa sob seu acompanhamento');
    return r;
  }

  /* ── Desempate determinístico (owner F3.5.4R): dentro do MESMO nível ──
   *  1 prazo mais próximo → 2 alerta mais grave → 3 já em andamento → 4 ajuda mais antiga
   *  → 5 atualização acionável mais antiga → 6 criação mais antiga → 7 taskId. */
  function comparePriorities(a, b) {
    var xa = f(a), xb = f(b);
    var la = resolvePriorityLevel(a), lb = resolvePriorityLevel(b);
    if (la !== lb) return la - lb;                                   // nível primeiro
    // 1 — prazo mais próximo (bucket, depois ms)
    var ra = DEADLINE_RANK[xa.deadlineKind] != null ? DEADLINE_RANK[xa.deadlineKind] : 4;
    var rb = DEADLINE_RANK[xb.deadlineKind] != null ? DEADLINE_RANK[xb.deadlineKind] : 4;
    if (ra !== rb) return ra - rb;
    var ma = num(xa.deadlineMs), mb = num(xb.deadlineMs);
    if (ma && mb && ma !== mb) return ma - mb;
    if (!!ma !== !!mb) return ma ? -1 : 1;                           // com prazo antes de sem
    // 2 — alerta mais grave
    var aa = ALERT_RANK[xa.alert] != null ? ALERT_RANK[xa.alert] : 2;
    var ab = ALERT_RANK[xb.alert] != null ? ALERT_RANK[xb.alert] : 2;
    if (aa !== ab) return aa - ab;
    // 3 — já em andamento primeiro
    var ca = COL_RANK[xa.col] != null ? COL_RANK[xa.col] : 2;
    var cb = COL_RANK[xb.col] != null ? COL_RANK[xb.col] : 2;
    if (ca !== cb) return ca - cb;
    // 4 — pedido de ajuda mais antigo
    var ha = xa.helpForMe ? num(xa.helpForMe.atMs) : 0, hb = xb.helpForMe ? num(xb.helpForMe.atMs) : 0;
    if (!!ha !== !!hb) return ha ? -1 : 1;
    if (ha && hb && ha !== hb) return ha - hb;
    // 5 — atualização acionável mais antiga
    var ua = num(xa.updatedAtMs), ub = num(xb.updatedAtMs);
    if (ua && ub && ua !== ub) return ua - ub;
    // 6 — criação mais antiga
    var da = num(xa.createdAtMs), db = num(xb.createdAtMs);
    if (da && db && da !== db) return da - db;
    // 7 — taskId (último desempate determinístico)
    return String(a.taskId) < String(b.taskId) ? -1 : (String(a.taskId) > String(b.taskId) ? 1 : 0);
  }

  /* ── Lista ordenada do usuário: elegíveis → nível → desempate. Estável e determinística. ── */
  function buildUserPriorityList(items) {
    var arr = (Array.isArray(items) ? items : []).filter(isPriorityEligible);
    arr.sort(comparePriorities);
    return arr.map(function (item, i) {
      return {
        position: i + 1,
        taskId: item.taskId, title: item.title, client: item.client, sector: item.sector,
        etapaLabel: item.etapaLabel, responsibleName: item.responsibleName,
        level: resolvePriorityLevel(item),
        deadline: resolvePriorityDeadline(item),
        reasons: resolvePriorityReasons(item),
        facts: item.facts
      };
    });
  }

  /* ── Contagens da lista (para o resumo discreto e a Visão por Setor). ── */
  function summarize(list) {
    var s = { total: list.length, critical: 0, attention: 0, normal: 0, today: 0, andamento: 0, afazer: 0 };
    for (var i = 0; i < list.length; i++) {
      var it = list[i], x = it.facts || {};
      if (it.level === 1) s.critical++; else if (it.level === 2) s.attention++; else s.normal++;
      if (x.deadlineKind === 'today') s.today++;
      if (String(x.col) === 'andamento') s.andamento++;
      else if (String(x.col) === 'afazer') s.afazer++;
    }
    return s;
  }

  /* ── Ocorrências recentes (ajuda registrada / bloqueio reportado) — SEÇÃO PRÓPRIA. ──
   *  Independem da elegibilidade da lista (o usuário pode ser destinatário sem ser responsável).
   *  NÃO afirmam estado atual; ordenadas por horário desc. Respeitam "dispensadas" (preferência local). */
  function buildOccurrences(items, dismissedKeys) {
    var dz = dismissedKeys || {};
    var out = [];
    (Array.isArray(items) ? items : []).forEach(function (item) {
      var x = f(item);
      if (x.isGone) return;
      if (x.helpForMe) {
        var hk = 'help:' + item.taskId + ':' + num(x.helpForMe.atMs);
        if (!dz[hk]) out.push({ kind: 'help', key: hk, taskId: item.taskId, title: item.title, client: item.client,
          sector: item.sector, atMs: num(x.helpForMe.atMs), fromName: x.helpForMe.fromName || '',
          text: 'Pedido de ajuda registrado' });
      }
      if (x.blockedForMe) {
        var bk = 'blocked:' + item.taskId + ':' + num(x.blockedForMe.atMs);
        if (!dz[bk]) out.push({ kind: 'blocked', key: bk, taskId: item.taskId, title: item.title, client: item.client,
          sector: item.sector, atMs: num(x.blockedForMe.atMs), reasonLabel: x.blockedForMe.reasonLabel || '',
          text: 'Bloqueio reportado' + (x.blockedForMe.reasonLabel ? ' — ' + x.blockedForMe.reasonLabel : '') });
      }
    });
    out.sort(function (a, b) { return b.atMs - a.atMs || (a.key < b.key ? -1 : 1); });
    return out;
  }

  return {
    LEVEL: LEVEL,
    isPriorityEligible: isPriorityEligible,
    resolvePriorityLevel: resolvePriorityLevel,
    resolvePriorityReasons: resolvePriorityReasons,
    resolvePriorityDeadline: resolvePriorityDeadline,
    comparePriorities: comparePriorities,
    buildUserPriorityList: buildUserPriorityList,
    summarize: summarize,
    buildOccurrences: buildOccurrences
  };
});
