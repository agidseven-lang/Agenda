// I7.20.2 — QA visual/funcional do candidato "Hoje actionability" (Option B, OWNER APPROVED).
// A/B no MESMO run: BASELINE_DIR (renderer 1.0.252 público extraído de b7656aee) = BEFORE;
// worktree atual = AFTER. E1 obrigatório: supressão registrada de _revealLogin + gate por
// captura (loginPresent=false + heading + sidebar) + manifest JSON. Zero produto aqui.
// Uso:  BASELINE_DIR=<dir com index.html+priorityEngine.js da baseline> node desktop/scripts/visual-qa-i7202-hoje-actionability.mjs
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd(), 'desktop/src/renderer');
const BASE = process.env.BASELINE_DIR;
if (!BASE || !fs.existsSync(path.join(BASE, 'index.html'))) { console.error('BASELINE_DIR obrigatório (index.html da baseline 1.0.252)'); process.exit(2); }
const OUT = path.resolve(process.cwd(), 'desktop/qa-out-i7202');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const serve = (root, port) => new Promise(r => { const s = http.createServer((req, res) => { const p = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0])); try { const b = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(b); } catch { try { const b = fs.readFileSync(path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]))); res.writeHead(200, { 'Content-Type': 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end('nf'); } } }); s.listen(port, () => r(s)); });
const sAfter = await serve(ROOT, 8895);
const sBefore = await serve(BASE, 8896);

const EXEC = process.env.QA_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browser = await chromium.launch({ executablePath: fs.existsSync(EXEC) ? EXEC : undefined });
const g = {}; const I = {}; const MANIFEST = []; let shotFails = 0;

const SEED = ({ d0, d1, d2, role }) => `(()=>{
  state.user=${role === 'op' ? `{id:'op1',name:'Otavio Prado',role:'Editor de video'}` : `{id:'carlos',name:'Carlos Eduardo',role:'Social Media',admin:true}`};
  state.users=[{id:'carlos',name:'Carlos Eduardo',role:'Social Media',admin:true},{id:'op1',name:'Otavio Prado',role:'Editor de video'},{id:'marina',name:'Marina Klein',role:'Designer'},{id:'bia',name:'Bia Rocha',role:'Social Media'}];
  document.body.classList.add('desktop','authed','light-ui');
  const asp=document.getElementById('authSplash'); if(asp)asp.style.display='none';
  const lg=document.getElementById('login'); if(lg)lg.classList.add('hidden');
  const ap=document.getElementById('app'); if(ap)ap.style.display='flex';
  state.tasks=[
    {id:'u1',title:'Post de Agenda Aberta - histeroscopias',client:'Dra. Helita Freitas',sector:'edicao_cards',by:'carlos',assigneeId:'carlos',status:'afazer',dueDate:'2026-08-27',dueTime:'19:00'},
    {id:'u2',title:'Edicao de videos - Agosto',client:'Hospital Visao',sector:'edicao_midia',by:'carlos',assigneeId:'marina',status:'andamento',dueDate:'${d0}',dueTime:'18:30',priority:true},
    {id:'u3',title:'Reels de lancamento',client:'Sunset Wear',sector:'edicao_cards',by:'marina',assigneeId:'carlos',status:'revisao',dueDate:'${d1}',dueTime:'11:00'},
    {id:'u4',title:'Cronograma Setembro - rodada 2',client:'Sunset Wear',sector:'cronograma',by:'carlos',assigneeId:'bia',status:'andamento',dueDate:'${d2}',dueTime:'15:00'},
    {id:'u5',title:'Video institucional - cortes finais',client:'Colegio Alfa',sector:'edicao_midia',by:'carlos',assigneeId:'op1',status:'andamento',dueDate:'${d2}',dueTime:'10:00'},
    {id:'u6',title:'Capa de destaque - primavera',client:'Sunset Wear',sector:'edicao_cards',by:'carlos',assigneeId:'carlos',status:'concluido',dueDate:'2026-08-25'},
    {id:'u7',title:'Roteiro de reels - op',client:'Clinica Vida',sector:'edicao_cards',by:'op1',assigneeId:'op1',status:'afazer',dueDate:'${d1}',dueTime:'09:00'}
  ];
  state.events=[
    {id:'e1',title:'Reuniao de pauta semanal',client:'Interno',type:'reuniao',date:'${d0}',start:'09:30',end:'10:15',location:'Sala 2',ownerId:'carlos',by:'carlos',done:false},
    {id:'e2',title:'Gravacao - Dra. Helita',client:'Dra. Helita Freitas',type:'gravacao',date:'${d0}',start:'14:00',end:'16:00',location:'Estudio',ownerId:'marina',by:'carlos',done:false},
    {id:'e3',title:'Alinhamento Sunset Wear',client:'Sunset Wear',type:'reuniao',date:'${d1}',start:'10:00',end:'11:00',ownerId:'bia',by:'carlos',done:false}
  ];
  state.tab='hoje'; state.form=null; state.personBoard=null; state.flowView=null; state.boardSector=null; render();
})()`;
const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const SD = { d0: D(0), d1: D(1), d2: D(2) };

async function boot(url) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(() => { const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop }); ['initializeApp', 'getFirestore', 'getAuth'].forEach(k => { window[k] = noop; }); window.firebase = noop; });
  const pg = await ctx.newPage();
  const perr = []; pg.on('pageerror', e => perr.push(String(e).slice(0, 200)));
  await pg.goto(url, { waitUntil: 'load' }); await pg.waitForTimeout(2300);
  await pg.evaluate(() => { window.__qaRevealSuppressed = []; window._revealLogin = function (r) { window.__qaRevealSuppressed.push(String(r || '')); }; });
  return { ctx, pg, perr };
}
const probe = pg => pg.evaluate(() => {
  const l = document.getElementById('login');
  const loginPresent = !!l && !l.classList.contains('hidden') && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().width > 0;
  const el = document.querySelector('#content .scr-head, #content .h-title');
  const heading = (((el && el.textContent) || '').trim() || (document.getElementById('content').innerText || '').trim()).replace(/\s+/g, ' ').slice(0, 70);
  return { loginPresent, heading, sidebar: !!document.querySelector('#bottomNav .sb-item'), vw: window.innerWidth + 'x' + window.innerHeight };
});
async function shot(pg, name, headRe, opts = {}) {
  const p = await probe(pg);
  const ok = !p.loginPresent && headRe.test(p.heading) && p.sidebar && (opts.check ? await opts.check() : true);
  MANIFEST.push({ filename: name, viewport: p.vw, expectedHeading: String(headRe), actualHeading: p.heading, loginPresent: p.loginPresent, screenshotValid: ok });
  if (!ok) { shotFails++; console.error('INVALID SHOT SKIPPED:', name, JSON.stringify(p)); return false; }
  if (opts.el) { const h = await pg.$(opts.el); if (!h) { shotFails++; console.error('ELEMENT MISSING:', name, opts.el); return false; } await h.screenshot({ path: path.join(OUT, name) }); }
  else await pg.screenshot({ path: path.join(OUT, name) });
  console.log('SHOT OK', name, p.vw); return true;
}
const clk = async (pg, sel) => { await pg.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await pg.waitForTimeout(380); };

/* ================= BEFORE — baseline 1.0.252 pública ================= */
{
  const { pg, perr } = await boot('http://127.0.0.1:8896/');
  await pg.evaluate(SEED({ ...SD }));
  await pg.waitForTimeout(600);
  g.B1_beforeUrgentDead = await pg.evaluate(() => { const r = document.querySelector('#content .col-tasks .card'); return !!r && !r.hasAttribute('data-detail') && r.getAttribute('role') !== 'button' && getComputedStyle(r).cursor === 'auto'; });
  g.B2_beforeKpiTarefasTab = await pg.evaluate(() => { const b = [...document.querySelectorAll('#content .stats .stat')].find(x => /Tarefas/.test(x.textContent)); return !!b && b.dataset.tab === 'tarefas' && !b.hasAttribute('data-myboard'); });
  I.beforeKpiValue = await pg.evaluate(() => ([...document.querySelectorAll('#content .stats .stat')].find(x => /Tarefas/.test(x.textContent)).querySelector('.v') || {}).textContent);
  await shot(pg, 'I7202-BEFORE-HOJE-1920.png', /Olá, Carlos/);
  g.B_pageErrors = perr.length === 0;
}

/* ================= AFTER — candidato (ADMIN) ================= */
const { pg, perr } = await boot('http://127.0.0.1:8895/');
await pg.evaluate(SEED({ ...SD }));
await pg.waitForTimeout(600);

// ---- H gates (J1) ----
const rows = await pg.evaluate(() => [...document.querySelectorAll('#content .col-tasks .card')].map(r => ({
  id: r.getAttribute('data-detail'), role: r.getAttribute('role'), tab: r.getAttribute('tabindex'),
  cursor: getComputedStyle(r).cursor, cls: r.className, aria: r.getAttribute('aria-label'),
  inner: r.querySelectorAll('button,a,input,select,textarea,[data-evdetail],[data-move],[data-cardmenu]').length,
  h: r.getBoundingClientRect().height
})));
I.urgentRows = rows;
g.H1_realIds = rows.length === 4 && rows.every(r => ['u1', 'u2', 'u3', 'u4', 'u5', 'u7'].includes(r.id));
g.H2_oneDataDetail = rows.every(r => !!r.id) && (await pg.evaluate(() => [...document.querySelectorAll('#content .col-tasks .card')].every(r => r.querySelectorAll('[data-detail]').length === 0)));
g.H3_roleButton = rows.every(r => r.role === 'button');
g.H4_tabindex = rows.every(r => r.tab === '0');
g.H5_affordance = rows.every(r => r.cursor === 'pointer' && /hj-urgent/.test(r.cls) && !!r.aria);
g.H12_H13_noInnerConflict = rows.every(r => r.inner === 0);
// H6/H7: click real → Detail da MESMA task
const firstId = rows[0].id;
await clk(pg, '#content .col-tasks .card[data-detail="' + firstId + '"]');
g.H6_clickOpensDetail = await pg.evaluate(() => !!document.querySelector('.modal-back[data-detmodal] .det-sheet'));
g.H7_sameTask = (await pg.evaluate(() => (document.querySelector('.modal-back[data-detmodal]') || { dataset: {} }).dataset.dettaskid)) === firstId;
await shot(pg, 'I7202-URGENT-DETAIL-OPEN.png', /Olá, Carlos/, { check: async () => pg.evaluate(() => !!document.querySelector('.det-sheet')) });
// H8/H9: fechar pelo controle real; Hoje intacto; task não mutada
const taskSnap0 = await pg.evaluate(id => JSON.stringify(state.tasks.find(t => t.id === id)), firstId);
await clk(pg, '.det-x');
g.H8_closeReal = await pg.evaluate(() => ((document.getElementById('modalRoot') || {}).innerHTML || '').length < 50);
g.H9_backIntact = await pg.evaluate(() => state.tab === 'hoje' && document.querySelectorAll('#content .col-tasks .card').length === 4) && (await pg.evaluate(id => JSON.stringify(state.tasks.find(t => t.id === id)), firstId)) === taskSnap0;
// H10/H11: teclado Enter e Espaço (dispatch real no elemento focado)
const kb = async key => {
  await pg.evaluate(id => { const r = document.querySelector('#content .col-tasks .card[data-detail="' + id + '"]'); r.focus(); }, firstId);
  await pg.keyboard.press(key); await pg.waitForTimeout(380);
  const ok = await pg.evaluate(id => { const m = document.querySelector('.modal-back[data-detmodal]'); return !!m && m.dataset.dettaskid === id; }, firstId);
  await clk(pg, '.det-x'); return ok;
};
g.H10_enter = await kb('Enter');
g.H11_space = await kb('Space');
// focus/hover crops
await pg.evaluate(id => { document.querySelector('#content .col-tasks .card[data-detail="' + id + '"]').focus(); }, firstId);
await pg.waitForTimeout(250);
await shot(pg, 'I7202-URGENT-ROW-FOCUS.png', /Olá, Carlos/, { el: '#content .col-tasks' });
await pg.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
const rowH = await pg.$('#content .col-tasks .card[data-detail="' + firstId + '"]');
await rowH.hover(); await pg.waitForTimeout(250);
I.hoverBg = await pg.evaluate(id => getComputedStyle(document.querySelector('#content .col-tasks .card[data-detail="' + id + '"]')).backgroundColor, firstId);
g.H5b_hoverHeightStable = Math.abs((await pg.evaluate(id => document.querySelector('#content .col-tasks .card[data-detail="' + id + '"]').getBoundingClientRect().height, firstId)) - rows[0].h) < 0.5;
await shot(pg, 'I7202-URGENT-ROW-HOVER.png', /Olá, Carlos/, { el: '#content .col-tasks' });
await pg.mouse.move(4, 4); await pg.waitForTimeout(250);
await shot(pg, 'I7202-URGENT-ROW-NORMAL.png', /Olá, Carlos/, { el: '#content .col-tasks' });

// ---- K gates (J2, ADMIN) ----
const kpi = await pg.evaluate(() => { const b = [...document.querySelectorAll('#content .stats .stat')].find(x => /Tarefas/.test(x.textContent)); return { label: (b.querySelector('.l') || {}).textContent, v: (b.querySelector('.v') || {}).textContent, hasTab: b.hasAttribute('data-tab'), myboard: b.hasAttribute('data-myboard') }; });
I.kpiAdmin = kpi;
g.K1_label = kpi.label === 'Tarefas';
g.K2_noDataTab = kpi.hasTab === false;
g.K3_myboardAttr = kpi.myboard === true;
const kpiIdsAdmin = await pg.evaluate(() => state.tasks.filter(t => (t.assigneeId === state.user.id || t.by === state.user.id) && t.status !== 'concluido').map(t => t.id).sort());
await shot(pg, 'I7202-KPI-TAREFAS.png', /Olá, Carlos/, { el: '#content .stats' });
await clk(pg, '#content .stats .stat[data-myboard]');
const after = await probe(pg);
g.K4_naviga = /Meu quadro/.test(after.heading);
g.K6_heading = g.K4_naviga;
g.K5_sidebarSelected = await pg.evaluate(() => { const on = [...document.querySelectorAll('#bottomNav .sb-item.on')].map(b => (b.querySelector('span:last-of-type') || {}).textContent); return on.length === 1 && on[0] === 'Meu quadro'; });
g.K7_notHub = await pg.evaluate(() => document.querySelectorAll('#content .bcard').length === 0 && state.personBoard === state.user.id);
g.K8_notPrioridades = await pg.evaluate(() => state.tab !== 'prioridades');
const boardOpenIdsAdmin = await pg.evaluate(() => { const cols = [...document.querySelectorAll('#content .kbv2-column')]; const open = cols.slice(0, cols.length - 1); return open.flatMap(c => [...c.querySelectorAll('.kbv2-card')].map(x => { const b = x.querySelector('[data-detail],[data-cardmenu]'); return b ? (b.getAttribute('data-detail') || b.getAttribute('data-cardmenu')) : null; })).filter(Boolean).sort(); });
I.parityAdmin = { kpiCount: Number(kpi.v), kpiIds: kpiIdsAdmin, boardOpenIds: boardOpenIdsAdmin };
g.K9_idParity = JSON.stringify(kpiIdsAdmin) === JSON.stringify(boardOpenIdsAdmin);
g.K10_countParity = Number(kpi.v) === kpiIdsAdmin.length && Number(kpi.v) === boardOpenIdsAdmin.length;
g.K11_adminParity = g.K9_idParity && g.K10_countParity;
await shot(pg, 'I7202-KPI-TAREFAS-MYBOARD.png', /Meu quadro/);

// ---- G gates (KEEP, ADMIN) ----
await clk(pg, '#bottomNav .sb-item'); // primeiro item = Hoje
g.G_hojeBack = await pg.evaluate(() => state.tab === 'hoje');
await clk(pg, '#content .stats .stat[data-tab="agenda"]');
g.G1_kpiHojeAgenda = /Agenda|agosto|setembro|outubro/i.test((await probe(pg)).heading) && (await pg.evaluate(() => state.tab === 'agenda'));
g.G2_agendaToday = await pg.evaluate(() => (typeof agSel !== 'undefined') && agSel === todayStr());
await shot(pg, 'I7202-KPI-HOJE-AGENDA.png', /Agenda|agosto|setembro|outubro/i);
await clk(pg, '#bottomNav .sb-item');
await clk(pg, '#content .stats .stat[data-tab="equipe"]');
g.G3_kpiEquipe = /Equipe/.test((await probe(pg)).heading) && (await pg.evaluate(() => state.tab === 'equipe'));
await shot(pg, 'I7202-KPI-EQUIPE.png', /Equipe/);
await clk(pg, '#bottomNav .sb-item');
await clk(pg, '#content .col-events .evc[data-evdetail]');
g.G4_todayEventDetail = await pg.evaluate(() => !!document.querySelector('.modal-back[data-evdmodal]'));
await pg.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
await clk(pg, '#content .col-future .evc[data-evdetail]');
g.G5_futureEventDetail = await pg.evaluate(() => !!document.querySelector('.modal-back[data-evdmodal]'));
await pg.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
g.G6_sortAsc = rows.map(r => r.id).join(',') === 'u1,u2,u7,u3';       // prazos: 27/08 < hoje18:30 < amanhã09:00 < amanhã11:00
g.G7_slice4 = rows.length === 4;                                      // 6 abertas com prazo no seed → 4 renderizadas
g.G8_pills = await pg.evaluate(() => { const t = [...document.querySelectorAll('#content .col-tasks .pill')].map(x => x.textContent); return t.some(x => /Atrasada/.test(x)) && t.some(x => /Hoje/.test(x)) && t.some(x => /Faltam/.test(x)); });
g.G9_eventsSource = await pg.evaluate(() => document.querySelectorAll('#content .col-events .evc').length === 2 && document.querySelectorAll('#content .col-future .evc').length === 1);

// ---- FREEZE mini (Option B sidebar / CN / T / D / C / HF / SLA) ----
const inv = await pg.evaluate(() => { const nav = document.getElementById('bottomNav'); return { items: [...nav.querySelectorAll('.sb-item')].map(b => (b.querySelector('span:last-of-type') || {}).textContent || '').filter(Boolean), sects: [...nav.querySelectorAll('.sb-sect')].map(x => x.textContent.trim()) }; });
g.SBf_optionB = inv.items[0] === 'Hoje' && inv.items[1] === 'Meu quadro' && inv.items.includes('Quadros') && inv.items.includes('Painel SLA') && !inv.items.includes('Setores') && !inv.items.includes('Tarefas') && inv.sects.join('|') === 'Principal|Ferramentas|Conta';
await clk(pg, '#bottomNav .sb-item[data-flowclient]');
g.CNf_clientNoTchips = await pg.evaluate(() => { const t = document.querySelector('#content .d-board-tools .tchips'); return (!t || !t.offsetParent || t.children.length === 0) && !!document.getElementById('bSearch'); });
g.Cf_clientLanes = await pg.evaluate(() => document.querySelectorAll('.scr-client .kbv2-column').length === 4);
await clk(pg, '#bottomNav .sb-item[data-myboard]');
g.Tf_taskCard = await pg.evaluate(() => { const c = document.querySelector('.kbv2-card'); return !!c && getComputedStyle(c).display === 'grid' && !!c.querySelector('.kbv2-title'); });
await clk(pg, '.kbv2-card [data-detail]');
g.Df_detailMine = await pg.evaluate(() => { const m = document.querySelector('.modal-back[data-detmodal]'); return !!m && m.dataset.detorigin === 'mine'; });
await clk(pg, '.det-x');
await clk(pg, '#bottomNav .sb-item[data-board="hub"]');
g.HFf_hub = await pg.evaluate(() => [...document.querySelectorAll('#content .bcard .bl')].map(x => x.textContent.trim()).includes('Meu quadro'));
g.SLAf_heading = await pg.evaluate(() => { const b = [...document.querySelectorAll('#bottomNav .sb-item')].find(x => /Painel SLA/.test(x.textContent)); b.click(); return true; }) && /Painel Executivo/.test((await pg.evaluate(() => { return (document.querySelector('#content .scr-head, #content .h-title, #content .exec-ttl') || {}).textContent || ''; })));
await clk(pg, '#bottomNav .sb-item');

// ---- Responsivo (Hoje) ----
await shot(pg, 'I7202-HOJE-1920.png', /Olá, Carlos/);
g.R1_1920 = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2 && document.querySelectorAll('#content .d-home > div').length === 3);
await pg.setViewportSize({ width: 1536, height: 864 }); await pg.waitForTimeout(450);
await shot(pg, 'I7202-HOJE-WIN125.png', /Olá, Carlos/);
g.R2_win125 = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
await pg.setViewportSize({ width: 1366, height: 768 }); await pg.waitForTimeout(450);
await shot(pg, 'I7202-HOJE-1366.png', /Olá, Carlos/);
g.R3_1366 = await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
g.R4_noClip = await pg.evaluate(() => [...document.querySelectorAll('#content .col-tasks .card')].every(r => r.scrollWidth <= r.clientWidth + 2));
await pg.setViewportSize({ width: 1920, height: 1080 }); await pg.waitForTimeout(450);

// ---- OPERATIONAL role (K12 + G10) ----
{
  const { pg: pg2, perr: perr2 } = await boot('http://127.0.0.1:8895/');
  await pg2.evaluate(SEED({ ...SD, role: 'op' }));
  await pg2.waitForTimeout(600);
  const kv = await pg2.evaluate(() => { const b = [...document.querySelectorAll('#content .stats .stat')].find(x => /Tarefas/.test(x.textContent)); return Number((b.querySelector('.v') || {}).textContent); });
  const kIds = await pg2.evaluate(() => state.tasks.filter(t => (t.assigneeId === state.user.id || t.by === state.user.id) && t.status !== 'concluido').map(t => t.id).sort());
  g.G10_visibleScopeOp = await pg2.evaluate(() => { const ids = [...document.querySelectorAll('#content .col-tasks .card')].map(r => r.getAttribute('data-detail')); return ids.every(id => ['u5', 'u7'].includes(id)); });
  await pg2.evaluate(() => { const b = document.querySelector('#content .stats .stat[data-myboard]'); b.click(); });
  await pg2.waitForTimeout(450);
  const bIds = await pg2.evaluate(() => { const cols = [...document.querySelectorAll('#content .kbv2-column')]; return cols.slice(0, cols.length - 1).flatMap(c => [...c.querySelectorAll('.kbv2-card')].map(x => { const b = x.querySelector('[data-detail],[data-cardmenu]'); return b ? (b.getAttribute('data-detail') || b.getAttribute('data-cardmenu')) : null; })).filter(Boolean).sort(); });
  I.parityOp = { kpiCount: kv, kpiIds: kIds, boardOpenIds: bIds };
  g.K12_opParity = kv === kIds.length && JSON.stringify(kIds) === JSON.stringify(bIds);
  g.P_pageErrorsOp = perr2.length === 0;
}

// ---- BEFORE-AFTER composite (frames já validados pelo manifest) ----
{
  const b64 = f => fs.readFileSync(path.join(OUT, f)).toString('base64');
  const cp = await browser.newPage({ viewport: { width: 1920, height: 1180 } });
  await cp.setContent('<body style="margin:0;background:#0F172A;font-family:system-ui"><div style="display:flex;flex-direction:column;gap:8px;padding:10px">' +
    '<div style="color:#94A3B8;font:700 13px system-ui">BEFORE — baseline pública 1.0.252 (rows mortas; KPI Tarefas → Quadros)</div>' +
    '<img style="width:1900px" src="data:image/png;base64,' + b64('I7202-BEFORE-HOJE-1920.png') + '">' +
    '<div style="color:#94A3B8;font:700 13px system-ui">AFTER — candidato I7.20.2 (rows → Detail; KPI Tarefas → Meu quadro)</div>' +
    '<img style="width:1900px" src="data:image/png;base64,' + b64('I7202-HOJE-1920.png') + '"></div>');
  await cp.waitForTimeout(400);
  const el = await cp.$('div');
  await el.screenshot({ path: path.join(OUT, 'I7202-BEFORE-AFTER.png') });
  MANIFEST.push({ filename: 'I7202-BEFORE-AFTER.png', composedFrom: ['I7202-BEFORE-HOJE-1920.png', 'I7202-HOJE-1920.png'], loginPresent: false, screenshotValid: true });
  await cp.close();
  console.log('SHOT OK I7202-BEFORE-AFTER.png (composite de frames validados)');
}

// ---- fecho ----
g.E1_notLogin = MANIFEST.every(m => m.loginPresent === false);
g.E1_allValid = MANIFEST.length >= 13 && MANIFEST.every(m => m.screenshotValid === true) && shotFails === 0;
I.revealSuppressed = await pg.evaluate(() => window.__qaRevealSuppressed || []);
g.P_pageErrors = perr.length === 0;
const fails = Object.entries(g).filter(([, v]) => !v).map(([k]) => k);
const out = { g, info: I, fails, pageErrors: perr, manifest: MANIFEST };
fs.writeFileSync(path.join(OUT, 'i7202-qa.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(OUT, 'i7202-evidence-manifest.json'), JSON.stringify(MANIFEST, null, 1));
console.log(JSON.stringify({ gates: Object.keys(g).length, fails, parityAdmin: I.parityAdmin, parityOp: I.parityOp, hoverBg: I.hoverBg, revealSuppressed: I.revealSuppressed }, null, 1));
await browser.close(); sAfter.close(); sBefore.close();
process.exit(fails.length ? 1 : 0);
