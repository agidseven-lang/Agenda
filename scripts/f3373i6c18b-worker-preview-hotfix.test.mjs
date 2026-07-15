#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C18B — Testes HERMÉTICOS do HOTFIX de preview do Card Premium
   (/share × WhatsApp): HEAD correto + Cache API + single-flight + no-poison,
   SEM deadline que troque o tipo (REGRA CRÍTICA: nunca "cronograma" p/
   roteiro por atalho de timeout).
   Micro-exec: executa handleShareCard REAL com stubs (Cache API em memória,
   Firestore/OAuth falsos) provando HIT/MISS, isolamento por token/origem,
   tipos corretos, HEAD text/html e envenenamento impossível (erro/404).
   Lê cloudflare-worker.js/wrangler.toml como TEXTO — NÃO rede, NÃO deploy,
   NÃO escreve fora do teste.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'cloudflare-worker.js'), 'utf8');
const TOML = fs.readFileSync(path.resolve(__dirname, '..', 'wrangler.toml'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

function fnSrc(name) { const re = new RegExp('(?:async )?function ' + name + '\\s*\\('); const m = SRC.match(re); if (!m) throw new Error('fn ' + name);
  let st = SRC.indexOf(m[0]), d = 0, i = SRC.indexOf('{', st);
  for (let j = i; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); } } throw new Error('sem fecho ' + name); }
function constObj(name) { const st = SRC.indexOf('const ' + name + ' = {'); if (st < 0) throw new Error('const ' + name);
  let d = 0; for (let j = SRC.indexOf('{', st); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 2); } } throw new Error('sem fecho ' + name); }
const constLine = (name) => { const m = SRC.match(new RegExp('const ' + name + ' = "[^"]*";')); if (!m) throw new Error('const ' + name); return m[0]; };

console.log('F3.3.73I6C18B — /share preview hotfix (HEAD + Cache API + single-flight)');

/* ── A: versão e compat com gates do deploy pinado ── */
ok('A1 versão V64.59-c18b-preview-hotfix', /version: "V64\.59-c18b-preview-hotfix"/.test(SRC));
ok('A2 prefixo V64.59 preservado (gate pré/pós-deploy)', /version: *"V64\.59/.test(SRC));

/* ── B: micro-exec do handleShareCard REAL (Cache/Firestore/OAuth stubados) ── */
const CORE =
  constLine('OG_IMG_PATH') + '\n' + constObj('PREMIUM_TYPES') + '\n' +
  fnSrc('premiumTypeOf') + '\n' + fnSrc('escapeHtml') + '\n' + fnSrc('ogClientBase') + '\n' +
  fnSrc('ogClientMeta') + '\n' + fnSrc('shareCardHtml') + '\n' + fnSrc('htmlResponseCacheable') + '\n' +
  'const _shareInflight = new Map();\n' + fnSrc('handleShareCard') + '\n';

function mkEnv() {
  const mem = new Map();
  const stats = { oauth: 0, queries: 0, puts: 0 };
  const scope = {
    caches: { default: {
      match: async (req) => { const k = req.url || String(req); return mem.get(k) ? mem.get(k).clone() : null; },
      put: async (req, res) => { const k = req.url || String(req); stats.puts++; mem.set(k, res); },
    } },
    Request: class { constructor(u, o) { this.url = u; this.method = (o && o.method) || 'GET'; } },
    Response: class {
      constructor(body, init) { this._body = body == null ? null : String(body); this.status = (init && init.status) || 200;
        this.headers = (init && init.headers instanceof Map) ? init.headers : new (class extends Map { set(k,v){ return super.set(String(k).toLowerCase(), v); } get(k){ return super.get(String(k).toLowerCase()) ?? null; } })(Object.entries((init && init.headers) || {}).map(([k,v])=>[String(k).toLowerCase(),v])); }
      clone() { const r = new scope.Response(this._body, { status: this.status }); this.headers.forEach((v,k)=>r.headers.set(k,v)); return r; }
      get body() { return this._body; }
      async text() { return this._body || ''; }
    },
    Headers: class extends Map {
      constructor(h) { super(); if (h && h.forEach) h.forEach((v,k)=>this.set(k,v)); }
      set(k,v){ return super.set(String(k).toLowerCase(), v); } get(k){ return super.get(String(k).toLowerCase()) ?? null; }
    },
    Date, Promise, Map, console: { log(){}, warn(){}, error(){} },
    FCM_SCOPE: 'fcm', DATASTORE_SCOPE: 'ds',
    getAccessToken: async () => { stats.oauth++; return 'tok'; },
    queryTaskByToken: async (env, at, token) => { stats.queries++; return scope.__lookup(token); },
    __lookup: (t) => null,
  };
  return { scope, stats, mem };
}
function buildApi(scope) {
  const names = Object.keys(scope);
  return new Function(...names, CORE + '\nreturn {handleShareCard, PREMIUM_TYPES, shareCardHtml};')(...names.map(n => scope[n]));
}
const req = (m) => ({ method: m });
const URLC = { origin: 'https://aprovar.agendaidseven.com.br' };
const ctxStub = { waitUntil: (p) => { ctxStub._p = (ctxStub._p || []).concat(p); } };
const flush = async () => { await Promise.all(ctxStub._p || []); ctxStub._p = []; };

await (async () => {
  // B1/B2 — tipos corretos no MISS (roteiro e cronograma), 1 OAuth + 1 query
  const { scope, stats } = mkEnv();
  scope.__lookup = (t) => t === 'rotok000001' ? { sector: 'roteiro' } : (t === 'crontok0001' ? { sector: 'cronograma' } : null);
  const api = buildApi(scope);
  const r1 = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'rotok000001'); await flush();
  ok('B1 MISS roteiro: GET 200 text/html + "Aprovar roteiro" + X-Share-Cache=miss + Server-Timing',
    r1.status === 200 && /text\/html/.test(r1.headers.get('content-type')) && (await r1.text()).includes('Aprovar roteiro') &&
    r1.headers.get('x-share-cache') === 'miss' && /share_lookup;dur=\d+/.test(r1.headers.get('server-timing') || ''));
  const r2 = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'crontok0001'); await flush();
  ok('B2 MISS cronograma: corpo com "Aprovar cronograma" (tipos NÃO se misturam entre tokens)',
    (await r2.text()).includes('Aprovar cronograma') && !(await r1.clone ? '' : ''));
  ok('B3 contadores do MISS: 2 OAuth + 2 queries + 2 cache puts (só sucesso cacheia)',
    stats.oauth === 2 && stats.queries === 2 && stats.puts === 2);

  // B4 — HIT: zero OAuth/Firestore novos; corpo/tipo corretos; header hit
  const h1 = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'rotok000001');
  ok('B4 HIT roteiro: 200 + "Aprovar roteiro" + X-Share-Cache=hit + ZERO nova consulta/OAuth',
    h1.status === 200 && (await h1.text()).includes('Aprovar roteiro') && h1.headers.get('x-share-cache') === 'hit' &&
    stats.oauth === 2 && stats.queries === 2);
  const h2 = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'crontok0001');
  ok('B5 HIT cronograma: cache por token NÃO vaza tipo (cronograma segue cronograma)',
    (await h2.text()).includes('Aprovar cronograma') && !(await h2.text()).includes('Aprovar roteiro'));

  // B6 — HEAD: text/html, corpo vazio, mesmos headers; HIT sem consulta
  const hd = await api.handleShareCard(req('HEAD'), {}, ctxStub, URLC, 'rotok000001');
  ok('B6 HEAD (HIT): 200 text/html, corpo VAZIO, X-Share-Cache=hit, sem application/json',
    hd.status === 200 && /text\/html/.test(hd.headers.get('content-type')) && (hd.body === null || hd.body === '') &&
    hd.headers.get('x-share-cache') === 'hit' && stats.queries === 2);

  // B7 — HEAD em MISS resolve o tipo REAL e aquece o cache p/ o GET seguinte
  scope.__lookup = (t) => t === 'rotok000002' ? { sector: 'roteiro' } : null;
  const hd2 = await api.handleShareCard(req('HEAD'), {}, ctxStub, URLC, 'rotok000002'); await flush();
  const g2 = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'rotok000002');
  ok('B7 HEAD MISS → cache aquecido → GET seguinte é HIT com tipo roteiro',
    hd2.headers.get('x-share-cache') === 'miss' && (hd2.body === null || hd2.body === '') &&
    g2.headers.get('x-share-cache') === 'hit' && (await g2.text()).includes('Aprovar roteiro'));

  // B8 — 404 (task não encontrada): card padrão SEM cachear (não envenena)
  const q0 = stats.puts;
  const nf = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'unknowntok01'); await flush();
  const nf2 = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'unknowntok01'); await flush();
  ok('B8 não-encontrado: 200 card padrão, ZERO put no cache, 2ª chamada volta a consultar (MISS de novo)',
    nf.status === 200 && nf.headers.get('x-share-cache') === 'miss' && stats.puts === q0 &&
    nf2.headers.get('x-share-cache') === 'miss');

  // B9 — erro persistente: retry 1x, fallback SEM cache; recuperação posterior serve tipo CERTO
  let fails = 0;
  scope.__lookup = (t) => { throw new Error('firestore down'); };
  const errScope = scope; const before = stats.queries;
  const er = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'rotok000003'); await flush();
  const afterQ = stats.queries;
  scope.__lookup = (t) => ({ sector: 'roteiro' });
  const rec = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'rotok000003'); await flush();
  ok('B9 erro transitório: 1 retry (2 consultas), resposta 200 sem cache; recuperado → tipo ROTEIRO correto (sem envenenamento)',
    er.status === 200 && (afterQ - before) === 2 && er.headers.get('x-share-cache') === 'miss' &&
    (await rec.text()).includes('Aprovar roteiro') && rec.headers.get('x-share-cache') === 'miss');

  // B10 — single-flight: 2 GETs simultâneos do MESMO token = 1 consulta
  const { scope: s2, stats: st2 } = mkEnv();
  let resolveLookup; const gate = new Promise((r) => { resolveLookup = r; });
  s2.__lookup = async () => { await gate; return { sector: 'roteiro' }; };
  const api2 = buildApi(s2);
  const c2 = { waitUntil(){} };
  const pA = api2.handleShareCard(req('GET'), {}, c2, URLC, 'rotok000004');
  const pB = api2.handleShareCard(req('GET'), {}, c2, URLC, 'rotok000004');
  resolveLookup();
  const [ra, rb] = await Promise.all([pA, pB]);
  ok('B10 single-flight: 2 scrapes simultâneos → 1 OAuth + 1 consulta, ambos com tipo roteiro',
    st2.oauth === 1 && st2.queries === 1 && (await ra.text()).includes('Aprovar roteiro') && (await rb.text()).includes('Aprovar roteiro'));

  // B11 — isolamento por ORIGEM na chave (workers.dev ≠ custom)
  const { scope: s3 } = mkEnv();
  s3.__lookup = () => ({ sector: 'roteiro' });
  const api3 = buildApi(s3);
  const c3 = { _p: [], waitUntil(p){ this._p.push(p); } };
  await api3.handleShareCard(req('GET'), {}, c3, { origin: 'https://aprovar.agendaidseven.com.br' }, 'rotok000005');
  await Promise.all(c3._p);
  const other = await api3.handleShareCard(req('GET'), {}, c3, { origin: 'https://idseven-push.agidseven.workers.dev' }, 'rotok000005');
  ok('B11 chave inclui a ORIGEM: mesmo token em domínio diferente NÃO reusa o cache do outro (URLs absolutas corretas)',
    other.headers.get('x-share-cache') === 'miss');
})();

/* ── C: pins de fonte (garantias estruturais) ── */
ok('C1 rota /share casa GET e HEAD (mesma rota; sem rota nova)',
  /shareMatch && \(request\.method === "GET" \|\| request\.method === "HEAD"\)/.test(SRC) &&
  /\/\^\\\/share\\\/cronograma\\\/\(\[A-Za-z0-9_-\]\{4,128\}\)\\\/\?\$\//.test(SRC) && !/share\\\/roteiro/.test(SRC));
ok('C2 SEM deadline/timeout que troque tipo (nenhum Promise.race/AbortController no handler)',
  (() => { const h = fnSrc('handleShareCard'); return !/Promise\.race|AbortController|setTimeout/.test(h); })());
ok('C3 cache só em SUCESSO com task encontrada (resolved) + waitUntil + clone',
  /if \(resolved && ctx\) \{ try \{ ctx\.waitUntil\(caches\.default\.put\(cacheKey, res\.clone\(\)\)\); \}/.test(SRC));
ok('C4 Cache-Control PRESERVADO (public, max-age=600 no htmlResponseCacheable, TTL do cache)',
  /"Cache-Control": "public, max-age=600"/.test(SRC));
ok('C5 headers de métrica públicos (X-Share-Cache hit|miss + Server-Timing) sem token/segredo',
  /h\.set\("X-Share-Cache", "hit"\)/.test(SRC) && /res\.headers\.set\("X-Share-Cache", "miss"\)/.test(SRC) &&
  /Server-Timing", "share_lookup;dur="/.test(SRC) && !/Server-Timing[^\n]*token/.test(SRC));
ok('C6 OAuth por-isolate reutilizado (cache _tokenCache com margem exp-60) e NUNCA persistido em Cache API',
  /_tokenCache\.exp - 60 > nowSec/.test(SRC) && !/caches\.default\.put\([^)]*accessToken/.test(SRC) && !/caches\.default\.put\([^)]*_tokenCache/.test(SRC));
ok('C7 single-flight declarado por token (Map) com limpeza nos dois desfechos',
  /const _shareInflight = new Map\(\);/.test(SRC) && /_shareInflight\.set\(token, p\);/.test(SRC) &&
  /p\.then\(\(\) => _shareInflight\.delete\(token\), \(\) => _shareInflight\.delete\(token\)\);/.test(SRC));

/* ── D: preservações (C17 + portal + imagem + rotas) ── */
ok('D1 shareCardHtml/crawler/portal INTOCADOS (C17 cobre byte-parity; âncoras aqui)',
  /aprLabel: "Aprovar roteiro"/.test(SRC) && /aprLabel: "Aprovar cronograma"/.test(SRC) &&
  /function handleClientCronogramaCrawler/.test(SRC) && /function renderClientHtml/.test(SRC));
ok('D2 imagem OG intocada (rota canário GET||HEAD com wa-card-v64-39.jpg + OG_IMG_PATH)',
  /const OG_IMG_PATH = "\/og\/wa-card-v64-39\.jpg";/.test(SRC) && /wa-card-v64-39\.jpg/.test(SRC));
ok('D3 portal/action/state/team-action INALTERADOS',
  /\\\/action\\\/\?\$\//.test(SRC) && /\\\/state\\\/\?\$\//.test(SRC) && /\\\/team-action\\\/\?\$\//.test(SRC) &&
  /if \(g\.client === "concluido"\) \{[\s\S]*?finalApprovalCompleted = \{ booleanValue: true \}/.test(SRC));
ok('D4 wrangler.toml INTOCADO (idseven-push + vars WhatsApp/VAPID; sem SLA)',
  /name = "idseven-push"/.test(TOML) && /WHATSAPP_PHONE_NUMBER_ID/.test(TOML) && /VAPID_SUBJECT/.test(TOML) &&
  !/SLA_ENGINE_ENABLED|SLA_WRITE|SLA_ACTIVATED_AT/.test(TOML));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
