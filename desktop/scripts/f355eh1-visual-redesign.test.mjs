/* F3.5.5E-H1 — Suíte da fase: REDESIGN ULTRA PREMIUM DAS NOTIFICAÇÕES IMEDIATAS (Desktop 1.0.225).
   Contrato VISUAL (conceito A — Compact Enterprise) nas 2 superfícies (toast index.html × janela
   premium bgnotify.html) + PARIDADE byte-a-byte + iconografia do PRÓPRIO icon set + acessibilidade
   + marcadores de que NENHUMA regra funcional da 1.0.224 mudou. Roda contra o FONTE ou contra os
   bytes do app.asar (env SRC=/BG_SRC=/PKG_SRC=). Zero rede; zero Firestore. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p, env) => readFileSync(process.env[env] || path.join(__dirname, p), 'utf8');
const S  = R('../src/renderer/index.html', 'SRC');            // toast (renderer principal)
const BG = R('../src/renderer/bgnotify.html', 'BG_SRC');      // janela premium
const PKG  = R('../package.json', 'PKG_SRC');
const LOCK = R('../package-lock.json', 'LOCK_SRC');

let pass = 0, fail = 0; const bad = [];
function ok(name, cond) { if (cond) { pass++; } else { fail++; bad.push(name); console.error('FAIL: ' + name); } }
function both(name, needle) { ok(name, S.indexOf(needle) >= 0 && BG.indexOf(needle) >= 0); }

/* extrai uma function declaration por brace-matching a partir de 'function NAME(' */
function extract(src, name) {
  const sig = 'function ' + name + '('; const i = src.indexOf(sig);
  if (i < 0) return null;
  let d = 0, started = false, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') { d++; started = true; } else if (c === '}') { d--; if (started && d === 0) { j++; break; } } }
  return src.slice(i, j);
}

/* ============ A. IDENTIDADE 1.0.225 ============ */
console.log('— A) identidade da candidata —');
ok('A1 package.json 1.0.225', /"version":\s*"1\.0\.225"/.test(PKG));
ok('A2 description: marcador da fase + cadeia de bases preservada',
  PKG.indexOf('1.0.225-f355eh1-ultra-premium-notifications') >= 0 &&
  PKG.indexOf('base 1.0.224-f355e-retire-legacy-modules-premium-notifications') >= 0 &&
  PKG.indexOf('base 1.0.223-f355d-custom-cronograma-quantity-universal-paste') >= 0);
ok('A3 package-lock 1.0.225 (2x)', (LOCK.match(/"version":\s*"1\.0\.225"/g) || []).length >= 2);

/* ============ B. CONTRATO CSS (mesmas regras nas DUAS superfícies) ============ */
console.log('— B) contrato CSS do card compacto —');
ok('B1 largura do toast 440px (mandato 420–460) + janela premium fluida',
  S.indexOf('.ntf.ntfp-w{width:440px;max-width:calc(100vw - 36px)}') >= 0 &&
  BG.indexOf('.ntf.ntfp-w{width:100%;max-width:100%}') >= 0);
both('B2 card delega padding ao wrap (gap:0;padding:0)', '.ntf-card.ntfp{gap:0;padding:0}');
both('B3 wrap compacto 12/14 (13 à esq.) + barra lateral 2px por categoria',
  'padding:12px 14px 12px 13px;border-left:2px solid var(--catc,#5B6CFF);border-radius:inherit');
both('B4 header em grid 1fr/auto/auto (eyebrow+hora+fechar)',
  '.ntfp-hd{display:grid;grid-template-columns:1fr auto auto;align-items:center;column-gap:8px;min-width:0}');
ok('B5 eyebrow 12/600 sentence-case (SEM uppercase) com ellipsis', (() => {
  const re = /\.ntfp-eyebrow\{[^}]*\}/;
  const a = (S.match(re) || [''])[0], b = (BG.match(re) || [''])[0];
  const good = (r) => r.indexOf('font-size:12px') >= 0 && r.indexOf('font-weight:600') >= 0
    && r.indexOf('text-overflow:ellipsis') >= 0 && r.indexOf('text-transform') < 0;
  return good(a) && good(b);
})());
both('B6 pastilha do ícone 18×18 com fundo 16% da categoria',
  '.ntfp-ei{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;background:color-mix(in srgb,var(--catc,#5B6CFF) 16%,transparent);color:var(--catc,#5B6CFF)}');
both('B7 svg do ícone 12px', '.ntfp-ei svg{width:12px;height:12px}');
both('B8 hora discreta 11/500 tabular-nums',
  '.ntfp-tm{flex:0 0 auto;color:#8b97a8;font-size:11px;font-weight:500;font-variant-numeric:tabular-nums}');
both('B9 fechar: hit-area 32×32 (margens negativas) + glyph 15 + hover',
  '.ntf-card.ntfp .ntfp-hd .ntf-x{position:static;top:auto;right:auto;flex:0 0 auto;width:32px;height:32px;margin:-7px -9px -7px 0;display:inline-flex;align-items:center;justify-content:center;font-size:15px;color:#7a8598;border-radius:8px;transition:background .18s ease,color .18s ease}');
ok('B10 título 18/700, clamp 2 linhas, contraste máximo', (() => {
  const re = /\.ntfp-task\{[^}]*\}/;
  const a = (S.match(re) || [''])[0], b = (BG.match(re) || [''])[0];
  const good = (r) => r.indexOf('color:#ffffff') >= 0 && r.indexOf('font-size:18px') >= 0
    && r.indexOf('font-weight:700') >= 0 && r.indexOf('-webkit-line-clamp:2') >= 0;
  return good(a) && good(b);
})());
both('B11 cliente em LINHA PRÓPRIA 14/650, 1 linha + ellipsis',
  '.ntfp-client{color:#dbe2f0;font-size:14px;font-weight:650;line-height:1.3;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B12 contexto 12.5/450, 1 linha + ellipsis',
  '.ntfp-ctx{color:#9aa6bd;font-size:12.5px;font-weight:450;margin-top:2px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B13 chips compactos 26px, contorno 1px fraco (30%) + fundo sutil (9%), 12.5/600',
  '.ntfp-chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:12.5px;font-weight:600;line-height:1;border:1px solid color-mix(in srgb,var(--cfg,#cdd6e6) 30%,transparent);background:color-mix(in srgb,var(--cfg,#cdd6e6) 9%,transparent);color:var(--cfg,#cdd6e6);white-space:nowrap}');
both('B14 dot 6px do chip', '.ntfp-chip .cdot{flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:var(--cfg,#cdd6e6)}');
both('B15 seta do fluxo discreta 12/600', '.ntfp-arrow{flex:0 0 auto;color:#7a8598;font-size:12px;font-weight:600}');
both('B16 responsável 12/450, 1 linha + ellipsis',
  '.ntfp-respline{color:#8792a6;font-size:12px;font-weight:450;margin-top:6px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B17 footer estruturado com hairline superior (1px @ .06)',
  '.ntfp-ft{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);min-width:0}');
both('B18 linha do autor 12.5/450 com min-width:0 (trunca sem estourar)',
  '.ntfp-by{display:flex;align-items:center;gap:8px;color:#8792a6;font-size:12.5px;font-weight:450;line-height:1.3;min-width:0;flex:1 1 auto}');
both('B19 avatar 28px metadado com ring neutro 1px',
  '.ntfp-av{flex:0 0 auto;width:28px;height:28px;border-radius:50%;background-size:cover;background-position:center;box-shadow:0 0 0 1px rgba(255,255,255,.14)}');
both('B20 iniciais geradas 11/700 (sem foto)',
  '.ntfp-av.gen{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6D5BFF,#22D3EE);color:#fff;font-weight:700;font-size:11px;letter-spacing:.3px}');
both('B21 texto do autor com ellipsis', '.ntfp-byt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}');
both('B22 CTA ghost 30px compacto ("Abrir tarefa →")',
  '.ntfp-cta{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;border:1px solid rgba(139,162,255,.35);background:rgba(109,91,255,.10);color:#cdd6ff;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .18s ease,border-color .18s ease}');
both('B23 CTA hover sutil (sem glow)', '.ntfp-cta:hover{background:rgba(109,91,255,.20);border-color:rgba(139,162,255,.55)}');
both('B24 foco visível no CTA (teclado)', '.ntfp-cta:focus-visible{outline:2px solid #8FA2FF;outline-offset:2px}');
both('B25 foco visível no fechar (teclado)', '.ntf-x:focus-visible{outline:2px solid #8FA2FF;outline-offset:1px}');
ok('B26 reduced-motion preservado (formas históricas de cada superfície)',
  S.indexOf('@media (prefers-reduced-motion: reduce){.ntf{transition:none}}') >= 0
  && BG.indexOf('@media (prefers-reduced-motion: reduce){ .ntf{transition:none} }') >= 0);
ok('B27 tokens de categoria preservados (8 cores da 1.0.224)',
  ['.cat-blue{--catc:#60A5FA}', '.cat-violet{--catc:#A78BFA}', '.cat-green{--catc:#34D399}', '.cat-amber{--catc:#F59E0B}',
   '.cat-red{--catc:#F87171}', '.cat-orange{--catc:#FB923C}', '.cat-teal{--catc:#22D3B8}', '.cat-neutral{--catc:#8792a6}']
    .every((t) => S.indexOf(t) >= 0 && BG.indexOf(t) >= 0));
ok('B28 tokens de status dos chips preservados (cs-*)',
  ['.cs-afazer{', '.cs-andamento{', '.cs-revisao{', '.cs-concluido{'].every((t) => S.indexOf(t) >= 0 && BG.indexOf(t) >= 0));
ok('B29 animação de entrada preservada (fade+translateY, sem bounce/zoom)',
  S.indexOf('.ntf.in{transform:translateY(0);opacity:1}') >= 0 && S.indexOf('scale(') < 0 || (() => {
    /* scale pode existir em OUTROS componentes do app; restringe a checagem ao bloco .ntf */
    const seg = S.slice(S.indexOf('.ntf{'), S.indexOf('.ntf-card{') + 200);
    return S.indexOf('.ntf.in{transform:translateY(0);opacity:1}') >= 0 && seg.indexOf('scale(') < 0;
  })());

/* ============ C. BUILDERS (paridade + iconografia + variantes + tooltips) ============ */
console.log('— C) builders compartilhados —');
const FNS = ['premiumEvtIcon', 'premiumCommonInner', 'premiumGroupInner', 'premiumAvatar',
  'premiumChip', 'premiumEvtCat', 'premiumByVerb', 'premiumHMOf'];
ok('C1 PARIDADE byte-a-byte das 8 funções (toast × janela premium)',
  FNS.every((f) => { const a = extract(S, f), b = extract(BG, f); return !!a && a === b; }));
const EI = extract(S, 'premiumEvtIcon') || '';
ok('C2 mapa evento→ícone completo (10 eventos + default sino)',
  ['task_assigned:\'send\'', 'task_reassigned:\'send\'', 'designer_assigned:\'send\'', 'task_moved:\'swap\'',
   'task_updated:\'editnote\'', 'task_completed:\'check\'', 'task_reopened:\'revise\'', 'task_canceled:\'ban\'',
   'flow_client_changes:\'chat\'', 'flow_completed:\'check\''].every((t) => EI.indexOf(t) >= 0)
  && EI.indexOf("||'bell'") >= 0);
ok('C3 ícones do PRÓPRIO icon set do app (cada path do builder existe também no registro ICON do index)',
  (() => { const ds = [...EI.matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
    return ds.length >= 10 && ds.every((d) => S.split(d).length - 1 >= 2); })());
ok('C4 svg stroke currentColor + viewBox 24 (herda cor da categoria)',
  EI.indexOf('viewBox="0 0 24 24"') >= 0 && EI.indexOf('stroke="currentColor"') >= 0 && EI.indexOf('aria-hidden="true"') >= 0);
ok('C5 NENHUM emoji nos builders (iconografia é svg do set)',
  FNS.every((f) => !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(extract(S, f) || '')));

/* sandbox de execução REAL (mesmas funções extraídas do fonte) */
const BCTX = {}; vm.createContext(BCTX);
vm.runInContext([
  extract(BG, 'esc'), extract(BG, 'initials'),
  extract(BG, 'premiumSevIcon'), extract(BG, 'premiumHM'), extract(BG, 'premiumGroupAction'),
  extract(S, 'premiumChip'), extract(S, 'premiumAvatar'), extract(S, 'premiumEvtCat'),
  extract(S, 'premiumByVerb'), extract(S, 'premiumHMOf'), extract(S, 'premiumEvtIcon'),
  extract(S, 'premiumCommonInner'), extract(S, 'premiumGroupInner'),
].join('\n'), BCTX);
const render = (p) => vm.runInContext('premiumCommonInner(' + JSON.stringify(p) + ')', BCTX);
const LONG = 'Miercohévisk Niheb Ferreira Nascimento Carlôto';
const basePay = { eventType: 'task_moved', title: 'Tarefa movimentada', taskTitle: 'TEMAS',
  clientName: 'ULTRA', sectorLabel: 'Cronograma', cronContext: 'Cronograma mensal • 12 temas',
  fromStatus: 'andamento', toStatus: 'revisao', actorName: LONG, responsibleName: LONG,
  createdAt: new Date(2026, 0, 1, 20, 30).getTime(), severity: 'info' };
const H = render(basePay);

ok('C6 header: pastilha+eyebrow → hora → fechar (ordem no DOM)',
  (() => { const a = H.indexOf('ntfp-hd'), b = H.indexOf('ntfp-ei'), c = H.indexOf('ntfp-eyebrow'),
    d = H.indexOf('ntfp-tm'), e = H.indexOf('ntf-x');
    return a >= 0 && c > a && b > c && d > b && e > d; })());
ok('C7 eyebrow sentence-case do EVENTO + hora do evento 20:30',
  H.indexOf('Tarefa movimentada') >= 0 && H.indexOf('>20:30<') >= 0);
ok('C8 fechar com title + aria-label (hit 32 garantido pelo CSS B9)',
  H.indexOf('<button class="ntf-x" title="Fechar" aria-label="Fechar notificação">×</button>') >= 0);
ok('C9 título com tooltip do texto completo', H.indexOf('<div class="ntfp-task" title="TEMAS">TEMAS</div>') >= 0);
ok('C10 cliente em linha própria com tooltip', H.indexOf('<div class="ntfp-client" title="ULTRA">ULTRA</div>') >= 0);
ok('C11 contexto Cronograma EXATO (legado) com tooltip',
  H.indexOf('<div class="ntfp-ctx" title="Cronograma mensal • 12 temas">Cronograma mensal • 12 temas</div>') >= 0);
ok('C12 chips from→to com aria-label do movimento',
  /ntfp-chips" role="group" aria-label="Movimento de Em andamento para Revisão"/.test(H)
  && H.indexOf('cs-andamento') >= 0 && H.indexOf('cs-revisao') >= 0 && H.indexOf('ntfp-arrow') >= 0);
ok('C13 footer: avatar 28 + "Movimentada por …" com tooltip do nome completo + CTA ghost',
  H.indexOf('class="ntfp-ft"') >= 0 && H.indexOf('class="ntfp-by"') >= 0
  && H.indexOf('title="Movimentada por ' + LONG + '"') >= 0
  && H.indexOf('class="ntfp-cta" role="button" tabindex="0" data-cta="1">Abrir tarefa<span class="car" aria-hidden="true">→</span>') >= 0);
ok('C14 autor==responsável ⇒ SEM linha de responsável', H.indexOf('ntfp-respline') < 0);
const H2 = render({ ...basePay, responsibleName: 'Felipe Teodozio' });
ok('C15 responsável≠autor ⇒ "Responsável · Nome" com tooltip',
  H2.indexOf('title="Responsável: Felipe Teodozio">Responsável · Felipe Teodozio</div>') >= 0);
ok('C16 sem cliente ⇒ fallback discreto "Sem cliente vinculado"',
  render({ ...basePay, clientName: '' }).indexOf('<div class="ntfp-client" title="Sem cliente vinculado">Sem cliente vinculado</div>') >= 0);
ok('C17 cronograma personalizado EXATO (nunca inferir periodicidade)',
  render({ ...basePay, cronContext: 'Cronograma • 7 temas' }).indexOf('>Cronograma • 7 temas</div>') >= 0);
ok('C18 hierarquia vertical: header→título→cliente→contexto→status→footer',
  (() => { let last = -1; return ['ntfp-hd', 'ntfp-task', 'ntfp-client', 'ntfp-ctx', 'ntfp-chips', 'ntfp-ft']
    .every((c) => { const i = H.indexOf(c); const okk = i > last; last = i; return okk; }); })());
ok('C19 XSS: título/cliente maliciosos escapados TAMBÉM nos tooltips',
  (() => { const x = render({ ...basePay, taskTitle: '<img src=x onerror=alert(1)>"', clientName: '"><script>x</script>' });
    return x.indexOf('<img src=x') < 0 && x.indexOf('<script>') < 0
      && x.indexOf('&lt;img') >= 0 && x.indexOf('&quot;&gt;&lt;script&gt;') >= 0; })());

/* variantes (8 do mandato) — ícone certo + categoria presente */
const VAR = [
  ['task_assigned', 'M21 3 11 13'], ['designer_assigned', 'M21 3 11 13'], ['task_moved', 'M7 7h11l-3-3'],
  ['task_updated', 'M14.5 3 21 9.5'], ['task_completed', 'M4 12.5l5 5 11-11'], ['task_reopened', 'M3.5 7.5h12'],
  ['task_canceled', 'M6.2 6.2l11.6 11.6'], ['flow_client_changes', 'M4 5h16v11H8l-4 3z'],
  ['flow_completed', 'M4 12.5l5 5 11-11'], ['evento_desconhecido', 'M18 8.5a6 6 0 1 0-12 0'],
];
for (const [et, d] of VAR) {
  const h = render({ ...basePay, eventType: et, fromStatus: '', toStatus: '' });
  ok('C20 variante ' + et + ' com ícone do set (' + d.slice(0, 12) + '…) + categoria', h.indexOf(d) >= 0 && /cat-(blue|violet|green|amber|red|orange|teal|neutral)/.test(h));
}

/* grupo (rajada) — mesma cabeça nova + lista intocada + footer */
const G = vm.runInContext('premiumGroupInner(' + JSON.stringify({ severity: 'info', count: 3, taskTitle: 'TEMAS',
  primaryName: LONG, primaryAvatar: '', items: [{ actorName: 'Ana', title: 'Tarefa movimentada' },
  { actorName: 'Bia', title: 'Tarefa atualizada' }], extraCount: 1 }) + ')', BCTX);
ok('C21 grupo: wrap cat-neutral + header novo (eyebrow "3 atualizações" + hora + fechar)',
  G.indexOf('ntfp-wrap cat-neutral') >= 0 && G.indexOf('3 atualizações') >= 0 && G.indexOf('ntfp-tm') >= 0 && G.indexOf('ntf-x') >= 0);
ok('C22 grupo: lista de itens preservada + "+1 outras atualizações"',
  G.indexOf('ntfp-glist') >= 0 && G.indexOf('<b>Ana</b>') >= 0 && G.indexOf('+1 outras atualizações') >= 0);
ok('C23 grupo: footer estruturado com autor + CTA (paridade com card comum)',
  G.indexOf('class="ntfp-ft"') >= 0 && G.indexOf('data-cta="1"') >= 0 && G.indexOf('title="' + LONG + '"') >= 0);
ok('C24 grupo: título com tooltip', G.indexOf('<div class="ntfp-task" title="TEMAS">TEMAS</div>') >= 0);

/* ============ D. REGRAS FUNCIONAIS DA 1.0.224 INTOCADAS (marcadores) ============ */
console.log('— D) regras funcionais congeladas —');
ok('D1 gate premiumUse byte-idêntico nas 2 superfícies', (() => { const a = extract(S, 'premiumUse'); return !!a && a === extract(BG, 'premiumUse'); })());
ok('D2 clique/teclado no CTA via [data-cta] preservado (2 superfícies)',
  S.indexOf("closest('[data-cta]')") >= 0 && BG.indexOf("closest('[data-cta]')") >= 0);
both('D3 teclado Enter/Espaço preservado', "el.addEventListener('keydown',function(ev){ try{ var k=ev.key; if(k!=='Enter'&&k!==' ')return;");
ok('D4 aria-live polite único por superfície',
  S.indexOf("s.setAttribute('role','status'); s.setAttribute('aria-live','polite');") >= 0
  && BG.indexOf('<div id="stack" role="status" aria-live="polite">') >= 0);
ok('D5 fila do toast preservada (cap 4)', S.indexOf('if(all.length>4){ for(var i=0;i<all.length-4;i++)') >= 0);
ok('D6 fila da janela premium preservada (cap 5)', BG.indexOf('while(stack.children.length>5){ stack.removeChild(stack.firstChild); }') >= 0);
ok('D7 dedup NOTIF_SEEN preservado', S.indexOf('NOTIF_SEEN') >= 0);
ok('D8 histórico do sino preservado', S.indexOf('notifHistoryAppend(p)') >= 0);
ok('D9 autoridade de som do toast intacta (1.0.216)', S.indexOf("if(p.sound!==false){ var _sr=notifSound(sev);") >= 0);
ok('D10 autoridade de som da janela premium intacta (1.0.216)', BG.indexOf('function bgSound(sev)') >= 0);
ok('D11 CSP da janela premium intacta', BG.indexOf('<meta http-equiv="Content-Security-Policy" content="default-src \'none\';') >= 0);
ok('D12 builders nunca expõem conteúdo privado (tema/legenda/notas/token)',
  FNS.every((f) => { const t = extract(S, f) || ''; return t.indexOf('legenda') < 0 && t.indexOf('designerItemNotes') < 0 && t.indexOf('token') < 0; }));

console.log('===== F3.5.5E-H1 VISUAL-REDESIGN: ' + pass + ' PASS / ' + fail + ' FAIL (total ' + (pass + fail) + ') =====');
if (fail) { console.error('Falhas: ' + bad.join(' | ')); process.exit(1); }
