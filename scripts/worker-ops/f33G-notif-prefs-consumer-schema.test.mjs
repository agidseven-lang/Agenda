#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E-SCHEMA-FIX — Harness do consumer shouldNotifyByPrefs apos a
 * correcao do mismatch. Extrai a logica REAL de functions/index.js (notifFlag/
 * notifDb/getNotifPrefs/shouldNotifyByPrefs) e a roda com admin.firestore()
 * MOCKADO (sem Firestore real, sem segredo, sem rede, sem deploy). Prova que o
 * consumer agora le o SCHEMA CANONICO do writer (enabled/byEvent/byPlatform) +
 * fallback legacy (mutedEvents/platforms), com defaults permissivos e quietHours
 * NAO aplicado nesta fase. eventTypes reais: task_assigned/event_assigned/
 * chat_message; platform real: android.
 * Puro/offline: NAO require() o modulo. Rodar:
 *   node scripts/worker-ops/f33G-notif-prefs-consumer-schema.test.mjs
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

const NAMES = ["notifFlag", "notifDb", "getNotifPrefs", "shouldNotifyByPrefs"];
let BODY = ""; for (const n of NAMES) BODY += grab(n) + "\n";

// Mock admin.firestore(): store por colecao + modo de erro de leitura (get).
const PRELUDE = `
  var __store = {}; var __failGet = false;
  function _col(c) { return {
    doc: function (id) { return {
      get: async function () {
        if (__failGet) throw new Error("get boom");
        var d = (__store[c] || {})[id];
        return { exists: !!d, data: function () { return d || null; } };
      }
    }; }
  }; }
  var admin = { firestore: function () { return { collection: _col }; } };
  var logger = { warn: function () {}, info: function () {}, error: function () {} };
`;

const make = new Function(PRELUDE + BODY + `
  ; return {
    shouldNotifyByPrefs: shouldNotifyByPrefs,
    _seed: function (uid, doc) { if (!__store.notifPrefs) __store.notifPrefs = {}; __store.notifPrefs[uid] = doc; },
    _failGet: function (v) { __failGet = !!v; },
    _reset: function () { __store = {}; __failGet = false; }
  };
`);
const api = make();

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };
const S = (uid, ev, plat) => api.shouldNotifyByPrefs(uid, ev, plat);

(async () => {
  process.env.ENABLE_NOTIF_PREFS = "true"; // consumer ativo (flag ON) p/ exercitar a decisao

  /* 1) sem doc => notifica */
  ok("1 sem doc => true", (await S("uNone", "task_assigned", "android")) === true);

  /* 2) erro de leitura => notifica (fail-safe) */
  api._failGet(true);
  ok("2 erro de leitura => true", (await S("uErr", "task_assigned", "android")) === true);
  api._failGet(false);

  /* 3-4) enabled global */
  api._seed("uDis", { enabled: false });
  ok("3 enabled:false => false (suprime tudo)", (await S("uDis", "task_assigned", "android")) === false);
  api._seed("uEn", { enabled: true });
  ok("4 enabled:true sem granular => true", (await S("uEn", "task_assigned", "android")) === true);

  /* 5-7) byEvent (schema canonico) */
  api._seed("uBE0", { enabled: true, byEvent: { task_assigned: false } });
  ok("5 byEvent.task_assigned=false => false", (await S("uBE0", "task_assigned", "android")) === false);
  api._seed("uBE1", { enabled: true, byEvent: { task_assigned: true } });
  ok("6 byEvent.task_assigned=true => true", (await S("uBE1", "task_assigned", "android")) === true);
  api._seed("uBEo", { enabled: true, byEvent: { event_assigned: false } });
  ok("7a byEvent de outro evento NAO bloqueia task_assigned => true", (await S("uBEo", "task_assigned", "android")) === true);
  ok("7b byEvent.event_assigned=false bloqueia event_assigned => false", (await S("uBEo", "event_assigned", "android")) === false);

  /* 8-10) byPlatform (schema canonico) */
  api._seed("uBP0", { enabled: true, byPlatform: { android: false } });
  ok("8 byPlatform.android=false => false", (await S("uBP0", "task_assigned", "android")) === false);
  api._seed("uBP1", { enabled: true, byPlatform: { android: true } });
  ok("9 byPlatform.android=true => true", (await S("uBP1", "task_assigned", "android")) === true);
  api._seed("uBPo", { enabled: true, byPlatform: { web: false } });
  ok("10 byPlatform de outra plataforma NAO bloqueia android => true", (await S("uBPo", "task_assigned", "android")) === true);

  /* 11-14) fallback legacy mutedEvents/platforms */
  api._seed("uLE1", { enabled: true, mutedEvents: { task_assigned: true } });
  ok("11 legacy mutedEvents.task_assigned=true => false", (await S("uLE1", "task_assigned", "android")) === false);
  api._seed("uLE0", { enabled: true, mutedEvents: { task_assigned: false } });
  ok("12 legacy mutedEvents.task_assigned=false => true", (await S("uLE0", "task_assigned", "android")) === true);
  api._seed("uLP0", { enabled: true, platforms: { android: false } });
  ok("13 legacy platforms.android=false => false", (await S("uLP0", "task_assigned", "android")) === false);
  api._seed("uLP1", { enabled: true, platforms: { android: true } });
  ok("14 legacy platforms.android=true => true", (await S("uLP1", "task_assigned", "android")) === true);

  /* 15-16) canonico tem efeito mesmo SEM campos legacy presentes */
  api._seed("uBEc", { byEvent: { chat_message: false } });
  ok("15 byEvent.chat_message=false (sem legacy) => false", (await S("uBEc", "chat_message", "android")) === false);
  api._seed("uBPc", { byPlatform: { android: false } });
  ok("16 byPlatform.android=false (sem legacy) => false", (await S("uBPc", "event_assigned", "android")) === false);

  /* 17) quietHours presente NAO e aplicado nesta fase (permissivo) */
  api._seed("uQH", { enabled: true, quietHours: { start: "00:00", end: "23:59" } });
  ok("17 quietHours presente NAO suprime nesta fase => true", (await S("uQH", "task_assigned", "android")) === true);

  /* 18-19) campo desconhecido / doc vazio => permissivo */
  api._seed("uUnk", { foo: "bar", baz: 1 });
  ok("18 campo desconhecido nao suprime => true", (await S("uUnk", "task_assigned", "android")) === true);
  api._seed("uEmpty", {});
  ok("19 doc vazio (default permissivo) => true", (await S("uEmpty", "task_assigned", "android")) === true);

  /* 20) os 3 eventTypes reais (mute por byEvent) + limpo */
  api._seed("u3mute", { enabled: true, byEvent: { task_assigned: false, event_assigned: false, chat_message: false } });
  ok("20a task_assigned mutado => false", (await S("u3mute", "task_assigned", "android")) === false);
  ok("20b event_assigned mutado => false", (await S("u3mute", "event_assigned", "android")) === false);
  ok("20c chat_message mutado => false", (await S("u3mute", "chat_message", "android")) === false);
  api._seed("u3ok", { enabled: true });
  ok("20d limpo: task_assigned => true", (await S("u3ok", "task_assigned", "android")) === true);
  ok("20e limpo: event_assigned => true", (await S("u3ok", "event_assigned", "android")) === true);
  ok("20f limpo: chat_message => true", (await S("u3ok", "chat_message", "android")) === true);

  /* 21) enabled:false vence byEvent:true (curto-circuito global) */
  api._seed("uMix", { enabled: false, byEvent: { task_assigned: true } });
  ok("21 enabled:false vence byEvent:true => false", (await S("uMix", "task_assigned", "android")) === false);

  /* 22) flag OFF: comportamento atual preservado (nunca suprime, mesmo enabled:false) */
  process.env.ENABLE_NOTIF_PREFS = "false";
  api._seed("uOff", { enabled: false, byEvent: { task_assigned: false } });
  ok("22 flag OFF => true mesmo com enabled:false/byEvent:false", (await S("uOff", "task_assigned", "android")) === true);
  process.env.ENABLE_NOTIF_PREFS = "true";

  console.log("\n===== F3.3.20-B1.7-E-SCHEMA-FIX — consumer shouldNotifyByPrefs (schema canonico + legacy) =====");
  console.log("  enabled/byEvent/byPlatform (writer) + fallback mutedEvents/platforms (legacy)");
  console.log("  quietHours NAO aplicado (fase TZ futura) · defaults permissivos · flag OFF preserva");
  console.log("===============================================================================\n");
  console.log("F3.3.20-B1.7-E consumer-schema: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})();
