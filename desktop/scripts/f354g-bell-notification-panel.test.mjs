/**
 * F3.5.4G — f354g-bell-notification-panel.test.mjs
 * =====================================================================================
 * RESTAURAÇÃO DO SINO (topo direito) — 15 asserts obrigatórios da fase + cenário 5
 * multiusuário (clicar no sino → painel abre → clicar na notificação → abre a tarefa).
 * INTERATIVO: o BLOCO REAL slaib/slaMon/f354g do index.html roda em Chromium com
 * timers REAIS e cliques REAIS de mouse (Playwright). Cobre a causa-raiz da 1.0.197:
 * painel aberto era reconstruído a cada tick e o clique morria entre mousedown/mouseup.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'index.html'), 'utf8');
const MAINTS = fs.readFileSync(path.join(ROOT, 'src', 'main', 'main.ts'), 'utf8');

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
function sliceOf(H) {
  const sA = 'Sino fixo (portal no <body>'; let s = H.indexOf(sA); s = H.lastIndexOf('/*', s);
  const eA = 'try{ setTimeout(slaibRefresh,0); }catch(_){}'; const e = H.indexOf(eA);
  return H.slice(s, e + eA.length);
}
const REALS = ['esc', 'initials', 'photoOf', 'userColor', 'UCOLORS', 'avatar', 'dtMs', 'SECTORS', 'SECTOR_ALIAS', 'secOf', 'isTaskCompleted', 'designerOf', 'hasDesigner', 'isDesignerFlow', 'isClientSector', 'F354F_CARDS_WARN_MS', 'F354F_CARDS_RED_MS', 'f354fPad2', 'f354fSpan', 'kbv2SlaLiveData', 'f354fSlaLiveState'];
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

  async function boot() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errsAll.push('pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') errsAll.push('console: ' + m.text()); });
    /* origem HTTP real (localStorage funcional p/ "Marcar lida"/badge — about:blank é origem opaca) */
    await pg.route('**/f354g.local/**', r => r.fulfill({ contentType: 'text/html', body: PAGE }));
    await pg.goto('http://f354g.local/', { waitUntil: 'load' });
    /* fixtures: 1 tarefa designerSla em janela AMARELA (item do sino) + 1 cobrança de cards
       AMARELA (monitor Estado B) ⇒ o tick de 1s RODA (pior caso da 1.0.197). */
    const PRE =
      'var NOWBOX={v:0};function canonicalNowMs(){return NOWBOX.v||Date.now();}\n' +
      'var _d1=new Date(Date.now()+20*60000),_d2=new Date(Date.now()+25*60000);var _p=function(x){return (x<10?"0":"")+x;};\n' +
      'var _dd=function(d){return d.getFullYear()+"-"+_p(d.getMonth()+1)+"-"+_p(d.getDate());},_tt=function(d){return _p(d.getHours())+":"+_p(d.getMinutes());};\n' +
      'var state={tab:"tarefas",form:null,clientView:null,designerBoard:null,personBoard:null,'
      + 'user:{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media"},'
      + 'users:[{id:"sm1",name:"Arydyjany Nascimento",role:"Social Media"},{id:"desA",name:"Boaz Macêdo",role:"Designer"}],'
      + 'tasks:['
      + '{id:"D1",title:"Cronograma Agosto",client:"Hospital Visão",sector:"cronograma",status:"afazer",assigneeId:"desA",designerFlowStatus:"afazer",'
      + 'designerSla:{planStartAt:Date.now()-3600000,planDueAt:Date.now()+20*60000,seedAt:Date.now()-3700000,scheduleRevision:1},'
      + 'designerAssignment:{designerId:"desA",designerName:"Boaz Macêdo",assignedAt:Date.now()-3600000,assignedBy:"sm1"}},'
      + '{id:"C1",title:"Card — campanha",client:"Hospital Visão",sector:"edicao_cards",status:"andamento",assigneeId:"desA",'
      + 'dueDate:_dd(_d2),dueTime:_tt(_d2),cardDeadlineRev:1,designerAssignment:{designerId:"desA",designerName:"Boaz Macêdo",status:"sent"}}'
      + ']};\n' +
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
  const bellCenter = pg => pg.evaluate(() => { const b = document.getElementById('slaib-bell'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });

  console.log('\n══ Sino restaurado — interativo (Chromium, cliques e timers reais) ══');
  const { pg, ctx } = await boot();
  await pg.waitForTimeout(400);

  /* 1. clicável: existe, hit-test devolve o próprio sino, cursor pointer */
  const hit = await pg.evaluate(() => {
    const b = document.getElementById('slaib-bell'); if (!b) return { ok: false, why: 'no-bell' };
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: !!(el && el.closest('#slaib-bell')), cursor: getComputedStyle(b).cursor, on: r.right > 0 && r.left < innerWidth && r.top >= 0 };
  });
  ok(hit.ok && hit.cursor === 'pointer' && hit.on, 'sino é CLICÁVEL (hit-test devolve o sino; cursor pointer; dentro da tela)');
  /* 2. abre painel/lista com clique REAL */
  let bc = await bellCenter(pg);
  await pg.mouse.click(bc.x, bc.y); await pg.waitForTimeout(150);
  const opened = await pg.evaluate(() => ({ ov: !!document.getElementById('slaib-ov'), list: !!document.querySelector('#slaib-ov .slaib-list'), hd: (document.querySelector('#slaib-ov .slaib-hd b') || {}).textContent }));
  ok(opened.ov && opened.list && opened.hd === 'Alertas de SLA', 'clique no sino ABRE o painel "Alertas de SLA" com a lista');
  /* 5. itens listam normalmente (alerta designerSla real) */
  const items = await pg.evaluate(() => Array.from(document.querySelectorAll('#slaib-ov .slaib-it')).map(it => ({ t: (it.querySelector('.t') || {}).textContent, s: (it.querySelector('.s') || {}).textContent, unread: it.className.includes('unread') })));
  ok(items.length === 1 && /Prazo próximo/.test(items[0].t || '') && /Cronograma Agosto/.test(items[0].s || ''),
    `itens listam normalmente (1 alerta real: "${items[0] && items[0].t}")`);
  /* 4. badge/contador correto (1 não lida → some ao marcar lida) */
  const badge0 = await pg.evaluate(() => { const c = document.getElementById('slaib-count'); return { txt: c ? c.textContent : null, vis: c ? getComputedStyle(c).display !== 'none' : false }; });
  await pg.evaluate(() => { document.querySelector('#slaib-ov [data-slaib-read]').click(); });
  await pg.waitForTimeout(120);
  const badge1 = await pg.evaluate(() => { const c = document.getElementById('slaib-count'); return { vis: c ? getComputedStyle(c).display !== 'none' : false }; });
  ok(badge0.txt === '1' && badge0.vis === true && badge1.vis === false,
    'badge correto: "1" não lida; após "Marcar lida" o badge some (estado persistido)');
  /* 13. ABERTO + tick ATIVO: painel ESTÁVEL (assinatura) — nó sobrevive e clique LENTO completa */
  await pg.evaluate(() => { const it = document.querySelector('#slaib-ov .slaib-it'); if (it) it.setAttribute('data-probe-mark', '1'); });
  await pg.waitForTimeout(1700);
  const stable = await pg.evaluate(() => !!document.querySelector('#slaib-ov [data-probe-mark]'));
  const btn = await pg.evaluate(() => { const b = document.querySelector('#slaib-ov [data-slaib-open]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.mouse.move(btn.x, btn.y); await pg.mouse.down();
  await pg.waitForTimeout(1150);                       // um tick INTEIRO acontece com o botão pressionado
  await pg.mouse.up(); await pg.waitForTimeout(120);
  const slowOpened = await pg.evaluate(() => window.__opened.slice());
  ok(stable === true && slowOpened.length === 1 && slowOpened[0] === 'D1',
    'ABERTO sob tick ativo: painel NÃO é reconstruído (nó sobrevive) e clique LENTO (down→1,1s→up) COMPLETA e abre a tarefa');
  /* 6. clique em item abre a tarefa CORRETA (cenário 5 multiusuário) — reabre e clica normal */
  bc = await bellCenter(pg);
  await pg.mouse.click(bc.x, bc.y); await pg.waitForTimeout(150);
  const btn2 = await pg.evaluate(() => { const b = document.querySelector('#slaib-ov [data-slaib-open]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.mouse.click(btn2.x, btn2.y); await pg.waitForTimeout(120);
  const fastOpened = await pg.evaluate(() => window.__opened.slice());
  ok(fastOpened.length === 2 && fastOpened[1] === 'D1' && await pg.evaluate(() => !document.getElementById('slaib-ov')),
    'CENÁRIO 5: sino → painel → clique na notificação ABRE A TAREFA CORRETA (D1) e fecha o painel');
  /* 3. fecha: clique no sino fecha; reabre; clique FORA fecha */
  bc = await bellCenter(pg);
  await pg.mouse.click(bc.x, bc.y); await pg.waitForTimeout(120);
  const o1 = await pg.evaluate(() => !!document.getElementById('slaib-ov'));
  await pg.mouse.click(bc.x, bc.y); await pg.waitForTimeout(120);
  const o2 = await pg.evaluate(() => !!document.getElementById('slaib-ov'));
  await pg.mouse.click(bc.x, bc.y); await pg.waitForTimeout(120);
  await pg.mouse.click(30, 700); await pg.waitForTimeout(120);   // clique no backdrop (fora do painel)
  const o3 = await pg.evaluate(() => !!document.getElementById('slaib-ov'));
  ok(o1 === true && o2 === false && o3 === false, 'sino FECHA o painel (toggle) e clique fora também fecha');
  /* 8. sem overlay cobrindo o sino — inclusive com o monitor Estado B ATIVO ao lado */
  const noCover = await pg.evaluate(() => {
    const b = document.getElementById('slaib-bell'); const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const w = document.getElementById('sla-monitor'); const wr = w ? w.getBoundingClientRect() : null;
    const intersects = wr ? !(wr.right <= r.left || wr.left >= r.right || wr.bottom <= r.top || wr.top >= r.bottom) : false;
    return { hitBell: !!(el && el.closest('#slaib-bell')), monAlert: w ? w.className.includes('f354g-alert') : false, intersects };
  });
  ok(noCover.hitBell && noCover.monAlert === true && noCover.intersects === false,
    'NENHUM overlay cobre o sino — nem o monitor Estado B ativo ao lado (zero colisão com o novo SLA)');
  /* 9. sem pointer-events indevidos */
  const pe = await pg.evaluate(() => ({ bell: getComputedStyle(document.getElementById('slaib-bell')).pointerEvents, mon: getComputedStyle(document.getElementById('sla-monitor')).pointerEvents }));
  ok(pe.bell !== 'none' && pe.mon !== 'none', 'sem pointer-events indevidos no sino/monitor');
  /* 15 (parte interativa). borda da 1.0.197: avatar com rect zero NÃO manda mais o sino p/ fora da tela */
  const edge = await pg.evaluate(() => {
    const av = document.getElementById('cornerAvatar'); av.style.display = 'none';
    try { slaClusterAlign(); } catch (e) { return 'err:' + e.message; }
    const b = document.getElementById('slaib-bell'); const r = b.getBoundingClientRect();
    av.style.display = '';
    return { onScreen: r.right > 0 && r.left < innerWidth };
  });
  ok(edge.onScreen === true, 'avatar com rect zero (foto carregando/re-render) NÃO desloca o sino p/ fora da tela (guarda F3.5.4G)');
  await ctx.close();
  await browser.close();

  console.log('\n══ Regressão-zero dos canais aprovados (fonte real) ══');
  /* 10 */ ok(/windowActive\(\)/.test(MAINTS) && /notif-toast/.test(MAINTS), 'toast in-app PRESERVADO (HUB → notif-toast quando a janela está ativa)');
  /* 11 */ ok(/showBgNotify/.test(MAINTS) && /backgroundThrottling:\s*false/.test(MAINTS), 'notificação nativa/janela premium de background PRESERVADA');
  /* 12 */ ok(/e\.preventDefault\(\);\s*\n?\s*mainWin\?\.hide\(\)/.test(MAINTS) && /Tray|tray/.test(MAINTS), 'tray PRESERVADO (fechar no X esconde; app segue vivo)');
  /* 14 */ ok(/visibilitychange',function\(\)\{ try\{ slaibRefresh\(\); \}/.test(HTML) && /disable-background-timer-throttling/.test(MAINTS),
    'MINIMIZADO: restauração faz passada completa (sino+monitor) e timers nunca são estrangulados');
  /* 7 */ const errsClean = errsAll.filter(e => !/favicon/i.test(e));
  ok(errsClean.length === 0, `zero erro de console/página ao clicar (${errsClean.length ? errsClean.slice(0, 3).join(' | ') : 'limpo'})`);

  console.log(`\n${fail === 0 ? '✅' : '❌'} f354g-bell-notification-panel: ${n - fail}/${n} asserts verdes`);
  if (fail) process.exit(1);
})();
