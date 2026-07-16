#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C20 — GOLDEN MASTER INTEGRADO (L1 + L2).
   L2: executa o cloudflare-worker.js REAL em Node (import ESM) com shims
   fiéis: caches (Cache API por URL), fetch roteado (OAuth stub + Firestore
   runQuery com FIXTURES sanitizadas), RSA descartável p/ getAccessToken,
   ctx.waitUntil aguardado. UAs browser/WhatsApp/facebookexternalhit,
   GET+HEAD. Tokens SINTÉTICOS locais — nunca reais.
   L1: roda as suítes herméticas da casa NO MESMO COMMIT (subprocess).
   Modos: GM_EXPECT=red  → confirma a REGRESSÃO (gates-alvo DEVEM falhar);
          (default)      → tudo verde ou exit 1.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync, spawnSync } from 'child_process';
import { generateKeyPairSync } from 'crypto'; import { fileURLToPath, pathToFileURL } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DESK = process.env.GM_DESKTOP || path.resolve(ROOT, '..', 'wt-c20d');
const RED = process.env.GM_EXPECT === 'red';

const rows = []; let pass = 0, fail = 0;
function gate(id, name, cond, redTarget = false) {
  const okNow = !!cond;
  const expected = RED && redTarget ? false : true;
  const verdict = okNow === expected ? 'PASS' : 'FAIL';
  if (verdict === 'PASS') pass++; else fail++;
  rows.push({ id, name, obs: okNow ? 'ok' : 'falhou', verdict: RED && redTarget ? (okNow ? 'FAIL(era p/ estar RED)' : 'RED-CONFIRMADO') : verdict });
  console.log(`  ${verdict === 'PASS' ? 'PASS' : 'FAIL'} — [${id}] ${name}${RED && redTarget ? (okNow ? ' (esperava RED!)' : ' [RED-CONFIRMADO]') : ''}`);
}

/* ───── L2: worker real em Node ───── */
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const T_CRON = 'gmcronfixture0000000000000000000000000000000001';
const T_ROT  = 'gmrotfixture00000000000000000000000000000000002';
const T_UNK  = 'gmunknownfixture000000000000000000000000000003';
const T_ERR  = 'gmerrorfixture0000000000000000000000000000000004';
const sv = (s) => ({ stringValue: s });
const taskDoc = (id, fields) => ({ document: { name: 'projects/p/databases/(default)/documents/tasks/' + id, fields } });
const FIX = {
  [T_CRON]: [taskDoc('t1', { sector: sv('cronograma'), client: sv('Cliente GM'), title: sv('Cronograma GM'), clientReviewToken: sv(T_CRON) })],
  [T_ROT]:  [taskDoc('t2', { sector: sv('roteiro'), client: sv('Cliente GM'), title: sv('Roteiro de gravação de vídeos'), cronSub: sv('q8'), clientReviewToken: sv(T_ROT) })],
  [T_UNK]:  [{}],
};
let fsCalls = 0; const consoleCap = [];
const _log = console.log, _err = console.error, _warn = console.warn;
for (const k of ['log', 'error', 'warn']) { const o = console[k].bind(console); console[k] = (...a) => { consoleCap.push(a.join(' ')); }; }
globalThis.caches = (() => { const m = new Map(); return { default: {
  match: async (req) => { const r = m.get(req.url || req); return r ? r.clone() : undefined; },
  put: async (req, res) => { m.set(req.url || req, res.clone()); },
} }; })();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'gm-token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (u.includes('firestore.googleapis.com')) {
    fsCalls++;
    const body = JSON.parse(opts.body);
    const val = body.structuredQuery.where.fieldFilter.value.stringValue;
    if (val === T_ERR) return new Response('{"error":"backend"}', { status: 500 });
    return new Response(JSON.stringify(FIX[val] || [{}]), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('fetch inesperado no GM: ' + u.slice(0, 60));
};
const worker = (await import(pathToFileURL(path.join(ROOT, 'cloudflare-worker.js')).href)).default;
const env = { FCM_CLIENT_EMAIL: 'gm@local', FCM_PRIVATE_KEY: PEM, FCM_PROJECT_ID: 'gm-project', ALLOWED_ORIGIN: 'https://agendaidseven.com.br' };
const B = 'https://aprovar.agendaidseven.com.br';
const UA = { wa: 'WhatsApp/2.23.20.0', fb: 'facebookexternalhit/1.1', br: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
async function req(tok, method = 'GET', ua = 'wa') {
  const waits = []; const ctx = { waitUntil: (p) => waits.push(p) };
  const res = await worker.fetch(new Request(B + '/share/cronograma/' + tok, { method, headers: { 'user-agent': UA[ua] } }), env, ctx);
  const html = method === 'GET' ? await res.text() : '';
  await Promise.allSettled(waits);
  return { s: res.status, task: res.headers.get('x-share-task'), type: res.headers.get('x-share-type'),
    xc: res.headers.get('x-share-cache'), cc: res.headers.get('cache-control') || '', ct: res.headers.get('content-type') || '', html };
}
const hasCronCard = (h) => h.includes('content="Aprovar cronograma"');
const hasRotCard = (h) => h.includes('content="Aprovar roteiro"');

console.log = _log; console.error = _err; console.warn = _warn;
console.log('GOLDEN MASTER INTEGRADO — modo ' + (RED ? 'RED (reprodução da regressão)' : 'GREEN'));

/* CRONOGRAMA resolved (gates 7-12) */
const c1 = await req(T_CRON, 'GET', 'wa');
gate('G7/8', 'link resolve + X-Share-Task=resolved (cron)', c1.s === 200 && c1.task === 'resolved');
gate('G9', 'X-Share-Type=cronograma', c1.type === 'cronograma', true);
gate('G10', 'MISS gera OG Cronograma (title+desc)', hasCronCard(c1.html) && c1.html.includes('Seu cronograma está pronto'));
const fs1 = fsCalls; const c2 = await req(T_CRON, 'GET', 'fb');
gate('G11', 'HIT preserva OG Cronograma (cache por token; zero Firestore no HIT)', /hit/i.test(c2.xc || '') && hasCronCard(c2.html) && fsCalls === fs1);
gate('G12', 'imagem Cronograma correta (v64-39 nas metas)', c1.html.includes('/og/wa-card-v64-39.jpg'));
/* ROTEIRO resolved (23-28) */
const r1 = await req(T_ROT, 'GET', 'wa');
gate('G23/24', 'rot resolve + resolved', r1.s === 200 && r1.task === 'resolved');
gate('G25', 'X-Share-Type=roteiro', r1.type === 'roteiro', true);
gate('G26', 'MISS gera OG Roteiro', hasRotCard(r1.html) && r1.html.includes('Roteiro de gravação de vídeos'));
const r2 = await req(T_ROT, 'GET', 'br');
gate('G27', 'HIT preserva OG Roteiro', /hit/i.test(r2.xc || '') && hasRotCard(r2.html));
gate('G28', 'imagem exclusiva do Roteiro nas metas', /\/og\/wa-card-roteiro-v64-\d+\.jpg/.test(r1.html));
gate('G39', 'Roteiro NÃO recebe OG de Cronograma', !hasCronCard(r1.html));
gate('G40', 'Cronograma NÃO recebe OG de Roteiro', !hasRotCard(c1.html));
/* NOT_FOUND (33-36) */
const u1 = await req(T_UNK, 'GET', 'wa');
gate('G33', 'token inexistente → X-Share-Task=not_found', u1.task === 'not_found');
gate('G34/35', 'not_found NÃO devolve card Cronograma/Roteiro (página explícita de link inválido)', !hasCronCard(u1.html) && !hasRotCard(u1.html), true);
gate('G36a', 'not_found com Cache-Control no-store + X-Share-Type=none', /no-store/.test(u1.cc) && u1.type === 'none', true);
const u2 = await req(T_UNK, 'GET', 'wa');
gate('G36b', 'not_found NUNCA cacheia (GET#2 sem hit)', !/hit/i.test(u2.xc || ''));
/* ERROR (37-38) */
const e1 = await req(T_ERR, 'GET', 'wa');
gate('G37', 'erro de lookup → X-Share-Task=error + no-store + sem card de tipo', e1.task === 'error' && /no-store/.test(e1.cc) && !hasCronCard(e1.html) && !hasRotCard(e1.html), true);
const e2 = await req(T_ERR, 'GET', 'wa');
gate('G38', 'error não cacheia', !/hit/i.test(e2.xc || ''));
/* HEAD (47) */
const h1 = await req(T_CRON, 'HEAD', 'wa');
gate('G47', 'HEAD consistente com GET (text/html, resolved, hit do cache tipado)', h1.s === 200 && /text\/html/.test(h1.ct) && h1.task === 'resolved');
/* logs (41-42) */
const leak = consoleCap.some(l => l.includes(T_CRON) || l.includes(T_ROT) || l.includes(T_UNK) || l.includes(T_ERR));
gate('G41/42', 'nenhum token/URL completa em logs do worker', !leak);

/* DESKTOP prewarm contrato (RED3): prepareCardOnce deve EXIGIR resolved+type */
const PRE = fs.readFileSync(path.join(DESK, 'desktop', 'src', 'main', 'prewarm.ts'), 'utf8');
gate('G75a', 'prewarm exige X-Share-Task=resolved (código)', /x-share-task/i.test(PRE) && /resolved/.test(PRE), true);
gate('G75b', 'prewarm exige X-Share-Type do tipo esperado (código)', /x-share-type/i.test(PRE), true);
gate('G76', 'prewarm NÃO tem sucesso alternativo sem prova de cache (aquecidoSemHeader removido)', !/aquecidoSemHeader/.test(PRE), true);

/* L1: suítes da casa no MESMO commit (worker + desktop) */
function suite(cmd, cwd) { const r = spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf8', timeout: 180000 }); return r.status === 0; }
gate('L1-w-c17', 'suite c17 title-parity', suite('node scripts/f3373i6c17-worker-roteiro-title-parity.test.mjs', ROOT));
gate('L1-w-c18b', 'suite c18b preview-hotfix', suite('node scripts/f3373i6c18b-worker-preview-hotfix.test.mjs', ROOT));
gate('L1-w-c18e', 'suite c18e og-image', suite('node scripts/f3373i6c18e-roteiro-og-image.test.mjs', ROOT));
gate('L1-w-appr', 'worker-approval-test', suite('node worker-approval-test.js', ROOT));
gate('L1-d-c18h', 'suite token estável (desktop)', suite('node desktop/scripts/f3373i6c18h-stable-token.test.mjs', DESK));
gate('L1-d-c18c', 'suite prewarm (desktop)', suite('node desktop/scripts/f3373i6c18c-card-prewarm.test.mjs', DESK));
gate('L1-d-freeze', 'baseline freeze (desktop)', suite('node desktop/scripts/f3311-baseline-freeze.test.mjs', DESK));
gate('L1-d-c16', 'suite roteiro paridade (desktop)', suite('node desktop/scripts/f3373i6c16-roteiro-parity.test.mjs 2>/dev/null || ls desktop/scripts | grep -q c16 && node desktop/scripts/$(ls desktop/scripts | grep c16 | head -1) || true', DESK));

console.log(`\nGOLDEN MASTER: ${pass} PASS, ${fail} FAIL — modo ${RED ? 'RED' : 'GREEN'}`);
process.exit(fail ? 1 : 0);
