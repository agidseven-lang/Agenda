#!/usr/bin/env node
/* =====================================================================
 * F3.3.20-B1.7-E — SLICE 2: projecao publica segura (projectUserPublicOut).
 * Extrai a logica REAL de functions/index.js (projectUserPublicOut + authUserPublicOut)
 * e roda em sandbox (sem Firestore, sem secret, sem usuario real). Prova:
 *   - saida com EXATAMENTE 7 chaves {id,name,role,admin,status,photo,color};
 *   - normalizacao (id String; strings ausentes/nao-string viram ""; admin===true);
 *   - NEGATIVOS de PII/credenciais: doc com pass/salt/phone/email/fcmTokens/
 *     fcmTokenMeta/tokens/reset/secrets/extras => saida NAO os contem;
 *   - shape-equality com authUserPublicOut (mesmas chaves e valores);
 *   - provas de fonte: authUserPublicOut/loginUser/getUserContact preservados;
 *     syncUsersPublic/onDocumentWritten ausentes; helper sem Firestore/secret/spread.
 * Puro/offline: NAO require() o modulo; NAO toca producao; NAO deploya.
 * Rodar: node scripts/worker-ops/f33AF-auth-userspublic-projection.test.mjs
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

const BODY = grab("projectUserPublicOut") + "\n" + grab("authUserPublicOut") + "\n";
const make = new Function(BODY + "; return { projectUserPublicOut, authUserPublicOut };");
const api = make();
const proj = api.projectUserPublicOut;

const ALLOW = ["admin", "color", "id", "name", "photo", "role", "status"]; // sorted
let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

/* ===== PROVAS DE FONTE ===== */
const H = grab("projectUserPublicOut");
ok("[src] helper sem spread / sem doc cru", !/\.\.\.|Object\.assign/.test(H));
ok("[src] helper sem Firestore", !/notifDb|admin\.firestore|collection\(|\.set\(|\.add\(/.test(H));
ok("[src] helper sem secret/value", !/\.value\(\)|authSessionSecret|SECRET/.test(H));
ok("[src] helper sem PII/cred no corpo", !/phone|email|pass|salt|fcmTokens|fcmTokenMeta|token|secret/i.test(H));
ok("[src] export _projectUserPublicOut", /exports\._projectUserPublicOut = projectUserPublicOut/.test(SRC));
ok("[src] NAO e CloudFunction (sem onRequest/onCall/onDocument no helper)", !/onRequest|onCall|onDocument/.test(H));
ok("[src#18] authUserPublicOut preservado", /function authUserPublicOut\(/.test(SRC));
ok("[src#19] loginUser preservado", /exports\.loginUser = onRequest/.test(SRC));
ok("[src#20] getUserContact preservado", /exports\.getUserContact = onRequest/.test(SRC));
ok("[src#21] syncUsersPublic ausente (sem export/trigger)", !/exports\.syncUsersPublic/.test(SRC) && !/onDocumentWritten/.test(SRC));

/* ===== 1) 7 chaves exatas ===== */
const r1 = proj("u1", { name: "Alice", role: "designer", admin: false, status: "ativo", photo: "p", color: "#f00" });
ok("1 saida com EXATAMENTE 7 chaves", JSON.stringify(Object.keys(r1).sort()) === JSON.stringify(ALLOW));

/* ===== 2) doc valido projeta certo ===== */
ok("2 projeta valores corretos", r1.id === "u1" && r1.name === "Alice" && r1.role === "designer" && r1.admin === false && r1.status === "ativo" && r1.photo === "p" && r1.color === "#f00");

/* ===== 3) id numerico => string ===== */
ok("3 id numerico vira string", proj(123, {}).id === "123");

/* ===== 4) data invalido => defaults ===== */
for (const bad of [null, undefined, [], "str", 42]) {
  const r = proj("x", bad);
  if (!(JSON.stringify(Object.keys(r).sort()) === JSON.stringify(ALLOW) && r.id === "x" && r.name === "" && r.admin === false)) { ok("4 data invalido (" + JSON.stringify(bad) + ") => defaults", false); }
}
ok("4 data null/undefined/array/string/number => defaults seguros", true);

/* ===== 5) campos nao-string => "" ===== */
const r5 = proj("u", { name: 123, role: {}, status: [], photo: null, color: true });
ok("5 nao-string => \"\"", r5.name === "" && r5.role === "" && r5.status === "" && r5.photo === "" && r5.color === "");

/* ===== 6-7) admin boolean ===== */
ok("6 admin===true => true", proj("u", { admin: true }).admin === true);
ok("7 admin false/undef/'true'/1/null => false", [false, undefined, "true", 1, null].every((v) => proj("u", { admin: v }).admin === false));

/* ===== 8-15) NEGATIVOS: doc com PII/cred/extras => saida limpa ===== */
const dirty = { name: "Bob", role: "gestor", admin: true, status: "ativo", photo: "ph", color: "#0f0",
  pass: "s2:deadbeef", salt: "SALT123", phone: "11 90000-1111", email: "bob@idseven.test",
  fcmTokens: ["TK1", "TK2"], fcmTokenMeta: { a: 1 }, token: "tok", resetCode: "rc", secret: "sec", extra: "X", createdAt: 1, updatedAt: 2 };
const rd = proj("uB", dirty);
ok("8 sem pass", !("pass" in rd));
ok("9 sem salt", !("salt" in rd));
ok("10 sem phone", !("phone" in rd));
ok("11 sem email", !("email" in rd));
ok("12 sem fcmTokens", !("fcmTokens" in rd));
ok("13 sem fcmTokenMeta", !("fcmTokenMeta" in rd));
ok("14 sem token/resetCode/secret", !("token" in rd) && !("resetCode" in rd) && !("secret" in rd));
ok("15 sem extras (extra/createdAt/updatedAt)", !("extra" in rd) && !("createdAt" in rd) && !("updatedAt" in rd) && JSON.stringify(Object.keys(rd).sort()) === JSON.stringify(ALLOW));

/* ===== 16) JSON.stringify sem PII/cred ===== */
const s = JSON.stringify(rd);
ok("16 JSON sem pass/salt/phone/email/fcmTokens/fcmTokenMeta/token/secret",
  ["s2:deadbeef", "SALT123", "90000-1111", "bob@idseven.test", "TK1", "fcmTokenMeta", '"token"', '"secret"'].every((x) => s.indexOf(x) < 0));

/* ===== 17) shape-equality com authUserPublicOut ===== */
const sample = { name: "Carol", role: "social media", admin: true, status: "ativo", photo: "ph2", color: "#00f",
  pass: "x", salt: "y", phone: "z", email: "w", fcmTokens: ["t"], extra: 1 };
const a = api.authUserPublicOut("uC", sample);
const b = proj("uC", sample);
ok("17 shape-equality (mesmas chaves) com authUserPublicOut", JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort()));
ok("17b shape-equality (mesmos valores) com authUserPublicOut", JSON.stringify(a) === JSON.stringify(b));

console.log("\n========= F3.3.20-B1.7-E — usersPublic projection helper =========");
console.log("  allowlist {id,name,role,admin,status,photo,color}; sem PII/credenciais/extras/spread");
console.log("  negativos pass/salt/phone/email/fcmTokens; shape-equality com authUserPublicOut");
console.log("  syncUsersPublic/onDocumentWritten ausentes; loginUser/getUserContact preservados");
console.log("==================================================================");
console.log("F3.3.20-B1.7-E auth-userspublic-projection: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.log(flog.join("\n")); process.exit(1); }
