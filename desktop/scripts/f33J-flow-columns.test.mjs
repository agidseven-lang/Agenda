#!/usr/bin/env node
/* F3.3.17 — CONTRATO de COORDENAÇÃO coluna≡chip (fonte única) + REGRA "Finalizado só no final".
 * READ-ONLY: extrai funções REAIS (flowBoardCol, personBoardCol, deriveBoardColumn,
 * deriveCanonicalPerspective, deriveOperationalCardPresentation, FLOW_LABELS) e prova que a COLUNA
 * do quadro e o CHIP do card vêm da MESMA fase canônica (coordenados), nos 3 papéis, e que o
 * personBoard ("Meu quadro") nunca manda ENTREGUE(não-final) para "Finalizado".
 * Mocka deriveCanonicalTaskState (injeta {phase,owner}) + leaves. Não substitui o teste de browser
 * (visual-qa-f3317) que prova o ciclo write→snapshot→render real.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33J-flow-columns.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DH = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
function fnSrc(n){ const a=DH.indexOf('function '+n+'('); if(a<0)throw new Error('fn '+n); let d=0; for(let j=DH.indexOf('{',a);j<DH.length;j++){const c=DH[j]; if(c==='{')d++; else if(c==='}'){d--; if(!d)return DH.slice(a,j+1);}} }
function constObj(n){ const a=DH.indexOf('const '+n+'='); if(a<0)throw new Error('const '+n); let d=0; for(let j=DH.indexOf('{',a);j<DH.length;j++){const c=DH[j]; if(c==='{')d++; else if(c==='}'){d--; if(!d)return DH.slice(a,j+1)+';';}} }

const code=[fnSrc('isClientSector'),constObj('TASK_PHASE'),constObj('FLOW_LABELS'),fnSrc('flowRole'),fnSrc('opOwnerLabel'),
  fnSrc('deriveCanonicalPerspective'),fnSrc('deriveBoardColumn'),fnSrc('deriveOperationalCardPresentation'),
  fnSrc('flowBoardCol'),fnSrc('personBoardCol')].join('\n');

const make=new Function('deriveCanonicalTaskState','secOf','isTaskCompleted','hasDesigner','designerOf',
  'designerCol','designerColView','clientCol4','stOf','respOf','designerStatusView',
  code+'\n;return {flowBoardCol,personBoardCol,deriveBoardColumn,deriveCanonicalPerspective,deriveOperationalCardPresentation,TASK_PHASE};');
const api=make(
  (t)=>t.__cs,                                              // deriveCanonicalTaskState (injeta fase)
  (x)=>({key:(x==='cronograma'?'cronograma':'outro')}),     // secOf(t.sector) — passamos string em t.sector
  (t)=>t.finalApprovalCompleted===true,                    // isTaskCompleted real (flag)
  (t)=>!!(t&&t.designerAssignment&&t.designerAssignment.designerId),
  (t)=>t&&t.designerAssignment&&t.designerAssignment.designerId,
  (t)=>{var v=(t&&t.designerFlowStatus||'');return ['afazer','andamento','revisao','concluido'].indexOf(v)>=0?v:'afazer';},
  (t)=>{var c=(t&&t.designerFlowStatus||'afazer');return c==='concluido'?'entregue':(c==='revisao'?'revisao':(c==='afazer'?'afazer':'andamento'));},
  ()=>'analise', ()=>({label:'x',color:'#000'}), ()=>({name:'F'}), ()=>({label:'x',color:'#000'})
);
const { flowBoardCol:col, personBoardCol:pcol, deriveCanonicalPerspective:persp, deriveOperationalCardPresentation:pres, TASK_PHASE:PH }=api;

let pass=0,fail=0; const ok=(n,c)=>{ if(c)pass++; else {fail++; console.log('FAIL:',n);} };
// fábrica: tarefa cronograma na fase X, com designerFlowStatus coerente + flag final
const T=(phase,owner,dfs,final)=>({sector:'cronograma',designerAssignment:{designerId:'d1'},__cs:{phase,owner},designerFlowStatus:dfs||'afazer',finalApprovalCompleted:!!final});

// ===== 1) COORDENAÇÃO coluna≡chip (mesma fase canônica) p/ social/client =====
const phases=[PH.PLANNING,PH.AWAITING_DESIGNER,PH.DESIGNER_PRODUCING,PH.DESIGNER_REVISING,PH.DESIGNER_DELIVERED,PH.AWAITING_CLIENT_APPROVAL,PH.CLIENT_REQUESTED_CHANGES,PH.COMPLETED];
for(const ph of phases){
  for(const role of ['social','client']){
    const t=T(ph,(ph===PH.AWAITING_CLIENT_APPROVAL?'client':'social'));
    const c=col(t,role), pcol_=persp(t,role).col;
    ok(`coluna≡chip [${ph}/${role}] (col=${c})`, c===pcol_);
  }
}

// ===== 2) personBoard — REGRA "Finalizado só no final" + designer não-iniciado→A Fazer =====
ok('person: designer NÃO-iniciou (afazer) → A Fazer', pcol(T(PH.AWAITING_DESIGNER,'designer','afazer',false),'d1')==='afazer');
ok('person: designer em produção → Em andamento', pcol(T(PH.DESIGNER_PRODUCING,'designer','andamento',false),'d1')==='andamento');
ok('person: designer ENTREGUE (não-final) → Em andamento (NUNCA Finalizado)', pcol(T(PH.DESIGNER_DELIVERED,'designer','concluido',false),'d1')==='andamento');
ok('person: aprovação final (isTaskCompleted) → Finalizado', pcol(T(PH.COMPLETED,'social','concluido',true),'d1')==='concluido');
ok('person: revisão do cliente → Revisão (não Finalizado)', pcol(T(PH.CLIENT_REQUESTED_CHANGES,'social','concluido',false),'d1')!=='concluido');

// ===== 3) "concluido"/Finalizado em QUALQUER coluna social SÓ quando isTaskCompleted =====
for(const ph of phases.filter(p=>p!==PH.COMPLETED)){
  const t=T(ph,'social',(ph===PH.DESIGNER_DELIVERED||ph===PH.AWAITING_CLIENT_APPROVAL||ph===PH.CLIENT_REQUESTED_CHANGES?'concluido':'afazer'),false);
  ok(`social col != concluido em fase não-final [${ph}]`, col(t,'social')!=='concluido');
  ok(`personBoard != concluido em fase não-final [${ph}]`, pcol(t,'d1')!=='concluido');
}

// ===== 4) chip e coluna nunca "Concluído"/Finalizado antes do final (coerência com F3.3.16) =====
{ const t=T(PH.DESIGNER_DELIVERED,'social','concluido',false);
  ok('entregue: chip social não-final', pres(t,'social').isFinal===false);
  ok('entregue: coluna social ≠ concluido', col(t,'social')!=='concluido'); }

console.log('\nF3.3.17 FLOW COLUMNS: '+pass+' PASS / '+fail+' FAIL');
if(fail){ console.error('::error:: contrato de coluna F3.3.17 divergiu'); process.exit(1); }
console.log('OK — coluna≡chip (fonte única) nos papéis; "Finalizado" só no final real; personBoard sem entregue→Finalizado.');
