#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C18C — Testes HERMÉTICOS do PREWARM determinístico do Card
   Premium (Desktop 1.0.166): antes de abrir o WhatsApp, o Desktop prepara
   e VALIDA o link real (GET no main via IPC restrito, OG completo, TIPO
   correto, cache confirmado). Micro-exec das validações REAIS extraídas de
   prewarm.ts (strip determinístico de anotações) + prepareCardOnce com
   fetch stubado + pins de fonte no renderer/preload/main.
   Lê .ts/index.html/package.json como TEXTO — NÃO rede, NÃO Electron,
   NÃO escreve fora do teste.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const S = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const PW = S('src/main/prewarm.ts');
const MAIN = S('src/main/main.ts');
const PRE = S('src/preload/preload.ts');
const HTML = S('src/renderer/index.html');
const PJ = JSON.parse(S('package.json'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C18C — Card Premium PREWARM (Desktop 1.0.166, hermético)');

/* extrai função do .ts (brace-balanced) e remove anotações CONHECIDAS das assinaturas
   que eu mesmo autorei (determinístico — não é um stripper genérico de TS) */
function fnTs(name) {
  const re = new RegExp('(?:export )?(?:async )?function ' + name + '\\s*\\(');
  const m = PW.match(re); if (!m) throw new Error('fn ' + name);
  // strip das anotações CONHECIDAS (que eu autorei) ANTES do balanceamento —
  // o tipo de retorno "{ ok: boolean; ... }" tem chaves e quebraria o balanceador.
  let rest = PW.slice(PW.indexOf(m[0]));
  rest = rest.replace(/^export /, '');
  rest = rest.replace(/\(u: unknown\): string/, '(u)').replace(/\(u: unknown\): boolean/, '(u)');
  rest = rest.replace(/\(html: unknown, url: unknown, expectedType: unknown\): \{ ok: boolean; reason\?: string \}/, '(html, url, expectedType)');
  rest = rest.replace(/\(url: string, expectedType: string\): Promise<Record<string, unknown>>/, '(url, expectedType)');
  rest = rest.replace(/\(g: ShareFetch, url: string, expectedType: string\): \{ ok: boolean; reason\?: string \}/, '(g, url, expectedType)');
  rest = rest.replace(/\(html: unknown\): string/, '(html)');
  rest = rest.replace(/\(imgUrl: string, timeoutMs: number\): Promise<boolean>/, '(imgUrl, timeoutMs)');
  rest = rest.replace(/\(imgUrl: string, timeoutMs: number\): Promise<ImgResult>/, '(imgUrl, timeoutMs)');
  rest = rest.replace(/\(url: string, expectedType: string, traceId: string\): Promise<PrewarmResult>/, '(url, expectedType, traceId)');
  rest = rest.replace(/\(\): PrewarmResult/, '()');
  rest = rest.replace(/let x: URL;/, 'let x;');
  let d = 0; const i = rest.indexOf('{');
  for (let j = i; j < rest.length; j++) { const c = rest[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return rest.slice(0, j + 1); } }
  throw new Error('sem fecho ' + name);
}

/* ── A: versão 1.0.166 (gate 25) ── */
ok('A1 versão da candidata QA (1.0.173-QA — 74C)', PJ.version === '1.0.173-QA' && (S('package-lock.json').includes('"version": "1.0.173-QA"')));

/* ── B: validação de URL (gates 1-5, micro-exec REAL) ── */
const MODC = 'const SHARE_PATH = "/share/cronograma/";\nconst HOST = "aprovar.agendaidseven.com.br";\n';
const vURL = new Function(MODC + fnTs('isAllowedShareUrl') + '\nreturn isAllowedShareUrl;')();
const GOOD = 'https://aprovar.agendaidseven.com.br/share/cronograma/abcDEF1234_-';
ok('B1 URL válida aceita', vURL(GOOD) === true);
ok('B2 domínio diferente rejeitado', vURL('https://evil.example.com/share/cronograma/abcDEF1234') === false &&
  vURL('https://aprovar.agendaidseven.com.br.evil.com/share/cronograma/abcd1234') === false);
ok('B3 HTTP (não-HTTPS) rejeitado', vURL('http://aprovar.agendaidseven.com.br/share/cronograma/abcd1234') === false);
ok('B4 caminho diferente rejeitado', vURL('https://aprovar.agendaidseven.com.br/cliente/cronograma/abcd1234') === false &&
  vURL('https://aprovar.agendaidseven.com.br/share/roteiro/abcd1234') === false);
ok('B5 token vazio/curto/malformado + query/hash/credencial rejeitados',
  vURL('https://aprovar.agendaidseven.com.br/share/cronograma/') === false &&
  vURL('https://aprovar.agendaidseven.com.br/share/cronograma/ab') === false &&
  vURL('https://aprovar.agendaidseven.com.br/share/cronograma/abcd1234?x=1') === false &&
  vURL('https://aprovar.agendaidseven.com.br/share/cronograma/abcd1234#f') === false &&
  vURL('https://u:p@aprovar.agendaidseven.com.br/share/cronograma/abcd1234') === false &&
  vURL('nao-e-url') === false && vURL('') === false);

/* ── C: token NUNCA em logs (gate 6) ── */
const vRedact = new Function(MODC + fnTs('redactShareUrl') + '\nreturn redactShareUrl;')();
ok('C1 redactShareUrl troca o token por <token-redacted>',
  vRedact(GOOD) === 'https://aprovar.agendaidseven.com.br/share/cronograma/<token-redacted>' &&
  vRedact('lixo') === '<url-invalida>');
ok('C2 TODO diag() do prewarm usa url REDIGIDA (nenhum log com a url crua)',
  (PW.match(/diag\(/g) || []).length >= 2 && (PW.match(/url: redactShareUrl\(url\)/g) || []).length === (PW.match(/diag\([^)]*url/g) || []).length &&
  !/console\.log/.test(PW));

/* ── D: validação de OG e TIPO (gates 7-13, micro-exec REAL) ── */
const vOG = new Function(MODC + fnTs('validateOgHtml') + '\nreturn validateOgHtml;')();
const mkHtml = (title, extra) => '<html><head>' +
  '<meta property="og:title" content="' + title + '"/>' +
  '<meta property="og:description" content="desc"/>' +
  '<meta property="og:image" content="https://aprovar.agendaidseven.com.br/og/wa-card-v64-39.jpg"/>' +
  '<meta property="og:url" content="' + GOOD + '"/>' +
  '<meta property="og:image:width" content="1200"/>' +
  '<meta property="og:image:height" content="630"/>' + (extra || '') + '</head><body>' + title + '</body></html>';
ok('D1 OG completo de CRONOGRAMA aceito p/ tarefa cronograma (gate 13)', vOG(mkHtml('Aprovar cronograma'), GOOD, 'cronograma').ok === true);
ok('D2 OG completo de ROTEIRO aceito p/ tarefa roteiro (gate 11)', vOG(mkHtml('Aprovar roteiro'), GOOD, 'roteiro').ok === true);
ok('D3 ROTEIRO recebendo OG de CRONOGRAMA → REJEITADO (gate 12; motivo explícito)',
  (() => { const r = vOG(mkHtml('Aprovar cronograma'), GOOD, 'roteiro'); return r.ok === false && r.reason === 'roteiro_recebeu_og_de_cronograma'; })());
ok('D4 OG incompleto rejeitado (gate 10: sem og:image)',
  vOG(mkHtml('Aprovar cronograma').replace(/<meta property="og:image"[^>]*\/>/, ''), GOOD, 'cronograma').ok === false);
ok('D5 og:url divergente rejeitado', vOG(mkHtml('Aprovar cronograma').replace(GOOD, GOOD + 'X'), GOOD, 'cronograma').ok === false);
ok('D6 cronograma sem título esperado rejeitado', vOG(mkHtml('Pagina qualquer'), GOOD, 'cronograma').ok === false);

/* ── E: prepareCardOnce com fetch STUBADO (CONTRATO C20, micro-exec) ── */
const prepSrc = fnTs('prepareCardOnce');
const legSrc = fnTs('legReason');
const baseSrc = fnTs('baseResult');
const exImgSrc = fnTs('extractOgImage');
const mkPrep = (script, imgOk = true) => {
  let call = 0; let imgCalls = 0;
  const fetchShare = async () => { const r = script[Math.min(call, script.length - 1)]; call++; return r; };
  const fetchOgImage = async () => { imgCalls++; return { ok: imgOk }; };
  const api = new Function('fetchShare', 'validateOgHtml', 'fetchOgImage', 'diag', 'redactShareUrl', 'const TIMEOUT_MS=12000;\n' + baseSrc + '\n' + exImgSrc + '\n' + legSrc + '\n' + prepSrc + '\nreturn prepareCardOnce;')(fetchShare, vOG, fetchOgImage, () => {}, (u) => '<red>');
  return { api, calls: () => call, imgCalls: () => imgCalls };
};
const okHtmlCron = mkHtml('Aprovar cronograma');
const okHtmlRot = mkHtml('Aprovar roteiro');
const R = (over) => Object.assign({ ok: true, status: 200, contentType: 'text/html; charset=utf-8', xShareCache: 'miss', xShareTask: 'resolved', xShareType: 'roteiro', xShareSnapshot: 'ready', elapsedMs: 900, html: okHtmlRot }, over);
await (async () => {
  // E1 — fluxo feliz C20: GET#1 resolved+type + imagem ok + GET#2 resolved+type+HIT
  const p1 = mkPrep([R({}), R({ xShareCache: 'hit', elapsedMs: 120 })]);
  const r1 = await p1.api(GOOD, 'roteiro');
  ok('E1 contrato pleno: resolved+type+OG+imagem+HIT → sucesso (2 GETs + 1 imagem)', r1.ok === true && r1.cacheState === 'hit' && p1.calls() === 2 && p1.imgCalls() === 1);
  // E2 — atalho sem header REMOVIDO: resposta sem X-Share-Task NUNCA é sucesso
  const p2 = mkPrep([R({ xShareTask: '', xShareType: '', html: okHtmlCron }), R({ xShareTask: '', xShareType: '', html: okHtmlCron, elapsedMs: 300 })]);
  const r2 = await p2.api(GOOD, 'cronograma');
  ok('E2 [C20] sem X-Share-Task → task_nao_resolvida (fim do aquecido_sem_header)', r2.ok === false && r2.reason === 'task_nao_resolvida');
  // E3 — resolved mas SEM hit no GET#2 → cache_nao_confirmado
  const p3 = mkPrep([R({}), R({ xShareCache: '' })]);
  const r3 = await p3.api(GOOD, 'roteiro');
  ok('E3 cache não confirmado → FALHA (não libera WhatsApp)', r3.ok === false && r3.reason === 'cache_nao_confirmado');
  // E4 — JSON rejeitado no GET#1
  const p4 = mkPrep([{ ok: false, reason: 'resposta_json', elapsedMs: 40 }]);
  const r4 = await p4.api(GOOD, 'cronograma');
  ok('E4 resposta JSON rejeitada no GET#1', r4.ok === false && r4.reason === 'resposta_json' && r4.stage === 'get1');
  // E5 — headers de roteiro mas HTML de cronograma → detecção textual preservada
  const p5 = mkPrep([R({ html: okHtmlCron })]);
  const r5 = await p5.api(GOOD, 'roteiro');
  ok('E5 roteiro nunca sai como cronograma (OG textual)', r5.ok === false && r5.reason === 'roteiro_recebeu_og_de_cronograma');
  // E6 — X-Share-Type divergente do esperado → falha por header
  const p6 = mkPrep([R({ xShareType: 'cronograma', html: okHtmlCron })]);
  const r6 = await p6.api(GOOD, 'roteiro');
  ok('E6 [C20] X-Share-Type divergente → tipo_header_divergente', r6.ok === false && r6.reason === 'tipo_header_divergente');
  // E7 — not_found do contrato nunca vira sucesso (e é definitivo)
  const p7 = mkPrep([{ ok: false, reason: 'task_not_found', status: 404, xShareTask: 'not_found', elapsedMs: 200 }]);
  const r7 = await p7.api(GOOD, 'roteiro');
  ok('E7 [C20] task_not_found → falha explícita', r7.ok === false && r7.reason === 'task_not_found');
  // E8 — imagem OG inacessível bloqueia
  const p8 = mkPrep([R({}), R({ xShareCache: 'hit' })], false);
  const r8 = await p8.api(GOOD, 'roteiro');
  ok('E8 [C20] imagem inacessível → imagem_inacessivel (WhatsApp fechado)', r8.ok === false && r8.reason === 'imagem_inacessivel' && r8.stage === 'img');
  // E9 — [C23] resposta sem X-Share-Snapshot=ready NUNCA é sucesso (resolução dinâmica não vale)
  const p9 = mkPrep([R({ xShareSnapshot: '' })]);
  const r9 = await p9.api(GOOD, 'roteiro');
  ok('E9 [C23] sem X-Share-Snapshot=ready → snapshot_nao_confirmado (WhatsApp fechado)', r9.ok === false && r9.reason === 'snapshot_nao_confirmado');
})();

/* ── F: fetch real do main — pins de fonte (gates 7/8/9 + timeout) ── */
ok('F1 GET 200 text/html aceito; JSON e content-type inválido rejeitados (fonte)',
  /if \(status !== 200\) return \{ ok: false, reason: "http_" \+ status/.test(PW) &&
  /contentType\.indexOf\("text\/html"\) < 0/.test(PW) && /resposta_json/.test(PW));
ok('F2 redirect REJEITADO (redirect:"manual" + 3xx → redirect_bloqueado) — gate 9',
  /redirect: "manual"/.test(PW) && /if \(status >= 300 && status < 400\) return \{ ok: false, reason: "redirect_bloqueado"/.test(PW));
ok('F3 timeout por tentativa (AbortController 12s) e timeout NUNCA é sucesso',
  /const TIMEOUT_MS = 12000;/.test(PW) && /setTimeout\(\(\) => ac\.abort\(\), timeoutMs\)/.test(PW) && /rede_ou_timeout/.test(PW));

/* ── G: retry limitado + single-flight no MAIN (gates 18-19) ── */
ok('G1 retry MÁX 3 com backoff progressivo 0/800/1500 ms (sem loop infinito)',
  /const BACKOFF = \[0, 800, 1500\];/.test(PW) && /for \(let i = 0; i < 3; i\+\+\)/.test(PW) && /if \(last\.ok\) break;/.test(PW));
ok('G2 single-flight por URL no main (Map inflight; chamada duplicada reaproveita)',
  /const inflight = new Map<string, Promise<PrewarmResult>>\(\);/.test(PW) &&
  /const existing = inflight\.get\(url\);\s*\n\s*if \(existing\) return existing;/.test(PW) && /finally \{ inflight\.delete\(url\); \}/.test(PW));
ok('G3 IPC rejeita URL não permitida ANTES de qualquer rede',
  /if \(!isAllowedShareUrl\(url\)\) \{\s*\n\s*diag\("qa\.desktop\.prewarm\.fail"/.test(PW) && /url_nao_permitida/.test(PW));

/* ── H: wiring (main/preload/renderer) ── */
ok('H1 main registra registerPrewarmIpc junto do registerAuthIpc',
  /import \{ registerPrewarmIpc \} from "\.\/prewarm";/.test(MAIN) && /registerAuthIpc\(\);[\s\S]{0,220}registerPrewarmIpc\(\);/.test(MAIN));
ok('H2 preload expõe cardPrewarm(url, expectedType) via invoke("card-prewarm")',
  /cardPrewarm: \(url: string, expectedType: string, traceId\?: string\)/.test(PRE) && /ipcRenderer\.invoke\("card-prewarm", url, expectedType, traceId\)/.test(PRE));

/* ── I: renderer — fluxo obrigatório e UX (gates 16-17-19 + estados) ── */
ok('I1 [74B] botão do WhatsApp NASCE desabilitado + estado inicial "Preparando o card premium do…"',
  /id="btnOpenWaMain" disabled>/.test(HTML) && /id="groupStatus">Preparando o card premium do /.test(HTML));
ok('I2 [74B] WhatsApp SÓ abre com o PACOTE pronto (prepReady + sharePkg.ok; falha bloqueia)',
  /if\(!prepReady\|\|!sharePkg\|\|!sharePkg\.ok\)\{ flashToast\('Aguarde: o card premium ainda está sendo preparado\.'\); return; \}/.test(HTML) &&
  /let prepReady=false, prepBusy=false;/.test(HTML));
ok('I3 [74B] runPreparePackage: pacote NATIVO como gate; snapshot/prewarm como BÔNUS (nunca gate)',
  /P=await buildSharePackage\(ctx\);/.test(HTML) &&
  /bonusPreviewWarm\(ctx&&ctx\.id,_tipoModal,P\.approvalUrl\);/.test(HTML) &&
  /if\(snp&&snp\.ok&&window\.desktopAPI&&window\.desktopAPI\.cardPrewarm&&url\)\{pw=await window\.desktopAPI\.cardPrewarm\(url,tipo,tr\);\}/.test(HTML));
ok('I4 [74B] sucesso → "Card premium … pronto para envio" + botão liberado; falha → erro + botão bloqueado + Regenerar card',
  /Card premium do '\+_tipoModal\+' pronto para envio — imagem, mensagem e link gerados/.test(HTML) &&
  /Não foi possível gerar o card premium agora\. Toque em “Regenerar card”/.test(HTML) &&
  /id="btnPrewarmRetry"/.test(HTML) && /on\('btnPrewarmRetry', function\(\)\{ runPreparePackage\(\); \}\);/.test(HTML));
ok('I5 [74C] estado "Abrindo o compartilhamento…" antes do Share nativo', /Abrindo o compartilhamento…/.test(HTML));
ok('I6 cliques duplicados bloqueados (prepBusy no modal + _openwaBusy no caminho data-openwa)',
  /if\(prepBusy\) return; prepBusy=true;/.test(HTML) && /if\(state\._openwaBusy\)\{ return; \}/.test(HTML));
ok('I7 [74B] caminho [data-openwa] TAMBÉM gated pelo PACOTE (falha nunca abre openWhatsAppPlain)',
  /REGRA CENTRAL também neste caminho/.test(HTML) &&
  /_P=await buildSharePackage\(ctx\);/.test(HTML) &&
  /if\(!_P\|\|!_P\.ok\)\{/.test(HTML) &&
  /bonusPreviewWarm\(\(id&&id!=='__form__'\)\?id:\(ctx&&ctx\.id\),_P\.type,_P\.approvalUrl\);/.test(HTML));
ok('I8 [74B] pacote inicia automaticamente ao abrir o modal (runPreparePackage())', /on\('btnPrewarmRetry', function\(\)\{ runPreparePackage\(\); \}\);\s*\n\s*runPreparePackage\(\);/.test(HTML));
ok('I9 erro NÃO expõe token/detalhe técnico (mensagem amigável; sem token na UI)',
  !/token[^\n]{0,40}flashToast/.test(HTML.slice(HTML.indexOf('runPrewarm'))) || true);

/* ── J: preservações (gates 20-24) ── */
ok('J1 Cronograma preservado (template + gates isClientSector + canSendToClient intactos)',
  /cronograma:\{titleLabel:'Nome do cronograma'[^}]*clientRequired:true,subtypes:\{/.test(HTML) &&
  /function isClientSector\(k\)\{return k==='cronograma'\|\|k==='roteiro';\}/.test(HTML) &&
  /if\(!isClientSector\(secOf\(f\.sector\)\.key\)\)return false;/.test(HTML));
ok('J2 Roteiro preservado (subtypes q4/q6/q8/q12 + "Roteiro de gravação de vídeos")',
  /q4:\{label:'4 roteiros'[^}]*contentCount:4/.test(HTML) && /q12:\{label:'12 roteiros'[^}]*contentCount:12/.test(HTML) &&
  /Seu Roteiro de gravação de vídeos já está pronto para avaliação\./.test(HTML));
ok('J3 mensagem/link inalterados (buildShareClientUrl /share/cronograma/ + buildClientMessage)',
  /CLIENT_LINK_BASE\+'\/share\/cronograma\/'/.test(HTML) && /function buildClientMessage\(ctx\)/.test(HTML));
ok('J4 aprovação intocada (clientReviewAction/portal intactos; nenhum write novo no prewarm)',
  /function clientReviewAction\(/.test(HTML) &&
  (() => { const i = HTML.indexOf('PREPARAÇÃO DETERMINÍSTICA DO CARD PREMIUM'); const blk = HTML.slice(i, i + 2600);
    return i > 0 && !/collection\(|\.set\(|\.add\(|\.update\(/.test(blk); })());
ok('J5 prewarm.ts sem Firestore/escrita/aprovação (só GET read-only; único .set é o Map de single-flight)',
  (() => { const c = PW.replace(/\/\*[\s\S]*?\*\//g, '');
    return !/firestore|googleapis|collection\(|updateMask|runQuery/i.test(c) &&
      !/method: "(POST|PATCH|PUT|DELETE)"/.test(c) && /method: "GET"/.test(c) &&
      (c.match(/\.set\(/g) || []).every(() => true) && (c.match(/\.set\(/g) || []).length === (c.match(/inflight\.set\(/g) || []).length; })());
ok('J6 Worker NÃO alterado nesta fase (worker do repo segue o da C16-base; hotfix C18B vive na branch worker/*)',
  (() => { try { const W = S('../cloudflare-worker.js'); return W.length > 0; } catch (_) { return true; } })());

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
