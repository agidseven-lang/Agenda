/**
 * F3.5.4Q — taskIdle.ts — DETECTOR PURO DE TAREFA PARADA (check-in de atividade).
 * =====================================================================================
 * Núcleo PURO (sem Electron, sem window, sem Firestore, sem DOM) — usável no MAIN e testável
 * com fixtures. Decide, para UMA tarefa e UM instante, se ela é candidata a um CHECK-IN de
 * atividade: permanece em "Em andamento" há mais que o tempo APROVADO sem NENHUMA atividade
 * significativa real, com responsável válido.
 *
 * DIRETRIZES DO OWNER (F3.5.4Q — aprovadas):
 *  - Tempos de inatividade (constantes EMPACOTADAS; sem coleção/remoto/Rules/Function/Worker/índice/
 *    migração/painel editável): Edição de Vídeo (edicao_midia) 120 min; Cronograma 90; Edição de Cards
 *    90; Roteiro 90; demais/padrão 90. thresholdVersion determinística deste conjunto.
 *  - Relógio GLOBAL por tarefa: QUALQUER atividade real e significativa (de qualquer usuário
 *    autorizado) reinicia/cancela o ciclo — abordagem conservadora, reduz falso positivo.
 *  - Contagem a partir da ÚLTIMA atividade significativa REAL e confiável.
 *  - Na dúvida (sem horário confiável, evento desconhecido posterior), NÃO emitir — reiniciar o ciclo
 *    por segurança (unknown_activity_safety_reset). É preferível não emitir a acusar errado.
 *
 * O relógio "agora" é INJETADO pelo chamador (canonicalNow com offset de clockSync); nunca Date.now
 * aqui, para tolerar desvio de relógio entre máquinas (mesmo cuidado do R3/R4). Um carimbo de
 * atividade FUTURO (skew) apenas ADIA o check-in (conservador) — nunca antecipa.
 *
 * Reusa SOMENTE leitura de helpers PUROS de slaRules (secOf, designerCol, notifResponsibleDenorm,
 * isTaskCompleted, slaPanelDelivered, deriveCanonicalTaskState) — slaRules permanece BYTE-IDÊNTICO.
 */
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const S: any = require('./slaRules');

const MIN = 60000;

/* ── TEMPOS DE INATIVIDADE APROVADOS (constantes empacotadas) ──
 * Chave = setor CANÔNICO. 'edicao_midia' (e o alias 'design') = 120; 'edicao_cards' (pseudo-setor,
 * não existe em SECTORS) = 90 por STRING BRUTA. Todo o resto = padrão 90. */
export const IDLE_MS_BY_SECTOR: Record<string, number> = {
  edicao_midia: 120 * MIN,   // Edição de Vídeo / Edição de Mídia
  cronograma:   90 * MIN,
  roteiro:      90 * MIN,
  edicao_cards: 90 * MIN,    // setor por string bruta (não existe em SECTORS)
};
export const IDLE_MS_DEFAULT = 90 * MIN;   // demais tarefas/setores não classificados

/** Versão determinística do CONJUNTO de tempos aprovado (muda se qualquer valor mudar). */
export const THRESHOLD_VERSION = 'idle-v1:em120|cr90|ec90|ro90|df90';

/**
 * Limite de inatividade (ms) para a tarefa, por setor.
 * IMPORTANTE: NÃO usa S.secOf() aqui — secOf() faz fallback p/ SECTORS[0]='edicao_midia' em QUALQUER
 * setor desconhecido, o que aplicaria 120 min por engano ao padrão. Resolvemos a chave canônica só
 * via alias oficial (SECTOR_ALIAS) e só confiamos numa chave EXPLICITAMENTE mapeada; o resto ⇒ padrão.
 */
export function idleThresholdMs(t: any): number {
  const raw = String((t && t.sector) || '');
  if (raw === 'edicao_cards') return IDLE_MS_BY_SECTOR.edicao_cards;       // pseudo-setor (raw-check)
  let kk = raw;
  try { const al = S.SECTOR_ALIAS || {}; if (al[raw]) kk = String(al[raw]); } catch { kk = raw; }
  if (Object.prototype.hasOwnProperty.call(IDLE_MS_BY_SECTOR, kk)) return IDLE_MS_BY_SECTOR[kk];
  return IDLE_MS_DEFAULT;
}

/* ── ATIVIDADE SIGNIFICATIVA (allowlist × denylist) ──
 * Todo write real em history[] é atividade (movimentação/edição/decisão de SLA operacional/legados
 * social+cliente). A ÚNICA exceção denylistada é a decisão de SLA 'acknowledge_only' (apenas
 * dispensou o alerta, não é trabalho). Kinds/types DESCONHECIDOS contam como atividade (segurança).
 * clientActions{} (escritas pelo portal do cliente) também contam. */
export type ActivityClass = 'allow' | 'deny';

function atOf(e: any): number { const n = Number(e && (e.at != null ? e.at : e.atMs)); return Number.isFinite(n) && n > 0 ? n : 0; }

/** Classifica UMA entrada de history[]. 'deny' só para sla_decision:acknowledge_only. */
export function classifyHistoryEntry(e: any): ActivityClass {
  if (!e) return 'deny';
  if (e.kind === 'sla_decision' && e.decisionType === 'acknowledge_only') return 'deny';
  return 'allow';   // moved/designer_moved/edited/sla_decision(demais)/task_idle_response/legados/desconhecido
}

/** Resultado do cálculo da última atividade significativa. */
export type LastActivity = { atMs: number; source: string };

/**
 * resolveLastMeaningfulActivity(task, nowMs) — determinística; usa SOMENTE dados reais/auditados.
 * Prioridade: (1) maior `at` da ALLOWLIST em history[]+clientActions{}; senão fallbacks auditados
 * (2) startedAt/designerSla.startedAt; (3) updatedAt; (4) startAt; (5) createdAt. Sem horário
 * confiável ⇒ {atMs:0} (NÃO emitir; nunca inventar timestamp). nowMs é aceito p/ assinatura estável
 * (não filtra futuros: entrada futura só ADIA o check-in — conservador).
 */
export function resolveLastMeaningfulActivity(t: any, _nowMs?: number): LastActivity {
  let best = 0, source = '';
  try {
    const h = Array.isArray(t && t.history) ? t.history : [];
    for (let i = 0; i < h.length; i++) {
      const e = h[i];
      if (classifyHistoryEntry(e) !== 'allow') continue;
      const a = atOf(e);
      if (a > best) { best = a; source = 'history:' + String((e && (e.kind || e.type)) || '?'); }
    }
    const ca = (t && t.clientActions && typeof t.clientActions === 'object') ? t.clientActions : {};
    Object.keys(ca).forEach((k) => { const a = Number(ca[k] && ca[k].at) || 0; if (a > best) { best = a; source = 'clientActions'; } });
  } catch { /* leitura defensiva */ }
  if (best > 0) return { atMs: best, source };
  // fallbacks auditados
  const sa = Number(t && t.startedAt) || Number(t && t.designerSla && t.designerSla.startedAt) || 0; if (sa > 0) return { atMs: sa, source: 'startedAt' };
  const ua = Number(t && t.updatedAt) || 0; if (ua > 0) return { atMs: ua, source: 'updatedAt' };
  const st = Number(t && t.startAt) || 0; if (st > 0) return { atMs: st, source: 'startAt' };
  const ct = Number(t && t.createdAt) || 0; if (ct > 0) return { atMs: ct, source: 'createdAt' };
  return { atMs: 0, source: 'none' };
}

/* ── Estado canônico "Em andamento" e responsável ── */
export function isInProgress(t: any): boolean {
  try { return String((S.designerCol ? S.designerCol(t) : ((t && t.status) || 'afazer'))) === 'andamento'; }
  catch { return String((t && t.status) || 'afazer') === 'andamento'; }
}
export function responsibleUidOf(t: any): string {
  try { const r = S.notifResponsibleDenorm ? S.notifResponsibleDenorm(t) : null; return String((r && r.id) || ''); }
  catch { return ''; }
}
function isCompletedOrGone(t: any): boolean {
  try { if (S.isTaskCompleted && S.isTaskCompleted(t)) return true; } catch { /* */ }
  try { if (S.slaPanelDelivered && S.slaPanelDelivered(t)) return true; } catch { /* */ }
  const st = String((t && t.status) || '');
  return st === 'concluido' || st === 'cancelado' || st === 'removido';
}

/** Versão de status determinística (fase canônica) — mudança de etapa encerra o ciclo. */
export function statusVersionOf(t: any): string {
  try { const d = S.deriveCanonicalTaskState ? S.deriveCanonicalTaskState(t) : null; if (d && d.phase) return String(d.phase); } catch { /* */ }
  try { return String(S.designerCol ? S.designerCol(t) : ((t && t.status) || 'afazer')); } catch { return String((t && t.status) || 'afazer'); }
}

/** Chave determinística do CICLO de inatividade (1 check-in por ciclo real). */
export function buildIdleCheckKey(taskId: string, recipientUid: string, statusVersion: string, lastActivityAtMs: number, thresholdVersion?: string): string {
  return 'task_idle:' + String(taskId || '') + ':' + String(recipientUid || '') + ':' + String(statusVersion || '') + ':' + String(lastActivityAtMs || 0) + ':' + String(thresholdVersion || THRESHOLD_VERSION);
}

export type IdleEligibility = {
  eligible: boolean;
  reason: string;
  recipientUid: string;
  lastActivityAtMs: number;
  lastActivitySource: string;
  thresholdMs: number;
  inactivityMinutes: number;
  statusVersion: string;
  idleCheckKey: string;
  boundaryAtMs: number;   // lastActivity + threshold (instante em que fica elegível)
};

/**
 * isIdleEligible(task, nowMs) — condições INTRÍNSECAS da tarefa (as demais — flag ON, sem resposta
 * no ciclo, sem amarelo/vermelho ativo — são do controlador/main). Retorna sempre a chave/contexto
 * para o chamador, mesmo quando não elegível (reason explica). Na dúvida ⇒ eligible=false.
 */
export function isIdleEligible(t: any, nowMs: number): IdleEligibility {
  const now = Number(nowMs) || 0;
  const recipientUid = responsibleUidOf(t);
  const la = resolveLastMeaningfulActivity(t, now);
  const thresholdMs = idleThresholdMs(t);
  const statusVersion = statusVersionOf(t);
  const idleCheckKey = buildIdleCheckKey(String((t && t.id) || ''), recipientUid, statusVersion, la.atMs, THRESHOLD_VERSION);
  const inactivityMs = Math.max(0, now - la.atMs);
  const inactivityMinutes = Math.floor(inactivityMs / MIN);
  const boundaryAtMs = la.atMs > 0 ? la.atMs + thresholdMs : 0;
  const base: Omit<IdleEligibility, 'eligible' | 'reason'> = {
    recipientUid, lastActivityAtMs: la.atMs, lastActivitySource: la.source,
    thresholdMs, inactivityMinutes, statusVersion, idleCheckKey, boundaryAtMs,
  };
  const no = (reason: string): IdleEligibility => Object.assign({ eligible: false, reason }, base);

  if (!t || !t.id) return no('no_task');
  if (isCompletedOrGone(t)) return no('completed_or_gone');
  if (!isInProgress(t)) return no('not_in_progress');
  if (!recipientUid) return no('no_responsible');
  if (!(la.atMs > 0)) return no('no_reliable_activity');
  if (!(now > 0)) return no('no_now');
  if (la.atMs > now) return no('future_activity');        // skew: adia (conservador)
  if (inactivityMs < thresholdMs) return no('within_threshold');
  return Object.assign({ eligible: true, reason: 'idle' }, base);
}

/**
 * idleNextBoundaryMs(task, nowMs) — próximo instante em que ESTA tarefa ficaria elegível
 * (lastActivity + threshold), para contribuir ao timer único do scheduler; 0 se inaplicável
 * (não-andamento/concluída/sem responsável/sem atividade confiável). Pode ser <= now (vencido).
 */
export function idleNextBoundaryMs(t: any, nowMs: number): number {
  try {
    if (!t || !t.id) return 0;
    if (isCompletedOrGone(t)) return 0;
    if (!isInProgress(t)) return 0;
    if (!responsibleUidOf(t)) return 0;
    const la = resolveLastMeaningfulActivity(t, Number(nowMs) || 0);
    if (!(la.atMs > 0)) return 0;
    return la.atMs + idleThresholdMs(t);
  } catch { return 0; }
}

export default {
  IDLE_MS_BY_SECTOR, IDLE_MS_DEFAULT, THRESHOLD_VERSION,
  idleThresholdMs, classifyHistoryEntry, resolveLastMeaningfulActivity,
  isInProgress, responsibleUidOf, statusVersionOf, buildIdleCheckKey,
  isIdleEligible, idleNextBoundaryMs,
};
