#!/usr/bin/env node
/* =====================================================================
   F3.3.21-B2 — Runner do reteste UI canário do LOGIN SERVER-SIDE.
   Valida, no frontend PUBLICADO, que o login server-side (exports.loginUser)
   é usado pela UI quando a flag canária está ligada — SOMENTE usuário canário.
   Modos:
     DRY_RUN=true (default): SÓ leitura — fetch do HTML publicado + grep dos
       markers (login server-side + app) + validação de plano/env. SEM login,
       SEM endpoint, SEM Firestore, SEM navegador, SEM Web Push.
     DRY_RUN=false: execução REAL com Playwright — exige CONFIRM_UI_RETEST=
       RUN_AUTH_LOGIN_UI_RETEST + CANARY_* (secrets) e usuário CANÁRIO. Web Push
       é neutralizado ANTES de carregar a página; localStorage.auth_ss_login="on"
       é setado ANTES de page.goto (via addInitScript). O loginUser é exercitado
       SOMENTE pelo fluxo da UI (doLogin), nunca por chamada direta. A resposta é
       inspecionada apenas para campos seguros; token NUNCA é impresso.
   Segurança: senha só via env CANARY_PASSWORD (nunca lida/impressa); token de
   sessão mascarado; sem segredo de servidor (sessao/notificacoes);
   sem deploy; só canário.
   ===================================================================== */
import { writeFileSync, mkdirSync } from "node:fs";

const DRY_RUN = (process.env.DRY_RUN ?? "true") !== "false";
const CONFIRM = process.env.CONFIRM_UI_RETEST || "";
const REQUIRED_CONFIRM = "RUN_AUTH_LOGIN_UI_RETEST";
const STAGING_URL = process.env.STAGING_URL || "https://agenda-id-seven.web.app";
const EXPECTED_URL = "https://agenda-id-seven.web.app";
const CANARY_IDENTIFIER = process.env.CANARY_IDENTIFIER || "";
const CANARY_UID = process.env.CANARY_UID || "";
const HAS_PASSWORD = typeof process.env.CANARY_PASSWORD === "string" && process.env.CANARY_PASSWORD.length > 0;
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "./auth-login-ui-retest-artifacts";
// Flag liga por padrão no APPLY (propósito do teste); só desliga se AUTH_SS_LOGIN === "false".
const SET_SS_FLAG = (process.env.AUTH_SS_LOGIN ?? "true") !== "false";
// Override de URL do loginUser: SÓ se explicitamente fornecido (default já é correto no cliente).
const LOGIN_URL_OVERRIDE = (typeof process.env.AUTH_LOGIN_URL_OVERRIDE === "string" && /^https:\/\//.test(process.env.AUTH_LOGIN_URL_OVERRIDE)) ? process.env.AUTH_LOGIN_URL_OVERRIDE : "";
const LOGIN_URL_PART = "loginuser";
const OP_TIMEOUT = 30000;

// Marcadores do PR #82 (login server-side) + marcadores de app preservados.
const MARKERS_LOGIN = [
  "loginUserServerSide", "authServerSideLoginEnabled", "AUTH_LOGIN_URL_DEFAULT",
  "auth_ss_login", "auth_login_url", "loginuser-de36pi7vza-uc.a.run.app",
];
const MARKERS_APP = [
  "usersPublic", "usersRoster", "normalizeRosterUser",
  "getNotifPrefsClient", "NOTIF_GET_URL", "notifPrefsTokenCache", "task_assigned",
];
const SEL = { loginId: "#lUser", loginPw: "#lPass", loginBtn: "#doLogin" };

const isCanary = (uid, ident) =>
  /canary|canario|teste|test|qa/i.test(String(uid || "")) || /canary|canario|teste|test|qa/i.test(String(ident || ""));
const mask = (s) => (s ? (String(s).slice(0, 2) + "***" + String(s).length) : "<unset>");

// ---- Telemetria (somente observabilidade; NUNCA segredo/valor sensível) ----
let T0 = 0;
let lastStep = "start";
const consoleErrors = [];
const pageErrors = [];
const uiSteps = [];
const SECRET_RE = /\b(pass|salt|hash|authorization|bearer|access[_-]?token|id[_-]?token|refresh[_-]?token|fcm[_-]?token|token|senha)\b\s*[:=]?\s*\S+/gi;
function sanitizeText(s) {
  if (s == null) return "";
  let t = String(s);
  t = t.replace(SECRET_RE, "$1=***");
  t = t.replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, "<jwt>");
  t = t.replace(/s2:[0-9a-f]{8,}/gi, "<hash>");
  t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>");
  return t.slice(0, 240);
}
function setStep(s) { lastStep = s; }
async function snapshotUi(page, label) {
  let d = {};
  try {
    d = await page.evaluate(() => {
      const info = (sel) => { const el = document.querySelector(sel); if (!el) return { exists: false, visible: false }; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const visible = !!(r.width || r.height) && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; return { exists: true, visible, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }; };
      return {
        url: location.href, title: document.title, bodyClass: (document.body && document.body.className) || "", viewport: { w: innerWidth, h: innerHeight },
        authScreen: info("#authScreen"), pendingScreen: info("#pendingScreen"), mainApp: info("#mainApp"), setupScreen: info("#setupScreen"),
        loginBtn: info("#doLogin"),
        toastText: (document.querySelector("#toast") ? (document.querySelector("#toast").textContent || "") : "").slice(0, 120),
      };
    });
  } catch (e) { d = { evalError: (e && (e.message || "")).slice(0, 120) }; }
  d.title = sanitizeText(d.title); d.toastText = sanitizeText(d.toastText);
  const vis = (o) => !!(o && o.visible);
  const visibleScreen = vis(d.setupScreen) ? "setup" : vis(d.authScreen) ? "auth" : vis(d.pendingScreen) ? "pending" : vis(d.mainApp) ? "main" : "unknown";
  const snap = {
    label, tRel: (T0 ? Date.now() - T0 : 0), lastStep,
    currentUrl: d.url, visibleScreen,
    authScreenVisible: vis(d.authScreen), pendingScreenVisible: vis(d.pendingScreen), mainAppVisible: vis(d.mainApp), loginBtnVisible: vis(d.loginBtn),
    consoleErrorsCount: consoleErrors.length, pageErrorsCount: pageErrors.length,
  };
  uiSteps.push({ ...snap, detail: d });
  return snap;
}

// Init script (roda ANTES de qualquer script da página): neutraliza Web Push e liga a flag canária.
function canaryInitScript(setFlag, loginUrlOverride) {
  return "(() => {" +
    "try{Object.defineProperty(Notification,'permission',{get:()=>'denied'});}catch(e){}" +
    "try{Notification.requestPermission=()=>Promise.resolve('denied');}catch(e){}" +
    "try{if(window.PushManager)PushManager.prototype.subscribe=()=>Promise.reject(new Error('push-blocked-canary'));}catch(e){}" +
    "try{if(navigator.serviceWorker){navigator.serviceWorker.register=()=>Promise.reject(new Error('sw-register-blocked-canary'));}}catch(e){}" +
    (setFlag ? "try{localStorage.setItem('auth_ss_login','on');}catch(e){}" : "") +
    (loginUrlOverride ? ("try{localStorage.setItem('auth_login_url'," + JSON.stringify(loginUrlOverride) + ");}catch(e){}") : "") +
    "})();";
}

// Espera EXPLICITA pela RESPOSTA de loginUser (retorna o objeto response p/ inspeção segura do corpo).
async function waitForLoginResponse(page, urlPart, timeoutMs) {
  try {
    const response = await page.waitForResponse((r) => String(r.url() || "").toLowerCase().includes(String(urlPart).toLowerCase()), { timeout: timeoutMs });
    return response;
  } catch (err) { return null; }
}

function writeSummary(obj) {
  try { mkdirSync(ARTIFACT_DIR, { recursive: true }); writeFileSync(ARTIFACT_DIR + "/auth-login-ui-retest-summary.json", JSON.stringify(obj, null, 2)); } catch (_) {}
}

async function fetchMarkers() {
  const res = await fetch(STAGING_URL, { redirect: "follow" });
  const html = await res.text();
  const missingLogin = MARKERS_LOGIN.filter((m) => !html.includes(m));
  const missingApp = MARKERS_APP.filter((m) => !html.includes(m));
  return { httpStatus: res.status, missingLogin, missingApp, ok: res.status === 200 && missingLogin.length === 0 && missingApp.length === 0 };
}

// ---- DRY-RUN: leitura + plano; ZERO ação real ----
async function runDryRun() {
  console.log("== AUTH-LOGIN UI-RETEST DRY-RUN (read-only; sem login/endpoint/Firestore/WebPush) ==");
  if (STAGING_URL !== EXPECTED_URL) { console.error("::error:: STAGING_URL != " + EXPECTED_URL); process.exit(1); }
  let m;
  try { m = await fetchMarkers(); }
  catch (e) { console.error("::error:: fetch falhou: " + (e && e.message)); writeSummary({ executed: false, dryRun: true, fetchError: true }); process.exit(1); }
  const init = canaryInitScript(true, "");
  const initOk = ["permission", "requestPermission", "subscribe", "serviceWorker", "auth_ss_login"].every((t) => init.includes(t));
  const summary = {
    executed: false, dryRun: true,
    httpStatus: m.httpStatus,
    markersHtml: m.missingLogin.length === 0 && m.missingApp.length === 0,
    missingLoginMarkers: m.missingLogin, missingAppMarkers: m.missingApp,
    webPushNeutralizationReady: initOk, authServerSideFlagInitReady: init.includes("auth_ss_login"),
    canaryGuardSelfTest: isCanary("canary-1", "canary@teste") === true && isCanary("RealUid9", "joao@empresa.com") === false,
    noLogin: true, noEndpoint: true, noFirestore: true, noWebPush: true, noRealUser: true, noSecretPrinted: true, noDeploy: true,
  };
  writeSummary(summary);
  const go = m.ok && initOk && summary.canaryGuardSelfTest;
  console.log("DRY-RUN " + (go ? "GO" : "NO-GO") + ": " + JSON.stringify(summary));
  process.exit(go ? 0 : 1);
}

// ---- APPLY REAL (Playwright; só canário) ----
async function runApply() {
  if (CONFIRM !== REQUIRED_CONFIRM) { console.error("NO-GO: execução real exige CONFIRM_UI_RETEST=RUN_AUTH_LOGIN_UI_RETEST."); process.exit(1); }
  if (!CANARY_IDENTIFIER || !CANARY_UID || !HAS_PASSWORD) { console.error("NO-GO: credenciais canarias ausentes (secrets)."); process.exit(1); }
  if (!isCanary(CANARY_UID, CANARY_IDENTIFIER)) { console.error("NO-GO: CANARY_UID/IDENTIFIER nao parece canario (protecao usuario real)."); process.exit(1); }
  if (STAGING_URL !== EXPECTED_URL) { console.error("NO-GO: STAGING_URL != " + EXPECTED_URL); process.exit(1); }

  const summary = {
    executed: true, dryRun: false, markersHtml: false,
    authServerSideFlagSet: false, authLoginUrlDefault: !LOGIN_URL_OVERRIDE, authLoginUrlOverrideUsed: !!LOGIN_URL_OVERRIDE,
    loginUserRequestSeen: false, loginUserStatus: 0, loginUserResponseSafe: false,
    serverSessionStored: false, serverSessionTokenMasked: true,
    serverLoginUsed: false, clientFallbackUsed: false,
    mainAppVisible: false, authScreenVisible: false, pendingScreenVisible: false,
    notificationDenied: false, pushSubscribeBlocked: true,
    noRealUser: true, noSecretPrinted: true, noDeploy: true,
    canary: mask(CANARY_UID),
  };

  // Passo 0: markers read-only
  try { const m = await fetchMarkers(); summary.markersHtml = m.missingLogin.length === 0 && m.missingApp.length === 0; }
  catch (_) {}

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ permissions: [] });
  // Web Push neutralizado + flag auth_ss_login=on ANTES de page.goto.
  await ctx.addInitScript(canaryInitScript(SET_SS_FLAG, LOGIN_URL_OVERRIDE));
  const page = await ctx.newPage();
  const netStatus = {};
  page.on("response", (r) => { const u = (r.url() || "").toLowerCase(); if (u.includes(LOGIN_URL_PART)) netStatus.login = r.status(); });
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(sanitizeText(msg.text())); });
  page.on("pageerror", (err) => { pageErrors.push(sanitizeText(err && err.message)); });

  try {
    T0 = Date.now();
    setStep("page_goto");
    await page.goto(STAGING_URL, { waitUntil: "domcontentloaded", timeout: OP_TIMEOUT });
    await page.waitForTimeout(3000);
    setStep("login_form_seen");
    await snapshotUi(page, "afterGoto");
    // confirma que a flag foi aplicada ANTES do app (via addInitScript)
    summary.authServerSideFlagSet = await page.evaluate(() => { try { return localStorage.getItem("auth_ss_login") === "on"; } catch (e) { return false; } }).catch(() => false);

    // login canário pela UI (doLogin). Senha NUNCA logada.
    await page.fill(SEL.loginId, CANARY_IDENTIFIER, { timeout: OP_TIMEOUT });
    await page.fill(SEL.loginPw, process.env.CANARY_PASSWORD, { timeout: OP_TIMEOUT });
    setStep("login_submitted");
    await snapshotUi(page, "afterLoginSubmit");
    // inicia a espera da resposta de loginUser ANTES do clique (fluxo UI; nunca chamada direta)
    const loginRespP = waitForLoginResponse(page, LOGIN_URL_PART, 45000);
    await page.click(SEL.loginBtn, { timeout: OP_TIMEOUT });
    const loginResp = await loginRespP;
    if (loginResp) {
      summary.loginUserRequestSeen = true;
      summary.loginUserStatus = loginResp.status();
      try {
        const body = await loginResp.json();
        const user = (body && typeof body.user === "object" && body.user) ? body.user : {};
        const forbidden = ["pass", "salt", "hash", "fcmTokens", "fcmTokenMeta"];
        const leak = forbidden.some((k) => (k in user) || (body && typeof body === "object" && k in body));
        summary.loginUserResponseSafe = !!(body && body.ok === true) && !leak;
      } catch (_) { summary.loginUserResponseSafe = false; }
    } else if (netStatus.login) {
      summary.loginUserRequestSeen = true; summary.loginUserStatus = netStatus.login;
    }
    await page.waitForTimeout(4000);
    setStep("login_result_checked");
    await snapshotUi(page, "afterLoginWait");

    // sessão server-side em localStorage (token NUNCA lido/impresso — só presença/tipo)
    const sess = await page.evaluate(() => {
      try { const raw = localStorage.getItem("idseven_auth_session_v1"); if (!raw) return { stored: false }; const o = JSON.parse(raw); return { stored: !!(o && typeof o.token === "string" && o.token.length > 0), hasExp: !!(o && o.expiresAt) }; }
      catch (e) { return { stored: false }; }
    }).catch(() => ({ stored: false }));
    summary.serverSessionStored = !!(sess && sess.stored);

    const loginBtnGone = !(await page.locator(SEL.loginBtn).isVisible().catch(() => false));
    summary.notificationDenied = await page.evaluate(() => { try { return Notification.permission === "denied"; } catch (e) { return false; } }).catch(() => false);

    try { mkdirSync(ARTIFACT_DIR, { recursive: true }); await page.screenshot({ path: ARTIFACT_DIR + "/auth-login-ui-retest-screenshot.png" }); } catch (_) {}
    setStep(loginBtnGone ? "done" : "failed");
  } catch (e) {
    setStep("failed");
    console.error("::error:: apply falhou: " + sanitizeText(e && (e.message || "")).slice(0, 120));
  } finally {
    try { await browser.close(); } catch (_) {}
  }

  // ---- Telemetria final (sanitizada) ----
  const last = uiSteps.length ? uiSteps[uiSteps.length - 1] : null;
  const ld = (last && last.detail) || {};
  summary.mainAppVisible = !!(ld.mainApp && ld.mainApp.visible);
  summary.authScreenVisible = !!(ld.authScreen && ld.authScreen.visible);
  summary.pendingScreenVisible = !!(ld.pendingScreen && ld.pendingScreen.visible);
  // serverLoginUsed: login server-side observado (POST loginUser 200) + chegou ao mainApp.
  summary.serverLoginUsed = summary.loginUserRequestSeen && summary.loginUserStatus === 200 && summary.mainAppVisible;
  // clientFallbackUsed: chegou ao mainApp SEM nenhum POST a loginUser (caminho client-side verifyPw).
  summary.clientFallbackUsed = summary.mainAppVisible && !summary.loginUserRequestSeen;
  summary.lastStep = lastStep;
  summary.currentUrl = ld.url || "";
  summary.visibleScreen = last ? last.visibleScreen : "unknown";
  summary.consoleErrorsCount = consoleErrors.length;
  summary.consoleErrorsSanitized = consoleErrors.slice(0, 10);
  summary.pageErrorsCount = pageErrors.length;
  summary.pageErrorsSanitized = pageErrors.slice(0, 10);
  summary.steps = uiSteps.map((s) => ({ label: s.label, tRel: s.tRel, lastStep: s.lastStep, visibleScreen: s.visibleScreen, currentUrl: s.currentUrl, authScreenVisible: s.authScreenVisible, pendingScreenVisible: s.pendingScreenVisible, mainAppVisible: s.mainAppVisible, loginBtnVisible: s.loginBtnVisible, consoleErrorsCount: s.consoleErrorsCount, pageErrorsCount: s.pageErrorsCount }));

  writeSummary(summary);
  const go = summary.markersHtml && summary.authServerSideFlagSet &&
    summary.loginUserRequestSeen && summary.loginUserStatus === 200 && summary.loginUserResponseSafe &&
    summary.serverSessionStored && summary.serverLoginUsed && !summary.clientFallbackUsed &&
    summary.mainAppVisible && !summary.authScreenVisible && !summary.pendingScreenVisible &&
    summary.notificationDenied && summary.pushSubscribeBlocked && summary.noRealUser && summary.noSecretPrinted && summary.noDeploy;
  console.log("APPLY " + (go ? "GO" : "NO-GO") + ": " + JSON.stringify(summary));
  process.exit(go ? 0 : 1);
}

(DRY_RUN ? runDryRun() : runApply()).catch((e) => { console.error("erro:", e && e.message); process.exit(1); });
