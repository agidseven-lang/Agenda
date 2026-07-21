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
export function extractDeliver(MAIN) {
  const realWA = fnSrc(MAIN, 'windowActive').replace('function windowActive(): boolean {', 'function windowActive() {');
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
      restore: () => winCalls.push('restore'),
      show: () => winCalls.push('show'),
      focus: () => winCalls.push('focus'),
      webContents: { send: (ch, arg) => sent.push(arg !== undefined ? [ch, arg] : ch) },
    });
    const mainWin = mkWin();
    const NotificationMock = function (o) { this._o = o; };
    NotificationMock.prototype.on = function (ev, cb) { if (ev === 'click') nativeClickCb = cb; };
    NotificationMock.prototype.show = function () { winCalls.push('native.show'); };
    NotificationMock.isSupported = () => true;
    const run = new Function('mainWin', '_notifSeen', 'diag', '_appIcon', 'showBgNotify', 'Notification', 'String', '__P',
      realWA + '\n' + realDeliver + '\n return deliverNotification(__P);');
    const out = run(mainWin, seen, () => {}, () => undefined, (p) => { bg.push(p); return bgOk; }, NotificationMock, String, payload);
    return { res: out, sent, bg, winCalls, fireNativeClick: () => { if (nativeClickCb) nativeClickCb(); }, hadNativeClick: () => !!nativeClickCb };
  }
  return { deliver };
}
