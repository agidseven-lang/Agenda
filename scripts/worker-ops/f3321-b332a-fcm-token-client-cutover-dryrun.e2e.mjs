#!/usr/bin/env node
/* =====================================================================
 * F3.3.21-B3.32A — DRY-RUN do client cutover FCM (fcm_token_server).
 * Valida, em modo SEGURO (sem navegador real, sem rede, sem firebase, sem endpoint,
 * sem Web Push, sem Firestore), que o cutover ja mergeado em app/main:index.html esta
 * estruturalmente correto para operar com fcm_token_server=on.
 *
 * Entrada: SOURCE_INDEX_PATH = caminho de um arquivo com o index.html de SOURCE_REF
 * (app/main), preparado pelo workflow via `git show origin/app/main:index.html`
 * (read-only; SEM publicar Hosting). Este runner NUNCA carrega o app de verdade.
 *
 * CAMADA 1 — analise estatica: sintaxe JS inline + estrutura do if(fcmTokenServerEnabled())
 *   nos call sites de registro/remocao (server ON chama os helpers; legacy tx.get/tx.set/
 *   arrayRemove ficam no else; sem getUserSelf/loginUser/Firestore client no ramo ON;
 *   sem fallback silencioso; flag OFF por padrao; sem logs de token).
 * CAMADA 2 — micro-simulacao SEGURA (node:vm): avalia SO o helper fcmTokenServerEnabled()
 *   num sandbox com lsGet stub + fetch/Notification/PushManager/serviceWorker que LANCAM se
 *   usados (prova bloqueio). Confirma on=>true, off=>false. NAO avalia o app inteiro.
 *   A simulacao de NAVEGADOR REAL (Playwright) e adiada (dynamicSimulationSkipped=true).
 *
 * dry-run ONLY: DRY_RUN != "true" => recusa (exit 1). NUNCA imprime token/sessao/senha/
 * hash/salt. NAO chama endpoint, NAO faz login, NAO cria token FCM, NAO toca Firestore,
 * NAO ativa Web Push, NAO faz deploy.
 * Rodar: node scripts/worker-ops/f3321-b332a-fcm-token-client-cutover-dryrun.e2e.mjs
 * ===================================================================== */
import fs from "node:fs";
import vm from "node:vm";

const DRY_RUN        = String(process.env.DRY_RUN || "true").toLowerCase() === "true";
const SOURCE_REF     = String(process.env.SOURCE_REF || "app/main");
const SOURCE_PATH    = String(process.env.SOURCE_INDEX_PATH || "");
const FCM_FLAG_SIM   = String(process.env.FCM_TOKEN_SERVER || "true").toLowerCase() === "true";
const ENDPOINT_BLOCK = String(process.env.ENDPOINT_CALLS_BLOCKED || "true").toLowerCase() === "true";
const WEBPUSH_NEUTRAL= String(process.env.WEB_PUSH_NEUTRALIZED || "true").toLowerCase() === "true";
const OUT            = String(process.env.RETEST_OUT || "fcm-client-cutover-dryrun-artifacts");

const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const log  = (m) => console.log("[f3321-b332a] " + m);

const summary = {
  phase: "F3.3.21-B3.32A-FCM-TOKEN-CLIENT-CUTOVER-DRYRUN",
  target: "fcmTokenClientCutover",
  sourceRef: SOURCE_REF,
  dryRun: true,
  executed: false,
  fcmTokenServerSimulatedOn: FCM_FLAG_SIM,
  // segurança (por construção deste runner; nada real é chamado)
  noEndpoint: true, noLogin: true, noFcmTokenCreated: true, noFirestore: true,
  noRealUser: true, noSecretPrinted: true, noWebPush: true, noDeploy: true,
  endpointCallsBlocked: ENDPOINT_BLOCK, webPushNeutralized: WEBPUSH_NEUTRAL, firestoreBlocked: true, loginBlocked: true,
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
// Brace-match: extrai a declaracao COMPLETA de `function <name>(...){...}`. Usa o mesmo
// balanceamento de chaves de extractIfElse, suportando try/catch aninhado. NAO usar regex
// nao-greedy (/function ...\{[\s\S]*?\}/), que pararia no 1o `}` (fechamento do try) e
// truncaria o helper antes do catch -> "Missing catch or finally after try" no node:vm.
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
  console.log("\n========= F3.3.21-B3.32A — FCM client cutover DRY-RUN =========");
  console.log("  sourceRef=" + SOURCE_REF + " · staticValidationPassed=" + summary.staticValidationPassed +
              " · dynamicMicroSim=" + (summary.dynamicSimulationPassed === true ? "pass" : String(summary.dynamicSimulationPassed)) +
              " · fullBrowserSimSkipped=" + summary.dynamicSimulationSkipped);
  console.log("  noEndpoint=" + summary.noEndpoint + " noLogin=" + summary.noLogin + " noFcmTokenCreated=" + summary.noFcmTokenCreated +
              " noFirestore=" + summary.noFirestore + " noWebPush=" + summary.noWebPush + " noDeploy=" + summary.noDeploy);
  console.log("=================================================================");
  console.log("f3321-b332a FCM client cutover dry-run: " + (summary.go ? "GO" : ("NO-GO (" + fails.length + " falhas)")));
  process.exit(summary.go ? 0 : 1);
}

function main() {
  // dry-run only nesta fase
  if (!DRY_RUN) { console.log("ERRO: este runner e dry-run only nesta fase (DRY_RUN!=true)."); process.exit(1); }

  // ---- carrega o index.html de app/main (preparado pelo workflow; read-only) ----
  let html = "";
  try { html = fs.readFileSync(SOURCE_PATH, "utf8"); }
  catch (e) { fail("nao foi possivel ler SOURCE_INDEX_PATH (" + SOURCE_PATH + ")"); return finish(); }
  ok("index.html de " + SOURCE_REF + " carregado (bytes>0)", html.length > 0);

  // ===================== CAMADA 1 — ANALISE ESTATICA =====================
  const blocks = inlineScripts(html);
  let syntaxErrors = 0;
  blocks.forEach((code, idx) => { try { new vm.Script(code, { filename: "inline#" + (idx + 1) }); } catch (e) { syntaxErrors++; log("syntax erro bloco#" + (idx + 1) + ": " + e.message); } });
  ok("sintaxe JS inline sem erros", syntaxErrors === 0);
  summary.inlineScriptBlocks = blocks.length;

  // presença de helpers + flag
  ok("registerFcmTokenClient existe", /async function registerFcmTokenClient\s*\(/.test(html));
  ok("removeFcmTokenClient existe", /async function removeFcmTokenClient\s*\(/.test(html));
  ok("fcmTokenServerEnabled existe", /function fcmTokenServerEnabled\s*\(/.test(html));
  const flagOff = /function fcmTokenServerEnabled\(\)\{\s*try\{\s*return lsGet\("fcm_token_server"\)==="on";\s*\}catch\(_\)\{\s*return false;\s*\}\s*\}/.test(html);
  ok("fcm_token_server OFF por padrao (catch=>false)", flagOff);
  summary.registerClientFound = /async function registerFcmTokenClient\s*\(/.test(html);
  summary.removeClientFound = /async function removeFcmTokenClient\s*\(/.test(html);
  summary.flagOffByDefault = flagOff;

  // localiza os 2 call sites: if(fcmTokenServerEnabled()){  (sem '!')
  const sites = [];
  const reSite = /if\(fcmTokenServerEnabled\(\)\)\{/g; let sm;
  while ((sm = reSite.exec(html))) sites.push(sm.index);
  ok("exatamente 2 call sites if(fcmTokenServerEnabled()){ (registro+remocao)", sites.length === 2);

  let registerSite = null, teardownSite = null;
  sites.forEach((idx) => {
    const ie = extractIfElse(html, idx); if (!ie) return;
    if (/registerFcmTokenClient\s*\(/.test(ie.trueBlock)) registerSite = ie;
    if (/removeFcmTokenClient\s*\(/.test(ie.trueBlock)) teardownSite = ie;
  });

  // ---- REGISTRO ----
  if (ok("call site de REGISTRO encontrado", !!registerSite)) {
    const t = registerSite.trueBlock, e = registerSite.elseBlock;
    ok("registro: registerFcmTokenClient no ramo server ON", /registerFcmTokenClient\s*\(/.test(t));
    ok("registro: ramo ON SEM tx.get", !/tx\.get\s*\(/.test(t));
    ok("registro: ramo ON SEM tx.set", !/tx\.set\s*\(/.test(t));
    ok("registro: ramo ON SEM runTransaction", !/runTransaction\s*\(/.test(t));
    ok("registro: ramo ON SEM getUserSelf", !/getUserSelf/.test(t));
    ok("registro: ramo ON SEM loginUser", !/loginUser/.test(t));
    ok("registro: ramo ON SEM collection(users)", !/collection\(\s*["']users["']\s*\)/.test(t));
    ok("registro: ramo ON tem return false (sem fallback silencioso p/ legacy)", /return false\s*;/.test(t));
    ok("registro: legacy tx.get/tx.set no ELSE", /tx\.get\s*\(/.test(e) && /tx\.set\s*\(/.test(e));
    summary.registerClientBehindFlag = /registerFcmTokenClient\s*\(/.test(t);
    summary.legacyRegisterPreserved = /tx\.get\s*\(/.test(e) && /tx\.set\s*\(/.test(e);
    summary.registerServerPathNoFirestoreClient = !/tx\.(get|set)\s*\(/.test(t) && !/collection\(\s*["']users["']\s*\)/.test(t);
    summary.registerNoSilentFallback = /return false\s*;/.test(t);
  }
  // ---- REMOCAO ----
  if (ok("call site de REMOCAO encontrado", !!teardownSite)) {
    const t = teardownSite.trueBlock, e = teardownSite.elseBlock;
    ok("remocao: removeFcmTokenClient no ramo server ON", /removeFcmTokenClient\s*\(/.test(t));
    ok("remocao: ramo ON SEM arrayRemove", !/arrayRemove/.test(t));
    ok("remocao: ramo ON SEM update(", !/\.update\s*\(/.test(t));
    ok("remocao: ramo ON SEM collection(users)", !/collection\(\s*["']users["']\s*\)/.test(t));
    ok("remocao: legacy arrayRemove no ELSE", /arrayRemove/.test(e));
    summary.removeClientBehindFlag = /removeFcmTokenClient\s*\(/.test(t);
    summary.legacyRemovePreserved = /arrayRemove/.test(e);
    summary.removeServerPathNoFirestoreClient = !/arrayRemove/.test(t) && !/\.update\s*\(/.test(t) && !/collection\(\s*["']users["']\s*\)/.test(t);
  }
  summary.serverPathNoFirestoreClient = !!(summary.registerServerPathNoFirestoreClient && summary.removeServerPathNoFirestoreClient);
  summary.noSilentLegacyFallback = !!summary.registerNoSilentFallback;

  // logs de token: os ramos ON nao podem logar o token cru (so status/err/count permitidos)
  const cutoverLogsLeakToken =
    (registerSite && /console\.log[\s\S]{0,80}(\btoken\b|fcmToken|syntheticFcmToken)/.test(registerSite.trueBlock)) ||
    (teardownSite && /console\.log[\s\S]{0,80}(fcmTokenSaved|\btoken\b)/.test(teardownSite.trueBlock));
  ok("sem console.log de token nos ramos do cutover", !cutoverLogsLeakToken);
  summary.noTokenLogs = !cutoverLogsLeakToken;
  summary.staticValidationPassed = fails.length === 0;

  // ===================== CAMADA 2 — MICRO-SIM SEGURA (vm) =====================
  // Avalia SO o helper fcmTokenServerEnabled() num sandbox com lsGet stub e
  // fetch/Notification/PushManager/serviceWorker que LANCAM se usados (prova bloqueio).
  summary.dynamicSimulationAttempted = true;
  let microOn = null, microOff = null, sandboxTouchedNetwork = false;
  try {
    const fnSrc = extractNamedFunction(html, "fcmTokenServerEnabled");
    if (!fnSrc) throw new Error("helper nao extraido");
    const guard = () => { sandboxTouchedNetwork = true; throw new Error("BLOQUEADO: chamada real proibida no dry-run"); };
    const evalHelper = (flagVal) => {
      const sandbox = {
        lsGet: (k) => (k === "fcm_token_server" ? flagVal : null),
        fetch: guard,
        Notification: { requestPermission: guard, permission: "denied" },
        PushManager: function () { guard(); },
        navigator: { serviceWorker: { register: guard } },
        console: { log() {}, warn() {}, error() {} },
      };
      vm.createContext(sandbox);
      vm.runInContext(fnSrc + "\n; globalThis.__r = fcmTokenServerEnabled();", sandbox, { timeout: 1000 });
      return sandbox.__r === true;
    };
    microOn = evalHelper("on");      // esperado: true
    microOff = evalHelper("off");    // esperado: false
    ok("micro-sim: flag 'on' => server path (true)", microOn === true);
    ok("micro-sim: flag 'off' => legacy path (false)", microOff === false);
    ok("micro-sim: nenhuma chamada real (fetch/Notification/SW) ocorreu", sandboxTouchedNetwork === false);
    summary.dynamicSimulationPassed = (microOn === true && microOff === false && sandboxTouchedNetwork === false);
  } catch (e) {
    summary.dynamicSimulationPassed = false;
    fail("micro-sim falhou: " + (e && e.message));
  }
  // Simulacao de NAVEGADOR REAL (Playwright, carregando o app) e adiada por seguranca
  // (exigiria firebase/getToken/SW reais). GO se apoia na analise estatica forte + micro-sim.
  summary.dynamicSimulationSkipped = true;
  summary.dynamicSimulationNote = "vm micro-sim do helper+estrutura (sem navegador/firebase/rede); full Playwright browser sim adiada p/ fase dedicada (evita Web Push/endpoint/Firestore reais).";

  return finish();
}

main();
