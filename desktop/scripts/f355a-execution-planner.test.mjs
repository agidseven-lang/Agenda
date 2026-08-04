// F3.5.5A — suíte do PLANNER (algoritmo determinístico): matriz de 16 durações, zona SLA por setor,
// jornada, supressão inteligente (20 cenários), risco explicável, idempotência, mudança de prazo.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require_ = createRequire(import.meta.url);
const ET = require_(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main', 'executionTracking.js'));
let n = 0, fail = 0; const ok = (t, c) => { n++; if (c) console.log('  ✓', n, t); else { fail++; console.error('  ✗', n, t); } };
const H = 3600000, M = 60000, T0 = 1700000000000;
const plan = (durMs, extra) => ET.etPlan(Object.assign({ startMs: T0, dueMs: T0 + durMs, sectorWarnMs: 30 * M, cfg: { slaMarginMs: 10 * M } }, extra || {}));

console.log('— A) Matriz de durações (16 prazos obrigatórios) —');
// ≤60min com aviso amarelo de 30min (default do setor) NÃO tem "distância segura da zona amarela"
// ⇒ zero laranja (o SLA existente cobre). Buckets diários: teto 1/dia VENCE os percentuais
// (48h/72h: 25/50/75% distam <24h ⇒ 2 laranjas). Comportamento documentado no relatório.
const CASES = [
  [20 * M, 0], [30 * M, 0], [45 * M, 0], [60 * M, 0], [90 * M, 1], [2 * H, 2], [3 * H, 2],
  [4 * H, 3], [8 * H, 3], [12 * H, 3], [24 * H, 3], [48 * H, 2], [72 * H, 2], [7 * 24 * H, 3], [15 * 24 * H, 3], [30 * 24 * H, 3],
];
for (const [D, exp] of CASES) {
  const p = plan(D);
  const okCount = p.checkpoints.length === exp;
  const okZone = p.checkpoints.every(c => c.plannedAt < p.slaCutoffAt);
  const okOrder = p.checkpoints.every((c, i) => i === 0 || c.plannedAt > p.checkpoints[i - 1].plannedAt);
  ok(`D=${D / H}h → ${exp} checkpoint(s), todos antes da zona SLA, ordenados [${p.bucket}]`, okCount && okZone && okOrder);
}
ok('20min: motivo prazo_curto_sem_laranja (só SLA existente)', plan(20 * M).reason === 'prazo_curto_sem_laranja');
ok('percentuais 3h–8h ≈ 20/50/75', JSON.stringify(plan(4 * H).checkpoints.map(c => c.pct)) === '[0.2,0.5,0.75]');
ok('24h–3d: teto diário vence (48h ⇒ 25% e 75%; 50% cortado por <24h de gap)', JSON.stringify(plan(48 * H).checkpoints.map(c => c.pct)) === '[0.25,0.75]');
ok('setor com aviso curto (10min) devolve o checkpoint de 35% em prazo de 60min', plan(60 * M, { sectorWarnMs: 10 * M }).checkpoints.length === 1);
ok('>3d base 20/50/75 (adicionais só reativos, fora do plano)', JSON.stringify(plan(7 * 24 * H).checkpoints.map(c => c.pct)) === '[0.2,0.5,0.75]');

console.log('— B) Zona SLA por setor (nunca hardcode) + limites —');
const pz = plan(60 * M, { sectorWarnMs: 45 * M }); // warn do setor 45min ⇒ cutoff mais cedo
ok('warn do setor 45min encolhe a janela (checkpoint 35% de 60min cai fora ⇒ 0)', pz.checkpoints.length === 0 && pz.reason === 'todos_na_zona_sla');
ok('cutoff = due − warn − margem', ET.etSlaCutoff(T0 + 2 * H, 30 * M, 10 * M) === T0 + 2 * H - 40 * M);
const pg = plan(3 * 24 * H, { cfg: { slaMarginMs: 10 * M, maxPerDay: 1 } });
ok('bucket diário: no máx 1/dia', (() => { const days = {}; return pg.checkpoints.every(c => { const d = Math.floor(c.plannedAt / (24 * H)); days[d] = (days[d] || 0) + 1; return days[d] <= 1; }); })());
ok('máximo por tarefa respeitado (cfg 2)', plan(8 * H, { cfg: { slaMarginMs: 10 * M, maxPerTask: 2 } }).checkpoints.length === 2);
ok('intervalo mínimo respeitado (gap 3h em prazo 4h ⇒ menos checkpoints)', plan(4 * H, { cfg: { slaMarginMs: 10 * M, minIntervalMs: 3 * H } }).checkpoints.length === 1);

console.log('— C) Elegibilidade —');
const base = { designerId: 'd1', dueMs: T0 + 2 * H, status: 'andamento', sector: 'videos' };
ok('elegível com designer+prazo+estágio', ET.etEligibility(base, {}).eligible === true);
ok('sem designer', ET.etEligibility({ ...base, designerId: '' }, {}).reason === 'sem_designer');
ok('sem prazo', ET.etEligibility({ ...base, dueMs: 0 }, {}).reason === 'sem_prazo');
ok('concluída', ET.etEligibility({ ...base, status: 'concluido' }, {}).reason === 'concluida_entregue');
ok('revisão sem ação do designer', ET.etEligibility({ ...base, status: 'revisao' }, {}).reason === 'revisao_sem_acao_designer');
ok('aguardando cliente formal', ET.etEligibility({ ...base, waitingClientFormal: true }, {}).reason === 'aguardando_cliente');
ok('bloqueada e pausada', ET.etEligibility({ ...base, blockedPaused: true }, {}).reason === 'bloqueada_pausada');
ok('setor desabilitado', ET.etEligibility(base, { sectors: ['cards'] }).reason === 'setor_desabilitado');
ok('designer de teste (rollout)', ET.etEligibility(base, { designers: ['dX'] }).reason === 'designer_fora_do_teste');
ok('início canônico: startAt → assignedAt → nunca inventado', ET.etWindowStart({ startMs: 5 }).source === 'startAt' && ET.etWindowStart({ assignedAtMs: 7 }).source === 'assignedAt' && ET.etWindowStart({}).source === 'none');

console.log('— D) Jornada (config administrativa; sem horário inventado) —');
const sched = { configured: true, days: [1, 2, 3, 4, 5], startMin: 9 * 60, endMin: 18 * 60, tzOffsetMin: 0 };
const mon10 = Date.UTC(2023, 10, 13, 10, 0); // seg 10:00 UTC
const sat10 = Date.UTC(2023, 10, 11, 10, 0); // sáb
ok('dentro da jornada', ET.etInSchedule(mon10, sched) === true);
ok('fim de semana fora', ET.etInSchedule(sat10, sched) === false);
ok('sem configuração ⇒ NUNCA dentro (recurso OFF até configurar)', ET.etInSchedule(mon10, { configured: false }) === false);
ok('reposiciona para próxima janela ativa', ET.etInSchedule(ET.etNextScheduleStart(sat10, sched), sched) === true);

console.log('— E) Supressão inteligente (cenários obrigatórios) —');
const supBase = { now: T0 + H, slaCutoffAt: T0 + 10 * H, schedule: sched, task: {}, tracking: {}, cfg: {} };
const withNow = (o) => ET.etShouldSuppress(Object.assign({}, supBase, { now: mon10, slaCutoffAt: mon10 + 10 * H }, o));
ok('sem atividade ⇒ NÃO suprime', withNow({}).suppress === false);
ok('atividade significativa recente ⇒ suprime', withNow({ lastMeaningfulAt: mon10 - 10 * M }).reason === 'recent_meaningful_activity');
ok('recém-iniciada ⇒ suprime', withNow({ task: { startedAtMs: mon10 - 5 * M } }).reason === 'just_started');
ok('resposta recente ⇒ suprime', withNow({ tracking: { lastResponseAt: mon10 - 5 * M } }).reason === 'recent_response');
ok('enviada p/ revisão ⇒ suprime', withNow({ task: { status: 'revisao' } }).reason === 'sent_to_review');
ok('concluída ⇒ suprime', withNow({ task: { status: 'concluido' } }).reason === 'task_finished');
ok('bloqueio formal ⇒ suprime', withNow({ tracking: { blocked: true } }).reason === 'blocked_formal');
ok('aguardando material ⇒ suprime', withNow({ tracking: { waitingDependency: true } }).reason === 'waiting_dependency');
ok('pauseUntil válida ⇒ suprime', withNow({ tracking: { pauseUntil: mon10 + H } }).reason === 'pause_until_active');
ok('zona SLA (amarelo próximo) ⇒ suprime', withNow({ slaCutoffAt: mon10 - 1 }).reason === 'sla_zone');
ok('fora do horário ⇒ suprime', ET.etShouldSuppress(Object.assign({}, supBase, { now: sat10, slaCutoffAt: sat10 + H })).reason === 'outside_schedule');
ok('exibido em outro dispositivo ⇒ suprime', withNow({ displayedElsewhere: true }).reason === 'displayed_on_other_device');
ok('snapshot duplicado/reconexão ⇒ suprime', withNow({ snapshotDuplicate: true }).reason === 'duplicate_snapshot');
ok('SHADOW: calcula sem suprimir (UI é quem não exibe)', withNow({ mode: 'SHADOW' }).reason === 'shadow_log_only');
ok('sinais NÃO significativos não contam (abrir app/login/presença)', ET.etLastMeaningful([{ type: 'app_opened', at: 9 }, { type: 'login', at: 8 }, { type: 'presence_online', at: 7 }]) === 0);
ok('sinais significativos contam (checklist/progresso/observação)', ET.etLastMeaningful([{ type: 'checklist_item_done', at: 5 }, { type: 'progress_increased', at: 9 }]) === 9);

console.log('— F) Offline/relevância + prazo/designer —');
ok('vencido há >6h ⇒ irrelevante (superseded; sem fila histórica)', ET.etStillRelevant({ plannedAt: T0 }, T0 + 7 * H, T0 + 99 * H, T0 + 99 * H) === false);
ok('vencido recente e fora da zona ⇒ ainda relevante (1 reapresentação)', ET.etStillRelevant({ plannedAt: T0 }, T0 + H, T0 + 99 * H, T0 + 99 * H) === true);
ok('na zona SLA ⇒ nunca relevante', ET.etStillRelevant({ plannedAt: T0 }, T0 + H, T0 + 30 * M, T0 + 99 * H) === false);
const dl = ET.etOnDeadlineChange({ deadlineVersion: 3 });
ok('mudança de prazo: deadlineVersion++ e cancela pendentes da versão antiga', dl.deadlineVersion === 4 && dl.cancelPendingOf === 3);
ok('chave idempotente determinística (task|designer|dlv|idx; nunca só timestamp)', ET.etKey('t1', 'd1', 4, 2) === 't1|d1|dl4|cp2' && ET.etKey('t1', 'd1', 4, 2) === ET.etKey('t1', 'd1', 4, 2));
ok('estados completos', JSON.stringify(ET.ET_STATES) === JSON.stringify(['PLANNED', 'DUE', 'CLAIMED', 'DISPLAYED', 'RESPONDED', 'MISSED', 'SUPPRESSED', 'CANCELLED', 'SUPERSEDED']));

console.log('— G) Risco determinístico e explicável —');
ok('baixo por padrão', ET.etRisk({}).level === 'low');
ok('"ainda não iniciei" + sem resposta ⇒ high com fatores nomeados', (() => { const r = ET.etRisk({ notStartedAnswer: true, unansweredCount: 1 }); return r.level === 'high' && r.factors.includes('respondeu_nao_iniciei') && r.factors.includes('sem_resposta'); })());
ok('início real + revisão reduzem risco', ET.etRisk({ notStartedAnswer: true, startedReal: true, reviewSent: true }).level === 'low');
ok('previsão vencida eleva', ET.etRisk({ etaOverdue: true }).level === 'medium');
ok('score nunca negativo', ET.etRisk({ startedReal: true, reviewSent: true }).score === 0);

console.log('— H) COMPLEMENTO: autoridade única por tarefa (modo × elegibilidade) —');
ok('OFF ⇒ legado = 1.0.216 (adaptativo nem observa)', JSON.stringify(ET.etAuthority('OFF', true)) === JSON.stringify({ authority: 'legacy', legacySuppressed: false, adaptiveObserves: false }));
ok('SHADOW ⇒ legado segue autoridade REAL; adaptativo só observa', JSON.stringify(ET.etAuthority('SHADOW', true)) === JSON.stringify({ authority: 'legacy', legacySuppressed: false, adaptiveObserves: true }));
ok('ACTIVE+elegível ⇒ adaptativo único; legado suprimido', JSON.stringify(ET.etAuthority('ACTIVE', true)) === JSON.stringify({ authority: 'adaptive', legacySuppressed: true, adaptiveObserves: false }));
ok('ACTIVE+inelegível ⇒ legado permanece', ET.etAuthority('ACTIVE', false).authority === 'legacy' && ET.etAuthority('ACTIVE', false).legacySuppressed === false);
ok('nenhum cenário com DUAS autoridades', ['OFF','SHADOW','ACTIVE'].every(m => [true,false].every(e => { const a = ET.etAuthority(m, e); return (a.authority === 'adaptive') !== (a.authority === 'legacy'); })));

console.log('— H2) COMPLEMENTO: ACTIVE bloqueado com jornada incompleta —');
const fullCfg = { schedule: { days: [1,2,3,4,5], startMin: 540, endMin: 1080, tzOffsetMin: -180 }, minIntervalMs: 20*M, maxPerDay: 1 };
ok('config completa ⇒ ACTIVE permitido', ET.etActiveAllowed(fullCfg).allowed === true);
const inc = ET.etActiveAllowed({ schedule: { days: [1] } });
ok('config incompleta ⇒ bloqueado com mensagem exigida', inc.allowed === false && inc.reason === 'schedule_incomplete' && inc.message === 'Conclua a configuração da jornada antes de ativar os check-ins.');
ok('faltantes nomeados (sem padrão silencioso)', inc.missing.includes('horario_inicial') && inc.missing.includes('timezone') && inc.missing.includes('limite_diario'));

console.log('— H3) COMPLEMENTO: decisão de claim (corpo puro da transação; serverNow) —');
const SN = 1000000;
ok('inexistente ⇒ CLAIMED com lease (serverNow+lease)', (() => { const d = ET.etClaimDecision(null, SN, 'dev1', 60000); return d.decision === 'claim' && d.leaseUntil === SN + 60000; })());
ok('claim vigente de OUTRO dispositivo ⇒ leased (2º NUNCA ganha)', ET.etClaimDecision({ state: 'CLAIMED', claimDeviceId: 'dev1', leaseExpiresAt: SN + 999 }, SN, 'dev2', 60000).decision === 'leased');
ok('mesmo dispositivo ⇒ own (idempotente)', ET.etClaimDecision({ state: 'DISPLAYED', claimDeviceId: 'dev1', leaseExpiresAt: SN + 999 }, SN, 'dev1', 60000).decision === 'own');
ok('lease expirada ⇒ takeover permitido (app fechado antes do ACK libera)', ET.etClaimDecision({ state: 'CLAIMED', claimDeviceId: 'dev1', leaseExpiresAt: SN - 1 }, SN, 'dev2', 60000).decision === 'takeover_expired');
ok('RESPONDED em outro dispositivo ⇒ closed (invalida os demais)', ET.etClaimDecision({ state: 'RESPONDED' }, SN, 'dev2', 60000).decision === 'closed');
ok('SUPERSEDED/CANCELLED ⇒ closed (sem reapresentação pós-reconexão)', ET.etClaimDecision({ state: 'SUPERSEDED' }, SN, 'dev2', 60000).decision === 'closed' && ET.etClaimDecision({ state: 'CANCELLED' }, SN, 'dev2', 60000).decision === 'closed');

console.log('— H4) COMPLEMENTO: zona SLA — transições e prioridade absoluta —');
ok('PLANNED ⇒ CANCELLED na zona', ET.etSlaZoneTransition('PLANNED') === 'CANCELLED');
ok('DUE não exibido ⇒ SUPERSEDED (sem som/promoção)', ET.etSlaZoneTransition('DUE') === 'SUPERSEDED');
ok('CLAIMED ⇒ SUPERSEDED', ET.etSlaZoneTransition('CLAIMED') === 'SUPERSEDED');
ok('DISPLAYED ⇒ SUPERSEDED (recolhe e cede ao crítico; texto preservado pela UI)', ET.etSlaZoneTransition('DISPLAYED') === 'SUPERSEDED');
ok('estados fechados inalterados', ET.etSlaZoneTransition('RESPONDED') === 'RESPONDED');

console.log(`\nf355a-planner: ${n - fail}/${n} verdes`);
if (fail) process.exit(1);
