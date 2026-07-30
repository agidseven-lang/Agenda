#!/usr/bin/env node
/* =====================================================================
 * F3.5.4F — PREVIEWS REAIS (16 da autorização) + MÉTRICAS OBRIGATÓRIAS.
 * NÃO é IA generativa: extrai kbv2Card/banda/updater/toast REAIS do index.html
 * (DEPOIS = árvore F3.5.4F; ANTES = git show e3a1a5b [1.0.196 APROVADA]) e a
 * janela REAL de background (bgnotify.html), fotografando em Chromium.
 * Relógio determinístico: canonicalNowMs stubado lê NOWBOX.v/__NOW (nenhuma
 * dependência de máquina). Métricas: banda dentro do card, nome não sobrepõe o
 * cronômetro, contador sem corte, amarelo/vermelho MESMO componente (só cor),
 * shell 1.0.196 Δ0 quando a banda está oculta, nenhum scroll interno novo.
 * Rodar: NODE_PATH=/opt/node22/lib/node_modules node desktop/scripts/f354f-visual-proof.mjs
 * Saída: docs/f354f-visual/*.png + metrics-f354f.json
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, 'docs', 'f354f-visual');
fs.mkdirSync(OUT, { recursive: true });
const BASE_196_SHA = 'e3a1a5b227fd7b4e57b822b1b30c38e0b0b56371';
const SRC_DEPOIS = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const SRC_ANTES = execSync('git show ' + BASE_196_SHA + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
const BGHTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'bgnotify.html'), 'utf8');
const NE = require(path.join(DESK, 'src', 'main', 'notifEvents.js'));
const SR = require(path.join(DESK, 'src', 'main', 'slaRules.js'));

function grabFrom(HTML, n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '='); if (a < 0) a = HTML.indexOf('var ' + n + '=');
  if (a < 0) return null;
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  return null;
}
function cssOf(HTML) { let out = '', i = 0; for (;;) { const a = HTML.indexOf('<style', i); if (a < 0) break; const s = HTML.indexOf('>', a) + 1; const b = HTML.indexOf('</style>', s); out += HTML.slice(s, b) + '\n'; i = b + 8; } return out; }

/* avatarzinhos REAIS (data-URI — fotos determinísticas, sem rede) */
const FOTO = (bg, ini) => "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='${bg}'/><circle cx='48' cy='36' r='17' fill='rgba(255,255,255,.85)'/><rect x='18' y='58' width='60' height='30' rx='15' fill='rgba(255,255,255,.85)'/><text x='48' y='92' font-size='0'>${ini}</text></svg>`);
const FOTO_BOAZ = FOTO('#7A5CFF', 'BM'), FOTO_ARY = FOTO('#0E9F6E', 'AN');

const NAMES_CARD = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2FirstName', 'kbv2Card', 'kbv2Empty', 'kbv2BoardHtml',
  /* SLA real (fonte única) */ 'SLA_PANEL_WARN_MS', 'SLA_PANEL_GRACE_MS', 'slaPanelFinishMs', 'slaPanelDelivered', 'resolveTaskDisplayState', 'SECTOR_SLA', 'slaCfgDefault', 'slaCfgOf', '_slaScheduleRevOf', 'resolveCanonicalSlaTimeline', 'kbv2SlaLocal', 'isTaskCompleted',
  /* F3.5.4F reais */ 'F354F_CARDS_WARN_MS', 'f354fPad2', 'f354fSpan', 'kbv2SlaLiveData', 'f354fSlaLiveState',
  /* identidade real */ 'UCOLORS', 'userColor', 'initials', 'photoOf', 'avatar', 'designerOf', 'hasDesigner', 'isDesignerFlow'];

const PRELUDE =
  'var NOWBOX={v:0};\n' +
  'function canonicalNowMs(){return NOWBOX.v||Date.now();}\n' +
  'var state={user:{id:"sm1"},users:[' +
  '{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media",photo:"' + FOTO_ARY + '"},' +
  '{id:"desA",name:"Boaz Macêdo",role:"Designer",photo:"' + FOTO_BOAZ + '"},' +
  '{id:"desB",name:"João Pedro Albuquerque",role:"Designer"}]};\n' +
  'function respOf(t){if(t&&t._resp)return t._resp;var id=(t&&(t.assigneeId||(t.designerAssignment&&t.designerAssignment.designerId)))||null;return state.users.find(function(u){return u.id===id;})||null;}\n' +
  'function svg(k){var P={swap:"M7 4l-4 4 4 4M3 8h14M17 20l4-4-4-4M21 16H7",person:"M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0",check:"M4 12l5 5L20 6",flag:"M5 3v18M5 4h11l-2 4 2 4H5",arr:"M5 12h14M13 6l6 6-6 6",send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",trash:"M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",editnote:"M4 20h4L19 9l-4-4L4 16v4zM13 6l4 4",description:"M6 2h9l5 5v15H6zM14 2v6h6",notes:"M4 6h16M4 12h16M4 18h10"};var d=P[k]||"M12 5v14M5 12h14";return \'<svg viewBox="0 0 24 24" fill="none"><path d="\'+d+\'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>\';}\n' +
  'function fmtDateBR(d){var p=String(d||"").split("-");return p.length===3?(p[2]+"/"+p[1]+"/"+p[0]):String(d||"");}\n' +
  'function taskTimeline(t){return {milestones:[{key:"a",state:"done"},{key:"b",state:"current"},{key:"c",state:""},{key:"d",state:""}],owner:{role:(t&&t._ownrole)||"Social",id:null}};}\n' +
  'function nextActionShort(t){return (t&&t._next)||"Produzir a arte";}\n' +
  'function clientFacingNextShort(t){return "";}\n' +
  'function designerColView(t){return (t&&t.status)||"afazer";}\n' +
  'function designerNextShort(t){return "Produzir a arte";}\n' +
  'function designerStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientFacingStatusView(t){return clientStatusView(t);}\n' +
  'function deriveCanonicalTaskState(t){return {phase:"producing",owner:"social"};}\n' +
  'function canDelTask(t){return true;}\n' +
  'function isDesignerAxisMove(t){return false;}\n' +
  'function canSeeAll(u){return true;}\n' +
  'function cardsFieldOf(t,k){return k==="legenda"?String((t&&t.cardLegenda)||""):String((t&&t.cardObs)||"");}\n';

function build(HTML) {
  let S = ''; for (const n of NAMES_CARD) { const s = grabFrom(HTML, n); if (s) S += s + '\n'; }
  return new Function('localStorage', PRELUDE + S + '\nreturn {kbv2Card:kbv2Card,kbv2BoardHtml:kbv2BoardHtml,setNow:function(v){NOWBOX.v=v;},hasLive:typeof kbv2SlaLiveData==="function"};')({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
}

/* fixtures realistas */
const DUE_MS = SR.dtMs('2026-07-30', '17:59');              // prazo canônico das cenas
const NOW_A = DUE_MS - (29 * 60 + 43) * 1000;               // amarela: faltam 29m 43s
const NOW_R = DUE_MS - (9 * 60 + 18) * 1000;                // vermelha: faltam 09m 18s
const NOW = NOW_A;                                          // relógio padrão da sessão de fotos
const msToDT = (ms) => { const d = new Date(ms); const p = (n) => (n < 10 ? '0' : '') + n; return { date: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), time: p(d.getHours()) + ':' + p(d.getMinutes()) }; };
function cardsTask(id, title, dueMs, extra) {
  const dt = msToDT(dueMs);
  return Object.assign({ id, title, client: 'Hospital Visão', sector: 'edicao_cards', status: 'andamento', by: 'sm1',
    createdAt: NOW - 6 * 3600000, assignee: 'Boaz Macêdo', assigneeId: 'desA',
    dueDate: dt.date, dueTime: dt.time, due: dt.date, startDate: '2026-07-30', startTime: '08:00', endDate: dt.date, endTime: dt.time,
    cardTema: title, cardLegenda: 'Qualidade de vida começa aqui: agende sua consulta.', cardObs: '', cardDeadlineRev: 1, checklist: [{ d: true }, { d: false }],
    designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', designerPhoto: FOTO_BOAZ, assignedAt: NOW - 6 * 3600000, assignedBy: 'sm1', assignedByName: 'Arydyjany Nascimento', status: 'sent', startDate: '2026-07-30', startTime: '08:00', endDate: dt.date, endTime: dt.time, obs: '' },
    _next: 'Produzir a arte do card' }, extra || {});
}
const TA = cardsTask('T1', 'Qualidade de vida começa aqui', DUE_MS);
const TR = cardsTask('T2', 'Card — campanha de exames', DUE_MS);
const TB = cardsTask('T3', 'Card — dicas de saúde ocular', SR.dtMs('2026-07-31', '10:00'), { assigneeId: 'desB', assignee: 'João Pedro Albuquerque', designerAssignment: { designerId: 'desB', designerName: 'João Pedro Albuquerque', assignedAt: NOW - 3600000, assignedBy: 'sm1', status: 'sent' } });
const TA2B = cardsTask('T1', 'Qualidade de vida começa aqui', DUE_MS, { assigneeId: 'desB', assignee: 'João Pedro Albuquerque', designerAssignment: { designerId: 'desB', designerName: 'João Pedro Albuquerque', assignedAt: NOW, assignedBy: 'sm1', status: 'sent' } });
const DUE_NEWMS = SR.dtMs('2026-07-30', '19:30');
const TA_EDITED = cardsTask('T1', 'Qualidade de vida começa aqui', DUE_NEWMS, { cardDeadlineRev: 2, updatedAt: NOW, updatedBy: 'sm1', updatedByName: 'Arydyjany Nascimento' });

const col = (label, color, tasks) => ({ label, color, key: 'andamento', tasks });
function probe(css, inner, title) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + css + '\nbody{background:#0A0B10;margin:0}\n</style></head>' +
    '<body class="desktop"><div id="content" class="board-mode" style="height:100vh;box-sizing:border-box;display:flex;flex-direction:column;padding:14px 16px">' +
    (title ? '<div style="color:#8b94a6;font:700 12px Segoe UI,system-ui;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px 4px">' + title + '</div>' : '') + inner + '</div></body></html>';
}

/* MÉTRICAS por card: shell + banda (caixas, corte, sobreposição, scroll) */
const MEASURE = `(() => {
  const out = [];
  document.querySelectorAll('.kbv2-card').forEach(card => {
    const cr = card.getBoundingClientRect(); const cs = getComputedStyle(card);
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { t: Math.round(r.top - cr.top), l: Math.round(r.left - cr.left), w: Math.round(r.width), h: Math.round(r.height) }; };
    const band = card.querySelector('.kbv2-sla-live');
    const count = card.querySelector('.kbv2-sla-live-c');
    const nameEl = card.querySelector('.kbv2-sla-live-n');
    out.push({
      w: Math.round(cr.width), h: Math.round(cr.height),
      pad: cs.paddingLeft, radius: cs.borderRadius,
      hscroll: card.scrollWidth > card.clientWidth + 1,
      offProfile: box(card.querySelector('.kbv2-card-profile')) && box(card.querySelector('.kbv2-card-profile')).t,
      offTitle: box(card.querySelector('.kbv2-title')) && box(card.querySelector('.kbv2-title')).t,
      band: band ? { hidden: band.hidden, cls: band.className, box: box(band),
        count: count ? { text: count.textContent, box: box(count), clipped: count.scrollWidth > count.clientWidth + 1 } : null,
        name: nameEl ? { text: nameEl.textContent, box: box(nameEl) } : null,
        avatar: box(band.querySelector('.av')),
        inside: band.hidden ? true : (() => { const b = band.getBoundingClientRect(); return b.left >= cr.left - 1 && b.right <= cr.right + 1; })() } : null,
      panelScroll: (() => { const p = card.querySelector('.kbv2-card-themes,.kbv2-card-notes'); if (!p) return false; return p.scrollHeight > p.clientHeight + 2; })(),
    });
  });
  return out;
})()`;

(async () => {
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const { chromium } = require('playwright');
  const EXE = (() => { const base = '/opt/pw-browsers'; const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium')); for (const d of dirs) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } return undefined; })();
  const browser = await chromium.launch({ executablePath: EXE });
  const MD = build(SRC_DEPOIS), cssD = cssOf(SRC_DEPOIS);
  const MA = build(SRC_ANTES), cssA = cssOf(SRC_ANTES);
  const metrics = { cenas: {}, gates: {} };
  let fails = 0;
  const gate = (k, cond, detail) => { metrics.gates[k] = { ok: !!cond, detail: detail || '' }; if (!cond) { fails++; console.error('  ✘ GATE', k, detail || ''); } else console.log('  ✔ GATE', k); };

  async function shot(name, html, w, h, opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: opts.dsf || 1 });
    const pg = await ctx.newPage();
    if (opts.init) await pg.addInitScript(opts.init);
    await pg.setContent(html, { waitUntil: 'load' });
    if (opts.prep) await pg.evaluate(opts.prep);
    metrics.cenas[name] = await pg.evaluate(opts.measure || MEASURE);
    await pg.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close();
    console.log('  ✓', name + '.png');
    return metrics.cenas[name];
  }

  MD.setNow(NOW_A); MA.setNow(NOW_A);
  console.log('── cenas 1-2: banda amarela e vermelha (foto+nome+contador reais) ──');
  const m1 = await shot('01-alerta-amarelo-foto-nome-contador', probe(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [TA])]), 'Cobrança AMARELA · Boaz Macêdo · ao vivo'), 620, 940);
  MD.setNow(NOW_R);
  const m2 = await shot('02-alerta-vermelho-foto-nome-contador', probe(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [TR])]), 'Cobrança VERMELHA · Boaz Macêdo · ao vivo'), 620, 940);
  MD.setNow(NOW_A);
  const b1 = m1[0].band, b2 = m2[0].band;
  gate('amarelo-correto', b1 && !b1.hidden && /amber/.test(b1.cls) && b1.count.text === 'Faltam 29m 43s' && b1.name.text === 'Boaz Macêdo' && b1.avatar, JSON.stringify(b1 && b1.count));
  gate('vermelho-correto', b2 && !b2.hidden && /red/.test(b2.cls) && b2.count.text === 'Faltam 09m 18s', JSON.stringify(b2 && b2.count));
  gate('contador-sem-corte', !b1.count.clipped && !b2.count.clipped);
  gate('nome-nao-sobrepoe-contador', b1.name.box.t + b1.name.box.h <= b1.count.box.t + 1);
  gate('avatar-nao-sobrepoe-contador', b1.avatar.l + b1.avatar.w <= b1.count.box.l + b1.count.box.w && b1.avatar.l + b1.avatar.w <= (b1.name.box.l + 1));
  gate('banda-dentro-do-card', b1.inside && b2.inside && !m1[0].hscroll && !m2[0].hscroll);
  gate('mesmo-componente-amarelo-vermelho', Math.abs(b1.box.h - b2.box.h) <= 1 && b1.cls.replace('amber', '') === b2.cls.replace('red', ''), `${b1.box.h}x${b2.box.h}`);

  console.log('── cenas 3-5: isolamento por aba + reatribuição ──');
  const tabHead = (nome) => '<div style="display:flex;gap:8px;margin:0 0 10px 4px">' + ['Boaz Macêdo', 'João Pedro Albuquerque'].map(x => '<span style="font:700 12px Segoe UI;padding:6px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.14);color:' + (x === nome ? '#fff;background:#5B6CFF' : '#8b94a6') + '">' + x + '</span>').join('') + '</div>';
  const listFor = (tasks, id) => tasks.filter(t => (t.designerAssignment && t.designerAssignment.designerId) === id);
  const m3 = await shot('03-aba-designer-A-com-cobranca', probe(cssD, tabHead('Boaz Macêdo') + MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', listFor([TA, TB], 'desA'))]), 'Tarefas → Designers → Boaz (aba do designer COBRADO)'), 620, 980);
  const m4 = await shot('04-aba-designer-B-sem-cobranca', probe(cssD, tabHead('João Pedro Albuquerque') + MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', listFor([TA, TB], 'desB'))]), 'Tarefas → Designers → João (SEM a cobrança do Boaz)'), 620, 980);
  gate('isolamento-aba', m3.some(c => c.band && !c.band.hidden) && m4.every(c => !c.band || c.band.hidden || c.band.name.text !== 'Boaz Macêdo'),
    'aba A tem banda ativa; aba B não tem a cobrança de A');
  const m5 = await shot('05-reatribuicao-A-para-B', probe(cssD,
    '<div style="display:flex;gap:16px">' +
    '<div style="flex:1">' + tabHead('Boaz Macêdo') + MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', listFor([TA2B], 'desA'))]) + '</div>' +
    '<div style="flex:1">' + tabHead('João Pedro Albuquerque') + MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', listFor([TA2B], 'desB'))]) + '</div></div>',
    'REATRIBUIÇÃO Boaz → João: some da aba A, aparece na aba B (mesma tarefa, sem duplicar)'), 1240, 980);
  gate('reatribuicao', m5.length === 1 && m5[0].band && m5[0].band.name.text === 'João Pedro Albuquerque', JSON.stringify(m5.map(c => c.band && c.band.name)));

  console.log('── cena 6: contador em DOIS momentos (ticker REAL, sem re-render) ──');
  const tickerFns = [grabFrom(SRC_DEPOIS, 'f354fPad2'), grabFrom(SRC_DEPOIS, 'f354fSpan'), grabFrom(SRC_DEPOIS, 'f354fSlaLiveState'), grabFrom(SRC_DEPOIS, 'f354fLiveEls'), grabFrom(SRC_DEPOIS, 'f354fSlaLiveUpdate')].join('\n');
  const m6 = await shot('06-contador-dois-momentos', probe(cssD,
    '<div style="display:flex;gap:16px">' +
    '<div style="flex:1"><div style="color:#8b94a6;font:700 11px Segoe UI;margin:0 0 6px 4px">t₀ (render)</div>' + MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [TA])]) + '</div>' +
    '<div style="flex:1" id="late"><div style="color:#8b94a6;font:700 11px Segoe UI;margin:0 0 6px 4px">t₀+61s (MESMO DOM, atualizado pelo ticker real)</div>' + MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [TA])]) + '</div></div>',
    'CONTADOR AO VIVO: mesmo card, 61s depois — só textContent mudou (zero re-render)'), 1240, 940, {
    prep: `(() => { window.__NOW=${NOW_A + 61000};
      function canonicalNowMs(){ return window.__NOW; }
      ${tickerFns}
      const scope=document.getElementById('late');
      const els=scope.querySelectorAll('.kbv2-sla-live[data-sla-live]');
      const now=canonicalNowMs();
      els.forEach(el=>{ const marks={dueMs:+el.getAttribute('data-due-ms'),warnMs:+el.getAttribute('data-warn-ms'),redMs:+el.getAttribute('data-red-ms'),critMs:+el.getAttribute('data-crit-ms')};
        const st=f354fSlaLiveState(marks,now); if(!st.vis){el.hidden=true;return;} el.hidden=false;
        el.className='kbv2-sla-live '+st.lvl; const c=el.querySelector('[data-sla-live-count]'); if(c)c.textContent=st.text; });
    })()` });
  gate('ticker-decrementa', m6[0].band.count.text === 'Faltam 29m 43s' && m6[1].band.count.text === 'Faltam 28m 42s', `${m6[0].band.count.text} → ${m6[1].band.count.text}`);

  console.log('── cenas 7-9: edição (form real reaberto, prazo alterado, card pós-edição) ──');
  function buildForm(HTML, mutate) {
    const names = ['TEMPLATES', 'CARDS_MAX_BATCH', 'cardsQtyOf', 'newForm', 'tpl', 'curSub', 'esc', 'secOf', 'SECTORS', 'SECTOR_ALIAS', 'STATUS', 'stOf', 'assigneeField', 'renderForm', 'stepSector', 'stepDados', 'stepBriefing', 'stepReview', 'photoOf', 'initials', 'userColor', 'UCOLORS', 'avatar', 'cardsFieldOf', 'isClientSector', 'dtMs', 'todayStr', 'withAlpha', 'fmtDateTimeBR', 'humanDur', 'taskDeadline'];
    let S = ''; for (const n of names) { const s = grabFrom(HTML, n); if (s) S += s + '\n'; }
    const missing = new Set();
    // LOOP de stubs sob demanda: roda com globais REAIS; a cada "X is not defined",
    // adiciona var X=()=>'' e tenta de novo (só helpers visuais desconhecidos viram stub).
    let extra = '';
    const mkBody = () => PRELUDE + extra + S + '\nstate.form=SETUP(newForm);\n' + (mutate || '') +
      '\ntry{ return {mode:"renderForm", html:renderForm()}; }catch(e1){' +
      '\n  var eh=String(e1&&e1.message||e1); if(/is not defined/.test(eh)) throw e1;' +
      '\n  try{ return {mode:"steps", html:' +
      "'<div class=\"scr-head\"><div class=\"row\"><div style=\"flex:1\"><div style=\"font-size:20px;font-weight:800\">Editar tarefa</div></div>' +" +
      "'<button class=\"btn primary\">Salvar alterações</button></div></div>'" +
      ' + stepDados() + stepBriefing(), err:eh}; }catch(e2){ return {mode:"erro", html:eh+" || "+String(e2&&e2.message), err:String(e2&&e2.message)}; }' +
      '\n}';
    const SETUPFN = (newFormFn) => {
      const f = newFormFn('edicao_cards');
      f.id = 'T1'; f.step = 2; f.client = 'Hospital Visão'; f.assigneeId = 'desA'; f.assignee = 'Boaz Macêdo'; f.cardsQty = 1;
      f.cards = [{ tema: 'Qualidade de vida começa aqui', legenda: 'Qualidade de vida começa aqui: agende sua consulta.', obs: '', startDate: '2026-07-30', startTime: '08:00', endDate: '2026-07-30', endTime: '17:59' }];
      return f;
    };
    let out = null;
    for (let tries = 0; tries < 25; tries++) {
      try { out = new Function('SETUP', 'localStorage', mkBody())(SETUPFN, { getItem: () => null, setItem: () => {}, removeItem: () => {} }); break; }
      catch (e) {
        const m = /(?:^|\s)([A-Za-z_$][\w$]*) is not defined/.exec(String(e && e.message || e));
        if (!m) { out = { mode: 'erro', html: 'ERRO: ' + String(e && e.message), err: String(e && e.message) }; break; }
        missing.add(m[1]); extra += 'var ' + m[1] + '=function(){return "";};\n';
      }
    }
    if (out && out.err) console.error('  buildForm fallback (' + out.mode + '):', out.err);
    return { html: (out && out.html) || '', mode: (out && out.mode) || '?', missing: [...missing] };
  }
  let f7, f7rev;
  try { f7 = buildForm(SRC_DEPOIS, ''); } catch (e) { console.error('  buildForm ERRO:', e && e.message); f7 = { html: 'ERRO', mode: 'erro', missing: [] }; }
  try { f7rev = buildForm(SRC_DEPOIS, 'state.form.step=3;'); } catch (e) { f7rev = { html: 'ERRO', mode: 'erro', missing: [] }; }
  await shot('07-formulario-edicao-reaberto', probe(cssD,
    '<div style="max-width:1040px">' + f7.html + '</div>' +
    '<div style="max-width:1040px;margin-top:18px;border-top:1px dashed rgba(255,255,255,.18);padding-top:14px">' + f7rev.html + '</div>',
    'EDITAR TAREFA — wizard REAL reaberto (Briefing com dados + Revisão com "Salvar alterações")'), 1180, 1450, { measure: '1' });
  gate('form-edicao-real', /Editar tarefa/.test(f7.html) && /Qualidade de vida começa aqui/.test(f7.html) && /17:59/.test(f7.html)
    && /Salvar alterações/.test(f7rev.html),
    'modos=' + f7.mode + '/' + f7rev.mode + ' stubs: ' + f7.missing.slice(0, 12).join(','));
  let f8;
  try { f8 = buildForm(SRC_DEPOIS, 'state.form.cards[0].endTime="19:30";'); } catch (e) { console.error('  buildForm(8) ERRO:', e && e.message); f8 = { html: 'ERRO: ' + String(e && e.message), missing: ['ERRO'] }; }
  await shot('08-prazo-sendo-alterado', probe(cssD, '<div style="max-width:1000px">' + f8.html + '</div>', 'PRAZO ALTERADO no formulário: término 17:59 → 19:30'), 1180, 940, { measure: '1' });
  gate('form-prazo-alterado', /19:30/.test(f8.html));
  MD.setNow(SR.dtMs('2026-07-30', '19:01'));   // 29min antes do novo prazo
  const m9 = await shot('09-card-depois-da-atualizacao', probe(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [TA_EDITED])]), 'CARD APÓS SALVAR: prazo 19:30 · contador recalculado no novo canônico'), 620, 940);
  gate('card-pos-edicao', m9[0].band && !m9[0].band.hidden && m9[0].band.count.text === 'Faltam 29m 00s', JSON.stringify(m9[0].band && m9[0].band.count));
  MD.setNow(NOW);

  console.log('── cenas 10-11: toast REAL "Tarefa atualizada" (foreground) ──');
  const toastNames = ['resolveUserIdentity', 'notifIdentity', 'notifNormalize', 'notifSev', 'NOTIF_PHASE_LABEL', 'notifPhaseLabel', 'notifNowHM', 'notifEnsureStack', 'notifShowToast', 'esc', 'initials', 'userColor', 'UCOLORS', 'photoOf'];
  let TSRC = ''; for (const nm of toastNames) { const s = grabFrom(SRC_DEPOIS, nm); if (s) TSRC += s + '\n'; }
  const upEvent = { eventId: 'task_updated:T1:' + NOW + ':sm1', type: 'task_updated', recipientMode: 'assigned_designer', recipientId: 'desA', taskId: 'T1', taskTitle: 'Qualidade de vida começa aqui', sector: 'edicao_cards', actorId: 'sm1', actorNameDenorm: 'Arydyjany Nascimento', actorPhotoDenorm: '', assignedDesignerId: 'desA', assignedDesignerNameDenorm: 'Boaz Macêdo', assignedDesignerPhotoDenorm: '', fromStatus: '', toStatus: '', at: NOW, changedFields: ['legenda'], dueChanged: false, prevDueDate: '', prevDueTime: '', newDueDate: '', newDueTime: '' };
  const upEventDue = Object.assign({}, upEvent, { dueChanged: true, prevDueDate: '2026-07-30', prevDueTime: '17:59', newDueDate: '2026-07-30', newDueTime: '19:30', changedFields: ['prazo'] });
  const dirProfiles = (id) => ({ sm1: { name: 'Arydyjany Nascimento', photo: FOTO_ARY }, desA: { name: 'Boaz Macêdo', photo: FOTO_BOAZ } }[id] || null);
  const pay10 = NE.buildCategoryAPayload(upEvent, 'desA', dirProfiles);
  const pay11 = NE.buildCategoryAPayload(upEventDue, 'desA', dirProfiles);
  const toastScene = (pay) => probe(cssD, '<div style="height:520px"></div>', 'TOAST REAL (foreground) — notifShowToast do app') + '';
  async function toastShot(name, pay, caption) {
    const html = probe(cssD, '<div style="color:#8b94a6;font:700 12px Segoe UI;margin:4px">' + caption + '</div><div style="height:560px"></div>', '');
    const boot = '(function(){window.Audio=function(){return {play:function(){return Promise.resolve();},pause:function(){}}};\n'
      + 'window.state={user:{id:"desA"},users:[{id:"sm1",name:"Arydyjany Nascimento",photo:' + JSON.stringify(FOTO_ARY) + '},{id:"desA",name:"Boaz Macêdo",photo:' + JSON.stringify(FOTO_BOAZ) + '}]};\n'
      + 'window.svg=window.svg||function(){return ""};\n'
      + 'try{\n' + TSRC + '\n'
      + 'notifShowToast(' + JSON.stringify(pay) + ');}catch(e){window.__toastErr=String(e&&e.stack||e);}})();';
    const ctx2 = await browser.newContext({ viewport: { width: 700, height: 640 } });
    const pg2 = await ctx2.newPage();
    pg2.on('pageerror', (e) => console.error('  page error:', String(e && e.message).split('\n')[0]));
    pg2.on('console', (m) => { if (m.type() === 'error') console.error('  console:', m.text().slice(0, 160)); });
    await pg2.setContent(html, { waitUntil: 'load' });
    await pg2.addScriptTag({ content: boot });
    await pg2.waitForTimeout(300);
    metrics.cenas[name] = await pg2.evaluate("(()=>{ const t=document.querySelector('.ntf,.toast,.ntf-card'); if(!t) return {toast:false, err: window.__toastErr||''}; const b=t.getBoundingClientRect(); return {toast:true, w:Math.round(b.width), body:(t.textContent||'').slice(0,240), err: window.__toastErr||''}; })()");
    if (metrics.cenas[name].err) console.error('  toast err:', String(metrics.cenas[name].err).split('\n')[0]);
    await pg2.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx2.close(); console.log('  ✓', name + '.png');
  }
  await toastShot('10-toast-tarefa-atualizada', pay10, 'Boaz (Designer) recebe: “Tarefa atualizada — Arydyjany atualizou …”');
  await toastShot('11-toast-prazo-anterior-novo', pay11, 'Com PRAZO alterado: “…atualizou o prazo: 17:59 → 19:30”');
  gate('toast-real', (metrics.cenas['10-toast-tarefa-atualizada'].toast === true) && /Tarefa atualizada/.test(metrics.cenas['10-toast-tarefa-atualizada'].body || ''), JSON.stringify(metrics.cenas['10-toast-tarefa-atualizada']).slice(0, 160));
  gate('toast-prazo', /17:59/.test(metrics.cenas['11-toast-prazo-anterior-novo'].body || '') && /19:30/.test(metrics.cenas['11-toast-prazo-anterior-novo'].body || ''), (metrics.cenas['11-toast-prazo-anterior-novo'].body || '').slice(0, 200));

  console.log('── cenas 12-14: minimizado / fechado no X (janela REAL bgnotify) / clique abre ──');
  async function bgShot(name, pay, caption) {
    const ctx = await browser.newContext({ viewport: { width: 470, height: 360 }, bypassCSP: true });
    const pg = await ctx.newPage();
    await pg.setContent(BGHTML.replace('<body>', '<body><script>window.bgAPI={onCard:function(cb){window.__cb=cb;},resize:function(){},empty:function(){},rendered:function(i){window.__rendered=i;},open:function(d){window.__opened=d;}};</script>'), { waitUntil: 'load' });
    await pg.evaluate((p) => { document.body.style.background = '#0A0B10'; const cap = document.createElement('div'); cap.style.cssText = 'color:#8b94a6;font:700 11px Segoe UI;padding:8px 12px 0'; cap.textContent = p.caption; document.body.prepend(cap); window.__cb(p.pay); }, { pay, caption });
    await pg.waitForTimeout(320);
    metrics.cenas[name] = await pg.evaluate(`({rendered: window.__rendered||null, text: (document.querySelector('.ntf-card')||{}).textContent||''})`);
    await pg.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close(); console.log('  ✓', name + '.png');
  }
  await bgShot('12-minimizado-bgwindow', pay11, 'APP MINIMIZADO — janela premium REAL (bgnotify) entregue pelo main');
  await bgShot('13-fechado-no-X-tray', pay11, 'FECHADO NO X (bandeja) — main vivo entrega a MESMA janela premium');
  gate('bg-render-ack', !!metrics.cenas['12-minimizado-bgwindow'].rendered && /Tarefa atualizada/.test(metrics.cenas['12-minimizado-bgwindow'].text), (metrics.cenas['12-minimizado-bgwindow'].text || '').slice(0, 120));
  /* 14 — clique: aciona o CTA REAL da janela e prova o deep-link capturado */
  {
    const ctx14 = await browser.newContext({ viewport: { width: 470, height: 360 }, bypassCSP: true });
    const pg = await ctx14.newPage();
    await pg.setContent(BGHTML.replace('<body>', '<body><script>window.bgAPI={onCard:function(cb){window.__cb=cb;},resize:function(){},empty:function(){},rendered:function(){},open:function(d){window.__opened=d;}};</script>'), { waitUntil: 'load' });
    await pg.evaluate((p) => { document.body.style.background = '#0A0B10'; window.__cb(p); }, pay11);
    await pg.waitForTimeout(250);
    await pg.click('.ntf-cta');
    const opened = await pg.evaluate('window.__opened');
    await pg.evaluate((d) => { const cap = document.createElement('div'); cap.style.cssText = 'color:#2FCF8F;font:800 13px Segoe UI;padding:10px 12px'; cap.textContent = 'CLIQUE → abre a tarefa: deep-link "' + d + '" (main restaura a janela e navega)'; document.body.prepend(cap); }, opened);
    metrics.cenas['14-clique-abre-tarefa'] = { opened };
    await pg.screenshot({ path: path.join(OUT, '14-clique-abre-tarefa.png') });
    await ctx14.close(); console.log('  ✓ 14-clique-abre-tarefa.png');
    gate('clique-deeplink', opened === 'detail/T1', String(opened));
  }

  console.log('── cenas 15-16: escala Windows 100% / 125% ──');
  const PAIRF = MD.kbv2BoardHtml([col('A Fazer', '#8B94A6', [TB]), col('Em andamento', '#F2A93B', [TA])]);
  const m15 = await shot('15-escala-100', probe(cssD, PAIRF, 'Escala Windows 100% · cobrança ao vivo'), 1180, 940, { dsf: 1 });
  const m16 = await shot('16-escala-125', probe(cssD, PAIRF, 'Escala Windows 125% · mesma composição'), 1180, 940, { dsf: 1.25 });
  const bandCards15 = m15.filter(c => c.band && !c.band.hidden), bandCards16 = m16.filter(c => c.band && !c.band.hidden);
  gate('escala-125-sem-quebra', bandCards15.length === 1 && bandCards16.length === 1 && !bandCards16[0].band.count.clipped && !m16.some(c => c.hscroll));

  console.log('── gates estruturais: shell 1.0.196 INTACTO (banda oculta ⇒ Δ0 vs ANTES) ──');
  MD.setNow(SR.dtMs('2026-07-30', '10:00')); MA.setNow(SR.dtMs('2026-07-30', '10:00'));   // fora da janela (banda hidden)
  const mDq = await shot('extra-depois-banda-oculta', probe(cssD, MD.kbv2BoardHtml([col('Em andamento', '#F2A93B', [TA])]), 'DEPOIS · fora da janela (banda oculta)'), 620, 940);
  const mAq = await shot('extra-antes-1.0.196', probe(cssA, MA.kbv2BoardHtml([col('Em andamento', '#F2A93B', [TA])]), 'ANTES · 1.0.196 aprovada'), 620, 940);
  gate('shell-congelado-Δ0', mDq[0].w === mAq[0].w && mDq[0].pad === mAq[0].pad && mDq[0].radius === mAq[0].radius
    && Math.abs(mDq[0].h - mAq[0].h) <= 1 && mDq[0].offProfile === mAq[0].offProfile && mDq[0].offTitle === mAq[0].offTitle
    && mDq[0].band && mDq[0].band.hidden === true,
    `w ${mDq[0].w}=${mAq[0].w} h ${mDq[0].h}~${mAq[0].h} pad ${mDq[0].pad}=${mAq[0].pad} r ${mDq[0].radius}=${mAq[0].radius} offP ${mDq[0].offProfile}=${mAq[0].offProfile}`);
  gate('sem-scroll-interno-novo', ![...m1, ...m2, ...m9, ...m15, ...m16].some(c => c.panelScroll || c.hscroll));
  gate('altura-so-natural', m1[0].h > mDq[0].h && (m1[0].w === mDq[0].w), `com banda ${m1[0].h} > sem banda ${mDq[0].h}, mesma largura`);

  fs.writeFileSync(path.join(OUT, 'metrics-f354f.json'), JSON.stringify(metrics, null, 2));
  await browser.close();
  console.log(`\n${fails === 0 ? '✅ PROVA VISUAL F3.5.4F: todos os gates PASS' : '❌ ' + fails + ' gate(s) FALHARAM'} — saída em docs/f354f-visual/`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERRO fatal na prova visual:', e); process.exit(1); });
