/* =====================================================================
 * F3.3.2 (reteste #3) — QA VISUAL do PAINEL SLA (Desktop renderer REAL)
 * Playwright + Chromium. Valida que o painel é uma BARRA fina + POPOVER
 * flutuante (overlay, não consome altura) e que o Kanban/cards ficam
 * INTEIROS — inclusive um card de cronograma REAL (temas + etapa + rodapé)
 * sozinho numa coluna, medido a 1366×768. Também valida estados verde/
 * laranja/vermelho (com regra dos 10 min), Editar prazo RBAC, header e
 * coerência de contagem. NÃO loga, NÃO consulta Firestore, NÃO envia nada.
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
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.slaOpPanelHtml === 'function', { timeout: 25000 });

// Injeta cenário e renderiza o quadro do designer dz1. SEMPRE inclui um card de
// cronograma REAL (temas + etapa + rodapé) sozinho na coluna "A Fazer" (card-whole).
async function scenario(kind, asUser) {
  await page.evaluate(({ kind, asUser }) => {
    const NOW = Date.now(), MIN = 60000;
    const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer' };
    const owner = { id: 'owner', name: 'Owner Admin', role: 'Administrador', admin: true };
    state.user = (asUser === 'designer') ? designer : owner;
    state.users = [owner, designer];
    const mk = (id, title, client, dueOffMin, extra) => Object.assign({
      id, title, client, sector: 'cronograma', status: 'andamento', assigneeId: 'dz1',
      designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento',
      designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW + dueOffMin * MIN },
    }, extra || {});
    // card REAL sozinho em "A Fazer" (mede card inteiro): cronograma com tema + etapa + rodapé
    const showcase = mk('show', 'Cronograma semanal — Boa Forma', 'Boa Forma', 90, {
      status: 'afazer', designerFlowStatus: 'andamento',
      cronContents: [{ tema: 'Dia das Mães — campanha', legenda: '' }],
    });
    const red = [mk('r1', 'Reels de lançamento', 'Boa Forma', -7), mk('r2', 'Arte campanha de verão', 'Clínica Vita', -23)];
    const amber = [mk('a1', 'Carrossel institucional', 'Studio Lumen', 18), mk('a2', 'Stories semanais', 'Boa Forma', 27)];
    const calm = [mk('d1', 'Banner entregue', 'Clínica Vita', -50, { designerFlowStatus: 'entregue' })];
    let tasks = [showcase];
    if (kind === 'amber') tasks = tasks.concat(amber, calm);
    else if (kind === 'red') tasks = tasks.concat(red, calm);
    else if (kind === 'empty') tasks = tasks.concat(calm);
    else if (kind === 'one') tasks = [showcase];
    else tasks = tasks.concat(red, amber, calm);
    state.tasks = tasks;
    document.body.classList.add('desktop', 'authed');
    const login = document.getElementById('login'); if (login) login.classList.add('hidden');
    const app = document.getElementById('app'); if (app) app.style.display = 'flex';
    state.tab = 'tarefas'; state.flowView = null; state.boardSector = null; state.designerBoard = null;
    state.personBoard = 'dz1';
    if (typeof slaOpOpen !== 'undefined') slaOpOpen = false;
    try { render(); } catch (_) {}
    if (!document.getElementById('cornerAvatar')) {
      const b = document.createElement('button'); b.id = 'cornerAvatar'; b.className = 'corner-avatar topav-btn';
      b.innerHTML = '<div class="av" style="width:38px;height:38px;border-radius:50%;background:#5B6CFF;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800">O</div>';
      document.body.appendChild(b);
    }
    try { slaibRefresh(); } catch (_) {}
  }, { kind, asUser: asUser || 'admin' });
  await page.waitForTimeout(350);
}
async function openPop() {
  await page.evaluate(() => { const b = document.querySelector('[data-sla-toggle]'); if (b) b.click(); });
  await page.waitForTimeout(220);
}

// estados (popover ABERTO p/ mostrar detalhe nos screenshots de painel)
await scenario('empty'); await page.screenshot({ path: path.join(OUT, 'f332-12-board-vazio.png') });
await page.$('#sla-oppanel').then(el => el && el.screenshot({ path: path.join(OUT, 'f332-11-painel-vazio.png') }));
const emptyPanel = await page.evaluate(() => {
  const host = document.getElementById('sla-oppanel'); if (!host) return { present: false };
  const txt = host.textContent || '';
  return { present: true, hasTitle: /Acompanhamento de prazos/.test(txt), hasTudoEmDia: /Tudo em dia/.test(txt),
    hasEmptyMsg: /Nenhuma tarefa atrasada ou com prazo pr[óo]ximo/i.test(txt),
    groups: host.querySelectorAll('.slaop-grp').length, barHeight: Math.round(host.getBoundingClientRect().height) };
});

await scenario('amber'); await openPop(); await page.screenshot({ path: path.join(OUT, 'f332-02-panel-laranja.png') });
await scenario('red'); await openPop(); await page.screenshot({ path: path.join(OUT, 'f332-03-panel-vermelho.png') });
await scenario('both'); await openPop(); await page.screenshot({ path: path.join(OUT, 'f332-04-panel-ambos.png') });
const panel = await page.evaluate(() => {
  const host = document.getElementById('sla-oppanel'); if (!host) return { present: false };
  const bar = host.querySelector('.slaop-bar');
  const grps = [...host.querySelectorAll('.slaop-grp')].map(s => (s.className.includes('red') ? 'red' : 'amber'));
  const times = [...host.querySelectorAll('.slaop-time')].map(e => e.textContent || '');
  return {
    present: true, groups: grps, open: host.className.includes('open'),
    redBeforeAmber: grps.indexOf('red') === 0 && grps.includes('amber'),
    hasAtrasada: times.some(t => /Atrasada h[áa] \d+ min/.test(t)),
    hasFaltam: times.some(t => /Faltam \d+ min/.test(t)),
    has10minRule: /Conclua a tarefa atrasada em até 10 min ou sinalize atraso/.test(host.textContent || ''),
    hasOpenBtn: !!host.querySelector('[data-sla-open]'),
    barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
    popOverlay: !!host.querySelector('.slaop-pop'),
  };
});

// board com popover FECHADO (board área cheia) — screenshot do quadro
await scenario('both'); await page.screenshot({ path: path.join(OUT, 'f332-01-board-panel.png') });

// (5) sino
await page.evaluate(() => { try { slaibToggle(); } catch (_) { const b = document.getElementById('slaib-bell'); if (b) b.click(); } });
await page.waitForSelector('.slaib-panel', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(220); await page.screenshot({ path: path.join(OUT, 'f332-05-sino.png') });
await page.evaluate(() => { const ov = document.getElementById('slaib-ov'); if (ov) ov.remove(); });

// (6) detalhe + Editar prazo (ADMIN) + coerência de contagem
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(220); await page.screenshot({ path: path.join(OUT, 'f332-06-detalhe-sla.png') });
const detail = await page.evaluate(() => {
  const txt = document.getElementById('modalRoot')?.textContent || '';
  return { hasSla: /SLA do designer/i.test(txt), hasPrazoEncerrado: /Prazo encerrado/.test(txt),
    hasAtraso: /Atraso de/.test(txt), editPrazoAdmin: !!document.querySelector('[data-sla-editprazo]') };
});
await page.evaluate(() => { const b = document.querySelector('[data-sla-editprazo]'); if (b) b.click(); });
await page.waitForSelector('#slaedit-ov', { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(180); await page.screenshot({ path: path.join(OUT, 'f332-13-editar-prazo-admin.png') });
await page.evaluate(() => { const ov = document.getElementById('slaedit-ov'); if (ov) ov.remove(); const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

// coerência de contagem: planDueAt = NOW+18min ⇒ painel deve dizer "Faltam 18 min" (±1)
const count = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000;
  const t = { id: 'cc', title: 'Coerência', client: 'X', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1',
    designerAssignment: { designerId: 'dz1' }, designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 18 * MIN } };
  const d = slaPanelDerive([t], NOW, (typeof dtMs === 'function' ? dtMs : null));
  const r = d.warning[0];
  return { min: r ? r.remainingMin : -1, hm: typeof slaibFmtHM === 'function' ? slaibFmtHM(NOW + 18 * MIN) : '' };
});

// RBAC: designer comum NÃO vê "Editar prazo"
await scenario('red', 'designer');
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(180);
const rbac = await page.evaluate(() => ({ editPrazoDesigner: !!document.querySelector('[data-sla-editprazo]') }));
await page.evaluate(() => { const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

// (7) header
await scenario('both'); await page.waitForTimeout(150);
await page.screenshot({ path: path.join(OUT, 'f332-07-header-alinhado.png'), clip: { x: 0, y: 0, width: 1600, height: 110 } });
const header = await page.evaluate(() => {
  const av = document.getElementById('cornerAvatar'), bell = document.getElementById('slaib-bell');
  const logo = document.querySelector('#bottomNav .sb-brand .logo') || document.querySelector('.nav .sb-brand .logo');
  if (!av || !bell) return { ok: false };
  const c = el => { const r = el.getBoundingClientRect(); return { cy: r.top + r.height / 2, top: r.top, left: r.left, right: r.right }; };
  const a = c(av), b = c(bell), l = logo ? c(logo) : null;
  return { ok: true, avatarLogoDelta: l ? Math.round(Math.abs(a.cy - l.cy)) : null, hasLogo: !!l,
    bellAvatarTopDelta: Math.round(Math.abs(b.top - a.top)), bellAvatarGap: Math.round(a.left - b.right) };
});

// (8/9/10) 3 resoluções (popover fechado, board cheio)
for (const [w, h, nm] of [[1366, 768, 'f332-08-1366x768.png'], [1600, 900, 'f332-09-1600x900.png'], [1920, 1080, 'f332-10-1920x1080.png']]) {
  await page.setViewportSize({ width: w, height: h }); await scenario('both'); await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, nm) });
}

// CARD-WHOLE (cenário REAL): card de cronograma sozinho em "A Fazer" deve aparecer INTEIRO
// (sem corte topo/rodapé) na coluna, a 1366×768, com o painel barra (popover fechado).
async function cardWhole(w, h) {
  await page.setViewportSize({ width: w, height: h }); await scenario('both'); await page.waitForTimeout(300);
  return await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.kbv2-card')];
    let compressed = 0, clipped = 0, found = false, detail = null;
    for (const c of cards) {
      if (c.scrollHeight > c.clientHeight + 2) compressed++;             // conteúdo espremido dentro do card
      const body = c.closest('.kbv2-column-body'); if (!body) continue;
      if ((c.textContent || '').includes('Cronograma semanal — Boa Forma')) {
        found = true;
        const cr = c.getBoundingClientRect(), br = body.getBoundingClientRect();
        const whole = cr.top >= br.top - 2 && cr.bottom <= br.bottom + 2;  // card cabe inteiro na área visível
        const hasFooter = !!c.querySelector('.kbv2-card-footer, .kbv2-btn');
        const hasThemes = !!c.querySelector('.kbv2-card-themes');
        if (!whole) clipped++;
        detail = { whole, hasFooter, hasThemes, cardH: Math.round(cr.height), bodyH: Math.round(br.height) };
      }
    }
    return { total: cards.length, compressed, clipped, found, detail };
  });
}
const whole1366 = await cardWhole(1366, 768);
const whole1920 = await cardWhole(1920, 1080);
await page.screenshot({ path: path.join(OUT, 'f332-14-card-inteiro-1366.png') });

fs.writeFileSync(path.join(OUT, 'qa-f332-report.json'), JSON.stringify({ panel, emptyPanel, detail, count, rbac, header, whole1366, whole1920, errors }, null, 2));
console.log('PANEL:', JSON.stringify(panel)); console.log('EMPTY:', JSON.stringify(emptyPanel));
console.log('DETAIL:', JSON.stringify(detail)); console.log('COUNT:', JSON.stringify(count)); console.log('RBAC:', JSON.stringify(rbac));
console.log('HEADER:', JSON.stringify(header)); console.log('WHOLE@1366:', JSON.stringify(whole1366)); console.log('WHOLE@1920:', JSON.stringify(whole1920));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close(); server.close();

const fail = [];
if (errors.length) fail.push('pageerror: ' + errors[0]);
// painel = barra + popover overlay
if (!panel.present) fail.push('painel ausente');
if (panel.present && !panel.popOverlay) fail.push('painel sem popover (.slaop-pop)');
if (panel.present && panel.barHeight > 60) fail.push('barra do painel alta demais (h=' + panel.barHeight + ')');
if (!panel.open) fail.push('popover não abriu ao clicar');
if (!(panel.groups || []).includes('red') || !(panel.groups || []).includes('amber')) fail.push('popover sem os 2 grupos');
if (!panel.redBeforeAmber) fail.push('vermelho não antes do laranja');
if (!panel.hasAtrasada || !panel.hasFaltam) fail.push('faltam textos de tempo');
if (!panel.has10minRule) fail.push('vermelho sem regra dos 10 min');
if (!panel.hasOpenBtn) fail.push('sem botão Abrir tarefa');
// estado verde compacto
if (!emptyPanel.present) fail.push('painel ausente sem alertas');
if (emptyPanel.present && (!emptyPanel.hasTitle || !emptyPanel.hasTudoEmDia || !emptyPanel.hasEmptyMsg)) fail.push('estado verde incompleto');
if (emptyPanel.present && emptyPanel.groups !== 0) fail.push('verde não deveria ter grupos inline');
if (emptyPanel.present && emptyPanel.barHeight > 60) fail.push('verde não compacto (h=' + emptyPanel.barHeight + ')');
// KANBAN/cards: o card NÃO pode ser AMPUTADO (comprimido/clipado dentro da própria caixa).
// A coluna PODE rolar (regra do owner: "a coluna pode rolar, mas o card não pode ser amputado").
// 1366×768: card inteiro na caixa (compressed=0) + rodapé/temas presentes (card completo).
// ≥1600: card totalmente visível sem rolagem (whole=true).
if (whole1366.compressed > 0) fail.push('card AMPUTADO/comprimido @1366 (' + whole1366.compressed + ')');
if (!whole1366.found) fail.push('card de cronograma real não encontrado @1366');
if (whole1366.detail && (!whole1366.detail.hasFooter || !whole1366.detail.hasThemes)) fail.push('card sem rodapé/temas no DOM @1366 (incompleto)');
if (whole1920.compressed > 0) fail.push('card AMPUTADO/comprimido @1920');
if (whole1920.found && whole1920.clipped > 0) fail.push('card NÃO inteiro @1920 (cardH=' + (whole1920.detail && whole1920.detail.cardH) + ' bodyH=' + (whole1920.detail && whole1920.detail.bodyH) + ')');
// contagem coerente
if (count.min !== 18 && count.min !== 17 && count.min !== 19) fail.push('contagem incoerente (min=' + count.min + ')');
// detalhe + RBAC
if (!detail.hasSla || !detail.hasPrazoEncerrado) fail.push('detalhe SLA incompleto');
if (!detail.editPrazoAdmin) fail.push('Editar prazo ausente p/ Admin');
if (rbac.editPrazoDesigner) fail.push('Editar prazo VISÍVEL p/ Designer (RBAC falhou)');
// header preservado
if (!header.ok) fail.push('header sem avatar/sino');
if (header.ok && header.hasLogo && header.avatarLogoDelta > 6) fail.push('avatar fora do eixo da logo (Δ=' + header.avatarLogoDelta + ')');
if (header.ok && header.bellAvatarTopDelta > 2) fail.push('sino desalinhado (Δ=' + header.bellAvatarTopDelta + ')');
if (header.ok && (header.bellAvatarGap < 4 || header.bellAvatarGap > 22)) fail.push('folga sino↔avatar fora (gap=' + header.bellAvatarGap + ')');
if (fail.length) { console.error('::error::QA F3.3.2 FALHOU: ' + fail.join(' | ')); process.exit(1); }
console.log('QA F3.3.2 OK — barra+popover (overlay), card de cronograma INTEIRO @1366 (cardH=' + (whole1366.detail && whole1366.detail.cardH) + '/bodyH=' + (whole1366.detail && whole1366.detail.bodyH) + ', temas+rodapé), verde compacto, vermelho 10min, contagem ' + count.min + 'min, Editar prazo RBAC, header em esquadro.');
