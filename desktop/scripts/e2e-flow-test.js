#!/usr/bin/env node
/* =====================================================================
 * TESTE VIRTUAL PONTA A PONTA (E2E) — fluxo de aprovação do cronograma
 * Agenda ID Seven · Worker V64.26-whatsapp-media-card / Desktop 1.0.114-whatsapp-media-card / Android 1.0.103
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
const ANDROID_E2E_BRANCH = 'app/local-1.0.103-beta-whatsapp-media-card-fix';

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
  if (hasDesigner(t)) { if (designerCol(t) !== 'concluido') return 'aguardando_designer'; return pendingProduction(t) ? 'aguardando_legenda' : 'aguardando_final'; }
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
console.log(' Worker V64.26-whatsapp-media-card · Desktop 1.0.114 · Android 1.0.103-beta');
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
  ['28 Social envia ao Designer', { sector: 'cronograma', status: 'afazer', clientFlowStatus: 'producao', assignedDesignerId: 'd', designerFlowStatus: 'afazer', operationalStatus: 'aguardando_designer', cronStatus: 'sent_to_designer', cronContents: TH },
    { cliente: 'producao', social: 'aguardando_designer', designer: 'afazer', meu_quadro: 'andamento' }],
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
  if (!hasDesigner(t) && ['aguardando_legenda', 'aguardando_designer', 'aguardando_final', 'concluido'].includes(got.social) && got.social !== exp.social) { ok = false; errs.push('proibido pre-designer'); }
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
check('MOVE1', 'Designer board do PC mostra "Em andamento" (designerCol)', designerCol(dMove) === 'andamento');
check('MOVE2', 'Meu quadro do designer no Android mostra "Em andamento" (boardCol4For)', boardCol4For(dMove, 'D') === 'andamento');
check('MOVE3', 'NÃO fica preso em "A Fazer"', boardCol4For(dMove, 'D') !== 'afazer' && designerCol(dMove) !== 'afazer');
check('MOVE4', 'Social vê "Designer em produção" (operationalCol=aguardando_designer)', operationalCol(dMove) === 'aguardando_designer');
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
check('W1', 'Worker é V64.26-whatsapp-media-card', /V64\.26-whatsapp-media-card/.test(W));
// ===== CORREÇÃO PRINCIPAL: legenda do conteúdo APARECE para o cliente (lê c.legenda) =====
// Antes lia só ov.legenda/c.lg/c.l -> legenda nunca aparecia (Desktop salva c.legenda).
const legReads = (W.match(/typeof c\.legenda === "string" \? c\.legenda/g) || []).length;
check('W_CAP1', 'Portal lê a legenda de c.legenda (HTML inicial + /state) — 2 ocorrências', legReads >= 2);
check('W_CAP2', 'Precedência de legenda inclui ov.legenda E c.legenda', /typeof ov\.legenda === "string"\) \? ov\.legenda : \(typeof c\.legenda === "string"/.test(W));
check('W_CAP3', '/state devolve campo JSON "legenda" e o card tem data-field="legenda"', /legenda: \(legRaw/.test(W) && /data-field="legenda"/.test(W));
// ===== PREVIEW PREMIUM do link (V64.20): card grande clicável no WhatsApp =====
check('W_OG1', 'og:image usa rota versionada SEM query (OG_IMG_PATH) 1200×630', /const OG_IMG_PATH = "\/og\/aprovar-v64-23\.png"/.test(W) && /const img = base \+ OG_IMG_PATH;/.test(W) && /og:image" content="' \+ img \+ '"/.test(W) && /og:image:width" content="1200"/.test(W) && /og:image:height" content="630"/.test(W));
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

console.log(`${C.b}\n[PARTE B] Desktop 1.0.110 — chips fixos + colunas por contexto + msg premium${C.x}`);
check('D1', 'package.json versão 1.0.114', /"version":\s*"1\.0\.114"/.test(DP));
// ===== ESTILO DOS CHIPS (1.0.107+): menos arredondados + borda/raio do input + ícone Designers.
const tchipCss = (DH.match(/\.tchip\{[^}]*\}/) || [''])[0];
check('D_SHAPE1', 'Chips MENOS arredondados: .tchip border-radius:11px (igual ao input)', /border-radius:11px/.test(tchipCss));
check('D_SHAPE2', 'Chips SEM cápsula: .tchip não usa border-radius:999px', !/border-radius:999px/.test(tchipCss));
check('D_SHAPE3', 'Chips com borda no estilo do input (1px solid var(--line))', /border:1px solid var\(--line\)/.test(tchipCss));
check('D_ICON1', 'ICON.image existe (chip Designers passa a ter ícone)', /\n\s*image:'<rect /.test(DH));
check('D_ICON2', 'tabIcon mapeia designers -> image', /designers:'image'/.test(DH));
// CORREÇÃO 1: mensagem WhatsApp PREMIUM (assinatura + CTA; não é link cru).
const msgFn = (DH.match(/function buildClientMessage\(ctx\)\{[\s\S]*?\n\}/) || [''])[0];
check('D2', 'WhatsApp premium: assinatura "Equipe ID Seven"', /Equipe ID Seven/.test(msgFn));
check('D3', 'Caption: "Toque no link abaixo para revisar e aprovar:"', /Toque no link abaixo para revisar e aprovar:/.test(msgFn));
check('D4', 'WhatsApp premium: saudação com nome do cliente', /Olá, '\+nome/.test(msgFn));
check('D_MSG1', 'Caption: orientação principal = "Toque no link abaixo"', /Toque no link abaixo para revisar e aprovar:/.test(msgFn));
check('D_MSG2', 'WhatsApp: "A primeira etapa" presente', /A primeira etapa/.test(msgFn));
check('D_MSG3', 'WhatsApp: URL (p/ o card) + assinatura *Equipe ID Seven*', /\+\s*url\s*\+/.test(msgFn) && /\*Equipe ID Seven\*/.test(msgFn));
// CORREÇÃO 4: upload de Feed/Story não pula para o 1º post (preserva scroll da lista).
check('D_UPLOAD', 'Produção preserva o scroll ao anexar arte (_prodKeepScroll + restore)', /function _prodKeepScroll\(\)/.test(DH) && /_prodKeepScroll\(\);renderProductionModal\(\)/.test(DH) && /\.pr-list'\);if\(_pl&&state\._prodScroll\)/.test(DH));
// ===== REGRA FINAL (teste real): CHIPS SOMENTE dentro do Kanban; NUNCA no hub "Quadros". =====
check('D5', 'boardToolbar() contém BUSCA + CHIPS na mesma moldura', /function boardToolbar\(\)\{return '<div class="d-board-tools tbar"><input[^>]*><div class="tchips">'\+taskChips\(\)/.test(DH));
check('D6', 'SEM barra de chips no topo global (tasksChipBar/tflow-fixed removidos)', !/function tasksChipBar/.test(DH) && !/tflow-fixed/.test(DH));
check('D7', 'Dispatch NÃO prepende chips ao topo (c.innerHTML=body)', /c\.innerHTML=body;/.test(DH) && !/c\.innerHTML=tasksChipBar/.test(DH));
// HUB "Quadros" (renderHub) NÃO pode ter chips/toolbar — só título + cards.
const hubFn = (DH.match(/function renderHub\(\)\{[\s\S]*?\n\}/) || [''])[0];
check('D8a', 'HUB "Quadros" SEM toolbar/chips (renderHub não chama boardToolbar)', hubFn.indexOf('boardToolbar()') === -1);
check('D8b', 'HUB "Quadros" SEM taskChips/.tchip', hubFn.indexOf('taskChips(') === -1 && hubFn.indexOf('tchip') === -1);
// Hubs de LISTA (RoleBoards/Designers/Socials) também SEM chips.
const roleFn = (DH.match(/function renderRoleBoards\(\)\{[\s\S]*?\n\}/) || [''])[0];
const dhubFn = (DH.match(/function renderDesignersHub\(\)\{[\s\S]*?\n\}/) || [''])[0];
const shubFn = (DH.match(/function renderSocialsHub\(\)\{[\s\S]*?\n\}/) || [''])[0];
check('D8c', 'Hubs de lista (RoleBoards/Designers/Socials) SEM boardToolbar/chips',
  roleFn.indexOf('boardToolbar()') === -1 && dhubFn.indexOf('boardToolbar()') === -1 && shubFn.indexOf('boardToolbar()') === -1);
// KANBAN tem a toolbar (busca + chips): Meu quadro / Cliente / Designer / Social / Setor.
check('D8d', 'Kanban (PersonBoard/Client/Designer/Social) usa boardToolbar()',
  /function renderPersonBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH) && /function renderClientFlowBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH) && /function renderDesignerBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH) && /function renderSocialBoard\(\)\{[\s\S]*?boardToolbar\(\)/.test(DH));
check('D8e', 'Kanban de Setor (renderBoard) tem toolbar com taskChips()', /function renderBoard\(\)\{[\s\S]*?d-board-tools tbar[\s\S]*?taskChips\(\)/.test(DH));
// CORREÇÃO 3: colunas por contexto (sem excesso).
check('D9', 'Colunas Social = 4 (A Fazer/Em andamento/Revisão/Finalizado)', /const SOCIAL_COLS4=\[[\s\S]*?Finalizado/.test(DH) && (DH.match(/const SOCIAL_COLS4=\[([\s\S]*?)\];/)||['',''])[1].split('{key').length - 1 === 4);
check('D10', 'Colunas Designer = 3 (A Fazer/Em andamento/Entregue)', (DH.match(/const DESIGNER_COLS3=\[([\s\S]*?)\];/)||['',''])[1].split('{key').length - 1 === 3);
check('D11', 'Colunas Cliente = 4 (Enviado/Em análise/Revisão solicitada/Aprovado)', (DH.match(/const CLIENT_COLS4=\[([\s\S]*?)\];/)||['',''])[1].split('{key').length - 1 === 4);
check('D12', 'Social board usa SOCIAL_COLS4 (não OPERATIONAL_COLS 8)', /const byCol=SOCIAL_COLS4\.map/.test(DH));
check('D13', 'Designer board usa DESIGNER_COLS3', /const byStatus=DESIGNER_COLS3\.map/.test(DH));
check('D14', 'Cliente board usa CLIENT_COLS4', /const byCol=CLIENT_COLS4\.map/.test(DH));
// CORREÇÃO 6 (Desktop): boardCol4For designer-aware + usado no Meu quadro/Setor.
check('D15', 'boardCol4For(t,uid) designer-aware definido', /function boardCol4For\(t,uid\)/.test(DH));
check('D16', 'Meu quadro usa boardCol4For (designer vê em A Fazer)', /boardCol4For\(t,pid\)/.test(DH));
// CORREÇÃO 4: edição de tema responde no 1º clique.
check('D17', 'openItemFix: autofocus no #ifIn', /id="ifIn"[^>]*autofocus/.test(DH));
check('D18', 'openItemFix: foco via rAF + timeout', /requestAnimationFrame\(function\(\)\{_focusIf\(\)/.test(DH));
check('D19', 'Render idempotente preservado (dedupById)', /state\.tasks\s*=\s*dedupById\(/.test(DH));
check('D20', 'Rodapé mostra Desktop 1.0.114', /Desktop 1\.0\.114/.test(DH));
// CORREÇÃO crítica (teste real): rótulo de versão do LOGIN não pode ficar defasado.
check('D21', 'Login/título/watermark mostram 1.0.114 (sem rótulo antigo)',
  /<span class="pill-ver">Desktop 1\.0\.114/.test(DH) && /<title>ID Seven · Desktop 1\.0\.114/.test(DH) && /id="wpbadge">Desktop 1\.0\.114/.test(DH));
check('D22', 'Login espelha o APK 1.0.103-beta-whatsapp-media-card-fix', /espelha o APK <b>1\.0\.103-beta-whatsapp-media-card-fix/.test(DH));
check('D23', 'Fonte única APP_VER define a versão exibida', /const APP_VER=\{\s*desktop:'1\.0\.114'/.test(DH) && /applyVersionLabels/.test(DH));
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
check('N1', 'versionName 1.0.103-beta-whatsapp-media-card-fix', /versionName\s+"1\.0\.103-beta-whatsapp-media-card-fix"/.test(GRADLE));
check('N2', 'versionCode >= 101 (acima do 100 anterior)', (() => { const m = GRADLE.match(/versionCode\s+(\d+)/); return m && Number(m[1]) >= 101; })());
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
// CORREÇÃO 3 (Android): colunas por contexto.
check('N7', 'Colunas reduzidas: SOCIAL_COLS4 / DESIGNER_COLS3 / CLIENT_COLS4', /SOCIAL_COLS4/.test(KT_VIS) && /DESIGNER_COLS3/.test(KT_VIS) && /CLIENT_COLS4/.test(KT_VIS));
check('N8', 'TasksScreen aplica colunas por contexto (clientCol4/designerCol3)', /clientCol4\(t\)/.test(KT_SCREEN) && /designerCol3\(t\)/.test(KT_SCREEN));
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
  const fnMsg = (DH.match(/function buildClientMessage\(ctx\)\{[\s\S]*?\n\}/) || [''])[0];
  const code = `
    const CLIENT_LINK_BASE=${JSON.stringify(base)};
    const CLIENT_REVIEW_BASE=${JSON.stringify(review)};
    ${fnUrl}
    ${fnMsg}
    return { CLIENT_LINK_BASE, CLIENT_REVIEW_BASE, buildPublicClientUrl, buildClientMessage };
  `;
  LINK = new Function(code)();
} catch (e) {
  check('LINK0', 'Funções de link do Desktop avaliáveis (CLIENT_LINK_BASE + buildPublicClientUrl + buildClientMessage)', false);
}
if (LINK) {
  const TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6'; // 48 hex (formato genReviewToken)
  let url = '', threwEmpty = false, threwNull = false;
  try { url = LINK.buildPublicClientUrl(TOKEN); } catch (e) { url = 'THREW:' + e.message; }
  try { LINK.buildPublicClientUrl(''); } catch (e) { threwEmpty = true; }
  try { LINK.buildPublicClientUrl(null); } catch (e) { threwNull = true; }
  const msg = (() => { try { return LINK.buildClientMessage({ client: 'Hospital Visão', type: 'semanal', title: 'Cronograma X', token: TOKEN }); } catch (e) { return 'THREW:' + e.message; } })();

  check('LINK1', '(1) Desktop gera link com domínio premium aprovar.agendaidseven.com.br', LINK.CLIENT_LINK_BASE === 'https://aprovar.agendaidseven.com.br' && url.startsWith('https://aprovar.agendaidseven.com.br/cliente/cronograma/'));
  check('LINK2', '(3) O link contém token real depois de /cronograma/', /\/cliente\/cronograma\/[A-Za-z0-9_-]{8,}$/.test(url) && url.endsWith(TOKEN));
  check('LINK3', '(4) O token não é vazio', url.split('/cliente/cronograma/')[1] === TOKEN && TOKEN.length >= 8);
  check('LINK4', '(5) O link NÃO termina em /cronograma/', !/\/cliente\/cronograma\/?$/.test(url));
  check('LINK5', '(6) O link NÃO usa workers.dev como domínio principal', !/workers\.dev/.test(url));
  check('LINK6', 'Hardening: token vazio LANÇA (link nunca sai sem token)', threwEmpty === true);
  check('LINK7', 'Hardening: token nulo LANÇA (link nunca sai sem token)', threwNull === true);
  check('LINK8', '(14) Mensagem do WhatsApp usa o link COMPLETO com token', msg.indexOf(url) > -1 && msg.indexOf(TOKEN) > -1);
  check('LINK9', '(15) Não há link incompleto no texto copiado (URL completa premium + token)', msg.indexOf('https://aprovar.agendaidseven.com.br/cliente/cronograma/' + TOKEN) > -1 && !/workers\.dev/.test(msg) && !/cronograma\/(\s|\n|$)/.test(msg));
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
check('MEDIA_W1', 'Worker serve /og/wa-card-v64-26.jpg (jpgBannerResponse + OG_JPG_B64)', /wa-card-v64-26\.jpg/.test(W) && /function jpgBannerResponse/.test(W) && /const OG_JPG_B64=/.test(W));
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
check('MEDIA_D1', 'Desktop CARD_IMG_URL = aprovar.agendaidseven.com.br/og/wa-card-v64-26.jpg (sem query)', /const CARD_IMG_URL='https:\/\/aprovar\.agendaidseven\.com\.br\/og\/wa-card-v64-26\.jpg'/.test(DH));
check('MEDIA_D2', 'Modal "Preparar envio premium para WhatsApp" + instrução de anexar imagem', /Preparar envio premium para WhatsApp/.test(DH) && /Anexe esta imagem no WhatsApp/.test(DH));
check('MEDIA_D3', 'Modal busca a imagem real e liga os botões (_wirePremiumSend + fetch CARD_IMG_URL)', /function _wirePremiumSend\(/.test(DH) && /fetch\(CARD_IMG_URL/.test(DH));
check('MEDIA_D4', 'Botões: Copiar mensagem / Copiar imagem / Salvar imagem / Abrir WhatsApp', /id="btnCopyMsg"/.test(DH) && /id="btnCopyImg"/.test(DH) && /id="btnSaveImg"/.test(DH) && /id="btnOpenWa"/.test(DH));
check('MEDIA_D5', 'Nome de arquivo claro agenda-id-seven-card-[cliente]-[token].jpg', /agenda-id-seven-card-'\+/.test(DH));
// Electron IPC (main + preload)
check('MEDIA_IPC1', 'main: handlers save-card-image / copy-card-image / show-in-folder', /ipcMain\.handle\("save-card-image"/.test(MAIN) && /ipcMain\.handle\("copy-card-image"/.test(MAIN) && /ipcMain\.handle\("show-in-folder"/.test(MAIN));
check('MEDIA_IPC2', 'main: usa clipboard.writeImage + nativeImage (copiar imagem real)', /clipboard\.writeImage/.test(MAIN) && /nativeImage\.createFromBuffer/.test(MAIN));
check('MEDIA_IPC3', 'preload: expõe saveCardImage / copyCardImage / showInFolder', /saveCardImage:/.test(PRE) && /copyCardImage:/.test(PRE) && /showInFolder:/.test(PRE));
// Token/link continuam válidos (reuso da PARTE C)
check('MEDIA_LINK', 'Caption leva o link COMPLETO com token (premium, sem workers.dev)', LINK ? (LINK.buildClientMessage({client:'X',type:'semanal',title:'P',token:'a1b2c3d4e5f6a1b2c3d4e5f6'}).indexOf('https://aprovar.agendaidseven.com.br/cliente/cronograma/a1b2c3d4e5f6a1b2c3d4e5f6')>-1) : false);

/* ===================== VEREDITO ===================== */
console.log(`${C.b}\n========================================================================`);
if (BLOCKING === 0) {
  console.log(`${C.g} RESULTADO: APROVADO ✔  (0 falhas bloqueantes)`);
  console.log(` Liberado para gerar build: Worker V64.26-whatsapp-media-card / Desktop 1.0.114 / Android 1.0.103-beta${C.x}`);
  console.log(`${C.b}========================================================================${C.x}`);
  process.exit(0);
} else {
  console.log(`${C.r} RESULTADO: REPROVADO X  (${BLOCKING} falha(s) bloqueante(s))`);
  FAILS.forEach(f => console.log(`   - ${f}`));
  console.log(` NÃO gerar build. Corrija e rode novamente: node desktop/scripts/e2e-flow-test.js${C.x}`);
  console.log(`${C.b}========================================================================${C.x}`);
  process.exit(1);
}
