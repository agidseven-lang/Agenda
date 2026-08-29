/* I7.17.2B — QA do candidato Contextual Nav Cleanup (gemeo versionado E1: reveal suprimido em QA + hard gate anti-login por captura + manifesto; requer BASE2A_DIR).
 * Serve CANDIDATO (worktree 2B) e BASE2A (renderer @33d01275 aprovado) no mesmo run.
 * Gates: tchips globais removidos nas 4 superficies desktop lui + preservacao de busca/
 * filtros/acoes + Meu quadro lui byte-identico + mobile/legado preservados + sidebar 2A
 * regression + freeze T/D/C (C4 substituido pelo objetivo aprovado do 2B) + responsivo
 * + shots I7172B-*. Screenshots fora do versionamento. */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CAND_DIR = path.join(ROOT, 'desktop', 'src', 'renderer');
// BASE2A_DIR: dir com index.html do 2A aprovado (git show 33d01275...:desktop/src/renderer/index.html)
// + priorityEngine.js copiado. Obrigatorio para os gates de paridade A/B.
const BASE_DIR = process.env.BASE2A_DIR || '';
if (!BASE_DIR || !fs.existsSync(path.join(BASE_DIR, 'index.html'))) {
  console.error('BASE2A_DIR ausente/invalido - extraia o renderer do 2A aprovado e exporte BASE2A_DIR.');
  process.exit(2);
}
const OUT = path.join(ROOT, 'desktop', 'qa-out-i7172b'); fs.mkdirSync(OUT, { recursive: true });
const mkServer = dir => new Promise(res => { const s = http.createServer((req, r) => {
  let f = (req.url || '/').split('?')[0]; if (f === '/') f = '/index.html';
  fs.readFile(path.join(dir, f), (e, b) => { if (e) { r.writeHead(404); r.end('x'); return; }
    r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(b); }); });
  s.listen(0, () => res(s)); });
const sv1 = await mkServer(CAND_DIR); const sv2 = await mkServer(BASE_DIR);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const mkPage = async (port, vw, vh) => {
  const pg = await browser.newPage({ viewport: { width: vw || 1920, height: vh || 1080 } });
  pg._errs = []; pg.on('pageerror', e => { if (!/firebase/i.test(String(e))) pg._errs.push(String(e).slice(0, 200)); });
  await pg.addInitScript(() => { const P = new Proxy(function () {}, { get: () => P, apply: () => P, construct: () => P }); window.firebase = P; });
  await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof state !== 'undefined' && typeof render === 'function', null, { timeout: 45000 });
  /* E1 ROOT-CAUSE FIX (harness-only): sem window.desktopAPI a maquina de boot F3.5.5C-H1
     chama _revealLogin('no_bridge') ~12s apos o load e o login pinta POR CIMA da sessao
     de QA (foi exatamente isso que invalidou o pacote 2B). Em contexto de QA suprimimos o
     reveal (registrando cada tentativa) — comportamento de PRODUTO intocado. */
  await pg.evaluate(() => { window.__qaRevealSuppressed = []; window._revealLogin = function (reason) { window.__qaRevealSuppressed.push(String(reason || '')); }; });
  await pg.waitForTimeout(700); return pg;
};
const pgC = await mkPage(sv1.address().port);
const pgB = await mkPage(sv2.address().port);
const out = { g: {}, info: {} }; const g = out.g; const I = out.info;
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const D = n => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };
const seedArgs = { d0: D(0), d1: D(1), d2: D(2), dm1: D(-1) };
const SEED = ({ d0, d1, d2, dm1 }, mode) => {
  state.user = { id: 'carlos', name: 'Carlos Eduardo', role: 'Social Media', admin: true };
  state.users = [state.user,
    { id: 'marina', name: 'Marina Klein', role: 'Designer' },
    { id: 'helio', name: 'Helio Duarte', role: 'Designer' },
    { id: 'bia', name: 'Bia Rocha', role: 'Social Media' }];
  document.body.classList.remove('desktop', 'light-ui');
  if (mode !== 'mobile') document.body.classList.add('desktop');
  if (mode === 'lui') document.body.classList.add('light-ui');
  document.body.classList.add('authed');
  const a = document.getElementById('authSplash'); if (a) a.style.display = 'none';
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  state.tasks = [
    { id: 'k1', title: 'Post de Agenda Aberta - histeroscopias', client: 'Dra. Helita Freitas', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: '2026-08-20', dueTime: '19:05', cardLegenda: 'Agenda aberta' },
    { id: 'k2', title: 'Edicao de videos - Agosto', client: 'Hospital Visao', sector: 'edicao_midia', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: d1, dueTime: '17:00', priority: true, videos: [{ tema: 'v1' }, { tema: 'v2' }, { tema: 'v3' }], checklist: [{ t: '1' }, { t: '2' }, { t: '3' }, { t: '4' }, { t: '5' }] },
    { id: 'k3', title: 'Reels de lancamento', client: 'Sunset Wear', sector: 'edicao_cards', by: 'marina', assigneeId: 'carlos', status: 'revisao', dueDate: d0, dueTime: '23:00' },
    { id: 'k4', title: 'Cronograma Setembro', client: 'Sunset Wear', sector: 'edicao_cards', by: 'carlos', assigneeId: null, status: 'concluido', dueDate: '2026-08-22' },
    { id: 'c1', title: 'Cronograma Setembro - Sunset Wear', client: 'Sunset Wear', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: d2, dueTime: '10:00', cronContents: [{ tema: 'Tema 1' }, { tema: 'Tema 2' }, { tema: 'Tema 3' }] },
    { id: 'cB', title: 'Cronograma Outubro - Hospital Visao', client: 'Hospital Visao', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: d1, dueTime: '18:00', workflowPhase: 'captions_waiting_client', cronContents: [{ tema: 'Tema A' }, { tema: 'Tema B' }] },
    { id: 'cC', title: 'Cronograma Clinica Vida - ajustes', client: 'Clinica Vida', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: '2026-08-20', dueTime: '16:00', clientReview: { status: 'revisao', note: 'Trocar o tema 2.', at: Date.now() - 3600000, byName: 'Cliente' }, cronContents: [{ tema: 'Tema X' }] },
    { id: 'cD', title: 'Cronograma Agosto - Colegio Alfa', client: 'Colegio Alfa', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'concluido', dueDate: '2026-08-22', finalApprovalCompleted: true, clientReview: { status: 'aprovado', at: Date.now() - 7200000, byName: 'Cliente' }, cronContents: [{ tema: 'Tema 1' }] },
    { id: 't5', title: 'Video institucional - cortes finais', client: 'Colegio Alfa', sector: 'edicao_midia', by: 'carlos', assigneeId: 'marina', status: 'andamento', dueDate: d2, dueTime: '12:00', designerAssignment: { designerId: 'marina', designerName: 'Marina Klein', status: 'in_progress', assignedAt: Date.now() - 7200000 }, videos: [{ tema: 'Manifesto' }] },
    { id: 't6', title: 'Pack de stories - semana 35', client: 'Sunset Wear', sector: 'edicao_cards', by: 'bia', assigneeId: 'bia', status: 'afazer', dueDate: d2, dueTime: '15:00' }
  ];
  state.events = [];
  state.tab = 'hoje'; render();
};
const seed = async (pg, mode) => { await pg.evaluate(SEED, seedArgs, ); };
// playwright evaluate: single arg — wrap
const seed2 = async (pg, mode) => { await pg.evaluate(args => { (0, eval)('(' + args.fn + ')')(args.sa, args.mode); }, { fn: SEED.toString(), sa: seedArgs, mode }); await pg.waitForTimeout(500); };
await seed2(pgC, 'lui'); await seed2(pgB, 'lui');

const MANIFEST = [];
const surfaceProbe = pg => pg.evaluate(() => {
  const l = document.getElementById('login');
  const loginPresent = !!l && !l.classList.contains('hidden') && getComputedStyle(l).display !== 'none' && l.getBoundingClientRect().width > 0;
  const el = document.querySelector('#content .scr-head, #content .h-title, #content .exec-ttl, #content .nc-ttl, #content .lui-ph-t');
  const heading = (((el && el.textContent) || '').trim() || (document.getElementById('content').innerText || '').trim()).replace(/\s+/g, ' ').slice(0, 70);
  return { loginPresent, heading,
    sidebar: !!document.querySelector('#bottomNav .sb-item'),
    clientLanes: document.querySelectorAll('.scr-client .kbv2-column').length,
    lanes: document.querySelectorAll('.kbv2-column').length,
    hubCards: document.querySelectorAll('#content .bcard').length,
    suppressed: (window.__qaRevealSuppressed || []).length,
    vw: window.innerWidth + 'x' + window.innerHeight };
});
const shotChecked = async (pg, name, expect) => {
  const p = await surfaceProbe(pg);
  const headOk = expect.head.test(p.heading);
  const extraOk = expect.check ? expect.check(p) : true;
  const valid = !p.loginPresent && headOk && extraOk && p.sidebar;
  MANIFEST.push({ filename: name, sourceSha: expect.src, viewport: p.vw, expectedSurface: expect.surface,
    actualSurface: p.loginPresent ? 'LOGIN' : p.heading.slice(0, 40), expectedHeading: String(expect.head),
    actualHeading: p.heading, loginPresent: p.loginPresent, revealSuppressedCount: p.suppressed, screenshotValid: valid });
  if (!valid) { g['SHOT_' + name.replace(/[^A-Za-z0-9]/g, '_')] = false; return false; }
  await pg.waitForTimeout(250); await pg.screenshot({ path: path.join(OUT, name) }); return true;
};
const CAND_SRC = 'worktree@96b88185 (2B)'; const BASE_SRC = '33d01275 (2A aprovado)';
const clkSide = async (pg, label) => { await pg.evaluate(t => {
  const d = document.querySelector('.nav .sb-more'); if (d && [...d.querySelectorAll('.sb-item')].some(x => ((x.querySelector('span:last-of-type') || {}).textContent || '') === t)) d.open = true;
  const it = [...document.querySelectorAll('#bottomNav .sb-item')].find(x => ((x.querySelector('span:last-of-type') || {}).textContent || '') === t);
  if (it) it.click(); }, label); await pg.waitForTimeout(450); };
const clk = async (pg, sel) => { await pg.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await pg.waitForTimeout(350); };

// ---------- inventario de toolbar por superficie (classificacao §4) ----------
const toolbarInv = pg => pg.evaluate(() => {
  const NAVA = ['data-myboard', 'data-flowclient', 'data-flowdesigners', 'data-flowsocials'];
  const cont = document.getElementById('content');
  const seen = [];
  cont.querySelectorAll('.d-board-tools button, .d-board-tools input, .lui-sstrip button, .lui-tb2 button, .lui-frow button, .lui-ph .bsearch, .wfap-bar button, [data-dstrip] button').forEach(el => {
    const attrs = [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name).join(',');
    let type = 'UNKNOWN';
    if (el.id === 'bSearch' || el.classList.contains('bsearch')) type = 'SEARCH';
    else if (NAVA.some(a => el.hasAttribute(a))) type = 'GLOBAL_NAV_DUPLICATE';
    else if (el.hasAttribute('data-board') && el.dataset.board === 'hub') type = 'GLOBAL_NAV_DUPLICATE';
    else if (el.hasAttribute('data-bmine') || el.hasAttribute('data-bresp') || el.hasAttribute('data-sector')) type = 'CONTEXT_FILTER';
    else if (el.hasAttribute('data-dpick') || el.hasAttribute('data-spick')) type = 'SURFACE_SPECIFIC';
    else if (attrs.includes('data-wfap') || (el.closest && el.closest('.wfap-bar'))) type = 'ACTION';
    else type = 'SURFACE_SPECIFIC';
    const visible = !!(el.offsetParent) && getComputedStyle(el).display !== 'none';
    seen.push({ label: (el.textContent || el.placeholder || '').trim().slice(0, 28), attrs, type, visible });
  });
  const tchips = document.querySelector('#content .d-board-tools .tchips');
  return { controls: seen, tchipsExists: !!tchips, tchipsVisible: !!(tchips && tchips.offsetParent && getComputedStyle(tchips).display !== 'none'), tchipsChildCount: tchips ? tchips.children.length : -1 };
});
const navDupVisible = inv => inv.controls.filter(c => c.type === 'GLOBAL_NAV_DUPLICATE' && c.visible).length;

// A. Meu quadro (lui) — deve estar byte-identico ao base2A (nao usa taskChips)
await clkSide(pgC, 'Meu quadro'); await clkSide(pgB, 'Meu quadro');
I.myboardHashCand = sha(await pgC.evaluate(() => document.getElementById('content').innerHTML));
I.myboardHashBase = sha(await pgB.evaluate(() => document.getElementById('content').innerHTML));
g.MQ1_luiByteIdentical = I.myboardHashCand === I.myboardHashBase;
I.myboardInv = await toolbarInv(pgC);
g.MQ2_noNavDup = navDupVisible(I.myboardInv) === 0;
g.MQ3_respChipsWork = await (async () => {
  await clk(pgC, '[data-bresp="marina"]');
  const n1 = await pgC.evaluate(() => document.querySelectorAll('.kbv2-card').length);
  await clk(pgC, '[data-bresp=""]');
  const n0 = await pgC.evaluate(() => document.querySelectorAll('.kbv2-card').length);
  return n1 >= 1 && n0 > n1;
})();
g.MQ4_searchWorks = await (async () => {
  await pgC.evaluate(() => { const i = document.getElementById('bSearch'); i.value = 'histeroscopias'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pgC.waitForTimeout(450);
  const n = await pgC.evaluate(() => document.querySelectorAll('.kbv2-card').length);
  await pgC.evaluate(() => { const i = document.getElementById('bSearch'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pgC.waitForTimeout(350); return n === 1;
})();

// B. Cliente
await clkSide(pgC, 'Cliente');
I.clientInv = await toolbarInv(pgC);
g.CL1_navDupGone = navDupVisible(I.clientInv) === 0 && I.clientInv.tchipsVisible === false && I.clientInv.tchipsChildCount === 0;
g.CL2_searchPresent = await pgC.evaluate(() => { const s = document.getElementById('bSearch'); return !!s && !!s.offsetParent; });
g.CL3_wfapPreserved = await pgC.evaluate(() => { const b = document.querySelector('.scr-client .wfap-bar'); return !!b && !!b.offsetParent && getComputedStyle(b).backgroundColor === 'rgb(245, 248, 251)'; });
g.CL4_lanes4 = await pgC.evaluate(() => document.querySelectorAll('.scr-client .kbv2-column').length === 4 && document.querySelectorAll('.scr-client .kbv2-card').length >= 4);
g.CL5_searchFilters = await (async () => {
  await pgC.evaluate(() => { const i = document.getElementById('bSearch'); i.value = 'Outubro'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pgC.waitForTimeout(450);
  const n = await pgC.evaluate(() => document.querySelectorAll('.scr-client .kbv2-card').length);
  await pgC.evaluate(() => { const i = document.getElementById('bSearch'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pgC.waitForTimeout(350); return n === 1;
})();
g.CL6_noHole = await pgC.evaluate(() => { const tb = document.querySelector('#content .d-board-tools'); if (!tb) return false; const r = tb.getBoundingClientRect(); const sr = document.getElementById('bSearch').getBoundingClientRect(); return r.height < 80 && sr.height > 24; });
I.clientToolbarRect = await pgC.evaluate(() => { const tb = document.querySelector('#content .d-board-tools'); const r = tb.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });

// C. Designers (board de designer com strip)
await clkSide(pgC, 'Designers');
I.designersInv = await toolbarInv(pgC);
g.DS1_navDupGone = navDupVisible(I.designersInv) === 0;
g.DS2_stripPreserved = await pgC.evaluate(() => !!document.querySelector('.scr-designers') && document.querySelectorAll('#content .kbv2-column').length >= 3);
I.designersStrip = await pgC.evaluate(() => [...document.querySelectorAll('#content .fdz-chip, #content [data-dpick], #content .dstrip button')].map(x => (x.textContent || '').trim().slice(0, 22)).slice(0, 8));

// D. Social Medias
await clkSide(pgC, 'Social Medias');
I.socialsInv = await toolbarInv(pgC);
g.SM1_navDupGone = navDupVisible(I.socialsInv) === 0;
g.SM2_boardIntact = await pgC.evaluate(() => document.querySelectorAll('#content .kbv2-column').length >= 3);

// E. Quadros -> board de setor
await clkSide(pgC, 'Quadros');
await pgC.evaluate(() => { const b = [...document.querySelectorAll('#content .bcard')].find(x => /Edição de Cards/.test(x.textContent)); if (b) b.click(); });
await pgC.waitForTimeout(450);
I.sectorInv = await toolbarInv(pgC);
g.SB1_navDupGone = navDupVisible(I.sectorInv) === 0;
g.SB2_mineChipPreserved = I.sectorInv.controls.some(c => /Minhas tarefas/.test(c.label) && c.visible);
g.SB3_sectorChipsPreserved = await pgC.evaluate(() => document.querySelectorAll('#content .lui-sstrip .lui-schip').length >= 3);
g.SB4_mineToggles = await (async () => {
  const n0 = await pgC.evaluate(() => document.querySelectorAll('#content .kbv2-card').length);
  await clk(pgC, '[data-bmine]');
  const n1 = await pgC.evaluate(() => document.querySelectorAll('#content .kbv2-card').length);
  await clk(pgC, '[data-bmine]');
  return n1 <= n0 && n1 >= 0;
})();
g.SB5_sectorSwitchWorks = await (async () => {
  await pgC.evaluate(() => { const c = [...document.querySelectorAll('#content .lui-schip')].find(x => /vídeos/.test(x.textContent)); if (c) c.click(); });
  await pgC.waitForTimeout(450);
  return pgC.evaluate(() => state.boardSector === 'edicao_midia');
})();
g.SB6_tchipsKeptForFilter = I.sectorInv.tchipsVisible === true && I.sectorInv.tchipsChildCount === 1;

// ---------- §14 reachability: todos os destinos via sidebar ----------
const REACH = [['Hoje', /Olá/], ['Meu quadro', /Meu quadro/], ['Cliente', /Cliente/], ['Designers', /Designer/], ['Social Medias', /Social/], ['Quadros', /Quadros/], ['Agenda', /Agenda|agosto|setembro/i], ['Relatórios', /Relatórios de Atraso/], ['Painel SLA', /Painel Executivo/], ['Configurações', /Configurações/], ['Minhas Prioridades', /Prioridade/i], ['Equipe', /Equipe/], ['Perfil', /Carlos/], ['Notificações', /Notificações/]];
out.reach = [];
for (const [label, re] of REACH) {
  await clkSide(pgC, label);
  const hd = await pgC.evaluate(() => { const el = document.querySelector('#content .scr-head, #content .h-title, #content .exec-ttl, #content .nc-ttl, #content .lui-ph-t'); const t = ((el && el.textContent) || '').trim(); return (t || (document.getElementById('content').innerText || '').trim()).replace(/\s+/g, ' ').slice(0, 60); });
  const on = await pgC.evaluate(() => [...document.querySelectorAll('#bottomNav .sb-item.on')].map(b => (b.querySelector('span:last-of-type') || {}).textContent || ''));
  out.reach.push({ label, ok: re.test(hd) && on.length === 1 && on[0] === label, hd, on });
}
g.NAV_allReachable = out.reach.every(x => x.ok);

// ---------- sidebar 2A regression (§12) ----------
I.sidebar = await pgC.evaluate(() => {
  const nav = document.getElementById('bottomNav');
  const items = [...nav.querySelectorAll('.sb-item')].map(b => (b.querySelector('span:last-of-type') || {}).textContent || '').filter(Boolean);
  const sects = [...nav.querySelectorAll('.sb-sect')].map(x => x.textContent.trim());
  const more = [...nav.querySelectorAll('.sb-more-list .sb-item')].map(b => (b.querySelector('span:last-of-type') || {}).textContent || '');
  return { items, sects, more };
});
g.SB2A_structure = I.sidebar.sects.join('|') === 'Principal|Ferramentas|Conta'
  && I.sidebar.items[0] === 'Hoje' && I.sidebar.items[1] === 'Meu quadro'
  && I.sidebar.items.includes('Quadros') && I.sidebar.items.includes('Painel SLA')
  && !I.sidebar.items.includes('Setores') && !I.sidebar.items.includes('Executivo') && !I.sidebar.items.includes('Tarefas')
  && I.sidebar.more.join('|') === 'Minhas Prioridades|Equipe|Perfil|Notificações'
  && I.sidebar.items.includes('Configurações');
g.SB2A_roleGate = await pgC.evaluate(() => {
  const saved = state.user; state.user = { id: 'op1', name: 'Op', role: 'Editor de video' }; render();
  const items = [...document.querySelectorAll('#bottomNav .sb-item')].map(b => (b.querySelector('span:last-of-type') || {}).textContent || '');
  state.user = saved; render();
  return !items.includes('Cliente') && !items.includes('Designers') && !items.includes('Social Medias') && items.includes('Hoje') && items.includes('Painel SLA');
});
await pgC.waitForTimeout(300);

// ---------- freeze T / D / C (C4 substituido pelo objetivo 2B) ----------
await clkSide(pgC, 'Meu quadro');
const tsm = await pgC.evaluate(() => {
  const r = {};
  const card2 = [...document.querySelectorAll('.kbv2-card')].find(c => c.querySelector('[data-cardmenu="k2"], [data-detail="k2"]'));
  const cs = card2 ? getComputedStyle(card2) : null;
  r.t1 = cs ? cs.display === 'grid' : false;
  r.t2 = card2 ? (card2.querySelector('.kbv2-due') && getComputedStyle(card2.querySelector('.kbv2-due')).display !== 'none') : false;
  r.t3 = card2 ? (() => { const t = card2.querySelector('.kbv2-title'); const tc = getComputedStyle(t); return parseFloat(tc.fontSize) >= 14.5 && parseInt(tc.fontWeight) >= 650; })() : false;
  r.t5 = card2 ? (getComputedStyle(card2.querySelector('.kbv2-card-chips'), '::before').content.includes('Setor')) : false;
  r.t6 = card2 ? (() => { const pr = [...card2.querySelectorAll('.kbv2-chip')].find(x => /Prioridade/i.test(x.textContent)); if (!pr) return false; const pcs = getComputedStyle(pr); return pcs.backgroundColor === 'rgba(0, 0, 0, 0)'; })() : false;
  r.t7 = card2 ? (() => { const rl = card2.querySelector('.kbv2-card-rail'); const p = card2.querySelector('.kbv2-pct'); return !!rl && getComputedStyle(rl).backgroundColor === 'rgb(245, 248, 251)' && !!p; })() : false;
  r.t9 = card2 ? (card2.querySelector('.kbv2-card-chk') && /5/.test(card2.querySelector('.kbv2-card-chk').textContent)) : false;
  r.t12 = card2 ? getComputedStyle(card2, '::before').display === 'none' : false;
  r.lanes = document.querySelectorAll('.kbv2-column').length;
  return r;
});
out.taskCard = tsm;
g.T_freeze = tsm.t1 && tsm.t2 && tsm.t3 && tsm.t5 && tsm.t6 && tsm.t7 && tsm.t9 && tsm.t12 && tsm.lanes === 4;
await clk(pgC, '[data-detail="k2"]');
const dg = await pgC.evaluate(() => {
  const r = {};
  const m = document.querySelector('.modal-back[data-detmodal]');
  r.D1 = !!m && m.dataset.detorigin === 'mine';
  const ttl = document.querySelector('.det-title');
  r.D3 = !!ttl && getComputedStyle(ttl).fontSize === '20px';
  const bdg = document.querySelector('.det-badge');
  r.D5 = !!bdg && getComputedStyle(bdg).backgroundColor === 'rgba(0, 0, 0, 0)';
  const people = [...document.querySelectorAll('.det-person')];
  r.D8 = people.length >= 1 && getComputedStyle(people[0]).backgroundColor === 'rgb(245, 248, 251)';
  const nx = document.querySelector('.det-hero-next');
  r.D10 = !!nx && getComputedStyle(nx).backgroundColor === 'rgb(245, 248, 251)';
  const sheet = document.querySelector('.det-sheet');
  r.D16 = !!sheet && sheet.scrollWidth <= sheet.clientWidth + 2;
  return r;
});
await clk(pgC, '.det-x');
dg.D2 = await pgC.evaluate(() => ((document.getElementById('modalRoot') || {}).innerHTML || '').length < 50);
out.detail = dg;
g.D_freeze = dg.D1 && dg.D2 && dg.D3 && dg.D5 && dg.D8 && dg.D10 && dg.D16;
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
  const cols = [...document.querySelectorAll('.scr-client .kbv2-column')];
  const nOf = i => cols[i] ? cols[i].querySelectorAll('.kbv2-card').length : -1;
  r.C5 = nOf(0) >= 1; r.C6 = nOf(1) >= 1; r.C7 = nOf(2) >= 1; r.C8 = nOf(3) >= 1;
  r.C13 = document.querySelectorAll('.scr-client .kbv2-card').length >= 4;
  const st = document.querySelector('.scr-client .kbv2-card .kbv2-status');
  r.CX = !st || (getComputedStyle(st).position === 'static' && st.scrollWidth <= st.clientWidth + 2);
  const tch = document.querySelector('.scr-client .tchips');
  r.C4b = !tch || !tch.offsetParent || tch.children.length === 0;   // objetivo 2B: nav segmentada ausente
  return r;
});
await clk(pgC, '[data-detail="cB"]');
cg.C14 = await pgC.evaluate(() => { const m = document.querySelector('.modal-back[data-detmodal]'); return !!m && m.dataset.detorigin === 'client'; });
await clk(pgC, '.det-x');
cg.CDF = await pgC.evaluate(() => ((document.getElementById('modalRoot') || {}).innerHTML || '').length < 50 && state.flowView === 'client' && document.querySelectorAll('.scr-client .kbv2-column').length === 4);
out.client = cg;
g.C_freeze = cg.C1 && cg.C2 && cg.C3 && cg.C4b && cg.C5 && cg.C6 && cg.C7 && cg.C8 && cg.C13 && cg.CX && cg.C14 && cg.CDF;

// ---------- mobile / legado (§9) ----------
const pgM = await mkPage(sv1.address().port, 390, 844);
await seed2(pgM, 'mobile');
await pgM.evaluate(() => { state.tab = 'tarefas'; state.flowView = 'client'; render(); });
await pgM.waitForTimeout(450);
I.mobileTchips = await pgM.evaluate(() => [...document.querySelectorAll('#content .tchips .tchip')].map(x => (x.textContent || '').trim()));
g.MB1_mobileKeepsChips = I.mobileTchips.length === 5 && I.mobileTchips.includes('Setores');
g.MB2_mobileChipNavigates = await (async () => {
  await pgM.evaluate(() => { const c = [...document.querySelectorAll('#content .tchips .tchip')].find(x => /Meu quadro/.test(x.textContent)); if (c) c.click(); });
  await pgM.waitForTimeout(400);
  return pgM.evaluate(() => !!state.personBoard && !state.flowView);
})();
const pgL = await mkPage(sv1.address().port, 1920, 1080);
await seed2(pgL, 'legacy');   // desktop SEM light-ui (kill-switch)
await pgL.evaluate(() => { state.tab = 'tarefas'; state.flowView = 'client'; render(); });
await pgL.waitForTimeout(450);
I.legacyTchips = await pgL.evaluate(() => [...document.querySelectorAll('#content .tchips .tchip')].map(x => (x.textContent || '').trim()));
g.LG1_legacyKeepsChips = I.legacyTchips.length === 5 && I.legacyTchips.includes('Setores');
out.pageErrorsMobile = pgM._errs; out.pageErrorsLegacy = pgL._errs;

// ---------- responsivo (§16) + shots (§17) ----------
const shotFull = async (pg, name) => { await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, name) }); };
const setVp = async (pg, w, h) => { await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(450); };
// Cliente candidato 3 viewports + hscroll (cada captura passa pelo hard gate anti-login)
await clkSide(pgC, 'Cliente');
out.resp = {};
const EXP_CLIENT = { head: /Cliente/, surface: 'Cliente board', src: CAND_SRC, check: p => p.clientLanes === 4 };
for (const [name, w, h] of [['1920', 1920, 1080], ['win125', 1536, 864], ['1366', 1366, 768]]) {
  await setVp(pgC, w, h);
  out.resp['client_' + name] = await pgC.evaluate(() => ({
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 2,
    toolbarH: Math.round((document.querySelector('#content .d-board-tools') || { getBoundingClientRect: () => ({ height: -1 }) }).getBoundingClientRect().height),
    searchVisible: !!(document.getElementById('bSearch') && document.getElementById('bSearch').offsetParent),
    lanes: document.querySelectorAll('.scr-client .kbv2-column').length,
    sidebarFirst: ((document.querySelector('#bottomNav .sb-item span:last-of-type') || {}).textContent || '')
  }));
  await shotChecked(pgC, 'I7172B-CLIENT-' + (name === 'win125' ? 'WIN125' : name.toUpperCase()) + '.png', EXP_CLIENT);
}
g.RS_client = ['1920', 'win125', '1366'].every(k => { const v = out.resp['client_' + k]; return !v.hscroll && v.searchVisible && v.lanes === 4 && v.sidebarFirst === 'Hoje'; });
await setVp(pgC, 1920, 1080);
await shotChecked(pgC, 'I7172B-CLIENT-AFTER.png', EXP_CLIENT);
// BEFORE (base2A) — mesma asserts na pagina base
await pgB.evaluate(() => { state.tab = 'tarefas'; state.flowView = 'client'; state.personBoard = null; render(); });
await pgB.waitForTimeout(450);
await shotChecked(pgB, 'I7172B-CLIENT-BEFORE.png', { head: /Cliente/, surface: 'Cliente board (2A)', src: BASE_SRC, check: p => p.clientLanes === 4 });
// Meu quadro before/after
await clkSide(pgC, 'Meu quadro');
await shotChecked(pgC, 'I7172B-MEUQUADRO-AFTER.png', { head: /Meu quadro/, surface: 'Meu quadro', src: CAND_SRC, check: p => p.lanes === 4 });
await clkSide(pgB, 'Meu quadro');
await shotChecked(pgB, 'I7172B-MEUQUADRO-BEFORE.png', { head: /Meu quadro/, surface: 'Meu quadro (2A)', src: BASE_SRC, check: p => p.lanes === 4 });
// demais AFTER
await clkSide(pgC, 'Designers');
await shotChecked(pgC, 'I7172B-DESIGNERS-AFTER.png', { head: /Designer|Quadro de/, surface: 'Designers', src: CAND_SRC, check: p => p.lanes >= 3 });
await clkSide(pgC, 'Social Medias');
await shotChecked(pgC, 'I7172B-SOCIALMEDIAS-AFTER.png', { head: /Social|Quadro de/, surface: 'Social Medias', src: CAND_SRC, check: p => p.lanes >= 3 });
await clkSide(pgC, 'Quadros');
await shotChecked(pgC, 'I7172B-QUADROS-AFTER.png', { head: /Quadros/, surface: 'Hub Quadros', src: CAND_SRC, check: p => p.hubCards >= 5 });
// contexto final Option B (sidebar aprovada + toolbar limpa + board real)
await clkSide(pgC, 'Cliente');
await shotChecked(pgC, 'I7172B-OPTION-B-FULL-CONTEXT.png', EXP_CLIENT);
// gates agregados de integridade de evidencia
g.SCREENSHOT_NOT_LOGIN = MANIFEST.every(m => m.loginPresent === false);
g.MANIFEST_allValid = MANIFEST.length >= 11 && MANIFEST.every(m => m.screenshotValid === true);   // 11 capturas diretas; os 2 composites sao compostos DEPOIS somente de frames validos e anexados ao manifesto
I.revealSuppressed = { cand: await pgC.evaluate(() => (window.__qaRevealSuppressed || [])), base: await pgB.evaluate(() => (window.__qaRevealSuppressed || [])) };
fs.writeFileSync(path.join(OUT, 'i7172b-evidence-manifest.json'), JSON.stringify(MANIFEST, null, 1));

g.P_noPageErrors = pgC._errs.length === 0 && pgM._errs.length === 0 && pgL._errs.length === 0;
out.pageErrorsCandidate = pgC._errs;
const fails = Object.entries(g).filter(([k, v]) => !v).map(([k]) => k);
out.fails = fails;
out.manifest = MANIFEST;
fs.writeFileSync(path.join(OUT, 'i7172b-qa.json'), JSON.stringify(out, null, 1));
console.log('GATES:', Object.keys(g).length, 'TRUE:', Object.values(g).filter(Boolean).length);
console.log('FAILS:', JSON.stringify(fails));
console.log(JSON.stringify({ myboardIdentical: g.MQ1_luiByteIdentical, clientInv: I.clientInv, sectorInv: { tchipsVisible: I.sectorInv.tchipsVisible, kids: I.sectorInv.tchipsChildCount }, mobile: I.mobileTchips, legacy: I.legacyTchips, reach: out.reach.map(x => x.label + ':' + (x.ok ? 'OK' : 'FAIL(' + x.hd + '|' + x.on + ')')), resp: out.resp, clientToolbar: I.clientToolbarRect }, null, 1));
await browser.close(); sv1.close(); sv2.close();
process.exit(fails.length ? 1 : 0);
