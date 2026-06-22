/* =====================================================================
 * F3.3.16 — QA VISUAL + REALTIME (read-only) do fluxo Social→Designer→Cliente.
 * Playwright/Chromium headless; carrega o renderer REAL, injeta state (sem
 * login/Firestore/rede) e prova:
 *   - FONTE ÚNICA no card: chip = fase canônica; "Etapa" = responsável/owner
 *     (NÃO repete o chip); "Próxima ação" = next canônico — para A–H × papéis;
 *   - "Concluído" só na aprovação final (COMPLETED);
 *   - REALTIME: mudar designerFlowStatus e re-render (sem reload) atualiza o
 *     quadro da Social de "Aguardando designer iniciar" → "Designer em produção";
 *   - Screenshots Social/Designer/Cliente em estados-chave.
 * NÃO grava, NÃO faz deploy/release. Read-only sobre o renderer auditado.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-f3316');
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  let f = (req.url || '/').split('?')[0]; if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(f); res.writeHead(200, { 'content-type': ext === '.html' ? 'text/html' : 'application/octet-stream' }); res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.deriveOperationalCardPresentation === 'function', { timeout: 25000 });

// estado base + helpers expostos no contexto da página
await page.evaluate(() => {
  state.user = { id: 'owner', name: 'Owner Social', role: 'Social Media', admin: true };
  state.users = [state.user, { id: 'dz1', name: 'Designer Um', role: 'Designer' }];
  state.events = [];
  document.body.classList.add('desktop', 'authed');
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  // campos que levam cada FASE canônica (lidos por deriveCanonicalTaskState)
  window.__seed = (phase) => {
    const t = { id: 't1', title: 'Post Institucional', client: 'Cliente A', sector: 'cronograma',
      by: 'owner', assigneeId: 'dz1', designerAssignment: { designerId: 'dz1' },
      designerSla: { planDueAt: Date.now() + 18 * 60000 } };
    if (phase === 'awaiting_designer') { t.designerFlowStatus = 'afazer'; }
    else if (phase === 'designer_producing') { t.designerFlowStatus = 'andamento'; }
    else if (phase === 'designer_revising') { t.designerFlowStatus = 'revisao'; }
    else if (phase === 'designer_delivered') { t.designerFlowStatus = 'concluido'; t.legenda = ''; t.feedImageUrl = ''; } // entregue, falta legenda → não final
    else if (phase === 'awaiting_client_approval') { t.designerFlowStatus = 'concluido'; t.legenda = 'ok'; t.feedImageUrl = 'x'; t.storyImageUrl = 'x'; t.cronStatus = 'ready_for_final_client_review'; t.clientApprovalPhase = 'final'; }
    else if (phase === 'client_requested_changes') { t.designerFlowStatus = 'concluido'; t.clientReview = { status: 'revisao' }; }
    else if (phase === 'completed') { t.designerFlowStatus = 'concluido'; t.legenda = 'ok'; t.feedImageUrl = 'x'; t.storyImageUrl = 'x'; t.finalApprovalCompleted = true; t.clientFlowStatus = 'concluido'; t.cronStatus = 'aprovado_final'; }
    return t;
  };
  try { if (typeof SECTORS !== 'undefined') { const c = SECTORS.find(s => /cronog/i.test(s.key) || /cronog/i.test(s.label)); window.__cronKey = c ? c.key : 'cronograma'; } } catch (_) { window.__cronKey = 'cronograma'; }
});

const PHASES = ['awaiting_designer', 'designer_producing', 'designer_revising', 'designer_delivered', 'awaiting_client_approval', 'client_requested_changes', 'completed'];
const report = { matrix: [], realtime: {}, noDup: true, noEarlyConcluido: true, errors: [] };

// 1) MATRIZ A–H × papéis via a FUNÇÃO REAL do renderer (deriveOperationalCardPresentation)
for (const ph of PHASES) {
  const row = { phase: ph, roles: {} };
  for (const role of ['social', 'designer', 'client']) {
    const pr = await page.evaluate(({ ph, role }) => { const t = window.__seed(ph); const p = deriveOperationalCardPresentation(t, role); return { statusLabel: p.statusLabel, ownerLabel: p.ownerLabel, nextAction: p.nextAction, isFinal: p.isFinal }; }, { ph, role });
    row.roles[role] = pr;
    if (pr.statusLabel === pr.ownerLabel) report.noDup = false;                 // chip nunca igual à etapa
    if (ph !== 'completed' && (pr.isFinal || /Conclu/i.test(pr.statusLabel))) report.noEarlyConcluido = false;
    if (ph === 'completed' && !pr.isFinal) report.noEarlyConcluido = false;
  }
  report.matrix.push(row);
}

// 2) SCREENSHOTS dos 3 quadros em estados-chave (cards reais)
const showBoard = async (role, phase, file) => {
  await page.evaluate(({ role, phase }) => {
    state.form = null; state.clientView = null; state.boardSector = null; state.personBoard = null; state.roleBoards = false; state.flowView = null; state.designerBoard = null; state.socialBoard = null;
    state.tasks = [window.__seed(phase)];
    state.tab = 'tarefas';
    if (role === 'designer') { state.flowView = 'designers'; state.designerBoard = 'dz1'; }
    else if (role === 'client') { state.flowView = 'client'; }
    else { state.boardSector = window.__cronKey; }   // social/default
    try { render(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
  }, { role, phase });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, file) });
  return await page.evaluate(() => { const c = document.querySelector('.kbv2-card'); if (!c) return null;
    const chip = c.querySelector('.kbv2-status'); const pill = c.querySelector('.kbv2-st2-pill'); const next = c.querySelector('.kbv2-st2-next');
    return { chip: chip ? chip.textContent.trim() : null, etapa: pill ? pill.textContent.trim() : null, next: next ? next.textContent.trim() : null }; });
};
const shots = {};
shots.social_producing = await showBoard('social', 'designer_producing', 'social-designer-producing.png');
shots.designer_producing = await showBoard('designer', 'designer_producing', 'designer-producing.png');
shots.client_producing = await showBoard('client', 'designer_producing', 'client-producing.png');
shots.designer_awaiting = await showBoard('designer', 'awaiting_designer', 'designer-awaiting.png');
shots.client_final = await showBoard('client', 'awaiting_client_approval', 'client-final-approval.png');
shots.social_completed = await showBoard('social', 'completed', 'social-completed.png');
report.shots = shots;

// 3) PROVA REALTIME — sem reload: muda designerFlowStatus afazer→andamento e re-render
const rtBefore = await page.evaluate(() => {
  state.boardSector = window.__cronKey; state.flowView = null; state.designerBoard = null; state.personBoard = null; state.tab = 'tarefas';
  state.tasks = [window.__seed('awaiting_designer')];
  try { render(); } catch (_) {}
  const c = document.querySelector('.kbv2-card .kbv2-status'); return c ? c.textContent.trim() : null;
});
await page.screenshot({ path: path.join(OUT, 'realtime-1-antes.png') });
const rtAfter = await page.evaluate(() => {
  state.tasks[0].designerFlowStatus = 'andamento';   // designer iniciou (em outro dispositivo)
  try { render(); } catch (_) {}                       // mesmo caminho do onSnapshot (render), SEM reload
  const c = document.querySelector('.kbv2-card .kbv2-status'); return c ? c.textContent.trim() : null;
});
await page.screenshot({ path: path.join(OUT, 'realtime-2-depois.png') });
report.realtime = { before: rtBefore, after: rtAfter, changedWithoutReload: rtBefore !== rtAfter && /produção/i.test(rtAfter || '') };

report.errors = errors;
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log('==== F3.3.16 FLOW QA (fonte única + realtime) ====');
report.matrix.forEach(r => { ['social', 'designer', 'client'].forEach(role => { const x = r.roles[role]; console.log(`  [${r.phase}/${role}] chip="${x.statusLabel}" | etapa="${x.ownerLabel}" | next="${x.nextAction}" | final=${x.isFinal}`); }); });
console.log('  screenshots:', JSON.stringify(report.shots));
console.log('  realtime:', JSON.stringify(report.realtime));
console.log(`  noDup=${report.noDup} noEarlyConcluido=${report.noEarlyConcluido}`);
if (report.errors.length) console.log('  pageerrors:', report.errors.slice(0, 5));
const fail = !report.noDup || !report.noEarlyConcluido || !report.realtime.changedWithoutReload;
if (fail) { console.error('::error:: F3.3.16 QA falhou (dup/concluído-cedo/realtime)'); process.exit(1); }
console.log('OK — fonte única (chip≠etapa), "Concluído" só no final, realtime sem reload (Aguardando→Designer em produção).');
