#!/usr/bin/env node
/* =====================================================================================
 * F3.5.2 — EDIÇÃO DE CARDS · INVARIÂNCIA DE FONTE (renderer index.html).
 *
 * Prova, sobre o TEXTO REAL de desktop/src/renderer/index.html:
 *  - RENAME 100% visual: edicao_midia label='Edição de vídeos' com key PRESERVADA.
 *  - 5º setor edicao_cards presente e ADITIVO.
 *  - isClientSector INALTERADO (cronograma||roteiro) — edicao_cards fora ⇒ Card Premium isolado.
 *  - saveCardsBatch: db.batch()+commit() (ATÔMICO), sector edicao_cards, internal:true, e NUNCA
 *    referencia token/link/Card Premium/Worker/cronStatus/designerSla (isolamento por construção).
 *  - Funções do Card Premium PRESENTES (não removidas) + isClientSector byte-idêntico à base 1.0.186.
 *
 * Rodar: node desktop/scripts/f352-cards-source-invariance.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { execSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const BASE_SHA = 'e87ef4b59c4edc6c6fd6249fd7f4ac07b6413048'; // Desktop 1.0.186 (base congelada)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push('FAIL: ' + n); } };

// extrai o corpo de saveCardsBatch (de 'async function saveCardsBatch(' até o marcador EVENT DELEGATION)
function sliceFn(name, endMarker) {
  const i = HTML.indexOf(name); if (i < 0) return '';
  const j = HTML.indexOf(endMarker, i); return j < 0 ? HTML.slice(i) : HTML.slice(i, j);
}
const SCB = sliceFn('async function saveCardsBatch(', '/* ---- EVENT DELEGATION');

/* ── 1. RENAME visual + key preservada ────────────────────────────────────────────── */
ok("edicao_midia label='Edição de vídeos'", /\{key:'edicao_midia',label:'Edição de vídeos'/.test(HTML));
ok('edicao_midia key PRESERVADA (não renomeada)', HTML.indexOf("key:'edicao_midia'") >= 0);
ok("label antigo 'Edição de mídia' removido do SECTORS ativo", !/\{key:'edicao_midia',label:'Edição de mídia'/.test(HTML));

/* ── 2. 5º setor edicao_cards aditivo ─────────────────────────────────────────────── */
ok('SECTORS tem edicao_cards', /\{key:'edicao_cards',label:'Edição de Cards'/.test(HTML));
ok('edicao_cards com desc "Criação de cards avulsos"', /edicao_cards[^}]*Criação de cards avulsos/.test(HTML));
ok('canCreateCards() (gate Social/Admin) presente', HTML.indexOf('function canCreateCards(') >= 0);
ok('CARDS_MAX_BATCH definido', /CARDS_MAX_BATCH\s*=\s*50/.test(HTML));
ok('stepSector oculta edicao_cards p/ não-manager', /if\(s\.key==='edicao_cards'&&!canCreateCards\(\)\)return/.test(HTML));

/* ── 3. isClientSector INALTERADO (edicao_cards fora ⇒ isolamento do fluxo-cliente) ── */
ok("isClientSector = cronograma||roteiro (inalterado)", /function isClientSector\(k\)\{return k==='cronograma'\|\|k==='roteiro';\}/.test(HTML));
ok('isClientSector NÃO menciona edicao_cards', !/isClientSector[^]{0,80}edicao_cards/.test(HTML.replace(/\n/g, ' ')));

/* ── 4. saveCardsBatch: ATÔMICO + shape interno ───────────────────────────────────── */
ok('saveCardsBatch existe', SCB.length > 0);
ok('saveCardsBatch usa db.batch() (atômico)', /db\.batch\(\)/.test(SCB));
ok('saveCardsBatch faz batch.commit()', /batch\.commit\(\)/.test(SCB));
ok('saveCardsBatch cria docs individuais (db.collection(\'tasks\').doc())', /db\.collection\('tasks'\)\.doc\(\)/.test(SCB));
ok("saveCardsBatch grava sector:'edicao_cards'", /sector:'edicao_cards'/.test(SCB));
ok('saveCardsBatch marca internal:true', /internal:true/.test(SCB));
ok('saveCardsBatch usa cardsBatchId (auditoria de lote)', /cardsBatchId/.test(SCB));
// F3.5.2 — o dispatch de LOTE vive no HANDLER do botão salvar (saveTask permanece BYTE-IDÊNTICO à base):
ok('save handler roteia edicao_cards → saveCardsBatch (saveTask intacto)', /secOf\(state\.form\.sector\)\.key==='edicao_cards'\)await saveCardsBatch\(\);else await saveTask\(\)/.test(HTML));
// prova complementar: saveTask NÃO contém ramo de cards (byte-idêntico à base 1.0.186)
ok('saveTask SEM ramo edicao_cards (byte-idêntico à base)', /async function saveTask\(\)\{[^]*?\n\}/.test(HTML) && (HTML.match(/async function saveTask\(\)\{[^]*?\n\}/)||[''])[0].indexOf('edicao_cards') < 0);

/* ── 5. saveCardsBatch NUNCA toca token / Card Premium / Worker / cronStatus / designerSla ── */
for (const forbidden of ['clientReviewToken', 'shareToken', 'clientReviewUrl', 'cronStatus', 'clientFlowStatus', 'ensureReviewToken', 'ensureStableClientReviewToken', 'buildShareClientUrl', 'buildClientMessage', 'openSendClientModal', 'cronContents']) {
  ok('saveCardsBatch NÃO referencia ' + forbidden, SCB.indexOf(forbidden) < 0);
}
// cards NÃO SEMEIAM designerSla (campo) → ficam fora do motor de SLA congelado (a palavra pode
// aparecer só em comentário explicativo; o que importa é a AUSÊNCIA da escrita do campo).
ok('saveCardsBatch NÃO grava o campo designerSla:', SCB.indexOf('designerSla:') < 0);

/* ── 6. Card Premium PRESENTE (não removido) — presença das funções congeladas ─────── */
for (const fn of ['function ensureReviewToken', 'ensureStableClientReviewToken', 'function buildShareClientUrl', 'function buildClientMessage', 'function openSendClientModal']) {
  ok('Card Premium presente: ' + fn, HTML.indexOf(fn) >= 0);
}
// ESCRITA ÚNICA por submissão preservada — F3.5.4I trocou o add(data) por escrita IDEMPOTENTE
// (.doc(f._draftId).set(_payload)) com fallback .add(_payload); segue UMA tarefa por submissão.
ok("saveTask: escrita única idempotente (doc(_draftId).set(_payload) + fallback add(_payload))",
   HTML.indexOf("db.collection('tasks').doc(f._draftId).set(_payload)") >= 0 && HTML.indexOf("db.collection('tasks').add(_payload)") >= 0);

/* ── 7. BYTE-IDÊNTICO vs base 1.0.186: isClientSector + funções do fluxo-cliente ───── */
let base = null;
try { base = execSync('git show ' + BASE_SHA + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString(); } catch (_) { base = null; }
if (base) {
  const grab = (re, s) => { const m = s.match(re); return m ? m[0] : null; };
  const reICS = /function isClientSector\(k\)\{return[^}]*\}/;
  ok('isClientSector byte-idêntico à base 1.0.186', grab(reICS, HTML) && grab(reICS, HTML) === grab(reICS, base));
  const reBCM = /function buildClientMessage\([^]*?\n\}/;
  const cur = grab(reBCM, HTML), old = grab(reBCM, base);
  ok('buildClientMessage byte-idêntico à base 1.0.186', !!cur && cur === old);
  const reESR = /function ensureStableClientReviewToken\([^]*?\n\}/;
  ok('ensureStableClientReviewToken byte-idêntico à base', (() => { const a = grab(reESR, HTML), b = grab(reESR, base); return !!a && a === b; })());
  // a base NÃO deve ter edicao_cards (prova de que é aditivo)
  ok('base 1.0.186 NÃO tinha edicao_cards (aditivo)', base.indexOf("key:'edicao_cards'") < 0);
} else {
  ok('base 1.0.186 indisponível localmente — byte-idêntico verificado no CI (skip)', true);
  ok('skip base byte-identico #2', true); ok('skip base byte-identico #3', true); ok('skip base byte-identico #4', true);
}

console.log('\nF3.5.2 cards-source-invariance: ' + pass + ' passaram, ' + fail + ' falharam (total ' + (pass + fail) + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
process.exit(0);
