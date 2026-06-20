#!/usr/bin/env node
/* F3.3.6-C — TESTES-CONTRATO DA PARIDADE ANDROID-ONLY (READ-ONLY, ESTÁTICO).
 *
 * Congela o comportamento IMPLEMENTADO na Fase C: leitura aditiva de campos de fluxo,
 * separação de fases, crítico VISUAL finish+10min (sem hard block), banner premium in-app,
 * SLA pessoal só designer, fluxo/equipe por transição, dedup local e supressão foreground.
 *
 * Lê os fontes Kotlin como TEXTO — não compila, não gera APK, não chama FCM, não escreve.
 * Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow nenhum.
 * A compilação real é validada pelo android-compile-check.yml (compileDebugKotlin, sem APK).
 *
 * Rodar: /opt/node22/bin/node desktop/scripts/f337-android-parity.test.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED — teste estático/read-only'); };

const AND = 'android-native-beta/app/src/main/java/br/com/idseven/agenda/nativebeta';
const read = (rel) => {
  const p = path.resolve(ROOT, rel);
  if (!fs.existsSync(p)) { console.error('::error:: fonte ausente: ' + rel); process.exit(1); }
  return fs.readFileSync(p, 'utf8');
};
const SRC = {
  models: read(AND + '/domain/Models.kt'),
  repo: read(AND + '/data/TaskRepo.kt'),
  flow: read(AND + '/domain/FlowState.kt'),
  sla: read(AND + '/domain/Sla.kt'),
  inapp: read(AND + '/core/SlaInApp.kt'),
  notif: read(AND + '/core/InAppNotif.kt'),
  banner: read(AND + '/core/InAppBanner.kt'),
  seen: read(AND + '/core/InAppSeenStore.kt'),
  fg: read(AND + '/core/AppForeground.kt'),
  app: read(AND + '/core/AgendaApp.kt'),
  fcm: read(AND + '/core/AppFirebaseMessagingService.kt'),
  scaffold: read(AND + '/core/MainScaffold.kt'),
};

function balanced(src, sig, open = '{', close = '}') {
  const i = src.indexOf(sig); if (i < 0) return '';
  const s = src.indexOf(open, i); if (s < 0) return '';
  let d = 0;
  for (let k = s; k < src.length; k++) {
    if (src[k] === open) d++; else if (src[k] === close) { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  return '';
}
const ktFn = (src, sig) => balanced(src, sig);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };
const inc = (n, src, lit) => ok(n, src.includes(lit));
const out = (n, src, lit) => ok(n, !src.includes(lit));
const hr = (t) => console.log('\n── ' + t + ' ──');

// =============================================================================
hr('FASE 1 — modelo aditivo + decode read-only + separação de fases');
// (1) campos novos nullable/default null → dados antigos não quebram.
inc('Models: cronStatus nullable default null', SRC.models, 'val cronStatus: String? = null');
inc('Models: operationalStatus nullable default null', SRC.models, 'val operationalStatus: String? = null');
inc('Models: finalApprovalCompleted nullable default null', SRC.models, 'val finalApprovalCompleted: Boolean? = null');
// (2) lidos do snapshot SEM escrita (getString/getBoolean no decoder).
inc('TaskRepo decodifica cronStatus (read)', SRC.repo, 'cronStatus = d.getString("cronStatus")');
inc('TaskRepo decodifica operationalStatus (read)', SRC.repo, 'operationalStatus = d.getString("operationalStatus")');
inc('TaskRepo decodifica finalApprovalCompleted (read)', SRC.repo, 'finalApprovalCompleted = d.getBoolean("finalApprovalCompleted")');
// (3) FlowEngine separa delivered / awaiting / completed.
const dp = ktFn(SRC.flow, 'fun derivePhase(t: TaskItem): TaskPhase');
ok('derivePhase extraído', dp.length > 0);
inc('COMPLETED por finalApprovalCompleted/operationalStatus/cron aprovado_final', dp, 'finalApprovalCompleted == true) return TaskPhase.COMPLETED');
inc('AWAITING_CLIENT_APPROVAL por cronStatus canônico', dp, 'cron == "ready_for_final_client_review" || cron == "reenviado_cliente") return TaskPhase.AWAITING_CLIENT_APPROVAL');
inc('DESIGNER_DELIVERED separado quando há cronStatus', dp, 'if (delivered && cron.isNotBlank()) return TaskPhase.DESIGNER_DELIVERED');
inc('COMPAT: dados antigos cfs=reenviado → AWAITING (preservado)', dp, 'if (cfs == "reenviado") return TaskPhase.AWAITING_CLIENT_APPROVAL');
inc('eixo designer preservado (when dfs)', dp, '"concluido", "entregue" -> TaskPhase.DESIGNER_DELIVERED');

// =============================================================================
hr('FASE 2 — SLA: laranja 30min, vermelho no prazo, crítico VISUAL finish+10min, SEM block');
inc('warnFinishMin = 30 (laranja)', SRC.sla, 'const val warnFinishMin = 30');
inc('criticalAfterMin = 10 (crítico após finish+10min)', SRC.sla, 'const val criticalAfterMin = 10');
inc('TaskDisplayState ganhou flag critical (visual)', SRC.sla, 'val critical: Boolean = false');
const res = ktFn(SRC.sla, 'fun resolve(t: TaskItem, nowMs: Long = System.currentTimeMillis()): TaskDisplayState');
inc('resolve: vermelho no prazo (now ≥ finish)', res, 'if (nowMs >= finish)');
inc('resolve: crítico em now ≥ finish + criticalAfterMin', res, 'if (nowMs >= finish + criticalAfterMin * 60000L)');
inc('resolve: estado crítico (vermelho, critical=true)', res, '"critical", "vermelho", "Atraso crítico", finish, 0L, over, true, true, critical = true');
inc('resolve: laranja preservada (warning)', res, '"warning", "laranja"');
out('SEM hard block: resolve não bloqueia (sem token "block")', res, 'block');
out('SEM hard block: resolve não tem isBlocked', res, 'isBlocked');
inc('derive mapeia crítico → critical_finish', SRC.sla, '"critical" -> SlaLocal("critical_finish", "vermelho", "Atraso crítico", VERMELHO)');
// SlaInApp: evento/cópia crítica + OpRow escala (sem hard block).
inc('SlaInApp: evento designer_finish_critical', SRC.inapp, 'designer_finish_critical');
inc('SlaInApp: SlaOpRow ganhou critical', SRC.inapp, 'val critical: Boolean = false');
inc('SlaInApp: OpRow copy crítica escalada', SRC.inapp, 'Atraso crítico — conclua imediatamente ou sinalize.');

// =============================================================================
hr('FASE 3+4 — banner premium + SLA pessoal só designer + fluxo/equipe por transição');
// SLA pessoal — SOMENTE o designer responsável (Social/Admin NÃO recebem SLA pessoal).
const slaFn = ktFn(SRC.notif, 'fun slaItems(');
inc('InAppNotif.slaItems: gate SÓ o responsável (respId != user.id → continue)', slaFn, 'if (respId != user.id) continue');
inc('InAppNotif.slaItems: só laranja/vermelho/crítico (inPanel)', slaFn, 'if (!d.inPanel) continue');
inc('InAppNotif.slaItems: kicker crítico', slaFn, 'SLA · ATRASO CRÍTICO');
// Fluxo/equipe — visibilidade por perfil + transição entre snapshots.
const teamFn = ktFn(SRC.notif, 'fun teamCanSee(user: UserLite?, t: TaskItem): Boolean');
inc('teamCanSee: supervisão (canSeeAllBoards)', teamFn, 'TaskVisibility.canSeeAllBoards(user)');
inc('teamCanSee: designer + autor + atribuído', teamFn, 't.assigneeId == uid || t.by == uid || t.designerAssignment?.designerId == uid');
const flowFn = ktFn(SRC.notif, 'fun flowItems(');
inc('flowItems: gate de equipe', flowFn, 'if (!teamCanSee(user, t)) continue');
inc('flowItems: sem prev → não dispara (1º load não spamma)', flowFn, 'val before = prev[t.id] ?: continue');
inc('flowItems: só na transição de fase', flowFn, 'if (before == phase) continue');
// Banner premium (4 mockups).
inc('Banner: severidade laranja', SRC.banner, '"laranja" -> Color(0xFFF2A93B)');
inc('Banner: severidade vermelho', SRC.banner, '"vermelho" -> Color(0xFFFF6B61)');
inc('Banner: severidade azul (fluxo)', SRC.banner, 'Color(0xFF7FA6FF)');
inc('Banner: CTA índigo no fluxo', SRC.banner, 'if (item.kind == "flow") INDIGO else sev');
inc('Banner: selo CRÍTICO', SRC.banner, 'CRÍTICO');
inc('Banner: avatar/foto real (Avatar grande)', SRC.banner, 'Avatar(photo = item.avatarPhoto');
inc('Banner: responsável com mini-foto', SRC.banner, 'Avatar(photo = item.respPhoto');
inc('Banner: título completo (sem maxLines de corte)', SRC.banner, 'item.title, color = Color(0xFFEEF2F8)');
inc('Banner: CTA "Abrir tarefa"', SRC.banner, 'Abrir tarefa');
inc('Banner: deep link visível', SRC.banner, 'Text(item.deepLink');
inc('Banner: contador de fila (n/N)', SRC.banner, '"1/$queueTotal"');
inc('Banner: auto-dismiss premium', SRC.banner, 'kotlinx.coroutines.delay(6500)');
inc('Banner: acento lateral por severidade (drawBehind)', SRC.banner, 'drawBehind');

// =============================================================================
hr('FASE 5 — foreground/background sem duplicidade');
inc('AppForeground: rastreio via lifecycle callbacks', SRC.fg, 'registerActivityLifecycleCallbacks');
inc('AppForeground: flag isForeground', SRC.fg, 'var isForeground: Boolean');
inc('AgendaApp registra AppForeground', SRC.app, 'AppForeground.register(this)');
const omr = ktFn(SRC.fcm, 'override fun onMessageReceived(message: RemoteMessage)');
inc('FCM: supressão SÓ em foreground + type=="task"', omr, 'AppForeground.isForeground && data["type"] == "task"');
inc('FCM: posta sistema quando NÃO suprimido (background)', omr, 'if (!suppressForeground)');
inc('FCM: background segue com Notifications.notify', omr, 'Notifications.notify(');

// =============================================================================
hr('FASE 6 — dedup local + CTA/navegação + ZERO push/escrita nos arquivos novos');
inc('InAppSeenStore: prefs dedicado', SRC.seen, 'idseven_inapp_seen');
inc('InAppSeenStore: markSeen', SRC.seen, 'fun markSeen(ctx: Context, key: String)');
inc('MainScaffold: hospeda o banner', SRC.scaffold, 'InAppBanner(');
inc('MainScaffold: SLA pessoal via InAppNotif.slaItems', SRC.scaffold, 'InAppNotif.slaItems(currentUser, tasksList, users)');
inc('MainScaffold: fluxo via InAppNotif.flowItems', SRC.scaffold, 'InAppNotif.flowItems(currentUser, tasksList, users, prevPhases.value)');
inc('MainScaffold: transição via phaseMap (snapshot diff)', SRC.scaffold, 'InAppNotif.phaseMap(currentUser, tasksList)');
inc('MainScaffold: dedup filtra vistos', SRC.scaffold, 'filter { it.key !in seen }');
inc('MainScaffold: CTA usa DeepLink.pending (nav existente)', SRC.scaffold, 'DeepLink.pending.value = dl');
inc('MainScaffold: marca visto ao abrir/dispensar', SRC.scaffold, 'InAppSeenStore.markSeen(context, key)');
// arquivos NOVOS read-side: nada de FCM/Firestore-write.
for (const [name, s] of [['InAppNotif', SRC.notif], ['InAppBanner', SRC.banner], ['AppForeground', SRC.fg]]) {
  out(`${name}: sem envio FCM (sendToTokens)`, s, 'sendToTokens');
  out(`${name}: sem Firestore (FirebaseFirestore)`, s, 'FirebaseFirestore');
  out(`${name}: sem escrita .update(`, s, '.update(');
  out(`${name}: sem escrita .set(`, s, '.set(');
}

// =============================================================================
console.log(`\nF3.3.6-C ANDROID PARITY: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error:: paridade Android divergiu do contrato C'); process.exit(1); }
console.log('OK — paridade Android-only implementada conforme C0: crítico visual finish+10min (sem block), banner premium, SLA pessoal só designer, fluxo/equipe, dedup, foreground/background. Read-only, sem APK/FCM/write.');
