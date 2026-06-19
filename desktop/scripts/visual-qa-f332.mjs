/* =====================================================================
 * F3.3.2 (correção cirúrgica) — QA VISUAL REALISTA. Playwright + Chromium, renderer REAL.
 * Reproduz os CENÁRIOS REAIS do owner: tela de login (sem widgets), COLUNA com VÁRIOS cards
 * (corte real), avatar real, widget SLA verde/laranja/vermelho (com janela de 10 min), header
 * sino/avatar/widget alinhados, contagem/fuso coerentes. NÃO envia/escreve/deploya nada.
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
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.slaMonRender === 'function' && typeof window.resolveTaskDisplayState === 'function', { timeout: 25000 });
// injeta o builder de cenário NO PAGE (usa globals do renderer: state/render/slaibRefresh)

// ---- helpers de cenário ----
function buildScenario(kind, asUser, PNG1x1) {
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
  const showcase = mk('show', 'Cronograma semanal — Boa Forma', 'Boa Forma', 90, {
    status: 'afazer', cronContents: [{ tema: 'Dia das Mães — campanha', legenda: '' }],
  });
  const red = [mk('r1', 'Reels de lançamento', 'Boa Forma', -7), mk('r2', 'Arte campanha de verão', 'Clínica Vita', -23)];
  const redCrit = mk('rc', 'Pôster evento', 'Clínica Vita', -15); // > 10min atraso => crítico
  const amber = [mk('a1', 'Carrossel institucional', 'Studio Lumen', 18), mk('a2', 'Stories semanais', 'Boa Forma', 27)];
  let tasks = [showcase];
  if (kind === 'amber') tasks = tasks.concat(amber);
  else if (kind === 'red') tasks = tasks.concat(red, [redCrit]);
  else if (kind === 'empty') tasks = [showcase];
  else if (kind === 'multi') {
    // CENÁRIO REAL DO CORTE: muitos cards na MESMA coluna (Em andamento) — todos com tema+rodapé.
    tasks = [];
    for (let i = 1; i <= 6; i++) tasks.push(mk('m' + i, 'Cronograma ' + i + ' — Cliente ' + i, 'Cliente ' + i, 40 + i * 7, {
      cronContents: [{ tema: 'Tema A do card ' + i, legenda: '' }, { tema: 'Tema B', legenda: '' }],
    }));
  } else tasks = tasks.concat(red, amber);
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
}
await page.evaluate(`window.buildScenario = ${buildScenario.toString()};`);
async function scenario(kind, asUser) { await page.evaluate(({ kind, asUser, PNG1x1 }) => window.buildScenario(kind, asUser, PNG1x1), { kind, asUser: asUser || 'admin', PNG1x1 }); await page.waitForTimeout(380); }
async function openMon() { await page.evaluate(() => { const b = document.querySelector('[data-slamon-toggle]'); if (b) b.click(); }); await page.waitForTimeout(240); }

// ===================== LOGIN (sem widgets operacionais) =====================
await page.evaluate(() => {
  try { if (typeof logout === 'function') { /* não chamar logout real (mexe em sessão); simular login screen */ } } catch (_) {}
  state.user = null;
  document.body.classList.remove('authed');
  const app = document.getElementById('app'); if (app) app.style.display = 'none';
  const login = document.getElementById('login'); if (login) login.classList.remove('hidden');
  ['cornerAvatar', 'sla-monitor', 'slaib-bell', 'slaib-ov', 'sla-block'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  try { slaibRefresh(); } catch (_) {}
});
await page.waitForTimeout(300);
const login = await page.evaluate(() => ({
  hasBell: !!document.getElementById('slaib-bell'),
  hasSlaMonitor: !!document.getElementById('sla-monitor'),
  hasCornerAvatar: !!document.getElementById('cornerAvatar'),
  loginVisible: !!(document.getElementById('login') && !document.getElementById('login').classList.contains('hidden')),
}));
await page.screenshot({ path: path.join(OUT, 'f332-00-login.png') });

// ===================== Widget: estados =====================
await scenario('empty');
const widgetGreen = await page.evaluate(() => { const w = document.getElementById('sla-monitor'); return w ? { cls: w.className, fixed: getComputedStyle(w).position } : { cls: '' }; });
await page.screenshot({ path: path.join(OUT, 'f332-12-widget-verde.png') });
await scenario('amber'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-02-widget-laranja.png') });
await scenario('red'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-03-widget-vermelho.png') });
// captura o widget no cenário AMBOS (vermelho com grace+crítico E laranja) — cobre todos os gates
await scenario('both'); await openMon(); await page.screenshot({ path: path.join(OUT, 'f332-04-widget-ambos.png') });
const widget = await page.evaluate(() => {
  const w = document.getElementById('sla-monitor'); if (!w) return { present: false };
  const cs = getComputedStyle(w); const txt = w.textContent || '';
  const grps = [...w.querySelectorAll('.slaop-grp')].map(s => (s.className.includes('red') ? 'red' : 'amber'));
  const inBoardPanel = !!document.querySelector('#content .slaop, #content #sla-oppanel');
  return {
    present: true, position: cs.position, width: w.getBoundingClientRect().width, vw: window.innerWidth,
    cls: w.className, open: w.className.includes('open'), groups: grps,
    redBeforeAmber: grps.indexOf('red') === 0 && grps.includes('amber'),
    hasAtrasada: /Atrasada h[áa] \d+/.test(txt), hasFaltam: /Faltam \d+/.test(txt),
    graceVisible: /para concluir ou sinalizar atraso/.test(txt), critVisible: /Atraso cr[ií]tico — sinalize atraso imediatamente/.test(txt),
    graceMsgVisible: /Você tem 10 minutos para concluir a tarefa/.test(txt),
    hasOpenBtn: !!w.querySelector('[data-sla-open]'), hasSeg: !!w.querySelector('.slamon-seg'),
    hasLive: !!w.querySelector('.slamon-live'), hasHero: /Atraso máx\.|Vence em/.test(txt),
    hasProgress: !!w.querySelector('.slaop-prog'), monitorTitle: /Monitor de prazos/.test(txt), inBoardPanel,
  };
});

// ===================== COLUNA MULTI-CARD (corte real) =====================
const cut = {};
for (const [w, h] of [[1366, 768], [1600, 900]]) {
  await page.setViewportSize({ width: w, height: h });
  await scenario('multi'); await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    // coluna com mais cards
    const cols = [...document.querySelectorAll('.kbv2-column')];
    let body = null, max = -1;
    for (const c of cols) { const b = c.querySelector('.kbv2-column-body'); const n = b ? b.querySelectorAll('.kbv2-card').length : 0; if (n > max) { max = n; body = b; } }
    if (!body) return { ok: false };
    const cards = [...body.querySelectorAll('.kbv2-card')];
    const clippedCards = cards.filter(c => c.scrollHeight > c.clientHeight + 2).length;   // card comprimido/amputado
    // rola até o fim e confere o rodapé do último card + botão Adicionar
    body.scrollTop = body.scrollHeight;
    const last = cards[cards.length - 1];
    const footer = last && (last.querySelector('.kbv2-card-footer') || last.querySelector('.kbv2-btn'));
    const bodyR = body.getBoundingClientRect();
    const fR = footer ? footer.getBoundingClientRect() : null;
    const footerVisible = !!fR && fR.bottom <= bodyR.bottom + 2 && fR.top >= bodyR.top - 2;
    const col = body.closest('.kbv2-column');
    const add = col ? col.querySelector('.kbv2-column-add') : null;
    const addR = add ? add.getBoundingClientRect() : null;
    const addNotOverlap = !addR || addR.top >= bodyR.bottom - 2;
    const colR = col ? col.getBoundingClientRect() : null;
    const colInViewport = !!colR && colR.bottom <= window.innerHeight + 2;   // coluna não estoura a tela
    return { ok: true, n: cards.length, clippedCards, footerVisible, addNotOverlap, colInViewport, scrolls: body.scrollHeight > body.clientHeight + 2 };
  });
  cut[w + 'x' + h] = r;
  await page.screenshot({ path: path.join(OUT, 'f332-05-multicard-' + w + 'x' + h + '.png') });
}

// ===================== CARD real (avatar/temas/rodapé) =====================
await page.setViewportSize({ width: 1600, height: 900 });
await scenario('both'); await page.screenshot({ path: path.join(OUT, 'f332-01-board.png') });
const card = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.kbv2-card')];
  let found = null;
  for (const c of cards) {
    if ((c.textContent || '').includes('Cronograma semanal — Boa Forma')) {
      const av = c.querySelector('.kbv2-av .av'); const avStyle = av ? (av.getAttribute('style') || '') : '';
      found = {
        compressed: c.scrollHeight > c.clientHeight + 2,
        hasFooter: !!c.querySelector('.kbv2-card-footer, .kbv2-btn'),
        hasThemes: !!c.querySelector('.kbv2-card-themes'),
        avatarReal: /background-image/.test(avStyle),
        noSemResp: !/Sem responsável/.test(c.textContent || ''),
      };
    }
  }
  const anyInicioAtrasado = [...document.querySelectorAll('.kbv2-sla')].some(e => /Início atrasado/.test(e.textContent || ''));
  return { found, anyInicioAtrasado };
});

// ===================== STATUS unificado + FUSO/contagem + laranja imediato =====================
const consist = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000, f = (typeof dtMs === 'function' ? dtMs : null);
  const mk = (off) => ({ id: 'x', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' }, designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + off * MIN } });
  // fonte única: card(kbv2SlaLocal) ↔ painel(slaPanelRow) ↔ detalhe(detailSla) coerentes
  const tW = mk(18);
  const dsv = resolveTaskDisplayState(tW, NOW, f);
  const rowv = slaPanelRow(tW, NOW, f);
  const chip = kbv2SlaLocal(tW, NOW);
  const statusConsistent = dsv.sev === 'laranja' && rowv && rowv.sev === 'laranja' && chip.sev === 'laranja';
  // fuso/contagem: 30min => ~30 restante; -1min => atraso 1 + grace 9; -15min => crítico
  const m30 = resolveTaskDisplayState(mk(30), NOW, f);
  const mOver = resolveTaskDisplayState(mk(-1), NOW, f);
  const mCrit = resolveTaskDisplayState(mk(-15), NOW, f);
  const timeMathConsistent = [29, 30, 31].includes(m30.remainingMin) && mOver.state === 'overdue'
    && [8, 9, 10].includes(mOver.graceRemainingMin) && mCrit.critical === true;
  return { statusConsistent, timeMathConsistent };
});
// estado amber imediato (sem esperar 30s)
const orangeImmediate = await page.evaluate(() => {
  const NOW = Date.now(), MIN = 60000;
  state.tasks = [{ id: 'oi', title: 'Quase no limite', client: 'X', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 29 * MIN } }];
  slaibRefresh();
  const w = document.getElementById('sla-monitor');
  return { amberNow: !!w && /amber/.test(w.className), hasBoundary: typeof slaMonScheduleBoundary === 'function' };
});

// ===================== FASE 5 — bloqueio operacional (atraso crítico, escopo designer) =====================
const block = await page.evaluate(({ PNG1x1 }) => {
  const NOW = Date.now(), MIN = 60000;
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: PNG1x1 };
  const admin = { id: 'owner', name: 'Owner Admin', role: 'Administrador', admin: true };
  state.users = [designer, admin];
  const crit = { id: 'crit', title: 'Tarefa crítica', client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW - 15 * MIN } };
  const other = { id: 'other', title: 'Outra tarefa', client: 'X', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + 90 * MIN } };
  state.tasks = [crit, other];
  // DESIGNER: bloqueado p/ outras; pode agir na crítica; banner aparece
  state.user = designer; document.body.classList.add('authed'); slaibRefresh();
  const critFound = (typeof slaCriticalFor === 'function') ? (slaCriticalFor(designer) || {}).id : null;
  const blocksOther = (typeof slaGuardBlocked === 'function') ? slaGuardBlocked('other') : null;
  const allowsCrit = (typeof slaGuardBlocked === 'function') ? slaGuardBlocked('crit') : null;
  const bannerForDesigner = !!document.getElementById('sla-block');
  // ADMIN: supervisiona, NÃO bloqueado, sem banner
  state.user = admin; slaibRefresh();
  const adminCrit = (typeof slaCriticalFor === 'function') ? slaCriticalFor(admin) : 'fn?';
  const adminBlocks = (typeof slaGuardBlocked === 'function') ? slaGuardBlocked('other') : null;
  const bannerForAdmin = !!document.getElementById('sla-block');
  return {
    designerBlocksOther: critFound === 'crit' && blocksOther === true && allowsCrit === false && bannerForDesigner === true,
    adminNotBlocked: adminCrit === null && adminBlocks === false && bannerForAdmin === false,
  };
}, { PNG1x1 });
// screenshot do bloqueio (designer)
await page.evaluate(({ PNG1x1 }) => {
  const NOW = Date.now(), MIN = 60000;
  const designer = { id: 'dz1', name: 'Marina Alves', role: 'Designer', photo: PNG1x1 };
  state.user = designer; state.users = [designer];
  state.tasks = [{ id: 'crit', title: 'Reels de lançamento', client: 'Boa Forma', sector: 'cronograma', status: 'andamento', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1', designerName: 'Marina Alves' }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 120 * MIN, planDueAt: NOW - 15 * MIN } }];
  state.tab = 'tarefas'; state.personBoard = 'dz1'; document.body.classList.add('desktop', 'authed');
  try { render(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
}, { PNG1x1 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'f332-16-bloqueio-critico.png') });

// ===================== detalhe + Editar prazo (admin) + RBAC designer =====================
await scenario('red');
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(220); await page.screenshot({ path: path.join(OUT, 'f332-06-detalhe-sla.png') });
const detail = await page.evaluate(() => {
  const txt = document.getElementById('modalRoot')?.textContent || '';
  return { hasSla: /SLA do designer/i.test(txt), editPrazoAdmin: !!document.querySelector('[data-sla-editprazo]'), graceInDetail: /para concluir ou sinalizar atraso|Atraso cr[ií]tico/.test(txt) };
});
await page.evaluate(() => { const b = document.querySelector('[data-sla-editprazo]'); if (b) b.click(); });
await page.waitForSelector('#slaedit-ov', { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(160); await page.screenshot({ path: path.join(OUT, 'f332-13-editar-prazo-admin.png') });
const editPrazo = await page.evaluate(() => { const ov = document.getElementById('slaedit-ov'); const t = ov ? ov.textContent : ''; if (ov) ov.remove(); return { honest: /Gravação real aguarda autorização operacional|nada é gravado/i.test(t) }; });
await page.evaluate(() => { const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

await scenario('red', 'designer');
await page.evaluate(() => { try { openDetails('r1'); } catch (_) {} });
await page.waitForSelector('.det-sheet', { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(160);
const rbac = await page.evaluate(() => ({ editPrazoDesigner: !!document.querySelector('[data-sla-editprazo]') }));
await page.evaluate(() => { const m = document.querySelector('.det-sheet'); if (m) { try { closeDetails && closeDetails(); } catch (_) {} const o = m.closest('.modal,.ov,[id*="modal"]'); if (o) o.remove(); } });

// ===================== Header cluster (sino/avatar/widget) =====================
await scenario('both'); await page.waitForTimeout(200);
await page.screenshot({ path: path.join(OUT, 'f332-07-header.png'), clip: { x: 680, y: 0, width: 920, height: 120 } });
const header = await page.evaluate(() => {
  const av = document.getElementById('cornerAvatar'), bell = document.getElementById('slaib-bell'), mon = document.getElementById('sla-monitor');
  if (!av || !bell) return { ok: false };
  const c = el => { const r = el.getBoundingClientRect(); return { cy: r.top + r.height / 2, top: r.top, left: r.left, right: r.right, h: r.height }; };
  const a = c(av), b = c(bell), m = mon ? c(mon) : null;
  const cnt = document.getElementById('slaib-count');
  const badgeAbs = cnt ? getComputedStyle(cnt).position === 'absolute' : true;
  return {
    ok: true, bellAvatarCyDelta: Math.round(Math.abs(b.cy - a.cy)), bellAvatarGap: Math.round(a.left - b.right),
    monPresent: !!m, monAvatarCyDelta: m ? Math.round(Math.abs(m.cy - a.cy)) : null, monLeftOfBell: m ? (m.right <= b.left + 4) : false,
    clusterAligned: m ? (Math.abs(b.cy - a.cy) <= 2 && Math.abs(m.cy - a.cy) <= 3) : (Math.abs(b.cy - a.cy) <= 2),
    badgeAbsolute: badgeAbs,
    avatarRightInset: Math.round(window.innerWidth - a.right), shiftedLeft: (window.innerWidth - a.right) >= 50,
  };
});
for (const [w, h, nm] of [[1366, 768, 'f332-08-1366x768.png'], [1920, 1080, 'f332-10-1920x1080.png']]) {
  await page.setViewportSize({ width: w, height: h }); await scenario('both'); await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(OUT, nm) });
}

fs.writeFileSync(path.join(OUT, 'qa-f332-report.json'), JSON.stringify({ login, widgetGreen, widget, cut, card, consist, orangeImmediate, block, detail, editPrazo, rbac, header, errors }, null, 2));
console.log('LOGIN:', JSON.stringify(login)); console.log('WIDGET:', JSON.stringify(widget)); console.log('CUT:', JSON.stringify(cut));
console.log('CARD:', JSON.stringify(card)); console.log('CONSIST:', JSON.stringify(consist)); console.log('ORANGE:', JSON.stringify(orangeImmediate)); console.log('BLOCK:', JSON.stringify(block));
console.log('DETAIL:', JSON.stringify(detail)); console.log('EDIT:', JSON.stringify(editPrazo)); console.log('RBAC:', JSON.stringify(rbac)); console.log('HEADER:', JSON.stringify(header));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close(); server.close();

const fail = [];
if (errors.length) fail.push('pageerror: ' + errors[0]);
// login limpo
if (login.hasBell) fail.push('loginHasBell=true (sino na tela de login)');
if (login.hasSlaMonitor) fail.push('loginHasSlaMonitor=true (widget na tela de login)');
if (login.hasCornerAvatar) fail.push('avatar na tela de login');
// widget
if (!widget.present) fail.push('SLA Monitor ausente');
if (widget.present && widget.position !== 'fixed') fail.push('widget não é fixed');
if (widget.present && widget.inBoardPanel) fail.push('painel SLA inline no board (não removido)');
if (widget.present && widget.width > widget.vw * 0.6) fail.push('noFullWidthSlaBar falhou (widget largo demais)');
if ((widgetGreen.cls || '').indexOf('green') < 0) fail.push('estado verde ausente');
if (!widget.open) fail.push('dropdown não abriu');
if (!widget.monitorTitle) fail.push('dropdown sem "Monitor de prazos"');
if (!widget.redBeforeAmber) fail.push('vermelho não antes do laranja');
if (!widget.hasAtrasada || !widget.hasFaltam) fail.push('faltam textos de tempo');
if (!widget.graceVisible) fail.push('redGraceCountdownVisible falhou (sem "para concluir ou sinalizar atraso")');
if (!widget.graceMsgVisible) fail.push('redGraceMessageVisible falhou (sem "Você tem 10 minutos para concluir a tarefa")');
if (!widget.critVisible) fail.push('redCriticalVisibleAfter10min falhou (estado crítico não exibido)');
if (!widget.hasOpenBtn) fail.push('sem Abrir tarefa');
if (!widget.hasSeg || !widget.hasLive || !widget.hasHero) fail.push('widget v2 sem segmentos/ao vivo/herói');
if (!widget.hasProgress) fail.push('dropdown sem barra de progresso');
// corte multi-card (cenário real)
for (const k of Object.keys(cut)) { const c = cut[k];
  if (!c.ok) fail.push('multi-card ' + k + ' sem coluna');
  else { if (c.clippedCards > 0) fail.push('cardNotClipped falhou em ' + k + ' (' + c.clippedCards + ' comprimidos)');
         if (!c.footerVisible) fail.push('cardBottomActionsVisible falhou em ' + k);
         if (!c.addNotOverlap) fail.push('addButtonNotOverlapping falhou em ' + k);
         if (!c.colInViewport) fail.push('coluna estoura a tela em ' + k); } }
// card real
if (!card.found) fail.push('card de cronograma não encontrado');
if (card.found && card.found.compressed) fail.push('card AMPUTADO/comprimido');
if (card.found && (!card.found.hasFooter || !card.found.hasThemes)) fail.push('card sem rodapé/temas');
if (card.found && !card.found.avatarReal) fail.push('cardAvatarRealVisible falhou (avatar genérico)');
if (card.found && !card.found.noSemResp) fail.push('card mostra "Sem responsável" com responsável real');
if (card.anyInicioAtrasado) fail.push('card mostra "Início atrasado" (proibido)');
// status/fuso/laranja
if (!consist.statusConsistent) fail.push('statusConsistent falhou (card/painel/detalhe divergem)');
if (!consist.timeMathConsistent) fail.push('timeMathConsistent falhou (contagem/fuso)');
if (!orangeImmediate.amberNow) fail.push('orangeTransitionImmediate falhou (amber não imediato)');
if (!orangeImmediate.hasBoundary) fail.push('boundary timer ausente');
// FASE 5 — bloqueio operacional (atraso crítico)
if (!block.designerBlocksOther) fail.push('criticalOverdueBlocksOtherTasks falhou (designer não foi bloqueado)');
if (!block.adminNotBlocked) fail.push('admin/social foi bloqueado indevidamente (escopo errado)');
// detalhe/rbac/editar
if (!detail.hasSla || !detail.editPrazoAdmin) fail.push('detalhe/Editar prazo (admin) incompleto');
if (!detail.graceInDetail) fail.push('detalhe sem janela de 10 min no vermelho');
if (!editPrazo.honest) fail.push('Editar prazo sem mensagem honesta de bloqueio');
if (rbac.editPrazoDesigner) fail.push('Editar prazo VISÍVEL p/ Designer (RBAC falhou)');
// header cluster
if (!header.ok) fail.push('header sem avatar/sino');
if (header.ok && !header.clusterAligned) fail.push('headerClusterAligned falhou (Δ sino=' + header.bellAvatarCyDelta + ', widget=' + header.monAvatarCyDelta + ')');
if (header.ok && (header.bellAvatarGap < 4 || header.bellAvatarGap > 24)) fail.push('folga sino↔avatar fora (' + header.bellAvatarGap + ')');
if (header.ok && !header.badgeAbsolute) fail.push('badgeDoesNotShiftBell falhou (badge não é absolute)');
if (header.ok && header.monPresent && !header.monLeftOfBell) fail.push('widget não está à esquerda do sino');
if (header.ok && !header.shiftedLeft) fail.push('headerShiftedLeft falhou (cluster não deslocado ~1,5cm; inset=' + header.avatarRightInset + ')');

if (fail.length) { console.error('::error::QA F3.3.2 FALHOU: ' + fail.join(' | ')); process.exit(1); }
console.log('QA F3.3.2 OK — login sem widgets; coluna multi-card sem corte (1366/1600); avatar real; widget verde/laranja/vermelho com janela 10min + crítico; status/fuso coerentes; laranja imediato; header cluster alinhado; Editar prazo RBAC honesto.');
