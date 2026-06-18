/* F3.3.0 — Renderiza os mockups SLA (mockups.html) e exporta 1 PNG por cenário
 * + visão geral, como artifacts de CI para validação visual do owner.
 * 100% estático/simulado: sem rede, sem provider, sem Firestore, sem push. */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIR = path.resolve('desktop/scripts/sla-mockups');
const OUT = path.resolve('desktop/sla-mockups-out');
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  let f = (req.url || '/').split('?')[0];
  if (f === '/' || f === '') f = '/mockups.html';
  const p = path.join(DIR, f);
  fs.readFile(p, (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/mockups.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const shots = await page.$$eval('[data-shot]', els => els.map(e => e.getAttribute('data-shot')));
const done = [];
for (const id of shots) {
  const el = await page.$(`[data-shot="${id}"]`);
  if (!el) continue;
  await el.screenshot({ path: path.join(OUT, id + '.png') });
  done.push(id + '.png');
}
// visão geral (página inteira)
await page.screenshot({ path: path.join(OUT, '00-overview.png'), fullPage: true });
done.unshift('00-overview.png');
// preview-board único exigido pelo owner (mesma imagem da visão geral, nome dedicado)
fs.copyFileSync(path.join(OUT, '00-overview.png'), path.join(OUT, 'F3.3.0-mockups-preview-board.png'));
done.unshift('F3.3.0-mockups-preview-board.png');

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), shots: done, pageErrors: errors }, null, 2));
console.log('MOCKUPS GERADOS:', JSON.stringify(done, null, 2));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));

await browser.close(); server.close();
if (!done.length) { console.error('::error::nenhum mockup gerado'); process.exit(1); }
if (errors.length) { console.error('::error::erro de runtime no mock'); process.exit(1); }
console.log('OK — ' + done.length + ' PNGs em desktop/sla-mockups-out/');
