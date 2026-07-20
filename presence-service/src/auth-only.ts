/* =====================================================================
 * idseven-presence-canary — ENTRY do STAGE 1 (AUTH-ONLY).
 * ---------------------------------------------------------------------
 * PRIMEIRO DEPLOY: SOMENTE GET /health e POST /auth. NÃO importa/exporta o
 * Durable Object; NÃO tem binding PRESENCE_HUB; NÃO tem migration; NÃO tem
 * WebSocket ativo. Prova o contrato Desktop -> /auth -> getUserSelf ANTES de
 * qualquer estado de presença. Ver wrangler.toml (stage 1, sem DO).
 * NUNCA loga/persiste/encaminha o token de sessão. userId do body é IGNORADO.
 * ===================================================================== */
// @ts-ignore — módulo ESM puro
import { signTicket } from "./core.mjs";
import type { Identity, TicketPayload } from "./types";

interface AuthEnv {
  PRESENCE_AUTH_ENABLED: string;
  PRESENCE_WS_ENABLED: string;
  PRESENCE_BROADCAST_ENABLED: string;
  GETUSERSELF_URL: string;
  PRESENCE_TICKET_TTL_MS: string;
  PRESENCE_TICKET_SECRET: string;
  SERVICE_VERSION: string;
}

const AUD = "idseven-presence";
const flag = (v: string) => String(v) === "true";
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function randHex(n: number): string {
  const b = new Uint8Array(n); crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Chama o getUserSelf EXISTENTE (POST {} + Bearer). Read-only; não muta o usuário. */
async function callGetUserSelf(url: string, bearer: string): Promise<{ status: number; self: Identity | null; durationMs: number }> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "authorization": "Bearer " + bearer }, body: "{}" });
    let j: any = null;
    try { j = await r.json(); } catch { /* corpo não-JSON */ }
    const self = (r.status === 200 && j && j.ok === true && j.self && j.self.id) ? (j.self as Identity) : null;
    return { status: r.status, self, durationMs: Date.now() - t0 };
  } catch { return { status: 0, self: null, durationMs: Date.now() - t0 }; }
}

export default {
  async fetch(req: Request, env: AuthEnv): Promise<Response> {
    const path = new URL(req.url).pathname;

    if (path === "/health") {
      return json({
        ok: true, service: "idseven-presence-canary", stage: 1, version: env.SERVICE_VERSION || "canary-0",
        flags: { auth: flag(env.PRESENCE_AUTH_ENABLED), ws: flag(env.PRESENCE_WS_ENABLED), broadcast: flag(env.PRESENCE_BROADCAST_ENABLED) },
        now: Date.now(),
      });
    }

    if (path === "/auth" && req.method === "POST") {
      if (!flag(env.PRESENCE_AUTH_ENABLED)) return json({ ok: false, error: "auth_disabled" }, 503);
      const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
      if (!m) return json({ ok: false, error: "missing_bearer" }, 401);
      let body: any = {};
      try { body = await req.json(); } catch { /* opcional */ }
      const deviceId = String(body?.deviceId || "").slice(0, 128); // opaco; userId do body é IGNORADO

      const res = await callGetUserSelf(env.GETUSERSELF_URL, m[1]);
      const fields = res.self ? Object.keys(res.self).filter((k) => (res.self as any)[k] !== undefined && (res.self as any)[k] !== "") : [];
      // Diagnóstico SEM token / SEM uid aberto / SEM e-mail / SEM corpo completo.
      console.log(JSON.stringify({ ev: "auth", stage: 1, status: res.status, durationMs: res.durationMs, valid: !!res.self, fieldCount: fields.length, fields }));

      if (!res.self) {
        const err = res.status === 401 ? "unauthorized" : res.status === 0 ? "getuserself_unreachable" : "getuserself_http_" + res.status;
        return json({ ok: false, error: err }, res.status === 401 ? 401 : 502);
      }
      const self = res.self, now = Date.now();
      const ttl = parseInt(env.PRESENCE_TICKET_TTL_MS || "60000", 10) || 60000;
      const payload: TicketPayload = {
        aud: AUD, sub: self.id, name: self.name, role: self.role, photo: self.photo, admin: !!self.admin,
        deviceId: deviceId || ("dev-" + randHex(8)), nonce: randHex(12), iat: now, exp: now + ttl,
      };
      const ticket = await signTicket(payload, env.PRESENCE_TICKET_SECRET);
      // No stage 1 o ticket ainda não abre WS (WS desligado); serve p/ provar o contrato + campos.
      return json({
        ok: true, ticket, wsEnabled: false,
        identity: { id: self.id, name: self.name, role: self.role, admin: !!self.admin, status: self.status, photo: self.photo, color: self.color },
        fieldsPresent: fields, ticketExpiresAt: payload.exp,
      });
    }

    return json({ ok: false, error: "not_found_stage1", hint: "stage 1: só /health e /auth" }, 404);
  },
};
