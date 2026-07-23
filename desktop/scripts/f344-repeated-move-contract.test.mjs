#!/usr/bin/env node
/* =====================================================================================
 * F3.4.4 — CONTRATO DA MOVIMENTAÇÃO REPETIDA (RED forense + GREEN 30).
 *
 * SEÇÃO A — PROVA RED (forense, reprodutível p/ sempre): extrai VERBATIM o produtor de
 * fluxo LEGADO do baseline ESTÁVEL 1.0.180 (git blob 68598fa:desktop/src/renderer/index.html,
 * imutável) e reproduz os 8 cenários do mandato, comprovando os 3 defeitos compostos:
 *   D1 identidade sem transição (dedupKey=eventType:taskId:faseATUAL — sem from, sem carimbo);
 *   D2 persistência vitalícia (localStorage idseven.notif.seen.v1; poda só >400 chaves E >7d);
 *   D3 retornos sem evento (notifFlowEvent não mapeia awaiting_designer/planning como destino).
 * Registra o PRIMEIRO PONTO DE DESCARTE de cada transição perdida (criação do evento × dedupe).
 *
 * SEÇÃO B — GREEN (contrato F3.4.4, 30 itens): dirige o NOVO núcleo puro do main
 * (slaRules: deriveCanonicalTaskState portado + createFlowDetector + flowEmissionFor) e
 * verifica: 1 notificação por transição REAL (A→B, B→A, A→B de novo, A→B→C, A→B→A→B),
 * replay/snapshot/campo irrelevante/responsável sem quadro = 0, seed/restart sem histórico,
 * dedupKey por transição concreta, ZERO bloqueio vitalício, destinatários preservados,
 * payload (título/texto/severidade/etapa/deep link) preservado, e BYTE-preservação das
 * regiões não autorizadas (deliverNotification/notifRoute/saveTask/u1/u1b/u2/SLA).
 *
 * Rodar: node desktop/scripts/f344-repeated-move-contract.test.mjs
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { applyF345SlaDelta } from './fixtures/f345/authorized-delta.mjs'; // F3.4.5 — delta AUTORIZADO do clamp planStartAt
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const STABLE = '68598fae54e75dd34a399ffca65649cc8ff6d16c'; // Desktop 1.0.180 oficial (tag v1.0.180)
// EOL-NORMALIZAÇÃO (lição F3.4.3 no runner Windows): o checkout aplica autocrlf (árvore de
// trabalho = CRLF) e `git show` emite o BLOB (LF) — comparar bytes crus daria falso-negativo.
// Normalizamos AMBOS os lados p/ LF: a prova aqui é identidade de CONTEÚDO; a byte-identidade
// rastreada (EOL-imune) é dos gates region-invariance (blob git hash-object × rev-parse).
const nrm = (s) => String(s).replace(/\r\n/g, '\n');
const gitShow = (spec) => nrm(execFileSync('git', ['-C', ROOT, 'show', spec], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
const BASE_HTML = gitShow(STABLE + ':desktop/src/renderer/index.html');
const CUR_HTML = nrm(fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8'));
const BASE_MAIN = gitShow(STABLE + ':desktop/src/main/main.ts');
const CUR_MAIN = nrm(fs.readFileSync(path.join(DESK, 'src', 'main', 'main.ts'), 'utf8'));
const BASE_NOTIF = gitShow(STABLE + ':desktop/src/main/notifier.ts');
const CUR_NOTIF = nrm(fs.readFileSync(path.join(DESK, 'src', 'main', 'notifier.ts'), 'utf8'));
const BASE_RULES = gitShow(STABLE + ':desktop/src/main/slaRules.js');
const CUR_RULES = nrm(fs.readFileSync(path.join(DESK, 'src', 'main', 'slaRules.js'), 'utf8'));
const rules = require(path.join(DESK, 'src', 'main', 'slaRules.js'));

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

function grabFrom(SRC, name) {
  const a = SRC.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('função não encontrada: ' + name);
  let d = 0;
  for (let j = SRC.indexOf('{', a); j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(a, j + 1); } }
  throw new Error('sem fim: ' + name);
}
function grabDeclFrom(SRC, marker) {
  const a = SRC.indexOf(marker);
  if (a < 0) throw new Error('decl não encontrada: ' + marker);
  let round = 0, sq = 0, cur = 0;
  for (let j = a + marker.length; j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '(') round++; else if (c === ')') round--;
    else if (c === '[') sq++; else if (c === ']') sq--;
    else if (c === '{') cur++; else if (c === '}') cur--;
    else if (c === ';' && round === 0 && sq === 0 && cur === 0) return SRC.slice(a, j + 1);
  }
  throw new Error('decl sem ; : ' + marker);
}

/* ══════════════ SEÇÃO A — PROVA RED forense (baseline 68598fa, imutável) ══════════════ */
function legacyHarness() {
  const S = BASE_HTML;
  const SRC = [
    grabDeclFrom(S, 'const SECTORS='), grabDeclFrom(S, 'const SECTOR_ALIAS='), grabDeclFrom(S, 'const TASK_PHASE='),
    grabDeclFrom(S, 'var NOTIF_PHASE_LABEL='), grabDeclFrom(S, "var NOTIF_SEEN_KEY="), grabDeclFrom(S, 'var _notifPhase='),
    grabFrom(S, 'secOf'), grabFrom(S, 'isClientSector'), grabFrom(S, 'isTaskCompleted'), grabFrom(S, 'hasDesigner'),
    grabFrom(S, 'designerCol'), grabFrom(S, 'pendingLegend'), grabFrom(S, 'pendingFeed'), grabFrom(S, 'pendingStory'),
    grabFrom(S, 'pendingProduction'), grabFrom(S, 'designerDelivered'), grabFrom(S, 'clientApprovalPhaseOf'),
    grabFrom(S, 'pendingClientItems'), grabFrom(S, 'hasPendingItemRevision'), grabFrom(S, 'isFullyComplete'),
    grabFrom(S, 'flowCompletedSignal'), grabFrom(S, 'flowSentToClientSignal'), grabFrom(S, 'flowClientChangesSignal'),
    grabFrom(S, 'flowThemesApprovedSignal'), grabFrom(S, 'flowThemesSentSignal'), grabFrom(S, 'deriveCanonicalTaskState'),
    grabFrom(S, 'notifPhaseLabel'), grabFrom(S, 'notifFlowEvent'), grabFrom(S, 'resolveNotificationTargets'),
    grabFrom(S, 'notifBuildPayload'), grabFrom(S, 'notifLoadSeen'), grabFrom(S, 'notifSaveSeen'),
    grabFrom(S, 'notifSeenHas'), grabFrom(S, 'notifSeenMark'), grabFrom(S, 'notifEmit'), grabFrom(S, 'notifScanFlow'),
  ].join('\n');
  const PRE = [
    'var STORE={};',
    'var localStorage={getItem:function(k){return Object.prototype.hasOwnProperty.call(STORE,k)?STORE[k]:null;},setItem:function(k,v){STORE[k]=String(v);}};',
    'var CAP=[];',
    'var window={__notifSuppress:false, desktopAPI:{notify:function(p){CAP.push(p);}}};',
    'var state={user:null,tasks:[]};',
    'var canSeeAll=function(){return false;};',
    'var notifResponsible=function(){return {id:"D1",name:"Designer",avatar:""};};',
    'var notifActor=function(){return {id:"S1",name:"Social",avatar:""};};',
    'var ncDiag=function(){};',
    'var notifHistoryAppend=function(){};',
    'var notifShowToast=function(){};',
  ].join('\n');
  return new Function(PRE + '\n' + SRC + '\n' + [
    'return {',
    ' scan:function(){ notifScanFlow(); },',
    ' setUser:function(u){ state.user=u; },',
    ' setTasks:function(a){ state.tasks=a; },',
    ' resetRuntime:function(){ _notifPhase={}; _notifBaseline=false; _notifUid=null; },  // restart do renderer (localStorage SOBREVIVE)',
    ' CAP:CAP, STORE:STORE,',
    ' seenHas:notifSeenHas, seenMark:notifSeenMark, flowEvent:notifFlowEvent,',
    '};',
  ].join('\n'))();
}

{
  const L = legacyHarness();
  const T1 = { id: 'T1', sector: 'edicao_midia', title: 'Peça', client: 'ACME', assigneeId: 'D1', by: 'S1', status: 'afazer' };
  L.setUser({ id: 'D1' });

  // r1 — seed do 1º snapshot NÃO emite (comportamento correto preservado)
  L.setTasks([{ ...T1 }]); L.scan();
  ok('A r1 LEGADO: seed do 1º snapshot não emite', L.CAP.length === 0);

  // r2 — 1º movimento A→B (A Fazer→Em produção) EMITE (GREEN físico do owner)
  L.setTasks([{ ...T1, status: 'andamento' }]); L.scan();
  ok('A r2 LEGADO: 1ª A→B emite 1 (flow_production_started)', L.CAP.length === 1 && L.CAP[0].eventType === 'flow_production_started');
  const KEY_AB = 'flow_production_started:T1:designer_producing';
  ok('A r2 LEGADO (D1): dedupKey NÃO representa a transição — só (taskId, fase-destino): ' + KEY_AB,
    L.CAP[0].dedupKey === KEY_AB && L.CAP[0].dedupKey.indexOf('awaiting_designer') < 0);

  // r3 — retorno B→A (Em produção→A Fazer) NÃO emite; descarte na CRIAÇÃO DO EVENTO (D3)
  L.setTasks([{ ...T1, status: 'afazer' }]); L.scan();
  ok('A r3 LEGADO (RED): retorno B→A emite 0 (contrato exige 1)', L.CAP.length === 1);
  ok('A r3 PONTO DE DESCARTE: criação do evento — notifFlowEvent(designer_producing→awaiting_designer)===null (D3)',
    L.flowEvent('designer_producing', 'awaiting_designer') === null && L.flowEvent('designer_producing', 'planning') === null);

  // r4 — A→B NOVAMENTE não emite; descarte no DEDUPE persistente do renderer (D1+D2), ANTES do main
  ok('A r4 pré-condição: chave já marcada no localStorage (D2)', L.seenHas(KEY_AB) === true);
  L.setTasks([{ ...T1, status: 'andamento' }]); L.scan();
  ok('A r4 LEGADO (RED): A→B de novo emite 0 (contrato exige 1); descarte no DEDUPE (notifSeenHas antes do api.notify)', L.CAP.length === 1);

  // r5a — tarefa VETERANA (fases já visitadas na vida real): A→B→C emite 0 — "só funciona uma vez por tarefa"
  const T2 = { ...T1, id: 'T2', status: 'afazer' };
  L.seenMark('flow_production_started:T2:designer_producing'); L.seenMark('flow_in_review:T2:designer_revising');
  L.setTasks([{ ...T2 }]); L.scan();
  L.setTasks([{ ...T2, status: 'andamento' }]); L.scan();
  L.setTasks([{ ...T2, status: 'revisao' }]); L.scan();
  ok('A r5a LEGADO (RED): tarefa veterana A→B→C emite 0 (bloqueio vitalício por (taskId,fase))', L.CAP.length === 1);

  // r5b — tarefa VIRGEM: A→B→C emite 2 (1ª visita a cada fase); QUALQUER repetição = 0
  const T3 = { ...T1, id: 'T3', status: 'afazer' };
  L.setTasks([{ ...T3 }]); L.scan();
  L.setTasks([{ ...T3, status: 'andamento' }]); L.scan();
  L.setTasks([{ ...T3, status: 'revisao' }]); L.scan();
  ok('A r5b LEGADO: virgem A→B→C emite 2 (cada fase-destino SÓ na 1ª visita da vida)', L.CAP.length === 3);
  L.setTasks([{ ...T3, status: 'afazer' }]); L.scan();     // C→A: destino sem evento (D3) → 0
  L.setTasks([{ ...T3, status: 'andamento' }]); L.scan();  // A→B repetida (D1+D2) → 0
  L.setTasks([{ ...T3, status: 'revisao' }]); L.scan();    // B→C repetida (D1+D2) → 0
  ok('A r5b LEGADO (RED): repetição integral A→B→C emite 0 (contrato exige 3)', L.CAP.length === 3);

  // r6 — A→B→A→B: só a 1ª emite (contrato exige 3)
  const T4 = { ...T1, id: 'T4', status: 'afazer' };
  L.setTasks([{ ...T4 }]); L.scan();
  L.setTasks([{ ...T4, status: 'andamento' }]); L.scan();
  L.setTasks([{ ...T4, status: 'afazer' }]); L.scan();
  L.setTasks([{ ...T4, status: 'andamento' }]); L.scan();
  ok('A r6 LEGADO (RED): A→B→A→B emite 1 (contrato exige 3)', L.CAP.length === 4);

  // r7 — snapshot duplicado sem mudança: 0 (correto hoje E no contrato)
  L.setTasks([{ ...T4, status: 'andamento' }]); L.scan();
  ok('A r7 LEGADO: snapshot repetido não emite', L.CAP.length === 4);

  // r8 — alteração irrelevante (título) sem mudança de quadro: 0 (correto hoje E no contrato)
  L.setTasks([{ ...T4, status: 'andamento', title: 'Peça v2' }]); L.scan();
  ok('A r8 LEGADO: alteração de título não emite', L.CAP.length === 4);

  // r9 — RESTART do renderer: seed não emite ✔; mas o bloqueio vitalício SOBREVIVE (localStorage)
  L.resetRuntime();
  L.setTasks([{ ...T4, status: 'afazer' }]); L.scan();
  ok('A r9 LEGADO: pós-restart, seed não emite histórico', L.CAP.length === 4);
  L.setTasks([{ ...T4, status: 'andamento' }]); L.scan();
  ok('A r9 LEGADO (RED): 1ª movimentação REAL pós-restart emite 0 (bloqueio persistido em localStorage — contrato exige 1)', L.CAP.length === 4);

  // r10 — vida útil do dedupe: 399 chaves frescas → NENHUMA poda (só >400 E >7 dias)
  for (let i = 0; i < 380; i++) L.seenMark('k' + i);
  const kept = Object.keys(JSON.parse(L.STORE['idseven.notif.seen.v1'])).length;
  ok('A r10 LEGADO: dedupe persistente sem TTL real p/ <400 chaves (mantidas=' + kept + ')', kept >= 380 && L.seenHas(KEY_AB) === true);
}

/* ══════════════ SEÇÃO B — GREEN: contrato F3.4.4 no NOVO núcleo (main) ══════════════ */
/* HUB do main (deliverNotification) simulado fielmente: Set em memória por dedupKey. */
function mkHub() { const SEEN = new Set(); const OUT = []; return { OUT, deliver(p) { if (!p) return; if (SEEN.has(p.dedupKey)) return; SEEN.add(p.dedupKey); OUT.push(p); } }; }
/* escritores REAIS: movimento grava o eixo + history {kind,at,byId,from,to} (index.html:6022/6054) */
function move(t, axis, to, by, at) {
  const from = axis === 'designerFlowStatus' ? (t.designerFlowStatus || 'afazer') : (t.status || 'afazer');
  t = JSON.parse(JSON.stringify(t)); t[axis] = to;
  t.history = (t.history || []).concat(axis === 'designerFlowStatus'
    ? [{ kind: 'designer_moved', axis, from, to, byUid: by, byId: by, at, atMs: at, source: 'desktop' }]
    : [{ kind: 'moved', at, byId: by, from, to }]);
  return t;
}

{
  const uid = 'D1';
  const det = rules.createFlowDetector();
  const hub = mkHub();
  const emitTo = (t, seeAll, u) => { const ev = det.scanDoc(t); if (!ev) return null; return rules.flowEmissionFor(t, u || uid, !!seeAll, ev); };
  const push = (t, seeAll, u) => { const p = emitTo(t, seeAll, u); if (p) hub.deliver(p); return p; };

  let t = { id: 'T1', sector: 'edicao_midia', title: 'Peça', client: 'ACME', assigneeId: 'D1', by: 'S1', status: 'afazer', history: [] };

  // g11 — primeiro snapshot APENAS semeia (não emite)
  ok('B g11 seed do 1º snapshot não emite', push(t) === null && hub.OUT.length === 0);
  det.sealSeed();

  // g1 — A→B notifica UMA vez (texto/severidade/etapa/deep preservados)
  t = move(t, 'status', 'andamento', 'D1', 1000); push(t);
  ok('B g1 A→B emite exatamente 1', hub.OUT.length === 1);
  ok('B g1 payload preservado (título/severidade/etapa/corpo/deep/destino)',
    hub.OUT[0].eventType === 'flow_production_started' && hub.OUT[0].title === 'Produção iniciada' &&
    hub.OUT[0].severity === 'info' && hub.OUT[0].etapa === 'Em produção' && hub.OUT[0].status === 'designer_producing' &&
    hub.OUT[0].body === 'Peça — ACME' && hub.OUT[0].action.deep === 'detail/T1' && hub.OUT[0].targetUserId === 'D1' &&
    hub.OUT[0].notificationType === 'team_flow' && hub.OUT[0].providerCalled === false);

  // g2 — B→A (retorno) notifica UMA vez
  t = move(t, 'status', 'afazer', 'D1', 2000); push(t);
  ok('B g2 B→A emite exatamente 1 (flow_returned_to_todo)', hub.OUT.length === 2 && hub.OUT[1].eventType === 'flow_returned_to_todo' && hub.OUT[1].title === 'Tarefa retornou para A Fazer');

  // g3 — A→B NOVAMENTE notifica UMA vez
  t = move(t, 'status', 'andamento', 'D1', 3000); push(t);
  ok('B g3 A→B de novo emite exatamente 1', hub.OUT.length === 3 && hub.OUT[2].eventType === 'flow_production_started');

  // g4 — A→B→C: UMA notificação POR TRANSIÇÃO REAL (B→C aqui; ciclo A→B→C→B fecha 3 no g5-ciclo)
  t = move(t, 'status', 'revisao', 'D1', 4000); push(t);
  ok('B g4 B→C emite exatamente 1 (flow_in_review)', hub.OUT.length === 4 && hub.OUT[3].eventType === 'flow_in_review' && hub.OUT[3].etapa === 'Em revisão');
  t = move(t, 'status', 'andamento', 'D1', 5000); push(t);
  ok('B g4 C→B emite exatamente 1 (cada mudança real do ciclo notifica)', hub.OUT.length === 5);

  // g5 — A→B→A→B gera 3 eventos (T2 limpo)
  {
    let u = { id: 'T2', sector: 'edicao_midia', title: 'X', client: '', assigneeId: 'D1', by: 'S1', status: 'afazer', history: [] };
    const d2 = rules.createFlowDetector(); const h2 = mkHub();
    const p2 = (tt) => { const ev = d2.scanDoc(tt); if (!ev) return; const p = rules.flowEmissionFor(tt, uid, false, ev); if (p) h2.deliver(p); };
    p2(u); d2.sealSeed();
    u = move(u, 'status', 'andamento', 'D1', 10); p2(u);
    u = move(u, 'status', 'afazer', 'D1', 20); p2(u);
    u = move(u, 'status', 'andamento', 'D1', 30); p2(u);
    ok('B g5 A→B→A→B gera exatamente 3 eventos', h2.OUT.length === 3);
    ok('B g19 dedupKey MUDA entre transições reais (3 chaves distintas)', new Set(h2.OUT.map((p) => p.dedupKey)).size === 3);
  }

  // g6 — "movimento" repetido no MESMO quadro (regravação do mesmo eixo) não notifica
  const same = move(t, 'status', 'andamento', 'D1', 6000); push(same);
  ok('B g6 regravar o MESMO quadro não emite (fase igual)', hub.OUT.length === 5);

  // g7/g20 — snapshot repetido (MESMO doc) não duplica; replay idêntico teria a MESMA identidade
  const replayEv = det.scanDoc(JSON.parse(JSON.stringify(same)));
  ok('B g7 snapshot repetido não emite (detector)', replayEv === null && hub.OUT.length === 5);
  ok('B g20 replay idêntico = mesma identidade → HUB deduplica', (() => { const k = hub.OUT[4].dedupKey; const before = hub.OUT.length; hub.deliver({ ...hub.OUT[4], dedupKey: k }); return hub.OUT.length === before; })());

  // g8 — alteração irrelevante (título) sem mudança de quadro não notifica
  { const t8 = JSON.parse(JSON.stringify(same)); t8.title = 'Peça v3'; ok('B g8 alteração de título não emite', det.scanDoc(t8) === null && hub.OUT.length === 5); }

  // g9 — troca de RESPONSÁVEL sem mudança de quadro não gera fluxo (regra aprovada: azul u1b)
  { const t9 = JSON.parse(JSON.stringify(same)); t9.assigneeId = 'D2'; t9.assignee = 'Outro'; ok('B g9 troca de responsável sem quadro não gera fluxo', det.scanDoc(t9) === null); }

  // g10 — mudança real atualiza o previousState (próximo evento tem from correto)
  { let ta = move(same, 'status', 'revisao', 'D1', 7000); const ev = det.scanDoc(ta); ok('B g10 previousState atualizado após cada snapshot (from=designer_producing→to=designer_revising)', !!ev && ev.fromPhase === 'designer_producing' && ev.toPhase === 'designer_revising'); }

  // g12/g13 — RESTART: novo detector semeia sem histórico; 1ª movimentação REAL depois notifica
  {
    const d3 = rules.createFlowDetector(); const h3 = mkHub();
    let u = { id: 'T1', sector: 'edicao_midia', title: 'Peça', client: 'ACME', assigneeId: 'D1', by: 'S1', status: 'andamento', history: [{ kind: 'moved', at: 5000, byId: 'D1', from: 'afazer', to: 'andamento' }] };
    const p3 = (tt) => { const ev = d3.scanDoc(tt); if (!ev) return; const p = rules.flowEmissionFor(tt, uid, false, ev); if (p) h3.deliver(p); };
    p3(u); d3.sealSeed();
    ok('B g12 restart: seed com tarefa já movida NÃO emite histórico', h3.OUT.length === 0);
    u = move(u, 'status', 'afazer', 'D1', 9000); p3(u);
    ok('B g13 restart: 1ª movimentação REAL depois do seed emite 1', h3.OUT.length === 1 && h3.OUT[0].eventType === 'flow_returned_to_todo');
  }

  // g21 — NENHUM bloqueio vitalício por taskId: 8 transições reais seguidas → 8 eventos
  {
    const d4 = rules.createFlowDetector(); const h4 = mkHub();
    let u = { id: 'T9', sector: 'edicao_midia', title: 'Y', client: '', assigneeId: 'D1', by: 'S1', status: 'afazer', history: [] };
    const p4 = (tt) => { const ev = d4.scanDoc(tt); if (!ev) return; const p = rules.flowEmissionFor(tt, uid, false, ev); if (p) h4.deliver(p); };
    p4(u); d4.sealSeed();
    const seqs = ['andamento', 'afazer', 'andamento', 'revisao', 'andamento', 'afazer', 'andamento', 'concluido'];
    seqs.forEach((s, i) => { u = move(u, 'status', s, 'D1', 100 + i * 10); p4(u); });
    ok('B g21 zero bloqueio vitalício: 8 transições reais = 8 eventos (última = Tarefa concluída)', h4.OUT.length === 8 && h4.OUT[7].eventType === 'flow_completed');
    // reabertura após concluído também emite
    u = move(u, 'status', 'andamento', 'D1', 999); p4(u);
    ok('B g21b reabertura concluído→produção emite (transição real)', h4.OUT.length === 9 && h4.OUT[8].eventType === 'flow_production_started');
  }

  // EIXO DO DESIGNER (cronograma): retorno ao A Fazer emite; ATRIBUIÇÃO continua silenciosa no fluxo
  {
    const d5 = rules.createFlowDetector(); const h5 = mkHub();
    const base = { id: 'T5', sector: 'cronograma', title: 'Cron', client: 'ACME', by: 'S1', history: [] };
    const p5 = (tt, u2, sa) => { const ev = d5.scanDoc(tt); if (!ev) return null; const p = rules.flowEmissionFor(tt, u2 || uid, !!sa, ev); if (p) h5.deliver(p); return p; };
    let u = { ...base };
    p5(u); d5.sealSeed();
    // atribuição (planning→awaiting_designer): fluxo NÃO emite (azul designer_assigned u1b é a única)
    u = JSON.parse(JSON.stringify(u)); u.designerAssignment = { designerId: 'D1', designerName: 'Ana', assignedBy: 'S1', assignedAt: 111 }; u.designerFlowStatus = 'afazer';
    ok('B extra: atribuição não duplica no fluxo (planning→awaiting_designer = null)', d5.scanDoc(u) === null && h5.OUT.length === 0);
    u = move(u, 'designerFlowStatus', 'andamento', 'D1', 200); p5(u);
    u = move(u, 'designerFlowStatus', 'afazer', 'D1', 300); p5(u);
    ok('B extra: eixo designer A Fazer↔Em produção emite 1+1 (retorno incluído)', h5.OUT.length === 2 && h5.OUT[1].eventType === 'flow_returned_to_todo');
    // dedupKey carrega from>to + uid + carimbo autoritativo (não só taskId)
    ok('B g19b identidade da transição concreta: ' + h5.OUT[1].dedupKey,
      /^flow_returned_to_todo:T5:designer_producing>awaiting_designer:D1:300:h\d+:c\d+$/.test(h5.OUT[1].dedupKey));
  }

  // DESTINATÁRIOS preservados (team_flow): equipe da tarefa + supervisão; fora da equipe sem vê-tudo = nada
  {
    const tt = { id: 'T6', sector: 'edicao_midia', title: 'Z', client: '', assigneeId: 'D1', by: 'S1', status: 'andamento', history: [{ kind: 'moved', at: 10, byId: 'D1', from: 'afazer', to: 'andamento' }] };
    const ev = { eventType: 'flow_production_started', title: 'Produção iniciada', severity: 'info', fromPhase: 'awaiting_designer', toPhase: 'designer_producing', stamp: '10:h1:c0' };
    ok('B destinatários: designer responsável recebe', rules.flowEmissionFor(tt, 'D1', false, ev) !== null);
    ok('B destinatários: autor (by) recebe', rules.flowEmissionFor(tt, 'S1', false, ev) !== null);
    ok('B destinatários: fora da equipe SEM vê-tudo NÃO recebe', rules.flowEmissionFor(tt, 'X9', false, ev) === null);
    ok('B destinatários: supervisão (vê-tudo) recebe', rules.flowEmissionFor(tt, 'X9', true, ev) !== null);
  }
}

/* ══════════════ SEÇÃO C — WIRING + BYTE-PRESERVAÇÃO (arquitetura do mandato) ══════════════ */
{
  // produtor único: renderer neutralizado (sem produtor paralelo); notifScanFlow segue definida SEM chamador
  ok('C wiring: renderer notifScan é no-op (function notifScan(){})', /function notifScan\(\)\{\}/.test(CUR_HTML));
  // convenção f343-preservation: `notifScanFlow()` casa também a DEFINIÇÃO → 1 = só a definição, 0 chamadores
  ok('C wiring: notifScanFlow SEM chamador no renderer (1 ocorrência = só a definição)', (CUR_HTML.match(/notifScanFlow\(\)/g) || []).length === 1);
  ok('C wiring: notifScanFlow segue DEFINIDA (diff mínimo/QA)', /function notifScanFlow\(\)\{/.test(CUR_HTML));
  // produtor autoritativo no MAIN
  ok('C wiring: notifier.u3 usa createFlowDetector + flowEmissionFor + seed selado no 1º snapshot',
    /createFlowDetector\(\)/.test(CUR_NOTIF) && /flowEmissionFor\(/.test(CUR_NOTIF) && /sealSeed\(\)/.test(CUR_NOTIF) && /flow\.producer/.test(CUR_NOTIF));
  ok('C wiring: teardown desliga u3 junto (u1(); u1b(); u3(); u2();)', /u1\(\); u1b\(\); u3\(\); u2\(\);/.test(CUR_NOTIF));
  ok('C wiring: main passa o papel AUTENTICADO ao notifier (roteamento vê-tudo)', /startNotifier\(\(\) => mainWin, uid, deliverNotification, getAuthUser\)/.test(CUR_MAIN));
  // deliverNotification (HUB) BYTE-idêntico ao estável (canais toast/bgNotify/nativa + clique preservados)
  ok('C byte: deliverNotification idêntico a 68598fa', grabFrom(CUR_MAIN, 'deliverNotification') === grabFrom(BASE_MAIN, 'deliverNotification'));
  // renderer: notifRoute/saveTask/notifEmit/notifSeen*/notifBuildPayload/notifScanFlow byte-idênticos (delta = SÓ notifScan)
  for (const fn of ['notifRoute', 'saveTask', 'notifEmit', 'notifSeenHas', 'notifSeenMark', 'notifBuildPayload', 'notifScanFlow', 'notifScanSla', 'notifScanAssign', 'notifShowToast', 'notifNormalize']) {
    ok('C byte: ' + fn + ' idêntico a 68598fa', grabFrom(CUR_HTML, fn) === grabFrom(BASE_HTML, fn));
  }
  // notifier: u1/u1b/u2 VERBATIM do estável (atribuição azul + eventos intocados)
  {
    const sliceBase = (a, b) => { const i = BASE_NOTIF.indexOf(a); const j = BASE_NOTIF.indexOf(b, i); if (i < 0 || j < 0) throw new Error('slice notifier'); return BASE_NOTIF.slice(i, j); };
    const U1U1B = sliceBase('  // tasks: TAREFA DIRETA', '  // events: novo compromisso para mim');
    const U2 = sliceBase('  // events: novo compromisso para mim', '  return () =>');
    ok('C byte: blocos u1+u1b do notifier VERBATIM (azul única preservada)', CUR_NOTIF.indexOf(U1U1B) >= 0);
    ok('C byte: bloco u2 (events) VERBATIM', CUR_NOTIF.indexOf(U2) >= 0);
  }
  // slaRules: TODO o conteúdo SLA pré-existente é PREFIXO byte-idêntico — F3.4.5 re-ancora: a base
  // 68598fa recebe SOMENTE o delta AUTORIZADO do hotfix do timestamp da amarela (clamp planStartAt,
  // fonte única fixtures/f345/authorized-delta.mjs); QUALQUER outro byte na região SLA reprova.
  {
    const basePrefix = BASE_RULES.slice(0, BASE_RULES.indexOf('module.exports = {'));
    ok('C byte: slaRules SLA intacto (F3.4.4 aditivo + delta AUTORIZADO F3.4.5, nada mais)', CUR_RULES.indexOf(applyF345SlaDelta(basePrefix)) === 0);
  }
  // dedupe NOVO nunca colide com chaves legadas persistidas (formatos disjuntos)
  ok('C formatos disjuntos: identidade nova sempre contém ">" e o legado nunca', 'flow_production_started:T1:awaiting_designer>designer_producing:D1:1:h1:c0'.indexOf('>') > 0 && 'flow_production_started:T1:designer_producing'.indexOf('>') < 0);
}

console.log('\n===== F3.4.4 — CONTRATO MOVIMENTAÇÃO REPETIDA (RED forense + GREEN) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F344-CONTRATO: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: contrato F3.4.4 violado'); process.exit(1); }
console.log('OK — defeito legado comprovado (D1+D2+D3, baseline imutável 68598fa); novo produtor no MAIN cumpre 1-notificação-por-transição-real com replay/seed/restart limpos; regiões não autorizadas byte-idênticas.');
