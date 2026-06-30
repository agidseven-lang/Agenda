/* =====================================================================
 * F3.3.17-R2 — QA comportamental (read-only) da âncora de conta + logout + gate de overlays.
 * Playwright/Chromium headless; carrega o renderer REAL (viewport 1440 → isDesktop()=true).
 * Prova, no DOM real:
 *   - Desktop logado: .sb-user (conta/perfil/logout) visível em Hoje e em Quadros;
 *   - Hoje/Quadros: SEM overlays operacionais (#cornerAvatar/#sla-monitor/#slaib-bell);
 *   - Kanban real: overlays operacionais PRESENTES e .sb-user TAMBÉM presente (F3.3.15 intacta);
 *   - Logout: limpa wp_uid + state.user, esconde #app e mostra #login (volta ao login);
 *   - Sem wp_uid, boot não auto-entra (gate de sessão).
 * NÃO grava no Firestore, NÃO faz deploy. Browser só roda na CI (local não tem chromium).
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-r2'); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { let f = (req.url || '/').split('?')[0]; if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, b) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
// F3.3.22-GAP-FIX (harness-only): usa um Chromium já instalado via CHROMIUM_BIN (ex.:
// /opt/pw-browsers/chromium-*/chrome-linux/chrome) sem download automático. Vazio = padrão Playwright.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.logout === 'function' && typeof window.isDesktop === 'function', { timeout: 25000 });

// estado logado (sem Firestore): injeta usuário + tarefa cronograma p/ o Kanban real
await page.evaluate(() => {
  try { localStorage.setItem('wp_uid', 'sm1'); localStorage.setItem('wp_name', 'Arydyjany'); } catch (_) {}
  state.user = { id: 'sm1', name: 'Arydyjany Carlôto', role: 'Social Media', admin: false, photo: '' };
  state.users = [state.user, { id: 'dz1', name: 'Miercohévisk', role: 'Designer' }];
  state.events = [];
  try { applyDesktopClass(); } catch (_) { document.body.classList.add('desktop'); }
  document.body.classList.add('authed');
  var lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  var ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  let cron = 'cronograma'; try { if (typeof SECTORS !== 'undefined') { const c = SECTORS.find(s => /cronog/i.test(s.key) || /cronog/i.test(s.label)); if (c) cron = c.key; } } catch (_) {}
  window.__cron = cron;
  state.tasks = [{ id: 't1', title: 'Post', client: 'Cliente A', sector: cron, by: 'sm1', status: 'afazer', designerAssignment: { designerId: 'dz1', designerName: 'Miercohévisk' }, assigneeId: 'dz1', designerFlowStatus: 'andamento' }];
});
const isDesktop = await page.evaluate(() => isDesktop());

const goto = async (mut, file) => {
  await page.evaluate((mut) => {
    state.form = null; state.clientView = null; state.boardSector = null; state.personBoard = null; state.roleBoards = false; state.flowView = null; state.designerBoard = null; state.socialBoard = null;
    state.tab = 'tarefas';
    if (mut === 'hoje') state.tab = 'hoje';
    else if (mut === 'quadros') { state.tab = 'tarefas'; }     // hub de quadros (sem board aberto)
    else if (mut === 'kanban') { state.tab = 'tarefas'; state.boardSector = window.__cron; }
    try { render(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
  }, mut);
  await page.waitForTimeout(260);
  if (file) await page.screenshot({ path: path.join(OUT, file) });
  return await page.evaluate(() => {
    var nav = document.getElementById('bottomNav');
    var su = nav && nav.querySelector('.sb-user');
    return {
      sbUser: !!su,
      sbUserName: su ? (su.querySelector('.su-n') ? su.querySelector('.su-n').textContent.trim() : '') : '',
      sbUserRole: su ? (su.querySelector('.su-r') ? su.querySelector('.su-r').textContent.trim() : '') : '',
      sbUserToPerfil: !!(su && su.getAttribute('data-tab') === 'perfil'),
      cornerAvatar: !!document.getElementById('cornerAvatar'),
      slaMonitor: !!document.getElementById('sla-monitor'),
      bell: !!document.getElementById('slaib-bell'),
      opCtx: (typeof isOperationalBoardContext === 'function') ? isOperationalBoardContext() : null,
    };
  });
};

const report = { isDesktop, hoje: null, quadros: null, kanban: null, logout: null, errors: [] };
report.hoje = await goto('hoje', 'r2-hoje.png');
report.quadros = await goto('quadros', 'r2-quadros.png');
report.kanban = await goto('kanban', 'r2-kanban.png');

// LOGOUT: limpa sessão e volta ao login
report.logout = await page.evaluate(() => {
  try { logout(); } catch (e) { return { error: String(e) }; }
  return {
    wpUid: (function(){ try { return localStorage.getItem('wp_uid'); } catch (_) { return 'ERR'; } })(),
    stateUserNull: state.user == null,
    loginVisible: !document.getElementById('login').classList.contains('hidden'),
    appHidden: document.getElementById('app').style.display === 'none',
  };
});
await page.screenshot({ path: path.join(OUT, 'r2-logout.png') });

report.errors = errors;
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

let fail = [];
if (!report.isDesktop) fail.push('isDesktop() falso no viewport 1440 (esperado true)');
// 1) .sb-user visível e correto em Hoje e Quadros
for (const k of ['hoje', 'quadros', 'kanban']) {
  const r = report[k];
  if (!r.sbUser) fail.push(`${k}: .sb-user ausente`);
  if (!r.sbUserToPerfil) fail.push(`${k}: .sb-user não abre Perfil (data-tab)`);
  if (r.sbUser && !/Arydyjany/.test(r.sbUserName)) fail.push(`${k}: nome do usuário ausente no .sb-user`);
  if (r.sbUser && !/Social/.test(r.sbUserRole)) fail.push(`${k}: papel do usuário ausente no .sb-user`);
}
// 2) Hoje/Quadros SEM overlays operacionais
for (const k of ['hoje', 'quadros']) {
  const r = report[k];
  if (r.cornerAvatar || r.slaMonitor || r.bell) fail.push(`${k}: overlay operacional presente fora do Kanban (cornerAvatar=${r.cornerAvatar} monitor=${r.slaMonitor} bell=${r.bell})`);
}
// 3) Kanban real: overlays presentes (F3.3.15) + .sb-user presente
if (report.kanban.opCtx !== true) fail.push('kanban: isOperationalBoardContext()!=true (setup do Kanban real falhou)');
if (report.kanban.opCtx === true && !report.kanban.cornerAvatar) fail.push('kanban: cornerAvatar ausente no Kanban real (F3.3.15 regrediu)');
// 4) Logout
const lo = report.logout || {};
if (lo.wpUid != null) fail.push('logout: wp_uid não foi limpo');
if (!lo.stateUserNull) fail.push('logout: state.user não foi zerado');
if (!lo.loginVisible) fail.push('logout: tela de login não reapareceu');
if (!lo.appHidden) fail.push('logout: #app não foi escondido');

console.log('==== F3.3.17-R2 ACCOUNT/LOGOUT/OVERLAY QA ====');
console.log(JSON.stringify(report, null, 2));
if (fail.length) { console.error('::error:: F3.3.17-R2 QA falhou: ' + fail.join(' | ')); process.exit(1); }
console.log('OK — .sb-user (conta/perfil/logout) visível em Hoje/Quadros/Kanban; overlays operacionais só no Kanban; logout limpa sessão e volta ao login.');
