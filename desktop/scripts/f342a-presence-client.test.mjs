#!/usr/bin/env node
/* =====================================================================
   F3.4.2A (Stage-2A) — CLIENTE WEBSOCKET DE PRESENÇA (proteção técnica).
   Testa dist/main/presenceClient.js SEM Electron, SEM rede real, SEM ws real:
   injeta userDataDir (temp), fetchImpl (stub /auth), WebSocketCtor (stub) e
   timers controláveis. Prova o CONTRATO DE SEGURANÇA e o fluxo:
   token só no main (nunca no estado), body só {deviceId}, ticket só na URL do /ws,
   baseline NÃO notifica, heartbeat envia {t:"hb"}, reconexão com backoff,
   logout/disconnect encerra. NÃO substitui a prova física real (WSS + baseline).
   ===================================================================== */
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const { createPresenceClient } = require(path.join(ROOT, 'dist', 'main', 'presenceClient.js'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };
const flush = () => new Promise((r) => setImmediate(r));

const TOKEN = 'FAKE_SESSION_TOKEN_ws_do_not_leak_XYZ';
const AUTH = 'https://example.invalid/presence';
const WSURL = 'wss://example.invalid/presence/ws';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'presclient-')); }
function writeSession(dir, obj) { fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify(obj)); }

// Stub do WebSocket (API `ws`: .on/.send/.close). Guarda a última instância criada.
class FakeWS {
  constructor(url) { this.url = url; this.sent = []; this._h = {}; FakeWS.last = this; FakeWS.count = (FakeWS.count || 0) + 1; }
  on(e, h) { (this._h[e] = this._h[e] || []).push(h); return this; }
  send(m) { this.sent.push(m); }
  close(code, reason) { this.closed = { code, reason }; this.emit('close'); }
  emit(e, arg) { (this._h[e] || []).slice().forEach((h) => h(arg)); }
}
// Timers controláveis: registram callbacks; fireOnce() dispara os pendentes.
function makeTimers() {
  const timers = [];
  const setTimer = (fn, ms) => { const t = { fn, ms, cleared: false, fired: false }; timers.push(t); return t; };
  const clearTimer = (t) => { if (t) t.cleared = true; };
  const fireOnce = () => { timers.filter((t) => !t.cleared && !t.fired).forEach((t) => { t.fired = true; try { t.fn(); } catch (_) { /* */ } }); };
  const pending = () => timers.filter((t) => !t.cleared && !t.fired).length;
  return { setTimer, clearTimer, fireOnce, pending, timers };
}
function authOk(ticket) { return { status: 200, json: async () => ({ ok: true, ticket: ticket || 'TICKET_SECRET_abc', wsEnabled: true, identity: { id: 'u_1', name: 'X', role: 'Designer', admin: false, status: 'online', photo: 'p', color: '#111' } }) }; }
const baselineMsg = (n) => JSON.stringify({ type: 'baseline', serverNow: 1, users: Array.from({ length: n }, (_, i) => ({ userId: 'u' + i, name: 'N' + i, online: true })) });

(async () => {
  console.log('F3.4.2A — presence WebSocket client (stubs; sem rede/electron/ws real)');

  // 1) fluxo feliz: /auth -> ticket -> WS abre -> baseline
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const rec = []; const T = makeTimers(); const states = [];
    FakeWS.last = null;
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1000,
      fetchImpl: async (url, init) => { rec.push({ url, init }); return authOk('TICKET_SECRET_abc'); },
      WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer, onState: (s) => states.push(s) });
    c.connect();
    await flush(); await flush();
    ok('1 /auth chamado com POST + Bearer <token do session.json>', rec.length === 1 && rec[0].url === AUTH + '/auth' && rec[0].init.method === 'POST' && rec[0].init.headers.authorization === 'Bearer ' + TOKEN);
    const body = JSON.parse(rec[0].init.body);
    ok('1 body do /auth = SÓ { deviceId } (UUID; sem userId/token)', JSON.stringify(Object.keys(body)) === JSON.stringify(['deviceId']) && UUID_RE.test(body.deviceId) && body.userId === undefined && body.token === undefined);
    ok('1 WS aberto com ticket na URL (nunca o token)', !!FakeWS.last && FakeWS.last.url.indexOf('ticket=TICKET_SECRET_abc') >= 0 && FakeWS.last.url.indexOf(TOKEN) === -1);
    FakeWS.last.emit('open');
    ok('1 após open: phase connected + wsConnected + authValidated', c.getState().phase === 'connected' && c.getState().wsConnected === true && c.getState().authValidated === true);
    FakeWS.last.emit('message', baselineMsg(3));
    ok('1 baseline recebido -> baselineReceived + onlineCount=3', c.getState().baselineReceived === true && c.getState().onlineCount === 3);
  }

  // 2) token/ticket NUNCA no estado nem nos states empurrados ao renderer
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const T = makeTimers(); const states = [];
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async () => authOk('TICKET_SECRET_abc'), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer, onState: (s) => states.push(s) });
    c.connect(); await flush(); await flush(); FakeWS.last.emit('open'); FakeWS.last.emit('message', baselineMsg(2));
    const dumpState = JSON.stringify(c.getState());
    const dumpStates = JSON.stringify(states);
    ok('2 getState() NUNCA contém o token nem o ticket', dumpState.indexOf(TOKEN) === -1 && dumpState.indexOf('TICKET_SECRET') === -1);
    ok('2 states empurrados ao renderer NUNCA contêm token/ticket', dumpStates.indexOf(TOKEN) === -1 && dumpStates.indexOf('TICKET_SECRET') === -1);
    const allowed = ['phase', 'wsConnected', 'authValidated', 'service', 'lastConnectAt', 'lastMessageAt', 'heartbeatActive', 'baselineReceived', 'onlineCount', 'wsEnabled', 'errorCode'].sort();
    ok('2 chaves do estado == conjunto sanitizado exato', JSON.stringify(Object.keys(c.getState()).sort()) === JSON.stringify(allowed));
  }

  // 3) heartbeat: envia {t:"hb"} e mantém a sessão; heartbeatActive=true
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const T = makeTimers();
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer, heartbeatMs: 30000 });
    c.connect(); await flush(); await flush(); FakeWS.last.emit('open');
    ok('3 heartbeatActive=true após conectar', c.getState().heartbeatActive === true);
    T.fireOnce(); // dispara o tick do heartbeat
    ok('3 heartbeat envia {"t":"hb"} pelo socket', FakeWS.last.sent.some((m) => { try { return JSON.parse(m).t === 'hb'; } catch (_) { return false; } }));
  }

  // 4) baseline NÃO gera notificação (o cliente não tem canal de notificação entrou/saiu no Stage 2A)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const T = makeTimers(); let notified = 0;
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer,
      onLog: (t) => { if (/entrou|saiu|notif/i.test(t)) notified++; } });
    c.connect(); await flush(); await flush(); FakeWS.last.emit('open'); FakeWS.last.emit('message', baselineMsg(5));
    ok('4 baseline atualiza estado sem NENHUMA notificação entrou/saiu', notified === 0 && c.getState().onlineCount === 5);
  }

  // 5) reconexão com backoff ao cair o socket (fechar no X NÃO cai aqui — só o socket cair reagenda)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const T = makeTimers();
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer });
    c.connect(); await flush(); await flush(); FakeWS.last.emit('open');
    const firstWs = FakeWS.last; FakeWS.count = 0;
    firstWs.emit('close'); // socket caiu
    ok('5 ao cair o socket -> phase reconnecting + wsConnected=false', c.getState().phase === 'reconnecting' && c.getState().wsConnected === false);
    ok('5 reconexão agendada (timer pendente) — sem tempestade (1 agendamento)', T.pending() >= 1);
    T.fireOnce(); await flush(); await flush(); // dispara o reconnect -> novo /auth -> novo WS
    ok('5 reconexão abre um NOVO WebSocket', FakeWS.count >= 1 && FakeWS.last !== firstWs);
  }

  // 6) logout/disconnect encerra a conexão e zera o estado
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const T = makeTimers();
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer });
    c.connect(); await flush(); await flush(); FakeWS.last.emit('open'); FakeWS.last.emit('message', baselineMsg(2));
    const sock = FakeWS.last;
    c.disconnect();
    ok('6 disconnect fecha o socket', !!sock.closed);
    ok('6 disconnect -> phase idle + estado zerado (sem baseline/online)', c.getState().phase === 'idle' && c.getState().wsConnected === false && c.getState().baselineReceived === false && c.getState().onlineCount === 0);
  }

  // 7) sem sessão -> não conecta (no_session), sem /auth
  {
    const dir = tmpDir(); const rec = []; const T = makeTimers();
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async (u, i) => { rec.push(u); return authOk(); }, WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer });
    c.connect(); await flush(); await flush();
    ok('7 sem session.json -> errorCode no_session, sem /auth, sem WS', c.getState().errorCode === 'no_session' && rec.length === 0);
  }

  // 8) /auth 401 -> errorCode unauthorized + reconexão agendada (não conecta WS)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const T = makeTimers(); FakeWS.last = null; FakeWS.count = 0;
    const c = createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async () => ({ status: 401, json: async () => ({ ok: false, error: 'unauthorized' }) }), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer });
    c.connect(); await flush(); await flush();
    ok('8 /auth 401 -> errorCode=unauthorized, sem abrir WS, reconexão agendada', c.getState().errorCode === 'unauthorized' && FakeWS.count === 0 && T.pending() >= 1);
  }

  // 9) deviceId persistente entre conexões (mesmo UUID no /auth)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_1' });
    const rec = []; const T = makeTimers();
    const mk = () => createPresenceClient({ userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
      fetchImpl: async (u, i) => { rec.push(JSON.parse(i.body).deviceId); return authOk(); }, WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer });
    const c1 = mk(); c1.connect(); await flush(); await flush(); c1.disconnect();
    const c2 = mk(); c2.connect(); await flush(); await flush(); c2.disconnect();
    ok('9 deviceId UUID persistente (mesmo entre reconstruções do cliente)', rec.length === 2 && rec[0] === rec[1] && UUID_RE.test(rec[0]));
    ok('9 presence-device.json existe e não contém hostname/MAC/IP', fs.existsSync(path.join(dir, 'presence-device.json')) && !/hostname|mac|ip|serial/i.test(fs.readFileSync(path.join(dir, 'presence-device.json'), 'utf8')));
  }

  console.log(`\nf342a-presence-client: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
