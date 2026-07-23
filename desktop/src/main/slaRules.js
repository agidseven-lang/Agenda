/**
 * F3.4.3 — slaRules.js — REGRAS DE SLA DO DESIGNER (CommonJS, PURO).
 * =====================================================================================
 * Porte VERBATIM (mesma matemática, constantes e strings em Português) das funções de
 * regra de SLA do renderer (desktop/src/renderer/index.html, base 1.0.178). SEM DOM,
 * SEM window, SEM state — usável no PROCESSO MAIN (nunca suspenso). É a fonte única de
 * decisão do produtor autoritativo de SLA no main (slaScheduler.ts).
 *
 * O main NÃO tem diretório de usuários (state.users): a resolução do responsável usa
 * SOMENTE campos DENORMALIZADOS da própria task (notifResponsibleDenorm).
 *
 * Anti-regressão: a equivalência VALOR-a-VALOR com o renderer é provada pelo Golden
 * Master (desktop/scripts/f343-sla-golden-master.test.mjs), que extrai as funções
 * originais do index.html e compara a saída fixture-a-fixture.
 */
'use strict';

/* ---- Domínio (SECTORS/alias/secOf) — index.html:2310-2320 (suficiente p/ slaCfgOf) ---- */
var SECTORS=[
  {key:'edicao_midia',label:'Edição de mídia',color:'#60A5FA',desc:'Cortes, legendas e exportação',icon:'movie'},
  {key:'cronograma',label:'Cronograma',color:'#34D399',desc:'Planejamento de publicações',icon:'calendar'},
  {key:'copywriting',label:'Copywriting',color:'#22D3EE',desc:'Textos, legendas e anúncios',icon:'editnote',descontinuado:true},
  {key:'roteiro',label:'Roteiro',color:'#F59E0B',desc:'Roteiros de gravação de vídeos',icon:'description'},
  {key:'programacao_posts',label:'Programação de posts',color:'#A78BFA',desc:'Agendamento e publicação',icon:'grid'}];
var SECTOR_ALIAS={design:'edicao_midia',copy:'copywriting',postagem:'programacao_posts'};
function secOf(k){var kk=SECTOR_ALIAS[k]||k;return SECTORS.find(function(s){return s.key===kk;})||SECTORS[0];}

/* ---- Deadline base — index.html:2373 ---- */
function dtMs(date,time){if(!date)return null;var _a=date.split('-').map(Number),y=_a[0],m=_a[1],d=_a[2];var _b=((time||'00:00').split(':')).map(Number),hh=_b[0],mm=_b[1];return new Date(y,(m||1)-1,d||1,hh||0,mm||0).getTime();}

/* ---- Util — index.html:2380 ---- */
function first(s){return (s||'').trim().split(/\s+/)[0]||'';}

/* ---- Formatação HM/contador — index.html:2826, 3284, 3288, 3290 ---- */
function slaibFmtHM(ms){try{var d=new Date(ms);var p=function(n){return (n<10?'0':'')+n;};return p(d.getHours())+':'+p(d.getMinutes());}catch(_){return '';}}
function slaMMSSfmt(ms,mode){ ms=Math.max(0,ms||0); var s=(mode==='up')?Math.ceil(ms/1000):((mode==='down')?Math.floor(ms/1000):Math.round(ms/1000)); var m=Math.floor(s/60), ss=s%60; if(m<60) return m+':'+(ss<10?'0':'')+ss; var h=Math.floor(m/60),mm=m%60; return mm?(h+'h '+mm+'min'):(h+'h'); }
function slaCount(ms){ return slaMMSSfmt(ms,'up'); }
function slaElapsed(ms){ return slaMMSSfmt(ms,'down'); }

/* ════ PANEL-CORE (derivação PURA read-side) — index.html:2836-2903 ════ */
var SLA_PANEL_WARN_MS=30*60000;   // janela LARANJA (prazo próximo): finish-30min <= now < finish
var SLA_PANEL_GRACE_MS=10*60000;  // tolerância VERMELHA: 10 min após o finish p/ concluir/sinalizar
function slaPanelFinishMs(t,dtMsFn){
  var ds=(t&&t.designerSla)||{};
  var pf=Number(ds.plannedFinishAt); if(pf>0) return pf;          // 1) plannedFinishAt (engine)
  var pd=Number(ds.planDueAt); if(pd>0) return pd;                // 2) planDueAt (semente in-app)
  var f=dtMsFn||(typeof dtMs==='function'?dtMs:function(){return 0;});
  var da=(t&&t.designerAssignment)||{};
  if(da.endDate){ var e=Number(f(da.endDate,da.endTime||'23:59'))||0; if(e>0) return e; } // 3) assignment.end
  var dd=t&&(t.dueDate||t.due); if(dd){ var d=Number(f(dd,(t&&t.dueTime)||'23:59'))||0; if(d>0) return d; } // 4) due
  return 0;
}
function slaPanelDelivered(t){
  var ds=(t&&t.designerSla)||{};
  var finished=Number(ds.finishedAt)||(typeof (t&&t.doneAt)==='number'?t.doneAt:0);
  if(finished>0) return true;
  var fs=(t&&t.designerFlowStatus)||'', st=(t&&t.status)||'';
  return fs==='entregue'||fs==='concluido'||fs==='cancelado'||st==='concluido'||st==='cancelado'||st==='removido';
}
function resolveTaskDisplayState(t,now,dtMsFn){
  now=now||Date.now();
  var hasSla=!!(t&&t.designerSla);
  var finishMs=slaPanelFinishMs(t,dtMsFn)||0;
  var _WARN=SLA_PANEL_WARN_MS, _GRACE=SLA_PANEL_GRACE_MS;
  try{ if(typeof slaCfgOf==='function'){ var _c=slaCfgOf(t); if(_c){ _WARN=(_c.warningMinutes||30)*60000; _GRACE=(_c.overdueGraceMinutes||10)*60000; } } }catch(_e){}
  // F3.4.5 — ABERTURA REAL da janela concedida ao Designer (designerSla.planStartAt; fallback
  // designerAssignment.startDate/startTime): o AMARELO jamais antecede o início planejado. Sem
  // início registrado (_START=0), max(x,0)=x ⇒ comportamento aprovado BYTE-idêntico.
  var _START=0; try{ var _dsS=(t&&t.designerSla)||{}; _START=Number(_dsS.planStartAt)||0; if(!(_START>0)){ var _daS=(t&&t.designerAssignment)||{}; var _fS=dtMsFn||(typeof dtMs==='function'?dtMs:null); if(_daS.startDate&&typeof _fS==='function'){ _START=Number(_fS(_daS.startDate,_daS.startTime||'00:00'))||0; } } if(!(_START>0)) _START=0; }catch(_eS){ _START=0; }
  if(slaPanelDelivered(t)) return {sev:'verde',state:'completed',finishMs:finishMs,label:'Concluído',remainingMin:0,overdueMin:0,graceRemainingMin:0,remainingMs:0,overdueMs:0,graceRemainingMs:0,critical:false,hasSla:hasSla,inPanel:false};
  if(!hasSla||!finishMs)   return {sev:'neutro',state:'none',finishMs:finishMs,label:'',remainingMin:0,overdueMin:0,graceRemainingMin:0,remainingMs:0,overdueMs:0,graceRemainingMs:0,critical:false,hasSla:hasSla,inPanel:false};
  if(now>=finishMs){ var over=Math.max(1,Math.round((now-finishMs)/60000));
    var graceLeft=Math.max(0,Math.round((finishMs+_GRACE-now)/60000));
    var critical=(now>=finishMs+_GRACE);
    return {sev:'vermelho',state:'overdue',finishMs:finishMs,label:'Prazo encerrado',remainingMin:0,overdueMin:over,graceRemainingMin:graceLeft,remainingMs:0,overdueMs:(now-finishMs),graceRemainingMs:Math.max(0,finishMs+_GRACE-now),critical:critical,hasSla:true,inPanel:true}; }
  if(now>=Math.max(finishMs-_WARN,_START)){ var left=Math.max(1,Math.round((finishMs-now)/60000));
    return {sev:'laranja',state:'warning',finishMs:finishMs,label:'Prazo próximo',remainingMin:left,overdueMin:0,graceRemainingMin:0,remainingMs:Math.max(0,finishMs-now),overdueMs:0,graceRemainingMs:0,critical:false,hasSla:true,inPanel:true}; }
  var rem=Math.max(1,Math.round((finishMs-now)/60000));
  return {sev:'azul',state:'running',finishMs:finishMs,label:'Em prazo',remainingMin:rem,overdueMin:0,graceRemainingMin:0,remainingMs:Math.max(0,finishMs-now),overdueMs:0,graceRemainingMs:0,critical:false,hasSla:true,inPanel:false};
}

/* ════ SLA DO DESIGNER POR SETOR — index.html:2935-2944 ════ */
var SECTOR_SLA={
  cronograma:  {designerSla:true,  warningMinutes:30, overdueGraceMinutes:10, critical:true,  dedupByDesigner:false, warnText:'Você tem 30 minutos para concluir esta tarefa.', overdueText:'Você tem 10 minutos para concluir esta tarefa.', warnTag:'sla_warning',      overdueTag:'sla_overdue'},
  edicao_midia:{designerSla:true,  warningMinutes:40, overdueGraceMinutes:20, critical:false, dedupByDesigner:true,  warnText:'Você tem 40 minutos para concluir esta tarefa.', overdueText:'Você tem 20 minutos para concluir esta tarefa.', warnTag:'media_warning_40', overdueTag:'media_overdue_20'},
  roteiro:     {designerSla:false, warningMinutes:30, overdueGraceMinutes:10, critical:false, dedupByDesigner:false, warnText:'',                                              overdueText:'',                                              warnTag:'sla_warning',      overdueTag:'sla_overdue'}
};
function slaCfgDefault(){return {designerSla:true, warningMinutes:30, overdueGraceMinutes:10, critical:true, dedupByDesigner:false, warnText:'Você tem 30 minutos para concluir esta tarefa.', overdueText:'Você tem 10 minutos para concluir esta tarefa.', warnTag:'sla_warning', overdueTag:'sla_overdue'};}
function slaCfgOf(t){
  var k=''; try{ k=(typeof secOf==='function'?((secOf(t&&t.sector)||{}).key||''):((t&&t.sector)||'')); }catch(_){ k=(t&&t.sector)||''; }
  return SECTOR_SLA[k]||slaCfgDefault();
}

/* ════ LINHA DO TEMPO CANÔNICA — index.html:2957-2970 ════ */
function _slaScheduleRevOf(t){ try{ return Number(t&&t.designerSla&&t.designerSla.scheduleRevision)||0; }catch(_){ return 0; } }
function resolveCanonicalSlaTimeline(t,dtMsFn){
  var f=dtMsFn||(typeof dtMs==='function'?dtMs:null);
  var cfg=(typeof slaCfgOf==='function')?slaCfgOf(t):slaCfgDefault();
  var dueAtMs=(typeof slaPanelFinishMs==='function')?(slaPanelFinishMs(t,f)||0):0;
  var warnMin=(cfg&&cfg.warningMinutes)||30, graceMin=(cfg&&cfg.overdueGraceMinutes)||10;
  // F3.4.5 — mesma abertura real da janela usada por resolveTaskDisplayState (clamp do amarelo).
  var _START=0; try{ var _dsS=(t&&t.designerSla)||{}; _START=Number(_dsS.planStartAt)||0; if(!(_START>0)){ var _daS=(t&&t.designerAssignment)||{}; if(_daS.startDate&&typeof f==='function'){ _START=Number(f(_daS.startDate,_daS.startTime||'00:00'))||0; } } if(!(_START>0)) _START=0; }catch(_eS){ _START=0; }
  var tz=''; try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(_){}
  return { dueAtMs:dueAtMs,
    warningAtMs:dueAtMs?Math.min(Math.max(dueAtMs-warnMin*60000,_START),dueAtMs):0,   // AMARELO: max(prazo final − warningMinutes, INÍCIO planejado) — F3.4.5: nunca antes da abertura real
    overdueAtMs:dueAtMs,                              // VERMELHO: no PRAZO FINAL (planDueAt)
    criticalAtMs:dueAtMs?(dueAtMs+graceMin*60000):0, // fim da tolerância (setores com critical)
    warningMinutes:warnMin, overdueGraceMinutes:graceMin,
    designerSla:!!(cfg&&cfg.designerSla), timeZone:tz, scheduleRevision:_slaScheduleRevOf(t) };
}

/* ════ ROTEADOR DE DESTINATÁRIOS — index.html:3611-3637 ════ */
function resolveNotificationTargets(o){
  o=o||{};
  var ev=o.eventType||'';
  var task=o.task||{};
  var curId=(o.currentUser&&o.currentUser.id)||'';
  var seeAll=!!o.currentUserCanSeeAll;
  var respId=(task.designerAssignment&&task.designerAssignment.designerId)||task.assigneeId||null;
  var byId=task.by||null, asgId=task.assigneeId||null;
  var isSla=/^sla_/.test(ev)||ev==='operational_block';
  var out={ eventType:ev, taskId:task.id||'', notificationType:'team_flow',
            targetUserIds:[], excludedUserIds:[], shouldNotifyCurrentUser:false, reason:'',
            actor:o.actor||null, responsible:o.responsible||null };
  if(isSla){
    out.notificationType='sla_personal';
    out.targetUserIds=respId?[respId]:[];
    out.shouldNotifyCurrentUser=(!!respId&&curId===respId);
    out.reason=out.shouldNotifyCurrentUser?'designer responsável (SLA pessoal)':'não é o designer responsável — SLA é pessoal';
    if(curId&&curId!==respId) out.excludedUserIds=[curId];
    return out;
  }
  out.notificationType='team_flow';
  var team={}; [respId,byId,asgId].forEach(function(x){ if(x) team[String(x)]=1; });
  out.targetUserIds=Object.keys(team);
  out.shouldNotifyCurrentUser=(seeAll||(!!curId&&!!team[curId]));
  out.reason=out.shouldNotifyCurrentUser?(seeAll?'supervisão (vê tudo)':'parte da equipe da tarefa'):'fora da equipe da tarefa';
  return out;
}

/* ════ CONSTRUTOR DE PAYLOAD — index.html:3638-3657 ════ */
function notifBuildPayload(o){
  o=o||{};
  var taskId=o.taskId||'';
  var anchor=(o.anchor!=null?o.anchor:(o.createdAt!=null?o.createdAt:''));
  var eventType=o.eventType||'';
  return {
    eventId:o.eventId||(eventType+':'+taskId+':'+anchor),
    eventType:eventType, taskId:taskId, taskTitle:o.taskTitle||'', clientName:o.clientName||'',
    actorId:o.actorId||'', actorName:o.actorName||'', actorAvatar:o.actorAvatar||'',
    responsibleId:o.responsibleId||'', responsibleName:o.responsibleName||'', responsibleAvatar:o.responsibleAvatar||'',
    targetUserId:o.targetUserId||'',
    notificationType:o.notificationType||'', etapa:o.etapa||'', status:o.status||'',
    title:o.title||'', subtitle:o.subtitle||'', body:o.body||'', context:o.context||'',
    createdAt:o.createdAt||Date.now(),
    severity:o.severity||'info', sound:(o.sound!==false),
    action:o.action||{type:(taskId?'detail':'board'),deep:(taskId?('detail/'+taskId):'')},
    dedupKey:o.dedupKey||(eventType+':'+taskId+':'+anchor),
    source:o.source||'renderer', providerCalled:false
  };
}

/* ════ RESPONSÁVEL DENORMALIZADO (main, sem diretório de usuários) ════
 * Resolve o responsável usando SOMENTE campos denormalizados da task:
 *   designerAssignment.{designerId,designerName,designerAvatar|designerPhoto}
 *   senão {assigneeId, assignee|assigneeName, assigneePhoto}. Retorna {id,name,avatar}. */
function notifResponsibleDenorm(t){
  var da=(t&&t.designerAssignment)||{};
  if(da.designerId){ return { id:da.designerId, name:da.designerName||'', avatar:da.designerAvatar||da.designerPhoto||'' }; }
  return { id:(t&&t.assigneeId)||'', name:(t&&(t.assignee||t.assigneeName))||'', avatar:(t&&t.assigneePhoto)||'' };
}

/* ════ slaEmissionsFor — reproduz EXATAMENTE a decisão por-task do notifScanSla ════
 * (index.html:3913-3990) para UMA task e UM uid logado. Retorna a lista de payloads
 * (0, 1) via notifBuildPayload, com MESMO dedupKey/title/body/context/severity/action.
 * Ramos: warning (amarelo) · overdue-critical (crítico, só setores com critical) ·
 * overdue (vermelho). Fora de escopo (por-task): operational_block (varredura por-usuário,
 * gated em canSeeAll que o main não computa). */
function slaEmissionsFor(task, uid, nowMs, dtMsFn){
  var out=[];
  try{
    var t=task; if(!t) return out;
    var now=(typeof nowMs==='number')?nowMs:Date.now();
    var f=dtMsFn||(typeof dtMs==='function'?dtMs:null);
    // TIPO 1 — SLA é PESSOAL: dispara SOMENTE p/ o designer responsável (porta do roteador puro).
    var tg=resolveNotificationTargets({ eventType:'sla_warning', task:t, currentUser:{id:uid} });
    if(!tg.shouldNotifyCurrentUser) return out;
    // Roteiro NÃO tem SLA de designer (jamais amarelo/vermelho).
    if(typeof secOf==='function' && ((secOf(t.sector)||{}).key==='roteiro')) return out;
    // CONFIG DE SLA POR SETOR (fonte única slaCfgOf; default 30/10). designerSla:false não emite.
    var cfg=(typeof slaCfgOf==='function')?slaCfgOf(t):null;
    if(cfg && !cfg.designerSla) return out;
    var warnText=(cfg&&cfg.warnText)||'Você tem 30 minutos para concluir esta tarefa.';
    var overdueText=(cfg&&cfg.overdueText)||'Você tem 10 minutos para concluir esta tarefa.';
    var warnTag=(cfg&&cfg.warnTag)||'sla_warning';
    var overdueTag=(cfg&&cfg.overdueTag)||'sla_overdue';
    var critEnabled=cfg?(cfg.critical!==false):true;
    var d=resolveTaskDisplayState(t,now,f); if(!d||!d.inPanel) return out;
    var resp=notifResponsibleDenorm(t);
    var fn=first(resp.name||''), tl=(t.title||'Tarefa')+(t.client?(' — '+t.client):''), pf=slaibFmtHM(d.finishMs);
    var slaDk=function(tag){ return (cfg&&cfg.dedupByDesigner) ? (tag+':'+t.id+':'+resp.id+':'+d.finishMs+':r'+_slaScheduleRevOf(t)) : (tag+':'+t.id+':'+d.finishMs); };
    var base={ taskId:t.id, taskTitle:t.title||'Tarefa', clientName:t.client||'',
      actorId:resp.id, actorName:resp.name, actorAvatar:resp.avatar,
      responsibleId:resp.id, responsibleName:resp.name, responsibleAvatar:resp.avatar,
      targetUserId:uid, notificationType:'sla_personal', etapa:'SLA', status:d.state,
      subtitle:tl, anchor:d.finishMs, action:{type:'detail',deep:'detail/'+t.id} };
    if(d.state==='warning'){
      out.push(notifBuildPayload(Object.assign({},base,{ eventType:'sla_warning', severity:'warning', sound:true,
        title:(fn?fn+', ':'')+'prazo próximo', body:warnText,
        context:'Prazo final: '+pf+' · Vence em '+slaCount(d.remainingMs), dedupKey:slaDk(warnTag) })));
    } else if(d.state==='overdue'){
      if(d.critical){
        if(critEnabled) out.push(notifBuildPayload(Object.assign({},base,{ eventType:'sla_critical', severity:'critical', sound:true,
          title:(fn?fn+', ':'')+'atraso crítico', body:'Sinalize atraso imediatamente ou conclua a tarefa.',
          context:'Atrasada há '+slaElapsed(d.overdueMs), dedupKey:slaDk('sla_critical') })));
      } else {
        out.push(notifBuildPayload(Object.assign({},base,{ eventType:'sla_overdue', severity:'critical', sound:true,
          title:(fn?fn+', ':'')+'prazo encerrado', body:overdueText,
          context:'Restam '+slaCount(d.graceRemainingMs)+' · atrasada há '+slaElapsed(d.overdueMs), dedupKey:slaDk(overdueTag) })));
      }
    }
  }catch(_e){}
  return out;
}

/* ════ PAPEL / canSeeAll — index.html:2365-2368 (porte VERBATIM) ════
 * roleCat/canSeeAll decidem se o usuário SUPERVISIONA (ADMIN/MANAGER — NÃO recebe
 * operational_block) ou é OPERACIONAL (designer — recebe). No main o papel vem SOMENTE
 * de fonte AUTENTICADA (auth-core getUserSelf/login → {role,admin}); nunca do renderer,
 * nunca da coleção users. Recebe {role,admin} explícitos (não depende de state). */
var MANAGER_KW=['social','gestor','gerente','diretor','coordena','supervisor','admin','dono','owner','ceo','head'];
function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();}
function roleCat(role,admin){ if(admin) return 'ADMIN'; var r=norm(role); if(!r) return 'UNKNOWN'; return MANAGER_KW.some(function(k){return r.indexOf(k)>=0;})?'MANAGER':'OPERATIONAL'; }
function canSeeAllRole(role,admin){ var c=roleCat(role,admin); return c==='ADMIN'||c==='MANAGER'; }

/* ════ operationalBlockFor — porte VERBATIM de slaCriticalFor (index.html:3514-3526) +
 * emissão operational_block (index.html:3979-3988). Varredura POR-USUÁRIO (não por-task):
 * retorna [payload] p/ a 1ª tarefa em ATRASO CRÍTICO (overdue+critical) do designer atual,
 * ou [] . Gate canSeeAll: ADMIN/MANAGER supervisionam ⇒ NUNCA bloqueados (retorna []).
 * `user` = {id,role,admin} AUTENTICADO; se null/desconhecido ⇒ [] (conservador: não emite
 * a um possível supervisor enquanto o papel não é confirmado). Mesma condição/destinatário/
 * título/texto/cor/deep/dedupe/relação-com-sla_critical da 1.0.178. */
function operationalBlockFor(tasks, user, nowMs, dtMsFn){
  var out=[];
  try{
    if(!user||!user.id) return out;                         // sem usuário autenticado ⇒ não emite
    if(canSeeAllRole(user.role,user.admin)) return out;     // ADMIN/MANAGER supervisionam (não bloqueia)
    var now=(typeof nowMs==='number')?nowMs:Date.now();
    var f=dtMsFn||(typeof dtMs==='function'?dtMs:null);
    var list=tasks||[], blk=null;
    for(var i=0;i<list.length;i++){ var t=list[i]; if(!t||!t.designerSla) continue;
      var resp=(t.designerAssignment&&t.designerAssignment.designerId)||t.assigneeId||null;
      if(resp!==user.id) continue;                          // só a tarefa do designer atual
      var d=resolveTaskDisplayState(t,now,f);
      if(d.state==='overdue' && d.critical){ blk=t; break; } // atraso crítico (>grace) — 1ª tarefa
    }
    if(!blk) return out;
    var d2=resolveTaskDisplayState(blk,now,f);
    var rb=notifResponsibleDenorm(blk);
    out.push(notifBuildPayload({ eventType:'operational_block', taskId:blk.id, taskTitle:blk.title||'Tarefa', clientName:blk.client||'',
      actorId:rb.id, actorName:rb.name, actorAvatar:rb.avatar,
      responsibleId:rb.id, responsibleName:rb.name, responsibleAvatar:rb.avatar,
      targetUserId:user.id, notificationType:'sla_personal', etapa:'SLA', status:'operational_block',
      severity:'critical', sound:true, anchor:(d2&&d2.finishMs)||0,
      title:'Tarefa em atraso crítico', body:'Conclua ou sinalize atraso antes de continuar outras tarefas.',
      context:'Bloqueio operacional', dedupKey:'operational_block:'+blk.id+':'+((d2&&d2.finishMs)||0),
      action:{type:'detail',deep:'detail/'+blk.id} }));
  }catch(_e){}
  return out;
}

/* ════ nextBoundaryMs — soonest future warning/overdue/critical instant p/ ESTA task ════
 * (espelha slaMonNextBoundary index.html:3482, per-task). 0 = nenhum marco futuro/elegível. */
function nextBoundaryMs(task, nowMs, dtMsFn){
  try{
    var t=task; if(!t||!t.designerSla) return 0;
    if(slaPanelDelivered(t)) return 0;
    var f=dtMsFn||(typeof dtMs==='function'?dtMs:null);
    var tl=resolveCanonicalSlaTimeline(t,f); if(!tl.dueAtMs) return 0;
    var now=(typeof nowMs==='number')?nowMs:Date.now();
    var bs=[tl.warningAtMs, tl.overdueAtMs, tl.criticalAtMs], best=0;
    for(var k=0;k<bs.length;k++){ if(bs[k]>now && (!best||bs[k]<best)) best=bs[k]; }
    return best;
  }catch(_e){ return 0; }
}

/* ═══════════════════════════════════════════════════════════════════════════════════
 * F3.4.4 — FLUXO (movimentação de card): fase canônica + detector de TRANSIÇÃO CONCRETA.
 * -------------------------------------------------------------------------------------
 * Porte VALOR-IDÊNTICO do Flow Engine do renderer (index.html 1.0.180: deriveCanonicalTaskState
 * e todos os sinais/predicados que ele lê) — provado pelo Golden Master
 * (desktop/scripts/f344-flow-golden-master.test.mjs, 0 divergência sobre o corpus).
 *
 * CONTRATO F3.4.4 (produtor no MAIN):
 *   snapshot Firestore (notifier.u3) → estado anterior POR TAREFA (lastPhase) → transição real
 *   (prev≠cur) → identidade da TRANSIÇÃO CONCRETA (eventType:taskId:from>to:uid:carimbo) →
 *   assinatura por tarefa (replay idêntico NUNCA repete; retorno/repetição legítima SEMPRE emite)
 *   → deliverNotification (HUB) → toast/bgNotify.
 *
 * CARIMBO AUTORITATIVO (auditado — nenhum timestamp client-side inventado): todo escritor de
 * movimentação/fase grava no PRÓPRIO documento history[]={kind:'moved'|'designer_moved'|…, at/atMs}
 * ou clientActions{}.at (index.html:6022, 6054, 7484-7492, 7560-7576). O carimbo da transição é o
 * MAIOR `at` de history[]+clientActions{} (a MESMA fonte do notifLastActorId aprovado) + o tamanho
 * dos dois conjuntos (cresce a cada ação real; idêntico em replay do mesmo doc).
 *
 * GARANTIAS: sem bloqueio vitalício por taskId; sem localStorage; seed no 1º snapshot SEM emitir;
 * restart = novo seed sem histórico; A→B → B→A → A→B = 3 eventos; replay/snapshot repetido = 0.
 * ═══════════════════════════════════════════════════════════════════════════════════ */

/* ---- Fases canônicas — index.html:5696-5707 (VERBATIM) ---- */
var TASK_PHASE={
  PLANNING:'planning',
  THEMES_SENT:'themes_sent',
  THEMES_APPROVED:'themes_approved',
  AWAITING_DESIGNER:'awaiting_designer',
  DESIGNER_PRODUCING:'designer_producing',
  DESIGNER_REVISING:'designer_revising',
  DESIGNER_DELIVERED:'designer_delivered',
  AWAITING_CLIENT_APPROVAL:'awaiting_client_approval',
  CLIENT_REQUESTED_CHANGES:'client_requested_changes',
  COMPLETED:'completed'
};

/* ---- Predicados/sinais lidos por deriveCanonicalTaskState — portes VERBATIM ---- */
/* index.html:2325 */
function isClientSector(k){return k==='cronograma'||k==='roteiro';}
/* index.html:4882-4884 */
function isTaskCompleted(t){
  return !!(t&&(t.finalApprovalCompleted===true||t.clientApprovedFlag===true||t.operationalStatus==='concluido'||t.cronStatus==='aprovado_final'||t.clientFlowStatus==='concluido'));
}
/* index.html:4860 */
function hasDesigner(t){return !!(t&&t.designerAssignment&&t.designerAssignment.designerId)&&secOf(t.sector).key!=='roteiro';}
/* index.html:4911 */
function designerCol(t){var v=(t&&t.designerFlowStatus||'').toString();if(['afazer','andamento','revisao','concluido'].indexOf(v)>=0)return v;return (t&&t.status)||'afazer';}
/* index.html:5049-5053 */
function pendingLegend(t){var a=Array.isArray(t.cronContents)?t.cronContents:[];return !a.length||a.some(function(c){return !(c&&c.legenda&&String(c.legenda).trim());});}
function pendingFeed(t){var a=Array.isArray(t.cronContents)?t.cronContents:[];return !a.length||a.some(function(c){return !(c&&c.feedImageUrl);});}
function pendingStory(t){var a=Array.isArray(t.cronContents)?t.cronContents:[];return a.some(function(c){return c&&c.storyImageUrl;})&&a.some(function(c){return !(c&&c.storyImageUrl);});}
function pendingProduction(t){return pendingLegend(t)||pendingFeed(t);}
function designerDelivered(t){return hasDesigner(t)&&designerCol(t)==='concluido';}
/* index.html:6410-6419 */
function clientApprovalPhaseOf(t){
  var e=(t&&t.clientApprovalPhase||'').toString();if(e==='themes'||e==='production'||e==='final')return e;
  if(t&&t.finalApprovalCompleted===true)return 'final';
  if(t&&(t.cronStatus==='ready_for_final_client_review'||t.workflowStage==='entrega'||t.workflowStage==='revisao_final'))return 'final';
  var arr=Array.isArray(t&&t.cronContents)?t.cronContents:[];var total=arr.length||0;
  if(total>0){var withLeg=arr.filter(function(c){return c&&c.legenda&&String(c.legenda).trim();}).length;
    var withFeed=arr.filter(function(c){return c&&c.feedImageUrl;}).length;
    if(withLeg===total&&withFeed===total)return 'production';}
  return 'themes';
}
/* index.html:5058-5063 */
function pendingClientItems(t){var ci=t&&t.clientItems;if(!ci||typeof ci!=='object')return [];
  var ph=clientApprovalPhaseOf(t);var out=[];
  Object.keys(ci).forEach(function(k){var m=k.match(/^i(\d+)$/);if(!m)return;var it=ci[k]||{};
    if((it.cs==='em_revisao'||it.cs==='editado')&&it.phase===ph)out.push({idx:+m[1],cs:it.cs,note:it.note||''});});
  return out;}
function hasPendingItemRevision(t){return pendingClientItems(t).length>0;}
/* index.html:5082-5092 */
function isFullyComplete(t){
  if(!isClientSector(secOf(t.sector).key))return (t&&t.status)==='concluido';
  if(hasDesigner(t)&&!designerDelivered(t))return false;
  if(pendingProduction(t))return false;
  if(pendingStory(t))return false;
  if((t.clientReview&&t.clientReview.status)==='revisao')return false;
  return !!(t.finalApprovalCompleted===true||t.operationalStatus==='concluido'||t.clientFlowStatus==='concluido');
}
/* index.html:5709-5714 */
function flowCompletedSignal(t){return isTaskCompleted(t);}
function flowSentToClientSignal(t){var cs=(t&&t.cronStatus||'').toString();return cs==='ready_for_final_client_review'||cs==='reenviado_cliente'||(t&&t.clientApprovalPhase==='final');}
function flowClientChangesSignal(t){var cr=(t&&t.clientReview&&t.clientReview.status||'').toString();return cr==='revisao'||(t&&t.clientFlowStatus==='revisao')||hasPendingItemRevision(t);}
function flowThemesApprovedSignal(t){if(hasDesigner(t))return false;var cf=(t&&t.clientFlowStatus||'').toString();var cr=(t&&t.clientReview&&t.clientReview.status||'').toString();var ph=(t&&t.clientApprovalPhase||'').toString();return cf==='aprovado'||(cr==='aprovado'&&ph!=='final'&&ph!=='production');}
function flowThemesSentSignal(t){if(hasDesigner(t))return false;var cf=(t&&t.clientFlowStatus||'').toString();var cs=(t&&t.cronStatus||'').toString();var ph=(t&&t.clientApprovalPhase||'').toString();if(ph==='final')return false;return cf==='enviado'||cf==='reenviado'||cs==='enviado_cliente'||!!(t&&(t.clientSentBy||t.clientReviewToken||t.shareToken));}

/* ---- Fase canônica da tarefa — index.html:5716-5742 (VERBATIM) ---- */
function deriveCanonicalTaskState(t){
  if(!t)return {phase:TASK_PHASE.PLANNING,owner:'social',isCron:false};
  var isCron=isClientSector(secOf(t.sector).key);
  if(!isCron){
    var s=(t.status||'afazer');
    var phase=s==='concluido'?TASK_PHASE.COMPLETED:(s==='revisao'?TASK_PHASE.DESIGNER_REVISING:(s==='andamento'?TASK_PHASE.DESIGNER_PRODUCING:TASK_PHASE.AWAITING_DESIGNER));
    return {phase:phase,owner:'social',isCron:false};
  }
  if(flowCompletedSignal(t)||isFullyComplete(t))return {phase:TASK_PHASE.COMPLETED,owner:'social',isCron:true};
  if(flowClientChangesSignal(t))return {phase:TASK_PHASE.CLIENT_REQUESTED_CHANGES,owner:'social',isCron:true};
  if(flowSentToClientSignal(t))return {phase:TASK_PHASE.AWAITING_CLIENT_APPROVAL,owner:'client',isCron:true};
  if(hasDesigner(t)){
    var dc=designerCol(t);var dfs=(t.designerFlowStatus||'').toString();
    if(dc==='concluido'||dfs==='entregue')return {phase:TASK_PHASE.DESIGNER_DELIVERED,owner:'social',isCron:true};
    if(dc==='revisao')return {phase:TASK_PHASE.DESIGNER_REVISING,owner:'designer',isCron:true};
    if(dc==='andamento')return {phase:TASK_PHASE.DESIGNER_PRODUCING,owner:'designer',isCron:true};
    return {phase:TASK_PHASE.AWAITING_DESIGNER,owner:'designer',isCron:true};
  }
  if(secOf(t.sector).key==='roteiro'&&flowThemesApprovedSignal(t))return {phase:TASK_PHASE.COMPLETED,owner:'social',isCron:true};
  if(flowThemesApprovedSignal(t))return {phase:TASK_PHASE.THEMES_APPROVED,owner:'social',isCron:true};
  if(flowThemesSentSignal(t))return {phase:TASK_PHASE.THEMES_SENT,owner:'client',isCron:true};
  return {phase:TASK_PHASE.PLANNING,owner:'social',isCron:true};
}

/* ---- Rótulo humano da etapa — index.html:3587-3588 (VERBATIM) ---- */
var NOTIF_PHASE_LABEL={planning:'Planejamento',awaiting_designer:'Aguardando designer',designer_producing:'Em produção',designer_revising:'Em revisão',designer_delivered:'Entregue pelo designer',awaiting_client_approval:'Enviado ao cliente',client_requested_changes:'Ajuste solicitado',completed:'Concluída'};
function notifPhaseLabel(ph){ return NOTIF_PHASE_LABEL[ph]||''; }

/* ---- Transição de FASE → evento — SUPERSET compatível de notifFlowEvent (index.html:3591-3602).
 * Os 6 destinos legados são BYTE-idênticos (eventType/título/severidade preservados). NOVO (F3.4.4):
 * RETORNO ao quadro "A Fazer" do designer (produção/revisão/entrega → awaiting_designer) passa a
 * notificar — a ATRIBUIÇÃO (planning/themes_* → awaiting_designer) segue EXCLUSIVA do notifier.u1b
 * (azul designer_assigned), sem duplicar. ---- */
function flowEventOf(prevPhase,curPhase){
  if(prevPhase===curPhase) return null;
  switch(curPhase){
    case 'designer_producing':       return {eventType:'flow_production_started', title:'Produção iniciada',            severity:'info'};
    case 'designer_revising':        return {eventType:'flow_in_review',          title:'Enviado para revisão',         severity:'info'};
    case 'designer_delivered':       return {eventType:'flow_designer_delivered', title:'Designer entregou',             severity:'success'};
    case 'awaiting_client_approval': return {eventType:'flow_sent_to_client',     title:'Cronograma enviado ao cliente',severity:'info'};
    case 'client_requested_changes': return {eventType:'flow_client_changes',     title:'Cliente solicitou ajuste',     severity:'warning'};
    case 'completed':                return {eventType:'flow_completed',          title:'Tarefa concluída',             severity:'success'};
    case 'awaiting_designer':
      if(prevPhase==='designer_producing'||prevPhase==='designer_revising'||prevPhase==='designer_delivered')
        return {eventType:'flow_returned_to_todo', title:'Tarefa retornou para A Fazer', severity:'info'};
      return null;
    default: return null;
  }
}

/* ---- Última ação autoritativa do documento — porte de notifLastActorId (index.html:3695-3703),
 * devolvendo TAMBÉM o carimbo (maior `at` de history[]+clientActions{}). ---- */
function flowLastActionOf(t){
  var ev=[];
  try{
    (Array.isArray(t&&t.history)?t.history:[]).forEach(function(e){ if(e&&e.at) ev.push({at:Number(e.at),by:e.byId||e.by||null}); });
    var ca=(t&&t.clientActions&&typeof t.clientActions==='object')?t.clientActions:{};
    Object.keys(ca).forEach(function(k){ var a=ca[k]; if(a&&a.at) ev.push({at:Number(a.at),by:a.by||a.byId||null}); });
  }catch(_e){}
  if(!ev.length) return {at:0,byId:null};
  ev.sort(function(a,b){return b.at-a.at;});
  return {at:ev[0].at,byId:ev[0].by||null};
}

/* ---- Carimbo da transição: maior `at` + tamanhos de history/clientActions (crescem a cada ação
 * REAL gravada; idênticos num replay do MESMO doc). Nunca inventa relógio local. ---- */
function flowStampOf(t){
  var la=flowLastActionOf(t), h=0, c=0;
  try{ h=Array.isArray(t&&t.history)?t.history.length:0; }catch(_e){}
  try{ c=(t&&t.clientActions&&typeof t.clientActions==='object')?Object.keys(t.clientActions).length:0; }catch(_e){}
  return String(la.at||0)+':h'+h+':c'+c;
}

/* ---- ATOR denormalizado (main sem diretório; o toast re-resolve foto/nome REAIS via
 * notifNormalize no renderer — paridade com notifActor: sem ator → responsável). ---- */
function flowActorDenorm(t){
  var la=flowLastActionOf(t), aid=la.byId||'';
  if(aid){
    var da=(t&&t.designerAssignment)||{};
    if(aid===da.designerId)   return {id:aid,name:da.designerName||'',avatar:da.designerAvatar||da.designerPhoto||''};
    if(aid===da.assignedBy)   return {id:aid,name:da.assignedByName||'',avatar:da.assignedByAvatar||da.assignedByPhoto||''};
    if(aid===(t&&t.assigneeId))return {id:aid,name:(t&&(t.assignee||t.assigneeName))||'',avatar:(t&&t.assigneePhoto)||''};
    try{ var hs=Array.isArray(t&&t.history)?t.history:[]; for(var i=hs.length-1;i>=0;i--){ var e=hs[i]; if(e&&(e.byId===aid||e.byUid===aid)&&e.by&&typeof e.by==='string'){ return {id:aid,name:e.by,avatar:''}; } } }catch(_e){}
    return {id:aid,name:'',avatar:''};
  }
  return notifResponsibleDenorm(t);
}

/* ---- DETECTOR por usuário logado (o notifier reinicia por uid): estado anterior por tarefa +
 * assinatura da última transição processada. SEM persistência; SEM bloqueio vitalício. ---- */
function createFlowDetector(){
  var lastPhase=Object.create(null), lastSig=Object.create(null), seeded=false;
  return {
    isSeeded:function(){ return seeded; },
    sealSeed:function(){ seeded=true; },
    drop:function(id){ delete lastPhase[id]; delete lastSig[id]; },
    /* devolve o EVENTO da transição concreta ou null; SEMPRE registra o quadro atual. */
    scanDoc:function(t){
      if(!t||!t.id) return null;
      var cur=''; try{ cur=(deriveCanonicalTaskState(t)||{}).phase||''; }catch(_e){ cur=''; }
      var prev=Object.prototype.hasOwnProperty.call(lastPhase,t.id)?lastPhase[t.id]:undefined;
      lastPhase[t.id]=cur;                                    // estado atual registrado a CADA snapshot
      if(!seeded||prev===undefined||prev===cur) return null;  // seed/tarefa-nova/sem-mudança/replay igual
      var ev=flowEventOf(prev,cur); if(!ev) return null;      // destino sem evento mapeado (paridade)
      var stamp=flowStampOf(t);
      var sig=prev+'>'+cur+':'+stamp;
      if(lastSig[t.id]===sig) return null;                    // replay da MESMA transição concreta
      lastSig[t.id]=sig;                                      // assinatura atualizada após CADA evento
      return { eventType:ev.eventType, title:ev.title, severity:ev.severity, fromPhase:prev, toPhase:cur, stamp:stamp };
    }
  };
}

/* ---- EMISSÃO (roteamento + payload) — paridade com o notifScanFlow do renderer:
 * mesmos destinatários (equipe da tarefa + supervisão), mesmos textos/títulos/severidade/etapa/
 * corpo/subtítulo/deep-link. Identidade NOVA da transição concreta em eventId/dedupKey. ---- */
function flowEmissionFor(t, uid, seeAll, ev){
  if(!t||!t.id||!uid||!ev) return null;
  var tg=resolveNotificationTargets({ eventType:ev.eventType, task:t, currentUser:{id:uid}, currentUserCanSeeAll:!!seeAll });
  if(!tg.shouldNotifyCurrentUser) return null;
  var actor=flowActorDenorm(t), resp=notifResponsibleDenorm(t);
  var idty=ev.eventType+':'+t.id+':'+ev.fromPhase+'>'+ev.toPhase+':'+uid+':'+ev.stamp;
  return notifBuildPayload({
    eventId:idty, dedupKey:idty,
    eventType:ev.eventType, taskId:t.id, taskTitle:t.title||'Tarefa', clientName:t.client||'',
    actorId:actor.id||'', actorName:actor.name||'', actorAvatar:actor.avatar||'',
    responsibleId:resp.id||'', responsibleName:resp.name||'', responsibleAvatar:resp.avatar||'',
    targetUserId:uid, notificationType:tg.notificationType, etapa:notifPhaseLabel(ev.toPhase), status:ev.toPhase,
    severity:ev.severity, sound:true, title:ev.title,
    subtitle:(actor.name||''),
    body:(t.title||'Tarefa')+(t.client?(' — '+t.client):''),
    context:'', anchor:ev.toPhase, action:{type:'detail',deep:'detail/'+t.id},
    source:'notifier'
  });
}

module.exports = {
  // domínio / util
  SECTORS: SECTORS, SECTOR_ALIAS: SECTOR_ALIAS, secOf: secOf,
  dtMs: dtMs, first: first, slaibFmtHM: slaibFmtHM, slaMMSSfmt: slaMMSSfmt, slaCount: slaCount, slaElapsed: slaElapsed,
  // panel-core
  SLA_PANEL_WARN_MS: SLA_PANEL_WARN_MS, SLA_PANEL_GRACE_MS: SLA_PANEL_GRACE_MS,
  slaPanelFinishMs: slaPanelFinishMs, slaPanelDelivered: slaPanelDelivered, resolveTaskDisplayState: resolveTaskDisplayState,
  // config por setor
  SECTOR_SLA: SECTOR_SLA, slaCfgDefault: slaCfgDefault, slaCfgOf: slaCfgOf,
  // timeline canônica
  _slaScheduleRevOf: _slaScheduleRevOf, resolveCanonicalSlaTimeline: resolveCanonicalSlaTimeline,
  // roteador / payload
  resolveNotificationTargets: resolveNotificationTargets, notifBuildPayload: notifBuildPayload,
  // papel / bloqueio operacional (autenticado)
  MANAGER_KW: MANAGER_KW, norm: norm, roleCat: roleCat, canSeeAllRole: canSeeAllRole, operationalBlockFor: operationalBlockFor,
  // main-only
  notifResponsibleDenorm: notifResponsibleDenorm, slaEmissionsFor: slaEmissionsFor, nextBoundaryMs: nextBoundaryMs,
  // F3.4.4 — fluxo (movimentação de card) no MAIN
  TASK_PHASE: TASK_PHASE, isClientSector: isClientSector, isTaskCompleted: isTaskCompleted,
  hasDesigner: hasDesigner, designerCol: designerCol,
  pendingLegend: pendingLegend, pendingFeed: pendingFeed, pendingStory: pendingStory,
  pendingProduction: pendingProduction, designerDelivered: designerDelivered,
  clientApprovalPhaseOf: clientApprovalPhaseOf, pendingClientItems: pendingClientItems,
  hasPendingItemRevision: hasPendingItemRevision, isFullyComplete: isFullyComplete,
  flowCompletedSignal: flowCompletedSignal, flowSentToClientSignal: flowSentToClientSignal,
  flowClientChangesSignal: flowClientChangesSignal, flowThemesApprovedSignal: flowThemesApprovedSignal,
  flowThemesSentSignal: flowThemesSentSignal, deriveCanonicalTaskState: deriveCanonicalTaskState,
  NOTIF_PHASE_LABEL: NOTIF_PHASE_LABEL, notifPhaseLabel: notifPhaseLabel,
  flowEventOf: flowEventOf, flowLastActionOf: flowLastActionOf, flowStampOf: flowStampOf,
  flowActorDenorm: flowActorDenorm, createFlowDetector: createFlowDetector, flowEmissionFor: flowEmissionFor
};
