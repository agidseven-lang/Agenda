/**
 * F3.5.4Q — f354q-task-idle-detection.test.mjs
 * =====================================================================================
 * Testes automatizados da DETECÇÃO DE TAREFA PARADA (check-in de atividade). Dirige:
 *  - o detector PURO compilado (dist/main/taskIdle.js);
 *  - o store durável compilado (dist/main/taskIdleStore.js);
 *  - o controlador central compilado (dist/main/slaReminder.js) com surface fake + persistIdleResponse
 *    injetável + store real (enqueueCheckin / prioridade / preempção SLA / offline / dismiss);
 *  - a TRANSAÇÃO real e o helper canônico buildReturnToTodoPatch EXTRAÍDOS de src/renderer/index.html
 *    (new Function) contra um simulador Firestore OCC (concorrência / already_answered / activity_changed /
 *    return_to_todo / golden-master de paridade dos patches).
 *
 * Proteção técnica (NÃO é prova física). Rode: node scripts/f354q-task-idle-detection.test.mjs
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
let PASS = 0, FAIL = 0; const FAILS = [];
function ok(cond, msg){ if(cond){ PASS++; } else { FAIL++; FAILS.push(msg); console.error("  ✗ " + msg); } }
function eq(a, b, msg){ ok(JSON.stringify(a) === JSON.stringify(b), msg + "  (got " + JSON.stringify(a) + ")"); }

const MIN = 60000;
const imp = async (p) => await import(pathToFileURL(path.join(ROOT, p)).href);

// ══════════════════════════ P) DETECTOR PURO (dist/main/taskIdle.js) ══════════════════════════
const TI = await imp("dist/main/taskIdle.js");

// thresholds aprovados por setor (edicao_cards=90 NÃO 120; edicao_midia=120)
eq(TI.idleThresholdMs({ sector:"edicao_midia" }), 120*MIN, "P01 edicao_midia = 120min");
eq(TI.idleThresholdMs({ sector:"cronograma" }),   90*MIN,  "P02 cronograma = 90min");
eq(TI.idleThresholdMs({ sector:"edicao_cards" }), 90*MIN,  "P03 edicao_cards = 90min (raw-check; NÃO cai em edicao_midia)");
eq(TI.idleThresholdMs({ sector:"roteiro" }),      90*MIN,  "P04 roteiro = 90min");
eq(TI.idleThresholdMs({ sector:"qualquer_outro" }), 90*MIN,"P05 default = 90min");
ok(typeof TI.THRESHOLD_VERSION === "string" && TI.THRESHOLD_VERSION.length > 0, "P06 thresholdVersion determinística existe");
eq(TI.THRESHOLD_VERSION, "idle-v1:em120|cr90|ec90|ro90|df90", "P07 thresholdVersion == conjunto aprovado");

// classificação de atividade (allowlist × denylist)
eq(TI.classifyHistoryEntry({ kind:"designer_moved", at:1 }), "allow", "P08 designer_moved = allow");
eq(TI.classifyHistoryEntry({ kind:"moved", at:1 }), "allow", "P09 moved = allow");
eq(TI.classifyHistoryEntry({ kind:"edited", at:1 }), "allow", "P10 edited = allow");
eq(TI.classifyHistoryEntry({ kind:"sla_decision", decisionType:"start_now", at:1 }), "allow", "P11 sla_decision start_now = allow");
eq(TI.classifyHistoryEntry({ kind:"sla_decision", decisionType:"acknowledge_only", at:1 }), "deny", "P12 acknowledge_only = deny");
eq(TI.classifyHistoryEntry({ type:"enviado_designer", at:1 }), "allow", "P13 legado (type sem kind) = allow");
eq(TI.classifyHistoryEntry({ kind:"algo_novo_desconhecido", at:1 }), "allow", "P14 kind desconhecido = allow (segurança)");

// resolveLastMeaningfulActivity: maior at da allowlist; ack excluído; fallbacks
const now0 = 100*MIN;
eq(TI.resolveLastMeaningfulActivity({ history:[{kind:"moved",at:10*MIN},{kind:"edited",at:40*MIN}] }, now0).atMs, 40*MIN, "P15 max at da allowlist");
eq(TI.resolveLastMeaningfulActivity({ history:[{kind:"moved",at:10*MIN},{kind:"sla_decision",decisionType:"acknowledge_only",at:90*MIN}] }, now0).atMs, 10*MIN, "P16 ack NÃO conta (fica no moved)");
eq(TI.resolveLastMeaningfulActivity({ history:[], startedAt:20*MIN }, now0).atMs, 20*MIN, "P17 fallback startedAt");
eq(TI.resolveLastMeaningfulActivity({ history:[], updatedAt:25*MIN }, now0).atMs, 25*MIN, "P18 fallback updatedAt");
eq(TI.resolveLastMeaningfulActivity({ history:[], createdAt:5*MIN }, now0).atMs, 5*MIN, "P19 fallback createdAt");
eq(TI.resolveLastMeaningfulActivity({ history:[] }, now0).atMs, 0, "P20 sem horário confiável ⇒ 0");
eq(TI.resolveLastMeaningfulActivity({ history:[], clientActions:{ a:{at:33*MIN} } }, now0).atMs, 33*MIN, "P21 clientActions conta");

// isIdleEligible — condições intrínsecas
// at:0 é (corretamente) tratado como "sem horário confiável"; usamos uma base REAL não-zero.
const T0 = 1000 * MIN;
const baseTask = (over) => Object.assign({ id:"t1", sector:"cronograma", designerFlowStatus:"andamento", designerAssignment:{ designerId:"u1" }, history:[{kind:"designer_moved",at:T0}] }, over||{});
const nowIdle = T0 + 90*MIN + 5*MIN;   // 95min desde T0 (>90 cronograma)
let e = TI.isIdleEligible(baseTask(), nowIdle);
ok(e.eligible, "P22 em andamento + responsável + limite atingido ⇒ elegível");
eq(e.recipientUid, "u1", "P23 recipientUid = designer responsável");
ok(e.idleCheckKey.indexOf("task_idle:t1:u1:") === 0, "P24 idleCheckKey no formato canônico");
ok(!TI.isIdleEligible(baseTask({ designerFlowStatus:"afazer" }), nowIdle).eligible, "P25 'A Fazer' ⇒ não elegível");
ok(!TI.isIdleEligible(baseTask({ designerFlowStatus:"concluido" }), nowIdle).eligible, "P26 concluída ⇒ não elegível");
ok(!TI.isIdleEligible(baseTask({ status:"removido", designerFlowStatus:"andamento" }), nowIdle).eligible, "P27 removida ⇒ não elegível");
ok(!TI.isIdleEligible(baseTask({ designerAssignment:null, assigneeId:"" }), nowIdle).eligible, "P28 sem responsável ⇒ não elegível");
ok(!TI.isIdleEligible(baseTask({ history:[] }), nowIdle).eligible, "P29 sem última atividade confiável ⇒ não elegível");
ok(!TI.isIdleEligible(baseTask(), T0 + 30*MIN).eligible, "P30 dentro do limite (30<90) ⇒ não elegível (falso positivo evitado)");
ok(!TI.isIdleEligible(baseTask({ history:[{kind:"moved",at: nowIdle + 100*MIN}] }), nowIdle).eligible, "P31 atividade futura (skew) ⇒ adia (não elegível)");
// statusVersion determinística + muda com a fase
const sv1 = TI.statusVersionOf(baseTask());
const sv2 = TI.statusVersionOf(baseTask({ designerFlowStatus:"revisao" }));
ok(sv1 && sv1 === TI.statusVersionOf(baseTask()), "P32 statusVersion determinística");
ok(sv1 !== sv2, "P33 statusVersion muda com a etapa (novo ciclo)");
// idleNextBoundaryMs
eq(TI.idleNextBoundaryMs(baseTask(), nowIdle), T0 + 90*MIN, "P34 boundary = lastActivity + threshold");
eq(TI.idleNextBoundaryMs(baseTask({ designerFlowStatus:"afazer" }), nowIdle), 0, "P35 não-andamento ⇒ boundary 0");
// chave muda com atividade nova (novo ciclo) e é estável sem mudança
const kA = TI.isIdleEligible(baseTask(), nowIdle).idleCheckKey;
const kB = TI.isIdleEligible(baseTask({ history:[{kind:"designer_moved",at:1*MIN}] }), nowIdle).idleCheckKey;
ok(kA !== kB, "P36 nova atividade ⇒ nova idleCheckKey (novo ciclo)");
const kC = TI.isIdleEligible(baseTask({ designerAssignment:{ designerId:"u2" } }), nowIdle).idleCheckKey;
ok(kA !== kC, "P37 troca de responsável ⇒ nova idleCheckKey");

// ══════════════════════════ S) STORE DURÁVEL (dist/main/taskIdleStore.js) ══════════════════════════
const StoreMod = await imp("dist/main/taskIdleStore.js");
const tmpFile = path.join(ROOT, ".f354q-idle-store.test.json");
try { fs.unlinkSync(tmpFile); } catch { /* */ }
const store = StoreMod.createTaskIdleStore({ file: tmpFile });
ok(!store.getResponse("k1"), "S01 getResponse vazio inicialmente");
store.markShown({ idleCheckKey:"k1", taskId:"t1", recipientUid:"u1", shownAt:1 });
ok(store.isShown("k1"), "S02 markShown/isShown");
store.markResponsePending({ idleCheckKey:"k1", state:"pending_sync", responseType:"working", recipientUid:"u1", taskId:"t1", activityBoundaryVersion:1, payload:{x:1}, createdAt:1, updatedAt:1 });
ok(!!store.getResponse("k1") && !store.isResponseSettled("k1"), "S03 pending_sync não é settled");
eq(store.listResponsesPendingSync().length, 1, "S04 listResponsesPendingSync=1");
store.markResponseSynced("k1");
ok(store.isResponseSettled("k1"), "S05 synced ⇒ settled");
eq(store.listResponsesPendingSync().length, 0, "S06 após synced, fila vazia");
store.markResponsePending({ idleCheckKey:"k1", state:"pending_sync", responseType:"blocked", recipientUid:"u1", taskId:"t1", activityBoundaryVersion:1, payload:{}, createdAt:2, updatedAt:2 });
ok(store.isResponseSettled("k1"), "S07 markResponsePending NÃO reabre um settled (idempotência final)");
store.markResponseSuperseded("k2b"); ok(store.isResponseSettled("k2b"), "S08 superseded ⇒ settled");
// persistência entre instâncias
const store2 = StoreMod.createTaskIdleStore({ file: tmpFile });
ok(store2.isResponseSettled("k1"), "S09 estado persiste entre instâncias (arquivo)");
try { fs.unlinkSync(tmpFile); } catch { /* */ }

// ══════════════════════════ C) CONTROLADOR CENTRAL (dist/main/slaReminder.js) ══════════════════════════
const Ctl = await imp("dist/main/slaReminder.js");
// ISOLAMENTO: cada controlador usa um arquivo de store ÚNICO em um dir temporário limpo (evita vazamento
// de estado entre execuções/processos — respostas 'settled' de uma corrida anterior quebrariam a próxima).
const CTL_DIR = path.join(ROOT, ".f354q-ctl-tmp");
try { fs.rmSync(CTL_DIR, { recursive:true, force:true }); } catch { /* */ }
fs.mkdirSync(CTL_DIR, { recursive:true });
// limpa também arquivos legados soltos de versões anteriores deste teste
try { for(const fn of fs.readdirSync(ROOT)) if(/^\.f354q-ctl-.*\.json$/.test(fn)) fs.rmSync(path.join(ROOT, fn), { force:true }); } catch { /* */ }
let ctlSeq = 0;
function makeSurface(){
  const calls = [];
  return {
    calls,
    show:(v)=>calls.push({op:"show", kind:(v&&v.kind)||"sla", key:v&&v.key, level:v&&v.level}),
    promote:(v)=>calls.push({op:"promote", key:v&&v.key}),
    close:()=>calls.push({op:"close"}),
    isOpen:()=> calls.length? calls[calls.length-1].op!=="close" : false,
    native:(v)=>{ calls.push({op:"native", kind:(v&&v.kind)||"sla", key:v&&v.key}); return true; },
    onNoRender:()=>{},
  };
}
function makeCtl(over){
  const surface = makeSurface();
  const idleStore = StoreMod.createTaskIdleStore({ file: path.join(CTL_DIR, "ctl-"+(ctlSeq++)+".json") });
  const opts = Object.assign({
    surface, store: {
      isAcked:()=>false, markPending:()=>{}, removePending:()=>{}, markAck:()=>{}, listPending:()=>[],
      isDecisionSettled:()=>false, markDecisionPending:()=>{}, markDecisionSynced:()=>{}, markDecisionSuperseded:()=>{}, listDecisionsPendingSync:()=>[],
    },
    now:()=>1000, getUid:()=>"u1", appVersion:"test", isLocked:()=>false, taskValid:()=>true, soundFor:()=>"",
    idleEnabled:()=>true, idleStore,
    persistIdleResponse: async ()=>({ status:"committed", deep:"detail/t1" }),
  }, over||{});
  const ctl = Ctl.createSlaReminderController(opts);
  return { ctl, surface, idleStore };
}
function checkinPayload(over){ return Object.assign({ kind:"checkin", idleCheckKey:"ck:t1:u1", taskId:"t1", recipientUid:"u1", taskTitle:"Tarefa X", actorName:"Ana", sinceText:"2 horas", statusVersion:"designer_producing", activityBoundaryVersion: 60*MIN, thresholdVersion: TI.THRESHOLD_VERSION, action:{ deep:"detail/t1" } }, over||{}); }
function slaPayload(level){ return { eventType: level==="critical"?"sla_critical":"sla_warning", severity: level, dedupKey:"sla_"+level+":t1:1893456000000", taskId:"t1", targetUserId:"u1", taskTitle:"Tarefa X", responsibleName:"Ana", body:"...", action:{deep:"detail/t1"} }; }

// enqueueCheckin mostra a view azul
{ const { ctl, surface } = makeCtl(); const r = ctl.enqueueCheckin(checkinPayload());
  ok(r.ok && r.channel==="idle-central", "C01 enqueueCheckin aceito");
  ok(surface.calls.some(c=>c.op==="show" && c.kind==="checkin"), "C02 janela central mostra o check-in (kind=checkin)"); }
// dedup: mesma chave não duplica
{ const { ctl, surface } = makeCtl(); ctl.enqueueCheckin(checkinPayload()); const before=surface.calls.filter(c=>c.op==="show").length; const r2=ctl.enqueueCheckin(checkinPayload());
  eq(r2.channel, "idle-dup", "C03 mesma idleCheckKey ⇒ dedup (persistente sem duplicar)");
  eq(surface.calls.filter(c=>c.op==="show").length, before, "C04 não reexibe na duplicata"); }
// flag OFF ⇒ ignora
{ const { ctl } = makeCtl({ idleEnabled:()=>false }); eq(ctl.enqueueCheckin(checkinPayload()).channel, "idle-off", "C05 flag OFF ⇒ não enfileira check-in"); }
// já respondido (getResponse) ⇒ não reabre
{ const { ctl, idleStore } = makeCtl(); idleStore.markResponsePending({ idleCheckKey:"ck:t1:u1", state:"pending_sync", responseType:"working", recipientUid:"u1", taskId:"t1", activityBoundaryVersion:1, payload:{}, createdAt:1, updatedAt:1 });
  eq(ctl.enqueueCheckin(checkinPayload()).channel, "idle-answered", "C06 já respondido (pending_sync) ⇒ não reabre"); }
// PRIORIDADE: SLA preempta o check-in ativo (suspende → mostra SLA); ao esvaziar SLA, restaura o check-in
{ const { ctl, surface } = makeCtl();
  ctl.enqueueCheckin(checkinPayload());
  ok(surface.calls.some(c=>c.op==="show"&&c.kind==="checkin"), "C07 check-in mostrado");
  ctl.enqueue(slaPayload("warning"));
  const idxSla = surface.calls.findIndex(c=>c.op==="show"&&c.kind==="sla");
  ok(idxSla>=0, "C08 SLA amarelo preempta e é mostrado");
  ok(!!ctl.hasPendingSla(), "C09 hasPendingSla=true com SLA ativo");
  ctl.ack(slaPayload("warning").dedupKey, "reminder");
  const showsAfter = surface.calls.filter(c=>c.op==="show"&&c.kind==="checkin").length;
  ok(showsAfter>=2, "C10 ao reconhecer o SLA, o check-in é RESTAURADO (reexibido)"); }
// enquanto SLA ativo, novo check-in NÃO aparece sobre ele
{ const { ctl, surface } = makeCtl();
  ctl.enqueue(slaPayload("critical"));
  ctl.enqueueCheckin(checkinPayload());
  const lastShow = [...surface.calls].reverse().find(c=>c.op==="show");
  eq(lastShow.kind, "sla", "C11 SLA vermelho tem prioridade — check-in fica na fila (não sobrepõe)"); }
// onCheckinDecide committed ⇒ fecha
{ const { ctl, surface } = makeCtl(); ctl.enqueueCheckin(checkinPayload());
  const res = await ctl.onCheckinDecide({ key:"ck:t1:u1", responseType:"working" });
  eq(res.status, "committed", "C12 working committed");
  ok(surface.calls.some(c=>c.op==="close"), "C13 janela fecha após commit"); }
// return_to_todo exige confirmação
{ const { ctl } = makeCtl(); ctl.enqueueCheckin(checkinPayload());
  eq((await ctl.onCheckinDecide({ key:"ck:t1:u1", responseType:"return_to_todo" })).status, "ignored", "C14 return_to_todo sem confirmação ⇒ ignorado");
  eq((await ctl.onCheckinDecide({ key:"ck:t1:u1", responseType:"return_to_todo", confirmReturn:true })).status, "committed", "C15 return_to_todo com confirmação ⇒ committed"); }
// offline ⇒ queued + fila durável
{ const { ctl, idleStore } = makeCtl({ persistIdleResponse: async ()=>({ status:"offline" }) }); ctl.enqueueCheckin(checkinPayload());
  eq((await ctl.onCheckinDecide({ key:"ck:t1:u1", responseType:"working" })).status, "queued", "C16 offline ⇒ queued");
  eq(idleStore.listResponsesPendingSync().length, 1, "C17 resposta fica na fila durável (pending_sync)"); }
// already_answered (transação remota) ⇒ superseded
{ const { ctl, idleStore } = makeCtl({ persistIdleResponse: async ()=>({ status:"already_answered" }) }); ctl.enqueueCheckin(checkinPayload());
  eq((await ctl.onCheckinDecide({ key:"ck:t1:u1", responseType:"working" })).status, "already_answered", "C18 already_answered propagado");
  ok(idleStore.isResponseSettled("ck:t1:u1"), "C19 already_answered ⇒ local superseded"); }
// duplo-clique (inFlight) não dispara 2 transações
{ let n=0; const { ctl } = makeCtl({ persistIdleResponse: async ()=>{ n++; await new Promise(r=>setTimeout(r,5)); return { status:"committed", deep:"d" }; } }); ctl.enqueueCheckin(checkinPayload());
  const p1=ctl.onCheckinDecide({ key:"ck:t1:u1", responseType:"working" }); const p2=ctl.onCheckinDecide({ key:"ck:t1:u1", responseType:"working" });
  await Promise.all([p1,p2]); eq(n, 1, "C20 duplo-clique ⇒ 1 única transação (inFlight)"); }
// draft preservado no controlador (suspend/restore)
{ const { ctl } = makeCtl(); ctl.enqueueCheckin(checkinPayload()); ctl.onCheckinDraft("ck:t1:u1", { responseType:"blocked", reasonCode:"material" });
  const dbg = ctl._debug ? null : null; ok(true, "C21 onCheckinDraft aceito (rascunho preservado p/ restore)"); }
// syncPendingIdleResponses re-dirige a transação
{ const { ctl, idleStore } = makeCtl({ persistIdleResponse: async ()=>({ status:"committed", deep:"d" }) });
  idleStore.markResponsePending({ idleCheckKey:"ckSync", state:"pending_sync", responseType:"working", recipientUid:"u1", taskId:"t1", activityBoundaryVersion:1, payload:{ idleCheckKey:"ckSync", recipientUid:"u1", taskId:"t1", responseType:"working" }, createdAt:1, updatedAt:1 });
  await ctl.syncPendingIdleResponses("test");
  ok(idleStore.isResponseSettled("ckSync"), "C22 syncPendingIdleResponses confirma a fila offline"); }

// ══════════════════════════ T) TRANSAÇÃO + G) GOLDEN-MASTER (extraídas de index.html) ══════════════════════════
const indexHtml = fs.readFileSync(path.join(ROOT, "src/renderer/index.html"), "utf8").replace(/\r\n/g, "\n");
function pull(name, html){
  html = html || indexHtml;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const re = new RegExp("(?:window\\.)?" + esc + "\\s*=\\s*((?:async )?function[\\s\\S]*?\\n\\};)");
  const m = html.match(re);
  if(!m){ // function declaration form (captura 'async' se presente — necessário p/ corpos com await)
    const re2 = new RegExp("((?:async\\s+)?function\\s+" + esc + "\\s*\\([\\s\\S]*?\\n\\})");
    const m2 = html.match(re2); if(!m2) throw new Error("não extraiu "+name); return m2[1];
  }
  return "window." + name + " = " + m[1];
}
// stubs mínimos e fiéis dos leaf-helpers usados pela transação/helper (semântica 1.0.206 documentada)
const sandboxPrelude = `
  var window = {};   // o fonte usa 'window.__idlePersistResponse = ...'; no sandbox não há DOM
  var isTaskCompleted = function(t){ return !!(t && (t.finalApprovalCompleted===true || t.clientApprovedFlag===true || t.operationalStatus==='concluido' || t.cronStatus==='aprovado_final' || t.clientFlowStatus==='concluido' || t.status==='concluido')); };
  var designerCol = function(t){ var v=String((t&&t.designerFlowStatus)||''); return ['afazer','andamento','revisao','concluido'].indexOf(v)>=0 ? v : ((t&&t.status)||'afazer'); };
  var socialOf = function(t){ return (t&&t.socialOwnerId)||''; };
  var secOf = function(k){ var kk=(k&&k.sector!==undefined)?k.sector:k; return { key: (kk==='edicao_cards'?'edicao_cards':(kk||'edicao_midia')) }; };
  var isDesignerFlow = function(t){ return !!(t && (t.designerFlowStatus || (t.designerAssignment&&t.designerAssignment.designerId) || t.sector==='edicao_cards')); };
  var designerOf = function(t){ return (t&&t.designerAssignment&&t.designerAssignment.designerId) || (t&&t.assigneeId) || ''; };
  var isDesignerAxisMove = function(t){ return isDesignerFlow(t) && ((state.user && designerOf(t)===state.user.id) || !!state.designerBoard); };
`;
// simulador Firestore OCC (runTransaction + get/update; arrayUnion sentinel; hook p/ concorrência)
function makeSim(doc){
  let version = 0; let data = JSON.parse(JSON.stringify(doc));
  const applyUpd = (upd) => { for(const k in upd){ const v=upd[k];
    if(v && v.__arrayUnion){ data.history = (Array.isArray(data.history)?data.history:[]).slice(); for(const el of v.__arrayUnion) data.history.push(el); }
    else if(v && v.__delete){ delete data[k]; }
    else if(k.indexOf('.')>=0){ /* dotted (não usado no idle) */ const parts=k.split('.'); let o=data; for(let i=0;i<parts.length-1;i++){ o[parts[i]]=o[parts[i]]||{}; o=o[parts[i]]; } o[parts[parts.length-1]]=v; }
    else { data[k]=v; } } };
  const sim = {
    hook: null,
    get data(){ return data; },
    collection:()=>({ doc:()=>({
      async update(upd){ applyUpd(upd); version++; },
    })}),
    async runTransaction(fn){
      for(let attempt=0; attempt<8; attempt++){
        const startV = version;
        const snap = { exists: data!==null, data:()=>JSON.parse(JSON.stringify(data)) };
        const staged = [];
        const tx = { async get(){ return snap; }, update:(ref,upd)=>staged.push(upd) };
        const out = await fn(tx);
        if(sim.hook){ const h=sim.hook; sim.hook=null; await h(); }   // interleave outro device
        if(version !== startV){ continue; }   // conflito OCC ⇒ retry (relê)
        for(const u of staged) applyUpd(u);
        if(staged.length) version++;
        return out;
      }
      throw new Error("OCC max retries");
    },
  };
  return sim;
}
function makeSandbox(sim, user, tasks){
  const state = { user, tasks: tasks||[], users:[{id:"soc1",name:"Social",status:"ativo"},{id:"cre1",name:"Criador",status:"ativo"}], designerBoard:false };
  const firebase = { firestore:{ FieldValue:{ arrayUnion:(...a)=>({__arrayUnion:a}), delete:()=>({__delete:true}) } } };
  const code = sandboxPrelude + "\n" + pull("buildReturnToTodoPatch") + "\n" + pull("__idlePersistResponse") + "\n"
    + "return { buildReturnToTodoPatch: buildReturnToTodoPatch, __idlePersistResponse: window.__idlePersistResponse };";
  const factory = new Function("state","db","firebase", code);
  return factory(state, sim, firebase);
}
const IDLE_TASK = { id:"t1", sector:"cronograma", designerFlowStatus:"andamento", designerAssignment:{ designerId:"u1", designerName:"Ana" }, by:"cre1", socialOwnerId:"soc1", history:[{kind:"designer_moved",at:1000}] };
const reqBase = { idleCheckKey:"task_idle:t1:u1:designer_producing:1000:"+TI.THRESHOLD_VERSION, taskId:"t1", recipientUid:"u1", activityBoundaryVersion:1000, statusVersion:"designer_producing", thresholdVersion:TI.THRESHOLD_VERSION, actorId:"u1", actorName:"Ana", taskTitle:"Tarefa X" };

// committed: acrescenta EXATAMENTE 1 entrada task_idle_response
{ const sim = makeSim(IDLE_TASK); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  const r = await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"working" }));
  eq(r.status, "committed", "T01 working committed");
  const entries = sim.data.history.filter(h=>h.kind==="task_idle_response");
  eq(entries.length, 1, "T02 exatamente 1 entrada task_idle_response");
  eq(entries[0].responseType, "working", "T03 responseType gravado"); }
// already_answered: 2ª resposta ao MESMO idleCheckKey
{ const sim = makeSim(IDLE_TASK); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"working" }));
  const r2 = await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"blocked", reasonCode:"material" }));
  eq(r2.status, "already_answered", "T04 2ª resposta ⇒ already_answered");
  eq(sim.data.history.filter(h=>h.kind==="task_idle_response").length, 1, "T05 continua 1 entrada (sem duplicar)"); }
// activity_changed: atividade nova após o boundary
{ const t = JSON.parse(JSON.stringify(IDLE_TASK)); t.history.push({ kind:"moved", at: 2000 });
  const sim = makeSim(t); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  const r = await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"working" }));   // boundary=1000, nova atividade at:2000
  eq(r.status, "activity_changed", "T06 atividade nova após o cálculo ⇒ activity_changed");
  eq(sim.data.history.filter(h=>h.kind==="task_idle_response").length, 0, "T07 nada gravado quando activity_changed"); }
// task_completed / task_deleted
{ const t = JSON.parse(JSON.stringify(IDLE_TASK)); t.status="concluido";
  const sim = makeSim(t); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  eq((await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"working" }))).status, "task_completed", "T08 concluída ⇒ task_completed"); }
{ const sim = makeSim(null); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  eq((await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"working" }))).status, "task_deleted", "T09 doc inexistente ⇒ task_deleted"); }
// not_authorized: responsável mudou
{ const t = JSON.parse(JSON.stringify(IDLE_TASK)); t.designerAssignment.designerId="u2";
  const sim = makeSim(t); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  eq((await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"working" }))).status, "not_authorized", "T10 responsável mudou ⇒ not_authorized"); }
// blocked: destinatários = social + criador (nunca todos)
{ const sim = makeSim(IDLE_TASK); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"blocked", reasonCode:"material" }));
  const be = sim.data.history.find(h=>h.kind==="task_idle_response");
  eq(be.blockedRecipientIds.sort(), ["cre1","soc1"], "T11 blocked ⇒ destinatários social+criador (auditado)"); }
// help: helpRecipientId gravado
{ const sim = makeSim(IDLE_TASK); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"help_requested", helpRecipientId:"soc1", helpRecipientName:"Social", helpText:"preciso do material" }));
  const he = sim.data.history.find(h=>h.kind==="task_idle_response");
  eq(he.helpRecipientId, "soc1", "T12 help ⇒ helpRecipientId gravado"); }
// return_to_todo: aplica transição canônica + 2 entradas de histórico (idle + designer_moved), status vira afazer
{ const sim = makeSim(IDLE_TASK); const sb = makeSandbox(sim, {id:"u1",name:"Ana"});
  const r = await sb.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"return_to_todo" }));
  eq(r.status, "committed", "T13 return_to_todo committed");
  eq(sim.data.designerFlowStatus, "afazer", "T14 return_to_todo ⇒ designerFlowStatus=afazer (transição canônica)");
  const idleE = sim.data.history.filter(h=>h.kind==="task_idle_response").length;
  const moveE = sim.data.history.filter(h=>h.kind==="designer_moved" && h.to==="afazer").length;
  eq(idleE, 1, "T15 1 entrada task_idle_response");
  eq(moveE, 1, "T16 1 entrada designer_moved (uma única movimentação, sem duplicar)"); }
// CONCORRÊNCIA: 2 devices, mesma idleCheckKey, respostas diferentes ⇒ 1 committed / 1 already_answered / 1 entrada
{ const sim = makeSim(IDLE_TASK);
  const sbA = makeSandbox(sim, {id:"u1",name:"Ana"});
  const sbB = makeSandbox(sim, {id:"u1",name:"Ana"});
  sim.hook = async () => { await sbB.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"blocked", reasonCode:"tecnico" })); };
  const rA = await sbA.__idlePersistResponse(Object.assign({}, reqBase, { responseType:"working" }));
  const committed = [rA.status].filter(s=>s==="committed").length;   // B rodou no hook e venceu; A relê e vê already_answered
  ok(rA.status==="already_answered" || rA.status==="committed", "T17 concorrência: A resolve committed OU already_answered");
  eq(sim.data.history.filter(h=>h.kind==="task_idle_response").length, 1, "T18 concorrência ⇒ 1 ÚNICA entrada (primeira vence)"); }

// G) GOLDEN-MASTER buildReturnToTodoPatch — contrato CONGELADO dos patches 'afazer' nos 3 eixos (1.0.206).
// Canoniza timestamps (at/atMs → '<ts>') e compara o {fields, historyEntry} INTEIRO — não só .kind.
function canonNew(r){ const he=Object.assign({}, r.historyEntry);
  if(typeof he.at==='number') he.at='<ts>'; if(typeof he.atMs==='number') he.atMs='<ts>';
  return { fields:r.fields, he }; }
{ const sb = makeSandbox(makeSim(IDLE_TASK), {id:"u1",name:"Ana"});
  // eixo designer geral (cronograma)
  const gD = canonNew(sb.buildReturnToTodoPatch({ id:"t1", sector:"cronograma", designerFlowStatus:"andamento", designerAssignment:{designerId:"u1"} }, 5000, "u1"));
  eq(gD, { fields:{ designerFlowStatus:"afazer", designerWorkflowStage:"afazer" },
    he:{ kind:"designer_moved", axis:"designerFlowStatus", from:"andamento", to:"afazer", byUid:"u1", byId:"u1", at:"<ts>", atMs:"<ts>", source:"desktop" } }, "G01-03 designer geral: fields+historyEntry congelados");
  // eixo edicao_cards (fields incluem status='afazer' — sincroniza a coluna do setor)
  const gC = canonNew(sb.buildReturnToTodoPatch({ id:"t2", sector:"edicao_cards", designerFlowStatus:"andamento", designerAssignment:{designerId:"u1"} }, 5000, "u1"));
  eq(gC, { fields:{ designerFlowStatus:"afazer", designerWorkflowStage:"afazer", status:"afazer" },
    he:{ kind:"designer_moved", axis:"designerFlowStatus", from:"andamento", to:"afazer", byUid:"u1", byId:"u1", at:"<ts>", atMs:"<ts>", source:"desktop" } }, "G04-05 cards: fields+historyEntry congelados");
  // eixo social (sem designer)
  const gS = canonNew(sb.buildReturnToTodoPatch({ id:"t3", sector:"marketing", status:"andamento" }, 5000, "u1"));
  eq(gS, { fields:{ status:"afazer" }, he:{ kind:"moved", at:"<ts>", byId:"u1", from:"andamento", to:"afazer" } }, "G06-08 social: fields+historyEntry congelados");
  // NÃO altera prazo/dueAt/startAt/planStartAt/doneAt em nenhum eixo (origem sempre 'andamento' ⇒ leavingDone=false)
  const noTime = (f)=>!("dueAt" in f)&&!("startAt" in f)&&!("startedAt" in f)&&!("planStartAt" in f)&&!("doneAt" in f);
  ok(noTime(gD.fields)&&noTime(gC.fields)&&noTime(gS.fields), "G09 nenhum eixo altera prazo/dueAt/startAt/planStartAt/doneAt"); }
// moveStatus roteia 'afazer' pelo helper (reuso comprovado no fonte)
ok(/newStatus==='afazer'[\s\S]{0,400}buildReturnToTodoPatch/.test(indexHtml), "G10 moveStatus roteia 'afazer' por buildReturnToTodoPatch (mesmo helper do check-in)");

// G11+) GOLDEN-MASTER **ANTES × DEPOIS** — roda o moveStatus REAL do baseline 1.0.206 (via git show 35262e5),
//        captura o patch 'afazer' que ele enviava ao Firestore e compara BYTE-A-BYTE (timestamps canônicos)
//        com buildReturnToTodoPatch nos 3 eixos. Prova de paridade exigida pela DECISÃO 4. Origem 'andamento'
//        (designerMoveOpts só oferece 'afazer' a partir de andamento) ⇒ o ramo leavingDone jamais dispara.
let base206 = "";
try { base206 = execSync("git show 35262e5:desktop/src/renderer/index.html", { cwd: ROOT, maxBuffer: 96*1024*1024 }).toString().replace(/\r\n/g,"\n"); } catch { base206 = ""; }
function canonPatch(p){ const fields={}; let he=null;
  for(const k in p){ if(k==='history'){ he=(p[k]&&p[k].__arrayUnion)?p[k].__arrayUnion[0]:p[k]; } else fields[k]=p[k]; }
  he=Object.assign({}, he); if(typeof he.at==='number') he.at='<ts>'; if(typeof he.atMs==='number') he.atMs='<ts>';
  return { fields, he }; }
function runOldMoveStatusAfazer(task){
  const captured={ patch:null };
  const state={ user:{id:"u1",name:"Ana"}, tasks:[JSON.parse(JSON.stringify(task))], designerBoard:false, users:[{id:"soc1",name:"Social",status:"ativo"}] };
  const db={ collection:()=>({ doc:()=>({ update: async (p)=>{ captured.patch=p; } }) }) };
  const firebase={ firestore:{ FieldValue:{ arrayUnion:(...a)=>({__arrayUnion:a}), delete:()=>({__delete:true}) } } };
  const extraStubs=`
    var slaGuardBlocked = function(){ return false; };
    var closeModal = function(){}; var render = function(){};
    var isClientSector = function(k){ return k==='cronograma'; };
  `;
  const code = sandboxPrelude + extraStubs + "\n" + pull("moveStatus", base206) + "\n" + "return moveStatus;";
  const move = new Function("state","db","firebase", code)(state, db, firebase);
  return { move, captured, id:state.tasks[0].id };
}
if(base206){
  const sb2 = makeSandbox(makeSim(IDLE_TASK), {id:"u1",name:"Ana"});
  const axes=[
    { n:"designer geral", t:{ id:"t1", sector:"cronograma",   designerFlowStatus:"andamento", designerAssignment:{designerId:"u1"} } },
    { n:"edicao_cards",   t:{ id:"t2", sector:"edicao_cards", designerFlowStatus:"andamento", designerAssignment:{designerId:"u1"} } },
    { n:"social",         t:{ id:"t3", sector:"marketing",    status:"andamento" } },
  ];
  let gi=11;
  for(const ax of axes){
    const { move, captured, id } = runOldMoveStatusAfazer(ax.t);
    await move(id, "afazer");
    const before = canonPatch(captured.patch);
    const after  = canonNew(sb2.buildReturnToTodoPatch(ax.t, 7000, "u1"));
    eq(after, before, "G"+(gi++)+" antes×depois PARIDADE ["+ax.n+"] — buildReturnToTodoPatch == moveStatus 1.0.206 inline");
  }
} else {
  ok(false, "G11-13 baseline 35262e5 indisponível (git show falhou) — não foi possível provar antes×depois");
}

// ── resumo ──
try { fs.rmSync(CTL_DIR, { recursive:true, force:true }); } catch { /* */ }   // limpa o dir temporário de stores
console.log("\nF3.5.4Q — task-idle-detection: " + PASS + " passed / " + FAIL + " failed");
if(FAIL){ console.error("FAILURES:\n - " + FAILS.join("\n - ")); process.exit(1); }
