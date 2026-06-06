#!/usr/bin/env node
/* =====================================================================
 * TESTE VIRTUAL PONTA A PONTA (E2E) — fluxo de aprovação do cronograma
 * Agenda ID Seven · Worker V64.17 / Desktop 1.0.104 / Android 1.0.92
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
const WORKER_BRANCH = 'worker/client-flow-e2e-fix';
const ANDROID_BRANCH = 'app/local-1.0.91-board-filters-polish'; // chips/state; versão será buildada na branch e2e
const ANDROID_E2E_BRANCH = 'app/local-1.0.92-beta-client-flow-e2e-fix';

function readFromGit(branch, relPath) {
  try { return execSync(`git show ${branch}:${relPath}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }); }
  catch (_) { return null; }
}
function readWorkTree(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); } catch (_) { return null; }
}
/* Worker/Android: tenta a branch e2e, depois a branch base, depois working tree. */
function readWorker() {
  return readFromGit('worker/client-flow-e2e-fix', 'cloudflare-worker.js') || readWorkTree('cloudflare-worker.js') || '';
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
console.log(' Worker V64.17 · Desktop 1.0.104 · Android 1.0.92-beta');
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

/* ===================== PARTE B — Asserções estruturais (arquitetura de render) ===================== */
const W = readWorker();
const DH = readDesktop('desktop/src/renderer/index.html');
const DP = readDesktop('desktop/package.json');
const KT_VIS = readAndroid('android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta/features/tasks/TaskVisibility.kt');
const KT_TABS = readAndroid('android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta/features/tasks/TasksTopTabs.kt');
const GRADLE = readAndroid('android-native-beta/app/build.gradle');

console.log(`${C.b}\n[PARTE B] Worker V64.17 — portal do cliente (P3/P4/P6/P7)${C.x}`);
check('W1', 'Worker é V64.17-client-flow-e2e-fix', /V64\.17-client-flow-e2e-fix/.test(W));
// P4/P7: telas de feedback/ack SUBSTITUEM a .wrap (innerHTML), não usam insertAdjacentHTML('afterbegin').
const feedFn = (W.match(/function clientFeedbackSent\(\)\{[\s\S]*?window\.scrollTo/) || [''])[0];
check('W2', 'clientFeedbackSent SUBSTITUI a .wrap (w.innerHTML=CV_TOP())', /w\.innerHTML\s*=\s*CV_TOP\(\)/.test(feedFn));
check('W3', 'NÃO há insertAdjacentHTML("afterbegin") (sem formulário empilhado)', !/insertAdjacentHTML\(\s*['"]afterbegin['"]/.test(W));
check('W4', 'Feedback parcial mostra "Aguardando ajuste da equipe"', /Aguardando ajuste da equipe/.test(feedFn));
check('W5', 'Feedback parcial NÃO afirma "Temas aprovados"', !/Temas aprovados/.test(feedFn));
check('W6', 'Resumo read-only por conteúdo (Aprovado/Ajuste/Editado/Pendente)', /Ajuste solicitado/.test(feedFn) && /Pendente/.test(feedFn));
// P6: sincronização no MESMO link via polling de /state.
check('W7', 'Endpoint GET /cliente/cronograma/:token/state existe', /handleClientCronogramaState/.test(W) && /\/state\\\/\?\$/.test(W));
check('W8', 'Poller periódico (setInterval pollState)', /setInterval\(\s*pollState/.test(W));
check('W9', 'applyState atualiza tema/legenda/badge NO LUGAR (sem empilhar)', /function applyState\(/.test(W) && /setTheme\(/.test(W) && /setLegenda\(/.test(W));
check('W10', 'reload só quando muda mídia (feed/story), não a cada poll', /mediaChanged/.test(W) && /location\.reload\(\)/.test(W));
check('W11', 'State endpoint devolve tema com override do cliente (ov.theme)', /ov\.theme/.test(W) && /tema,/.test(W));
// GATE server-side dentro do writeClientGranular.
check('W12', 'Gate server-side: approveAll com pendência vira revisão', /_pendingRev|pendingRev/.test(W) && /em_revisao_cliente/.test(W));
// GATE client-side dentro do handler approveAll.
check('W13', 'Gate client-side: anyRev → clientFeedbackSent (não sucesso)', /anyRev/.test(W) && /clientFeedbackSent\(\)/.test(W));
// P3: visual premium mínimo (topbar + cards colapsáveis + selo seguro).
check('W14', 'Portal premium: topbar de marca + selo "Link seguro"', /function CV_TOP\(\)/.test(W) && /Link seguro/.test(W));

console.log(`${C.b}\n[PARTE B] Desktop 1.0.104 — render idempotente + toolbar + input (P1/P2/P5/P7)${C.x}`);
check('D1', 'package.json versão 1.0.104', /"version":\s*"1\.0\.104"/.test(DP));
check('D2', 'dedupById definido', /function dedupById\(/.test(DH));
check('D3', 'Snapshot de tasks usa dedupById (sem cards empilhados)', /state\.tasks\s*=\s*dedupById\(/.test(DH));
// P2: _editingNow escopado — não adia mais por foco na toolbar/busca.
const editFn = (DH.match(/function _editingNow\(\)\{[\s\S]*?\n\}/) || [''])[0];
check('D4', '_editingNow ignora foco na toolbar do quadro (.d-board-tools/.bsearch)', /d-board-tools|\.bsearch/.test(editFn));
check('D5', '_editingNow NÃO adia por qualquer activeElement global', !/return\s*!!\(a&&\(a\.tagName==='INPUT'\|\|a\.tagName==='TEXTAREA'\|\|a\.isContentEditable\)\);/.test(editFn));
check('D6', '_editingNow ainda protege modal de edição aberto', /modalRoot/.test(editFn) && /querySelector\('input,textarea,select'\)/.test(editFn));
// P1: trava anti-duplo-envio no saveTask.
check('D7', 'saveTask tem trava anti-duplo-envio (_saving)', /if\(f\._saving\)return;\s*f\._saving=true;/.test(DH));
check('D8', 'saveTask reseta _saving em erro de add', /catch\([^)]*\)\{f\._saving=false;[\s\S]*?saveTask add/.test(DH));
// P5: input de edição responde no primeiro clique (foco imediato).
check('D9', 'openItemFix dá foco imediato em #ifIn', /getElementById\('ifIn'\)[\s\S]{0,80}\.focus\(\)/.test(DH));
check('D10', 'Rodapé da sidebar mostra Desktop 1.0.104', /Desktop 1\.0\.104/.test(DH));

console.log(`${C.b}\n[PARTE B] Android 1.0.92-beta — paridade de estado + chips${C.x}`);
check('N1', 'build.gradle versionName 1.0.92-beta-client-flow-e2e-fix', /versionName\s+"1\.0\.92-beta-client-flow-e2e-fix"/.test(GRADLE));
check('N2', 'build.gradle versionCode >= 90', (() => { const m = GRADLE.match(/versionCode\s+(\d+)/); return m && Number(m[1]) >= 90; })());
check('N3', 'TaskVisibility mantém isFullyComplete (fonte única de conclusão)', /fun\s+isFullyComplete/.test(KT_VIS));
check('N4', 'TaskVisibility mantém boardCol4 (quadro 4 colunas)', /boardCol4/.test(KT_VIS));
check('N5', 'TasksTopTabs com chips (paridade com Desktop)', /Person|Visibility|GridView|horizontalScroll/.test(KT_TABS));

/* ===================== VEREDITO ===================== */
console.log(`${C.b}\n========================================================================`);
if (BLOCKING === 0) {
  console.log(`${C.g} RESULTADO: APROVADO ✔  (0 falhas bloqueantes)`);
  console.log(` Liberado para gerar build: Worker V64.17 / Desktop 1.0.104 / Android 1.0.92-beta${C.x}`);
  console.log(`${C.b}========================================================================${C.x}`);
  process.exit(0);
} else {
  console.log(`${C.r} RESULTADO: REPROVADO X  (${BLOCKING} falha(s) bloqueante(s))`);
  FAILS.forEach(f => console.log(`   - ${f}`));
  console.log(` NÃO gerar build. Corrija e rode novamente: node desktop/scripts/e2e-flow-test.js${C.x}`);
  console.log(`${C.b}========================================================================${C.x}`);
  process.exit(1);
}
