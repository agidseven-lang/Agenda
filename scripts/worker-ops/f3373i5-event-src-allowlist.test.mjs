#!/usr/bin/env node
/* =====================================================================
   F3.3.73I5 — Teste HERMÉTICO do allowlist de src do onEventCreated.
   Prova que a notificação server-side passa a aceitar eventos criados no
   Desktop (src:"webpreview") ALÉM do Android (src:"nativebeta"), SEM afetar
   tarefas (mantidas "nativebeta"-only) nem o chat (gate próprio intocado),
   preservando o dedup (immediateNotifiedAt) e o destinatário (ownerId).
   Lê functions/index.js como TEXTO + extrai/avalia o const NOTIFY_SRC_ALLOW
   (Set puro) — NÃO chama Firebase, NÃO faz rede, NÃO deploya, NÃO escreve.
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73I5 — allowlist de src do onEventCreated (hermético)");

/* ── extrai e AVALIA o const real (prova a lógica, não só o texto) ── */
const m = SRC.match(/const NOTIFY_SRC_ALLOW = (\{[\s\S]*?\});/);
ok("A0 NOTIFY_SRC_ALLOW declarado no módulo", !!m);
let ALLOW = null;
try { ALLOW = m ? eval("(" + m[1] + ")") : null; } catch (_) { ALLOW = null; }
ok("A0b NOTIFY_SRC_ALLOW avaliável (event/task com Set)", ALLOW && ALLOW.event instanceof Set && ALLOW.task instanceof Set);

/* ── A: eventos ── */
ok("A1 onEventCreated aceita src:'nativebeta' (Android)", ALLOW.event.has("nativebeta"));
ok("A2 onEventCreated aceita src:'webpreview' (Desktop 1.0.160)", ALLOW.event.has("webpreview"));
ok("A3 onEventCreated rejeita src desconhecido", !ALLOW.event.has("pwa") && !ALLOW.event.has("") && !ALLOW.event.has("web"));

/* ── B: tarefas inalteradas (fora do escopo) ── */
ok("B1 tarefas seguem aceitando só 'nativebeta'", ALLOW.task.has("nativebeta"));
ok("B2 tarefas NÃO passam a aceitar 'webpreview' (escopo só de eventos)", !ALLOW.task.has("webpreview"));

/* ── C: gate aplicado + dedup + ownerId preservados ── */
ok("C1 gate usa o allowlist por tipo (substituiu o !== 'nativebeta' único)",
  /const allow = NOTIFY_SRC_ALLOW\[type\];/.test(SRC) &&
  /if \(!allow \|\| !allow\.has\(doc\.src\)\) return;/.test(SRC) &&
  !/if \(doc\.src !== "nativebeta"\) return;/.test(SRC));
ok("C2 dedup immediateNotifiedAt preservado (logo após o gate)",
  /if \(!allow \|\| !allow\.has\(doc\.src\)\) return;[\s\S]{0,120}if \(doc\.immediateNotifiedAt\) return;/.test(SRC));
ok("C3 destinatário do evento continua = ownerId",
  /const responsibleId = \(type === "task"\) \? \(doc\.assigneeId \|\| null\) : \(doc\.ownerId \|\| null\);/.test(SRC));
ok("C4 sem ownerId => não notifica (guard preservado)", /if \(!responsibleId\) return;/.test(SRC));
ok("C5 skip auto-atribuição (responsável == criador) preservado",
  /if \(responsibleId === \(doc\.by \|\| null\)\)/.test(SRC));

/* ── D: trigger e chat ── */
ok("D1 onEventCreated segue onDocumentCreated (só create; sem reprocessar antigos)",
  /exports\.onEventCreated = onDocumentCreated\("events\/\{eventId\}"/.test(SRC));
ok("D2 chat mantém gate próprio 'nativebeta'-only (intocado)",
  /if \(msg\.src !== "nativebeta"\) return;/.test(SRC));
ok("D3 onEventCreated continua delegando a notifyResponsible('event',...)",
  /notifyResponsible\("event", "events", event\.params\.eventId, (?:doc|snap\.data\(\))\)/.test(SRC));

/* ── E: segurança — a mudança desta fase não adicionou logging/token/secret ── */
const added = SRC.match(/const NOTIFY_SRC_ALLOW = \{[\s\S]*?if \(!allow \|\| !allow\.has\(doc\.src\)\) return;/);
ok("E1 o bloco adicionado (allowlist + gate) é lógica pura, sem logger/console/token/secret",
  !!added && !/(logger|console)\./.test(added[0]) && !/token|secret|pass|salt/i.test(added[0]));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
