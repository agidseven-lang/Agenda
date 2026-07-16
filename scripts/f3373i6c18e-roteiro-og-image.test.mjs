#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C18E — Testes HERMÉTICOS da imagem OG EXCLUSIVA do ROTEIRO:
     - og:image/og:image:url/secure_url/twitter:image POR TIPO:
       cronograma → /og/wa-card-v64-39.jpg (EXATO de antes);
       roteiro    → /og/wa-card-roteiro-v64-59.jpg (rota versionada NOVA);
     - a arte do Roteiro é um JPEG 1200×630 REAL embutido (sha256 pinado =
       o mesmo arquivo revisado visualmente na fase: texto dominante
       "Roteiro de gravação de vídeos");
     - a arte do Cronograma permanece BYTE-IDÊNTICA (sha256 pinado);
     - fallback (sem task) = cronograma byte-idêntico; tipos nunca se
       misturam (cache key contém o token; miss resolve task.sector);
     - GET×HEAD consistentes na rota nova; rota/formato do link INTACTOS.
   Lê cloudflare-worker.js como TEXTO — NÃO rede, NÃO deploy, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'cloudflare-worker.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

function fnSrc(name) { const re = new RegExp('(?:async )?function ' + name + '\\s*\\('); const m = SRC.match(re); if (!m) throw new Error('fn ' + name);
  let st = SRC.indexOf(m[0]), d = 0, i = SRC.indexOf('{', st);
  for (let j = i; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); } } throw new Error('sem fecho ' + name); }
function constObj(name) { const st = SRC.indexOf('const ' + name + ' = {'); if (st < 0) throw new Error('const ' + name);
  let d = 0; for (let j = SRC.indexOf('{', st); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 2); } } throw new Error('sem fecho ' + name); }
const constLine = (name) => { const m = SRC.match(new RegExp('const ' + name + ' = "[^"]*";')); if (!m) throw new Error('const ' + name); return m[0]; };
const constB64 = (name) => { const m = SRC.match(new RegExp('const ' + name + '="([A-Za-z0-9+/=]+)"')); if (!m) throw new Error('const ' + name); return m[1]; };

console.log('F3.3.73I6C18E — imagem OG exclusiva do Roteiro (hermético)');

/* ── A: versão e constantes de path ── */
ok('A1 versão da fase (prefixo V64.59 preservado p/ gates do deploy)',
  /version: "V64\.59-c23-share-snapshot"/.test(SRC) && /version: *"V64\.59/.test(SRC));
ok('A2 OG_IMG_PATH do cronograma INTACTO', /const OG_IMG_PATH = "\/og\/wa-card-v64-39\.jpg";/.test(SRC));
ok('A3 OG_IMG_PATH_ROTEIRO novo e versionado (C18G: v64-60, logo oficial)', /const OG_IMG_PATH_ROTEIRO = "\/og\/wa-card-roteiro-v64-60\.jpg";/.test(SRC));

/* ── B: micro-exec do vocabulário/HTML por tipo ── */
const CORE = constLine('OG_IMG_PATH') + '\n' + constLine('OG_IMG_PATH_ROTEIRO') + '\n' + constObj('PREMIUM_TYPES') + '\n' +
  fnSrc('premiumTypeOf') + '\n' + fnSrc('escapeHtml') + '\n' + fnSrc('ogClientBase') + '\n' + fnSrc('ogClientMeta') + '\n' +
  fnSrc('shareCardHtml') + '\n' + fnSrc('crawlerCardHtml') + '\n';
const API = new Function(CORE + 'return {PREMIUM_TYPES, premiumTypeOf, ogClientMeta, shareCardHtml, crawlerCardHtml};')();
const O = 'https://aprovar.agendaidseven.com.br';
const T = 'tokentesteC18E';
const CRON_IMG = O + '/og/wa-card-v64-39.jpg';
const ROT_IMG = O + '/og/wa-card-roteiro-v64-60.jpg';

ok('B1 PREMIUM_TYPES.imgPath por tipo (cron=v64-39; rot=roteiro-v64-59)',
  API.PREMIUM_TYPES.cronograma.imgPath === '/og/wa-card-v64-39.jpg' &&
  API.PREMIUM_TYPES.roteiro.imgPath === '/og/wa-card-roteiro-v64-60.jpg');

const shCron = API.shareCardHtml(O, T, API.PREMIUM_TYPES.cronograma);
const shRot = API.shareCardHtml(O, T, API.PREMIUM_TYPES.roteiro);
const shFall = API.shareCardHtml(O, T, null);

const imgMetas = (html, img) =>
  html.includes('property="og:image" content="' + img + '"') &&
  html.includes('property="og:image:url" content="' + img + '"') &&
  html.includes('property="og:image:secure_url" content="' + img + '"') &&
  html.includes('name="twitter:image" content="' + img + '"');

ok('B2 /share CRONOGRAMA: 4 metas de imagem na arte v64-39', imgMetas(shCron, CRON_IMG));
ok('B3 /share CRONOGRAMA: NÃO referencia a arte do roteiro', !shCron.includes('wa-card-roteiro'));
ok('B4 /share ROTEIRO: 4 metas de imagem na arte roteiro-v64-59', imgMetas(shRot, ROT_IMG));
ok('B5 /share ROTEIRO: NÃO referencia a arte v64-39 (não mistura tipos)', !shRot.includes('wa-card-v64-39'));
ok('B6 /share ROTEIRO: og:title/desc do tipo + texto do requisito do owner',
  shRot.includes('property="og:title" content="Aprovar roteiro"') &&
  shRot.includes('Roteiro de gravação de vídeos'));
ok('B7 /share CRONOGRAMA: og:title EXATO preservado',
  shCron.includes('property="og:title" content="Aprovar cronograma"'));
ok('B8 FALLBACK (sem task) = cronograma BYTE-IDÊNTICO', shFall === shCron);
ok('B9 og:url EXATO com o link real (formato preservado)',
  shRot.includes('property="og:url" content="' + O + '/share/cronograma/' + T + '"') &&
  shCron.includes('property="og:url" content="' + O + '/share/cronograma/' + T + '"'));
ok('B10 og:image:alt por tipo (roteiro/cronograma)',
  shRot.includes('property="og:image:alt" content="Agenda ID Seven — Aprovar roteiro"') &&
  shCron.includes('property="og:image:alt" content="Agenda ID Seven — Aprovar cronograma"'));
ok('B11 dimensões/type declarados inalterados (1200×630 image/jpeg) nos dois tipos',
  [shCron, shRot].every(h => h.includes('property="og:image:width" content="1200"') &&
    h.includes('property="og:image:height" content="630"') && h.includes('property="og:image:type" content="image/jpeg"')));

const crCron = API.crawlerCardHtml(O, 'Cliente X', T, API.PREMIUM_TYPES.cronograma);
const crRot = API.crawlerCardHtml(O, 'Cliente X', T, API.PREMIUM_TYPES.roteiro);
ok('B12 crawler /cliente: imagem por tipo também no portal-crawler',
  imgMetas(crCron, CRON_IMG) && imgMetas(crRot, ROT_IMG));
ok('B13 crawler: fallback sem ptype = cronograma byte-idêntico',
  API.crawlerCardHtml(O, 'Cliente X', T, null) === crCron);
ok('B14 escaping de cliente hostil intacto (aspas/major não quebram atributo)', (() => {
  const h = API.crawlerCardHtml(O, 'Cli"ente <script>&', T, API.PREMIUM_TYPES.roteiro);
  return h.includes('Cli&quot;ente &lt;script&gt;&amp;') && !h.includes('Cli"ente <script>');
})());
ok('B15 ogClientMeta SEM 6º argumento usa OG_IMG_PATH (compat byte-exata p/ páginas sem tipo)',
  API.ogClientMeta(O, 't', 'd', '/', null).includes('property="og:image" content="' + CRON_IMG + '"'));

/* ── C: as ARTES embutidas (bytes reais) ── */
const b64Cron = constB64('OG_JPG_B64');
const b64Rot = constB64('OG_JPG_ROTEIRO_B64');
const jCron = Buffer.from(b64Cron, 'base64');
const jRot = Buffer.from(b64Rot, 'base64');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function jpegDims(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const t = buf[i + 1];
    if (t >= 0xC0 && t <= 0xCF && t !== 0xC4 && t !== 0xC8 && t !== 0xCC) {
      return { h: (buf[i + 5] << 8) | buf[i + 6], w: (buf[i + 7] << 8) | buf[i + 8] };
    }
    i += 2 + ((buf[i + 2] << 8) | buf[i + 3]);
  }
  return null;
}
ok('C1 arte CRONOGRAMA intocada (sha256 byte-exato do deploy c18b)',
  sha(jCron) === 'c038636db3cf294b1edf34820c5fc68cca1ae13cd28c94a203d0590c44843eea' && jCron.length === 144941);
ok('C2 arte ROTEIRO = o JPEG revisado visualmente na fase (C18G: logo OFICIAL; sha256 pinado)',
  sha(jRot) === 'f64f6f3e36020b05ae2491a544fb45937e7798d3e48eeae5865aa04549389cf3' && jRot.length === 75415);
ok('C3 artes DISTINTAS (URLs e bytes)', sha(jCron) !== sha(jRot));
ok('C4 ambas JPEG válidos (magic ffd8) 1200×630', (() => {
  const dc = jpegDims(jCron), dr = jpegDims(jRot);
  return jCron[0] === 0xFF && jCron[1] === 0xD8 && jRot[0] === 0xFF && jRot[1] === 0xD8 &&
    dc && dc.w === 1200 && dc.h === 630 && dr && dr.w === 1200 && dr.h === 630;
})());

/* ── D: resposta da rota nova (micro-exec com Response/atob reais do Node) ── */
const JR = new Function('OG_JPG_ROTEIRO_B64', fnSrc('jpgRoteiroBannerResponse') + '\nreturn jpgRoteiroBannerResponse;')(b64Rot);
ok('D1 GET /og/wa-card-roteiro-v64-59.jpg → 200 image/jpeg com Content-Length e cache 24h', await (async () => {
  const r = JR('GET');
  const buf = Buffer.from(await r.arrayBuffer());
  return r.status === 200 && r.headers.get('content-type') === 'image/jpeg' &&
    r.headers.get('content-length') === String(jRot.length) &&
    r.headers.get('cache-control') === 'public, max-age=86400' &&
    buf.length === jRot.length && sha(buf) === sha(jRot);
})());
ok('D2 HEAD → mesmos headers, corpo vazio (GET×HEAD consistentes)', await (async () => {
  const r = JR('HEAD');
  const buf = Buffer.from(await r.arrayBuffer());
  return r.status === 200 && r.headers.get('content-type') === 'image/jpeg' &&
    r.headers.get('content-length') === String(jRot.length) && buf.length === 0;
})());
ok('D3 rota registrada no bloco GET||HEAD (v64-60 + alias v64-59 p/ HTML cacheado)',
  /if \(url\.pathname === "\/og\/wa-card-roteiro-v64-60\.jpg" \|\| url\.pathname === "\/og\/wa-card-roteiro-v64-59\.jpg"\) return jpgRoteiroBannerResponse\(M\);/.test(SRC));
ok('D4 rota v64-39 do cronograma INTACTA (mesma lista de canários)',
  /url\.pathname === "\/og\/wa-card-v64-39\.jpg"\) return jpgBannerResponse\(M\);/.test(SRC));

/* ── E: preservações críticas do /share (C18B) — tipos/tokens nunca se misturam ── */
const hs = fnSrc('handleShareCard');
ok('E1 cache key contém o TOKEN (tipos nunca se misturam por chave)',
  hs.includes('url.origin + "/share/cronograma/" + token'));
ok('E2 só snapshot READY aquece o cache (contrato C23: não-publicado retorna ANTES do put)',
  hs.includes('if (!snap) return fail("not_found", 404, "none");') &&
  hs.indexOf('if (!snap) return fail') < hs.indexOf('caches.default.put(cacheKey'));
ok('E3 sem branch por UA no /share (mesma resposta p/ WhatsApp/FB/navegador)',
  !hs.includes('isCrawlerUA'));
ok('E4 rota/formato do link INTACTOS (regex do /share inalterada)',
  SRC.includes('/^\\/share\\/cronograma\\/([A-Za-z0-9_-]{4,128})\\/?$/'));
ok('E5 X-Share-Cache preservado (hit e miss)',
  hs.includes('"X-Share-Cache", "hit"') && hs.includes('"X-Share-Cache", "miss"'));
ok('E6 sem deadline que troque tipo E sem lookup dinâmico no GET público (C23: snapshot é a fonte única)',
  !/deadline|race\(/.test(hs) && !/queryTaskByToken|getAccessToken/.test(hs) &&
  hs.includes('env.SHARE_SNAPSHOTS.get(SHARE_SNAP_KEY(token))'));
ok('E7 contrato C23: estados explícitos + X-Share-Type + X-Share-Snapshot + no-store nos não-publicados',
  hs.includes('res.headers.set("X-Share-Task", "resolved");') && hs.includes('res.headers.set("X-Share-Type", ptype.key);') &&
  hs.includes('res.headers.set("X-Share-Snapshot", "ready");') &&
  hs.includes('"X-Share-Task": state') && hs.includes('"X-Share-Type": "none"') && hs.includes('"Cache-Control": "no-store"') &&
  hs.includes('return fail("error", 503,'));
ok('E8 X-Share-Task definido ANTES do cache.put (entrada cacheada carrega "resolved")', (() => {
  const iSet = hs.indexOf('X-Share-Task'); const iPut = hs.indexOf('caches.default.put(cacheKey');
  return iSet >= 0 && iPut >= 0 && iSet < iPut;
})());

console.log(`\nRESULTADO: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
