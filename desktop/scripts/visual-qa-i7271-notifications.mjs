#!/usr/bin/env node
/* I7.27.1 — QA do SISTEMA DE NOTIFICAÇÕES: dedupe/ciclo de vida (P1) + shell light premium.
 *
 * Prova, contra as DUAS superfícies REAIS (toast in-app do index.html × janela premium
 * bgnotify.html) dirigidas pelo deliverNotification REAL do main.ts (extração fixture f343)
 * com notificationGrouping REAL + toastAck REAL (timer de 4s REAL, sem emulação):
 *   1) UMA transição lógica de status = UMA notificação visível (invariante do mandato);
 *   2) o shell novo é o light premium do mandato (superfície clara, hairline, radius 14,
 *      avatar 34 integrado, título dominante, transição com cores REAIS do sistema,
 *      CTA "Abrir" compacto), sem hscroll/clipping em 1920/Win125/1366.
 *
 * Uso: node desktop/scripts/visual-qa-i7271-notifications.mjs
 * (deps de dev: node_modules com playwright + typescript; chromium via QA_CHROMIUM)
 *
 * Gates NTF-R1..R18 (exit 1 se qualquer um falhar; nunca fabrica PASS):
 *   R1  caminho saudável (focado, canais ok): 1 toast, 0 premium;
 *   R2  canal notif-toast PERDIDO: compensação renderiza e CONFIRMA (ack pela porta única)
 *       ⇒ o watchdog real de 4s NÃO levanta a premium — total 1 superfície (era 2 no pré-fix);
 *   R3  2 eventos legítimos da MESMA tarefa fora da janela de grupo (5.4s): o card novo
 *       SUBSTITUI o anterior ainda vivo (supersede por data-group) e mostra o estado MAIS NOVO;
 *   R4  tarefas DISTINTAS quase simultâneas: TODAS visíveis (dedupe não destrói legítimas);
 *   R5  cinco movimentos distintos = cinco renders (nenhum perdido);
 *   R6  navegação não multiplica listeners de canal;
 *   R7  hscroll 0 nas duas superfícies × 1920/Win125(1536@1.25)/1366;
 *   R8  clipping 0 (card contido na janela/viewport);
 *   R9  superfície light: fundo #FFFFFF + hairline #D6DBE6 + radius 14 (2 superfícies);
 *   R10 avatar 34px INTEGRADO (dentro do card, sem overhang);
 *   R11 título dominante 15px/650 com clamp de 2 linhas (título longo controlado);
 *   R12 CTA "Abrir" compacto e quieto (fundo transparente; sem bloco colorido);
 *   R13 transição com cores REAIS do sistema (dot origem = cor canônica do STATUS);
 *   R14 fechar (×) remove o card (2 superfícies);
 *   R15 "Abrir" abre o deep-link CORRETO da tarefa, fecha o card e NÃO gera nova notificação;
 *   R16 teclado: Enter na cápsula dispara o abrir;
 *   R17 pageErrors === [] nas duas superfícies;
 *   R18 paridade dos construtores janela×toast (normalizada) + contrato de largura 380–440.
 *
 * Saída: desktop/qa-out-i7271/ (gitignored) — i7271-gates.json + PNGs
 * I7271-NOTIFICATION-AFTER(-1920/-WIN125/-1366)/LONG-TITLE/OPEN-ACTION.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { fnSrc, stripTypes } from './fixtures/f343/deliver-harness.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ROOT = path.join(REPO, 'desktop', 'src', 'renderer');
const OUT = path.join(REPO, 'desktop', 'qa-out-i7271');
const CHROME = process.env.QA_CHROMIUM || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const require2 = createRequire(import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const GATES = []; let FAILED = 0;
function gate(id, cond, info) {
  GATES.push({ id, pass: !!cond, info: info === undefined ? null : info });
  if (!cond) { FAILED++; console.error('  ✗ ' + id + (info !== undefined ? ' :: ' + JSON.stringify(info) : '')); }
  else console.log('  ✓ ' + id);
}

/* ── módulos REAIS do main (tsc → tmp, padrão f354) ── */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'i7271-'));
execFileSync(process.execPath, [
  path.join(REPO, 'desktop', 'node_modules', 'typescript', 'lib', 'tsc.js'),
  path.join(REPO, 'desktop', 'src', 'main', 'notificationGrouping.ts'),
  path.join(REPO, 'desktop', 'src', 'main', 'toastAck.ts'),
  '--outDir', TMP, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node',
]);
const { createNotificationGrouping } = require2(path.join(TMP, 'notificationGrouping.js'));
const { createToastAckTracker } = require2(path.join(TMP, 'toastAck.js'));
const MAIN = fs.readFileSync(path.join(REPO, 'desktop', 'src', 'main', 'main.ts'), 'utf8');

/* ── servidor do renderer REAL ── */
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  let body = null; try { body = fs.readFileSync(p); } catch { /* 404 */ }
  if (body == null) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(body);
});
await new Promise((r) => srv.listen(8909, r));
const browser = await chromium.launch({ executablePath: CHROME });

/* página A = index.html REAL (stub do preload; foco espelha a condição REAL do ramo toast) */
async function newPageA(viewport, dsf) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf || 1 });
  await ctx.addInitScript(() => {
    const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop });
    ['initializeApp', 'getFirestore', 'getAuth'].forEach((k) => { window[k] = noop; });
    window.firebase = noop;
    window.__acks = []; window.__cbs = {};
    document.hasFocus = () => true; // main escolheu o canal toast PORQUE a janela está focada
    window.desktopAPI = {
      onNotifToast(cb) { window.__cbs['notif-toast'] = cb; },
      onNotifHistory(cb) { window.__cbs['notif-history'] = cb; },
      onNotifGroupUpdate(cb) { window.__cbs['notif-group-update'] = cb; },
      onNotifCollectRequest(cb) { window.__cbs['notif-collect-request'] = cb; },
      onNotifCollectCommit(cb) { window.__cbs['notif-collect-commit'] = cb; },
      notifToastAck(k) { window.__acks.push(String(k)); },
      notifCollectReply() {}, diagLog() {}, notify() {},
    };
  });
  const pg = await ctx.newPage();
  const perr = []; pg.on('pageerror', (e) => perr.push(String(e).slice(0, 160)));
  await pg.goto('http://127.0.0.1:8909/', { waitUntil: 'load' });
  await pg.waitForTimeout(2200);
  await pg.evaluate(() => {
    window._revealLogin = function () {};
    state.user = { id: 'owner', name: 'Owner', role: 'Social Media', admin: true };
    state.users = [state.user, { id: 'marina', name: 'Marina Klein', role: 'Designer' }];
    document.body.classList.add('desktop', 'authed', 'light-ui');
    const lg = document.getElementById('login'); if (lg) lg.classList.add('hidden');
    const ap = document.getElementById('app'); if (ap) ap.style.display = 'flex';
    const asp = document.getElementById('authSplash'); if (asp) asp.style.display = 'none';
    state.tasks = [{ id: 'u1', title: 'Cronograma Ultra', client: 'Ultra', sector: 'cronograma', by: 'owner', assigneeId: 'owner', status: 'afazer', dueDate: '2026-09-05', cronContents: [{ tema: 'T1' }] }];
    state.events = []; state.tab = 'hoje'; render();
  });
  return { ctx, pg, perr };
}
/* página B = bgnotify.html REAL (janela premium; largura = WIDTH_PREF real do bgNotify.ts) */
const W = {};
for (const k of ['WIDTH_PREF', 'WIDTH_MAX', 'WIDTH_MIN', 'WIDTH_FLOOR']) {
  const m = fs.readFileSync(path.join(REPO, 'desktop', 'src', 'main', 'bgNotify.ts'), 'utf8').match(new RegExp('const ' + k + ' = (\\d+);'));
  W[k] = m ? Number(m[1]) : 0;
}
async function newPageB(width) {
  const ctx = await browser.newContext({ viewport: { width: width || W.WIDTH_PREF, height: 620 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.__opens = []; window.__renders = [];
    window.bgAPI = {
      _cb: null, _g: null,
      onCard(cb) { this._cb = cb; }, onGroupUpdate(cb) { this._g = cb; },
      open(d) { window.__opens.push(String(d || '')); },
      rendered(a) { window.__renders.push(a); }, resize() {}, empty() {},
    };
  });
  const pg = await ctx.newPage();
  const perr = []; pg.on('pageerror', (e) => perr.push(String(e).slice(0, 160)));
  await pg.goto('http://127.0.0.1:8909/bgnotify.html', { waitUntil: 'load' });
  await pg.waitForTimeout(300);
  return { ctx, pg, perr };
}

const A = await newPageA({ width: 1600, height: 900 });
const B = await newPageB();

/* ── "main" REAL: deliverNotification extraído + toastAck/grouping reais; IPC → páginas ── */
const grouping = createNotificationGrouping({ onLog: () => {} });
const toastAck = createToastAckTracker({ onLog: () => {} });
let DROP_TOAST_CHANNEL = false;
let ACKS_FORWARDED = 0;
const sendToRenderer = async (ch, arg) => {
  if (ch === 'notif-toast' && DROP_TOAST_CHANNEL) return; // R2: mensagem perdida
  await A.pg.evaluate(([c, a]) => { const cb = window.__cbs[c]; if (cb) cb(a); }, [ch, arg]);
  const acks = await A.pg.evaluate(() => window.__acks.splice(0));
  for (const k of acks) { toastAck.ack(k); ACKS_FORWARDED++; }
};
const showBg = async (p) => { await B.pg.evaluate((pp) => { window.bgAPI._cb(pp); }, p); return true; };
function buildDeliver() {
  const parts = ['windowActive', 'openDeep', 'bringToFrontAndOpen', 'nativeNotify'].map((n) => stripTypes(fnSrc(MAIN, n))).join('\n');
  const start = MAIN.indexOf('function deliverNotification(');
  const retClose = MAIN.indexOf('channel: string }', start) + 'channel: string }'.length;
  const b0 = MAIN.indexOf('{', retClose);
  let d = 0, end = -1; for (let j = b0; j < MAIN.length; j++) { const c = MAIN[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j; break; } } }
  const realDeliver = 'function deliverNotification(p) ' + MAIN.slice(b0, end + 1).replace(/ as any/g, '').replace(/ as const/g, '');
  const stubs = 'let pendingDeep=null; const notifTele={};\nfunction nmask(s){return String(s==null?"":s);}\nfunction winState(){return{focused:true,visible:true,minimized:false,tray:false};}\nfunction nlog(){}\n';
  const body = stubs + parts + '\n' + realDeliver + '\n return deliverNotification(__P);';
  const run = new Function('mainWin', '_notifSeen', 'diag', '_appIcon', 'showBgNotify', 'Notification', 'String', 'app', 'sessionLocked',
    'notificationGrouping', 'premiumCommonEnabled', 'updateBgGroup', 'toastAck', 'toastRegister', 'toastUnregister', 'groupRegister', 'groupUnregisterByDedup', '__P', body);
  const seen = new Set();
  const NM = function () {}; NM.prototype.on = () => {}; NM.prototype.show = () => {}; NM.isSupported = () => true;
  const pendingSends = [];
  const mainWin = { isDestroyed: () => false, isVisible: () => true, isMinimized: () => false, isFocused: () => true,
    restore: () => {}, show: () => {}, focus: () => {},
    webContents: { send: (ch, arg) => { pendingSends.push([ch, arg]); }, isLoading: () => false } };
  const bgQueue = [];
  let pumping = Promise.resolve();
  const pump = () => { pumping = pumping.then(async () => {
    while (pendingSends.length) { const [ch, arg] = pendingSends.shift(); await sendToRenderer(ch, arg); }
    while (bgQueue.length) { await showBg(bgQueue.shift()); }
  }); return pumping; };
  return {
    async deliver(p) {
      const res = run(mainWin, seen, () => {}, () => undefined, (pp) => { bgQueue.push(pp); setTimeout(pump, 0); return true; }, NM, String, { getVersion: () => '1.0.254' }, false,
        grouping, true, (v) => { pendingSends.push(['notif-group-update', v]); setTimeout(pump, 0); }, toastAck, () => {}, () => {}, () => {}, () => {}, p);
      await pump();
      return res;
    },
    pump,
  };
}
const M = buildDeliver();
const visible = async () => ({
  toasts: await A.pg.evaluate(() => document.querySelectorAll('#notif-stack .ntf').length),
  premium: await B.pg.evaluate(() => document.querySelectorAll('#stack .ntf').length),
});
const payload = (key, taskId, extra) => Object.assign({
  eventId: key, dedupKey: key, eventType: 'task_moved', notificationType: 'all_active_users',
  _premiumCommon: true, /* nas chamadas DIRETAS de canal (fora do deliver); o deliver real re-carimba o mesmo valor */
  taskId, taskTitle: 'Cronograma Ultra', clientName: 'Ultra',
  actorId: 'owner', actorName: 'Carlos Eduardo', targetUserId: 'owner', createdAt: Date.now(),
  title: 'Tarefa movimentada', body: 'Carlos moveu ‘Cronograma Ultra’ de A Fazer para Em andamento.',
  context: 'A Fazer → Em andamento', fromStatus: 'afazer', toStatus: 'andamento', sector: 'cronograma',
  sectorLabel: 'Cronograma', cronContext: 'Cronograma • 12 temas', severity: 'info', sound: false,
  action: { type: 'detail', deep: 'detail/' + taskId }, source: 'notifierA', providerCalled: false,
}, extra || {});
const clear = async () => {
  await A.pg.evaluate(() => { const s = document.getElementById('notif-stack'); if (s) s.innerHTML = ''; });
  await B.pg.evaluate(() => { document.getElementById('stack').innerHTML = ''; });
};

console.log('— NTF-R1..R6: uma transição = uma notificação (main real + timer real) —');
/* R1 — saudável */
await M.deliver(payload('t:u1:af>and:1:owner', 'u1'));
await A.pg.waitForTimeout(350);
let v = await visible();
gate('NTF-R1 caminho saudável: 1 toast, 0 premium', v.toasts === 1 && v.premium === 0, v);
await clear();

/* R2 — canal notif-toast perdido; timer REAL de 4s decide */
DROP_TOAST_CHANNEL = true;
const acks0 = ACKS_FORWARDED;
await M.deliver(payload('t:u2:af>and:2:owner', 'u2'));
await A.pg.waitForTimeout(300);
const mid = await visible();
await new Promise((r) => setTimeout(r, 5200));
await M.pump(); await A.pg.waitForTimeout(200);
v = await visible();
DROP_TOAST_CHANNEL = false;
gate('NTF-R2 canal perdido: compensação renderiza+CONFIRMA ⇒ watchdog em pé ⇒ total 1 (era 2)',
  mid.toasts === 1 && v.toasts + v.premium === 1 && ACKS_FORWARDED > acks0, { mid, v, ackForwarded: ACKS_FORWARDED - acks0 });
await clear();

/* R3 — mesma tarefa, 5.4s (janela de grupo 5s expirada): supersede mostra o estado MAIS NOVO */
await M.deliver(payload('t:u3:af>and:3:owner', 'u3'));
await new Promise((r) => setTimeout(r, 5400));
await M.deliver(payload('t:u3:and>rev:4:owner', 'u3', { fromStatus: 'andamento', toStatus: 'revisao', context: 'Em andamento → Revisão' }));
await A.pg.waitForTimeout(300);
v = await visible();
const newest = await A.pg.evaluate(() => { const t = document.querySelector('#notif-stack .ntf .pto'); return t ? t.textContent : ''; });
gate('NTF-R3 supersede: 1 card visível com o estado MAIS NOVO (Revisão)', v.toasts === 1 && /Revis/.test(newest), { v, newest });
await clear();

/* R4 — tarefas distintas preservadas */
await M.deliver(payload('t:u4:af>and:5:owner', 'u4'));
await new Promise((r) => setTimeout(r, 250));
await M.deliver(payload('t:u5:af>and:6:owner', 'u5'));
await A.pg.waitForTimeout(300);
v = await visible();
gate('NTF-R4 tarefas distintas: nada suprimido (2 visíveis)', v.toasts === 2, v);
await clear();

/* R5 — cinco movimentos distintos = cinco renders */
let renders5 = 0;
for (let i = 0; i < 5; i++) {
  await M.deliver(payload('t:m' + i + ':af>and:' + (10 + i) + ':owner', 'm' + i));
  await A.pg.waitForTimeout(120);
  const has = await A.pg.evaluate((k) => [...document.querySelectorAll('#notif-stack .ntf')].some((e) => (e.__ntfKey || '') === k), 't:m' + i + ':af>and:' + (10 + i) + ':owner');
  if (has) renders5++;
}
gate('NTF-R5 cinco movimentos distintos = cinco renders', renders5 === 5, { renders5 });
await clear();

/* R6 — navegação não multiplica listeners */
const l0 = await A.pg.evaluate(() => Object.keys(window.__cbs).length);
await A.pg.evaluate(() => { state.tab = 'tarefas'; state.personBoard = 'owner'; render(); });
await A.pg.waitForTimeout(250);
await A.pg.evaluate(() => { state.tab = 'hoje'; state.personBoard = null; render(); });
await A.pg.waitForTimeout(250);
const l1 = await A.pg.evaluate(() => Object.keys(window.__cbs).length);
gate('NTF-R6 listeners estáveis na navegação', l0 === l1 && l0 > 0, { l0, l1 });

console.log('— NTF-R7..R13: shell light premium (geometria/estilo) —');
const HS = () => [...document.querySelectorAll('#notif-stack .ntf *, #notif-stack .ntf')]
  .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length;
const HSB = () => [...document.querySelectorAll('#stack .ntf *, #stack .ntf')]
  .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length;
const RES = [
  { name: '1920', vp: { width: 1920, height: 1080 }, dsf: 1 },
  { name: 'WIN125', vp: { width: 1536, height: 864 }, dsf: 1.25 },
  { name: '1366', vp: { width: 1366, height: 768 }, dsf: 1 },
];
let hsAll = 0, clipAll = 0;
for (const r of RES) {
  const Ar = await newPageA(r.vp, r.dsf);
  await Ar.pg.evaluate((p) => { window.__cbs['notif-toast'](p); }, payload('shot:' + r.name, 'u1'));
  await Ar.pg.waitForTimeout(350);
  const g = await Ar.pg.evaluate(() => {
    const card = document.querySelector('#notif-stack .ntfp-wrap'); const cr = card.getBoundingClientRect();
    const hs = [...document.querySelectorAll('#notif-stack .ntf *, #notif-stack .ntf')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length;
    return { hs, w: cr.width, inside: cr.left >= 0 && cr.right <= innerWidth && cr.top >= 0 && cr.bottom <= innerHeight };
  });
  hsAll += g.hs; if (!g.inside) clipAll++;
  if (g.w < 380 || g.w > 440) clipAll++;
  await Ar.pg.screenshot({ path: path.join(OUT, 'I7271-NOTIFICATION-AFTER-' + r.name + '.png') });
  gate('NTF-R7.' + r.name + ' toast: hscroll 0, card ' + Math.round(g.w) + 'px em [380,440], contido', g.hs === 0 && g.inside && g.w >= 380 && g.w <= 440, g);
  await Ar.ctx.close();
}
await B.pg.evaluate((p) => { window.bgAPI._cb(p); }, payload('shotB:1', 'u1', { groupKey: 'common_group:owner:u1' }));
await B.pg.waitForTimeout(350);
const gb = await B.pg.evaluate(() => {
  const card = document.querySelector('#stack .ntfp-wrap'); const cr = card.getBoundingClientRect(); const cs = getComputedStyle(card);
  const av = document.querySelector('#stack .ntfp-fl .ntfp-av'); const ar = av.getBoundingClientRect();
  const pr = document.querySelector('#stack .ntfp-pr'); const ps = getComputedStyle(pr);
  const t = document.querySelector('#stack .ntfp-task'); const ts = getComputedStyle(t);
  const dot = document.querySelector('#stack .ntfp-pl .cdot'); const dsc = getComputedStyle(dot);
  const hs = [...document.querySelectorAll('#stack .ntf *, #stack .ntf')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length;
  return { hs, w: cr.width, inside: cr.left >= 0 && cr.right <= innerWidth,
    bg: cs.backgroundColor, border: cs.borderColor, radius: cs.borderRadius,
    av: { w: ar.width, inside: ar.top >= cr.top && ar.left >= cr.left && ar.bottom <= cr.bottom },
    title: { size: ts.fontSize, weight: ts.fontWeight },
    cta: { bg: ps.backgroundColor, text: pr.textContent.trim() },
    dot: dsc.backgroundColor };
});
await B.pg.screenshot({ path: path.join(OUT, 'I7271-NOTIFICATION-AFTER.png') });
gate('NTF-R7.premium hscroll 0 + card contido + largura em [380,440]', gb.hs === 0 && gb.inside && gb.w >= 380 && gb.w <= 440, { hs: gb.hs, w: gb.w });
gate('NTF-R8 clipping 0 (todas as resoluções + premium)', hsAll === 0 && clipAll === 0, { hsAll, clipAll });
gate('NTF-R9 superfície light: #FFFFFF + hairline #D6DBE6 + radius 14px',
  gb.bg === 'rgb(255, 255, 255)' && gb.border === 'rgb(214, 219, 230)' && gb.radius === '14px', gb);
gate('NTF-R10 avatar 34px INTEGRADO (dentro do card)', Math.round(gb.av.w) === 34 && gb.av.inside, gb.av);
gate('NTF-R11 título dominante 15px/650', gb.title.size === '15px' && String(gb.title.weight) === '650', gb.title);
gate('NTF-R12 CTA "Abrir" quieto (fundo transparente, sem bloco colorido)',
  gb.cta.bg === 'rgba(0, 0, 0, 0)' && /Abrir/.test(gb.cta.text), gb.cta);
gate('NTF-R13 cor REAL do sistema no dot da transição (afazer #9BA0AB)', gb.dot === 'rgb(155, 160, 171)', gb.dot);

/* R11b — título longo controlado (clamp 2 linhas, sem hscroll) */
await B.pg.evaluate(() => { document.getElementById('stack').innerHTML = ''; });
await B.pg.evaluate((p) => { window.bgAPI._cb(p); }, payload('shotB:long', 'u9', {
  taskTitle: 'Cronograma Ultra Master Premium com um título extremamente longo que precisa ser controlado em duas linhas no máximo sem quebrar o layout',
  groupKey: 'common_group:owner:u9' }));
await B.pg.waitForTimeout(350);
const lt = await B.pg.evaluate(() => {
  const t = document.querySelector('#stack .ntfp-task');
  const hs = [...document.querySelectorAll('#stack .ntf *, #stack .ntf')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden').length;
  return { clamped: t.scrollHeight > t.clientHeight, h: t.getBoundingClientRect().height, hs };
});
await B.pg.screenshot({ path: path.join(OUT, 'I7271-NOTIFICATION-LONG-TITLE.png') });
gate('NTF-R11b título longo: clamp 2 linhas + hscroll 0', lt.clamped && lt.h < 45 && lt.hs === 0, lt);

console.log('— NTF-R14..R17: interação —');
/* R14 — fechar */
const closeA = await A.pg.evaluate((p) => { window.__cbs['notif-toast'](p); return true; }, payload('close:a', 'u1'));
await A.pg.waitForTimeout(250);
await A.pg.click('#notif-stack .ntf-x');
await A.pg.waitForTimeout(350);
const leftA = await A.pg.evaluate(() => document.querySelectorAll('#notif-stack .ntf').length);
await B.pg.evaluate(() => { document.getElementById('stack').innerHTML = ''; });
await B.pg.evaluate((p) => { window.bgAPI._cb(p); }, payload('close:b', 'u1', { groupKey: 'common_group:owner:u1' }));
await B.pg.waitForTimeout(250);
await B.pg.click('#stack .ntf-x');
await B.pg.waitForTimeout(350);
const leftB = await B.pg.evaluate(() => document.querySelectorAll('#stack .ntf').length);
gate('NTF-R14 fechar (×) remove o card nas 2 superfícies', closeA && leftA === 0 && leftB === 0, { leftA, leftB });

/* R15 — Abrir: deep correto, card fecha, nenhuma nova notificação */
await B.pg.evaluate(() => { document.getElementById('stack').innerHTML = ''; window.__opens.length = 0; });
await B.pg.evaluate((p) => { window.bgAPI._cb(p); }, payload('open:b', 'u1', { groupKey: 'common_group:owner:u1' }));
await B.pg.waitForTimeout(250);
await B.pg.screenshot({ path: path.join(OUT, 'I7271-NOTIFICATION-OPEN-ACTION.png') });
await B.pg.click('#stack .ntfp-pill');
await B.pg.waitForTimeout(300);
const openRes = await B.pg.evaluate(() => ({ opens: window.__opens.slice(), left: document.querySelectorAll('#stack .ntf').length }));
gate('NTF-R15 Abrir: deep-link correto (detail/u1), card fecha, sem nova notificação',
  openRes.opens.length === 1 && openRes.opens[0] === 'detail/u1' && openRes.left === 0, openRes);

/* R16 — teclado */
await B.pg.evaluate(() => { document.getElementById('stack').innerHTML = ''; window.__opens.length = 0; });
await B.pg.evaluate((p) => { window.bgAPI._cb(p); }, payload('kb:b', 'u1', { groupKey: 'common_group:owner:u1' }));
await B.pg.waitForTimeout(250);
await B.pg.focus('#stack .ntfp-pill');
await B.pg.keyboard.press('Enter');
await B.pg.waitForTimeout(250);
const kb = await B.pg.evaluate(() => window.__opens.slice());
gate('NTF-R16 teclado: Enter na cápsula abre a tarefa', kb.length === 1 && kb[0] === 'detail/u1', kb);

gate('NTF-R17 pageErrors === [] nas 2 superfícies', A.perr.length === 0 && B.perr.length === 0, { A: A.perr, B: B.perr });

console.log('— NTF-R18: paridade + contrato de largura —');
const IDX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BGH = fs.readFileSync(path.join(ROOT, 'bgnotify.html'), 'utf8');
function extractBlock(src) {
  const a = src.indexOf('var PREMIUM_TYPES=');
  const e = src.indexOf('function premiumGroupInner(view){', a);
  const c = src.indexOf('\n  }', e);
  return a >= 0 && c >= 0 ? src.slice(a, c + 4) : '';
}
const norm = (x) => x.replace(/\s+/g, ' ').trim();
gate('NTF-R18 paridade construtores janela×toast + largura 380–440 (janela e toast)',
  norm(extractBlock(IDX)) === norm(extractBlock(BGH))
  && W.WIDTH_PREF - 20 >= 380 && W.WIDTH_MAX - 20 <= 440
  && /\.ntf\.ntfp-w\{width:400px;max-width:calc\(100vw - 36px\)/.test(IDX),
  { widths: W });

fs.writeFileSync(path.join(OUT, 'i7271-gates.json'), JSON.stringify({ gates: GATES, failed: FAILED, at: new Date().toISOString() }, null, 1));
await browser.close(); srv.close();
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* tmp */ }
console.log('\nI7271-NOTIFICATIONS: ' + (GATES.length - FAILED) + '/' + GATES.length + ' PASS');
if (FAILED) process.exit(1);
