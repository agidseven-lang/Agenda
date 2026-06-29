/* ID Seven — F3.3.21-B3.40J — Execucao REAL Web Push canaria: PREP / readiness.
 *
 * MODO REAL-RUN-PREP (NUNCA executa Web Push real):
 *   - Confirma as travas de seguranca (flags reais OFF; refs/canario fixos).
 *   - Verifica a PRONTIDAO dos 8 itens pre-execucao, com a versao do Android como
 *     GATE BLOQUEANTE (vazia/placeholder => REAL_RUN_BLOCKED).
 *   - Documenta os gates finais e os criterios de sucesso/parada/cleanup.
 *   - Emite REAL_RUN_PREP_READY (8/8 ok; execucao real ainda bloqueada por flags/fase)
 *     ou REAL_RUN_BLOCKED.
 *   - NAO abre browser, NAO carrega app live, NAO chama endpoint, NAO faz login,
 *     NAO cria token FCM, NAO registra SW real, NAO pede permissao, NAO chama getToken,
 *     NAO envia Web Push, NAO toca Firestore, NAO publica Hosting, NAO usa segredo.
 *
 * Mascara defensivamente valores sensiveis. Nunca imprime VAPID privada / token FCM /
 * session token / senha / hash / salt. Imports: somente node:fs.
 */
import fs from "node:fs";

const lc = (v, d) => String(process.env[v] || d || "").toLowerCase();
const sv = (v, d) => String(process.env[v] || d || "");

const CONFIRM_PREP    = sv("CONFIRM_REAL_RUN_PREP", "");
const DRY_RUN         = lc("DRY_RUN", "true") === "true";
const SOURCE_REF      = sv("SOURCE_REF", "app/main");
const TARGET_URL      = sv("TARGET_URL", "https://agenda-id-seven.web.app");
const CANARY_USER     = sv("CANARY_USER", "");
const CANARY_DEVICE   = sv("CANARY_DEVICE", "");
const CANARY_BROWSER  = sv("CANARY_BROWSER", "");
const ANDROID_VERSION = sv("ANDROID_VERSION", "");
const TEST_WINDOW     = sv("TEST_WINDOW", "");
const TEST_MESSAGE    = sv("TEST_MESSAGE", "");
const SEND_ROUTE      = sv("SEND_ROUTE", "");
const CLEANUP_APPROVER = sv("CLEANUP_APPROVER", "");
const WEBPUSH_REAL    = lc("WEBPUSH_REAL", "false") === "true";
const FCM_TOKEN_SERVER = lc("FCM_TOKEN_SERVER", "false") === "true";
const ALLOW_GETTOKEN  = lc("ALLOW_GET_TOKEN_REAL", "false") === "true";
const ALLOW_ENDPOINT  = lc("ALLOW_ENDPOINT_REAL", "false") === "true";
const ALLOW_PUSHSEND  = lc("ALLOW_PUSH_SEND_REAL", "false") === "true";
const ALLOW_FS_WRITE  = lc("ALLOW_FIRESTORE_WRITE", "false") === "true";
const HOSTING_PUBLISH = lc("HOSTING_PUBLISH", "false") === "true";
const OUT = sv("RETEST_OUT", "webpush-real-run-prep-artifacts");

const EXPECTED_URL  = "https://agenda-id-seven.web.app";
const EXPECTED_REF  = "app/main";
const EXPECTED_USER = "teste.webpush@idseven.com.br";

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b340j] " + m);
const maskEmail = (e) => { const s = String(e || ""); const i = s.indexOf("@"); return i > 0 ? ("***@" + s.slice(i + 1)) : (s ? "***" : ""); };
// android_version valida: contem digito e NAO contem placeholder "_" e nao e vazia.
const androidVersionValid = (v) => { const s = String(v || "").trim(); return s.length > 0 && /\d/.test(s) && !/_/.test(s); };

const summary = {
  phase: "F3.3.21-B3.40J-WEBPUSH-REAL-RUN-PREP",
  target: "webPushRealRunPrep",
  sourceRef: SOURCE_REF,
  targetUrl: TARGET_URL,
  dryRun: DRY_RUN,
  executed: false,
  // canario
  canaryUserMasked: maskEmail(CANARY_USER),
  canaryDevice: CANARY_DEVICE,
  canaryBrowser: CANARY_BROWSER,
  androidVersionProvided: androidVersionValid(ANDROID_VERSION),
  testWindow: TEST_WINDOW,
  testMessage: TEST_MESSAGE,
  sendRouteProvided: SEND_ROUTE.length > 0,
  cleanupApprover: CLEANUP_APPROVER,
  // pre-requisitos / gates (documentacao)
  scopeOneUserOneDevice: true,
  manualConsentRequired: true,
  secureSendRouteRequired: true,
  secretWithoutPrintingRequired: true,
  cleanupRequired: true,
  successCriteria: ["foreground", "background", "app_closed", "lockscreen"],
  stopCriteriaArmed: true,
  // status
  realExecutionBlocked: true,
  workflowSafeForRealValidation: false,
  // seguranca (por construcao; nada real e chamado)
  noEndpoint: true, noLogin: true, noFcmTokenCreated: true, noWebPushReal: true,
  noFirestoreWrite: true, noRealUser: true, noSecretPrinted: true, noDeploy: true, noHostingPublish: true,
};

function finish(ready) {
  summary.result = ready ? "REAL_RUN_PREP_READY" : "REAL_RUN_BLOCKED";
  summary.go = ready;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.40J — Web Push REAL run PREP (readiness) =====");
  console.log("  result=" + summary.result + " · executed=false · realExecutionBlocked=" + summary.realExecutionBlocked +
              " · androidVersionProvided=" + summary.androidVersionProvided);
  console.log("  canaryUser=" + summary.canaryUserMasked + " · device=" + CANARY_DEVICE +
              " · browser=" + CANARY_BROWSER + " · window=" + TEST_WINDOW);
  console.log("  noWebPushReal=true noFcmTokenCreated=true noEndpoint=true noFirestoreWrite=true noHostingPublish=true noDeploy=true noSecretPrinted=true");
  console.log("===============================================================");
  console.log("f3321-b340j Web Push real run prep: " + summary.result + (ready ? " (execucao real ainda bloqueada por flags/fase)" : (" (" + fails.length + " falhas)")));
  process.exit(ready ? 0 : 1);
}

// ---- Travas: NENHUMA execucao real nesta fase ----
function realGuards() {
  ok("confirm_real_run_prep == PREPARE_REAL_RUN_ONLY", CONFIRM_PREP === "PREPARE_REAL_RUN_ONLY");
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

// ---- Prontidao dos 8 itens pre-execucao (android_version e GATE bloqueante) ----
function readinessChecks() {
  ok("canary_device presente", CANARY_DEVICE.length > 0);
  ok("canary_browser presente", CANARY_BROWSER.length > 0);
  ok("test_window presente", TEST_WINDOW.length > 0);
  ok("test_message presente", TEST_MESSAGE.length > 0);
  ok("GATE: android_version preenchida (nao vazia/placeholder)", androidVersionValid(ANDROID_VERSION));
  ok("send_route segura definida", SEND_ROUTE.length > 0);
  ok("cleanup_approver definido", CLEANUP_APPROVER.length > 0);
  let docPresent = false;
  try { docPresent = fs.statSync("docs/webpush-real-validation-b340j-real-run-prep.md").size > 0; } catch (_) {}
  ok("doc do plano real-run-prep presente", docPresent);
  summary.planDocPresent = docPresent;
}

function main() {
  log("REAL-RUN-PREP (dry_run=" + DRY_RUN + "); execucao real NAO implementada nesta fase.");
  realGuards();
  if (fails.length > 0) return finish(false); // REAL_RUN_BLOCKED (flag real/refs/canario)
  readinessChecks();
  summary.executed = false;
  summary.realExecutionBlocked = true; // execucao real so em fase posterior, mesmo com 8/8
  return finish(fails.length === 0); // READY apenas se 8/8 (incl. android_version)
}

main();
