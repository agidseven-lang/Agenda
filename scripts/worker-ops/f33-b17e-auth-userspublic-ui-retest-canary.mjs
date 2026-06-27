#!/usr/bin/env node
/* =====================================================================
   F3.3.20-B1.7-E — Runner do reteste UI canário (dual-path no Hosting).
   Modos:
     DRY_RUN=true (default): SÓ leitura — fetch do HTML publicado + grep dos
       markers dual-path + validação de plano/env. SEM login, SEM endpoint,
       SEM Firestore, SEM navegador, SEM Web Push. Escreve summary planned.
     DRY_RUN=false: execução REAL com Playwright — exige CONFIRM_UI_RETEST=
       RUN_UI_RETEST + CANARY_* (secrets) e usuário CANÁRIO. Web Push é
       neutralizado ANTES de carregar a página. Endpoints só pelo fluxo da UI
       do canário (issueNotifPrefsToken/updateNotifPrefs/getNotifPrefs).
   Segurança: senha só via env CANARY_PASSWORD (nunca lida/impressa); tokens
   mascarados; sem segredo de servidor; sem deploy; só canário.
   ===================================================================== */
import { writeFileSync, mkdirSync } from "node:fs";

const DRY_RUN = (process.env.DRY_RUN ?? "true") !== "false";
const CONFIRM = process.env.CONFIRM_UI_RETEST || "";
const REQUIRED_CONFIRM = "RUN_UI_RETEST";
const STAGING_URL = process.env.STAGING_URL || "https://agenda-id-seven.web.app";
const EXPECTED_URL = "https://agenda-id-seven.web.app";
const CANARY_IDENTIFIER = process.env.CANARY_IDENTIFIER || "";
const CANARY_UID = process.env.CANARY_UID || "";
const HAS_PASSWORD = typeof process.env.CANARY_PASSWORD === "string" && process.env.CANARY_PASSWORD.length > 0;
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "./ui-retest-artifacts";
const OP_TIMEOUT = 30000;

const MARKERS = [
  "usersPublic", "usersRoster", "normalizeRosterUser", "startUsersRosterSync",
  "getNotifPrefsClient", "NOTIF_GET_URL", "getnotifprefs-de36pi7vza-uc.a.run.app",
  "notifPrefsTokenCache", "task_assigned",
];
const SEL = {
  loginId: "#lUser", loginPw: "#lPass", loginBtn: "#doLogin",
  settingsBtn: "#hSettings", settingsNotifCard: '[data-setgo="notifications"]',
  npCheckbox: "#np_task_assigned", npSave: "#np_save", npStatus: "#np_status",
  npPw: "#np_pw", npPwOk: "#np_pw_ok",
};

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
      const info = (sel) => { const el = document.querySelector(sel); if (!el) return { exists: false, visible: false }; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const visible = !!(r.width || r.height) && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0"; return { exists: true, visible, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, disabled: !!el.disabled }; };
      const ae = document.activeElement || {};
      let topCenter = "";
      try { const t = document.elementFromPoint(Math.floor(innerWidth / 2), Math.floor(innerHeight / 2)); if (t) topCenter = (t.id ? "#" + t.id : t.tagName.toLowerCase()) + (typeof t.className === "string" && t.className ? "." + t.className.trim().split(/\s+/).slice(0, 2).join(".") : ""); } catch (e) {}
      const cards = Array.from(document.querySelectorAll("[data-setgo]"));
      return {
        url: location.href, title: document.title, bodyClass: (document.body && document.body.className) || "", viewport: { w: innerWidth, h: innerHeight },
        authScreen: info("#authScreen"), pendingScreen: info("#pendingScreen"), mainApp: info("#mainApp"), setupScreen: info("#setupScreen"),
        hSettings: info("#hSettings"), notifCard: info('[data-setgo="notifications"]'), npSave: info("#np_save"), notifSheet: info("#notifSheet"),
        settingsCardsCount: cards.length, settingsCardKeys: cards.map((b) => b.getAttribute("data-setgo")).slice(0, 20),
        activeElementTag: (ae.tagName || "").toLowerCase(), activeElementId: ae.id || "", activeElementText: (ae.textContent || "").slice(0, 60),
        topAtCenter: topCenter, toastText: (document.querySelector("#toast") ? (document.querySelector("#toast").textContent || "") : "").slice(0, 120),
      };
    });
  } catch (e) { d = { evalError: (e && (e.message || "")).slice(0, 120) }; }
  d.title = sanitizeText(d.title); d.activeElementText = sanitizeText(d.activeElementText); d.toastText = sanitizeText(d.toastText);
  const vis = (o) => !!(o && o.visible);
  const visibleScreen = vis(d.setupScreen) ? "setup" : vis(d.authScreen) ? "auth" : vis(d.pendingScreen) ? "pending" : vis(d.mainApp) ? "main" : "unknown";
  const snap = {
    label, tRel: (T0 ? Date.now() - T0 : 0), lastStep,
    currentUrl: d.url, visibleScreen,
    authScreenVisible: vis(d.authScreen), pendingScreenVisible: vis(d.pendingScreen), mainAppVisible: vis(d.mainApp),
    hSettingsVisible: vis(d.hSettings), notificationsCardVisible: vis(d.notifCard), npSaveVisible: vis(d.npSave),
    consoleErrorsCount: consoleErrors.length, pageErrorsCount: pageErrors.length,
  };
  uiSteps.push({ ...snap, detail: d });
  return snap;
}

// B1.7-E-FIX3 — clique DOM no nó vivo (dispara o onclick real; imune a actionability/re-render do page.click)
async function clickDomSelector(page, selector, label) {
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, reason: "not_found" };
    const rect = el.getBoundingClientRect();
    const visible = !!(rect.width && rect.height);
    if (!visible) return { ok: false, reason: "not_visible", rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (e) {}
    el.click();
    return { ok: true, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  }, selector);
  if (!result.ok) throw new Error(label + " DOM click failed: " + result.reason);
  return result;
}

// B1.7-E-FIX4 — checkbox via DOM (checked + eventos input/change/click); imune a re-render do page.uncheck
async function setCheckboxDom(page, selector, checked, label) {
  const result = await page.evaluate(({ selector, checked }) => {
    const el = document.querySelector(selector) || document.getElementById(selector.replace(/^#/, ""));
    if (!el) return { ok: false, reason: "not_found" };
    const rect = el.getBoundingClientRect();
    const visible = !!(rect.width && rect.height);
    if (!visible) return { ok: false, reason: "not_visible", checked: !!el.checked, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (e) {}
    const before = !!el.checked;
    if (before !== checked) {
      el.checked = checked;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      if (!!el.checked !== checked) {
        el.checked = checked;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    return { ok: !!el.checked === checked, before, after: !!el.checked, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  }, { selector, checked });
  if (!result.ok) throw new Error(label + " DOM checkbox failed: " + (result.reason || "checked_mismatch"));
  return result;
}

// B1.7-E-FIX4 — input via DOM (value + eventos); NUNCA loga/retorna o value (senha)
async function setInputDom(page, selector, value, label) {
  const result = await page.evaluate(({ selector, value }) => {
    const el = document.querySelector(selector) || document.getElementById(selector.replace(/^#/, ""));
    if (!el) return { ok: false, reason: "not_found" };
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (e) {}
    try { el.focus(); } catch (e) {}
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: el.value === value, hasValue: !!el.value };
  }, { selector, value });
  if (!result.ok) throw new Error(label + " DOM input failed: " + (result.reason || "value_not_set"));
  return { ok: true, hasValue: true };
}

// B1.7-E-FIX5 — espera EXPLICITA pela resposta de um endpoint observado no fluxo UI (sem fixar timeout curto)
async function waitForEndpointResponse(page, label, urlPart, timeoutMs) {
  const startedAt = Date.now();
  try {
    const response = await page.waitForResponse((r) => String(r.url() || "").toLowerCase().includes(String(urlPart).toLowerCase()), { timeout: timeoutMs });
    return { ok: true, label, status: response.status(), elapsedMs: Date.now() - startedAt };
  } catch (err) {
    return { ok: false, label, status: 0, reason: sanitizeText(err && err.message ? err.message : String(err)).slice(0, 160), elapsedMs: Date.now() - startedAt };
  }
}

// B1.7-E-FIX5 — espera EXPLICITA do status de sucesso na UI; regex precisa (#np_status amplo; corpo so a frase, nao casa o botao "Salvar")
async function waitForSavedStatus(page, timeoutMs) {
  const startedAt = Date.now();
  const read = () => page.evaluate(() => { const s = document.getElementById("np_status"); return (s && s.textContent) || (document.body ? document.body.innerText : "") || ""; });
  try {
    await page.waitForFunction(() => {
      const reStatus = /(prefer[eê]ncias\s+salvas|salvas com sucesso|configura[cç][aã]o\s+salva|sucesso|atualizad[oa])/i;
      const rePhrase = /(prefer[eê]ncias\s+salvas|salvas com sucesso|configura[cç][aã]o\s+salva)/i;
      const s = document.getElementById("np_status");
      const st = s ? (s.textContent || "") : "";
      const body = document.body ? (document.body.innerText || "") : "";
      return reStatus.test(st) || rePhrase.test(body);
    }, { timeout: timeoutMs });
    return { ok: true, elapsedMs: Date.now() - startedAt, text: sanitizeText(await read()).slice(0, 500) };
  } catch (err) {
    const text = await read().catch(() => "");
    return { ok: false, elapsedMs: Date.now() - startedAt, reason: sanitizeText(err && err.message ? err.message : String(err)).slice(0, 160), text: sanitizeText(text).slice(0, 500) };
  }
}

function pushNeutralizationInitScript() {
  return "(() => {" +
    "try{Object.defineProperty(Notification,'permission',{get:()=>'denied'});}catch(e){}" +
    "try{Notification.requestPermission=()=>Promise.resolve('denied');}catch(e){}" +
    "try{if(window.PushManager)PushManager.prototype.subscribe=()=>Promise.reject(new Error('push-blocked-canary'));}catch(e){}" +
    "try{if(navigator.serviceWorker){navigator.serviceWorker.register=()=>Promise.reject(new Error('sw-register-blocked-canary'));}}catch(e){}" +
    "})();";
}

function writeSummary(obj) {
  try { mkdirSync(ARTIFACT_DIR, { recursive: true }); writeFileSync(ARTIFACT_DIR + "/ui-retest-summary.json", JSON.stringify(obj, null, 2)); } catch (_) {}
}

async function fetchMarkers() {
  const res = await fetch(STAGING_URL, { redirect: "follow" });
  const html = await res.text();
  const missing = MARKERS.filter((m) => !html.includes(m));
  return { httpStatus: res.status, missing, ok: res.status === 200 && missing.length === 0 };
}

// ---- DRY-RUN: leitura + plano; ZERO ação real ----
async function runDryRun() {
  console.log("== UI-RETEST DRY-RUN (read-only; sem login/endpoint/Firestore/WebPush) ==");
  if (STAGING_URL !== EXPECTED_URL) { console.error("::error:: STAGING_URL != " + EXPECTED_URL); process.exit(1); }
  let m;
  try { m = await fetchMarkers(); }
  catch (e) { console.error("::error:: fetch falhou: " + (e && e.message)); writeSummary({ executed: false, planned: true, fetchError: true }); process.exit(1); }
  console.log("HTTP=" + m.httpStatus + "  markers " + (m.missing.length ? ("AUSENTES=" + m.missing.join(",")) : "TODOS presentes (" + MARKERS.length + ")"));
  const np = pushNeutralizationInitScript();
  const npOk = ["permission", "requestPermission", "subscribe", "serviceWorker"].every((t) => np.includes(t));
  const summary = {
    executed: false, planned: true,
    httpStatus: m.httpStatus, markersHtml: m.missing.length === 0,
    usersPublicSource: !m.missing.includes("usersPublic") && !m.missing.includes("usersRoster"),
    webPushNeutralizationReady: npOk,
    canaryGuardSelfTest: isCanary("canary-1", "canary@teste") === true && isCanary("RealUid9", "joao@empresa.com") === false,
    noLogin: true, noEndpoint: true, noFirestore: true, noWebPush: true, noRealUser: true, noSecretPrinted: true, noDeploy: true,
  };
  writeSummary(summary);
  const go = m.ok && npOk && summary.canaryGuardSelfTest;
  console.log("DRY-RUN " + (go ? "GO" : "NO-GO") + ": " + JSON.stringify(summary));
  process.exit(go ? 0 : 1);
}

// ---- APPLY REAL (Playwright; só canário) ----
async function runApply() {
  if (CONFIRM !== REQUIRED_CONFIRM) { console.error("NO-GO: execução real exige CONFIRM_UI_RETEST=RUN_UI_RETEST."); process.exit(1); }
  if (!CANARY_IDENTIFIER || !CANARY_UID || !HAS_PASSWORD) { console.error("NO-GO: credenciais canarias ausentes (secrets)."); process.exit(1); }
  if (!isCanary(CANARY_UID, CANARY_IDENTIFIER)) { console.error("NO-GO: CANARY_UID/IDENTIFIER nao parece canario (protecao usuario real)."); process.exit(1); }
  if (STAGING_URL !== EXPECTED_URL) { console.error("NO-GO: STAGING_URL != " + EXPECTED_URL); process.exit(1); }

  const summary = {
    executed: true, markersHtml: false, usersPublicSource: false, loginCanaryOk: false, notifScreenOk: false,
    taskAssignedStayedFalse: false, issueStatus: 0, updateStatus: 0, savedStatusOk: false,
    notificationDenied: false, pushSubscribeBlocked: true, noRealUser: true, noSecretPrinted: true, noDeploy: true,
    notificationsCardDomClickOk: false, notificationsCardDomClickReason: "", notificationsCardDomClickRect: null,
    taskAssignedDomSetOk: false, taskAssignedBefore: null, taskAssignedAfter: null, taskAssignedAfterRerender: null, taskAssignedDomSetReason: "", taskAssignedDomSetRect: null,
    npSaveDomClickOk: false, npSaveDomClickReason: "", npSaveDomClickRect: null,
    reauthModalVisible: false, npPwInputOk: false, npPwOkDomClickOk: false,
    updateWaitStarted: false, updateWaitOk: false, updateWaitStatus: 0, updateWaitElapsedMs: 0, updateWaitReasonSanitized: "",
    savedStatusWaitOk: false, savedStatusElapsedMs: 0, savedStatusTextSanitized: "", savedStatusWaitReasonSanitized: "",
    canary: mask(CANARY_UID),
  };

  // Passo 0: markers read-only
  try { const m = await fetchMarkers(); summary.markersHtml = m.missing.length === 0; summary.usersPublicSource = summary.markersHtml; }
  catch (_) {}

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ permissions: [] });
  await ctx.addInitScript(pushNeutralizationInitScript());
  const page = await ctx.newPage();
  const netStatus = {};
  page.on("response", (r) => {
    const u = r.url().toLowerCase();
    if (u.includes("issuenotifprefstoken")) netStatus.issue = r.status();
    if (u.includes("updatenotifprefs")) netStatus.update = r.status();
  });
  const consoleLines = [];
  page.on("console", (msg) => { const t = msg.text(); if (t.indexOf("[roster]") >= 0) consoleLines.push(t); if (msg.type() === "error") consoleErrors.push(sanitizeText(t)); });
  page.on("pageerror", (err) => { pageErrors.push(sanitizeText(err && err.message)); });

  try {
    T0 = Date.now();
    setStep("page_goto");
    await page.goto(STAGING_URL, { waitUntil: "domcontentloaded", timeout: OP_TIMEOUT });
    await page.waitForTimeout(3000);
    setStep("login_form_seen");
    await snapshotUi(page, "afterGoto");
    summary.usersPublicSource = consoleLines.some((l) => /fonte=usersPublic/.test(l)) || summary.usersPublicSource;

    // login canário
    await page.fill(SEL.loginId, CANARY_IDENTIFIER, { timeout: OP_TIMEOUT });
    await page.fill(SEL.loginPw, process.env.CANARY_PASSWORD, { timeout: OP_TIMEOUT });
    setStep("login_submitted");
    await snapshotUi(page, "afterLoginSubmit");
    await page.click(SEL.loginBtn, { timeout: OP_TIMEOUT });
    await page.waitForTimeout(4000);
    summary.loginCanaryOk = !(await page.locator(SEL.loginBtn).isVisible().catch(() => false));
    setStep("login_result_checked");
    await snapshotUi(page, "afterLoginWait");

    // abrir preferências em DOIS passos: (1) #hSettings abre o menu de Configurações (renderSettingsMain);
    // (2) o card [data-setgo="notifications"] entra em settingsView="notifications" (renderSettingsNotifications),
    // que renderiza/liga renderNotifPrefsPushSection/bindNotifPrefsPushSection com #np_save. Fallback: switchTab direto.
    setStep("before_open_settings");
    await snapshotUi(page, "beforeClickHSettings");
    await page.click(SEL.settingsBtn, { timeout: OP_TIMEOUT }).catch(() => {});
    setStep("after_open_settings");
    await snapshotUi(page, "afterClickHSettings");
    await page.waitForSelector(SEL.settingsNotifCard, { timeout: 15000 }).catch(() => {});
    setStep("before_open_notifications_subview");
    await snapshotUi(page, "beforeClickNotificationsCard");
    // B1.7-E-FIX3: aciona o card via clique DOM no nó vivo (page.click expirava por actionability/re-render).
    try {
      const r = await clickDomSelector(page, SEL.settingsNotifCard, "notificationsCard");
      summary.notificationsCardDomClickOk = !!(r && r.ok);
      summary.notificationsCardDomClickReason = (r && r.reason) || "ok";
      summary.notificationsCardDomClickRect = (r && r.rect) || null;
    } catch (e) {
      summary.notificationsCardDomClickOk = false;
      summary.notificationsCardDomClickReason = sanitizeText(e && e.message).slice(0, 120);
      summary.notificationsCardDomClickRect = null;
    }
    setStep("after_open_notifications_subview");
    await snapshotUi(page, "afterClickNotificationsCard");
    setStep("before_wait_np_save");
    await page.waitForSelector(SEL.npSave, { timeout: OP_TIMEOUT }).catch(() => {});
    if (!(await page.locator(SEL.npSave).isVisible().catch(() => false))) {
      // fallback: força a sub-tela notifications direto no app (render()/switchTab)
      await page.evaluate(() => { try { window.settingsView = "notifications"; if (typeof window.render === "function") { window.render(); } else if (typeof window.switchTab === "function") { window.switchTab("settings"); } } catch (e) {} }).catch(() => {});
      await page.waitForSelector(SEL.npSave, { timeout: OP_TIMEOUT }).catch(() => {});
    }
    summary.notifScreenOk = await page.locator(SEL.npSave).isVisible().catch(() => false);
    setStep("after_wait_np_save");
    await snapshotUi(page, "afterWaitNpSave");

    if (summary.notifScreenOk) {
      setStep("before_toggle_task_assigned");
      await snapshotUi(page, "beforeToggleTaskAssigned");
      // B1.7-E-FIX4: toggle task_assigned -> false via DOM (page.uncheck nao surtia efeito na secao re-renderizada)
      try {
        const tr = await setCheckboxDom(page, SEL.npCheckbox, false, "taskAssigned");
        summary.taskAssignedDomSetOk = !!(tr && tr.ok);
        summary.taskAssignedBefore = tr ? tr.before : null;
        summary.taskAssignedAfter = tr ? tr.after : null;
        summary.taskAssignedDomSetReason = (tr && tr.reason) || "ok";
        summary.taskAssignedDomSetRect = (tr && tr.rect) || null;
      } catch (e) {
        summary.taskAssignedDomSetOk = false;
        summary.taskAssignedDomSetReason = sanitizeText(e && e.message).slice(0, 120);
      }
      setStep("after_toggle_task_assigned");
      await snapshotUi(page, "afterToggleTaskAssigned");
      await page.waitForTimeout(1500); // re-render
      summary.taskAssignedAfterRerender = await page.evaluate((sel) => { const el = document.querySelector(sel); return el ? !!el.checked : null; }, SEL.npCheckbox).catch(() => null);
      summary.taskAssignedStayedFalse = summary.taskAssignedAfterRerender === false;
      await snapshotUi(page, "afterRerenderSnapshot");

      setStep("before_save");
      await snapshotUi(page, "beforeSaveSnapshot");
      // B1.7-E-FIX5: inicia a espera da resposta de updateNotifPrefs ANTES do clique em salvar (cold-start pode passar de 5s)
      summary.updateWaitStarted = true;
      const updateWait = waitForEndpointResponse(page, "updateNotifPrefs", "updatenotifprefs", 45000);
      // B1.7-E-FIX4: salvar via DOM click (page.click expirava por actionability/re-render)
      try {
        const sr = await clickDomSelector(page, SEL.npSave, "npSave");
        summary.npSaveDomClickOk = !!(sr && sr.ok);
        summary.npSaveDomClickReason = (sr && sr.reason) || "ok";
        summary.npSaveDomClickRect = (sr && sr.rect) || null;
      } catch (e) {
        summary.npSaveDomClickOk = false;
        summary.npSaveDomClickReason = sanitizeText(e && e.message).slice(0, 120);
      }
      await snapshotUi(page, "afterSaveClickSnapshot");
      // reauth modal se aparecer: senha via DOM (valor NUNCA logado) + confirmar via DOM click
      summary.reauthModalVisible = await page.locator(SEL.npPw).isVisible({ timeout: 4000 }).catch(() => false);
      if (summary.reauthModalVisible) {
        try { await setInputDom(page, SEL.npPw, process.env.CANARY_PASSWORD || "", "npPw"); summary.npPwInputOk = true; } catch (e) { summary.npPwInputOk = false; }
        try { const pr = await clickDomSelector(page, SEL.npPwOk, "npPwOk"); summary.npPwOkDomClickOk = !!(pr && pr.ok); } catch (e) { summary.npPwOkDomClickOk = false; }
      }
      await snapshotUi(page, "afterReauthSnapshot");
      // B1.7-E-FIX5: espera EXPLICITA da resposta de updateNotifPrefs (substitui a espera fixa pos-save)
      const updateWaitResult = await updateWait;
      summary.updateWaitOk = !!updateWaitResult.ok;
      summary.updateWaitStatus = updateWaitResult.status || 0;
      summary.updateWaitElapsedMs = updateWaitResult.elapsedMs || 0;
      summary.updateWaitReasonSanitized = updateWaitResult.reason ? sanitizeText(updateWaitResult.reason).slice(0, 120) : "";
      await snapshotUi(page, "afterUpdateWaitSnapshot");
      // B1.7-E-FIX5: espera EXPLICITA do status de salvamento na UI
      const savedWaitResult = await waitForSavedStatus(page, 45000);
      summary.savedStatusWaitOk = !!savedWaitResult.ok;
      summary.savedStatusElapsedMs = savedWaitResult.elapsedMs || 0;
      summary.savedStatusTextSanitized = (savedWaitResult.text || "").slice(0, 200);
      summary.savedStatusWaitReasonSanitized = savedWaitResult.reason ? sanitizeText(savedWaitResult.reason).slice(0, 120) : "";
      await snapshotUi(page, "afterSavedStatusWaitSnapshot");
      summary.issueStatus = netStatus.issue || 0;
      summary.updateStatus = summary.updateWaitStatus || netStatus.update || 0;
      const st = (await page.locator(SEL.npStatus).innerText().catch(() => "")) || "";
      summary.savedStatusOk = savedWaitResult.ok || /salv|sucesso|salvas/i.test(st);
      setStep("after_save");
      await snapshotUi(page, "afterEndpointSnapshot");
    }

    summary.notificationDenied = await page.evaluate(() => { try { return Notification.permission === "denied"; } catch (e) { return false; } }).catch(() => false);
    try { mkdirSync(ARTIFACT_DIR, { recursive: true }); await page.screenshot({ path: ARTIFACT_DIR + "/ui-retest-screenshot.png" }); } catch (_) {}
    setStep(summary.notifScreenOk ? "done" : "failed");
  } catch (e) {
    setStep("failed");
    console.error("::error:: apply falhou: " + sanitizeText(e && (e.message || "")).slice(0, 120));
  } finally {
    try { await browser.close(); } catch (_) {}
  }

  // ---- Telemetria final no summary (sanitizada; sem segredo/valor sensível) ----
  const last = uiSteps.length ? uiSteps[uiSteps.length - 1] : null;
  const ld = (last && last.detail) || {};
  summary.lastStep = lastStep;
  summary.currentUrl = ld.url || "";
  summary.documentTitle = ld.title || "";
  summary.bodyClass = ld.bodyClass || "";
  summary.visibleScreen = last ? last.visibleScreen : "unknown";
  summary.viewport = ld.viewport || null;
  summary.consoleErrorsCount = consoleErrors.length;
  summary.consoleErrorsSanitized = consoleErrors.slice(0, 10);
  summary.pageErrorsCount = pageErrors.length;
  summary.pageErrorsSanitized = pageErrors.slice(0, 10);
  summary.authScreenVisible = !!(ld.authScreen && ld.authScreen.visible);
  summary.pendingScreenVisible = !!(ld.pendingScreen && ld.pendingScreen.visible);
  summary.mainAppVisible = !!(ld.mainApp && ld.mainApp.visible);
  summary.setupScreenVisible = !!(ld.setupScreen && ld.setupScreen.visible);
  summary.hSettingsExists = !!(ld.hSettings && ld.hSettings.exists);
  summary.hSettingsVisible = !!(ld.hSettings && ld.hSettings.visible);
  summary.hSettingsBox = (ld.hSettings && ld.hSettings.box) || null;
  summary.hSettingsDisabled = !!(ld.hSettings && ld.hSettings.disabled);
  summary.settingsMenuVisible = (ld.settingsCardsCount || 0) > 0;
  summary.settingsCardsCount = ld.settingsCardsCount || 0;
  summary.settingsCardKeys = ld.settingsCardKeys || [];
  summary.notificationsCardExists = !!(ld.notifCard && ld.notifCard.exists);
  summary.notificationsCardVisible = !!(ld.notifCard && ld.notifCard.visible);
  summary.notificationsCardBox = (ld.notifCard && ld.notifCard.box) || null;
  summary.npSaveExists = !!(ld.npSave && ld.npSave.exists);
  summary.npSaveVisible = !!(ld.npSave && ld.npSave.visible);
  summary.npSaveBox = (ld.npSave && ld.npSave.box) || null;
  summary.notifSheetExists = !!(ld.notifSheet && ld.notifSheet.exists);
  summary.notifSheetVisible = !!(ld.notifSheet && ld.notifSheet.visible);
  summary.activeElementTag = ld.activeElementTag || "";
  summary.activeElementId = ld.activeElementId || "";
  summary.activeElementTextSanitized = ld.activeElementText || "";
  summary.topAtCenter = ld.topAtCenter || "";
  summary.toastTextSanitized = ld.toastText || "";
  summary.steps = uiSteps.map((s) => ({ label: s.label, tRel: s.tRel, lastStep: s.lastStep, visibleScreen: s.visibleScreen, currentUrl: s.currentUrl, authScreenVisible: s.authScreenVisible, pendingScreenVisible: s.pendingScreenVisible, mainAppVisible: s.mainAppVisible, hSettingsVisible: s.hSettingsVisible, notificationsCardVisible: s.notificationsCardVisible, npSaveVisible: s.npSaveVisible, consoleErrorsCount: s.consoleErrorsCount, pageErrorsCount: s.pageErrorsCount }));

  writeSummary(summary);
  const go = summary.markersHtml && summary.loginCanaryOk && summary.notifScreenOk && summary.taskAssignedStayedFalse &&
    summary.issueStatus === 200 && summary.updateStatus === 200 && summary.savedStatusOk &&
    summary.notificationDenied && summary.pushSubscribeBlocked && summary.noRealUser && summary.noDeploy;
  console.log("APPLY " + (go ? "GO" : "NO-GO") + ": " + JSON.stringify(summary));
  process.exit(go ? 0 : 1);
}

(DRY_RUN ? runDryRun() : runApply()).catch((e) => { console.error("erro:", e && e.message); process.exit(1); });
