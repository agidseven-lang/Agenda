#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C2 — Testes HERMÉTICOS (texto/fonte) do CRUD+lifecycle da Agenda
   compartilhada no Desktop 1.0.161, usando o contrato server-side 73I6C1:
     - editar compromisso (form preenchido → update, preserva by/createdAt/src,
       grava updatedAt/updatedBy);
     - cancelar = exclusão LÓGICA (status:'cancelled'+cancelledAt/By; NUNCA delete físico);
     - iniciar (startedAt/startedBy) e finalizar (done/doneAt/doneBy) por botão explícito;
     - status derivado (scheduled/in_progress/completed/cancelled) exibido no detalhe e card;
     - botões condicionais ao estado; cancelados saem da Agenda ativa;
     - realtime + criação + src:'webpreview' preservados; Board/Chat/Copywriting intactos.
   Lê index.html/package.json como TEXTO — NÃO abre Electron, NÃO rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const PJ = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C2 — Agenda CRUD+lifecycle (Desktop 1.0.161)');

/* ── A: versão + helpers de status (espelho do contrato server-side) ── */
ok('A1 versão 1.0.161', PJ.version === '1.0.161');
ok('A2 evStatus deriva de status/cancelledAt→cancelled, done→completed, startedAt→in_progress',
  /function evStatus\(e\)\{[\s\S]{0,240}status==='cancelled'\|\|e\.cancelledAt\)return 'cancelled';[\s\S]{0,80}e\.done===true\)return 'completed';[\s\S]{0,80}\+e\.startedAt>0\)return 'in_progress';return 'scheduled'/.test(HTML));
ok('A3 evStatusMeta com os 4 rótulos (Agendado/Em andamento/Finalizado/Cancelado)',
  /Agendado/.test(HTML) && /Em andamento/.test(HTML) && /Finalizado/.test(HTML) && /Cancelado/.test(HTML) && /function evStatusMeta\(st\)/.test(HTML));
ok('A4 isEvCancelled derivado de evStatus', /function isEvCancelled\(e\)\{return evStatus\(e\)==='cancelled'/.test(HTML));

/* ── B: editar (form preenchido → update, preserva by/createdAt/src) ── */
ok('B1 openEventForm(editId) com prefill do evento existente',
  /function openEventForm\(editId\)\{[\s\S]{0,120}evEditId=editId\|\|null;[\s\S]{0,120}const ex=evEditId\?\(state\.events\.find\(x=>x\.id===evEditId\)/.test(HTML));
ok('B2 título/botão mudam em modo edição', /\(ex\?'Editar compromisso':'Novo compromisso'\)/.test(HTML) && /\(ex\?'Salvar alterações':'Salvar compromisso'\)/.test(HTML));
ok('B3 campos preenchidos no modo edição (value=AV(ex.*))',
  /id="evTitle"[^>]*value="'\+AV\(ex&&ex\.title\)/.test(HTML) && /id="evDate"[^>]*value="'\+AV\(ex&&ex\.date\)/.test(HTML) && /evNotes[^>]*>'\+esc\(\(ex&&ex\.notes\)\|\|''\)/.test(HTML));
ok('B4 saveEvent — EDIÇÃO faz update com updatedAt/updatedBy',
  /if\(editing\)\{[\s\S]{0,160}collection\('events'\)\.doc\(evEditId\)\.update\(Object\.assign\(\{\},content,\{updatedAt:Date\.now\(\),updatedBy:state\.user\.id\}\)\)/.test(HTML));
ok('B5 content do update NÃO inclui by/createdAt/src/done (preserva-os no doc)',
  (function(){ const m = HTML.match(/const content=\{[\s\S]{0,400}?notes:[^}]*\}/); if(!m) return false; const c=m[0]; return !/\bby:/.test(c) && !/createdAt:/.test(c) && !/src:/.test(c) && !/\bdone:/.test(c); })());
ok('B6 CRIAÇÃO preservada — add com by/done/createdAt/src:webpreview',
  /collection\('events'\)\.add\(Object\.assign\(\{\},content,\{by:state\.user\.id,done:false,createdAt:Date\.now\(\),src:'webpreview'\}\)\)/.test(HTML));

/* ── C: iniciar / finalizar / cancelar (lógico) ── */
ok('C1 evStart grava startedAt/startedBy', /function evStart\(id\)\{evLifecycle\(id,\{startedAt:Date\.now\(\),startedBy:state\.user\.id\}\)/.test(HTML));
ok('C2 evFinish grava done/doneAt/doneBy', /function evFinish\(id\)\{evLifecycle\(id,\{done:true,doneAt:Date\.now\(\),doneBy:state\.user\.id\}\)/.test(HTML));
ok('C3 evCancel grava status:cancelled + cancelledAt/By (LÓGICO)', /function evCancel\(id\)\{evLifecycle\(id,\{status:'cancelled',cancelledAt:Date\.now\(\),cancelledBy:state\.user\.id\}\)/.test(HTML));
ok('C4 evLifecycle usa UPDATE (nunca delete)', /async function evLifecycle\(id,patch\)\{[\s\S]{0,160}collection\('events'\)\.doc\(id\)\.update\(patch\)/.test(HTML));
ok('C5 NÃO há delete físico de events em lugar nenhum', !/collection\('events'\)[\s\S]{0,60}\.delete\(/.test(HTML));
ok('C6 anti-duplo-envio no lifecycle (_evBusy)', /if\(_evBusy\)return;_evBusy=true;/.test(HTML));

/* ── D: detalhe — status visual + ações condicionais + confirm de cancelamento ── */
ok('D1 openEventDetail(id,confirmCancel) com status pill',
  /function openEventDetail\(id,confirmCancel\)\{[\s\S]{0,340}const st=evStatus\(e\);const sm=evStatusMeta\(st\)/.test(HTML) &&
  /\+sm\.label\+'<\/span>/.test(HTML));
ok('D2 Editar aparece exceto cancelado', /if\(st!=='cancelled'\)b\.push\('<button[^']*data-evedit="'\+e\.id/.test(HTML));
ok('D3 Iniciar só em scheduled', /if\(st==='scheduled'\)b\.push\('<button[^']*data-evstart="'\+e\.id/.test(HTML));
ok('D4 Finalizar em scheduled|in_progress (não completado/cancelado)', /if\(st==='scheduled'\|\|st==='in_progress'\)b\.push\('<button[^']*data-evfinish="'\+e\.id/.test(HTML));
ok('D5 Cancelar em scheduled|in_progress', /if\(st==='scheduled'\|\|st==='in_progress'\)b\.push\('<button[^']*data-evcancel="'\+e\.id/.test(HTML));
ok('D6 confirm de cancelamento (data-evcancelyes) — passo explícito',
  /if\(confirmCancel\)\{[\s\S]{0,420}data-evcancelyes="'\+e\.id/.test(HTML));
ok('D7 detalhe mostra Iniciado/Finalizado/Cancelado com ator', /row\('Iniciado',evWhen\(e\.startedAt\)/.test(HTML) && /row\('Finalizado',evWhen\(e\.doneAt\)/.test(HTML) && /row\('Cancelado',evWhen\(e\.cancelledAt\)/.test(HTML));

/* ── E: Agenda filtra cancelados + card com status ── */
ok('E1 renderAgenda exclui cancelados', /let evs=state\.events\.filter\(e=>!isEvCancelled\(e\)\)/.test(HTML));
ok('E2 Hoje/Próximos excluem cancelados', /e\.date===td&&!e\.done&&!isEvCancelled\(e\)/.test(HTML) && /e\.date>td&&!e\.done&&!isEvCancelled\(e\)/.test(HTML));
ok('E3 eventCard mostra pill de status (in_progress/completed)', /var st=evStatus\(e\);if\(st==='in_progress'\|\|st==='completed'\)\{var sm=evStatusMeta\(st\)/.test(HTML));

/* ── F: handlers ── */
ok('F1 handler data-evedit → openEventForm(id)', /if\(el=g\('\[data-evedit\]'\)\)\{openEventForm\(el\.dataset\.evedit\);return;\}/.test(HTML));
ok('F2 handler data-evstart → evStart', /if\(el=g\('\[data-evstart\]'\)\)\{evStart\(el\.dataset\.evstart\);return;\}/.test(HTML));
ok('F3 handler data-evfinish → evFinish', /if\(el=g\('\[data-evfinish\]'\)\)\{evFinish\(el\.dataset\.evfinish\);return;\}/.test(HTML));
ok('F4 handler data-evcancel → confirm; data-evcancelyes → evCancel',
  /if\(el=g\('\[data-evcancel\]'\)\)\{openEventDetail\(el\.dataset\.evcancel,true\);return;\}/.test(HTML) &&
  /if\(el=g\('\[data-evcancelyes\]'\)\)\{evCancel\(el\.dataset\.evcancelyes\);return;\}/.test(HTML));

/* ── G: regressões preservadas ── */
ok('G1 leitura da Agenda em tempo real (onSnapshot events)', /collection\('events'\)\.onSnapshot\(/.test(HTML));
ok('G2 CTA "Novo compromisso" intacto (data-ag="new")', /data-ag="new"[\s\S]{0,260}Novo compromisso<\/button>/.test(HTML));
ok('G3 Board/Kanban canônico intacto', /const STATUS=\[[\s\S]{0,400}key:'afazer'[\s\S]{0,400}key:'concluido'/.test(HTML));
ok('G4 Copywriting descontinuado na criação', /key:'copywriting'[\s\S]{0,120}descontinuado:true/.test(HTML) && /SECTORS\.filter\(s=>!s\.descontinuado\)/.test(HTML));
ok('G5 Chat fora do fluxo principal (TABS sem chat)', /const TABS=\[/.test(HTML) && !/TABS=\[[^\]]*\{k:'chat'/.test(HTML));
ok('G6 FAB global segue criando TAREFA (não sequestrado)', /if\(el=g\('\[data-fab\]'\)\)\{closeModal\(\);if\(state\.tab==='tarefas'\)openTaskForm/.test(HTML));
ok('G7 K6 box-sizing global preservado (só .ev-sheet, 73I4B)', (HTML.match(/\*\{box-sizing:border-box/g) || []).length === 1);

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
