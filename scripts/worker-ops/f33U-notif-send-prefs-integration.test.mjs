#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.4-B — INTEGRAÇÃO GATED de shouldNotifyByPrefs no envio FCM real.
 * Extrai as funções REAIS de functions/index.js (notifyResponsible/notifyChatMessage
 * + buildMessageData/buildChatData/chatPreview/dedupeTokensByDevice + notifFlag/notifDb/
 * getNotifPrefs/shouldNotifyByPrefs/writeNotifLog) e as roda com admin.firestore()+
 * admin.messaging() MOCKADOS (captura de sends/writes/log), provando:
 *   1-2) flags OFF => envia exatamente como antes (resp + chat);
 *   3) flag ON + sem prefs => envia; 4) flag ON + erro ao ler prefs => envia (fail-safe);
 *   5-6) flag ON + enabled=false => suprime task_assigned/event_assigned (+ dedup marcado);
 *   7) flag ON + enabled=false => suprime chat_message para AQUELE usuário;
 *   8) chat 3 participantes: suprime só quem optou; envia aos demais;
 *   9) evento crítico não é suprimido (fonte: triggers só emitem opcionais);
 *  10) reset de senha não passa por prefs (fonte); 11) dedup deviceId preservado;
 *  12-14) fcmTokens/fcmTokenMeta/clientPushSubs não alterados; 15) immediateNotifiedAt
 *  preservado/marcado; 16) erro em writeNotifLog não quebra; 17/18) log OFF/ON.
 * Puro/offline: NÃO require() o módulo (sem deps), NÃO toca produção, NÃO envia.
 * Rodar: /opt/node22/bin/node scripts/worker-ops/f33U-notif-send-prefs-integration.test.mjs
 * ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
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

const NAMES = ["dedupeTokensByDevice", "buildMessageData", "chatPreview", "buildChatData",
  "notifFlag", "notifDb", "getNotifPrefs", "shouldNotifyByPrefs", "writeNotifLog",
  "notifyResponsible", "notifyChatMessage"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

const PRELUDE = `
  var TTL_MS = 600000;
  var NOTIF_LOG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  var __store = {}; var __sends = []; var __writes = []; var __log = [];
  var __failPrefs = false, __failLog = false;
  function _docRef(p) { return {
    get: async function () {
      if (__failPrefs && p.indexOf("notifPrefs/") === 0) throw new Error("prefs get boom");
      var d = __store[p]; return { exists: !!d, data: function () { return d || null; } };
    },
    set: async function (data, opts) {
      __writes.push({ path: p, data: data });
      __store[p] = (opts && opts.merge && __store[p]) ? Object.assign({}, __store[p], data) : data;
      return {};
    },
    collection: function (sub) { return _colRef(p + "/" + sub); }
  }; }
  function _colRef(p) { return {
    doc: function (id) { return _docRef(p + "/" + id); },
    add: async function (o) {
      if (__failLog && p === "notifLog") throw new Error("log add boom");
      __writes.push({ path: p, op: "add", data: o }); if (p === "notifLog") __log.push(o); return { id: "x" };
    }
  }; }
  var admin = {
    firestore: function () { return { collection: function (c) { return _colRef(c); } }; },
    messaging: function () { return { sendEachForMulticast: async function (m) { __sends.push(m); return { successCount: (m.tokens || []).length }; } }; }
  };
  var logger = { info: function () {}, warn: function () {}, error: function () {} };
`;

const api = new Function(PRELUDE + BODY + `
  ; return {
    notifyResponsible: notifyResponsible, notifyChatMessage: notifyChatMessage,
    shouldNotifyByPrefs: shouldNotifyByPrefs,
    set: function (p, v) { __store[p] = v; }, del: function (p) { delete __store[p]; },
    sends: function () { return __sends; }, writes: function () { return __writes; }, log: function () { return __log; },
    failPrefs: function (v) { __failPrefs = !!v; }, failLog: function (v) { __failLog = !!v; },
    reset: function () { __sends.length = 0; __writes.length = 0; __log.length = 0; }
  };
`)();

const setFlags = (prefs, log) => {
  process.env.ENABLE_NOTIF_PREFS = prefs ? "true" : "false";
  process.env.ENABLE_NOTIF_LOG = log ? "true" : "false";
};
const meta = (t) => ({ [t]: { deviceId: "d-" + t, lastSeenAt: 1 } });
// usuários base
const seedUsers = () => {
  api.set("users/uDes", { name: "Des", fcmTokens: ["t1", "t2"], fcmTokenMeta: Object.assign(meta("t1"), { t2: { deviceId: "d-t2", lastSeenAt: 2 } }) });
  api.set("users/uSoc", { name: "Soc", fcmTokens: ["s1"], fcmTokenMeta: meta("s1") });
  api.set("users/uA", { name: "A", fcmTokens: ["a1"], fcmTokenMeta: meta("a1") });
  api.set("users/uB", { name: "B", fcmTokens: ["b1"], fcmTokenMeta: meta("b1") });
  api.set("users/uC", { name: "C", fcmTokens: ["c1"], fcmTokenMeta: meta("c1") });
};
const taskDoc = (over) => Object.assign({ src: "nativebeta", assigneeId: "uDes", by: "uSoc", title: "T", status: "afazer" }, over || {});
const evDoc = (over) => Object.assign({ src: "nativebeta", ownerId: "uDes", by: "uSoc", title: "E" }, over || {});

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

(async () => {
  /* ===== 0) PROVAS DE FONTE ===== */
  const NR = grab("notifyResponsible"), NC = grab("notifyChatMessage");
  ok("[src] notifyResponsible gateia SÓ com ENABLE_NOTIF_PREFS e evento opcional", /notifFlag\("ENABLE_NOTIF_PREFS"\)/.test(NR) && /task_assigned|event_assigned/.test(NR) && !/sla_overdue|sla_critical|security_reset/.test(NR));
  ok("[src] notifyChatMessage gateia por destinatário (rid) com chat_message", /shouldNotifyByPrefs\(rid, "chat_message"/.test(NC));
  ok("[src#9-13] reset de senha NÃO chama prefs (crítico/segurança fora)", (() => {
    const a = SRC.indexOf("exports.requestPasswordReset");
    const b = SRC.indexOf("F3.3.20-B1.1-A");   // região de reset = antes do track de notificações
    const region = SRC.slice(a, b > a ? b : undefined);
    return a > 0 && !/shouldNotifyByPrefs|writeNotifLog/.test(region);
  })());
  ok("[src#11] dedup deviceId preservado (dedupeTokensByDevice nos 2 envios)", (NR.match(/dedupeTokensByDevice/g) || []).length >= 1 && (NC.match(/dedupeTokensByDevice/g) || []).length >= 1);
  ok("[src#12-14] integração não escreve fcmTokens/fcmTokenMeta/clientPushSubs", !/fcmTokens\s*[:=]|fcmTokenMeta\s*[:=]|clientPushSubs/.test(NR.split("dedupeTokensByDevice")[1] || "") && !/clientPushSubs/.test(NR + NC));

  /* ===== 1) flags OFF => notifyResponsible envia como antes ===== */
  seedUsers(); setFlags(false, false); api.reset();
  await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("1 flags OFF: envia 1x com tokens dedupados (2)", api.sends().length === 1 && api.sends()[0].tokens.length === 2);
  ok("1b flags OFF: immediateNotifiedAt gravado com 'sent'", (api.writes().find((w) => w.path === "tasks/t1") || {}).data.immediateNotifyResult.indexOf("sent") === 0);
  ok("1c flags OFF: nenhum log gravado", api.log().length === 0);

  /* ===== 2) flags OFF => notifyChatMessage envia como antes ===== */
  api.set("chats/c1", { participants: ["uSoc", "uA", "uB"] }); api.reset();
  await api.notifyChatMessage("c1", "m1", { src: "nativebeta", by: "uSoc", text: "oi" });
  ok("2 flags OFF: chat envia aos 2 destinatários", api.sends().length === 2);

  /* ===== 3) flag ON + sem prefs => envia ===== */
  setFlags(true, false); api.reset();
  await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("3 flag ON + sem doc prefs => envia normal", api.sends().length === 1);

  /* ===== 4) flag ON + erro ao ler prefs => envia ===== */
  api.reset(); api.failPrefs(true);
  await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("4 flag ON + erro prefs => envia (fail-safe)", api.sends().length === 1);
  api.failPrefs(false);

  /* ===== 5-6) flag ON + enabled=false => suprime task/event ===== */
  api.set("notifPrefs/uDes", { enabled: false });
  api.reset(); await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("5 task_assigned suprimido (0 envios)", api.sends().length === 0);
  ok("5b suprimido marca immediateNotifiedAt='suprimido por prefs'", (api.writes().find((w) => w.path === "tasks/t1") || {}).data.immediateNotifyResult === "suprimido por prefs");
  api.reset(); await api.notifyResponsible("event", "events", "e1", evDoc());
  ok("6 event_assigned suprimido (0 envios)", api.sends().length === 0);

  /* ===== 7) chat suprime aquele usuário ===== */
  api.del("notifPrefs/uDes"); api.set("notifPrefs/uA", { enabled: false });
  api.set("chats/c2", { participants: ["uSoc", "uA"] }); api.reset();
  await api.notifyChatMessage("c2", "m2", { src: "nativebeta", by: "uSoc", text: "oi" });
  ok("7 chat_message suprimido p/ uA (0 envios; só uA era destinatário)", api.sends().length === 0);

  /* ===== 8) chat 3 participantes: suprime só uA, envia uB e uC ===== */
  api.set("chats/c3", { participants: ["uSoc", "uA", "uB", "uC"] }); api.reset();
  await api.notifyChatMessage("c3", "m3", { src: "nativebeta", by: "uSoc", text: "oi" });
  ok("8 envia a 2 (uB,uC), suprime uA", api.sends().length === 2);
  ok("8b tokens enviados são de uB e uC (não uA)", (() => { const toks = api.sends().flatMap((s) => s.tokens); return toks.indexOf("a1") < 0 && toks.indexOf("b1") >= 0 && toks.indexOf("c1") >= 0; })());
  api.del("notifPrefs/uA");

  /* ===== 15) immediateNotifiedAt sempre presente ===== */
  setFlags(false, false); api.reset();
  await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("15 immediateNotifiedAt presente no envio normal", typeof (api.writes().find((w) => w.path === "tasks/t1") || {}).data.immediateNotifiedAt === "number");

  /* ===== 16) erro em writeNotifLog não quebra envio ===== */
  setFlags(true, true); api.failLog(true); api.reset();
  let threw16 = false;
  try { await api.notifyResponsible("task", "tasks", "t1", taskDoc()); } catch (_) { threw16 = true; }
  ok("16 erro em writeNotifLog NÃO quebra; envio acontece", threw16 === false && api.sends().length === 1);
  api.failLog(false);

  /* ===== 17) log OFF => não grava ===== */
  setFlags(true, false); api.reset();
  await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("17 ENABLE_NOTIF_LOG=false => sem log", api.log().length === 0);

  /* ===== 18) log ON => grava no mock (após envio) ===== */
  setFlags(true, true); api.reset();
  await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("18 ENABLE_NOTIF_LOG=true => 1 log (enviado)", api.log().length === 1 && api.log()[0].eventType === "task_assigned" && api.log()[0].channel === "fcm");
  // log de supressão
  api.set("notifPrefs/uDes", { enabled: false }); api.reset();
  await api.notifyResponsible("task", "tasks", "t1", taskDoc());
  ok("18b log de supressão (sent:0, reason suppressed_by_prefs)", api.log().length === 1 && api.log()[0].sent === 0 && api.log()[0].reason === "suppressed_by_prefs");
  api.del("notifPrefs/uDes"); setFlags(false, false);

  console.log("\n========= F3.3.20-B1.4-B — integração gated (triggers reais) =========");
  console.log("  flags OFF => envio idêntico (resp + chat); log off");
  console.log("  flag ON: sem prefs/erro => envia; enabled=false => suprime opcional");
  console.log("  chat: supressão POR destinatário (demais recebem); dedup/immediateNotifiedAt preservados");
  console.log("  crítico/reset NÃO passam por prefs; writeNotifLog best-effort (não quebra)");
  console.log("=====================================================================\n");
  console.log("F3.3.20-B1.4-B notif-send-prefs-integration: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
