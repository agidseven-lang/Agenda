#!/usr/bin/env node
/* AUDITORIA DO CARD PREMIUM DE COMPARTILHAMENTO/APROVAÇÃO DO CRONOGRAMA (read-only).
 * Extrai as funções REAIS do Worker (cloudflare-worker.js) que geram o preview OG do
 * link /share/cronograma e /cliente/cronograma (WhatsApp/Facebook/etc.) e prova que o
 * card premium está íntegro no código: og:title/description/image absoluto 1200x630,
 * OG ANTES de qualquer <script>, imagem embutida (não depende de fetch/JS), twitter card.
 * NÃO acessa produção, NÃO faz deploy, NÃO grava nada de real. Gera evidência local.
 * Rodar: /opt/node22/bin/node scripts/worker-ops/share-card.test.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.resolve(__dirname, '..', '..', 'cloudflare-worker.js');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'share-card-audit');
fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(WORKER, 'utf8');

// ── extrai declarações reais do Worker (balanceando chaves p/ funções) ──
function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('função não encontrada: ' + name);
  let depth = 0, began = false;
  for (let j = src.indexOf('{', start); j < src.length; j++) {
    const c = src[j];
    if (c === '{') { depth++; began = true; }
    else if (c === '}') { depth--; if (began && depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error('chaves desbalanceadas em ' + name);
}
function extractConst(name) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*').exec(src);
  if (!m) throw new Error('const não encontrada: ' + name);
  let i = m.index + m[0].length;
  const q = src[i];
  if (q === '"' || q === "'") { i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; }
  return src.slice(m.index, src.indexOf(';', i) + 1);
}

const blob = [
  extractConst('OG_IMG_PATH'),
  extractConst('OG_BANNER_B64'),
  extractFn('escapeHtml'),
  extractFn('ogClientBase'),
  extractFn('ogClientMeta'),
  extractFn('crawlerCardHtml'),
  extractFn('shareCardHtml'),
].join('\n;\n');
const api = new Function(blob + '\n;return {OG_IMG_PATH,OG_BANNER_B64,escapeHtml,ogClientBase,ogClientMeta,crawlerCardHtml,shareCardHtml};')();
const { OG_IMG_PATH, OG_BANNER_B64, ogClientMeta, crawlerCardHtml, shareCardHtml } = api;

const ORIGIN = 'https://aprovar.agendaidseven.com.br';
const TOKEN = 'demo-token-AUDIT';
const shareHtml = shareCardHtml(ORIGIN, TOKEN);
const crawlerHtml = crawlerCardHtml(ORIGIN, 'Boa Forma', TOKEN);
fs.writeFileSync(path.join(OUT, 'share-cronograma.preview.html'), shareHtml);
fs.writeFileSync(path.join(OUT, 'cliente-cronograma-crawler.preview.html'), crawlerHtml);

// imagem premium embutida → arquivo de evidência (+ checagem de formato/tamanho)
const imgBuf = Buffer.from(OG_BANNER_B64, 'base64');
const isPNG = imgBuf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
const isJPG = imgBuf.slice(0, 3).toString('hex') === 'ffd8ff';
const imgExt = isPNG ? 'png' : (isJPG ? 'jpg' : 'bin');
fs.writeFileSync(path.join(OUT, 'og-banner-premium.' + imgExt), imgBuf);

let pass = 0, fail = 0;
const ok = (n, c) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + n); };
const absImg = ORIGIN + OG_IMG_PATH;

ok('1 /share HTML tem og:title "Aprovar cronograma"', /<meta property="og:title" content="Aprovar cronograma/.test(shareHtml));
ok('2 /share HTML tem og:description', /<meta property="og:description" content="[^"]+"/.test(shareHtml));
ok('3 og:image ABSOLUTO https + OG_IMG_PATH', shareHtml.includes('<meta property="og:image" content="' + absImg + '"'));
ok('4 og:image:secure_url absoluto', shareHtml.includes('<meta property="og:image:secure_url" content="' + absImg + '"'));
ok('5 og:url do /share/cronograma absoluto', shareHtml.includes('<meta property="og:url" content="' + ORIGIN + '/share/cronograma/' + TOKEN + '"'));
ok('6 og:type website', /<meta property="og:type" content="website"/.test(shareHtml));
ok('7 og:image dimensões 1200x630 + image/jpeg', /og:image:width" content="1200"/.test(shareHtml) && /og:image:height" content="630"/.test(shareHtml) && /og:image:type" content="image\/jpeg"/.test(shareHtml));
ok('8 twitter summary_large_image', /twitter:card" content="summary_large_image"/.test(shareHtml));
ok('9 OG vem ANTES de qualquer <script> (não depende de JS client-side)', shareHtml.indexOf('og:image') < shareHtml.indexOf('<script'));
ok('10 card de crawler (WhatsApp) também emite og:image absoluto', crawlerHtml.includes('<meta property="og:image" content="' + absImg + '"'));
ok('11 título/descrição NÃO genéricos (não há "URL"/domínio cru como título)', !/og:title" content="(https?:|aprovar\.agendaidseven)/.test(shareHtml));
ok('12 OG_IMG_PATH versionado em /og e .jpg', /^\/og\/.+\.jpg$/.test(OG_IMG_PATH));
ok('13 imagem premium embutida decodifica (PNG/JPEG) e tem tamanho real', (isPNG || isJPG) && imgBuf.length > 5000);
ok('14 NÃO usa querystring no og:image (cache de crawler)', !absImg.includes('?'));

console.log('\n— EVIDÊNCIA —');
console.log('og:image      :', absImg);
console.log('imagem embutida:', imgExt.toUpperCase(), imgBuf.length, 'bytes →', path.relative(process.cwd(), path.join(OUT, 'og-banner-premium.' + imgExt)));
console.log('HEAD do /share/cronograma (meta OG):');
console.log(shareHtml.split('</head>')[0].split('\n').filter(l => /og:|twitter:|<title>/.test(l)).map(l => '  ' + l.trim()).join('\n'));

console.log('\nSHARE-CARD AUDIT: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
