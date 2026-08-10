#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H10 — RECUPERAÇÃO CONTEXTUAL DA TEAM SESSION + RETOMADA AUTOMÁTICA (suíte de CÓDIGO).
 *
 * P0 (1.0.236 = GO físico PARCIAL): o diagnóstico durável capturou stage=no_session /
 * requestStarted=false / hasSession=false / hasJwt=false — o team JWT (TTL 12h) só era emitido
 * por senha; boot/authSelf/startApp restauram a sessão de USUÁRIO mas NUNCA mintam o team JWT,
 * então a confirmação caía em ensureTeamSession sem sessão e resolvia pelo caminho de
 * cancelamento (tsCancel). A intenção física do usuário NÃO pode ser provada retrospectivamente.
 *
 * Correção (RENDERER-only): ensureTeamSession abre uma camada de autenticação CONTEXTUAL e
 * NÃO-destrutiva (container próprio #tsAuthRoot .ts-auth-back empilhado em document.body; NUNCA
 * reutiliza #modalRoot). Senha correta -> novo team JWT -> a MESMA operação confirmClientSend
 * RETOMA automaticamente 1x (sem novo clique) só após PROVAR teamJwtValid()=true -> POST.
 * Cancelar/backdrop/Esc -> 0 POST, tarefa intacta. Senha errada -> permanece, 0 POST.
 * Idempotência: 1 ação -> 1 renovação -> <=1 POST.
 *
 * Esta suíte roda ensureTeamSession + teamJwtValid + wfTeamAction REAIS extraídos do index.html
 * dentro de um DOM/fetch/localStorage FALSOS, contando POSTs e renovações — os 12 casos do
 * mandato do owner (RED na base 1.0.236, GREEN na 1.0.238) + invariantes de segurança/contrato.
 * Cada bloco comportamental é isolado: uma exceção conta como FALHA (não aborta) — na base
 * 1.0.236 (comportamento ausente) a suíte fica VERMELHA de forma limpa e auditável.
 *
 * Rodar:  node desktop/scripts/f356ah10-team-session-recovery.test.mjs
 * RED:    F356AH10_SRC=<index.html base b7cf531> F356AH10_PKG=<package.json base> node ...
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH10_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH10_PKG || path.join(DESK, 'package.json'), 'utf8'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
// bloco comportamental isolado: exceção = FALHA registrada (não aborta a suíte).
async function block(label, fn) {
  let pending = null;
  // hold() marca a promise como tratada imediatamente (.catch no-op) — na base 1.0.236 o
  // ensureTeamSession antigo rejeita (modalRoot nulo) e sem isso a rejeição vira unhandled e
  // aborta o processo antes do finally; com o .catch a suíte fica VERMELHA de forma limpa.
  const hold = (p) => { pending = p; if (p && typeof p.catch === 'function') p.catch(() => {}); return p; };
  try { await fn(hold); }
  catch (e) { fail++; flog.push('FAIL(exceção) [' + label + ']: ' + (e && e.message || e)); }
  // corrida com timeout: na base 1.0.236 o caminho antigo pode nunca resolver (closeModal
  // ausente no harness), o que travaria a suíte RED; 80ms garante progresso e limpeza.
  finally { if (pending) { try { await Promise.race([pending, new Promise(r => setTimeout(r, 80))]); } catch (_) {} } }
}

function grabFn(SRC, name) {
  let a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  if (SRC.slice(a - 6, a) === 'async ') a -= 6;   // preserva o prefixo async (senão 'await' fica em função síncrona)
  let d = 0;
  for (let j = SRC.indexOf('{', a); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}

/* ---------- helper: JWT de equipe falso (base64url, mesmo formato do Worker HS256) ---------- */
function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function teamJwt(expSec) { return 'h.' + b64url({ exp: expSec, aud: 'idseven-team', scope: 'workflow:team_adjusted_item' }) + '.s'; }

/* ---------- DOM shim mínimo e fiel ao que ensureTeamSession usa ---------- */
function makeDom() {
  const ID = new Map();
  const listenersDoc = {};
  function fire(el, type, evt) { const a = el && el._ls && el._ls[type]; if (a) a.slice().forEach(fn => { try { fn(evt); } catch (_) {} }); }
  function makeEl(tag) {
    const el = {
      tagName: (tag || 'div').toUpperCase(), id: '', className: '', _attrs: {}, _value: '', _text: '', _html: '',
      style: {}, disabled: false, parentNode: null, children: [], _ls: {}, _regIds: [],
      setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'id') { if (this.id) ID.delete(this.id); this.id = v; } },
      getAttribute(k) { return this._attrs[k]; },
      get value() { return this._value; }, set value(v) { this._value = v == null ? '' : String(v); },
      get textContent() { return this._text; }, set textContent(v) { this._text = v == null ? '' : String(v); },
      get innerHTML() { return this._html; },
      set innerHTML(html) { this._html = String(html); const re = /id="([^"]+)"/g; let m; while ((m = re.exec(this._html))) { const cid = m[1]; const c = makeEl('div'); c.id = cid; ID.set(cid, c); this._regIds.push(cid); } },
      addEventListener(t, fn) { (this._ls[t] || (this._ls[t] = [])).push(fn); },
      removeEventListener(t, fn) { const a = this._ls[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
      appendChild(c) { c.parentNode = this; this.children.push(c); if (c.id) ID.set(c.id, c); return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; if (c.id && ID.get(c.id) === c) ID.delete(c.id); (c._regIds || []).forEach(rid => { ID.delete(rid); }); return c; },
      focus() { DOC._focus = this; },
      click() { fire(this, 'click', { type: 'click', target: this }); },
      fireKey(key) { fire(this, 'keydown', { key, preventDefault() {}, stopPropagation() {} }); },
      fireBackdrop() { fire(this, 'click', { target: this }); },
    };
    return el;
  }
  const body = makeEl('body'); body.id = 'body';
  const DOC = {
    body, _focus: null,
    createElement: (t) => makeEl(t),
    getElementById: (id) => ID.get(id) || null,
    addEventListener(t, fn) { (listenersDoc[t] || (listenersDoc[t] = [])).push(fn); },
    removeEventListener(t, fn) { const a = listenersDoc[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    _fireDoc(t, evt) { const a = listenersDoc[t]; if (a) a.slice().forEach(fn => { try { fn(evt); } catch (_) {} }); },
    _docListeners: listenersDoc,
    _ID: ID,
  };
  return DOC;
}
function makeLS() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _map: m }; }

/* ---------- montar as funções REAIS em ambiente falso ---------- */
const SRC = [grabFn(HTML, 'teamJwtValid'), grabFn(HTML, 'ensureTeamSession'), grabFn(HTML, 'wfTeamAction')].join('\n');
const RET = 'return {teamJwtValid:teamJwtValid, ensureTeamSession:ensureTeamSession, wfTeamAction:wfTeamAction};';
function boot(opts) {
  opts = opts || {};
  const doc = makeDom();
  const ls = makeLS();
  const clock = { t: opts.now || 2000000 };
  const DateShim = { now: () => clock.t };
  const counters = { acquire: 0, post: 0, lastHeaders: null, lastBody: null, lastAcquirePw: null };
  const state = { user: { id: 'u_social', name: 'Social' }, tasks: (opts.tasks || []).map(t => Object.assign({}, t)) };
  // stub acquireTeamSession: senha 'CORRETA' -> grava JWT válido e true; senão remove e false. Conta chamadas.
  async function acquireTeamSession(uid, password) {
    counters.acquire++; counters.lastAcquirePw = password;
    if (password === 'CORRETA') { ls.setItem('wp_team_jwt', teamJwt(Math.floor(clock.t / 1000) + 12 * 3600)); return true; }
    ls.removeItem('wp_team_jwt'); return false;
  }
  // stub fetch: só conta POSTs a /team-action e devolve sucesso server-side.
  async function fetchStub(url, init) {
    if (String(url).indexOf('/team-action') >= 0) { counters.post++; counters.lastHeaders = (init && init.headers) || {}; counters.lastBody = (init && init.body) || ''; }
    return { ok: true, status: 200, json: () => Promise.resolve({ ok: true, workflowPhase: 'themes_waiting_client', approvalRound: 1 }) };
  }
  const diagCalls = [];
  const __csDiagSet = (o) => { diagCalls.push(o); };
  const flashes = [];
  const flashToast = (m) => { flashes.push(String(m)); };
  const api = new Function(
    'window', 'document', 'localStorage', 'Date', 'state', 'acquireTeamSession', 'fetch', 'flashToast', '__csDiagSet', 'CLIENT_REVIEW_BASE',
    SRC + '\n' + RET
  )({}, doc, ls, DateShim, state, acquireTeamSession, fetchStub, flashToast, __csDiagSet, 'https://idseven-push.agidseven.workers.dev');
  return { api, doc, ls, clock, counters, state, diagCalls, flashes };
}
const TOKEN_TASK = { id: 'T_cron5', clientReviewToken: 'tok_abc', workflowPhase: undefined, externalWait: undefined };
const tick = () => new Promise(r => setTimeout(r, 0));   // deixa microtasks/await drenarem
const g = (env, id) => { const e = env.doc.getElementById(id); if (!e) throw new Error('elemento ausente: #' + id); return e; };

/* ============================ TESTE 1 — JWT válido -> 1 POST (sem overlay) ============================ */
await block('01', async () => {
  const env = boot({ tasks: [TOKEN_TASK] });
  env.ls.setItem('wp_team_jwt', teamJwt(Math.floor(env.clock.t / 1000) + 12 * 3600));   // sessão já válida
  const r = await env.api.wfTeamAction('T_cron5', 'confirmClientSend', {});
  ok('01 JWT válido: nenhum overlay é criado', env.doc.getElementById('tsAuthRoot') === null);
  ok('01 JWT válido: exatamente 1 POST', env.counters.post === 1);
  ok('01 JWT válido: acquireTeamSession NÃO é chamado', env.counters.acquire === 0);
  ok('01 JWT válido: resultado ok=true', !!(r && r.ok === true));
});

/* ============================ TESTE 2 — JWT ausente -> overlay aparece, 0 POST ============================ */
await block('02', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });   // sem JWT
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  const root = env.doc.getElementById('tsAuthRoot');
  ok('02 sessão ausente: overlay #tsAuthRoot é criado', !!root);
  ok('02 overlay tem classe ts-auth-back (camada empilhada)', !!root && root.className === 'ts-auth-back');
  ok('02 overlay está em document.body (não em #modalRoot)', !!root && root.parentNode === env.doc.body);
  ok('02 campos de auth presentes (tsPw/tsGo/tsCancel)', !!env.doc.getElementById('tsPw') && !!env.doc.getElementById('tsGo') && !!env.doc.getElementById('tsCancel'));
  ok('02 antes de autenticar: 0 POST', env.counters.post === 0);
  g(env, 'tsCancel').click(); await tick(); await rp;   // limpa
});

/* ============================ TESTE 3 — senha CORRETA -> retoma -> 1 POST ============================ */
await block('03', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  g(env, 'tsPw').value = 'CORRETA';
  g(env, 'tsGo').click();
  const r = await rp;
  ok('03 senha correta: acquireTeamSession chamado 1x', env.counters.acquire === 1);
  ok('03 senha correta: retoma a MESMA operação -> 1 POST', env.counters.post === 1);
  ok('03 senha correta: overlay é removido após sucesso', env.doc.getElementById('tsAuthRoot') === null);
  ok('03 senha correta: resultado ok=true', !!(r && r.ok === true));
  ok('03 POST leva Authorization Bearer (JWT novo)', /^Bearer /.test((env.counters.lastHeaders || {})['Authorization'] || ''));
  ok('03 diagnóstico captura requestStarted=true (a próxima cadeia real)', env.diagCalls.some(d => d && d.requestStarted === true));
});

/* ============================ TESTE 4 — senha ERRADA -> permanece, 0 POST ============================ */
await block('04', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  g(env, 'tsPw').value = 'errada';
  g(env, 'tsGo').click();
  await tick();
  ok('04 senha errada: overlay PERMANECE (não fecha)', env.doc.getElementById('tsAuthRoot') !== null);
  ok('04 senha errada: mensagem contextual "Senha incorreta. Tente novamente."', (env.doc.getElementById('tsErr') || {}).textContent === 'Senha incorreta. Tente novamente.');
  ok('04 senha errada: 0 POST', env.counters.post === 0);
  ok('04 senha errada: acquire chamado 1x (a tentativa)', env.counters.acquire === 1);
  ok('04 senha errada: campo de senha é limpo', (env.doc.getElementById('tsPw') || {}).value === '');
  // segunda tentativa CORRETA no mesmo overlay -> retoma -> 1 POST
  g(env, 'tsPw').value = 'CORRETA';
  g(env, 'tsGo').click();
  const r = await rp;
  ok('04 depois: senha correta no mesmo overlay retoma -> 1 POST', env.counters.post === 1 && !!(r && r.ok));
});

/* ============================ TESTE 5 — cancelar -> 0 POST, tarefa intacta ============================ */
await block('05', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  g(env, 'tsCancel').click();
  const r = await rp;
  ok('05 cancelar: resultado error=no_session', !!(r && r.ok === false && r.error === 'no_session'));
  ok('05 cancelar: 0 POST', env.counters.post === 0);
  ok('05 cancelar: acquireTeamSession NÃO chamado', env.counters.acquire === 0);
  ok('05 cancelar: overlay removido', env.doc.getElementById('tsAuthRoot') === null);
  const t = env.state.tasks.find(x => x.id === 'T_cron5');
  ok('05 cancelar: tarefa intacta (sem workflowPhase/externalWait)', t && !t.workflowPhase && !t.externalWait);
});

/* ============================ TESTE 6 — duplo clique -> <=1 POST, <=1 renovação ============================ */
await block('06', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  g(env, 'tsPw').value = 'CORRETA';
  const go = g(env, 'tsGo');
  go.click(); go.click();   // duplo clique síncrono
  const r = await rp;
  ok('06 duplo clique: acquire chamado no máximo 1x', env.counters.acquire === 1);
  ok('06 duplo clique: no máximo 1 POST', env.counters.post === 1);
  ok('06 duplo clique: resultado ok', !!(r && r.ok));
});

/* ============================ TESTE 7 — Enter + clique -> <=1 POST ============================ */
await block('07', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  const pw = g(env, 'tsPw'); pw.value = 'CORRETA';
  pw.fireKey('Enter');            // Enter no campo
  g(env, 'tsGo').click();         // clique quase simultâneo
  const r = await rp;
  ok('07 Enter+clique: acquire chamado no máximo 1x', env.counters.acquire === 1);
  ok('07 Enter+clique: no máximo 1 POST', env.counters.post === 1);
  ok('07 Enter+clique: resultado ok', !!(r && r.ok));
});

/* ============================ TESTE 8 — NÃO destrutivo: modal de envio preservado ============================ */
await block('08', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  // simula o modal "Enviar no grupo do cliente" já aberto em #modalRoot
  const modalRoot = env.doc.createElement('div'); modalRoot.id = 'modalRoot';
  modalRoot.innerHTML = '<div id="btnConfirmSend">ENVIAR NO GRUPO DO CLIENTE</div>';
  env.doc.body.appendChild(modalRoot);
  const before = modalRoot.innerHTML;
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  ok('08 #modalRoot NÃO é tocado (contexto do envio preservado)', env.doc.getElementById('modalRoot').innerHTML === before);
  ok('08 overlay é um container SEPARADO em body', env.doc.getElementById('tsAuthRoot') && env.doc.getElementById('tsAuthRoot') !== modalRoot);
  ok('08 overlay NÃO é filho de #modalRoot', env.doc.getElementById('tsAuthRoot').parentNode !== modalRoot);
  g(env, 'tsCancel').click(); await tick(); await rp;
});

/* ============================ TESTE 9 — backdrop e Esc cancelam (0 POST) ============================ */
await block('09', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  g(env, 'tsAuthRoot').fireBackdrop();   // clique no backdrop (target === root)
  const r = await rp;
  ok('09 backdrop: cancela (error=no_session), 0 POST', !!(r && r.error === 'no_session') && env.counters.post === 0);
  ok('09 backdrop: overlay removido', env.doc.getElementById('tsAuthRoot') === null);
});
await block('09b', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  env.doc._fireDoc('keydown', { key: 'Escape', preventDefault() {}, stopPropagation() {} });
  const r = await rp;
  ok('09 Esc: cancela (error=no_session), 0 POST', !!(r && r.error === 'no_session') && env.counters.post === 0);
  ok('09 Esc: handler global de keydown é removido (finish desliga o esc)', (env.doc._docListeners['keydown'] || []).length === 0);
});

/* ============================ TESTE 10 — JWT EXPIRADO também dispara o overlay ============================ */
await block('10', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  env.ls.setItem('wp_team_jwt', teamJwt(Math.floor(env.clock.t / 1000) - 3600));   // expirado 1h atrás
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  ok('10 JWT expirado: overlay aparece (não é tratado como válido)', env.doc.getElementById('tsAuthRoot') !== null);
  ok('10 JWT expirado: 0 POST até autenticar', env.counters.post === 0);
  g(env, 'tsPw').value = 'CORRETA'; g(env, 'tsGo').click();
  const r = await rp;
  ok('10 JWT expirado: renovação retoma -> 1 POST', env.counters.post === 1 && !!(r && r.ok));
});

/* ============================ TESTE 11 — segurança: senha NUNCA persistida ============================ */
await block('11', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  g(env, 'tsPw').value = 'CORRETA';
  g(env, 'tsGo').click();
  await rp;
  let leaked = false; for (const [k, v] of env.ls._map.entries()) { if (String(v).indexOf('CORRETA') >= 0 || String(k).indexOf('CORRETA') >= 0) leaked = true; }
  ok('11 senha NUNCA aparece no localStorage', !leaked);
  ok('11 única credencial persistida é o wp_team_jwt (JWT, não a senha)', env.ls.getItem('wp_team_jwt') && env.ls.getItem('wp_team_jwt').indexOf('CORRETA') < 0);
  ok('11 diagnóstico NÃO contém a senha', !env.diagCalls.some(d => JSON.stringify(d).indexOf('CORRETA') >= 0));
  ok('11 POST body NÃO contém a senha', String(env.counters.lastBody || '').indexOf('CORRETA') < 0);
});

/* ============================ TESTE 12 — idempotência: 1 ação -> 1 renovação -> 1 POST (Idempotency-Key) ============================ */
await block('12', async (hold) => {
  const env = boot({ tasks: [TOKEN_TASK] });
  const rp = hold(env.api.wfTeamAction('T_cron5', 'confirmClientSend', {}));
  await tick();
  g(env, 'tsPw').value = 'CORRETA';
  const go = g(env, 'tsGo');
  go.click(); go.click(); go.click();   // triplo clique
  const r = await rp;
  ok('12 idempotência: exatamente 1 renovação', env.counters.acquire === 1);
  ok('12 idempotência: exatamente 1 POST', env.counters.post === 1);
  ok('12 idempotência: POST carrega Idempotency-Key', !!((env.counters.lastHeaders || {})['Idempotency-Key']));
  ok('12 idempotência: resultado ok', !!(r && r.ok));
});

/* ============================ CONTRATO ESTÁTICO — segurança e fiação (não-regressão) ============================ */
ok('S0 package.json = 1.0.238', PKG.version === '1.0.238');
ok('S0 description marca H10 team-session-recovery', /f356ah10-team-session-recovery/i.test(PKG.description || ''));
// container próprio, não-destrutivo
ok('S1 CSS .ts-auth-back existe (camada empilhada z acima dos modais)', /\.ts-auth-back\{[^}]*z-index:90/.test(HTML));
ok('S2 overlay criado via document.createElement + id tsAuthRoot', /var root=document\.createElement\('div'\);[\s\S]{0,80}root\.id='tsAuthRoot'/.test(HTML));
ok('S3 overlay é anexado a document.body (NÃO a #modalRoot)', /document\.body\.appendChild\(root\)/.test(HTML));
ok('S4 ensureTeamSession NÃO usa modalRoot destrutivamente', !/getElementById\('modalRoot'\)\.innerHTML=/.test(grabFn(HTML, 'ensureTeamSession')));
// retomada automática só após provar sessão
ok('S5 sucesso só após PROVAR teamJwtValid()=true antes de retomar', /if\(ok&&teamJwtValid\(\)\)\{ finish\(true\)/.test(HTML));
// idempotência
ok('S6 guardas busy+settled na submit', /if\(busy\|\|settled\)return;/.test(HTML) && /var settled=false, busy=false;/.test(HTML));
// mensagens contextuais
ok('S7 wfTeamAction é SILENCIOSO no no_session (chamador dá a mensagem)', /if\(!\(await ensureTeamSession\(\)\)\)\{ if\(_diag\)__csDiagSet\(\{stage:'no_session'\}\); return \{ok:false,error:'no_session'\}; \}/.test(HTML));
ok('S8 handler confirmar: no_session -> "A autenticação foi cancelada."', /r\.error==='no_session'\)\{ flashToast\('Envio não confirmado\. A autenticação foi cancelada\.'/.test(HTML));
ok('S9 registerExternalDecision: no_session -> "autenticação cancelada."', /r\.error==='no_session'\)\{ flashToast\('Registro não efetuado — autenticação cancelada\.'/.test(HTML));
// segurança sem bypass
ok('S10 acquireTeamSession posta em /team/session com {uid,password}', /\/team\/session'[\s\S]{0,140}JSON\.stringify\(\{uid:uid,password:password\}\)/.test(HTML));
ok('S11 senha nunca vai para localStorage/sessionStorage (ensureTeamSession)', !/setItem\([^)]*pw/i.test(grabFn(HTML, 'ensureTeamSession')) && !/sessionStorage/.test(grabFn(HTML, 'ensureTeamSession')));
ok('S12 /team-action continua exigindo Authorization Bearer', /'Authorization':'Bearer '\+jwt/.test(HTML));
// não-regressão H8 (timeline honesta + diagnóstico durável) e infra de notificações 1.0.228
ok('S13 H8 timeline honesta preservada (flowCanonicalSentSignal)', /const sent=flowCanonicalSentSignal\(t\)\|\|\(cf!=='afazer'\)/.test(HTML));
ok('S14 H8 diagnóstico durável preservado (__csDiagPersist + __csDiagLoad)', /__csDiagPersist\(ctx&&ctx\.id\)/.test(HTML) && /__csDiagLoad\(/.test(HTML));
ok('S15 infra de notificações 1.0.228 preservada (marcador herdado na descrição)', /1\.0\.228/.test(PKG.description || ''));
ok('S16 boot NÃO recria team JWT sem credencial (setItem wp_team_jwt só em acquireTeamSession)', (HTML.match(/setItem\('wp_team_jwt'/g) || []).length === 1);

/* ---------- resumo ---------- */
console.log('\n================= F3.5.6A-H10 — TEAM SESSION RECOVERY =================');
if (flog.length) console.log(flog.join('\n'));
console.log('PASS ' + pass + ' | FAIL ' + fail + '  (versão sob teste: ' + PKG.version + ')');
process.exit(fail ? 1 : 0);
