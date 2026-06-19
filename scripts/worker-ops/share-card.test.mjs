#!/usr/bin/env node
/* AUDITORIA DO CARD PREMIUM DE COMPARTILHAMENTO/APROVAÇÃO DO CRONOGRAMA (read-only).
 * Extrai as funções/constantes REAIS do Worker (cloudflare-worker.js) que geram o preview OG
 * dos links /share/cronograma e /cliente/cronograma (WhatsApp/Facebook/etc.) e PROVA, em código,
 * que o card premium está íntegro: og:title/description/image absoluto 1200x630, OG ANTES de
 * qualquer <script>, e que a og:image REALMENTE servida (OG_JPG_B64 via /og/...jpg) é um JPEG
 * 1200x630 válido com MIME/extensão alinhados — e que o PATH do og:image está roteado (não 404).
 * NÃO acessa produção, NÃO faz deploy, NÃO grava nada real. Gera evidência local.
 * Rodar: /opt/node22/bin/node scripts/worker-ops/share-card.test.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.resolve(__dirname, '..', '..', 'cloudflare-worker.js');
const OUT = path.resolve(__dirname, '..', '..', 'docs', 'share-card-audit');
fs.mkdirSync(OUT, { recursive: true });
const src = fs.readFileSync(WORKER, 'utf8');

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
// largura/altura de um JPEG (lê marcadores SOF)
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xC0 && m <= 0xC3) return { w: (buf[i + 7] << 8) | buf[i + 8], h: (buf[i + 5] << 8) | buf[i + 6] };
    i += 2 + ((buf[i + 2] << 8) | buf[i + 3]);
  }
  return { w: 0, h: 0 };
}

const blob = [
  extractConst('OG_IMG_PATH'),
  extractConst('OG_JPG_B64'),
  extractFn('escapeHtml'),
  extractFn('ogClientBase'),
  extractFn('ogClientMeta'),
  extractFn('crawlerCardHtml'),
  extractFn('shareCardHtml'),
].join('\n;\n');
const api = new Function(blob + '\n;return {OG_IMG_PATH,OG_JPG_B64,ogClientMeta,crawlerCardHtml,shareCardHtml};')();
const { OG_IMG_PATH, OG_JPG_B64, crawlerCardHtml, shareCardHtml } = api;

const ORIGIN = 'https://aprovar.agendaidseven.com.br';
const TOKEN = 'demo-token-AUDIT';
const shareHtml = shareCardHtml(ORIGIN, TOKEN);
const crawlerHtml = crawlerCardHtml(ORIGIN, 'Boa Forma', TOKEN);
fs.writeFileSync(path.join(OUT, 'share-cronograma.preview.html'), shareHtml);
fs.writeFileSync(path.join(OUT, 'cliente-cronograma-crawler.preview.html'), crawlerHtml);

// og:image REALMENTE servida (OG_JPG_B64 → /og/...jpg via jpgBannerResponse) → evidência + checagem
const jpg = Buffer.from(OG_JPG_B64, 'base64');
const isJPG = jpg.slice(0, 3).toString('hex') === 'ffd8ff';
const dim = isJPG ? jpegSize(jpg) : { w: 0, h: 0 };
fs.writeFileSync(path.join(OUT, 'og-image-REAL-servida.jpg'), jpg);

let pass = 0, fail = 0;
const ok = (n, c) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + n); };
const absImg = ORIGIN + OG_IMG_PATH;

ok('1 /share HTML tem og:title "Aprovar cronograma"', /<meta property="og:title" content="Aprovar cronograma/.test(shareHtml));
ok('2 /share HTML tem og:description', /<meta property="og:description" content="[^"]+"/.test(shareHtml));
ok('3 og:image ABSOLUTO https + OG_IMG_PATH', shareHtml.includes('<meta property="og:image" content="' + absImg + '"'));
ok('4 og:image:secure_url absoluto', shareHtml.includes('<meta property="og:image:secure_url" content="' + absImg + '"'));
ok('5 og:url do /share/cronograma absoluto', shareHtml.includes('<meta property="og:url" content="' + ORIGIN + '/share/cronograma/' + TOKEN + '"'));
ok('6 og:type website', /<meta property="og:type" content="website"/.test(shareHtml));
ok('7 og:image dimensões 1200x630 + image/jpeg (meta)', /og:image:width" content="1200"/.test(shareHtml) && /og:image:height" content="630"/.test(shareHtml) && /og:image:type" content="image\/jpeg"/.test(shareHtml));
ok('8 twitter summary_large_image', /twitter:card" content="summary_large_image"/.test(shareHtml));
ok('9 OG vem ANTES de qualquer <script> (não depende de JS client-side)', shareHtml.indexOf('og:image') < shareHtml.indexOf('<script'));
ok('10 card de crawler (WhatsApp) também emite og:image absoluto', crawlerHtml.includes('<meta property="og:image" content="' + absImg + '"'));
ok('11 título/descrição NÃO genéricos (sem URL/domínio cru como título)', !/og:title" content="(https?:|aprovar\.agendaidseven)/.test(shareHtml));
ok('12 OG_IMG_PATH versionado em /og e .jpg', /^\/og\/.+\.jpg$/.test(OG_IMG_PATH));
ok('13 og:image REAL é JPEG 1200x630 válido (OG_JPG_B64 servido)', isJPG && dim.w === 1200 && dim.h === 630 && jpg.length > 5000);
ok('14 MIME/extensão ALINHADOS (.jpg ↔ bytes JPEG ↔ image/jpeg)', /\.jpg$/.test(OG_IMG_PATH) && isJPG);
ok('15 PATH do og:image está ROTEADO (não 404): pathname===OG_IMG_PATH → jpgBannerResponse', new RegExp('url\\.pathname === "' + OG_IMG_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"').test(src) && /return jpgBannerResponse\(M\)/.test(src));
ok('16 sem querystring no og:image (cache de crawler por URL)', !absImg.includes('?'));

console.log('\n— EVIDÊNCIA —');
console.log('og:image (canônico no repo):', absImg, '→ JPEG', jpg.length, 'bytes', dim.w + 'x' + dim.h);
console.log('arquivo de evidência        :', path.relative(process.cwd(), path.join(OUT, 'og-image-REAL-servida.jpg')));
console.log('HEAD do /share/cronograma (meta OG):');
console.log(shareHtml.split('</head>')[0].split('\n').filter(l => /og:|twitter:|<title>/.test(l)).map(l => '  ' + l.trim()).join('\n'));

console.log('\nSHARE-CARD AUDIT: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
