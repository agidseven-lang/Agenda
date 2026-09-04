#!/usr/bin/env node
/* I7.27.1-EXT-R1 — QA visual/funcional do REFINE do owner:
 *   A) BRAND: asset oficial APLICADO de verdade (index.html do worktree) × commit anterior (tile "7") — BR-R1..R10;
 *   B) ALERTA CENTRAL DE PRAZO: dialog premium compacto (slareminder.html REAL, view kind:'deadline') — geometria
 *      (580px; CTA 44px; avatar 40; hscroll/clipping 0) nos 3 alvos (1920 · Win125 · 1366), Entendi/Abrir tarefa,
 *      fila, alerta encerrado; composite BEFORE (commit anterior, servido do git) × AFTER;
 *   C) PARIDADE SLA ↔ CONTEXTO DO DESIGNER (§6-§8): para a MESMA taskId, régua REAL do renderer (canSeeTask /
 *      KPI Tarefas / Tarefas urgentes / Meu quadro) × elegibilidade da escalação — CTX-R1..R10 + SLA_CONTEXT_PARITY_REPORT;
 *      estado COERENTE (write-path real: assigneeId=designerId) e estado DIVERGENTE (guard: não elegível).
 * Uso: node desktop/scripts/visual-qa-i7271r1-refine.mjs   (env I7271R1_BEFORE_REF = commit anterior; default 4944a5a4)
 * Saída: desktop/qa-out-i7271/ — I7271R1-*.png + i7271r1-gates.json + i7271r1-sla-context-parity.json. Exit 1 se falhar.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ROOT = path.join(REPO, 'desktop', 'src', 'renderer');
const OUT = path.join(REPO, 'desktop', 'qa-out-i7271');
const CHROME = process.env.QA_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const BEFORE_REF = process.env.I7271R1_BEFORE_REF || '4944a5a4';
const require2 = createRequire(import.meta.url);
const ESC = require2(path.join(REPO, 'desktop', 'src', 'main', 'slaEscalationRules.js'));
fs.mkdirSync(OUT, { recursive: true });
const GATES = []; let FAILED = 0;
function gate(id, cond, info) { GATES.push({ id, pass: !!cond, info: info === undefined ? null : info }); if (!cond) { FAILED++; console.error('  ✗ ' + id + (info !== undefined ? ' :: ' + JSON.stringify(info) : '')); } else console.log('  ✓ ' + id); }
const gitShow = (f) => { try { return execFileSync('git', ['show', BEFORE_REF + ':' + f], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'); } catch { return ''; } };

const IDX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const IDX_BEFORE = gitShow('desktop/src/renderer/index.html');
const SLR_BEFORE = gitShow('desktop/src/renderer/slareminder.html');
const OVR2 = "brandlogo::after{content:'7'";
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/index-before.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(IDX_BEFORE); return; }
  if (u === '/slareminder-before.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(SLR_BEFORE); return; }
  const p = path.join(ROOT, u === '/' ? 'index.html' : decodeURIComponent(u));
  let body = null; try { body = fs.readFileSync(p); } catch { /* 404 */ }
  if (body == null) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(body);
});
await new Promise((r) => srv.listen(8915, r));
const browser = await chromium.launch({ executablePath: CHROME });
const RES = [{ n: '1920', vp: { width: 1920, height: 1080 }, dsf: 1 }, { n: 'WIN125', vp: { width: 1536, height: 864 }, dsf: 1.25 }, { n: '1366', vp: { width: 1366, height: 768 }, dsf: 1 }];

/* ───────── app REAL (index.html) — estado COERENTE do produto (assigneeId = designer, dueDate hoje) ───────── */
const TASK_ID = 'ceo-set-01';
const todayStr = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };
const nowMs = Date.now();
const dueLater = new Date(nowMs + 101 * 60000);            // prazo hoje, daqui a 1h41 (crítico)
const dueTime = String(dueLater.getHours()).padStart(2, '0') + ':' + String(dueLater.getMinutes()).padStart(2, '0');
const DUE_AT = new Date(dueLater.getFullYear(), dueLater.getMonth(), dueLater.getDate(), dueLater.getHours(), dueLater.getMinutes()).getTime();
const taskCoherent = { id: TASK_ID, title: 'CEO / SETEMBRO', client: 'CEO', sector: 'cronograma', by: 'owner', assigneeId: 'boaz', status: 'afazer', designerFlowStatus: 'afazer',
  dueDate: todayStr(), dueTime, dueAt: DUE_AT, createdAt: nowMs - 3 * 86400000,
  designerAssignment: { designerId: 'boaz', designerName: 'Boaz', status: 'sent', assignedAt: nowMs - 2 * 86400000, assignedBy: 'owner' } };
const taskDivergent = Object.assign({}, taskCoherent, { id: TASK_ID + '-div', assigneeId: 'owner' });
async function newApp(pathname, vp, dsf, tasks) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1920, height: 1080 }, deviceScaleFactor: dsf || 1 });
  await ctx.addInitScript(() => {
    const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop });
    ['initializeApp', 'getFirestore', 'getAuth'].forEach((k) => { window[k] = noop; }); window.firebase = noop;
    window.__cbs = {}; window.__acks = []; document.hasFocus = () => true;
    window.desktopAPI = { onNotifToast(cb) { window.__cbs['notif-toast'] = cb; }, onNotifHistory(cb) { window.__cbs['notif-history'] = cb; }, onNotifOpen(cb) { window.__cbs['notif-open'] = cb; }, onNotifGroupUpdate() {}, onNotifCollectRequest() {}, onNotifCollectCommit() {}, notifToastAck(k) { window.__acks.push(String(k)); }, notifCollectReply() {}, diagLog() {}, notify() {} };
  });
  const pg = await ctx.newPage(); const perr = []; pg.on('pageerror', (e) => perr.push(String(e).slice(0, 160)));
  await pg.goto('http://127.0.0.1:8915' + pathname, { waitUntil: 'load' }); await pg.waitForTimeout(2200);
  await pg.evaluate((tasks) => {
    window._revealLogin = function () {};
    state.user = { id: 'boaz', name: 'Boaz', role: 'Designer' };
    state.users = [state.user, { id: 'owner', name: 'Owner', role: 'Social Media', admin: true }];
    document.body.classList.add('desktop', 'authed', 'light-ui');
    const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
    const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
    const asp = document.getElementById('authSplash'); if (asp) asp.style.display = 'none';
    state.tasks = tasks; state.events = []; state.tab = 'hoje'; state.personBoard = null; render();
  }, tasks);
  return { ctx, pg, perr };
}

console.log('— A) BRAND (real, aplicado) —');
const hasLogoVar = /--logo:url\('data:image\/png;base64,/.test(IDX) && /\.logo\.brandlogo\{background:var\(--logo\) center\/contain no-repeat!important/.test(IDX);
gate('BR-R1 asset oficial: desktop/build/icon.png + --logo (mesma arte, PNG 256² embutido)', fs.existsSync(path.join(REPO, 'desktop', 'build', 'icon.png')) && hasLogoVar);
gate('BR-R2 nenhum asset fabricado: override do tile "7" REMOVIDO do worktree (existia no commit anterior)', !IDX.includes(OVR2) && IDX_BEFORE.includes(OVR2) && !/linear-gradient\(150deg,#2DD4BF,#0D9488\) !important/.test(IDX));
gate('BR-R3 empacotado: --logo inline no index.html (asar) + build/icon.png em extraResources', hasLogoVar && /from: build\/icon\.png/.test(fs.readFileSync(path.join(REPO, 'desktop', 'electron-builder.yml'), 'utf8')));
const brandMeasure = async (pg) => pg.evaluate(() => {
  const nav = document.querySelector('.nav'); const b = document.querySelector('.sb-brand'); const lg = document.querySelector('.sb-brand .logo.brandlogo');
  const r = lg.getBoundingClientRect(); const cs = getComputedStyle(lg); const af = getComputedStyle(lg, '::after'); const nr = nav.getBoundingClientRect();
  const on = document.querySelector('.nav .sb-item.on'); const anchor = document.querySelector('.nav [data-tab="perfil"]');
  const wm = document.querySelector('.lui-wm'); const wmr = wm ? wm.getBoundingClientRect() : { width: 0, height: 0 };
  return { navW: nr.width, brandH: b.getBoundingClientRect().height, logo: { w: r.width, h: r.height, x: r.left, y: r.top, bgImage: cs.backgroundImage.slice(0, 22), afterContent: af.content },
    inside: r.left >= nr.left && r.right <= nr.right && r.top >= nr.top, onItem: on ? on.textContent.trim() : '', anchorTop: anchor ? Math.round(anchor.getBoundingClientRect().top) : -1,
    items: [...document.querySelectorAll('.nav .sb-item')].map((e) => e.textContent.trim()), wm: { w: Math.round(wmr.width), h: Math.round(wmr.height), text: wm ? wm.textContent.trim() : '' } };
});
const brandInfo = {};
for (const r of RES) {
  const A0 = await newApp('/index-before.html', r.vp, r.dsf, [taskCoherent]); const m0 = await brandMeasure(A0.pg);
  const A1 = await newApp('/index.html', r.vp, r.dsf, [taskCoherent]); const m1 = await brandMeasure(A1.pg);
  if (r.n === '1920') { await A1.pg.screenshot({ path: path.join(OUT, 'I7271R1-BRAND-AFTER-REAL.png') }); await A1.pg.screenshot({ path: path.join(OUT, 'I7271R1-BRAND-AFTER-REAL-CROP.png'), clip: { x: 0, y: 0, width: 300, height: 120 } }); }
  brandInfo[r.n] = { before: m0, after: m1 };
  const assetPainted = m1.logo.bgImage.indexOf('url(') === 0 && (m1.logo.afterContent === 'none' || m1.logo.afterContent === '""');
  const beforeWas7 = m0.logo.afterContent === '"7"';
  gate('BR-R4/5/6 ' + r.n + ': asset oficial pintado (antes: tile "7"), ≥30px, visível e contido na sidebar', assetPainted && beforeWas7 && m1.logo.w >= 30 && m1.logo.h >= 30 && m1.inside, { before: m0.logo, after: m1.logo });
  gate('BR-R7/8/9/10 ' + r.n + ': sem clipping; largura da nav/altura do brand/wordmark/nav selecionada/âncora/itens IDÊNTICOS ao commit anterior',
    Math.abs(m0.navW - m1.navW) < 0.5 && Math.abs(m0.brandH - m1.brandH) < 0.5 && m0.onItem === m1.onItem && m0.anchorTop === m1.anchorTop && m0.items.join('|') === m1.items.join('|') && m0.wm.text === m1.wm.text && m0.wm.w === m1.wm.w && Math.abs(m0.logo.w - m1.logo.w) < 0.5,
    { navW: [m0.navW, m1.navW], brandH: [m0.brandH, m1.brandH], on: [m0.onItem, m1.onItem], anchor: [m0.anchorTop, m1.anchorTop], wm: [m0.wm, m1.wm] });
  await A0.ctx.close(); await A1.ctx.close();
}

console.log('— B) ALERTA CENTRAL DE PRAZO — dialog premium compacto —');
const WIN_W = Number((fs.readFileSync(path.join(REPO, 'desktop', 'src', 'main', 'slaReminderWindow.ts'), 'utf8').match(/const WIDTH = (\d+);/) || [])[1]) || 0;
gate('§3 janela central = ' + WIN_W + 'px ⇒ dialog 580px (faixa 560–620)', WIN_W - 60 >= 560 && WIN_W - 60 <= 620, WIN_W);
async function newCentral(pathname, dsf) {
  const ctx = await browser.newContext({ viewport: { width: WIN_W || 640, height: 700 }, deviceScaleFactor: dsf || 2 });
  await ctx.addInitScript(() => {
    window.__ok = []; window.__open = []; window.__rendered = []; window.__h = [];
    window.slaAPI = { _cb: null, onCard(cb) { this._cb = cb; }, rendered(k) { window.__rendered.push(k); }, resize(h) { window.__h.push(h); }, setProcessing() {}, obs() {},
      ok(k) { window.__ok.push(String(k)); }, open(d) { window.__open.push(String(d)); }, decide() {}, onResult() {}, dismiss() {}, resolveHelp() {}, onHelpCandidates() {},
      checkinDecide() {}, onCheckinResult() {}, checkinDraft() {}, checkinDismiss() {}, checkinResolveHelp() {}, onCheckinHelpCandidates() {} };
  });
  const pg = await ctx.newPage(); const perr = []; pg.on('pageerror', (e) => perr.push(String(e).slice(0, 160)));
  await pg.goto('http://127.0.0.1:8915' + pathname, { waitUntil: 'load' }); await pg.waitForTimeout(250);
  return { ctx, pg, perr };
}
const view = (over, extra) => Object.assign({
  key: 'sla_deadline:' + (over ? 'overdue' : 'critical') + ':' + TASK_ID + ':boaz:' + DUE_AT, base: TASK_ID + ':boaz', level: 'critical',
  title: over ? 'PRAZO VENCIDO' : 'PRAZO EM RISCO', actorName: 'Boaz', actorAvatar: '', taskTitle: 'CEO / SETEMBRO', clientName: 'CEO',
  body: '', context: '', deep: 'detail/' + TASK_ID, queueLen: 1, soundDataUri: '', decisionsEnabled: true, taskId: TASK_ID,
  kind: 'deadline', deadlineLevel: over ? 'overdue' : 'critical', dueAtMs: over ? nowMs - 36 * 60000 : DUE_AT, idleSinceMs: nowMs - 3 * 86400000, slaThreshold: over ? 'OVERDUE' : 'T_MINUS_2H',
}, extra || {});
const measureDialog = () => {
  const card = document.getElementById('card'); const cr = card.getBoundingClientRect(); const cs = getComputedStyle(card);
  const band = getComputedStyle(card, '::before');
  const q = (s) => document.querySelector(s); const rect = (s) => { const e = q(s); return e ? e.getBoundingClientRect() : null; };
  const hs = [...document.querySelectorAll('#wrap *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length;
  const inside = (r) => !!r && r.left >= cr.left - 0.5 && r.right <= cr.right + 0.5 && r.top >= cr.top - 0.5 && r.bottom <= cr.bottom + 0.5;
  const t = q('.dl-title');
  return { bg: cs.backgroundColor, radius: cs.borderRadius, bandColor: band.backgroundColor, bandH: band.height, w: cr.width, h: cr.height, wrapH: document.getElementById('wrap').getBoundingClientRect().height,
    av: rect('.dl-av') ? rect('.dl-av').width : 0, cta: rect('#dl_open') ? { h: rect('#dl_open').height, w: rect('#dl_open').width, inside: inside(rect('#dl_open')), bg: getComputedStyle(q('#dl_open')).backgroundColor, color: getComputedStyle(q('#dl_open')).color } : null,
    ack: rect('#dl_ack') ? { h: rect('#dl_ack').height, inside: inside(rect('#dl_ack')), bg: getComputedStyle(q('#dl_ack')).backgroundColor } : null,
    queue: q('#dl_queue') ? { text: q('#dl_queue').textContent, inside: inside(rect('#dl_queue')) } : null,
    title: t ? { text: t.textContent, size: getComputedStyle(t).fontSize, clipped: t.scrollHeight > t.clientHeight + 1, inside: inside(rect('.dl-title')) } : null,
    lbl: (q('.dl-kicker .lbl') || {}).textContent, chip: (q('.dl-state') || {}).textContent, who: (q('.dl-who') || {}).textContent,
    msg: (q('.dl-msg') || {}).textContent, sub: (q('.dl-sub') || {}).textContent, when: (q('#dl_when') || {}).textContent, rem: (q('#dl_rem') || {}).textContent, remk: (q('#dl_remk') || {}).textContent,
    legacyAvatarVisible: (() => { const a = document.getElementById('av'); return !!a && getComputedStyle(a).display !== 'none'; })(),
    legacyFieldsVisible: ['kicker', 'name', 'msg', 'task', 'foot', 'pend'].filter((id) => getComputedStyle(document.getElementById(id)).display !== 'none'),
    hs, rendered: window.__rendered.length, lastResize: window.__h[window.__h.length - 1] };
};
const C = await newCentral('/slareminder.html', 2);
await C.pg.evaluate((v) => { window.slaAPI._cb(v); }, view(false)); await C.pg.waitForTimeout(250);
const mC = await C.pg.evaluate(measureDialog);
await C.pg.screenshot({ path: path.join(OUT, 'I7271R1-SLA-CRITICAL.png'), clip: { x: 0, y: 0, width: WIN_W, height: Math.ceil(mC.wrapH) + 4 } });
gate('§2/§3 arquitetura: avatar 40 inline no header (legado 72px flutuante OCULTO), campos legados ocultos, dialog 580×' + Math.round(mC.h),
  Math.round(mC.av) === 40 && !mC.legacyAvatarVisible && mC.legacyFieldsVisible.length === 0 && mC.w === 580 && mC.h < 380, { av: mC.av, legacyAv: mC.legacyAvatarVisible, legacyFields: mC.legacyFieldsVisible, w: mC.w, h: mC.h });
gate('§3 header: "Prazo em risco" + chip "Crítico" + "Responsável · Boaz"; título 17px CEO / SETEMBRO; mensagem + subtexto do prazo',
  mC.lbl === 'Prazo em risco' && mC.chip === 'Crítico' && /Responsável · Boaz/.test(mC.who || '') && mC.title && mC.title.text === 'CEO / SETEMBRO' && mC.title.size === '17px' && mC.msg === 'Esta tarefa ainda não foi iniciada.' && /O prazo termina hoje às \d\d:\d\d\./.test(mC.sub || ''), { lbl: mC.lbl, chip: mC.chip, who: mC.who, title: mC.title, msg: mC.msg, sub: mC.sub });
gate('§3 banda de metadados baixa: PRAZO "Hoje · HH:MM" + FALTAM "1h 4xmin"', /^Hoje · \d\d:\d\d$/.test(mC.when || '') && /^1h (39|40|41|42)min$/.test(mC.rem || '') && mC.remk === 'Faltam', { when: mC.when, rem: mC.rem, remk: mC.remk });
gate('§3 ações: Abrir tarefa primária 44px (âmbar forte, texto branco) + Entendi secundária quieta 44px (branca com borda)', mC.cta && mC.cta.h === 44 && mC.cta.bg === 'rgb(180, 83, 9)' && mC.cta.color === 'rgb(255, 255, 255)' && mC.ack && mC.ack.h === 44 && mC.ack.bg === 'rgb(255, 255, 255)', { cta: mC.cta, ack: mC.ack });
gate('§4 severidade CRÍTICO: superfície #FFF + barra fina âmbar 4px (sem fundo colorido/gradiente)', mC.bg === 'rgb(255, 255, 255)' && mC.bandColor === 'rgb(245, 158, 11)' && mC.bandH === '4px' && mC.radius === '14px', { bg: mC.bg, band: mC.bandColor, bandH: mC.bandH, radius: mC.radius });
gate('§10 ALERT_HSCROLL=0 · CTA/ENTENDI dentro do card · TITLE_CLIPPING_DESTRUCTIVE=0 · render ACK', mC.hs === 0 && mC.cta.inside && mC.ack.inside && mC.title.inside && !mC.title.clipped && mC.rendered === 1, { hs: mC.hs, ctaIn: mC.cta.inside, ackIn: mC.ack.inside, titleIn: mC.title.inside, clipped: mC.title.clipped });
/* Entendi */
await C.pg.click('#dl_ack'); await C.pg.waitForTimeout(120);
const ackRes = await C.pg.evaluate(() => ({ ok: window.__ok.slice(), open: window.__open.slice() }));
gate('§11 Entendi ⇒ ok(key) e nada mais (sem open; sem mutação)', ackRes.ok.length === 1 && ackRes.open.length === 0, ackRes);
/* OVERDUE + fila */
await C.pg.evaluate((v) => { window.slaAPI._cb(v); }, view(true, { queueLen: 2 })); await C.pg.waitForTimeout(250);
const mO = await C.pg.evaluate(measureDialog);
await C.pg.screenshot({ path: path.join(OUT, 'I7271R1-SLA-OVERDUE.png'), clip: { x: 0, y: 0, width: WIN_W, height: Math.ceil(mO.wrapH) + 4 } });
gate('§4 OVERDUE: superfície #FFF + barra vermelha; "Prazo vencido" + chip "Atrasada"; SITUAÇÃO "vencido há 36min"; CTA vermelha 44px', mO.bg === 'rgb(255, 255, 255)' && mO.bandColor === 'rgb(220, 38, 38)' && mO.lbl === 'Prazo vencido' && mO.chip === 'Atrasada' && /vencido há 36min/.test(mO.rem || '') && mO.remk === 'Situação' && mO.cta.bg === 'rgb(220, 38, 38)' && mO.cta.h === 44, { band: mO.bandColor, lbl: mO.lbl, chip: mO.chip, rem: mO.rem, cta: mO.cta });
gate('§3 QUEUE: "2 alertas pendentes" como metadado discreto no header, contido (QUEUE_CLIPPING=0), num único card', mO.queue && mO.queue.text === '2 alertas pendentes' && mO.queue.inside && mO.hs === 0 && (await C.pg.evaluate(() => document.querySelectorAll('.card').length)) === 1, mO.queue);
/* OPEN TASK */
await C.pg.evaluate(() => { window.__ok.length = 0; window.__open.length = 0; });
await C.pg.evaluate((v) => { window.slaAPI._cb(v); }, view(false, { queueLen: 1 })); await C.pg.waitForTimeout(200);
await C.pg.click('#dl_open'); await C.pg.waitForTimeout(120);
const openRes = await C.pg.evaluate(() => ({ ok: window.__ok.slice(), open: window.__open.slice() }));
gate('CTX-R9 / §12 Abrir tarefa ⇒ open(detail/' + TASK_ID + ') da MESMA tarefa + reconhece', openRes.open.length === 1 && openRes.open[0] === 'detail/' + TASK_ID && openRes.ok.length === 1, openRes);
/* encerrado */
await C.pg.evaluate((v) => { window.slaAPI._cb(v); }, view(false, { deadlineClosed: true, body: 'Esta tarefa já foi iniciada — alerta encerrado.', decisionsEnabled: false })); await C.pg.waitForTimeout(150);
const mI = await C.pg.evaluate(() => ({ lbl: (document.querySelector('.dl-kicker .lbl') || {}).textContent, chip: (document.querySelector('.dl-state') || {}).textContent, closed: (document.querySelector('.dl-closed') || {}).textContent, btns: [...document.querySelectorAll('#dl button')].map((b) => b.textContent.trim()) }));
gate('§8 alerta encerrado (iniciou) ⇒ "Alerta encerrado" + chip "Encerrado" + aviso + OK', mI.lbl === 'Alerta encerrado' && mI.chip === 'Encerrado' && /já foi iniciada/.test(mI.closed || '') && mI.btns.join('|') === 'OK', mI);
/* legado intacto: view de SLA de produção continua com o shell original após uma view de prazo */
await C.pg.evaluate(() => { window.slaAPI._cb({ key: 'sla_warning:x:1', base: 'x:boaz', level: 'warning', title: 'ATENÇÃO', actorName: 'Boaz', actorAvatar: '', taskTitle: 'Outra tarefa', clientName: 'ACME', body: 'Você tem 30 minutos para concluir esta tarefa.', context: 'Prazo final: 18:00', deep: 'detail/x', queueLen: 1, soundDataUri: '', decisionsEnabled: true, taskId: 'x' }); }); await C.pg.waitForTimeout(150);
const mL = await C.pg.evaluate(() => ({ kicker: document.getElementById('kicker').textContent, avVisible: getComputedStyle(document.getElementById('av')).display !== 'none', dlHidden: document.getElementById('dl').hidden, wrapDl: document.getElementById('wrap').classList.contains('dl'), decisions: [...document.querySelectorAll('#foot button')].map((b) => b.textContent.trim()) }));
gate('LEGADO intacto: view de SLA de produção restaura shell original (avatar, ATENÇÃO, 5 decisões) e o dialog de prazo fica oculto', mL.kicker === 'ATENÇÃO' && mL.avVisible && mL.dlHidden && !mL.wrapDl && mL.decisions.length === 5, mL);
gate('SLA-R18 pageErrors janela central = 0', C.perr.length === 0, C.perr);
/* 3 alvos (DPI de cada tela; janela fixa 640; altura por conteúdo) */
for (const r of RES) {
  const Cr = await newCentral('/slareminder.html', r.dsf);
  await Cr.pg.evaluate((v) => { window.slaAPI._cb(v); }, view(false)); await Cr.pg.waitForTimeout(250);
  const m = await Cr.pg.evaluate(measureDialog);
  await Cr.pg.screenshot({ path: path.join(OUT, 'I7271R1-SLA-CRITICAL-' + r.n + '.png'), clip: { x: 0, y: 0, width: WIN_W, height: Math.ceil(m.wrapH) + 4 } });
  const maxH = Math.min(620, r.vp.height - 80);
  gate('§10 ' + r.n + ': dialog inteiro visível (altura ' + Math.round(m.wrapH) + ' ≤ min(620, tela−80)=' + maxH + '), hscroll 0, CTA/fila/título sem clipping',
    m.wrapH <= maxH && m.hs === 0 && m.cta.inside && m.ack.inside && m.title.inside && !m.title.clipped && WIN_W <= r.vp.width - 40, { h: m.wrapH, maxH, hs: m.hs });
  await Cr.ctx.close();
}
/* composite BEFORE (commit anterior, servido do git) × AFTER */
const CB = await newCentral('/slareminder-before.html', 2);
await CB.pg.evaluate((v) => { window.slaAPI._cb(v); }, view(false)); await CB.pg.waitForTimeout(250);
const bH = await CB.pg.evaluate(() => document.getElementById('wrap').getBoundingClientRect().height);
const bDims = await CB.pg.evaluate(() => { const c = document.getElementById('card').getBoundingClientRect(); const av = document.getElementById('av').getBoundingClientRect(); const el = document.getElementById('dl_open') || document.querySelector('.dbtn.primary'); const cta = el ? el.getBoundingClientRect() : { height: 0, width: 0 }; return { cardW: c.width, cardH: c.height, avatar: av.width, avatarFloating: av.top < c.top, ctaH: cta.height, ctaW: cta.width, ctaBanner: cta.width >= c.width * 0.8, wrapH: document.getElementById('wrap').getBoundingClientRect().height }; });
const beforePng = path.join(OUT, 'I7271R1-CENTRAL-BEFORE.png');
await CB.pg.screenshot({ path: beforePng, clip: { x: 0, y: 0, width: WIN_W, height: Math.ceil(bH) + 4 } });
await CB.ctx.close();
const b64 = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
const cmp = await browser.newPage({ viewport: { width: WIN_W * 2 + 60, height: Math.ceil(Math.max(bH, mC.wrapH)) + 70 }, deviceScaleFactor: 1 });
await cmp.setContent('<body style="margin:0;background:#EEF1F6;font:12px/1.4 Segoe UI,system-ui,sans-serif;color:#4C5261"><div style="display:flex;gap:20px;padding:20px"><div><div style="margin-bottom:6px;font-weight:700">BEFORE (I7.27.1-EXT) · card ' + Math.round(bDims.cardW) + '×' + Math.round(bDims.cardH) + ' · avatar ' + Math.round(bDims.avatar) + 'px · CTA ' + Math.round(bDims.ctaH) + 'px</div><img style="width:' + WIN_W + 'px" src="' + b64(beforePng) + '"></div><div><div style="margin-bottom:6px;font-weight:700">AFTER (R1) · dialog ' + Math.round(mC.w) + '×' + Math.round(mC.h) + ' · avatar ' + Math.round(mC.av) + 'px · CTA ' + Math.round(mC.cta.h) + 'px</div><img style="width:' + WIN_W + 'px" src="' + b64(path.join(OUT, 'I7271R1-SLA-CRITICAL.png')) + '"></div></div></body>');
await cmp.waitForTimeout(200);
await cmp.screenshot({ path: path.join(OUT, 'I7271R1-CENTRAL-BEFORE-AFTER.png') });
await cmp.close();
/* o que foi REJEITADO no BEFORE (§2): avatar gigante flutuando acima do card, CTA em faixa (banner de largura total), estrutura de
   pôster. O AFTER precisa provar a troca de ARQUITETURA — não uma redução de escala: avatar 40 inline, CTA botão inline 44–50px
   (largura < metade do dialog), dialog 560–620 com altura guiada pelo conteúdo. */
gate('§13 dimensões BEFORE→AFTER: card ' + Math.round(bDims.cardW) + '×' + Math.round(bDims.cardH) + ' → ' + Math.round(mC.w) + '×' + Math.round(mC.h) + '; avatar ' + Math.round(bDims.avatar) + ' flutuante → ' + Math.round(mC.av) + ' inline; CTA banner ' + Math.round(bDims.ctaW) + '×' + Math.round(bDims.ctaH) + ' → botão ' + Math.round(mC.cta.w) + '×' + Math.round(mC.cta.h),
  bDims.avatar >= 60 && bDims.avatarFloating && Math.round(mC.av) === 40 && bDims.ctaBanner && mC.cta.w < mC.w * 0.5 && mC.cta.h >= 44 && mC.cta.h <= 50 && mC.w >= 560 && mC.w <= 620 && mC.h < bDims.cardH + 120, bDims);

console.log('— C) PARIDADE SLA ↔ CONTEXTO DO DESIGNER (§6-§8) —');
const A = await newApp('/index.html', { width: 1920, height: 1080 }, 1, [taskCoherent, taskDivergent]);
const ctxRep = await A.pg.evaluate(([tid, tdiv]) => {
  const u = state.user;
  const rule = (t) => ({
    canSeeTask: canSeeTask(u, t),
    meuQuadro: (t.assigneeId === u.id || t.by === u.id),                       // renderPersonBoard: list = assigneeId===pid||by===pid
    kpiTarefas: (t.assigneeId === u.id || t.by === u.id) && t.status !== 'concluido', // renderHoje: myOpen
    urgentEligible: canSeeTask(u, t) && t.status !== 'concluido' && !!taskDeadline(t), // renderHoje: openTasks(visibleTasks) com deadline
    designerCol: designerCol(t), designerOf: designerOf(t),
  });
  const find = (id) => state.tasks.find((t) => t.id === id);
  const t = find(tid), d = find(tdiv);
  // DOM real do Hoje (já renderizado)
  const kpiVal = Number((document.querySelector('.stat[data-myboard] .v') || {}).textContent || 0);
  const hojeText = (document.querySelector('.col-tasks') || document.body).textContent;
  const urgentHasTitle = /CEO \/ SETEMBRO/.test(hojeText) && !/Nenhuma tarefa pendente/.test(hojeText);
  // Meu quadro REAL (renderPersonBoard)
  state.tab = 'tarefas'; state.personBoard = u.id; render();
  const boardText = (document.querySelector('.scr') || document.body).textContent;
  const boardHasTitle = (boardText.match(/CEO \/ SETEMBRO/g) || []).length;
  state.tab = 'hoje'; state.personBoard = null; render();
  return { currentUserId: u.id, kpiVal, urgentHasTitle, boardHasTitle, visibleIds: visibleTasks(u, state.tasks).map((x) => x.id),
    coherent: Object.assign({ taskId: t.id, assigneeId: t.assigneeId, by: t.by, designerAssignment: t.designerAssignment, status: t.status, designerFlowStatus: t.designerFlowStatus, dueAt: t.dueAt, dueDate: t.dueDate, dueTime: t.dueTime }, rule(t)),
    divergent: Object.assign({ taskId: d.id, assigneeId: d.assigneeId, by: d.by, designerAssignment: d.designerAssignment, status: d.status, dueAt: d.dueAt }, rule(d)) };
}, [TASK_ID, TASK_ID + '-div']);
const escC = ESC.isEscalationEligible(taskCoherent, nowMs), escD = ESC.isEscalationEligible(taskDivergent, nowMs);
const report = {
  phase: 'I7.27.1-EXT-R1', currentUserId: ctxRep.currentUserId, writePathTruth: 'index.html L11224: enviar ao designer grava assigneeId=designerId ("isola no quadro do designer (visibleTasks)"); L14226 idem na criação com designer',
  rules: { canSeeTask: 'operacional: assigneeId===uid || by===uid (index.html L4826)', meuQuadro: 'renderPersonBoard: assigneeId===pid || by===pid (L8275)', kpiTarefas: 'renderHoje myOpen: (assigneeId===uid||by===uid) && status!==concluido (L7893)', urgentes: 'renderHoje openTasks = visibleTasks(...)!==concluido com taskDeadline (L7895)', escalation: 'slaEscalationRules: designerAssignment.designerId + (assigneeId===uid||by===uid) [guard R1] + designerCol===afazer + dueAt' },
  coherent: Object.assign({}, ctxRep.coherent, { eligibleForEscalation: escC.eligible, escalationReason: escC.reason, escalationDueAt: escC.dueAtMs, eligibleForMeuQuadro: ctxRep.coherent.meuQuadro, eligibleForHojeTaskCount: ctxRep.coherent.kpiTarefas, eligibleForUrgentRows: ctxRep.coherent.urgentEligible, boardOpenIds: ctxRep.boardHasTitle > 0 ? [TASK_ID] : [], kpiTaskIds: ctxRep.coherent.kpiTarefas ? [TASK_ID] : [], todayUrgentIds: ctxRep.urgentHasTitle ? [TASK_ID] : [], domKpiTarefas: ctxRep.kpiVal, domUrgentRow: ctxRep.urgentHasTitle, domMeuQuadroCards: ctxRep.boardHasTitle }),
  divergent: Object.assign({}, ctxRep.divergent, { eligibleForEscalation: escD.eligible, escalationReason: escD.reason, note: 'doc divergente (designerAssignment=boaz, assigneeId=owner): invisível ao designer em Hoje/KPI/Meu quadro ⇒ guard R1 NÃO escala (not_visible_to_designer) — sem contradição possível' }),
  verdict: 'PARIDADE PROVADA: no estado real do produto (assigneeId=designer) a tarefa cobrada pelo SLA aparece em Meu quadro, no KPI Tarefas e em Tarefas urgentes do Hoje; a escalação exige a MESMA visibilidade (A6). Nenhum bug de produto: a incoerência do screenshot anterior era do fixture (assigneeId=owner).',
};
fs.writeFileSync(path.join(OUT, 'i7271r1-sla-context-parity.json'), JSON.stringify(report, null, 1));
const c = report.coherent;
gate('CTX-R1 SLA taskId existe no conjunto canônico (state.tasks) e é visível ao designer (canSeeTask)', ctxRep.visibleIds.includes(TASK_ID) && c.canSeeTask === true, ctxRep.visibleIds);
gate('CTX-R2 assigneeId == designer atual == currentUser (boaz) — write-path real', c.assigneeId === 'boaz' && c.designerAssignment.designerId === 'boaz' && report.currentUserId === 'boaz');
gate('CTX-R3 designerCol == estado inicial "afazer" (não iniciada)', c.designerCol === 'afazer' && c.status === 'afazer');
gate('CTX-R4 dueAt parity: escalação usa o MESMO instante do prazo do doc (dueAt) e a UI mostra Hoje', escC.dueAtMs === DUE_AT && c.dueDate === todayStr());
gate('CTX-R5 Meu quadro: regra real inclui (assigneeId===pid) E o board REAL renderiza o card', c.eligibleForMeuQuadro === true && c.domMeuQuadroCards >= 1, { rule: c.eligibleForMeuQuadro, dom: c.domMeuQuadroCards });
gate('CTX-R6 KPI Tarefas do Hoje: regra real inclui E o KPI REAL = 1', c.eligibleForHojeTaskCount === true && c.domKpiTarefas === 1, { rule: c.eligibleForHojeTaskCount, dom: c.domKpiTarefas });
gate('CTX-R7 Tarefas urgentes do Hoje: regra real inclui (visível + prazo) E a linha REAL aparece', c.eligibleForUrgentRows === true && c.domUrgentRow === true, { rule: c.eligibleForUrgentRows, dom: c.domUrgentRow });
gate('CTX-R8 escalação NUNCA referencia tarefa inacessível: elegível no coerente; NÃO elegível no divergente (not_visible_to_designer)', escC.eligible === true && escD.eligible === false && escD.reason === 'not_visible_to_designer', { coherent: escC.reason, divergent: escD.reason });
gate('CTX-R10 sem vazamento cross-user: o divergente (assigneeId=owner) não está em visibleTasks(boaz) e não é cobrado de boaz', !ctxRep.visibleIds.includes(TASK_ID + '-div') && ESC.escalationEmissionsFor(taskDivergent, 'boaz', DUE_AT - 3600000).length === 0);
/* HOJE-CONTEXT: estado coerente + toast de escalação (T-6h) visível ao mesmo tempo */
await A.pg.evaluate((p) => { window.__cbs['notif-toast'](p); }, { eventId: 'k', dedupKey: 'sla_deadline:high:' + TASK_ID + ':boaz:' + DUE_AT, eventType: 'deadline_high_risk', severity: 'critical', taskId: TASK_ID, taskTitle: 'CEO / SETEMBRO', clientName: 'CEO', actorId: 'boaz', actorName: 'Boaz', responsibleId: 'boaz', responsibleName: 'Boaz', targetUserId: 'boaz', title: 'Prazo em risco — tarefa não iniciada', body: 'Esta tarefa ainda não foi iniciada e o prazo termina hoje às ' + dueTime + '.', context: 'Faltam 1h 41min', createdAt: nowMs, sound: false, kind: 'deadline', deadlineLevel: 'high', dueAtMs: DUE_AT, slaThreshold: 'T_MINUS_6H', action: { type: 'detail', deep: 'detail/' + TASK_ID }, _premiumCommon: false });
await A.pg.waitForTimeout(350);
await A.pg.screenshot({ path: path.join(OUT, 'I7271R1-SLA-HOJE-CONTEXT.png') });
const hoje = await A.pg.evaluate(() => ({ kpi: (document.querySelector('.stat[data-myboard] .v') || {}).textContent, urgent: /CEO \/ SETEMBRO/.test((document.querySelector('.col-tasks') || document.body).textContent), toast: document.querySelectorAll('#notif-stack .ntf').length }));
gate('§9 estado COERENTE na captura: KPI Tarefas=1 + linha urgente CEO / SETEMBRO + toast de escalação simultâneos', hoje.kpi === '1' && hoje.urgent && hoje.toast === 1, hoje);
/* §12 / CTX-R9 no APP: "Abrir tarefa" do dialog central chega ao renderer pelo MESMO canal que o main usa para qualquer
   deep-link (slareminder-open → bringToFrontAndOpen → webContents.send('notif-open') → desktopAPI.onNotifOpen → notifRoute
   → openDetails). Entregamos o MESMO deep-link no handler REAL e provamos que o Detail aberto é da MESMA tarefa. */
await A.pg.evaluate((deep) => { window.__cbs['notif-open'](deep); }, 'detail/' + TASK_ID);
await A.pg.waitForTimeout(400);
const det = await A.pg.evaluate(() => { const m = document.querySelector('.modal-back[data-detmodal]'); return { open: !!m, taskId: m ? m.getAttribute('data-dettaskid') : null, title: m ? ((m.querySelector('.det-title') || {}).textContent || '') : '', client: m ? ((m.querySelector('.det-client') || {}).textContent || '') : '' }; });
await A.pg.screenshot({ path: path.join(OUT, 'I7271R1-SLA-OPEN-TASK.png') });
gate('§12 / CTX-R9 (app): deep-link "detail/' + TASK_ID + '" pelo canal notif-open do main abre o Detail da MESMA tarefa (data-dettaskid + título CEO / SETEMBRO)', det.open && det.taskId === TASK_ID && /CEO \/ SETEMBRO/.test(det.title), det);
gate('SLA-R18 pageErrors app = 0', A.perr.length === 0, A.perr);
await A.ctx.close();

fs.writeFileSync(path.join(OUT, 'i7271r1-gates.json'), JSON.stringify({ gates: GATES, failed: FAILED, brand: brandInfo, dialog: { critical: mC, overdue: mO, before: bDims }, at: new Date().toISOString() }, null, 1));
await browser.close(); srv.close();
console.log('\nI7271R1-REFINE: ' + (GATES.length - FAILED) + '/' + GATES.length + ' PASS');
if (FAILED) process.exit(1);
