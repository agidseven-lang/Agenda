#!/usr/bin/env node
/* =====================================================================
 * F3.3.21-B3.28A — CANARIO dos endpoints FCM (registerFcmToken / removeMyFcmToken).
 * Runner endpoint-only (SEM UI/Playwright, SEM firebase-admin, SEM Firestore direto).
 * Dois modos, controlados por DRY_RUN:
 *
 *   DRY-RUN (DRY_RUN != "false", padrao): NENHUMA chamada externa. Apenas valida
 *     inputs/guards/canario/URLs e descreve o PLANO. NAO chama loginUser, NAO chama
 *     registerFcmToken, NAO chama removeMyFcmToken, NAO cria token FCM sintetico,
 *     NAO toca Firestore, NAO faz login, NAO le segredo.
 *
 *   APPLY (DRY_RUN == "false"): emite sessao CANARIA via loginUser (200), cria UM token
 *     FCM SINTETICO controlado (prefixo canario; NUNCA impresso), chama registerFcmToken
 *     com Authorization: Bearer <session> e entao removeMyFcmToken com o MESMO token.
 *     Exige 200 em ambos + respostas SEGURAS (sem fcmTokens/fcmTokenMeta; sem token na
 *     resposta). Se register passar e remove falhar => cleanupIncomplete=true (cleanup
 *     dedicado em fase futura; este runner NAO executa cleanup extra).
 *
 * Credenciais canarias via env (secrets): CANARY_UID, CANARY_IDENTIFIER, CANARY_PASSWORD.
 * NUNCA imprime senha/token de sessao/token FCM/Authorization/hash/salt. Web Push
 * inexistente (node). NAO toca usuario real (guard de UID canario). NAO faz deploy.
 * NAO acessa valor de segredo. O token FCM sintetico NUNCA e um token real de dispositivo.
 * Rodar (no runner): node scripts/worker-ops/f3321-b328a-auth-fcm-token-endpoint-canary.e2e.mjs
 * ===================================================================== */
import fs from "node:fs";

const DEFAULT_REGISTER_URL = "https://us-central1-agenda-id-seven.cloudfunctions.net/registerFcmToken";
const DEFAULT_REMOVE_URL   = "https://us-central1-agenda-id-seven.cloudfunctions.net/removeMyFcmToken";
const DEFAULT_LOGIN_URL    = "https://us-central1-agenda-id-seven.cloudfunctions.net/loginUser";
const ORIGIN = "https://agenda-id-seven.web.app";

// DRY_RUN seguro por padrao: so e APPLY quando explicitamente "false".
const DRY_RUN     = String(process.env.DRY_RUN || "true").toLowerCase() !== "false";
const URL_REGISTER = String(process.env.REGISTER_FCM_URL || process.env.REGISTER_ENDPOINT_URL || DEFAULT_REGISTER_URL);
const URL_REMOVE   = String(process.env.REMOVE_FCM_URL   || process.env.REMOVE_ENDPOINT_URL   || DEFAULT_REMOVE_URL);
const URL_LOGIN    = String(process.env.LOGINUSER_URL || DEFAULT_LOGIN_URL);
const RUN_ID      = String(process.env.GITHUB_RUN_ID || "local");
const OUT         = String(process.env.RETEST_OUT || "fcm-token-endpoint-canary-artifacts");

const CANARY_UID        = String(process.env.CANARY_UID || "");
const CANARY_IDENTIFIER = String(process.env.CANARY_IDENTIFIER || "");
const CANARY_PASSWORD   = String(process.env.CANARY_PASSWORD || "");

// Campos PROIBIDOS na resposta (checados como chave JSON "campo":). hasFcmToken/fcmTokensCount sao seguros.
const FORBIDDEN_FIELDS = ["fcmTokens", "fcmTokenMeta", "pass", "salt", "hash", "phone", "email"];

const log  = (m) => console.log("[f3321-b328a] " + m);
const mask = (s) => { if (s) console.log("::add-mask::" + String(s)); };
const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };

// Mascara a senha canaria imediatamente (defesa extra alem do mascaramento de secrets do Actions).
if (CANARY_PASSWORD) mask(CANARY_PASSWORD);

// Guard: o UID precisa "parecer" canario (contem 'canary', sem '@', tamanho minimo) — bloqueia usuario real.
const looksCanary = (uid) => /canary/i.test(uid) && uid.length >= 6 && uid.indexOf("@") < 0;
// uid mascarado p/ compor o token sintetico sem vazar o uid inteiro.
const maskUid = (uid) => (uid && uid.length >= 3) ? (uid.slice(0, 3) + "x" + (uid.length)) : "uid";
// Ausencia de um campo PROIBIDO como CHAVE JSON ("campo":), preservando hasFcmToken/fcmTokensCount.
const fieldAbsent = (respStr, field) => !(new RegExp('"' + field + '"\\s*:')).test(respStr);

const summary = {
  phase: "F3.3.21-B3.28A-FCM-TOKEN-ENDPOINT-CANARY-RETEST",
  target: "fcmTokenEndpoints",
  runId: RUN_ID,
  dryRun: DRY_RUN,
  executed: false,
  noFirestore: true,   // este runner NUNCA toca Firestore (sem firebase-admin)
  noRealUser: true,    // so usa CANARY_* + guard de UID canario
  noSecretPrinted: true,
  noWebPush: true,     // node puro; sem PushManager/Notification
  noDeploy: true,
};

async function http(url, method, body, authHeader) {
  const headers = { "Origin": ORIGIN };
  if (authHeader) headers["Authorization"] = authHeader;
  const opt = { method, headers };
  if (body !== undefined) { headers["Content-Type"] = "application/json"; opt.body = (typeof body === "string" ? body : JSON.stringify(body)); }
  const res = await fetch(url, opt);
  let json = null; const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  return { status: res.status, json };
}

// Resposta SEGURA: ok===true, sem campos proibidos como chave, e sem o token FCM ecoado.
function responseSafe(respJson, syntheticToken) {
  const respStr = JSON.stringify(respJson || {});
  const forbiddenAbsent = FORBIDDEN_FIELDS.every((f) => fieldAbsent(respStr, f));
  const tokenAbsent = !syntheticToken || respStr.indexOf(syntheticToken) < 0;
  const bearerAbsent = respStr.indexOf("Bearer") < 0;
  return { safe: forbiddenAbsent && tokenAbsent && bearerAbsent, forbiddenAbsent, tokenAbsent };
}

(async () => {
  // ===== Validacoes COMUNS (dry-run e apply): inputs, guard canario, URLs https =====
  ok("CANARY_UID presente", !!CANARY_UID);
  ok("CANARY_IDENTIFIER presente", !!CANARY_IDENTIFIER);
  ok("CANARY_PASSWORD presente", !!CANARY_PASSWORD);
  const canaryGuard = looksCanary(CANARY_UID);
  ok("CANARY_UID parece canario (bloqueia usuario real)", canaryGuard);
  ok("register_endpoint_url https", URL_REGISTER.startsWith("https://"));
  ok("remove_endpoint_url https", URL_REMOVE.startsWith("https://"));
  ok("login_url https", URL_LOGIN.startsWith("https://"));
  summary.canaryGuardSelfTest = canaryGuard;
  summary.registerEndpointUrlDefault = (URL_REGISTER === DEFAULT_REGISTER_URL);
  summary.removeEndpointUrlDefault = (URL_REMOVE === DEFAULT_REMOVE_URL);

  if (DRY_RUN) {
    // ===== MODO DRY-RUN: NENHUMA chamada externa, nenhum login, nenhum endpoint, nenhum token =====
    summary.executed = false;
    summary.willCallLoginUser = false;
    summary.willCallRegisterFcmToken = false;
    summary.willCallRemoveMyFcmToken = false;
    summary.willCreateSyntheticFcmToken = false;
    summary.noEndpoint = true;
    summary.noLogin = true;
    summary.plan = {
      step1: "POST loginUser {identifier: CANARY_IDENTIFIER, password: <masked>} => 200 + session.token",
      step2: "criar token FCM SINTETICO canario (prefixo fcm-canary-...; mascarado; nunca real)",
      step3: "POST registerFcmToken (Bearer <session>) {token:<synthetic>, deviceId:'canary-fcm-endpoint-retest', platform:'web-canary'} => 200 + resposta segura",
      step4: "POST removeMyFcmToken (Bearer <session>) {token:<synthetic>} => 200 + resposta segura",
      step5: "validar ausencia de fcmTokens/fcmTokenMeta na resposta; tokenMasked; cleanup do token sintetico no mesmo APPLY",
      forbiddenFields: FORBIDDEN_FIELDS,
    };
    log("DRY-RUN: plano validado. Sem chamada externa, sem login, sem endpoint, sem token FCM, sem Firestore, sem segredo, sem Web Push.");
    return finish();
  }

  // ===== MODO APPLY (futuro): loginUser canario -> registerFcmToken -> removeMyFcmToken =====
  summary.executed = true;

  // 1) login canario via loginUser (senha canaria; NUNCA impressa)
  const rLogin = await http(URL_LOGIN, "POST", { identifier: CANARY_IDENTIFIER, password: CANARY_PASSWORD }, null);
  summary.loginUserStatus = rLogin.status;
  const token = (rLogin.json && rLogin.json.session && typeof rLogin.json.session.token === "string") ? rLogin.json.session.token : "";
  if (token) mask(token);
  summary.sessionTokenReceived = !!token;
  summary.serverSessionTokenMasked = true;
  ok("loginUser => 200 + token", rLogin.status === 200 && rLogin.json && rLogin.json.ok === true && !!token);

  // claims decodificados LOCAL (token bruto nunca salvo/impresso)
  let claims = {};
  try { claims = JSON.parse(Buffer.from(String(token).split(".")[0] || "", "base64url").toString("utf8")); } catch (_) { claims = {}; }
  ok("token uid == canario", claims.uid === CANARY_UID);
  ok("token scope == session", claims.scope === "session");
  const AUTH = token ? ("Bearer " + token) : "";

  // 2) token FCM SINTETICO controlado (NUNCA um token real de dispositivo; mascarado de imediato)
  const syntheticFcmToken = "fcm-canary-" + maskUid(CANARY_UID) + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 12);
  mask(syntheticFcmToken);
  summary.syntheticFcmTokenCreated = true;
  summary.syntheticFcmTokenMasked = true;

  // 3) registerFcmToken (Bearer da sessao canaria; token sintetico)
  const rReg = await http(URL_REGISTER, "POST", { token: syntheticFcmToken, deviceId: "canary-fcm-endpoint-retest", platform: "web-canary" }, AUTH);
  summary.registerRequestSeen = true;
  summary.registerStatus = rReg.status;
  const regSafe = responseSafe(rReg.json, syntheticFcmToken);
  summary.registerResponseSafe = regSafe.safe;
  summary.registerTokenMasked = !!(rReg.json && rReg.json.tokenMasked === true);
  const registerOk = rReg.status === 200 && rReg.json && rReg.json.ok === true && rReg.json.saved === true;
  ok("registerFcmToken => 200 + ok + saved", registerOk);
  ok("registerFcmToken resposta segura (sem fcmTokens/fcmTokenMeta/token)", regSafe.safe);
  ok("registerFcmToken tokenMasked=true", summary.registerTokenMasked);

  // 4) removeMyFcmToken (Bearer; MESMO token sintetico) — limpa o token sintetico no mesmo APPLY
  const rRem = await http(URL_REMOVE, "POST", { token: syntheticFcmToken }, AUTH);
  summary.removeRequestSeen = true;
  summary.removeStatus = rRem.status;
  const remSafe = responseSafe(rRem.json, syntheticFcmToken);
  summary.removeResponseSafe = remSafe.safe;
  const removeOk = rRem.status === 200 && rRem.json && rRem.json.ok === true && rRem.json.saved === true;
  ok("removeMyFcmToken => 200 + ok + saved", removeOk);
  ok("removeMyFcmToken resposta segura (sem fcmTokens/fcmTokenMeta/token)", remSafe.safe);

  // cleanup do token sintetico: register OK + remove FALHOU => cleanupIncomplete (fase dedicada futura)
  summary.cleanupIncomplete = (registerOk && !removeOk);
  if (summary.cleanupIncomplete) log("ATENCAO: register OK mas remove falhou => cleanupIncomplete=true (cleanup dedicado em fase futura).");

  // ausencia agregada de campos sensiveis nas DUAS respostas
  const bothStr = JSON.stringify(rReg.json || {}) + JSON.stringify(rRem.json || {});
  summary.fcmTokensAbsent = fieldAbsent(bothStr, "fcmTokens");
  summary.fcmTokenMetaAbsent = fieldAbsent(bothStr, "fcmTokenMeta");
  ok("sem fcmTokens nas respostas", summary.fcmTokensAbsent);
  ok("sem fcmTokenMeta nas respostas", summary.fcmTokenMetaAbsent);

  finish();
})().catch((e) => { fail("ERRO HARNESS: " + (e && e.message)); finish(); });

function finish() {
  summary.go = fails.length === 0;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  // Summary sanitizado: NUNCA contem token/senha/hash/salt/token FCM — so flags e contadores seguros.
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n========= F3.3.21-B3.28A — FCM token endpoints canary (" + (DRY_RUN ? "DRY-RUN" : "APPLY") + ") =========");
  if (DRY_RUN) {
    console.log("  plano validado · sem chamada externa · sem login · sem endpoint · sem token FCM · sem Firestore · sem segredo");
  } else {
    console.log("  loginUser canario · token FCM sintetico (mascarado) · registerFcmToken 200 · removeMyFcmToken 200 · respostas seguras");
  }
  console.log("=================================================================");
  console.log("f3321-b328a FCM token endpoints canary: " + (summary.go ? "GO" : ("NO-GO (" + fails.length + " falhas)")));
  if (!summary.go) { console.log(fails.join("\n")); process.exit(1); }
  process.exit(0);
}
