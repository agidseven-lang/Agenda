#!/usr/bin/env node
// scripts/worker-ops/f3361t1-firestore-users-create-update-close-rules-patch.test.mjs
//
// F3.3.61-T1 — Teste do patcher patch-firestore-users-create-update-close-rules.mjs.
// Sem rede, sem Firestore, sem deploy. Fixtures inline representativas do live ATUAL
// (pos read-close: /users read=false, create/update<60, delete=false). Exit 0 = todos
// passaram; Exit 1 = alguma falha.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PATCHER = new URL("./patch-firestore-users-create-update-close-rules.mjs", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL " + n); } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "f3361t1-"));
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
function usersBlock(txt) { const m = (txt || "").match(/match \/users\/\{id\} \{[\s\S]*?\n    \}/); return m ? m[0] : ""; }

// Fixture representativa do live ATUAL (pos F3.3.58 read-close + usersPublic):
// /users read:false + create/update<60 + delete:false; events read:true;
// usersPublic read:true/write:false; notifPrefs fechado; catch-all deny.
const LIVE = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{id} {
      allow read: if false;
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

// 1. aplica: exit0, status=patched, changedLines=2
{
  const r = run(LIVE);
  ok("1-aplica-exit0-status-patched", r.code === 0 && r.report && r.report.status === "patched" && r.report.changedLines === 2);
}
// 2. /users create+update viraram if false
{
  const r = run(LIVE);
  const ub = usersBlock(r.patched);
  ok("2-create-update-viraram-false",
    /allow create: if false;/.test(ub) && /allow update: if false;/.test(ub) &&
    !/allow create: if request\.resource\.data\.size\(\) < 60;/.test(ub) &&
    !/allow update: if request\.resource\.data\.size\(\) < 60;/.test(ub));
}
// 3. diff conceitual: exatamente 2 linhas mudaram (input tinha 2 `size() < 60` em /users, output 0)
{
  const r = run(LIVE);
  const inUsers = usersBlock(LIVE), outUsers = usersBlock(r.patched);
  const inCount = (inUsers.match(/if request\.resource\.data\.size\(\) < 60;/g) || []).length;
  const outCount = (outUsers.match(/if request\.resource\.data\.size\(\) < 60;/g) || []).length;
  ok("3-diff-conceitual-2-linhas", inCount === 2 && outCount === 0 && r.report.changedLines === 2);
}
// 4. /users read=false preservado
{
  const r = run(LIVE);
  ok("4-users-read-false-preservado", /allow read: if false;/.test(usersBlock(r.patched)));
}
// 5. /users delete=false preservado
{
  const r = run(LIVE);
  ok("5-users-delete-false-preservado", /allow delete: if false;/.test(usersBlock(r.patched)));
}
// 6. usersPublic read=true preservado
{
  const r = run(LIVE);
  ok("6-usersPublic-read-true", /match \/usersPublic\/\{uid\} \{\s*\n\s*allow read: if true;/.test(r.patched || ""));
}
// 7. usersPublic writes=false preservado (bloco intacto)
{
  const r = run(LIVE);
  ok("7-usersPublic-writes-false", /match \/usersPublic\/\{uid\} \{\s*\n\s*allow read: if true;\s*\n\s*allow create, update, delete: if false;\s*\n\s*\}/.test(r.patched || ""));
}
// 8. catch-all preservado
{
  const r = run(LIVE);
  ok("8-catch-all-preservado", /match \/\{document=\*\*\} \{\s*\n\s*allow read, write: if false;/.test(r.patched || ""));
}
// 9. idempotente: rodar sobre o output => already_closed e sem nova mudanca
{
  const r1 = run(LIVE);
  const r2 = run(r1.patched);
  ok("9-idempotente-already-closed", r2.code === 0 && r2.report && r2.report.status === "already_closed" && r2.report.changedLines === 0 && r2.patched === r1.patched);
}
// 10. falha se /users ausente
{
  const noUsers = LIVE.replace(/    match \/users\/\{id\} \{[\s\S]*?\n    \}\n/, "");
  const r = run(noUsers);
  ok("10-falha-sem-users", r.code !== 0);
}
// 11. pre-condicao: falha se /users read NAO for false (ex.: read: if true)
{
  const readOpen = LIVE.replace("      allow read: if false;\n      allow create:", "      allow read: if true;\n      allow create:");
  const r = run(readOpen);
  ok("11-falha-read-nao-false", r.code !== 0);
}
// 12. pre-condicao: falha se /users delete NAO for false (ex.: delete: if true)
{
  const delOpen = LIVE.replace("      allow update: if request.resource.data.size() < 60;\n      allow delete: if false;",
                               "      allow update: if request.resource.data.size() < 60;\n      allow delete: if true;");
  const r = run(delOpen);
  ok("12-falha-delete-nao-false", r.code !== 0);
}
// 13. falha se houver multiplos blocos /users
{
  const dup = LIVE.replace(
    "    match /events/{id} {",
    "    match /users/{id} {\n      allow read: if false;\n      allow create: if request.resource.data.size() < 60;\n      allow update: if request.resource.data.size() < 60;\n      allow delete: if false;\n    }\n    match /events/{id} {"
  );
  const r = run(dup);
  ok("13-falha-multiplos-users", r.code !== 0);
}
// 14. falha se create/update tiver formato inesperado/misto (ex.: create ja false, update <60)
{
  const mixed = LIVE.replace("      allow create: if request.resource.data.size() < 60;\n      allow update: if request.resource.data.size() < 60;",
                             "      allow create: if false;\n      allow update: if request.resource.data.size() < 60;");
  const r = run(mixed);
  ok("14-falha-estado-misto", r.code !== 0);
}
// 15. zero alteracao em colecoes nao relacionadas (events create<50 intacto)
{
  const r = run(LIVE);
  const ev = ((r.patched || "").match(/match \/events\/\{id\} \{[\s\S]*?\n    \}/) || [""])[0];
  ok("15-events-intacto",
    /allow read: if true;/.test(ev) &&
    /allow create: if request\.resource\.data\.size\(\) < 50;/.test(ev) &&
    /allow update: if request\.resource\.data\.size\(\) < 50;/.test(ev) &&
    /allow delete: if true;/.test(ev));
}
// 16. chaves balanceadas no output
{
  const r = run(LIVE);
  const p = r.patched || "";
  ok("16-chaves-balanceadas", (p.match(/\{/g) || []).length === (p.match(/\}/g) || []).length);
}
// 17. idempotencia real: rules ja com create/update=false => already_closed, byte-identico
{
  const closed = LIVE
    .replace("      allow create: if request.resource.data.size() < 60;", "      allow create: if false;")
    .replace("      allow update: if request.resource.data.size() < 60;", "      allow update: if false;");
  const r = run(closed);
  ok("17-already-closed-byte-identico", r.code === 0 && r.report.status === "already_closed" && r.patched === closed);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n==== F3.3.61-T1 PATCHER TEST ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail === 0 ? 0 : 1);
