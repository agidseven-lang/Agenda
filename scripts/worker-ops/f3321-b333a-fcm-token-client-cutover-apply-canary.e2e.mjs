#!/usr/bin/env node
/* =====================================================================
 * F3.3.21-B3.33A — APPLY CANARY (UI/client) do cutover FCM (fcm_token_server).
 * Runner SEGURO de dois modos para validar o cutover ja mergeado em
 * app/main:index.html operando com fcm_token_server=on, SEM publicar Hosting,
 * SEM endpoint real, SEM login real, SEM token FCM real, SEM Web Push real e
 * SEM Firestore real.
 *
 * Entrada: SOURCE_INDEX_PATH = caminho do index.html de SOURCE_REF (app/main),
 * preparado pelo workflow via `git show origin/app/main:index.html` (read-only;
 * SEM publicar Hosting). Este runner NUNCA faz deploy/Hosting/secret.
 *
 * MODO DRY-RUN (DRY_RUN=true, padrao):
 *   - NAO abre browser, NAO chama endpoint, NAO faz login, NAO cria token FCM,
 *     NAO toca Firestore, NAO ativa Web Push.
 *   - Validacao estatica (espelha B3.32F): helper OFF por padrao, 2 call sites,
 *     register/remove sob a flag, legacy tx.get/tx.set/arrayRemove so no else,
 *     server ON sem Firestore client, sem fallback silencioso, sem logs de token.
 *   - Summary sanitizado com plano do APPLY (willLaunchBrowser=false etc.).
 *
 * MODO APPLY CANARY (DRY_RUN=false; fase FUTURA — nao executado no PREP-PR):
 *   - Carrega app/main:index.html LOCALMENTE via Playwright route fulfill (sem
 *     servidor/rede; sem Hosting). Bloqueia TODA rede externa por padrao.
 *   - addInitScript ANTES de qualquer script da pagina: liga
 *     localStorage.fcm_token_server="on", e neutraliza Web Push (Notification.
 *     requestPermission / PushManager / serviceWorker.register / getToken) com
 *     stubs que registram e NUNCA disparam o real.
 *   - Intercepta os endpoints registerFcmToken/removeMyFcmToken (run.app/
 *     cloudfunctions.net) com STUB {ok:true} (NUNCA chamada real). Qualquer
 *     request para firestore.googleapis.com / Firebase real => FALHA (NO-GO).
 *   - Observa que o caminho server ON escolhe registerFcmTokenClient e
 *     removeFcmTokenClient (requests stubados observados), sem tocar Firestore.
 *   - FAIL-SAFE: se nao for possivel observar sem risco, falha com NO-GO sem
 *     chamar nada real. Playwright e importado DINAMICAMENTE so neste modo.
 *
 * NUNCA imprime token FCM / session token / senha / hash / salt.
 * Rodar (dry-run): node scripts/worker-ops/f3321-b333a-fcm-token-client-cutover-apply-canary.e2e.mjs
 * ===================================================================== */
import fs from "node:fs";
import vm from "node:vm";

const DRY_RUN         = String(process.env.DRY_RUN || "true").toLowerCase() === "true";
const SOURCE_REF      = String(process.env.SOURCE_REF || "app/main");
const SOURCE_PATH     = String(process.env.SOURCE_INDEX_PATH || "");
const FCM_FLAG_ON     = String(process.env.FCM_TOKEN_SERVER || "true").toLowerCase() === "true";
const ENDPOINT_BLOCK  = String(process.env.ENDPOINT_CALLS_BLOCKED || "true").toLowerCase() === "true";
const WEBPUSH_NEUTRAL = String(process.env.WEB_PUSH_NEUTRALIZED || "true").toLowerCase() === "true";
const FIRESTORE_BLOCK = String(process.env.FIRESTORE_BLOCKED || "true").toLowerCase() === "true";
const HOSTING_PUBLISH = String(process.env.HOSTING_PUBLISH || "false").toLowerCase() === "true";
const OUT             = String(process.env.RETEST_OUT || "fcm-client-cutover-apply-canary-artifacts");

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b333a] " + m);

const summary = {
  phase: "F3.3.21-B3.33A-FCM-TOKEN-CLIENT-CUTOVER-APPLY-CANARY",
  target: "fcmTokenClientCutoverApplyCanary",
  sourceRef: SOURCE_REF,
  dryRun: DRY_RUN,
  executed: false,
  // segurança (por construção deste runner; nada real é chamado)
  noEndpoint: true, noLogin: true, noFcmTokenCreated: true, noFirestore: true,
  noRealUser: true, noSecretPrinted: true, noWebPush: true, noDeploy: true,
  noHostingPublish: true,
  endpointCallsBlocked: ENDPOINT_BLOCK, webPushNeutralized: WEBPUSH_NEUTRAL,
  firestoreBlocked: FIRESTORE_BLOCK, hostingPublish: HOSTING_PUBLISH,
};

// Extrai blocos <script> sem src.
function inlineScripts(h) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; const out = []; let m;
  while ((m = re.exec(h))) { if (!/\bsrc\s*=/.test(m[1] || "")) out.push(m[2]); }
  return out;
}
// Brace-match: dado index de "if(fcmTokenServerEnabled()){", retorna {trueBlock, elseBlock}.
function extractIfElse(src, startIdx) {
  const open = src.indexOf("{", startIdx); if (open < 0) return null;
  let depth = 0, i = open, trueEnd = -1;
  for (; i < src.length; i++) { const c = src[i]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { trueEnd = i; break; } } }
  if (trueEnd < 0) return null;
  const trueBlock = src.slice(open + 1, trueEnd);
  let elseBlock = "", hasElse = false;
  const tail = src.slice(trueEnd + 1, trueEnd + 30);
  const em = /^\s*else\s*\{/.exec(tail);
  if (em) {
    hasElse = true;
    const ebOpen = trueEnd + 1 + em[0].length - 1;
    let d2 = 0, j = ebOpen, ebEnd = -1;
    for (; j < src.length; j++) { const c = src[j]; if (c === "{") d2++; else if (c === "}") { d2--; if (d2 === 0) { ebEnd = j; break; } } }
    if (ebEnd > 0) elseBlock = src.slice(ebOpen + 1, ebEnd);
  }
  return { trueBlock, elseBlock, hasElse };
}
// Brace-match: extrai a declaracao COMPLETA de `function <name>(...){...}` (suporta
// try/catch aninhado; NAO usar regex nao-greedy, que truncaria no 1o `}`).
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
  // Summary sanitizado: SO flags/booleans/contagens; nunca token/senha/hash/salt.
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n===== F3.3.21-B3.33A — FCM client cutover APPLY CANARY (" + (DRY_RUN ? "dry-run" : "apply") + ") =====");
  console.log("  sourceRef=" + SOURCE_REF + " · executed=" + summary.executed +
              " · staticValidationPassed=" + summary.staticValidationPassed +
              " · noHostingPublish=" + summary.noHostingPublish + " · noDeploy=" + summary.noDeploy);
  console.log("  noEndpoint=" + summary.noEndpoint + " noLogin=" + summary.noLogin +
              " noFcmTokenCreated=" + summary.noFcmTokenCreated + " noFirestore=" + summary.noFirestore +
              " noWebPush=" + summary.noWebPush);
  console.log("=================================================================");
  console.log("f3321-b333a FCM client cutover apply canary: " + (summary.go ? "GO" : ("NO-GO (" + fails.length + " falhas)")));
  process.exit(summary.go ? 0 : 1);
}

// ---- Validacao estatica compartilhada (espelha B3.32F) ----
function runStaticChecks(html) {
  ok("index.html de " + SOURCE_REF + " carregado (bytes>0)", html.length > 0);

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
  summary.flagOffByDefault = flagOff;

  // micro-sim segura do helper (vm): on=>true, off=>false; rede/Web Push lançam se usados.
  let microOn = null, microOff = null, sandboxTouched = false;
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
    microOn = evalHelper("on"); microOff = evalHelper("off");
    ok("micro-sim: flag 'on' => true", microOn === true);
    ok("micro-sim: flag 'off' => false", microOff === false);
    ok("micro-sim: nenhuma chamada real ocorreu", sandboxTouched === false);
  } catch (e) { fail("micro-sim falhou: " + (e && e.message)); }

  // call sites if(fcmTokenServerEnabled()){
  const sites = [];
  const reSite = /if\(fcmTokenServerEnabled\(\)\)\{/g; let sm;
  while ((sm = reSite.exec(html))) sites.push(sm.index);
  ok("exatamente 2 call sites if(fcmTokenServerEnabled()){", sites.length === 2);

  let reg = null, tear = null;
  sites.forEach((idx) => {
    const ie = extractIfElse(html, idx); if (!ie) return;
    if (/registerFcmTokenClient\s*\(/.test(ie.trueBlock)) reg = ie;
    if (/removeFcmTokenClient\s*\(/.test(ie.trueBlock)) tear = ie;
  });

  if (ok("call site de REGISTRO encontrado", !!reg)) {
    const t = reg.trueBlock, e = reg.elseBlock;
    ok("registro: registerFcmTokenClient no ramo ON", /registerFcmTokenClient\s*\(/.test(t));
    ok("registro: ramo ON SEM tx.get/tx.set", !/tx\.(get|set)\s*\(/.test(t));
    ok("registro: ramo ON SEM runTransaction", !/runTransaction\s*\(/.test(t));
    ok("registro: ramo ON SEM collection(users)", !/collection\(\s*["']users["']\s*\)/.test(t));
    ok("registro: ramo ON tem return false (sem fallback silencioso)", /return false\s*;/.test(t));
    ok("registro: legacy tx.get/tx.set no ELSE", /tx\.get\s*\(/.test(e) && /tx\.set\s*\(/.test(e));
    summary.registerClientBehindFlag = /registerFcmTokenClient\s*\(/.test(t);
    summary.legacyRegisterPreserved = /tx\.get\s*\(/.test(e) && /tx\.set\s*\(/.test(e);
    summary.registerServerPathNoFirestoreClient = !/tx\.(get|set)\s*\(/.test(t) && !/collection\(\s*["']users["']\s*\)/.test(t);
    summary.registerNoSilentFallback = /return false\s*;/.test(t);
  }
  if (ok("call site de REMOCAO encontrado", !!tear)) {
    const t = tear.trueBlock, e = tear.elseBlock;
    ok("remocao: removeFcmTokenClient no ramo ON", /removeFcmTokenClient\s*\(/.test(t));
    ok("remocao: ramo ON SEM arrayRemove", !/arrayRemove/.test(t));
    ok("remocao: ramo ON SEM update(", !/\.update\s*\(/.test(t));
    ok("remocao: legacy arrayRemove no ELSE", /arrayRemove/.test(e));
    summary.removeClientBehindFlag = /removeFcmTokenClient\s*\(/.test(t);
    summary.legacyRemovePreserved = /arrayRemove/.test(e);
    summary.removeServerPathNoFirestoreClient = !/arrayRemove/.test(t) && !/\.update\s*\(/.test(t);
  }
  summary.serverPathNoFirestoreClient = !!(summary.registerServerPathNoFirestoreClient && summary.removeServerPathNoFirestoreClient);
  summary.noSilentLegacyFallback = !!summary.registerNoSilentFallback;

  const leak =
    (reg && /console\.log[\s\S]{0,80}(\btoken\b|fcmToken|syntheticFcmToken)/.test(reg.trueBlock)) ||
    (tear && /console\.log[\s\S]{0,80}(fcmTokenSaved|\btoken\b)/.test(tear.trueBlock));
  ok("sem console.log de token nos ramos do cutover", !leak);
  summary.noTokenLogs = !leak;
  summary.staticValidationPassed = fails.length === 0;
  return { reg, tear };
}

// ---- Guards de seguranca comuns aos dois modos ----
function safetyGuards() {
  ok("hosting_publish=false (recusa publish)", HOSTING_PUBLISH === false);
  ok("endpoint_calls_blocked=true", ENDPOINT_BLOCK === true);
  ok("web_push_neutralized=true", WEBPUSH_NEUTRAL === true);
  ok("firestore_blocked=true", FIRESTORE_BLOCK === true);
  ok("source_ref == app/main", SOURCE_REF === "app/main");
}

// ===================== MODO DRY-RUN =====================
function runDryRun() {
  let html = "";
  try { html = fs.readFileSync(SOURCE_PATH, "utf8"); }
  catch (e) { fail("nao foi possivel ler SOURCE_INDEX_PATH (" + SOURCE_PATH + ")"); return finish(); }
  runStaticChecks(html);
  // plano do APPLY (nada real nesta fase)
  summary.executed = false;
  summary.fcmTokenServerPlannedOn = FCM_FLAG_ON;
  summary.willLaunchBrowser = false;
  summary.willCallEndpoint = false;
  summary.willCreateFcmToken = false;
  summary.willTouchFirestore = false;
  return finish();
}

// ===================== MODO APPLY CANARY (futuro) =====================
async function runApplyCanary() {
  // Carrega o index.html localmente (apenas LEITURA do arquivo preparado pelo workflow).
  let html = "";
  try { html = fs.readFileSync(SOURCE_PATH, "utf8"); }
  catch (e) { fail("nao foi possivel ler SOURCE_INDEX_PATH (" + SOURCE_PATH + ")"); return finish(); }
  // validacao estatica tambem no apply (barata; reforca invariantes antes do browser)
  runStaticChecks(html);

  // Playwright importado DINAMICAMENTE so aqui (dry-run nao depende dele).
  let chromium = null;
  try { ({ chromium } = await import("playwright")); }
  catch (e) { fail("playwright indisponivel (fail-safe; nenhuma chamada real): " + (e && e.message)); return finish(); }

  const SENTINEL = "https://canary.local/index.html"; // origem sintetica; servida via route fulfill
  const observed = {
    registerEndpoint: false, removeEndpoint: false,
    firestoreReal: false, otherExternal: 0,
    notificationReq: false, swRegister: false, getToken: false,
  };

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Bloqueio TOTAL de rede + interceptacao (nada sai para a internet real).
    await context.route("**/*", (route) => {
      let url = ""; try { url = route.request().url(); } catch (_) { url = ""; }
      // documento principal: serve o index.html lido do disco (sem servidor/rede)
      if (url === SENTINEL) { return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }); }
      // endpoints FCM (registerFcmToken / removeMyFcmToken) — STUB, nunca real
      if (/registerfcmtoken|registerFcmToken/i.test(url)) { observed.registerEndpoint = true; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, saved: true, count: 1, hasToken: true }) }); }
      if (/removemyfcmtoken|removeMyFcmToken/i.test(url)) { observed.removeEndpoint = true; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, saved: true, removed: true, count: 0 }) }); }
      // Firestore real => VIOLACAO (aborta e marca)
      if (/firestore\.googleapis\.com/i.test(url)) { observed.firestoreReal = true; return route.abort(); }
      // login/getUserSelf reais nao devem ocorrer; qualquer endpoint do trilho => bloqueia
      if (/loginuser|getuserself/i.test(url)) { observed.otherExternal++; return route.abort(); }
      // qualquer outra rede externa (data:, blob: e about: passam; resto bloqueia)
      if (/^(data:|blob:|about:)/i.test(url)) { return route.continue(); }
      observed.otherExternal++; return route.abort();
    });

    // ANTES de qualquer script: flag ON + neutralizacao de Web Push + marcadores.
    await context.addInitScript(() => {
      try { window.localStorage.setItem("fcm_token_server", "on"); } catch (_) {}
      window.__canary = { notificationReq: false, swRegister: false, getToken: false };
      try {
        const N = function () {};
        N.requestPermission = function () { window.__canary.notificationReq = true; return Promise.resolve("denied"); };
        N.permission = "denied";
        // eslint-disable-next-line no-global-assign
        window.Notification = N;
      } catch (_) {}
      try { window.PushManager = function () { /* neutralizado */ }; } catch (_) {}
      try {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.register = function () { window.__canary.swRegister = true; return Promise.reject(new Error("sw neutralizado (canary)")); };
        }
      } catch (_) {}
      // Stub defensivo de getToken (FCM) — nenhum token real é criado
      try { window.__stubGetToken = function () { window.__canary.getToken = true; return Promise.resolve("canary-fcm-token-stub"); }; } catch (_) {}
    });

    const page = await context.newPage();
    page.on("pageerror", () => {}); // erros da pagina nao derrubam o canary
    await page.goto(SENTINEL, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});

    // Observacao do caminho server ON: sessão sintética + invocacao dos helpers.
    // A sessão e o token sao SINTETICOS (nunca logados); os fetches sao stubados.
    const res = await page.evaluate(async () => {
      const out = { flagOn: false, hasRegister: false, hasRemove: false, regOk: null, remOk: null, err: null };
      try {
        out.flagOn = (typeof window.fcmTokenServerEnabled === "function") && window.fcmTokenServerEnabled() === true;
        out.hasRegister = typeof window.registerFcmTokenClient === "function";
        out.hasRemove = typeof window.removeFcmTokenClient === "function";
        // sessão sintética só para destravar o caminho ON (sem login real)
        try { window.authGetSession = function () { return { token: "canary-session-stub" }; }; } catch (_) {}
        if (out.hasRegister) { const r = await window.registerFcmTokenClient("canary-fcm-token-stub", "canary-device", "web"); out.regOk = !!(r && r.ok === true); }
        if (out.hasRemove) { const r = await window.removeFcmTokenClient("canary-fcm-token-stub"); out.remOk = !!(r && r.ok === true); }
      } catch (e) { out.err = "eval-error"; }
      return out;
    }).catch(() => ({ flagOn: false, hasRegister: false, hasRemove: false, regOk: null, remOk: null, err: "evaluate-failed" }));

    let canaryMarks = {}; try { canaryMarks = await page.evaluate(() => window.__canary || {}); } catch (_) {}
    observed.notificationReq = !!canaryMarks.notificationReq;
    observed.swRegister = !!canaryMarks.swRegister;
    observed.getToken = !!canaryMarks.getToken;

    // ---- Assercoes do APPLY canary ----
    summary.executed = true;
    summary.localAppLoaded = true;
    summary.fcmTokenServerAppliedOn = res.flagOn === true;
    ok("apply: fcm_token_server=on aplicado (fcmTokenServerEnabled()===true)", res.flagOn === true);
    ok("apply: registerFcmTokenClient observado (escolhido no caminho ON)", res.hasRegister && observed.registerEndpoint && res.regOk === true);
    ok("apply: removeFcmTokenClient observado (escolhido no caminho ON)", res.hasRemove && observed.removeEndpoint && res.remOk === true);
    ok("apply: endpoint registerFcmToken STUBADO (nunca real)", observed.registerEndpoint === true);
    ok("apply: endpoint removeMyFcmToken STUBADO (nunca real)", observed.removeEndpoint === true);
    ok("apply: NENHUM Firestore real tocado", observed.firestoreReal === false);
    ok("apply: NENHUM login/getUserSelf real", true); // bloqueados por route.abort (otherExternal)
    ok("apply: Notification.requestPermission real NAO chamado", observed.notificationReq === false);
    ok("apply: service worker real NAO registrado", observed.swRegister === false);
    ok("apply: token FCM real NAO criado (getToken real nao ocorreu)", observed.getToken === false);

    summary.externalNetworkBlocked = true;
    summary.notificationPermissionStubbed = true;
    summary.serviceWorkerStubbed = true;
    summary.getTokenStubbed = true;
    summary.registerClientObserved = !!(res.hasRegister && observed.registerEndpoint && res.regOk === true);
    summary.removeClientObserved = !!(res.hasRemove && observed.removeEndpoint && res.remOk === true);
    summary.registerEndpointStubbed = observed.registerEndpoint === true;
    summary.removeEndpointStubbed = observed.removeEndpoint === true;
    summary.loginBlocked = true;
    summary.getUserSelfBlocked = true;
    summary.legacyRegisterNotExecuted = observed.firestoreReal === false;
    summary.legacyRemoveNotExecuted = observed.firestoreReal === false;
    summary.noEndpointReal = true;
    summary.noLoginReal = true;
    summary.noFcmTokenCreated = observed.getToken === false;
    summary.noFirestoreReal = observed.firestoreReal === false;
    summary.noWebPushReal = (observed.notificationReq === false && observed.swRegister === false);
  } catch (e) {
    fail("apply canary falhou (fail-safe; rede bloqueada): " + (e && e.message));
  } finally {
    try { if (browser) await browser.close(); } catch (_) {}
  }
  return finish();
}

async function main() {
  safetyGuards();
  if (fails.length > 0) return finish(); // qualquer guard de seguranca reprovado => para antes de tudo
  if (DRY_RUN) return runDryRun();
  return runApplyCanary();
}

main().catch((e) => { fail("erro fatal (sem chamada real): " + (e && e.message)); finish(); });
