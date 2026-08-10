#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H12 — ESTADO DE APROVAÇÃO FINAL PREMATURO (suíte de CÓDIGO/contrato).
 *
 * P0 (1.0.237): após "Designer entregou" (workflowPhase=captions_preparation, bola de volta à
 * Social p/ legendas/posts) DUAS superfícies marcavam o ENVIO FINAL como já feito —
 * "Fluxo do cliente: Reenviado ao cliente" e timeline "Enviado para aprovação final — OK" —
 * (e uma 3ª: clientFacingStatusView "Versão final disponível"). CAUSA-RAIZ (reader/derivação):
 * o espelho legado clientFlowStatus='reenviado' é gravado na ENTREGA do designer e três leitores
 * o interpretavam como "2ª rodada enviada" SEM o portão canônico flowSentToClientSignal
 * (workflowPhase='captions_waiting_client').
 *
 * Correção (RENDERER-only): (1) taskTimeline resent=flowSentToClientSignal(t)||finalOk;
 * (2) helper clientFlowDisplayLabel(t) guardado (flowSummaryBlock); (3) clientFacingStatusView
 * guardado. clientCol NÃO alterado. THEMES (themes_waiting_client) != FINAL (captions_waiting_client).
 *
 * Esta suíte roda os leitores REAIS extraídos do index.html (com stubs mínimos p/ folhas de
 * setor/conclusão) nos 8 cenários do mandato — RED na base 1.0.237, GREEN na 1.0.238.
 *
 * Rodar: node desktop/scripts/f356ah12-final-state-premature.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH12_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH12_PKG || path.join(DESK, 'package.json'), 'utf8'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

function grabFn(SRC, name) {
  let a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  if (SRC.slice(a - 6, a) === 'async ') a -= 6;
  let d = 0;
  for (let j = SRC.indexOf('{', a); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
function grabDecl(SRC, marker) {
  const a = SRC.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  for (let j = a + marker.length; j < SRC.length; j++) { if (SRC[j] === ';') return SRC.slice(a, j + 1); }
  throw new Error('decl sem ; : ' + marker);
}

/* ---------- montar os leitores REAIS em ambiente com folhas stubadas ---------- */
// Folhas (plumbing de fixture): setor cliente, conclusão, presença de designer. NÃO são o alvo.
const STUBS = `
  function secOf(s){return {key:(s||'cronograma')};}
  function isClientSector(k){return k==='cronograma'||k==='roteiro';}
  function isFullyComplete(t){return !!(t.finalApprovalCompleted===true||t.clientFlowStatus==='concluido'||t.cronStatus==='aprovado_final');}
  function hasDesigner(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}
  function allPhaseItemsApproved(t){return !!t.__allApproved;}
  function operationalCol(t){return t.__opCol||'aguardando_legenda';}  // stub: nunca 'concluido' salvo fixture explícita
`;
let api = null, bootErr = null;
try {
  const SRC = [
    grabDecl(HTML, 'const CLIENT_COLS='),
    STUBS,
    grabFn(HTML, 'isTaskCompleted'),
    grabFn(HTML, 'flowCanonicalSentSignal'),
    grabFn(HTML, 'flowSentToClientSignal'),
    grabFn(HTML, 'clientCol'),
    grabFn(HTML, 'clientFlowDisplayLabel'),        // NOVO na 1.0.238 — ausente na base ⇒ RED
    grabFn(HTML, 'clientFacingStatusView'),
  ].join('\n');
  const RET = 'return {clientCol:clientCol, flowSentToClientSignal:flowSentToClientSignal, flowCanonicalSentSignal:flowCanonicalSentSignal, clientFlowDisplayLabel:clientFlowDisplayLabel, clientFacingStatusView:clientFacingStatusView, isTaskCompleted:isTaskCompleted};';
  api = new Function(SRC + '\n' + RET)();
} catch (e) { bootErr = e; }

// resent do taskTimeline reproduzido EXATAMENTE da fonte (const resent=flowSentToClientSignal(t)||finalOk;
// finalOk=!!(t.finalApprovalCompleted||cf==='concluido'||operationalCol(t)==='concluido')). A prova de que
// o código REAL usa esta expressão é o contrato estático S3/S3b abaixo.
function timelineFinalDone(t) {
  const cf = api.clientCol(t);
  const finalOk = !!(t.finalApprovalCompleted || cf === 'concluido' || (t.__opCol || 'aguardando_legenda') === 'concluido');
  return api.flowSentToClientSignal(t) || finalOk;
}

/* ============================ CENÁRIOS (fixtures canônicos) ============================ */
const F = {
  themesSent:      { workflowPhase: 'themes_waiting_client', clientFlowStatus: 'enviado' },
  themesApprovedProd: { workflowPhase: 'design_production', clientFlowStatus: 'producao', designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'andamento', __opCol: 'aguardando_designer' },
  delivered:       { workflowPhase: 'captions_preparation', clientFlowStatus: 'reenviado', designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'entregue', __opCol: 'aguardando_legenda' },
  finalSent:       { workflowPhase: 'captions_waiting_client', clientFlowStatus: 'reenviado', designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'entregue' },
  finalDone:       { finalApprovalCompleted: true, clientFlowStatus: 'concluido' },
};

if (bootErr) {
  // base 1.0.237: clientFlowDisplayLabel não existe ⇒ boot falha ⇒ todos os comportamentais FALHAM (RED limpo)
  for (const n of ['B1', 'B2', 'B3a', 'B3b', 'B4', 'B5', 'B6', 'B7', 'B8']) ok(n + ' (boot: ' + (bootErr.message || bootErr) + ')', false);
} else {
  /* B1 — themes_waiting_client → "Enviado ao cliente" OK, "Enviado para aprovação final" PENDENTE */
  ok('B1 themes_waiting_client: flowSentToClientSignal=false', api.flowSentToClientSignal(F.themesSent) === false);
  ok('B1 themes_waiting_client: envio final PENDENTE', timelineFinalDone(F.themesSent) === false);

  /* B2 — themes approved + designer produção → final PENDENTE */
  ok('B2 designer produção: flowSentToClientSignal=false', api.flowSentToClientSignal(F.themesApprovedProd) === false);
  ok('B2 designer produção: envio final PENDENTE', timelineFinalDone(F.themesApprovedProd) === false);

  /* B3 — designerDelivered + captions_preparation → aguardando legendas; final PENDENTE; Fluxo NÃO "Reenviado" */
  ok('B3a delivered/captions_preparation: clientCol=reenviado (espelho)', api.clientCol(F.delivered) === 'reenviado');
  ok('B3a delivered/captions_preparation: flowSentToClientSignal=false', api.flowSentToClientSignal(F.delivered) === false);
  ok('B3a delivered/captions_preparation: envio final PENDENTE', timelineFinalDone(F.delivered) === false);
  ok('B3a delivered: Fluxo do cliente NÃO é "Reenviado ao cliente"', api.clientFlowDisplayLabel(F.delivered).label !== 'Reenviado ao cliente');
  ok('B3a delivered: Fluxo do cliente = "Aguardando envio final"', api.clientFlowDisplayLabel(F.delivered).label === 'Aguardando envio final');
  ok('B3b delivered: clientFacingStatusView NÃO diz "Versão final disponível"', api.clientFacingStatusView(F.delivered).label.indexOf('Versão final disponível') < 0);
  ok('B3b delivered: clientFacingStatusView = "A equipe está finalizando as artes"', api.clientFacingStatusView(F.delivered).label === 'A equipe está finalizando as artes');

  /* B4 — clientFlowStatus='reenviado' + captions_preparation → NÃO marca envio final */
  ok('B4 reenviado+captions_preparation: NÃO marca envio final', timelineFinalDone(F.delivered) === false);

  /* B5 — clientFlowStatus='reenviado' + captions_waiting_client → envio final OK */
  ok('B5 reenviado+captions_waiting_client: flowSentToClientSignal=true', api.flowSentToClientSignal(F.finalSent) === true);
  ok('B5 reenviado+captions_waiting_client: envio final OK', timelineFinalDone(F.finalSent) === true);

  /* B6 — captions_waiting_client → Fluxo do cliente = "Reenviado ao cliente" */
  ok('B6 captions_waiting_client: Fluxo do cliente = "Reenviado ao cliente"', api.clientFlowDisplayLabel(F.finalSent).label === 'Reenviado ao cliente');
  ok('B6 captions_waiting_client: clientFacingStatusView = "Versão final disponível para análise"', api.clientFacingStatusView(F.finalSent).label === 'Versão final disponível para análise');

  /* B7 — finalApprovalCompleted → envio final permanece OK + concluído */
  ok('B7 finalApprovalCompleted: clientCol=concluido', api.clientCol(F.finalDone) === 'concluido');
  ok('B7 finalApprovalCompleted: envio final OK', timelineFinalDone(F.finalDone) === true);

  /* B8 — legado (sem workflowPhase): compat preservada pelo SINAL CANÔNICO legado (cronStatus
     ready_for_final_client_review / clientApprovalPhase='final' — gravados pelo re-envio FINAL em
     9162/9166/10008), NUNCA por token/link nem por clientFlowStatus='reenviado' sozinho (entrega). */
  const legacyFinalSent = { clientFlowStatus: 'reenviado', cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final' };
  ok('B8 legado final-enviado (cronStatus): flowSentToClientSignal=true (compat preservada)', api.flowSentToClientSignal(legacyFinalSent) === true);
  ok('B8 legado final-enviado: envio final OK', timelineFinalDone(legacyFinalSent) === true);
  const legacyDeliveredOnly = { clientFlowStatus: 'reenviado' };   // entrega do designer legada, SEM envio final
  ok('B8b legado só-entregue (reenviado sozinho): envio final PENDENTE (contrato: espelho ≠ envio)', timelineFinalDone(legacyDeliveredOnly) === false);
  const tokenOnly = { clientReviewToken: 'tok_x', shareToken: 'sh_x' };   // link ≠ envio
  ok('B8c token/link só: flowSentToClientSignal=false (link ≠ envio final)', api.flowSentToClientSignal(tokenOnly) === false);
}

/* ============================ CONTRATO ESTÁTICO (RED→GREEN + segurança) ============================ */
ok('S0 package.json = 1.0.240', PKG.version === '1.0.240');
ok('S0 description marca H12 final-state-premature-fix', /f356ah12-final-state-premature-fix/i.test(PKG.description || ''));
// timeline: resent usa o portão canônico, NÃO o espelho cru
ok('S3 taskTimeline resent = flowSentToClientSignal(t)||finalOk', /const resent=flowSentToClientSignal\(t\)\|\|finalOk;/.test(HTML));
ok('S3b timeline NÃO usa mais resent=(cf===\'reenviado\'||cf===\'concluido\')', !/const resent=\(cf==='reenviado'\|\|cf==='concluido'\);/.test(HTML));
// helper guardado
ok('S4 clientFlowDisplayLabel existe e é guardado por flowSentToClientSignal', /function clientFlowDisplayLabel\(t\)\{[\s\S]*?col==='reenviado'&&!flowSentToClientSignal\(t\)/.test(HTML));
ok('S4b clientFlowDisplayLabel mostra "Aguardando envio final" sem envio', /col==='reenviado'&&!flowSentToClientSignal\(t\)\) return \{key:'aguardando_envio_final',label:'Aguardando envio final'/.test(HTML));
ok('S5 flowSummaryBlock usa clientFlowDisplayLabel (não CLIENT_COLS cru)', /const cc=clientFlowDisplayLabel\(t\);/.test(HTML));
// clientFacingStatusView guardado
ok('S6 clientFacingStatusView guarda reenviado por flowSentToClientSignal', /if\(c==='reenviado'\)return flowSentToClientSignal\(t\)\s*\?\{key:'final'/.test(HTML));
// NÃO alterar clientCol globalmente: o produtor segue devolvendo o valor do espelho
ok('S7 clientCol INALTERADO (segue devolvendo v do espelho quando em CLIENT_COLS)', /if\(CLIENT_COLS\.some\(c=>c\.key===v\)\)\{[\s\S]*?return v;/.test(HTML));
// writers INTOCADOS (o espelho continua sendo gravado na entrega — é a semântica legada)
ok('S8 writer da entrega do designer intocado (clientFlowStatus=reenviado)', /newStatus==='entregue'\|\|newStatus==='concluido'\)patch\.clientFlowStatus='reenviado';/.test(HTML));
// não-regressão: gate canônico e o marco de TEMAS (H8) preservados
ok('S9 flowSentToClientSignal canônico intacto (captions_waiting_client)', /function flowSentToClientSignal\(t\)\{[\s\S]*?wp==='captions_waiting_client'\)return true;/.test(HTML));
ok('S10 H8 timeline honesta do 1º envio preservada (flowCanonicalSentSignal)', /const sent=flowCanonicalSentSignal\(t\)\|\|\(cf!=='afazer'\)/.test(HTML));
ok('S11 slaRules.js NÃO precisa (timeline/labels do cliente só no renderer): marcador 1.0.228 na descrição', /1\.0\.228/.test(PKG.description || ''));

/* ---------- resumo ---------- */
console.log('\n================= F3.5.6A-H12 — ESTADO FINAL PREMATURO =================');
if (flog.length) console.log(flog.join('\n'));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
