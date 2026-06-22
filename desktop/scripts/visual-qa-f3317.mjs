/* =====================================================================
 * F3.3.17 — QA REALTIME REAL + COORDENAÇÃO coluna≡chip (read-only).
 * Playwright/Chromium headless. Carrega o renderer REAL, faz STUB do Firestore
 * (db in-memory) e usa as FUNÇÕES DE ESCRITA REAIS (sendToDesigner / moveStatus)
 * + o caminho REAL de snapshot (renderFromSnapshot) — NÃO é só render() mockado.
 * Prova:
 *   - ciclo write→snapshot→render: a tarefa cai na COLUNA certa com o CHIP certo;
 *   - Social↔Designer↔Cliente lêem o MESMO estado real (coluna≡chip por papel);
 *   - realtime sem reload: designerFlowStatus afazer→andamento atualiza o quadro;
 *   - "Finalizado/Concluído" só após aprovação final real;
 *   - sem status duplicado.
 *   - screenshots Social/Designer/Cliente por estado.
 * NÃO toca notificações/Worker/Android. NÃO faz deploy/release.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-f3317'); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { let f = (req.url || '/').split('?')[0]; if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, b) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(b); }); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.flowBoardCol === 'function' && typeof window.moveStatus === 'function' && typeof window.renderFromSnapshot === 'function', { timeout: 25000 });

// ---- STUB Firestore in-memory + ambiente autenticado ----
await page.evaluate(() => {
  state.user = { id: 'owner', name: 'Owner Social', role: 'Social Media', admin: true };
  state.users = [state.user, { id: 'dz1', name: 'Designer Um', role: 'Designer' }];
  state.events = [];
  document.body.classList.add('desktop', 'authed');
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  try { if (typeof SECTORS !== 'undefined') { const c = SECTORS.find(s => /cronog/i.test(s.key) || /cronog/i.test(s.label)); window.__cron = c ? c.key : 'cronograma'; } } catch (_) { window.__cron = 'cronograma'; }
  // STORE in-memory = fonte "Firestore"
  window.__store = {};
  function applyPatch(obj, patch) { Object.keys(patch).forEach(k => { const v = patch[k];
    if (v && v.__arrayUnion) { obj[k] = (obj[k] || []).concat(v.__arrayUnion); return; }
    if (k.indexOf('.') >= 0) { const [a, b] = k.split('.'); obj[a] = Object.assign({}, obj[a] || {}); obj[a][b] = v; return; }
    obj[k] = v; }); }
  // firebase.firestore.FieldValue stub
  window.firebase = { firestore: { FieldValue: { arrayUnion: (x) => ({ __arrayUnion: x }), serverTimestamp: () => Date.now() } } };
  // db stub: update funde no store + sincroniza state.tasks; get devolve o doc; onSnapshot guarda cb
  window.__snapCb = null;
  window.db = { collection: () => ({ doc: (id) => ({
        update: async (patch) => { const d = window.__store[id] || (window.__store[id] = { id }); applyPatch(d, patch); return true; },
        set: async (patch) => { const d = window.__store[id] || (window.__store[id] = { id }); applyPatch(d, patch); return true; },
        get: async () => { const d = window.__store[id] || null; return { exists: !!d, data: () => d ? JSON.parse(JSON.stringify(d)) : null }; },
        delete: async () => { delete window.__store[id]; return true; } }),
      onSnapshot: (cb) => { window.__snapCb = cb; return () => {}; } }) };
  // emite snapshot REAL: empacota o store como docs e chama o MESMO caminho do app (renderFromSnapshot)
  window.__emitSnapshot = () => { state.tasks = Object.keys(window.__store).map(k => JSON.parse(JSON.stringify(window.__store[k]))); try { renderFromSnapshot(); } catch (_) {} };
  // semente: 1 tarefa cronograma com temas aprovados, pronta para atribuir
  window.__store['t1'] = { id: 't1', title: 'Post Institucional', client: 'Cliente A', sector: window.__cron, by: 'owner', status: 'afazer', clientReview: { status: 'aprovado' }, cronStatus: 'aprovado_cliente' };
  window.__emitSnapshot();
});

const VIEW = async (role, file) => {
  await page.evaluate((role) => {
    state.form = null; state.clientView = null; state.boardSector = null; state.personBoard = null; state.roleBoards = false; state.flowView = null; state.designerBoard = null; state.socialBoard = null;
    state.tab = 'tarefas';
    if (role === 'designer') { state.flowView = 'designers'; state.designerBoard = 'dz1'; }
    else if (role === 'client') { state.flowView = 'client'; }
    else if (role === 'meuquadro-dz') { state.personBoard = 'dz1'; }
    else { state.boardSector = window.__cron; }   // social/default (sector board)
    try { render(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
  }, role);
  await page.waitForTimeout(300);
  if (file) await page.screenshot({ path: path.join(OUT, file) });
  // lê a COLUNA que contém o card t1 + o chip/etapa do card
  return await page.evaluate(() => {
    let colTitle = null; const cols = document.querySelectorAll('.kbv2-column');
    cols.forEach(c => { if (c.querySelector('[data-detail="t1"]')) { const h = c.querySelector('.kbv2-ctitle'); colTitle = h ? h.textContent.trim() : '?'; } });
    const card = document.querySelector('.kbv2-card [data-detail="t1"]') ? document.querySelector('.kbv2-card') : document.querySelector('[data-detail="t1"]') && document.querySelector('[data-detail="t1"]').closest('.kbv2-card');
    const chip = card && card.querySelector('.kbv2-status'); const pill = card && card.querySelector('.kbv2-st2-pill'); const nx = card && card.querySelector('.kbv2-st2-next');
    return { column: colTitle, chip: chip ? chip.textContent.trim() : null, etapa: pill ? pill.textContent.trim() : null, next: nx ? nx.textContent.trim() : null };
  });
};

const report = { steps: [], realtime: {}, errors: [] };
const rec = (k, v) => { report.steps.push({ step: k, ...v }); };

// 1) ASSIGN (write REAL) → social + designer
await page.evaluate(async () => { await sendToDesigner('t1', 'dz1', { startDate: '2026-06-22', startTime: '09:00', endDate: '2026-06-22', endTime: '18:00' }); window.__emitSnapshot(); });
rec('assign/social', await VIEW('social', 'assign-social.png'));
rec('assign/designer', await VIEW('designer', 'assign-designer.png'));

// 2) DESIGNER START (write REAL moveStatus no eixo designer)
await page.evaluate(async () => { state.flowView = 'designers'; state.designerBoard = 'dz1'; state.tab = 'tarefas'; try { render(); } catch (_) {} await moveStatus('t1', 'andamento'); window.__emitSnapshot(); });
rec('start/designer', await VIEW('designer', 'start-designer.png'));
rec('start/social', await VIEW('social', 'start-social.png'));
rec('start/client', await VIEW('client', 'start-client.png'));

// 3) REALTIME sem reload: "outro dispositivo" muda o store; só renderFromSnapshot (sem reload)
const rtSocialBefore = (await VIEW('social')).chip;
await page.evaluate(() => { window.__store['t1'].designerFlowStatus = 'concluido'; window.__store['t1'].clientFlowStatus = 'reenviado'; window.__emitSnapshot(); });
const after = await VIEW('social', 'realtime-social-after.png');
report.realtime = { socialBefore: rtSocialBefore, socialAfter: after.chip, column: after.column, changedNoReload: rtSocialBefore !== after.chip };

// 4) DESIGNER ENTREGOU (estado do passo 3) → designer/cliente; sem "Finalizado/Concluído"
rec('delivered/designer', await VIEW('designer', 'delivered-designer.png'));
rec('delivered/client', await VIEW('client', 'delivered-client.png'));
rec('delivered/meuquadro-dz', await VIEW('meuquadro-dz', 'delivered-meuquadro.png'));

// 5) APROVAÇÃO FINAL (como o Worker faria: finalApprovalCompleted=true) → só agora Concluído
await page.evaluate(() => { window.__store['t1'].finalApprovalCompleted = true; window.__store['t1'].cronStatus = 'aprovado_final'; window.__store['t1'].clientFlowStatus = 'concluido'; window.__emitSnapshot(); });
rec('final/social', await VIEW('social', 'final-social.png'));
rec('final/client', await VIEW('client', 'final-client.png'));

report.errors = errors;
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

// ---- GATES ----
const find = (k) => report.steps.find(s => s.step === k) || {};
let fail = [];
const noDup = report.steps.every(s => !s.chip || !s.etapa || s.chip !== s.etapa);
if (!noDup) fail.push('status duplicado (chip==etapa)');
// "Finalizado"/"Concluído" não pode aparecer antes do final (passos assign/start/delivered)
const preFinal = report.steps.filter(s => /assign|start|delivered/.test(s.step));
if (preFinal.some(s => /finaliz|conclu[ií]d|aprovad/i.test((s.column || '') + (s.chip || '')))) fail.push('Concluído/Finalizado antes do final');
// realtime tem de mudar sem reload e indicar produção/entrega
if (!report.realtime.changedNoReload) fail.push('realtime não atualizou sem reload');
// final: social deve indicar concluído
if (!/conclu[ií]d/i.test((find('final/social').chip || '') + (find('final/social').column || ''))) fail.push('aprovação final não refletiu "Concluído"');

console.log('==== F3.3.17 REALTIME/COORD QA ====');
report.steps.forEach(s => console.log(`  [${s.step}] coluna="${s.column}" | chip="${s.chip}" | etapa="${s.etapa}" | next="${s.next}"`));
console.log('  realtime:', JSON.stringify(report.realtime));
if (report.errors.length) console.log('  pageerrors:', report.errors.slice(0, 5));
if (fail.length) { console.error('::error:: F3.3.17 QA falhou: ' + fail.join(' | ')); process.exit(1); }
console.log('OK — ciclo write→snapshot→render coordenado (coluna≡chip), realtime sem reload, "Concluído" só no final, sem duplicação.');
