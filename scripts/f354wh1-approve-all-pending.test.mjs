#!/usr/bin/env node
/* =====================================================================
   F3.5.4W-H1 (E4) — "APROVAR TUDO" (approveAllPending) NO PORTAL DO CLIENTE.
   Executa o worker REAL em sandbox (sem rede real, sem deploy): fetch é um
   ROTEADOR sintético (OAuth stub + Firestore runQuery/commit com fixtures
   locais; tokens SINTÉTICOS — nunca reais). Prova:
     • RED: a BASE VIVA 39faaaf rejeita approveAllPending ("ação inválida");
     • GREEN: lote atômico (1 commit), idempotente (Idempotency-Key replay),
       vinculado à fase (stale rejeitado SEM escrita), respeita ajustes
       pendentes, NUNCA aprova legenda vazia, preserva já-aprovados,
       fecha a fase com os MESMOS campos do approveAll canônico;
     • PINOS: caminhos canônicos byte-idênticos à base 39faaaf
       (writeClientGranular/queryTaskByToken/getAccessToken/clientPhase/…);
     • PRIVACIDADE: designerItemNotes/internalNotes NUNCA no HTML nem no /state.
   BASE: env F354WH1_BASE_SRC=<arquivo 39faaaf> OU `git show 39faaaf:cloudflare-worker.js`.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { fileURLToPath } from 'url'; import { generateKeyPairSync, webcrypto } from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRCPATH = path.resolve(__dirname, '..', 'cloudflare-worker.js');
const BASE_SHA = '39faaafcab90299dd9de4dd8bd2731b430fed291';

let BASE_SRC_TEXT = '';
if (process.env.F354WH1_BASE_SRC) BASE_SRC_TEXT = fs.readFileSync(process.env.F354WH1_BASE_SRC, 'utf8');
else BASE_SRC_TEXT = execSync('git show ' + BASE_SHA + ':cloudflare-worker.js', { cwd: path.resolve(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }).toString();

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

/* ───────── fixtures sintéticas (Firestore typed) ───────── */
const sv = (s) => ({ stringValue: String(s) });
const iv = (n) => ({ integerValue: String(n) });
const bv = (b) => ({ booleanValue: !!b });
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return sv(v);
  if (typeof v === 'number') return iv(v);
  if (typeof v === 'boolean') return bv(v);
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  const f = {}; for (const k of Object.keys(v)) f[k] = enc(v[k]);
  return { mapValue: { fields: f } };
}
function encFields(o) { const f = {}; for (const k of Object.keys(o)) f[k] = enc(o[k]); return f; }
const doc = (id, o) => ({ document: { name: 'projects/agenda-id-seven/databases/(default)/documents/tasks/' + id, fields: encFields(o) } });
const FIXTURES = {};   // token -> rows runQuery
function setFix(tok, o) { FIXTURES[tok] = o ? [doc('TASKF354WH1' + tok.slice(0, 10), o)] : [{}]; }

/* ───────── sandbox: worker REAL + roteador de rede sintético (commit CAPTURADO) ───────── */
function loadWorker(srcText) {
  const RUN = srcText.replace(/^export default\s*\{/m, 'var __default__ = {').replace(/^export const /gm, 'const ');
  const commits = [];  // POST documents:commit {body}
  const writes = [];   // PATCH tasks/{id}
  const cacheStore = new Map();   // Cache API REAL (idempotência/dedup observáveis)
  async function fakeFetch(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    init = init || (typeof input === 'object' ? input : {});
    const method = (init.method || 'GET').toUpperCase();
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'sandbox-token', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('documents:runQuery') && method === 'POST') {
      const q = JSON.parse(init.body);
      const val = q.structuredQuery.where.fieldFilter.value.stringValue;
      const field = q.structuredQuery.where.fieldFilter.field.fieldPath;
      const rows = (field === 'clientReviewToken' && FIXTURES[val]) ? FIXTURES[val] : [{}];
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('documents:commit') && method === 'POST') {
      commits.push(JSON.parse(init.body));
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (method === 'PATCH' && url.includes('/documents/tasks/')) {
      writes.push({ url, body: JSON.parse(init.body) });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('rede INESPERADA no teste: ' + method + ' ' + url);
  }
  const stubs = {
    addEventListener: () => {},
    caches: { default: {
      match: async (req) => { const k = typeof req === 'string' ? req : req.url; const v = cacheStore.get(k); return v ? new Response(v.body, { status: v.status }) : undefined; },
      put: async (req, res) => { const k = typeof req === 'string' ? req : req.url; cacheStore.set(k, { body: await res.clone().text(), status: res.status }); },
      delete: async () => true,
    } },
    fetch: fakeFetch,
    setInterval: () => 0, clearInterval: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    self: {}, crypto: webcrypto,
  };
  const names = Object.keys(stubs);
  const F = new Function(...names, RUN + '\nreturn { __default__, renderClientHtml, clientPhase, premiumTypeOf };');
  return { api: F(...names.map((n) => stubs[n])), commits, writes, cacheStore, SRC: srcText };
}
function fnSrc(SRC, name) {
  const m = SRC.match(new RegExp('(?:async )?function ' + name + '\\s*\\('));
  if (!m) throw new Error('fn ' + name);
  const st = SRC.indexOf(m[0]); let d = 0;
  for (let j = SRC.indexOf('{', st); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); } }
  throw new Error('sem fecho ' + name);
}

const ENV = { FCM_PROJECT_ID: 'agenda-id-seven', FCM_CLIENT_EMAIL: 'sa@sandbox', FCM_PRIVATE_KEY: PEM, ENABLE_CLIENT_WEB_PUSH: 'false', VAPID_PUBLIC_KEY: '' };
const ORIGIN = 'https://aprovar-qa.agendaidseven.com.br';
const CTX = { waitUntil: () => {} };
async function act(W, token, body, headers) {
  const req = new Request(ORIGIN + '/cliente/cronograma/' + token + '/action',
    { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body) });
  const res = await W.api.__default__.fetch(req, ENV, CTX);
  return { status: res.status, headers: res.headers, j: await res.json() };
}
async function state(W, token) {
  const res = await W.api.__default__.fetch(new Request(ORIGIN + '/cliente/cronograma/' + token + '/state'), ENV, CTX);
  return { status: res.status, text: await res.text() };
}

const NEW = () => loadWorker(fs.readFileSync(SRCPATH, 'utf8'));
const OLDW = () => loadWorker(BASE_SRC_TEXT);
const SRC = fs.readFileSync(SRCPATH, 'utf8');

/* fixtures base */
const TK = (s) => ('f354wh1' + s).padEnd(44, '0');
function cron5(extra) {  // cronograma fase THEMES (nem todas com legenda+feed)
  return Object.assign({
    client: 'Cliente Sintetico E4', title: 'Cronograma E4', sector: 'cronograma',
    clientReviewToken: '', updatedAt: 1754300000000,
    cronWeeks: [{ tema: 'Tema 01' }, { tema: 'Tema 02' }, { tema: 'Tema 03' }, { tema: 'Tema 04' }, { tema: 'Tema 05' }],
  }, extra || {});
}

console.log('== F3.5.4W-H1 (E4) — Aprovar tudo (approveAllPending): RED base → GREEN + pinos + privacidade ==');

/* ───── RED: base viva 39faaaf NÃO conhece a ação ───── */
{
  const W = OLDW();
  const t = TK('red'); setFix(t, cron5({ clientReviewToken: t }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'themes' });
  ok('R1  RED @39faaaf: approveAllPending rejeitado ("ação inválida", 400) — a ação NÃO existia na base viva', r.status === 400 && r.j && r.j.ok === false);
  ok('R2  RED @39faaaf: nenhuma escrita disparada pela ação desconhecida', W.commits.length === 0 && W.writes.length === 0);
}

/* ───── GREEN: lote na fase THEMES (fecha a fase com os campos canônicos) ───── */
{
  const W = NEW();
  const t = TK('gr1'); setFix(t, cron5({ clientReviewToken: t }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'themes' });
  ok('G1  ok:true, phase=themes, approved=5, pending=0, finalized=true', r.j.ok === true && r.j.phase === 'themes' && r.j.approved === 5 && r.j.pending === 0 && r.j.finalized === true);
  ok('G2  final=false na fase themes (NÃO encerra o cronograma)', r.j.final === false);
  ok('G3  approvedIndexes = [0..4] (feedback imediato da UI)', JSON.stringify(r.j.approvedIndexes) === '[0,1,2,3,4]');
  ok('G4  ATÔMICO: exatamente 1 documents:commit (e zero PATCH)', W.commits.length === 1 && W.writes.length === 0);
  const wr = W.commits[0].writes[0];
  const mask = wr.updateMask.fieldPaths;
  ok('G5  fecha a fase com os MESMOS campos do approveAll canônico', ['cronStatus', 'clientReview', 'clientReviewAt', 'status', 'workflowStage', 'clientFlowStatus', 'clientWorkflowStage'].every((k) => mask.includes(k)));
  ok('G6  cronStatus=aprovado_cliente · clientFlowStatus=aprovado · status=andamento · stage=producao',
    wr.update.fields.cronStatus.stringValue === 'aprovado_cliente' && wr.update.fields.clientFlowStatus.stringValue === 'aprovado' &&
    wr.update.fields.status.stringValue === 'andamento' && wr.update.fields.workflowStage.stringValue === 'producao');
  ok('G7  NÃO marca conclusão final na fase themes (sem finalApprovalCompleted)', !mask.includes('finalApprovalCompleted'));
  const tr = wr.updateTransforms;
  ok('G8  UMA entrada de história agrupada (1 appendMissingElements, 1 value)', tr.length === 1 && tr[0].fieldPath === 'history' && tr[0].appendMissingElements.values.length === 1);
  ok('G9  história com type canônico cliente_aprovou (paridade Desktop)', tr[0].appendMissingElements.values[0].mapValue.fields.type.stringValue === 'cliente_aprovou');
  const acts0 = wr.update.fields.clientActions.mapValue.fields;
  const aKey = Object.keys(acts0)[0];
  ok('G10 clientActions registra o LOTE (type=approveAllPending, approved=5, finalized=true)',
    acts0[aKey].mapValue.fields.type.stringValue === 'approveAllPending' && acts0[aKey].mapValue.fields.approved.integerValue === '5' && acts0[aKey].mapValue.fields.finalized.booleanValue === true);
}

/* ───── já-aprovados PRESERVADOS + limpeza canônica por transição ───── */
{
  const W = NEW();
  const t = TK('gr2'); setFix(t, cron5({ clientReviewToken: t, clientItems: { i0: { cs: 'aprovado', phase: 'themes', at: 1754200000000, note: 'minha nota' } } }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'themes' });
  ok('G11 parcialmente aprovado antes: approved=4 (i0 preservado, não reescrito)', r.j.ok === true && r.j.approved === 4 && JSON.stringify(r.j.approvedIndexes) === '[1,2,3,4]');
  const mask = W.commits[0].writes[0].updateMask.fieldPaths;
  ok('G12 fechamento inclui limpeza V64.42 do item da fase (clientItems.i0.cs → null)', mask.includes('clientItems.i0.cs'));
  ok('G13 limpeza é GRANULAR (.cs) — note do cliente em i0 preservada (sem replace do mapa)', !mask.includes('clientItems.i0'));
}

/* ───── PRODUCTION: legenda vazia NUNCA aprovada; parcial não fecha a fase ───── */
{
  const W = NEW();
  const t = TK('gr3');
  setFix(t, cron5({ clientReviewToken: t, clientApprovalPhase: 'production',
    cronWeeks: [{ tema: 'T1', legenda: 'Leg 1' }, { tema: 'T2', legenda: 'Leg 2' }, { tema: 'T3' }] }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'production' });
  ok('P1  production: approved=2, pending=1 (legenda vazia), finalized=false', r.j.ok === true && r.j.approved === 2 && r.j.pending === 1 && r.j.finalized === false);
  const wr = W.commits[0].writes[0]; const mask = wr.updateMask.fieldPaths;
  ok('P2  parcial NÃO fecha a fase (sem cronStatus/clientFlowStatus na máscara)', !mask.includes('cronStatus') && !mask.includes('clientFlowStatus'));
  ok('P3  máscara GRANULAR .cs/.phase/.at (preserva note/theme/legenda overrides)', mask.includes('clientItems.i0.cs') && mask.includes('clientItems.i0.phase') && mask.includes('clientItems.i0.at') && !mask.includes('clientItems.i0'));
  ok('P4  i2 (sem legenda) NÃO aparece na escrita', !mask.some((k) => k.startsWith('clientItems.i2')));
  ok('P5  itens aprovados com cs=aprovado e phase=production', wr.update.fields.clientItems.mapValue.fields.i0.mapValue.fields.cs.stringValue === 'aprovado' && wr.update.fields.clientItems.mapValue.fields.i0.mapValue.fields.phase.stringValue === 'production');
  ok('P6  história parcial informa contagem e legendas pendentes', wr.updateTransforms[0].appendMissingElements.values[0].mapValue.fields.label.stringValue.includes('2') && wr.updateTransforms[0].appendMissingElements.values[0].mapValue.fields.label.stringValue.includes('aguardando legenda'));
}

/* ───── FINAL: fecha com conclusão total ───── */
{
  const W = NEW();
  const t = TK('gr4');
  setFix(t, cron5({ clientReviewToken: t, clientApprovalPhase: 'final',
    cronWeeks: [{ tema: 'T1', legenda: 'L1' }, { tema: 'T2', legenda: 'L2' }] }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'final' });
  ok('F1  final: finalized=true e final=true (encerra o processo)', r.j.ok === true && r.j.finalized === true && r.j.final === true);
  const wr = W.commits[0].writes[0]; const mask = wr.updateMask.fieldPaths;
  ok('F2  conclusão final canônica (finalApprovalCompleted + clientFinalApprovedBy=Cliente + operationalStatus=concluido)',
    mask.includes('finalApprovalCompleted') && wr.update.fields.finalApprovalCompleted.booleanValue === true &&
    wr.update.fields.clientFinalApprovedBy.stringValue === 'Cliente' && wr.update.fields.operationalStatus.stringValue === 'concluido');
}

/* ───── GUARDAS: ajuste pendente · stale · token inválido — SEM escrita ───── */
{
  const W = NEW();
  const t = TK('gd1'); setFix(t, cron5({ clientReviewToken: t, clientItems: { i1: { cs: 'em_revisao', phase: 'themes', note: 'ajustar' } } }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'themes' });
  ok('S1  ajuste pendente na fase ⇒ revision_pending SEM escrita (nunca aprova por cima)', r.j.ok === false && r.j.error === 'revision_pending' && W.commits.length === 0);
}
{
  const W = NEW();
  const t = TK('gd2'); setFix(t, cron5({ clientReviewToken: t, clientApprovalPhase: 'production', cronWeeks: [{ tema: 'T1', legenda: 'L1' }] }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'themes' });   // página aberta na fase antiga
  ok('S2  fase divergente (página desatualizada) ⇒ stale SEM escrita, fase real retornada', r.j.ok === false && r.j.error === 'stale' && r.j.phase === 'production' && W.commits.length === 0);
}
{
  const W = NEW();
  const r = await act(W, TK('nao-existe'), { action: 'approveAllPending', phase: 'themes' });
  ok('S3  token inválido ⇒ 404 (mesma capability do portal preservada)', r.status === 404 && W.commits.length === 0);
}

/* ───── IDEMPOTÊNCIA: clique duplo com Idempotency-Key não duplica ───── */
{
  const W = NEW();
  const t = TK('idm'); setFix(t, cron5({ clientReviewToken: t }));
  const h = { 'Idempotency-Key': 'aap-teste-123' };
  const r1 = await act(W, t, { action: 'approveAllPending', phase: 'themes' }, h);
  const c1 = W.commits.length;
  const r2 = await act(W, t, { action: 'approveAllPending', phase: 'themes' }, h);
  ok('I1  1º clique grava (1 commit) e 2º clique REPLAY (0 commits novos)', r1.j.ok === true && c1 === 1 && W.commits.length === 1);
  ok('I2  replay marcado (X-Idempotency-Replayed) com o MESMO resultado', r2.headers.get('X-Idempotency-Replayed') === 'true' && r2.j.approved === r1.j.approved && r2.j.finalized === r1.j.finalized);
}

/* ───── NO-OP: tudo já aprovado e fase fechada ⇒ sem escrita/notificação ───── */
{
  const W = NEW();
  const t = TK('nop');
  setFix(t, cron5({ clientReviewToken: t, clientFlowStatus: 'aprovado', cronStatus: 'aprovado_cliente',
    clientItems: { i0: { cs: 'aprovado', phase: 'themes' }, i1: { cs: 'aprovado', phase: 'themes' }, i2: { cs: 'aprovado', phase: 'themes' }, i3: { cs: 'aprovado', phase: 'themes' }, i4: { cs: 'aprovado', phase: 'themes' } } }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'themes' });
  ok('N1  tudo já aprovado+fechado ⇒ no-op idempotente (ok:true, approved=0, ZERO escrita)', r.j.ok === true && r.j.approved === 0 && W.commits.length === 0);
}

/* ───── ROTEIRO: legenda exigida mesmo na fase themes (themesOnly=false) ───── */
{
  const W = NEW();
  const t = TK('rot');
  setFix(t, cron5({ clientReviewToken: t, sector: 'roteiro', title: 'Roteiro E4',
    cronWeeks: [{ tema: 'R1', legenda: 'Fala 1' }, { tema: 'R2' }] }));
  const r = await act(W, t, { action: 'approveAllPending', phase: 'themes' });
  ok('T1  roteiro: item sem legenda fica pendente (approved=1, pending=1, finalized=false)', r.j.ok === true && r.j.approved === 1 && r.j.pending === 1 && r.j.finalized === false);
}

/* ───── CANÔNICOS INTOCADOS: comportamento + byte-pins vs 39faaaf ───── */
{
  const W = NEW();
  const t = TK('cn1'); setFix(t, cron5({ clientReviewToken: t }));
  const r = await act(W, t, { action: 'approveItem', contentIndex: 2 });
  const mask = W.commits[0].writes[0].updateMask.fieldPaths;
  ok('C1  approveItem canônico intacto: aprova SÓ o item e NUNCA fecha a fase', r.j.ok === true && mask.includes('clientItems.i2') && !mask.includes('cronStatus'));
}
{
  const W = NEW();
  const t = TK('cn2'); setFix(t, cron5({ clientReviewToken: t, clientItems: { i0: { cs: 'aprovado', phase: 'themes' }, i1: { cs: 'aprovado', phase: 'themes' }, i2: { cs: 'aprovado', phase: 'themes' }, i3: { cs: 'aprovado', phase: 'themes' }, i4: { cs: 'aprovado', phase: 'themes' } } }));
  const r = await act(W, t, { action: 'approveAll' });
  ok('C2  approveAll canônico intacto: fecha a fase (cronStatus=aprovado_cliente)', r.j.ok === true && W.commits.length === 1 && W.commits[0].writes[0].update.fields.cronStatus.stringValue === 'aprovado_cliente');
}
{
  const pins = ['writeClientGranular', 'queryTaskByToken', 'queryTaskByField', 'getAccessToken', 'clientPhase', 'clientAckedPhase', 'notifyWorkflowEvent', 'handleClientCronogramaState'];
  for (const p of pins) ok('C3  pino byte-idêntico vs 39faaaf: ' + p, fnSrc(SRC, p) === fnSrc(BASE_SRC_TEXT, p));
  const hNew = fnSrc(SRC, 'handleClientCronogramaAction'), hOld = fnSrc(BASE_SRC_TEXT, 'handleClientCronogramaAction');
  // remove 1º a linha nova do ALLOWED; depois o bloco do branch (do comentário-marcador até const phaseIn)
  const noAllowed = hNew.replace(/\n\s*"approveAllPending",[^\n]*/, '');
  const stripped = noAllowed.replace(/  \/\/ F3\.5\.4W-H1 \(E4\)[\s\S]*?\n  const phaseIn = clientPhase\(task\);/, '  const phaseIn = clientPhase(task);');
  ok('C4  handler diverge SÓ pelo bloco approveAllPending inserido (+ linha do ALLOWED)', noAllowed !== hNew && stripped !== noAllowed && stripped === hOld);
}

/* ───── UI: botão/consts no HTML renderizado (server-rendered + JS) ───── */
{
  const W = NEW();
  const task = cron5({});
  const html = W.api.renderClientHtml(task, TK('ui1'), ENV, ORIGIN);
  ok('U1  rodapé server-rendered tem o CTA "Aprovar tudo" (data-act=approveAllPending) quando há pendentes', html.includes('data-act="approveAllPending"') && html.includes('Aprovar tudo'));
  ok('U2  consts BATCH_PEND/BATCH_EMPTYLEG emitidas (5 pendentes, 0 sem legenda na fase themes)', html.includes('var BATCH_PEND=5;') && html.includes('var BATCH_EMPTYLEG=0;'));
  ok('U3  JS: handler do clique + confirm com contagens + postIdem com Idempotency-Key', html.includes("act==='approveAllPending'") && html.includes('function postIdem') && html.includes("'Idempotency-Key':key"));
  ok('U4  aprovação individual preservada no HTML (approveItem + approveAll canônico)', html.includes('data-act="approveItem"') && html.includes("act==='approveAll'"));
  const taskProd = cron5({ clientApprovalPhase: 'production', cronWeeks: [{ tema: 'T1', legenda: 'L1' }, { tema: 'T2' }] });
  const htmlProd = W.api.renderClientHtml(taskProd, TK('ui2'), ENV, ORIGIN);
  ok('U5  production com 1 legenda vazia: BATCH_PEND=1 e BATCH_EMPTYLEG=1 (aviso de pendência)', htmlProd.includes('var BATCH_PEND=1;') && htmlProd.includes('var BATCH_EMPTYLEG=1;'));
  const allAp = cron5({ clientItems: { i0: { cs: 'aprovado', phase: 'themes' }, i1: { cs: 'aprovado', phase: 'themes' }, i2: { cs: 'aprovado', phase: 'themes' }, i3: { cs: 'aprovado', phase: 'themes' }, i4: { cs: 'aprovado', phase: 'themes' } } });
  const htmlAll = W.api.renderClientHtml(allAp, TK('ui3'), ENV, ORIGIN);
  // o rodapé SERVER-RENDERED (.gactions) é a autoridade no load; o JS (syncFooter) contém o template
  // do botão sempre, mas o guarda bp>0 impede a renderização (provado em U2/U5 + handler S-guards).
  const footAll = htmlAll.slice(htmlAll.indexOf('<div class="gactions">'), htmlAll.indexOf('<div class="scrim"'));
  ok('U6  com tudo aprovado o rodapé volta ao approveAll canônico (sem o botão de lote no .gactions)', !footAll.includes('data-act="approveAllPending"') && footAll.includes('data-act="approveAll"'));
}

/* ───── PRIVACIDADE (E5×E4): observação interna NUNCA chega ao cliente ───── */
{
  const W = NEW();
  const t = TK('pv1');
  const task = cron5({ clientReviewToken: t,
    designerItemNotes: { i0: 'SEGREDOINTERNO001 prioridade máxima', i2: 'NOTAINTERNA002 usar referência X' },
    internalNotes: 'COMENTARIOINTERNOSECRETO' });
  setFix(t, task);
  const html = W.api.renderClientHtml(task, t, ENV, ORIGIN);
  ok('V1  HTML do portal NÃO contém designerItemNotes (nem o nome do campo)', !html.includes('SEGREDOINTERNO001') && !html.includes('NOTAINTERNA002') && !html.includes('designerItemNotes'));
  ok('V2  HTML do portal NÃO contém internalNotes', !html.includes('COMENTARIOINTERNOSECRETO'));
  const st = await state(W, t);
  ok('V3  /state (JSON tempo-real) NÃO contém as observações internas', st.status === 200 && !st.text.includes('SEGREDOINTERNO001') && !st.text.includes('NOTAINTERNA002') && !st.text.includes('designerItemNotes'));
}

/* ───── IDENTIDADE do runtime (deploy assert old→new) ───── */
{
  ok('D1  identidade NOVA no fonte: V64.59-c20-failopen-f354wh1-approve-all', SRC.includes('version: "V64.59-c20-failopen-f354wh1-approve-all"'));
  ok('D2  WORKER_BUILD novo: f354wh1-approve-all', SRC.includes('const WORKER_BUILD = "f354wh1-approve-all";'));
  ok('D3  notificação agrupada: UMA chamada notifyWorkflowEvent por lote (if/else exclusivo no branch)', /if \(b\.client === "concluido"\) await notifyWorkflowEvent\(env, task, "final_approved_by_client", \{ token \}\);\s*\n\s*else if \(b\.client === "aprovado"\) await notifyWorkflowEvent\(env, task, "themes_approved_by_client", \{ token \}\);/.test(SRC));
}

console.log('\nF354WH1-APPROVE-ALL-PENDING: PASS=' + pass + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
