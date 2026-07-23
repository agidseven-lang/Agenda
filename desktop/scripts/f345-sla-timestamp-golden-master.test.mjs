#!/usr/bin/env node
/* =====================================================================================
 * F3.4.5 — GOLDEN MASTER TEMPORAL do SLA (RED 1.0.181 + GREEN pós-correção).
 * -------------------------------------------------------------------------------------
 * DEFEITO FÍSICO (owner, Desktop 1.0.181): tarefa criada 10:38, início planejado 10:45,
 * prazo final 11:10; a AZUL de atribuição chegou certa e a AMARELA chegou JUNTO (~10:40),
 * com o monitor marcando ~29 min. Causa provada: warningAt = planDueAt − warningMinutes
 * (11:10−30 = 10:40) CEGO ao planStartAt (10:45) — janela planejada MENOR que warningMinutes
 * faz o amarelo vazar para ANTES da abertura real, colado na atribuição.
 *
 * RED: réplica da 1.0.181 REAL (git show e4692c9:desktop/src/main/slaRules.js) reproduz a
 *      emissão antecipada às 10:40 (timeline + scheduler).
 * GREEN: com o clamp F3.4.5 (warningAt = max(planDueAt−warn, planStartAt), ≤ planDueAt):
 *      amarela SÓ às 10:45; vermelha às 11:10 e crítica às 11:20 INTOCADAS; geometria normal
 *      (janela ≥ warn) BYTE-idêntica à aprovada; bootstrap/restart/resume/unlock/snapshot
 *      duplicado/alteração de prazo/conclusão/cancelamento/troca de responsável preservados.
 *
 * Rodar: node desktop/scripts/f345-sla-timestamp-golden-master.test.mjs
 * (exige dist/main/slaScheduler.js — `npm run build`/tsc já rodado — e history do git p/ e4692c9)
 * ===================================================================================== */
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath } from 'url'; import { createRequire } from 'module';
import { execFileSync } from 'child_process';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const REPO = path.resolve(DESK, '..');
const BASE_SHA = 'e4692c93644bd4deb380b2ec5ecc486dfcb205ca'; // Desktop 1.0.181 OFICIAL (tag v1.0.181)

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };
const eqJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stripCreatedAt = (arr) => (arr || []).map((p) => { const q = Object.assign({}, p); delete q.createdAt; return q; });

/* ---------- módulos: slaRules ATUAL (corrigido) + BASE 1.0.181 (réplica RED) ---------- */
const rules = require(path.join(DESK, 'src', 'main', 'slaRules.js'));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'f345-'));
const baseRulesSrc = execFileSync('git', ['show', BASE_SHA + ':desktop/src/main/slaRules.js'], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString();
fs.writeFileSync(path.join(TMP, 'slaRules-base.js'), baseRulesSrc);
const baseRules = require(path.join(TMP, 'slaRules-base.js'));

/* ---------- scheduler REAL compilado (dist) com firebase/diag stubados ---------- */
function schedDirWith(rulesFile) {
  const d = fs.mkdtempSync(path.join(TMP, 'sched-'));
  fs.copyFileSync(path.join(DESK, 'dist', 'main', 'slaScheduler.js'), path.join(d, 'slaScheduler.js'));
  fs.copyFileSync(rulesFile, path.join(d, 'slaRules.js'));
  fs.writeFileSync(path.join(d, 'firebase.js'), 'exports.listen=function(){return function(){};};');
  fs.writeFileSync(path.join(d, 'diag.js'), 'exports.diag=function(){};');
  return d;
}
const DIR_FIX = schedDirWith(path.join(DESK, 'src', 'main', 'slaRules.js'));
const DIR_RED = schedDirWith(path.join(TMP, 'slaRules-base.js'));

/** Harness: scheduler real com relógio/timers/snapshots/seen INJETADOS (zero rede/espera). */
function makeSched(dir, uid, startNowMs) {
  const { startSlaScheduler } = require(path.join(dir, 'slaScheduler.js'));
  const st = { now: startNowMs, delivered: [], seen: new Set(), timers: [], snapCb: null };
  const h = startSlaScheduler(() => uid, (p) => st.delivered.push(p), {
    now: () => st.now,
    listen: (_n, cb) => { st.snapCb = cb; return () => {}; },
    seen: { has: (k) => st.seen.has(k), add: (k) => st.seen.add(k) },
    setTimer: (fn, ms) => { const t = { fn, at: st.now + ms, done: false, cleared: false }; st.timers.push(t); return t; },
    clearTimer: (t) => { if (t) t.cleared = true; },
    onLog: () => {},
  });
  return {
    h, st,
    setNow(ms) { st.now = ms; },
    snapshot(changes) { st.snapCb({ docChanges: () => changes }); },
    fireDue() { for (;;) { const d = st.timers.filter((t) => !t.cleared && !t.done && t.at <= st.now).sort((a, b) => a.at - b.at)[0]; if (!d) break; d.done = true; d.fn(); } },
    keys() { return st.delivered.map((p) => p.dedupKey); },
    types() { return st.delivered.map((p) => p.eventType); },
    nextArm() { const live = st.timers.filter((t) => !t.cleared && !t.done); return live.length ? live[live.length - 1].at : 0; },
  };
}

/* ---------- fixtures ---------- */
const D = '2026-07-22';
const T = (hm) => rules.dtMs(D, hm);
const MIN = 60000;
function fisTask(o) { // caso físico do owner: criada 10:38 · início 10:45 · prazo 11:10 · atribuída 10:40
  return Object.assign({
    id: 'T_FIS', title: 'Cronograma físico', client: 'Hospital Visão', sector: 'cronograma',
    createdAt: T('10:38'), designerFlowStatus: 'afazer',
    designerAssignment: { designerId: 'dz1', designerName: 'Tatiana', designerAvatar: '', assignedBy: 'soc1', assignedAt: T('10:40'), startDate: D, startTime: '10:45', endDate: D, endTime: '11:10', status: 'sent' },
    designerSla: { planStartAt: T('10:45'), planDueAt: T('11:10'), seedAt: T('10:40'), seedBy: 'soc1', scheduleRevision: 1 },
  }, o || {});
}
const addCh = (t) => [{ type: 'added', doc: { id: t.id, data: () => t } }];
const modCh = (t) => [{ type: 'modified', doc: { id: t.id, data: () => t } }];

console.log('===== F3.4.5 — GOLDEN MASTER TEMPORAL (RED 1.0.181 @' + BASE_SHA.slice(0, 7) + ' + GREEN) =====');

/* ═══ RED — a 1.0.181 REAL emite a amarela às 10:40, junto da atribuição ═══ */
{
  const tlB = baseRules.resolveCanonicalSlaTimeline(fisTask(), baseRules.dtMs);
  ok('RED tl: 1.0.181 calcula warningAt = 10:40 (planDueAt−30, CEGO ao planStartAt 10:45)', tlB.warningAtMs === T('10:40'));
  ok('RED tl: overdueAt = 11:10 e criticalAt = 11:20 (corretos já na base)', tlB.overdueAtMs === T('11:10') && tlB.criticalAtMs === T('11:20'));
  const emB = baseRules.slaEmissionsFor(fisTask(), 'dz1', T('10:40') + 5000);
  ok('RED emissão: às 10:40:05 a 1.0.181 emite 1× sla_warning (amarela ANTECIPADA)', emB.length === 1 && emB[0].eventType === 'sla_warning');
  ok('RED dedupKey: sla_warning:T_FIS:<planDueAt> (campo temporal ERRADO selecionado: due−30 < início)', emB.length === 1 && emB[0].dedupKey === 'sla_warning:T_FIS:' + T('11:10'));
  // scheduler REAL da base: o snapshot da ATRIBUIÇÃO (10:40) é o ponto que chama deliverNotification
  const rs = makeSched(DIR_RED, 'dz1', T('10:38'));
  rs.snapshot(addCh({ id: 'T_FIS', title: 'Cronograma físico', client: 'Hospital Visão', sector: 'cronograma', createdAt: T('10:38') }));
  ok('RED sched: criação 10:38 (sem designerSla) não emite', rs.st.delivered.length === 0);
  rs.setNow(T('10:40') + 3000); rs.snapshot(modCh(fisTask()));
  ok('RED sched: snapshot da atribuição (10:40) emite a amarela JUNTO da azul — defeito reproduzido', rs.types().length === 1 && rs.types()[0] === 'sla_warning');
  ok('RED sched: monitor ~29min restantes no disparo (remaining 29–30min)', (() => { const d = baseRules.resolveTaskDisplayState(fisTask(), T('10:40') + 60000, baseRules.dtMs); return d.state === 'warning' && d.remainingMin >= 29 && d.remainingMin <= 30; })());
}

/* ═══ GREEN 4 — caso físico completo no scheduler REAL corrigido ═══ */
{
  const s = makeSched(DIR_FIX, 'dz1', T('10:38'));
  s.snapshot(addCh({ id: 'T_FIS', title: 'Cronograma físico', client: 'Hospital Visão', sector: 'cronograma', createdAt: T('10:38') }));
  s.setNow(T('10:40') + 3000); s.snapshot(modCh(fisTask()));
  ok('G4 atribuição 10:40: NENHUMA amarela junto da azul', s.st.delivered.length === 0);
  const tl = rules.resolveCanonicalSlaTimeline(fisTask(), rules.dtMs);
  ok('G4 warningAt corrigido = 10:45 (abertura REAL da janela = planStartAt)', tl.warningAtMs === T('10:45'));
  ok('G4 timer re-arma em cadência ≤60s (teto de segurança) — nunca um disparo direto às 10:40', (() => { const live = s.st.timers.filter((t) => !t.cleared && !t.done); return live.length === 1 && live[0].at > s.st.now && live[0].at <= s.st.now + 60000 + 200; })());
  s.setNow(T('10:44') + 50000); s.fireDue();
  ok('G4b re-evals de segurança até 10:44:50: NENHUMA emissão antes da abertura (10:45)', s.st.delivered.length === 0);
  s.setNow(T('10:45') + 200); s.fireDue();
  ok('G4 amarela EXATAMENTE na abertura (10:45), uma vez', eqJ(s.types(), ['sla_warning']) && s.keys()[0] === 'sla_warning:T_FIS:' + T('11:10'));
  s.setNow(T('11:10') + 200); s.fireDue();
  ok('G4 vermelha no PRAZO FINAL 11:10 (intocada)', eqJ(s.types(), ['sla_warning', 'sla_overdue']) && s.keys()[1] === 'sla_overdue:T_FIS:' + T('11:10'));
  s.setNow(T('11:20') + 200); s.fireDue();
  ok('G4 crítica após os 10 min adicionais (11:20, intocada)', eqJ(s.types(), ['sla_warning', 'sla_overdue', 'sla_critical']));
  s.setNow(T('11:40')); s.fireDue(); s.h.reconcile('extra');
  ok('G4 sem duplicações depois (dedupe intacto)', s.st.delivered.length === 3);
}

/* ═══ GREEN 1–3 — geometria normal aprovada permanece EXATA (janela ≥ warn) ═══ */
{
  const t = fisTask({ designerSla: { planStartAt: T('10:00'), planDueAt: T('11:00'), scheduleRevision: 1 } });
  const tl = rules.resolveCanonicalSlaTimeline(t, rules.dtMs);
  ok('G1 janela plena: amarela em due−30 (10:30) — nada muda', tl.warningAtMs === T('10:30'));
  ok('G2 vermelha EXATAMENTE 30 min após a amarela', tl.overdueAtMs - tl.warningAtMs === 30 * MIN);
  ok('G3 10 minutos adicionais preservados (critical = due+10)', tl.criticalAtMs - tl.overdueAtMs === 10 * MIN);
  // coincidência LEGÍTIMA: início = atribuição (janela abre agora) → amarela junto da azul É correta
  const t2 = fisTask({ designerSla: { planStartAt: T('10:40'), planDueAt: T('11:10'), scheduleRevision: 1 } });
  const em2 = rules.slaEmissionsFor(t2, 'dz1', T('10:40') + 5000);
  ok('G1b início==atribuição: amarela imediata é LEGÍTIMA e preservada', em2.length === 1 && em2[0].eventType === 'sla_warning');
}

/* ═══ GREEN 5 — azul separada: assignedAt NÃO participa do relógio SLA ═══ */
{
  const a = rules.resolveCanonicalSlaTimeline(fisTask(), rules.dtMs);
  const b = rules.resolveCanonicalSlaTimeline(fisTask({ designerAssignment: Object.assign({}, fisTask().designerAssignment, { assignedAt: T('09:00') }) }), rules.dtMs);
  ok('G5 mudar assignedAt não move NENHUM marco do SLA', eqJ(a, b));
  ok('G5 identidade da azul (designer_assigned:taskId:designerId:assignedAt) é DISJUNTA do dedup SLA', 'designer_assigned:T_FIS:dz1:' + T('10:40') !== 'sla_warning:T_FIS:' + T('11:10'));
}

/* ═══ GREEN 6/7 — bootstrap e restart sem disparo antecipado ═══ */
{
  const b1 = makeSched(DIR_FIX, 'dz1', T('10:41')); b1.snapshot(addCh(fisTask()));
  ok('G6 bootstrap às 10:41 com sessão pré-existente: 0 emissões', b1.st.delivered.length === 0);
  const b2 = makeSched(DIR_FIX, 'dz1', T('10:43')); b2.snapshot(addCh(fisTask())); b2.h.reconcile('boot');
  ok('G7 restart às 10:43 (seen zerado): 0 emissões', b2.st.delivered.length === 0);
}

/* ═══ GREEN 8/9 — resume/unlock reconciliam SOMENTE estágio realmente vencido ═══ */
{
  const s = makeSched(DIR_FIX, 'dz1', T('10:41')); s.snapshot(addCh(fisTask()));
  s.setNow(T('10:50')); s.h.reconcile('resume');
  ok('G8 resume às 10:50: entrega a amarela vencida UMA vez (catch-up), sem vermelho', eqJ(s.types(), ['sla_warning']));
  s.h.reconcile('resume');
  ok('G8b resume repetido: não duplica', s.st.delivered.length === 1);
  s.setNow(T('11:12')); s.h.reconcile('unlock');
  ok('G9 unlock às 11:12: entrega SÓ o vermelho vencido', eqJ(s.types(), ['sla_warning', 'sla_overdue']));
}

/* ═══ GREEN 10/11 — alteração de prazo recalcula; revisão antiga jamais dispara ═══ */
{
  const s = makeSched(DIR_FIX, 'dz1', T('10:41')); s.snapshot(addCh(fisTask()));
  s.setNow(T('10:46')); s.h.reconcile('resume');            // amarela do prazo 11:10 (vencida às 10:45)
  const t2 = fisTask({ designerSla: { planStartAt: T('10:45'), planDueAt: T('11:40'), seedAt: T('10:40'), seedBy: 'soc1', scheduleRevision: 2 } });
  s.snapshot(modCh(t2));                                     // Social ESTENDE o prazo p/ 11:40
  const tl2 = rules.resolveCanonicalSlaTimeline(t2, rules.dtMs);
  ok('G10 novo prazo recalcula: amarela do NOVO prazo em 11:10 (max(11:40−30, 10:45))', tl2.warningAtMs === T('11:10') && tl2.overdueAtMs === T('11:40'));
  s.setNow(T('11:12')); s.fireDue(); s.h.reconcile('tick');
  ok('G10b amarela do prazo NOVO com dedup NOVO (por finishMs)', s.keys().includes('sla_warning:T_FIS:' + T('11:40')));
  ok('G11 revisão antiga NÃO dispara: nenhum vermelho do prazo velho (…:' + '11:10)', !s.keys().includes('sla_overdue:T_FIS:' + T('11:10')));
}

/* ═══ GREEN 12/13 — concluída/cancelada cancelam alertas futuros ═══ */
{
  const done = fisTask({ designerFlowStatus: 'concluido' });
  const canc = fisTask({ status: 'cancelado' });
  ok('G12 concluída: nenhum marco futuro e nenhuma emissão', rules.nextBoundaryMs(done, T('10:41'), rules.dtMs) === 0 && rules.slaEmissionsFor(done, 'dz1', T('11:15')).length === 0);
  ok('G13 cancelada: nenhum marco futuro e nenhuma emissão', rules.nextBoundaryMs(canc, T('10:41'), rules.dtMs) === 0 && rules.slaEmissionsFor(canc, 'dz1', T('11:15')).length === 0);
  const s = makeSched(DIR_FIX, 'dz1', T('10:41')); s.snapshot(addCh(fisTask()));
  s.setNow(T('10:44')); s.snapshot(modCh(done));
  s.setNow(T('11:30')); s.fireDue(); s.h.reconcile('tick');
  ok('G12b scheduler: conclusão antes da janela ⇒ silêncio total depois', s.st.delivered.length === 0);
}

/* ═══ GREEN 14 — troca de responsável atualiza o destinatário ═══ */
{
  const re = fisTask(); re.designerAssignment = Object.assign({}, re.designerAssignment, { designerId: 'dz2', designerName: 'Carla' });
  ok('G14 dz1 (antigo) não recebe mais', rules.slaEmissionsFor(re, 'dz1', T('10:50')).length === 0);
  const em = rules.slaEmissionsFor(re, 'dz2', T('10:50'));
  ok('G14b dz2 (novo) recebe a amarela com responsável atualizado', em.length === 1 && em[0].responsibleId === 'dz2' && em[0].targetUserId === 'dz2');
}

/* ═══ GREEN 15 — snapshot duplicado sem duplicação ═══ */
{
  const s = makeSched(DIR_FIX, 'dz1', T('10:46'));
  s.snapshot(addCh(fisTask())); s.snapshot(modCh(fisTask())); s.snapshot(modCh(fisTask()));
  ok('G15 mesmo doc 3× dentro da janela: UMA amarela só', eqJ(s.types(), ['sla_warning']));
}

/* ═══ GREEN 16/17/18 — comportamentos aprovados BYTE-idênticos à 1.0.181 (base × fixo) ═══ */
{
  const _now = Date.now; Date.now = () => T('12:00');
  try {
    const warm = { id: 't_ok', title: 'Normal', client: 'C', sector: 'cronograma', designerFlowStatus: 'afazer', designerAssignment: { designerId: 'dz1', designerName: 'M', assignedBy: 'soc1', assignedAt: T('09:00') }, designerSla: { planDueAt: T('12:20') } };
    ok('G16 amarelo normal (sem planStartAt): payload IDÊNTICO base×fixo', eqJ(stripCreatedAt(baseRules.slaEmissionsFor(warm, 'dz1', T('12:00'))), stripCreatedAt(rules.slaEmissionsFor(warm, 'dz1', T('12:00')))));
    const red = Object.assign({}, warm, { designerSla: { planDueAt: T('11:55') } });
    ok('G17 vermelho normal: payload IDÊNTICO base×fixo', eqJ(stripCreatedAt(baseRules.slaEmissionsFor(red, 'dz1', T('12:00'))), stripCreatedAt(rules.slaEmissionsFor(red, 'dz1', T('12:00')))));
    const crit = Object.assign({}, warm, { designerSla: { planDueAt: T('11:40') } });
    const u = { id: 'dz1', role: 'designer', admin: false };
    ok('G18 operational_block: IDÊNTICO base×fixo (designer bloqueado)', eqJ(stripCreatedAt(baseRules.operationalBlockFor([crit], u, T('12:00'))), stripCreatedAt(rules.operationalBlockFor([crit], u, T('12:00')))) && rules.operationalBlockFor([crit], u, T('12:00')).length === 1);
    const adm = { id: 'dz1', role: 'gestor', admin: true };
    ok('G18b operational_block: ADMIN/MANAGER nunca bloqueado (base×fixo)', baseRules.operationalBlockFor([crit], adm, T('12:00')).length === 0 && rules.operationalBlockFor([crit], adm, T('12:00')).length === 0);
  } finally { Date.now = _now; }
}

/* ═══ Borda: plano malformado (início ≥ prazo) — sem amarela antecipada; vermelho protege ═══ */
{
  const bad = fisTask({ designerSla: { planStartAt: T('11:30'), planDueAt: T('11:10'), scheduleRevision: 1 } });
  const tl = rules.resolveCanonicalSlaTimeline(bad, rules.dtMs);
  ok('B1 início≥prazo: warningAt clampado ao prazo (janela amarela vazia; nunca antecipada)', tl.warningAtMs === T('11:10'));
  ok('B2 início≥prazo: nenhuma amarela antes do prazo', rules.slaEmissionsFor(bad, 'dz1', T('11:09')).length === 0);
  ok('B3 início≥prazo: vermelho no prazo final segue protegendo', (() => { const e = rules.slaEmissionsFor(bad, 'dz1', T('11:12')); return e.length === 1 && e[0].eventType === 'sla_overdue'; })());
}

/* ═══ Paridade renderer↔main das funções corrigidas (extração viva do index.html) ═══ */
{
  const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
  function grabFn(name) {
    const a = HTML.indexOf('function ' + name + '(');
    if (a < 0) throw new Error('função ausente: ' + name);
    let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } }
    throw new Error('sem fim: ' + name);
  }
  const R = new Function(
    'var SLA_PANEL_WARN_MS=30*60000, SLA_PANEL_GRACE_MS=10*60000;\n' + // fixtures do harness = cronograma (30/10); sem slaCfgOf a extração cai nas constantes, mesmos valores
    grabFn('dtMs') + '\n' + grabFn('slaPanelFinishMs') + '\n' + grabFn('slaPanelDelivered') + '\n' + grabFn('slaCfgDefault') + '\n' + grabFn('resolveTaskDisplayState') + '\n' + grabFn('_slaScheduleRevOf') + '\n' + grabFn('resolveCanonicalSlaTimeline') + '\n' +
    'return { ds:function(t,now){return resolveTaskDisplayState(t,now,dtMs);}, tl:function(t){return resolveCanonicalSlaTimeline(t,dtMs);} };'
  )();
  const probes = [fisTask(), fisTask({ designerSla: { planStartAt: T('10:00'), planDueAt: T('11:00') } }), fisTask({ designerSla: { planDueAt: T('11:10') } })];
  const nows = [T('10:40') + 5000, T('10:45') + 5000, T('11:12'), T('11:25')];
  let par = true;
  for (const p of probes) for (const n of nows) {
    const a = R.ds(p, n), b = rules.resolveTaskDisplayState(p, n, rules.dtMs);
    if (!eqJ(a, b)) par = false;
    const ta = R.tl(p), tb = rules.resolveCanonicalSlaTimeline(p, rules.dtMs);
    if (!(ta.warningAtMs === tb.warningAtMs && ta.overdueAtMs === tb.overdueAtMs && ta.criticalAtMs === tb.criticalAtMs)) par = false;
  }
  ok('PARIDADE renderer≡main das funções corrigidas (displayState + timeline, 12 sondas)', par);
}

console.log('F3.4.5-GOLDEN-TEMPORAL: ' + pass + ' OK, ' + fail + ' FAIL');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
if (fail) { console.error('::error:: contrato temporal F3.4.5 violado'); process.exit(1); }
console.log('OK — RED da 1.0.181 reproduzido (amarela antecipada na atribuição) e GREEN completo: amarela na abertura real da janela; azul/vermelha/crítica/operational_block/dedupe/prazo/troca/snapshot intocados.');
