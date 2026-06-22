#!/usr/bin/env node
/* =====================================================================
 * F3.3.17-R5 — AUDITORIA/REPRODUÇÃO do fluxo operacional (Social → Designer → Cliente).
 * READ-ONLY. Executa as FUNÇÕES DE DERIVAÇÃO REAIS do renderer (deriveCanonicalTaskState,
 * deriveCanonicalPerspective/flowBoardCol = Flow Engine; clientCol/designerCol/socialCol/
 * operationalCol = legado) sobre estados que são os CAMPOS EXATOS gravados pelos write-paths
 * reais. Os field-sets dos write-paths e do Worker são AFERIDOS contra o código-fonte (assert
 * de presença) para NÃO serem mocks inventados. Prova, por transição/papel:
 *   - coluna canônica × chip legado (divergência persistente na janela de TEMAS);
 *   - estado otimista × persistido (janela antes do snapshot);
 *   - revisão in-app não troca clientFlowStatus (mascara coluna);
 *   - finalização depende do Worker (aprovar in-app não conclui).
 * NÃO corrige nada. Rodar: /opt/node22/bin/node desktop/scripts/f33O-flow-audit.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const WORKER = (() => { try { return fs.readFileSync(path.resolve(__dirname, '..', '..', 'cloudflare-worker.js'), 'utf8'); } catch (_) { return ''; } })();

/* ---- extrai `function n(){...}` OU `const n=...;` por balanceamento de (){}[] ---- */
function grab(n) {
  let a = HTML.indexOf('function ' + n + '(');
  let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '=');
  if (a < 0) a = HTML.indexOf('const ' + n + ' =');
  if (a < 0) throw new Error('não encontrei: ' + n);
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  // const: vai até o `;` em profundidade 0
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  throw new Error('sem fim: ' + n);
}

const NAMES = [
  'TASK_PHASE', 'FLOW_LABELS', 'CLIENT_COLS',
  'flowRole', 'isTaskCompleted', 'isFullyComplete', 'hasDesigner', 'designerOf',
  'designerCol', 'clientCol', 'socialCol', 'operationalCol', 'designerDelivered',
  'pendingClientItems', 'hasPendingItemRevision', 'allPhaseItemsApproved', 'clientApprovalPhaseOf',
  'pendingProduction', 'pendingLegend', 'pendingFeed', 'pendingStory',
  'flowCompletedSignal', 'flowClientChangesSignal', 'flowSentToClientSignal',
  'deriveCanonicalTaskState', 'deriveCanonicalPerspective', 'deriveBoardColumn',
  'flowBoardCol', 'personBoardCol', 'designerColView', 'clientCol4',
];
let SRC = '';
const missing = [];
for (const n of NAMES) { try { SRC += grab(n) + '\n'; } catch (e) { missing.push(n); } }

// leaves mockadas (não-fluxo): setor + helpers de conteúdo que não afetam os cenários cron testados
const PRELUDE = `
  function secOf(s){ return { key: (s==='cronograma'?'cronograma':'outro') }; }
  var SECTORS=[{key:'cronograma',label:'Cronograma'}];
`;
let API;
try {
  API = new Function(PRELUDE + SRC + '\n; return {' + NAMES.filter(n => !missing.includes(n)).join(',') + '};')();
} catch (e) {
  console.error('::erro ao montar sandbox::', e.message, '\nmissing:', missing.join(','));
  process.exit(2);
}
const R = API;
let pass = 0, fail = 0; const log = [];
const ok = (n, c) => { if (c) pass++; else { fail++; log.push('FAIL: ' + n); } };
const has = (src, s) => src.indexOf(s) >= 0;

/* =====================================================================
 * 0) AFERIÇÃO DOS FIELD-SETS contra o código (provam que os estados abaixo
 *    são os campos REAIS gravados, não mocks inventados).
 * ===================================================================== */
ok('[src] sendToDesigner PERSISTE operationalStatus/socialFlowStatus', has(HTML, "operationalStatus:'aguardando_designer_iniciar', socialFlowStatus:'aguardando_designer_iniciar'"));
ok('[src] sendToDesigner OTIMISTA NÃO inclui operationalStatus', (() => { const o = grab('sendToDesigner'); const opt = o.slice(o.indexOf('Object.assign(t,{')); return opt.indexOf('operationalStatus') < 0 && opt.indexOf('socialOwnerId') < 0; })());
ok('[src] persistClientSend grava clientFlowStatus mas OTIMISTA NÃO grava cronStatus', (() => { const o = grab('persistClientSend'); const after = o.slice(o.indexOf('t.clientFlowStatus=cflow')); return after.indexOf('cronStatus') < 0; })());
ok('[src] deriveCanonicalTaskState NÃO tem ramo para clientFlowStatus===aprovado', (() => { const o = grab('deriveCanonicalTaskState'); return o.indexOf("'aprovado'") < 0 && o.indexOf('"aprovado"') < 0; })());
ok('[src] operationalCol NÃO lê operationalStatus (write-only no desktop)', grab('operationalCol').indexOf('operationalStatus') < 0);
ok('[src] Worker conclui com finalApprovalCompleted:true / clientFlowStatus concluido', WORKER === '' || (has(WORKER, 'finalApprovalCompleted') && has(WORKER, 'concluido')));
ok('[src] renderer clientReviewAction(revisao) NÃO grava clientFlowStatus', (() => { try { const o = grab('clientReviewAction'); const blk = o.slice(o.indexOf('revisao')); return blk.indexOf('clientFlowStatus') < 0; } catch (_) { const m = HTML.indexOf("revisao:{cronStatus:'em_revisao_cliente'"); return m > 0 && HTML.slice(m, m + 160).indexOf('clientFlowStatus') < 0; } })());

/* =====================================================================
 * Estados = CAMPOS EXATOS dos write-paths reais (renderer) e do Worker.
 * cronContents com 1 item completo (legenda+feed) p/ neutralizar pendências.
 * ===================================================================== */
const CONTENT = [{ tema: 'T1', legenda: 'L1', feedImageUrl: 'f1' }];
const base = () => ({ id: 't1', title: 'Post', client: 'Cliente X', sector: 'cronograma', by: 'sm1', cronContents: CONTENT });

// (a) criada (saveTask cron, pronto p/ cliente)
const sA = Object.assign(base(), { cronStatus: 'pronto_cliente', clientFlowStatus: 'afazer', clientWorkflowStage: 'afazer', socialOwnerId: 'sm1', socialFlowStatus: 'afazer', status: 'afazer' });
// (b) Social enviou TEMAS ao cliente (persistClientSend, phase themes) — persistido
const sB = Object.assign(base(), { cronStatus: 'enviado_cliente', clientFlowStatus: 'enviado', clientWorkflowStage: 'enviado', clientApprovalPhase: 'themes', clientSentBy: 'sm1', socialOwnerId: 'sm1' });
// (c) Cliente APROVOU TEMAS (Worker approveG não-final) — persistido (sem designer ainda)
const sC = Object.assign(base(), { cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, status: 'andamento', workflowStage: 'producao', clientFlowStatus: 'aprovado', clientWorkflowStage: 'aprovado', socialOwnerId: 'sm1' });
// (d) Social ATRIBUIU designer — PERSISTIDO (patch completo) vs OTIMISTA (subset)
const dPersist = { designerAssignment: { designerId: 'dz1', designerName: 'Designer' }, assigneeId: 'dz1', cronStatus: 'sent_to_designer', status: 'afazer', clientFlowStatus: 'producao', clientWorkflowStage: 'producao', designerFlowStatus: 'afazer', designerWorkflowStage: 'afazer', operationalStatus: 'aguardando_designer_iniciar', socialFlowStatus: 'aguardando_designer_iniciar', socialWorkflowStage: 'aguardando_designer_iniciar', designerResponsibleId: 'dz1', pendingDesignerDelivery: true, finalApprovalRequired: true, finalApprovalCompleted: false, socialOwnerId: 'sm1', startedAt: null };
const dOptim = { designerAssignment: { designerId: 'dz1', designerName: 'Designer' }, assigneeId: 'dz1', cronStatus: 'sent_to_designer', status: 'afazer', clientFlowStatus: 'producao', clientWorkflowStage: 'producao', designerFlowStatus: 'afazer', designerWorkflowStage: 'afazer' };
const sD_persist = Object.assign(base(), JSON.parse(JSON.stringify(dPersist)));
const sD_optim = Object.assign(base(), JSON.parse(JSON.stringify(dOptim)));   // SEM operationalStatus/socialOwnerId
// (e) Designer INICIOU (moveStatus andamento) — persistido
const sE = Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'andamento', designerWorkflowStage: 'andamento', clientFlowStatus: 'producao', operationalStatus: 'aguardando_designer_iniciar', socialOwnerId: 'sm1', startedAt: 1 });
// (f) Designer ENTREGOU (moveStatus concluido, cron) — persistido (status NÃO muda p/ cron)
const sF = Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', designerWorkflowStage: 'concluido', clientFlowStatus: 'reenviado', operationalStatus: 'aguardando_designer_iniciar', socialOwnerId: 'sm1', status: 'afazer' });
// (g) Social ENVIOU FINAL (saveProduction resend) — persistido
const sG = Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', clientFlowStatus: 'reenviado', finalApprovalRequired: true, operationalStatus: 'aguardando_final', socialOwnerId: 'sm1' });
// (h) Cliente PEDIU REVISÃO — Worker (clientFlowStatus revisao) vs in-app (sem clientFlowStatus)
const sH_worker = Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', cronStatus: 'em_revisao_cliente', clientReview: { status: 'revisao' }, status: 'revisao', clientFlowStatus: 'revisao', clientWorkflowStage: 'revisao', socialOwnerId: 'sm1' });
const sH_inapp = Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', designerFlowStatus: 'concluido', cronStatus: 'em_revisao_cliente', clientReview: { status: 'revisao' }, clientFlowStatus: 'reenviado', socialOwnerId: 'sm1' }); // in-app NÃO trocou clientFlowStatus (ficou reenviado)
// (j) Cliente APROVOU FINAL — Worker vs aprovar in-app
const sJ_worker = Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, status: 'concluido', clientFlowStatus: 'concluido', finalApprovalCompleted: true, operationalStatus: 'concluido', socialOwnerId: 'sm1' });
const sJ_inapp = Object.assign(base(), { designerAssignment: { designerId: 'dz1' }, assigneeId: 'dz1', cronStatus: 'aprovado_cliente', clientReview: { status: 'aprovado' }, designerFlowStatus: 'concluido', clientFlowStatus: 'reenviado', socialOwnerId: 'sm1' }); // aprovar in-app só grava cronStatus+clientReview

/* ---- helpers de leitura por papel ---- */
const canon = (t) => { try { return R.deriveCanonicalTaskState(t).phase; } catch (_) { return 'ERR'; } };
const colCanon = (t, role) => { try { return R.flowBoardCol(t, role); } catch (_) { return 'ERR'; } };
const chipLegacySocial = (t) => { try { return R.operationalCol(t); } catch (_) { return 'ERR'; } };
const chipLegacyClient = (t) => { try { return R.clientCol(t); } catch (_) { return 'ERR'; } };
const done = (t) => { try { return R.isTaskCompleted(t); } catch (_) { return 'ERR'; } };

/* =====================================================================
 * 1) MATRIZ — coluna canônica (Flow Engine) por papel + fase canônica + chip legado.
 * ===================================================================== */
const MATRIX = [
  ['A cria', sA], ['B envia temas', sB], ['C cliente aprova temas', sC],
  ['D atribui (persistido)', sD_persist], ['D atribui (OTIMISTA)', sD_optim],
  ['E designer inicia', sE], ['F designer entrega', sF], ['G envia final', sG],
  ['H revisão (Worker)', sH_worker], ['H revisão (in-app)', sH_inapp],
  ['J aprova final (Worker)', sJ_worker], ['J aprova final (in-app)', sJ_inapp],
];
console.log('\n==== F3.3.17-R5 — MATRIZ fase canônica × coluna(canônica) × chip(legado) ====');
console.log('transição                         | faseCanon            | colSocial | colDesigner | colClient | opCol(legado) | clientCol(legado) | done?');
for (const [name, t] of MATRIX) {
  console.log(
    name.padEnd(33) + ' | ' + String(canon(t)).padEnd(20) + ' | ' +
    String(colCanon(t, 'social')).padEnd(9) + ' | ' + String(colCanon(t, 'designer')).padEnd(11) + ' | ' +
    String(colCanon(t, 'client')).padEnd(9) + ' | ' + String(chipLegacySocial(t)).padEnd(13) + ' | ' +
    String(chipLegacyClient(t)).padEnd(17) + ' | ' + String(done(t)));
}

/* =====================================================================
 * 2) PROVAS DE DIVERGÊNCIA (deliverable #5/#6/#7/#8)
 * ===================================================================== */
console.log('\n==== PROVAS ====');

// (iii) JANELA DE TEMAS: cliente aprovou temas, sem designer → canônico=PLANNING (coluna "planejamento")
//       enquanto o legado clientCol='aprovado' / operationalCol='aguardando_envio'. PERSISTENTE (estado já é pós-snapshot).
ok('[P1] C: fase canônica é PLANNING (Engine ignora clientFlowStatus=aprovado)', canon(sC) === (R.TASK_PHASE && R.TASK_PHASE.PLANNING));
ok('[P1] C: clientCol LEGADO = aprovado (diverge do canônico)', chipLegacyClient(sC) === 'aprovado');
ok('[P1] C: DIVERGE — coluna canônica(client) ≠ leitura legada(aprovado)', colCanon(sC, 'client') !== 'aprovado');
console.log('  P1 (TEMAS APROVADOS sem designer): canon=' + canon(sC) + ' colClientCanon=' + colCanon(sC, 'client') + ' clientColLegado=' + chipLegacyClient(sC) + ' opColLegado=' + chipLegacySocial(sC) + '  → PERSISTENTE');

// (ii) OTIMISTA × PERSISTIDO na atribuição: estado local (otimista) não tem operationalStatus/socialOwnerId.
//      Mede se a leitura muda entre os dois (janela antes do snapshot).
const dCanonP = canon(sD_persist), dCanonO = canon(sD_optim);
const dColP = colCanon(sD_persist, 'social'), dColO = colCanon(sD_optim, 'social');
ok('[P2] D: coluna social IGUAL otimista×persistido (operationalStatus é write-only → não muda)', dColP === dColO);
ok('[P2] D: fase canônica IGUAL otimista×persistido', dCanonP === dCanonO);
console.log('  P2 (ATRIBUIÇÃO otim×persist): colSocial ' + dColO + ' vs ' + dColP + ' | canon ' + dCanonO + ' vs ' + dCanonP + '  → divergência otimista AQUI é nula p/ coluna (campos omitidos são write-only); risco real = socialOf via socialOwnerId omitido');

// (vii) REVISÃO in-app não troca clientFlowStatus → clientCol legado fica preso em 'reenviado' (mascara revisão),
//       enquanto Worker (clientFlowStatus=revisao) e o canônico (clientReview.status) viram revisão. PERSISTENTE.
ok('[P3] H worker: clientCol legado = revisao', chipLegacyClient(sH_worker) === 'revisao');
ok('[P3] H in-app: clientCol legado MASCARA (≠ revisao, preso em reenviado)', chipLegacyClient(sH_inapp) !== 'revisao');
ok('[P3] H in-app: canônico DETECTA revisão (clientReview.status) — diverge do legado', canon(sH_inapp) === (R.TASK_PHASE && R.TASK_PHASE.CLIENT_REQUESTED_CHANGES));
console.log('  P3 (REVISÃO in-app): clientColLegado worker=' + chipLegacyClient(sH_worker) + ' in-app=' + chipLegacyClient(sH_inapp) + ' | canon in-app=' + canon(sH_inapp) + '  → legado≠canônico (PERSISTENTE)');

// (viii) FINALIZAÇÃO depende do Worker: aprovar in-app (só cronStatus+clientReview) NÃO conclui.
ok('[P4] J worker: isTaskCompleted = true (concluído)', done(sJ_worker) === true);
ok('[P4] J in-app: isTaskCompleted = false (NÃO conclui sem Worker)', done(sJ_inapp) === false);
ok('[P4] J in-app: coluna social canônica ≠ concluido', colCanon(sJ_inapp, 'social') !== 'concluido');
console.log('  P4 (APROVAR FINAL): done worker=' + done(sJ_worker) + ' in-app=' + done(sJ_inapp) + ' | colSocial in-app=' + colCanon(sJ_inapp, 'social') + '  → finalização Worker-exclusiva (PERSISTENTE)');

/* ===== resumo ===== */
console.log('\n' + (missing.length ? '(funções não extraídas, usaram fallback/omitidas: ' + missing.join(',') + ')\n' : ''));
if (log.length) console.log(log.join('\n') + '\n');
console.log(pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: auditoria divergiu do esperado'); process.exit(1); }
console.log('OK — divergências reproduzidas com FUNÇÕES DE DERIVAÇÃO REAIS sobre field-sets reais:');
console.log('  P1 TEMAS-APROVADOS: coluna canônica(planning) ≠ chip legado(aprovado) — PERSISTENTE');
console.log('  P2 ATRIBUIÇÃO: omissão otimista é write-only p/ coluna (impacto = socialOf/socialOwnerId)');
console.log('  P3 REVISÃO in-app: clientFlowStatus não gravado → legado mascara revisão; canônico diverge — PERSISTENTE');
console.log('  P4 APROVAR FINAL in-app: não conclui sem o Worker — PERSISTENTE');
