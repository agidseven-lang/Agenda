/* Tipos do idseven-presence-canary (isolado do J6). */

/** Identidade retornada pelo getUserSelf (self). */
export interface Identity {
  id: string; name: string; role: string; admin: boolean;
  status: string; photo: string; color: string;
}

/** Payload do ticket efêmero (NUNCA é o token de sessão). */
export interface TicketPayload {
  aud: "idseven-presence";
  sub: string;        // userId — vem SÓ do getUserSelf, nunca do body
  name: string; role: string; photo: string; admin: boolean;
  deviceId: string;   // do cliente (main), opaco
  nonce: string;
  iat: number;        // ms
  exp: number;        // ms
}

/** Evento de presença (broadcast) — SANITIZADO. */
export interface PresenceEvent {
  type: "presence";
  userId: string; name: string; photo: string; role: string; admin: boolean;
  online: boolean;
  transitionedAt: number;
  transitionRevision: number;
  eventId: string;    // presence:<userId>:<revision>:online|offline
}

/** Bindings/variáveis do Worker. */
export interface Env {
  PRESENCE_HUB: DurableObjectNamespace;
  PRESENCE_AUTH_ENABLED: string;
  PRESENCE_WS_ENABLED: string;
  PRESENCE_BROADCAST_ENABLED: string;
  GETUSERSELF_URL: string;
  PRESENCE_TTL_MS: string;
  PRESENCE_HEARTBEAT_MS: string;
  PRESENCE_TICKET_TTL_MS: string;
  PRESENCE_TICKET_SECRET: string; // secret (wrangler secret put)
  SERVICE_VERSION: string;
}
