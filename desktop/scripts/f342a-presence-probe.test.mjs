#!/usr/bin/env node
/* =====================================================================
   F3.4.2A (Stage-1B) — SONDA DE AUTENTICAÇÃO DE PRESENÇA (proteção técnica).
   Testa dist/main/presenceAuthProbe.js SEM Electron, SEM rede real: injeta
   userDataDir (temp), fetchImpl (stub) e now(). Prova o CONTRATO DE SEGURANÇA:
   token só no main (nunca no resultado/log), body só {deviceId} (sem userId),
   Bearer, deviceId=UUID persistido, resultado sanitizado, 401/timeout/rede/busy.
   NÃO substitui a prova física real com a conta do owner.
   ===================================================================== */
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'dist', 'main', 'presenceAuthProbe.js');
const { createPresenceProbe } = require(MOD);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

const TOKEN = 'FAKE_SESSION_TOKEN_do_not_leak_ABC123';
const ENDPOINT = 'https://example.invalid/presence';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'presprobe-')); }
function writeSession(dir, obj) { fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify(obj)); }
function mkResp(status, obj, opts) {
  return { status, json: async () => { if (opts && opts.badJson) throw new Error('not json'); return obj; } };
}
// fetch stub que grava a requisição e devolve uma resposta canned (ou rejeita).
function stubFetch(recorder, resp, mode) {
  return async (url, init) => {
    recorder.push({ url, init });
    if (mode === 'timeout') { const e = new Error('The operation was aborted'); e.name = 'AbortError'; throw e; }
    if (mode === 'network') { throw new Error('ECONNREFUSED'); }
    return resp;
  };
}
const okIdentity = { id: 'u_9', name: 'Fulano', role: 'Designer', admin: false, status: 'online', photo: 'https://x/p.png', color: '#abc' };

(async () => {
  console.log('F3.4.2A — presence auth probe (stubs; sem rede/electron)');

  // 1) sucesso: validated=true; campos mapeados; ticket/token nunca no resultado
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const rec = [];
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1000, fetchImpl: stubFetch(rec, mkResp(200, { ok: true, ticket: 'TICKET_SECRET_xyz', wsEnabled: false, identity: okIdentity, fieldsPresent: Object.keys(okIdentity) })) });
    const r = await probe.probe();
    ok('1 validated=true no sucesso', r.validated === true);
    ok('1 httpStatus=200', r.httpStatus === 200);
    ok('1 errorCode null no sucesso', r.errorCode === null);
    ok('1 requiredFieldsPresent: id/name/role/status/photo/color = true', r.requiredFieldsPresent.id && r.requiredFieldsPresent.name && r.requiredFieldsPresent.role && r.requiredFieldsPresent.status && r.requiredFieldsPresent.photo && r.requiredFieldsPresent.color);
    ok('1 requiredFieldsPresent.admin=true mesmo com admin:false (boolean presente)', r.requiredFieldsPresent.admin === true);
    ok('1 wsEnabled=false ecoado (stage 1 — WS desligado)', r.wsEnabled === false);
    ok('1 service = idseven-presence-canary', r.service === 'idseven-presence-canary');
    const dump = JSON.stringify(r);
    ok('1 RESULTADO NUNCA contém o token', dump.indexOf(TOKEN) === -1 && dump.indexOf('FAKE_SESSION_TOKEN') === -1);
    ok('1 RESULTADO NUNCA contém o ticket', dump.indexOf('TICKET_SECRET_xyz') === -1 && !/ticket/i.test(dump));
    ok('1 RESULTADO NUNCA contém uid aberto/e-mail', dump.indexOf('u_9') === -1 && dump.indexOf('@') === -1);
  }

  // 2) requisição: POST /auth + Bearer <token> + body SÓ {deviceId} (sem userId)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const rec = [];
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: stubFetch(rec, mkResp(200, { ok: true, wsEnabled: false, identity: okIdentity })) });
    await probe.probe();
    const req = rec[0];
    ok('2 URL = endpoint + /auth', req.url === ENDPOINT + '/auth');
    ok('2 método POST', req.init.method === 'POST');
    ok('2 header Authorization: Bearer <token do session.json>', req.init.headers.authorization === 'Bearer ' + TOKEN);
    const body = JSON.parse(req.init.body);
    ok('2 body SÓ tem a chave deviceId', JSON.stringify(Object.keys(body)) === JSON.stringify(['deviceId']));
    ok('2 body NÃO envia userId/name/role/email/token', body.userId === undefined && body.name === undefined && body.role === undefined && body.email === undefined && body.token === undefined);
    ok('2 deviceId é UUID (nunca hostname/MAC/IP/serial)', UUID_RE.test(body.deviceId));
  }

  // 3) deviceId persistente (UUID em presence-device.json; estável entre chamadas)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const rec = [];
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: stubFetch(rec, mkResp(200, { ok: true, wsEnabled: false, identity: okIdentity })) });
    await probe.probe(); await probe.probe();
    const p = path.join(dir, 'presence-device.json');
    ok('3 presence-device.json criado', fs.existsSync(p));
    const saved = JSON.parse(fs.readFileSync(p, 'utf8'));
    ok('3 deviceId salvo é UUID', UUID_RE.test(saved.deviceId));
    const b1 = JSON.parse(rec[0].init.body).deviceId, b2 = JSON.parse(rec[1].init.body).deviceId;
    ok('3 deviceId estável entre 2 chamadas (mesmo UUID)', b1 === b2 && b1 === saved.deviceId);
    ok('3 presence-device.json NÃO contém hostname/MAC/IP', !/hostname|mac|ip|serial/i.test(fs.readFileSync(p, 'utf8')));
  }

  // 4) token NUNCA logado
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const logs = [];
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, onLog: (t, d) => logs.push({ t, d }), fetchImpl: stubFetch([], mkResp(200, { ok: true, wsEnabled: false, identity: okIdentity })) });
    await probe.probe();
    const dump = JSON.stringify(logs);
    ok('4 nenhum log contém o token', dump.indexOf(TOKEN) === -1);
    ok('4 houve log de diagnóstico sanitizado (presence.probe.done)', /presence\.probe\.done/.test(dump));
  }

  // 5) sem sessão -> no_session, sem fetch
  {
    const dir = tmpDir(); // sem session.json
    const rec = [];
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: stubFetch(rec, mkResp(200, {})) });
    const r = await probe.probe();
    ok('5 errorCode=no_session quando não há session.json', r.errorCode === 'no_session' && r.validated === false);
    ok('5 NÃO fez requisição de rede sem sessão', rec.length === 0);
  }

  // 6) 401 unauthorized
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: stubFetch([], mkResp(401, { ok: false, error: 'unauthorized' })) });
    const r = await probe.probe();
    ok('6 401 -> validated=false + errorCode=unauthorized + httpStatus=401', r.validated === false && r.errorCode === 'unauthorized' && r.httpStatus === 401);
  }

  // 7) timeout (AbortError)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, timeoutMs: 5, fetchImpl: stubFetch([], null, 'timeout') });
    const r = await probe.probe();
    ok('7 timeout -> errorCode=timeout, httpStatus=0, validated=false', r.errorCode === 'timeout' && r.httpStatus === 0 && r.validated === false);
  }

  // 8) erro de rede
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: stubFetch([], null, 'network') });
    const r = await probe.probe();
    ok('8 rede fora -> errorCode=network, validated=false', r.errorCode === 'network' && r.validated === false);
  }

  // 9) corpo não-JSON (200) -> invalid_json
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: stubFetch([], mkResp(200, null, { badJson: true })) });
    const r = await probe.probe();
    ok('9 corpo inválido (200) -> errorCode=invalid_json', r.errorCode === 'invalid_json' && r.validated === false);
  }

  // 10) guarda de concorrência: 2ª chamada durante a 1ª -> busy, sem 2º fetch
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const rec = [];
    let release;
    const gate = new Promise((res) => { release = res; });
    const slowFetch = async (url, init) => { rec.push({ url, init }); await gate; return mkResp(200, { ok: true, wsEnabled: false, identity: okIdentity }); };
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: slowFetch });
    const p1 = probe.probe();          // inicia, fica pendurada no fetch (inFlight=true)
    const r2 = await probe.probe();    // deve retornar busy sem 2º fetch
    ok('10 2ª sonda concorrente -> errorCode=busy', r2.errorCode === 'busy' && r2.validated === false);
    ok('10 só 1 requisição feita (2ª bloqueada)', rec.length === 1);
    release(); await p1;
    ok('10 após concluir, isBusy volta a false', probe.isBusy() === false);
  }

  // 11) campo ausente vira false (ex.: sem photo/color) — sem vazar valor
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const partial = { id: 'u_1', name: 'X', role: 'Equipe', admin: true, status: 'online' }; // sem photo/color
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 1, fetchImpl: stubFetch([], mkResp(200, { ok: true, wsEnabled: false, identity: partial })) });
    const r = await probe.probe();
    ok('11 photo/color ausentes -> false; id/name/role/admin/status -> true', r.requiredFieldsPresent.photo === false && r.requiredFieldsPresent.color === false && r.requiredFieldsPresent.id && r.requiredFieldsPresent.admin && r.requiredFieldsPresent.status);
    ok('11 validated=true (id presente) mesmo sem photo/color', r.validated === true);
  }

  // 12) resultado tem SOMENTE chaves sanitizadas (sem token/ticket/headers/rawBody/uid/email)
  {
    const dir = tmpDir(); writeSession(dir, { token: TOKEN, expiresAt: Date.now() + 3600e3, uid: 'u_9' });
    const probe = createPresenceProbe({ userDataDir: dir, endpoint: ENDPOINT, now: () => 7, fetchImpl: stubFetch([], mkResp(200, { ok: true, wsEnabled: false, identity: okIdentity })) });
    const r = await probe.probe();
    const allowed = ['validated', 'httpStatus', 'durationMs', 'requiredFieldsPresent', 'testedAt', 'errorCode', 'service', 'wsEnabled'].sort();
    ok('12 chaves do resultado == conjunto sanitizado exato', JSON.stringify(Object.keys(r).sort()) === JSON.stringify(allowed));
    ok('12 requiredFieldsPresent só booleans (nunca valores da identidade)', Object.values(r.requiredFieldsPresent).every((v) => typeof v === 'boolean'));
    ok('12 testedAt refletido do now injetado', r.testedAt === 7);
  }

  console.log(`\nf342a-presence-probe: PASS=${pass} FAIL=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
