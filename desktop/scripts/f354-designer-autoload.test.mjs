#!/usr/bin/env node
/* =====================================================================
 * F3.5.4 COMMIT B — AUTOLOAD do quadro de Designers (testes obrigatórios 19-29).
 * READ-ONLY sobre index.html: extrai as funções REAIS (f354DesignerAutoPick/SelLoad/SelSave/
 * f354DesignerStrip/designerBoardsList) e prova:
 *   19 Designer logado abre o PRÓPRIO quadro automaticamente;
 *   20 Admin/Social restaura o último Designer selecionado POR USUÁRIO;
 *   21 primeiro acesso → 1º Designer ativo na ordenação canônica (A→Z);
 *   22 quadro aparece SEM clique (handler da aba já seleciona);
 *   23 seleção persiste por usuário; 24 troca de usuário não mistura (mapa por uid +
 *      logout limpa navegação); 25-27 contadores/cards/tempo real (mesmos listeners globais);
 *   28 nenhum listener novo/duplicado; 29 sem Designer ativo → null + estado vazio explícito.
 * Rodar: node desktop/scripts/f354-designer-autoload.test.mjs
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

function grab(n) {
  let a = HTML.indexOf('function ' + n + '('); let isFn = a >= 0;
  if (a < 0) a = HTML.indexOf('const ' + n + '='); if (a < 0) a = HTML.indexOf('var ' + n + '=');
  if (a < 0) throw new Error('não encontrei: ' + n);
  if (isFn) { let d = 0; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return HTML.slice(a, j + 1); } } }
  let d = 0; for (let j = a; j < HTML.length; j++) { const c = HTML[j]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) return HTML.slice(a, j + 1); }
  throw new Error('sem fim: ' + n);
}
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS — ' + msg); } else { fail++; console.log('  FAIL — ' + msg); } }

/* harness: localStorage fake + stubs mínimos; funções REAIS extraídas */
const SRC = ['DESIGNER_SEL_KEY', 'f354DesignerSelLoad', 'f354DesignerSelSave', 'f354DesignerAutoPick', 'f354DesignerStrip', 'designerBoardsList'].map(grab).join('\n');
function mkCtx(user, tasks, users) {
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const PRE =
    'var state={user:' + JSON.stringify(user) + ',tasks:' + JSON.stringify(tasks) + ',users:' + JSON.stringify(users) + '};\n' +
    'function isDesignerFlow(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId);}\n' +
    'function designerOf(t){return t&&t.designerAssignment?t.designerAssignment.designerId:null;}\n' +
    'function esc(s){return String(s==null?"":s);}\n' +
    'function avatar(u,s){return \'<span class="av"></span>\';}\n' +
    'function designerCol(t){return (t&&t.status)||"afazer";}\n' +
    'function taskDeadline(t){return null;}\n';
  const M = new Function('localStorage', 'Date', PRE + SRC + '\nreturn {pick:f354DesignerAutoPick,load:f354DesignerSelLoad,save:f354DesignerSelSave,strip:f354DesignerStrip,list:designerBoardsList};')(localStorage, Date);
  return { M, store, localStorage };
}
const U = [{ id: 'd1', name: 'Bruna Lima', role: 'Designer' }, { id: 'd2', name: 'Caio Souza', role: 'Designer' }, { id: 'adm', name: 'Ana Adm', role: 'Administradora', admin: true }];
const T = [
  { id: 't1', designerAssignment: { designerId: 'd1' }, status: 'andamento' },
  { id: 't2', designerAssignment: { designerId: 'd2' }, status: 'afazer' },
  { id: 't3', designerAssignment: { designerId: 'd2' }, status: 'revisao' },
];

console.log('===== F3.5.4 COMMIT B — Designers AUTOLOAD =====');
{ const { M } = mkCtx({ id: 'd2', name: 'Caio' }, T, U);
  ok(M.pick() === 'd2', '19 Designer logado → abre o PRÓPRIO quadro (sem clique no próprio nome)'); }
{ const c = mkCtx({ id: 'adm' }, T, U);
  c.M.save('adm', 'd2');
  ok(c.M.pick() === 'd2', '20 Admin → restaura o ÚLTIMO Designer selecionado por ESTE usuário'); }
{ const { M } = mkCtx({ id: 'adm' }, T, U);
  ok(M.pick() === 'd1', '21 primeiro acesso (sem seleção) → 1º Designer ativo na ordenação canônica (A→Z)'); }
ok(/data-flowdesigners\]'\)\)\{state\.flowView='designers';state\.designerBoard=f354DesignerAutoPick\(\);/.test(HTML),
  '22 abrir a aba Designers JÁ seleciona o quadro (nenhum clique exigido)');
{ const c = mkCtx({ id: 'adm' }, T, U);
  c.M.save('adm', 'd2'); c.M.save('sm1', 'd1');
  ok(c.M.load('adm') === 'd2' && c.M.load('sm1') === 'd1' && c.M.load('outro') === null,
    '23 seleção persistida POR usuário (uid → {id, at, ctx})');
  const raw = JSON.parse(c.store['idseven.designerSel.v1']);
  ok(raw.adm && raw.adm.at > 0 && raw.adm.ctx === 'designers', '23b registro guarda data da seleção e contexto da página'); }
{ const c = mkCtx({ id: 'sm1' }, T, U);
  c.M.save('adm', 'd2');
  ok(c.M.pick() === 'd1', '24 seleção de OUTRO usuário no mesmo computador NÃO é herdada (sm1 ignora a escolha de adm)'); }
ok(/state\.user=null;state\.flowView=null;state\.designerBoard=null;state\.socialBoard=null;state\.personBoard=null;state\.roleBoards=false;state\.boardSector=null;boardQuery='';/.test(HTML),
  '24b logout limpa navegação/quadro (novo usuário nunca vê o contexto do anterior)');
{ const { M } = mkCtx({ id: 'adm' }, T, U);
  const s = M.strip('d2');
  ok(/f354-dchip on/.test(s) && (s.match(/data-designerboard=/g) || []).length === 2, '25 faixa de seleção visível com chip ATIVO destacado (cartões continuam visíveis)');
  ok(/<i>1<\/i>/.test(s) && /<i>2<\/i>/.test(s), '26 contadores por Designer corretos na faixa (1 p/ Bruna, 2 p/ Caio)'); }
ok(/'<div class="scr" style="padding-top:0">'\+f354DesignerStrip\(id\)\+boardToolbar\(\)/.test(HTML),
  '27 quadro selecionado renderiza IMEDIATAMENTE com a faixa acima (renderDesignerBoard)');
{ const helpers = ['f354DesignerSelLoad', 'f354DesignerSelSave', 'f354DesignerAutoPick', 'f354DesignerStrip'].map(grab).join('');
  ok(!/listen\(|onSnapshot|subscribe/.test(helpers), '28 NENHUM listener novo/duplicado (autoload reusa os snapshots globais do subscribeData)'); }
{ const { M } = mkCtx({ id: 'adm' }, [], U);
  ok(M.pick() === null, '29 sem Designer ativo → null (hub mostra estado vazio explícito)');
  ok(/Nenhuma tarefa enviada a designers ainda/.test(HTML), '29b texto do estado vazio explícito presente no hub'); }
{ const c = mkCtx({ id: 'adm' }, T, U);
  c.M.save('adm', 'd9');
  ok(c.M.pick() === 'd1', 'extra: seleção salva de Designer que SAIU da lista é ignorada com fallback canônico'); }
ok(/f354DesignerSelSave\(state\.user&&state\.user\.id,state\.designerBoard\);state\.socialBoard=null;/.test(HTML) &&
   /f354DesignerSelSave\(state\.user&&state\.user\.id,state\.designerBoard\);state\.personBoard=null;/.test(HTML),
  'extra: cliques (cartão e data-goboard) persistem a seleção do usuário atual');

console.log(`\n===== RESULTADO: ${pass} PASS / ${fail} FAIL =====`);
process.exit(fail ? 1 : 0);
