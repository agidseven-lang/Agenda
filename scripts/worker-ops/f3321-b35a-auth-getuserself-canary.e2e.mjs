#!/usr/bin/env node
/* =====================================================================
 * F3.3.21-B3.5A — CANARIO de getUserSelf (leitura AUTENTICADA do proprio usuario).
 * Runner endpoint-only (SEM UI/Playwright, SEM firebase-admin, SEM Firestore direto).
 * Dois modos, controlados por DRY_RUN:
 *
 *   DRY-RUN (DRY_RUN != "false", padrao): NENHUMA chamada externa. Apenas valida
 *     inputs/guards/canario/endpoint_url e descreve o PLANO. Nao chama loginUser,
 *     nao chama getUserSelf, nao toca Firestore, nao faz login, nao le segredo.
 *
 *   APPLY (DRY_RUN == "false"): chama loginUser com a credencial CANARIA para obter
 *     token de sessao (decodificado LOCAL; NUNCA impresso/salvo bruto) e entao
 *     getUserSelf com Authorization: Bearer <session>. Exige 200 + projecao SEGURA
 *     {id,name,role,admin,status,photo,color,reminderMinutes,hasFcmToken,fcmTokensCount}
 *     e ausencia de pass/salt/hash/fcmTokens/fcmTokenMeta/phone/email.
 *
 * Credenciais canarias via env (secrets): CANARY_UID, CANARY_IDENTIFIER, CANARY_PASSWORD.
 * NUNCA imprime senha/token bruto/Authorization/hash/salt. Web Push inexistente (node).
 * NAO toca usuario real (guard de UID canario). NAO faz deploy. NAO acessa valor de segredo.
 * Rodar (no runner): node scripts/worker-ops/f3321-b35a-auth-getuserself-canary.e2e.mjs
 * ===================================================================== */
import fs from "node:fs";

const DEFAULT_SELF_URL  = "https://us-central1-agenda-id-seven.cloudfunctions.net/getUserSelf";
const DEFAULT_LOGIN_URL = "https://us-central1-agenda-id-seven.cloudfunctions.net/loginUser";
const ORIGIN = "https://agenda-id-seven.web.app";

// DRY_RUN seguro por padrao: so e APPLY quando explicitamente "false".
const DRY_RUN   = String(process.env.DRY_RUN || "true").toLowerCase() !== "false";
const URL_SELF  = String(process.env.GETUSERSELF_URL || process.env.ENDPOINT_URL || DEFAULT_SELF_URL);
const URL_LOGIN = String(process.env.LOGINUSER_URL || DEFAULT_LOGIN_URL);
const RUN_ID    = String(process.env.GITHUB_RUN_ID || "local");
const OUT       = String(process.env.RETEST_OUT || "getuserself-canary-artifacts");

const CANARY_UID        = String(process.env.CANARY_UID || "");
const CANARY_IDENTIFIER = String(process.env.CANARY_IDENTIFIER || "");
const CANARY_PASSWORD   = String(process.env.CANARY_PASSWORD || "");

// Projecao SEGURA permitida (allowlist) e campos PROIBIDOS (checados como chaves JSON).
const ALLOWED_SELF_KEYS = ["id", "name", "role", "admin", "status", "photo", "color", "reminderMinutes", "hasFcmToken", "fcmTokensCount"];
const FORBIDDEN_FIELDS  = ["pass", "salt", "hash", "fcmTokens", "fcmTokenMeta", "phone", "email"];

const log  = (m) => console.log("[f3321-b35a] " + m);
const mask = (s) => { if (s) console.log("::add-mask::" + String(s)); };
const fails = [];
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };

// Mascara a senha canaria imediatamente (defesa extra alem do mascaramento de secrets do Actions).
if (CANARY_PASSWORD) mask(CANARY_PASSWORD);

// Guard: o UID precisa "parecer" canario (contem 'canary', sem '@', tamanho minimo) — bloqueia usuario real.
const looksCanary = (uid) => /canary/i.test(uid) && uid.length >= 6 && uid.indexOf("@") < 0;

// Checa ausencia de um campo PROIBIDO como CHAVE JSON ("campo":), preservando hasFcmToken/fcmTokensCount.
const fieldAbsent = (respStr, field) => !(new RegExp('"' + field + '"\\s*:')).test(respStr);

const summary = {
  phase: "F3.3.21-B3.5A-GETUSERSELF-CANARY-RETEST",
  target: "getUserSelf",
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

(async () => {
  // ===== Validacoes COMUNS (dry-run e apply): inputs, guard canario, URLs https =====
  ok("CANARY_UID presente", !!CANARY_UID);
  ok("CANARY_IDENTIFIER presente", !!CANARY_IDENTIFIER);
  ok("CANARY_PASSWORD presente", !!CANARY_PASSWORD);
  const canaryGuard = looksCanary(CANARY_UID);
  ok("CANARY_UID parece canario (bloqueia usuario real)", canaryGuard);
  ok("endpoint_url (getUserSelf) https", URL_SELF.startsWith("https://"));
  ok("login_url https", URL_LOGIN.startsWith("https://"));
  summary.canaryGuardSelfTest = canaryGuard;
  summary.endpointUrlDefault = (URL_SELF === DEFAULT_SELF_URL);

  if (DRY_RUN) {
    // ===== MODO DRY-RUN: NENHUMA chamada externa, nenhum login, nenhum endpoint =====
    summary.executed = false;
    summary.willCallLoginUser = false;
    summary.willCallGetUserSelf = false;
    summary.noEndpoint = true;
    summary.noLogin = true;
    summary.plan = {
      step1: "POST loginUser {identifier: CANARY_IDENTIFIER, password: <masked>} => esperado 200 + session.token",
      step2: "decodificar claims LOCAL (nunca impresso): uid == CANARY_UID, scope == session",
      step3: "GET getUserSelf com Authorization: Bearer <session> => esperado 200 + uid == CANARY_UID",
      step4: "validar projecao allowlist e ausencia dos campos proibidos",
      allowedKeys: ALLOWED_SELF_KEYS,
      forbiddenFields: FORBIDDEN_FIELDS,
    };
    log("DRY-RUN: plano validado. Sem chamada externa, sem login, sem endpoint, sem Firestore, sem segredo, sem Web Push.");
    return finish();
  }

  // ===== MODO APPLY (futuro): loginUser canario -> getUserSelf com Bearer =====
  summary.executed = true;

  // 1) login canario via loginUser (senha canaria; NUNCA impressa)
  const rLogin = await http(URL_LOGIN, "POST", { identifier: CANARY_IDENTIFIER, password: CANARY_PASSWORD }, null);
  summary.loginUserRequestSeen = true;
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

  // 2) getUserSelf com Bearer da sessao canaria
  const rSelf = await http(URL_SELF, "GET", undefined, AUTH);
  summary.getUserSelfRequestSeen = true;
  summary.getUserSelfStatus = rSelf.status;
  const self = (rSelf.json && rSelf.json.self) ? rSelf.json.self : {};
  ok("getUserSelf => 200 + ok + uid canario", rSelf.status === 200 && rSelf.json && rSelf.json.ok === true && rSelf.json.uid === CANARY_UID);
  const selfUidMatchesCanary = !!(rSelf.json && rSelf.json.uid === CANARY_UID) && (claims.uid === CANARY_UID);
  summary.selfUidMatchesCanary = selfUidMatchesCanary;
  ok("selfUidMatchesCanary", selfUidMatchesCanary);

  // 3) projecao SEGURA (allowlist) + ausencia de campos proibidos + sem token na resposta
  const respStr = JSON.stringify(rSelf.json || {});
  const keys = Object.keys(self).sort();
  const onlyAllowed = keys.every((k) => ALLOWED_SELF_KEYS.indexOf(k) >= 0);
  ok("self contem SO chaves da allowlist", onlyAllowed);
  if (Object.prototype.hasOwnProperty.call(self, "hasFcmToken")) ok("hasFcmToken e boolean", typeof self.hasFcmToken === "boolean");
  if (Object.prototype.hasOwnProperty.call(self, "fcmTokensCount")) ok("fcmTokensCount e number", typeof self.fcmTokensCount === "number");

  const passAbsent        = respStr.indexOf("s2:") < 0 && fieldAbsent(respStr, "pass");
  const saltAbsent        = fieldAbsent(respStr, "salt");
  const hashAbsent        = fieldAbsent(respStr, "hash");
  const fcmTokensAbsent   = fieldAbsent(respStr, "fcmTokens");      // nao casa fcmTokensCount/hasFcmToken
  const fcmTokenMetaAbsent = fieldAbsent(respStr, "fcmTokenMeta");
  const phoneAbsent       = fieldAbsent(respStr, "phone");
  const emailAbsent       = fieldAbsent(respStr, "email");
  const tokenAbsent       = respStr.indexOf("Bearer") < 0 && (!token || respStr.indexOf(token) < 0);

  ok("sem pass/s2:", passAbsent);
  ok("sem salt", saltAbsent);
  ok("sem hash", hashAbsent);
  ok("sem fcmTokens (array)", fcmTokensAbsent);
  ok("sem fcmTokenMeta", fcmTokenMetaAbsent);
  ok("sem phone", phoneAbsent);
  ok("sem email", emailAbsent);
  ok("sem token/Bearer na resposta", tokenAbsent);

  const forbiddenFieldsAbsent = passAbsent && saltAbsent && hashAbsent && fcmTokensAbsent && fcmTokenMetaAbsent && phoneAbsent && emailAbsent;
  summary.getUserSelfResponseSafe = onlyAllowed && forbiddenFieldsAbsent && tokenAbsent;
  summary.forbiddenFieldsAbsent = forbiddenFieldsAbsent;
  summary.passAbsent = passAbsent;
  summary.saltAbsent = saltAbsent;
  summary.hashAbsent = hashAbsent;
  summary.fcmTokensAbsent = fcmTokensAbsent;
  summary.fcmTokenMetaAbsent = fcmTokenMetaAbsent;
  summary.phoneAbsent = phoneAbsent;
  summary.emailAbsent = emailAbsent;
  summary.selfKeys = keys;

  finish();
})().catch((e) => { fail("ERRO HARNESS: " + (e && e.message)); finish(); });

function finish() {
  summary.go = fails.length === 0;
  summary.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  // Summary sanitizado: NUNCA contem token/senha/hash/salt — so flags e chaves seguras.
  try { fs.writeFileSync(OUT + "/summary.json", JSON.stringify(summary, null, 2)); } catch (_) {}
  console.log("\n========= F3.3.21-B3.5A — getUserSelf canary (" + (DRY_RUN ? "DRY-RUN" : "APPLY") + ") =========");
  if (DRY_RUN) {
    console.log("  plano validado · sem chamada externa · sem login · sem endpoint · sem Firestore · sem segredo");
  } else {
    console.log("  loginUser canario · token scope=session (mascarado) · getUserSelf 200 · projecao allowlist segura");
  }
  console.log("=================================================================");
  console.log("f3321-b35a getUserSelf canary: " + (summary.go ? "GO" : ("NO-GO (" + fails.length + " falhas)")));
  if (!summary.go) { console.log(fails.join("\n")); process.exit(1); }
  process.exit(0);
}
