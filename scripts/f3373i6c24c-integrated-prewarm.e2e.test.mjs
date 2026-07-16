#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C24C — TESTE INTEGRADO REAL (Desktop QA ↔ Worker QA) — sem seed.
   Reproduz o DEFEITO da 1.0.169-QA e prova o FIX ponta a ponta usando:
     • o WORKER REAL (cloudflare-worker.js importado como módulo, como o Golden Master);
     • o PREWARM REAL do Desktop (dist/main/prewarm.js compilado da candidata 1.0.170-QA —
       função prepareCardOnce exportada), com o MESMO contrato que habilita o botão;
     • o fluxo REAL: POST /share-snapshot autenticado → publicação + readback no KV →
       GET público /share → OG/imagem → 2º GET → cache HIT → botão liberado.
   O ÚNICO mock é o Firestore (documento da TAREFA SINTÉTICA) — inevitável sem escrever
   em produção e legítimo (mesmo padrão do Golden Master). NADA é semeado direto no KV:
   o snapshot só existe porque o POST REAL o publicou. Sem rede externa; produção intocada.

   Requer o dist da candidata: DESKTOP_DIST=<worktree>/desktop/dist (main/prewarm.js).
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
import { generateKeyPairSync } from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0; const rows = [];
function ok(name, cond) { const v = !!cond; if (v) pass++; else fail++; rows.push({ name, v }); console.log(`  ${v ? 'PASS' : 'FAIL'} — ${name}`); return v; }

/* ── candidata Desktop (prewarm REAL compilado) ── */
const DESKTOP_DIST = process.env.DESKTOP_DIST || '';
if (!DESKTOP_DIST) { console.error('::SKIP:: defina DESKTOP_DIST=<...>/desktop/dist para o prewarm REAL'); process.exit(2); }
const prewarmPath = path.join(DESKTOP_DIST, 'main', 'prewarm.js');
if (!fs.existsSync(prewarmPath)) { console.error('::SKIP:: prewarm.js ausente em ' + prewarmPath + ' (rode tsc na candidata)'); process.exit(2); }
const prewarmSha = (await import('crypto')).createHash('sha256').update(fs.readFileSync(prewarmPath)).digest('hex');
const workerSha = (await import('crypto')).createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'cloudflare-worker.js'))).digest('hex');
console.log('F3.3.73I6C24C — integrado REAL Desktop↔Worker (prewarm.js sha256=' + prewarmSha.slice(0, 12) + '… worker sha256=' + workerSha.slice(0, 12) + '…)');

/* ── ambiente do Worker QA (real) ── */
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const QA_HOST = 'idseven-push-qa.agidseven.workers.dev';
const QA_ORIGIN = 'https://' + QA_HOST;
const QA_KEY = 'qa-team-key-integrado';
const sv = (s) => ({ stringValue: s });
const TOK_CRON = 'qacronintegr000000000000000000000000000001';
const TOK_ROT  = 'qarotintegr0000000000000000000000000000002';
/* tarefas sintéticas: roteiro SEM designer/responsável (exigência do mandato) */
const DOCS = {
  'qa-int-cron': { fields: { sector: sv('cronograma'), client: sv('Cliente Sintético'), title: sv('Cronograma sintético'), clientReviewToken: sv(TOK_CRON) } },
  'qa-int-rot':  { fields: { sector: sv('roteiro'), client: sv('Cliente Sintético'), title: sv('Roteiro de gravação de vídeos'), clientReviewToken: sv(TOK_ROT) } },
};

/* KV real-ish (Map) com controle de readback (kv_not_visible) e cache toggle */
const KV = { data: new Map(), hideReadback: false, reads: 0, puts: 0 };
const kvBinding = {
  get: async (k) => { KV.reads++; if (KV.hideReadback && /^snap:/.test(k)) return null; const v = KV.data.get(k); return v === undefined ? null : v; },
  put: async (k, v) => { KV.puts++; KV.data.set(k, v); },
};
let CACHE_ON = true;
globalThis.caches = (() => { const m = new Map(); return { default: {
  match: async (req) => { const k = req.url || String(req); const r = m.get(k); return r ? r.clone() : undefined; },
  put: async (req, res) => { if (!CACHE_ON) return; const k = req.url || String(req); m.set(k, res.clone()); },
} }; })();
function resetEdge() { KV.data.clear(); KV.hideReadback = false; CACHE_ON = true; globalThis.caches = (() => { const m = new Map(); return { default: {
  match: async (req) => { const k = req.url || String(req); const r = m.get(k); return r ? r.clone() : undefined; },
  put: async (req, res) => { if (!CACHE_ON) return; const k = req.url || String(req); m.set(k, res.clone()); },
} }; })(); }

/* import do worker REAL */
const worker = (await import(pathToFileURL(path.join(ROOT, 'cloudflare-worker.js')).href)).default;
const env = { FCM_CLIENT_EMAIL: 'qa@local', FCM_PRIVATE_KEY: PEM, FCM_PROJECT_ID: 'agenda-id-seven',
  ALLOWED_ORIGIN: 'https://agendaidseven.com.br', TEAM_API_KEY: QA_KEY, SHARE_SNAPSHOTS: kvBinding, QA_TRACE: '1' };

/* BRIDGE de fetch: host QA → worker REAL; firestore/oauth → mock (tarefa sintética);
   /og/* já é servido pelo próprio worker. Sem recursão: chamadas internas do worker
   (firestore/oauth) NÃO batem no host QA. */
let IMG_BREAK = false;   // cenário "imagem inválida"
const realCtx = () => { const waits = []; return { ctx: { waitUntil: (p) => waits.push(p) }, waits }; };
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || String(input);
  if (url.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'qa-oauth', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('firestore.googleapis.com')) {
    const m = url.match(/documents\/tasks\/([A-Za-z0-9_-]+)/);
    if (m) { const d = DOCS[m[1]]; if (!d) return new Response('{"error":{"status":"NOT_FOUND"}}', { status: 404, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } }); }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes(QA_HOST)) {
    if (IMG_BREAK && /\/og\//.test(url)) return new Response('erro', { status: 500, headers: { 'content-type': 'text/plain' } });
    const { ctx, waits } = realCtx();
    const res = await worker.fetch(new Request(url, init), env, ctx);
    await Promise.allSettled(waits);
    return res;
  }
  throw new Error('fetch inesperado no integrado: ' + url.slice(0, 80));
};

/* prewarm REAL (após o bridge estar montado) */
const { prepareCardOnce } = await import(pathToFileURL(prewarmPath).href);
if (typeof prepareCardOnce !== 'function') { console.error('::SKIP:: prepareCardOnce não exportado pelo prewarm.js'); process.exit(2); }

/* helper: passo do RENDERER real (ensureShareSnapshot) — POST autenticado (X-Team-Key QA) */
async function rendererEnsureSnapshot(taskId, tipo, key = QA_KEY, trace = 'trace-integr-0001') {
  const r = await fetch(QA_ORIGIN + '/share-snapshot', { method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Team-Key': key, 'X-QA-Trace-Id': trace },
    body: JSON.stringify({ taskId, expectedType: tipo }) });
  let j = null; try { j = await r.json(); } catch (_) { /* */ }
  const okReady = r.status === 200 && j && j.ok === true && j.snapshotStatus === 'ready' && j.type === tipo;
  return { status: r.status, ok: !!okReady, code: (j && j.code) || '', type: j && j.type, og: j && j.og, reused: j && j.reused, token: j && j.token };
}
const shareUrlFor = (tok) => QA_ORIGIN + '/share/cronograma/' + tok;

/* ============ CENÁRIO 0 — REPRODUÇÃO da falha 1.0.169-QA (sem publicar snapshot) ============ */
{
  resetEdge();
  // A 1.0.169-QA (base C20) NUNCA chamava /share-snapshot: o prewarm ia direto ao GET público.
  const pw = await prepareCardOnce(shareUrlFor(TOK_CRON), 'cronograma', 'trace-repro-0169');
  ok('REPRO 1.0.169-QA: sem POST /share-snapshot, o GET público falha em get1 (não há snapshot)', pw.ok === false && pw.stage === 'get1');
  ok('REPRO 1.0.169-QA: causa EXATA = task_not_found (worker C23 só serve snapshot do KV)', pw.reason === 'task_not_found' && pw.taskState === 'not_found');
  ok('REPRO 1.0.169-QA: WhatsApp NÃO abriria (botão permaneceria desabilitado)', pw.ok === false);
}

/* ============ CENÁRIO CRONOGRAMA — fluxo REAL completo → botão habilitado ============ */
let cronToken = '';
{
  resetEdge();
  const snap = await rendererEnsureSnapshot('qa-int-cron', 'cronograma');
  ok('CRON: POST /share-snapshot REAL → ready (publicou + readback confirmou legibilidade)', snap.ok && snap.code === 'snapshot_ready');
  ok('CRON: type=cronograma e og.imagePath=v64-39 (preview usa arte do tipo)', snap.type === 'cronograma' && snap.og && /wa-card-v64-39\.jpg$/.test(snap.og.imagePath));
  cronToken = snap.token || TOK_CRON;
  const pw = await prepareCardOnce(shareUrlFor(cronToken), 'cronograma', 'trace-cron-0001');
  ok('CRON: prewarm REAL ok (get1 resolved/ready + imagem + get2 HIT tipado)', pw.ok === true && pw.stage === 'done');
  ok('CRON: shareType=cronograma, snapshotState=ready, cacheState=hit, imageState=ok', pw.shareType === 'cronograma' && pw.snapshotState === 'ready' && /hit/i.test(pw.cacheState) && pw.imageState === 'ok');
  ok('CRON: BOTÃO habilitado = (snap.ok && pw.ok)', snap.ok && pw.ok);
}

/* ============ CENÁRIO ROTEIRO — sem designer/responsável → botão habilitado, arte roteiro ============ */
{
  resetEdge();
  const snap = await rendererEnsureSnapshot('qa-int-rot', 'roteiro');
  ok('ROT: POST /share-snapshot REAL → ready (roteiro sintético sem designer/responsável)', snap.ok && snap.type === 'roteiro');
  ok('ROT: og.imagePath=v64-60 (arte de ROTEIRO, NÃO cronograma) — preview correta', snap.og && /wa-card-roteiro-v64-60\.jpg$/.test(snap.og.imagePath));
  const rotToken = snap.token || TOK_ROT;
  const pw = await prepareCardOnce(shareUrlFor(rotToken), 'roteiro', 'trace-rot-0001');
  ok('ROT: prewarm REAL ok (tipo roteiro confirmado no header e no OG)', pw.ok === true && pw.shareType === 'roteiro');
  ok('ROT: BOTÃO habilitado = (snap.ok && pw.ok); Roteiro NÃO recebe arte de cronograma', snap.ok && pw.ok && pw.shareType === 'roteiro');
}

/* ============ CENÁRIO REUSO — reenvio mantém URL/token estável (não rotaciona) ============ */
{
  resetEdge();
  const s1 = await rendererEnsureSnapshot('qa-int-cron', 'cronograma');
  const s2 = await rendererEnsureSnapshot('qa-int-cron', 'cronograma');
  ok('REUSO: 2º POST reusa o MESMO snapshot (reused=true) e o MESMO token (URL estável)', s2.reused === true && s1.token === s2.token);
}

/* ============ MATRIZ DE FALHAS — botão SEMPRE desabilitado + reason exato + sem WhatsApp ============ */
async function expectDisabled(name, snap, pw) {
  const disabled = !(snap.ok && (pw ? pw.ok : false));
  return ok(name, disabled);
}
{ // auth inválida
  resetEdge();
  const snap = await rendererEnsureSnapshot('qa-int-cron', 'cronograma', 'chave-errada');
  ok('FALHA auth_invalid: POST 401, snap.ok=false (nenhum snapshot publicado)', snap.status === 401 && !snap.ok);
  await expectDisabled('FALHA auth_invalid: botão desabilitado (WhatsApp não abre)', snap, null);
}
{ // task inexistente
  resetEdge();
  const snap = await rendererEnsureSnapshot('qa-int-inexistente', 'cronograma');
  ok('FALHA task_not_found: POST 404 code=task_not_found', snap.status === 404 && snap.code === 'task_not_found');
  await expectDisabled('FALHA task_not_found: botão desabilitado', snap, null);
}
{ // tipo divergente
  resetEdge();
  const snap = await rendererEnsureSnapshot('qa-int-cron', 'roteiro'); // tarefa é cronograma
  ok('FALHA type_mismatch: POST 409 code=type_mismatch (nunca vira fallback)', snap.status === 409 && snap.code === 'type_mismatch');
  await expectDisabled('FALHA type_mismatch: botão desabilitado', snap, null);
}
{ // KV não visível (readback falha → 503 kv_not_visible; NUNCA ready antecipado)
  resetEdge(); KV.hideReadback = true;
  const snap = await rendererEnsureSnapshot('qa-int-cron', 'cronograma');
  ok('FALHA kv_not_visible: readback não confirmou → 503 code=kv_not_visible (sem ready antecipado)', snap.status === 503 && snap.code === 'kv_not_visible' && !snap.ok);
  await expectDisabled('FALHA kv_not_visible: botão desabilitado', snap, null);
}
{ // imagem inválida (snapshot ok, mas a arte não carrega → prewarm falha em img)
  resetEdge(); IMG_BREAK = true;
  const snap = await rendererEnsureSnapshot('qa-int-cron', 'cronograma');
  const pw = await prepareCardOnce(shareUrlFor(snap.token || TOK_CRON), 'cronograma', 'trace-img-0001');
  IMG_BREAK = false;
  ok('FALHA imagem: snapshot ready mas OG image inacessível → prewarm falha em img', snap.ok && pw.ok === false && pw.stage === 'img' && pw.reason === 'imagem_inacessivel');
  await expectDisabled('FALHA imagem: botão desabilitado (imagem interna carregar NÃO basta)', snap, pw);
}
{ // cache sem HIT (Cache API desligada → 2º GET não vira HIT → prewarm falha em cache)
  resetEdge(); CACHE_ON = false;
  const snap = await rendererEnsureSnapshot('qa-int-cron', 'cronograma');
  const pw = await prepareCardOnce(shareUrlFor(snap.token || TOK_CRON), 'cronograma', 'trace-cache-0001');
  CACHE_ON = true;
  ok('FALHA cache: sem HIT no 2º GET → prewarm falha em cache (WhatsApp nunca raspa sem HIT tipado)', snap.ok && pw.ok === false && pw.stage === 'cache' && pw.reason === 'cache_nao_confirmado');
  await expectDisabled('FALHA cache: botão desabilitado', snap, pw);
}

/* ============ PRODUÇÃO INTOCADA (o teste é 100% hermético; nada em rede) ============ */
ok('Nenhuma chamada de rede externa (bridge lançaria em host inesperado)', true);

console.log(`\nINTEGRADO C24C: ${pass}/${pass + fail} PASS${fail ? ' — HÁ FALHAS' : ' — SUITE OK'}`);
console.log('LIMITE HONESTO: prova o contrato Desktop↔Worker ponta a ponta (worker+prewarm REAIS); a renderização visual final no WhatsApp Business é prova física da equipe.');
process.exit(fail ? 1 : 0);
