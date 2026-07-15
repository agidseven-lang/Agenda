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
  // V64.49 — approveItem NUNCA conclui a tarefa NEM fecha fase (nem na themes): o
  // fechamento é SEMPRE explícito via approveAll (botão final "Aprovar temas" do portal).
  if (e.type==='approveItem'){
    g = { cs:null, rev:null, client:null };
  }

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
// V64.49 — REGRA EXPLÍCITA (reprovação 1.0.134): aprovar o ÚLTIMO tema NÃO fecha a fase —
// o fechamento exige o botão final do portal ("Aprovar temas" → approveAll).
check('THEMES_ITEMS_NEED_EXPLICIT', 'approveItem do ÚLTIMO tema NÃO fecha a fase (clientFlowStatus segue não-aprovado)', tT.clientFlowStatus!=='aprovado' && !concluded(tT));
const tTdone = applyAction(tT, {type:'approveAll', at:4});
check('THEMES_EXPLICIT_CLOSES', 'approveAll explícito (botão "Aprovar temas") FECHA a fase themes sem concluir a tarefa', tTdone.clientFlowStatus==='aprovado' && tTdone.clientReview && tTdone.clientReview.status==='aprovado' && !concluded(tTdone));

/* ═══ PARTE A.6 — CENÁRIO EXATO DO BUG 1.0.132 (reprovação do teste real) ═══
 * 3 temas → aprova 1 e 2 → pede ajuste no 3 → equipe corrige (team-action) →
 * cliente aprova o 3 → fase themes DEVE fechar (sem approveAll). */
console.log(`${C.b}\n[A.6] Cenário REAL reprovado: ajuste→correção→aprovação fecha a fase${C.x}`);
let tR = { id:'real', cronContents:TH, clientApprovalPhase:'themes', clientItems:{} };
tR = applyAction(tR, {type:'approveItem', contentIndex:0, at:7001});
tR = applyAction(tR, {type:'approveItem', contentIndex:1, at:7002});
tR = applyAction(tR, {type:'reviseItem', contentIndex:2, note:'trocar foto', at:7003});
check('A6_STUCK_STATE', 'Após o pedido de ajuste, globais ficam em revisão (estado intermediário correto)', tR.clientFlowStatus==='revisao' && tR.clientReview.status==='revisao');
tR = applyTeamAdjust(tR, 2, 'João Marques');           // equipe corrigiu (Marcar como corrigido)
check('A6_TEAM_FIXED', 'team-action limpa cs do item 3 (aguardando nova análise)', tR.clientItems.i2.cs===null && tR.clientFlowStatus==='revisao');
tR = applyAction(tR, {type:'approveItem', contentIndex:2, at:7004});   // cliente aprova o corrigido
check('A6_ITEM_NOT_CLOSE', 'V64.49: aprovar o tema corrigido NÃO fecha a fase sozinho (espera o botão final)', tR.clientFlowStatus!=='aprovado' && tR.clientItems.i2.cs==='aprovado');
tR = applyAction(tR, {type:'approveAll', at:7004.5});                  // botão final "Aprovar temas"
check('A6_PHASE_CLOSED', 'Botão final (approveAll) FECHA a fase mesmo com clientReview=revisao herdado: clientFlowStatus=aprovado + clientReview=aprovado + cronStatus=aprovado_cliente', tR.clientFlowStatus==='aprovado' && tR.clientReview.status==='aprovado' && tR.cronStatus==='aprovado_cliente');
check('A6_NOT_CONCLUDED', 'Fase fechada NÃO conclui a tarefa (finalApprovalCompleted ausente)', !concluded(tR));
check('A6_NO_PENDING', 'pendingClientItems(themes) vazio após o fechamento (cleanup zerou cs da fase)', Object.keys(tR.clientItems).every(k=>tR.clientItems[k].cs==null || tR.clientItems[k].cs==='aprovado'? (tR.clientItems[k].cs==null||true):true) && !Object.keys(tR.clientItems).some(k=>{const it=tR.clientItems[k];return (it.cs==='em_revisao'||it.cs==='editado')&&it.phase==='themes';}));
check('A6_CLEANUP', 'Cleanup de transição zerou cs dos itens da fase themes', tR.clientItems.i0.cs===null && tR.clientItems.i1.cs===null && tR.clientItems.i2.cs===null);
// fase FINAL preserva o BUG#6: aprovar TODOS os itens via approveItem NÃO conclui
let tRF = Object.assign({}, tR, { cronContents:FULL, clientApprovalPhase:'final', cronStatus:'ready_for_final_client_review', clientItems:{} });
tRF = applyAction(tRF, {type:'approveItem', contentIndex:0, at:7005});
tRF = applyAction(tRF, {type:'approveItem', contentIndex:1, at:7006});
tRF = applyAction(tRF, {type:'approveItem', contentIndex:2, at:7007});
check('A6_FINAL_STILL_GATED', 'FASE FINAL: aprovar TODOS os itens via approveItem AINDA não conclui (exige approveAll explícito)', !concluded(tRF));
const tRFdone = applyAction(tRF, {type:'approveAll', at:7008});
check('A6_FINAL_APPROVEALL', 'FASE FINAL: approveAll explícito conclui normalmente', tRFdone.finalApprovalCompleted===true);

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
check('W_APPROVEITEM_NEVER_CLOSES', 'V64.49: approveItem NUNCA fecha fase (sem bloco de fechamento; só marca o item) e NUNCA toca finalApprovalCompleted', /htype: "cliente_aprovou_item"/.test(apItem) && apItem.indexOf('if (!isFinalPhase)')===-1 && apItem.indexOf('FECHADA via approveItem')===-1 && apItem.indexOf('finalApprovalCompleted')===-1 && /NUNCA fecha a/.test(apItem));
check('W_PHASE_TAG', 'clientItems.iX é marcado com phase = clientPhase(task)', /itemFields\.phase = \{ stringValue: clientPhase\(task\) \}/.test(SRC));
check('W_PENDINGREV_PHASE', '_pendingRev é POR FASE (ph === phaseIn)', /\(cs === "em_revisao" \|\| cs === "editado"\) && \(ph === phaseIn\)/.test(SRC));
check('W_FINAL_GATE', 'finalApprovalCompleted só dentro do bloco g.client === "concluido"', /if \(g\.client === "concluido"\) \{[\s\S]*?finalApprovalCompleted = \{ booleanValue: true \}/.test(SRC));
check('W_APPROVEITEM_NOT_CONCLUDE', 'approveItem NÃO está no caminho de g.client (só approve/approveAll/approveG concluem)', !/approveItem[\s\S]{0,120}finalApprovalCompleted/.test(apItem));

/* ===================== PARTE C — V64.42 (asserções estruturais novas) ===================== */
console.log(`${C.b}\n[C] V64.42 — team-action + idempotencia + logo + UX + push esqueleto${C.x}`);
check('C_HEALTH_V64_52', 'Healthcheck retorna V64.59 (linha canônica; sufixo da fase atual)', /version: "V64\.59-c18g-roteiro-og-logo-idseven"/.test(SRC));
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
  check('F_CTA','Portal tem CTA explícito "Receber avisos deste cronograma" + estados (ativado/negado/incompatível/disponível)', /Receber avisos deste cronograma/.test(SRC)&&/Notificações não permitidas\. Vamos manter o WhatsApp como canal de aviso\./.test(SRC)&&/não suporta avisos em tempo real/.test(SRC)&&/Avisos ativados ✓/.test(SRC));
  check('F_CTA_NO_AUTOPROMPT','CTA NUNCA pede permissão sem clique (requestPermission só dentro de subscribeClientPush)', (()=>{const auto=SRC.match(/function setupClientWebPush\(\)\{[\s\S]*?\n\}/);return auto&&auto[0].indexOf('requestPermission')===-1;})());
  check('F_VERSION','Healthcheck = V64.59 (linha canônica; sufixo da fase atual)', /version: "V64\.59-c18g-roteiro-og-logo-idseven"/.test(SRC));
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
  check('G11_PASSWORD_PROOF','Sessão verifica a SENHA server-side em TEMPO CONSTANTE (timingSafeEqualStr) — s2 + djb2 legado', /okPw = await timingSafeEqualStr\(u\.pass, "s2:" \+ await sha256HexW\(u\.salt \+ "\|" \+ password\)\)/.test(SRC) && /timingSafeEqualStr\(u\.pass, djb2Hash\(password\)\)/.test(SRC));
  check('G12_SESSION_GENERIC','Sessão NÃO revela motivo: uid inexistente/role errada/senha errada → MESMO erro genérico 401 "credenciais inválidas"', (()=>{const h=(SRC.match(/async function handleTeamSession[\s\S]*?\n\}/)||[''])[0];return h.length>0 && !/Social\/Admin ativo requerido/.test(h) && !/senha inválida/.test(h) && (h.match(/credenciais inválidas/g)||[]).length>=3;})());
  check('G13_NOTIFY_AFTER_AUTH','notifyWorkflowEvent só DEPOIS da autorização (ordem no handler)', (()=>{const h=(SRC.match(/async function handleClientCronogramaTeamAction[\s\S]*?\n\}/)||[''])[0];const a=h.indexOf('AUTENTICAÇÃO FORTE');const n=h.indexOf('notifyWorkflowEvent');return a>=0&&n>a;})());
  check('G14_NO_PASSWORD_LOG','Senha NUNCA aparece em console.log/warn da sessão', (()=>{const h=(SRC.match(/async function handleTeamSession[\s\S]*?\n\}/)||[''])[0];return h.length>0 && !/console\.(log|warn|error)\([^)]*password/.test(h);})());

  /* ===================== PARTE H — HARDENING V64.46 (funcional + estrutural) ===================== */
  console.log(`${C.b}\n[H] Hardening da sessão de equipe (rate limit · timing-safe · logs limpos · TTL)${C.x}`);
  try{
    // FUNCIONAL: extrai rlDecide/rlOnFail/timingSafeEqualStr/maskUid REAIS e prova em Node.
    const H_FNS=['rlDecide','rlOnFail','maskUid','timingSafeEqualStr'].map(extractFn).join('\n');
    const hScope={crypto:globalThis.crypto,TextEncoder,Uint8Array,String,JSON,Math,console,
      TEAM_RL_MAX:5,TEAM_RL_WINDOW_S:300,TEAM_RL_BLOCK_S:900};
    const H=new Function(...Object.keys(hScope),
      "const TEAM_RL_MAX_=TEAM_RL_MAX,TEAM_RL_WINDOW_S_=TEAM_RL_WINDOW_S,TEAM_RL_BLOCK_S_=TEAM_RL_BLOCK_S;\n"+
      H_FNS.replace(/TEAM_RL_MAX/g,'TEAM_RL_MAX_').replace(/TEAM_RL_WINDOW_S/g,'TEAM_RL_WINDOW_S_').replace(/TEAM_RL_BLOCK_S/g,'TEAM_RL_BLOCK_S_')+
      '\nreturn {rlDecide,rlOnFail,maskUid,timingSafeEqualStr};')(...Object.values(hScope));
    // H1 — 5ª senha errada bloqueia; antes disso não bloqueia
    let st=null;const t0=1000000;
    for(let i=0;i<4;i++){st=H.rlOnFail(st,t0+i);}
    check('H1_FOUR_FAILS_OK','4 tentativas inválidas ainda NÃO bloqueiam', H.rlDecide(st,t0+10).blocked===false && st.fails===4);
    st=H.rlOnFail(st,t0+5);
    const dec=H.rlDecide(st,t0+10);
    check('H2_FIFTH_BLOCKS','5ª tentativa inválida BLOQUEIA com backoff de 15min', st.fails===5 && dec.blocked===true && dec.retryAfter>0 && st.until===t0+5+900);
    check('H3_BACKOFF_EXPIRES','Bloqueio expira após o backoff (não é permanente)', H.rlDecide(st,t0+5+901).blocked===false);
    check('H4_WINDOW_RESET','Falhas FORA da janela de 5min reiniciam a contagem (não acumulam p/ sempre)', H.rlOnFail({fails:4,first:t0},t0+301).fails===1);
    // H5 — comparação em tempo constante (funcional)
    check('H5_TSE','timingSafeEqualStr: igual→true; diferente→false; tamanhos diferentes→false',
      (await H.timingSafeEqualStr('abc','abc'))===true && (await H.timingSafeEqualStr('abc','abd'))===false && (await H.timingSafeEqualStr('abc','abcd'))===false);
    check('H6_MASK','maskUid mascara (3 chars + …) e tolera vazio', H.maskUid('joaomarques123')==='joa…' && H.maskUid('')==='(vazio)');
  }catch(e){
    check('H_FATAL','Parte H executa sem exceção — erro: '+(e&&e.message), false);
  }
  // ESTRUTURAIS
  const hs=(SRC.match(/async function handleTeamSession[\s\S]*?\n\}/)||[''])[0];
  const ha=(SRC.match(/async function handleClientCronogramaTeamAction[\s\S]*?\n\}/)||[''])[0];
  check('H7_RL_APPLIED','Sessão aplica rate limit por uid E por IP (CF-Connecting-IP) com 429 genérico',
    /team-session\/uid\//.test(hs) && /team-session\/ip\//.test(hs) && /CF-Connecting-IP/.test(hs) && /muitas tentativas — aguarde alguns minutos" \}, 429/.test(hs));
  check('H8_RL_RESET_ON_SUCCESS','Sucesso LIMPA os contadores (rlClear uid+ip)', (hs.match(/await rlClear\(/g)||[]).length>=2);
  check('H9_DUMMY_COMPARE','uid inexistente executa compare DUMMY (não revela existência por timing)', /compare DUMMY/.test(hs) && /dummy\|/.test(hs));
  check('H10_TTL_4H','TTL do JWT reduzido para 4h (TEAM_JWT_TTL_S = 4*3600; sem 12h)', /const TEAM_JWT_TTL_S = 4 \* 3600;/.test(SRC) && /exp: nowS \+ TEAM_JWT_TTL_S/.test(hs) && hs.indexOf('12 * 3600')===-1);
  check('H11_LOGS_MASKED','Logs da sessão e da team-action usam maskUid; nunca senha/hash/JWT/secret',
    (()=>{const logs=(hs.match(/console\.\w+\([^;]*\)/g)||[]).concat(ha.match(/console\.\w+\([^;]*\)/g)||[]);
      return logs.length>0 && logs.every(l=>!/password|u\.pass|\+ jwt|TEAM_SESSION_SECRET|sha256HexW/.test(l)) && logs.filter(l=>/uid=/.test(l)).every(l=>/maskUid/.test(l));})());
  check('H12_XKEY_TSE','X-Team-Key comparada em tempo constante (timingSafeEqualStr)', /timingSafeEqualStr\(suppliedKey, env\.TEAM_API_KEY\)/.test(ha));
  check('H13_REJECT_NO_NOTIFY','Rejeição (401/403/429) ocorre ANTES de notifyWorkflowEvent/commit/idem-cache (sem efeito colateral)',
    (()=>{const auth=ha.indexOf('AUTENTICAÇÃO FORTE');const notify=ha.indexOf('notifyWorkflowEvent');const idemPut=ha.indexOf('caches.default.put');return auth>=0&&notify>auth&&idemPut>notify;})());
  check('H14_CORS_DOC','CORS/origem auditado e documentado (Electron envia Origin null/file; proteção real = autenticação)', /CORS\/ORIGEM \(auditoria documentada\)/.test(SRC) && /Electron/.test(SRC));
  check('H15_GENERIC_400','Body inválido/incompleto também responde genérico (sem distinguir uid/senha ausentes)', (()=>{const m=hs.match(/credenciais inválidas" \}, 401/g);return m&&m.length>=3;})());

  /* ===================== PARTE I — V64.48 (notificação de envio + rodapé dinâmico) ===================== */
  console.log(`${C.b}\n[I] V64.48 — contentSent (push do envio real) + rodapé dinâmico do portal${C.x}`);
  const haI=ha;
  const csBlock=(haI.match(/if \(action === "contentSent"\) \{[\s\S]*?\n  \}/)||[''])[0];
  check('I1_CONTENTSENT_ACTION','team-action aceita action contentSent (além de adjustedItem)',
    /action !== "adjustedItem" && action !== "contentSent"/.test(haI));
  check('I2_CONTENTSENT_EVENTS','contentSent dispara themes_sent_to_client (themes) / final_content_sent_to_client (final)',
    csBlock.length>0 && /final_content_sent_to_client" : "themes_sent_to_client"/.test(csBlock) && /notifyWorkflowEvent\(env, task, evSent/.test(csBlock));
  check('I3_CONTENTSENT_NO_WRITE','contentSent NÃO escreve no Firestore (sem commit/writes — o Desktop já gravou o envio)',
    csBlock.length>0 && csBlock.indexOf(':commit')===-1 && csBlock.indexOf('writes:')===-1 && csBlock.indexOf('updateMask')===-1);
  check('I4_CONTENTSENT_IDX_OPT','contentIndex segue OBRIGATÓRIO em adjustedItem e dispensado em contentSent',
    /action === "adjustedItem" && !uniq\.length/.test(haI));
  check('I5_CONTENTSENT_AFTER_AUTH','contentSent executa DEPOIS da autenticação forte e do replay de idempotência',
    (()=>{const a=haI.indexOf('AUTENTICAÇÃO FORTE');const idem=haI.indexOf('Idempotency-Key');const cs=haI.indexOf('if (action === "contentSent")');return a>=0&&idem>a&&cs>idem&&cs>haI.indexOf('queryTaskByToken');})());
  check('I6_CONTENTSENT_LOGGED','resultado do engine (channel/sent/fallback) volta na resposta E no log',
    csBlock.length>0 && /\[TEAM-ACTION\] contentSent/.test(csBlock) && /push: pushSent/.test(csBlock));
  check('I7_FOOTER_FN','CV_JS tem syncFooter() + anyRevBadge() + footerCta() (rodapé dinâmico)',
    /function syncFooter\(\)/.test(SRC) && /function anyRevBadge\(\)/.test(SRC) && /function footerCta\(\)/.test(SRC));
  check('I8_FOOTER_FEEDBACK_BTN','rodapé 3 ESTADOS: ajuste→Enviar feedback; 3/3→approveAll; pendente→reviewNext (NUNCA finalização)',
    (()=>{const f=(SRC.match(/function syncFooter\(\)\{[\s\S]*?\n\}/)||[''])[0];if(!f)return false;const fb=f.indexOf('ackFeedback');const ap=f.indexOf('approveAll');const rv=f.indexOf('reviewNext');return fb>=0&&ap>fb&&rv>ap&&/st\.apr>=st\.total/.test(f)&&f.indexOf('Enviar feedback')>=0;})());
  check('I9_FOOTER_CALLS','syncFooter chamado em approveItem/reviseItem/editTheme/editLegenda + applyState (poller tempo real)',
    (()=>{const n=(SRC.match(/syncFooter\(\);/g)||[]).length;return n>=5 && /toast\('Ajuste solicitado','ok'\);syncFooter\(\);/.test(SRC) && /syncFooter\(\);\s*\/\/ V64\.48/.test(SRC);})());
  check('I10_FOOTER_CTA_PHASE','footerCta segue a fase (final/production/themes) — paridade com phaseCopy do server-render (C17: itens por TIPO; default cronograma = temas)',
    /PHASE==='final'\?'Aprovar versão final':\(PHASE==='production'\?'Aprovar legendas e artes':'Aprovar '\+PT\.itens\)/.test(SRC) &&
    /var PT=\(typeof PT==='object'&&PT&&PT\.o\)\?PT:\{o:'o cronograma',em:'no cronograma',de:'do cronograma',seu:'seu cronograma',deste:'deste cronograma',itens:'temas'\};/.test(SRC));
  check('I11_FOOTER_SERVER_PARITY','rodapé server-rendered (load) continua decidindo por pendingRevision (sem regressão; V64.53: barra só-botões + guia no fluxo)',
    /pendingRevision\s*\n?\s*\?\s*'<button class="btn ghost" data-act="revision">/.test(SRC) &&
    /<div class="guide" id="guide">[\s\S]{0,400}ajustes solicitados/.test(SRC));

  /* ===================== PARTE J — V64.49 (ativação assistida + copy exata + fechamento explícito) ===================== */
  console.log(`${C.b}\n[J] V64.49 — ativação assistida de avisos + copy exata + fechamento explícito${C.x}`);
  check('J1_GATE_FN','pushGateShow/pushGateClose existem (bloco destacado no 1º acesso)',
    /function pushGateShow\(\)/.test(SRC) && /function pushGateClose\(\)/.test(SRC));
  check('J2_GATE_COPY','Gate tem título/texto/botões EXATOS da especificação (C17: "deste cronograma"/"deste roteiro" via PT; default cronograma preservado)',
    /Receba avisos '\+PT\.deste\+' em tempo real/.test(SRC) && /ative as notificações '\+PT\.deste\+'\./.test(SRC) && /Ativar avisos em tempo real/.test(SRC) && /Continuar sem avisos/.test(SRC) &&
    /deste:'deste cronograma'/.test(SRC));
  check('J3_GATE_NO_AUTOPROMPT','Gate NÃO pede permissão sem clique (requestPermission só dentro de subscribeClientPush)',
    (()=>{const g=(SRC.match(/function pushGateShow\(\)\{[\s\S]*?\n\}/)||[''])[0];return g.length>0&&g.indexOf('requestPermission')===-1&&/subscribeClientPush\(function\(ok\)/.test(g);})());
  check('J4_GATE_SKIP','"Continuar sem avisos" registra a escolha (localStorage por TOKEN) e mostra fallback WhatsApp',
    /wp_gate_skip_'\+TOKEN/.test(SRC) && /Você continuará recebendo avisos pelo WhatsApp\./.test(SRC));
  check('J5_GATE_ONCE','Inscrito CONFIRMADO não vê gate; inscrição existente NÃO confirmada reabre o gate (sem skip)',
    (()=>{const f=(SRC.match(/function setupClientWebPush\(\)\{[\s\S]*?\n\}/)||[''])[0];return /resp&&resp\.ok===true\)\{pushCtaState\('Avisos ativados ✓','pc-ok',null\);\}/.test(f)&&/servidor não confirmou/.test(f)&&(f.match(/pushGateShow\(\)/g)||[]).length>=2;})());
  check('J6_GATE_DENIED','Permissão negada → fallback WhatsApp SEM loop (mensagem exata, sem reabrir gate)',
    (()=>{const f=(SRC.match(/function setupClientWebPush\(\)\{[\s\S]*?\n\}/)||[''])[0];const i=f.indexOf("permission==='denied'");const gate=f.indexOf('pushGateShow');return i>=0&&gate>i&&/Notificações não permitidas\. Vamos manter o WhatsApp como canal de aviso\./.test(f);})());
  check('J7_GATE_IOS','iOS sem suporte → instrução de Tela de Início + fallback WhatsApp',
    /No iPhone, para receber avisos com a tela bloqueada, adicione este portal à Tela de Início/.test(SRC) && /iPad\|iPhone\|iPod/.test(SRC));
  check('J8_GATE_SUCCESS','Ativação com sucesso mostra "Avisos ativados" (toast "Avisos ativados com sucesso")',
    /Avisos ativados com sucesso/.test(SRC) && /Avisos ativados ✓/.test(SRC));
  // copy EXATA por evento (títulos + mensagens da especificação)
  const COPY=[['themes_sent_to_client','Cronograma disponível para análise','Os temas do seu cronograma estão prontos para revisão.'],
    ['theme_adjusted_by_team','Tema corrigido','O tema ajustado foi reenviado. Toque para revisar.'],
    ['themes_approved_by_client','Temas aprovados','A etapa de temas foi aprovada com sucesso.'],
    ['final_content_sent_to_client','Legendas e posts disponíveis','As legendas e os posts estão prontos para sua análise.'],
    ['final_adjusted_by_team','Ajuste final realizado','As correções finais foram enviadas. Toque para revisar.'],
    ['final_approved_by_client','Cronograma finalizado','Seu cronograma foi aprovado com sucesso.']];
  check('J9_NOTIFY_COPY','NOTIFY_EVENTS com títulos/mensagens EXATOS dos 6 eventos do cliente',
    COPY.every(([ev,t,b])=>{const re=new RegExp(ev+":\\s*\\{[^}]*title: \""+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"\"[^}]*body: \""+b.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"\"");return re.test(SRC);}));
  check('J10_NOTIFY_PRECISION','Payload do push carrega eventType + taskId + phase (além de title/body/openUrl/tag)',
    /eventType, taskId: \(task && task\.id\) \|\| "", phase: ev\.phase/.test(SRC));
  check('J11_NOTIFY_TRUTH','Resultado NUNCA mente: falha de envio com subscription = send_failed (erro real), nunca confundida com sem_subscription',
    /if \(!out\.sent\) \{ result\.fallback = "whatsapp_premium"; result\.reason = "send_failed"; result\.error = "push_send_failed"; \}/.test(SRC) && /reason: subs\.length \? "VAPID_NOT_CONFIGURED" : "sem_subscription"/.test(SRC));
  check('J12_ITEM_NO_AUTOFINISH','CV_JS: aprovar item NÃO mostra tela final automaticamente (sem clientThemesApproved no callback de approveItem)',
    (()=>{const m=SRC.match(/if\(act==='approveItem'\)\{post\([\s\S]*?\}\);\}/);if(!m)return false;return m[0].indexOf('clientThemesApproved')===-1&&m[0].indexOf('clientProductionApproved')===-1&&/syncFooter\(\)/.test(m[0]);})());
  check('J13_CTA_APROVAR_TEMAS','CTA da fase de temas = "Aprovar temas" no cronograma (server phaseCopy) + footerCta por TIPO (C17)',
    /cta: "Aprovar temas",/.test(SRC) && /:'Aprovar '\+PT\.itens\)/.test(SRC.match(/function footerCta[\s\S]{0,200}/)[0]));

  /* ═══════════ PARTE K — V64.50 (prova pós-ativação: interop real + verdade + diagnóstico) ═══════════ */
  console.log(`${C.b}\n[K] V64.50 — push pós-ativação: interop RFC 8291/8292 + verdade na inscrição + diagnóstico${C.x}`);
  // K1/K2 — INTEROP REAL: cifra com o código DO WORKER e decifra com implementação
  // INDEPENDENTE (node:crypto, seguindo a RFC à letra — o mesmo caminho do Chrome).
  try{
    const nodeCrypto=require('node:crypto');
    const kfn=n=>{const m=SRC.match(new RegExp('(?:async )?function '+n+'\\s*\\([^)]*\\)\\s*\\{'));if(!m)throw new Error('NF '+n);
      let st=SRC.indexOf(m[0]),d=0;for(let i=st+m[0].length-1;i<SRC.length;i++){const c=SRC[i];if(c==='{')d++;else if(c==='}'){d--;if(d===0)return SRC.slice(st,i+1);}}};
    const kmod=new Function(['b64uToBytes','bytesToB64u','concatBytes','hkdfBits','encryptWebPushPayload','vapidJwt']
      .map(kfn).join('\n')+'\nreturn {encryptWebPushPayload,vapidJwt};')();
    const ua=nodeCrypto.createECDH('prime256v1');ua.generateKeys();
    const uaPub=ua.getPublicKey();const auth=nodeCrypto.randomBytes(16);
    const b64u=b=>Buffer.from(b).toString('base64url');
    const payload=JSON.stringify({title:'t',body:'interop',openUrl:'/x',tag:'x',eventType:'e',taskId:'id',phase:'themes'});
    const body=Buffer.from(await kmod.encryptWebPushPayload(payload,b64u(uaPub),b64u(auth)));
    const salt=body.subarray(0,16),rs=body.readUInt32BE(16),idlen=body[20];
    const asPub=body.subarray(21,21+idlen),ct=body.subarray(21+idlen);
    const hk=(sa,ikm,info,len)=>Buffer.from(nodeCrypto.hkdfSync('sha256',ikm,sa,info,len));
    const ikm=hk(auth,ua.computeSecret(asPub),Buffer.concat([Buffer.from('WebPush: info\0'),uaPub,asPub]),32);
    const dec=nodeCrypto.createDecipheriv('aes-128-gcm',hk(salt,ikm,Buffer.from('Content-Encoding: aes128gcm\0'),16),hk(salt,ikm,Buffer.from('Content-Encoding: nonce\0'),12));
    dec.setAuthTag(ct.subarray(ct.length-16));
    const plain=Buffer.concat([dec.update(ct.subarray(0,ct.length-16)),dec.final()]);
    check('K1_INTEROP_RFC8291','Payload cifrado pelo Worker é decifrado por implementação INDEPENDENTE (node:crypto, RFC 8291) — formato aes128gcm/idlen/0x02 corretos',
      idlen===65 && rs===4096 && plain[plain.length-1]===2 && plain.subarray(0,plain.length-1).toString()===payload);
    const vk=nodeCrypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
    const j=vk.publicKey.export({format:'jwk'});
    const pub65=Buffer.concat([Buffer.from([4]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]);
    const envK={VAPID_PUBLIC_KEY:b64u(pub65),VAPID_PRIVATE_KEY:b64u(Buffer.from(vk.privateKey.export({format:'jwk'}).d,'base64url')),VAPID_SUBJECT:'mailto:x@y.z'};
    const jwt=await kmod.vapidJwt(envK,'https://fcm.googleapis.com');
    const [h2,c2,s2]=jwt.split('.');
    const okSig=nodeCrypto.verify('sha256',Buffer.from(h2+'.'+c2),{key:vk.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s2,'base64url'));
    const cl=JSON.parse(Buffer.from(c2,'base64url').toString());
    check('K2_VAPID_VERIFY','VAPID JWT assinado pelo Worker verifica com chave pública independente; aud = origem do endpoint; exp ≤ 24h',
      okSig===true && cl.aud==='https://fcm.googleapis.com' && (cl.exp-Date.now()/1e3)<=24*3600+60);
  }catch(e){check('K_INTEROP_FATAL','Interop executa sem exceção — erro: '+(e&&e.message),false);}
  // K3..K12 — verdade na inscrição + diagnóstico + teste + badge
  check('K3_SUB_TRUTH','sendSubToWorker interpreta a resposta (json+status) e "Avisos ativados" SÓ com ok:true confirmado',
    /b\._http=r\.status;if\(!r\.ok\)b\.ok=false;/.test(SRC) && /if\(resp&&resp\.ok===true\)\{pushCtaState\('Avisos ativados ✓/.test(SRC));
  check('K4_SUB_FAIL_HONESTO','Falha ao salvar inscrição mostra o ERRO REAL + fallback WhatsApp + botão Tentar novamente',
    /NÃO conseguimos salvar a inscrição no servidor/.test(SRC) && /'Tentar novamente'/.test(SRC));
  check('K5_DIAG_PANEL','Painel ?debug=1: permission, sw.scope, hasController, endpoint mascarado, lastSubscribeStatus, lastPushTest, lastNotificationClick, token/phase',
    /function pushDebugPanel\(\)/.test(SRC) && /debug=1/.test(SRC) && /hasController/.test(SRC) && /lastSubscribeStatus/.test(SRC) && /lastPushTest/.test(SRC) && /lastNotificationClick/.test(SRC));
  check('K6_PUSHTEST_ROUTE','Rota POST /push/test: envia push real às subscriptions do cronograma SEM alterar a tarefa + rate-limit 30s',
    /push\\\/test/.test(SRC) && /async function handleClientPushTest/.test(SRC) && /push-test-rl\.local/.test(SRC) && (()=>{const h=(SRC.match(/async function handleClientPushTest[\s\S]*?\n\}/)||[''])[0];return h.indexOf(':commit')<0&&h.indexOf('writes:')<0;})());
  check('K7_PUSHTEST_TRUTH','push/test devolve sent/total/results com endpoint MASCARADO + status real do POST',
    /maskEndpoint\(subs\[i\] && subs\[i\]\.endpoint\)/.test(SRC) && /\[PUSH-TEST\]/.test(SRC));
  check('K8_NOTIFY_FULL_LOG','[NOTIFY] loga eventType, phase, openUrl, dedupKey, subsFound e o resultado por endpoint',
    /openUrl=\$\{openUrl\} dedupKey=\$\{dedupKey\} subsFound=\$\{subsFound\}/.test(SRC));
  check('K9_BADGE','Badge monocromático dedicado: IDSEVEN_BADGE_B64 + rota + SW/payload usam o badge',
    /const IDSEVEN_BADGE_B64 = "[A-Za-z0-9+/=]{200,}"/.test(SRC) && /\/og\/idseven-badge\.png/.test(SRC) && /data\.badge \|\| '\/og\/idseven-badge\.png'/.test(SRC) && /badge: "\/og\/idseven-badge\.png"/.test(SRC));
  check('K10_SW_DATA','SW: showNotification dentro de waitUntil + data{url,eventType,taskId,phase} + click abre o MESMO link + reporta push/click à página',
    /self\.registration\.showNotification\(title, options\)/.test(SRC) && /event\.waitUntil\(Promise\.all\(/.test(SRC) && /eventType: data\.eventType/.test(SRC) && /idseven-click/.test(SRC) && /idseven-push/.test(SRC));
  check('K11_SW_VERSIONED','SW versionado (sw-version: V64.51) — força atualização do SW antigo nos clientes',
    /sw-version: V64\.51-mobile-touch-footer/.test(SRC));
  check('K12_MASK','maskEndpoint nunca expõe o token do push service (origem + 8 últimos chars)',
    /function maskEndpoint\(e\)/.test(SRC) && /e\.slice\(-8\)/.test(SRC));
  check('K13_SUBSCRIBE_OK_REAL','/push/subscribe devolve ok:true SOMENTE após commit confirmado no Firestore (res.ok); falha → ok:false com erro',
    (()=>{const h=(SRC.match(/async function handleClientPushSubscribe[\s\S]*?\n\}/)||[''])[0];
      const fail=h.indexOf('commit falhou');const okret=h.indexOf('ok: true, taskId');
      return fail>=0&&okret>fail&&/if \(!res\.ok\)/.test(h);})());
  check('K14_PRUNE_410','Subscription morta (404/410) é removida (prune) e nunca reutilizada',
    /if \(res\.status === 404 \|\| res\.status === 410\) return \{ ok: false, gone: true/.test(SRC) && /async function pruneClientPushSubs/.test(SRC));

  /* ═══════════ PARTE L — V64.51 (toque mobile + rodapé 3 estados + gate blindado) ═══════════ */
  console.log(`${C.b}\n[L] V64.51 — portal mobile: toque, rodapé 3 estados, gate, payload${C.x}`);
  check('L1_GACTIONS_TOUCH','Barra inferior fixa NÃO engole toques: .gactions pointer-events:none + filhos auto',
    /\.gactions\{[^}]*pointer-events:none\}/.test(SRC) && /\.gactions \.inner > \*\{pointer-events:auto\}/.test(SRC));
  check('L2_WRAP_MOBILE_PAD','Respiro real no mobile: padding do .wrap dirigido pela ALTURA REAL do CTA (--cta-h medido) — sem regra duplicada',
    /@media\(max-width:560px\)\{\.wrap\{padding:18px 14px calc\(var\(--cta-h,168px\) \+ 22px\)\}\}/.test(SRC) &&
    /function ctaPad\(\)/.test(SRC) && !/padding:18px 14px 150px/.test(SRC) && !/padding-bottom:240px/.test(SRC));
  check('L3_FOOTER_SERVER_3','Server-render com 3 estados (pendingRevision / _allApprovedR / revisão orientada)',
    /pendingRevision[\s\S]{0,500}_allApprovedR[\s\S]{0,900}reviewNext/.test(SRC));
  check('L4_REVIEWNEXT','reviewNext abre/rola até o 1º conteúdo pendente (expande o card + diag expandedItem)',
    /act==='reviewNext'/.test(SRC) && /first\.classList\.add\('is-open'\)/.test(SRC) && /diagSet\('expandedItem'/.test(SRC));
  check('L5_APPROVEALL_GUARD','approveAll com pendentes SEM ajuste NÃO finaliza (toast + re-sync do rodapé)',
    /stG\.rev===0&&stG\.apr<stG\.total/.test(SRC) && /Revise e aprove cada tema antes de finalizar/.test(SRC));
  check('L6_GATE_INLINE','Gate com estilos CRÍTICOS inline (nunca overlay invisível bloqueando toques)',
    /d\.style\.cssText='position:fixed;inset:0;z-index:90/.test(SRC));
  check('L7_DIAG_NEW','Painel debug com gateRendered/footerState/cardClickBound/cardClickFired/expandedItem/approveBtn/lastPushEvent',
    /row\('gateRendered'/.test(SRC) && /row\('footerState'/.test(SRC) && /row\('cardClickBound'/.test(SRC) && /row\('cardClickFired'/.test(SRC) && /row\('expandedItem'/.test(SRC) && /row\('approveBtn'/.test(SRC) && /row\('lastPushEvent'/.test(SRC));
  check('L8_PAYLOAD_FULL','Payload do push inclui icon+badge+tag=dedupKey (e o /push/test idem)',
    /tag: dedupKey,\s*\n\s*icon: "\/og\/idseven-logo\.png", badge: "\/og\/idseven-badge\.png"/.test(SRC) && (SRC.match(/icon: "\/og\/idseven-logo\.png", badge: "\/og\/idseven-badge\.png"/g)||[]).length>=2);
  check('L9_SW_PUSH_MSG','SW reporta o push recebido à página (idseven-push → lastPushEvent) sem perder o showNotification',
    /event\.waitUntil\(Promise\.all\(\[\s*\n\s*self\.registration\.showNotification\(title, options\),/.test(SRC));
  check('L10_ATIVANDO','Estado intermediário "Ativando avisos…" exibido ao iniciar a ativação',
    /pushCtaState\('Ativando avisos…','',null\);/.test(SRC));
  check('L11_TOGGLE_HEADER','Card inteiro do tema abre pelo cabeçalho (chead data-toggle, cursor pointer)',
    /class="chead" data-toggle="/.test(SRC) && /\.chead\{[^}]*cursor:pointer/.test(SRC));

  /* ═══ PARTE M — COMPILAÇÃO DO CÓDIGO SERVIDO (a lição da 1.0.136) ═══
   * O CV_JS/SW são template literals: um escape errado no arquivo vira SyntaxError SÓ no
   * script SERVIDO (o node --check do arquivo não pega). Estes checks compilam o que o
   * NAVEGADOR recebe — se quebrar, o portal inteiro morre (gate/toques/rodapé). */
  console.log(`${C.b}\n[M] Código SERVIDO compila (CV_JS + Service Worker pós-template)${C.x}`);
  try{
    const st=SRC.indexOf('const CV_JS = \u0060');
    const en=SRC.indexOf('\n\u0060;',st);
    const served=eval(SRC.slice(st+14,en+2));
    let ok=true,err='';
    try{new Function(served);}catch(e){ok=false;err=e.message;}
    check('M1_CVJS_SERVIDO','CV_JS SERVIDO (template processado) compila sem SyntaxError', ok, err);
    check('M2_CVJS_COMPLETO','CV_JS servido contém o fluxo inteiro (gate, syncFooter 3 estados, toggle, debug, poll)',
      served.includes('pushGateShow')&&served.includes('reviewNext')&&served.includes('data-toggle')&&served.includes('pushDebugPanel')&&served.includes('pollState'));
    const sw=(SRC.match(/const sw = \u0060([\s\S]*?)\u0060;/)||[])[1]||'';
    let okSw=true,errSw='';
    try{new Function(sw);}catch(e){okSw=false;errSw=e.message;}
    check('M3_SW_SERVIDO','Service Worker SERVIDO compila sem SyntaxError', okSw, errSw);
  }catch(e){check('M_FATAL','Parte M executa — erro: '+(e&&e.message),false);}

  /* ═══ PARTE N — V64.52 (UI limpa: livebar SÓ no debug; push intocado) ═══ */
  console.log(`${C.b}\n[N] V64.52 — sem toast flutuante em produção; push preservado${C.x}`);
  check('N1_LIVEBAR_GATED','liveTick NÃO cria elemento flutuante em produção (só com ?debug=1) e registra estado no diag',
    (()=>{const f=(SRC.match(/function liveTick\(ok\)\{[\s\S]*?\n\}/)||[''])[0];return /diagSet\('liveTick'/.test(f)&&/indexOf\('debug=1'\)<0/.test(f)&&f.indexOf('removeChild(LIVE_EL)')>=0;})());
  check('N2_LIVEBAR_TOP','No debug, o indicador fica no TOPO (não compete com os botões fixos inferiores)',
    /left:10px;top:10px;z-index:94/.test(SRC));
  check('N3_PUSH_INTOCADO','Web Push INTOCADO: subscribe/test/engine/SW (sw-version V64.51 inalterado, payload icon/badge/tag=dedupKey)',
    /async function handleClientPushTest/.test(SRC) && /sw-version: V64\.51-mobile-touch-footer/.test(SRC) && /tag: dedupKey,/.test(SRC) && /icon: "\/og\/idseven-logo\.png", badge: "\/og\/idseven-badge\.png"/.test(SRC));

  /* ═══════════ PARTE O — V64.53 (precisão POR EVENTO: engine executado de verdade) ═══════════ */
  console.log(`${C.b}\n[O] V64.53 — 6 eventos do fluxo: engine REAL com sent/fallback/reason por endpoint${C.x}`);
  await (async()=>{
    const fx=(name)=>{const re=new RegExp('(?:async )?function '+name+'\\s*\\(');const m=SRC.match(re);if(!m)throw new Error('fn '+name);
      let st=SRC.indexOf(m[0]),d=0,i=SRC.indexOf('{',st);
      for(let j=i;j<SRC.length;j++){const c=SRC[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0)return SRC.slice(st,j+1);}}};
    const cx=(name)=>{const st=SRC.indexOf('const '+name+' = {');if(st<0)throw new Error('const '+name);
      let d=0;for(let j=SRC.indexOf('{',st);j<SRC.length;j++){const c=SRC[j];if(c==='{')d++;else if(c==='}'){d--;if(d===0)return SRC.slice(st,j+2);}}};
    // Engine real + stubs: broadcastWebPush capturado, Cache API em memória (prova dedup).
    const calls=[];let pushOk=true;
    const cacheMem=new Map();
    const cachesStub={default:{match:async(req)=>cacheMem.get(req.url||req)||null,put:async(req,res)=>{cacheMem.set(req.url||req,res);}}};
    const scopeO={
      console:{log:()=>{},warn:()=>{},error:()=>{}},
      caches:cachesStub,
      Request:function(u){this.url=u;},
      Response:function(b,o){this.body=b;this.opts=o;},
      broadcastWebPush:async(env,subs,payload,opts)=>{calls.push({subs,payload,opts});
        return pushOk?{sent:subs.length,total:subs.length,results:subs.map(()=>({ok:true,status:201})),gone:[]}
                     :{sent:0,total:subs.length,results:subs.map(()=>({ok:false,status:410,gone:true})),gone:[0]};},
      maskEndpoint:(e)=>'masked('+String(e||'').slice(-8)+')',
      pruneClientPushSubs:async()=>{},
    };
    // F3.3.73I6C17 — o engine real agora resolve o TIPO (cronograma×roteiro) via premiumTypeOf;
    // extrai também PREMIUM_TYPES/premiumTypeOf (tasks do teste sem sector → cronograma, copy EXATA).
    const cl=(name)=>{const m=SRC.match(new RegExp('const '+name+' = "[^"]*";'));if(!m)throw new Error('const '+name);return m[0];};
    // F3.3.73I6C18E — PREMIUM_TYPES agora referencia os paths de imagem por tipo
    const OM=new Function(...Object.keys(scopeO),cl('OG_IMG_PATH')+'\n'+cl('OG_IMG_PATH_ROTEIRO')+'\n'+cx('PREMIUM_TYPES')+'\n'+fx('premiumTypeOf')+'\n'+cx('NOTIFY_EVENTS')+'\n'+fx('notifyWorkflowEvent')+'\nreturn {NOTIFY_EVENTS,notifyWorkflowEvent};')(...Object.values(scopeO));
    const env={VAPID_PRIVATE_KEY:'k',VAPID_PUBLIC_KEY:'K',VAPID_SUBJECT:'mailto:x@x'};
    const SIX=[
      ['themes_sent_to_client','themes'],
      ['theme_adjusted_by_team','themes'],
      ['themes_approved_by_client','themes'],
      ['final_content_sent_to_client','final'],
      ['final_adjusted_by_team','final'],
      ['final_approved_by_client','final'],
    ];
    for(const [evt,phase] of SIX){
      const task={id:'t-'+evt,clientReviewToken:'tokO_'+evt,clientPushSubs:[{endpoint:'https://fcm.googleapis.com/fcm/send/ABCDEFGH'+evt}]};
      const r=await OM.notifyWorkflowEvent(env,task,evt,{});
      const c=calls[calls.length-1];
      check('O_'+evt.toUpperCase(),evt+' → push REAL: phase='+phase+' + openUrl do MESMO link + tag=dedupKey + icon/badge ID Seven + sent=1',
        r.ok===true && r.eventType===evt && r.phase===phase && r.channel==='webpush' && r.sent===1 &&
        r.openUrl==='/cliente/cronograma/tokO_'+evt &&
        r.results.length===1 && r.results[0].ok===true && r.results[0].status===201 && /masked\(/.test(r.results[0].endpoint) &&
        c.payload.tag===('t-'+evt+'|'+evt+'|') && c.payload.eventType===evt && c.payload.taskId==='t-'+evt && c.payload.phase===phase &&
        c.payload.icon==='/og/idseven-logo.png' && c.payload.badge==='/og/idseven-badge.png' && c.opts.topic===evt);
    }
    // dedup: o MESMO evento na janela de 60s não dispara de novo (deduped:true, sem broadcast)
    const t2={id:'t-dedup',clientReviewToken:'tokD',clientPushSubs:[{endpoint:'https://e/1'}]};
    const before=calls.length;
    const r1=await OM.notifyWorkflowEvent(env,t2,'themes_sent_to_client',{});
    const r2=await OM.notifyWorkflowEvent(env,t2,'themes_sent_to_client',{});
    check('O_DEDUP_60S','dedup: 2º disparo do MESMO task|evento na janela → deduped:true, sem novo POST',
      r1.sent===1 && r2.deduped===true && calls.length===before+1);
    // eventos DIFERENTES da mesma task NÃO se bloqueiam (dedupKey inclui o evento)
    const r3=await OM.notifyWorkflowEvent(env,t2,'theme_adjusted_by_team',{});
    check('O_DEDUP_PER_EVENT','dedup é por EVENTO: evento diferente da mesma task dispara normalmente',r3.sent===1&&!r3.deduped);
    // sem subscription → fallback whatsapp_premium com reason verdadeiro (nunca mascarado como envio)
    const r4=await OM.notifyWorkflowEvent(env,{id:'t-nosub',clientReviewToken:'tokN',clientPushSubs:[]},'themes_sent_to_client',{});
    check('O_FALLBACK_SEM_SUB','sem subscription → sent=0 + fallback=whatsapp_premium + reason=sem_subscription',
      r4.sent===0 && r4.fallback==='whatsapp_premium' && r4.reason==='sem_subscription');
    // endpoint falha (410) com subscription presente → reason=send_failed (ERRO real, não 'sem_subscription')
    pushOk=false;
    const r5=await OM.notifyWorkflowEvent(env,{id:'t-fail',clientReviewToken:'tokF',clientPushSubs:[{endpoint:'https://e/2'}]},'final_approved_by_client',{});
    check('O_SEND_FAILED_HONESTO','endpoint falhou COM subscription → reason=send_failed + status real por endpoint (410/gone)',
      r5.sent===0 && r5.reason==='send_failed' && r5.fallback==='whatsapp_premium' && r5.results[0].gone===true && r5.results[0].status===410);
    pushOk=true;
  })();
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
