// F3.5.5C — validador/projeção RTE do PORTAL (funções REAIS extraídas do cloudflare-worker.js).
// Gramática canônica fail-closed + projeção idêntica à do Desktop + paridade + limites.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const SRC = process.env.WSRC ? path.resolve(process.env.WSRC) : path.join(HERE, '..', '..', 'cloudflare-worker.js');
const src = fs.readFileSync(SRC, 'utf8');

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
const { rteWkValid, rteWkPlain, rteWkDisplay, rteWkInline, rteWkAttrPlain } = ctx;

let F = 0, N = 0;
function ok(name, cond, extra) { N++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' :: ' + (extra || ''))); if (!cond) F++; }

/* A — canônicos REAIS do Desktop (mesmas strings asseridas no smoke Electron 84/84) */
const GOOD = [
  ['<p>Hello</p>', 'Hello'],
  ['<p><strong>a</strong> b</p>', 'a b'],
  ['<p><em>a</em><em>b</em><u>c</u><s>d</s><s>e</s></p>', 'abcde'],
  ['<ul><li>a</li><li>b</li></ul>', '• a\n• b'],
  ['<ol><li>a</li><li>b</li></ol>', '1. a\n2. b'],
  ['<p data-al="c" data-ind="2">x</p>', 'x'],
  ['<p data-ind="1">ind</p>', 'ind'],
  ['<h3>T</h3><p>c</p><hr>', 'T\nc\n---'],
  ['<h3>A</h3><h3>B</h3><h4>C</h4>', 'A\nB\nC'],
  ['<p><span data-cl="4">c</span><span data-hl="2">h</span><span data-fs="xl">g</span></p>', 'chg'],
  ['<p><span data-cl="1" data-hl="1" data-fs="s">t</span></p>', 't'],
  ['<p><a href="https://ok.com" rel="noopener noreferrer" target="_blank">go</a></p>', 'go'],
  ['<p>a &amp; b &lt;x&gt; &quot;q&quot; &#39;z&#39;</p>', 'a & b <x> "q" \'z\''],
  ['<p>a</p><p><br></p><p>b</p>', 'a\n\nb'],
  ['<p>a<br>b</p>', 'a\nb'],
  ['<p><br></p>', ''],
  ['<ul><li><br></li></ul>', '• '],
  ['<p><strong><em><u>mix</u></em></strong><sub>s</sub><sup>p</sup></p>', 'mixsp'],
];
GOOD.forEach(([html, plain], i) => {
  ok('A' + (i + 1) + ' válido', rteWkValid(html) === true, html);
  ok('A' + (i + 1) + ' projeção', rteWkPlain(html) === plain, JSON.stringify(rteWkPlain(html)) + ' ≠ ' + JSON.stringify(plain));
  ok('A' + (i + 1) + ' display', rteWkDisplay(html, plain) === '<div class="rtev">' + html + '</div>', 'display divergiu');
});

/* B — TUDO fora da gramática canônica é rejeitado (fail-closed) */
const BAD = [
  '<script>alert(1)</script>',
  '<p onclick="x()">t</p>',
  '<p style="color:red">t</p>',
  '<img src=x onerror=alert(1)>',
  '<iframe src="https://x"></iframe>',
  '<p><span style="color:red">x</span></p>',
  '<p><span>x</span></p>',
  '<a href="javascript:alert(1)" rel="noopener noreferrer" target="_blank">x</a>',
  '<p><a href="javascript:alert(1)" rel="noopener noreferrer" target="_blank">x</a></p>',
  '<p><a href="https://ok.com">semrel</a></p>',
  '<p><a href="https://a.com" rel="noopener noreferrer" target="_blank"><a href="https://b.com" rel="noopener noreferrer" target="_blank">n</a></a></p>',
  'texto solto',
  '<p>a</p>solto',
  '<p>a',
  '<p></p><li>x</li>',
  '<ul><p>x</p></ul>',
  '<p><p>x</p></p>',
  '<br>',
  '<p><hr></p>',
  '<P>caps</P>',
  '<p data-al="x">t</p>',
  '<p data-ind="7">t</p>',
  '<p data-ind="1" data-al="c">t</p>',
  '<p><span data-cl="9">x</span></p>',
  '<p><span data-fs="m">x</span></p>',
  '<p>raw<tag</p>',
  '<p>um &gt; dois < três</p>',
  '<div>x</div>',
  '<blockquote><p>x</p></blockquote>',
  '<p><b>x</b></p>',
  '<h1>x</h1>',
  '<form action=x><input></form>',
  '<p><svg onload=x></svg></p>',
  '<object data=x>o</object>',
  '<template>x</template>',
];
BAD.forEach((html, i) => ok('B' + (i + 1) + ' rejeitado', rteWkValid(html) === false, html));

/* C — paridade obrigatória: texto divergente NUNCA exibe rico */
ok('C1 paridade quebrada', rteWkDisplay('<p><strong>x</strong></p>', 'x editado') === null, '');
ok('C2 rico vazio', rteWkDisplay('', 'x') === null, '');
ok('C3 rico não-string', rteWkDisplay({}, 'x') === null, '');
ok('C4 inline single-p', rteWkInline('<p><strong>T</strong> ok</p>', 'T ok') === '<span class="rtev"><strong>T</strong> ok</span>', rteWkInline('<p><strong>T</strong> ok</p>', 'T ok'));
ok('C5 inline multi-bloco nega', rteWkInline('<p>a</p><p>b</p>', 'a\nb') === null, '');
ok('C6 inline com attrs nega', rteWkInline('<p data-al="c">a</p>', 'a') === null, '');
ok('C7 attr plain escapa quebras', rteWkAttrPlain('a\nb"c') === 'a&#10;b&quot;c', rteWkAttrPlain('a\nb"c'));

/* D — DoS bound */
ok('D1 tamanho excessivo rejeita', rteWkValid('<p>' + 'a'.repeat(130000) + '</p>') === false, '');

console.log('F3.5.5C rte-worker-validator: ' + (N - F) + ' OK, ' + F + ' FAIL');
process.exit(F ? 1 : 0);
