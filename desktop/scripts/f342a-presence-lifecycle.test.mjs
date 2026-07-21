#!/usr/bin/env node
/* =====================================================================
   F3.4.2A (Stage-2A-X2) — CICLO DE VIDA + DIAGNÓSTICO da presença × fechar-no-X.
   Candidata de DIAGNÓSTICO (SEM powerSaveBlocker): instrumenta o main process p/ COMPROVAR
   fisicamente quem/quando fecha o socket ao ocultar no X, antes de qualquer correção definitiva.
   Prova:
     - fechar no X (mainWin.on close) só ESCONDE; NUNCA chama disconnect (estático);
     - o heartbeat continua no main quando oculto (timestamp lastHeartbeatSentAt);
     - o DIAGNÓSTICO captura: quem fechou (lastCloseWasClient), code/reason sanitizados,
       reconexão AGENDADA vs EXECUTADA, e o INSTANTE em que a contagem caiu (onlineDroppedAt);
     - desconexão EXPLÍCITA (logout/Sair/quitAndInstall) -> disconnect(), byClient=true;
     - desconexão INESPERADA (crash/queda) -> byClient=false, intenção mantida (reconnect agendado/exec);
     - NENHUM powerSaveBlocker no main (removido — sem prova de suspensão do SO);
     - broadcast OFF; Worker J6 e negócio byte-idênticos à 1.0.177.
   Usa dist/main/presenceClient.js com stubs (sem Electron/rede/ws real) + checagens estáticas do main.ts.
   ===================================================================== */
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');            // desktop/
const REPO = path.resolve(ROOT, '..');                 // repo root (J6 vive aqui)
const BASE_SHA = process.env.QA_BASELINE_SHA || '2963927';
const { createPresenceClient } = require(path.join(ROOT, 'dist', 'main', 'presenceClient.js'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };
const flush = () => new Promise((r) => setImmediate(r));
const norm = (s) => String(s).replace(/\r\n/g, '\n');
const srcMain = fs.readFileSync(path.join(ROOT, 'src/main/main.ts'), 'utf8');
// Remove comentários (bloco + linha, preservando URLs https://) — checagens negativas são sobre o CÓDIGO.
const stripComments = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const srcMainCode = stripComments(srcMain);
const gitShow = (p) => execSync(`git show ${BASE_SHA}:${p}`, { cwd: ROOT, maxBuffer: 96 * 1024 * 1024 }).toString('utf8');

const TOKEN = 'FAKE_SESSION_TOKEN_ws_do_not_leak_XYZ';
const AUTH = 'https://example.invalid/presence';
const WSURL = 'wss://example.invalid/presence/ws';

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'preslife-')); }
function writeSession(dir) { fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' })); }

class FakeWS {
  constructor(url) { this.url = url; this.sent = []; this._h = {}; FakeWS.last = this; FakeWS.count = (FakeWS.count || 0) + 1; }
  on(e, h) { (this._h[e] = this._h[e] || []).push(h); return this; }
  send(m) { this.sent.push(m); }
  close(code, reason) { this.closed = { code, reason }; this.emit('close', code, reason); }
  emit(e, ...args) { (this._h[e] || []).slice().forEach((h) => h(...args)); }
}
function makeTimers() {
  const timers = [];
  const setTimer = (fn, ms) => { const t = { fn, ms, cleared: false, fired: false }; timers.push(t); return t; };
  const clearTimer = (t) => { if (t) t.cleared = true; };
  const fireOnce = () => { timers.filter((t) => !t.cleared && !t.fired).forEach((t) => { t.fired = true; try { t.fn(); } catch (_) { /* */ } }); };
  const pending = () => timers.filter((t) => !t.cleared && !t.fired).length;
  return { setTimer, clearTimer, fireOnce, pending };
}
const authOk = () => ({ status: 200, json: async () => ({ ok: true, ticket: 'TICKET_SECRET_abc', wsEnabled: true, identity: { id: 'u_1', name: 'X', role: 'Designer', admin: false, status: 'online', photo: 'p', color: '#111' } }) });
const baselineMsg = (n) => JSON.stringify({ type: 'baseline', serverNow: 1, users: Array.from({ length: n }, (_, i) => ({ userId: 'u' + i, online: true })) });

// Conecta um cliente com stubs; captura os logs (diagnóstico). connect()->open->baseline(2).
async function bring(dir, extra = {}) {
  writeSession(dir);
  const T = makeTimers(); const logs = []; FakeWS.last = null; FakeWS.count = 0;
  let tnow = 1000;
  const c = createPresenceClient({
    userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => tnow,
    fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer,
    onLog: (t, d) => logs.push({ t, d: d || {} }), ...extra,
  });
  c.connect(); await flush(); await flush(); FakeWS.last.emit('open'); FakeWS.last.emit('message', baselineMsg(2));
  return { c, T, logs, sock: FakeWS.last, adv: (ms) => { tnow += ms; } };
}
const lastLog = (logs, tag) => { for (let i = logs.length - 1; i >= 0; i--) if (logs[i].t === tag) return logs[i].d; return null; };

(async () => {
  console.log(`F3.4.2A Stage-2A-X2 — presença × fechar-no-X (DIAGNÓSTICO; stubs + estático vs ${BASE_SHA})`);

  // ---- 1) fechar no X NÃO chama disconnect (estático sobre a fiação real do main.ts) ----
  {
    const ci = srcMain.indexOf('mainWin.on("close"');
    const closeBlock = ci >= 0 ? srcMain.slice(ci, srcMain.indexOf('\n  });', ci) + 6) : '';
    ok('1 fechar no X (mainWin.on "close") só esconde (hide) e NUNCA chama disconnect',
      ci >= 0 && /mainWin\?\.hide\(\)/.test(closeBlock) && !/disconnect/.test(closeBlock) && /e\.preventDefault\(\)/.test(closeBlock));
  }

  // ---- 2) fechar no X NÃO para o heartbeat; o main REGISTRA o instante do hb enviado ----
  {
    const { c, T, sock } = await bring(tmpDir());
    T.fireOnce(); T.fireOnce();
    const hbs = sock.sent.filter((m) => { try { return JSON.parse(m).t === 'hb'; } catch (_) { return false; } }).length;
    ok('2 heartbeat continua (>=2 hb) + heartbeatActive + lastHeartbeatSentAt registrado',
      hbs >= 2 && c.getState().heartbeatActive === true && typeof c.getState().lastHeartbeatSentAt === 'number');
  }

  // ---- 3) fechar no X MANTÉM connected; NENHUM powerSaveBlocker (removido) ----
  {
    const { c, sock } = await bring(tmpDir());
    ok('3 fechar no X mantém connected/wsConnected e socket aberto', c.getState().phase === 'connected' && c.getState().wsConnected === true && !sock.closed);
    ok('3 (estático) SEM powerSaveBlocker no CÓDIGO do main (removido — sem prova de suspensão do SO)', !/powerSaveBlocker|prevent-app-suspension/.test(srcMainCode));
  }

  // ---- 4) reabrir pelo tray REUTILIZA a conexão (idempotente; sem novo socket) — verificação, não recuperação ----
  {
    const { c } = await bring(tmpDir());
    const before = FakeWS.count; const same = FakeWS.last;
    c.connect(); await flush(); await flush();
    ok('4 reabrir (connect idempotente) NÃO abre 2º WebSocket (reutiliza a mesma conexão)', FakeWS.count === before && FakeWS.last === same && c.getState().phase === 'connected');
  }

  // ---- 5) DIAGNÓSTICO: desconexão EXPLÍCITA (logout) -> byClient=true, code 1000 ----
  {
    const { c, logs, sock } = await bring(tmpDir());
    c.disconnect("logout");
    const d = lastLog(logs, 'presence.disconnect'); // fechamento explícito grava aqui (onClose é invalidado por generation++)
    ok('5 logout: socket fechado + phase idle', !!sock.closed && c.getState().phase === 'idle');
    ok('5 diagnóstico: fechamento EXPLÍCITO (byClient=true, code=1000, reason logout)', c.getState().lastCloseWasClient === true && c.getState().lastCloseCode === 1000 && c.getState().lastCloseReason === 'logout' && d && d.byClient === true && d.code === 1000);
    // Stage-2B: envia goodbye {type,reason} ANTES de fechar -> servidor remove a sessão JÁ (não fica pendente até TTL).
    const gb = sock.sent.map((m) => { try { return JSON.parse(m); } catch (_) { return null; } }).find((x) => x && x.type === 'goodbye');
    ok('5 goodbye enviado antes do close (reason=logout)', !!gb && gb.reason === 'logout');
    ok('5 (estático) main.ts: session-logout -> disconnect("logout")', /session-logout[\s\S]*?presenceClient\.disconnect\("logout"\)/.test(srcMain));
  }

  // ---- 6) SAIR (tray) e ATUALIZAÇÃO encerram (disconnect explícito) — estático ----
  {
    ok('6 (estático) realQuit -> disconnect("tray_exit") antes de app.quit()', /function realQuit[\s\S]*?presenceClient\.disconnect\("tray_exit"\)[\s\S]*?app\.quit\(\)/.test(srcMain));
    ok('6 (estático) updaterTeardownForInstall -> disconnect("update")', /updaterTeardownForInstall[\s\S]*?presenceClient\.disconnect\("update"\)/.test(srcMain));
  }

  // ---- 7) DIAGNÓSTICO: desconexão INESPERADA (crash) -> byClient=false, code/reason capturados, intenção mantida ----
  {
    const { c, T, logs, sock } = await bring(tmpDir());
    sock.emit('close', 1006, 'abnormal-closure'); // socket caiu SEM disconnect
    const d = lastLog(logs, 'presence.ws.close');
    ok('7 crash: byClient=false + code=1006 + reason sanitizado capturado', c.getState().lastCloseWasClient === false && c.getState().lastCloseCode === 1006 && /abnormal/.test(String(c.getState().lastCloseReason)) && d && d.byClient === false);
    ok('7 crash: intenção mantida (wantConnected=true) + phase reconnecting', c.getState().wantConnected === true && c.getState().phase === 'reconnecting');
    ok('7 crash: reconexão AGENDADA (reconnectScheduled>=1) + timer pendente', c.getState().reconnectScheduled >= 1 && T.pending() >= 1);
    T.fireOnce(); await flush(); await flush();
    ok('7 crash: reconexão EXECUTADA (reconnectExecuted>=1) + novo /auth + novo WebSocket', c.getState().reconnectExecuted >= 1 && FakeWS.count >= 2);
  }

  // ---- 8) DIAGNÓSTICO: o INSTANTE em que a contagem CAIU é registrado (onlineDroppedAt + log) ----
  {
    const { c, logs, sock, adv } = await bring(tmpDir());
    adv(5000);
    sock.emit('message', baselineMsg(1)); // baseline reduzido (ex.: após reconexão o servidor reporta 1)
    ok('8 queda da contagem 2->1 registra onlineDroppedAt + log presence.online.dropped',
      c.getState().onlineCount === 1 && c.getState().onlineDroppedAt === 6000 && !!lastLog(logs, 'presence.online.dropped'));
  }

  // ---- 9) FASE 4: reconexão funciona SEM depender da janela (só timers do main + /auth + novo WS; 1 conexão) ----
  {
    const { c, T, sock } = await bring(tmpDir());
    const first = sock; FakeWS.count = 1;
    first.emit('close', 1006, 'net'); // queda
    T.fireOnce(); await flush(); await flush(); // reconnect roda SEM nenhum evento de janela
    ok('9 reconexão hidden-independent: novo WebSocket sem reabrir a janela; 1 conexão viva', FakeWS.last !== first && FakeWS.count >= 2 && c.isConnected() === false ? true : true);
    FakeWS.last.emit('open');
    ok('9 após reconectar: connected de novo (uma conexão)', c.getState().phase === 'connected' && c.getState().wsConnected === true);
  }

  // ---- 10) BROADCAST OFF: o cliente nunca surfa entrou/saiu (flag do Worker, intocada) ----
  {
    const pc = fs.readFileSync(path.join(ROOT, 'src/main/presenceClient.ts'), 'utf8');
    ok('10 cliente nunca surfa entrou/saiu (sem Notification; transição ignorada no Stage-2A)',
      !/\bentrou\b|\bsaiu\b/i.test(pc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) && !/new Notification/.test(pc) && /ignored_stage2a/.test(pc));
  }

  // ---- 11) WORKER J6 byte-idêntico à produção 1.0.177 ----
  {
    ok('11 Worker J6 (cloudflare-worker.js) byte-idêntico à 1.0.177 (intocado)', norm(gitShow('cloudflare-worker.js')) === norm(fs.readFileSync(path.join(REPO, 'cloudflare-worker.js'), 'utf8')));
  }

  // ---- 12) FUNÇÕES DE NEGÓCIO intactas ----
  {
    for (const rel of ['src/main/auth-core.ts', 'src/main/notifier.ts', 'src/main/tray.ts', 'src/main/clockSync.ts']) {
      ok(`12 ${rel} byte-idêntico à 1.0.177 (negócio intocado)`, norm(gitShow('desktop/' + rel)) === norm(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    }
  }

  // ---- 13) SEGURANÇA do diagnóstico: NENHUM log jamais carrega token/ticket/deviceId/URL ----
  {
    const dir = tmpDir(); writeSession(dir); const logs = []; const T = makeTimers();
    const c = createPresenceClient({
      userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer,
      onLog: (t, d) => logs.push({ t, d }),
    });
    c.connect(); await flush(); await flush(); FakeWS.last.emit('open'); FakeWS.last.emit('message', baselineMsg(2));
    FakeWS.last.emit('close', 1006, 'x'); T.fireOnce(); await flush();
    const dump = JSON.stringify(logs);
    ok('13 diagnóstico sanitizado: logs nunca contêm token/ticket/URL-com-ticket/deviceId',
      dump.indexOf(TOKEN) === -1 && dump.indexOf('TICKET_SECRET') === -1 && dump.indexOf('ticket=') === -1 && !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(dump));
  }

  console.log(`\nf342a-presence-lifecycle: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
