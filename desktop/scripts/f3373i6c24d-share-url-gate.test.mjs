#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C24D — GATE DE URL do compartilhamento (Desktop QA) — RED→GREEN.
   INCIDENTE: a 1.0.170-QA carrega a prévia, mas ao clicar exibe
   "Link inválido — gere o cronograma novamente." e trava os 3 botões.
   CAUSA (a comprovar por micro-exec do CÓDIGO REAL do renderer): o segundo
   validador `_gateValidLink` fixa o host de PRODUÇÃO (aprovar.agendaidseven.com.br)
   e REJEITA workers.dev — logo rejeita o host de QA que o próprio build usa.
   Este teste percorre o caminho REAL que alimenta o modal: constrói a shareUrl
   com o MESMO `CLIENT_LINK_BASE` e `buildShareClientUrl` do build, monta a
   mensagem com `buildClientMessage`, e chama o gate REAL — para Cronograma e
   Roteiro. Modo RED (GM_EXPECT=red) exige a falha; modo GREEN exige a correção.
   READ-ONLY sobre o renderer (lê como TEXTO; nada de rede/deploy).
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const RED = process.env.GM_EXPECT === 'red';

let pass = 0, fail = 0;
function gate(name, cond, redTarget = false) {
  const okNow = !!cond;
  const expected = RED && redTarget ? false : true;
  const verdict = okNow === expected ? 'PASS' : 'FAIL';
  if (verdict === 'PASS') pass++; else fail++;
  console.log(`  ${verdict} — ${name}${RED && redTarget ? (okNow ? ' (esperava RED!)' : ' [RED-CONFIRMADO]') : ''}`);
}

/* extrai um trecho balanceado por chaves a partir de "function <name>(" (renderer JS) */
function fnSrc(name) {
  const re = new RegExp('function ' + name + '\\s*\\(');
  const m = HTML.match(re); if (!m) throw new Error('não achei function ' + name);
  let st = HTML.indexOf(m[0]), i = HTML.indexOf('{', st), d = 0;
  for (let j = i; j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(st, j + 1); } }
  throw new Error('sem fecho ' + name);
}
function constLine(name) { const m = HTML.match(new RegExp("const " + name + "\\s*=\\s*'[^']*'")); if (!m) throw new Error('const ' + name); return m[0] + ';'; }

/* ── constrói o escopo REAL do gate: mesmas constantes/funções do renderer ── */
function buildScope() {
  // CLIENT_LINK_BASE do build (QA na 1.0.170/171-QA); QA_BUILD; helpers de URL/mensagem e o gate.
  const pieces = [];
  pieces.push(constLine('CLIENT_LINK_BASE'));
  // QA_BUILD pode não existir em builds antigas de produção — injeta se ausente
  try { pieces.push(constLine('QA_BUILD').replace(/const QA_BUILD\s*=\s*'[^']*'/, 'const QA_BUILD = true')); }
  catch (_) { /* na candidata QA existe como `const QA_BUILD=true;` (boolean) — captura abaixo */ }
  const qb = HTML.match(/const QA_BUILD\s*=\s*(true|false)\s*;/);
  if (qb) pieces.push('const QA_BUILD = ' + qb[1] + ';');
  else pieces.push('const QA_BUILD = /idseven-push-qa/.test(CLIENT_LINK_BASE);');
  // constantes/funcs C24D (se já existirem); statement completo (SHARE_ALLOWED_HOST/SHARE_ENV são ternários)
  for (const c of ['SHARE_ENV', 'SHARE_ALLOWED_HOST', 'SHARE_PATH_PREFIX']) {
    const m = HTML.match(new RegExp('const ' + c + '\\s*=\\s*[^\\n]+?;'));
    if (m) pieces.push(m[0]);
  }
  const tokRe = HTML.match(/const SHARE_TOKEN_RE_DESK\s*=\s*\/[^\n]+?\/;/);
  if (tokRe) pieces.push(tokRe[0]);
  for (const f of ['validateShareUrl', 'buildShareClientUrl', 'buildClientMessage', '_gateValidLink']) {
    try { pieces.push(fnSrc(f)); } catch (_) { /* algumas só existem após o fix */ }
  }
  const body = pieces.join('\n') +
    '\nreturn { CLIENT_LINK_BASE, QA_BUILD, buildShareClientUrl, buildClientMessage, _gateValidLink,' +
    " validateShareUrl: (typeof validateShareUrl==='function'?validateShareUrl:null)," +
    " SHARE_ALLOWED_HOST: (typeof SHARE_ALLOWED_HOST!=='undefined'?SHARE_ALLOWED_HOST:null) };";
  // `self`/`window` usados por genReviewToken não são chamados aqui; stubs mínimos.
  return new Function('self', 'window', 'Date', 'URL', 'String', 'RegExp', 'Array', 'Uint8Array', body)(
    {}, {}, Date, URL, String, RegExp, Array, Uint8Array);
}

const S = buildScope();
console.log('F3.3.73I6C24D — gate de URL do share (host efetivo=' + (function(){try{return new URL(S.CLIENT_LINK_BASE).host}catch(_){return '??'}})() + ', QA_BUILD=' + S.QA_BUILD + ', modo=' + (RED ? 'RED' : 'GREEN') + ')');

/* contexto sintético (token estável de 48 hex, como o real) */
const TOK = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
const ctxCron = { id: 'qa-int-cron', client: 'Cliente Sintético', token: TOK, sector: 'cronograma' };
const ctxRot = { id: 'qa-int-rot', client: 'Cliente Sintético', token: TOK, sector: 'roteiro' };

/* ── FASE 1 — RED: o gate REAL aceita/rejeita a shareUrl do BUILD? ── */
const urlCron = S.buildShareClientUrl(ctxCron.token);
const urlRot = S.buildShareClientUrl(ctxRot.token);
const msgCron = S.buildClientMessage(ctxCron);
const msgRot = S.buildClientMessage(ctxRot);
const gCron = S._gateValidLink(ctxCron, msgCron);
const gRot = S._gateValidLink(ctxRot, msgRot);

// RED_*_LINK_INVALID_CONFIRMED: no código LEGADO (1.0.170-QA) estes gates ficam ok=false (RED).
gate('RED_CRONOGRAMA: gate REAL aceita a shareUrl do build (host efetivo) para Cronograma', gCron.ok === true, true);
gate('RED_ROTEIRO: gate REAL aceita a shareUrl do build (host efetivo) para Roteiro', gRot.ok === true, true);
if (!gCron.ok) console.log('    RED_CRONOGRAMA_LINK_INVALID_CONFIRMED (reason=' + (gCron.reason || 'n/d') + ')');
if (!gRot.ok) console.log('    RED_ROTEIRO_LINK_INVALID_CONFIRMED (reason=' + (gRot.reason || 'n/d') + ')');

/* ── GM-QA gates (só fazem sentido no GREEN; no RED o validador nem existe) ── */
const HOST_QA = 'idseven-push-qa.agidseven.workers.dev';
const HOST_PROD = 'aprovar.agendaidseven.com.br';
const V = S.validateShareUrl;
const mk = (host, tipo, extra) => 'https://' + host + '/share/cronograma/' + TOK + (extra || '');

if (!RED && V) {
  gate('GM-QA-URL-HOST-EXACT: host QA EXATO aceito', V(mk(HOST_QA), 'cronograma').ok === true);
  gate('GM-QA-URL-HOST-EXACT: host de produção REJEITADO na build QA', V(mk(HOST_PROD), 'cronograma').ok === false);
  gate('GM-QA-URL-HOST-EXACT: subdomínio parecido REJEITADO', V('https://idseven-push-qa.agidseven.workers.dev.evil.com/share/cronograma/' + TOK, 'cronograma').ok === false);
  gate('GM-QA-URL-HOST-EXACT: qualquer *.workers.dev REJEITADO (sem wildcard)', V('https://outro-worker.workers.dev/share/cronograma/' + TOK, 'cronograma').ok === false);
  gate('GM-QA-URL-HOST-EXACT: host arbitrário REJEITADO', V('https://evil.example.com/share/cronograma/' + TOK, 'cronograma').ok === false);
  gate('GM-QA-URL-PROTO: HTTP REJEITADO', V('http://' + HOST_QA + '/share/cronograma/' + TOK, 'cronograma').ok === false);
  gate('GM-QA-URL-PROTO: sem protocolo REJEITADO', V(HOST_QA + '/share/cronograma/' + TOK, 'cronograma').ok === false);
  gate('GM-QA-URL-PATH-CRON: rota oficial /share/cronograma/ aceita (Cronograma)', V(mk(HOST_QA), 'cronograma').pathOk === true);
  gate('GM-QA-URL-PATH-ROT: rota oficial /share/cronograma/ aceita (Roteiro — rota única C23)', V(mk(HOST_QA), 'roteiro').ok === true);
  gate('GM-QA-URL-PATH: rota desconhecida REJEITADA', V('https://' + HOST_QA + '/naoexiste/' + TOK, 'cronograma').ok === false);
  gate('GM-QA-URL-PATH: portalUrl (/cliente/) NÃO é shareUrl', V('https://' + HOST_QA + '/cliente/cronograma/' + TOK, 'cronograma').ok === false);
  gate('GM-QA-URL-TOKEN: sem token REJEITADO', V('https://' + HOST_QA + '/share/cronograma/', 'cronograma').ok === false);
  gate('GM-QA-URL-TOKEN: token com formato inválido REJEITADO', V('https://' + HOST_QA + '/share/cronograma/tok*inv$lido', 'cronograma').ok === false);
  gate('GM-QA-URL-TOKEN: token presente e válido aceito', V(mk(HOST_QA), 'cronograma').tokenOk === true);
  gate('GM-QA-URL-TYPE: tipo divergente do domínio esperado REJEITADO (tipo inválido)', V(mk(HOST_QA), 'outro').ok === false);
  gate('GM-QA-URL-TYPE: cronograma OK', V(mk(HOST_QA), 'cronograma').typeOk === true);
  gate('GM-QA-URL-TYPE: roteiro OK', V(mk(HOST_QA), 'roteiro').typeOk === true);
  gate('GM-QA-URL: espaços antes/depois REJEITADOS (fail-closed)', V('  ' + mk(HOST_QA) + '  ', 'cronograma').ok === false);
  gate('GM-QA-URL: caractere invisível (zero-width) REJEITADO', V('https://' + HOST_QA + '/share/cronograma/' + TOK + '​', 'cronograma').ok === false);
  gate('GM-QA-URL: query string desconhecida REJEITADA (rota estável, sem ?v=)', V(mk(HOST_QA, 'cronograma', '?x=1'), 'cronograma').ok === false);
  gate('GM-QA-URL: URL malformada REJEITADA', V('nao-e-url', 'cronograma').ok === false);
  gate('GM-QA-URL: credencial embutida (user:pass@) REJEITADA', V('https://u:p@' + HOST_QA + '/share/cronograma/' + TOK, 'cronograma').ok === false);
  // canonical: a mesma URL usada em todos os botões
  gate('GM-QA-CANONICAL-URL-UNIFIED: buildShareClientUrl == host QA + rota + token', urlCron === 'https://' + HOST_QA + '/share/cronograma/' + TOK);
  gate('GM-QA-CANONICAL-URL-UNIFIED: mensagem contém EXATAMENTE a shareUrl canônica', msgCron.indexOf(urlCron) > -1 && msgRot.indexOf(urlRot) > -1);
  // texto por setor
  gate('GM-QA-ROTEIRO-TEXT: mensagem de Roteiro identifica "Roteiro de gravação de vídeos"', /Roteiro de gravação de vídeos/.test(msgRot) && !/Seu cronograma/.test(msgRot));
  gate('GM-QA-ROTEIRO-TEXT: erro por setor — Roteiro usa "gere o roteiro novamente"', /gere o roteiro novamente/.test(HTML));
  gate('GM-QA-ROTEIRO-TEXT: erro por setor — Cronograma usa "gere o cronograma novamente"', /gere o cronograma novamente/.test(HTML));
  gate('GM-QA-ALLOWLIST: SHARE_ALLOWED_HOST é o host QA (build QA)', S.SHARE_ALLOWED_HOST === HOST_QA);
  gate('GM-PROD-QA-HOST-ABSENT/allowlist: validador NÃO usa includes("workers.dev") nem startsWith de host fixo', !/includes\(\s*['"]workers\.dev['"]\s*\)/.test(HTML) && !/!\/workers\\?\.dev\/\.test/.test(HTML));
  gate('GM-QA-BUTTONS-FAIL-CLOSED: _gateValidLink devolve reason estruturado em falha', (function(){ const r = V('https://evil.example.com/share/cronograma/' + TOK, 'cronograma'); return r.ok === false && typeof r.reason === 'string' && r.reason.length > 0; })());
}

/* ── fiação dos 3 botões: nascem desabilitados + estado unificado (GREEN) ── */
if (!RED) {
  gate('GM-QA-BUTTONS-ENABLED: btnCopyGroupMsg nasce disabled (fail-closed)', /id="btnCopyGroupMsg"[^>]*\sdisabled/.test(HTML));
  gate('GM-QA-BUTTONS-ENABLED: btnTestLink nasce disabled (fail-closed)', /id="btnTestLink"[^>]*\sdisabled/.test(HTML));
  gate('GM-QA-BUTTONS-ENABLED: runPrewarm habilita os 3 botões no sucesso', /setShareButtonsEnabled\(true\)/.test(HTML) && /setShareButtonsEnabled\(false\)/.test(HTML));
}

console.log('\nC24D URL-GATE: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : (RED ? ' — RED OK' : ' — SUITE OK')));
process.exit(fail ? 1 : 0);
