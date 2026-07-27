#!/usr/bin/env node
/* =====================================================================================
 * F3.5.2 — RELEASE · QUANTIDADE + LOTE ATÔMICO (executa o código REAL do renderer b84639d)
 * -------------------------------------------------------------------------------------
 * Extrai e EXECUTA as funções reais de desktop/src/renderer/index.html:
 *   - CARDS_MAX_BATCH (limite máximo seguro) + cardsQtyOf (clamp da quantidade);
 *   - saveCardsBatch (criação em LOTE via db.batch()+commit()).
 * Prova as 12 propriedades exigidas: min=1; máx explícito; zero/negativo/decimal<1/texto/vazio/
 * acima-do-limite bloqueados; N cria exatamente N documentos independentes; batch.commit é usado;
 * falha no commit ⇒ zero tarefa criada (atômico, sem lote parcial). Decimal ≥1 é NORMALIZADO por
 * Math.floor (2.7→2) — nunca cria fração/partial; decimal <1 é bloqueado.
 *
 * Rodar: node desktop/scripts/f352-cards-quantity-batch.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

/* ---- extrai o código REAL do renderer ---- */
function sliceBetween(startMarker, endMarker) {
  const i = HTML.indexOf(startMarker); if (i < 0) throw new Error('marker: ' + startMarker);
  const j = HTML.indexOf(endMarker, i); if (j < 0) throw new Error('endmarker: ' + endMarker);
  return HTML.slice(i, j);
}
// CARDS_MAX_BATCH + cardsQtyOf (linhas contíguas)
const qtySrc = sliceBetween('var CARDS_MAX_BATCH=50;', '\n', ) + '\n' +
  (HTML.match(/function cardsQtyOf\(f\)\{[^}]*\}/) || [''])[0];
const CARDS_MAX_BATCH = 50;
const cardsQtyOf = new Function('CARDS_MAX_BATCH', qtySrc + '\n; return cardsQtyOf;')(CARDS_MAX_BATCH);
// saveCardsBatch (corpo completo até o marcador EVENT DELEGATION)
const scbSrc = sliceBetween('async function saveCardsBatch(){', '/* ---- EVENT DELEGATION');

/* ── 1. CARDS_MAX_BATCH definido + cardsQtyOf clamp (min=1, máx=50, inválidos → seguro) ── */
ok('máximo seguro DEFINIDO (CARDS_MAX_BATCH=50)', /var CARDS_MAX_BATCH=50;/.test(HTML));
ok('quantidade mínima = 1 (cardsQtyOf(1)=1)', cardsQtyOf({ cardsQty: 1 }) === 1);
ok('quantidade máxima = 50 (cardsQtyOf(50)=50)', cardsQtyOf({ cardsQty: 50 }) === 50);
ok('N típico preservado (cardsQtyOf(5)=5)', cardsQtyOf({ cardsQty: 5 }) === 5);
ok('ZERO clamped p/ 1 (cardsQtyOf(0)=1)', cardsQtyOf({ cardsQty: 0 }) === 1);
ok('NEGATIVO clamped p/ 1 (cardsQtyOf(-3)=1)', cardsQtyOf({ cardsQty: -3 }) === 1);
ok('TEXTO clamped p/ 1 (cardsQtyOf("abc")=1)', cardsQtyOf({ cardsQty: 'abc' }) === 1);
ok('VAZIO clamped p/ 1 (cardsQtyOf("")=1)', cardsQtyOf({ cardsQty: '' }) === 1);
ok('ACIMA do limite clamped p/ 50 (cardsQtyOf(999)=50)', cardsQtyOf({ cardsQty: 999 }) === 50);
ok('51 clamped p/ 50 (cardsQtyOf(51)=50)', cardsQtyOf({ cardsQty: 51 }) === 50);
ok('DECIMAL ≥1 normalizado por floor (cardsQtyOf(2.7)=2)', cardsQtyOf({ cardsQty: 2.7 }) === 2);
ok('DECIMAL <1 clamped p/ 1 (cardsQtyOf(0.5)=1)', cardsQtyOf({ cardsQty: 0.5 }) === 1);

/* ── 2. GATE do wizard (stepNext): bloqueia quantidade inválida com alerta ──────────── */
// predicado real do gate (index.html:8471-8472): q=Math.floor(Number(f.cardsQty)||0); (q>=1 && q<=MAX)
ok('wizard bloqueia quantidade inválida (predicado presente na fonte)',
  /const q=Math\.floor\(Number\(f\.cardsQty\)\|\|0\);\s*\n\s*if\(!\(q>=1&&q<=CARDS_MAX_BATCH\)\)\{alert\('Informe uma quantidade válida/.test(HTML));
// avalia o MESMO predicado do gate p/ provar o bloqueio (zero/neg/texto/vazio/decimal<1/acima)
const gate = (v) => { const q = Math.floor(Number(v) || 0); return (q >= 1 && q <= CARDS_MAX_BATCH); };
ok('gate BLOQUEIA zero', gate('0') === false);
ok('gate BLOQUEIA negativo', gate('-3') === false);
ok('gate BLOQUEIA texto', gate('abc') === false);
ok('gate BLOQUEIA vazio', gate('') === false);
ok('gate BLOQUEIA decimal <1 (0.5)', gate('0.5') === false);
ok('gate BLOQUEIA acima do limite (51/999)', gate('51') === false && gate('999') === false);
ok('gate PERMITE 1/5/50', gate('1') && gate('5') && gate('50'));

/* ── 3. saveCardsBatch: N cria exatamente N docs independentes; 1 commit; atômico ───── */
function mkDb(commitBehavior) {
  const staged = []; const committed = []; let commits = 0; const refs = [];
  const batch = {
    set: (ref, data) => { staged.push({ ref, data }); },
    commit: async () => { commits++; if (commitBehavior === 'throw') throw new Error('offline (sintético)'); while (staged.length) committed.push(staged.shift()); },
  };
  const db = { batch: () => batch, collection: (name) => ({ doc: () => { const r = { __id: 'doc_' + (refs.length + 1), __col: name }; refs.push(r); return r; } }) };
  return { db, refs, staged, committed, get commits() { return commits; } };
}
function runSave(cardsQty, cards, commitBehavior) {
  const env = mkDb(commitBehavior);
  const alerts = [];
  const state = {
    user: { id: 'soc1', name: 'Social', role: 'social' },
    users: [{ id: 'desA', name: 'Designer A', role: 'designer' }],
    form: { client: 'Cliente Y', assigneeId: 'desA', cardsQty, cards, _saving: true, step: 3 },
    tab: '', boardSector: '',
  };
  const saveCardsBatch = new Function(
    'state', 'db', 'cardsQtyOf', 'CARDS_MAX_BATCH', 'isSocialUser', 'photoOf', 'alert', 'render', 'console', 'boardCol',
    scbSrc + '\n; return saveCardsBatch;'
  )(state, env.db, cardsQtyOf, CARDS_MAX_BATCH, (u) => !!(u && u.role === 'social'), () => '', (m) => alerts.push(m), () => {}, console, 0);
  return { env, alerts, state, saveCardsBatch };
}
const cardsN = (n) => Array.from({ length: n }, (_, i) => ({ tema: 'Tema ' + (i + 1), legenda: 'Leg ' + i, obs: 'Obs ' + i, dueDate: '2026-08-01', dueTime: '15:0' + (i % 10) }));

// N=3 válido
{ const r = runSave(3, cardsN(3)); await r.saveCardsBatch();
  ok('N=3 cria exatamente 3 documentos', r.env.committed.length === 3);
  ok('N=3 usou 3 refs INDEPENDENTES (db.collection(tasks).doc() novo por card)', r.env.refs.length === 3 && new Set(r.env.refs.map(x => x.__id)).size === 3);
  ok('N=3 usou UM único batch.commit()', r.env.commits === 1);
  ok('N=3 todos os docs sector=edicao_cards + internal:true', r.env.committed.every(d => d.data.sector === 'edicao_cards' && d.data.internal === true));
  ok('N=3 cardIndex 1..3 e cardsBatchTotal=3 (auditoria de lote)', r.env.committed.map(d => d.data.cardIndex).join(',') === '1,2,3' && r.env.committed.every(d => d.data.cardsBatchTotal === 3));
  ok('N=3 mesmo cardsBatchId em todos (lote coeso)', new Set(r.env.committed.map(d => d.data.cardsBatchId)).size === 1);
  ok('N=3 NENHUM doc com token/cliente (isolado)', r.env.committed.every(d => !('clientReviewToken' in d.data) && !('shareToken' in d.data) && !('clientReviewUrl' in d.data) && !('cronStatus' in d.data) && !('designerSla' in d.data)));
}
// N=1 (mínimo)
{ const r = runSave(1, cardsN(1)); await r.saveCardsBatch(); ok('N=1 (mínimo) cria exatamente 1 documento', r.env.committed.length === 1 && r.env.commits === 1); }
// N=50 (máximo)
{ const r = runSave(50, cardsN(50)); await r.saveCardsBatch(); ok('N=50 (máximo) cria exatamente 50 documentos', r.env.committed.length === 50 && r.env.commits === 1); }
// quantidade acima do limite via cardsQtyOf ⇒ nunca >50 (clamp protege o saveCardsBatch)
{ const r = runSave(999, cardsN(50)); await r.saveCardsBatch(); ok('cardsQty=999 ⇒ saveCardsBatch limita a 50 (clamp, nunca >máx)', r.env.committed.length === 50); }
// zero/texto/vazio ⇒ cardsQtyOf clamp p/ 1 ⇒ nunca cria lote inválido (0 docs)
{ const r = runSave(0, cardsN(1)); await r.saveCardsBatch(); ok('cardsQty=0 ⇒ saveCardsBatch cria 1 (clamp, nunca 0)', r.env.committed.length === 1); }

/* ── 4. ATÔMICO: falha no commit ⇒ ZERO tarefa criada (sem lote parcial) ────────────── */
{ const r = runSave(5, cardsN(5), 'throw'); await r.saveCardsBatch();
  ok('falha no commit ⇒ ZERO documento persistido (atômico)', r.env.committed.length === 0);
  ok('falha no commit ⇒ tentou UM commit (sem parciais fora do batch)', r.env.commits === 1);
  ok('falha no commit ⇒ alerta "nada foi criado" ao usuário', r.alerts.some(m => /nada foi criado/i.test(m)));
  ok('falha no commit ⇒ NÃO houve set individual persistido (só staged no batch, descartado)', r.env.committed.length === 0);
}

/* ── 5. card sem tema / sem prazo ⇒ aborta ANTES de qualquer escrita (zero criado) ──── */
{ const bad = cardsN(3); bad[1].tema = '   '; const r = runSave(3, bad); await r.saveCardsBatch();
  ok('card sem tema ⇒ aborta, ZERO documento (nem batch iniciado)', r.env.committed.length === 0 && r.env.commits === 0 && r.alerts.some(m => /tema/i.test(m))); }
{ const bad = cardsN(3); bad[2].dueTime = ''; const r = runSave(3, bad); await r.saveCardsBatch();
  ok('card sem prazo ⇒ aborta, ZERO documento', r.env.committed.length === 0 && r.env.commits === 0 && r.alerts.some(m => /data e a hora|prazo/i.test(m))); }

/* ── 6. saveCardsBatch usa batch.commit() e db.batch() (prova de fonte) ─────────────── */
ok('saveCardsBatch usa db.batch()', /const batch=db\.batch\(\)/.test(scbSrc));
ok('saveCardsBatch usa batch.set(ref,data) por card', /batch\.set\(ref,data\)/.test(scbSrc));
ok('saveCardsBatch faz UM await batch.commit() (atômico)', (scbSrc.match(/await batch\.commit\(\)/g) || []).length === 1);
ok('saveCardsBatch cria ref novo por card (db.collection(\'tasks\').doc())', /db\.collection\('tasks'\)\.doc\(\)/.test(scbSrc));

console.log('\nLIMITE ADOTADO: CARDS_MAX_BATCH = ' + CARDS_MAX_BATCH + ' (quantidade por lote: 1..' + CARDS_MAX_BATCH + ')');
console.log('F3.5.2 cards-quantity-batch: ' + pass + ' passaram, ' + fail + ' falharam (total ' + (pass + fail) + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
process.exit(0);
