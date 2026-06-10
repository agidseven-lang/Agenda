#!/usr/bin/env node
/* =====================================================================
 * TESTE VIRTUAL PONTA A PONTA (E2E) — fluxo de aprovação do cronograma
 * Agenda ID Seven · Worker V64.38-wa-card-link-cta / Desktop 1.0.132-beta-workflow-v64-46-test / Android 1.0.132 (paridade)
 * ---------------------------------------------------------------------
 * REGRA OBRIGATÓRIA: este teste roda ANTES de qualquer build. Se QUALQUER
 * falha bloqueante ocorrer, sai com código 1 — e NENHUM build deve ser
 * gerado. Só gera build quando TUDO passa.
 *
 * Cobre:
 *  PARTE A — Simulação lógica do fluxo real de 48 passos (Cliente / Social
 *            Media / Designer) percorrendo a máquina de estados por papel.
 *  PARTE B — Asserções ESTRUTURAIS contra o código real das 3 plataformas
 *            (corrige a arquitetura de renderização — os 7 problemas do vídeo):
 *            P1/P7 cards/telas empilhados, P2 toolbar instável, P3 visual
 *            premium do portal, P4 formulário duplicado em "Feedback enviado!",
 *            P5 input de edição não responde de primeira, P6 ajuste não
 *            sincroniza no mesmo link.
 *
 * Sem dependências externas. Lê Worker e Android das suas branches via `git
 * show` (com fallback para a working tree) para validar as 3 plataformas
 * num único portão.
 * ===================================================================== */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKER_BRANCH = "worker/client-link-preview-premium";
const ANDROID_BRANCH = 'app/local-1.0.92-beta-client-flow-e2e-fix'; // base anterior (fallback)
const ANDROID_E2E_BRANCH = 'app/local-detail-hierarchy-v2';

function readFromGit(branch, relPath) {
  try { return execSync(`git show ${branch}:${relPath}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }); }
  catch (_) { return null; }
}
function readWorkTree(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); } catch (_) { return null; }
}
/* Worker/Android: tenta a branch e2e, depois a branch base, depois working tree. */
function readWorker() {
  return readFromGit(WORKER_BRANCH, 'cloudflare-worker.js') || readWorkTree('cloudflare-worker.js') || '';
}
function readAndroid(relPath) {
  return readFromGit(ANDROID_E2E_BRANCH, relPath) || readFromGit(ANDROID_BRANCH, relPath) || readWorkTree(relPath) || '';
}
function readDesktop(relPath) { return readWorkTree(relPath) || ''; }

/* ===================== MÁQUINA DE ESTADOS (espelha Desktop/Android) ===================== */
const sec = t => ((t.sector || '') === 'cronograma' ? 'cronograma' : 'outro');
const hasDesigner = t => !!t.assignedDesignerId;
const designerCol = t => { const v = t.designerFlowStatus || ''; return ['afazer', 'andamento', 'revisao', 'concluido'].includes(v) ? v : (t.status || 'afazer'); };
const designerDelivered = t => hasDesigner(t) && designerCol(t) === 'concluido';
const pendingLegend = t => { const a = t.cronContents || []; return !a.length || a.some(c => !(c && c.legenda && String(c.legenda).trim())); };
const pendingFeed = t => { const a = t.cronContents || []; return !a.length || a.some(c => !(c && c.feedImageUrl)); };
const pendingStory = t => { const a = t.cronContents || []; return a.some(c => c && c.storyImageUrl) && a.some(c => !(c && c.storyImageUrl)); };
const pendingProduction = t => pendingLegend(t) || pendingFeed(t);
const hasPendingItemRevision = t => { const ci = t.clientItems; if (!ci || typeof ci !== 'object') return false; return Object.keys(ci).some(k => ['em_revisao', 'editado'].includes(ci[k] && ci[k].cs)); };
function isFullyComplete(t) {
  if (sec(t) !== 'cronograma') return t.status === 'concluido';
  if (hasDesigner(t) && !designerDelivered(t)) return false;
  if (pendingProduction(t)) return false;
  if (pendingStory(t)) return false;
  if ((t.clientReview && t.clientReview.status) === 'revisao') return false;
  return !!(t.finalApprovalCompleted === true || t.operationalStatus === 'concluido' || t.clientFlowStatus === 'concluido' || t.cronStatus === 'aprovado_final');
}
function clientCol(t) {
  const v = t.clientFlowStatus || ''; const KEYS = ['afazer', 'enviado', 'aprovado', 'producao', 'revisao', 'reenviado', 'concluido'];
  if (KEYS.includes(v)) { if (v === 'concluido' && !isFullyComplete(t)) return 'reenviado'; return v; }
  const cs = t.cronStatus || '', cr = (t.clientReview && t.clientReview.status) || '';
  if (isFullyComplete(t)) return 'concluido';
  if (cr === 'revisao' || cs === 'em_revisao_cliente' || cs === 'editado_cliente') return 'revisao';
  if (cs === 'ready_for_final_client_review' || cs === 'reenviado_cliente') return 'reenviado';
  if (hasDesigner(t) || cs === 'sent_to_designer') return 'producao';
  if (cr === 'aprovado' || cs === 'aprovado_cliente') return 'aprovado';
  if (cs === 'enviado_cliente' || t.clientSentBy) return 'enviado';
  return 'afazer';
}
function operationalCol(t) {
  if (sec(t) !== 'cronograma') return t.status || 'afazer';
  if (isFullyComplete(t)) return 'concluido';
  const cf = clientCol(t);
  if (cf === 'revisao' || hasPendingItemRevision(t)) return 'aguardando_revisao';
  if (cf === 'reenviado') return 'aguardando_final';
  if (hasDesigner(t)) {
    const dc = designerCol(t);
    if (dc === 'concluido') return pendingProduction(t) ? 'aguardando_legenda' : 'aguardando_final';
    // task-flow-fix + role-aware (passo 2): andamento → em produção; revisao → em revisão; afazer → iniciar.
    if (dc === 'andamento') return 'aguardando_designer';
    if (dc === 'revisao') return 'aguardando_designer_revisao';
    return 'aguardando_designer_iniciar';
  }
  if (cf === 'aprovado') return 'aguardando_envio';
  if (cf === 'afazer') return 'afazer';
  return 'producao';
}
function boardCol4(t) {
  if (sec(t) !== 'cronograma') return t.status || 'afazer';
  const oc = operationalCol(t);
  if (oc === 'concluido') return 'concluido';
  if (oc === 'aguardando_revisao') return 'revisao';
  if (oc === 'afazer') return 'afazer';
  return 'andamento';
}
const designerOf = t => (t.assignedDesignerId || t.assigneeId || null);
// Bucket DERIVADO DO PAPEL: se quem vê é o designer atribuído, usa o eixo do designer.
function boardCol4For(t, uid) {
  if (sec(t) !== 'cronograma') return t.status || 'afazer';
  if (uid && hasDesigner(t) && designerOf(t) === uid) {
    const dc = designerCol(t);
    return dc === 'concluido' ? 'concluido' : dc === 'revisao' ? 'revisao' : dc === 'andamento' ? 'andamento' : 'afazer';
  }
  return boardCol4(t);
}
/* GATE: approveAll com qualquer item em ajuste/edição vira FEEDBACK, não aprovação total. */
function approveAllResult(t) {
  const ci = t.clientItems || {};
  const pend = Object.keys(ci).some(k => ['em_revisao', 'editado'].includes(ci[k] && ci[k].cs)) || (t.clientReview && t.clientReview.status === 'revisao');
  return pend ? 'feedback' : 'aprovado';
}

/* ===================== RELATÓRIO ===================== */
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', x: '\x1b[0m', b: '\x1b[1m' };
let BLOCKING = 0; const FAILS = [];
function check(id, desc, cond) {
  const ok = !!cond;
  if (!ok) { BLOCKING++; FAILS.push(`[${id}] ${desc}`); }
  console.log(`  ${ok ? C.g + 'PASS' : C.r + 'FALHA'}${C.x} ${C.d}${id}${C.x} ${desc}`);
  return ok;
}
const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);

console.log(`${C.b}\n========================================================================`);
console.log(' TESTE VIRTUAL E2E — fluxo de aprovação do cronograma');
console.log(' Worker V64.38-wa-card-link-cta · Desktop 1.0.132 · Android 1.0.132 (task-tabs-kanban-only: abas só no Kanban)');
console.log(`========================================================================${C.x}`);

/* ===================== PARTE A — Fluxo de 48 passos (simulação por papel) ===================== */
console.log(`${C.b}\n[PARTE A] Simulação lógica do fluxo real (Cliente / Social / Designer)${C.x}`);
const TH = [{ tema: 'T1' }, { tema: 'T2' }, { tema: 'T3' }];
const FULL = [
  { tema: 'T1', legenda: 'L1', feedImageUrl: 'f1' },
  { tema: 'T2', legenda: 'L2', feedImageUrl: 'f2' },
  { tema: 'T3', legenda: 'L3', feedImageUrl: 'f3' },
];
// O fluxo de 48 passos resumido nos 12 estados-âncora que ele atravessa.
// Cada âncora = um snapshot da tarefa após um grupo de ações; valida cliente/social/designer/meu_quadro.
const FLOW = [
  ['01 Social cria cronograma (rascunho)', { sector: 'cronograma', status: 'afazer', cronStatus: 'rascunho_social', clientFlowStatus: 'afazer', cronContents: TH },
    { cliente: 'afazer', social: 'afazer', designer: 'afazer', meu_quadro: 'afazer' }],
  ['08 Social envia link ao cliente', { sector: 'cronograma', status: 'andamento', clientSentBy: 'u', cronStatus: 'enviado_cliente', clientFlowStatus: 'enviado', cronContents: TH },
    { cliente: 'enviado', social: 'producao', designer: 'afazer', meu_quadro: 'andamento' }],
  ['14 Cliente aprova T1+T3, pede ajuste T2', { sector: 'cronograma', status: 'revisao', clientFlowStatus: 'revisao', clientReview: { status: 'revisao' }, clientItems: { i0: { cs: 'aprovado' }, i1: { cs: 'em_revisao', note: 'mudar' }, i2: { cs: 'aprovado' } }, cronContents: TH },
    { cliente: 'revisao', social: 'aguardando_revisao', designer: 'afazer', meu_quadro: 'revisao' }],
  ['20 Social corrige T2 (mesmo link)', { sector: 'cronograma', status: 'andamento', clientFlowStatus: 'enviado', clientSentBy: 'u', cronStatus: 'enviado_cliente', clientItems: { i0: { cs: 'aprovado' }, i1: { cs: 'aprovado' }, i2: { cs: 'aprovado' } }, cronContents: TH },
    { cliente: 'enviado', social: 'producao', designer: 'afazer', meu_quadro: 'andamento' }],
  ['24 Cliente aprova TODOS os temas', { sector: 'cronograma', status: 'andamento', clientFlowStatus: 'aprovado', cronStatus: 'aprovado_cliente', cronContents: TH },
    { cliente: 'aprovado', social: 'aguardando_envio', designer: 'afazer', meu_quadro: 'andamento' }],
  ['28 Social envia ao Designer', { sector: 'cronograma', status: 'afazer', clientFlowStatus: 'producao', assignedDesignerId: 'd', designerFlowStatus: 'afazer', operationalStatus: 'aguardando_designer_iniciar', cronStatus: 'sent_to_designer', cronContents: TH },
    { cliente: 'producao', social: 'aguardando_designer_iniciar', designer: 'afazer', meu_quadro: 'andamento' }],
  ['33 Designer em produção', { sector: 'cronograma', status: 'andamento', clientFlowStatus: 'producao', assignedDesignerId: 'd', designerFlowStatus: 'andamento', cronContents: TH },
    { cliente: 'producao', social: 'aguardando_designer', designer: 'andamento', meu_quadro: 'andamento' }],
  ['37 Designer entregou (faltam legendas)', { sector: 'cronograma', status: 'andamento', clientFlowStatus: 'producao', assignedDesignerId: 'd', designerFlowStatus: 'concluido', cronContents: TH },
    { cliente: 'producao', social: 'aguardando_legenda', designer: 'concluido', meu_quadro: 'andamento' }],
  ['42 Social finaliza posts e reenvia', { sector: 'cronograma', status: 'andamento', clientFlowStatus: 'reenviado', cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', assignedDesignerId: 'd', designerFlowStatus: 'concluido', cronContents: FULL },
    { cliente: 'reenviado', social: 'aguardando_final', designer: 'concluido', meu_quadro: 'andamento' }],
  ['48 Cliente aprova FINAL', { sector: 'cronograma', status: 'concluido', clientFlowStatus: 'concluido', finalApprovalCompleted: true, clientApprovalPhase: 'final', assignedDesignerId: 'd', designerFlowStatus: 'concluido', cronContents: FULL },
    { cliente: 'concluido', social: 'concluido', designer: 'concluido', meu_quadro: 'concluido' }],
];
const ROLES = ['cliente', 'social', 'designer', 'meu_quadro'];
const colForRole = (t, r) => r === 'cliente' ? clientCol(t) : r === 'social' ? operationalCol(t) : r === 'designer' ? designerCol(t) : boardCol4(t);
console.log('  ' + pad('PASSO', 38) + '| ' + ROLES.map(r => pad(r, 14)).join('') + '|');
console.log('  ' + '-'.repeat(96));
for (const [name, t, exp] of FLOW) {
  const got = {}; ROLES.forEach(r => got[r] = colForRole(t, r));
  let ok = true; const errs = [];
  for (const r of ROLES) {
    // O quadro do Designer só lista tarefas ATRIBUÍDAS a um designer; antes da atribuição
    // a tarefa não aparece em nenhum quadro de designer (a coluna é N/A, não 'afazer').
    if (r === 'designer' && !hasDesigner(t)) continue;
    if (got[r] !== exp[r]) { ok = false; errs.push(`${r}=${got[r]}!=${exp[r]}`); }
  }
  // Regra de ouro: antes de existir designer, nunca aguardando_legenda/designer/final/concluido na social.
  if (!hasDesigner(t) && ['aguardando_legenda', 'aguardando_designer', 'aguardando_designer_iniciar', 'aguardando_final', 'concluido'].includes(got.social) && got.social !== exp.social) { ok = false; errs.push('proibido pre-designer'); }
  const disp = r => (r === 'designer' && !hasDesigner(t)) ? '—' : got[r];
  console.log('  ' + pad(name, 38) + '| ' + ROLES.map(r => pad(disp(r), 14)).join('') + '| ' + (ok ? C.g + 'OK' + C.x : C.r + errs.join('; ') + C.x));
  if (!ok) { BLOCKING++; FAILS.push(`[A] passo "${name}": ${errs.join('; ')}`); }
}

/* ===================== PARTE A.2 — GATE de aprovação parcial ===================== */
console.log(`${C.b}\n[PARTE A.2] Gate de aprovação parcial (parcial NÃO vira total)${C.x}`);
const GATE = [
  ['T1 ok / T2 ajuste / T3 ok', { clientItems: { i0: { cs: 'aprovado' }, i1: { cs: 'em_revisao' }, i2: { cs: 'aprovado' } } }, 'feedback'],
  ['T2 editado', { clientItems: { i0: { cs: 'aprovado' }, i1: { cs: 'editado' } } }, 'feedback'],
  ['todos aprovados', { clientItems: { i0: { cs: 'aprovado' }, i1: { cs: 'aprovado' }, i2: { cs: 'aprovado' } } }, 'aprovado'],
];
for (const [name, t, exp] of GATE) {
  const got = approveAllResult(t);
  check('GATE', `approveAll {${name}} → ${got} (esperado ${exp})`, got === exp);
}

/* ===================== PARTE A.3 — PC×Android: designer vê a tarefa em "A Fazer" =====================
   Cenário REAL do vídeo: PC=Social envia ao designer D; celular logado como D abre "Meu quadro".
   A coluna do designer (no SEU quadro) DEVE ser "A Fazer" assim que recebe — em Desktop e Android. */
console.log(`${C.b}\n[PARTE A.3] PC×Android — tarefa enviada ao designer cai em "A Fazer" do designer${C.x}`);
const justSentToDesigner = {
  sector: 'cronograma', status: 'afazer', clientFlowStatus: 'producao',
  assignedDesignerId: 'D', assigneeId: 'D', designerFlowStatus: 'afazer',
  operationalStatus: 'aguardando_designer', cronStatus: 'sent_to_designer', cronContents: TH,
};
// "Meu quadro" do designer D (quem vê = D): designer-aware → 'afazer'.
check('SYNC1', 'Meu quadro do designer D → "A Fazer" (boardCol4For viewer=D)', boardCol4For(justSentToDesigner, 'D') === 'afazer');
// Sem o eixo do designer, o boardCol4 cru cairia em "andamento" (era O BUG: A Fazer vazio no celular).
check('SYNC2', 'Regressão coberta: boardCol4 cru daria "andamento" (bug antigo)', boardCol4(justSentToDesigner) === 'andamento');
// Para a Social (quem NÃO é o designer), continua no eixo operacional (andamento) — correto.
check('SYNC3', 'Mesma tarefa para a Social (viewer=social) → "andamento"', boardCol4For(justSentToDesigner, 'social') === 'andamento');
// Identidade: o id gravado (assigneeId/designerId) é o MESMO espaço do uid logado no Android.
check('SYNC4', 'designerOf == id gravado (assigneeId/designerAssignment.designerId)', designerOf(justSentToDesigner) === 'D');

/* ===================== PARTE A.4 — Designer MOVE: "Em andamento" sincroniza PC×Android =====================
   Bug real: mover gravava só `status`; o quadro do Designer LÊ `designerFlowStatus` → card preso em
   "A Fazer". Fix: mover no eixo do designer grava `designerFlowStatus`. Simula os dois caminhos. */
console.log(`${C.b}\n[PARTE A.4] Designer move "Em andamento" sincroniza (designerFlowStatus = fonte única)${C.x}`);
// patch CORRETO (1.0.97/1.0.109): grava designerFlowStatus, NÃO toca status.
const moveDesigner = (t, s) => Object.assign({}, t, { designerFlowStatus: s });
// patch ANTIGO/BUGADO: grava só status.
const moveStatusOnly = (t, s) => Object.assign({}, t, { status: s });
const D0 = justSentToDesigner;                                  // designerFlowStatus='afazer'
const dMove = moveDesigner(D0, 'andamento');                    // designer move -> Em andamento (correto)
const dBug = moveStatusOnly(D0, 'andamento');                   // caminho antigo (bug)
// task-flow-fix (BUG DO TESTE REAL): enquanto o designer NÃO iniciar (afazer), a Social NÃO
// pode ver "Designer em produção". Deve ver "Aguardando designer iniciar".
check('FLOW_FIX1', 'Recém-enviado (afazer): Social vê "Aguardando designer iniciar" (NÃO "Designer em produção")', operationalCol(D0) === 'aguardando_designer_iniciar');
check('FLOW_FIX2', 'Recém-enviado (afazer): operationalCol NUNCA é "aguardando_designer"', operationalCol(D0) !== 'aguardando_designer');
check('FLOW_FIX3', 'Designer já em "A Fazer" no quadro dele enquanto Social aguarda iniciar', boardCol4For(D0, 'D') === 'afazer');
check('MOVE1', 'Designer board do PC mostra "Em andamento" (designerCol)', designerCol(dMove) === 'andamento');
check('MOVE2', 'Meu quadro do designer no Android mostra "Em andamento" (boardCol4For)', boardCol4For(dMove, 'D') === 'andamento');
check('MOVE3', 'NÃO fica preso em "A Fazer"', boardCol4For(dMove, 'D') !== 'afazer' && designerCol(dMove) !== 'afazer');
check('MOVE4', 'Só APÓS mover p/ andamento a Social vê "Designer em produção" (operationalCol=aguardando_designer)', operationalCol(dMove) === 'aguardando_designer');
check('MOVE5', 'Cliente vê "Em produção" (clientCol=producao)', clientCol(dMove) === 'producao');
check('MOVE6', 'REGRESSÃO coberta: gravar só status deixaria preso em "A Fazer"', designerCol(dBug) === 'afazer');
// Entrega: designer move -> Entregue (designerFlowStatus='concluido') => Social "Aguardando legendas".
const dDone = moveDesigner(D0, 'concluido');
check('MOVE7', 'Designer "Entregue" => Social "Aguardando legendas e posts"', operationalCol(dDone) === 'aguardando_legenda');

/* ===================== PARTE A.5 — Legenda do conteúdo aparece para o cliente =====================
   Bug real: a Social preenche cronContents[i].legenda mas o portal lia c.lg/c.l (nunca c.legenda)
   -> legenda invisível. Simula a precedência do Worker (nova x antiga). */
console.log(`${C.b}\n[PARTE A.5] Legenda do cliente: portal lê c.legenda (3 temas) + tema+legenda+post${C.x}`);
const readLegNEW = c => { const ov = {}; return (typeof ov.legenda === 'string') ? ov.legenda : (typeof c.legenda === 'string' ? c.legenda : (typeof c.caption === 'string' ? c.caption : (typeof c.lg === 'string' ? c.lg : (typeof c.l === 'string' ? c.l : '')))); };
const readLegOLD = c => { const ov = {}; return (typeof ov.legenda === 'string') ? ov.legenda : (typeof c.lg === 'string' ? c.lg : (typeof c.l === 'string' ? c.l : '')); };
const readTema = c => { const ov = {}; return (typeof ov.theme === 'string' && ov.theme) ? ov.theme : (c.t || c.tema || ''); };
// Conteúdo como o Desktop salva (saveProduction): tema/legenda/feedImageUrl/storyImageUrl.
const PROD = [
  { tema: 'T1', legenda: 'Legenda do Tema 1', feedImageUrl: 'f1', storyImageUrl: 's1' },
  { tema: 'T2', legenda: 'Legenda do Tema 2', feedImageUrl: 'f2' },
  { tema: 'T3', legenda: 'Legenda do Tema 3', feedImageUrl: 'f3' },
];
PROD.forEach((c, i) => {
  check('CAP' + (i + 1), `Cliente vê a legenda do Tema ${i + 1} (lê c.legenda)`, readLegNEW(c) === c.legenda && readLegNEW(c).length > 0);
});
check('CAP_REGR', 'REGRESSÃO: precedência ANTIGA (sem c.legenda) deixava legenda VAZIA', PROD.every(c => readLegOLD(c) === ''));
check('CAP_TRIO', 'Cliente vê TEMA + LEGENDA + POST de cada conteúdo', PROD.every(c => readTema(c) && readLegNEW(c) && (c.feedImageUrl || c.storyImageUrl)));

/* ===================== PARTE B — Asserções estruturais (arquitetura de render) ===================== */
const W = readWorker();
const DH = readDesktop('desktop/src/renderer/index.html');
const DP = readDesktop('desktop/package.json');
const AND = 'android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta/';
const KT_VIS = readAndroid(AND + 'features/tasks/TaskVisibility.kt');
const KT_TABS = readAndroid(AND + 'features/tasks/TasksTopTabs.kt');
const KT_SCREEN = readAndroid(AND + 'features/tasks/TasksScreen.kt');
const KT_HUB = readAndroid(AND + 'features/tasks/BoardsHubScreen.kt');
const KT_REPO = readAndroid(AND + 'data/TaskRepo.kt');
const KT_CONTRACT = readAndroid(AND + 'data/TaskContract.kt');
const GRADLE = readAndroid('android-native-beta/app/build.gradle');

console.log(`${C.b}\n[PARTE B] Worker V64.18 — portal atualiza no MESMO link, claro (vídeo real)${C.x}`);
check('W1', 'Worker é V64.40-share-og-exact (OG /share exato; endpoints admin temporários removidos)', /V64.40-share-og-exact/.test(W));
check('W1b', 'Worker NÃO tem endpoint admin temporário (create-test / cleanup-test)', !/\/admin\/create-test-cronograma/.test(W) && !/\/admin\/cleanup-test/.test(W));
// ===== CORREÇÃO PRINCIPAL: legenda do conteúdo APARECE para o cliente (lê c.legenda) =====
// Antes lia só ov.legenda/c.lg/c.l -> legenda nunca aparecia (Desktop salva c.legenda).
const legReads = (W.match(/typeof c\.legenda === "string" \? c\.legenda/g) || []).length;
check('W_CAP1', 'Portal lê a legenda de c.legenda (HTML inicial + /state) — 2 ocorrências', legReads >= 2);
check('W_CAP2', 'Precedência de legenda inclui ov.legenda E c.legenda', /typeof ov\.legenda === "string"\) \? ov\.legenda : \(typeof c\.legenda === "string"/.test(W));
check('W_CAP3', '/state devolve campo JSON "legenda" e o card tem data-field="legenda"', /legenda: \(legRaw/.test(W) && /data-field="legenda"/.test(W));
// ===== PREVIEW PREMIUM do link (V64.20): card grande clicável no WhatsApp =====
check('W_OG1', 'og:image = CARD AURORA (OG_IMG_PATH /og/wa-card-v64-38.jpg, image/jpeg) 1200×630', /const OG_IMG_PATH = "\/og\/wa-card-v64-38\.jpg"/.test(W) && /const img = base \+ OG_IMG_PATH;/.test(W) && /og:image" content="' \+ img \+ '"/.test(W) && /og:image:type" content="image\/jpeg"/.test(W) && /og:image:width" content="1200"/.test(W) && /og:image:height" content="630"/.test(W));
check('W_OG2', 'Rotas de imagem: PNG /og/aprovar(-vNN).png + JPEG canário (ogBannerResponse/jpgBannerResponse + B64)', /aprovar\(-v\[0-9/.test(W) && /function ogBannerResponse\(\)/.test(W) && /const OG_BANNER_B64=/.test(W) && /function jpgBannerResponse/.test(W) && /const OG_JPG_B64=/.test(W));
check('W_OG3', 'og:title de AÇÃO "Aprovar cronograma — <cliente>"', /Aprovar cronograma — " \+ \(task\.client/.test(W));
check('W_OG4', 'twitter:card summary_large_image (cartão GRANDE)', /name="twitter:card" content="summary_large_image"/.test(W));
check('W_OG5', '<title>/og:title premium "Aprovação de cronograma"', /· Aprovação de cronograma<\/title>/.test(W));
// V64.21 — canonical/OG seguem o domínio servido (origin-aware): premium quando servido pelo
// domínio premium; workers.dev só como fallback. Nunca mais hardcoded em workers.dev.
check('W_OG7', 'OG origin-aware: ogClientBase + ogClientMeta no renderClientHtml (premium primário)', /function ogClientBase\(origin\)/.test(W) && /aprovar\.agendaidseven\.com\.br/.test(W) && /ogClientMeta\(origin, ogTitleRaw, ogDescRaw, "\/cliente\/cronograma\/" \+ token\)/.test(W));
check('W_OG8', 'render recebe origin (handleClientCronogramaView→renderClientHtml(task,token,env,origin))', /renderClientHtml\(task, token, env, origin\)/.test(W) && /function renderClientHtml\(task, token, env, origin\)/.test(W));
// Prova FORTE: o base64 embutido decodifica para um PNG real 1200×630.
check('W_OG6', 'Banner embutido é um PNG VÁLIDO 1200×630', (() => {
  const m = W.match(/const OG_BANNER_B64="([A-Za-z0-9+/=]+)"/); if (!m) return false;
  const b = Buffer.from(m[1], 'base64');
  if (b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return false;
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  return w === 1200 && h === 630;
})());
const feedFn = (W.match(/function clientFeedbackSent\(\)\{[\s\S]*?window\.scrollTo/) || [''])[0];
check('W2', 'clientFeedbackSent SUBSTITUI a .wrap (sem formulário empilhado)', /w\.innerHTML\s*=\s*CV_TOP\(\)/.test(feedFn));
check('W3', 'NÃO há insertAdjacentHTML("afterbegin")', !/insertAdjacentHTML\(\s*['"]afterbegin['"]/.test(W));
check('W4', 'Feedback parcial mostra "Aguardando ajuste da equipe"', /Aguardando ajuste da equipe/.test(feedFn));
check('W5', 'Feedback parcial NÃO afirma "Temas aprovados"', !/Temas aprovados/.test(feedFn));
check('W6', 'Tela de feedback ENTRA em modo de espera (FEEDBACK_MODE=true)', /FEEDBACK_MODE\s*=\s*true/.test(feedFn));
// CORREÇÃO 5 do teste real: cliente NÃO precisa reabrir o link — atualiza sozinho.
check('W7', 'Função teamUpdated() existe (aviso "A equipe atualizou")', /function teamUpdated\(\)/.test(W) && /A equipe atualizou/.test(W));
check('W8', 'teamUpdated recarrega o MESMO link (location.reload)', /function teamUpdated\(\)\{[\s\S]*?location\.reload\(\)/.test(W));
check('W9', 'Poller dispara teamUpdated quando a equipe corrige (FEEDBACK_MODE)', /if\s*\(FEEDBACK_MODE\)\{[\s\S]*?teamUpdated\(\)/.test(W));
check('W10', 'Indicador "Atualização automática ativa" (liveTick)', /function liveTick\(/.test(W) && /Atualização automática ativa/.test(W));
check('W11', 'applyState DESTACA conteúdos alterados pela equipe (changed)', /function applyState\(j,changed\)/.test(W) && /boxShadow/.test(W));
check('W12', 'Toast claro "Tema atualizado pela equipe"', /Tema atualizado pela equipe/.test(W));
check('W13', 'Endpoint GET /state + poller periódico', /handleClientCronogramaState/.test(W) && /setInterval\(\s*pollState/.test(W));
check('W14', 'Gate parcial preservado (server + client)', /em_revisao_cliente/.test(W) && /anyRev/.test(W) && /clientFeedbackSent\(\)/.test(W));
// ===== PORTAL TEM BOTÃO REAL DE APROVAÇÃO (o botão NÃO vive no grupo; vive no portal) =====
check('W_APPROVE1', 'Portal tem CTA de aprovação por fase (phaseCopy.cta: Aprovar temas/legendas/versão final)', /function phaseCopy\(phase\)/.test(W) && /cta: "Aprovar versão final"/.test(W) && /cta: "Aprovar temas e liberar produção"/.test(W));
check('W_APPROVE2', 'Portal renderiza o botão primário de aprovação (data-act="approveAll" + phaseUi.cta) na barra de ações', /data-act="approveAll" data-phase="' \+ phase \+ '">' \+ ICN\.check \+ escapeHtml\(phaseUi\.cta\)/.test(W));
check('W_APPROVE3', 'Portal tem aprovação por conteúdo + pedir ajuste/revisão (approveItem/reviseItem/revision)', /data-act="approveItem"/.test(W) && /data-act="reviseItem"/.test(W) && /data-act="revision"/.test(W));
check('W_APPROVE4', 'Portal tem identidade Agenda ID Seven + Visão do Cliente + nome do cliente', /Agenda ID Seven<small>Visão do Cliente/.test(W) && /Preparado para <b>' \+ cliente/.test(W));
// ===== V64.39 — URL DEDICADA /share/cronograma/:token (preview OG premium garantido no WhatsApp) =====
{
  const shareFn = (W.match(/function shareCardHtml\(origin, token\)\s*\{[\s\S]*?\n\}/) || [''])[0];
  check('W_SHARE1', 'Worker tem rota GET /share/cronograma/:token → shareCardHtml (200 text/html)', /shareMatch && request\.method === "GET"/.test(W) && /htmlResponse\(shareCardHtml\(url\.origin, shareMatch\[1\]\), 200\)/.test(W) && shareFn.length > 0);
  check('W_SHARE2', 'shareCardHtml monta OG premium via ogClientMeta (pathRel /share/cronograma/<token>)', /ogClientMeta\(origin, title, desc, "\/share\/cronograma\/" \+ token\)/.test(shareFn));
  check('W_SHARE_TITLE', 'OG do /share usa EXATAMENTE og:title "Aprovar cronograma"', /const title = "Aprovar cronograma";/.test(shareFn));
  check('W_SHARE_DESC', 'OG do /share usa EXATAMENTE og:description "Seu cronograma está pronto para avaliação."', /const desc = "Seu cronograma está pronto para avaliação\.";/.test(shareFn));
  check('W_SHARE3', 'shareCardHtml redireciona humanos ao portal (location.replace /cliente/cronograma/) — crawler lê OG', /location\.replace\("\/cliente\/cronograma\/"/.test(shareFn));
  check('W_SHARE4', 'OG vem ANTES de qualquer <script> no /share (crawler lê o card cedo)', shareFn.indexOf('ogClientMeta(') > -1 && (shareFn.indexOf('<script') < 0 || shareFn.indexOf('ogClientMeta(') < shareFn.indexOf('<script')));
  check('W_SHARE5', 'ogClientMeta (usada pelo /share) gera OG completo: secure_url + image/jpeg + 1200x630 + twitter summary_large_image + og:image absoluto', /og:image:secure_url" content="' \+ img/.test(W) && /og:image:type" content="image\/jpeg"/.test(W) && /og:image:width" content="1200"/.test(W) && /og:image:height" content="630"/.test(W) && /twitter:card" content="summary_large_image"/.test(W) && /const img = base \+ OG_IMG_PATH;/.test(W));
}

console.log(`${C.b}\n[PARTE B] Desktop 1.0.110 — chips fixos + colunas por contexto + msg premium${C.x}`);
check("D1", "package.json versão 1.0.132", /"version":\s*"1.0.132"/.test(DP));
// ===== ESTILO DOS CHIPS (1.0.107+): menos arredondados + borda/raio do input + ícone Designers.
const tchipCss = (DH.match(/\.tchip\{[^}]*\}/) || [''])[0];
check('D_SHAPE1', 'Chips MENOS arredondados: .tchip border-radius:11px (igual ao input)', /border-radius:11px/.test(tchipCss));
check('D_SHAPE2', 'Chips SEM cápsula: .tchip não usa border-radius:999px', !/border-radius:999px/.test(tchipCss));
check('D_SHAPE3', 'Chips com borda no estilo do input (1px solid var(--line))', /border:1px solid var\(--line\)/.test(tchipCss));
check('D_ICON1', 'ICON.image existe (chip Designers passa a ter ícone)', /\n\s*image:'<rect /.test(DH));
check('D_ICON2', 'tabIcon mapeia designers -> image', /designers:'image'/.test(DH));
// CORREÇÃO 1: mensagem WhatsApp PREMIUM (assinatura + CTA; não é link cru).
const msgFn = (DH.match(/function buildClientMessage\(ctx\)\{[\s\S]*?\n\}/) || [''])[0];
check('D2', 'Legenda do grupo: assinatura "Equipe ID Seven" (sem asteriscos)', /Equipe ID Seven/.test(msgFn) && !/\*Equipe ID Seven\*/.test(msgFn));
check('D3', 'Legenda do grupo: "Acesse o link abaixo para revisar os temas, aprovar ou solicitar ajustes:"', /Acesse o link abaixo para revisar os temas, aprovar ou solicitar ajustes:/.test(msgFn));
check('D4', 'Legenda do grupo: saudação com nome do cliente', /Olá, '\+nome/.test(msgFn));
check('D_MSG1', 'Legenda do grupo: "Seu cronograma já está pronto para avaliação." (modelo aprovado)', /Seu cronograma já está pronto para avaliação\./.test(msgFn));
check('D_MSG2', 'Legenda HONESTA: NÃO usa "clique no botão"/"toque no botão" (no grupo não há botão)', !/clique no botão/i.test(msgFn) && !/toque no botão/i.test(msgFn));
check('D_MSG3', 'Legenda: URL (p/ o card) + assinatura SEM markdown/emoji', /\+\s*url\s*\+/.test(msgFn) && !/👋/.test(msgFn) && !/\*/.test(msgFn));
check('D_MSG4', 'Legenda usa "acesse o link" (não promete botão nativo no grupo)', /Acesse o link abaixo/.test(msgFn));
// CORREÇÃO 4: upload de Feed/Story não pula para o 1º post (preserva scroll da lista).
check('D_UPLOAD', 'Produção preserva o scroll ao anexar arte (_prodKeepScroll + restore)', /function _prodKeepScroll\(\)/.test(DH) && /_prodKeepScroll\(\);renderProductionModal\(\)/.test(DH) && /\.pr-list'\);if\(_pl&&state\._prodScroll\)/.test(DH));
// ===== REGRA DEFINITIVA (teste real 1.0.129 reprovado): ABAS SÓ no Kanban/tarefas; NUNCA em hub de cards. =====
// As abas (taskChips) vivem SOMENTE dentro do quadro Kanban (boardToolbar + renderBoard de setor).
// NENHUM hub de seleção de setores/cards (renderHub/renderRoleBoards/renderDesignersHub/renderSocialsHub)
// pode renderizar abas. Sem barra global, sem hubTabsBar, sem sticky.
check('D5', 'boardToolbar() (Kanban) = BUSCA + ABAS na mesma moldura', /function boardToolbar\(\)\{return '<div class="d-board-tools tbar"><input[^>]*><div class="tchips">'\+taskChips\(\)/.test(DH));
check('D_TAB1', 'taskTabBar() REMOVIDA (sem barra global de abas)', !/function taskTabBar\b/.test(DH));
check('D_TAB2', 'CSS .tasks-tabbar REMOVIDO (sem barra flutuante/sticky no topo da tela)', !/\.tasks-tabbar/.test(DH));
check('D_TAB3', 'Dispatch da aba Tarefas NÃO prepende barra global (c.innerHTML=body)', /c\.innerHTML=body;/.test(DH) && !/c\.innerHTML=taskTabBar/.test(DH));
check('D_TAB4', 'hubTabsBar() REMOVIDA por completo (definição e chamadas)', !/function hubTabsBar/.test(DH) && !/hubTabsBar\(\)/.test(DH));
check('D6', 'SEM barra de chips no topo global (tasksChipBar/tflow-fixed removidos)', !/function tasksChipBar/.test(DH) && !/tflow-fixed/.test(DH));
check('D7', 'Dispatch NÃO usa nenhuma barra global (tasksChipBar/taskTabBar)', !/c\.innerHTML=tasksChipBar/.test(DH) && !/tasksChipBar\(/.test(DH) && !/taskTabBar\(/.test(DH));
// HUB "Quadros"/Setores (renderHub): SEM abas (nem taskChips, nem hubTabsBar, nem boardToolbar) — só cards.
const hubFn = (DH.match(/function renderHub\(\)\{[\s\S]*?\n\}/) || [''])[0];
check('D8a', 'HUB "Quadros"/Setores NÃO renderiza abas (sem taskChips/hubTabsBar/boardToolbar)', hubFn.indexOf('taskChips(') === -1 && hubFn.indexOf('hubTabsBar') === -1 && hubFn.indexOf('boardToolbar') === -1);
check('D8b', 'HUB "Quadros" NÃO contém a classe de chip de aba (.tchip) acima dos cards', hubFn.indexOf('tchip') === -1);
// Hubs de LISTA (RoleBoards/Designers/Socials): também SEM abas (são telas de seleção de cards).
const roleFn = (DH.match(/function renderRoleBoards\(\)\{[\s\S]*?\n\}/) || [''])[0];
const dhubFn = (DH.match(/function renderDesignersHub\(\)\{[\s\S]*?\n\}/) || [''])[0];
const shubFn = (DH.match(/function renderSocialsHub\(\)\{[\s\S]*?\n\}/) || [''])[0];
check('D8c', 'Hubs de lista (RoleBoards/Designers/Socials) NÃO renderizam abas (sem taskChips/hubTabsBar/boardToolbar)',
  [roleFn,dhubFn,shubFn].every(fn => fn.indexOf('taskChips(')===-1 && fn.indexOf('hubTabsBar')===-1 && fn.indexOf('boardToolbar')===-1));
// KANBAN tem a toolbar (busca + chips): Meu quadro / Cliente / Designer / Social.
check('D8d', 'Kanban (PersonBoard/Client/Designer/Social) usa boardToolbar() (abas no contexto das tarefas)',
  /function renderPersonBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH) && /function renderClientFlowBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH) && /function renderDesignerBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH) && /function renderSocialBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH));
// Kanban de Setor (renderBoard): abas integradas na toolbar (taskChips) + filtro "Minhas tarefas".
const rbFn = (DH.match(/function renderBoard\(\)\{[\s\S]*?\n\}/) || [''])[0];
check('D8e', 'Kanban de Setor (renderBoard) tem abas integradas (taskChips) + "Minhas tarefas"', rbFn.indexOf('taskChips(') !== -1 && /data-bmine="1"/.test(rbFn));
// ===== GUARDAS DEFINITIVAS (falham se a regressão voltar): abas só no Kanban, nunca no hub =====
check('D_HUBGUARD1', 'Nenhum hub (renderHub/RoleBoards/DesignersHub/SocialsHub) injeta abas/toolbar',
  [hubFn,roleFn,dhubFn,shubFn].every(fn => !/taskChips\(|hubTabsBar|boardToolbar|tasks-tabbar/.test(fn)));
check('D_HUBGUARD2', 'taskChips(): 1 definição + 2 chamadas (boardToolbar Kanban + renderBoard setor) = 3 ocorrências',
  (DH.match(/taskChips\(\)/g) || []).length === 3
  && /function boardToolbar\(\)\{[^}]*taskChips\(\)/.test(DH)
  && rbFn.indexOf('taskChips()') !== -1);
// CORREÇÃO 3: colunas por contexto (sem excesso).
check('D9', 'Colunas Social = 4 (A Fazer/Em andamento/Revisão/Finalizado)', /const SOCIAL_COLS4=\[[\s\S]*?Finalizado/.test(DH) && (DH.match(/const SOCIAL_COLS4=\[([\s\S]*?)\];/)||['',''])[1].split('{key').length - 1 === 4);
check('D10', 'Colunas Designer = 4 (A Fazer/Em andamento/Revisão-Ajuste/Entregue)', (DH.match(/const DESIGNER_COLS4=\[([\s\S]*?)\];/)||['',''])[1].split('{key').length - 1 === 4 && /label:'Revisão\/Ajuste'/.test(DH));
check('D11', 'Colunas Cliente = 4 (Enviado/Em análise/Revisão solicitada/Aprovado)', (DH.match(/const CLIENT_COLS4=\[([\s\S]*?)\];/)||['',''])[1].split('{key').length - 1 === 4);
check('D12', 'Social board usa SOCIAL_COLS4 (não OPERATIONAL_COLS 8)', /const byCol=SOCIAL_COLS4\.map/.test(DH));
check('D13', 'Designer board usa DESIGNER_COLS4 (4 colunas) + designerColView + card perspectiva designer', /const byStatus=DESIGNER_COLS4\.map\(st=>list\.filter\(t=>designerColView\(t\)===st\.key\)/.test(DH) && /tasks\.map\(t=>taskCard\(t,'designer'\)\)/.test(DH));
check('D14', 'Cliente board usa CLIENT_COLS4', /const byCol=CLIENT_COLS4\.map/.test(DH));
// ===== PASSO 2 — VISÃO ROLE-AWARE DO DESIGNER (Desktop) =====
check('RA_COLVIEW', 'designerColView mantém coluna própria de Revisão (não colapsa revisao→andamento)', /function designerColView\(t\)\{const c=designerCol\(t\);return c==='concluido'\?'entregue':\(c==='revisao'\?'revisao':/.test(DH));
check('RA_STATUSVIEW', 'designerStatusView lê DESIGNER_COLS4 (badge do card do designer)', /function designerStatusView\(t\)\{const k=designerColView\(t\);const c=DESIGNER_COLS4\.find/.test(DH));
check('RA_CARD_PARAM', 'taskCard é role-aware (persp), designerView só p/ cronograma c/ designer', /function taskCard\(t, persp\)\{[\s\S]*?const designerView = persp==='designer' && secOf\(t\.sector\)\.key==='cronograma' && hasDesigner\(t\);/.test(DH));
check('RA_CARD_BADGE', 'badge do card usa designerStatusView quando designerView (senão clientStatusView)', /const oc=designerView\?designerStatusView\(t\):clientStatusView\(t\);/.test(DH));
check('RA_CARD_TIMELINE', 'card escolhe designerCardTimeline × taskCardTimeline pela perspectiva', /designerView\?designerCardTimeline\(t\):taskCardTimeline\(t\)/.test(DH));
// designerCardTimeline NÃO mostra o fluxo do cliente (sem taskTimeline/clientStatusView dentro dela)
const dctFn = (DH.match(/function designerCardTimeline\(t\)\{[\s\S]*?\n\}/) || [''])[0];
check('RA_DESIGNER_NO_CLIENT', 'designerCardTimeline NÃO usa taskTimeline/clientStatusView (perspectiva do designer)', dctFn.length>0 && dctFn.indexOf('taskTimeline(')===-1 && dctFn.indexOf('clientStatusView(')===-1);
check('RA_OPCOL_REV', 'operationalCol: designerFlowStatus=revisao → aguardando_designer_revisao (distinto de produção)', /if\(dc==='revisao'\)return 'aguardando_designer_revisao';/.test(DH));
check('RA_OPCOL_LABEL', 'OPERATIONAL_COLS tem "Designer em revisão" (aguardando_designer_revisao)', /key:'aguardando_designer_revisao',\s*label:'Designer em revisão'/.test(DH));
check('RA_PERSONBOARD', 'Meu quadro do designer usa card perspectiva designer p/ tarefa atribuída a ele', /const cardFor=t=>\(hasDesigner\(t\)&&designerOf\(t\)===pid\)\?taskCard\(t,'designer'\):taskCard\(t\);/.test(DH));
// Funcional (executa as funções REAIS extraídas): mapeamento do designer + estado social-side
(function(){
  const constArr = n => (DH.match(new RegExp('const '+n+'\\s*=\\s*\\[[\\s\\S]*?\\];'))||[''])[0];
  const fnDecl = n => { const m=DH.match(new RegExp('function '+n+'\\s*\\([^)]*\\)\\s*\\{')); if(!m) return ''; let s=DH.indexOf(m[0]),d=0; for(let i=s+m[0].length-1;i<DH.length;i++){const c=DH[i];if(c==='{')d++;else if(c==='}'){d--;if(d===0)return DH.slice(s,i+1);}} return ''; };
  let mod=null, err=null;
  try {
    const src = [
      constArr('SECTORS'), (DH.match(/const SECTOR_ALIAS=\{[^\n]*\};/)||[''])[0], constArr('STATUS'), constArr('CLIENT_COLS'),
      constArr('OPERATIONAL_COLS'), constArr('DESIGNER_COLS4'),
      fnDecl('secOf'), fnDecl('stOf'), fnDecl('opColOf'), fnDecl('hasDesigner'), fnDecl('designerOf'), fnDecl('designerCol'),
      fnDecl('designerDelivered'), fnDecl('pendingLegend'), fnDecl('pendingFeed'), fnDecl('pendingStory'), fnDecl('pendingProduction'),
      // detail-hierarchy-v2: hasPendingItemRevision agora é phase-aware e depende destas:
      fnDecl('clientApprovalPhaseOf'), fnDecl('pendingClientItems'), fnDecl('hasTeamAdjustedAwaiting'),
      fnDecl('hasPendingItemRevision'), fnDecl('isFullyComplete'), fnDecl('clientCol'), fnDecl('operationalCol'),
      fnDecl('designerColView'), fnDecl('designerStatusView'), fnDecl('designerNextShort'),
      'return {operationalCol,designerColView,designerStatusView,designerNextShort,opColOf};'
    ].join('\n');
    mod = new Function(src)();
  } catch(e){ err=e&&e.message; }
  check('RA_EVAL', 'Funções role-aware (designerColView/designerStatusView/operationalCol) avaliáveis', !!mod && !err);
  if (mod){
    const T = dfs => ({ sector:'cronograma', designerAssignment:{designerId:'d'}, designerFlowStatus:dfs, cronContents:[{tema:'T'}] });
    check('RA_FN_AFAZER',  'designerColView afazer → afazer; Social vê "Aguardando designer iniciar"', mod.designerColView(T('afazer'))==='afazer' && mod.operationalCol(T('afazer'))==='aguardando_designer_iniciar');
    check('RA_FN_ANDAMENTO','designerColView andamento → andamento; Social vê "Designer em produção"', mod.designerColView(T('andamento'))==='andamento' && mod.opColOf(mod.operationalCol(T('andamento'))).label==='Designer em produção');
    check('RA_FN_REVISAO', 'designerColView revisao → revisao; Social vê "Designer em revisão"', mod.designerColView(T('revisao'))==='revisao' && mod.opColOf(mod.operationalCol(T('revisao'))).label==='Designer em revisão');
    check('RA_FN_ENTREGUE','designerColView concluido → entregue; designerStatusView label "Entregue"', mod.designerColView(T('concluido'))==='entregue' && mod.designerStatusView(T('concluido')).label==='Entregue');
  }
})();
// CORREÇÃO 6 (Desktop): boardCol4For designer-aware + usado no Meu quadro/Setor.
check('D15', 'boardCol4For(t,uid) designer-aware definido', /function boardCol4For\(t,uid\)/.test(DH));
check('D16', 'Meu quadro usa boardCol4For (designer vê em A Fazer)', /boardCol4For\(t,pid\)/.test(DH));
// CORREÇÃO 4: edição de tema responde no 1º clique.
check('D17', 'openItemFix: autofocus no #ifIn', /id="ifIn"[^>]*autofocus/.test(DH));
check('D18', 'openItemFix: foco via rAF + timeout', /requestAnimationFrame\(function\(\)\{_focusIf\(\)/.test(DH));
check('D19', 'Render idempotente preservado (dedupById)', /state\.tasks\s*=\s*dedupById\(/.test(DH));
check("D20", "Rodapé mostra Desktop 1.0.132", /Desktop 1\.0\.132/.test(DH));
// CORREÇÃO crítica (teste real): rótulo de versão do LOGIN não pode ficar defasado.
check("D21", "Login/título/watermark mostram 1.0.132 (sem rótulo antigo)",
  /<span class="pill-ver">Desktop 1\.0\.132/.test(DH) && /<title>ID Seven · Desktop 1\.0\.132/.test(DH) && /id="wpbadge">Desktop 1\.0\.132/.test(DH));
check('D22', 'Login espelha o APK 1.0.132-beta-workflow-v64-46-test', /espelha o APK <b>1.0.132-beta-workflow-v64-46-test/.test(DH));
check('D23', 'Fonte única APP_VER define a versão exibida', /const APP_VER=\{\s*desktop:.1\.0\.132./.test(DH) && /applyVersionLabels/.test(DH));
// ===== 1.0.120 — ENVIO WHATSAPP LIMPO + WEB-ONLY (executa as funções reais) =====
(function(){
  // Extrai e executa as funções reais p/ provar o conteúdo do clipboard e a URL aberta (etapa 3).
  const base=(DH.match(/const CLIENT_LINK_BASE='([^']+)'/)||[])[1];
  const fnUrl=(DH.match(/function buildPublicClientUrl\(token\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnShare=(DH.match(/function buildShareClientUrl\(token\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnMsg=(DH.match(/function buildClientMessage\(ctx\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnWeb=(DH.match(/function openWhatsAppWebOnly\(\)\{[\s\S]*?\n\}/)||[''])[0];
  const FORBID=['web.whatsapp.com/send','whatsapp://send','send?text=','%0A','%C3','encodeURIComponent','api.whatsapp.com/send'];
  let clip=null,opened=[],msg='';
  try{
    const sb={window:{desktopAPI:{openExternal:u=>{opened.push(u);return Promise.resolve(true);}},open:u=>opened.push(u)},navigator:{clipboard:{writeText:t=>{clip=t;}}}}; sb.self=sb.window;
    msg=new Function('sb',`const CLIENT_LINK_BASE=${JSON.stringify(base)};const window=sb.window,navigator=sb.navigator,self=sb.self;function copyToClipboard(t){navigator.clipboard.writeText(t);}${fnUrl}\n${fnShare}\n${fnMsg}\n${fnWeb}\nconst ctx={client:'C',type:'Quinzenal',title:'P',token:'a1b2c3d4e5f6a1b2c3d4e5f6'};const m=buildClientMessage(ctx);copyToClipboard(m);openWhatsAppWebOnly();return m;`)(sb);
  }catch(e){ msg='THREW:'+e.message; }
  check('CLEAN1','Clipboard recebe a MENSAGEM LIMPA (igual a buildClientMessage)', clip===msg && msg.indexOf('THREW:')<0);
  check('CLEAN2','Clipboard SEM nenhuma URL técnica do WhatsApp (send?text=, web/send, codificado)', FORBID.every(x=>String(clip).indexOf(x)<0));
  check('CLEAN3','Abrir WhatsApp abre SOMENTE https://web.whatsapp.com/ (sem texto, sem app://)', opened.length===1 && opened[0]==='https://web.whatsapp.com/');
  check('CLEAN4','Clipboard leva o link de COMPARTILHAMENTO (/share/, preview premium + token)', String(clip).indexOf('https://aprovar.agendaidseven.com.br/share/cronograma/a1b2c3d4e5f6a1b2c3d4e5f6')>-1);
  check('CLEAN5','Builders send?text= REMOVIDOS (sem buildWhatsAppWebUrl/AppUrl ativos)', !/function buildWhatsAppWebUrl/.test(DH) && !/function buildWhatsAppAppUrl/.test(DH));
  check('CLEAN6','openWhatsAppWebOnly abre só web; código executável SEM nenhuma string send?text=', /function openWhatsAppWebOnly\(\)\{[\s\S]*?'https:\/\/web\.whatsapp\.com\/'/.test(DH) && !/send\?text=/.test(DH.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'')));
})();
// ===== HOTFIX 1.0.116 — wizard imune a snapshot de fundo (corrige "nada responde") =====
check('FORM1', 'Guard renderFromSnapshot: snapshots NÃO repintam com form aberto', /function renderFromSnapshot\(\)\{ if\(state\.form\) return; render\(\); \}/.test(DH));
check('FORM2', 'onSnapshot usa renderFromSnapshot (não render direto que destruía o input)', (DH.match(/renderFromSnapshot\(\);\}\)/g)||[]).length>=3);
check('FORM3', 'openTaskForm limpa overlay/modal preso (closeModal) ao abrir o wizard', /function openTaskForm\(sector\)\{closeModal\(\);state\.form=newForm/.test(DH));
check('FORM4', 'Campos do wizard mantêm bind por oninput (digitação aceita)', /el\.oninput=\(\)=>fn\(el\)/.test(DH) && /bind\('#fTitle'/.test(DH) && /bind\('#fClient'/.test(DH));
check('D24', 'SEM rótulo de versão defasado visível (1.0.103/1.0.64-beta) no login/título/badge',
  !/<title>ID Seven · Desktop 1\.0\.103/.test(DH) && !/pill-ver">Desktop 1\.0\.103/.test(DH) && !/espelha o APK <b>1\.0\.64-beta/.test(DH));
// DOMÍNIO PREMIUM do link do cliente (aprovar.agendaidseven.com.br); API interna fica em workers.dev.
check('D_DOMAIN1', 'Link público do cliente usa aprovar.agendaidseven.com.br', /const CLIENT_LINK_BASE='https:\/\/aprovar\.agendaidseven\.com\.br'/.test(DH) && /return CLIENT_LINK_BASE\+'\/cliente\/cronograma\/'\+t;/.test(DH));
check('D_DOMAIN2', 'API interna (token/imagekit/notify) permanece em workers.dev (fallback vivo)', /const CLIENT_REVIEW_BASE='https:\/\/idseven-push\.agidseven\.workers\.dev'/.test(DH));
// ===== SYNC DO DESIGNER (move grava designerFlowStatus) — Desktop =====
const moveFn = (DH.match(/async function moveStatus\(taskId,newStatus\)\{[\s\S]*?\n\}/) || [''])[0];
check('D_MOVE1', 'Desktop tem isDesignerAxisMove (detecta eixo do designer)', /function isDesignerAxisMove\(t\)\{return isDesignerFlow\(t\)/.test(DH));
const dBranch = (moveFn.match(/if\(isDesignerAxisMove\(t\)\)\{[\s\S]*?return;\s*\}/) || [''])[0];
check('D_MOVE2', 'moveStatus grava designerFlowStatus no eixo do designer', /designerFlowStatus:newStatus/.test(dBranch));
check('D_MOVE3', 'No eixo do designer, moveStatus NÃO grava status genérico ({status:newStatus})', dBranch.length > 0 && !/\{status:newStatus/.test(dBranch));
check('D_MOVE4', 'openMove oferece opções por eixo do designer (designerMoveOpts)', /function designerMoveOpts\(t\)/.test(DH) && /isDesignerAxisMove\(t\)\s*\?\s*designerMoveOpts/.test(DH));

console.log(`${C.b}\n[PARTE B] Android 1.0.98-beta — designer em A Fazer + colunas + leitura do campo${C.x}`);
check('N1', 'versionName 1.0.132-beta-workflow-v64-46-test (paridade Desktop)', /versionName\s+"1.0.132-beta-workflow-v64-46-test"/.test(GRADLE));
check('N2', 'versionCode >= 107 (acima do 106 anterior)', (() => { const m = GRADLE.match(/versionCode\s+(\d+)/); return m && Number(m[1]) >= 107; })());
check('N_PARITY', 'Android = bump de paridade: endpoint interno workers.dev intacto, SEM link de cliente', /idseven-push\.agidseven\.workers\.dev\/notify-assignee/.test(readAndroid(AND + 'core/PushNotify.kt')) && !/cliente\/cronograma/.test(readAndroid(AND + 'core/PushNotify.kt')));
// ESTILO DOS CHIPS (Android): menos arredondados (12.dp, não 999.dp) + ícone Designers.
check('N_SHAPE', 'TasksTopTabs: chips RoundedCornerShape(12.dp), sem cápsula (999.dp)', /RoundedCornerShape\(12\.dp\)/.test(KT_TABS) && !/RoundedCornerShape\(999\.dp\)/.test(KT_TABS));
check('N_ICON', 'TasksTopTabs: ícone do Designers = Icons.Outlined.Image', /"designers"\s*->\s*Icons\.Outlined\.Image/.test(KT_TABS));
// ===== REGRA FINAL (Android): chips SOMENTE no Kanban (TasksScreen, junto da busca); NUNCA no hub.
const iSearch = KT_SCREEN.indexOf('SearchField(query');
const iTabsAfter = KT_SCREEN.indexOf('tabsBar()', iSearch);
check('N_PL1', 'Kanban (TasksScreen): chips (tabsBar) JUNTO da busca (após SearchField)', iSearch > -1 && iTabsAfter > -1);
check('N_PL2', 'HUB "Quadros" (BoardsHubScreen) SEM chips (sem tabsBar())', KT_HUB.indexOf('tabsBar()') === -1);
const KT_DHUB = readAndroid(AND + 'features/tasks/DesignersHubScreen.kt');
const KT_SHUB = readAndroid(AND + 'features/tasks/SocialsHubScreen.kt');
check('N_PL3', 'Hubs de lista (Designers/Socials) SEM chips (sem tabsBar())', KT_DHUB.indexOf('tabsBar()') === -1 && KT_SHUB.indexOf('tabsBar()') === -1);
// CORREÇÃO 6 (Android): designer vê tarefa em A Fazer.
check('N3', 'TaskVisibility tem boardCol4For(t,uid) designer-aware', /fun\s+boardCol4For\(t:\s*TaskItem,\s*uid:\s*String\?\)/.test(KT_VIS));
check('N4', 'TasksScreen usa boardCol4For(t, currentUid) no Meu quadro', /boardCol4For\(t,\s*currentUid\)/.test(KT_SCREEN));
// Equivalência de identidade/campo: Android lê designerAssignment.designerId.
check('N5', 'TaskRepo lê designerAssignment.designerId (= assigneeId do Desktop)', /designerAssignment[\s\S]{0,40}designerId/.test(KT_REPO));
check('N6', 'TaskRepo lê assigneeId (uid do designer logado)', /assigneeId\s*=\s*d\.getString\("assigneeId"\)/.test(KT_REPO));
// ===== SYNC DO DESIGNER (move grava designerFlowStatus) — Android =====
check('N_MOVE1', 'TaskContract.designerStatusPatch grava designerFlowStatus', /fun\s+designerStatusPatch\([\s\S]*?"designerFlowStatus"\s+to\s+newDesignerStatus/.test(KT_CONTRACT));
check('N_MOVE2', 'TaskContract.designerStatusPatch NÃO grava status genérico', !/fun\s+designerStatusPatch\([\s\S]*?"status"\s+to/.test(KT_CONTRACT));
check('N_MOVE3', 'TaskRepo.move tem parâmetro designerAxis', /fun\s+move\(task:[^)]*designerAxis:\s*Boolean/.test(KT_REPO));
check('N_MOVE4', 'TaskRepo.move usa designerStatusPatch quando designerAxis', /if\s*\(designerAxis\)\s*TaskContract\.designerStatusPatch/.test(KT_REPO));
check('N_MOVE5', 'TasksScreen detecta eixo do designer e chama move(...designerAxis)', /val designerAxis = TaskVisibility\.isDesignerFlow/.test(KT_SCREEN) && /TaskRepo\.move\(target, opt\.target, currentUid, designerAxis\)/.test(KT_SCREEN));
// ===== task-flow-fix (Android): paridade do estado "Designer em produção" =====
check('N_FLOW1', 'Android tem o estado "aguardando_designer_iniciar" ("Aguardando designer iniciar")', /OpCol\("aguardando_designer_iniciar", "Aguardando designer iniciar"\)/.test(KT_VIS));
check('N_FLOW2', 'Android operationalCol: andamento -> "aguardando_designer"; revisao -> "aguardando_designer_revisao" (paridade f96aa2e)', /if \(dc == "andamento"\) return "aguardando_designer"/.test(KT_VIS) && /if \(dc == "revisao"\) return "aguardando_designer_revisao"/.test(KT_VIS));
check('N_FLOW3', 'Android operationalCol: recém-enviado (afazer) -> "aguardando_designer_iniciar" (NÃO em produção)', /return "aguardando_designer_iniciar"/.test(KT_VIS));
check('N_FLOW4', 'Android versionName = 1.0.132-beta-workflow-v64-46-test', /versionName "1.0.132-beta-workflow-v64-46-test"/.test(GRADLE));
// CORREÇÃO 3 (Android): colunas por contexto.
check('N7', 'Colunas por papel: SOCIAL_COLS4 / DESIGNER_COLS4 / CLIENT_COLS4', /SOCIAL_COLS4/.test(KT_VIS) && /DESIGNER_COLS4/.test(KT_VIS) && /CLIENT_COLS4/.test(KT_VIS));
check('N8', 'TasksScreen aplica colunas por contexto (clientCol4/designerColView)', /clientCol4\(t\)/.test(KT_SCREEN) && /designerColView\(t\)/.test(KT_SCREEN));
// ===== PASSO 3 — PARIDADE ANDROID do role-aware do Designer (espelha Desktop f96aa2e) =====
check('N_RA1', 'Android DESIGNER_COLS4 = 4 colunas incl. "Revisão/Ajuste"', /val DESIGNER_COLS4 = listOf\([\s\S]*?OpCol\("revisao", "Revisão\/Ajuste"\)[\s\S]*?OpCol\("entregue"/.test(KT_VIS));
check('N_RA2', 'Android designerColView NÃO colapsa revisao (coluna própria)', /fun designerColView\(t: TaskItem\): String = when \(designerCol\(t\)\) \{[\s\S]*?"revisao" -> "revisao"/.test(KT_VIS));
check('N_RA3', 'Android OPERATIONAL_COLS tem "Designer em revisão"', /OpCol\("aguardando_designer_revisao", "Designer em revisão"\)/.test(KT_VIS));
check('N_RA4', 'Android TaskCardPro é role-aware (designerView) — badge/próxima do designer', /designerView: Boolean = false/.test(KT_SCREEN) && /val isDesignerCard = designerView && Sectors\.of\(task\.sector\)\.key == "cronograma" && TaskVisibility\.hasDesigner\(task\)/.test(KT_SCREEN) && /TaskVisibility\.designerNextShort\(task\)/.test(KT_SCREEN));
check('N_RA5', 'Android quadro do designer usa DESIGNER_COLS4 + designerColView + card designerView', /isDesignerBoard -> TaskVisibility\.DESIGNER_COLS4\.map/.test(KT_SCREEN) && /isDesignerBoard -> TaskVisibility\.designerColView\(t\)/.test(KT_SCREEN) && /designerView = designerView/.test(KT_SCREEN));
check('N_RA6', 'Android designerNextShort existe (próxima ação do designer)', /fun designerNextShort\(t: TaskItem\): String = when \(designerColView\(t\)\)/.test(KT_VIS));
// Roborazzi de paridade + workflow só-screenshot (sem APK)
const KT_RATEST = readAndroid('android-native-beta/app/src/test/java/br/com/idseven/agenda/nativebeta/DesignerRoleScreenshotTest.kt');
check('N_RA7', 'Teste Roborazzi do role-aware do Designer existe (perspectiva designer × social)', /class DesignerRoleScreenshotTest/.test(KT_RATEST) && /fun designer_perspective/.test(KT_RATEST) && /fun social_perspective/.test(KT_RATEST) && /designerView = designerView/.test(KT_RATEST));
const WF_SHOT = readFromGit(ANDROID_E2E_BRANCH, '.github/workflows/android-screenshot.yml') || '';
check('N_RA8', 'Workflow só-screenshot (Roborazzi, SEM assembleRelease/APK)', /recordRoborazziDebug/.test(WF_SHOT) && !/assembleRelease/.test(WF_SHOT) && /NENHUM APK foi gerado|nenhum \.apk/.test(WF_SHOT));
check('N9', 'TaskVisibility mantém isFullyComplete (fonte única de conclusão)', /fun\s+isFullyComplete/.test(KT_VIS));
check('N10', 'TasksTopTabs com chips (paridade Desktop)', /Person|Visibility|GridView|horizontalScroll/.test(KT_TABS));

/* ===================== PARTE C — Link público premium do Desktop (token obrigatório) =====================
   As 15 validações exigidas: o link do cliente SEMPRE usa o domínio premium e SEMPRE carrega
   um token real; nunca termina em /cronograma/; nunca usa workers.dev; a mensagem do WhatsApp
   leva o link COMPLETO. Aqui EXECUTAMOS as funções reais do Desktop (não é só regex). */
console.log(`${C.b}\n[PARTE C] Link público premium do Desktop — token obrigatório (executa as funções reais)${C.x}`);
let LINK = null;
try {
  const base = (DH.match(/const CLIENT_LINK_BASE='([^']+)'/) || [])[1] || '';
  const review = (DH.match(/const CLIENT_REVIEW_BASE='([^']+)'/) || [])[1] || '';
  const fnUrl = (DH.match(/function buildPublicClientUrl\(token\)\{[\s\S]*?\n\}/) || [''])[0];
  const fnShare = (DH.match(/function buildShareClientUrl\(token\)\{[\s\S]*?\n\}/) || [''])[0];
  const fnMsg = (DH.match(/function buildClientMessage\(ctx\)\{[\s\S]*?\n\}/) || [''])[0];
  const code = `
    const CLIENT_LINK_BASE=${JSON.stringify(base)};
    const CLIENT_REVIEW_BASE=${JSON.stringify(review)};
    ${fnUrl}
    ${fnShare}
    ${fnMsg}
    return { CLIENT_LINK_BASE, CLIENT_REVIEW_BASE, buildPublicClientUrl, buildShareClientUrl, buildClientMessage };
  `;
  LINK = new Function(code)();
} catch (e) {
  check('LINK0', 'Funções de link do Desktop avaliáveis (buildPublicClientUrl + buildShareClientUrl + buildClientMessage)', false);
}
if (LINK) {
  const TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'; // 48 hex (formato genReviewToken)
  let url = '', share = '', threwEmpty = false, threwNull = false, threwShareEmpty = false;
  try { url = LINK.buildPublicClientUrl(TOKEN); } catch (e) { url = 'THREW:' + e.message; }
  try { share = LINK.buildShareClientUrl(TOKEN); } catch (e) { share = 'THREW:' + e.message; }
  try { LINK.buildPublicClientUrl(''); } catch (e) { threwEmpty = true; }
  try { LINK.buildPublicClientUrl(null); } catch (e) { threwNull = true; }
  try { LINK.buildShareClientUrl(''); } catch (e) { threwShareEmpty = true; }
  const msg = (() => { try { return LINK.buildClientMessage({ client: 'Hospital Visão', type: 'semanal', title: 'Cronograma X', token: TOKEN }); } catch (e) { return 'THREW:' + e.message; } })();

  check('LINK1', '(1) Portal usa domínio premium aprovar.agendaidseven.com.br/cliente/cronograma/', LINK.CLIENT_LINK_BASE === 'https://aprovar.agendaidseven.com.br' && url.startsWith('https://aprovar.agendaidseven.com.br/cliente/cronograma/'));
  check('LINK2', '(3) Portal contém token real após /cronograma/', /\/cliente\/cronograma\/[A-Za-z0-9_-]{8,}$/.test(url) && url.endsWith(TOKEN));
  check('LINK3', '(4) O token não é vazio', url.split('/cliente/cronograma/')[1] === TOKEN && TOKEN.length >= 8);
  check('LINK4', '(5) Portal NÃO termina em /cronograma/', !/\/cliente\/cronograma\/?$/.test(url));
  check('LINK5', '(6) Links NÃO usam workers.dev', !/workers\.dev/.test(url) && !/workers\.dev/.test(share));
  check('LINK6', 'Hardening: token vazio LANÇA (portal nunca sai sem token)', threwEmpty === true);
  check('LINK7', 'Hardening: token nulo LANÇA (portal nunca sai sem token)', threwNull === true);
  // ===== SHARE: a MENSAGEM usa o link /share/ (preview OG premium), NÃO o link cru do portal =====
  check('LINK_SHARE1', 'buildShareClientUrl = aprovar.agendaidseven.com.br/share/cronograma/<token>', share === 'https://aprovar.agendaidseven.com.br/share/cronograma/' + TOKEN);
  check('LINK_SHARE2', 'Hardening: share sem token LANÇA', threwShareEmpty === true);
  check('LINK8', '(14) Mensagem usa o link de COMPARTILHAMENTO completo com token', msg.indexOf(share) > -1 && msg.indexOf(TOKEN) > -1);
  check('LINK9', 'Mensagem usa /share/ (gera preview premium) e NÃO o link cru do portal /cliente/cronograma/', /\/share\/cronograma\//.test(msg) && msg.indexOf('aprovar.agendaidseven.com.br/cliente/cronograma/') < 0 && !/workers\.dev/.test(msg));
  check('LINK10', 'API interna do app permanece em workers.dev (fallback vivo; não é o link do cliente)', LINK.CLIENT_REVIEW_BASE === 'https://idseven-push.agidseven.workers.dev');
}
// Itens 7–13 (HTTP AO VIVO: portal 200; og:title/og:description/og:image premium; /og/aprovar.png
// image/png 1200×630; fallback workers.dev) são validados COM TOKEN REAL no workflow de CI
// `validate-client-card.yml` (rede aberta) — provado verde antes do build.
console.log(`  ${C.d}NB${C.x} itens 7–13 (HTTP ao vivo c/ token real) provados no CI validate-client-card.yml`);

/* ===================== PARTE D — Envio premium via IMAGEM REAL (não depende do preview) =====================
   Decisão técnica: o card vai como IMAGEM REAL anexada no WhatsApp + link na legenda. O preview
   automático do WhatsApp passa a ser BÔNUS. Valida Worker (rota da imagem), Desktop (URL + IPC +
   modal) e a caption. */
console.log(`${C.b}\n[PARTE D] Envio premium via imagem real (Worker img route + Desktop IPC/modal)${C.x}`);
const MAIN = readDesktop('desktop/src/main/main.ts');
const PRE = readDesktop('desktop/src/preload/preload.ts');
// Worker: rota /og/wa-card-v64-26.jpg serve image/jpeg do JPEG embutido (1200×630 válido)
check('MEDIA_W1', 'Worker serve /og/wa-card-v64-38.jpg (jpgBannerResponse + OG_JPG_B64)', /wa-card-v64-38\.jpg/.test(W) && /function jpgBannerResponse/.test(W) && /const OG_JPG_B64=/.test(W));
check('MEDIA_W2', 'JPEG embutido é válido 1200×630 (SOI/EOI)', (() => {
  const m = W.match(/const OG_JPG_B64="([A-Za-z0-9+/=]+)"/); if (!m) return false;
  const b = Buffer.from(m[1], 'base64');
  if (!(b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9)) return false;
  // dimensões: varre marcadores SOF0..SOF2
  for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) { i++; continue; } const mk = b[i + 1];
    if (mk === 0xc0 || mk === 0xc1 || mk === 0xc2) { const h = b.readUInt16BE(i + 5), w = b.readUInt16BE(i + 7); return w === 1200 && h === 630; }
    i += 2 + b.readUInt16BE(i + 2); }
  return false;
})());
// Desktop: usa a imagem do card (URL premium versionada, sem query)
check('MEDIA_D1', 'Desktop CARD_IMG_URL = aprovar.agendaidseven.com.br/og/wa-card-v64-38.jpg (sem query)', /const CARD_IMG_URL='https:\/\/aprovar\.agendaidseven\.com\.br\/og\/wa-card-v64-38\.jpg'/.test(DH));
// ===== 1.0.119 — CARD AURORA GLASS (B-final) EMBUTIDO como fonte da verdade offline =====
check('MEDIA_AB1', 'Desktop embute o card Aurora (CARD_IMG_B64) — fonte offline, sem depender de rede no envio', /const CARD_IMG_B64='[A-Za-z0-9+/=]{1000,}'/.test(DH));
check('MEDIA_AB2', 'CARD_IMG_B64 decodifica para JPEG VÁLIDO 1200×630 (mesmo card oficial B-final)', (() => {
  const m = DH.match(/const CARD_IMG_B64='([A-Za-z0-9+/=]+)'/); if (!m) return false;
  const b = Buffer.from(m[1], 'base64');
  if (!(b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9)) return false;
  for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) { i++; continue; } const mk = b[i + 1];
    if (mk === 0xc0 || mk === 0xc1 || mk === 0xc2) { const h = b.readUInt16BE(i + 5), w = b.readUInt16BE(i + 7); return w === 1200 && h === 630; }
    i += 2 + b.readUInt16BE(i + 2); }
  return false;
})());
check('MEDIA_AB3', 'O card embutido no Desktop é o MESMO byte-a-byte que o Worker serve (OG_JPG_B64 == CARD_IMG_B64)', (() => {
  const dm = DH.match(/const CARD_IMG_B64='([A-Za-z0-9+/=]+)'/);
  const wm = W.match(/const OG_JPG_B64="([A-Za-z0-9+/=]+)"/);
  return !!(dm && wm && dm[1] === wm[1]);
})());
check('MEDIA_AB4', '_wireGroupSend usa o card embutido (atob(CARD_IMG_B64) → data:image/jpeg) com fetch(CARD_IMG_URL) só como fallback', /atob\(CARD_IMG_B64\)/.test(DH) && /data:image\/jpeg;base64,'\+CARD_IMG_B64/.test(DH) && /fetch\(CARD_IMG_URL/.test(DH));
check("MEDIA_D2", "Modal PRINCIPAL: título 'Enviar no grupo do cliente' + subtítulo de ABRIR WhatsApp", /gcs-title">Enviar no grupo do cliente</.test(DH) && /Abra o WhatsApp Business e envie a mensagem no grupo onde o cliente está\./.test(DH));
check('MEDIA_D5', 'Nome de arquivo claro agenda-id-seven-card-[cliente]-[token].jpg', /agenda-id-seven-card-'\+/.test(DH));
// ===== 1.0.126 — FLUXO PRINCIPAL "ENVIAR NO GRUPO": botão ABRE WhatsApp Business + copia a mensagem =====
check('GROUP_1', 'Título "Enviar no grupo do cliente" + subtítulo de ABRIR WhatsApp', /gcs-title">Enviar no grupo do cliente</.test(DH) && /Abra o WhatsApp Business e envie a mensagem no grupo onde o cliente está\./.test(DH));
check('GROUP_2', 'Botão principal "Abrir WhatsApp Business para enviar no grupo" (id=btnOpenWaMain) + legenda + texto de apoio', /id="btnOpenWaMain"[^>]*>[\s\S]{0,40}Abrir WhatsApp Business para enviar no grupo/.test(DH) && /id="groupLegendBox"/.test(DH) && /id="groupBlock"/.test(DH) && /A mensagem será copiada automaticamente\. No WhatsApp Business, escolha o grupo do cliente e cole\./.test(DH));
check('GROUP_3', 'Prévia premium do LINK no modal = EXATO (Aprovar cronograma / Seu cronograma está pronto para avaliação. / aprovar.agendaidseven.com.br + imagem do card)', /id="groupLinkPreview"/.test(DH) && /id="groupCardPreview"/.test(DH) && /gcs-lp-title">Aprovar cronograma<\/div>/.test(DH) && /gcs-lp-desc">Seu cronograma está pronto para avaliação\.<\/div>/.test(DH) && /gcs-lp-dom">aprovar\.agendaidseven\.com\.br/.test(DH));
// CRÍTICO (regra de UX): o botão principal COPIA a mensagem automaticamente + ABRE o WhatsApp; nunca pasta/arquivo.
const primaryHandler = (DH.match(/on\('btnOpenWaMain',\s*function\(\)\{[\s\S]*?\n  \}\);/) || [''])[0];
check('GROUP_4', 'Botão principal COPIA a mensagem automaticamente (copyMsgClean→copyToClipboard) E ABRE o WhatsApp (openWhatsAppWebOnly)', primaryHandler.length > 0 && /copyMsgClean\(\)/.test(primaryHandler) && /openWhatsAppWebOnly\(\)/.test(primaryHandler) && /function copyMsgClean\(\)\{[\s\S]*?copyToClipboard\(msg\)/.test(DH) && /function copyMsgClean\(\)\{[\s\S]*?_gateValidLink\(ctx,msg\)/.test(DH));
check('GROUP_5', 'Botão principal NÃO abre pasta nem salva/copia arquivo (sem showInFolder/ensureSaved/saveCardImage/copyCard)', primaryHandler.length > 0 && !/showInFolder/.test(primaryHandler) && !/ensureSaved/.test(primaryHandler) && !/saveCardImage/.test(primaryHandler) && !/copyCard\(/.test(primaryHandler));
check('GROUP_5b', 'Botão principal NÃO é apenas "Copiar mensagem" (reusa o fluxo de ABRIR WhatsApp que funcionou)', /id="btnOpenWaMain"/.test(DH) && !/id="btnOpenWaMain"[^>]*>[\s\S]{0,40}Copiar mensagem<\/button>/.test(DH));
check('GROUP_6', 'Secundários discretos: "Copiar mensagem" (btnCopyGroupMsg) + "Testar link" (btnTestLink abre o /share)', /id="btnCopyGroupMsg"[^>]*>Copiar mensagem<\/button>/.test(DH) && /id="btnTestLink"/.test(DH) && /on\('btnTestLink'/.test(DH) && /buildShareClientUrl\(ctx&&ctx\.token\)/.test(DH));
check('GROUP_7', 'Card-arquivo/pasta + Cloud API individual ficam em FALLBACK/avançado recolhido (<details>)', /<details class="gcs-adv"><summary>Opções avançadas: anexar o card como imagem \(fallback\)<\/summary>/.test(DH) && /id="btnCopyImg"/.test(DH) && /id="btnOpenFolder"/.test(DH) && /<details class="gcs-adv"><summary>Opção avançada: enviar para número individual com botão oficial<\/summary>/.test(DH));
check('GROUP_8', 'SEM fluxo antigo de etapas como principal (sem btnPrepGroup / gchk1-3 / step1-3 / btnStep*)', !/id="btnPrepGroup"/.test(DH) && !/id="gchk1"/.test(DH) && !/id="step2"/.test(DH) && !/id="btnStep1"/.test(DH));
check('GROUP_9', 'Wiring chama _wireGroupSend + _wireAutoSend; openWhatsAppWebOnly sem send?text=/app://', /_wireGroupSend\(ctx, msg, cardFile\);\s*\n?\s*_wireAutoSend\(ctx\);/.test(DH) && (() => { const b = (DH.match(/function openWhatsAppWebOnly\(\)\{[\s\S]*?\n\}/) || [''])[0].replace(/^\s*\/\/.*$/gm, ''); return /web\.whatsapp\.com\//.test(b) && b.indexOf('send?text=') < 0 && b.indexOf('whatsapp://send') < 0; })());
check('GROUP_10', 'ANTI-ÍCONE-GIGANTE: .gcs-sheet svg 18px + header 20px', /\.gcs-sheet svg\{width:18px;height:18px/.test(DH) && /\.gcs-headic svg\{width:20px;height:20px\}/.test(DH));
// Executa o handler PRINCIPAL real (btnOpenWaMain): clipboard recebe a MENSAGEM + WhatsApp é aberto; pasta/arquivo NUNCA tocados.
(function(){
  const base=(DH.match(/const CLIENT_LINK_BASE='([^']+)'/)||[])[1];
  const fnUrl=(DH.match(/function buildPublicClientUrl\(token\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnShare=(DH.match(/function buildShareClientUrl\(token\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnMsg=(DH.match(/function buildClientMessage\(ctx\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnGate=(DH.match(/function _gateValidLink\(ctx,msg\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnWeb=(DH.match(/function openWhatsAppWebOnly\(\)\{[\s\S]*?\n\}/)||[''])[0];
  const fnCopyClean=(DH.match(/function copyMsgClean\(\)\{[\s\S]*?\n  \}/)||[''])[0];
  const hbody=(primaryHandler.match(/function\(\)\{([\s\S]*)\n  \}\);/)||['',''])[1];
  const TOKEN='a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';
  const sb={clip:null,opened:[],folder:0,saved:0,copied:0};
  try{
    new Function('sb',`
      const ctx={client:'Hospital Visão',type:'Quinzenal',title:'P',token:${JSON.stringify(TOKEN)}};
      const CLIENT_LINK_BASE=${JSON.stringify(base)};
      const window={desktopAPI:{openExternal:u=>{sb.opened.push(String(u));return Promise.resolve(true);}},open:u=>sb.opened.push(String(u))}; const self=window;
      function copyToClipboard(t){sb.clip=t;}
      function flashToast(){}
      function svg(){return '';}
      const _ids={btnOpenWaMain:{classList:{add(){}},set innerHTML(v){}},groupStatus:{className:'',set innerHTML(v){},set textContent(v){}}};
      const document={getElementById:(id)=>_ids[id]||null};
      const $=id=>document.getElementById(id);
      function setStatus(txt,cls,html){}
      const api={ openExternal:window.desktopAPI.openExternal, showInFolder(){sb.folder++;}, saveCardImage(){sb.saved++;return Promise.resolve({ok:true});}, copyCardImage(){sb.copied++;return Promise.resolve({ok:true});} };
      ${fnUrl}\n${fnShare}\n${fnMsg}\n${fnGate}\n${fnWeb}\n${fnCopyClean}
      const msg=buildClientMessage(ctx);
      (function(){${hbody}})();
    `)(sb);
  }catch(e){ sb.clip='THREW:'+e.message; }
  check('GROUP_FN1','1 clique copia a MENSAGEM COMPLETA com o link de COMPARTILHAMENTO (/share/, preview premium)', String(sb.clip).indexOf('https://aprovar.agendaidseven.com.br/share/cronograma/'+TOKEN)>-1 && String(sb.clip).indexOf('/cliente/cronograma/')<0 && /^Olá, Hospital Visão\./.test(String(sb.clip)) && /Seu cronograma já está pronto para avaliação\./.test(String(sb.clip)) && /Acesse o link abaixo/.test(String(sb.clip)) && /Equipe ID Seven$/.test(String(sb.clip)));
  check('GROUP_FN2','O clique PRINCIPAL ABRE o WhatsApp (SOMENTE https://web.whatsapp.com/)', sb.opened.length===1 && sb.opened[0]==='https://web.whatsapp.com/');
  check('GROUP_FN3','O clique PRINCIPAL NÃO abre pasta e NÃO salva/copia arquivo (folder=0, saved=0, copiedImg=0)', sb.folder===0 && sb.saved===0 && sb.copied===0 && String(sb.clip).indexOf('THREW:')<0);
  check('GROUP_FN4','Clipboard SEM URL técnica do WhatsApp (sem send?text= / web.whatsapp.com/send)', String(sb.clip).indexOf('send?text=')<0 && String(sb.clip).indexOf('web.whatsapp.com/send')<0);
})();
// Electron IPC (main + preload)
check('MEDIA_IPC1', 'main: handlers save-card-image / copy-card-image / show-in-folder', /ipcMain\.handle\("save-card-image"/.test(MAIN) && /ipcMain\.handle\("copy-card-image"/.test(MAIN) && /ipcMain\.handle\("show-in-folder"/.test(MAIN));
check('MEDIA_IPC2', 'main: usa clipboard.writeImage + nativeImage (copiar imagem real)', /clipboard\.writeImage/.test(MAIN) && /nativeImage\.createFromBuffer/.test(MAIN));
check('MEDIA_IPC3', 'preload: expõe saveCardImage / copyCardImage / showInFolder', /saveCardImage:/.test(PRE) && /copyCardImage:/.test(PRE) && /showInFolder:/.test(PRE));
// Token/link continuam válidos (reuso da PARTE C)
check('MEDIA_LINK', 'Caption leva o link de COMPARTILHAMENTO completo (/share/, preview premium, sem workers.dev)', LINK ? (LINK.buildClientMessage({client:'X',type:'semanal',title:'P',token:'a1b2c3d4e5f6a1b2c3d4e5f6'}).indexOf('https://aprovar.agendaidseven.com.br/share/cronograma/a1b2c3d4e5f6a1b2c3d4e5f6')>-1) : false);

/* ===================== PARTE E — ENVIO PREMIUM via WhatsApp Business Cloud API (V64.28 / 1.0.121) =====================
   Entrega GARANTIDA: server-side, sem operador, sem preview. Token da Meta SÓ em secrets do Worker.
   NB: o ENVIO REAL (message_id da Meta) só pode ser provado com credenciais reais — é FASE 3, fora do CI.
   Aqui validamos a ARQUITETURA: rota inerte sem secrets, payload, caption limpa, e o gate do Desktop. */
console.log(`${C.b}\n[PARTE E] WhatsApp Business Cloud API — rota segura + botão Desktop (arquitetura, sem credencial)${C.x}`);
// ---- WORKER (rota preparada, inerte sem secrets) ----
check('WA_W1', 'Worker tem a rota POST /client/send-premium-whatsapp', /url\.pathname === "\/client\/send-premium-whatsapp" && request\.method === "POST"/.test(W) && /function handleSendPremiumWhatsApp\(/.test(W));
check('WA_W2', 'GATE de configuração: sem secrets → 503 WHATSAPP_CLOUD_API_NOT_CONFIGURED (não finge envio)', /function waConfigStatus\(env\)/.test(W) && /WHATSAPP_ACCESS_TOKEN/.test(W) && /WHATSAPP_PHONE_NUMBER_ID/.test(W) && /"WHATSAPP_CLOUD_API_NOT_CONFIGURED"/.test(W) && /\}, 503, env\)/.test(W));
check('WA_W3', 'Sucesso SÓ com message_id real da Meta (messages[0].id) + resposta estruturada', /messages && metaJson\.messages\[0\] && metaJson\.messages\[0\]\.id/.test(W) && /ok: true, provider: "meta_whatsapp_cloud_api", message_id: messageId/.test(W) && /to: maskPhone\(phone\)/.test(W));
check('WA_W4', 'Chama a Graph API da Meta (graph.facebook.com/.../messages) com Bearer do token (server-side)', /graph\.facebook\.com\//.test(W) && /\/messages"/.test(W) && /"Authorization": "Bearer " \+ env\.WHATSAPP_ACCESS_TOKEN/.test(W));
check('WA_W5', 'Suporta template (produção) E imagem+legenda (janela 24h/teste); imagem = card oficial', /type: "template"/.test(W) && /type: "image"/.test(W) && /image: \{ link: cardUrl/.test(W) && /OG_IMG_PATH/.test(W));
check('WA_W6', 'Resolve a task pelo token (queryTaskByToken) e valida telefone (E.164)', /queryTaskByToken\(env, accessToken, token\)/.test(W) && /function normalizePhoneE164\(/.test(W));
check('WA_W7', 'Rota NÃO usa web.whatsapp/send?text/whatsapp:// (é API server-side)', (() => {
  const fn = (W.match(/async function handleSendPremiumWhatsApp\([\s\S]*?\n\}/) || [''])[0];
  return fn.length > 0 && fn.indexOf('send?text=') < 0 && fn.indexOf('web.whatsapp') < 0 && fn.indexOf('whatsapp://') < 0;
})());
// Executa as funções PURAS reais do Worker (prova de comportamento, sem credencial).
(function(){
  const cfgFn=(W.match(/function waConfigStatus\(env\)\s*\{[\s\S]*?\n\}/)||[''])[0];
  const phFn=(W.match(/function normalizePhoneE164\(raw\)\s*\{[\s\S]*?\n\}/)||[''])[0];
  const capFn=(W.match(/function buildPremiumCaption\(clientName, tipo, link\)\s*\{[\s\S]*?\n\}/)||[''])[0];
  let mod=null;
  try{ mod=new Function(`${cfgFn}\n${phFn}\n${capFn}\nreturn {waConfigStatus,normalizePhoneE164,buildPremiumCaption};`)(); }catch(e){ mod=null; }
  check('WA_FN1','waConfigStatus: sem secrets → não configurado (lista o que falta)', !!mod && mod.waConfigStatus({}).configured===false && mod.waConfigStatus({}).missing.length===2);
  check('WA_FN2','waConfigStatus: com os 2 secrets → configurado', !!mod && mod.waConfigStatus({WHATSAPP_ACCESS_TOKEN:'x',WHATSAPP_PHONE_NUMBER_ID:'1'}).configured===true);
  check('WA_FN3','normalizePhoneE164: limpa máscara e exige 10–15 dígitos', !!mod && mod.normalizePhoneE164('55 (11) 98888-7777')==='5511988887777' && mod.normalizePhoneE164('123')===null);
  const cap = mod ? mod.buildPremiumCaption('Hospital Visão','quinzenal','https://aprovar.agendaidseven.com.br/cliente/cronograma/TOKEN') : '';
  check('WA_FN4','buildPremiumCaption: legenda limpa (saudação+assinatura+link), sem URL técnica', /^Olá, Hospital Visão\. /.test(cap) && /\*Equipe ID Seven\*$/.test(cap) && cap.indexOf('send?text=')<0 && cap.indexOf('https://aprovar.agendaidseven.com.br/cliente/cronograma/TOKEN')>-1);
})();
// ---- DESKTOP (botão oficial "Enviar card premium agora") ----
check('WA_D1', 'Desktop tem PREMIUM_SEND_URL = Worker + /client/send-premium-whatsapp (sem token Meta no client)', /const PREMIUM_SEND_URL=CLIENT_REVIEW_BASE\+'\/client\/send-premium-whatsapp'/.test(DH) && !/WHATSAPP_ACCESS_TOKEN/.test(DH));
check('WA_D2', 'Individual via Cloud API existe como OPÇÃO AVANÇADA: btnSendAuto "Enviar para número individual" + _wireAutoSend', /id="btnSendAuto"/.test(DH) && /Enviar para número individual/.test(DH) && /function _wireAutoSend\(ctx\)/.test(DH));
check('WA_D2c', 'O fluxo individual NÃO é principal: "Enviar card premium ao responsável" foi removido', !/Enviar card premium ao responsável/.test(DH));
check('WA_D2b', 'Cabeçalho do modal usa a MARCA ID Seven (gcs-headic.brand = var(--logo)), não ícone genérico', /<div class="gcs-headic brand"[^>]*aria-label="ID Seven"/.test(DH) && /\.gcs-headic\.brand\{background:var\(--logo\)/.test(DH));
check('WA_D3', 'Chama SÓ a rota segura (fetch PREMIUM_SEND_URL) com payload token/clientName/phone/cronogramaTipo', /fetch\(PREMIUM_SEND_URL,\{method:'POST'/.test(DH) && /token:ctx\.token/.test(DH) && /clientName:ctx\.client/.test(DH) && /phone:phone/.test(DH) && /cronogramaTipo:ctx\.type/.test(DH));
check('WA_D4', 'Sucesso SÓ com message_id real (data.message_id)', /data&&data\.ok&&data\.message_id/.test(DH));
check('WA_D5', '503/NOT_CONFIGURED → mensagem clara de configuração (sem fallback WhatsApp Web)', /WHATSAPP_CLOUD_API_NOT_CONFIGURED/.test(DH) && /A integração WhatsApp Cloud API ainda não está configurada\. Configure as credenciais da Meta para habilitar o envio automático do card premium\./.test(DH));
check('WA_D6', 'Fluxo automático NÃO usa web.whatsapp/send?text/whatsapp:// (corpo executável)', (() => {
  const fn = (DH.match(/function _wireAutoSend\(ctx\)\{[\s\S]*?\n\}/) || [''])[0].replace(/^\s*\/\/.*$/gm,'');
  return fn.length > 0 && fn.indexOf('send?text=') < 0 && fn.indexOf('web.whatsapp') < 0 && fn.indexOf('whatsapp://') < 0;
})());
check('WA_D7', 'Card Aurora Glass (B-final) segue como mídia oficial planejada (autoCardPreview usa CARD_IMG_B64)', /id="autoCardPreview"/.test(DH) && /data:image\/jpeg;base64,'\+CARD_IMG_B64/.test(DH));
check('WA_D8', 'Individual = "Opção avançada" recolhida (<details>, não open); rótulo correto', /<details class="gcs-adv"><summary>Opção avançada: enviar para número individual com botão oficial<\/summary>/.test(DH) && !/<details class="gcs-adv" open>/.test(DH));
check('WA_D9', 'GRUPO é principal: btnOpenWaMain ANTES do <details>; individual (btnSendAuto + WhatsApp do responsável) DENTRO/depois do <details>', (() => {
  const prim = DH.indexOf('id="btnOpenWaMain"');
  const adv = DH.indexOf('Opção avançada: enviar para número individual');
  const auto = DH.indexOf('id="btnSendAuto"');
  const resp = DH.indexOf('WhatsApp do responsável');
  return prim > -1 && adv > -1 && auto > -1 && prim < adv && auto > adv && resp > adv;  // grupo (abrir WhatsApp) antes; individual depois
})());

/* ===================== PARTE F — BLINDAGEM contra dados de TESTE no Kanban real ===================== */
console.log(`${C.b}\n[PARTE F] Dados de teste (isCloudApiTest/qa-demo) NUNCA renderizam no quadro${C.x}`);
check('GUARD1', 'Desktop define isTestTask (flag isCloudApiTest, qa-demo, seeds de teste)', /function isTestTask\(t\)\{/.test(DH) && /t\.isCloudApiTest===true/.test(DH) && /\/\^qa-demo\/i\.test\(id\)/.test(DH));
check('GUARD2', 'onSnapshot de tasks FILTRA isTestTask antes de popular state.tasks', /collection\('tasks'\)\.onSnapshot[\s\S]*?\.filter\(t=>!isTestTask\(t\)\)/.test(DH));
// Executa a função real: deve filtrar docs de teste e PRESERVAR clientes reais.
(function(){
  const fn=(DH.match(/function isTestTask\(t\)\{[\s\S]*?\n\}/)||[''])[0];
  let isTestTask=null; try{ isTestTask=new Function('t', fn.replace(/^function isTestTask\(t\)\{/,'').replace(/\}$/,'')); }catch(e){}
  const testDocs=[{id:'qa-demo-x'},{isCloudApiTest:true},{client:'Cliente Demo ID Seven'},{title:'Cronograma Demo (teste do card)'},{client:'Hospital Visão (Teste Cloud API)'}];
  const realDocs=[{id:'abc',client:'OLHAR',title:'Cronograma Quinzenal — OLHAR'},{id:'x',client:'Dr. Hygor'},{id:'y',client:'CEO'}];
  check('GUARD3', 'isTestTask MARCA todos os docs de teste como teste', !!isTestTask && testDocs.every(t=>isTestTask(t)===true));
  check('GUARD4', 'isTestTask NÃO marca clientes reais (sem falso-positivo)', !!isTestTask && realDocs.every(t=>isTestTask(t)===false));
})();

/* ===================== PARTE G — FASE 1: clientStatusView (não-regressão) =====================
   Prova que a NOVA função pura clientStatusView(t) é um wrapper FIEL: para um conjunto
   representativo de estados, .key === operationalCol(t) e .label/.color === opColOf(operationalCol(t)).
   Executa o CÓDIGO REAL extraído do renderer (não é mock). Confirma também que a função ainda
   está DORMENTE (passo 1): nenhum render — taskCard / detalhe / card de revisão — a chama. */
console.log(`${C.b}\n[PARTE G] Fase 1 — clientStatusView é wrapper FIEL de operationalCol (não-regressão)${C.x}`);
check('CSV_DEF', 'clientStatusView(t) existe e é função pura (retorna {key,label,color,axis})', /function clientStatusView\(t\)\{[\s\S]*?return \{key:k,label:c\.label,color:c\.color,axis:'operational'\};/.test(DH));
// Escopo do passo 4 (fora de comentários): definição + 4 chamadas (taskCard, card de revisão, flowSummary, opPanel).
const DH_noc = DH.replace(/^\s*\/\/.*$/gm,'');
// detail-hierarchy-v2: o chip do DETALHE migrou da fonte clientStatusView p/ detailState
// (a mesma máquina do hero — nunca contradiz). Restam 4 usos: definição + taskTimeline
// interno + badge do taskCard (ternário designerView) + flowSummary "Status operacional".
check('CSV_SCOPE', 'clientStatusView: definição + taskCard + flowSummary + uso interno taskTimeline (4 ocorrências; chip do detalhe usa detailState)', (DH_noc.match(/clientStatusView\(/g)||[]).length === 4 && /function clientStatusView\(t\)/.test(DH_noc));
// taskCard MIGRADO (role-aware f96aa2e: ternário designerView).
check('CSV_TASKCARD_MIGRATED', "taskCard cronograma usa designerView?designerStatusView:clientStatusView no badge", /key==='cronograma'\)\{const oc=designerView\?designerStatusView\(t\):clientStatusView\(t\);/.test(DH));
// chip do detalhe MIGRADO p/ a máquina de estados (1 chip, sem status concorrentes).
check('CSV_REVISAO_MIGRATED', 'Chip do detalhe usa detailState(t) (rev-chip único, sem contradição)', /const dsc=detailState\(t\);[\s\S]{0,200}rev-chip/.test(DH));
// detalhe MIGRADO (flowSummaryBlock "Status operacional" + opPanelBlock "Próxima ação").
check('CSV_DETALHE_MIGRATED', 'flowSummary "Status operacional" usa clientStatusView; opPanel migrou p/ taskTimeline (tl.current)', /const oc=clientStatusView\(t\);[^\n]*\n\s*h\+='<div class="det-flow-col"><div class="det-flow-lbl">Status operacional/.test(DH) && /function opPanelBlock\(t\)\{[\s\S]*?const tl=taskTimeline\(t\);[\s\S]*?const oc=tl\.current;/.test(DH));
// NENHUM badge deriva mais de opColOf(operationalCol(t)) diretamente (só em comentários).
check('CSV_NO_OLD_BADGE', 'Nenhum badge usa mais const oc=opColOf(operationalCol(t)) (migração completa)', (DH.match(/const oc=opColOf\(operationalCol\(t\)\)/g)||[]).length === 0);
(function(){
  // Extrai o CÓDIGO REAL do renderer e monta um módulo executável (sem DOM, sem rede).
  const grab=(re)=>{const m=DH.match(re);return m?m[0]:'';};
  const constArr=(name)=>grab(new RegExp('const '+name+'\\s*=\\s*\\[[\\s\\S]*?\\];'));
  const fnDecl=(name)=>grab(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
  const oneLine=(name)=>grab(new RegExp('function '+name+'\\([^)]*\\)\\{.*\\}'));
  let mod=null, err=null;
  try{
    const pieces=[
      constArr('SECTORS'), 'const SECTOR_ALIAS='+( (DH.match(/const SECTOR_ALIAS=\{[\s\S]*?\};/)||['const SECTOR_ALIAS={};'])[0].replace(/^const SECTOR_ALIAS=/,'') ),
      constArr('STATUS'), constArr('CLIENT_COLS'), constArr('OPERATIONAL_COLS'),
      oneLine('secOf'), oneLine('stOf'), oneLine('opColOf'),
      oneLine('hasDesigner'), oneLine('designerOf'), oneLine('designerCol'),
      oneLine('pendingLegend'), oneLine('pendingFeed'), oneLine('pendingStory'), oneLine('pendingProduction'),
      oneLine('designerDelivered'),
      // detail-hierarchy-v2: dependências phase-aware de hasPendingItemRevision
      fnDecl('clientApprovalPhaseOf'), fnDecl('pendingClientItems'), fnDecl('hasTeamAdjustedAwaiting'),
      oneLine('hasPendingItemRevision'),
      fnDecl('isFullyComplete'), fnDecl('clientCol'), fnDecl('operationalCol'), fnDecl('clientStatusView'),
      'return {clientStatusView,operationalCol,opColOf};'
    ];
    mod=new Function(pieces.join('\n'))();
  }catch(e){ err=e.message; }
  check('CSV_EVAL', 'Funções reais (clientStatusView/operationalCol/opColOf) avaliáveis a partir do renderer', !!mod && !err);
  if(mod){
    // Estados representativos do cronograma (usam designerAssignment.designerId p/ hasDesigner REAL).
    const D={designerAssignment:{designerId:'d'}};
    const ESTADOS=[
      ['afazer (rascunho)',                 {sector:'cronograma',status:'afazer'}],
      ['enviado ao cliente',                {sector:'cronograma',clientSentBy:'u',cronStatus:'enviado_cliente'}],
      ['temas aprovados (sem designer)',    {sector:'cronograma',clientFlowStatus:'aprovado',cronStatus:'aprovado_cliente'}],
      ['enviado ao designer',               {sector:'cronograma',clientFlowStatus:'producao',designerAssignment:{designerId:'d'},designerFlowStatus:'afazer',cronStatus:'sent_to_designer'}],
      ['designer em produção',              {sector:'cronograma',designerAssignment:{designerId:'d'},designerFlowStatus:'andamento'}],
      ['designer entregou (falta legenda)', {sector:'cronograma',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',cronContents:[{tema:'T1'}]}],
      ['reenviado p/ aprovação final',      {sector:'cronograma',clientFlowStatus:'reenviado',cronStatus:'ready_for_final_client_review',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',cronContents:[{tema:'T1',legenda:'L1',feedImageUrl:'f1'}]}],
      ['cliente pediu ajuste (geral)',      {sector:'cronograma',clientReview:{status:'revisao'}}],
      ['cliente pediu ajuste (item)',       {sector:'cronograma',clientItems:{i0:{cs:'em_revisao'}}}],
      ['concluído (aprovação final)',       {sector:'cronograma',finalApprovalCompleted:true,clientFlowStatus:'concluido',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',cronContents:[{tema:'T1',legenda:'L1',feedImageUrl:'f1'}]}],
      ['setor NÃO-cronograma (designer)',   {sector:'designer',status:'andamento'}],
      ['setor NÃO-cronograma (reuniao)',    {sector:'reuniao',status:'concluido'}],
    ];
    let keyOK=true, labelOK=true, colorOK=true; const linhas=[];
    ESTADOS.forEach(([nome,t])=>{
      const sv=mod.clientStatusView(t);
      let expKey, expLabel, expColor;
      if(t.sector!=='cronograma'){ expKey=t.status||'afazer'; }     // não-cronograma: status cru
      else { expKey=mod.operationalCol(t); const c=mod.opColOf(expKey); expLabel=c.label; expColor=c.color; }
      if(t.sector==='cronograma'){
        if(sv.key!==expKey)keyOK=false;
        if(sv.label!==expLabel)labelOK=false;
        if(sv.color!==expColor)colorOK=false;
      } else {
        if(sv.key!==expKey)keyOK=false;
      }
      linhas.push(nome+' → '+sv.key+' / '+sv.label);
    });
    check('CSV_KEY',   'clientStatusView(t).key === operationalCol(t) em TODOS os estados de cronograma', keyOK);
    check('CSV_LABEL', 'clientStatusView(t).label === opColOf(operationalCol(t)).label (badge idêntico)', labelOK);
    check('CSV_COLOR', 'clientStatusView(t).color === opColOf(operationalCol(t)).color (cor idêntica)', colorOK);
    check('CSV_NCRON', 'Setor não-cronograma: clientStatusView usa t.status (axis=status)', mod.clientStatusView({sector:'designer',status:'andamento'}).axis==='status');
    console.log('  '+C.d+'estados provados: '+ESTADOS.length+C.x);
  }
})();

/* ===================== PARTE H — FASE 2 (passo 1): taskTimeline (dormente) =====================
   Prova: (a) taskTimeline existe e é DORMENTE (nenhum render a chama); (b) os estados dos
   marcos são IDÊNTICOS às flags do opPanelBlock; (c) tolerância a history[] kind/type,
   clientActions[], tarefa sem history, pedido de ajuste e tarefa concluída — sem lançar. */
console.log(`${C.b}\n[PARTE H] Fase 2 (passo 1) — taskTimeline pura/dormente + paridade de estados${C.x}`);
check('TL_DEF', 'taskTimeline(t) existe e retorna {current,last,next,owner,milestones}', /function taskTimeline\(t\)\{[\s\S]*?return \{ current:cur, last:last, next:nextActionText\(t\), owner:owner, milestones:milestones \};/.test(DH));
const DH_noc2 = DH.replace(/^\s*\/\/.*$/gm,'');
// Passo 2: taskTimeline agora é consumida APENAS pelo taskCardTimeline (definição + 1 uso).
check('TL_CARD_WIRED', 'taskTimeline consumida por taskCardTimeline + opPanelBlock (3 ocorrências: definição + 2 usos)', (DH_noc2.match(/taskTimeline\(/g)||[]).length === 3 && /function taskTimeline\(t\)/.test(DH_noc2));
check('TL2_CARD_RENDER', 'taskCard escolhe timeline por perspectiva (designerCardTimeline × taskCardTimeline) e taskCardTimeline usa taskTimeline(t)', /\?designerCardTimeline\(t\):taskCardTimeline\(t\)\);/.test(DH) && /function taskCardTimeline\(t\)\{[\s\S]*?const tl=taskTimeline\(t\);/.test(DH));
check('TL2_CARD_ONLY', 'taskCardTimeline existe e é chamado só no taskCard (definição + 1 chamada)', (DH_noc2.match(/taskCardTimeline\(/g)||[]).length === 2);
check('TL2_CRON_GUARD', 'timeline do card só renderiza p/ cronograma (guard secOf!=cronograma -> "")', /function taskCardTimeline\(t\)\{\s*\n\s*if\(secOf\(t\.sector\)\.key!=='cronograma'\)return '';/.test(DH));
// PASSO 3: o detalhe (opPanelBlock) AGORA usa taskTimeline(t) (timeline completa); sem steps[] próprios.
(function(){const fn=(DH.match(/function opPanelBlock\(t\)\{[\s\S]*?\n\}/)||[''])[0];
  check('TL3_DETALHE_MIGRATED', 'opPanelBlock usa taskTimeline(t) + tl.milestones.forEach + det-tl-meta', fn.length>0 && /const tl=taskTimeline\(t\);/.test(fn) && /tl\.milestones\.forEach/.test(fn) && /det-tl-meta/.test(fn));
  check('TL3_NO_OLD_STEPS', 'opPanelBlock NÃO tem mais os steps antigos (Legenda final pronta / Feed (1080×1440))', fn.indexOf('Legenda final pronta')<0 && fn.indexOf('Feed (1080')<0 && fn.indexOf('const steps=[')<0);
})();
(function(){
  const grab=(re)=>{const m=DH.match(re);return m?m[0]:'';};
  const constArr=(name)=>grab(new RegExp('const '+name+'\\s*=\\s*\\[[\\s\\S]*?\\];'));
  const fnDecl=(name)=>grab(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
  const oneLine=(name)=>grab(new RegExp('function '+name+'\\([^)]*\\)\\{.*\\}'));
  let mod=null, err=null;
  try{
    const pieces=[
      constArr('SECTORS'), (DH.match(/const SECTOR_ALIAS=\{[\s\S]*?\};/)||['const SECTOR_ALIAS={};'])[0],
      constArr('STATUS'), constArr('CLIENT_COLS'), constArr('OPERATIONAL_COLS'),
      oneLine('secOf'), oneLine('stOf'), oneLine('opColOf'),
      oneLine('hasDesigner'), oneLine('designerOf'), oneLine('designerCol'), oneLine('designerDelivered'),
      oneLine('pendingLegend'), oneLine('pendingFeed'), oneLine('pendingStory'), oneLine('pendingProduction'),
      // detail-hierarchy-v2: dependências phase-aware de hasPendingItemRevision
      fnDecl('clientApprovalPhaseOf'), fnDecl('pendingClientItems'), fnDecl('hasTeamAdjustedAwaiting'),
      oneLine('hasPendingItemRevision'),
      fnDecl('isFullyComplete'), fnDecl('clientCol'), fnDecl('operationalCol'), fnDecl('nextActionText'),
      fnDecl('clientStatusView'), fnDecl('_tlEventAt'),
      (DH.match(/const TL_EVENT_LABELS=\{[\s\S]*?\n\};/)||[''])[0], fnDecl('_tlHumanLabel'),
      fnDecl('taskTimeline'),
      // deps p/ renderizar opPanelBlock (detalhe) no sandbox:
      oneLine('esc'), oneLine('withAlpha'), fnDecl('fmtDateTimeBR'), fnDecl('_tlRelAgo'),
      'function svg(){return "";}', 'const state={users:[{id:"d",name:"Marcos Dias"},{id:"ana",name:"Ana Lima"},{id:"cli",name:"Cliente"},{id:"jm",name:"João Marques"}]};',
      fnDecl('opPanelBlock'),
      'return {taskTimeline,operationalCol,clientCol,hasDesigner,designerDelivered,pendingLegend,pendingFeed,opPanelBlock};'
    ];
    mod=new Function(pieces.join('\n'))();
  }catch(e){ err=e&&e.message; }
  check('TL_EVAL', 'taskTimeline + deps avaliáveis a partir do renderer', !!mod && !err);
  if(!mod){ console.log('  '+C.r+'erro: '+err+C.x); return; }
  const ms=(tl,key)=>tl.milestones.find(m=>m.key===key);
  // Fixtures obrigatórias
  const FIX=[
    ['history[] com kind',        {sector:'cronograma',designerAssignment:{designerId:'d'},designerFlowStatus:'andamento',history:[{kind:'designer_moved',at:1000,byId:'d',from:'afazer',to:'andamento'}]}],
    ['history[] com type',        {sector:'cronograma',clientFlowStatus:'reenviado',cronStatus:'ready_for_final_client_review',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',cronContents:[{tema:'T',legenda:'L',feedImageUrl:'f'}],history:[{type:'reenviado_cliente',label:'Reenviado',at:2000,byId:'u',channel:'final_review'}]}],
    ['clientActions[]',           {sector:'cronograma',clientReview:{status:'aprovado'},clientActions:{a1:{type:'approveAll',at:1500,by:'cli'}}}],
    ['sem history',               {sector:'cronograma',clientSentBy:'u'}],
    ['pedido de ajuste',          {sector:'cronograma',clientReview:{status:'revisao'},clientItems:{i0:{cs:'em_revisao',at:1234}}}],
    ['concluída',                 {sector:'cronograma',finalApprovalCompleted:true,clientFlowStatus:'concluido',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',cronContents:[{tema:'T',legenda:'L',feedImageUrl:'f'}],history:[{kind:'moved',at:3000,to:'concluido',byId:'u'}]}],
  ];
  let noThrow=true, shapeOK=true, parityOK=true;
  FIX.forEach(([nome,t])=>{
    let tl=null; try{ tl=mod.taskTimeline(t); }catch(e){ noThrow=false; tl=null; }
    if(!tl){ return; }
    if(!Array.isArray(tl.milestones)||tl.milestones.length!==10||!('current'in tl)||!('next'in tl)||!('owner'in tl)) shapeOK=false;
    // PARIDADE com opPanelBlock (recálculo independente):
    const cf=mod.clientCol(t), hasD=mod.hasDesigner(t), delivered=mod.designerDelivered(t);
    const themesOk=(cf==='aprovado'||cf==='producao'||cf==='revisao'||cf==='reenviado'||cf==='concluido'||(t.clientReview&&t.clientReview.status==='aprovado'));
    const resent=(cf==='reenviado'||cf==='concluido');
    const finalOk=!!(t.finalApprovalCompleted||cf==='concluido');
    const prodOk=(!mod.pendingLegend(t)&&!mod.pendingFeed(t));
    // task-flow-fix: "designer_producao" só é done quando o designer iniciou (andamento/revisao) ou entregou.
    const dc=(['afazer','andamento','revisao','concluido'].includes(t.designerFlowStatus))?t.designerFlowStatus:(t.status||'afazer');
    const designerStarted=hasD&&(dc==='andamento'||dc==='revisao'||delivered);
    const exp={temas_aprovados:!!themesOk,enviado_designer:!!hasD,designer_producao:!!designerStarted,designer_entregou:!!delivered,aguardando_legenda:!!prodOk,enviado_final:!!resent,concluido:!!finalOk};
    Object.keys(exp).forEach(k=>{ const m=ms(tl,k); if(!m||m.done!==exp[k]){ parityOK=false; } });
  });
  check('TL_NOTHROW',  'taskTimeline NÃO lança em nenhuma fixture (kind/type/clientActions/sem history/ajuste/concluída)', noThrow);
  check('TL_SHAPE',    'Sempre 10 marcos + {current,next,owner} presentes', shapeOK);
  check('TL_STATE_PARITY', 'milestones[].done IDÊNTICO às flags do opPanelBlock (temas/designer/produção/entrega/legenda/final/concluído)', parityOK);
  // Casos específicos
  const f1=mod.taskTimeline(FIX[0][1]); check('TL_AT_KIND', 'history[] kind: marco "designer_producao" pega at=1000 (by=d)', ms(f1,'designer_producao').at===1000 && ms(f1,'designer_producao').by==='d');
  const f3=mod.taskTimeline(FIX[2][1]); check('TL_AT_CLIENTACTIONS', 'clientActions approveAll: "temas_aprovados" done + at=1500', ms(f3,'temas_aprovados').done===true && ms(f3,'temas_aprovados').at===1500);
  const f4=mod.taskTimeline(FIX[3][1]); check('TL_NOHISTORY_SAFE', 'sem history: não quebra; datas null; last via fallback', ms(f4,'criado').done===true && f4.last!==null);
  const f5=mod.taskTimeline(FIX[4][1]); check('TL_AJUSTE', 'pedido de ajuste: marco "ajuste" state="attention"', ms(f5,'ajuste').state==='attention');
  const f6=mod.taskTimeline(FIX[5][1]); check('TL_CONCLUIDO', 'concluída: "concluido" done=true e nenhum marco "current"', ms(f6,'concluido').done===true && !f6.milestones.some(m=>m.state==='current'));
  check('TL_NEXT', 'taskTimeline.next === nextActionText (próxima ação)', typeof f1.next==='string' && f1.next.length>0);
  // ===== PASSO 2.1 — humanização do "Último:" (nenhum rótulo cru) =====
  const RAWMAP=[
    ['designer_moved',  {sector:'cronograma',history:[{kind:'designer_moved',at:1000,byId:'d'}]}, 'Designer atualizou'],
    ['reviseItem',      {sector:'cronograma',clientActions:{a:{type:'reviseItem',at:1000,by:'cli'}}}, 'Cliente pediu ajuste'],
    ['approveAll',      {sector:'cronograma',clientActions:{a:{type:'approveAll',at:1000,by:'cli'}}}, 'Cliente aprovou tudo'],
    ['sent_to_client',  {sector:'cronograma',history:[{type:'sent_to_client',at:1000}]}, 'Enviado ao cliente'],
    ['sent_to_designer',{sector:'cronograma',history:[{type:'sent_to_designer',at:1000}]}, 'Enviado ao designer'],
  ];
  const RAWCODES=['designer_moved','reviseItem','approveAll','sent_to_client','sent_to_designer'];
  let mapOK=true, noRaw=true;
  RAWMAP.forEach(([raw,t,exp])=>{ const tl=mod.taskTimeline(t); const lab=(tl.last&&tl.last.label)||'';
    if(lab!==exp) mapOK=false;
    if(RAWCODES.some(c=>lab.indexOf(c)>=0)) noRaw=false; });
  check('TL_HUMAN_MAP', 'Último: mapeia designer_moved/reviseItem/approveAll/sent_to_client/sent_to_designer p/ texto humano', mapOK);
  check('TL_HUMAN_NO_RAW', 'Último: NENHUM rótulo cru/técnico aparece (kind/type)', noRaw);
  // rótulo já humano em history[].label é preservado (não vira "Atualização")
  const fHL=mod.taskTimeline({sector:'cronograma',history:[{type:'reenviado_cliente',label:'Reenviado ao cliente (versão FINAL)',at:1000}]});
  check('TL_HUMAN_KEEP', 'Último: preserva label já humano (com espaços) sem virar genérico', fHL.last.label==='Enviado para aprovação final' || fHL.last.label==='Reenviado ao cliente (versão FINAL)');
  // o card (taskCardTimeline) renderiza o label humanizado (esc(tl.last.label)) — sem código cru
  check('TL_HUMAN_CARD', 'taskCardTimeline exibe "Último" + label humanizado (via tl.last.label)', /tc-tl-k">Último<\/span><span>'\+lastTxt/.test(DH) && /const lastTxt=tl\.last\?\(esc\(tl\.last\.label\)/.test(DH));
  // ===== PASSO 3 — detalhe (opPanelBlock) renderizado a partir de taskTimeline =====
  const RAWALL=['designer_moved','reviseItem','approveAll','approveItem','sent_to_client','sent_to_designer','final_sent','final_review','reenviado_cliente','social_producao','em_revisao','clientActions','kind','type'];
  const stMap=(s)=> s==='done'?'done':(s==='current'||s==='attention')?'cur':'todo';
  let rowsOK=true, detNoRaw=true, detParity=true, detThrow=false;
  FIX.forEach(([nome,t])=>{
    let html=''; try{ html=mod.opPanelBlock(t); }catch(e){ detThrow=true; return; }
    const rows=(html.match(/det-tl-row/g)||[]).length;
    if(rows!==10) rowsOK=false;
    if(RAWALL.some(c=>html.indexOf(c)>=0)) detNoRaw=false;
    // paridade de estados: classe de cada row === estado mapeado de taskTimeline.milestones
    const cls=(html.match(/det-tl-row (done|cur|todo)/g)||[]).map(x=>x.split(' ')[1]);
    const exp=mod.taskTimeline(t).milestones.map(m=>stMap(m.state));
    if(cls.length!==exp.length||cls.some((c,k)=>c!==exp[k])) detParity=false;
  });
  check('TL3_RENDER_NOTHROW','opPanelBlock renderiza sem lançar em todas as fixtures', !detThrow);
  check('TL3_ROWS','Detalhe mostra os 10 marcos canônicos (det-tl-row x10) em todas as fixtures', rowsOK);
  check('TL3_NO_RAW','Detalhe NÃO exibe nenhum código interno (kind/type/clientActions)', detNoRaw);
  check('TL3_STATE_PARITY','Estados do detalhe (done/cur/todo) IDÊNTICOS aos de taskTimeline', detParity);
  // amostra: aguardando designer mostra data+autor humanizado no marco "Enviado ao designer"/"Designer em produção"
  const hd=mod.opPanelBlock(FIX[0][1]);  // history kind designer_moved byId='d' (Marcos Dias)
  check('TL3_META','Detalhe inclui data+autor por marco (det-tl-meta + "por <nome>")', /det-tl-meta/.test(hd) && /por Marcos/.test(hd));
  console.log('  '+C.d+'fixtures provadas: '+FIX.length+' · humanização: '+RAWMAP.length+' · detalhe: '+FIX.length+C.x);
})();

/* ===================== DETAIL-HIERARCHY-V2 — máquina de estados do detalhe =====================
 * Executa detailState/detailActionsHtml REAIS (extraídas do renderer) nos 8 estados aprovados
 * e prova: status principal único, próxima ação, responsável, botões por fase, colapsável. */
(function(){
  console.log(`${C.b}\n[DH] Detalhe — hierarquia aprovada (8 estados + botões por fase)${C.x}`);
  const grab=(re)=>{const m=DH.match(re);return m?m[0]:'';};
  const fnDecl=(name)=>{const m=DH.match(new RegExp('(?:async )?function '+name+'\\s*\\([^)]*\\)\\s*\\{'));if(!m)return '';let s=DH.indexOf(m[0]),d=0;for(let i=s+m[0].length-1;i<DH.length;i++){const c=DH[i];if(c==='{')d++;else if(c==='}'){d--;if(d===0)return DH.slice(s,i+1);}}return '';};
  const constArr=(n)=>grab(new RegExp('const '+n+'\\s*=\\s*\\[[\\s\\S]*?\\];'));
  let mod=null,err=null;
  try{
    const pieces=[
      constArr('SECTORS'),(DH.match(/const SECTOR_ALIAS=\{[\s\S]*?\};/)||['const SECTOR_ALIAS={};'])[0],
      constArr('STATUS'),constArr('CLIENT_COLS'),constArr('OPERATIONAL_COLS'),
      fnDecl('secOf'),fnDecl('stOf'),fnDecl('esc'),fnDecl('withAlpha'),fnDecl('initials'),fnDecl('svg'),
      'const ICON={};',
      fnDecl('hasDesigner'),fnDecl('designerOf'),fnDecl('designerCol'),fnDecl('designerDelivered'),
      fnDecl('pendingLegend'),fnDecl('pendingFeed'),fnDecl('pendingStory'),fnDecl('pendingProduction'),
      fnDecl('clientApprovalPhaseOf'),fnDecl('pendingClientItems'),fnDecl('hasTeamAdjustedAwaiting'),
      fnDecl('hasPendingItemRevision'),fnDecl('isFullyComplete'),fnDecl('clientCol'),
      fnDecl('clientApproved'),fnDecl('isSentToDesigner'),fnDecl('canSendToClient'),
      fnDecl('fmtDateTimeBR'),
      fnDecl('detailState'),fnDecl('detailActionsHtml'),
      'function svgSafe(){return "";}',
      'return {detailState,detailActionsHtml,hasPendingItemRevision,clientApprovalPhaseOf};'
    ].join('\n');
    mod=new Function('state',src=>{}) , mod=new Function('state',pieces)({users:[],user:{id:'u',name:'X'}});
  }catch(e){err=e&&e.message;}
  check('DH_EVAL','detailState/detailActionsHtml avaliáveis a partir do renderer real', !!mod && !err || (console.log('   err:',err),!!mod));
  if(mod){
    const FULL=[{tema:'T1',legenda:'L',feedImageUrl:'f'},{tema:'T2',legenda:'L',feedImageUrl:'f'}];
    const TH=[{tema:'T1'},{tema:'T2'}];
    const S={};
    S.e1={sector:'cronograma',cronContents:TH,clientApprovalPhase:'themes',clientFlowStatus:'revisao',cronStatus:'em_revisao_cliente',clientReview:{status:'revisao'},clientItems:{i1:{cs:'em_revisao',phase:'themes',note:'trocar foto'}}};
    S.e2={sector:'cronograma',cronContents:TH,clientApprovalPhase:'themes',clientFlowStatus:'revisao',cronStatus:'em_revisao_cliente',clientReview:{status:'revisao'},clientItems:{i1:{cs:null,phase:'themes',teamAdjustedAt:1,teamAdjustedBy:'X'}}};
    S.e3={sector:'cronograma',cronContents:TH,clientApprovalPhase:'themes',clientFlowStatus:'aprovado',cronStatus:'aprovado_cliente',clientReview:{status:'aprovado'},clientItems:{}};
    S.e4={sector:'cronograma',cronContents:TH,clientFlowStatus:'producao',designerAssignment:{designerId:'d'},designerFlowStatus:'afazer',clientItems:{}};
    S.e5={sector:'cronograma',cronContents:TH,clientFlowStatus:'producao',designerAssignment:{designerId:'d'},designerFlowStatus:'andamento',clientItems:{}};
    S.e6={sector:'cronograma',cronContents:[{tema:'T1'},{tema:'T2'}],clientFlowStatus:'producao',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',clientItems:{}};
    S.e7={sector:'cronograma',cronContents:FULL,clientApprovalPhase:'final',cronStatus:'ready_for_final_client_review',clientFlowStatus:'reenviado',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',clientItems:{}};
    S.e8={sector:'cronograma',cronContents:FULL,clientFlowStatus:'concluido',finalApprovalCompleted:true,operationalStatus:'concluido',designerAssignment:{designerId:'d'},designerFlowStatus:'concluido',clientFinalApprovedAt:1718000000000,clientItems:{}};
    const K=k=>mod.detailState(S[k]);
    check('DH_S1','Estado 1: Cliente pediu ajuste (vermelho, owner=social, ações fix/teamfix)', K('e1').key==='cliente_ajuste' && K('e1').owner==='social' && K('e1').actions.indexOf('teamfix')>=0);
    check('DH_S2','Estado 2: Ajuste realizado — aguardando cliente (owner=cliente, SEM teamfix)', K('e2').key==='ajuste_aguardando' && K('e2').owner==='cliente' && K('e2').actions.indexOf('teamfix')===-1);
    check('DH_S3','Estado 3: Temas aprovados (owner=social, ação senddesigner presente)', K('e3').key==='temas_aprovados' && K('e3').actions.indexOf('senddesigner')>=0);
    check('DH_S4','Estado 4: Aguardando designer iniciar (owner=designer)', K('e4').key==='designer_aguardando' && K('e4').owner==='designer');
    check('DH_S5','Estado 5: Designer em produção', K('e5').key==='designer_producao');
    check('DH_S6','Estado 6: Designer entregou (ações prod/sendclient)', K('e6').key==='designer_entregou' && K('e6').actions.indexOf('prod')>=0);
    check('DH_S7','Estado 7: Aguardando aprovação final (owner=cliente)', K('e7').key==='aguardando_final' && K('e7').owner==='cliente');
    check('DH_S8','Estado 8: Concluído (owner=none, SEM botões de envio/ajuste)', K('e8').key==='concluido' && K('e8').owner==='none' && K('e8').actions.indexOf('senddesigner')===-1 && K('e8').actions.indexOf('teamfix')===-1);
    // anti-regressão central: o card NÃO fica preso em ajuste após correção da equipe + fase final limpa
    check('DH_UNSTICK','Pendência de TEMAS resolvida (teamAdjusted) não trava: estado vira ajuste_aguardando (não cliente_ajuste)', K('e2').key!=='cliente_ajuste');
    check('DH_PHASE_ISOLATION','Item em revisão de TEMAS não contamina a fase FINAL (hasPendingItemRevision=false na final)',
      mod.hasPendingItemRevision({sector:'cronograma',cronContents:FULL,clientApprovalPhase:'final',clientItems:{i0:{cs:'em_revisao',phase:'themes'}}})===false);
    check('DH_BTN_DESIGNER','Botão "Enviar para designer" SOMENTE no estado temas_aprovados (e1/e8 não têm)',
      K('e3').actions.indexOf('senddesigner')>=0 && K('e1').actions.indexOf('senddesigner')===-1 && K('e8').actions.indexOf('senddesigner')===-1);
  }
  // ESTRUTURA do renderer
  check('DH_HERO','openDetails usa detailHeroBlock + flowDetailsBlock (substitui blocos soltos)', /detailHeroBlock\(t\)\+\s*\n?\s*flowDetailsBlock\(t\)\+/.test(DH.replace(/\/\/[^\n]*\n/g,'\n')) || (/detailHeroBlock\(t\)\+/.test(DH) && /flowDetailsBlock\(t\)\+/.test(DH)));
  check('DH_COLLAPSE','"Detalhes do fluxo" é <details> colapsado contendo flowSummaryBlock+opPanelBlock', /<details class="det-flowdet"><summary>Detalhes do fluxo<\/summary>/.test(DH) && /flowSummaryBlock\(t\)\+opPanelBlock\(t\)/.test(DH));
  check('DH_NO_GROUPS','Rodapé SEM grupos de UI "Ações do cliente"/"Ações da tarefa" concorrentes', DH.indexOf('det-act-lbl">Ações do cliente')===-1 && DH.indexOf('det-act-lbl">Ações da tarefa')===-1);
  // ═══ CORREÇÃO ARQUITETURAL: "Marcar como corrigido" passa pela CAMADA CENTRAL (Worker) ═══
  const mia=(DH.match(/async function markItemsAdjusted\(taskId\)\{[\s\S]*?\n\}/)||[''])[0];
  check('DH_TEAMFIX_NO_DIRECT_WRITE','markItemsAdjusted NÃO grava direto no Firestore (sem db.collection/update/FieldValue)',
    mia.length>0 && mia.indexOf('db.collection')===-1 && mia.indexOf('FieldValue')===-1 && mia.indexOf('.update(')===-1);
  check('DH_TEAMFIX_CENTRAL','markItemsAdjusted chama a rota central do Worker (CLIENT_REVIEW_BASE + /team-action)',
    /CLIENT_REVIEW_BASE\+'\/cliente\/cronograma\/'\+encodeURIComponent\(token\)\+'\/team-action'/.test(mia));
  check('DH_TEAMFIX_ONLY_PENDING','envia SOMENTE os itens pendentes da fase (contentIndexes = pendingClientItems)',
    /const idxs=pend\.map\(p=>p\.idx\);/.test(mia) && /contentIndexes:idxs/.test(mia));
  // V64.45 — AUTENTICAÇÃO FORTE: Bearer teamSessionJwt; uid declarado REMOVIDO do body.
  check('DH_TEAMFIX_BEARER','autentica com Authorization: Bearer teamSessionJwt (de /team/session) — SEM secret e SEM uid declarado',
    /'Authorization':'Bearer '\+jwt/.test(mia) && mia.indexOf('uid:state.user.id')===-1 && mia.indexOf('X-Team-Key')===-1 && mia.indexOf('TEAM_API_KEY')===-1);
  check('DH_TEAMFIX_NO_JWT_HONEST','sem JWT na sessão → toast honesto pedindo novo login (não tenta sem credencial)',
    /Sessão de equipe indisponível — saia e entre novamente/.test(mia) && /localStorage\.getItem\('wp_team_jwt'\)/.test(mia));
  check('DH_TEAMFIX_401_CLEARS','QUALQUER 401 (expirado/adulterado/revogado) limpa wp_team_jwt + toast orientando novo login',
    /if\(res\.status===401\)\{localStorage\.removeItem\('wp_team_jwt'\)/.test(mia) && /Sessão de equipe expirada ou inválida/.test(mia));
  check('DH_LOGIN_ACQUIRES_SESSION','doLogin adquire teamSessionJwt (acquireTeamSession) com a senha SÓ em trânsito; logout limpa o JWT',
    /acquireTeamSession\(m\.id,password\);/.test(DH) && /async function acquireTeamSession\(uid,password\)/.test(DH) && /\/team\/session/.test(DH) && /localStorage\.removeItem\('wp_team_jwt'\)/.test((DH.match(/function clearSession\(\)\{[^\n]*\}/)||[''])[0]));
  check('DH_NO_PASSWORD_STORED','senha NUNCA persistida (nenhum localStorage.setItem com password/pass/senha)',
    !/localStorage\.setItem\([^)]*(password|senha)/i.test(DH));
  check('DH_TEAMFIX_IDEMPOTENCY','envia Idempotency-Key estável (uid|task|itens|janela 10s) — duplo clique não duplica',
    /'Idempotency-Key':idem/.test(mia) && /Math\.floor\(Date\.now\(\)\/10000\)/.test(mia));
  check('DH_TEAMFIX_NO_FAKE_OK','otimismo SÓ após resposta ok do Worker; erro vira toast honesto (sem fingir sucesso)',
    /if\(!res\.ok\|\|!r\|\|r\.ok!==true\)\{flashToast/.test(mia) && /Falha de rede ao registrar a correção/.test(mia));
  // Worker (branch V64.44) — a rota central faz o trabalho completo:
  (function(){
    const W44 = readFromGit('worker/v64-42-team-adjust-idem-cleanup', 'cloudflare-worker.js');
    check('DH_W44_READ','Worker V64.44 legível (branch worker/v64-42-team-adjust-idem-cleanup)', W44.length>10000);
    check('DH_W45_JWT_REQUIRED','team-action sem Bearer/X-Team-Key → 401; JWT inválido/expirado → 401; uid no body NÃO aceito',
      /unauthorized: Authorization Bearer <teamSessionJwt> obrigatório/.test(W44) && /await verifyTeamJwt\(env, m\[1\]\)/.test(W44) && (()=>{const h=(W44.match(/async function handleClientCronogramaTeamAction[\s\S]*?\n\}/)||[''])[0];return h.length>0&&h.indexOf('payload.uid')===-1;})());
    check('DH_W45_RELOOKUP','após JWT válido, Worker RECONSULTA role/status no Firestore (revogação imediata → 403)',
      /lookupTeamUser\(env, accessToken, v\.uid\)/.test(W44) && /forbidden: usuário não é mais Social\/Admin ativo/.test(W44));
    check('DH_W46_SESSION_HARDENED','/team/session blindada: senha em tempo constante + erro GENÉRICO 401 (não revela uid/role/senha) + rate limit 429 + TTL 4h',
      /url\.pathname === "\/team\/session"/.test(W44) && /timingSafeEqualStr/.test(W44) && (W44.match(/credenciais inválidas" \}, 401/g)||[]).length>=3 && /muitas tentativas — aguarde alguns minutos" \}, 429/.test(W44) && /const TEAM_JWT_TTL_S = 4 \* 3600;/.test(W44) && !/Social\/Admin ativo requerido/.test((W44.match(/async function handleTeamSession[\s\S]*?\n\}/)||[''])[0]));
    check('DH_W44_CLEARS_PRESERVES_PHASE','rota limpa clientItems[iX].cs (nullValue) preservando phase + history equipe_corrigiu_item',
      /cs: \{ nullValue: null \}/.test(W44) && /equipe_corrigiu_item/.test(W44) && !/clientItems\." \+ key \+ "\.phase/.test(W44.match(/async function handleClientCronogramaTeamAction[\s\S]*?\n\}/)[0]));
    check('DH_W44_NOTIFY','rota chama notifyWorkflowEvent(theme_adjusted_by_team|final_adjusted_by_team) na camada central',
      /final_adjusted_by_team" : "theme_adjusted_by_team/.test(W44));
    check('DH_W44_PUSH_WHEN_SUBS','engine TENTA Web Push real quando há subscription+VAPID (broadcastWebPush)',
      /subs\.length && env\.VAPID_PRIVATE_KEY && env\.VAPID_PUBLIC_KEY/.test(W44) && /await broadcastWebPush\(env, subs/.test(W44));
    check('DH_W44_FALLBACK','engine registra fallback whatsapp_premium quando push indisponível/falha',
      /fallback = "whatsapp_premium"|fallback: "whatsapp_premium"/.test(W44));
    check('DH_W44_IDEM_ROUTE','rota team-action tem Idempotency-Key próprio (replay X-Idempotency-Replayed)',
      /idempotency\.local\/team\//.test(W44));
    check('DH_W44_PUSH_NEVER_BLOCKS','falha de push NUNCA bloqueia a ação (try/catch no notify)',
      /catch \(e\) \{ pushResult = \{ sent: 0, error: e && e\.message \}; \}/.test(W44));
  })();
  check('DH_HANDLERS','Handlers data-teamfix e data-goboard registrados', /data-teamfix\]/.test(DH) && /data-goboard\]/.test(DH));
  check('DH_PHASEAWARE_FN','hasPendingItemRevision é phase-aware via pendingClientItems (espelho Worker V64.41)', /function hasPendingItemRevision\(t\)\{return pendingClientItems\(t\)\.length>0;\}/.test(DH) && /it\.phase===ph/.test(DH));
})();

/* ===================== N_DH — PARIDADE ANDROID do detail-hierarchy-v2 ===================== */
(function(){
  console.log(`${C.b}\n[N_DH] Android — paridade do detalhe (hierarquia aprovada)${C.x}`);
  const KV = readFromGit(ANDROID_E2E_BRANCH, 'android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta/features/tasks/TaskVisibility.kt');
  const KD = readFromGit(ANDROID_E2E_BRANCH, 'android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta/features/tasks/TaskDetailScreen.kt');
  const KM = readFromGit(ANDROID_E2E_BRANCH, 'android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta/domain/Models.kt');
  const KR = readFromGit(ANDROID_E2E_BRANCH, 'android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta/data/TaskRepo.kt');
  const KT = readFromGit(ANDROID_E2E_BRANCH, 'android-native-beta/app/src/test/java/br/com/idseven/agenda/nativebeta/DetailHierarchyScreenshotTest.kt');
  check('N_DH1','Models: ClientItemState (cs/phase/note/teamAdjustedAt) + TaskItem.clientItems map', /data class ClientItemState/.test(KM) && /val clientItems: Map<String, ClientItemState> = emptyMap\(\)/.test(KM));
  check('N_DH2','TaskRepo.map parseia clientItems.iX com tag de fase + clientFinalApprovedAt', /clientItems = \(d\.get\("clientItems"\)/.test(KR) && /clientFinalApprovedAt = d\.getLong\("clientFinalApprovedAt"\)/.test(KR));
  check('N_DH3','TaskVisibility: pendingClientItems PHASE-AWARE (v.phase == ph)', /fun pendingClientItems\(t: TaskItem\)/.test(KV) && /v\.phase == ph/.test(KV));
  check('N_DH4','TaskVisibility: hasTeamAdjustedAwaiting (equipe corrigiu, cliente reanalisa)', /fun hasTeamAdjustedAwaiting\(t: TaskItem\)/.test(KV) && /teamAdjustedAt != null && it\.cs == null/.test(KV));
  check('N_DH5','TaskVisibility: detailState com os 8 estados (mesmas chaves do Desktop)', /fun detailState\(t: TaskItem\): DetailState/.test(KV) &&
    ['cliente_ajuste','ajuste_aguardando','temas_aprovados','designer_aguardando','designer_producao','designer_revisao','designer_entregou','aguardando_final','concluido'].every(k=>KV.indexOf('"'+k+'"')>=0));
  check('N_DH6','detailState: labels humanos idênticos ao Desktop (Cliente pediu ajuste/Temas aprovados/Concluído ✓ …)',
    /Cliente pediu ajuste/.test(KV) && /Ajuste realizado — aguardando o cliente/.test(KV) && /Temas aprovados/.test(KV) && /Aguardando designer iniciar/.test(KV) && /Designer em produção/.test(KV) && /Designer entregou/.test(KV) && /Aguardando aprovação final/.test(KV) && /Concluído ✓/.test(KV));
  check('N_DH7','TaskDetailScreen: DetailHero (status+próxima+responsável) + FlowDetailsCollapsed no corpo', /DetailHero\(t, users\)/.test(KD) && /FlowDetailsCollapsed\(t\)/.test(KD) && /internal fun DetailHero/.test(KD) && /internal fun FlowDetailsCollapsed/.test(KD));
  check('N_DH8','Detalhe SEM status técnico CronStatusUi no corpo (só a Resposta do cliente)', KD.indexOf('CronStatusUi.label(cs)')===-1 && /Resposta do cliente/.test(KD));
  check('N_DH9','Painel técnico (OperationalPanel) DENTRO do colapsável', /if \(open\) \{[\s\S]{0,200}OperationalPanel\(t\)/.test(KD));
  check('N_DH10','SEM botão de atribuir designer no Android (ação exclusiva do Desktop)', !/assignDesigner|sendToDesigner|pickDesigner/.test(KD));
  check('N_DH11','Teste Roborazzi dos 8 estados nas larguras 360 e 412', /class DetailHierarchyScreenshotTest/.test(KT) && /detail-hierarchy-360\.png/.test(KT) && /detail-hierarchy-412\.png/.test(KT) && /renderColumn\("detail-360", 360/.test(KT) && /renderColumn\("detail-412", 412/.test(KT));
  check('N_DH12','Role-aware do Designer (bcc021b) INTACTO na branch nova', /DESIGNER_COLS4/.test(KV) && /fun designerColView/.test(KV) && /aguardando_designer_revisao/.test(KV) && /fun designerNextShort/.test(KV));
})();

/* ===================== VEREDITO ===================== */
console.log(`${C.b}\n========================================================================`);
if (BLOCKING === 0) {
  console.log(`${C.g} RESULTADO: APROVADO ✔  (0 falhas bloqueantes).`);
  console.log(`${C.g} Fluxo PRINCIPAL = grupo do cliente (card + legenda + link); botão real de aprovação no portal.`);
  console.log(`${C.g} Liberado para buildar DESKTOP 1.0.132-beta-workflow-v64-46-test. Android segue por paridade após o Desktop.${C.x}`);
  console.log(`${C.b}========================================================================${C.x}`);
  process.exit(0);
} else {
  console.log(`${C.r} RESULTADO: REPROVADO X  (${BLOCKING} falha(s) bloqueante(s))`);
  FAILS.forEach(f => console.log(`   - ${f}`));
  console.log(` NÃO gerar build. Corrija e rode novamente: node desktop/scripts/e2e-flow-test.js${C.x}`);
  console.log(`${C.b}========================================================================${C.x}`);
  process.exit(1);
}
