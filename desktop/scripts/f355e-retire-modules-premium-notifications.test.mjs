/* F3.5.5E — Suíte da fase: RETIRADA DEFINITIVA de Copywriting/Roteiro/Programação de Posts
   (30 testes do mandato) + NOTIFICAÇÕES IMEDIATAS PREMIUM (40 testes do mandato) + segurança +
   congelados. Roda contra o FONTE ou contra os bytes do app.asar (env SRC=/BG_SRC=/NE_SRC=/
   ET_SRC=/MAIN_SRC=/TIS_SRC=). Zero rede; zero Firestore. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p, env) => readFileSync(process.env[env] || path.join(__dirname, p), 'utf8');
const S  = R('../src/renderer/index.html', 'SRC');            // renderer
const BG = R('../src/renderer/bgnotify.html', 'BG_SRC');      // janela premium
const MAIN = R('../src/main/main.ts', 'MAIN_SRC');
const TIS  = R('../src/main/taskIdleScheduler.ts', 'TIS_SRC');
const PKG  = R('../package.json', 'PKG_SRC');
const LOCK = R('../package-lock.json', 'LOCK_SRC');

const require_ = createRequire(import.meta.url);
/* env paths podem vir RELATIVOS (modo asar do CI: NE_SRC=asar-x/dist/...); require() trata
   caminho sem ./ como pacote — resolver para absoluto (mesma semântica do readFileSync acima). */
const NE = require_(process.env.NE_SRC ? path.resolve(process.env.NE_SRC) : path.join(__dirname, '../src/main/notifEvents.js'));
const ET = require_(process.env.ET_SRC ? path.resolve(process.env.ET_SRC) : path.join(__dirname, '../src/main/executionTracking.js'));

let pass = 0, fail = 0; const bad = [];
function ok(name, cond) { if (cond) { pass++; } else { fail++; bad.push(name); console.error('FAIL: ' + name); } }
function has(hay, needle, name) { ok(name, hay.indexOf(needle) >= 0); }
function seg(a, b, name) { const i = S.indexOf(a); const j = S.indexOf(b, i + 1); ok(name + ' (segmento existe)', i >= 0 && j > i); return (i >= 0 && j > i) ? S.slice(i, j) : ''; }

/* extrai uma function declaration por brace-matching a partir de 'function NAME(' */
function extract(src, name) {
  const sig = 'function ' + name + '('; const i = src.indexOf(sig);
  if (i < 0) return null;
  let d = 0, started = false, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') { d++; started = true; } else if (c === '}') { d--; if (started && d === 0) { j++; break; } } }
  return src.slice(i, j);
}

/* ============ A. VERSÃO ============ */
ok('A1 package version 1.0.242 (RE-PINADO F3.5.6A-H2)', /"version":\s*"1\.0\.242"/.test(PKG));
ok('A2 lock version 1.0.242 (2x) (RE-PINADO F3.5.6A-H2)', (LOCK.match(/"version":\s*"1\.0\.242"/g) || []).length >= 2);
ok('A3 description marker f355eh1 + cadeia (RE-PINADO F3.5.5E-H1)', PKG.indexOf('1.0.225-f355eh1-ultra-premium-notifications') >= 0 && PKG.indexOf('base 1.0.224-f355e-retire-legacy-modules-premium-notifications') >= 0 && PKG.indexOf('base 1.0.223-f355d-custom-cronograma-quantity-universal-paste') >= 0);

/* ============ B. RETIRADA DOS MÓDULOS (mandato 1–30) ============ */
/* núcleo extraído e executado de verdade */
const CORE = [
  'const SECTOR_ALIAS={design:\'edicao_midia\',copy:\'copywriting\',postagem:\'programacao_posts\'};',
  extract(S, 'isRetiredSectorKey'), extract(S, 'isRetiredTask'),
  'var __retiredIndex={};', 'var window={};', 'var console_={info:function(){}};',
  extract(S, 'retiredCutoffFilter') ? extract(S, 'retiredCutoffFilter').replace('console.info', 'console_.info') : 'null',
  'const RETIRED_SECTOR_KEYS={copywriting:1,roteiro:1,programacao_posts:1};',
].join('\n');
const ctx = { Date, Array, String, Number, Object, JSON, Math };
vm.createContext(ctx);
let coreOk = true;
try { vm.runInContext(CORE, ctx); } catch (e) { coreOk = false; console.error('CORE eval: ' + e.message); }
ok('B0 núcleo da retirada extraído e avaliado', coreOk);
const call = (expr) => vm.runInContext(expr, ctx);

/* B1-B3 Quadros sem os três (flag canônico + filtro no hub) */
const sectorsSeg = seg('const SECTORS=[', 'const SECTOR_ALIAS=', 'B SECTORS');
has(sectorsSeg, "key:'copywriting'", 'B1a copywriting definido (histórico preservado)');
ok('B1b copywriting descontinuado', /key:'copywriting'[^\n]*descontinuado:true/.test(sectorsSeg));
ok('B2 roteiro descontinuado', /key:'roteiro'[^\n]*descontinuado:true/.test(sectorsSeg));
ok('B3 programacao_posts descontinuado', /key:'programacao_posts'[^\n]*descontinuado:true/.test(sectorsSeg));
has(S, 'const cards=SECTORS.filter(s=>!s.descontinuado).map(s=>{const list=vis.filter', 'B1-3 hub Quadros filtra descontinuados');

/* B4-B6 Nova tarefa sem os três (filtro 71C7 herdado + flags acima) */
has(S, 'SECTORS.filter(s=>!s.descontinuado).forEach(s=>{', 'B4-6 stepSector oferece SÓ ativos');
has(S, "if(sector&&secOf(sector).descontinuado)sector=null", 'B4-6b openTaskForm bloqueia setor descontinuado');

/* B7-B9 filtros/busca/contadores derivam do state filtrado (comportamental REAL) */
const mixed = JSON.stringify([
  { id: 't1', sector: 'cronograma', title: 'A' }, { id: 't2', sector: 'roteiro', title: 'B' },
  { id: 't3', sector: 'copywriting', title: 'C' }, { id: 't4', sector: 'copy', title: 'D' },
  { id: 't5', sector: 'postagem', title: 'E' }, { id: 't6', sector: 'programacao_posts', title: 'F' },
  { id: 't7', sector: 'edicao_midia', title: 'G' }, { id: 't8', sector: 'edicao_cards', title: 'H' },
  { id: 't9', sector: 'design', title: 'I (alias vivo)' },
]);
const kept = call(`retiredCutoffFilter(${mixed}).map(t=>t.id).join(',')`);
ok('B7 ingestão remove os 3 módulos (+aliases copy/postagem)', kept === 't1,t7,t8,t9');
ok('B8 contagem sanitizada por módulo', call('window.__retiredCutoff.dropped') === 5 && call('window.__retiredCutoff.porModulo.roteiro') === 1 && call('window.__retiredCutoff.porModulo.copywriting') === 2 && call('window.__retiredCutoff.porModulo.programacao_posts') === 2);
ok('B9 índice id→setor sem conteúdo', call("__retiredIndex['t2'].s") === 'roteiro' && call("Object.keys(__retiredIndex['t2']).length") === 1);

/* B10-B13 Prioridades/Hoje/Relatórios/Executivo derivam de state.tasks (fonte única filtrada) */
has(S, 'priBuildItems(state.tasks, me)', 'B10 Minhas Prioridades usa state.tasks (filtrado na ingestão)');
has(S, 'state.tasks=retiredCutoffFilter(pwaCutoffFilter(', 'B11-13 ingestão única filtra Hoje/Relatórios/Executivo/busca/contadores');

/* B14 portal: nenhum registro novo possível (gate defensivo no salvar) */
has(S, "if(state.form&&isRetiredSectorKey(state.form.sector)){retiredModuleNotice(", 'B14 save-gate defensivo (nenhuma criação nova)');

/* B15 sem novos alertas SLA */
has(S, "if(typeof isRetiredTask==='function'&&isRetiredTask(t)) continue;   /* F3.5.5E — módulo retirado nunca gera alerta SLA novo", 'B15 notifScanSla pula retirados (inclui copywriting/programacao que caíam no default 30/10)');

/* B16 sem novos check-ins / B17 sem claims novos (produtores main) */
has(TIS, 'retired = !!require("./notifEvents").isRetiredSector(String((d as any).sector || ""))', 'B16 mapa do check-in exclui retirados');
has(TIS, 'if (retired) tasks.delete(id); else tasks.set(id, d);', 'B16b exclusão no MESMO mapa do Acompanhamento (exec.onTasks)');
const et = ET.etEligibility({ designerId: 'd1', dueMs: 999, status: 'andamento', sector: 'roteiro' }, {});
ok('B17 Acompanhamento inelegível p/ módulo retirado (motivo auditável)', et && et.eligible === false && et.reason === 'modulo_descontinuado');
const etAliases = ['copywriting', 'copy', 'postagem', 'programacao_posts'].every(k => ET.etEligibility({ designerId: 'd1', dueMs: 9, status: 'andamento', sector: k }, {}).reason === 'modulo_descontinuado');
ok('B17b aliases também inelegíveis', etAliases);
const etLive = ET.etEligibility({ designerId: 'd1', dueMs: 9, status: 'andamento', sector: 'cronograma' }, {});
ok('B17c cronograma segue elegível (sem regressão)', etLive && etLive.eligible === true);

/* B18 deep-link antigo seguro (mensagem + redirect + log sanitizado) */
has(S, "var RETIRED_MODULE_MSG='Este módulo foi descontinuado e não está mais disponível no Agenda ID Seven.';", 'B18 mensagem exata do mandato');
has(S, "if(!t){ if(__retiredIndex[taskId]){retiredModuleNotice(taskId);} return; }", 'B18b openDetails trata deep-link retirado (nunca tela branca)');
has(S, "ncDiag('retired.deeplink.blocked',{taskId:String(taskId||''),motivo:'retired_module_'+kk})", 'B18c log só taskId+motivo (sem título/cliente/conteúdo)');
has(S, "if(_bs&&typeof isRetiredSectorKey==='function'&&isRetiredSectorKey(_bs)){retiredModuleNotice('',SECTOR_ALIAS[_bs]||_bs);return;}", 'B18d notifRoute board/ retirado bloqueado');
has(S, "if(isRetiredSectorKey(el.dataset.sector)){retiredModuleNotice('',SECTOR_ALIAS[el.dataset.sector]||el.dataset.sector);return;}", 'B18e clique em quadro retirado bloqueado');
has(S, "state.tab='tarefas';state.boardSector=null", 'B18f redirect para Tarefas');

/* B19-B20 dados históricos preservados; nenhum delete em massa */
const rcf = extract(S, 'retiredCutoffFilter') || '';
ok('B19 filtro é PURO (sem write/delete/update no banco)', rcf.indexOf('.delete') < 0 && rcf.indexOf('.set(') < 0 && rcf.indexOf('.update') < 0 && rcf.indexOf('db.') < 0);
has(rcf, 'nenhum dado apagado', 'B20 declaração explícita de não-destruição no runtime');
const inputIntact = call(`(function(){var l=${mixed};var c=JSON.stringify(l);retiredCutoffFilter(l);return JSON.stringify(l)===c;})()`);
ok('B20b lista de entrada não é mutada', inputIntact === true);

/* B21-B27 setores vivos funcionando (registro ativo exato + superfícies preservadas) */
let sectorsLive = null;
try {
  const aStart = S.indexOf('const SECTORS=[');
  const aEnd = S.indexOf('}];', aStart);
  sectorsLive = vm.runInContext('(' + S.slice(aStart + 'const SECTORS='.length, aEnd + 2) + ')', vm.createContext({}));
} catch (_e) { sectorsLive = null; }
ok('B21 SECTORS avaliável', Array.isArray(sectorsLive));
if (Array.isArray(sectorsLive)) {
  const ativos = sectorsLive.filter(s => !s.descontinuado).map(s => s.key).join(',');
  ok('B21b ativos EXATOS = edicao_midia,cronograma,edicao_cards (ordem coerente)', ativos === 'edicao_midia,cronograma,edicao_cards');
  ok('B22 definições históricas preservadas (6 setores no array)', sectorsLive.length === 6);
  ok('B23 labels/cores históricos intactos', sectorsLive.find(s => s.key === 'roteiro').label === 'Roteiro' && sectorsLive.find(s => s.key === 'copywriting').label === 'Copywriting');
}
has(S, "data-flowclient=\"1\"", 'B24 quadro Cliente preservado');
has(S, "data-flowdesigners=\"1\"", 'B25 quadro Designers preservado');
has(S, 'function renderRoleBoards()', 'B26 Quadros por responsável preservado');
has(S, 'function renderPersonBoard()', 'B27 Meu quadro preservado');

/* B28-B30 contadores recalculados / sem residual visual / sem rota residual */
ok('B28 contador recalculado (behavioral B7/B8)', kept.split(',').length === 4);
ok('B29 nenhuma iteração de SECTORS sem filtro nas superfícies (hub e criação filtram; secOf/find são resolvedores)', (S.match(/SECTORS\.map\(/g) || []).length === 0);
has(S, 'secOf(t.sector).key!==', 'B30a resolvedores por chave canônica presentes');
ok('B30 nenhuma comparação por rótulo visual p/ retirar (proibição do mandato)', S.indexOf("label==='Roteiro'") < 0 && S.indexOf('title.indexOf(\'Roteiro\')') < 0);

/* ============ C. NOTIFICAÇÕES PREMIUM (mandato 1–40) ============ */
/* produtor REAL (notifEvents.js) */
const doc = {
  id: 'T1', title: 'TEMAS', sector: 'cronograma', client: 'Hospital Visão',
  subtype: 'mensal', cronContents: new Array(12).fill(0).map(() => ({ tema: 'x' })),
  history: [
    { kind: 'moved', from: 'andamento', to: 'concluido', at: 1000, byId: 'u1', by: 'Miercohévisk Niheb Ferreira' },
    { kind: 'moved', from: 'concluido', to: 'andamento', at: 2000, byId: 'u1', by: 'Miercohévisk Niheb Ferreira' },
  ],
};
const evs = NE.deriveTaskEvents(doc, { nowMs: 3000, retentionMs: 999999 });
ok('C1 eventos derivados do doc real (concluída+reaberta)', evs.length === 2 && evs[0].type === 'task_completed' && evs[1].type === 'task_reopened');
const pay = NE.buildCategoryAPayload(evs[1], 'u9', null);
ok('C2 clientName CANÔNICO do doc (antes: sempre vazio)', pay.clientName === 'Hospital Visão');
ok('C3 sectorLabel oficial (nunca chave crua)', pay.sectorLabel === 'Cronograma' && pay.sector === 'cronograma');
ok('C4 cronContext legado REAL', pay.cronContext === 'Cronograma mensal • 12 temas');
ok('C5 status anterior/atual', pay.fromStatus === 'concluido' && pay.toStatus === 'andamento');
ok('C6 título do evento', pay.title === 'Tarefa reaberta');
ok('C7 deep-link preservado', pay.action && pay.action.deep === 'detail/T1');
ok('C8 dedupKey canônico intacto', /^task_reopened:T1:concluido>andamento:2000:u1$/.test(pay.dedupKey));

/* C12-C18 contexto do Cronograma — NUNCA inventar periodicidade */
ok('C12 semanal legado', NE.cronNotifContext('cronograma', 'semanal', 0, 3) === 'Cronograma semanal • 3 temas');
ok('C13 quinzenal legado', NE.cronNotifContext('cronograma', 'quinzenal', 0, 6) === 'Cronograma quinzenal • 6 temas');
ok('C14 mensal legado', NE.cronNotifContext('cronograma', 'mensal', 0, 12) === 'Cronograma mensal • 12 temas');
ok('C15 personalizado 1 tema (singular)', NE.cronNotifContext('cronograma', '', 1, 0) === 'Cronograma • 1 tema');
ok('C16 personalizado 7 temas', NE.cronNotifContext('cronograma', '', 7, 0) === 'Cronograma • 7 temas');
ok('C17 personalizado 20 temas', NE.cronNotifContext('cronograma', '', 0, 20) === 'Cronograma • 20 temas');
ok('C18 SEM periodicidade inventada (12 itens sem subtipo ≠ mensal; 3 ≠ semanal; 6 ≠ quinzenal)',
  NE.cronNotifContext('cronograma', '', 0, 12) === 'Cronograma • 12 temas' &&
  NE.cronNotifContext('cronograma', '', 0, 3) === 'Cronograma • 3 temas' &&
  NE.cronNotifContext('cronograma', '', 0, 6) === 'Cronograma • 6 temas');
ok('C18b legado sem contagem usa mapa do subtipo real', NE.cronNotifContext('cronograma', 'quinzenal', 0, 0) === 'Cronograma quinzenal • 6 temas');
ok('C18c sem subtipo e sem contagem ⇒ fallback profissional', NE.cronNotifContext('cronograma', '', 0, 0) === 'Cronograma');
ok('C18d outro setor ⇒ sem contexto de cronograma', NE.cronNotifContext('edicao_midia', '', 0, 5) === '');

/* C19-C20 setores vivos com rótulo oficial */
ok('C19 Edição de vídeos (inclui alias design)', NE.sectorLabelOf('edicao_midia') === 'Edição de vídeos' && NE.sectorLabelOf('design') === 'Edição de vídeos');
ok('C20 Edição de Cards', NE.sectorLabelOf('edicao_cards') === 'Edição de Cards');

/* gate de retirados no produtor durável */
ok('CR1 deriveTaskEvents ⇒ [] p/ módulos retirados (backlog incluso)',
  NE.deriveTaskEvents({ ...doc, sector: 'roteiro' }, { nowMs: 3000 }).length === 0 &&
  NE.deriveTaskEvents({ ...doc, sector: 'copy' }, { nowMs: 3000 }).length === 0 &&
  NE.deriveTaskEvents({ ...doc, sector: 'postagem' }, { nowMs: 3000 }).length === 0);
ok('CR2 isRetiredSector canônico + aliases', NE.isRetiredSector('copywriting') && NE.isRetiredSector('roteiro') && NE.isRetiredSector('programacao_posts') && NE.isRetiredSector('copy') && NE.isRetiredSector('postagem') && !NE.isRetiredSector('cronograma') && !NE.isRetiredSector('design'));
has(MAIN, 'return { ok: false, channel: "retired-dropped" };', 'CR3 cinto final no deliver (main)');
has(MAIN, 'diag("sla.reminder.retired_module", { taskId: String(taskId || ""), motivo: "retired_module_" + _sct });', 'CR4 taskGate invalida pendência com motivo auditável');
has(MAIN, 'return "terminal";', 'CR5 pendência retirada descartada pelas barreiras H2 (terminal)');

/* builders extraídos das DUAS superfícies + PARIDADE */
function builderOf(src, name) { return extract(src, name); }
const bldIdx = builderOf(S, 'premiumCommonInner'); const bldBg = builderOf(BG, 'premiumCommonInner');
ok('CP1 builder presente nas duas superfícies', !!bldIdx && !!bldBg);
ok('CP2 PARIDADE byte-a-byte do builder (toast × janela premium)', bldIdx === bldBg);
ok('CP3 paridade helpers categoria/verbo/hora', builderOf(S, 'premiumEvtCat') === builderOf(BG, 'premiumEvtCat') && builderOf(S, 'premiumByVerb') === builderOf(BG, 'premiumByVerb') && builderOf(S, 'premiumHMOf') === builderOf(BG, 'premiumHMOf'));

/* execução REAL do builder (DOM string) */
const BCTX = {};
vm.createContext(BCTX);
vm.runInContext([
  "function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});}",
  "function initials(name){try{var p=String(name||'').trim().split(/\\s+/).filter(Boolean);if(!p.length)return '';var a=p[0][0]||'';var b=p.length>1?(p[p.length-1][0]||''):'';return (a+b).toUpperCase();}catch(_){return '';}}",
  builderOf(S, 'premiumSevIcon') || extract(BG, 'premiumSevIcon'),
  extract(BG, 'premiumHM'), extract(BG, 'premiumChip'), extract(BG, 'premiumAvatar'),
  builderOf(S, 'premiumEvtIcon'), /* RE-PINADO F3.5.5E-H1: builder novo do ícone de evento (paths do icon set) */
  builderOf(S, 'premiumEvtCat'), builderOf(S, 'premiumByVerb'), builderOf(S, 'premiumHMOf'), bldIdx,
].join('\n'), BCTX);
const render = (p) => vm.runInContext('premiumCommonInner(' + JSON.stringify(p) + ')', BCTX);
const basePay = { eventType: 'task_reopened', title: 'Tarefa reaberta', taskTitle: 'TEMAS', clientName: 'Hospital Visão', sectorLabel: 'Cronograma', cronContext: 'Cronograma mensal • 12 temas', fromStatus: 'concluido', toStatus: 'andamento', actorName: 'Miercohévisk Niheb Ferreira', responsibleName: 'Felipe Teodozio', createdAt: new Date(2026, 0, 1, 15, 2).getTime(), severity: 'warning' };
const html = render(basePay);

/* C9-C11 cliente */
ok('C9 cliente claramente visível (linha própria + tooltip — RE-PINADO F3.5.5E-H1)', html.indexOf('<div class="ntfp-client" title="Hospital Visão">Hospital Visão</div>') >= 0);
const longCli = render({ ...basePay, clientName: 'Clínica Oftalmológica Visão Integrada de Alta Complexidade do Norte LTDA' });
ok('C10 cliente longo escapado e presente', longCli.indexOf('Clínica Oftalmológica Visão Integrada') >= 0);
ok('C11 sem cliente ⇒ fallback profissional', render({ ...basePay, clientName: '' }).indexOf('Sem cliente vinculado') >= 0);

/* C21-C23 autor × responsável */
ok('C21 autor é METADADO com verbo (nunca título) (RE-PINADO F3.5.5E-H2: linha ntfp-meta abaixo do contexto)', html.indexOf('Reaberta por Miercohévisk Niheb Ferreira') >= 0 && html.indexOf('class="ntfp-meta"') > html.indexOf('class="ntfp-task"'));
ok('C22 responsável em linha própria', html.indexOf('Responsável: Felipe Teodozio') >= 0);
ok('C23 autor==responsável ⇒ sem linha duplicada', render({ ...basePay, responsibleName: 'Miercohévisk Niheb Ferreira' }).indexOf('Responsável:') < 0);
ok('C23b sem autor ⇒ Usuário não identificado', render({ ...basePay, actorName: '' }).indexOf('Usuário não identificado') >= 0);

/* C24 avatar secundário */
ok('C24 sem foto ⇒ iniciais (MF) no AVATAR FLUTUANTE (RE-PINADO F3.5.5E-H2: referência do owner)', /ntfp-fl[^]*ntfp-av gen[^]*MF/.test(html));

/* C25-C26 textos longos escapados */
const xss = render({ ...basePay, taskTitle: '<img src=x onerror=alert(1)>', clientName: '<script>x</script>' });
ok('C25 título malicioso escapado', xss.indexOf('<img src=x') < 0 && xss.indexOf('&lt;img') >= 0);
ok('C26 cliente malicioso escapado', xss.indexOf('<script>x</script>') < 0 && xss.indexOf('&lt;script&gt;') >= 0);

/* C27-C28 status compactos */
ok('C27 transição from→to na CÁPSULA (RE-PINADO F3.5.5E-H2: dot cs do estado origem + destino em texto + seta)', html.indexOf('cdot cs-concluido') >= 0 && html.indexOf('pto">Em andamento') >= 0 && html.indexOf('ntfp-arrow') >= 0);
ok('C28 chips traduzidos (nunca chave crua)', html.indexOf('Concluído') >= 0 && html.indexOf('Em andamento') >= 0 && html.indexOf('>concluido<') < 0);

/* hierarquia obrigatória (ordem DOM) */
const order = ['ntfp-fl', 'ntfp-hd', 'ntfp-task', 'ntfp-client', 'ntfp-ctx', 'ntfp-meta', 'ntfp-respline', 'ntfp-pill']; /* RE-PINADO F3.5.5E-H2: avatar flutuante no topo; autor como metadata; cápsula inferior com CTA integrado (referência do owner) */
let lastIdx = -1, orderOk = true;
for (const c of order) { const i2 = html.indexOf(c); if (i2 < 0 || i2 < lastIdx) { orderOk = false; break; } lastIdx = i2; }
ok('CH1 hierarquia: avatar→evento→título→cliente→contexto→autor→responsável→cápsula (RE-PINADO F3.5.5E-H2)', orderOk);
ok('CH2 horário DO EVENTO (15:02, 24h)', html.indexOf('15:02') >= 0);
ok('CH3 categoria âmbar na reaberta (linha lateral + pastilha de ícone — RE-PINADO F3.5.5E-H1)', html.indexOf('cat-amber') >= 0 && html.indexOf('ntfp-ei') >= 0);
ok('CH4 concluída=verde / atribuída=azul / movimentada=violeta', render({ ...basePay, eventType: 'task_completed' }).indexOf('cat-green') >= 0 && render({ ...basePay, eventType: 'task_assigned', fromStatus: '', toStatus: '' }).indexOf('cat-blue') >= 0 && render({ ...basePay, eventType: 'task_moved' }).indexOf('cat-violet') >= 0);
ok('CH5 contexto sem duplicar setor (cronContext OU sectorLabel)', (html.match(/ntfp-ctx/g) || []).length === 1 && html.indexOf('Cronograma mensal • 12 temas') >= 0 && html.indexOf('>Cronograma<') < 0);
ok('CH6 setor vivo sem cronContext mostra o rótulo (tooltip — RE-PINADO F3.5.5E-H1)', render({ ...basePay, cronContext: '', sectorLabel: 'Edição de vídeos' }).indexOf('<div class="ntfp-ctx" title="Edição de vídeos">Edição de vídeos</div>') >= 0);
ok('CH7 nunca undefined/null/[object Object]', html.indexOf('undefined') < 0 && html.indexOf('[object') < 0 && render({ eventType: 'task_moved', createdAt: 1 }).indexOf('undefined') < 0);

/* C29-C30 ação + fechar (acessibilidade) */
ok('C29 CTA integrado na cápsula com role/tabindex/aria (RE-PINADO F3.5.5E-H2)', html.indexOf('class="ntfp-pill" role="button" tabindex="0" data-cta="1" aria-label="Abrir tarefa"') >= 0 && html.indexOf('class="ntfp-pr">Abrir') >= 0);
ok('C30 fechar com aria-label', html.indexOf('aria-label="Fechar notificação"') >= 0);
has(S, "el.addEventListener('keydown',function(ev){ try{ var k=ev.key; if(k!=='Enter'&&k!==' ')return;", 'C30b teclado Enter/Espaço (toast)');
has(BG, "el.addEventListener('keydown',function(ev){ try{ var k=ev.key; if(k!=='Enter'&&k!==' ')return;", 'C30c teclado Enter/Espaço (janela premium)');
has(S, "s.setAttribute('role','status'); s.setAttribute('aria-live','polite');", 'C30d aria-live único (toast)');
has(BG, '<div id="stack" role="status" aria-live="polite">', 'C30e aria-live único (janela premium)');
has(S, '@media (prefers-reduced-motion: reduce){.ntf{transition:none}.ntfp-fl{transform:none;transition:none}}', 'C30f reduced motion preservado (RE-PINADO F3.5.5E-H2: inclui o avatar flutuante)');

/* C31-C35 som/dedup/agrupamento/fila preservados */
ok('C31 som preservado no payload (sound:true)', pay.sound === true);
has(S, "if(p.sound!==false){ var _sr=notifSound(sev);", 'C31b autoridade de som do toast intacta (1.0.216)');
has(BG, 'function bgSound(sev)', 'C31c autoridade de som da janela premium intacta (1.0.216)');
has(S, 'function notifEmit(p){', 'C32 dedup notifEmit intacto');
has(S, 'function notifGroupUpdate(view){', 'C33 agrupamento intacto');
has(S, "if(all.length>4){ for(var i=0;i<all.length-4;i++)", 'C34 fila do toast preservada (limite aprovado)');
has(BG, 'while(stack.children.length>5){ stack.removeChild(stack.firstChild); }', 'C35 fila da janela premium preservada');

/* C36-C39: escalas/resoluções ⇒ provas Electron reais (harness). Largura no intervalo do mandato: */
has(S, ".ntf.ntfp-w{width:450px;max-width:calc(100vw - 36px);padding-top:26px;overflow:visible}", 'C36 largura 450px + headroom do avatar flutuante (RE-PINADO F3.5.5E-H2 — mandato 430–470)');
has(BG, '.ntf.ntfp-w{width:100%;max-width:100%;padding-top:26px;overflow:visible}', 'C37 janela premium responsiva + headroom do avatar (RE-PINADO F3.5.5E-H2; dimensionada pelo bgNotify.ts)');
has(S, '.ntfp-task{color:#ffffff', 'C38 título legível (contraste)');
has(S, '-webkit-line-clamp:2', 'C39 título máx 2 linhas');

/* C40 sino/histórico intacto */
has(S, 'notifHistoryAppend(p)', 'C40 histórico do sino preservado');

/* enriquecimento no renderer (payloads do próprio renderer) */
has(S, 'function cronNotifContextR(t){', 'CE1 resolvedor gêmeo no renderer');
has(S, "if(!p.clientName&&task.client)p.clientName=String(task.client);", 'CE2 normalize enriquece cliente do doc');
has(S, 'p.cronContext=cronNotifContextR(task);', 'CE3 normalize enriquece contexto');
ok('CE4 gêmeos com MESMAS regras (amostras)', (() => {
  const rc = extract(S, 'cronNotifContextR');
  const c2 = vm.createContext({ Array, String, Number, isFinite });
  vm.runInContext("function secOf(k){var a={design:'edicao_midia',copy:'copywriting',postagem:'programacao_posts'};var kk=a[k]||k;return {key:kk};}\n" + rc, c2);
  const f = (t) => vm.runInContext('cronNotifContextR(' + JSON.stringify(t) + ')', c2);
  return f({ sector: 'cronograma', subtype: 'quinzenal', cronContents: new Array(6).fill({}) }) === 'Cronograma quinzenal • 6 temas'
    && f({ sector: 'cronograma', cronQty: 7 }) === 'Cronograma • 7 temas'
    && f({ sector: 'cronograma', cronContents: new Array(12).fill({}) }) === 'Cronograma • 12 temas'
    && f({ sector: 'edicao_midia' }) === '';
})());

/* ============ D. SEGURANÇA / PRIVACIDADE ============ */
ok('D1 builder nunca expõe conteúdo privado', bldIdx.indexOf('legenda') < 0 && bldIdx.indexOf('tema,') < 0 && bldIdx.indexOf('designerItemNotes') < 0 && bldIdx.indexOf('token') < 0);
has(MAIN, 'nmask(p.taskId)', 'D2 log do deliver mascara taskId (padrão aprovado)');
ok('D3 observabilidade premium continua sem nome/título/cliente', MAIN.indexOf('NUNCA nome/título/cliente/setor/UID/e-mail/token') >= 0);
has(BG, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\';', 'D4 CSP da janela premium intacta');
ok('D5 sem unsafe-eval no renderer', S.indexOf('unsafe-eval') < 0);

/* ============ E. CONGELADOS (baseline 1.0.223 preservada) ============ */
has(S, 'function cronQtyCommit(', 'E1 quantidade personalizada do Cronograma (F3.5.5D)');
has(S, 'function scriptQtyCommit(', 'E2 stepper do Roteiro permanece no código (inerte; sem uso operacional)');
has(S, 'f355dWireUniversalPaste', 'E3 colagem universal (F3.5.5D)');
has(S, 'function _rtePasteApply(ed,htmlD,txt){', 'E4 editor rico + sanitização no caminho de colagem');
has(S, 'function rteSanitize', 'E5 sanitizador intacto');
has(MAIN, 'attachEditContextMenu(mainWin.webContents', 'E6 menu de contexto nativo (F3.5.5D)');
has(MAIN, 'ipcMain.handle("clipboard-read-html"', 'E7 IPC read-only do clipboard (F3.5.5D)');
ok('E8 H2 barreiras (1.0.222) — slaReminder congelado com o aviso terminal', (() => { try { return readFileSync(process.env.SLAR_SRC || path.join(__dirname, '../src/main/slaReminder.ts'), 'utf8').indexOf('Esta tarefa já foi encerrada.') >= 0; } catch (_e) { return false; } })());
has(MAIN, 'slaTaskMapReady', 'E9 H2 mapa canônico');
has(S, 'authRetryNow', 'E10 restauração de sessão (1.0.221)');
has(S, 'function isClientSector(k){return k===\'cronograma\'||k===\'roteiro\';}', 'E11 isClientSector congelado (comportamento histórico)');
has(S, 'function cronTypeLabel(o){', 'E12 cronTypeLabel legado intocado (chips de card)');
has(S, 'copywriting:{titleLabel:', 'E13 TEMPLATES copywriting preservado (histórico)');
has(S, 'roteiro:{titleLabel:', 'E14 TEMPLATES roteiro preservado (histórico)');
has(S, 'function notifScanFlow(){', 'E15 scanner de fluxo preservado');
has(S, 'function slaCfgOf(t){', 'E16 SLA por setor preservado');
has(MAIN, 'function deliverNotification(p: NotifPayload)', 'E17 HUB de entrega preservado');
has(S, 'function premiumGroupInner(view){', 'E18 template de grupo preservado');
has(S, 'PWA_LEGACY_SECTORS', 'E19 cutoff PWA preservado (precedente)');
has(S, 'function pwaCutoffFilter(list){', 'E20 pwaCutoffFilter byte-presente');

console.log('\nf355e: ' + pass + ' pass, ' + fail + ' fail' + (fail ? ' → ' + bad.join(' | ') : ''));
process.exit(fail ? 1 : 0);
