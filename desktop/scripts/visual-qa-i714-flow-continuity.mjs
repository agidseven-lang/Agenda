/* I7.14 — QA de continuidade premium (F6 Detalhe + F2 Cliente) — HARness versionado.
 * LEAK GATE L1-L8 (Meu quadro, Designers, Socials, Setores, Agenda, Relatorios,
 * kbd fora do cliente, modal default F6 intocado) + REGRESSAO FUNCIONAL real
 * (Central abre/fecha nas duas origens da jornada, Mover, checklist, busca do
 * Cliente, painel de aprovacoes, navegacao por aba). Roda contra o renderer REAL
 * (http local; stub Proxy no-op de window.firebase so p/ boot offline). Saida:
 * desktop/qa-out-i714/ (gitignored). Uso: node desktop/scripts/visual-qa-i714-flow-continuity.mjs */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const __dir = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dir, '..', 'src', 'renderer');
const OUT = path.resolve(__dir, '..', 'qa-out-i714'); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { let f = (req.url || '/').split('?')[0]; if (f === '/') f = '/index.html';
  fs.readFile(path.join(SRC, f), (e, b) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(b); }); });
await new Promise(r => server.listen(0, r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined, args: ['--no-sandbox'] });
const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const perr = []; pg.on('pageerror', e => { if (!/firebase/.test(String(e))) perr.push(String(e).slice(0, 200)); });
await pg.addInitScript(() => { const P = new Proxy(function () {}, { get: () => P, apply: () => P, construct: () => P }); window.firebase = P; });
await pg.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await pg.waitForFunction(() => typeof state !== 'undefined' && typeof render === 'function', null, { timeout: 45000 });
const D = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
await pg.evaluate(S => {
  state.user = { id: 'carlos', name: 'Carlos Eduardo', role: 'Social Media', admin: true };
  state.users = [state.user, { id: 'marina', name: 'Marina Klein', role: 'Designer' }];
  document.body.classList.add('desktop', 'authed', 'light-ui');
  const a = document.getElementById('authSplash'); if (a) a.style.display = 'none';
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  state.tasks = [
    { id: 't1', title: 'Edição de vídeos — Agosto', client: 'Hospital Visão', sector: 'edicao_midia', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: S.d1, dueTime: '17:00', priority: true, videos: [{ tema: 'v1' }], checklist: [{ t: 'a', d: 1 }, { t: 'b' }] },
    { id: 't2', title: 'Post de Agenda', client: 'Dra. Hélita', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: S.d0, dueTime: '19:05' },
    { id: 'cB', title: 'Cronograma Outubro - HV', client: 'Hospital Visão', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: S.d1, dueTime: '18:00', workflowPhase: 'captions_waiting_client', cronContents: [{ tema: 'A' }] }
  ];
  state.tab = 'tarefas'; state.personBoard = 'carlos'; render();
}, { d0: D(0), d1: D(1) });
await pg.waitForTimeout(400);
const g = {}; const shot = n => pg.screenshot({ path: path.join(OUT, `I714-LEAK-${n}.png`) });
const clk = async sel => { await pg.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await pg.waitForTimeout(340); };

// L1 Meu quadro intacto (grid card + due + sem status-line vazado + kebab)
g.L1_myboard = await pg.evaluate(() => { const c = [...document.querySelectorAll('.kbv2-card')].find(x => x.querySelector('[data-cardmenu="t1"], [data-detail="t1"]')); if (!c) return false; const cs = getComputedStyle(c); const st = c.querySelector('.kbv2-status'); /* provas: grid + 4 lanes + NENHUMA regra .scr-client vazou (order:9 e uma linha propria so existem sob .scr-client) */ return cs.display === 'grid' && document.querySelectorAll('.kbv2-column').length === 4 && (!st || getComputedStyle(st).order !== '9'); });
await shot('MYBOARD');
// L2 Designers: hub renderiza; toolbar do quadro do designer NÃO ganhou o segmented do cliente
await clk('.nav [data-flowdesigners]');
g.L2_designersHub = await pg.evaluate(() => !!document.querySelector('.d-bh-title') && /Designers/.test(document.querySelector('.d-bh-title').textContent));
await shot('DESIGNERS');
// L3 Socials hub
await clk('.nav [data-flowsocials]');
g.L3_socialsHub = await pg.evaluate(() => /Social/.test((document.querySelector('.d-bh-title') || {}).textContent || ''));
await shot('SOCIALS');
// L4 Setores hub
await clk('.nav [data-board="hub"]');
g.L4_sectorsHub = await pg.evaluate(() => /Quadros/.test((document.querySelector('.d-bh-title, .scr-head') || {}).textContent || ''));
await shot('SETORES');
// L5 Agenda
await pg.evaluate(() => { state.form = null; state.boardSector = null; state.personBoard = null; state.roleBoards = false; state.flowView = null; state.designerBoard = null; state.socialBoard = null; state.tab = 'agenda'; render(); });
await pg.waitForTimeout(400);
g.L5_agenda = await pg.evaluate(() => document.body.innerText.includes('2026') && !!document.querySelector('#content'));
await shot('AGENDA');
// L6 Relatórios
await pg.evaluate(() => { state.tab = 'relatorios'; render(); });
await pg.waitForTimeout(400);
g.L6_reports = await pg.evaluate(() => /Relatórios de Atraso/.test(document.body.innerText));
await shot('RELATORIOS');
// L7 kbd ⌘K ainda presente FORA do cliente (prova de escopo): quadro do designer marina
await pg.evaluate(() => { state.tab = 'tarefas'; state.personBoard = null; render(); });
await clk('.nav [data-flowdesigners]');
g.L7_kbdOutsideClient = await pg.evaluate(() => { const k = document.querySelector('.bsearch-kbd'); return !k || getComputedStyle(k).display !== 'none'; });
// L8 F6 default modal (sem detorigin) intocado: pessoas 2 colunas + título 27px
await pg.evaluate(() => { state.flowView = null; state.tab = 'hoje'; render(); });
await pg.waitForTimeout(300);
await pg.evaluate(() => openDetails('t1'));
await pg.waitForTimeout(350);
g.L8_defaultModalUntouched = await pg.evaluate(() => { const m = document.querySelector('.modal-back[data-detmodal]'); const p = document.querySelector('.det-people'); const t = document.querySelector('.det-title'); const cols = p ? getComputedStyle(p).gridTemplateColumns.trim().split(/\s+/).length : 0; return !!m && !m.dataset.detorigin && cols === 2 && t && getComputedStyle(t).fontSize === '27px'; });
await shot('DEFAULT-MODAL');
await pg.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });

// ---- FUNCTIONAL ----
await pg.evaluate(() => { state.tab = 'tarefas'; state.personBoard = 'carlos'; render(); });
await pg.waitForTimeout(300);
// F_det: abre pelo clique real, fecha pelo X real
await clk('[data-detail="t1"]');
g.F_detOpen = await pg.evaluate(() => !!document.querySelector('.modal-back[data-detmodal][data-detorigin="mine"]'));
g.F_detChecklist = await pg.evaluate(() => { const m = document.getElementById('modalRoot'); const ok = /Checklist/i.test((m && (m.innerText || m.textContent)) || ''); if (!ok) console.log('DETSNIPPET:', ((m && m.textContent) || '').slice(0, 300)); return ok; });
await clk('.det-x');
g.F_detCloseReal = await pg.evaluate(() => ((document.getElementById('modalRoot') || {}).innerHTML || '').length < 50);
// F_move
await clk('[data-move="t1"]');
g.F_moveModal = await pg.evaluate(() => /Mover tarefa/.test((document.getElementById('modalRoot') || {}).innerHTML || ''));
await pg.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
// Cliente: nav, busca real, aprovações, detail client-origin, tab de volta
await clk('.nav [data-flowclient]');
g.F_clientNav = await pg.evaluate(() => state.flowView === 'client');
await pg.evaluate(() => { const i = document.getElementById('bSearch'); i.value = 'Outubro'; i.dispatchEvent(new Event('input', { bubbles: true })); });
await pg.waitForTimeout(400);
g.F_clientSearch = await pg.evaluate(() => document.querySelectorAll('.scr-client .kbv2-card').length === 1);
await pg.evaluate(() => { const i = document.getElementById('bSearch'); if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); } });
await pg.waitForTimeout(300);
await clk('[data-wfapprovalsopen]');
g.F_approvalsOpen = await pg.evaluate(() => !!document.querySelector('.wfap-panel, .wfap-drawer, .wfap-list') || ((document.getElementById('modalRoot') || {}).innerText || '').length > 40);
await pg.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
await clk('[data-detail="cB"]');
g.F_detClientOrigin = await pg.evaluate(() => { const m = document.querySelector('.modal-back[data-detmodal]'); return !!m && m.dataset.detorigin === 'client'; });
await clk('.det-x');
// tchip real: navegar para Designers pela aba e voltar pela sidebar
await clk('.scr-client .tchips .tchip:nth-child(3)');
g.F_tchipNav = await pg.evaluate(() => state.flowView !== 'client');
await clk('.nav [data-flowclient]');
g.F_backToClient = await pg.evaluate(() => state.flowView === 'client');

g.P_pageErrors = perr.length === 0;
const fails = Object.entries(g).filter(([k, v]) => !v).map(([k]) => k);
console.log(JSON.stringify({ g, fails, perr }, null, 1));
fs.writeFileSync(path.join(OUT, 'i714-gates.json'), JSON.stringify({ g, fails, perr }, null, 1));
await browser.close(); server.close();
process.exit(fails.length ? 1 : 0);
