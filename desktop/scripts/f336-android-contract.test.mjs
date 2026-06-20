#!/usr/bin/env node
/* F3.3.6-B — TESTES-CONTRATO ANDROID/KOTLIN + WORKER FCM (READ-ONLY, ESTÁTICO).
 *
 * OBJETIVO: CONGELAR o comportamento ATUAL do subsistema de notificações/SLA/fluxo do
 * Android beta e do Worker FCM, ANTES de qualquer implementação de paridade (Fase C).
 * Documenta os GAPS como invariantes EXECUTÁVEIS — NÃO os corrige. Se a Fase C mudar
 * qualquer um destes pontos, o teste falha e força uma decisão consciente/autorizada
 * (mesmo padrão de blindagem de f335-contract.test.mjs para o renderer).
 *
 * SEGURO POR DESIGN: este arquivo vive em desktop/scripts/ (NÃO em android-native-beta/**),
 * logo NÃO dispara android-compile-check.yml nem nenhum workflow de push. Apenas LÊ os
 * fontes Kotlin/Worker como texto — não compila, não gera APK, não chama FCM/rede, não
 * escreve nada, não altera produto.
 *
 * Rodar: /opt/node22/bin/node desktop/scripts/f336-android-contract.test.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED — este teste é estático/read-only'); };

// ── leitura dos fontes (read-only) ──────────────────────────────────────────
const AND = 'android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta';
const read = (rel) => {
  const p = path.resolve(ROOT, rel);
  if (!fs.existsSync(p)) { console.error('::error:: fonte ausente: ' + rel); process.exit(1); }
  return fs.readFileSync(p, 'utf8');
};
const SRC = {
  flow: read(AND + '/domain/FlowState.kt'),
  sla: read(AND + '/domain/Sla.kt'),
  models: read(AND + '/domain/Models.kt'),
  inapp: read(AND + '/core/SlaInApp.kt'),
  fcm: read(AND + '/core/AppFirebaseMessagingService.kt'),
  notif: read(AND + '/core/Notifications.kt'),
  vis: read(AND + '/features/tasks/TaskVisibility.kt'),
  manifest: read('android-native-beta/app/src/main/AndroidManifest.xml'),
  worker: read('cloudflare-worker.js'),
};

// ── extrator de bloco balanceado (Kotlin {} / JS {} / data class ()) ─────────
function balanced(src, sig, open = '{', close = ')') {
  const i = src.indexOf(sig);
  if (i < 0) return '';
  const s = src.indexOf(open, i);
  if (s < 0) return '';
  let d = 0;
  for (let k = s; k < src.length; k++) {
    if (src[k] === open) d++;
    else if (src[k] === close) { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  return '';
}
const ktFn = (src, sig) => balanced(src, sig, '{', '}');
const ctor = (src, sig) => balanced(src, sig, '(', ')');

// ── asserções ───────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };
const inc = (n, src, lit) => ok(n, src.includes(lit));
const out = (n, src, lit) => ok(n, !src.includes(lit));
const rx = (n, src, re) => ok(n, re.test(src));
const countEq = (n, src, re, exp) => { const m = src.match(re); const c = m ? m.length : 0; ok(n + ` (=${exp}, obtido ${c})`, c === exp); };

const hr = (t) => console.log('\n── ' + t + ' ──');

// =============================================================================
// FASE 1 — CONTRATO DO FLOW ENGINE (FlowState.kt)
// =============================================================================
hr('FASE 1 — FlowEngine (8 fases canônicas, ordenação, 3 perspectivas)');
const PHASES = ['PLANNING', 'AWAITING_DESIGNER', 'DESIGNER_PRODUCING', 'DESIGNER_REVISING',
  'DESIGNER_DELIVERED', 'AWAITING_CLIENT_APPROVAL', 'CLIENT_REQUESTED_CHANGES', 'COMPLETED'];
const enumBlk = ktFn(SRC.flow, 'enum class TaskPhase');
ok('TaskPhase é enum com bloco', enumBlk.length > 0);
for (const p of PHASES) inc('TaskPhase contém ' + p, enumBlk, p);
countEq('TaskPhase tem exatamente 8 fases (vírgulas+última)', enumBlk,
  /\b(PLANNING|AWAITING_DESIGNER|DESIGNER_PRODUCING|DESIGNER_REVISING|DESIGNER_DELIVERED|AWAITING_CLIENT_APPROVAL|CLIENT_REQUESTED_CHANGES|COMPLETED)\b/g, 8);

const dp = ktFn(SRC.flow, 'fun derivePhase(t: TaskItem): TaskPhase');
ok('derivePhase existe', dp.length > 0);
// ordenação determinística terminal → cliente → designer → planning
inc('derivePhase: terminal cfs=concluido → COMPLETED', dp, 'if (cfs == "concluido") return TaskPhase.COMPLETED');
inc('derivePhase: cfs=revisao → CLIENT_REQUESTED_CHANGES', dp, 'if (cfs == "revisao") return TaskPhase.CLIENT_REQUESTED_CHANGES');
inc('derivePhase: cfs=reenviado → AWAITING_CLIENT_APPROVAL', dp, 'if (cfs == "reenviado") return TaskPhase.AWAITING_CLIENT_APPROVAL');
inc('derivePhase: designer concluido/entregue → DESIGNER_DELIVERED', dp, '"concluido", "entregue" -> TaskPhase.DESIGNER_DELIVERED');
inc('derivePhase: designer revisao → DESIGNER_REVISING', dp, '"revisao" -> TaskPhase.DESIGNER_REVISING');
inc('derivePhase: designer andamento → DESIGNER_PRODUCING', dp, '"andamento" -> TaskPhase.DESIGNER_PRODUCING');
inc('derivePhase: sem designer → PLANNING', dp, 'return TaskPhase.PLANNING');
// caminho não-cronograma (tarefa comum) mapeia por status
inc('derivePhase: não-cron status concluido → COMPLETED', dp, '"concluido" -> TaskPhase.COMPLETED');
inc('derivePhase: não-cron else → AWAITING_DESIGNER', dp, 'else -> TaskPhase.AWAITING_DESIGNER');
// 3 perspectivas presentes e exaustivas (when sobre enum: 8 arms cada)
for (const fn of ['fun socialOf(p: TaskPhase): FlowPerspective', 'fun designerOf(p: TaskPhase): FlowPerspective', 'fun clientOf(p: TaskPhase): FlowPerspective']) {
  const b = ktFn(SRC.flow, fn);
  ok('perspectiva existe: ' + fn.split('(')[0], b.length > 0);
  countEq(fn.split('(')[0] + ' cobre as 8 fases', b, /TaskPhase\.[A-Z_]+\s*->/g, 8);
}
inc('FlowEngine.derive devolve FlowState(phase, social, designer, client)', SRC.flow,
  'return FlowState(p, socialOf(p), designerOf(p), clientOf(p))');

// =============================================================================
// FASE 1-GAP — TaskItem Android não carrega cronStatus/operationalStatus/finalApproval
// (colapso DESIGNER_DELIVERED ↔ AWAITING_CLIENT_APPROVAL). CONGELAR como está.
// =============================================================================
hr('FASE 1-GAP — campos de fluxo ausentes no TaskItem Android (congelado)');
const taskItem = ctor(SRC.models, 'data class TaskItem(');
ok('TaskItem extraído', taskItem.length > 0);
inc('TaskItem TEM designerFlowStatus', taskItem, 'designerFlowStatus');
inc('TaskItem TEM clientFlowStatus', taskItem, 'clientFlowStatus');
out('GAP: TaskItem NÃO tem cronStatus', taskItem, 'cronStatus');
out('GAP: TaskItem NÃO tem operationalStatus', taskItem, 'operationalStatus');
out('GAP: TaskItem NÃO tem finalApprovalCompleted', taskItem, 'finalApprovalCompleted');
out('GAP: TaskItem NÃO tem clientApprovedFlag', taskItem, 'clientApprovedFlag');
rx('GAP documentado no cabeçalho de FlowState.kt (cronStatus/finalApproval/operationalStatus)',
  SRC.flow, /N[ÃA]O carrega cronStatus[\s\S]*?finalApprovalCompleted[\s\S]*?operationalStatus/);

// =============================================================================
// FASE 2 — CONTRATO DE SLA (Sla.kt / SlaContract + SlaInApp.kt)
// =============================================================================
hr('FASE 2 — SlaContract (thresholds, fonte do prazo, estados, escopo designer)');
inc('warnFinishMin = 30 (laranja a 30min do fim)', SRC.sla, 'const val warnFinishMin = 30');
const fms = ktFn(SRC.sla, 'fun finishMs(t: TaskItem): Long');
inc('finishMs: 1º plannedFinishAt', fms, 'sla?.plannedFinishAt?.let { if (it > 0L) return it }');
inc('finishMs: 2º planDueAt', fms, 'sla?.planDueAt?.let { if (it > 0L) return it }');
inc('finishMs: 3º dueDate/dueTime', fms, 'EventStatus.dtMs(t.dueDate');
out('GAP: finishMs Android NÃO usa assignment.endDate (Desktop usa)', fms, 'endDate');

const res = ktFn(SRC.sla, 'fun resolve(t: TaskItem, nowMs: Long = System.currentTimeMillis()): TaskDisplayState');
ok('resolve existe', res.length > 0);
inc('resolve: entregue/concluída → completed/verde (fora do painel)', res, '"completed", "verde"');
inc('resolve: sem SLA / prazo inválido → none/neutro', res, '"none", "neutro"');
inc('resolve: now ≥ finish → overdue/vermelho', res, '"overdue", "vermelho"');
inc('resolve: now ≥ finish-30min → warning/laranja', res, '"warning", "laranja"');
inc('resolve: caso contrário → running/azul', res, '"running", "azul"');
inc('resolve: janela laranja = warnFinishMin*60000', res, 'val wF = warnFinishMin * 60000L');
inc('resolve: limiar vermelho em now ≥ finish', res, 'if (nowMs >= finish)');
inc('resolve: limiar laranja em now ≥ finish - wF', res, 'if (nowMs >= finish - wF)');

hr('FASE 2-GAP — Android: SEM grace, SEM crítico, SEM bloqueio (constantes mortas)');
// criticalAfterMin/warnStartMin declarados MAS nunca referenciados (1 ocorrência cada = só a const).
countEq('GAP: criticalAfterMin declarado e NUNCA usado no read-side', SRC.sla, /criticalAfterMin/g, 1);
countEq('GAP: warnStartMin declarado e NUNCA usado (Android dropou "início atrasado")', SRC.sla, /warnStartMin/g, 1);
out('GAP: resolve() NÃO tem branch "critical"', res, 'critical');
out('GAP: resolve() NÃO tem branch de bloqueio operacional ("block")', res, 'block');
// nota de divergência: Desktop usa GRACE_MS=10min + crítico/bloqueio; Android para em "overdue".
ok('NOTA: Desktop crítico = finish+10min; Android criticalAfterMin=60 (const morta) — NÃO alinhar agora',
  /criticalAfterMin = 60/.test(SRC.sla));

hr('FASE 2 — escopo designer (SLA pessoal só com designer) + RBAC Editar prazo');
// SLA pessoal nasce só após atribuição ao designer (gate idêntico em items() e panel()).
countEq('SLA gated: (designerAssignment.designerId ?: assigneeId) ?: continue (items + panel)',
  SRC.inapp, /\(t\.designerAssignment\?\.designerId \?: t\.assigneeId\) \?: continue/g, 2);
inc('só vermelho/laranja entram no sino/painel (inPanel)', SRC.inapp, 'if (!d.inPanel) continue');
const rbac = ktFn(SRC.inapp, 'fun canEditPrazo(u: UserLite?): Boolean');
inc('RBAC Editar prazo: admin pode', rbac, 'if (u.admin) return true');
inc('RBAC Editar prazo: cargo de gestão pode', rbac, 'MANAGER_KW.any');
inc('eventos de SLA: designer_finish_overdue', SRC.inapp, 'designer_finish_overdue');
inc('eventos de SLA: designer_finish_warning', SRC.inapp, 'designer_finish_warning');
// "10 min" aparece só como CÓPIA estática no painel (não é grace/bloqueio funcional).
inc('GAP: "10 min" é só texto estático do painel (sem grace funcional)', SRC.inapp, 'Conclua em até 10 min ou sinalize atraso.');

// =============================================================================
// FASE 3 — CONTRATO DE NOTIFICAÇÃO (FCM service + canais + permissões)
// =============================================================================
hr('FASE 3 — recepção FCM, deep-link, canais, permissões por versão');
const omr = ktFn(SRC.fcm, 'override fun onMessageReceived(message: RemoteMessage)');
ok('onMessageReceived existe', omr.length > 0);
inc('FCM lê título (notification ou data)', omr, 'n?.title ?: data["title"]');
inc('FCM lê corpo (notification ou data)', omr, 'n?.body ?: data["body"]');
inc('FCM deep-link: data.deepLink', omr, 'data["deepLink"]');
inc('FCM deep-link: fallback taskId → task:id', omr, '"task:$it"');
inc('FCM deep-link: fallback eventId → event:id', omr, '"event:$it"');
inc('FCM deep-link: chat → chat:senderId', omr, '"chat:$it"');
inc('FCM lê type (task/chat/event)', omr, 'data["type"]');
inc('FCM lê responsibleId p/ lembrete', omr, 'data["responsibleId"]');
inc('FCM posta no canal CH_IMMEDIATE', omr, 'Notifications.CH_IMMEDIATE');
inc('FCM agenda lembrete premium 1h (scheduleFromFcm)', omr, 'ReminderScheduler.scheduleFromFcm');

hr('FASE 3 — canais e permissões (Notifications.kt)');
inc('canal CH_IMMEDIATE = "immediate"', SRC.notif, 'const val CH_IMMEDIATE = "immediate"');
inc('canal CH_ALARM_V2 = "reminder_fullscreen_v2"', SRC.notif, 'const val CH_ALARM_V2 = "reminder_fullscreen_v2"');
inc('canal CH_GENERAL = "general"', SRC.notif, 'const val CH_GENERAL = "general"');
inc('CH_IMMEDIATE criado com IMPORTANCE_HIGH', SRC.notif, 'NotificationChannel(CH_IMMEDIATE, "Notificações em tempo real", NotificationManager.IMPORTANCE_HIGH)');
const hp = ktFn(SRC.notif, 'fun hasPostPermission(ctx: Context): Boolean');
inc('Android 13+: gate POST_NOTIFICATIONS (SDK<33 OU permissão)', hp, 'Build.VERSION.SDK_INT < 33');
inc('hasPostPermission usa POST_NOTIFICATIONS', hp, 'Manifest.permission.POST_NOTIFICATIONS');
inc('Android 14+: gate full-screen intent (SDK<34)', SRC.notif, 'if (Build.VERSION.SDK_INT < 34) return true');
inc('Android 12+: gate exact alarm (SDK<31)', SRC.notif, 'if (Build.VERSION.SDK_INT < 31) return true');
const nfy = ktFn(SRC.notif, 'fun notify(ctx: Context, id: Int, channel: String');
inc('notify() bloqueado sem permissão (retorna false)', nfy, 'if (!hasPostPermission(ctx))');
inc('notify() usa BigTextStyle (corpo expandido)', nfy, 'NotificationCompat.BigTextStyle()');

hr('FASE 3 — AndroidManifest (permissões + serviço FCM)');
for (const perm of ['POST_NOTIFICATIONS', 'USE_EXACT_ALARM', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED', 'USE_FULL_SCREEN_INTENT']) {
  inc('Manifest declara ' + perm, SRC.manifest, 'android.permission.' + perm);
}
inc('Manifest registra AppFirebaseMessagingService', SRC.manifest, '.core.AppFirebaseMessagingService');
inc('Manifest: intent-filter MESSAGING_EVENT', SRC.manifest, 'com.google.firebase.MESSAGING_EVENT');

hr('FASE 3-GAP — Android sempre posta notificação do SISTEMA (sem toast in-app premium)');
// Diferente do Desktop (toast premium quando visível ↔ nativa quando minimizado), o Android
// SEMPRE posta notificação do sistema no onMessageReceived — não há supressão app-aberto nem
// card in-app. CONGELAR como está (não criar banner premium na Fase B; só Fase C autorizada).
out('GAP: onMessageReceived NÃO checa app em foreground', omr, 'foreground');
out('GAP: onMessageReceived NÃO tem toast/banner in-app', omr, 'Toast');
inc('GAP: onMessageReceived SEMPRE chama Notifications.notify (sistema)', omr, 'Notifications.notify(');
// payload de paridade do Desktop ausente no consumo do Android:
for (const f of ['actorName', 'actorAvatar', 'responsibleName', 'responsibleAvatar', 'plannedFinishAt', 'notificationType', 'severity', 'etapa']) {
  out('GAP: FCM service NÃO consome ' + f, omr, f);
}

// =============================================================================
// FASE 4 — CONTRATO WORKER FCM (cloudflare-worker.js) — estático/read-only
// =============================================================================
hr('FASE 4 — Worker: FCM HTTP v1, OAuth2, rotas pessoais');
inc('FCM HTTP v1 endpoint (messages:send)', SRC.worker, 'https://fcm.googleapis.com/v1/projects/${projectId}/messages:send');
inc('OAuth2: getAccessToken', SRC.worker, 'async function getAccessToken(env, scope)');
inc('rota POST /notify-assignee', SRC.worker, '/notify-assignee');
inc('rota POST /notify-designer', SRC.worker, '/notify-designer');
inc('envio via sendToTokens (lista de tokens do responsável)', SRC.worker, 'async function sendToTokens(env, accessToken, tokens, msg)');

hr('FASE 4 — payloads FCM: campos PRESENTES vs paridade AUSENTE (congelado)');
const dPay = balanced(SRC.worker, 'function designerPayload(id, doc)', '{', '}');
const iPay = balanced(SRC.worker, 'function immediatePayload(type, id, doc)', '{', '}');
ok('designerPayload extraído', dPay.length > 0);
ok('immediatePayload extraído', iPay.length > 0);
// presentes (designer)
for (const f of ['type:', 'taskId:', 'title,', 'body,', 'responsibleId:', 'createdBy:', 'deepLink:', 'channel:']) {
  inc('designerPayload TEM ' + f, dPay, f);
}
// presentes (immediate)
for (const f of ['type,', 'eventId:', 'taskId:', 'responsibleId,', 'createdBy:', 'scheduledAt:', 'deepLink:']) {
  inc('immediatePayload TEM ' + f, iPay, f);
}
// AUSENTES nos DOIS payloads (gap de paridade com o Desktop notifBuildPayload):
for (const f of ['actorName', 'actorAvatar', 'responsibleName', 'responsibleAvatar', 'plannedFinishAt', 'severity', 'notificationType', 'etapa']) {
  out('GAP: designerPayload NÃO envia ' + f, dPay, f);
  out('GAP: immediatePayload NÃO envia ' + f, iPay, f);
}
// roteamento PESSOAL (não há broadcast de equipe no caminho imediato): cada payload mira 1 responsável.
inc('roteamento PESSOAL: designer = designerAssignment.designerId (fallback assigneeId)', dPay, 'doc.designerAssignment && doc.designerAssignment.designerId');

hr('FASE 4 — motor SLA do Worker DESLIGADO (sem envio real)');
inc('engine só roda com SLA_ENGINE_ENABLED === "true" (ausente em prod)', SRC.worker, 'env.SLA_ENGINE_ENABLED === "true"');
inc('escrita só com SLA_WRITE === "true"', SRC.worker, 'env.SLA_WRITE === "true"');
inc('flags.slaEngine: false (default)', SRC.worker, 'slaEngine: false');
inc('flags.slaNotifications: false (default)', SRC.worker, 'slaNotifications: false');
inc('notificação SLA só com SLA_NOTIFY_ENABLED === "true"', SRC.worker, 'SLA_NOTIFY_ENABLED === "true"');
inc('plano SLA NÃO implementa envio real (realSendImplemented: false)', SRC.worker, 'realSendImplemented: false');

// =============================================================================
console.log(`\nF3.3.6-B ANDROID/WORKER CONTRACT: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error:: contrato Android/Worker mudou — auditar antes de prosseguir'); process.exit(1); }
console.log('OK — comportamento Android/Worker ATUAL congelado (gaps documentados, não corrigidos). Read-only, sem build/APK/FCM.');
