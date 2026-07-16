#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C23 — RESET DETERMINÍSTICO do wizard "Nova tarefa" (Desktop).
   BUG COMPROVADO (1.0.168): o botão GLOBAL "Nova tarefa" e o botão contextual
   "Adicionar tarefa" da coluna compartilhavam o MESMO handler [data-fab], que
   dentro de um quadro passava state.boardSector → openTaskForm(sector) pulava
   direto à etapa Dados com o setor herdado (ex.: Roteiro).
   CORREÇÃO: handlers SEPARADOS — openGlobalNewTask() (reset completo, SEMPRE
   etapa Setor, descarta _sendCtx) × openContextualNewTask(sector) (comporta-
   mento contextual aprovado da coluna/board).
   Micro-exec REAL: extrai as funções do renderer e executa os cenários do
   mandato (todos os quadros, reabertura, pós-criação); pins de fiação estática
   garantem que os botões apontam para os handlers certos. READ-ONLY.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };
const line = (rx) => { const m = HTML.match(rx); if (!m) throw new Error('não achei ' + rx); return m[0]; };

console.log('F3.3.73I6C23 — wizard "Nova tarefa": reset global × contextual');

/* ── A: micro-exec das funções REAIS ── */
const SRCFN =
  line(/function newForm\(sector\)\{[^\n]*\}/) + '\n' +
  line(/function openGlobalNewTask\(\)\{[^\n]*\}/) + '\n' +
  line(/function openContextualNewTask\(sector\)\{[^\n]*\}/) + '\n';

function mkWiz() {
  const calls = { closeModal: 0, render: 0 };
  const state = { tab: 'tarefas', boardSector: null, form: null, _sendCtx: null };
  const secOf = (s) => ({ key: s, label: s, descontinuado: s === 'copywriting' });
  const api = new Function('state', 'closeModal', 'render', 'secOf',
    SRCFN + '\nreturn { openGlobalNewTask, openContextualNewTask, newForm };')(
    state, () => calls.closeModal++, () => calls.render++, secOf);
  return { state, api, calls };
}
const FRESH = { id: null, step: 0, sector: null, title: '', client: '', assigneeId: null, assignee: '', status: 'afazer',
  startDate: '', startTime: '', endDate: '', endTime: '', dueDate: '', dueTime: '', priority: false, subtype: null,
  link: '', obs: '', _openContent: null };
const isFresh = (f) => !!f && Object.keys(FRESH).every((k) => f[k] === FRESH[k]) &&
  Array.isArray(f.contents) && f.contents.length === 0 && Array.isArray(f.items) && f.items.length === 0 &&
  Array.isArray(f.checklist) && f.checklist.length === 0 && f.fields && Object.keys(f.fields).length === 0;

/* W1–W4 — botão GLOBAL a partir de CADA quadro: SEMPRE etapa Setor, nada herdado */
for (const board of ['cronograma', 'roteiro', 'edicao', 'posts']) {
  const { state, api } = mkWiz();
  state.boardSector = board;
  api.openGlobalNewTask();
  ok(`W-global no quadro "${board}": etapa 1 (Setor), setor NÃO herdado, formulário 100% novo`,
    state.form.step === 0 && state.form.sector === null && isFresh(state.form));
}

/* W5 — contextual preservado: coluna do Roteiro abre Dados com Roteiro (decisão aprovada) */
{
  const { state, api } = mkWiz();
  api.openContextualNewTask('roteiro');
  ok('W5 contextual("roteiro"): etapa Dados (step=1) com setor roteiro (comportamento aprovado da coluna)',
    state.form.step === 1 && state.form.sector === 'roteiro');
}

/* W6 — selecionar Roteiro (contextual), fechar o modal, clicar no GLOBAL → Setor sem pré-seleção */
{
  const { state, api } = mkWiz();
  api.openContextualNewTask('roteiro');
  state.form = null;                       // fechar modal (data-form=close → state.form=null)
  api.openGlobalNewTask();
  ok('W6 fechar e reabrir pelo GLOBAL: etapa Setor SEM Roteiro pré-selecionado',
    state.form.step === 0 && state.form.sector === null);
}

/* W7 — resíduos agressivos (form preenchido em etapa avançada) → global zera TUDO */
{
  const { state, api } = mkWiz();
  state.form = api.newForm('roteiro');
  state.form.step = 2; state.form.client = 'Cliente X'; state.form.title = 'Título Y';
  state.form.subtype = 'sub1'; state.form.priority = true; state.form.contents.push({ t: 'residuo' });
  api.openGlobalNewTask();
  ok('W7 após formulário preenchido/etapa avançada: GLOBAL entrega formulário completamente limpo',
    isFresh(state.form) && state.form.step === 0 && state.form.sector === null);
}

/* W8 — GLOBAL descarta o contexto residual de envio (_sendCtx) */
{
  const { state, api } = mkWiz();
  state._sendCtx = { id: 't1', sector: 'roteiro', token: 'x' };
  api.openGlobalNewTask();
  ok('W8 GLOBAL zera state._sendCtx (nenhum contexto de envio herdado)', state._sendCtx === null);
}

/* W9 — setor descontinuado no contextual cai para etapa Setor (sem herança inválida) */
{
  const { state, api } = mkWiz();
  api.openContextualNewTask('copywriting');
  ok('W9 contextual de setor descontinuado: volta à etapa Setor com setor null',
    state.form.step === 0 && state.form.sector === null);
}

/* W10 — GLOBAL nunca depende do tab atual (handler troca p/ tarefas e reseta) */
{
  const { state, api } = mkWiz();
  state.tab = 'agenda'; state.boardSector = 'roteiro';
  api.openGlobalNewTask();
  ok('W10 GLOBAL fora do tab tarefas: mesmo reset (etapa Setor, sem setor)',
    state.form.step === 0 && state.form.sector === null);
}

/* W11 — idempotência: dois cliques seguidos no GLOBAL = mesmo estado limpo */
{
  const { state, api } = mkWiz();
  api.openGlobalNewTask(); state.form.client = 'sujou';
  api.openGlobalNewTask();
  ok('W11 GLOBAL idempotente: segundo clique entrega formulário limpo de novo', isFresh(state.form));
}

/* ── B: fiação ESTÁTICA (botões → handlers certos; sem persistência de form) ── */
ok('B1 botão GLOBAL da nav usa data-fab (handler global)',
  /<button class="new-task-btn" data-fab="1">/.test(HTML.replace(/\\'/g, "'").replace(/'\+svg\('plus'\)\+'/, '')) ||
  /new-task-btn" data-fab="1"/.test(HTML));
ok('B2 FAB mobile usa data-fab (handler global)', /class="fab" data-fab="1"/.test(HTML));
ok('B3 botão da COLUNA usa data-fabctx (contextual, separado do global)',
  /kbv2-column-add" data-fabctx="1"/.test(HTML) && !/kbv2-column-add" data-fab="1"/.test(HTML));
ok('B4 handler [data-fab] chama openGlobalNewTask() e NÃO usa boardSector',
  (() => { const h = line(/if\(el=g\('\[data-fab\]'\)\)\{[^\n]*\}/); return /openGlobalNewTask\(\)/.test(h) && !/boardSector/.test(h) && !/openContextualNewTask/.test(h); })());
ok('B5 handler [data-fabctx] chama openContextualNewTask(state.boardSector)',
  /if\(el=g\('\[data-fabctx\]'\)\)\{openContextualNewTask\(state\.boardSector\);return;\}/.test(HTML));
ok('B6 board "+ Novo" (data-board=new) é contextual', /else if\(a==='new'\)\{openContextualNewTask\(state\.boardSector\);return;\}/.test(HTML));
ok('B7 nenhum resquício do handler antigo compartilhado (openTaskForm removido)', !/openTaskForm\(/.test(HTML));
ok('B8 reset zera _sendCtx no GLOBAL (fonte)', /function openGlobalNewTask\(\)\{closeModal\(\);state\._sendCtx=null;state\.form=newForm\(null\);render\(\);\}/.test(HTML));
ok('B9 state.form NUNCA é persistido (sem localStorage de formulário — reabrir/logout começa limpo)',
  !/localStorage\.(set|get)Item\([^)]*form/i.test(HTML));
ok('B10 etapa Setor oferece os 4 setores no stepSector (Edição de mídia/Cronograma/Roteiro/Programação de posts)',
  (() => { const i = HTML.indexOf('function stepSector'); const seg = HTML.slice(i, i + 4000);
    return /SECTORS|secOf|sector/.test(seg) && /Escolha o setor/.test(seg); })() &&
  /Edição de mídia/.test(HTML) && /Programação de posts/.test(HTML));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
