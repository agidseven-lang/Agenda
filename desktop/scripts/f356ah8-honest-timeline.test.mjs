#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H8 (ESCOPO B) — TIMELINE HONESTA (suíte de CÓDIGO/contrato).
 *
 * P0 (1.0.235 reprovada): a timeline "Detalhes do fluxo" (e a mini-timeline do card) —
 * ambas de taskTimeline(t) — marcavam o marco "Enviado ao cliente" como CONCLUÍDO apenas
 * por existir clientReviewToken/shareToken (o LINK), divergindo do card/detalhe/Central.
 * Causa PROVADA (auditoria H7): sent=(cf!=='afazer')||!!(clientSentBy||clientReviewToken||
 * shareToken) — o disjunto do token disparava mesmo com clientCol='afazer'.
 *
 * Correção (RENDERER, taskTimeline): o marco "Enviado ao cliente" passa a usar a MESMA
 * verdade canônica das outras superfícies — flowCanonicalSentSignal(t)||(clientCol(t)!=='afazer')
 * — REMOVENDO clientReviewToken/shareToken/clientSentBy como prova de envio (GERAR LINK ≠ ENVIAR).
 *
 * Esta suíte PROVA o contrato (RED→GREEN): a fórmula ANTIGA marcaria B2/B3/B4 como enviado
 * (RED); a taskTimeline corrigida NÃO marca até haver envio canônico (B6) ou tarefa legada (B7);
 * preserva a cumulatividade (produção/aprovado/concluído seguem com o marco "enviado" concluído).
 *
 * Rodar: node desktop/scripts/f356ah8-honest-timeline.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH8_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const SLARULES = process.env.F356AH8_SLARULES || path.join(DESK, 'src', 'main', 'slaRules.js');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH8_PKG || path.join(DESK, 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.join(DESK, 'package-lock.json'), 'utf8'));
const rules = require(path.resolve(SLARULES));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

function grabFn(SRC, name) {
  const a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  let d = 0;
  for (let j = SRC.indexOf('{', a); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
function grabDecl(SRC, marker) {
  const a = SRC.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  let round = 0, sq = 0, cur = 0;
  for (let j = a + marker.length; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '(') round++; else if (c === ')') round--;
    else if (c === '[') sq++; else if (c === ']') sq--;
    else if (c === '{') cur++; else if (c === '}') cur--;
    else if (c === ';' && round === 0 && sq === 0 && cur === 0) return SRC.slice(a, j + 1);
  }
  throw new Error('decl sem ; : ' + marker);
}

/* ---------- A. IDENTIDADE / VERSÃO ---------- */
ok('A1 package.json 1.0.240', PKG.version === '1.0.240');
ok('A2 package-lock 1.0.240 (raiz + packages[""])', LOCK.version === '1.0.240' && LOCK.packages[''].version === '1.0.240');
ok('A3 description marca H8 (durable-diag-honest-timeline)', /durable-diag-honest-timeline/i.test(PKG.description || ''));

/* ---------- B. ESTRUTURA DA CORREÇÃO (renderer taskTimeline) ---------- */
const tlFn = grabFn(HTML, 'taskTimeline');
ok('B-struct1 taskTimeline usa flowCanonicalSentSignal p/ o marco "enviado"', /const sent=flowCanonicalSentSignal\(t\)/.test(tlFn));
ok('B-struct2 taskTimeline NÃO trata token/shareToken/clientSentBy como envio', !/const sent=[^\n]*clientReviewToken/.test(tlFn) && !/const sent=[^\n]*shareToken/.test(tlFn) && !/const sent=[^\n]*clientSentBy/.test(tlFn));
ok('B-struct3 marco enviado_cliente segue amarrado a !!sent', /key:'enviado_cliente'[^\n]*done:!!sent/.test(tlFn));

/* ---------- C. CONTRATO COMPORTAMENTAL (taskTimeline REAL em vm) ---------- */
const SRC = [
  grabDecl(HTML, 'const SECTORS='), grabDecl(HTML, 'const SECTOR_ALIAS='), grabDecl(HTML, 'const STATUS='),
  grabDecl(HTML, 'const CLIENT_COLS='), grabDecl(HTML, 'const OPERATIONAL_COLS='), grabDecl(HTML, 'const TL_EVENT_LABELS='),
  grabDecl(HTML, 'const TASK_PHASE='), grabDecl(HTML, 'const FLOW_LABELS='),
  grabFn(HTML, 'secOf'), grabFn(HTML, 'isClientSector'), grabFn(HTML, 'stOf'), grabFn(HTML, 'opColOf'),
  grabFn(HTML, 'isTaskCompleted'), grabFn(HTML, 'isFullyComplete'), grabFn(HTML, 'hasDesigner'),
  grabFn(HTML, 'designerCol'), grabFn(HTML, 'designerDelivered'), grabFn(HTML, 'designerOf'), grabFn(HTML, 'socialOf'),
  grabFn(HTML, 'pendingLegend'), grabFn(HTML, 'pendingFeed'), grabFn(HTML, 'pendingStory'), grabFn(HTML, 'pendingProduction'),
  grabFn(HTML, 'clientApprovalPhaseOf'), grabFn(HTML, 'pendingClientItems'), grabFn(HTML, 'hasPendingItemRevision'),
  grabFn(HTML, 'allPhaseItemsApproved'), grabFn(HTML, 'clientApproved'),
  grabFn(HTML, 'flowCompletedSignal'), grabFn(HTML, 'flowSentToClientSignal'), grabFn(HTML, 'flowClientChangesSignal'),
  grabFn(HTML, 'flowThemesApprovedSignal'), grabFn(HTML, 'flowCanonicalSentSignal'), grabFn(HTML, 'flowThemesSentSignal'),
  grabFn(HTML, 'flowThemesReadySignal'),
  grabFn(HTML, 'clientCol'), grabFn(HTML, 'operationalCol'), grabFn(HTML, 'clientStatusView'), grabFn(HTML, 'nextActionText'),
  // F3.5.6A-H13: taskTimeline passou a resolver o carimbo canônico dos marcos "enviado" via approvalRounds
  // (ar_themes_r* × ar_captions_r*); o sandbox precisa fornecer essas leaves puras (sem mudar contrato).
  grabFn(HTML, 'wfRoundsOf'), grabFn(HTML, 'wfLatestRound'),
  grabFn(HTML, '_tlEventAt'), grabFn(HTML, '_tlHumanLabel'), grabFn(HTML, 'taskTimeline'),
].join('\n');
const R = new Function('var state={users:[]};\n' + SRC + '\nreturn { tl: taskTimeline, clientCol: clientCol, canon: flowCanonicalSentSignal };')();
const sentDone = (t) => { const m = R.tl(t).milestones.find(x => x.key === 'enviado_cliente'); return !!(m && m.done); };
// fórmula ANTIGA (a que existia na 1.0.235) — só p/ PROVAR o RED
const oldSent = (t) => (R.clientCol(t) !== 'afazer') || !!(t.clientSentBy || t.clientReviewToken || t.shareToken);

const base = { sector: 'cronograma', status: 'andamento', title: 'Cronograma Teste 5', client: 'CLIENTE TESTE', cronContents: [{ tema: 'Tema teste 1' }] };
/* B1 — recém-criada (sem link, sem envio) */
const b1 = { ...base, id: 'b1', workflowPhase: 'themes_preparation' };
ok('B1 recém-criada: "Enviado ao cliente" NÃO concluído', sentDone(b1) === false);
/* B2 — link gerado (clientReviewToken); workflowPhase presente (tarefa nova) mas NÃO de espera */
const b2 = { ...base, id: 'b2', workflowPhase: 'themes_preparation', clientReviewToken: 'tok_x' };
ok('B2 [RED→GREEN] link gerado: "Enviado ao cliente" NÃO concluído', sentDone(b2) === false);
ok('B2 RED: a fórmula ANTIGA marcaria enviado (prova do defeito)', oldSent(b2) === true);
/* B3 — copiar mensagem (marca clientSentBy no preparo) — ainda NÃO enviado */
const b3 = { ...base, id: 'b3', workflowPhase: 'themes_preparation', clientReviewToken: 'tok_x', shareToken: 'sh_x', clientSentBy: 'u_social' };
ok('B3 [RED→GREEN] copiar mensagem: "Enviado ao cliente" NÃO concluído', sentDone(b3) === false);
ok('B3 RED: fórmula ANTIGA marcaria enviado', oldSent(b3) === true);
/* B4 — WhatsApp aberto (sem confirmar) */
const b4 = { ...base, id: 'b4', workflowPhase: 'themes_preparation', clientReviewToken: 'tok_x', shareToken: 'sh_x', clientSentBy: 'u_social' };
ok('B4 WhatsApp aberto: "Enviado ao cliente" NÃO concluído', sentDone(b4) === false);
/* B5 — falha ao confirmar: estado idêntico ao B2 (fail-safe: nada gravado) */
const b5 = { ...base, id: 'b5', workflowPhase: 'themes_preparation', clientReviewToken: 'tok_x' };
ok('B5 falha ao confirmar (fail-safe): "Enviado ao cliente" NÃO concluído', sentDone(b5) === false);
/* B6 — CONFIRMAÇÃO CANÔNICA bem-sucedida (workflowPhase de espera que só o Worker grava) */
const b6 = { ...base, id: 'b6', clientReviewToken: 'tok_x', workflowPhase: 'themes_waiting_client', externalWait: true, clientFlowStatus: 'enviado', cronStatus: 'enviado_cliente', clientSentAt: 1 };
ok('B6 confirmação canônica: "Enviado ao cliente" CONCLUÍDO', sentDone(b6) === true && R.canon(b6) === true);
/* B7 — tarefa LEGADA (sem workflowPhase; cronStatus=enviado_cliente) segue enviada */
const b7 = { ...base, id: 'b7', cronStatus: 'enviado_cliente', clientFlowStatus: 'enviado', clientReviewToken: 'tok_leg', clientSentAt: 1 };
ok('B7 legada: "Enviado ao cliente" CONCLUÍDO (fallback canônico preservado)', sentDone(b7) === true && R.canon(b7) === true);

/* ---------- D. CUMULATIVIDADE (não regredir estados posteriores) ---------- */
const dProd = { ...base, id: 'dp', clientReviewToken: 'tok', workflowPhase: 'themes_waiting_client', clientFlowStatus: 'enviado', cronStatus: 'enviado_cliente', designerAssignment: { designerId: 'd1', designerName: 'D' }, designerFlowStatus: 'andamento', clientSentAt: 1, clientApprovalPhase: 'themes', clientReview: { status: 'aprovado' } };
ok('D1 designer em produção: "Enviado ao cliente" segue CONCLUÍDO (cumulativo)', sentDone(dProd) === true);
const dDone = { ...base, id: 'dd', clientReviewToken: 'tok', clientFlowStatus: 'concluido', cronStatus: 'aprovado_final', finalApprovalCompleted: true, status: 'concluido' };
ok('D2 concluída: "Enviado ao cliente" segue CONCLUÍDO (cumulativo)', sentDone(dDone) === true);

/* ---------- E. PARIDADE do sinal canônico renderer × main (slaRules) ----------
   flowCanonicalSentSignal não é exportado no main; para tarefas de TEMAS sem designer,
   o delegador EXPORTADO flowThemesSentSignal === flowCanonicalSentSignal — usamos ele. */
for (const [nm, t] of [['b2', b2], ['b6', b6], ['b7', b7]]) {
  ok('E-' + nm + ' sinal canônico de envio renderer×main idêntico', R.canon(t) === rules.flowThemesSentSignal(t));
}

/* ---------- F. OUTROS MARCOS INTACTOS ---------- */
ok('F1 marco "Criado" sempre concluído', R.tl(b1).milestones.find(m => m.key === 'criado').done === true);
ok('F2 B2: "Temas aprovados" NÃO concluído (nada aprovado)', R.tl(b2).milestones.find(m => m.key === 'temas_aprovados').done === false);

console.log('\n===== F3.5.6A-H8 — TIMELINE HONESTA (ESCOPO B) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('f356ah8-honest-timeline: ' + pass + '/' + (pass + fail) + (fail ? ' — FALHOU' : ' — VERDE'));
if (fail) { console.error('::error:: contrato F3.5.6A-H8 (timeline) violado'); process.exit(1); }
