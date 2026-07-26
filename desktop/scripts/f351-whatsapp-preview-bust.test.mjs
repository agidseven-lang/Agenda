#!/usr/bin/env node
/* =====================================================================
   F3.5.1 — RECUPERAÇÃO DO CARD PREMIUM (WhatsApp Business): contrato do
   cache-bust do link ENVIADO. Micro-exec REAL das funções extraídas do
   renderer (fetchless, sem DOM). Tokens são FAKE (nunca reais).

   CAUSA-RAIZ: /share/cronograma/<token> ESTÁVEL (sem ?v=) → preview
   envenenado no cache do WhatsApp/Meta; o Worker é fail-open (serve o
   card), mas o WhatsApp não re-raspa a MESMA URL. FIX: reabilitar o
   withWhatsAppPreviewBust EXISTENTE SÓ no link da mensagem enviada.

   Preservação provada aqui: token/path/domínio intactos; o clientReviewUrl
   salvo (/cliente/...) permanece SEM ?v=; a mensagem ainda contém a URL
   /share crua como substring (o gate _gateValidLink por indexOf continua
   válido); nenhum workers.dev; sem query malformada.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

function fnSrc(name) {
  const re = new RegExp('(?:async )?function ' + name + '\\s*\\(');
  const m = HTML.match(re); if (!m) throw new Error('fn ' + name + ' ausente');
  const st = HTML.indexOf(m[0]); let d = 0;
  for (let j = HTML.indexOf('{', st); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(st, j + 1); } }
  throw new Error('sem fecho ' + name);
}

const SRC_BUST = fnSrc('withWhatsAppPreviewBust');
const SRC_SHARE = fnSrc('buildShareClientUrl');
const SRC_PUBLIC = fnSrc('buildPublicClientUrl');
const SRC_MSG = fnSrc('buildClientMessage');
const SRC_GATE = fnSrc('_gateValidLink');

// CLIENT_LINK_BASE é a MESMA constante de produção lida do HTML (prova o domínio).
const BASE_M = HTML.match(/const\s+CLIENT_LINK_BASE\s*=\s*'([^']+)'/);
const CLIENT_LINK_BASE = BASE_M ? BASE_M[1] : '';

const api = new Function('CLIENT_LINK_BASE',
  SRC_BUST + '\n' + SRC_SHARE + '\n' + SRC_PUBLIC + '\n' + SRC_MSG + '\n' +
  'return { withWhatsAppPreviewBust, buildShareClientUrl, buildPublicClientUrl, buildClientMessage };'
)(CLIENT_LINK_BASE);

console.log('F3.5.1 — cache-bust do link do WhatsApp (hermético)  base=' + CLIENT_LINK_BASE);
const TOK = 'deadbeefcafe0011deadbeefcafe0011deadbeefcafe0011';           // token FAKE (48 hex)
const PREFIX = 'https://aprovar.agendaidseven.com.br/share/cronograma/';
const BARE = CLIENT_LINK_BASE + '/share/cronograma/' + TOK;

/* ── A) withWhatsAppPreviewBust ── */
{
  const a = api.withWhatsAppPreviewBust(BARE);
  ok('bust: anexa ?v=<digitos> em URL sem query', /\/share\/cronograma\/deadbeef[0-9a-f]+\?v=\d+$/.test(a));
  const b = api.withWhatsAppPreviewBust(BARE + '?x=1');
  ok('bust: usa &v= quando ja ha query', /\?x=1&v=\d+$/.test(b));
  ok('bust: string vazia => vazia (sem throw)', api.withWhatsAppPreviewBust('') === '');
  ok('bust: null => vazio (sem throw)', api.withWhatsAppPreviewBust(null) === '');
  ok('bust: preserva o path/token exatos (so acrescenta query)', a.indexOf(BARE) === 0);
}

/* ── B) buildShareClientUrl permanece CRU (sem ?v=) — usado pelo prewarm/gate ── */
{
  const s = api.buildShareClientUrl(TOK);
  ok('share URL crua = BASE + /share/cronograma/ + token (sem ?v=)', s === BARE);
  ok('share URL crua nao tem cache-bust', s.indexOf('?v=') === -1);
  let threw = false; try { api.buildShareClientUrl(''); } catch (_) { threw = true; }
  ok('share URL: lanca sem token (NUNCA sai sem token)', threw);
}

/* ── C) buildPublicClientUrl (portal / clientReviewUrl salvo) INTOCADO ── */
{
  const p = api.buildPublicClientUrl(TOK);
  ok('portal URL = /cliente/cronograma/<token> (rota do portal, nao /share)', p === CLIENT_LINK_BASE + '/cliente/cronograma/' + TOK);
  ok('portal URL SEM ?v= (link salvo nao muda; nada e invalidado)', p.indexOf('?v=') === -1);
}

/* ── D) buildClientMessage: o LINK ENVIADO agora tem cache-bust ── */
for (const sector of ['cronograma', 'roteiro']) {
  const msg = api.buildClientMessage({ client: 'Cliente Teste', token: TOK, sector });
  const m = msg.match(/https:\/\/aprovar\.agendaidseven\.com\.br\/share\/cronograma\/[0-9a-f]+\?v=\d+/);
  ok('[' + sector + '] mensagem contem /share/cronograma/<token>?v=<ts> (card raspado na hora)', !!m);
  ok('[' + sector + '] URL enviada comeca no prefixo premium exato', !!m && m[0].indexOf(PREFIX) === 0);
  ok('[' + sector + '] mensagem CONTEM a URL crua como substring (gate indexOf sobrevive)', msg.indexOf(BARE) > -1);
  ok('[' + sector + '] token intacto na URL', !!m && m[0].indexOf(TOK) > -1);
  ok('[' + sector + '] sem /cliente/ na mensagem (so /share)', msg.indexOf('/cliente/') === -1);
  ok('[' + sector + '] sem workers.dev', msg.indexOf('workers.dev') === -1);
  ok('[' + sector + '] sem query malformada (?? ou &&)', !/\?\?|&&/.test(msg));
}

/* ── E) Preservação / escopo (source-scans) ── */
ok('src: buildClientMessage CABEIA withWhatsAppPreviewBust (guarda de regressao)', /withWhatsAppPreviewBust\s*\(\s*buildShareClientUrl/.test(SRC_MSG));
ok('src: withWhatsAppPreviewBust definido (mecanismo V64.40 presente)', /Date\.now\(\)/.test(SRC_BUST) && /'\?'|"\?"/.test(SRC_BUST));
ok('src: buildPublicClientUrl NAO usa cache-bust (portal permanece cru)', SRC_PUBLIC.indexOf('withWhatsAppPreviewBust') === -1);
ok('src: buildShareClientUrl NAO usa cache-bust (prewarm/gate usam URL crua)', SRC_SHARE.indexOf('withWhatsAppPreviewBust') === -1);
ok('src: _gateValidLink valida por substring String(msg).indexOf(url) (tolera ?v=)', /String\(msg\)\.indexOf\(url\)\s*>\s*-1/.test(SRC_GATE));

/* ── F) versão ── */
ok('package.json version === 1.0.186', PKG.version === '1.0.186');

console.log('\nF3.5.1 preview-bust: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
