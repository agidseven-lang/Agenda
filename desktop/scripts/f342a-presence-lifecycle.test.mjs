#!/usr/bin/env node
/* =====================================================================
   F3.4.2A (Stage-2A-X) — CICLO DE VIDA DA PRESENÇA × FECHAR-NO-X.
   Prova a correção "fechar no X mantém o WebSocket/heartbeat vivos no main":
     - fechar no X (mainWin.on close) só ESCONDE; NUNCA chama disconnect;
     - o heartbeat continua e o estado permanece connected quando oculto;
     - reabrir da bandeja REUTILIZA a conexão (idempotente; sem 2ª sessão, sem 0->1);
     - keep-alive (powerSaveBlocker via onActive/onIdle) segurado enquanto conectado;
     - logout / Sair (tray) / quitAndInstall ENCERRAM a conexão e soltam o keep-alive;
     - crash/queda de socket -> reconexão (intenção mantida); TTL do servidor é a recuperação;
     - broadcast permanece false (o cliente NUNCA gera entrou/saiu);
     - Worker J6 (cloudflare-worker.js) e funções de negócio byte-idênticos à 1.0.177.
   Usa dist/main/presenceClient.js com stubs (sem Electron/rede/ws real) + checagens
   estáticas do main.ts (fiação real) e byte-identidade vs produção 1.0.177 (2963927).
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
  close(code, reason) { this.closed = { code, reason }; this.emit('close'); }
  emit(e, arg) { (this._h[e] || []).slice().forEach((h) => h(arg)); }
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
// Mock do powerSaveBlocker (keep-alive): onActive segura; onIdle solta. Conta start/stop p/ idempotência.
function mkPsb() { const s = { held: false, starts: 0, stops: 0 }; return { s, onActive: () => { s.held = true; s.starts++; }, onIdle: () => { s.held = false; s.stops++; } }; }

// Conecta um cliente com stubs + keep-alive mock; devolve refs. connect()->open->baseline.
async function bring(dir, extra = {}) {
  writeSession(dir);
  const T = makeTimers(); const psb = mkPsb(); FakeWS.last = null; FakeWS.count = 0;
  const c = createPresenceClient({
    userDataDir: dir, authEndpoint: AUTH, wsEndpoint: WSURL, now: () => 1,
    fetchImpl: async () => authOk(), WebSocketCtor: FakeWS, setTimer: T.setTimer, clearTimer: T.clearTimer,
    onActive: psb.onActive, onIdle: psb.onIdle, ...extra,
  });
  c.connect(); await flush(); await flush(); FakeWS.last.emit('open'); FakeWS.last.emit('message', baselineMsg(2));
  return { c, T, psb, sock: FakeWS.last };
}

(async () => {
  console.log(`F3.4.2A Stage-2A-X — presença × fechar-no-X (stubs + estático vs ${BASE_SHA})`);

  // ---- 1) fechar no X NÃO chama disconnect (estático sobre a fiação real do main.ts) ----
  {
    const ci = srcMain.indexOf('mainWin.on("close"');
    const closeBlock = ci >= 0 ? srcMain.slice(ci, srcMain.indexOf('\n  });', ci) + 6) : '';
    ok('1 fechar no X (mainWin.on "close") só esconde (hide) e NUNCA chama disconnect',
      ci >= 0 && /mainWin\?\.hide\(\)/.test(closeBlock) && !/disconnect/.test(closeBlock) && /e\.preventDefault\(\)/.test(closeBlock));
  }

  // ---- 2) fechar no X NÃO para o heartbeat (heartbeat segue no main; nada é chamado ao ocultar) ----
  {
    const { c, T, sock } = await bring(tmpDir());
    // "fechar no X" = o app só esconde a janela; NENHUM método do cliente é chamado.
    T.fireOnce(); // 1º tick de heartbeat (já oculto)
    T.fireOnce(); // 2º tick — prova que o heartbeat CONTINUA se re-armando
    const hbs = sock.sent.filter((m) => { try { return JSON.parse(m).t === 'hb'; } catch (_) { return false; } }).length;
    ok('2 fechar no X não para o heartbeat (envia {t:"hb"} repetidamente; heartbeatActive)', hbs >= 2 && c.getState().heartbeatActive === true);
  }

  // ---- 3) fechar no X MANTÉM o estado connected + keep-alive segurado ----
  {
    const { c, psb, sock } = await bring(tmpDir());
    // oculta (no-op no cliente): estado permanece
    ok('3 fechar no X mantém connected/wsConnected e o socket aberto', c.getState().phase === 'connected' && c.getState().wsConnected === true && !sock.closed);
    ok('3 keep-alive (powerSaveBlocker) SEGURADO enquanto conectado', psb.s.held === true && psb.s.starts === 1 && psb.s.stops === 0);
  }

  // ---- 4) reabrir pelo tray REUTILIZA a conexão (idempotente; sem novo socket) ----
  {
    const { c } = await bring(tmpDir());
    const before = FakeWS.count; const sameSock = FakeWS.last;
    c.connect(); await flush(); await flush(); // main.ts: mainWin.on("show") -> connect()
    ok('4 reabrir (connect idempotente) NÃO abre 2º WebSocket (reutiliza a mesma conexão)', FakeWS.count === before && FakeWS.last === sameSock && c.getState().phase === 'connected');
  }

  // ---- 5) reabrir NÃO cria sessão duplicada nem novo keep-alive (onActive uma única vez) ----
  {
    const { c, psb } = await bring(tmpDir());
    c.connect(); await flush(); c.connect(); await flush(); // vários "show"
    ok('5 reabrir não duplica sessão: onActive disparou 1x (sem start duplo do keep-alive)', psb.s.starts === 1 && psb.s.stops === 0 && FakeWS.count === 1);
  }

  // ---- 6) LOGOUT encerra a conexão e solta o keep-alive ----
  {
    const { c, psb, sock } = await bring(tmpDir());
    c.disconnect(); // session-logout -> presenceClient.disconnect()
    ok('6 logout: socket fechado + phase idle + keep-alive liberado', !!sock.closed && c.getState().phase === 'idle' && psb.s.held === false && psb.s.stops === 1);
    ok('6 (estático) main.ts encerra a presença no session-logout', /session-logout[\s\S]*?presenceClient\.disconnect\(\)/.test(srcMain));
  }

  // ---- 7) SAIR (tray) encerra a conexão (realQuit) ----
  {
    const { c, psb, sock } = await bring(tmpDir());
    c.disconnect(); // realQuit -> presenceClient.disconnect()
    ok('7 Sair (tray): socket fechado + keep-alive liberado', !!sock.closed && psb.s.held === false);
    ok('7 (estático) realQuit chama presenceClient.disconnect() antes de app.quit()', /function realQuit[\s\S]*?presenceClient\.disconnect\(\)[\s\S]*?app\.quit\(\)/.test(srcMain));
  }

  // ---- 8) ATUALIZAÇÃO/REINÍCIO encerra a conexão antes do quitAndInstall ----
  {
    const { c, sock } = await bring(tmpDir());
    c.disconnect(); // updaterTeardownForInstall -> presenceClient.disconnect()
    ok('8 quitAndInstall: presença encerrada antes de instalar', !!sock.closed && c.getState().phase === 'idle');
    ok('8 (estático) updaterTeardownForInstall chama presenceClient.disconnect()', /updaterTeardownForInstall[\s\S]*?presenceClient\.disconnect\(\)/.test(srcMain));
  }

  // ---- 9) CRASH/queda de rede: reconexão mantém a INTENÇÃO; TTL do servidor é a recuperação ----
  {
    const { c, T, psb, sock } = await bring(tmpDir());
    sock.emit('close'); // socket caiu SEM disconnect (crash/queda) — não é fechar-no-X, é o socket morrer
    ok('9 crash: reconexão agendada + intenção mantida (phase reconnecting; NÃO idle)', c.getState().phase === 'reconnecting' && T.pending() >= 1);
    ok('9 crash NÃO solta o keep-alive (intenção segue; TTL do servidor recupera)', psb.s.held === true && psb.s.stops === 0);
  }

  // ---- 10) BROADCAST permanece false: o CLIENTE nunca gera entrou/saiu (flag é do Worker, intocada) ----
  {
    const pc = fs.readFileSync(path.join(ROOT, 'src/main/presenceClient.ts'), 'utf8');
    ok('10 cliente nunca surfa entrou/saiu (sem Notification; transição ignorada no Stage-2A)',
      !/\bentrou\b|\bsaiu\b/i.test(pc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) && !/new Notification/.test(pc) && /ignored_stage2a/.test(pc));
  }

  // ---- 11) WORKER J6 (cloudflare-worker.js / idseven-push) byte-idêntico à produção 1.0.177 ----
  {
    const base = norm(gitShow('cloudflare-worker.js'));
    const cur = norm(fs.readFileSync(path.join(REPO, 'cloudflare-worker.js'), 'utf8'));
    ok('11 Worker J6 (cloudflare-worker.js) byte-idêntico à 1.0.177 (intocado)', base === cur);
  }

  // ---- 12) FUNÇÕES DE NEGÓCIO intactas: byte-identidade vs produção 1.0.177 ----
  {
    for (const rel of ['src/main/auth-core.ts', 'src/main/notifier.ts', 'src/main/tray.ts', 'src/main/clockSync.ts']) {
      ok(`12 ${rel} byte-idêntico à 1.0.177 (negócio intocado)`, norm(gitShow('desktop/' + rel)) === norm(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
    }
  }

  console.log(`\nf342a-presence-lifecycle: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
