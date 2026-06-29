#!/usr/bin/env node
/* =====================================================================
 * F3.3.21-B3.39A — VALIDACAO POS-HOSTING com fcm_token_server OFF.
 * Runner SEGURO de dois modos para confirmar que o app LIVE publicado
 * (agenda-id-seven.web.app, cutover client-side FCM) permanece no comportamento
 * legacy/OFF: a flag fcm_token_server fica OFF por padrao, o caminho server FCM
 * fica DORMENTE, e registerFcmTokenClient/removeFcmTokenClient NAO disparam
 * endpoint no caminho OFF. SEM publicar Hosting, SEM deploy, SEM endpoint real,
 * SEM login real, SEM token FCM real, SEM Web Push real, SEM Firestore write,
 * SEM usuario real, SEM segredo.
 *
 * MODO DRY-RUN (DRY_RUN=true, padrao):
 *   - NAO abre browser, NAO carrega live, NAO chama endpoint, NAO toca Firestore.
 *   - Validacao estatica de SOURCE_INDEX_PATH (app/main:index.html preparado pelo
 *     workflow via git show): cutover presente, helper fcmTokenServerEnabled() OFF
 *     por padrao (catch=>false), SEM setter forcando ON, register/remove client
 *     existem; micro-sim vm confirma off/null => false.
 *
 * MODO VALIDACAO (DRY_RUN=false; fase FUTURA — nao executado no PREP-PR):
 *   - Carrega TARGET_URL (agenda-id-seven.web.app) em Playwright controlado.
 *   - context.route: permite SO o app-shell estatico (web.app/firebaseapp.com +
 *     SDK do Firebase em gstatic); BLOQUEIA e marca firestore.googleapis.com,
 *     cloudfunctions.net/*.run.app (endpoints), fcmregistrations/firebaseinstallations
 *     (token FCM) e identitytoolkit (login). Qualquer hit real => NO-GO.
 *   - addInitScript ANTES de qualquer script: GARANTE flag OFF (remove
 *     fcm_token_server do localStorage; nunca seta "on") e neutraliza Web Push
 *     (Notification/PushManager/serviceWorker/getToken) com stubs.
 *   - Confirma HTTP 200, markers do cutover, fcmTokenServerEnabled()===false, e
 *     que registerFcmTokenClient/removeFcmTokenClient retornam {ok:false,
 *     error:"disabled"} SEM emitir fetch (caminho OFF dormente; legacy disponivel).
 *   - FAIL-SAFE: qualquer chamada real escapando => NO-GO. Playwright importado
 *     DINAMICAMENTE so neste modo.
 *
 * NUNCA imprime token FCM / session token / senha / hash / salt.
 * Rodar (dry-run): node scripts/worker-ops/f3321-b339a-fcm-token-client-cutover-flag-off-validation.e2e.mjs
 * ===================================================================== */
import fs from "node:fs";
import vm from "node:vm";

const DRY_RUN         = String(process.env.DRY_RUN || "true").toLowerCase() === "true";
const SOURCE_REF      = String(process.env.SOURCE_REF || "app/main");
const SOURCE_PATH     = String(process.env.SOURCE_INDEX_PATH || "");
const TARGET_URL      = String(process.env.TARGET_URL || "https://agenda-id-seven.web.app");
const FCM_FLAG        = String(process.env.FCM_TOKEN_SERVER || "false").toLowerCase(); // esperado "false"
const ENDPOINT_BLOCK  = String(process.env.ENDPOINT_CALLS_BLOCKED || "true").toLowerCase() === "true";
const WEBPUSH_NEUTRAL = String(process.env.WEB_PUSH_NEUTRALIZED || "true").toLowerCase() === "true";
const FIRESTORE_BLOCK = String(process.env.FIRESTORE_BLOCKED || "true").toLowerCase() === "true";
const HOSTING_PUBLISH = String(process.env.HOSTING_PUBLISH || "false").toLowerCase() === "true";
const OUT             = String(process.env.RETEST_OUT || "fcm-flag-off-validation-artifacts");

const EXPECTED_URL = "https://agenda-id-seven.web.app";

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b339a] " + m);

const summary = {
  phase: "F3.3.21-B3.39A-FCM-TOKEN-CLIENT-CUTOVER-FLAG-OFF-VALIDATION",
  target: "fcmTokenClientCutoverFlagOffValidation",
  sourceRef: SOURCE_REF,
  targetUrl: TARGET_URL,
  dryRun: DRY_RUN,
  executed: false,
  fcmTokenServerExpectedOff: true,
  // segurança (por construção deste runner; nada real é chamado)
  noEndpoint: true, noLogin: true, noFcmTokenCreated: true, noFirestoreReal: true, noFirestoreWrite: true,
  noRealUser: true, noSecretPrinted: true, noWebPush: true, noDeploy: true, noHostingPublish: true,
  endpointCallsBlocked: ENDPOINT_BLOCK, webPushNeutralized: WEBPUSH_NEUTRAL,
  firestoreBlocked: FIRESTORE_BLOCK, hostingPublish: HOSTING_PUBLISH,
};

function inlineScripts(h) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; const out = []; let m;
  while ((m = re.exec(h))) { if (!/\bsrc\s*=/.test(m[1] || "")) out.push(m[2]); }
  return out;
}
// Brace-match da declaracao COMPLETA de `function <name>(...){...}` (suporta try/catch).
function extractNamedFunction(src, name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\(");
  const m = re.exec(src); if (!m) return null;
  const open = src.indexOf("{", m.index); if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return src.slice(m.index, i + 1); }
  }
  return null;
}

function finish() {
  summary.go = fails.length === 0;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.39A — FCM flag-OFF post-Hosting validation (" + (DRY_RUN ? "dry-run" : "validation") + ") =====");
  console.log("  targetUrl=" + TARGET_URL + " · executed=" + summary.executed +
              " · staticValidationPassed=" + summary.staticValidationPassed +
              " · fcmTokenServerExpectedOff=" + summary.fcmTokenServerExpectedOff +
              " · noHostingPublish=" + summary.noHostingPublish);
  console.log("  noEndpoint=" + summary.noEndpoint + " noLogin=" + summary.noLogin +
              " noFcmTokenCreated=" + summary.noFcmTokenCreated + " noFirestoreWrite=" + summary.noFirestoreWrite +
              " noWebPush=" + summary.noWebPush + " noDeploy=" + summary.noDeploy);
  console.log("=================================================================");
  console.log("f3321-b339a FCM flag-OFF validation: " + (summary.go ? "GO" : ("NO-GO (" + fails.length + " falhas)")));
  process.exit(summary.go ? 0 : 1);
}

// ---- Guards de seguranca comuns ----
function safetyGuards() {
  ok("hosting_publish=false (recusa publish)", HOSTING_PUBLISH === false);
  ok("endpoint_calls_blocked=true", ENDPOINT_BLOCK === true);
  ok("web_push_neutralized=true", WEBPUSH_NEUTRAL === true);
  ok("firestore_blocked=true", FIRESTORE_BLOCK === true);
  ok("fcm_token_server esperado OFF (!= true)", FCM_FLAG !== "true");
  ok("source_ref == app/main", SOURCE_REF === "app/main");
  ok("target_url == " + EXPECTED_URL, TARGET_URL === EXPECTED_URL);
}

// ---- Validacao estatica do cutover + flag OFF ----
function runStaticChecks(html) {
  ok("index de " + SOURCE_REF + " carregado (bytes>0)", html.length > 0);

  const blocks = inlineScripts(html);
  let syntaxErrors = 0;
  blocks.forEach((code, idx) => { try { new vm.Script(code, { filename: "inline#" + (idx + 1) }); } catch (e) { syntaxErrors++; log("syntax erro bloco#" + (idx + 1) + ": " + e.message); } });
  ok("sintaxe JS inline sem erros", syntaxErrors === 0);
  summary.inlineScriptBlocks = blocks.length;

  ok("registerFcmTokenClient existe", /async function registerFcmTokenClient\s*\(/.test(html));
  ok("removeFcmTokenClient existe", /async function removeFcmTokenClient\s*\(/.test(html));
  ok("fcmTokenServerEnabled existe", /function fcmTokenServerEnabled\s*\(/.test(html));
  const flagOff = /function fcmTokenServerEnabled\(\)\{\s*try\{\s*return lsGet\("fcm_token_server"\)==="on";\s*\}catch\(_\)\{\s*return false;\s*\}\s*\}/.test(html);
  ok("fcm_token_server OFF por padrao (catch=>false)", flagOff);
  // NENHUM setter forcando a flag ON embutido
  ok("sem setter forcando fcm_token_server ON", !/fcm_token_server"\s*,\s*"on"/.test(html));
  summary.flagOffByDefault = flagOff;
  summary.noForcedOnSetter = !/fcm_token_server"\s*,\s*"on"/.test(html);
  summary.cutoverMarkersPresent = /async function registerFcmTokenClient\s*\(/.test(html) && /async function removeFcmTokenClient\s*\(/.test(html) && /function fcmTokenServerEnabled\s*\(/.test(html);

  // micro-sim vm: helper retorna false p/ off/null (flag OFF por padrao)
  let microOff = null, microNull = null, sandboxTouched = false;
  try {
    const fnSrc = extractNamedFunction(html, "fcmTokenServerEnabled");
    if (!fnSrc) throw new Error("helper nao extraido");
    const guard = () => { sandboxTouched = true; throw new Error("BLOQUEADO: chamada real proibida"); };
    const evalHelper = (flagVal) => {
      const sandbox = {
        lsGet: (k) => (k === "fcm_token_server" ? flagVal : null),
        fetch: guard, Notification: { requestPermission: guard, permission: "denied" },
        PushManager: function () { guard(); }, navigator: { serviceWorker: { register: guard } },
        console: { log() {}, warn() {}, error() {} },
      };
      vm.createContext(sandbox);
      vm.runInContext(fnSrc + "\n; globalThis.__r = fcmTokenServerEnabled();", sandbox, { timeout: 1000 });
      return sandbox.__r === true;
    };
    microOff = evalHelper("off");    // esperado: false
    microNull = evalHelper(null);    // esperado: false (sem flag => OFF)
    ok("micro-sim: flag 'off' => false", microOff === false);
    ok("micro-sim: flag ausente (null) => false", microNull === false);
    ok("micro-sim: nenhuma chamada real ocorreu", sandboxTouched === false);
  } catch (e) { fail("micro-sim falhou: " + (e && e.message)); }

  summary.staticValidationPassed = fails.length === 0;
}

// ===================== MODO DRY-RUN =====================
function runDryRun() {
  let html = "";
  try { html = fs.readFileSync(SOURCE_PATH, "utf8"); }
  catch (e) { fail("nao foi possivel ler SOURCE_INDEX_PATH (" + SOURCE_PATH + ")"); return finish(); }
  runStaticChecks(html);
  summary.executed = false;
  summary.willLaunchBrowser = false;
  summary.willCallEndpoint = false;
  summary.willCreateFcmToken = false;
  summary.willTouchFirestore = false;
  return finish();
}

// ===================== MODO VALIDACAO (futuro) =====================
function isAppShellHost(url) {
  // App-shell estatico + SDK do Firebase (necessarios para o app live carregar).
  return /(^|\/\/)([a-z0-9-]+\.)*(web\.app|firebaseapp\.com)\//i.test(url)
      || /(^|\/\/)([a-z0-9-]+\.)?gstatic\.com\//i.test(url)
      || /(^|\/\/)fonts\.(googleapis|gstatic)\.com\//i.test(url);
}
function isDangerousHost(url) {
  return /firestore\.googleapis\.com/i.test(url)                 // Firestore real
      || /cloudfunctions\.net|-uc\.a\.run\.app/i.test(url)       // endpoints (register/remove/login/getUserSelf)
      || /fcmregistrations\.googleapis\.com|firebaseinstallations\.googleapis\.com/i.test(url) // token FCM real
      || /identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/i.test(url); // login/identity
}

async function runValidation() {
  let chromium = null;
  try { ({ chromium } = await import("playwright")); }
  catch (e) { fail("playwright indisponivel (fail-safe; nenhuma chamada real): " + (e && e.message)); return finish(); }

  const observed = {
    registerEndpoint: false, removeEndpoint: false,
    firestoreBlockedAttempt: false, firestoreRequestAborted: false,
    firestoreRealEscaped: false, firestoreWriteEscaped: false,
    loginReal: false, fcmTokenReal: false, otherExternalBlocked: 0,
    notificationReq: false, swRegisterAttempt: false, getToken: false,
    serviceWorkerRealRegistered: false, notificationRealGranted: false,
  };
  let http = 0, browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Interceptacao: permite o app-shell estatico; BLOQUEIA+marca o que e perigoso.
    await context.route("**/*", (route) => {
      let url = ""; try { url = route.request().url(); } catch (_) { url = ""; }
      if (/^(data:|blob:|about:)/i.test(url)) return route.continue();
      if (isDangerousHost(url)) {
        if (/firestore\.googleapis\.com/i.test(url)) { observed.firestoreBlockedAttempt = true; observed.firestoreRequestAborted = true; }
        else if (/registerfcmtoken/i.test(url)) observed.registerEndpoint = true;
        else if (/removemyfcmtoken/i.test(url)) observed.removeEndpoint = true;
        else if (/loginuser|getuserself|identitytoolkit|securetoken/i.test(url)) observed.loginReal = true;
        else if (/fcmregistrations|firebaseinstallations/i.test(url)) observed.fcmTokenReal = true;
        return route.abort();
      }
      if (isAppShellHost(url)) return route.continue();
      observed.otherExternalBlocked++; return route.abort();
    });

    // ANTES de qualquer script: GARANTE flag OFF + neutraliza Web Push.
    await context.addInitScript(() => {
      try { window.localStorage.removeItem("fcm_token_server"); } catch (_) {}
      window.__canary = { notificationReq: false, swRegisterAttempt: false, getToken: false };
      try {
        const N = function () {};
        N.requestPermission = function () { window.__canary.notificationReq = true; return Promise.resolve("denied"); };
        N.permission = "denied";
        window.Notification = N;
      } catch (_) {}
      try { window.PushManager = function () {}; } catch (_) {}
      try { if (navigator.serviceWorker) { navigator.serviceWorker.register = function () { window.__canary.swRegisterAttempt = true; return Promise.reject(new Error("sw neutralizado (canary)")); }; } } catch (_) {}
      try { window.__stubGetToken = function () { window.__canary.getToken = true; return Promise.resolve("canary-fcm-token-stub"); }; } catch (_) {}
    });

    const page = await context.newPage();
    page.on("pageerror", () => {});
    // Detector de ESCAPE real: uma request Firestore so produz 'response' se NAO foi abortada.
    // Tentativa abortada por route.abort() nunca dispara 'response' => firestoreRealEscaped continua false.
    page.on("response", (resp2) => {
      let u = ""; try { u = resp2.url(); } catch (_) { u = ""; }
      if (/firestore\.googleapis\.com/i.test(u)) {
        observed.firestoreRealEscaped = true;                       // resposta real recebida = escapou do abort
        if (/commit|write/i.test(u)) observed.firestoreWriteEscaped = true; // mutacao real escapada
      }
    });
    const resp = await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    http = resp ? resp.status() : 0;

    // Observacao do caminho OFF (sem login; flag OFF). Os helpers, em OFF, retornam
    // {ok:false,error:"disabled"} ANTES de qualquer fetch — comprovando dormencia.
    const res = await page.evaluate(async () => {
      const out = { flagOn: null, lsVal: null, hasRegister: false, hasRemove: false, regErr: null, remErr: null, err: null };
      try {
        try { out.lsVal = window.localStorage.getItem("fcm_token_server"); } catch (_) {}
        out.flagOn = (typeof window.fcmTokenServerEnabled === "function") ? (window.fcmTokenServerEnabled() === true) : null;
        out.hasRegister = typeof window.registerFcmTokenClient === "function";
        out.hasRemove = typeof window.removeFcmTokenClient === "function";
        if (out.hasRegister) { const r = await window.registerFcmTokenClient("canary-fcm-token-stub", "canary-device", "web"); out.regErr = (r && r.error) ? String(r.error) : (r && r.ok === true ? "ok" : "unknown"); }
        if (out.hasRemove) { const r = await window.removeFcmTokenClient("canary-fcm-token-stub"); out.remErr = (r && r.error) ? String(r.error) : (r && r.ok === true ? "ok" : "unknown"); }
      } catch (e) { out.err = "eval-error"; }
      return out;
    }).catch(() => ({ flagOn: null, lsVal: null, hasRegister: false, hasRemove: false, regErr: null, remErr: null, err: "evaluate-failed" }));

    let marks = {}; try { marks = await page.evaluate(() => window.__canary || {}); } catch (_) {}
    observed.notificationReq = !!marks.notificationReq;
    observed.swRegisterAttempt = !!marks.swRegisterAttempt;
    observed.getToken = !!marks.getToken;
    let realState = { swCount: 0, notifPerm: "default", markersPresent: false };
    try {
      realState = await page.evaluate(async () => {
        const o = { swCount: 0, notifPerm: "default", markersPresent: false };
        try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) { const r = await navigator.serviceWorker.getRegistrations(); o.swCount = (r && r.length) || 0; } } catch (_) {}
        try { o.notifPerm = (window.Notification && window.Notification.permission) || "default"; } catch (_) {}
        try { o.markersPresent = (typeof window.fcmTokenServerEnabled === "function") && (typeof window.registerFcmTokenClient === "function") && (typeof window.removeFcmTokenClient === "function"); } catch (_) {}
        return o;
      });
    } catch (_) {}
    observed.serviceWorkerRealRegistered = (realState.swCount || 0) > 0;
    observed.notificationRealGranted = realState.notifPerm === "granted";

    // ---- Assercoes do modo validacao ----
    summary.executed = true;
    summary.liveAppLoaded = http === 200;
    summary.http200 = http === 200;
    summary.cutoverMarkersPresent = !!realState.markersPresent;
    summary.fcmTokenServerEffectiveOff = res.flagOn === false;
    summary.fcmTokenServerEnabledDefaultFalse = res.flagOn === false;
    summary.localStorageDoesNotForceOn = res.lsVal !== "on";
    summary.registerClientNotCalledInOff = observed.registerEndpoint === false && res.regErr === "disabled";
    summary.removeClientNotCalledInOff = observed.removeEndpoint === false && res.remErr === "disabled";
    summary.legacyPathAvailable = res.hasRegister && res.hasRemove; // helpers presentes; OFF usa legacy
    summary.serverPathDormant = (res.flagOn === false) && observed.registerEndpoint === false && observed.removeEndpoint === false;
    summary.notificationPermissionStubbed = true;
    summary.serviceWorkerStubbed = true;
    summary.getTokenStubbed = true;
    summary.registerEndpointNotCalledReal = observed.registerEndpoint === false;
    summary.removeEndpointNotCalledReal = observed.removeEndpoint === false;
    summary.loginBlocked = observed.loginReal === false;
    summary.getUserSelfBlocked = observed.loginReal === false;
    summary.externalNetworkControlled = true;
    summary.noEndpointReal = observed.registerEndpoint === false && observed.removeEndpoint === false;
    summary.noLoginReal = observed.loginReal === false;
    summary.noFcmTokenCreated = observed.getToken === false && observed.fcmTokenReal === false;
    // Firestore: distinguir TENTATIVA bloqueada/abortada (esperada, segura) de ESCAPE real/write real.
    summary.firestoreBlockedAttempt = observed.firestoreBlockedAttempt;
    summary.firestoreRequestAborted = observed.firestoreRequestAborted;
    summary.firestoreRealEscaped = observed.firestoreRealEscaped;
    summary.firestoreWriteEscaped = observed.firestoreWriteEscaped;
    summary.noFirestoreReal = observed.firestoreRealEscaped === false;
    summary.noFirestoreWrite = observed.firestoreRealEscaped === false && observed.firestoreWriteEscaped === false;
    summary.noWebPushReal = observed.serviceWorkerRealRegistered === false && observed.notificationRealGranted === false;

    ok("validacao: HTTP 200 no app live", http === 200);
    ok("validacao: markers do cutover presentes", realState.markersPresent === true);
    ok("validacao: fcmTokenServerEnabled() === false (flag OFF)", res.flagOn === false);
    ok("validacao: localStorage NAO forca fcm_token_server=on", res.lsVal !== "on");
    ok("validacao: registerFcmTokenClient em OFF retorna 'disabled' sem endpoint real", res.regErr === "disabled" && observed.registerEndpoint === false);
    ok("validacao: removeFcmTokenClient em OFF retorna 'disabled' sem endpoint real", res.remErr === "disabled" && observed.removeEndpoint === false);
    // Tentativa Firestore bloqueada/abortada e ESPERADA (protecao funcionando) e NAO reprova.
    // Reprova somente se uma request Firestore ESCAPAR (resposta real) ou houver write real escapado.
    ok("validacao: NENHUM Firestore real escapou (tentativa abortada e segura)", observed.firestoreRealEscaped === false);
    ok("validacao: NENHUM Firestore write escapou", observed.firestoreWriteEscaped === false);
    ok("validacao: NENHUM login/identity real", observed.loginReal === false);
    ok("validacao: NENHUM token FCM real (getToken/registrations)", observed.getToken === false && observed.fcmTokenReal === false);
    ok("validacao: NENHUM service worker real", observed.serviceWorkerRealRegistered === false);
    ok("validacao: Notification real NAO concedido", observed.notificationRealGranted === false);
  } catch (e) {
    fail("validacao flag-off falhou (fail-safe; rede controlada): " + (e && e.message));
  } finally {
    try { if (browser) await browser.close(); } catch (_) {}
  }
  return finish();
}

async function main() {
  safetyGuards();
  if (fails.length > 0) return finish();
  if (DRY_RUN) return runDryRun();
  return runValidation();
}

main().catch((e) => { fail("erro fatal (sem chamada real): " + (e && e.message)); finish(); });
