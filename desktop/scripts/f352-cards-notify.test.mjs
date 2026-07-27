#!/usr/bin/env node
/* =====================================================================================
 * F3.5.2 — EDIÇÃO DE CARDS · testes do PRODUTOR DE NOTIFICAÇÃO ISOLADO (T-30/T-10) + ISOLAMENTO.
 *
 * Testa o código REAL desktop/src/main/slaRules.js (require direto, CommonJS):
 *  - cardsDisplayState/cardsEmissionsFor/cardsNextBoundaryMs (amarela T-30, vermelha T-10, vermelha
 *    substitui amarela, dedup própria, criado-dentro-da-janela, conclusão cancela, prazo recalcula).
 *  - ISOLAMENTO: o produtor COMPARTILHADO (slaEmissionsFor) nunca emite p/ edicao_cards; os thresholds
 *    e emissões de cronograma/edicao_midia/roteiro permanecem os aprovados (byte-idênticos).
 *
 * Rodar: node desktop/scripts/f352-cards-notify.test.mjs   (exit 0 = todos verdes)
 * ===================================================================================== */
import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const S = require(path.join(DESK, 'src', 'main', 'slaRules.js'));   // motor de SLA (byte-idêntico à base)
const C = require(path.join(DESK, 'src', 'main', 'cardsRules.js')); // produtor ISOLADO de Edição de Cards

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push('FAIL: ' + n); } };

const dtMs = S.dtMs;
const MIN = 60000;
const D = dtMs('2026-08-01', '15:00');            // prazo do card = 15:00 (tz-local; math relativa)
const UID = 'designerA';
function card(extra) {
  return Object.assign({
    id: 't1', sector: 'edicao_cards', title: 'Card X', client: 'Cliente Y', status: 'afazer',
    dueDate: '2026-08-01', dueTime: '15:00', due: '2026-08-01',
    designerAssignment: { designerId: UID, designerName: 'Des A' },
  }, extra || {});
}

/* ── 1. Identidade de setor + tabela SLA ──────────────────────────────────────────── */
ok('isCardsSector edicao_cards=true', C.isCardsSector({ sector: 'edicao_cards' }) === true);
ok('isCardsSector cronograma=false', C.isCardsSector({ sector: 'cronograma' }) === false);
ok('isCardsSector edicao_midia=false', C.isCardsSector({ sector: 'edicao_midia' }) === false);
ok('isCardsSector roteiro=false', C.isCardsSector({ sector: 'roteiro' }) === false);
ok('edicao_cards NÃO está em SECTOR_SLA', S.SECTOR_SLA['edicao_cards'] === undefined);
ok('SECTOR_SLA cronograma warning=30 (inalterado)', S.SECTOR_SLA.cronograma.warningMinutes === 30);
ok('SECTOR_SLA cronograma grace=10 (inalterado)', S.SECTOR_SLA.cronograma.overdueGraceMinutes === 10);
ok('SECTOR_SLA edicao_midia 40/20 (inalterado)', S.SECTOR_SLA.edicao_midia.warningMinutes === 40 && S.SECTOR_SLA.edicao_midia.overdueGraceMinutes === 20);
ok('SECTOR_SLA roteiro designerSla=false (inalterado)', S.SECTOR_SLA.roteiro.designerSla === false);

/* ── 2. cardsDisplayState: bandas T-30 / T-10 ─────────────────────────────────────── */
ok('antes de T-30 = running/inPanel:false', (() => { const d = C.cardsDisplayState(card(), D - 60 * MIN, dtMs); return d.state === 'running' && d.inPanel === false; })());
ok('exatamente T-30 = warning/laranja/inPanel', (() => { const d = C.cardsDisplayState(card(), D - 30 * MIN, dtMs); return d.state === 'warning' && d.sev === 'laranja' && d.inPanel === true; })());
ok('T-20 (entre) = warning', (() => { const d = C.cardsDisplayState(card(), D - 20 * MIN, dtMs); return d.state === 'warning'; })());
ok('T-11 ainda = warning', (() => { const d = C.cardsDisplayState(card(), D - 11 * MIN, dtMs); return d.state === 'warning'; })());
ok('exatamente T-10 = overdue/vermelho/inPanel', (() => { const d = C.cardsDisplayState(card(), D - 10 * MIN, dtMs); return d.state === 'overdue' && d.sev === 'vermelho' && d.inPanel === true; })());
ok('T-5 = overdue', (() => { const d = C.cardsDisplayState(card(), D - 5 * MIN, dtMs); return d.state === 'overdue'; })());
ok('no prazo (T-0) = overdue', (() => { const d = C.cardsDisplayState(card(), D, dtMs); return d.state === 'overdue'; })());
ok('após o prazo = overdue (dedup controla repetição)', (() => { const d = C.cardsDisplayState(card(), D + 30 * MIN, dtMs); return d.state === 'overdue'; })());
ok('concluída (status concluido) = inPanel:false', (() => { const d = C.cardsDisplayState(card({ status: 'concluido' }), D - 10 * MIN, dtMs); return d.inPanel === false; })());
ok('cancelada (status cancelado) = inPanel:false', (() => { const d = C.cardsDisplayState(card({ status: 'cancelado' }), D - 10 * MIN, dtMs); return d.inPanel === false; })());
ok('sem prazo = state none', (() => { const d = C.cardsDisplayState(card({ dueDate: '', due: '' }), D - 10 * MIN, dtMs); return d.state === 'none' && d.inPanel === false; })());
ok('setor não-cards = state none', (() => { const d = C.cardsDisplayState({ sector: 'cronograma', dueDate: '2026-08-01', dueTime: '15:00' }, D - 10 * MIN, dtMs); return d.inPanel === false; })());

/* ── 3. cardsEmissionsFor: emissão amarela/vermelha ───────────────────────────────── */
const eW = C.cardsEmissionsFor(card(), UID, D - 30 * MIN, dtMs);
ok('T-30 emite 1 payload', eW.length === 1);
ok('T-30 eventType sla_cards_warning', eW[0] && eW[0].eventType === 'sla_cards_warning');
ok('T-30 severity warning (amarela)', eW[0] && eW[0].severity === 'warning');
ok('T-30 eventType casa /^sla_/ (identidade toast)', /^sla_/.test(eW[0].eventType));
ok('T-30 dedupKey começa cards_warning:', String(eW[0].dedupKey).startsWith('cards_warning:'));
ok('T-30 targetUserId = designer', eW[0].targetUserId === UID);
ok('T-30 action.deep = detail/id', eW[0].action && eW[0].action.deep === 'detail/t1');
const eR = C.cardsEmissionsFor(card(), UID, D - 10 * MIN, dtMs);
ok('T-10 emite 1 payload', eR.length === 1);
ok('T-10 eventType sla_cards_overdue', eR[0] && eR[0].eventType === 'sla_cards_overdue');
ok('T-10 severity critical (vermelha)', eR[0] && eR[0].severity === 'critical');
ok('T-10 dedupKey começa cards_overdue:', String(eR[0].dedupKey).startsWith('cards_overdue:'));
ok('antes de T-30 NÃO emite', C.cardsEmissionsFor(card(), UID, D - 60 * MIN, dtMs).length === 0);
ok('não-designer NÃO recebe (pessoal)', C.cardsEmissionsFor(card(), 'outroUser', D - 30 * MIN, dtMs).length === 0);
ok('concluída NÃO emite', C.cardsEmissionsFor(card({ status: 'concluido' }), UID, D - 10 * MIN, dtMs).length === 0);

/* ── 4. Vermelha substitui amarela; nunca as duas juntas; criado-dentro-da-janela ──── */
ok('vermelha SUBSTITUI amarela: no T-10 só vermelha (0 amarela)', (() => { const e = C.cardsEmissionsFor(card(), UID, D - 8 * MIN, dtMs); return e.length === 1 && e[0].eventType === 'sla_cards_overdue'; })());
ok('nunca amarela+vermelha simultâneas', (() => { const e = C.cardsEmissionsFor(card(), UID, D - 5 * MIN, dtMs); return e.filter(p => p.eventType === 'sla_cards_warning').length === 0; })());
ok('criado dentro de [T-30,T-11) → 1 amarela', C.cardsEmissionsFor(card(), UID, D - 25 * MIN, dtMs).filter(p => p.eventType === 'sla_cards_warning').length === 1);
ok('criado com ≤T-10 → 1 vermelha, 0 amarela', (() => { const e = C.cardsEmissionsFor(card(), UID, D - 3 * MIN, dtMs); return e.length === 1 && e[0].eventType === 'sla_cards_overdue'; })());

/* ── 5. Dedup: dueAt (prazo) + revisão ────────────────────────────────────────────── */
const kD1 = C.cardsEmissionsFor(card(), UID, D - 30 * MIN, dtMs)[0].dedupKey;
const kD2 = C.cardsEmissionsFor(card({ dueDate: '2026-08-01', dueTime: '16:00', due: '2026-08-01' }), UID, (dtMs('2026-08-01', '16:00')) - 30 * MIN, dtMs)[0].dedupKey;
ok('mudar o PRAZO muda a dedupKey (recalcula)', kD1 !== kD2);
const kRev1 = C.cardsEmissionsFor(card(), UID, D - 30 * MIN, dtMs)[0].dedupKey;
const kRev2 = C.cardsEmissionsFor(card({ cardDeadlineRev: 2 }), UID, D - 30 * MIN, dtMs)[0].dedupKey;
ok('mudar a revisão de prazo muda a dedupKey', kRev1 !== kRev2);
ok('dedupKey inclui o finishMs (prazo)', String(kD1).indexOf(String(D)) >= 0);

/* ── 6. cardsNextBoundaryMs (wake no MESMO timer) ─────────────────────────────────── */
ok('boundary antes de T-30 → T-30', C.cardsNextBoundaryMs(card(), D - 60 * MIN, dtMs) === D - 30 * MIN);
ok('boundary entre T-30 e T-10 → T-10', C.cardsNextBoundaryMs(card(), D - 20 * MIN, dtMs) === D - 10 * MIN);
ok('boundary após T-10 → 0', C.cardsNextBoundaryMs(card(), D - 5 * MIN, dtMs) === 0);
ok('boundary concluída → 0', C.cardsNextBoundaryMs(card({ status: 'concluido' }), D - 60 * MIN, dtMs) === 0);
ok('boundary setor não-cards → 0', C.cardsNextBoundaryMs({ sector: 'cronograma', dueDate: '2026-08-01', dueTime: '15:00' }, D - 60 * MIN, dtMs) === 0);

/* ── 7. ISOLAMENTO: produtor COMPARTILHADO nunca emite p/ cards; setores existentes intactos ── */
// edicao_cards REAL (como saveCardsBatch grava: SEM designerSla) → produtor COMPARTILHADO retorna []
// (resolveTaskDisplayState: hasSla=false ⇒ inPanel=false). Isolamento por AUSÊNCIA de designerSla —
// slaRules permanece byte-idêntico (nenhuma guarda adicionada).
const realCard = card();
ok('slaEmissionsFor(edicao_cards real, sem designerSla) = [] (isolado)', S.slaEmissionsFor(realCard, UID, D - 5 * MIN, dtMs).length === 0);
// cronograma com designerSla na janela de warning → AINDA emite (inalterado).
const cron = { id: 'c1', sector: 'cronograma', title: 'Cron', client: 'Y', status: 'afazer', designerAssignment: { designerId: UID, designerName: 'Des A' }, designerSla: { planDueAt: D, scheduleRevision: 1 } };
const cronEm = S.slaEmissionsFor(cron, UID, D - 15 * MIN, dtMs);
ok('cronograma AINDA emite SLA (inalterado)', cronEm.length === 1 && cronEm[0].eventType === 'sla_warning');
// edicao_midia com designerSla na janela 40 → emite media_warning_40 (inalterado).
const media = { id: 'm1', sector: 'edicao_midia', title: 'Media', client: 'Y', status: 'afazer', designerAssignment: { designerId: UID, designerName: 'Des A' }, designerSla: { planDueAt: D, scheduleRevision: 1 } };
const mediaEm = S.slaEmissionsFor(media, UID, D - 35 * MIN, dtMs);
ok('edicao_midia AINDA emite (janela 40, inalterado)', mediaEm.length === 1 && String(mediaEm[0].dedupKey).indexOf('media_warning_40') >= 0);
// roteiro → [] (inalterado).
const rot = { id: 'r1', sector: 'roteiro', title: 'Rot', client: 'Y', status: 'afazer', designerAssignment: { designerId: UID }, designerSla: { planDueAt: D } };
ok('roteiro continua sem SLA de designer (inalterado)', S.slaEmissionsFor(rot, UID, D - 5 * MIN, dtMs).length === 0);
// cronograma NÃO emite nada pelo produtor de CARDS (isolamento reverso).
ok('cardsEmissionsFor(cronograma) = [] (isolado)', C.cardsEmissionsFor(cron, UID, D - 5 * MIN, dtMs).length === 0);
ok('cardsDisplayState(cronograma) inPanel:false (isolado)', C.cardsDisplayState(cron, D - 5 * MIN, dtMs).inPanel === false);

/* ── resumo ──────────────────────────────────────────────────────────────────────── */
console.log('\nF3.5.2 cards-notify: ' + pass + ' passaram, ' + fail + ' falharam (total ' + (pass + fail) + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
process.exit(0);
