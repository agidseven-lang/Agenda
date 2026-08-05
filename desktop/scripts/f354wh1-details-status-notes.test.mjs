#!/usr/bin/env node
/* =====================================================================
 * F3.5.4W-H1 — CENTRAL DE DETALHES (tipografia + Copiar tema/legenda) ·
 *              STATUS SOCIAL/DESIGNER (fonte única) · OBSERVAÇÕES INTERNAS POR TEMA
 * ---------------------------------------------------------------------
 * Contrato ESTÁTICO das TRÊS entregas (E2/E3/E5), verificado nos BYTES REAIS de
 * produção: renderer (src/renderer/index.html) + IPC (src/main/main.ts,
 * src/preload/preload.ts). O comportamento REAL no app empacotado é provado pelo
 * harness Electron f354wh1-electron-proof.mjs (app.asar, sem IA/mockup).
 *
 *   E2 — Central de Detalhes premium: tipografia (.det-acc-k/.det-acc-t/.det-acc-l),
 *        botões "Copiar tema/legenda" no cabeçalho do acordeão (IPC simétrico
 *        clipboard-write-text/clipboardWriteText), handler que cancela o toggle
 *        nativo do <summary>, feedback discreto e observabilidade SANITIZADA
 *        (SÓ 5 metadados; NUNCA tema/legenda/texto/uid/cliente/token).
 *   E3 — status Social/Designer (fonte única): FLOW_LABELS.awaiting_designer.social.col
 *        = 'afazer' (era 'andamento'); designer atribuído mas NÃO iniciado cai em
 *        "A Fazer" na Social/Setores/Meu quadro (paridade com o Designer); só vira
 *        "Em andamento" quando o designer realmente inicia (designerFlowStatus='andamento').
 *   E5 — observações INTERNAS por tema (aditivo): designerItemNotes keyed i<idx>
 *        (índice estável), input por tema em openDesignerDeadline, render ao Designer
 *        na Central (.det-acc-note) só quando não-vazia, histórico com notesCount (sem texto).
 *
 * Rodar: node scripts/f354wh1-details-status-notes.test.mjs
 *   (SRC=<arquivo> aponta ao index.html EMPACOTADO no gate do asar)
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const H = fs.readFileSync(process.env.SRC || path.resolve(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const MAIN = fs.readFileSync(path.resolve(DESK, 'src', 'main', 'main.ts'), 'utf8');
const PRELOAD = fs.readFileSync(path.resolve(DESK, 'src', 'preload', 'preload.ts'), 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; flog.push(n); console.log('  FAIL — ' + n); } };

/* Extrai um literal de objeto balanceado a partir de um marcador (só chaves reais;
   as strings do renderer não contêm '{' '}' nem aspas simples escapadas). */
function extractBalanced(src, marker) {
  const start = src.indexOf(marker); if (start < 0) return null;
  const bs = src.indexOf('{', start); if (bs < 0) return null;
  let depth = 0, i = bs;
  for (; i < src.length; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { i++; break; } } }
  return src.slice(bs, i);
}

console.log('== F3.5.4W-H1 — Detalhes (cópia/tipografia) · status Social/Designer · observações internas (contrato de código) ==');

/* =========================== E2 — CENTRAL DE DETALHES =========================== */
console.log('\n-- E2: Copiar tema/legenda + tipografia premium --');
// IPC simétrico (main + preload)
ok('E2.1  main.ts: ipcMain.handle("clipboard-write-text", ...) existe', /ipcMain\.handle\("clipboard-write-text",/.test(MAIN));
ok('E2.2  main.ts: handler escreve clipboard.writeText e retorna boolean (try/catch)', /ipcMain\.handle\("clipboard-write-text",[^\n]*clipboard\.writeText\(String\(s ?\?\? ?""\)\); ?return true;[^\n]*catch[^\n]*return false;/.test(MAIN));
ok('E2.3  main.ts: importa clipboard do electron', /import \{[^}]*\bclipboard\b[^}]*\} from "electron"/.test(MAIN));
ok('E2.4  preload.ts: clipboardWriteText exposto (invoke clipboard-write-text)', /clipboardWriteText:[^\n]*ipcRenderer\.invoke\("clipboard-write-text", ?s\)/.test(PRELOAD));
// Botões de cópia no MAP do cronograma
ok('E2.5  cron map: botão data-detcopytheme="1" no cabeçalho (lê tema)', /<button type="button" class="det-acc-cbtn" data-detcopytheme="1"[^>]*aria-label="Copiar tema"/.test(H));
ok('E2.6  cron map: botão data-detcopycaption="1" no cabeçalho (lê legenda)', /<button type="button" class="det-acc-cbtn" data-detcopycaption="1"[^>]*aria-label="Copiar legenda"/.test(H));
ok('E2.7  tema button GATED em tema não-vazio (hasTema)', /var hasTema=\(c\.tema!=null&&String\(c\.tema\)\.trim\(\)\)\?1:0;/.test(H) && /\(hasTema\?'<button type="button" class="det-acc-cbtn" data-detcopytheme="1"/.test(H));
ok('E2.8  legenda button GATED em legenda não-vazia (leg)', /var leg=\(c\.legenda!=null&&String\(c\.legenda\)\.trim\(\)\)\?String\(c\.legenda\):'';/.test(H) && /\(leg\?'<button type="button" class="det-acc-cbtn" data-detcopycaption="1"/.test(H));
// Edição de Cards: um único botão de legenda que lê .det-acc-l (conteúdo real), NÃO o rótulo estático .det-acc-t
ok('E2.9  edicao_cards: usa data-detcopycaption (não data-detcopytheme) — o .det-acc-t é rótulo estático', /_leg=cardsFieldOf\(t,'legenda'\),_obs=cardsFieldOf\(t,'obs'\)/.test(H) && /CARD · LEGENDA[\s\S]{0,260}data-detcopycaption="1"/.test(H) && /CARD · OBSERVAÇÕES[\s\S]{0,260}data-detcopycaption="1"/.test(H));
ok('E2.10 edicao_cards: botão de legenda GATED em _leg; observações GATED em _obs', /\(_leg\?'<span class="det-acc-copy"><button type="button" class="det-acc-cbtn" data-detcopycaption="1"/.test(H) && /\(_obs\?'<span class="det-acc-copy"><button type="button" class="det-acc-cbtn" data-detcopycaption="1"/.test(H));
ok('E2.11 edicao_cards: NÃO há botão data-detcopytheme nos blocos de card (rótulo estático não é copiável)', !/CARD · LEGENDA[\s\S]{0,260}data-detcopytheme/.test(H) && !/CARD · OBSERVAÇÕES[\s\S]{0,260}data-detcopytheme/.test(H));
// Handler delegado — intercepta ANTES do toggle nativo
ok('E2.12 handler intercepta [data-detcopytheme],[data-detcopycaption]', /if\(el=g\('\[data-detcopytheme\],\[data-detcopycaption\]'\)\)\{/.test(H));
ok('E2.13 handler chama preventDefault() (não navega/afeta o form)', /if\(el=g\('\[data-detcopytheme\],\[data-detcopycaption\]'\)\)\{\s*e\.preventDefault\(\);/.test(H));
ok('E2.14 handler chama stopPropagation() (o <summary> NÃO expande/recolhe)', /if\(el=g\('\[data-detcopytheme\],\[data-detcopycaption\]'\)\)\{\s*e\.preventDefault\(\); ?e\.stopPropagation\(\);/.test(H));
ok('E2.15 handler: legenda lê .det-acc-body .det-acc-l (conteúdo real), tema lê .det-acc-t', /_cap\?\(_acc&&_acc\.querySelector\('\.det-acc-body \.det-acc-l'\)\):\(_acc&&_acc\.querySelector\('\.det-acc-t'\)\)/.test(H));
ok('E2.16 handler lê o texto via \.textContent (nunca innerHTML) — F3.5.5C: prefere o espelho text/plain .det-plain-src quando a legenda renderiza rica', /var _txt=_ps\?\(_ps\.textContent\|\|''\):\(_node\?\(_node\.textContent\|\|''\):''\);/.test(H) && /detCopyFromButton\(el, ?_cap\?'caption':'theme', ?_txt\)/.test(H) && !/_txt=[^;\n]*innerHTML/.test(H));
// Helpers
ok('E2.17 helper detClipWrite(text) definido', /async function detClipWrite\(text\)\{/.test(H));
ok('E2.18 detClipWrite: IPC-first (clipboardWriteText) → navigator.clipboard → execCommand', /detClipWrite\(text\)\{[\s\S]{0,700}window\.desktopAPI\.clipboardWriteText[\s\S]{0,200}navigator\.clipboard\.writeText[\s\S]{0,260}execCommand&&document\.execCommand\('copy'\)/.test(H));
ok('E2.19 detClipWrite escreve SÓ texto puro (String(...)), nunca HTML', /async function detClipWrite\(text\)\{\s*var s=String\(text==null\?'':text\);/.test(H));
ok('E2.20 helper detCopyObs(kind, ok, textLen) definido', /function detCopyObs\(kind, ?ok, ?textLen\)\{/.test(H));
ok('E2.21 helper detCopyFromButton(btn, kind, text) definido', /async function detCopyFromButton\(btn, ?kind, ?text\)\{/.test(H));
ok('E2.22 detCopyFromButton: troca ícone copy→check no sucesso (.ok + svg check)', /btn\.classList\.add\('ok'\); ?btn\.innerHTML=svg\('check'\);/.test(H));
ok('E2.23 detCopyFromButton: tooltip "Tema copiado"/"Legenda copiada" no sucesso', /var okTip=\(kind==='theme'\?'Tema copiado':\(/.test(H) && /'Observação copiada':'Legenda copiada'\)\);/.test(H));
ok('E2.24 detCopyFromButton: tooltip de falha "Não foi possível copiar" (+ .err)', /btn\.classList\.add\('err'\);/.test(H) && /var errTip='Não foi possível copiar';/.test(H));
ok('E2.25 detCopyFromButton: restaura após 1600ms (sucesso) / 2200ms (falha)', /svg\('copy'\);[\s\S]{0,120}\},1600\);/.test(H) && /\},2200\);/.test(H));
// Observabilidade SANITIZADA
ok('E2.26 detCopyObs emite details.copy.theme|caption _succeeded|_failed via diagLog', /var topic='details\.copy\.'\+\(kind==='theme'\?'theme':'caption'\)\+'_'\+\(ok\?'succeeded':'failed'\);/.test(H) && /window\.desktopAPI\.diagLog\(topic,payload\)/.test(H));
const PAYLOAD = extractBalanced(H, 'var payload=');
ok('E2.27 payload de observabilidade localizado (var payload={...})', !!PAYLOAD);
const PKEYS = PAYLOAD ? [...PAYLOAD.matchAll(/[{,]\s*([A-Za-z_]\w*):/g)].map(m => m[1]) : [];
const WANT5 = ['contentType', 'contentLength', 'taskSector', 'appVersion', 'timestamp'];
ok('E2.28 payload tem EXATAMENTE 5 chaves de topo', PKEYS.length === 5);
ok('E2.29 payload = {contentType,contentLength,taskSector,appVersion,timestamp} (SÓ estas)', WANT5.every(k => PKEYS.includes(k)) && PKEYS.every(k => WANT5.includes(k)));
ok('E2.30 payload.appVersion vem de DESK_VER (versão sanitizada, sem dado de cliente)', /appVersion:DESK_VER/.test(PAYLOAD || ''));
ok('E2.31 payload.contentLength = COMPRIMENTO (não o texto)', /contentLength:\(typeof textLen==='number'\?textLen:0\)/.test(PAYLOAD || ''));
ok('E2.32 payload NUNCA emite tema/legenda/uid/cliente/token/texto-cru', !!PAYLOAD && !/tema|legenda|\bclient|token|uid|\btext\s*:/i.test(PAYLOAD));
ok('E2.33 detCopyObs lê o setor de data-detsector (não do cliente/uid)', /var sector=\(back&&back\.getAttribute\('data-detsector'\)\)\|\|'';/.test(H));
// Tipografia premium
ok('E2.34 CSS .det-acc-k font-weight:600 + color:var(--faint)', /\.det-acc-k\{[^}]*font-weight:600[^}]*color:var\(--faint\)/.test(H));
ok('E2.35 CSS .det-acc-t font-weight:600 + color:var(--ink)', /\.det-acc-t\{[^}]*font-weight:600[^}]*color:var\(--ink\)/.test(H));
ok('E2.36 CSS .det-acc-l font-size:14px + line-height:1.65', /\.det-acc-l\{[^}]*font-size:14px[^}]*line-height:1\.65/.test(H));
ok('E2.37 CSS .det-acc-copy presente (contêiner dos botões)', /\.det-acc-copy\{/.test(H));
ok('E2.38 CSS .det-acc-cbtn presente (botão de cópia)', /\.det-acc-cbtn\{/.test(H));
ok('E2.39 CSS .det-acc-cbtn.ok = verde (var --green); .err = vermelho (var --red)', /\.det-acc-cbtn\.ok\{[^}]*var\(--green\)/.test(H) && /\.det-acc-cbtn\.err\{[^}]*var\(--red\)/.test(H));
ok('E2.40 modal-back da Central carrega data-detsector (observabilidade)', /class="modal-back" data-modalbg="1" data-detmodal="1" data-detsector="'\+esc\(t\.sector\|\|''\)\+'"/.test(H));

/* ================== E3 — STATUS SOCIAL/DESIGNER (fonte única) ================== */
console.log('\n-- E3: awaiting_designer.social.col = afazer (paridade Social↔Designer) --');
let FL = null; try { FL = eval('(' + extractBalanced(H, 'const FLOW_LABELS=') + ')'); } catch (_) { FL = null; }
ok('E3.1  FLOW_LABELS extraído (repro pura de lógica a partir dos bytes reais)', !!FL && !!FL.awaiting_designer && !!FL.designer_producing);
ok('E3.2  FLOW_LABELS.awaiting_designer.social.col === "afazer"', !!FL && FL.awaiting_designer.social.col === 'afazer');
ok('E3.3  awaiting_designer.social.col NÃO é mais "andamento"', !!FL && FL.awaiting_designer.social.col !== 'andamento');
ok('E3.4  awaiting_designer.social.label === "Aguardando designer iniciar"', !!FL && FL.awaiting_designer.social.label === 'Aguardando designer iniciar');
ok('E3.5  awaiting_designer.designer.col permanece "afazer" (paridade com a Social)', !!FL && FL.awaiting_designer.designer.col === 'afazer');
ok('E3.6  designer_producing.social.col permanece "andamento" (inalterado)', !!FL && FL.designer_producing.social.col === 'andamento');
ok('E3.7  designer_producing.designer.col permanece "andamento" (inalterado)', !!FL && FL.designer_producing.designer.col === 'andamento');
ok('E3.8  (estrutural) linha awaiting_designer com social:{col:\'afazer\'', /awaiting_designer:\{social:\{col:'afazer'/.test(H));
ok('E3.9  socialCol: hasDesigner(t)&&designerCol(t)===\'afazer\' → retorna \'afazer\' (coerência Prioridades)', /if\(hasDesigner\(t\)&&designerCol\(t\)==='afazer'\)return 'afazer';/.test(H));
ok('E3.10 deriveCanonicalTaskState: designerCol \'andamento\' → DESIGNER_PRODUCING (start real)', /if\(dc==='andamento'\)return \{phase:TASK_PHASE\.DESIGNER_PRODUCING,owner:'designer',isCron:true\};/.test(H));
ok('E3.11 deriveCanonicalTaskState: senão (não iniciou) → AWAITING_DESIGNER', /return \{phase:TASK_PHASE\.AWAITING_DESIGNER,owner:'designer',isCron:true\};/.test(H));
ok('E3.12 designerCol lê designerFlowStatus como fonte (afazer/andamento/revisao/concluido)', /function designerCol\(t\)\{const v=\(t&&t\.designerFlowStatus\|\|''\)\.toString\(\);/.test(H));
// repro de lógica: mesma coluna para Social e Designer no estado "atribuído-não-iniciado"
ok('E3.13 (repro) awaiting_designer: Social.col === Designer.col (mesmo balde "A Fazer")', !!FL && FL.awaiting_designer.social.col === FL.awaiting_designer.designer.col && FL.awaiting_designer.social.col === 'afazer');

/* ============ E5 — OBSERVAÇÕES INTERNAS POR TEMA (aditivo, designerItemNotes) ============ */
console.log('\n-- E5: designerItemNotes keyed i<idx> (índice estável, nunca o tema) --');
// Escrita (sendToDesigner) gated em itemNotesPresent
ok('E5.1  sendToDesigner grava patch.designerItemNotes SÓ quando dl.itemNotesPresent', /if\(dl\.itemNotesPresent\)\{ ?patch\.designerItemNotes=\(dl\.itemNotes&&typeof dl\.itemNotes==='object'\)\?dl\.itemNotes:\{\}; ?\}/.test(H));
// Input (openDesignerDeadline): textarea por tema, gated em setor de cliente + lista de cron
ok('E5.2  openDesignerDeadline: gate por setor de cliente + temas (isClientSector + cronOf)', /var _cronD=isClientSector\(secOf\(t\.sector\)\.key\)\?cronOf\(t\):null;/.test(H) && /if\(_cronD&&_cronD\.list&&_cronD\.list\.length\)\{/.test(H));
ok('E5.3  input: <textarea data-itemnote="<_i>"> (um por tema)', /<textarea class="dz-note-ta" data-itemnote="'\+c\._i\+'"/.test(H));
ok('E5.4  input data-itemnote é o ÍNDICE estável c._i (NÃO o tema)', /data-itemnote="'\+c\._i\+'"/.test(H) && !/data-itemnote="'\+esc\(c\.tema/.test(H) && !/data-itemnote="'\+c\.tema/.test(H));
ok('E5.5  input prefill: reidrata das notas já existentes (_existNotes[i+idx]) na reatribuição', /var _existNotes=\(t\.designerItemNotes&&typeof t\.designerItemNotes==='object'\)\?t\.designerItemNotes:\{\};/.test(H) && /var _cur=\(_existNotes\['i'\+c\._i\]!=null\)\?String\(_existNotes\['i'\+c\._i\]\):'';/.test(H) && /rows="2"[^>]*>'\+esc\(_cur\)\+'<\/textarea>/.test(H));
ok('E5.6  input existe SÓ para tarefas de setor de cliente com temas (edicao_midia/vídeos ficam de fora)', /_notesUI='<details class="dz-notes">/.test(H) && /if\(_cronD&&_cronD\.list&&_cronD\.list\.length\)\{[\s\S]{0,60}_notesUI=/.test(H));
// Coleta no handler [data-designersend]
ok('E5.7  coleta: querySelectorAll(textarea[data-itemnote]) no handler de envio', /var _noteTAs=document\.querySelectorAll\('textarea\[data-itemnote\]'\);/.test(H));
ok('E5.8  coleta: mapa keyed \'i\'+idx a partir do data-itemnote (índice)', /_itemNotes\['i'\+_ix\]=_v;/.test(H) && /var _ix=ta\.getAttribute\('data-itemnote'\);/.test(H));
ok('E5.9  coleta: PULA vazios (só grava quando há valor após trim)', /var _v=\(ta\.value\|\|''\)\.trim\(\);if\(_ix!=null&&_v\)_itemNotes\['i'\+_ix\]=_v;/.test(H));
ok('E5.10 coleta: itemNotesPresent = houve seção (_noteTAs.length>0)', /itemNotesPresent:_noteTAs\.length>0/.test(H));
// Render ao Designer na Central (.det-acc-note) — só quando não-vazia, keyed pelo índice
ok('E5.11 render: lookup da nota keyed \'i\'+c._i (ÍNDICE), lido de t.designerItemNotes', /var _dnv=\(t\.designerItemNotes\|\|\{\}\)\['i'\+c\._i\];var _dn=\(_dnv!=null\)\?String\(_dnv\)\.trim\(\):'';/.test(H));
ok('E5.12 render: .det-acc-note só quando a nota NÃO é vazia (_dn?...:\'\')', /var _dnote=_dn\?'<div class="det-acc-note">[\s\S]*?<\/div>':'';/.test(H));
ok('E5.13 render: rótulo .det-acc-note-k "Observação interna da Social Media" + corpo .det-acc-note-b', /<span class="det-acc-note-k">Observação interna da Social Media<\/span><div class="det-acc-note-b">'\+esc\(_dn\)/.test(H));
ok('E5.14 render: o corpo da nota é ESCAPADO (esc(_dn)) — sem HTML cru', /det-acc-note-b">'\+esc\(_dn\)\+'/.test(H));
ok('E5.15 render: _dnote é anexado ao corpo do acordeão (após legenda) — F3.5.5C: o corpo pode carregar o render RICO gateado + espelho .det-plain-src (janela ampliada; estrutura idêntica)', /'<div class="det-acc-body">'\+\(leg\?[\s\S]{0,420}\)\+_dnote\+'<\/div>'/.test(H));
ok('E5.16 (PROVA índice≠tema) a nota é indexada por c._i; NUNCA por c.tema no lookup', /\(t\.designerItemNotes\|\|\{\}\)\['i'\+c\._i\]/.test(H) && !/\(t\.designerItemNotes\|\|\{\}\)\[[^\]]*c\.tema/.test(H));
// Histórico enviado_designer — só notesCount, sem texto
const HIST = (H.match(/type:'enviado_designer'[\s\S]{0,400}?\}\)/) || [''])[0];
ok('E5.17 histórico enviado_designer: notesCount = Object.keys(...).length (CONTAGEM)', /notesCount:\(dl\.itemNotesPresent\?Object\.keys\(dl\.itemNotes\|\|\{\}\)\.length:0\)/.test(H));
ok('E5.18 histórico enviado_designer: carrega notesCount (localizado no arrayUnion)', /notesCount:/.test(HIST));
ok('E5.19 histórico enviado_designer: NÃO grava designerItemNotes (sem os textos por tema)', HIST.length > 0 && !/designerItemNotes/.test(HIST));
// CSS do callout
ok('E5.20 CSS .det-acc-note / .det-acc-note-k / .det-acc-note-b presentes', /\.det-acc-note\{/.test(H) && /\.det-acc-note-k\{/.test(H) && /\.det-acc-note-b\{/.test(H));
ok('E5.21 CSS .det-acc-note-b preserva parágrafos (white-space:pre-wrap)', /\.det-acc-note-b\{[^}]*white-space:pre-wrap/.test(H));

/* ============================ RESULTADO ============================ */
console.log('\nRESULTADO F3.5.4W-H1: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail) { console.log('::error:: F3.5.4W-H1 contrato vermelho: ' + flog.join(' | ')); process.exit(1); }
