#!/usr/bin/env node
/* =====================================================================
   F3.3.73G — Testes HERMÉTICOS (texto/fonte) da migração do TOKEN FCM
   Android para os endpoints SERVER-SIDE:
     - registro via registerFcmToken (payload {token, deviceId, platform},
       bearer da sessão 73C; dedup por deviceId no SERVIDOR);
     - remoção no logout via removeMyFcmToken (antes do clear da sessão);
     - reset TOTAL preparado via resetMyFcmTokens (sem UI nova);
     - escrita direta em users/{uid} REMOVIDA de Fcm/Service (Rules fecharam
       write em users — o fluxo antigo estava quebrado em produção);
     - token FCM nunca logado completo; token de sessão nunca logado;
     - FirebaseMessagingService (onMessageReceived/deep-links) preservado;
     - regressões 73C–73F intactas.
   Lê Kotlin como TEXTO — NÃO compila, NÃO gera APK, NÃO chama rede, NÃO escreve.
   Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow.
   Compilação real: android-compile-check.yml (compileDebugKotlin, sem APK).
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const P = "src/main/java/br/com/idseven/agenda/nativebeta";
const FCM = rd(`${P}/core/Fcm.kt`);
const SVC = rd(`${P}/core/AppFirebaseMessagingService.kt`);
const API = rd(`${P}/data/FcmApi.kt`);
const APPROOT = rd(`${P}/core/AppRoot.kt`);
const AUTH = rd(`${P}/data/AuthRepo.kt`);
const SESS = rd(`${P}/data/SessionStore.kt`);
const USERS = rd(`${P}/data/UsersRepo.kt`);
const TYPES = rd(`${P}/domain/Types.kt`);
const SCAFFOLD = rd(`${P}/core/MainScaffold.kt`);
const PROFILE = rd(`${P}/features/profile/ProfileScreen.kt`);
const GRADLE = rd("build.gradle");
const MANIFEST = rd("src/main/AndroidManifest.xml");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73G — FCM token server-side Android (hermético por texto)");

/* ── A: escrita direta em users/{uid} REMOVIDA do fluxo FCM ── */
ok("A1 Fcm.kt não escreve mais no Firestore (users/fcmTokens/arrayUnion)",
  !/collection\("users"\)/.test(FCM) && !/FieldValue|FieldPath|FirebaseFirestore/.test(FCM));
ok("A2 onNewToken não escreve mais no Firestore",
  !/collection\("users"\)/.test(SVC) && !/FieldValue|FirebaseFirestore/.test(SVC));
ok("A3 nenhum arrayUnion de fcmTokens restante no app",
  !/fcmTokens.*arrayUnion|arrayUnion\(.*token/i.test(FCM + SVC + API + APPROOT));

/* ── B: registerFcmToken server-side ── */
ok("B1 FcmApi.register chama o endpoint com bearer da sessão",
  /REGISTER_FCM_TOKEN_URL/.test(API) && /AuthRepo\.postJson\(FN_REGISTER_URL, payload, bearer = session\)/.test(API));
ok("B2 payload do contrato {token, deviceId, platform}",
  /put\("token", fcmToken\)/.test(API) && /put\("deviceId", stableDeviceId\(ctx\)\)/.test(API) &&
  /put\("platform", "android-native"\)/.test(API));
ok("B3 Fcm.register usa FcmApi (endpoint) após obter o token",
  /FirebaseMessaging\.getInstance\(\)\.token/.test(FCM) && /FcmApi\.register\(app, token\)/.test(FCM));
ok("B4 rotação (onNewToken) re-registra via FcmApi",
  /FcmApi\.register\(applicationContext, token\)/.test(SVC));
ok("B5 sessão ausente → skip silencioso (best-effort, não quebra login)",
  /FCM_REGISTER_SKIP/.test(API) && /isNullOrBlank\(\)/.test(API));

/* ── C: removeMyFcmToken no logout + resetMyFcmTokens preparado ── */
ok("C1 logout remove o token do aparelho ANTES de limpar a sessão",
  /runCatching \{ FcmApi\.removeCurrentToken\(context\) \}; sessionStore\.clear\(\)/.test(APPROOT));
ok("C2 removeCurrentToken usa o endpoint com o token local + sessão",
  /REMOVE_MY_FCM_TOKEN_URL/.test(API) && /getSharedPreferences\("fcm"/.test(API) &&
  /AuthRepo\.postJson\(FN_REMOVE_URL, JSONObject\(\)\.put\("token", fcmToken\), bearer = session\)/.test(API));
ok("C3 resetAll preparado via resetMyFcmTokens (sem UI nova nesta fase)",
  /RESET_MY_FCM_TOKENS_URL/.test(API) && /suspend fun resetAll\(/.test(API) &&
  !/resetAll\(/.test(SCAFFOLD + PROFILE + APPROOT));

/* ── D: segurança de logs e sessão ── */
ok("D1 token FCM nunca logado completo (só prefixo mascarado)",
  /t\.take\(12\) \+ "…"/.test(API) && !/Log\.[a-z]+\([^)]*fcmToken[^)]*\)/.test(API.replace(/mask\(fcmToken\)/g, "")));
ok("D2 token de sessão nunca aparece em log (Fcm/FcmApi/Service/AppRoot)",
  ![FCM, API, SVC, APPROOT].some(s => /Log\.[a-z]+\([^)]*session/i.test(s)));
ok("D3 sessão lida do SessionStore seguro da 73C (EncryptedSharedPreferences)",
  /SessionStore\(ctx\)\.token\(\)/.test(API) && /EncryptedSharedPreferences/.test(SESS));
ok("D4 rede fora da main thread (Dispatchers.IO em todas as chamadas)",
  (API.match(/withContext\(Dispatchers\.IO\)/g) || []).length >= 3 && /Dispatchers\.IO/.test(FCM));

/* ── E: BuildConfig/URLs injetáveis (padrão 73C) ── */
ok("E1 três URLs com default público Gen2 + override -P no CI",
  /REGISTER_FCM_TOKEN_URL.*registerfcmtoken-de36pi7vza-uc\.a\.run\.app/.test(GRADLE) &&
  /REMOVE_MY_FCM_TOKEN_URL.*removemyfcmtoken-de36pi7vza-uc\.a\.run\.app/.test(GRADLE) &&
  /RESET_MY_FCM_TOKENS_URL.*resetmyfcmtokens-de36pi7vza-uc\.a\.run\.app/.test(GRADLE));
ok("E2 BuildConfig consumido pelo FcmApi",
  /BuildConfig\.REGISTER_FCM_TOKEN_URL/.test(API) && /BuildConfig\.REMOVE_MY_FCM_TOKEN_URL/.test(API) &&
  /BuildConfig\.RESET_MY_FCM_TOKENS_URL/.test(API));

/* ── F: FirebaseMessagingService e permissões preservados ── */
ok("F1 onMessageReceived preservado (notificação imediata + deep-link + lembrete 1h)",
  /onMessageReceived/.test(SVC) && /deepLink/.test(SVC) && /ReminderScheduler\.scheduleFromFcm/.test(SVC));
ok("F2 supressão foreground de task preservada",
  /AppForeground\.isForeground && data\["type"\] == "task"/.test(SVC));
ok("F3 service registrado no Manifest + permissão POST_NOTIFICATIONS",
  /AppFirebaseMessagingService/.test(MANIFEST) && /POST_NOTIFICATIONS/.test(MANIFEST));
ok("F4 prefs uid/token preservadas (Perfil 'este aparelho' + rotação + logout)",
  /putString\("uid", uid\)/.test(FCM) && /putString\("token", token\)/.test(FCM + SVC));
ok("F5 Perfil segue com Reenviar via Fcm.register (sem UI nova)",
  /Fcm\.register\(context, session\.uid\)/.test(PROFILE));

/* ── G: regressões 73C–73F preservadas ── */
ok("G1 login server-side intacto (loginUser/getUserSelf; postJson reusado como internal)",
  /FN_LOGIN_URL/.test(AUTH) && /internal suspend fun postJson/.test(AUTH));
ok("G2 Equipe usersPublic intacta", /collection\("usersPublic"\)/.test(USERS));
ok("G3 Board/Kanban canônico intacto (colunas + copywriting descontinuado)",
  /COLUMNS = listOf\("afazer", "andamento", "revisao", "concluido"\)/.test(TYPES) &&
  /descontinuado = true/.test(TYPES));
ok("G4 Chat segue fora do fluxo principal", !/Tab\("chat"/.test(SCAFFOLD));
ok("G5 Agenda intacta (EventRepo/contrato não tocados nesta fase)",
  /collection\("events"\)\.addSnapshotListener/.test(rd(`${P}/data/EventRepo.kt`)));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
