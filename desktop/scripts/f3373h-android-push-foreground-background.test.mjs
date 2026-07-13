#!/usr/bin/env node
/* =====================================================================
   F3.3.73H — Testes HERMÉTICOS (texto/fonte) do PUSH Android em
   FOREGROUND/BACKGROUND, deep-links e canais, contra as 8 decisões do gate:
     1. push de task abre a TAREFA (task/{id});
     2. push de event abre o DETALHE do evento (event/{id});
     3. chat legado NÃO reintroduz Chat (deep-link ignorado na navegação);
     4. foreground com contrato definido: suprime SÓ task (banner in-app);
        event/chat mostram heads-up mesmo em foreground;
     5. background mostra notificação: os TRIGGERS enviam DATA-ONLY com
        priority high (evidência do gate em functions) ⇒ onMessageReceived
        roda também em background e posta no canal immediate;
     6. token FCM segue registrado via endpoint server-side (73G);
     7. falha de push nunca quebra login/app (best-effort em toda a cadeia);
     8. nenhum token sensível em log.
   Lê Kotlin/Manifest como TEXTO — NÃO compila, NÃO gera APK, NÃO chama rede.
   Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow.
   Compilação real: android-compile-check.yml (compileDebugKotlin, sem APK).
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const P = "src/main/java/br/com/idseven/agenda/nativebeta";
const SVC = rd(`${P}/core/AppFirebaseMessagingService.kt`);
const NOTIF = rd(`${P}/core/Notifications.kt`);
const DEEP = rd(`${P}/core/DeepLink.kt`);
const FORE = rd(`${P}/core/AppForeground.kt`);
const PUSHN = rd(`${P}/core/PushNotify.kt`);
const MAIN = rd(`${P}/../MainActivity.kt`.replace("nativebeta/../", "nativebeta/"));
const SCAFFOLD = rd(`${P}/core/MainScaffold.kt`);
const FCM = rd(`${P}/core/Fcm.kt`);
const API = rd(`${P}/data/FcmApi.kt`);
const AUTH = rd(`${P}/data/AuthRepo.kt`);
const USERS = rd(`${P}/data/UsersRepo.kt`);
const TYPES = rd(`${P}/domain/Types.kt`);
const TASKFORM = rd(`${P}/features/tasks/TaskFormScreen.kt`);
const MANIFEST = rd("src/main/AndroidManifest.xml");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73H — push foreground/background Android (hermético por texto)");

/* ── A: service e recepção ── */
ok("A1 service registrado no Manifest (MESSAGING_EVENT, não exportado)",
  /AppFirebaseMessagingService/.test(MANIFEST) && /com\.google\.firebase\.MESSAGING_EVENT/.test(MANIFEST) &&
  /name="\.core\.AppFirebaseMessagingService"\s+android:exported="false"/.test(MANIFEST.replace(/\n\s*/g, " ")));
ok("A2 onMessageReceived cobre TASK (deep-link task: + rótulo Tarefa)",
  /data\["taskId"\][\s\S]{0,80}"task:\$it"/.test(SVC) && /"task" -> "Tarefa"/.test(SVC));
ok("A3 onMessageReceived cobre EVENT (deep-link event: + rótulo Compromisso)",
  /data\["eventId"\][\s\S]{0,80}"event:\$it"/.test(SVC) && /"event" -> "Compromisso"/.test(SVC));
ok("A4 push posta no canal IMMEDIATE via Notifications.notify (heads-up)",
  /Notifications\.CH_IMMEDIATE/.test(SVC) && /IMPORTANCE_HIGH/.test(NOTIF));
ok("A5 falha de recepção nunca derruba o app (try/catch em onMessageReceived e onNewToken)",
  (SVC.match(/catch \(_: Throwable\)/g) || []).length >= 2);
ok("A6 push de task/event agenda o lembrete premium 1h (idempotente)",
  /ReminderScheduler\.scheduleFromFcm/.test(SVC) && /type == "event" \|\| type == "task"/.test(SVC));

/* ── B: foreground/background (decisões 4 e 5) ── */
ok("B1 foreground rastreado localmente (ActivityLifecycleCallbacks, sem libs)",
  /registerActivityLifecycleCallbacks/.test(FORE) && /isForeground/.test(FORE));
ok("B2 supressão em foreground SÓ para task (banner in-app cobre); event/chat mostram",
  /AppForeground\.isForeground && data\["type"\] == "task"/.test(SVC) &&
  /if \(!suppressForeground\)/.test(SVC));
ok("B3 background coberto pelo MESMO handler: nada depende de notification-type do sistema",
  !/RemoteMessage\.Notification\?\./.test(SVC) && /n\?\.title \?: data\["title"\]/.test(SVC));
ok("B4 canal default do Manifest existe p/ mensagens notification-type legadas (general)",
  /default_notification_channel_id/.test(MANIFEST) && /android:value="general"/.test(MANIFEST) &&
  /CH_GENERAL = "general"/.test(NOTIF));

/* ── C: deep-links (decisões 1, 2 e 3) ── */
ok("C1 MainActivity consome deep-link no onCreate E no onNewIntent",
  /onCreate[\s\S]{0,200}DeepLink\.consumeIntent\(intent\)/.test(MAIN) &&
  /onNewIntent[\s\S]{0,120}DeepLink\.consumeIntent\(intent\)/.test(MAIN));
ok("C2 task: navega para o detalhe da tarefa",
  /dl\.startsWith\("task:"\) -> "task\/\$\{dl\.removePrefix\("task:"\)\}"/.test(SCAFFOLD));
ok("C3 event: navega para o detalhe do evento",
  /dl\.startsWith\("event:"\) -> "event\/\$\{dl\.removePrefix\("event:"\)\}"/.test(SCAFFOLD));
ok("C4 chat: IGNORADO na navegação (não reintroduz Chat; sem rota de chat)",
  /dl\.startsWith\("chat:"\) -> return@LaunchedEffect/.test(SCAFFOLD) &&
  !/composable\("chat"\)/.test(SCAFFOLD));
ok("C5 rota desconhecida não derruba o app (runCatching na navegação)",
  /runCatching \{ nav\.navigate\(route\) \}/.test(SCAFFOLD));
ok("C6 ponte DeepLink preservada (extra deeplink_target + compat event_id)",
  /EXTRA_DEEPLINK = "deeplink_target"/.test(DEEP) && /EXTRA_EVENT_ID/.test(DEEP));

/* ── D: canais e permissões ── */
ok("D1 cinco canais criados (immediate/fullscreen v2/alarm compat/reminders/general)",
  ["CH_IMMEDIATE", "CH_ALARM_V2", "CH_ALARM", "CH_REMINDERS", "CH_GENERAL"].every(c => new RegExp(`createNotificationChannel[\\s\\S]{0,80}${c}`).test(NOTIF) || NOTIF.includes(c)) &&
  (NOTIF.match(/createNotificationChannel\(/g) || []).length >= 5);
ok("D2 permissão POST_NOTIFICATIONS no Manifest + pedido runtime no 13+",
  /android\.permission\.POST_NOTIFICATIONS/.test(MANIFEST) &&
  /Build\.VERSION\.SDK_INT >= 33 && !Notifications\.hasPostPermission/.test(SCAFFOLD));
ok("D3 notify() checa permissão antes de postar e garante o canal (ensure)",
  /if \(!hasPostPermission\(ctx\)\)/.test(NOTIF) && /ensure\(ctx\) \/\/ garante o canal antes de postar/.test(NOTIF));

/* ── E: PendingIntent seguro ── */
ok("E1 todos os PendingIntent com FLAG_IMMUTABLE",
  (NOTIF.match(/PendingIntent\.FLAG_IMMUTABLE or PendingIntent\.FLAG_UPDATE_CURRENT/g) || []).length >= 2 &&
  !/FLAG_MUTABLE/.test(NOTIF));
ok("E2 lembrete usa requestCode único por item (sem PendingIntent compartilhado)",
  /rawId\.takeIf \{ it\.isNotBlank\(\) \}\?\.hashCode\(\) \?: id/.test(NOTIF));

/* ── F: token server-side (decisão 6) e envio pós-save ── */
ok("F1 onNewToken re-registra via FcmApi/registerFcmToken (73G preservada)",
  /FcmApi\.register\(applicationContext, token\)/.test(SVC) && !/collection\("users"\)/.test(SVC));
ok("F2 Fcm.register segue server-side (sem Firestore)",
  /FcmApi\.register\(app, token\)/.test(FCM) && !/FirebaseFirestore/.test(FCM));
ok("F3 PushNotify envia só {type,id} ao Worker — sem token e sem segredo no payload",
  /put\("type", type\)\.put\("id", id\)/.test(PUSHN) && !/token|secret|senha/i.test(PUSHN.replace(/\/\/[^\n]*/g, "").replace(/notify-assignee|PushNotify/g, "")));

/* ── G: tokens sensíveis fora de log (decisão 8) ── */
ok("G1 token FCM nunca logado completo (máscara take(12) no FcmApi)",
  /t\.take\(12\) \+ "…"/.test(API));
ok("G2 token de sessão nunca aparece em log (service/notify/push/fcm)",
  ![SVC, NOTIF, PUSHN, FCM, API].some(s => /Log\.[a-z]+\([^)]*session/i.test(s)));

/* ── H: regressões 73C–73G ── */
ok("H1 login server-side intacto", /FN_LOGIN_URL/.test(AUTH));
ok("H2 Equipe usersPublic intacta", /collection\("usersPublic"\)/.test(USERS));
ok("H3 Board/Kanban canônico intacto",
  /COLUMNS = listOf\("afazer", "andamento", "revisao", "concluido"\)/.test(TYPES) && /descontinuado = true/.test(TYPES));
ok("H4 Copywriting segue fora da criação",
  /Sectors\.ALL\.filter \{ !it\.descontinuado \}\.forEach/.test(TASKFORM));
ok("H5 Agenda intacta (EventRepo preservado)",
  /collection\("events"\)\.addSnapshotListener/.test(rd(`${P}/data/EventRepo.kt`)));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
