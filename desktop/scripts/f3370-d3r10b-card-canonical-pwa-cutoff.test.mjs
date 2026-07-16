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
  const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2Card', 'kbv2Empty', 'kbv2BoardHtml'];
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
  const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2Card', 'kbv2Empty', 'canSendToClient', 'detailActionsHtml'];
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
  // F3.3.70D3R10U: o diag virou template ("tray." + event) e cobre created/recreated/error
  ok(TRAY.includes('diag("tray." + event') && TRAY.includes('iconEmpty'), 'F9: tray com diagnóstico runtime (tray.created/recreated via template)');
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
  // G8/G9: versão corrente (1.0.160 = F3.3.73I3 Agenda compartilhada — criar compromisso)
  const pj = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  ok(pj.version.startsWith('1.0.') && parseInt(pj.version.split('.')[2], 10) >= 160, 'G8: package.json version 1.0.160+ (Agenda compartilhada; bumps 1.0.161/162+) (é: ' + pj.version + ')');
  const pl = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package-lock.json'), 'utf8'));
  ok(pl.version.startsWith('1.0.') && parseInt(pl.version.split('.')[2], 10) >= 160, 'G9: package-lock version 1.0.160+ (Agenda compartilhada; bumps 1.0.161/162+) (é: ' + pl.version + ')');
  // G10: preload sem versao stale, expondo app.getVersion
  const PRE = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'preload', 'preload.ts'), 'utf8');
  ok(!/1\.0\.13\d|1\.0\.14\d/.test(PRE) && PRE.includes('app-version'), 'G10: preload sem versão hardcoded; usa IPC app-version');
}


/* ───────────── H: 1.0.151 — Card Premium IMAGEM-PRIMEIRO + tray diag (D3R10U) ───────────── */
{
  const MAIN = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'main.ts'), 'utf8');
  const TRAY = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'tray.ts'), 'utf8');
  const PRE  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'preload', 'preload.ts'), 'utf8');
  const WF   = fs.readFileSync(path.resolve(__dirname, '..', '..', '.github', 'workflows', 'desktop-build.yml'), 'utf8');

  // H1 — F3.3.70D3R10AA: FLUXO APROVADO RESTAURADO (modal 1.0.150 byte-exato)
  const modalStart = HTML.indexOf("gcs-title\">Enviar no grupo do cliente");
  const advStart = HTML.indexOf("<details class=\"gcs-adv\"", modalStart);
  ok(modalStart > 0 && advStart > modalStart, 'H1a: modal aprovado presente ("Enviar no grupo do cliente") com opções avançadas depois');
  const mainFlow = HTML.slice(modalStart, advStart);
  ok(mainFlow.includes('id="btnOpenWaMain"') && mainFlow.includes('Abrir WhatsApp Business para enviar no grupo'), 'H1b: botão APROVADO no fluxo principal (1 clique → WhatsApp Business)');
  ok(mainFlow.includes('A mensagem será copiada automaticamente'), 'H1c: mensagem copiada AUTOMATICAMENTE no clique (comportamento aprovado)');
  ok(!mainFlow.includes('id="waPhone"'), 'H1d: SEM campo "WhatsApp do cliente" no fluxo principal');
  ok(!mainFlow.includes('id="btnSendAuto"') && !mainFlow.includes('Enviar Card Premium agora'), 'H1e: Cloud API NÃO é caminho principal');
  ok(mainFlow.includes('id="groupLegendBox"') && mainFlow.includes('id="groupLinkPreview"'), 'H1f: mensagem + prévia do card (estrutura visual aprovada) no modal');
  ok(mainFlow.includes('id="btnCopyGroupMsg"') && mainFlow.includes('id="btnTestLink"'), 'H1g: secundários aprovados (Copiar mensagem / Testar link)');
  const advFlowH = HTML.slice(advStart, advStart + 2600);
  ok(advFlowH.includes('id="btnSendAuto"') && advFlowH.includes('id="waPhone"'), 'H1h: Cloud API/telefone SÓ em opções avançadas (recolhido, como no aprovado)');
  ok(advFlowH.includes('id="btnCopyImg"') && advFlowH.includes('id="btnOpenFolder"'), 'H1i: fallback de imagem SÓ em opções avançadas (nunca obrigatório)');
  // wiring aprovado: copyMsgClean ANTES de abrir o WhatsApp (auto-copy real, nao so texto)
  const wire = HTML.slice(HTML.indexOf("on('btnOpenWaMain'"), HTML.indexOf("on('btnOpenWaMain'") + 1900); // 74D: comentário de restauração no handler; asserts intactos
  ok(/if\(!copyMsgClean\(\)\) return;/.test(wire) && wire.includes('openWhatsAppWebOnly()'), 'H1j: clique = copia mensagem + abre WhatsApp (wiring aprovado)');
  ok(/persistClientSend\(ctx\.id\)/.test(wire), 'H1k: envio registrado no Notification Engine (aprovado 1.0.138)');
  // H2 — F3.3.70D3R10AA: mensagem/link no REGIME VALIDADO de 19/06 (sem cache-bust)
  ok(/const url=buildShareClientUrl\(ctx&&ctx\.token\);/.test(HTML), 'H2a: mensagem usa o link /share ESTÁVEL (sem ?v= — decisão registrada do owner em 6d46bce)');
  ok(!/const url=withWhatsAppPreviewBust\(buildShareClientUrl/.test(HTML), 'H2b: cache-bust REMOVIDO da mensagem enviada');
  ok(HTML.includes('function withWhatsAppPreviewBust'), 'H2c: função de bust preservada (não usada na mensagem principal)');
  // H3 — mensagem/link intocados (funções reais)
  const SRC3 = ['CLIENT_LINK_BASE', 'withWhatsAppPreviewBust', 'buildShareClientUrl', 'buildClientMessage'].map(grab).join('\n');
  const M3 = new Function('Date', SRC3 + '\nreturn {buildShareClientUrl,buildClientMessage,withWhatsAppPreviewBust};')(Date);
  const tok = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
  const msg3 = M3.buildClientMessage({ client: 'Cliente QA', token: tok });
  ok(msg3.includes('https://aprovar.agendaidseven.com.br/share/cronograma/' + tok) && !msg3.includes('?v='), 'H3a: mensagem contém /share/cronograma/<token> ESTÁVEL (sem ?v=, regime 19/06)');
  ok(msg3.indexOf('Olá, Cliente QA.') === 0 && msg3.includes('Equipe ID Seven'), 'H3b: modelo da mensagem preservado');
  let threw = false; try { M3.buildShareClientUrl(''); } catch (_) { threw = true; }
  ok(threw, 'H3c: link NUNCA sai sem token (guard lança)');

  // H4 — Cloud API preservada como OPÇÃO AVANÇADA (funcionalidade não removida)
  ok(HTML.includes("const PREMIUM_SEND_URL=CLIENT_REVIEW_BASE+'/client/send-premium-whatsapp'"), 'H4a: rota segura do Worker inalterada');
  ok(/r&&r\.ok&&data&&data\.ok&&data\.message_id/.test(HTML), 'H4b: sucesso do avançado SÓ com message_id real da Meta');
  ok(HTML.includes('WHATSAPP_CLOUD_API_NOT_CONFIGURED'), 'H4c: 503 tratado com mensagem clara');
  const autoWire = HTML.slice(HTML.indexOf('function _wireAutoSend'), HTML.indexOf('function _gateValidLink'));
  ok(!autoWire.includes('openWhatsAppWebOnly('), 'H4d: falha do avançado nunca cai para WhatsApp Web sozinho');
  // H5 — tray NUNCA com ícone vazio (fallback embutido)
  ok(TRAY.includes('TRAY_FALLBACK_B64'), 'H5a: fallback de ícone EMBUTIDO (base64) presente no tray.ts');
  ok(/if \(img\.isEmpty\(\)\) \{[\s\S]*?createFromDataURL\("data:image\/png;base64," \+ TRAY_FALLBACK_B64\)/.test(TRAY), 'H5b: ramo isEmpty → usa o embutido (ícone invisível impossível)');
  ok(TRAY.includes('function ensureTray') && TRAY.includes('function recreateTray') && TRAY.includes('function getTrayState'), 'H5c: ensureTray/recreateTray/getTrayState exportados');
  ok(TRAY.includes('tray.error') && TRAY.includes('"recreated"'), 'H5d: diag tray.recreated/tray.error presentes');

  // H6 — main.ts: IPCs + recriação no login + heartbeat
  ok(MAIN.includes('ipcMain.on("tray-status"') && MAIN.includes('ipcMain.handle("tray-recreate"'), 'H6a: IPCs tray-status/tray-recreate registrados');
  ok(/session-login[\s\S]{0,220}ensureTray\(trayWin, trayOpts\)/.test(MAIN), 'H6b: session-login garante o tray (recria após login)');
  ok(/getTrayState\(\);[\s\S]{0,200}if \(!quitting && !ts\.created\)[\s\S]{0,80}ensureTray/.test(MAIN), 'H6c: heartbeat verifica e recria o tray (73I6C11: guardado por !quitting no quit)');
  ok(MAIN.includes('tray: ts.created, trayIconEmpty: ts.iconEmpty'), 'H6d: main.alive loga estado do tray');
  ok(MAIN.includes('ipcMain.handle("open-card-image"'), 'H6e: IPC open-card-image (Abrir imagem) registrado');

  // H7 — preload expõe as pontes
  ok(PRE.includes('trayStatus:') && PRE.includes('tray-status') && PRE.includes('trayRecreate:') && PRE.includes('tray-recreate'), 'H7a: preload expõe trayStatus/trayRecreate');
  ok(PRE.includes('openCardImage:') && PRE.includes('open-card-image'), 'H7b: preload expõe openCardImage');

  // H8 — Configurações: Bandeja do sistema + botão recriar + seta ^
  ok(HTML.includes('Bandeja do sistema (tray)') && HTML.includes('function cfgTrayRowHtml'), 'H8a: seção "Bandeja do sistema" em Configurações');
  ok(HTML.includes('data-cfgtrayrecreate="1"') && HTML.includes('Recriar ícone da bandeja'), 'H8b: botão "Recriar ícone da bandeja" presente');
  ok(HTML.includes('escondido na seta ^ perto do relógio do Windows'), 'H8c: orientação da seta ^ presente');
  ok(HTML.includes("'Não encontrada'") && HTML.includes("'Recriada agora ✓'") && HTML.includes("'Erro ao criar'") && HTML.includes('iconEmpty: '), 'H8d: 4 estados + iconEmpty true/false exibidos');
  ok(HTML.includes('X envia o app para a bandeja') && HTML.includes('encerra de verdade'), 'H8e: regra X→bandeja / Sair→encerra escrita na tela');

  // H10 — anti-leak: fixtures sem dados reais
  ok(!/55\s?\d{2}\s?9?\d{4}-?\d{4}/.test(msg3), 'H10a: mensagem de teste sem telefone real');
  ok(tok.length === 48 && !HTML.includes(tok), 'H10b: token de teste sintético (não existe no renderer)');

  // H11 — ZERO versão hardcoded renderizada remanescente
  ok((HTML.match(/1\.0\.14[6-9]/g) || []).length === 0, 'H11a: renderer sem 1.0.146/147/148/149 (nem em comentários)');
  ok(!/Desktop 1\.0\.[0-9]/.test(HTML) && !/Versão 1\.0\.[0-9]/.test(HTML), 'H11b: nenhum "Desktop 1.0.<n>"/"Versão 1.0.<n>" literal (Perfil 1.0.119 corrigido)');
  ok(HTML.includes("ID Seven · Desktop '+APP_VER.desktop+' · produção"), 'H11c: rodapé do Perfil deriva de APP_VER');

  // H12 — gate de CI estendido (ícone + prova de versão anti-hardcode)
  ok(WF.includes('Gate tray icon') || WF.includes('icon.png'), 'H12a: gate do ícone do tray presente no workflow');
  ok(/1\\\.0\\\.14\[6-9\]/.test(WF) && WF.includes('Desktop 1\\.0\\.'), 'H12b: gate de prova-de-versão estendido (146-149 + Desktop/Versão 1.0.<n> literais)');
  // F3.3.70D3R10U: o gate anterior grepava app*/src/renderer (inexistente com asar) e
  // passava EM BRANCO — agora extrai o app.asar e falha se o renderer não for achado.
  ok(WF.includes('@electron/asar extract') && WF.includes('gate nao pode passar em branco'), 'H12c: gate extrai o asar e é anti-vácuo (nunca passa sem escanear o renderer real)');
}


/* ───────────── J: 1.0.152 — read-back do clipboard + probe versionado (D3R10Z) ───────────── */
{
  const MAINJ = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'main.ts'), 'utf8');
  ok(/clipboard\.writeImage\(img\);[\s\S]{0,200}clipboard\.readImage\(\)[\s\S]{0,120}isEmpty\(\)/.test(MAINJ), 'J1: copy-card-image confere o clipboard de verdade (read-back pós-write)');
  ok(MAINJ.includes('clipboard nao reteve a imagem'), 'J2: falha de retenção vira erro honesto (nunca "ok" falso)');
  let wfProbe = '';
  try { wfProbe = fs.readFileSync(path.resolve(__dirname, '..', '..', '.github', 'workflows', 'wa-cloudapi-config-probe.yml'), 'utf8'); } catch (_) {}
  ok(wfProbe.includes('/client/send-premium-whatsapp') && wfProbe.includes('WHATSAPP_CLOUD_API_NOT_CONFIGURED'), 'J3: probe read-only da rota Cloud API versionado (dispatch-only)');
}


/* ───────────── K: 1.0.154 — D9R2 Configuracoes uniformes + contratos intocados ───────────── */
{
  // K1/K2: linhas em-breve e informativas ganharam coluna de icone sutil (.icb-mut)
  ok(/const soon=l=>'<div class="settrow" style="cursor:default"><div class="icb icb-mut">'\+svg\('clock'\)/.test(HTML), 'K1: soon() tem coluna de ícone sutil (clock)');
  ok(/const info=\(l,v\)=>'<div class="settrow" style="cursor:default"><div class="icb icb-mut">'\+svg\('info'\)/.test(HTML), 'K2: info() tem coluna de ícone sutil (info)');
  // K3: wrapper centralizado com largura maxima
  ok(HTML.includes('<div class="scr-head cfg-head">') && HTML.includes('<div class="scr cfg-wrap"'), 'K3: renderConfig usa cfg-head + cfg-wrap');
  ok(/body\.desktop \.cfg-head,body\.desktop \.cfg-wrap\{max-width:840px;margin-inline:auto/.test(HTML), 'K4: CSS D9R2 centraliza com max-width 840');
  // K5: box-sizing explicito nas linhas (regra global * caida em producao — chave } sobrando)
  ok(/body\.desktop \.cfg-wrap \.settrow\{box-sizing:border-box;min-height:62px/.test(HTML), 'K5: settrow do config com border-box explícito + altura mínima');
  ok((HTML.match(/\*\{box-sizing:border-box/g) || []).length === 1, 'K6: nenhuma mudança global de box-sizing nesta fase (housekeeping futuro)');
  // K7/K8: contratos de Equipe/Chat INTOCADOS (correção de usuários é de DADO, não código)
  ok(HTML.includes("const us=state.users.filter(u=>!['removido','excluido'].includes(u.status||'')).sort((a,b)=>(a.name||'').localeCompare(b.name||''));"), 'K7: renderEquipe byte-idêntico (filtra removido/excluido)');
  ok(HTML.includes("const us=state.users.filter(u=>u.id!==state.user.id&&!['removido','excluido','pendente'].includes(u.status||''))"), 'K8: renderChat byte-idêntico');
  // K9: formulario de tarefa NAO tocado (spacer 14px do Cliente/Empresa permanece)
  ok(HTML.includes('<div style="height:14px"></div><div class="lbl">Cliente / Empresa'), 'K9: task form intocado (spacer original)');
  // K10: divline permanece 65px (agora correta para TODAS as linhas, que têm ícone)
  ok(/\.divline\{height:1px;background:#222633;margin-left:65px\}/.test(HTML), 'K10: divline 65px preservada');
  // K11: secoes do config com respiro 18px (7 secoes)
  // F3.3.71A: +1 seção (Administração, admin-only) => 8 espaçadores
  ok((HTML.match(/<div style="height:18px"><\/div><div class="lbl">/g) || []).length === 8, 'K11: 8 espaçadores de seção do config em 18px (7 D9R2 + Administração F3.3.71A)');
}


/* ───────────── L: 1.0.155 — F3.3.71A troca segura de e-mail (wiring) ───────────── */
{
  const AC = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'auth-core.ts'), 'utf8');
  const AU = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'auth.ts'), 'utf8');
  const PR = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'preload', 'preload.ts'), 'utf8');
  ok(AC.includes('changeloginemail-de36pi7vza-uc.a.run.app') && AC.includes('adminchangeuseremail-de36pi7vza-uc.a.run.app'), 'L1: auth-core aponta os 2 endpoints novos');
  ok(/async changeEmail\(currentPassword: string, newEmail: string\)/.test(AC) && /async adminChangeUserEmail\(targetId: string/.test(AC), 'L2: auth-core expõe changeEmail/adminChangeUserEmail (token confinado)');
  ok(AU.includes('"auth-change-email"') && AU.includes('"auth-admin-change-user-email"'), 'L3: IPCs registrados no main');
  ok(PR.includes('authChangeEmail:') && PR.includes('authAdminChangeUserEmail:'), 'L4: preload expõe os 2 métodos (nunca o token)');
  ok(HTML.includes('data-chemail="1"') && HTML.includes('Alterar e-mail de login'), 'L5: sheet Conta tem "Alterar e-mail de login"');
  ok(/function openChangeEmailModal\(\)/.test(HTML) && HTML.includes('id="ceNew"') && HTML.includes('id="ceNew2"') && HTML.includes('id="cePw"'), 'L6: modal self com novo e-mail + confirmar + senha atual');
  ok(HTML.includes("E-mail de login atualizado com sucesso. Use o novo e-mail no próximo acesso."), 'L7: mensagem de sucesso exata do spec');
  ok(/if\(u\.admin\)\{h\+='<div style="height:18px"><\/div><div class="lbl">Administração<\/div>/.test(HTML), 'L8: seção Administração só para admin');
  ok(HTML.includes('id="aeConfirm"') && HTML.includes('Digite: ALTERAR EMAIL') && HTML.includes("cf!=='ALTERAR EMAIL'"), 'L9: confirmação textual literal ALTERAR EMAIL no fluxo admin');
  ok(HTML.includes('id="aeUser"') && HTML.includes('id="aeReason"'), 'L10: admin seleciona usuário e pode informar motivo');
  ok(HTML.includes("email_in_use") && HTML.includes('já está em uso por outro usuário'), 'L11: erro de duplicidade mapeado na UI');
  ok(!/authChangeEmail[\s\S]{0,200}token/.test(PR), 'L12: preload não expõe token no fluxo de e-mail');
}


/* ───────────── M: 1.0.156 — F3.3.71C1 shell do wizard Nova tarefa
   [M1/M2 ATUALIZADAS em 1.0.158 / F3.3.71C5] O NO-GO físico do owner provou que o
   footer sticky da 71C1 era OVERLAY (537px de conteúdo por baixo dele na etapa
   Dados @1366×768) e que focar/digitar rolava o .content (card fora do
   enquadramento; 0→442px medidos). O shell agora é COLUNA REAL: corpo .scr é o
   único scroller e o footer é ESTÁTICO dentro da moldura. ───────────── */
{
  ok(HTML.includes('body.desktop #app > .content > .form-wrap{max-width:980px;margin:18px auto 28px;padding:6px 28px 0;background:var(--surface);border:1px solid var(--line-soft);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;max-height:calc(100vh - var(--d-topbar) - 110px)}'), 'M1: form-wrap é shell 980px em COLUNA com teto no scrollport (71C5)');
  ok(/body\.desktop \.footer-nav\{position:static;flex:none;margin:0 -28px/.test(HTML), 'M2: footer Voltar/Próximo ESTÁTICO dentro do shell (fim do overlay sticky — 71C5)');
  ok((HTML.match(/body\.desktop \.stepper\{max-width:980px/g) || []).length === 2, 'M3: stepper alinhado à coluna 980 nos 2 breakpoints');
  ok(HTML.includes('body.desktop .form-wrap{max-width:980px;margin-inline:auto}'), 'M4: breakpoint largo com margin-inline:auto (fim da coluna à esquerda)');
  ok(HTML.includes('body.desktop .form-wrap .scr,body.desktop .form-wrap .scr-head{max-width:none}'), 'M5: internos preenchem o shell (header/X integrados à moldura)');
  ok(HTML.includes('<div class="form-wrap">') && HTML.includes('data-form="next"'), 'M6: HTML/JS do wizard intocado (correção só CSS)');
}


/* ───────────── N: 1.0.157 — F3.3.71C3 instalador DPI-aware (nitidez) ───────────── */
{
  const NSH = fs.readFileSync(path.resolve(__dirname, '..', 'build', 'installer.nsh'), 'utf8');
  ok(/!macro customHeader[\s\S]*ManifestDPIAware true[\s\S]*!macroend/.test(NSH), 'N1: installer.nsh declara ManifestDPIAware true via customHeader');
  ok((NSH.match(/^!macro /gm) || []).length === (NSH.match(/^!macroend/gm) || []).length, 'N2: macros NSIS balanceadas');
  ok(NSH.includes('killRunningApp') && NSH.includes('customInit') && NSH.includes('customUnInit'), 'N3: hooks anti-lock do asar preservados (1.0.68)');
  const YML = fs.readFileSync(path.resolve(__dirname, '..', 'electron-builder.yml'), 'utf8');
  ok(YML.includes('icon: build/icon.ico') && YML.includes('include: build/installer.nsh'), 'N4: build aponta icon.ico + installer.nsh (config intocada além do fix)');
  ok(YML.includes('from: build/icon.png') && YML.includes('to: icon.png'), 'N5: extraResources do tray preservado');
}


/* ───────────── O: 1.0.158 — F3.3.71C5 wizard coluna real + instalador 1º clique ───────────── */
{
  ok(HTML.includes('body.desktop .form-wrap .scr{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px 20px 26px 0;margin-right:-20px;scrollbar-gutter:stable}'), 'O1: corpo .scr é o ÚNICO scroller do wizard (gutter estável, sem pulo entre etapas)');
  ok(HTML.includes('body.desktop .form-wrap input,body.desktop .form-wrap textarea,body.desktop .form-wrap select{box-sizing:border-box}'), 'O2: campos do wizard em border-box (fim do estouro de ~30px além da coluna)');
  ok(HTML.includes('body.desktop .form-wrap .scr-head,body.desktop .form-wrap .stepper{flex:none}') && HTML.includes('body.desktop .form-wrap .stepper{width:100%}'), 'O3: header/stepper fixos na moldura; stepper largura cheia no flex-column');
  ok(/\.footer-nav\{position:sticky;bottom:0;background:var\(--surface\)/.test(HTML), 'O4: base mobile/PWA do footer preservada (sticky segue fora do desktop)');
  ok(HTML.includes('body.desktop .footer-nav{padding:14px 28px;gap:12px;background:rgba(11,12,17,.92)}'), 'O5: footer premium alinhado à coluna do conteúdo (28px, era 32px)');
  ok(!/body\.desktop \.footer-nav\{[^}]*backdrop-filter/.test(HTML), 'O6: footer desktop sem backdrop-filter (nada passa por baixo dele agora)');
  const NSH = fs.readFileSync(path.resolve(__dirname, '..', 'build', 'installer.nsh'), 'utf8');
  ok(/!macro customInit[\s\S]*Banner::show "Preparando o instalador\.\.\."[\s\S]*!insertmacro killRunningApp[\s\S]*Banner::destroy[\s\S]*!macroend/.test(NSH), 'O7: customInit dá feedback imediato (Banner) antes do taskkill/Sleep e destrói ao fim');
  ok(/IfSilent instPrepSemBanner[\s\S]*IfSilent instPrepFim/.test(NSH), 'O8: instalação silenciosa /S preservada (banner só no modo interativo)');
  ok(/Mark-of-the-Web[\s\S]*Desbloquear/.test(NSH), 'O9: causa operacional do 1º clique (MOTW/verificação) documentada no próprio hook');
}


/* ───────────── P: 1.0.159 — F3.3.71C7 corte de escopo: Chat fora do fluxo + Copywriting fora da criação ───────────── */
{
  ok(!/\{k:'chat'/.test(HTML), 'P1: TABS sem item Chat (menu lateral desktop e nav mobile-legada)');
  ok(HTML.includes("if(state.tab==='chat')state.tab='hoje'"), 'P2: navegação residual para Chat cai em Hoje (guard no topo do render)');
  ok(!/else if\(state\.tab==='chat'\)/.test(HTML), 'P3: rota do Chat removida do switch de telas');
  ok(HTML.includes("const us=state.users.filter(u=>u.id!==state.user.id&&!['removido','excluido','pendente'].includes(u.status||''))"), 'P4: renderChat preservado como código inativo (contrato K8) — zero dado apagado');
  ok(!/soon\('Notificações de chat'\)/.test(HTML), 'P5: pill "Notificações de chat" removida das Configurações');
  ok(/\{key:'copywriting',label:'Copywriting'[^}]*descontinuado:true\}/.test(HTML), 'P6: setor copywriting marcado descontinuado SEM remover a definição');
  ok(HTML.includes("SECTOR_ALIAS={design:'edicao_midia',copy:'copywriting',postagem:'programacao_posts'}"), 'P7: alias legado copy→copywriting preservado (históricas resolvem)');
  ok(HTML.includes('SECTORS.filter(s=>!s.descontinuado).forEach'), 'P8: etapa Setor oferece SOMENTE setores ativos');
  ['edicao_midia','cronograma','roteiro','programacao_posts'].forEach(k=>ok(new RegExp("\\{key:'"+k+"'").test(HTML) && !new RegExp("\\{key:'"+k+"'[^}]*descontinuado").test(HTML), 'P9: setor ativo preservado na criação: '+k));
  ok(/copywriting:\{titleLabel:'Título da copy'/.test(HTML), 'P10: TEMPLATES.copywriting preservado (edição/briefing de tarefa histórica)');
  ok(HTML.includes('if(sector&&secOf(sector).descontinuado)sector=null'), 'P11: FAB dentro de board histórico não pré-seleciona setor descontinuado');
  ok(/function notifNavBadge\(k\)\{ if\(k!=='notificacoes'\) return ''/.test(HTML), 'P12: único badge de navegação é o de Notificações (nunca houve badge de Chat)');
}

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
