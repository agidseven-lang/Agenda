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
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const H = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
const NT = fs.readFileSync(path.join(DESK, 'src', 'main', 'notifier.ts'), 'utf8');
const MAIN = fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.log('  FAIL — ' + n); } };

/* brace-balanced extractor de `function NAME(...) { ... }` */
function grab(src, name) {
  const sig = 'function ' + name + '(';
  const a = src.indexOf(sig); if (a < 0) throw new Error('não achei ' + name);
  let i = src.indexOf('{', a), depth = 0;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) return src.slice(a, i + 1); } }
  throw new Error('sem fecho ' + name);
}

console.log('== F3.3.77A-R3 — produtor único da azul + relógio/linha do tempo canônicos ==');

/* ═══════════════ BLOQUEADOR 1 — PRODUTOR ÚNICO (estático no notifier.ts) ═══════════════ */
ok('B1.1 [main] u1 (task_assigned) IGNORA tarefa com designerAssignment p/ mim (produtor único)',
  /const _daT = \(t as any\)\.designerAssignment;\s*if \(_daT && _daT\.designerId === state\.uid\) \{[\s\S]{0,220}return;\s*\}/.test(NT));
ok('B1.2 [main] u1 loga assignment.duplicate.blocked (auditoria da causa física)',
  /diag\("assignment\.duplicate\.blocked", \{ taskId: t\.id, producer: "notifier\.u1\.task_assigned"/.test(NT));
ok('B1.3 [main] u1b usa eventId CANÔNICO designer_assigned:<id>:<designerId>:<at>',
  /const _canonKey = `designer_assigned:\$\{t\.id\}:\$\{da\.designerId \|\| ""\}:\$\{at\}`;/.test(NT) &&
  /dedupKey: _canonKey,/.test(NT));
ok('B1.4 [main] u1b loga assignment.producer (produtor canônico único)',
  /diag\("assignment\.producer", \{[\s\S]{0,160}producer: "notifier\.u1b"/.test(NT));
ok('B1.5 [main] u1b action = detail/<taskId> (abre a TAREFA; paridade com o renderer)',
  /action: \{ type: "detail", deep: `detail\/\$\{t\.id\}` \},\s*dedupKey: _canonKey,/.test(NT));
ok('B1.6 [main] u1 action = detail/<taskId> (dedup-twin consistente com o renderer)',
  /action: \{ type: "detail", deep: `detail\/\$\{t\.id\}` \},\s*dedupKey: `task_assigned:\$\{t\.id\}`,/.test(NT));

/* eventId canônico IDÊNTICO nos 3 sítios do renderer (senão o HUB não colapsaria → voltaria a duplicar) */
ok('B1.7 [renderer] notifScanAssign usa o MESMO eventId canônico :taskId:designerId:assignedAt',
  /dedupKey:'designer_assigned:'\+t\.id\+':'\+\(da\.designerId\|\|''\)\+':'\+at, action:\{type:'detail',deep:'detail\/'\+t\.id\}/.test(H));
ok('B1.8 [renderer] notifAssignKeyOf (semente do baseline) usa o MESMO eventId canônico',
  /return at\?\('designer_assigned:'\+t\.id\+':'\+\(da\.designerId\|\|''\)\+':'\+at\):'';/.test(H));

/* SIMULAÇÃO EXECUTÁVEL do HUB (_notifSeen) — RED×GREEN da duplicidade.
   Modela a criação atômica (assigneeId=Designer + designerAssignment) e os 3 produtores. */
{
  const UID = 'designer1', SOC = 'social1', AT = 1700000000000;
  const task = { id: 'm1', assigneeId: UID, by: SOC, designerAssignment: { designerId: UID, assignedBy: SOC, assignedAt: AT } };
  const canonKey = 'designer_assigned:' + task.id + ':' + task.designerAssignment.designerId + ':' + AT;
  // produtores. u1Guarded = comportamento GREEN (com a guarda); u1Unguarded = RED (sem a guarda).
  const u1Unguarded = (t) => (t.assigneeId === UID && t.by !== UID) ? { key: 'task_assigned:' + t.id, ev: 'task_assigned' } : null;
  const u1Guarded = (t) => { const da = t.designerAssignment; if (da && da.designerId === UID) return null; return u1Unguarded(t); };
  const u1b = (t) => { const da = t.designerAssignment; return (da && da.designerId === UID && da.assignedBy !== UID) ? { key: 'designer_assigned:' + t.id + ':' + da.designerId + ':' + (da.assignedAt || 0), ev: 'designer_assigned' } : null; };
  const rendererScan = u1b; // o renderer emite designer_assigned com a MESMA chave canônica
  const hub = (producers) => { const seen = new Set(), out = []; for (const p of producers) { const r = p(task); if (!r) continue; if (seen.has(r.key)) continue; seen.add(r.key); out.push(r); } return out; };

  const red = hub([u1Unguarded, u1b, rendererScan]);
  ok('B1.9 [RED] SEM a guarda: u1(task_assigned) + u1b(designer_assigned) escapam o dedup ⇒ 2 azuis', red.length === 2 && red.some(x => x.ev === 'task_assigned') && red.some(x => x.ev === 'designer_assigned'));

  const green = hub([u1Guarded, u1b, rendererScan]);
  ok('B1.10 [GREEN] COM a guarda: u1 é bloqueado; u1b + renderer colapsam na chave canônica ⇒ 1 azul', green.length === 1 && green[0].ev === 'designer_assigned' && green[0].key === canonKey);
  ok('B1.11 [GREEN] a única azul é a RICA designer_assigned (canônica inferior), nunca a genérica', green.every(x => x.ev !== 'task_assigned'));
}

/* HUB do main INALTERADO (dedup por dedupKey em _notifSeen) — o colapso depende da chave canônica */
ok('B1.12 [main] HUB deduplica por dedupKey (_notifSeen) — inalterado',
  /const key = String\(p\.dedupKey \|\| /.test(MAIN) && /if \(_notifSeen\.has\(key\)\)/.test(MAIN));

/* ═══════════════ BLOQUEADOR 2 — RELÓGIO E LINHA DO TEMPO CANÔNICOS ═══════════════ */
ok('B2.1 canonicalNowMs é a fonte ÚNICA de "agora" (seam com offset; hoje 0 = relógio local)',
  /var _slaClockOffsetMs=0;/.test(H) && /function canonicalNowMs\(\)\{ return Date\.now\(\)\+_slaClockOffsetMs; \}/.test(H));
ok('B2.2 canonicalNowMs + resolveCanonicalSlaTimeline expostos p/ QA/telas',
  /window\.canonicalNowMs=canonicalNowMs; window\.resolveCanonicalSlaTimeline=resolveCanonicalSlaTimeline;/.test(H));

/* superfícies vivas do SLA leem o relógio canônico (não Date.now() cru) — lockstep entre elas */
const routed = ['function slaMonData', 'function slaCriticalFor', 'function notifScanSla', 'function slaOpRowPct', 'function detailSla', 'function slaibCompute'];
ok('B2.3 superfícies vivas (monitor/cronômetro/notificação/chip/painel) leem canonicalNowMs',
  /var now=canonicalNowMs\(\), f=\(typeof dtMs/.test(H) &&        // slaMonData
  /var now=canonicalNowMs\(\), f=\(typeof dtMs==='function'\?dtMs:null\);   \/\* F3\.3\.77A-R3 — relógio canônico \(bloqueio operacional\)/.test(H) &&  // slaCriticalFor
  /var now=canonicalNowMs\(\), f=\(typeof dtMs==='function'\?dtMs:null\), vis=\[\];/.test(H) &&  // notifScanSla
  /const d=resolveTaskDisplayState\(t,nowMs\|\|canonicalNowMs\(\)/.test(H) &&  // kbv2SlaLocal (chip do card)
  /var now=canonicalNowMs\(\), pd=d\.finishMs;/.test(H));           // detailSla

/* boundary timer dispara a NOTIFICAÇÃO no limite exato + usa o relógio canônico */
ok('B2.4 boundary timer arma pelo relógio canônico e DISPARA notifScanSla no limite exato',
  /var now=canonicalNowMs\(\), b=slaMonNextBoundary\(now\); if\(!b\) return;/.test(H) &&
  /_slaBoundaryTimer=setTimeout\(function\(\)\{[\s\S]{0,320}notifScanSla\(\)/.test(H));
ok('B2.5 slaMonNextBoundary deriva os marcos da LINHA DO TEMPO canônica (mesmos instantes do cronômetro)',
  /var tl=resolveCanonicalSlaTimeline\(t,f\); if\(!tl\.dueAtMs\) continue;\s*var bs=\[tl\.warningAtMs, tl\.overdueAtMs, tl\.criticalAtMs\];/.test(H));

/* RETOMADA (resume/unlock): reavalia + rearma ≤3s, sem depender do poll de 30s */
ok('B2.6 retomada (visibilitychange/focus) reavalia notifScanSla + rearma o boundary',
  /document\.addEventListener\('visibilitychange',function\(\)\{ if\(document\.visibilityState==='visible'\) _slaResume\(\); \}\);/.test(H) &&
  /window\.addEventListener\('focus',_slaResume\);/.test(H) &&
  /_slaResume=function\(\)\{[\s\S]{0,460}notifScanSla\(\)[\s\S]{0,160}slaMonScheduleBoundary\(\)/.test(H));

/* logs canônicos (FASE 12) */
ok('B2.7 logs de tempo (sla.timer.arm/fire com canonicalNowMs/systemNowMs/drift)',
  /ncDiag\('sla\.timer\.arm',\{boundaryMs:b,delayMs:delay,canonicalNowMs:now,systemNowMs:Date\.now\(\),clockOffsetMs:_slaClockOffsetMs\}\)/.test(H) &&
  /ncDiag\('sla\.timer\.fire',\{[\s\S]{0,120}actualDriftMs:canonicalNowMs\(\)-b\}\)/.test(H));

/* scheduleRevision (FASE 10) — semeado na criação, incrementado na edição, na dedup da MÍDIA (Cronograma byte-idêntico) */
ok('B2.8 scheduleRevision semeado na criação atômica (designerSla.scheduleRevision:1)',
  /seedAt:_now, seedBy:_soc\.id\|\|null, scheduleRevision:1 \};/.test(H));
ok('B2.9 scheduleRevision incrementado na edição de prazo (invalida dedupes antigos)',
  /patch\['designerSla\.scheduleRevision'\]=_slaScheduleRevOf\(t\)\+1;/.test(H));
ok('B2.10 dedup MÍDIA inclui scheduleRevision; Cronograma (sem dedupByDesigner) permanece BYTE-idêntico',
  /\(cfg&&cfg\.dedupByDesigner\) \? \(tag\+':'\+t\.id\+':'\+resp\.id\+':'\+d\.finishMs\+':r'\+_slaScheduleRevOf\(t\)\) : \(tag\+':'\+t\.id\+':'\+d\.finishMs\)/.test(H));

/* EXTRAÇÃO-E-EXECUÇÃO de resolveCanonicalSlaTimeline — marcos EXATOS por setor */
{
  const SECTOR_SLA = grab(H, 'slaCfgDefault'); // só p/ garantir presença
  const timelineSrc = grab(H, 'resolveCanonicalSlaTimeline') + '\n' + grab(H, '_slaScheduleRevOf') + '\n' + grab(H, 'slaCfgOf') + '\n' + grab(H, 'slaCfgDefault') + '\n' + grab(H, 'slaPanelFinishMs');
  // SECTOR_SLA é uma var (objeto) — extrai a declaração
  const vm = H.indexOf('var SECTOR_SLA='); const ve = H.indexOf('};', vm) + 2; const sectorVar = H.slice(vm, ve);
  const PRE = sectorVar + '\n' +
    'var SLA_PANEL_WARN_MS=30*60000, SLA_PANEL_GRACE_MS=10*60000;\n' +
    'function secOf(s){var k=(s&&s.sector!==undefined)?s.sector:s; return {key:k};}\n' +
    'function dtMs(d,t){return 0;}\n';
  const T = new Function(PRE + timelineSrc + '\n; return { resolveCanonicalSlaTimeline };')();
  const MIN = 60000, DUE = 1700000000000;
  const mk = (sector) => ({ sector, designerSla: { planDueAt: DUE } });

  const media = T.resolveCanonicalSlaTimeline(mk('edicao_midia'), null);
  ok('B2.11 [timeline] Edição de mídia: warningMinutes=40, overdueGraceMinutes=20',
    media.warningMinutes === 40 && media.overdueGraceMinutes === 20 && media.designerSla === true);
  ok('B2.12 [timeline] Edição de mídia: AMARELO em planDueAt−40min, VERMELHO em planDueAt, crítico em +20min',
    media.warningAtMs === DUE - 40 * MIN && media.overdueAtMs === DUE && media.criticalAtMs === DUE + 20 * MIN && media.dueAtMs === DUE);

  const cron = T.resolveCanonicalSlaTimeline(mk('cronograma'), null);
  ok('B2.13 [timeline] Cronograma: 30/10 — AMARELO em due−30, VERMELHO em due, crítico em +10 (preservado)',
    cron.warningMinutes === 30 && cron.overdueGraceMinutes === 10 && cron.warningAtMs === DUE - 30 * MIN && cron.overdueAtMs === DUE && cron.criticalAtMs === DUE + 10 * MIN);

  const rot = T.resolveCanonicalSlaTimeline(mk('roteiro'), null);
  ok('B2.14 [timeline] Roteiro: designerSla=false (jamais SLA de designer)', rot.designerSla === false);
}

/* ═══════════════ PRESERVAÇÕES (nada aprovado regrediu) ═══════════════ */
ok('P1 SECTOR_SLA preservado: media 40/20 (crítico OFF), cronograma 30/10 (crítico ON), roteiro OFF',
  /edicao_midia:\{designerSla:true,  warningMinutes:40, overdueGraceMinutes:20, critical:false, dedupByDesigner:true/.test(H) &&
  /cronograma:  \{designerSla:true,  warningMinutes:30, overdueGraceMinutes:10, critical:true,  dedupByDesigner:false/.test(H) &&
  /roteiro:     \{designerSla:false/.test(H));
ok('P2 PANEL-CORE intacto: resolveTaskDisplayState mantém now=now||Date.now() (default; callers passam canônico)',
  /function resolveTaskDisplayState\(t,now,dtMsFn\)\{\s*now=now\|\|Date\.now\(\);/.test(H));
ok('P3 criação atômica preservada (designerAssignment + designerSla + assigneeId + status afazer no MESMO add)',
  /data\.designerAssignment=\{ designerId:f\.assigneeId/.test(H) && /data\.designerFlowStatus='afazer'; data\.designerWorkflowStage='afazer';/.test(H) && /data\.status='afazer';/.test(H));
ok('P4 temas aprovados preservados (data.videos = [{id,n,tema}])',
  /data\.videos=_vids;/.test(H) && /videoTema/.test(H));
ok('P5 correção B1/R2 dos campos de horário preservada (_isTimeDateEl + janela de graça)',
  /function _isTimeDateEl\(el\)\{/.test(H) && /_fieldEditUntil/.test(H));
ok('P6 textos SLA canônicos preservados (media "40 minutos"/"20 minutos"; cronograma "30"/"10")',
  /Você tem 40 minutos para concluir esta tarefa\./.test(H) && /Você tem 20 minutos para concluir esta tarefa\./.test(H) &&
  /Você tem 30 minutos para concluir esta tarefa\./.test(H) && /Você tem 10 minutos para concluir esta tarefa\./.test(H));

console.log('');
console.log('RESULTADO: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('HONESTIDADE: prova o PRODUTOR ÚNICO (dedup na ORIGEM, eventId canônico) e o RELÓGIO/LINHA');
console.log('DO TEMPO canônicos (offset 0 = comportamento aprovado). A eliminação do clock-skew ENTRE');
console.log('máquinas depende de uma FONTE DE TEMPO DE SERVIDOR (STOP GATE / FASE 8 — autorização do owner).');
if (fail) process.exit(1);
