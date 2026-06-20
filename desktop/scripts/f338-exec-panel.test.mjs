#!/usr/bin/env node
/* F3.3.8-DESKTOP FASE B — TESTE do Painel Executivo (read-side, determinístico).
 * Extrai PANEL-CORE (congelado) + isTaskCompleted + EXEC-CORE (entre sentinelas) do renderer e
 * exercita slaExecAggregate/execApplyFilters/execRiskScore/execWithinPeriod com relógio simulado.
 * Puro: sem DOM real, sem rede, sem provider, sem escrita. Não toca produção.
 * Rodar: /opt/node22/bin/node desktop/scripts/f338-exec-panel.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED'); };

const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) { console.error('::error:: sentinela ausente: ' + (i < 0 ? a : b)); process.exit(1); } return html.slice(i, j + b.length); };
const fnDecl = (n) => { const m = html.match(new RegExp('function ' + n + '\\s*\\([^)]*\\)\\s*\\{')); if (!m) { console.error('::error:: não achei ' + n); process.exit(1); } let s = html.indexOf(m[0]), d = 0; for (let i = s + m[0].length - 1; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return html.slice(s, i + 1); } } return ''; };

const panelCore = slice('/* F3.3.2-PANEL-CORE BEGIN */', '/* F3.3.2-PANEL-CORE END */');
// EXEC-CORE: extrai do '/*' que abre o comentário BEGIN até o '*/' que fecha o comentário END
// (inclui os dois comentários completos + o JS entre eles → sempre parseável).
const _bi = html.indexOf('F3.3.8-EXEC-CORE BEGIN'), _ei = html.indexOf('F3.3.8-EXEC-CORE END');
if (_bi < 0 || _ei < 0) { console.error('::error:: sentinela EXEC-CORE ausente'); process.exit(1); }
const execCore = html.slice(html.lastIndexOf('/*', _bi), html.indexOf('*/', _ei) + 2);
const isComp = fnDecl('isTaskCompleted');

const api = new Function(
  'var document={getElementById:function(){return null;},createElement:function(){return {};},head:{appendChild:function(){}}};' +
  'var dtMs=function(){return 0;};' +
  panelCore + '\n' + isComp + '\n' + execCore + '\n' +
  'return {slaExecAggregate,execApplyFilters,execRiskScore,execWithinPeriod,resolveTaskDisplayState,isTaskCompleted,SLA_PANEL_GRACE_MS,SLA_PANEL_WARN_MS};'
)();
const { slaExecAggregate, execApplyFilters, execRiskScore, execWithinPeriod, resolveTaskDisplayState } = api;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };
const eq = (n, a, b) => ok(n + ' (=' + b + ', obtido ' + a + ')', a === b);

const NOW = 1700000000000, MIN = 60000;
const sla = (pf, extra) => Object.assign({ plannedFinishAt: pf }, extra || {});
const T = [
  { id: 't1', client: 'ACME', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, designerSla: sla(NOW + 60 * MIN) },   // running
  { id: 't2', client: 'Nimbus', sector: 'social', designerAssignment: { designerId: 'D1' }, designerSla: sla(NOW + 20 * MIN) },     // warning
  { id: 't3', client: 'ACME', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, designerSla: sla(NOW - 5 * MIN) },    // overdue (não crítico)
  { id: 't4', client: 'ACME', sector: 'cronograma', designerAssignment: { designerId: 'D2' }, designerSla: sla(NOW - 20 * MIN) },   // crítico (>10min)
  { id: 't5', client: 'Lumen', sector: 'social', operationalStatus: 'concluido', designerAssignment: { designerId: 'D2' }, designerSla: sla(NOW - 90 * MIN, { finishedAt: NOW - 100 * MIN }) }, // concluída no prazo
  { id: 't6', client: 'Nimbus', sector: 'edicao', designerSla: sla(NOW + 15 * MIN) },                                               // sem designer, warning
  { id: 't7', client: 'ACME', sector: 'social' },                                                                                   // sem SLA
  { id: 't8', client: 'Vértice', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, designerSla: {} },                 // prazo inválido
];
const U = [{ id: 'D1', name: 'Bruno Alves' }, { id: 'D2', name: 'Marina Dias' }];

// ── sanidade dos estados base (FONTE ÚNICA) ──
ok('t1 running', resolveTaskDisplayState(T[0], NOW).state === 'running');
ok('t2 warning', resolveTaskDisplayState(T[1], NOW).state === 'warning');
ok('t3 overdue não-crítico', resolveTaskDisplayState(T[2], NOW).state === 'overdue' && resolveTaskDisplayState(T[2], NOW).critical === false);
ok('t4 overdue CRÍTICO (finish+10min)', resolveTaskDisplayState(T[3], NOW).critical === true);
ok('t5 completed', resolveTaskDisplayState(T[4], NOW).state === 'completed');
ok('t7 sem SLA => none', resolveTaskDisplayState(T[6], NOW).state === 'none');

// ── agregação total (período 'all') ──
const A = slaExecAggregate(T, U, NOW, { periodo: 'all' });
eq('count = 8 tarefas consideradas', A.count, 8);
eq('totais.ativas (hasSla && !concluída)', A.totais.ativas, 6);
eq('totais.prazo (running)', A.totais.prazo, 1);
eq('totais.laranja (warning)', A.totais.laranja, 2);
eq('totais.atras (overdue não-crítico)', A.totais.atras, 1);
eq('totais.critico', A.totais.critico, 1);

// ── ranking por designer ──
const d1 = A.porDesigner.filter(x => x.id === 'D1')[0];
const d2 = A.porDesigner.filter(x => x.id === 'D2')[0];
ok('D1 presente', !!d1); ok('D2 presente', !!d2);
eq('D1 carga (4 não-concluídas)', d1.carga, 4);
eq('D1 laranja', d1.laranja, 1);
eq('D1 atras', d1.atras, 1);
eq('D1 % no prazo (tem atraso, 0 concluídas) = 0', d1.pctNoPrazo, 0);
eq('D1 atraso médio ~5min', d1.atrasoMedMin, 5);
eq('D2 crítico', d2.critico, 1);
eq('D2 % no prazo (1/1 concluída no prazo) = 100', d2.pctNoPrazo, 100);
eq('D2 atraso médio ~20min', d2.atrasoMedMin, 20);
ok('ranking ordena por risco e carga (D1 antes de D2)', A.porDesigner[0].id === 'D1');
eq('execRiskScore determinístico', execRiskScore({ critico: 2, atras: 1, laranja: 3 }), 6 + 2 + 3);

// ── clientes / tipos com mais atraso ──
const acme = A.porCliente.filter(c => c.k === 'ACME')[0];
ok('cliente ACME lidera atrasos', A.porCliente[0].k === 'ACME');
eq('ACME atrasos (t3+t4)', acme.atras, 2);
eq('ACME críticos (t4)', acme.critico, 1);
eq('tipo cronograma lidera atraso', A.porTipo[0].k, 'cronograma');

// ── críticas recentes / próximos vencimentos ──
ok('crítica mais grave primeiro (t4 crítico)', A.criticasRecentes[0].t.id === 't4');
eq('próximos vencimentos = 3 (running+warning)', A.proximosVencimentos.length, 3);
ok('próximo vencimento mais cedo primeiro (t6 +15min)', A.proximosVencimentos[0].t.id === 't6');
ok('distribuição reflete os totais', A.distribuicao[0].v === 1 && A.distribuicao[3].v === 1);

// ── filtros client-side ──
eq('filtro designer=D1', execApplyFilters(T, { designer: 'D1', periodo: 'all' }, NOW).length, 4);
eq('filtro statusSLA=critico', execApplyFilters(T, { statusSLA: 'critico', periodo: 'all' }, NOW).length, 1);
eq('filtro statusSLA=laranja', execApplyFilters(T, { statusSLA: 'laranja', periodo: 'all' }, NOW).length, 2);
eq('filtro cliente=ACME (t1,t3,t4,t7)', execApplyFilters(T, { cliente: 'ACME', periodo: 'all' }, NOW).length, 4);
eq('filtro tipo=cronograma (t1,t3,t4,t8)', execApplyFilters(T, { tipo: 'cronograma', periodo: 'all' }, NOW).length, 4);
eq('filtro statusSLA=concluido (t5)', execApplyFilters(T, { statusSLA: 'concluido', periodo: 'all' }, NOW).length, 1);

// ── período ──
ok('execWithinPeriod: dentro de 7d (true)', execWithinPeriod({ designerSla: sla(NOW + 2 * 86400000) }, '7d', NOW, null) === true);
ok('execWithinPeriod: fora de 7d (false)', execWithinPeriod({ designerSla: sla(NOW + 10 * 86400000) }, '7d', NOW, null) === false);
ok('execWithinPeriod: período all sempre true', execWithinPeriod({ designerSla: sla(NOW + 999 * 86400000) }, 'all', NOW, null) === true);

// ── invariantes de segurança (estáticas no bloco EXEC-CORE) ──
ok('EXEC-CORE não tem escrita .set(', !/\.set\(/.test(execCore));
ok('EXEC-CORE não tem escrita .update(', !/\.update\(/.test(execCore));
ok('EXEC-CORE não tem setDoc/addDoc/deleteDoc', !/(setDoc|addDoc|deleteDoc|updateDoc)\b/.test(execCore));
ok('EXEC-CORE não chama Firestore/db.collection', !/db\.collection|firebase\.|firestore\(/.test(execCore));
ok('EXEC-CORE não chama fetch/provider', !/\bfetch\(/.test(execCore));
ok('EXEC-CORE não reabre Kanban/SLA Monitor/notif (sem reatribuição)', !/(kbv2[A-Za-z]*\s*=|slamon[A-Za-z]*\s*=|notifShowToast\s*=)/.test(execCore));
ok('EXEC-CORE reusa resolveTaskDisplayState', /resolveTaskDisplayState\(/.test(execCore));
ok('EXEC-CORE reusa isTaskCompleted', /isTaskCompleted\(/.test(execCore));
ok('EXEC-CORE reusa slaPanelFinishMs via resolveCanonicalDeadline', /resolveCanonicalDeadline\(/.test(execCore));
ok('EXEC tab é aditiva (entrada de nav exec)', /\{k:'exec',l:'Executivo',i:'gauge'\}/.test(html));
ok('render() roteia exec sem tocar outras tabs', /else if\(state\.tab==='exec'\)\{c\.innerHTML=renderExecPanel\(\);afterExecPanel\(\);\}/.test(html));

console.log(`\nF3.3.8 EXEC-PANEL: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error:: painel executivo divergiu do contrato'); process.exit(1); }
console.log('OK — agregador read-side determinístico; filtros corretos; zero escrita/provider; tela aditiva (tab exec). Kanban/SLA Monitor/notificações intactos (regressão na suíte).');
