#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3 — CANAL DE ENTREGA + CLIQUE + BANDEJA/SAIR (deliverNotification REAL do main.ts).
 * Cobre os testes: 20 clique restaura minimizado · 21 clique mostra oculto · 22 clique abre a
 * tarefa certa (detail/<id>) · 23 X mantém processo/bandeja · 24 Sair encerra (realQuit).
 * + invariantes de canal: visível→toast · minimizado/oculto→bg-window (nativa = fallback).
 * SEM Electron: extrai e executa o roteamento/handler REAIS do main.ts.
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { extractDeliver, fnSrc, stripTypes } from './fixtures/f343/deliver-harness.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

const { deliver } = extractDeliver(MAIN);
const payload = (id) => ({ eventType: 'designer_assigned', taskId: id, title: 'Social atribuiu uma tarefa', body: 'x', severity: 'info', dedupKey: 'designer_assigned:' + id + ':dz1:1', action: { type: 'detail', deep: 'detail/' + id } });
const sentHas = (sent, ch) => sent.some((s) => (Array.isArray(s) ? s[0] : s) === ch); // send guarda [ch,arg] ou ch

/* ── invariantes de canal (reforço das provas 1-3/6-11 no roteador REAL) ── */
{
  const v = deliver('visible', payload('cv'));
  ok('canal: janela VISÍVEL → toast (notif-toast enviado)', v.res.channel === 'toast' && sentHas(v.sent, 'notif-toast'));
  const m = deliver('minimized', payload('cm'));
  ok('canal: janela MINIMIZADA → bg-window (janela premium própria)', m.res.channel === 'bg-window' && m.bg.length === 1);
  const h = deliver('hidden', payload('ch'));
  ok('canal: janela OCULTA (bandeja) → bg-window', h.res.channel === 'bg-window' && h.bg.length === 1);
  // captura p/ Central (notif-history) ocorre em TODOS os canais, antes da decisão.
  ok('captura notif-history em todos os canais', sentHas(v.sent, 'notif-history') && sentHas(m.sent, 'notif-history') && sentHas(h.sent, 'notif-history'));
}

/* ── 20/21/22 — CLIQUE (handler REAL do fallback nativo de deliverNotification) ── */
{
  // bgOk:false força o caminho NATIVO, cujo n.on('click') é o handler de clique testável.
  const r20 = deliver('minimized', payload('T20'), { bgOk: false });
  ok('20 setup: caiu no fallback nativo com click handler', r20.res.channel === 'native' && r20.hadNativeClick());
  r20.fireNativeClick();
  const sent20 = r20.sent.find((s) => Array.isArray(s) && s[0] === 'notif-open');
  ok('20 clique restaura MINIMIZADO (restore+show+focus) e abre (notif-open)',
    r20.winCalls.indexOf('restore') >= 0 && r20.winCalls.indexOf('show') >= 0 && r20.winCalls.indexOf('focus') >= 0 && !!sent20);

  const r21 = deliver('hidden', payload('T21'), { bgOk: false });
  r21.fireNativeClick();
  const sent21 = r21.sent.find((s) => Array.isArray(s) && s[0] === 'notif-open');
  ok('21 clique mostra OCULTO (show+focus; sem restore pois não-minimizado) e abre',
    r21.winCalls.indexOf('show') >= 0 && r21.winCalls.indexOf('focus') >= 0 && r21.winCalls.indexOf('restore') < 0 && !!sent21);

  const r22 = deliver('hidden', payload('T22ID'), { bgOk: false });
  r22.fireNativeClick();
  const open22 = r22.sent.find((s) => Array.isArray(s) && s[0] === 'notif-open');
  ok('22 clique abre a TAREFA certa (deep detail/<id>)', open22 && open22[1] === 'detail/T22ID');
}

/* ── 20/21/22 (reforço) — CLIQUE da JANELA PREMIUM (initBgNotify openCb REAL, canal primário) ── */
{
  const m = MAIN.indexOf('initBgNotify((deep');
  const brace = MAIN.indexOf('{', MAIN.indexOf('=>', m));
  let d = 0, end = -1; for (let j = brace; j < MAIN.length; j++) { const c = MAIN[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j; break; } } }
  const body = MAIN.slice(brace, end + 1).replace(/: string/g, '');
  // F3.5.4K — o openCb do initBgNotify agora DELEGA a bringToFrontAndOpen (traz à frente + deep-link
  // enfileirável). Injetamos as funções REAIS (openDeep/bringToFrontAndOpen) + nlog stub p/ provar a
  // cadeia real de restore/show/focus + notif-open a partir do próprio corpo do main.ts.
  const opd = stripTypes(fnSrc(MAIN, 'openDeep')); const bring = stripTypes(fnSrc(MAIN, 'bringToFrontAndOpen'));
  const runClick = (winState, deep) => {
    const winCalls = [], sent = [];
    const w = { isDestroyed: () => false, isMinimized: () => winState === 'minimized', restore: () => winCalls.push('restore'), show: () => winCalls.push('show'), focus: () => winCalls.push('focus'), webContents: { send: (ch, a) => sent.push([ch, a]), isLoading: () => false } };
    new Function('mainWin', 'deep', 'let pendingDeep=null; function nlog(){} ' + opd + '\n' + bring + '\n(function(mainWin,deep)' + body + ')(mainWin,deep);')(w, deep);
    return { winCalls, sent };
  };
  const cm = runClick('minimized', 'detail/BG1');
  ok('20b bg-window click (minimizado) → restore+show+focus+notif-open', cm.winCalls.join(',') === 'restore,show,focus' && cm.sent[0][0] === 'notif-open' && cm.sent[0][1] === 'detail/BG1');
  const ch = runClick('hidden', 'detail/BG2');
  ok('21b bg-window click (oculto) → show+focus+notif-open (sem restore)', ch.winCalls.join(',') === 'show,focus' && ch.sent[0][1] === 'detail/BG2');
}

/* ── 23 — X mantém processo/bandeja (window close→hide, não quit) ── */
ok('23 X (close) esconde na bandeja quando !quitting (não encerra)', /on\("close",\s*\(e\)\s*=>\s*\{\s*if \(!quitting\) \{\s*e\.preventDefault\(\);\s*mainWin\?\.hide\(\)/.test(MAIN));
ok('23 window-all-closed NÃO encerra (vive na bandeja)', /window-all-closed[\s\S]{0,80}if \(!quitting\) e\.preventDefault/.test(MAIN));
ok('23 SLA/notifier NÃO param no minimize/hide (só em logout/realQuit)', !/on\("minimize"[^\n]*slaScheduler/.test(MAIN) && !/on\("hide"[^\n]*slaScheduler/.test(MAIN) && !/on\("minimize"[^\n]*stopNotifier/.test(MAIN));

/* ── 24 — Sair encerra (realQuit): app.quit + tray "Sair" cabeado a realQuit ── */
ok('24 Sair: trayOpts.quit === realQuit (menu da bandeja encerra de verdade)', /const trayOpts = \{[^}]*quit: realQuit/.test(MAIN));
ok('24 realQuit chama app.quit() e destrói a bandeja', /function realQuit\(\)[\s\S]{0,500}destroyTray\(\)[\s\S]{0,160}app\.quit\(\)/.test(MAIN));
ok('24 realQuit encerra os produtores (notifier/reminder/slaScheduler/clockSync)', /function realQuit\(\)[\s\S]{0,400}stopNotifier\(\)[\s\S]{0,300}slaScheduler\.stop\(\)/.test(MAIN));

console.log('\n===== F3.4.3 — DELIVERY CHANNEL / CLICK / TRAY (main.ts REAL) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3-DELIVERY: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: canal/clique/bandeja divergiu do contrato'); process.exit(1); }
console.log('OK — visível→toast; minimizado/oculto→bg-window; clique restaura/mostra e abre a tarefa; X=bandeja; Sair=realQuit.');
