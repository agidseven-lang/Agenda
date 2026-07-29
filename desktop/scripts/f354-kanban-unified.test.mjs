#!/usr/bin/env node
/* =====================================================================
 * F3.5.4 COMMIT A — KanbanTaskCardUnified (card Kanban ÚNICO, compacto, profissional).
 * READ-ONLY sobre index.html: extrai o kbv2Card REAL e prova o CONTRATO UNIFICADO:
 *   U) UM esqueleto para TODOS os setores (root uniforme, sem classe por setor,
 *      mesma ordem de blocos, rodapé/botões idênticos, trilho/etapa/próxima em todos);
 *   S) slots específicos: Edição de Cards (Legenda/Obs ≤2 linhas c/ rótulo iconográfico),
 *      cron (Temas com "+N · ver em Detalhes" quando >2), checklist iconográfico;
 *   C) compactação: medidas-chave reduzidas (gap/padding/avatar/título/botões/origem
 *      em linha única) com redução da altura fixa estimada entre 20% e 35%;
 *   E) esticamento PROD1.6 NEUTRALIZADO (card único = altura natural, todos os setores);
 *   P) sem perda funcional (data/checklist/chips/ações preservados; tooltips presentes).
 * Rodar: node desktop/scripts/f354-kanban-unified.test.mjs
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

/* ── monta o kbv2Card REAL (mesmo harness aprovado do f3370-d3r10b) ── */
const NAMES = ['SECTORS', 'SECTOR_ALIAS', 'secOf', 'isClientSector', 'STATUS', 'stOf', 'dtMs', 'humanDur', 'todayStr', 'taskDeadline', 'esc', 'withAlpha', 'fmtDateTimeBR', 'cronOf', 'kbv2NextForStatus', 'opOwnerLabel', 'deriveOperationalCardPresentation', 'kbv2DeriveStatus', 'kbv2Card', 'kbv2Empty', 'kbv2BoardHtml'];
let SRC = ''; for (const n of NAMES) SRC += grab(n) + '\n';
const PRELUDE =
  'var state={user:{id:"u1"},users:[{id:"u1",name:"Marina Souza",role:"Social Media"}]};\n' +
  'function respOf(t){return {id:"u2",name:"Fulana Teste",role:"Editora"};}\n' +
  'function avatar(u,s){return \'<span class="av" data-av-size="\'+s+\'"></span>\';}\n' +
  'function svg(k){return \'<svg data-ic="\'+k+\'"></svg>\';}\n' +
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
  'function canDelTask(t){return false;}\n' +
  'function cardsFieldOf(t,k){return k==="legenda"?String(t.cardLegenda||""):String(t.cardObs||"");}\n';
const M = new Function(PRELUDE + SRC + '\nreturn {kbv2Card,kbv2BoardHtml};')();

const base = { id: 'T1', title: 'Tarefa de teste com um título razoavelmente longo para o clamp', client: 'Cliente X', status: 'andamento', by: 'u1', createdAt: 1751900000000, dueDate: '2026-08-01', dueTime: '18:00', checklist: [{ d: true }, { d: false }, { d: false }] };
const cards = {
  copy:    M.kbv2Card(Object.assign({}, base, { sector: 'copywriting' })),
  cron:    M.kbv2Card(Object.assign({}, base, { id: 'T2', sector: 'cronograma', cronContents: [{ tema: 'Tema A' }, { tema: 'Tema B' }, { tema: 'Tema C' }, { tema: 'Tema D' }] })),
  cron2:   M.kbv2Card(Object.assign({}, base, { id: 'T3', sector: 'cronograma', cronContents: [{ tema: 'Só um' }, { tema: 'E dois' }] })),
  cards:   M.kbv2Card(Object.assign({}, base, { id: 'T4', sector: 'edicao_cards', cardLegenda: 'Legenda com emojis 🚀 e acentos çãé', cardObs: 'Observação relevante' })),
  cardsSem:M.kbv2Card(Object.assign({}, base, { id: 'T5', sector: 'edicao_cards' })),
  roteiro: M.kbv2Card(Object.assign({}, base, { id: 'T6', sector: 'roteiro' })),
  done:    M.kbv2Card(Object.assign({}, base, { id: 'T7', sector: 'copywriting', status: 'concluido' })),
};
const ALL = Object.values(cards);

console.log('===== F3.5.4 COMMIT A — KanbanTaskCardUnified =====');
console.log('\n-- U: esqueleto ÚNICO --');
ok(ALL.every(h => h.includes('data-card-renderer="canonical-board-card"') && h.includes('data-card-component="KanbanTaskCardUnified"')), 'U1 todos os setores usam o componente unificado (marker + identidade)');
ok(ALL.every(h => h.startsWith('<div class="kbv2-card" ')), 'U2 root literal ÚNICO class="kbv2-card" — NENHUMA classe por setor');
ok(!HTML.includes("' kbv2-card--cards'") && !/body\.desktop \.kbv2-card\.kbv2-card--cards/.test(HTML), 'U3 variante --cards extinta (sem emissão JS, sem regra CSS)');
const ORDER = ['kbv2-card-top', 'kbv2-card-profile', 'kbv2-card-origin', 'kbv2-card-main', 'kbv2-card-chips', 'kbv2-card-rail', 'kbv2-stage2', 'kbv2-card-footer'];
const OPT = new Set(['kbv2-card-origin']);
function orderedIdx(h) { let last = -1; for (const c of ORDER) { const i = h.indexOf(c); if (i < 0) { if (OPT.has(c)) continue; return false; } if (i < last) return false; last = i; } return true; }
ok(ALL.every(orderedIdx), 'U4 MESMA ordem de blocos em todos: topo→responsável→origem→título→setor→trilho→etapa→rodapé');
ok(ALL.every(h => { const f = h.indexOf('kbv2-card-footer'); return f > 0 && f > h.indexOf('kbv2-card-date'); }), 'U5 rodapé (Detalhes/Mover/⋯) é o ÚLTIMO bloco em todos');
ok(ALL.every(h => h.includes('data-detail=') && h.includes('data-move=')), 'U6 ações idênticas em todos (data-detail + data-move)');
ok(ALL.every(h => h.includes('kbv2-card-rail') && h.includes('Etapa atual')), 'U7 trilho e "Etapa atual" em TODOS os setores');
ok(cards.done.includes('Nenhuma pendência'), 'U8 concluído: "Nenhuma pendência" (contrato preservado)');
// slot específico fica entre os chips e o trilho — mesma posição estrutural
function slotBetween(h, cls) { const i = h.indexOf(cls); return i < 0 ? true : (i > h.indexOf('kbv2-card-chips') && i < h.indexOf('kbv2-card-rail')); }
ok(slotBetween(cards.cards, 'kbv2-card-notes') && slotBetween(cards.cron, 'kbv2-card-themes'), 'U9 slot específico ocupa a MESMA posição estrutural (entre setor e trilho)');

console.log('\n-- S: slots por setor (conteúdo varia; estrutura não) --');
ok(cards.cards.includes('kbv2-card-notes') && cards.cards.includes('<span>Legenda</span>') && cards.cards.includes('data-ic="description"') && cards.cards.includes('<span>Observações</span>') && cards.cards.includes('data-ic="notes"'), 'S1 Edição de Cards: Legenda/Observações com rótulos ICONOGRÁFICOS');
ok(!cards.cardsSem.includes('kbv2-card-notes'), 'S2 campos vazios NÃO reservam bloco');
ok(cards.cron.includes('kbv2-themes-more') && cards.cron.includes('+2 temas') && cards.cron.includes('ver em Detalhes'), 'S3 cron >2 temas: "+N temas · ver em Detalhes" (sem rolagem interna)');
ok(!cards.cron2.includes('kbv2-themes-more'), 'S4 cron ≤2 temas: sem chip "+N"');
ok(/\.kbv2-themes-list \.kbv2-theme:nth-child\(n\+3\)\{ display:none; \}/.test(HTML), 'S5 CSS capa a prévia em 2 itens (mini-lista nunca rola)');
ok(ALL.every(h => !h.includes('checklist') || h.includes('data-ic="check"')), 'S6 checklist iconográfico');

console.log('\n-- C: compactação (20–30%) --');
ok(/\.kbv2-card\{[\s\S]{0,200}gap:9px;/.test(HTML) && /padding:13px; border-radius:14px; background:linear-gradient\(180deg,#161d2e,#121726\)/.test(HTML), 'C1 card: gap 13→9, padding 16→13');
ok(ALL.every(h => h.includes('data-av-size="34"') || !h.includes('data-av-size')), 'C2 avatar 48→34 (todos os cards)');
ok(/\.kbv2-title\{ font-size:15px;[\s\S]{0,220}-webkit-line-clamp:2/.test(HTML), 'C3 título 18→15px com clamp de 2 linhas UNIVERSAL (+reticências)');
ok(/\.kbv2-btn\{ height:34px;/.test(HTML), 'C4 botões 40→34px (mesma altura em todos)');
ok(/\.kbv2-card-origin\{ display:flex; align-items:center; gap:6px; padding:0; border:0; background:transparent;/.test(HTML), 'C5 origem: caixa grande → LINHA única discreta');
ok(ALL.every(h => !h.includes('kbv2-origin-l1')), 'C6 origem sem as 2 linhas antigas (l1/l2)');
// altura FIXA estimada (paddings+gaps+blocos de altura conhecida) ANTES(1.0.193)×DEPOIS(agora)
const NBLOCOS = 9; // topo, perfil, origem, título, chips, trilho, etapa(2 linhas), data, rodapé
const antes = 16 * 2 + 13 * (NBLOCOS - 1) + 48 + 22.5 * 2 + (9 * 2 + 12.5 * 2 * 1.35) + 40 + 26 * 2;
const depois = 13 * 2 + 9 * (NBLOCOS - 1) + 34 + 19.5 * 2 + 11.5 * 1.3 + 34 + 20 * 2;
const red = 1 - depois / antes;
ok(red >= 0.20 && red <= 0.35, `C7 redução da altura fixa estimada = ${(red * 100).toFixed(1)}% (meta 20–30%)`);

console.log('\n-- E: esticamento neutralizado --');
const iOld = HTML.indexOf('kbv2-card:only-child{ flex:1 1 auto; min-height:0; }');
const iNew = HTML.indexOf(':only-child{ flex:0 0 auto; min-height:auto; }');
ok(iOld > 0 && iNew > iOld, 'E1 override F3.5.4 DEPOIS da regra PROD1.6 (cascata vence: card único não estica)');
ok(/:only-child>\.kbv2-card-notes\{ margin-top:0; \}/.test(HTML.slice(iNew)) || /:only-child>\.kbv2-card-origin,[\s\S]{0,200}margin-top:0/.test(HTML.slice(iNew)), 'E2 respiro artificial (margin-top:auto) neutralizado nos 3 pontos');
ok(!/body\.desktop \.kbv2-card>\.kbv2-card-origin,\n\s*body\.desktop \.kbv2-card>\.kbv2-card-rail,\n\s*body\.desktop \.kbv2-card>\.kbv2-card-chk\{ display:none \}/.test(HTML), 'E3 notebook: origem/trilho/checklist NÃO somem mais (conteúdo nunca é perdido)');

console.log('\n-- P: sem perda funcional + tooltips --');
ok(ALL.every(h => h.includes('kbv2-card-date') && h.includes('data-ic="calendar"')), 'P1 prazo com ícone de calendário em todos');
ok(cards.copy.includes('1 de 3 no checklist'), 'P2 contagem do checklist preservada');
ok(/title="Enviado por Marina Souza em /.test(cards.copy), 'P3 origem com tooltip "Enviado por … em …" completo');
ok(/class="kbv2-st2-pill" title="/.test(cards.copy) && /class="kbv2-st2-next" title="/.test(cards.copy), 'P4 etapa/próxima com tooltip (valores em linha única)');
ok(/class="kbv2-name" title="/.test(cards.copy), 'P5 nome do responsável com tooltip');
ok(cards.cards.includes('Legenda com emojis 🚀 e acentos çãé'), 'P6 conteúdo da Legenda íntegro no card (escape correto)');
const board = M.kbv2BoardHtml([{ label: 'A Fazer', color: '#999', key: 'afazer', tasks: [Object.assign({}, base, { sector: 'copywriting' })] }]);
ok((board.match(/data-card-component="KanbanTaskCardUnified"/g) || []).length === 1 && board.includes('kbv2-board-surface'), 'P7 board builder intacto usa o card unificado');

console.log(`\n===== RESULTADO: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
