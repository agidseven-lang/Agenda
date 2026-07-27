#!/usr/bin/env node
/* =====================================================================
   F3.3.77A-R3 — PRODUTOR ÚNICO DA AZUL + RELÓGIO/LINHA DO TEMPO CANÔNICOS
   ---------------------------------------------------------------------
   Prova as DUAS correções da prova física do owner:

   BLOQUEADOR 1 — DUPLICIDADE DA AZUL (causa física provada): a criação atômica
   de Edição de mídia grava assigneeId=Designer E designerAssignment. No main
   (notifier.ts) isso casava DOIS listeners — u1 (task_assigned, chave
   task_assigned:<id>) e u1b (designer_assigned, chave designer_assigned:<id>:<at>).
   Chaves DIFERENTES ⇒ o dedup do HUB (_notifSeen) não colapsa ⇒ 2 azuis (a
   genérica "superior" + a rica "inferior"). Fix: u1 IGNORA tarefa com
   designerAssignment p/ mim (o ramo RICO u1b é o produtor único) + eventId
   CANÔNICO designer_assigned:<taskId>:<designerId>:<assignedAtMs> IDÊNTICO nos 3
   sítios (u1b, renderer notifScanAssign, notifAssignKeyOf) ⇒ HUB colapsa.

   BLOQUEADOR 2 — TEMPO DESSINCRONIZADO: cronômetro, chip, monitor, painel,
   boundary timer e notificação passam a ler "agora" por UMA fonte única
   (canonicalNowMs) e os limiares por UMA linha do tempo (resolveCanonicalSlaTimeline).
   Edição de mídia 40/20, Cronograma 30/10, Roteiro sem SLA — preservados.

   RED×GREEN estático + extração-e-execução. Puro Node; sem rede/Firestore/build.

   -----------------------------------------------------------------------------
   F3.4.3C — reescrito para o contrato produtor-único-no-main (substitui o contrato
   antigo; histórico no Git). O PRODUTOR ÚNICO de SLA/atribuição migrou do RENDERER
   para o PROCESSO MAIN: slaScheduler.ts (SLA amarelo/vermelho/crítico) + notifier.ts
   (azul de atribuição por transição), ambos alimentados pelo listener Firestore do
   main e entregando pelo MESMO deliverNotification (toast visível / bg-window
   minimizado-oculto). O renderer NÃO emite mais SLA nem atribuição (notifScanSla/
   notifScanAssign seguem DEFINIDOS mas SEM chamadores; notifScan só roda o fluxo).
   O relógio canônico (slaNow no main / canonicalNowMs no renderer) e a linha do
   tempo por setor permanecem a fonte única dos marcos. Prova por EXECUÇÃO do
   slaScheduler REAL (compilado) + slaRules REAL, e estática do renderer/main.
   ===================================================================== */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import Module from 'node:module';
import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
import { extractDeliver } from './fixtures/f343/deliver-harness.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const H = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const NT = fs.readFileSync(path.join(DESK, 'src', 'main', 'notifier.ts'), 'utf8');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');
const SCHED = fs.readFileSync(path.join(DESK, 'src', 'main', 'slaScheduler.ts'), 'utf8');
const REAL_SLARULES = path.join(DESK, 'src', 'main', 'slaRules.js');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.log('  FAIL — ' + n); } };

console.log('== F3.3.77A-R3 (F3.4.3C) — produtor único NO MAIN + relógio/linha do tempo canônicos ==');

/* ═══════════════ BLOQUEADOR 1 — PRODUTOR ÚNICO da AZUL, agora NO MAIN (notifier.ts) ═══════════════ */
ok('B1.1 [main] u1 (task_assigned) IGNORA tarefa com designerAssignment p/ mim (produtor único)',
  /const _daT = \(t as any\)\.designerAssignment;\s*if \(_daT && _daT\.designerId === state\.uid\) \{[\s\S]{0,220}return;\s*\}/.test(NT));
ok('B1.2 [main] u1b usa dedupKey CANÔNICO designer_assigned:<id>:<designerId>:<at> (fallback sem at)',
  /const _canonKey = at \? `designer_assigned:\$\{t\.id\}:\$\{da\.designerId \|\| ""\}:\$\{at\}` : `designer_assigned:\$\{t\.id\}:\$\{da\.designerId \|\| ""\}`;/.test(NT) &&
  /dedupKey: _canonKey,/.test(NT));
ok('B1.3 [main] u1b action = detail/<taskId> (abre a TAREFA; paridade com o renderer)',
  /action: \{ type: "detail", deep: `detail\/\$\{t\.id\}` \},\s*dedupKey: _canonKey,/.test(NT));
ok('B1.4 [renderer] notifScanAssign/notifScanSla seguem DEFINIDOS mas SEM chamadores (visual preservado, sem emitir)',
  /function notifScanAssign\(\)/.test(H) && /function notifScanSla\(\)/.test(H) &&
  (H.match(/notifScanAssign\(\)/g) || []).length === 1 && (H.match(/notifScanSla\(\)/g) || []).length === 1);
ok('B1.5 [renderer] notifScan só roda o FLUXO (não emite SLA/atribuição)',
  /function notifScan\(\)\{\}/.test(H));

/* SIMULAÇÃO EXECUTÁVEL do HUB (_notifSeen) — o colapso da azul depende da chave canônica ÚNICA */
{
  const UID = 'designer1', SOC = 'social1', AT = 1700000000000;
  const task = { id: 'm1', assigneeId: UID, by: SOC, designerAssignment: { designerId: UID, assignedBy: SOC, assignedAt: AT } };
  const canonKey = 'designer_assigned:' + task.id + ':' + task.designerAssignment.designerId + ':' + AT;
  const u1Unguarded = (t) => (t.assigneeId === UID && t.by !== UID) ? { key: 'task_assigned:' + t.id, ev: 'task_assigned' } : null;
  const u1Guarded = (t) => { const da = t.designerAssignment; if (da && da.designerId === UID) return null; return u1Unguarded(t); };
  const u1b = (t) => { const da = t.designerAssignment; return (da && da.designerId === UID && da.assignedBy !== UID) ? { key: 'designer_assigned:' + t.id + ':' + da.designerId + ':' + (da.assignedAt || 0), ev: 'designer_assigned' } : null; };
  const hub = (producers) => { const seen = new Set(), out = []; for (const p of producers) { const r = p(task); if (!r) continue; if (seen.has(r.key)) continue; seen.add(r.key); out.push(r); } return out; };
  ok('B1.6 [RED] SEM a guarda: u1(task_assigned) + u1b(designer_assigned) escapam o dedup ⇒ 2 azuis', hub([u1Unguarded, u1b]).length === 2);
  const green = hub([u1Guarded, u1b]);
  ok('B1.7 [GREEN] COM a guarda: só a azul RICA designer_assigned sobrevive ⇒ 1 azul (chave canônica)', green.length === 1 && green[0].ev === 'designer_assigned' && green[0].key === canonKey);
}
/* HUB do main deduplica por dedupKey (deliverNotification._notifSeen) — inalterado */
ok('B1.8 [main] HUB deduplica por dedupKey (_notifSeen) no deliverNotification',
  /const key = String\(p\.dedupKey \|\| /.test(MAIN) && /if \(_notifSeen\.has\(key\)\)/.test(MAIN));

/* ═══════════════ PRODUTOR ÚNICO DE SLA no MAIN — EXECUÇÃO do slaScheduler.ts REAL ═══════════════ */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r3sch-'));
try {
  execFileSync(process.execPath, [path.join(DESK, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    path.join(DESK, 'src', 'main', 'slaScheduler.ts'), '--outDir', tmp, '--module', 'commonjs',
    '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'node'], { stdio: 'pipe' });
} catch (e) { console.error('::error:: falha ao compilar slaScheduler.ts:', (e.stdout || e.message || '').toString().slice(0, 600)); process.exit(1); }
const realLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return { app: null };
  if (request === './firebase' || /[\\/]firebase(\.js)?$/.test(request)) return { listen: () => () => {} };
  if (request === './diag' || /[\\/]diag(\.js)?$/.test(request)) return { diag: () => {} };
  if (request === './slaRules' || /[\\/]slaRules(\.js)?$/.test(request)) return realLoad.call(this, REAL_SLARULES, arguments[1], false);
  return realLoad.apply(this, arguments);
};
const { startSlaScheduler } = require(path.join(tmp, 'slaScheduler.js'));
Module._load = realLoad;

const MIN = 60000;
function newRig(uid, sharedSeen) {
  const chan = extractDeliver(MAIN);
  let NOW = 1700000000000, winState = 'visible', pending = null, tid = 0;
  const delivered = []; const seen = sharedSeen || new Set(); let listenCb = null;
  const sched = startSlaScheduler(() => uid, (p) => { const r = chan.deliver(winState, p); delivered.push({ eventType: p.eventType, dedupKey: p.dedupKey, channel: r.res.channel }); return r.res; }, {
    cardsRules: { cardsEmissionsFor: () => [], cardsNextBoundaryMs: () => 0 }, // F3.5.2 — mock explícito (cards testados à parte)
    now: () => NOW, listen: (name, cb) => { if (name === 'tasks') listenCb = cb; return () => {}; },
    seen: { has: (k) => seen.has(k), add: (k) => seen.add(k) },
    setTimer: (fn, ms) => { pending = { fn, ms, id: ++tid }; return pending; }, clearTimer: (h) => { if (pending && h && pending.id === h.id) pending = null; },
    onLog: () => {}, safetyMaxMs: 60000,
  });
  const ch = (type, id, data) => ({ type, doc: { id, data: () => data } });
  return { sched, delivered, setWin: (w) => { winState = w; }, setNow: (n) => { NOW = n; }, now: () => NOW,
    fireSnap: (changes) => { if (listenCb) listenCb({ docChanges: () => changes }); }, fireTimer: () => { const p = pending; if (p) { pending = null; p.fn(); } }, ch };
}
const cron = (id, uid, due) => ({ id, title: 'Cronograma', client: 'Hosp', sector: 'cronograma', designerAssignment: { designerId: uid, designerName: 'Marina Dias' }, designerFlowStatus: 'afazer', designerSla: { planDueAt: due } });

/* SLA amarelo/vermelho produzido NO MAIN e roteado por deliverNotification nas 3 janelas */
for (const [state, canal] of [['visible', 'toast'], ['minimized', 'bg-window'], ['hidden', 'bg-window']]) {
  const r = newRig('dz1'); r.setWin(state); const NOW = r.now();
  r.fireSnap([r.ch('added', 'ty', cron('ty', 'dz1', NOW + 20 * MIN))]);            // amarelo
  const d = r.delivered.find((x) => x.eventType === 'sla_warning');
  ok('B2.1 SLA AMARELO produzido no MAIN, ' + state + ' → ' + canal, !!d && d.channel === canal);
}
/* dedupe canônico: mesma fronteira em re-eval/reconcile → 1 emissão */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'td', cron('td', 'dz1', NOW - 5 * MIN))]);             // vermelho de entrada
  const after1 = r.delivered.length;
  r.fireSnap([r.ch('modified', 'td', cron('td', 'dz1', NOW - 5 * MIN))]); r.sched.reconcile('resume'); r.fireTimer();
  ok('B2.2 SLA no MAIN não duplica (seen-set + dedupKey canônico) em re-eval/reconcile', after1 === 1 && r.delivered.length === 1);
}
/* reconcile em restart/resume/unlock: boundary vencido no sleep entregue UMA vez */
{
  const r = newRig('dz1'); const NOW = r.now();
  r.fireSnap([r.ch('added', 'ts', cron('ts', 'dz1', NOW + 20 * MIN))]);            // amarelo; vermelho em +20min
  const before = r.delivered.length; r.setNow(NOW + 21 * MIN);
  r.sched.reconcile('resume');
  ok('B2.3 RESUME reconcilia e entrega o vermelho vencido no sleep (1×)', r.delivered.some((x) => x.eventType === 'sla_overdue') && r.delivered.length > before);
  const before2 = r.delivered.length; r.sched.reconcile('unlock');
  ok('B2.4 UNLOCK reconcilia sem reemitir o já-visto (dedupe canônico)', r.delivered.length === before2);
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}

/* main é quem IMPORTA/INICIA o produtor e reconcilia em boot/resume/unlock */
ok('B2.5 [main] importa e INICIA o slaScheduler (produtor único de SLA)',
  /import \{ startSlaScheduler \} from "\.\/slaScheduler"/.test(MAIN) && /slaScheduler = startSlaScheduler\(\(\) => uid, deliverNotification, \{ now: slaNow, authUser: getAuthUser \}\)/.test(MAIN));
ok('B2.6 [main] reconcilia SLA em boot/resume/unlock',
  /slaScheduler\.reconcile\("boot"\)/.test(MAIN) && /slaScheduler\.reconcile\("resume"\)/.test(MAIN) && /slaScheduler\.reconcile\("unlock"\)/.test(MAIN));
ok('B2.7 [main] scheduler reaproveita o listener Firestore do main (event-driven, não polling)',
  /listen\("tasks"/.test(SCHED) && /docChanges\(\)/.test(SCHED) && !/setInterval/.test(SCHED));

/* ═══════════════ BLOQUEADOR 2 — RELÓGIO/LINHA DO TEMPO CANÔNICOS (fonte única dos marcos) ═══════════════ */
ok('B2.8 [main] slaNow espelha o gate de offset do renderer (synced/degraded/stale usam offset; senão local)',
  /function slaNow\(\): number/.test(MAIN) && /q === "synced" \|\| q === "degraded" \|\| q === "stale"/.test(MAIN));
ok('B2.9 [renderer] canonicalNowMs continua a fonte única de "agora" (visual)',
  /function canonicalNowMs\(\)\{ return Date\.now\(\)\+_slaClockOffsetMs; \}/.test(H));
/* linha do tempo canônica por setor via slaRules REAL (mesma matemática do renderer) */
{
  const rules = require(REAL_SLARULES); const DUE = 1700000000000;
  const tl = (sector) => rules.resolveCanonicalSlaTimeline({ sector, designerSla: { planDueAt: DUE } }, rules.dtMs);
  const media = tl('edicao_midia'), croc = tl('cronograma'), rot = tl('roteiro');
  ok('B2.10 [slaRules] Edição de mídia 40/20: amarelo em due−40, vermelho em due, crítico em +20',
    media.warningAtMs === DUE - 40 * MIN && media.overdueAtMs === DUE && media.criticalAtMs === DUE + 20 * MIN);
  ok('B2.11 [slaRules] Cronograma 30/10 (preservado)', croc.warningAtMs === DUE - 30 * MIN && croc.overdueAtMs === DUE && croc.criticalAtMs === DUE + 10 * MIN);
  ok('B2.12 [slaRules] Roteiro: designerSla=false (jamais SLA de designer)', rot.designerSla === false);
}

console.log('');
console.log('RESULTADO: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('HONESTIDADE (F3.4.3C): o PRODUTOR ÚNICO agora vive no MAIN (slaScheduler + notifier), que');
console.log('sobrevive à janela oculta e entrega pelo deliverNotification. O renderer não emite mais SLA/');
console.log('atribuição (só visual). Relógio/linha do tempo canônicos preservam os marcos por setor.');
if (fail) process.exit(1);
