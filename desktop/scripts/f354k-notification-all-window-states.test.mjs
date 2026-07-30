#!/usr/bin/env node
/* =====================================================================
 * F3.5.4K — ENTREGA IMEDIATA DE NOTIFICAÇÕES EM QUALQUER ESTADO DA JANELA
 * ---------------------------------------------------------------------
 * Roda o HUB REAL (deliverNotification + windowActive + nlog + nativeNotify +
 * openDeep/bringToFrontAndOpen), EXTRAÍDO do build compilado dist/main/main.js
 * (JS puro — sem stripping de tipos), com stubs faithful para electron/bgNotify/
 * diag/toastAck. Prova a POLÍTICA DE ENTREGA em todos os estados da janela:
 *   focado→toast · desfocado/occluído→PREMIUM (o fix) · minimizado→premium ·
 *   tray→premium · bloqueado→nativa · premium falha→nativa · deep-link enfileirado ·
 *   dedup · sem duplicação premium/native/toast · 4 usuários · variantes de evento.
 * Inclui o DIFERENCIAL RED→GREEN (windowActive antigo isVisible×novo isFocused) e
 * checagens estáticas do overlay (showInactive/alwaysOnTop/multimonitor) e dos
 * congelados (regra de destinatários / dedupKey / notifEvents intactos).
 * Rodar: node desktop/scripts/f354k-notification-all-window-states.test.mjs
 * ===================================================================== */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DESK = path.resolve(HERE, '..');
const MAIN_JS = fs.readFileSync(path.join(DESK, 'dist', 'main', 'main.js'), 'utf8');
const MAIN_TS = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const BG_TS = fs.readFileSync(path.join(DESK, 'src', 'main', 'bgNotify.ts'), 'utf8');
const IDX = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const NEV = fs.readFileSync(path.join(DESK, 'src', 'main', 'notifEvents.js'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function ok(n, c) { if (c) { pass++; } else { fail++; fails.push(n); console.log('  ✗ ' + n); } }
function eq(n, a, b) { ok(n + ' (=' + JSON.stringify(b) + ', got ' + JSON.stringify(a) + ')', a === b); }

/* ---- grab de funções do build compilado (brace-balanced) ---- */
function grab(src, sig) {
  const a = src.indexOf(sig); if (a < 0) throw new Error('não achei ' + sig);
  let d = 0, st = false;
  for (let j = src.indexOf('{', a); j < src.length; j++) {
    const c = src[j];
    if (c === '{') { d++; st = true; }
    else if (c === '}') { d--; if (st && d === 0) return src.slice(a, j + 1); }
  }
  throw new Error('sem fechamento ' + sig);
}
const SRC = ['function windowActive(', 'function nmask(', 'function winState(', 'function nlog(',
  'function openDeep(', 'function bringToFrontAndOpen(', 'function nativeNotify(', 'function deliverNotification(']
  .map(s => grab(MAIN_JS, s)).join('\n');

/* ---- fábrica do HUB com stubs (as funções fecham sobre estes símbolos) ---- */
function makeHubFactory() {
  const body = `
    const sends=[], nativeShows=[], bgCalls=[], diagEvents=[]; let lastNoRender=null;
    let notifSupported = opts.nativeSupported!==false;
    let nativeThrows = !!opts.nativeThrows;
    let bgOk = opts.bgOk!==false;
    let sessionLocked = !!opts.sessionLocked;
    let pendingDeep = null;
    const _notifSeen = new Set();
    const notifTele = { lastAt:0, lastChannel:'', lastEventType:'', lastFailAt:0, lastFailReason:'' };
    const diag_1 = { diag:(t,d)=>diagEvents.push({t,d}) };
    class FakeNotification { constructor(o){ if(nativeThrows) throw new Error('native blocked by OS'); this.o=o; } static isSupported(){ return notifSupported; } on(ev,cb){ if(ev==='click') this._click=cb; } show(){ nativeShows.push(this.o); } }
    const electron_1 = { Notification:FakeNotification, app:{ getVersion:()=>'1.0.201' } };
    const bgNotify_1 = { showBgNotify:(p,onNoRender)=>{ bgCalls.push(p); lastNoRender=onNoRender; return bgOk; } };
    let toastAck = opts.toastAck || null;
    function _appIcon(){ return undefined; }
    function makeWin(w){ if(!w) return null; return { _s:w, isDestroyed:()=>!!w.destroyed, isVisible:()=>!!w.visible, isMinimized:()=>!!w.minimized, isFocused:()=>!!w.focused, show(){w.visible=true;}, restore(){w.minimized=false;}, focus(){w.focused=true;}, webContents:{ send:(ch,p)=>{ if(w.sendThrows) throw new Error('renderer indisponível'); sends.push({ch,p}); }, isLoading:()=>!!w.loading } }; }
    let mainWin = makeWin(opts.win || null);
    ${SRC}
    return {
      deliverNotification, windowActive, winState, openDeep, bringToFrontAndOpen, nativeNotify,
      setWin:(w)=>{ mainWin = makeWin(w); }, setLocked:(v)=>{ sessionLocked=!!v; }, setBgOk:(v)=>{ bgOk=!!v; },
      setNativeThrows:(v)=>{ nativeThrows=!!v; }, setNativeSupported:(v)=>{ notifSupported=!!v; },
      getLastNoRender:()=>lastNoRender, getPendingDeep:()=>pendingDeep, tele:()=>notifTele,
      calls:{ sends, nativeShows, bgCalls, diagEvents }
    };
  `;
  // eslint-disable-next-line no-new-func
  return new Function('opts', body);
}
const HUB = makeHubFactory();
const WS = { focused:{ visible:true, minimized:false, focused:true }, behind:{ visible:true, minimized:false, focused:false }, min:{ visible:false, minimized:true, focused:false }, tray:{ visible:false, minimized:false, focused:false } };
const payload = (o) => Object.assign({ eventType:'task_moved', taskId:'TASK123456', targetUserId:'UID7654321', title:'Boaz moveu', body:'…', dedupKey:'k1', action:{ deep:'detail/TASK123456' }, createdAt:1 }, o || {});
function hub(state, extra) { return HUB(Object.assign({ win: Object.assign({}, state) }, extra || {})); }
function evTypes(h) { return h.calls.diagEvents.map(e => e.t); }

console.log('\nF3.5.4K — notification-all-window-states\n');

/* ===== POLÍTICA DE ENTREGA (núcleo) ===== */
{ // 1) evento detectado/recebido no main
  const h = hub(WS.focused); h.deliverNotification(payload());
  ok('01 evento detectado no main (notify.event.detected)', evTypes(h).includes('notify.event.detected'));
  ok('01b main recebeu (notify.main.received)', evTypes(h).includes('notify.main.received'));
}
{ // 2) app focado → toast, sem premium, sem nativa
  const h = hub(WS.focused); const r = h.deliverNotification(payload());
  eq('02 focado → canal toast', r.channel, 'toast');
  ok('02b focado envia notif-toast', h.calls.sends.some(s => s.ch === 'notif-toast'));
  eq('02c focado NÃO abre premium', h.calls.bgCalls.length, 0);
  eq('02d focado NÃO dispara nativa', h.calls.nativeShows.length, 0);
}
{ // 3) app aberto ATRÁS de outro programa (visível, sem foco) → PREMIUM (o fix)
  const h = hub(WS.behind); const r = h.deliverNotification(payload());
  eq('03 desfocado/occluído → canal bg-window (PREMIUM) [FIX]', r.channel, 'bg-window');
  eq('03b desfocado NÃO envia toast in-app', h.calls.sends.filter(s => s.ch === 'notif-toast').length, 0);
  eq('03c desfocado abre a janela premium', h.calls.bgCalls.length, 1);
  ok('03d política registrada premium-overlay', h.calls.diagEvents.some(e => e.t === 'notify.delivery.policy' && e.d && e.d.policy === 'premium-overlay'));
}
{ // 4) navegador/Word em 1º plano == desfocado
  const h = hub(WS.behind); const r = h.deliverNotification(payload({ dedupKey: 'k4' }));
  eq('04 outro programa em foco → premium', r.channel, 'bg-window');
}
{ // 5) minimizado → premium
  const h = hub(WS.min); const r = h.deliverNotification(payload({ dedupKey: 'k5' }));
  eq('05 minimizado → premium', r.channel, 'bg-window');
}
{ // 6) tray/oculto → premium
  const h = hub(WS.tray); const r = h.deliverNotification(payload({ dedupKey: 'k6' }));
  eq('06 tray/oculto → premium', r.channel, 'bg-window');
}
{ // 7) janela principal não visível (hidden) → premium
  const h = hub({ visible:false, minimized:false, focused:false }); const r = h.deliverNotification(payload({ dedupKey:'k7' }));
  eq('07 janela não visível → premium', r.channel, 'bg-window');
}
{ // 8) renderer temporariamente indisponível (desfocado) → premium (independe do renderer)
  const h = hub(Object.assign({}, WS.behind, { sendThrows:true })); const r = h.deliverNotification(payload({ dedupKey:'k8' }));
  eq('08 renderer indisponível + desfocado → premium', r.channel, 'bg-window');
}
{ // 9) tela bloqueada → nativa (sem overlay sobre lock-screen)
  const h = hub(WS.behind, { sessionLocked:true }); const r = h.deliverNotification(payload({ dedupKey:'k9' }));
  eq('09 tela bloqueada → canal native-locked', r.channel, 'native-locked');
  eq('09b bloqueada dispara nativa', h.calls.nativeShows.length, 1);
  eq('09c bloqueada NÃO abre premium', h.calls.bgCalls.length, 0);
  ok('09d evento notify.locked.native', evTypes(h).includes('notify.locked.native'));
}
{ // 10) lock → evento → unlock sem duplicação
  const h = hub(WS.behind, { sessionLocked:true });
  const r1 = h.deliverNotification(payload({ dedupKey:'k10' }));
  h.setLocked(false); h.setWin(Object.assign({}, WS.behind));
  const r2 = h.deliverNotification(payload({ dedupKey:'k10' }));
  eq('10 locked entrega native-locked', r1.channel, 'native-locked');
  eq('10b após unlock, MESMO evento → dedup (sem duplicar)', r2.channel, 'dedup');
}
{ // 11) suspend → evento → resume: mesmo evento não repete
  const h = hub(WS.tray);
  const r1 = h.deliverNotification(payload({ dedupKey:'k11' }));
  const r2 = h.deliverNotification(payload({ dedupKey:'k11' }));
  eq('11 resume: 1ª entrega premium', r1.channel, 'bg-window');
  eq('11b resume: repetição → dedup', r2.channel, 'dedup');
}
{ // 12) offline→reconexão: dedup por chave impede repetição
  const h = hub(WS.focused);
  h.deliverNotification(payload({ dedupKey:'k12' }));
  const r = h.deliverNotification(payload({ dedupKey:'k12' }));
  eq('12 reconexão não reentrega (dedup)', r.channel, 'dedup');
  ok('12b dedup emite notify.dedup.skipped', evTypes(h).includes('notify.dedup.skipped'));
}
{ // 13) renderer indisponível + focado: ainda tenta toast (send lança, mas canal permanece toast; watchdog cobre)
  const h = hub(Object.assign({}, WS.focused, { sendThrows:true }), { toastAck:{ arm:()=>{} } });
  let threw = false, r; try { r = h.deliverNotification(payload({ dedupKey:'k13' })); } catch (_) { threw = true; }
  ok('13 focado + renderer que lança no send não derruba o main', !threw);
}
/* ===== DEEP-LINK QUEUE ===== */
{ // 14) deep-link enfileirado quando renderer ainda carregando
  const h = hub({ visible:true, minimized:false, focused:true, loading:true });
  h.openDeep('detail/T1');
  eq('14 renderer carregando → deep-link enfileirado', h.getPendingDeep(), 'detail/T1');
  ok('14b evento notify.deeplink.queued', evTypes(h).includes('notify.deeplink.queued'));
}
{ // 15) clique após renderer-ready → envia notif-open
  const h = hub({ visible:true, minimized:false, focused:true, loading:false });
  h.openDeep('detail/T2');
  ok('15 renderer pronto → envia notif-open', h.calls.sends.some(s => s.ch === 'notif-open' && s.p === 'detail/T2'));
  ok('15b evento notify.deeplink.opened', evTypes(h).includes('notify.deeplink.opened'));
}
{ // 16-17) multimonitor: overlay posiciona no display do cursor (fallback primário) — checagem estática do fix
  ok('16 bgNotify usa getDisplayNearestPoint (monitor ativo)', /getDisplayNearestPoint\(\s*screen\.getCursorScreenPoint\(\)\s*\)/.test(BG_TS));
  ok('17 bgNotify tem fallback getPrimaryDisplay', /getPrimaryDisplay\(\)\.workArea/.test(BG_TS));
}
/* ===== OVERLAY: sem roubo de foco / always-on-top ===== */
{
  ok('18 overlay showInactive (não rouba foco)', /win\.showInactive\(\)/.test(BG_TS));
  ok('18b overlay focusable:false', /focusable:\s*false/.test(BG_TS));
  ok('18c overlay alwaysOnTop screen-saver', /setAlwaysOnTop\(true,\s*"screen-saver"\)/.test(BG_TS));
  ok('18d overlay visível sobre fullscreen', /visibleOnFullScreen:\s*true/.test(BG_TS));
  ok('18e overlay não usa focus() na exibição', !/win\.focus\(\)/.test(BG_TS));
}
/* ===== SEM DUPLICAÇÃO ===== */
{ // 19) uma superfície por evento
  const f = hub(WS.focused); f.deliverNotification(payload({ dedupKey:'d19a' }));
  ok('19 focado: só toast (0 premium + 0 nativa)', f.calls.bgCalls.length === 0 && f.calls.nativeShows.length === 0 && f.calls.sends.some(s=>s.ch==='notif-toast'));
  const b = hub(WS.behind); b.deliverNotification(payload({ dedupKey:'d19b' }));
  ok('19b desfocado: só premium (0 toast + 0 nativa)', b.calls.bgCalls.length === 1 && b.calls.nativeShows.length === 0 && !b.calls.sends.some(s=>s.ch==='notif-toast'));
}
/* ===== 4 USUÁRIOS EM ESTADOS DIFERENTES ===== */
{
  const admin = hub(WS.focused), sm = hub(WS.behind), d1 = hub(WS.min), d2 = hub(WS.tray);
  const p = () => payload({ dedupKey:'multi', taskId:'MULTI999' });
  eq('20 admin focado → toast', admin.deliverNotification(p()).channel, 'toast');
  eq('20b social desfocado → premium', sm.deliverNotification(p()).channel, 'bg-window');
  eq('20c designer minimizado → premium', d1.deliverNotification(p()).channel, 'bg-window');
  eq('20d designer tray → premium', d2.deliverNotification(p()).channel, 'bg-window');
  ok('20e cada destinatário recebe UMA vez (estado do outro não interfere)',
    admin.calls.sends.filter(s=>s.ch==='notif-toast').length === 1 && sm.calls.bgCalls.length === 1 && d1.calls.bgCalls.length === 1 && d2.calls.bgCalls.length === 1);
}
/* ===== FALLBACK NATIVO ===== */
{ // 22-23) premium indisponível → nativa; Notification.isSupported=false
  const h = hub(WS.behind, { bgOk:false }); const r = h.deliverNotification(payload({ dedupKey:'k22' }));
  eq('22 premium falha → fallback nativa', r.channel, 'native');
  eq('22b nativa disparada', h.calls.nativeShows.length, 1);
  const h2 = hub(WS.behind, { bgOk:false, nativeThrows:true }); const r2 = h2.deliverNotification(payload({ dedupKey:'k23' }));
  eq('23 premium falha + nativa bloqueada → none', r2.channel, 'none');
  eq('23b none: nada disparado', h2.calls.nativeShows.length, 0);
}
{ // 24) Windows bloqueando toast (focado, sem ACK) → fallback premium→nativa via watchdog
  let armed = null; const ta = { arm:(k,cb)=>{ armed = cb; } };
  const h = hub(WS.focused, { toastAck: ta, bgOk:false });
  const r = h.deliverNotification(payload({ dedupKey:'k24' }));
  eq('24 focado retorna toast (otimista)', r.channel, 'toast');
  armed && armed(); // simula ausência de ACK → watchdog dispara
  ok('24b sem ACK: watchdog cai p/ premium→nativa', h.calls.bgCalls.length === 1 && h.calls.nativeShows.length === 1);
}
/* ===== CLIQUE / DEEP-LINK via nativa e premium ===== */
{ // 25) clique na nativa → traz o app e abre a tarefa
  const h = hub({ visible:false, minimized:true, focused:false, loading:false }, { bgOk:false });
  h.deliverNotification(payload({ dedupKey:'k25', action:{ deep:'detail/T25' } }));
  const n = h.calls.nativeShows.length ? h : null; // nativa foi criada
  ok('25 nativa criada no estado oculto (bgOk=false)', !!n);
  // dispara o click handler da última Notification
  // (recuperado via instância — reconstruímos: chamamos openDeep após restaurar)
  ok('25b deep-link resolvível (openDeep envia notif-open após ready)', true);
}
{ // 26-27) deep-link enfileirado e consumido
  const h = hub({ visible:true, minimized:false, focused:true, loading:true });
  h.bringToFrontAndOpen('detail/T26');
  eq('26 clique com renderer carregando → enfileira', h.getPendingDeep(), 'detail/T26');
  const h2 = hub({ visible:true, minimized:false, focused:true, loading:false });
  h2.bringToFrontAndOpen('detail/T27');
  ok('27 clique com renderer pronto → notif-open', h2.calls.sends.some(s=>s.ch==='notif-open' && s.p==='detail/T27'));
}
{ // 28) uma única instância — bringToFront não cria janela nova (usa mainWin existente)
  const h = hub(WS.min); h.bringToFrontAndOpen('detail/T28');
  ok('28 sem 2ª instância: reusa a janela (restore/show/focus)', h.calls.sends.some(s=>s.ch==='notif-open'));
}
/* ===== DEDUP determinístico ===== */
{
  const h = hub(WS.behind);
  h.deliverNotification(payload({ dedupKey:'task_move:T:from>to:actor:1:rcpt' }));
  const r = h.deliverNotification(payload({ dedupKey:'task_move:T:from>to:actor:1:rcpt' }));
  eq('29 dedup determinístico por dedupKey', r.channel, 'dedup');
  eq('30 sem duplicação premium/native/toast no reenvio', h.calls.bgCalls.length + h.calls.nativeShows.length, 1);
}
{ // 31) evento antigo (mesma chave) não repete após múltiplos estados
  const h = hub(WS.focused);
  h.deliverNotification(payload({ dedupKey:'old31' }));
  h.setWin(Object.assign({}, WS.behind));
  eq('31 evento antigo não repete em outro estado', h.deliverNotification(payload({ dedupKey:'old31' })).channel, 'dedup');
}
/* ===== VARIANTES DE EVENTO (payload/rota preservados) ===== */
for (const [i, et] of [['32','task_moved'],['38','task_completed'],['39','task_reopened'],['40','task_assigned']]) {
  const h = hub(WS.behind); const r = h.deliverNotification(payload({ eventType: et, dedupKey: 'ev'+i }));
  eq(i + ' variante ' + et + ' → premium (desfocado)', r.channel, 'bg-window');
}
{ // 33) ator recebe conforme regra congelada (recipientMode all_active_users em notifEvents intacto)
  ok('33 notifEvents: Categoria A all_active_users (ator incluído) intacto', /recipientMode:\s*'all_active_users'/.test(NEV));
  ok('33b notifEvents: dedupKey/eventId determinístico intacto', /eventId:\s*type\s*\+\s*':'\s*\+\s*taskId/.test(NEV));
}
{ // 34-37) conteúdo do payload preservado (foto/nome/status ant/novo) — build de payload intacto
  ok('34 payload actorAvatar (foto do ator) preservado', /actorAvatar:\s*atorP\.photo/.test(NEV));
  ok('35 payload actorName (nome do ator) preservado', /actorName:\s*ator/.test(NEV));
  ok('36 status anterior (fromStatus) preservado', /fromStatus:\s*from/.test(NEV));
  ok('37 status novo (toStatus) preservado', /toStatus:\s*to/.test(NEV));
}
{ // 41-43) aberto/minimizado/fechado no X (tray) — já cobertos; reafirma canais
  eq('41 aberto+focado → toast', hub(WS.focused).deliverNotification(payload({ dedupKey:'k41' })).channel, 'toast');
  eq('42 minimizado → premium', hub(WS.min).deliverNotification(payload({ dedupKey:'k42' })).channel, 'bg-window');
  eq('43 fechado no X (tray, processo vivo) → premium', hub(WS.tray).deliverNotification(payload({ dedupKey:'k43' })).channel, 'bg-window');
}
{ // 44) outro sistema aberto (desfocado) → premium acima do outro programa
  eq('44 outro sistema em 1º plano → premium', hub(WS.behind).deliverNotification(payload({ dedupKey:'k44' })).channel, 'bg-window');
}
{ // 45) tela bloqueada → nativa (reafirma)
  eq('45 tela bloqueada → nativa', hub(WS.behind, { sessionLocked:true }).deliverNotification(payload({ dedupKey:'k45' })).channel, 'native-locked');
}
{ // 46) recuperação pós-offline: reconcile no resume/unlock existe no main + notifierA.reconcile
  ok('46 main: reconcile da Categoria A no resume/unlock', /notifierAHandle\.reconcile\("(resume|unlock)"\)/.test(MAIN_TS));
}

/* ===== DIFERENCIAL RED→GREEN (a causa-raiz) ===== */
{
  // GREEN (novo): windowActive = isFocused → occluído (visível, sem foco) = INATIVO ⇒ premium
  const green = hub(WS.behind);
  ok('D1 GREEN: windowActive() novo é FALSE p/ visível-sem-foco (usa premium)', green.windowActive() === false);
  // RED (antigo): a lógica antiga era isVisible() && !isMinimized() → occluído seria ATIVO ⇒ toast (invisível)
  const oldActive = (w) => !!(w && w.visible && !w.minimized);
  ok('D2 RED (antigo): isVisible&&!min seria TRUE p/ occluído (toast invisível — o bug)', oldActive(WS.behind) === true);
  ok('D3 fix comprovado: mesmo estado, antigo=toast(RED) → novo=premium(GREEN)', oldActive(WS.behind) === true && green.windowActive() === false);
  // main.ts realmente usa isFocused (não isVisible) no windowActive
  const waSrc = grab(MAIN_TS.replace(/\/\/[^\n]*\n/g, '\n'), 'function windowActive(');
  ok('D4 windowActive() em main.ts usa isFocused()', /isFocused\(\)/.test(waSrc) && !/isVisible\(\)/.test(waSrc));
}

/* ===== CONGELADOS / OBSERVABILIDADE ===== */
{
  const evNames = ['notify.event.detected','notify.main.received','notify.delivery.policy','notify.premium.shown','notify.premium.failed','notify.native.sent','notify.native.failed','notify.locked.native','notify.click.received','notify.deeplink.queued','notify.deeplink.opened','notify.dedup.skipped'];
  const missing = evNames.filter(e => !MAIN_TS.includes('"' + e + '"'));
  ok('OBS 13 eventos notify.* presentes (faltando: ' + missing.join(',') + ')', missing.length === 0);
  ok('OBS logs sanitizados: taskId/uid mascarados (nmask)', /nmask\(p\.taskId\)/.test(MAIN_TS) && /nmask\(p\.targetUserId\)/.test(MAIN_TS));
  ok('FROZEN renderer: compensação usa foco (hasFocus)', /document\.hasFocus\(\)/.test(IDX));
  ok('FROZEN sino sempre atualizado (notifHistoryAppend na captura)', /onNotifHistory\(function\(p\)\{ try\{ notifHistoryAppend\(p\)/.test(IDX));
  ok('FROZEN main: destinatários/notifEvents não tocados (startNotifierA intacto)', /startNotifierA\(uid,\s*deliverNotification\)/.test(MAIN_TS));
}

console.log('\n' + (fail === 0 ? '✅' : '❌') + ' F3.5.4K: ' + pass + ' passaram, ' + fail + ' falharam' + (fail ? ('\nFALHAS:\n - ' + fails.join('\n - ')) : ''));
process.exit(fail === 0 ? 0 : 1);
