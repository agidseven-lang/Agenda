#!/usr/bin/env node
/* ============================================================================
 * F3.5.2C — Edição de Cards: CONTEÚDO no card · COLUNA de altura natural ·
 *           MOVIMENTAÇÃO BIDIRECIONAL do designer (Desktop 1.0.190)
 * ----------------------------------------------------------------------------
 * Correções ISOLADAS ao setor edicao_cards, sem tocar contratos congelados:
 *   (1) COLUNA: .kbv2-board--cards (align-items:flex-start + column-body flex:0 0 auto) — botão
 *       "Adicionar tarefa" logo após o último card; classe aplicada SÓ quando boardSector==='edicao_cards'.
 *   (2) CONTEÚDO: kbv2Card mostra Legenda/Observações (2 linhas, só quando preenchidos) via campos
 *       canônicos cardLegenda/cardObs (fallback desc). Conteúdo completo permanece em Detalhes.
 *   (3) MOVIMENTAÇÃO: moveStatus sincroniza t.status em TODOS os 4 estados p/ edicao_cards (corrige
 *       andamento→A Fazer, que não voltava no quadro do setor); designerMoveOpts ganha Concluído→Revisão;
 *       reabrir limpa doneAt/designerSla.finishedAt (reativa cardsRules). NÃO semeia designerSla.
 *
 * cardsRules.js/slaRules.js/main.ts/notifier.ts/tray.ts/bgNotify.ts/Card Premium: BYTE-IDÊNTICOS a 1.0.189.
 * Base congelada: Desktop 1.0.189 · tag v1.0.189 · commit 92cfb01. Uso: node scripts/f352c-…test.mjs
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');            // desktop/
const REPO = resolve(ROOT, '..');
const BASE = '92cfb018c46beb92f7ee43f1e954661b92a41bac';
const gitShow = (rel) => execSync(`git show ${BASE}:${rel}`, { cwd: REPO, maxBuffer: 1 << 30 }).toString();

let PASS = 0, FAIL = 0; const fails = [];
const ok = (c, m) => { if (c) PASS++; else { FAIL++; fails.push(m); console.error('  ✗ ' + m); } };
const eq = (a, b, m) => ok(a === b, m);

const SRC = readFileSync(resolve(ROOT, 'src/renderer/index.html'), 'utf8');
const BASESRC = gitShow('desktop/src/renderer/index.html');

console.log('F3.5.2C — conteúdo + coluna + movimentação (edicao_cards) — testes\n');

/* ── extração de funções top-level por brace-matching ── */
function grab(src, name){ const re=new RegExp('function\\s+'+name+'\\s*\\('); const m=re.exec(src); if(!m) return null;
  let i=src.indexOf('{',m.index),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(m.index,j); }

/* ambiente mínimo p/ rodar as funções reais */
const state = { user:{id:'D1',name:'Bruno',role:'Designer'}, users:[{id:'D1',name:'Bruno'},{id:'D2',name:'Outro'}], designerBoard:'D1', tasks:[] };
const SECTORS=[{key:'edicao_cards',label:'Edição de Cards'},{key:'cronograma',label:'Cronograma'},{key:'roteiro',label:'Roteiro'},{key:'edicao_midia',label:'Edição de vídeos'}];
const secOf=(k)=>{k=(k&&k.key)||k; return SECTORS.find(s=>s.key===k)||{key:k||'',label:''};};
const isClientSector=(k)=>k==='cronograma'||k==='roteiro';
const ctx={ state, secOf, isClientSector };
const NAMES=['hasDesigner','isDesignerFlow','designerOf','designerCol','designerColView','isDesignerAxisMove','designerMoveOpts','cardsFieldOf'];
const F=(new Function(...Object.keys(ctx), NAMES.map(n=>grab(SRC,n)).join('\n')+'\nreturn {'+NAMES.join(',')+'};'))(...Object.values(ctx));

const cardTask=(over={})=>Object.assign({ id:'T1', sector:'edicao_cards', status:'afazer',
  assigneeId:'D1', title:'Card de lançamento', client:'Cliente Aurora',
  cardTema:'Card de lançamento', cardLegenda:'Legenda do post', cardObs:'Revisar cores',
  desc:'Legenda: Legenda do post\nObs.: Revisar cores',
  designerAssignment:{ designerId:'D1', designerName:'Bruno', status:'sent' },
  designerFlowStatus:'afazer', designerWorkflowStage:'afazer' }, over);

/* ═══ 0) PROVA MESTRA — revertendo as 6 edições F3.5.2C, index.html == 1.0.189 (92cfb01) BYTE-A-BYTE ═══
 * Blindagem total: se reverter EXATAMENTE as 6 edições isoladas reproduz o 1.0.189 byte-a-byte, então
 * NADA além dessas 6 edições mudou — Card Premium, notificações, Cronograma, Roteiro, aprovação, updater,
 * tray/X, e todo o resto do renderer permanecem intactos. Cada edição carrega o marcador "F3.5.2C". */
let _r = SRC;
const _cut = (a, b) => { const i=_r.indexOf(a), j=_r.indexOf(b, i>=0?i:0);
  ok(i>=0 && j>i, '0. âncora localizada: '+a.slice(0,46)); if(i>=0&&j>i) _r=_r.slice(0,i)+_r.slice(j); };
const _swap = (a, b, inj) => { const i=_r.indexOf(a), j=_r.indexOf(b, i>=0?i:0);
  ok(i>=0 && j>i, '0. âncora localizada: '+a.slice(0,46)); if(i>=0&&j>i) _r=_r.slice(0,i)+inj+_r.slice(j); };
// (1) bloco CSS isolado (coluna + notas + título)         → puro acréscimo
_cut('/* F3.5.2C — QUADRO de "Edição de Cards"', 'body.desktop .kbv2-btn{');
// (2) renderBoard: comentário + 3 linhas                  → 1 linha base
_swap('    /* F3.5.2C — só o quadro de Edição de Cards', "\n    return h+'</div>';",
      '    h+=kbv2BoardHtml(STATUS.map((st,i)=>({label:st.label,color:st.color,key:st.key,tasks:byStatus[i]})));');
// (3) helper cardsFieldOf                                  → puro acréscimo
_cut('/* F3.5.2C — leitura canônica de campos do card', 'function kbv2Card(');
// (4) bloco Legenda/Observações no kbv2Card                → puro acréscimo
_cut('/* F3.5.2C — Edição de Cards: Legenda / Observações', '// 7) trilho + 8) etapa');
// (5) designerMoveOpts: comentário + ternário             → 1 linha base
_swap('/* F3.5.2C — Edição de Cards: de Concluído também é permitido', '\n  // role-aware (passo 2)',
      "if(cur==='concluido')return [{key:'andamento',label:'Reabrir (Em andamento)',desc:'Voltar a produzir'}];");
// (6) ramo edicao_cards em moveStatus                      → puro acréscimo
_cut("    if(secOf(t.sector).key==='edicao_cards'){\n      /* F3.5.2C — Edição de Cards: eixo do designer",
     '    // EIXO DO DESIGNER (fonte única)');
eq(_r, BASESRC, '0. PROVA MESTRA — revertendo as 6 edições, index.html == 1.0.189 (92cfb01) BYTE-A-BYTE');
eq(_r.length, BASESRC.length, '0b. comprimento reconstruído == base (nenhum byte residual)');
// 7 marcadores "F3.5.2C" no renderer (6 regiões de edição; o bloco CSS carrega 2 comentários:
// coluna + notas/título), e ZERO na base 1.0.189.
eq((SRC.match(/F3\.5\.2C/g)||[]).length, 7, '0c. exatamente 7 comentários F3.5.2C no candidato (6 edições; bloco CSS tem 2)');
eq((BASESRC.match(/F3\.5\.2C/g)||[]).length, 0, '0d. base 1.0.189 NÃO contém marcador F3.5.2C');

/* ═══ 1) FIX COLUNA — CSS isolado + gating por setor ═══ */
ok(/\.kbv2-board\.kbv2-board--cards\{\s*align-items:flex-start;\s*\}/.test(SRC), '1a. CSS .kbv2-board--cards => align-items:flex-start');
ok(/\.kbv2-board\.kbv2-board--cards \.kbv2-column-body\{\s*flex:0 0 auto;\s*\}/.test(SRC), '1b. CSS .kbv2-board--cards .kbv2-column-body => flex:0 0 auto');
ok(SRC.includes("state.boardSector==='edicao_cards')_bh=_bh.replace('<div class=\"kbv2-board\">','<div class=\"kbv2-board kbv2-board--cards\">')"),
   '1c. renderBoard aplica .kbv2-board--cards SOMENTE quando boardSector===edicao_cards');
eq(grab(SRC,'kbv2BoardHtml'), grab(BASESRC,'kbv2BoardHtml'), '1d. kbv2BoardHtml BYTE-IDÊNTICO à 1.0.189 (não tocado)');
ok(!BASESRC.includes('kbv2-board--cards'), '1e. base 1.0.189 NÃO tinha .kbv2-board--cards');

/* ═══ 2) FIX CONTEÚDO — cardsFieldOf canônico + fallback ═══ */
eq(F.cardsFieldOf(cardTask(),'tema'), 'Card de lançamento', '2a. cardsFieldOf tema = valor real');
eq(F.cardsFieldOf(cardTask(),'legenda'), 'Legenda do post', '2b. cardsFieldOf legenda = cardLegenda canônico');
eq(F.cardsFieldOf(cardTask(),'obs'), 'Revisar cores', '2c. cardsFieldOf obs = cardObs canônico');
// tarefa ANTIGA: sem cardLegenda/cardObs, só desc → fallback
const old=cardTask({cardLegenda:undefined,cardObs:undefined,cardTema:undefined});
eq(F.cardsFieldOf(old,'legenda'), 'Legenda do post', '2d. fallback: legenda derivada do desc (tarefa antiga)');
eq(F.cardsFieldOf(old,'obs'), 'Revisar cores', '2e. fallback: obs derivada do desc (tarefa antiga)');
eq(F.cardsFieldOf(old,'tema'), 'Card de lançamento', '2f. fallback: tema = title (tarefa antiga)');
eq(F.cardsFieldOf(cardTask({cardLegenda:''}),'legenda'), '', '2g. legenda vazia => "" (não reserva espaço)');
// kbv2Card: bloco de nota SÓ para edicao_cards + só quando preenchido
const kb=grab(SRC,'kbv2Card');
ok(kb.includes("if(s.key==='edicao_cards')") && kb.includes('kbv2-card-note'), '2h. kbv2Card emite bloco Legenda/Obs SÓ p/ edicao_cards');
ok(kb.includes("if(_cl)h+=") && kb.includes("if(_co)h+="), '2i. Legenda/Obs só renderizam quando preenchidas (vazio não reserva)');
ok(kb.includes('cardsFieldOf(t,\'legenda\')') && kb.includes('cardsFieldOf(t,\'obs\')'), '2j. usa cardsFieldOf (campos canônicos, sem duplicar no Firestore)');
ok(/\.kbv2-card-note \.kbv2-note-v\{[^}]*-webkit-line-clamp:2/.test(SRC), '2k. prévia de Legenda/Obs limitada a 2 linhas (line-clamp)');
ok(/\.kbv2-card\.kbv2-card--cards \.kbv2-title\{[^}]*-webkit-line-clamp:2/.test(SRC), '2l. Tema (título) do card: até 2 linhas depois trunca');
ok(SRC.includes('<div class="det-sec">Briefing</div><div class="det-desc">'+"'+esc(t.desc)+'"), '2m. conteúdo completo (Legenda/Obs via desc) em Detalhes — inalterado');
// ordem: chips (setor) antes das notas, notas antes do trilho/etapa
ok(kb.indexOf('kbv2-card-chips') < kb.indexOf('kbv2-card-note') && kb.indexOf('kbv2-card-note') < kb.indexOf('kbv2-card-rail'),
   '2n. ordem preservada: setor → Legenda/Obs → progresso/etapa');

/* ═══ 3) FIX MOVIMENTAÇÃO — designerMoveOpts bidirecional (isolado) ═══ */
const optKeys=(st)=>{const t=cardTask({designerFlowStatus:st,status:st}); return F.designerMoveOpts(t).map(o=>o.key);};
ok(optKeys('afazer').includes('andamento'), '3a. A Fazer → Em andamento (frente)');
ok(optKeys('andamento').includes('revisao') && optKeys('andamento').includes('afazer'), '3b. Em andamento → Revisão (frente) e → A Fazer (trás)');
ok(optKeys('revisao').includes('concluido') && optKeys('revisao').includes('andamento'), '3c. Revisão → Concluído (frente) e → Em andamento (trás)');
ok(optKeys('concluido').includes('revisao'), '3d. Concluído → Revisão (trás) — LACUNA CORRIGIDA');
ok(optKeys('concluido').includes('andamento'), '3e. Concluído → Em andamento (reabrir) — preservado');
// isolamento: designerMoveOpts p/ NÃO-cards (concluido) byte-idêntico à base
{ const nonCards=cardTask({sector:'edicao_midia',designerFlowStatus:'concluido',status:'concluido'});
  const keys=F.designerMoveOpts(nonCards).map(o=>o.key);
  eq(JSON.stringify(keys), JSON.stringify(['andamento']), '3f. designerMoveOpts NÃO-cards (Concluído) inalterado: só [andamento]'); }
// permissão: só o designer atribuído (isDesignerAxisMove)
ok(F.isDesignerAxisMove(cardTask()), '3g. designer atribuído pode mover (isDesignerAxisMove=true)');
{ const saved=state.user; state.user={id:'D2'}; const savedBoard=state.designerBoard; state.designerBoard=null;
  ok(!F.isDesignerAxisMove(cardTask()), '3h. outro designer NÃO move (isDesignerAxisMove=false)');
  ok(!F.isDesignerFlow(cardTask({designerAssignment:{}})), '3i. tarefa sem designer não concede eixo do designer');
  state.user=saved; state.designerBoard=savedBoard; }

/* ═══ 4) MOVIMENTAÇÃO — ramo isolado do moveStatus (fonte + replicação) ═══ */
const mv=grab(SRC,'moveStatus');
ok(mv.includes("if(secOf(t.sector).key==='edicao_cards'){"), '4a. moveStatus tem ramo ISOLADO para edicao_cards');
ok(mv.includes("status:(done?'concluido':newStatus)"), '4b. cards: t.status sincronizado em TODOS os 4 estados (corrige volta a "A Fazer")');
ok(!/edicao_cards[\s\S]{0,600}designerSla\.startedAt/.test(mv), '4c. cards: NÃO semeia designerSla.startedAt (notificação só via cardsRules)');
ok(mv.includes("pc['designerSla.finishedAt']=firebase.firestore.FieldValue.delete()"), '4d. reabrir limpa designerSla.finishedAt');
ok(mv.includes('pc.doneAt=firebase.firestore.FieldValue.delete()'), '4e. reabrir limpa doneAt (reativa o prazo)');
// replicação pura do ramo cards + verificação de status/doneAt
function cardsMove(t,newStatus){ const oc=F.designerCol(t); const done=(newStatus==='concluido'||newStatus==='entregue'); const leavingDone=(oc==='concluido')&&!done;
  t.designerFlowStatus=newStatus; t.designerWorkflowStage=newStatus; t.status=(done?'concluido':newStatus);
  if(done){t.doneAt=1;t.doneBy='D1';} else if(leavingDone){t.doneAt=undefined;t.doneBy=undefined; if(t.designerSla)t.designerSla.finishedAt=undefined;} return t; }
{ let t=cardTask(); cardsMove(t,'andamento'); eq(t.status,'andamento','4f. A Fazer→andamento sincroniza status'); cardsMove(t,'afazer'); eq(t.status,'afazer','4g. andamento→A Fazer sincroniza status (BUG CORRIGIDO)'); }
{ let t=cardTask({designerFlowStatus:'revisao',status:'revisao'}); cardsMove(t,'concluido'); eq(t.status,'concluido','4h. →Concluído: status'); ok(t.doneAt,'4i. →Concluído marca doneAt');
  cardsMove(t,'revisao'); eq(t.status,'revisao','4j. Concluído→Revisão: status'); ok(!t.doneAt,'4k. reabrir limpa doneAt'); }
// dados da tarefa NÃO se perdem ao mover
{ let t=cardTask(); const snap={tema:t.cardTema,leg:t.cardLegenda,obs:t.cardObs,sd:t.startDate,ed:t.endDate,as:t.assigneeId,cl:t.client};
  cardsMove(cardsMove(cardsMove(t,'andamento'),'revisao'),'afazer');
  ok(t.cardTema===snap.tema&&t.cardLegenda===snap.leg&&t.cardObs===snap.obs&&t.assigneeId===snap.as&&t.client===snap.cl,'4l. mover não perde tema/legenda/obs/designer/cliente'); }
// moveStatus ramo NÃO-cards inalterado (contém o bloco social original)
ok(mv.includes("if(newStatus==='andamento')patch.status='andamento';") && mv.includes("else if(newStatus==='concluido'||newStatus==='entregue'){patch.status='concluido';patch.doneAt=now;patch.doneBy=state.user.id;}"),
   '4m. ramo designer NÃO-cards preservado (byte a byte) abaixo do ramo isolado');
ok(mv.includes("firebase.firestore.FieldValue.arrayUnion({kind:'designer_moved'"), '4n. histórico canônico reutilizado (designer_moved: from/to/byId/at)');

/* ═══ 5) NOTIFICAÇÕES — cardsRules byte-idêntico + cancelar/reativar por status ═══ */
const cardsRules=require(resolve(ROOT,'src/main/cardsRules.js'));
const slaRules=require(resolve(ROOT,'src/main/slaRules.js'));
eq(readFileSync(resolve(ROOT,'src/main/cardsRules.js'),'utf8'), gitShow('desktop/src/main/cardsRules.js'), '5a. cardsRules.js BYTE-IDÊNTICO à 1.0.189');
eq(readFileSync(resolve(ROOT,'src/main/slaRules.js'),'utf8'), gitShow('desktop/src/main/slaRules.js'), '5b. slaRules.js BYTE-IDÊNTICO à 1.0.189');
eq(cardsRules.CARDS_WARN_MS, 30*60000, '5c. T-30 preservado (CARDS_WARN_MS=30min)');
eq(cardsRules.CARDS_RED_MS, 10*60000, '5d. T-10 preservado (CARDS_RED_MS=10min)');
// display state: amarela/vermelha por término
const dtMs=(d,t)=>{ if(!d)return 0; const[Y,M,D]=String(d).split('-').map(Number); const[h,mi]=String(t||'23:59').split(':').map(Number); return new Date(Y,(M||1)-1,D||1,h||0,mi||0,0,0).getTime(); };
const due='2026-08-01', dueT='16:00'; const finish=dtMs(due,dueT);
const nt=(over={})=>cardTask(Object.assign({dueDate:due,dueTime:dueT,due:due},over));
eq(cardsRules.cardsDisplayState(nt(),finish-20*60000,dtMs).sev,'laranja','5e. AMARELA em T-30 (due−20min dentro da janela)');
eq(cardsRules.cardsDisplayState(nt(),finish-5*60000,dtMs).sev,'vermelho','5f. VERMELHA em T-10 (due−5min)');
// concluir => slaPanelDelivered true => cardsRules suprime
{ const doneCard=nt({status:'concluido',doneAt:1}); ok(slaRules.slaPanelDelivered(doneCard),'5g. concluir => slaPanelDelivered=true');
  eq(cardsRules.cardsDisplayState(doneCard,finish-5*60000,dtMs).inPanel,false,'5h. concluído: cardsRules NÃO emite (alertas cancelados)'); }
// reabrir (status revisao, sem doneAt/finishedAt) => reativa
{ const reopened=nt({status:'revisao',designerFlowStatus:'revisao'}); ok(!slaRules.slaPanelDelivered(reopened),'5i. reabrir => slaPanelDelivered=false');
  eq(cardsRules.cardsDisplayState(reopened,finish-5*60000,dtMs).sev,'vermelho','5j. reaberto: cardsRules REATIVA o prazo (T-10)'); }
// destinatário: só o designer responsável
{ const em=cardsRules.cardsEmissionsFor(nt(),'D1',finish-5*60000,dtMs); ok(em.length===1&&/sla_cards_/.test(em[0].eventType||em[0].event||JSON.stringify(em[0])),'5k. emite 1 payload sla_cards_* ao designer'); }

/* ═══ 6) PRESERVAÇÃO — Card Premium + módulos + demais setores ═══ */
const slice=(s,sig)=>{const i=s.indexOf(sig); return i<0?null:s.slice(i,i+3000);};
for(const fn of ['isClientSector','ensureReviewToken','ensureStableClientReviewToken','buildShareClientUrl','buildClientMessage','canSendToClient','openSendClientModal'])
  ok(slice(SRC,'function '+fn)!==null && slice(SRC,'function '+fn)===slice(BASESRC,'function '+fn), '6. Card Premium — '+fn+' BYTE-IDÊNTICO');
for(const f of ['main.ts','notifier.ts','tray.ts','bgNotify.ts','slaScheduler.ts','firebase.ts','updaterService.ts'])
  ok((()=>{try{return readFileSync(resolve(ROOT,'src/main/'+f),'utf8')===gitShow('desktop/src/main/'+f);}catch(_){return false;}})(), '6. congelado '+f+' BYTE-IDÊNTICO');
// kbv2Card p/ setor não-cards: sem bloco de notas (a saída depende de s.key)
ok(kb.includes("if(s.key==='edicao_cards'){\n    const _cl") || kb.includes("if(s.key==='edicao_cards'){"), '6z. bloco de notas é gated por s.key (não-cards inalterado)');
// versão
eq(JSON.parse(readFileSync(resolve(ROOT,'package.json'),'utf8')).version,'1.0.190','6v. package.json version == 1.0.190');
// Android/Worker/Functions/Rules intactos
eq(execSync(`git diff --name-only ${BASE} -- . ':!desktop'`,{cwd:REPO}).toString().trim(),'','6w. NENHUM arquivo fora de desktop/ mudou (Android/Worker/Functions/Rules)');

console.log(`\nF3.5.2C — PASS=${PASS} FAIL=${FAIL}`);
if(FAIL){ console.error('\nFALHAS:\n - '+fails.join('\n - ')); process.exit(1); }
console.log('F3.5.2C — TODOS OS TESTES VERDES ✓');
