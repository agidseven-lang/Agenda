/* =====================================================================
 * F3.3.2 (reteste #4) — QA VISUAL: SLA MONITOR widget flutuante (top-right)
 * + Kanban/card RESTAURADO ao aprovado. Playwright + Chromium, renderer REAL.
 * Valida: widget fixed fora do board (não empurra/corta), estados verde/laranja/
 * vermelho, dropdown com 10min + Abrir, card de cronograma REAL inteiro (avatar
 * real, temas, rodapé, sem "Início atrasado" dentro do prazo), header sino/avatar
 * alinhado (com badge), Editar prazo RBAC, contagem coerente. NÃO envia/escreve.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-f332-out');
fs.mkdirSync(OUT, { recursive: true });
const PNG1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const server = http.createServer((req, res) => {
  let f = (req.url || '/').split('?')[0]; if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    const ext = path.extname(f);
    res.writeHead(200, { 'content-type': ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.slaMonRender === 'function', { timeout: 25000 });

async function scenario(kind, asUser) {
  await page.evaluate(({ kind, asUser, PNG1x1 }) => {
    const NOW = Date.now(), MIN = 60000;
    const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: PNG1x1 };
    const owner = { id: 'owner', name: 'Owner Admin', role: 'Administrador', admin: true };
    state.user = (asUser === 'designer') ? designer : owner;
    state.users = [owner, designer];
    const mk = (id, title, client, dueOffMin, extra) => Object.assign({
      id, title, client, sector: 'cronograma', status: 'andamento', assigneeId: 'dz1',
      designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento',
      designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW + dueOffMin * MIN, startedAt: NOW - 100 * MIN },
    }, extra || {});
    // card REAL (dentro do prazo: +90min) com avatar real + 1 tema → testa card inteiro/avatar/status
    const showcase = mk('show', 'Cronograma semanal — Boa Forma', 'Boa Forma', 90, {
      status: 'afazer', cronContents: [{ tema: 'Dia das Mães — campanha', legenda: '' }],
    });
    const red = [mk('r1', 'Reels de lançamento', 'Boa Forma', -7), mk('r2', 'Arte campanha de verão', 'Clínica Vita', -23)];
    const amber = [mk('a1', 'Carrossel institucional', 'Studio Lumen', 18), mk('a2', 'Stories semanais', 'Boa Forma', 27)];
    let tasks = [showcase];
    if (kind === 'amber') tasks = tasks.concat(amber);
    else if (kind === 'red') tasks = tasks.concat(red);
    else if (kind === 'empty') tasks = [showcase];
    else tasks = tasks.concat(red, amber);
    state.tasks = tasks;
    document.body.classList.add('desktop', 'authed');
    const login = document.getElementById('login'); if (login) login.classList.add('hidden');
    const app = document.getElementById('app'); if (app) app.style.display = 'flex';
    state.tab = 'tarefas'; state.flowView = null; state.boardSector = null; state.designerBoard = null; state.personBoard = 'dz1';
    if (typeof slaMonOpen !== 'undefined') slaMonOpen = false;
    try { render(); } catch (_) {}
    if (!document.getElementById('cornerAvatar')) {
      const b = document.createElement('button'); b.id = 'cornerAvatar'; b.className = 'corner-avatar topav-btn';
      b.innerHTML = '<div class="av" style="width:38px;height:38px;border-radius:50%;background:#5B6CFF;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">O</div>';
      document.body.appendChild(b);
    }
    try { slaibRefresh(); } catch (_) {}
  }, { kind, asUser: asUser || 'admin', PNG1x1 });
  await page.waitForTimeout(360);
}
async function openMon() { await page.evaluate(() => { const b = document.querySelector('[data-slamon-toggle]'); if (b) b.click(); }); await page.waitForTimeout(220); }

// estados do widget
await scenario('empty');
const widgetGreen = await page.evaluate(() => { const w = document.getElementById('sla-monitor'); return w ? { cls: w.className, fixed: getComputedStyle(w).position } : { cls: '' }; });
await page.screenshot({ path: path.join(OUT, 'f332-12-widget-verde.png') });
await scenario('amber'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-02-widget-laranja.png') });
await scenario('red'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-03-widget-vermelho.png') });
await scenario('both'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-04-widget-ambos.png') });
const widget = await page.evaluate(() => {
  const w = document.getElementById('sla-monitor'); if (!w) return { present: false };
  const cs = getComputedStyle(w);
  const grps = [...w.querySelectorAll('.slaop-grp')].map(s => (s.className.includes('red') ? 'red' : 'amber'));
  const txt = w.textContent || '';
  // não pode existir painel inline dentro do board:
  const inBoardPanel = !!document.querySelector('#content .slaop, #content #sla-oppanel');
  return {
    present: true, position: cs.position, cls: w.className, open: w.className.includes('open'),
    groups: grps, redBeforeAmber: grps.indexOf('red') === 0 && grps.includes('amber'),
    hasAtrasada: /Atrasada h[áa] \d+ min/.test(txt), hasFaltam: /Faltam \d+ min/.test(txt),
    has10min: /Conclua a tarefa atrasada em até 10 min ou sinalize atraso/.test(txt),
    hasOpenBtn: !!w.querySelector('[data-sla-open]'), hasBadge: !!w.querySelector('.slamon-badge'),
    monitorTitle: /Monitor de prazos/.test(txt), inBoardPanel,
  };
});

// board (widget fechado) — não pode haver painel empurrando o board
await scenario('both'); await page.screenshot({ path: path.join(OUT, 'f332-01-board.png') });

// card REAL: inteiro (não comprimido), avatar real, temas/rodapé, SLA chip não "Início atrasado"
const card = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.kbv2-card')];
  let found = null;
  for (const c of cards) {
    if ((c.textContent || '').includes('Cronograma semanal — Boa Forma')) {
      const av = c.querySelector('.kbv2-av .av');
      const avStyle = av ? (av.getAttribute('style') || '') : '';
      found = {
        compressed: c.scrollHeight > c.clientHeight + 2,
        hasFooter: !!c.querySelector('.kbv2-card-footer, .kbv2-btn'),
        hasThemes: !!c.querySelector('.kbv2-card-themes'),
        avatarReal: /background-image/.test(avStyle),
        slaChip: (c.querySelector('.kbv2-sla') || {}).textContent || '',
      };
    }
  }
  const anyInicioAtrasado = [...document.querySelectorAll('.kbv2-sla')].some(e => /Início atrasado/.test(e.textContent || ''));
  return { found, anyInicioAtrasado };
});

// contagem coerente
const count = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000;
  const t = { id: 'cc', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' },
    designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 18 * MIN } };
  const d = slaPanelDerive([t], NOW, (typeof dtMs === 'function' ? dtMs : null));
  return { min: d.warning[0] ? d.warning[0].remainingMin : -1 };
});

// detalhe + Editar prazo (admin) + sino
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(220); await page.screenshot({ path: path.join(OUT, 'f332-06-detalhe-sla.png') });
const detail = await page.evaluate(() => {
  const txt = document.getElementById('modalRoot')?.textContent || '';
  return { hasSla: /SLA do designer/i.test(txt), editPrazoAdmin: !!document.querySelector('[data-sla-editprazo]') };
});
await page.evaluate(() => { const b = document.querySelector('[data-sla-editprazo]'); if (b) b.click(); });
await page.waitForSelector('#slaedit-ov', { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(160); await page.screenshot({ path: path.join(OUT, 'f332-13-editar-prazo-admin.png') });
await page.evaluate(() => { const ov = document.getElementById('slaedit-ov'); if (ov) ov.remove(); const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

await scenario('red', 'designer');
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(160);
const rbac = await page.evaluate(() => ({ editPrazoDesigner: !!document.querySelector('[data-sla-editprazo]') }));
await page.evaluate(() => { const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

// header: sino+avatar+widget alinhados (com badge)
await scenario('both'); await page.waitForTimeout(150);
await page.screenshot({ path: path.join(OUT, 'f332-07-header.png'), clip: { x: 700, y: 0, width: 900, height: 110 } });
const header = await page.evaluate(() => {
  const av = document.getElementById('cornerAvatar'), bell = document.getElementById('slaib-bell'), mon = document.getElementById('sla-monitor');
  if (!av || !bell) return { ok: false };
  const c = el => { const r = el.getBoundingClientRect(); return { cy: r.top + r.height / 2, top: r.top, left: r.left, right: r.right }; };
  const a = c(av), b = c(bell), m = mon ? c(mon) : null;
  const logo = document.querySelector('#bottomNav .sb-brand .logo'); const l = logo ? c(logo) : null;
  return {
    ok: true, bellAvatarTopDelta: Math.round(Math.abs(b.top - a.top)), bellAvatarGap: Math.round(a.left - b.right),
    avatarLogoDelta: l ? Math.round(Math.abs(a.cy - l.cy)) : null, hasLogo: !!l,
    monPresent: !!m, monAvatarCenterDelta: m ? Math.round(Math.abs(m.cy - a.cy)) : null,
    monLeftOfBell: m ? (m.right <= b.left + 4) : false,
  };
});

// 3 resoluções
for (const [w, h, nm] of [[1366, 768, 'f332-08-1366x768.png'], [1600, 900, 'f332-09-1600x900.png'], [1920, 1080, 'f332-10-1920x1080.png']]) {
  await page.setViewportSize({ width: w, height: h }); await scenario('both'); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, nm) });
}

fs.writeFileSync(path.join(OUT, 'qa-f332-report.json'), JSON.stringify({ widget, widgetGreen, card, count, detail, rbac, header, errors }, null, 2));
console.log('WIDGET:', JSON.stringify(widget)); console.log('GREEN:', JSON.stringify(widgetGreen)); console.log('CARD:', JSON.stringify(card));
console.log('COUNT:', JSON.stringify(count)); console.log('DETAIL:', JSON.stringify(detail)); console.log('RBAC:', JSON.stringify(rbac)); console.log('HEADER:', JSON.stringify(header));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close(); server.close();

const fail = [];
if (errors.length) fail.push('pageerror: ' + errors[0]);
// WIDGET flutuante fora do board
if (!widget.present) fail.push('SLA Monitor widget ausente');
if (widget.present && widget.position !== 'fixed') fail.push('widget não é fixed (position=' + widget.position + ')');
if (widget.present && widget.inBoardPanel) fail.push('ainda há painel SLA inline no board (não removido)');
if ((widgetGreen.cls || '').indexOf('green') < 0) fail.push('estado verde do widget ausente');
if (!widget.open) fail.push('dropdown do widget não abriu');
if (!widget.monitorTitle) fail.push('dropdown sem "Monitor de prazos"');
if (!(widget.groups || []).includes('red') || !(widget.groups || []).includes('amber')) fail.push('dropdown sem os 2 grupos');
if (!widget.redBeforeAmber) fail.push('vermelho não antes do laranja');
if (!widget.hasAtrasada || !widget.hasFaltam) fail.push('faltam textos de tempo');
if (!widget.has10min) fail.push('vermelho sem regra dos 10 min');
if (!widget.hasOpenBtn) fail.push('sem botão Abrir tarefa');
if (!widget.hasBadge) fail.push('widget sem badge de quantidade');
// CARD restaurado/íntegro
if (!card.found) fail.push('card de cronograma não encontrado');
if (card.found && card.found.compressed) fail.push('card AMPUTADO/comprimido');
if (card.found && (!card.found.hasFooter || !card.found.hasThemes)) fail.push('card sem rodapé/temas');
if (card.found && !card.found.avatarReal) fail.push('avatar real NÃO renderizado no card (virou genérico)');
if (card.anyInicioAtrasado) fail.push('card mostra "Início atrasado" (status SLA por início — proibido)');
// contagem
if (![17, 18, 19].includes(count.min)) fail.push('contagem incoerente (min=' + count.min + ')');
// detalhe + RBAC
if (!detail.hasSla || !detail.editPrazoAdmin) fail.push('detalhe/Editar prazo (admin) incompleto');
if (rbac.editPrazoDesigner) fail.push('Editar prazo VISÍVEL p/ Designer (RBAC falhou)');
// header alinhado (com badge) + widget
if (!header.ok) fail.push('header sem avatar/sino');
if (header.ok && header.bellAvatarTopDelta > 2) fail.push('sino desalinhado do avatar (Δ=' + header.bellAvatarTopDelta + ')');
if (header.ok && (header.bellAvatarGap < 4 || header.bellAvatarGap > 22)) fail.push('folga sino↔avatar fora (gap=' + header.bellAvatarGap + ')');
if (header.ok && header.hasLogo && header.avatarLogoDelta > 6) fail.push('avatar fora do eixo da logo (Δ=' + header.avatarLogoDelta + ')');
if (header.ok && header.monPresent && header.monAvatarCenterDelta > 3) fail.push('widget fora do eixo do sino/avatar (Δ=' + header.monAvatarCenterDelta + ')');
if (header.ok && header.monPresent && !header.monLeftOfBell) fail.push('widget não está à esquerda do sino');
if (fail.length) { console.error('::error::QA F3.3.2 FALHOU: ' + fail.join(' | ')); process.exit(1); }
console.log('QA F3.3.2 OK — SLA Monitor widget FIXED top-right (fora do board), verde/laranja/vermelho + dropdown 10min + Abrir; card REAL inteiro (avatar real, temas, rodapé, sem "Início atrasado"); header alinhado (sino/avatar/widget); Editar prazo RBAC; contagem ' + count.min + 'min.');
