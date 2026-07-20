/* =====================================================================
 * idseven-presence-canary — LÓGICA PURA (runtime-agnóstica)
 * ---------------------------------------------------------------------
 * Sem APIs de Cloudflare/Electron: roda igual no Worker (esbuild) e no
 * Node (testes). Contém: (1) ticket HS256 (Web Crypto, presente em ambos);
 * (2) PresenceAggregator — máquina de estados de presença agregada por
 * usuário, com transições SOMENTE em 0<->1, transitionRevision monotônico,
 * varredura idempotente por TTL e cálculo da PRÓXIMA expiração (para o alarm
 * único do Durable Object). NENHUM setInterval/setTimeout aqui.
 * Segurança: identidade vem do `sub` do ticket (nunca do body); o payload de
 * broadcast é sanitizado (sem token/IP/hostname/deviceId/localização/SO).
 * ===================================================================== */

// ---------- base64url ----------
const enc = new TextEncoder();
const dec = new TextDecoder();
function b64urlFromBytes(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlJson(obj) { return b64urlFromBytes(enc.encode(JSON.stringify(obj))); }

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/**
 * Assina um ticket de presença (JWT HS256 compacto).
 * NUNCA é o token de sessão; efêmero; aud fixo; nonce anti-replay.
 */
export async function signTicket(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const signingInput = b64urlJson(header) + "." + b64urlJson(payload);
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(signingInput)));
  return signingInput + "." + b64urlFromBytes(sig);
}

/**
 * Verifica assinatura + exp + aud (comparação em tempo constante via subtle.verify).
 * Retorna o payload validado ou null. `nowMs` injetável para teste.
 */
export async function verifyTicket(token, secret, opts = {}) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    const signingInput = parts[0] + "." + parts[1];
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, bytesFromB64url(parts[2]), enc.encode(signingInput));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(bytesFromB64url(parts[1])));
    const now = typeof opts.nowMs === "number" ? opts.nowMs : Date.now();
    if (opts.aud && payload.aud !== opts.aud) return null;
    if (typeof payload.exp !== "number" || now >= payload.exp) return null; // expirado / sem exp
    if (typeof payload.iat === "number" && now + 60000 < payload.iat) return null; // emitido no futuro
    return payload;
  } catch { return null; }
}

// ---------- Presença agregada ----------
/**
 * Estado por usuário: { revision, online, transitionedAt, identity, devices: Map<deviceId,{lastSeen,expiresAt}> }.
 * Transição SÓ quando o nº de dispositivos cruza 0<->1. transitionRevision só
 * incrementa em transição real (nunca em heartbeat / N<->N±1). Varredura idempotente.
 */
export class PresenceAggregator {
  constructor(ttlMs) {
    this.ttlMs = ttlMs || 90000;
    this.users = new Map(); // userId -> state
  }
  _u(userId) {
    let u = this.users.get(userId);
    if (!u) { u = { revision: 0, online: false, transitionedAt: 0, identity: null, devices: new Map() }; this.users.set(userId, u); }
    return u;
  }
  /** Conecta/renova um dispositivo. Retorna transição 'online' apenas em 0->1. */
  connect(userId, deviceId, now, identity) {
    const u = this._u(userId);
    if (identity) u.identity = identity;
    const was = u.devices.size;
    u.devices.set(deviceId, { lastSeen: now, expiresAt: now + this.ttlMs });
    if (was === 0) { u.online = true; u.revision += 1; u.transitionedAt = now; return this._evt(userId, true); }
    return null;
  }
  /** Restaura um dispositivo após hibernação/eviction SEM emitir transição (rebuild do estado). */
  seed(userId, deviceId, lastSeen, expiresAt, identity, revision) {
    const u = this._u(userId);
    if (identity) u.identity = identity;
    u.devices.set(deviceId, { lastSeen, expiresAt });
    if (typeof revision === "number" && revision > u.revision) u.revision = revision;
    u.online = u.devices.size > 0;
    if (u.online && lastSeen > u.transitionedAt) u.transitionedAt = lastSeen;
  }
  /** Heartbeat: renova expiração. NUNCA transição, NUNCA revision, NUNCA broadcast. */
  heartbeat(userId, deviceId, now) {
    const u = this.users.get(userId);
    if (!u || !u.devices.has(deviceId)) return false;
    const d = u.devices.get(deviceId);
    d.lastSeen = now; d.expiresAt = now + this.ttlMs;
    return true;
  }
  /** Desconexão explícita. Retorna transição 'offline' apenas em 1->0. */
  disconnect(userId, deviceId, now) {
    const u = this.users.get(userId);
    if (!u || !u.devices.has(deviceId)) return null;
    u.devices.delete(deviceId);
    if (u.devices.size === 0) { u.online = false; u.revision += 1; u.transitionedAt = now; return this._evt(userId, false); }
    return null;
  }
  /** Varredura por TTL (chamada pelo alarm). Idempotente: remove só expirados; 1->0 emite uma vez. */
  sweep(now) {
    const out = [];
    for (const [userId, u] of this.users) {
      let removed = false;
      for (const [deviceId, d] of u.devices) {
        if (d.expiresAt <= now) { u.devices.delete(deviceId); removed = true; }
      }
      if (removed && u.devices.size === 0 && u.online) {
        u.online = false; u.revision += 1; u.transitionedAt = now; out.push(this._evt(userId, false));
      }
    }
    return out;
  }
  /** Menor expiresAt entre TODOS os dispositivos ativos (para o alarm ÚNICO). null se não houver. */
  nextExpiry() {
    let min = null;
    for (const u of this.users.values()) {
      for (const d of u.devices.values()) { if (min === null || d.expiresAt < min) min = d.expiresAt; }
    }
    return min;
  }
  isOnline(userId) { const u = this.users.get(userId); return !!(u && u.online); }
  sessionCount(userId) { const u = this.users.get(userId); return u ? u.devices.size : 0; }
  /** Snapshot de baseline (sanitizado): sem deviceId/token/IP. sessions só p/ uso admin no cliente. */
  snapshot(now) {
    const users = [];
    for (const [userId, u] of this.users) {
      if (!u.online) continue;
      const id = u.identity || {};
      users.push({
        userId, name: id.name || "", photo: id.photo || "", role: id.role || "",
        online: true, transitionedAt: u.transitionedAt, transitionRevision: u.revision,
        lastSeen: this._lastSeen(u), sessions: u.devices.size,
      });
    }
    return { type: "baseline", serverNow: now, users };
  }
  _lastSeen(u) { let m = 0; for (const d of u.devices.values()) if (d.lastSeen > m) m = d.lastSeen; return m; }
  /** Evento de transição sanitizado (o que vai no broadcast e no eventId). */
  _evt(userId, online) {
    const u = this.users.get(userId); const id = (u && u.identity) || {};
    return {
      type: "presence",
      userId, name: id.name || "", photo: id.photo || "", role: id.role || "",
      admin: !!id.admin, online,
      transitionedAt: u ? u.transitionedAt : 0,
      transitionRevision: u ? u.revision : 0,
      eventId: "presence:" + userId + ":" + (u ? u.revision : 0) + ":" + (online ? "online" : "offline"),
    };
  }
}

/** Campos que um evento/snapshot NUNCA pode conter (guarda de sanitização, usada em teste). */
export const FORBIDDEN_EVENT_FIELDS = ["token", "sessionToken", "ip", "hostname", "deviceId", "location", "os", "mac", "serial"];
