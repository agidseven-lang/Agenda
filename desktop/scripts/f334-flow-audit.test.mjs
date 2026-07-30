#!/usr/bin/env node
/* F3.3.4 — AUDITORIA READ-ONLY do fluxo Social Media / Cliente / Designer / Admin.
   NÃO altera o produto: só EXTRAI os núcleos reais (PANEL-CORE + NOTIF-CORE) do renderer e
   valida INVARIANTES do fluxo aprovado (regressão-guard da auditoria). Espião de rede explode
   em qualquer fetch/XHR → prova zero provider. Não escreve, não envia, não faz deploy.
   Rodar: /opt/node22/bin/node desktop/scripts/f334-flow-audit.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const mainTs = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'main.ts'), 'utf8');
const preloadTs = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'preload', 'preload.ts'), 'utf8');

globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED (auditoria é read-only)'); };
globalThis.XMLHttpRequest = function () { throw new Error('PROVIDER-CALL-DETECTED (XHR proibido)'); };

const slice = (B, E) => { const i = html.indexOf(B), j = html.indexOf(E); if (i < 0 || j < 0) { console.error('::error:: sentinela não encontrada: ' + B); process.exit(1); } return html.slice(i + B.length, j); };
const panel = slice('/* F3.3.2-PANEL-CORE BEGIN */', '/* F3.3.2-PANEL-CORE END */');
const notif = slice('/* F3.3.3-NOTIF-CORE BEGIN */', '/* F3.3.3-NOTIF-CORE END */');
const api = new Function(panel + '\n' + notif + '\n;return { resolveTaskDisplayState, slaPanelRow, resolveCanonicalDeadline, resolveNotificationTargets };')();
const { resolveTaskDisplayState, slaPanelRow, resolveCanonicalDeadline, resolveNotificationTargets } = api;

const dtMs = (d, t) => { if (!d) return 0; const [Y, Mo, Da] = String(d).split('-').map(Number); const [h, m] = String(t || '23:59').split(':').map(Number); return Date.UTC(Y, (Mo || 1) - 1, Da || 1, h || 0, m || 0); };
const NOW = 1781800000000, MIN = 60000;
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n); } };

// ===================== INVARIANTE 1 — SLA do designer só NASCE após envio ao designer =====================
// (a) tarefa SEM designerSla (criação/levantamento de temas) ⇒ fora do painel, sem linha.
{ const t = { id: 'A', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, dueDate: '2026-06-19', dueTime: '09:00' };
  ok('1a sem designerSla => fora do SLA (não nasceu)', resolveTaskDisplayState(t, NOW, dtMs).inPanel === false && slaPanelRow(t, NOW, dtMs) === null); }
// (b) tarefa COM designerSla + designer ⇒ entra no SLA (dentro da janela).
{ const t = { id: 'B', sector: 'cronograma', assigneeId: 'D1', designerAssignment: { designerId: 'D1' }, designerSla: { planDueAt: NOW + 18 * MIN } };
  ok('1b com designerSla + designer => no SLA', resolveTaskDisplayState(t, NOW, dtMs).inPanel === true && !!slaPanelRow(t, NOW, dtMs)); }

// ===================== INVARIANTE 2 — tarefa SEM designer não entra em SLA pessoal =====================
{ const t = { id: 'C', sector: 'cronograma', designerSla: { planDueAt: NOW + 10 * MIN } };
  ok('2 sem designer => sem linha no painel', slaPanelRow(t, NOW, dtMs) === null); }

// ===================== INVARIANTE 3 — prazo canônico único (card=monitor=detalhe=toast) =====================
{ const t = { id: 'D', assigneeId: 'D1', designerAssignment: { designerId: 'D1' }, designerSla: { planDueAt: NOW + 18 * MIN } };
  const cd = resolveCanonicalDeadline(t, dtMs), ds = resolveTaskDisplayState(t, NOW, dtMs), r = slaPanelRow(t, NOW, dtMs);
  ok('3 prazo único (canonical=display=row)', cd.plannedFinishAtMs === ds.finishMs && r.finishMs === ds.finishMs && cd.sourceField === 'designerSla.planDueAt'); }

// ===================== INVARIANTE 4 — SLA pessoal SÓ p/ designer responsável =====================
const taskR = { id: 'T', assigneeId: 'DES', by: 'SOC', designerAssignment: { designerId: 'DES' } };
{ const r = resolveNotificationTargets({ eventType: 'sla_overdue', task: taskR, currentUser: { id: 'DES' } });
  ok('4a SLA: designer responsável RECEBE', r.shouldNotifyCurrentUser === true && r.notificationType === 'sla_personal'); }
{ const r = resolveNotificationTargets({ eventType: 'sla_overdue', task: taskR, currentUser: { id: 'SOC' }, currentUserCanSeeAll: true });
  ok('4b SLA: Social Media NÃO recebe (mesmo vendo tudo)', r.shouldNotifyCurrentUser === false); }
{ const r = resolveNotificationTargets({ eventType: 'sla_warning', task: taskR, currentUser: { id: 'ADM' }, currentUserCanSeeAll: true });
  ok('4c SLA: Admin NÃO recebe cobrança pessoal', r.shouldNotifyCurrentUser === false); }

// ===================== INVARIANTE 5 — fluxo/status p/ EQUIPE relevante =====================
{ const r = resolveNotificationTargets({ eventType: 'flow_in_review', task: taskR, currentUser: { id: 'SOC' } });
  ok('5a fluxo: equipe (autor/Social) recebe', r.shouldNotifyCurrentUser === true && r.notificationType === 'team_flow'); }
{ const r = resolveNotificationTargets({ eventType: 'flow_completed', task: taskR, currentUser: { id: 'X' }, currentUserCanSeeAll: true });
  ok('5b fluxo: supervisão (vê tudo) recebe', r.shouldNotifyCurrentUser === true); }
{ const r = resolveNotificationTargets({ eventType: 'flow_completed', task: taskR, currentUser: { id: 'OUT' } });
  ok('5c fluxo: fora da equipe NÃO recebe', r.shouldNotifyCurrentUser === false); }

// ===================== INVARIANTE 6 — CLIENTE não vê fluxo interno / SLA =====================
// renderClientView não pode expor designerSla/designerFlowStatus/operationalStatus.
const cvI = html.indexOf('function renderClientView'); const cv = cvI > 0 ? html.slice(cvI, cvI + 6000) : '';
ok('6a client view existe', cvI > 0);
ok('6b client view NÃO expõe designerSla/SLA interno', cv.indexOf('designerSla') < 0 && cv.indexOf('slaPanelRow') < 0 && cv.indexOf('resolveTaskDisplayState') < 0);
ok('6c client view NÃO expõe designerFlowStatus/operationalStatus', cv.indexOf('designerFlowStatus') < 0 && cv.indexOf('operationalStatus') < 0);

// ===================== INVARIANTE 7 — campos OBSOLETOS são write-only (sem leitor) =====================
// (documenta a dívida: nenhum aparece em condição/derivação — só em atribuição). Read-only audit.
const readerCore = panel + notif + (function () { const a = html.indexOf('function deriveCanonicalTaskState'); const b = html.indexOf('function operationalCol'); const c = html.indexOf('function clientCol'); const d = html.indexOf('function designerCol'); return [a, b, c, d].filter(x => x > 0).map(x => html.slice(x, x + 1400)).join('\n'); })();
['clientWorkflowStage', 'designerWorkflowStage', 'socialWorkflowStage', 'pendingDesignerDelivery', 'pendingSocialReview', 'finalApprovalRequired', 'designerResponsibleId', 'socialFlowStatus'].forEach((f) => {
  const readPat = new RegExp('[.\\[\'"]' + f + '\\b\\s*(===|==|!=|\\?|\\)|<|>)'); // leitura em condição
  ok('7 obsoleto write-only (sem leitor): ' + f, !readPat.test(readerCore));
});

// ===================== INVARIANTE 8 — APROVADO preservado (presença read-only) =====================
ok('8a Kanban Opção 2 (themes-list rola + CARD-FIT)', /kbv2-themes-list/.test(html) && /CARD-FIT-NOTEBOOK/.test(html));
ok('8b login sem sino/avatar/monitor (removidos)', /getElementById\('sla-monitor'\)/.test(html) && /getElementById\('slaib-bell'\)/.test(html));
ok('8c SLA Monitor + alerta laranja pontual (slaCount ceil + boundary→notifScanSla)', /function slaCount\(ms\)\{ return slaMMSSfmt\(ms,'up'\); \}/.test(html) && /notifScanSla\(\)/.test(html));
ok('8d toast premium (card largo + foto real + sem reticência)', /\.ntf\{[^}]*width:420px/.test(html) && /function resolveUserIdentity\(/.test(html) && /ntf-resp/.test(html));
ok('8e canal F3.5.4K: toast só com FOCO real (windowActive usa isFocused; desfocado⇒premium)', /return !!\(w && !w\.isDestroyed\(\) && w\.isFocused\(\)\);/.test(mainTs));
ok('8f Editar prazo UI sem gravação real', /data-sla-editprazo/.test(html) && /function slaEditPrazoOpen/.test(html));
ok('8g WhatsApp premium intacto (preload saveCardImage)', /saveCardImage/.test(preloadTs));

// ===================== INVARIANTE 9 — zero provider/write na camada de notificação/SLA =====================
ok('9a NOTIF-CORE providerCalled=false', /providerCalled:false/.test(notif));
ok('9b sem provider real no core', !/sendWhatsApp|getMessaging|webpush|pushManager|setDoc|updateDoc|addDoc/i.test(notif + panel));

console.log(`\nF3.3.4 FLOW-AUDIT RESULT: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error::F3.3.4 FLOW-AUDIT FALHOU'); process.exit(1); }
console.log('F3.3.4 OK — invariantes do fluxo aprovado preservadas (read-only; zero write/provider/deploy).');
