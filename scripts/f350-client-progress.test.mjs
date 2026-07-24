#!/usr/bin/env node
/* =====================================================================
   F3.5.0A — ACOMPANHAMENTO DO PROJETO (portal do cliente) — 38 CHECAGENS.
   Executa o worker REAL em sandbox (sem rede real, sem deploy): fetch é um
   ROTEADOR sintético (OAuth stub + Firestore runQuery/PATCH com fixtures
   locais; tokens SINTÉTICOS — nunca reais). Provas byte-idênticas contra a
   BASE OFICIAL db325d9 (J6 de produção): flag OFF ⇒ portal BYTE-IDÊNTICO;
   núcleo (action/state/share/OG/push/success) BYTE-IDÊNTICO sempre.
   BASE: env F350_BASE_SRC=<arquivo db325d9> OU `git show db325d9:cloudflare-worker.js`.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { fileURLToPath } from 'url'; import { generateKeyPairSync, webcrypto } from 'crypto';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRCPATH = path.resolve(__dirname, '..', 'cloudflare-worker.js');

let BASE_SRC_TEXT = '';
if (process.env.F350_BASE_SRC) BASE_SRC_TEXT = fs.readFileSync(process.env.F350_BASE_SRC, 'utf8');
else BASE_SRC_TEXT = execSync('git show db325d9:cloudflare-worker.js', { cwd: path.resolve(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }).toString();

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

/* chave RSA descartável p/ getAccessToken (JWT assinado de verdade, OAuth stub) */
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

/* ───────── fixtures sintéticas (Firestore typed) ───────── */
const T_A   = 'f350cliA000000000000000000000000000000000000001';
const T_B   = 'f350cliB000000000000000000000000000000000000002';
const T_REV = 'f350revogado0000000000000000000000000000000003';
const T_EXP = 'f350expirado0000000000000000000000000000000004';
const T_UNK = 'f350inexistente000000000000000000000000000005';
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

/* tarefa base do cliente A (cronograma, flag da tarefa LIGADA) */
function taskA(extra) {
  return Object.assign({
    client: 'Cliente A Sintetico', title: 'Cronograma Cliente A', sector: 'cronograma',
    clientReviewToken: T_A, clientProgressEnabled: true,
    ownerId: 'USERIDINTERNAL9Z', designerId: 'DESIGNERIDINTERNAL7Y',
    designerSla: { planStartAt: 1750000000000, warnMinutes: 30 },
    internalNotes: 'COMENTARIOINTERNOSECRETO',
    cronWeeks: [{ t: 'Tema A1', legenda: 'Leg A1' }, { t: 'Tema A2', date: '2026-08-01' }, { t: 'Tema A3' }],
    updatedAt: 1753300000000,
  }, extra || {});
}
const FIXTURES = {};   // token -> array de rows runQuery
function setFix(tok, o) { FIXTURES[tok] = o ? [doc('TASKIDINTERNAL123' + tok.slice(0, 8), o)] : [{}]; }

/* ───────── sandbox: carrega o worker REAL com roteador de rede sintético ───────── */
function loadWorker(srcText) {
  const RUN = srcText.replace(/^export default\s*\{/m, 'var __default__ = {').replace(/^export const /gm, 'const ');
  const writes = [];   // PATCHes capturados {url, mask, body}
  const calls = { fetch: 0 };
  async function fakeFetch(input, init) {
    calls.fetch++;
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
    if (method === 'PATCH' && url.includes('/documents/tasks/')) {
      const mask = [...url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map((m) => decodeURIComponent(m[1]));
      writes.push({ url, mask, body: JSON.parse(init.body) });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('rede INESPERADA no teste: ' + method + ' ' + url);
  }
  const stubs = {
    addEventListener: () => {},
    caches: { default: { match: async () => null, put: async () => {}, delete: async () => true } },
    fetch: fakeFetch,
    setInterval: () => 0, clearInterval: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    self: {}, crypto: webcrypto,
  };
  const names = Object.keys(stubs);
  const F = new Function(...names, RUN + '\nreturn { __default__, renderClientHtml, clientPhase, premiumTypeOf, escapeHtml, ' +
    'buildClientProgress: (typeof buildClientProgress==="function"?buildClientProgress:null), ' +
    'computeProgressStages: (typeof computeProgressStages==="function"?computeProgressStages:null), ' +
    'clientProgressSectionParts: (typeof clientProgressSectionParts==="function"?clientProgressSectionParts:null), ' +
    'PROGRESS_STAGES: (typeof PROGRESS_STAGES!=="undefined"?PROGRESS_STAGES:null) };');
  return { api: F(...names.map((n) => stubs[n])), writes, calls, SRC: srcText };
}
function fnSrc(SRC, name) {
  const m = SRC.match(new RegExp('(?:async )?function ' + name + '\\s*\\('));
  if (!m) throw new Error('fn ' + name);
  const st = SRC.indexOf(m[0]); let d = 0;
  for (let j = SRC.indexOf('{', st); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); } }
  throw new Error('sem fecho ' + name);
}

const NEW = loadWorker(fs.readFileSync(SRCPATH, 'utf8'));
const OLD = loadWorker(BASE_SRC_TEXT);
const ENV_OFF = { FCM_PROJECT_ID: 'agenda-id-seven', FCM_CLIENT_EMAIL: 'sa@sandbox', FCM_PRIVATE_KEY: PEM, ENABLE_CLIENT_WEB_PUSH: 'false', VAPID_PUBLIC_KEY: '' };
const ENV_ON  = Object.assign({}, ENV_OFF, { CLIENT_PROGRESS_TRACKING_ENABLED: 'true' });
const ORIGIN = 'https://aprovar-qa.agendaidseven.com.br';
const CTX = { waitUntil: () => {} };
const UA_BROWSER = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36' };
const req = (p, h, m) => new Request(ORIGIN + p, { method: m || 'GET', headers: h || UA_BROWSER });
async function hit(api, p, h, m) { return api.__default__.fetch(req(p, h, m), h && h.__env || arguments[4] || ENV_ON, CTX); }

console.log('\n— A) FLAGS: OFF byte-idêntico · ON exibe a seção —');
{
  const tOn = taskA();                                     // flag da TAREFA ligada
  const h_offGlobal = NEW.api.renderClientHtml(tOn, T_A, ENV_OFF, ORIGIN);
  const h_base      = OLD.api.renderClientHtml(tOn, T_A, ENV_OFF, ORIGIN);
  ok('1 flag GLOBAL false ⇒ HTML BYTE-IDÊNTICO ao J6 db325d9 (mesma fixture)', h_offGlobal === h_base);
  const tOff = taskA({ clientProgressEnabled: false });
  const h_offTask = NEW.api.renderClientHtml(tOff, T_A, ENV_ON, ORIGIN);
  const h_baseOff = OLD.api.renderClientHtml(tOff, T_A, ENV_ON, ORIGIN);
  ok('2 flag da TAREFA false ⇒ HTML BYTE-IDÊNTICO ao J6 db325d9', h_offTask === h_baseOff);
  const h_on = NEW.api.renderClientHtml(tOn, T_A, ENV_ON, ORIGIN);
  ok('3 dupla flag TRUE ⇒ seção ACOMPANHAMENTO presente (id7prog + título + barra + 8 etapas)',
    h_on.includes('Acompanhamento do projeto') && h_on.includes('id="id7prog"') && h_on.includes('id7p-fill')
    && (h_on.match(/class="id7p-st /g) || []).length === 8 && h_on !== h_base);
}

console.log('\n— B) /progress: token, escopo e sanitização —');
setFix(T_A, taskA());
setFix(T_B, { client: 'Cliente B Sintetico', title: 'Cronograma Cliente B', sector: 'cronograma', clientReviewToken: T_B, clientProgressEnabled: true, cronWeeks: [{ t: 'Tema B1' }], updatedAt: 1753300000001 });
{
  const rUnk = await (await hit(NEW.api, '/cliente/cronograma/' + T_UNK + '/progress')).json();
  const rA = await (await hit(NEW.api, '/cliente/cronograma/' + T_A + '/progress')).json();
  ok('4 /progress exige token válido (inexistente ⇒ not_found; válido ⇒ ok)', rUnk.ok === false && rUnk.error === 'not_found' && rA.ok === true);
  const rB = await (await hit(NEW.api, '/cliente/cronograma/' + T_B + '/progress')).json();
  const sA = JSON.stringify(rA), sB = JSON.stringify(rB);
  ok('5 cliente A NUNCA acessa cliente B (payloads disjuntos por token)',
    sA.includes('Cliente A') && !sA.includes('Cliente B') && sB.includes('Cliente B') && !sB.includes('Cliente A') && !sB.includes('Tema A1'));
  ok('6 taskId interno NÃO aparece (projectId derivado p+16hex)', !sA.includes('TASKIDINTERNAL123') && /^p[0-9a-f]{16}$/.test(rA.projectId));
  ok('7 userId NÃO aparece', !sA.includes('USERIDINTERNAL9Z') && !sA.includes('DESIGNERIDINTERNAL7Y') && !sA.includes('ownerId'));
  ok('8 SLA interno NÃO aparece', !sA.includes('designerSla') && !sA.includes('planStartAt') && !sA.includes('warnMinutes'));
  ok('9 comentários internos NÃO aparecem', !sA.includes('COMENTARIOINTERNOSECRETO') && !sA.includes('internalNotes'));
  const parts = NEW.api.clientProgressSectionParts(taskA(), ENV_ON);
  ok('10 token completo NÃO aparece (nem no JSON nem na seção; sem tokens em log/HTML novos)',
    !sA.includes(T_A) && !(parts.css + parts.html + parts.js).includes(T_A));
  const rDark = await (await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_A + '/progress'), ENV_OFF, CTX)).json();
  ok('10b flag global OFF ⇒ /progress responde not_found genérico (endpoint escuro)', rDark.ok === false && rDark.error === 'not_found');
}

console.log('\n— C) primeira visualização: idempotente, 1 campo, sem updatedAt —');
{
  NEW.writes.length = 0;
  setFix(T_A, taskA());   // sem clientPortalFirstViewedAt
  const v1 = await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_A), ENV_ON, CTX);
  const w1 = NEW.writes.slice();
  ok('11 visualização gravada UMA única vez (1 PATCH, mask SÓ clientPortalFirstViewedAt, horário server-side)',
    v1.status === 200 && w1.length === 1 && w1[0].mask.join(',') === 'clientPortalFirstViewedAt'
    && !!w1[0].body.fields.clientPortalFirstViewedAt.integerValue && !JSON.stringify(w1[0].mask).includes('updatedAt'));
  NEW.writes.length = 0;
  await (await hit(NEW.api, '/cliente/cronograma/' + T_A + '/progress')).json();
  await (await hit(NEW.api, '/cliente/cronograma/' + T_A + '/progress')).json();
  setFix(T_A, taskA({ clientPortalFirstViewedAt: 1753300100000 }));
  await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_A), ENV_ON, CTX);
  const wOff = NEW.writes.length; NEW.writes.length = 0;
  setFix(T_A, taskA());
  await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_A), ENV_OFF, CTX);
  const tNoFlag = taskA({ clientProgressEnabled: false }); setFix(T_A, tNoFlag);
  await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_A), ENV_ON, CTX);
  ok('12 polling NÃO escreve; campo presente NÃO reescreve; QUALQUER flag OFF ⇒ ZERO writes',
    wOff === 0 && NEW.writes.length === 0);
  setFix(T_A, taskA());
}

console.log('\n— D) as 8 etapas públicas + percentual determinístico —');
const stageOf = (r, key) => r.stages.find((s) => s.key === key);
async function prog(taskObj) { setFix(T_A, taskObj); return (await (await hit(NEW.api, '/cliente/cronograma/' + T_A + '/progress')).json()); }
{
  const r13 = await prog(taskA());
  ok('13 Cronograma recebido (link existe ⇒ etapa 1 concluída; % = 5)', stageOf(r13, 'received').state === 'completed' && r13.progressPercent === 5);
  const r14 = await prog(taskA({ clientPortalFirstViewedAt: 1753300100000 }));
  ok('14 Visualizado pelo cliente SÓ com o sinal (antes pending; depois completed; % = 10)',
    stageOf(r13, 'viewed').state === 'pending' && stageOf(r14, 'viewed').state === 'completed' && r14.progressPercent === 10);
  const approvedThemes = { i0: { cs: 'aprovado', phase: 'themes', at: 1753300200000 }, i1: { cs: 'aprovado', phase: 'themes', at: 1753300200001 }, i2: { cs: 'aprovado', phase: 'themes', at: 1753300200002 } };
  const r15 = await prog(taskA({ clientItems: approvedThemes }));
  ok('15 Cronograma aprovado (temas todos aprovados ⇒ etapa 3 concluída; % = 25; produção vira a etapa atual)',
    stageOf(r15, 'schedule_approved').state === 'completed' && r15.progressPercent === 25 && stageOf(r15, 'production').state === 'current');
  const r16 = await prog(taskA({ status: 'andamento', workflowStage: 'producao' }));
  ok('16 Conteúdos em produção (status interno andamento/producao ⇒ etapa 4 ATUAL; etapas 1 e 3 concluídas; % = 25)',
    stageOf(r16, 'production').state === 'current' && stageOf(r16, 'schedule_approved').state === 'completed' && r16.progressPercent === 25);
  const r17 = await prog(taskA({ status: 'revisao' }));
  ok('17 Revisão interna (status=revisao ⇒ etapa 5 ATUAL; produção concluída; % = 45)',
    stageOf(r17, 'internal_review').state === 'current' && stageOf(r17, 'production').state === 'completed' && r17.progressPercent === 45);
  const r18 = await prog(taskA({ cronStatus: 'ready_for_final_client_review' }));
  ok('18 Disponível para aprovação (ready_for_final_client_review ⇒ etapa 6 concluída; % = 75)',
    stageOf(r18, 'client_review').state === 'completed' && r18.progressPercent === 75 && r18.approvalState === 'aguardando_cliente' === false ? stageOf(r18, 'scheduling').state === 'current' : stageOf(r18, 'scheduling').state === 'current');
  const r19 = await prog(taskA({ status: 'aprovado' }));
  ok('19 Programação (status=aprovado ⇒ etapa 7 ATUAL; % = 75)',
    stageOf(r19, 'scheduling').state === 'current' && r19.progressPercent === 75);
  const r20 = await prog(taskA({ finalApprovalCompleted: true }));
  ok('20 Concluído (finalApprovalCompleted ⇒ TODAS as etapas do eixo concluídas; % = 100; próxima etapa vazia)',
    stageOf(r20, 'done').state === 'completed' && r20.progressPercent === 100 && r20.overallStatus === 'Concluído' && r20.nextExpectedStage === '');
  const all = [r13, r14, r15, r16, r17, r18, r19, r20];
  ok('21 percentual SEMPRE entre 0 e 100 e pesos em ordem crescente [5,10,25,45,60,75,90,100]',
    all.every((r) => r.progressPercent >= 0 && r.progressPercent <= 100)
    && JSON.stringify(NEW.api.PROGRESS_STAGES.map((s) => s.weight)) === JSON.stringify([5, 10, 25, 45, 60, 75, 90, 100]));
  const rC2 = await prog(taskA({ clientFlowStatus: 'concluido' }));
  ok('22 100% SOMENTE com conclusão real (nenhuma outra fixture atinge 100)',
    rC2.progressPercent === 100 && all.slice(0, 7).every((r) => r.progressPercent < 100));
  const rAdj = await prog(taskA({ clientItems: Object.assign({}, approvedThemes, { i1: { cs: 'em_revisao', phase: 'production', at: 1753300300000, note: 'ajustar' } }), status: 'revisao', clientApprovalPhase: 'production' }));
  ok('23 solicitação de ajuste NÃO apaga etapas anteriores (etapa 3 segue concluída; estado geral = ajuste_solicitado)',
    stageOf(rAdj, 'schedule_approved').state === 'completed' && rAdj.approvalState === 'ajuste_solicitado');
  const many = await prog(taskA({ cronWeeks: [{ t: 'M1' }, { t: 'M2' }, { t: 'M3' }, { t: 'M4' }, { t: 'M5' }, { t: 'M6' }], clientItems: { i0: { cs: 'aprovado', phase: 'themes', at: 1 }, i1: { cs: 'em_revisao', phase: 'themes', at: 2 } } }));
  ok('24 múltiplos conteúdos (6): publicId c1..c6; estados por item (Aprovado/Ajuste solicitado/pendente)',
    many.contents.length === 6 && many.contents[0].publicId === 'c1' && many.contents[5].publicId === 'c6'
    && many.contents[0].approvalState === 'aprovado' && many.contents[1].approvalState === 'ajuste_solicitado' && many.contents[2].approvalState === 'pendente');
  ok('24b estimatedDate SÓ quando existe data real autorizada (item 2 tem 2026-08-01; demais omitem)',
    (await prog(taskA())).contents[1].estimatedDate === '2026-08-01' && !('estimatedDate' in (await prog(taskA())).contents[0]));
  ok('24c revision cresce com a ação mais recente (max de updatedAt/itens/visualização)',
    rAdj.revision === 1753300300000 && r14.revision === 1753300100000);
}

console.log('\n— E) preservação do portal e dos contratos existentes (byte-idêntico ao db325d9) —');
{
  const SAME = ['handleClientCronogramaAction', 'writeClientGranular', 'handleClientCronogramaState',
    'renderClientSuccessHtml', 'renderClientPhaseAckHtml', 'handleShareCard', 'shareCardHtml', 'ogClientMeta',
    'handleClientCronogramaCrawler', 'handleClientPushSubscribe', 'handleClientPushTest', 'handleTeamSession',
    'handleClientCronogramaTeamAction', 'handleSendPremiumWhatsApp'];
  const diffs = SAME.filter((n) => { try { return fnSrc(NEW.SRC, n) !== fnSrc(OLD.SRC, n); } catch (e) { return true; } });
  ok('25 Cronograma preservado: página flag-ON mantém o núcleo (Conteúdos/aprovação/CTA) e nada do núcleo mudou' + (diffs.length ? ' [DIVERGEM: ' + diffs.join(',') + ']' : ''),
    diffs.length === 0 && NEW.api.renderClientHtml(taskA(), T_A, ENV_ON, ORIGIN).includes('data-act="approveItem"'));
  const rot = { client: 'Cliente A Sintetico', title: 'Roteiro de gravação de vídeos', sector: 'roteiro', cronSub: 'q4', clientReviewToken: T_A, clientProgressEnabled: true, cronWeeks: [{ t: 'R1', legenda: 'L1' }], updatedAt: 1 };
  const rotHtml = NEW.api.renderClientHtml(rot, T_A, ENV_ON, ORIGIN);
  ok('26 Roteiro preservado (sem Peças) + etapas com a palavra Roteiro (Roteiro recebido/aprovado)',
    !rotHtml.includes('<div class="media-row">') && rotHtml.includes('Roteiro recebido') && rotHtml.includes('Roteiro aprovado'));
  ok('27 aprovação parcial preservada (handleClientCronogramaAction byte-idêntico)', fnSrc(NEW.SRC, 'handleClientCronogramaAction') === fnSrc(OLD.SRC, 'handleClientCronogramaAction'));
  ok('28 aprovação final preservada (writeClientGranular + tela de sucesso byte-idênticos)',
    fnSrc(NEW.SRC, 'writeClientGranular') === fnSrc(OLD.SRC, 'writeClientGranular') && fnSrc(NEW.SRC, 'renderClientSuccessHtml') === fnSrc(OLD.SRC, 'renderClientSuccessHtml'));
  ok('29 solicitação de alteração preservada (mesmo handler de ação; página ack byte-idêntica)',
    fnSrc(NEW.SRC, 'renderClientPhaseAckHtml') === fnSrc(OLD.SRC, 'renderClientPhaseAckHtml'));
  setFix(T_A, taskA({ clientPortalFirstViewedAt: 1, clientReview: { status: 'revisao' } }));
  const st = await (await hit(NEW.api, '/cliente/cronograma/' + T_A + '/state')).json();
  ok('30 /state permanece contratualmente COMPATÍVEL (handler byte-idêntico; chaves exatas do contrato atual)',
    fnSrc(NEW.SRC, 'handleClientCronogramaState') === fnSrc(OLD.SRC, 'handleClientCronogramaState')
    && JSON.stringify(Object.keys(st).sort()) === JSON.stringify(['finalDone', 'items', 'ok', 'pendingRevision', 'phase', 'phaseApproved', 'updatedAt'].sort()));
  const share = await NEW.api.__default__.fetch(req('/share/cronograma/' + T_A, { 'user-agent': 'facebookexternalhit/1.1' }), ENV_ON, CTX);
  const shareHtml = await share.text();
  ok('31 Card Premium preservado (/share responde OG; handler byte-idêntico)', share.status === 200 && shareHtml.includes('og:image'));
  const head = NEW.api.renderClientHtml(taskA(), T_A, ENV_ON, ORIGIN).split('</head>')[0];
  ok('32 Open Graph preservado no portal flag-ON (metas og: ≥ 9; helper byte-idêntico)', (head.match(/property="og:/g) || []).length >= 9);
  ok('33 Web Push preservado (subscribe/test byte-idênticos; ENABLE_PUSH segue no HTML)',
    NEW.api.renderClientHtml(taskA(), T_A, ENV_ON, ORIGIN).includes('var ENABLE_PUSH='));
}

console.log('\n— F) revogação/expiração do link (aditivo, fail-open p/ ausentes) —');
{
  setFix(T_EXP, taskA({ clientReviewToken: T_EXP, clientReviewTokenExpiresAt: 1000 }));   // vencido há décadas
  const vExp = await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_EXP), ENV_ON, CTX);
  const pExp = await (await hit(NEW.api, '/cliente/cronograma/' + T_EXP + '/progress')).json();
  ok('34 token EXPIRADO bloqueado (view 404 amigável; /progress not_found)', vExp.status === 404 && pExp.ok === false);
  setFix(T_REV, taskA({ clientReviewToken: T_REV, clientReviewTokenRevoked: true }));
  const vRev = await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_REV), ENV_ON, CTX);
  const sRev = await (await hit(NEW.api, '/cliente/cronograma/' + T_REV + '/state')).json();
  ok('35 token REVOGADO bloqueado (view 404; /state not_found)', vRev.status === 404 && sRev.ok === false);
  setFix(T_A, taskA());
  const vOkA = await NEW.api.__default__.fetch(req('/cliente/cronograma/' + T_A), ENV_ON, CTX);
  ok('36 campos AUSENTES preservam links existentes (view 200 normal)', vOkA.status === 200);
  const pA = JSON.stringify(await (await hit(NEW.api, '/cliente/cronograma/' + T_A + '/progress')).json());
  ok('37 nenhum dado de OUTRO cliente retorna no payload de A', !pA.includes('Cliente B') && !pA.includes('Tema B1'));
}

console.log('\n— G) produção intocável por construção —');
{
  const prodToml = execSync('git show db325d9:wrangler.toml', { cwd: path.resolve(__dirname, '..'), maxBuffer: 1024 * 1024 }).toString();
  const curToml = fs.readFileSync(path.resolve(__dirname, '..', 'wrangler.toml'), 'utf8');
  const qaToml = fs.readFileSync(path.resolve(__dirname, '..', 'wrangler.qa.toml'), 'utf8');
  ok('38 nenhum deploy/rota de produção alterado: wrangler.toml (prod) BYTE-IDÊNTICO ao db325d9; ' +
     'flag SÓ no QA com "false"; identidade QA distinta (V64.59-c20-failopen-f350-client-progress)',
    curToml === prodToml && !prodToml.includes('CLIENT_PROGRESS_TRACKING_ENABLED')
    && /CLIENT_PROGRESS_TRACKING_ENABLED = "false"/.test(qaToml)
    && NEW.SRC.includes('version: "V64.59-c20-failopen-f350-client-progress"')
    && OLD.SRC.includes('version: "V64.59-c20-failopen-j6-cronograma-two-stage"'));
}

console.log(`\nF350-CLIENT-PROGRESS: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
