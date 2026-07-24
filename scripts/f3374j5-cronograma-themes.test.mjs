#!/usr/bin/env node
/* =====================================================================
   F3.3.74J5 — Portal do cliente: Cronograma em DUAS etapas.
     ETAPA 1 (fase 'themes')  → SOMENTE Tema (+ nº, estado, observação,
                                 controles aprovar/ajuste/editar-tema).
                                 NADA de Legenda / Peças / Feed / Story.
     ETAPA 2 (fase 'production'|'final', após produção/reenvio com o MESMO
              link, cronStatus='ready_for_final_client_review')
                               → Tema + Legenda + Feed + Story + controle final.
   O corte é por FASE (não por presença de dado): registros com Feed/legenda
   LEGADOS em 'themes' continuam mostrando só o Tema (dado nunca é apagado).
   Roteiro permanece Tema+Legenda (fix 74J3), intocado.

   Executa o worker REAL (arquivo inteiro em sandbox; sem rede/deploy/escrita).
   Modos:
     (padrão)                       → GREEN: candidata 74J5 (43 checks)
     EXPECT=red                     → RED: reproduz o print físico (bug pré-patch)
     BASELINE_SRC=<85787d0>         → prova byte-idêntica de ETAPA 2 + roteiro +
                                      handlers (só a ETAPA 1 muda)
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
const TOKEN = 'f3374j5test0000000000000000000000000000000000001';
const PECAS_NFC = 'Peças', PECAS_NFD = 'Peças';
const IMG_ICON = 'rect x="3" y="3" width="18" height="18"';
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
const cards = (h) => (h.match(/data-card="/g) || []).length;

// ---- fixtures -------------------------------------------------------
// ETAPA 1 (themes): SÓ tema. Sem legenda, sem feed/story → clientPhase='themes'.
function themesItems(n) {
  return Array.from({ length: n }, (_, i) => ({ t: 'Tema sintético ' + (i + 1) }));
}
// ETAPA 2 (production/final): tema + legenda + feed + story (completos).
function fullItems(n, withUrls = true) {
  return Array.from({ length: n }, (_, i) => {
    const c = { t: 'Tema sintético ' + (i + 1), legenda: 'Legenda sintética ' + (i + 1) };
    if (withUrls) { c.feedImageUrl = 'https://ik.example/feed-' + i + '.jpg'; c.storyImageUrl = 'https://ik.example/story-' + i + '.jpg'; }
    return c;
  });
}
// themes com DADO LEGADO no registro (legenda + feed antigos) — não deve exibir, nem apagar.
function themesLegacyItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    t: 'Tema sintético ' + (i + 1), legenda: 'Legenda LEGADA ' + (i + 1),
    feedImageUrl: 'https://ik.example/legacy-feed-' + i + '.jpg',
    storyImageUrl: 'https://ik.example/legacy-story-' + i + '.jpg',
  }));
}
function roteiroItems(n) {
  return Array.from({ length: n }, (_, i) => ({ t: 'Roteiro sintético ' + (i + 1), legenda: 'Legenda roteiro ' + (i + 1) }));
}
function approvedItems(n, phase) {
  const m = {}; for (let i = 0; i < n; i++) m['i' + i] = { cs: 'aprovado', phase: phase || 'themes', at: 1 }; return m;
}
function mkTask(sector, weeks, extra = {}) {
  return Object.assign({
    sector, client: 'Cliente QA Sintético',
    title: sector === 'Roteiro' ? 'Roteiro de gravação de vídeos' : 'Cronograma de conteúdo',
    cronStatus: 'in_client_review', cronWeeks: weeks, clientItems: {}, clientActions: {},
  }, extra);
}
const cronThemes = (n, ex) => mkTask('Cronograma', themesItems(n), ex);
const cronProd = (n, ex) => mkTask('Cronograma', fullItems(n), ex);
const cronFinal = (n, ex) => mkTask('Cronograma', fullItems(n), Object.assign({ cronStatus: 'ready_for_final_client_review' }, ex || {}));
const render = (t) => api.renderClientHtml(t, TOKEN, ENV, ORIGIN);

console.log(`F3.3.74J5 — Cronograma ETAPA 1 = só Tema (${EXPECT}) sobre ${path.basename(SRCPATH)}`);

// ============================== RED ==============================
if (EXPECT === 'red') {
  console.log('— modo RED: reproduzir o PRINT FÍSICO antes do patch —');
  const v = strip(render(cronThemes(3)));
  ok('RED etapa1 cronograma mostra "Legenda pendente" (bug físico)', v.includes('Legenda pendente'));
  ok('RED etapa1 cronograma mostra "Peças" (bug físico)', v.includes(PECAS_NFC) || v.includes(PECAS_NFD));
  ok('RED etapa1 cronograma mostra "Feed pendente"', v.includes('Feed pendente'));
  ok('RED etapa1 cronograma mostra "Story pendente"', v.includes('Story pendente'));
  ok('RED etapa1 cronograma mostra media-row/placeholders de imagem', v.includes('media-row') && v.includes('class="ph"'));
  ok('RED etapa1 cronograma oferece "Editar legenda" (indevido)', v.includes('data-act="editLegenda"'));
  ok('RED fase da etapa1 é themes (cabeçalho de temas) — corpo é que diverge',
    api.clientPhase(cronThemes(3)) === 'themes' && v.includes('aprovando apenas os temas'));
  console.log(`\nred: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
}

// ============================== GREEN ==============================
const t1 = render(cronThemes(3));
const v1 = strip(t1);

console.log('— ETAPA 1 (themes): SOMENTE Tema —');
ok('C1 etapa1 contém Tema (rótulo + texto)', v1.includes('Tema</span>') && v1.includes('Tema sintético 1'));
ok('C2 etapa1 NÃO contém rótulo "Legenda"', !v1.includes('Legenda</span>'));
ok('C3 etapa1 NÃO contém "Legenda pendente"', !v1.includes('Legenda pendente'));
ok('C4 etapa1 NÃO contém "Peças" (NFC nem NFD)', !v1.includes(PECAS_NFC) && !v1.includes(PECAS_NFD));
ok('C5 etapa1 NÃO contém "Feed" (markup visível)', !/\bFeed\b/.test(v1));
ok('C6 etapa1 NÃO contém "Story" (markup visível)', !/\bStory\b/.test(v1));
ok('C7 etapa1 NÃO contém "Feed pendente"', !v1.includes('Feed pendente'));
ok('C8 etapa1 NÃO contém "Story pendente"', !v1.includes('Story pendente'));
ok('C9 etapa1 NÃO contém media-row', !v1.includes('media-row'));
ok('C10 etapa1 NÃO contém placeholder/thumb/media/ícone-img',
  !v1.includes('class="ph"') && !v1.includes('class="thumb"') && !v1.includes('class="media') && !v1.includes(IMG_ICON));
ok('C11 etapa1 NÃO contém rastro de anexo (anexado/ampliar/zoom)',
  !v1.includes('anexado') && !v1.includes('ampliar') && !v1.includes('class="zoom"'));
ok('C12 etapa1 NÃO contém input file/upload', !v1.includes('type="file"') && !t1.includes('type="file"'));
ok('C13 etapa1 mantém "Aprovar conteúdo" (approveItem)', v1.includes('data-act="approveItem"') && v1.includes('Aprovar conteúdo'));
ok('C14 etapa1 mantém "Pedir ajuste" (reviseItem)', v1.includes('data-act="reviseItem"') && v1.includes('Pedir ajuste'));
ok('C15 etapa1 mantém "Editar tema" (editTheme)', v1.includes('data-act="editTheme"') && v1.includes('Editar tema'));
ok('C16 etapa1 mantém "Observação" (noteItem)', v1.includes('data-act="noteItem"') && v1.includes('Observação'));
ok('C17 etapa1 NÃO oferece "Editar legenda" (sem legenda nesta etapa)', !v1.includes('data-act="editLegenda"') && !v1.includes('Editar legenda'));
ok('C18 etapa1 cabeçalho é de temas (phase-banner "themes" + sub de temas)', v1.includes('phase-themes') && v1.includes('aprovando apenas os temas'));
ok('C19 etapa1 CTA "Aprovar temas" quando tudo aprovado',
  strip(render(cronThemes(3, { clientItems: approvedItems(3, 'themes') }))).includes('data-act="approveAll"'));
ok('C20 etapa1 nº de conteúdos correto (3 cards)', cards(v1) === 3);

console.log('— ETAPA 2 (production): Tema + Legenda + Feed + Story —');
const p1 = render(cronProd(3)); const vp = strip(p1);
ok('C21 production fase derivada correta', api.clientPhase(cronProd(3)) === 'production');
ok('C22 production contém Legenda (rótulo + texto)', vp.includes('Legenda</span>') && vp.includes('Legenda sintética 1'));
ok('C23 production contém "Peças" + media-row', (vp.includes(PECAS_NFC) || vp.includes(PECAS_NFD)) && vp.includes('media-row'));
ok('C24 production contém Feed/Story anexados (URLs)', vp.includes('anexado') && vp.includes('feed-0.jpg') && vp.includes('story-0.jpg'));
ok('C25 production cabeçalho de legendas/artes (phase-banner + sub)', vp.includes('phase-production') && vp.includes('Confira as legendas e as artes'));
ok('C26 production oferece "Editar legenda"', vp.includes('data-act="editLegenda"'));
ok('C27 production com legenda faltando mostra "Legenda pendente" (placeholder é da ETAPA 2)',
  strip(render(mkTask('Cronograma', (function () { const it = fullItems(3); it[1].legenda = ''; return it; })(), { clientApprovalPhase: 'production' }))).includes('Legenda pendente'));

console.log('— ETAPA 2 (final): reenvio com o MESMO link —');
const f1 = render(cronFinal(3)); const vf = strip(f1);
ok('C28 final: cronStatus=ready_for_final_client_review → fase final', api.clientPhase(cronFinal(3)) === 'final');
ok('C29 final contém Tema + Legenda + Peças', vf.includes('Tema sintético 1') && vf.includes('Legenda sintética 1') && (vf.includes(PECAS_NFC) || vf.includes(PECAS_NFD)));
ok('C30 final cabeçalho "Aprovação final do cronograma" + "Confira legendas, Feed e Story"',
  vf.includes('Aprovação final do cronograma') && vf.includes('Confira legendas, Feed e Story'));
const vfa = strip(render(cronFinal(3, { clientItems: approvedItems(3, 'final') })));
ok('C31 final (tudo aprovado) libera CTA final approveAll data-phase=final ("Aprovar vers…")',
  vfa.includes('data-act="approveAll"') && vfa.includes('data-phase="final"') && vfa.includes('Aprovar vers'));

console.log('— TRANSIÇÃO / máquina de estados —');
ok('C32 cronograma novo (3 temas, sem dado) → themes', api.clientPhase(cronThemes(3)) === 'themes');
ok('C33 produção PARCIAL (legendas só em alguns) permanece themes → cliente vê só temas',
  api.clientPhase(mkTask('Cronograma', (function () { const it = fullItems(3); it[2].legenda = ''; it[2].feedImageUrl = ''; return it; })())) === 'themes');
ok('C34 approveAll carrega data-phase correto (themes vs final)',
  strip(render(cronThemes(3, { clientItems: approvedItems(3, 'themes') }))).includes('data-phase="themes"')
  && strip(render(cronFinal(3, { clientItems: approvedItems(3, 'final') }))).includes('data-phase="final"'));

console.log('— ROTEIRO (fix 74J3 preservado) —');
const r1 = strip(render(mkTask('Roteiro', roteiroItems(4))));
ok('C35 roteiro mantém Tema + Legenda', r1.includes('Tema sintético'.replace('Tema', 'Roteiro')) && r1.includes('Legenda roteiro 1') && r1.includes('Legenda</span>'));
ok('C36 roteiro NÃO mostra Peças/Feed/Story', !r1.includes(PECAS_NFC) && !r1.includes(PECAS_NFD) && !/\bFeed\b/.test(r1) && !/\bStory\b/.test(r1));
ok('C37 roteiro final mantém Tema+Legenda, sem Peças',
  (function () { const h = strip(render(mkTask('Roteiro', roteiroItems(4), { clientApprovalPhase: 'final' }))); return h.includes('Legenda roteiro 1') && !h.includes(PECAS_NFC) && !h.includes(PECAS_NFD); })());

console.log('— COMPATIBILIDADE DE DADOS (corte por FASE, sem migração destrutiva) —');
const legacyTask = cronThemes(3, { clientApprovalPhase: 'themes' });
legacyTask.cronWeeks = themesLegacyItems(3);
Object.freeze(legacyTask); legacyTask.cronWeeks.forEach(Object.freeze);
const snap = JSON.stringify(legacyTask);
const legHtml = strip(render(legacyTask));
ok('C38 themes com legenda/feed LEGADOS no registro → ainda mostra SÓ Tema (corte por fase)',
  legHtml.includes('Tema sintético 1') && !legHtml.includes('Legenda</span>') && !legHtml.includes(PECAS_NFC) && !legHtml.includes(PECAS_NFD)
  && !legHtml.includes('Legenda LEGADA') && !legHtml.includes('legacy-feed') && !legHtml.includes('legacy-story'));
ok('C39 registro legado permanece INTACTO (fixture congelada; objeto inalterado)', JSON.stringify(legacyTask) === snap);
ok('C40 nenhum write/rede na renderização (fetch=0)', calls.fetch === 0);

console.log('— PRESERVAÇÃO (byte-idêntico do que NÃO é etapa1) —');
if (BASEPATH) {
  const base = loadWorker(BASEPATH);
  const bp = base.api.renderClientHtml(cronProd(3), TOKEN, ENV, ORIGIN);
  const bf = base.api.renderClientHtml(cronFinal(3), TOKEN, ENV, ORIGIN);
  const br = base.api.renderClientHtml(mkTask('Roteiro', roteiroItems(4)), TOKEN, ENV, ORIGIN);
  ok('C41 ETAPA 2 (production+final) e ROTEIRO byte-idênticos ao pré-patch (só a etapa1 muda)',
    bp === p1 && bf === f1 && br === render(mkTask('Roteiro', roteiroItems(4))));
  const SAME_FNS = ['handleClientCronogramaView', 'handleClientCronogramaAction', 'writeClientGranular',
    'handleClientCronogramaState', 'handleClientCronogramaCrawler', 'clientPhase', 'phaseCopy', 'clientAckedPhase',
    'renderClientPhaseAckHtml', 'renderClientSuccessHtml', 'premiumTypeOf', 'statusLabel', 'frequencyLabel',
    'ogClientMeta', 'handleShareCard', 'shareCardHtml'];
  // F3.5.0 — delta AUTORIZADO no handleClientCronogramaView: EXATAMENTE as 2 linhas do
  // registro idempotente de primeira visualização (flags duplas; recordClientFirstView).
  // O compare remove o delta BYTE-EXATO (uma única ocorrência) do lado novo; qualquer
  // outra divergência — em view ou em qualquer função pinada — continua REPROVANDO.
  const F350_VIEW_DELTA = '    // F3.5.0 — primeira visualização (WORKER_BUILD f350): idempotente, flags duplas, 1 campo.\n    try { await recordClientFirstView(env, accessToken, task); } catch (_) { }\n';
  const stripF350 = (n, s) => { if (n !== 'handleClientCronogramaView') return s; const i = s.indexOf(F350_VIEW_DELTA); return i < 0 ? s : s.slice(0, i) + s.slice(i + F350_VIEW_DELTA.length); };
  const diffs = SAME_FNS.filter((n) => { try { return fnSrc(base.SRC, n) !== stripF350(n, fnSrc(SRC, n)); } catch (e) { return true; } });
  ok('C42 handlers/estado/ação/OG byte-idênticos (view: módulo delta AUTORIZADO F3.5.0): ' + (diffs.length ? 'DIVERGEM: ' + diffs.join(',') : 'todos iguais'), diffs.length === 0);
  ok('C43 PREMIUM_TYPES const byte-idêntico', constObj(base.SRC, 'PREMIUM_TYPES') === constObj(SRC, 'PREMIUM_TYPES'));
} else {
  ok('C41 (pulado — defina BASELINE_SRC p/ prova byte-idêntica)', false);
  ok('C42 (pulado — defina BASELINE_SRC p/ prova byte-idêntica)', false);
  ok('C43 (pulado — defina BASELINE_SRC p/ prova byte-idêntica)', false);
}

console.log(`\n${EXPECT}: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
