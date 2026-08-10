#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H3 — FONTE ÚNICA do estado "enviado ao cliente" (suíte de CÓDIGO/contrato).
 *
 * P0: tarefa NOVA — só GERAR o link marcava o card como "Temas enviados ao cliente"
 * (Responsável: Cliente) SEM envio confirmado, enquanto a Central (externalWaitOf) —
 * corretamente — não a listava. Causa-raiz PROVADA (RED empacotado f356ah3-red-main.js):
 * flowThemesSentSignal tratava clientReviewToken/shareToken (LINK) como ENVIO.
 *
 * Correção (RENDERER + espelho main): "enviado" = ENVIO CONFIRMADO server-side (workflowPhase
 * de espera OU espelhos legados clientFlowStatus/cronStatus — que só o Worker grava no
 * confirmClientSend). Token = LINK DISPONÍVEL. Novo estado THEMES_READY p/ "link gerado sem
 * envio" → "Temas prontos — confirmar envio ao cliente" (dono Social, fora da Central).
 *
 * Esta suíte PROVA o contrato (RED→GREEN): teria FALHADO em 1.0.231 (card falsamente enviado)
 * e passa em 1.0.244; mantém a PARIDADE renderer×main (slaRules) e a NEUTRALIDADE da camada de
 * notificações (nem themes_sent nem themes_ready emitem em notifFlowEvent — REGRA MÁXIMA).
 *
 * Rodar: node desktop/scripts/f356ah3-single-source-sent-state.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH3_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const SLARULES = process.env.F356AH3_SLARULES || path.join(DESK, 'src', 'main', 'slaRules.js');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH3_PKG || path.join(DESK, 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.join(DESK, 'package-lock.json'), 'utf8'));
/* require() trata caminho relativo "nu" (ex.: asar-x/dist/main/slaRules.js do gate EMPACOTADO)
 * como NOME DE PACOTE (node_modules), não arquivo → MODULE_NOT_FOUND. Resolver p/ absoluto
 * (relativo ao CWD quando relativo; no-op quando já absoluto, como no modo fonte). */
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
ok('A1 package.json 1.0.244', PKG.version === '1.0.244');
ok('A2 package-lock 1.0.244 (raiz + packages[""])', LOCK.version === '1.0.244' && LOCK.packages[''].version === '1.0.244');
ok('A3 description marca a sub-causa H3 (single-source-sent-state)', /single-source-sent-state|fonte-unica-envio|source-of-truth-sent/i.test(PKG.description || ''));

/* ---------- B. ESTRUTURA DA CORREÇÃO (renderer + espelho main) ---------- */
const sigR = grabFn(HTML, 'flowThemesSentSignal');
ok('B1 renderer flowThemesSentSignal NÃO trata token/shareToken/clientSentBy como enviado', !/clientReviewToken|shareToken|clientSentBy/.test(sigR));
ok('B2 renderer flowThemesSentSignal delega à fonte única (flowCanonicalSentSignal)', /flowCanonicalSentSignal/.test(sigR));
ok('B3 renderer tem flowCanonicalSentSignal (workflowPhase de espera OU espelhos legados)', /function flowCanonicalSentSignal/.test(HTML) && /themes_waiting_client/.test(grabFn(HTML, 'flowCanonicalSentSignal')));
const readyR = grabFn(HTML, 'flowThemesReadySignal');
ok('B4 renderer tem flowThemesReadySignal (token/link = pronto, não enviado)', /clientReviewToken|shareToken/.test(readyR) && /flowCanonicalSentSignal/.test(readyR));
ok('B5 renderer TASK_PHASE.THEMES_READY declarado', /THEMES_READY:'themes_ready'/.test(HTML));
ok('B6 renderer FLOW_LABELS.themes_ready = "Temas prontos — confirmar envio ao cliente"', /themes_ready:\{social:\{[^}]*Temas prontos — confirmar envio ao cliente/.test(HTML));
ok('B7 renderer deriveCanonicalTaskState roteia THEMES_READY após THEMES_SENT', /flowThemesReadySignal\(t\)\)return \{phase:TASK_PHASE\.THEMES_READY,owner:'social'/.test(HTML));
const sigM = grabFn(fs.readFileSync(SLARULES, 'utf8'), 'flowThemesSentSignal');
ok('B8 main slaRules flowThemesSentSignal também sem token + delega à fonte única', !/clientReviewToken|shareToken|clientSentBy/.test(sigM) && /flowCanonicalSentSignal/.test(sigM));
ok('B9 main slaRules tem flowCanonicalSentSignal + flowThemesReadySignal + THEMES_READY', /function flowCanonicalSentSignal/.test(fs.readFileSync(SLARULES, 'utf8')) && /function flowThemesReadySignal/.test(fs.readFileSync(SLARULES, 'utf8')) && /THEMES_READY:'themes_ready'/.test(fs.readFileSync(SLARULES, 'utf8')));
/* clientCol (coluna do cliente) também deixou de tratar token como enviado */
const clientColR = grabFn(HTML, 'clientCol');
ok('B10 renderer clientCol usa a fonte única (sem token bruto ⇒ enviado)', /flowCanonicalSentSignal/.test(clientColR) && !/t\.clientReviewToken\|\|t\.shareToken/.test(clientColR));

/* ---------- C. CONTRATO COMPORTAMENTAL (renderer real em vm) ---------- */
const SRC = [
  grabDecl(HTML, 'const SECTORS='), grabDecl(HTML, 'const SECTOR_ALIAS='), grabDecl(HTML, 'const TASK_PHASE='),
  grabDecl(HTML, 'const FLOW_LABELS='), grabDecl(HTML, 'const CLIENT_COLS='),
  grabFn(HTML, 'secOf'), grabFn(HTML, 'isClientSector'), grabFn(HTML, 'isTaskCompleted'), grabFn(HTML, 'hasDesigner'),
  grabFn(HTML, 'designerCol'), grabFn(HTML, 'pendingLegend'), grabFn(HTML, 'pendingFeed'), grabFn(HTML, 'pendingStory'),
  grabFn(HTML, 'pendingProduction'), grabFn(HTML, 'designerDelivered'), grabFn(HTML, 'clientApprovalPhaseOf'),
  grabFn(HTML, 'pendingClientItems'), grabFn(HTML, 'hasPendingItemRevision'), grabFn(HTML, 'isFullyComplete'),
  grabFn(HTML, 'flowCompletedSignal'), grabFn(HTML, 'flowSentToClientSignal'), grabFn(HTML, 'flowClientChangesSignal'),
  grabFn(HTML, 'flowThemesApprovedSignal'), grabFn(HTML, 'flowCanonicalSentSignal'), grabFn(HTML, 'flowThemesSentSignal'),
  grabFn(HTML, 'flowThemesReadySignal'), grabFn(HTML, 'deriveCanonicalTaskState'),
  grabFn(HTML, 'flowRole'), grabFn(HTML, 'deriveCanonicalPerspective'), grabFn(HTML, 'deriveSocialPerspective'),
  grabFn(HTML, 'clientCol'),
  grabDecl(HTML, 'var NOTIF_PHASE_LABEL='), grabFn(HTML, 'notifFlowEvent'),
].join('\n');
const R = new Function(SRC + '\nreturn { derive: deriveCanonicalTaskState, social: deriveSocialPerspective, sent: flowThemesSentSignal, ready: flowThemesReadySignal, canon: flowCanonicalSentSignal, clientCol: clientCol, flowEvent: notifFlowEvent, PH: TASK_PHASE };')();

/* Cenário A — SÓ LINK gerado (workflowPhase='themes_preparation'; sem round; sem confirmar) */
const taskA = { id: 'A', sector: 'cronograma', status: 'andamento', title: 'T', client: 'C', cronContents: [{ tema: '1' }], workflowPhase: 'themes_preparation', clientReviewToken: 'tok_x' };
const csA = R.derive(taskA), spA = R.social(taskA);
ok('C1 [RED→GREEN] Cenário A: NÃO é themes_sent (link ≠ envio)', csA.phase !== 'themes_sent');
ok('C2 [RED→GREEN] Cenário A: card NÃO diz "Temas enviados ao cliente" nem Responsável Cliente', spA.label !== 'Temas enviados ao cliente' && csA.owner !== 'client');
ok('C3 Cenário A: estado THEMES_READY (dono Social) — "Temas prontos — confirmar envio ao cliente"', csA.phase === 'themes_ready' && csA.owner === 'social' && spA.label === 'Temas prontos — confirmar envio ao cliente' && spA.next === 'Confirmar envio ao cliente');
ok('C4 Cenário A: flowThemesSentSignal=false e flowCanonicalSentSignal=false (token não é envio)', R.sent(taskA) === false && R.canon(taskA) === false && R.ready(taskA) === true);
ok('C5 Cenário A: clientCol ≠ enviado (coluna do cliente também não trata link como envio)', R.clientCol(taskA) !== 'enviado');

/* Cenário B — ENVIO CONFIRMADO (estado canônico que o Worker grava no confirmClientSend) */
const taskB = { id: 'B', sector: 'cronograma', status: 'andamento', title: 'T', client: 'C', cronContents: [{ tema: '1' }], clientReviewToken: 'tok_x', workflowPhase: 'themes_waiting_client', workflowResponsibleType: 'client', externalWait: true, clientFlowStatus: 'enviado', cronStatus: 'enviado_cliente', clientSentAt: 1, clientApprovalPhase: 'themes', approvalRounds: { ar_themes_r1: { type: 'themes', sentAt: 1, status: 'sent' } } };
const csB = R.derive(taskB), spB = R.social(taskB);
ok('C6 Cenário B: themes_sent + dono Cliente (envio canônico confirmado)', csB.phase === 'themes_sent' && csB.owner === 'client');
ok('C7 Cenário B: card diz "Temas enviados ao cliente" (agora CORRETO)', spB.label === 'Temas enviados ao cliente' && R.sent(taskB) === true && R.canon(taskB) === true);
ok('C8 Cenário B: clientCol = enviado', R.clientCol(taskB) === 'enviado');

/* REGRESSÃO — tarefa LEGADA (sem workflowPhase, cronStatus=enviado_cliente) segue "enviada" */
const taskL = { id: 'L', sector: 'cronograma', status: 'andamento', title: 'T', client: 'C', cronContents: [{ tema: '1' }], cronStatus: 'enviado_cliente', clientFlowStatus: 'enviado', clientReviewToken: 'tok_leg', clientSentAt: 1 };
ok('C9 Regressão: tarefa LEGADA segue themes_sent + "Temas enviados ao cliente" (5 registros antigos preservados)', R.derive(taskL).phase === 'themes_sent' && R.social(taskL).label === 'Temas enviados ao cliente' && R.canon(taskL) === true);

/* ---------- D. PARIDADE renderer × main (slaRules) — fase/owner idênticos ---------- */
for (const [nm, t] of [['A', taskA], ['B', taskB], ['L', taskL]]) {
  const a = R.derive(t), b = rules.deriveCanonicalTaskState(t);
  ok('D-' + nm + ' paridade renderer×main (fase+owner idênticos)', a.phase === b.phase && a.owner === b.owner);
}

/* ---------- E. NEUTRALIDADE da camada de notificações (REGRA MÁXIMA) ---------- */
ok('E1 notifFlowEvent(planning→themes_ready) = null (link gerado NÃO gera notificação)', R.flowEvent('planning', 'themes_ready') === null);
ok('E2 notifFlowEvent(themes_ready→themes_sent) = null (confirmar envio NÃO gera notificação nova nesta via)', R.flowEvent('themes_ready', 'themes_sent') === null);
ok('E3 notifFlowEvent(themes_ready→awaiting_designer) = null (sem atribuição azul espúria)', R.flowEvent('themes_ready', 'awaiting_designer') === null);
ok('E4 themes_sent segue sem emitir (contrato pré-existente intacto)', R.flowEvent('planning', 'themes_sent') === null && R.flowEvent('themes_ready', 'planning') === null);
/* main slaRules.flowEventOf idem (superset compatível) */
ok('E5 main flowEventOf também null p/ themes_ready (paridade da neutralidade)', rules.flowEventOf('planning', 'themes_ready') === null && rules.flowEventOf('themes_ready', 'themes_sent') === null);

console.log('\n===== F3.5.6A-H3 — SINGLE-SOURCE SENT-STATE =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('f356ah3-single-source-sent-state: ' + pass + '/' + (pass + fail) + (fail ? ' — FALHOU' : ' — VERDE'));
if (fail) { console.error('::error:: contrato F3.5.6A-H3 violado'); process.exit(1); }
