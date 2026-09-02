// I7.26.1 — QA GEOMÉTRICO + FUNCIONAL · PREMIUM TASK DETAIL (det3) + MOVE FLOW (mv3)
// Contrato §9: DETAIL/MOVE/DATE/CONTENTS/FOOTER_HSCROLL = 0 (scrollWidth <= clientWidth)
// em default(520px) + drawers (sectors/mine/designers) × 1920/Win125/1366, com cenário
// owner real (Cronograma Ultra · 12 conteúdos · designer em produção · datas completas)
// + variantes longas (título 2 linhas, responsável longo, item 90+ chars).
// Funcional §11: abrir/fechar (X/Esc/backdrop/foco), Mover (destinos reais, seleção→
// confirmar→moveStatus local), itens data-wfitemdone, remover (confirm), trocar designer,
// ver quadro, copiar/expandir/recolher, editar observação. E1 por captura + manifest.
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = '/home/user/Agenda/desktop/src/renderer';
const OUT = '/home/user/Agenda/desktop/qa-out-i7261';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try { const b = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => srv.listen(8902, r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const G = {}; const INFO = { vps: {} }; const MANIFEST = [];
const fail = (k, why) => { G[k] = false; INFO['why_' + k] = why; };

const SEED = `(function(){
  const D = n => { const d = new Date(Date.now() + n*86400000); return d.toISOString().slice(0,10); };
  state.user = { id:'carlos', name:'Carlos Eduardo', role:'Social Media', admin:true };
  state.users = [state.user,
    { id:'marina', name:'Marina Klein', role:'Designer' },
    { id:'helena', name:'Maria Fernanda Albuquerque de Santana', role:'Designer' },
    { id:'op1', name:'Otavio Prado', role:'Editor de video' }];
  document.body.classList.add('desktop','authed','light-ui');
  const asp=document.getElementById('authSplash'); if(asp) asp.style.display='none';
  const lg=document.getElementById('login'); if(lg) lg.classList.add('hidden');
  const ap=document.getElementById('app'); if(ap) ap.style.display='flex';
  const now=Date.now();
  const temas=[
    'Agenda aberta de setembro','Bastidores do centro cirurgico','Depoimento de paciente — catarata',
    'Mitos e verdades sobre lentes de contato','Equipe em foco: enfermagem','Retrospectiva do mes',
    'Pacote completo de artes do lancamento da colecao primavera com stories feed capa e destaques em todas as redes do cliente',
    'Dica rapida: exame de fundo de olho','Antes e depois — cirurgia refrativa','Campanha outubro rosa',
    'Chamada para agendamento online','Encerramento do trimestre'];
  const cron=temas.map((tm,i)=>({ tema:tm, legenda:(i%3===0)?('Legenda do conteudo '+(i+1)+' com texto real de publicacao, hashtags e chamada para acao.\\nSegunda linha da legenda.'):'' }));
  state.tasks=[
    { id:'u1', title:'Cronograma Ultra', client:'Hospital Visão', sector:'cronograma',
      by:'carlos', assigneeId:'carlos', status:'andamento',
      createdAt: now-4*86400000, startDate:D(-2), startTime:'09:00', endDate:D(3), endTime:'12:00',
      dueDate:D(2), dueTime:'18:00', cronContents:cron,
      designerAssignment:{ designerId:'marina', designerName:'Marina Klein', status:'in_progress', assignedAt: now-2*86400000 },
      designerSla:{ planStartAt: now-2*86400000, startedAt: now-2*86400000 },
      designerFlowStatus:'afazer',
      history:[{kind:'moved',at:now-3600000,byId:'carlos',from:'afazer',to:'andamento'}] },
    { id:'u2', title:'Pacote completo de lancamento da colecao primavera para todas as redes do cliente com destaques', client:'Sunset Wear', sector:'cronograma',
      by:'carlos', assigneeId:'carlos', status:'andamento',
      createdAt: now-3*86400000, dueDate:D(1), dueTime:'17:00',
      cronContents:[{tema:'Tema unico da producao'}],
      designerAssignment:{ designerId:'helena', designerName:'Maria Fernanda Albuquerque de Santana', status:'in_progress', assignedAt: now-86400000 },
      designerSla:{ planStartAt: now-86400000, startedAt: now-86400000 },
      designerFlowStatus:'andamento',
      history:[] }];
  state.events=[]; state.tab='hoje'; render();
})()`;

const NAV = k => `(function(){
  state.form=null; state.boardSector=null; state.personBoard=null; state.roleBoards=false;
  state.flowView=null; state.designerBoard=null; state.socialBoard=null; state.tab='tarefas';
  if('${k}'==='designers'){ state.flowView='designers'; state.designerBoard='marina'; }
  else if('${k}'==='mine'){ state.personBoard='carlos'; }
  else if('${k}'==='hoje'){ state.tab='hoje'; }
  else { state.boardSector='cronograma'; }
  render();
})()`;

const MEASURE = `(function(){
  const sheet=document.querySelector('.det-sheet'); if(!sheet) return {err:'no det sheet'};
  const sr=sheet.getBoundingClientRect(); const r={sheetW:+sr.width.toFixed(1)};
  const probe=(sel)=>{const e=(sel==='sheet')?sheet:sheet.querySelector(sel);if(!e)return null;
    return {sW:e.scrollWidth,cW:e.clientWidth,over:Math.max(0,e.scrollWidth-e.clientWidth)};};
  r.blocks={sheet:probe('sheet'),body:probe('.det-body'),dates:probe('.det3-dl'),
    status:probe('.det3-status'),resp:probe('.det3-resp'),contents:probe('.det-contents'),foot:probe('.det-actions')};
  r.beyond=0; sheet.querySelectorAll('*').forEach(e=>{const b=e.getBoundingClientRect();
    if(b.width>0&&b.right>sr.right+1.5)r.beyond++;});
  /* ocorrências VISÍVEIS do rótulo de status (conteúdo dentro de <details> colapsado —
     "Detalhes do fluxo" — é progressive disclosure §5E, não repetição visual) */
  const lbl=(document.querySelector('.det3-st-l')||{}).textContent||'';
  let occ=0; if(lbl){ sheet.querySelectorAll('*').forEach(e=>{ const vis=e.checkVisibility?e.checkVisibility():(e.offsetParent!==null); if(e.children.length===0&&vis&&(e.textContent||'').trim()===lbl.trim())occ++; }); }
  r.statusLabel={txt:lbl.trim(),occ};
  r.personCards=sheet.querySelectorAll('.det-person').length;
  r.respRow=!!sheet.querySelector('.det3-resp-row');
  r.respMeta=((sheet.querySelector('.det3-resp-meta')||{}).textContent||'').trim();
  const dl=sheet.querySelector('.det3-dl');
  r.dateCols=dl?getComputedStyle(dl).gridTemplateColumns.split(' ').length:0;
  r.dateLabels=[...sheet.querySelectorAll('.det3-dl:not(.det3-dl-sla) .det3-dt-l')].map(e=>e.textContent.trim());
  const rows=[...sheet.querySelectorAll('.det-contents .det-acc:not([open])>summary')].map(s=>+s.getBoundingClientRect().height.toFixed(0));
  r.rowHeights=rows;
  r.accRows=sheet.querySelectorAll('.det-contents .det-acc').length;
  const fx=k=>{const e=sheet.querySelector(k);return e?+e.getBoundingClientRect().x.toFixed(0):-1;};
  r.footOrder={rem:fx('.det3-aux-danger'),close:fx('.det-close'),move:fx('[data-move].det3-primary')};
  r.primaryH=(sheet.querySelector('[data-move].det3-primary')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height;
  r.ctx=((sheet.querySelector('.det3-ctx')||{}).textContent||'').replace(/\\s+/g,' ').trim();
  r.titleClip=(function(){const t=sheet.querySelector('.det-title');return t?(t.scrollWidth>t.clientWidth+1):null;})();
  r.sla=!!sheet.querySelector('.det3-sla');
  r.slaEdit=!!sheet.querySelector('[data-sla-editprazo]');
  r.flowdet=!!sheet.querySelector('.det-flowdet');
  r.hint=!!sheet.querySelector('.kbv2-hint');
  return r;
})()`;

const MEASURE_MV = `(function(){
  const back=document.querySelector('.modal-back[data-movemodal]'); if(!back) return {err:'no move'};
  const sheet=back.querySelector('.sheet.mv3'); const sr=sheet.getBoundingClientRect();
  const r={sheetW:+sr.width.toFixed(1),sheetH:+sr.height.toFixed(1),vh:window.innerHeight};
  const probe=e=>e?{over:Math.max(0,e.scrollWidth-e.clientWidth)}:null;
  r.over={sheet:probe(sheet).over,body:probe(sheet.querySelector('.mv3-body')).over,
    list:(sheet.querySelector('.mv3-items-list')?probe(sheet.querySelector('.mv3-items-list')).over:0),
    foot:probe(sheet.querySelector('.mv3-foot')).over};
  r.beyond=0; sheet.querySelectorAll('*').forEach(e=>{const b=e.getBoundingClientRect();
    if(b.width>0&&b.right>sr.right+1.5)r.beyond++;});
  r.cur=((sheet.querySelector('.mv3-cur-v')||{}).textContent||'').replace(/\\s+/g,' ').trim();
  r.opts=[...sheet.querySelectorAll('.mv3-opt')].map(o=>({k:o.getAttribute('data-movesel'),l:((o.querySelector('.mv3-opt-l')||{}).textContent||'').trim()}));
  r.pills=sheet.querySelectorAll('.chip[data-wfitemdone]').length;
  r.items=sheet.querySelectorAll('.mv3-item').length;
  r.itemsCount=((sheet.querySelector('.mv3-items-c')||{}).textContent||'').trim();
  r.itemClipped=[...sheet.querySelectorAll('.mv3-item-t')].filter(e=>e.scrollWidth>e.clientWidth+1).length;
  r.itemEllipsis=[...sheet.querySelectorAll('.mv3-item-t')].every(e=>getComputedStyle(e).textOverflow==='ellipsis');
  r.cancel=!!sheet.querySelector('.mv3-foot [data-modalclose]');
  const go=sheet.querySelector('.mv3-go');
  r.go=go?{disabled:go.disabled,txt:go.textContent.trim(),domove:go.getAttribute('data-domove')}:null;
  return r;
})()`;

const VPS = [
  { name: '1920', width: 1920, height: 1080, dpr: 1 },
  { name: 'win125', width: 1536, height: 864, dpr: 1.25 },
  { name: '1366', width: 1366, height: 768, dpr: 1 },
];

for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
  await ctx.addInitScript(() => {
    const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop });
    ['initializeApp', 'getFirestore', 'getAuth'].forEach(k => { window[k] = noop; });
    window.firebase = noop;
  });
  const pg = await ctx.newPage();
  const perr = []; pg.on('pageerror', e => perr.push(String(e).slice(0, 200)));
  await pg.goto('http://127.0.0.1:8902/', { waitUntil: 'load' });
  await pg.waitForTimeout(2200);
  await pg.evaluate(() => { window.__qaRevealSuppressed = []; window._revealLogin = function (r) { window.__qaRevealSuppressed.push(String(r || '')); }; });
  await pg.evaluate(SEED); await pg.waitForTimeout(500);
  const V = {}; INFO.vps[vp.name] = V;

  const login = () => pg.evaluate(() => { const l = document.getElementById('login'); return !!l && !l.classList.contains('hidden') && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().width > 0; });
  const shot = async (name, surface, el) => {
    const lp = await login();
    MANIFEST.push({ filename: name, surface, viewport: vp.name, loginPresent: lp, screenshotValid: !lp });
    if (lp) { fail('E1_' + name, 'login presente'); return; }
    if (el) { const h = await pg.$(el); if (h) await h.screenshot({ path: path.join(OUT, name) }); else MANIFEST[MANIFEST.length - 1].screenshotValid = false; }
    else await pg.screenshot({ path: path.join(OUT, name) });
  };
  const open = async (id) => { await pg.evaluate(tid => openDetails(tid), id); await pg.waitForTimeout(480); };
  const close = async () => { await pg.evaluate(() => closeModal()), await pg.waitForTimeout(220); };

  // ── DETAIL: 4 apresentações × medições
  for (const surf of ['hoje', 'sector', 'mine', 'designers']) {
    await pg.evaluate(NAV(surf)); await pg.waitForTimeout(420);
    await open('u1');
    const m = await pg.evaluate(MEASURE); V['det_' + surf] = m;
    const tag = surf + '@' + vp.name;
    for (const [bk, bv] of Object.entries(m.blocks)) if (bv && bv.over > 0) fail('DET_HS_' + tag + '_' + bk, 'over=' + bv.over);
    if (m.beyond > 0) fail('DET_BEYOND_' + tag, 'beyond=' + m.beyond);
    if (m.statusLabel.occ !== 1) fail('DET_STATUS1_' + tag, 'occ=' + m.statusLabel.occ);
    if (m.personCards !== 0) fail('DET_NOMEGACARD_' + tag, 'personCards=' + m.personCards);
    if (!m.respRow) fail('DET_RESP_' + tag, 'sem resp row');
    if (!/Execução:/.test(m.respMeta) || !/Enviado por:/.test(m.respMeta) || !/Designer:/.test(m.respMeta)) fail('DET_RESPMETA_' + tag, m.respMeta.slice(0, 60));
    if (m.titleClip) fail('DET_TITLE_' + tag, 'titulo clipado');
    if (surf === 'hoje') {
      if (!(m.sheetW >= 480 && m.sheetW <= 560)) fail('DET_W_' + vp.name, 'w=' + m.sheetW);
      if (m.dateCols !== 2) fail('DET_DATES2COL_' + vp.name, 'cols=' + m.dateCols);
      if (!(m.ctx.indexOf('Cronograma') >= 0 && m.ctx.indexOf('Hospital') >= 0)) fail('DET_CTX_' + vp.name, m.ctx);
      const dl = m.dateLabels.join('|');
      if (!(/Criado/.test(dl) && /Início/.test(dl) && /Término/.test(dl) && /Atualizado/.test(dl) && /Prazo final/.test(dl))) fail('DET_DATELBL_' + vp.name, dl);
      if (m.accRows !== 12) fail('DET_ROWS12_' + vp.name, 'rows=' + m.accRows);
      const rh = m.rowHeights; if (rh.length > 2 && (Math.max(...rh) - Math.min(...rh)) > 26) fail('DET_ROWCONSIST_' + vp.name, rh.join(','));
      if (!(m.footOrder.rem >= 0 && m.footOrder.close > m.footOrder.rem && m.footOrder.move > m.footOrder.close)) fail('DET_FOOTORDER_' + vp.name, JSON.stringify(m.footOrder));
      if (!(m.primaryH >= 38 && m.primaryH <= 44)) fail('DET_PRIMARYH_' + vp.name, 'h=' + m.primaryH);
      if (!m.sla || !m.slaEdit) fail('DET_SLA_' + vp.name, 'sla=' + m.sla + ' edit=' + m.slaEdit);
      if (!m.flowdet) fail('DET_FLOWDET_' + vp.name, 'sem detalhes do fluxo');
    }
    if (surf === 'sector' && m.dateCols !== 1) fail('DET_DATES1COL_' + vp.name, 'cols=' + m.dateCols + ' (drawer)');
    if (surf === 'hoje' && vp.name !== 'win125') await shot('I7261-AFTER-DETAIL-' + (vp.name === '1920' ? '1920' : '1366') + '.png', 'Detail default ' + vp.name);
    if (surf === 'hoje' && vp.name === 'win125') await shot('I7261-AFTER-DETAIL-WIN125.png', 'Detail default win125');
    if (surf === 'hoje' && vp.name === '1920') {
      await shot('I7261-DETAIL-SUMMARY.png', 'crop status+resp', '.det3-status');
      await shot('I7261-DETAIL-DATES.png', 'crop datas', '.det3-dl:not(.det3-dl-sla)');
      await shot('I7261-DETAIL-CONTENTS.png', 'crop conteudos', '.det-contents');
    }
    await close();
  }

  // variantes longas (u2): título 2 linhas + responsável longo — default
  await pg.evaluate(NAV('hoje')); await pg.waitForTimeout(350);
  await open('u2');
  const m2 = await pg.evaluate(MEASURE); V.det_long = m2;
  for (const [bk, bv] of Object.entries(m2.blocks)) if (bv && bv.over > 0) fail('DETL_HS_' + vp.name + '_' + bk, 'over=' + bv.over);
  if (m2.beyond > 0) fail('DETL_BEYOND_' + vp.name, 'beyond=' + m2.beyond);
  if (vp.name === '1920') {
    await pg.evaluate(() => { const d = document.querySelector('.det-contents .det-acc'); if (d) d.open = true; }); await pg.waitForTimeout(200);
    await shot('I7261-DETAIL-CONTENTS-LONG.png', 'crop conteudo longo expandido', '.det-contents');
  }
  await close();

  // ── funcional (só 1920; geometria já coberta em todos os vps)
  if (vp.name === '1920') {
    await pg.evaluate(NAV('sector')); await pg.waitForTimeout(400);
    await open('u1');
    G.FUN_openDetail = await pg.evaluate(() => !!document.querySelector('.modal-back[data-detmodal] .det-sheet.det3'));
    G.FUN_focusInitial = await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains('det-x'));
    await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab');
    G.FUN_trapDetail = await pg.evaluate(() => { const b = document.querySelector('.modal-back[data-detmodal]'); return !!b && b.contains(document.activeElement); });
    G.FUN_copyBtns = await pg.evaluate(() => document.querySelectorAll('.det-acc-cbtn[data-detcopytheme]').length === 12 && [...document.querySelectorAll('.det-acc-cbtn')].every(b => b.getAttribute('aria-label')));
    await pg.evaluate(() => { const b = document.querySelector('[data-detexpand]'); if (b) b.click(); }); await pg.waitForTimeout(250);
    G.FUN_expandAll = await pg.evaluate(() => [...document.querySelectorAll('.det-contents .det-acc')].every(d => d.open));
    await pg.evaluate(() => { const b = document.querySelector('[data-detcollapse]'); if (b) b.click(); }); await pg.waitForTimeout(250);
    G.FUN_collapseAll = await pg.evaluate(() => [...document.querySelectorAll('.det-contents .det-acc')].every(d => !d.open));
    await pg.evaluate(() => { const b = document.querySelector('[data-detnoteedit]'); if (b) b.click(); }); await pg.waitForTimeout(250);
    G.FUN_noteEditor = await pg.evaluate(() => { const x = document.querySelector('.det-note-ed:not([hidden])'); const ok = !!x; const c = document.querySelector('.det-note-ed [data-detnotecancel],[data-detnotebox] button'); if (c) c.click(); return ok; });
    G.FUN_goboard = await (async () => {
      await pg.evaluate(() => { const b = document.querySelector('.det3-qa[data-goboard]'); if (b) b.click(); }); await pg.waitForTimeout(400);
      return pg.evaluate(() => state.flowView === 'designers' && state.designerBoard === 'marina' && !document.querySelector('.modal-back[data-detmodal]'));
    })();
    await pg.evaluate(NAV('sector')); await pg.waitForTimeout(350); await open('u1');
    G.FUN_trocar = await (async () => {
      await pg.evaluate(() => { const b = document.querySelector('.det3-qa[data-senddesigner]'); if (b) b.click(); }); await pg.waitForTimeout(380);
      const ok = await pg.evaluate(() => /designer/i.test((document.getElementById('modalRoot') || {}).innerText || '') && !!document.querySelector('[data-pickdesigner]'));
      await pg.evaluate(() => closeModal()); return ok;
    })();
    await open('u1');
    G.FUN_removerConfirm = await (async () => {
      await pg.evaluate(() => { const b = document.querySelector('.det3-aux-danger[data-del]'); if (b) b.click(); }); await pg.waitForTimeout(380);
      const ok = await pg.evaluate(() => /Remover tarefa\?/.test((document.getElementById('modalRoot') || {}).innerText || '') && !!document.querySelector('[data-dodelete]'));
      await pg.evaluate(() => closeModal()); return ok;
    })();
    await open('u1');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    G.FUN_escDetail = await pg.evaluate(() => !document.querySelector('.modal-back[data-detmodal]'));
    await open('u1');
    await pg.evaluate(() => { const b = document.querySelector('.modal-back[data-detmodal]'); if (b) b.click(); }); await pg.waitForTimeout(250);
    G.FUN_backdropDetail = await pg.evaluate(() => !document.querySelector('.modal-back[data-detmodal]'));

    // jornada Detail→Move (compare) + MOVE eixo social (3 destinos)
    await pg.evaluate(NAV('sector')); await pg.waitForTimeout(350); await open('u1');
    await pg.evaluate(() => { const b = document.querySelector('.det3-primary[data-move]'); if (b) b.click(); }); await pg.waitForTimeout(450);
    const ms = await pg.evaluate(MEASURE_MV); V.move_social = ms;
    G.MV_fromDetail = !ms.err;
    if (!(ms.sheetW >= 500 && ms.sheetW <= 600)) fail('MV_W', 'w=' + ms.sheetW);
    if (!(ms.sheetH <= ms.vh - 78)) fail('MV_MAXH', ms.sheetH + '/' + ms.vh);
    for (const [k, v] of Object.entries(ms.over)) if (v > 0) fail('MV_HS_social_' + k, 'over=' + v);
    if (ms.beyond > 0) fail('MV_BEYOND_social', 'beyond=' + ms.beyond);
    G.MV_curShown = /Em andamento/.test(ms.cur) && /estado atual/i.test(ms.cur);
    G.MV_socialOpts = ms.opts.length === 3 && !ms.opts.some(o => o.k === 'andamento');
    G.MV_noPills = ms.pills === 0;
    G.MV_socialNoItems = ms.items === 0;
    G.MV_cancel = ms.cancel === true;
    G.MV_goDisabled = !!ms.go && ms.go.disabled === true;
    await shot('I7261-DETAIL-MOVE-COMPARE.png', 'jornada Detail→Move');
    // seleção + confirmação REAL (moveStatus local)
    await pg.evaluate(() => { const o = [...document.querySelectorAll('.mv3-opt')].find(x => x.getAttribute('data-movesel') === 'revisao'); if (o) o.click(); }); await pg.waitForTimeout(250);
    const sel = await pg.evaluate(MEASURE_MV);
    G.MV_select = !!sel.go && sel.go.disabled === false && /Mover para Revisão/.test(sel.go.txt) && sel.go.domove === 'u1|revisao';
    await shot('I7261-AFTER-MOVE.png', 'Move social selecionado');
    await pg.evaluate(() => { const b = document.querySelector('.mv3-go'); if (b) b.click(); }); await pg.waitForTimeout(450);
    G.MV_confirm = await pg.evaluate(() => !document.querySelector('.modal-back[data-movemodal]') && state.tasks.find(t => t.id === 'u1').status === 'revisao');
    await pg.evaluate(() => { const t = state.tasks.find(x => x.id === 'u1'); t.status = 'andamento'; render(); }); await pg.waitForTimeout(300);

    // MOVE eixo DESIGNER (itens funcionais em lista)
    await pg.evaluate(NAV('designers')); await pg.waitForTimeout(400);
    await pg.evaluate(() => openMove('u1')); await pg.waitForTimeout(450);
    const md = await pg.evaluate(MEASURE_MV); V.move_designer = md;
    for (const [k, v] of Object.entries(md.over)) if (v > 0) fail('MV_HS_designer_' + k, 'over=' + v);
    if (md.beyond > 0) fail('MV_BEYOND_designer', 'beyond=' + md.beyond);
    G.MV_designerCur = /A Fazer/.test(md.cur);
    G.MV_designerOpts = md.opts.length === 1 && md.opts[0].k === 'andamento';
    G.MV_items12 = md.items === 12 && md.pills === 0;
    G.MV_itemsCount0 = /0 de 12/.test(md.itemsCount);
    G.MV_itemEllipsis = md.itemEllipsis === true;   // ellipsis É a estratégia (título completo vive no Detail)
    await shot('I7261-AFTER-MOVE-LONG.png', 'Move designer 12 itens');
    await pg.evaluate(() => { const it = document.querySelector('.mv3-item'); if (it) it.click(); }); await pg.waitForTimeout(350);
    G.MV_itemToggleOn = await pg.evaluate(() => { const it = document.querySelector('.mv3-item'); const cc = document.querySelector('.mv3-items-c'); const t = state.tasks.find(x => x.id === 'u1'); return it.classList.contains('on') && /1 de 12/.test(cc.textContent) && t.designerItemStatus && t.designerItemStatus.i0 && t.designerItemStatus.i0.st === 'concluido'; });
    await pg.evaluate(() => { const it = document.querySelector('.mv3-item'); if (it) it.click(); }); await pg.waitForTimeout(350);
    G.MV_itemToggleOff = await pg.evaluate(() => { const it = document.querySelector('.mv3-item'); const cc = document.querySelector('.mv3-items-c'); const t = state.tasks.find(x => x.id === 'u1'); return !it.classList.contains('on') && /0 de 12/.test(cc.textContent) && t.designerItemStatus.i0.st === 'pendente'; });
    G.MV_focusInitial = await pg.evaluate(() => document.activeElement && document.activeElement.classList.contains('det-x'));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
    G.MV_esc = await pg.evaluate(() => !document.querySelector('.modal-back[data-movemodal]'));
    await pg.evaluate(() => openMove('u1')); await pg.waitForTimeout(400);
    await pg.evaluate(() => { const c = document.querySelector('.mv3-foot [data-modalclose]'); if (c) c.click(); }); await pg.waitForTimeout(250);
    G.MV_cancelCloses = await pg.evaluate(() => !document.querySelector('.modal-back[data-movemodal]'));
  }

  V.pageErrors = perr;
  if (perr.length) fail('P0_pageErrors_' + vp.name, perr.join(' | ').slice(0, 200));
  await ctx.close();
}
await browser.close(); srv.close();

G.E1_manifestAllValid = MANIFEST.length >= 10 && MANIFEST.every(m => m.screenshotValid === true && m.loginPresent === false);
const fails = Object.entries(G).filter(([k, v]) => v === false).map(([k]) => k);
const out = { phase: 'I7.26.1-QA', when: new Date().toISOString(), total: Object.keys(G).length, pass: Object.keys(G).length - fails.length, fails, g: G, manifest: MANIFEST, info: INFO };
fs.writeFileSync(path.join(OUT, 'i7261-gates.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'i7261-evidence-manifest.json'), JSON.stringify(MANIFEST, null, 1));
console.log(JSON.stringify({ total: out.total, pass: out.pass, fails: out.fails, info1920: INFO.vps['1920'] && { det_hoje: INFO.vps['1920'].det_hoje, move_social: INFO.vps['1920'].move_social, move_designer: INFO.vps['1920'].move_designer } }, null, 1));
process.exit(fails.length ? 1 : 0);
