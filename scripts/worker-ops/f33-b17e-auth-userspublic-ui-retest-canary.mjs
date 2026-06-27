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
  npCheckbox: "#np_task_assigned", npSave: "#np_save", npStatus: "#np_status",
  npPw: "#np_pw", npPwOk: "#np_pw_ok",
};

const isCanary = (uid, ident) =>
  /canary|canario|teste|test|qa/i.test(String(uid || "")) || /canary|canario|teste|test|qa/i.test(String(ident || ""));
const mask = (s) => (s ? (String(s).slice(0, 2) + "***" + String(s).length) : "<unset>");

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
  page.on("console", (msg) => { const t = msg.text(); if (t.indexOf("[roster]") >= 0) consoleLines.push(t); });

  try {
    await page.goto(STAGING_URL, { waitUntil: "domcontentloaded", timeout: OP_TIMEOUT });
    await page.waitForTimeout(3000);
    summary.usersPublicSource = consoleLines.some((l) => /fonte=usersPublic/.test(l)) || summary.usersPublicSource;

    // login canário
    await page.fill(SEL.loginId, CANARY_IDENTIFIER, { timeout: OP_TIMEOUT });
    await page.fill(SEL.loginPw, process.env.CANARY_PASSWORD, { timeout: OP_TIMEOUT });
    await page.click(SEL.loginBtn, { timeout: OP_TIMEOUT });
    await page.waitForTimeout(4000);
    summary.loginCanaryOk = !(await page.locator(SEL.loginBtn).isVisible().catch(() => false));

    // abrir preferências (aba settings) — caminho exato finalizado no apply real; espera robusta por #np_save
    await page.evaluate(() => { try { if (typeof window.setTab === "function") window.setTab("settings"); } catch (e) {} }).catch(() => {});
    await page.waitForSelector(SEL.npSave, { timeout: OP_TIMEOUT }).catch(() => {});
    summary.notifScreenOk = await page.locator(SEL.npSave).isVisible().catch(() => false);

    if (summary.notifScreenOk) {
      const cb = page.locator(SEL.npCheckbox);
      if (await cb.isChecked().catch(() => false)) await cb.uncheck({ timeout: OP_TIMEOUT }).catch(() => {});
      await page.waitForTimeout(1500); // re-render
      summary.taskAssignedStayedFalse = (await cb.isChecked().catch(() => true)) === false;

      await page.click(SEL.npSave, { timeout: OP_TIMEOUT }).catch(() => {});
      // reauth modal se aparecer
      if (await page.locator(SEL.npPw).isVisible({ timeout: 4000 }).catch(() => false)) {
        await page.fill(SEL.npPw, process.env.CANARY_PASSWORD).catch(() => {});
        await page.click(SEL.npPwOk).catch(() => {});
      }
      await page.waitForTimeout(5000);
      summary.issueStatus = netStatus.issue || 0;
      summary.updateStatus = netStatus.update || 0;
      const st = (await page.locator(SEL.npStatus).innerText().catch(() => "")) || "";
      summary.savedStatusOk = /salv|sucesso|salvas/i.test(st);
    }

    summary.notificationDenied = await page.evaluate(() => { try { return Notification.permission === "denied"; } catch (e) { return false; } }).catch(() => false);
    try { mkdirSync(ARTIFACT_DIR, { recursive: true }); await page.screenshot({ path: ARTIFACT_DIR + "/ui-retest-screenshot.png" }); } catch (_) {}
  } catch (e) {
    console.error("::error:: apply falhou: " + (e && (e.message || "").slice(0, 120)));
  } finally {
    try { await browser.close(); } catch (_) {}
  }

  writeSummary(summary);
  const go = summary.markersHtml && summary.loginCanaryOk && summary.notifScreenOk && summary.taskAssignedStayedFalse &&
    summary.issueStatus === 200 && summary.updateStatus === 200 && summary.savedStatusOk &&
    summary.notificationDenied && summary.pushSubscribeBlocked && summary.noRealUser && summary.noDeploy;
  console.log("APPLY " + (go ? "GO" : "NO-GO") + ": " + JSON.stringify(summary));
  process.exit(go ? 0 : 1);
}

(DRY_RUN ? runDryRun() : runApply()).catch((e) => { console.error("erro:", e && e.message); process.exit(1); });
