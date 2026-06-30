/* =====================================================================
 * F3.3.17 — QA REALTIME + COORDENAÇÃO coluna≡chip (read-only).
 * Playwright/Chromium headless. Carrega o renderer REAL e exercita o CAMINHO REAL
 * de snapshot do app: aplica os campos que cada transição PERSISTE em state.tasks e
 * chama renderFromSnapshot() (o MESMO handler do onSnapshot do Firestore — render()),
 * provando que a leitura/coluna/chip/etapa/próxima reagem ao estado sem reload. Usa
 * também a função de escrita REAL `moveStatus` (eixo designer, SEM notificações) para
 * o "iniciar". NÃO usa o db de closure (que exigiria Firebase real) — por isso simula
 * a persistência via state.tasks, que é exatamente o que o onSnapshot entrega ao render.
 * NÃO toca notificações/Worker/Android. NÃO faz deploy/release.
 * Limite honesto: o round-trip real Firestore entre 2 dispositivos só é verificável no
 * ambiente físico; aqui provamos snapshot→render→coluna/chip/etapa/próxima.
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-f3317'); fs.mkdirSync(OUT, { recursive: true });
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
await page.waitForFunction(() => typeof window.render === 'function' && typeof window.renderFromSnapshot === 'function' && typeof window.flowBoardCol === 'function' && typeof window.moveStatus === 'function', { timeout: 25000 });

await page.evaluate(() => {
  state.user = { id: 'owner', name: 'Owner Social', role: 'Social Media', admin: true };
  state.users = [state.user, { id: 'dz1', name: 'Designer Um', role: 'Designer' }];
  state.events = [];
  document.body.classList.add('desktop', 'authed');
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  let cron = 'cronograma'; try { if (typeof SECTORS !== 'undefined') { const c = SECTORS.find(s => /cronog/i.test(s.key) || /cronog/i.test(s.label)); if (c) cron = c.key; } } catch (_) {}
  window.__cron = cron;
  // tarefa cronograma com temas aprovados (planejamento, pronta p/ atribuir)
  state.tasks = [{ id: 't1', title: 'Post Institucional', client: 'Cliente A', sector: cron, by: 'owner', status: 'afazer', clientReview: { status: 'aprovado' }, cronStatus: 'aprovado_cliente' }];
  // SNAPSHOT real: aplica os campos persistidos e chama o MESMO caminho do onSnapshot (renderFromSnapshot)
  window.__snapshot = (patch) => { const t = state.tasks[0]; Object.keys(patch || {}).forEach(k => { t[k] = patch[k]; }); try { renderFromSnapshot(); } catch (_) {} };
});

const VIEW = async (role, file) => {
  await page.evaluate((role) => {
    state.form = null; state.clientView = null; state.boardSector = null; state.personBoard = null; state.roleBoards = false; state.flowView = null; state.designerBoard = null; state.socialBoard = null;
    state.tab = 'tarefas';
    if (role === 'designer') { state.flowView = 'designers'; state.designerBoard = 'dz1'; }
    else if (role === 'client') { state.flowView = 'client'; }
    else if (role === 'meuquadro-dz') { state.personBoard = 'dz1'; }
    else { state.boardSector = window.__cron; }
    try { render(); } catch (_) {} try { slaibRefresh(); } catch (_) {}
  }, role);
  await page.waitForTimeout(280);
  if (file) await page.screenshot({ path: path.join(OUT, file) });
  return await page.evaluate(() => {
    let colTitle = null; document.querySelectorAll('.kbv2-column').forEach(c => { if (c.querySelector('[data-detail="t1"]')) { const h = c.querySelector('.kbv2-ctitle'); colTitle = h ? h.textContent.trim() : '?'; } });
    const anchor = document.querySelector('[data-detail="t1"]'); const card = anchor && anchor.closest('.kbv2-card');
    const chip = card && card.querySelector('.kbv2-status'); const pill = card && card.querySelector('.kbv2-st2-pill'); const nx = card && card.querySelector('.kbv2-st2-next');
    return { column: colTitle, chip: chip ? chip.textContent.trim() : null, etapa: pill ? pill.textContent.trim() : null, next: nx ? nx.textContent.trim() : null };
  });
};
const snap = (patch) => page.evaluate((p) => window.__snapshot(p), patch);

const report = { steps: [], realtime: {}, errors: [] };
const rec = (k, v) => { report.steps.push({ step: k, ...v }); };

// 1) ASSIGN (campos que sendToDesigner persiste) → snapshot → social/designer/client
await snap({ designerAssignment: { designerId: 'dz1', designerName: 'Designer Um' }, assigneeId: 'dz1', designerFlowStatus: 'afazer', designerWorkflowStage: 'afazer', clientFlowStatus: 'producao', cronStatus: 'sent_to_designer', status: 'afazer' });
rec('assign/social', await VIEW('social', 'assign-social.png'));
rec('assign/designer', await VIEW('designer', 'assign-designer.png'));
rec('assign/client', await VIEW('client', 'assign-client.png'));

// 2) DESIGNER START via FUNÇÃO DE ESCRITA REAL (moveStatus, eixo designer, SEM notificações)
const rtBefore = (await VIEW('social')).chip;                   // social ANTES (designer não iniciou)
await page.evaluate(async () => { state.flowView = 'designers'; state.designerBoard = 'dz1'; state.tab = 'tarefas'; try { render(); } catch (_) {}
  try { await moveStatus('t1', 'andamento'); } catch (_) {} });  // grava designerFlowStatus='andamento' (otimista + render); db.update falha e é ignorado
rec('start/designer', await VIEW('designer', 'start-designer.png'));
// 3) REALTIME sem reload: a Social re-renderiza pelo caminho de snapshot e vê "Designer em produção"
const startSocial = await VIEW('social', 'start-social.png');
rec('start/social', startSocial);
report.realtime = { socialBefore: rtBefore, socialAfter: startSocial.chip, column: startSocial.column, changedNoReload: rtBefore !== startSocial.chip && /produção/i.test(startSocial.chip || '') };
rec('start/client', await VIEW('client', 'start-client.png'));

// 4) DESIGNER ENTREGOU → snapshot → não pode "Finalizado/Concluído"
await snap({ designerFlowStatus: 'concluido', clientFlowStatus: 'reenviado' });
rec('delivered/designer', await VIEW('designer', 'delivered-designer.png'));
rec('delivered/social', await VIEW('social', 'delivered-social.png'));
rec('delivered/meuquadro-dz', await VIEW('meuquadro-dz', 'delivered-meuquadro.png'));
rec('delivered/client', await VIEW('client', 'delivered-client.png'));

// 5) SOCIAL ENVIA FINAL AO CLIENTE → snapshot
await snap({ cronStatus: 'ready_for_final_client_review', clientApprovalPhase: 'final' });
rec('sentfinal/social', await VIEW('social', 'sentfinal-social.png'));
rec('sentfinal/client', await VIEW('client', 'sentfinal-client.png'));

// 6) CLIENTE PEDE REVISÃO → snapshot
await snap({ clientReview: { status: 'revisao' }, cronStatus: 'em_revisao_cliente' });
rec('revision/social', await VIEW('social', 'revision-social.png'));
rec('revision/client', await VIEW('client', 'revision-client.png'));

// 7) CLIENTE APROVA FINAL (como o Worker grava) → só agora Concluído
await snap({ clientReview: { status: 'aprovado' }, finalApprovalCompleted: true, cronStatus: 'aprovado_final', clientFlowStatus: 'concluido' });
rec('final/social', await VIEW('social', 'final-social.png'));
rec('final/designer', await VIEW('designer', 'final-designer.png'));
rec('final/client', await VIEW('client', 'final-client.png'));

report.errors = errors;
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

const find = (k) => report.steps.find(s => s.step === k) || {};
let fail = [];
if (report.steps.every(s => s.chip == null)) fail.push('cards não renderizaram (chip nulo em tudo)');
const noDup = report.steps.every(s => !s.chip || !s.etapa || s.chip !== s.etapa);
if (!noDup) fail.push('status duplicado (chip==etapa)');
// "Concluído" é SINAL ESTRUTURAL: coluna terminal EXATA, nunca substring no texto livre do chip.
// Terminais reais por papel: Social="Concluído", Cliente="Aprovado". (Designer="Entregue" é a raia
// normal de entrega — já aparece em delivered/* e NÃO é conclusão; por isso fica fora do conjunto.)
const TERMINAL_COL = /^(conclu[ií]do|finalizado|aprovado)$/i;
const isTerminalCol = (s) => TERMINAL_COL.test((s.column || '').trim());
const preFinal = report.steps.filter(s => /assign|start|delivered|sentfinal|revision/.test(s.step));
const earlyTerminal = preFinal.filter(isTerminalCol);
if (earlyTerminal.length) fail.push('coluna terminal (Concluído/Finalizado/Aprovado) antes do final: ' + earlyTerminal.map(s => s.step + '="' + s.column + '"').join(', '));
// e o cenário final DEVE atingir a coluna terminal estrutural (social=Concluído, client=Aprovado;
// designer permanece em "Entregue" por design, então é excluído desta exigência estrutural).
const finalsStruct = report.steps.filter(s => /^final\//.test(s.step) && s.step !== 'final/designer');
if (!finalsStruct.length || !finalsStruct.every(isTerminalCol)) fail.push('cenário final não atingiu coluna terminal estrutural (Concluído/Aprovado)');
if (!report.realtime.changedNoReload) fail.push('realtime: Social não passou a "Designer em produção" sem reload');
if (!/produção/i.test(find('assign/designer').column === null ? '' : (find('start/designer').chip || ''))) fail.push('Designer não vê "Designer em produção" ao iniciar');
if (!/conclu[ií]d/i.test((find('final/social').chip || '') + (find('final/social').column || ''))) fail.push('aprovação final não refletiu Concluído');
if (/conclu[ií]d|finaliz/i.test((find('delivered/meuquadro-dz').column || ''))) fail.push('Meu quadro: entregue caiu em Finalizado (REGRA)');

console.log('==== F3.3.17 REALTIME/COORD QA ====');
report.steps.forEach(s => console.log(`  [${s.step}] coluna="${s.column}" | chip="${s.chip}" | etapa="${s.etapa}" | next="${s.next}"`));
console.log('  realtime:', JSON.stringify(report.realtime));
if (report.errors.length) console.log('  pageerrors:', report.errors.slice(0, 5));
if (fail.length) { console.error('::error:: F3.3.17 QA falhou: ' + fail.join(' | ')); process.exit(1); }
console.log('OK — snapshot→render coordenado (coluna≡chip), realtime sem reload (→Designer em produção), "Concluído" só no final, sem duplicação, Meu quadro sem entregue→Finalizado.');
