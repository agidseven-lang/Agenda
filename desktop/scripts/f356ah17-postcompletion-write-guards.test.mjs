#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H17 — FECHAMENTO PÓS-CONCLUSÃO: ATOR FINAL + SLA READ-ONLY + BLOQUEIO DE MOVE
 *
 * Resíduos observados na 1.0.242 (Cronograma Teste 6, tela DETALHES, tarefa CONCLUÍDA):
 *   RESÍDUO 1 — marco final da timeline tinha 15:43 mas SEM "por Cliente" (recordedBy/
 *               clientFinalApprovedBy vazios; o único ator populado era clientReview.byName).
 *   RESÍDUO 2 — botão "Editar prazo" ainda presente e FUNCIONAL (slaEditPrazoCommit escrevia
 *               designerSla.* + scheduleRevision++ sem guarda de conclusão).
 *   RESÍDUO 3 — "Mover status" ainda presente e o write (moveStatus) ocorria pós-conclusão.
 *
 * Correção 1.0.246 (RENDERER-only, index.html):
 *   C1 — ATOR do marco FINAL: além das fontes canônicas (rodada FINAL recordedBy →
 *        clientFinalApprovedBy → evento exato), aceita clientReview.byName/by SOMENTE com PROVA
 *        de identidade temporal (clientReview.status==='aprovado' && clientReview.at===FINAL_AT).
 *        NÃO aceita apenas status==='aprovado' (poderia ser aprovação dos TEMAS).
 *   C2 — SLA pós-conclusão SOMENTE LEITURA: bloco SLA visível, botão "Editar prazo" oculto quando
 *        isTaskCompleted; guarda funcional em slaEditPrazoOpen E guarda defensiva em
 *        slaEditPrazoCommit (ZERO escrita mesmo por DOM stale/chamada direta).
 *   C3 — MOVER pós-conclusão BLOQUEADO: botões "Mover"/"Mover status" ocultos quando isTaskCompleted;
 *        guarda em openMove E guarda defensiva no write-path moveStatus (ZERO escrita/evento).
 *   C4 — REMOVER PERMANECE: canDelTask + confirmação "digite EXCLUIR"; deleteTask INALTERADO.
 *
 * RED na base 1.0.242 (dcc07e6/1e18d4c) → GREEN na 1.0.243. isTaskCompleted/isFullyComplete NÃO
 * alterados. Guardas só agem quando isTaskCompleted(t)===true (após a aprovação final do cliente);
 * a conclusão de PRODUÇÃO do designer roda ANTES (isTaskCompleted=false) e NÃO é bloqueada.
 * Rodar: node desktop/scripts/f356ah17-postcompletion-write-guards.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH17_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH17_PKG || path.join(DESK, 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.join(DESK, 'package-lock.json'), 'utf8'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

function grabFn(SRC, name) {
  let a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  if (SRC.slice(Math.max(0, a - 6), a) === 'async ') a -= 6; // preserva prefixo async (corpo com await quebra o parse sem ele)
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
    grabFn(HTML, 'secOf'), grabFn(HTML, 'isClientSector'), grabFn(HTML, 'stOf'), grabFn(HTML, 'opColOf'), grabFn(HTML, 'clientStatusView'),
    grabFn(HTML, 'isTaskCompleted'), grabFn(HTML, 'isFullyComplete'), grabFn(HTML, 'hasDesigner'),
    grabFn(HTML, 'designerCol'), grabFn(HTML, 'designerDelivered'), grabFn(HTML, 'designerOf'), grabFn(HTML, 'socialOf'),
    grabFn(HTML, 'pendingLegend'), grabFn(HTML, 'pendingFeed'), grabFn(HTML, 'pendingStory'), grabFn(HTML, 'pendingProduction'),
    grabFn(HTML, 'clientApprovalPhaseOf'), grabFn(HTML, 'pendingClientItems'), grabFn(HTML, 'hasPendingItemRevision'),
    grabFn(HTML, 'allPhaseItemsApproved'), grabFn(HTML, 'clientApproved'), grabFn(HTML, 'hasTeamAdjustedAwaiting'),
    grabFn(HTML, 'isSentToDesigner'), grabFn(HTML, 'fmtDateTimeBR'),
    grabFn(HTML, 'flowCompletedSignal'), grabFn(HTML, 'flowSentToClientSignal'), grabFn(HTML, 'flowClientChangesSignal'),
    grabFn(HTML, 'flowThemesApprovedSignal'), grabFn(HTML, 'flowCanonicalSentSignal'), grabFn(HTML, 'flowThemesSentSignal'),
    grabFn(HTML, 'flowThemesReadySignal'),
    grabFn(HTML, 'wfRoundsOf'), grabFn(HTML, 'wfLatestRound'), grabFn(HTML, '_tlEventAt'), grabFn(HTML, '_tlRelAgo'), grabFn(HTML, '_tlHumanLabel'),
    grabFn(HTML, 'clientCol'), grabFn(HTML, 'operationalCol'), grabFn(HTML, 'nextActionText'), grabFn(HTML, 'nextActionShort'),
    grabFn(HTML, 'taskTimeline'), grabFn(HTML, 'detailState'),
    grabFn(HTML, 'canDelTask'),
    grabFn(HTML, 'slaEditPrazoOpen'), grabFn(HTML, 'slaEditPrazoCommit'),
    grabFn(HTML, 'openMove'), grabFn(HTML, 'moveStatus'),
  ].join('\n');
  // Preâmbulo: STUBS de AMBIENTE (não são o código sob teste). Probes de ESCRITA (__writes),
  // de MODAL (__modalRoot/__appended), toasts. isDesignerAxisMove=false força o eixo social
  // (mínimas dependências) — a guarda H17 age ANTES do branch de eixo, então isso não afeta a
  // validade do teste da guarda; só torna o caminho da BASE (sem guarda) determinístico.
  const PRE = [
    'var __toasts=[]; function flashToast(m){__toasts.push(m);} ',
    'var __writes=[]; var __getData={designerSla:{}};',
    'function __mkDoc(id){ return { update:function(p){ __writes.push({id:id,patch:p}); return Promise.resolve(); }, get:function(){ return Promise.resolve({ exists:true, data:function(){ return __getData; } }); } }; }',
    'function __mkColl(){ return { doc:function(id){ return __mkDoc(id); } }; }',
    'var db={ collection:function(){ return __mkColl(); } };',
    'var __render=0; function render(){__render++;} ',
    'var __closeModal=0; function closeModal(){__closeModal++;} ',
    'function isDesignerAxisMove(t){return false;} ',       // força eixo social (guarda age antes)
    'function slaGuardBlocked(id){return false;} ',
    'function _slaScheduleRevOf(t){return (t&&t.designerSla&&Number(t.designerSla.scheduleRevision))||0;} ',
    'function slaPanelFinishMs(t,f){return (t&&t.designerSla&&Number(t.designerSla.planDueAt))||0;} ',
    'function dtMs(d,t){return new Date(String(d)+"T"+String(t||"00:00")+":00").getTime();} ',
    'function svg(n,cls){return "";} ',
    'function esc(s){return String(s==null?"":s);} ',
    'function withAlpha(c,a){return String(c||"");} ',
    'function slaibEsc(s){return String(s==null?"":s);} ',
    'function canSeeAll(u){return !!(u&&u.admin);} ',       // semântica real: admin ⇒ vê tudo
    'var firebase={firestore:{FieldValue:{arrayUnion:function(){return {__au:1};},delete:function(){return {__del:1};}}}};',
    'var __modalRoot={innerHTML:""};',
    'var __appended=0;',
    'var __startEl={value:"2026-08-10T10:00"}, __dueEl={value:"2026-08-10T18:00"}, __saveEl={disabled:false};',
    'var document={ getElementById:function(id){ if(id==="modalRoot")return __modalRoot; if(id==="slaedit-start")return __startEl; if(id==="slaedit-due")return __dueEl; if(id==="slaedit-save")return __saveEl; return null; },',
    '  createElement:function(){ return {className:"",id:"",innerHTML:"",addEventListener:function(){},remove:function(){},appendChild:function(){}}; },',
    '  body:{appendChild:function(){__appended++;}} };',
    'var state={users:[],tasks:[],user:null,designerBoard:false};',
  ].join('\n');
  const RET = 'return {isTaskCompleted:isTaskCompleted,isFullyComplete:isFullyComplete,taskTimeline:taskTimeline,'
    + 'canDelTask:canDelTask,slaEditPrazoOpen:slaEditPrazoOpen,slaEditPrazoCommit:slaEditPrazoCommit,'
    + 'openMove:openMove,moveStatus:moveStatus,operationalCol:operationalCol,state:state,'
    + 'getToasts:function(){return __toasts;},getWrites:function(){return __writes;},'
    + 'getAppended:function(){return __appended;},getModalHTML:function(){return __modalRoot.innerHTML;},'
    + 'setGetData:function(d){__getData=d;},'
    + 'resetProbes:function(){__toasts.length=0;__writes.length=0;__appended=0;__modalRoot.innerHTML="";__render=0;__closeModal=0;state.tasks=[];state.user=null;}};';
  api = new Function(PRE + '\n' + SRC + '\n' + RET)();
} catch (e) { bootErr = e; }

if (!api) { console.log('================= F3.5.6A-H17 — FECHAMENTO PÓS-CONCLUSÃO ================='); console.log('BOOT FALHOU: ' + (bootErr && bootErr.message)); console.log('PASS ' + pass + ' | FAIL ' + (fail + 1) + '  (versão sob teste: ' + PKG.version + ')'); process.exit(1); }

/* =========================== TEMPOS =========================== */
const T0    = 1754800000000;  // createdAt
const T0838 = 1754818680000;  // TEMAS ~08:38 (também o clientReview ANTIGO/ambíguo do fixture 4)
const T1331 = 1754836860000;  // envio FINAL ~13:31
const T1543 = 1754844780000;  // APROVAÇÃO FINAL real do cliente ~15:43
const TDONE = T1543 + 60000;  // doneAt legado (posterior)

/* =========================== FIXTURES — ATOR (marco FINAL da timeline) =========================== */
// Base de uma tarefa CONCLUÍDA (cronograma) SEM ator canônico e SEM evento exato 'final_approved/
// ackFeedback/aprovado_final' (⇒ o `by` inicial da timeline é null; o ator vem só da cadeia _fby).
function atorBase() {
  return {
    id: 'CT6', sector: 'cronograma', client: 'CLIENTE', createdAt: T0,
    workflowPhase: 'completed', finalApprovalCompleted: true,
    clientFlowStatus: 'concluido', cronStatus: 'aprovado_final', operationalStatus: 'concluido',
    designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'concluido',
    cronContents: [{ tema: 'T1', legenda: 'L1' }, { tema: 'T2', legenda: '' }],
    clientSentAt: T0838,
    approvalRounds: { ar_themes_r1: { type: 'themes', sentAt: T0838, decision: 'approved', decisionAt: T0838, recordedBy: 'Cliente' } },
    history: [{ type: 'cronograma_enviado_cliente', at: T0838, by: 'Social', phase: 'themes' }],
  };
}
// Fixture 1 — rodada FINAL com recordedBy='Cliente' (ator canônico direto). by='Cliente' na base E candidata.
function ator1() { const t = atorBase(); t.approvalRounds.ar_captions_r1 = { type: 'captions', sentAt: T1331, decision: 'approved', decisionAt: T1543, recordedBy: 'Cliente', status: 'decided' }; return t; }
// Fixture 2 — recordedBy vazio, clientFinalApprovedBy='Cliente' (2ª fonte da cadeia da rodada). by='Cliente' base E candidata.
function ator2() { const t = atorBase(); t.approvalRounds.ar_captions_r1 = { type: 'captions', sentAt: T1331, decision: 'approved', decisionAt: T1543, recordedBy: '', status: 'decided' }; t.clientFinalApprovedAt = T1543; t.clientFinalApprovedBy = 'Cliente'; return t; }
// Fixture 3 — REAL Cronograma Teste 6: recordedBy '' + clientFinalApprovedBy '' + SÓ clientReview.byName,
// com identidade temporal (clientReview.at === FINAL_AT=15:43). base: by=null; candidata: by='Cliente'. (RED→GREEN)
function ator3() { const t = atorBase(); t.approvalRounds.ar_captions_r1 = { type: 'captions', sentAt: T1331, decision: 'approved', decisionAt: T1543, recordedBy: '', status: 'decided' }; t.clientFinalApprovedAt = T1543; t.clientFinalApprovedBy = ''; t.clientReview = { status: 'aprovado', at: T1543, byName: 'Cliente' }; return t; }
// Fixture 4 (CRÍTICO) — clientReview ANTIGO dos TEMAS (status 'aprovado', at=08:38≠15:43, byName='ClienteTEMAS').
// FINAL_AT=15:43. A guarda temporal IMPEDE usar o ator antigo. by NÃO pode ser 'ClienteTEMAS' nem 'Cliente'.
function ator4() { const t = atorBase(); t.approvalRounds.ar_captions_r1 = { type: 'captions', sentAt: T1331, decision: 'approved', decisionAt: T1543, recordedBy: '', status: 'decided' }; t.clientFinalApprovedAt = T1543; t.clientFinalApprovedBy = ''; t.clientReview = { status: 'aprovado', at: T0838, byName: 'ClienteTEMAS' }; return t; }

/* =========================== FIXTURES — SLA / MOVE =========================== */
// CONCLUÍDA (isTaskCompleted=true) com designerSla (histórico do prazo). Alvo das guardas read-only/move.
function completedSla() {
  const t = ator3();
  t.status = 'concluido';
  t.designerSla = { planStartAt: T0, planDueAt: T1331, plannedFinishAt: T1331, scheduleRevision: 2 };
  return t;
}
// ATIVA (isTaskCompleted=false): designer entregou, SEM aprovação final. designerSla presente.
// Prova que as guardas NÃO super-bloqueiam (SLA editável + move ativo em tarefa NÃO concluída).
function activeSla() {
  return {
    id: 'CT9', sector: 'cronograma', client: 'CLIENTE ATIVO', createdAt: T0, status: 'andamento',
    workflowPhase: 'captions_preparation', clientFlowStatus: 'producao', cronStatus: 'ready_for_final_client_review',
    clientApprovalPhase: 'final', finalApprovalRequired: true,
    designerAssignment: { designerId: 'd1' }, designerFlowStatus: 'concluido',
    cronContents: [{ tema: 'T1', legenda: 'L1' }, { tema: 'T2', legenda: '' }],
    designerSla: { planStartAt: T0, planDueAt: T1331, plannedFinishAt: T1331, scheduleRevision: 1 },
    approvalRounds: {}, history: [],
  };
}

/* =========================== PRECONDIÇÕES =========================== */
ok('P0 boot OK', !!api);
ok('P1 isTaskCompleted(completedSla)===true', api.isTaskCompleted(completedSla()) === true);
ok('P2 isTaskCompleted(activeSla)===false (designer entregou, sem aprovação final)', api.isTaskCompleted(activeSla()) === false);
ok('P3 todos os fixtures de ator são CONCLUÍDOS', api.isTaskCompleted(ator1()) && api.isTaskCompleted(ator2()) && api.isTaskCompleted(ator3()) && api.isTaskCompleted(ator4()));

/* =========================== GRUPO ATOR (C1) — RED base(3) → GREEN candidata =========================== */
function concluidoMilestone(t) { const tl = api.taskTimeline(t); return tl.milestones.find(m => m.key === 'concluido'); }
const m1 = concluidoMilestone(ator1());
ok('A1 fixture1 (recordedBy) → marco concluido done, at=15:43, by="Cliente"', m1 && m1.done === true && m1.at === T1543 && m1.by === 'Cliente');
const m2 = concluidoMilestone(ator2());
ok('A2 fixture2 (clientFinalApprovedBy) → at=15:43, by="Cliente"', m2 && m2.at === T1543 && m2.by === 'Cliente');
const m3 = concluidoMilestone(ator3());
ok('A3 fixture3 (SÓ clientReview.byName, identidade temporal) → by="Cliente" (RED na 1.0.242)', m3 && m3.by === 'Cliente');
ok('A4 fixture3 → at=15:43 (FINAL_AT), NÃO 08:38 dos temas', m3 && m3.at === T1543 && m3.at !== T0838);
const m4 = concluidoMilestone(ator4());
ok('A5 fixture4 CRÍTICO — clientReview ANTIGO (08:38) NÃO vira ator: by !== "ClienteTEMAS" e !== "Cliente"', m4 && m4.by !== 'ClienteTEMAS' && m4.by !== 'Cliente');
ok('A6 fixture4 — at=15:43 (FINAL honrado apesar do clientReview antigo 08:38)', m4 && m4.at === T1543 && m4.at !== T0838);

/* =========================== GRUPO SLA read-only (C2) — write-guard =========================== */
// Editor NÃO abre em tarefa concluída (guarda funcional em slaEditPrazoOpen). base: abre (__appended≥1) → RED.
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [completedSla()];
api.slaEditPrazoOpen('CT6');
ok('B1 slaEditPrazoOpen(concluída) BLOQUEADO — modal NÃO anexado (0×) + toast "apenas para consulta"', api.getAppended() === 0 && /apenas para consulta|já foi concluída/.test(api.getToasts()[0] || ''));
// Commit direto em tarefa concluída: ZERO escrita (guarda defensiva ANTES de DOM/update). base: escreve → RED.
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [completedSla()];
await api.slaEditPrazoCommit('CT6');
ok('B2 slaEditPrazoCommit(concluída) — ZERO escrita (db.update 0×) + toast; sem scheduleRevision++', api.getWrites().length === 0 && /apenas para consulta|já foi concluída/.test(api.getToasts()[0] || ''));
// NÃO-REGRESSÃO: tarefa ATIVA continua abrindo o editor e o commit ESCREVE (guarda só age em concluída).
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [activeSla()];
api.slaEditPrazoOpen('CT9');
ok('B3 NR — slaEditPrazoOpen(ATIVA) NÃO bloqueado (modal anexado ≥1)', api.getAppended() >= 1);
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [activeSla()];
await api.slaEditPrazoCommit('CT9');
ok('B4 NR — slaEditPrazoCommit(ATIVA) ESCREVE o prazo (db.update ≥1; guarda não super-bloqueia)', api.getWrites().length >= 1 && api.getWrites()[0].patch['designerSla.planStartAt'] !== undefined);

/* =========================== GRUPO MOVE (C3) — write-guard =========================== */
// Move direto (chamada de handler) em tarefa concluída: ZERO escrita/evento. base: escreve → RED.
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [completedSla()];
await api.moveStatus('CT6', 'andamento');
ok('C1 moveStatus(concluída,"andamento") — ZERO escrita (db.update 0×) + toast "não pode ser movimentada"', api.getWrites().length === 0 && /não pode ser movimentada|já foi concluída/.test(api.getToasts()[0] || ''));
// openMove em concluída: não abre o seletor (modalRoot vazio) + toast. base: abre (innerHTML preenchido) → RED.
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [completedSla()];
api.openMove('CT6');
ok('C2 openMove(concluída) BLOQUEADO — modalRoot vazio + toast', api.getModalHTML() === '' && /não pode ser movimentada|já foi concluída/.test(api.getToasts()[0] || ''));
// NÃO-REGRESSÃO: tarefa ATIVA continua movível (moveStatus escreve; openMove abre o seletor).
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [activeSla()];
await api.moveStatus('CT9', 'andamento');
ok('C3 NR — moveStatus(ATIVA,"andamento") ESCREVE (db.update ≥1; guarda não super-bloqueia)', api.getWrites().length >= 1);
api.resetProbes(); api.state.user = { id: 'adm', admin: true }; api.state.tasks = [activeSla()];
api.openMove('CT9');
ok('C4 NR — openMove(ATIVA) abre o seletor (modalRoot preenchido)', api.getModalHTML() !== '' && api.getModalHTML().length > 0);

/* =========================== GRUPO REMOVER preservado (C4) — RBAC =========================== */
// Remover NÃO é bloqueado pós-conclusão. canDelTask exercita as 3 vias de RBAC.
const cAdmin = api.canDelTask.call({}, completedSla()); // canDelTask usa state.user; setamos abaixo
api.state.user = { id: 'adm', admin: true };
ok('D1 canDelTask(concluída) — ADMIN pode remover (Remover PERMANECE)', api.canDelTask(completedSla()) === true);
api.state.user = { id: 'ownerU' }; const towner = completedSla(); towner.by = 'ownerU';
ok('D2 canDelTask(concluída) — DONO (t.by) pode remover mesmo sem admin', api.canDelTask(towner) === true);
api.state.user = { id: 'stranger' }; const tstr = completedSla(); tstr.by = 'ownerU'; tstr.assigneeId = 'someoneElse';
ok('D3 canDelTask(concluída) — usuário sem RBAC/vínculo NÃO pode (RBAC intacto)', api.canDelTask(tstr) === false);

/* =========================== ESTÁTICOS — guardas + isolamento + heranças =========================== */
const S_TT = grabFn(HTML, 'taskTimeline'), S_OPEN = grabFn(HTML, 'slaEditPrazoOpen'), S_COMMIT = grabFn(HTML, 'slaEditPrazoCommit');
const S_OM = grabFn(HTML, 'openMove'), S_MS = grabFn(HTML, 'moveStatus'), S_CDT = grabFn(HTML, 'canDelTask');
// C1 — cadeia de ator com clientReview guardado por identidade temporal (status aprovado + at===_fat)
ok('S1 C1 taskTimeline: fallback clientReview guardado por identidade temporal com FINAL_AT', S_TT.includes('F3.5.6A-H17') && /clientReview\.status==='aprovado'\s*&&\s*Number\(t\.clientReview\.at\)===Number\(_fat\)/.test(S_TT) && S_TT.includes('t.clientReview.byName||t.clientReview.by'));
ok('S2 C1 NÃO aceita apenas status aprovado (exige !_fby e igualdade de instante)', /_fat>0 && !_fby && t\.clientReview/.test(S_TT));
// C2 — guardas SLA
ok('S3 C2 slaEditPrazoOpen guarda isTaskCompleted (ZERO abre)', S_OPEN.includes('F3.5.6A-H17') && /isTaskCompleted\(t\)\)\{ if\(typeof flashToast/.test(S_OPEN));
ok('S4 C2 slaEditPrazoCommit guarda ANTES de qualquer DOM/update (ZERO escrita)', S_COMMIT.includes('F3.5.6A-H17') && S_COMMIT.indexOf('isTaskCompleted(_tg)') < S_COMMIT.indexOf("getElementById('slaedit-start')") && S_COMMIT.indexOf('isTaskCompleted(_tg)') < S_COMMIT.indexOf('.update(patch)'));
// C3 — guardas MOVE
ok('S5 C3 openMove guarda isTaskCompleted (não abre seletor)', S_OM.includes('F3.5.6A-H17') && /isTaskCompleted\(t\)\)\{ if\(typeof flashToast/.test(S_OM));
ok('S6 C3 moveStatus guarda ANTES de qualquer update (write-path)', S_MS.includes('F3.5.6A-H17') && S_MS.indexOf('isTaskCompleted(t)') < S_MS.indexOf('.update('));
// Render gates — "Editar prazo" e 3 superfícies de "Mover" ocultos quando concluído; "Remover" NÃO gated
ok('S7 render "Editar prazo" gated por !isTaskCompleted(t)', /canSeeAll\(state\.user\)&&!\(typeof isTaskCompleted==='function'&&isTaskCompleted\(t\)\)\)[^]{0,120}data-sla-editprazo/.test(HTML));
const moveGateRe = /\(\(typeof isTaskCompleted==='function'&&isTaskCompleted\(t\)\)\?'':'<button [^>]*data-move="'\+t\.id/g;
ok('S8 3 superfícies de "Mover" (tcv4/kbv2/detalhe) ocultas quando isTaskCompleted', (HTML.match(moveGateRe) || []).length === 3);
ok('S9 C4 "Remover" NÃO gated por isTaskCompleted (canDelTask intacto no rodapé)', /\(canDelTask\(t\)\?'<button class="btn btn-danger" data-del="'\+t\.id\+'">'\+svg\('trash'\)\+'Remover<\/button>':''\)/.test(HTML));
ok('S10 C4 canDelTask INALTERADO (sem marcador H17)', !S_CDT.includes('F3.5.6A-H17') && S_CDT.includes('canSeeAll(u)||t.by===u.id||t.assigneeId===u.id'));
// deleteTask INALTERADO
const S_DEL = grabFn(HTML, 'deleteTask');
ok('S11 deleteTask INALTERADO (sem marcador H17)', !S_DEL.includes('F3.5.6A-H17'));
// isTaskCompleted / isFullyComplete NÃO alterados por H17
const S_ITC = grabFn(HTML, 'isTaskCompleted'), S_IFC = grabFn(HTML, 'isFullyComplete');
ok('S12 isTaskCompleted / isFullyComplete NÃO alterados por H17', !S_ITC.includes('F3.5.6A-H17') && !S_IFC.includes('F3.5.6A-H17') && S_IFC.includes('if(pendingProduction(t))return false;'));
// Heranças H16 preservadas (E1..E6 + marcador)
ok('S13 H16 preservada — E1 operationalCol precedência isTaskCompleted', /if\(isTaskCompleted\(t\)\)return 'concluido';/.test(grabFn(HTML, 'operationalCol')));
ok('S14 H16 preservada — E6 timeline carimbo FONTE REAL (rodada FINAL decisionAt/recordedBy)', S_TT.includes('carimbo do marco FINAL a partir da FONTE REAL') && /decision==='approved'&&Number\(_crr\.decisionAt\)/.test(S_TT));

/* =========================== IDENTIDADE =========================== */
ok('ID1 package.json = 1.0.246 + marcador H17', PKG.version === '1.0.246' && /postcompletion-write-guards|post-completion-write-guards/.test(PKG.description || ''));
ok('ID2 package-lock 1.0.246 (raiz + packages[""])', LOCK.version === '1.0.246' && LOCK.packages[''].version === '1.0.246');
ok('ID3 marcadores herdados preservados (H16/H15/H14/H13/H12)', /final-completed-precedence/.test(PKG.description || '') && /nextaction-final-wait-text/.test(PKG.description || '') && /timeline-step7-final-wait/.test(PKG.description || '') && /timeline-honest-preenvio/.test(PKG.description || '') && /final-state-premature-fix/.test(PKG.description || ''));

console.log('================= F3.5.6A-H17 — FECHAMENTO PÓS-CONCLUSÃO (ATOR + SLA read-only + MOVE bloqueado) =================');
flog.forEach(l => console.log(l));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
