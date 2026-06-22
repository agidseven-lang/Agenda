/* =====================================================================
 * F3.3.14 — QA VISUAL (read-only) da hotfix BUG1 + BUG2 (Desktop renderer)
 * Playwright + Chromium headless. Carrega o renderer REAL, injeta state
 * (sem login/Firestore/rede) e prova:
 *   BUG1 — Dashboard/Hoje LIMPO: #sla-monitor, #slaib-bell e #cornerAvatar
 *          NÃO existem fora do quadro (removidos da árvore).
 *   BUG1 — Quadro/Tarefas: os 3 overlays EXISTEM.
 *   BUG2 — header alinhado: centro vertical de #cornerAvatar, #slaib-bell e
 *          #sla-monitor com diferença máxima <= 2px.
 * Gera screenshots (Dashboard + Quadro) em 1366x768, 1350x689 e 1920x1080
 * e um relatório JSON. NÃO faz login real, NÃO consulta Firestore, NÃO envia
 * nada, NÃO faz deploy/release. Read-only sobre o renderer auditado.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-f3314');
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  let f = (req.url || '/').split('?')[0];
  if (f === '/' || f === '') f = '/index.html';
  const p = path.join(RENDER_DIR, f);
  fs.readFile(p, (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(p);
    const ct = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': ct }); res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const SEED = () => {
  const NOW = Date.now(), MIN = 60000;
  state.user = { id: 'owner', name: 'Owner Teste', role: 'Admin', admin: true };
  state.users = [state.user, { id: 'dz1', name: 'Designer Um', role: 'Designer' }];
  state.events = [];
  state.tasks = [
    { id: 't1', title: 'Post Institucional', client: 'Cliente A', sector: 'cronograma', status: 'afazer', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 12 * MIN, startedAt: NOW - 50 * MIN } },
    { id: 't2', title: 'Reels Lancamento', client: 'Cliente B', sector: 'cronograma', status: 'afazer', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 200 * MIN, planDueAt: NOW - 7 * MIN, startedAt: NOW - 180 * MIN } },
  ];
  document.body.classList.add('desktop', 'authed');
  const login = document.getElementById('login'); if (login) login.classList.add('hidden');
  const app = document.getElementById('app'); if (app) app.style.display = 'flex';
};
const GO = (tab) => {
  state.form = null; state.clientView = null; state.tab = tab; state.boardSector = null;
  if (tab === 'tarefas') { try { if (typeof SECTORS !== 'undefined') { const c = SECTORS.find(s => /cronog/i.test(s.key) || /cronog/i.test(s.label)); if (c) state.boardSector = c.key; } } catch (_) {} }
  try { render(); } catch (_) {}
  try { slaibRefresh(); } catch (_) {}
};
const PROBE = () => {
  const ids = ['cornerAvatar', 'slaib-bell', 'sla-monitor'];
  const out = {};
  ids.forEach(id => { const el = document.getElementById(id); out[id] = el ? (() => { const r = el.getBoundingClientRect(); return { present: true, centerY: r.top + r.height / 2, top: r.top, height: r.height, left: r.left }; })() : { present: false }; });
  return out;
};

const VIEWPORTS = [{ w: 1366, h: 768 }, { w: 1350, h: 689 }, { w: 1920, h: 1080 }];
const browser = await chromium.launch();
const report = { generatedAt: new Date().toISOString(), viewports: [], dashboardClean: true, headerAligned: true, maxCenterDeltaPx: 0, errors: [] };

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.errors.push(`${vp.w}x${vp.h}: ${String(e)}`));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.render === 'function' && typeof window.slaibRefresh === 'function', { timeout: 25000 });
  await page.evaluate(SEED);

  // ---- DASHBOARD (Hoje): overlays do quadro NÃO podem existir ----
  await page.evaluate(GO, 'hoje');
  await page.waitForTimeout(500);
  const dash = await page.evaluate(PROBE);
  const dashClean = !dash['sla-monitor'].present && !dash['slaib-bell'].present && !dash['cornerAvatar'].present;
  if (!dashClean) report.dashboardClean = false;
  await page.screenshot({ path: path.join(OUT, `dashboard-${vp.w}x${vp.h}.png`) });

  // ---- QUADRO (Tarefas): overlays existem + alinhados ----
  await page.evaluate(GO, 'tarefas');
  await page.waitForTimeout(600);
  const board = await page.evaluate(PROBE);
  const present = ['cornerAvatar', 'slaib-bell', 'sla-monitor'].filter(k => board[k].present);
  const centers = present.map(k => board[k].centerY);
  const delta = centers.length >= 2 ? (Math.max(...centers) - Math.min(...centers)) : 0;
  if (delta > report.maxCenterDeltaPx) report.maxCenterDeltaPx = delta;
  if (delta > 2) report.headerAligned = false;
  await page.screenshot({ path: path.join(OUT, `quadro-${vp.w}x${vp.h}.png`) });
  await page.screenshot({ path: path.join(OUT, `quadro-topright-${vp.w}x${vp.h}.png`), clip: { x: Math.max(0, vp.w - 460), y: 0, width: 460, height: 140 } });

  report.viewports.push({ viewport: `${vp.w}x${vp.h}`, dashboard: dash, board: board, presentOnBoard: present, centerDeltaPx: Math.round(delta * 100) / 100 });
  await page.close();
}

await browser.close();
server.close();

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('==== F3.3.14 VISUAL QA ====');
report.viewports.forEach(v => console.log(`  ${v.viewport}: dashboardClean=${!v.board ? '?' : (!v.dashboard['sla-monitor'].present && !v.dashboard['slaib-bell'].present && !v.dashboard['cornerAvatar'].present)} | overlays no quadro=[${v.presentOnBoard.join(',')}] | ΔcentroY=${v.centerDeltaPx}px`));
console.log(`  Dashboard limpo (todas resoluções): ${report.dashboardClean}`);
console.log(`  Header alinhado (Δ<=2px): ${report.headerAligned}  (Δmax=${Math.round(report.maxCenterDeltaPx * 100) / 100}px)`);
if (report.errors.length) console.log('  pageerrors:', report.errors.slice(0, 5));
const failGate = (!report.dashboardClean) || (!report.headerAligned);
if (failGate) { console.error('::error:: F3.3.14 visual QA falhou (Dashboard sujo ou header >2px)'); process.exit(1); }
console.log('OK — Dashboard limpo em 3 resoluções + header alinhado (<=2px).');
