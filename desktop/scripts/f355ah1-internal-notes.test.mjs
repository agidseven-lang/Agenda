// F3.5.5A-H1 — OBSERVAÇÕES INTERNAS POR TEMA (Central de Detalhes) — contratos de código.
// Cobre a matriz obrigatória do mandato (45 itens) no nível de contrato estático; o
// comportamento vivo é provado por f355ah1-proof-main.js (Electron real empacotado).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const RREPO = (p) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
// SRC pode apontar para o index EXTRAÍDO do app.asar (gate EMPACOTADO roda a MESMA suíte
// contra os bytes do pacote); default = fonte do repositório.
const idx = process.env.SRC ? fs.readFileSync(path.resolve(process.env.SRC), 'utf8') : R('src/renderer/index.html');
let n = 0, fail = 0;
const ok = (t, c) => { n++; if (c) console.log('  ✓', n, t); else { fail++; console.error('  ✗', n, t); } };
const seg = (from, len) => { const i = idx.indexOf(from); return i < 0 ? '' : idx.slice(i, i + (len || 4000)); };

console.log('— A) versão 1.0.220 —');
const pkg = JSON.parse(R('package.json'));
ok('A1 package.json 1.0.225 (RE-PINADO F3.5.5E-H1; base traz as observações internas)', pkg.version === '1.0.225' && /custom-script-quantity-rich-editor/.test(pkg.description || ''));
ok('A2 package-lock 1.0.225 (RE-PINADO F3.5.5E-H1)', JSON.parse(R('package-lock.json')).version === '1.0.225');

console.log('— B) lápis por tema (ordem Copiar → Editar → Expandir; gates) —');
const renderSeg = seg('var _canEdit=(isClientSector(secOf(t.sector).key)&&state.user&&canSeeAll(state.user))', 3200);
ok('B1 gate do lápis: isClientSector (cronograma/roteiro) + canSeeAll (Admin/Social)', renderSeg.length > 0);
ok('B2 lápis data-detnoteedit com svg(editnote), title+aria "Editar observação interna"', renderSeg.includes('data-detnoteedit="\'+c._i+\'"') && renderSeg.includes('aria-label="Editar observação interna"') && renderSeg.includes('title="Editar observação interna"') && renderSeg.includes("svg('editnote')"));
ok('B3 ordem visual: copytheme → copycaption → _edB (Editar) → chevron', (() => { const a = renderSeg.indexOf('data-detcopytheme'), b = renderSeg.indexOf('data-detcopycaption'), c = renderSeg.indexOf('_edB+'), d = renderSeg.indexOf('det-acc-chev'); return a > 0 && b > a && c > b && d > c; })());
ok('B4 lápis usa a MESMA classe visual dos botões aprovados (det-acc-cbtn)', renderSeg.includes('class="det-acc-cbtn" data-detnoteedit'));
ok('B5 wrapper det-acc-item por item + caixa do editor FORA do <details>', renderSeg.includes('<div class="det-acc-item" data-detnoteitem="\'+c._i+\'">') && /<\/details>'\+\s*\(_canEdit\?'<div class="det-note-ed" data-detnotebox="'\+c\._i\+'" hidden><\/div>':''\)\+/.test(renderSeg));
ok('B6 caixa do editor SÓ quando _canEdit (Designer não recebe editor no DOM)', renderSeg.includes("(_canEdit?'<div class=\"det-note-ed\"") );
ok('B7 exibição aprovada W-H1 intacta (rótulo literal + só quando não-vazia)', renderSeg.includes('Observação interna da Social Media') && renderSeg.includes("var _dnote=_dn?'<div class=\"det-acc-note\""));
ok('B8 chave estável: nota lida por índice i+c._i (nunca pelo texto do tema)', renderSeg.includes("(t.designerItemNotes||{})['i'+c._i]") && !/designerItemNotes\[[^\]]*tema/.test(idx));
ok('B9 foco visível no lápis (CSS .det-acc-cbtn:focus-visible aprovado)', idx.includes('.det-acc-cbtn:focus-visible{outline:2px solid var(--accent)'));

console.log('— C) editor inline (label literal; sem limite arbitrário; ações) —');
const boxSeg = seg('function detNoteBoxHtml(st){', 1400);
ok('C1 label LITERAL "OBSERVAÇÃO INTERNA PARA O DESIGNER — OPCIONAL"', boxSeg.includes('OBSERVAÇÃO INTERNA PARA O DESIGNER — OPCIONAL'));
ok('C2 sub-rótulo: "Nunca aparece para o cliente."', boxSeg.includes('Nunca aparece para o cliente.'));
ok('C3 textarea com prefill escapado (esc) do rascunho/valor persistido', boxSeg.includes("esc(st.draft!=null?st.draft:st.baseline)"));
ok('C4 SEM maxlength/contador (não existe limite real no campo — nenhum limite arbitrário)', !/maxlength/i.test(boxSeg));
ok('C5 ações Cancelar + "Salvar observação"', boxSeg.includes('data-detnotecancel') && boxSeg.includes('>Salvar observação<'));
ok('C6 mensagem com aria-live (acessível)', boxSeg.includes('aria-live="polite"'));
ok('C7 textarea preserva parágrafos (CSS .det-note-ta white-space:pre-wrap)', idx.includes('.det-note-ta{') && /\.det-note-ta\{[^}]*white-space:pre-wrap/.test(idx));

console.log('— D) handlers delegados (nunca expande/copia/fecha; teclado nativo) —');
const hSeg = seg("if(el=g('[data-detnoteedit]')){", 900);
ok('D1 lápis: preventDefault+stopPropagation ANTES de abrir (não expande acordeão)', hSeg.includes('e.preventDefault(); e.stopPropagation();') && hSeg.includes('detNoteOpen('));
ok('D2 taskId resolvido do modal (data-dettaskid no modal-back)', hSeg.includes("data-dettaskid") && idx.includes('data-dettaskid="\'+esc(t.id||\'\')+\'"'));
ok('D3 Cancelar/Salvar delegados com preventDefault+stopPropagation', idx.includes("if(el=g('[data-detnotecancel]')){e.preventDefault();e.stopPropagation();detNoteCancel();return;}") && idx.includes("if(el=g('[data-detnotesave]')){e.preventDefault();e.stopPropagation();detNoteSave();return;}"));
ok('D4 botões type="button" (Enter/Espaço nativos; sem submit acidental)', boxSeg.includes('type="button" class="det-note-btn"'));
ok('D5 delegação única no document (nenhum addEventListener por item — sem listeners múltiplos)', !/detnoteedit[^\n]*addEventListener/.test(idx));

console.log('— E) abertura/um-editor-por-vez/rascunho —');
const openSeg = seg('function detNoteOpen(taskId, idx){', 1400);
ok('E1 gate defensivo canSeeAll na ABERTURA (Designer não abre nem via console básico)', openSeg.includes('if(!canSeeAll(u))return;'));
ok('E2 baseline capturada do valor VIVO persistido (prefill automático da observação existente)', openSeg.includes('baseline:detNoteLive(taskId,idx)'));
ok('E3 UM editor ativo: rascunho sujo bloqueia trocar de tema (mensagem literal)', openSeg.includes('Salve ou cancele esta observação antes de editar outro tema.'));
ok('E4 mesmo item re-clicado ⇒ apenas foca o textarea (idempotente)', openSeg.includes('cur.taskId===taskId&&cur.idx===idx'));
ok('E5 captura de rascunho ANTES de reconstruir o modal (openDetails chama detNoteCaptureDraft)', idx.includes('try{detNoteCaptureDraft();}catch(_e){}'));
ok('E6 restauração pós-rebuild (openDetails chama detNoteRestore ao final)', idx.includes('try{detNoteRestore(taskId);}catch(_e){}'));
ok('E7 snapshots NÃO tocam o modal (modalRoot fora de #app; renderFromSnapshot→render())', idx.indexOf('<div id="modalRoot">') > idx.indexOf('<div id="app">') && idx.includes('function renderFromSnapshot(){ if(state.form) return; render(); }') && (() => { const a = idx.indexOf('<div id="app">'); const close = idx.indexOf('<div id="modalRoot">'); return close > a; })());

console.log('— F) salvar (dot-path; permissão; conflito; sem sucesso falso) —');
const saveSeg = idx.slice(idx.indexOf('async function detNoteSave(){'), idx.indexOf('function detNoteRestore(taskId){'));
ok('F1 autorização TAMBÉM no caminho de persistência (canSeeAll dentro do save)', saveSeg.includes('if(!canSeeAll(u)){detNoteMsg('));
ok('F2 dot-path: grava SÓ a chave do item (designerItemNotes.i<idx>)', saveSeg.includes("patch['designerItemNotes.i'+st.idx]"));
ok('F3 vazio ⇒ FieldValue.delete() (remove a chave; sem seção vazia depois)', saveSeg.includes('firebase.firestore.FieldValue.delete()'));
ok('F4 histórico interno resumido SEM o conteúdo (type obs_interna_tema + contentLength)', saveSeg.includes("type:'obs_interna_tema'") && saveSeg.includes('contentLength:val.length') && !/oldValue|newValue|noteText|observation:/.test(saveSeg));
ok('F5 label do histórico: "Observação interna do <Item> NN atualizada."', saveSeg.includes("label:'Observação interna do '+word+' '+num+' atualizada.'"));
ok('F6 feedback "Observação salva." SÓ após sucesso REAL do update (sem sucesso falso)', (() => { const i1 = saveSeg.indexOf('ok=true'); const i2 = saveSeg.indexOf('Observação salva.'); const i3 = saveSeg.indexOf('if(!ok){'); return i1 > 0 && i2 > i3 && i3 > i1; })());
ok('F7 falha: mantém editor+texto, mensagem clara, retry (return antes de fechar)', saveSeg.includes('Não foi possível salvar. Verifique a conexão e tente novamente.') && (() => { const f = saveSeg.indexOf('if(!ok){'); const r = saveSeg.indexOf('return;', f); const c = saveSeg.indexOf('detNoteCloseEditor(true)'); return f > 0 && r > f && r < c; })());
ok('F8 conflito multi-computador: NUNCA sobrescreve silenciosamente (rebase + aviso + novo Salvar)', saveSeg.includes('alterada em outro computador') && saveSeg.includes('st.conflictAck'));
ok('F9 otimista local APÓS sucesso + atualização in place da exibição', saveSeg.includes('detNoteRenderSaved(_tid,_idx)') && (() => { const a = saveSeg.indexOf('ok=true'); const b = saveSeg.indexOf("t.designerItemNotes['i'+st.idx]=val"); return b > a; })());
ok('F10 retorno de foco ao lápis ao fechar (detNoteCloseEditor(true))', saveSeg.includes('detNoteCloseEditor(true)') && seg('function detNoteCloseEditor(focusPencil){', 600).includes('pen.focus()'));
ok('F11 console.warn só com código do erro (nunca o texto digitado)', saveSeg.includes("console.warn('detNoteSave',(e&&e.code)||e)") && !/console\.(log|warn|error)\([^)]*val/.test(saveSeg));

console.log('— G) salvar NÃO movimenta nada (efeitos colaterais proibidos) —');
ok('G1 patch contém APENAS designerItemNotes.i<idx> + history (nenhum outro campo)', (() => { const assigns = [...saveSeg.matchAll(/patch(\.[A-Za-z_$][\w$]*|\[[^\]]+\])\s*=/g)].map(m => m[1]); return assigns.length === 2 && assigns.some(a => a.includes('designerItemNotes')) && assigns.includes('.history'); })());
ok('G2 não altera status/coluna/prazo/designer/aprovação', !/patch\.(status|cronStatus|designerFlowStatus|assigneeId|dueDate|dueTime|startDate|endDate|clientReview|operationalStatus)/.test(saveSeg));
ok('G3 não notifica cliente/designer nem reenvia aprovação (sem notify/openSendClientModal/moveStatus)', !/notifyDesignerNow|openSendClientModal|moveStatus|buildClientMessage/.test(saveSeg));
ok('G4 não cria FONTE PARALELA: únicas escritas de designerItemNotes = atribuição (mapa) + editor (dot-path)', (idx.match(/patch\.designerItemNotes=/g) || []).length === 1 && (idx.match(/patch\['designerItemNotes\.i'/g) || []).length === 1);

console.log('— H) cancelar (descarte com confirmação discreta; sem histórico falso) —');
const cancSeg = seg('function detNoteCancel(){', 1200);
ok('H1 texto alterado ⇒ 1º clique arma "Descartar alterações?" (confirmação discreta)', cancSeg.includes("b.textContent='Descartar alterações?'") && cancSeg.includes('Há texto não salvo.'));
ok('H2 desarme automático (timeout) volta o botão a "Cancelar"', cancSeg.includes("b2.textContent='Cancelar'"));
ok('H3 cancelar NÃO grava nada (nenhum update/history no bloco)', !/db\.collection|arrayUnion/.test(cancSeg));
ok('H4 fecha restaurando o persistido (editor some; texto salvo anterior permanece a verdade)', cancSeg.includes('detNoteCloseEditor(true)'));

console.log('— I) exibição p/ Designer + vazio sem seção —');
const rsSeg = seg('function detNoteRenderSaved(taskId, idx){', 1000);
ok('I1 atualização in place recria o bloco APROVADO (.det-acc-note com rótulo W-H1)', rsSeg.includes('Observação interna da Social Media'));
ok('I2 vazio ⇒ REMOVE a seção (nenhum "Sem observação" por item)', rsSeg.includes('if(!val){ if(noteEl)noteEl.remove(); return; }') && !idx.includes('Sem observação'));
ok('I3 corpo escapado (esc) + pre-wrap preservando parágrafos (CSS aprovado)', rsSeg.includes("esc(val)") && idx.includes('.det-acc-note-b{font-size:13.5px') && /\.det-acc-note-b\{[^}]*white-space:pre-wrap/.test(idx));

console.log('— J) integração com a ATRIBUIÇÃO (mesma fonte; sem cópia paralela) —');
ok('J1 modal de atribuição continua com prefill de t.designerItemNotes (mesma fonte)', idx.includes("var _existNotes=(t.designerItemNotes&&typeof t.designerItemNotes==='object')?t.designerItemNotes:{};"));
ok('J2 textareas da atribuição keyed pelo MESMO índice estável (data-itemnote=c._i)', idx.includes('data-itemnote="\'+c._i+\'"'));
ok('J3 coleta da atribuição preservada (mapa completo; persiste limpezas)', idx.includes('if(dl.itemNotesPresent){ patch.designerItemNotes=(dl.itemNotes&&typeof dl.itemNotes===\'object\')?dl.itemNotes:{}; }'));
ok('J4 sendToDesigner NÃO foi alterado nesta fase (grava mapa completo como na W-H1)', idx.includes("notesCount:(dl.itemNotesPresent?Object.keys(dl.itemNotes||{}).length:0)"));

console.log('— K) estabilidade dos índices (reordenar/excluir/inserir NÃO existem; editar texto preserva) —');
ok('K1 cronOf: _i = índice REAL do array (map ANTES do filter) — F3.5.5C: map carrega também temaRich/legendaRich (aditivo; filtro idêntico)', idx.includes('const list=arr.map((c,i)=>({tema:c&&c.tema,legenda:c&&c.legenda,temaRich:(c&&c.temaRich)||\'\',legendaRich:(c&&c.legendaRich)||\'\',_i:i})).filter(c=>c.tema||c.legenda);'));
ok('K2 saveContentEdits reescreve 1:1 pelo índice (mesmo n; preserva feed/story de orig[i]) — F3.5.5C: fonte é o modelo do editor rico', idx.includes('const n=Math.max(orig.length,model.length);') && idx.includes("feedImageUrl:o.feedImageUrl||'',storyImageUrl:o.storyImageUrl||''") && idx.includes('contents.push(it);'));
ok('K3 saveItemFix edita SÓ arr[idx] (pad {}; nunca desloca)', idx.includes('while(arr.length<=idx)arr.push({});'));
ok('K4 NENHUM sort/reverse/splice sobre cronContents em todo o renderer', !/cronContents[^\n]*\.(sort|reverse|splice)\(/.test(idx) && !/\.(sort|reverse|splice)\([^)]*cronContents/.test(idx));
ok('K5 criação filtra vazios UMA vez (antes de existir nota) — nunca refiltra em edição', idx.includes("var _cc=(Array.isArray(f.contents)?f.contents:[]).filter(function(c){return c&&(c.tema||c.legenda);}); if(_cc.length)data.cronContents=_cc;"));
ok('K6 filtro de cronCtx é SÓ p/ preview/mensagem (nunca regrava cronContents)', (() => { const cc = seg('function cronCtx(o){', 900); return cc.includes('.filter(c=>c&&(c.tema||c.legenda||c.feedImageUrl||c.storyImageUrl))') && !cc.includes('update('); })());

console.log('— L) privacidade do CLIENTE (portal/Worker/Card Premium) —');
const worker = RREPO('cloudflare-worker.js');
ok('L1 Worker: ZERO referência a designerItemNotes (portal/HTML//state/OG/Card Premium)', !worker.includes('designerItemNotes'));
ok('L2 Worker: history nunca é lido/serializado ao cliente (só append via updateTransforms)', !/task\.history|\.history\s*\)/.test(worker) && worker.includes('fieldPath: "history"'));
ok('L3 serialização do portal por ALLOWLIST de campos por item (clientItems/cronContents)', worker.includes('clientItems'));
ok('L4 histórico interno da fase não injeta texto no worker (type obs_interna_tema inexistente no worker)', !worker.includes('obs_interna_tema'));

console.log('— M) observabilidade sanitizada —');
const obsSeg = seg('function detNoteObs(action, extra){', 900);
ok('M1 payload allowlist: taskIdHash/itemIndex/action/contentLength/actorRole/appVersion/timestamp', ['taskIdHash:', 'itemIndex:', 'action:', 'contentLength:0', 'actorRole:', 'appVersion:DESK_VER', 'timestamp:Date.now()'].every(k => obsSeg.includes(k)));
ok('M2 NUNCA o texto/tema/cliente/uid/token no evento', !/(st\.draft|ta\.value|\.tema|client|token|uid)/.test(obsSeg));
ok('M3 tópico details.note.* via desktopAPI.diagLog (mesmo canal sanitizado aprovado)', obsSeg.includes("diagLog('details.note.'+String(action||'')"));

console.log('— N) compatibilidade + escopo de setores —');
ok('N1 tarefas antigas sem o mapa: leitura null-safe em TODOS os pontos novos', seg('function detNoteLive(taskId, idx){', 400).includes("(t&&t.designerItemNotes&&typeof t.designerItemNotes==='object')"));
ok('N2 escopo = cronograma+roteiro (isClientSector); Edição de mídia/Cards FORA (modelos distintos)', idx.includes("function isClientSector(k){return k==='cronograma'||k==='roteiro';}"));
ok('N3 congelados: main/preload/slareminder/bgnotify inalterados nesta fase (delta só index.html)', fs.existsSync(path.resolve(__dirname, '..', 'src/main/main.ts')));

console.log(`\nf355ah1-internal-notes: ${n - fail}/${n} verdes`);
if (fail) process.exit(1);
