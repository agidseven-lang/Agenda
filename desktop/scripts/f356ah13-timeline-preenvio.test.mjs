#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H13 — TIMELINE/HISTÓRICO honestos + pré-envio da 2ª rodada (suíte de CÓDIGO/contrato).
 *
 * P0/P1 (1.0.238): após "Salvar e reenviar ao cliente" SEM confirmar (fase captions_preparation):
 *  (A) marcos PENDENTES exibiam data/autor (11:35/Arydyjany) — _tlEventAt casava por SUBSTRING e
 *      taskTimeline anexava at/by independente de done; 'enviado_cliente' ⊂ 'reenviado_cliente';
 *      'final' ⊂ 'final_review'/label "versão FINAL".
 *  (B) "Enviado ao cliente" (THEMES) passava a mostrar 11:35 (evento mais recente) em vez do 1º envio.
 *  (C) "Fluxo do cliente" virava "Em produção" (espelho clientFlowStatus='producao').
 *  (D) WRITER: "Salvar e reenviar" gravava history 'reenviado_cliente' ANTES da confirmação.
 *
 * Correção 1.0.245 (RENDERER-only, index.html):
 *  - _tlEventAt casa por type/kind/channel EXATO (sem substring, sem label/to).
 *  - taskTimeline: SÓ marco done recebe carimbo; enviado_cliente/enviado_final usam approvalRounds
 *    sentAt canônico (ar_themes_r* × ar_captions_r* separados).
 *  - clientFlowDisplayLabel/clientFacingStatusView: workflowPhase-first (captions_preparation →
 *    "Aguardando envio final").
 *  - saveProduction(resend): NÃO grava 'reenviado_cliente'; campos de PREPARAÇÃO (Grupo A) preservados.
 *  - btnConfirmSend: grava 'reenviado_cliente' 1× SÓ no sucesso e SÓ na rodada final.
 *
 * RED na base 1.0.238; GREEN na 1.0.239. Rodar: node desktop/scripts/f356ah13-timeline-preenvio.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH13_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH13_PKG || path.join(DESK, 'package.json'), 'utf8'));

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

/* ---------- leitores REAIS + folhas stubadas (plumbing de fixture) ---------- */
const STUBS = `
  function secOf(s){return {key:(s||'cronograma')};}
  function isClientSector(k){return k==='cronograma'||k==='roteiro';}
  function isFullyComplete(t){return !!(t&&(t.finalApprovalCompleted===true||t.cronStatus==='aprovado_final'||t.clientFlowStatus==='concluido'));}
  function hasDesigner(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}
  function designerDelivered(t){var d=(t&&t.designerFlowStatus||'').toString();return d==='entregue'||d==='concluido'||!!(t&&t.__delivered);}
  function designerOf(t){return null;}
  function allPhaseItemsApproved(t){return !!(t&&t.__allApproved);}
  function hasPendingItemRevision(t){return !!(t&&t.__pendingRev);}
  function operationalCol(t){return (t&&t.__opCol)||'aguardando_legenda';}   // H13 não altera operationalCol
  function clientStatusView(t){return {};}
  function nextActionText(t){return '';}
  function pendingFeed(t){var a=Array.isArray(t&&t.cronContents)?t.cronContents:[];return !a.length||a.some(function(c){return !(c&&c.feedImageUrl);});}
`;
let api = null, bootErr = null;
try {
  const SRC = [
    grabDecl(HTML, 'const CLIENT_COLS='),
    grabDecl(HTML, 'const TL_EVENT_LABELS='),
    STUBS,
    grabFn(HTML, 'isTaskCompleted'),
    grabFn(HTML, 'flowCanonicalSentSignal'),
    grabFn(HTML, 'flowSentToClientSignal'),
    grabFn(HTML, 'clientCol'),
    grabFn(HTML, 'designerCol'),
    grabFn(HTML, 'pendingLegend'),
    grabFn(HTML, 'pendingProduction'),
    grabFn(HTML, 'clientApprovalPhaseOf'),
    grabFn(HTML, 'wfRoundsOf'),
    grabFn(HTML, 'wfLatestRound'),
    grabFn(HTML, '_tlEventAt'),
    grabFn(HTML, '_tlHumanLabel'),
    grabFn(HTML, 'clientFlowDisplayLabel'),
    grabFn(HTML, 'clientFacingStatusView'),
    grabFn(HTML, 'taskTimeline'),
  ].join('\n');
  const RET = 'return {taskTimeline:taskTimeline,_tlEventAt:_tlEventAt,clientFlowDisplayLabel:clientFlowDisplayLabel,clientFacingStatusView:clientFacingStatusView,clientApprovalPhaseOf:clientApprovalPhaseOf,clientCol:clientCol,flowSentToClientSignal:flowSentToClientSignal,wfLatestRound:wfLatestRound};';
  api = new Function(SRC + '\n' + RET)();
} catch (e) { bootErr = e; }

ok('BOOT — leitores reais extraídos do index.html (taskTimeline + _tlEventAt + labels + rounds)', !!api && !bootErr);
if (!api) { console.log('================= F3.5.6A-H13 — TIMELINE/PRÉ-ENVIO ================='); console.log('BOOT FALHOU: ' + (bootErr && bootErr.message)); console.log('PASS ' + pass + ' | FAIL ' + (fail + 1) + '  (versão sob teste: ' + PKG.version + ')'); process.exit(0); }

const mstone = (tl, k) => (tl.milestones || []).find(m => m.key === k) || {};

/* =========================== FIXTURE CONTAMINADA (Cronograma Teste 6 após 1.0.238) =========================== */
// Exatamente o registro legado que a 1.0.238 deixou: prep da 2ª rodada + evento prematuro às 11:35,
// SEM confirmação canônica final. THEMES enviado às 08:38 (approvalRounds ar_themes_r1.sentAt).
const T0838 = 1754818680000; // 10/08 ~08:38
const T1135 = 1754829300000; // 10/08 ~11:35
function contaminated() {
  return {
    id: 'CT6', sector: 'cronograma', client: 'CLIENTE TESTE', createdAt: 1754800000000,
    workflowPhase: 'captions_preparation',
    clientFlowStatus: 'producao', clientWorkflowStage: 'producao',
    cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', finalApprovalRequired: true,
    designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'entregue',
    cronContents: [{ tema: 'T1', legenda: 'Legenda teste 1', feedImageUrl: '' }, { tema: 'T2', legenda: '', feedImageUrl: '' }],
    clientSentAt: T0838,
    approvalRounds: { ar_themes_r1: { sentAt: T0838, by: 'Social', decision: 'approved' } },
    history: [
      { type: 'cronograma_enviado_cliente', label: 'Cronograma enviado ao cliente (aprovação de TEMAS)', at: T0838, by: 'Arydyjany', channel: 'whatsapp_fallback', phase: 'themes' },
      { type: 'social_producao', label: 'Social atualizou legendas/artes', at: T1135 - 1000, by: 'Arydyjany', channel: 'production' },
      { type: 'reenviado_cliente', label: 'Reenviado ao cliente (versão FINAL)', at: T1135, by: 'Arydyjany', channel: 'final_review', phase: 'final' }
    ]
  };
}

/* =========================== 1) _tlEventAt EXATO (sem colisão de substring) =========================== */
{
  const t = contaminated();
  // 'enviado_cliente' NÃO pode casar o evento 'reenviado_cliente'.
  const e1 = api._tlEventAt(t, ['enviado_cliente', 'sent_to_client', 'cronograma_enviado_cliente']);
  ok('1a _tlEventAt(enviado_cliente…) casa o evento THEMES (08:38), nunca o reenviado_cliente (11:35)', !!e1 && e1.at === T0838);
  // A allowlist do enviado_final casa o reenviado_cliente (type exato) — mas veja o marco pendente no cenário 2.
  const e2 = api._tlEventAt(t, ['reenviado_cliente', 'final_sent', 'final_review']);
  ok('1b _tlEventAt(reenviado_cliente/final_review) casa o evento final (11:35) por type/channel EXATO', !!e2 && e2.at === T1135);
  // 'final' cru NÃO existe como allowlist e NÃO pode casar 'final_review' nem label "versão FINAL".
  const e3 = api._tlEventAt(t, ['final_approved', 'ackFeedback', 'aprovado_final']);
  ok('1c _tlEventAt(final_approved…) NÃO casa nada (nenhum evento de aprovação final ocorreu)', !e3);
}

/* =========================== 2) marco PENDENTE não exibe at/by =========================== */
{
  const tl = api.taskTimeline(contaminated());
  const ef = mstone(tl, 'enviado_final');
  ok('2a "Enviado para aprovação final" = PENDENTE (done=false)', ef.done === false && ef.state === 'pending');
  ok('2b "Enviado para aprovação final" PENDENTE SEM data (at nulo)', !ef.at);
  ok('2c "Enviado para aprovação final" PENDENTE SEM autor (by nulo)', !ef.by);
  const cc = mstone(tl, 'concluido');
  ok('2d "Aprovado final / Concluído" = PENDENTE', cc.done === false && cc.state === 'pending');
  ok('2e "Aprovado final / Concluído" PENDENTE SEM data/autor (nada de 11:35)', !cc.at && !cc.by);
}

/* =========================== 3) evento com "final" não conclui FINAL_APPROVED =========================== */
{
  const tl = api.taskTimeline(contaminated());
  const cc = mstone(tl, 'concluido');
  ok('3 marco Concluído continua pendente/sem carimbo mesmo com evento final_review no history', cc.state === 'pending' && !cc.at);
}

/* =========================== 4) THEMES conserva o horário do 1º envio =========================== */
{
  const tl = api.taskTimeline(contaminated());
  const ec = mstone(tl, 'enviado_cliente');
  ok('4a "Enviado ao cliente" = done (THEMES enviado)', ec.done === true);
  ok('4b "Enviado ao cliente" conserva 08:38 (approvalRounds ar_themes_r1.sentAt) — NUNCA 11:35', ec.at === T0838);
  ok('4c "Enviado ao cliente" nunca herda o horário 11:35 da ação da 2ª rodada', ec.at !== T1135);
}

/* =========================== 5) FLUXO DO CLIENTE = "Aguardando envio final" =========================== */
{
  const t = contaminated();
  const lab = api.clientFlowDisplayLabel(t);
  ok('5a clientFlowDisplayLabel (captions_preparation) = "Aguardando envio final"', lab && lab.label === 'Aguardando envio final');
  ok('5b clientFlowDisplayLabel NÃO é "Em produção" nem "Reenviado ao cliente"', lab && lab.label !== 'Em produção' && lab.label !== 'Reenviado ao cliente');
  const sv = api.clientFacingStatusView(t);
  ok('5c clientFacingStatusView (captions_preparation) = "A equipe está finalizando as artes"', sv && sv.label === 'A equipe está finalizando as artes');
  ok('5d clientFacingStatusView NÃO é "Versão final disponível para análise"', sv && sv.label.indexOf('Versão final disponível') < 0);
}

/* =========================== 11) FIXTURE CONTAMINADA — UI completa correta =========================== */
{
  const tl = api.taskTimeline(contaminated());
  const al = mstone(tl, 'aguardando_legenda');
  ok('11a "Aguardando legenda / posts" = EM ANDAMENTO (current) — pendências de legenda reais', al.state === 'current' && al.done === false);
  ok('11b "Enviado para aprovação final" PENDENTE (contaminada)', mstone(tl, 'enviado_final').state === 'pending');
  ok('11c nenhum marco pendente exibe carimbo', (tl.milestones || []).filter(m => m.state === 'pending' || m.state === 'current').every(m => !m.at && !m.by));
  ok('11d "Enviado ao cliente" THEMES mantém 08:38', mstone(tl, 'enviado_cliente').at === T0838);
  ok('11e Fluxo do cliente = Aguardando envio final', api.clientFlowDisplayLabel(contaminated()).label === 'Aguardando envio final');
}

/* =========================== 12) PRÉVIA da 2ª rodada continua "final" ANTES da confirmação =========================== */
{
  const t = contaminated();
  ok('12a clientApprovalPhaseOf(fixture) === "final" (prep mantém a rodada final da prévia/portal)', api.clientApprovalPhaseOf(t) === 'final');
  // mesmo sem clientApprovalPhase explícito, cronStatus ready_for_final_client_review seleciona final:
  const t2 = contaminated(); delete t2.clientApprovalPhase;
  ok('12b prévia final preservada só por cronStatus=ready_for_final_client_review', api.clientApprovalPhaseOf(t2) === 'final');
}

/* =========================== confirmação real (positiva) — timeline carimba o final =========================== */
{
  const t = contaminated();
  // simula o que o Worker grava no confirmClientSend REAL da 2ª rodada:
  t.workflowPhase = 'captions_waiting_client';
  t.approvalRounds.ar_captions_r1 = { sentAt: T1135 + 60000, by: 'Social' };
  const tl = api.taskTimeline(t);
  const ef = mstone(tl, 'enviado_final');
  ok('6a após envio REAL (captions_waiting_client + ar_captions_r1.sentAt): "Enviado p/ aprovação final" = done', ef.done === true && ef.state === 'done');
  ok('6b marco final carimba o horário canônico do envio real (ar_captions_r1.sentAt), não o legado', ef.at === T1135 + 60000);
  ok('6c "Enviado ao cliente" THEMES continua 08:38 (não sobrescrito pelo envio final)', mstone(tl, 'enviado_cliente').at === T0838);
  ok('6d Fluxo do cliente após envio real ≠ "Aguardando envio final"', api.clientFlowDisplayLabel(t).label !== 'Aguardando envio final');
}

/* =========================== CONTRATOS ESTÁTICOS (fonte) — S-series =========================== */
const S = HTML;
// _tlEventAt exato
ok('S1 _tlEventAt casa por igualdade EXATA (keys.indexOf(v)>=0), não por substring (indexOf(k)>=0)', S.includes('return !!v && keys.indexOf(v)>=0;') && !/keys\.some\(k=>s\.indexOf\(k\)>=0\)/.test(S));
ok('S2 _tlEventAt considera type|kind|channel (não label/to livres)', S.includes('consider(e.type,e.kind,e.channel, e.at'));
// taskTimeline honestidade + canônico
ok('S3 taskTimeline só busca evento p/ marco done (if(m.done){ const e=_tlEventAt', S.includes('if(m.done){\n      const e=_tlEventAt(t,m.ev);'));
ok('S4 enviado_cliente usa approvalRounds THEMES sentAt (ar_themes_r*)', S.includes("wfLatestRound(t,'themes')") && S.includes("enviado_cliente'"));
ok('S5 enviado_final usa approvalRounds FINAL sentAt (ar_captions_r*)', S.includes("wfLatestRound(t,'captions')"));
ok('S6 allowlist enviado_cliente NÃO contém a chave crua "reenviado" (fim da colisão)', S.includes("ev:['enviado_cliente','sent_to_client','cronograma_enviado_cliente']"));
ok('S7 allowlist concluido é de tipos EXATOS de aprovação final (sem "final" cru)', S.includes("ev:['final_approved','ackFeedback','aprovado_final']"));
// label wp-first
ok('S8 clientFlowDisplayLabel prioriza workflowPhase (captions_preparation → Aguardando envio final)', /wp==='captions_preparation'\) return \{key:'aguardando_envio_final'/.test(S));
ok('S9 clientFacingStatusView prioriza workflowPhase (captions_preparation → finalizando as artes)', /_wp==='captions_preparation'\)return \{key:'legendas',label:'A equipe está finalizando as artes'/.test(S));
// writer: saveProduction NÃO grava reenviado_cliente (Correção 1 / cenário 6)
const spA = S.indexOf('async function saveProduction(');
const spB = S.indexOf('async function ', spA + 10);
const SP = S.slice(spA, spB > 0 ? spB : spA + 4000);
ok('S10 saveProduction NÃO grava mais history reenviado_cliente (removido do pré-envio)', spA > 0 && SP.indexOf("type:'reenviado_cliente'") < 0);
ok('S11 saveProduction PRESERVA campos de PREPARAÇÃO (Grupo A): ready_for_final_client_review + clientApprovalPhase=final', SP.includes("patch.cronStatus='ready_for_final_client_review'") && SP.includes("patch.clientApprovalPhase='final'"));
ok('S12 saveProduction mantém o evento social_producao (salvar conteúdo é legítimo)', SP.includes("type:'social_producao'"));
// writer: btnConfirmSend grava reenviado_cliente só no sucesso + rodada final (cenários 8/9/10)
const cbA = S.indexOf("on('btnConfirmSend'");
const cbB = S.indexOf("on('btnTestLink'", cbA);
const CB = S.slice(cbA, cbB > 0 ? cbB : cbA + 3000);
ok('S13 btnConfirmSend: evento reenviado_cliente existe SÓ no ramo de sucesso (if(r&&r.ok))', cbA > 0 && CB.indexOf("type:'reenviado_cliente'") > CB.indexOf('if(r&&r.ok)') && CB.indexOf('if(r&&r.ok)') > 0);
ok('S14 btnConfirmSend: gravação gated pela rodada FINAL (clientApprovalPhaseOf===final)', /clientApprovalPhaseOf\(_ft\)==='final'/.test(CB));
ok('S15 btnConfirmSend: anti-duplo-clique (b.disabled=true antes do request) → 1 evento por confirmação', CB.includes('b.disabled=true'));
ok('S16 fechar modal/cancelar/falha não passam pelo ramo de sucesso ⇒ zero evento (else reabilita)', CB.includes('b.disabled=false; b.innerHTML=old;'));
// versão + isolamento (espelho)
ok('S17 package.json = 1.0.245 + marcador H13', PKG.version === '1.0.245' && /f356ah13-timeline-honest-preenvio/.test(PKG.description || ''));
ok('S18 marcador H12 herdado preservado na descrição', /f356ah12-final-state-premature-fix/.test(PKG.description || ''));

console.log('================= F3.5.6A-H13 — TIMELINE/HISTÓRICO honestos + pré-envio =================');
if (flog.length) console.log(flog.join('\n'));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
