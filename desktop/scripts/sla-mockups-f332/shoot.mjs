/* F3.3.2 — Renderiza os frames Android (android.html) e exporta 1 PNG por cenário.
 * Mockup ESTÁTICO fiel ao Compose SlaOpPanel (emulador não disponível no CI sandbox);
 * o CÓDIGO Android é real e validado pelo compile-check. Sem rede, sem provider, sem push. */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIR = path.resolve('desktop/scripts/sla-mockups-f332');
const OUT = path.resolve('desktop/sla-f332-out');
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  let f = (req.url || '/').split('?')[0];
  if (f === '/' || f === '') f = '/android.html';
  fs.readFile(path.join(DIR, f), (e, buf) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const baseUrl = `http://127.0.0.1:${server.address().port}/android.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const shots = await page.$$eval('[data-shot]', els => els.map(e => e.getAttribute('data-shot')));
const done = [];
for (const id of shots) {
  const el = await page.$(`[data-shot="${id}"]`);
  if (!el) continue;
  await el.screenshot({ path: path.join(OUT, id + '.png') });
  done.push(id + '.png');
}
await page.screenshot({ path: path.join(OUT, 'and-00-overview.png'), fullPage: true });
done.unshift('and-00-overview.png');
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ generated: new Date().toISOString(), shots: done, pageErrors: errors }, null, 2));
console.log('ANDROID MOCKUPS:', JSON.stringify(done, null, 2));
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close(); server.close();
if (!done.length) { console.error('::error::nenhum frame android gerado'); process.exit(1); }
if (errors.length) { console.error('::error::erro de runtime no mock android'); process.exit(1); }
console.log('OK — ' + done.length + ' PNGs em desktop/sla-f332-out/');
