/* F3.5.4W-H1 — MAIN de prova (Electron REAL 31.3.1). Carrega o index.html REAL (mesmos bytes do
 * pacote) UMA vez, deixa o boot autenticar (authSelf resolve {ok:true,self:SELF}) e o subscribeData()
 * semear state.users/state.tasks a partir do Firestore stub (SEMENTE real). Depois navega pelo ESTADO
 * REAL e mede o DOM PRODUZIDO PELO CÓDIGO DE PRODUÇÃO (openDetails/kbv2Card/renderSocialBoard/
 * renderDesignerBoard/renderPersonBoard/openDesignerDeadline). Cada cena grava PNG REAL
 * (win.capturePage) + medições do DOM REAL e emite um PROOF_LINE. Sem file:///setContent/IA/mockup.
 *
 * Prova as entregas do F3.5.4W-H1:
 *   E2 — Central de Detalhes: tipografia (.det-acc-k 600/faint · .det-acc-t 15.5px/600 ·
 *        .det-acc-l 14px), botões Copiar tema/legenda GATED em conteúdo real, clique REAL
 *        (sendInputEvent) que NÃO expande/recolhe o <summary>, clipboard recebe o texto RAW
 *        byte-a-byte (acentos/emoji/quebras; sem número, sem "TEMA NN", sem entidades HTML),
 *        feedback .ok + "Tema copiado"/"Legenda copiada" com restauração ~1600ms, e
 *        observabilidade SANITIZADA (SÓ {contentType,contentLength,taskSector,appVersion,timestamp}).
 *   E3 — designer atribuído e NÃO iniciado (designerFlowStatus='afazer') bucketiza em "A Fazer" na
 *        Social/Setores/Meu quadro (chip "Aguardando designer iniciar"), paridade com o Designer;
 *        'andamento' → "Em andamento" nos DOIS quadros.
 *   E5 — observações internas por tema: textarea[data-itemnote] por tema no modal "Prazo para o
 *        designer" (SÓ setor de cliente com temas; edicao_midia = ZERO) e callout .det-acc-note
 *        ("Observação interna da Social Media") na Central SÓ nos itens com nota não-vazia (\n preservado).
 *   E1 — card do quadro preservado: altura INVARIANTE ao nº de conteúdos (1/12/50, Δ<=8px) e ZERO
 *        nós .kbv2-theme/.kbv2-themes-list no DOM do card (reuso da lógica d1_* do F3.5.4W). */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = process.env.PROOF_OUT || path.join(__dirname, 'out');
const SCALE = process.env.PROOF_SCALE || '1x';
const SCENES = (process.env.PROOF_SCENES || '').split(',').map(s => s.trim()).filter(Boolean);
const INDEX = path.join(__dirname, 'src', 'renderer', 'index.html');
const SEED_FILE = path.join(os.tmpdir(), 'f354wh1-seed.json');
const INVAR_DELTA = 8;   // E1: 50 conteúdos não pode ser mais alto que 1 conteúdo + folga

try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function line(o) { process.stdout.write('PROOF_LINE ' + JSON.stringify(o) + '\n'); }

/* ─────────────────────────── SEMENTE (estado real semeado) ───────────────────────────
   Users: 1 admin (SELF, canSeeAll) + 4 Social Media + 3 Designers (mesma equipe do F3.5.4W).
   Tasks: 9 — cronograma E2 (7 itens com tema curto/longo/acentos/emoji/"(sem tema)"/sem-legenda),
   edicao_cards (legenda real multi-linha), cronograma E3 (designer atribuído NÃO iniciado),
   cronograma E5 (3 temas p/ o modal de prazo), edicao_midia (ZERO notas por tema), cronograma E5
   com designerItemNotes {i0,i2}, e 3 cronogramas E1 com 1/12/50 conteúdos (invariância de altura). */
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQ4y2NgGAWjYBSMglEwCkbBKBgFo4CoAAAJUgABYjq9nQAAAABJRU5ErkJggg==';
const ID = {
  SELF: 'u-self-admin',
  ANA: 'u-soc-ana', BRUNO: 'u-soc-bruno', CARLA: 'u-soc-carla', DIANA: 'u-soc-diana',
  DIEGO: 'u-des-diego', ELENA: 'u-des-elena', FELIPE: 'u-des-felipe'
};

/* E2 — strings CANÔNICAS (a prova compara o clipboard BYTE-A-BYTE com estes literais). */
const TEMA_SHORT = 'Café da manhã';
const TEMA_LONG = 'Promoção de Inverno — Açaí & Café ☕🔥 "Dia D" & \'Noite N\' <3 · edição especial nº 02 com acentos: ação, coração, você — um tema propositalmente muito longo para quebrar em múltiplas linhas no cabeçalho do acordeão da Central de Detalhes 😀🎉💜';
const LEG_LONG = 'Primeira linha da legenda 🎯 com acentos: ação, coração, você & <b>não-HTML</b>.\n\nSegunda seção após linha em branco — "aspas", \'apóstrofos\', ümlaut, ñ.\nTerceira linha com emoji 🚀✨ e #hashtag @menção!';
const CARDS_LEG = 'Aproveite o Dia dos Pais na Ótica Clara 👓.\nDescontos de até 40% em armações selecionadas — "promoção real".\nVálido somente neste fim de semana!';
const CARDS_OBS = 'Usar a paleta azul da marca.\nLogo no canto inferior direito.';
const NOTE_I0 = 'Priorizar o feed\ncom CTA';
const NOTE_I2 = 'usar referência X';
const E2ITEMS = [
  { tema: TEMA_SHORT, legenda: 'Legenda curta do primeiro item.' },
  { tema: TEMA_LONG, legenda: LEG_LONG },
  { tema: '', legenda: 'Item sem tema — apenas legenda (prova o gate do botão de tema).' },
  { tema: 'Tema sem legenda (prova o gate do botão de legenda)', legenda: '' },
  { tema: 'Tema 5 — conteúdo de preenchimento', legenda: 'Legenda 5.' },
  { tema: 'Tema 6 — conteúdo de preenchimento', legenda: 'Legenda 6.' },
  { tema: 'Tema 7 — conteúdo de preenchimento', legenda: 'Legenda 7.' }
];
function cronItems(n, prefix) {
  const a = [];
  for (let i = 1; i <= n; i++) a.push({ tema: prefix + ' — Tema ' + i, legenda: 'Legenda do item ' + i + '.' });
  return a;
}
function videoItems(n) { const a = []; for (let i = 1; i <= n; i++) a.push({ id: 'v' + i, n: i, tema: 'Vídeo ' + i + ' — corte vertical 30s' }); return a; }
function buildSeed() {
  const NOW = Date.now();
  const self = { id: ID.SELF, name: 'Marina Administradora Geral do Sistema', role: 'Administrador', admin: true, photo: PHOTO, status: 'ativo', email: 'marina@idseven.test' };
  const users = [
    self,
    { id: ID.ANA, name: 'Ana Beatriz Social Media Sênior', role: 'Social Media', photo: PHOTO, status: 'ativo' },
    { id: ID.BRUNO, name: 'Bruno Carvalho Nascimento Social Media', role: 'Social Media', status: 'ativo' },
    { id: ID.CARLA, name: 'Carla Domingues Ferreira Social Media Pleno', role: 'Social Media', status: 'ativo' },
    { id: ID.DIANA, name: 'Diana Esteves Ribeiro Social Media Júnior', role: 'Social Media', status: 'ativo' },
    { id: ID.DIEGO, name: 'Diego Fernandes de Almeida Designer Gráfico Sênior', role: 'Designer', photo: PHOTO, status: 'ativo' },
    { id: ID.ELENA, name: 'Elena Gonçalves Martins Designer de Motion', role: 'Designer', photo: PHOTO, status: 'ativo' },
    { id: ID.FELIPE, name: 'Felipe Henrique Oliveira Designer Visual', role: 'Designer', status: 'ativo' }
  ];
  const base = (extra) => Object.assign({ by: ID.ANA, createdAt: NOW, dueDate: '2026-08-20', dueTime: '18:00', history: [], checklist: [] }, extra);
  const DASG = { designerId: ID.DIEGO, designerName: 'Diego Fernandes de Almeida Designer Gráfico Sênior', designerRole: 'Designer', status: 'sent', assignedAt: NOW };
  const tasks = [
    base({ id: 'h1-e2cron', sector: 'cronograma', status: 'afazer', title: 'Central E2 — cronograma de cópia e tipografia', client: 'Clínica Aurora Odontologia', cronContents: E2ITEMS }),
    base({ id: 'h1-cards', sector: 'edicao_cards', status: 'andamento', title: 'Card avulso — Dia dos Pais E2', client: 'Ótica Clara Visão', cardLegenda: CARDS_LEG, cardObs: CARDS_OBS }),
    base({ id: 'h1-e3flow', sector: 'cronograma', status: 'afazer', title: 'Fluxo E3 — aguardando designer iniciar', client: 'Cliente Paridade Social e Designer', socialOwnerId: ID.ANA, designerAssignment: Object.assign({}, DASG), designerFlowStatus: 'afazer', startedAt: null, cronContents: cronItems(3, 'E3') }),
    base({ id: 'h1-e5cron3', sector: 'cronograma', status: 'afazer', title: 'Prazo E5 — cronograma com 3 temas', client: 'Padaria Pão Quente', cronContents: [{ tema: 'Tema A — Feed', legenda: 'Legenda A.' }, { tema: 'Tema B — Story', legenda: 'Legenda B.' }, { tema: 'Tema C — Reels', legenda: 'Legenda C.' }] }),
    base({ id: 'h1-edm', sector: 'edicao_midia', status: 'andamento', title: 'Edição — pacote E5 sem notas por tema', client: 'Marca Nova Digital', videos: videoItems(4), designerAssignment: Object.assign({}, DASG, { status: 'in_progress' }) }),
    base({ id: 'h1-e5notes', sector: 'cronograma', status: 'afazer', title: 'Notas E5 — observações internas por tema', client: 'Studio Vivo Produções', socialOwnerId: ID.ANA, designerAssignment: Object.assign({}, DASG), designerFlowStatus: 'afazer', designerItemNotes: { i0: NOTE_I0, i2: NOTE_I2 }, cronContents: cronItems(3, 'Notas') }),
    base({ id: 'h1-e1c1', sector: 'cronograma', status: 'afazer', title: 'Invariância E1 — pacote com 1 conteúdo', client: 'Cliente Invariância de Altura', cronContents: cronItems(1, 'Um') }),
    base({ id: 'h1-e1c12', sector: 'cronograma', status: 'afazer', title: 'Invariância E1 — pacote com 12 conteúdos', client: 'Cliente Invariância de Altura', cronContents: cronItems(12, 'Doze') }),
    base({ id: 'h1-e1c50', sector: 'cronograma', status: 'afazer', title: 'Invariância E1 — pacote com 50 conteúdos', client: 'Cliente Invariância de Altura', cronContents: cronItems(50, 'Cinquenta') })
  ];
  return { self, users, tasks, events: [] };
}
const SEED = buildSeed();
const EXP = {
  e2Acc: E2ITEMS.filter(c => (c.tema || '').trim() || (c.legenda || '').trim()).length,               // 7 acordeões
  themeBtns: E2ITEMS.filter(c => String(c.tema || '').trim()).length,                                  // 6 (gate hasTema)
  capBtns: E2ITEMS.filter(c => String(c.legenda || '').trim()).length,                                 // 6 (gate leg)
  semTemaIdx: 2, semLegIdx: 3, longIdx: 1
};

/* ─────────────────────────── injeção do bundle de medição (uma vez por carga) ───────────────────────────
   Definido no MUNDO PRINCIPAL da página: referências a `state`/`render`/`openDetails`/`openDesignerDeadline`
   resolvem os globais do script clássico do renderer. NÃO altera nenhuma lógica de produto. */
const INJECT = `window.__F354WH1=(function(){
  function S(){ try{ return state; }catch(_){ return window.state; } }
  function qa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function q(sel,root){ return (root||document).querySelector(sel); }
  function resetNav(){ var s=S(); s.form=null; s.clientView=null; s.tab='tarefas'; s.boardSector=null; s.personBoard=null; s.roleBoards=false; s.flowView=null; s.designerBoard=null; s.socialBoard=null; try{ boardQuery=''; }catch(_){} }
  function cssVarRGB(name){ try{ var v=getComputedStyle(document.body).getPropertyValue(name).trim(); if(/^#/.test(v)){ var h=v.slice(1); if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; var n=parseInt(h,16); return 'rgb('+((n>>16)&255)+', '+((n>>8)&255)+', '+(n&255)+')'; } return v; }catch(_){ return ''; } }
  function accList(){ return qa('.det-acc'); }
  function accBtn(i,kind){ var a=accList()[i]; if(!a)return null; return a.querySelector(kind==='theme'?'[data-detcopytheme]':'[data-detcopycaption]'); }
  function cardByTitle(sub){ var cards=qa('.kbv2-card'); for(var i=0;i<cards.length;i++){ var t=cards[i].querySelector('.kbv2-title'); if(t&&t.textContent.indexOf(sub)>=0) return cards[i]; } return null; }
  return {
    navSector:function(sec){ try{ resetNav(); S().boardSector=sec; window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    navSocialBoard:function(id){ try{ resetNav(); S().flowView='socials'; S().socialBoard=id; window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    navDesignerBoard:function(id){ try{ resetNav(); S().flowView='designers'; S().designerBoard=id; window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    navPersonBoard:function(id){ try{ resetNav(); S().personBoard=id; window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    openDet:function(id){ try{ if(window.closeModal)window.closeModal(); window.openDetails(id); return true; }catch(e){ return 'ERR:'+e.message; } },
    closeAll:function(){ try{ window.closeModal(); return true; }catch(e){ return 'ERR:'+e.message; } },
    clickExpand:function(){ var b=q('[data-detexpand]'); if(!b) return false; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; },
    clickCollapse:function(){ var b=q('[data-detcollapse]'); if(!b) return false; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true; },
    detTypo:function(i){ var a=accList()[i]; if(!a) return {found:false};
      try{ a.scrollIntoView({block:'center'}); }catch(_){}
      var k=a.querySelector('.det-acc-k'), t=a.querySelector('.det-acc-t'), l=a.querySelector('.det-acc-body .det-acc-l');
      var ck=k?getComputedStyle(k):null, ct=t?getComputedStyle(t):null, cl=l?getComputedStyle(l):null;
      return { found:true, open:a.open===true,
        kFW:ck?ck.fontWeight:'', kFS:ck?ck.fontSize:'', kColor:ck?ck.color:'',
        tFW:ct?ct.fontWeight:'', tFS:ct?ct.fontSize:'', tColor:ct?ct.color:'',
        lFS:cl?cl.fontSize:'', lLH:cl?cl.lineHeight:'', lWS:cl?cl.whiteSpace:'',
        faintRGB:cssVarRGB('--faint'), inkRGB:cssVarRGB('--ink'), accentRGB:cssVarRGB('--accent'),
        tText:t?t.textContent:'', lText:l?l.textContent:null, lHasNL:l?l.textContent.indexOf('\\n')>=0:false, lLen:l?l.textContent.length:0 };
    },
    copyAudit:function(){ var back=q('.modal-back[data-detmodal]'); var accs=accList();
      return { detsector:back?back.getAttribute('data-detsector'):null, accCount:accs.length,
        themeBtns:qa('[data-detcopytheme]').length, capBtns:qa('[data-detcopycaption]').length,
        perAcc:accs.map(function(a){ return { t:(a.querySelector('.det-acc-t')||{}).textContent||'', hasTheme:!!a.querySelector('[data-detcopytheme]'), hasCap:!!a.querySelector('[data-detcopycaption]') }; }) };
    },
    btnPoint:function(i,kind){ var b=accBtn(i,kind); if(!b) return {found:false};
      try{ b.scrollIntoView({block:'center'}); }catch(_){}
      var r=b.getBoundingClientRect();
      return { found:true, x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), w:Math.round(r.width), h:Math.round(r.height) };
    },
    btnInfo:function(i,kind){ var b=accBtn(i,kind); if(!b) return {found:false}; var a=accList()[i];
      return { found:true, ok:b.classList.contains('ok'), err:b.classList.contains('err'),
        title:b.getAttribute('title'), aria:b.getAttribute('aria-label'),
        hasCheckPath:b.innerHTML.indexOf('M4 12.5l5 5 11-11')>=0,
        hasCopyGlyph:b.innerHTML.indexOf('<rect x="9" y="9"')>=0,
        accOpen:a?a.open===true:null };
    },
    clip:function(){ var c=window.__CLIP||[]; return { n:c.length, last:c.length?c[c.length-1]:null }; },
    diagCopy:function(){ return (window.__DIAG||[]).filter(function(x){ return /^details\\.copy\\./.test(x.ev||''); })
      .map(function(x){ return { ev:x.ev, keys:Object.keys(x.p||{}), json:JSON.stringify(x.p||{}) }; }); },
    boardFind:function(sub){ var c=cardByTitle(sub); if(!c) return {found:false};
      var col=c.closest('.kbv2-column'); var lab=col?col.querySelector('.kbv2-ctitle'):null;
      var chip=c.querySelector('.kbv2-status');
      try{ c.scrollIntoView({block:'center'}); }catch(_){}
      return { found:true, col:lab?lab.textContent:'', chip:chip?chip.textContent:'', cards:qa('.kbv2-card').length };
    },
    setDFS:function(id,val){ try{ var t=S().tasks.find(function(x){ return x.id===id; }); if(!t) return 'no-task';
      t.designerFlowStatus=val;
      if(t.designerAssignment){ t.designerAssignment.status=(val==='andamento')?'in_progress':'sent'; }
      if(val==='afazer'){ t.startedAt=null; }
      window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    openDeadline:function(taskId,designerId){ try{ if(window.closeModal)window.closeModal(); window.openDesignerDeadline(taskId,designerId); return true; }catch(e){ return 'ERR:'+e.message; } },
    notesOpenSection:function(){ var s=q('.dz-notes>summary'); if(!s) return false; s.click(); var d=q('.dz-notes'); return !!d&&d.open===true; },
    notesInput:function(){ var tas=qa('textarea[data-itemnote]');
      return { taCount:tas.length, indices:tas.map(function(t){ return t.getAttribute('data-itemnote'); }),
        hasSection:!!q('.dz-notes'), header:(q('.dz-notes-h')||{}).textContent||'', sheet:!!q('.dz-sheet'), title:(q('.sp-title')||{}).textContent||'' };
    },
    notesView:function(){ return accList().map(function(a){ var n=a.querySelector('.det-acc-note');
      return { hasNote:!!n, label:n?((n.querySelector('.det-acc-note-k')||{}).textContent||''):'', body:n?((n.querySelector('.det-acc-note-b')||{}).textContent||''):'' }; }); },
    measureCard:function(sub){ var c=cardByTitle(sub); if(!c) return {found:false}; var sum=c.querySelector('.kbv2-card-summary'); var m=c.querySelector('.kbv2-sum-main'); var sb=c.querySelector('.kbv2-sum-sub');
      return { found:true, h:c.offsetHeight, hasSummary:!!sum, themeNodes:c.querySelectorAll('.kbv2-theme,.kbv2-themes-list').length, summaryMain:m?m.textContent:'', summarySub:sb?sb.textContent:'' }; },
    themeAudit:function(){ return { cards:qa('.kbv2-card').length, summaries:qa('.kbv2-card-summary').length, themeNodes:qa('.kbv2-theme,.kbv2-themes-list').length }; }
  };
})(); 'F354WH1_READY';`;

async function capture(win, tag) {
  try { const img = await win.capturePage(); const p = path.join(OUT, 'f354wh1-' + SCALE + '-' + tag + '.png'); fs.writeFileSync(p, img.toPNG()); return path.basename(p); }
  catch (e) { return 'ERR:' + e.message; }
}
function F(cond, why) { return { ok: !!cond, why: cond ? 'ok' : why }; }
/* helpers de invocação do bundle */
function ev(win, method, arg) { const a = arg === undefined ? '' : JSON.stringify(arg); return win.webContents.executeJavaScript('window.__F354WH1.' + method + '(' + a + ')'); }
function call(win, expr) { return win.webContents.executeJavaScript('window.__F354WH1.' + expr); }
/* clique REAL: eventos de entrada nativos do Electron (mouseMove/mouseDown/mouseUp) na coordenada
   REAL do botão (getBoundingClientRect após scrollIntoView) — passa pelo pipeline de input do
   Chromium e pelo handler DELEGADO de produção (preventDefault+stopPropagation). */
async function realClick(win, pt) {
  win.webContents.sendInputEvent({ type: 'mouseMove', x: pt.x, y: pt.y });
  await sleep(40);
  win.webContents.sendInputEvent({ type: 'mouseDown', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  await sleep(40);
  win.webContents.sendInputEvent({ type: 'mouseUp', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  await sleep(140);
}

/* ─────────────────────────── cenas ─────────────────────────── */
const E2 = {
  /* tipografia premium no acordeão CURTO (código de produção; computed styles REAIS) */
  e2_typo_short: async (win) => {
    await ev(win, 'openDet', 'h1-e2cron'); await sleep(450);
    await call(win, 'clickExpand()'); await sleep(250);
    const m = await call(win, 'detTypo(0)');
    const v = F(m.found && m.kFW === '600' && m.kColor === m.faintRGB && m.kColor !== m.accentRGB &&
      m.tFW === '600' && m.tFS === '15.5px' && m.tColor === m.inkRGB && m.lFS === '14px' && m.tText === TEMA_SHORT,
      '.det-acc-k 600/var(--faint) (≠accent) · .det-acc-t 15.5px/600/var(--ink) · .det-acc-l 14px (tema curto)');
    delete m.lText; return { v, m };
  },
  /* tipografia + integridade do tema LONGO (acentos/emoji) e da legenda com quebras */
  e2_typo_long: async (win) => {
    const m = await call(win, 'detTypo(' + EXP.longIdx + ')');
    const v = F(m.found && m.kFW === '600' && m.kColor === m.faintRGB && m.tFW === '600' && m.tFS === '15.5px' &&
      m.lFS === '14px' && /pre-wrap/.test(m.lWS) && m.lHasNL && m.tText === TEMA_LONG && m.lText === LEG_LONG && m.lLen === LEG_LONG.length,
      'acordeão longo: tipografia 15.5/600 + legenda 14px pre-wrap com \\n e texto RAW íntegro (acentos/emoji)');
    m.tOk = m.tText === TEMA_LONG; m.lOk = m.lText === LEG_LONG; delete m.lText; m.tText = (m.tText || '').slice(0, 60) + '…';
    return { v, m };
  },
  /* contagem GATED dos botões de cópia (tema não-vazio / legenda não-vazia; "(sem tema)" sem botão) */
  e2_copy_buttons: async (win) => {
    const m = await call(win, 'copyAudit()');
    const pa = m.perAcc || [];
    const v = F(m.accCount === EXP.e2Acc && m.themeBtns === EXP.themeBtns && m.capBtns === EXP.capBtns &&
      pa[EXP.semTemaIdx] && pa[EXP.semTemaIdx].t === '(sem tema)' && !pa[EXP.semTemaIdx].hasTheme && pa[EXP.semTemaIdx].hasCap &&
      pa[EXP.semLegIdx] && pa[EXP.semLegIdx].hasTheme && !pa[EXP.semLegIdx].hasCap && m.detsector === 'cronograma',
      'botões: ' + EXP.themeBtns + ' tema / ' + EXP.capBtns + ' legenda em ' + EXP.e2Acc + ' acordeões; "(sem tema)" SEM botão de tema');
    m.perAcc = pa.map(x => ({ hasTheme: x.hasTheme, hasCap: x.hasCap, t: (x.t || '').slice(0, 24) }));
    return { v, m };
  },
  /* clique REAL no botão de tema: clipboard RAW, <details> intacto, feedback .ok + restauração */
  e2_copy_theme_click: async (win, ctx) => {
    await call(win, 'clickCollapse()'); await sleep(220);
    const before = await call(win, 'btnInfo(' + EXP.longIdx + ',"theme")');
    const clip0 = await call(win, 'clip()');
    const pt = await call(win, 'btnPoint(' + EXP.longIdx + ',"theme")'); await sleep(160);
    const pt2 = await call(win, 'btnPoint(' + EXP.longIdx + ',"theme")');
    await realClick(win, pt2); await sleep(320);
    const clip1 = await call(win, 'clip()');
    const info = await call(win, 'btnInfo(' + EXP.longIdx + ',"theme")');
    const okShot = await ctx.snap('okstate');
    await sleep(1750);
    const rest = await call(win, 'btnInfo(' + EXP.longIdx + ',"theme")');
    const m = {
      openBefore: before.accOpen, openAfter: info.accOpen, clipDelta: clip1.n - clip0.n,
      clipEq: clip1.last === TEMA_LONG, clipLen: (clip1.last || '').length, expLen: TEMA_LONG.length,
      clipHead: (clip1.last || '').slice(0, 60) + '…', ok: info.ok, hasCheckPath: info.hasCheckPath,
      title: info.title, aria: info.aria, restTitle: rest.title, restOk: rest.ok, restCopyGlyph: rest.hasCopyGlyph,
      titleBefore: before.title, okShot, pt: pt2
    };
    const v = F(before.found && before.accOpen === false && before.title === 'Copiar tema' &&
      m.clipDelta === 1 && m.clipEq && !/^TEMA/.test(clip1.last || '') && !/^\d/.test(clip1.last || '') &&
      (clip1.last || '').indexOf('&quot;') < 0 && (clip1.last || '').indexOf('&amp;') < 0 &&
      info.ok === true && info.err === false && info.hasCheckPath && info.title === 'Tema copiado' && info.aria === 'Tema copiado' &&
      info.accOpen === false && rest.ok === false && rest.title === 'Copiar tema' && rest.hasCopyGlyph,
      'clique REAL: clipboard === tema RAW (sem número/"TEMA NN"/HTML), summary NÃO alternou, .ok+check, "Tema copiado" → restaura "Copiar tema" após 1600ms');
    return { v, m };
  },
  /* clique REAL no botão de legenda: \n + emoji byte-a-byte */
  e2_copy_caption_click: async (win, ctx) => {
    const clip0 = await call(win, 'clip()');
    const before = await call(win, 'btnInfo(' + EXP.longIdx + ',"caption")');
    const pt = await call(win, 'btnPoint(' + EXP.longIdx + ',"caption")'); await sleep(160);
    const pt2 = await call(win, 'btnPoint(' + EXP.longIdx + ',"caption")');
    await realClick(win, pt2); await sleep(320);
    const clip1 = await call(win, 'clip()');
    const info = await call(win, 'btnInfo(' + EXP.longIdx + ',"caption")');
    const okShot = await ctx.snap('okstate');
    const m = {
      openBefore: before.accOpen, openAfter: info.accOpen, clipDelta: clip1.n - clip0.n,
      clipEq: clip1.last === LEG_LONG, clipLen: (clip1.last || '').length, expLen: LEG_LONG.length,
      lines: (clip1.last || '').split('\n').length, ok: info.ok, title: info.title, okShot, pt: pt2
    };
    const v = F(before.found && before.accOpen === false && m.clipDelta === 1 && m.clipEq &&
      m.lines === 4 && (clip1.last || '').indexOf('<b>não-HTML</b>') >= 0 && (clip1.last || '').indexOf('&lt;') < 0 &&
      info.ok === true && info.hasCheckPath && info.title === 'Legenda copiada' && info.accOpen === false,
      'clique REAL: clipboard === legenda RAW byte-a-byte (\\n duplo + emoji + <b> literal), summary intacto, "Legenda copiada"');
    return { v, m };
  },
  /* observabilidade SANITIZADA: SÓ 5 metadados; NUNCA o texto */
  e2_copy_obs: async (win) => {
    const d = await call(win, 'diagCopy()');
    const WANT5 = ['contentType', 'contentLength', 'taskSector', 'appVersion', 'timestamp'];
    const themeS = d.filter(x => x.ev === 'details.copy.theme_succeeded');
    const capS = d.filter(x => x.ev === 'details.copy.caption_succeeded');
    const failed = d.filter(x => /_failed$/.test(x.ev));
    const keysOk = d.every(x => x.keys.length === 5 && WANT5.every(k => x.keys.includes(k)) && x.keys.every(k => WANT5.includes(k)));
    let payloadOk = false, leakFree = false;
    try {
      const pt = JSON.parse(themeS[0].json), pc = JSON.parse(capS[0].json);
      payloadOk = pt.contentType === 'theme' && pt.contentLength === TEMA_LONG.length && pt.taskSector === 'cronograma' && pt.appVersion === '1.0.215' && typeof pt.timestamp === 'number' &&
        pc.contentType === 'caption' && pc.contentLength === LEG_LONG.length && pc.taskSector === 'cronograma' && pc.appVersion === '1.0.215' && typeof pc.timestamp === 'number';
      leakFree = d.every(x => x.json.indexOf('Açaí') < 0 && x.json.indexOf('Primeira linha') < 0 && x.json.indexOf('não-HTML') < 0 && x.json.indexOf('Café') < 0);
    } catch (_) {}
    const m = { events: d.map(x => x.ev), theme: themeS.length, caption: capS.length, failed: failed.length, keysOk, payloadOk, leakFree, sample: themeS[0] ? themeS[0].json : null };
    const v = F(themeS.length === 1 && capS.length === 1 && failed.length === 0 && keysOk && payloadOk && leakFree,
      'diagLog: exatamente 1 theme_succeeded + 1 caption_succeeded, payload = SÓ {contentType,contentLength,taskSector,appVersion,timestamp}, sem texto de tema/legenda');
    return { v, m };
  },
  /* Edição de Cards: o botão do bloco LEGENDA copia o CONTEÚDO real (.det-acc-l), não o rótulo "Legenda" */
  e2_cards_copy: async (win) => {
    await ev(win, 'openDet', 'h1-cards'); await sleep(420);
    const audit = await call(win, 'copyAudit()');
    const clip0 = await call(win, 'clip()');
    const pt = await call(win, 'btnPoint(0,"caption")'); await sleep(160);
    const pt2 = await call(win, 'btnPoint(0,"caption")');
    await realClick(win, pt2); await sleep(320);
    const clip1 = await call(win, 'clip()');
    const info = await call(win, 'btnInfo(0,"caption")');
    const m = {
      detsector: audit.detsector, accCount: audit.accCount, themeBtns: audit.themeBtns, capBtns: audit.capBtns,
      label0: audit.perAcc && audit.perAcc[0] ? audit.perAcc[0].t : '', clipDelta: clip1.n - clip0.n,
      clipEq: clip1.last === CARDS_LEG, clipIsStaticLabel: clip1.last === 'Legenda', clipLen: (clip1.last || '').length, expLen: CARDS_LEG.length,
      ok: info.ok, title: info.title
    };
    const v = F(audit.detsector === 'edicao_cards' && audit.accCount === 2 && audit.themeBtns === 0 && audit.capBtns === 2 &&
      m.label0 === 'Legenda' && m.clipDelta === 1 && m.clipEq && !m.clipIsStaticLabel &&
      (clip1.last || '').split('\n').length === 3 && info.ok === true && info.title === 'Legenda copiada',
      'edicao_cards: 2 blocos SÓ com data-detcopycaption; o clique copia a LEGENDA REAL (com \\n), nunca o rótulo estático "Legenda"');
    await call(win, 'closeAll()');
    return { v, m };
  }
};
const E3 = {
  /* designer atribuído e NÃO iniciado → "A Fazer" no quadro da Social + chip "Aguardando designer iniciar" */
  e3_social_afazer: async (win) => {
    await ev(win, 'navSocialBoard', ID.ANA); await sleep(500);
    const m = await call(win, 'boardFind("Fluxo E3")');
    const v = F(m.found && m.col === 'A Fazer' && m.col !== 'Em andamento' && m.chip === 'Aguardando designer iniciar',
      'Social: card na coluna "A Fazer" (não "Em andamento") com chip "Aguardando designer iniciar"');
    return { v, m };
  },
  /* paridade: o MESMO estado cai em "A Fazer" também no quadro do Designer */
  e3_designer_afazer_parity: async (win) => {
    await ev(win, 'navDesignerBoard', ID.DIEGO); await sleep(500);
    const m = await call(win, 'boardFind("Fluxo E3")');
    const v = F(m.found && m.col === 'A Fazer' && m.chip === 'Aguardando designer iniciar',
      'Designer: mesma tarefa também em "A Fazer" (paridade Social↔Designer)');
    return { v, m };
  },
  /* o start REAL (designerFlowStatus='andamento') move para "Em andamento" nos DOIS quadros */
  e3_start_flips: async (win, ctx) => {
    await call(win, 'setDFS("h1-e3flow","andamento")'); await sleep(420);
    const md = await call(win, 'boardFind("Fluxo E3")');
    const shotDesigner = await ctx.snap('designer-andamento');
    await ev(win, 'navSocialBoard', ID.ANA); await sleep(450);
    const ms = await call(win, 'boardFind("Fluxo E3")');
    const m = { designerCol: md.col, designerChip: md.chip, socialCol: ms.col, socialChip: ms.chip, shotDesigner };
    const v = F(md.found && ms.found && md.col === 'Em andamento' && ms.col === 'Em andamento',
      'start do designer: "Em andamento" no quadro do Designer E no da Social');
    return { v, m };
  },
  /* de volta ao não-iniciado: "A Fazer" também em Setores e no Meu quadro (dona Social) */
  e3_setores_meuquadro: async (win, ctx) => {
    await call(win, 'setDFS("h1-e3flow","afazer")'); await sleep(220);
    await ev(win, 'navSector', 'cronograma'); await sleep(450);
    const mset = await call(win, 'boardFind("Fluxo E3")');
    const shotSetores = await ctx.snap('setores-afazer');
    await ev(win, 'navPersonBoard', ID.ANA); await sleep(450);
    const mmeu = await call(win, 'boardFind("Fluxo E3")');
    const m = { setoresCol: mset.col, setoresChip: mset.chip, meuCol: mmeu.col, meuChip: mmeu.chip, shotSetores };
    const v = F(mset.found && mmeu.found && mset.col === 'A Fazer' && mmeu.col === 'A Fazer',
      'não-iniciado: "A Fazer" no quadro de Setores (cronograma) e no Meu quadro da Social dona');
    return { v, m };
  }
};
const E5 = {
  /* input por tema no modal "Prazo para o designer": 3 textareas indexadas p/ cronograma; ZERO p/ edicao_midia */
  e5_notes_input: async (win, ctx) => {
    await call(win, 'openDeadline("h1-edm",' + JSON.stringify(ID.DIEGO) + ')'); await sleep(380);
    const medm = await call(win, 'notesInput()');
    const shotEdm = await ctx.snap('edm-zero');
    await call(win, 'openDeadline("h1-e5cron3",' + JSON.stringify(ID.DIEGO) + ')'); await sleep(380);
    await call(win, 'notesOpenSection()'); await sleep(220);
    const mcron = await call(win, 'notesInput()');
    const m = { edm: medm, cron: mcron, shotEdm };
    const v = F(medm.taCount === 0 && !medm.hasSection &&
      mcron.sheet && mcron.title === 'Prazo para o designer' && mcron.hasSection && mcron.taCount === 3 &&
      JSON.stringify(mcron.indices) === JSON.stringify(['0', '1', '2']) && /Observação interna para o Designer/.test(mcron.header),
      'prazo: 3 textarea[data-itemnote=0|1|2] + rótulo "Observação interna para o Designer" no cronograma; ZERO no edicao_midia');
    return { v, m };
  },
  /* render ao Designer na Central: .det-acc-note SÓ nos itens com nota (i0/i2), \n preservado */
  e5_notes_view: async (win) => {
    await ev(win, 'openDet', 'h1-e5notes'); await sleep(420);
    const list = await call(win, 'notesView()');
    await call(win, 'detTypo(0)'); await sleep(200);   // rola o 1º acordeão (com nota) para o PNG
    const m = { count: list.length, i0: list[0], i1: list[1], i2: list[2] };
    const v = F(list.length === 3 &&
      list[0].hasNote && list[0].label === 'Observação interna da Social Media' && list[0].body === NOTE_I0 && list[0].body.indexOf('\n') >= 0 &&
      !list[1].hasNote && list[1].label === '' &&
      list[2].hasNote && list[2].label === 'Observação interna da Social Media' && list[2].body === NOTE_I2,
      'Central: .det-acc-note exatamente nos itens 1 e 3 (i0/i2), corpo com \\n preservado, item 2 SEM nota');
    return { v, m };
  }
};
const E1 = {
  /* card do quadro preservado: altura INVARIANTE a 1/12/50 conteúdos + zero nós de lista de temas */
  e1_card_preserved: async (win) => {
    await call(win, 'closeAll()');
    await ev(win, 'navSector', 'cronograma'); await sleep(480);
    const m1 = await call(win, 'measureCard("com 1 conteúdo")');
    const m12 = await call(win, 'measureCard("com 12 conteúdos")');
    const m50 = await call(win, 'measureCard("com 50 conteúdos")');
    const audit = await call(win, 'themeAudit()');
    const hs = [m1.h, m12.h, m50.h];
    const delta = Math.max.apply(null, hs) - Math.min.apply(null, hs);
    const m = { h1: m1.h, h12: m12.h, h50: m50.h, delta, main1: m1.summaryMain, main12: m12.summaryMain, main50: m50.summaryMain, themeNodes: [m1.themeNodes, m12.themeNodes, m50.themeNodes], audit };
    const v = F(m1.found && m12.found && m50.found && delta <= INVAR_DELTA &&
      m1.hasSummary && m12.hasSummary && m50.hasSummary &&
      m1.themeNodes === 0 && m12.themeNodes === 0 && m50.themeNodes === 0 && audit.themeNodes === 0 &&
      m1.summaryMain === '1 tema' && m12.summaryMain === '12 temas' && m50.summaryMain === '50 temas',
      'INVARIÂNCIA: |h(1)−h(12)−h(50)| <= ' + INVAR_DELTA + 'px, resumo "N temas" e ZERO nós .kbv2-theme/.kbv2-themes-list');
    return { v, m };
  }
};
const REGISTRY = Object.assign({}, E2, E3, E5, E1);

async function waitReady(win) {
  for (let i = 0; i < 48; i++) {
    const r = await win.webContents.executeJavaScript(`(function(){try{var S=(typeof state!=='undefined')?state:window.state;return {authed:document.body.classList.contains('authed'),desktop:document.body.classList.contains('desktop'),users:(S&&S.users||[]).length,tasks:(S&&S.tasks||[]).length};}catch(e){return {err:e.message};}})()`).catch(e => ({ err: String(e && e.message || e) }));
    if (r && r.authed && r.desktop && r.tasks >= 9 && r.users >= 8) return r;
    await sleep(280);
  }
  return null;
}

app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  fs.writeFileSync(SEED_FILE, JSON.stringify({ self: SEED.self, users: SEED.users, tasks: SEED.tasks, events: SEED.events }));
  const win = new BrowserWindow({
    width: SCALE === '1x' ? 1440 : 1400, height: SCALE === '1x' ? 1000 : 950, show: false,
    webPreferences: { preload: path.join(__dirname, 'proof-preload.js'), contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false }
  });
  try { win.showInactive(); } catch (_) {}
  let scenes = 0, failures = 0;
  try {
    await win.loadFile(INDEX);
    const ready = await waitReady(win);
    if (!ready) { process.stdout.write('PROOF_DONE scale=' + SCALE + ' scenes=0 failures=99\n'); console.log('FATAL: renderer não autenticou/semeou (authed+users>=8+tasks>=9)'); app.exit(1); return; }
    await win.webContents.executeJavaScript(INJECT);
    await sleep(300);
    for (let i = 0; i < SCENES.length; i++) {
      const name = SCENES[i]; const fn = REGISTRY[name]; const idx = String(i + 1).padStart(2, '0');
      if (!fn) { line({ scene: name, scale: SCALE, ok: false, why: 'cena desconhecida' }); scenes++; failures++; continue; }
      const ctx = { snap: (tag) => capture(win, idx + '-' + name + '-' + tag) };
      let res, shot;
      try { res = await fn(win, ctx); await sleep(120); shot = await capture(win, idx + '-' + name); }
      catch (e) { res = { v: { ok: false, why: 'EXC:' + (e && e.message || e) }, m: {} }; shot = 'ERR'; }
      const ok = res.v.ok; scenes++; if (!ok) failures++;
      line({ scene: name, scale: SCALE, ok, why: res.v.why, shot, m: res.m });
    }
  } catch (e) { console.log('FATAL: ' + (e && e.message || e)); failures = failures || 1; }
  try { win.destroy(); } catch (_) {}
  process.stdout.write('PROOF_DONE scale=' + SCALE + ' scenes=' + scenes + ' failures=' + failures + '\n');
  app.exit(failures === 0 ? 0 : 1);
});
