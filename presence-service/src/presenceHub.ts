/* =====================================================================
 * PresenceHubCanary — Durable Object (SQLite) com WebSocket Hibernation.
 * ---------------------------------------------------------------------
 * Correções da auditoria aplicadas:
 *  (1) DO com armazenamento SQLite (ver wrangler [[migrations]] new_sqlite_classes).
 *  (2) ALARM ÚNICO na expiração MAIS PRÓXIMA — reprogramado a cada heartbeat/
 *      conexão/desconexão/limpeza; NUNCA um alarm periódico fixo.
 *  (3) SEM setInterval/setTimeout — o DO permanece elegível à hibernação; só
 *      reage a webSocketMessage/Close/Error e ao alarm().
 * Estado: verdade de membresia = ctx.getWebSockets() (attachments guardam
 * userId/deviceId/identity/lastSeen/expiresAt e sobrevivem à hibernação); a
 * revision por usuário é persistida em storage (rev:<userId>). O agregador puro
 * (core.mjs) é reconstruído em blockConcurrencyWhile a cada ativação do DO.
 * Segurança: identidade vem do header assinado pelo Worker (que já validou o
 * ticket → getUserSelf). O broadcast é sanitizado e nunca vai ao próprio autor.
 * ===================================================================== */
// @ts-ignore — módulo ESM puro
import { PresenceAggregator } from "./core.mjs";
import type { Env, Identity, PresenceEvent } from "./types";

interface Attachment { userId: string; deviceId: string; identity: Identity; lastSeen: number; expiresAt: number; }

export class PresenceHubCanary {
  private ctx: DurableObjectState;
  private env: Env;
  private ttlMs: number;
  private agg: any;
  private broadcastOn: boolean;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
    this.ttlMs = parseInt(env.PRESENCE_TTL_MS || "90000", 10) || 90000;
    this.broadcastOn = String(env.PRESENCE_BROADCAST_ENABLED) === "true";
    this.agg = new PresenceAggregator(this.ttlMs);
    // Reconstrói o estado a partir dos WebSockets vivos (attachments) + revisions persistidas,
    // ANTES de atender qualquer requisição/evento. Não gera transições falsas.
    this.ctx.blockConcurrencyWhile(async () => { await this.restore(); });
  }

  private async restore(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.readAtt(ws);
      if (!a) continue;
      const rev = ((await this.ctx.storage.get<number>("rev:" + a.userId)) as number) || 0;
      this.agg.seed(a.userId, a.deviceId, a.lastSeen, a.expiresAt, a.identity, rev);
    }
    await this.reschedule();
  }

  private readAtt(ws: WebSocket): Attachment | null {
    try { return (ws.deserializeAttachment() as Attachment) || null; } catch { return null; }
  }

  private now(): number { return Date.now(); }

  /** Único ponto de agendamento: alarm na MENOR expiração ativa (ou nenhum). */
  private async reschedule(): Promise<void> {
    const next = this.agg.nextExpiry();
    if (next === null) { await this.ctx.storage.deleteAlarm(); return; }
    await this.ctx.storage.setAlarm(next);
  }

  private async persistRev(userId: string): Promise<void> {
    await this.ctx.storage.put("rev:" + userId, this.agg.users.get(userId)?.revision || 0);
  }

  /** Envia um evento sanitizado a todos MENOS o próprio autor (self-notification bloqueada). */
  private broadcast(ev: PresenceEvent): void {
    if (!this.broadcastOn) return;
    const msg = JSON.stringify(ev);
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.readAtt(ws);
      if (!a || a.userId === ev.userId) continue; // nunca ao próprio usuário
      try { ws.send(msg); } catch { /* socket morto: TTL/close cuidam */ }
    }
  }

  async fetch(req: Request): Promise<Response> {
    // Só o Worker (que já validou o ticket→getUserSelf) chama aqui, com a identidade em header assinado.
    const idHdr = req.headers.get("X-Presence-Identity");
    if (!idHdr) return new Response("bad_request", { status: 400 });
    let ident: { identity: Identity; deviceId: string };
    try { ident = JSON.parse(atob(idHdr)); } catch { return new Response("bad_identity", { status: 400 }); }
    const identity = ident.identity;
    const deviceId = String(ident.deviceId || "");
    const userId = String(identity?.id || "");
    if (!userId || !deviceId) return new Response("bad_identity", { status: 400 });

    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const now = this.now();
    const att: Attachment = { userId, deviceId, identity, lastSeen: now, expiresAt: now + this.ttlMs };

    // Hibernation: acceptWebSocket (NÃO server.accept()); attachment persiste metadados mínimos.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(att);

    const ev = this.agg.connect(userId, deviceId, now, identity); // transição só em 0->1
    if (ev) { await this.persistRev(userId); this.broadcast(ev); }
    await this.reschedule();

    // Baseline: snapshot atual só para o NOVO socket (cliente monta Equipe sem notificar).
    try { server.send(JSON.stringify(this.agg.snapshot(now))); } catch { /* */ }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const a = this.readAtt(ws);
    if (!a) return;
    let m: any = null;
    try { m = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return; }
    if (m && m.t === "hb") {
      // Heartbeat: renova expiração (server-side). NUNCA notifica / NUNCA muda revision.
      const now = this.now();
      a.lastSeen = now; a.expiresAt = now + this.ttlMs;
      ws.serializeAttachment(a);
      this.agg.heartbeat(a.userId, a.deviceId, now);
      await this.reschedule();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> { await this.dropSocket(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { await this.dropSocket(ws); }

  private async dropSocket(ws: WebSocket): Promise<void> {
    const a = this.readAtt(ws);
    if (!a) return;
    const ev = this.agg.disconnect(a.userId, a.deviceId, this.now()); // idempotente: null se já removido
    if (ev) { await this.persistRev(a.userId); this.broadcast(ev); }
    await this.reschedule();
    try { ws.close(1000, "closed"); } catch { /* */ }
  }

  /** Alarm ÚNICO: varre expirados, emite saída idempotente (1->0), reprograma p/ a próxima expiração. */
  async alarm(): Promise<void> {
    const now = this.now();
    const events: PresenceEvent[] = this.agg.sweep(now);
    for (const ev of events) { await this.persistRev(ev.userId); this.broadcast(ev); }
    // Fecha os sockets cujos dispositivos expiraram (webSocketClose depois é idempotente).
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.readAtt(ws);
      if (a && a.expiresAt <= now) { try { ws.close(1001, "ttl"); } catch { /* */ } }
    }
    await this.reschedule();
  }
}
