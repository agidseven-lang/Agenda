#!/usr/bin/env node
/* =====================================================================================
 * I7.27.1-EXT — ESCALAÇÃO DE PRAZO PARA TAREFA NÃO INICIADA (designer accountability).
 * Dirige o slaScheduler.ts REAL (compilado) com o produtor REAL slaEscalationRules.js + o
 * controlador central REAL (dist/main/slaReminder.js) e o store REAL (arquivo temporário), com
 * RELÓGIO/TIMER/LISTENER/SEEN INJETADOS — nenhuma espera real de horas. O HUB é um espelho fiel do
 * roteamento do deliverNotification: classifyReminderLevel REAL decide central × toast.
 *
 * Matriz do mandato (§14) A..L + gates SLA-R1..R19 (§16). Saída (gitignored):
 *   desktop/qa-out-i7271/i7271ext-sla-events.json · i7271ext-sla-dedupe.json · i7271ext-listener-count.json
 * Exit 1 se qualquer gate falhar. Nunca fabrica PASS.
 * ===================================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path'; import Module from 'module';
import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const OUT = path.join(DESK, 'qa-out-i7271'); fs.mkdirSync(OUT, { recursive: true });
const REAL_SLARULES = path.join(DESK, 'src', 'main', 'slaRules.js');
const REAL_ESC = path.join(DESK, 'src', 'main', 'slaEscalationRules.js');
const REAL_NE = path.join(DESK, 'src', 'main', 'notifEvents.js');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c, info) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; flog.push(n); console.error('  ✗ ' + n + (info !== undefined ? ' :: ' + JSON.stringify(info) : '')); } };

/* ── compila slaScheduler.ts + slaReminder.ts + slaReminderStore.ts REAIS ── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i7271ext-'));
execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
  path.join(DESK, 'src', 'main', 'slaScheduler.ts'), path.join(DESK, 'src', 'main', 'slaReminder.ts'), path.join(DESK, 'src', 'main', 'slaReminderStore.ts'),
  '--outDir', tmp, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { app: null };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { listen: () => () => {} };
  if (request === './diag' || /[\\/]diag(\.js)?$/.test(request)) return { diag: () => {} };
  if (request === './slaRules' || /[\\/]slaRules(\.js)?$/.test(request)) return realLoad.call(this, REAL_SLARULES, arguments[1], false);
  if (request === './slaEscalationRules' || /[\\/]slaEscalationRules(\.js)?$/.test(request)) return realLoad.call(this, REAL_ESC, arguments[1], false);
  if (request === './notifEvents' || /[\\/]notifEvents(\.js)?$/.test(request)) return realLoad.call(this, REAL_NE, arguments[1], false);
  return realLoad.apply(this, arguments);
};
const { startSlaScheduler } = require(path.join(tmp, 'slaScheduler.js'));
const { createSlaReminderController, classifyReminderLevel } = require(path.join(tmp, 'slaReminder.js'));
const { createSlaReminderStore } = require(path.join(tmp, 'slaReminderStore.js'));
const ESC = require(REAL_ESC);
Module._load = realLoad;

const H = 3600000, MIN = 60000;
const T0 = Date.parse('2026-09-03T09:00:00');           // "agora" inicial (relógio injetado)
const DUE = T0 + 25 * H;                                  // prazo: +25h (A)

/* ── rig: scheduler REAL + controlador central REAL + HUB espelho ── */
function newRig(uid) {
  let NOW = T0;
  let pending = null, tid = 0, timersArmed = 0, listeners = 0;
  const seen = new Set();
  let listenCb = null;
  const toasts = [], central = [], events = [], delivered = [];
  const storeFile = path.join(os.tmpdir(), 'i7271ext-store-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.json');
  const store = createSlaReminderStore({ file: storeFile, log() {} });
  let open = false, curView = null; const surfaceCalls = [];
  const surface = { show(v) { open = true; curView = v; surfaceCalls.push(['show', v.kind, v.deadlineLevel, v.taskId, v.key]); }, promote(v) { curView = v; surfaceCalls.push(['promote', v.kind, v.deadlineLevel, v.taskId]); }, close() { open = false; curView = null; surfaceCalls.push(['close']); }, isOpen() { return open; }, native() { return true; } };
  const acks = [];
  const ctl = createSlaReminderController({ surface, store, now: () => NOW, onLog() {}, getUid: () => uid, onAcked: (i) => acks.push(i), decisionsEnabled: () => true });
  // HUB espelho do deliverNotification: sla_* ⇒ central (classifyReminderLevel REAL); demais ⇒ toast/premium
  const hub = (p) => {
    const lvl = classifyReminderLevel(p);
    let r;
    if (lvl) { r = ctl.enqueue(p); central.push({ dedupKey: p.dedupKey, eventType: p.eventType, level: lvl, channel: r.channel }); }
    else { toasts.push({ dedupKey: p.dedupKey, eventType: p.eventType, severity: p.severity }); r = { ok: true, channel: 'toast' }; }
    delivered.push({ dedupKey: p.dedupKey, eventType: p.eventType, channel: r.channel, taskId: p.taskId, recipientId: p.targetUserId, threshold: p.slaThreshold, dueAt: p.dueAtMs, idleSince: p.idleSinceMs, createdAt: p.createdAt, nowMs: NOW });
    events.push({ taskId: p.taskId, assigneeId: p.targetUserId, dueAt: p.dueAtMs, idleSince: p.idleSinceMs, threshold: p.slaThreshold, eventId: p.eventId, semanticKey: p.dedupKey, createdAt: p.createdAt, shownAt: NOW, recipientId: p.targetUserId, channel: r.channel });
    return r;
  };
  const sched = startSlaScheduler(() => uid, hub, {
    cardsRules: { cardsEmissionsFor: () => [], cardsNextBoundaryMs: () => 0 },
    escalationRules: ESC,   // o produtor REAL (slaEscalationRules.js) — injeção explícita (o require rígido resolve no tmp do tsc)
    now: () => NOW,
    listen: (name, cb) => { listeners++; if (name === 'tasks') listenCb = cb; return () => {}; },
    seen: { has: (k) => seen.has(k), add: (k) => seen.add(k) },
    setTimer: (fn, ms) => { timersArmed++; pending = { fn, ms, id: ++tid }; return pending; },
    clearTimer: (h) => { if (pending && h && pending.id === h.id) pending = null; },
    onLog() {}, safetyMaxMs: 60000,
  });
  const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
  return {
    sched, ctl, store, toasts, central, events, delivered, acks, seen, surfaceCalls,
    view: () => curView, isOpen: () => open,
    setNow: (n) => { NOW = n; }, now: () => NOW,
    fireSnap: (changes) => { if (listenCb) listenCb({ docChanges: () => changes }); },
    fireTimer: () => { const p = pending; if (p) { pending = null; p.fn(); } },
    pendingTimer: () => pending, timersArmed: () => timersArmed, listeners: () => listeners,
    // avança o relógio até t e "acorda" o scheduler pelo timer único (como o Electron faria)
    advanceTo: (t) => { NOW = t; const p = pending; if (p) { pending = null; p.fn(); } },
    ch, storeFile,
  };
}
const mkTask = (id, extra) => Object.assign({
  id, title: 'CEO / SETEMBRO', client: 'CEO', sector: 'cronograma', status: 'afazer', designerFlowStatus: 'afazer',
  dueAt: DUE, createdAt: T0 - 3 * 86400000, by: 'owner', assigneeId: 'boaz', // estado REAL do produto: enviar ao designer grava assigneeId=designerId (index.html L11224)
  designerAssignment: { designerId: 'boaz', designerName: 'Boaz', status: 'sent', assignedAt: T0 - 2 * 86400000, assignedBy: 'owner' },
}, extra || {});

console.log('— §14 matriz A..L (relógio injetado; scheduler REAL; controlador REAL) —');
const R = newRig('boaz');
R.fireSnap([R.ch('added', 't1', mkTask('t1'))]);
/* A — dueAt = +25h ⇒ zero warning */
ok('A  dueAt=+25h ⇒ zero alerta (SLA-R3 pré-condição)', R.delivered.length === 0, R.delivered);
ok('SLA-R1 ONE watcher: 1 listener Firestore + 1 timer único armado', R.listeners() === 1 && !!R.pendingTimer(), { listeners: R.listeners(), timer: !!R.pendingTimer() });
const armed0 = R.timersArmed();
/* B — cross +24h ⇒ 1 WARNING (toast/premium; NÃO central) */
R.advanceTo(DUE - 24 * H + 1000);
ok('B  cruzar T-24h ⇒ 1 WARNING (deadline_warning, toast/premium, severidade warning)', R.delivered.length === 1 && R.delivered[0].eventType === 'deadline_warning' && R.toasts.length === 1 && R.central.length === 0 && R.toasts[0].severity === 'warning', R.delivered);
ok('SLA-R3 threshold 24h = exatamente um evento', R.delivered.filter((d) => d.threshold === 'T_MINUS_24H').length === 1);
/* C — repetir avaliação ⇒ continua 1 */
R.advanceTo(DUE - 23 * H); R.sched.reconcile('re'); R.advanceTo(DUE - 20 * H);
ok('C  reavaliações repetidas (timer + reconcile) ⇒ NÃO duplica (continua 1)', R.delivered.length === 1, R.delivered.length);
ok('SLA-R7 mesmo threshold nunca repete (seen-store semântico)', R.delivered.length === 1);
/* D — cross +6h ⇒ 1 HIGH RISK novo */
R.advanceTo(DUE - 6 * H + 1000);
ok('D  cruzar T-6h ⇒ 1 HIGH RISK novo (deadline_high_risk, toast/premium)', R.delivered.length === 2 && R.delivered[1].eventType === 'deadline_high_risk' && R.toasts.length === 2 && R.central.length === 0, R.delivered.map((d) => d.eventType));
ok('SLA-R4 threshold 6h = exatamente um evento', R.delivered.filter((d) => d.threshold === 'T_MINUS_6H').length === 1);
/* E — repeat ⇒ não duplica */
R.advanceTo(DUE - 5 * H); R.sched.reconcile('re2'); R.advanceTo(DUE - 3 * H);
ok('E  repetir ⇒ não duplica (2)', R.delivered.length === 2, R.delivered.length);
/* F — cross +2h ⇒ CENTRAL CRITICAL 1x */
R.advanceTo(DUE - 2 * H + 1000);
ok('F  cruzar T-2h ⇒ ALERTA CENTRAL CRÍTICO 1x (sla_deadline_critical → janela central; view kind=deadline)',
  R.delivered.length === 3 && R.delivered[2].eventType === 'sla_deadline_critical' && R.central.length === 1 && R.central[0].channel === 'sla-central' && R.isOpen() && R.view() && R.view().kind === 'deadline' && R.view().deadlineLevel === 'critical' && R.view().title === 'PRAZO EM RISCO',
  { delivered: R.delivered.map((d) => d.eventType), central: R.central, view: R.view() && { kind: R.view().kind, lvl: R.view().deadlineLevel, title: R.view().title } });
ok('SLA-R5 threshold 2h = exatamente um evento', R.delivered.filter((d) => d.threshold === 'T_MINUS_2H').length === 1);
ok('SLA-R12 alerta central crítico exibido (surface.show com view de prazo)', R.surfaceCalls.some((c) => c[0] === 'show' && c[1] === 'deadline'));
ok('SLA-R8 destinatário = designer responsável atual (recipientId boaz em 3/3)', R.delivered.every((d) => d.recipientId === 'boaz'));
R.advanceTo(DUE - 1.5 * H); R.advanceTo(DUE - 1 * H);
ok('F2 reavaliar dentro da janela crítica ⇒ ainda 1 central (não reabre/duplica)', R.central.length === 1 && R.delivered.length === 3);
/* G — acknowledge ⇒ fecha; tarefa segue em risco */
const critKey = R.delivered[2].dedupKey;
const ackOk = R.ctl.ack(critKey, 'reminder');
ok('G  "Entendi" (ack) ⇒ fecha o alerta; recibo persistido; NENHUMA mutação da tarefa; risco continua (elegível)',
  ackOk && !R.isOpen() && R.store.isAcked(critKey) && R.acks.length === 1 && R.acks[0].kind === 'deadline' && ESC.isEscalationEligible(mkTask('t1'), R.now()).eligible === true, { ackOk, open: R.isOpen(), acked: R.store.isAcked(critKey) });
ok('SLA-R15 ack não altera status/prazo/responsável (task doc inalterado; só recibo local)', ESC.isEscalationEligible(mkTask('t1'), R.now()).status === 'afazer');
R.advanceTo(DUE - 30 * MIN); R.sched.reconcile('re3');
ok('G2 após "Entendi", sem novo threshold ⇒ nada reaparece (sem spam)', R.central.length === 1 && R.delivered.length === 3 && !R.isOpen());
/* I — deadline passes ⇒ OVERDUE 1x (central) */
R.advanceTo(DUE + 36 * MIN);
ok('I  prazo vencido sem movimento ⇒ OVERDUE 1x (sla_deadline_overdue → central; view PRAZO VENCIDO)',
  R.delivered.length === 4 && R.delivered[3].eventType === 'sla_deadline_overdue' && R.central.length === 2 && R.isOpen() && R.view().deadlineLevel === 'overdue' && R.view().title === 'PRAZO VENCIDO', R.delivered.map((d) => d.eventType));
ok('SLA-R6 overdue = exatamente um evento', R.delivered.filter((d) => d.threshold === 'OVERDUE').length === 1);
R.advanceTo(DUE + 2 * H); R.sched.reconcile('re4');
ok('I2 vencido reavaliado ⇒ não duplica (1 overdue)', R.delivered.filter((d) => d.threshold === 'OVERDUE').length === 1);
/* H — move A Fazer → Em andamento ⇒ future alerts cancelados + central invalidado */
R.ctl.ack(R.delivered[3].dedupKey);
const R2 = newRig('boaz');
R2.fireSnap([R2.ch('added', 'h1', mkTask('h1'))]);
R2.advanceTo(DUE - 2 * H + 1000);
ok('H0 (setup) crítico em tela', R2.central.length === 1 && R2.isOpen());
const moved = mkTask('h1', { designerFlowStatus: 'andamento', status: 'andamento', startedAt: R2.now(), designerSla: { startedAt: R2.now() } });
R2.fireSnap([R2.ch('modified', 'h1', moved)]);
// o main aplica invalidateDeadline no watch de tasks (espelhado aqui como o main.ts faz)
const elH = ESC.isEscalationEligible(moved, R2.now()); if (!elH.eligible) R2.ctl.invalidateDeadline('h1', elH.reason === 'started' ? 'started' : elH.reason);
ok('H  mover A Fazer → Em andamento ⇒ alerta ativo INVALIDADO (aviso "já foi iniciada", sem decisões) e nenhuma emissão futura',
  R2.view() && R2.view().deadlineClosed === true && /iniciada/.test(R2.view().body) && elH.reason === 'started', { reason: elH.reason, view: R2.view() && R2.view().body });
R2.advanceTo(DUE + 10 * MIN); R2.sched.reconcile('after-move');
ok('SLA-R9 movimento cancela a escalação (0 novos eventos após o move; sem overdue)', R2.delivered.length === 1, R2.delivered.map((d) => d.eventType));
/* J — change designer ⇒ old designer não recebe novos alerts; novo recebe a sequência dele */
const R3 = newRig('boaz');
R3.fireSnap([R3.ch('added', 'j1', mkTask('j1'))]);
R3.advanceTo(DUE - 24 * H + 1000);
ok('J0 (setup) warning entregue ao boaz', R3.delivered.length === 1 && R3.delivered[0].recipientId === 'boaz');
const reassigned = mkTask('j1', { assigneeId: 'ana', designerAssignment: { designerId: 'ana', designerName: 'Ana', status: 'sent', assignedAt: R3.now(), assignedBy: 'owner' } });
R3.fireSnap([R3.ch('modified', 'j1', reassigned)]);
R3.advanceTo(DUE - 6 * H + 1000); R3.advanceTo(DUE - 2 * H + 1000); R3.advanceTo(DUE + 5 * MIN);
ok('J  trocar designer ⇒ o antigo (boaz, logado) NÃO recebe mais alertas desta tarefa', R3.delivered.length === 1, R3.delivered.map((d) => d.eventType + '@' + d.recipientId));
const R3b = newRig('ana');
R3b.fireSnap([R3b.ch('added', 'j1', reassigned)]);
R3b.advanceTo(DUE - 2 * H + 1000);
ok('J2 o NOVO designer (ana) recebe a sequência dele (banda atual: crítico central)', R3b.delivered.length === 1 && R3b.delivered[0].recipientId === 'ana' && R3b.delivered[0].eventType === 'sla_deadline_critical' && R3b.isOpen());
ok('SLA-R10 troca de responsável reseta corretamente (chaves por uid; antigo silencia; novo recebe)', R3.delivered.length === 1 && R3b.delivered.length === 1);
/* K — change due date ⇒ thresholds recalculados */
const R4 = newRig('boaz');
R4.fireSnap([R4.ch('added', 'k1', mkTask('k1'))]);
R4.advanceTo(DUE - 2 * H + 1000);
ok('K0 (setup) crítico central para o prazo original', R4.central.length === 1 && R4.isOpen());
const DUE2 = DUE + 48 * H;
const rescheduled = mkTask('k1', { dueAt: DUE2 });
R4.fireSnap([R4.ch('modified', 'k1', rescheduled)]);
const elK = ESC.isEscalationEligible(rescheduled, R4.now()); R4.ctl.invalidateDeadline('k1', 'due_changed', elK.dueAtMs);
ok('K  mudar prazo ⇒ alerta do prazo antigo invalidado ("prazo mudou") e thresholds recalculados (próximo marco = novo T-24h)',
  R4.view() && R4.view().deadlineClosed === true && /prazo/.test(R4.view().body) && R4.pendingTimer() && (ESC.escalationNextBoundaryMs(rescheduled, R4.now()) === DUE2 - 24 * H), { boundary: ESC.escalationNextBoundaryMs(rescheduled, R4.now()) - (DUE2 - 24 * H) });
R4.advanceTo(DUE + 1 * H); R4.sched.reconcile('old-due-passed');
ok('K2 o prazo ANTIGO passar não gera overdue (chave é do novo dueAt)', R4.delivered.length === 1);
R4.advanceTo(DUE2 - 24 * H + 1000);
ok('K3 novo T-24h ⇒ 1 warning com o NOVO dueAt (SLA-R11)', R4.delivered.length === 2 && R4.delivered[1].eventType === 'deadline_warning' && R4.delivered[1].dueAt === DUE2);
/* L — 5 tasks diferentes ⇒ notificações independentes + fila central sem sobreposição */
const R5 = newRig('boaz');
R5.fireSnap(['a', 'b', 'c', 'd', 'e'].map((id) => R5.ch('added', 'L' + id, mkTask('L' + id, { title: 'Tarefa ' + id }))));
R5.advanceTo(DUE - 2 * H + 1000);
ok('L  5 tarefas distintas cruzam T-2h ⇒ 5 eventos independentes (1 por tarefa)', R5.delivered.length === 5 && new Set(R5.delivered.map((d) => d.taskId)).size === 5, R5.delivered.map((d) => d.taskId));
ok('§18 FILA: UM alerta central visível por vez; os demais enfileirados (pendentes 5 = 1 ativo + 4 na fila; 1 chave exibida)', R5.isOpen() && R5.ctl.status().queueLen === 5 && new Set(R5.surfaceCalls.filter((c) => c[0] === 'show').map((c) => c[4])).size === 1, { status: R5.ctl.status(), shownKeys: new Set(R5.surfaceCalls.filter((c) => c[0] === 'show').map((c) => c[4])).size });
const firstKey = R5.view().key; R5.ctl.ack(firstKey);
ok('§18 ao reconhecer, o PRÓXIMO da fila aparece (sem modais sobrepostos)', R5.isOpen() && R5.view().key !== firstKey && R5.ctl.status().queueLen === 4, R5.ctl.status());
ok('SLA-R2 contagem de listeners/timers estável em 5 rigs (1 listener cada; timer único reagendado)', [R, R2, R3, R3b, R4, R5].every((r) => r.listeners() === 1 && (r.pendingTimer() === null || !!r.pendingTimer())));

console.log('— roteamento / recipient / dedupe estático —');
const sample = ESC.escalationEmissionsFor(mkTask('s1'), 'boaz', DUE - 1 * H)[0];
ok('SLA-R14 "Abrir tarefa" aponta para a MESMA tarefa (deep detail/<taskId>)', sample.action && sample.action.deep === 'detail/s1' && sample.taskId === 's1');
ok('ROUTE níveis 1/2 fora do prefixo sla_ (toast/premium) e 3/4 com sla_ (central)', classifyReminderLevel(ESC.escalationEmissionsFor(mkTask('s1'), 'boaz', DUE - 20 * H)[0]) === null && classifyReminderLevel(ESC.escalationEmissionsFor(mkTask('s1'), 'boaz', DUE - 5 * H)[0]) === null && classifyReminderLevel(sample) === 'critical' && classifyReminderLevel(ESC.escalationEmissionsFor(mkTask('s1'), 'boaz', DUE + 60000)[0]) === 'critical');
ok('RECIPIENT outro usuário (social media logado) NÃO recebe a cobrança do designer', ESC.escalationEmissionsFor(mkTask('s1'), 'owner', DUE - 1 * H).length === 0);
ok('CTX-R8/R10 doc DIVERGENTE (designerAssignment=boaz mas assigneeId=owner ⇒ invisível p/ boaz em Hoje/KPI/Meu quadro) ⇒ NÃO elegível (not_visible_to_designer)', ESC.escalationEmissionsFor(mkTask('s1', { assigneeId: 'owner' }), 'boaz', DUE - 1 * H).length === 0 && ESC.isEscalationEligible(mkTask('s1', { assigneeId: 'owner' }), DUE - 1 * H).reason === 'not_visible_to_designer');
ok('ELEGIBILIDADE: iniciada ⇒ 0; concluída ⇒ 0; sem designer ⇒ 0; edicao_cards (regime T-30/T-10 próprio) ⇒ 0; aguardando cliente ⇒ 0',
  ESC.escalationEmissionsFor(mkTask('s1', { designerFlowStatus: 'andamento' }), 'boaz', DUE - 1 * H).length === 0
  && ESC.escalationEmissionsFor(mkTask('s1', { status: 'concluido' }), 'boaz', DUE - 1 * H).length === 0
  && ESC.escalationEmissionsFor(mkTask('s1', { designerAssignment: null }), 'boaz', DUE - 1 * H).length === 0
  && ESC.escalationEmissionsFor(mkTask('s1', { sector: 'edicao_cards' }), 'boaz', DUE - 1 * H).length === 0
  && ESC.escalationEmissionsFor(mkTask('s1', { workflowPhase: 'themes_waiting_client' }), 'boaz', DUE - 1 * H).length === 0);
ok('BOOT tardio (app abre já dentro de T-2h): só a banda ATUAL (crítico), sem catch-up de 24h/6h', (() => { const r = newRig('boaz'); r.setNow(DUE - 1 * H); r.fireSnap([r.ch('added', 'b1', mkTask('b1'))]); return r.delivered.length === 1 && r.delivered[0].eventType === 'sla_deadline_critical'; })());
ok('§13 textos objetivos (sem linguagem hostil): body/context dos 4 níveis', ['warning', 'high', 'critical', 'overdue'].every((lv) => { const tx = ESC.textsFor(lv, DUE, lv === 'overdue' ? DUE + 36 * MIN : DUE - (lv === 'warning' ? 24 : lv === 'high' ? 6 : 2) * H); return /não foi iniciada/.test(tx.body) && !/falhou|cobrad/i.test(tx.body + tx.title); }));
ok('§13 "Prazo vencido há 36min" / "faltam 1h 48min" formatações', ESC.textsFor('overdue', DUE, DUE + 36 * MIN).context === 'Prazo vencido há 36min' && ESC.textsFor('critical', DUE, DUE - 108 * MIN).context === 'Prazo crítico · faltam 1h 48min');
ok('SEMANTIC KEY = taskId + assignee + threshold + dueAt', sample.dedupKey === 'sla_deadline:critical:s1:boaz:' + DUE);
ok('§20 evento carrega taskId/assigneeId/dueAt/idleSince/threshold/eventId/semanticKey/createdAt/recipientId', ['taskId', 'targetUserId', 'dueAtMs', 'idleSinceMs', 'slaThreshold', 'eventId', 'dedupKey', 'createdAt', 'recipientUid'].every((k) => sample[k] !== undefined && sample[k] !== ''));
ok('SLA-R16 detecção sem navegação: eventos nascem do timer/listener do main (nenhuma chamada de UI)', R.delivered.length === 4 && R.delivered.every((d) => d.channel));

/* ── evidência §20 ── */
fs.writeFileSync(path.join(OUT, 'i7271ext-sla-events.json'), JSON.stringify({ phase: 'I7.27.1-EXT', t0: T0, dueAt: DUE, rigA: R.events, rigL: R5.events, at: new Date().toISOString() }, null, 1));
fs.writeFileSync(path.join(OUT, 'i7271ext-sla-dedupe.json'), JSON.stringify({
  semanticKeyFormat: 'sla_deadline:<level>:<taskId>:<assigneeId>:<dueAtMs>',
  rigA: { thresholdsCrossed: ['T_MINUS_24H', 'T_MINUS_6H', 'T_MINUS_2H', 'OVERDUE'], evaluations: 'timer+reconcile repetidos', deliveries: R.delivered.length, duplicates: R.delivered.length - new Set(R.delivered.map((d) => d.dedupKey)).size, seenKeys: [...R.seen] },
  rigMove: { deliveries: R2.delivered.length, afterMove: 0 }, rigAssignee: { old: R3.delivered.length, new: R3b.delivered.length }, rigDue: { deliveries: R4.delivered.length, keys: R4.delivered.map((d) => d.dedupKey) },
  centralQueue: { fiveTasks: R5.central.length, visibleAtOnce: 1 },
}, null, 1));
fs.writeFileSync(path.join(OUT, 'i7271ext-listener-count.json'), JSON.stringify({ rigs: [R, R2, R3, R3b, R4, R5].map((r, i) => ({ rig: i, firestoreListeners: r.listeners(), timerArmedCount: r.timersArmed(), timerPendingNow: !!r.pendingTimer() })), rule: 'ONE watcher (slaScheduler): 1 listener + 1 timer único reagendável ≤60s; produtor de escalação NÃO cria listener/timer' }, null, 1));
for (const r of [R, R2, R3, R3b, R4, R5]) { try { r.sched.stop(); r.ctl.stop(); fs.unlinkSync(r.storeFile); } catch { /* */ } }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ }
console.log('\nF7271EXT-SLA-ESCALATION: PASS=' + pass + ' FAIL=' + fail);
if (fail) { console.error(flog.join('\n')); process.exit(1); }
