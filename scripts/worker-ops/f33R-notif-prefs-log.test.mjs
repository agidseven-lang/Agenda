#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.1-A — BASE SERVER-SIDE DORMENTE p/ notifPrefs / notifLog.
 * Extrai os helpers REAIS de functions/index.js (notifFlag/notifDb/getNotifPrefs/
 * shouldNotifyByPrefs/writeNotifLog) e os roda com admin.firestore() MOCKADO,
 * provando:
 *   1) flags OFF        => comportamento atual identico (null / true / no-op);
 *   2) ausencia de prefs => comportamento atual identico;
 *   3) enabled=false (flag ON) => suprime SO no helper;
 *   4) enabled=true  (flag ON) => permite;
 *   5) erro ao ler prefs => fallback seguro (true / null), nao bloqueia;
 *   6) notifLog flag OFF => nao grava;
 *   7) notifLog flag ON  => tenta gravar no mock;
 *   8) erro ao gravar    => nao quebra (best-effort);
 *   9) payload com taskId/eventType/to/channel/sent/total/reason/at;
 *  10) dedup por deviceId preservado (prova de fonte);
 *  11) fcmTokens/fcmTokenMeta nao alterados (prova de fonte);
 *  12) clientPushSubs nao alterado (prova de fonte);
 * + DORMENCIA: nenhum trigger chama os helpers nesta fase (prova de fonte).
 * Puro/offline: NAO require() o modulo (sem deps), NAO toca producao, NAO envia.
 * Rodar: /opt/node22/bin/node scripts/worker-ops/f33R-notif-prefs-log.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

// Extrai uma declaracao de funcao (inclui "async") por brace-matching.
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

const NAMES = ["notifFlag", "notifDb", "getNotifPrefs", "shouldNotifyByPrefs", "writeNotifLog"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

// Mock de admin.firestore(): store p/ notifPrefs + captura de notifLog + modos de erro.
const PRELUDE = `
  var __store = { notifPrefs: {} };
  var __failGet = false, __failAdd = false, __log = [];
  var admin = { firestore: function () { return {
    collection: function (c) { return {
      doc: function (id) { return { get: async function () {
        if (c === "notifPrefs" && __failGet) throw new Error("FS get boom");
        var d = (__store[c] || {})[id];
        return { exists: !!d, data: function () { return d || null; } };
      } }; },
      add: async function (obj) {
        if (c === "notifLog" && __failAdd) throw new Error("FS add boom");
        __log.push(obj); return { id: "auto" + (__log.length) };
      }
    }; }
  }; } };
  var logger = { warn: function () {}, info: function () {}, error: function () {} };
`;

const api = new Function(PRELUDE + BODY + `
  ; return {
    getNotifPrefs: getNotifPrefs, shouldNotifyByPrefs: shouldNotifyByPrefs, writeNotifLog: writeNotifLog,
    _setPrefs: function (uid, p) { __store.notifPrefs[uid] = p; },
    _failGet: function (v) { __failGet = !!v; }, _failAdd: function (v) { __failAdd = !!v; },
    _log: function () { return __log; }, _clearLog: function () { __log.length = 0; }
  };
`)();

const setFlags = (prefs, log) => {
  process.env.ENABLE_NOTIF_PREFS = prefs ? "true" : "false";
  process.env.ENABLE_NOTIF_LOG = log ? "true" : "false";
};

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  /* ===== 0) PROVAS DE FONTE (confinamento / no-touch / dormencia) ===== */
  // BLOCK = somente o CODIGO dos helpers (a partir de notifFlag), excluindo o
  // comentario-cabecalho (que cita deviceId/fcmTokens/clientPushSubs nas notas).
  const BLOCK = SRC.slice(SRC.indexOf("function notifFlag"));
  ok("[src] flags ENABLE_NOTIF_PREFS/ENABLE_NOTIF_LOG definidas (default OFF; so 'true' liga)",
    /notifFlag\("ENABLE_NOTIF_PREFS"\)/.test(BLOCK) && /notifFlag\("ENABLE_NOTIF_LOG"\)/.test(BLOCK)
    && /=== "true"/.test(BLOCK));
  ok("[src#10] helpers NAO tocam dedup por deviceId", !/deviceId|dedupeTokensByDevice/.test(BLOCK));
  ok("[src#11] helpers NAO tocam fcmTokens/fcmTokenMeta", !/fcmTokens|fcmTokenMeta/.test(BLOCK));
  ok("[src#12] helpers NAO tocam clientPushSubs", !/clientPushSubs/.test(BLOCK));
  ok("[src] dedupeTokensByDevice (deviceId) permanece intacto no arquivo",
    /function dedupeTokensByDevice/.test(SRC) && /m\.deviceId/.test(SRC));
  ok("[src] DORMENCIA: notifyResponsible (trigger) NAO chama os helpers", (() => {
    const f = grab("notifyResponsible");
    return !/getNotifPrefs|shouldNotifyByPrefs|writeNotifLog/.test(f);
  })());
  ok("[src] writeNotifLog grava em colecao notifLog (server-side)", /collection\("notifLog"\)\.add\(/.test(BLOCK));
  ok("[src] getNotifPrefs le notifPrefs/{uid}", /collection\("notifPrefs"\)\.doc\(String\(uid\)\)/.test(BLOCK));

  /* ===== 1) flags OFF => comportamento atual identico ===== */
  setFlags(false, false);
  api._setPrefs("uOff", { enabled: false }); // mesmo com prefs hostis...
  ok("1a flag OFF: getNotifPrefs => null", (await api.getNotifPrefs("uOff")) === null);
  ok("1b flag OFF: shouldNotifyByPrefs => true (nunca suprime)", (await api.shouldNotifyByPrefs("uOff", "assign", "android")) === true);

  /* ===== 2) ausencia de notifPrefs => comportamento atual identico ===== */
  setFlags(true, false);
  ok("2a flag ON + sem doc: getNotifPrefs => null", (await api.getNotifPrefs("uSemDoc")) === null);
  ok("2b flag ON + sem doc: shouldNotifyByPrefs => true", (await api.shouldNotifyByPrefs("uSemDoc", "assign", "android")) === true);

  /* ===== 3) enabled=false com flag ON => suprime (so no helper) ===== */
  api._setPrefs("uDis", { enabled: false });
  ok("3 flag ON + enabled=false => false", (await api.shouldNotifyByPrefs("uDis", "assign", "android")) === false);

  /* ===== 4) enabled=true com flag ON => permite ===== */
  api._setPrefs("uEn", { enabled: true });
  ok("4 flag ON + enabled=true => true", (await api.shouldNotifyByPrefs("uEn", "assign", "android")) === true);

  // 4b granular opcional (defaults seguros)
  api._setPrefs("uMute", { enabled: true, mutedEvents: { sla_warning: true } });
  ok("4b mutedEvents[sla_warning]=true => false p/ esse evento", (await api.shouldNotifyByPrefs("uMute", "sla_warning", "android")) === false);
  ok("4c mutedEvents nao afeta outro evento => true", (await api.shouldNotifyByPrefs("uMute", "assign", "android")) === true);
  api._setPrefs("uPlat", { enabled: true, platforms: { desktop: false } });
  ok("4d platforms[desktop]=false => false p/ desktop", (await api.shouldNotifyByPrefs("uPlat", "assign", "desktop")) === false);
  ok("4e platforms nao afeta android => true", (await api.shouldNotifyByPrefs("uPlat", "assign", "android")) === true);

  /* ===== 5) erro ao ler prefs => fallback seguro, nao bloqueia ===== */
  setFlags(true, false); api._failGet(true);
  ok("5a erro de leitura: getNotifPrefs => null", (await api.getNotifPrefs("uErr")) === null);
  ok("5b erro de leitura: shouldNotifyByPrefs => true (nao bloqueia)", (await api.shouldNotifyByPrefs("uErr", "assign", "android")) === true);
  api._failGet(false);

  /* ===== 6) notifLog flag OFF => nao grava ===== */
  setFlags(false, false); api._clearLog();
  const r6 = await api.writeNotifLog({ taskId: "T6", eventType: "assign", to: "designer", channel: "fcm", sent: 1, total: 1, reason: "ok" });
  ok("6a flag OFF: writeNotifLog nao grava (written=false)", r6 && r6.written === false && r6.skipped === "flag_off");
  ok("6b flag OFF: nada no log", api._log().length === 0);

  /* ===== 7) notifLog flag ON => tenta gravar no mock ===== */
  setFlags(false, true); api._clearLog();
  const r7 = await api.writeNotifLog({ taskId: "T7", eventType: "sla_warning", to: "designer", channel: "fcm", sent: 2, total: 3, reason: "sent 2/3", at: 1781800000000 });
  ok("7a flag ON: writeNotifLog grava (written=true)", r7 && r7.written === true);
  ok("7b flag ON: 1 doc no log", api._log().length === 1);

  /* ===== 8) erro ao gravar => nao quebra ===== */
  setFlags(false, true); api._failAdd(true); api._clearLog();
  let threw8 = false, r8 = null;
  try { r8 = await api.writeNotifLog({ taskId: "T8", eventType: "assign", to: "designer", channel: "fcm", sent: 0, total: 1, reason: "x" }); }
  catch (_) { threw8 = true; }
  ok("8a erro de gravacao: NAO lanca", threw8 === false);
  ok("8b erro de gravacao: written=false skipped=error", r8 && r8.written === false && r8.skipped === "error");
  api._failAdd(false);

  /* ===== 9) payload contem os campos exigidos ===== */
  const doc = api._log()[0] || (setFlags(false, true), api._clearLog(), await api.writeNotifLog({ taskId: "T9", eventType: "assign", to: "designer", channel: "fcm", sent: 1, total: 1, reason: "ok" }), api._log()[0]);
  const need = ["taskId", "eventType", "to", "channel", "sent", "total", "reason", "at"];
  const have = doc ? need.filter((k) => Object.prototype.hasOwnProperty.call(doc, k)) : [];
  ok("9a payload tem os 8 campos (taskId/eventType/to/channel/sent/total/reason/at)", have.length === need.length);
  // re-grava T7 p/ checar tipos exatos
  setFlags(false, true); api._clearLog();
  await api.writeNotifLog({ taskId: "T7", eventType: "sla_warning", to: "designer", channel: "fcm", sent: 2, total: 3, reason: "sent 2/3", at: 1781800000000 });
  const d = api._log()[0];
  ok("9b tipos normalizados (strings + numeros + at)",
    d && typeof d.taskId === "string" && typeof d.eventType === "string" && typeof d.to === "string"
    && typeof d.channel === "string" && typeof d.sent === "number" && typeof d.total === "number"
    && typeof d.reason === "string" && d.at === 1781800000000 && d.sent === 2 && d.total === 3);
  // at default quando ausente
  api._clearLog(); await api.writeNotifLog({ taskId: "T0" });
  ok("9c at default (Date.now) quando ausente", typeof api._log()[0].at === "number" && api._log()[0].at > 0);

  /* ===== Matriz legivel ===== */
  console.log("\n========= F3.3.20-B1.1-A — notifPrefs/notifLog (helpers reais) =========");
  console.log("  flag OFF        : prefs=null, shouldNotify=true, log=no-op");
  console.log("  flag ON  sem doc: prefs=null, shouldNotify=true");
  console.log("  flag ON  enabled=false => shouldNotify=false (so no helper)");
  console.log("  flag ON  enabled=true  => shouldNotify=true");
  console.log("  erro leitura/gravacao  => fallback seguro, nunca bloqueia");
  console.log("  payload notifLog       => taskId/eventType/to/channel/sent/total/reason/at");
  console.log("========================================================================\n");

  console.log("F3.3.20-B1.1-A notif-prefs-log: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
