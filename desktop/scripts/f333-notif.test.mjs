#!/usr/bin/env node
/* F3.3.3 — testes do sistema de NOTIFICAÇÕES DESKTOP em tempo real.
   - Extrai o NOTIF-CORE real do renderer (contrato/severidade/fluxo) e exercita.
   - Audita main/preload/notifier/reminder: HUB (toast x nativa), dedup, som, clique.
   - Espião de rede: QUALQUER fetch/XHR explode -> prova zero provider externo.
   100% offline/puro: NÃO envia FCM/Web Push/WhatsApp, NÃO grava Firestore, NÃO faz deploy.
   Rodar: /opt/node22/bin/node desktop/scripts/f333-notif.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const html = R('src/renderer/index.html');
const mainTs = R('src/main/main.ts');
const notifierTs = R('src/main/notifier.ts');
const reminderTs = R('src/main/reminder.ts');
const preloadTs = R('src/preload/preload.ts');
const firebaseTs = R('src/main/firebase.ts');

// ESPIÃO: qualquer chamada de rede explode (prova providerCalled=false / zero envio).
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED (envio real proibido na F3.3.3)'); };
globalThis.XMLHttpRequest = function () { throw new Error('PROVIDER-CALL-DETECTED (XHR proibido)'); };

// ── extrai o NOTIF-CORE real do renderer ──
const B = '/* F3.3.3-NOTIF-CORE BEGIN */', E = '/* F3.3.3-NOTIF-CORE END */';
const i = html.indexOf(B), j = html.indexOf(E);
if (i < 0 || j < 0 || j < i) { console.error('::error:: NOTIF-CORE não encontrado em index.html'); process.exit(1); }
const core = html.slice(i + B.length, j);
const apiCore = new Function(core + '\n;return { notifSev, notifFlowEvent, notifBuildPayload, resolveNotificationTargets, notifPhaseLabel };')();
const { notifSev, notifFlowEvent, notifBuildPayload, resolveNotificationTargets, notifPhaseLabel } = apiCore;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } };

// ===================== FASE 2/3 — CONTRATO (enriquecido: ator + responsável + tipo + etapa) =====================
const p = notifBuildPayload({ eventType: 'sla_warning', taskId: 'T1', taskTitle: 'Cronograma', clientName: 'Boa Forma', actorId: 'U9', actorName: 'Marina', actorAvatar: 'data:img', responsibleId: 'U9', responsibleName: 'Marina', responsibleAvatar: 'data:img2', notificationType: 'sla_personal', etapa: 'SLA', status: 'warning', targetUserId: 'U1', title: 'Prazo próximo', subtitle: 'Cronograma — Boa Forma', body: 'faltam 18 min', context: 'SLA', severity: 'warning', anchor: 123, action: { type: 'detail', deep: 'detail/T1' } });
['eventId', 'eventType', 'taskId', 'taskTitle', 'clientName', 'actorId', 'actorName', 'actorAvatar', 'responsibleId', 'responsibleName', 'responsibleAvatar', 'targetUserId', 'notificationType', 'etapa', 'status', 'title', 'subtitle', 'body', 'context', 'createdAt', 'severity', 'sound', 'action', 'dedupKey', 'source', 'providerCalled'].forEach((k) => ok('contrato tem ' + k, k in p));
ok('providerCalled=false', p.providerCalled === false);
ok('sound default=true', p.sound === true);
ok('sound=false respeitado', notifBuildPayload({ eventType: 'x', sound: false }).sound === false);
ok('dedupKey estável (type:task:anchor)', p.dedupKey === 'sla_warning:T1:123');
ok('action.deep=detail/T1', p.action.deep === 'detail/T1');
ok('source default=renderer', p.source === 'renderer');
// FASE 3 — ator (quem fez) + responsável (designer) carregados no contrato
ok('contrato carrega responsável (id/nome/foto)', p.responsibleId === 'U9' && p.responsibleName === 'Marina' && p.responsibleAvatar === 'data:img2');
ok('contrato carrega ator (id/nome/foto)', p.actorId === 'U9' && p.actorName === 'Marina' && p.actorAvatar === 'data:img');
ok('contrato carrega notificationType', p.notificationType === 'sla_personal');
ok('contrato carrega etapa/status', p.etapa === 'SLA' && p.status === 'warning');

// ===================== FASE 4 — etapa canônica -> rótulo humano (nunca chave crua) =====================
ok('etapa designer_producing -> Em produção', notifPhaseLabel('designer_producing') === 'Em produção');
ok('etapa awaiting_client_approval -> Enviado ao cliente', notifPhaseLabel('awaiting_client_approval') === 'Enviado ao cliente');
ok('etapa client_requested_changes -> Ajuste solicitado', notifPhaseLabel('client_requested_changes') === 'Ajuste solicitado');
ok('etapa completed -> Concluída', notifPhaseLabel('completed') === 'Concluída');
ok('etapa desconhecida -> vazio (sem chave crua)', notifPhaseLabel('xpto') === '');

// ===================== FASE 5 — ROTEADOR: SLA é PESSOAL (só o designer responsável) =====================
const desId = 'DES1', socId = 'SOC1', admId = 'ADM1';
const taskDes = { id: 'T1', designerAssignment: { designerId: desId }, assigneeId: 'A1', by: socId };
// SLA -> o designer responsável RECEBE
let r = resolveNotificationTargets({ eventType: 'sla_overdue', task: taskDes, currentUser: { id: desId } });
ok('SLA: tipo = sla_personal', r.notificationType === 'sla_personal');
ok('SLA: designer responsável RECEBE', r.shouldNotifyCurrentUser === true);
ok('SLA: alvo = só o designer', r.targetUserIds.length === 1 && r.targetUserIds[0] === desId);
// SLA -> Social Media NÃO recebe (mesmo "vendo tudo")
let rSoc = resolveNotificationTargets({ eventType: 'sla_overdue', task: taskDes, currentUser: { id: socId }, currentUserCanSeeAll: true });
ok('SLA: Social Media NÃO recebe (canSeeAll ignorado p/ SLA)', rSoc.shouldNotifyCurrentUser === false);
ok('SLA: Social entra em excluídos', rSoc.excludedUserIds.indexOf(socId) >= 0);
// SLA -> Admin NÃO recebe
let rAdm = resolveNotificationTargets({ eventType: 'sla_warning', task: taskDes, currentUser: { id: admId }, currentUserCanSeeAll: true });
ok('SLA: Admin NÃO recebe', rAdm.shouldNotifyCurrentUser === false);
// SLA crítico/bloqueio seguem a MESMA regra pessoal
ok('SLA crítico é sla_personal', resolveNotificationTargets({ eventType: 'sla_critical', task: taskDes, currentUser: { id: socId }, currentUserCanSeeAll: true }).shouldNotifyCurrentUser === false);
ok('bloqueio operacional é pessoal (só designer)', resolveNotificationTargets({ eventType: 'operational_block', task: taskDes, currentUser: { id: socId }, currentUserCanSeeAll: true }).shouldNotifyCurrentUser === false);
ok('bloqueio operacional: designer recebe', resolveNotificationTargets({ eventType: 'operational_block', task: taskDes, currentUser: { id: desId } }).shouldNotifyCurrentUser === true);

// ===================== FASE 6 — ROTEADOR: FLUXO é de EQUIPE (Social/Designer/Admin/responsável) =====================
let f = resolveNotificationTargets({ eventType: 'flow_production_started', task: taskDes, currentUser: { id: desId } });
ok('FLUXO: tipo = team_flow', f.notificationType === 'team_flow');
ok('FLUXO: designer (equipe) recebe', f.shouldNotifyCurrentUser === true);
ok('FLUXO: autor/Social (equipe) recebe', resolveNotificationTargets({ eventType: 'flow_sent_to_client', task: taskDes, currentUser: { id: socId } }).shouldNotifyCurrentUser === true);
ok('FLUXO: supervisão (vê tudo) recebe', resolveNotificationTargets({ eventType: 'flow_completed', task: taskDes, currentUser: { id: 'X' }, currentUserCanSeeAll: true }).shouldNotifyCurrentUser === true);
ok('FLUXO: fora da equipe e sem supervisão NÃO recebe', resolveNotificationTargets({ eventType: 'flow_completed', task: taskDes, currentUser: { id: 'OUTSIDER' } }).shouldNotifyCurrentUser === false);
ok('FLUXO: alvo inclui designer+autor+atribuído', f.targetUserIds.indexOf(desId) >= 0 && f.targetUserIds.indexOf(socId) >= 0 && f.targetUserIds.indexOf('A1') >= 0);

// ===================== severidade (SLA -> contrato) =====================
ok('sev vermelho->critical', notifSev('vermelho') === 'critical');
ok('sev laranja->warning', notifSev('laranja') === 'warning');
ok('sev verde->success', notifSev('verde') === 'success');
ok('sev azul->info', notifSev('azul') === 'info');

// ===================== FASE 3 — eventos de fluxo (transição canônica) =====================
ok('flow produção iniciada', notifFlowEvent('awaiting_designer', 'designer_producing').eventType === 'flow_production_started');
ok('flow enviado ao cliente', notifFlowEvent('designer_delivered', 'awaiting_client_approval').eventType === 'flow_sent_to_client');
ok('flow cliente pediu ajuste (warning)', notifFlowEvent('awaiting_client_approval', 'client_requested_changes').severity === 'warning');
ok('flow em revisão', notifFlowEvent('designer_producing', 'designer_revising').eventType === 'flow_in_review');
ok('flow designer entregou (success)', notifFlowEvent('designer_producing', 'designer_delivered').severity === 'success');
ok('flow concluído', notifFlowEvent('awaiting_client_approval', 'completed').eventType === 'flow_completed');
ok('flow sem mudança = null', notifFlowEvent('completed', 'completed') === null);
ok('flow awaiting_designer ignorado (notifier do main cobre)', notifFlowEvent('planning', 'awaiting_designer') === null);

// ===================== FASE 6 — HUB no main (toast x nativa, dedup, som, clique) =====================
ok('hub: handler IPC notify', /ipcMain\.handle\("notify"/.test(mainTs));
ok('hub: decide por janela VISÍVEL (isVisible+!isMinimized; NÃO exige foco)', /function windowActive\(\)/.test(mainTs) && /isVisible\(\)\s*&&\s*!w\.isMinimized\(\)/.test(mainTs) && !/isFocused\(\)\s*\)/.test(mainTs.slice(mainTs.indexOf('function windowActive'), mainTs.indexOf('function windowActive')+400)));
ok('hub: toast quando focado', /webContents\.send\("notif-toast"/.test(mainTs));
ok('hub: nativa quando não focado', /new Notification\(/.test(mainTs));
ok('hub: dedup por dedupKey', /_notifSeen/.test(mainTs) && /dedupKey/.test(mainTs));
ok('hub: som ligado por padrão (silent:p.sound===false)', /silent:\s*p\.sound\s*===\s*false/.test(mainTs));
ok('hub: clique foca + deep link', /notif-open/.test(mainTs) && /w\.focus\(\)/.test(mainTs));
ok('hub: ícone do app na nativa (avatar fica no toast)', /_appIcon\(\)/.test(mainTs));

// ===================== preload — ponte segura =====================
ok('preload expõe notify (invoke "notify")', /notify:\s*\(payload/.test(preloadTs) && /ipcRenderer\.invoke\("notify"/.test(preloadTs));
ok('preload expõe onNotifToast (on "notif-toast")', /onNotifToast/.test(preloadTs) && /ipcRenderer\.on\("notif-toast"/.test(preloadTs));

// ===================== notifier/reminder roteiam pelo HUB =====================
ok('notifier roteia pelo hub (deliver) e NÃO cria Notification direto', /deliver\(\{/.test(notifierTs) && !/new Notification\(/.test(notifierTs));
ok('reminder roteia pelo hub (deliver) e NÃO cria Notification direto', /deliver\(\{/.test(reminderTs) && !/new Notification\(/.test(reminderTs));
ok('notifier mantém baseline (sem histórico)', /sinceMs/.test(notifierTs));

// ===================== PROIBIÇÕES — zero provider externo / write =====================
// Audita o CÓDIGO (sem comentários/prose, p/ os docstrings "NUNCA chama FCM/WhatsApp" não
// gerarem falso-positivo). Procura APIs reais de provider/write — devem estar ausentes.
const noC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');
const codeMain = noC(mainTs) + noC(notifierTs) + noC(reminderTs) + noC(preloadTs) + noC(firebaseTs);
ok('zero FCM', !/getMessaging|firebase\/messaging|FirebaseMessaging|getToken\(/i.test(codeMain));
ok('zero Web Push', !/web-?push|pushManager|PushSubscription|webpush/i.test(codeMain));
ok('zero WhatsApp no notificador/reminder', !/whatsapp/i.test(noC(notifierTs) + noC(reminderTs)));
ok('zero Firestore WRITE (set/update/add/delete/batch/transaction)', !/setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction/.test(codeMain));
ok('firebase é só leitura (onSnapshot)', /onSnapshot/.test(firebaseTs) && !/setDoc|updateDoc|addDoc|deleteDoc/.test(noC(firebaseTs)));

// ===================== FASE 5/7/8 — renderer: toast premium + detecção + roteamento =====================
ok('renderer: toast premium (stack + avatar + severidade + contexto)', /notif-stack/.test(html) && /ntf-av/.test(html) && /ntf-sev/.test(html) && /ntf-ctx/.test(html));
ok('renderer: severidade por cor (4 níveis)', /ntf-info/.test(html) && /ntf-success/.test(html) && /ntf-warning/.test(html) && /ntf-critical/.test(html));
ok('renderer: detecção fluxo+SLA+bloqueio', /function notifScanFlow/.test(html) && /function notifScanSla/.test(html) && /operational_block/.test(html));
ok('renderer: SLA laranja/vermelho/crítico', /sla_warning/.test(html) && /sla_overdue/.test(html) && /sla_critical/.test(html));
ok('renderer: roteia via desktopAPI.notify (hub) com fallback toast', /api\.notify\(p\)/.test(html) && /notifShowToast\(p\)/.test(html));
ok('renderer: dedup local (localStorage)', /NOTIF_SEEN_KEY/.test(html) && /notifSeenHas/.test(html) && /notifSeenMark/.test(html));
ok('renderer: baseline por usuário (sem histórico)', /_notifBaseline/.test(html) && /firstRun/.test(html));
ok('renderer: som por severidade (WebAudio local)', /function notifSound/.test(html) && /AudioContext/.test(html));
ok('renderer: clique abre tarefa (detail/ via openDetails)', /function notifRoute/.test(html) && /openDetails/.test(html));
ok('renderer: recebe toast do hub (onNotifToast)', /onNotifToast/.test(html));
ok('renderer: contrato providerCalled=false', /providerCalled:false/.test(html));
ok('renderer: NÃO chama provider real na emissão', !/sendWhatsApp|sendFcm|webpush|pushManager/i.test(core));
// F3.3.3 (reteste) — precisão de contador + textos canônicos + dedup pós-entrega
ok('renderer: contador mm:ss (slaMMSS) + ms brutos no estado', /function slaMMSS\(/.test(html) && /remainingMs:/.test(html) && /overdueMs:/.test(html) && /graceRemainingMs:/.test(html));
ok('renderer: notif laranja texto canônico', /Você tem 30 minutos para concluir esta tarefa\./.test(html));
ok('renderer: notif vermelha texto canônico', /Você tem 10 minutos para concluir esta tarefa\./.test(html));
ok('renderer: notif crítica texto canônico', /Sinalize atraso imediatamente ou conclua a tarefa\./.test(html));
ok('renderer: dedup marcado APÓS entregar (reentrega em falha transitória)', /if\(delivered\) notifSeenMark\(key\)/.test(html));
ok('renderer: contador ao vivo no Monitor usa mm:ss', /sla(Count|Elapsed|MMSS)\(_slaMs\(/.test(html));
// FASE (precisão laranja) — fonte canônica + contador ceil + boundary dispara o toast
ok('precisão: resolveCanonicalDeadline (fonte única + metadados)', /function resolveCanonicalDeadline\(/.test(html) && /plannedFinishAtMs/.test(html) && /sourceField/.test(html));
ok('precisão: contagem regressiva ARREDONDA P/ CIMA (slaCount=ceil)', /function slaCount\(ms\)\{ return slaMMSSfmt\(ms,'up'\); \}/.test(html));
ok('precisão: tempo decorrido ARREDONDA P/ BAIXO (slaElapsed=floor)', /function slaElapsed\(ms\)\{ return slaMMSSfmt\(ms,'down'\); \}/.test(html));
ok('precisão: toast laranja "Vence em" usa slaCount (ceil)', /Vence em '\+slaCount\(op\.remainingMs\)/.test(html));
ok('precisão: boundary timer DISPARA notifScanSla no limite exato', /_slaBoundaryTimer=setTimeout\(function\(\)\{[\s\S]*?notifScanSla\(\)/.test(html));
// REGRESSÃO (canal): app ABERTO/VISÍVEL usa toast premium (nativo só minimizado/bandeja)
ok('canal: app visível-sem-foco usa toast in-app (não exige isFocused)', /janela ABERTA e VISÍVEL/.test(mainTs) && /return !!\(w && !w\.isDestroyed\(\) && w\.isVisible\(\) && !w\.isMinimized\(\)\);/.test(mainTs));
ok('canal: hub manda notif-toast quando visível, Notification nativa senão (sem duplicar)', /if \(windowActive\(\)\) \{[\s\S]*?webContents\.send\("notif-toast"[\s\S]*?return \{ ok: true, channel: "toast" \};/.test(mainTs) && /new Notification\(/.test(mainTs));
// REGRESSÃO (laranja): chip calmo NÃO mostra "em X min" antes da janela de 30min
ok('monitor: chip calmo = "Tudo em dia" (sem contagem antes dos 30min)', /if\(!d\|\|!d\.total\) return 'Tudo em dia';/.test(html) && !/Próximo prazo em '\+slaMonDur/.test(html));
// FASE 5/3 (correção destinatário/avatar) — SLA pessoal por designer + foto real
ok('renderer: roteador de destinatários definido', /function resolveNotificationTargets\(/.test(html));
ok('renderer: notifScanSla aplica a porta do roteador (SLA pessoal)', /var tg=resolveNotificationTargets\(\{ eventType:'sla_warning'[\s\S]*?if\(!tg\.shouldNotifyCurrentUser\) continue;/.test(html));
ok('renderer: notifScanFlow roteia por EQUIPE (currentUserCanSeeAll)', /var tg=resolveNotificationTargets\(\{ eventType:ev\.eventType[\s\S]*?currentUserCanSeeAll:seeAll/.test(html));
ok('renderer: identidade com FOTO REAL (diretório->denormalizado->letra)', /function notifIdentity\(/.test(html) && /function notifResponsible\(/.test(html) && /function notifActor\(/.test(html));
ok('renderer: toast usa foto ESTRITA da identidade principal (responsável p/ SLA, ator p/ fluxo)', /var primPhoto= isSla \? \(p\.responsibleAvatar\|\|''\) : \(p\.actorAvatar\|\|''\)/.test(html));
ok('renderer: contrato carrega responsável + notificationType + etapa', /responsibleId:o\.responsibleId/.test(html) && /notificationType:o\.notificationType/.test(html) && /etapa:o\.etapa/.test(html));
// FASE 2/6 (correção avatar "N") — identidade única + normalização do toast
ok('renderer: resolveUserIdentity (foto real/iniciais/role/hasRealAvatar)', /function resolveUserIdentity\(/.test(html) && /hasRealAvatar/.test(html) && /avatarUrl/.test(html) && /initials/.test(html));
ok('renderer: notifNormalize resolve ator+responsável e reescreve atribuição', /function notifNormalize\(/.test(html) && /atribuiu uma tarefa/.test(html));
ok('renderer: notifResponsible usa designerAvatar do designerAssignment', /da\.designerAvatar\|\|da\.designerPhoto/.test(html));
ok('renderer: toast escolhe identidade por tipo (SLA=designer, fluxo=ator)', /var primName = isSla/.test(html) && /var primPhoto= isSla/.test(html));
ok('renderer: avatar NUNCA usa inicial do título (usa primIni do NOME)', /primIni\|\|/.test(html) && !/String\(nm\)\.trim\(\)\[0\]/.test(html));
ok('renderer: linha do RESPONSÁVEL com mini-foto (ntf-resp)', /ntf-resp/.test(html) && /Responsável: /.test(html));
ok('renderer: SLA com título personalizado + prazo final', /prazo próximo/.test(html) && /Prazo final: /.test(html));
// FASE (correção corte/reticências) — card mais largo + campos essenciais SEM ellipsis
ok('card: largura aumentada (420px) + min-width', /\.ntf\{[^}]*width:420px[^}]*min-width:340px/.test(html));
ok('card: título em até 2 linhas (line-clamp) sem nowrap-ellipsis', /\.ntf-hd b\{[^}]*-webkit-line-clamp:2/.test(html) && /\.ntf-hd b\{[^}]*white-space:normal/.test(html));
ok('card: contexto/prazo SEM reticência (wrap)', /\.ntf-ctx\{[^}]*white-space:normal/.test(html) && !/\.ntf-ctx\{[^}]*text-overflow:ellipsis/.test(html));
ok('card: responsável SEM reticência (wrap)', /\.ntf-resp span:last-child\{[^}]*white-space:normal/.test(html) && !/\.ntf-resp span:last-child\{[^}]*text-overflow:ellipsis/.test(html));
ok('card: corpo multilinha (white-space:normal + overflow-wrap)', /\.ntf-ds\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/.test(html));
ok('card: altura máxima com scroll só em caso extremo (.ntf-bd)', /\.ntf-bd\{[^}]*max-height:72vh[^}]*overflow-y:auto/.test(html));
ok('card: zero text-overflow:ellipsis em campos essenciais (ti/ds/ctx/resp)', !/\.ntf-ti\{[^}]*text-overflow:ellipsis/.test(html) && !/\.ntf-ds\{[^}]*text-overflow:ellipsis/.test(html));
// FASE (compactar sem cortar) — subtítulo dedicado + remoção de redundância
ok('compacto: contrato tem subtitle', /subtitle:o\.subtitle/.test(html));
ok('compacto: toast usa p.subtitle (linha enxuta)', /p\.subtitle!=null/.test(html) && /\(sub\?'<div class="ntf-ti">/.test(html));
ok('compacto: corpo do toast é condicional (sem div vazio)', /p\.body\?'<div class="ntf-ds">/.test(html));
ok('compacto: SLA laranja corpo = só a mensagem (tarefa vai no subtítulo)', /body:'Você tem 30 minutos para concluir esta tarefa\.',/.test(html) && /subtitle:tl/.test(html));
ok('compacto: fluxo sem "Responsável" duplicado no contexto (vai no respRow)', /subtitle:\(actor\.name\|\|''\)/.test(html) && /context:'', anchor:cur/.test(html));
ok('compacto: atribuição etapa no contexto + subtítulo tarefa·cliente', /p\.subtitle=\(p\.clientName\?/.test(html) && /p\.context='Etapa: '/.test(html));
// FASE 3 — notifier do main entrega IDs p/ o renderer resolver foto/nome reais
ok('notifier: designer_assigned entrega actorId(assignedBy)+responsibleId(designerId)', /actorId: da\.assignedBy/.test(notifierTs) && /responsibleId: da\.designerId/.test(notifierTs));
ok('notifier: designer_assigned entrega foto denormalizada do designer', /responsibleAvatar: da\.designerAvatar/.test(notifierTs));
ok('notifier: task_assigned entrega actorId(by)+responsibleId(assigneeId)', /actorId: t\.by/.test(notifierTs) && /responsibleId: t\.assigneeId/.test(notifierTs));
ok('notifier: não usa mais título genérico "Novo cronograma atribuido"', !/Novo cronograma atribuido/.test(notifierTs));

// ===================== não regrediu o aprovado (F3.3.2) =====================
ok('preservado: card Kanban Opção 2 (themes-list rola)', /kbv2-themes-list/.test(html) && /CARD-FIT-NOTEBOOK/.test(html));
ok('preservado: login sem sino/avatar/monitor (removidos no logout)', /getElementById\('sla-monitor'\)/.test(html) && /getElementById\('slaib-bell'\)/.test(html));
ok('preservado: SLA Monitor + bloqueio', /function slaMonRender/.test(html) && /function slaCriticalFor/.test(html));
ok('preservado: WhatsApp premium intacto', /saveCardImage/.test(preloadTs) && /copy-card-image/.test(mainTs));

console.log(`\nF3.3.3 NOTIF RESULT: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error::F3.3.3 NOTIF FALHOU'); process.exit(1); }
console.log('F3.3.3 OK — contrato/severidade/fluxo; hub toast↔nativa; dedup; som; clique; zero provider/write; aprovado F3.3.2 preservado.');
