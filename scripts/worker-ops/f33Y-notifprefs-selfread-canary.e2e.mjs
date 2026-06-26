#!/usr/bin/env node
/*
 * F3.3.20-B1.7-E — Reteste canário E2E do self-read de notifPrefs (read-after-write real).
 * =====================================================================================
 * Prova, contra o Hosting PUBLICADO (https://agenda-id-seven.web.app), que a UI:
 *   1) salva task_assigned=false via UI/endpoints (issueNotifPrefsToken + updateNotifPrefs);
 *   2) após reentrada REAL com storage limpo (novo contexto incógnito), chama getNotifPrefs;
 *   3) recebe prefs.byEvent.task_assigned=false e renderiza #np_task_assigned OFF (sem default).
 *
 * Segurança (linha B1.7-E):
 *  - Atua APENAS no usuário canário (uid fixo). Nunca toca usuário real.
 *  - Único write Firestore DIRETO = re-seed efêmero da SENHA do canário (campos: pass, salt,
 *    updatedAt, reseedFor, reseedRunId). NUNCA escreve em notifPrefs diretamente (só a UI/endpoint).
 *  - Web Push BLOQUEADO no browser (Notification.permission=denied; PushManager.subscribe rejeita).
 *  - NUNCA imprime senha/pass/salt/Bearer/token (mascara via ::add-mask:: e não salva headers).
 *  - Validação final do Firestore é READ-ONLY (get). Sem deploy. Sem flags. Sem Web Push.
 *
 * Requisitos de ambiente (fornecidos pelo workflow gated):
 *  - GOOGLE_APPLICATION_CREDENTIALS apontando para SA com acesso Firestore do projeto.
 *  - Egress para o site, os 3 endpoints run.app e Google APIs.
 *  - Playwright (chromium) e firebase-admin instalados.
 */
import { chromium } from "playwright";
import admin from "firebase-admin";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SITE        = "https://agenda-id-seven.web.app";
const ISSUE_HOST  = "issuenotifprefstoken-de36pi7vza-uc.a.run.app";
const UPDATE_HOST = "updatenotifprefs-de36pi7vza-uc.a.run.app";
const GET_HOST    = "getnotifprefs-de36pi7vza-uc.a.run.app";
const PROJECT     = "agenda-id-seven";
const CANARY_UID  = "canary-pwa-staging-notifprefs";
const CANARY_EMAIL= "canary-pwa-staging-notifprefs@idseven.test";
const OUT         = process.env.RETEST_OUT || "retest-artifacts";
const RUN_ID      = String(process.env.GITHUB_RUN_ID || "local");

fs.mkdirSync(OUT, { recursive: true });
const report = { phase: "F3.3.20-B1.7-E-CANARY-RETEST", site: SITE, canary: CANARY_UID, runId: RUN_ID, steps: {}, go: false };
const log  = (...a) => console.log("[retest]", ...a);
const mask = (s) => { if (s) console.log("::add-mask::" + s); };
const sha256Hex = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
function writeReport(){ try { fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2)); } catch (_) {} }
function fail(msg){ report.error = msg; writeReport(); console.error("::error:: " + msg); process.exit(1); }

// Bloqueio de Web Push injetado ANTES de qualquer script da página.
const WP_INIT = `(function(){
  try { window.__wpAttempt = false; } catch(e){}
  try { Object.defineProperty(Notification, "permission", { configurable:true, get:function(){ return "denied"; } }); } catch(e){}
  try { Notification.requestPermission = function(){ return Promise.resolve("denied"); }; } catch(e){}
  try { if (window.PushManager && PushManager.prototype) {
    PushManager.prototype.subscribe = function(){ try{ window.__wpAttempt = true; }catch(e){} return Promise.reject(new Error("webpush blocked by canary retest")); };
  } } catch(e){}
})();`;

let browser;
try {
  // ---------------------------------------------------------------------------
  // FASE 0 — Admin SDK: pré-validação do canário + re-seed efêmero da senha
  // ---------------------------------------------------------------------------
  admin.initializeApp({ projectId: PROJECT });
  const db = admin.firestore();
  const userRef = db.collection("users").doc(CANARY_UID);

  const pre = await userRef.get();
  if (!pre.exists) fail("usuario canario ausente: " + CANARY_UID);
  const u = pre.data() || {};
  report.steps.canaryPre = {
    status: u.status || null,
    role_tester: u.role === "tester",
    admin_false: u.admin === false,
    canary_true: u.canary === true,
    fcmTokens_absent: !(u.fcmTokens),
    phone_absent: !(u.phone),
  };
  if (u.status !== "ativo") fail("canario nao esta ativo (status=" + u.status + ")");
  if (u.fcmTokens) fail("canario ja possui fcmTokens (inesperado) — abortando para nao mascarar Web Push");

  const pw   = crypto.randomBytes(24).toString("base64url"); mask(pw);
  const salt = crypto.randomBytes(16).toString("hex");        mask(salt);
  const pass = "s2:" + sha256Hex(salt + "|" + pw);            mask(pass);
  await userRef.set({ pass, salt, updatedAt: Date.now(), reseedFor: "selfread-canary-retest", reseedRunId: RUN_ID }, { merge: true });
  report.steps.reseed = { ok: true, fields: ["pass", "salt", "updatedAt", "reseedFor", "reseedRunId"], note: "valores mascarados; notifPrefs NUNCA escrito direto" };
  log("re-seed efemero OK (somente pass/salt/updatedAt/reseedFor/reseedRunId; valores mascarados)");

  // ---------------------------------------------------------------------------
  // Helpers de browser
  // ---------------------------------------------------------------------------
  browser = await chromium.launch({ headless: true });

  function attachNet(page, store){
    page.on("response", async (resp) => {
      const url = resp.url();
      try {
        if (url.includes(ISSUE_HOST))       store.issue = resp.status();
        else if (url.includes(UPDATE_HOST)) store.update = resp.status();
        else if (url.includes(GET_HOST)) {
          store.get = resp.status();
          try { store.getBody = await resp.json(); } catch (_) { store.getBodyText = "(corpo nao-JSON)"; }
        }
      } catch (_) {}
    });
  }
  async function newCtx(){ const ctx = await browser.newContext(); await ctx.addInitScript(WP_INIT); return ctx; }
  async function login(page){
    await page.goto(SITE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#lUser", { timeout: 45000 });
    // espera a lista de usuarios carregar. 'users' e um top-level `let` no app (index.html),
    // que NAO vira propriedade de window; por isso referenciamos o binding global direto
    // (com try/catch para tolerar ReferenceError ate o boot popular a lista).
    await page.waitForFunction((email) => {
      try { return Array.isArray(users) && users.some((x) => ((x.email || "").toLowerCase() === email)); }
      catch (e) { return false; }
    }, CANARY_EMAIL, { timeout: 60000 });
    await page.fill("#lUser", CANARY_EMAIL);
    await page.fill("#lPass", pw);
    await page.click("#doLogin");
    await page.waitForFunction(() => { const m = document.getElementById("mainApp"); return m && !m.classList.contains("hidden"); }, null, { timeout: 45000 });
  }
  async function gotoNotif(page){
    // entrada REAL na secao Notificacoes via funcoes globais do app (reset igual ao clique data-setgo)
    await page.evaluate(() => { try { notifPrefsHydrateTried = false; notifPrefsLoadState = "idle"; settingsView = "notifications"; switchTab("settings"); } catch (e) {} });
    await page.waitForSelector("#np_save", { timeout: 30000 });
  }
  async function fillPwModal(page){
    await page.waitForSelector("#np_pw", { timeout: 20000 });
    const r = await page.evaluate((p) => {
      const i = document.getElementById("np_pw"); if (!i) return "nomodal";
      if (i.type !== "password") return "nottype";
      i.value = p; const b = document.getElementById("np_pw_ok"); if (!b) return "nobtn"; b.click(); return "ok";
    }, pw);
    if (r === "nottype") fail("modal de senha nao e type=password");
    if (r !== "ok") fail("modal de senha ausente/incompleto (" + r + ")");
  }
  // O #content re-renderiza continuamente (listeners do app); acionamos elementos internos
  // via evaluate ATOMICO (getElementById + click no mesmo tick) com retry, e confirmamos por
  // REDE — robusto ao "element detached from the DOM". O modal (#np_pw) fica em document.body.
  async function openModalVia(page, doClick){
    for (let i = 0; i < 12; i++){
      await page.evaluate(doClick).catch(() => {});
      const m = await page.waitForSelector("#np_pw", { timeout: 2500 }).catch(() => null);
      if (m) return true;
      await page.waitForTimeout(400);
    }
    return false;
  }
  async function waitNet(page, store, key, tries){ for (let i = 0; i < tries && store[key] === undefined; i++) { await page.waitForTimeout(500); } }

  // ---------------------------------------------------------------------------
  // FASE 1 — SAVE: task_assigned=false via UI/endpoints (contexto 1)
  // ---------------------------------------------------------------------------
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    const net = {};
    attachNet(page, net);
    await login(page);
    await gotoNotif(page);
    // estado desejado (enabled/event/chat/android ON, task_assigned OFF) + SALVAR em UM
    // evaluate atomico (resiliente ao re-render do #content); modal abre em document.body.
    const savedOpened = await openModalVia(page, () => {
      const set = (id, v) => { const el = document.getElementById(id); if (el) { el.checked = v; el.dispatchEvent(new Event("change", { bubbles: true })); } };
      set("np_enabled", true); set("np_event_assigned", true); set("np_chat_message", true); set("np_android", true); set("np_task_assigned", false);
      const s = document.getElementById("np_save"); if (s) s.click();
    });
    if (!savedOpened) fail("modal de senha do SAVE nao abriu");
    await fillPwModal(page);
    // confirma por REDE (robusto ao re-render do #np_status)
    await waitNet(page, net, "issue", 90);
    await waitNet(page, net, "update", 90);
    report.steps.save = { issue: net.issue || null, update: net.update || null, wpAttempt: await page.evaluate(() => !!window.__wpAttempt) };
    if (net.issue !== 200) fail("issueNotifPrefsToken != 200 (got " + net.issue + ")");
    if (net.update !== 200) fail("updateNotifPrefs != 200 (got " + net.update + ")");
    log("SAVE OK: issue=200 update=200 (task_assigned=false gravado via UI/endpoints)");
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  // FASE 2 — SELF-READ: reentrada REAL (contexto novo/incognito) + getNotifPrefs
  // ---------------------------------------------------------------------------
  {
    const ctx = await newCtx(); // storage totalmente limpo => sem cache/draft em memoria
    const page = await ctx.newPage();
    const net = {};
    attachNet(page, net);
    await login(page);
    await gotoNotif(page);
    // fresh entry => need_password => "Carregar" abre o modal (clique atomico, com retry)
    await page.waitForFunction(() => !!document.getElementById("np_load"), null, { timeout: 20000 }).catch(() => {});
    const loadOpened = await openModalVia(page, () => { const b = document.getElementById("np_load"); if (b) b.click(); });
    if (!loadOpened) fail("botao Carregar / modal do SELF-READ nao abriu");
    await fillPwModal(page);
    // aguarda a resposta do getNotifPrefs (rede) e a UI sair de loading/idle/need_password
    await waitNet(page, net, "get", 90);
    await page.waitForFunction(() => typeof notifPrefsLoadState !== "undefined" && ["loaded", "defaults", "error"].indexOf(notifPrefsLoadState) >= 0, null, { timeout: 30000 }).catch(() => {});

    const body = net.getBody || {};
    // leitura em UM snapshot (evita flakiness do re-render): draft e a fonte de verdade do render
    const snap = await page.evaluate(() => ({
      loadState: (typeof notifPrefsLoadState !== "undefined") ? notifPrefsLoadState : null,
      draftTask: (typeof notifPrefsDraftState !== "undefined" && notifPrefsDraftState && notifPrefsDraftState.byEvent) ? notifPrefsDraftState.byEvent.task_assigned : null,
      uiTask: (() => { const e = document.getElementById("np_task_assigned"); return e ? e.checked : null; })(),
      uiEvent: (() => { const e = document.getElementById("np_event_assigned"); return e ? e.checked : null; })(),
      uiChat: (() => { const e = document.getElementById("np_chat_message"); return e ? e.checked : null; })(),
      uiAndroid: (() => { const e = document.getElementById("np_android"); return e ? e.checked : null; })(),
      wpAttempt: !!window.__wpAttempt,
      permGranted: (() => { try { return Notification.permission === "granted"; } catch (e) { return false; } })(),
    }));

    report.steps.selfread = {
      getNotifPrefs_status: net.get || null,
      response_exists: body && body.exists === true,
      response_task_assigned: body && body.prefs && body.prefs.byEvent ? body.prefs.byEvent.task_assigned : null,
      draft_task_assigned: snap.draftTask,
      ui_task_assigned_checked: snap.uiTask,
      ui_event_assigned_checked: snap.uiEvent,
      ui_chat_message_checked: snap.uiChat,
      ui_android_checked: snap.uiAndroid,
      ui_loadState: snap.loadState,        // "loaded" => veio do servidor (nao defaults)
      webpush_attempt: snap.wpAttempt,
      notification_permission_granted: snap.permGranted,
    };
    // resposta de getNotifPrefs SEM headers/sem token (corpo allowlisted: ok/exists/prefs)
    try { fs.writeFileSync(path.join(OUT, "getnotifprefs-response.json"), JSON.stringify(body, null, 2)); } catch (_) {}
    try { await page.screenshot({ path: path.join(OUT, "notifications-selfread.png"), fullPage: true }); } catch (_) {}

    if (net.get !== 200) fail("getNotifPrefs != 200 (got " + net.get + ")");
    if (!(body && body.exists === true)) fail("getNotifPrefs response exists != true");
    if (!(body.prefs && body.prefs.byEvent && body.prefs.byEvent.task_assigned === false)) fail("getNotifPrefs prefs.byEvent.task_assigned != false");
    if (snap.loadState !== "loaded") fail("UI loadState != loaded (pode ter mostrado defaults silenciosos): " + snap.loadState);
    if (snap.draftTask !== false) fail("draft (fonte do render) task_assigned != false: " + snap.draftTask);
    if (snap.uiTask !== false) fail("UI np_task_assigned NAO esta OFF apos self-read");
    if (snap.permGranted) fail("Notification.permission === granted (Web Push nao deveria ativar)");
    log("SELF-READ OK: getNotifPrefs=200 exists=true task_assigned=false; UI checkbox OFF; loadState=loaded");
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  // FASE 3 — Validação Firestore READ-ONLY (estado final)
  // ---------------------------------------------------------------------------
  {
    const prefsSnap = await db.collection("notifPrefs").doc(CANARY_UID).get();
    const p = prefsSnap.exists ? (prefsSnap.data() || {}) : null;
    const uSnap = await userRef.get();
    const u2 = uSnap.data() || {};
    const fs2 = {
      prefs_exists: !!p,
      enabled: !!(p && p.enabled === true),
      task_assigned: !!(p && p.byEvent && p.byEvent.task_assigned === false),
      event_assigned: !!(p && p.byEvent && p.byEvent.event_assigned === true),
      chat_message: !!(p && p.byEvent && p.byEvent.chat_message === true),
      android: !!(p && p.byPlatform && p.byPlatform.android === true),
      updatedAt: !!(p && p.updatedAt),
      has_uid: !!(u2 && Object.prototype.hasOwnProperty.call(u2, "uid")),
      user_fcmTokens_absent: !(u2 && u2.fcmTokens),
      user_phone_absent: !(u2 && u2.phone),
    };
    report.steps.firestore = fs2;
    const must = ["prefs_exists","enabled","task_assigned","event_assigned","chat_message","android","updatedAt","user_fcmTokens_absent","user_phone_absent"];
    for (const k of must) if (!fs2[k]) fail("Firestore validation falhou em: " + k);
    if (fs2.has_uid) fail("users/canario possui campo uid (esperado has_uid=false)");
    log("FIRESTORE OK (read-only): task_assigned=false; fcmTokens/phone ausentes; has_uid=false");
  }

  report.go = true;
  writeReport();
  log("GO — reteste canario self-read concluido com sucesso.");
  await browser.close();
  process.exit(0);
} catch (e) {
  try { if (browser) await browser.close(); } catch (_) {}
  fail("excecao no reteste: " + (e && e.message ? e.message : String(e)));
}
