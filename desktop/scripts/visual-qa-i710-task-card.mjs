/* =====================================================================
 * I7.10 — PREMIUM TASK CARD · QA visual + funcional (harness-only).
 * Playwright/Chromium headless sobre o renderer REAL (desktop/src/renderer/index.html).
 * Gera: board nos 3 targets (1920 / Win125 1536@1.25 / 1366) + crops 2× + MATRIZ de
 * 16 ESTADOS REAIS (combinações possíveis no produto; nada inventado) + estados de
 * interação (hover/focus) + smoke funcional dos handlers reais do card
 * (Detalhes/Mover/kebab/busca/filtro/contexto Cliente) + no-pageerror + no-hscroll.
 * NÃO faz build/deploy/release. NÃO altera produto. Espelha o padrão do
 * visual-qa-i77-a-golden.mjs (stub Proxy no-op de window.firebase só p/ boot offline).
 * ===================================================================== */
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const RENDER_DIR = path.resolve('desktop/src/renderer');
const OUT = path.resolve('desktop/qa-out-i710'); fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => { let f = (req.url || '/').split('?')[0]; if (f === '/' || f === '') f = '/index.html';
  fs.readFile(path.join(RENDER_DIR, f), (e, b) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/javascript' }); res.end(b); }); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || undefined, args: ['--no-sandbox'] });

/* dados REAIS de produção (2 tarefas do cenário A GOLDEN + estados derivados por dados) */
const SEED_BOARD = () => {
  state.user = { id: 'carlos', name: 'Carlos Eduardo', role: 'Social Media', admin: true };
  state.users = [state.user, { id: 'marina', name: 'Marina Klein', role: 'Designer' }];
  document.body.classList.add('desktop', 'authed', 'light-ui');
  const a = document.getElementById('authSplash'); if (a) a.style.display = 'none';
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  state.tasks = [
    { id: 't1', title: 'Post de Agenda Aberta - histeroscopias', client: 'Dra. Hélita Freitas', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: '2026-08-20', dueTime: '19:05', cardLegenda: 'Agenda aberta', cardObs: 'Arte aprovada', createdAt: Date.now() - 86400000 },
    { id: 't2', title: 'Edição de vídeos — Agosto', client: 'Hospital Visão', sector: 'edicao_midia', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: '2026-08-26', dueTime: '17:00', priority: true, videos: [{ tema: 'v1' }, { tema: 'v2' }, { tema: 'v3' }], checklist: [{ t: '1' }, { t: '2' }, { t: '3' }, { t: '4' }, { t: '5' }], createdAt: Date.now() - 172800000 },
    { id: 't3', title: 'Reels de lançamento', client: 'Sunset Wear', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'revisao', dueDate: '2026-08-27', dueTime: '12:00', cardLegenda: 'Coleção', createdAt: Date.now() - 259200000 },
    { id: 't4', title: 'Cronograma Setembro', client: 'Sunset Wear', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'concluido', dueDate: '2026-08-22', cardLegenda: 'Aprovado', createdAt: Date.now() - 345600000 }
  ];
  state.personBoard = 'carlos'; state.tab = 'tarefas'; render(); if (typeof afterBoard === 'function') afterBoard();
};

/* MATRIZ 16 ESTADOS — todas combinações REAIS (eixo A Fazer→…→Finalizado; prazos por data
   real; prioridade real; checklist real; 2º participante real by≠assignee; sem responsável). */
const SEED_MATRIX = () => {
  state.user = { id: 'carlos', name: 'Carlos Eduardo', role: 'Social Media', admin: true };
  state.users = [state.user, { id: 'marina', name: 'Marina Klein', role: 'Designer' }];
  document.body.classList.add('desktop', 'authed', 'light-ui');
  const a = document.getElementById('authSplash'); if (a) a.style.display = 'none';
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  const D = n => { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); };
  state.tasks = [
    /* A Fazer */
    { id: 'm01', title: 'Roteiro institucional', client: 'Hospital Visão', sector: 'roteiro', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: D(3), dueTime: '10:00' },
    { id: 'm02', title: 'Campanha de matrículas', client: 'Colégio Alfa', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: D(2), dueTime: '09:00', priority: true },
    { id: 'm03', title: 'Post de Agenda Aberta', client: 'Dra. Hélita Freitas', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: D(0), dueTime: '23:00' },
    { id: 'm04', title: 'Cards de depoimentos', client: 'Clínica Vida', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: D(-2), dueTime: '19:05' },
    /* Em andamento */
    { id: 'm05', title: 'Edição de vídeos — Agosto', client: 'Hospital Visão', sector: 'edicao_midia', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: D(1), dueTime: '17:00', videos: [{ tema: 'v1' }, { tema: 'v2' }, { tema: 'v3' }] },
    { id: 'm06', title: 'Pack de stories semanais', client: 'Sunset Wear', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: D(2), dueTime: '15:00', checklist: [{ t: '1', d: 1 }, { t: '2', d: 1 }, { t: '3' }, { t: '4' }, { t: '5' }], cardLegenda: 'Semana 35' },
    { id: 'm07', title: 'Vídeo manifesto da marca', client: 'Colégio Alfa', sector: 'edicao_midia', by: 'carlos', assigneeId: 'carlos', status: 'andamento', dueDate: D(-1), dueTime: '12:00', priority: true, videos: [{ tema: 'v1' }] },
    /* estado 08 = ASSIGNEE FALLBACK TO CREATOR: sem assigneeId, o respOf REAL do produto
       apresenta o CRIADOR (by) como responsável — não existe card visualmente sem pessoa. */
    { id: 'm08', title: 'Legendas do lançamento', client: 'Sunset Wear', sector: 'copywriting', by: 'carlos', assigneeId: null, status: 'andamento', dueDate: D(1), dueTime: '18:00' },
    /* Revisão */
    { id: 'm09', title: 'Reels de lançamento', client: 'Sunset Wear', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'revisao', dueDate: D(1), dueTime: '12:00', cardLegenda: 'Coleção' },
    { id: 'm10', title: 'Card de agenda cirúrgica', client: 'Dra. Hélita Freitas', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'revisao', dueDate: D(-1), dueTime: '09:30' },
    { id: 'm11', title: 'Cronograma editorial', client: 'Clínica Vida', sector: 'edicao_cards', by: 'marina', assigneeId: 'carlos', status: 'revisao', dueDate: D(2), dueTime: '14:00' },
    { id: 'm12', title: 'Post educativo sobre histeroscopia diagnóstica ambulatorial', client: 'Dra. Hélita Freitas', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'revisao', dueDate: D(3), dueTime: '11:00' },
    /* Finalizado */
    { id: 'm13', title: 'Cronograma Setembro', client: 'Sunset Wear', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'concluido', dueDate: D(-4) },
    { id: 'm14', title: 'Vídeo de boas-vindas', client: 'Hospital Visão', sector: 'edicao_midia', by: 'carlos', assigneeId: 'carlos', status: 'concluido', dueDate: D(-6), checklist: [{ t: '1', d: 1 }, { t: '2', d: 1 }, { t: '3', d: 1 }, { t: '4', d: 1 }, { t: '5', d: 1 }], videos: [{ tema: 'v1' }, { tema: 'v2' }] },
    { id: 'm15', title: 'Convite do evento', client: 'Colégio Alfa', sector: 'edicao_cards', by: 'carlos', assigneeId: 'carlos', status: 'concluido', dueDate: D(-8) },
    { id: 'm16', title: 'Pacote completo de cards do mês', client: 'Clínica Vida', sector: 'edicao_cards', by: 'marina', assigneeId: 'carlos', status: 'concluido', dueDate: D(-3), cardLegenda: 'Mês fechado', cardObs: 'ok' }
  ];
  state.personBoard = 'carlos'; state.tab = 'tarefas'; render(); if (typeof afterBoard === 'function') afterBoard();
};

const report = { targets: [], matrix: null, smoke: {}, errors: [] };

/* ---- 1) BOARD nos 3 targets + crops ---- */
for (const t of [{ name: '1920', w: 1920, h: 1080, dsf: 2 }, { name: 'win125', w: 1536, h: 864, dsf: 1.25 }, { name: '1366', w: 1366, h: 768, dsf: 2 }]) {
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.dsf });
  const errs = []; page.on('pageerror', e => { if (!/firebase/.test(String(e))) errs.push(String(e).slice(0, 160)); });
  await page.addInitScript(() => { const P = new Proxy(function () {}, { get: () => P, apply: () => P, construct: () => P }); window.firebase = P; });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.render === 'function', { timeout: 25000 });
  await page.evaluate(SEED_BOARD); await page.waitForTimeout(450);
  const diag = await page.evaluate(() => ({
    cards: document.querySelectorAll('.kbv2-card').length,
    hscroll: document.documentElement.scrollWidth > window.innerWidth,
    dueTop: !!document.querySelector('.kbv2-card .kbv2-due'),
    metaLabels: getComputedStyle(document.querySelector('.kbv2-card-chips'), '::before').content,
    inset: (() => { const r = document.querySelector('.kbv2-column:nth-child(2) .kbv2-card-rail'); return r ? getComputedStyle(r).backgroundColor : ''; })(),
    pct: (() => { const p = document.querySelector('.kbv2-column:nth-child(2) .kbv2-pct'); return p ? getComputedStyle(p).display : ''; })()
  }));
  await page.screenshot({ path: path.join(OUT, `I710-BOARD-${t.name}.png`) });
  if (t.name === '1920') {
    const cards = await page.$$('.kbv2-card');
    if (cards[1]) await cards[1].screenshot({ path: path.join(OUT, 'I710-CARD-CROP-2x.png') });
    if (cards[0]) await cards[0].screenshot({ path: path.join(OUT, 'I710-CARD2-CROP-2x.png') });
    /* hover + focus (estados de interação) */
    if (cards[1]) { await cards[1].hover(); await page.waitForTimeout(250); await cards[1].screenshot({ path: path.join(OUT, 'I710-CARD-HOVER-2x.png') }); }
    await page.evaluate(() => { const b = document.querySelector('.kbv2-column:nth-child(2) .kbv2-btn-main'); if (b) b.focus(); });
    await page.waitForTimeout(150);
    const c2 = await page.$$('.kbv2-card'); if (c2[1]) await c2[1].screenshot({ path: path.join(OUT, 'I710-CARD-FOCUS-2x.png') });
  }
  report.targets.push({ target: t.name, diag, pageErrors: errs });
  await page.close();
}

/* ---- 2) MATRIZ 16 ESTADOS (viewport alto SÓ para a prancha da matriz) ---- */
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1500 }, deviceScaleFactor: 1.5 });
  const errs = []; page.on('pageerror', e => { if (!/firebase/.test(String(e))) errs.push(String(e).slice(0, 160)); });
  await page.addInitScript(() => { const P = new Proxy(function () {}, { get: () => P, apply: () => P, construct: () => P }); window.firebase = P; });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.render === 'function', { timeout: 25000 });
  await page.evaluate(SEED_MATRIX); await page.waitForTimeout(500);
  const m = await page.evaluate(() => ({
    cards: document.querySelectorAll('.kbv2-card').length,
    counts: [...document.querySelectorAll('.kbv2-ccount')].map(x => x.textContent.trim()),
    /* verdade funcional: sem assignee ⇒ respOf cai no criador (avatar do by) — validar ISSO */
    assigneeFallbackToCreator: (() => { const c = [...document.querySelectorAll('.kbv2-card')].find(x => x.querySelector('[data-cardmenu="m08"], [data-detail="m08"]')); return c ? !!c.querySelector('.kbv2-av .av') : null; })(),
    doisAvs: (() => { const c = [...document.querySelectorAll('.kbv2-card')].find(x => x.querySelector('[data-detail="m11"], [data-cardmenu="m11"]')); return c ? !!c.querySelector('.kbv2-av-by') : null; })(),
    hscroll: document.documentElement.scrollWidth > window.innerWidth
  }));
  await page.screenshot({ path: path.join(OUT, 'I710-16-STATE-MATRIX.png') });
  report.matrix = { diag: m, pageErrors: errs };
  await page.close();
}

/* ---- 3) SMOKE FUNCIONAL REAL (handlers do card) ---- */
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; page.on('pageerror', e => { if (!/firebase/.test(String(e))) errs.push(String(e).slice(0, 160)); });
  await page.addInitScript(() => { const P = new Proxy(function () {}, { get: () => P, apply: () => P, construct: () => P }); window.firebase = P; });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.render === 'function', { timeout: 25000 });
  await page.evaluate(SEED_BOARD); await page.waitForTimeout(400);
  const g = report.smoke;
  const clk = async sel => { await page.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await page.waitForTimeout(220); };
  g.navigation = await page.evaluate(() => document.querySelectorAll('.kbv2-column').length === 4 && document.querySelectorAll('.kbv2-card').length === 4);
  await clk('[data-detail="t2"]');
  g.details = await page.evaluate(() => ((document.getElementById('modalRoot') || {}).innerHTML || '').length > 50);
  await page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
  await clk('[data-move="t2"]');
  g.move = await page.evaluate(() => /Mover tarefa/.test((document.getElementById('modalRoot') || {}).innerHTML || ''));
  await page.evaluate(() => { const m = document.getElementById('modalRoot'); if (m) m.innerHTML = ''; });
  await clk('[data-cardmenu="t2"]');
  g.kebab = await page.evaluate(() => { const mm = document.querySelector('[data-menu-of="t2"]'); return !!mm && getComputedStyle(mm).display !== 'none'; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(120);
  g.responsible = await page.evaluate(() => !!document.querySelector('.kbv2-card .kbv2-av .av'));
  await page.evaluate(() => { const i = document.getElementById('bSearch'); if (i) { i.value = 'Reels'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  await page.waitForTimeout(350);
  g.search = await page.evaluate(() => document.body.innerText.includes('Reels de lançamento'));
  await page.evaluate(() => { const i = document.getElementById('bSearch'); if (i) { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  await page.waitForTimeout(300);
  g.filter = await page.evaluate(() => { const c = document.querySelector('.lui-rchip-all'); if (c) c.click(); return !!c; });
  g.checklistLine = await page.evaluate(() => document.body.innerText.includes('0 de 5 no checklist'));
  /* I7.10.1 — card REAL na superfície Cliente: seed cron de QA (setor cliente 'cronograma');
     harness-only, nada persiste (firebase stub, http local). Valida ausência de CSS leak,
     layout íntegro e ações disponíveis com a nova linguagem do card. */
  await page.evaluate(() => { state.tasks.push({ id: 'c1', title: 'Cronograma Setembro — Sunset Wear', client: 'Sunset Wear', sector: 'cronograma', by: 'carlos', assigneeId: 'carlos', status: 'afazer', dueDate: '2026-08-29', dueTime: '10:00', cronContents: [{ tema: 'Tema 1' }, { tema: 'Tema 2' }, { tema: 'Tema 3' }] }); render(); });
  await page.waitForTimeout(250);
  await clk('.nav [data-flowclient]');
  g.clientContext = await page.evaluate(() => state.flowView === 'client');
  g.clientCardRendered = await page.evaluate(() => document.querySelectorAll('.scr-client .kbv2-card').length >= 1);
  g.clientCardSane = await page.evaluate(() => { const c = document.querySelector('.scr-client .kbv2-card'); if (!c) return false; const cs = getComputedStyle(c); const t = c.querySelector('.kbv2-title'); return cs.display === 'grid' && !!t && parseFloat(getComputedStyle(t).fontSize) >= 14 && !!c.querySelector('.kbv2-btn-main, [data-detail]'); });
  await page.screenshot({ path: path.join(OUT, 'I710-CLIENT-SURFACE-1920.png') });
  { const cc = await page.$('.scr-client .kbv2-card'); if (cc) await cc.screenshot({ path: path.join(OUT, 'I710-CLIENT-CARD.png') }); }
  await clk('.nav [data-myboard]');
  g.noHscroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  g.noPageError = errs.length === 0;
  report.smoke = g; report.errors = errs;
  await page.close();
}

await browser.close(); server.close();
const fails = [
  ...report.targets.filter(t => t.diag.hscroll || t.pageErrors.length).map(t => 'target:' + t.target),
  ...(report.matrix.diag.cards === 16 ? [] : ['matrix:cards=' + report.matrix.diag.cards]),
  ...Object.entries(report.smoke).filter(([k, v]) => v !== true).map(([k]) => 'smoke:' + k)
];
report.RESULT = fails.length ? 'FAIL' : 'PASS'; report.fails = fails;
fs.writeFileSync(path.join(OUT, 'I710-QA-REPORT.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ RESULT: report.RESULT, fails, matrix: report.matrix.diag, targets: report.targets.map(t => ({ t: t.target, ...t.diag, errs: t.pageErrors.length })) }, null, 1));
process.exit(fails.length ? 1 : 0);
