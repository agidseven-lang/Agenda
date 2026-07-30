/* =====================================================================================
 * F3.4.3 — harness compartilhado: extrai o ROTEAMENTO REAL de deliverNotification (main.ts)
 * para teste unitário SEM Electron. Prova o canal (visível→toast · minimizado/oculto→bg-window;
 * nativa = fallback) e o handler de CLIQUE (restore+show+focus+notif-open) do PRÓPRIO main.ts.
 * ===================================================================================== */
export function fnSrc(src, n) {
  const a = src.indexOf('function ' + n + '('); if (a < 0) throw new Error('fn ' + n);
  let d = 0; for (let j = src.indexOf('{', a); j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(a, j + 1); } }
  throw new Error('sem fim: ' + n);
}

/* Constrói um executor do deliverNotification REAL. Retorna deliver(winState, payload, opts):
 *  - winState: 'visible' | 'minimized' | 'hidden'
 *  - opts.bgOk: showBgNotify retorna isso (default true). false força o fallback NATIVO.
 *  - resultado: { res:{ok,channel}, sent:[canais webContents.send], bg:[payloads bg], nativeClick(fn) } */
export function stripTypes(s) {
  return s
    .replace(/function windowActive\(\): boolean \{/, 'function windowActive() {')
    .replace(/function nmask\(s: unknown\): string \{/, 'function nmask(s) {')
    .replace(/function winState\(\): \{[^}]*\} \{/, 'function winState() {')
    .replace(/function nlog\(event: string, extra\?: Record<string, unknown>\): void \{/, 'function nlog(event, extra) {')
    .replace(/function openDeep\(deep: string\): void \{/, 'function openDeep(deep) {')
    .replace(/function bringToFrontAndOpen\(deep: string\): void \{/, 'function bringToFrontAndOpen(deep) {')
    .replace(/function nativeNotify\(p: NotifPayload, key: string, deep: string\): boolean \{/, 'function nativeNotify(p, key, deep) {')
    .replace(/ as any/g, '').replace(/ as const/g, '');
}
export function extractDeliver(MAIN) {
  // F3.5.4K — o harness passa a extrair TAMBÉM os auxiliares nlog/nmask/winState/openDeep/
  // bringToFrontAndOpen (referenciados pelo deliverNotification/nativeNotify reais) + vars de módulo
  // (sessionLocked/pendingDeep/notifTele). "visible" mapeia p/ FOCADO (janela em 1º plano) — a
  // semântica histórica do harness (visible→toast) permanece válida com a nova regra por foco.
  const realWA = stripTypes(fnSrc(MAIN, 'windowActive'));
  // nmask/winState/nlog são observabilidade PURA (não afetam canal/clique) e o winState real tem
  // return-type objeto que confunde o grabber — então entram como STUBS; o núcleo (windowActive/
  // openDeep/bringToFrontAndOpen/nativeNotify/deliverNotification) é o REAL do main.ts.
  const realOpenDeep = stripTypes(fnSrc(MAIN, 'openDeep'));
  const realBring = stripTypes(fnSrc(MAIN, 'bringToFrontAndOpen'));
  // F3.4.7 — a nativa foi extraída p/ o helper nativeNotify (usada como fallback imediato E tardio/no-ACK).
  // O harness executa o helper REAL (mesma prova de canal/clique), agora fora do corpo do deliver.
  const realNative = stripTypes(fnSrc(MAIN, 'nativeNotify'));
  const start = MAIN.indexOf('function deliverNotification(');
  const retClose = MAIN.indexOf('channel: string }', start) + 'channel: string }'.length;
  const bodyBrace = MAIN.indexOf('{', retClose);
  let d = 0, end = -1; for (let j = bodyBrace; j < MAIN.length; j++) { const c = MAIN[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j; break; } } }
  const realDeliver = 'function deliverNotification(p) ' + MAIN.slice(bodyBrace, end + 1).replace(/ as any/g, '').replace(/ as const/g, '');
  const seen = new Set(); // dedup do HUB (_notifSeen) persistente entre chamadas do MESMO executor

  function deliver(winState, payload, opts) {
    opts = opts || {};
    const bgOk = (opts.bgOk !== false);
    const sent = [], bg = [], winCalls = [];
    let nativeClickCb = null;
    const mkWin = () => ({
      isDestroyed: () => false,
      isVisible: () => winState !== 'hidden',
      isMinimized: () => winState === 'minimized',
      // F3.5.4K — 'visible' == janela FOCADA (1º plano): preserva a semântica histórica do harness
      // (visible→toast) sob a nova regra por FOCO. 'minimized'/'hidden' não são focados ⇒ premium.
      isFocused: () => winState === 'visible',
      restore: () => winCalls.push('restore'),
      show: () => winCalls.push('show'),
      focus: () => winCalls.push('focus'),
      webContents: { send: (ch, arg) => sent.push(arg !== undefined ? [ch, arg] : ch), isLoading: () => false },
    });
    const mainWin = mkWin();
    const NotificationMock = function (o) { this._o = o; };
    NotificationMock.prototype.on = function (ev, cb) { if (ev === 'click') nativeClickCb = cb; };
    NotificationMock.prototype.show = function () { winCalls.push('native.show'); };
    NotificationMock.isSupported = () => true;
    const stubs = 'let pendingDeep=null; const notifTele={lastAt:0,lastChannel:"",lastEventType:"",lastFailAt:0,lastFailReason:""};\n'
      + 'function nmask(s){return String(s==null?"":s);}\n'
      + 'function winState(){var w=mainWin,al=!!(w&&!w.isDestroyed());var vis=al&&w.isVisible(),mi=al&&w.isMinimized(),fo=al&&w.isFocused();return{focused:fo,visible:vis,minimized:mi,tray:al?(!vis&&!mi):false};}\n'
      + 'function nlog(){}\n';
    const body = stubs + realWA + '\n' + realOpenDeep + '\n' + realBring + '\n' + realNative + '\n' + realDeliver + '\n return deliverNotification(__P);';
    const run = new Function('mainWin', '_notifSeen', 'diag', '_appIcon', 'showBgNotify', 'Notification', 'String', 'app', 'sessionLocked', '__P', body);
    // showBgNotify(p, onNoRender): bgOk=true ⇒ card exibido/renderizado (ACK chega — sem fallback);
    // bgOk=false ⇒ janela indisponível ⇒ fallback nativo imediato (o onNoRender do no-ACK não roda
    // neste harness síncrono, pois o ACK é assíncrono na prática — cobrimos o no-ACK na suíte F3.4.7).
    const out = run(mainWin, seen, () => {}, () => undefined, (p) => { bg.push(p); return bgOk; }, NotificationMock, String, { getVersion: () => '1.0.201' }, !!opts.sessionLocked, payload);
    return { res: out, sent, bg, winCalls, fireNativeClick: () => { if (nativeClickCb) nativeClickCb(); }, hadNativeClick: () => !!nativeClickCb };
  }
  return { deliver };
}
