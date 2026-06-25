// F3.3.20-B1.7-E — testa o cliente notifPrefs REAL embutido no index.html.
// Extrai o bloco entre /* __NPC_START__ */ e /* __NPC_END__ */, avalia e exercita.
// Sem rede (fetch injetado). Sem DOM. Sem segredo. Sem usuário real.
import assert from "node:assert";
import fs from "node:fs";
const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const m = html.match(/\/\* __NPC_START__[\s\S]*?\/\* __NPC_END__ \*\//);
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); console.log("PASS " + n); pass++; } catch (e) { console.log("FAIL " + n + " :: " + e.message); fail++; } };
const ta = async (n, f) => { try { await f(); console.log("PASS " + n); pass++; } catch (e) { console.log("FAIL " + n + " :: " + e.message); fail++; } };
if (!m) { console.log("FAIL: marcadores __NPC__ ausentes no index.html"); process.exit(1); }
const api = (function () { const __e = {}; eval(m[0] + "\n;Object.assign(__e,{buildNotifPrefsPayload,permissiveDefaultNotifPrefsPayload,sanitizeNotifPrefsError,issueNotifPrefsTokenClient,updateNotifPrefsClient,clearNotifPrefsSensitiveRefs});"); return __e; })();
const mkFetch = (status, body) => async () => ({ status, json: async () => body });

t("default permissivo", () => { assert.deepEqual(api.permissiveDefaultNotifPrefsPayload(), { enabled: true, byEvent: { task_assigned: true, event_assigned: true, chat_message: true }, byPlatform: { android: true } }); });
t("build supressão task_assigned", () => { const p = api.buildNotifPrefsPayload({ enabled: true, task_assigned: false, event_assigned: true, chat_message: true, android: true }); assert.equal(p.enabled, true); assert.equal(p.byEvent.task_assigned, false); assert.equal(p.byPlatform.android, true); });
t("build NUNCA inclui uid/quietHours", () => { const p = api.buildNotifPrefsPayload({ enabled: true, uid: "x", quietHours: { start: "22:00", end: "07:00" }, task_assigned: false }); assert.ok(!("uid" in p)); assert.ok(!("quietHours" in p)); });
t("build ignora campos fora da allowlist", () => { const p = api.buildNotifPrefsPayload({ enabled: true, evil: true }); assert.deepEqual(Object.keys(p), ["enabled"]); });
t("sanitize 400/401/403/429", () => { assert.match(api.sanitizeNotifPrefsError(400), /inválidos/i); assert.match(api.sanitizeNotifPrefsError(401), /senha/i); assert.match(api.sanitizeNotifPrefsError(403), /permiss/i); assert.match(api.sanitizeNotifPrefsError(429), /tentativas|aguarde/i); });
t("clearSensitive zera token/senha", () => { const r = { token: "T", password: "p" }; api.clearNotifPrefsSensitiveRefs(r); assert.equal(r.token, null); assert.equal(r.password, null); });
t("bloco NPC sem armazenamento persistente p/ token", () => { assert.ok(!/(localStorage|sessionStorage|indexedDB)\s*[.\[]/.test(m[0]), "uso persistente detectado no bloco"); });
await ta("issue 200 -> token só em memória", async () => { const r = await api.issueNotifPrefsTokenClient({ uid: "u", password: "p", url: "x", fetchImpl: mkFetch(200, { ok: true, token: "TKN", scope: "notifPrefs:write", exp: 1 }) }); assert.equal(r.ok, true); assert.equal(r.token, "TKN"); });
await ta("issue 401 -> não vaza token", async () => { const r = await api.issueNotifPrefsTokenClient({ uid: "u", password: "p", url: "x", fetchImpl: mkFetch(401, { ok: false, error: "invalid_credentials" }) }); assert.equal(r.ok, false); assert.ok(!("token" in r)); });
await ta("update REJEITA uid (cross-uid guard)", async () => { let th = false; try { await api.updateNotifPrefsClient({ token: "T", payload: { uid: "o", enabled: true }, url: "x", fetchImpl: mkFetch(200, { ok: true }) }); } catch (e) { th = /uid_must_not_be_sent/.test(e.message); } assert.ok(th); });
await ta("update REJEITA campo fora da allowlist (quietHours)", async () => { let th = false; try { await api.updateNotifPrefsClient({ token: "T", payload: { quietHours: null }, url: "x", fetchImpl: mkFetch(200, { ok: true }) }); } catch (e) { th = /payload_field_not_allowed/.test(e.message); } assert.ok(th); });
await ta("update 200 ok", async () => { const r = await api.updateNotifPrefsClient({ token: "T", payload: { enabled: true }, url: "x", fetchImpl: mkFetch(200, { ok: true, uid: "u", prefs: { enabled: true } }) }); assert.equal(r.ok, true); });
await ta("update 403 tratado", async () => { const r = await api.updateNotifPrefsClient({ token: "T", payload: { enabled: true }, url: "x", fetchImpl: mkFetch(403, { ok: false, error: "forbidden_uid" }) }); assert.equal(r.ok, false); assert.equal(r.status, 403); });

console.log("\nF3.3.20-B1.7-E f33W notif-prefs-client(UI): " + pass + " OK, " + fail + " FAIL");
if (fail) process.exit(1);
