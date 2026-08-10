#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H14 — TIMELINE: encerramento do marco 7 (Aguardando legenda/posts) + espera final.
 *
 * P0/P1 (1.0.239): após o ENVIO FINAL REAL confirmado (workflowPhase=captions_waiting_client),
 * a timeline deixava o marco 7 "Aguardando legenda/posts" EM ANDAMENTO enquanto o marco 8
 * "Enviado para aprovação final" já estava OK — timeline impossível. Causa: step7.done usava só
 * !pendingProduction(t) (conteúdo dos cronContents), que segue true por Feed/Story/legenda residual,
 * independentemente do avanço do fluxo. Além disso, quando o marco final ('concluido') vira o CURRENT
 * (aguardando o cliente), a UI mostraria "Aprovado final / Concluído — EM ANDAMENTO" (impossível).
 *
 * Correção 1.0.244 (RENDERER-only, index.html, ESPECÍFICA — sem clamp geral):
 *  - aguardando_legenda.done = !!(prodOk||resent), i.e. !pendingProduction || flowSentToClientSignal || finalOk.
 *  - marco 'concluido', quando state==='current', exibe rótulo contextual "Aguardando aprovação final"
 *    SEM mudar a chave canônica; concluído REAL (finalOk) mantém "Aprovado final / Concluído".
 *  - pendingProduction NÃO é alterado globalmente; sem fabricar data/autor para marco encerrado por fluxo.
 *
 * RED na base 1.0.239 (7c199ac); GREEN na 1.0.240.
 * Rodar: node desktop/scripts/f356ah14-timeline-step7-final-wait.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH14_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH14_PKG || path.join(DESK, 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.join(DESK, 'package-lock.json'), 'utf8'));

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

let api = null, bootErr = null;
try {
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
    grabFn(HTML, 'wfRoundsOf'), grabFn(HTML, 'wfLatestRound'),
    grabFn(HTML, '_tlEventAt'), grabFn(HTML, '_tlHumanLabel'), grabFn(HTML, 'taskTimeline'),
  ].join('\n');
  const RET = 'return {taskTimeline:taskTimeline,pendingProduction:pendingProduction,flowSentToClientSignal:flowSentToClientSignal,operationalCol:operationalCol};';
  api = new Function('var state={users:[]};\n' + SRC + '\n' + RET)();
} catch (e) { bootErr = e; }

if (!api) { console.log('================= F3.5.6A-H14 — TIMELINE STEP7/ESPERA FINAL ================='); console.log('BOOT FALHOU: ' + (bootErr && bootErr.message)); console.log('PASS ' + pass + ' | FAIL ' + (fail + 1) + '  (versão sob teste: ' + PKG.version + ')'); process.exit(1); }

const mstone = (tl, k) => (tl.milestones || []).find(m => m.key === k) || {};

/* =========================== FIXTURES (Cronograma Teste 6) =========================== */
const T0838 = 1754818680000; // envio inicial THEMES ~08:38
const T1135 = 1754829300000; // ação da 2ª rodada ~11:35 (evento legado)
const T1331 = 1754836860000; // envio FINAL real ~13:31 (ar_captions_r1.sentAt)

// Estado APÓS "Designer entregou" e "Salvar e reenviar" SEM confirmar (captions_preparation).
// pendingProduction=TRUE (2º item sem legenda/feed) — igual ao Cronograma Teste 6 real.
function prep() {
  return {
    id: 'CT6', sector: 'cronograma', client: 'CLIENTE TESTE', createdAt: 1754800000000,
    workflowPhase: 'captions_preparation',
    clientFlowStatus: 'producao', clientWorkflowStage: 'producao',
    cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final', finalApprovalRequired: true,
    designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'concluido',
    cronContents: [{ tema: 'T1', legenda: 'Legenda teste 1', feedImageUrl: '' }, { tema: 'T2', legenda: '', feedImageUrl: '' }],
    clientSentAt: T0838,
    approvalRounds: { ar_themes_r1: { sentAt: T0838, by: 'Social', decision: 'approved' } },
    history: [
      { type: 'cronograma_enviado_cliente', label: 'Cronograma enviado ao cliente (aprovação de TEMAS)', at: T0838, by: 'Arydyjany', channel: 'whatsapp_fallback', phase: 'themes' },
      { type: 'social_producao', label: 'Social atualizou legendas/artes', at: T1135 - 1000, by: 'Arydyjany', channel: 'production' }
    ]
  };
}
// Estado APÓS o ENVIO FINAL REAL confirmado (confirmClientSend ok, 2ª rodada): captions_waiting_client +
// ar_captions_r1.sentAt (13:31). pendingProduction CONTINUA true (conteúdo residual). finalApprovalCompleted=false.
function sentReal() {
  const t = prep();
  t.workflowPhase = 'captions_waiting_client';
  t.approvalRounds.ar_captions_r1 = { sentAt: T1331, by: 'Arydyjany' };
  t.history.push({ type: 'reenviado_cliente', label: 'Reenviado ao cliente (versão FINAL)', at: T1331, by: 'Arydyjany', channel: 'final_review', phase: 'final' });
  return t;
}
// captions_preparation com produção COMPLETA (pendingProduction=false).
function prepProdDone() {
  const t = prep();
  t.cronContents = [{ tema: 'T1', legenda: 'L1', feedImageUrl: 'u1' }, { tema: 'T2', legenda: 'L2', feedImageUrl: 'u2' }];
  return t;
}
// Cliente APROVOU o final (finalApprovalCompleted=true).
function finalApproved() {
  const t = sentReal();
  t.finalApprovalCompleted = true;
  t.doneAt = T1331 + 3600000;
  t.history.push({ type: 'final_approved', label: 'Cliente aprovou a versão final', at: T1331 + 3600000, by: 'Cliente', phase: 'final' });
  return t;
}

/* sanity: pendingProduction conforme projetado (garante que o RED/GREEN testa o cenário certo) */
ok('P0 pendingProduction(prep)=true (2º item sem legenda/feed — igual Teste 6)', api.pendingProduction(prep()) === true);
ok('P1 pendingProduction(sentReal)=true (residual mesmo após envio final)', api.pendingProduction(sentReal()) === true);
ok('P2 pendingProduction(prepProdDone)=false (conteúdo completo)', api.pendingProduction(prepProdDone()) === false);
ok('P3 flowSentToClientSignal(sentReal)=true (captions_waiting_client)', api.flowSentToClientSignal(sentReal()) === true);
ok('P4 flowSentToClientSignal(prep)=false (captions_preparation)', api.flowSentToClientSignal(prep()) === false);

/* =========================== MAIN — Teste 6 após envio final real =========================== */
{
  const tl = api.taskTimeline(sentReal());
  const al = mstone(tl, 'aguardando_legenda');
  const ef = mstone(tl, 'enviado_final');
  const cc = mstone(tl, 'concluido');
  ok('M1 marco 7 "Aguardando legenda/posts" = OK (done) após envio final real', al.done === true && al.state === 'done');
  ok('M2 marco 8 "Enviado para aprovação final" = OK (done)', ef.done === true && ef.state === 'done');
  ok('M3 estado corrente = marco final CURRENT com rótulo "Aguardando aprovação final"', cc.state === 'current' && cc.label === 'Aguardando aprovação final');
  ok('M4 marco final NÃO está aprovado/concluído (done=false)', cc.done === false);
  ok('M5 timeline coerente: nenhum marco anterior ao 8(done) fica current (7 não é mais current)', al.state !== 'current');
}

/* =========================== 1) captions_preparation + pendingProduction=true → step7 EM ANDAMENTO =========================== */
{
  const tl = api.taskTimeline(prep());
  const al = mstone(tl, 'aguardando_legenda');
  ok('1 captions_preparation + conteúdo pendente → marco 7 EM ANDAMENTO (current, done=false)', al.state === 'current' && al.done === false);
  ok('1b marco 8 PENDENTE antes do envio', mstone(tl, 'enviado_final').state === 'pending' && mstone(tl, 'enviado_final').done === false);
}

/* =========================== 2) captions_preparation + pendingProduction=false → step7 done, step8 pending =========================== */
{
  const tl = api.taskTimeline(prepProdDone());
  ok('2 produção completa (sem envio) → marco 7 = OK (done)', mstone(tl, 'aguardando_legenda').done === true);
  // com o marco 7 done e o envio final ainda não confirmado, o marco 8 é o CURRENT (próxima ação) — nunca 'done'.
  ok('2b marco 8 ainda NÃO enviado (done=false; current/pending, nunca OK)', mstone(tl, 'enviado_final').done === false && mstone(tl, 'enviado_final').state !== 'done');
}

/* =========================== 3) captions_waiting_client + pendingProduction=true → step7 done, step8 done =========================== */
{
  const tl = api.taskTimeline(sentReal());
  ok('3 envio final + conteúdo residual → marco 7 = OK', mstone(tl, 'aguardando_legenda').done === true);
  ok('3b marco 8 = OK', mstone(tl, 'enviado_final').done === true);
}

/* =========================== 4) NÃO exibir "Aprovado final / Concluído — EM ANDAMENTO" =========================== */
{
  const tl = api.taskTimeline(sentReal());
  const cc = mstone(tl, 'concluido');
  ok('4 marco final quando CURRENT NÃO usa o rótulo "Aprovado final / Concluído"', !(cc.state === 'current' && cc.label === 'Aprovado final / Concluído'));
  ok('4b chave canônica do marco final permanece "concluido" (identidade inalterada)', cc.key === 'concluido');
  ok('4c o current do fluxo comunica a espera do cliente', cc.state === 'current' && cc.label === 'Aguardando aprovação final');
}

/* =========================== 5) finalApprovalCompleted=true → concluído OK =========================== */
{
  const tl = api.taskTimeline(finalApproved());
  const cc = mstone(tl, 'concluido');
  ok('5 aprovação real → marco final = OK (done) com rótulo "Aprovado final / Concluído"', cc.done === true && cc.state === 'done' && cc.label === 'Aprovado final / Concluído');
  ok('5b marco 7 e 8 continuam OK após conclusão', mstone(tl, 'aguardando_legenda').done === true && mstone(tl, 'enviado_final').done === true);
}

/* =========================== 6/7/8) H13 timestamps preservados =========================== */
{
  const tl = api.taskTimeline(sentReal());
  ok('7 envio inicial THEMES preservado (08:38) em "Enviado ao cliente"', mstone(tl, 'enviado_cliente').at === T0838);
  ok('8 envio FINAL real (13:31) carimbado em "Enviado para aprovação final"', mstone(tl, 'enviado_final').at === T1331);
  ok('6 THEMES 08:38 NÃO é sobrescrito pelo envio final (13:31 separado)', mstone(tl, 'enviado_cliente').at !== T1331);
}

/* =========================== 9) nenhum marco pendente/current recebe timestamp falso =========================== */
{
  const tlSent = api.taskTimeline(sentReal());
  ok('9 nenhum marco pendente/current exibe carimbo (inclui "concluido" current)', (tlSent.milestones || []).filter(m => m.state === 'pending' || m.state === 'current').every(m => !m.at && !m.by));
  // step7 encerrado por FLUXO não pode inventar data/autor além do seu evento real (social_producao existe aqui).
  const al = mstone(tlSent, 'aguardando_legenda');
  ok('9b marco 7 encerrado por fluxo usa só o evento real (social_producao) — sem T1331/T1135 fabricado', al.at !== T1331 && al.at !== T1135);
}

/* =========================== REGRESSÃO — contrato ANTES do envio (H13/H12) intacto =========================== */
{
  const tl = api.taskTimeline(prep());
  ok('R1 ANTES do envio: 7 EM ANDAMENTO + 8 PENDENTE + 10 PENDENTE (contrato H13 preservado)',
    mstone(tl, 'aguardando_legenda').state === 'current' && mstone(tl, 'enviado_final').state === 'pending' && mstone(tl, 'concluido').state === 'pending');
  ok('R2 marco de ajuste (opcional) intacto (state optional, não current)', mstone(tl, 'ajuste').state === 'optional' || mstone(tl, 'ajuste').optional === true);
  ok('R3 "Enviado ao cliente" (THEMES) done com 08:38 já ANTES do envio final', mstone(tl, 'enviado_cliente').done === true && mstone(tl, 'enviado_cliente').at === T0838);
}

/* =========================== CONTRATOS ESTÁTICOS (fonte) =========================== */
const S = HTML;
ok('S1 step7 aguardando_legenda.done = !!(prodOk||resent) (correção específica do marco)', S.includes("key:'aguardando_legenda',label:'Aguardando legenda / posts',    done:!!(prodOk||resent),"));
ok('S2 marco final: rótulo contextual só quando state==="current"', S.includes("if(m.key==='concluido'&&state==='current') dispLabel='Aguardando aprovação final';"));
ok('S3 return usa dispLabel (não m.label cru) para o marco final contextual', S.includes('return {key:m.key,label:dispLabel,state:state,'));
ok('S4 pendingProduction NÃO alterado globalmente (segue pendingLegend||pendingFeed)', S.includes('function pendingProduction(t){return pendingLegend(t)||pendingFeed(t);}'));
ok('S5 SEM clamp geral de monotonicidade (nenhum loop marcando .done=true por marco posterior)', !/for\s*\([^)]*\)\s*\{[^}]*\bdone\s*=\s*true/.test(S) && !/milestones\.forEach\([^)]*done\s*=\s*true/.test(S));
ok('S6 enviado_final.done permanece !!resent (contrato H12/H13 intacto)', S.includes("key:'enviado_final',     label:'Enviado para aprovação final',  done:!!resent,"));
ok('S7 marco 7 mantém a chave canônica aguardando_legenda + ev social_producao (identidade intacta)', S.includes("key:'aguardando_legenda'") && S.includes("ev:['social_producao','social_editou_conteudo']"));
// H13 preservado (não regredir)
ok('S8 H13 _tlEventAt exato preservado', S.includes('return !!v && keys.indexOf(v)>=0;'));
ok('S9 H13 carimbo THEMES ar_themes_r* preservado', S.includes("if(m.key==='enviado_cliente'){ const r=wfLatestRound(t,'themes');"));
ok('S10 H13 carimbo FINAL ar_captions_r* preservado', S.includes("else if(m.key==='enviado_final'){ const r=wfLatestRound(t,'captions');"));
// identidade
ok('S17 package.json = 1.0.244 + marcador H14', PKG.version === '1.0.244' && /timeline-step7-final-wait/.test(PKG.description || ''));
ok('S18 package-lock 1.0.244 (raiz + packages[""])', LOCK.version === '1.0.244' && LOCK.packages[''].version === '1.0.244');
ok('S19 marcadores herdados H13/H12 preservados na descrição', /timeline-honest-preenvio/.test(PKG.description || '') && /final-state-premature-fix/.test(PKG.description || ''));

console.log('================= F3.5.6A-H14 — TIMELINE STEP7 + ESPERA FINAL =================');
flog.forEach(l => console.log(l));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
