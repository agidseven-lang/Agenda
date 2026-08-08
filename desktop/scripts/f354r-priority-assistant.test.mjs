/**
 * F3.5.4R — f354r-priority-assistant.test.mjs
 * =====================================================================================
 * Testes do Assistente de Prioridades. Dirige o MOTOR PURO (src/renderer/priorityEngine.js)
 * com fatos sintéticos e verifica ESTATICAMENTE o isolamento read-only do painel no renderer
 * (src/renderer/index.html): sem escrita/notificação/som/transação dentro do bloco F3.5.4R,
 * deep-link por openDetails, feature flag, aba, ocorrências, estado vazio, offline, resumo.
 *
 * Proteção técnica (NÃO é prova física). Rode: node scripts/f354r-priority-assistant.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const PE = require(path.join(ROOT, "src/renderer/priorityEngine.js"));

let PASS = 0, FAIL = 0; const FAILS = [];
function ok(c, m){ if(c){ PASS++; } else { FAIL++; FAILS.push(m); console.error("  ✗ " + m); } }
function eq(a, b, m){ ok(JSON.stringify(a) === JSON.stringify(b), m + "  (got " + JSON.stringify(a) + ")"); }

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const NOW = 1000 * DAY;   // "agora" determinístico (sem Date.now)

// item builder — fatos sintéticos; `over` sobrescreve facts; `top` sobrescreve campos de topo.
function mk(taskId, over, top){
  const facts = Object.assign({
    nowMs: NOW, isCompleted:false, isGone:false, linked:true, col:'andamento',
    alert:null, alertText:'', deadlineMs:0, deadlineKind:'none', deadlineText:'', hasSla:false,
    changeRequestForMe:false, awaitingMyAction:false, awaitingText:'',
    helpForMe:null, blockedForMe:null, createdAtMs: NOW-10*DAY, updatedAtMs: NOW-1*DAY
  }, over||{});
  return Object.assign({ taskId, title:'T-'+taskId, client:'Cli', sector:'cronograma', etapaLabel:'Em andamento', responsibleName:'Ana', facts }, top||{});
}

// ══════════════════════ P) MOTOR — ELEGIBILIDADE ══════════════════════
ok(PE.isPriorityEligible(mk("t1")), "P01 tarefa vinculada em andamento é elegível");
ok(!PE.isPriorityEligible(mk("t2",{isCompleted:true})), "P02 concluída NÃO aparece");
ok(!PE.isPriorityEligible(mk("t3",{isGone:true})), "P03 removida/cancelada NÃO aparece");
ok(!PE.isPriorityEligible(mk("t4",{linked:false})), "P04 sem vínculo NÃO aparece");
ok(!PE.isPriorityEligible(mk("t5",{col:'concluido'})), "P05 col=concluído NÃO aparece");
ok(!PE.isPriorityEligible({taskId:""}), "P06 sem taskId NÃO aparece");

// ══════════════════════ P) MOTOR — NÍVEL (hierarquia ajustada do owner) ══════════════════════
eq(PE.resolvePriorityLevel(mk("r",{alert:'red'})), 1, "P07 vermelho ⇒ N1");
eq(PE.resolvePriorityLevel(mk("o",{deadlineKind:'overdue'})), 1, "P08 prazo vencido ⇒ N1");
eq(PE.resolvePriorityLevel(mk("a",{alert:'amber'})), 2, "P09 amarelo ⇒ N2");
eq(PE.resolvePriorityLevel(mk("h",{deadlineKind:'today'})), 2, "P10 termina hoje ⇒ N2");
eq(PE.resolvePriorityLevel(mk("c",{changeRequestForMe:true})), 2, "P11 alteração pendente ⇒ N2");
eq(PE.resolvePriorityLevel(mk("w",{awaitingMyAction:true,awaitingText:'Aguardando sua ação'})), 2, "P12 ação direcionada ⇒ N2");
eq(PE.resolvePriorityLevel(mk("n1",{col:'andamento'})), 3, "P13 andamento ⇒ N3");
eq(PE.resolvePriorityLevel(mk("n2",{col:'afazer'})), 3, "P14 A Fazer ⇒ N3");
eq(PE.resolvePriorityLevel(mk("n3",{col:'afazer',deadlineKind:'future',deadlineMs:NOW+5*DAY})), 3, "P15 futura ⇒ N3");
eq(PE.resolvePriorityLevel(mk("n4",{col:'afazer',deadlineKind:'none'})), 3, "P16 sem prazo ⇒ N3");
eq(PE.resolvePriorityLevel(mk("tm",{deadlineKind:'tomorrow',deadlineMs:NOW+DAY})), 3, "P17 amanhã (sem alerta) ⇒ N3 (não é hoje)");

// ══════════════════════ P) OCORRÊNCIAS NÃO ELEVAM NÍVEL SOZINHAS ══════════════════════
eq(PE.resolvePriorityLevel(mk("hp",{col:'andamento',helpForMe:{atMs:NOW-2*HOUR,fromName:'Bia'}})), 3,
   "P18 pedido de ajuda registrado, sem fato atual ⇒ permanece N3 (não sobe)");
eq(PE.resolvePriorityLevel(mk("bl",{col:'afazer',blockedForMe:{atMs:NOW-3*HOUR,reasonLabel:'Material'}})), 3,
   "P19 bloqueio reportado, sem fato atual ⇒ permanece N3 (não sobe)");
eq(PE.resolvePriorityLevel(mk("hpr",{alert:'red',helpForMe:{atMs:NOW-HOUR}})), 1,
   "P20 ajuda + vermelho atual ⇒ N1 (pelo fato atual, não pela ocorrência)");

// ══════════════════════ P) MOTIVOS — cada linha derivada de um dado; nunca só "Prioridade alta" ══════════════════════
{ const r = PE.resolvePriorityReasons(mk("m1",{alert:'red',alertText:'restam 10 min',col:'andamento'}));
  ok(r.some(x=>/Alerta vermelho ativo/.test(x)) && r.some(x=>/restam 10 min/.test(x)), "P21 motivo do vermelho com tempo");
  ok(r.some(x=>/Tarefa em andamento/.test(x)), "P22 motivo do andamento");
  ok(!r.some(x=>/^Prioridade alta$/.test(x)), "P23 nunca 'Prioridade alta' isolada"); }
ok(PE.resolvePriorityReasons(mk("m2",{deadlineKind:'overdue',deadlineText:'venceu ontem'})).some(x=>/Prazo vencido/.test(x)), "P24 motivo prazo vencido");
ok(PE.resolvePriorityReasons(mk("m3",{deadlineKind:'today',deadlineText:'hoje às 16h'})).some(x=>/Prazo termina hoje/.test(x)), "P25 motivo termina hoje");
ok(PE.resolvePriorityReasons(mk("m4",{deadlineKind:'tomorrow',deadlineText:'amanhã às 14h'})).some(x=>/Prazo amanhã/.test(x)), "P26 motivo amanhã");
ok(PE.resolvePriorityReasons(mk("m5",{changeRequestForMe:true})).some(x=>/Cliente solicitou alteração/.test(x)), "P27 motivo alteração");
ok(PE.resolvePriorityReasons(mk("m6",{awaitingMyAction:true,awaitingText:'Aguardando sua aprovação'})).some(x=>/Aguardando sua aprovação/.test(x)), "P28 motivo aprovação");
ok(PE.resolvePriorityReasons(mk("m7",{col:'afazer',deadlineKind:'none'})).some(x=>/Sem prazo definido/.test(x)), "P29 motivo sem prazo");
ok(PE.resolvePriorityReasons(mk("m8",{alert:'red',helpForMe:{atMs:NOW}})).some(x=>/Pedido de ajuda registrado/.test(x)), "P30 enriquecimento: ajuda registrada (honesto)");
ok(PE.resolvePriorityReasons(mk("m9",{alert:'red',blockedForMe:{atMs:NOW,reasonLabel:'Material'}})).some(x=>/Bloqueio reportado — Material/.test(x)), "P31 enriquecimento: bloqueio reportado (honesto)");
{ const r = PE.resolvePriorityReasons(mk("m10",{alert:'red'})); ok(!r.some(x=>/não resolvid|ainda ativ|bloqueada agora|pendente há/i.test(x)), "P32 nenhum texto afirma estado ativo/não resolvido"); }

// ══════════════════════ P) PRAZO determinístico ══════════════════════
eq(PE.resolvePriorityDeadline(mk("d1",{deadlineKind:'overdue',deadlineMs:NOW-DAY,deadlineText:'x'})), {ms:NOW-DAY,kind:'overdue',text:'x'}, "P33 resolvePriorityDeadline echo");
eq(PE.resolvePriorityDeadline(mk("d2",{deadlineKind:'zzz'})).kind, 'none', "P34 kind inválido ⇒ none");

// ══════════════════════ P) ORDENAÇÃO / DESEMPATE ══════════════════════
{ const list = PE.buildUserPriorityList([
    mk("A",{col:'afazer'}),                                   // N3
    mk("B",{alert:'amber'}),                                  // N2
    mk("C",{alert:'red'}),                                    // N1
    mk("D",{deadlineKind:'overdue',deadlineMs:NOW-DAY})       // N1
  ]);
  // C(vermelho sem prazo) e D(vencido) são N1; desempate #1 = prazo mais próximo ⇒ vencido antes.
  eq(list.map(x=>x.taskId), ["D","C","B","A"], "P35 ordem por nível (N1 acima de N2 acima de N3; desempate por prazo)"); }
{ const list = PE.buildUserPriorityList([
    mk("late",{deadlineKind:'today',deadlineMs:NOW+6*HOUR}),
    mk("early",{deadlineKind:'today',deadlineMs:NOW+1*HOUR})
  ]);
  eq(list.map(x=>x.taskId), ["early","late"], "P36 mesmo nível: prazo mais próximo primeiro"); }
{ const list = PE.buildUserPriorityList([
    mk("todo",{col:'afazer',deadlineKind:'future',deadlineMs:NOW+2*DAY}),
    mk("prog",{col:'andamento',deadlineKind:'future',deadlineMs:NOW+2*DAY})
  ]);
  eq(list.map(x=>x.taskId), ["prog","todo"], "P37 mesmo prazo: em andamento antes de A Fazer"); }
{ const list = PE.buildUserPriorityList([
    mk("newh",{col:'afazer',helpForMe:{atMs:NOW-1*HOUR}}),
    mk("oldh",{col:'afazer',helpForMe:{atMs:NOW-5*HOUR}})
  ]);
  eq(list.map(x=>x.taskId), ["oldh","newh"], "P38 desempate: pedido de ajuda mais antigo primeiro"); }
{ const list = PE.buildUserPriorityList([ mk("z1",{col:'afazer'}), mk("z2",{col:'afazer'}) ].map((it,i)=>{ it.facts.updatedAtMs=NOW-(i+1)*HOUR; it.facts.createdAtMs=NOW-10*DAY; return it; }));
  eq(list.map(x=>x.taskId), ["z2","z1"], "P39 desempate: atualização acionável mais antiga primeiro"); }
{ const a = PE.buildUserPriorityList([mk("k3"),mk("k1"),mk("k2")].map(it=>{it.facts.col='afazer';it.facts.createdAtMs=NOW-5*DAY;it.facts.updatedAtMs=NOW-5*DAY;return it;}));
  eq(a.map(x=>x.taskId), ["k1","k2","k3"], "P40 último desempate: taskId determinístico"); }

// ══════════════════════ P) ESTABILIDADE / DETERMINISMO ══════════════════════
{ const inp = ["q","w","e","r","t","y"].map(id=>mk(id,{alert:(id==='e'?'red':null),deadlineKind:(id==='r'?'today':'future'),deadlineMs:NOW+ (id.charCodeAt(0))*HOUR, col:(id==='w'?'afazer':'andamento')}));
  const a = PE.buildUserPriorityList(inp).map(x=>x.taskId);
  const b = PE.buildUserPriorityList(inp.slice().reverse()).map(x=>x.taskId);
  eq(a, b, "P41 mesma entrada (ordem de origem diferente) ⇒ MESMA ordem (estável/determinística)"); }
{ const inp=[mk("x1"),mk("x2",{isCompleted:true}),mk("x3")]; const before=JSON.stringify(inp);
  PE.buildUserPriorityList(inp); eq(JSON.stringify(inp), before, "P42 buildUserPriorityList NÃO muta a entrada"); }
{ const l = PE.buildUserPriorityList([mk("p1",{alert:'red'}),mk("p2",{col:'afazer'})]);
  eq([l[0].position,l[1].position], [1,2], "P43 posição 1..n atribuída"); ok(l[0].reasons.length>=1 && l[1].reasons.length>=1, "P44 toda tarefa tem ≥1 motivo"); }

// ══════════════════════ P) RESUMO ══════════════════════
{ const l = PE.buildUserPriorityList([mk("s1",{alert:'red',col:'andamento'}),mk("s2",{alert:'amber',col:'afazer'}),mk("s3",{deadlineKind:'today',deadlineMs:NOW+HOUR,col:'afazer'}),mk("s4",{col:'andamento'}),mk("s5",{col:'afazer'})]);
  const s = PE.summarize(l);
  eq([s.total,s.critical,s.attention,s.normal], [5,1,2,2], "P45 summarize níveis");
  eq([s.today,s.andamento,s.afazer], [1,2,3], "P46 summarize hoje/andamento/afazer"); }

// ══════════════════════ O) OCORRÊNCIAS ══════════════════════
{ const items=[ mk("o1",{helpForMe:{atMs:NOW-2*HOUR,fromName:'Bia'}}), mk("o2",{blockedForMe:{atMs:NOW-1*HOUR,reasonLabel:'Material'}}), mk("o3",{}) ];
  const occ = PE.buildOccurrences(items, {});
  eq(occ.length, 2, "O01 só itens com ajuda/bloqueio viram ocorrência");
  eq(occ.map(x=>x.taskId), ["o2","o1"], "O02 ordenadas por horário desc");
  ok(occ.every(x=>!/não resolvid|ativo agora|continua/i.test(x.text)), "O03 texto honesto (sem 'ativo/não resolvido')");
  ok(occ.find(x=>x.kind==='help').text==='Pedido de ajuda registrado', "O04 ajuda: 'registrado'");
  ok(/Bloqueio reportado/.test(occ.find(x=>x.kind==='blocked').text), "O05 bloqueio: 'reportado'"); }
{ const items=[ mk("o4",{helpForMe:{atMs:NOW-2*HOUR}}) ]; const occ=PE.buildOccurrences(items,{});
  const dz={}; dz[occ[0].key]=1; eq(PE.buildOccurrences(items,dz).length, 0, "O06 'dispensar' local oculta a ocorrência (preferência visual)"); }
ok(PE.buildOccurrences([mk("o5",{isGone:true,helpForMe:{atMs:NOW}})],{}).length===0, "O07 tarefa removida não gera ocorrência");
ok(PE.buildOccurrences([mk("o6",{})],{}).length===0, "O08 sem ajuda/bloqueio ⇒ nenhuma ocorrência (não inventa)");

// ══════════════════════ D) PUREZA DO MOTOR (sem escrita/electron/firestore/notificação) ══════════════════════
const engSrc = fs.readFileSync(path.join(ROOT,"src/renderer/priorityEngine.js"),"utf8");
ok(!/\brequire\s*\(\s*['"]electron['"]/.test(engSrc), "D01 engine não importa electron");
ok(!/firestore|runTransaction|arrayUnion|\.collection\(|\.doc\(|\.update\(|\.set\(|\.add\(/.test(engSrc), "D02 engine não escreve/lê Firestore");
ok(!/ipcRenderer|ipcMain|new Notification|\.play\(|Date\.now|Math\.random/.test(engSrc), "D03 engine sem IPC/Notification/som/Date.now/random");
ok(/module\.exports|PriorityEngine/.test(engSrc), "D04 engine é UMD (node + renderer)");

// ══════════════════════ S) ISOLAMENTO DO PAINEL NO RENDERER (estático) ══════════════════════
const idx = fs.readFileSync(path.join(ROOT,"src/renderer/index.html"),"utf8").replace(/\r\n/g,"\n");
// bloco F3.5.4R delimitado por marcadores — nada de escrita/notificação/som dentro dele
const blocks = idx.split(/\/\* F3\.5\.4R:START\b/).slice(1).map(s=>s.split(/\/\* F3\.5\.4R:END \*\//)[0]);
ok(blocks.length>=1, "S01 bloco F3.5.4R:START/END presente no index.html");
const blob = blocks.join("\n");
ok(blob.length>0, "S02 bloco F3.5.4R não vazio");
ok(!/runTransaction|arrayUnion|firebase\.firestore\.FieldValue|\.doc\([^)]*\)\.(update|set|delete)\(|db\.collection\([^)]*\)\.(add|doc)\([^)]*\)\.(set|update|delete)/.test(blob), "S03 painel NÃO escreve no Firestore");
ok(!/moveStatus\(|__slaPersistDecision|__idlePersistResponse|slaAck|ackReminder|resolveHelp/.test(blob), "S04 painel NÃO chama movimentação/decisão/ack/resolveHelp");
ok(!/new Notification|showBgNotify|notif-toast|\.play\(|new Audio/.test(blob), "S05 painel NÃO emite notificação nem toca som");
ok(/openDetails\(/.test(blob), "S06 painel abre a tarefa por openDetails (deep-link existente)");
ok(/priorityAssistantEnabled/.test(blob), "S07 feature flag priorityAssistantEnabled presente");
ok(/window\.PriorityEngine|PriorityEngine\./.test(blob), "S08 painel usa o motor puro PriorityEngine");
ok(/Ações e ocorrências recentes/.test(blob), "S09 seção 'Ações e ocorrências recentes'");
ok(/Tudo certo por aqui/.test(blob), "S10 estado vazio honesto");
ok(/(sem conex|desatualizad)/i.test(blob), "S11 aviso de modo offline");
ok(/function renderPrioridades\(/.test(blob) && /function priBuildItems\(/.test(blob), "S12 renderPrioridades + priBuildItems presentes");
// hooks fora do bloco (aba + dispatch + toggle + script)
ok(/<script src="priorityEngine\.js"><\/script>/.test(idx), "S13 priorityEngine.js carregado no index.html");
ok(/\bk:'prioridades'/.test(idx), "S14 aba 'prioridades' registrada em TABS");
ok(/state\.tab==='prioridades'/.test(idx), "S15 render() despacha a aba 'prioridades'");
ok(/data-cfgpriorityassistant/.test(idx), "S16 toggle da flag em Configurações");
// não cria novo listener de DADOS nem scheduler de SLA (o tick de UI é permitido: o app já usa 1s p/ contador de SLA)
ok(!/onSnapshot\(|db\.collection\(|firebase\.firestore\(\)\.collection/.test(blob), "S17 painel NÃO cria listener de dados próprio (reutiliza o onSnapshot existente)");
ok(!/slaScheduler|scheduleSla|slaTick\(|__slaSchedule|new SlaReminder|showSlaReminder/.test(blob), "S17b painel NÃO cria/aciona scheduler de SLA nem lembrete");
ok(/NÃO é listener de dados nem scheduler de SLA/.test(blob), "S17c tick de UI documentado como refresh-only (não-listener, não-scheduler)");
// S18 — GATE DE SINTAXE do <script> inline do renderer: um erro de sintaxe aqui aborta TODO o app.
//        (o F3.5.4R adiciona muito JS inline; esta prova impede publicar um renderer que não carrega).
(function(){
  // RE-PINADO F3.5.6A — desde a 1.0.221 existe um bloco PRÓPRIO de guarda de boot (F3.5.5C-H1)
  // entre a tag do priorityEngine e o script principal; o localizador antigo parava nele
  // (1.2KB) e o gate de sintaxe deixava de cobrir o app. Âncora nova: o marcador REAL do
  // script principal ('WEB PREVIEW'), com fallback para o comportamento antigo.
  var sMark='\n<script>\n';
  var _mainMark=idx.indexOf('/* WEB PREVIEW');
  var open=(_mainMark>=0)?idx.lastIndexOf(sMark,_mainMark):idx.indexOf(sMark, idx.indexOf('priorityEngine.js'));
  var close=open>=0?idx.indexOf('\n</script>', open):-1;
  var inline=(open>=0&&close>open)?idx.slice(open+sMark.length, close):'';
  ok(inline.length>50000, "S18a <script> inline principal do renderer localizado");
  var syntaxOk=false, err='';
  try{ new Function(inline); syntaxOk=true; }catch(e){ err=String(e&&e.message||e); }
  ok(syntaxOk, "S18b <script> inline do renderer tem sintaxe JS válida"+(syntaxOk?'':' — '+err));
})();
// S19 — as referências ao helper priTabVisible fora do bloco (sidebar/nav) NÃO podem ser bareword
//        (o harness f33L extrai o bloco nav.innerHTML e injeta um conjunto FIXO de helpers).
ok(!/TABS\.filter\(priTabVisible\)/.test(idx), "S19 filtro de abas usa guarda typeof (não quebra extração isolada do nav)");

// ══════════════════════ B) BENCHMARK 100/500/1k/5k ══════════════════════
function bench(n){
  const items = [];
  for(let i=0;i<n;i++){
    const mod=i%7;
    items.push(mk("b"+i,{
      col: mod===0?'afazer':(mod===1?'revisao':'andamento'),
      alert: mod===2?'red':(mod===3?'amber':null),
      deadlineKind: mod===4?'overdue':(mod===5?'today':'future'),
      deadlineMs: NOW + (i%50)*HOUR - (mod===4?2*DAY:0),
      helpForMe: mod===6?{atMs:NOW-(i%9)*HOUR}:null,
      createdAtMs: NOW-(i%30)*DAY, updatedAtMs: NOW-(i%20)*HOUR
    }));
  }
  const t0=process.hrtime.bigint();
  const list = PE.buildUserPriorityList(items);
  PE.summarize(list); PE.buildOccurrences(items,{});
  const ms = Number(process.hrtime.bigint()-t0)/1e6;
  return { ms, count:list.length };
}
[100,500,1000,5000].forEach((n,i)=>{
  const r = bench(n);
  ok(r.count===n, "B0"+(i+1)+" benchmark "+n+" tarefas: todas classificadas ("+r.count+")");
  ok(r.ms < 1500, "B0"+(i+5)+" benchmark "+n+" < 1500ms (levou "+r.ms.toFixed(1)+"ms)");
});
// determinismo do benchmark (mesma entrada ⇒ mesma ordem)
{ const a=bench(500), b=bench(500); ok(a.count===b.count, "B09 benchmark determinístico"); }

// ── resumo ──
console.log("\nF3.5.4R — priority-assistant: " + PASS + " passed / " + FAIL + " failed");
if(FAIL){ console.error("FAILURES:\n - " + FAILS.join("\n - ")); process.exit(1); }
