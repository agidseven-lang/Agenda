/*
 * A — KANBAN-CENTRIC · FIGMA GOLDEN — builder SEED (I7.6.1)
 * ---------------------------------------------------------------------------
 * Target Figma file (zero-cost, já criado via create_new_file — isento de cota):
 *   fileKey = AtRDxg4kwTYgaIfcjrjckT
 *   "Agenda ID Seven — A Kanban Golden (I7.6.1)"
 *
 * ESTADO: a formalização via use_figma está BLOQUEADA pela cota mensal do plano
 * Starter/Free (esgotada). Rota autorizada ÚNICA: rodar este seed quando a cota mensal
 * do plano gratuito resetar. NÃO fazer upgrade pago, NÃO usar Dev/Full seat, sem custo (R$0).
 *
 * AUTORIDADE DE SPEC: design-prototypes/in-app/i76/A.html (Golden validado, 3 resoluções).
 * Este seed constrói o SHELL + SIDEBAR com auto-layout responsivo. As seções restantes
 * (header, toolbar+KPIs, board 4 lanes, cards, empty states, drop zones) seguem A.html
 * 1:1 e devem ser adicionadas em chamadas use_figma incrementais (≤10 ops cada), buscando
 * os containers por nome (query 'FRAME[name=header]' etc.) — ver /figma-use skill.
 *
 * Responsividade: root fixo 1920×1080; main/board/lanes em FILL. Clonar o frame e
 * redimensionar para 1536×864 e 1366×768 gera A-GOLDEN-WIN125 / A-GOLDEN-1366 (reflow).
 * Regra: sidebar largura fixa; nada de scroll horizontal; 4 lanes preservadas.
 */

// ---- fonts ----
for (const st of ['Regular','Medium','Semi Bold','Bold','Extra Bold']) await figma.loadFontAsync({family:'Inter',style:st});
const W = s => ({Regular:'Regular',500:'Medium',600:'Semi Bold',700:'Bold',800:'Extra Bold'}[s]||'Regular');
const hx = h => ({r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255});
const sol = h => [{type:'SOLID',color:hx(h)}];
const txt = (chars,{size,style,color,ls,lh})=>{const t=figma.createText();t.fontName={family:'Inter',style:W(style)};t.characters=chars;t.fontSize=size;t.fills=sol(color);if(ls!=null)t.letterSpacing={unit:'PERCENT',value:ls};if(lh!=null)t.lineHeight={unit:'PIXELS',value:lh};return t;};
const icon = (svg,size,color)=>{const n=figma.createNodeFromSvg(svg);n.resize(size,size);n.name='ic';n.findAll(x=>['VECTOR','LINE','RECTANGLE','ELLIPSE'].includes(x.type)).forEach(v=>{v.strokes=sol(color);v.strokeWeight=2;if(v.fills&&v.fills.length)v.fills=[];});return n;};

// ---- root (auto-layout HORIZONTAL, responsivo) ----
const root = figma.createAutoLayout('HORIZONTAL');
root.name='A-GOLDEN-1920'; root.itemSpacing=0;
root.resize(1920,1080); root.primaryAxisSizingMode='FIXED'; root.counterAxisSizingMode='FIXED';
root.fills=sol('#E7EDF3'); root.x=200; root.y=120; root.clipsContent=true;

// ---- sidebar petroleum ----
const sb = figma.createAutoLayout('VERTICAL'); sb.name='sidebar'; sb.itemSpacing=5;
sb.paddingLeft=16;sb.paddingRight=16;sb.paddingTop=18;sb.paddingBottom=16; sb.fills=sol('#0C2E35');
root.appendChild(sb); sb.layoutSizingVertical='FILL'; sb.resize(248,sb.height); sb.layoutSizingHorizontal='FIXED';

const brand=figma.createAutoLayout('HORIZONTAL'); brand.itemSpacing=11; brand.paddingLeft=6;brand.paddingRight=6;brand.paddingTop=2;brand.paddingBottom=8; brand.fills=[]; brand.counterAxisAlignItems='CENTER';
const logo=figma.createAutoLayout('HORIZONTAL'); logo.fills=sol('#0D9488'); logo.cornerRadius=9; logo.resize(34,34); logo.primaryAxisSizingMode='FIXED';logo.counterAxisSizingMode='FIXED'; logo.primaryAxisAlignItems='CENTER';logo.counterAxisAlignItems='CENTER';
logo.appendChild(txt('7',{size:17,style:800,color:'#062A2A'})); brand.appendChild(logo);
const wm=figma.createAutoLayout('VERTICAL'); wm.itemSpacing=3; wm.fills=[];
wm.appendChild(txt('Agenda',{size:15,style:700,color:'#FFFFFF',ls:-1}));
const idseven=txt('ID SEVEN',{size:8.5,style:700,color:'#FFFFFF',ls:16}); idseven.fills=[{type:'SOLID',color:hx('#FFFFFF'),opacity:.5}]; wm.appendChild(idseven);
brand.appendChild(wm); sb.appendChild(brand); brand.layoutSizingHorizontal='FILL';

const nt=figma.createAutoLayout('HORIZONTAL'); nt.itemSpacing=8; nt.fills=sol('#0D9488'); nt.cornerRadius=10; nt.primaryAxisAlignItems='CENTER'; nt.counterAxisAlignItems='CENTER'; nt.resize(nt.width,39);
nt.appendChild(icon('<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',17,'#FFFFFF')); nt.appendChild(txt('Nova tarefa',{size:13,style:700,color:'#FFFFFF'}));
sb.appendChild(nt); nt.layoutSizingHorizontal='FILL'; nt.counterAxisSizingMode='FIXED'; nt.resize(nt.width,39);

const nlw=figma.createAutoLayout('HORIZONTAL'); nlw.fills=[]; nlw.paddingLeft=6;nlw.paddingTop=12;nlw.paddingBottom=4;
const nl=txt('PRINCIPAL',{size:9.5,style:700,color:'#FFFFFF',ls:13}); nl.fills=[{type:'SOLID',color:hx('#FFFFFF'),opacity:.36}]; nlw.appendChild(nl); sb.appendChild(nlw); nlw.layoutSizingHorizontal='FILL';

const navRow=(svg,label,on)=>{const r=figma.createAutoLayout('HORIZONTAL'); r.itemSpacing=11; r.counterAxisAlignItems='CENTER'; r.paddingLeft=10;r.paddingRight=10; r.cornerRadius=9; r.resize(r.width,37); r.counterAxisSizingMode='FIXED';
  r.fills= on? [{type:'SOLID',color:hx('#FFFFFF'),opacity:.09}] : [];
  r.appendChild(icon(svg,18, on?'#5EEAD4':'#7E9AA0'));
  const tx=txt(label,{size:13,style:on?600:500,color:'#FFFFFF'}); if(!on)tx.fills=[{type:'SOLID',color:hx('#FFFFFF'),opacity:.74}];
  r.appendChild(tx); sb.appendChild(r); r.layoutSizingHorizontal='FILL'; return r;};
navRow('<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>','Meu quadro',true);
navRow('<svg viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>','Cliente',false);
navRow('<svg viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.7-.7 1.7-1.7 0-.8-.9-1.4-.9-2.2a1.7 1.7 0 0 1 1.7-1.7h2c3 0 5.5-2.5 5.5-5.5C22 6 17.5 2 12 2z"/></svg>','Designers',false);
navRow('<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>','Social Medias',false);
navRow('<svg viewBox="0 0 24 24"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>','Setores',false);

const sp=figma.createFrame(); sp.name='spacer'; sp.fills=[]; sb.appendChild(sp); sp.layoutSizingHorizontal='FILL'; sp.layoutSizingVertical='FILL';

navRow('<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>','Calendário',false);
navRow('<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7"/><rect x="12" y="7" width="3" height="11"/><rect x="17" y="14" width="3" height="4"/></svg>','Relatórios',false);
navRow('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>','Configurações',false);

const dvw=figma.createAutoLayout('HORIZONTAL'); dvw.fills=[]; dvw.paddingTop=6;dvw.paddingBottom=6;dvw.paddingLeft=4;dvw.paddingRight=4;
const dv=figma.createFrame(); dv.name='divider'; dv.resize(216,1); dv.fills=[{type:'SOLID',color:hx('#FFFFFF'),opacity:.10}]; dvw.appendChild(dv); sb.appendChild(dvw); dvw.layoutSizingHorizontal='FILL'; dv.layoutSizingHorizontal='FILL';

const us=figma.createAutoLayout('HORIZONTAL'); us.itemSpacing=10; us.counterAxisAlignItems='CENTER'; us.fills=[]; us.paddingLeft=6;us.paddingRight=6;us.paddingTop=6;us.paddingBottom=2;
const uav=figma.createAutoLayout('HORIZONTAL'); uav.fills=sol('#0D9488'); uav.cornerRadius=99; uav.resize(32,32); uav.primaryAxisSizingMode='FIXED';uav.counterAxisSizingMode='FIXED'; uav.primaryAxisAlignItems='CENTER';uav.counterAxisAlignItems='CENTER'; uav.appendChild(txt('CE',{size:11,style:800,color:'#062A2A'})); us.appendChild(uav);
const un=figma.createAutoLayout('VERTICAL'); un.itemSpacing=2; un.fills=[]; un.appendChild(txt('Carlos Eduardo',{size:12.5,style:600,color:'#FFFFFF'}));
const ust=txt('CEO · Id Seven',{size:10,style:500,color:'#FFFFFF'}); ust.fills=[{type:'SOLID',color:hx('#FFFFFF'),opacity:.5}]; un.appendChild(ust); us.appendChild(un);
sb.appendChild(us); us.layoutSizingHorizontal='FILL';

// ---- main skeleton (fill sections in subsequent use_figma calls per A.html) ----
const main=figma.createAutoLayout('VERTICAL'); main.name='main'; main.itemSpacing=0; main.fills=sol('#EEF3F8'); root.appendChild(main); main.layoutSizingHorizontal='FILL'; main.layoutSizingVertical='FILL';
const header=figma.createAutoLayout('HORIZONTAL'); header.name='header'; header.fills=sol('#F3F7FB'); header.resize(header.width,60); main.appendChild(header); header.layoutSizingHorizontal='FILL'; header.counterAxisSizingMode='FIXED'; header.placeholder=true;
const toolbar=figma.createAutoLayout('HORIZONTAL'); toolbar.name='toolbar'; toolbar.fills=[]; toolbar.resize(toolbar.width,56); main.appendChild(toolbar); toolbar.layoutSizingHorizontal='FILL'; toolbar.counterAxisSizingMode='FIXED'; toolbar.placeholder=true;
const boardWrap=figma.createAutoLayout('HORIZONTAL'); boardWrap.name='boardWrap'; boardWrap.fills=[]; boardWrap.paddingLeft=20;boardWrap.paddingRight=20;boardWrap.paddingBottom=20; main.appendChild(boardWrap); boardWrap.layoutSizingHorizontal='FILL'; boardWrap.layoutSizingVertical='FILL';
const board=figma.createAutoLayout('HORIZONTAL'); board.name='board'; board.itemSpacing=16; board.paddingLeft=16;board.paddingRight=16;board.paddingTop=16;board.paddingBottom=16; board.fills=sol('#DAE2EC'); board.cornerRadius=18; board.strokes=sol('#DCE3EC'); board.strokeWeight=1; boardWrap.appendChild(board); board.layoutSizingHorizontal='FILL'; board.layoutSizingVertical='FILL'; board.placeholder=true;

return {root:root.id, sidebar:sb.id, main:main.id, header:header.id, toolbar:toolbar.id, board:board.id};
