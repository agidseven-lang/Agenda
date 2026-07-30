/**
 * F3.5.4G — f354g-sla-top-monitor.test.mjs
 * =====================================================================================
 * SLA AO VIVO NO MONITOR SUPERIOR — 20 asserts obrigatórios da fase + cenários
 * multiusuário C1–C4 (Admin/Social/DesignerA/DesignerB).
 * Parte VM: funções REAIS extraídas do index.html (kbv2Card byte-comparado com a
 * 1.0.196 REAL via git show — prova de card limpo). Parte DOM: o BLOCO REAL
 * slaib/slaMon/f354g do index.html rodando em Chromium (timers reais), montando o
 * widget #sla-monitor de verdade e medindo geometria/decemento/contexto.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const REPO = path.join(ROOT, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
const MAINTS = fs.readFileSync(path.join(ROOT, 'src', 'main', 'main.ts'), 'utf8');
const BASE196 = 'e3a1a5b227fd7b4e57b822b1b30c38e0b0b56371';
const HTML196 = execSync('git show ' + BASE196 + ':desktop/src/renderer/index.html', { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString();
const S = require2(path.join(ROOT, 'src', 'main', 'slaRules.js'));

let n = 0, fail = 0;
function ok(cond, name) { n++; if (cond) { console.log(`  ✔ ${String(n).padStart(2, '0')} ${name}`); } else { fail++; console.error(`  ✘ ${String(n).padStart(2, '0')} ${name}`); } }

function grabFrom(H, name) {
  let a = H.indexOf('function ' + name + '('); let isFn = a >= 0;
  if (a < 0) a = H.indexOf('const ' + name + '='); if (a < 0) a = H.indexOf('var ' + name + '=');
  if (a < 0) return null;
  if (isFn) { let d = 0; for (let j = H.indexOf('{', a); j < H.length; j++) { const c = H[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return H.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < H.length; j++) { const c = H[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return H.slice(a, j + 1); }
  return null;
}

/* ── VM: kbv2Card REAL (árvore atual × 1.0.196) com o MESMO prelude (prova de card limpo) ── */
const NAMES_CARD = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2FirstName', 'kbv2Card', 'kbv2Empty',
  'SLA_PANEL_WARN_MS', 'SLA_PANEL_GRACE_MS', 'slaPanelFinishMs', 'slaPanelDelivered', 'resolveTaskDisplayState', 'SECTOR_SLA', 'slaCfgDefault', 'slaCfgOf', '_slaScheduleRevOf', 'resolveCanonicalSlaTimeline', 'kbv2SlaLocal', 'isTaskCompleted',
  'UCOLORS', 'userColor', 'initials', 'photoOf', 'avatar', 'designerOf', 'hasDesigner', 'isDesignerFlow'];
const PRELUDE =
  'var NOWBOX={v:0};function canonicalNowMs(){return NOWBOX.v||Date.now();}\n' +
  'var state={user:{id:"sm1"},users:[{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media"},{id:"desA",name:"Boaz Macêdo",role:"Designer"},{id:"desB",name:"João Pedro Albuquerque",role:"Designer"}]};\n' +
  'function respOf(t){if(t&&t._resp)return t._resp;var id=(t&&(t.assigneeId||(t.designerAssignment&&t.designerAssignment.designerId)))||null;return state.users.find(function(u){return u.id===id;})||null;}\n' +
  'function svg(k){return "<svg data-ic=\\""+k+"\\"></svg>";}\n' +
  'function fmtDateBR(d){var p=String(d||"").split("-");return p.length===3?(p[2]+"/"+p[1]+"/"+p[0]):String(d||"");}\n' +
  'function taskTimeline(t){return {milestones:[{key:"a",state:"done"},{key:"b",state:"current"},{key:"c",state:""},{key:"d",state:""}],owner:{role:"Social",id:null}};}\n' +
  'function nextActionShort(t){return "Produzir a arte";}\nfunction clientFacingNextShort(t){return "";}\n' +
  'function designerColView(t){return (t&&t.status)||"afazer";}\nfunction designerNextShort(t){return "Produzir a arte";}\n' +
  'function designerStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\nfunction clientFacingStatusView(t){return clientStatusView(t);}\n' +
  'function deriveCanonicalTaskState(t){return {phase:"producing",owner:"social"};}\n' +
  'function canDelTask(t){return true;}\nfunction isDesignerAxisMove(t){return false;}\n' +
  'function canSeeAll(u){return false;}\n' +               /* persp sem menu Editar ⇒ comparação byte a byte com a 1.0.196 */
  'function cardsFieldOf(t,k){return k==="legenda"?String((t&&t.cardLegenda)||""):String((t&&t.cardObs)||"");}\n';
function buildCard(H) {
  let SRC = ''; for (const nm of NAMES_CARD) { const s = grabFrom(H, nm); if (s) SRC += s + '\n'; }
  const extra = grabFrom(H, 'kbv2SlaLiveData') ? (grabFrom(H, 'F354F_CARDS_WARN_MS') || "var F354F_CARDS_WARN_MS=30*60000, F354F_CARDS_RED_MS=10*60000;") + '\n' + (grabFrom(H, 'f354fPad2') || '') + '\n' + (grabFrom(H, 'f354fSpan') || '') + '\n' + (grabFrom(H, 'kbv2SlaLiveData') || '') + '\n' + (grabFrom(H, 'f354fSlaLiveState') || '') + '\n' : '';
  const c = { console };
  vm.createContext(c);
  vm.runInContext(PRELUDE + extra + SRC + ';', c);
  return c;
}
const DUE = S.dtMs('2026-08-01', '18:00');
const NOWIN = DUE - 20 * 60000; // DENTRO da janela amarela (T-30 ativo)
const fx = () => ({ id: 'C1', sector: 'edicao_cards', title: 'Qualidade de vida começa aqui', client: 'Hospital Visão',
  status: 'andamento', assignee: 'Boaz Macêdo', assigneeId: 'desA',
  dueDate: '2026-08-01', dueTime: '18:00', due: '2026-08-01', startDate: '2026-08-01', startTime: '08:00',
  cardTema: 'Qualidade de vida começa aqui', cardLegenda: 'Legenda X', cardObs: '', cardDeadlineRev: 1, checklist: [{ d: true }, { d: false }],
  designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', assignedAt: DUE - 10 * 3600000, assignedBy: 'sm1', endDate: '2026-08-01', endTime: '18:00' } });

console.log('\n══ VM — card limpo (byte-comparação com a 1.0.196 REAL) + arquitetura ══');
const cNow = buildCard(HTML), c196 = buildCard(HTML196);
vm.runInContext('NOWBOX.v=' + NOWIN + ';', cNow); vm.runInContext('NOWBOX.v=' + NOWIN + ';', c196);
const cardNow = vm.runInContext('kbv2Card', cNow)(fx(), 'social');
const card196 = vm.runInContext('kbv2Card', c196)(fx(), 'social');
/* 1 */ ok(!/kbv2-sla-live|data-sla-live/.test(cardNow) && cardNow === card196,
  'card NÃO contém banda SLA e o HTML do card DENTRO da janela é IDÊNTICO byte a byte ao da 1.0.196');

/* ── DOM: bloco REAL slaib/slaMon/f354g em Chromium ── */
const REALS = ['esc', 'initials', 'photoOf', 'userColor', 'UCOLORS', 'avatar', 'dtMs', 'SECTORS', 'SECTOR_ALIAS', 'secOf', 'isTaskCompleted', 'designerOf', 'hasDesigner', 'isDesignerFlow', 'isClientSector', 'F354F_CARDS_WARN_MS', 'F354F_CARDS_RED_MS', 'f354fPad2', 'f354fSpan', 'kbv2SlaLiveData', 'f354fSlaLiveState'];
function sliceOf(H) {
  const sA = 'Sino fixo (portal no <body>'; let s = H.indexOf(sA); s = H.lastIndexOf('/*', s);
  const eA = 'try{ setTimeout(slaibRefresh,0); }catch(_){}'; const e = H.indexOf(eA);
  return H.slice(s, e + eA.length);
}
const PAGE = '<!doctype html><html><head><meta charset="utf-8"><style>body{background:#0A0B10;margin:0;font-family:Segoe UI,system-ui}.d-board-head{height:44px;color:#8b94a6;display:flex;align-items:center}</style></head>'
  + '<body class="desktop authed"><div id="app"><div id="content" class="board-mode"><div class="d-board-head">Quadro — Edição de Cards</div><div class="kbv2-board-surface"></div></div></div>'
  + '<div id="cornerAvatar" style="position:fixed;top:11px;right:72px;width:38px;height:38px;border-radius:50%;background:#334155"></div><div id="login" class="hidden"></div></body></html>';

(async () => {
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const { chromium } = require2('playwright');
  const EXE = (() => { try { const b = '/opt/pw-browsers'; for (const d of fs.readdirSync(b)) { const p = path.join(b, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium') && fs.existsSync(p)) return p; } } catch (_) { } return undefined; })();
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  let PRE2 = ''; for (const nm of REALS) { const s = grabFrom(HTML, nm); if (s) PRE2 += s + '\n'; }
  const errsAll = [];

  async function boot(tasksJs, userJs) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errsAll.push('pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errsAll.push('console: ' + m.text()); });
    await pg.setContent(PAGE, { waitUntil: 'load' });
    const PRE =
      'var NOWBOX={v:0};function canonicalNowMs(){return NOWBOX.v||Date.now();}\n' +
      'var state={tab:"tarefas",form:null,clientView:null,designerBoard:null,personBoard:null,'
      + 'user:' + userJs + ','
      + 'users:[{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media"},{id:"adm1",name:"Admin Master",role:"Administrador"},{id:"desA",name:"Boaz Macêdo",role:"Designer"},{id:"desB",name:"João Pedro Albuquerque",role:"Designer"}],'
      + 'tasks:' + tasksJs + '};\n' +
      'window.__opened=[];function openDetails(id){window.__opened.push(id);}\n' +
      'function canSeeAll(u){return !!u&&u.role!=="Designer";}function canSeeTask(u,t){return !!t&&(t.assigneeId===(u&&u.id)||t.by===(u&&u.id));}\n' +
      'function flashToast(m){}\nfunction render(){}\nvar db=null;var unsub={};\n' + PRE2;
    let CODE = PRE + sliceOf(HTML) + '\n;window.__ok=1;';
    for (let tries = 0; tries < 60; tries++) {
      const r = await pg.evaluate(src => { try { (0, eval)(src); return { ok: true }; } catch (e) { return { ok: false, msg: String(e && e.message || e) }; } }, CODE);
      if (r.ok) break;
      const m = /(\w+) is not defined/.exec(r.msg || '');
      if (!m) { errsAll.push('boot: ' + r.msg); break; }
      const real = grabFrom(HTML, m[1]);
      CODE = (real ? real : 'var ' + m[1] + '=function(){return "";};') + '\n' + CODE;
    }
    await pg.evaluate(() => { try { window.slaibRefresh(); } catch (e) { } });
    return { pg, ctx };
  }
  const taskJs = (id, uid, name, dueOffMin, rev) =>
    `(function(){var d=new Date(Date.now()+${dueOffMin}*60000);var p=function(x){return (x<10?"0":"")+x;};`
    + `return {id:"${id}",title:"Card ${id}",client:"Hospital Visão",sector:"edicao_cards",status:"andamento",assigneeId:"${uid}",`
    + `dueDate:d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()),dueTime:p(d.getHours())+":"+p(d.getMinutes()),cardDeadlineRev:${rev || 1},`
    + `designerAssignment:{designerId:"${uid}",designerName:"${name}",status:"sent"}};})()`;
  const SM = '{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media"}';

  const mon = pg => pg.evaluate(() => {
    const w = document.getElementById('sla-monitor'); if (!w) return { none: true };
    const av = w.querySelector('.f354g-avt .av'); const nm = w.querySelector('.f354g-nm'); const ct = w.querySelector('[data-f354g-count]'); const st = w.querySelector('.slamon-status');
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
    const chip = w.querySelector('.slamon-chip');
    return { alert: w.className.includes('f354g-alert'), sev: /\bred\b/.test(w.className) ? 'red' : (/\bamber\b/.test(w.className) ? 'amber' : 'green'),
      avatar: !!av, avBox: box(av), name: nm ? nm.textContent : null, nmBox: box(nm), count: ct ? ct.textContent : null, ctBox: box(ct),
      status: st ? st.textContent : null, chipBox: box(chip), inChip: !!(av && chip && av.getBoundingClientRect().top >= chip.getBoundingClientRect().top - 1 && av.getBoundingClientRect().bottom <= chip.getBoundingClientRect().bottom + 1) };
  });

  console.log('\n══ DOM — estados A/B do monitor superior (Chromium, timers reais) ══');
  { /* Estado A */
    const { pg, ctx } = await boot('[' + taskJs('T9', 'desA', 'Boaz Macêdo', 6 * 60) + ']', SM);
    await pg.waitForTimeout(350);
    const m = await mon(pg);
    /* 2 */ ok(!m.none && !m.alert && m.status === 'Tudo em dia' && m.sev === 'green',
      `monitor mostra "Tudo em dia" sem alerta (premium, sem contador, sem ruído) [status="${m.status}"]`);
    await ctx.close();
  }
  let mA;
  { /* Estado B amarelo + geometria + decremento + troca de aba */
    const { pg, ctx } = await boot('[' + taskJs('T1', 'desA', 'Boaz Macêdo', 25) + ',' + taskJs('T2', 'desB', 'João Pedro Albuquerque', 6 * 60) + ']', SM);
    await pg.waitForTimeout(350);
    mA = await mon(pg);
    /* 3 */ ok(mA.alert && mA.sev === 'amber' && /^Faltam \d{1,2}m \d{2}s$/.test(mA.count || ''),
      `monitor AMARELO quando T-30 ativo (contador "${mA.count}")`);
    /* 6 */ ok(mA.avatar === true && mA.inChip === true, 'avatar do Designer aparece DENTRO do chip do monitor');
    /* 7 */ ok(mA.name === 'Boaz Macêdo', `nome do Designer aparece no monitor ("${mA.name}")`);
    /* 8 */ ok(mA.avBox && mA.avBox.w === 30 && mA.avBox.w > 22 && mA.chipBox && mA.avBox.h <= mA.chipBox.h,
      `avatar proporcional e MAIOR que o reprovado no card (30px > 22px; chip ${mA.chipBox && mA.chipBox.h}px)`);
    /* 9 */ ok(mA.nmBox && mA.ctBox && (mA.nmBox.b <= mA.ctBox.t + 2) && mA.nmBox.r <= mA.chipBox.r && mA.ctBox.r <= mA.chipBox.r,
      'nome NÃO sobrepõe o cronômetro e nada vaza do componente');
    const c0 = mA.count;
    await pg.waitForTimeout(2300);
    const c1 = (await mon(pg)).count;
    /* 10 */ ok(c0 !== c1 && /^Faltam /.test(c1 || ''), `contador decrementa em tempo real ("${c0}" → "${c1}")`);
    /* 13 */ const tabB = await pg.evaluate(() => { state.designerBoard = 'desB'; slaMonRender(); const w = document.getElementById('sla-monitor'); return { alert: w.className.includes('f354g-alert'), status: (w.querySelector('.slamon-status') || {}).textContent }; });
    ok(tabB.alert === false && tabB.status === 'Tudo em dia', 'troca p/ aba do Designer B (sem cobrança): monitor ATUALIZA e sai do alerta');
    /* 14 */ const backA = await pg.evaluate(() => { state.designerBoard = 'desA'; slaMonRender(); const w = document.getElementById('sla-monitor'); return { alert: w.className.includes('f354g-alert'), name: (w.querySelector('.f354g-nm') || {}).textContent }; });
    ok(tabB.status === 'Tudo em dia' && backA.alert === true && backA.name === 'Boaz Macêdo',
      'aba sem alerta = "Tudo em dia"; aba com cobrança volta ao estado correto (contexto real)');
    await ctx.close();
  }
  { /* Estado B vermelho e atraso */
    const { pg, ctx } = await boot('[' + taskJs('T1', 'desA', 'Boaz Macêdo', 8) + ']', SM);
    await pg.waitForTimeout(350);
    const mR = await mon(pg);
    /* 4 */ ok(mR.alert && mR.sev === 'red' && /^Faltam 0?[0-8]m \d{2}s$/.test(mR.count || ''),
      `monitor VERMELHO quando T-10 ativo (contador "${mR.count}")`);
    await ctx.close();
    const { pg: pg2, ctx: ctx2 } = await boot('[' + taskJs('T1', 'desA', 'Boaz Macêdo', -5) + ']', SM);
    await pg2.waitForTimeout(350);
    const mL = await mon(pg2);
    /* 5 */ ok(mL.alert && mL.sev === 'red' && / em atraso$/.test(mL.count || ''),
      `monitor em ATRASO quando vencido (contador "${mL.count}")`);
    await ctx2.close();
  }

  console.log('\n══ Arquitetura (fonte real) ══');
  /* 11 */ const ivals = HTML.match(/setInterval\(function\(\)\{[^\n]*?\},\s*1000\)/g) || [];
  ok(ivals.length === 1 && /slaMonHasActive\(\)\|\|f354gMonHasActive\(\)/.test(ivals[0] || ''),
    'scheduler global permanece ÚNICO (1 interval de 1s; gate por dados)');
  /* 12 */ const cardSrc = grabFrom(HTML, 'kbv2Card');
  ok(!/setInterval|setTimeout/.test(cardSrc) && !/kbv2-sla-live/.test(cardSrc),
    'nenhum timer por card e nenhuma banda no kbv2Card');
  /* 15-18 via f354gMonAlerts REAL em vm */
  const vctx = { console, CSS: undefined, document: undefined, window: undefined };
  vm.createContext(vctx);
  vm.runInContext('var canonicalNowMs=function(){return ' + NOWIN + ';};var state={};\n'
    + (grabFrom(HTML, 'UCOLORS') || '') + '\n' + ['esc', 'initials', 'userColor', 'photoOf', 'avatar', 'dtMs', 'SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'isTaskCompleted', 'designerOf', 'hasDesigner', 'isDesignerFlow', 'F354F_CARDS_WARN_MS', 'f354fPad2', 'f354fSpan', 'kbv2SlaLiveData', 'f354fSlaLiveState', 'slaPanelFinishMs', 'slaPanelDelivered', 'SLA_PANEL_WARN_MS', 'SLA_PANEL_GRACE_MS', 'SECTOR_SLA', 'slaCfgDefault', 'slaCfgOf', '_slaScheduleRevOf', 'resolveCanonicalSlaTimeline', 'resolveTaskDisplayState', 'f354gMonCtxUid', 'f354gMonAlerts', 'f354gMonTop'].map(nm => grabFrom(HTML, nm) || '').join('\n'), vctx);
  const alerts = (tasks, board, user) => { vctx.state = { user: user || { id: 'sm1', role: 'Social Media' }, users: [{ id: 'desA', name: 'Boaz Macêdo' }, { id: 'desB', name: 'João Pedro' }], tasks, designerBoard: board || null, personBoard: null }; vctx.canSeeAll = (u) => u && u.role !== 'Designer'; return vm.runInContext('f354gMonAlerts', vctx)(); };
  const base = fx();
  /* 15 */ const rea = JSON.parse(JSON.stringify(base)); rea.assigneeId = 'desB'; rea.designerAssignment.designerId = 'desB'; rea.designerAssignment.designerName = 'João Pedro';
  ok(alerts([base], 'desA').length === 1 && alerts([rea], 'desA').length === 0 && alerts([rea], 'desB').length === 1 && alerts([rea], 'desB')[0].uid === 'desB',
    'reatribuição ATUALIZA o monitor (cobrança migra da aba A para a aba B; uid novo)');
  /* 16 */ const done = JSON.parse(JSON.stringify(base)); done.status = 'concluido';
  ok(alerts([done], null).length === 0, 'conclusão REMOVE o alerta do monitor');
  /* 17 */ const reop = JSON.parse(JSON.stringify(done)); reop.status = 'andamento';
  ok(alerts([reop], null).length === 1, 'reabertura REAVALIA (alerta reaparece se a janela estiver ativa)');
  /* 18 */ const moved = JSON.parse(JSON.stringify(base)); moved.dueTime = '23:30'; moved.cardDeadlineRev = 2;
  ok(alerts([moved], null).length === 0 && /mk\.warnMs, mk\.redMs, mk\.dueMs/.test(grabFrom(HTML, 'slaMonNextBoundary')),
    'alteração de prazo RECALCULA (fora da janela nova ⇒ sem alerta) e re-arma o boundary do monitor');
  /* 19 */ ok(/backgroundThrottling:\s*false/.test(MAINTS) && /disable-background-timer-throttling/.test(MAINTS)
    && /visibilitychange',function\(\)\{ try\{ slaibRefresh\(\); \}/.test(HTML),
    'MINIMIZADO: timers vivos (throttling off) + visibilitychange faz passada completa ao restaurar');
  /* 20 */ ok(/e\.preventDefault\(\);\s*\n?\s*mainWin\?\.hide\(\)/.test(MAINTS) && /startSlaScheduler/.test(MAINTS)
    && /slaMonHasActive\(\)\|\|f354gMonHasActive\(\)/.test(HTML),
    'FECHADO NO X: produtor autoritativo segue no main; ao reabrir, o monitor deriva TUDO dos dados (gate por dados)');

  console.log('\n══ Cenários multiusuário C1–C4 (Admin/Social/DesignerA/DesignerB) ══');
  { /* C1+C2+C3+C4 na MESMA sessão (troca de contexto real) */
    const { pg, ctx } = await boot('[' + taskJs('T1', 'desA', 'Boaz Macêdo', 25) + ',' + taskJs('T2', 'desB', 'João Pedro Albuquerque', 6 * 60) + ']', SM);
    await pg.waitForTimeout(350);
    /* C1 — Social na aba do Designer A com T-30: monitor mostra A; card limpo (assert 1 provou o card) */
    const c1 = await pg.evaluate(() => { state.designerBoard = 'desA'; slaMonRender(); const w = document.getElementById('sla-monitor'); return { alert: w.className.includes('f354g-alert'), name: (w.querySelector('.f354g-nm') || {}).textContent, sev: /\bamber\b/.test(w.className) ? 'amber' : 'other' }; });
    ok(c1.alert && c1.name === 'Boaz Macêdo' && c1.sev === 'amber', 'C1: DesignerA em T-30 ⇒ monitor superior mostra A (amarelo) e o card segue sem banda');
    /* C2 — troca p/ aba do B sem cobrança */
    const c2 = await pg.evaluate(() => { state.designerBoard = 'desB'; slaMonRender(); const w = document.getElementById('sla-monitor'); return { alert: w.className.includes('f354g-alert'), status: (w.querySelector('.slamon-status') || {}).textContent }; });
    ok(!c2.alert && c2.status === 'Tudo em dia', 'C2: aba do Designer B sem cobrança ⇒ "Tudo em dia" (NUNCA mostra A indevidamente)');
    /* C3 — B entra em T-10 (prazo 8min) ⇒ aba B vermelho João; Admin global vê o MAIS urgente (B) */
    const c3 = await pg.evaluate(() => {
      var d = new Date(Date.now() + 8 * 60000); var p = function (x) { return (x < 10 ? '0' : '') + x; };
      var t2 = state.tasks.find(function (t) { return t.id === 'T2'; });
      t2.dueDate = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); t2.dueTime = p(d.getHours()) + ':' + p(d.getMinutes()); t2.cardDeadlineRev = 2;
      state.designerBoard = 'desB'; slaMonRender();
      const w = document.getElementById('sla-monitor');
      const inB = { alert: w.className.includes('f354g-alert'), name: (w.querySelector('.f354g-nm') || {}).textContent, red: /\bred\b/.test(w.className) };
      state.user = state.users.find(function (u) { return u.id === 'adm1'; }); state.designerBoard = null; slaMonRender();
      const wg = document.getElementById('sla-monitor');
      const adm = { name: (wg.querySelector('.f354g-nm') || {}).textContent, red: /\bred\b/.test(wg.className), more: !!wg.querySelector('.f354g-more') };
      return { inB, adm };
    });
    ok(c3.inB.alert && c3.inB.red && c3.inB.name === 'João Pedro Albuquerque' && c3.adm.red && c3.adm.name === 'João Pedro Albuquerque' && c3.adm.more,
      'C3: B entra em T-10 ⇒ aba B mostra B em VERMELHO; Admin em modo global vê o MAIS urgente (B) com "+N"');
    /* C4 — Social altera o prazo de T1 (+6h) ⇒ monitor recalcula IMEDIATAMENTE na aba A */
    const c4 = await pg.evaluate(() => {
      state.user = state.users.find(function (u) { return u.id === 'sm1'; });
      var d = new Date(Date.now() + 6 * 3600000); var p = function (x) { return (x < 10 ? '0' : '') + x; };
      var t1 = state.tasks.find(function (t) { return t.id === 'T1'; });
      t1.dueDate = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); t1.dueTime = p(d.getHours()) + ':' + p(d.getMinutes()); t1.cardDeadlineRev = 2;
      state.designerBoard = 'desA'; slaMonRender();
      const w = document.getElementById('sla-monitor');
      return { alert: w.className.includes('f354g-alert'), status: (w.querySelector('.slamon-status') || {}).textContent };
    });
    ok(!c4.alert && c4.status === 'Tudo em dia', 'C4: Social altera o prazo ⇒ monitor RECALCULA imediatamente (aba A volta a "Tudo em dia")');
    /* Designer A/B: cada um só vê a própria cobrança (papel aplicado no escopo) */
    const cD = await pg.evaluate(() => {
      var d = new Date(Date.now() + 20 * 60000); var p = function (x) { return (x < 10 ? '0' : '') + x; };
      var t1 = state.tasks.find(function (t) { return t.id === 'T1'; });
      t1.dueDate = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); t1.dueTime = p(d.getHours()) + ':' + p(d.getMinutes()); t1.cardDeadlineRev = 3;
      state.designerBoard = null;
      state.user = state.users.find(function (u) { return u.id === 'desA'; }); slaMonRender();
      const a = { name: (document.querySelector('#sla-monitor .f354g-nm') || {}).textContent };
      state.user = state.users.find(function (u) { return u.id === 'desB'; }); slaMonRender();
      const w = document.getElementById('sla-monitor');
      const b = { name: (w.querySelector('.f354g-nm') || {}).textContent, red: /\bred\b/.test(w.className) };
      return { a, b };
    });
    ok(cD.a.name === 'Boaz Macêdo' && cD.b.name === 'João Pedro Albuquerque' && cD.b.red,
      'DesignerA vê a própria cobrança; DesignerB vê a dele (vermelha) — papel aplicado, sem vazamento');
    await ctx.close();
  }
  await browser.close();
  const errsClean = errsAll.filter(e => !/favicon/i.test(e));
  ok(errsClean.length === 0, `zero erro de console/página em TODOS os cenários (${errsClean.length ? errsClean.slice(0, 3).join(' | ') : 'limpo'})`);

  console.log(`\n${fail === 0 ? '✅' : '❌'} f354g-sla-top-monitor: ${n - fail}/${n} asserts verdes`);
  if (fail) process.exit(1);
})();
