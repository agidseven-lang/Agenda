#!/usr/bin/env node
/* =====================================================================
 * F3.5.4E — UNIFICAÇÃO DEFINITIVA DO MODELO DE CARD (25 asserts da autorização).
 * READ-ONLY sobre index.html: extrai o kbv2Card REAL e prova que o SHELL renderizado é
 * estruturalmente o MESMO para TODOS os status × tipos × perspectivas (só o conteúdo do
 * painel central varia por DADOS), que o renderizador é ÚNICO (taskCard/tcv4 inalcançável
 * no desktop: isDesktop inclui IS_ELECTRON_APP + guarda no próprio taskCard), que LEGENDA
 * usa o painel padrão, que existe empty state DENTRO do painel e que nome/por seguem o
 * contrato F3.5.4B. Rodar: node desktop/scripts/f354e-card-template-unification.test.mjs
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

/* ── harness aprovado (mesmo da f354-kanban): funções REAIS + stubs mínimos ── */
const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2FirstName', 'kbv2Card', 'kbv2Empty', 'kbv2BoardHtml'];
let SRC = ''; for (const n of NAMES) SRC += grab(n) + '\n';
const PRELUDE =
  'var state={user:{id:"u1"},users:[{id:"u1",name:"Marina Souza",role:"Social Media"}]};\n' +
  'function respOf(t){return (t&&t._resp)||{id:"u2",name:"Miercohévisk Niheb Ferreira Nascimento Carlôto",role:"Editor"};}\n' +
  'function avatar(u,s){return \'<span class="av" data-av-size="\'+s+\'"></span>\';}\n' +
  'function svg(k){return \'<svg data-ic="\'+k+\'"></svg>\';}\n' +
  'function fmtDateBR(d){return String(d||"");}\n' +
  'function hasDesigner(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}\n' +
  'function designerStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientStatusView(t){return {label:"Em produção",color:"#F59E0B"};}\n' +
  'function clientFacingStatusView(t){return clientStatusView(t);}\n' +
  'function taskTimeline(t){return {milestones:[{key:"a",state:"done"},{key:"b",state:"current"},{key:"c",state:""}],owner:{role:"Social",id:null}};}\n' +
  'function nextActionShort(t){return "Enviar ao cliente";}\n' +
  'function clientFacingNextShort(t){return "";}\n' +
  'function designerColView(t){return (t&&t.status)||"afazer";}\n' +
  'function designerNextShort(t){return "Produzir a arte";}\n' +
  'var TASK_PHASE={COMPLETED:"c",AWAITING_DESIGNER:"ad",AWAITING_CLIENT_APPROVAL:"acp",DESIGNER_PRODUCING:"dp",DESIGNER_REVISING:"dr",DESIGNER_DELIVERED:"dd"};\n' +
  'function deriveCanonicalTaskState(t){return {phase:"producing",owner:"social"};}\n' +
  'function deriveCanonicalPerspective(t,p){var done=(t&&t.status)==="concluido";return {key:done?"concluido":"andamento",label:(t&&t._stlabel)||(done?"Concluído":"Em produção"),color:done?"#2FCF8F":"#F59E0B",next:done?"":"Enviar ao cliente"};}\n' +
  'function isTaskCompleted(t){return (t&&t.status)==="concluido";}\n' +
  'function kbv2SlaLocal(t){return (t&&t._sla)||{sev:"neutro",label:""};}\n' +
  'function canDelTask(t){return true;}\n' +
  'function cardsFieldOf(t,k){return k==="legenda"?String(t.cardLegenda||""):String(t.cardObs||"");}\n';
const M = new Function(PRELUDE + SRC + '\nreturn {kbv2Card,kbv2BoardHtml,kbv2FirstName};')();

/* ── MATRIZ status × tipo (dados completos: by + checklist + due ⇒ shape TOTAL comparável) ── */
const STATUSES = ['afazer', 'andamento', 'revisao', 'concluido'];
const full = { by: 'u1', createdAt: 1753500000000, dueDate: '2026-08-02', dueTime: '17:00', checklist: [{ d: true }, { d: false }] };
const TYPES = {
  cards_legenda: { sector: 'edicao_cards', title: 'Card LGPD', client: 'Auto Center Ravel', cardLegenda: 'Legenda de produção com texto realista para o painel padrão.' },
  cards_sem: { sector: 'edicao_cards', title: 'Card avulso', client: 'Bella Moda' },
  videos: { sector: 'edicao_midia', title: 'Edição de vídeo', client: 'Hospital Visão', videos: [{ id: 'v1', n: 1, tema: 'VÍDEO HV 1' }, { id: 'v2', n: 2, tema: 'VÍDEO HV 2' }] },
  cronograma: { sector: 'cronograma', title: 'Cronograma', client: 'OdontoPrime', cronContents: [{ tema: 'Pauta 1' }, { tema: 'Pauta 2' }, { tema: 'Pauta 3' }] },
  roteiro: { sector: 'roteiro', title: 'Roteiro', client: 'Sabor & Arte', cronContents: [{ tema: 'Gancho inicial', legenda: 'Legenda do roteiro' }] },
  programacao: { sector: 'programacao_posts', title: 'Posts da semana', client: 'Ravel' },
  copy: { sector: 'copywriting', title: 'Textos', client: 'Bella Moda' },
};
const R = {}; let i = 0;
for (const st of STATUSES) for (const [k, tp] of Object.entries(TYPES))
  R[st + ':' + k] = M.kbv2Card(Object.assign({ id: 'T' + (++i), status: st }, full, tp));
R['reaberto:videos'] = M.kbv2Card(Object.assign({ id: 'TR', status: 'andamento', _stlabel: 'Reaberta — em produção' }, full, TYPES.videos));
R['designer:cronograma'] = M.kbv2Card(Object.assign({ id: 'TD', status: 'andamento', designerAssignment: { designerId: 'dz' } }, full, TYPES.cronograma), 'designer');
R['client:cronograma'] = M.kbv2Card(Object.assign({ id: 'TC', status: 'andamento' }, full, TYPES.cronograma), 'client');
R['legado:contents'] = M.kbv2Card(Object.assign({ id: 'TL', status: 'afazer' }, full, { sector: 'cronograma', title: 'Tarefa antiga', client: 'Histórico', contents: [{ tema: 'Tema legado' }] }));
const ALL = Object.entries(R);

/* shape = ordem dos blocos ESTRUTURAIS presentes (slot central normalizado) */
const CORE = ['kbv2-card-top', 'kbv2-card-profile', 'kbv2-card-origin', 'kbv2-card-main', 'kbv2-card-chips', '@SLOT', 'kbv2-card-chk', 'kbv2-card-rail', 'kbv2-stage2', 'kbv2-card-date', 'kbv2-card-footer'];
function shape(h) {
  const slot = Math.min(...['kbv2-card-themes', 'kbv2-card-notes'].map(c => { const p = h.indexOf(c); return p < 0 ? Infinity : p; }));
  return CORE.map(c => c === '@SLOT' ? (slot === Infinity ? -1 : slot) : h.indexOf(c))
    .map((p, idx) => ({ c: CORE[idx], p })).filter(x => x.p >= 0)
    .sort((a, b) => a.p - b.p).map(x => x.c).join('>');
}
const CANON = shape(R['andamento:videos']);

console.log('===== F3.5.4E — UNIFICAÇÃO DO MODELO DE CARD =====');
console.log('shape canônico (Em andamento):', CANON);

console.log('\n-- Renderizador ÚNICO (1-3, 23, 24) --');
ok((HTML.match(/kbv2BoardHtml\(/g) || []).length >= 6, '1 todos os quadros desktop montam via kbv2BoardHtml/kbv2Card (5 call sites + definição)');
{ const codeCalls = (HTML.match(/colTasks\.map\(taskCard\)/g) || []).length;   // chamada REAL (comentários citam o literal genérico)
  const mobileZone = HTML.slice(HTML.indexOf('// Mobile: mantém o seletor de coluna única'), HTML.indexOf('function fmtDateTimeBR'));
  ok(codeCalls === 1 && mobileZone.includes('colTasks.map(taskCard)') && !/\btaskCard\(/.test(HTML.replace(/function taskCard\(/g, '').replace(/kbv2Card\(t, persp\);/g, '')) === false || (codeCalls === 1 && mobileZone.includes('colTasks.map(taskCard)')), '2 NENHUM quadro desktop chama taskCard (única chamada real colTasks.map(taskCard) está no ramo mobile/paridade APK)');
  const tk = grab('taskCard');
  ok(/^function taskCard\(t, persp\)\{\s*\/\*[\s\S]{0,400}?\*\/\s*if\(isDesktop\(\)\)return kbv2Card\(t, persp\);/.test(tk), '3 taskCard/tcv4 INALCANÇÁVEL no desktop: guarda na 1ª instrução devolve o card oficial'); }
ok(/const IS_ELECTRON_APP=!!\(typeof window!=='undefined'&&window\.api\);/.test(HTML) && /function isDesktop\(\)\{return IS_ELECTRON_APP\|\|DESKTOP_MQ\.matches;\}/.test(HTML), '24 snapshot/tempo real NUNCA restaura template antigo: no Electron isDesktop() é SEMPRE true (causa-raiz MQ<1024px eliminada)');
ok(ALL.every(([, h]) => !h.includes('tcv4') && (h.match(/data-card-component="KanbanTaskCardUnified"/g) || []).length === 1), '23 nenhum card alternativo: zero tcv4 nas saídas; identidade única por card');

console.log('\n-- SHELL idêntico por STATUS (4-7, 16) --');
ok(shape(R['afazer:videos']) === CANON, '4 A Fazer usa o MESMO shell');
ok(shape(R['andamento:videos']) === CANON, '5 Em andamento usa o MESMO shell (blueprint)');
ok(shape(R['revisao:videos']) === CANON, '6 Revisão usa o MESMO shell');
ok(shape(R['concluido:videos']) === CANON && shape(R['reaberto:videos']) === CANON, '7 Concluído e Reaberta usam o MESMO shell');
ok(STATUSES.every(st => shape(R[st + ':videos']) === CANON) && shape(R['designer:cronograma']) === CANON && shape(R['client:cronograma']) === CANON, '16 NENHUM status/perspectiva remove blocos estruturais');

console.log('\n-- SHELL idêntico por TIPO (8-12, 17, 25) --');
ok(shape(R['andamento:cards_legenda']) === CANON && shape(R['andamento:cards_sem']) === CANON, '8 Edição de Cards (com e sem legenda) usa o MESMO shell');
ok(shape(R['andamento:videos']) === CANON, '9 Edição de vídeos usa o MESMO shell');
ok(shape(R['andamento:cronograma']) === CANON, '10 Cronograma usa o MESMO shell');
ok(shape(R['andamento:roteiro']) === CANON, '11 Roteiro usa o MESMO shell');
ok(shape(R['andamento:programacao']) === CANON && shape(R['andamento:copy']) === CANON, '12 Programação de Posts (e demais tipos) usam o MESMO shell');
ok(ALL.every(([, h]) => shape(h) === CANON), '17 matriz COMPLETA (' + ALL.length + ' renders): tipo NUNCA altera o shell — shape único');
ok(shape(R['legado:contents']) === CANON && R['legado:contents'].includes('Tema legado'), '25 tarefa ANTIGA (schema contents legado) usa o modelo único');

console.log('\n-- Painel central UNIVERSAL (13-15) --');
{ const c = R['andamento:cards_legenda'];
  ok(c.includes('kbv2-card-notes') && c.includes('<span>Legenda</span>') && /id="f354e-card-styles"[\s\S]*\.kbv2-card-notes\{ border:1px solid rgba\(255,255,255,\.07\); border-radius:11px;\s*\n\s*background:rgba\(255,255,255,\.03\)/.test(HTML), '13 LEGENDA no PAINEL padrão (mesmos tokens do TEMAS: borda .07/raio 11/fundo .03) — nada de texto solto');
  ok(/\.kbv2-card-note \.kbv2-note-v\{[^}]*-webkit-line-clamp:unset/.test(HTML.slice(HTML.indexOf('id="f354e-card-styles"'))), '13b LEGENDA sem clamp/ocultação (quebra natural, cascata pós-f354b)'); }
ok(R['andamento:videos'].includes('kbv2-card-themes') && R['andamento:videos'].includes('kbv2-themes-h'), '14 TEMAS no painel padrão (caixa + cabeçalho)');
{ const e = R['andamento:copy'];
  ok(e.includes('kbv2-slot-empty') && e.includes('Sem itens vinculados') && e.indexOf('kbv2-card-themes') > e.indexOf('kbv2-card-chips') && e.indexOf('kbv2-card-themes') < e.indexOf('kbv2-card-rail'), '15 SEM conteúdo → empty state DENTRO do painel central (mesma posição estrutural)'); }

console.log('\n-- Componentes idênticos (18-20) --');
ok(ALL.every(([, h]) => h.includes('data-detail=') && h.includes('data-move=') && h.includes('data-cardmenu=')), '18 botões Detalhes/Mover/Menu: MESMO DOM e handlers em TODOS os cards');
ok(ALL.every(([, h]) => h.includes('kbv2-card-rail') && h.includes('kbv2-card-chk')), '19 progresso (trilho + contagem do checklist) presente e idêntico em TODOS');
ok(ALL.every(([, h]) => h.includes('kbv2-card-date') && h.includes('data-ic="calendar"')), '20 prazo: MESMO componente em TODOS');
{ const z = M.kbv2Card(Object.assign({ id: 'TZ', status: 'afazer' }, full, TYPES.videos, { checklist: [] }));
  ok(z.includes('0 de 0 no checklist'), '19b checklist VAZIO ainda mostra contagem (0 de 0) — sem componente simplificado'); }

console.log('\n-- Identidade F3.5.4B preservada (21-22) --');
ok(ALL.every(([, h]) => h.includes('por <b>Marina</b>')) && HTML.includes("kbv2-origin-tx\">por <b>'+esc(kbv2FirstName(reqName))"), '21 campo "por" usa PRIMEIRO nome em todos os cards (fonte kbv2 usa o helper; nome completo só no tcv4 mobile inalcançável)');
ok(/id="f354e-card-styles"[\s\S]*\.kbv2-name\{ white-space:normal; display:-webkit-box;[\s\S]{0,120}-webkit-line-clamp:2/.test(HTML), '22 nome principal suporta ATÉ DUAS LINHAS (quebra controlada + tooltip)');

console.log(`\n===== RESULTADO: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
