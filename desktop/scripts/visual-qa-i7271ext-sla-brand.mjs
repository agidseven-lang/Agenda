#!/usr/bin/env node
/* I7.27.1-EXT — QA visual: ALERTA CENTRAL DE PRAZO (janela slareminder.html REAL, view kind:'deadline'),
 * toasts de escalação L1/L2 (index.html REAL) e BRAND (sidebar REAL: estado atual vs PREVIEW do asset oficial).
 *
 * Gates:
 *   SLA-R13  alerta central é LIGHT UI (fundo #FFF; faixa semântica âmbar/vermelha; sem modal vermelho inteiro);
 *   SLA-R14  "Abrir tarefa" → deep-link da MESMA tarefa (+ reconhece); "Entendi" → só reconhece;
 *   SLA-R17/18 janela responsiva sem hscroll; pageErrors 0;
 *   §18      fila: contador "N alertas pendentes" (um card visível por vez);
 *   BR-R1..R10 asset oficial localizado/embutido; preview restaura o asset (sem inventar logo); sidebar/nav/anchor intactos
 *            (a RESTAURAÇÃO NÃO é aplicada ao produto neste candidato: o tile "7" foi decisão deliberada I7.7.1/I7.7.3 —
 *            o preview é evidência para decisão do OWNER).
 * Saída: desktop/qa-out-i7271/ — I7271EXT-SLA-WARNING/HIGH/CRITICAL/OVERDUE/OPEN-TASK/NOTIFICATION-QUEUE.png,
 *        I7271EXT-BRAND-BEFORE/AFTER.png + i7271ext-visual-gates.json. Exit 1 se falhar.
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ROOT = path.join(REPO, 'desktop', 'src', 'renderer');
const OUT = path.join(REPO, 'desktop', 'qa-out-i7271');
const CHROME = process.env.QA_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
fs.mkdirSync(OUT, { recursive: true });
const GATES = []; let FAILED = 0;
function gate(id, cond, info) { GATES.push({ id, pass: !!cond, info: info === undefined ? null : info }); if (!cond) { FAILED++; console.error('  ✗ ' + id + (info !== undefined ? ' :: ' + JSON.stringify(info) : '')); } else console.log('  ✓ ' + id); }

/* BRAND PREVIEW: remove SOMENTE o override light-ui que pinta o tile "7" (I7.7.1) — a regra base
   .logo.brandlogo{background:var(--logo)} volta a pintar o ASSET OFICIAL embutido (--logo). */
const IDX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const OVR1 = "body.light-ui.desktop .nav .sb-brand .logo.sm.brandlogo{background:linear-gradient(150deg,#2DD4BF,#0D9488) !important;position:relative}";
const OVR2 = "body.light-ui.desktop .nav .sb-brand .logo.sm.brandlogo::after{content:'7';position:absolute;inset:0;display:grid;place-items:center;color:#062A2A;font-weight:800;font-size:20px}";
const hasOverride = IDX.includes(OVR1) && IDX.includes(OVR2);
const hasLogoVar = /--logo:url\('data:image\/png;base64,/.test(IDX) && /\.logo\.brandlogo\{background:var\(--logo\) center\/contain no-repeat!important/.test(IDX);
const IDX_PREVIEW = IDX.replace(OVR1, '/* I7271EXT PREVIEW: override do tile "7" removido */').replace(OVR2, '');

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/index-brandpreview.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(IDX_PREVIEW); return; }
  const p = path.join(ROOT, u === '/' ? 'index.html' : decodeURIComponent(u));
  let body = null; try { body = fs.readFileSync(p); } catch { /* 404 */ }
  if (body == null) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(body);
});
await new Promise((r) => srv.listen(8911, r));
const browser = await chromium.launch({ executablePath: CHROME });

/* ───────────── A) JANELA CENTRAL — view de PRAZO ───────────── */
const WIDTH = 480; // largura da BrowserWindow do lembrete (slaReminderWindow WIDTH)
const ctxS = await browser.newContext({ viewport: { width: WIDTH, height: 700 }, deviceScaleFactor: 2 });
await ctxS.addInitScript(() => {
  window.__ok = []; window.__open = []; window.__rendered = [];
  window.slaAPI = { _cb: null, onCard(cb) { this._cb = cb; }, rendered(k) { window.__rendered.push(k); }, resize() {}, setProcessing() {}, obs() {},
    ok(k) { window.__ok.push(String(k)); }, open(d) { window.__open.push(String(d)); }, decide() {}, onResult() {}, dismiss() {}, resolveHelp() {}, onHelpCandidates() {},
    checkinDecide() {}, onCheckinResult() {}, checkinDraft() {}, checkinDismiss() {}, checkinResolveHelp() {}, onCheckinHelpCandidates() {} };
});
const pgS = await ctxS.newPage();
const perrS = []; pgS.on('pageerror', (e) => perrS.push(String(e).slice(0, 160)));
await pgS.goto('http://127.0.0.1:8911/slareminder.html', { waitUntil: 'load' });
await pgS.waitForTimeout(250);
const now = Date.now();
const dueSoon = now + 102 * 60000;   // faltam 1h 42min
const view = (over, extra) => Object.assign({
  key: over ? 'sla_deadline:overdue:t1:boaz:' + dueSoon : 'sla_deadline:critical:t1:boaz:' + dueSoon, base: 't1:boaz', level: 'critical',
  title: over ? 'PRAZO VENCIDO' : 'PRAZO EM RISCO', actorName: 'Boaz', actorAvatar: '', taskTitle: 'CEO / SETEMBRO', clientName: 'CEO',
  body: '', context: '', deep: 'detail/t1', queueLen: 1, soundDataUri: '', decisionsEnabled: true, taskId: 't1',
  kind: 'deadline', deadlineLevel: over ? 'overdue' : 'critical', dueAtMs: over ? now - 36 * 60000 : dueSoon, idleSinceMs: now - 3 * 86400000, slaThreshold: over ? 'OVERDUE' : 'T_MINUS_2H',
}, extra || {});
await pgS.evaluate((v) => { window.slaAPI._cb(v); }, view(false));
await pgS.waitForTimeout(300);
const mC = await pgS.evaluate(() => {
  const card = document.getElementById('card'); const cs = getComputedStyle(card); const r = card.getBoundingClientRect();
  const band = getComputedStyle(card, '::before').backgroundColor;
  const hs = [...document.querySelectorAll('#wrap *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length;
  return { bg: cs.backgroundColor, band, kicker: document.getElementById('kicker').textContent, name: document.getElementById('name').textContent, msg: document.getElementById('msg').textContent,
    task: document.getElementById('task').textContent, when: (document.getElementById('dl_when') || {}).textContent, rem: (document.getElementById('dl_rem') || {}).textContent,
    btns: [...document.querySelectorAll('#foot button')].map((b) => b.textContent.trim()), w: r.width, inside: r.right <= innerWidth && r.left >= 0, hs, rendered: window.__rendered.length };
});
await pgS.screenshot({ path: path.join(OUT, 'I7271EXT-SLA-CRITICAL.png') });
gate('SLA-R13 central CRÍTICO é LIGHT (card #FFF) com faixa semântica âmbar (não modal vermelho inteiro)', mC.bg === 'rgb(255, 255, 255)' && mC.band === 'rgb(245, 158, 11)', { bg: mC.bg, band: mC.band });
gate('§9 estrutura: PRAZO EM RISCO · título · cliente · "Você ainda não iniciou" · Prazo · Faltam · [Abrir tarefa] [Entendi]',
  mC.kicker === 'PRAZO EM RISCO' && mC.name === 'CEO / SETEMBRO' && mC.msg === 'CEO' && /não iniciou/.test(mC.task) && /Hoje às|Amanhã às|às/.test(mC.when || '') && /1h 4[12]min/.test(mC.rem || '') && mC.btns.join('|') === 'Abrir tarefa|Entendi', mC);
gate('SLA-R17 janela central sem hscroll e contida (480px)', mC.hs === 0 && mC.inside && mC.w <= WIDTH, { hs: mC.hs, w: mC.w });
gate('render ACK emitido (prova de render → cancela fallback nativo)', mC.rendered === 1, mC.rendered);
/* Entendi → só ok(key) */
await pgS.click('#dl_ack'); await pgS.waitForTimeout(150);
const ackRes = await pgS.evaluate(() => ({ ok: window.__ok.slice(), open: window.__open.slice() }));
gate('SLA-R15 "Entendi" ⇒ reconhece (ok(key)) e NÃO abre/move nada', ackRes.ok.length === 1 && ackRes.open.length === 0 && /critical:t1:boaz/.test(ackRes.ok[0]), ackRes);
/* OVERDUE + fila (2 pendentes) */
await pgS.evaluate((v) => { window.slaAPI._cb(v); }, view(true, { queueLen: 2 }));
await pgS.waitForTimeout(300);
const mO = await pgS.evaluate(() => ({ band: getComputedStyle(document.getElementById('card'), '::before').backgroundColor, kicker: document.getElementById('kicker').textContent, rem: (document.getElementById('dl_rem') || {}).textContent, pend: document.getElementById('pend').textContent, bg: getComputedStyle(document.getElementById('card')).backgroundColor }));
await pgS.screenshot({ path: path.join(OUT, 'I7271EXT-SLA-OVERDUE.png') });
await pgS.screenshot({ path: path.join(OUT, 'I7271EXT-NOTIFICATION-QUEUE.png') });
gate('§19 OVERDUE: faixa vermelha semântica, card continua claro; "vencido há 36min"', mO.band === 'rgb(220, 38, 38)' && mO.bg === 'rgb(255, 255, 255)' && mO.kicker === 'PRAZO VENCIDO' && /vencido há 36min/.test(mO.rem || ''), mO);
gate('§18 fila: contador "2 alertas pendentes" num ÚNICO card (sem sobreposição)', mO.pend === '2 alertas pendentes' && (await pgS.evaluate(() => document.querySelectorAll('.card').length)) === 1, mO.pend);
/* OPEN TASK */
await pgS.evaluate(() => { window.__ok.length = 0; window.__open.length = 0; });
await pgS.evaluate((v) => { window.slaAPI._cb(v); }, view(false, { key: 'sla_deadline:critical:t9:boaz:' + dueSoon, deep: 'detail/t9', taskId: 't9', base: 't9:boaz' }));
await pgS.waitForTimeout(250);
await pgS.screenshot({ path: path.join(OUT, 'I7271EXT-SLA-OPEN-TASK.png') });
await pgS.click('#dl_open'); await pgS.waitForTimeout(150);
const openRes = await pgS.evaluate(() => ({ ok: window.__ok.slice(), open: window.__open.slice() }));
gate('SLA-R14 "Abrir tarefa" ⇒ open(detail/t9) da MESMA tarefa + reconhece (taskId parity)', openRes.open.length === 1 && openRes.open[0] === 'detail/t9' && openRes.ok.length === 1 && /t9:boaz/.test(openRes.ok[0]), openRes);
/* invalidado (iniciou) */
await pgS.evaluate((v) => { window.slaAPI._cb(v); }, view(false, { deadlineClosed: true, body: 'Esta tarefa já foi iniciada — alerta encerrado.', decisionsEnabled: false }));
await pgS.waitForTimeout(200);
const mI = await pgS.evaluate(() => ({ kicker: document.getElementById('kicker').textContent, task: document.getElementById('task').textContent, btns: [...document.querySelectorAll('#foot button')].map((b) => b.textContent.trim()) }));
gate('§8 alerta invalidado ao iniciar ⇒ aviso informativo + OK (sem decisões)', mI.kicker === 'ALERTA ENCERRADO' && /já foi iniciada/.test(mI.task) && mI.btns.join('|') === 'OK', mI);
gate('SLA-R18 pageErrors janela central = 0', perrS.length === 0, perrS);

/* ───────────── B) TOASTS L1/L2 no app REAL (index.html) ───────────── */
async function newApp(pathname, vp, dsf) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1920, height: 1080 }, deviceScaleFactor: dsf || 1 });
  await ctx.addInitScript(() => {
    const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop });
    ['initializeApp', 'getFirestore', 'getAuth'].forEach((k) => { window[k] = noop; }); window.firebase = noop;
    window.__cbs = {}; window.__acks = []; document.hasFocus = () => true;
    window.desktopAPI = { onNotifToast(cb) { window.__cbs['notif-toast'] = cb; }, onNotifHistory(cb) { window.__cbs['notif-history'] = cb; }, onNotifGroupUpdate() {}, onNotifCollectRequest() {}, onNotifCollectCommit() {}, notifToastAck(k) { window.__acks.push(String(k)); }, notifCollectReply() {}, diagLog() {}, notify() {} };
  });
  const pg = await ctx.newPage(); const perr = []; pg.on('pageerror', (e) => perr.push(String(e).slice(0, 160)));
  await pg.goto('http://127.0.0.1:8911' + pathname, { waitUntil: 'load' }); await pg.waitForTimeout(2200);
  await pg.evaluate(() => {
    window._revealLogin = function () {};
    state.user = { id: 'boaz', name: 'Boaz', role: 'Designer' };
    state.users = [state.user, { id: 'owner', name: 'Owner', role: 'Social Media', admin: true }];
    document.body.classList.add('desktop', 'authed', 'light-ui');
    const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
    const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
    const asp = document.getElementById('authSplash'); if (asp) asp.style.display = 'none';
    state.tasks = [{ id: 't1', title: 'CEO / SETEMBRO', client: 'CEO', sector: 'cronograma', by: 'owner', assigneeId: 'owner', status: 'afazer', designerFlowStatus: 'afazer', dueDate: '2026-09-04', dueTime: '18:00', designerAssignment: { designerId: 'boaz', designerName: 'Boaz', status: 'sent' } }];
    state.events = []; state.tab = 'hoje'; render();
  });
  return { ctx, pg, perr };
}
const A = await newApp('/index.html');
const toast = (level) => ({
  eventId: 'k:' + level, dedupKey: 'sla_deadline:' + level + ':t1:boaz:' + dueSoon, eventType: level === 'warning' ? 'deadline_warning' : 'deadline_high_risk', severity: level === 'warning' ? 'warning' : 'critical',
  taskId: 't1', taskTitle: 'CEO / SETEMBRO', clientName: 'CEO', actorId: 'boaz', actorName: 'Boaz', responsibleId: 'boaz', responsibleName: 'Boaz', targetUserId: 'boaz',
  title: level === 'warning' ? 'Prazo em 24h — tarefa não iniciada' : 'Prazo em risco — tarefa não iniciada',
  body: 'Esta tarefa ainda não foi iniciada e o prazo termina ' + (level === 'warning' ? 'amanhã às 18:00' : 'hoje às 18:00') + '.',
  context: level === 'warning' ? 'Faltam 24h' : 'Faltam 5h 48min', createdAt: now, sound: false, kind: 'deadline', deadlineLevel: level, dueAtMs: dueSoon, slaThreshold: level === 'warning' ? 'T_MINUS_24H' : 'T_MINUS_6H',
  action: { type: 'detail', deep: 'detail/t1' }, _premiumCommon: false,
});
await A.pg.evaluate((p) => { window.__cbs['notif-toast'](p); }, toast('warning'));
await A.pg.waitForTimeout(350);
const mW = await A.pg.evaluate(() => { const c = document.querySelector('#notif-stack .ntf-card'); const cs = getComputedStyle(c); const r = c.getBoundingClientRect(); const hs = [...document.querySelectorAll('#notif-stack .ntf *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length; return { bg: cs.backgroundColor, text: c.textContent.replace(/\s+/g, ' ').trim().slice(0, 120), hs, inside: r.right <= innerWidth && r.bottom <= innerHeight, acks: window.__acks.length }; });
await A.pg.screenshot({ path: path.join(OUT, 'I7271EXT-SLA-WARNING.png') });
gate('L1 WARNING toast in-app LIGHT (#FFF), texto objetivo, hscroll 0, ack de render', mW.bg === 'rgb(255, 255, 255)' && /Prazo em 24h/.test(mW.text) && mW.hs === 0 && mW.inside && mW.acks === 1, mW);
await A.pg.evaluate(() => { document.getElementById('notif-stack').innerHTML = ''; });
await A.pg.evaluate((p) => { window.__cbs['notif-toast'](p); }, toast('high'));
await A.pg.waitForTimeout(350);
const mH = await A.pg.evaluate(() => { const c = document.querySelector('#notif-stack .ntf-card'); const cs = getComputedStyle(c); const ctx = c.querySelector('.ntf-ctx'); return { bg: cs.backgroundColor, text: (ctx ? ctx.textContent : c.textContent).replace(/\s+/g, ' ').trim(), n: document.querySelectorAll('#notif-stack .ntf').length }; });
await A.pg.screenshot({ path: path.join(OUT, 'I7271EXT-SLA-HIGH.png') });
gate('L2 HIGH RISK toast in-app LIGHT, "Faltam 5h 48min", 1 card', mH.bg === 'rgb(255, 255, 255)' && /5h 48min/.test(mH.text) && mH.n === 1, mH);
gate('SLA-R18 pageErrors app = 0', A.perr.length === 0, A.perr);

/* ───────────── C) BRAND — estado atual (BEFORE) × preview do asset oficial (AFTER-PREVIEW) ───────────── */
gate('BR-R1 asset oficial localizado: desktop/build/icon.png + --logo (PNG 256² embutido no renderer)', fs.existsSync(path.join(REPO, 'desktop', 'build', 'icon.png')) && hasLogoVar);
gate('BR-R2 nenhuma logo fabricada: o preview só remove o override do tile "7" (I7.7.1) — regra base pinta var(--logo)', hasOverride && !IDX_PREVIEW.includes(OVR2));
gate('BR-R3 asset empacotado: --logo é inline no index.html (asar) e build/icon.png em extraResources', hasLogoVar && /from: build\/icon\.png/.test(fs.readFileSync(path.join(REPO, 'desktop', 'electron-builder.yml'), 'utf8')));
const brandMeasure = async (pg) => pg.evaluate(() => {
  const nav = document.querySelector('.nav'); const b = document.querySelector('.sb-brand'); const lg = document.querySelector('.sb-brand .logo.brandlogo');
  const r = lg.getBoundingClientRect(); const cs = getComputedStyle(lg); const af = getComputedStyle(lg, '::after');
  const on = document.querySelector('.nav .sb-item.on'); const anchor = document.querySelector('.nav .sb-user, .nav .sb-account, .nav .lui-user') || document.querySelector('.nav [data-tab="perfil"]');
  const items = [...document.querySelectorAll('.nav .sb-item')].map((e) => e.textContent.trim()).slice(0, 12);
  return { navW: nav.getBoundingClientRect().width, brandH: b.getBoundingClientRect().height, logo: { w: r.width, h: r.height, bgImage: cs.backgroundImage.slice(0, 22), afterContent: af.content, radius: cs.borderRadius }, inside: r.left >= 0 && r.right <= nav.getBoundingClientRect().width, onItem: on ? on.textContent.trim() : '', anchorTop: anchor ? Math.round(anchor.getBoundingClientRect().top) : -1, items };
});
const RES = [{ n: '1920', vp: { width: 1920, height: 1080 }, dsf: 1 }, { n: 'WIN125', vp: { width: 1536, height: 864 }, dsf: 1.25 }, { n: '1366', vp: { width: 1366, height: 768 }, dsf: 1 }];
let brandOk = true; const brandInfo = {};
for (const r of RES) {
  const B0 = await newApp('/index.html', r.vp, r.dsf); const m0 = await brandMeasure(B0.pg);
  const B1 = await newApp('/index-brandpreview.html', r.vp, r.dsf); const m1 = await brandMeasure(B1.pg);
  if (r.n === '1920') {
    await B0.pg.screenshot({ path: path.join(OUT, 'I7271EXT-BRAND-BEFORE.png'), clip: { x: 0, y: 0, width: 300, height: 140 } });
    await B1.pg.screenshot({ path: path.join(OUT, 'I7271EXT-BRAND-AFTER.png'), clip: { x: 0, y: 0, width: 300, height: 140 } });
  }
  brandInfo[r.n] = { before: m0, afterPreview: m1 };
  const sameShell = Math.abs(m0.navW - m1.navW) < 0.5 && Math.abs(m0.brandH - m1.brandH) < 0.5 && m0.onItem === m1.onItem && m0.anchorTop === m1.anchorTop && m0.items.join('|') === m1.items.join('|');
  const beforeIs7 = m0.logo.afterContent === '"7"' && m0.logo.bgImage.indexOf('linear-gradient') === 0;
  const afterIsAsset = m1.logo.bgImage.indexOf('url(') === 0 && (m1.logo.afterContent === 'none' || m1.logo.afterContent === '""');
  const visible = m1.logo.w >= 30 && m1.logo.h >= 30 && m1.inside;
  gate('BR-R4/5/6 ' + r.n + ': BEFORE = tile "7" (deliberado I7.7.1); PREVIEW = asset oficial pintado, visível e contido', beforeIs7 && afterIsAsset && visible, { before: m0.logo, after: m1.logo });
  gate('BR-R7/8/9/10 ' + r.n + ': preview NÃO altera largura/altura do brand, nav selecionada, âncora do usuário, itens', sameShell, { navW: [m0.navW, m1.navW], brandH: [m0.brandH, m1.brandH], on: [m0.onItem, m1.onItem], anchor: [m0.anchorTop, m1.anchorTop] });
  if (!(beforeIs7 && afterIsAsset && visible && sameShell)) brandOk = false;
  await B0.ctx.close(); await B1.ctx.close();
}
gate('BR verdict: RESTAURAÇÃO NÃO APLICADA no candidato (decisão deliberada de fase anterior) — preview pronto p/ decisão do OWNER', brandOk && hasOverride);

fs.writeFileSync(path.join(OUT, 'i7271ext-visual-gates.json'), JSON.stringify({ gates: GATES, failed: FAILED, brand: brandInfo, at: new Date().toISOString() }, null, 1));
await browser.close(); srv.close();
console.log('\nI7271EXT-VISUAL: ' + (GATES.length - FAILED) + '/' + GATES.length + ' PASS');
if (FAILED) process.exit(1);
