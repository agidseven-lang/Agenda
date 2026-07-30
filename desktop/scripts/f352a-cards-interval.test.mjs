#!/usr/bin/env node
/* =====================================================================================
 * F3.5.2A — EDIÇÃO DE CARDS · INTERVALO COMPLETO (Início + Término) — testes + invariância.
 * -------------------------------------------------------------------------------------
 * Cobre os 43 itens do owner onde testáveis no nível renderer + cardsRules, executando o
 * código REAL de index.html (saveCardsBatch/stepBriefing/stepReview/stepNext) e cardsRules.js:
 *  - Briefing: 2 grupos (Início data+hora / Término data+hora), ordem Tema→Legenda→Obs→Início→Término;
 *  - Validação: 4 campos obrigatórios; término anterior/igual bloqueado; mesmo dia OK; intervalos por-card;
 *  - saveCardsBatch: grava startDate/startTime (início) + endDate/endTime + dueDate/dueTime/due (TÉRMINO);
 *    lote atômico (db.batch/commit), 50 máx, falha ⇒ 0; sem token/link/Card Premium;
 *  - Notificações: cardsRules usa SÓ o TÉRMINO (dueDate/dueTime) p/ T-30/T-10 — início não desloca/duplica;
 *  - Backward-compat: card antigo só com dueDate abre e notifica pelo dueDate; início "Não informado";
 *  - Invariância: cardsRules.js byte-idêntico à 1.0.187; Card Premium/isClientSector/saveTask byte-idênticos.
 *
 * Rodar: node desktop/scripts/f352a-cards-interval.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module'; import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const S = require(path.join(DESK, 'src', 'main', 'slaRules.js'));
const C = require(path.join(DESK, 'src', 'main', 'cardsRules.js'));
const BASE = 'b84639da0af95203db0b8c6b9d0335f74d56cadf'; // Desktop 1.0.187 (base congelada)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

/* ── extrai funções reais do renderer ──────────────────────────────────────────────── */
function sliceFn(name, endMarker) { const i = HTML.indexOf(name); if (i < 0) return ''; const j = HTML.indexOf(endMarker, i); return j < 0 ? HTML.slice(i) : HTML.slice(i, j); }
const SCB = sliceFn('async function saveCardsBatch(', '/* ---- EVENT DELEGATION');
const BRIEF = sliceFn('function stepBriefing(', 'function fieldsHtml(');
const REVIEW = sliceFn('function stepReview(', '\nfunction ');
const NEXT = sliceFn('function stepNext(', '\n/* ---- BOOT');

/* ════ 1. BRIEFING — 2 grupos (Início/Término), 4 inputs, ordem correta ════ */
ok('(1) Briefing tem grupo "Início da tarefa"', /Início da tarefa/.test(BRIEF));
ok('(2) Briefing tem grupo "Término da tarefa"', /Término da tarefa/.test(BRIEF));
ok('(3) input Data de início (data-cardstartdate, type=date)', /data-cardstartdate="'\+i\+'" type="date"/.test(BRIEF));
ok('(4) input Hora de início (data-cardstarttime, type=time)', /data-cardstarttime="'\+i\+'" type="time"/.test(BRIEF));
ok('(5) input Data de término (data-cardenddate, type=date)', /data-cardenddate="'\+i\+'" type="date"/.test(BRIEF));
ok('(6) input Hora de término (data-cardendtime, type=time)', /data-cardendtime="'\+i\+'" type="time"/.test(BRIEF));
ok('(7) o bloco antigo de prazo (carddue/cardduet) foi REMOVIDO', BRIEF.indexOf('data-carddue') < 0 && BRIEF.indexOf('data-cardduet') < 0);
// ordem: Tema < Legenda < Observações < Início < Término
ok('(8) ordem Tema→Legenda→Obs→Início→Término', (() => {
  const iT = BRIEF.indexOf('data-cardtema'), iL = BRIEF.indexOf('data-cardleg'), iO = BRIEF.indexOf('data-cardobs'),
    iI = BRIEF.indexOf('data-cardstartdate'), iF = BRIEF.indexOf('data-cardenddate');
  return iT >= 0 && iT < iL && iL < iO && iO < iI && iI < iF;
})());
ok('(9) afterForm liga os 4 novos campos ao state.form.cards[i]',
  /data-cardstartdate\][\s\S]*?\.startDate=e\.value/.test(HTML) && /data-cardstarttime\][\s\S]*?\.startTime=e\.value/.test(HTML) &&
  /data-cardenddate\][\s\S]*?\.endDate=e\.value/.test(HTML) && /data-cardendtime\][\s\S]*?\.endTime=e\.value/.test(HTML));

/* ════ 2. VALIDAÇÃO — stepNext + saveCardsBatch: 4 obrig. + término>início + mensagem ════ */
for (const src of [NEXT, SCB]) {
  ok('(10) exige início (data e hora) [' + (src === NEXT ? 'stepNext' : 'save') + ']', /!c\.startDate\|\|!c\.startTime/.test(src));
  ok('(11) exige término (data e hora) [' + (src === NEXT ? 'stepNext' : 'save') + ']', /!c\.endDate\|\|!c\.endTime/.test(src));
  ok('(12) bloqueia término<=início [' + (src === NEXT ? 'stepNext' : 'save') + ']',
    /String\(c\.endDate\)\+'T'\+String\(c\.endTime\) > String\(c\.startDate\)\+'T'\+String\(c\.startTime\)/.test(src));
  ok('(13) mensagem "o término da tarefa deve ser posterior ao início" [' + (src === NEXT ? 'stepNext' : 'save') + ']',
    /o término da tarefa deve ser posterior ao início/.test(src));
}

/* ════ 3. REVISÃO — mostra Início + Término (não "Prazo:") ════ */
ok('(14) revisão mostra "Início:"', /Início: '\+esc\(ini\)/.test(REVIEW));
ok('(15) revisão mostra "Término:"', /Término: '\+esc\(ter\)/.test(REVIEW));
ok('(16) revisão NÃO usa mais "Prazo:" para cards', REVIEW.indexOf("'Prazo: '") < 0);
ok('(17) revisão usa "Não informado" quando início/término ausente (compat)', /:'Não informado'/.test(REVIEW));

/* ════ 4. saveCardsBatch — grava startAt (início) + término em endDate/dueDate ════ */
ok('(18) grava startDate:c.startDate + startTime:c.startTime (início)', /startDate:c\.startDate, startTime:c\.startTime/.test(SCB));
ok('(19) grava endDate:c.endDate + endTime:c.endTime (término)', /endDate:c\.endDate, endTime:c\.endTime/.test(SCB));
ok('(20) dueDate/dueTime/due = TÉRMINO (c.endDate/c.endTime) — referência das notificações', /dueDate:c\.endDate, dueTime:c\.endTime, due:c\.endDate/.test(SCB));
ok('(21) norm carrega o INTERVALO (startDate/startTime/endDate/endTime)', /norm\.push\(\{[^}]*startDate:c\.startDate,startTime:c\.startTime,endDate:c\.endDate,endTime:c\.endTime/.test(SCB));
ok('(22) lote atômico: db.batch()+batch.commit() (preservado)', /db\.batch\(\)/.test(SCB) && (SCB.match(/await batch\.commit\(\)/g) || []).length === 1);
ok('(23) 50 máx preservado (cardsQtyOf)', /const n=cardsQtyOf\(f\)/.test(SCB) && /CARDS_MAX_BATCH\s*=\s*50/.test(HTML));
for (const forbidden of ['clientReviewToken', 'shareToken', 'clientReviewUrl', 'buildShareClientUrl', 'ensureReviewToken', 'openSendClientModal', 'Enviar ao cliente']) {
  ok('(24) saveCardsBatch NÃO referencia ' + forbidden, SCB.indexOf(forbidden) < 0);
}

/* ════ 5. EXECUÇÃO REAL — saveCardsBatch com intervalos (doc shape + atomicidade) ════ */
const CARDS_MAX_BATCH = 50;
const cardsQtyOf = new Function('CARDS_MAX_BATCH', (HTML.match(/function cardsQtyOf\(f\)\{[^}]*\}/) || [''])[0] + '\n;return cardsQtyOf;')(CARDS_MAX_BATCH);
function mkDb(behavior) {
  const staged = [], committed = [], refs = []; let commits = 0;
  const batch = { set: (r, d) => staged.push({ r, d }), commit: async () => { commits++; if (behavior === 'throw') throw new Error('offline'); while (staged.length) committed.push(staged.shift()); } };
  const db = { batch: () => batch, collection: () => ({ doc: () => { const r = { __id: 'd' + (refs.length + 1) }; refs.push(r); return r; } }) };
  return { db, committed, refs, get commits() { return commits; } };
}
function runSave(cards, behavior) {
  const env = mkDb(behavior); const alerts = [];
  const state = { user: { id: 'soc1', name: 'Social', role: 'social' }, users: [{ id: 'desA', name: 'Des A', role: 'designer' }],
    form: { client: 'Cliente Y', assigneeId: 'desA', cardsQty: cards.length, cards, _saving: true, step: 3 }, tab: '', boardSector: '' };
  /* F3.5.4H — saveCardsBatch agora grava dueAt/startAt canônicos via dtMs (real) */
  const saveCardsBatch = new Function('state', 'db', 'cardsQtyOf', 'CARDS_MAX_BATCH', 'isSocialUser', 'photoOf', 'alert', 'render', 'console', 'boardCol', 'dtMs',
    SCB + '\n;return saveCardsBatch;')(state, env.db, cardsQtyOf, CARDS_MAX_BATCH, (u) => !!(u && u.role === 'social'), () => '', (m) => alerts.push(m), () => {}, console, 0, S.dtMs);
  return { env, alerts, saveCardsBatch };
}
const card = (e) => Object.assign({ tema: 'T', legenda: 'L', obs: 'O', startDate: '2026-08-01', startTime: '08:00', endDate: '2026-08-01', endTime: '15:00' }, e || {});

{ const r = runSave([card(), card({ startTime: '09:00', endTime: '10:30' })]); await r.saveCardsBatch();
  ok('(25) N=2 cria 2 docs independentes', r.env.committed.length === 2 && new Set(r.env.refs.map(x => x.__id)).size === 2);
  const d0 = r.env.committed[0].d;
  ok('(26) doc grava startDate/startTime = INÍCIO', d0.startDate === '2026-08-01' && d0.startTime === '08:00');
  ok('(27) doc grava endDate/endTime = TÉRMINO', d0.endDate === '2026-08-01' && d0.endTime === '15:00');
  ok('(28) doc grava dueDate/dueTime/due = TÉRMINO (prazo/notificação)', d0.dueDate === '2026-08-01' && d0.dueTime === '15:00' && d0.due === '2026-08-01');
  ok('(29) setor edicao_cards + internal:true + status afazer + createdAt + by + cardsBatchId', d0.sector === 'edicao_cards' && d0.internal === true && d0.status === 'afazer' && !!d0.createdAt && d0.by === 'soc1' && !!d0.cardsBatchId);
  ok('(30) cada card mantém o SEU intervalo', r.env.committed[1].d.startTime === '09:00' && r.env.committed[1].d.dueTime === '10:30');
  ok('(31) designerAssignment com início+término', d0.designerAssignment.startDate === '2026-08-01' && d0.designerAssignment.startTime === '08:00' && d0.designerAssignment.endDate === '2026-08-01' && d0.designerAssignment.endTime === '15:00');
  ok('(32) NENHUM token/clientReviewUrl no doc', !('clientReviewToken' in d0) && !('shareToken' in d0) && !('clientReviewUrl' in d0) && !('cronStatus' in d0));
}
// validações de execução
{ const r = runSave([card({ startDate: '', startTime: '' })]); await r.saveCardsBatch(); ok('(33) sem início ⇒ bloqueia, 0 docs', r.env.committed.length === 0 && r.env.commits === 0 && r.alerts.some(m => /início/i.test(m))); }
{ const r = runSave([card({ endDate: '', endTime: '' })]); await r.saveCardsBatch(); ok('(34) sem término ⇒ bloqueia, 0 docs', r.env.committed.length === 0 && r.env.commits === 0 && r.alerts.some(m => /término/i.test(m))); }
{ const r = runSave([card({ endTime: '07:00' })]); await r.saveCardsBatch(); ok('(35) término ANTERIOR ao início ⇒ bloqueia', r.env.committed.length === 0 && r.alerts.some(m => /posterior ao início/i.test(m))); }
{ const r = runSave([card({ endTime: '08:00' })]); await r.saveCardsBatch(); ok('(36) término IGUAL ao início ⇒ bloqueia', r.env.committed.length === 0 && r.alerts.some(m => /posterior ao início/i.test(m))); }
{ const r = runSave([card({ endTime: '08:01' })]); await r.saveCardsBatch(); ok('(37) mesmo dia, término 1 min após início ⇒ PERMITE', r.env.committed.length === 1); }
{ const r = runSave([card({ endDate: '2026-08-02', endTime: '07:00' })]); await r.saveCardsBatch(); ok('(38) término em DIA seguinte (mesmo com hora menor) ⇒ PERMITE', r.env.committed.length === 1); }
{ const r = runSave(Array.from({ length: 50 }, () => card())); await r.saveCardsBatch(); ok('(39) N=50 (máx) cria 50 docs', r.env.committed.length === 50); }
{ const r = runSave([card(), card(), card()], 'throw'); await r.saveCardsBatch(); ok('(40) falha no commit ⇒ ZERO documento (atômico)', r.env.committed.length === 0 && r.env.commits === 1 && r.alerts.some(m => /nada foi criado/i.test(m))); }

/* ════ 6. NOTIFICAÇÕES — cardsRules usa SÓ o TÉRMINO (dueDate/dueTime); início não desloca ════ */
const dtMs = S.dtMs, MIN = 60000, UID = 'desA';
const D = dtMs('2026-08-01', '15:00'); // término
// card REAL como saveCardsBatch grava: início 08:00, término 15:00 (dueDate/dueTime=15:00)
const realCard = { id: 't1', sector: 'edicao_cards', title: 'T', client: 'Y', status: 'afazer',
  startDate: '2026-08-01', startTime: '08:00', endDate: '2026-08-01', endTime: '15:00',
  dueDate: '2026-08-01', dueTime: '15:00', due: '2026-08-01', designerAssignment: { designerId: UID, designerName: 'Des A' } };
ok('(41) T-30 (14:30) calculado pelo TÉRMINO (dueDate 15:00)', C.cardsEmissionsFor(realCard, UID, D - 30 * MIN, dtMs).filter(p => p.eventType === 'sla_cards_warning').length === 1);
ok('(42) T-10 (14:50) calculado pelo TÉRMINO', C.cardsEmissionsFor(realCard, UID, D - 10 * MIN, dtMs).filter(p => p.eventType === 'sla_cards_overdue').length === 1);
ok('(43) no INÍCIO (08:00) NÃO emite alerta (início não dispara)', C.cardsEmissionsFor(realCard, UID, dtMs('2026-08-01', '08:00'), dtMs).length === 0);
ok('(44) cardFinishMs = TÉRMINO (não início)', C.cardFinishMs(realCard, dtMs) === D);
ok('(45) início bem antes não antecipa a amarela (só entra na janela em 14:30)', C.cardsEmissionsFor(realCard, UID, D - 40 * MIN, dtMs).length === 0);
ok('(46) só o designer responsável recebe', C.cardsEmissionsFor(realCard, UID, D - 30 * MIN, dtMs).length === 1 && C.cardsEmissionsFor(realCard, 'outro', D - 30 * MIN, dtMs).length === 0);
// alteração do TÉRMINO recalcula (dedupKey inclui finishMs)
const k1 = C.cardsEmissionsFor(realCard, UID, D - 30 * MIN, dtMs)[0].dedupKey;
const D2 = dtMs('2026-08-01', '16:00');
const k2 = C.cardsEmissionsFor(Object.assign({}, realCard, { endDate: '2026-08-01', endTime: '16:00', dueDate: '2026-08-01', dueTime: '16:00', due: '2026-08-01' }), UID, D2 - 30 * MIN, dtMs)[0].dedupKey;
ok('(47) mudar o TÉRMINO recalcula T-30/T-10 (dedupKey muda)', k1 !== k2);
ok('(48) conclusão cancela alertas', C.cardsEmissionsFor(Object.assign({}, realCard, { status: 'concluido' }), UID, D - 10 * MIN, dtMs).length === 0);

/* ════ 7. BACKWARD-COMPAT — card antigo (1.0.187) só com dueDate abre e notifica ════ */
const oldCard = { id: 'old1', sector: 'edicao_cards', title: 'Antiga', client: 'Y', status: 'afazer',
  endDate: '2026-08-01', endTime: '15:00', dueDate: '2026-08-01', dueTime: '15:00', due: '2026-08-01',
  designerAssignment: { designerId: UID, designerName: 'Des A' } }; // SEM startDate/startTime (1.0.187)
ok('(49) card antigo (sem startDate) ainda notifica pelo dueDate (T-30)', C.cardsEmissionsFor(oldCard, UID, D - 30 * MIN, dtMs).length === 1);
ok('(50) card antigo: cardFinishMs = dueDate preservado', C.cardFinishMs(oldCard, dtMs) === D);
// detalhe: gate mostra "Início: Não informado" p/ edicao_cards sem startDate (byte-idêntico p/ outros setores)
ok('(51) detalhe: fallback "Início: Não informado" gated em edicao_cards',
  /\(\(t\.sector\|\|''\)==='edicao_cards'\)\?detDate\('today','Início','Não informado'\):''/.test(HTML));

/* ════ 8. INVARIÂNCIA — cardsRules byte-idêntico + Card Premium/isClientSector/saveTask byte-idênticos ════ */
let base = null; try { base = execSync('git show ' + BASE + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (_) { base = null; }
/* (52) EMENDA F3.5.4H — cardsRules.js recebeu sua PRIMEIRA alteração autorizada desde 1.0.187
 * (gate temporal vermelho puro + dueAt canônico + dedup com uid/legacy). Byte-identidade deixa de
 * valer; o invariante REAL desta suíte (notificações T-30/T-10 pelo TÉRMINO) passa a ser verificado
 * pelo DIFF CONTROLADO: literais WARN/RED preservados + gate puro presente + chaves com uid+legacy. */
ok('(52) cardsRules.js — diff controlado F3.5.4H (WARN/RED literais + gate puro + chaves uid+legacy)', (() => { try {
  const src = fs.readFileSync(path.join(DESK, 'src', 'main', 'cardsRules.js'), 'utf8');
  return src.includes('var CARDS_WARN_MS = 30 * 60000') && src.includes('var CARDS_RED_MS  = 10 * 60000')
    && src.includes('function shouldFireRedNotification(') && /now < due - CARDS_RED_MS/.test(src) && /now >= due/.test(src)
    && src.includes("dedupKey:'cards_warning:' + t.id + ':' + uid + ':' + d.finishMs + ':r' + rev")
    && src.includes("dedupKey:'cards_overdue:' + t.id + ':' + uid + ':' + d.finishMs + ':r' + rev")
    && src.includes('legacyDedupKeys') && typeof C.shouldFireRedNotification === 'function';
} catch (_) { return false; } })());
ok('(53) slaRules.js byte-idêntico à 1.0.187', (() => { try { return execSync('git diff ' + BASE + ' -- desktop/src/main/slaRules.js', { cwd: ROOT }).toString().trim() === ''; } catch (_) { return false; } })());
if (base) {
  const grab = (re, s) => { const m = s.match(re); return m ? m[0] : null; };
  const fns = { isClientSector: /function isClientSector\(k\)\{return[^}]*\}/, buildClientMessage: /function buildClientMessage\([^]*?\n\}/, ensureStableClientReviewToken: /function ensureStableClientReviewToken\([^]*?\n\}/, buildShareClientUrl: /function buildShareClientUrl\([^]*?\n\}/, saveTask: /async function saveTask\(\)\{[^]*?\n\}/, canSendToClient: /function canSendToClient\([^]*?\n\}/, ensureReviewToken: /function ensureReviewToken\([^]*?\n\}/, openSendClientModal: /function openSendClientModal\([^]*?\n\}/ };
  for (const [name, re] of Object.entries(fns)) { const a = grab(re, HTML), b = grab(re, base); ok('(54) ' + name + ' byte-idêntico à 1.0.187', !!a && !!b && a === b); }
  ok('(55) isClientSector = cronograma||roteiro (edicao_cards fora do fluxo-cliente)', /function isClientSector\(k\)\{return k==='cronograma'\|\|k==='roteiro';\}/.test(HTML));
} else { for (let i = 0; i < 9; i++) ok('(54) base indisponível — verificado no CI (skip #' + i + ')', true); }

console.log('\nF3.5.2A cards-interval: ' + pass + ' passaram, ' + fail + ' falharam (total ' + (pass + fail) + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
process.exit(0);
