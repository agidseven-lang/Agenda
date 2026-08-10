#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H16 — CONCLUSÃO FINAL COM PRECEDÊNCIA + BLOQUEIO DE WRITES PÓS-CONCLUSÃO
 *
 * Defeito (1.0.241, Cronograma Teste 6): após a aprovação FINAL REAL do cliente, a tela
 * DETALHES ainda exibia estado de produção — badge/HERO "Designer entregou", status
 * operacional "Aguardando legendas e posts", responsável Social, botões Legendas/Enviar
 * ATIVOS, e o marco final SEM carimbo do horário/ator reais.
 *
 * Causa-raiz (CASE A — leitor puro): DUAS autoridades de conclusão. isTaskCompleted(t)
 * (SEM guarda de produção) — usada por clientCol/finalOk → card/Cliente/timeline CORRETOS —
 * vs isFullyComplete(t) (com guardas duras pendingProduction/pendingStory) — usada por
 * operationalCol/detailState → Detalhes STALE quando há conteúdo residual (pendingProduction=true).
 *
 * Correção 1.0.243 (RENDERER-only, index.html):
 *   E1 operationalCol: PRECEDÊNCIA isTaskCompleted → 'concluido' (residual não reabre).
 *   E2 detailState: 1ª ramificação isTaskCompleted → concluído final (owner none, só clientview).
 *   E3 openProductionModal: guarda isTaskCompleted → toast + return; ZERO write.
 *   E4 openSendClientModal: guarda isTaskCompleted ANTES de ensureReviewToken → toast + return; ZERO write.
 *   E5 Fase do cliente: DISPLAY-ONLY 'Concluída' quando isTaskCompleted (canônico 'final' intacto).
 *   E6 timeline concluido: carimbo da FONTE REAL (rodada FINAL decisionAt+recordedBy → clientFinalApprovedAt/By
 *      → evento EXATO → doneAt). SEM substring, SEM fabricar, SEM updatedAt.
 *
 * isFullyComplete NÃO é alterado globalmente. Guardas só agem quando isTaskCompleted(t)===true.
 * RED na base 1.0.241 (50595ca); GREEN na 1.0.242.
 * Rodar: node desktop/scripts/f356ah16-final-completed-precedence.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH16_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH16_PKG || path.join(DESK, 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.join(DESK, 'package-lock.json'), 'utf8'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

function grabFn(SRC, name) {
  let a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  if (SRC.slice(Math.max(0, a - 6), a) === 'async ') a -= 6; // preserva prefixo async (corpo com await quebra o parse sem ele)
  let d = 0;
  for (let j = SRC.indexOf('{', a); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
function grabDecl(SRC, marker) {
  const a = SRC.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  let round = 0, sq = 0, cur = 0;
  for (let j = a + marker.length; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '(') round++; else if (c === ')') round--;
    else if (c === '[') sq++; else if (c === ']') sq--;
    else if (c === '{') cur++; else if (c === '}') cur--;
    else if (c === ';' && round === 0 && sq === 0 && cur === 0) return SRC.slice(a, j + 1);
  }
  throw new Error('decl sem ; : ' + marker);
}

let api = null, bootErr = null;
try {
  const SRC = [
    grabDecl(HTML, 'const SECTORS='), grabDecl(HTML, 'const SECTOR_ALIAS='), grabDecl(HTML, 'const STATUS='),
    grabDecl(HTML, 'const CLIENT_COLS='), grabDecl(HTML, 'const OPERATIONAL_COLS='), grabDecl(HTML, 'const TL_EVENT_LABELS='),
    grabDecl(HTML, 'const TASK_PHASE='), grabDecl(HTML, 'const FLOW_LABELS='),
    grabFn(HTML, 'secOf'), grabFn(HTML, 'isClientSector'), grabFn(HTML, 'stOf'), grabFn(HTML, 'opColOf'), grabFn(HTML, 'clientStatusView'),
    grabFn(HTML, 'isTaskCompleted'), grabFn(HTML, 'isFullyComplete'), grabFn(HTML, 'hasDesigner'),
    grabFn(HTML, 'designerCol'), grabFn(HTML, 'designerDelivered'), grabFn(HTML, 'designerOf'), grabFn(HTML, 'socialOf'),
    grabFn(HTML, 'pendingLegend'), grabFn(HTML, 'pendingFeed'), grabFn(HTML, 'pendingStory'), grabFn(HTML, 'pendingProduction'),
    grabFn(HTML, 'clientApprovalPhaseOf'), grabFn(HTML, 'pendingClientItems'), grabFn(HTML, 'hasPendingItemRevision'),
    grabFn(HTML, 'allPhaseItemsApproved'), grabFn(HTML, 'clientApproved'), grabFn(HTML, 'hasTeamAdjustedAwaiting'),
    grabFn(HTML, 'isSentToDesigner'), grabFn(HTML, 'fmtDateTimeBR'),
    grabFn(HTML, 'flowCompletedSignal'), grabFn(HTML, 'flowSentToClientSignal'), grabFn(HTML, 'flowClientChangesSignal'),
    grabFn(HTML, 'flowThemesApprovedSignal'), grabFn(HTML, 'flowCanonicalSentSignal'), grabFn(HTML, 'flowThemesSentSignal'),
    grabFn(HTML, 'flowThemesReadySignal'),
    grabFn(HTML, 'wfRoundsOf'), grabFn(HTML, 'wfLatestRound'), grabFn(HTML, '_tlEventAt'), grabFn(HTML, '_tlRelAgo'), grabFn(HTML, '_tlHumanLabel'),
    grabFn(HTML, 'clientCol'), grabFn(HTML, 'operationalCol'), grabFn(HTML, 'nextActionText'), grabFn(HTML, 'nextActionShort'),
    grabFn(HTML, 'taskTimeline'), grabFn(HTML, 'detailState'),
    grabFn(HTML, 'openProductionModal'), grabFn(HTML, 'openSendClientModal'),
  ].join('\n');
  // Preâmbulo: probes p/ provar ZERO write no caminho pós-conclusão. NÃO capturamos as fns reais
  // flashToast/renderProductionModal/ensureReviewToken (stubs contadores no lugar).
  const PRE = [
    'var __toasts=[]; function flashToast(m){__toasts.push(m);} ',
    'var __rpm=0; function renderProductionModal(){__rpm++;} ',
    'var __ert=0; function ensureReviewToken(id){__ert++;return Promise.resolve(null);} ',
    'var state={users:[],tasks:[]};',
  ].join('\n');
  const RET = 'return {operationalCol:operationalCol,detailState:detailState,clientApprovalPhaseOf:clientApprovalPhaseOf,'
    + 'isTaskCompleted:isTaskCompleted,isFullyComplete:isFullyComplete,taskTimeline:taskTimeline,opColOf:opColOf,'
    + 'nextActionText:nextActionText,flowSentToClientSignal:flowSentToClientSignal,designerDelivered:designerDelivered,'
    + 'openProductionModal:openProductionModal,openSendClientModal:openSendClientModal,state:state,'
    + 'getToasts:function(){return __toasts;},getRpm:function(){return __rpm;},getErt:function(){return __ert;},'
    + 'resetProbes:function(){__toasts.length=0;__rpm=0;__ert=0;delete state._prod;state.tasks=[];}};';
  api = new Function(PRE + '\n' + SRC + '\n' + RET)();
} catch (e) { bootErr = e; }

if (!api) { console.log('================= F3.5.6A-H16 — CONCLUSÃO FINAL / PRECEDÊNCIA ================='); console.log('BOOT FALHOU: ' + (bootErr && bootErr.message)); console.log('PASS ' + pass + ' | FAIL ' + (fail + 1) + '  (versão sob teste: ' + PKG.version + ')'); process.exit(1); }

/* =========================== FIXTURES (Cronograma Teste 6) =========================== */
const T0838 = 1754818680000; // envio inicial THEMES ~08:38 (e clientReview AMBÍGUO de temas)
const T1331 = 1754836860000; // envio FINAL real ~13:31
const T1543 = 1754844780000; // APROVAÇÃO FINAL real do cliente ~15:43 (fonte canônica)
const TDONE = T1543 + 60000;  // doneAt legado (posterior; NUNCA deve ser usado quando há fonte canônica)

// Base: designer entregou, fase captions_preparation, pendingProduction=TRUE (2º item legenda vazia).
// isTaskCompleted=false, isFullyComplete=false  ⇒  NÃO concluído (usado p/ NÃO-REGRESSÃO "Designer entregou").
function prep() {
  return {
    id: 'CT6', sector: 'cronograma', client: 'CLIENTE TESTE', createdAt: 1754800000000,
    workflowPhase: 'captions_preparation',
    clientFlowStatus: 'producao', clientWorkflowStage: 'producao',
    cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', finalApprovalRequired: true,
    designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'concluido',
    cronContents: [{ tema: 'T1', legenda: 'Legenda teste 1', feedImageUrl: '' }, { tema: 'T2', legenda: '', feedImageUrl: '' }],
    clientSentAt: T0838,
    approvalRounds: { ar_themes_r1: { type: 'themes', sentAt: T0838, by: 'Social', decision: 'approved', decisionAt: T0838, recordedBy: 'Cliente' } },
    history: [
      { type: 'cronograma_enviado_cliente', label: 'Cronograma enviado ao cliente (TEMAS)', at: T0838, by: 'Arydyjany', channel: 'whatsapp_fallback', phase: 'themes' },
      { type: 'social_producao', label: 'Social atualizou legendas/artes', at: T1331 - 1000, by: 'Arydyjany', channel: 'production' }
    ]
  };
}
// Envio final REAL, mas AINDA NÃO aprovado (captions_waiting_client). NÃO concluído; NÃO deve ser bloqueado.
function finalNotApproved() {
  const t = prep();
  t.workflowPhase = 'captions_waiting_client';
  t.clientFlowStatus = 'reenviado';
  t.approvalRounds.ar_captions_r1 = { type: 'captions', sentAt: T1331, requestedBy: 'Arydyjany', status: 'sent' };
  t.history.push({ type: 'reenviado_cliente', label: 'Reenviado ao cliente (FINAL)', at: T1331, by: 'Arydyjany', channel: 'final_review', phase: 'final' });
  return t;
}
// CONCLUÍDO REAL (aprovação final do cliente) COM pendingProduction residual (2º item legenda vazia).
// Fonte canônica primária: rodada FINAL (captions) decision='approved' decisionAt=15:43 recordedBy='Cliente'.
function completed() {
  const t = finalNotApproved();
  t.workflowPhase = 'completed';
  t.finalApprovalCompleted = true;
  t.clientFlowStatus = 'concluido';
  t.cronStatus = 'aprovado_final';
  t.operationalStatus = 'concluido';
  t.clientFinalApprovedAt = T1543;
  t.clientFinalApprovedBy = 'Cliente';
  t.doneAt = TDONE;
  t.approvalRounds.ar_captions_r1 = { type: 'captions', sentAt: T1331, requestedBy: 'Arydyjany', decision: 'approved', decisionAt: T1543, recordedBy: 'Cliente', status: 'decided' };
  // clientReview AMBÍGUO (status 'aprovado' é usado como sinal de TEMAS em themesOk) — a timeline NÃO pode usá-lo p/ o marco FINAL.
  t.clientReview = { status: 'aprovado', at: T0838, byName: 'ClienteTEMAS' };
  t.history.push({ type: 'aprovado_cliente', label: 'Cliente aprovou a versão final', at: T1543, by: 'Cliente', channel: 'client' });
  return t;
}
// CONCLUÍDO sem a decisão da rodada FINAL — força a PRIORIDADE 2 (clientFinalApprovedAt/By).
function completedNoRound() {
  const t = completed();
  delete t.approvalRounds.ar_captions_r1.decision;
  delete t.approvalRounds.ar_captions_r1.decisionAt;
  t.approvalRounds.ar_captions_r1.status = 'sent';
  // remove o evento exato tb, p/ garantir que a fonte usada é clientFinalApprovedAt (prioridade 2)
  t.history = t.history.filter(e => e.type !== 'aprovado_cliente');
  return t;
}
// THEMES aguardando (só temas enviados; nunca produção/final) — não concluído.
function themesWaiting() {
  return {
    id: 'CT7', sector: 'cronograma', client: 'CLIENTE 2', createdAt: 1754800000000,
    workflowPhase: 'themes_waiting_client', clientFlowStatus: 'enviado', cronStatus: 'sent_to_client',
    clientApprovalPhase: 'themes', cronContents: [{ tema: 'A', legenda: '' }],
    approvalRounds: { ar_themes_r1: { type: 'themes', sentAt: T0838, requestedBy: 'Social', status: 'sent' } },
    history: [{ type: 'cronograma_enviado_cliente', at: T0838, by: 'Social', channel: 'whatsapp_fallback', phase: 'themes' }]
  };
}

/* =========================== PRECONDIÇÕES =========================== */
ok('P0 boot OK', !!api);
ok('P1 isTaskCompleted(completed)===true', api.isTaskCompleted(completed()) === true);
ok('P2 isFullyComplete(completed)===false (pendingProduction residual)', api.isFullyComplete(completed()) === false);
ok('P3 isTaskCompleted(prep)===false (designer entregou, não concluído)', api.isTaskCompleted(prep()) === false);
ok('P4 isTaskCompleted(finalNotApproved)===false (enviado, sem aprovação)', api.isTaskCompleted(finalNotApproved()) === false);

/* =========================== MAIN 1–16 (RED na 1.0.241 → GREEN na 1.0.242) =========================== */
// Correção 1 — operationalCol precedência
ok('MAIN1 operationalCol(completed)==="concluido" (isTaskCompleted PRECEDÊNCIA)', api.operationalCol(completed()) === 'concluido');
ok('MAIN2 operationalCol(completed)==="concluido" MESMO com pendingProduction residual (não reabre)', api.isFullyComplete(completed()) === false && api.operationalCol(completed()) === 'concluido');
// Correção 2 — detailState estado final
const ds = api.detailState(completed());
ok('MAIN3 detailState(completed).key==="concluido"', ds.key === 'concluido');
ok('MAIN4 detailState(completed).label==="Concluído final"', ds.label === 'Concluído final');
ok('MAIN5 detailState(completed).sub final', ds.sub === 'O cliente aprovou a versão final. Fluxo concluído.');
ok('MAIN6 detailState(completed).next==="Nenhuma pendência."', ds.next === 'Nenhuma pendência.');
// Correção 5 — responsável (owner) não é social
ok('MAIN7 detailState(completed).owner==="none" (não "social")', ds.owner === 'none');
// Correção 3 (superfície) — só ação de consulta segura
ok('MAIN8 detailState(completed).actions === ["clientview"] (sem prod/sendclient/edit)', eqArr(ds.actions, ['clientview']) && ds.actions.indexOf('prod') < 0 && ds.actions.indexOf('sendclient') < 0 && ds.actions.indexOf('edit') < 0);
// Correção 4 — status operacional
ok('MAIN9 status operacional label = "Concluído final" (opColOf da coluna concluído)', api.opColOf(api.operationalCol(completed())).label === 'Concluído final');
// Correção 6 — fase do cliente DISPLAY-ONLY (canônico intacto)
ok('MAIN10 clientApprovalPhaseOf(completed)==="final" (canônico NÃO alterado)', api.clientApprovalPhaseOf(completed()) === 'final');
// Correção 3 — BLOQUEIO FUNCIONAL de writes pós-conclusão
api.resetProbes(); api.state.tasks = [completed()];
api.openProductionModal('CT6');
ok('MAIN11 openProductionModal(completed) BLOQUEADO — ZERO write (state._prod indefinido, renderProductionModal 0×) + toast', api.state._prod === undefined && api.getRpm() === 0 && /já foi concluída/.test(api.getToasts()[0] || ''));
api.resetProbes(); api.state.tasks = [completed()];
await api.openSendClientModal(completed());
ok('MAIN12 openSendClientModal(completed) BLOQUEADO — ANTES de ensureReviewToken (0×) + toast; ZERO nova rodada', api.getErt() === 0 && /já foi concluída/.test(api.getToasts()[0] || ''));
// Correção 7 — carimbo do marco FINAL a partir da FONTE REAL
const tl = api.taskTimeline(completed());
const mc = tl.milestones.find(m => m.key === 'concluido');
ok('MAIN13 timeline marco concluido done + at = decisionAt da rodada FINAL (15:43; NÃO clientReview 08:38)', mc && mc.done === true && mc.state === 'done' && mc.at === T1543 && mc.at !== T0838);
ok('MAIN14 timeline marco concluido by = "Cliente" (recordedBy da rodada FINAL)', mc && mc.by === 'Cliente');
const tl2 = api.taskTimeline(completedNoRound());
const mc2 = tl2.milestones.find(m => m.key === 'concluido');
ok('MAIN15 timeline (sem rodada) usa PRIORIDADE 2 clientFinalApprovedAt=15:43 / by=Cliente', mc2 && mc2.at === T1543 && mc2.by === 'Cliente');
ok('MAIN16 timeline concluido NÃO usa doneAt legado nem updatedAt quando há fonte canônica (at===15:43 !== doneAt)', mc && mc.at === T1543 && mc.at !== TDONE);

/* =========================== NÃO-REGRESSÃO (GREEN em base e candidata) =========================== */
const dprep = api.detailState(prep());
ok('NR1 detailState(prep).key==="designer_entregou" (guard só age em concluído)', dprep.key === 'designer_entregou');
ok('NR2 detailState(prep) owner=social + ações prod/sendclient preservadas', dprep.owner === 'social' && dprep.actions.indexOf('prod') >= 0 && dprep.actions.indexOf('sendclient') >= 0);
ok('NR3 operationalCol(prep)==="aguardando_legenda" (inalterado)', api.operationalCol(prep()) === 'aguardando_legenda');
const dfna = api.detailState(finalNotApproved());
ok('NR4 detailState(finalNotApproved).key==="aguardando_final" (enviado, não concluído)', dfna.key === 'aguardando_final');
ok('NR5 operationalCol(themesWaiting) !== "concluido"', api.operationalCol(themesWaiting()) !== 'concluido');
// guarda NÃO super-bloqueia: tarefa NÃO concluída ainda abre produção/envio
api.resetProbes(); api.state.tasks = [prep()];
api.openProductionModal('CT6');
ok('NR6 openProductionModal(prep) NÃO bloqueado — chega a renderProductionModal (guard só em concluído)', api.state._prod !== undefined && api.getRpm() === 1);
api.resetProbes(); api.state.tasks = [prep()];
await api.openSendClientModal(prep());
ok('NR7 openSendClientModal(prep) NÃO bloqueado — chega a ensureReviewToken (guard só em concluído)', api.getErt() >= 1);

/* =========================== ESTÁTICOS — isolamento cirúrgico + marcadores H16 =========================== */
const S_OP = grabFn(HTML, 'operationalCol'), S_DS = grabFn(HTML, 'detailState'), S_IFC = grabFn(HTML, 'isFullyComplete');
const S_OPM = grabFn(HTML, 'openProductionModal'), S_OSM = grabFn(HTML, 'openSendClientModal'), S_TT = grabFn(HTML, 'taskTimeline'), S_CAP = grabFn(HTML, 'clientApprovalPhaseOf');
ok('S1 E1 operationalCol usa isTaskCompleted como precedência', /if\(isTaskCompleted\(t\)\)return 'concluido';/.test(S_OP) && !/if\(isFullyComplete\(t\)\)return 'concluido';/.test(S_OP));
ok('S2 E2 detailState 1ª ramificação isTaskCompleted → "Concluído final" / "Nenhuma pendência."', /if\(isTaskCompleted\(t\)\)return \{key:'concluido'[^]*?label:'Concluído final'/.test(S_DS) && S_DS.includes("next:'Nenhuma pendência.'"));
ok('S3 E3 openProductionModal guarda isTaskCompleted (ZERO write)', /if\(isTaskCompleted\(t\)\)\{flashToast\('Esta tarefa já foi concluída e não pode ser reenviada.'\);return;\}/.test(S_OPM));
ok('S4 E4 openSendClientModal guarda isTaskCompleted ANTES da CHAMADA ensureReviewToken(', /if\(_tc&&isTaskCompleted\(_tc\)\)\{flashToast\('Esta tarefa já foi concluída e não pode ser reenviada.'\);return;\}/.test(S_OSM) && S_OSM.indexOf('if(_tc&&isTaskCompleted(_tc)){flashToast(') < S_OSM.indexOf('ensureReviewToken('));
ok('S5 E5 Fase do cliente DISPLAY-ONLY "Concluída" quando isTaskCompleted', HTML.includes("const phUi=isTaskCompleted(t)?{l:'Concluída',c:'#10B981'}:"));
ok('S6 E6 timeline carimbo FONTE REAL (decisionAt + recordedBy + clientFinalApprovedAt; sem updatedAt/substring)', S_TT.includes("carimbo do marco FINAL a partir da FONTE REAL") && /decision==='approved'&&Number\(_crr\.decisionAt\)/.test(S_TT) && S_TT.includes('_crr.recordedBy') && S_TT.includes('t.clientFinalApprovedAt') && !S_TT.includes('updatedAt as approval'));
// isFullyComplete NÃO alterado globalmente (guardas duras intactas; sem marcador H16)
ok('S7 isFullyComplete inalterado (guardas pendingProduction/pendingStory intactas; sem H16)', S_IFC.includes('if(pendingProduction(t))return false;') && S_IFC.includes('if(pendingStory(t))return false;') && !S_IFC.includes('F3.5.6A-H16'));
// clientApprovalPhaseOf canônico intacto (retorna 'final' por finalApprovalCompleted; sem H16)
ok('S8 clientApprovalPhaseOf canônico intacto (não mutado por H16)', /finalApprovalCompleted===true/.test(S_CAP) && !S_CAP.includes('F3.5.6A-H16'));
// heranças H15/H14 preservadas
ok('S9 H15 preservada (nextActionText texto NOVO da espera final)', HTML.includes('Envio final confirmado. Próxima etapa: aguardar a aprovação final do cliente.'));
ok('S10 H14 preservada (step7 done prodOk||resent + rótulo contextual do marco final)', HTML.includes("key:'aguardando_legenda',label:'Aguardando legenda / posts',    done:!!(prodOk||resent),") && HTML.includes("if(m.key==='concluido'&&state==='current') dispLabel='Aguardando aprovação final';"));

/* =========================== IDENTIDADE =========================== */
ok('ID1 package.json = 1.0.243 + marcador H16', PKG.version === '1.0.243' && /final-completed-precedence/.test(PKG.description || ''));
ok('ID2 package-lock 1.0.243 (raiz + packages[""])', LOCK.version === '1.0.243' && LOCK.packages[''].version === '1.0.243');
ok('ID3 marcadores herdados H15/H14/H13/H12 preservados', /nextaction-final-wait-text/.test(PKG.description || '') && /timeline-step7-final-wait/.test(PKG.description || '') && /timeline-honest-preenvio/.test(PKG.description || '') && /final-state-premature-fix/.test(PKG.description || ''));

console.log('================= F3.5.6A-H16 — CONCLUSÃO FINAL / PRECEDÊNCIA + BLOQUEIO DE WRITES =================');
flog.forEach(l => console.log(l));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
