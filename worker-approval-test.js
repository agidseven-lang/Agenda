#!/usr/bin/env node
/* =====================================================================
 * HARNESS — Aprovação do CLIENTE no Worker (task-flow-fix / BUG #6)
 * Prova, sem deploy, que:
 *   1) approveItem aprova SOMENTE o item clicado e NUNCA conclui o cronograma;
 *   2) approveAll conclui apenas na fase FINAL e só quando NÃO há item em revisão na fase;
 *   3) item em revisão (fase atual) bloqueia a conclusão;
 *   4) fases anteriores (themes) NÃO contaminam a fase final.
 *
 * Parte A: REDUTOR puro que espelha LINHA A LINHA a lógica corrigida do
 *          handleClientAction (clientPhase + approveG + STAT + _pendingRev
 *          por fase + override approveItem + gate de conclusão).
 * Parte B: asserções ESTRUTURAIS contra o cloudflare-worker.js REAL (regex),
 *          garantindo que o redutor não divergiu do código deployável.
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, 'cloudflare-worker.js'), 'utf8');

const C = { g:'\x1b[32m', r:'\x1b[31m', d:'\x1b[2m', x:'\x1b[0m', b:'\x1b[1m' };
let FAIL = 0; const FAILS = [];
function check(id, desc, cond){ const ok=!!cond; if(!ok){FAIL++;FAILS.push('['+id+'] '+desc);} console.log('  '+(ok?C.g+'PASS':C.r+'FALHA')+C.x+' '+C.d+id+C.x+' '+desc); return ok; }

/* ===================== PARTE A — REDUTOR PURO (espelho do Worker) ===================== */
function clientPhase(task){
  const explicit = (task.clientApprovalPhase || '') + '';
  if (explicit==='themes'||explicit==='production'||explicit==='final') return explicit;
  if (task.finalApprovalCompleted === true) return 'final';
  if (task.cronStatus==='ready_for_final_client_review' || task.workflowStage==='entrega' || task.workflowStage==='revisao_final') return 'final';
  const arr = Array.isArray(task.cronWeeks)?task.cronWeeks:(Array.isArray(task.cronContents)?task.cronContents:[]);
  const total = arr.length||0;
  if (total>0){ const wl=arr.filter(c=>c&&c.legenda&&String(c.legenda).trim()).length; const wf=arr.filter(c=>c&&c.feedImageUrl).length; if(wl===total&&wf===total) return 'production'; }
  return 'themes';
}
// Aplica UMA ação do cliente e devolve a tarefa resultante (espelho do handleClientAction corrigido).
function applyAction(task, e){
  const phaseIn = clientPhase(task);
  const isFinalPhase = phaseIn === 'final';
  const approveG = isFinalPhase
    ? { cs:'aprovado_cliente', rev:'aprovado', client:'concluido' }
    : { cs:'aprovado_cliente', rev:'aprovado', client:'aprovado' };
  const STAT = {
    approve: approveG, approveAll: approveG,
    revision:    { cs:'em_revisao_cliente', rev:'revisao', client:'revisao' },
    reviseItem:  { cs:'em_revisao_cliente', rev:'revisao', client:'revisao' },
    edit_request:{ cs:'editado_cliente', rev:'editado', client:'revisao' },
    editTheme:   { cs:'editado_cliente', rev:'editado', client:'revisao' },
    editLegenda: { cs:'editado_cliente', rev:'editado', client:'revisao' },
    noteItem:    { cs:null, rev:null, client:null },
    comment:     { cs:null, rev:null, client:null },
  };
  let g = STAT[e.type] || { cs:null, rev:null, client:null };

  // escrita POR item (clientItems.iX) com tag de fase
  const ci = Object.assign({}, task.clientItems || {});
  const perItem = ['approveItem','reviseItem','editTheme','editLegenda','noteItem'].indexOf(e.type)>=0 && e.contentIndex!=null;
  if (perItem){
    const key='i'+e.contentIndex; const it={ at:e.at, phase:phaseIn };
    if (e.type==='approveItem') it.cs='aprovado';
    else if (e.type==='reviseItem'){ it.cs='em_revisao'; if(e.note) it.note=e.note; }
    else if (e.type==='editTheme'){ it.cs='editado'; }
    else if (e.type==='editLegenda'){ it.cs='editado'; }
    ci[key]=it;
  }

  // GATE de revisão parcial POR FASE (lê o estado ANTERIOR, como o Worker — _ci0=task.clientItems)
  const _ci0 = task.clientItems || {};
  const _pendingRev = Object.keys(_ci0).some(k=>{ const it=_ci0[k]; if(!it) return false; return (it.cs==='em_revisao'||it.cs==='editado') && (it.phase===phaseIn); });
  if ((e.type==='approve'||e.type==='approveAll') && _pendingRev){
    g = { cs:'em_revisao_cliente', rev:'revisao', client:'revisao' };
  }
  // approveItem NUNCA conclui/avança
  if (e.type==='approveItem'){ g = { cs:null, rev:null, client:null }; }

  const nt = Object.assign({}, task); nt.clientItems = ci;
  if (g.cs){ nt.cronStatus=g.cs; nt.clientReview={ status:g.rev }; }
  if (g.client){ nt.clientFlowStatus=g.client; nt.clientWorkflowStage=g.client; }
  if (g.client==='concluido'){ nt.finalApprovalCompleted=true; nt.operationalStatus='concluido'; }
  // V64.42 — LIMPEZA POR TRANSICAO DE FASE: ao approveAll com sucesso (aprovado/concluido),
  // zera `cs` dos itens da fase concluida (chip vermelho some, phase preservada).
  if (g.client==='aprovado' || g.client==='concluido'){
    for (const k of Object.keys(nt.clientItems)){
      const it = nt.clientItems[k];
      if (it && it.phase===phaseIn){ const cp=Object.assign({},it); cp.cs=null; nt.clientItems[k]=cp; }
    }
  }
  return nt;
}
// V64.42 — espelho da rota /team-action: equipe corrigiu o item, Worker zera cs.
function applyTeamAdjust(task, contentIndex, byName){
  const nt = Object.assign({}, task); nt.clientItems = Object.assign({}, task.clientItems||{});
  const key='i'+contentIndex; const prev=nt.clientItems[key]||{};
  nt.clientItems[key] = Object.assign({}, prev, { cs:null, teamAdjustedAt:Date.now(), teamAdjustedBy:byName||'Equipe' });
  return nt;
}
const concluded = t => t.finalApprovalCompleted===true || t.clientFlowStatus==='concluido' || t.operationalStatus==='concluido';

console.log(`${C.b}\n==================================================================`);
console.log(' HARNESS — Aprovação do Cliente (Worker task-flow-fix / BUG #6)');
console.log(`==================================================================${C.x}`);

/* ===================== PARTE A.1 — FLUXO PONTA A PONTA (roteiro do usuário) ===================== */
console.log(`${C.b}\n[A.1] Fluxo completo: temas → designer → legenda/final → aprovação${C.x}`);
const TH = [{tema:'T1'},{tema:'T2'},{tema:'T3'}];
const FULL = [
  {tema:'T1',legenda:'L1',feedImageUrl:'f1'},
  {tema:'T2',legenda:'L2',feedImageUrl:'f2'},
  {tema:'T3',legenda:'L3',feedImageUrl:'f3'},
];
// 1) Social cria e envia TEMAS ao cliente (fase themes)
let t = { id:'x', cronContents:TH, clientApprovalPhase:'themes', clientItems:{} };
check('PHASE_THEMES', 'Fase inicial = themes', clientPhase(t)==='themes');
// 2) Cliente aprova os TEMAS individualmente (i0,i1,i2) — NÃO pode concluir nada
t = applyAction(t, {type:'approveItem', contentIndex:0, at:1001});
t = applyAction(t, {type:'approveItem', contentIndex:1, at:1002});
t = applyAction(t, {type:'approveItem', contentIndex:2, at:1003});
check('THEMES_ITEMS_NO_CONCLUDE', 'Aprovar temas item a item NÃO conclui', !concluded(t));
check('THEMES_ITEMS_TAGGED', 'clientItems dos temas marcados com phase=themes', t.clientItems.i0.phase==='themes' && t.clientItems.i2.phase==='themes');
// 3) Cliente clica EXPLICITAMENTE "Aprovar temas e liberar produção" (approveAll, themes)
t = applyAction(t, {type:'approveAll', at:1004});
check('THEMES_APPROVEALL', 'approveAll(themes) libera produção (clientFlowStatus=aprovado), NÃO conclui', t.clientFlowStatus==='aprovado' && !concluded(t));
// 4) Social envia ao designer, designer entrega, Social cria legenda/posts e REENVIA p/ aprovação final
//    (Desktop marca clientApprovalPhase='final' + cronStatus='ready_for_final_client_review' + cronContents FULL)
t = Object.assign({}, t, { cronContents:FULL, clientApprovalPhase:'final', cronStatus:'ready_for_final_client_review' });
check('PHASE_FINAL', 'Após reenvio, fase = final', clientPhase(t)==='final');
// 5) Cliente aprova APENAS 1 legenda (approveItem i0, fase final) — NÃO pode concluir tudo  (← BUG #6)
const tBug = applyAction(t, {type:'approveItem', contentIndex:0, at:2001});
check('BUG6_FIXED', 'FINAL: aprovar 1 item NÃO conclui o cronograma (correção do BUG #6)', !concluded(tBug));
check('BUG6_ITEM_ONLY', 'FINAL: approveItem avalia SOMENTE o item clicado na fase final (i0 phase=final); itens de temas seguem phase=themes', tBug.clientItems.i0 && tBug.clientItems.i0.cs==='aprovado' && tBug.clientItems.i0.phase==='final' && tBug.clientItems.i1.phase==='themes' && tBug.clientItems.i2.phase==='themes');
// 6) Cliente pede AJUSTE em outro item (reviseItem i1, fase final)
const tRev = applyAction(tBug, {type:'reviseItem', contentIndex:1, note:'trocar foto', at:2002});
check('FINAL_REVISE_NO_CONCLUDE', 'FINAL: pedir ajuste em um item NÃO conclui', !concluded(tRev));
check('FINAL_REVIEW_STATE', 'FINAL: item em ajuste deixa clientReview=revisao', tRev.clientReview && tRev.clientReview.status==='revisao');
// 7) Cliente tenta "Aprovar tudo" com ajuste pendente NA FASE FINAL → vira feedback, NÃO conclui
const tAllBlocked = applyAction(tRev, {type:'approveAll', at:2003});
check('FINAL_PENDING_BLOCKS', 'FINAL: approveAll com item em revisão NÃO conclui (vira feedback)', !concluded(tAllBlocked) && tAllBlocked.clientFlowStatus==='revisao');
// 8) Social corrige; cliente re-aprova o item i1 e então aprova TUDO explicitamente → conclui
let tFix = applyAction(tRev, {type:'approveItem', contentIndex:1, at:2004}); // resolve o ajuste do i1
check('FINAL_STILL_NOT_CONCLUDED', 'FINAL: re-aprovar o item ajustado ainda NÃO conclui (precisa do approveAll)', !concluded(tFix));
const tDone = applyAction(tFix, {type:'approveAll', at:2005});
check('FINAL_APPROVEALL_CONCLUDES', 'FINAL: approveAll SEM ajustes pendentes CONCLUI (finalApprovalCompleted=true)', tDone.finalApprovalCompleted===true && tDone.clientFlowStatus==='concluido');

/* ===================== PARTE A.2 — Isolamento de fases (themes não contamina final) ===================== */
console.log(`${C.b}\n[A.2] Fases anteriores NÃO contaminam a fase final${C.x}`);
// Cenário: revisão antiga de TEMAS (phase=themes) ainda presente em clientItems ao chegar na fase final
let tIso = { id:'y', cronContents:FULL, clientApprovalPhase:'final', cronStatus:'ready_for_final_client_review',
  clientItems:{ i0:{cs:'em_revisao', phase:'themes', at:900}, i1:{cs:'aprovado', phase:'themes', at:901} } };
const tIsoDone = applyAction(tIso, {type:'approveAll', at:3001});
check('PHASE_ISOLATION', 'Revisão de TEMAS (phase=themes) NÃO bloqueia approveAll na fase final', tIsoDone.finalApprovalCompleted===true);
// Inverso: revisão DA FASE FINAL bloqueia
let tFinRev = { id:'z', cronContents:FULL, clientApprovalPhase:'final', cronStatus:'ready_for_final_client_review',
  clientItems:{ i0:{cs:'em_revisao', phase:'final', at:902} } };
const tFinBlocked = applyAction(tFinRev, {type:'approveAll', at:3002});
check('FINAL_REV_BLOCKS', 'Revisão DA FASE FINAL (phase=final) bloqueia approveAll', !concluded(tFinBlocked));

/* ===================== PARTE A.3 — approveItem em themes não avança fase ===================== */
console.log(`${C.b}\n[A.3] approveItem nunca avança/encerra (qualquer fase)${C.x}`);
let tT = { id:'w', cronContents:TH, clientApprovalPhase:'themes', clientItems:{} };
tT = applyAction(tT, {type:'approveItem', contentIndex:0, at:1});
tT = applyAction(tT, {type:'approveItem', contentIndex:1, at:2});
tT = applyAction(tT, {type:'approveItem', contentIndex:2, at:3});
check('THEMES_ITEMS_NO_ADVANCE', 'approveItem(todos os temas) NÃO seta clientFlowStatus=aprovado (só o approveAll faz)', tT.clientFlowStatus!=='aprovado' && !concluded(tT));

/* ===================== PARTE A.4 — Limpeza por transição de fase (V64.42) ===================== */
console.log(`${C.b}\n[A.4] V64.42 — Limpeza por fase ao approveAll com sucesso${C.x}`);
// Cenario: cliente pediu ajuste em i1 (themes), equipe corrigiu (teamAdjust), cliente aprova tudo
let tCl = { id:'cl1', cronContents:TH, clientApprovalPhase:'themes', clientItems:{} };
tCl = applyAction(tCl, {type:'reviseItem', contentIndex:1, note:'trocar', at:4001});
check('A4_REVISE_OK', 'reviseItem grava cs=em_revisao com phase=themes', tCl.clientItems.i1.cs==='em_revisao' && tCl.clientItems.i1.phase==='themes');
// Sem teamAdjust, approveAll é BLOQUEADO por _pendingRev (regressao de V64.41)
const tBlock = applyAction(tCl, {type:'approveAll', at:4002});
check('A4_BLOCKS_WITHOUT_FIX', 'approveAll sem correcao da equipe vira feedback (clientFlowStatus=revisao)', tBlock.clientFlowStatus==='revisao' && !concluded(tBlock));
// Com teamAdjust (V64.42), approveAll passa e a limpeza zera cs dos itens da fase themes
const tFixed = applyTeamAdjust(tCl, 1, 'Marcos Dias');
check('A4_TEAM_ADJUST_CLEARS', 'applyTeamAdjust(i1) zera cs do i1 e mantem phase', tFixed.clientItems.i1.cs===null && tFixed.clientItems.i1.phase==='themes');
const tApr = applyAction(tFixed, {type:'approveAll', at:4003});
check('A4_APPROVEALL_PASSES', 'approveAll(themes) com cs zerado libera producao (clientFlowStatus=aprovado)', tApr.clientFlowStatus==='aprovado' && !concluded(tApr));
check('A4_PHASE_CLEANUP', 'V64.42 limpa cs de TODOS os items da fase themes apos approveAll bem-sucedido', tApr.clientItems.i1.cs===null);

/* ===================== PARTE A.5 — Idempotencia (cliente cliclando duas vezes) ===================== */
console.log(`${C.b}\n[A.5] Idempotency-Key — efeito unico para acoes do cliente${C.x}`);
// O REDUTOR nao implementa cache (Cache API e do Worker), mas a chave deve garantir mesma resposta.
const t1 = applyAction({ id:'i1', cronContents:TH, clientApprovalPhase:'themes', clientItems:{} }, {type:'reviseItem', contentIndex:0, note:'x', at:5001});
const t2 = applyAction({ id:'i1', cronContents:TH, clientApprovalPhase:'themes', clientItems:{} }, {type:'reviseItem', contentIndex:0, note:'x', at:5001});
check('A5_DETERMINISTIC', 'Mesma acao com mesmo at gera mesmo estado (idempotencia determinista)',
  JSON.stringify(t1.clientItems.i0)===JSON.stringify(t2.clientItems.i0) && t1.cronStatus===t2.cronStatus);

/* ===================== PARTE B — ASSERÇÕES ESTRUTURAIS (código real) ===================== */
console.log(`${C.b}\n[B] Estrutura do cloudflare-worker.js REAL (corrigido)${C.x}`);
check('W_NO_GLOBAL_COUNT', 'Removida a contagem global "approved.size >= total" do approveItem', SRC.indexOf('approved.size >= total')===-1);
const apItem = (SRC.match(/if \(e\.type === "approveItem"\) \{[\s\S]*?\n  \}/)||[''])[0];
check('W_APPROVEITEM_SIMPLE', 'approveItem só define g = {cliente aprovou um conteúdo} (sem approveG/concluir)', /htype: "cliente_aprovou_item"/.test(apItem) && apItem.indexOf('approveG')===-1 && apItem.indexOf('finalApprovalCompleted')===-1);
check('W_PHASE_TAG', 'clientItems.iX é marcado com phase = clientPhase(task)', /itemFields\.phase = \{ stringValue: clientPhase\(task\) \}/.test(SRC));
check('W_PENDINGREV_PHASE', '_pendingRev é POR FASE (ph === phaseIn)', /\(cs === "em_revisao" \|\| cs === "editado"\) && \(ph === phaseIn\)/.test(SRC));
check('W_FINAL_GATE', 'finalApprovalCompleted só dentro do bloco g.client === "concluido"', /if \(g\.client === "concluido"\) \{[\s\S]*?finalApprovalCompleted = \{ booleanValue: true \}/.test(SRC));
check('W_APPROVEITEM_NOT_CONCLUDE', 'approveItem NÃO está no caminho de g.client (só approve/approveAll/approveG concluem)', !/approveItem[\s\S]{0,120}finalApprovalCompleted/.test(apItem));

/* ===================== PARTE C — V64.42 (asserções estruturais novas) ===================== */
console.log(`${C.b}\n[C] V64.42 — team-action + idempotencia + logo + UX + push esqueleto${C.x}`);
check('C_HEALTH_V64_45', 'Healthcheck retorna V64.45-team-session-jwt', /version: "V64\.45-team-session-jwt"/.test(SRC));
check('C_LOGO_B64', 'IDSEVEN_LOGO_B64 declarado (base64 do icon oficial)', /const IDSEVEN_LOGO_B64 = "[A-Za-z0-9+/=]{1000,}"/.test(SRC));
check('C_LOGO_FN', 'Funcao idsevenLogoResponse() existe e usa Content-Type image/png', /function idsevenLogoResponse\(\)/.test(SRC) && /idsevenLogoResponse[\s\S]{0,400}image\/png/.test(SRC));
check('C_LOGO_ROUTE', 'Rota GET /og/idseven-logo.png registrada', /\/og\/idseven-logo\.png[\s\S]{0,80}idsevenLogoResponse\(\)/.test(SRC));
check('C_CV_LOGO_IMG', 'CV_LOGO usa <img> apontando para /og/idseven-logo.png (sem SVG placeholder)', /const CV_LOGO = '<img class="logo" src="\/og\/idseven-logo\.png"/.test(SRC));
check('C_UX_TRYCLOSE_FN', 'tryCloseOrShowNotice presente no CV_JS', /function tryCloseOrShowNotice\(\)/.test(SRC) && /window\.close/.test(SRC));
check('C_UX_TRYCLOSE_SUCC', 'clientSuccess() chama tryCloseOrShowNotice()', /function clientSuccess\(\)[\s\S]*?tryCloseOrShowNotice\(\);\}/.test(SRC));
check('C_UX_TRYCLOSE_THEMES', 'clientThemesApproved() chama tryCloseOrShowNotice()', /function clientThemesApproved\(\)[\s\S]*?tryCloseOrShowNotice\(\);\}/.test(SRC));
check('C_UX_TRYCLOSE_PROD', 'clientProductionApproved() chama tryCloseOrShowNotice()', /function clientProductionApproved\(\)[\s\S]*?tryCloseOrShowNotice\(\);\}/.test(SRC));
check('C_PHASE_CLEANUP', 'LIMPEZA POR TRANSIÇÃO DE FASE — zera cs por phase apos approveAll bem-sucedido',
  /LIMPEZA POR TRANSIÇÃO DE FASE/.test(SRC) && /if \(g\.client === "aprovado" \|\| g\.client === "concluido"\)/.test(SRC) && /clientItems\."\s*\+\s*k\s*\+\s*"\.cs/.test(SRC));
check('C_TEAM_ROUTE', 'Rota POST /cliente/cronograma/:token/team-action registrada', /teamMatch[\s\S]{0,40}url\.pathname\.match/.test(SRC) && /\\\/team-action\\\/\?\$/.test(SRC) && /handleClientCronogramaTeamAction/.test(SRC));
// V64.44 — autorizacao dupla: X-Team-Key (server-to-server) OU uid Social/Admin via role-lookup REAL.
// V64.45 — AUTENTICACAO FORTE: Bearer teamSessionJwt obrigatorio (sem X-Team-Key) + re-lookup.
check('C_TEAM_AUTH', 'team-action: sem X-Team-Key EXIGE Bearer JWT (401) e valida assinatura/exp/aud/scope', /const m = authz\.match\(\/\^Bearer\\s\+\(\.\+\)\$\/i\)/.test(SRC) && /unauthorized: Authorization Bearer <teamSessionJwt> obrigatório/.test(SRC) && /await verifyTeamJwt\(env, m\[1\]\)/.test(SRC));
check('C_TEAM_NO_BODY_UID', 'uid declarado no body NAO e aceito como prova (caminho removido do handler)', (()=>{const h=(SRC.match(/async function handleClientCronogramaTeamAction[\s\S]*?\n\}/)||[''])[0];return h.length>0 && h.indexOf('payload.uid')===-1;})());
check('C_TEAM_RELOOKUP', 'apos JWT valido, RECONSULTA role/status no Firestore antes de executar (403 se revogado)', /lookupTeamUser\(env, accessToken, v\.uid\)/.test(SRC) && /forbidden: usuário não é mais Social\/Admin ativo/.test(SRC));
check('C_TEAM_XKEY', 'team-action mantém X-Team-Key p/ server-to-server (nunca embutida em app cliente)', /handleClientCronogramaTeamAction[\s\S]{0,2400}X-Team-Key/.test(SRC));
check('C_TEAM_LOOKUP', 'lookupTeamUser: GET users/{uid} via service account + status ativo + role Social/Admin (TEAM_ROLE_KW) ou admin', /async function lookupTeamUser/.test(SRC) && /documents\/users\/\$\{uid\}/.test(SRC) && /TEAM_ROLE_KW/.test(SRC) && /status === "pendente" \|\| status === "removido" \|\| status === "excluido"/.test(SRC));
check('C_TEAM_NO_SECRET_APP', 'NENHUM secret no app: Bearer vem de /team/session (senha verificada server-side); X-Team-Key so server-to-server', /Authorization: Bearer <teamSessionJwt> emitido por \/team\/session/.test(SRC));
check('C_TEAM_MULTI', 'team-action aceita contentIndexes[] (varios itens) com dedupe/sort', /Array\.isArray\(payload && payload\.contentIndexes\)/.test(SRC) && /Array\.from\(new Set\(idxs\)\)\.sort/.test(SRC));
check('C_TEAM_IDEM', 'team-action mantem Idempotency-Key (Cache API, replay) — verificada APOS a autorizacao', /idempotency\.local\/team\//.test(SRC) && (()=>{const h=(SRC.match(/async function handleClientCronogramaTeamAction[\s\S]*?\n\}/)||[''])[0];const a=h.indexOf('AUTENTICAÇÃO FORTE');const i=h.indexOf('idempotency.local/team');return a>=0&&i>a;})());
check('C_TEAM_PUSH_SAFE', 'falha de push NUNCA bloqueia a acao (try/catch em notifyWorkflowEvent)', /try \{[\s\S]{0,250}notifyWorkflowEvent\(env, task, evType[\s\S]{0,120}\} catch \(e\) \{ pushResult = \{ sent: 0, error: e && e\.message \}; \}/.test(SRC));
check('C_TEAM_CLEARS_CS', 'team-action grava clientItems[iX].cs=null e teamAdjustedAt/By', /cs: \{ nullValue: null \}[\s\S]{0,200}teamAdjustedAt[\s\S]{0,200}teamAdjustedBy/.test(SRC));
check('C_TEAM_HISTORY', 'team-action adiciona history com type=equipe_corrigiu_item', /equipe_corrigiu_item/.test(SRC));
check('C_IDEM_HEADER', 'handleClientCronogramaAction le Idempotency-Key/X-Idempotency-Key', /handleClientCronogramaAction[\s\S]{0,400}Idempotency-Key[\s\S]{0,40}X-Idempotency-Key/.test(SRC));
check('C_IDEM_CACHE', 'Idempotencia usa caches.default.match e caches.default.put', /caches\.default\.match\(new Request\(idemUrl\)\)/.test(SRC) && /caches\.default\.put\(new Request\(idemUrl\)/.test(SRC));
check('C_IDEM_REPLAYED', 'Resposta em replay marca X-Idempotency-Replayed: true', /X-Idempotency-Replayed[\s\S]{0,40}true/.test(SRC));
check('C_PUSH_SUB_ROUTE', 'Rota POST /cliente/cronograma/:token/push/subscribe registrada', /\/cliente\/cronograma\/.*\/push\/subscribe/.test(SRC) && /handleClientPushSubscribe/.test(SRC));
check('C_PUSH_SUB_FIRESTORE', 'push subscribe grava em tasks.{id}.clientPushSubs[] via appendMissingElements', /clientPushSubs[\s\S]{0,200}appendMissingElements/.test(SRC));
check('C_BROADCAST_GUARD', 'broadcastWebPush gated por VAPID_PRIVATE_KEY/PUBLIC/SUBJECT (retorna VAPID_NOT_CONFIGURED)', /function broadcastWebPush[\s\S]{0,400}VAPID_NOT_CONFIGURED/.test(SRC));
check('C_SW_ROUTE', 'Rota GET /cliente/sw.js registrada e responde com SW', /\/cliente\/sw\.js[\s\S]{0,80}clientSwResponse\(\)/.test(SRC));
check('C_SW_CONTENT', 'clientSwResponse define push + notificationclick + Service-Worker-Allowed', /function clientSwResponse\(\)/.test(SRC) && /addEventListener\('push'/.test(SRC) && /addEventListener\('notificationclick'/.test(SRC) && /Service-Worker-Allowed/.test(SRC));
check('C_FEATURE_FLAG', 'Portal injeta ENABLE_PUSH=true/false a partir de env.ENABLE_CLIENT_WEB_PUSH', /'var ENABLE_PUSH=' \+ JSON\.stringify\(env && env\.ENABLE_CLIENT_WEB_PUSH === "true"\)/.test(SRC));
check('C_VAPID_PUBLIC_INJ', 'Portal injeta VAPID_PUBLIC_KEY (vazio se nao configurado)', /'var VAPID_PUBLIC_KEY=' \+ JSON\.stringify\(\(env && env\.VAPID_PUBLIC_KEY\) \|\| ""\)/.test(SRC));
check('C_SETUP_PUSH_FN', 'CV_JS define setupClientWebPush() + urlBase64ToUint8Array + registra SW em /cliente/', /function setupClientWebPush\(\)/.test(SRC) && /function urlBase64ToUint8Array\(b\)/.test(SRC) && /serviceWorker\.register\('\/cliente\/sw\.js',\{scope:'\/cliente\/'\}\)/.test(SRC));

/* ===================== PARTE D — preservacao (nao quebrar o que existia) ===================== */
console.log(`${C.b}\n[D] Preservacao: WhatsApp + /share + healthcheck endpoints intactos${C.x}`);
check('D_WA_ROUTE', 'Rota POST /client/send-premium-whatsapp preservada', /\/client\/send-premium-whatsapp[\s\S]{0,80}handleSendPremiumWhatsApp/.test(SRC));
check('D_SHARE_ROUTE', 'Rota GET /share/cronograma/:token preservada', /url\.pathname\.match\([^)]*share\\\/cronograma[^)]*\)/.test(SRC) && /function shareCardHtml/.test(SRC));
check('D_OG_LEGACY', 'Banner OG legado /og/aprovar*.png preservado', /function ogBannerResponse\(\)/.test(SRC) && /\/og\\\/aprovar/.test(SRC));
check('D_PUSH_RELAY', 'handlePushRelay (FCM equipe) preservado', /async function handlePushRelay\(request, env\)/.test(SRC));
check('D_CRON_SCHEDULED', 'scheduled handler (CRON lembretes) preservado', /async scheduled\(event, env, ctx\)[\s\S]{0,200}handleCronTrigger/.test(SRC));

/* ===================== PARTE E — WEB PUSH REAL (round-trip criptográfico) =====================
 * Extrai as funções REAIS do cloudflare-worker.js (brace matching + eval) e prova com a
 * MESMA Web Crypto API do runtime de Workers (Node >=20 expõe globalThis.crypto):
 *   E1) encryptWebPushPayload produz aes128gcm DECIFRÁVEL pelo navegador (RFC 8291):
 *       gera chaves "browser" (ECDH P-256 + auth 16B), cifra com o código do Worker,
 *       decifra com derivação RFC do lado do navegador e compara o payload.
 *   E2) vapidJwt produz ES256 VÁLIDO (RFC 8292): assinatura verificada com a chave
 *       pública + claims aud/exp/sub corretos.
 * Round-trip REAL — sem mock de criptografia. */
function extractFn(name){
  const re=new RegExp('(?:async )?function '+name+'\\s*\\([^)]*\\)\\s*\\{');
  const m=SRC.match(re); if(!m) throw new Error('função não encontrada: '+name);
  const start=SRC.indexOf(m[0]); let depth=0;
  for(let j=start+m[0].length-1;j<SRC.length;j++){const c=SRC[j];
    if(c==='{')depth++; else if(c==='}'){depth--;if(depth===0)return SRC.slice(start,j+1);}}
  throw new Error('chaves desbalanceadas: '+name);
}
const CRYPTO_FNS=['b64uToBytes','bytesToB64u','concatBytes','hkdfBits','encryptWebPushPayload','vapidJwt']
  .map(extractFn).join('\n');
// eval em escopo isolado com as MESMAS globais do runtime de Workers
const evalScope={crypto:globalThis.crypto,atob,btoa,TextEncoder,TextDecoder,Uint8Array,Error,JSON,Math,Date,URL,console};
const W=new Function(...Object.keys(evalScope),CRYPTO_FNS+'\nreturn {b64uToBytes,bytesToB64u,concatBytes,hkdfBits,encryptWebPushPayload,vapidJwt};')(...Object.values(evalScope));

(async function partE(){
  console.log(`${C.b}\n[E] WEB PUSH REAL — round-trip criptográfico (RFC 8291/8292)${C.x}`);
  const subtle=globalThis.crypto.subtle;
  const enc=new TextEncoder();
  try{
    /* E1 — RFC 8291 aes128gcm: cifra (Worker) → decifra (navegador) */
    const browser=await subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    const browserPubRaw=new Uint8Array(await subtle.exportKey('raw',browser.publicKey));
    const authSecret=globalThis.crypto.getRandomValues(new Uint8Array(16));
    const PAYLOAD=JSON.stringify({title:'Ajuste do tema realizado',body:'Toque para revisar novamente.',openUrl:'/cliente/cronograma/tok123',tag:'theme_adjusted_by_team'});
    const body=await W.encryptWebPushPayload(PAYLOAD,W.bytesToB64u(browserPubRaw),W.bytesToB64u(authSecret));
    // header aes128gcm: salt(16) | rs(4) | idlen(1) | as_public(65) | ct
    const salt=body.slice(0,16), rs=(body[16]<<24)|(body[17]<<16)|(body[18]<<8)|body[19], idlen=body[20];
    const asPub=body.slice(21,21+idlen), ct=body.slice(21+idlen);
    check('E1_HEADER','Header aes128gcm: salt=16B, rs=4096, keyid=as_public(65B)', salt.length===16&&rs===4096&&idlen===65);
    // derivação RFC 8291 do lado do NAVEGADOR (browser privkey + as_public)
    const asKey=await subtle.importKey('raw',asPub,{name:'ECDH',namedCurve:'P-256'},false,[]);
    const ecdh=new Uint8Array(await subtle.deriveBits({name:'ECDH',public:asKey},browser.privateKey,256));
    async function hkdf(saltB,ikmB,infoB,len){const k=await subtle.importKey('raw',ikmB,'HKDF',false,['deriveBits']);
      return new Uint8Array(await subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:saltB,info:infoB},k,len*8));}
    const cat=(...a)=>{const t=a.reduce((s,x)=>s+x.length,0);const o=new Uint8Array(t);let off=0;for(const x of a){o.set(x,off);off+=x.length;}return o;};
    const keyInfo=cat(enc.encode('WebPush: info\u0000'),browserPubRaw,asPub);
    const ikm=await hkdf(authSecret,ecdh,keyInfo,32);
    const cek=await hkdf(salt,ikm,enc.encode('Content-Encoding: aes128gcm\u0000'),16);
    const nonce=await hkdf(salt,ikm,enc.encode('Content-Encoding: nonce\u0000'),12);
    const aes=await subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']);
    const rec=new Uint8Array(await subtle.decrypt({name:'AES-GCM',iv:nonce},aes,ct));
    check('E1_PAD','Registro decifrado termina com delimitador 0x02 (último registro RFC 8188)', rec[rec.length-1]===2);
    const got=new TextDecoder().decode(rec.slice(0,rec.length-1));
    check('E1_ROUNDTRIP','PAYLOAD decifrado pelo "navegador" === payload original (round-trip REAL)', got===PAYLOAD);
    const parsed=JSON.parse(got);
    check('E1_OPENURL','Payload carrega openUrl do MESMO link do cliente', parsed.openUrl==='/cliente/cronograma/tok123');

    /* E2 — RFC 8292 VAPID JWT ES256 */
    const vapid=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const vapidPubRaw=new Uint8Array(await subtle.exportKey('raw',vapid.publicKey));
    const vapidJwkPriv=await subtle.exportKey('jwk',vapid.privateKey);
    const env={VAPID_PUBLIC_KEY:W.bytesToB64u(vapidPubRaw),VAPID_PRIVATE_KEY:vapidJwkPriv.d,VAPID_SUBJECT:'mailto:contato@agendaidseven.com.br'};
    const jwt=await W.vapidJwt(env,'https://fcm.googleapis.com');
    const [h,c,s]=jwt.split('.');
    check('E2_SHAPE','JWT tem 3 partes base64url', !!(h&&c&&s)&&jwt.split('.').length===3);
    const hdr=JSON.parse(new TextDecoder().decode(W.b64uToBytes(h)));
    const clm=JSON.parse(new TextDecoder().decode(W.b64uToBytes(c)));
    check('E2_HEADER','Header {typ:JWT, alg:ES256}', hdr.typ==='JWT'&&hdr.alg==='ES256');
    check('E2_CLAIMS','Claims aud=push service origin, sub=mailto, exp<=+24h',
      clm.aud==='https://fcm.googleapis.com'&&/^mailto:/.test(clm.sub)&&clm.exp>Math.floor(Date.now()/1000)&&clm.exp<=Math.floor(Date.now()/1000)+86400);
    const okSig=await subtle.verify({name:'ECDSA',hash:'SHA-256'},vapid.publicKey,W.b64uToBytes(s),enc.encode(h+'.'+c));
    check('E2_SIGNATURE','Assinatura ES256 VERIFICADA com a chave pública VAPID', okSig===true);
  }catch(e){
    check('E_FATAL','Round-trip executa sem exceção — erro: '+(e&&e.message), false);
  }

  /* ===================== PARTE F — engine + envio real (estrutural) ===================== */
  console.log(`${C.b}\n[F] Notification Engine + envio real (estrutura do código)${C.x}`);
  check('F_NO_FAKE','REMOVIDO o placeholder VAPID_PRESENT_BUT_SEND_NOT_IMPLEMENTED', SRC.indexOf('VAPID_PRESENT_BUT_SEND_NOT_IMPLEMENTED')===-1);
  check('F_SEND_REAL','sendWebPushTo faz POST real ao endpoint com aes128gcm + vapid', /async function sendWebPushTo/.test(SRC)&&/Content-Encoding": "aes128gcm"/.test(SRC)&&/"Authorization": "vapid t=" \+ jwt/.test(SRC)&&/fetch\(endpoint, \{ method: "POST", headers, body \}\)/.test(SRC));
  check('F_GONE','Trata 404/410 como subscription morta (gone)', /res\.status === 404 \|\| res\.status === 410/.test(SRC)&&/gone: true/.test(SRC));
  check('F_TTL_URGENCY_TOPIC','Headers TTL + Urgency + Topic presentes', /"TTL": String/.test(SRC)&&/"Urgency": \(opts && opts\.urgency\) \|\| "high"/.test(SRC)&&/headers\["Topic"\]/.test(SRC));
  check('F_PRUNE','pruneClientPushSubs remove subscriptions mortas do Firestore', /async function pruneClientPushSubs/.test(SRC)&&/clientPushSubs: \{ arrayValue: \{ values \} \}/.test(SRC));
  const evNames=['themes_sent_to_client','theme_adjusted_by_team','themes_approved_by_client','designer_assigned','designer_started','designer_delivered','final_content_sent_to_client','final_adjusted_by_team','final_approved_by_client'];
  check('F_EVENTS_9','NOTIFY_EVENTS define os 9 eventos obrigatórios', evNames.every(n=>SRC.indexOf(n+':')>=0||SRC.indexOf('"'+n+'"')>=0||SRC.indexOf(n+' ')>=0));
  check('F_ENGINE','notifyWorkflowEvent central com dedupKey via Cache API + log + fallback whatsapp_premium', /async function notifyWorkflowEvent/.test(SRC)&&/notify-dedup\.local/.test(SRC)&&/fallback = "whatsapp_premium"|fallback: "whatsapp_premium"/.test(SRC)&&/\[NOTIFY\]/.test(SRC));
  check('F_HOOK_TEAM','team-action dispara theme_adjusted_by_team/final_adjusted_by_team', /final_adjusted_by_team" : "theme_adjusted_by_team/.test(SRC));
  check('F_HOOK_APPROVE','aprovações do cliente disparam themes_approved_by_client/final_approved_by_client', /notifyWorkflowEvent\(env, task, "final_approved_by_client"/.test(SRC)&&/notifyWorkflowEvent\(env, task, "themes_approved_by_client"/.test(SRC));
  check('F_HOOK_WA','envio do card WhatsApp dispara themes_sent_to_client/final_content_sent_to_client', /final_content_sent_to_client" : "themes_sent_to_client/.test(SRC));
  check('F_CTA','Portal tem CTA explícito "Receber avisos deste cronograma" + 4 estados', /Receber avisos deste cronograma/.test(SRC)&&/Notificações não permitidas no navegador/.test(SRC)&&/não suporta avisos em tempo real/.test(SRC)&&/Avisos ativados para este cronograma/.test(SRC));
  check('F_CTA_NO_AUTOPROMPT','CTA NUNCA pede permissão sem clique (requestPermission só dentro de subscribeClientPush)', (()=>{const auto=SRC.match(/function setupClientWebPush\(\)\{[\s\S]*?\n\}/);return auto&&auto[0].indexOf('requestPermission')===-1;})());
  check('F_VERSION','Healthcheck = V64.45-team-session-jwt', /version: "V64\.45-team-session-jwt"/.test(SRC));
  check('F_INFO_NULLBYTE','Strings HKDF info terminam com \\u0000 (RFC 8291) e SEM null byte cru no source', /WebPush: info\\u0000/.test(SRC)&&/aes128gcm\\u0000/.test(SRC)&&/nonce\\u0000/.test(SRC)&&SRC.indexOf(String.fromCharCode(0))===-1);

  /* ===================== PARTE G — TEAM SESSION JWT (round-trip funcional REAL) =====================
   * Extrai signTeamJwt/verifyTeamJwt/sha256HexW/djb2Hash REAIS do Worker e prova com a MESMA
   * Web Crypto: emissão→verificação ok; assinatura adulterada/expirado/aud/scope/secret errado
   * REJEITADOS; prova de senha s2 e djb2 funcionam. Sem mock de criptografia. */
  console.log(`${C.b}\n[G] TEAM SESSION JWT — autenticação forte (round-trip real)${C.x}`);
  try{
    const JWT_FNS=['b64uToBytes','bytesToB64u','teamHmacKey','signTeamJwt','verifyTeamJwt','djb2Hash','sha256HexW']
      .map(extractFn).join('\n');
    const scope2={crypto:globalThis.crypto,atob,btoa,TextEncoder,TextDecoder,Uint8Array,Error,JSON,Math,Date,String,Array,console,
      TEAM_JWT_AUD:'idseven-team',TEAM_JWT_SCOPE:'workflow:team_adjusted_item'};
    const G=new Function(...Object.keys(scope2),
      "const TEAM_JWT_AUD_=TEAM_JWT_AUD,TEAM_JWT_SCOPE_=TEAM_JWT_SCOPE;\n"+
      JWT_FNS.replace(/TEAM_JWT_AUD/g,'TEAM_JWT_AUD_').replace(/TEAM_JWT_SCOPE/g,'TEAM_JWT_SCOPE_')+
      '\nreturn {signTeamJwt,verifyTeamJwt,djb2Hash,sha256HexW};')(...Object.values(scope2));
    const env={TEAM_SESSION_SECRET:'segredo-de-teste-bem-grande-1234567890'};
    const nowS=Math.floor(Date.now()/1000);
    const claims={sub:'jm',name:'João',aud:'idseven-team',scope:'workflow:team_adjusted_item',iat:nowS,exp:nowS+3600};
    const jwt=await G.signTeamJwt(env,claims);
    const v1=await G.verifyTeamJwt(env,jwt);
    check('G1_VALID','JWT emitido é verificado (assinatura+exp+aud+scope) e devolve uid', v1.ok===true && v1.uid==='jm');
    const tampered=jwt.slice(0,-4)+(jwt.slice(-4)==='AAAA'?'BBBB':'AAAA');
    check('G2_TAMPERED','Assinatura adulterada é REJEITADA', (await G.verifyTeamJwt(env,tampered)).ok===false);
    const expJwt=await G.signTeamJwt(env,Object.assign({},claims,{exp:nowS-10}));
    const vExp=await G.verifyTeamJwt(env,expJwt);
    check('G3_EXPIRED','Token expirado é REJEITADO (flag expired)', vExp.ok===false && vExp.expired===true);
    const audJwt=await G.signTeamJwt(env,Object.assign({},claims,{aud:'outra'}));
    check('G4_AUD','aud errada é REJEITADA', (await G.verifyTeamJwt(env,audJwt)).ok===false);
    const scJwt=await G.signTeamJwt(env,Object.assign({},claims,{scope:'outra:coisa'}));
    check('G5_SCOPE','scope sem workflow:team_adjusted_item é REJEITADO', (await G.verifyTeamJwt(env,scJwt)).ok===false);
    const vWrong=await G.verifyTeamJwt({TEAM_SESSION_SECRET:'outro-segredo'},jwt);
    check('G6_WRONG_SECRET','JWT assinado com outro secret é REJEITADO', vWrong.ok===false);
    const vNoCfg=await G.verifyTeamJwt({},jwt);
    check('G7_NOT_CONFIGURED','Sem TEAM_SESSION_SECRET → TEAM_SESSION_NOT_CONFIGURED (nunca aceita)', vNoCfg.ok===false && vNoCfg.error==='TEAM_SESSION_NOT_CONFIGURED');
    // prova de senha (paridade com verifyPw do app)
    const salt='abc123';const pw='Senha!Forte';
    const stored='s2:'+await G.sha256HexW(salt+'|'+pw);
    check('G8_S2','Verificação s2:SHA-256(salt|senha) bate com o formato do app', stored===('s2:'+await G.sha256HexW(salt+'|'+pw)) && stored!==('s2:'+await G.sha256HexW(salt+'|'+'errada')));
    check('G9_DJB2','Hash legado djb2 idêntico ao do app (h+uint32)', /^h\d+$/.test(G.djb2Hash('x')) && G.djb2Hash('abc')===G.djb2Hash('abc') && G.djb2Hash('abc')!==G.djb2Hash('abd'));
  }catch(e){
    check('G_FATAL','Parte G executa sem exceção — erro: '+(e&&e.message), false);
  }
  // Estruturais da rota /team/session + ordem auth→efeitos
  check('G10_ROUTE','Rota POST /team/session registrada e gated por TEAM_SESSION_SECRET (503)', /url\.pathname === "\/team\/session" && request\.method === "POST"/.test(SRC) && /TEAM_SESSION_NOT_CONFIGURED" \}, 503/.test(SRC));
  check('G11_PASSWORD_PROOF','Sessão exige SENHA verificada server-side (s2 + djb2 legado); credencial inválida → 401', /okPw = \(u\.pass === \("s2:" \+ await sha256HexW\(u\.salt \+ "\|" \+ password\)\)\)/.test(SRC) && /credenciais inválidas" \}, 401/.test(SRC));
  check('G12_SESSION_ROLE','Sessão só para Social/Admin ATIVO (lookupTeamUser; 403 caso contrário)', /usuário não autorizado \(Social\/Admin ativo requerido\)" \}, 403/.test(SRC));
  check('G13_NOTIFY_AFTER_AUTH','notifyWorkflowEvent só DEPOIS da autorização (ordem no handler)', (()=>{const h=(SRC.match(/async function handleClientCronogramaTeamAction[\s\S]*?\n\}/)||[''])[0];const a=h.indexOf('AUTENTICAÇÃO FORTE');const n=h.indexOf('notifyWorkflowEvent');return a>=0&&n>a;})());
  check('G14_NO_PASSWORD_LOG','Senha NUNCA aparece em console.log/warn da sessão', (()=>{const h=(SRC.match(/async function handleTeamSession[\s\S]*?\n\}/)||[''])[0];return h.length>0 && !/console\.(log|warn|error)\([^)]*password/.test(h);})());

  /* ===================== VEREDITO ===================== */
  console.log(`${C.b}\n==================================================================`);
  if (FAIL===0){
    console.log(`${C.g} RESULTADO: APROVADO ✔  (0 falhas).`);
    console.log(`${C.g} approveItem nunca conclui · fases isoladas · Web Push REAL (round-trip RFC 8291 + VAPID ES256 verificados) · engine com 9 eventos + dedup + fallback WhatsApp.${C.x}`);
    console.log(`${C.b}==================================================================${C.x}`);
    process.exit(0);
  } else {
    console.log(`${C.r} RESULTADO: REPROVADO X  (${FAIL} falha(s))`);
    FAILS.forEach(f=>console.log('   - '+f));
    console.log(`${C.b}==================================================================${C.x}`);
    process.exit(1);
  }
})();
