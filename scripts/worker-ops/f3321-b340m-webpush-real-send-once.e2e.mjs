/* ID Seven — F3.3.21-B3.40M — Web Push REAL send-once (canario). PREP + gate.
 *
 * DOIS MODOS:
 *   (1) PREP / dry-run (PADRAO): valida plano + inputs + escopo 1/1. NAO chama
 *       endpoint, NAO envia push, NAO le segredo, NAO toca Firestore, NAO cria token,
 *       NAO faz login, NAO abre browser. Emite PREP_READY ou PREP_BLOCKED.
 *   (2) FUTURE_REAL_SEND (fase posterior, autorizada): envia EXATAMENTE 1 push para
 *       1 token canario. **NAO e executado nesta fase.** So e alcancavel com:
 *         DRY_RUN=false  E  ALLOW_PUSH_SEND_REAL=true  E  CONFIRM_REAL_SEND correto
 *         E  escopo 1/1  E  canario correto  E  CANARY_FCM_TOKEN presente
 *         E  FCM_SEND_BEARER (segredo) presente  E  cleanup planeado.
 *       Faltando qualquer um => aborta ANTES de qualquer rede. Nesta fase os defaults
 *       (DRY_RUN=true, ALLOW_PUSH_SEND_REAL=false, sem segredo, sem token) tornam o
 *       caminho real inalcancavel.
 *
 * Seguranca: NUNCA imprime token FCM, VAPID privada, session token, senha, hash, salt
 * ou segredo. Sem envio base-wide (escopo 1/1 imposto). Imports: somente node:fs
 * (fetch e global no Node 20+, usado SO no caminho real gated).
 */
import fs from "node:fs";

const lc = (v, d) => String(process.env[v] || d || "").toLowerCase();
const sv = (v, d) => String(process.env[v] || d || "");

const CONFIRM_REAL_SEND = sv("CONFIRM_REAL_SEND", "");
const DRY_RUN          = lc("DRY_RUN", "true") === "true";
const SOURCE_REF       = sv("SOURCE_REF", "app/main");
const TARGET_URL       = sv("TARGET_URL", "https://agenda-id-seven.web.app");
const CANARY_USER      = sv("CANARY_USER", "");
const CANARY_DEVICE    = sv("CANARY_DEVICE", "");
const ANDROID_VERSION  = sv("ANDROID_VERSION", "");
const CANARY_BROWSER   = sv("CANARY_BROWSER", "");
const TEST_MESSAGE     = sv("TEST_MESSAGE", "");
const MAX_TARGETS      = sv("MAX_TARGETS", "1");
const MAX_DEVICES      = sv("MAX_DEVICES", "1");
const WEBPUSH_REAL     = lc("WEBPUSH_REAL", "false") === "true";
const ALLOW_GETTOKEN   = lc("ALLOW_GET_TOKEN_REAL", "false") === "true";
const ALLOW_ENDPOINT   = lc("ALLOW_ENDPOINT_REAL", "false") === "true";
const ALLOW_PUSHSEND   = lc("ALLOW_PUSH_SEND_REAL", "false") === "true";
const ALLOW_FS_WRITE   = lc("ALLOW_FIRESTORE_WRITE", "false") === "true";
const ALLOW_CLEANUP    = lc("ALLOW_CLEANUP", "false") === "true";
const HOSTING_PUBLISH  = lc("HOSTING_PUBLISH", "false") === "true";
const FCM_TOKEN_SERVER = lc("FCM_TOKEN_SERVER", "false") === "true";
// Fornecidos SOMENTE na fase real autorizada, por canal seguro / secret. Ausentes aqui.
const CANARY_FCM_TOKEN = sv("CANARY_FCM_TOKEN", "");   // nunca impresso
const FCM_SEND_BEARER  = sv("FCM_SEND_BEARER", "");    // segredo; nunca impresso
const OUT = sv("RETEST_OUT", "webpush-real-send-once-artifacts");

const EXPECTED = {
  ref: "app/main",
  url: "https://agenda-id-seven.web.app",
  user: "teste.webpush@idseven.com.br",
  device: "Samsung Galaxy Note 20 Ultra",
  browser: "Chrome Android",
  confirm: "RUN_WEBPUSH_REAL_SEND_ONCE",
};

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b340m] " + m);
const maskEmail = (e) => { const s = String(e || ""); const i = s.indexOf("@"); return i > 0 ? ("***@" + s.slice(i + 1)) : (s ? "***" : ""); };
// Tokens/segredos NUNCA sao impressos: reportamos apenas presenca booleana.
const present = (s) => (String(s || "").length > 0);
// android_version valida: nao vazia, com digito e sem placeholder "_".
const androidVersionValid = (v) => { const s = String(v || "").trim(); return s.length > 0 && /\d/.test(s) && !/_/.test(s); };

const summary = {
  phase: "F3.3.21-B3.40M-WEBPUSH-REAL-SEND-ONCE",
  target: "webPushRealSendOnce",
  sourceRef: SOURCE_REF,
  targetUrl: TARGET_URL,
  dryRun: DRY_RUN,
  executed: false,
  mode: null,
  result: null,
  // canario (e-mail mascarado; rotulos nao-sensiveis)
  canaryUserMasked: maskEmail(CANARY_USER),
  canaryDevice: CANARY_DEVICE,
  androidVersion: ANDROID_VERSION,
  canaryBrowser: CANARY_BROWSER,
  testMessage: TEST_MESSAGE,
  maxTargets: MAX_TARGETS,
  maxDevices: MAX_DEVICES,
  // presenca (NUNCA valores) de token/segredo
  canaryTokenProvided: present(CANARY_FCM_TOKEN),
  sendBearerProvided: present(FCM_SEND_BEARER),
  // requisitos
  scopeOneUserOneDevice: true,
  cleanupRequired: true,
  cleanupPlanned: ALLOW_CLEANUP,
  manualConsentRequired: true,
  realAndroidDeviceRequired: true,
  lockscreenValidationRequired: true,
  // status
  realSendAuthorizedThisPhase: false,
  realExecutionBlocked: true,
  // seguranca (por construcao nesta fase; nada real e chamado)
  noEndpoint: true, noLogin: true, noFcmTokenCreated: true, noPushSent: true,
  noFirestoreWrite: true, noRealUser: true, noSecretPrinted: true, noDeploy: true, noHostingPublish: true,
};

function finish(go) {
  summary.go = go;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.40M — Web Push REAL send-once (canario) =====");
  console.log("  mode=" + summary.mode + " · result=" + summary.result + " · executed=" + summary.executed +
              " · realExecutionBlocked=" + summary.realExecutionBlocked);
  console.log("  canaryUser=" + summary.canaryUserMasked + " · device=" + CANARY_DEVICE + " · android=" + ANDROID_VERSION +
              " · maxTargets=" + MAX_TARGETS + " · maxDevices=" + MAX_DEVICES);
  console.log("  canaryTokenProvided=" + summary.canaryTokenProvided + " · sendBearerProvided=" + summary.sendBearerProvided +
              " · noPushSent=" + summary.noPushSent + " · noSecretPrinted=true noHostingPublish=true noDeploy=true");
  console.log("==============================================================");
  console.log("f3321-b340m Web Push real send-once: " + summary.result);
  process.exit(go ? 0 : 1);
}

// ---- Escopo / canario / travas (validas em ambos os modos) ----
function scopeGuards() {
  ok("confirm_real_send == " + EXPECTED.confirm, CONFIRM_REAL_SEND === EXPECTED.confirm);
  ok("source_ref == app/main", SOURCE_REF === EXPECTED.ref);
  ok("target_url == web.app", TARGET_URL === EXPECTED.url);
  ok("canary_user == canario esperado", CANARY_USER === EXPECTED.user);
  ok("canary_device == Samsung Galaxy Note 20 Ultra", CANARY_DEVICE === EXPECTED.device);
  ok("android_version preenchida (nao vazia/placeholder)", androidVersionValid(ANDROID_VERSION));
  ok("canary_browser == Chrome Android", CANARY_BROWSER === EXPECTED.browser);
  ok("max_targets == 1", MAX_TARGETS === "1");
  ok("max_devices == 1", MAX_DEVICES === "1");
  ok("test_message presente", TEST_MESSAGE.length > 0);
  // travas globais de seguranca
  ok("fcm_token_server=false (nao ativar)", FCM_TOKEN_SERVER === false);
  ok("hosting_publish=false", HOSTING_PUBLISH === false);
  ok("allow_firestore_write=false (sem write nesta fase)", ALLOW_FS_WRITE === false);
  ok("sem indicio de base-wide (max_targets=1 & max_devices=1)", MAX_TARGETS === "1" && MAX_DEVICES === "1");
}

// ---- FUTURE_REAL_SEND: existe apenas como codigo protegido por gate. NAO executado nesta fase. ----
async function realSendOnce() {
  // Defesa em profundidade: aborta ANTES de qualquer rede se faltar qualquer pre-condicao.
  if (DRY_RUN) { fail("real send com DRY_RUN=true — abortado"); return false; }
  if (!ALLOW_PUSHSEND) { fail("allow_push_send_real=false — abortado"); return false; }
  if (CONFIRM_REAL_SEND !== EXPECTED.confirm) { fail("confirm_real_send invalido — abortado"); return false; }
  if (MAX_TARGETS !== "1" || MAX_DEVICES !== "1") { fail("escopo != 1/1 — abortado"); return false; }
  if (CANARY_USER !== EXPECTED.user) { fail("usuario nao-canario — abortado"); return false; }
  if (!present(CANARY_FCM_TOKEN)) { fail("token canario ausente — abortado"); return false; }
  if (!present(FCM_SEND_BEARER)) { fail("credencial de envio ausente — abortado"); return false; }
  if (!ALLOW_CLEANUP) { fail("cleanup nao planejado — abortado"); return false; }
  if (fails.length > 0) return false;
  // EXATAMENTE 1 mensagem para EXATAMENTE 1 token. Token/segredo nunca sao impressos.
  const body = { message: { token: CANARY_FCM_TOKEN, notification: { title: "ID Seven", body: TEST_MESSAGE } } };
  let status = 0;
  try {
    const resp = await fetch("https://fcm.googleapis.com/v1/projects/agenda-id-seven/messages:send", {
      method: "POST",
      headers: { "Authorization": "Bearer " + FCM_SEND_BEARER, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    status = resp.status; // apenas o status HTTP e registrado (sem corpo/token)
  } catch (e) { fail("envio real falhou (sem vazar valores): " + (e && e.name)); return false; }
  summary.realSendHttpStatus = status;
  summary.executed = true;
  summary.noPushSent = false; // 1 push real foi enviado (apenas nesta fase futura)
  return status >= 200 && status < 300;
}

function runPrep() {
  summary.mode = "PREP";
  scopeGuards();
  // Em PREP, requisitos de prontidao para a futura execucao real (informativo):
  summary.readyForFutureRealSend = (fails.length === 0);
  summary.result = (fails.length === 0) ? "PREP_READY" : "PREP_BLOCKED";
  return finish(fails.length === 0);
}

async function main() {
  log("send-once (dry_run=" + DRY_RUN + "). Execucao real NAO autorizada nesta fase.");
  // Caminho real SO e cogitado com gate completo. Nesta fase, defaults mantem PREP.
  const realGateRequested = (!DRY_RUN) && ALLOW_PUSHSEND && (CONFIRM_REAL_SEND === EXPECTED.confirm);
  if (!realGateRequested) {
    // PREP / dry-run: nenhuma acao real. (Inclui o caso allow_push_send_real=true sem confirmacao/dry_run.)
    return runPrep();
  }
  // ---- Abaixo: somente fase posterior autorizada. Mantido protegido por gate. ----
  summary.mode = "FUTURE_REAL_SEND";
  scopeGuards();
  if (fails.length > 0) { summary.result = "REAL_SEND_BLOCKED"; return finish(false); }
  summary.realSendAuthorizedThisPhase = true;
  const sent = await realSendOnce();
  if (!sent) { summary.result = "REAL_SEND_BLOCKED"; return finish(false); }
  summary.realExecutionBlocked = false;
  summary.result = "REAL_SEND_DONE";
  return finish(true);
}

main();
