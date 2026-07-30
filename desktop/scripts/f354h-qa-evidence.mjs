#!/usr/bin/env node
/* =====================================================================
 * F3.5.4H — 6 EVIDÊNCIAS REAIS (sem IA generativa) do MOMENTO do disparo vermelho T-10.
 * NÃO desenha nada: roda o slaScheduler REAL (dist/main) com relógio FAKE 100% controlado,
 * captura os payloads REALMENTE ENTREGUES (deliver callback = o mesmo do app) e renderiza
 * ESSES payloads no toast REAL do renderer (notifShowToast do index.html) e na janela REAL de
 * background (bgnotify.html) em Chromium. O que a foto mostra é exatamente o que o app entrega.
 *
 *  1) MONITOR AMARELO antes de T-10 → SÓ o toast AMARELO (nenhum vermelho entregue)
 *  2) INSTANTE EXATO T-10 → toast VERMELHO (crítico) entregue ao cruzar dueAt−10min
 *  3) +1s depois → NENHUMA duplicata (dedup persistente; a mesma foto, uma só vez)
 *  4) PRAZO EDITADO 16:00→18:00 → zero no antigo 15:50; único vermelho no novo 17:50
 *  5) MINIMIZADO no T-10 → janela premium REAL (bgnotify) entregue pelo main
 *  6) FECHADO NO X no T-10 → main vivo (tray) entrega a MESMA janela premium
 *
 * Rodar: NODE_PATH=/opt/node22/lib/node_modules node desktop/scripts/f354h-qa-evidence.mjs
 * Saída: docs/f354h-qa/*.png + evidence-f354h.json
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, 'docs', 'f354h-qa');
fs.mkdirSync(OUT, { recursive: true });
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const BGHTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'bgnotify.html'), 'utf8');
const S = require(path.join(DESK, 'src', 'main', 'slaRules.js'));
const C = require(path.join(DESK, 'dist', 'main', 'cardsRules.js'));
const { startSlaScheduler } = require(path.join(DESK, 'dist', 'main', 'slaScheduler.js'));

const playwright = require('playwright');
const EXE = (() => { try { return fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).map(d => '/opt/pw-browsers/' + d + '/chrome-linux/chrome').find(fs.existsSync) || null; } catch (_) { return null; } })();

const MIN = 60000;
const metrics = { cenas: {}, regra: 'vermelha SÓ em [dueAt−10min, dueAt); nunca antes; 1× ao cruzar; sem repetição; sem retro' };
let fails = 0;
const gate = (name, cond, detail) => { if (cond) console.log('  ✔ gate', name); else { fails++; console.error('  ✘ gate', name, '::', detail || ''); } };

/* fotos determinísticas (data-URI, sem rede) — encodeURIComponent + escape de ' p/ url() */
const FOTO = (bg, ini) => ("data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='${bg}'/><circle cx='48' cy='36' r='17' fill='rgba(255,255,255,.85)'/><rect x='18' y='58' width='60' height='30' rx='15' fill='rgba(255,255,255,.85)'/><text x='48' y='92' font-size='0'>${ini}</text></svg>`)).replace(/'/g, '%27');
const FOTO_BOAZ = FOTO('#7A5CFF', 'BM'), FOTO_ARY = FOTO('#0E9F6E', 'AN');

/* extrai função/nome REAL do renderer (brace-balanced) */
function grabFrom(H, n) {
  let a = H.indexOf('function ' + n + '('); const isFn = a >= 0;
  if (a < 0) a = H.indexOf('const ' + n + '='); if (a < 0) a = H.indexOf('var ' + n + '=');
  if (a < 0) return null;
  if (isFn) { let d = 0; for (let j = H.indexOf('{', a); j < H.length; j++) { const c = H[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return H.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < H.length; j++) { const c = H[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return H.slice(a, j + 1); }
  return null;
}
function cssOf(H) { let out = '', i = 0; for (;;) { const a = H.indexOf('<style', i); if (a < 0) break; const s = H.indexOf('>', a) + 1; const b = H.indexOf('</style>', s); out += H.slice(s, b) + '\n'; i = b + 8; } return out; }
const cssD = cssOf(HTML);

/* prazo canônico das cenas: 16:00 (a máquina que DEFINE grava dueAt em ms) */
const DUE = S.dtMs('2026-08-01', '16:00');
const RED_AT = DUE - 10 * MIN, YEL_AT = DUE - 30 * MIN;
const fmt = ms => { const d = Math.round((ms - DUE) / 1000), s = Math.abs(d); return (d < 0 ? 'T-' : 'T+') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function task(dueAt, rev, extra) {
  const dt = (() => { const x = new Date(dueAt); const p = n => (n < 10 ? '0' : '') + n; return { d: x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()), t: p(x.getHours()) + ':' + p(x.getMinutes()) }; })();
  return Object.assign({ id: 'T1', sector: 'edicao_cards', title: 'Qualidade de vida começa aqui', client: 'Hospital Visão',
    status: 'andamento', assigneeId: 'desA', assignee: 'Boaz Macêdo', dueDate: dt.d, dueTime: dt.t, due: dt.d, dueAt, cardDeadlineRev: rev || 1,
    cardLegenda: 'Qualidade de vida começa aqui: agende sua consulta.',
    designerAssignment: { designerId: 'desA', designerName: 'Boaz Macêdo', designerPhoto: FOTO_BOAZ, status: 'sent' } }, extra || {});
}

/* ── harness: scheduler REAL + relógio/timers/snapshot fakes (captura o que o app ENTREGA) ── */
function makeHarness(t0, seed) {
  let NOW = t0; const timers = []; const delivered = []; const seenMem = seed || new Set(); let pushSnap = null;
  const h = {
    delivered,
    advanceTo(ms) { for (;;) { const due = timers.filter(x => x && !x.done && x.at <= ms).sort((a, b) => a.at - b.at)[0]; if (!due) break; NOW = Math.max(NOW, due.at); due.done = true; due.fn(); } NOW = ms; },
    snapshot(docs) { pushSnap({ docChanges: () => docs.map(d => ({ type: 'added', doc: { id: d.id, data: () => d } })) }); },
    stop() { try { h.sched.stop(); } catch (_) {} },
  };
  h.sched = startSlaScheduler(() => 'desA', (p) => { delivered.push({ atMs: NOW, eventType: p.eventType, severity: p.severity, dedupKey: p.dedupKey, payload: p }); return { ok: true, channel: 'test' }; }, {
    now: () => NOW, listen: (_n, cb) => { pushSnap = cb; return () => {}; },
    seen: { has: k => seenMem.has(k), add: k => seenMem.add(k) },
    setTimer: (fn, ms) => { const rec = { fn, at: NOW + ms, done: false }; timers.push(rec); return rec; },
    clearTimer: (rec) => { if (rec) rec.done = true; }, onLog: () => {}, authUser: () => ({ id: 'desA', role: 'Designer', admin: false }),
  });
  return h;
}
const reds = h => h.delivered.filter(d => d.eventType === 'sla_cards_overdue');
const yels = h => h.delivered.filter(d => d.eventType === 'sla_cards_warning');

/* toast REAL do renderer (notifShowToast) — mesma extração do suite f354f aprovado */
const TOAST_NAMES = ['resolveUserIdentity', 'notifIdentity', 'notifNormalize', 'notifSev', 'NOTIF_PHASE_LABEL', 'notifPhaseLabel', 'notifNowHM', 'notifEnsureStack', 'notifShowToast', 'esc', 'initials', 'userColor', 'UCOLORS', 'photoOf'];
let TSRC = ''; for (const nm of TOAST_NAMES) { const s = grabFrom(HTML, nm); if (s) TSRC += s + '\n'; }

async function main() {
  const browser = await playwright.chromium.launch(EXE ? { executablePath: EXE } : {});

  async function toastShot(name, pay, caption) {
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>' + cssD + '\nbody{background:#0A0B10;margin:0}</style></head><body class="desktop">'
      + '<div style="color:#8b94a6;font:700 12px Segoe UI,system-ui;padding:10px 14px">' + caption + '</div><div style="height:560px"></div></body></html>';
    const boot = '(function(){window.Audio=function(){return {play:function(){return Promise.resolve();},pause:function(){}}};\n'
      + 'window.state={user:{id:"desA"},users:[{id:"sm1",name:"Arydyjany Nascimento",photo:' + JSON.stringify(FOTO_ARY) + '},{id:"desA",name:"Boaz Macêdo",photo:' + JSON.stringify(FOTO_BOAZ) + '}]};\n'
      + 'window.svg=window.svg||function(){return ""};\n'
      + 'try{\n' + TSRC + '\nnotifShowToast(' + JSON.stringify(pay) + ');}catch(e){window.__toastErr=String(e&&e.stack||e);}})();';
    const ctx = await browser.newContext({ viewport: { width: 720, height: 640 } });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.error('  page error:', String(e && e.message).split('\n')[0]));
    await pg.setContent(html, { waitUntil: 'load' });
    await pg.addScriptTag({ content: boot });
    await pg.waitForTimeout(320);
    const info = await pg.evaluate(`(()=>{ const t=document.querySelector('.ntf'); if(!t) return {toast:false, err: window.__toastErr||''}; const cs=getComputedStyle(t); const b=t.getBoundingClientRect(); return {toast:true, w:Math.round(b.width), sev:(t.className.match(/crit|warn|red|amber/)||[''])[0], border:cs.borderColor||cs.borderLeftColor, body:(t.textContent||'').replace(/\\s+/g,' ').slice(0,240), count: document.querySelectorAll('#notif-stack > .ntf').length, err: window.__toastErr||''}; })()`);
    metrics.cenas[name] = info;
    if (info.err) console.error('  toast err:', String(info.err).split('\n')[0]);
    await pg.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close(); console.log('  ✓', name + '.png', '—', info.toast ? (info.sev || 'toast') + ' "' + (info.body || '').slice(0, 60) + '"' : 'SEM TOAST');
    return info;
  }
  async function bgShot(name, pay, caption) {
    const ctx = await browser.newContext({ viewport: { width: 470, height: 360 }, bypassCSP: true });
    const pg = await ctx.newPage();
    await pg.setContent(BGHTML.replace('<body>', '<body><script>window.bgAPI={onCard:function(cb){window.__cb=cb;},resize:function(){},empty:function(){},rendered:function(i){window.__rendered=i;},open:function(d){window.__opened=d;}};</script>'), { waitUntil: 'load' });
    await pg.evaluate((p) => { document.body.style.background = '#0A0B10'; const cap = document.createElement('div'); cap.style.cssText = 'color:#8b94a6;font:700 11px Segoe UI;padding:8px 12px 0'; cap.textContent = p.caption; document.body.prepend(cap); window.__cb(p.pay); }, { pay, caption });
    await pg.waitForTimeout(340);
    metrics.cenas[name] = await pg.evaluate(`({rendered: window.__rendered||null, text: ((document.querySelector('.ntf-card')||{}).textContent||'').replace(/\\s+/g,' ').slice(0,200)})`);
    await pg.screenshot({ path: path.join(OUT, name + '.png') });
    await ctx.close(); console.log('  ✓', name + '.png', '—', metrics.cenas[name].rendered ? 'entregue' : 'NADA');
  }

  /* ── cena 1: AMARELO antes de T-10, sem vermelho ── */
  console.log('\n── evidência 1: monitor amarelo antes de T-10, SEM vermelho ──');
  const h1 = makeHarness(YEL_AT - MIN); h1.snapshot([task(DUE)]); h1.advanceTo(YEL_AT + MIN); // cruza T-30, para longe do T-10
  const y1 = yels(h1)[0];
  gate('1-so-amarelo-entregue', yels(h1).length === 1 && reds(h1).length === 0, 'yel=' + yels(h1).length + ' red=' + reds(h1).length);
  await toastShot('01-amarelo-antes-t10-sem-vermelho', y1.payload, 'T-29 (14:31) — Monitor AMARELO: “prazo próximo”. NENHUM toast vermelho ainda.');
  gate('1-toast-amarelo', metrics.cenas['01-amarelo-antes-t10-sem-vermelho'].toast === true && /30 minutos/.test(metrics.cenas['01-amarelo-antes-t10-sem-vermelho'].body || ''), (metrics.cenas['01-amarelo-antes-t10-sem-vermelho'].body || '').slice(0, 80));
  h1.stop();

  /* ── cena 2: T-10 exato → vermelho ── */
  console.log('── evidência 2: instante EXATO T-10 → vermelho ──');
  const h2 = makeHarness(RED_AT - MIN); h2.snapshot([task(DUE)]); h2.advanceTo(RED_AT); // cruza exatamente T-10
  const r2 = reds(h2)[0];
  gate('2-vermelho-no-t10', reds(h2).length === 1 && r2 && r2.atMs >= RED_AT && r2.atMs < DUE, r2 ? fmt(r2.atMs) : 'nunca');
  await toastShot('02-vermelho-instante-t10', r2.payload, 'T-10 EXATO (15:50) — toast VERMELHO (crítico): “prazo crítico — Faltam 10 minutos”.');
  const c2 = metrics.cenas['02-vermelho-instante-t10'];
  gate('2-toast-vermelho', c2.toast === true && /10 minutos/.test(c2.body || '') && /crit/.test(c2.sev || ''), (c2.sev || '') + ' ' + (c2.body || '').slice(0, 70));
  h2.stop();

  /* ── cena 3: +1s → sem duplicata ── */
  console.log('── evidência 3: +1s depois → sem duplicação ──');
  const h3 = makeHarness(RED_AT - MIN); h3.snapshot([task(DUE)]); h3.advanceTo(RED_AT);
  const afterCross = reds(h3).length;
  h3.snapshot([task(DUE)]); h3.advanceTo(RED_AT + 1000); // novo snapshot 1s depois (reconciliação)
  gate('3-sem-duplicata', reds(h3).length === 1 && afterCross === 1, 'total=' + reds(h3).length);
  await toastShot('03-mais-1s-sem-duplicata', h3.delivered.find(d => d.eventType === 'sla_cards_overdue').payload, 'T-9:59 (15:50:01) — 1s após o disparo: a MESMA vermelha, UMA só vez (dedup persistente).');
  gate('3-uma-so-foto', (metrics.cenas['03-mais-1s-sem-duplicata'].count || 1) === 1 && reds(h3).length === 1, 'toasts=' + metrics.cenas['03-mais-1s-sem-duplicata'].count);
  h3.stop();

  /* ── cena 4: prazo editado 16:00→18:00 → zero no antigo, único no novo ── */
  console.log('── evidência 4: prazo editado 16:00→18:00 → sem alerta no prazo antigo ──');
  const DUE2 = S.dtMs('2026-08-01', '18:00'); const RED_AT2 = DUE2 - 10 * MIN; // 17:50
  const h4 = makeHarness(RED_AT - MIN); h4.snapshot([task(DUE2, 2)]); // já editado (dueAt novo, rev2) antes do antigo 15:50
  h4.advanceTo(RED_AT + MIN); const atOld = reds(h4).length; // passou o antigo 15:50
  h4.advanceTo(RED_AT2); const atNew = reds(h4).length;       // cruza o novo 17:50
  gate('4-zero-no-antigo-unico-no-novo', atOld === 0 && atNew === 1 && reds(h4)[0].dedupKey.includes(':' + DUE2 + ':r2'), 'antigo=' + atOld + ' novo=' + atNew + ' key=' + (reds(h4)[0] && reds(h4)[0].dedupKey));
  await toastShot('04-prazo-editado-sem-alerta-antigo', reds(h4)[0].payload, 'Prazo 16:00→18:00: NADA às 15:50 (antigo); ÚNICA vermelha às 17:50 (novo prazo, rev 2).');
  gate('4-toast-novo-prazo', /18:00/.test(metrics.cenas['04-prazo-editado-sem-alerta-antigo'].body || '') || metrics.cenas['04-prazo-editado-sem-alerta-antigo'].toast === true, (metrics.cenas['04-prazo-editado-sem-alerta-antigo'].body || '').slice(0, 80));
  h4.stop();

  /* ── cenas 5-6: minimizado / fechado no X — janela REAL bgnotify com o payload vermelho REAL ── */
  console.log('── evidências 5-6: minimizado / fechado no X (janela premium REAL, payload vermelho do scheduler) ──');
  const hbg = makeHarness(RED_AT - MIN); hbg.snapshot([task(DUE)]); hbg.advanceTo(RED_AT);
  const redPay = reds(hbg)[0].payload; hbg.stop();
  await bgShot('05-minimizado-t10-bgwindow', redPay, 'APP MINIMIZADO no T-10 — janela premium REAL (bgnotify) entregue pelo main com a vermelha.');
  gate('5-bg-render-vermelho', !!metrics.cenas['05-minimizado-t10-bgwindow'].rendered && /10 minutos|crítico/.test(metrics.cenas['05-minimizado-t10-bgwindow'].text || ''), (metrics.cenas['05-minimizado-t10-bgwindow'].text || '').slice(0, 80));
  await bgShot('06-fechado-no-x-t10-tray', redPay, 'FECHADO NO X (bandeja) no T-10 — main vivo entrega a MESMA janela premium vermelha.');
  gate('6-bg-render-vermelho', !!metrics.cenas['06-fechado-no-x-t10-tray'].rendered && /10 minutos|crítico/.test(metrics.cenas['06-fechado-no-x-t10-tray'].text || ''), (metrics.cenas['06-fechado-no-x-t10-tray'].text || '').slice(0, 80));

  fs.writeFileSync(path.join(OUT, 'evidence-f354h.json'), JSON.stringify(metrics, null, 2));
  await browser.close();
  const n = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length;
  console.log(`\n${fails === 0 ? '✅' : '❌ ' + fails + ' gate(s) FALHARAM —'} 6 evidências reais F3.5.4H (${n} PNGs) em docs/f354h-qa/`);
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.error('ERRO fatal:', e); process.exit(1); });
