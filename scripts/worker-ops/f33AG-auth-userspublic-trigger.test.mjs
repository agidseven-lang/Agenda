#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — SLICE 2: trigger syncUsersPublic (sincroniza usersPublic).
 * Extrai a logica REAL de functions/index.js (handleSyncUsersPublic +
 * projectUserPublicOut) e roda com admin.firestore() MOCKADO via deps (sem Firestore
 * real, sem secret, sem usuario real). Prova:
 *   - CREATE/UPDATE => set COMPLETO da projecao allowlist em usersPublic/{uid} (sem
 *     merge; sem PII/credenciais/extras); DELETE => delete usersPublic/{uid};
 *   - so toca usersPublic/{uid} (path correto = event.params.uid);
 *   - negativos de PII no payload; erro em set/delete e RELANCADO (retry) com log
 *     mascarado; nada de Firestore real.
 *   + provas de fonte (onDocumentWritten/users/{uid}; set sem merge; sem backfill).
 * Puro/offline: NAO require() o modulo; NAO toca producao; NAO deploya.
 * Rodar: node scripts/worker-ops/f33AG-auth-userspublic-trigger.test.mjs
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

const BODY = grab("handleSyncUsersPublic") + "\n" + grab("projectUserPublicOut") + "\n";
const make = new Function(BODY + "; return { handleSyncUsersPublic, projectUserPublicOut };");
const api = make();

const ALLOW = ["admin", "color", "id", "name", "photo", "role", "status"];
let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

function mkDb(opts) {
  opts = opts || {}; const calls = [];
  return { calls, collection: (c) => ({ doc: (id) => ({
    set: async (data) => { calls.push({ op: "set", coll: c, id, data }); if (opts.failSet) throw new Error("set-failed"); return {}; },
    delete: async () => { calls.push({ op: "delete", coll: c, id }); if (opts.failDelete) throw new Error("del-failed"); return {}; },
  }) }) };
}
function mkLogger() { const logs = []; return { logs, info: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) }; }
const maskUid = (u) => { const s = String(u || ""); return s ? s.slice(0, 3) + "…" : "(vazio)"; };
const evWrite = (uid, data) => ({ params: { uid }, data: { before: { exists: false }, after: { exists: true, data: () => data } } });
const evDelete = (uid) => ({ params: { uid }, data: { before: { exists: true, data: () => ({}) }, after: { exists: false } } });
const evDeleteNoAfter = (uid) => ({ params: { uid }, data: { before: { exists: true } } });

const DIRTY = { name: "Bob", role: "gestor", admin: true, status: "ativo", photo: "ph", color: "#0f0",
  pass: "s2:deadbeef", salt: "SALT123", phone: "11 90000-1111", email: "bob@idseven.test",
  fcmTokens: ["TK1"], fcmTokenMeta: { a: 1 }, token: "tok", resetCode: "rc", secret: "sec", extra: "X", createdAt: 1 };

(async () => {
  /* ===== PROVAS DE FONTE ===== */
  const H = grab("handleSyncUsersPublic");
  const WRAP = SRC.slice(SRC.indexOf("exports.syncUsersPublic = onDocumentWritten"), SRC.indexOf("exports._handleSyncUsersPublic"));
  ok("2 syncUsersPublic export real (onDocumentWritten users/{uid})", /exports\.syncUsersPublic = onDocumentWritten\(\{ document: "users\/\{uid\}"/.test(WRAP));
  ok("[src] set COMPLETO 1-arg (sem opcao merge:)", /\.set\(projectUserPublicOut\(uid, data\)\)/.test(H) && !/merge\s*:/.test(H));
  ok("[src] delete na ausencia de after", /\.delete\(\)/.test(H));
  ok("[src] so toca usersPublic (sem users/notifPrefs/fcmTokens)", /collection\("usersPublic"\)/.test(H) && !/collection\("users"\)|collection\("notifPrefs"\)|fcmTokens/.test(H));
  ok("[src] relanca erro (throw e)", /throw e;/.test(H));
  ok("[src] sem backfill (sem .get\\(\\) de colecao / loop users)", !/collection\("users"\)\.get\(\)|forEach/.test(H));

  /* ===== 1,3) existencia ===== */
  ok("1 handleSyncUsersPublic existe", typeof api.handleSyncUsersPublic === "function");
  ok("3 projectUserPublicOut existe", typeof api.projectUserPublicOut === "function");

  /* ===== 4) CREATE ===== */
  let db = mkDb(), lg = mkLogger();
  const rC = await api.handleSyncUsersPublic(evWrite("uB", DIRTY), { db, logger: lg, maskUid });
  const setCall = db.calls.find((c) => c.op === "set");
  ok("4a CREATE chama set 1x em usersPublic/uB", db.calls.length === 1 && setCall && setCall.coll === "usersPublic" && setCall.id === "uB");
  ok("4b payload tem EXATAMENTE 7 campos", setCall && JSON.stringify(Object.keys(setCall.data).sort()) === JSON.stringify(ALLOW));
  ok("4c CREATE nao chama delete", !db.calls.some((c) => c.op === "delete"));
  ok("4d op=set", rC && rC.op === "set");

  /* ===== 5) UPDATE (set completo; sem merge; sem chaves antigas) ===== */
  db = mkDb();
  await api.handleSyncUsersPublic(evWrite("uB", DIRTY), { db, logger: mkLogger(), maskUid });
  const upd = db.calls[0];
  ok("5 UPDATE set completo (so allowlist; sem pass/salt/phone/email/fcmTokens)",
    upd.op === "set" && !("pass" in upd.data) && !("salt" in upd.data) && !("phone" in upd.data) && !("email" in upd.data) && !("fcmTokens" in upd.data) && !("extra" in upd.data));

  /* ===== 6) DELETE (after.exists=false e after ausente) ===== */
  db = mkDb();
  const rD = await api.handleSyncUsersPublic(evDelete("uB"), { db, logger: mkLogger(), maskUid });
  ok("6a DELETE chama delete 1x; sem set", db.calls.length === 1 && db.calls[0].op === "delete" && db.calls[0].coll === "usersPublic" && db.calls[0].id === "uB" && rD.op === "delete");
  db = mkDb();
  await api.handleSyncUsersPublic(evDeleteNoAfter("uC"), { db, logger: mkLogger(), maskUid });
  ok("6b after ausente => delete", db.calls.length === 1 && db.calls[0].op === "delete" && db.calls[0].id === "uC");

  /* ===== 7) UID/path ===== */
  db = mkDb();
  await api.handleSyncUsersPublic(evWrite("uX", DIRTY), { db, logger: mkLogger(), maskUid });
  ok("7 escreve exatamente usersPublic/{event.params.uid}", db.calls[0].coll === "usersPublic" && db.calls[0].id === "uX");

  /* ===== 8-9) negativos de PII no payload ===== */
  const pl = setCall.data; const pls = JSON.stringify(pl);
  ok("8 payload sem pass/salt/phone/email/fcmTokens/fcmTokenMeta/token/secret/extras",
    ["pass", "salt", "phone", "email", "fcmTokens", "fcmTokenMeta", "token", "secret", "extra", "resetCode", "createdAt"].every((k) => !(k in pl)));
  ok("9 JSON do payload sem PII/cred",
    ["s2:deadbeef", "SALT123", "90000-1111", "bob@idseven.test", "TK1", "fcmTokenMeta", "\"token\"", "\"secret\""].every((x) => pls.indexOf(x) < 0));

  /* ===== 10-11) erro relancado + log sem PII ===== */
  let threwSet = false; const lgS = mkLogger();
  try { await api.handleSyncUsersPublic(evWrite("uB", DIRTY), { db: mkDb({ failSet: true }), logger: lgS, maskUid }); }
  catch (_) { threwSet = true; }
  ok("10a erro em set e RELANCADO", threwSet === true);
  ok("10b log do set sem PII (uid mascarado)", JSON.stringify(lgS.logs).indexOf("bob@idseven.test") < 0 && JSON.stringify(lgS.logs).indexOf("90000-1111") < 0);
  let threwDel = false; const lgD = mkLogger();
  try { await api.handleSyncUsersPublic(evDelete("uB"), { db: mkDb({ failDelete: true }), logger: lgD, maskUid }); }
  catch (_) { threwDel = true; }
  ok("11a erro em delete e RELANCADO", threwDel === true);
  ok("11b log do delete sem doc/PII", JSON.stringify(lgD.logs).indexOf("bob@idseven.test") < 0);

  /* ===== 12-13) sem Firestore real / sem backfill (fonte) ===== */
  ok("12 sem credentials/GOOGLE_APPLICATION_CREDENTIALS no teste/handler", !/GOOGLE_APPLICATION_CREDENTIALS|applicationDefault|cert\(/.test(SRC.slice(SRC.indexOf("function handleSyncUsersPublic"))) );
  ok("13 sem loop/backfill na trigger", !/for\s*\(|while\s*\(|\.get\(\)/.test(H));

  console.log("\n========= F3.3.20-B1.7-E — syncUsersPublic trigger (mock) =========");
  console.log("  onDocumentWritten(users/{uid}); CREATE/UPDATE set completo allowlist; DELETE remove");
  console.log("  so usersPublic/{uid}; sem PII/credenciais; erro relancado; log mascarado; sem Firestore real");
  console.log("===================================================================");
  console.log("F3.3.20-B1.7-E auth-userspublic-trigger: " + pass + " OK, " + fail + " FAIL");
  if (fail) { console.log(flog.join("\n")); process.exit(1); }
})().catch((e) => { console.error("ERRO HARNESS:", e && e.stack || e); process.exit(1); });
