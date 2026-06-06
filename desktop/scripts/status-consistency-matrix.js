// Validação da derivação de status operacional — OLD (V64.13/1.0.98) vs NEW (consistency-fix).
// Replica fielmente a lógica do Desktop/Android para provar que "Concluído" só aparece na aprovação final.

function secKey(t){ return (t.sector||'')==='cronograma' ? 'cronograma' : 'outro'; }
function hasDesigner(t){ return !!t.assignedDesignerId; }
function designerCol(t){ const v=t.designerFlowStatus||''; return ['afazer','andamento','revisao','concluido'].includes(v)?v:(t.status||'afazer'); }
function designerDelivered(t){ return hasDesigner(t)&&designerCol(t)==='concluido'; }
function pendingLegend(t){ const a=t.cronContents||[]; return !a.length||a.some(c=>!(c&&c.legenda&&String(c.legenda).trim())); }
function pendingFeed(t){ const a=t.cronContents||[]; return !a.length||a.some(c=>!(c&&c.feedImageUrl)); }
function pendingStory(t){ const a=t.cronContents||[]; return a.some(c=>c&&c.storyImageUrl)&&a.some(c=>!(c&&c.storyImageUrl)); }
function pendingProduction(t){ return pendingLegend(t)||pendingFeed(t); }

// ---------- OLD ----------
function clientColOLD(t){
  const v=t.clientFlowStatus||''; const KEYS=['afazer','enviado','aprovado','producao','revisao','reenviado','concluido'];
  if(KEYS.includes(v))return v;
  const ws=t.workflowStage||'',cs=t.cronStatus||'',cr=(t.clientReview&&t.clientReview.status)||'',st=t.status||'';
  if(st==='concluido'||ws==='concluido'||cs==='aprovado_final')return 'concluido';
  if(cr==='revisao'||cs==='em_revisao_cliente'||cs==='editado_cliente')return 'revisao';
  if(cs==='ready_for_final_client_review'||cs==='reenviado_cliente')return 'reenviado';
  if(hasDesigner(t)||cs==='sent_to_designer'||ws==='producao')return 'producao';
  if(cr==='aprovado'||cs==='aprovado_cliente')return 'aprovado';
  if(cs==='enviado_cliente'||t.clientSentBy)return 'enviado';
  return 'afazer';
}
function operationalColOLD(t){
  if(secKey(t)!=='cronograma')return t.status||'afazer';
  const cf=clientColOLD(t);
  if(t.operationalStatus==='concluido'||t.finalApprovalCompleted||cf==='concluido')return 'concluido';
  if(cf==='revisao')return 'aguardando_revisao';
  if(cf==='reenviado')return 'aguardando_final';
  if(hasDesigner(t)){ if(designerCol(t)!=='concluido')return 'aguardando_designer'; return pendingProduction(t)?'aguardando_legenda':'aguardando_final'; }
  if(cf==='aprovado')return pendingProduction(t)?'aguardando_legenda':'producao';
  if(cf==='afazer')return 'afazer';
  return 'producao';
}

// ---------- NEW ----------
function isFullyComplete(t){
  if(secKey(t)!=='cronograma')return (t.status)==='concluido';
  if(hasDesigner(t)&&!designerDelivered(t))return false;
  if(pendingProduction(t))return false;
  if(pendingStory(t))return false;
  if((t.clientReview&&t.clientReview.status)==='revisao')return false;
  return !!(t.finalApprovalCompleted===true||t.operationalStatus==='concluido'||t.clientFlowStatus==='concluido');
}
function clientColNEW(t){
  const v=t.clientFlowStatus||''; const KEYS=['afazer','enviado','aprovado','producao','revisao','reenviado','concluido'];
  if(KEYS.includes(v)){ if(v==='concluido'&&!isFullyComplete(t))return 'reenviado'; return v; }
  const ws=t.workflowStage||'',cs=t.cronStatus||'',cr=(t.clientReview&&t.clientReview.status)||'';
  if(isFullyComplete(t))return 'concluido';
  if(cr==='revisao'||cs==='em_revisao_cliente'||cs==='editado_cliente')return 'revisao';
  if(cs==='ready_for_final_client_review'||cs==='reenviado_cliente')return 'reenviado';
  if(hasDesigner(t)||cs==='sent_to_designer'||ws==='producao')return 'producao';
  if(cr==='aprovado'||cs==='aprovado_cliente')return 'aprovado';
  if(cs==='enviado_cliente'||t.clientSentBy)return 'enviado';
  return 'afazer';
}
function operationalColNEW(t){
  if(secKey(t)!=='cronograma')return t.status||'afazer';
  if(isFullyComplete(t))return 'concluido';
  const cf=clientColNEW(t);
  if(cf==='revisao')return 'aguardando_revisao';
  if(cf==='reenviado')return 'aguardando_final';
  if(hasDesigner(t)){ if(designerCol(t)!=='concluido')return 'aguardando_designer'; return pendingProduction(t)?'aguardando_legenda':'aguardando_final'; }
  if(cf==='aprovado')return pendingProduction(t)?'aguardando_legenda':'producao';
  if(cf==='afazer')return 'afazer';
  return 'producao';
}

const C3=[{tema:'T1'},{tema:'T2'},{tema:'T3'}];
const C3full=[{tema:'T1',legenda:'L1',feedImageUrl:'f1'},{tema:'T2',legenda:'L2',feedImageUrl:'f2'},{tema:'T3',legenda:'L3',feedImageUrl:'f3'}];

const fixtures=[
 ['1. Rascunho (nada enviado)',                 {sector:'cronograma',status:'afazer',cronContents:C3}],
 ['2. Enviado ao cliente (aguard. temas)',      {sector:'cronograma',status:'andamento',clientSentBy:'u1',cronStatus:'enviado_cliente',cronContents:C3}],
 ['3. Temas aprovados (sem designer)',          {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',cronStatus:'aprovado_cliente',cronContents:C3}],
 ['4. Enviado ao designer (produzindo)',        {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',assignedDesignerId:'d1',designerFlowStatus:'andamento',cronContents:C3}],
 ['5. Designer entregou, falta legenda/feed',   {sector:'cronograma',status:'andamento',clientFlowStatus:'aprovado',assignedDesignerId:'d1',designerFlowStatus:'concluido',cronContents:C3}],
 ['6. Produção pronta, reenviado p/ final',     {sector:'cronograma',status:'andamento',clientFlowStatus:'reenviado',cronStatus:'ready_for_final_client_review',assignedDesignerId:'d1',designerFlowStatus:'concluido',clientApprovalPhase:'final',cronContents:C3full}],
 ['7. Cliente pediu revisão',                   {sector:'cronograma',status:'revisao',clientFlowStatus:'revisao',clientReview:{status:'revisao'},assignedDesignerId:'d1',designerFlowStatus:'concluido',cronContents:C3full}],
 ['8. APROVAÇÃO FINAL real',                    {sector:'cronograma',status:'concluido',clientFlowStatus:'concluido',finalApprovalCompleted:true,clientApprovalPhase:'final',assignedDesignerId:'d1',designerFlowStatus:'concluido',cronContents:C3full}],
 ['BUG-A: status BRUTO=concluido, designer produzindo', {sector:'cronograma',status:'concluido',assignedDesignerId:'d1',designerFlowStatus:'andamento',cronContents:C3}],
 ['BUG-B: operationalStatus=concluido cedo, falta legenda',{sector:'cronograma',status:'andamento',operationalStatus:'concluido',cronContents:C3}],
 ['BUG-C: clientFlowStatus=concluido mas falta feed', {sector:'cronograma',status:'andamento',clientFlowStatus:'concluido',cronContents:[{tema:'T1',legenda:'L1'}]}],
 ['LEGADO: concluído real antigo (sem flags novas)', {sector:'cronograma',status:'concluido',clientFlowStatus:'concluido',cronContents:C3full}],
];

const pad=(s,n)=>(s+' '.repeat(n)).slice(0,n);
console.log(pad('CENÁRIO',52)+' | '+pad('OLD opCol',20)+' | '+pad('NEW opCol',20)+' | VEREDITO');
console.log('-'.repeat(120));
let bugFixed=0,preserved=0;
for(const [name,t] of fixtures){
  const o=operationalColOLD(t), n=operationalColNEW(t);
  const isBug=name.startsWith('BUG');
  const oConcl=o==='concluido', nConcl=n==='concluido';
  let verdict='';
  if(isBug){ verdict = (oConcl&&!nConcl) ? '✅ BUG CORRIGIDO (era Concluído, agora não)' : (nConcl?'❌ AINDA BUGADO':'✅ ok'); if(oConcl&&!nConcl)bugFixed++; }
  else if(name.startsWith('8.')||name.startsWith('LEGADO')){ verdict = nConcl?'✅ Concluído preservado':'❌ REGRESSÃO (deveria concluir)'; if(nConcl)preserved++; }
  else { verdict = !nConcl?'✅ não-concluído (correto)':'❌ concluiu cedo'; }
  console.log(pad(name,52)+' | '+pad(o,20)+' | '+pad(n,20)+' | '+verdict);
}
console.log('-'.repeat(120));
console.log(`RESUMO: ${bugFixed} bugs de conclusão-prematura corrigidos; ${preserved} conclusões legítimas preservadas.`);
