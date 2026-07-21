#!/usr/bin/env node
/* =====================================================================
   F3.4.2A Stage-2B — CONTRATO ESTÁTICO do PresenceHubCanary (Durable Object).
   A lógica pura é provada em presence.test.mjs (aggregator). Aqui garantimos que
   a FIAÇÃO do DO respeita a regra definitiva + as INEGOCIÁVEIS de segurança/
   hibernação (sem rodar Cloudflare). Checagens sobre o CÓDIGO (comentários fora).
   ===================================================================== */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, "../src/presenceHub.ts"), "utf8");
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // sem comentários

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };
const fn = (name) => { // extrai o corpo aproximado de um método
  const i = code.indexOf(name);
  return i < 0 ? "" : code.slice(i, i + 900);
};

console.log("F3.4.2A Stage-2B — contrato estático do Durable Object (presenceHub.ts)");

// ---- Hibernation + alarm único, SEM timers ----
ok("DO usa WebSocket Hibernation (acceptWebSocket)", /ctx\.acceptWebSocket\(/.test(code));
ok("DO usa serializeAttachment + deserializeAttachment + getWebSockets", /serializeAttachment\(/.test(code) && /deserializeAttachment\(/.test(code) && /getWebSockets\(/.test(code));
ok("DO NÃO usa setInterval/setTimeout (hibernação preservada)", !/setInterval|setTimeout/.test(code));
ok("DO usa alarm ÚNICO (setAlarm/deleteAlarm + nextExpiry)", /storage\.setAlarm\(/.test(code) && /storage\.deleteAlarm\(/.test(code) && /nextExpiry\(\)/.test(code));
ok("DO tem alarm() idempotente (sweep + idempotent_skip)", /async alarm\(/.test(code) && /\.sweep\(/.test(code) && /idempotent_skip/.test(code));

// ---- Regra: fechamento inesperado retém (pending), explícito remove ----
ok("webSocketClose/Error -> onUnexpectedClose (NÃO disconnect direto)", /webSocketClose\([\s\S]{0,120}onUnexpectedClose/.test(code) && /webSocketError\([\s\S]{0,120}onUnexpectedClose/.test(code));
ok("fechamento inesperado marca PENDING (markPending), NÃO remove", /onUnexpectedClose[\s\S]*?markPending\(/.test(code) && /onUnexpectedClose[\s\S]*?persistPending\(/.test(code));
ok("onUnexpectedClose NÃO chama disconnect (não derruba na hora)", !/onUnexpectedClose[\s\S]*?\.disconnect\(/.test(fn("private async onUnexpectedClose")));
ok("goodbye = fechamento EXPLÍCITO -> disconnect imediato", /kind === "goodbye"[\s\S]*?this\.agg\.disconnect\(/.test(code));

// ---- goodbye só encerra a PRÓPRIA sessão: usa attachment (a.userId/a.deviceId), IGNORA o corpo ----
{
  const gb = code.slice(code.indexOf('kind === "goodbye"'), code.indexOf('kind === "goodbye"') + 700);
  ok("goodbye usa a.userId/a.deviceId (attachment assinado)", /disconnect\(a\.userId,\s*a\.deviceId/.test(gb) && /deleteSession\(a\.userId,\s*a\.deviceId/.test(gb));
  ok("goodbye NÃO usa m.userId/m.deviceId do corpo (sem remoção arbitrária)", !/m\.userId/.test(gb) && !/m\.deviceId/.test(gb));
  ok("goodbye valida reason (logout|tray_exit|update)", /GOODBYE_REASONS/.test(code) && /"logout"[\s\S]{0,40}"tray_exit"[\s\S]{0,40}"update"/.test(code));
}

// ---- reconexão do mesmo device: fetch reutiliza + limpa pending persistido ----
ok("fetch detecta reconexão (hasDevice) e loga same_device", /hasDevice\(userId,\s*deviceId\)/.test(code) && /reconnect\.same_device/.test(code));
ok("fetch limpa o pending persistido ao reconectar (deleteSession)", /async fetch\([\s\S]*?deleteSession\(userId,\s*deviceId\)/.test(code));
ok("fetch usa agg.connect (reuso -> sem transição)", /async fetch\([\s\S]*?this\.agg\.connect\(/.test(code));

// ---- Hibernation-safe: PENDING persistido + rebuild (connected de sockets, pending do storage) ----
ok("persiste sessão PENDING no storage (sess:)", /persistPending\(/.test(code) && /"sess:"/.test(code));
ok("restore reconstrói connected (getWebSockets) + pending (storage list)", /restore\([\s\S]*?getWebSockets\(\)[\s\S]*?storage\.list[\s\S]*?prefix: "sess:"/.test(code));
ok("restore: socket vivo vence pending obsoleto (delete stale)", /liveKeys\.has[\s\S]{0,60}storage\.delete/.test(code));

// ---- heartbeat: renova expiresAt, sem transição/revision/broadcast ----
ok("heartbeat (hb) renova expiresAt + agg.heartbeat (sem revision)", /kind === "hb"[\s\S]*?a\.expiresAt = now \+ this\.ttlMs[\s\S]*?agg\.heartbeat\(/.test(code));

// ---- broadcast permanece DESLIGADO (Stage-2B não liga entrou/saiu) ----
ok("broadcast gated por PRESENCE_BROADCAST_ENABLED (Stage-2B OFF)", /if \(!this\.broadcastOn\) return/.test(code) && /PRESENCE_BROADCAST_ENABLED/.test(code));

// ---- persistência mínima: NUNCA token/ticket/ip/hostname/os/localização ----
ok("StoredSession não persiste token/ticket/ip/hostname/os/localização", !/\b(token|ticket|ip|hostname|\bos\b|location|mac|serial)\b\s*:/.test(fn("interface StoredSession")));
ok("logs NUNCA carregam identidade/token/ticket (só ids truncados + escalares)", /slice\(0, 6\) \+ "…"/.test(code) && !/console\.log[^\n]*identity/.test(code));

// ---- logs sanitizados exigidos pelo mandato ----
for (const tag of ["presence.close.explicit", "presence.close.unexpected.pending", "presence.reconnect.same_device", "presence.pending.expired", "presence.transition.online", "presence.transition.offline", "presence.alarm.arm", "presence.alarm.fire", "presence.alarm.idempotent_skip"]) {
  ok(`log presente: ${tag}`, code.includes(tag));
}

console.log(`\npresenceHub-contract: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
