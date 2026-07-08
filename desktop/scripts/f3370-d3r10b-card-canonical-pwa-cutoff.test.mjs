#!/usr/bin/env node
/* =====================================================================
 * F3.3.70D3R10B — CARD CANÔNICO ÚNICO + CUTOFF PWA (board do Desktop).
 * READ-ONLY sobre index.html: extrai as funções REAIS e prova:
 *   A) pwaCutoffFilter: tarefas legadas da era PWA (copyAt/copyState/freq/
 *      cronWeeks/cronMonth e/ou sector copy|design|postagem) NÃO entram no
 *      state; tarefa nova (fluxo Desktop) entra; ambígua é bloqueada e
 *      contabilizada; NADA é mutado/apagado (filter puro).
 *   B) Ingestão única: o onSnapshot de 'tasks' passa por pwaCutoffFilter.
 *   C) kbv2Card: TODO card (cron e não-cron; afazer/andamento/revisao/
 *      concluido) renderiza o componente canônico com marcador
 *      data-card-renderer="canonical-board-card", trilho de progresso,
 *      "Etapa atual" e "Próxima ação". Nenhum card 'legacy'.
 *   D) kbv2BoardHtml: as 4 colunas usam o MESMO cardFn canônico.
 *   E) saveTask não grava nenhum campo legado PWA.
 * Rodar: node desktop/scripts/f3370-d3r10b-card-canonical-pwa-cutoff.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

function grab(n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '=');
  if (a < 0) a = HTML.indexOf('const ' + n + ' =');
  if (a < 0) throw new Error('não encontrei: ' + n);
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  throw new Error('sem fim: ' + n);
}
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS — ' + msg); } else { fail++; console.log('  FAIL — ' + msg); } }

/* ───────────────────────── A+B: CUTOFF PWA ───────────────────────── */
{
  const SRC = ['PWA_LEGACY_FIELDS', 'PWA_LEGACY_SECTORS', 'isPwaLegacyTask', 'hasNewFlowMarkers', 'pwaCutoffFilter'].map(grab).join('\n');
  const ctx = { window: {}, console: { info: () => {} }, Date, Array, String };
  const fn = new Function('window', 'console', SRC + '\nreturn {isPwaLegacyTask,hasNewFlowMarkers,pwaCutoffFilter};');
  const M = fn(ctx.window, ctx.console);
  // fixtures ESPELHANDO os shapes REAIS lidos de producao (26 docs):
  const legacyCopy = { id: 'L1', title: 'Copywriter Semanal — CEO', sector: 'copy', status: 'afazer', freq: 'semanal', cronWeeks: 1, cronMonth: '2026-06', copyAt: 1, copyState: 'x', assignee: 'Boaz Macêdo', by: 'u9' };
  const legacyDesign = { id: 'L2', title: 'Design Semanal — Olhar', sector: 'design', status: 'concluido', freq: 'semanal', cronWeeks: 2, cronMonth: '2026-06', doneAt: 1 };
  const legacyAliasOnly = { id: 'L3', title: 'Legada sem freq', sector: 'postagem', status: 'afazer' };
  const nova = { id: 'N1', title: 'Cronograma semanal - Julho', sector: 'cronograma', status: 'andamento', cronContents: [{ tema: 'T1' }], socialFlowStatus: 'afazer', workflowStage: 'producao', src: 'webpreview', assigneeId: 'u1' };
  const novaDesktopShape = { id: 'N2', title: 'Copywriting — semanal', sector: 'copywriting', status: 'afazer', assigneeId: 'u2', by: 'u1', createdAt: 2, src: 'webpreview', checklist: [] };
  const ambigua = { id: 'A1', title: 'Ambígua', sector: 'copy', freq: 'semanal', workflowStage: 'producao' };
  ok(M.isPwaLegacyTask(legacyCopy) === true, 'A1: legada copy (freq/copyState) detectada');
  ok(M.isPwaLegacyTask(legacyDesign) === true, 'A2: legada design detectada');
  ok(M.isPwaLegacyTask(legacyAliasOnly) === true, 'A3: alias antigo de setor detectado mesmo sem campos legados');
  ok(M.isPwaLegacyTask(nova) === false && M.isPwaLegacyTask(novaDesktopShape) === false, 'A4: tarefas do fluxo novo NÃO marcadas como legadas');
  const input = [legacyCopy, legacyDesign, legacyAliasOnly, nova, novaDesktopShape, ambigua];
  const before = JSON.stringify(input);
  const out = M.pwaCutoffFilter(input);
  ok(out.length === 2 && out[0].id === 'N1' && out[1].id === 'N2', 'A5: filtro mantém SOMENTE as tarefas do fluxo Desktop novo');
  ok(JSON.stringify(input) === before, 'A6: filtro é puro — nenhuma tarefa mutada/apagada');
  ok(ctx.window.__pwaCutoff && ctx.window.__pwaCutoff.dropped === 3 && ctx.window.__pwaCutoff.ambiguous === 1, 'A7: relatório conta 3 legadas ocultadas + 1 ambígua bloqueada');
  ok(/state\.tasks=pwaCutoffFilter\(dedupById\(/.test(HTML), 'B1: onSnapshot de tasks passa pelo cutoff (ponto único de ingestão)');
}

/* ───────────────────────── C+D: CARD CANÔNICO ───────────────────────── */
{
  const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2Card', 'kbv2Empty', 'kbv2BoardHtml'];
  let SRC = ''; for (const n of NAMES) SRC += grab(n) + '\n';
  const PRELUDE =
    'var state={user:{id:"u1"},users:[]};\n' +
    'function respOf(t){return {id:"u2",name:"Fulana Teste",role:"Editora"};}\n' +
    'function avatar(u,s){return \'<span class="av"></span>\';}\n' +
    'function svg(k){return "";}\n' +
    'function fmtDateBR(d){return String(d||"");}\n' +
    'function hasDesigner(t){return false;}\n' +
    'function designerStatusView(t){return {label:"x",color:"#000"};}\n' +
    'function clientStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
    'function clientFacingStatusView(t){return clientStatusView(t);}\n' +
    'function taskTimeline(t){return {milestones:[{key:"a",state:"done"},{key:"b",state:"current"},{key:"c",state:""}],owner:{role:"Social",id:null}};}\n' +
    'function nextActionShort(t){return "Enviar ao cliente";}\n' +
    'function clientFacingNextShort(t){return "";}\n' +
    'function designerColView(t){return "afazer";}\n' +
    'function designerNextShort(t){return "";}\n' +
    'var TASK_PHASE={COMPLETED:"completed",AWAITING_DESIGNER:"awaiting_designer",AWAITING_CLIENT_APPROVAL:"acp",DESIGNER_PRODUCING:"dp",DESIGNER_REVISING:"dr",DESIGNER_DELIVERED:"dd"};\n' +
    'function deriveCanonicalTaskState(t){return {phase:"producing",owner:"social"};}\n' +
    'function deriveCanonicalPerspective(t,p){return {key:"andamento",label:"Em produção",color:"#F59E0B",next:"Enviar ao cliente"};}\n' +
    'function isTaskCompleted(t){return (t&&t.status)==="concluido";}\n' +
    'function kbv2SlaLocal(t){return {sev:"neutro",label:""};}\n' +
    'function canDelTask(t){return false;}\n';
  const build = new Function(PRELUDE + SRC + '\nreturn {kbv2Card,kbv2BoardHtml,kbv2NextForStatus};');
  const M = build();
  const mk = (st, extra) => Object.assign({ id: 'T' + st, title: 'Tarefa ' + st, client: 'Cliente X', sector: 'copywriting', status: st, by: 'u1', createdAt: 1751900000000, checklist: [] }, extra || {});
  const cards = {
    afazer: M.kbv2Card(mk('afazer')),
    andamento: M.kbv2Card(mk('andamento')),
    revisao: M.kbv2Card(mk('revisao')),
    concluido: M.kbv2Card(mk('concluido')),
    cron: M.kbv2Card({ id: 'TC', title: 'Cronograma semanal - Julho', client: 'OTOCP', sector: 'cronograma', status: 'andamento', cronContents: [{ tema: 'Tema 1' }, { tema: 'Tema 2' }], by: 'u1', createdAt: 1751900000000 }),
  };
  let allCanon = true, anyLegacy = false, allRail = true, allEtapa = true, allNext = true;
  for (const k of Object.keys(cards)) {
    const h = cards[k];
    if (!h.includes('data-card-renderer="canonical-board-card"')) allCanon = false;
    if (h.includes('data-card-renderer="legacy"')) anyLegacy = true;
    if (!h.includes('kbv2-card-rail')) allRail = false;
    if (!h.includes('Etapa atual')) allEtapa = false;
    if (!h.includes('Próxima ação') && k !== 'concluido') allNext = false;
  }
  ok(allCanon, 'C1: TODOS os cards (4 status não-cron + cron) carregam data-card-renderer="canonical-board-card"');
  ok(!anyLegacy, 'C2: NENHUM card renderiza marcador legacy');
  ok(allRail, 'C3: TODOS os cards têm trilho de progresso (kbv2-card-rail)');
  ok(allEtapa, 'C4: TODOS os cards têm "Etapa atual"');
  ok(allNext, 'C5: cards não-finais têm "Próxima ação"');
  ok(cards.concluido.includes('Nenhuma pendência'), 'C6: card Concluído mostra "Nenhuma pendência"');
  ok(cards.afazer.includes('Iniciar a produção') && cards.andamento.includes('Concluir e enviar para revisão') && cards.revisao.includes('Revisar e aprovar'), 'C7: próxima ação derivada por status (A Fazer/Andamento/Revisão)');
  ok(cards.cron.includes('kbv2-card-themes') && cards.cron.includes('Tema 1'), 'C8: card de cronograma mantém a seção Temas');
  const cols = [
    { label: 'A Fazer', color: '#9BA0AB', key: 'afazer', tasks: [mk('afazer')] },
    { label: 'Em andamento', color: '#F59E0B', key: 'andamento', tasks: [mk('andamento')] },
    { label: 'Revisão', color: '#60A5FA', key: 'revisao', tasks: [mk('revisao')] },
    { label: 'Finalizado', color: '#34D399', key: 'concluido', tasks: [mk('concluido')] },
  ];
  const board = M.kbv2BoardHtml(cols);
  const nCards = (board.match(/class="kbv2-card"/g) || []).length;
  const nCanon = (board.match(/data-card-renderer="canonical-board-card"/g) || []).length;
  ok(nCards === 4 && nCanon === 4, 'D1: board 4 colunas → 4 cards, todos canônicos (mesmo cardFn)');
  ok(!/data-card-renderer="(?!canonical-board-card)/.test(board), 'D2: nenhuma coluna usa renderer alternativo/legado');
}

/* ───────────────────────── E: criação no Desktop ───────────────────────── */
{
  const save = grab('saveTask');
  const legacyWrites = ['freq:', 'cronWeeks:', 'cronMonth:', 'copyAt:', 'copyState:'].filter(k => save.includes(k));
  ok(legacyWrites.length === 0, 'E1: saveTask não grava nenhum campo legado PWA (' + (legacyWrites.join(',') || 'ok') + ')');
  ok(/sector:f\.sector/.test(save), 'E2: saveTask grava o setor do formulário (chaves novas dos TEMPLATES)');
  ok(!/data-card-renderer="legacy"/.test(HTML), 'E3: fonte inteira sem marcador legacy');
}

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
