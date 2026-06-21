#!/usr/bin/env node
/* F3.3.9-DESKTOP FASE B — TESTE dos Relatórios de Atraso + Exportação (read-side, determinístico).
 * Extrai PANEL-CORE (congelado) + isTaskCompleted + EXEC-CORE (F3.3.8, reusado) + REPORTS-CORE e
 * exercita slaExecReports/reportsFilter/execPeriodBuckets/execTaskLateCount/toCSV com relógio simulado.
 * Puro: sem DOM real, sem rede, sem provider, sem escrita, sem IPC. Não toca produção.
 * Rodar: /opt/node22/bin/node desktop/scripts/f339-reports.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED'); };

const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) { console.error('::error:: sentinela ausente'); process.exit(1); } return html.slice(i, j + b.length); };
const fnDecl = (n) => { const m = html.match(new RegExp('function ' + n + '\\s*\\([^)]*\\)\\s*\\{')); let s = html.indexOf(m[0]), d = 0; for (let i = s + m[0].length - 1; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return html.slice(s, i + 1); } } };
const span = (begin, end) => { const bi = html.indexOf(begin), ei = html.indexOf(end); if (bi < 0 || ei < 0) { console.error('::error:: span ausente'); process.exit(1); } return html.slice(html.lastIndexOf('/*', bi), html.indexOf('*/', ei) + 2); };

const panelCore = slice('/* F3.3.2-PANEL-CORE BEGIN */', '/* F3.3.2-PANEL-CORE END */');
const isComp = fnDecl('isTaskCompleted');
const execCore = span('F3.3.8-EXEC-CORE BEGIN', 'F3.3.8-EXEC-CORE END');
const repCore = span('F3.3.9-REPORTS-CORE BEGIN', 'F3.3.9-REPORTS-CORE END');

const api = new Function(
  'var document={getElementById:function(){return null;},createElement:function(){return {};},head:{appendChild:function(){}}};' +
  'var dtMs=function(){return 0;};' +
  panelCore + '\n' + isComp + '\n' + execCore + '\n' + repCore + '\n' +
  'return {slaExecReports,reportsFilter,execPeriodBuckets,execTaskLateCount,toCSV,resolveTaskDisplayState,slaExecAggregate,execApplyFilters};'
)();
const { slaExecReports, reportsFilter, execPeriodBuckets, execTaskLateCount, toCSV } = api;

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };
const eq = (n, a, b) => ok(n + ' (=' + b + ', obtido ' + a + ')', a === b);

const NOW = 1700000000000, MIN = 60000;
const sla = (pf, x) => Object.assign({ plannedFinishAt: pf }, x || {});
const T = [
  { id: 't1', client: 'ACME', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, designerSla: sla(NOW + 60 * MIN) },
  { id: 't2', client: 'Nimbus', sector: 'social', designerAssignment: { designerId: 'D1' }, designerSla: sla(NOW + 20 * MIN) },
  { id: 't3', client: 'ACME', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, designerSla: sla(NOW - 5 * MIN), history: [{ to: 'revisao' }, { kind: 'atraso' }] },     // overdue + 2 atrasos
  { id: 't4', client: 'ACME', sector: 'cronograma', designerAssignment: { designerId: 'D2' }, designerSla: sla(NOW - 25 * MIN), history: [{ kind: 'atraso' }, { to: 'revisao' }] },   // crítico + 2 atrasos
  { id: 't5', client: 'Lumen', sector: 'social', operationalStatus: 'concluido', designerAssignment: { designerId: 'D2' }, designerSla: sla(NOW - 90 * MIN, { finishedAt: NOW - 100 * MIN }) },
  { id: 't6', client: 'Nimbus', sector: 'edicao', designerSla: sla(NOW + 15 * MIN) },
  { id: 't7', client: 'ACME', sector: 'social' },
  { id: 't8', client: 'Vértice', sector: 'cronograma', designerAssignment: { designerId: 'D1' }, designerSla: {} },
];
const U = [{ id: 'D1', name: 'Bruno Alves' }, { id: 'D2', name: 'Marina Dias' }];

// ── lateCount (reincidência via history + overdue) ──
eq('execTaskLateCount t3 (revisao+atraso, overdue) = 2', execTaskLateCount(T[2], NOW, null), 2);
eq('execTaskLateCount t4 (atraso+revisao, crítico) = 2', execTaskLateCount(T[3], NOW, null), 2);
eq('execTaskLateCount t1 (running, sem history) = 0', execTaskLateCount(T[0], NOW, null), 0);

// ── filtros (toggles) ──
eq('reportsFilter sem filtro = 8', reportsFilter(T, { periodo: 'all' }, NOW, null).length, 8);
eq('reportsFilter soAtrasados = 2 (t3,t4)', reportsFilter(T, { periodo: 'all', soAtrasados: true }, NOW, null).length, 2);
eq('reportsFilter concluidas=sim = 1 (t5)', reportsFilter(T, { periodo: 'all', concluidas: 'sim' }, NOW, null).length, 1);
eq('reportsFilter concluidas=nao = 7', reportsFilter(T, { periodo: 'all', concluidas: 'nao' }, NOW, null).length, 7);
eq('reportsFilter designer=D1 = 4', reportsFilter(T, { periodo: 'all', designer: 'D1' }, NOW, null).length, 4);

// ── período buckets ──
const pb = execPeriodBuckets(T, NOW, null, 7);
eq('períodos = 7 dias', pb.length, 7);
eq('soma de atrasos no período = 2 (t3,t4 hoje)', pb.reduce((a, x) => a + x.count, 0), 2);
ok('atrasos caem no bucket de hoje (último)', pb[pb.length - 1].count === 2);

// ── relatório completo ──
const R = slaExecReports(T, U, NOW, { periodo: 'all' });
eq('count = 8', R.count, 8);
eq('KPI atraso médio = 15 ((5+25)/2)', R.kpis.atrasoMedio, 15);
eq('KPI % no prazo = 100 (t5 concluída no prazo)', R.kpis.pctNoPrazo, 100);
eq('KPI reincidentes = 2 (t3,t4)', R.kpis.reincidentes, 2);
eq('KPI críticas = 1 (t4)', R.kpis.criticas, 1);
eq('reincidentes lista = 2', R.reincidentes.length, 2);
ok('reincidente com 2 atrasos', R.reincidentes[0].lateCount === 2);
eq('histórico (lateCount>=1) = 2', R.historico.length, 2);
ok('histórico tem linha do tempo (steps)', Array.isArray(R.historico[0].steps) && R.historico[0].steps.length > 0);
eq('taskRows (overdue+crítico) = 2', R.taskRows.length, 2);
ok('porDesigner reaproveitado do F3.3.8', Array.isArray(R.porDesigner) && R.porDesigner.length === 2);
ok('porCliente/porTipo presentes', Array.isArray(R.porCliente) && Array.isArray(R.porTipo));

// ── exportação (toCSV) ──
const csv = toCSV(R.taskRows);
const lines = csv.split('\n');
ok('CSV cabeçalho com colunas esperadas', lines[0] === 'tarefa;cliente;tipo;designer;status_sla;atraso_min;reincidencias;prazo;concluida');
eq('CSV linhas = 1 header + 2 dados', lines.length, 3);
ok('CSV usa ; como separador', lines[0].indexOf(';') > 0);
ok('toCSV escapa campos com separador/aspas', toCSV([{ a: 'x;y', b: 'z"q' }]).indexOf('"x;y";"z""q"') >= 0);
ok('toCSV vazio => string vazia (header-only handled na UI)', toCSV([]) === '');

// ── invariantes de segurança (estáticas) ──
ok('REPORTS-CORE não tem .set(', !/\.set\(/.test(repCore));
ok('REPORTS-CORE não tem .update(', !/\.update\(/.test(repCore));
ok('REPORTS-CORE não tem setDoc/addDoc/deleteDoc/updateDoc', !/(setDoc|addDoc|deleteDoc|updateDoc)\b/.test(repCore));
ok('REPORTS-CORE não chama Firestore/db.collection', !/db\.collection|firestore\(/.test(repCore));
ok('REPORTS-CORE não chama fetch', !/\bfetch\(/.test(repCore));
ok('REPORTS-CORE não usa IPC/electron (sem main.ts)', !/ipcRenderer|require\(['"]electron|desktopAPI/.test(repCore));
ok('Exportação é LOCAL via Blob + download', /new Blob\(/.test(repCore) && /\.download\s*=/.test(repCore));
ok('REPORTS-CORE REUSA slaExecAggregate (F3.3.8)', /slaExecAggregate\(/.test(repCore));
ok('REPORTS-CORE NÃO redefine slaExecAggregate (F3.3.8 intocado)', !/function slaExecAggregate\b/.test(repCore));
ok('F3.3.8 EXEC-CORE preservado (define slaExecAggregate)', /function slaExecAggregate\(/.test(execCore));
ok('REPORTS reusa fontes congeladas (resolveTaskDisplayState/isTaskCompleted)', /resolveTaskDisplayState\(/.test(repCore) && /isTaskCompleted\(/.test(repCore));
ok('tab Relatórios aditiva', /\{k:'relatorios',l:'Relat[óo]rios',i:'bars'\}/.test(html));
ok('render() roteia relatorios sem tocar outras tabs', /else if\(state\.tab==='relatorios'\)\{c\.innerHTML=renderReports\(\);afterReports\(\);\}/.test(html));

console.log(`\nF3.3.9 REPORTS: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error:: relatórios divergiram do contrato'); process.exit(1); }
console.log('OK — relatórios read-side determinísticos; filtros/toggles; período/reincidentes/histórico; export local CSV/JSON via Blob (sem IPC/Firestore); F3.3.8 EXEC-CORE intocado.');
