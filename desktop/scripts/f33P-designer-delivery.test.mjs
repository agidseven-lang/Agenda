#!/usr/bin/env node
/* =====================================================================
 * F3.3.17-R5.1 — AUDITORIA + VALIDAÇÃO da ENTREGA DO DESIGNER + restauração de
 * LEGENDAS/POSTS para a Social Media. READ-ONLY sobre index.html: executa as
 * FUNÇÕES DE DERIVAÇÃO REAIS sobre os CAMPOS EXATOS gravados pelos write-paths
 * reais (moveStatus eixo-designer grava designerFlowStatus='concluido' +
 * clientFlowStatus='reenviado'; saveProduction(resend) grava cronStatus=
 * 'ready_for_final_client_review' + clientApprovalPhase='final').
 *
 * Prova as 2 ressalvas e a CORREÇÃO confinada ao renderer:
 *   P1 — após a ENTREGA do designer o card NÃO pode ficar preso em "Em andamento":
 *        · eixo do designer (designerColView) = 'entregue';
 *        · "Meu quadro" do DESIGNER usa DESIGNER_COLS4 + designerColView (tem 'Entregue');
 *        · canônico: fase 'designer_delivered', designer.col='entregue'/label 'Entregue',
 *          social.label 'Designer entregou…', client.col='analise' 'A equipe está finalizando as artes'.
 *   P2 — Legendas/Posts (ação 'prod') volta a aparecer para a Social após a entrega:
 *        · detailState pós-entrega = 'designer_entregou' com actions ['prod','sendclient'];
 *        · só vira 'aguardando_final' (sem 'prod') quando a versão final foi REALMENTE
 *          enviada (flowSentToClientSignal). operationalCol pós-entrega = 'aguardando_legenda'
 *          (responsável = Social), não 'aguardando_final'.
 *   REGRA CENTRAL — entrega do designer ≠ conclusão final: só o Worker (aprovação final
 *        real do cliente) conclui; cliente NUNCA vê concluído/aprovado antes disso.
 *
 * Rodar: /opt/node22/bin/node desktop/scripts/f33P-designer-delivery.test.mjs
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
  'TASK_PHASE', 'FLOW_LABELS', 'CLIENT_COLS', 'CLIENT_COLS4', 'SOCIAL_COLS4', 'DESIGNER_COLS4', 'flowRole',
  'isTaskCompleted', 'isFullyComplete', 'hasDesigner', 'designerOf', 'designerDelivered',
  'designerCol', 'clientCol', 'operationalCol', 'clientCol4',
  'pendingClientItems', 'hasPendingItemRevision', 'allPhaseItemsApproved', 'hasTeamAdjustedAwaiting',
  'clientApprovalPhaseOf', 'pendingProduction', 'pendingLegend', 'pendingFeed', 'pendingStory',
  'clientApproved', 'isSentToDesigner', 'nextActionText',
  'flowCompletedSignal', 'flowClientChangesSignal', 'flowSentToClientSignal',
  'flowThemesApprovedSignal', 'flowThemesSentSignal',
  'deriveCanonicalTaskState', 'deriveCanonicalPerspective', 'deriveBoardColumn',
  'flowBoardCol', 'personBoardCol', 'designerColView', 'detailState',
  'kbv2SlaLocal', 'resolveTaskDisplayState', 'slaPanelDelivered', 'detailSla',
];
let SRC = ''; const missing = [];
for (const n of NAMES) { try { SRC += grab(n) + '\n'; } catch (e) { missing.push(n); } }
const PRELUDE =
  'function secOf(s){return {key:(s==="cronograma"?"cronograma":"outro")};}var SECTORS=[{key:"cronograma"}];\n' +
  'function stOf(s){return {key:s,label:String(s),color:"#888"};}\n' +
  'function fmtDateTimeBR(x){return String(x);}\n' +
  'function slaPanelFinishMs(){return 0;}var SLA_PANEL_GRACE_MS=600000,SLA_PANEL_WARN_MS=1800000;\n' +
  'var state={user:{id:"sm1"},users:[]};\n';
const R = new Function(PRELUDE + SRC + '\n; return {' + NAMES.filter(n => !missing.includes(n)).join(',') + '};')();

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const PH = R.TASK_PHASE;

/* ===== campos EXATOS dos write-paths reais ===== */
const CONT_VAZIO = [{ tema: 'T1' }];                                   // designer entregou, Social ainda NÃO legendou
const CONT_CHEIO = [{ tema: 'T1', legenda: 'L1', feedImageUrl: 'f1' }];// Social preencheu legenda + arte
const base = (cont) => ({ id: 't1', title: 'Post', client: 'Cliente X', sector: 'cronograma', by: 'sm1', cronContents: cont });
const S = {
  // designer produzindo (contraste): card é do designer, sem 'prod' p/ Social
  produzindo: Object.assign(base(CONT_VAZIO), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'andamento', clientFlowStatus: 'producao', socialOwnerId: 'sm1' }),
  // ENTREGA do designer, Social ainda NÃO legendou (cenário exato da ressalva)
  entregaSemLegenda: Object.assign(base(CONT_VAZIO), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', designerSla: { startedAt: 1, finishedAt: 2 }, clientFlowStatus: 'reenviado', socialOwnerId: 'sm1', status: 'afazer' }),
  // ENTREGA do designer, Social já legendou mas ainda NÃO enviou ao cliente
  entregaComLegenda: Object.assign(base(CONT_CHEIO), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', designerSla: { startedAt: 1, finishedAt: 2 }, clientFlowStatus: 'reenviado', socialOwnerId: 'sm1', status: 'afazer' }),
  // Social ENVIOU a versão final (saveProduction resend): cronStatus + fase final reais
  enviouFinal: Object.assign(base(CONT_CHEIO), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', designerSla: { startedAt: 1, finishedAt: 2 }, clientFlowStatus: 'producao', cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', finalApprovalRequired: true, socialOwnerId: 'sm1' }),
  // Cliente APROVOU FINAL (Worker) — único caminho de conclusão
  aprovouFinal: Object.assign(base(CONT_CHEIO), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, status: 'concluido', designerSla: { startedAt: 1, finishedAt: 2 }, clientFlowStatus: 'concluido', finalApprovalCompleted: true, operationalStatus: 'concluido', socialOwnerId: 'sm1' }),
};

const fase = (t) => R.deriveCanonicalTaskState(t).phase;
const dsOf = (t) => R.detailState(t);
const persp = (t, p) => R.deriveCanonicalPerspective(t, p);
const SOCIAL_OWNER_OPS = ['aguardando_legenda', 'aguardando_envio', 'afazer']; // line taskTimeline → owner=Social

/* ============ 0) ASSERÇÕES DE FONTE (provam que a correção está no código) ============ */
const SRC_op = grab('operationalCol'); const SRC_det = grab('detailState'); const SRC_pb = grab('renderPersonBoard');
ok('[src] P2/operationalCol: branch "reenviado" guardado por flowSentToClientSignal',
  /cf==='reenviado'\s*&&\s*flowSentToClientSignal\(t\)/.test(SRC_op));
ok('[src] P2/operationalCol: entrega do designer usa flowSentToClientSignal (não conclui por legenda preenchida)',
  /dc==='concluido'\)\s*return\s*flowSentToClientSignal\(t\)\?'aguardando_final':'aguardando_legenda'/.test(SRC_op));
ok('[src] P2/detailState: "Aguardando aprovação final" SÓ com flowSentToClientSignal (não em entrega)',
  SRC_det.includes('flowSentToClientSignal(t)') && /if\(flowSentToClientSignal\(t\)\)return\s*\{key:'aguardando_final'/.test(SRC_det));
ok('[src] P2/detailState: estado "designer_entregou" mantém ação Legendas/posts (prod) + enviar',
  /key:'designer_entregou'[\s\S]*actions:\['prod','sendclient'\]/.test(SRC_det));
ok('[src] P1/renderPersonBoard: board do DESIGNER usa DESIGNER_COLS4 + designerColView (coluna "Entregue")',
  SRC_pb.includes('DESIGNER_COLS4') && SRC_pb.includes('designerColView'));
ok('[src] regra central: detailState NÃO grava conclusão (read-only; sem finalApprovalCompleted/operationalStatus)',
  !/finalApprovalCompleted\s*[:=]/.test(SRC_det) && !/operationalStatus\s*[:=]/.test(SRC_det));

/* ============ P1 — COLUNA/STATUS APÓS A ENTREGA DO DESIGNER ============ */
// eixo do designer (o que o board do designer usa) = 'entregue' (não 'andamento')
ok('P1: designerColView(entrega s/legenda) = entregue', R.designerColView(S.entregaSemLegenda) === 'entregue');
ok('P1: designerColView(entrega c/legenda) = entregue', R.designerColView(S.entregaComLegenda) === 'entregue');
// canônico (fonte única) reconhece a entrega como fase própria, NÃO conclusão
ok('P1: fase canônica da entrega = designer_delivered', fase(S.entregaSemLegenda) === PH.DESIGNER_DELIVERED);
ok('P1: designer vê coluna "entregue"', persp(S.entregaSemLegenda, 'designer').col === 'entregue');
ok('P1: designer chip = "Entregue"', /entregue/i.test(persp(S.entregaSemLegenda, 'designer').label));
ok('P1: designer etapa/próxima aponta para a Social', /social/i.test(persp(S.entregaSemLegenda, 'designer').next));
// Social: chip "Designer entregou — enviar ao cliente" (coluna andamento é aceitável p/ a Social)
ok('P1: social chip = "Designer entregou…"', /designer entregou/i.test(persp(S.entregaSemLegenda, 'social').label));
// Cliente: linguagem simples, NUNCA "concluído"/"aprovado"
ok('P1: cliente coluna = analise (em análise)', persp(S.entregaSemLegenda, 'client').col === 'analise');
ok('P1: cliente vê "A equipe está finalizando as artes"', /finalizando as artes/i.test(persp(S.entregaSemLegenda, 'client').label));
ok('P1: cliente NÃO vê aprovado na entrega', persp(S.entregaSemLegenda, 'client').col !== 'aprovado');

/* ============ P2 — LEGENDAS/POSTS DE VOLTA PARA A SOCIAL APÓS A ENTREGA ============ */
ok('P2: detailState(entrega s/legenda).key = designer_entregou', dsOf(S.entregaSemLegenda).key === 'designer_entregou');
ok('P2: detailState(entrega s/legenda) tem ação "prod" (Legendas e artes)', dsOf(S.entregaSemLegenda).actions.includes('prod'));
ok('P2: detailState(entrega s/legenda) responsável = social', dsOf(S.entregaSemLegenda).owner === 'social');
ok('P2: detailState(entrega c/legenda) ainda tem "prod" + "sendclient"', dsOf(S.entregaComLegenda).actions.includes('prod') && dsOf(S.entregaComLegenda).actions.includes('sendclient'));
// operationalCol pós-entrega = aguardando_legenda (responsável = Social), NÃO aguardando_final
ok('P2: operationalCol(entrega s/legenda) = aguardando_legenda', R.operationalCol(S.entregaSemLegenda) === 'aguardando_legenda');
ok('P2: operationalCol(entrega c/legenda) = aguardando_legenda (ainda não enviou)', R.operationalCol(S.entregaComLegenda) === 'aguardando_legenda');
ok('P2: responsável operacional da entrega = Social', SOCIAL_OWNER_OPS.includes(R.operationalCol(S.entregaSemLegenda)));
ok('P2: nextActionText da entrega fala em adicionar legenda/posts', /legenda|posts/i.test(R.nextActionText(S.entregaSemLegenda)));
// designer produzindo: card é do designer, SEM 'prod' p/ Social (não antecipa legendas)
ok('P2: produzindo NÃO oferece "prod" (designer ainda na bola)', !dsOf(S.produzindo).actions.includes('prod'));

/* ============ ENVIO FINAL — só então some "prod" e vira "aguardando aprovação final" ============ */
ok('FINAL: detailState(enviou final).key = aguardando_final', dsOf(S.enviouFinal).key === 'aguardando_final');
ok('FINAL: detailState(enviou final) NÃO tem "prod" (já enviado)', !dsOf(S.enviouFinal).actions.includes('prod'));
ok('FINAL: detailState(enviou final) responsável = cliente', dsOf(S.enviouFinal).owner === 'cliente');
ok('FINAL: operationalCol(enviou final) = aguardando_final', R.operationalCol(S.enviouFinal) === 'aguardando_final');
ok('FINAL: fase canônica = awaiting_client_approval', fase(S.enviouFinal) === PH.AWAITING_CLIENT_APPROVAL);
ok('FINAL: cliente vê "Versão final disponível para análise"', /versão final dispon/i.test(persp(S.enviouFinal, 'client').label));
ok('FINAL: cliente ainda NÃO vê aprovado/concluído antes da aprovação', persp(S.enviouFinal, 'client').col !== 'aprovado' && fase(S.enviouFinal) !== PH.COMPLETED);

/* ============ PROBLEMA B — chip "Concluído" NÃO pode aparecer antes da aprovação final ============ */
const slaLabel = (t) => R.kbv2SlaLocal(t, Date.now()).label;
ok("[src] B/kbv2SlaLocal: SLA do card relabela 'Entregue' no cronograma sem aprovação final",
  /label:\(secOf\(t\.sector\)\.key==='cronograma'&&!isTaskCompleted\(t\)\)\?'Entregue':'Concluído'/.test(grab('kbv2SlaLocal')));
ok("[src] B/detailSla: SLA do detalhe não diz 'Concluída' antes da aprovação final (gate isTaskCompleted)",
  /isTaskCompleted\(t\)/.test(grab('detailSla')) && grab('detailSla').includes("?'Concluída':'Entregue'"));
ok('B: chip SLA na ENTREGA (s/legenda) = "Entregue" (NUNCA "Concluído")', slaLabel(S.entregaSemLegenda) === 'Entregue');
ok('B: chip SLA na ENTREGA (c/legenda) = "Entregue"', slaLabel(S.entregaComLegenda) === 'Entregue');
ok('B: chip SLA após ENVIO FINAL ainda = "Entregue" (cliente não aprovou)', slaLabel(S.enviouFinal) === 'Entregue');
ok('B: NENHUM rótulo de card da ENTREGA contém "Conclu" (chip SLA + 3 papéis canônicos)',
  !/Conclu/i.test(slaLabel(S.entregaSemLegenda)) && !/Conclu/i.test(persp(S.entregaSemLegenda,'designer').label) &&
  !/Conclu/i.test(persp(S.entregaSemLegenda,'social').label) && !/Conclu/i.test(persp(S.entregaSemLegenda,'client').label));
ok('B: SÓ na aprovação final real o chip SLA do card = "Concluído"', slaLabel(S.aprovouFinal) === 'Concluído');

/* ============ REGRA CENTRAL — concluir SÓ na aprovação final real (Worker) ============ */
ok('REGRA: entrega do designer NÃO é conclusão', !R.isTaskCompleted(S.entregaSemLegenda) && fase(S.entregaSemLegenda) !== PH.COMPLETED);
ok('REGRA: entrega c/legenda NÃO é conclusão', !R.isTaskCompleted(S.entregaComLegenda) && fase(S.entregaComLegenda) !== PH.COMPLETED);
ok('REGRA: envio final NÃO é conclusão (aguarda cliente)', !R.isTaskCompleted(S.enviouFinal) && fase(S.enviouFinal) !== PH.COMPLETED);
ok('REGRA: SÓ aprovação final (Worker) conclui', R.isTaskCompleted(S.aprovouFinal) && fase(S.aprovouFinal) === PH.COMPLETED);
ok('REGRA: detailState(aprovou final).key = concluido', dsOf(S.aprovouFinal).key === 'concluido');
ok('REGRA: cliente só vê "Aprovado" na conclusão final', persp(S.aprovouFinal, 'client').col === 'aprovado');

/* ===================== MATRIZ ANTES/DEPOIS (legível) ===================== */
const row = (lbl, t) => {
  const c = R.deriveCanonicalTaskState(t);
  return [lbl.padEnd(20),
    ('fase=' + c.phase).padEnd(26),
    ('detail=' + dsOf(t).key).padEnd(26),
    ('actions=[' + dsOf(t).actions.join(',') + ']').padEnd(26),
    ('opCol=' + R.operationalCol(t)).padEnd(26),
    ('slaChip=' + R.kbv2SlaLocal(t, Date.now()).label).padEnd(18),
    ('dz.col=' + persp(t, 'designer').col).padEnd(14),
    ('cli=' + persp(t, 'client').col)
  ].join(' ');
};
console.log('\n================ F3.3.17-R5.1 — MATRIZ DA FASE "DESIGNER ENTREGUE" ================');
console.log(row('produzindo', S.produzindo));
console.log(row('ENTREGA s/legenda', S.entregaSemLegenda));
console.log(row('ENTREGA c/legenda', S.entregaComLegenda));
console.log(row('enviou FINAL', S.enviouFinal));
console.log(row('aprovou FINAL', S.aprovouFinal));
console.log('==================================================================================\n');

if (missing.length) console.log('AVISO: símbolos não extraídos: ' + missing.join(', '));
console.log('F3.3.17-R5.1 designer-delivery: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
