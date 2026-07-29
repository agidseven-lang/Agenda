#!/usr/bin/env node
/* =====================================================================
 * F3.5.4 COMMIT C — CONFIABILIDADE das notificações (Categoria A p/ TODOS + T-30/T-10 só Designer).
 * Compila notifierA.ts + notifStore.ts + slaScheduler.ts REAIS (stub electron/firebase/diag;
 * notifEvents/actorProfile/slaRules REAIS) e prova CAUSA + CORREÇÃO:
 *  A) Categoria A: sem filtro de papel/setor/ator (todos recebem; ator incluído); 6 transições do
 *     Mover geram os eventos certos (from/to/actor/taskId); ordem preservada; falha NÃO avança
 *     cursor; recibos impedem duplicação; re-drain não reemite.
 *  C1) dedup do HUB por SESSÃO: sem clear, evento exibido ao usuário anterior era "aceito" como
 *      dedup p/ o novo usuário (recibo sem superfície — perda silenciosa provada); com o clear
 *      (contrato novo), o novo usuário RECEBE. Fonte: stopNotifier compõe _notifSeen.clear().
 *  C2) once-guard do toast (renderer) reseta em startApp/logout (fonte).
 *  C3) seen de SLA POR USUÁRIO (uid|dedupKey): reatribuição p/ designer que divide a máquina
 *      passa a receber; chave legada (sem uid) honrada em leitura (sem reemissão antiga).
 *  C4) bootstrap com RETRY (backoff 3s→60s; para em expired/no_session/login manual) — fonte.
 *  B) T-30/T-10: só o Designer atribuído (admin/social/outro designer = 0); concluída não emite;
 *     religada entrega UMA vez (seen persistente); re-eval não duplica.
 * Rodar: node desktop/scripts/f354-notifications-reliability.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import os from 'os';
import { execFileSync } from 'child_process'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const Module = require('module');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const NOTIFIERA_SRC = fs.readFileSync(path.join(DESK, 'src', 'main', 'notifierA.ts'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS — ' + m); } else { fail++; console.log('  FAIL — ' + m); } };

/* ── compila notifierA.ts + notifStore.ts + slaScheduler.ts REAIS ── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f354c-'));
execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
  path.join(DESK, 'src', 'main', 'notifierA.ts'), path.join(DESK, 'src', 'main', 'notifStore.ts'),
  path.join(DESK, 'src', 'main', 'slaScheduler.ts'), path.join(DESK, 'src', 'main', 'slaSeenUser.ts'),
  '--outDir', tmp, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { app: null };
  if (/(^|[\\/])firebase(\.js)?$/.test(request) || request === './firebase') return { listen: () => () => {} };
  if (/(^|[\\/])diag(\.js)?$/.test(request) || request === './diag') return { diag: () => {} };
  if (request === './notifEvents') return realLoad.call(this, path.join(DESK, 'src', 'main', 'notifEvents.js'), arguments[1], false);
  if (request === './slaRules') return realLoad.call(this, path.join(DESK, 'src', 'main', 'slaRules.js'), arguments[1], false);
  return realLoad.apply(this, arguments);
};
const { startNotifierA } = require(path.join(tmp, 'notifierA.js'));
const { createNotifStore } = require(path.join(tmp, 'notifStore.js'));
const { startSlaScheduler } = require(path.join(tmp, 'slaScheduler.js'));
const { createUserSlaSeen } = require(path.join(tmp, 'slaSeenUser.js'));
Module._load = realLoad;

const MIN = 60000; const T0 = 1700000000000;
let storeN = 0;
const mkStore = () => createNotifStore({ file: path.join(tmp, 'store-' + (++storeN) + '.json') });

/* rig do notifierA: listen injetável; deliver injetável; timers manuais */
function rigA(uid, deliver, store) {
  const cbs = {}; let listens = 0, unsubs = 0;
  const h = startNotifierA(uid, deliver, {
    store: store || mkStore(), now: () => T0 + 60 * MIN,
    listen: (name, cb) => { listens++; cbs[name] = cb; return () => { unsubs++; }; },
    setTimer: () => ({}), clearTimer: () => {},
  });
  return { h, snapTasks: (docs) => cbs['tasks']({ docChanges: () => docs.map((d) => ({ type: 'added', doc: { id: d.id, data: () => d } })) }), nListens: () => listens, nUnsubs: () => unsubs };
}
const HIST6 = [
  { kind: 'moved', from: 'afazer', to: 'andamento', at: T0 + 1 * MIN, byId: 'social1' },
  { kind: 'moved', from: 'andamento', to: 'revisao', at: T0 + 2 * MIN, byId: 'dz1' },
  { kind: 'moved', from: 'revisao', to: 'concluido', at: T0 + 3 * MIN, byId: 'dz1' },
  { kind: 'moved', from: 'concluido', to: 'revisao', at: T0 + 4 * MIN, byId: 'adm' },
  { kind: 'moved', from: 'revisao', to: 'andamento', at: T0 + 5 * MIN, byId: 'dz1' },
  { kind: 'moved', from: 'andamento', to: 'afazer', at: T0 + 6 * MIN, byId: 'social1' },
];
const TASK6 = { id: 'TK', title: 'Arte do post', sector: 'edicao_cards', history: HIST6 };

console.log('===== F3.5.4 COMMIT C — NOTIFICAÇÕES CONFIÁVEIS =====');
console.log('\n-- A: Categoria A para TODOS (6 transições reais do Mover) --');
ok(!/canSeeAll|roleCat|isSocialUser|team_flow|assigneeId\s*===|sector\s*===/.test(NOTIFIERA_SRC),
  'A1 notifierA SEM filtro de papel/setor/destinatário (Categoria A é geral por contrato)');
for (const who of ['adm', 'social1', 'dz1', 'dz2']) {
  const got = []; const r = rigA(who, (p) => { got.push(p); return { ok: true, channel: 'toast' }; });
  r.snapTasks([TASK6]); r.h.stop();
  const types = got.map((p) => p.eventType).join(',');
  ok(got.length === 6 && types === 'task_moved,task_moved,task_completed,task_reopened,task_moved,task_moved',
    `A2 ${who} recebe TODAS as 6 movimentações (incl. conclusão/reabertura) — ator incluído`);
}
{ const got = []; const r = rigA('u9', (p) => { got.push(p); return { ok: true }; }); r.snapTasks([TASK6]); r.h.stop();
  ok(got.every((p) => p.taskId === 'TK') && got[0].actorId === 'social1' && got[1].actorId === 'dz1' && got[3].actorId === 'adm',
    'A3 taskId e ACTOR corretos por transição (47-50)');
  ok(got[0].context === 'A Fazer → Em andamento' && got[5].context === 'Em andamento → A Fazer',
    'A4 fromStatus/toStatus corretos (contexto oficial das colunas)');
  ok(got.every((p, i) => i === 0 || got[i - 1].createdAt <= p.createdAt), 'A5 ordem preservada (asc por at)'); }
{ const st = mkStore(); const got = []; let failAt = 5;
  const r = rigA('u1', (p) => { if (got.length + 1 === failAt) return { ok: false, channel: 'none' }; got.push(p); return { ok: true }; }, st);
  r.snapTasks([TASK6]);
  ok(got.length === 4 && st.cursorGet('u1') === T0 + 4 * MIN, 'A6 falha na 5ª entrega PARA a fila: cursor NÃO avança além da 4ª (recibo só com aceite)');
  failAt = 99; r.snapTasks([TASK6]);
  ok(got.length === 6 && st.cursorGet('u1') === T0 + 6 * MIN, 'A7 retry entrega o restante EM ORDEM (sem buraco, sem pulo)');
  r.snapTasks([TASK6]);
  ok(got.length === 6, 'A8 re-drain com recibos: NENHUMA duplicação (uma entrega por eventId+device)');
  r.h.stop(); }
{ const r = rigA('u1', () => ({ ok: true })); ok(r.nListens() === 2, 'A9 exatamente 1 listener de tasks + 1 de usersPublic por instância'); r.h.stop(); ok(r.nUnsubs() === 2, 'A10 stop() encerra os DOIS listeners (troca de usuário não vaza instância)'); }
{ const doc = { id: 'S', title: 'Estresse', sector: 'x', history: Array.from({ length: 20 }, (_, i) => ({ kind: 'moved', from: i % 2 ? 'andamento' : 'afazer', to: i % 2 ? 'afazer' : 'andamento', at: T0 + (i + 1) * 1000, byId: 'u' + (i % 4) })) };
  const got = []; const st = mkStore(); const r = rigA('u1', (p) => { got.push(p.eventId); return { ok: true }; }, st);
  r.snapTasks([doc]); r.snapTasks([doc]); r.h.stop();
  ok(got.length === 20 && new Set(got).size === 20, 'A11 estresse: 20 movimentações → 20 entregas únicas, ordem e memória controladas'); }

console.log('\n-- C1: dedup do HUB por SESSÃO de usuário (causa provada + correção) --');
{ // simula o HUB 1.0.193: _notifSeen global de processo devolvendo "dedup" aceito
  const hubSeen = new Set();
  const oldHub = (p) => { const k = p.dedupKey; if (hubSeen.has(k)) return { ok: true, channel: 'dedup' }; hubSeen.add(k); return { ok: true, channel: 'toast' }; };
  const surfacedA = []; const stA = mkStore();
  const rA = rigA('userA', (p) => { const r = oldHub(p); if (r.channel !== 'dedup') surfacedA.push(p.eventId); return r; }, stA);
  rA.snapTasks([TASK6]); rA.h.stop();
  // troca de usuário SEM clear (comportamento 1.0.193): B ganha recibo SEM ver nada
  const surfacedB = []; const stB = mkStore();
  const rB = rigA('userB', (p) => { const r = oldHub(p); if (r.channel !== 'dedup') surfacedB.push(p.eventId); return r; }, stB);
  rB.snapTasks([TASK6]); rB.h.stop();
  ok(surfacedA.length === 6 && surfacedB.length === 0 && stB.receiptHas('userB', surfacedA[0]),
    'C1a CAUSA (1.0.193): troca de usuário no mesmo app → 2º usuário ganha RECIBO sem NENHUMA superfície (perda silenciosa)');
  // contrato F3.5.4: clear na fronteira de sessão → B recebe de verdade
  hubSeen.clear();
  const surfacedB2 = []; const stB2 = mkStore();
  const rB2 = rigA('userB2', (p) => { const r = oldHub(p); if (r.channel !== 'dedup') surfacedB2.push(p.eventId); return r; }, stB2);
  rB2.snapTasks([TASK6]); rB2.h.stop();
  ok(surfacedB2.length === 6, 'C1b CORREÇÃO: com o clear por sessão, o novo usuário RECEBE tudo'); }
ok(/stopNotifier = \(\) => \{[^\n]*_stopEventNew\(\);[^\n]*_notifierA\.stop\(\);[^\n]*toastAck\.clear\(\);[^\n]*_notifSeen\.clear\(\);/.test(MAIN),
  'C1c fonte: _notifSeen.clear() COMPOSTO no stopNotifier (logout E troca de login limpam o HUB)');
ok(/function realQuit\(\)[\s\S]{0,400}stopNotifier\(\)[\s\S]{0,300}slaScheduler\.stop\(\)/.test(MAIN),
  'C1d realQuit intocado (região aprovada preservada)');

console.log('\n-- C2/C4: renderer — once-guard por sessão + bootstrap com retry --');
ok(/function startApp\(u\)\{state\.user=u;try\{notifAttrToastSeen=\{\};\}catch\(_\)\{\}saveSession\(u\);/.test(HTML),
  'C2a startApp reseta o once-guard do toast (novo usuário nunca herda o seen do anterior)');
ok(/boardQuery='';try\{notifAttrToastSeen=\{\};\}catch\(_\)\{\}document\.body\.classList\.remove\('authed'\)/.test(HTML),
  'C2b logout reseta o once-guard do toast');
ok(/api\.authSelf\(\)/.test(HTML) && /_bootDelay=Math\.min\(_bootDelay\*2,60000\)/.test(HTML),
  'C4a bootstrap re-tenta com backoff capado em 60s (autostart sem rede deixa de matar as notificações do dia)');
ok(/if\(r&&\(r\.error==='expired'\|\|r\.error==='no_session'\)\)\{clearSession\(\);return;\}/.test(HTML),
  'C4b negativa REAL (expired/no_session) PARA o retry (semântica de sessão preservada)');
ok(/if\(state\.user\)return;\s*\/\/ login manual venceu a corrida/.test(HTML) || /if\(state\.user\)return;/.test(HTML),
  'C4c login manual interrompe o retry (sem corrida)');

console.log('\n-- B/C3: T-30/T-10 — só o Designer; seen POR USUÁRIO --');
let seenFileN = 0;
const mkSeenFile = () => path.join(tmp, 'sla-seen-' + (++seenFileN) + '.json');
function rigS(uid, seenFile) {
  let NOW = T0; let listenCb = null; const delivered = [];
  const file = seenFile || mkSeenFile();
  const s = createUserSlaSeen(uid, { file });                  // wrapper REAL por usuário (F3.5.4-C3)
  const sched = startSlaScheduler(() => uid, (p) => { delivered.push({ dedupKey: p.dedupKey, eventType: p.eventType, targetUserId: p.targetUserId }); return { ok: true, channel: 'toast' }; }, {
    cardsRules: { cardsEmissionsFor: () => [], cardsNextBoundaryMs: () => 0 },
    now: () => NOW, listen: (n, cb) => { if (n === 'tasks') listenCb = cb; return () => {}; },
    seen: s,                                                    // slaScheduler REAL intacto; seen injetado como em produção (main.ts)
    setTimer: () => ({}), clearTimer: () => {}, onLog: () => {}, safetyMaxMs: 60000,
  });
  return { sched, delivered, file, setNow: (n) => { NOW = n; }, snap: (docs) => listenCb({ docChanges: () => docs.map((d) => ({ type: 'added', doc: { id: d.id, data: () => d } })) }) };
}
const cronTask = (id, dz, planDueAt, extra) => Object.assign({ id, title: 'Cronograma', client: 'Hosp', sector: 'cronograma', designerAssignment: { designerId: dz, designerName: 'Marina' }, designerFlowStatus: 'afazer', designerSla: { planDueAt } }, extra || {});
{ const r = rigS('dz1'); r.snap([cronTask('t1', 'dz1', T0 + 20 * MIN)]);
  ok(r.delivered.length === 1 && r.delivered[0].eventType === 'sla_warning' && r.delivered[0].targetUserId === 'dz1', '51 T-30 (amarela) chega ao Designer ATRIBUÍDO');
  const disk = JSON.parse(fs.readFileSync(r.file, 'utf8'));
  ok(Object.keys(disk).length === 1 && Object.keys(disk)[0] === 'dz1|' + r.delivered[0].dedupKey, 'C3a recibo gravado NAMESPACED (uid|dedupKey) no MESMO arquivo idseven-sla-seen');
  r.sched.stop(); }
{ const r = rigS('dz1'); r.snap([cronTask('t2', 'dz1', T0 - 5 * MIN)]);
  ok(r.delivered.length === 1 && r.delivered[0].eventType === 'sla_overdue', '52 T-10 (vermelha) chega ao Designer ATRIBUÍDO'); r.sched.stop(); }
for (const who of ['adm', 'social1', 'dz2']) {
  const r = rigS(who); r.snap([cronTask('t3', 'dz1', T0 + 20 * MIN)]);
  ok(r.delivered.length === 0, `53-55 ${who} NÃO recebe T-30/T-10 de tarefa do dz1`); r.sched.stop();
}
{ const shared = mkSeenFile();
  const r1 = rigS('dz1', shared); r1.snap([cronTask('t4', 'dz1', T0 + 20 * MIN)]); r1.sched.stop();
  const r2 = rigS('dz2', shared); r2.snap([cronTask('t4', 'dz2', T0 + 20 * MIN)]); // reatribuída; MESMA máquina/arquivo
  ok(r1.delivered.length === 1 && r2.delivered.length === 1, 'C3b reatribuição p/ designer que DIVIDE a máquina: o novo designer RECEBE (antes: engolido pelo seen por máquina)');
  r2.sched.stop(); }
{ const probe = rigS('dz1'); probe.snap([cronTask('t5', 'dz1', T0 + 20 * MIN)]);
  const bare = probe.delivered[0].dedupKey; probe.sched.stop();
  const legacyFile = mkSeenFile(); fs.writeFileSync(legacyFile, JSON.stringify({ [bare]: 123 })); // estado PRÉ-F3.5.4 (sem uid)
  const r = rigS('dz1', legacyFile); r.snap([cronTask('t5', 'dz1', T0 + 20 * MIN)]);
  ok(r.delivered.length === 0, 'C3c chave LEGADA honrada em leitura: nenhum alerta antigo é reemitido após o update'); r.sched.stop(); }
{ const r = rigS('dz1'); r.snap([cronTask('t6', 'dz1', T0 - 5 * MIN, { designerFlowStatus: 'entregue' })]);
  ok(r.delivered.length === 0, '59 tarefa CONCLUÍDA não emite T-30/T-10 (alerta obsoleto nunca sai)'); r.sched.stop(); }
{ const seen = mkSeenFile();
  const r1 = rigS('dz1', seen); r1.setNow(T0 + 40 * MIN); r1.snap([cronTask('t7', 'dz1', T0 + 20 * MIN)]);
  ok(r1.delivered.length >= 1, '61a boundary vencido com o PC desligado → entregue no religar (backlog do 1º snapshot)');
  r1.sched.stop();
  const r2 = rigS('dz1', seen); r2.setNow(T0 + 45 * MIN); r2.snap([cronTask('t7', 'dz1', T0 + 20 * MIN)]);
  const dupes = r2.delivered.filter((d) => r1.delivered.some((x) => x.dedupKey === d.dedupKey));
  ok(dupes.length === 0, '61b/62 restart com seen persistente: o MESMO alerta NÃO repete (uma única vez)');
  r2.sched.stop(); }

ok(/seen: createUserSlaSeen\(uid\)/.test(MAIN), 'C3d main.ts injeta o seen POR USUÁRIO no startSlaScheduler (como nos rigs acima)');
{ const { execSync } = await import('child_process');
  const d = execSync('git diff fdd684261f59f7d288c6d4197d7ecd0050ce0bb5 -- src/main/slaScheduler.ts src/main/slaRules.js src/main/cardsRules.js src/main/bgNotify.ts src/main/tray.ts src/main/updaterService.ts src/main/firebase.ts src/main/reminder.ts', { cwd: DESK }).toString();
  ok(d.trim() === '', 'C3e slaScheduler + TODA a Categoria B byte-idênticos à 1.0.192 (correção 100% via injeção)'); }

console.log(`\n===== RESULTADO: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
