#!/usr/bin/env node
// scripts/worker-ops/f33B-firestore-users-read-close-rules-patch.test.mjs
//
// F3.3.58-B — Teste do patcher patch-firestore-users-read-close-rules.mjs.
// Sem rede, sem Firestore, sem deploy. Fixtures inline representativas do live.
// Exit 0 = todos passaram; Exit 1 = alguma falha.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PATCHER = new URL("./patch-firestore-users-read-close-rules.mjs", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "f33b-"));
function run(src) {
  const i = path.join(tmp, "in.rules"), o = path.join(tmp, "out.rules"), r = path.join(tmp, "rep.json");
  try { fs.rmSync(o); } catch (_) {} try { fs.rmSync(r); } catch (_) {}
  fs.writeFileSync(i, src);
  let code = 0, stdout = "";
  try { stdout = execFileSync("node", [PATCHER, i, o, r], { encoding: "utf8" }); }
  catch (e) { code = e.status || 1; stdout = (e.stdout || "") + (e.stderr || ""); }
  const patched = fs.existsSync(o) ? fs.readFileSync(o, "utf8") : null;
  const report = fs.existsSync(r) ? JSON.parse(fs.readFileSync(r, "utf8")) : null;
  return { code, stdout, patched, report };
}

// Fixture representativa do live: /users read:true + create/update<60 + delete:false,
// events read:true, usersPublic read:true/write:false, notifPrefs fechado, catch-all deny.
const LIVE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{id} {
      allow read: if true;
      allow create: if request.resource.data.size() < 60;
      allow update: if request.resource.data.size() < 60;
      allow delete: if false;
    }
    match /events/{id} {
      allow read: if true;
      allow create: if request.resource.data.size() < 50;
      allow update: if request.resource.data.size() < 50;
      allow delete: if true;
    }
    match /usersPublic/{uid} {
      allow read: if true;
      allow create, update, delete: if false;
    }
    match /notifPrefs/{uid} {
      allow read: if false;
      allow write: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
`;

// 1. aplica em Rules com allow read true
{
  const r = run(LIVE);
  ok("1-aplica-exit0-status-patched", r.code === 0 && r.report && r.report.status === "patched" && r.report.changedLines === 1);
  const usersBlock = (r.patched || "").match(/match \/users\/\{id\} \{[\s\S]*?\n    \}/);
  ok("2-users-read-virou-false", !!usersBlock && /allow read: if false;/.test(usersBlock[0]) && !/allow read: if true;/.test(usersBlock[0]));
}
// 2. muda EXATAMENTE uma ocorrencia: input tem 3 `read: if true` (users,events,usersPublic) -> output 2
{
  const r = run(LIVE);
  const truesIn = (LIVE.match(/allow read: if true;/g) || []).length;
  const truesOut = ((r.patched || "").match(/allow read: if true;/g) || []).length;
  ok("3-uma-unica-ocorrencia-mudou", truesIn === 3 && truesOut === 2);
}
// 3. usersPublic intacto
{
  const r = run(LIVE);
  ok("4-usersPublic-intacto", /match \/usersPublic\/\{uid\} \{\s*\n\s*allow read: if true;\s*\n\s*allow create, update, delete: if false;\s*\n\s*\}/.test(r.patched || ""));
}
// 4. create/update/delete de /users preservados
{
  const r = run(LIVE);
  const ub = ((r.patched || "").match(/match \/users\/\{id\} \{[\s\S]*?\n    \}/) || [""])[0];
  ok("5-users-writes-preservados",
    /allow create: if request\.resource\.data\.size\(\) < 60;/.test(ub) &&
    /allow update: if request\.resource\.data\.size\(\) < 60;/.test(ub) &&
    /allow delete: if false;/.test(ub));
}
// 5. catch-all preservado
{
  const r = run(LIVE);
  ok("6-catch-all-preservado", /match \/\{document=\*\*\} \{\s*\n\s*allow read, write: if false;/.test(r.patched || ""));
}
// 6. idempotente: rodar sobre o output => already_closed e sem nova mudanca
{
  const r1 = run(LIVE);
  const r2 = run(r1.patched);
  ok("7-idempotente-already-closed", r2.code === 0 && r2.report && r2.report.status === "already_closed" && r2.report.changedLines === 0 && r2.patched === r1.patched);
}
// 7. falha se /users ausente
{
  const noUsers = LIVE.replace(/    match \/users\/\{id\} \{[\s\S]*?\n    \}\n/, "");
  const r = run(noUsers);
  ok("8-falha-sem-users", r.code !== 0 && !/allow read/.test(String(r.report)));
}
// 8. falha se houver multiplos blocos /users
{
  const dup = LIVE.replace(
    "    match /events/{id} {",
    "    match /users/{id} {\n      allow read: if true;\n      allow delete: if false;\n    }\n    match /events/{id} {"
  );
  const r = run(dup);
  ok("9-falha-multiplos-users", r.code !== 0);
}
// 9. falha se allow read tiver formato inesperado
{
  const weird = LIVE.replace("    match /users/{id} {\n      allow read: if true;", "    match /users/{id} {\n      allow read: if signedIn();");
  const r = run(weird);
  ok("10-falha-formato-inesperado", r.code !== 0);
}
// 10. chaves balanceadas no output
{
  const r = run(LIVE);
  const p = r.patched || "";
  ok("11-chaves-balanceadas", (p.match(/\{/g) || []).length === (p.match(/\}/g) || []).length);
}
// extra: outros `allow read: if true` (events/usersPublic) permanecem true (patch escopado)
{
  const r = run(LIVE);
  const ev = ((r.patched || "").match(/match \/events\/\{id\} \{[\s\S]*?\n    \}/) || [""])[0];
  ok("12-events-read-continua-true", /allow read: if true;/.test(ev));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n==== F3.3.58-B PATCHER TEST ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail === 0 ? 0 : 1);
