#!/usr/bin/env node
/* Testes puros da agregação de presença (máquina de estados; sem Cloudflare). */
import { PresenceAggregator, FORBIDDEN_EVENT_FIELDS } from "../src/core.mjs";

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };
const idA = { id: "A", name: "Alice Real", role: "Social Media", admin: false, photo: "pa", color: "#1", status: "ativo" };
const idB = { id: "B", name: "Bruno Real", role: "Designer", admin: false, photo: "pb", color: "#2", status: "ativo" };
const TTL = 90000;

// ---- transições 0<->1 e multi-dispositivo ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  const e1 = a.connect("A", "d1", t, idA);
  ok("0→1 emite online + revision 1", e1 && e1.online === true && e1.transitionRevision === 1 && e1.eventId === "presence:A:1:online");
  ok("0→1 identidade real (nome/cargo/foto) no evento", e1.name === "Alice Real" && e1.role === "Social Media" && e1.photo === "pa");
  const e2 = a.connect("A", "d2", t + 1, idA);
  ok("1→2 (2º dispositivo) NÃO emite entrada", e2 === null);
  const e3 = a.disconnect("A", "d1", t + 2);
  ok("2→1 NÃO emite saída", e3 === null);
  ok("ainda online com 1 sessão", a.isOnline("A") === true && a.sessionCount("A") === 1);
  const e4 = a.disconnect("A", "d2", t + 3);
  ok("1→0 emite offline + revision 2", e4 && e4.online === false && e4.transitionRevision === 2 && e4.eventId === "presence:A:2:offline");
  ok("offline: sessões zeradas", a.isOnline("A") === false && a.sessionCount("A") === 0);
}

// ---- heartbeat não notifica / não muda revision ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  a.connect("A", "d1", t, idA);
  const revBefore = a.users.get("A").revision;
  const hb = a.heartbeat("A", "d1", t + 5000);
  ok("heartbeat renova (true) sem evento", hb === true);
  ok("heartbeat NÃO altera revision", a.users.get("A").revision === revBefore);
  ok("heartbeat estende expiração (nextExpiry avança)", a.nextExpiry() === t + 5000 + TTL);
}

// ---- alarm/sweep idempotente ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  a.connect("A", "d1", t, idA);
  const s0 = a.sweep(t + 1000); // ainda vivo
  ok("sweep antes do TTL não remove", s0.length === 0 && a.isOnline("A"));
  const s1 = a.sweep(t + TTL + 1); // expira
  ok("sweep após TTL emite UMA saída (1→0)", s1.length === 1 && s1[0].online === false && s1[0].eventId === "presence:A:2:offline");
  const s2 = a.sweep(t + TTL + 2); // repetição do alarm
  ok("sweep repetido é idempotente (nenhuma 2ª saída)", s2.length === 0);
  ok("revision não avança sem nova transição", a.users.get("A").revision === 2);
}

// ---- crash de 1 device com 2 sessões: sweep só derruba o expirado, sem saída ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  a.connect("A", "d1", t, idA);
  a.connect("A", "d2", t + 60000, idA); // heartbeat mais novo em d2
  const s = a.sweep(t + TTL + 1); // d1 expira, d2 ainda vivo
  ok("crash de 1 de 2 sessões: sem saída (continua 1)", s.length === 0 && a.isOnline("A") && a.sessionCount("A") === 1);
}

// ---- nextExpiry = menor entre todos (alarm único) ----
{
  const a = new PresenceAggregator(TTL);
  a.connect("A", "d1", 1000, idA);
  a.connect("B", "d9", 2000, idB);
  ok("nextExpiry aponta para a MENOR expiração (A@d1)", a.nextExpiry() === 1000 + TTL);
}

// ---- baseline (snapshot) só online, sanitizado, sem deviceId ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  a.connect("A", "d1", t, idA);
  a.connect("B", "d9", t, idB);
  a.disconnect("B", "d9", t + 1); // B offline
  const snap = a.snapshot(t + 2);
  ok("baseline lista só usuários ONLINE (A, não B)", snap.type === "baseline" && snap.users.length === 1 && snap.users[0].userId === "A");
  ok("baseline traz nome/cargo/foto reais + sessions", snap.users[0].name === "Alice Real" && snap.users[0].role === "Social Media" && snap.users[0].sessions === 1);
  ok("baseline NÃO expõe deviceId", JSON.stringify(snap).indexOf("d1") === -1);
}

// ---- sanitização: evento e snapshot nunca contêm campos proibidos ----
{
  const a = new PresenceAggregator(TTL);
  const ev = a.connect("A", "secret-device-xyz", 1000, { ...idA });
  const evStr = JSON.stringify(ev), snapStr = JSON.stringify(a.snapshot(1001));
  const bad = FORBIDDEN_EVENT_FIELDS.filter((f) => evStr.toLowerCase().includes('"' + f.toLowerCase() + '"') || snapStr.toLowerCase().includes('"' + f.toLowerCase() + '"'));
  ok("evento/baseline não contêm token/ip/hostname/deviceId/location/os", bad.length === 0);
  ok("evento não vaza o deviceId no corpo", evStr.indexOf("secret-device-xyz") === -1);
}

// ---- reconexão após restore (seed) não gera entrada falsa ----
{
  const a = new PresenceAggregator(TTL);
  a.seed("A", "d1", 5000, 5000 + TTL, idA, 3); // rebuild pós-hibernação
  ok("seed reconstrói ONLINE sem emitir transição", a.isOnline("A") && a.users.get("A").revision === 3);
  const e = a.connect("A", "d1", 6000, idA); // mesmo device reconecta/renova
  ok("reconexão do mesmo device NÃO gera entrada falsa (já estava 1)", e === null);
}

// ==================== Stage-2B: fechamento inesperado retido até TTL ====================

// ---- markPending: mantém on-line, sem transição, sem resetar expiresAt ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  a.connect("A", "d1", t, idA);
  const p = a.markPending("A", "d1"); // queda inesperada
  ok("2B markPending mantém o device (sem remover) e sem transição", p === true && a.isOnline("A") && a.sessionCount("A") === 1);
  ok("2B markPending NÃO reseta expiresAt (TTL do último heartbeat)", a.nextExpiry() === t + TTL);
  ok("2B markPending deixa o device como pending", a.deviceStatus("A", "d1") === "pending");
  ok("2B pending antes do TTL: sweep não remove (segue on-line)", a.sweep(t + 1000).length === 0 && a.isOnline("A"));
  const s = a.sweep(t + TTL + 1);
  ok("2B pending após TTL: UMA saída (1->0)", s.length === 1 && s[0].online === false && s[0].eventId === "presence:A:2:offline");
  ok("2B após TTL: offline", !a.isOnline("A"));
  ok("2B sweep repetido pós-pending é idempotente", a.sweep(t + TTL + 2).length === 0 && a.users.get("A").revision === 2);
}

// ---- reconexão do MESMO device antes do TTL preserva on-line (sem entrada/saída, sem revision) ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  const rev0 = a.connect("A", "d1", t, idA).transitionRevision;
  a.markPending("A", "d1"); // queda
  const e = a.connect("A", "d1", t + 5000, idA); // reconecta MESMO device antes do TTL
  ok("2B reconnect mesmo device: sem transição (null)", e === null);
  ok("2B reconnect: revision inalterada (sem entrada/saída falsa)", a.users.get("A").revision === rev0);
  ok("2B reconnect: volta a connected + renova expiresAt", a.deviceStatus("A", "d1") === "connected" && a.nextExpiry() === t + 5000 + TTL);
  ok("2B reconnect: continua on-line", a.isOnline("A"));
  ok("2B reconnect: sweep no TTL antigo NÃO remove (expiresAt renovado)", a.sweep(t + TTL + 1).length === 0 && a.isOnline("A"));
}

// ---- explícito (goodbye/logout/Sair) remove imediatamente; contraste com inesperado ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  a.connect("A", "d1", t, idA);
  const e = a.disconnect("A", "d1", t + 1); // explícito
  ok("2B explícito: remove já + offline imediato", e && e.online === false && !a.isOnline("A") && a.sessionCount("A") === 0);
}

// ---- duas sessões: uma cai (pending) não derruba; última pendência gera UMA saída no TTL ----
{
  const a = new PresenceAggregator(TTL); let t = 1000;
  a.connect("A", "d1", t, idA); a.connect("A", "d2", t + 1, idA);
  a.markPending("A", "d1"); // uma cai (inesperado)
  ok("2B 2 sessões, 1 pending: sem saída, contagem preservada", a.isOnline("A") && a.sessionCount("A") === 2);
  const e = a.disconnect("A", "d2", t + 2); // a outra sai explícito -> resta d1 pending ainda válido
  ok("2B sai a última CONNECTED com pending ainda válido: sem offline (resta pending)", e === null && a.isOnline("A") && a.sessionCount("A") === 1);
  const s = a.sweep(t + TTL + 1); // d1 pending expira
  ok("2B último pending expira: UMA saída", s.length === 1 && s[0].online === false && !a.isOnline("A"));
}

// ---- markPending em device inexistente (ex.: já removido por goodbye) é no-op ----
{
  const a = new PresenceAggregator(TTL);
  ok("2B markPending de device inexistente = false (no-op)", a.markPending("Z", "dz") === false && !a.isOnline("Z"));
}

console.log(`\npresence.test: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
