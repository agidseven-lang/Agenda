#!/usr/bin/env node
/* =====================================================================
   F3.4.2A (Stage-2C) — NOTIFICAÇÕES DE PRESENÇA (entrada/saída) no CLIENTE.
   Dirige dist/main/presenceClient.js SEM Electron/rede/ws real: injeta stubs e
   captura o gancho `onPresenceEvent` (produtor único no main). Prova o contrato:
     - baseline NUNCA notifica (só popula roster + baseline de revision);
     - transição 0->1 (outro usuário) => UMA notificação de ENTRADA;
     - transição 1->0 => UMA notificação de SAÍDA;
     - o PRÓPRIO usuário (baseline.self) NUNCA é notificado (guardião);
     - DEDUPE por eventId (replay não duplica);
     - revision <= baseline (evento velho / já conhecido) é ignorado;
     - reconexão/baseline novo NÃO regeram notificações (absorvidas pelo baseline);
     - roster sanitizado (sem deviceId) reflete on-line/off-line + lastSeen.
   NÃO substitui a prova física real (2 máquinas + owner/Tatiana).
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

const TOKEN = 'FAKE_SESSION_TOKEN_notif_XYZ';
const AUTH = 'https://example.invalid/presence';
const WSURL = 'wss://example.invalid/presence/ws';

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'presnotif-')); }
function writeSession(dir) { fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'me' })); }

class FakeWS {
  constructor(url) { this.url = url; this.sent = []; this._h = {}; FakeWS.last = this; FakeWS.count = (FakeWS.count || 0) + 1; }
  on(e, h) { (this._h[e] = this._h[e] || []).push(h); return this; }
  send(m) { this.sent.push(m); }
  close(code, reason) { this.closed = { code, reason }; this.emit('close', code, reason); }
  emit(e, ...a) { (this._h[e] || []).slice().forEach((h) => h(...a)); }
}
function makeTimers() {
  const timers = [];
  const setTimer = (fn) => { const t = { fn, cleared: false, fired: false }; timers.push(t); return t; };
  const clearTimer = (t) => { if (t) t.cleared = true; };
  const fireOnce = () => timers.filter((t) => !t.cleared && !t.fired).forEach((t) => { t.fired = true; try { t.fn(); } catch (_) { /* */ } });
  return { setTimer, clearTimer, fireOnce };
}
const authOk = () => ({ status: 200, json: async () => ({ ok: true, ticket: 'TICKET_abc', wsEnabled: true }) });
const baseline = (self, users) => JSON.stringify({ type: 'baseline', serverNow: 1000, self, users });
const trans = (id, online, rev, name) => JSON.stringify({
  type: 'presence_transition', eventId: `presence:${id}:${rev}:${online ? 'online' : 'offline'}`,
  online, user: { id, name: name || ('N_' + id), photo: 'p_' + id, role: 'Designer' }, transitionedAt: 5000 + rev, transitionRevision: rev,
});

async function bring() {
  const dir = tmpDir(); writeSession(dir);
  const notifs = []; const states = []; const T = makeTimers();
  FakeWS.last = null; FakeWS.count = 0;
  const c = createPresenceClient({
    userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 9000,
    fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer,
    onState: (s) => states.push(s),
    onPresenceEvent: (kind, user, meta) => notifs.push({ kind, user, meta }),
  });
  c.connect(); await flush(); await flush();
  FakeWS.last.emit('open'); await flush();
  return { c, notifs, states, T, dir };
}

(async () => {
  console.log('F3.4.2A Stage-2C — notificações de presença (stubs; captura onPresenceEvent)');

  // 1) BASELINE nunca notifica (self=me; u2 já on-line). Roster populado, onlineCount=2.
  const ctx = await bring();
  const { c, notifs } = ctx;
  ctx.c.__ = 1;
  {
    FakeWS.last.emit('message', baseline('me', [
      { userId: 'me', name: 'Owner', photo: 'pm', role: 'Admin', online: true, lastSeen: 4000, sessions: 1, transitionRevision: 1 },
      { userId: 'u2', name: 'Bruno', photo: 'p2', role: 'Designer', online: true, lastSeen: 4000, sessions: 2, transitionRevision: 3 },
    ]));
    ok('1 baseline NÃO gera notificação', notifs.length === 0);
    ok('1 baseline popula roster (2 on-line) + onlineCount=2', c.getState().roster.length === 2 && c.getState().onlineCount === 2);
    ok('1 roster sem deviceId (sanitizado); sessions do baseline preservado', c.getState().roster.every((e) => !('deviceId' in e)) && c.getState().roster.find((e) => e.id === 'u2').sessions === 2);
  }

  // 2) transição 0->1 de OUTRO usuário (u3) => UMA notificação de ENTRADA (verde)
  {
    FakeWS.last.emit('message', trans('u3', true, 1, 'Ana'));
    ok('2 0->1 (u3) => UMA notificação online', notifs.length === 1 && notifs[0].kind === 'online' && notifs[0].user.id === 'u3' && notifs[0].user.name === 'Ana');
    ok('2 meta carrega eventId canônico + sessions>=1; roster agora 3 on-line', notifs[0].meta.eventId === 'presence:u3:1:online' && c.getState().roster.length === 3 && c.getState().onlineCount === 3);
  }

  // 3) DEDUPE: reenviar o MESMO eventId NÃO duplica
  {
    FakeWS.last.emit('message', trans('u3', true, 1, 'Ana'));
    ok('3 replay do MESMO eventId não duplica (dedupe)', notifs.length === 1);
  }

  // 4) STALE: revision <= baseline conhecido é ignorado (u2 já em rev 3; reenvia rev 3 e rev 2)
  {
    FakeWS.last.emit('message', trans('u2', false, 3, 'Bruno')); // == baseline => stale
    FakeWS.last.emit('message', trans('u2', false, 2, 'Bruno')); // < baseline => stale
    ok('4 evento com revision <= baseline é ignorado (sem notificação)', notifs.length === 1);
  }

  // 5) transição 1->0 (u3 sai, rev 2 > 1) => UMA notificação de SAÍDA (cinza)
  {
    FakeWS.last.emit('message', trans('u3', false, 2, 'Ana'));
    ok('5 1->0 (u3) => UMA notificação offline', notifs.length === 2 && notifs[1].kind === 'offline' && notifs[1].user.id === 'u3');
    ok('5 roster reflete u3 off-line (online=false, sessions 0); onlineCount volta a 2', (function () { const e = c.getState().roster.find((x) => x.id === 'u3'); return e && e.online === false && e.sessions === 0 && c.getState().onlineCount === 2; })());
  }

  // 6) GUARDIÃO anti-self: transição do PRÓPRIO usuário (me) NUNCA notifica (mesmo rev > baseline)
  {
    FakeWS.last.emit('message', trans('me', false, 9, 'Owner')); // self offline
    FakeWS.last.emit('message', trans('me', true, 10, 'Owner'));  // self online
    ok('6 transições do próprio usuário (self) NÃO geram notificação', notifs.length === 2);
  }

  // 7) RECONEXÃO: novo baseline (após queda) NÃO regenera notificações; eventos já absorvidos são stale
  {
    FakeWS.last.emit('close', 1006, 'net'); ctx.T.fireOnce(); await flush(); await flush();
    FakeWS.last.emit('open'); await flush();
    FakeWS.last.emit('message', baseline('me', [
      { userId: 'me', name: 'Owner', photo: 'pm', role: 'Admin', online: true, lastSeen: 8000, sessions: 1, transitionRevision: 10 },
      { userId: 'u3', name: 'Ana', photo: 'p_u3', role: 'Designer', online: true, lastSeen: 8000, sessions: 1, transitionRevision: 3 },
    ]));
    ok('7 baseline pós-reconexão NÃO gera notificação (absorve o gap)', notifs.length === 2);
    FakeWS.last.emit('message', trans('u3', true, 3, 'Ana')); // == baseline => stale
    ok('7 transição já refletida no baseline é ignorada (stale)', notifs.length === 2);
    FakeWS.last.emit('message', trans('u3', false, 4, 'Ana')); // rev 4 > 3 => notifica (uma saída fresca)
    ok('7 transição NOVA após reconexão (rev>baseline) notifica normalmente', notifs.length === 3 && notifs[2].kind === 'offline');
  }

  // 8) LOGOUT limpa a agregação (roster/dedupe/self) — sem vazamento entre sessões
  {
    c.disconnect('logout');
    ok('8 logout zera roster + onlineCount (agregação limpa)', c.getState().roster.length === 0 && c.getState().onlineCount === 0);
  }

  console.log(`\nf342a-presence-notifications: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
