#!/usr/bin/env node
/* F3.3.16 — CONTRATO da APRESENTAÇÃO OPERACIONAL do card (fonte ÚNICA = Flow Engine).
 * READ-ONLY: extrai as funções REAIS do renderer (deriveOperationalCardPresentation, opOwnerLabel,
 * deriveCanonicalPerspective, FLOW_LABELS, flowRole, TASK_PHASE) e valida os cenários A–H × papéis:
 *   - chip = fase canônica por papel; "Etapa" = responsável/owner (NÃO repete o chip);
 *   - "Próxima ação" = next canônico (com linguagem do cliente);
 *   - "Concluído" só em COMPLETED (aprovação final real);
 *   - sem status duplicado (statusLabel !== ownerLabel).
 * Mocka só deriveCanonicalTaskState (injeta {phase,owner} por cenário) + leaves (secOf/hasDesigner/…).
 * Rodar: /opt/node22/bin/node desktop/scripts/f33I-flow-presentation.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

// ---- extratores (balanceamento de chaves) ----
function fnSrc(name){ const a=html.indexOf('function '+name+'('); if(a<0) throw new Error('fn não achada: '+name);
  let i=html.indexOf('{',a), d=0; for(let j=i;j<html.length;j++){ const c=html[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0) return html.slice(a,j+1);} } throw new Error('sem fecho: '+name); }
function constObj(name){ const a=html.indexOf('const '+name+'='); if(a<0) throw new Error('const não achada: '+name);
  let i=html.indexOf('{',a), d=0; for(let j=i;j<html.length;j++){ const c=html[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0) return html.slice(a,j+1)+';';} } throw new Error('sem fecho: '+name); }

const code = [
  fnSrc('isClientSector'),
  constObj('TASK_PHASE'),
  constObj('FLOW_LABELS'),
  fnSrc('flowRole'),
  fnSrc('opOwnerLabel'),
  fnSrc('deriveCanonicalPerspective'),
  fnSrc('deriveOperationalCardPresentation'),
].join('\n');

// mocks dos leaves: deriveCanonicalTaskState lê t.__cs (injetado por cenário); secOf=cronograma.
const make = new Function('deriveCanonicalTaskState','secOf','hasDesigner','designerStatusView','stOf','respOf',
  code + '\n;return {deriveOperationalCardPresentation, deriveCanonicalPerspective, TASK_PHASE, FLOW_LABELS};');
const api = make(
  (t)=> t.__cs,                                   // deriveCanonicalTaskState (injetado)
  ()=>({key:'cronograma',color:'#000',label:'Cronograma'}),
  (t)=>!!(t&&t.designerAssignment&&t.designerAssignment.designerId),
  ()=>({label:'(legado)',color:'#999'}),
  ()=>({label:'(legado)',color:'#999'}),
  ()=>({name:'Fulano'})
);
const { deriveOperationalCardPresentation:pres, TASK_PHASE:PH } = api;

let pass=0, fail=0; const ok=(n,c)=>{ if(c){pass++;} else {fail++; console.log('FAIL:',n);} };
const task=(phase,owner)=>({sector:'cronograma', designerAssignment:{designerId:'d1'}, __cs:{phase,owner}});
const P=(phase,owner,role)=>pres(task(phase,owner), role);

// ===== Cenários A–H (fase × owner conforme deriveCanonicalTaskState) =====
// A/B — Planejamento (criado / temas aprovados sem designer): NUNCA concluído
{ const s=P(PH.PLANNING,'social','social');
  ok('A/B social: não-final + sem "Concluído"', s.isFinal===false && !/Conclu/i.test(s.statusLabel)); }

// C — Social atribuiu designer (awaiting): Social e Designer veem "Aguardando designer iniciar"
{ const so=P(PH.AWAITING_DESIGNER,'designer','social'), de=P(PH.AWAITING_DESIGNER,'designer','designer');
  ok('C social: chip "Aguardando designer iniciar"', /aguardando designer iniciar/i.test(so.statusLabel));
  ok('C designer: chip "Aguardando designer iniciar"', /aguardando designer iniciar/i.test(de.statusLabel));
  ok('C designer: owner = Você', de.ownerLabel==='Responsável: Você');
  ok('C social: owner = Designer', so.ownerLabel==='Responsável: Designer');
  ok('C: não-final', !so.isFinal && !de.isFinal); }

// D — Designer iniciou: Social + Designer "Designer em produção"; Cliente "Equipe em produção"
{ const so=P(PH.DESIGNER_PRODUCING,'designer','social'), de=P(PH.DESIGNER_PRODUCING,'designer','designer'), cl=P(PH.DESIGNER_PRODUCING,'designer','client');
  ok('D social: chip "Designer em produção"', /designer em produção/i.test(so.statusLabel));
  ok('D designer: chip "Designer em produção"', /designer em produção/i.test(de.statusLabel));
  ok('D cliente: chip "Equipe em produção"', /equipe em produção/i.test(cl.statusLabel));
  ok('D social: owner=Designer / next entrega', so.ownerLabel==='Responsável: Designer' && /entrega do designer/i.test(so.nextAction));
  ok('D designer: owner=Você / next finalizar', de.ownerLabel==='Responsável: Você' && /finalizar e entregar/i.test(de.nextAction));
  ok('D cliente: owner=Equipe ID Seven / next versão final', cl.ownerLabel==='Responsável: Equipe ID Seven' && /versão final/i.test(cl.nextAction));
  ok('D: SEM duplicação (chip != etapa) nos 3 papéis', so.statusLabel!==so.ownerLabel && de.statusLabel!==de.ownerLabel && cl.statusLabel!==cl.ownerLabel);
  ok('D: não-final', !so.isFinal && !de.isFinal && !cl.isFinal); }

// E — Designer entregou: Social próxima ação correta; cliente NÃO vê aprovação final ainda
{ const so=P(PH.DESIGNER_DELIVERED,'social','social'), de=P(PH.DESIGNER_DELIVERED,'social','designer'), cl=P(PH.DESIGNER_DELIVERED,'social','client');
  ok('E social: next enviar ao cliente', /enviar ao cliente/i.test(so.nextAction));
  ok('E designer: chip "Entregue"', /entregue/i.test(de.statusLabel));
  ok('E: não-final (sem "Concluído")', !so.isFinal && !cl.isFinal && !/Conclu/i.test(cl.statusLabel)); }

// F — Aguardando aprovação final do cliente
{ const so=P(PH.AWAITING_CLIENT_APPROVAL,'client','social'), cl=P(PH.AWAITING_CLIENT_APPROVAL,'client','client');
  ok('F cliente: owner=Cliente', cl.ownerLabel==='Responsável: Cliente');
  ok('F cliente: next revisar tema/legenda/feed/story', /tema, legenda, feed e story/i.test(cl.nextAction));
  ok('F: não-final', !so.isFinal && !cl.isFinal); }

// G — Cliente aprovou final: SÓ AQUI "Concluído"
{ const so=P(PH.COMPLETED,'social','social'), de=P(PH.COMPLETED,'social','designer'), cl=P(PH.COMPLETED,'social','client');
  ok('G social: chip "Concluído final"', /concluído final/i.test(so.statusLabel));
  ok('G: isFinal nos 3 papéis', so.isFinal && de.isFinal && cl.isFinal);
  ok('G: etapa "Fluxo finalizado" + next "Nenhuma pendência"', so.ownerLabel==='Fluxo finalizado' && /nenhuma pendência/i.test(so.nextAction));
  ok('G: sem duplicação', so.statusLabel!==so.ownerLabel); }

// H — Cliente pediu revisão: todos em revisão, NÃO concluído
{ const so=P(PH.CLIENT_REQUESTED_CHANGES,'social','social'), de=P(PH.CLIENT_REQUESTED_CHANGES,'social','designer'), cl=P(PH.CLIENT_REQUESTED_CHANGES,'social','client');
  ok('H: não-final nos 3 papéis', !so.isFinal && !de.isFinal && !cl.isFinal);
  ok('H: sem "Concluído" em nenhum papel', !/Conclu/i.test(so.statusLabel) && !/Conclu/i.test(de.statusLabel) && !/Conclu/i.test(cl.statusLabel)); }

// INVARIANTE GLOBAL — em TODA fase não-final e TODO papel: sem duplicação e sem "Concluído"
{ const phases=[PH.PLANNING,PH.AWAITING_DESIGNER,PH.DESIGNER_PRODUCING,PH.DESIGNER_REVISING,PH.DESIGNER_DELIVERED,PH.AWAITING_CLIENT_APPROVAL,PH.CLIENT_REQUESTED_CHANGES];
  let dup=0, early=0;
  for(const ph of phases){ for(const role of ['social','designer','client']){ const r=P(ph,'designer',role);
    if(r.statusLabel===r.ownerLabel) dup++; if(/Conclu/i.test(r.statusLabel)||r.isFinal) early++; } }
  ok('GLOBAL: zero duplicação chip/etapa em fases não-finais', dup===0);
  ok('GLOBAL: zero "Concluído"/isFinal em fases não-finais', early===0); }

console.log('\nF3.3.16 FLOW PRESENTATION: '+pass+' PASS / '+fail+' FAIL');
if(fail){ console.error('::error:: contrato da apresentação F3.3.16 divergiu'); process.exit(1); }
console.log('OK — fonte única; chip=fase, etapa=responsável, próxima=next; sem duplicação; "Concluído" só no final.');
