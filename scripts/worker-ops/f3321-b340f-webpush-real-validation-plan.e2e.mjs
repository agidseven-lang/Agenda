/* ID Seven — F3.3.21-B3.40F — Web Push REAL validation PLAN (prep; sem execucao real).
 *
 * MODO PLAN-PREP (NUNCA executa Web Push real):
 *   - Captura os dados operacionais do canario (usuario/dispositivo/navegador/janela/
 *     mensagem) fornecidos via env pelo workflow.
 *   - Confirma as travas de seguranca (todas as flags reais OFF; refs/canario fixos).
 *   - Documenta os pre-requisitos tecnicos e os itens PENDENTES que bloqueiam a
 *     execucao real.
 *   - Emite PLAN_READY (scaffold pronto e seguro; execucao real bloqueada) ou
 *     PLAN_BLOCKED (flag real ligada / refs/canario divergentes).
 *   - NAO abre browser, NAO carrega app live, NAO chama endpoint, NAO faz login,
 *     NAO cria token FCM, NAO registra SW real, NAO pede permissao, NAO chama getToken,
 *     NAO envia Web Push, NAO toca Firestore, NAO publica Hosting, NAO usa segredo.
 *
 * Mascara defensivamente qualquer valor sensivel. Nunca imprime VAPID privada /
 * token FCM / session token / senha / hash / salt. Imports: somente node:fs.
 */
import fs from "node:fs";

const lc = (v, d) => String(process.env[v] || d || "").toLowerCase();
const sv = (v, d) => String(process.env[v] || d || "");

const CONFIRM_PLAN   = sv("CONFIRM_PLAN", "");
const DRY_RUN        = lc("DRY_RUN", "true") === "true";
const SOURCE_REF     = sv("SOURCE_REF", "app/main");
const TARGET_URL     = sv("TARGET_URL", "https://agenda-id-seven.web.app");
const CANARY_USER    = sv("CANARY_USER", "");
const CANARY_DEVICE  = sv("CANARY_DEVICE", "");
const CANARY_BROWSER = sv("CANARY_BROWSER", "");
const TEST_WINDOW    = sv("TEST_WINDOW", "");
const TEST_MESSAGE   = sv("TEST_MESSAGE", "");
const WEBPUSH_REAL   = lc("WEBPUSH_REAL", "false") === "true";
const FCM_TOKEN_SERVER = lc("FCM_TOKEN_SERVER", "false") === "true";
const ALLOW_GETTOKEN = lc("ALLOW_GET_TOKEN_REAL", "false") === "true";
const ALLOW_ENDPOINT = lc("ALLOW_ENDPOINT_REAL", "false") === "true";
const ALLOW_PUSHSEND = lc("ALLOW_PUSH_SEND_REAL", "false") === "true";
const ALLOW_FS_WRITE = lc("ALLOW_FIRESTORE_WRITE", "false") === "true";
const HOSTING_PUBLISH = lc("HOSTING_PUBLISH", "false") === "true";
const OUT = sv("RETEST_OUT", "webpush-real-validation-plan-artifacts");

const EXPECTED_URL  = "https://agenda-id-seven.web.app";
const EXPECTED_REF  = "app/main";
const EXPECTED_USER = "teste.webpush@idseven.com.br";

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b340f] " + m);
// Mascara defensiva: mostra so o dominio de um e-mail; nunca valores sensiveis.
const maskEmail = (e) => { const s = String(e || ""); const i = s.indexOf("@"); return i > 0 ? ("***@" + s.slice(i + 1)) : (s ? "***" : ""); };

const summary = {
  phase: "F3.3.21-B3.40F-WEBPUSH-REAL-VALIDATION-PLAN",
  target: "webPushRealValidationPlan",
  sourceRef: SOURCE_REF,
  targetUrl: TARGET_URL,
  dryRun: DRY_RUN,
  executed: false,
  // canario (mascara o e-mail; demais sao rotulos nao-sensiveis fornecidos pelo owner)
  canaryUserMasked: maskEmail(CANARY_USER),
  canaryDevice: CANARY_DEVICE,
  canaryBrowser: CANARY_BROWSER,
  testWindow: TEST_WINDOW,
  testMessage: TEST_MESSAGE,
  // pre-requisitos tecnicos (documentacao; nada e executado)
  browserRealRequired: true,
  serviceWorkerRealRequired: true,
  notificationPermissionRealRequired: true,
  getTokenRealRequired: true,
  fcmTokenRealRequired: true,
  canaryUserRequired: true,
  realAndroidDeviceRequired: true,
  lockscreenValidationRequired: true,
  manualConsentRequired: true,
  cleanupRequired: true,
  // status do plano
  workflowSafeForRealValidation: false,
  requiresManualOperationalConsent: true,
  requiresCanaryUser: true,
  requiresRealDeviceForLockscreen: true,
  realExecutionBlocked: true,
  // itens pendentes que bloqueiam a execucao real
  pendingItems: [
    "android_version",
    "manual_notification_permission_confirmed",
    "secure_fcm_send_route",
    "send_credential_available_without_printing",
    "final_cleanup_criterion",
    "success_criteria_foreground_background_appclosed_lockscreen",
    "operational_stop_criterion",
    "cleanup_final_approver",
  ],
  // seguranca (por construcao deste runner; nada real e chamado)
  noEndpoint: true, noLogin: true, noFcmTokenCreated: true, noWebPushReal: true,
  noFirestoreWrite: true, noRealUser: true, noSecretPrinted: true, noDeploy: true, noHostingPublish: true,
};

function finish(planReady) {
  summary.result = planReady ? "PLAN_READY" : "PLAN_BLOCKED";
  summary.go = planReady;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.40F — Web Push REAL validation PLAN (prep) =====");
  console.log("  targetUrl=" + TARGET_URL + " · executed=false · result=" + summary.result +
              " · workflowSafeForRealValidation=" + summary.workflowSafeForRealValidation +
              " · realExecutionBlocked=" + summary.realExecutionBlocked);
  console.log("  canaryUser=" + summary.canaryUserMasked + " · device=" + CANARY_DEVICE +
              " · browser=" + CANARY_BROWSER + " · window=" + TEST_WINDOW);
  console.log("  pendingItems=" + summary.pendingItems.length +
              " · noWebPushReal=true noFcmTokenCreated=true noEndpoint=true noFirestoreWrite=true noHostingPublish=true noDeploy=true");
  console.log("================================================================");
  console.log("f3321-b340f Web Push real validation plan: " + summary.result + (planReady ? " (execucao real BLOQUEADA ate fase posterior)" : (" (" + fails.length + " falhas)")));
  process.exit(planReady ? 0 : 1);
}

// ---- Travas: NENHUMA execucao real e permitida nesta fase ----
function realGuards() {
  ok("confirm_plan == PREPARE_ONLY", CONFIRM_PLAN === "PREPARE_ONLY");
  ok("webpush_real=false", WEBPUSH_REAL === false);
  ok("fcm_token_server=false (nao ativar flag)", FCM_TOKEN_SERVER === false);
  ok("allow_get_token_real=false", ALLOW_GETTOKEN === false);
  ok("allow_endpoint_real=false", ALLOW_ENDPOINT === false);
  ok("allow_push_send_real=false", ALLOW_PUSHSEND === false);
  ok("allow_firestore_write=false", ALLOW_FS_WRITE === false);
  ok("hosting_publish=false", HOSTING_PUBLISH === false);
  ok("source_ref == " + EXPECTED_REF, SOURCE_REF === EXPECTED_REF);
  ok("target_url == " + EXPECTED_URL, TARGET_URL === EXPECTED_URL);
  ok("canary_user == canario esperado", CANARY_USER === EXPECTED_USER);
}

// ---- Prontidao do PLANO (dados do owner capturados) ----
function planChecks() {
  ok("plano: canary_user presente", CANARY_USER.length > 0);
  ok("plano: canary_device presente", CANARY_DEVICE.length > 0);
  ok("plano: canary_browser presente", CANARY_BROWSER.length > 0);
  ok("plano: test_window presente", TEST_WINDOW.length > 0);
  ok("plano: test_message presente", TEST_MESSAGE.length > 0);
  // doc do plano presente no repo (read-only)
  let docPresent = false;
  try { docPresent = fs.statSync("docs/webpush-real-validation-b340f-plan.md").size > 0; } catch (_) {}
  ok("plano: documento docs/webpush-real-validation-b340f-plan.md presente", docPresent);
  summary.planDocPresent = docPresent;
}

function main() {
  log("PLAN-PREP (dry_run=" + DRY_RUN + "); execucao real NAO implementada nesta fase.");
  realGuards();
  if (fails.length > 0) {
    summary.workflowSafeForRealValidation = false;
    return finish(false); // PLAN_BLOCKED
  }
  planChecks();
  // Mesmo com o plano pronto, a execucao real continua BLOQUEADA aqui.
  summary.executed = false;
  summary.workflowSafeForRealValidation = false;
  summary.realExecutionBlocked = true;
  return finish(fails.length === 0); // PLAN_READY se dados do owner presentes
}

main();
