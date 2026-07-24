#!/usr/bin/env node
/* =====================================================================
   F3.5.0A — QA VISUAL do ACOMPANHAMENTO DO PROJETO (Playwright headless).
   Renderiza o worker REAL (sandbox local; tokens SINTÉTICOS; zero rede
   externa) e captura os cenários do mandato:
     flag OFF (novo × base db325d9 — equivalência), flag ON (8 estados),
     Cronograma × Roteiro, mobile × desktop, múltiplos conteúdos, conteúdo
     com ajuste, rede lenta (latência no /progress) e reconexão (falha→ok,
     tick de 6s atualiza sem recarregar).
   Saída: qa-out-f350/*.png
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import http from 'http';
import { execSync } from 'child_process'; import { fileURLToPath } from 'url';
import { webcrypto } from 'crypto'; import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'qa-out-f350');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROMIUM_BIN || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

function loadWorker(srcText) {
  const RUN = srcText.replace(/^export default\s*\{/m, 'var __default__ = {').replace(/^export const /gm, 'const ');
  const stubs = {
    addEventListener: () => {},
    caches: { default: { match: async () => null, put: async () => {}, delete: async () => true } },
    fetch: async () => { throw new Error('sem rede no render'); },
    setInterval: () => 0, clearInterval: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    self: {}, crypto: webcrypto,
  };
  const names = Object.keys(stubs);
  const F = new Function(...names, RUN + '\nreturn { renderClientHtml, buildClientProgress: (typeof buildClientProgress==="function"?buildClientProgress:null) };');
  return F(...names.map((n) => stubs[n]));
}
const NEW = loadWorker(fs.readFileSync(path.join(ROOT, 'cloudflare-worker.js'), 'utf8'));
const OLD = loadWorker(execSync('git show db325d9:cloudflare-worker.js', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString());

const TOKEN = 'f350visualqa000000000000000000000000000000000001';
const ENV_OFF = { ENABLE_CLIENT_WEB_PUSH: 'false', VAPID_PUBLIC_KEY: '' };
const ENV_ON = Object.assign({}, ENV_OFF, { CLIENT_PROGRESS_TRACKING_ENABLED: 'true' });
const base = (extra) => Object.assign({
  client: 'Cliente Sintético QA', title: 'Cronograma Sintético QA', sector: 'cronograma',
  clientReviewToken: TOKEN, clientProgressEnabled: true,
  cronWeeks: [{ t: 'Tema 1 — Lançamento' }, { t: 'Tema 2 — Bastidores', date: '2026-08-05' }, { t: 'Tema 3 — Depoimentos' }],
  updatedAt: 1753300000000,
}, extra || {});
const approved3 = { i0: { cs: 'aprovado', phase: 'themes', at: 1753300200000 }, i1: { cs: 'aprovado', phase: 'themes', at: 1753300200001 }, i2: { cs: 'aprovado', phase: 'themes', at: 1753300200002 } };

const SCN = {
  'off-novo':        { task: base({ clientProgressEnabled: false }), env: ENV_ON, api: NEW },
  'off-base-db325d9':{ task: base({ clientProgressEnabled: false }), env: ENV_ON, api: OLD },
  'on-inicial':      { task: base(), env: ENV_ON, api: NEW },
  'on-visualizado':  { task: base({ clientPortalFirstViewedAt: 1753300100000 }), env: ENV_ON, api: NEW },
  'on-aprovado':     { task: base({ clientPortalFirstViewedAt: 1753300100000, clientItems: approved3 }), env: ENV_ON, api: NEW },
  'on-producao':     { task: base({ clientPortalFirstViewedAt: 1753300100000, status: 'andamento', workflowStage: 'producao' }), env: ENV_ON, api: NEW },
  'on-revisao':      { task: base({ clientPortalFirstViewedAt: 1753300100000, status: 'revisao' }), env: ENV_ON, api: NEW },
  'on-disponivel':   { task: base({ clientPortalFirstViewedAt: 1753300100000, cronStatus: 'ready_for_final_client_review' }), env: ENV_ON, api: NEW },
  'on-concluido':    { task: base({ clientPortalFirstViewedAt: 1753300100000, finalApprovalCompleted: true, clientFlowStatus: 'concluido' }), env: ENV_ON, api: NEW },
  'on-multiplos':    { task: base({ clientPortalFirstViewedAt: 1753300100000, cronWeeks: [{ t: 'M1' }, { t: 'M2' }, { t: 'M3' }, { t: 'M4' }, { t: 'M5' }, { t: 'M6' }], clientItems: { i0: { cs: 'aprovado', phase: 'themes', at: 1 } } }), env: ENV_ON, api: NEW },
  'on-ajuste':       { task: base({ clientPortalFirstViewedAt: 1753300100000, clientItems: Object.assign({}, approved3, { i1: { cs: 'em_revisao', phase: 'themes', at: 1753300300000, note: 'Trocar a foto 2' } }) }), env: ENV_ON, api: NEW },
  'on-roteiro':      { task: base({ sector: 'roteiro', title: 'Roteiro de gravação de vídeos', cronSub: 'q4', clientPortalFirstViewedAt: 1753300100000, cronWeeks: [{ t: 'Roteiro 1', legenda: 'Fala 1' }, { t: 'Roteiro 2', legenda: 'Fala 2' }] }), env: ENV_ON, api: NEW },
  'on-redelenta':    { task: base({ clientPortalFirstViewedAt: 1753300100000, status: 'andamento' }), env: ENV_ON, api: NEW, progressDelayMs: 3000 },
  'on-reconexao':    { task: base({ clientPortalFirstViewedAt: 1753300100000, status: 'andamento' }), env: ENV_ON, api: NEW, failFirst: 1, thenTask: base({ clientPortalFirstViewedAt: 1753300100000, status: 'revisao', updatedAt: 1753300400000 }) },
};

/* servidor local: portal + /state + /progress dinâmico (delay/falha/upgrade de estado) */
const dyn = { current: null, delay: 0, failLeft: 0, upgraded: null, hits: 0 };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const scnKey = u.searchParams.get('scn') || (dyn.currentKey || '');
  if (u.pathname === '/cliente/cronograma/' + TOKEN) {
    const s = SCN[scnKey]; dyn.currentKey = scnKey;
    dyn.current = s.task; dyn.delay = s.progressDelayMs || 0; dyn.failLeft = s.failFirst || 0; dyn.upgraded = s.thenTask || null; dyn.hits = 0;
    const html = s.api.renderClientHtml(s.task, TOKEN, s.env, 'http://127.0.0.1:' + PORT);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
  }
  if (u.pathname === '/cliente/cronograma/' + TOKEN + '/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, phase: 'themes', phaseApproved: false, finalDone: false, updatedAt: 0, items: [] })); return;
  }
  if (u.pathname === '/cliente/cronograma/' + TOKEN + '/progress') {
    dyn.hits++;
    const answer = () => {
      if (dyn.failLeft > 0) { dyn.failLeft--; res.destroy(); return; }   // simula queda de rede
      const t = (dyn.upgraded && dyn.hits > 1) ? dyn.upgraded : dyn.current;
      const p = NEW.buildClientProgress(t, Date.now(), 'p0123456789abcdef');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(Object.assign({ ok: true }, p)));
    };
    if (dyn.delay) setTimeout(answer, dyn.delay); else answer();
    return;
  }
  res.writeHead(404); res.end('nf');
});
const PORT = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
console.log('servidor local em 127.0.0.1:' + PORT);

const browser = await chromium.launch({ executablePath: CHROME });
let shots = 0;
async function snap(name, scnKey, viewport, opts) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://127.0.0.1:' + PORT + '/cliente/cronograma/' + TOKEN + '?scn=' + scnKey, { waitUntil: 'load', timeout: 20000 });
  if (opts && opts.settleMs) await page.waitForTimeout(opts.settleMs); else await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
  await page.close(); shots++;
  console.log('  captura: ' + name + '.png');
}

const DESK = { width: 1366, height: 768 };
const MOB = { width: 390, height: 844 };
await snap('01-flagOFF-novo-desktop', 'off-novo', DESK);
await snap('02-flagOFF-base-db325d9-desktop', 'off-base-db325d9', DESK);
await snap('03-flagON-inicial-recebido', 'on-inicial', DESK);
await snap('04-flagON-visualizado', 'on-visualizado', DESK);
await snap('05-flagON-cronograma-aprovado', 'on-aprovado', DESK);
await snap('06-flagON-producao', 'on-producao', DESK);
await snap('07-flagON-revisao-interna', 'on-revisao', DESK);
await snap('08-flagON-disponivel-aprovacao', 'on-disponivel', DESK);
await snap('09-flagON-concluido-100', 'on-concluido', DESK);
await snap('10-flagON-multiplos-conteudos', 'on-multiplos', DESK);
await snap('11-flagON-conteudo-com-ajuste', 'on-ajuste', DESK);
await snap('12-flagON-roteiro', 'on-roteiro', DESK);
await snap('13-flagON-mobile-producao', 'on-producao', MOB);
await snap('14-flagOFF-mobile', 'off-novo', MOB);
await snap('15-flagON-rede-lenta-snapshot-integro', 'on-redelenta', DESK, { settleMs: 1200 });
await snap('16-flagON-reconexao-atualizou-sem-reload', 'on-reconexao', DESK, { settleMs: 13500 });

/* prova objetiva da reconexão: o percent na tela deve ter mudado 25% -> 45% */
{
  const page = await browser.newPage({ viewport: DESK });
  await page.goto('http://127.0.0.1:' + PORT + '/cliente/cronograma/' + TOKEN + '?scn=on-reconexao', { waitUntil: 'load' });
  const before = await page.textContent('#id7p-pct');
  await page.waitForTimeout(13500);
  const after = await page.textContent('#id7p-pct');
  console.log('reconexao: percent antes=' + before + ' depois=' + after);
  if (!(before.trim() === '25%' && after.trim() === '45%')) { console.error('FALHA: reconexão não atualizou 25%→45%'); process.exit(1); }
  await page.close();
}

await browser.close(); server.close();
console.log('\nQA VISUAL F3.5.0A: ' + shots + ' capturas em qa-out-f350/ — OK');
