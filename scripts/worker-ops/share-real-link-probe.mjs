#!/usr/bin/env node
/* =====================================================================
   F3.5.1B — SONDA TOKEN-SAFE DO LINK REAL (rode LOCALMENTE na sua máquina)
   ---------------------------------------------------------------------
   Objetivo: provar, no LINK REAL que falhou, o estado do token (resolved/
   not_found/error), o og:url REAL (com/sem query), o og:image REAL e a
   entrega da imagem ao Meta — para classificar o cenário A/B/C/D ANTES de
   qualquer correção.

   SEGURANÇA (obrigatória): NUNCA imprime o token. Mascara em TODA a saída
   como  TKN#<sha256:12>. NÃO grava arquivos, NÃO sobe artifacts, NÃO loga
   o link cru. Rode na SUA máquina; cole aqui SÓ a saída mascarada.

   USO (Node 18+, que já vem no toolchain do Desktop):
     node scripts/worker-ops/share-real-link-probe.mjs
       → cole o LINK REAL quando pedir (não fica no histórico do shell)
     ou, sem prompt:
       Windows PowerShell:  $env:SHARE_LINK="https://.../share/cronograma/<token>"; node scripts/worker-ops/share-real-link-probe.mjs
       bash/macOS:          SHARE_LINK="https://.../share/cronograma/<token>" node scripts/worker-ops/share-real-link-probe.mjs
   ===================================================================== */
import crypto from 'node:crypto';
import readline from 'node:readline';

const UAS = {
  navegador: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  facebook:  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  whatsapp:  'WhatsApp/2.2412.54 A',
  twitter:   'Twitterbot/1.0',
};
const HDRS = ['content-type','cache-control','cf-cache-status','age','vary','x-share-task','x-share-type','x-share-cache','x-id7-worker-build','server-timing','location'];
const OGF  = ['og:url','og:image','og:title','og:description','twitter:card'];
const sha12 = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,12);
const ask = q => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); return new Promise(r => rl.question(q, a => { rl.close(); r(a.trim()); })); };

function parseOG(body){
  const o = {};
  for (const p of OGF){
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = body && body.match(new RegExp('<meta (?:property|name)="' + esc + '" content="([^"]*)"'));
    o[p] = m ? m[1] : '(ausente)';
  }
  return o;
}

async function probe(url, uaKey, method, mask){
  const row = { alvo: mask(url), ua: uaKey, method };
  try{
    const r = await fetch(url, { method, redirect: 'manual', headers: { 'user-agent': UAS[uaKey], 'accept': 'text/html,application/xhtml+xml,*/*' } });
    row.status = r.status;
    for (const h of HDRS){ const v = r.headers.get(h); if (v != null) row[h] = mask(v); }
    if (method === 'GET'){
      const b = await r.text();
      const og = parseOG(b);
      for (const k of OGF) row[k] = mask(og[k]);
      row.bytes = b.length;
      row._imgUrl = og['og:image'];   // cru (interno) só p/ o teste de imagem; NÃO é impresso
    }
  }catch(e){ row.error = String(e && e.message || e); }
  return row;
}

function printRow(r){
  const head = `• [${r.ua}/${r.method}] status=${r.status ?? r.error}`;
  console.log(head);
  for (const k of [...HDRS, ...OGF]) if (r[k] != null) console.log(`      ${k}: ${r[k]}`);
  if (r.bytes != null) console.log(`      bytes: ${r.bytes}`);
}

(async () => {
  const link = (process.env.SHARE_LINK || await ask('Cole o LINK REAL (/share/cronograma/<token>) e Enter: ')).trim();
  let U; try { U = new URL(link); } catch { console.error('Link inválido.'); process.exit(2); }
  const m = U.pathname.match(/\/(?:share|cliente)\/cronograma\/([^/?#]+)/);
  if (!m) { console.error('Não encontrei /share|cliente/cronograma/<token> no link.'); process.exit(2); }
  const TOKEN = m[1];
  const H = sha12(TOKEN);
  const enc = encodeURIComponent(TOKEN);
  const mask = s => { let x = String(s == null ? '' : s); x = x.split(TOKEN).join('TKN#' + H); if (enc !== TOKEN) x = x.split(enc).join('TKN#' + H); return x; };
  const origin = U.origin;
  const base = origin + '/share/cronograma/' + TOKEN;                  // rota canônica do preview
  const rnd = 'probe-' + crypto.randomBytes(4).toString('hex');
  const variants = [ ['sem-query', base], ['?v=1', base + '?v=1'], ['?v=novo', base + '?v=' + rnd] ];
  const bogus = origin + '/share/cronograma/' + 'deadbeefcafe0011deadbeefcafe0011deadbeefcafe0011';

  console.log('F3.5.1B — sonda do link real (token mascarado como TKN#' + H + ')');
  console.log('origin=' + origin + '  token.sha256[0:12]=' + H + '  (o token NUNCA é impresso)');

  console.log('\n===== A) GET por UA × variante de query (og:url / headers / cache) =====');
  const resolvedRows = [];
  for (const uaKey of Object.keys(UAS)){
    for (const [label, u] of variants){
      const r = await probe(u, uaKey, 'GET', mask);
      console.log(`\n[${uaKey}] variante=${label}`);
      printRow(r);
      if (uaKey === 'facebook' && label === 'sem-query') resolvedRows.push(r);
    }
  }

  console.log('\n===== B) HEAD (paridade de headers) — facebookexternalhit =====');
  for (const [label, u] of [ ['sem-query', base], ['?v=1', base + '?v=1'] ]){
    console.log(`\n[facebook/HEAD] variante=${label}`); printRow(await probe(u, 'facebook', 'HEAD', mask));
  }

  console.log('\n===== C) TOKEN REAL vs TOKEN DIAGNÓSTICO (inexistente) — facebookexternalhit, GET =====');
  const real = await probe(base, 'facebook', 'GET', mask);  console.log('\n[REAL   ]'); printRow(real);
  const diag = await probe(bogus, 'facebook', 'GET', mask); console.log('\n[BOGUS  ]'); printRow(diag);

  console.log('\n===== D) ENTREGA DA IMAGEM og:image ao Meta (facebookexternalhit) =====');
  const imgUrl = real._imgUrl && real._imgUrl !== '(ausente)' ? real._imgUrl : (origin + '/og/wa-card-v64-39.jpg');
  try{
    const ir = await fetch(imgUrl, { method: 'GET', headers: { 'user-agent': UAS.facebook } });
    const buf = Buffer.from(await ir.arrayBuffer());
    console.log('• og:image=' + mask(imgUrl));
    console.log('      status=' + ir.status + '  content-type=' + ir.headers.get('content-type') + '  content-length=' + (ir.headers.get('content-length') || buf.length) + '  cf-cache=' + (ir.headers.get('cf-cache-status')||'-') + '  bytes-lidos=' + buf.length);
  }catch(e){ console.log('• og:image fetch ERRO: ' + String(e && e.message || e)); }

  console.log('\n===== VEREDITO (indicativo — decisão final é sua) =====');
  const st = real['x-share-task'] || '(sem header)';
  const ty = real['x-share-type'] || '(sem header)';
  const ogu = real['og:url'] || '(ausente)';
  console.log('• x-share-task(real)=' + st + '  x-share-type(real)=' + ty + '  x-share-task(bogus)=' + (diag['x-share-task'] || '-'));
  console.log('• og:url(real)=' + ogu);
  if (st !== 'resolved') console.log('  → CENÁRIO B provável: o TOKEN REAL NÃO resolve (não é "resolved"). Investigar resolução do token no Worker.');
  else {
    if (/\?v=/.test(ogu)) console.log('  → og:url reflete a query (inesperado p/ o código atual). Reavaliar.');
    else console.log('  → CENÁRIO A confirmado no vivo: og:url é CANÔNICO SEM query → ?v= é inerte (Meta canonicaliza). Fix = ROTA/PATH único refletido no og:url.');
    console.log('  → Confira acima: og:image status=200 image/jpeg (senão CENÁRIO D) e og:title/tipo corretos (senão CENÁRIO C).');
  }
  console.log('\nCole ESTA saída (já mascarada) no chat. Nada aqui contém o token.');
})();
