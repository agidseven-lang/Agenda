#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.5-B — HARDENING do trilho notifPrefs/notifLog (dormente).
 * Extrai a lógica REAL de functions/index.js e roda com crypto real + admin
 * mockado, provando: defineSecret + binding (fonte); dormência sem segredo (503);
 * flags default false; writeNotifLog com expireAt (≈ at+30d) e SEM PII; rate-limit
 * in-memory por uid+IP (bloqueia excesso de senha errada, SEM Firestore); usuário
 * válido (Designer/Social/Admin) segue apto. Puro/offline; não require(); não envia.
 * Rodar: /opt/node22/bin/node scripts/worker-ops/f33V-notif-hardening.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

function grab(n) {
  let a = SRC.indexOf("async function " + n + "(");
  if (a < 0) a = SRC.indexOf("function " + n + "(");
  if (a < 0) throw new Error("nao encontrei: " + n);
  let d = 0;
  for (let j = SRC.indexOf("{", a); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === "{") d++;
    else if (c === "}") { d--; if (!d) return SRC.slice(a, j + 1); }
  }
  throw new Error("sem fim: " + n);
}

const NAMES = ["notifPrefsSecret", "notifFlag", "notifDb", "notifMaskUid", "notifDjb2", "notifTimingSafeEq",
  "notifVerifyPassword", "notifSignToken", "notifRlBlocked", "notifRlFail", "notifRlClear",
  "getNotifPrefs", "shouldNotifyByPrefs", "writeNotifLog", "notifVerifyToken", "notifValidatePrefs",
  "handleIssueNotifPrefsToken", "handleNotifPrefsUpdate"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

const PRELUDE = `
  var NOTIF_TOKEN_TTL_MS = 15 * 60 * 1000;
  var NOTIF_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  var NOTIF_RL_MAX = 5, NOTIF_RL_WINDOW_MS = 5 * 60 * 1000, NOTIF_RL_BLOCK_MS = 15 * 60 * 1000;
  var __notifRlState = new Map();
  var __store = {}; var __writes = []; var __log = [];
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () { var d = __store[c + "/" + id]; return { exists: !!d, data: function () { return d || null; } }; },
      set: async function (data, opts) { __writes.push({ coll: c, op: "set" }); __store[c + "/" + id] = (opts && opts.merge && __store[c + "/" + id]) ? Object.assign({}, __store[c + "/" + id], data) : data; return {}; }
    }; },
    add: async function (o) { __writes.push({ coll: c, op: "add" }); if (c === "notifLog") __log.push(o); return { id: "x" }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  admin.firestore.Timestamp = { fromMillis: function (ms) { return { _millis: ms, toMillis: function () { return ms; } }; } };
  var logger = { info: function () {}, warn: function () {}, error: function () {} };
`;

const api = new Function("crypto", PRELUDE + BODY + `
  ; return {
    handleIssueNotifPrefsToken: handleIssueNotifPrefsToken, handleNotifPrefsUpdate: handleNotifPrefsUpdate,
    writeNotifLog: writeNotifLog, shouldNotifyByPrefs: shouldNotifyByPrefs, notifFlag: notifFlag,
    setUser: function (id, u) { __store["users/" + id] = u; }, setPrefs: function (id, p) { __store["notifPrefs/" + id] = p; },
    writes: function () { return __writes; }, log: function () { return __log; },
    resetWrites: function () { __writes.length = 0; }, resetLog: function () { __log.length = 0; }
  };
`)(crypto);

const SECRET = "S3cr3t-B15";
const NOW = 1781800000000;
const D30 = 30 * 24 * 60 * 60 * 1000;
const setSecret = (on) => { if (on) process.env.NOTIF_PREFS_SECRET = SECRET; else delete process.env.NOTIF_PREFS_SECRET; };
const setFlags = (prefs, log) => { process.env.ENABLE_NOTIF_PREFS = prefs ? "true" : "false"; process.env.ENABLE_NOTIF_LOG = log ? "true" : "false"; };
const mkPass = (pw, salt) => "s2:" + crypto.createHash("sha256").update(salt + "|" + pw).digest("hex");
const issue = (body, ip) => api.handleIssueNotifPrefsToken({ method: "POST", body, ip: ip || "", now: NOW });

api.setUser("uDes", { pass: mkPass("pwD", "sD"), salt: "sD", role: "designer", admin: false, status: "aprovado" });
api.setUser("uSoc", { pass: mkPass("pwS", "sS"), salt: "sS", role: "social media", admin: false, status: "" });
api.setUser("uAdm", { pass: mkPass("pwA", "sA"), salt: "sA", role: "gestor", admin: true, status: "" });

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  /* ===== 1-3) defineSecret + binding (fonte) ===== */
  ok("1 NOTIF_PREFS_SECRET via defineSecret", /const NOTIF_PREFS_SECRET = defineSecret\("NOTIF_PREFS_SECRET"\)/.test(SRC));
  ok("2 updateNotifPrefs com secrets:[NOTIF_PREFS_SECRET]", /exports\.updateNotifPrefs = onRequest\(\{ secrets: \[NOTIF_PREFS_SECRET\]/.test(SRC));
  ok("3 issueNotifPrefsToken com secrets:[NOTIF_PREFS_SECRET]", /exports\.issueNotifPrefsToken = onRequest\(\{ secrets: \[NOTIF_PREFS_SECRET\]/.test(SRC));

  /* ===== 4) dormente sem segredo ===== */
  setSecret(false); setFlags(false, false);
  ok("4a emissor sem segredo => 503", (await issue({ uid: "uDes", password: "pwD" })).status === 503);
  ok("4b endpoint sem segredo => 503", (await api.handleNotifPrefsUpdate({ method: "POST", authHeader: "Bearer a.b", body: { enabled: true }, now: NOW })).status === 503);

  /* ===== 5) flags default false ===== */
  delete process.env.ENABLE_NOTIF_PREFS; delete process.env.ENABLE_NOTIF_LOG;
  ok("5a notifFlag ausente => false", api.notifFlag("ENABLE_NOTIF_PREFS") === false && api.notifFlag("ENABLE_NOTIF_LOG") === false);
  ok("5b fonte: só 'true' liga (=== \"true\")", /=== "true"/.test(grab("notifFlag")) && !/ENABLE_NOTIF_\w+\s*=\s*"true"/.test(SRC));

  /* ===== 6) ENABLE_NOTIF_PREFS=false preserva (shouldNotifyByPrefs => true) ===== */
  setFlags(false, false); api.setPrefs("uDes", { enabled: false });
  ok("6 flag OFF: shouldNotifyByPrefs => true mesmo com enabled:false", (await api.shouldNotifyByPrefs("uDes", "task_assigned", "android")) === true);

  /* ===== 7) ENABLE_NOTIF_LOG=false => no-op ===== */
  setFlags(false, false); api.resetLog();
  const r7 = await api.writeNotifLog({ taskId: "T7", eventType: "task_assigned", to: "uDes", channel: "fcm", sent: 1, total: 1, reason: "ok" });
  ok("7 LOG OFF: não grava", r7.written === false && api.log().length === 0);

  /* ===== 8-9) ENABLE_NOTIF_LOG=true => grava com expireAt ≈ at+30d ===== */
  setFlags(false, true); api.resetLog();
  await api.writeNotifLog({ taskId: "T8", eventType: "task_assigned", to: "uDes", channel: "fcm", sent: 1, total: 1, reason: "ok", at: NOW });
  const d8 = api.log()[0];
  ok("8 LOG ON: grava 1 doc com expireAt Timestamp", api.log().length === 1 && d8.expireAt && typeof d8.expireAt.toMillis === "function");
  ok("9 expireAt.toMillis() === at + 30 dias; at permanece number", d8.expireAt.toMillis() === NOW + D30 && d8.at === NOW && typeof d8.at === "number");

  /* ===== 10-13) sem PII no log ===== */
  api.resetLog();
  await api.writeNotifLog({ taskId: "T", eventType: "chat_message", to: "uX", channel: "fcm", sent: 1, total: 1, reason: "ok",
    password: "SENHA123", token: "aaa.bbb", secret: "SEGREDO", text: "corpo secreto do chat", body: "corpo", name: "Fulano", email: "a@b.com" });
  const dP = api.log()[0]; const keys = Object.keys(dP);
  const allowed = ["taskId", "eventType", "to", "channel", "sent", "total", "reason", "at", "expireAt"];
  ok("10-13 log só com campos permitidos (sem password/token/secret/text/body/PII)", keys.every((k) => allowed.indexOf(k) >= 0));
  ok("10 sem password", !("password" in dP)); ok("11 sem token", !("token" in dP));
  ok("12 sem secret", !("secret" in dP)); ok("13 sem texto/corpo de chat", !("text" in dP) && !("body" in dP));

  /* ===== 16-19) usuário válido segue apto (antes do rate-limit p/ isolar) ===== */
  setSecret(true); setFlags(false, false);
  const rDes = await issue({ uid: "uDes", password: "pwD" }, "9.9.9.9");
  ok("16/17 Designer válido => token", rDes.status === 200 && rDes.json.uid === "uDes" && !!rDes.json.token);
  ok("18 Social válido => token", (await issue({ uid: "uSoc", password: "pwS" }, "9.9.9.9")).status === 200);
  const rAdm = await issue({ uid: "uAdm", password: "pwA" }, "9.9.9.9");
  ok("19 Admin válido => admin:true", rAdm.status === 200 && rAdm.json.admin === true);

  /* ===== 14-15) rate-limit (bloqueia excesso; SEM Firestore) ===== */
  setSecret(true); api.resetWrites();
  let statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await issue({ uid: "uHammer", password: "ERRADA" }, "5.5.5.5")).status);
  ok("14 rate-limit: 5 tentativas inválidas e 6ª => 429", statuses.slice(0, 5).every((s) => s === 401) && statuses[5] === 429);
  ok("15 rate-limit NÃO escreve em Firestore (zero set/add)", api.writes().filter((w) => w.op === "set" || w.op === "add").length === 0);
  // usuário válido NÃO é bloqueado por excesso de outro uid/IP
  ok("16b usuário válido em fluxo normal não é bloqueado", (await issue({ uid: "uDes", password: "pwD" }, "7.7.7.7")).status === 200);

  console.log("\n========= F3.3.20-B1.5-B — hardening (handlers reais) =========");
  console.log("  defineSecret+binding · 503 sem segredo · flags default false");
  console.log("  notifLog: expireAt = at+30d; só IDs+contadores (sem senha/token/segredo/texto)");
  console.log("  rate-limit in-memory uid+IP: 5 inválidas => 429; SEM Firestore; válido não é bloqueado");
  console.log("===============================================================\n");
  console.log("F3.3.20-B1.5-B notif-hardening: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
