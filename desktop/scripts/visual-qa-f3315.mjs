/* =====================================================================
 * F3.3.15 — QA VISUAL (read-only) do GATE REAL (BUG1) + ALINHAMENTO AO BLOCO
 * ESQUERDO (BUG2). Playwright + Chromium headless; state injetado (sem login/
 * Firestore/rede). Prova:
 *   BUG1 — Hoje LIMPO; tela "Quadros"/hub LIMPA (sem Monitor SLA/sino/avatar);
 *          Kanban real (Meu quadro, Designer) MOSTRA os 3 overlays; ao voltar
 *          do board para o hub, os overlays SOMEM (removidos da árvore).
 *   BUG2 — no Kanban real, o centro vertical do BLOCO DIREITO (Monitor+sino+
 *          avatar) bate com o do BLOCO ESQUERDO (.d-board-head) com Δ<=2px.
 * Screenshots em 1366x768, 1350x689, 1920x1080 + relatório JSON com:
 *   leftGroupCenterY, rightGroupCenterY, deltaGroupY, backButtonCenterY,
 *   leftAvatarCenterY, monitorCenterY, bellCenterY, rightAvatarCenterY.
 * NÃO faz login real, NÃO consulta Firestore, NÃO envia nada, NÃO deploy/release.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-f3315');
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
  const mk = (id, who, title, dueMin) => ({ id, title, client: 'Cliente', sector: 'cronograma', status: 'afazer', assigneeId: who, designerAssignment: { designerId: who }, designerFlowStatus: 'andamento', designerSla: { planStartAt: NOW - 60 * MIN, planDueAt: NOW + dueMin * MIN, startedAt: NOW - 50 * MIN } });
  state.tasks = [mk('t1', 'owner', 'Post Owner', 12), mk('t2', 'owner', 'Reels Owner', -7), mk('t3', 'dz1', 'Card DZ', 9), mk('t4', 'dz1', 'Banner DZ', -4)];
  document.body.classList.add('desktop', 'authed');
  const login = document.getElementById('login'); if (login) login.classList.add('hidden');
  const app = document.getElementById('app'); if (app) app.style.display = 'flex';
};
const GO = (screen) => {
  state.form = null; state.clientView = null;
  state.boardSector = null; state.personBoard = null; state.roleBoards = false;
  state.flowView = null; state.designerBoard = null; state.socialBoard = null;
  if (screen === 'hoje') state.tab = 'hoje';
  else if (screen === 'hub') state.tab = 'tarefas';
  else if (screen === 'meuquadro') { state.tab = 'tarefas'; state.personBoard = state.user.id; }
  else if (screen === 'designer') { state.tab = 'tarefas'; state.flowView = 'designers'; state.designerBoard = 'dz1'; }
  try { render(); } catch (_) {}
  try { slaibRefresh(); } catch (_) {}
};
const PROBE = () => {
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, centerY: r.top + r.height / 2 }; };
  const q = (sel) => rect(document.querySelector(sel));
  const id = (i) => rect(document.getElementById(i));
  const left = q('#content.board-mode .d-board-head');
  const back = q('#content.board-mode .d-board-head .iconbtn');
  const lav = q('#content.board-mode .d-board-head .d-bh-icon');
  const av = id('cornerAvatar'), bell = id('slaib-bell'), mon = id('sla-monitor');
  const present = { cornerAvatar: !!av, bell: !!bell, monitor: !!mon };
  const rs = [av, bell, mon].filter(Boolean);
  let rightGroupCenterY = null;
  if (rs.length) { const top = Math.min(...rs.map(r => r.top)); const bot = Math.max(...rs.map(r => r.bottom)); rightGroupCenterY = top + (bot - top) / 2; }
  const leftGroupCenterY = left ? left.centerY : null;
  const deltaGroupY = (leftGroupCenterY != null && rightGroupCenterY != null) ? Math.abs(leftGroupCenterY - rightGroupCenterY) : null;
  return {
    overlaysPresent: present,
    anyOverlay: !!(av || bell || mon),
    allOverlays: !!(av && bell && mon),
    leftGroupCenterY, rightGroupCenterY, deltaGroupY,
    backButtonCenterY: back ? back.centerY : null,
    leftAvatarCenterY: lav ? lav.centerY : null,
    monitorCenterY: mon ? mon.centerY : null,
    bellCenterY: bell ? bell.centerY : null,
    rightAvatarCenterY: av ? av.centerY : null,
  };
};

const VIEWPORTS = [{ w: 1366, h: 768 }, { w: 1350, h: 689 }, { w: 1920, h: 1080 }];
// F3.3.22-GAP-FIX (harness-only): usa um Chromium já instalado via CHROMIUM_BIN (ex.:
// /opt/pw-browsers/chromium-*/chrome-linux/chrome) sem download automático. Vazio = padrão Playwright.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined });
const report = { generatedAt: new Date().toISOString(), viewports: [], dashboardClean: true, hubClean: true, boardsHaveOverlays: true, headerAligned: true, transitionClean: true, maxDeltaGroupY: 0, errors: [] };

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => report.errors.push(`${vp.w}x${vp.h}: ${String(e)}`));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.render === 'function' && typeof window.slaibRefresh === 'function', { timeout: 25000 });
  await page.evaluate(SEED);
  const V = `${vp.w}x${vp.h}`; const rowsForVp = {};

  // 1) HOJE — limpo
  await page.evaluate(GO, 'hoje'); await page.waitForTimeout(450);
  const hoje = await page.evaluate(PROBE); if (hoje.anyOverlay) report.dashboardClean = false;
  await page.screenshot({ path: path.join(OUT, `hoje-${V}.png`) }); rowsForVp.hoje = hoje;

  // 2) QUADROS (hub) — limpo
  await page.evaluate(GO, 'hub'); await page.waitForTimeout(450);
  const hub = await page.evaluate(PROBE); if (hub.anyOverlay) report.hubClean = false;
  await page.screenshot({ path: path.join(OUT, `quadros-hub-${V}.png`) }); rowsForVp.hub = hub;

  // 3) MEU QUADRO — overlays + alinhado
  await page.evaluate(GO, 'meuquadro'); await page.waitForTimeout(600);
  const mine = await page.evaluate(PROBE);
  if (!mine.allOverlays) report.boardsHaveOverlays = false;
  if (mine.deltaGroupY == null || mine.deltaGroupY > 2) report.headerAligned = false;
  if (mine.deltaGroupY != null) report.maxDeltaGroupY = Math.max(report.maxDeltaGroupY, mine.deltaGroupY);
  await page.screenshot({ path: path.join(OUT, `meuquadro-${V}.png`) });
  await page.screenshot({ path: path.join(OUT, `meuquadro-top-${V}.png`), clip: { x: 0, y: 0, width: vp.w, height: 150 } });
  rowsForVp.meuquadro = mine;

  // 4) DESIGNER (Kanban real) — overlays + alinhado
  await page.evaluate(GO, 'designer'); await page.waitForTimeout(600);
  const dz = await page.evaluate(PROBE);
  if (!dz.allOverlays) report.boardsHaveOverlays = false;
  if (dz.deltaGroupY == null || dz.deltaGroupY > 2) report.headerAligned = false;
  if (dz.deltaGroupY != null) report.maxDeltaGroupY = Math.max(report.maxDeltaGroupY, dz.deltaGroupY);
  await page.screenshot({ path: path.join(OUT, `designer-${V}.png`) }); rowsForVp.designer = dz;

  // 5) TRANSIÇÃO board -> hub: overlays somem na hora
  await page.evaluate(GO, 'hub'); await page.waitForTimeout(450);
  const backHub = await page.evaluate(PROBE); if (backHub.anyOverlay) report.transitionClean = false;
  rowsForVp.transition_back_hub = backHub;

  report.viewports.push({ viewport: V, ...rowsForVp });
  await page.close();
}
await browser.close();
server.close();

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('==== F3.3.15 VISUAL QA (gate real + alinhamento ao bloco esquerdo) ====');
report.viewports.forEach(v => {
  console.log(`  [${v.viewport}] Hoje.overlay=${v.hoje.anyOverlay} | Hub.overlay=${v.hub.anyOverlay} | MeuQuadro.allOverlays=${v.meuquadro.allOverlays} ΔgrupoY=${v.meuquadro.deltaGroupY}px | Designer.allOverlays=${v.designer.allOverlays} ΔgrupoY=${v.designer.deltaGroupY}px | back→hub.overlay=${v.transition_back_hub.anyOverlay}`);
});
console.log(`  dashboardClean=${report.dashboardClean} hubClean=${report.hubClean} boardsHaveOverlays=${report.boardsHaveOverlays} headerAligned(Δ<=2)=${report.headerAligned} transitionClean=${report.transitionClean} ΔgrupoY_max=${Math.round(report.maxDeltaGroupY * 100) / 100}px`);
console.log('---- MEDIÇÃO POR ELEMENTO (Kanban real) ----');
report.viewports.forEach(v => {
  ['meuquadro', 'designer'].forEach(scr => {
    const m = v[scr];
    console.log(`  [${v.viewport}] ${scr}: leftGroupCenterY=${m.leftGroupCenterY} | rightGroupCenterY=${m.rightGroupCenterY} | deltaGroupY=${m.deltaGroupY} | backButtonCenterY=${m.backButtonCenterY} | leftAvatarCenterY=${m.leftAvatarCenterY} | monitorCenterY=${m.monitorCenterY} | bellCenterY=${m.bellCenterY} | rightAvatarCenterY=${m.rightAvatarCenterY}`);
  });
});
if (report.errors.length) console.log('  pageerrors:', report.errors.slice(0, 5));
const failGate = !report.dashboardClean || !report.hubClean || !report.boardsHaveOverlays || !report.headerAligned || !report.transitionClean;
if (failGate) { console.error('::error:: F3.3.15 visual QA falhou (ver flags acima)'); process.exit(1); }
console.log('OK — Hoje/Quadros limpos; overlays só no Kanban real; header alinhado ao bloco esquerdo (Δ<=2px); transição limpa.');
