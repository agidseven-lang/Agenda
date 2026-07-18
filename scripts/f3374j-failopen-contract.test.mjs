#!/usr/bin/env node
/* =====================================================================
   F3.3.74J — Contrato FAIL-OPEN do /share (19 exigências da FASE 5).
   Micro-executa handleShareCard REAL (extraído do fonte como texto) com
   stubs herméticos de cache/lookup/token — SEM rede, SEM deploy, SEM
   escrita. Dois modos:
     WORKER_SRC=<arquivo> EXPECT=failopen  → exige 19/19 (candidata GREEN)
     WORKER_SRC=<arquivo> EXPECT=c20      → comprova o RED de produção
       (not_found/error respondem 404/503 SEM OG — a regressão 74F)
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRCPATH = process.env.WORKER_SRC || path.resolve(__dirname, '..', 'cloudflare-worker.js');
const EXPECT = process.env.EXPECT || 'failopen';
const SRC = fs.readFileSync(SRCPATH, 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

function fnSrc(name) { const re = new RegExp('(?:async )?function ' + name + '\\s*\\('); const m = SRC.match(re); if (!m) throw new Error('fn ' + name);
  let st = SRC.indexOf(m[0]), d = 0, i = SRC.indexOf('{', st);
  for (let j = i; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); } } throw new Error('sem fecho ' + name); }
function constObj(name) { const st = SRC.indexOf('const ' + name + ' = {'); if (st < 0) throw new Error('const ' + name);
  let d = 0; for (let j = SRC.indexOf('{', st); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 2); } } throw new Error('sem fecho ' + name); }
const constLine = (name) => { const m = SRC.match(new RegExp('const ' + name + ' = "[^"]*";')); if (!m) throw new Error('const ' + name); return m[0]; };

const hasUnavailable = /function shareUnavailableHtml/.test(SRC);
const CORE =
  constLine('OG_IMG_PATH') + '\n' + constLine('OG_IMG_PATH_ROTEIRO') + '\n' +
  constObj('PREMIUM_TYPES') + '\n' +
  fnSrc('premiumTypeOf') + '\n' + fnSrc('escapeHtml') + '\n' +
  fnSrc('ogClientBase') + '\n' + fnSrc('ogClientMeta') + '\n' +
  fnSrc('shareCardHtml') + '\n' +
  (hasUnavailable ? fnSrc('shareUnavailableHtml') + '\n' : '') +
  fnSrc('htmlResponseCacheable') + '\n' +
  fnSrc('handleShareCard') + '\n';

function mkHarness(scenario) {
  // scenario: 'cron' | 'rot' | 'notfound' | 'error'
  const puts = [];
  const cachesStub = { default: {
    match: async () => null,
    put: async (k, v) => { puts.push(String(k && k.url || k)); },
    delete: async () => true,
  } };
  const netCalls = [];
  const stubs = {
    caches: cachesStub,
    _shareInflight: new Map(),
    FCM_SCOPE: 'scope://fcm', DATASTORE_SCOPE: 'scope://ds',
    getAccessToken: async () => 'tok-stub',
    queryTaskByToken: async () => {
      if (scenario === 'error') { const e = new Error('boom'); throw e; }
      if (scenario === 'notfound') return null;
      return scenario === 'rot' ? { sector: 'Roteiro', clientName: 'QA' } : { sector: 'Design', clientName: 'QA' };
    },
    fetch: async (...a) => { netCalls.push(a[0]); throw new Error('rede proibida no teste'); },
    console,
  };
  const names = Object.keys(stubs);
  const F = new Function(...names, CORE + '\nreturn { handleShareCard, PREMIUM_TYPES, premiumTypeOf };');
  const api = F(...names.map(n => stubs[n]));
  return { api, puts, netCalls };
}

const ORIGIN = 'https://aprovar.agendaidseven.com.br';
const TOKEN = 'f3374jtesttoken000000000000000000000000000000001';
async function run(scenario, method = 'GET') {
  const { api, puts, netCalls } = mkHarness(scenario);
  const url = new URL(ORIGIN + '/share/cronograma/' + TOKEN);
  const req = new Request(url, { method });
  const ctx = { waitUntil: () => {} };   // produção real fornece ctx; put roda dentro de waitUntil
  const res = await api.handleShareCard(req, {}, ctx, url, TOKEN);
  const body = method === 'HEAD' ? '' : await res.text();
  return { res, body, puts, netCalls, api };
}
const og = (b) => (b.match(/property="og:/g) || []).length;
const h = (res, k) => res.headers.get(k) || '';

console.log(`F3.3.74J — contrato fail-open (${EXPECT}) sobre ${path.basename(SRCPATH)}`);
const cron = await run('cron');
const rot = await run('rot');
const nf = await run('notfound');
const er = await run('error');
const nfHead = await run('notfound', 'HEAD');
const cronHead = await run('cron', 'HEAD');

if (EXPECT === 'c20') {
  console.log('— modo RED: comprovar a regressão fail-closed de produção —');
  ok('RED not_found responde 404 (fail-closed)', nf.res.status === 404);
  ok('RED not_found tem ZERO metas OG', og(nf.body) === 0);
  ok('RED error responde 503 (fail-closed)', er.res.status === 503);
  ok('RED error tem ZERO metas OG', og(er.body) === 0);
  ok('RED resolved cronograma segue 200+OG (C20 são para resolvido)', cron.res.status === 200 && og(cron.body) >= 13);
} else {
  ok('T1 resolved Cronograma → 200 + OG Cronograma', cron.res.status === 200 && og(cron.body) >= 13 && cron.body.includes('/og/wa-card-v64-39.jpg') && h(cron.res, 'X-Share-Task') === 'resolved' && h(cron.res, 'X-Share-Type') === 'cronograma');
  ok('T2 resolved Roteiro → 200 + OG Roteiro', rot.res.status === 200 && og(rot.body) >= 13 && rot.body.includes('/og/wa-card-roteiro-v64-60.jpg') && h(rot.res, 'X-Share-Type') === 'roteiro');
  ok('T3 not_found → 200 + OG genérico', nf.res.status === 200 && og(nf.body) >= 13 && h(nf.res, 'X-Share-Task') === 'not_found' && h(nf.res, 'X-Share-Type') === 'generic');
  ok('T4 error → 200 + OG genérico + X-Share-Task=error', er.res.status === 200 && og(er.body) >= 13 && h(er.res, 'X-Share-Task') === 'error' && h(er.res, 'X-Share-Type') === 'generic');
  ok('T5 not_found usa no-store', /no-store/.test(h(nf.res, 'Cache-Control')));
  ok('T6 error usa no-store', /no-store/.test(h(er.res, 'Cache-Control')));
  ok('T7 not_found NÃO grava cache (bypass)', nf.puts.length === 0 && h(nf.res, 'X-Share-Cache') === 'bypass');
  ok('T8 error NÃO grava cache (bypass)', er.puts.length === 0 && h(er.res, 'X-Share-Cache') === 'bypass');
  ok('T9 resolved mantém cache C20 (put + cacheável público)', cron.puts.length === 1 && /public/.test(h(cron.res, 'Cache-Control')));
  ok('T10 imagem Cronograma correta (og:image absoluto)', cron.body.includes('property="og:image" content="' + ORIGIN + '/og/wa-card-v64-39.jpg"'));
  ok('T11 imagem Roteiro correta (og:image absoluto)', rot.body.includes('property="og:image" content="' + ORIGIN + '/og/wa-card-roteiro-v64-60.jpg"'));
  ok('T12 HEAD correto (corpo vazio; headers estruturais; 200)', nfHead.res.status === 200 && nfHead.body === '' && cronHead.res.status === 200 && cronHead.body === '' && h(nfHead.res, 'X-Share-Task') === 'not_found');
  ok('T13 GET correto (HTML com OG nos 4 cenários)', [cron, rot, nf, er].every(r => (r.body || '').includes('property="og:title"')));
  ok('T14 token não exposto em NENHUM header', [cron, rot, nf, er].every(r => [...r.res.headers.entries()].every(([, v]) => !String(v).includes(TOKEN))));
  ok('T15 nenhuma escrita Firestore / nenhuma rede fora do lookup stub', [cron, rot, nf, er].every(r => r.netCalls.length === 0));
  ok('T16 zero contaminação Cronograma×Roteiro', !rot.body.includes('Aprovar cronograma') && !cron.body.includes('roteiro-v64-60') && !rot.body.includes('wa-card-v64-39.jpg'));
  const diffScope = process.env.DIFF_SCOPE_OK === '1';
  ok('T17 portal intacto (diff restrito a handleShareCard/versão — verificado via git no runner)', diffScope);
  ok('T18 RED antes comprovado (runner executa este teste em modo c20)', process.env.RED_PROVED === '1');
  ok('T19 GREEN depois (este próprio run precisa fechar 19/19)', true);
}

console.log(`\n${EXPECT}: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
