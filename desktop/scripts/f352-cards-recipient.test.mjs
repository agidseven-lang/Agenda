#!/usr/bin/env node
/* =====================================================================================
 * F3.5.2 — GATE 5 · DESTINATÁRIO CORRETO da notificação de Edição de Cards (7 checks)
 * -------------------------------------------------------------------------------------
 * O produtor ISOLADO (cardsRules.cardsEmissionsFor) roteia a notificação pela MESMA porta
 * pessoal do SLA (slaRules.resolveNotificationTargets, eventType sla_*): dispara SOMENTE p/ o
 * DESIGNER RESPONSÁVEL (designerAssignment.designerId, senão assigneeId). Prova, sobre o código
 * REAL (require direto de cardsRules.js + slaRules.js), os 7 comportamentos de destinatário:
 *   (1) o designer designado RECEBE;                 (2) outro designer NÃO recebe;
 *   (3) o criador (Social) NÃO recebe (salvo se for também o responsável — contrato existente);
 *   (4) o cliente NUNCA recebe;                      (5) sem designer ⇒ ninguém é alertado;
 *   (6) troca de designer INVALIDA o destinatário anterior (novo passa a receber);
 *   (7) troca de prazo mantém SÓ o novo destinatário + o novo prazo (dedup recalcula).
 *
 * Rodar: node desktop/scripts/f352-cards-recipient.test.mjs
 * ===================================================================================== */
import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const S = require(path.join(DESK, 'src', 'main', 'slaRules.js'));    // roteador pessoal (byte-idêntico à base)
const C = require(path.join(DESK, 'src', 'main', 'cardsRules.js'));  // produtor ISOLADO de Edição de Cards

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const dtMs = S.dtMs, MIN = 60000;
const D = dtMs('2026-08-01', '15:00');
const DESIGNER = 'designerA', OTHER = 'designerB', SOCIAL = 'socialX', CLIENT = 'clienteZ';

// Card como saveCardsBatch grava: designerAssignment.designerId (responsável), assigneeId espelho,
// by/createdBy/socialOwner = criador Social, internal:true. SEM designerSla / token / client-flow.
function card(extra) {
  return Object.assign({
    id: 't1', sector: 'edicao_cards', title: 'Card X', client: 'Cliente Y', status: 'afazer',
    dueDate: '2026-08-01', dueTime: '15:00', due: '2026-08-01',
    assignee: 'Des A', assigneeId: DESIGNER,
    by: SOCIAL, createdBy: SOCIAL, socialOwner: SOCIAL,
    designerAssignment: { designerId: DESIGNER, designerName: 'Des A' },
    internal: true, cardDeadlineRev: 1,
  }, extra || {});
}
const emit = (c, uid, now) => C.cardsEmissionsFor(c, uid, now, dtMs);

/* ── (1) designer designado RECEBE ────────────────────────────────────────────────── */
const e1 = emit(card(), DESIGNER, D - 30 * MIN);
ok('(1) designer designado RECEBE (1 payload)', e1.length === 1);
ok('(1b) payload roteado ao designer (targetUserId)', e1[0] && e1[0].targetUserId === DESIGNER);
ok('(1c) notificationType sla_personal (porta pessoal)', e1[0] && e1[0].notificationType === 'sla_personal');

/* ── (2) outro designer NÃO recebe ────────────────────────────────────────────────── */
ok('(2) outro designer NÃO recebe (0 payloads)', emit(card(), OTHER, D - 30 * MIN).length === 0);
ok('(2b) outro designer também não recebe no T-10 (vermelha)', emit(card(), OTHER, D - 10 * MIN).length === 0);

/* ── (3) criador Social NÃO recebe (salvo se for também o responsável) ─────────────── */
ok('(3) criador Social (by/socialOwner) NÃO recebe (não é o responsável)', emit(card(), SOCIAL, D - 30 * MIN).length === 0);
// contrato existente: se o criador FOR também o designer responsável, recebe como responsável.
const selfCard = card({ by: DESIGNER, createdBy: DESIGNER, socialOwner: DESIGNER });
ok('(3b) criador que TAMBÉM é o responsável recebe (contrato existente do SLA pessoal)', emit(selfCard, DESIGNER, D - 30 * MIN).length === 1);

/* ── (4) cliente NUNCA recebe ─────────────────────────────────────────────────────── */
ok('(4) cliente NUNCA recebe (uid do cliente ⇒ 0)', emit(card(), CLIENT, D - 30 * MIN).length === 0);
ok('(4b) targetUserId é o designer — jamais o cliente', e1[0] && e1[0].targetUserId === DESIGNER && e1[0].targetUserId !== CLIENT);
// isolamento do fluxo-cliente: o payload NÃO carrega token/link/clientFlow (produtor de cards é interno).
ok('(4c) payload sem campos de fluxo-cliente (token/clientReviewUrl/cronStatus)',
  e1[0] && !('clientReviewToken' in e1[0]) && !('clientReviewUrl' in e1[0]) && !('cronStatus' in e1[0]) && !('shareToken' in e1[0]));

/* ── (5) sem designer ⇒ ninguém é alertado ────────────────────────────────────────── */
const noDes = card({ designerAssignment: {}, assignee: '', assigneeId: '' });
ok('(5) sem designer ⇒ o próprio Social não recebe', emit(noDes, SOCIAL, D - 30 * MIN).length === 0);
ok('(5b) sem designer ⇒ ninguém (qualquer uid) é alertado', emit(noDes, DESIGNER, D - 30 * MIN).length === 0 && emit(noDes, OTHER, D - 30 * MIN).length === 0);

/* ── (6) troca de designer INVALIDA o destinatário anterior ───────────────────────── */
const reassigned = card({ designerAssignment: { designerId: OTHER, designerName: 'Des B' }, assignee: 'Des B', assigneeId: OTHER });
ok('(6) após troca A→B, o designer ANTERIOR (A) NÃO recebe mais', emit(reassigned, DESIGNER, D - 30 * MIN).length === 0);
ok('(6b) após troca A→B, o NOVO designer (B) passa a receber', emit(reassigned, OTHER, D - 30 * MIN).length === 1);
ok('(6c) o payload agora é roteado a B (targetUserId)', (emit(reassigned, OTHER, D - 30 * MIN)[0] || {}).targetUserId === OTHER);

/* ── (7) troca de prazo mantém SÓ o novo destinatário + o novo prazo ──────────────── */
const D2 = dtMs('2026-08-01', '16:00');                 // novo prazo = 16:00
const rescheduled = card({ dueTime: '16:00', cardDeadlineRev: 2 });
const e7 = emit(rescheduled, DESIGNER, D2 - 30 * MIN);  // amarela na NOVA janela (16:00−30)
ok('(7) novo prazo: designer responsável recebe na NOVA janela', e7.length === 1 && e7[0].targetUserId === DESIGNER);
ok('(7b) dedupKey reflete o NOVO prazo (finishMs=D2) — não o antigo', String(e7[0].dedupKey).indexOf(String(D2)) >= 0 && String(e7[0].dedupKey).indexOf(String(D)) < 0);
ok('(7c) context do payload mostra o NOVO prazo (slaibFmtHM(D2)) — não o antigo',
  String(e7[0].context).indexOf(S.slaibFmtHM(D2)) >= 0 && String(e7[0].context).indexOf(S.slaibFmtHM(D)) < 0);
ok('(7d) na janela ANTIGA (D−30) o card reprogramado NÃO emite (prazo mudou)', emit(rescheduled, DESIGNER, D - 30 * MIN).length === 0);
ok('(7e) troca de prazo NÃO adiciona destinatário: outro designer segue sem receber', emit(rescheduled, OTHER, D2 - 30 * MIN).length === 0);

console.log('\nF3.5.2 cards-recipient: ' + pass + ' passaram, ' + fail + ' falharam (total ' + (pass + fail) + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
process.exit(0);
