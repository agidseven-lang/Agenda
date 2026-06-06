#!/usr/bin/env node
/* Matriz da MÁQUINA DE ESTADOS do cronograma (Desktop 1.0.101 / Android 1.0.89).
 * Cobre os casos A–H do fluxo real (vídeo) por PAPEL: cliente, social, designer, meu_quadro, setor.
 * Regra de ouro: antes de existir designer, NUNCA mostrar aguardando_legenda/aguardando_designer/
 * aguardando_final/concluido. Sai com exit 1 se qualquer expectativa falhar. */

const sec = t => ((t.sector||'')==='cronograma'?'cronograma':'outro');
const hasDesigner = t => !!t.assignedDesignerId;
const designerCol = t => { const v=t.designerFlowStatus||''; return ['afazer','andamento','revisao','concluido'].includes(v)?v:(t.status||'afazer'); };
const designerDelivered = t => hasDesigner(t)&&designerCol(t)==='concluido';
const pendingLegend = t => { const a=t.cronContents||[]; return !a.length||a.some(c=>!(c&&c.legenda&&String(c.legenda).trim())); };
const pendingFeed = t => { const a=t.cronContents||[]; return !a.length||a.some(c=>!(c&&c.feedImageUrl)); };
const pendingStory = t => { const a=t.cronContents||[]; return a.some(c=>c&&c.storyImageUrl)&&a.some(c=>!(c&&c.storyImageUrl)); };
const pendingProduction = t => pendingLegend(t)||pendingFeed(t);
const hasPendingItemRevision = t => { const ci=t.clientItems; if(!ci||typeof ci!=='object')return false; return Object.keys(ci).some(k=>['em_revisao','editado'].includes(ci[k]&&ci[k].cs)); };

function isFullyComplete(t){
  if(sec(t)!=='cronograma')return t.status==='concluido';
  if(hasDesigner(t)&&!designerDelivered(t))return false;
  if(pendingProduction(t))return false;
  if(pendingStory(t))return false;
  if((t.clientReview&&t.clientReview.status)==='revisao')return false;
  return !!(t.finalApprovalCompleted===true||t.operationalStatus==='concluido'||t.clientFlowStatus==='concluido'||t.cronStatus==='aprovado_final');
}
function clientCol(t){
  const v=t.clientFlowStatus||''; const KEYS=['afazer','enviado','aprovado','producao','revisao','reenviado','concluido'];
  if(KEYS.includes(v)){ if(v==='concluido'&&!isFullyComplete(t))return 'reenviado'; return v; }
  const cs=t.cronStatus||'', cr=(t.clientReview&&t.clientReview.status)||'';
  if(isFullyComplete(t))return 'concluido';
  if(cr==='revisao'||cs==='em_revisao_cliente'||cs==='editado_cliente')return 'revisao';
  if(cs==='ready_for_final_client_review'||cs==='reenviado_cliente')return 'reenviado';
  if(hasDesigner(t)||cs==='sent_to_designer')return 'producao';
  if(cr==='aprovado'||cs==='aprovado_cliente')return 'aprovado';
  if(cs==='enviado_cliente'||t.clientSentBy)return 'enviado';
  return 'afazer';
}
function operationalCol(t){            // = coluna do quadro SOCIAL (7 colunas)
  if(sec(t)!=='cronograma')return t.status||'afazer';
  if(isFullyComplete(t))return 'concluido';
  const cf=clientCol(t);
  if(cf==='revisao'||hasPendingItemRevision(t))return 'aguardando_revisao';
  if(cf==='reenviado')return 'aguardando_final';
  if(hasDesigner(t)){
    if(designerCol(t)!=='concluido')return 'aguardando_designer';
    return pendingProduction(t)?'aguardando_legenda':'aguardando_final';
  }
  if(cf==='aprovado')return 'aguardando_envio';   // FIX: sem designer nunca vira aguardando_legenda
  if(cf==='afazer')return 'afazer';
  return 'producao';
}
function boardCol4(t){                  // meu_quadro / setor (4 colunas)
  if(sec(t)!=='cronograma')return t.status||'afazer';
  const oc=operationalCol(t);
  if(oc==='concluido')return 'concluido';
  if(oc==='aguardando_revisao')return 'revisao';
  if(oc==='afazer')return 'afazer';
  return 'andamento';
}
const colForRole=(t,role)=> role==='cliente'?clientCol(t): role==='social'?operationalCol(t): role==='designer'?designerCol(t): boardCol4(t);

const TH=[{tema:'T1'},{tema:'T2'},{tema:'T3'}];
const FULL=[{tema:'T1',legenda:'L1',feedImageUrl:'f1'},{tema:'T2',legenda:'L2',feedImageUrl:'f2'},{tema:'T3',legenda:'L3',feedImageUrl:'f3'}];

// caso: [nome, task, expect{cliente,social,designer,meu_quadro,setor}, designerAppears]
const CASES=[
 ['A temas enviados, sem avaliacao', {sector:'cronograma',status:'andamento',clientSentBy:'u',cronStatus:'enviado_cliente',cronContents:TH},
    {cliente:'enviado',social:'producao',designer:'afazer',meu_quadro:'andamento',setor:'andamento'}, false],
 ['B aprovou alguns + ajuste em um',  {sector:'cronograma',status:'revisao',clientFlowStatus:'revisao',clientReview:{status:'revisao'},clientItems:{i0:{cs:'aprovado'},i1:{cs:'em_revisao'},i2:{cs:'aprovado'}},cronContents:TH},
    {cliente:'revisao',social:'aguardando_revisao',designer:'afazer',meu_quadro:'revisao',setor:'revisao'}, false],
 ['C todos aprovados, sem designer',  {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',cronStatus:'aprovado_cliente',cronContents:TH},
    {cliente:'aprovado',social:'aguardando_envio',designer:'afazer',meu_quadro:'andamento',setor:'andamento'}, false],
 ['D enviado ao designer',            {sector:'cronograma',status:'afazer',clientFlowStatus:'producao',assignedDesignerId:'d',designerFlowStatus:'afazer',operationalStatus:'aguardando_designer',cronStatus:'sent_to_designer',cronContents:TH},
    {cliente:'producao',social:'aguardando_designer',designer:'afazer',meu_quadro:'andamento',setor:'andamento'}, true],
 ['E designer iniciou',               {sector:'cronograma',status:'andamento',clientFlowStatus:'producao',assignedDesignerId:'d',designerFlowStatus:'andamento',cronContents:TH},
    {cliente:'producao',social:'aguardando_designer',designer:'andamento',meu_quadro:'andamento',setor:'andamento'}, true],
 ['F designer entregou (sem legenda)',{sector:'cronograma',status:'andamento',clientFlowStatus:'producao',assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:TH},
    {cliente:'producao',social:'aguardando_legenda',designer:'concluido',meu_quadro:'andamento',setor:'andamento'}, true],
 ['G reenviado p/ aprovacao final',   {sector:'cronograma',status:'andamento',clientFlowStatus:'reenviado',cronStatus:'ready_for_final_client_review',clientApprovalPhase:'final',assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:FULL},
    {cliente:'reenviado',social:'aguardando_final',designer:'concluido',meu_quadro:'andamento',setor:'andamento'}, true],
 ['H cliente aprovou final',          {sector:'cronograma',status:'concluido',clientFlowStatus:'concluido',finalApprovalCompleted:true,clientApprovalPhase:'final',assignedDesignerId:'d',designerFlowStatus:'concluido',cronContents:FULL},
    {cliente:'concluido',social:'concluido',designer:'concluido',meu_quadro:'concluido',setor:'concluido'}, true],
];

const PRE_DESIGNER_FORBIDDEN=['aguardando_legenda','aguardando_designer','aguardando_final','concluido'];
const ROLES=['cliente','social','designer','meu_quadro','setor'];
const pad=(s,n)=>(String(s)+' '.repeat(n)).slice(0,n);
let fails=0;
console.log(pad('CASO',34)+'| '+ROLES.map(r=>pad(r,16)).join('')+'| ver');
console.log('-'.repeat(140));
for(const [name,t,exp,dAppears] of CASES){
  const got={}; ROLES.forEach(r=>got[r]=colForRole(t,r));
  let ok=true; const errs=[];
  for(const r of ROLES){ if(r==='designer'&&!dAppears)continue; if(got[r]!==exp[r]){ok=false;errs.push(`${r}=${got[r]}!=${exp[r]}`);} }
  if(hasDesigner(t)!==dAppears){ok=false;errs.push(`designerAppears=${hasDesigner(t)}!=${dAppears}`);}
  if(!hasDesigner(t)&&PRE_DESIGNER_FORBIDDEN.includes(got.social)){ok=false;errs.push(`social PROIBIDO pre-designer: ${got.social}`);}
  if(!ok)fails++;
  console.log(pad(name,34)+'| '+ROLES.map(r=>pad(got[r],16)).join('')+'| '+(ok?'OK':'FALHA '+errs.join('; ')));
}
console.log('-'.repeat(140));
if(fails){console.error(`\nMATRIZ REPROVADA: ${fails} caso(s) divergente(s).`);process.exit(1);}

/* ===== GATE de aprovação PARCIAL (V64.16 / caso real do vídeo) =====
   Simula o gate server+client: 'approveAll' com QUALQUER item em ajuste vira FEEDBACK, não total. */
function approveAllResult(t){
  const ci=t.clientItems||{};
  const pend=Object.keys(ci).some(k=>['em_revisao','editado'].includes(ci[k]&&ci[k].cs))||(t.clientReview&&t.clientReview.status==='revisao');
  return pend ? 'feedback' : 'aprovado';   // feedback = "Feedback enviado!"; aprovado = "Temas aprovados!"
}
console.log('\n=== GATE de aprovação parcial (caso do vídeo) ===');
let gateFail=0;
const GATE=[
  ['T1 ok, T2 ajuste, T3 ok → approveAll', {clientItems:{i0:{cs:'aprovado'},i1:{cs:'em_revisao'},i2:{cs:'aprovado'}}}, 'feedback'],
  ['T1/T2 editado → approveAll',           {clientItems:{i0:{cs:'aprovado'},i1:{cs:'editado'}}},                     'feedback'],
  ['todos aprovados → approveAll',         {clientItems:{i0:{cs:'aprovado'},i1:{cs:'aprovado'},i2:{cs:'aprovado'}}}, 'aprovado'],
  ['equipe corrigiu, sem pendência → approveAll', {clientItems:{i0:{cs:'aprovado'},i1:{cs:'aprovado'}}},             'aprovado'],
];
for(const [name,t,exp] of GATE){ const got=approveAllResult(t); const ok=got===exp; if(!ok)gateFail++;
  console.log((ok?'OK   ':'FALHA')+' | '+pad(name,42)+' → '+got+' (esperado '+exp+')'); }
if(gateFail){console.error(`\nGATE REPROVADO: ${gateFail} caso(s).`);process.exit(1);}
console.log('\nMATRIZ APROVADA: A-H por papel + GATE de aprovacao parcial (aprovacao parcial NAO vira total; feedback quando ha ajuste).');
