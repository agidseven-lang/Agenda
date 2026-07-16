#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C18B → F3.3.73I6C23 — Testes HERMÉTICOS do /share (Card Premium).
   C23 (SHARE SNAPSHOT IMUTÁVEL): o GET público NÃO usa OAuth, NÃO consulta a
   tarefa e NÃO tem single-flight de lookup — lê SOMENTE o snapshot publicado
   (KV env.SHARE_SNAPSHOTS) + Cache API. A criação/reuso do snapshot é feita
   pelo endpoint AUTENTICADO POST /share-snapshot (Bearer teamSessionJwt ou
   X-Team-Key), que resolve a tarefa UMA vez server-side.
   Micro-exec: executa handleShareCard e handleShareSnapshotCreate REAIS com
   stubs (Cache API + KV em memória, Firestore/OAuth falsos) provando HIT/MISS,
   isolamento por token/origem, tipos corretos, HEAD text/html, no-poison
   (not_found/error nunca cacheiam) e ZERO OAuth/Firestore no GET público.
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
const srcLine = (rx) => { const m = SRC.match(rx); if (!m) throw new Error('linha ' + rx); return m[0]; };

console.log('F3.3.73I6C18B/C23 — /share via SHARE SNAPSHOT (KV + Cache API; GET público estático)');

/* ── A: versão e compat com gates do deploy pinado ── */
ok('A1 versão V64.59-* (linha canônica; sufixo da fase atual = c23)', /version: "V64\.59-c23-share-snapshot"/.test(SRC));
ok('A2 prefixo V64.59 preservado (gate pré/pós-deploy)', /version: *"V64\.59/.test(SRC));

/* ── B: micro-exec do handleShareCard + handleShareSnapshotCreate REAIS ── */
const CORE =
  constLine('OG_IMG_PATH') + '\n' + constLine('OG_IMG_PATH_ROTEIRO') + '\n' + constObj('PREMIUM_TYPES') + '\n' +
  srcLine(/const SHARE_SNAP_KEY = [^\n]+;/) + '\n' + srcLine(/const SHARE_TOKEN_RE = [^\n]+;/) + '\n' +
  fnSrc('premiumTypeOf') + '\n' + fnSrc('escapeHtml') + '\n' + fnSrc('ogClientBase') + '\n' +
  fnSrc('ogClientMeta') + '\n' + fnSrc('shareCardHtml') + '\n' + fnSrc('htmlResponseCacheable') + '\n' +
  fnSrc('shareUnavailableHtml') + '\n' + fnSrc('shareSnapshotContentHashInput') + '\n' +
  fnSrc('sha256HexW') + '\n' + fnSrc('maskUid') + '\n' + fnSrc('timingSafeEqualStr') + '\n' +
  fnSrc('qaTraceId') + '\n' + fnSrc('qaTraceLog') + '\n' +
  fnSrc('handleShareCard') + '\n' + fnSrc('handleShareSnapshotCreate') + '\n';

function mkEnv() {
  const mem = new Map();
  const kv = { data: new Map(), gets: 0, puts: 0, failNextGet: false };
  const stats = { oauth: 0, queries: 0, puts: 0, fsDocGets: 0 };
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
    Date, Promise, Map, JSON, Error, Array, Object, String, Number, RegExp, Set,
    TextEncoder, TextDecoder, crypto, encodeURIComponent,
    console: { log(){}, warn(){}, error(){} },
    FCM_SCOPE: 'fcm', DATASTORE_SCOPE: 'ds',
    FIRESTORE_BASE: 'https://firestore.local/v1',
    // Counters de PROVA: o GET público NUNCA deve incrementá-los.
    getAccessToken: async () => { stats.oauth++; return 'tok'; },
    queryTaskByToken: async () => { stats.queries++; return null; },
    verifyTeamJwt: async () => ({ ok: false, error: 'não usado (X-Team-Key)' }),
    lookupTeamUser: async () => ({ uid: 'u1', name: 'Equipe', role: 'social', admin: false }),
    json: (obj, status) => ({ __json: obj, status: status || 200 }),
    fetch: async (u) => { stats.fsDocGets++; return scope.__fsDoc(String(u)); },
    __fsDoc: () => ({ status: 404, ok: false }),
    __kv: kv,
  };
  const kvBinding = {
    get: async (k) => { kv.gets++; if (kv.failNextGet) { kv.failNextGet = false; throw new Error('kv down'); } const v = kv.data.get(k); return v === undefined ? null : v; },
    put: async (k, v) => { kv.puts++; kv.data.set(k, v); },
  };
  return { scope, stats, mem, kv, env: { SHARE_SNAPSHOTS: kvBinding, TEAM_API_KEY: 'chave-teste', FCM_PROJECT_ID: 'p' } };
}
function buildApi(scope) {
  const names = Object.keys(scope);
  return new Function(...names, '"use strict";\n' + CORE + '\nreturn {handleShareCard, handleShareSnapshotCreate, PREMIUM_TYPES, shareCardHtml};')(...names.map(n => scope[n]));
}
const req = (m) => ({ method: m });
const seed = (kv, token, type) => kv.data.set('snap:' + token, JSON.stringify({ v: 1, type, contentHash: 'h-' + type, createdAt: '2026-07-16T00:00:00.000Z' }));
const URLC = { origin: 'https://aprovar.agendaidseven.com.br' };
const ctxStub = { waitUntil: (p) => { ctxStub._p = (ctxStub._p || []).concat(p); } };
const flush = async () => { await Promise.all(ctxStub._p || []); ctxStub._p = []; };

await (async () => {
  // B1/B2 — tipos corretos no MISS a partir do SNAPSHOT (KV), sem OAuth/Firestore
  const { scope, stats, kv, env } = mkEnv();
  seed(kv, 'rotok000001', 'roteiro'); seed(kv, 'crontok0001', 'cronograma');
  const api = buildApi(scope);
  const r1 = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'rotok000001'); await flush();
  ok('B1 MISS roteiro (snapshot READY): 200 text/html + "Aprovar roteiro" + X-Share-Cache=miss + X-Share-Snapshot=ready + Server-Timing',
    r1.status === 200 && /text\/html/.test(r1.headers.get('content-type')) && (await r1.text()).includes('Aprovar roteiro') &&
    r1.headers.get('x-share-cache') === 'miss' && r1.headers.get('x-share-snapshot') === 'ready' &&
    /snapshot_read;dur=\d+/.test(r1.headers.get('server-timing') || ''));
  const r2 = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'crontok0001'); await flush();
  ok('B2 MISS cronograma: corpo com "Aprovar cronograma" (tipos NÃO se misturam entre tokens)',
    (await r2.text()).includes('Aprovar cronograma') && !(await r2.text()).includes('Aprovar roteiro'));
  ok('B3 GET público 100% estático: ZERO OAuth + ZERO consulta de tarefa + 2 leituras KV + 2 cache puts (só READY cacheia)',
    stats.oauth === 0 && stats.queries === 0 && stats.fsDocGets === 0 && kv.gets === 2 && stats.puts === 2);

  // B4 — HIT: zero KV/OAuth novos; corpo/tipo corretos; header hit
  const h1 = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'rotok000001');
  ok('B4 HIT roteiro: 200 + "Aprovar roteiro" + X-Share-Cache=hit + ZERO nova leitura (KV/OAuth)',
    h1.status === 200 && (await h1.text()).includes('Aprovar roteiro') && h1.headers.get('x-share-cache') === 'hit' &&
    kv.gets === 2 && stats.oauth === 0);
  const h2 = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'crontok0001');
  ok('B5 HIT cronograma: cache por token NÃO vaza tipo (cronograma segue cronograma)',
    (await h2.text()).includes('Aprovar cronograma') && !(await h2.text()).includes('Aprovar roteiro'));

  // B6 — HEAD: text/html, corpo vazio, mesmos headers; HIT sem leitura nova
  const hd = await api.handleShareCard(req('HEAD'), env, ctxStub, URLC, 'rotok000001');
  ok('B6 HEAD (HIT): 200 text/html, corpo VAZIO, X-Share-Cache=hit, sem application/json',
    hd.status === 200 && /text\/html/.test(hd.headers.get('content-type')) && (hd.body === null || hd.body === '') &&
    hd.headers.get('x-share-cache') === 'hit' && kv.gets === 2);

  // B7 — HEAD em MISS lê o snapshot e aquece o cache p/ o GET seguinte
  seed(kv, 'rotok000002', 'roteiro');
  const hd2 = await api.handleShareCard(req('HEAD'), env, ctxStub, URLC, 'rotok000002'); await flush();
  const g2 = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'rotok000002');
  ok('B7 HEAD MISS → cache aquecido → GET seguinte é HIT com tipo roteiro',
    hd2.headers.get('x-share-cache') === 'miss' && (hd2.body === null || hd2.body === '') &&
    g2.headers.get('x-share-cache') === 'hit' && (await g2.text()).includes('Aprovar roteiro'));

  // B8 — token SEM snapshot: 404 EXPLÍCITO sem card de tipo + botão manual do portal; nunca cacheia
  const q0 = stats.puts;
  const nf = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'unknowntok01'); await flush();
  const nf2 = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'unknowntok01'); await flush();
  const nfBody = await nf.text();
  ok('B8 [C23] sem snapshot: 404 not_found/none/no-store + X-Share-Snapshot=none + botão do portal + ZERO put + 2ª chamada segue bypass',
    nf.status === 404 && nf.headers.get('x-share-task') === 'not_found' && nf.headers.get('x-share-type') === 'none' &&
    nf.headers.get('x-share-snapshot') === 'none' && /no-store/.test(nf.headers.get('cache-control') || '') &&
    !nfBody.includes('og:title') && nfBody.includes('/cliente/cronograma/unknowntok01') &&
    stats.puts === q0 && nf2.status === 404 && nf2.headers.get('x-share-cache') === 'bypass');

  // B9 — erro de KV: 503 explícito SEM card e SEM cache; recuperação serve o tipo CERTO
  seed(kv, 'rotok000003', 'roteiro');
  kv.failNextGet = true;
  const er = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'rotok000003'); await flush();
  const rec = await api.handleShareCard(req('GET'), env, ctxStub, URLC, 'rotok000003'); await flush();
  ok('B9 [C23] KV falhou: 503 X-Share-Task=error no-store SEM card de tipo; recuperado → 200 ROTEIRO correto',
    er.status === 503 && er.headers.get('x-share-task') === 'error' && er.headers.get('x-share-type') === 'none' &&
    /no-store/.test(er.headers.get('cache-control') || '') && !(await er.text()).includes('og:title') &&
    rec.status === 200 && (await rec.text()).includes('Aprovar roteiro') && rec.headers.get('x-share-task') === 'resolved');
  const noBind = await api.handleShareCard(req('GET'), {}, ctxStub, URLC, 'rotok000006');
  ok('B9b binding SHARE_SNAPSHOTS ausente: 503 explícito X-Share-Snapshot=unconfigured (deploy sem KV nunca vira Cronograma)',
    noBind.status === 503 && noBind.headers.get('x-share-task') === 'error' && noBind.headers.get('x-share-snapshot') === 'unconfigured');

  // B10 — endpoint autenticado: cria, REUTILIZA (mesmo token/URL, zero write novo), e recusa divergências
  const { scope: s2, kv: kv2, env: env2 } = mkEnv();
  s2.__fsDoc = () => ({ status: 200, ok: true, json: async () => ({ fields: { sector: { stringValue: 'roteiro' }, clientReviewToken: { stringValue: 'rotok000009' } } }) });
  const api2 = buildApi(s2);
  const mkReq = (body) => ({ method: 'POST', json: async () => body, headers: { get: (k) => (String(k).toLowerCase() === 'x-team-key' ? 'chave-teste' : null) } });
  const c2 = { _p: [], waitUntil(p){ this._p.push(p); } };
  const cr1 = await api2.handleShareSnapshotCreate(mkReq({ taskId: 't1', expectedType: 'roteiro' }), env2, c2, URLC);
  await Promise.all(c2._p);
  const putsAfterCreate = kv2.puts;
  const cr2 = await api2.handleShareSnapshotCreate(mkReq({ taskId: 't1', expectedType: 'roteiro' }), env2, c2, URLC);
  ok('B10a criar snapshot (X-Team-Key): ready + token ESTÁVEL da tarefa + shareUrl/portalUrl + 1 write KV',
    cr1.status === 200 && cr1.__json.ok === true && cr1.__json.snapshotStatus === 'ready' && cr1.__json.type === 'roteiro' &&
    cr1.__json.token === 'rotok000009' && cr1.__json.shareUrl.endsWith('/share/cronograma/rotok000009') &&
    cr1.__json.portalUrl.endsWith('/cliente/cronograma/rotok000009') && putsAfterCreate === 1 && cr1.__json.reused === false);
  ok('B10b REENVIO reutiliza: reused=true, ZERO write novo, MESMO token, MESMA URL, MESMO contentHash',
    cr2.status === 200 && cr2.__json.reused === true && kv2.puts === putsAfterCreate &&
    cr2.__json.token === cr1.__json.token && cr2.__json.shareUrl === cr1.__json.shareUrl &&
    cr2.__json.contentHash === cr1.__json.contentHash && cr2.__json.snapshotId === cr1.__json.snapshotId);
  const mm = await api2.handleShareSnapshotCreate(mkReq({ taskId: 't1', expectedType: 'cronograma' }), env2, c2, URLC);
  ok('B10c tipo divergente: 409 type_mismatch (NUNCA fallback silencioso)',
    mm.status === 409 && mm.__json.error === 'type_mismatch' && mm.__json.actual === 'roteiro');
  s2.__fsDoc = () => ({ status: 200, ok: true, json: async () => ({ fields: { sector: { stringValue: 'roteiro' } } }) });
  const tm = await api2.handleShareSnapshotCreate(mkReq({ taskId: 't2', expectedType: 'roteiro' }), env2, c2, URLC);
  ok('B10d tarefa sem token estável: 409 token_missing (snapshot NUNCA inventa/rotaciona token)',
    tm.status === 409 && /token_missing/.test(tm.__json.error));
  const noAuth = await api2.handleShareSnapshotCreate({ method: 'POST', json: async () => ({ taskId: 't1', expectedType: 'roteiro' }), headers: { get: () => null } }, env2, c2, URLC);
  ok('B10e sem credencial: 401 (criação é SEMPRE autenticada; Desktop nunca escreve direto)',
    noAuth.status === 401);
  // GET público serve o snapshot criado pelo endpoint (integração fim-a-fim do micro-exec)
  const g9 = await api2.handleShareCard(req('GET'), env2, { waitUntil(){} }, URLC, 'rotok000009');
  ok('B10f GET público serve o snapshot criado: 200 resolved/roteiro/ready',
    g9.status === 200 && g9.headers.get('x-share-task') === 'resolved' && g9.headers.get('x-share-type') === 'roteiro' &&
    (await g9.text()).includes('Aprovar roteiro'));

  // B11 — isolamento por ORIGEM na chave (workers.dev ≠ custom)
  const { scope: s3, kv: kv3, env: env3 } = mkEnv();
  seed(kv3, 'rotok000005', 'roteiro');
  const api3 = buildApi(s3);
  const c3 = { _p: [], waitUntil(p){ this._p.push(p); } };
  await api3.handleShareCard(req('GET'), env3, c3, { origin: 'https://aprovar.agendaidseven.com.br' }, 'rotok000005');
  await Promise.all(c3._p);
  const other = await api3.handleShareCard(req('GET'), env3, c3, { origin: 'https://idseven-push.agidseven.workers.dev' }, 'rotok000005');
  ok('B11 chave inclui a ORIGEM: mesmo token em domínio diferente NÃO reusa o cache do outro (URLs absolutas corretas)',
    other.headers.get('x-share-cache') === 'miss');
})();

/* ── C: pins de fonte (garantias estruturais) ── */
ok('C1 rota /share casa GET e HEAD (mesma rota; sem rota nova de share)',
  /shareMatch && \(request\.method === "GET" \|\| request\.method === "HEAD"\)/.test(SRC) &&
  /\/\^\\\/share\\\/cronograma\\\/\(\[A-Za-z0-9_-\]\{4,128\}\)\\\/\?\$\//.test(SRC) && !/share\\\/roteiro/.test(SRC));
ok('C2 SEM deadline/timeout que troque tipo (nenhum Promise.race/AbortController no handler)',
  (() => { const h = fnSrc('handleShareCard'); return !/Promise\.race|AbortController|setTimeout/.test(h); })());
ok('C3 [C23] cache só em snapshot READY (not_found retorna ANTES do put) + waitUntil + clone',
  /if \(!snap\) return fail\("not_found", 404, "none"\);/.test(SRC) &&
  /if \(ctx\) \{ try \{ ctx\.waitUntil\(caches\.default\.put\(cacheKey, res\.clone\(\)\)\); \}/.test(SRC) &&
  SRC.indexOf('if (!snap) return fail("not_found", 404, "none");') < SRC.indexOf('caches.default.put(cacheKey'));
ok('C4 Cache-Control PRESERVADO (public, max-age=600 no htmlResponseCacheable, TTL do cache)',
  /"Cache-Control": "public, max-age=600"/.test(SRC));
ok('C5 headers de métrica públicos (X-Share-Cache hit|miss + Server-Timing) sem token/segredo',
  /h\.set\("X-Share-Cache", "hit"\)/.test(SRC) && /res\.headers\.set\("X-Share-Cache", "miss"\)/.test(SRC) &&
  /Server-Timing", "snapshot_read;dur="/.test(SRC) && !/Server-Timing[^\n]*token/.test(SRC));
ok('C6 OAuth por-isolate reutilizado (cache _tokenCache com margem exp-60) e NUNCA persistido em Cache API',
  /_tokenCache\.exp - 60 > nowSec/.test(SRC) && !/caches\.default\.put\([^)]*accessToken/.test(SRC) && !/caches\.default\.put\([^)]*_tokenCache/.test(SRC));
ok('C7 [C23] GET público SEM lookup dinâmico: handleShareCard não usa OAuth/Firestore/single-flight; criação SÓ pelo endpoint autenticado',
  (() => { const h = fnSrc('handleShareCard'); return !/queryTaskByToken|getAccessToken|_shareInflight|FIRESTORE_BASE/.test(h) &&
    /env\.SHARE_SNAPSHOTS\.get\(SHARE_SNAP_KEY\(token\)\)/.test(h); })() &&
  !/_shareInflight/.test(SRC) &&
  /url\.pathname === "\/share-snapshot" && request\.method === "POST"/.test(SRC) &&
  (() => { const e = fnSrc('handleShareSnapshotCreate'); return /verifyTeamJwt/.test(e) && /lookupTeamUser/.test(e) && /timingSafeEqualStr\(suppliedKey, env\.TEAM_API_KEY\)/.test(e); })());
ok('C8 [C23] snapshot IMUTÁVEL por conteúdo: reuso sem write + token nunca gerado/rotacionado pelo endpoint',
  (() => { const e = fnSrc('handleShareSnapshotCreate'); return /const reused = !!\(existing && existing\.type === typeKey && existing\.contentHash === contentHash\);/.test(e) &&
    /token_missing/.test(e) && !/generate|rotat/i.test(e); })());

/* ── D: preservações (C17 + portal + imagem + rotas) ── */
ok('D1 shareCardHtml/crawler/portal INTOCADOS (C17 cobre byte-parity; âncoras aqui)',
  /aprLabel: "Aprovar roteiro"/.test(SRC) && /aprLabel: "Aprovar cronograma"/.test(SRC) &&
  /function handleClientCronogramaCrawler/.test(SRC) && /function renderClientHtml/.test(SRC));
ok('D2 imagem OG intocada (rota canário GET||HEAD com wa-card-v64-39.jpg + OG_IMG_PATH)',
  /const OG_IMG_PATH = "\/og\/wa-card-v64-39\.jpg";/.test(SRC) && /wa-card-v64-39\.jpg/.test(SRC));
ok('D3 portal/action/state/team-action INALTERADOS',
  /\\\/action\\\/\?\$\//.test(SRC) && /\\\/state\\\/\?\$\//.test(SRC) && /\\\/team-action\\\/\?\$\//.test(SRC) &&
  /if \(g\.client === "concluido"\) \{[\s\S]*?finalApprovalCompleted = \{ booleanValue: true \}/.test(SRC));
ok('D4 wrangler.toml sem SLA (idseven-push + vars WhatsApp/VAPID); binding KV é passo de DEPLOY futuro documentado',
  /name = "idseven-push"/.test(TOML) && /WHATSAPP_PHONE_NUMBER_ID/.test(TOML) && /VAPID_SUBJECT/.test(TOML) &&
  !/SLA_ENGINE_ENABLED|SLA_WRITE|SLA_ACTIVATED_AT/.test(TOML));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
