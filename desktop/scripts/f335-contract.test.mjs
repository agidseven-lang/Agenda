#!/usr/bin/env node
/* F3.3.5 — TESTES-CONTRATO (blindagem read-only) das fases F3.3.3 (#164) e F3.3.4 (item A).
   CONGELA o comportamento aprovado como invariantes executáveis: fases canônicas, perspectivas,
   contrato de SLA, contrato de notificação e contrato de campos (Worker/Android + órfãos).
   NÃO altera produto: só EXTRAI os núcleos/funções reais do renderer e verifica. Espião de rede
   explode em qualquer fetch/XHR. Zero write/provider/deploy.
   Rodar: /opt/node22/bin/node desktop/scripts/f335-contract.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DH = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const mainTs = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'main.ts'), 'utf8');
const worker = (() => { try { return fs.readFileSync(path.resolve(__dirname, '..', '..', 'cloudflare-worker.js'), 'utf8'); } catch (_) { return ''; } })();
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED (contrato é read-only)'); };
globalThis.XMLHttpRequest = function () { throw new Error('PROVIDER-CALL-DETECTED'); };

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n); } };

// ── extratores (mesmos do e2e/f334) ──
const grab = (re) => { const m = DH.match(re); return m ? m[0] : ''; };
const constArr = (n) => grab(new RegExp('const ' + n + '\\s*=\\s*\\[[\\s\\S]*?\\];'));
const constObj = (n) => grab(new RegExp('const ' + n + '\\s*=\\s*\\{[\\s\\S]*?\\n\\};'));
const fnDecl = (n) => { const m = DH.match(new RegExp('(?:async )?function ' + n + '\\s*\\([^)]*\\)\\s*\\{')); if (!m) return ''; let s = DH.indexOf(m[0]), d = 0; for (let i = s + m[0].length - 1; i < DH.length; i++) { const c = DH[i]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return DH.slice(s, i + 1); } } return ''; };
const oneLine = (n) => grab(new RegExp('function ' + n + '\\([^)]*\\)\\{.*\\}'));
const slice = (B, E) => { const i = DH.indexOf(B), j = DH.indexOf(E); return (i < 0 || j < 0) ? '' : DH.slice(i + B.length, j); };

// ════════ CONTRATO 1 — FLUXO CANÔNICO (snapshot determinístico das fases) ════════
let flow = null, ferr = null;
try {
  const pieces = [
    constArr('SECTORS'), 'const SECTOR_ALIAS=' + ((DH.match(/const SECTOR_ALIAS=\{[\s\S]*?\};/) || ['const SECTOR_ALIAS={};'])[0].replace(/^const SECTOR_ALIAS=/, '')),
    constArr('CLIENT_COLS'), constObj('TASK_PHASE'),
    oneLine('secOf'), oneLine('hasDesigner'), oneLine('designerOf'), oneLine('designerCol'),
    oneLine('pendingLegend'), oneLine('pendingFeed'), oneLine('pendingStory'), oneLine('pendingProduction'), oneLine('designerDelivered'),
    fnDecl('clientApprovalPhaseOf'), fnDecl('pendingClientItems'), fnDecl('hasTeamAdjustedAwaiting'), fnDecl('allPhaseItemsApproved'),
    oneLine('hasPendingItemRevision'),
    oneLine('flowCompletedSignal'), oneLine('flowSentToClientSignal'), oneLine('flowClientChangesSignal'),
    fnDecl('isTaskCompleted'), fnDecl('isFullyComplete'), fnDecl('clientCol'), fnDecl('socialCol'),
    fnDecl('deriveCanonicalTaskState'),
    'return { deriveCanonicalTaskState, clientCol, socialCol, designerCol, TASK_PHASE };',
  ];
  flow = new Function(pieces.join('\n'))();
} catch (e) { ferr = e.message; }
ok('contrato/fluxo: engine canônico avaliável (sem ReferenceError)', !!flow && !ferr);
if (!flow) { console.log('  erro:', ferr); }
else {
  const P = flow.TASK_PHASE;
  const cron = (o) => Object.assign({ sector: 'cronograma' }, o);
  // SNAPSHOT congelado das 8 fases canônicas (qualquer mudança futura quebra o contrato):
  const cases = [
    ['planning', cron({}), P.PLANNING],
    ['awaiting_designer', cron({ designerAssignment: { designerId: 'D' }, designerFlowStatus: 'afazer', assigneeId: 'D' }), P.AWAITING_DESIGNER],
    ['designer_producing', cron({ designerAssignment: { designerId: 'D' }, designerFlowStatus: 'andamento', assigneeId: 'D' }), P.DESIGNER_PRODUCING],
    ['designer_revising', cron({ designerAssignment: { designerId: 'D' }, designerFlowStatus: 'revisao', assigneeId: 'D' }), P.DESIGNER_REVISING],
    ['designer_delivered', cron({ designerAssignment: { designerId: 'D' }, designerFlowStatus: 'concluido', assigneeId: 'D' }), P.DESIGNER_DELIVERED],
    ['awaiting_client_approval', cron({ designerAssignment: { designerId: 'D' }, cronStatus: 'reenviado_cliente' }), P.AWAITING_CLIENT_APPROVAL],
    ['client_requested_changes', cron({ designerAssignment: { designerId: 'D' }, clientReview: { status: 'revisao' } }), P.CLIENT_REQUESTED_CHANGES],
    ['completed', cron({ finalApprovalCompleted: true }), P.COMPLETED],
  ];
  cases.forEach(([name, t, exp]) => ok('fase[' + name + '] congelada', (flow.deriveCanonicalTaskState(t) || {}).phase === exp));
  // perspectivas (colunas por setor) em cenários-âncora
  const prod = cron({ designerAssignment: { designerId: 'D' }, designerFlowStatus: 'andamento', assigneeId: 'D' });
  ok('perspectiva Designer em produção = andamento', flow.designerCol(prod) === 'andamento');
  ok('perspectiva Social não-concluída ≠ concluido', flow.socialCol(prod) !== 'concluido');
  const done = cron({ finalApprovalCompleted: true });
  ok('perspectiva COMPLETED: clientCol=concluido + socialCol=concluido', flow.clientCol(done) === 'concluido' && flow.socialCol(done) === 'concluido');
  ok('sem conclusão prematura (em produção ≠ concluido em nenhuma perspectiva)', flow.clientCol(prod) !== 'concluido' && flow.socialCol(prod) !== 'concluido');
}

// ════════ CONTRATO 2 — SLA (PANEL-CORE) ════════
const panel = slice('/* F3.3.2-PANEL-CORE BEGIN */', '/* F3.3.2-PANEL-CORE END */');
const sla = new Function(panel + '\n;return { resolveTaskDisplayState, slaPanelRow, SLA_PANEL_WARN_MS, SLA_PANEL_GRACE_MS };')();
const NOW = 1781800000000, MIN = 60000, dt = (d, t) => { if (!d) return 0; const [Y, M, D] = String(d).split('-').map(Number); const [h, m] = String(t || '23:59').split(':').map(Number); return Date.UTC(Y, (M || 1) - 1, D || 1, h || 0, m || 0); };
const desTask = (planDueAt) => ({ id: 'S', sector: 'cronograma', assigneeId: 'D', designerAssignment: { designerId: 'D' }, designerSla: { planDueAt } });
ok('SLA: tarefa SEM designer não gera linha pessoal', sla.slaPanelRow({ id: 'X', sector: 'cronograma', designerSla: { planDueAt: NOW + 10 * MIN } }, NOW, dt) === null);
ok('SLA: tarefa SEM designerSla não entra no painel (nasce só após atribuição)', sla.resolveTaskDisplayState({ id: 'X', designerAssignment: { designerId: 'D' } }, NOW, dt).inPanel === false);
ok('SLA: janela laranja = 30min + tolerância = 10min (congelado)', sla.SLA_PANEL_WARN_MS === 30 * MIN && sla.SLA_PANEL_GRACE_MS === 10 * MIN);
ok('SLA: T-31min = running (sem laranja)', sla.resolveTaskDisplayState(desTask(NOW + 31 * MIN), NOW, dt).state === 'running');
ok('SLA: T-30min = laranja/warning', sla.resolveTaskDisplayState(desTask(NOW + 30 * MIN), NOW, dt).state === 'warning');
ok('SLA: T (prazo) = vermelho/overdue', sla.resolveTaskDisplayState(desTask(NOW), NOW, dt).state === 'overdue');
ok('SLA: T+10min = crítico', sla.resolveTaskDisplayState(desTask(NOW - 10 * MIN), NOW, dt).critical === true);
ok('SLA: T+9min = vermelho NÃO-crítico', sla.resolveTaskDisplayState(desTask(NOW - 9 * MIN), NOW, dt).critical === false);

// ════════ CONTRATO 3 — NOTIFICAÇÃO (NOTIF-CORE) ════════
const ncore = slice('/* F3.3.3-NOTIF-CORE BEGIN */', '/* F3.3.3-NOTIF-CORE END */');
const nf = new Function(ncore + '\n;return { resolveNotificationTargets };')();
const tk = { id: 'T', assigneeId: 'DES', by: 'SOC', designerAssignment: { designerId: 'DES' } };
ok('NOTIF: SLA pessoal só p/ designer responsável', nf.resolveNotificationTargets({ eventType: 'sla_overdue', task: tk, currentUser: { id: 'DES' } }).shouldNotifyCurrentUser === true);
ok('NOTIF: Social NÃO recebe SLA pessoal (mesmo vendo tudo)', nf.resolveNotificationTargets({ eventType: 'sla_overdue', task: tk, currentUser: { id: 'SOC' }, currentUserCanSeeAll: true }).shouldNotifyCurrentUser === false);
ok('NOTIF: Admin NÃO recebe SLA pessoal', nf.resolveNotificationTargets({ eventType: 'sla_warning', task: tk, currentUser: { id: 'ADM' }, currentUserCanSeeAll: true }).shouldNotifyCurrentUser === false);
ok('NOTIF: fluxo/status p/ equipe (Social)', nf.resolveNotificationTargets({ eventType: 'flow_in_review', task: tk, currentUser: { id: 'SOC' } }).shouldNotifyCurrentUser === true);
ok('NOTIF: fluxo p/ supervisão (vê tudo)', nf.resolveNotificationTargets({ eventType: 'flow_completed', task: tk, currentUser: { id: 'Z' }, currentUserCanSeeAll: true }).shouldNotifyCurrentUser === true);
// contrato visual do toast (estático no renderer)
ok('NOTIF: toast premium (card largo 420 + foto real + sem reticência)', /\.ntf\{[^}]*width:420px/.test(DH) && /function resolveUserIdentity\(/.test(DH) && !/\.ntf-ds\{[^}]*text-overflow:ellipsis/.test(DH));
ok('NOTIF: canal app-aberto = toast in-app; nativo só minimizado/bandeja (windowActive sem foco)', /w\.isVisible\(\) && !w\.isMinimized\(\)\);/.test(mainTs) && /webContents\.send\("notif-toast"/.test(mainTs) && /new Notification\(/.test(mainTs));

// ════════ CONTRATO 4 — CAMPOS Worker/Android (NÃO remover sem auditoria cross-platform) ════════
['operationalStatus', 'clientWorkflowStage', 'designerWorkflowStage', 'socialFlowStatus'].forEach((f) => {
  ok('campo contrato presente no renderer: ' + f, DH.indexOf(f) >= 0);
  ok('campo contrato referenciado no Worker (não remover): ' + f, worker === '' || worker.indexOf(f) >= 0);
});

// ════════ CONTRATO 5 — CAMPOS ÓRFÃOS (mantidos por decisão; documentados) ════════
['socialWorkflowStage', 'pendingDesignerDelivery', 'pendingSocialReview', 'finalApprovalRequired', 'designerResponsibleId'].forEach((f) => {
  ok('campo órfão ainda presente (mantido, não removido): ' + f, DH.indexOf(f) >= 0);
});

// ════════ CONTRATO 6 — ITENS CONGELADOS (presença read-only) ════════
ok('congelado: Kanban Opção 2 (themes-list + CARD-FIT)', /kbv2-themes-list/.test(DH) && /CARD-FIT-NOTEBOOK/.test(DH));
ok('congelado: login limpo (sino/avatar/monitor removidos)', /getElementById\('sla-monitor'\)/.test(DH) && /getElementById\('slaib-bell'\)/.test(DH));
ok('congelado: SLA Monitor calmo "Tudo em dia" + contador ceil', /if\(!d\|\|!d\.total\) return 'Tudo em dia';/.test(DH) && /function slaCount\(ms\)\{ return slaMMSSfmt\(ms,'up'\); \}/.test(DH));
ok('congelado: F3.3.4 item A isTaskCompleted (fonte única)', /function isTaskCompleted\(t\)\{/.test(DH) && /function flowCompletedSignal\(t\)\{return isTaskCompleted\(t\);\}/.test(DH));
ok('congelado: WhatsApp premium (saveCardImage no preload)', fs.readFileSync(path.resolve(__dirname, '..', 'src', 'preload', 'preload.ts'), 'utf8').indexOf('saveCardImage') >= 0);

console.log(`\nF3.3.5 CONTRACT RESULT: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error::F3.3.5 CONTRATO FALHOU — comportamento aprovado divergiu'); process.exit(1); }
console.log('F3.3.5 OK — comportamento aprovado (F3.3.3 #164 + F3.3.4 item A) congelado como contrato. Read-only.');
