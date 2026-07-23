/* =====================================================================================
 * F3.4.5 — DELTA AUTORIZADO (fonte única) do hotfix do timestamp da amarela.
 * -------------------------------------------------------------------------------------
 * Transformação EXATA (byte-a-byte) aplicada sobre a base OFICIAL 1.0.181 (e4692c9) em
 * desktop/src/renderer/index.html e desktop/src/main/slaRules.js — e em NADA mais:
 *   1) resolveTaskDisplayState: calcula _START (designerSla.planStartAt; fallback
 *      designerAssignment.startDate/startTime) e o ramo AMARELO passa a exigir
 *      now >= max(finish−WARN, _START) — o amarelo jamais antecede a abertura real da janela;
 *   2) resolveCanonicalSlaTimeline: warningAtMs = min(max(due−warn, _START), due).
 * Usada pelos gates de invariância (f344 re-ancorado + f345): aplicar o delta à base e exigir
 * IGUALDADE BYTE-idêntica com a fonte atual ⇒ qualquer mudança FORA do delta reprova.
 * ===================================================================================== */

function replaceOnce(src, from, to, tag) {
  const i = src.indexOf(from);
  if (i < 0) throw new Error('F3.4.5 delta: âncora ausente (' + tag + ')');
  if (src.indexOf(from, i + 1) >= 0) throw new Error('F3.4.5 delta: âncora ambígua (' + tag + ')');
  return src.slice(0, i) + to + src.slice(i + from.length);
}

const DS_ANCHOR = "  try{ if(typeof slaCfgOf==='function'){ var _c=slaCfgOf(t); if(_c){ _WARN=(_c.warningMinutes||30)*60000; _GRACE=(_c.overdueGraceMinutes||10)*60000; } } }catch(_e){}";
const DS_START_BLOCK = DS_ANCHOR + "\n" +
  "  // F3.4.5 — ABERTURA REAL da janela concedida ao Designer (designerSla.planStartAt; fallback\n" +
  "  // designerAssignment.startDate/startTime): o AMARELO jamais antecede o início planejado. Sem\n" +
  "  // início registrado (_START=0), max(x,0)=x ⇒ comportamento aprovado BYTE-idêntico.\n" +
  "  var _START=0; try{ var _dsS=(t&&t.designerSla)||{}; _START=Number(_dsS.planStartAt)||0; if(!(_START>0)){ var _daS=(t&&t.designerAssignment)||{}; var _fS=dtMsFn||(typeof dtMs==='function'?dtMs:null); if(_daS.startDate&&typeof _fS==='function'){ _START=Number(_fS(_daS.startDate,_daS.startTime||'00:00'))||0; } } if(!(_START>0)) _START=0; }catch(_eS){ _START=0; }";

const WARN_OLD = "  if(now>=finishMs-_WARN){ var left=Math.max(1,Math.round((finishMs-now)/60000));";
const WARN_NEW = "  if(now>=Math.max(finishMs-_WARN,_START)){ var left=Math.max(1,Math.round((finishMs-now)/60000));";

const TL_ANCHOR = "  var warnMin=(cfg&&cfg.warningMinutes)||30, graceMin=(cfg&&cfg.overdueGraceMinutes)||10;";
const TL_START_BLOCK = TL_ANCHOR + "\n" +
  "  // F3.4.5 — mesma abertura real da janela usada por resolveTaskDisplayState (clamp do amarelo).\n" +
  "  var _START=0; try{ var _dsS=(t&&t.designerSla)||{}; _START=Number(_dsS.planStartAt)||0; if(!(_START>0)){ var _daS=(t&&t.designerAssignment)||{}; if(_daS.startDate&&typeof f==='function'){ _START=Number(f(_daS.startDate,_daS.startTime||'00:00'))||0; } } if(!(_START>0)) _START=0; }catch(_eS){ _START=0; }";

const TLW_OLD = "    warningAtMs:dueAtMs?(dueAtMs-warnMin*60000):0,   // AMARELO: prazo final − warningMinutes";
const TLW_NEW = "    warningAtMs:dueAtMs?Math.min(Math.max(dueAtMs-warnMin*60000,_START),dueAtMs):0,   // AMARELO: max(prazo final − warningMinutes, INÍCIO planejado) — F3.4.5: nunca antes da abertura real";

/** Aplica o delta F3.4.5 a uma FONTE-BASE (index.html OU slaRules.js da 1.0.181). Lança se
 *  qualquer âncora estiver ausente/ambígua (fail-closed: base divergente reprova). */
export function applyF345SlaDelta(src) {
  let s = String(src);
  s = replaceOnce(s, DS_ANCHOR, DS_START_BLOCK, 'displayState:_START');
  s = replaceOnce(s, WARN_OLD, WARN_NEW, 'displayState:warning-branch');
  s = replaceOnce(s, TL_ANCHOR, TL_START_BLOCK, 'timeline:_START');
  s = replaceOnce(s, TLW_OLD, TLW_NEW, 'timeline:warningAtMs');
  return s;
}

export default applyF345SlaDelta;
