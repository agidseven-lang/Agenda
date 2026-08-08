#!/usr/bin/env node
/* =====================================================================================
 * F3.4.4 — GOLDEN MASTER do FLOW ENGINE (fase canônica renderer × main).
 *
 * PROVA que o porte F3.4.4 em desktop/src/main/slaRules.js (deriveCanonicalTaskState +
 * TODOS os sinais/predicados + rótulos + notifLastActorId→flowLastActionOf) reproduz
 * VALOR-A-VALOR o Flow Engine do renderer (desktop/src/renderer/index.html, 1.0.180)
 * sobre um corpus determinístico que percorre todos os ramos da derivação.
 *
 * TAMBÉM prova que flowEventOf é SUPERSET COMPATÍVEL de notifFlowEvent: para todo par
 * (prev,cur) em que o legado retorna evento, o novo retorna eventType/título/severidade
 * IDÊNTICOS; onde o legado retorna null, o novo só difere nos retornos DOCUMENTADOS
 * (produção/revisão/entrega → awaiting_designer = flow_returned_to_todo) — a atribuição
 * (planning/themes_* → awaiting_designer) segue null (azul designer_assigned única, u1b).
 *
 * Rodar: node desktop/scripts/f344-flow-golden-master.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const rules = require(path.join(DESK, 'src', 'main', 'slaRules.js'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; if (flog.length < 40) flog.push('FAIL: ' + n); } };

/* ---------- extração VERBATIM do index.html (mesma técnica do f343-sla-golden-master) ---------- */
function grabFn(name) {
  const a = HTML.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  let d = 0;
  for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
function grabDecl(marker) {
  const a = HTML.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  let round = 0, sq = 0, cur = 0;
  for (let j = a + marker.length; j < HTML.length; j++) {
    const c = HTML[j];
    if (c === '(') round++; else if (c === ')') round--;
    else if (c === '[') sq++; else if (c === ']') sq--;
    else if (c === '{') cur++; else if (c === '}') cur--;
    else if (c === ';' && round === 0 && sq === 0 && cur === 0) return HTML.slice(a, j + 1);
  }
  throw new Error('decl sem ; : ' + marker);
}

const SRC = [
  grabDecl('const SECTORS='), grabDecl('const SECTOR_ALIAS='), grabDecl('const TASK_PHASE='), grabDecl('var NOTIF_PHASE_LABEL='),
  grabFn('secOf'), grabFn('isClientSector'), grabFn('isTaskCompleted'), grabFn('hasDesigner'), grabFn('designerCol'),
  grabFn('pendingLegend'), grabFn('pendingFeed'), grabFn('pendingStory'), grabFn('pendingProduction'), grabFn('designerDelivered'),
  grabFn('clientApprovalPhaseOf'), grabFn('pendingClientItems'), grabFn('hasPendingItemRevision'), grabFn('isFullyComplete'),
  grabFn('flowCompletedSignal'), grabFn('flowSentToClientSignal'), grabFn('flowClientChangesSignal'),
  grabFn('flowThemesApprovedSignal'), grabFn('flowCanonicalSentSignal'), grabFn('flowThemesSentSignal'), grabFn('flowThemesReadySignal'),
  grabFn('deriveCanonicalTaskState'), grabFn('notifPhaseLabel'), grabFn('notifFlowEvent'), grabFn('notifLastActorId'),
].join('\n');
const R = new Function(SRC + '\nreturn { derive: deriveCanonicalTaskState, label: notifPhaseLabel, flowEvent: notifFlowEvent, lastActor: notifLastActorId, LBL: NOTIF_PHASE_LABEL, PH: TASK_PHASE };')();

/* ---------- corpus determinístico (percorre todos os ramos da derivação) ---------- */
const SECT = ['edicao_midia', 'cronograma', 'roteiro', 'programacao_posts', 'copywriting', 'design', undefined];
const STAT = [undefined, 'afazer', 'andamento', 'revisao', 'concluido'];
const DA = [null, { designerId: 'D1', designerName: 'Ana Souza', designerAvatar: '', assignedBy: 'S1', assignedByName: 'Su', assignedAt: 100 }];
const DFS = [undefined, 'afazer', 'andamento', 'revisao', 'concluido', 'entregue'];
const CLIENT = [
  {}, { clientFlowStatus: 'enviado' }, { clientFlowStatus: 'aprovado' }, { clientFlowStatus: 'revisao' },
  { clientFlowStatus: 'reenviado' }, { clientFlowStatus: 'concluido' },
  { cronStatus: 'enviado_cliente' }, { cronStatus: 'ready_for_final_client_review' }, { cronStatus: 'reenviado_cliente' },
  { cronStatus: 'aprovado_final' }, { cronStatus: 'em_revisao_cliente' },
  { clientReview: { status: 'revisao' } }, { clientReview: { status: 'aprovado' } },
  { clientApprovalPhase: 'final' }, { clientApprovalPhase: 'production' }, { clientApprovalPhase: 'themes' },
  { finalApprovalCompleted: true }, { operationalStatus: 'concluido' }, { clientApprovedFlag: true },
  { clientSentBy: 'S1' }, { shareToken: 'tok' }, { clientReviewToken: 'tok' },
  { workflowStage: 'entrega' }, { workflowStage: 'revisao_final' },
  { clientItems: { i0: { cs: 'em_revisao', phase: 'themes' } } },
  { clientItems: { i0: { cs: 'em_revisao', phase: 'production' } } },
  { clientItems: { i0: { cs: 'editado', phase: 'themes' }, i1: { cs: 'aprovado', phase: 'themes' } } },
  { clientReview: { status: 'aprovado' }, clientApprovalPhase: 'production' },
];
const CONT = [undefined, [], [{ legenda: 'a', feedImageUrl: 'u' }], [{ legenda: '', feedImageUrl: '' }],
  [{ legenda: 'a', feedImageUrl: 'u', storyImageUrl: 's' }, { legenda: 'b', feedImageUrl: 'u2' }]];
const ACTS = [
  {},
  { history: [{ kind: 'moved', at: 5, byId: 'U9', from: 'afazer', to: 'andamento' }] },
  { history: [{ kind: 'designer_moved', axis: 'designerFlowStatus', at: 7, atMs: 7, byUid: 'D1', byId: 'D1', from: 'afazer', to: 'andamento' }, { type: 'social_editou_conteudo', by: 'Su', byId: 'S1', at: 9 }] },
  { clientActions: { a1: { at: 11, by: 'C1' } } },
  { history: [{ kind: 'moved', at: 5, byId: 'U9' }], clientActions: { a1: { at: 11, by: 'C1' } } },
  { history: [{ at: 3, by: 'NomeSolto' }] },
  { history: [{ kind: 'moved', byId: 'semAt' }] },                       // entrada sem `at` (ignorada)
  { history: [{ kind: 'moved', at: 20, byId: 'U2' }, { kind: 'moved', at: 15, byId: 'U3' }] }, // fora de ordem
];

const corpus = [];
let n = 0;
for (const sector of SECT) for (const status of STAT) for (const da of DA) for (const dfs of DFS) {
  corpus.push({ id: 'A' + (n++), sector, status, designerAssignment: da || undefined, designerFlowStatus: dfs, title: 'T', client: 'C' });
}
for (const da of DA) for (const cs of CLIENT) for (const cc of CONT) {
  corpus.push({ id: 'B' + (n++), sector: 'cronograma', status: 'afazer', designerAssignment: da || undefined, cronContents: cc, title: 'T', client: 'C', ...cs });
}
for (const cs of CLIENT) for (const cc of [undefined, CONT[2]]) {
  corpus.push({ id: 'C' + (n++), sector: 'roteiro', status: 'afazer', cronContents: cc, title: 'T', client: 'C', ...cs });
  corpus.push({ id: 'C' + (n++), sector: 'roteiro', status: 'afazer', designerAssignment: DA[1], cronContents: cc, title: 'T', client: 'C', ...cs });
}
for (const dfs of DFS) for (const cs of [CLIENT[0], CLIENT[7], CLIENT[3], CLIENT[9], CLIENT[24]]) {
  corpus.push({ id: 'D' + (n++), sector: 'cronograma', designerAssignment: DA[1], designerFlowStatus: dfs, cronContents: CONT[4], title: 'T', client: 'C', ...cs });
}
corpus.forEach((t, i) => { Object.assign(t, ACTS[i % ACTS.length]); });

/* ---------- 1) fase/owner/isCron VALOR-A-VALOR ---------- */
{
  let div = 0; const sample = [];
  for (const t of corpus) {
    const a = R.derive(t), b = rules.deriveCanonicalTaskState(t);
    if (!a || !b || a.phase !== b.phase || a.owner !== b.owner || a.isCron !== b.isCron) {
      div++; if (sample.length < 6) sample.push(t.id + ': renderer=' + JSON.stringify(a) + ' main=' + JSON.stringify(b));
    }
  }
  ok('1 deriveCanonicalTaskState VALOR-IDÊNTICO em ' + corpus.length + ' tarefas (0 divergência)' + (div ? ' → ' + sample.join(' | ') : ''), div === 0);
}

/* ---------- 2) rótulos de etapa idênticos ---------- */
{
  const phases = Object.values(R.PH);
  ok('2 NOTIF_PHASE_LABEL deep-equal', JSON.stringify(R.LBL) === JSON.stringify(rules.NOTIF_PHASE_LABEL));
  ok('2 notifPhaseLabel idêntico p/ as ' + phases.length + ' fases (+desconhecida)', phases.every((p) => R.label(p) === rules.notifPhaseLabel(p)) && R.label('x') === rules.notifPhaseLabel('x'));
}

/* ---------- 3) flowEventOf = SUPERSET compatível de notifFlowEvent (10×10 pares) ---------- */
{
  const phases = Object.values(R.PH);
  let bad = 0; const det = [];
  const RETURN_FROM = ['designer_producing', 'designer_revising', 'designer_delivered'];
  for (const p of phases) for (const c of phases) {
    const leg = R.flowEvent(p, c), neo = rules.flowEventOf(p, c);
    if (leg) {
      if (JSON.stringify(leg) !== JSON.stringify(neo)) { bad++; if (det.length < 6) det.push(p + '→' + c + ' legado≠novo'); }
    } else if (c === 'awaiting_designer' && RETURN_FROM.indexOf(p) >= 0 && p !== c) {
      if (!neo || neo.eventType !== 'flow_returned_to_todo') { bad++; if (det.length < 6) det.push(p + '→' + c + ' retorno não mapeado'); }
    } else if (neo !== null) { bad++; if (det.length < 6) det.push(p + '→' + c + ' novo≠null'); }
  }
  ok('3 flowEventOf: 6 destinos legados BYTE-idênticos + retorno A Fazer só de produção/revisão/entrega' + (bad ? ' → ' + det.join(' | ') : ''), bad === 0);
  ok('3 atribuição NÃO duplica: planning/themes_*→awaiting_designer continua null (azul u1b única)',
    rules.flowEventOf('planning', 'awaiting_designer') === null && rules.flowEventOf('themes_sent', 'awaiting_designer') === null && rules.flowEventOf('themes_approved', 'awaiting_designer') === null);
}

/* ---------- 4) ATOR: notifLastActorId ≡ flowLastActionOf().byId em todo o corpus ---------- */
{
  let div = 0; const det = [];
  for (const t of corpus) {
    const a = R.lastActor(t), b = rules.flowLastActionOf(t).byId;
    if ((a || null) !== (b || null)) { div++; if (det.length < 6) det.push(t.id + ': ' + a + '≠' + b); }
  }
  ok('4 último ATOR idêntico (history+clientActions, maior `at`) em ' + corpus.length + ' tarefas' + (div ? ' → ' + det.join(' | ') : ''), div === 0);
}

/* ---------- 5) carimbo: determinístico, muda com ação nova, igual em replay ---------- */
{
  const t = { id: 'S1', sector: 'edicao_midia', status: 'andamento', history: [{ kind: 'moved', at: 50, byId: 'D1', from: 'afazer', to: 'andamento' }] };
  const s1 = rules.flowStampOf(t), s1b = rules.flowStampOf(JSON.parse(JSON.stringify(t)));
  t.history.push({ kind: 'moved', at: 60, byId: 'D1', from: 'andamento', to: 'afazer' });
  const s2 = rules.flowStampOf(t);
  ok('5 carimbo idêntico em replay do MESMO doc', s1 === s1b);
  ok('5 carimbo MUDA com nova ação autoritativa (at↑ e len↑)', s1 !== s2);
  ok('5 carimbo sem relógio local (doc vazio → 0:h0:c0)', rules.flowStampOf({ id: 'x' }) === '0:h0:c0');
}

console.log('\n===== F3.4.4 — FLOW GOLDEN MASTER (renderer × main) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F344-FLOW-GOLDEN: ' + pass + ' OK, ' + fail + ' FAIL (corpus=' + corpus.length + ')');
if (fail) { console.error('::error:: divergência renderer × main no Flow Engine'); process.exit(1); }
console.log('OK — fase/rótulo/evento/ator/carimbo VALOR-IDÊNTICOS; superset de retorno documentado; azul única preservada.');
