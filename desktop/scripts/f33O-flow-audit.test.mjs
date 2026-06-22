#!/usr/bin/env node
/* =====================================================================
 * F3.3.17-R5 — AUDITORIA + VALIDAÇÃO da correção do fluxo operacional (Social → Designer → Cliente).
 * READ-ONLY sobre index.html. Executa as FUNÇÕES DE DERIVAÇÃO REAIS (Flow Engine canônico:
 * deriveCanonicalTaskState/deriveCanonicalPerspective + FLOW_LABELS; legado: clientCol/operationalCol)
 * sobre os CAMPOS EXATOS gravados pelos write-paths reais (aferidos contra o código).
 *
 * Prova a CORREÇÃO C1–C4:
 *   C1 fases de TEMAS: enviar/aprovar temas NÃO colapsa em "planning" nem conclui;
 *   C2 coluna≡chip≡etapa≡próxima da MESMA fonte canônica nos 3 papéis;
 *   C3 revisão in-app reflete (clientFlowStatus:'revisao', sem mascarar); aprovar in-app só TEMAS;
 *      finalização só conclui via Worker (in-app NÃO conclui);
 *   C4 estado otimista = patch (sem pisca).
 * Critérios: temas não concluem · designer entregue não conclui · revisão não conclui · SÓ final conclui.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33O-flow-audit.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

function grab(n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '=');
  if (a < 0) a = HTML.indexOf('const ' + n + ' =');
  if (a < 0) throw new Error('não encontrei: ' + n);
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  throw new Error('sem fim: ' + n);
}
const NAMES = [
  'TASK_PHASE', 'FLOW_LABELS', 'CLIENT_COLS', 'flowRole',
  'isTaskCompleted', 'isFullyComplete', 'hasDesigner', 'designerOf', 'designerDelivered',
  'designerCol', 'clientCol', 'socialCol', 'operationalCol',
  'pendingClientItems', 'hasPendingItemRevision', 'allPhaseItemsApproved', 'clientApprovalPhaseOf',
  'pendingProduction', 'pendingLegend', 'pendingFeed', 'pendingStory',
  'flowCompletedSignal', 'flowClientChangesSignal', 'flowSentToClientSignal',
  'flowThemesApprovedSignal', 'flowThemesSentSignal',
  'deriveCanonicalTaskState', 'deriveCanonicalPerspective', 'deriveBoardColumn',
  'flowBoardCol', 'personBoardCol', 'designerColView', 'clientCol4',
];
let SRC = ''; const missing = [];
for (const n of NAMES) { try { SRC += grab(n) + '\n'; } catch (e) { missing.push(n); } }
const PRELUDE = 'function secOf(s){return {key:(s==="cronograma"?"cronograma":"outro")};}var SECTORS=[{key:"cronograma"}];\n';
const R = new Function(PRELUDE + SRC + '\n; return {' + NAMES.filter(n => !missing.includes(n)).join(',') + '};')();

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push('FAIL: ' + n); } };
const PH = R.TASK_PHASE;

/* ===== 0) ASSERÇÕES DE FONTE (provam que as correções estão no código) ===== */
ok('[src] C1: TASK_PHASE tem THEMES_SENT/THEMES_APPROVED', !!(PH && PH.THEMES_SENT && PH.THEMES_APPROVED));
ok('[src] C1: deriveCanonicalTaskState ramifica temas', grab('deriveCanonicalTaskState').includes('flowThemesApprovedSignal') && grab('deriveCanonicalTaskState').includes('flowThemesSentSignal'));
ok('[src] C1: FLOW_LABELS tem themes_sent/themes_approved', grab('FLOW_LABELS').includes('themes_sent') && grab('FLOW_LABELS').includes('themes_approved'));
ok('[src] C3: clientReviewAction grava clientFlowStatus (revisao/aprovado)', (() => { const o = grab('clientReviewAction'); return o.includes("cfs='revisao'") && o.includes("cfs='aprovado'") && o.includes('patch.clientFlowStatus=cfs'); })());
ok('[src] C3: clientReviewAction NÃO grava finalApprovalCompleted/operationalStatus (não finaliza)', (() => { const o = grab('clientReviewAction'); return !/finalApprovalCompleted\s*[:=]/.test(o) && !/operationalStatus\s*[:=]/.test(o) && !/clientFlowStatus\s*[:=]\s*['"]concluido/.test(o); })());
ok('[src] C4: sendToDesigner otimista = patch-derivado', grab('sendToDesigner').includes('for(const _k in patch)'));

/* ===== estados = campos EXATOS dos write-paths reais (pós-correção) ===== */
const CONTENT = [{ tema: 'T1', legenda: 'L1', feedImageUrl: 'f1' }];
const base = () => ({ id: 't1', title: 'Post', client: 'Cliente X', sector: 'cronograma', by: 'sm1', cronContents: CONTENT });
const S = {
  cria: Object.assign(base(), { cronStatus: 'pronto_cliente', clientFlowStatus: 'afazer', socialOwnerId: 'sm1', status: 'afazer' }),
  enviaTemas: Object.assign(base(), { cronStatus: 'enviado_cliente', clientFlowStatus: 'enviado', clientApprovalPhase: 'themes', clientSentBy: 'sm1', socialOwnerId: 'sm1' }),
  aprovaTemasWorker: Object.assign(base(), { cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, status: 'andamento', clientFlowStatus: 'aprovado', clientApprovalPhase: 'themes', socialOwnerId: 'sm1' }),
  aprovaTemasInApp: Object.assign(base(), { cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, clientFlowStatus: 'aprovado', clientApprovalPhase: 'themes', socialOwnerId: 'sm1' }), // C3: in-app grava clientFlowStatus:'aprovado'
  atribui: Object.assign(base(), { designerAssignment: { designerId: 'dz1', designerName: 'D' }, assigneeId: 'dz1', cronStatus: 'sent_to_designer', status: 'afazer', clientFlowStatus: 'producao', designerFlowStatus: 'afazer', operationalStatus: 'aguardando_designer_iniciar', socialFlowStatus: 'aguardando_designer_iniciar', socialOwnerId: 'sm1', finalApprovalCompleted: false }),
  inicia: Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'andamento', clientFlowStatus: 'producao', socialOwnerId: 'sm1' }),
  entrega: Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', clientFlowStatus: 'reenviado', socialOwnerId: 'sm1', status: 'afazer' }),
  enviaFinal: Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', clientFlowStatus: 'reenviado', socialOwnerId: 'sm1' }),
  revisaoWorker: Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', cronStatus: 'em_revisao_cliente', clientReview: { status: 'revisao' }, clientFlowStatus: 'revisao', socialOwnerId: 'sm1' }),
  revisaoInApp: Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', cronStatus: 'em_revisao_cliente', clientReview: { status: 'revisao' }, clientFlowStatus: 'revisao', socialOwnerId: 'sm1' }), // C3: in-app agora grava clientFlowStatus:'revisao'
  aprovaFinalWorker: Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, status: 'concluido', clientFlowStatus: 'concluido', finalApprovalCompleted: true, operationalStatus: 'concluido', socialOwnerId: 'sm1' }),
  aprovaFinalInApp: Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, designerFlowStatus: 'concluido', clientApprovalPhase: 'final', clientFlowStatus: 'reenviado', socialOwnerId: 'sm1' }), // C3: in-app NÃO grava clientFlowStatus em fase final
};
const fase = (t) => R.deriveCanonicalTaskState(t).phase;
const owner = (t) => R.deriveCanonicalTaskState(t).owner;
const persp = (t, role) => R.deriveCanonicalPerspective(t, role);
const isFinal = (t) => fase(t) === PH.COMPLETED;
const done = (t) => R.isTaskCompleted(t);

/* ===== 1) MATRIZ DEPOIS — por papel: coluna · chip(label) · etapa(owner) · próxima · final? ===== */
const TX = [
  ['1 Social cria', S.cria], ['2 envia temas', S.enviaTemas], ['3 cliente aprova temas', S.aprovaTemasWorker],
  ['4 atribui designer', S.atribui], ['5 designer inicia', S.inicia], ['6 designer entrega', S.entrega],
  ['7 envia final', S.enviaFinal], ['8 cliente pede revisão', S.revisaoWorker], ['9 cliente aprova final', S.aprovaFinalWorker],
];
console.log('\n==== F3.3.17-R5 — MATRIZ DEPOIS (Flow Engine canônico; coluna≡chip≡etapa≡próxima por papel) ====');
for (const [name, t] of TX) {
  const fph = fase(t), ow = owner(t), fin = isFinal(t) ? 'FINAL' : '—';
  console.log('\n• ' + name + '   [fase=' + fph + ' · responsável=' + ow + ' · ' + fin + ' · concluído=' + done(t) + ']');
  for (const role of ['social', 'designer', 'client']) {
    const p = persp(t, role);
    console.log('   ' + role.padEnd(8) + ' col=' + String(p.col).padEnd(10) + ' chip="' + p.label + '" · próxima="' + p.next + '"');
  }
}

/* ===== 2) CRITÉRIOS DE ACEITE ===== */
console.log('\n==== CRITÉRIOS ====');
// temas não concluem
ok('temas ENVIADOS não conclui (THEMES_SENT, done=false)', fase(S.enviaTemas) === PH.THEMES_SENT && done(S.enviaTemas) === false);
ok('temas APROVADOS não conclui (THEMES_APPROVED, done=false)', fase(S.aprovaTemasWorker) === PH.THEMES_APPROVED && done(S.aprovaTemasWorker) === false);
ok('temas aprovados NÃO é "planning" (C1 corrigiu o colapso)', fase(S.aprovaTemasWorker) !== PH.PLANNING);
// designer entregue não conclui
ok('designer ENTREGUE não conclui (DESIGNER_DELIVERED, done=false)', fase(S.entrega) === PH.DESIGNER_DELIVERED && done(S.entrega) === false);
// revisão não conclui
ok('REVISÃO não conclui (CLIENT_REQUESTED_CHANGES, done=false)', fase(S.revisaoWorker) === PH.CLIENT_REQUESTED_CHANGES && done(S.revisaoWorker) === false);
// só final conclui
ok('SÓ aprovação FINAL conclui (COMPLETED, done=true)', fase(S.aprovaFinalWorker) === PH.COMPLETED && done(S.aprovaFinalWorker) === true);
ok('nenhuma transição não-final conclui', [S.cria, S.enviaTemas, S.aprovaTemasWorker, S.atribui, S.inicia, S.entrega, S.enviaFinal, S.revisaoWorker].every(t => done(t) === false));
// fase esperada por transição
ok('fases: cria=planning, atribui=awaiting_designer, inicia=producing, final-envio=awaiting_client_approval',
  fase(S.cria) === PH.PLANNING && fase(S.atribui) === PH.AWAITING_DESIGNER && fase(S.inicia) === PH.DESIGNER_PRODUCING && fase(S.enviaFinal) === PH.AWAITING_CLIENT_APPROVAL);
// coluna≡chip≡próxima da MESMA fonte: os 3 papéis derivam da MESMA fase (sem divergência)
ok('sem divergência entre papéis: todos da MESMA fase canônica', TX.every(([_, t]) => {
  const f = fase(t); return persp(t, 'social').phase === f && persp(t, 'designer').phase === f && persp(t, 'client').phase === f;
}));
// coluna do papel = FLOW_LABELS[fase][papel].col (coluna≡chip por construção)
ok('coluna≡chip por construção (col vem do mesmo FLOW_LABELS[fase][papel])', TX.every(([_, t]) => {
  const f = fase(t); return ['social', 'designer', 'client'].every(role => persp(t, role).col === (R.FLOW_LABELS[f] && R.FLOW_LABELS[f][role] && R.FLOW_LABELS[f][role].col));
}));

/* ===== 3) PROVAS C3 / C4 ===== */
console.log('\n==== C3 / C4 ====');
// C3 revisão in-app: agora grava clientFlowStatus:'revisao' → legado NÃO mascara + canônico detecta
ok('[C3] revisão in-app: clientCol legado = revisao (não mascara mais)', R.clientCol(S.revisaoInApp) === 'revisao');
ok('[C3] revisão in-app: fase canônica = CLIENT_REQUESTED_CHANGES', fase(S.revisaoInApp) === PH.CLIENT_REQUESTED_CHANGES);
ok('[C3] revisão in-app: NÃO conclui', done(S.revisaoInApp) === false);
// C3 aprovar temas in-app: avança temas, não conclui
ok('[C3] aprovar TEMAS in-app: THEMES_APPROVED, não conclui', fase(S.aprovaTemasInApp) === PH.THEMES_APPROVED && done(S.aprovaTemasInApp) === false);
// C3 aprovar FINAL in-app: NÃO conclui (Worker-exclusivo) — fica aguardando aprovação do cliente
ok('[C3] aprovar FINAL in-app: NÃO conclui (continua AWAITING_CLIENT_APPROVAL)', done(S.aprovaFinalInApp) === false && fase(S.aprovaFinalInApp) === PH.AWAITING_CLIENT_APPROVAL);
ok('[C3] só o caminho WORKER conclui (in-app final ≠ Worker final)', done(S.aprovaFinalWorker) === true && done(S.aprovaFinalInApp) === false);
// C4: prova (fonte) de que o otimista do sendToDesigner inclui socialOwnerId/operationalStatus
ok('[C4] otimista do sendToDesigner inclui socialOwnerId+operationalStatus (via patch)', (() => { const o = grab('sendToDesigner'); return o.includes('socialOwnerId:') && o.includes('operationalStatus:') && o.includes('for(const _k in patch)'); })());

console.log('\n' + (missing.length ? '(não extraídas: ' + missing.join(',') + ')\n' : ''));
if (flog.length) console.log(flog.join('\n') + '\n');
console.log(pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: validação R5 divergiu'); process.exit(1); }
console.log('OK — fluxo coerente: TEMAS têm fase própria (não "planning", não conclui), designer entregue/revisão não concluem,');
console.log('     SÓ a aprovação FINAL (Worker) conclui; coluna≡chip≡etapa≡próxima da mesma fonte canônica nos 3 papéis;');
console.log('     C3 revisão in-app visível + aprovar in-app só temas + final só Worker; C4 otimista completo.');
