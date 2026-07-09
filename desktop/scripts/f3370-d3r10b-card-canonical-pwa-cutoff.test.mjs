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

/* ───────────────── F: 1.0.148 — mockups aprovados (D3R10H) ───────────────── */
{
  const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2Card', 'kbv2Empty', 'canSendToClient', 'detailActionsHtml'];
  let SRC = ''; for (const n of NAMES) SRC += grab(n) + '\n';
  const PRELUDE =
    'var state={user:{id:"u1",role:"social media",admin:false},users:[]};\n' +
    'function respOf(t){return {id:"u2",name:"Fulana Teste",role:"Editora"};}\n' +
    'function avatar(u,s){return \'<span class="av"></span>\';}\n' +
    'function svg(k){return "";}\n' +
    'function fmtDateBR(d){return String(d||"");}\n' +
    'function hasDesigner(t){return false;}\n' +
    'function designerOf(t){return "";}\n' +
    'function designerStatusView(t){return {label:"x",color:"#000"};}\n' +
    'function clientStatusView(t){return {label:"Rascunho",color:"#A78BFA"};}\n' +
    'function clientFacingStatusView(t){return clientStatusView(t);}\n' +
    'function taskTimeline(t){return {milestones:[{key:"a",state:"current"},{key:"b",state:""},{key:"c",state:""}],owner:{role:"Social",id:null}};}\n' +
    'function nextActionShort(t){return "Preencher os temas";}\n' +
    'function clientFacingNextShort(t){return "";}\n' +
    'function designerColView(t){return "afazer";}\n' +
    'function designerNextShort(t){return "";}\n' +
    'var TASK_PHASE={COMPLETED:"c",AWAITING_DESIGNER:"ad",AWAITING_CLIENT_APPROVAL:"acp",DESIGNER_PRODUCING:"dp",DESIGNER_REVISING:"dr",DESIGNER_DELIVERED:"dd"};\n' +
    'function deriveCanonicalTaskState(t){return {phase:"producing",owner:"social"};}\n' +
    'function deriveCanonicalPerspective(t,p){return {key:"afazer",label:"Rascunho",color:"#A78BFA",next:"Preencher os temas"};}\n' +
    'function isTaskCompleted(t){return false;}\n' +
    'function kbv2SlaLocal(t){return {sev:"neutro",label:""};}\n' +
    'function canDelTask(t){return false;}\n' +
    'var MANAGER_KW=["social","gestor","gerente","diretor","coordena","supervisor","admin","dono","owner","ceo","head"];\n' +
    'function norm(x){return (x||"").toLowerCase();}\n' +
    'function roleCat(u){if(!u)return "UNKNOWN";if(u.admin)return "ADMIN";const r=norm(u.role);return MANAGER_KW.some(k=>r.includes(k))?"MANAGER":"OPERATIONAL";}\n' +
    'function canSeeAll(u){const c=roleCat(u);return c==="ADMIN"||c==="MANAGER";}\n';
  const M = new Function(PRELUDE + SRC + '\nreturn {kbv2Card,kbv2Empty,canSendToClient,detailActionsHtml};')();
  const rascunho = { id: 'CR', title: 'Cronograma semanal — QA', client: 'Cliente QA', sector: 'cronograma', status: 'afazer', cronContents: [{}, {}, {}], by: 'u1', createdAt: 1751970000000, checklist: [] };
  const pronto = { id: 'CP', title: 'Cronograma semanal — QA', client: 'Cliente QA', sector: 'cronograma', status: 'andamento', cronContents: [{ tema: 'Tema real 1' }, { tema: 'Tema real 2' }], by: 'u1', createdAt: 1751970000000, checklist: [] };
  const hRas = M.kbv2Card(rascunho);
  ok(hRas.includes('kbv2-themes-ph') && hRas.includes('Tema 1 — a definir') && hRas.includes('Tema 3 — a definir'), 'F1a: rascunho interno tem Temas estruturados "a definir"');
  ok(hRas.includes('kbv2-hint') && hRas.includes('liberar o <b>envio ao cliente</b>'), 'F1b: rascunho interno tem hint do Card Premium');
  ok(hRas.includes('data-card-renderer="canonical-board-card"') && hRas.includes('kbv2-card-rail') && hRas.includes('Etapa atual'), 'F1c: rascunho segue 100% canônico');
  const nuncaTocado = { id: 'CN', title: 'Cronograma semanal — QA', client: 'Cliente QA', sector: 'cronograma', status: 'afazer', by: 'u1', createdAt: 1751970000000, checklist: [] };
  const hNt = M.kbv2Card(nuncaTocado);
  ok(hNt.includes('kbv2-themes-ph') && hNt.includes('Tema 1 — a definir') && hNt.includes('Tema 3 — a definir'), 'F1d: cronograma NUNCA-TOCADO (sem cronContents) tem Temas estruturados "a definir"');
  ok(hNt.includes('kbv2-hint') && hNt.includes('data-card-renderer="canonical-board-card"') && hNt.includes('kbv2-card-rail'), 'F1e: nunca-tocado tem hint premium e segue canônico');
  const hNtCli = M.kbv2Card(nuncaTocado, 'client');
  ok(!hNtCli.includes('a definir') && !hNtCli.includes('kbv2-hint'), 'F1f: nunca-tocado na visão do CLIENTE sem placeholder/hint');
  const aNt = M.detailActionsHtml(nuncaTocado, { actions: ['edit', 'sendclient'] });
  ok(aNt.includes('det-hero-locked') && aNt.includes('disabled'), 'F1g: nunca-tocado → botão premium BLOQUEADO com explicação');
  const hCli = M.kbv2Card(rascunho, 'client');
  ok(!hCli.includes('a definir') && !hCli.includes('kbv2-hint') && !hCli.includes('kbv2-themes-ph'), 'F2: visão do CLIENTE sem placeholder e sem hint (nunca vaza)');
  const hOk = M.kbv2Card(pronto);
  ok(!hOk.includes('a definir') && !hOk.includes('kbv2-hint') && hOk.includes('Tema real 1'), 'F3: cron com temas não mostra placeholder/hint');
  const he = M.kbv2Empty('afazer');
  ok(he.includes('data-empty-state="1"') && he.includes('Coluna vazia') && !he.includes('kbv2-card'), 'F4: empty-state marcado, rotulado e sem classes de card');
  ok(M.canSendToClient({ sector: 'cronograma', client: 'Cliente QA', contents: pronto.cronContents }) === true, 'F5a: canSendToClient elegível com tema real');
  const dsR = { actions: ['edit', 'sendclient'] };
  const aR = M.detailActionsHtml(rascunho, dsR), aP = M.detailActionsHtml(pronto, dsR);
  ok(aR.includes('det-hero-locked') && aR.includes('disabled') && aR.includes('Enviar ao cliente'), 'F5b: sem tema → botão premium BLOQUEADO visível (nunca some)');
  ok(aP.includes('data-sendclient-task="CP"') && !aP.includes('det-hero-locked'), 'F5c: com tema → botão premium ATIVO');
  ok(/_filled<1\?'<div class="kbv2-hint"/.test(HTML), 'F6: hero do detalhe injeta hint quando sem tema (fonte)');
  const PRELOAD = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'preload', 'preload.ts'), 'utf8');
  ok(!PRELOAD.includes('1.0.137-beta-portal-fix') && PRELOAD.includes('app-version'), 'F7: preload sem versão stale; versão real via IPC');
  ok(/info\('Versão do aplicativo'/.test(HTML), 'F8: tela Config exibe a versão do aplicativo');
  const TRAY = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'tray.ts'), 'utf8');
  ok(TRAY.includes('tray.created') && TRAY.includes('iconEmpty'), 'F9: tray com diagnóstico runtime (tray.created)');
}

/* ───────────────── G: 1.0.150 — proveniencia de versao (D3R10Q) ───────────────── */
{
  // G1: nenhuma string stale 1.0.146 no renderer (gate anti-mismatch)
  const occ = (HTML.match(/1\.0\.146/g) || []).length;
  ok(occ === 0, 'G1: renderer sem NENHUMA string "1.0.146" (encontradas: ' + occ + ')');
  ok(!HTML.includes('1.0.146-beta-board-rebuild'), 'G2: rótulo "1.0.146-beta-board-rebuild" eliminado');
  // G3: versao vem de app.getVersion (preload), nao hardcoded
  ok(/const DESK_VER=\(function\(\)\{try\{return \(window\.desktopAPI&&window\.desktopAPI\.version\)/.test(HTML), 'G3: DESK_VER deriva de window.desktopAPI.version');
  ok(/const APP_VER=\{ desktop:DESK_VER/.test(HTML), 'G4: APP_VER.desktop = DESK_VER (não hardcoded)');
  ok(/const BUILD=DESK_VER;/.test(HTML), 'G5: BUILD = DESK_VER (não hardcoded)');
  // G6: <title> estatico neutro (sem numero de versao)
  ok(/<title>ID Seven · Desktop<\/title>/.test(HTML), 'G6: <title> estático neutro (runtime preenche)');
  // G7: sidebar footer deriva de APP_VER
  ok(/<span class="ver">Desktop '\+APP_VER\.desktop\+' · '\+APP_VER\.tag\+'<\/span>/.test(HTML), 'G7: sidebar footer deriva de APP_VER');
  // G8: package.json e lock em 1.0.150
  const pj = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  ok(pj.version === '1.0.150', 'G8: package.json version = 1.0.150 (é: ' + pj.version + ')');
  const pl = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package-lock.json'), 'utf8'));
  ok(pl.version === '1.0.150', 'G9: package-lock version = 1.0.150 (é: ' + pl.version + ')');
  // G10: preload sem versao stale, expondo app.getVersion
  const PRE = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'preload', 'preload.ts'), 'utf8');
  ok(!/1\.0\.13\d|1\.0\.14\d/.test(PRE) && PRE.includes('app-version'), 'G10: preload sem versão hardcoded; usa IPC app-version');
}

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
