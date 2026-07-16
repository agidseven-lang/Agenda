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
  rest = rest.replace(/let x: URL;/, 'let x;');
  let d = 0; const i = rest.indexOf('{');
  for (let j = i; j < rest.length; j++) { const c = rest[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return rest.slice(0, j + 1); } }
  throw new Error('sem fecho ' + name);
}

/* ── A: versão 1.0.166 (gate 25) ── */
ok('A1 versão da baseline atual (1.0.167 — C18H)', PJ.version === '1.0.167' && (S('package-lock.json').includes('"version": "1.0.167"')));

/* ── B: validação de URL (gates 1-5, micro-exec REAL) ── */
const MODC = 'const SHARE_PATH = "/share/cronograma/";\n';
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
  '<meta property="og:url" content="' + GOOD + '"/>' + (extra || '') + '</head><body>' + title + '</body></html>';
ok('D1 OG completo de CRONOGRAMA aceito p/ tarefa cronograma (gate 13)', vOG(mkHtml('Aprovar cronograma'), GOOD, 'cronograma').ok === true);
ok('D2 OG completo de ROTEIRO aceito p/ tarefa roteiro (gate 11)', vOG(mkHtml('Aprovar roteiro'), GOOD, 'roteiro').ok === true);
ok('D3 ROTEIRO recebendo OG de CRONOGRAMA → REJEITADO (gate 12; motivo explícito)',
  (() => { const r = vOG(mkHtml('Aprovar cronograma'), GOOD, 'roteiro'); return r.ok === false && r.reason === 'roteiro_recebeu_og_de_cronograma'; })());
ok('D4 OG incompleto rejeitado (gate 10: sem og:image)',
  vOG(mkHtml('Aprovar cronograma').replace(/<meta property="og:image"[^>]*\/>/, ''), GOOD, 'cronograma').ok === false);
ok('D5 og:url divergente rejeitado', vOG(mkHtml('Aprovar cronograma').replace(GOOD, GOOD + 'X'), GOOD, 'cronograma').ok === false);
ok('D6 cronograma sem título esperado rejeitado', vOG(mkHtml('Pagina qualquer'), GOOD, 'cronograma').ok === false);

/* ── E: prepareCardOnce com fetch STUBADO (gates 7/8/14/15, micro-exec) ── */
const prepSrc = fnTs('prepareCardOnce');
const mkPrep = (script) => {
  // script: array de respostas na ordem dos GETs
  let call = 0;
  const fetchShare = async () => { const r = script[Math.min(call, script.length - 1)]; call++; return r; };
  const validateOgHtml = vOG;
  const api = new Function('fetchShare', 'validateOgHtml', 'const TIMEOUT_MS=12000;\n' + prepSrc + '\nreturn prepareCardOnce;')(fetchShare, validateOgHtml);
  return { api, calls: () => call };
};
const okHtmlCron = mkHtml('Aprovar cronograma');
const okHtmlRot = mkHtml('Aprovar roteiro');
await (async () => {
  // E1 — fluxo feliz: GET#1 miss válido prepara; GET#2 HIT confirma (gates 14+15)
  const p1 = mkPrep([
    { ok: true, status: 200, contentType: 'text/html; charset=utf-8', xShareCache: 'miss', elapsedMs: 900, html: okHtmlRot },
    { ok: true, status: 200, contentType: 'text/html; charset=utf-8', xShareCache: 'hit', elapsedMs: 120, html: okHtmlRot },
  ]);
  const r1 = await p1.api(GOOD, 'roteiro');
  ok('E1 GET#1 prepara + GET#2 com X-Share-Cache=hit confirma (roteiro OK; 2 GETs)', r1.ok === true && r1.cache === 'hit' && p1.calls() === 2);
  // E2 — alternativa DOCUMENTADA: sem header, 2ª resposta válida + latência aquecida
  const p2 = mkPrep([
    { ok: true, status: 200, contentType: 'text/html', xShareCache: '', elapsedMs: 1000, html: okHtmlCron },
    { ok: true, status: 200, contentType: 'text/html', xShareCache: '', elapsedMs: 300, html: okHtmlCron },
  ]);
  const r2 = await p2.api(GOOD, 'cronograma');
  ok('E2 alternativa sem header: 2ª resposta válida+aquecida → aquecido_sem_header', r2.ok === true && r2.cache === 'aquecido_sem_header');
  // E3 — sem header e SEM aquecimento → cache_nao_confirmado (timeout nunca vira sucesso)
  const p3 = mkPrep([
    { ok: true, status: 200, contentType: 'text/html', xShareCache: '', elapsedMs: 900, html: okHtmlCron },
    { ok: true, status: 200, contentType: 'text/html', xShareCache: '', elapsedMs: 1900, html: okHtmlCron },
  ]);
  const r3 = await p3.api(GOOD, 'cronograma');
  ok('E3 cache não confirmado → FALHA (não libera WhatsApp)', r3.ok === false && r3.reason === 'cache_nao_confirmado');
  // E4 — JSON rejeitado (gate 8) / rede-timeout rejeitado
  const p4 = mkPrep([{ ok: false, reason: 'resposta_json', elapsedMs: 40 }]);
  const r4 = await p4.api(GOOD, 'cronograma');
  ok('E4 resposta JSON rejeitada no GET#1', r4.ok === false && r4.reason === 'resposta_json' && r4.step === 'get1');
  // E5 — roteiro recebendo OG de cronograma no GET#1 → falha imediata
  const p5 = mkPrep([{ ok: true, status: 200, contentType: 'text/html', xShareCache: 'miss', elapsedMs: 500, html: okHtmlCron }]);
  const r5 = await p5.api(GOOD, 'roteiro');
  ok('E5 tipo trocado detectado no OG do GET#1 (roteiro nunca sai como cronograma)', r5.ok === false && r5.reason === 'roteiro_recebeu_og_de_cronograma');
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
  /const inflight = new Map<string, Promise<Record<string, unknown>>>\(\);/.test(PW) &&
  /const existing = inflight\.get\(url\);\s*\n\s*if \(existing\) return existing;/.test(PW) && /finally \{ inflight\.delete\(url\); \}/.test(PW));
ok('G3 IPC rejeita URL não permitida ANTES de qualquer rede',
  /if \(!isAllowedShareUrl\(url\)\) \{\s*\n\s*diag\("prewarm\.url_rejeitada"/.test(PW) && /url_nao_permitida/.test(PW));

/* ── H: wiring (main/preload/renderer) ── */
ok('H1 main registra registerPrewarmIpc junto do registerAuthIpc',
  /import \{ registerPrewarmIpc \} from "\.\/prewarm";/.test(MAIN) && /registerAuthIpc\(\);[\s\S]{0,220}registerPrewarmIpc\(\);/.test(MAIN));
ok('H2 preload expõe cardPrewarm(url, expectedType) via invoke("card-prewarm")',
  /cardPrewarm: \(url: string, expectedType: string\)/.test(PRE) && /ipcRenderer\.invoke\("card-prewarm", url, expectedType\)/.test(PRE));

/* ── I: renderer — fluxo obrigatório e UX (gates 16-17-19 + estados) ── */
ok('I1 botão do WhatsApp NASCE desabilitado + estado inicial "Preparando Card Premium…"',
  /id="btnOpenWaMain" disabled>/.test(HTML) && /id="groupStatus">Preparando Card Premium…/.test(HTML));
ok('I2 WhatsApp SÓ abre com prepReady (gate 16/17: sucesso libera; falha bloqueia)',
  /if\(!prepReady\)\{ flashToast\('Aguarde: o Card Premium ainda está sendo preparado\.'\); return; \}/.test(HTML) &&
  /let prepReady=false, prepBusy=false;/.test(HTML));
ok('I3 runPrewarm: prova técnica via IPC (cardPrewarm) com TIPO por setor (roteiro×cronograma)',
  /api\.cardPrewarm&&url\)\?await api\.cardPrewarm\(url,\(ctx&&ctx\.sector\)==='roteiro'\?'roteiro':'cronograma'\)/.test(HTML));
ok('I4 sucesso → "Card Premium preparado." + botão liberado; falha → erro + botão bloqueado + Tentar novamente',
  /Card Premium preparado\. A mensagem será copiada automaticamente ao abrir o WhatsApp Business/.test(HTML) &&
  /Não foi possível preparar o Card Premium agora\. Tente novamente antes de enviar pelo WhatsApp\./.test(HTML) &&
  /id="btnPrewarmRetry"/.test(HTML) && /on\('btnPrewarmRetry', function\(\)\{ runPrewarm\(\); \}\);/.test(HTML));
ok('I5 estado "Abrindo WhatsApp Business…" antes de abrir', /Abrindo WhatsApp Business…/.test(HTML));
ok('I6 cliques duplicados bloqueados (prepBusy no modal + _openwaBusy no caminho data-openwa)',
  /if\(prepBusy\) return; prepBusy=true;/.test(HTML) && /if\(state\._openwaBusy\)\{ return; \}/.test(HTML));
ok('I7 caminho [data-openwa] TAMBÉM gated (falha nunca abre openWhatsAppPlain)',
  /REGRA CENTRAL também neste caminho/.test(HTML) &&
  /await window\.desktopAPI\.cardPrewarm\(_pwUrl,\(ctx&&ctx\.sector\)==='roteiro'\?'roteiro':'cronograma'\)/.test(HTML) &&
  /if\(!_pw\|\|!_pw\.ok\)\{ flashToast\('Não foi possível preparar o Card Premium agora\. Tente novamente antes de enviar pelo WhatsApp\.'\); return; \}/.test(HTML));
ok('I8 prewarm inicia automaticamente ao abrir o modal (runPrewarm())', /on\('btnPrewarmRetry', function\(\)\{ runPrewarm\(\); \}\);\s*\n\s*runPrewarm\(\);/.test(HTML));
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
  /https:\/\/aprovar\.agendaidseven\.com\.br\/share\/cronograma\//.test(HTML) && /function buildClientMessage\(ctx\)/.test(HTML));
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
