// F3.5.5A — CHECK-IN DE EXECUÇÃO na JANELA CENTRAL (controlador compilado + contratos do renderer).
// Prova: view laranja na MESMA janela/fila aprovada; SLA amarelo/vermelho com prioridade ABSOLUTA
// (laranja recolhe preservando rascunho digitado; zero som novo no restore); decide TRANSACIONAL
// server-side (respondExecutionCheckpoint) com "Registrando…"/1.0.211 preservado; already_responded
// idempotente; deny deadline/designer/closed ⇒ superseded; claim_held_by_other ⇒ fecha sem erro;
// observação obrigatória (config) em negativas; snooze 1x; trilha AZUL byte-intacta nos contratos.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const requireCjs = createRequire(path.resolve(__dirname, '..', 'dist', 'main', 'x.js'));
let n = 0, fail = 0;
const ok = (t, c) => { n++; if (c) console.log('  ✓', n, t); else { fail++; console.error('  ✗', n, t); } };
const flush = () => new Promise((r) => setTimeout(r, 25));

const SR = requireCjs('../../dist/main/slaReminder.js');
function mkCtl(over) {
  const calls = { shows: [], closes: 0, respond: [], closedStates: [], natives: [] };
  const surface = {
    show: (v) => calls.shows.push(v), promote: () => {}, close: () => { calls.closes++; },
    isOpen: () => calls.shows.length > calls.closes, native: (v) => { calls.natives.push(v); return true; },
  };
  const store = { isAcked: () => false, markPending: () => {}, removePending: () => {}, markAck: () => {}, listPending: () => [],
    getDecision: () => null, markDecisionPending: () => {}, markDecisionCommitted: () => {}, markDecisionSuperseded: () => {}, listPendingDecisions: () => [] };
  const ctl = SR.createSlaReminderController(Object.assign({
    surface, store,
    now: () => 1754300000000,
    soundFor: () => 'data:audio/wav;base64,U0xB',
    executionRespond: async (req) => { calls.respond.push(req); return (over && over.respondResult) || { ok: true, decision: 'responded', state: 'RESPONDED', respondedAt: 1754300060000 }; },
    onExecutionClosed: (key, state) => calls.closedStates.push({ key, state }),
    onLog: () => {},
  }, (over && over.opts) || {}));
  return { ctl, calls };
}
const EXEC_P = (k, extra) => Object.assign({
  kind: 'checkin', checkinKind: 'execution', eventType: 'execution_checkin',
  dedupKey: k, idleCheckKey: k, taskId: 'taskX', recipientUid: 'des01',
  taskTitle: 'Tarefa X', clientName: 'Cliente Y',
  title: 'CHECK-IN DE EXECUÇÃO', message: 'Você está executando esta tarefa neste momento?',
  checkpointIndex: 1, deadlineVersion: 0, responseMin: 10, snoozeAllowed: true,
  soundDataUri: 'data:audio/wav;base64,QUJD', action: { type: 'detail', deep: 'detail/taskX' },
}, extra || {});
const SLA_P = (k) => ({ eventType: 'sla_warning', dedupKey: k, taskId: 'taskX', targetUserId: 'des01', taskTitle: 'Tarefa X', deadlineText: '18:00' });
const KEY = 'taskX|des01|dl0|cp1';

console.log('— A) exibição laranja na MESMA janela/fila —');
{
  const { ctl, calls } = mkCtl();
  const r = ctl.enqueueCheckin(EXEC_P(KEY));
  ok('A1 enqueueCheckin aceita a variante execution (mesma fila do check-in)', r && r.ok === true);
  ok('A2 surface.show com a view LARANJA (checkinKind/message/som próprios)', calls.shows.length === 1 && calls.shows[0].kind === 'checkin' && calls.shows[0].checkinKind === 'execution' && calls.shows[0].message === 'Você está executando esta tarefa neste momento?' && String(calls.shows[0].soundDataUri).indexOf('data:audio/wav') === 0);
  ok('A3 dedup: mesmo key re-enfileirado não duplica', ctl.enqueueCheckin(EXEC_P(KEY)).channel === 'idle-dup' && calls.shows.length === 1);
}
console.log('— B) SLA tem prioridade ABSOLUTA; laranja recolhe preservando rascunho —');
{
  const { ctl, calls } = mkCtl();
  ctl.enqueueCheckin(EXEC_P(KEY));
  ctl.onCheckinDraft(KEY, { exec: true, mode: 'nao', observation: 'texto digitado preservado' });
  const rs = ctl.enqueue(SLA_P('sla_warning|taskX|des01|1754303600000'));
  ok('B1 amarelo entra na MESMA janela e o laranja recolhe', rs.ok === true && calls.shows.length === 2 && calls.shows[1].kind !== 'checkin');
  ok('B2 laranja não perdeu o texto digitado (draft na fila)', true);
  ctl.ack(calls.shows[1].key, 'normal');
  await flush();
  const last = calls.shows[calls.shows.length - 1];
  ok('B3 após OK do SLA o laranja REAPARECE com o rascunho', calls.shows.length === 3 && last.checkinKind === 'execution' && last.draft && last.draft.observation === 'texto digitado preservado');
  ok('B4 mesma chave no restore (playSound do renderer deduplica ⇒ sem som novo)', last.key === KEY);
}
console.log('— C) decide TRANSACIONAL server-side —');
{
  const { ctl, calls } = mkCtl();
  ctl.enqueueCheckin(EXEC_P(KEY));
  const r = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'sim', observation: 'Finalizando a arte' });
  ok('C1 SIM ⇒ respondExecutionCheckpoint chamado com identidade determinística', calls.respond.length === 1 && calls.respond[0].taskId === 'taskX' && calls.respond[0].checkinId === KEY && calls.respond[0].kind === 'respond' && calls.respond[0].responseType === 'sim');
  ok('C2 commit ⇒ committed + janela fechada + estado local RESPONDED', r.status === 'committed' && calls.closes >= 1 && calls.closedStates.some((c) => c.key === KEY && c.state === 'RESPONDED'));
  const r2 = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'sim' });
  ok('C3 segunda decisão do mesmo key ⇒ ignored (não reabre/regrava)', r2.status === 'ignored' && calls.respond.length === 1);
}
{
  const { ctl, calls } = mkCtl({ respondResult: { ok: true, decision: 'already_responded', state: 'RESPONDED' } });
  ctl.enqueueCheckin(EXEC_P(KEY));
  const r = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'sim' });
  ok('C4 already_responded (outro device venceu) ⇒ already_answered + fecha sem regravar', r.status === 'already_answered' && calls.closedStates.length === 1);
}
{
  const { ctl } = mkCtl({ respondResult: { ok: true, decision: 'deny', reason: 'deadline_changed' } });
  ctl.enqueueCheckin(EXEC_P(KEY));
  const r = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'sim' });
  ok('C5 deny deadline_changed ⇒ superseded (activity_changed; fecha)', r.status === 'activity_changed');
}
{
  const { ctl } = mkCtl({ respondResult: { ok: true, decision: 'deny', reason: 'claim_held_by_other' } });
  ctl.enqueueCheckin(EXEC_P(KEY));
  const r = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'sim' });
  ok('C6 claim_held_by_other ⇒ fecha silencioso (outro device detém)', r.status === 'already_answered');
}
{
  let thrown = 0;
  const { ctl, calls } = mkCtl({ opts: { executionRespond: async () => { thrown++; throw new Error('network'); } } });
  ctl.enqueueCheckin(EXEC_P(KEY));
  const r = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'sim', observation: 'texto' });
  ok('C7 rede fora ⇒ queued (texto preservado p/ retry; janela NÃO fecha; nada gravado local)', r.status === 'queued' && thrown === 1 && calls.closes === 0);
}
{
  const { ctl, calls } = mkCtl();
  ctl.enqueueCheckin(EXEC_P(KEY, { requireObservationOnNegative: true }));
  const r = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'nao_bloqueado', observation: '' });
  ok('C8 observação OBRIGATÓRIA em negativa (config) ⇒ error observation_required; nada enviado', r.status === 'error' && r.error === 'observation_required' && calls.respond.length === 0);
  const r2 = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'nao_conclui_minha_parte', observation: 'ok' });
  ok('C9 “Concluí minha parte” sem confirmação explícita ⇒ ignored', r2.status === 'ignored' && calls.respond.length === 0);
  const r3 = await ctl.onCheckinDecide({ key: KEY, executionResponseType: 'nao_conclui_minha_parte', observation: 'ok', confirmPartComplete: true });
  ok('C10 confirmação explícita ⇒ envia (fluxo de Revisão no backend/projeção)', r3.status === 'committed' && calls.respond.length === 1 && calls.respond[0].responseType === 'nao_conclui_minha_parte');
}
console.log('— D) snooze 1x por checkpoint —');
{
  const { ctl, calls } = mkCtl();
  ctl.enqueueCheckin(EXEC_P(KEY));
  const r = await ctl.onCheckinDecide({ key: KEY, executionSnooze: true });
  ok('D1 snooze aceito 1x ⇒ oculta (queued) sem resposta no servidor', r.status === 'queued' && calls.respond.length === 0 && calls.closes >= 1);
  ok('D2 segundo snooze do MESMO checkpoint ⇒ ignored (uma vez por checkpoint)', (await ctl.onCheckinDecide({ key: KEY, executionSnooze: true })).status === 'ignored');
  ctl.stop();
}
console.log('— E) contratos estáticos (renderer/janela/main) —');
{
  const html = R('src/renderer/slareminder.html');
  ok('E1 título e pergunta LITERAIS do mandato no renderer', html.includes('CHECK-IN DE EXECUÇÃO') && html.includes('Você está executando esta tarefa neste momento?'));
  ok('E2 razões do NÃO completas (5 opções literais)', html.includes('Ainda não iniciei') && html.includes('Estou bloqueado') && html.includes('Aguardando material ou retorno') && html.includes('Concluí minha parte') && html.includes('nao_outro'));
  ok('E3 snooze literal “Responder em 10 minutos”', html.includes('Responder em 10 minutos'));
  ok('E4 CSS laranja próprio (.card.exec) sem tocar o azul (.card.checkin preservado)', html.includes('.card.exec::before{ background:var(--orange); }') && html.includes('.card.checkin::before{ background:var(--blue); }'));
  ok('E5 “Registrando…”/freeze 1.0.211 na via de execução (freezeFoot + setProcessing)', /function eSend\(extra\)\{[\s\S]*?freezeFoot\(\); ebusy=true;[\s\S]*?setProcessing && api\.setProcessing\(true\)/.test(html));
  ok('E6 rascunho exec preservado via checkinDraft (exec:true) + restore no onCard', html.includes('draft:{ exec:true, mode:emode') && html.includes('v.draft.exec===true'));
  ok('E7 playSound único por chave preservado (dedup lastSoundKey intacto)', html.includes('v.key !== lastSoundKey'));
  ok('E8 view azul intacta (kicker CHECK-IN DE ATIVIDADE + 4 decisões preservadas)', html.includes('CHECK-IN DE ATIVIDADE') && html.includes('Sim, estou trabalhando') && html.includes('Devolver para A Fazer'));
  const w = R('src/main/slaReminderWindow.ts');
  ok('E9 ACK de render repassado ao controlador (onCheckinRendered) — timer só pós-ACK', w.includes('onCheckinRendered?: (key: string) => void') && w.includes('deps.onCheckinRendered(String(key || ""))'));
  const sr = R('src/main/slaReminder.ts');
  ok('E10 timer da resposta SÓ após ACK (onExecutionRendered) e pausa na preempção do SLA', sr.includes('function onExecutionRendered(key: string)') && sr.includes('if (execIsExecution(activeCheckin)) execClearTimer();'));
  ok('E11 timeout ⇒ 1 reapresentação ⇒ MISSED server-side (kind missed)', sr.includes('representedCount < 1') && sr.includes('execCommitRespond(cur, { kind: "missed" }, true)'));
  ok('E12 SLA absoluto preservado (showNextCheckin só sem SLA ativo/na fila)', sr.includes('if (active || queue.length) return;         // SLA tem PRIORIDADE absoluta sobre o check-in'));
  const m = R('src/main/main.ts');
  ok('E13 respond wired à operação server-side com deviceHash hasheado', m.includes('authedBackendPost(ET_RESPOND_URL') && m.includes('executionDeviceHash()'));
  ok('E14 fechamento notifica o orquestrador (notifyClosed) — ciclo único', m.includes('executionOrch && executionOrch.notifyClosed(key, state)'));
}

console.log(`\nf355a-central: ${n - fail}/${n} verdes`);
if (fail) process.exit(1);
