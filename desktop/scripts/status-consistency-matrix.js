#!/usr/bin/env node
/* Matriz de consistência de status operacional (Desktop 1.0.100 / Android 1.0.88).
 * Prova que NENHUMA superfície (card, modal, colunas Kanban — incluindo o quadro por
 * Setor/"Meu quadro" de 4 colunas — e Visão do Cliente) renderiza "Concluído" antes da
 * aprovação final real. Falha (exit 1) se qualquer fixture não-final concluir cedo.
 * Espelha 1:1 a lógica do renderer (Desktop) e do TaskVisibility (Android). */

const sec = t => ((t.sector || '') === 'cronograma' ? 'cronograma' : 'outro');
const hasDesigner = t => !!t.assignedDesignerId;
const designerCol = t => { const v = t.designerFlowStatus || ''; return ['afazer','andamento','revisao','concluido'].includes(v) ? v : (t.status || 'afazer'); };
const designerDelivered = t => hasDesigner(t) && designerCol(t) === 'concluido';
const pendingLegend = t => { const a = t.cronContents || []; return !a.length || a.some(c => !(c && c.legenda && String(c.legenda).trim())); };
const pendingFeed = t => { const a = t.cronContents || []; return !a.length || a.some(c => !(c && c.feedImageUrl)); };
const pendingStory = t => { const a = t.cronContents || []; return a.some(c => c && c.storyImageUrl) && a.some(c => !(c && c.storyImageUrl)); };
const pendingProduction = t => pendingLegend(t) || pendingFeed(t);

// ---------- NEW (fonte única da verdade) ----------
function isFullyComplete(t) {
  if (sec(t) !== 'cronograma') return t.status === 'concluido';
  if (hasDesigner(t) && !designerDelivered(t)) return false;
  if (pendingProduction(t)) return false;
  if (pendingStory(t)) return false;
  if ((t.clientReview && t.clientReview.status) === 'revisao') return false;
  return !!(t.finalApprovalCompleted === true || t.operationalStatus === 'concluido' ||
            t.clientFlowStatus === 'concluido' || t.cronStatus === 'aprovado_final');
}
function clientCol(t) {
  const v = t.clientFlowStatus || ''; const KEYS = ['afazer','enviado','aprovado','producao','revisao','reenviado','concluido'];
  if (KEYS.includes(v)) { if (v === 'concluido' && !isFullyComplete(t)) return 'reenviado'; return v; }
  const cs = t.cronStatus || '', cr = (t.clientReview && t.clientReview.status) || '';
  if (isFullyComplete(t)) return 'concluido';
  if (cr === 'revisao' || cs === 'em_revisao_cliente' || cs === 'editado_cliente') return 'revisao';
  if (cs === 'ready_for_final_client_review' || cs === 'reenviado_cliente') return 'reenviado';
  if (hasDesigner(t) || cs === 'sent_to_designer') return 'producao';
  if (cr === 'aprovado' || cs === 'aprovado_cliente') return 'aprovado';
  if (cs === 'enviado_cliente' || t.clientSentBy) return 'enviado';
  return 'afazer';
}
function operationalCol(t) {
  if (sec(t) !== 'cronograma') return t.status || 'afazer';
  if (isFullyComplete(t)) return 'concluido';
  const cf = clientCol(t);
  if (cf === 'revisao') return 'aguardando_revisao';
  if (cf === 'reenviado') return 'aguardando_final';
  if (hasDesigner(t)) { if (designerCol(t) !== 'concluido') return 'aguardando_designer'; return pendingProduction(t) ? 'aguardando_legenda' : 'aguardando_final'; }
  if (cf === 'aprovado') return pendingProduction(t) ? 'aguardando_legenda' : 'producao';
  if (cf === 'afazer') return 'afazer';
  return 'producao';
}
// Quadro por Setor / "Meu quadro" (4 colunas) — agora deriva do eixo operacional p/ cronograma.
function boardCol4(t) {
  if (sec(t) !== 'cronograma') return t.status || 'afazer';
  const oc = operationalCol(t);
  if (oc === 'concluido') return 'concluido';
  if (oc === 'aguardando_revisao') return 'revisao';
  if (oc === 'afazer') return 'afazer';
  return 'andamento';
}
const OP_LABEL = { afazer:'A Fazer', producao:'Em produção', aguardando_designer:'Aguardando designer', aguardando_legenda:'Aguardando legenda/post', aguardando_revisao:'Revisão do cliente', aguardando_final:'Aguardando aprov. final', concluido:'Concluído' };

// ---------- OLD (lógica reprovada 1.0.98/1.0.86 — para o teste falhar no caso antigo) ----------
function boardCol4_OLD(t) { return t.status || 'afazer'; }              // quadro setor usava status BRUTO
function operationalCol_OLD(t) {
  if (sec(t) !== 'cronograma') return t.status || 'afazer';
  const cf = (t.clientFlowStatus) || (t.status === 'concluido' ? 'concluido' : '');
  if (t.operationalStatus === 'concluido' || t.finalApprovalCompleted || cf === 'concluido' || t.status === 'concluido') return 'concluido';
  return 'producao';
}

const C3 = [{tema:'T1'},{tema:'T2'},{tema:'T3'}];
const C3full = [{tema:'T1',legenda:'L1',feedImageUrl:'f1'},{tema:'T2',legenda:'L2',feedImageUrl:'f2'},{tema:'T3',legenda:'L3',feedImageUrl:'f3'}];

// 12 fixtures cobrindo o fluxo real. final=true só quando DEVE concluir.
const F = [
  ['01 Temas pendentes (enviado)',            {sector:'cronograma',status:'andamento',clientSentBy:'u',cronStatus:'enviado_cliente',cronContents:C3}, false],
  ['02 Temas aprovados sem designer',         {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',cronStatus:'aprovado_cliente',cronContents:C3}, false],
  ['03 Enviado ao designer',                  {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',assignedDesignerId:'d',designerFlowStatus:'afazer',cronContents:C3}, false],
  ['04 Designer em produção',                 {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',assignedDesignerId:'d',designerFlowStatus:'andamento',cronContents:C3}, false],
  ['05 Designer entregou sem legenda',        {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:C3}, false],
  ['06 Legenda ok, sem feed',                 {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:[{tema:'T',legenda:'L'}]}, false],
  ['07 Feed/story ok, aguardando cliente',    {sector:'cronograma',status:'andamento',clientFlowStatus:'reenviado',cronStatus:'ready_for_final_client_review',assignedDesignerId:'d',designerFlowStatus:'concluido',clientApprovalPhase:'final',cronContents:C3full}, false],
  ['08 Cliente pediu revisão',                {sector:'cronograma',status:'revisao',clientFlowStatus:'revisao',clientReview:{status:'revisao'},assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:C3full}, false],
  ['09 Produção aprovada, não-final',         {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',clientApprovalPhase:'production',clientReview:{status:'aprovado'},assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:C3full}, false],
  ['10 APROVACAO FINAL real',                 {sector:'cronograma',status:'concluido',clientFlowStatus:'concluido',finalApprovalCompleted:true,clientApprovalPhase:'final',assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:C3full}, true],
  ['11 Legado concluido legitimo',            {sector:'cronograma',status:'concluido',clientFlowStatus:'concluido',cronContents:C3full}, true],
  ['12 status BRUTO=concluido + pendencias',  {sector:'cronograma',status:'concluido',assignedDesignerId:'d',designerFlowStatus:'andamento',cronContents:C3}, false],
];

function surfaces(t) {
  const oc = operationalCol(t);
  return {
    cardText: OP_LABEL[oc] || oc,            // card (cronograma usa operationalCol)
    modalChip: OP_LABEL[oc] || oc,           // chip do modal (cronograma usa operationalCol)
    kanbanCliente: clientCol(t),
    kanbanOperacional: oc,
    kanbanSetor: boardCol4(t),               // Setor / Meu quadro
  };
}
const isConcl = s => s === 'concluido' || /Conclu/i.test(s);

const pad = (s,n) => (String(s)+' '.repeat(n)).slice(0,n);
let failNew = 0, failOldDetected = 0;
console.log('FIXTURE'.padEnd(38)+'| card / setor / cliente / operacional                 | OLD setor/op | veredito');
console.log('-'.repeat(130));
for (const [name, t, shouldFinal] of F) {
  const sN = surfaces(t);
  const anyConcl = [sN.cardText,sN.modalChip,sN.kanbanCliente,sN.kanbanOperacional,sN.kanbanSetor].some(isConcl);
  const oldSetor = boardCol4_OLD(t), oldOp = operationalCol_OLD(t);
  const oldEarly = !shouldFinal && (isConcl(oldSetor) || isConcl(oldOp));
  if (oldEarly) failOldDetected++;
  let verd;
  if (shouldFinal) { verd = anyConcl ? 'OK (concluido final)' : 'FALHA: deveria concluir'; if (!anyConcl) failNew++; }
  else { verd = !anyConcl ? 'OK (sem Concluido)' : 'FALHA: concluiu cedo!'; if (anyConcl) failNew++; }
  console.log(pad(name,38)+'| '+pad(sN.cardText+' / '+sN.kanbanSetor+' / '+sN.kanbanCliente+' / '+sN.kanbanOperacional,52)+'| '+pad(oldSetor+'/'+oldOp,12)+' | '+verd);
}
console.log('-'.repeat(130));
console.log(`NEW: ${failNew} falha(s).  OLD detectaria conclusao prematura em ${failOldDetected} fixture(s).`);
if (failNew > 0) { console.error('\nMATRIZ REPROVADA: alguma superficie mostra Concluido cedo.'); process.exit(1); }
if (failOldDetected === 0) { console.error('\nMATRIZ INVALIDA: nao cobre o caso antigo.'); process.exit(2); }
console.log('\nMATRIZ APROVADA: nenhuma superficie conclui antes da aprovacao final; casos legitimos preservados; regressao antiga coberta.');
