#!/usr/bin/env node
/* =====================================================================
   F3.3.73I3 — Testes HERMÉTICOS (texto/fonte) da criação de compromisso na
   AGENDA COMPARTILHADA EM TEMPO REAL do Desktop 1.0.160:
     - CTA "Novo compromisso" no render da Agenda + handler data-ag="new";
     - modal/form com título/cliente/tipo/data/início/término/local/resp/obs;
     - validação (não salva sem título + data);
     - grava em `events` com o contrato compatível com Android (14 campos),
       src HONESTO 'webpreview' (NUNCA falsear 'nativebeta' p/ forçar push);
     - leitura da Agenda permanece onSnapshot (tempo real preservado);
     - detalhe do compromisso abre (eventCard clicável → openEventDetail);
     - notificação server-side NÃO é gambiarra client-side (sem push direto);
     - regressões preservadas: Chat fora, Copywriting descontinuado, Board
       canônico, versão 1.0.160.
   Lê o index.html como TEXTO — NÃO abre Electron, NÃO chama rede, NÃO escreve.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');
const PJ = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };

console.log('F3.3.73I3 — Agenda compartilhada: criar compromisso (Desktop 1.0.160)');

/* ── A: CTA "Novo compromisso" na Agenda (layout corrigido na 73I4A) ── */
ok('A1 botão "Novo compromisso" no render da Agenda (data-ag="new")',
  /data-ag="new"[\s\S]{0,260}svg\('plus','ag-newic'\)\+'Novo compromisso<\/button>/.test(HTML));
ok('A1a 73I4A: ícone do CTA dimensionado por regra CSS escopada (.ag-newic 16px) — sem elemento gigante',
  /\.ag-newic\{width:16px;height:16px;flex:none\}/.test(HTML) && /svg\('plus','ag-newic'\)/.test(HTML));
ok('A1b 73I4A: CTA compacto (inline-flex, height 40px), SEM width:100% (não bloqueia calendário)',
  /data-ag="new" style="display:inline-flex;[^"]*height:40px[^"]*"/.test(HTML) &&
  !/data-ag="new"[^>]*width:100%/.test(HTML));
ok('A2 handler data-ag trata "new" abrindo openEventForm',
  /if\(a==='new'\)\{openEventForm\(\);return;\}/.test(HTML));
ok('A3 CTA aparece antes da busca da Agenda (topo, descobrível)',
  HTML.indexOf('data-ag="new"') < HTML.indexOf('id="agSearch"'));

/* ── B: modal/form de compromisso ── */
ok('B1 openEventForm existe e injeta modal no modalRoot (73I6C2: assinatura editId)',
  /function openEventForm\(editId\)\{/.test(HTML) && /modalRoot'\)\.innerHTML='<div class="modal-back"[\s\S]{0,600}Novo compromisso/.test(HTML));
ok('B1a 73I4B: modal de criação usa classe escopada .ev-sheet (não afeta outros modais)',
  /<div class="modal-back" data-modalbg="1"><div class="sheet ev-sheet"><div class="grab"><\/div>'\+[\s\S]{0,120}Novo compromisso/.test(HTML));
ok('B1b 73I4B: CSS do modal corrige box-sizing (reset global morto) nos controles + sem overflow-x',
  /\.sheet\.ev-sheet\{box-sizing:border-box;[^}]*overflow-x:hidden;overflow-y:auto\}/.test(HTML) &&
  /\.sheet\.ev-sheet \.inp\{width:100%;box-sizing:border-box\}/.test(HTML) &&
  /\.sheet\.ev-sheet \.row>div\{min-width:0\}/.test(HTML));
ok('B1c 73I4B: largura confortável e controlada (min(720px, viewport-48))',
  /body\.desktop \.sheet\.ev-sheet\{width:min\(720px,calc\(100vw - 48px\)\);max-width:min\(720px,calc\(100vw - 48px\)\)\}/.test(HTML));
ok('B1d 73I4B: correção escopada — NÃO alterou o box-sizing global (só .ev-sheet)',
  (HTML.match(/\*\{box-sizing:border-box/g) || []).length === 1 &&
  /function openEventDetail\(id,confirmCancel\)\{[\s\S]{0,1800}<div class="modal-back" data-modalbg="1"><div class="sheet"><div class="grab">/.test(HTML));
ok('B2 form tem os campos mínimos (título/cliente/tipo/data/início/término/local/resp/obs)',
  ['evTitle','evClient','evType','evDate','evStart','evEnd','evLoc','evOwner','evNotes'].every(id => HTML.includes('id="' + id + '"')));
ok('B3 responsável populado só com usuários ativos (sem removido/excluído/pendente)',
  /openEventForm[\s\S]{0,200}filter\(u=>!\['removido','excluido','pendente'\]\.includes\(u\.status\|\|''\)\)/.test(HTML));
ok('B4 tipo usa TYPES canônicos (mesmos 5 tipos de compromisso)',
  /openEventForm[\s\S]{0,400}TYPES\.map\(t=>'<option value="'\+t\.key/.test(HTML));

/* ── C: validação (não salva inválido) ── */
ok('C1 saveEvent valida título obrigatório',
  /function saveEvent\(\)[\s\S]{0,600}if\(!title\)\{fail\('Informe o título/.test(HTML));
ok('C2 saveEvent valida data (YYYY-MM-DD) obrigatória',
  /if\(!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(date\)\)\{fail\('Escolha a data/.test(HTML));
ok('C3 trava anti-duplo-envio (dataset.busy)',
  /saveEvent[\s\S]{0,900}if\(btn\.dataset\.busy\)return;btn\.dataset\.busy='1'/.test(HTML));

/* ── D: grava em events com o contrato compatível + src honesto ── */
ok('D1 grava via db.collection(\'events\').add (mesma coleção compartilhada)',
  /await db\.collection\('events'\)\.add\(/.test(HTML));
ok('D2 contrato de 14 campos (73I6C2: 10 em content + by/done/createdAt/src no add)',
  ['type:','client:','title:title','location:','date:date','start:','end:','owner:owner','ownerId:ownerId','notes:']
    .every(f => new RegExp('const content=\\{[\\s\\S]{0,400}' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(HTML)) &&
  ['by:state.user.id','done:false','createdAt:Date.now()',"src:'webpreview'"]
    .every(f => new RegExp('\\.add\\(Object\\.assign\\(\\{\\},content,\\{[\\s\\S]{0,140}' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(HTML)));
ok('D3 src é HONESTO "webpreview" — NUNCA falseia "nativebeta" p/ forçar push',
  /src:'webpreview'/.test(HTML) && !/events'\)\.add\([\s\S]{0,300}nativebeta/.test(HTML));
ok('D4 nenhuma gambiarra client-side de push no fluxo de evento (só write; trigger cobre)',
  !/saveEvent[\s\S]{0,900}(notify-assignee|notifyAssignee|sendPush|workers\.dev)/i.test(HTML));

/* ── E: tempo real preservado + detalhe abre ── */
ok('E1 leitura da Agenda permanece em tempo real (onSnapshot em events)',
  /collection\('events'\)\.onSnapshot\(/.test(HTML));
ok('E2 eventCard virou clicável para o detalhe (data-evdetail + cursor)',
  /<div class="evc" data-evdetail="'\+e\.id\+'" style="cursor:pointer">/.test(HTML));
ok('E3 handler data-evdetail abre openEventDetail',
  /if\(el=g\('\[data-evdetail\]'\)\)\{openEventDetail\(el\.dataset\.evdetail\);return;\}/.test(HTML));
ok('E4 openEventDetail existe e mostra campos do compromisso (73I6C2: +confirmCancel)',
  /function openEventDetail\(id,confirmCancel\)\{/.test(HTML) &&
  /row\('Cliente',e\.client\)\+row\('Data',e\.date\)/.test(HTML) &&
  /row\('Responsável',owner&&owner\.name\)/.test(HTML));
ok('E5 handler data-evsave chama saveEvent',
  /if\(el=g\('\[data-evsave\]'\)\)\{saveEvent\(\);return;\}/.test(HTML));

/* ── F: regressões preservadas ── */
ok('F1 versão 1.0.160+ no package.json (bump 1.0.161 na 73I6C2)', ['1.0.160', '1.0.161'].includes(PJ.version));
ok('F2 STATUS/Kanban canônico intacto (afazer/andamento/revisao/concluido)',
  /const STATUS=\[[\s\S]{0,400}key:'afazer'[\s\S]{0,400}key:'andamento'[\s\S]{0,400}key:'revisao'[\s\S]{0,400}key:'concluido'/.test(HTML));
ok('F3 Copywriting segue descontinuado na criação (71C7)',
  /key:'copywriting'[\s\S]{0,120}descontinuado:true/.test(HTML) && /SECTORS\.filter\(s=>!s\.descontinuado\)/.test(HTML));
ok('F4 Chat segue fora do fluxo principal (aba de chat não reintroduzida no TABS)',
  /const TABS=\[/.test(HTML) && !/TABS=\[[^\]]*\{k:'chat'/.test(HTML));
ok('F5 FAB global segue criando TAREFA (não sequestrado pelo evento)',
  /if\(el=g\('\[data-fab\]'\)\)\{closeModal\(\);if\(state\.tab==='tarefas'\)openTaskForm/.test(HTML));

console.log('\nRESULTADO: ' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — HÁ FALHAS' : ' — SUITE OK'));
process.exit(fail ? 1 : 0);
