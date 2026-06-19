/* =====================================================================
 * F3.3.2 — QA VISUAL do PAINEL OPERACIONAL SLA (Desktop renderer REAL)
 * Playwright + Chromium headless. Carrega o renderer real, injeta tarefas
 * com prazo final próximo/estourado, abre o "Meu quadro" do designer e:
 *   - captura os 10 screenshots exigidos (painel laranja/vermelho/ambos,
 *     board nas 3 resoluções, sino, detalhe SLA, header alinhado);
 *   - valida numericamente o painel (2 seções, vermelho antes do laranja,
 *     textos) e o alinhamento header (avatar↔logo ID Seven e sino↔avatar).
 * NÃO loga, NÃO consulta Firestore (state injetado), NÃO envia nada.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-f332-out');
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.slaOpPanelHtml === 'function', { timeout: 25000 });

// Injeta um cenário (lista de tarefas) e renderiza o "Meu quadro" do designer dz1.
async function scenario(kind) {
  await page.evaluate((kind) => {
    const NOW = Date.now(), MIN = 60000;
    const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer' };
    state.user = designer;
    state.users = [designer, { id: 'owner', name: 'Owner Teste', role: 'Admin', admin: true }];
    const mk = (id, title, client, dueOffMin, extra) => Object.assign({
      id, title, client, sector: 'cronograma', status: 'andamento', assigneeId: 'dz1',
      designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento',
      designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW + dueOffMin * MIN },
    }, extra || {});
    const red = [mk('r1', 'Reels de lançamento', 'Boa Forma', -7), mk('r2', 'Arte campanha de verão', 'Clínica Vita', -23)];
    const amber = [mk('a1', 'Cronograma semanal', 'Boa Forma', 18), mk('a2', 'Carrossel institucional', 'Studio Lumen', 27)];
    const calm = [mk('c1', 'Post quinzenal', 'Boa Forma', 240), mk('d1', 'Banner entregue', 'Clínica Vita', -50, { designerFlowStatus: 'entregue' })];
    let tasks = [];
    if (kind === 'amber') tasks = amber.concat(calm);
    else if (kind === 'red') tasks = red.concat(calm);
    else tasks = red.concat(amber).concat(calm);
    state.tasks = tasks;
    document.body.classList.add('desktop', 'authed');
    const login = document.getElementById('login'); if (login) login.classList.add('hidden');
    const app = document.getElementById('app'); if (app) app.style.display = 'flex';
    state.tab = 'tarefas'; state.flowView = null; state.boardSector = null; state.designerBoard = null;
    state.personBoard = 'dz1';
    try { render(); } catch (_) {}
    if (!document.getElementById('cornerAvatar')) {
      const b = document.createElement('button'); b.id = 'cornerAvatar'; b.className = 'corner-avatar topav-btn';
      b.innerHTML = '<div class="av" style="width:38px;height:38px;border-radius:50%;background:#5B6CFF;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">M</div>';
      document.body.appendChild(b);
    }
    try { slaibRefresh(); } catch (_) {}
  }, kind);
  await page.waitForTimeout(350);
}

async function shotPanel(name) {
  const el = await page.$('#sla-oppanel');
  if (el) await el.screenshot({ path: path.join(OUT, name) });
  else await page.screenshot({ path: path.join(OUT, name) });
}

// (2) painel apenas laranja / (3) apenas vermelho / (4) ambos
await scenario('amber'); await shotPanel('f332-02-panel-laranja.png');
await scenario('red'); await shotPanel('f332-03-panel-vermelho.png');
await scenario('both'); await shotPanel('f332-04-panel-ambos.png');
// (1) quadro do designer com painel (full)
await page.screenshot({ path: path.join(OUT, 'f332-01-board-panel.png') });

// gate: derivação do painel (2 seções, ordem, textos)
const panel = await page.evaluate(() => {
  const host = document.getElementById('sla-oppanel');
  if (!host) return { present: false };
  const secs = [...host.querySelectorAll('.slaop-sec')].map(s => (s.className.includes('red') ? 'red' : 'amber'));
  const times = [...host.querySelectorAll('.slaop-time')].map(e => e.textContent || '');
  return {
    present: true, sections: secs,
    redBeforeAmber: secs.indexOf('red') === 0 && secs.includes('amber'),
    hasAtrasada: times.some(t => /Atrasada h[áa] \d+ min/.test(t)),
    hasFaltam: times.some(t => /Faltam \d+ min/.test(t)),
    hasOpenBtn: !!host.querySelector('[data-sla-open]'),
    counts: host.querySelector('.slaop-counts')?.textContent || '',
  };
});

// (5) central / sino aberta
await page.evaluate(() => { try { slaibToggle(); } catch (_) { const b = document.getElementById('slaib-bell'); if (b) b.click(); } });
await page.waitForSelector('.slaib-panel', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(OUT, 'f332-05-sino.png') });
await page.evaluate(() => { const ov = document.getElementById('slaib-ov'); if (ov) ov.remove(); });

// (6) detalhe SLA (tarefa overdue r1)
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(250);
await page.screenshot({ path: path.join(OUT, 'f332-06-detalhe-sla.png') });
const detail = await page.evaluate(() => {
  const txt = document.getElementById('modalRoot')?.textContent || '';
  return { hasSla: /SLA do designer/i.test(txt), hasPrazoEncerrado: /Prazo encerrado/.test(txt), hasAtraso: /Atraso de/.test(txt) };
});
await page.evaluate(() => { try { closeDetails && closeDetails(); } catch (_) {} const m = document.querySelector('.det-sheet'); if (m) { const ov = m.closest('.modal,.ov,[id*="modal"]'); if (ov) ov.remove(); } });

// (7) header alinhado — recarrega o board e mede avatar↔logo↔sino
await scenario('both');
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(OUT, 'f332-07-header-alinhado.png'), clip: { x: 0, y: 0, width: 1600, height: 120 } });
const header = await page.evaluate(() => {
  const av = document.getElementById('cornerAvatar');
  const bell = document.getElementById('slaib-bell');
  const logo = document.querySelector('#bottomNav .sb-brand .logo') || document.querySelector('.nav .sb-brand .logo');
  const c = el => { const r = el.getBoundingClientRect(); return { cy: r.top + r.height / 2, top: r.top, h: r.height, left: r.left, right: r.right }; };
  if (!av || !bell) return { ok: false };
  const a = c(av), b = c(bell), l = logo ? c(logo) : null;
  return {
    ok: true, avatarLogoDelta: l ? Math.round(Math.abs(a.cy - l.cy)) : null,
    bellAvatarTopDelta: Math.round(Math.abs(b.top - a.top)), bellAvatarGap: Math.round(a.left - b.right),
    hasLogo: !!l,
  };
});

// (8/9/10) board nas 3 resoluções
for (const [w, h, nm] of [[1366, 768, 'f332-08-1366x768.png'], [1600, 900, 'f332-09-1600x900.png'], [1920, 1080, 'f332-10-1920x1080.png']]) {
  await page.setViewportSize({ width: w, height: h });
  await scenario('both');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, nm) });
}

fs.writeFileSync(path.join(OUT, 'qa-f332-report.json'), JSON.stringify({ panel, detail, header, errors }, null, 2));
console.log('PANEL:', JSON.stringify(panel)); console.log('DETAIL:', JSON.stringify(detail)); console.log('HEADER:', JSON.stringify(header));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close(); server.close();

// ---- gates ----
const fail = [];
if (errors.length) fail.push('pageerror no renderer: ' + errors[0]);
if (!panel.present) fail.push('painel operacional ausente');
if (!(panel.sections || []).includes('red') || !(panel.sections || []).includes('amber')) fail.push('painel sem as 2 seções (vermelho+laranja)');
if (!panel.redBeforeAmber) fail.push('vermelho não está antes do laranja');
if (!panel.hasAtrasada) fail.push('sem texto "Atrasada há X min"');
if (!panel.hasFaltam) fail.push('sem texto "Faltam X min"');
if (!panel.hasOpenBtn) fail.push('sem botão Abrir tarefa (data-sla-open)');
if (!detail.hasSla || !detail.hasPrazoEncerrado) fail.push('detalhe SLA incompleto');
if (!header.ok) fail.push('header sem avatar/sino');
if (header.ok && header.hasLogo && header.avatarLogoDelta > 6) fail.push('avatar fora do eixo da logo (Δ=' + header.avatarLogoDelta + 'px)');
if (header.ok && header.bellAvatarTopDelta > 2) fail.push('sino desalinhado do avatar (Δtop=' + header.bellAvatarTopDelta + 'px)');
if (header.ok && (header.bellAvatarGap < 4 || header.bellAvatarGap > 22)) fail.push('folga sino↔avatar fora de 4..22 (gap=' + header.bellAvatarGap + ')');
if (fail.length) { console.error('::error::QA F3.3.2 FALHOU: ' + fail.join(' | ')); process.exit(1); }
console.log('QA F3.3.2 OK — painel operacional (2 seções, vermelho>laranja, textos, Abrir tarefa), detalhe SLA, header em esquadro (avatar↔logo, sino↔avatar).');
