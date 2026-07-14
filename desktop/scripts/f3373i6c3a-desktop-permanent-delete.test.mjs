#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C3A — Testes HERMÉTICOS da EXCLUSÃO DEFINITIVA no Desktop 1.0.162:
     - "Excluir definitivamente" (hard delete) SEPARADO do cancelamento lógico;
     - só ADMIN (state.user.admin), em QUALQUER estado;
     - confirmação FORTE: digitar "EXCLUIR" + aviso de irreversibilidade;
     - grava deletedBy ANTES do delete físico (p/ onEventDeleted atribuir o ator);
     - cancelar continua LÓGICO (status:'cancelled'); "Mostrar cancelados" na Agenda;
     - criar/editar/iniciar/finalizar/status/realtime preservados.
   Lê index.html/package.json como TEXTO — NÃO abre Electron, NÃO rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const PJ = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I6C3A — Desktop exclusão definitiva (1.0.162)');

/* ── A: versão + delete físico separado ── */
ok('A1 versão 1.0.162', PJ.version === '1.0.162');
ok('A2 evDeletePermanent grava deletedBy ANTES do delete físico',
  /async function evDeletePermanent\(id\)\{[\s\S]{0,260}collection\('events'\)\.doc\(id\)\.update\(\{deletedBy:state\.user\.id,deletedAt:Date\.now\(\)\}\);[\s\S]{0,120}collection\('events'\)\.doc\(id\)\.delete\(\)/.test(HTML));
ok('A3 evDelete exige digitar EXCLUIR (confirmação forte)',
  /function evDelete\(id\)\{[\s\S]{0,220}evDelConfirm[\s\S]{0,120}!=='EXCLUIR'[\s\S]{0,160}evDeletePermanent\(id\)/.test(HTML));

/* ── B: cancelamento lógico PRESERVADO e separado ── */
ok('B1 evCancel continua LÓGICO (status:cancelled, sem delete físico)',
  /function evCancel\(id\)\{evLifecycle\(id,\{status:'cancelled',cancelledAt:Date\.now\(\),cancelledBy:state\.user\.id\}\)/.test(HTML));
ok('B2 evLifecycle (cancel/start/finish) NUNCA chama delete',
  /async function evLifecycle\(id,patch\)\{[\s\S]{0,200}\.update\(patch\)/.test(HTML) &&
  !/function evLifecycle[\s\S]{0,260}\.delete\(\)/.test(HTML));
ok('B3 único delete físico de events é o evDeletePermanent (pós-confirmação)',
  (HTML.match(/collection\('events'\)\.doc\(id\)\.delete\(\)/g) || []).length === 1);

/* ── C: detalhe — botão admin + confirmação + estados ── */
ok('C1 "Excluir definitivamente" só admin (isAdmin), em qualquer estado',
  /const st=evStatus\(e\);const sm=evStatusMeta\(st\);const isAdmin=!!\(state\.user&&state\.user\.admin\)/.test(HTML) &&
  /if\(isAdmin\)b\.push\('<button class="btn btn-danger" data-evdelete="'\+e\.id/.test(HTML));
ok('C2 modo confirm==="delete" com aviso de irreversibilidade + input EXCLUIR',
  /else if\(confirm==='delete'\)\{[\s\S]{0,320}não poderá ser desfeita[\s\S]{0,320}id="evDelConfirm"[\s\S]{0,360}data-evdeleteyes="'\+e\.id/.test(HTML));
ok('C3 texto obrigatório de irreversibilidade presente', /Esta ação é permanente e não poderá ser desfeita\./.test(HTML));
ok('C4 cancelar continua com confirm==="cancel" (não apaga)',
  /if\(confirm==='cancel'\)\{[\s\S]{0,260}não é apagado[\s\S]{0,200}data-evcancelyes="'\+e\.id/.test(HTML));

/* ── D: acesso a cancelados (Mostrar cancelados) ── */
ok('D1 toggle agShowCancelled + botão "Mostrar cancelados"',
  /agShowCancelled=false/.test(HTML) && /data-ag="togglecancel"/.test(HTML) && /Mostrar cancelados/.test(HTML) && /Ocultar cancelados/.test(HTML));
ok('D2 Agenda mostra cancelados quando o toggle está ligado',
  /let evs=agShowCancelled\?state\.events\.slice\(\):state\.events\.filter\(e=>!isEvCancelled\(e\)\)/.test(HTML));
ok('D3 handler data-ag togglecancel alterna e re-renderiza',
  /if\(a==='togglecancel'\)\{agShowCancelled=!agShowCancelled;render\(\);return;\}/.test(HTML));

/* ── E: handlers ── */
ok('E1 data-evdelete → confirmação; data-evdeleteyes → evDelete',
  /if\(el=g\('\[data-evdelete\]'\)\)\{openEventDetail\(el\.dataset\.evdelete,'delete'\);return;\}/.test(HTML) &&
  /if\(el=g\('\[data-evdeleteyes\]'\)\)\{evDelete\(el\.dataset\.evdeleteyes\);return;\}/.test(HTML));
ok('E2 data-evcancel passa "cancel" (assinatura atualizada)',
  /if\(el=g\('\[data-evcancel\]'\)\)\{openEventDetail\(el\.dataset\.evcancel,'cancel'\);return;\}/.test(HTML));

/* ── F: regressões (criar/editar/iniciar/finalizar/realtime) ── */
ok('F1 criar preservado (add src webpreview)', /collection\('events'\)\.add\(Object\.assign\(\{\},content,\{by:state\.user\.id,done:false,createdAt:Date\.now\(\),src:'webpreview'\}\)\)/.test(HTML));
ok('F2 editar preservado (update editPatch-like com updatedAt/updatedBy)', /collection\('events'\)\.doc\(evEditId\)\.update\(Object\.assign\(\{\},content,\{updatedAt:Date\.now\(\),updatedBy:state\.user\.id\}\)\)/.test(HTML));
ok('F3 iniciar/finalizar preservados', /function evStart\(id\)\{evLifecycle\(id,\{startedAt/.test(HTML) && /function evFinish\(id\)\{evLifecycle\(id,\{done:true/.test(HTML));
ok('F4 status derivado preservado (scheduled/in_progress/completed/cancelled)', /function evStatus\(e\)\{[\s\S]{0,240}'in_progress';return 'scheduled'/.test(HTML));
ok('F5 Agenda realtime (onSnapshot) preservada', /collection\('events'\)\.onSnapshot\(/.test(HTML));
ok('F6 Board/Chat/Copywriting preservados', /const STATUS=\[[\s\S]{0,400}key:'afazer'/.test(HTML) && !/TABS=\[[^\]]*\{k:'chat'/.test(HTML) && /SECTORS\.filter\(s=>!s\.descontinuado\)/.test(HTML));
ok('F7 box-sizing global preservado (só .ev-sheet)', (HTML.match(/\*\{box-sizing:border-box/g) || []).length === 1);

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
