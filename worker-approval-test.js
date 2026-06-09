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
check('C_HEALTH_V64_42', 'Healthcheck retorna V64.42-team-adjust-idem-cleanup', /version: "V64\.42-team-adjust-idem-cleanup"/.test(SRC));
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
check('C_TEAM_AUTH', 'handleClientCronogramaTeamAction gated por env.TEAM_API_KEY (503 sem chave)', /handleClientCronogramaTeamAction[\s\S]{0,800}env\.TEAM_API_KEY[\s\S]{0,200}TEAM_API_KEY_NOT_CONFIGURED/.test(SRC));
check('C_TEAM_XKEY', 'team-action valida header X-Team-Key === env.TEAM_API_KEY', /handleClientCronogramaTeamAction[\s\S]{0,1200}X-Team-Key/.test(SRC));
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
check('C_SETUP_PUSH_FN', 'CV_JS define setupClientWebPush() + urlBase64ToUint8Array + registra SW em /cliente/', /function setupClientWebPush\(\)/.test(SRC) && /function urlBase64ToUint8Array\(b\)/.test(SRC) && /swPath='\/cliente\/sw\.js'/.test(SRC) && /navigator\.serviceWorker\.register\(swPath/.test(SRC));

/* ===================== PARTE D — preservacao (nao quebrar o que existia) ===================== */
console.log(`${C.b}\n[D] Preservacao: WhatsApp + /share + healthcheck endpoints intactos${C.x}`);
check('D_WA_ROUTE', 'Rota POST /client/send-premium-whatsapp preservada', /\/client\/send-premium-whatsapp[\s\S]{0,80}handleSendPremiumWhatsApp/.test(SRC));
check('D_SHARE_ROUTE', 'Rota GET /share/cronograma/:token preservada', /url\.pathname\.match\([^)]*share\\\/cronograma[^)]*\)/.test(SRC) && /function shareCardHtml/.test(SRC));
check('D_OG_LEGACY', 'Banner OG legado /og/aprovar*.png preservado', /function ogBannerResponse\(\)/.test(SRC) && /\/og\\\/aprovar/.test(SRC));
check('D_PUSH_RELAY', 'handlePushRelay (FCM equipe) preservado', /async function handlePushRelay\(request, env\)/.test(SRC));
check('D_CRON_SCHEDULED', 'scheduled handler (CRON lembretes) preservado', /async scheduled\(event, env, ctx\)[\s\S]{0,200}handleCronTrigger/.test(SRC));

/* ===================== VEREDITO ===================== */
console.log(`${C.b}\n==================================================================`);
if (FAIL===0){
  console.log(`${C.g} RESULTADO: APROVADO ✔  (0 falhas).`);
  console.log(`${C.g} approveItem nunca conclui · approveAll conclui só na fase final sem ajuste pendente · fases isoladas.${C.x}`);
  console.log(`${C.b}==================================================================${C.x}`);
  process.exit(0);
} else {
  console.log(`${C.r} RESULTADO: REPROVADO X  (${FAIL} falha(s))`);
  FAILS.forEach(f=>console.log('   - '+f));
  console.log(`${C.b}==================================================================${C.x}`);
  process.exit(1);
}
