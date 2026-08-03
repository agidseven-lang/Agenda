/* F3.5.4W — MAIN de prova (Electron REAL 31.3.1). Carrega o index.html REAL (mesmos bytes do
 * pacote) UMA vez, deixa o boot autenticar (authSelf resolve {ok:true,self:SELF}) e o
 * subscribeData() semear state.users/state.tasks a partir do Firestore stub (SEMENTE real). Depois
 * navega pelo ESTADO REAL (state.boardSector / state.flowView='socials' + f354SocialAutoPick() /
 * state.designerBoard) e mede o DOM PRODUZIDO PELO CÓDIGO DE PRODUÇÃO (kbv2Card/kbv2ContentSlot/
 * openDetails/renderSocialBoard/f354SocialStrip/f354DesignerStrip). Cada cena grava PNG REAL
 * (win.capturePage) + medições do DOM REAL e emite um PROOF_LINE. Sem file:///setContent/IA/mockup.
 *
 * Prova as 4 entregas do F3.5.4W:
 *   D1 cards compactos — o card usa .kbv2-card-summary (resumo), NÃO emite .kbv2-theme, altura
 *      controlada e INVARIANTE ao nº de temas (12 temas não é mais alto que 3).
 *   D2 Central de Detalhes — superfície grande (min(1240,92vw)×88vh), N acordeões <details.det-acc>
 *      == N itens, rótulos TEMA/ROTEIRO/VÍDEO/CARD, Expandir/Recolher todos, Esc fecha, legenda com
 *      quebras (pre-wrap), CARD·LEGENDA/CARD·OBSERVAÇÕES.
 *   D3 avatares — a faixa .f354-dstrip (min-height≥58, overflow-y:hidden, align-items:center) NÃO
 *      recorta o anel; avatar 22px (não encolhido).
 *   D4 Social Medias — a aba auto-abre um quadro por ESTADO (f354SocialAutoPick, sem element.click);
 *      colunas (SOCIAL_COLS4) renderizam mesmo com 0 tarefas; faixa de chips presente; persistência. */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const OUT = process.env.PROOF_OUT || path.join(__dirname, 'out');
const SCALE = process.env.PROOF_SCALE || '1x';
const SCENES = (process.env.PROOF_SCENES || '').split(',').map(s => s.trim()).filter(Boolean);
const INDEX = path.join(__dirname, 'src', 'renderer', 'index.html');
const SEED_FILE = path.join(os.tmpdir(), 'f354w-seed.json');
/* Limiares — os ESTRUTURAIS são fixos (contagem de acordeões, ausência de .kbv2-theme, não-recorte,
   socialBoard != null, colunas com 0 tarefas). O bound de ALTURA do card é CALIBRÁVEL via env
   (F354W_CARD_MAX) para casar com o valor REAL medido — a prova de compactação real é a INVARIÂNCIA. */
const CARD_MAX = Number(process.env.F354W_CARD_MAX || 540);
const INVAR_DELTA = 8;   // 12 temas não pode ser mais alto que 3 temas + folga (altura não cresce com nº de temas)
const MIN_STRIP_H = 58;

try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function line(o) { process.stdout.write('PROOF_LINE ' + JSON.stringify(o) + '\n'); }

/* ─────────────────────────── SEMENTE (estado real semeado) ───────────────────────────
   Users: 1 admin (SELF, canSeeAll) + 4 Social Media (Ana/Bruno/Carla/Diana; Diana dona de 0
   tarefas → prova colunas com 0 tarefas) + 3 Designers (Diego/Elena/Felipe). Nomes LONGOS + fotos
   (data-URI e iniciais) para exercitar a faixa de avatares. Tasks: 8 nos setores cronograma(3),
   roteiro(1), edicao_midia(3), edicao_cards(1), incl. cronograma de 12 temas (card compacto +
   Central paginada) com legendas multi-parágrafo (\n) para provar pre-wrap. */
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHElEQVQ4y2NgGAWjYBSMglEwCkbBKBgFo4CoAAAJUgABYjq9nQAAAABJRU5ErkJggg==';
const ID = {
  SELF: 'u-self-admin',
  ANA: 'u-soc-ana', BRUNO: 'u-soc-bruno', CARLA: 'u-soc-carla', DIANA: 'u-soc-diana',
  DIEGO: 'u-des-diego', ELENA: 'u-des-elena', FELIPE: 'u-des-felipe'
};
function cronItems(n, prefix) {
  const a = [];
  for (let i = 1; i <= n; i++) a.push({
    tema: prefix + ' — Tema ' + i,
    legenda: 'Legenda do item ' + i + ' (parágrafo 1).\nSegunda linha do mesmo item.\nTerceira linha — prova a preservação de quebras (pre-wrap).'
  });
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
  const tasks = [
    base({ id: 'w-cron12', sector: 'cronograma', status: 'afazer', title: 'Cronograma Mensal — Junho (12 conteúdos)', client: 'Clínica Aurora Odontologia', cronContents: cronItems(12, 'Junho') }),
    base({ id: 'w-cron6', sector: 'cronograma', status: 'andamento', title: 'Cronograma Quinzenal — 1ª quinzena (6 conteúdos)', client: 'Auto Center Veloz', cronContents: cronItems(6, 'Quinzena') }),
    base({ id: 'w-cron3', sector: 'cronograma', status: 'afazer', title: 'Cronograma Semanal — Semana 23 (3 conteúdos)', client: 'Padaria Pão Quente', cronContents: cronItems(3, 'Semana 23') }),
    base({ id: 'w-rot', sector: 'roteiro', status: 'afazer', title: 'Roteiros de Gravação — Campanha 8 vídeos', client: 'Studio Vivo Produções', cronContents: cronItems(8, 'Roteiro') }),
    base({ id: 'w-edm', sector: 'edicao_midia', status: 'andamento', title: 'Edição — pacote 12 vídeos/roteiros', client: 'Marca Nova Digital', videos: videoItems(12), designerAssignment: { designerId: ID.DIEGO, designerName: 'Diego Fernandes de Almeida Designer Gráfico Sênior', designerRole: 'Designer', status: 'in_progress', assignedAt: NOW } }),
    base({ id: 'w-cards', sector: 'edicao_cards', status: 'andamento', title: 'Card avulso — Promoção Dia dos Pais', client: 'Ótica Clara Visão', cardLegenda: 'Aproveite o Dia dos Pais na Ótica Clara.\nDescontos de até 40% em armações selecionadas.\nVálido somente neste fim de semana.', cardObs: 'Usar a paleta azul da marca.\nLogo no canto inferior direito.\nEvitar fundo branco puro.' }),
    base({ id: 'w-edm-elena', sector: 'edicao_midia', status: 'afazer', by: ID.BRUNO, title: 'Edição — Reels institucional (6)', client: 'Escola Saber Mais', videos: videoItems(6), designerAssignment: { designerId: ID.ELENA, designerName: 'Elena Gonçalves Martins Designer de Motion', designerRole: 'Designer', status: 'sent', assignedAt: NOW } }),
    base({ id: 'w-edm-felipe', sector: 'edicao_midia', status: 'revisao', by: ID.CARLA, title: 'Edição — Stories campanha (4)', client: 'Academia Corpo em Forma', videos: videoItems(4), designerAssignment: { designerId: ID.FELIPE, designerName: 'Felipe Henrique Oliveira Designer Visual', designerRole: 'Designer', status: 'in_progress', assignedAt: NOW } })
  ];
  return { self, users, tasks, events: [] };
}
const SEED = buildSeed();
const EXP = {
  firstSocial: ID.ANA, savedSocial: ID.DIANA,
  socialUsers: 4, designers: 3,
  cron12: 12, cron6: 6, cron3: 3, rot: 8, edm: 12, cardsAcc: 2,
  colCount: 4
};

/* ─────────────────────────── injeção do bundle de medição (uma vez por carga) ───────────────────────────
   Definido no MUNDO PRINCIPAL da página: referências a `state`/`render`/`openDetails`/... resolvem
   os globais do script clássico do renderer. NÃO altera nenhuma lógica de produto. */
const INJECT = `window.__F354W=(function(){
  function S(){ try{ return state; }catch(_){ return window.state; } }
  function qa(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function q(sel,root){ return (root||document).querySelector(sel); }
  function resetNav(){ var s=S(); s.form=null; s.clientView=null; s.tab='tarefas'; s.boardSector=null; s.personBoard=null; s.roleBoards=false; s.flowView=null; s.designerBoard=null; s.socialBoard=null; if(typeof boardQuery!=='undefined'){ try{ boardQuery=''; }catch(_){} } }
  function cardByTitle(sub){ var cards=qa('.kbv2-card'); for(var i=0;i<cards.length;i++){ var t=cards[i].querySelector('.kbv2-title'); if(t&&t.textContent.indexOf(sub)>=0) return cards[i]; } return null; }
  function near(a,b,tol){ return Math.abs(a-b)<=(tol||1); }
  return {
    navSector:function(sec){ try{ resetNav(); S().boardSector=sec; window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    navSocialAuto:function(){ try{ resetNav(); S().flowView='socials'; S().socialBoard=(window.f354SocialAutoPick?window.f354SocialAutoPick():null); window.render(); return S().socialBoard; }catch(e){ return 'ERR:'+e.message; } },
    navSocialAutoViaAction:function(){ try{ resetNav(); S().socialBoard=(window.f354SocialAutoPick?window.f354SocialAutoPick():null); S().flowView='socials'; window.render(); return S().socialBoard; }catch(e){ return 'ERR:'+e.message; } },
    navSocialBoard:function(id){ try{ resetNav(); S().flowView='socials'; S().socialBoard=id; window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    navDesignerBoard:function(id){ try{ resetNav(); S().flowView='designers'; S().designerBoard=id; window.render(); return true; }catch(e){ return 'ERR:'+e.message; } },
    socialBoardId:function(){ try{ return S().socialBoard; }catch(e){ return 'ERR:'+e.message; } },
    saveSocialSel:function(id){ try{ var s=S(); window.f354SocialSelSave(s.user&&s.user.id, id); return true; }catch(e){ return 'ERR:'+e.message; } },
    clearSocialSel:function(){ try{ localStorage.removeItem('idseven.socialSel.v1'); return true; }catch(e){ return 'ERR:'+e.message; } },
    measureCard:function(sub){ var c=cardByTitle(sub); if(!c) return {found:false}; var sum=c.querySelector('.kbv2-card-summary'); var m=c.querySelector('.kbv2-sum-main'); var sb=c.querySelector('.kbv2-sum-sub'); var t=c.querySelector('.kbv2-title'); return { found:true, offsetHeight:c.offsetHeight, rectHeight:Math.round(c.getBoundingClientRect().height), hasSummary:!!sum, summaryFlex:sum?getComputedStyle(sum).flexGrow+'/'+getComputedStyle(sum).flexShrink:'', themeNodes:c.querySelectorAll('.kbv2-theme,.kbv2-themes-list').length, summaryMain:m?m.textContent:'', summarySub:sb?sb.textContent:'', title:t?t.textContent:'' }; },
    boardThemeAudit:function(){ return { cards:qa('.kbv2-card').length, summaries:qa('.kbv2-card-summary').length, themeNodes:qa('.kbv2-theme,.kbv2-themes-list').length }; },
    openDet:function(id){ try{ if(window.closeModal)window.closeModal(); window.openDetails(id); return true; }catch(e){ return 'ERR:'+e.message; } },
    measureDet:function(){ var back=q('.modal-back[data-detmodal]'); var sheet=q('.det-sheet'); var accs=qa('.det-acc'); var ks=qa('.det-acc-k').map(function(k){return k.textContent;}); var iw=window.innerWidth; var sw=sheet?Math.round(sheet.getBoundingClientRect().width):0; var sh=sheet?Math.round(sheet.getBoundingClientRect().height):0; return { backPresent:!!back, detmodal:back?back.getAttribute('data-detmodal'):null, sheetPresent:!!sheet, roleDialog:!!q('.det-sheet[role="dialog"][aria-modal="true"]'), sheetWidth:sw, sheetHeight:sh, innerWidth:iw, innerHeight:window.innerHeight, expectedWidth:Math.min(1240,Math.round(0.92*iw)), widthRatio:iw?+(sw/iw).toFixed(3):0, accCount:accs.length, openCount:accs.filter(function(d){return d.open===true;}).length, labels:ks, hasExpand:!!q('[data-detexpand]'), hasCollapse:!!q('[data-detcollapse]') }; },
    detExpand:function(){ var b=q('[data-detexpand]'); if(!b) return {clicked:false}; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); var accs=qa('.det-acc'); return { clicked:true, total:accs.length, open:accs.filter(function(d){return d.open===true;}).length }; },
    detCollapse:function(){ var b=q('[data-detcollapse]'); if(!b) return {clicked:false}; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); var accs=qa('.det-acc'); return { clicked:true, total:accs.length, open:accs.filter(function(d){return d.open===true;}).length, closed:accs.filter(function(d){return d.open===false;}).length }; },
    detLineBreaks:function(){ var ls=qa('.det-acc-l'); var withNl=ls.filter(function(l){return l.textContent.indexOf('\\n')>=0;}).length; var ws=ls.length?getComputedStyle(ls[0]).whiteSpace:''; return { total:ls.length, withNewline:withNl, whiteSpace:ws }; },
    detEsc:function(){ document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); var mr=document.getElementById('modalRoot'); return { emptied:(mr.innerHTML===''||mr.childElementCount===0), childCount:mr.childElementCount }; },
    measureStrip:function(){ var strip=q('.f354-dstrip'); if(!strip) return {found:false}; var sr=strip.getBoundingClientRect(); var cs=getComputedStyle(strip); var avs=qa('.f354-dchip .av',strip); var info=avs.map(function(a){ var r=a.getBoundingClientRect(); var acs=getComputedStyle(a); return { w:+r.width.toFixed(1), h:+r.height.toFixed(1), cssW:acs.width, cssH:acs.height, top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), clippedTop:(r.top<sr.top-1), clippedBottom:(r.bottom>sr.bottom+1) }; }); return { found:true, chipCount:qa('.f354-dchip',strip).length, avCount:avs.length, minHeight:parseFloat(cs.minHeight)||0, overflowY:cs.overflowY, alignItems:cs.alignItems, scrollbarGutter:cs.scrollbarGutter||'', paddingTop:cs.paddingTop, paddingBottom:cs.paddingBottom, stripTop:+sr.top.toFixed(1), stripBottom:+sr.bottom.toFixed(1), stripHeight:Math.round(sr.height), allAv22:info.length>0&&info.every(function(a){return near(a.w,22,1)&&near(a.h,22,1);}), anyClipped:info.some(function(a){return a.clippedTop||a.clippedBottom;}), avatars:info }; },
    boardCols:function(){ var cols=qa('.kbv2-column'); var strip=q('.f354-dstrip'); return { colCount:cols.length, colLabels:qa('.kbv2-ctitle').map(function(c){return c.textContent;}), stripPresent:!!strip, chipCount:strip?qa('.f354-dchip',strip).length:0, cardCount:qa('.kbv2-card').length, header:(q('.d-bh-title')||{}).textContent||'' }; }
  };
})(); 'F354W_READY';`;

async function capture(win, tag) {
  try { const img = await win.capturePage(); const p = path.join(OUT, 'f354w-' + SCALE + '-' + tag + '.png'); fs.writeFileSync(p, img.toPNG()); return path.basename(p); }
  catch (e) { return 'ERR:' + e.message; }
}
function F(cond, why) { return { ok: !!cond, why: cond ? 'ok' : why }; }

/* ─────────────────────────── cenas ─────────────────────────── */
const D1 = {
  d1_cron12: async (win) => { await ev(win, 'navSector', 'cronograma'); await sleep(450); const m = await call(win, 'measureCard("Junho (12")'); const v = F(m.found && m.hasSummary && m.themeNodes === 0 && m.offsetHeight <= CARD_MAX && /tema/.test(m.summaryMain) && /legenda/.test(m.summarySub), 'card 12-temas: resumo presente, sem .kbv2-theme, altura<=' + CARD_MAX + ', "N temas · N legendas"'); return { v, m }; },
  d1_cron6: async (win) => { const m = await call(win, 'measureCard("(6 conteúdos")'); const v = F(m.found && m.hasSummary && m.themeNodes === 0 && m.offsetHeight <= CARD_MAX && /6 tema/.test(m.summaryMain), 'card 6-temas: resumo "6 temas", sem .kbv2-theme'); return { v, m }; },
  d1_cron3: async (win) => { const m = await call(win, 'measureCard("(3 conteúdos")'); const v = F(m.found && m.hasSummary && m.themeNodes === 0 && m.offsetHeight <= CARD_MAX && /3 tema/.test(m.summaryMain), 'card 3-temas: resumo "3 temas", sem .kbv2-theme'); return { v, m }; },
  d1_cron_height_invariance: async (win) => { const m12 = await call(win, 'measureCard("Junho (12")'); const m3 = await call(win, 'measureCard("(3 conteúdos")'); const m = { h12: m12.offsetHeight, h3: m3.offsetHeight, delta: m12.offsetHeight - m3.offsetHeight, main12: m12.summaryMain, main3: m3.summaryMain, themeNodes12: m12.themeNodes, themeNodes3: m3.themeNodes }; const v = F(m12.found && m3.found && m12.offsetHeight <= m3.offsetHeight + INVAR_DELTA && m12.offsetHeight <= CARD_MAX && m3.offsetHeight <= CARD_MAX && m12.themeNodes === 0 && m3.themeNodes === 0, 'INVARIÂNCIA: altura do card de 12 temas <= 3 temas + ' + INVAR_DELTA + 'px (altura NÃO cresce com nº de temas)'); return { v, m }; },
  d1_no_theme_nodes: async (win) => { const m = await call(win, 'boardThemeAudit()'); const v = F(m.cards >= 3 && m.themeNodes === 0 && m.summaries >= m.cards, 'quadro cronograma: 0 nós .kbv2-theme/.kbv2-themes-list e todo card tem .kbv2-card-summary'); return { v, m }; },
  d1_roteiro: async (win) => { await ev(win, 'navSector', 'roteiro'); await sleep(450); const m = await call(win, 'measureCard("Campanha 8")'); const v = F(m.found && m.hasSummary && m.themeNodes === 0 && m.offsetHeight <= CARD_MAX && /roteiro/.test(m.summaryMain), 'card roteiro: resumo "8 roteiros", sem .kbv2-theme'); return { v, m }; },
  d1_edicao_midia: async (win) => { await ev(win, 'navSector', 'edicao_midia'); await sleep(450); const m = await call(win, 'measureCard("pacote 12")'); const v = F(m.found && m.hasSummary && m.themeNodes === 0 && m.offsetHeight <= CARD_MAX && /vídeo/.test(m.summaryMain), 'card edição de vídeos: resumo "12 vídeos/roteiros", sem .kbv2-theme'); return { v, m }; },
  d1_edicao_cards: async (win) => { await ev(win, 'navSector', 'edicao_cards'); await sleep(450); const m = await call(win, 'measureCard("Dia dos Pais")'); const v = F(m.found && m.hasSummary && m.themeNodes === 0 && m.offsetHeight <= CARD_MAX && /Legenda/.test(m.summaryMain), 'card edição de cards: resumo "Legenda · Observações", sem .kbv2-theme'); return { v, m }; },
  d1_social_card: async (win) => { await ev(win, 'clearSocialSel'); const id = await call(win, 'navSocialAuto()'); await sleep(500); const m = await call(win, 'measureCard("Junho (12")'); m.socialBoard = id; const v = F(m.found && m.hasSummary && m.themeNodes === 0 && m.offsetHeight <= CARD_MAX, 'card compacto também no quadro Social (auto-aberto)'); return { v, m }; }
};
const D2 = {
  d2_open_cron: async (win) => { await ev(win, 'navSector', 'cronograma'); await sleep(300); await call(win, 'openDet("w-cron12")'); await sleep(450); const m = await call(win, 'measureDet()'); const labelsOk = m.labels.length === EXP.cron12 && m.labels.every(k => /^TEMA \d\d/.test(k)); const v = F(m.backPresent && m.sheetPresent && m.roleDialog && m.sheetWidth <= m.expectedWidth + 6 && m.sheetWidth >= 0.80 * m.innerWidth && m.accCount === EXP.cron12 && m.openCount === 0 && labelsOk && m.hasExpand && m.hasCollapse, 'Central cron: sheet GRANDE (>=80% da janela, limitada por min(1240,92vw)), 12 acordeões TEMA NN colapsados, Expandir/Recolher presentes'); return { v, m }; },
  d2_cron_expand: async (win) => { const m = await call(win, 'detExpand()'); const v = F(m.clicked && m.total === EXP.cron12 && m.open === EXP.cron12, 'Expandir todos → TODOS os 12 acordeões open===true'); return { v, m }; },
  d2_cron_linebreaks: async (win) => { const m = await call(win, 'detLineBreaks()'); const v = F(m.total === EXP.cron12 && m.withNewline >= 1 && /pre-wrap/.test(m.whiteSpace), 'legenda preserva quebras: .det-acc-l com "\\n" e white-space:pre-wrap'); return { v, m }; },
  d2_cron_collapse: async (win) => { const m = await call(win, 'detCollapse()'); const v = F(m.clicked && m.total === EXP.cron12 && m.open === 0 && m.closed === EXP.cron12, 'Recolher todos → TODOS os 12 acordeões open===false'); return { v, m }; },
  d2_cron_esc: async (win) => { const m = await call(win, 'detEsc()'); await sleep(250); const v = F(m.emptied && m.childCount === 0, 'Esc fecha a Central: #modalRoot esvaziado'); return { v, m }; },
  d2_open_roteiro: async (win) => { await call(win, 'openDet("w-rot")'); await sleep(400); const m = await call(win, 'measureDet()'); const labelsOk = m.labels.length === EXP.rot && m.labels.every(k => /^ROTEIRO \d\d/.test(k)); const v = F(m.sheetPresent && m.accCount === EXP.rot && labelsOk && m.hasExpand, 'Central roteiro: 8 acordeões rotulados ROTEIRO NN'); return { v, m }; },
  d2_roteiro_expand: async (win) => { const m = await call(win, 'detExpand()'); const v = F(m.clicked && m.total === EXP.rot && m.open === EXP.rot, 'roteiro Expandir todos → 8 open'); return { v, m }; },
  d2_open_edicao_midia: async (win) => { await call(win, 'openDet("w-edm")'); await sleep(400); const m = await call(win, 'measureDet()'); const labelsOk = m.labels.length === EXP.edm && m.labels.every(k => /^VÍDEO \d\d/.test(k)); const v = F(m.sheetPresent && m.accCount === EXP.edm && labelsOk, 'Central edição de vídeos: 12 acordeões rotulados VÍDEO NN'); return { v, m }; },
  d2_open_edicao_cards: async (win) => { await call(win, 'openDet("w-cards")'); await sleep(400); const m = await call(win, 'measureDet()'); const v = F(m.sheetPresent && m.roleDialog && m.accCount === EXP.cardsAcc && m.openCount === EXP.cardsAcc && m.labels.indexOf('CARD · LEGENDA') >= 0 && m.labels.indexOf('CARD · OBSERVAÇÕES') >= 0, 'Central edição de cards: blocos CARD · LEGENDA e CARD · OBSERVAÇÕES'); return { v, m }; },
  d2_edicao_cards_labels: async (win) => { const md = await call(win, 'measureDet()'); const ml = await call(win, 'detLineBreaks()'); const m = { labels: md.labels, lineBreaks: ml }; const v = F(md.labels.indexOf('CARD · LEGENDA') >= 0 && md.labels.indexOf('CARD · OBSERVAÇÕES') >= 0 && ml.withNewline >= 1 && /pre-wrap/.test(ml.whiteSpace), 'edição de cards: rótulos LEGENDA/OBSERVAÇÕES + corpo com quebras (pre-wrap)'); await call(win, 'detEsc()'); return { v, m }; }
};
const D3 = {
  d3_designers_strip: async (win) => { await ev(win, 'navDesignerBoard', ID.DIEGO); await sleep(500); const m = await call(win, 'measureStrip()'); const v = F(m.found && m.minHeight >= MIN_STRIP_H && m.overflowY === 'hidden' && m.alignItems === 'center' && m.allAv22 && !m.anyClipped && m.chipCount === EXP.designers && m.avCount === EXP.designers, 'faixa Designers: min-height>=58, overflow-y:hidden, align-items:center, avatares 22px NÃO recortados (3 designers)'); return { v, m }; },
  d3_designers_notclip: async (win) => { const m = await call(win, 'measureStrip()'); const v = F(m.found && m.avCount === EXP.designers && !m.anyClipped && m.avatars.every(a => a.top >= m.stripTop - 1 && a.bottom <= m.stripBottom + 1), 'cada avatar Designer dentro dos limites verticais da faixa (topo/base)'); return { v, m }; },
  d3_social_strip: async (win) => { await ev(win, 'navSocialBoard', ID.ANA); await sleep(500); const m = await call(win, 'measureStrip()'); const v = F(m.found && m.minHeight >= MIN_STRIP_H && m.overflowY === 'hidden' && m.alignItems === 'center' && m.allAv22 && !m.anyClipped && m.chipCount === EXP.socialUsers && m.avCount === EXP.socialUsers, 'faixa Social: min-height>=58, overflow-y:hidden, avatares 22px NÃO recortados (4 social)'); return { v, m }; },
  d3_social_notclip: async (win) => { const m = await call(win, 'measureStrip()'); const v = F(m.found && m.avCount === EXP.socialUsers && !m.anyClipped && m.avatars.every(a => a.top >= m.stripTop - 1 && a.bottom <= m.stripBottom + 1), 'cada avatar Social dentro dos limites verticais da faixa'); return { v, m }; }
};
const D4 = {
  d4_autopick_first: async (win) => { await ev(win, 'clearSocialSel'); const id = await call(win, 'navSocialAuto()'); await sleep(500); const cols = await call(win, 'boardCols()'); const m = { socialBoard: id, cols }; const v = F(id === EXP.firstSocial && cols.colCount === EXP.colCount && cols.stripPresent && cols.chipCount === EXP.socialUsers && /Ana/.test(cols.header), 'entrar em Social auto-abre o 1º quadro (A→Z, Ana) por ESTADO — socialBoard != null, 4 colunas, faixa'); return { v, m }; },
  d4_autopick_via_action: async (win) => { await ev(win, 'clearSocialSel'); const id = await call(win, 'navSocialAutoViaAction()'); await sleep(400); const m = { socialBoard: id }; const v = F(id === EXP.firstSocial && id != null, 'ação flowsocials (ramo data-board) também auto-pica por estado — sem element.click()'); return { v, m }; },
  d4_persist_saved: async (win) => { await ev(win, 'saveSocialSel', EXP.savedSocial); const id = await call(win, 'navSocialAuto()'); await sleep(450); const m = { socialBoard: id, saved: EXP.savedSocial }; const v = F(id === EXP.savedSocial, 'persistência: seleção salva (Diana) vence o 1º-A→Z ao reentrar'); return { v, m }; },
  d4_zero_task_columns: async (win) => { await ev(win, 'navSocialBoard', EXP.savedSocial); await sleep(450); const m = await call(win, 'boardCols()'); const v = F(m.colCount === EXP.colCount && m.cardCount === 0 && m.stripPresent, 'quadro com 0 tarefas (Diana) renderiza as 4 colunas SOCIAL_COLS4 mesmo vazio'); return { v, m }; },
  d4_zero_task_col_labels: async (win) => { const m = await call(win, 'boardCols()'); const want = ['A Fazer', 'Em andamento', 'Revisão', 'Finalizado']; const v = F(m.colCount === EXP.colCount && want.every((w, i) => m.colLabels[i] === w), 'as 4 colunas trazem os rótulos SOCIAL_COLS4 (A Fazer/Em andamento/Revisão/Finalizado)'); m.want = want; return { v, m }; },
  d4_strip_chips: async (win) => { const m = await call(win, 'boardCols()'); const v = F(m.stripPresent && m.chipCount === EXP.socialUsers, 'f354SocialStrip: faixa de chips presente mesmo no quadro de 0 tarefas (4 chips)'); return { v, m }; },
  d4_board_has_tasks: async (win) => { await ev(win, 'navSocialBoard', EXP.firstSocial); await sleep(450); const m = await call(win, 'boardCols()'); const v = F(m.colCount === EXP.colCount && m.cardCount > 0 && /Ana/.test(m.header), 'quadro Social de Ana (auto-picável) renderiza cards nas colunas'); return { v, m }; },
  d4_nonnull_guarantee: async (win) => { await ev(win, 'clearSocialSel'); const id = await call(win, 'navSocialAuto()'); await sleep(400); const cols = await call(win, 'boardCols()'); const m = { socialBoard: id, cardCount: cols.cardCount }; const v = F(id != null && cols.colCount === EXP.colCount, 'garantia: a aba Social NUNCA abre vazia à espera de clique — socialBoard auto != null'); return { v, m }; }
};
const REGISTRY = Object.assign({}, D1, D2, D3, D4);

/* helpers de invocação do bundle */
function ev(win, method, arg) { const a = arg === undefined ? '' : JSON.stringify(arg); return win.webContents.executeJavaScript('window.__F354W.' + method + '(' + a + ')'); }
function call(win, expr) { return win.webContents.executeJavaScript('window.__F354W.' + expr); }

async function waitReady(win) {
  for (let i = 0; i < 48; i++) {
    const r = await win.webContents.executeJavaScript(`(function(){try{var S=(typeof state!=='undefined')?state:window.state;return {authed:document.body.classList.contains('authed'),desktop:document.body.classList.contains('desktop'),users:(S&&S.users||[]).length,tasks:(S&&S.tasks||[]).length};}catch(e){return {err:e.message};}})()`).catch(e => ({ err: String(e && e.message || e) }));
    if (r && r.authed && r.desktop && r.tasks >= 8 && r.users >= 8) return r;
    await sleep(280);
  }
  return null;
}

app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  fs.writeFileSync(SEED_FILE, JSON.stringify({ self: SEED.self, users: SEED.users, tasks: SEED.tasks, events: SEED.events }));
  const win = new BrowserWindow({
    width: SCALE === '1.5x' ? 1400 : 1440, height: SCALE === '1.5x' ? 950 : 1000, show: false,
    webPreferences: { preload: path.join(__dirname, 'proof-preload.js'), contextIsolation: false, nodeIntegration: false, sandbox: false, backgroundThrottling: false }
  });
  try { win.showInactive(); } catch (_) {}
  let scenes = 0, failures = 0;
  try {
    await win.loadFile(INDEX);
    const ready = await waitReady(win);
    if (!ready) { process.stdout.write('PROOF_DONE scale=' + SCALE + ' scenes=0 failures=99\n'); console.log('FATAL: renderer não autenticou/semeou (authed+users>=8+tasks>=8)'); app.exit(1); return; }
    await win.webContents.executeJavaScript(INJECT);
    await sleep(300);
    for (let i = 0; i < SCENES.length; i++) {
      const name = SCENES[i]; const fn = REGISTRY[name]; const idx = String(i + 1).padStart(2, '0');
      if (!fn) { line({ scene: name, scale: SCALE, ok: false, why: 'cena desconhecida' }); scenes++; failures++; continue; }
      let res, shot;
      try { res = await fn(win); await sleep(120); shot = await capture(win, idx + '-' + name); }
      catch (e) { res = { v: { ok: false, why: 'EXC:' + (e && e.message || e) }, m: {} }; shot = 'ERR'; }
      const ok = res.v.ok; scenes++; if (!ok) failures++;
      line({ scene: name, scale: SCALE, ok, why: res.v.why, shot, m: res.m });
    }
  } catch (e) { console.log('FATAL: ' + (e && e.message || e)); failures = failures || 1; }
  try { win.destroy(); } catch (_) {}
  process.stdout.write('PROOF_DONE scale=' + SCALE + ' scenes=' + scenes + ' failures=' + failures + '\n');
  app.exit(failures === 0 ? 0 : 1);
});
