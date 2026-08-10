/* F3.5.5E-H2 — Suíte da fase: NOTIFICAÇÃO PREMIUM EXATAMENTE NA REFERÊNCIA DO OWNER (Desktop 1.0.226).
   Contrato ESTRUTURAL da referência (avatar circular FLUTUANTE parcialmente fora do card; superfície
   radius 24 sem barra lateral; área superior limpa; corpo com respiro; CÁPSULA horizontal inferior com
   status integrado + SEGMENTO direito colorido = CTA) nas 2 superfícies + PARIDADE byte-a-byte +
   iconografia do PRÓPRIO icon set + acessibilidade + marcadores de que NENHUMA regra funcional mudou.
   Substitui no verify a suíte f355eh1 (contrato do design REPROVADO pelo owner — arquivo preservado
   byte-idêntico como artefato histórico, fora do verify, precedente F3.5.5E/f355c).
   Roda contra o FONTE ou contra os bytes do app.asar (env SRC=/BG_SRC=/PKG_SRC=). Zero rede. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p, env) => readFileSync(process.env[env] || path.join(__dirname, p), 'utf8');
const S  = R('../src/renderer/index.html', 'SRC');
const BG = R('../src/renderer/bgnotify.html', 'BG_SRC');
const PKG  = R('../package.json', 'PKG_SRC');
const LOCK = R('../package-lock.json', 'LOCK_SRC');

let pass = 0, fail = 0; const bad = [];
function ok(name, cond) { if (cond) { pass++; } else { fail++; bad.push(name); console.error('FAIL: ' + name); } }
function both(name, needle) { ok(name, S.indexOf(needle) >= 0 && BG.indexOf(needle) >= 0); }
function extract(src, name) {
  const sig = 'function ' + name + '('; const i = src.indexOf(sig);
  if (i < 0) return null;
  let d = 0, started = false, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') { d++; started = true; } else if (c === '}') { d--; if (started && d === 0) { j++; break; } } }
  return src.slice(i, j);
}

/* ============ A. IDENTIDADE (RE-PINADO F3.5.6A-H2: candidata 1.0.243; contrato VISUAL da referência CONGELADO) ============ */
console.log('— A) identidade da candidata —');
ok('A1 package.json 1.0.243 (RE-PINADO F3.5.6A-H2)', /"version":\s*"1\.0\.243"/.test(PKG));
ok('A2 description: marcador da fase + cadeia de bases preservada',
  PKG.indexOf('1.0.226-f355eh2-reference-notification') >= 0 &&
  PKG.indexOf('base 1.0.225-f355eh1-ultra-premium-notifications') >= 0 &&
  PKG.indexOf('base 1.0.224-f355e-retire-legacy-modules-premium-notifications') >= 0 &&
  PKG.indexOf('base 1.0.223-f355d-custom-cronograma-quantity-universal-paste') >= 0);
ok('A3 package-lock 1.0.243 (2x — RE-PINADO F3.5.6A-H2)', (LOCK.match(/"version":\s*"1\.0\.243"/g) || []).length >= 2);

/* ============ B. CONTRATO CSS DA REFERÊNCIA (2 superfícies) ============ */
console.log('— B) contrato CSS da referência —');
ok('B1 largura 450 (mandato 430–470) + headroom do avatar; janela premium fluida com o mesmo headroom',
  S.indexOf('.ntf.ntfp-w{width:450px;max-width:calc(100vw - 36px);padding-top:26px;overflow:visible}') >= 0 &&
  BG.indexOf('.ntf.ntfp-w{width:100%;max-width:100%;padding-top:26px;overflow:visible}') >= 0);
both('B2 card base neutralizado (superfície é o wrap; overflow visível p/ o avatar)',
  '.ntf-card.ntfp{gap:0;padding:0;background:transparent;border:0;box-shadow:none;overflow:visible;border-radius:26px}');
both('B3 SEM barra lateral (::before desligado)', '.ntf-card.ntfp::before{display:none}');
both('B4 superfície da referência: radius 24, borda 1px discreta, sombra profunda suave, respiro 18/18/16',
  '.ntfp-wrap{position:relative;display:flex;flex-direction:column;min-width:0;width:100%;background:linear-gradient(180deg,#151D30,#101726);border:1px solid rgba(139,162,255,.14);border-radius:24px;box-shadow:0 24px 56px -20px rgba(0,0,0,.78),inset 0 1px 0 rgba(255,255,255,.05);padding:18px 18px 16px}');
both('B5 AVATAR FLUTUANTE: absoluto no topo-esq (−24px), ring 2px em gradiente azul→violeta, sombra leve, micro-scale',
  '.ntfp-fl{position:absolute;top:-24px;left:18px;z-index:2;padding:2px;border-radius:50%;background:linear-gradient(135deg,#5B6CFF,#A78BFA);box-shadow:0 10px 22px -10px rgba(0,0,0,.7);transform:scale(.98);transition:transform .18s ease}');
both('B5b micro-scale de entrada (.98→1, sem bounce)', '.ntf.in .ntfp-fl{transform:scale(1)}');
both('B6 avatar 62px (mandato 58–72) com anel interno de recorte',
  '.ntfp-fl .ntfp-av{width:62px;height:62px;box-shadow:0 0 0 2px rgba(16,23,38,.92)}');
both('B6b iniciais grandes no avatar flutuante', '.ntfp-fl .ntfp-av.gen{font-size:22px;letter-spacing:.5px}');
both('B7 cabeçalho à direita do avatar (flex; margem 72px)',
  '.ntfp-hd{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-left:72px;min-width:0}');
ok('B8 eyebrow 12/600 sentence-case (SEM uppercase) + ícone do evento inline 14/13 sem fundo', (() => {
  const re = /\.ntfp-eyebrow\{[^}]*\}/;
  const g = (r) => r.indexOf('font-size:12px') >= 0 && r.indexOf('font-weight:600') >= 0 && r.indexOf('text-transform') < 0;
  return g((S.match(re) || [''])[0]) && g((BG.match(re) || [''])[0])
    && S.indexOf('.ntfp-ei svg{width:13px;height:13px}') >= 0 && BG.indexOf('.ntfp-ei svg{width:13px;height:13px}') >= 0;
})());
both('B9 hora 11.5/500 tabular-nums',
  '.ntfp-tm{flex:0 0 auto;color:#8b97a8;font-size:11.5px;font-weight:500;font-variant-numeric:tabular-nums}');
both('B10 fechar: hit-area 32×32 estático, sem competir com a hora',
  '.ntf-card.ntfp .ntf-x{position:static;top:auto;right:auto;flex:0 0 auto;width:32px;height:32px;margin:-8px -10px -8px 0;display:inline-flex;align-items:center;justify-content:center;font-size:15px;color:#7a8598;border:0;border-radius:10px;background:transparent;cursor:pointer;transition:background .18s ease,color .18s ease}');
both('B10b foco visível no fechar', '.ntf-x:focus-visible{outline:2px solid #8FA2FF;outline-offset:1px}');
ok('B11 título 18/700 clamp-2 com respiro (mt16)', (() => {
  const re = /\.ntfp-task\{[^}]*\}/;
  const g = (r) => r.indexOf('font-size:18px') >= 0 && r.indexOf('font-weight:700') >= 0 && r.indexOf('margin-top:16px') >= 0 && r.indexOf('-webkit-line-clamp:2') >= 0;
  return g((S.match(re) || [''])[0]) && g((BG.match(re) || [''])[0]);
})());
both('B12 cliente 14/650, 1 linha + ellipsis',
  '.ntfp-client{color:#dbe2f0;font-size:14px;font-weight:650;line-height:1.3;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B13 contexto 12.5/450, 1 linha + ellipsis',
  '.ntfp-ctx{color:#9aa6bd;font-size:12.5px;font-weight:450;margin-top:3px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B14 autor como metadata 12/450, 1 linha + ellipsis',
  '.ntfp-meta{color:#8792a6;font-size:12px;font-weight:450;margin-top:9px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B15 responsável 12/450, 1 linha + ellipsis',
  '.ntfp-respline{color:#8792a6;font-size:12px;font-weight:450;margin-top:3px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B16 CÁPSULA inferior: pill 40px, radius 999, borda/fundo sutis, hover discreto',
  '.ntfp-pill{display:flex;align-items:stretch;margin-top:14px;min-height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.045);overflow:hidden;cursor:pointer;transition:border-color .18s ease,background .18s ease}');
both('B16b foco visível na cápsula (teclado)', '.ntfp-pill:focus-visible{outline:2px solid #8FA2FF;outline-offset:2px}');
ok('B17 lado esquerdo da cápsula: 12.5/600 + label com ellipsis + dot 7px (cor do estado OU da categoria) + destino claro',
  ['.ntfp-pl{flex:1 1 auto;display:flex;align-items:center;gap:8px;min-width:0;padding:0 14px;color:#cdd6e6;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden}',
   '.ntfp-pl .plab{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
   '.ntfp-pl .cdot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--cfg,var(--catc,#8FA2FF))}',
   '.ntfp-pl .pto{color:#eef2f8}'].every((t) => S.indexOf(t) >= 0 && BG.indexOf(t) >= 0));
both('B18 SEGMENTO direito colorido (cor contextual do evento) com texto de alto contraste = CTA',
  '.ntfp-pr{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:0 18px;background:var(--catc,#6D5BFF);color:#0E1424;font-size:12.5px;font-weight:650;white-space:nowrap}');
ok('B19 reduced-motion cobre card e avatar flutuante (formas de cada superfície)',
  S.indexOf('@media (prefers-reduced-motion: reduce){.ntf{transition:none}.ntfp-fl{transform:none;transition:none}}') >= 0 &&
  BG.indexOf('@media (prefers-reduced-motion: reduce){ .ntf{transition:none} .ntfp-fl{transform:none;transition:none} }') >= 0);
ok('B20 tokens de categoria e status preservados (1.0.224)',
  ['.cat-blue{--catc:#60A5FA}', '.cat-violet{--catc:#A78BFA}', '.cat-green{--catc:#34D399}', '.cat-amber{--catc:#F59E0B}',
   '.cat-red{--catc:#F87171}', '.cat-orange{--catc:#FB923C}', '.cat-teal{--catc:#22D3B8}', '.cat-neutral{--catc:#8792a6}',
   '.cs-afazer{', '.cs-andamento{', '.cs-revisao{', '.cs-concluido{'].every((t) => S.indexOf(t) >= 0 && BG.indexOf(t) >= 0));
both('B21 lista do grupo preservada', '.ntfp-glist{margin-top:12px;display:flex;flex-direction:column;gap:4px}');

/* ============ C. BUILDERS (paridade + referência no DOM + variantes) ============ */
console.log('— C) builders compartilhados —');
const FNS = ['premiumEvtIcon', 'premiumCommonInner', 'premiumGroupInner', 'premiumAvatar',
  'premiumChip', 'premiumEvtCat', 'premiumByVerb', 'premiumHMOf', 'premiumUse'];
ok('C1 PARIDADE byte-a-byte das 9 funções (toast × janela premium)',
  FNS.every((f) => { const a = extract(S, f), b = extract(BG, f); return !!a && a === b; }));
const EI = extract(S, 'premiumEvtIcon') || '';
ok('C2 mapa evento→ícone completo (10 eventos + default sino) do PRÓPRIO icon set',
  ['task_assigned:\'send\'', 'task_moved:\'swap\'', 'task_updated:\'editnote\'', 'task_completed:\'check\'',
   'task_reopened:\'revise\'', 'task_canceled:\'ban\'', 'flow_client_changes:\'chat\'', 'flow_completed:\'check\'']
    .every((t) => EI.indexOf(t) >= 0) && EI.indexOf("||'bell'") >= 0
  && (() => { const ds = [...EI.matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
      return ds.length >= 10 && ds.every((d) => S.split(d).length - 1 >= 2); })());
ok('C3 NENHUM emoji nos builders',
  FNS.every((f) => !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(extract(S, f) || '')));

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

ok('C4 composição da referência (ordem DOM): avatar flutuante → cabeçalho → título → cliente → contexto → autor → cápsula',
  (() => { let last = -1; return ['ntfp-fl', 'ntfp-hd', 'ntfp-task', 'ntfp-client', 'ntfp-ctx', 'ntfp-meta', 'ntfp-pill']
    .every((c) => { const i = H.indexOf(c); const okk = i > last; last = i; return okk; }); })());
ok('C5 avatar flutuante embala o premiumAvatar REAL (foto/iniciais congeladas)',
  /<div class="ntfp-fl" aria-hidden="true"><div class="ntfp-av/.test(H));
ok('C6 cabeçalho: ícone do evento + tipo + hora 20:30 + fechar com aria-label',
  H.indexOf('ntfp-eyebrow') >= 0 && H.indexOf('ntfp-ei') >= 0 && H.indexOf('Tarefa movimentada') >= 0
  && H.indexOf('>20:30<') >= 0 && H.indexOf('<button class="ntf-x" title="Fechar" aria-label="Fechar notificação">×</button>') >= 0);
ok('C7 tooltips completos (título/cliente/contexto/autor)',
  H.indexOf('<div class="ntfp-task" title="TEMAS">TEMAS</div>') >= 0
  && H.indexOf('<div class="ntfp-client" title="ULTRA">ULTRA</div>') >= 0
  && H.indexOf('<div class="ntfp-ctx" title="Cronograma mensal • 12 temas">Cronograma mensal • 12 temas</div>') >= 0
  && H.indexOf('title="Movimentada por ' + LONG + '"') >= 0);
ok('C8 CÁPSULA: role/tabindex/data-cta/aria-label + dot do estado origem + transição descrita + destino + SEGMENTO "Abrir →"',
  H.indexOf('<div class="ntfp-pill" role="button" tabindex="0" data-cta="1" aria-label="Abrir tarefa">') >= 0
  && /cdot cs-andamento/.test(H) && /plab" title="De Em andamento para Revisão"/.test(H)
  && /pto">Revisão/.test(H) && H.indexOf('<span class="ntfp-pr">Abrir<span class="car" aria-hidden="true">→</span></span>') >= 0);
ok('C9 UNIDADE visual: sem chips independentes e sem CTA separado (proibições do mandato)',
  H.indexOf('ntfp-chips') < 0 && H.indexOf('ntfp-chip ') < 0 && H.indexOf('ntfp-cta') < 0 && H.indexOf('ntfp-ft') < 0);
ok('C10 autor==responsável ⇒ SEM linha duplicada', H.indexOf('ntfp-respline') < 0);
const H2 = render({ ...basePay, responsibleName: 'Felipe Teodozio' });
ok('C11 responsável distinto: "Responsável · Felipe Teodozio" com tooltip',
  H2.indexOf('title="Responsável: Felipe Teodozio">Responsável · Felipe Teodozio</div>') >= 0);
ok('C12 sem cliente ⇒ fallback discreto',
  render({ ...basePay, clientName: '' }).indexOf('<div class="ntfp-client" title="Sem cliente vinculado">Sem cliente vinculado</div>') >= 0);
ok('C13 cronograma legado/personalizado EXATOS (nunca inferir)',
  render({ ...basePay, cronContext: 'Cronograma • 7 temas' }).indexOf('>Cronograma • 7 temas</div>') >= 0
  && H.indexOf('Cronograma mensal • 12 temas') >= 0);
ok('C14 assigned: ação curta na cápsula (sem transição)',
  (() => { const a = render({ ...basePay, eventType: 'task_assigned', fromStatus: '', toStatus: '', responsibleName: 'Felipe Teodozio' });
    return /plab" title="Atribuída a Felipe Teodozio">Atribuída a Felipe Teodozio/.test(a) && a.indexOf('pto"') < 0; })());
ok('C15 XSS: título/cliente maliciosos escapados TAMBÉM nos tooltips',
  (() => { const x = render({ ...basePay, taskTitle: '<img src=x onerror=alert(1)>"', clientName: '"><script>x</script>' });
    return x.indexOf('<img src=x') < 0 && x.indexOf('<script>') < 0 && x.indexOf('&lt;img') >= 0 && x.indexOf('&quot;&gt;&lt;script&gt;') >= 0; })());
const VAR = [
  ['task_assigned', 'M21 3 11 13'], ['task_moved', 'M7 7h11l-3-3'], ['task_updated', 'M14.5 3 21 9.5'],
  ['task_completed', 'M4 12.5l5 5 11-11'], ['task_reopened', 'M3.5 7.5h12'], ['task_canceled', 'M6.2 6.2l11.6 11.6'],
  ['flow_client_changes', 'M4 5h16v11H8l-4 3z'], ['flow_completed', 'M4 12.5l5 5 11-11'], ['evento_x', 'M18 8.5a6 6 0 1 0-12 0'],
];
for (const [et, d] of VAR) {
  const h = render({ ...basePay, eventType: et, fromStatus: '', toStatus: '' });
  ok('C16 variante ' + et + ': ícone do set + cor contextual + cápsula presente',
    h.indexOf(d) >= 0 && /cat-(blue|violet|green|amber|red|orange|teal|neutral)/.test(h) && h.indexOf('ntfp-pill') >= 0);
}
const G = vm.runInContext('premiumGroupInner(' + JSON.stringify({ severity: 'info', count: 3, taskTitle: 'TEMAS',
  primaryName: LONG, primaryAvatar: '', items: [{ actorName: 'Ana', title: 'Tarefa movimentada' }], extraCount: 1 }) + ')', BCTX);
ok('C17 grupo: mesma moldura da referência (avatar flutuante + cabeçalho + lista + cápsula com CTA)',
  G.indexOf('ntfp-wrap cat-neutral') >= 0 && G.indexOf('ntfp-fl') >= 0 && G.indexOf('3 atualizações') >= 0
  && G.indexOf('ntfp-glist') >= 0 && G.indexOf('+1 outras atualizações') >= 0
  && G.indexOf('data-cta="1"') >= 0 && G.indexOf('ntfp-pr') >= 0);

/* ============ D. REGRAS FUNCIONAIS DA 1.0.224/1.0.225 INTOCADAS ============ */
console.log('— D) regras funcionais congeladas —');
ok('D1 gate premiumUse byte-idêntico + PREMIUM_TYPES congelado',
  (() => { const a = extract(S, 'premiumUse'); return !!a && a === extract(BG, 'premiumUse'); })()
  && S.indexOf('PREMIUM_TYPES={task_moved:1,task_assigned:1,task_reassigned:1,task_updated:1,task_completed:1,task_reopened:1,designer_assigned:1}') >= 0);
ok('D2 clique/teclado via [data-cta] preservado (2 superfícies)',
  S.indexOf("closest('[data-cta]')") >= 0 && BG.indexOf("closest('[data-cta]')") >= 0);
both('D3 teclado Enter/Espaço preservado', "el.addEventListener('keydown',function(ev){ try{ var k=ev.key; if(k!=='Enter'&&k!==' ')return;");
ok('D4 aria-live polite único por superfície',
  S.indexOf("s.setAttribute('role','status'); s.setAttribute('aria-live','polite');") >= 0
  && BG.indexOf('<div id="stack" role="status" aria-live="polite">') >= 0);
ok('D5 filas preservadas (cap 4 toast / cap 5 janela)',
  S.indexOf('if(all.length>4){ for(var i=0;i<all.length-4;i++)') >= 0
  && BG.indexOf('while(stack.children.length>5){ stack.removeChild(stack.firstChild); }') >= 0);
ok('D6 dedup NOTIF_SEEN + histórico do sino preservados',
  S.indexOf('NOTIF_SEEN') >= 0 && S.indexOf('notifHistoryAppend(p)') >= 0);
ok('D7 autoridades de som intactas (1.0.216)',
  S.indexOf("if(p.sound!==false){ var _sr=notifSound(sev);") >= 0 && BG.indexOf('function bgSound(sev)') >= 0);
ok('D8 CSP da janela premium intacta', BG.indexOf('<meta http-equiv="Content-Security-Policy" content="default-src \'none\';') >= 0);
ok('D9 builders sem conteúdo privado (tema/legenda/notas/token)',
  FNS.every((f) => { const t = extract(S, f) || ''; return t.indexOf('legenda') < 0 && t.indexOf('designerItemNotes') < 0 && t.indexOf('token') < 0; }));

console.log('===== F3.5.5E-H2 REFERENCE-NOTIFICATION: ' + pass + ' PASS / ' + fail + ' FAIL (total ' + (pass + fail) + ') =====');
if (fail) { console.error('Falhas: ' + bad.join(' | ')); process.exit(1); }
