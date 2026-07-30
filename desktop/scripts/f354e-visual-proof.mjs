#!/usr/bin/env node
/* =====================================================================
 * F3.5.4E — PREVIEWS REAIS (20 da autorização) + MÉTRICAS ESTRUTURAIS.
 * NÃO é IA generativa: extrai kbv2Card REAL + TODOS os <style> REAIS do index.html
 * (ANTES = git show a4687480 [1.0.195 publicada]; DEPOIS = árvore com F3.5.4E) e
 * fotografa em Chromium. Mede por card: width/padding/raio/altura de chips/botões e
 * offsets de CADA bloco relativos ao topo do card — os deltas estruturais entre
 * "A Fazer"×"Em andamento" e entre tipos devem ser ZERO até o painel central (abaixo
 * dele, só a altura NATURAL do conteúdo pode variar).
 * Rodar: NODE_PATH=/opt/node22/lib/node_modules node desktop/scripts/f354e-visual-proof.mjs
 * Saída: docs/f354e-visual/*.png + metrics-f354e.json
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, 'docs', 'f354e-visual');
fs.mkdirSync(OUT, { recursive: true });
const BASE_195_SHA = 'a4687480b32d7d55355ce0eba1ab19de78503425';
const SRC_DEPOIS = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const SRC_ANTES = execSync('git show ' + BASE_195_SHA + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();

function grabFrom(HTML, n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '='); if (a < 0) a = HTML.indexOf('var ' + n + '=');
  if (a < 0) return null;
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  return null;
}
function cssOf(HTML) { let out = '', i = 0; for (;;) { const a = HTML.indexOf('<style', i); if (a < 0) break; const s = HTML.indexOf('>', a) + 1; const b = HTML.indexOf('</style>', s); out += HTML.slice(s, b) + '\n'; i = b + 8; } return out; }
const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2FirstName', 'kbv2Card', 'kbv2Empty', 'kbv2BoardHtml'];
const PRELUDE =
  'var state={user:{id:"adm"},users:[' +
  '{id:"u1",name:"Miercohévisk Niheb Ferreira Nascimento Carlôto",role:"Social Media"},' +
  '{id:"u2",name:"Arydyjany Nascimento",role:"Administradora"},' +
  '{id:"u3",name:"Pedro Henrique Sales",role:"Social Media"}]};\n' +
  'function respOf(t){return (t&&t._resp)||{id:"rb",name:"Boaz Macêdo",role:"Editor"};}\n' +
  'function avatar(u,s){var n=(u&&u.name)||"?";var i=n.split(/\\s+/).map(function(p){return p[0]||"";}).slice(0,2).join("").toUpperCase();return \'<div class="av" style="width:\'+s+\'px;height:\'+s+\'px;font-size:\'+Math.round(s*0.36)+\'px;background:#5B6CFF;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;flex:0 0 auto">\'+i+\'</div>\';}\n' +
  'function svg(k){var P={eye:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z",swap:"M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7",person:"M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0",calendar:"M7 2v3M17 2v3M3 8h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z",check:"M4 12l5 5L20 6",flag:"M5 3v18M5 4h11l-2 4 2 4H5",arr:"M5 12h14M13 6l6 6-6 6",send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",trash:"M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"};var d=P[k]||"M12 5v14M5 12h14";return \'<svg viewBox="0 0 24 24" fill="none"><path d="\'+d+\'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>\';}\n' +
  'function fmtDateBR(d){var p=String(d||"").split("-");return p.length===3?(p[2]+"/"+p[1]+"/"+p[0]):String(d||"");}\n' +
  'function hasDesigner(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}\n' +
  'function designerStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientFacingStatusView(t){return clientStatusView(t);}\n' +
  'function taskTimeline(t){return {milestones:[{key:"a",state:"done"},{key:"b",state:"current"},{key:"c",state:""},{key:"d",state:""}],owner:{role:(t&&t._ownrole)||"Social",id:null}};}\n' +
  'function nextActionShort(t){return (t&&t._next)||"Enviar ao cliente";}\n' +
  'function clientFacingNextShort(t){return "";}\n' +
  'function designerColView(t){return (t&&t.status)||"afazer";}\n' +
  'function designerNextShort(t){return "Produzir a arte";}\n' +
  'var TASK_PHASE={COMPLETED:"c",AWAITING_DESIGNER:"ad",AWAITING_CLIENT_APPROVAL:"acp",DESIGNER_PRODUCING:"dp",DESIGNER_REVISING:"dr",DESIGNER_DELIVERED:"dd"};\n' +
  'function deriveCanonicalTaskState(t){return {phase:"producing",owner:"social"};}\n' +
  'function deriveCanonicalPerspective(t,p){var st=(t&&t.status)||"afazer";var M={afazer:["A Fazer","#8B94A6"],andamento:["Em produção","#F59E0B"],revisao:["Em revisão","#5B6CFF"],concluido:["Concluído","#2FCF8F"]};var m=M[st]||M.afazer;return {key:st,label:(t&&t._stlabel)||m[0],color:m[1],next:st==="concluido"?"":((t&&t._next)||"Enviar ao cliente")};}\n' +
  'function isTaskCompleted(t){return (t&&t.status)==="concluido";}\n' +
  'function kbv2SlaLocal(t){return (t&&t._sla)||{sev:"neutro",label:""};}\n' +
  'function canDelTask(t){return true;}\n' +
  'function isDesignerAxisMove(t){return false;}\n' +
  'function cardsFieldOf(t,k){return k==="legenda"?String(t.cardLegenda||""):String(t.cardObs||"");}\n' +
  'function isDesignerFlow(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}\n' +
  'function designerOf(t){return t&&t.designerAssignment?t.designerAssignment.designerId:null;}\n' +
  'function designerCol(t){return (t&&t.status)||"afazer";}\n';
function build(HTML) {
  let S = ''; for (const n of NAMES) { const s = grabFrom(HTML, n); if (s) S += s + '\n'; }
  return new Function('localStorage', PRELUDE + S + '\nreturn {kbv2Card,kbv2BoardHtml};')({ getItem: () => null, setItem: () => { }, removeItem: () => { } });
}

/* fixtures realistas DISTINTAS */
const T = {
  afazerCards: { id: 'A1', title: 'Card institucional — LGPD', client: 'Auto Center Ravel', sector: 'edicao_cards', status: 'afazer', by: 'u1', createdAt: 1753830660000, dueDate: '2026-07-30', dueTime: '18:00', _next: 'Produzir a arte do card', _resp: { id: 'rm', name: 'Miercohévisk Niheb Ferreira Nascimento Carlôto', role: 'Social Media' }, cardLegenda: 'Seus dados protegidos com a gente: conheça a nossa política de privacidade e atendimento.', checklist: [] },
  andamentoVid: { id: 'E1', title: 'EDIÇÃO DE VÍDEO', client: 'Hospital Visão', sector: 'edicao_midia', status: 'andamento', by: 'u2', createdAt: 1753858260000, dueDate: '2026-08-01', dueTime: '16:00', _sla: { sev: 'azul', label: 'Em prazo' }, _next: 'Concluir e enviar para revisão', _resp: { id: 'rb', name: 'Boaz Macêdo', role: 'Editor' }, videos: [{ id: 'v1', n: 1, tema: 'VÍDEO HV 1 - Dr. Fernando Gadelha' }, { id: 'v2', n: 2, tema: 'VÍDEO HV 2 - Dr. Fernando Gadelha' }, { id: 'v3', n: 3, tema: 'VÍDEO HV 3 - Dr. Fernando Gadelha' }, { id: 'v4', n: 4, tema: 'VÍDEO HV 4 - Dr. Fernando Gadelha' }], checklist: [{ d: false }, { d: false }, { d: false }, { d: false }, { d: false }] },
  afazerVid: { id: 'A2', title: 'Reels — bastidores da oficina', client: 'Auto Center Ravel', sector: 'edicao_midia', status: 'afazer', by: 'u3', createdAt: 1753840000000, dueDate: '2026-08-03', dueTime: '10:00', _next: 'Separar o material bruto', _resp: { id: 'rc', name: 'Caio Souza', role: 'Designer' }, videos: [{ id: 'r1', n: 1, tema: 'Reel — elevador em time-lapse' }, { id: 'r2', n: 2, tema: 'Reel — antes e depois do polimento' }], checklist: [{ d: false }] },
  andamentoCards: { id: 'E2', title: 'Cards — cardápio de inverno', client: 'Sabor & Arte Bistrô', sector: 'edicao_cards', status: 'andamento', by: 'u2', createdAt: 1753850000000, dueDate: '2026-08-02', dueTime: '12:00', _sla: { sev: 'azul', label: 'Em prazo' }, _next: 'Aplicar identidade visual', _resp: { id: 'ra', name: 'Ana Paula Reis', role: 'Social Media' }, cardLegenda: 'Chegou o cardápio de inverno! 🍲 Caldos e massas artesanais até 30/08.', cardObs: 'Usar a paleta nova aprovada.', checklist: [{ d: true }, { d: false }] },
  revisaoCards: { id: 'R1', title: 'Card — semana do cliente', client: 'Bella Moda', sector: 'edicao_cards', status: 'revisao', by: 'u1', createdAt: 1753700000000, dueDate: '2026-07-31', dueTime: '15:00', _next: 'Revisar e aprovar (ou pedir ajuste)', _resp: { id: 'rl', name: 'Bruna Lima', role: 'Designer' }, cardLegenda: 'Semana do cliente Bella Moda: condições especiais nas peças selecionadas.', checklist: [{ d: true }, { d: true }, { d: false }] },
  concluidoCron: { id: 'C1', title: 'Cronograma semanal — Agosto', client: 'Clínica OdontoPrime', sector: 'cronograma', status: 'concluido', by: 'u3', createdAt: 1753600000000, dueDate: '2026-07-28', dueTime: '12:00', _resp: { id: 'rl', name: 'Bruna Lima', role: 'Designer' }, cronContents: [{ tema: 'Prevenção: check-up semestral' }, { tema: 'Bastidores do consultório' }, { tema: 'Depoimento de paciente' }], checklist: [{ d: true }, { d: true }] },
  roteiro: { id: 'RT', title: 'Roteiro — vídeo do prato da casa', client: 'Sabor & Arte Bistrô', sector: 'roteiro', status: 'afazer', by: 'u2', createdAt: 1753860000000, dueDate: '2026-08-05', dueTime: '10:00', _next: 'Escrever o gancho inicial', _resp: { id: 'rc', name: 'Caio Souza', role: 'Designer' }, cronContents: [{ tema: 'Gancho: o chef conta a história do prato mais pedido', legenda: 'Legenda do roteiro para aprovação' }] },
  legendaLonga: { id: 'LL', title: 'Card — aniversário da loja', client: 'Bella Moda', sector: 'edicao_cards', status: 'afazer', by: 'u1', createdAt: 1753870000000, dueDate: '2026-08-06', dueTime: '11:00', _next: 'Montar a arte comemorativa', _resp: { id: 'ra', name: 'Ana Paula Reis', role: 'Social Media' }, cardLegenda: 'A Bella Moda faz aniversário e o presente é seu: uma semana inteira de condições exclusivas, sorteios diários nos stories, brindes nas compras acima de R$ 199 e um desfile especial na loja do centro no sábado às 16h. Marque aquela amiga que não pode ficar de fora!', checklist: [] },
  temas12: { id: 'T12', title: 'Calendário mensal de conteúdo', client: 'Bella Moda', sector: 'cronograma', status: 'andamento', by: 'u2', createdAt: 1753620000000, dueDate: '2026-08-07', dueTime: '18:00', _next: 'Enviar ao cliente', _resp: { id: 'ra', name: 'Ana Paula Reis', role: 'Social Media' }, cronContents: Array.from({ length: 12 }, (_, i) => ({ tema: ['Lançamento coleção inverno', 'Look da semana #1', 'Bastidores do ensaio', 'Prova social: clientes reais', 'Promo relâmpago de quarta', 'Look da semana #2', 'Guia de tamanhos', 'Combina ou não combina?', 'Look da semana #3', 'Depoimento da influencer', 'Esquenta liquidação', 'Recap do mês'][i] })) },
  nomeLongo: { id: 'NL', title: 'Posts do fim de semana', client: 'Auto Center Ravel', sector: 'programacao_posts', status: 'afazer', by: 'u1', createdAt: 1753880000000, dueDate: '2026-08-02', dueTime: '09:00', _next: 'Agendar no Meta Business', _resp: { id: 'rx', name: 'Maria Auxiliadora dos Santos Albuquerque Nascimento', role: 'Social Media' } },
};
const col = (label, color, tasks) => ({ label, color, key: 'andamento', tasks });
function probe(css, inner, title) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '\nbody{background:#0A0B10;margin:0}\n</style></head>' +
    '<body class="desktop"><div id="content" class="board-mode" style="height:100vh;box-sizing:border-box;display:flex;flex-direction:column;padding:14px 16px">' +
    (title ? '<div style="color:#8b94a6;font:700 12px Segoe UI,system-ui;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px 4px">' + title + '</div>' : '') + inner + '</div></body></html>';
}

/* MÉTRICAS ESTRUTURAIS por card (offsets relativos ao TOPO do card) */
const MEASURE = `(() => {
  const out = [];
  document.querySelectorAll('.kbv2-card').forEach(card => {
    const cr = card.getBoundingClientRect(); const cs = getComputedStyle(card);
    const off = sel => { const el = card.querySelector(sel); if (!el) return null; return Math.round(el.getBoundingClientRect().top - cr.top); };
    const hgt = sel => { const el = card.querySelector(sel); if (!el) return null; return Math.round(el.getBoundingClientRect().height); };
    const slotTop = ['.kbv2-card-themes', '.kbv2-card-notes'].map(s => off(s)).filter(v => v != null).sort((a, b) => a - b)[0];
    out.push({
      width: Math.round(cr.width), padding: cs.paddingTop + '/' + cs.paddingLeft, radius: cs.borderRadius,
      statusChipH: hgt('.kbv2-status'), btnH: hgt('.kbv2-btn'), dotsW: hgt('.kbv2-btn-dots') != null ? Math.round(card.querySelector('.kbv2-btn-dots').getBoundingClientRect().width) : null,
      off: { profile: off('.kbv2-card-profile'), origin: off('.kbv2-card-origin'), client: off('.kbv2-tier'), title: off('.kbv2-title'), chips: off('.kbv2-card-chips'), slot: slotTop == null ? null : slotTop, chk: off('.kbv2-card-chk'), rail: off('.kbv2-card-rail'), stage: off('.kbv2-stage2'), date: off('.kbv2-card-date'), footer: off('.kbv2-card-footer') },
      notePanel: (() => { const n = card.querySelector('.kbv2-card-notes'); if (!n) return null; const s = getComputedStyle(n); return { borderW: s.borderTopWidth, radius: s.borderRadius, bg: s.backgroundColor }; })(),
      themesPanel: (() => { const n = card.querySelector('.kbv2-card-themes'); if (!n) return null; const s = getComputedStyle(n); return { borderW: s.borderTopWidth, radius: s.borderRadius, bg: s.backgroundColor }; })(),
      nameLines: (() => { const n = card.querySelector('.kbv2-name'); if (!n) return null; const s = getComputedStyle(n); return Math.round(n.getBoundingClientRect().height / parseFloat(s.lineHeight)); })(),
      hasMaisN: !!card.querySelector('.kbv2-themes-more'), tcv4: !!card.querySelector('[class*="tcv4"]'),
      themesVisible: [...card.querySelectorAll('.kbv2-theme')].filter(e => e.getBoundingClientRect().height > 4).length,
      themesTotal: card.querySelectorAll('.kbv2-theme').length,
    });
  });
  return out;
})()`;

const { chromium } = require('playwright');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const MD = build(SRC_DEPOIS), cssD = cssOf(SRC_DEPOIS);
  const MA = build(SRC_ANTES), cssA = cssOf(SRC_ANTES);
  const metrics = { cenas: {} };
  async function shot(name, html, w, h, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: opts.dsf || 1 });
    const pg = await ctx.newPage(); await pg.setContent(html, { waitUntil: 'load' });
    if (opts.prep) await pg.evaluate(opts.prep);
    metrics.cenas[name] = await pg.evaluate(MEASURE);
    await pg.screenshot({ path: path.join(OUT, name + '.png') }); await ctx.close();
    console.log('  ✓', name + '.png');
  }
  const PAIR = (M) => M.kbv2BoardHtml([col('A Fazer', '#8B94A6', [T.afazerCards]), col('Em andamento', '#F2A93B', [T.andamentoVid])]);
  await shot('01-antes-afazer-x-andamento', probe(cssA, PAIR(MA), 'ANTES (1.0.195) · A Fazer × Em andamento'), 1180, 980);
  await shot('02-depois-afazer-x-andamento', probe(cssD, PAIR(MD), 'DEPOIS (F3.5.4E) · A Fazer × Em andamento'), 1180, 980);
  /* 03 — sobreposição estrutural: guias horizontais por bloco nas 2 colunas */
  await shot('03-sobreposicao-estrutural', probe(cssD, PAIR(MD), 'sobreposição estrutural (guias por bloco)'), 1180, 980, {
    prep: `(() => { const cards=[...document.querySelectorAll('.kbv2-card')]; const COL=['#22D3EE','#F2A93B','#A78BFA','#2FCF8F','#EF4444','#eab308'];
      const SELS=[['topo',null],['perfil','.kbv2-card-profile'],['título','.kbv2-title'],['painel','.kbv2-card-themes,.kbv2-card-notes'],['trilho','.kbv2-card-rail'],['botões','.kbv2-card-footer']];
      cards.forEach((c,ci)=>{const cr=c.getBoundingClientRect();SELS.forEach(([nm,sel],si)=>{const el=sel?c.querySelector(sel):c;if(!el)return;const r=el.getBoundingClientRect();
        const ln=document.createElement('div');ln.style.cssText='position:fixed;left:'+(ci===0?0:50)+'%;width:50%;top:'+(r.top-1)+'px;height:0;border-top:2px '+(ci===0?'solid':'dashed')+' '+COL[si%6]+';z-index:9999;pointer-events:none;opacity:.9';
        const tg=document.createElement('span');tg.textContent=nm+' '+Math.round(r.top)+'px';tg.style.cssText='position:absolute;'+(ci===0?'left:6px':'right:6px')+';top:-15px;font:700 10px Segoe UI;color:'+COL[si%6]+';background:rgba(10,11,16,.85);padding:1px 6px;border-radius:4px';ln.appendChild(tg);document.body.appendChild(ln);});});})()` });
  await shot('04-afazer-edicao-cards', probe(cssD, MD.kbv2BoardHtml([col('A Fazer', '#8B94A6', [T.afazerCards])]), 'A Fazer · Edição de Cards (LEGENDA no painel)'), 760, 900);
  await shot('05-andamento-edicao-cards', probe(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [T.andamentoCards])]), 'Em andamento · Edição de Cards'), 760, 900);
  await shot('06-afazer-edicao-videos', probe(cssD, MD.kbv2BoardHtml([col('A Fazer', '#8B94A6', [T.afazerVid])]), 'A Fazer · Edição de vídeos'), 760, 900);
  await shot('07-andamento-edicao-videos', probe(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [T.andamentoVid])]), 'Em andamento · Edição de vídeos'), 760, 980);
  await shot('08-revisao', probe(cssD, MD.kbv2BoardHtml([col('Revisão', '#5B6CFF', [T.revisaoCards])]), 'Revisão'), 760, 900);
  await shot('09-concluido', probe(cssD, MD.kbv2BoardHtml([col('Concluído', '#2FCF8F', [T.concluidoCron])]), 'Concluído · Cronograma'), 760, 900);
  /* 10-14 — cinco quadros (mesmo componente; dados/perspectivas variando) */
  const b3 = (M, persp) => M.kbv2BoardHtml([col('A Fazer', '#8B94A6', [T.afazerCards, T.roteiro]), col('Em andamento', '#F2A93B', [T.andamentoVid]), col('Revisão', '#5B6CFF', [T.revisaoCards])], persp ? (t => M.kbv2Card(t, persp)) : undefined);
  await shot('10-meu-quadro', probe(cssD, b3(MD), 'Meu quadro'), 1600, 900);
  await shot('11-designers', probe(cssD, MD.kbv2BoardHtml([col('A fazer', '#8B94A6', [Object.assign({}, T.afazerVid, { designerAssignment: { designerId: 'dz' } })]), col('Em produção', '#F2A93B', [Object.assign({}, T.andamentoVid, { designerAssignment: { designerId: 'dz' } })])], t => MD.kbv2Card(t, 'designer')), 'Designers'), 1180, 980);
  await shot('12-social-medias', probe(cssD, b3(MD), 'Social Medias'), 1600, 900);
  await shot('13-clientes', probe(cssD, MD.kbv2BoardHtml([col('Aprovação', '#F2A93B', [T.concluidoCron, T.temas12])], t => MD.kbv2Card(t, 'client')), 'Clientes'), 900, 1000);
  await shot('14-setores', probe(cssD, MD.kbv2BoardHtml([col('A Fazer', '#8B94A6', [T.legendaLonga]), col('Em andamento', '#F2A93B', [T.andamentoCards])]), 'Setores · Edição de Cards'), 1180, 940);
  await shot('15-escala-100', probe(cssD, PAIR(MD), 'escala 100% · 1366×768'), 1366, 768);
  await shot('16-escala-125', probe(cssD, PAIR(MD), 'escala 125% · 1366×768'), 1366, 768, { dsf: 1.25 });
  await shot('17-menu-aberto', probe(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [Object.assign({}, T.andamentoVid, { designerAssignment: { designerId: 'rl' } })])]), 'menu ⋯ aberto'), 760, 980, {
    prep: `(() => { const btn=document.querySelector('[data-cardmenu]'); const w=btn.closest('.kbv2-more'); w.classList.add('open');
      const m=w.querySelector('.kbv2-menu'); document.body.appendChild(m); m.classList.add('open');
      const r=btn.getBoundingClientRect(); const mr=m.getBoundingClientRect();
      m.style.left=Math.max(8,Math.min(r.right-mr.width,window.innerWidth-mr.width-8))+'px'; m.style.top=Math.min(r.bottom+8,window.innerHeight-mr.height-8)+'px'; })()` });
  await shot('18-nome-longo', probe(cssD, MD.kbv2BoardHtml([col('A Fazer', '#8B94A6', [T.nomeLongo])]), 'nome longo (2 linhas + tooltip)'), 470, 880);
  await shot('19-legenda-longa', probe(cssD, MD.kbv2BoardHtml([col('A Fazer', '#8B94A6', [T.legendaLonga])]), 'legenda longa (painel, sem corte)'), 720, 1000);
  await shot('20-doze-temas', probe(cssD, MD.kbv2BoardHtml([col('Cronograma', '#22D3B8', [T.temas12])]), '12 temas (todos visíveis)'), 720, 1500);
  await browser.close();

  /* ═══ GATES ESTRUTURAIS ═══ */
  let bad = 0; const chk = (c, m) => { if (c) console.log('  PASS — ' + m); else { bad++; console.log('  FAIL — ' + m); } };
  console.log('\n===== GATES ESTRUTURAIS F3.5.4E =====');
  const dep = metrics.cenas['02-depois-afazer-x-andamento'];
  const [cA, cB] = dep;
  chk(dep.length === 2 && !cA.tcv4 && !cB.tcv4, 'DEPOIS: zero tcv4 nas duas colunas');
  chk(cA.width === cB.width && cA.padding === cB.padding && cA.radius === cB.radius, 'width/padding/raio IDÊNTICOS (A Fazer × Em andamento): ' + cA.width + 'px · ' + cA.padding + ' · ' + cA.radius);
  chk(cA.statusChipH === cB.statusChipH && cA.btnH === cB.btnH && cA.dotsW === cB.dotsW, 'altura de chips/botões e largura do ⋯ IDÊNTICAS: ' + cA.statusChipH + '/' + cA.btnH + '/' + cA.dotsW);
  const upTo = ['profile', 'origin', 'client', 'title', 'chips', 'slot'];
  chk(upTo.every(k => cA.off[k] != null && cA.off[k] === cB.off[k]), 'offsets estruturais topo→painel IGUAIS (Δ0): ' + upTo.map(k => k + '=' + cA.off[k]).join(' '));
  chk(cA.notePanel && parseFloat(cA.notePanel.borderW) > 0 && cA.notePanel.radius === (cB.themesPanel && cB.themesPanel.radius), 'LEGENDA tem PAINEL (borda>0) com o MESMO raio do painel TEMAS');
  const ant = metrics.cenas['01-antes-afazer-x-andamento'];
  chk(ant[0].notePanel && parseFloat(ant[0].notePanel.borderW) === 0, 'ANTES: legenda era texto solto (borda 0) — defeito reproduzido');
  chk(metrics.cenas['18-nome-longo'][0].nameLines === 2, 'nome longo quebra em 2 linhas (sem reticências de 1 linha)');
  chk(metrics.cenas['20-doze-temas'][0].themesVisible === 12 && !metrics.cenas['20-doze-temas'][0].hasMaisN, '12 temas: todos visíveis, sem "+N"');
  const esc125 = metrics.cenas['16-escala-125'];
  chk(esc125.length === 2 && !esc125[0].tcv4 && !esc125[1].tcv4, 'escala 125%: MESMO shell kbv2 (nenhum card legado)');
  for (const [n, cs] of Object.entries(metrics.cenas)) if (!n.startsWith('01')) chk(cs.every(c => !c.tcv4 && !c.hasMaisN), n + ': shell único, sem tcv4, sem "+N"');
  fs.writeFileSync(path.join(OUT, 'metrics-f354e.json'), JSON.stringify(metrics, null, 2));
  console.log('metrics-f354e.json gravado.');
  console.log('===== GATES: ' + (bad ? bad + ' FAIL' : 'todos PASS') + ' =====');
  process.exit(bad ? 1 : 0);
})();
