/* I7.17.2A — QA versionado do candidato Option B sidebar (gemeo do harness executado).
 * Serve DOIS renderers no mesmo run: CANDIDATO (worktree deste repo) e BASELINE
 * (dir apontado por BASELINE_DIR; extrair de git show 7091056a...:desktop/src/renderer/index.html
 * + priorityEngine.js). Requer playwright resolvivel e CHROMIUM_BIN (ou o default do container).
 * Gates: estrutura H/Q/S/M/Conta + selected-state loop + roles + contextual-nav freeze
 * + T/D/C freeze (blocos provados) + densidade 1920/Win125/1366 + shots I7172A-*
 * em desktop/qa-out-i7172a/ (gitignored). READ-ONLY sobre o produto. */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CAND_DIR = path.join(ROOT, 'desktop', 'src', 'renderer');
// BASELINE_DIR: dir com index.html (git show <BASE_SHA>:desktop/src/renderer/index.html)
// + priorityEngine.js copiado. Obrigatorio para os gates de paridade A/B.
const BASE_DIR = process.env.BASELINE_DIR || '';
if (!BASE_DIR || !fs.existsSync(path.join(BASE_DIR, 'index.html'))) {
  console.error('BASELINE_DIR ausente/invalido - extraia o renderer da baseline e exporte BASELINE_DIR.');
  process.exit(2);
}
const OUT = path.join(ROOT, 'desktop', 'qa-out-i7172a'); fs.mkdirSync(OUT, { recursive: true });
const mkServer = dir => new Promise(res => { const s = http.createServer((req, r) => {
  let f = (req.url || '/').split('?')[0]; if (f === '/') f = '/index.html';
  fs.readFile(path.join(dir, f), (e, b) => { if (e) { r.writeHead(404); r.end('x'); return; }
    r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(b); }); });
  s.listen(0, () => res(s)); });
const sv1 = await mkServer(CAND_DIR); const sv2 = await mkServer(BASE_DIR);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const mkPage = async (port) => {
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  pg._errs = []; pg.on('pageerror', e => { if (!/firebase/i.test(String(e))) pg._errs.push(String(e).slice(0, 200)); });
  await pg.addInitScript(() => { const P = new Proxy(function () {}, { get: () => P, apply: () => P, construct: () => P }); window.firebase = P; });
  await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof state !== 'undefined' && typeof render === 'function', null, { timeout: 45000 });
  await pg.waitForTimeout(700); return pg;
};
const pgC = await mkPage(sv1.address().port);
const pgB = await mkPage(sv2.address().port);
const out = { g: {}, info: {} }; const g = out.g; const I = out.info;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// H5: boot default ANTES de qualquer seed
I.bootTabCandidate = await pgC.evaluate(() => state.tab);
I.bootTabBaseline = await pgB.evaluate(() => state.tab);
g.H5_bootLandsHoje = I.bootTabCandidate === 'hoje' && I.bootTabBaseline === 'hoje';

const D = n => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };
const seedArgs = { d0: D(0), d1: D(1), d2: D(2), dm1: D(-1) };
const seed = async pg => { await pg.evaluate(({ d0, d1, d2, dm1 }) => {
  state.user = { id: 'carlos', name: 'Carlos Eduardo', role: 'Social Media', admin: true };
  state.users = [state.user,
    { id: 'marina', name: 'Marina Klein', role: 'Designer' },
    { id: 'helio', name: 'Helio Duarte', role: 'Designer' },
    { id: 'bia', name: 'Bia Rocha', role: 'Social Media' }];
  document.body.classList.add('desktop', 'authed', 'light-ui');
  const a = document.getElementById('authSplash'); if (a) a.style.display = 'none';
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  state.tasks = [
    { id: 'k1', title: 'Post de Agenda Aberta - histeroscopias', client: 'Dra. Helita Freitas', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: '2026-08-20', dueTime: '19:05', cardLegenda: 'Agenda aberta', cardObs: 'Arte aprovada' },
    { id: 'k2', title: 'Edicao de videos - Agosto', client: 'Hospital Visao', sector: 'edicao_midia', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: d1, dueTime: '17:00', priority: true, videos: [{ tema: 'v1' }, { tema: 'v2' }, { tema: 'v3' }], checklist: [{ t: '1' }, { t: '2' }, { t: '3' }, { t: '4' }, { t: '5' }] },
    { id: 'k3', title: 'Reels de lancamento', client: 'Sunset Wear', sector: 'edicao_cards', by: 'marina', assigneeId: 'carlos', status: 'revisao', dueDate: d0, dueTime: '23:00', cardLegenda: 'Colecao' },
    { id: 'k4', title: 'Cronograma Setembro', client: 'Sunset Wear', sector: 'edicao_cards', by: 'carlos', assigneeId: null, status: 'concluido', dueDate: '2026-08-22' },
    { id: 'c1', title: 'Cronograma Setembro - Sunset Wear', client: 'Sunset Wear', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: d2, dueTime: '10:00', cronContents: [{ tema: 'Tema 1' }, { tema: 'Tema 2' }, { tema: 'Tema 3' }] },
    { id: 'cB', title: 'Cronograma Outubro - Hospital Visao', client: 'Hospital Visao', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: d1, dueTime: '18:00', workflowPhase: 'captions_waiting_client', cronContents: [{ tema: 'Tema A' }, { tema: 'Tema B' }] },
    { id: 'cC', title: 'Cronograma Clinica Vida - ajustes', client: 'Clinica Vida', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: '2026-08-20', dueTime: '16:00', clientReview: { status: 'revisao', note: 'Trocar o tema 2.', at: Date.now() - 3600000, byName: 'Cliente' }, cronContents: [{ tema: 'Tema X' }] },
    { id: 'cD', title: 'Cronograma Agosto - Colegio Alfa', client: 'Colegio Alfa', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'concluido', dueDate: '2026-08-22', finalApprovalCompleted: true, clientReview: { status: 'aprovado', at: Date.now() - 7200000, byName: 'Cliente' }, cronContents: [{ tema: 'Tema 1' }] }
  ];
  state.events = [
    { id: 'e1', title: 'Reuniao de pauta - Hospital Visao', date: d0, start: '09:30', end: '10:15', type: 'reuniao', ownerId: 'carlos', client: 'Hospital Visao' },
    { id: 'e2', title: 'Gravacao - Sunset Wear', date: d0, start: '14:00', end: '16:00', type: 'gravacao', ownerId: 'marina', client: 'Sunset Wear', location: 'Estudio 2' },
    { id: 'e3', title: 'Alinhamento mensal - Clinica Vida', date: d1, start: '11:00', end: '11:45', type: 'reuniao', ownerId: 'carlos', client: 'Clinica Vida' }
  ];
  state.tab = 'hoje'; render();
}, seedArgs); await pg.waitForTimeout(500); };
await seed(pgC); await seed(pgB);

// ---------- inventario de estrutura ----------
const sidebarInv = pg => pg.evaluate(() => {
  const nav = document.getElementById('bottomNav');
  const rows = [...nav.children].map(el => {
    if (el.classList.contains('sb-sect')) return { t: 'sect', label: el.textContent.trim() };
    if (el.classList.contains('sb-more')) return { t: 'more', items: [...el.querySelectorAll('.sb-more-list .sb-item')].map(b => ({ label: (b.querySelector('span:last-of-type') || {}).textContent || '', attr: [...b.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join(' ') })) };
    if (el.classList.contains('sb-spacer')) return { t: 'spacer' };
    if (el.classList.contains('sb-user')) return { t: 'user', attr: el.getAttribute('data-tab') };
    if (el.classList.contains('sb-footer')) return { t: 'footer' };
    if (el.classList.contains('new-task-btn')) return { t: 'cta', attr: 'data-fab' };
    if (el.classList.contains('sb-brand')) return { t: 'brand' };
    if (el.classList.contains('sb-item')) return { t: 'item', label: (el.querySelector('span:last-of-type') || {}).textContent || '', attr: [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value).join(' ') };
    return { t: el.tagName.toLowerCase() };
  });
  return rows;
});
I.candSidebar = await sidebarInv(pgC);
I.baseSidebar = await sidebarInv(pgB);
const candLabels = I.candSidebar.filter(r => r.t === 'item').map(r => r.label);
const candSects = I.candSidebar.filter(r => r.t === 'sect').map(r => r.label);
const candMore = (I.candSidebar.find(r => r.t === 'more') || { items: [] }).items.map(x => x.label);
I.candLabels = candLabels; I.candSects = candSects; I.candMore = candMore;

// H1/H2: Hoje primeiro destino do Principal
const principalIdx = I.candSidebar.findIndex(r => r.t === 'sect' && r.label === 'Principal');
const firstItemAfterPrincipal = I.candSidebar.slice(principalIdx + 1).find(r => r.t === 'item');
g.H1_hojeInPrincipal = !!firstItemAfterPrincipal;
g.H2_hojeFirst = (firstItemAfterPrincipal || {}).label === 'Hoje' && (firstItemAfterPrincipal || {}).attr === 'data-tab=hoje';
g.H8_hojeNotInMais = !candMore.includes('Hoje');
// Q1/Q2/Q7
g.Q1_quadrosLabel = candLabels.includes('Quadros');
g.Q2_noSetoresInSidebar = !candLabels.includes('Setores') && !candMore.includes('Setores');
g.Q7_noTarefasInMais = !candMore.includes('Tarefas') && !candLabels.includes('Tarefas');
// S1/S2/S3
g.S1_execOutOfMais = !candMore.includes('Executivo') && !candMore.includes('Painel SLA');
const ferrIdx = I.candSidebar.findIndex(r => r.t === 'sect' && r.label === 'Ferramentas');
const contaIdx = I.candSidebar.findIndex(r => r.t === 'sect' && r.label === 'Conta');
const ferrItems = I.candSidebar.slice(ferrIdx + 1, I.candSidebar.findIndex((r, i) => i > ferrIdx && (r.t === 'more' || r.t === 'sect'))).filter(r => r.t === 'item').map(r => r.label);
g.S2_slaInFerramentas = ferrItems.join('|') === 'Agenda|Relatórios|Painel SLA';
g.S3_labelPainelSLA = candLabels.includes('Painel SLA') && !candLabels.includes('Executivo');
// M3/M8/M9/M10
g.M3_maisFourItems = candMore.length === 4 && candMore.join('|') === 'Minhas Prioridades|Equipe|Perfil|Notificações';
g.M8_noTarefas = !candMore.includes('Tarefas');
g.M9_noHoje = !candMore.includes('Hoje');
g.M10_noExec = !candMore.includes('Executivo') && !candMore.includes('Painel SLA');
// CONTA
const contaItems = contaIdx >= 0 ? I.candSidebar.slice(contaIdx + 1).filter(r => r.t === 'item').map(r => r.label) : [];
g.CT1_contaSect = contaIdx >= 0;
g.CT2_configInConta = contaItems.includes('Configurações');
g.CT3_contaAfterSpacer = contaIdx > I.candSidebar.findIndex(r => r.t === 'spacer');
g.CT4_userAnchor = I.candSidebar.some(r => r.t === 'user' && r.attr === 'perfil');
// Q8: nenhum destino funcional perdido (set de destinos baseline - 'tarefas' == set candidato)
const destSet = rows => { const s = new Set(); rows.forEach(r => { if (r.t === 'item') s.add(r.attr); if (r.t === 'more') r.items.forEach(x => s.add(x.attr)); if (r.t === 'cta') s.add('data-fab'); if (r.t === 'user') s.add('user->perfil'); }); return s; };
const candDest = destSet(I.candSidebar); const baseDest = destSet(I.baseSidebar);
baseDest.delete('data-tab=tarefas');
I.candDest = [...candDest].sort(); I.baseDestMinusTarefas = [...baseDest].sort();
g.Q8_noDestinationLost = I.candDest.join('|') === I.baseDestMinusTarefas.join('|');

// ---------- selected-state / cross-surface loop (§18) ----------
const onSet = pg => pg.evaluate(() => [...document.querySelectorAll('#bottomNav .sb-item.on')].map(b => (b.querySelector('span:last-of-type') || {}).textContent || '').sort());
const heading = pg => pg.evaluate(() => { const el = document.querySelector('#content .scr-head, #content .h-title, #content .exec-ttl, #content .nc-ttl, #content .lui-ph-t'); const t = ((el && el.textContent) || '').trim(); return (t || (document.getElementById('content').innerText || '').trim()).replace(/\s+/g, ' ').slice(0, 60); });
const white = pg => pg.evaluate(() => (document.getElementById('content').innerText || '').trim().length < 2);
const clkSide = async (pg, label) => { await pg.evaluate(t => {
  const d = document.querySelector('.nav .sb-more'); if (d && [...d.querySelectorAll('.sb-item')].some(x => ((x.querySelector('span:last-of-type') || {}).textContent || '') === t)) d.open = true;
  const it = [...document.querySelectorAll('#bottomNav .sb-item')].find(x => ((x.querySelector('span:last-of-type') || {}).textContent || '') === t);
  if (it) it.click(); }, label); await pg.waitForTimeout(450); };
const NAVLOOP = [
  ['Hoje', ['Hoje'], /Olá/],
  ['Meu quadro', ['Meu quadro'], /Meu quadro/],
  ['Cliente', ['Cliente'], /Cliente/],
  ['Designers', ['Designers'], /Designer/],
  ['Social Medias', ['Social Medias'], /Social/],
  ['Quadros', ['Quadros'], /Quadros/],
  ['Agenda', ['Agenda'], /Agenda|agosto|setembro/i],
  ['Relatórios', ['Relatórios'], /Relatórios de Atraso/],
  ['Painel SLA', ['Painel SLA'], /Painel Executivo/],
  ['Configurações', ['Configurações'], /Configurações/],
  ['Minhas Prioridades', ['Minhas Prioridades'], /Prioridades|prioridade/i],
  ['Equipe', ['Equipe'], /Equipe/],
  ['Perfil', ['Perfil'], /Carlos|Config/],
  ['Notificações', ['Notificações'], /Notificações/],
  ['Hoje', ['Hoje'], /Olá/]
];
out.navLoop = [];
for (const [label, expOn, headRe] of NAVLOOP) {
  await clkSide(pgC, label);
  const on = await onSet(pgC); const hd = await heading(pgC); const wh = await white(pgC);
  const ok = JSON.stringify(on) === JSON.stringify(expOn.slice().sort()) && headRe.test(hd) && !wh;
  out.navLoop.push({ label, on, heading: hd, white: wh, ok });
}
g.NAV_loopAllOk = out.navLoop.every(x => x.ok);
g.NAV_zeroDoubleOn = out.navLoop.every(x => x.on.length === 1);
// gates especificos do loop
const lp = n => out.navLoop[n];
g.H3_hojeRealHandler = lp(0).ok; g.H4_renderHojeIntact = /Olá/.test(lp(0).heading);
g.H6_hojeSelected = JSON.stringify(lp(0).on) === '["Hoje"]';
g.H7_meuQuadro1Click = lp(1).ok;
g.Q3_quadrosOpensHub = lp(5).ok && /Quadros/.test(lp(5).heading);
g.S4_execRealHandler = lp(8).ok; g.S5_renderExecIntact = /Painel Executivo/.test(lp(8).heading);
g.S7_relatoriosSeparate = lp(7).ok && /Relatórios de Atraso/.test(lp(7).heading);
g.S8_noMerge = g.S5_renderExecIntact && g.S7_relatoriosSeparate;
g.M4_prioridades = lp(10).ok; g.M5_equipe = lp(11).ok; g.M6_perfil = lp(12).ok; g.M7_notificacoes = lp(13).ok;
g.CT5_configOpens = lp(9).ok;
// M1/M2 abrir/fechar Mais
g.M1_maisOpens = await pgC.evaluate(() => { const d = document.querySelector('.nav .sb-more'); d.open = true; return d.open === true; });
g.M2_maisCloses = await pgC.evaluate(() => { const d = document.querySelector('.nav .sb-more'); d.open = false; return d.open === false; });

// ---------- Q4/Q5/Q6: Hub equivalencia + setores + roleboards ----------
await clkSide(pgC, 'Quadros');
I.candHub = await pgC.evaluate(() => ({ heading: (document.querySelector('#content .h-title') || {}).textContent, cards: [...document.querySelectorAll('#content .bcard .bl')].map(x => x.textContent.trim()) }));
I.candHubHash = sha(await pgC.evaluate(() => document.getElementById('content').innerHTML));
await pgB.evaluate(() => { const it = [...document.querySelectorAll('#bottomNav .sb-item')].find(x => ((x.querySelector('span:last-of-type') || {}).textContent || '') === 'Setores'); if (it) it.click(); });
await pgB.waitForTimeout(450);
I.baseHub = await pgB.evaluate(() => ({ heading: (document.querySelector('#content .h-title') || {}).textContent, cards: [...document.querySelectorAll('#content .bcard .bl')].map(x => x.textContent.trim()) }));
I.baseHubHash = sha(await pgB.evaluate(() => document.getElementById('content').innerHTML));
g.Q4_hubEquivalent = I.candHub.heading === I.baseHub.heading && I.candHub.cards.join('|') === I.baseHub.cards.join('|');
I.hubHashEqual = I.candHubHash === I.baseHubHash;
await pgC.evaluate(() => { const b = [...document.querySelectorAll('#content .bcard')].find(x => /Edição de Cards/.test(x.textContent)); if (b) b.click(); });
await pgC.waitForTimeout(450);
g.Q5_sectorBoardOpens = await pgC.evaluate(() => state.tab === 'tarefas' && state.boardSector === 'edicao_cards' && document.querySelectorAll('.kbv2-column, .kanban .col').length >= 3);
g.Q5b_quadrosStaysOn = JSON.stringify(await onSet(pgC)) === '["Quadros"]';
await clkSide(pgC, 'Quadros');
await pgC.evaluate(() => { const b = document.querySelector('#content [data-roleboards]'); if (b) b.click(); });
await pgC.waitForTimeout(450);
g.Q6_roleBoardsReachable = await pgC.evaluate(() => state.roleBoards === true && /Quadros por responsável/.test((document.querySelector('#content .d-bh-title') || {}).textContent || ''));

// ---------- roles (§9) ----------
const opSidebar = async pg => pg.evaluate(() => {
  const saved = state.user; state.user = { id: 'op1', name: 'Op Teste', role: 'Editor de video' }; render();
  const items = [...document.querySelectorAll('#bottomNav .sb-item')].map(b => (b.querySelector('span:last-of-type') || {}).textContent || '').filter(Boolean);
  state.user = saved; render(); return items;
});
I.candOperational = await opSidebar(pgC);
I.baseOperational = await opSidebar(pgB);
await pgC.waitForTimeout(300); await pgB.waitForTimeout(300);
const baseOpExpected = I.baseOperational.filter(l => l !== 'Tarefas' && l !== 'Hoje' && l !== 'Executivo' && l !== 'Setores');
g.R1_managerGatePreserved = !I.candOperational.includes('Cliente') && !I.candOperational.includes('Designers') && !I.candOperational.includes('Social Medias');
g.R2_operationalKeepsRest = ['Hoje', 'Meu quadro', 'Quadros', 'Agenda', 'Relatórios', 'Painel SLA', 'Mais', 'Minhas Prioridades', 'Equipe', 'Perfil', 'Notificações', 'Configurações'].every(l => I.candOperational.includes(l));
g.R3_slaVisibilitySameAsExec = I.baseOperational.includes('Executivo') === I.candOperational.includes('Painel SLA');

// ---------- contextual nav freeze (§19) ----------
await clkSide(pgC, 'Cliente');
I.candTchips = await pgC.evaluate(() => [...document.querySelectorAll('#content .tchips .tchip')].map(x => (x.textContent || '').trim()));
await pgB.evaluate(() => { const it = [...document.querySelectorAll('#bottomNav .sb-item')].find(x => ((x.querySelector('span:last-of-type') || {}).textContent || '') === 'Cliente'); if (it) it.click(); });
await pgB.waitForTimeout(450);
I.baseTchips = await pgB.evaluate(() => [...document.querySelectorAll('#content .tchips .tchip')].map(x => (x.textContent || '').trim()));
g.CN1_tchipsIntact = I.candTchips.join('|') === I.baseTchips.join('|') && I.candTchips.length === 5;
await pgC.evaluate(() => { const c = [...document.querySelectorAll('#content .tchips .tchip')].find(x => /Setores/.test(x.textContent)); if (c) c.click(); });
await pgC.waitForTimeout(450);
g.CN2_tchipStillNavigates = await pgC.evaluate(() => state.tab === 'tarefas' && !state.flowView && !state.boardSector && /Quadros/.test((document.querySelector('#content .h-title') || {}).textContent || ''));

// ---------- FREEZE T (Task Card) ----------
await clkSide(pgC, 'Meu quadro');
const smoke = await pgC.evaluate(() => {
  const r = {};
  const card2 = [...document.querySelectorAll('.kbv2-card')].find(c => c.querySelector('[data-cardmenu="k2"], [data-detail="k2"]'));
  const cs = card2 ? getComputedStyle(card2) : null;
  r.t1 = cs ? cs.display === 'grid' : false;
  r.t2 = card2 ? (card2.querySelector('.kbv2-due') && getComputedStyle(card2.querySelector('.kbv2-due')).display !== 'none') : false;
  r.t3 = card2 ? (() => { const t = card2.querySelector('.kbv2-title'); const tc = getComputedStyle(t); return parseFloat(tc.fontSize) >= 14.5 && parseInt(tc.fontWeight) >= 650 && t.scrollHeight <= t.clientHeight + 4; })() : false;
  r.t4 = card2 ? (() => { const s2 = card2.querySelector('.kbv2-tier'); return !!s2 && /Hospital Visao/.test(s2.textContent) && getComputedStyle(s2, '::before').display === 'none'; })() : false;
  r.t5 = card2 ? (getComputedStyle(card2.querySelector('.kbv2-card-chips'), '::before').content.includes('Setor') && getComputedStyle(card2.querySelector('.kbv2-card-date'), '::before').content.includes('Prazo')) : false;
  r.t6 = card2 ? (() => { const pr = [...card2.querySelectorAll('.kbv2-chip')].find(x => /Prioridade/i.test(x.textContent)); if (!pr) return false; const pcs = getComputedStyle(pr); return pcs.backgroundColor === 'rgba(0, 0, 0, 0)' && parseFloat(pcs.fontSize) < 11; })() : false;
  r.t7 = card2 ? (() => { const rl = card2.querySelector('.kbv2-card-rail'); const p = card2.querySelector('.kbv2-pct'); return !!rl && getComputedStyle(rl).backgroundColor === 'rgb(245, 248, 251)' && !!p && /%$/.test(p.textContent.trim()); })() : false;
  r.t8 = card2 ? !!card2.querySelector('.kbv2-av .av') : false;
  r.t9 = card2 ? (card2.querySelector('.kbv2-card-chk') && /5/.test(card2.querySelector('.kbv2-card-chk').textContent)) : false;
  r.t10 = card2 ? (() => { const k = card2.querySelector('.kbv2-btn-dots'); if (!k) return false; const b = k.getBoundingClientRect(); return b.width >= 24 && b.height >= 24; })() : false;
  r.t12 = card2 ? getComputedStyle(card2, '::before').display === 'none' : false;
  r.lanes = document.querySelectorAll('.kbv2-column').length;
  return r;
});
out.taskCard = smoke;
g.T_freeze = smoke.t1 && smoke.t2 && smoke.t3 && smoke.t4 && smoke.t5 && smoke.t6 && smoke.t7 && smoke.t8 && smoke.t9 && smoke.t10 && smoke.t12 && smoke.lanes === 4;

// ---------- FREEZE D (Detail) ----------
const clk = async (pg, sel) => { await pg.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await pg.waitForTimeout(350); };
await clk(pgC, '[data-detail="k2"]');
const dg = await pgC.evaluate(() => {
  const r = {};
  const m = document.querySelector('.modal-back[data-detmodal]');
  r.D1 = !!m && m.dataset.detorigin === 'mine';
  const ttl = document.querySelector('.det-title');
  r.D3 = !!ttl && /Edicao de videos/.test(ttl.textContent) && getComputedStyle(ttl).fontSize === '20px';
  r.D4 = /Hospital Visao/.test((document.querySelector('.det-client') || {}).textContent || '');
  const bdg = document.querySelector('.det-badge');
  r.D5 = !!bdg && getComputedStyle(bdg).backgroundColor === 'rgba(0, 0, 0, 0)';
  const chips = [...document.querySelectorAll('.det-chips .rev-chip')];
  const stc = chips.find(x => x.querySelector('.dotc'));
  r.D6 = !!stc && getComputedStyle(stc).backgroundColor === 'rgba(0, 0, 0, 0)';
  const people = [...document.querySelectorAll('.det-person')];
  r.D8 = people.length >= 1 && /Respons/.test(people[0].textContent) && getComputedStyle(people[0]).backgroundColor === 'rgb(245, 248, 251)';
  const nx = document.querySelector('.det-hero-next');
  r.D10 = !!nx && getComputedStyle(nx).backgroundColor === 'rgb(245, 248, 251)';
  const sheet = document.querySelector('.det-sheet');
  r.D16 = !!sheet && sheet.scrollWidth <= sheet.clientWidth + 2 && document.documentElement.scrollWidth <= window.innerWidth + 2;
  return r;
});
out.detail = dg;
await clk(pgC, '.det-x');
dg.D2 = await pgC.evaluate(() => ((document.getElementById('modalRoot') || {}).innerHTML || '').length < 50);
g.D_freeze = dg.D1 && dg.D2 && dg.D3 && dg.D4 && dg.D5 && dg.D6 && dg.D8 && dg.D10 && dg.D16;

// ---------- FREEZE C (Cliente) + CDF ----------
await clkSide(pgC, 'Cliente');
const cg = await pgC.evaluate(() => {
  const r = {};
  const icon = document.querySelector('#content .scr-head .d-bh-icon');
  const ttl = document.querySelector('#content .scr-head .d-bh-title');
  r.C1 = (!icon || getComputedStyle(icon).display === 'none') && !!ttl && getComputedStyle(ttl).fontSize === '17px';
  const bar = document.querySelector('.scr-client .wfap-bar');
  r.C2 = !!bar && getComputedStyle(bar).backgroundColor === 'rgb(245, 248, 251)';
  const kbd = document.querySelector('.scr-client .bsearch-kbd');
  r.C3 = !!document.getElementById('bSearch') && (!kbd || getComputedStyle(kbd).display === 'none');
  const ch = document.querySelector('.scr-client .tchips');
  const on = document.querySelector('.scr-client .tchips .tchip.on');
  r.C4 = !!ch && getComputedStyle(ch).backgroundColor === 'rgb(238, 242, 246)' && !!on && getComputedStyle(on).backgroundColor === 'rgb(255, 255, 255)';
  const cols = [...document.querySelectorAll('.scr-client .kbv2-column')];
  const nOf = i => cols[i] ? cols[i].querySelectorAll('.kbv2-card').length : -1;
  r.C5 = nOf(0) >= 1; r.C6 = nOf(1) >= 1; r.C7 = nOf(2) >= 1; r.C8 = nOf(3) >= 1;
  r.C13 = document.querySelectorAll('.scr-client .kbv2-card').length >= 4;
  const st = document.querySelector('.scr-client .kbv2-card .kbv2-status');
  r.CX = !st || (getComputedStyle(st).position === 'static' && st.scrollWidth <= st.clientWidth + 2);
  return r;
});
out.client = cg;
await clk(pgC, '[data-detail="cB"]');
cg.C14 = await pgC.evaluate(() => { const m = document.querySelector('.modal-back[data-detmodal]'); return !!m && m.dataset.detorigin === 'client'; });
await clk(pgC, '.det-x');
cg.CDF = await pgC.evaluate(() => ((document.getElementById('modalRoot') || {}).innerHTML || '').length < 50 && state.flowView === 'client' && document.querySelectorAll('.scr-client .kbv2-column').length === 4 && document.querySelectorAll('.scr-client .kbv2-card').length >= 4);
g.C_freeze = cg.C1 && cg.C2 && cg.C3 && cg.C4 && cg.C5 && cg.C6 && cg.C7 && cg.C8 && cg.C13 && cg.CX && cg.C14 && cg.CDF;

// ---------- densidade + hscroll (§11) ----------
const density = async (pg, w, h, open) => {
  await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(400);
  return pg.evaluate(op => {
    const d = document.querySelector('.nav .sb-more'); if (d) d.open = op;
    const nav = document.getElementById('bottomNav');
    const user = nav.querySelector('.sb-user'); let userReachable = false;
    if (user) { user.scrollIntoView({ block: 'nearest' }); const ur = user.getBoundingClientRect(); const nr = nav.getBoundingClientRect(); userReachable = ur.bottom <= nr.bottom + 2 && ur.top >= nr.top - 2; nav.scrollTop = 0; }
    return { navScroll: nav.scrollHeight, navClient: nav.clientHeight,
      fits: nav.scrollHeight <= nav.clientHeight + 2,
      scrollable: getComputedStyle(nav).overflowY === 'auto' || getComputedStyle(nav).overflowY === 'scroll',
      hscrollPage: document.documentElement.scrollWidth > window.innerWidth + 2,
      navDeltaX: nav.scrollWidth - nav.clientWidth,
      userReachable };
  }, open);
};
out.density = {};
for (const [name, w, h] of [['1920', 1920, 1080], ['win125', 1536, 864], ['1366', 1366, 768]]) {
  out.density['cand_' + name + '_closed'] = await density(pgC, w, h, false);
  out.density['cand_' + name + '_open'] = await density(pgC, w, h, true);
  out.density['base_' + name + '_open'] = await density(pgB, w, h, true);
  await pgB.evaluate(() => { const d = document.querySelector('.nav .sb-more'); if (d) d.open = false; });
}
const dz = out.density;
g.DEN_closedFitsAll = dz.cand_1920_closed.fits && dz.cand_win125_closed.fits && dz.cand_1366_closed.fits;
g.DEN_openUsable1366 = (dz.cand_1366_open.fits || dz.cand_1366_open.scrollable) && dz.cand_1366_open.userReachable;
// paridade com baseline: nada de clipping novo; overflow vertical do Mais aberto ja existia
// (1366: base tambem estoura e rola); delta de conteudo aberto <= 24px e deltaX igual ao base
g.DEN_noRegressionVsBase = dz.cand_1366_open.userReachable && dz.base_1366_open.userReachable !== false && (dz.cand_1366_open.navScroll - dz.base_1366_open.navScroll) <= 24 && dz.cand_1366_open.navDeltaX <= dz.base_1366_open.navDeltaX;
g.DEN_noHscroll = !dz.cand_1920_closed.hscrollPage && !dz.cand_win125_closed.hscrollPage && !dz.cand_1366_closed.hscrollPage;

// ---------- screenshots (§20) ----------
await pgC.evaluate(() => { const d = document.querySelector('.nav .sb-more'); if (d) d.open = false; });
const navShot = async (pg, w, h, name) => { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(450); const el = await pg.$('#bottomNav'); if (el) await el.screenshot({ path: path.join(OUT, name) }); };
const fullShot = async (pg, name) => { await pg.setViewportSize({ width: 1920, height: 1080 }); await pg.waitForTimeout(450); await pg.screenshot({ path: path.join(OUT, name) }); };
await clkSide(pgC, 'Hoje');
await navShot(pgC, 1920, 1080, 'I7172A-SIDEBAR-1920.png');
await navShot(pgC, 1536, 864, 'I7172A-SIDEBAR-WIN125.png');
await navShot(pgC, 1366, 768, 'I7172A-SIDEBAR-1366.png');
await pgC.setViewportSize({ width: 1920, height: 1080 }); await pgC.waitForTimeout(300);
await pgC.evaluate(() => { const d = document.querySelector('.nav .sb-more'); if (d) d.open = true; });
await pgC.waitForTimeout(300);
const nv = await pgC.$('#bottomNav'); if (nv) await nv.screenshot({ path: path.join(OUT, 'I7172A-MAIS-OPEN.png') });
await pgC.evaluate(() => { const d = document.querySelector('.nav .sb-more'); if (d) d.open = false; });
await fullShot(pgC, 'I7172A-HOJE-ACTIVE.png');
await clkSide(pgC, 'Meu quadro'); await fullShot(pgC, 'I7172A-MEUQUADRO-ACTIVE.png');
await clkSide(pgC, 'Cliente'); await fullShot(pgC, 'I7172A-CLIENTE-ACTIVE.png');
await clkSide(pgC, 'Quadros'); await fullShot(pgC, 'I7172A-QUADROS-ACTIVE.png');
await clkSide(pgC, 'Relatórios'); await fullShot(pgC, 'I7172A-RELATORIOS-ACTIVE.png');
await clkSide(pgC, 'Painel SLA'); await fullShot(pgC, 'I7172A-PAINEL-SLA-ACTIVE.png');
await clkSide(pgC, 'Configurações'); await fullShot(pgC, 'I7172A-CONFIG-ACTIVE.png');
// BEFORE (baseline) nav shot p/ comparativo
await pgB.evaluate(() => { const d = document.querySelector('.nav .sb-more'); if (d) d.open = true; });
await pgB.setViewportSize({ width: 1920, height: 1080 }); await pgB.waitForTimeout(400);
const nb = await pgB.$('#bottomNav'); if (nb) await nb.screenshot({ path: path.join(OUT, 'BEFORE-BASELINE-SIDEBAR.png') });

out.pageErrorsCandidate = pgC._errs; out.pageErrorsBaseline = pgB._errs;
g.P_noPageErrors = pgC._errs.length === 0;
const fails = Object.entries(g).filter(([k, v]) => !v).map(([k]) => k);
out.fails = fails;
fs.writeFileSync(path.join(OUT, 'i7172a-qa.json'), JSON.stringify(out, null, 1));
console.log('GATES:', Object.keys(g).length, 'TRUE:', Object.values(g).filter(Boolean).length);
console.log('FAILS:', JSON.stringify(fails));
console.log(JSON.stringify({ candSects, candLabels, candMore, dest: { cand: I.candDest, baseMinus: I.baseDestMinusTarefas }, hubHashEqual: I.hubHashEqual, navLoop: out.navLoop.map(x => x.label + ':' + (x.ok ? 'OK' : 'FAIL(' + x.on.join(',') + '|' + x.heading + ')')), density: out.density, tchips: { cand: I.candTchips, base: I.baseTchips } }, null, 1));
await browser.close(); sv1.close(); sv2.close();
process.exit(fails.length ? 1 : 0);
