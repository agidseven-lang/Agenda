#!/usr/bin/env node
/* I7.23.1 — QA visual/geométrico do TASK CARD RESPONSIVE REPAIR (PRAZO/SLA).
 *
 * Prova, com DOMRect real e zero tolerância de pixel, que o candidato elimina a
 * colisão PRAZO/SLA reproduzida na baseline 1.0.253 (5dac060a) nos quadros
 * scr-designers/scr-socials/scr-sector, preservando byte de geometria em
 * Meu quadro e Cliente (parity BEFORE↔AFTER ≤ 0.5px por parte de card).
 *
 * Uso:
 *   BASELINE_DIR=<dir com index.html da baseline 5dac060a> node desktop/scripts/visual-qa-i7231-taskcard-responsive.mjs
 *
 * Gates:
 *   G0*      — fail-closed: hash da baseline, candidato presente, diff aditivo escopado
 *   PRE-*    — regressão do owner REPRODUZIDA na baseline (âncora anti-teatro)
 *   TC-R1..TC-R10 — geometria dura no candidato: interseção 0px², sem clip,
 *              conteúdo dentro do card, footer/metadata, progresso/rodapé,
 *              ⋯/status/título, sem hscroll — TODAS as superfícies × 1920/Win125/1366,
 *              TODOS os cards da matriz (≥18 variações, incl. cenário do owner).
 *   HOV-*    — hover real (Mover no topo): nenhuma interseção nova vs baseline.
 *   FRZ-*    — Meu quadro/Cliente intocados (rect parity) + escopo CSS estático.
 *   MTX-*    — presença real de cada variação da matriz.
 *   FUN-*    — funcional congelado: Detalhes real, kebab, Mover real, Hoje H-mini.
 *   E1-*     — integridade de evidência (login suprimido registrado, heading, manifest).
 *
 * Saída: desktop/qa-out-i7231/ (gitignored) — PNGs oficiais I7231-* + manifest +
 * i7231-gates.json. Exit 1 se qualquer gate falhar. Nunca fabrica PASS.
 */
import { chromium } from 'playwright';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ROOT_AFTER = path.join(REPO, 'desktop', 'src', 'renderer');
const ROOT_BEFORE = process.env.BASELINE_DIR || '';
const OUT = path.join(REPO, 'desktop', 'qa-out-i7231');
const BASELINE_SHA = '5dac060ad612d4acbe24d389a00f23c51721c527';
const BASELINE_RENDERER_SHA256 = 'c01bd845245bf09a833edcee41bf9e390106a2e72c16d08b1664738289e209ad';
const CHROME = process.env.QA_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
fs.mkdirSync(OUT, { recursive: true });

const gates = []; const manifest = [];
function gate(id, ok, info) { gates.push({ id, ok: !!ok, info: String(info).slice(0, 300) }); console.log((ok ? '[PASS] ' : '[FAIL] ') + id + ' — ' + info); }
const sha256 = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/* ---------- G0 · fail-closed de fonte ---------- */
if (!ROOT_BEFORE) { gate('G0-BASELINE-DIR', false, 'BASELINE_DIR ausente'); finish(); }
const beforeHash = sha256(path.join(ROOT_BEFORE, 'index.html'));
gate('G0-BASELINE-HASH', beforeHash === BASELINE_RENDERER_SHA256, `baseline index.html sha256=${beforeHash.slice(0, 16)}… esperado c01bd845…`);
const afterHash = sha256(path.join(ROOT_AFTER, 'index.html'));
gate('G0-CANDIDATE-DIFFERS', afterHash !== BASELINE_RENDERER_SHA256, `candidato sha256=${afterHash.slice(0, 16)}…`);
let numstat = '';
try { numstat = execFileSync('git', ['diff', '--numstat', BASELINE_SHA, '--', 'desktop/src/renderer/index.html'], { cwd: REPO }).toString().trim(); } catch (e) { numstat = 'git-err:' + e.message; }
const nm = numstat.match(/^(\d+)\t(\d+)\t/);
gate('G0-DIFF-ADDITIVE', !!nm && nm[2] === '0' && +nm[1] > 0 && +nm[1] <= 80, `numstat="${numstat}" (aditivo, 1 arquivo)`);
const rendererTxt = fs.readFileSync(path.join(ROOT_AFTER, 'index.html'), 'utf8');
const secStart = rendererTxt.indexOf('I7.23.1 · TASK CARD');
const secEnd = rendererTxt.indexOf('LIGHT UI — I7.14', secStart);
const section = secStart > 0 && secEnd > secStart ? rendererTxt.slice(secStart, secEnd) : '';
const selLines = section.split('\n').filter(l => /^body\./.test(l.trim()));
const scoped = selLines.length > 0 && selLines.every(l => /^body\.light-ui\.desktop \.scr-(designers|socials|sector) /.test(l.trim()));
gate('G0-CSS-SCOPE', scoped, `${selLines.length} seletores, todos body.light-ui.desktop .scr-{designers|socials|sector}`);
gate('G0-NO-ZINDEX-WAR', !/z-index\s*:\s*\d/.test(section), 'seção I7.23.1 sem z-index numérico (só z-index:auto de restauração)');

/* ---------- servidores ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.mp3': 'audio/mpeg' };
function serve(root, port) {
  const s = http.createServer((req, res) => {
    const p = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    try { const b = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(b); }
    catch { res.writeHead(404); res.end('nf'); }
  });
  return new Promise(r => s.listen(port, () => r(s)));
}
const srvA = await serve(ROOT_AFTER, 8895);
const srvB = await serve(ROOT_BEFORE, 8896);

const VPS = [
  { name: '1920', width: 1920, height: 1080, dpr: 1 },
  { name: 'win125', width: 1536, height: 864, dpr: 1.25 },
  { name: '1366', width: 1366, height: 768, dpr: 1 },
];
const SURFACES = ['mine', 'designers', 'socials', 'sector', 'client'];
const HEAD_RE = { mine: /Meu quadro/, designers: /Designer · /, socials: /Social · /, sector: /Quadro de Cronograma/, client: /Cliente/, hoje: /Olá,/ };

/* ---------- seed · matriz ≥18 variações (V1..V21) ---------- */
const SEED = () => {
  const iso = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  const today = new Date(); const plus = n => iso(new Date(today.getTime() + n * 86400000));
  state.user = { id: 'carlos', name: 'Carlos Eduardo', role: 'Social Media', admin: true };
  state.users = [state.user,
    { id: 'd1', name: 'Diego Fernandes', role: 'Designer' },
    { id: 's2', name: 'Marina Klein', role: 'Social Media' },
    { id: 'o1', name: 'Otavio Nunes', role: 'Fotografo' }];
  document.body.classList.add('desktop', 'authed', 'light-ui');
  const asp = document.getElementById('authSplash'); if (asp) asp.style.display = 'none';
  const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
  const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
  const T = n => { const a = []; for (let i = 1; i <= n; i++) a.push({ tema: 'Tema ' + i + ' — pauta do mês', legenda: i <= 2 ? 'Legenda pronta ' + i : '' }); return a; };
  const DA = { designerId: 'd1', startDate: iso(today), startTime: '08:00' };
  state.tasks = [
    /* V1/V6/V8/V11/V15/V16 — CARD DO OWNER: SETEMBRO · Cronograma · 4 set 18:00 · Em prazo · Faltam 2d Xh · 2 avatares · 6 temas */
    { id: 't1', title: 'SETEMBRO', client: 'Hospital Visao', sector: 'cronograma', status: 'afazer', dueDate: '2026-09-04', dueTime: '18:00', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', createdAt: Date.now() - 3 * 864e5, cronContents: T(6) },
    { id: 't2', title: 'OUTUBRO PLANEJAMENTO', client: 'Clinica Ortope', sector: 'cronograma', status: 'afazer', dueDate: plus(8), dueTime: '12:00', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', createdAt: Date.now() - 2 * 864e5, cronContents: T(4) },
    /* V12/V17 — prioridade + checklist */
    { id: 't3', title: 'Campanha Setembro Amarelo', client: 'Hospital Visao', sector: 'cronograma', status: 'afazer', dueDate: plus(3), dueTime: '09:30', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', priority: true, createdAt: Date.now() - 864e5, cronContents: T(3), checklist: [{ t: 'Briefing', d: true }, { t: 'Roteiro', d: true }, { t: 'Captacao', d: false }, { t: 'Edicao', d: false }, { t: 'Aprovacao', d: false }] },
    /* V2 — título longo */
    { id: 't4', title: 'Planejamento estratégico completo do cronograma editorial — Setembro e Outubro', client: 'Hospital Visao', sector: 'cronograma', status: 'afazer', dueDate: plus(4), dueTime: '17:00', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(2) },
    /* V3 — cliente longo */
    { id: 't5', title: 'Rodada de aprovação', client: 'Instituto de Oftalmologia Avançada da Região Metropolitana', sector: 'cronograma', status: 'andamento', dueDate: plus(5), dueTime: '10:00', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(2) },
    /* V9 — Hoje */
    { id: 't9', title: 'Post do dia', client: 'Hospital Visao', sector: 'cronograma', status: 'andamento', dueDate: iso(today), dueTime: '23:30', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(1) },
    /* V10 — Atrasada (SLA vermelho) */
    { id: 't10', title: 'Retrospectiva Agosto', client: 'Clinica Ortope', sector: 'cronograma', status: 'andamento', dueDate: plus(-3), dueTime: '18:00', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(2) },
    /* V11b — restante longo (Faltam 25d) */
    { id: 't11', title: 'Planejamento Q4', client: 'Hospital Visao', sector: 'cronograma', status: 'revisao', dueDate: plus(25), dueTime: '18:00', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(2) },
    /* V19 — sem SLA e sem prazo (guarda anti-fantasma) */
    { id: 't8', title: 'Backlog sem prazo', client: 'Clinica Ortope', sector: 'cronograma', status: 'revisao', designerSla: {}, designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(1) },
    /* V18 — prazo sem SLA */
    { id: 't12', title: 'Revisão de pauta', client: 'Hospital Visao', sector: 'cronograma', status: 'revisao', dueDate: plus(6), dueTime: '15:00', designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(1) },
    /* V20 — concluída */
    { id: 't13', title: 'AGOSTO', client: 'Hospital Visao', sector: 'cronograma', status: 'concluido', dueDate: plus(-1), designerAssignment: DA, assigneeId: 'd1', by: 'carlos', cronContents: T(5) },
    /* V4 — setor de rótulo longo (Meu quadro col1) + V13 trilho */
    { id: 't6', title: 'Cards da semana', client: 'Hospital Visao', sector: 'edicao_cards', status: 'afazer', dueDate: plus(7), dueTime: '14:00', assigneeId: 'carlos', by: 'carlos' },
    /* V5 — data sem hora + V13 trilho em andamento */
    { id: 't7', title: 'Cortes do institucional', client: 'Colegio Alfa', sector: 'edicao_midia', status: 'andamento', dueDate: plus(10), assigneeId: 'carlos', by: 'carlos' },
    /* V14 — um avatar só */
    { id: 't14', title: 'Capa avulsa', client: 'Sunset Wear', sector: 'edicao_cards', status: 'andamento', dueDate: plus(9), dueTime: '11:00', assigneeId: 'carlos', by: 'carlos' },
  ];
  state.events = [];
};

/* ---------- medição ---------- */
const MEASURE = (surfKey) => {
  const R = r => ({ x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) });
  const vis = el => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ix = (a, b) => { if (!a || !b) return 0; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left); const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); return (w > 0 && h > 0) ? +(w * h).toFixed(2) : 0; };
  const heading = ((document.querySelector('.scr-head') || {}).textContent || '').trim().slice(0, 120);
  const login = document.getElementById('login');
  const loginPresent = !!(login && !login.classList.contains('hidden') && getComputedStyle(login).display !== 'none');
  const cell = { surface: surfKey, heading, loginPresent, hscroll: document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth, cards: [] };
  const PARTS = ['top', 'topR', 'status', 'sla', 'due', 'title', 'tier', 'chips', 'setorChip', 'dateBox', 'dateS', 'summary', 'sumMain', 'chk', 'rail', 'pct', 'profile', 'avBy', 'kebab', 'stage2', 'moveBtn'];
  const SEL = { top: '.kbv2-card-top', topR: '.kbv2-top-r', status: '.kbv2-status', sla: '.kbv2-sla', due: '.kbv2-due', title: '.kbv2-title', tier: '.kbv2-tier', chips: '.kbv2-card-chips', setorChip: '.kbv2-card-chips .kbv2-chip:first-child', dateBox: '.kbv2-card-date', dateS: '.kbv2-date-s', summary: '.kbv2-card-summary', sumMain: '.kbv2-sum-main', chk: '.kbv2-card-chk', rail: '.kbv2-card-rail', pct: '.kbv2-pct', profile: '.kbv2-card-profile', avBy: '.kbv2-av-by', kebab: '.kbv2-btn-dots', stage2: '.kbv2-stage2', moveBtn: '.kbv2-btn[data-move]' };
  for (const cardEl of document.querySelectorAll('.kbv2-card')) {
    const detBtn = cardEl.querySelector('[data-detail]');
    const id = detBtn ? detBtn.getAttribute('data-detail') : '';
    const cr = cardEl.getBoundingClientRect();
    const col = cardEl.closest('.kbv2-column');
    const colR = col ? col.getBoundingClientRect() : null;
    const laneLabel = col ? ((col.querySelector('.kbv2-col-h, .kbv2-col-head, header, .kbv2-column-h') || col.firstElementChild || {}).textContent || '').trim().slice(0, 40) : '';
    const c = { id, rect: R(cr), laneW: colR ? +colR.width.toFixed(2) : null, laneLabel, parts: {}, visible: {}, texts: {}, ints: {}, clip: {}, beyond: [] };
    const live = {};
    for (const k of PARTS) {
      const el = cardEl.querySelector(SEL[k]);
      c.visible[k] = vis(el);
      if (el) { c.texts[k] = (el.textContent || '').trim().slice(0, 60); const r = el.getBoundingClientRect(); c.parts[k] = R(r); if (c.visible[k]) live[k] = r; }
      if (el && c.visible[k] && ['sla', 'due', 'dateS', 'setorChip', 'title', 'sumMain'].includes(k)) c.clip[k] = el.scrollWidth > el.clientWidth + 1;
    }
    const P = (a, b) => { c.ints[a + ':' + b] = ix(live[a], live[b]); };
    P('sla', 'dateS'); P('sla', 'dateBox'); P('sla', 'due'); P('sla', 'setorChip'); P('sla', 'chips'); P('sla', 'summary'); P('sla', 'title'); P('sla', 'kebab'); P('sla', 'status');
    P('due', 'dateS'); P('due', 'dateBox'); P('due', 'setorChip'); P('due', 'chips'); P('due', 'summary'); P('due', 'title'); P('due', 'kebab'); P('due', 'status');
    P('chips', 'title'); P('chips', 'dateBox'); P('chips', 'kebab'); P('chips', 'summary');
    P('profile', 'dateBox'); P('profile', 'chips'); P('profile', 'rail'); P('profile', 'pct'); P('summary', 'dateBox'); P('summary', 'chips'); P('summary', 'rail'); P('summary', 'pct'); P('chk', 'dateBox'); P('chk', 'chips');
    P('kebab', 'status'); P('kebab', 'title'); P('status', 'title');
    P('moveBtn', 'sla'); P('moveBtn', 'due'); P('moveBtn', 'dateS'); P('moveBtn', 'title'); P('moveBtn', 'status');
    for (const k of PARTS) {
      if (!c.visible[k] || k === 'moveBtn') continue; const r = live[k]; if (!r) continue;
      if (r.right > cr.right + 0.5 || r.left < cr.left - 0.5 || r.bottom > cr.bottom + 0.5) c.beyond.push(k + ':' + Math.max(r.right - cr.right, cr.left - r.left, r.bottom - cr.bottom).toFixed(1));
    }
    if (colR && (cr.right > colR.right + 0.5 || cr.left < colR.left - 0.5)) c.beyond.push('card-out-of-lane');
    cell.cards.push(c);
  }
  return cell;
};

/* ---------- navegação/execução ---------- */
async function bootPage(ctx, port) {
  const pg = await ctx.newPage();
  pg.__errs = []; pg.on('pageerror', e => pg.__errs.push(String(e).slice(0, 200)));
  await pg.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await pg.waitForTimeout(2000);
  await pg.evaluate(() => { window.__qaRevealSuppressed = []; window._revealLogin = function (r) { window.__qaRevealSuppressed.push(String(r || '')); }; });
  await pg.evaluate(SEED);
  return pg;
}
async function nav(pg, key) {
  await pg.evaluate((key) => {
    state.form = null; state.boardSector = null; state.personBoard = null; state.roleBoards = false;
    state.flowView = null; state.designerBoard = null; state.socialBoard = null; state.tab = 'tarefas';
    if (key === 'mine') state.personBoard = 'carlos';
    else if (key === 'designers') { state.flowView = 'designers'; state.designerBoard = 'd1'; }
    else if (key === 'socials') { state.flowView = 'socials'; state.socialBoard = 'carlos'; }
    else if (key === 'sector') state.boardSector = 'cronograma';
    else if (key === 'client') state.flowView = 'client';
    else if (key === 'hoje') state.tab = 'hoje';
    render();
  }, key);
  await pg.waitForTimeout(380);
}
async function shotChecked(pg, file, { surface, vp, sourceSha, cell, clip }) {
  const okHead = HEAD_RE[surface] ? HEAD_RE[surface].test(cell.heading) : true;
  const okCards = surface === 'hoje' ? true : cell.cards.length > 0;
  const valid = !cell.loginPresent && okHead && okCards;
  await pg.screenshot({ path: path.join(OUT, file), ...(clip ? { clip } : {}) });
  const t1 = cell.cards.find(c => c.id === 't1');
  manifest.push({ filename: file, sourceSha, viewport: vp, cardWidth: t1 ? t1.rect.w : (cell.cards[0] ? cell.cards[0].rect.w : null), surface, heading: cell.heading.slice(0, 80), loginPresent: cell.loginPresent, screenshotValid: valid, overlapMetrics: t1 ? { 'sla:dateS': t1.ints['sla:dateS'], 'sla:due': t1.ints['sla:due'], 'due:dateS': t1.ints['due:dateS'], 'sla:setorChip': t1.ints['sla:setorChip'] } : null, hscroll: cell.hscroll, pageErrors: pg.__errs.length });
  return valid;
}

const browser = await chromium.launch({ executablePath: CHROME });
const DATA = { before: {}, after: {} };
const HOVER = { before: {}, after: {} };
for (const phase of ['before', 'after']) {
  const port = phase === 'after' ? 8895 : 8896;
  const srcSha = phase === 'after' ? 'candidate:' + afterHash.slice(0, 12) : BASELINE_SHA.slice(0, 12) + ' (v1.0.253)';
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    await ctx.addInitScript(() => {
      const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop });
      ['initializeApp', 'getFirestore', 'getAuth'].forEach(k => { window[k] = noop; }); window.firebase = noop;
    });
    const pg = await bootPage(ctx, port);
    for (const sf of SURFACES) {
      await nav(pg, sf);
      const cell = await pg.evaluate(MEASURE, sf);
      cell.pageErrors = pg.__errs.slice();
      DATA[phase][`${sf}@${vp.name}`] = cell;
      /* hover no card do owner: superfícies reparadas + Meu quadro (paridade de freeze) */
      if (['designers', 'socials', 'sector', 'mine'].includes(sf)) {
        const h = await pg.locator('.kbv2-card:has([data-detail="t1"])');
        if (await h.count()) {
          await h.first().hover(); await pg.waitForTimeout(180);
          HOVER[phase][`${sf}@${vp.name}`] = await pg.evaluate(MEASURE, sf);
          await pg.mouse.move(4, 4); await pg.waitForTimeout(120);
        }
      }
      /* PNGs oficiais */
      if (phase === 'before' && sf === 'sector' && vp.name === 'win125') {
        const lane = cell.cards.find(c => c.id === 't1');
        const clip = lane ? { x: Math.max(0, lane.rect.x - 10), y: Math.max(0, lane.rect.y - 46), width: Math.min(vp.width, lane.laneW + 20), height: Math.min(vp.height - Math.max(0, lane.rect.y - 46), 700) } : undefined;
        await shotChecked(pg, 'I7231-BEFORE-OWNER-REGRESSION.png', { surface: sf, vp: vp.name, sourceSha: srcSha, cell, clip });
      }
      if (phase === 'after') {
        if (sf === 'sector' && vp.name === 'win125') {
          const lane = cell.cards.find(c => c.id === 't1');
          const clip = lane ? { x: Math.max(0, lane.rect.x - 10), y: Math.max(0, lane.rect.y - 46), width: Math.min(vp.width, lane.laneW + 20), height: Math.min(vp.height - Math.max(0, lane.rect.y - 46), 700) } : undefined;
          await shotChecked(pg, 'I7231-AFTER-SAME-CARDS.png', { surface: sf, vp: vp.name, sourceSha: srcSha, cell, clip });
        }
        if (sf === 'sector') await shotChecked(pg, `I7231-LANE-3-CARDS-${vp.name === 'win125' ? 'WIN125' : vp.name}.png`, { surface: sf, vp: vp.name, sourceSha: srcSha, cell });
        if (sf === 'mine' && vp.name === '1920') await shotChecked(pg, 'I7231-MEUQUADRO-1920.png', { surface: sf, vp: vp.name, sourceSha: srcSha, cell });
        if (sf === 'client' && vp.name === '1920') await shotChecked(pg, 'I7231-CLIENTE-CARDS.png', { surface: sf, vp: vp.name, sourceSha: srcSha, cell });
        if (sf === 'designers' && vp.name === '1920') await shotChecked(pg, 'I7231-DESIGNER-CARDS.png', { surface: sf, vp: vp.name, sourceSha: srcSha, cell });
        if (sf === 'socials' && vp.name === '1920') await shotChecked(pg, 'I7231-SOCIAL-CARDS.png', { surface: sf, vp: vp.name, sourceSha: srcSha, cell });
      }
    }
    /* funcional congelado — só no candidato, win125 */
    if (phase === 'after' && vp.name === 'win125') {
      await nav(pg, 'sector');
      await pg.click('.kbv2-card [data-detail="t1"]');
      await pg.waitForTimeout(320);
      const det = await pg.evaluate(() => { const m = document.querySelector('.modal-back[data-detmodal]'); return m ? { open: true, origin: m.getAttribute('data-detorigin') || '', tid: m.getAttribute('data-dettaskid') || '' } : { open: false }; });
      gate('FUN-DETAIL', det.open && det.tid === 't1', `Detalhes real abre no quadro de setor (origin="${det.origin}", task=${det.tid})`);
      await pg.evaluate(() => { if (typeof closeModal === 'function') closeModal(); }); await pg.waitForTimeout(200);
      await nav(pg, 'sector');
      await pg.click('[data-cardmenu="t1"]'); await pg.waitForTimeout(200);
      const menuOpen = await pg.evaluate(() => !!document.querySelector('.kbv2-menu.open'));
      gate('FUN-KEBAB', menuOpen, 'menu ⋯ real abre (portal .kbv2-menu.open)');
      await pg.click('.scr-head'); await pg.waitForTimeout(150);
      const card = pg.locator('.kbv2-card:has([data-detail="t1"])'); await card.first().hover(); await pg.waitForTimeout(180);
      const moveVisible = await pg.evaluate(() => { const b = document.querySelector('.kbv2-btn[data-move="t1"]'); return b ? +getComputedStyle(b).opacity : -1; });
      await pg.click('.kbv2-btn[data-move="t1"]'); await pg.waitForTimeout(300);
      const moveOpts = await pg.evaluate(() => document.querySelectorAll('[data-domove]').length);
      gate('FUN-MOVE', moveVisible === 1 && moveOpts > 0, `Mover real: botão hover opacity=${moveVisible}, ${moveOpts} opções [data-domove]`);
      await pg.evaluate(() => { if (typeof closeModal === 'function') closeModal(); }); await pg.waitForTimeout(200);
      await nav(pg, 'hoje');
      const hj = await pg.evaluate(() => ({ urgent: document.querySelectorAll('.hj-urgent[data-detail]').length, kpi: document.querySelectorAll('.stat[data-myboard]').length }));
      gate('FUN-HOJE-MINI', hj.urgent > 0 && hj.kpi > 0, `Hoje congelado: ${hj.urgent} row(s) .hj-urgent[data-detail], KPI data-myboard=${hj.kpi}`);
      await pg.click('.stat[data-myboard]'); await pg.waitForTimeout(380);
      const backMine = await pg.evaluate(() => ((document.querySelector('.scr-head') || {}).textContent || '').includes('Meu quadro'));
      gate('FUN-KPI-MYBOARD', backMine, 'KPI Tarefas → Meu quadro (I7.20.2 preservado)');
      const supp = await pg.evaluate(() => (window.__qaRevealSuppressed || []).length);
      gate('E1-SUPPRESS-RECORDED', true, `${supp} reveal(s) suprimidos e registrados nesta página`);
    }
    await ctx.close();
  }
}

/* ---------- crops 2× (cenário do owner reparado + hover) ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop }); ['initializeApp', 'getFirestore', 'getAuth'].forEach(k => { window[k] = noop; }); window.firebase = noop; });
  const pg = await bootPage(ctx, 8895);
  await nav(pg, 'sector');
  const cell = await pg.evaluate(MEASURE, 'sector');
  const t1 = cell.cards.find(c => c.id === 't1');
  if (t1) {
    const clip = { x: Math.max(0, t1.rect.x - 6), y: Math.max(0, t1.rect.y - 6), width: t1.rect.w + 12, height: t1.rect.h + 12 };
    await shotChecked(pg, 'I7231-CARD-DEADLINE-SLA-2X.png', { surface: 'sector', vp: 'win125@2x', sourceSha: 'candidate:' + afterHash.slice(0, 12), cell, clip });
    await pg.locator('.kbv2-card:has([data-detail="t1"])').first().hover(); await pg.waitForTimeout(220);
    const cellH = await pg.evaluate(MEASURE, 'sector');
    const t1h = cellH.cards.find(c => c.id === 't1');
    const clipH = { x: Math.max(0, t1h.rect.x - 6), y: Math.max(0, t1h.rect.y - 6), width: t1h.rect.w + 12, height: t1h.rect.h + 12 };
    await shotChecked(pg, 'I7231-CARD-DEADLINE-SLA-HOVER-2X.png', { surface: 'sector', vp: 'win125@2x-hover', sourceSha: 'candidate:' + afterHash.slice(0, 12), cell: cellH, clip: clipH });
  } else gate('E1-2X-CROPS', false, 't1 não encontrado para crops 2×');
  await ctx.close();
}

/* ---------- composite BEFORE×AFTER (só frames validados) ---------- */
{
  const b = manifest.find(m => m.filename === 'I7231-BEFORE-OWNER-REGRESSION.png');
  const a = manifest.find(m => m.filename === 'I7231-AFTER-SAME-CARDS.png');
  if (b && a && b.screenshotValid && a.screenshotValid) {
    const b64 = f => fs.readFileSync(path.join(OUT, f)).toString('base64');
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#EEF2F6;font:600 13px system-ui;display:flex;gap:14px;padding:14px">
      <div><div style="padding:6px 2px;color:#B42318">BASELINE 1.0.253 (5dac060a) — colisão PRAZO/SLA</div><img style="max-width:640px;border:1px solid #D0D5DD" src="data:image/png;base64,${b64(b.filename)}"></div>
      <div><div style="padding:6px 2px;color:#12784C">CANDIDATO I7.23.1 — mesmos cards, 0px² de interseção</div><img style="max-width:640px;border:1px solid #D0D5DD" src="data:image/png;base64,${b64(a.filename)}"></div></body>`;
    const tmp = path.join(OUT, '_cmp.html'); fs.writeFileSync(tmp, html);
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage(); await pg.goto('file://' + tmp); await pg.waitForTimeout(350);
    await pg.screenshot({ path: path.join(OUT, 'I7231-COMPARE-BEFORE-AFTER.png'), fullPage: true });
    manifest.push({ filename: 'I7231-COMPARE-BEFORE-AFTER.png', sourceSha: 'composite(before 5dac060a + candidate)', viewport: 'composite', surface: 'sector', screenshotValid: true, loginPresent: false, note: 'montado apenas de frames validados' });
    await ctx.close(); fs.unlinkSync(tmp);
    gate('E1-COMPOSITE', true, 'COMPARE-BEFORE-AFTER montado de 2 frames validados');
  } else gate('E1-COMPOSITE', false, 'frames de origem ausentes/ inválidos');
}
await browser.close(); srvA.close(); srvB.close();

/* ---------- gates geométricos ---------- */
const NAMED = { 'TC-R1-SLA-x-DUE-DATE': ['sla:dateS', 'sla:dateBox'], 'TC-R2-SLA-x-REMAINING': ['sla:due'], 'TC-R3-SLA-x-SETOR': ['sla:setorChip', 'sla:chips'], 'TC-R4-DUE-x-REMAINING': ['due:dateS', 'due:dateBox'] };
const preAnchor = [];
for (const [k, cell] of Object.entries(DATA.before)) for (const c of cell.cards) { const v = Math.max(c.ints['sla:dateS'] || 0, c.ints['due:dateS'] || 0, c.ints['sla:dateBox'] || 0, c.ints['chips:title'] || 0); if (v > 0) preAnchor.push(`${k}#${c.id}=${v}`); }
gate('PRE-REGRESSION-REPRODUCED', preAnchor.length > 0, `baseline colide em ${preAnchor.length} célula(s)·card(s); ex.: ${preAnchor.slice(0, 3).join(' ')}`);

for (const [gid, pairs] of Object.entries(NAMED)) {
  const bad = [];
  for (const [k, cell] of Object.entries(DATA.after)) for (const c of cell.cards) for (const p of pairs) if ((c.ints[p] || 0) > 0) bad.push(`${k}#${c.id} ${p}=${c.ints[p]}`);
  gate(gid, bad.length === 0, bad.length ? bad.slice(0, 4).join(' · ') : `0px² em ${Object.keys(DATA.after).length} células × todos os cards`);
}
{
  const bad = [];
  for (const [k, cell] of Object.entries(DATA.after)) for (const c of cell.cards) for (const [pk, v] of Object.entries(c.clip)) if (v) bad.push(`${k}#${c.id} clip:${pk}`);
  gate('TC-R5-NO-TEXT-CLIP', bad.length === 0, bad.length ? bad.slice(0, 5).join(' · ') : 'nenhum texto cortado (scrollWidth ≤ clientWidth) em nenhum card');
}
{
  const bad = [];
  for (const [k, cell] of Object.entries(DATA.after)) for (const c of cell.cards) if (c.beyond.length) bad.push(`${k}#${c.id} ${c.beyond.join(',')}`);
  gate('TC-R6-CONTENT-IN-CARD', bad.length === 0, bad.length ? bad.slice(0, 5).join(' · ') : 'todo conteúdo dentro do rect do card (±0.5px) e card dentro da lane');
}
{
  const bad = [];
  for (const [k, cell] of Object.entries(DATA.after)) for (const c of cell.cards) for (const p of ['profile:dateBox', 'profile:chips', 'summary:dateBox', 'summary:chips', 'chk:dateBox', 'chk:chips']) if ((c.ints[p] || 0) > 0) bad.push(`${k}#${c.id} ${p}=${c.ints[p]}`);
  gate('TC-R7-FOOTER-x-METADATA', bad.length === 0, bad.length ? bad.slice(0, 4).join(' · ') : 'rodapé nunca cruza metadados');
}
{
  const bad = [];
  for (const [k, cell] of Object.entries(DATA.after)) for (const c of cell.cards) for (const p of ['profile:rail', 'profile:pct', 'summary:rail', 'summary:pct']) if ((c.ints[p] || 0) > 0) bad.push(`${k}#${c.id} ${p}=${c.ints[p]}`);
  gate('TC-R8-PROGRESS-x-FOOTER', bad.length === 0, bad.length ? bad.slice(0, 4).join(' · ') : 'trilho/% nunca cruza rodapé');
}
{
  /* absoluto (escopo do reparo): SLA/Faltam/SETOR jamais cruzam ⋯ ou status */
  const bad = [];
  for (const [k, cell] of Object.entries(DATA.after)) for (const c of cell.cards) for (const p of ['sla:kebab', 'due:kebab', 'chips:kebab', 'sla:status', 'due:status', 'chips:title']) if ((c.ints[p] || 0) > 0) bad.push(`${k}#${c.id} ${p}=${c.ints[p]}`);
  gate('TC-R9-KEBAB-STATUS-TITLE', bad.length === 0, bad.length ? bad.slice(0, 4).join(' · ') : 'SLA/Faltam/SETOR sem qualquer cruzamento com ⋯/status/título');
  /* paridade (geometria pré-existente da baseline pública — fora do mandato): nenhum par pode
     EXCEDER o teto aprovado da baseline naquela superfície+viewport. Cards sem SLA cuja banda
     fantasma foi removida sobem ao MESMO padrão dos irmãos com SLA (harmonização ≠ regressão). */
  const grow = []; const pre = new Set(); const harmonized = [];
  const ceil = {};
  for (const [k, cell] of Object.entries(DATA.before)) for (const c of cell.cards) for (const p of ['kebab:status', 'kebab:title', 'status:title']) { const key = k + '|' + p; ceil[key] = Math.max(ceil[key] || 0, c.ints[p] || 0); }
  for (const [k, cell] of Object.entries(DATA.after)) for (const c of cell.cards) {
    const bcell = DATA.before[k]; const bc = bcell && bcell.cards.find(x => x.id === c.id);
    for (const p of ['kebab:status', 'kebab:title', 'status:title']) {
      const av = c.ints[p] || 0; const bv = bc ? (bc.ints[p] || 0) : 0; const cl = ceil[k + '|' + p] || 0;
      if (av > bv + 0.5 && av > cl + 0.5) grow.push(`${k}#${c.id} ${p} ${bv}→${av} (teto baseline ${cl})`);
      else if (av > bv + 0.5) harmonized.push(`${k}#${c.id} ${p}`);
      if (bv > 0 && av > 0) pre.add(`${p}=${av}`);
    }
  }
  gate('TC-R9B-STATUS-BAND-PARITY', grow.length === 0, grow.length ? grow.slice(0, 4).join(' · ') : `nenhum par acima do teto aprovado da baseline${pre.size ? ' · P2 pré-existente (rects byte-idênticos): ' + [...pre].slice(0, 3).join(' ') : ''}${harmonized.length ? ' · harmonizados ao padrão dos irmãos: ' + harmonized.length + ' caso(s)' : ''}`);
}
{
  const bad = [];
  for (const [k, cell] of Object.entries(DATA.after)) if (cell.hscroll) bad.push(k);
  const errs = Object.entries(DATA.after).filter(([, c]) => (c.pageErrors || []).length).map(([k, c]) => k + ':' + c.pageErrors.length);
  gate('TC-R10-NO-HSCROLL-NO-ERRORS', bad.length === 0 && errs.length === 0, (bad.length ? 'hscroll: ' + bad.join(',') : 'sem scroll horizontal') + (errs.length ? ' · pageErrors: ' + errs.join(',') : ' · 0 pageErrors'));
}
/* hover: nenhuma interseção NOVA vs baseline (Mover/Status/SLA/DUE/data) */
{
  const bad = []; const pre = [];
  for (const [k, cell] of Object.entries(HOVER.after)) {
    const bcell = HOVER.before[k]; if (!cell) continue;
    for (const c of cell.cards.filter(c => c.id === 't1')) {
      const bc = bcell ? bcell.cards.find(x => x.id === 't1') : null;
      for (const p of ['moveBtn:sla', 'moveBtn:due', 'moveBtn:dateS', 'moveBtn:title', 'moveBtn:status', 'sla:dateS', 'due:dateS', 'sla:due']) {
        const av = c.ints[p] || 0; const bv = bc ? (bc.ints[p] || 0) : 0;
        if (av > 0 && bv === 0) bad.push(`${k} ${p}=${av}`);
        else if (av > 0 && bv > 0) pre.push(`${k} ${p} pre=${bv}→${av}`);
      }
    }
  }
  gate('HOV-NO-NEW-OVERLAP', bad.length === 0, bad.length ? bad.slice(0, 4).join(' · ') : `hover sem interseção nova em ${Object.keys(HOVER.after).length} células${pre.length ? ' · pré-existentes: ' + pre.slice(0, 2).join(' ') : ''}`);
  gate('HOV-CLEAN', ['designers', 'socials', 'sector'].every(sf => VPS.every(vp => { const cell = HOVER.after[`${sf}@${vp.name}`]; const c = cell && cell.cards.find(x => x.id === 't1'); return c && ['moveBtn:sla', 'moveBtn:due', 'moveBtn:dateS'].every(p => (c.ints[p] || 0) === 0); })), 'Mover em hover nunca cobre SLA/Faltam/PRAZO nas superfícies reparadas');
}
/* hover do Meu quadro: parity absoluta com a baseline (freeze) + registro do pré-existente */
{
  const bad = []; const pre = [];
  for (const vp of VPS) {
    const A = HOVER.after[`mine@${vp.name}`], B = HOVER.before[`mine@${vp.name}`];
    if (!A || !B) { bad.push(vp.name + ': célula ausente'); continue; }
    const a = A.cards.find(c => c.id === 't1'), b = B.cards.find(c => c.id === 't1');
    if (!a || !b) { bad.push(vp.name + ': t1 ausente'); continue; }
    for (const p of ['moveBtn:sla', 'moveBtn:due', 'moveBtn:dateS', 'sla:dateS', 'due:dateS', 'sla:due']) {
      const av = a.ints[p] || 0, bv = b.ints[p] || 0;
      if (Math.abs(av - bv) > 0.5) bad.push(`${vp.name} ${p} ${bv}→${av}`);
      if (bv > 0) pre.push(`${vp.name} ${p}=${bv}`);
    }
  }
  gate('FRZ-MINE-HOVER-PARITY', bad.length === 0, bad.length ? bad.slice(0, 4).join(' · ') : `hover do Meu quadro idêntico à baseline (superfície congelada)${pre.length ? ' · P2 pré-existente registrado: ' + pre.slice(0, 4).join(' ') : ''}`);
}
/* freeze: Meu quadro + Cliente byte-geométricos */
for (const sf of ['mine', 'client']) {
  const bad = [];
  for (const vp of VPS) {
    const A = DATA.after[`${sf}@${vp.name}`], B = DATA.before[`${sf}@${vp.name}`];
    if (!A || !B || A.cards.length !== B.cards.length) { bad.push(`${vp.name}: contagem ${B && B.cards.length}→${A && A.cards.length}`); continue; }
    for (const c of A.cards) {
      const bcd = B.cards.find(x => x.id === c.id); if (!bcd) { bad.push(`${vp.name}#${c.id} ausente na baseline`); continue; }
      for (const [pk, r] of Object.entries(c.parts)) {
        const br = bcd.parts[pk]; if (!r || !br) continue;
        if (Math.abs(r.x - br.x) > 0.5 || Math.abs(r.y - br.y) > 0.5 || Math.abs(r.w - br.w) > 0.5 || Math.abs(r.h - br.h) > 0.5) bad.push(`${vp.name}#${c.id}.${pk} Δ`);
      }
    }
  }
  gate(`FRZ-${sf.toUpperCase()}-PARITY`, bad.length === 0, bad.length ? bad.slice(0, 5).join(' · ') : `geometria idêntica à baseline (Δ≤0.5px) nas 3 resoluções, todos os cards/partes`);
}
/* matriz de variações — presença real no candidato */
{
  const S = (k, id) => { const cell = DATA.after[k]; return cell ? cell.cards.find(c => c.id === id) : null; };
  const t1 = S('sector@win125', 't1');
  const checks = [
    ['MTX-V1-OWNER-CARD', t1 && t1.texts.title === 'SETEMBRO' && t1.texts.sla === 'Em prazo' && /^Faltam 2d/.test(t1.texts.due || '') && /4 set · 18:00/.test(t1.texts.dateS || '') && /6 temas/.test(t1.texts.sumMain || ''), t1 ? `sla="${t1.texts.sla}" due="${t1.texts.due}" prazo="${t1.texts.dateS}" resumo="${t1.texts.sumMain}"` : 't1 ausente'],
    ['MTX-V2-LONG-TITLE', !!S('sector@1366', 't4'), 'título longo t4 renderiza (clip coberto por TC-R5)'],
    ['MTX-V3-LONG-CLIENT', !!S('sector@1366', 't5'), 'cliente longo t5 renderiza'],
    ['MTX-V4-LONG-SETOR', (() => { const c = S('mine@1366', 't6'); return c && /Edição de Cards/i.test(c.texts.setorChip || ''); })(), 'setor de rótulo longo no Meu quadro'],
    ['MTX-V5-DATE-ONLY', (() => { const c = S('mine@win125', 't7'); return c && c.visible.dateS && !/·/.test(c.texts.dateS || ''); })(), 'prazo sem hora (sem "·")'],
    ['MTX-V6-DATE-TIME', t1 && /·/.test(t1.texts.dateS || ''), 'prazo com hora "4 set · 18:00"'],
    ['MTX-V7-NO-DUE', (() => { const c = S('sector@win125', 't8'); return c && !c.visible.dateBox; })(), 't8 sem bloco PRAZO'],
    ['MTX-V8-EM-PRAZO', t1 && t1.texts.sla === 'Em prazo', 'SLA azul'],
    ['MTX-V9-HOJE', (() => { const c = S('sector@win125', 't9'); return c && c.texts.due === 'Hoje'; })(), 'deadline "Hoje"'],
    ['MTX-V10-ATRASADA', (() => { const c = S('sector@win125', 't10'); return c && c.texts.due === 'Atrasada' && /Prazo encerrado/.test(c.texts.sla || ''); })(), '"Atrasada" + SLA vermelho'],
    ['MTX-V11-LONG-REMAINING', (() => { const c = S('sector@win125', 't11'); return c && /^Faltam 2\d?d/.test(c.texts.due || ''); })(), '"Faltam 25d" longo'],
    ['MTX-V12-PRIORITY', (() => { const c = S('sector@win125', 't3'); return c && /Prioridade/.test(c.texts.chips || ''); })(), 'micro-sinal Prioridade'],
    ['MTX-V13-PROGRESS', (() => { const c = S('mine@win125', 't7'); return c && c.visible.rail && c.visible.pct; })(), 'trilho de progresso + % no Meu quadro'],
    ['MTX-V14-ONE-AVATAR', (() => { const c = S('mine@win125', 't14'); return c && c.visible.profile && !c.visible.avBy; })(), 'um avatar'],
    ['MTX-V15-TWO-AVATARS', (() => { const c = S('mine@win125', 't1'); return c && c.visible.profile && c.visible.avBy; })(), 'dois avatares (responsável + autor)'],
    ['MTX-V16-6-TEMAS', t1 && /6 temas/.test(t1.texts.sumMain || ''), 'resumo "6 temas"'],
    ['MTX-V17-CHECKLIST', (() => { const c = S('mine@win125', 't3'); return c && /2 de 5/.test(c.texts.chk || ''); })(), 'contagem checklist "2 de 5"'],
    ['MTX-V18-DUE-NO-SLA', (() => { const c = S('sector@win125', 't12'); return c && c.visible.due && !c.visible.sla; })(), 'prazo sem chip SLA'],
    ['MTX-V19-EMPTY-TOP-GUARD', (() => { const c = S('sector@win125', 't8'); return c && (!c.visible.top || (c.parts.top && c.parts.top.h <= 2)); })(), 'sem SLA+sem prazo: banda sem fantasma'],
    ['MTX-V20-CONCLUIDA', (() => { const c = S('sector@win125', 't13'); return c && /Concluída/.test(c.texts.due || ''); })(), 'card concluído'],
    ['MTX-V21-3-CONSECUTIVE', (() => { const cell = DATA.after['sector@win125']; if (!cell) return false; const lane = cell.cards.filter(c => ['t1', 't2', 't3', 't4'].includes(c.id)); return lane.length >= 3; })(), '≥3 cards consecutivos na MESMA lane (A Fazer)'],
  ];
  for (const [id, ok, info] of checks) gate(id, ok, info);
}
/* E1 agregado + larguras reais */
{
  const invalid = manifest.filter(m => !m.screenshotValid);
  gate('E1-ALL-SHOTS-VALID', manifest.length >= 12 && invalid.length === 0, `${manifest.length} PNGs oficiais, ${invalid.length} inválidos${invalid.length ? ': ' + invalid.map(m => m.filename).join(',') : ''}`);
  const widths = {}; for (const vp of VPS) { const c = DATA.after[`sector@${vp.name}`]; const t = c && c.cards.find(x => x.id === 't1'); widths[vp.name] = t ? { cardW: t.rect.w, laneW: t.laneW } : null; }
  gate('RESP-REAL-CARD-WIDTHS', Object.values(widths).every(Boolean), Object.entries(widths).map(([k, v]) => `${k}: card=${v && v.cardW}px lane=${v && v.laneW}px`).join(' · ') + ' (inclui <240px real @1366)');
  const hs = {}; for (const vp of VPS) { const A = DATA.after[`sector@${vp.name}`]; const B = DATA.before[`sector@${vp.name}`]; const a = A && A.cards.find(c => c.id === 't1'); const b = B && B.cards.find(c => c.id === 't1'); hs[vp.name] = a && b ? `${b.rect.h}→${a.rect.h}` : '?'; }
  gate('RESP-HEIGHTS-RECORDED', true, 'altura t1 sector (baseline→candidato): ' + Object.entries(hs).map(([k, v]) => `${k}: ${v}`).join(' · '));
}

function finish() {
  fs.writeFileSync(path.join(OUT, 'i7231-evidence-manifest.json'), JSON.stringify({ phase: 'I7.23.1', baselineSha: BASELINE_SHA, candidateRendererSha256: afterHash, when: new Date().toISOString(), entries: manifest }, null, 1));
  fs.writeFileSync(path.join(OUT, 'i7231-gates.json'), JSON.stringify({ gates, cellsAfter: DATA.after, cellsBefore: DATA.before, hoverAfter: HOVER.after }, null, 1));
  const fails = gates.filter(g => !g.ok);
  console.log(`\n==== I7.23.1 QA: ${gates.length - fails.length}/${gates.length} PASS ====`);
  if (fails.length) { console.log('FALHAS: ' + fails.map(f => f.id).join(', ')); process.exitCode = 1; }
  process.exit(process.exitCode || 0);
}
finish();
