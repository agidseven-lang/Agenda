/* =====================================================================
 * F3.3.17-R3 — QA VISUAL do bloco global de conta (.sb-user) na sidebar Desktop.
 * Playwright/Chromium headless; carrega o renderer REAL com NOME LONGO e mede o bloco
 * em 1366x768, 1350x689 e 1920x1080, nas telas Hoje/Quadros/Kanban/Perfil. Prova:
 *   - .sb-user premium: altura ≥ 2 linhas, nome/cargo legíveis (não esmagados),
 *     posicionado ACIMA do card de versão com respiro (sem sobrepor), Perfil clicável;
 *   - overlays operacionais (cornerAvatar/Monitor/sino) só no Kanban real (F3.3.15);
 *   - screenshots por tela/viewport. Read-only; NÃO grava; NÃO deploy. Browser só na CI.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-r3'); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { let f = (req.url || '/').split('?')[0]; if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, b) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();
const LONG_NAME = 'Miercohévisk Niheb Ferreira Nascimento Carlôto';
const VPS = [{ w: 1366, h: 768 }, { w: 1350, h: 689 }, { w: 1920, h: 1080 }];
const report = { viewports: [], errors: [] };
const fail = [];

for (const vp of VPS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.errors.push(vp.w + 'x' + vp.h + ': ' + String(e)));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.render === 'function' && typeof window.isDesktop === 'function', { timeout: 25000 });
  await page.evaluate((name) => {
    state.user = { id: 'u1', name: name, role: 'CEO', admin: true, photo: '' };
    state.users = [state.user, { id: 'dz1', name: 'Designer Um', role: 'Designer' }];
    state.events = [];
    try { applyDesktopClass(); } catch (_) { document.body.classList.add('desktop'); }
    document.body.classList.add('authed');
    var lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
    var ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
    let cron = 'cronograma'; try { if (typeof SECTORS !== 'undefined') { const c = SECTORS.find(s => /cronog/i.test(s.key) || /cronog/i.test(s.label)); if (c) cron = c.key; } } catch (_) {}
    window.__cron = cron;
    state.tasks = [{ id: 't1', title: 'Post', client: 'Cliente A', sector: cron, by: 'u1', status: 'afazer', designerAssignment: { designerId: 'dz1', designerName: 'Designer Um' }, assigneeId: 'dz1', designerFlowStatus: 'andamento' }];
  }, LONG_NAME);

  const measure = async (screen) => {
    await page.evaluate((screen) => {
      state.form = null; state.clientView = null; state.boardSector = null; state.personBoard = null; state.roleBoards = false; state.flowView = null; state.designerBoard = null; state.socialBoard = null;
      state.tab = 'tarefas';
      if (screen === 'hoje') state.tab = 'hoje';
      else if (screen === 'kanban') { state.tab = 'tarefas'; state.boardSector = window.__cron; }
      else if (screen === 'perfil') state.tab = 'perfil';
      try { render(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
    }, screen);
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(OUT, `r3-${vp.w}x${vp.h}-${screen}.png`) });
    return await page.evaluate(() => {
      var nav = document.getElementById('bottomNav'); var su = nav && nav.querySelector('.sb-user'); var ft = nav && nav.querySelector('.sb-footer');
      if (!su) return { sb: false };
      var r = su.getBoundingClientRect(); var n = su.querySelector('.su-n'); var rl = su.querySelector('.su-r'); var av = su.querySelector('.av'); var fr = ft ? ft.getBoundingClientRect() : null; var cs = getComputedStyle(su);
      return {
        sb: true, height: Math.round(r.height),
        nName: n ? n.textContent.trim() : '', nW: n ? Math.round(n.getBoundingClientRect().width) : 0,
        rRole: rl ? rl.textContent.trim() : '', rW: rl ? Math.round(rl.getBoundingClientRect().width) : 0,
        avW: av ? Math.round(av.getBoundingClientRect().width) : 0,
        toPerfil: su.getAttribute('data-tab') === 'perfil',
        gapToFooter: fr ? Math.round(fr.top - r.bottom) : null,
        overlapFooter: fr ? (r.bottom > fr.top + 1) : false,
        radius: cs.borderTopLeftRadius, hasBorder: cs.borderTopWidth !== '0px',
        cornerAvatar: !!document.getElementById('cornerAvatar'),
      };
    });
  };

  const hoje = await measure('hoje'); const quadros = await measure('quadros'); const kanban = await measure('kanban'); const perfil = await measure('perfil');
  const v = { vp: vp.w + 'x' + vp.h, hoje, quadros, kanban, perfil };
  report.viewports.push(v);
  for (const [scr, m] of [['hoje', hoje], ['quadros', quadros], ['kanban', kanban], ['perfil', perfil]]) {
    if (!m.sb) { fail.push(`${v.vp}/${scr}: .sb-user ausente`); continue; }
    if (m.height < 50) fail.push(`${v.vp}/${scr}: .sb-user baixo demais (${m.height}px)`);
    if (m.nW < 60) fail.push(`${v.vp}/${scr}: nome esmagado (${m.nW}px)`);
    if (m.rW < 40) fail.push(`${v.vp}/${scr}: cargo esmagado/sumindo (${m.rW}px)`);
    if (m.overlapFooter) fail.push(`${v.vp}/${scr}: .sb-user sobrepõe o card de versão`);
    if (m.gapToFooter != null && (m.gapToFooter < 6 || m.gapToFooter > 30)) fail.push(`${v.vp}/${scr}: respiro até versão fora de 6-30px (${m.gapToFooter})`);
    if (!m.toPerfil) fail.push(`${v.vp}/${scr}: .sb-user não abre Perfil`);
  }
  if (hoje.cornerAvatar || quadros.cornerAvatar) fail.push(`${v.vp}: overlay operacional FORA do Kanban`);
  if (!kanban.cornerAvatar) fail.push(`${v.vp}: cornerAvatar ausente no Kanban (F3.3.15 regrediu)`);
  await page.close();
}
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('==== F3.3.17-R3 .sb-user VISUAL QA ====');
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) console.log('pageerrors:', report.errors.slice(0, 5));
if (fail.length) { console.error('::error:: R3 visual falhou: ' + fail.join(' | ')); process.exit(1); }
console.log('OK — .sb-user premium: nome/cargo legíveis (não esmagados), acima do card de versão com respiro, sem sobrepor, Perfil clicável; overlays só no Kanban; em 1366/1350/1920.');
