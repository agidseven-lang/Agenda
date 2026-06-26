#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — CANARIO de loginUser (server-side login) — runner CI/gated.
 * Valida a Function HTTPS `loginUser` JA PUBLICADA (endpoint-only; SEM UI, SEM
 * Playwright). Prova, com egress do runner:
 *   - probes HTTP seguros: OPTIONS 204 / GET 405 / POST {} 400 / POST invalido 400 /
 *     POST identifier inexistente + senha lixo 401 (anti-enumeracao);
 *   - re-seed EFEMERO somente do canario (campos pass/salt/updatedAt/reseedFor/
 *     reseedRunId); login canario real => 200 + token de sessao;
 *   - token HMAC com scope=session, uid do canario, TTL ~24h (decodificado LOCAL;
 *     NUNCA impresso/salvo bruto);
 *   - projecao segura (so {id,name,role,admin,status,photo,color}; sem pass/salt/
 *     fcmTokens/phone/email/doc cru);
 *   - negativos: senha errada / inexistente => 401 identico;
 *   - leitura final read-only SO do canario (fcmTokens/phone ausentes; status ativo).
 * Firestore: UNICO write direto = re-seed da SENHA do canario. NAO toca notifPrefs,
 * NAO toca usuario real, NAO le a colecao inteira como artifact. Web Push BLOQUEADO
 * (sem FCM, sem fcmTokens). NUNCA imprime senha/pass/salt/token bruto/Authorization.
 * URL via env LOGINUSER_URL (do gcloud describe no workflow) — fonte de verdade.
 * Rodar (no runner): node scripts/worker-ops/f33AB-auth-loginuser-canary.e2e.mjs
 * ===================================================================== */
import crypto from "node:crypto";
import fs from "node:fs";
import admin from "firebase-admin";

const CANARY_UID   = "canary-pwa-staging-notifprefs";
const CANARY_EMAIL = "canary-pwa-staging-notifprefs@idseven.test";
const ORIGIN       = "https://agenda-id-seven.web.app";
const URL_LOGIN    = String(process.env.LOGINUSER_URL || "https://us-central1-agenda-id-seven.cloudfunctions.net/loginUser");
const RUN_ID       = String(process.env.GITHUB_RUN_ID || "local");
const OUT          = String(process.env.RETEST_OUT || "loginuser-canary-artifacts");

const report = { phase: "F3.3.20-B1.7-E-LOGINUSER-CANARY-RETEST", url_is_https: URL_LOGIN.startsWith("https://"), canary: CANARY_UID, runId: RUN_ID, steps: {}, go: false };
const probes = {};
const fails = [];
const log  = (m) => console.log("[f33AB] " + m);
const mask = (s) => { if (s) console.log("::add-mask::" + String(s)); };
const fail = (m) => { fails.push(m); console.log("FAIL: " + m); };
const ok   = (n, c) => { if (!c) fail(n); return !!c; };
const sha256Hex = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest("hex");

async function http(method, body, headers) {
  const h = Object.assign({ "Origin": ORIGIN }, headers || {});
  const opt = { method, headers: h };
  if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = (typeof body === "string" ? body : JSON.stringify(body)); }
  const res = await fetch(URL_LOGIN, opt);
  let json = null; const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  return { status: res.status, json };
}

(async () => {
  if (!report.url_is_https) fail("LOGINUSER_URL nao e https: " + URL_LOGIN);
  admin.initializeApp();
  const db = admin.firestore();

  /* ===== 0) PRE-READ do canario (read-only) ===== */
  const ref = db.collection("users").doc(CANARY_UID);
  const pre = await ref.get();
  if (!pre.exists) { fail("usuario canario ausente: " + CANARY_UID); }
  const u = pre.exists ? (pre.data() || {}) : {};
  const expectAdmin = (u.admin === true);
  const expectRole  = (typeof u.role === "string" ? u.role : "");
  report.steps.canaryPre = {
    uid_ok: pre.exists, canary_true: u.canary === true, status_ativo: u.status === "ativo",
    fcmTokens_absent: !(u.fcmTokens), phone_absent: !(u.phone), email_match: (String(u.email || "").toLowerCase() === CANARY_EMAIL),
    admin: expectAdmin, role: expectRole,
  };
  ok("canary canary===true", u.canary === true);
  ok("canary status ativo", u.status === "ativo");
  ok("canary fcmTokens ausente (nao mascarar Web Push)", !(u.fcmTokens));
  ok("canary email casa", String(u.email || "").toLowerCase() === CANARY_EMAIL);
  if (u.fcmTokens) fail("canario ja possui fcmTokens — abortando para nao mascarar Web Push");
  if (fails.length) return finish();   // pre-read invalido => nao prossegue

  /* ===== 1) PROBES HTTP seguros (sem usuario real) ===== */
  const pOpt = await http("OPTIONS", undefined, { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" });
  probes.options = pOpt.status; ok("OPTIONS => 204", pOpt.status === 204);
  const pGet = await http("GET"); probes.get = pGet.status; ok("GET => 405", pGet.status === 405);
  const pEmpty = await http("POST", {}); probes.post_empty = { status: pEmpty.status, error: pEmpty.json && pEmpty.json.error }; ok("POST {} => 400", pEmpty.status === 400);
  const pBad = await http("POST", { identifier: 123, password: 456 }); probes.post_invalid = { status: pBad.status, error: pBad.json && pBad.json.error }; ok("POST invalido => 400", pBad.status === 400);
  const pGhost = await http("POST", { identifier: "ghost-" + RUN_ID + "@idseven.test", password: "lixo-nao-real" });
  probes.post_inexistent = { status: pGhost.status, error: pGhost.json && pGhost.json.error };
  ok("POST inexistente => 401 invalid_credentials", pGhost.status === 401 && pGhost.json && pGhost.json.error === "invalid_credentials");

  /* ===== 2) RE-SEED EFEMERO do canario (so pass/salt/updatedAt/reseedFor/reseedRunId) ===== */
  const pw   = crypto.randomBytes(24).toString("base64url"); mask(pw);
  const salt = crypto.randomBytes(16).toString("hex");        mask(salt);
  const pass = "s2:" + sha256Hex(salt + "|" + pw);            mask(pass);
  await ref.set({ pass, salt, updatedAt: Date.now(), reseedFor: "loginuser-canary-retest", reseedRunId: RUN_ID }, { merge: true });
  report.steps.reseed = { ok: true, fields: ["pass", "salt", "updatedAt", "reseedFor", "reseedRunId"], note: "valores mascarados; admin/role/status/email/phone/fcmTokens/notifPrefs intocados" };
  log("re-seed efemero OK (valores mascarados)");

  /* ===== 3) LOGIN canario real => 200 ===== */
  const rLogin = await http("POST", { identifier: CANARY_EMAIL, password: pw });
  const j = rLogin.json || {};
  const token = (j.session && typeof j.session.token === "string") ? j.session.token : "";
  if (token) mask(token);
  ok("login canario => 200", rLogin.status === 200);
  ok("login ok=true + session.token + expiresAt", j.ok === true && !!token && typeof j.session.expiresAt === "number");
  ok("user.id = canario", j.user && j.user.id === CANARY_UID);
  ok("user.status = ativo", j.user && j.user.status === "ativo");
  ok("user.admin conforme doc", j.user && j.user.admin === expectAdmin);
  ok("user.role conforme doc", j.user && j.user.role === expectRole);

  /* ===== 4) VALIDACAO do TOKEN (decode LOCAL; nunca expor) ===== */
  let claims = {};
  try { claims = JSON.parse(Buffer.from(String(token).split(".")[0] || "", "base64url").toString("utf8")); } catch (_) { claims = {}; }
  const ttl = (typeof claims.exp === "number" && typeof claims.iat === "number") ? (claims.exp - claims.iat) : -1;
  ok("token uid = canario", claims.uid === CANARY_UID);
  ok("token scope = session", claims.scope === "session");
  ok("token iat/exp presentes", typeof claims.iat === "number" && typeof claims.exp === "number");
  ok("token TTL ~24h (ms)", ttl === 24 * 60 * 60 * 1000);
  ok("token admin/role conforme response", claims.admin === (j.user && j.user.admin) && claims.role === (j.user && j.user.role));
  ok("expiresAt == exp", j.session && j.session.expiresAt === claims.exp);
  report.steps.token = { uid_ok: claims.uid === CANARY_UID, scope: claims.scope, ttl_ms: ttl, admin: claims.admin === true, role: claims.role, note: "token bruto NUNCA salvo/impresso; assinatura descartada" };

  /* ===== 5) PROJECAO SEGURA (sem PII/credenciais) ===== */
  const user = j.user || {};
  const keys = Object.keys(user).sort();
  const allow = ["admin", "color", "id", "name", "photo", "role", "status"];
  const respStr = JSON.stringify(j);
  ok("user tem EXATAMENTE os 7 campos allowlist", JSON.stringify(keys) === JSON.stringify(allow));
  ok("sem pass", !("pass" in user) && respStr.indexOf("s2:") < 0);
  ok("sem salt", !("salt" in user));
  ok("sem fcmTokens", !("fcmTokens" in user));
  ok("sem phone", !("phone" in user));
  ok("sem email (nem o e-mail do canario na resposta)", !("email" in user) && respStr.toLowerCase().indexOf(CANARY_EMAIL.toLowerCase()) < 0);
  ok("unico token e session.token (sem token solto em user)", !("token" in user));
  report.steps.projection = { keys, safe: true };

  /* ===== 6) NEGATIVOS (401 identico; anti-enumeracao) ===== */
  const nWrong = await http("POST", { identifier: CANARY_EMAIL, password: "SENHA-ERRADA-" + RUN_ID });
  const nGhost = await http("POST", { identifier: "ghost2-" + RUN_ID + "@idseven.test", password: "lixo2" });
  ok("senha errada => 401 invalid_credentials", nWrong.status === 401 && nWrong.json && nWrong.json.error === "invalid_credentials");
  ok("inexistente => 401 invalid_credentials", nGhost.status === 401 && nGhost.json && nGhost.json.error === "invalid_credentials");
  ok("401 indistinguivel (anti-enumeracao)", nWrong.status === nGhost.status && JSON.stringify(nWrong.json) === JSON.stringify(nGhost.json));
  report.steps.negatives = { wrong: nWrong.status, inexistent: nGhost.status, identical: JSON.stringify(nWrong.json) === JSON.stringify(nGhost.json) };

  /* ===== 7) FIRESTORE FINAL read-only (so o canario) ===== */
  const post = await ref.get(); const u2 = post.data() || {};
  ok("final: fcmTokens ausente", !(u2.fcmTokens));
  ok("final: phone ausente", !(u2.phone));
  ok("final: status ativo", u2.status === "ativo");
  ok("final: canary true", u2.canary === true);
  report.steps.canaryPost = { fcmTokens_absent: !(u2.fcmTokens), phone_absent: !(u2.phone), status_ativo: u2.status === "ativo", canary_true: u2.canary === true };

  finish();
})().catch((e) => { fail("ERRO HARNESS: " + (e && e.message)); finish(); });

function finish() {
  report.go = fails.length === 0;
  report.fails = fails;
  try { fs.mkdirSync(OUT, { recursive: true }); } catch (_) {}
  // artifacts seguros (token bruto NUNCA salvo)
  try { fs.writeFileSync(OUT + "/http-probes.json", JSON.stringify(probes, null, 2)); } catch (_) {}
  try { fs.writeFileSync(OUT + "/report.json", JSON.stringify(report, null, 2)); } catch (_) {}
  // resposta segura: token redigido; user (allowlist) preservado
  const safe = { note: "session.token redigido; user e projecao allowlist", ok_login: report.steps.token ? true : false,
    user: (report.steps.projection && report.steps.projection.keys) ? report.steps.projection.keys : [],
    token_claims: report.steps.token || null, session_token: "REDACTED" };
  try { fs.writeFileSync(OUT + "/loginuser-response-safe.json", JSON.stringify(safe, null, 2)); } catch (_) {}
  console.log("\n========= F3.3.20-B1.7-E — loginUser canary =========");
  console.log("  probes OPTIONS/GET/POST · re-seed efemero · login 200 · token scope=session TTL24h");
  console.log("  projecao allowlist (sem pass/salt/fcmTokens/phone/email) · negativos 401 · read-only final");
  console.log("=====================================================");
  console.log("f33AB loginUser canary: " + (report.go ? "GO" : ("NO-GO (" + fails.length + " falhas)")));
  if (!report.go) { console.log(fails.join("\n")); process.exit(1); }
  process.exit(0);
}
