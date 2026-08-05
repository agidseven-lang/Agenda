/* Bateria comportamental do núcleo RTE — roda no Chromium real. */
(function(){
  var R=[],F=0;
  function ok(name,cond,extra){R.push((cond?'PASS':'FAIL')+' '+name+(cond?'':(' :: '+(extra||''))));if(!cond)F++;}
  function eq(name,got,want){ok(name,got===want,'got='+JSON.stringify(got)+' want='+JSON.stringify(want));}
  function fix(name,x){var a=rteSanitize(x);var b=rteSanitize(a);ok('fixpoint '+name,a===b,'1st='+JSON.stringify(a)+' 2nd='+JSON.stringify(b));return a;}

  /* A — payloads maliciosos ficam INERTES (conteúdo executável some COM o corpo) */
  eq('A1 script drop', rteSanitize('<script>alert(1)<\/script>Hello'), '<p>Hello</p>');
  var a2=rteSanitize('<img src=x onerror=alert(1)>txt'); ok('A2 img drop', a2==='<p>txt</p>', a2);
  eq('A3 iframe drop', rteSanitize('<iframe src="https://x"></iframe>ok'), '<p>ok</p>');
  eq('A4 javascript: URL', rteSanitize('<a href="javascript:alert(1)">click</a>'), '<p>click</p>');
  eq('A5 on* strip + rel/target forçados', rteSanitize('<a href="https://ok.com" onclick="x()">go</a>'),
     '<p><a href="https://ok.com" rel="noopener noreferrer" target="_blank">go</a></p>');
  eq('A6 style/on* em bloco', rteSanitize('<p style="background:url(javascript:x)" onmouseover="h()">t</p>'), '<p>t</p>');
  eq('A7 form/input drop', rteSanitize('<form action=x><input value=v></form>after'), '<p>after</p>');
  eq('A8 object/embed drop', rteSanitize('<object data=x>o</object><embed src=y>e'), '<p>e</p>');
  eq('A9 svg drop', rteSanitize('<svg onload=alert(1)><circle></circle></svg>sv'), '<p>sv</p>');
  eq('A10 style attr some', rteSanitize('<div style="position:fixed;top:0">t</div>'), '<p>t</p>');
  ok('A11 data-url img', rteSanitize('<img src="data:text/html,<script>1<\/script>">x').indexOf('<img')<0, 'img sobreviveu');
  eq('A12 video/audio drop', rteSanitize('<video src=v></video><audio src=a></audio>fim'), '<p>fim</p>');
  eq('A13 meta/link drop', rteSanitize('<link rel=stylesheet href=x><meta http-equiv=refresh content=0>m'), '<p>m</p>');
  eq('A14 template drop', rteSanitize('<template><script>1<\/script></template>tp'), '<p>tp</p>');
  ok('A15 href http só', rteSanitize('<a href="ftp://x">f</a><a href="file:///c">g</a>')==='<p>fg</p>', rteSanitize('<a href="ftp://x">f</a><a href="file:///c">g</a>'));

  /* B — colagem Word/Docs */
  eq('B1 mso limpo', rteSanitize('<p class="MsoNormal" style="mso-margin-top-alt:auto"><b>Bold</b> rest</p>'), '<p><strong>Bold</strong> rest</p>');
  eq('B2 margem Word→recuo', rteSanitize('<p style="margin-left:36pt">ind</p>'), '<p data-ind="1">ind</p>');
  eq('B3 lista aninhada achatada', rteSanitize('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>'), '<ul><li>a</li><li>b</li><li>c</li></ul>');
  eq('B4 parágrafo ATÔMICO em div', rteSanitize('<div><p><b>a</b> b</p></div>'), '<p><strong>a</strong> b</p>');
  eq('B5 run inline funde', rteSanitize('hello <b>x</b> world'), '<p>hello <strong>x</strong> world</p>');
  eq('B6 br topo', rteSanitize('a<br><br>b'), '<p>a</p><p><br></p><p>b</p>');
  eq('B7 i/em/u/s/del', rteSanitize('<i>a</i><em>b</em><u>c</u><strike>d</strike><del>e</del>'), '<p><em>a</em><em>b</em><u>c</u><s>d</s><s>e</s></p>');
  eq('B8 h1/h2→h3 h5→h4', rteSanitize('<h1>A</h1><h2>B</h2><h5>C</h5>'), '<h3>A</h3><h3>B</h3><h4>C</h4>');
  eq('B9 blockquote→recuo', rteSanitize('<blockquote><p>q</p></blockquote>'), '<p data-ind="1">q</p>');
  eq('B10 tabela→parágrafos', rteSanitize('<table><tr><td>c1</td><td>c2</td></tr></table>'), '<p>c1</p><p>c2</p>');
  eq('B11 font color legado', rteSanitize('<font color="#F87171">c</font>'), '<p><span data-cl="1">c</span></p>');
  eq('B12 span cor exata', rteSanitize('<span style="color:#f87171">c</span>'), '<p><span data-cl="1">c</span></p>');
  eq('B13 cor fora da paleta cai', rteSanitize('<span style="color:#123456">c</span>'), '<p>c</p>');
  eq('B14 marca-texto', rteSanitize('<span style="background-color:#FEF08A">h</span>'), '<p><span data-hl="1">h</span></p>');
  eq('B15 token de tamanho', rteSanitize('<span style="font-family:rte-fs-l">big</span>'), '<p><span data-fs="l">big</span></p>');
  eq('B16 token m = normal', rteSanitize('<span style="font-family:rte-fs-m">n</span>'), '<p>n</p>');
  eq('B17 o:p desconhecido vira texto', rteSanitize('<p>x<o:p></o:p>y</p>'), '<p>xy</p>');
  eq('B18 Docs bold (span font-weight:700)', rteSanitize('<span style="font-weight:700">n</span>'), '<p><strong>n</strong></p>');
  eq('B19 Docs italic+underline', rteSanitize('<span style="font-style:italic;text-decoration:underline">x</span>'), '<p><em><u>x</u></em></p>');
  eq('B20 Docs strike', rteSanitize('<span style="text-decoration:line-through">r</span>'), '<p><s>r</s></p>');
  eq('B21 Docs bold+cor da paleta', rteSanitize('<span style="font-weight:bold;color:#F87171">c</span>'), '<p><span data-cl="1"><strong>c</strong></span></p>');
  eq('B23 engine anexa cor ao <b> (F3.5.5C stWrap)', rteSanitize('<p><b style="color: rgb(248, 113, 113);">Tema</b></p>'), '<p><span data-cl="1"><strong>Tema</strong></span></p>');
  eq('B24 fundo de paleta no <u>', rteSanitize('<u style="background-color:#FEF08A">m</u>'), '<p><span data-hl="1"><u>m</u></span></p>');
  ok('B22 fixpoint dos mapeados', ['<p><strong>n</strong></p>','<p><em><u>x</u></em></p>','<p><span data-cl="1"><strong>c</strong></span></p>'].every(function(c){return rteSanitize(c)===c;}), 'não-fixpoint');

  /* C — precedência do gesto vivo sobre atributo canônico velho */
  eq('C1 style align vence data-al', rteSanitize('<p style="text-align:center" data-al="r">x</p>'), '<p data-al="c">x</p>');
  eq('C2 left explícito LIMPA', rteSanitize('<p style="text-align:left" data-al="c">x</p>'), '<p>x</p>');
  eq('C3 margem viva vence data-ind', rteSanitize('<p data-ind="2" style="margin-left:40px">x</p>'), '<p data-ind="1">x</p>');
  eq('C4 outdent a zero', rteSanitize('<p data-ind="2" style="margin-left:0px">x</p>'), '<p>x</p>');
  eq('C5 data-al canônico mantido', rteSanitize('<p data-al="j">x</p>'), '<p data-al="j">x</p>');
  eq('C6 data-ind canônico mantido', rteSanitize('<p data-ind="3">x</p>'), '<p data-ind="3">x</p>');

  /* D — projeção texto (a MESMA do Worker) */
  eq('D1 ul', richToPlain('<ul><li>a</li><li>b</li></ul>'), '• a\n• b');
  eq('D2 ol', richToPlain('<ol><li>a</li><li>b</li></ol>'), '1. a\n2. b');
  eq('D3 hr', richToPlain('<p>a</p><hr><p>b</p>'), 'a\n---\nb');
  eq('D4 vazio', richToPlain('<p><br></p>'), '');
  eq('D5 linha vazia interna', richToPlain('<p>a</p><p><br></p><p>b</p>'), 'a\n\nb');
  eq('D6 br interno', richToPlain('<p>a<br>b</p>'), 'a\nb');
  eq('D7 li vazio', richToPlain('<ul><li><br></li></ul>'), '• ');
  eq('D8 nbsp normalizado', richToPlain('<p>a b</p>'), 'a b');

  /* E — paridade e round-trip */
  ['','a','a\nb','a\n\nb','linha com  espaços','ação & <tag> "q" \'z\''].forEach(function(p,i){
    var r=plainToRich(p);
    eq('E'+(i+1)+' round-trip', richToPlain(r), p);
    ok('E'+(i+1)+' sem formatação', !rteHasFormatting(r,p), 'hasFormatting inesperado');
    if(p){ok('E'+(i+1)+' fixpoint canônico', rteSanitize(r)===r, rteSanitize(r));}
  });
  ok('E7 parity ok exibe', rteDisplayHtml('<p><strong>x</strong></p>','x')!==null,'null');
  ok('E8 parity quebrada NÃO exibe', rteDisplayHtml('<p><strong>x</strong></p>','x editado')===null,'não-null');
  ok('E9 display re-sanitiza', (rteDisplayHtml('<p><strong>x</strong><script>1<\/script></p>','x')||'').indexOf('script')<0,'script vazou');
  ok('E10 hasFormatting bold', rteHasFormatting('<p><strong>x</strong></p>','x')===true,'');

  /* F — fixpoint geral (canônico é ponto fixo; editável re-sanitiza no MESMO canônico) */
  ['<p>Hello</p>','<p><strong>a</strong> b</p>','<ul><li>a</li><li>b</li></ul>',
   '<p data-al="c" data-ind="2">x</p>','<h3>T</h3><p>c</p><hr>',
   '<p><span data-cl="4">c</span><span data-hl="2">h</span><span data-fs="xl">g</span></p>',
   '<p><a href="https://ok.com" rel="noopener noreferrer" target="_blank">go</a></p>',
   '<p>a &amp; b &lt;x&gt; &quot;q&quot; &#39;z&#39;</p>'
  ].forEach(function(c,i){
    ok('F'+(i+1)+' fixpoint', rteSanitize(c)===c, rteSanitize(c));
    ok('F'+(i+1)+' editável→mesmo canônico', rteSanitize(rteEditableHtml(c))===c, rteSanitize(rteEditableHtml(c)));
  });

  /* G — desempenho informativo (50 blocos × 60 sanitizações) */
  var big='';for(var i=0;i<50;i++)big+='<p><strong>Tema '+i+'</strong> com <em>legenda</em> e <span style="color:#F87171">cor</span></p>';
  var t0=performance.now();for(var k=0;k<60;k++)rteSanitize(big);var dt=(performance.now()-t0)/60;
  R.push('INFO perf sanitize 50 blocos: '+dt.toFixed(2)+'ms/rodada');
  ok('G1 perf < 25ms', dt<25, dt.toFixed(2)+'ms');

  console.log(R.join('\n'));
  console.log('SMOKE_DONE '+JSON.stringify({total:R.filter(function(x){return x.indexOf('INFO')!==0;}).length,fail:F}));
})();
