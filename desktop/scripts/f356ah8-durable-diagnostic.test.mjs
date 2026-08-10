#!/usr/bin/env node
/* =====================================================================================
 * F3.5.6A-H8 (ESCOPO A) — DIAGNÓSTICO DURÁVEL (suíte de CÓDIGO/contrato).
 *
 * P0 (1.0.235 reprovada): o botão "Copiar diagnóstico da confirmação" só era revelado no
 * DOM da instância atual do modal e nascia display:none a cada reconstrução — sumia ao
 * fechar/reabrir e após reiniciar; _wireGroupSend não consultava o diagnóstico.
 *
 * Correção (RENDERER): diagnóstico persistido SANITIZADO no localStorage (SÓ os 10 campos),
 * por CHAVE = hash NÃO-reversível do taskId (id bruto nunca gravado nem copiado), TTL 24h;
 * botão re-revelado na abertura quando há diagnóstico DAQUELA tarefa; cópia no formato
 * "CONFIRM_CLIENT_SEND" apenas com os 10 campos.
 *
 * Esta suíte roda os helpers REAIS extraídos do index.html em um ambiente com localStorage/
 * window/Date FALSOS, cobrindo A1–A8 do mandato do owner + reforços de sanitização/TTL/hash.
 *
 * Rodar: node desktop/scripts/f356ah8-durable-diagnostic.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(process.env.F356AH8_SRC || path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(process.env.F356AH8_PKG || path.join(DESK, 'package.json'), 'utf8'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

function grabFn(SRC, name) {
  const a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  let d = 0;
  for (let j = SRC.indexOf('{', a); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
function grabDecl(SRC, marker) {
  const a = SRC.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  for (let j = a + marker.length; j < SRC.length; j++) { if (SRC[j] === ';') return SRC.slice(a, j + 1); }
  throw new Error('decl sem ; : ' + marker);
}

/* ---------- A0. IDENTIDADE + ESTRUTURA ---------- */
ok('A0.1 package.json 1.0.243', PKG.version === '1.0.243');
ok('A0.2 description marca H8 durable-diag', /durable-diag-honest-timeline/i.test(PKG.description || ''));
ok('A0.3 _wireGroupSend revela na ABERTURA via __csDiagLoad', /if\(__csDiagLoad\(ctx&&ctx\.id\)\)\{[^}]*btnCopyConfirmDiag/.test(HTML));
ok('A0.4 handler btnConfirmSend PERSISTE após a tentativa', /__csDiagPersist\(ctx&&ctx\.id\)/.test(HTML));
ok('A0.5 cópia usa __csDiagFormat (formato CONFIRM_CLIENT_SEND)', /var txt=__csDiagFormat\(d\)/.test(HTML));

/* ---------- montar os helpers REAIS em ambiente falso ---------- */
const SRC = [
  grabDecl(HTML, 'var __CS_DIAG_LS_KEY='), grabDecl(HTML, 'var __CS_DIAG_TTL_MS='), grabDecl(HTML, 'var __CS_DIAG_FIELDS='),
  grabFn(HTML, '__csDiagInit'), grabFn(HTML, '__csDiagSet'), grabFn(HTML, '__csDiagHashKey'), grabFn(HTML, '__csDiagSanitize'),
  grabFn(HTML, '__csDiagStoreRead'), grabFn(HTML, '__csDiagStoreWrite'), grabFn(HTML, '__csDiagPrune'),
  grabFn(HTML, '__csDiagPersist'), grabFn(HTML, '__csDiagLoad'), grabFn(HTML, '__csDiagFormat'),
].join('\n');
const RET = 'return {init:__csDiagInit,set:__csDiagSet,persist:__csDiagPersist,load:__csDiagLoad,format:__csDiagFormat,sanitize:__csDiagSanitize,hash:__csDiagHashKey,KEY:__CS_DIAG_LS_KEY,TTL:__CS_DIAG_TTL_MS,FIELDS:__CS_DIAG_FIELDS};';
function makeLS() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), raw: () => (m.has('ag_confirm_send_diag_v1') ? m.get('ag_confirm_send_diag_v1') : '') }; }
function boot(ls, clock) { const win = {}; const DateShim = { now: () => clock.t }; const api = new Function('window', 'localStorage', 'Date', 'DESK_VER', SRC + '\n' + RET)(win, ls, DateShim, '1.0.243'); return { api, win }; }
// simula uma tentativa de confirmação que FALHA server-side (o cenário físico do owner)
function simulateAttempt(env, taskId) {
  env.api.init(taskId);
  env.api.set({ hasTask: true, hasToken: true, stage: 'ensure_session', hasSession: true });
  env.api.set({ hasJwt: true, stage: 'request_started', requestStarted: true });
  env.api.set({ responseReceived: true, httpStatus: 500 });
  env.api.set({ stage: 'http_error', workerCode: 'commit_failed' });
  env.api.persist(taskId);
}

const TASK = 't_cron_teste_5';
const clock = { t: 1000000 };
const ls = makeLS();

/* ---------- A1. Antes da tentativa: botão NÃO aparece ---------- */
let env = boot(ls, clock);
ok('A1 antes da tentativa: __csDiagLoad(task) = null (botão oculto)', env.api.load(TASK) === null);

/* ---------- A2. Após 1 tentativa (falha): diagnóstico disponível imediatamente ---------- */
simulateAttempt(env, TASK);
let d2 = env.api.load(TASK);
ok('A2 após a tentativa: diagnóstico disponível (botão aparece)', !!d2 && d2.stage === 'http_error' && d2.httpStatus === 500 && d2.workerCode === 'commit_failed');

/* ---------- A3/A4. Fechar e REABRIR o modal da MESMA tarefa (mesma sessão): continua ---------- */
// reabrir modal = nova instância de _wireGroupSend consultando load() — sem nova tentativa
let d4 = env.api.load(TASK);
ok('A4 reabrir modal da MESMA tarefa: diagnóstico continua (sem nova tentativa)', !!d4 && d4.httpStatus === 500);

/* ---------- A5. Copiar: SOMENTE os 10 campos, formato CONFIRM_CLIENT_SEND, sem taskId ---------- */
const txt = env.api.format(env.api.load(TASK));
ok('A5.1 texto começa com CONFIRM_CLIENT_SEND', txt.split('\n')[0] === 'CONFIRM_CLIENT_SEND');
ok('A5.2 contém os campos-chave da falha', /stage=http_error/.test(txt) && /httpStatus=500/.test(txt) && /workerCode=commit_failed/.test(txt) && /appVersion=1\.0\.243/.test(txt));
ok('A5.3 tem EXATAMENTE 11 linhas (cabeçalho + 10 campos)', txt.split('\n').length === 11);
ok('A5.4 NÃO contém o taskId bruto', txt.indexOf(TASK) === -1);
ok('A5.5 cada linha é um dos 10 campos autorizados', txt.split('\n').slice(1).every(l => env.api.FIELDS.some(f => l.indexOf(f + '=') === 0)));

/* ---------- A6. Abrir modal de OUTRA tarefa: botão NÃO aparece (sem diagnóstico dela) ---------- */
ok('A6 outra tarefa: __csDiagLoad(outra) = null (não vaza diagnóstico entre tarefas)', env.api.load('t_outra_tarefa') === null);

/* ---------- A7. REINICIAR o app (novo window, MESMO localStorage): persiste dentro do TTL ---------- */
let env2 = boot(ls, clock);   // window novo (memória zerada) — só o localStorage sobrevive
ok('A7.1 memória do processo reiniciado começa vazia', env2.win.__confirmSendDiag === undefined);
let d7 = env2.api.load(TASK);
ok('A7.2 após reiniciar: diagnóstico continua disponível (dentro do TTL)', !!d7 && d7.httpStatus === 500 && d7.workerCode === 'commit_failed');

/* ---------- A8. Nenhum dado sensível no storage nem no clipboard ---------- */
const rawStore = ls.raw();
// NOTA: 'hasToken'/'hasJwt' são campos AUTORIZADOS (booleanos de presença) — contêm as
// substrings "token"/"jwt" sem NENHUM valor sensível. Por isso a checagem mira chaves/valores
// sensíveis DISTINTOS (clientReviewToken/shareToken/Authorization/senha/telefone/nome/título/
// tema/legenda) + o taskId bruto — nunca as substrings dos campos booleanos permitidos.
// A prova de que VALORES reais de token/JWT são removidos está no reforço R1.
const FORBIDDEN = ['authorization', 'clientReviewToken', 'shareToken', 'senha', 'telefone', 'CLIENTE TESTE', 'Cronograma Teste', 'Tema teste', 'legenda', TASK];
ok('A8.1 storage NÃO contém chave/valor sensível nem o taskId bruto', FORBIDDEN.every(w => rawStore.toLowerCase().indexOf(w.toLowerCase()) === -1));
ok('A8.2 clipboard (texto) NÃO contém chave/valor sensível nem taskId', FORBIDDEN.every(w => txt.toLowerCase().indexOf(w.toLowerCase()) === -1));
ok('A8.4 storage não tem chave sensível exata (só hasToken/hasJwt, nunca "token"/"jwt"/"clientReviewToken"/"shareToken"/"authorization")', !/"(clientReviewToken|shareToken|authorization|jwt|token)"\s*:/i.test(rawStore));
ok('A8.3 as chaves do storage são hashes (prefixo k…), não o taskId', /"k[0-9a-f]{8}"\s*:/.test(rawStore) && rawStore.indexOf(TASK) === -1);

/* ---------- REFORÇOS: sanitização de campos extras, TTL, hash, cross-task ---------- */
// sanitização: injeta campos proibidos em memória e prova que NÃO são persistidos/copiados
let envS = boot(makeLS(), { t: 2000000 });
envS.api.init('t_s');
envS.api.set({ stage: 'success', token: 'SECRETJWT.aaa.bbb', clientReviewToken: 'LINKTOKEN', shareToken: 'SH', resultOk: true, Authorization: 'Bearer x' });
envS.api.persist('t_s');
const sTxt = envS.api.format(envS.api.load('t_s'));
ok('R1 sanitize: campos proibidos (token/clientReviewToken/Authorization/resultOk) NÃO aparecem', !/SECRETJWT|LINKTOKEN|resultOk|Authorization|Bearer/.test(sTxt));
ok('R2 sanitize: SÓ os 10 campos permitidos são copiados', sTxt.split('\n').slice(1).every(l => envS.api.FIELDS.some(f => l.indexOf(f + '=') === 0)));

// TTL: além de 24h → expira e é limpo
let clk = { t: 5000000 }; let lsT = makeLS(); let envT = boot(lsT, clk);
simulateAttempt(envT, 't_ttl');
ok('R3 dentro do TTL: disponível', !!envT.api.load('t_ttl'));
clk.t = 5000000 + envT.api.TTL + 1;   // avança > 24h
ok('R4 após TTL (24h): expira (load=null)', envT.api.load('t_ttl') === null);
ok('R5 TTL = 24h exatas', envT.api.TTL === 24 * 60 * 60 * 1000);

// hash não-reversível + determinístico
ok('R6 hash determinístico e prefixado (k……)', envT.api.hash('abc') === envT.api.hash('abc') && /^k[0-9a-f]{8}$/.test(envT.api.hash('abc')));
ok('R7 hash não expõe o id bruto', envT.api.hash('t_cron_teste_5').indexOf('t_cron') === -1);

// cross-task: dois diagnósticos coexistem sem se misturar
let lsX = makeLS(); let envX = boot(lsX, { t: 3000000 });
envX.api.init('t_A'); envX.api.set({ stage: 'http_401', httpStatus: 401, workerCode: 'unauthorized' }); envX.api.persist('t_A');
envX.api.init('t_B'); envX.api.set({ stage: 'success', httpStatus: 200 }); envX.api.persist('t_B');
ok('R8 cross-task: t_A mantém seu próprio diagnóstico', envX.api.load('t_A').httpStatus === 401 && envX.api.load('t_A').workerCode === 'unauthorized');
ok('R9 cross-task: t_B mantém seu próprio diagnóstico', envX.api.load('t_B').httpStatus === 200 && envX.api.load('t_B').stage === 'success');

// FORM não salvo nunca persiste
let envF = boot(makeLS(), { t: 4000000 });
envF.api.init('__form__'); envF.api.set({ stage: 'no_task_local' }); envF.api.persist('__form__');
ok('R10 __form__ (não salvo) NUNCA é persistido', envF.api.load('__form__') === null);

console.log('\n===== F3.5.6A-H8 — DIAGNÓSTICO DURÁVEL (ESCOPO A) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('f356ah8-durable-diagnostic: ' + pass + '/' + (pass + fail) + (fail ? ' — FALHOU' : ' — VERDE'));
if (fail) { console.error('::error:: contrato F3.5.6A-H8 (diagnóstico) violado'); process.exit(1); }
