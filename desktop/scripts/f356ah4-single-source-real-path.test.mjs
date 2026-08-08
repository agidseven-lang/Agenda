#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H4 — FONTE ÚNICA do estado "enviado ao cliente" pelo CAMINHO REAL DE CRIAÇÃO.
 *
 * 1.0.232 foi REPROVADA fisicamente: criar um Cronograma e clicar "Enviar para o cliente"
 * (SEM confirmar) já mostrava "Temas enviados ao cliente"/Responsável Cliente. Causa: saveTask()
 * gravava clientFlowStatus='enviado' na CRIAÇÃO (sendAfter=true) e flowCanonicalSentSignal tratava
 * esse espelho legado como ENVIO — divergindo da Central (externalWaitOf), que exige a fase de
 * espera server-side (workflowPhase). O RED da H3 semeou só token e não pegou este produtor.
 *
 * Correção H4 (renderer + espelho main, paridade golden master F3.4.4):
 *  - WRITER: a criação nunca grava clientFlowStatus='enviado' (nasce 'afazer'); "Enviar" só deixa
 *    cronStatus='pronto_cliente'. O "enviado" canônico é gravado SÓ pelo Worker (confirmClientSend).
 *  - READER: flowCanonicalSentSignal ganha o MESMO guard da Central (externalWaitOf): se HÁ
 *    workflowPhase (tarefa nova), espelho legado NÃO conta — fonte única = fase de espera server-side;
 *    fallback legado SÓ p/ registro genuinamente antigo (sem workflowPhase).
 *  - flowSentToClientSignal (final round) recebe o mesmo guard.
 *  - flowThemesReadySignal passa a reconhecer cronStatus='pronto_cliente' (link ainda não gerado).
 *
 * Esta suíte roda os PREDICADOS REAIS dos bytes + o CAMINHO REAL do writer (o ramo exato de saveTask
 * extraído do index.html), reproduzindo a criação e provando RED (1.0.232) → GREEN (1.0.233).
 * Modo asar: env F356AH4_SRC / F356AH4_SLARULES.
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH4_SRC || path.join(DESK,'src','renderer','index.html'),'utf8');
const SLARULES = process.env.F356AH4_SLARULES || path.join(DESK,'src','main','slaRules.js');

let pass=0, fail=0; const flog=[];
const ok=(n,c)=>{ if(c){pass++;} else {fail++; flog.push('FAIL: '+n);} };

function grabFn(SRC,name){
  const a=SRC.indexOf('function '+name+'(');
  if(a<0) throw new Error('não achei: '+name+' em '+(SRC===HTML?'index.html':'slaRules.js'));
  let d=0; for(let j=SRC.indexOf('{',a); j<SRC.length; j++){const c=SRC[j]; if(c==='{')d++; else if(c==='}'){d--; if(!d) return SRC.slice(a,j+1);}}
  throw new Error('sem fim: '+name);
}
// ---- Predicados REAIS (renderer) extraídos verbatim + folhas mínimas justificadas ----
const STUBS = `
  function hasDesigner(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}
  function hasPendingItemRevision(t){return false;}
  function isTaskCompleted(t){return false;}
  function flowCompletedSignal(t){return isTaskCompleted(t);}
`;
function loadPreds(SRC){
  const body = STUBS+'\n'+[
    grabFn(SRC,'flowCanonicalSentSignal'),
    grabFn(SRC,'flowThemesSentSignal'),
    grabFn(SRC,'flowThemesReadySignal'),
    grabFn(SRC,'flowSentToClientSignal'),
    grabFn(SRC,'flowClientChangesSignal'),
    grabFn(SRC,'flowThemesApprovedSignal'),
  ].join('\n')+'\nreturn {flowCanonicalSentSignal,flowThemesSentSignal,flowThemesReadySignal,flowSentToClientSignal,flowClientChangesSignal,flowThemesApprovedSignal,flowCompletedSignal,hasDesigner};';
  return (new Function(body))();
}
const R = loadPreds(HTML);

/* Reproduz a ORDEM canônica de deriveCanonicalTaskState p/ Cronograma (isCron=true) — index.html:7294-7313 */
function derive(F, t){
  if(F.flowCompletedSignal(t)) return {phase:'completed',owner:'social'};
  if(F.flowClientChangesSignal(t)) return {phase:'client_requested_changes',owner:'social'};
  if(F.flowSentToClientSignal(t)) return {phase:'awaiting_client_approval',owner:'client'};
  if(F.hasDesigner(t)) return {phase:'(designer)',owner:'designer'};
  if(F.flowThemesApprovedSignal(t)) return {phase:'themes_approved',owner:'social'};
  if(F.flowThemesSentSignal(t)) return {phase:'themes_sent',owner:'client'};
  if(F.flowThemesReadySignal(t)) return {phase:'themes_ready',owner:'social'};
  return {phase:'planning',owner:'social'};
}

/* ══ CAMINHO REAL DO WRITER: extrai o RAMO EXATO de saveTask (isClientSector) do index.html e
   monta o doc como a criação grava, para os dois gatilhos (sendAfter true/false). Não semeia à mão
   o clientFlowStatus/cronStatus — deriva do PRÓPRIO código de produção. ══ */
function creationDoc(sendAfter){
  // extrai a linha do ramo cliente do saveTask (contém data.cronStatus=... e data.clientFlowStatus=...)
  const anchor = HTML.indexOf("if(isClientSector(secOf(f.sector).key)){data.cronStatus=");
  if(anchor<0) throw new Error('ramo cliente do saveTask não encontrado');
  const seg = HTML.slice(anchor, anchor+600);
  // avalia o ramo num sandbox mínimo (data + sendAfter + f), capturando os campos gravados
  const data={}; const f={subtype:null};
  const src = seg.replace(/^if\(isClientSector\(secOf\(f\.sector\)\.key\)\)\{/, '').split('}')[0];
  // roda só as atribuições a data.* (cronStatus/cronSub/clientFlowStatus/clientWorkflowStage)
  (new Function('data','f','sendAfter', src))(data,f,sendAfter);
  // + campos que a criação SEMPRE grava p/ setor cliente (index.html:11634-11637): fase persistida
  return Object.assign({
    sector:'cronograma', title:'Cronograma Teste 3', client:'CLIENTE TESTE', status:'afazer',
    workflowPhase:'themes_preparation', workflowPhaseAt:1, workflowResponsibleType:'social', externalWait:false,
    phaseRuns:{ pr01_themes_preparation:{ phase:'themes_preparation', status:'active' } },
    cronContents:[{tema:'Tema 1'}], socialFlowStatus:'afazer'
  }, data);
}

/* ---------- A. IDENTIDADE / MARCADORES H4 ---------- */
ok('A1 index.html tem guard H4 no flowCanonicalSentSignal', /if\(wp\)return false;\s*\/\/ F3\.5\.6A-H4/.test(HTML));
ok('A2 saveTask não grava mais clientFlowStatus=enviado na criação', !/data\.clientFlowStatus=sendAfter\?'enviado':'afazer'/.test(HTML) && /data\.clientFlowStatus='afazer';data\.clientWorkflowStage='afazer';/.test(HTML));
ok('A3 flowThemesReadySignal reconhece pronto_cliente', /cs==='pronto_cliente'\|\|!!\(t\.clientReviewToken/.test(HTML));
ok('A4 flowSentToClientSignal tem guard de workflowPhase', /if\(wp==='captions_waiting_client'\)return true;if\(wp\)return false;/.test(HTML));

/* ---------- B. WRITER REAL — o que a criação grava ---------- */
const docSend = creationDoc(true);    // clicou "Enviar para o cliente"
const docDraft = creationDoc(false);  // salvou rascunho (data-form=save)
ok('B1 criação (Enviar) grava cronStatus=pronto_cliente', docSend.cronStatus==='pronto_cliente');
ok('B2 criação (Enviar) grava clientFlowStatus=afazer (NUNCA enviado)', docSend.clientFlowStatus==='afazer');
ok('B3 criação (rascunho) grava cronStatus=rascunho_social', docDraft.cronStatus==='rascunho_social');
ok('B4 criação (rascunho) grava clientFlowStatus=afazer', docDraft.clientFlowStatus==='afazer');
ok('B5 criação sempre nasce com workflowPhase=themes_preparation', docSend.workflowPhase==='themes_preparation');

/* ---------- C. RED (1.0.232) — a lógica ANTIGA falharia ---------- */
// Reproduz a flowCanonicalSentSignal ANTIGA (sem o guard if(wp)) + o writer antigo (clientFlowStatus='enviado').
function oldCanonicalSent(t){const wp=(t.workflowPhase||'').toString();if(wp==='themes_waiting_client'||wp==='captions_waiting_client')return true;const cf=(t.clientFlowStatus||'').toString();const cs=(t.cronStatus||'').toString();return cf==='enviado'||cf==='reenviado'||cs==='enviado_cliente';}
const oldDocSend = Object.assign({}, docSend, {clientFlowStatus:'enviado'}); // writer antigo
ok('C1 RED: writer+reader ANTIGOS marcavam enviado na criação (bug 1.0.232)', oldCanonicalSent(oldDocSend)===true);
ok('C2 RED: reader ANTIGO já erraria mesmo com writer novo (espelho enviado)', oldCanonicalSent(Object.assign({},docSend,{clientFlowStatus:'enviado'}))===true);

/* ---------- D. GREEN (1.0.233) — CENÁRIO A: criar/enviar SEM confirmar ---------- */
ok('D1 A: criação (Enviar, sem link) NÃO é enviado', R.flowCanonicalSentSignal(docSend)===false);
ok('D2 A: criação (Enviar) = THEMES_READY (pronto_cliente)', derive(R,docSend).phase==='themes_ready');
ok('D3 A: owner permanece social', derive(R,docSend).owner==='social');
const docSendLink = Object.assign({}, docSend, {clientReviewToken:'tok_link'}); // link gerado no modal
ok('D4 A: criação + link gerado continua THEMES_READY (link ≠ envio)', derive(R,docSendLink).phase==='themes_ready' && R.flowCanonicalSentSignal(docSendLink)===false);
ok('D5 A: rascunho (sem pronto, sem link) = planning', derive(R,docDraft).phase==='planning');
ok('D6 A: NÃO entra na espera externa server-side (workflowPhase != waiting)', docSend.workflowPhase!=='themes_waiting_client');

/* ---------- E. GREEN — CENÁRIO B: CONFIRMAR (Worker grava a fase de espera) ---------- */
const docConfirmed = Object.assign({}, docSend, {workflowPhase:'themes_waiting_client', externalWait:true, workflowResponsibleType:'client', clientFlowStatus:'enviado', cronStatus:'enviado_cliente', clientSentAt:123, approvalRounds:{r1:{type:'themes',status:'sent',sentAt:123}}});
ok('E1 B: confirmado (workflowPhase=themes_waiting_client) É enviado', R.flowCanonicalSentSignal(docConfirmed)===true);
ok('E2 B: confirmado = THEMES_SENT', derive(R,docConfirmed).phase==='themes_sent');
ok('E3 B: owner = client', derive(R,docConfirmed).owner==='client');

/* ---------- F. COMPAT LEGADO — registro genuinamente antigo (sem workflowPhase) ---------- */
const docLegacySent = {sector:'cronograma', clientFlowStatus:'enviado'}; // pré-1.0.229: sem workflowPhase
ok('F1 legado enviado (sem workflowPhase) continua enviado', R.flowCanonicalSentSignal(docLegacySent)===true);
ok('F2 legado cronStatus=enviado_cliente continua enviado', R.flowCanonicalSentSignal({sector:'cronograma',cronStatus:'enviado_cliente'})===true);
ok('F3 legado final (cronStatus=ready_for_final, sem wp) → flowSentToClientSignal true', R.flowSentToClientSignal({cronStatus:'ready_for_final_client_review'})===true);

/* ---------- G. flowSentToClientSignal — não é caminho concorrente p/ tarefa nova ---------- */
ok('G1 criação NÃO dispara flowSentToClientSignal', R.flowSentToClientSignal(docSend)===false);
ok('G2 nova tarefa c/ cronStatus=ready_for_final MAS workflowPhase presente (não-espera) NÃO é sent', R.flowSentToClientSignal(Object.assign({},docSend,{cronStatus:'ready_for_final_client_review'}))===false);
ok('G3 final confirmado (workflowPhase=captions_waiting_client) É sent', R.flowSentToClientSignal({workflowPhase:'captions_waiting_client'})===true);

/* ---------- H. PARIDADE COMPORTAMENTAL renderer × main (slaRules.js) ----------
   f344 (golden master) compara COMPORTAMENTO sobre corpus, não texto; aqui confirmamos que o
   espelho main/slaRules.js concorda com o renderer nos casos-chave da H4, via a função EXPORTADA
   deriveCanonicalTaskState (flowCanonicalSentSignal é interna ao módulo — usada por ela). */
const MAIN = require(path.resolve(SLARULES));
function mphase(t){ try{ return MAIN.deriveCanonicalTaskState(t).phase; }catch(_){ return '(err)'; } }
ok('H1 main: criação (Enviar) = themes_ready (== renderer)', mphase(docSend)===derive(R,docSend).phase && mphase(docSend)==='themes_ready');
ok('H2 main: criação + link = themes_ready', mphase(docSendLink)===derive(R,docSendLink).phase && mphase(docSendLink)==='themes_ready');
ok('H3 main: rascunho = planning', mphase(docDraft)===derive(R,docDraft).phase && mphase(docDraft)==='planning');
ok('H4b main: confirmado = themes_sent (== renderer)', mphase(docConfirmed)===derive(R,docConfirmed).phase && mphase(docConfirmed)==='themes_sent');
ok('H5 main: legado enviado (sem wp) = themes_sent', mphase(docLegacySent)===derive(R,docLegacySent).phase && mphase(docLegacySent)==='themes_sent');
ok('H6 main: flowSentToClientSignal exportada concorda (criação=false)', MAIN.flowSentToClientSignal(docSend)===false && MAIN.flowSentToClientSignal({workflowPhase:'captions_waiting_client'})===true);

/* ---------- I. NEUTRALIDADE DE NOTIFICAÇÃO (REGRA MÁXIMA) ---------- */
ok('I1 nenhum novo emissor themes_ready/themes_sent em notifFlowEvent', !/notifFlowEvent[\s\S]{0,400}themes_ready/.test(HTML));

console.log('\n===== F3.5.6A-H4 — SINGLE-SOURCE (CAMINHO REAL) =====');
if(flog.length) console.log(flog.join('\n'));
console.log('f356ah4-single-source-real-path: '+pass+'/'+(pass+fail)+(fail?' — VERMELHO':' — VERDE'));
process.exit(fail?1:0);
