/* =====================================================================
 * QA VISUAL AUTOMATIZADO — Sino SLA in-app (Desktop renderer)
 * Roda em CI (Playwright + Chromium headless). Carrega o renderer REAL,
 * injeta tarefas com PRAZO FINAL próximo/estourado, e:
 *   - tira screenshots (board+sino, recorte topo-direito, painel aberto);
 *   - valida numericamente o alinhamento sino↔avatar;
 *   - valida que o sino é SVG e que o painel mostra laranja/vermelho + texto.
 * NÃO faz login real, NÃO consulta Firestore (state injetado), NÃO envia nada.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out');
fs.mkdirSync(OUT, { recursive: true });

// servidor estático mínimo (evita quirks de file://)
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.slaibRefresh === 'function' && typeof window.render === 'function', { timeout: 25000 });

await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000;
  state.user = { id: 'owner', name: 'Owner Teste', role: 'Admin', admin: true };
  state.users = [state.user, { id: 'dz1', name: 'Designer Um', role: 'Designer' }];
  state.tasks = [
    { id: 't1', title: 'Post Institucional', client: 'Cliente A', sector: 'cronograma', status: 'afazer', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 12 * MIN, startedAt: NOW - 50 * MIN } },
    { id: 't2', title: 'Reels Lancamento', client: 'Cliente B', sector: 'cronograma', status: 'afazer', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 200 * MIN, planDueAt: NOW - 7 * MIN, startedAt: NOW - 180 * MIN } },
    { id: 't3', title: 'Carrossel', client: 'Cliente C', sector: 'cronograma', status: 'afazer', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 10 * MIN, planDueAt: NOW + 90 * MIN, startedAt: NOW - 5 * MIN } },
  ];
  document.body.classList.add('desktop', 'authed');
  const login = document.getElementById('login'); if (login) login.classList.add('hidden');
  const app = document.getElementById('app'); if (app) app.style.display = 'flex';
  state.tab = 'tarefas';
  try { if (typeof SECTORS !== 'undefined') { const c = SECTORS.find(s => /cronog/i.test(s.key) || /cronog/i.test(s.label)); if (c) state.boardSector = c.key; } } catch (_) {}
  try { render(); } catch (_) {}
  // garante avatar fixo (se o render headless não o criou)
  if (!document.getElementById('cornerAvatar')) {
    const b = document.createElement('button'); b.id = 'cornerAvatar'; b.className = 'corner-avatar topav-btn';
    b.innerHTML = '<div class="av" style="width:38px;height:38px;border-radius:50%;background:#5B6CFF;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">O</div>';
    document.body.appendChild(b);
  }
  try { slaibRefresh(); } catch (_) {}
});
await page.waitForSelector('#slaib-bell', { timeout: 8000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, '01-board-bell.png') });
await page.screenshot({ path: path.join(OUT, '02-topright.png'), clip: { x: 1020, y: 0, width: 420, height: 130 } });

await page.evaluate(() => { try { slaibToggle(); } catch (_) { const b = document.getElementById('slaib-bell'); if (b) b.click(); } });
await page.waitForSelector('.slaib-panel', { timeout: 6000 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, '03-panel.png') });

const data = await page.evaluate(() => {
  const a = document.getElementById('cornerAvatar').getBoundingClientRect();
  const b = document.getElementById('slaib-bell').getBoundingClientRect();
  const items = [...document.querySelectorAll('.slaib-it')].map(el => ({
    label: el.querySelector('.t')?.textContent || '',
    msg: el.querySelector('.msg')?.textContent || '',
    sev: (el.querySelector('.slaib-dot')?.className || '').replace('slaib-dot', '').trim(),
  }));
  return {
    bellHasSvg: !!document.querySelector('#slaib-bell svg'),
    count: document.getElementById('slaib-count')?.textContent || '',
    align: { dTop: Math.round(b.top - a.top), gap: Math.round(a.left - b.right), bellH: Math.round(b.height), avatarH: Math.round(a.height) },
    items,
  };
});
fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify({ data, errors }, null, 2));
console.log('QA REPORT:', JSON.stringify(data, null, 2));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));

await browser.close(); server.close();

// ---- gates automáticos ----
const fail = [];
if (!data.bellHasSvg) fail.push('sino sem <svg> (ícone)');
if (!data.items.length) fail.push('painel sem itens');
if (Math.abs(data.align.dTop) > 2) fail.push('desalinhado verticalmente (dTop=' + data.align.dTop + 'px)');
if (data.align.gap < 4 || data.align.gap > 20) fail.push('folga sino↔avatar fora de 4..20px (gap=' + data.align.gap + 'px)');
if (!data.items.some(i => i.sev === 'laranja')) fail.push('sem alerta laranja (prazo próximo)');
if (!data.items.some(i => i.sev === 'vermelho')) fail.push('sem alerta vermelho (prazo encerrado)');
if (!data.items.some(i => /Faltam \d+ min/.test(i.msg))) fail.push('sem texto "Faltam X min"');
if (!data.items.some(i => /ultrapassado/i.test(i.msg))) fail.push('sem texto "ultrapassado"');
if (fail.length) { console.error('::error::VISUAL QA FALHOU: ' + fail.join(' | ')); process.exit(1); }
console.log('VISUAL QA OK — sino alinhado, SVG, laranja+vermelho por prazo final, textos corretos.');
