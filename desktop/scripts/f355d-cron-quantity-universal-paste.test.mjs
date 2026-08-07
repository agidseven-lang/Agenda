// F3.5.5D — CRONOGRAMAS PERSONALIZADOS + COLAGEM UNIVERSAL (Desktop 1.0.223): suíte estática+hermética.
// A) versão · B) QUANTIDADE DE TEMAS (testes obrigatórios 1–36 do mandato; comportamento real via vm
// das funções extraídas + pins estruturais) · C) COLAGEM (testes 1–40; pipeline universal + menu de
// contexto NATIVO de produção rodado hermeticamente do dist) · D) segurança · E) main/preload ·
// F) congelados/isolamento. Roda contra o fonte real (SRC=/F355D_DIST= p/ gate empacotado).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require2 = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.SRC ? path.resolve(process.env.SRC) : path.join(ROOT, 'src', 'renderer', 'index.html');
const S = fs.readFileSync(FILE, 'utf8');
const DIST = process.env.F355D_DIST ? path.resolve(process.env.F355D_DIST) : path.join(ROOT, 'dist', 'main');
const MAIN = fs.readFileSync(process.env.MAIN_SRC ? path.resolve(process.env.MAIN_SRC) : path.join(ROOT, 'src', 'main', 'main.ts'), 'utf8');
const PRELOAD = fs.readFileSync(process.env.PRELOAD_SRC ? path.resolve(process.env.PRELOAD_SRC) : path.join(ROOT, 'src', 'preload', 'preload.ts'), 'utf8');
const ECM = fs.readFileSync(path.join(ROOT, 'src', 'main', 'editContextMenu.ts'), 'utf8');
const R = f => fs.readFileSync(path.resolve(ROOT, f), 'utf8');
let n = 0, fails = 0;
function ok(label, cond) { n++; if (cond) { console.log('  ✓ ' + label); } else { fails++; console.log('  ✗ FALHOU: ' + label); } }
function seg(a, b, name) {
  const i = S.indexOf(a); const j = S.indexOf(b, i + a.length);
  if (i < 0 || j < 0) { console.log('  ✗ ÂNCORA AUSENTE (' + name + '): ' + (i < 0 ? a : b)); fails++; n++; return ''; }
  return S.slice(i, j);
}
const has = (h, s) => h.indexOf(s) >= 0;
function extract(name) {
  const i = S.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('função ausente: ' + name);
  let depth = 0, j = S.indexOf('{', i);
  for (let k = j; k < S.length; k++) {
    if (S[k] === '{') depth++; else if (S[k] === '}') { depth--; if (depth === 0) return S.slice(i, k + 1); }
  }
  throw new Error('corpo não fechado: ' + name);
}

/* ── vm com as FUNÇÕES REAIS extraídas ── */
const ctx = {
  Event: class { constructor(t, o) { this.type = t; this.bubbles = !!(o && o.bubbles); } },
  TEMPLATES: { cronograma: { subtypes: {
    semanal: { label: 'Semanal', fields: [{ k: 'semana_ref' }, { k: 'canais' }], checklist: ['ck-sem'] },
    quinzenal: { label: 'Quinzenal', fields: [{ k: 'periodo' }, { k: 'canais' }], checklist: ['ck-qui'] },
    mensal: { label: 'Mensal', fields: [{ k: 'mes_ref' }, { k: 'canais' }], checklist: ['ck-men'] } } } },
  console,
};
vm.createContext(ctx);
vm.runInContext(
  'var CRON_QTY_MAX=500;\n' + extract('normCronQty') + '\n' + extract('cronQtyOf') + '\n' + extract('synthCronSub') + '\n'
  + extract('f353IsTextField') + '\n' + extract('f355dEditableTextEl') + '\n' + extract('f355dNumberEl') + '\n' + extract('f355dPasteIntoNumber') + '\n'
  + ';this.__norm=normCronQty;this.__of=cronQtyOf;this.__sub=synthCronSub;this.__txt=f355dEditableTextEl;this.__num=f355dNumberEl;this.__pn=f355dPasteIntoNumber;', ctx);
const norm = ctx.__norm, qof = ctx.__of, synth = ctx.__sub, txtEl = ctx.__txt, numEl = ctx.__num, pasteNum = ctx.__pn;
function el(tag, type, extra) { const attrs = { type: type }; return Object.assign({ tagName: tag.toUpperCase(), value: '', readOnly: false, disabled: false, events: [], getAttribute: k => (k in attrs ? attrs[k] : null), dispatchEvent(e) { this.events.push(e.type); } }, extra || {}); }

console.log('— A) VERSÃO 1.0.223 —');
const pkg = JSON.parse(R('package.json'));
ok('A1 package.json 1.0.228 + marcador custom-cronograma-quantity-universal-paste (RE-PINADO F3.5.5E-H4)', pkg.version === '1.0.228' && /custom-cronograma-quantity-universal-paste/.test(pkg.description || ''));
ok('A2 descrição preserva os 3 marcadores herdados', /stale-alert-terminal-task-hotfix/.test(pkg.description) && /session-restore-boot-hotfix/.test(pkg.description) && /custom-script-quantity-rich-editor/.test(pkg.description));
ok('A3 package-lock 1.0.228 (raiz + packages[""] — RE-PINADO F3.5.5E-H4)', JSON.parse(R('package-lock.json')).version === '1.0.228' && JSON.parse(R('package-lock.json')).packages[''].version === '1.0.228');

console.log('— B) QUANTIDADE DE TEMAS DO CRONOGRAMA (mandato 1–36) —');
/* 1–8: quantidades reais geram N (fonte canônica = contagem que dirige contentCount) */
for (const q of [1, 2, 3, 7, 10, 13, 20, 50]) ok('B' + q + ' quantidade ' + q + ' → contentCount ' + q + (q === 1 ? ' (1 conteúdo)' : ''), (synth(qof({ cronQty: q }), {}) || {}).contentCount === q);
/* 9–13: digitação/colagem/botões/setas/Tab — input nativo type=number + commit central + −/+ delegados */
const brief = seg('function stepBriefing(){', 'function stepReview(){', 'briefing');
ok('B9 stepper no Briefing: input nativo (digitação/apagar/selecionar/substituir/setas/Tab) + placeholder Ex.: 10', has(brief, 'id="fCronQty" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex.: 10"'));
ok('B10 colagem no campo numérico: pipeline universal entrega o texto CRU ao commit (validação decide)', has(S, 'function f355dPasteIntoNumber(el,txt){') && has(S, "el.onchange({target:{value:raw}})"));
ok('B11 botão aumentar [+] delegado (data-cqplus) chama cronQtyCommit(base+1)', has(S, "if(el=g('[data-cqplus]'))") && has(S, 'cronQtyCommit(_cqb+1)'));
ok('B12 botão diminuir [−] delegado (data-cqminus) respeita mínimo 1', has(S, "if(el=g('[data-cqminus]'))") && has(S, 'if(_cqc>1)cronQtyCommit(_cqc-1)'));
ok('B13 rótulo do mandato: "Quantidade de temas" + sufixo tema/temas', has(brief, 'Quantidade de temas</div>') && has(brief, "_cqn===1?'tema':'temas'"));
/* 14–18: validação */
ok('B14 zero → 1 com mensagem (nunca silencioso: _cqErr acende p/ "0")', norm('0') === 1 && has(S, "f._cqErr=(raw!==''&&!(/^\\d+$/.test(raw)&&Number(raw)>=1))"));
ok('B15 negativo → 1 (com _cqErr) ', norm('-3') === 1);
ok('B16 decimal → piso (3.5→3) com _cqErr', norm('3.5') === 3);
ok('B17 letras → vazio no norm + _cqErr acusa no commit', norm('abc') === '' && norm('12abc') === '');
ok('B18 campo vazio ao AVANÇAR bloqueado no stepNext com a mensagem literal', has(S, "if(f.step===2&&f.sector&&secOf(f.sector).key==='cronograma'&&!cronQtyOf(f)){") && has(brief, 'id="cqErr" role="alert"') && has(brief, 'Informe uma quantidade inteira igual ou superior a 1.'));
/* 19–23: aumentar/diminuir */
ok('B19 aumentar preserva conteúdo (commit NUNCA toca itens ao crescer; só corta vazios ao diminuir)', has(S, 'function cronQtyCommit(newRaw){') && has(S, 'if(newN!==null&&Array.isArray(f.contents)&&f.contents.length>newN)f.contents.length=newN; /* só vazios chegam aqui */'));
ok('B20 diminuir itens VAZIOS corta direto (extra=0 ⇒ sem modal)', has(S, 'if(newN!==null&&newN<prevN&&extra>0){ f._cqPend=newN; openCronShrinkConfirm(extra,prevN,newN); return; }'));
ok('B21 diminuir com conteúdo → confirmação com contagem de preenchidos (tema/legenda/rico contam)', has(S, 'c.temaRich||c.legendaRich))extra++'), 1 && has(S, 'function openCronShrinkConfirm(extra,prevN,newN){') && has(S, 'conteúdo preenchido'));
ok('B22 Cancelar mantém tudo (data-cqshrinkcancel só apaga o pendente)', has(S, "if(el=g('[data-cqshrinkcancel]')){var _fc2=state.form;if(_fc2){delete _fc2._cqPend;}closeModal();render();return;}"));
ok('B23 Confirmar remove SÓ excedentes (contents.length=_cqPend; _openContent saneado)', has(S, "if(el=g('[data-cqshrinkok]')){var _fc1=state.form;if(_fc1&&typeof _fc1._cqPend==='number'){_fc1.cronQty=_fc1._cqPend;if(Array.isArray(_fc1.contents))_fc1.contents.length=_fc1._cqPend;"));
/* 24–29: avançar/voltar/Revisão/salvar/reabrir/editar */
ok('B24 curSub() do cronograma = subtipo sintético (Revisão/composedDesc/save herdam contentCount)', has(S, "if(secOf(state.form.sector).key==='cronograma')return synthCronSub(cronQtyOf(state.form),state.form);"));
ok('B25 Revisão usa sub.contentCount (pipeline idêntico ao aprovado)', has(seg('function stepReview(){', 'function canSendToClient(f){', 'review'), 'sub.contentCount'));
ok('B26 salvar: cronContents compacta preenchidos (inalterado) e cronSub SÓ com subtype legado', has(S, "if(f.subtype)data.cronSub=f.subtype;") && has(S, "var _cc=(Array.isArray(f.contents)?f.contents:[]).filter(function(c){return c&&(c.tema||c.legenda);}); if(_cc.length)data.cronContents=_cc;"));
ok('B27 reabrir/editar legado: contagem REAL do array PRIMEIRO, depois mapa semanal/quinzenal/mensal', qof({ id: 'x', subtype: 'semanal', contents: new Array(7).fill({}) }) === 7 && qof({ id: 'x', subtype: 'semanal', contents: [] }) === 3);
ok('B28 newForm ganhou cronQty:null (modelo do wizard)', has(S, 'videoQty:null,scriptQty:null,cronQty:null,'));
ok('B29 bind #fCronQty + onchange → cronQtyCommit (digitação espelha; commit valida)', has(S, "bind('#fCronQty',e=>{state.form.cronQty=e.value;})") && has(S, 'cronQtyCommit(ev&&ev.target?ev.target.value:_cqEl.value)'));
/* 30–35: portal/aprovação/legados */
ok('B30 sem migração destrutiva: nenhuma escrita de cronSub para custom; abrir tarefa NÃO regrava', !has(S, "data.cronSub='c'") && !has(S, 'cronSub:"c'));
const W = fs.readFileSync(process.env.WSRC ? path.resolve(process.env.WSRC) : path.resolve(ROOT, '..', 'cloudflare-worker.js'), 'utf8');
ok('B31 portal (Worker congelado): render por cronWeeks||cronContents (array, qualquer N)', has(W, 'Array.isArray(task.cronWeeks) ? task.cronWeeks : (Array.isArray(task.cronContents) ? task.cronContents : [])'));
ok('B32 portal fallback de rótulo "Cronograma" p/ custom (sem freq/cronFrequency)', has(W, 'return map[f] || (f ? f.charAt(0).toUpperCase() + f.slice(1) : "Cronograma");'));
ok('B33 legado semanal→3 (abre/edita com fields ORIGINAIS preservados)', qof({ id: 'x', subtype: 'semanal' }) === 3 && (synth(3, { id: 'x', subtype: 'semanal' }).fields || []).some(f => f.k === 'semana_ref'));
ok('B34 legado quinzenal→6 + checklist original preservado', qof({ id: 'x', subtype: 'quinzenal' }) === 6 && (synth(6, { id: 'x', subtype: 'quinzenal' }).checklist || [])[0] === 'ck-qui');
ok('B35 legado mensal→12 + formTitle honesto com contagem real', qof({ id: 'x', subtype: 'mensal' }) === 12 && /Cronograma mensal — 12 conteúdos/.test(synth(12, { id: 'x', subtype: 'mensal' }).formTitle));
ok('B36 criação nova: campos neutros (Período de referência + Canais) e checklist genérico; teto técnico 500 com aviso claro', (synth(4, {}).fields || []).some(f => f.k === 'periodo') && (synth(4, {}).fields || []).some(f => f.k === 'canais') && norm('501') === 500 && has(S, "flashToast('Quantidade máxima por tarefa: '+CRON_QTY_MAX+' conteúdos (limite técnico). Para mais, divida em tarefas.')"));

console.log('— C) COLAGEM UNIVERSAL (mandato 1–40) —');
const uni = seg('/* ════ F3.5.5D — COLAGEM UNIVERSAL', 'function composedDesc(){', 'universal');
ok('C1 Ctrl+V/Meta+V determinístico no document (captura) via IPC — preventDefault ANTES do IPC (nunca cola em dobro)', has(uni, "document.addEventListener('keydown'") && has(uni, "ev.preventDefault(); ev.stopPropagation(); f353PasteFromClipboard(el)"));
ok('C2 Shift+Insert coberto pelo MESMO handler', has(uni, "(ev.key==='Insert'||ev.keyCode===45)") && has(uni, 'ev.shiftKey&&isIns'));
ok('C3 menu nativo com Colar: módulo editContextMenu ligado no createWindow do main', has(MAIN, 'attachEditContextMenu(mainWin.webContents, { Menu') && has(ECM, '{ role: "paste", label: "Colar", enabled: !!ef.canPaste }'));
ok('C4/C5 texto curto e longo: inserção via f353InsertPlainText (setRangeText no cursor) reutilizada', has(uni, 'f353InsertPlainText(el,txt)'));
ok('C6/C7/C8 acentos/emojis/quebras: caminho text/plain puro sem transformação além de \\r\\n→\\n', has(extract('f353InsertPlainText'), "replace(/\\r\\n/g,'\\n').replace(/\\r/g,'\\n')"));
ok('C9–C12 substituição de seleção/meio/início/fim: setRangeText(s,e,\'end\') preservado (provas f353 P3/P4 verdes)', has(extract('f353InsertPlainText'), "el.setRangeText(t, s, e, 'end')"));
ok('C13/C14 desfazer/refazer: roles nativos undo/redo no menu + NENHUM interceptador novo de Ctrl+Z/Y', has(ECM, '{ role: "undo", label: "Desfazer"') && has(ECM, '{ role: "redo", label: "Refazer"') && !has(uni, "key==='z'") && !has(uni, "key==='y'"));
ok('C15/C16/C17 recortar/copiar/selecionar tudo: roles nativos com gating por editFlags/seleção', has(ECM, '{ role: "cut", label: "Recortar", enabled: !!ef.canCut && hasSel }') && has(ECM, '{ role: "copy", label: "Copiar", enabled: !!ef.canCopy && hasSel }') && has(ECM, '{ role: "selectAll", label: "Selecionar tudo", enabled: !!ef.canSelectAll }'));
ok('C18/C19 Word/Google Docs: RTE cola via _rtePasteApply (rteSanitize) também no fallback IPC (clipboardReadHTML)', has(uni, 'f355dRtePasteViaIPC(ed)') && has(uni, 'clipboardReadHTML') && has(S, '_rtePasteApply(ed,String(htmlD||\'\'),String(txt||\'\'))'));
ok('C20–C23 WhatsApp/navegador/bloco de notas/ChatGPT: text/plain universal (mesmo caminho C4–C8)', has(uni, "ev.clipboardData.getData&&ev.clipboardData.getData('text/plain')"));
ok('C24 HTML em campo SIMPLES: entra SEMPRE texto puro (nunca tags — handler de paste ignora text/html)', has(uni, 'campos simples SEMPRE recebem texto PURO no cursor (HTML nunca entra em input/textarea)') && !has(uni, "f353InsertPlainText(el,ev.clipboardData.getData('text/html')"));
ok('C25–C28 script/iframe/onclick/javascript:: sanitizador do RTE INTOCADO decide (pins f355c D-block verdes)', has(S, 'function rteSanitize(html){'));
ok('C29 CSS remoto: allowlist do sanitizador inalterada (sem link/@import no RTE)', has(S, 'function rteSanitize'));
ok('C30 campo desabilitado excluído (guard no elegível universal + choke-point de inserção f353)', has(uni, 'if(el.readOnly||el.disabled)return null;') && has(extract('f353InsertPlainText'), 'if(el.readOnly||el.disabled) return false;'));
ok('C31 campo read-only excluído no renderer E no menu nativo (isEditable=false ⇒ null)', has(ECM, 'if (!p.isEditable) return null;'));
ok('C32 campo numérico: colar valida SEM corrigir silenciosamente (raw vai ao commit; letras acusam)', has(uni, "if(/^\\d+$/.test(raw)){ try{ el.value=raw; }catch(_){} try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){} }"));
ok('C33/C34 accordions e modais: pipeline no DOCUMENT (captura) alcança qualquer campo montado', has(uni, "document.addEventListener('paste'") && has(uni, 'document.__f355dPaste'));
ok('C35/C36 Briefing/Revisão: mesmos campos (input/textarea/rte) cobertos sem fiação por-formulário', has(uni, 'f355dEditableTextEl(t)'));
ok('C37/C38 salvar/reabrir: inserção dispara Event(input) → binds existentes persistem (nenhum listener duplicado)', has(extract('f353InsertPlainText'), "el.dispatchEvent(new Event('input',{bubbles:true}))") && (uni.match(/addEventListener\('keydown'/g) || []).length === 1);
ok('C39 fora de campo editável: NADA (comentário-contrato + nenhum ramo de ação)', has(uni, 'fora de campo editável: NADA'));
ok('C40 sem regressão de formatação: RTE nativo continua no handler próprio (universal IGNORA .rte-ed no paste)', has(uni, "if(t&&t.closest&&t.closest('.rte-ed'))return;"));

console.log('— C+) MENU NATIVO DE PRODUÇÃO (hermético, dist real) —');
const ecm = require2(path.join(DIST, 'editContextMenu.js'));
const tpl = ecm.buildEditMenuTemplate({ isEditable: true, selectionText: 'abc', editFlags: { canUndo: true, canRedo: false, canCut: true, canCopy: true, canPaste: true, canSelectAll: true } });
ok('M1 editável: 8 itens (6 ações + 2 separadores) na ordem Desfazer/Refazer/Recortar/Copiar/Colar/Selecionar tudo', Array.isArray(tpl) && tpl.length === 8 && tpl.filter(i => i.label).map(i => i.label).join('|') === 'Desfazer|Refazer|Recortar|Copiar|Colar|Selecionar tudo');
ok('M2 roles nativos (undo/redo/cut/copy/paste/selectAll) — nada de execCommand como arquitetura', tpl.filter(i => i.role).map(i => i.role).join('|') === 'undo|redo|cut|copy|paste|selectAll' && !has(ECM, 'document.execCommand'));
ok('M3 gating: canRedo=false ⇒ Refazer desabilitado; demais habilitados', tpl.find(i => i.role === 'redo').enabled === false && tpl.find(i => i.role === 'paste').enabled === true && tpl.find(i => i.role === 'undo').enabled === true);
const tplNoSel = ecm.buildEditMenuTemplate({ isEditable: true, selectionText: '', editFlags: { canUndo: true, canRedo: true, canCut: true, canCopy: true, canPaste: true, canSelectAll: true } });
ok('M4 sem seleção ⇒ Recortar/Copiar desabilitados (ação indisponível aparece desabilitada)', tplNoSel.find(i => i.role === 'cut').enabled === false && tplNoSel.find(i => i.role === 'copy').enabled === false && tplNoSel.find(i => i.role === 'paste').enabled === true);
ok('M5 clipboard vazio ⇒ Colar desabilitado (canPaste=false)', ecm.buildEditMenuTemplate({ isEditable: true, selectionText: '', editFlags: { canPaste: false } }).find(i => i.role === 'paste').enabled === false);
ok('M6 NÃO editável (botão/card/label/readonly) ⇒ null (nenhum menu)', ecm.buildEditMenuTemplate({ isEditable: false, editFlags: { canPaste: true } }) === null && ecm.buildEditMenuTemplate(null) === null);
{ let popped = 0, logged = [];
  const wcFake = { h: {}, on(e, cb) { this.h[e] = cb; }, emit(e, ...a) { this.h[e] && this.h[e](...a); } };
  ecm.attachEditContextMenu(wcFake, { Menu: { buildFromTemplate: () => ({ popup: () => { popped++; } }) }, onLog: (e, p) => logged.push([e, p]) });
  wcFake.emit('context-menu', {}, { isEditable: true, selectionText: '', editFlags: { canPaste: true } });
  wcFake.emit('context-menu', {}, { isEditable: false });
  ok('M7 attach: popup SÓ para editável (1 de 2 eventos) + log sem conteúdo de campo/clipboard', popped === 1 && logged.length === 1 && logged[0][0] === 'edit.contextmenu.shown' && JSON.stringify(logged[0][1]) === '{"editable":true}');
  const wcThrow = { h: {}, on(e, cb) { this.h[e] = cb; }, emit(e, ...a) { this.h[e] && this.h[e](...a); } };
  ecm.attachEditContextMenu(wcThrow, { Menu: { buildFromTemplate: () => { throw new Error('boom'); } } });
  let threw = false; try { wcThrow.emit('context-menu', {}, { isEditable: true, editFlags: {} }); } catch { threw = true; }
  ok('M8 exceção interna NUNCA derruba a janela (try/catch no handler)', threw === false);
}
console.log('— C++ ) COMPORTAMENTO HERMÉTICO do pipeline (funções reais) —');
ok('H1 elegibilidade: textarea/input-text sim; number/date/botão/readonly/disabled não', !!txtEl(el('textarea')) && !!txtEl(el('input', 'text')) && !txtEl(el('input', 'number')) && !txtEl(el('input', 'date')) && !txtEl(el('button')) && !txtEl(el('input', 'text', { readOnly: true })) && !txtEl(el('input', 'text', { disabled: true })));
ok('H2 numérico: input[type=number] elegível; readonly/disabled não; textarea não', !!numEl(el('input', 'number')) && !numEl(el('input', 'number', { readOnly: true })) && !numEl(el('input', 'number', { disabled: true })) && !numEl(el('textarea')));
{ const e1 = el('input', 'number', { onchange(ev) { this.gotRaw = ev.target.value; } });
  pasteNum(e1, ' 12 ');
  ok('H3 colar "12" (com espaços): trim → value=12 + input + onchange({value:"12"}) p/ o commit validar', e1.value === '12' && e1.events.includes('input') && e1.gotRaw === '12');
  const e2 = el('input', 'number', { onchange(ev) { this.gotRaw = ev.target.value; } });
  e2.value = '5'; pasteNum(e2, 'abc');
  ok('H4 colar "abc": valor NÃO corrompido (segue 5) e o commit recebe o cru p/ ACUSAR (mensagem)', e2.value === '5' && e2.gotRaw === 'abc');
  const e3 = el('input', 'number', { onchange(ev) { this.gotRaw = ev.target.value; } });
  e3.value = '5'; pasteNum(e3, '-3'); const negRaw = e3.gotRaw; pasteNum(e3, '2.5');
  ok('H5 negativo/decimal vão CRUS ao commit (validação central decide; sem correção silenciosa aqui)', negRaw === '-3' && e3.gotRaw === '2.5' && e3.value === '5');
  const e4 = el('input', 'number'); pasteNum(e4, '   ');
  ok('H6 clipboard vazio/espaços: no-op absoluto', e4.value === '' && e4.events.length === 0);
}

console.log('— D) SEGURANÇA —');
ok('D1 rteSanitize byte-preservado (âncora + remoções de perigo presentes)', has(S, 'function rteSanitize(html){') && has(S, 'javascript:'));
ok('D2 CSP intocada: index sem meta CSP nova; bgnotify/slareminder mantêm CSP restritiva; sem unsafe-eval em lugar nenhum', !has(S, 'Content-Security-Policy') && has(R('src/renderer/bgnotify.html'), "Content-Security-Policy") && has(R('src/renderer/slareminder.html'), "Content-Security-Policy") && !has(S, 'unsafe-eval') && !has(MAIN, 'unsafe-eval'));
ok('D3 contextIsolation:true + nodeIntegration:false preservados no main', has(MAIN, 'contextIsolation: true') && has(MAIN, 'nodeIntegration: false'));
ok('D4 IPC clipboard-read-html: read-only, sem log de conteúdo (comentário-contrato + nenhum diag com payload)', has(MAIN, 'ipcMain.handle("clipboard-read-html", () => { try { return String(clipboard.readHTML() || ""); } catch { return ""; } });') && has(MAIN, 'NUNCA é registrado em log/telemetria'));
ok('D5 pipeline universal NÃO loga conteúdo de clipboard (nenhum console/diag com txt/raw no módulo)', !/console\.(log|info|warn)\([^)]*(txt|raw)/.test(uni) && !/diagLog\([^)]*(txt|raw)/.test(uni));
ok('D6 menu nativo sem exposição extra de clipboard ao renderer (só roles; nenhum ipc no módulo)', !has(ECM, 'ipcMain') && !has(ECM, 'clipboard.'));
ok('D7 preload expõe clipboardReadHTML SÓ como invoke read-only (par com clipboardReadText)', has(PRELOAD, 'clipboardReadHTML: (): Promise<string> => ipcRenderer.invoke("clipboard-read-html")'));

console.log('— E) CONGELADOS / ISOLAMENTO —');
ok('E1 F3.5.5C-H2 intacta: taskGate/invalidateTerminal/cleanupStale seguem no slaReminder.ts', (() => { const s = R('src/main/slaReminder.ts'); return has(s, 'taskGate') && has(s, 'invalidateTerminal') && has(s, 'cleanupStale') && has(s, 'Esta tarefa já foi encerrada.'); })());
ok('E2 F3.5.5C-H1 intacta: auth-core.ts com autoridade do servidor preservada', has(R('src/main/auth-core.ts'), 'self'));
ok('E3 Roteiro (scriptQty) e Vídeos (videoQty) intactos: steppers e commits preservados', has(S, 'function scriptQtyCommit(newRaw){') && has(S, 'function synthScriptSub(n){') && has(S, 'function synthVideoSub(n){') && has(brief, 'id="fScriptQty"') && has(brief, 'id="fVideoQty"'));
ok('E4 Copywriting mantém subtypes/Periodicidade (fora do escopo, intocado)', has(S, "copywriting:{titleLabel:'Título da copy'") && has(S, "subLabel:'Periodicidade',subtypes:{") && has(seg('  copywriting:{', '  roteiro:{', 'copysec'), 'semanal'));
ok('E5 f353 preservado: funções/wiring/guards state.form + menu DOM substituído por passthrough documentado', has(S, 'function f353WirePasteRecovery(root){') && has(S, 'menu nativo assume (main.ts editContextMenu)') && (S.match(/if\(!state\.form\) return;/g) || []).length >= 3);
ok('E6 config legada do cronograma INTACTA (subtypes semanal/quinzenal/mensal com contentCount 3/6/12 p/ compat)', has(S, "semanal:{label:'Semanal',formTitle:'Cronograma semanal — 3 conteúdos',contentCount:3") && has(S, "mensal:{label:'Mensal',formTitle:'Cronograma mensal — 12 conteúdos',contentCount:12"));
ok('E7 removeMenu preservado (sem app-menu novo) — menu de contexto é a única superfície nova', has(MAIN, 'mainWin.removeMenu();') && !has(MAIN, 'setApplicationMenu'));

console.log('');
console.log('F3.5.5D cron-quantity+universal-paste: ' + (n - fails) + '/' + n + ' — ' + (fails ? 'FALHOU' : 'VERDE'));
if (fails) process.exit(1);
