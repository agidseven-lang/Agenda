#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — CANARIO de getUserContact (leitura autenticada de contato).
 * Valida a Function HTTPS getUserContact JA PUBLICADA (endpoint-only; SEM UI/Playwright),
 * usando loginUser para emitir um token real de sessao. Prova, com egress do runner:
 *   - probes HTTP seguros: OPTIONS 204 / PUT 405 / GET sem token 401 / POST sem token 401;
 *   - re-seed EFEMERO somente do canario (pass/salt/updatedAt/reseedFor/reseedRunId);
 *   - login canario via loginUser => 200 + token scope=session (decodificado LOCAL;
 *     NUNCA impresso/salvo bruto);
 *   - getUserContact self => 200 com contact{phone,email}; other (nao-admin) => 403;
 *     token invalido => 401 invalid_session;
 *   - projecao SEGURA: contact SO {phone,email}; sem pass/salt/fcmTokens/fcmTokenMeta/
 *     admin/role/status/photo/color/doc cru;
 *   - leitura final read-only SO do canario.
 * Firestore: UNICO write direto = re-seed da SENHA do canario. NAO toca notifPrefs,
 * NAO toca usuario real, NAO le a colecao inteira. Web Push BLOQUEADO. NUNCA imprime
 * senha/pass/salt/token bruto/Authorization. URLs via env (LOGINUSER_URL/GETUSERCONTACT_URL).
 * Rodar (no runner): node scripts/worker-ops/f33AE-auth-getusercontact-canary.e2e.mjs
 * ===================================================================== */
import crypto from "node:crypto";
import fs from "node:fs";
import admin from "firebase-admin";

const CANARY_UID   = "canary-pwa-staging-notifprefs";
const CANARY_EMAIL = "canary-pwa-staging-notifprefs@idseven.test";
const OTHER_UID    = "not-the-canary-user";
const ORIGIN       = "https://agenda-id-seven.web.app";
const URL_LOGIN    = String(process.env.LOGINUSER_URL || "https://us-central1-agenda-id-seven.cloudfunctions.net/loginUser");
const URL_CONTACT  = String(process.env.GETUSERCONTACT_URL || "https://us-central1-agenda-id-seven.cloudfunctions.net/getUserContact");
const RUN_ID       = String(process.env.GITHUB_RUN_ID || "local");
const OUT          = String(process.env.RETEST_OUT || "getusercontact-canary-artifacts");

const report = { phase: "F3.3.20-B1.7-E-GETUSERCONTACT-CANARY-RETEST", canary: CANARY_UID, runId: RUN_ID,
  url_login_https: URL_LOGIN.startsWith("https://"), url_contact_https: URL_CONTACT.startsWith("https://"), steps: {}, go: false };
const probes = {};
const fails = [];
const log  = (m) => console.log("[f33AE] " + m);
const mask = (s) => { if (s) console.log("::add-mask::" + String(s)); };
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const sha256Hex = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest("hex");

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
  if (!report.url_login_https) fail("LOGINUSER_URL nao https: " + URL_LOGIN);
  if (!report.url_contact_https) fail("GETUSERCONTACT_URL nao https: " + URL_CONTACT);
  admin.initializeApp();
  const db = admin.firestore();
  const ref = db.collection("users").doc(CANARY_UID);

  /* ===== 0) PRE-READ do canario (read-only) ===== */
  const pre = await ref.get();
  if (!pre.exists) fail("usuario canario ausente: " + CANARY_UID);
  const u = pre.exists ? (pre.data() || {}) : {};
  report.steps.canaryPre = { uid_ok: pre.exists, canary_true: u.canary === true, status_ativo: u.status === "ativo",
    admin_false: u.admin !== true, fcmTokens_absent: !(u.fcmTokens), email_match: (String(u.email || "").toLowerCase() === CANARY_EMAIL) };
  ok("canary canary===true", u.canary === true);
  ok("canary status ativo", u.status === "ativo");
  ok("canary admin===false (precondicao p/ other 403)", u.admin !== true);
  ok("canary fcmTokens ausente (nao mascarar Web Push)", !(u.fcmTokens));
  ok("canary email casa", String(u.email || "").toLowerCase() === CANARY_EMAIL);
  if (u.fcmTokens) fail("canario ja possui fcmTokens — abortando");
  if (fails.length) return finish();

  /* ===== 1) PROBES HTTP seguros de getUserContact (sem token) ===== */
  const pOpt = await http(URL_CONTACT, "OPTIONS", undefined, null);
  probes.options = pOpt.status; ok("OPTIONS => 204", pOpt.status === 204);
  const pPut = await http(URL_CONTACT, "PUT", undefined, null);
  probes.put = pPut.status; ok("PUT => 405", pPut.status === 405);
  const pGet = await http(URL_CONTACT + "?uid=" + CANARY_UID, "GET", undefined, null);
  probes.get_no_token = { status: pGet.status, error: pGet.json && pGet.json.error };
  ok("GET sem token => 401 invalid_session", pGet.status === 401 && pGet.json && pGet.json.error === "invalid_session");
  const pPost = await http(URL_CONTACT, "POST", { uid: CANARY_UID }, null);
  probes.post_no_token = { status: pPost.status, error: pPost.json && pPost.json.error };
  ok("POST sem token => 401 invalid_session", pPost.status === 401 && pPost.json && pPost.json.error === "invalid_session");

  /* ===== 2) RE-SEED EFEMERO do canario ===== */
  const pw   = crypto.randomBytes(24).toString("base64url"); mask(pw);
  const salt = crypto.randomBytes(16).toString("hex");        mask(salt);
  const pass = "s2:" + sha256Hex(salt + "|" + pw);            mask(pass);
  await ref.set({ pass, salt, updatedAt: Date.now(), reseedFor: "getusercontact-canary-retest", reseedRunId: RUN_ID }, { merge: true });
  report.steps.reseed = { ok: true, fields: ["pass", "salt", "updatedAt", "reseedFor", "reseedRunId"], note: "valores mascarados; admin/role/status/email/phone/fcmTokens/notifPrefs intocados" };
  log("re-seed efemero OK (valores mascarados)");

  /* ===== 3) LOGIN canario via loginUser => token real ===== */
  const rLogin = await http(URL_LOGIN, "POST", { identifier: CANARY_EMAIL, password: pw }, null);
  const token = (rLogin.json && rLogin.json.session && typeof rLogin.json.session.token === "string") ? rLogin.json.session.token : "";
  if (token) mask(token);
  ok("login canario => 200 + token", rLogin.status === 200 && rLogin.json && rLogin.json.ok === true && !!token && typeof rLogin.json.session.expiresAt === "number");
  let claims = {};
  try { claims = JSON.parse(Buffer.from(String(token).split(".")[0] || "", "base64url").toString("utf8")); } catch (_) { claims = {}; }
  const ttl = (typeof claims.exp === "number" && typeof claims.iat === "number") ? (claims.exp - claims.iat) : -1;
  ok("token uid=canario", claims.uid === CANARY_UID);
  ok("token scope=session", claims.scope === "session");
  ok("token iat/exp + TTL~24h", typeof claims.iat === "number" && typeof claims.exp === "number" && ttl === 24 * 60 * 60 * 1000);
  report.steps.token = { uid_ok: claims.uid === CANARY_UID, scope: claims.scope, ttl_ms: ttl, admin: claims.admin === true, role: claims.role, note: "token bruto NUNCA salvo/impresso; assinatura descartada" };
  const AUTH = token ? ("Bearer " + token) : "";

  /* ===== 4) getUserContact SELF => 200 (GET principal + POST secundario) ===== */
  const rSelfGet = await http(URL_CONTACT + "?uid=" + CANARY_UID, "GET", undefined, AUTH);
  const cGet = (rSelfGet.json && rSelfGet.json.contact) ? rSelfGet.json.contact : {};
  ok("self GET => 200", rSelfGet.status === 200 && rSelfGet.json && rSelfGet.json.ok === true && rSelfGet.json.uid === CANARY_UID);
  const rSelfPost = await http(URL_CONTACT, "POST", { uid: CANARY_UID }, AUTH);
  ok("self POST => 200", rSelfPost.status === 200 && rSelfPost.json && rSelfPost.json.uid === CANARY_UID);

  /* ===== 5) getUserContact OTHER (nao-admin) => 403 ===== */
  const rOther = await http(URL_CONTACT + "?uid=" + OTHER_UID, "GET", undefined, AUTH);
  ok("other (nao-admin) => 403 forbidden", rOther.status === 403 && rOther.json && rOther.json.error === "forbidden");

  /* ===== 6) TOKEN INVALIDO => 401 ===== */
  const rBad = await http(URL_CONTACT + "?uid=" + CANARY_UID, "GET", undefined, "Bearer fake.tampered.token");
  ok("token invalido => 401 invalid_session", rBad.status === 401 && rBad.json && rBad.json.error === "invalid_session");

  /* ===== 7) PROJECAO SEGURA (so contact{phone,email}) ===== */
  const keys = Object.keys(cGet).sort();
  const respStr = JSON.stringify(rSelfGet.json || {});
  ok("contact tem EXATAMENTE phone+email", JSON.stringify(keys) === JSON.stringify(["email", "phone"]));
  ok("sem pass/salt", respStr.indexOf("s2:") < 0 && respStr.indexOf('"salt"') < 0);
  ok("sem fcmTokens/fcmTokenMeta", respStr.indexOf("fcmTokens") < 0 && respStr.indexOf("fcmTokenMeta") < 0);
  ok("sem admin/role/status/photo/color", !/"admin"|"role"|"status"|"photo"|"color"/.test(respStr));
  ok("sem token na resposta", respStr.indexOf("Bearer") < 0 && (!token || respStr.indexOf(token) < 0));
  report.steps.projection = { contact_keys: keys, safe: true };
  report.steps.authz = { self_get: rSelfGet.status, self_post: rSelfPost.status, other: rOther.status, invalid: rBad.status };

  /* ===== 8) FIRESTORE FINAL read-only (so o canario) ===== */
  const post = await ref.get(); const u2 = post.data() || {};
  ok("final: canary=true", u2.canary === true);
  ok("final: status ativo", u2.status === "ativo");
  ok("final: admin=false", u2.admin !== true);
  ok("final: fcmTokens ausente", !(u2.fcmTokens));
  report.steps.canaryPost = { canary_true: u2.canary === true, status_ativo: u2.status === "ativo", admin_false: u2.admin !== true, fcmTokens_absent: !(u2.fcmTokens) };

  /* ===== 9) logs sem token/PII ===== */
  finish();
})().catch((e) => { fail("ERRO HARNESS: " + (e && e.message)); finish(); });

function finish() {
  report.go = fails.length === 0;
  report.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(OUT + "/http-probes.json", JSON.stringify(probes, null, 2)); } catch (_) {}
  try { fs.writeFileSync(OUT + "/report.json", JSON.stringify(report, null, 2)); } catch (_) {}
  try { fs.writeFileSync(OUT + "/token-claims-safe.json", JSON.stringify(report.steps.token || {}, null, 2)); } catch (_) {}
  const safe = { note: "token REDACTED; contact e allowlist phone/email", contact_keys: (report.steps.projection && report.steps.projection.contact_keys) || [],
    authz: report.steps.authz || {}, session_token: "REDACTED" };
  try { fs.writeFileSync(OUT + "/getusercontact-response-safe.json", JSON.stringify(safe, null, 2)); } catch (_) {}
  console.log("\n========= F3.3.20-B1.7-E — getUserContact canary =========");
  console.log("  probes OPTIONS/PUT/GET/POST · login canario via loginUser · token scope=session");
  console.log("  self 200 · other 403 · invalido 401 · contact so {phone,email} · read-only final");
  console.log("==========================================================");
  console.log("f33AE getUserContact canary: " + (report.go ? "GO" : ("NO-GO (" + fails.length + " falhas)")));
  if (!report.go) { console.log(fails.join("\n")); process.exit(1); }
  process.exit(0);
}
