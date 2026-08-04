// F3.5.5A — ORQUESTRADOR DE EXECUÇÃO (funcional, contra dist/main compilado + contratos estáticos).
// Prova as garantias vinculantes do COMPLEMENTO/CORREÇÃO no Desktop:
//   A) OFF ⇒ inerte (zero claim/emit/observabilidade de plano; authorityFor=legacy p/ tudo);
//   B) SHADOW ⇒ totalmente silencioso: zero emit/claim/som; SÓ observabilidade sanitizada
//      (would-display) SEM nome/cliente/título/uid cru; legado segue autoridade (authorityFor=legacy);
//   C) ACTIVE+elegível ⇒ autoridade única adaptativa (authorityFor=adaptive ⇒ legacyGate suprime o
//      legado); checkpoint devido ⇒ CLAIM server-side ANTES de exibir; concedido ⇒ emit na MESMA fila
//      central com payload laranja (título/mensagem literais + som próprio); LEASED_BY_OTHER ⇒
//      suprime local (displayed_on_other_device) sem janela/som; deny sla_zone ⇒ nada exibido;
//   D) OFFLINE ⇒ RETRY_ON_RECONNECT: zero claim/emit; volta a avaliar quando online (sem backlog:
//      checkpoint vencido ⇒ SUPERSEDED local); SLA ativo ⇒ laranja adia (nunca compete);
//   E) invalidação multi-device via projeção do task doc (lastCheckin RESPONDED ⇒ onRemoteClose);
//   F) contratos estáticos: hooks opcionais no taskIdleScheduler (no-op ausentes ⇒ 1.0.216),
//      autoridade única no evalDue, boundary integrado, wiring main.ts (URLs run.app, deviceHash
//      hasheado, IPC admin-only, mensagem literal da jornada), postAuthed confinado no auth-core,
//      wav laranja empacotado e distinto dos WAVs de SLA aprovados (hashes preservados).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto'; import { createRequire } from 'node:module';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const requireCjs = createRequire(path.resolve(__dirname, '..', 'dist', 'main', 'x.js'));
let n = 0, fail = 0;
const ok = (t, c) => { n++; if (c) console.log('  ✓', n, t); else { fail++; console.error('  ✗', n, t); } };

const ORCH = requireCjs('../../dist/main/executionOrchestrator.js');
const T0 = 1754300000000;
const TASK = { id: 'taskSint01', assigneeId: 'des01', status: 'andamento', title: 'Tarefa Sintética', client: 'Cliente X',
  designerSla: { plannedFinishAt: T0 + 8 * 3600000 }, assignedAt: T0 - 3600000, deadlineVersion: 0, sector: 'design' };
const SCHEDULE = { configured: true, days: [0, 1, 2, 3, 4, 5, 6], startMin: 0, endMin: 1440, tzOffsetMin: 0 };
function mk(mode, over) {
  const calls = { claims: [], emits: [], logs: [], closes: [] };
  let nowMs = T0;
  const o = ORCH.createExecutionOrchestrator(Object.assign({
    now: () => nowMs,
    getConfig: () => ({ mode, schedule: SCHEDULE, maxPerDay: 3, maxPerTask: 6, minGapMin: 20, minIntervalMs: 1200000, slaMarginMin: 10, responseMin: 10, sectors: [], designers: [] }),
    getUid: () => 'des01',
    emit: (p) => { calls.emits.push(p); return { ok: true, channel: 'idle-central' }; },
    claim: async (req) => { calls.claims.push(req); return (over && over.claimResult) || { ok: true, decision: 'claimed', claimedAt: nowMs, leaseExpiresAt: nowMs + 600000, claimVersion: 1 }; },
    isOnline: () => !(over && over.offline),
    isCentralBusySla: () => !!(over && over.busySla),
    sectorWarn: () => 30,
    soundDataUri: () => 'data:audio/wav;base64,QUJD',
    appVersion: '1.0.219',
    store: { read: () => ({}), write: () => {} },
    onRemoteClose: (k) => calls.closes.push(k),
    onLog: (t, d) => calls.logs.push({ t, d }),
  }, (over && over.opts) || {}));
  const m = new Map([[TASK.id, Object.assign({}, TASK, (over && over.task) || {})]]);
  o.onTasks(m);
  return { o, calls, setNow: (v) => { nowMs = v; }, tasks: m };
}
const flush = () => new Promise((r) => setTimeout(r, 30));

console.log('— A) OFF ⇒ inerte (comportamento 1.0.216) —');
{
  const { o, calls } = mk('off');
  ok('A1 authorityFor=legacy com OFF', o.authorityFor(TASK) === 'legacy');
  o.evaluate(); await flush();
  ok('A2 zero claims/emits/observabilidade com OFF', calls.claims.length === 0 && calls.emits.length === 0 && calls.logs.length === 0);
  ok('A3 nextBoundary=0 com OFF (timer legado intacto)', o.nextBoundary() === 0);
}
console.log('— B) SHADOW ⇒ totalmente silencioso (só observabilidade sanitizada) —');
{
  const { o, calls, setNow } = mk('shadow');
  ok('B1 authorityFor=legacy com SHADOW (legado segue autoridade REAL)', o.authorityFor(TASK) === 'legacy');
  setNow(T0 + 3 * 3600000); o.evaluate(); await flush();   // 8h ⇒ 20/50/75%; aos 3h o 1º (20%≈96min) está devido
  ok('B2 SHADOW: ZERO claim e ZERO emissão (nenhuma janela/som/fila)', calls.claims.length === 0 && calls.emits.length === 0);
  const wd = calls.logs.filter((l) => l.t === 'execution_tracking.shadow_would_display');
  ok('B3 SHADOW: would-display registrado (observabilidade computada)', wd.length >= 1);
  const blob = JSON.stringify(calls.logs);
  ok('B4 observabilidade SANITIZADA (sem título/cliente/uid cru; só hashes)', !blob.includes('Tarefa Sintética') && !blob.includes('Cliente X') && !blob.includes('des01') && !blob.includes('taskSint01'));
  ok('B5 would-display carrega buckets/índices permitidos', wd.every((l) => typeof l.d.taskIdHash === 'string' && typeof l.d.checkpointIndex === 'number' && typeof l.d.durationBucket === 'string'));
}
console.log('— C) ACTIVE ⇒ claim server-side ANTES de exibir; autoridade única —');
{
  const { o, calls, setNow } = mk('active');
  ok('C1 authorityFor=adaptive (elegível) ⇒ legado suprimido p/ a tarefa', o.authorityFor(TASK) === 'adaptive');
  ok('C2 tarefa de OUTRO designer segue legacy', o.authorityFor(Object.assign({}, TASK, { assigneeId: 'outro' })) === 'legacy');
  const nb = o.nextBoundary();
  ok('C3 nextBoundary futuro integra o timer único (plano 8h ⇒ 1º checkpoint ~20%)', nb > T0 && nb < T0 + 8 * 3600000);
  setNow(T0 + 3 * 3600000); o.evaluate(); await flush();
  ok('C4 checkpoint devido ⇒ claim server-side pedido (com identidade determinística)', calls.claims.length === 1 && calls.claims[0].taskId === 'taskSint01' && calls.claims[0].checkpointIndex >= 0 && calls.claims[0].deadlineVersion === 0);
  ok('C5 claim concedido ⇒ emissão na MESMA fila central', calls.emits.length === 1 && calls.emits[0].kind === 'checkin' && calls.emits[0].checkinKind === 'execution');
  const p = calls.emits[0];
  ok('C6 payload laranja LITERAL do mandato', p.title === 'CHECK-IN DE EXECUÇÃO' && p.message === 'Você está executando esta tarefa neste momento?');
  ok('C7 som PRÓPRIO no payload (data-uri; renderer toca 1x por chave)', String(p.soundDataUri).indexOf('data:audio/wav') === 0);
  ok('C8 dedupKey = chave determinística taskId|designer|dl|cp', /^taskSint01\|des01\|dl0\|cp\d+$/.test(String(p.dedupKey)));
  o.evaluate(); await flush();
  ok('C9 reavaliação NÃO duplica (displayed dedup; 1 claim, 1 emissão)', calls.claims.length === 1 && calls.emits.length === 1);
}
{
  const { o, calls, setNow } = mk('active', { claimResult: { ok: true, decision: 'deny', reason: 'LEASED_BY_OTHER', leaseExpiresAt: T0 + 999999 } });
  setNow(T0 + 3 * 3600000); o.evaluate(); await flush();
  ok('C10 LEASED_BY_OTHER ⇒ suprime local (outro device exibe); ZERO janela/som aqui', calls.claims.length === 1 && calls.emits.length === 0 && JSON.stringify(calls.logs).includes('displayed_on_other_device'));
}
{
  const { o, calls, setNow } = mk('active', { claimResult: { ok: true, decision: 'deny', reason: 'sla_zone' } });
  setNow(T0 + 3 * 3600000); o.evaluate(); await flush();
  ok('C11 deny sla_zone do servidor ⇒ nada exibido', calls.emits.length === 0);
}
{
  const gate = { allowed: false };
  const { o, calls, setNow } = mk('active', { opts: { getConfig: () => ({ mode: 'active', schedule: { configured: false }, responseMin: 10 }) } });
  setNow(T0 + 3 * 3600000); o.evaluate(); await flush();
  ok('C12 ACTIVE com jornada INCOMPLETA ⇒ modo efetivo OFF (fail-safe; zero claim/emit)', o.mode() === 'off' && calls.claims.length === 0 && calls.emits.length === 0 && !gate.allowed);
}
console.log('— D) offline/SLA-ativo/backlog —');
{
  const { o, calls, setNow } = mk('active', { offline: true });
  setNow(T0 + 3 * 3600000); o.evaluate(); await flush();
  ok('D1 OFFLINE ⇒ zero claim/emissão (OFFLINE/RETRY_ON_RECONNECT)', calls.claims.length === 0 && calls.emits.length === 0 && JSON.stringify(calls.logs).includes('offline_retry_on_reconnect'));
}
{
  const { o, calls, setNow } = mk('active', { busySla: true });
  setNow(T0 + 3 * 3600000); o.evaluate(); await flush();
  ok('D2 amarelo/vermelho ativo ⇒ laranja ADIA (deferred; zero emissão)', calls.emits.length === 0 && JSON.stringify(calls.logs).includes('sla_active'));
}
{
  const { o, calls, setNow } = mk('active');
  setNow(T0 + 30 * 3600000); o.evaluate(); await flush();   // reconexão tardia: prazo há 22h ⇒ nada relevante
  ok('D3 pós-prazo/reconexão tardia ⇒ SEM backlog (superseded local; zero emissão)', calls.emits.length === 0 && calls.claims.length === 0);
}
console.log('— E) invalidação multi-device via task doc —');
{
  const key = 'taskSint01|des01|dl0|cp1';
  const { o, calls, tasks } = mk('active', { task: { executionTracking: { lastCheckin: { key, state: 'RESPONDED', checkpointIndex: 1, deadlineVersion: 0, responseType: 'sim' }, timeline: [] } } });
  o.evaluate(); await flush();
  ok('E1 lastCheckin RESPONDED no snapshot ⇒ onRemoteClose(chave) fecha superfície local', calls.closes.length === 1 && calls.closes[0] === key);
  o.evaluate(); await flush();
  ok('E2 fechamento remoto é idempotente (1 única invalidação)', calls.closes.length === 1);
}
console.log('— F) contratos estáticos do wiring —');
{
  const sched = R('src/main/taskIdleScheduler.ts');
  ok('F1 hooks opcionais no scheduler (execution?: legacyGate/onTasks/onEvaluate/extraBoundary)', /execution\?: \{/.test(sched) && /legacyGate\?:/.test(sched) && /extraBoundary\?:/.test(sched));
  ok('F2 autoridade única no evalDue (legacyGate false ⇒ return antes de emitir)', sched.includes('exec.legacyGate(task) === false') && sched.indexOf('exec.legacyGate(task) === false') < sched.indexOf('buildCheckinPayload(task, elig, t0)'));
  ok('F3 onEvaluate no MESMO tick, ANTES do gate da flag legada', sched.indexOf('exec.onEvaluate()') < sched.indexOf('isEnabled()) { log("task.idle.feature_disabled"'));
  ok('F4 boundary integrado ao MESMO arm() (extraBoundary)', sched.includes('exec.extraBoundary && Number(exec.extraBoundary())'));
  ok('F5 mesmo mapa/listener (onTasks no snapshot + boot; sem 2º fbListen no orquestrador)', (sched.match(/exec\.onTasks\(tasks\)/g) || []).length === 2 && !R('src/main/executionOrchestrator.ts').includes('fbListen'));
  const mainSrc = R('src/main/main.ts');
  ok('F6 URLs oficiais run.app dos 2 endpoints (overrides só p/ testes)', mainSrc.includes('claimexecutioncheckpoint-de36pi7vza-uc.a.run.app') && mainSrc.includes('respondexecutioncheckpoint-de36pi7vza-uc.a.run.app'));
  ok('F7 deviceHash = sha256(userData) truncado (nunca caminho em claro)', mainSrc.includes('crypto.createHash("sha256").update(app.getPath("userData")).digest("hex").slice(0, 32)'));
  ok('F8 escrita da config SÓ Admin autenticado (server-verified)', mainSrc.includes('au.admin !== true) { diag("execution.cfg.denied_not_admin"'));
  ok('F9 mensagem LITERAL da jornada incompleta no set de ACTIVE', mainSrc.includes('Conclua a configuração da jornada antes de ativar os check-ins.'));
  ok('F10 default OFF pós-update (ET_CFG_DEFAULTS.mode="off")', /mode: "off", sectors: \[\]/.test(mainSrc));
  const ac = R('src/main/auth-core.ts');
  ok('F11 postAuthed confinado ao auth-core (token nunca sai; 401 não derruba sessão)', ac.includes('async postAuthed(url: string, body: unknown)') && ac.includes('if (r.status === 401) return { ok: false, status: 401, error: "invalid_session"'));
  ok('F12 wav laranja empacotado e SLA wavs APROVADOS intactos (sha256)',
    crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'sounds', 'sla-warning.wav'))).digest('hex') === '36145822e39ddb5552c9dcb58b312696875f3f24b28d4e51f7071813276cf508' &&
    crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'sounds', 'sla-critical.wav'))).digest('hex') === '7f465926cb2eeab96f913ed383687685339207e42b7a4ad2766aaf3f0e59e3aa' &&
    fs.statSync(path.resolve(__dirname, '..', 'src', 'renderer', 'sounds', 'execution-checkin.wav')).size > 1000);
  ok('F13 executionTracking.js copiado p/ dist (runtime do orquestrador)', R('scripts/copy-renderer.js').includes('"executionTracking.js"') && fs.existsSync(path.resolve(__dirname, '..', 'dist', 'main', 'executionTracking.js')));
}

console.log(`\nf355a-orquestrador: ${n - fail}/${n} verdes`);
if (fail) process.exit(1);
