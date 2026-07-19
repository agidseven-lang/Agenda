#!/usr/bin/env node
/* =====================================================================
 * F3.3.77A — EDIÇÃO DE MÍDIA: fluxo interno Social→Designer→Finalizado.
 *   (1) N vídeos, cada um com seu TEMA (data.videos [{id,n,tema}]) → card/detalhe mostram TODOS.
 *   (2) Atribuição de Designer + PRAZO real (sem cliente/portal/token/Card Premium).
 *   (3) Aba Designers reconhece a tarefa (quadro individual do designer).
 *   (4) Notificações por SETOR: AZUL imediata · AMARELA em planDueAt−40 · VERMELHA em planDueAt (20min),
 *       SEM crítico adicional. Cronograma permanece 30/10; Roteiro sem SLA de designer.
 *
 * Mistura ESTÁTICO (regex na fonte) + EXTRAÇÃO-E-EXECUÇÃO do SLA REAL (notifScanSla +
 * resolveTaskDisplayState + slaCfgOf + SECTOR_SLA), como em f3376a. 50 asserções (mandato FASE 10).
 * Rodar: /opt/node22/bin/node desktop/scripts/f3377a-media-editing.test.mjs   (SRC=<index.html> força a fonte)
 * ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_PATH = process.env.SRC || path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const H = fs.readFileSync(SRC_PATH, 'utf8');

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; flog.push('FAIL — ' + n); console.log('  FAIL — ' + n); } };

/* ---- extração p/ execução do SLA real ---- */
function grab(n) { let a = H.indexOf('function ' + n + '('); if (a < 0) throw new Error('não encontrei: ' + n); let d = 0; for (let j = H.indexOf('{', a); j < H.length; j++) { const c = H[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return H.slice(a, j + 1); } } throw new Error('sem fim: ' + n); }
function grabVar(n) { let a = H.indexOf('var ' + n + '='); if (a < 0) throw new Error('não encontrei var: ' + n); let d = 0, started = false; for (let j = a; j < H.length; j++) { const c = H[j]; if (c === '{') { d++; started = true; } else if (c === '}') { d--; if (started && !d) { let k = j + 1; while (k < H.length && H[k] !== ';') k++; return H.slice(a, k + 1); } } } throw new Error('sem fim var: ' + n); }

const SLA_SRC = grabVar('SECTOR_SLA') + '\n' + grab('slaCfgDefault') + '\n' + grab('slaCfgOf') + '\n' +
  grab('slaPanelFinishMs') + '\n' + grab('slaPanelDelivered') + '\n' + grab('resolveTaskDisplayState') + '\n' +
  grab('resolveNotificationTargets') + '\n' + grab('notifScanSla') + '\n';
const PRELUDE =
  'var SLA_PANEL_WARN_MS=30*60000, SLA_PANEL_GRACE_MS=10*60000;\n' +
  'var CAP=[]; var __TASKS=[]; var state={user:{id:"dz1"}};\n' +
  'function slaibVisible(u){return __TASKS;}\n' +
  'function notifResponsible(t){var da=(t&&t.designerAssignment)||{};return {id:da.designerId||"dz1",name:"Designer Teste",avatar:""};}\n' +
  'function notifBuildPayload(p){return p;}\n' +
  'function notifEmit(p){CAP.push(p);}\n' +
  'function slaibFmtHM(ms){return "18:00";}\n' +
  'function slaCount(ms){return "39:58";}\n' +
  'function slaElapsed(ms){return "0:30";}\n' +
  'function slaCriticalFor(u){return null;}\n' +
  'function first(s){return (s||"").split(" ")[0];}\n' +
  'function dtMs(){return 0;}\n' +
  'function ncDiag(){}\n' +
  'function canonicalNowMs(){return Date.now();}\n' +                                                        /* F3.3.77A-R3 — relógio canônico (stub: offset 0) */
  'function _slaScheduleRevOf(t){return Number(t&&t.designerSla&&t.designerSla.scheduleRevision)||0;}\n' +   /* F3.3.77A-R3 — revisão de prazo (stub) */
  'function secOf(s){return {key:(s&&s.sector!==undefined)?s.sector:s};}\n';
const R = new Function(PRELUDE + SLA_SRC +
  '\n; return { notifScanSla, cap:function(){return CAP;}, setTasks:function(a){__TASKS=a;}, setUser:function(u){state.user=u;}, slaCfgOf:slaCfgOf, rtds:resolveTaskDisplayState };')();

const NOW = Date.now(), MIN = 60000, DAY = 86400000, HOUR = 3600000;
const emTask = (o) => Object.assign({ id: 'm1', title: 'Edição de mídia', sector: 'edicao_midia',
  designerAssignment: { designerId: 'dz1', assignedAt: NOW, assignedBy: 'soc1' }, designerFlowStatus: 'afazer',
  designerSla: { planDueAt: NOW + 3 * DAY } }, o || {});
const withPd = (pd, extra) => emTask(Object.assign({ designerSla: { planDueAt: pd } }, extra || {}));
const run = (t, uid) => { R.cap().length = 0; R.setUser({ id: uid || 'dz1' }); R.setTasks([t]); R.notifScanSla(); return R.cap().slice(); };
const evs = (t, uid) => run(t, uid).map(p => p.eventType);

/* extração do cronOf (puro) para provar a renderização dos temas */
const cronOfSrc = grab('cronOf');
const CR = new Function('var state={};' + cronOfSrc + '\n;return cronOf;')();

console.log('== F3.3.77A — Edição de mídia (vídeos/temas · atribuição · aba designers · SLA 40/20) ==');

/* ===================== BLOCO A — CONTEÚDOS (vídeos/temas) 1–10 ===================== */
ok('1  1 vídeo → 1 tema (cronOf lê t.videos; lista de 1)', (()=>{const r=CR({videos:[{id:'v1',n:1,tema:'Abertura'}]});return r&&r.count===1&&r.list.length===1&&r.list[0].tema==='Abertura';})());
ok('2  4 vídeos → 4 temas (lista de 4, todos)', (()=>{const r=CR({videos:[1,2,3,4].map(n=>({id:'v'+n,n,tema:'T'+n}))});return r&&r.count===4&&r.list.length===4;})());
ok('3  6 vídeos → 6 temas', (()=>{const r=CR({videos:Array.from({length:6},(_,i)=>({id:'v'+(i+1),n:i+1,tema:'T'+(i+1)}))});return r&&r.count===6&&r.list.length===6;})());
ok('4  12 vídeos → 12 temas', (()=>{const r=CR({videos:Array.from({length:12},(_,i)=>({id:'v'+(i+1),n:i+1,tema:'T'+(i+1)}))});return r&&r.count===12&&r.list.length===12;})());
ok('5  ordem preservada (índice → nº do vídeo, sem reordenar/filtrar)', (()=>{const r=CR({videos:[{tema:'C'},{tema:'A'},{tema:'B'}]});return r.list[0].tema==='C'&&r.list[1].tema==='A'&&r.list[2].tema==='B'&&r.list[0]._i===0&&r.list[2]._i===2;})());
ok('6  saveTask persiste TODOS os N vídeos como array estruturado {id,n,tema} (edição/reload preservam)',
  /_sub&&_sub\.videoTema/.test(H) && /for\(let i=0;i<_nV;i\+\+\)\{const v=\(f\.videos&&f\.videos\[i\]\)\|\|\{\};_vids\.push\(\{id:\(v&&v\.id\)\|\|\('v'\+\(i\+1\)\),n:i\+1,tema:/.test(H) && /data\.videos=_vids/.test(H));
ok('7  reload preserva (fonte de leitura = t.videos no cronOf, sem depender de estado local)', /if\(Array\.isArray\(t\.videos\)&&t\.videos\.length\)\{/.test(H) && /return \{list,count:t\.videos\.length,label:'',videos:true\}/.test(H));
ok('8  card mostra TODOS (caixa de temas rende cron.list; sem cortar)', /if\(cron&&cron\.list\.length\)\{/.test(H) && /kbv2-themes-list/.test(H) && /cron\.list\.map\(c=>'<div class="kbv2-theme">/.test(H));
ok('9  detalhes mostram TODOS + rótulo "Vídeos" (sector-aware)', /secOf\(t\.sector\)\.key==='edicao_midia'\?'Vídeos':'Conteúdos do cronograma'/.test(H));
ok('10 nenhum placeholder p/ Edição de mídia (placeholder só p/ isCron=isClientSector; edicao_midia é false)', /else if\(!clientView&&isCron&&\(!cron\|\|!cron\.list\.length\)\)\{/.test(H) && /function isClientSector\(k\)\{return k==='cronograma'\|\|k==='roteiro';\}/.test(H));

/* ===================== BLOCO B — ATRIBUIÇÃO 11–20 ===================== */
ok('11 detailState edicao_midia SEM designer → ação "senddesigner" (Aguardando atribuição)', /secOf\(t\.sector\)\.key==='edicao_midia'\)\{[\s\S]*?actions:\['senddesigner'\]/.test(H));
ok('12 modal de PRAZO reutilizado (openDesignerDeadline: início+término data/hora, input REAL)', /function openDesignerDeadline\(taskId,designerId\)\{/.test(H) && /id="dlEd"/.test(H) && /id="dlEt"/.test(H));
ok('13 sendToDesigner persiste designerAssignment + designerSla.planDueAt do PRAZO real (sem prazo fixo)', /const planDueAt=dl\.endDate\?dtMs\(dl\.endDate,dl\.endTime\|\|'23:59'\):null;/.test(H) && /designerSla:designerSla/.test(H) && /designerAssignment:assignment/.test(H));
ok('14 Social permanece autora (socialOwnerId preservado no envio)', /socialOwnerId:\(socialOf\(t\)\|\|\(isSocialUser\(u\)\?u\.id:null\)\)/.test(H));
ok('15 Edição de mídia NÃO injeta eixo-cliente (remove clientFlowStatus/finalApprovalRequired no envio)', /if\(secOf\(t\.sector\)\.key==='edicao_midia'\)\{[\s\S]*?delete patch\.clientFlowStatus;[\s\S]*?delete patch\.finalApprovalRequired;[\s\S]*?delete patch\.finalApprovalCompleted;/.test(H));
ok('16 sem token (nenhum ensureReviewToken/reviewToken no fluxo de designer de edicao_midia)', !/edicao_midia[\s\S]{0,600}ensureReviewToken/.test(H));
ok('17 sem portal/link de cliente na atribuição (senddesigner não abre visão de cliente)', /senddesigner:'<button class="btn dz-go" data-senddesigner="'\+t\.id/.test(H));
ok('18 sem Card Premium: dica "🔒 preencha 1 tema" NÃO aparece p/ edicao_midia (hero _filled forçado a 1)', /const _filled=isClientSector\(_k\)\?\(t\.cronContents\|\|\[\]\)\.filter\(c=>c&&\(c\.tema\|\|c\.legenda\)\)\.length:1;/.test(H));
ok('19 sem duplicata: atribuição atualiza o MESMO doc (.doc(taskId).update)', /await db\.collection\('tasks'\)\.doc\(taskId\)\.update\(patch\)/.test(H));
ok('20 troca de designer disponível (ação redesigner reusa data-senddesigner)', /redesigner:'<button class="btn ghost" data-senddesigner="'\+t\.id/.test(H) && /actions:\['dboard','redesigner'\]/.test(H));

/* ===================== BLOCO C — ABA DESIGNERS 21–29 (fluxo do designer) ===================== */
const flowSrc = grab('hasDesigner') + '\n' + grab('isDesignerFlow') + '\n' + grab('designerOf') + '\n' + grab('designerCol') + '\n';
const DF = new Function('function secOf(s){return {key:(s&&s.sector!==undefined)?s.sector:s};}' + flowSrc + '\n;return {hasDesigner,isDesignerFlow,designerOf,designerCol};')();
const emAssigned = (did) => ({ id: 'm2', sector: 'edicao_midia', designerAssignment: { designerId: did }, designerFlowStatus: 'afazer' });
ok('21 edicao_midia ATRIBUÍDA entra no fluxo do designer (isDesignerFlow=true)', DF.isDesignerFlow(emAssigned('dz1')) === true);
ok('22 vai para o quadro do designer CORRETO (designerOf = designerId)', DF.designerOf(emAssigned('dzX')) === 'dzX');
ok('23 outro designer NÃO recebe (designerOf != outro id)', DF.designerOf(emAssigned('dz1')) !== 'dz2');
ok('24 recém-atribuída cai em "A Fazer" (designerFlowStatus afazer → designerCol afazer)', DF.designerCol(emAssigned('dz1')) === 'afazer');
ok('25 movimentação atualiza o MESMO documento (moveStatus eixo designer grava designerFlowStatus; sem doc novo)', /if\(isDesignerAxisMove\(t\)\)\{[\s\S]*?designerFlowStatus:newStatus/.test(H));
ok('26 finalização: designer "Entregue"/"concluido" → status concluido + doneAt (não-cron)', /else if\(newStatus==='concluido'\|\|newStatus==='entregue'\)\{patch\.status='concluido';patch\.doneAt=now/.test(H));
ok('27 aba Designers NÃO fica vazia quando há edicao_midia atribuída (designerBoardsList filtra isDesignerFlow)', /state\.tasks\.forEach\(t=>\{if\(!isDesignerFlow\(t\)\)return;const did=designerOf\(t\);/.test(H));
ok('28 Cronograma continua aparecendo (hasDesigner aceita não-roteiro; cronograma segue no fluxo)', DF.hasDesigner({ sector: 'cronograma', designerAssignment: { designerId: 'dz1' } }) === true);
ok('29 Roteiro NÃO aparece como tarefa de designer (hasDesigner exclui roteiro)', DF.hasDesigner({ sector: 'roteiro', designerAssignment: { designerId: 'dz1' } }) === false);

/* ===================== BLOCO D — NOTIFICAÇÕES 30–44 ===================== */
ok('30 AZUL imediata na atribuição (notifScanAssign dispara p/ designerAssignment; sector-agnóstico)', /function notifScanAssign\(\)\{/.test(H) && /da && da\.designerId===me && da\.assignedBy!==me/.test(H) && /eventType:'designer_assigned'/.test(H));
ok('31 AZUL só p/ o designer escolhido (da.designerId===me)', /da\.designerId===me/.test(H) && /'Nova tarefa atribuída a você'/.test(H));
ok('32 AMARELA NÃO aparece na atribuição (prazo 3 dias à frente → sem amarelo)', !evs(withPd(NOW + 3 * DAY), 'dz1').includes('sla_warning'));
ok('33 AMARELA em planDueAt−40 (prazo 35min à frente → dentro da janela de 40 → AMARELO)', evs(withPd(NOW + 35 * MIN), 'dz1').includes('sla_warning'));
ok('33b AMARELA NÃO antes de −40 (prazo 45min à frente → SEM amarelo)', !evs(withPd(NOW + 45 * MIN), 'dz1').includes('sla_warning'));
ok('34 texto EXATO do amarelo (40 minutos)', (run(withPd(NOW + 30 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {}).body === 'Você tem 40 minutos para concluir esta tarefa.');
ok('35 VERMELHA em planDueAt (prazo no passado + aberta → sla_overdue)', evs(withPd(NOW - 1 * MIN), 'dz1').includes('sla_overdue'));
ok('36 texto EXATO do vermelho (20 minutos)', (run(withPd(NOW - 1 * MIN), 'dz1').find(p => p.eventType === 'sla_overdue') || {}).body === 'Você tem 20 minutos para concluir esta tarefa.');
ok('37 conclusão CANCELA o vermelho (designerFlowStatus=concluido + prazo passado → sem alerta)', !evs(withPd(NOW - 1 * MIN, { designerFlowStatus: 'concluido' }), 'dz1').length);
ok('38 alteração de prazo RECALCULA (novo finishMs → novo dedupKey media_warning_40; :r0 = scheduleRevision F3.3.77A-R3)', (run(withPd(NOW + 18 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {}).dedupKey === 'media_warning_40:m1:dz1:' + (NOW + 18 * MIN) + ':r0');
ok('39 reatribuição RECALCULA (novo designer dz2 recebe; dedup inclui designerId + scheduleRevision)', (run(withPd(NOW + 20 * MIN, { designerAssignment: { designerId: 'dz2', assignedAt: NOW } }), 'dz2').find(p => p.eventType === 'sla_warning') || {}).dedupKey === 'media_warning_40:m1:dz2:' + (NOW + 20 * MIN) + ':r0');
ok('40 dedup impede repetição (mesmo snapshot → mesmo dedupKey estável)', (run(withPd(NOW + 20 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {}).dedupKey === (run(withPd(NOW + 20 * MIN), 'dz1').find(p => p.eventType === 'sla_warning') || {}).dedupKey);
ok('40b dedup vermelho = media_overdue_20:taskId:designerId:planDueAt:rN', (run(withPd(NOW - 1 * MIN), 'dz1').find(p => p.eventType === 'sla_overdue') || {}).dedupKey === 'media_overdue_20:m1:dz1:' + (NOW - 1 * MIN) + ':r0');
ok('41 clique abre a tarefa (action detail/<taskId>)', (run(withPd(NOW - 1 * MIN), 'dz1').find(p => p.eventType === 'sla_overdue') || {}).action.deep === 'detail/m1');
ok('42 SEM crítico adicional p/ Edição de mídia (prazo −25min, após grace de 20 → NENHUMA notificação)', evs(withPd(NOW - 25 * MIN), 'dz1').length === 0);
ok('43 só o DESIGNER responsável recebe (dz2 não recebe o vermelho de dz1)', !evs(withPd(NOW - 1 * MIN), 'dz2').includes('sla_overdue'));
ok('44 Social/autor não recebe (soc1 fora do alvo do SLA pessoal)', !evs(withPd(NOW + 20 * MIN), 'soc1').includes('sla_warning'));

/* ===================== BLOCO E — PRESERVAÇÕES 45–50 ===================== */
ok('45 CRONOGRAMA mantém 30/10 (config + comportamento: prazo 25min → "30 minutos"; −5min → crítico "Sinalize")',
  (()=>{const cfg=R.slaCfgOf({sector:'cronograma'});const y=run({id:'c1',sector:'cronograma',designerAssignment:{designerId:'dz1'},designerFlowStatus:'afazer',designerSla:{planDueAt:NOW+25*MIN}},'dz1').find(p=>p.eventType==='sla_warning')||{};const cr=run({id:'c1',sector:'cronograma',designerAssignment:{designerId:'dz1'},designerFlowStatus:'afazer',designerSla:{planDueAt:NOW-15*MIN}},'dz1').find(p=>p.eventType==='sla_critical')||{};return cfg.warningMinutes===30&&cfg.overdueGraceMinutes===10&&y.body==='Você tem 30 minutos para concluir esta tarefa.'&&cr.eventType==='sla_critical';})());
ok('46 ROTEIRO sem SLA de designer (config designerSla:false; prazo na janela → nenhuma notificação)',
  (()=>{const cfg=R.slaCfgOf({sector:'roteiro'});return cfg.designerSla===false && evs(withPd(NOW+20*MIN,{sector:'roteiro'}),'dz1').length===0;})());
ok('47 Card Premium / portal do cliente intactos (domínio+rota aprovados preservados)', /const CLIENT_LINK_BASE='https:\/\/aprovar\.agendaidseven\.com\.br'/.test(H) && /'\/share\/cronograma\/'\+t/.test(H));
ok('48 isClientSector inalterado (só cronograma||roteiro; edicao_midia NÃO é cliente)', /function isClientSector\(k\)\{return k==='cronograma'\|\|k==='roteiro';\}/.test(H));
ok('49 wizard "Nova tarefa" intacto (openNewTaskWizard reinicia na etapa 0/Setor)', /function openNewTaskWizard\(\)\{[\s\S]*?state\.form=newForm\(null\);/.test(H));
ok('50 login/tray/Kanban intactos (âncoras preservadas)', /data-logout="1"/.test(H) && /function isDesignerAxisMove/.test(H) && /kbv2-card-footer/.test(H));

/* ═══════════════════ F3.3.77A-R2 — BLOQUEADORES DA PROVA FÍSICA ═══════════════════ */
console.log('\n== F3.3.77A-R2 — horários (B1) · criação atômica (B2) · identidade da azul (B3) ==');

/* ---- B1: HORÁRIOS — _editingNow protege QUALQUER campo de data/hora GLOBALMENTE ---- */
const _EN = (active, formSet, until) => new Function('document', 'state', '_fieldEditUntil',
  grab('_isTimeDateEl') + '\n' + grab('_editingNow') + '\n; return _editingNow();')(
    { getElementById: (id) => id === 'modalRoot' ? { firstChild: null, querySelector: () => null } : null, activeElement: active },
    { form: formSet ? {} : null }, until || 0);
const timeEl = { tagName: 'INPUT', getAttribute: (k) => k === 'type' ? 'time' : null, type: 'time', closest: () => null };
const dateEl = { tagName: 'INPUT', getAttribute: (k) => k === 'type' ? 'date' : null, type: 'date', closest: () => null };
const searchEl = { tagName: 'INPUT', getAttribute: (k) => k === 'type' ? 'text' : null, type: 'text', isContentEditable: false, closest: (s) => /tbar|bsearch|d-board-tools/.test(s) ? {} : null };
ok('B1.1 campo type=time em foco → adia render (mesmo SEM state.form/#content)', _EN(timeEl, false, 0) === true);
ok('B1.2 campo type=date em foco → adia render (global)', _EN(dateEl, false, 0) === true);
ok('B1.3 janela de graça ativa (seletor nativo aberto, foco fora) → adia render', _EN(null, false, Date.now() + 1000) === true);
ok('B1.4 busca da toolbar (type=text em .tbar) NÃO adia (preserva correção 1.0.104)', _EN(searchEl, false, 0) === false);
ok('B1.5 sem foco e sem graça → NÃO adia (render normal)', _EN(null, false, 0) === false);
ok('B1.6 listener de captura renova a graça em interação com data/hora', /_isTimeDateEl\(e&&e\.target\)\) _fieldEditUntil=Date\.now\(\)\+1500/.test(H) && /'pointerdown','keydown','input','change','focusin','wheel'/.test(H));
ok('B1.7 proteção é GLOBAL (checa data/hora ANTES de qualquer escopo de container/setor)', /if\(_isTimeDateEl\(a\)\)return true;[\s\S]{0,260}if\(Date\.now\(\)<_fieldEditUntil\)return true;/.test(H));
ok('B1.8 campos de data/hora abrem seletor nativo (showPicker) — comportamento único', /inp\.showPicker&&inp\.showPicker\(\)/.test(H));

/* ---- B2: CRIAÇÃO ATÔMICA — Designer + prazo no formulário inicial ---- */
ok('B2.1 wizard: Designer responsável OBRIGATÓRIO (isMedia)', /isMedia\?'Designer responsável <span class="req">obrigatório<\/span>'/.test(H));
ok('B2.2 wizard: prazo (término) OBRIGATÓRIO p/ edicao_midia', /Data de término'\+\(isMedia\?' <span class="req">obrigatório<\/span>'/.test(H));
ok('B2.3 saveTask valida Designer + término antes de criar (edicao_midia)', /if\(secOf\(f\.sector\)\.key==='edicao_midia'\)\{[\s\S]{0,260}if\(!f\.assigneeId\)\{[\s\S]{0,200}if\(!f\.endDate\)\{/.test(H));
ok('B2.4 criação ATÔMICA: data.designerAssignment montado ANTES do add() (mesma operação)', /data\.designerAssignment=\{ designerId:f\.assigneeId/.test(H) && /data\.designerFlowStatus='afazer'/.test(H) && /data\.status='afazer'/.test(H));
ok('B2.5 designerSla.planDueAt = término (dtMs de f.endDate); sem prazo automático fixo', /data\.designerSla=\{ planStartAt:\(f\.startDate\?dtMs\(f\.startDate[\s\S]{0,80}planDueAt:\(f\.endDate\?dtMs\(f\.endDate/.test(H));
ok('B2.6 UMA única gravação (add) — o bloco de atribuição está DENTRO de saveTask, antes de db...add(data)', H.indexOf("data.designerAssignment={ designerId:f.assigneeId") < H.indexOf("ref=await db.collection('tasks').add(data)"));
ok('B2.7 edicao_midia na criação NÃO seta clientFlowStatus/cronStatus (só isClientSector)', /if\(isClientSector\(secOf\(f\.sector\)\.key\)\)\{data\.cronStatus=/.test(H));
ok('B2.8 detailState edicao_midia COM designer → NÃO "Pronto para enviar" (Aguardando/produção)', /if\(secOf\(t\.sector\)\.key==='edicao_midia'\)\{\s*if\(hasDesigner\(t\)\)\{[\s\S]{0,400}edm_aguardando_iniciar/.test(H));
ok('B2.9 recuperação de legado preservada: edicao_midia SEM designer ainda oferece senddesigner', /key:'edm_aguardando_atrib'[\s\S]{0,340}actions:\['senddesigner'\]/.test(H));

/* ---- B3: IDENTIDADE DA NOTIFICAÇÃO AZUL ---- */
ok('B3.1 persiste QUEM ENVIOU = Social (assignedBy/assignedById/assignedByName + foto via photoOf)', /assignedBy:_soc\.id\|\|null, assignedById:_soc\.id\|\|null, assignedByName:_soc\.name\|\|'', assignedByAvatar:photoOf\(_soc\)/.test(H));
ok('B3.2 persiste QUEM RECEBEU = Designer (designerName + foto via photoOf)', /designerId:f\.assigneeId, designerName:_des\.name\|\|'', designerAvatar:photoOf\(_des\)/.test(H));
ok('B3.3 notifScanAssign: actor=assignedBy (Social), responsible=designerId (Designer)', /actorId:da\.assignedBy\|\|'', actorName:da\.assignedByName[\s\S]{0,140}responsibleId:da\.designerId\|\|'', responsibleName:da\.designerName/.test(H));
ok('B3.4 título = "<Social> atribuiu uma tarefa" (autor é a Social, não o Designer)', /title:\(da\.assignedByName\?da\.assignedByName\+' atribuiu uma tarefa'/.test(H) && /if\(actor\.name\) p\.title=actor\.name\+' atribuiu uma tarefa';/.test(H));
ok('B3.5 toast: avatar/nome PRINCIPAL = ATOR (Social) no fluxo/atribuição; responsável em linha própria', /var primName = isSla \? \(p\.responsibleName\|\|p\.actorName\|\|''\) : \(p\.actorName\|\|p\.responsibleName\|\|''\);/.test(H) && /respRow='<div class="ntf-resp">'\+rav\+'<span>Responsável: '/.test(H));
ok('B3.6 clique ABRE A TAREFA (deep detail/<taskId>, não o quadro; eventId canônico F3.3.77A-R3)', /dedupKey:'designer_assigned:'\+t\.id\+':'\+\(da\.designerId\|\|''\)\+':'\+at, action:\{type:'detail',deep:'detail\/'\+t\.id\}/.test(H));
ok('B3.7 entregue SOMENTE ao Designer atribuído (da.designerId===me && da.assignedBy!==me)', /if\(da && da\.designerId===me && da\.assignedBy!==me\)\{/.test(H));

/* ---- PRESERVAÇÕES adicionais (R2) ---- */
ok('R2.P1 correção dos TEMAS preservada (data.videos + cronOf t.videos intactos)', /data\.videos=_vids/.test(H) && /if\(Array\.isArray\(t\.videos\)&&t\.videos\.length\)\{/.test(H));
ok('R2.P2 SLA 40/20 preservado (Edição de mídia) + Cronograma 30/10 + Roteiro sem SLA', (() => { const m = R.slaCfgOf({ sector: 'edicao_midia' }), c = R.slaCfgOf({ sector: 'cronograma' }), r = R.slaCfgOf({ sector: 'roteiro' }); return m.warningMinutes === 40 && m.overdueGraceMinutes === 20 && c.warningMinutes === 30 && c.overdueGraceMinutes === 10 && r.designerSla === false; })());
ok('R2.P3 wizard reset (openNewTaskWizard) e login/tray intactos', /function openNewTaskWizard\(\)\{[\s\S]*?state\.form=newForm\(null\);/.test(H) && /data-logout="1"/.test(H));

console.log('');
console.log('RESULTADO F3.3.77A: ' + pass + ' PASS, ' + fail + ' FAIL  (SRC=' + SRC_PATH + ')');
if (fail) { console.log(flog.join('\n')); process.exit(1); }
