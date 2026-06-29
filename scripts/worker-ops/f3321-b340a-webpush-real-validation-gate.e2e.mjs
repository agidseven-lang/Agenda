/* ID Seven — F3.3.21-B3.40A — Web Push REAL validation GATE (prep / dry-run).
 *
 * MODO GATE / PLANEJAMENTO (sem execucao real):
 *   - Le, READ-ONLY, os arquivos PWA/FCM de app/main (preparados via `git show` pelo
 *     workflow em $APP_DIR): index.html, firebase-messaging-sw.js, sw.js, manifest.json,
 *     functions/index.js.
 *   - Valida ESTATICAMENTE a prontidao estrutural de Web Push/FCM do app.
 *   - DOCUMENTA, no summary, os pre-requisitos da futura validacao real E2E.
 *   - NAO abre browser, NAO carrega o app live, NAO chama endpoint, NAO faz login,
 *     NAO cria token FCM, NAO registra service worker real, NAO solicita Notification
 *     permission, NAO chama getToken, NAO envia Web Push, NAO toca Firestore,
 *     NAO faz Firestore write, NAO publica Hosting, NAO usa segredo.
 *
 * EXECUCAO REAL BLOQUEADA (fail-safe): se WEBPUSH_REAL / FCM_TOKEN_SERVER /
 *   ALLOW_ENDPOINT_REAL / ALLOW_GET_TOKEN_REAL / ALLOW_PUSH_SEND_REAL /
 *   ALLOW_FIRESTORE_WRITE / HOSTING_PUBLISH vierem "true", o runner FALHA (NO-GO)
 *   informando que a execucao real exige fase operacional propria (consentimento
 *   explicito + usuario canario + possivel dispositivo real). Esta fase NAO implementa
 *   execucao real.
 *
 * Nunca imprime VAPID privada / token FCM / session token / senha / hash / salt.
 * Imports de modulo: somente node:fs (sem rede, sem browser, sem Firebase/Admin).
 */
import fs from "node:fs";

const DRY_RUN              = String(process.env.DRY_RUN || "true").toLowerCase() === "true";
const SOURCE_REF          = String(process.env.SOURCE_REF || "app/main");
const TARGET_URL          = String(process.env.TARGET_URL || "https://agenda-id-seven.web.app");
const APP_DIR             = String(process.env.APP_DIR || "");
const WEBPUSH_REAL        = String(process.env.WEBPUSH_REAL || "false").toLowerCase() === "true";
const FCM_TOKEN_SERVER    = String(process.env.FCM_TOKEN_SERVER || "false").toLowerCase() === "true";
const REQUIRE_MANUAL_DEV  = String(process.env.REQUIRE_MANUAL_DEVICE || "true").toLowerCase() === "true";
const REQUIRE_CANARY_USER = String(process.env.REQUIRE_CANARY_USER || "true").toLowerCase() === "true";
const ALLOW_ENDPOINT_REAL = String(process.env.ALLOW_ENDPOINT_REAL || "false").toLowerCase() === "true";
const ALLOW_GETTOKEN_REAL = String(process.env.ALLOW_GET_TOKEN_REAL || "false").toLowerCase() === "true";
const ALLOW_PUSHSEND_REAL = String(process.env.ALLOW_PUSH_SEND_REAL || "false").toLowerCase() === "true";
const ALLOW_FS_WRITE      = String(process.env.ALLOW_FIRESTORE_WRITE || "false").toLowerCase() === "true";
const HOSTING_PUBLISH     = String(process.env.HOSTING_PUBLISH || "false").toLowerCase() === "true";
const OUT                 = String(process.env.RETEST_OUT || "webpush-real-validation-gate-artifacts");

const EXPECTED_URL = "https://agenda-id-seven.web.app";

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b340a] " + m);

const summary = {
  phase: "F3.3.21-B3.40A-WEBPUSH-REAL-VALIDATION-GATE",
  target: "webPushRealValidationGate",
  sourceRef: SOURCE_REF,
  targetUrl: TARGET_URL,
  dryRun: DRY_RUN,
  executed: false,
  webPushReal: false,
  fcmTokenServer: false,
  structuralReadiness: false,
  // pre-requisitos da futura validacao real (documentacao; nada e executado)
  browserRealRequired: true,
  serviceWorkerRealRequired: true,
  notificationPermissionRealRequired: true,
  getTokenRealRequired: true,
  fcmTokenRealRequired: true,
  canaryUserRequired: REQUIRE_CANARY_USER,
  endpointRealRequiredForServerPath: true,
  pushSendRealRequired: true,
  androidRealDeviceRequiredForLockscreen: REQUIRE_MANUAL_DEV,
  manualConsentRequired: true,
  // status do gate
  workflowSafeForRealValidation: false,
  requiresPrepPr: true,
  requiresManualOperationalConsent: true,
  requiresCanaryUser: true,
  requiresRealDeviceForLockscreen: true,
  // seguranca (por construcao deste runner; nada real e chamado)
  noEndpoint: true, noLogin: true, noFcmTokenCreated: true, noWebPushReal: true,
  noFirestoreWrite: true, noRealUser: true, noSecretPrinted: true, noDeploy: true, noHostingPublish: true,
};

function readApp(rel) {
  try { return fs.readFileSync(APP_DIR + "/" + rel, "utf8"); } catch (_) { return null; }
}

function finish() {
  summary.go = fails.length === 0;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.40A — Web Push REAL validation GATE (prep/planejamento) =====");
  console.log("  targetUrl=" + TARGET_URL + " · executed=" + summary.executed +
              " · structuralReadiness=" + summary.structuralReadiness +
              " · workflowSafeForRealValidation=" + summary.workflowSafeForRealValidation +
              " · requiresManualOperationalConsent=" + summary.requiresManualOperationalConsent);
  console.log("  noEndpoint=" + summary.noEndpoint + " noLogin=" + summary.noLogin +
              " noFcmTokenCreated=" + summary.noFcmTokenCreated + " noWebPushReal=" + summary.noWebPushReal +
              " noFirestoreWrite=" + summary.noFirestoreWrite + " noHostingPublish=" + summary.noHostingPublish);
  console.log("=============================================================================");
  console.log("f3321-b340a Web Push real validation gate: " + (summary.go ? "GO (prep)" : ("NO-GO (" + fails.length + " falhas)")));
  process.exit(summary.go ? 0 : 1);
}

// ---- Fail-safe: NENHUMA execucao real e permitida nesta fase ----
function realGuards() {
  ok("hosting_publish=false", HOSTING_PUBLISH === false);
  ok("webpush_real=false (execucao real exige fase operacional propria)", WEBPUSH_REAL === false);
  ok("fcm_token_server=false (nao ativar flag nesta fase)", FCM_TOKEN_SERVER === false);
  ok("allow_endpoint_real=false", ALLOW_ENDPOINT_REAL === false);
  ok("allow_get_token_real=false", ALLOW_GETTOKEN_REAL === false);
  ok("allow_push_send_real=false", ALLOW_PUSHSEND_REAL === false);
  ok("allow_firestore_write=false", ALLOW_FS_WRITE === false);
  ok("source_ref == app/main", SOURCE_REF === "app/main");
  ok("target_url == " + EXPECTED_URL, TARGET_URL === EXPECTED_URL);
}

// ---- Validacao estrutural estatica (read-only; sem conteudo sensivel impresso) ----
function structuralChecks() {
  const idx = readApp("index.html");
  const fms = readApp("firebase-messaging-sw.js");
  const sw  = readApp("sw.js");
  const man = readApp("manifest.json");
  const fn  = readApp("functions/index.js");

  const checks = [];
  const c = (n, cond) => { checks.push(!!cond); ok(n, cond); };

  c("firebase-messaging-sw.js existe", !!fms && fms.length > 0);
  c("firebase-messaging-sw.js contem Firebase Messaging", !!fms && /firebase-messaging|firebase\.messaging\(\)|messaging-compat/i.test(fms));
  c("firebase-messaging-sw.js contem onBackgroundMessage", !!fms && /onBackgroundMessage/.test(fms));
  c("firebase-messaging-sw.js contem showNotification", !!fms && /showNotification/.test(fms));
  c("firebase-messaging-sw.js contem notificationclick", !!fms && /notificationclick/i.test(fms));
  c("manifest.json existe", !!man && man.length > 0);
  c("sw.js existe", !!sw && sw.length > 0);
  c("index.html contem Notification.requestPermission", !!idx && /Notification\.requestPermission/.test(idx));
  c("index.html contem serviceWorker.register", !!idx && /serviceWorker\.register/.test(idx));
  c("index.html referencia firebase-messaging-sw.js", !!idx && /firebase-messaging-sw\.js/.test(idx));
  c("index.html contem getToken", !!idx && /getToken/.test(idx));
  c("index.html contem VAPID public key/constante", !!idx && /vapidKey|PUSH_VAPID_KEY|VAPID/i.test(idx));
  c("index.html contem registerFcmTokenClient", !!idx && /registerFcmTokenClient/.test(idx));
  c("index.html contem removeFcmTokenClient", !!idx && /removeFcmTokenClient/.test(idx));
  c("functions/index.js contem registerFcmToken", !!fn && /registerFcmToken/.test(fn));
  c("functions/index.js contem removeMyFcmToken", !!fn && /removeMyFcmToken/.test(fn));

  summary.structuralReadiness = checks.every(Boolean);
  summary.filesPresent = {
    indexHtml: !!idx, firebaseMessagingSw: !!fms, sw: !!sw, manifest: !!man, functionsIndex: !!fn,
  };
}

function main() {
  log("gate de preparacao (dry_run=" + DRY_RUN + "); execucao real NAO implementada nesta fase.");
  realGuards();
  if (fails.length > 0) {
    // Inputs reais solicitados ou refs invalidas => fail-safe; nao roda checagem estrutural.
    summary.workflowSafeForRealValidation = false;
    summary.structuralReadiness = false;
    return finish();
  }
  structuralChecks();
  // Gate de PREP: mesmo com estrutura pronta, a validacao real continua BLOQUEADA aqui.
  summary.executed = false;
  summary.workflowSafeForRealValidation = false;
  summary.requiresPrepPr = true;
  summary.requiresManualOperationalConsent = true;
  return finish();
}

main();
