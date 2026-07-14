#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C3A — Teste HERMÉTICO do onEventDeleted (exclusão definitiva).
   Prova (texto/fonte) que o hard delete dispara fan-out "excluiu definitivamente"
   aos autorizados (menos o autor), com payload SEGURO (SEM eventId/deepLink — o doc
   não existe mais), ator vindo de before.deletedBy, gate de src e logs sem token.
   Preserva onEventCreated/onEventUpdated/dedup/lifecycle/chat/allowlist.
   NÃO chama Firebase, NÃO rede, NÃO deploya, NÃO escreve.
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73I6C3A — onEventDeleted (exclusão definitiva; hermético)");

/* ── A: trigger ── */
ok("A1 onEventDeleted criado (onDocumentDeleted events)",
  /exports\.onEventDeleted = onDocumentDeleted\("events\/\{eventId\}"/.test(SRC));
ok("A2 usa snapshot ANTES do delete (event.data.data())",
  /const before = event\.data \? event\.data\.data\(\) : null;/.test(SRC) && /broadcastEventDeleted\(event\.params\.eventId, before\)/.test(SRC));
ok("A3 onDocumentDeleted importado", /onDocumentCreated, onDocumentUpdated, onDocumentDeleted, onDocumentWritten/.test(SRC));

/* ── B: fan-out seguro ── */
const B = SRC.slice(SRC.indexOf("async function broadcastEventDeleted"), SRC.indexOf("exports.onEventDeleted"));
ok("B0 broadcastEventDeleted extraído", B.length > 200);
ok("B1 ator vem de before.deletedBy (onDocumentDeleted não traz quem apagou)",
  /const actorId = String\(\(doc && doc\.deletedBy\) \|\| ""\);/.test(B));
ok("B2 fan-out aos autorizados MENOS o autor",
  /const audience = users\.filter\(\(u\) => u\.id && u\.id !== actorId\);/.test(B));
ok("B3 destinatários de usersPublic ativos (exclui removido/inativo/teste/canário)",
  /listActiveUsersPublic\(db\)/.test(B));
ok("B4 tokens server-side (users/{id}.fcmTokens)", /gatherFcmTokens\(db, audience\.map/.test(B));
ok("B5 gate de fonte (só nativebeta|webpreview)",
  /const allow = NOTIFY_SRC_ALLOW\.event;[\s\S]{0,80}allow\.has\(doc && doc\.src\)/.test(B));

/* ── C: payload SEGURO (sem deep-link quebrado) ── */
ok("C1 action:'deleted'", /action: "deleted",/.test(B));
ok("C2 SEM eventId (doc removido)", /eventId: "",/.test(B));
ok("C3 SEM propriedade deepLink no payload de exclusão (não abre event:<id> inexistente)", !/deepLink:/.test(B));
ok("C4 body com ator + ação + detalhe", /excluiu definitivamente o compromisso: " \+ detail/.test(B));
ok("C5 payload traz actorName/actorPhoto/title/client/date/start/status:deleted",
  /actorName: actorName,/.test(B) && /actorPhoto: String\(actor\.photo/.test(B) && /status: "deleted",/.test(B) &&
  /title: title,/.test(B) && /client: client,/.test(B) && /date: date,/.test(B) && /start: start,/.test(B));

/* ── D: sem dedup-em-doc-removido; sem loop; sem throw ── */
ok("D1 NÃO grava dedup no doc removido (sem runTransaction/set no fluxo de delete)",
  !/runTransaction/.test(B) && !/\.set\(/.test(B));
ok("D2 onEventDeleted não relança (catch loga; entrega efetivamente-única)",
  /logger\.error\("\[FANOUT\] onEventDeleted falhou:", e && e\.message\)/.test(SRC));

/* ── E: segurança — logs sem valor de token/secret ── */
const loggerCalls = (B.match(/logger\.[a-z]+\([^;]*\)/gi) || []).join("\n");
ok("E1 logs do delete só contagem (sem valor de token/secret)",
  loggerCalls.length > 0 && !/\$\{\s*tokens?\s*[}\[]/.test(loggerCalls) && !/(secret|senha|salt|password|fcmtoken)/i.test(loggerCalls));

/* ── F: preservação das fases anteriores ── */
ok("F1 onEventCreated preservado (fan-out 'created')",
  /exports\.onEventCreated = onDocumentCreated\("events\/\{eventId\}"/.test(SRC) && /broadcastEventLifecycle\("created"/.test(SRC));
ok("F2 onEventUpdated preservado (start/finish/cancel/edit por delta)",
  /exports\.onEventUpdated = onDocumentUpdated\("events\/\{eventId\}"/.test(SRC) && /detectEventTransition\(before, after\)/.test(SRC));
ok("F3 dedup por transição preservado (createdNotifiedAt/updatedNotifiedHash)",
  /createdNotifiedAt/.test(SRC) && /updatedNotifiedHash/.test(SRC));
ok("F4 allowlist de src preservado (event nativebeta+webpreview; task nativebeta)",
  /event: new Set\(\["nativebeta", "webpreview"\]\)/.test(SRC) && /task: new Set\(\["nativebeta"\]\)/.test(SRC));
ok("F5 chat gate intocado", /if \(msg\.src !== "nativebeta"\) return;/.test(SRC));
ok("F6 dedup do responsável (immediateNotifiedAt) intocado", /if \(doc\.immediateNotifiedAt\) return;/.test(SRC));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
