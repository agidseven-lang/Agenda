/* =====================================================================================
 * F3.4.6 — DELTA AUTORIZADO (fonte única) do hotfix visual da GRADE DIÁRIA do calendário.
 * -------------------------------------------------------------------------------------
 * Transformação EXATA (byte-a-byte) aplicada sobre a base OFICIAL 1.0.182 (11520f5) em
 * desktop/src/renderer/index.html — e em NADA mais:
 *   1) <style>: novas classes .agcell/.agcell:hover/.agcell-dim/.agcell-dim:hover/
 *      .agcell-today/.agcell-sel (molduras individuais dos dias — visual aprovado da
 *      linhagem PWA .cell), inseridas logo após a regra .chip{...};
 *   2) calendarGrid(): a célula-dia troca o estilo INLINE transparente pelas classes acima
 *      (mesma estrutura: número + dots; nenhuma regra de negócio alterada).
 * Usada pelos gates de invariância (f344/f345 re-ancorados + f346): aplicar o(s) delta(s) à
 * base e exigir IGUALDADE BYTE-idêntica com a fonte atual ⇒ qualquer mudança FORA reprova.
 * ===================================================================================== */

function replaceOnce(src, from, to, tag) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error('F3.4.6 delta: âncora ausente (' + tag + ')');
  if (src.indexOf(from, i + 1) >= 0) throw new Error('F3.4.6 delta: âncora ambígua (' + tag + ')');
  return src.slice(0, i) + to + src.slice(i + from.length);
}

const CSS_ANCHOR = "  .chip{flex:none;border:1px solid var(--line);background:var(--surface);color:var(--soft);border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:700;white-space:nowrap}";
const CSS_NEW = CSS_ANCHOR + "\n" +
  "  /* F3.4.6 — GRADE DIÁRIA da Agenda/Mês: restaura as MOLDURAS individuais de cada dia (visual\n" +
  "     aprovado da linhagem PWA .cell): cada data na sua própria célula com superfície+borda (linhas\n" +
  "     e colunas delimitadas), fora-do-mês discreto porém VISÍVEL, hoje contornado, seleção em accent.\n" +
  "     Somente classes NOVAS (.agcell*); nenhum seletor global alterado. */\n" +
  "  .agcell{aspect-ratio:1;border-radius:10px;background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--ink);font-size:13px;font-weight:700;cursor:pointer;transition:background .12s,border-color .12s}\n" +
  "  .agcell:hover{background:var(--surface2)}\n" +
  "  .agcell-dim{background:transparent;border-color:var(--line-soft);color:var(--faint)}\n" +
  "  .agcell-dim:hover{background:var(--surface)}\n" +
  "  .agcell-today{border-color:var(--accent)}\n" +
  "  .agcell-sel,.agcell-sel:hover{background:var(--accent);border-color:transparent;color:#fff}";

const CELL_OLD = "    cells+='<button data-day=\"'+ds+'\" style=\"aspect-ratio:1;border-radius:10px;background:'+(isS?'var(--accent)':'transparent')+';border:1px solid '+(isT&&!isS?'var(--accent)':'transparent')+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:'+(isS?'#fff':inM?'var(--ink)':'var(--faint)')+';font-size:13px;font-weight:700\">'+d.getDate()+'<div style=\"display:flex;gap:2px;height:5px\">'+(isS?'':dots)+'</div></button>';";
const CELL_NEW = "    cells+='<button data-day=\"'+ds+'\" class=\"agcell'+(inM?'':' agcell-dim')+(isT?' agcell-today':'')+(isS?' agcell-sel':'')+'\">'+d.getDate()+'<div style=\"display:flex;gap:2px;height:5px\">'+(isS?'':dots)+'</div></button>';";

/** Aplica o delta F3.4.6 à FONTE-BASE index.html da 1.0.182. Lança se qualquer âncora
 *  estiver ausente/ambígua (fail-closed: base divergente reprova). */
export function applyF346CalendarDelta(src) {
  let s = String(src);
  s = replaceOnce(s, CSS_ANCHOR, CSS_NEW, 'style:.agcell');
  s = replaceOnce(s, CELL_OLD, CELL_NEW, 'calendarGrid:celula');
  return s;
}

export default applyF346CalendarDelta;
