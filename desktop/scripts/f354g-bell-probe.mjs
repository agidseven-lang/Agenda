#!/usr/bin/env node
/* =====================================================================
 * F3.5.4G — SONDA EMPÍRICA DO SINO (auditoria; NÃO é teste de release).
 * Executa o BLOCO REAL slaib/slaMon/slaTick do index.html (196 vs 197) em
 * Chromium com timers REAIS e mede:
 *   P1  sino existe / clicável (elementFromPoint no centro);
 *   P2  clique abre o painel #slaib-ov;
 *   P3  frequência REAL de slaibRender (storm 1s na 197 vs quieto na 196)
 *       no cenário do owner (Edição de Cards: SEM designerSla; 197 tem
 *       bandas .kbv2-sla-live no DOM — inclusive hidden);
 *   P4  churn do painel aberto: nó da .slaib-list sobrevive 1.4s?
 *   P5  clique LENTO (mousedown→1.1s→mouseup) num item com alerta
 *       designerSla ativo: openDetails dispara? (rebuild mata o clique?)
 *   P6  escritas de geometria no sino por segundo (slaClusterAlign);
 *   P7  borda: #cornerAvatar display:none → slaClusterAlign manda o sino
 *       p/ fora da tela? (latente, mesma nas duas)
 *   P8  pageerrors/console.
 * Rodar: NODE_PATH=/opt/node22/lib/node_modules node desktop/scripts/f354g-bell-probe.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { execSync } from 'child_process';
import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, '..', '..', 'f354g-bell-probe-result.json');
const BASE196 = 'e3a1a5b227fd7b4e57b822b1b30c38e0b0b56371';
const REAL197 = '14e9fb952b64e56d56528e63c6ac54499ab4b71d';
const SRC197 = execSync('git show ' + REAL197 + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();
const SRCWT = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const SRC196 = execSync('git show ' + BASE196 + ':desktop/src/renderer/index.html', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();

function grabFrom(HTML, n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '='); if (a < 0) a = HTML.indexOf('var ' + n + '=');
  if (a < 0) return null;
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  return null;
}

/* fatia CONTÍGUA real: do início do PANEL-CORE do sino até o boot slaibRefresh(0) */
function sliceOf(HTML, tag) {
  const startAnchor = 'Sino fixo (portal no <body>';
  let s = HTML.indexOf(startAnchor);
  if (s < 0) throw new Error(tag + ': start anchor ausente');
  s = HTML.lastIndexOf('/*', s);
  const endAnchor = 'try{ setTimeout(slaibRefresh,0); }catch(_){}';
  let e = HTML.indexOf(endAnchor);
  if (e < 0) throw new Error(tag + ': end anchor ausente');
  return HTML.slice(s, e + endAnchor.length);
}

const BAND = (lvl, txt) =>
  '<div class="kbv2-sla-live ' + (lvl || '') + '"' + (lvl ? '' : ' hidden') + ' data-sla-live data-sla-mode="cards" data-resp-id="desA">' +
  '<div class="av" style="width:22px;height:22px;border-radius:50%;background:#7A5CFF;color:#fff;font:800 9px Segoe UI;display:flex;align-items:center;justify-content:center">BM</div>' +
  '<div class="kbv2-sla-live-tx"><div class="kbv2-sla-live-n">Boaz Macêdo</div>' +
  '<div class="kbv2-sla-live-c" data-sla-live-count>' + (txt || '') + '</div></div></div>';

function pageHtml(withBands) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>body{background:#0A0B10;margin:0;font-family:Segoe UI,system-ui}#content{padding:12px}.d-board-head{height:44px;color:#8b94a6;display:flex;align-items:center}.kbv2-card{width:330px;background:#151a26;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;color:#cdd6e6;margin:8px 0}</style></head>' +
    '<body class="desktop authed"><div id="app"><div id="content" class="board-mode"><div class="d-board-head">Quadro — Edição de Cards</div><div class="kbv2-board-surface">' +
    '<div class="kbv2-card">Card T1' + (withBands ? BAND('amber', 'Faltam 29m 43s') : '') + '</div>' +
    '<div class="kbv2-card">Card T3' + (withBands ? BAND(null, '') : '') + '</div>' +
    '</div></div></div>' +
    '<div id="cornerAvatar" style="position:fixed;top:11px;right:72px;width:38px;height:38px;border-radius:50%;background:#334155"></div>' +
    '<div id="login" class="hidden"></div></body></html>';
}

(async () => {
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const { chromium } = require('playwright');
  const EXE = (() => { const base = '/opt/pw-browsers'; const dirs = fs.readdirSync(base).filter(d => d.startsWith('chromium')); for (const d of dirs) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } return undefined; })();
  const browser = await chromium.launch({ executablePath: EXE });
  const R = { probes: {}, errors: {} };

  async function boot(tag, HTML, opts) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await pg.setContent(pageHtml(opts.bands), { waitUntil: 'load' });
    const dsla = opts.designerSla
      ? ',designerSla:{planStartAt:Date.now()-3600000,planDueAt:Date.now()+20*60000,plannedFinishAt:Date.now()+20*60000}'
      : '';
    const PRE =
      'var NOWBOX={v:0};function canonicalNowMs(){return NOWBOX.v||Date.now();}\n' +
      'var state={tab:"tarefas",form:null,clientView:null,designerBoard:null,personBoard:null,user:{id:"sm1",name:"Arydyjany",role:"Social Media"},users:[{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media"},{id:"desA",name:"Boaz Macêdo",role:"Designer"}],tasks:[{id:"S1",title:"Card — campanha",client:"Hospital Visão",sector:"edicao_cards",status:"andamento",assigneeId:"desA",designerAssignment:{designerId:"desA",designerName:"Boaz Macêdo",status:"sent"}' + dsla + '}]};\n' +
      'window.__opened=[];function openDetails(id){window.__opened.push(id);}\n' +
      'function flashToast(m){}\nfunction render(){}\nvar db=null;var unsub={};\n';
    let CODE = PRE + sliceOf(HTML, tag) + '\n;window.__sliceOk=1;';
    for (let tries = 0; tries < 60; tries++) {
      const r = await pg.evaluate(src => { try { (0, eval)(src); return { ok: true }; } catch (e) { return { ok: false, msg: String(e && e.message || e) }; } }, CODE);
      if (r.ok) break;
      const m = /(\w+) is not defined/.exec(r.msg || '');
      if (!m) { errs.push('boot: ' + r.msg); break; }
      const real = grabFrom(HTML, m[1]);
      CODE = (real ? real : 'var ' + m[1] + '=function(){return "";};') + '\n' + CODE;
    }
    /* contadores de instrumentação (late-binding: slaTick chama pelos NOMES) */
    await pg.evaluate(() => {
      window.__sr = 0; window.__panelBuilds = 0; window.__geoWrites = 0;
      const oSR = window.slaibRender; window.slaibRender = function () { window.__sr++; return oSR.apply(this, arguments); };
      const oRP = window.slaibRenderPanel; window.slaibRenderPanel = function () { window.__panelBuilds++; return oRP.apply(this, arguments); };
      const oCA = window.slaClusterAlign; if (oCA) window.slaClusterAlign = function () { window.__geoWrites++; return oCA.apply(this, arguments); };
      try { window.slaibRefresh(); } catch (e) { }
    });
    return { pg, ctx, errs };
  }

  async function probeVersion(tag, HTML) {
    const P = {};
    /* ── cenário A: mundo do owner (Edição de Cards, SEM designerSla) ── */
    {
      const { pg, ctx, errs } = await boot(tag + ':A', HTML, { bands: /f354fLiveEls/.test(HTML), designerSla: false });
      await pg.waitForTimeout(400);
      P.bellExists = await pg.evaluate(() => !!document.getElementById('slaib-bell'));
      P.hitTest = await pg.evaluate(() => { const b = document.getElementById('slaib-bell'); if (!b) return 'no-bell'; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el ? (el.closest('#slaib-bell') ? 'bell' : (el.id || el.className || el.tagName)) : 'none'; });
      const sr0 = await pg.evaluate(() => window.__sr);
      await pg.waitForTimeout(3200);
      P.srCallsIn3s = (await pg.evaluate(() => window.__sr)) - sr0;
      P.geoWritesIn3s = await pg.evaluate(() => window.__geoWrites);
      /* clique REAL no sino */
      const bb = await pg.evaluate(() => { const b = document.getElementById('slaib-bell'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await pg.mouse.click(bb.x, bb.y);
      await pg.waitForTimeout(150);
      P.panelOpens = await pg.evaluate(() => !!document.getElementById('slaib-ov'));
      P.panelEmptyText = await pg.evaluate(() => { const l = document.querySelector('#slaib-ov .slaib-list'); return l ? l.textContent.trim().slice(0, 40) : null; });
      /* churn do nó da lista com painel aberto */
      await pg.evaluate(() => { const l = document.querySelector('#slaib-ov .slaib-list'); if (l && l.firstElementChild) l.firstElementChild.setAttribute('data-probe-mark', '1'); });
      await pg.waitForTimeout(1400);
      P.emptyNodeSurvives = await pg.evaluate(() => !!document.querySelector('#slaib-ov .slaib-list [data-probe-mark]'));
      P.errsA = errs.slice(0, 6);
      await ctx.close();
    }
    /* ── cenário B: alerta designerSla ATIVO (sino com item; tick roda nas DUAS) ── */
    {
      const { pg, ctx, errs } = await boot(tag + ':B', HTML, { bands: false, designerSla: true });
      await pg.waitForTimeout(400);
      P.itemsB = await pg.evaluate(() => { try { return slaibCompute().length; } catch (e) { return 'err:' + e.message; } });
      const sr0 = await pg.evaluate(() => window.__sr);
      await pg.waitForTimeout(3200);
      P.srCallsIn3sB = (await pg.evaluate(() => window.__sr)) - sr0;
      const bb = await pg.evaluate(() => { const b = document.getElementById('slaib-bell'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await pg.mouse.click(bb.x, bb.y);
      await pg.waitForTimeout(150);
      P.panelOpensB = await pg.evaluate(() => !!document.getElementById('slaib-ov'));
      P.itemNodeChurnB = await pg.evaluate(() => { const it = document.querySelector('#slaib-ov .slaib-it'); if (!it) return 'no-item'; it.setAttribute('data-probe-mark', '1'); return 'marked'; });
      await pg.waitForTimeout(1400);
      P.itemSurvives1_4sB = await pg.evaluate(() => !!document.querySelector('#slaib-ov [data-probe-mark]'));
      /* clique LENTO no botão "Abrir tarefa" (mousedown → 1.1s → mouseup) */
      const btn = await pg.evaluate(() => { const b = document.querySelector('#slaib-ov [data-slaib-open]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (btn) {
        await pg.mouse.move(btn.x, btn.y); await pg.mouse.down();
        await pg.waitForTimeout(1150);
        await pg.mouse.up();
        await pg.waitForTimeout(120);
        P.slowClickOpened = await pg.evaluate(() => window.__opened.length);
        /* clique RÁPIDO de controle */
        const again = await pg.evaluate(() => { const b = document.querySelector('#slaib-ov [data-slaib-open]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        if (again) { await pg.mouse.click(again.x, again.y); await pg.waitForTimeout(120); }
        P.fastClickOpened = await pg.evaluate(() => window.__opened.length);
      } else P.slowClickOpened = 'no-button';
      P.errsB = errs.slice(0, 6);
      await ctx.close();
    }
    /* ── cenário C (borda latente): avatar display:none → alinhamento manda o sino p/ fora? ── */
    {
      const { pg, ctx } = await boot(tag + ':C', HTML, { bands: false, designerSla: false });
      await pg.waitForTimeout(300);
      P.edgeAvatarHidden = await pg.evaluate(() => {
        const av = document.getElementById('cornerAvatar'); av.style.display = 'none';
        try { slaClusterAlign(); } catch (e) { return 'err:' + e.message; }
        const b = document.getElementById('slaib-bell'); if (!b) return 'no-bell';
        const r = b.getBoundingClientRect();
        return { right: b.style.right, onScreen: r.right > 0 && r.left < window.innerWidth, rect: { l: Math.round(r.left), r: Math.round(r.right) } };
      });
      await ctx.close();
    }
    return P;
  }

  /* ── seção 198 (árvore CORRIGIDA F3.5.4G): gate por dados + monitor Estado B + sino estável ── */
  async function probe198(HTML) {
    if (!/f354gMonAlerts/.test(HTML)) return null;
    const P = {};
    const REALS = ['esc', 'initials', 'photoOf', 'userColor', 'UCOLORS', 'avatar', 'dtMs', 'SECTORS', 'SECTOR_ALIAS', 'secOf', 'isTaskCompleted', 'designerOf', 'hasDesigner', 'isDesignerFlow', 'isClientSector', 'F354F_CARDS_WARN_MS', 'F354F_CARDS_RED_MS', 'f354fPad2', 'f354fSpan', 'kbv2SlaLiveData', 'f354fSlaLiveState'];
    let PRE2 = ''; for (const n of REALS) { const s = grabFrom(HTML, n); if (s) PRE2 += s + '\n'; }
    async function boot198(mode) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
      await pg.setContent(pageHtml(false), { waitUntil: 'load' });
      const dueOff = (mode === 'active') ? 25 * 60000 : 6 * 3600000;   // 25min (janela T-30) vs 6h (fora)
      const PRE =
        'var NOWBOX={v:0};function canonicalNowMs(){return NOWBOX.v||Date.now();}\n' +
        'var _d=new Date(Date.now()+' + dueOff + ');var _p=function(n){return (n<10?"0":"")+n;};\n' +
        'var _dd=_d.getFullYear()+"-"+_p(_d.getMonth()+1)+"-"+_p(_d.getDate());var _tt=_p(_d.getHours())+":"+_p(_d.getMinutes());\n' +
        'var state={tab:"tarefas",form:null,clientView:null,designerBoard:null,personBoard:null,user:{id:"sm1",name:"Arydyjany",role:"Social Media"},users:[{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media"},{id:"desA",name:"Boaz Macêdo",role:"Designer"},{id:"desB",name:"João Pedro Albuquerque",role:"Designer"}],tasks:[{id:"T1",title:"Card — campanha",client:"Hospital Visão",sector:"edicao_cards",status:"andamento",assigneeId:"desA",dueDate:_dd,dueTime:_tt,designerAssignment:{designerId:"desA",designerName:"Boaz Macêdo",status:"sent"}}]};\n' +
        'window.__opened=[];function openDetails(id){window.__opened.push(id);}\n' +
        'function canSeeAll(u){return !!u&&u.role!=="Designer";}function canSeeTask(u,t){return !!t&&(t.assigneeId===(u&&u.id)||t.by===(u&&u.id));}\n' +
        'function flashToast(m){}\nfunction render(){}\nvar db=null;var unsub={};\n' + PRE2;
      let CODE = PRE + sliceOf(HTML, '198:' + mode) + '\n;window.__sliceOk=1;';
      for (let tries = 0; tries < 60; tries++) {
        const r = await pg.evaluate(src => { try { (0, eval)(src); return { ok: true }; } catch (e) { return { ok: false, msg: String(e && e.message || e) }; } }, CODE);
        if (r.ok) break;
        const m = /(\w+) is not defined/.exec(r.msg || '');
        if (!m) { errs.push('boot: ' + r.msg); break; }
        const real = grabFrom(HTML, m[1]);
        CODE = (real ? real : 'var ' + m[1] + '=function(){return "";};') + '\n' + CODE;
      }
      await pg.evaluate(() => {
        window.__sr = 0;
        const oSR = window.slaibRender; window.slaibRender = function () { window.__sr++; return oSR.apply(this, arguments); };
        try { window.slaibRefresh(); } catch (e) { }
      });
      return { pg, ctx, errs };
    }
    /* quieto: SEM alerta ⇒ zero tick (custo 1.0.196 de volta) */
    {
      const { pg, ctx, errs } = await boot198('idle');
      await pg.waitForTimeout(400);
      const sr0 = await pg.evaluate(() => window.__sr);
      await pg.waitForTimeout(3200);
      P.idleSrCallsIn3s = (await pg.evaluate(() => window.__sr)) - sr0;
      P.idleMonitorState = await pg.evaluate(() => { const w = document.getElementById('sla-monitor'); if (!w) return 'no-monitor'; return { alertCls: w.className.includes('f354g-alert'), status: (w.querySelector('.slamon-status') || {}).textContent || '' }; });
      P.idleErrs = errs.slice(0, 5);
      await ctx.close();
    }
    /* alerta ATIVO (T-30): Estado B + contador vivo + sino ESTÁVEL sob tick + isolamento */
    {
      const { pg, ctx, errs } = await boot198('active');
      await pg.waitForTimeout(500);
      P.activeMonitor = await pg.evaluate(() => {
        const w = document.getElementById('sla-monitor'); if (!w) return 'no-monitor';
        const av = w.querySelector('.f354g-avt .av'); const nm = w.querySelector('.f354g-nm'); const ct = w.querySelector('[data-f354g-count]');
        return { alertCls: w.className.includes('f354g-alert'), sev: /red/.test(w.className) ? 'red' : (/amber/.test(w.className) ? 'amber' : 'green'), avatar: !!av, avW: av ? Math.round(av.getBoundingClientRect().width) : 0, name: nm ? nm.textContent : null, count: ct ? ct.textContent : null };
      });
      const c0 = await pg.evaluate(() => (document.querySelector('[data-f354g-count]') || {}).textContent || '');
      await pg.waitForTimeout(2300);
      const c1 = await pg.evaluate(() => (document.querySelector('[data-f354g-count]') || {}).textContent || '');
      P.countDecrements = (c0 && c1 && c0 !== c1) ? (c0 + ' → ' + c1) : ('STUCK: ' + c0);
      P.activeSr3s = await pg.evaluate(() => window.__sr);
      /* sino: abre e o painel fica ESTÁVEL mesmo com tick rodando (assinatura) */
      const bb = await pg.evaluate(() => { const b = document.getElementById('slaib-bell'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      if (bb) {
        await pg.mouse.click(bb.x, bb.y); await pg.waitForTimeout(150);
        P.panelOpens = await pg.evaluate(() => !!document.getElementById('slaib-ov'));
        await pg.evaluate(() => { const l = document.querySelector('#slaib-ov .slaib-list'); if (l && l.firstElementChild) l.firstElementChild.setAttribute('data-probe-mark', '1'); });
        await pg.waitForTimeout(1600);
        P.panelNodeSurvivesUnderTick = await pg.evaluate(() => !!document.querySelector('#slaib-ov .slaib-list [data-probe-mark]'));
      }
      /* isolamento por aba: desB (sem cobrança) ⇒ Estado A; desA ⇒ Estado B */
      P.isolation = await pg.evaluate(() => {
        state.designerBoard = 'desB'; slaMonRender();
        const wB = document.getElementById('sla-monitor');
        const inB = { alert: wB.className.includes('f354g-alert'), status: (wB.querySelector('.slamon-status') || {}).textContent || '' };
        state.designerBoard = 'desA'; slaMonRender();
        const wA = document.getElementById('sla-monitor');
        const inA = { alert: wA.className.includes('f354g-alert'), name: (wA.querySelector('.f354g-nm') || {}).textContent || '' };
        state.designerBoard = null; slaMonRender();
        return { tabB: inB, tabA: inA };
      });
      P.activeErrs = errs.slice(0, 5);
      await ctx.close();
    }
    return P;
  }

  R.probes['v197'] = await probeVersion('197', SRC197);
  R.probes['v196'] = await probeVersion('196', SRC196);
  R.probes['v198'] = await probe198(SRCWT /* árvore de trabalho F3.5.4G */);
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
})();
