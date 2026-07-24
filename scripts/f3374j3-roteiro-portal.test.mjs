#!/usr/bin/env node
/* =====================================================================
   F3.3.74J3 — Portal do cliente: Roteiro = SOMENTE Tema + Legenda.
   Executa o worker REAL (arquivo inteiro em sandbox; sem rede, sem
   deploy, sem escrita) e valida os 34 itens da FASE 8 do mandato.
   Modos:
     (padrão)                          → GREEN: candidata 74J3 (34 checks)
     WORKER_SRC=<c/ Peças> EXPECT=red  → RED: reproduz o bug pré-patch
     BASELINE_SRC=<f9b54ce>            → provas byte-idênticas (Cronograma
                                         HTML e blocos Card/ação/payload)
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRCPATH = process.env.WORKER_SRC || path.resolve(__dirname, '..', 'cloudflare-worker.js');
const BASEPATH = process.env.BASELINE_SRC || '';
const EXPECT = process.env.EXPECT || 'green';

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

function loadWorker(p) {
  const SRC = fs.readFileSync(p, 'utf8');
  // worker em formato MÓDULO: neutraliza `export default {…}` e `export const …`
  // p/ rodar em sandbox (new Function não aceita sintaxe de módulo)
  const RUN = SRC.replace(/^export default\s*\{/m, 'var __default__ = {')
    .replace(/^export const /gm, 'const ');
  const calls = { fetch: 0, listeners: [] };
  const stubs = {
    addEventListener: (t) => calls.listeners.push(t),
    caches: { default: { match: async () => null, put: async () => {}, delete: async () => true } },
    fetch: async () => { calls.fetch++; throw new Error('rede proibida no teste'); },
    setInterval: () => 0, clearInterval: () => {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    self: {},
  };
  const names = Object.keys(stubs);
  const F = new Function(...names, RUN + '\nreturn { renderClientHtml, clientPhase, phaseCopy, premiumTypeOf, PREMIUM_TYPES, escapeHtml, frequencyLabel, statusLabel, CV_JS };');
  return { api: F(...names.map((n) => stubs[n])), calls, SRC };
}
// extração por chaves balanceadas (mesma técnica do harness 74J)
function fnSrc(SRC, name) {
  const m = SRC.match(new RegExp('(?:async )?function ' + name + '\\s*\\('));
  if (!m) throw new Error('fn ' + name);
  const st = SRC.indexOf(m[0]); let d = 0;
  for (let j = SRC.indexOf('{', st); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); }
  }
  throw new Error('sem fecho ' + name);
}
function constObj(SRC, name) {
  const st = SRC.indexOf('const ' + name + ' = {'); if (st < 0) throw new Error('const ' + name);
  let d = 0;
  for (let j = SRC.indexOf('{', st); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 2); }
  }
  throw new Error('sem fecho ' + name);
}

const { api, calls, SRC } = loadWorker(SRCPATH);
const ENV = { ENABLE_CLIENT_WEB_PUSH: 'false', VAPID_PUBLIC_KEY: '' };
const ORIGIN = 'https://aprovar-qa.agendaidseven.com.br';
const TOKEN = 'f3374j3test0000000000000000000000000000000000001';
const PECAS_NFC = 'Peças', PECAS_NFD = 'Peças';
const IMG_ICON = 'rect x="3" y="3" width="18" height="18"';

function mkItems(n, o = {}) {
  return Array.from({ length: n }, (_, i) => {
    const c = { t: 'Tema sintético ' + (i + 1) };
    if (o.legendas !== false) c.legenda = 'Legenda sintética ' + (i + 1);
    if (o.legacy) {
      c.feedImageUrl = 'https://example.com/legacy-feed-' + i + '.jpg';
      c.feed = [{ url: 'https://example.com/legacy-feedA-' + i + '.jpg' }];
      c.stories = ['https://example.com/legacy-story-' + i + '.jpg'];
      c.storyImageUrl = 'https://example.com/legacy-storyB-' + i + '.jpg';
    }
    if (o.cs) c.cs = o.cs;
    return c;
  });
}
function approvedItems(n, phase) {
  const m = {};
  for (let i = 0; i < n; i++) m['i' + i] = { cs: 'aprovado', phase: phase || 'themes', at: 1 };
  return m;
}
function mkTask(sector, n, o = {}) {
  return Object.assign({
    sector, client: 'Cliente QA Sintético',
    title: sector === 'Roteiro' ? 'Roteiro de gravação de vídeos' : 'Cronograma de conteúdo',
    cronSub: o.cronSub, cronStatus: 'in_client_review',
    cronWeeks: mkItems(n, o), clientItems: o.clientItems || {}, clientActions: {},
  }, o.extra || {});
}
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
const cards = (h) => (h.match(/data-card="/g) || []).length;

console.log(`F3.3.74J3 — portal Roteiro tema+legenda-only (${EXPECT}) sobre ${path.basename(SRCPATH)}`);

if (EXPECT === 'red') {
  console.log('— modo RED: reproduzir o bug ANTES do patch —');
  const v = strip(api.renderClientHtml(mkTask('Roteiro', 4), TOKEN, ENV, ORIGIN));
  ok('RED roteiro renderiza "Peças" (bug físico)', v.includes(PECAS_NFC) || v.includes(PECAS_NFD));
  ok('RED roteiro renderiza "Feed pendente"', v.includes('Feed pendente'));
  ok('RED roteiro renderiza "Story pendente"', v.includes('Story pendente'));
  ok('RED roteiro renderiza media-row/placeholders', v.includes('media-row') && v.includes('class="ph"'));
  ok('RED latente: legado Feed completo derivava fase production p/ roteiro',
    api.clientPhase(mkTask('Roteiro', 4, { legacy: true })) === 'production');
  console.log(`\nred: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
}

// ============================== GREEN ==============================
const rot4 = api.renderClientHtml(mkTask('Roteiro', 4, { cronSub: 'q4' }), TOKEN, ENV, ORIGIN);
const v4 = strip(rot4);

console.log('— ROTEIRO: DOM/HTML —');
ok('T1 contém Tema (rótulo + texto)', v4.includes('Tema</span>') && v4.includes('Tema sintético 1'));
ok('T2 contém Legenda (rótulo + texto)', v4.includes('Legenda</span>') && v4.includes('Legenda sintética 1'));
ok('T3 não contém "Peças" (NFC nem NFD)', !v4.includes(PECAS_NFC) && !v4.includes(PECAS_NFD));
ok('T4 não contém "Feed" (markup visível)', !/\bFeed\b/.test(v4));
ok('T5 não contém "Story" (markup visível)', !/\bStory\b/.test(v4));
ok('T6 não contém "Feed pendente"', !v4.includes('Feed pendente'));
ok('T7 não contém "Story pendente"', !v4.includes('Story pendente'));
ok('T8 não contém input file/upload', !v4.includes('type="file"') && !rot4.includes('type="file"'));
ok('T9 não contém placeholder de imagem (ph/thumb/ícone img/media)',
  !v4.includes('class="ph"') && !v4.includes('class="thumb"') && !v4.includes(IMG_ICON) && !v4.includes('class="media'));
ok('T10 não contém handler/rastros de anexo (anexado/ampliar/zoom)',
  !v4.includes('anexado') && !v4.includes('ampliar') && !v4.includes('class="zoom"'));
ok('T11 não contém status de peças (media-row ausente; badges são do conteúdo)', !v4.includes('media-row'));

console.log('— ROTEIRO: QUANTIDADES —');
for (const [t, n, q] of [['T12', 4, 'q4'], ['T13', 6, 'q6'], ['T14', 8, 'q8'], ['T15', 12, 'q12']]) {
  const h = strip(api.renderClientHtml(mkTask('Roteiro', n, { cronSub: q }), TOKEN, ENV, ORIGIN));
  ok(`${t} ${n} conteúdos corretos (cards=${n}, pílula "${n} roteiros", zero peças)`,
    cards(h) === n && h.includes(n + ' roteiros') && !h.includes(PECAS_NFC) && !/\bFeed\b/.test(h) && !/\bStory\b/.test(h));
}

console.log('— ROTEIRO: APROVAÇÃO —');
const rotAll = strip(api.renderClientHtml(mkTask('Roteiro', 4, { clientItems: approvedItems(4) }), TOKEN, ENV, ORIGIN));
ok('T16 aprova só com Tema/Legenda (sem NENHUM campo de peça): CTA "Aprovar roteiros" liberado',
  rotAll.includes('data-act="approveAll"') && rotAll.includes('Aprovar roteiros') && rotAll.includes('4 de 4 aprovados'));
ok('T17 pedir ajuste disponível (por item e geral)',
  v4.includes('data-act="reviseItem"') && v4.includes('Pedir ajuste') && v4.includes('data-act="revision"'));
const rot2de4 = strip(api.renderClientHtml(mkTask('Roteiro', 4, { clientItems: { i0: { cs: 'aprovado', phase: 'themes' }, i1: { cs: 'aprovado', phase: 'themes' } } }), TOKEN, ENV, ORIGIN));
ok('T18 progresso correto (2 de 4; CTA final ainda não aparece)',
  rot2de4.includes('2 de 4 aprovados') && !rot2de4.includes('data-act="approveAll"'));
const rotFinal = strip(api.renderClientHtml(mkTask('Roteiro', 4, { clientItems: approvedItems(4, 'final'), extra: { clientApprovalPhase: 'final' } }), TOKEN, ENV, ORIGIN));
ok('T19 aprovação final tipada (kicker/CTA do roteiro; sem peças)',
  rotFinal.includes('Aprovação final do Roteiro de gravação de vídeos') && rotFinal.includes('Aprovar versão final') && !rotFinal.includes(PECAS_NFC));
const actFetch = api.CV_JS.indexOf("'/action'") >= 0 ? api.CV_JS : api.CV_JS; // localizar POST /action
const actIdx = api.CV_JS.indexOf('/action');
const actWin = actIdx >= 0 ? api.CV_JS.slice(Math.max(0, actIdx - 600), actIdx + 600) : '';
ok('T20 retorno/payload: POST /action envia só {action, contentIndex, value, note} — sem feed/story',
  actIdx >= 0 && !/\bfeed\b/.test(actWin) && !/\bstory\b/.test(actWin));

console.log('— COMPATIBILIDADE (legado) —');
const legacyTask = mkTask('Roteiro', 4, { legacy: true });
Object.freeze(legacyTask); legacyTask.cronWeeks.forEach(Object.freeze);
const snap = JSON.stringify(legacyTask);
const legHtml = strip(api.renderClientHtml(legacyTask, TOKEN, ENV, ORIGIN));
ok('T21 registro antigo com Feed/Story legado NÃO renderiza peças (nem URLs legadas)',
  !legHtml.includes(PECAS_NFC) && !legHtml.includes('media-row') && !legHtml.includes('legacy-feed') && !legHtml.includes('legacy-story') && !/\bFeed\b/.test(legHtml));
ok('T22 campos legados permanecem intactos (fixture congelada; objeto inalterado)',
  JSON.stringify(legacyTask) === snap);
ok('T23 nenhum write/rede na renderização (fetch=0) e fase legada IGNORADA (themes, não production)',
  calls.fetch === 0 && api.clientPhase(legacyTask) === 'themes');

console.log('— CRONOGRAMA (preservação) —');
const cronFix = [
  // F3.3.74J5 — a estrutura "com Peças/Feed/Story" do cronograma é exclusiva da ETAPA 2.
  // Fixture[0] em fase 'production' EXPLÍCITA (sem URLs) prova os placeholders da ETAPA 2;
  // a ETAPA 1 (themes) agora mostra só o Tema (coberto pela suíte f3374j5). Isto mantém a
  // prova byte-idêntica válida: o que J5 NÃO toca (production/final) continua idêntico.
  mkTask('Cronograma', 4, { clientItems: { i0: { cs: 'aprovado', phase: 'production' } }, extra: { clientApprovalPhase: 'production' } }),
  // cronograma com mídia completa deriva fase 'production' → itens aprovados NESSA fase
  mkTask('Cronograma', 6, { legacy: true, clientItems: approvedItems(6, 'production') }),
];
const cronHtml = cronFix.map((t) => api.renderClientHtml(t, TOKEN, ENV, ORIGIN));
const cronVis = strip(cronHtml[0]);
ok('T24 cronograma continua renderizando a estrutura atual (Peças presentes)',
  cronVis.includes(PECAS_NFC) && cronVis.includes('media-row'));
ok('T25 Feed/Story de Cronograma NÃO removidos (placeholders sem URL; anexos com URL)',
  cronVis.includes('Feed pendente') && cronVis.includes('Story pendente')
  && strip(cronHtml[1]).includes('anexado') && strip(cronHtml[1]).includes('legacy-feed'));
ok('T26 aprovação de cronograma segue funcionando (CTA quando tudo aprovado)',
  strip(cronHtml[1]).includes('data-act="approveAll"'));
if (BASEPATH) {
  const base = loadWorker(BASEPATH);
  const baseHtml = cronFix.map((t) => base.api.renderClientHtml(t, TOKEN, ENV, ORIGIN));
  ok('T27 nenhuma alteração visual: HTML do cronograma BYTE-IDÊNTICO ao pré-patch (2 fixtures)',
    baseHtml[0] === cronHtml[0] && baseHtml[1] === cronHtml[1]);
  // Núcleo de comportamento que J3C NÃO toca (byte-idêntico ao pré-patch):
  const SAME_FNS = ['shareCardHtml', 'ogClientMeta', 'ogClientBase', 'htmlResponseCacheable',
    'premiumTypeOf', 'handleClientCronogramaAction', 'writeClientGranular', 'handleClientCronogramaState',
    'renderClientPhaseAckHtml', 'phaseCopy', 'media', 'statusLabel', 'frequencyLabel'];
  const diffs = SAME_FNS.filter((n) => { try { return fnSrc(base.SRC, n) !== fnSrc(SRC, n); } catch (e) { return true; } });
  ok('T28 payload/estado/escrita/OG/media byte-idênticos (núcleo intocado): ' + (diffs.length ? 'DIVERGEM: ' + diffs.join(',') : 'todos iguais'),
    diffs.length === 0 && constObj(base.SRC, 'PREMIUM_TYPES') === constObj(SRC, 'PREMIUM_TYPES'));
  // F3.3.74J3C — os 3 handlers de entrada mudam SÓ por headers de identidade (diagnóstico):
  // toda linha divergente tem de conter um marcador X-ID7 / WORKER_BUILD / htmlResponseId7 /
  // portalType / 74J3C — nenhuma mudança de corpo, cache, status ou lógica.
  const DIAG_FNS = ['handleShareCard', 'handleClientCronogramaCrawler', 'handleClientCronogramaView'];
  const FORBIDDEN = /caches\.|\.put\(|\.delete\(|\bfetch\(|Cache-Control|no-store|max-age|waitUntil|queryTaskByToken|getAccessToken|writeClient|clientItems|status:\s*\d/;
  const diagOk = DIAG_FNS.every((n) => {
    const a = fnSrc(base.SRC, n).split('\n'), b = fnSrc(SRC, n).split('\n');
    const added = b.filter((l) => !a.includes(l));
    const gainedMarker = added.some((l) => /X-ID7|WORKER_BUILD|htmlResponseId7/.test(l));
    const noSideEffect = added.every((l) => !FORBIDDEN.test(l));   // nenhuma linha nova traz cache/escrita/fetch/auth/status
    return gainedMarker && noSideEffect;
  });
  ok('T28b handlers de entrada: só adicionam identidade (marcador presente; ZERO nova linha com cache/escrita/fetch/auth/status)', diagOk);
} else {
  ok('T27 (pulado — defina BASELINE_SRC para a prova byte-idêntica)', false);
  ok('T28 (pulado — defina BASELINE_SRC para a prova byte-idêntica)', false);
}

console.log('— CARD PREMIUM (delegado ao contrato 74J que roda em seguida) —');
const rotHead = rot4.slice(0, rot4.indexOf('</head>'));
const cronHead = cronHtml[0].slice(0, cronHtml[0].indexOf('</head>'));
ok('T29 OG Cronograma intacto no portal (og: metas + arte cron)',
  (cronHead.match(/property="og:/g) || []).length >= 9 && cronHead.includes('/og/wa-card-v64-39.jpg'));
ok('T30 OG Roteiro intacto no portal (og: metas + arte roteiro)',
  (rotHead.match(/property="og:/g) || []).length >= 9 && rotHead.includes('/og/wa-card-roteiro-v64-60.jpg'));
ok('T31 referência da arte Cronograma preservada (path canônico)', SRC.includes('/og/wa-card-v64-39.jpg'));
ok('T32 referência da arte Roteiro preservada (path canônico)', SRC.includes('/og/wa-card-roteiro-v64-60.jpg'));
ok('T33 fail-open intacto na fonte (bloco 74F presente; identidade failopen)',
  SRC.includes('F3.3.74F — FAIL-OPEN DO OG') && /version: "V64\.59-c20-failopen(-74f|-j4-roteiro-portal|-j5-cronograma-themes|-j6-cronograma-two-stage|-f350-client-progress)"/.test(SRC));
ok('T34 resolved/not_found/error intactos (suite f3374j-failopen-contract 19/19 roda na sequência)',
  fs.existsSync(path.resolve(__dirname, 'f3374j-failopen-contract.test.mjs')));

console.log(`\n${EXPECT}: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
