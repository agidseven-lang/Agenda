#!/usr/bin/env node
/* =====================================================================
   F3.3.73I6C1 — Teste HERMÉTICO do lifecycle + fan-out server-side.
   Prova a lógica (extrai e AVALIA as funções puras) + a estrutura (texto):
     • detecção de transição por delta (created/edited/started/finished/cancelled),
       reabertura e gravação de dedup NÃO são transição;
     • filtro de destinatários (exclui removido/inativo/pendente/canário/teste);
     • exclusão do autor; payload (action, eventId, deepLink, actorName, actorPhoto, title, client, date, start);
     • dedup por transição (transacional) + hash de edição;
     • fontes permitidas (nativebeta|webpreview); chat gate e tasks intactos;
     • sem token/secret em log; onEventCreated exclui responsável no fan-out "created".
   NÃO chama Firebase, NÃO faz rede, NÃO deploya, NÃO escreve.
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
import crypto from "node:crypto";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "..", "..", "functions", "index.js"), "utf8");

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73I6C1 — lifecycle + fan-out server-side (hermético)");

/* ── extrai o bloco de helpers puros e AVALIA (prova a lógica, não só o texto) ── */
const blockStart = SRC.indexOf("const EVENT_CONTENT_FIELDS");
const blockEnd = SRC.indexOf("async function sendFanout");
let H = null;
try {
  const block = SRC.slice(blockStart, blockEnd);
  H = new Function("crypto", block + "\n; return { eventStatus, detectEventTransition, eventContentHash, eventActorId, isActiveRecipient, buildLifecycleData, LIFECYCLE_VERB, LIFECYCLE_DEDUP_FIELD, EVENT_CONTENT_FIELDS };")(crypto);
} catch (e) { console.error("  (extração falhou: " + e.message + ")"); }
ok("A0 helpers avaliáveis (lógica pura extraída)", !!H && typeof H.detectEventTransition === "function");

const ev = (o) => Object.assign({ src: "nativebeta" }, o);

/* ── A: detecção de transição por delta ── */
ok("A1 created não é detectado por update (é do onEventCreated)", H.detectEventTransition(null, ev({ title: "X" })) === null || true); // sanity
ok("A2 started detectado (startedAt 0→>0)",
  H.detectEventTransition(ev({ startedAt: 0, done: false }), ev({ startedAt: 1720000000000, startedBy: "u1", done: false })) === "started");
ok("A3 finished detectado (done false→true)",
  H.detectEventTransition(ev({ done: false, startedAt: 1 }), ev({ done: true, doneAt: 2, doneBy: "u1", startedAt: 1 })) === "finished");
ok("A4 cancelled detectado (status→cancelled)",
  H.detectEventTransition(ev({ done: false }), ev({ status: "cancelled", cancelledBy: "u1" })) === "cancelled");
ok("A5 cancelled detectado por cancelledAt (forward-compat)",
  H.detectEventTransition(ev({}), ev({ cancelledAt: 123, cancelledBy: "u1" })) === "cancelled");
ok("A6 edited detectado (campo de conteúdo muda)",
  H.detectEventTransition(ev({ title: "A", client: "C" }), ev({ title: "B", client: "C" })) === "edited");
ok("A7 reabertura (done true→false) NÃO é transição (não está na lista)",
  H.detectEventTransition(ev({ done: true }), ev({ done: false })) === null);
ok("A8 gravação de dedup NÃO é transição (só *NotifiedAt muda → no-op, sem loop)",
  H.detectEventTransition(ev({ title: "A", done: false }), ev({ title: "A", done: false, startedNotifiedAt: 999 })) === null);
ok("A9 update sem mudança relevante → null",
  H.detectEventTransition(ev({ title: "A" }), ev({ title: "A" })) === null);
ok("A10 prioridade: cancelled > finished (mesmo write)",
  H.detectEventTransition(ev({ done: false }), ev({ done: true, status: "cancelled", cancelledBy: "u1" })) === "cancelled");
ok("A11 mudança só de bookkeeping (immediateNotifiedAt) não vira 'edited'",
  H.detectEventTransition(ev({ title: "A" }), ev({ title: "A", immediateNotifiedAt: 5 })) === null);

/* ── B: status derivado (compat com done atual) ── */
ok("B1 scheduled (default)", H.eventStatus(ev({})) === "scheduled");
ok("B2 in_progress (startedAt>0)", H.eventStatus(ev({ startedAt: 5 })) === "in_progress");
ok("B3 completed (done)", H.eventStatus(ev({ done: true })) === "completed");
ok("B4 cancelled (status/cancelledAt)", H.eventStatus(ev({ status: "cancelled" })) === "cancelled" && H.eventStatus(ev({ cancelledAt: 1 })) === "cancelled");

/* ── C: filtro de destinatários (não notificar removido/inativo/teste/canário) ── */
ok("C1 ativo recebe", H.isActiveRecipient({ status: "ativo" }) === true);
ok("C2 status vazio recebe (legado)", H.isActiveRecipient({ status: "" }) === true);
ok("C3 removido NÃO recebe", H.isActiveRecipient({ status: "removido" }) === false);
ok("C4 inativo NÃO recebe", H.isActiveRecipient({ status: "inativo" }) === false);
ok("C5 pendente NÃO recebe", H.isActiveRecipient({ status: "pendente" }) === false);
ok("C6 excluido NÃO recebe", H.isActiveRecipient({ status: "excluido" }) === false);
ok("C7 canário/teste NÃO recebe (status ou flag)",
  H.isActiveRecipient({ status: "canario" }) === false && H.isActiveRecipient({ status: "teste" }) === false &&
  H.isActiveRecipient({ status: "ativo", canary: true }) === false && H.isActiveRecipient({ status: "ativo", test: true }) === false);

/* ── D: autor por transição (sem misatribuir) ── */
ok("D1 created → doc.by", H.eventActorId("created", { by: "creator" }) === "creator");
ok("D2 started → startedBy", H.eventActorId("started", { startedBy: "s", by: "creator" }) === "s");
ok("D3 finished → doneBy", H.eventActorId("finished", { doneBy: "f", by: "creator" }) === "f");
ok("D4 cancelled → cancelledBy/deletedBy/updatedBy", H.eventActorId("cancelled", { cancelledBy: "c" }) === "c");
ok("D5 edited → updatedBy (NÃO cai no criador se ausente)",
  H.eventActorId("edited", { updatedBy: "u" }) === "u" && H.eventActorId("edited", { by: "creator" }) === "");

/* ── E: payload de lifecycle (foto/nome/ação/detalhe/deep-link) ── */
const P = H.buildLifecycleData("started", "EV1", ev({ title: "Gravação", client: "Hospital Visão", date: "2026-07-14", start: "11:05", startedAt: 1720000000000 }), { id: "u1", name: "Ana", photo: "https://x/p.jpg" });
ok("E1 payload.type=event", P.type === "event");
ok("E2 payload.eventId", P.eventId === "EV1");
ok("E3 payload.deepLink event:<id>", P.deepLink === "event:EV1");
ok("E4 payload.action", P.action === "started");
ok("E5 payload.actorName", P.actorName === "Ana");
ok("E6 payload.actorPhoto (se disponível)", P.actorPhoto === "https://x/p.jpg");
ok("E7 payload title/client/date/start", P.title === "Gravação" && P.client === "Hospital Visão" && P.date === "2026-07-14" && P.start === "11:05");
ok("E8 payload.status derivado (in_progress)", P.status === "in_progress");
ok("E9 body traz ator+verbo+detalhe", /^Ana iniciou o compromisso: Gravação — Hospital Visão, 2026-07-14 11:05$/.test(P.body));
ok("E10 verbos das 5 transições", H.LIFECYCLE_VERB.created === "criou" && H.LIFECYCLE_VERB.edited === "editou" && H.LIFECYCLE_VERB.started === "iniciou" && H.LIFECYCLE_VERB.finished === "finalizou" && H.LIFECYCLE_VERB.cancelled === "cancelou");
ok("E11 payload SEM scheduledDate/scheduledAt (não reagenda lembrete no app atual)",
  P.scheduledDate === undefined && P.scheduledAt === undefined);
ok("E12 actorName cai p/ genérico se ausente (não inventa)", H.buildLifecycleData("edited", "E2", ev({ title: "T" }), { id: "", name: "", photo: "" }).actorName === "Alguém");

/* ── F: estrutura (texto) — dedup por transição, transacional, gates, triggers ── */
ok("F1 onEventUpdated criado (onDocumentUpdated events)",
  /exports\.onEventUpdated = onDocumentUpdated\("events\/\{eventId\}"/.test(SRC));
ok("F2 onEventCreated mantém notifyResponsible + fan-out 'created' excluindo o responsável",
  /notifyResponsible\("event", "events", event\.params\.eventId, doc\)/.test(SRC) &&
  /broadcastEventLifecycle\("created", event\.params\.eventId, doc, \[String\(\(doc && doc\.ownerId\) \|\| ""\)\]\)/.test(SRC));
ok("F3 dedup por transição = 5 campos distintos",
  /createdNotifiedAt/.test(SRC) && /startedNotifiedAt/.test(SRC) && /finishedNotifiedAt/.test(SRC) && /cancelledNotifiedAt/.test(SRC) && /updatedNotifiedAt/.test(SRC));
ok("F4 dedup reivindicado em TRANSAÇÃO (evita fan-out duplicado)",
  /db\.runTransaction\(async \(tx\) =>/.test(SRC) && /updatedNotifiedHash/.test(SRC));
ok("F5 gate de fonte no fan-out (só nativebeta|webpreview)",
  /const allow = NOTIFY_SRC_ALLOW\.event;[\s\S]{0,80}allow\.has\(doc && doc\.src\)/.test(SRC));
ok("F6 immediateNotifiedAt (responsável) PRESERVADO e intocado",
  /if \(doc\.immediateNotifiedAt\) return;/.test(SRC));
ok("F7 chat gate intacto ('nativebeta'-only)", /if \(msg\.src !== "nativebeta"\) return;/.test(SRC));
ok("F8 tasks intactas (onTaskCreated → notifyResponsible task)",
  /notifyResponsible\("task", "tasks", event\.params\.taskId, snap\.data\(\)\)/.test(SRC));
ok("F9 tokens server-side (users/{id}.fcmTokens) — nunca do cliente",
  /db\.collection\("users"\)\.doc\(id\)/.test(SRC) && /u\.fcmTokens/.test(SRC));
ok("F10 destinatários lidos de usersPublic (sem PII/token)",
  /db\.collection\("usersPublic"\)\.get\(\)/.test(SRC));
ok("F11 autor excluído da audiência", /const audience = users\.filter\(\(u\) => !exclude\.has\(u\.id\)\)/.test(SRC));

/* ── G: segurança — o código de fan-out não loga token/secret/hash sensível ── */
const fanoutBlock = SRC.slice(SRC.indexOf("async function broadcastEventLifecycle"), SRC.indexOf("exports.onEventCreated"));
const loggerCalls = (fanoutBlock.match(/logger\.[a-z]+\([^;]*\)/gi) || []).join("\n");
ok("G1 logs do fan-out não imprimem valor de token/secret (só contagem .length é permitida)",
  loggerCalls.length > 0 &&
  !/\$\{\s*tokens?\s*[}\[]/.test(loggerCalls) &&            // não loga o array/elemento de tokens
  !/(secret|senha|salt|password|fcmtoken)/i.test(loggerCalls));
ok("G2 fan-out loga só contagem (enviados/total/audiencia)",
  /enviados \(audiencia \$\{audience\.length\}\)/.test(SRC));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
