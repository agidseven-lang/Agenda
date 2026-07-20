/* =====================================================================
 * idseven-presence-canary — Worker (fetch). Rotas:
 *   GET  /health   — status + flags (sempre).
 *   POST /auth     — valida o token de sessão pelo getUserSelf EXISTENTE e
 *                    emite um TICKET efêmero (nunca o token). Flag AUTH.
 *   GET  /ws       — upgrade WebSocket -> Durable Object. Flag WS (default OFF).
 * PRIMEIRO DEPLOY: AUTH=true, WS=false, BROADCAST=false -> só /health e /auth.
 * NUNCA loga/persiste/encaminha o token de sessão. userId do body é IGNORADO —
 * a identidade vem SOMENTE do getUserSelf. Não altera Cloud Run / J6 / Firestore.
 * ===================================================================== */
import { PresenceHubCanary } from "./presenceHub";
// @ts-ignore — módulo ESM puro
import { signTicket, verifyTicket } from "./core.mjs";
import type { Env, Identity, TicketPayload } from "./types";

export { PresenceHubCanary };

const AUD = "idseven-presence";
const flag = (v: string) => String(v) === "true";
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

/** Chama o getUserSelf EXISTENTE (POST {} + Bearer). Read-only; não muta o usuário. */
async function callGetUserSelf(url: string, bearer: string): Promise<{ status: number; self: Identity | null; durationMs: number }> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + bearer },
      body: "{}",
    });
    let j: any = null;
    try { j = await r.json(); } catch { /* corpo não-JSON */ }
    const self = (r.status === 200 && j && j.ok === true && j.self && j.self.id) ? (j.self as Identity) : null;
    return { status: r.status, self, durationMs: Date.now() - t0 };
  } catch {
    return { status: 0, self: null, durationMs: Date.now() - t0 };
  }
}

function randHex(n: number): string {
  const b = new Uint8Array(n); crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/health") {
      return json({
        ok: true, service: "idseven-presence-canary", version: env.SERVICE_VERSION || "canary-0",
        flags: { auth: flag(env.PRESENCE_AUTH_ENABLED), ws: flag(env.PRESENCE_WS_ENABLED), broadcast: flag(env.PRESENCE_BROADCAST_ENABLED) },
        now: Date.now(),
      });
    }

    // ---- POST /auth : valida token real pelo getUserSelf, devolve ticket efêmero ----
    if (path === "/auth" && req.method === "POST") {
      if (!flag(env.PRESENCE_AUTH_ENABLED)) return json({ ok: false, error: "auth_disabled" }, 503);
      const auth = req.headers.get("authorization") || "";
      const m = /^Bearer\s+(.+)$/i.exec(auth);
      if (!m) return json({ ok: false, error: "missing_bearer" }, 401);
      const token = m[1];
      let body: any = {};
      try { body = await req.json(); } catch { /* body opcional */ }
      const deviceId = String(body?.deviceId || "").slice(0, 128); // do main; opaco. userId do body é IGNORADO.

      const res = await callGetUserSelf(env.GETUSERSELF_URL, token);
      // Log de diagnóstico SEM token (correção da FASE 3): status, duração, válido, campos presentes.
      const fields = res.self ? Object.keys(res.self).filter((k) => (res.self as any)[k] !== undefined && (res.self as any)[k] !== "") : [];
      console.log(JSON.stringify({ ev: "auth", status: res.status, durationMs: res.durationMs, valid: !!res.self, fields }));

      if (!res.self) {
        const err = res.status === 401 ? "unauthorized" : res.status === 0 ? "getuserself_unreachable" : "getuserself_http_" + res.status;
        return json({ ok: false, error: err }, res.status === 401 ? 401 : 502);
      }
      const self = res.self;
      const now = Date.now();
      const ttl = parseInt(env.PRESENCE_TICKET_TTL_MS || "60000", 10) || 60000;
      const payload: TicketPayload = {
        aud: AUD, sub: self.id, name: self.name, role: self.role, photo: self.photo, admin: !!self.admin,
        deviceId: deviceId || ("dev-" + randHex(8)), nonce: randHex(12), iat: now, exp: now + ttl,
      };
      const ticket = await signTicket(payload, env.PRESENCE_TICKET_SECRET);
      // Identidade sanitizada ao cliente (sem token). O ticket NÃO é o token de sessão.
      return json({
        ok: true, ticket, wsEnabled: flag(env.PRESENCE_WS_ENABLED),
        identity: { id: self.id, name: self.name, role: self.role, admin: !!self.admin, status: self.status, photo: self.photo, color: self.color },
        ticketExpiresAt: payload.exp,
      });
    }

    // ---- GET /ws : upgrade WebSocket (só com WS habilitado). Valida ticket, encaminha ao DO ----
    if (path === "/ws") {
      if (!flag(env.PRESENCE_WS_ENABLED)) return json({ ok: false, error: "ws_disabled" }, 503);
      if (req.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "expected_websocket" }, 426);
      const ticket = url.searchParams.get("ticket") || "";
      const payload = (await verifyTicket(ticket, env.PRESENCE_TICKET_SECRET, { aud: AUD })) as TicketPayload | null;
      if (!payload) return json({ ok: false, error: "bad_ticket" }, 401);
      const identity: Identity = { id: payload.sub, name: payload.name, role: payload.role, admin: !!payload.admin, status: "", photo: payload.photo, color: "" };
      // Um único DO global "hub" (consistência forte da agregação para o time canário).
      const id = env.PRESENCE_HUB.idFromName("hub");
      const stub = env.PRESENCE_HUB.get(id);
      const h = new Headers(req.headers); // preserva Upgrade/Connection
      h.set("X-Presence-Identity", btoa(JSON.stringify({ identity, deviceId: payload.deviceId })));
      return stub.fetch(new Request(req, { headers: h }));
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
};
