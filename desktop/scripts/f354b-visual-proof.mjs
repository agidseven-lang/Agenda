#!/usr/bin/env node
/* =====================================================================
 * F3.5.4B — PREVIEWS OBRIGATÓRIOS (screenshots REAIS do código do aplicativo).
 * NÃO é mockup nem IA generativa: extrai o kbv2Card REAL + TODOS os blocos <style>
 * REAIS do index.html (ANTES = git show f5a38a3 [1.0.194 PUBLICADA, pin imutável];
 * DEPOIS = árvore atual com a correção) e fotografa em Chromium nas resoluções exigidas.
 * Entrega os 18 previews da autorização + métricas objetivas (todos os temas
 * visíveis, zero scroll interno, zero corte, primeiro/último card íntegros).
 * Rodar: node desktop/scripts/f354b-visual-proof.mjs
 * Saída: docs/f354b-visual/*.png + docs/f354b-visual/metrics-f354b.json
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, 'docs', 'f354b-visual');
fs.mkdirSync(OUT, { recursive: true });

const SRC_DEPOIS = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const BASE_194_SHA = 'f5a38a35934dd92203a87e76e23d267e18bd974c';   /* 1.0.194 publicada (v1.0.194) */
const SRC_ANTES = execSync('git show ' + BASE_194_SHA + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();

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
/* stubs mínimos parametrizáveis por tarefa (t._resp/_next/_stlabel/_sla) — funções REAIS acima */
const PRELUDE =
  'var state={user:{id:"adm"},users:[' +
  '{id:"u1",name:"Miercohévisk Niheb Ferreira Nascimento Carlôto",role:"Social Media"},' +
  '{id:"u2",name:"Ana Beatriz Nogueira",role:"Administradora"},' +
  '{id:"u3",name:"Pedro Henrique Sales",role:"Social Media"}]};\n' +
  'function respOf(t){return (t&&t._resp)||{id:"rb",name:"Boaz Macêdo",role:"Editor"};}\n' +
  'function avatar(u,s){var n=(u&&u.name)||"?";var i=n.split(/\\s+/).map(function(p){return p[0]||"";}).slice(0,2).join("").toUpperCase();return \'<div class="av" style="width:\'+s+\'px;height:\'+s+\'px;font-size:\'+Math.round(s*0.36)+\'px;background:#5B6CFF;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800">\'+i+\'</div>\';}\n' +
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
  'function deriveCanonicalPerspective(t,p){var done=(t&&t.status)==="concluido";return {key:done?"concluido":"andamento",label:(t&&t._stlabel)||(done?"Concluído":"Em produção"),color:done?"#2FCF8F":"#F59E0B",next:done?"":((t&&t._next)||"Enviar ao cliente")};}\n' +
  'function isTaskCompleted(t){return (t&&t.status)==="concluido";}\n' +
  'function kbv2SlaLocal(t){return (t&&t._sla)||{sev:"neutro",label:""};}\n' +
  'function canDelTask(t){return true;}\n' +
  'function isDesignerAxisMove(t){return false;}\n' +
  'function cardsFieldOf(t,k){return k==="legenda"?String(t.cardLegenda||""):String(t.cardObs||"");}\n' +
  'function isDesignerFlow(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}\n' +
  'function designerOf(t){return t&&t.designerAssignment?t.designerAssignment.designerId:null;}\n' +
  'function designerCol(t){return (t&&t.status)||"afazer";}\n';
function buildRenderers(HTML) {
  let SRC = ''; for (const n of NAMES) { const s = grabFrom(HTML, n); if (s) SRC += s + '\n'; }
  return new Function('localStorage', PRELUDE + SRC + '\nreturn {kbv2Card,kbv2BoardHtml};')({ getItem: () => null, setItem: () => { }, removeItem: () => { } });
}

/* ═══ FIXTURES realistas e DISTINTAS (nenhuma tarefa duplicada) ═══ */
const SLA_OK = { sev: 'azul', label: 'Em prazo' };
const T = {
  hv4: { id: 'HV1', title: 'EDIÇÃO DE VÍDEO', client: 'Hospital Visão', sector: 'edicao_midia', status: 'andamento', by: 'u1', createdAt: 1753500000000, dueDate: '2026-08-01', dueTime: '16:00', _sla: SLA_OK, _next: 'Concluir e enviar para revisão', _resp: { id: 'rb', name: 'Boaz Macêdo', role: 'Editor' }, videos: [{ id: 'v1', n: 1, tema: 'VÍDEO HV 1 - Dr. Fernando Gadelha' }, { id: 'v2', n: 2, tema: 'VÍDEO HV 2 - Dr. Fernando Gadelha' }, { id: 'v3', n: 3, tema: 'VÍDEO HV 3 - Dr. Fernando Gadelha' }, { id: 'v4', n: 4, tema: 'VÍDEO HV 4 - Dr. Fernando Gadelha' }], checklist: [{ d: false }, { d: false }, { d: false }, { d: false }, { d: false }] },
  rot1: { id: 'RT1', title: 'Roteiro — vídeo do prato da casa', client: 'Sabor & Arte Bistrô', sector: 'roteiro', status: 'afazer', by: 'u2', createdAt: 1753600000000, dueDate: '2026-08-05', dueTime: '10:00', _next: 'Escrever o gancho inicial', _resp: { id: 'rc', name: 'Caio Souza', role: 'Designer' }, cronContents: [{ tema: 'Gancho: o chef conta a história do prato mais pedido da casa' }] },
  cron8: { id: 'CR8', title: 'Cronograma quinzenal — Agosto', client: 'Clínica OdontoPrime', sector: 'cronograma', status: 'andamento', by: 'u3', createdAt: 1753610000000, dueDate: '2026-08-03', dueTime: '12:00', _sla: SLA_OK, _next: 'Aprovar temas com o cliente', _resp: { id: 'rl', name: 'Bruna Lima', role: 'Designer' }, cronContents: [{ tema: 'Prevenção: check-up semestral' }, { tema: 'Bastidores do consultório' }, { tema: 'Depoimento de paciente' }, { tema: 'Clareamento — mitos e verdades' }, { tema: 'Equipe em foco: ortodontia' }, { tema: 'Antes e depois (caso real)' }, { tema: 'Dica rápida: fio dental' }, { tema: 'Agenda aberta de agosto' }] },
  cron12: { id: 'CR12', title: 'Calendário mensal de conteúdo', client: 'Bella Moda', sector: 'cronograma', status: 'andamento', by: 'u2', createdAt: 1753620000000, dueDate: '2026-08-07', dueTime: '18:00', _next: 'Enviar ao cliente', _resp: { id: 'ra', name: 'Ana Paula Reis', role: 'Social Media' }, cronContents: [{ tema: 'Lançamento coleção inverno' }, { tema: 'Look da semana #1' }, { tema: 'Bastidores do ensaio' }, { tema: 'Prova social: clientes reais' }, { tema: 'Promo relâmpago de quarta' }, { tema: 'Look da semana #2' }, { tema: 'Guia de tamanhos' }, { tema: 'Combina ou não combina?' }, { tema: 'Look da semana #3' }, { tema: 'Depoimento da influencer parceira' }, { tema: 'Esquenta liquidação' }, { tema: 'Recap do mês + expectativa setembro' }] },
  nomeLongo: { id: 'NL1', title: 'Posts do fim de semana', client: 'Auto Center Ravel', sector: 'programacao_posts', status: 'andamento', by: 'u1', createdAt: 1753630000000, dueDate: '2026-08-02', dueTime: '09:00', _next: 'Agendar no Meta Business', _resp: { id: 'rm', name: 'Maria Auxiliadora dos Santos Albuquerque', role: 'Social Media' } },
  tituloLongo: { id: 'TL1', title: 'Campanha completa de reinauguração da unidade centro com cobertura em tempo real nos stories e posts no feed', client: 'Clínica OdontoPrime', sector: 'cronograma', status: 'andamento', by: 'u3', createdAt: 1753640000000, dueDate: '2026-08-06', dueTime: '14:00', _sla: SLA_OK, _next: 'Fechar pauta com a diretoria', _resp: { id: 'rl', name: 'Bruna Lima', role: 'Designer' }, cronContents: [{ tema: 'Teaser da reinauguração' }, { tema: 'Convite oficial em vídeo' }] },
  proximaLonga: { id: 'PL1', title: 'Vídeo de depoimentos', client: 'Hospital Visão', sector: 'edicao_midia', status: 'revisao', by: 'u2', createdAt: 1753650000000, dueDate: '2026-07-28', dueTime: '17:00', _next: 'Ajustar a trilha sonora, regravar o trecho da recepção e reenviar para aprovação final da diretoria', _resp: { id: 'rb', name: 'Boaz Macêdo', role: 'Editor' }, videos: [{ id: 'p1', n: 1, tema: 'Depoimento — paciente de catarata' }, { id: 'p2', n: 2, tema: 'Depoimento — cirurgia refrativa' }], checklist: [{ d: true }, { d: true }, { d: false }] },
  vencida: { id: 'VC1', title: 'Reels — semana do cliente', client: 'Sabor & Arte Bistrô', sector: 'edicao_midia', status: 'andamento', by: 'u3', createdAt: 1753400000000, dueDate: '2026-07-29', dueTime: '18:00', _sla: { sev: 'vermelho', label: 'SLA estourado' }, _next: 'Priorizar corte final hoje', _resp: { id: 'rc', name: 'Caio Souza', role: 'Designer' }, videos: [{ id: 'r1', n: 1, tema: 'Reel — prato em 15 segundos' }] },
  concluida: { id: 'OK1', title: 'Cards — cardápio de inverno', client: 'Sabor & Arte Bistrô', sector: 'edicao_cards', status: 'concluido', by: 'u2', createdAt: 1753300000000, dueDate: '2026-07-27', dueTime: '12:00', cardLegenda: 'Chegou o cardápio de inverno! 🍲 Caldos e massas artesanais até 30/08.', cardObs: 'Aprovado pelo cliente em 27/07.', _resp: { id: 'ra', name: 'Ana Paula Reis', role: 'Social Media' } },
  reaberta: { id: 'RB1', title: 'Post institucional — LGPD', client: 'Auto Center Ravel', sector: 'edicao_cards', status: 'andamento', by: 'u1', createdAt: 1753660000000, dueDate: '2026-08-04', dueTime: '11:00', _stlabel: 'Reaberta — em produção', _next: 'Aplicar ajuste pedido pelo cliente', cardLegenda: 'Seus dados protegidos: conheça nossa política de privacidade.', cardObs: 'Reaberta: trocar a foto de capa.', _resp: { id: 'rm', name: 'Maria Auxiliadora dos Santos Albuquerque', role: 'Social Media' } },
};

function probeHtml(css, inner, title) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '\nbody{background:#0A0B10;margin:0}\n</style></head>' +
    '<body class="desktop"><div id="content" class="board-mode" style="height:100vh;box-sizing:border-box;display:flex;flex-direction:column;padding:14px 16px">' +
    (title ? '<div style="color:#8b94a6;font:700 12px Segoe UI,system-ui;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px 4px">' + title + '</div>' : '') +
    inner + '</div></body></html>';
}
const col = (label, color, tasks) => ({ label, color, key: 'andamento', tasks });

/* métricas objetivas coletadas DENTRO da página */
const MEASURE = `(() => {
  const out = { cards: [], colScroll: [] };
  document.querySelectorAll('.kbv2-column').forEach((c, ci) => {
    const body = c.querySelector('.kbv2-column-body');
    out.colScroll.push({ col: ci, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, colScrolls: body.scrollHeight > body.clientHeight + 1 });
  });
  document.querySelectorAll('.kbv2-card').forEach((card) => {
    const list = card.querySelector('.kbv2-themes-list');
    const themes = [...card.querySelectorAll('.kbv2-theme')];
    const cs = list ? getComputedStyle(list) : null;
    const ft = themes[0] ? getComputedStyle(themes[0]).fontSize : null;
    const cr = card.getBoundingClientRect();
    const overRight = [...card.querySelectorAll('*')].some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > cr.right + 0.6; });
    out.cards.push({
      id: (card.querySelector('[data-detail]')||{}).dataset ? card.querySelector('[data-detail]').dataset.detail : null,
      cardHeight: Math.round(cr.height),
      themesTotal: themes.length,
      themesVisible: themes.filter(el => { const r = el.getBoundingClientRect(); return r.height > 4 && getComputedStyle(el).display !== 'none'; }).length,
      listInternalScroll: list ? (list.scrollHeight > list.clientHeight + 1) : false,
      listOverflowY: cs ? cs.overflowY : null,
      themeFontSize: ft,
      hasMaisN: !!card.querySelector('.kbv2-themes-more'),
      contentOverflowsRight: overRight,
    });
  });
  return out;
})()`;

const { chromium } = require('playwright');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RES = { r1350: [1350, 689], r1366: [1366, 768], r1600: [1600, 900], r1920: [1920, 1080] };

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const metrics = { geradoEm: 'F3.5.4B (working tree local — sem commit)', resolucoes: {}, cenas: {} };
  const MD = buildRenderers(SRC_DEPOIS); const cssD = cssOf(SRC_DEPOIS);
  const MA = buildRenderers(SRC_ANTES); const cssA = cssOf(SRC_ANTES);

  async function shot(name, html, vw, vh, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: opts.dsf || 1 });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    if (opts.prep) await page.evaluate(opts.prep);
    let m = null; if (opts.measure !== false) m = await page.evaluate(MEASURE);
    if (opts.clipSel) {
      const el = page.locator(opts.clipSel).first();
      await el.screenshot({ path: path.join(OUT, name + '.png') });
    } else {
      await page.screenshot({ path: path.join(OUT, name + '.png') });
    }
    await ctx.close();
    if (m) metrics.cenas[name] = m;
    console.log('  ✓', name + '.png');
    return m;
  }

  /* 1-2 + responsividade: QUADRO COMPLETO (3 colunas realistas) nas 4 resoluções */
  const boardFull = MD.kbv2BoardHtml([
    col('A Fazer', '#8B94A6', [T.rot1, T.cron12]),
    col('Em andamento', '#F2A93B', [T.hv4, T.vencida, T.reaberta]),
    col('Revisão', '#5B6CFF', [T.proximaLonga, T.concluida]),
  ]);
  for (const [k, [w, h]] of Object.entries(RES)) {
    await shot('01-quadro-completo-' + w + 'x' + h, probeHtml(cssD, boardFull, 'F3.5.4B · quadro completo · ' + w + '×' + h), w, h);
    metrics.resolucoes[k] = [w, h];
  }

  /* 3-6: 1 / 4 / 8 / 12 temas (DEPOIS — todos visíveis, card natural) */
  const single = (t, label) => probeHtml(cssD, MD.kbv2BoardHtml([col(label, '#F2A93B', [t])]), null);
  await shot('03-card-1-tema', single(T.rot1, 'Roteiro'), 720, 900);
  await shot('04-card-4-temas', single(T.hv4, 'Em andamento'), 720, 1000);
  await shot('05-card-8-temas', single(T.cron8, 'Cronograma'), 720, 1180);
  await shot('06-card-12-temas', single(T.cron12, 'Cronograma'), 720, 1500);

  /* 7-9: nome longo / título longo / próxima ação longa */
  await shot('07-nome-longo', single(T.nomeLongo, 'Programação'), 720, 900);
  await shot('08-titulo-longo', single(T.tituloLongo, 'Cronograma'), 720, 980);
  await shot('09-proxima-acao-longa', single(T.proximaLonga, 'Revisão'), 720, 1000);

  /* 10-11: coluna com UMA tarefa × VÁRIAS tarefas (rolagem NA COLUNA) */
  await shot('10-coluna-uma-tarefa', probeHtml(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [T.hv4])]), 'coluna com 1 tarefa'), 760, 768);
  const colVarias = MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [T.hv4, T.cron8, T.vencida, T.reaberta, T.nomeLongo])]);
  await shot('11-coluna-varias-tarefas', probeHtml(cssD, colVarias, 'coluna com várias tarefas (rolagem na COLUNA)'), 760, 768);

  /* 16-17: primeiro card sem corte (scroll topo) e último card sem corte (scroll fim) */
  await shot('16-primeiro-card-sem-corte', probeHtml(cssD, colVarias, 'primeiro card íntegro no topo'), 760, 768,
    { prep: `document.querySelector('.kbv2-column-body').scrollTop = 0` });
  await shot('17-ultimo-card-sem-corte', probeHtml(cssD, colVarias, 'último card íntegro na base'), 760, 768,
    { prep: `const b=document.querySelector('.kbv2-column-body'); b.scrollTop = b.scrollHeight` });

  /* 13-14: close-ups REAIS (elemento recortado): seção TEMAS e "por Miercohévisk" */
  await shot('13-closeup-temas', single(T.cron8, 'Cronograma'), 720, 1180, { clipSel: '.kbv2-card-themes' });
  await shot('14-closeup-por-primeiro-nome', single(T.hv4, 'Em andamento'), 720, 1000, { clipSel: '.kbv2-card-origin' });

  /* 15: menu de ações ABERTO (mesma mecânica do handler real: portal + .open) */
  await shot('15-menu-acoes-aberto', probeHtml(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [Object.assign({}, T.hv4, { designerAssignment: { designerId: 'rl' } })])]), 'menu ⋯ aberto (sem corte)'), 760, 900, {
    prep: `(() => { const btn=document.querySelector('[data-cardmenu]'); const w=btn.closest('.kbv2-more'); w.classList.add('open');
      const m=w.querySelector('.kbv2-menu'); document.body.appendChild(m); m.classList.add('open');
      const r=btn.getBoundingClientRect(); const mr=m.getBoundingClientRect();
      let lf=Math.max(8,Math.min(r.right-mr.width,window.innerWidth-mr.width-8)); let tp=r.bottom+8;
      if(tp+mr.height>window.innerHeight-8)tp=Math.max(8,window.innerHeight-mr.height-8);
      m.style.left=lf+'px'; m.style.top=tp+'px'; })()` });

  /* 18: escala 125% do Windows (deviceScaleFactor 1.25) */
  await shot('18-escala-125', probeHtml(cssD, boardFull, 'quadro completo · 1366×768 · escala 125%'), 1366, 768, { dsf: 1.25 });

  /* 12: comparativo ANTES (1.0.194 publicada) × DEPOIS (correção local) — mesma fixture */
  const cmpScene = (M, css) => probeHtml(css, M.kbv2BoardHtml([col('Em andamento', '#F2A93B', [T.hv4]), col('Cronograma', '#22D3B8', [T.cron12])]), null);
  const aCtx = await browser.newContext({ viewport: { width: 1180, height: 1250 } });
  const aPg = await aCtx.newPage(); await aPg.setContent(cmpScene(MA, cssA), { waitUntil: 'load' });
  const antesM = await aPg.evaluate(MEASURE); metrics.cenas['12-antes'] = antesM;
  await aPg.screenshot({ path: path.join(OUT, '_raw-antes.png') }); await aCtx.close();
  const dCtx = await browser.newContext({ viewport: { width: 1180, height: 1250 } });
  const dPg = await dCtx.newPage(); await dPg.setContent(cmpScene(MD, cssD), { waitUntil: 'load' });
  const depoisM = await dPg.evaluate(MEASURE); metrics.cenas['12-depois'] = depoisM;
  await dPg.screenshot({ path: path.join(OUT, '_raw-depois.png') }); await dCtx.close();
  const b64 = f => fs.readFileSync(path.join(OUT, f)).toString('base64');
  const cmpHtml = '<!doctype html><html><head><meta charset="utf-8"><style>body{background:#06070C;margin:0;font-family:Segoe UI,system-ui}h2{color:#eef2f8;font-size:15px;margin:10px 12px 6px}small{color:#8b94a6;font-weight:600}img{width:100%;display:block;border-radius:10px;border:1px solid rgba(255,255,255,.10)}</style></head><body>' +
    '<div style="display:flex;gap:14px;padding:12px">' +
    '<div style="flex:1"><h2>ANTES — 1.0.194 publicada <small>(temas ocultos “+N”, fonte 12px, nome completo)</small></h2><img src="data:image/png;base64,' + b64('_raw-antes.png') + '"></div>' +
    '<div style="flex:1"><h2>DEPOIS — correção F3.5.4B local <small>(todos os temas, fonte 13px, “por Miercohévisk”)</small></h2><img src="data:image/png;base64,' + b64('_raw-depois.png') + '"></div>' +
    '</div></body></html>';
  const cCtx = await browser.newContext({ viewport: { width: 2400, height: 1330 } });
  const cPg = await cCtx.newPage(); await cPg.setContent(cmpHtml, { waitUntil: 'load' });
  await cPg.screenshot({ path: path.join(OUT, '12-comparativo-antes-depois.png') }); await cCtx.close();
  console.log('  ✓ 12-comparativo-antes-depois.png');

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'metrics-f354b.json'), JSON.stringify(metrics, null, 2));
  console.log('\nmetrics-f354b.json gravado.');

  /* ═══ GATES objetivos sobre as métricas (falha = exit 1) ═══ */
  let bad = 0;
  const chk = (cond, msg) => { if (cond) console.log('  PASS — ' + msg); else { bad++; console.log('  FAIL — ' + msg); } };
  console.log('\n===== GATES F3.5.4B (medidos na página renderizada) =====');
  const dep = Object.entries(metrics.cenas).filter(([k]) => !k.startsWith('12-antes'));
  chk(dep.every(([, m]) => (m.cards || []).every(c => !c.hasMaisN)), 'nenhum "+N temas" em nenhuma cena DEPOIS');
  chk(dep.every(([, m]) => (m.cards || []).every(c => c.themesVisible === c.themesTotal)), 'TODOS os temas visíveis em TODOS os cards (1→1, 4→4, 8→8, 12→12)');
  chk(dep.every(([, m]) => (m.cards || []).every(c => !c.listInternalScroll)), 'ZERO scroll interno na lista de temas');
  chk(dep.every(([, m]) => (m.cards || []).every(c => !c.contentOverflowsRight)), 'nenhum conteúdo ultrapassa a borda direita do card');
  chk(metrics.cenas['05-card-8-temas'].cards[0].themeFontSize === '13px', 'fonte dos temas = 13px (antes 12px)');
  const a12 = metrics.cenas['12-antes'].cards.find(c => c.themesTotal === 12) || metrics.cenas['12-antes'].cards[1];
  const d12 = metrics.cenas['12-depois'].cards.find(c => c.themesTotal === 12) || metrics.cenas['12-depois'].cards[1];
  chk(a12 && a12.themesVisible === 2 && d12 && d12.themesVisible === 12, 'ANTES ocultava (12→2 visíveis); DEPOIS mostra 12/12');
  console.log('===== GATES: ' + (bad ? bad + ' FAIL' : 'todos PASS') + ' =====');
  process.exit(bad ? 1 : 0);
})();
