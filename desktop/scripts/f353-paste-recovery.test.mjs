/**
 * F3.5.3 — Suíte 2: COLAGEM na Legenda (Setores → Edição de Cards → Nova tarefa).
 * Extrai as funções REAIS do index.html (mesmo padrão dos Golden Masters) e prova o
 * pipeline de colagem: texto puro no cursor, múltiplos parágrafos, acentos, emojis,
 * amostras WhatsApp/Word/Docs/Bloco de Notas, nenhum HTML executável, evento 'input'
 * disparado (o bind captura → salvo/exibido/Detalhes). Testes obrigatórios 61-75.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import vm from 'vm';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');

function extract(name) {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('função não encontrada no index.html: ' + name);
  let depth = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) {
    if (html[k] === '{') depth++;
    else if (html[k] === '}') { depth--; if (depth === 0) return html.slice(i, k + 1); }
  }
  throw new Error('corpo não fechado: ' + name);
}
const src = extract('f353IsTextField') + '\n' + extract('f353InsertPlainText');
const ctx = { Event: class { constructor(type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); } } };
vm.createContext(ctx);
vm.runInContext(src + '\n;this.__is=f353IsTextField;this.__ins=f353InsertPlainText;', ctx);
const isField = ctx.__is, insert = ctx.__ins;

/** Elemento fake fiel ao contrato usado (value/selection/setRangeText/dispatchEvent/oninput). */
function el(tag, type, value, selStart, selEnd, withSetRangeText = true) {
  const attrs = { type };
  const e = {
    tagName: tag.toUpperCase(), value: value || '',
    selectionStart: selStart == null ? (value || '').length : selStart,
    selectionEnd: selEnd == null ? (selStart == null ? (value || '').length : selStart) : selEnd,
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    events: [],
    dispatchEvent(ev) { this.events.push(ev.type); },
  };
  if (withSetRangeText) {
    e.setRangeText = function (t, s, en) { this.value = this.value.slice(0, s) + t + this.value.slice(en); this.selectionStart = this.selectionEnd = s + t.length; };
  }
  return e;
}

let ok = 0, fail = 0; const fails = [];
function t(id, desc, fn) {
  try { fn(); ok++; console.log(`  ✓ ${id} ${desc}`); }
  catch (e) { fail++; fails.push(`${id} ${desc} :: ${e.message}`); console.log(`  ✗ ${id} ${desc}\n      ${e.message}`); }
}
function eq(a, b, m) { if (a !== b) throw new Error(`${m || 'eq'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }

console.log('\n══ f353IsTextField — escopo exato (só campos de texto do formulário) ══');
t('P1', 'textarea (Legenda/Observações) é elegível; input text (Tema) é elegível', () => {
  eq(isField(el('textarea', null)), true);
  eq(isField(el('input', 'text')), true);
  eq(isField(el('input', null)), true, 'input sem type = text');
});
t('P2', 'date/time/botão NÃO são elegíveis (pipeline não toca outros controles)', () => {
  eq(isField(el('input', 'date')), false);
  eq(isField(el('input', 'time')), false);
  eq(isField(el('button', null)), false);
  eq(isField(null), false);
});

console.log('\n══ f353InsertPlainText — colagem determinística (testes 61-75) ══');
t('P3', 'cola no CURSOR preservando o texto existente (teste 61 Ctrl+V / 62 Shift+Insert / 63 menu)', () => {
  const e = el('textarea', null, 'AB', 1, 1);
  eq(insert(e, 'XY'), true);
  eq(e.value, 'AXYB'); eq(e.selectionStart, 3);
});
t('P4', 'substitui a SELEÇÃO (comportamento padrão de colagem)', () => {
  const e = el('textarea', null, 'Hello mundo', 6, 11);
  insert(e, 'colado');
  eq(e.value, 'Hello colado');
});
t('P5', 'múltiplos parágrafos preservados (teste 64; quebras de linha preservadas)', () => {
  const e = el('textarea', null, '', 0, 0);
  insert(e, 'Par 1\n\nPar 2\nPar 3');
  eq(e.value, 'Par 1\n\nPar 2\nPar 3');
});
t('P6', 'CRLF do Word/Windows normalizado para \\n sem perder parágrafos (teste 68)', () => {
  const e = el('textarea', null, '', 0, 0);
  insert(e, 'Linha1\r\nLinha2\rLinha3');
  eq(e.value, 'Linha1\nLinha2\nLinha3');
});
t('P7', 'acentos e emojis preservados (testes 65-66)', () => {
  const e = el('textarea', null, '', 0, 0);
  const s = 'Atenção: çãõáéíóú 😀🎉🔥 — “aspas” e travessão';
  insert(e, s);
  eq(e.value, s);
});
t('P8', 'texto do WhatsApp (emoji + quebras) íntegro (teste 67)', () => {
  const e = el('textarea', null, '', 0, 0);
  const s = '🔥 PROMOÇÃO!\n\nVem aí o lançamento 🚀\n👉 Link na bio';
  insert(e, s);
  eq(e.value, s);
});
t('P9', 'texto do Google Docs/Bloco de Notas longo íntegro (testes 69-70: texto longo)', () => {
  const e = el('textarea', null, '', 0, 0);
  const s = ('Legenda longa para o card. ').repeat(200);
  insert(e, s);
  eq(e.value.length, s.length);
});
t('P10', 'HTML colado vira TEXTO LITERAL (nunca executa/insere markup — teste 74)', () => {
  const e = el('textarea', null, '', 0, 0);
  const s = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  insert(e, s);
  eq(e.value, s, 'string bruta como texto simples; nenhuma interpretação de HTML');
});
t('P11', "dispara 'input' — o bind captura p/ state.form (salvo → card → Detalhes; testes 71-73)", () => {
  const e = el('textarea', null, '', 0, 0);
  insert(e, 'abc');
  eq(e.events.includes('input'), true);
});
t('P12', 'fallback sem setRangeText também insere e posiciona cursor', () => {
  const e = el('textarea', null, 'AB', 1, 1, false);
  insert(e, 'ZZ');
  eq(e.value, 'AZZB'); eq(e.selectionStart, 3);
});
t('P13', 'texto vazio não altera nada; campo não-texto recusa (retornos false)', () => {
  const e = el('textarea', null, 'AB', 1, 1);
  eq(insert(e, ''), false); eq(e.value, 'AB');
  eq(insert(el('input', 'date'), 'x'), false);
});
t('P14', 'wiring presente: paste + keydown(Ctrl+V/Shift+Insert) + contextmenu escopados a state.form (teste 75: fora do formulário nada muda)', () => {
  const w = html.indexOf('function f353WirePasteRecovery(');
  if (w < 0) throw new Error('wiring ausente');
  const body = html.slice(w, html.indexOf('function composedDesc', w));
  eq(body.includes("addEventListener('paste'"), true, 'paste');
  eq(body.includes("addEventListener('keydown'"), true, 'keydown');
  eq(body.includes("addEventListener('contextmenu'"), true, 'context menu');
  eq((body.match(/if\(!state\.form\) return;/g) || []).length >= 3, true, 'guarda state.form em TODOS os handlers (escopo do formulário)');
  eq(html.includes('f353WirePasteRecovery(c);'), true, 'ligado no afterForm');
});
t('P15', 'Card Premium intocado: _copy e copy-card-image sem alterações estruturais', () => {
  eq(html.includes("function _copy(s){try{var ta=document.createElement('textarea')"), true, '_copy original');
  eq((html.match(/copy-card-image/g) || []).length >= 1, true, 'IPC do card preservado');
});

const total = ok + fail;
console.log(`\nF3.5.3 SUÍTE 2 (colagem): ${ok} OK, ${fail} FALHOU (de ${total})`);
if (fail) { fails.forEach((f) => console.log('  FALHA: ' + f)); process.exit(1); }
