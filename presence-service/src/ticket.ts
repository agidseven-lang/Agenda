/* Façade tipada do ticket de presença (a lógica pura vive em core.mjs — testável
   em Node e no Worker). Ver THREAT-MODEL.md: ticket efêmero, aud fixo, nonce. */
// @ts-ignore — módulo ESM puro, sem tipos
import { signTicket as _sign, verifyTicket as _verify } from "./core.mjs";
import type { TicketPayload } from "./types";

export function signTicket(payload: TicketPayload, secret: string): Promise<string> {
  return _sign(payload, secret);
}
export function verifyTicket(token: string, secret: string, opts?: { aud?: string; nowMs?: number }): Promise<TicketPayload | null> {
  return _verify(token, secret, opts || {}) as Promise<TicketPayload | null>;
}
