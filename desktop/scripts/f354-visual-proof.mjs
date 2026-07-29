#!/usr/bin/env node
/* =====================================================================
 * F3.5.4 — PROVA VISUAL OBRIGATÓRIA (ANTES 1.0.193 × DEPOIS candidata 1.0.194).
 * Gera páginas-sonda com o CSS REAL + kbv2Card REAL de cada versão (BASE = git show
 * <sha-base>; DEPOIS = working tree), fotografa em 1366×768 / 1600×900 / 1920×1080 e
 * SOBREPÕE GUIAS horizontais (topo do card, trilho, etapa, prazo, botões/rodapé, base)
 * por coluna, gravando também as MÉTRICAS de alinhamento em px (deltas entre colunas)
 * e a altura dos cards (redução % real ANTES→DEPOIS).
 * Cenas: incident (Edição de Cards × Edição de vídeos, 1 tarefa cada — a cena do print),
 *        multi (múltiplos cards), cron (Cronograma × Roteiro), designers (DEPOIS: faixa
 *        de seleção + quadro aberto automaticamente).
 * Rodar: NODE_PATH=/opt/node22/lib/node_modules node desktop/scripts/f354-visual-proof.mjs
 * Saída: docs/f354-visual/*.png + docs/f354-visual/metrics-f354.json
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, 'docs', 'f354-visual');
fs.mkdirSync(OUT, { recursive: true });
const BASE_SHA = '5f1c3cf5e53062e10764ec02d04a194f136c294e';

const SRC_DEPOIS = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const SRC_ANTES = execSync(`git show ${BASE_SHA}:desktop/src/renderer/index.html`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();

function grabFrom(HTML, n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '='); if (a < 0) a = HTML.indexOf('var ' + n + '=');
  if (a < 0) throw new Error('não encontrei: ' + n);
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  throw new Error('sem fim: ' + n);
}
function cssOf(HTML) { let out = '', i = 0; for (;;) { const a = HTML.indexOf('<style', i); if (a < 0) break; const s = HTML.indexOf('>', a) + 1; const b = HTML.indexOf('</style>', s); out += HTML.slice(s, b) + '\n'; i = b + 8; } return out; }

const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2Card', 'kbv2Empty', 'kbv2BoardHtml'];
const PRELUDE =
  'var state={user:{id:"u1"},users:[{id:"u1",name:"Marina Souza",role:"Social Media"}]};\n' +
  'function respOf(t){return {id:"u2",name:"Bruna Lima",role:"Designer"};}\n' +
  'function avatar(u,s){var n=(u&&u.name)||"?";var i=n.split(/\\s+/).map(function(p){return p[0]||"";}).slice(0,2).join("").toUpperCase();return \'<div class="av" style="width:\'+s+\'px;height:\'+s+\'px;font-size:\'+Math.round(s*0.36)+\'px;background:#5B6CFF;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800">\'+i+\'</div>\';}\n' +
  'function svg(k){return \'<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2" opacity=".65"/></svg>\';}\n' +
  'function fmtDateBR(d){var p=String(d||"").split("-");return p.length===3?(p[2]+"/"+p[1]+"/"+p[0]):String(d||"");}\n' +
  'function hasDesigner(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}\n' +
  'function designerStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientFacingStatusView(t){return clientStatusView(t);}\n' +
  'function taskTimeline(t){return {milestones:[{key:"a",state:"done"},{key:"b",state:"current"},{key:"c",state:""}],owner:{role:"Social",id:null}};}\n' +
  'function nextActionShort(t){return "Enviar ao cliente";}\n' +
  'function clientFacingNextShort(t){return "";}\n' +
  'function designerColView(t){return (t&&t.status)||"afazer";}\n' +
  'function designerNextShort(t){return "Produzir a arte";}\n' +
  'var TASK_PHASE={COMPLETED:"c",AWAITING_DESIGNER:"ad",AWAITING_CLIENT_APPROVAL:"acp",DESIGNER_PRODUCING:"dp",DESIGNER_REVISING:"dr",DESIGNER_DELIVERED:"dd"};\n' +
  'function deriveCanonicalTaskState(t){return {phase:"producing",owner:"social"};}\n' +
  'function deriveCanonicalPerspective(t,p){return {key:"andamento",label:"Em produção",color:"#F59E0B",next:"Enviar ao cliente"};}\n' +
  'function isTaskCompleted(t){return (t&&t.status)==="concluido";}\n' +
  'function kbv2SlaLocal(t){return {sev:"neutro",label:""};}\n' +
  'function canDelTask(t){return true;}\n' +
  'function isDesignerAxisMove(t){return false;}\n' +
  'function cardsFieldOf(t,k){return k==="legenda"?String(t.cardLegenda||""):String(t.cardObs||"");}\n' +
  'function isDesignerFlow(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}\n' +
  'function designerOf(t){return t&&t.designerAssignment?t.designerAssignment.designerId:null;}\n' +
  'function designerCol(t){return (t&&t.status)||"afazer";}\n';
function buildRenderers(HTML, withStrip) {
  let SRC = ''; for (const n of NAMES) SRC += grabFrom(HTML, n) + '\n';
  if (withStrip) SRC += grabFrom(HTML, 'DESIGNER_SEL_KEY') + '\n' + grabFrom(HTML, 'f354DesignerStrip') + '\n' + grabFrom(HTML, 'designerBoardsList') + '\n';
  const ret = withStrip ? 'return {kbv2Card,kbv2BoardHtml,f354DesignerStrip,designerBoardsList};' : 'return {kbv2Card,kbv2BoardHtml};';
  return new Function('localStorage', PRELUDE + SRC + '\n' + ret)({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
}

/* ── fixtures das cenas (idênticas p/ ANTES e DEPOIS) ── */
const LEG = 'Legenda do post com chamada completa para o cliente aprovar, incluindo hashtags e emojis 🚀✨ — texto realista de produção.';
const OBS = 'Usar a paleta nova aprovada; exportar em 1080×1350; revisar ortografia antes de enviar.';
const tCards = { id: 'C1', title: 'Card promocional — Setembro', client: 'Hospital Visão', sector: 'edicao_cards', status: 'andamento', by: 'u1', createdAt: 1751900000000, dueDate: '2026-08-02', dueTime: '17:00', cardLegenda: LEG, cardObs: OBS, checklist: [] };
const tVideo = { id: 'V1', title: 'Vídeo institucional — Setembro', client: 'Hospital Visão', sector: 'edicao_videos', status: 'andamento', by: 'u1', createdAt: 1751900000000, dueDate: '2026-08-02', dueTime: '17:00', cronContents: [{ tema: 'Abertura com depoimento' }, { tema: 'Tour pela clínica' }, { tema: 'Encerramento com CTA' }], checklist: [{ d: true }, { d: true }, { d: false }, { d: false }, { d: false }] };
const tCron = { id: 'K1', title: 'Cronograma semanal — Agosto', client: 'OTOCP', sector: 'cronograma', status: 'andamento', by: 'u1', createdAt: 1751900000000, dueDate: '2026-08-03', dueTime: '12:00', cronContents: [{ tema: 'Tema 1 — Prevenção' }, { tema: 'Tema 2 — Bastidores' }, { tema: 'Tema 3 — Depoimento' }, { tema: 'Tema 4 — Equipe' }], checklist: [] };
const tRot = { id: 'R1', title: 'Roteiro — vídeo de captação', client: 'OTOCP', sector: 'roteiro', status: 'andamento', by: 'u1', createdAt: 1751900000000, dueDate: '2026-08-04', dueTime: '10:00', cronContents: [{ tema: 'Gancho inicial' }, { tema: 'Oferta' }], checklist: [] };
const many = (t, n) => Array.from({ length: n }, (_, i) => Object.assign({}, t, { id: t.id + '_' + i, title: t.title + ' #' + (i + 1) }));

function scenes(M) {
  return {
    incident: M.kbv2BoardHtml([
      { label: 'Edição de Cards', color: '#F2A93B', key: 'andamento', tasks: [tCards] },
      { label: 'Edição de vídeos', color: '#5B6CFF', key: 'andamento', tasks: [tVideo] },
    ]),
    multi: M.kbv2BoardHtml([
      { label: 'Edição de Cards', color: '#F2A93B', key: 'andamento', tasks: many(tCards, 3) },
      { label: 'Edição de vídeos', color: '#5B6CFF', key: 'andamento', tasks: many(tVideo, 2) },
    ]),
    cron: M.kbv2BoardHtml([
      { label: 'Cronograma', color: '#22D3B8', key: 'andamento', tasks: [tCron] },
      { label: 'Roteiro', color: '#A78BFA', key: 'andamento', tasks: [tRot] },
    ]),
  };
}

function probeHtml(css, inner, title) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '\nbody{background:#0A0B10;margin:0}\n</style></head>' +
    '<body class="desktop"><div id="content" class="board-mode" style="height:100vh;box-sizing:border-box;display:flex;flex-direction:column;padding:14px 16px"><div style="color:#8b94a6;font:700 12px Segoe UI,system-ui;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px 4px">' + title + '</div>' + inner + '</div></body></html>';
}

/* ── overlay de guias + métricas (roda DENTRO da página) ── */
const OVERLAY = `(() => {
  const marks = [['topo', (c)=>c, '#22D3EE'], ['trilho', (c)=>c.querySelector('.kbv2-card-rail'), '#F2A93B'],
    ['etapa', (c)=>c.querySelector('.kbv2-stage2'), '#A78BFA'], ['prazo', (c)=>c.querySelector('.kbv2-card-date'), '#2FCF8F'],
    ['botões', (c)=>c.querySelector('.kbv2-card-footer'), '#EF4444']];
  const cols = [...document.querySelectorAll('.kbv2-column')];
  const out = { columns: [] };
  cols.forEach((col, ci) => {
    const card = col.querySelector('.kbv2-card'); if (!card) return;
    const cr = card.getBoundingClientRect();
    const rec = { col: ci, cardTop: cr.top, cardBottom: cr.bottom, cardHeight: cr.height, blocks: {} };
    marks.forEach(([name, sel, color]) => {
      const el = sel(card); if (!el) return;
      const r = el.getBoundingClientRect();
      rec.blocks[name] = r.top;
      const line = document.createElement('div');
      line.style.cssText = 'position:fixed;left:' + (ci === 0 ? 0 : 50) + '%;width:50%;top:' + (r.top - 1) + 'px;height:0;border-top:2px ' + (ci === 0 ? 'solid' : 'dashed') + ' ' + color + ';z-index:9999;pointer-events:none;opacity:.9';
      const tag = document.createElement('span');
      tag.textContent = name + ' ' + Math.round(r.top) + 'px';
      tag.style.cssText = 'position:absolute;' + (ci === 0 ? 'left:6px' : 'right:6px') + ';top:-16px;font:700 10px Segoe UI;color:' + color + ';background:rgba(10,11,16,.85);padding:1px 6px;border-radius:4px';
      line.appendChild(tag); document.body.appendChild(line);
    });
    const bot = document.createElement('div');
    bot.style.cssText = 'position:fixed;left:' + (ci === 0 ? 0 : 50) + '%;width:50%;top:' + (cr.bottom - 1) + 'px;border-top:2px ' + (ci === 0 ? 'solid' : 'dashed') + ' #6d5efc;z-index:9999;pointer-events:none;opacity:.9';
    document.body.appendChild(bot);
    out.columns.push(rec);
  });
  if (out.columns.length === 2) {
    const [a, b] = out.columns; out.deltas = { topo: Math.abs(a.cardTop - b.cardTop), base: Math.abs(a.cardBottom - b.cardBottom), altura: Math.abs(a.cardHeight - b.cardHeight) };
    for (const k of Object.keys(a.blocks)) if (b.blocks[k] != null) out.deltas[k] = Math.abs(a.blocks[k] - b.blocks[k]);
  }
  return out;
})()`;

const { chromium } = require('playwright');
const RES = [[1366, 768], [1600, 900], [1920, 1080]];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const metrics = {};
  for (const [tag, SRC] of [['antes', SRC_ANTES], ['depois', SRC_DEPOIS]]) {
    const M = buildRenderers(SRC, false);
    const css = cssOf(SRC);
    const sc = scenes(M);
    if (tag === 'depois') {
      const M2 = buildRenderers(SRC, true);
      const dzTasks = [Object.assign({}, tCards, { id: 'D1', designerAssignment: { designerId: 'dz1' } }), Object.assign({}, tVideo, { id: 'D2', designerAssignment: { designerId: 'dz2' } })];
      const stripCtx = new Function('localStorage', PRELUDE.replace('state={user:{id:"u1"}', 'state={user:{id:"adm"}').replace(',users:[{id:"u1",name:"Marina Souza",role:"Social Media"}]', ',users:[{id:"dz1",name:"Bruna Lima",role:"Designer"},{id:"dz2",name:"Caio Souza",role:"Designer"}],tasks:' + JSON.stringify(dzTasks)) + [ 'DESIGNER_SEL_KEY','f354DesignerStrip','designerBoardsList' ].map(n=>grabFrom(SRC,n)).join('\n') + '\nreturn f354DesignerStrip("dz1");')({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
      sc.designers = stripCtx + M2.kbv2BoardHtml([
        { label: 'A Fazer', color: '#9BA0AB', key: 'afazer', tasks: [Object.assign({}, tCards, { id: 'DA', status: 'afazer' })] },
        { label: 'Em andamento', color: '#F59E0B', key: 'andamento', tasks: [Object.assign({}, tVideo, { id: 'DB' })] },
      ]);
    }
    for (const [scene, inner] of Object.entries(sc)) {
      const file = path.join(OUT, `probe-${tag}-${scene}.html`);
      fs.writeFileSync(file, probeHtml(css, inner, `F3.5.4 — ${tag.toUpperCase()} (${tag === 'antes' ? '1.0.193' : 'candidata 1.0.194'}) · ${scene}`));
      for (const [w, h] of RES) {
        const pg = await browser.newPage({ viewport: { width: w, height: h } });
        await pg.goto('file://' + file);
        await pg.waitForTimeout(120);
        const m = await pg.evaluate(OVERLAY);
        metrics[`${tag}-${scene}-${w}x${h}`] = m;
        await pg.screenshot({ path: path.join(OUT, `${tag}-${scene}-${w}x${h}.png`) });
        await pg.close();
      }
      fs.unlinkSync(file);
    }
  }
  await browser.close();
  /* redução real de altura (cena incident, coluna 0=Cards, 1×res) + deltas de alinhamento */
  const resumo = {};
  for (const [w, h] of RES) {
    const A = metrics[`antes-incident-${w}x${h}`], D = metrics[`depois-incident-${w}x${h}`];
    resumo[`${w}x${h}`] = {
      alturaAntes: A.columns.map((c) => Math.round(c.cardHeight)),
      alturaDepois: D.columns.map((c) => Math.round(c.cardHeight)),
      reducaoPct: A.columns.map((c, i) => Math.round((1 - D.columns[i].cardHeight / c.cardHeight) * 1000) / 10),
      deltasDepois: D.deltas, deltasAntes: A.deltas,
    };
  }
  fs.writeFileSync(path.join(OUT, 'metrics-f354.json'), JSON.stringify({ resumo, metrics }, null, 2));
  console.log(JSON.stringify(resumo, null, 2));
  console.log('PROVAS VISUAIS OK →', OUT);
})();
