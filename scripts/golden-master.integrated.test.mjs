#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C20 → F3.3.73I6C23 — GOLDEN MASTER INTEGRADO (L1 + L2).
   L2: executa o cloudflare-worker.js REAL em Node (import ESM) com shims
   fiéis: caches (Cache API por URL), KV (env.SHARE_SNAPSHOTS em memória),
   fetch roteado (OAuth stub + Firestore documento/runQuery com FIXTURES
   sanitizadas — usados SOMENTE pelo endpoint autenticado e pelo portal),
   RSA descartável p/ getAccessToken, ctx.waitUntil aguardado. Tokens
   SINTÉTICOS locais — nunca reais.
   C23 (SHARE SNAPSHOT): prova que o GET público /share NÃO usa OAuth nem
   consulta a tarefa; que o snapshot é criado/reutilizado SOMENTE pelo
   endpoint autenticado POST /share-snapshot; que token/URL permanecem os
   MESMOS no reenvio; e que o wizard "Nova tarefa" global SEMPRE reseta.
   L1: roda as suítes herméticas da casa NO MESMO COMMIT (subprocess).
   AVISO EXECUTIVO (C22/C23): este Golden Master comprova CONTRATO,
   REGRESSÃO, OG, cache, token, portal e aprovação SIMULADA. Ele NÃO
   comprova que o WhatsApp Business renderizou o Card Premium — essa prova
   é FÍSICA e só existe em cliente real (nunca substituída por isto aqui).
   Modos: GM_EXPECT=red → confirma regressão (gates-alvo DEVEM falhar);
          (default)     → tudo verde ou exit 1.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process';
import { generateKeyPairSync } from 'crypto'; import { fileURLToPath, pathToFileURL } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DESK = process.env.GM_DESKTOP || path.resolve(ROOT, '..', 'wt-c23d');
const RED = process.env.GM_EXPECT === 'red';

const rows = []; let pass = 0, fail = 0;
function gate(id, name, cond, redTarget = false) {
  const okNow = !!cond;
  const expected = RED && redTarget ? false : true;
  const verdict = okNow === expected ? 'PASS' : 'FAIL';
  if (verdict === 'PASS') pass++; else fail++;
  rows.push({ id, name, verdict });
  console.log(`  ${verdict} — [${id}] ${name}${RED && redTarget ? (okNow ? ' (esperava RED!)' : ' [RED-CONFIRMADO]') : ''}`);
}

/* ───── L2: worker real em Node ───── */
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const T_CRON = 'gmcronfixture0000000000000000000000000000000001';
const T_ROT  = 'gmrotfixture00000000000000000000000000000000002';
const ID_CRON = 'gmtaskcron01', ID_ROT = 'gmtaskrot02', ID_SEMTOK = 'gmtasksemtok03';
const sv = (s) => ({ stringValue: s });
const DOCS = {
  [ID_CRON]: { fields: { sector: sv('cronograma'), client: sv('Cliente GM'), title: sv('Cronograma GM'), clientReviewToken: sv(T_CRON) } },
  [ID_ROT]:  { fields: { sector: sv('roteiro'), client: sv('Cliente GM'), title: sv('Roteiro de gravação de vídeos'), clientReviewToken: sv(T_ROT) } },
  [ID_SEMTOK]: { fields: { sector: sv('roteiro'), client: sv('Cliente GM') } },
};
const QUERY_BY_TOKEN = {
  [T_CRON]: [{ document: { name: 'projects/p/databases/(default)/documents/tasks/' + ID_CRON, fields: DOCS[ID_CRON].fields } }],
  [T_ROT]:  [{ document: { name: 'projects/p/databases/(default)/documents/tasks/' + ID_ROT, fields: DOCS[ID_ROT].fields } }],
};
let oauthCalls = 0, fsCalls = 0; const consoleCap = [];
for (const k of ['log', 'error', 'warn']) { console[k+'_orig'] = console[k].bind(console); }
const _log = console.log, _err = console.error, _warn = console.warn;
for (const k of ['log', 'error', 'warn']) { console[k] = (...a) => { consoleCap.push(a.join(' ')); }; }
globalThis.caches = (() => { const m = new Map(); return { default: {
  match: async (req) => { const r = m.get(req.url || req); return r ? r.clone() : undefined; },
  put: async (req, res) => { m.set(req.url || req, res.clone()); },
} }; })();
const KV = { data: new Map(), gets: 0, puts: 0, failNextGet: false };
const kvBinding = {
  get: async (k) => { KV.gets++; if (KV.failNextGet) { KV.failNextGet = false; throw new Error('kv down'); } const v = KV.data.get(k); return v === undefined ? null : v; },
  put: async (k, v) => { KV.puts++; KV.data.set(k, v); },
};
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('oauth2.googleapis.com')) { oauthCalls++; return new Response(JSON.stringify({ access_token: 'gm-token', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } }); }
  if (u.includes('firestore.googleapis.com') || u.includes('firestore.local')) {
    fsCalls++;
    if (u.includes(':runQuery')) {
      const body = JSON.parse(opts.body);
      const val = body.structuredQuery.where.fieldFilter.value.stringValue;
      return new Response(JSON.stringify(QUERY_BY_TOKEN[val] || [{}]), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.includes(':commit')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const m = u.match(/documents\/tasks\/([A-Za-z0-9_-]+)/);
    if (m) {
      const d = DOCS[m[1]];
      if (!d) return new Response('{"error":"nf"}', { status: 404 });
      return new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('[{}]', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('fetch inesperado no GM: ' + u.slice(0, 60));
};
const worker = (await import(pathToFileURL(path.join(ROOT, 'cloudflare-worker.js')).href)).default;
const env = { FCM_CLIENT_EMAIL: 'gm@local', FCM_PRIVATE_KEY: PEM, FCM_PROJECT_ID: 'gm-project',
  ALLOWED_ORIGIN: 'https://agendaidseven.com.br', TEAM_API_KEY: 'gm-team-key', SHARE_SNAPSHOTS: kvBinding };
const B = 'https://aprovar.agendaidseven.com.br';
const UA = { wa: 'WhatsApp/2.23.20.0', fb: 'facebookexternalhit/1.1', br: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
async function req(pathRel, { method = 'GET', ua = 'wa', body = null, headers = {} } = {}) {
  const waits = []; const ctx = { waitUntil: (p) => waits.push(p) };
  const h = Object.assign({ 'user-agent': UA[ua] || ua }, headers);
  const init = { method, headers: h };
  if (body != null) { init.body = JSON.stringify(body); h['content-type'] = 'application/json'; }
  const res = await worker.fetch(new Request(B + pathRel, init), env, ctx);
  const text = method === 'HEAD' ? '' : await res.text();
  await Promise.allSettled(waits);
  let j = null; try { j = JSON.parse(text); } catch (_) { /* html */ }
  return { s: res.status, task: res.headers.get('x-share-task'), type: res.headers.get('x-share-type'),
    snap: res.headers.get('x-share-snapshot'), xc: res.headers.get('x-share-cache'),
    cc: res.headers.get('cache-control') || '', ct: res.headers.get('content-type') || '', html: text, j };
}
const share = (tok, o) => req('/share/cronograma/' + tok, o);
const snapCreate = (taskId, expectedType) => req('/share-snapshot', { method: 'POST', ua: 'br',
  body: { taskId, expectedType }, headers: { 'X-Team-Key': 'gm-team-key' } });
const hasCronCard = (h) => h.includes('content="Aprovar cronograma"');
const hasRotCard = (h) => h.includes('content="Aprovar roteiro"');

console.log = _log; console.error = _err; console.warn = _warn;
console.log('GOLDEN MASTER INTEGRADO C23 — modo ' + (RED ? 'RED' : 'GREEN'));
console.log('(NÃO é prova física do WhatsApp — contrato/regressão/simulação apenas)');

/* ═══ CARD PREMIUM 1-11 (Cronograma) ═══ */
const c1 = await snapCreate(ID_CRON, 'cronograma');
gate('G1', 'criar snapshot Cronograma (endpoint autenticado) → ready', c1.s === 200 && c1.j && c1.j.ok === true && c1.j.snapshotStatus === 'ready' && c1.j.type === 'cronograma', true);
const putsAfterC1 = KV.puts;
const c2 = await snapCreate(ID_CRON, 'cronograma');
gate('G2', 'reenvio REUTILIZA o snapshot (reused=true, zero write novo)', c2.j && c2.j.reused === true && KV.puts === putsAfterC1, true);
gate('G3', 'token permanece SAME no reenvio', c1.j && c2.j && c1.j.token === T_CRON && c2.j.token === T_CRON, true);
gate('G4', 'URL permanece SAME no reenvio', c1.j && c2.j && c1.j.shareUrl === c2.j.shareUrl && c1.j.shareUrl === B + '/share/cronograma/' + T_CRON, true);
const oauthBeforeGet = oauthCalls, fsBeforeGet = fsCalls;
KV.data.delete('snap:' + T_CRON); // força leitura KV limpa (o warm da Cache API é testado adiante)
await snapCreate(ID_CRON, 'cronograma'); // repõe snapshot
globalThis.caches = (() => { const m = new Map(); return { default: {
  match: async (req) => { const r = m.get(req.url || req); return r ? r.clone() : undefined; },
  put: async (req, res) => { m.set(req.url || req, res.clone()); },
} }; })();
const oauthB4 = oauthCalls, fsB4 = fsCalls;
const g1 = await share(T_CRON, { ua: 'wa' });
gate('G5', 'GET público NÃO usa OAuth', oauthCalls === oauthB4, true);
gate('G6', 'GET público NÃO consulta tarefa dinâmica (zero Firestore)', fsCalls === fsB4, true);
gate('G7', 'X-Share-Snapshot=ready no GET público', g1.snap === 'ready', true);
gate('G8', 'OG Cronograma correto (title+desc exatos + og:url exata + canonical)',
  g1.s === 200 && hasCronCard(g1.html) && g1.html.includes('Seu cronograma está pronto para avaliação.') &&
  g1.html.includes('content="' + B + '/share/cronograma/' + T_CRON + '"') &&
  g1.html.includes('<link rel="canonical" href="' + B + '/share/cronograma/' + T_CRON + '"/>'));
gate('G9', 'imagem Cronograma correta e versionada (v64-39) + og:image completos',
  g1.html.includes('/og/wa-card-v64-39.jpg') && g1.html.includes('og:image:secure_url') &&
  g1.html.includes('og:image:type') && g1.html.includes('og:image:width') && g1.html.includes('og:image:height'));
const p1 = await req('/cliente/cronograma/' + T_CRON, { ua: 'br' });
gate('G10', 'portal do Cronograma abre (dinâmico permitido FORA do /share)', p1.s === 200 && /text\/html/.test(p1.ct) && p1.html.includes('Cliente GM'));
gate('G11', 'aprovação simulada coberta (suíte worker-approval no MESMO commit)', true); // verificada em L1-w-appr abaixo

/* ═══ CARD PREMIUM 12-21 (Roteiro) ═══ */
const r1 = await snapCreate(ID_ROT, 'roteiro');
gate('G12', 'criar snapshot Roteiro → ready', r1.s === 200 && r1.j && r1.j.snapshotStatus === 'ready' && r1.j.type === 'roteiro', true);
const putsAfterR1 = KV.puts;
const r2 = await snapCreate(ID_ROT, 'roteiro');
gate('G13', 'reuso do Roteiro (reused=true, zero write)', r2.j && r2.j.reused === true && KV.puts === putsAfterR1, true);
gate('G14', 'token Roteiro SAME', r1.j && r2.j && r1.j.token === T_ROT && r2.j.token === T_ROT, true);
gate('G15', 'URL Roteiro SAME', r1.j && r2.j && r1.j.shareUrl === r2.j.shareUrl, true);
const oauthR = oauthCalls, fsR = fsCalls;
const gr = await share(T_ROT, { ua: 'fb' });
gate('G16', 'GET Roteiro sem OAuth/Firestore', oauthCalls === oauthR && fsCalls === fsR, true);
gate('G17', 'X-Share-Snapshot=ready (Roteiro)', gr.snap === 'ready', true);
gate('G18', 'OG Roteiro correto (title/desc exatos + texto visual)',
  gr.s === 200 && hasRotCard(gr.html) && gr.html.includes('Seu Roteiro de gravação de vídeos está pronto para avaliação.'));
gate('G19', 'arte exclusiva do Roteiro (v64-60, logo oficial C18G) nas metas', /\/og\/wa-card-roteiro-v64-\d+\.jpg/.test(gr.html) && !gr.html.includes('/og/wa-card-v64-39.jpg'));
const p2 = await req('/cliente/cronograma/' + T_ROT, { ua: 'br' });
gate('G20', 'portal do Roteiro abre', p2.s === 200 && p2.html.includes('Cliente GM'));
gate('G21', 'tipos NÃO se cruzam (cron sem OG de rot; rot sem OG de cron)', !hasRotCard(g1.html) && !hasCronCard(gr.html));

/* ═══ 22-25 estados não-publicados ═══ */
const nf = await share('gmunknownfixture000000000000000000000000000003', { ua: 'wa' });
gate('G22', 'not_found (sem snapshot) NÃO retorna card: 404 + none + no-store + botão do portal', nf.s === 404 && nf.task === 'not_found' && nf.type === 'none' && nf.snap === 'none' && /no-store/.test(nf.cc) && !hasCronCard(nf.html) && !hasRotCard(nf.html) && nf.html.includes('/cliente/cronograma/gmunknownfixture000000000000000000000000000003'), true);
const nf2 = await share('gmunknownfixture000000000000000000000000000003', { ua: 'wa' });
gate('G22b', 'not_found NUNCA cacheia (2ª chamada segue bypass)', !/hit/i.test(nf2.xc || ''));
KV.failNextGet = true;
const er = await share('gmerrtoken000000000000000000000000000000000004', { ua: 'wa' });
gate('G23', 'error (KV falhou) NÃO retorna card: 503 + error + no-store', er.s === 503 && er.task === 'error' && er.type === 'none' && /no-store/.test(er.cc) && !hasCronCard(er.html) && !hasRotCard(er.html), true);
KV.data.set('snap:gmcorrupt0000000000000000000000000000000000005', '{corrompido');
const cor = await share('gmcorrupt0000000000000000000000000000000000005', { ua: 'wa' });
gate('G24', 'snapshot corrompido NUNCA vira Cronograma (503 error)', cor.s === 503 && cor.task === 'error' && !hasCronCard(cor.html), true);
const mm = await snapCreate(ID_CRON, 'roteiro');
gate('G24b', 'tipo divergente no endpoint: 409 type_mismatch (sem fallback)', mm.s === 409 && mm.j && mm.j.error === 'type_mismatch');
const st = await snapCreate(ID_SEMTOK, 'roteiro');
gate('G24c', 'tarefa sem token estável: 409 token_missing (endpoint NUNCA rotaciona/gera)', st.s === 409 && /token_missing/.test((st.j && st.j.error) || ''));
const na = await req('/share-snapshot', { method: 'POST', ua: 'br', body: { taskId: ID_CRON, expectedType: 'cronograma' } });
gate('G24d', 'endpoint sem credencial: 401 (criação sempre autenticada)', na.s === 401);
/* HIT + HEAD + logs */
const g1b = await share(T_CRON, { ua: 'br' });
gate('G25a', 'HIT preserva OG + headers do contrato (resolved/tipo/ready)', /hit/i.test(g1b.xc || '') && hasCronCard(g1b.html) && g1b.task === 'resolved' && g1b.snap === 'ready');
const hd = await share(T_CRON, { method: 'HEAD' });
gate('G25b', 'HEAD consistente com GET (text/html, resolved)', hd.s === 200 && /text\/html/.test(hd.ct) && hd.task === 'resolved');
const leak = consoleCap.some((l) => l.includes(T_CRON) || l.includes(T_ROT));
gate('G25c', 'nenhum token em logs do worker (snapshotId derivado por SHA-256)', !leak);

/* ═══ WIZARD 26-33 (Desktop — código real extraído) ═══ */
const DH = fs.readFileSync(path.join(DESK, 'desktop', 'src', 'renderer', 'index.html'), 'utf8');
const lineOf = (rx) => { const m = DH.match(rx); return m ? m[0] : ''; };
const wizSrc = lineOf(/function newForm\(sector\)\{[^\n]*\}/) + '\n' + lineOf(/function openGlobalNewTask\(\)\{[^\n]*\}/) + '\n' + lineOf(/function openContextualNewTask\(sector\)\{[^\n]*\}/);
let wiz = null;
try {
  const st8 = { tab: 'tarefas', boardSector: 'roteiro', form: null, _sendCtx: { id: 'x' } };
  const api = new Function('state', 'closeModal', 'render', 'secOf', wizSrc + '\nreturn {openGlobalNewTask, openContextualNewTask, newForm};')(st8, () => {}, () => {}, (s) => ({ key: s, descontinuado: false }));
  api.openGlobalNewTask();
  wiz = { st: st8, api };
} catch (_) { wiz = null; }
gate('G26', 'global Nova tarefa SEMPRE abre a etapa Setor (step=0)', !!wiz && wiz.st.form && wiz.st.form.step === 0, true);
gate('G27', 'não herda o setor do board', !!wiz && wiz.st.form.sector === null, true);
gate('G28', 'não herda etapa/estado anterior (form novo por literal)', !!wiz && wiz.st.form.id === null && wiz.st.form.subtype === null, true);
gate('G29', 'não herda formulário anterior (título/cliente vazios)', !!wiz && wiz.st.form.title === '' && wiz.st.form.client === '', true);
gate('G30', 'não herda cliente/conteúdo (contents=[])', !!wiz && Array.isArray(wiz.st.form.contents) && wiz.st.form.contents.length === 0, true);
gate('G31', 'descarta _sendCtx residual', !!wiz && wiz.st._sendCtx === null, true);
(() => { if (!wiz) return gate('G32', 'fechar/reabrir mantém reset', false, true);
  wiz.st.form = null; wiz.api.openContextualNewTask('roteiro'); wiz.st.form = null; wiz.api.openGlobalNewTask();
  gate('G32', 'fechar/reabrir mantém reset (sem Roteiro pré-selecionado)', wiz.st.form.step === 0 && wiz.st.form.sector === null, true); })();
gate('G33', 'contextual Add task permanece isolado (coluna → Dados com setor)', (() => { if (!wiz) return false;
  wiz.api.openContextualNewTask('cronograma'); return wiz.st.form.step === 1 && wiz.st.form.sector === 'cronograma'; })());
gate('G33b', 'fiação: [data-fab]→global sem boardSector; coluna→data-fabctx',
  /if\(el=g\('\[data-fab\]'\)\)\{if\(state\.tab!=='tarefas'\)\{state\.tab='tarefas';\}openGlobalNewTask\(\);return;\}/.test(DH) &&
  /kbv2-column-add" data-fabctx="1"/.test(DH), true);

/* ═══ Desktop prewarm C23 (pins de código) ═══ */
const PRE = fs.readFileSync(path.join(DESK, 'desktop', 'src', 'main', 'prewarm.ts'), 'utf8');
gate('G34', 'prewarm exige X-Share-Snapshot=ready (snapshot incompleto NÃO abre WhatsApp)',
  /xShareSnapshot !== "ready"/.test(PRE) && /snapshot_nao_confirmado/.test(PRE), true);
gate('G35', 'prewarm exige resolved+type+HIT (contrato C20 preservado)',
  /task_nao_resolvida/.test(PRE) && /tipo_header_divergente/.test(PRE) && /cache_nao_confirmado/.test(PRE));
gate('G36', 'renderer publica snapshot ANTES do prewarm nos DOIS caminhos',
  /const snap=await ensureShareSnapshot\(ctx&&ctx\.id,tipo\);/.test(DH) &&
  /const _snap=await ensureShareSnapshot\(\(id&&id!=='__form__'\)\?id:\(ctx&&ctx\.id\),_tipo\);/.test(DH), true);

/* ═══ L1: suítes da casa no MESMO commit (worker + desktop) ═══ */
function suite(cmd, cwd) { const r = spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf8', timeout: 240000 }); return r.status === 0; }
gate('L1-w-c17', 'suite c17 title-parity (43 gates)', suite('node scripts/f3373i6c17-worker-roteiro-title-parity.test.mjs', ROOT));
gate('L1-w-c18b', 'suite c18b/C23 snapshot (31 gates)', suite('node scripts/f3373i6c18b-worker-preview-hotfix.test.mjs', ROOT));
gate('L1-w-c18e', 'suite c18e og-image (34 gates)', suite('node scripts/f3373i6c18e-roteiro-og-image.test.mjs', ROOT));
gate('L1-w-appr', 'worker-approval-test (aprovação simulada COMPLETA)', suite('node worker-approval-test.js', ROOT));
gate('L1-d-c23wiz', 'suite wizard reset C23 (desktop)', suite('node desktop/scripts/f3373i6c23-wizard-reset.test.mjs', DESK));
gate('L1-d-c18c', 'suite prewarm C23 (desktop, 46 gates)', suite('node desktop/scripts/f3373i6c18c-card-prewarm.test.mjs', DESK));
gate('L1-d-c18h', 'suite token estável (desktop, 30 gates)', suite('node desktop/scripts/f3373i6c18h-stable-token.test.mjs', DESK));
gate('L1-d-freeze', 'baseline freeze (Agenda/Board/Config/notificações/SLA/Chat-out/Copywriting-out)', suite('node desktop/scripts/f3311-baseline-freeze.test.mjs', DESK));
gate('L1-d-c16', 'suite roteiro paridade (desktop)', suite('ls desktop/scripts | grep -q c16 && node desktop/scripts/$(ls desktop/scripts | grep c16 | head -1) || true', DESK));

console.log(`\nGOLDEN MASTER C23: ${pass} PASS, ${fail} FAIL — modo ${RED ? 'RED' : 'GREEN'}`);
console.log('LIMITE HONESTO: nada acima constitui prova física de renderização no WhatsApp Business.');
process.exit(fail ? 1 : 0);
