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

/* ============ A. IDENTIDADE (RE-PINADO F3.5.6A-H2: candidata 1.0.246; contrato VISUAL da referência CONGELADO) ============ */
console.log('— A) identidade da candidata —');
ok('A1 package.json 1.0.246 (RE-PINADO F3.5.6A-H2)', /"version":\s*"1\.0\.246"/.test(PKG));
ok('A2 description: marcador da fase + cadeia de bases preservada',
  PKG.indexOf('1.0.226-f355eh2-reference-notification') >= 0 &&
  PKG.indexOf('base 1.0.225-f355eh1-ultra-premium-notifications') >= 0 &&
  PKG.indexOf('base 1.0.224-f355e-retire-legacy-modules-premium-notifications') >= 0 &&
  PKG.indexOf('base 1.0.223-f355d-custom-cronograma-quantity-universal-paste') >= 0);
ok('A3 package-lock 1.0.246 (2x — RE-PINADO F3.5.6A-H2)', (LOCK.match(/"version":\s*"1\.0\.246"/g) || []).length >= 2);

/* ============ B. CONTRATO CSS DA REFERÊNCIA (2 superfícies) ============ */
console.log('— B) contrato CSS da referência —');
ok('B1 largura 400 (mandato I7.27.1: 380–440) SEM headroom (avatar integrado); janela premium fluida (RE-PINADO I7.27.1)',
  S.indexOf('.ntf.ntfp-w{width:400px;max-width:calc(100vw - 36px);overflow:visible}') >= 0 &&
  BG.indexOf('.ntf.ntfp-w{width:100%;max-width:100%;overflow:visible}') >= 0);
both('B2 card base neutralizado (superfície é o wrap) (RE-PINADO I7.27.1: radius 16)',
  '.ntf-card.ntfp{gap:0;padding:0;background:transparent;border:0;box-shadow:none;overflow:visible;border-radius:16px}');
both('B3 SEM barra lateral (::before desligado)', '.ntf-card.ntfp::before{display:none}');
both('B4 superfície LIGHT do mandato: #FFF, hairline #D6DBE6, radius 14, sombra suave, respiro 12/14/12 (RE-PINADO I7.27.1 — substitui a referência navy)',
  '.ntfp-wrap{position:relative;display:flex;flex-direction:column;min-width:0;width:100%;background:#FFFFFF;border:1px solid #D6DBE6;border-radius:14px;box-shadow:0 12px 32px -14px rgba(23,26,34,.22),0 2px 8px -4px rgba(23,26,34,.10);padding:12px 14px 12px}');
both('B5 AVATAR INTEGRADO: estático na linha do título, sem anel/sombra/flutuação (RE-PINADO I7.27.1 — o flutuante foi rejeitado)',
  '.ntfp-fl{position:static;flex:0 0 auto;display:inline-flex;padding:0;border-radius:50%;background:none;box-shadow:none}');
ok('B5b micro-scale do avatar REMOVIDO (integrado não anima em separado) (RE-PINADO I7.27.1)',
  S.indexOf('.ntf.in .ntfp-fl{') < 0 && BG.indexOf('.ntf.in .ntfp-fl{') < 0);
both('B6 avatar 34px (mandato I7.27.1: 32–36) com recorte interno hairline (RE-PINADO I7.27.1)',
  '.ntfp-fl .ntfp-av{width:34px;height:34px;box-shadow:inset 0 0 0 1px rgba(23,26,34,.08)}');
both('B6b iniciais proporcionais ao avatar 34 (RE-PINADO I7.27.1)', '.ntfp-fl .ntfp-av.gen{font-size:13px;letter-spacing:.3px}');
both('B7 cabeçalho no TOPO em largura total (avatar não desloca o header) (RE-PINADO I7.27.1)',
  '.ntfp-hd{display:flex;align-items:center;gap:8px;min-width:0}');
ok('B8 eyebrow 12/600 sentence-case (SEM uppercase) + ícone do evento inline 14/13 sem fundo', (() => {
  const re = /\.ntfp-eyebrow\{[^}]*\}/;
  const g = (r) => r.indexOf('font-size:12px') >= 0 && r.indexOf('font-weight:600') >= 0 && r.indexOf('text-transform') < 0;
  return g((S.match(re) || [''])[0]) && g((BG.match(re) || [''])[0])
    && S.indexOf('.ntfp-ei svg{width:13px;height:13px}') >= 0 && BG.indexOf('.ntfp-ei svg{width:13px;height:13px}') >= 0;
})());
both('B9 hora 11.5/500 tabular-nums (cor light) (RE-PINADO I7.27.1)',
  '.ntfp-tm{flex:0 0 auto;color:#7A8194;font-size:11.5px;font-weight:500;font-variant-numeric:tabular-nums}');
both('B10 fechar: hit-area 28×28 estático SEM margem negativa horizontal (hscroll 0) (RE-PINADO I7.27.1)',
  '.ntf-card.ntfp .ntf-x{position:static;top:auto;right:auto;flex:0 0 auto;width:28px;height:28px;margin:-4px 0 -4px 0;display:inline-flex;align-items:center;justify-content:center;font-size:15px;color:#7A8194;border:0;border-radius:9px;background:transparent;cursor:pointer;transition:background .18s ease,color .18s ease}');
both('B10b foco visível no fechar (RE-PINADO I7.27.1)', '.ntf-x:focus-visible{outline:2px solid #60A5FA;outline-offset:1px}');
ok('B11 título 15/650 clamp-2 dominante no card light (RE-PINADO I7.27.1)', (() => {
  const re = /\.ntfp-task\{[^}]*\}/;
  const g = (r) => r.indexOf('font-size:15px') >= 0 && r.indexOf('font-weight:650') >= 0 && r.indexOf('-webkit-line-clamp:2') >= 0;
  return g((S.match(re) || [''])[0]) && g((BG.match(re) || [''])[0]);
})());
both('B12 cliente secundário 12.5/500, 1 linha + ellipsis (RE-PINADO I7.27.1)',
  '.ntfp-client{color:#4C5261;font-size:12.5px;font-weight:500;line-height:1.3;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B13 contexto 12/450, 1 linha + ellipsis (RE-PINADO I7.27.1)',
  '.ntfp-ctx{color:#7A8194;font-size:12px;font-weight:450;margin-top:8px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B14 autor como metadata 12/450, 1 linha + ellipsis (RE-PINADO I7.27.1)',
  '.ntfp-meta{color:#7A8194;font-size:12px;font-weight:450;margin-top:3px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B15 responsável 12/450, 1 linha + ellipsis (RE-PINADO I7.27.1)',
  '.ntfp-respline{color:#7A8194;font-size:12px;font-weight:450;margin-top:2px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
both('B16 CÁPSULA inferior compacta: 34px, radius 10, hairline/fundo light, hover discreto (RE-PINADO I7.27.1)',
  '.ntfp-pill{display:flex;align-items:stretch;margin-top:10px;min-height:34px;border-radius:10px;border:1px solid #E3E7F0;background:#F7F9FC;overflow:hidden;cursor:pointer;transition:border-color .18s ease,background .18s ease}');
both('B16b foco visível na cápsula (teclado) (RE-PINADO I7.27.1)', '.ntfp-pill:focus-visible{outline:2px solid #60A5FA;outline-offset:2px}');
ok('B17 lado esquerdo da cápsula: 12.5/600 + label com ellipsis + dot 7px (cor do estado OU da categoria) + destino claro',
  ['.ntfp-pl{flex:1 1 auto;display:flex;align-items:center;gap:8px;min-width:0;padding:0 12px;color:#4C5261;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden}',
   '.ntfp-pl .plab{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
   '.ntfp-pl .cdot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--cfg,var(--catc,#7A8194))}',
   '.ntfp-pl .pto{color:#171A22}'].every((t) => S.indexOf(t) >= 0 && BG.indexOf(t) >= 0)); // RE-PINADO I7.27.1
both('B18 CTA \"Abrir\" compacto e QUIETO: divisor hairline, sem bloco colorido (RE-PINADO I7.27.1 — o segmento roxo foi rejeitado)',
  '.ntfp-pr{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;padding:0 14px;background:transparent;border-left:1px solid #E3E7F0;color:#171A22;font-size:12.5px;font-weight:650;white-space:nowrap}');
ok('B19 reduced-motion cobre o card (avatar integrado não anima) (RE-PINADO I7.27.1)',
  S.indexOf('@media (prefers-reduced-motion: reduce){.ntf{transition:none}}') >= 0 &&
  BG.indexOf('@media (prefers-reduced-motion: reduce){.ntf{transition:none}}') >= 0);
ok('B20 tokens: categorias light + STATUS com as cores REAIS do sistema (RE-PINADO I7.27.1)',
  ['.cat-blue{--catc:#2563EB}', '.cat-violet{--catc:#7C3AED}', '.cat-green{--catc:#059669}', '.cat-amber{--catc:#D97706}',
   '.cat-red{--catc:#DC2626}', '.cat-orange{--catc:#EA580C}', '.cat-teal{--catc:#0D9488}', '.cat-neutral{--catc:#7A8194}',
   '.cs-afazer{--cfg:#9BA0AB}', '.cs-andamento{--cfg:#F59E0B}', '.cs-revisao{--cfg:#60A5FA}', '.cs-concluido{--cfg:#34D399}'].every((t) => S.indexOf(t) >= 0 && BG.indexOf(t) >= 0));
both('B21 lista do grupo preservada (RE-PINADO I7.27.1)', '.ntfp-glist{margin-top:10px;display:flex;flex-direction:column;gap:4px}');

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

ok('C4 composição LIGHT (ordem DOM): cabeçalho → linha principal (avatar integrado + título + cliente) → contexto → autor → cápsula (RE-PINADO I7.27.1)',
  (() => { let last = -1; return ['ntfp-hd', 'ntfp-main', 'ntfp-fl', 'ntfp-task', 'ntfp-client', 'ntfp-ctx', 'ntfp-meta', 'ntfp-pill']
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
ok('D1 gate premiumUse byte-idêntico + PREMIUM_TYPES 7 Categoria-A + 10 wf_* (RE-PINADO F3.5.6B-H2)',
  (() => { const a = extract(S, 'premiumUse'); return !!a && a === extract(BG, 'premiumUse'); })()
  && S.indexOf('PREMIUM_TYPES={task_moved:1,task_assigned:1,task_reassigned:1,task_updated:1,task_completed:1,task_reopened:1,designer_assigned:1,wf_client_themes_approved:1,wf_client_captions_approved:1,wf_client_themes_adjustment_requested:1,wf_client_captions_adjustment_requested:1,wf_client_themes_first_viewed:1,wf_client_captions_first_viewed:1,wf_designer_item_completed:1,wf_design_production_completed:1,wf_themes_ready:1,wf_captions_ready:1}') >= 0);
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
