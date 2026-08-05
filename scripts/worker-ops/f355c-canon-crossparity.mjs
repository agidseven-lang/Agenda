// F3.5.5C — PARIDADE CRUZADA Desktop↔Worker: os canônicos REAIS gerados pelo app EMPACOTADO
// (fixtures exportados pela prova E16) devem ser (1) VÁLIDOS na gramática do Worker e
// (2) projetar EXATAMENTE o mesmo texto (rteWkPlain === richToPlain do Desktop).
// Funções extraídas do cloudflare-worker.js REAL (WSRC=) e fixtures de FIXT=.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WSRC = process.env.WSRC ? path.resolve(process.env.WSRC) : path.join(HERE, '..', '..', 'cloudflare-worker.js');
const FIXT = process.env.FIXT ? path.resolve(process.env.FIXT) : path.join(HERE, '..', '..', 'docs', 'f355c-qa', 'f355c-canon-fixtures.json');
const src = fs.readFileSync(WSRC, 'utf8');

function seg(a, b, name) {
  const i = src.indexOf(a); if (i < 0) throw new Error('A? ' + name);
  const j = src.indexOf(b, i + a.length); if (j < 0) throw new Error('B? ' + name);
  return src.slice(i, j);
}
const escFn = seg('function escapeHtml(s)', '/* ═══ F3.5.5C', 'escapeHtml');
const mod = seg('const RTE_WK', 'function frequencyLabel', 'módulo RTE_WK');
const ctx = {};
vm.createContext(ctx);
new vm.Script(escFn + '\n' + mod, { filename: 'rtewk.js' }).runInContext(ctx);

const fixtures = JSON.parse(fs.readFileSync(FIXT, 'utf8'));
if (!Array.isArray(fixtures) || fixtures.length < 10) { console.log('FALHOU: fixtures insuficientes (' + (fixtures && fixtures.length) + ')'); process.exit(1); }

let fails = 0;
fixtures.forEach((f, i) => {
  const canon = String(f.canon || ''); const plain = String(f.plain == null ? '' : f.plain);
  if (canon === '') { console.log('  ✓ fixture ' + (i + 1) + ': canônico vazio (entrada 100% descartada) — nada a validar'); return; }
  const valid = ctx.rteWkValid(canon);
  const proj = valid ? ctx.rteWkPlain(canon) : null;
  const ok = valid === true && proj === plain;
  console.log((ok ? '  ✓' : '  ✗') + ' fixture ' + (i + 1) + ': valid=' + valid + (ok ? '' : ' proj=' + JSON.stringify(proj) + ' esperado=' + JSON.stringify(plain) + ' canon=' + canon.slice(0, 80)));
  if (!ok) fails++;
});
console.log('F3.5.5C canon-crossparity: ' + (fixtures.length - fails) + '/' + fixtures.length + (fails ? ' — FALHOU' : ' — VERDE'));
process.exit(fails ? 1 : 0);
