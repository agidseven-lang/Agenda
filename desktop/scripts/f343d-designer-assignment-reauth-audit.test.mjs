#!/usr/bin/env node
/* =====================================================================================
 * F3.4.3D/E — ATRIBUIÇÃO AO DESIGNER × REAUTENTICAÇÃO — CONTRATO PÓS-CORREÇÃO (GREEN).
 * -------------------------------------------------------------------------------------
 * F3.4.3D (auditoria, read-only) isolou o vazamento de estado residual `_sendAfterSave`.
 * F3.4.3E (correção mínima) aplicou: (1) consumo SEGURO da flag (captura+limpa em saveTask;
 * inicializa false em newForm; limpa na troca de setor) e (2) TRAVA POR SETOR na abertura do
 * modal de envio ao cliente. Este teste é o GREEN: prova o contrato corrigido sobre a FONTE real
 * de desktop/src/renderer/index.html (nada de mock que possa divergir do que é enviado ao usuário).
 *
 * Mapa dos 18 itens do owner:
 *   1  newForm inicia _sendAfterSave=false ................................. C3.1
 *   2  clique explícito de envio ao cliente define true ................... C3.2
 *   3  erro de validação limpa a flag (limpeza ANTES do 1º return) ........ C3.3
 *   4  troca de setor limpa a flag ....................................... C3.4
 *   5  reset do formulário limpa (newForm/null) .......................... C4.1
 *   6  cancelamento/fechamento limpa (state.form=null) ................... C4.2
 *   7  tarefa de cliente c/ ação explícita abre o modal correto .......... C3.6 + C5
 *   8  tarefa interna nunca abre modal de cliente ........................ C3.6
 *   9  edicao_midia com flag residual não abre modal ..................... C3.6 (mesmo gate isClientSector)
 *   10 atribuir Designer não chama ensureTeamSession ..................... C1
 *   11 atribuir Designer salva e notifica uma vez ........................ C1
 *   12 fluxo legítimo de avisar cliente continua funcionando ............. C5
 *   13 modal de reautenticação só na ação protegida ..................... C5
 *   14 notificações de fundo verdes ..... (suíte f343-delivery-channel / preservation)
 *   15 amarelo/vermelho verdes .......... (suíte f343-main-scheduler / golden-master)
 *   16 operational_block verde .......... (suíte f343-operational-block)
 *   17 Golden Master 219/0 ............. (suíte f343-sla-golden-master / preservation #29)
 *   18 J6 e Android byte-idênticos ..... (suíte f343-preservation #28/#30)
 * ===================================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push('FAIL: ' + n); } };

/* Extrai o corpo de uma função por casamento de chaves a partir da 1ª '{' após a assinatura. */
function bodyOf(sig) {
  const i = HTML.indexOf(sig);
  if (i < 0) return '';
  let j = HTML.indexOf('{', i + sig.length - 1);
  if (j < 0) return '';
  let depth = 0;
  for (let k = j; k < HTML.length; k++) {
    const ch = HTML[k];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return HTML.slice(j, k + 1); }
  }
  return HTML.slice(j);
}
const countOf = (re) => (HTML.match(re) || []).length;

/* ══════════════ CENÁRIO 1 — ATRIBUIÇÃO LIMPA (Fluxo B: sendToDesigner) — itens 10,11 ══════════════ */
const sendToDesigner = bodyOf('async function sendToDesigner(taskId,designerId,dl)');
ok('1 sendToDesigner encontrado', sendToDesigner.length > 200);
const iUpdate = sendToDesigner.indexOf(".update(patch)");
const iNotify = sendToDesigner.indexOf("notifyDesignerNow(taskId");
ok('1 persiste o patch (.update(patch))', iUpdate > -1);
ok('1 notifyDesignerNow APÓS a persistência (salva → notifica, uma vez)', iNotify > -1 && iNotify > iUpdate);
ok('1 notifyDesignerNow chamado exatamente 1x no fluxo', (sendToDesigner.match(/notifyDesignerNow\(/g) || []).length === 1);
for (const forbidden of ['_sendAfterSave', 'ensureTeamSession', 'persistClientSend', 'openSendClientModal(', 'saveTask(']) {
  ok('1 sendToDesigner NÃO chama ' + forbidden, sendToDesigner.indexOf(forbidden) === -1);
}
const notifyDesignerNow = bodyOf('async function notifyDesignerNow(taskId,designerName)');
ok('1 notifyDesignerNow só usa /notify-designer', /\/notify-designer/.test(notifyDesignerNow));
ok('1 notifyDesignerNow NÃO chama ensureTeamSession/persistClientSend',
   notifyDesignerNow.indexOf('ensureTeamSession') === -1 && notifyDesignerNow.indexOf('persistClientSend') === -1);

/* ══════════════ CENÁRIO 2 — SEM <form>/submit; LISTENER ÚNICO; ORDEM DO DISPATCH ══════════════ */
ok('2 NÃO existe <form> no renderer (submit implícito impossível)', !/<form[\s>]/i.test(HTML));
ok('2 NÃO existe onsubmit', !/onsubmit/i.test(HTML));
ok('2 NÃO existe chamada .submit()', !/\.submit\(\)/.test(HTML));
ok('2 dispatch delegado é ÚNICO (document.addEventListener("click",async …) == 1)',
   countOf(/document\.addEventListener\('click',async e=>\{/g) === 1);
ok('2 botão de envio-designer usa data-designersend', /data-designersend="'\+taskId\+'\|'\+designerId\+'"/.test(HTML));
const iDesignerSend = HTML.indexOf("g('[data-designersend]')");
const iSendClient   = HTML.indexOf("g('[data-sendclient]')");
const iOpenWa       = HTML.indexOf("g('[data-openwa]')");
ok('2 ramos distintos c/ return (data-sendclient ≠ data-designersend ≠ data-openwa)',
   iSendClient > -1 && iDesignerSend > -1 && iOpenWa > -1 && iSendClient < iDesignerSend && iOpenWa !== iDesignerSend);
const iNextBranch = HTML.indexOf("if(el=g('[data-itemfix]')", iDesignerSend);
const designerSendBranch = HTML.slice(iDesignerSend, iNextBranch > -1 ? iNextBranch : iDesignerSend + 700);
ok('2 ramo data-designersend chama sendToDesigner(...)', /sendToDesigner\(p\[0\],p\[1\]/.test(designerSendBranch));
for (const forbidden of ['saveTask', '_sendAfterSave', 'openSendClientModal', 'ensureTeamSession', 'persistClientSend']) {
  ok('2 ramo data-designersend NÃO chama ' + forbidden, designerSendBranch.indexOf(forbidden) === -1);
}

/* ══════════════ CENÁRIO 3 — CONTRATO CORRIGIDO de _sendAfterSave (itens 1,2,3,4,7,8,9) ══════════════ */
const newForm = bodyOf('function newForm(sector)');
// 3.1 (item 1) — newForm inicializa a flag explicitamente em false.
ok('3.1 newForm inicializa _sendAfterSave:false', /_sendAfterSave:false/.test(newForm));
// 3.2 (item 2) — a flag é definida true em EXATAMENTE um ponto: o clique explícito data-sendclient.
ok('3.2 _sendAfterSave=true em 1 único ponto (clique explícito envio-cliente)',
   countOf(/_sendAfterSave=true/g) === 1);
ok('3.2 o setter vive no handler data-sendclient do wizard',
   /\[data-sendclient\]'\)\)\{[\s\S]{0,220}state\.form\._sendAfterSave=true;[\s\S]{0,80}await saveTask\(\);/.test(HTML));   /* F3.5.4I: handler agora mostra "Salvando…" (state.form._sending=true;render();) entre o setter e o await */
// 3.3 (item 3) — saveTask CAPTURA e LIMPA a flag imediatamente, ANTES de qualquer return de validação.
const saveTask = bodyOf('async function saveTask()');
ok('3.3 saveTask consome com ===true e limpa imediatamente',
   /const sendAfter=f\._sendAfterSave===true; f\._sendAfterSave=false;/.test(saveTask));
const iClear = saveTask.indexOf('f._sendAfterSave=false;');
const iFirstValidationReturn = saveTask.indexOf("if(!f.sector){f._saving=false;");
ok('3.3 a limpeza ocorre ANTES do 1º return de validação (erro de validação não vaza)',
   iClear > -1 && iFirstValidationReturn > -1 && iClear < iFirstValidationReturn);
ok('3.3 f._sendAfterSave só aparece 2x no saveTask (leitura+limpeza na MESMA linha; sem leituras remanescentes)',
   (saveTask.match(/f\._sendAfterSave/g) || []).length === 2);
ok('3.3 as leituras de status do cliente usam a cópia local `sendAfter?` (sem ternário f._sendAfterSave?)',
   saveTask.indexOf('f._sendAfterSave?') === -1 && /data\.cronStatus=sendAfter\?/.test(saveTask));
ok('3.3 a antiga declaração `const sendAfter=!!f._sendAfterSave` foi removida',
   saveTask.indexOf('!!f._sendAfterSave') === -1);
// 3.4 (item 4) — troca de setor limpa a flag.
const iFsector = HTML.indexOf("g('[data-fsector]')");
const fsectorBranch = HTML.slice(iFsector, iFsector + 240);
ok('3.4 data-fsector limpa _sendAfterSave', /state\.form\._sendAfterSave=false/.test(fsectorBranch));
// 3.6 (itens 7,8,9) — abertura do modal de cliente TRAVADA por setor-cliente comprovado.
const iGate = saveTask.indexOf('if(sendAfter&&isClientSector(secOf(sector).key)&&ref&&ref.id)');
ok('3.6 modal de cliente aberto só sob sendAfter && isClientSector(secOf(sector).key) && ref && ref.id',
   iGate > -1);
const iElse = saveTask.indexOf('}else{', iGate);
const gateWindow = saveTask.slice(iGate, iElse > -1 ? iElse : iGate + 420);
ok('3.6 o corpo travado é o que chama openSendClientModal(...)', /openSendClientModal\(/.test(gateWindow));
ok('3.6 NÃO há abertura de openSendClientModal fora do gate travado por setor no saveTask',
   (saveTask.match(/openSendClientModal\(/g) || []).length === 1);

/* ══════════════ CENÁRIO 4 — ESCOPO: reset/cancel/fechamento; setter só em setor-cliente (itens 5,6) ══════════════ */
const formAssigns = (HTML.match(/state\.form=(?!\.)[^;]+/g) || []).map(s => s.replace('state.form=', '').trim());
const badAssigns = formAssigns.filter(v => !/^newForm\(/.test(v) && v !== 'null');
ok('4.1 state.form só recebe newForm(...) ou null (reset/nova tarefa limpam via factory)', badAssigns.length === 0);
ok('4.1 NÃO há data-edit/openEdit/editTask que re-popule state.form c/ flag residual',
   !/data-edit|function openEdit|function editTask/.test(HTML));
// 4.2 (item 6) — cancelamento/fechamento do wizard e mudança de aba/tarefa zeram via state.form=null.
ok('4.2 data-form="close" e data-tab fazem state.form=null (cancel/fechamento/mudança de tarefa)',
   /a==='close'\)\{state\.form=null/.test(HTML) && /\[data-tab\]'\)\)\{state\.form=null/.test(HTML));
// setter gated por canSendToClient → só setor-cliente.
ok('4.2 botão "Enviar para o cliente" (data-sendclient="1") gated por canSendToClient(f)',
   /if\(canSendToClient\(f\)\)\{[\s\S]{0,320}data-sendclient="1"/.test(HTML));   /* F3.5.4I: o botão ganhou o ramo "Salvando cronograma…" (f._sending) antes do data-sendclient */
const canSend = bodyOf('function canSendToClient(f)');
ok('4.2 canSendToClient exige isClientSector (mesmo predicado da trava do saveTask)',
   /isClientSector\(secOf\(f\.sector\)\.key\)/.test(canSend));

/* ══════════════ CENÁRIO 5 — INTEGRIDADE DA AÇÃO PROTEGIDA (itens 12,13) ══════════════ */
// ensureTeamSession segue existindo e é alcançável SÓ por data-teamfix e persistClientSend.
ok('5 ensureTeamSession continua definido (modal de reautenticação preservado)',
   /function ensureTeamSession\(\)/.test(HTML));
ok('5 ensureTeamSession referenciado exatamente em 2 chamadas (data-teamfix + persistClientSend)',
   countOf(/ensureTeamSession\(\)/g) === 2 + 1);   // 2 chamadas + 1 definição `function ensureTeamSession()`
// persistClientSend só é chamado pelos 3 cliques conscientes de envio ao cliente (fluxo legítimo intacto).
ok('5 persistClientSend chamado só nos cliques conscientes (btnOpenWaMain/btnCopyGroupMsg/data-openwa)',
   countOf(/persistClientSend\(/g) === 3 + 1);      // 3 chamadas + 1 definição `async function persistClientSend(`
ok('5 persistClientSend ainda abre ensureTeamSession quando há token (aviso em tempo real preservado)',
   /if\(token&&!\(await ensureTeamSession\(\)\)\)/.test(HTML));

console.log('\n===== F3.4.3D/E — DESIGNER-ASSIGNMENT × REAUTH — CONTRATO PÓS-CORREÇÃO (GREEN) =====');
if (flog.length) console.log('\n' + flog.join('\n') + '\n');
console.log('F3.4.3D/E: ' + pass + ' OK, ' + fail + ' FAIL');
if (fail) { console.error('::error:: contrato de correção violado'); process.exit(1); }
console.log('OK — flag inicializada/consumida/limpa; modal de cliente travado por setor; atribuição limpa; ação protegida íntegra; fluxo legítimo preservado.');
