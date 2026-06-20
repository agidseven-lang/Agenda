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
const apiCore = new Function(core + '\n;return { notifSev, notifFlowEvent, notifBuildPayload };')();
const { notifSev, notifFlowEvent, notifBuildPayload } = apiCore;

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name); } };

// ===================== FASE 2 — CONTRATO (19 campos) =====================
const p = notifBuildPayload({ eventType: 'sla_warning', taskId: 'T1', taskTitle: 'Cronograma', clientName: 'Boa Forma', actorName: 'Marina', actorAvatar: 'data:img', targetUserId: 'U1', title: 'Prazo próximo', body: 'faltam 18 min', context: 'SLA', severity: 'warning', anchor: 123, action: { type: 'detail', deep: 'detail/T1' } });
['eventId', 'eventType', 'taskId', 'taskTitle', 'clientName', 'actorId', 'actorName', 'actorAvatar', 'targetUserId', 'title', 'body', 'context', 'createdAt', 'severity', 'sound', 'action', 'dedupKey', 'source', 'providerCalled'].forEach((k) => ok('contrato tem ' + k, k in p));
ok('providerCalled=false', p.providerCalled === false);
ok('sound default=true', p.sound === true);
ok('sound=false respeitado', notifBuildPayload({ eventType: 'x', sound: false }).sound === false);
ok('dedupKey estável (type:task:anchor)', p.dedupKey === 'sla_warning:T1:123');
ok('action.deep=detail/T1', p.action.deep === 'detail/T1');
ok('source default=renderer', p.source === 'renderer');

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
ok('hub: decide por janela ATIVA', /function windowActive\(\)/.test(mainTs) && /isFocused\(\)/.test(mainTs));
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

// ===================== não regrediu o aprovado (F3.3.2) =====================
ok('preservado: card Kanban Opção 2 (themes-list rola)', /kbv2-themes-list/.test(html) && /CARD-FIT-NOTEBOOK/.test(html));
ok('preservado: login sem sino/avatar/monitor (removidos no logout)', /getElementById\('sla-monitor'\)/.test(html) && /getElementById\('slaib-bell'\)/.test(html));
ok('preservado: SLA Monitor + bloqueio', /function slaMonRender/.test(html) && /function slaCriticalFor/.test(html));
ok('preservado: WhatsApp premium intacto', /saveCardImage/.test(preloadTs) && /copy-card-image/.test(mainTs));

console.log(`\nF3.3.3 NOTIF RESULT: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error::F3.3.3 NOTIF FALHOU'); process.exit(1); }
console.log('F3.3.3 OK — contrato/severidade/fluxo; hub toast↔nativa; dedup; som; clique; zero provider/write; aprovado F3.3.2 preservado.');
