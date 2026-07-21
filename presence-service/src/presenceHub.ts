/* =====================================================================
 * PresenceHubCanary — Durable Object (SQLite) com WebSocket Hibernation.
 * F3.4.2A Stage-2B — RETENÇÃO DE FECHAMENTO INESPERADO ATÉ O TTL.
 * ---------------------------------------------------------------------
 * Regra definitiva:
 *  - Fechamento EXPLÍCITO (mensagem goodbye: logout/tray_exit/update): remove
 *    a sessão IMEDIATAMENTE; se for a última do usuário, transição on->off (uma vez).
 *  - Fechamento INESPERADO (webSocketClose/Error/rede/suspensão): NÃO remove;
 *    marca a sessão como PENDING mantendo expiresAt do ÚLTIMO heartbeat; o usuário
 *    agregado permanece ON-LINE até o TTL. Só o alarm no TTL remove e emite off.
 *  - Reconexão do MESMO userId+deviceId antes do TTL: reutiliza a sessão lógica,
 *    religa o WebSocket, limpa o pending, atualiza lastSeen/expiresAt, reprograma o
 *    alarm — SEM transição on/off, SEM revision, SEM entrou/saiu.
 * Hibernation-safe: sessões PENDING (sem socket vivo) são persistidas em storage
 * (sess:<u>|<d>) e reconstruídas em cada ativação; sessões CONNECTED vivem no
 * attachment do socket (getWebSockets). Alarm ÚNICO na menor expiração; idempotente;
 * SEM setInterval/setTimeout. Segurança: identidade vem do header assinado (ticket→
 * getUserSelf); goodbye só encerra a PRÓPRIA sessão (userId/deviceId do attachment,
 * nunca do corpo). Persistência mínima: userId/deviceId/status/lastSeen/expiresAt/
 * identity(+rev por usuário). NUNCA token/ticket/IP/hostname/SO/localização.
 * ===================================================================== */
// @ts-ignore — módulo ESM puro
import { PresenceAggregator, presenceEventToWire } from "./core.mjs";
import type { Env, Identity, PresenceEvent } from "./types";

interface Attachment { userId: string; deviceId: string; identity: Identity; lastSeen: number; expiresAt: number; status: "connected" | "pending"; }
interface StoredSession { userId: string; deviceId: string; status: "pending"; lastSeen: number; expiresAt: number; identity: Identity; }

const GOODBYE_REASONS = new Set(["logout", "tray_exit", "update"]);

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
    this.ctx.blockConcurrencyWhile(async () => { await this.restore(); });
  }

  private now(): number { return Date.now(); }

  // ---- logging sanitizado (wrangler tail) — NUNCA token/ticket/identidade/URL; ids truncados ----
  private log(tag: string, data?: Record<string, unknown>): void {
    try {
      const safe: Record<string, unknown> = {};
      const d = data || {};
      for (const k of Object.keys(d)) {
        const v = (d as any)[k];
        safe[k] = (k === "userId" || k === "deviceId") && typeof v === "string" ? v.slice(0, 6) + "…" : v;
      }
      console.log(JSON.stringify({ presence: tag, ...safe }));
    } catch { /* log nunca quebra o DO */ }
  }
  private sanitize(raw: unknown): string {
    return String(raw == null ? "" : raw).replace(/[^a-zA-Z0-9_ -]/g, "").trim().slice(0, 40);
  }

  // ---- storage: sessões PENDING (hibernation-safe) + revision por usuário ----
  private sessKey(userId: string, deviceId: string): string { return "sess:" + encodeURIComponent(userId) + "|" + encodeURIComponent(deviceId); }
  private async persistPending(s: StoredSession): Promise<void> { await this.ctx.storage.put(this.sessKey(s.userId, s.deviceId), s); }
  private async deleteSession(userId: string, deviceId: string): Promise<void> { await this.ctx.storage.delete(this.sessKey(userId, deviceId)); }
  private async persistRev(userId: string): Promise<void> { await this.ctx.storage.put("rev:" + userId, this.agg.users.get(userId)?.revision || 0); }
  private async getRev(userId: string): Promise<number> { return ((await this.ctx.storage.get<number>("rev:" + userId)) as number) || 0; }

  private readAtt(ws: WebSocket): Attachment | null {
    try { return (ws.deserializeAttachment() as Attachment) || null; } catch { return null; }
  }

  /** Reconstrói o estado a cada ativação: CONNECTED dos sockets vivos + PENDING do storage. */
  private async restore(): Promise<void> {
    const liveKeys = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.readAtt(ws);
      if (!a) continue;
      this.agg.seed(a.userId, a.deviceId, a.lastSeen, a.expiresAt, a.identity, await this.getRev(a.userId), "connected");
      liveKeys.add(a.userId + "|" + a.deviceId);
    }
    const stored = await this.ctx.storage.list<StoredSession>({ prefix: "sess:" });
    for (const [key, s] of stored) {
      const k = s.userId + "|" + s.deviceId;
      if (liveKeys.has(k)) { await this.ctx.storage.delete(key); continue; } // socket vivo vence o pending obsoleto
      this.agg.seed(s.userId, s.deviceId, s.lastSeen, s.expiresAt, s.identity, await this.getRev(s.userId), "pending");
    }
    await this.reschedule();
  }

  /** Alarm ÚNICO na MENOR expiração ativa (connected + pending). null => sem alarm. */
  private async reschedule(): Promise<void> {
    const next = this.agg.nextExpiry();
    if (next === null) { await this.ctx.storage.deleteAlarm(); this.log("presence.alarm.arm", { next: null }); return; }
    await this.ctx.storage.setAlarm(next);
    this.log("presence.alarm.arm", { inMs: Math.max(0, next - this.now()) });
  }

  private broadcast(ev: PresenceEvent): void {
    if (!this.broadcastOn) return; // gate: só transmite quando PRESENCE_BROADCAST_ENABLED=true (Stage-2C)
    // Payload de WIRE canônico (presence_transition + user:{id,name,photo,role}); sanitizado.
    const msg = JSON.stringify(presenceEventToWire(ev));
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.readAtt(ws);
      // AUTO-EXCLUSÃO NA FONTE: o próprio usuário NUNCA recebe a transição sobre si (nem em outra aba).
      if (!a || a.userId === ev.userId) continue;
      try { ws.send(msg); } catch { /* socket morto: TTL/close cuidam */ }
    }
  }

  async fetch(req: Request): Promise<Response> {
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
    // Reconexão do MESMO device? (pending no agregado/rebuild). connect() reutiliza sem transição.
    const reconnecting = this.agg.hasDevice(userId, deviceId);
    const att: Attachment = { userId, deviceId, identity, lastSeen: now, expiresAt: now + this.ttlMs, status: "connected" };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(att);
    await this.deleteSession(userId, deviceId); // agora CONNECTED via socket vivo: some com o pending persistido

    const ev = this.agg.connect(userId, deviceId, now, identity); // reuso -> null; device novo 0->1 -> online
    if (ev) { await this.persistRev(userId); this.broadcast(ev); this.log("presence.transition.online", { userId, rev: ev.transitionRevision }); }
    else if (reconnecting) { this.log("presence.reconnect.same_device", { userId, deviceId }); }
    await this.reschedule();

    // Baseline (roster agregado sanitizado) + `self` = o PRÓPRIO userId deste socket. `self` só é
    // enviado a ESTA conexão (é o id do próprio dono) e serve de guardião anti-auto-notificação no
    // cliente (defesa em profundidade; a exclusão primária já ocorre na fonte, em broadcast()).
    try { server.send(JSON.stringify({ ...this.agg.snapshot(now), self: userId })); } catch { /* baseline best-effort */ }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const a = this.readAtt(ws);
    if (!a) return;
    let m: any = null;
    try { m = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return; }
    const kind = m && (m.type || m.t);

    if (kind === "hb") {
      // Heartbeat: renova expiração (server-side). NUNCA notifica / NUNCA muda revision.
      const now = this.now();
      a.lastSeen = now; a.expiresAt = now + this.ttlMs; a.status = "connected";
      ws.serializeAttachment(a);
      this.agg.heartbeat(a.userId, a.deviceId, now);
      await this.reschedule();
      return;
    }

    if (kind === "goodbye") {
      // Fechamento EXPLÍCITO: SÓ a própria conexão encerra a PRÓPRIA sessão — usa userId/deviceId do
      // ATTACHMENT (assinado), IGNORANDO qualquer userId/deviceId do corpo. Remove já; off se última.
      const reason = GOODBYE_REASONS.has(String(m.reason)) ? String(m.reason) : "explicit";
      const ev = this.agg.disconnect(a.userId, a.deviceId, this.now());
      await this.deleteSession(a.userId, a.deviceId);
      if (ev) { await this.persistRev(a.userId); this.broadcast(ev); this.log("presence.transition.offline", { userId: a.userId, rev: ev.transitionRevision }); }
      this.log("presence.close.explicit", { userId: a.userId, deviceId: a.deviceId, reason });
      await this.reschedule();
      try { ws.close(1000, "goodbye"); } catch { /* */ }
    }
  }

  async webSocketClose(ws: WebSocket, code?: number, reason?: string): Promise<void> { await this.onUnexpectedClose(ws, code, reason); }
  async webSocketError(ws: WebSocket): Promise<void> { await this.onUnexpectedClose(ws, undefined, "error"); }

  /** Fechamento INESPERADO: marca PENDING (mantém on-line + expiresAt do último heartbeat); persiste. */
  private async onUnexpectedClose(ws: WebSocket, code?: number, reason?: string): Promise<void> {
    const a = this.readAtt(ws);
    if (!a) return;
    const marked = this.agg.markPending(a.userId, a.deviceId); // NÃO remove
    if (!marked) return; // já removido (goodbye/sweep): nada a fazer
    await this.persistPending({ userId: a.userId, deviceId: a.deviceId, status: "pending", lastSeen: a.lastSeen, expiresAt: a.expiresAt, identity: a.identity });
    this.log("presence.close.unexpected.pending", { userId: a.userId, deviceId: a.deviceId, code: typeof code === "number" ? code : null, reason: this.sanitize(reason), expiresInMs: Math.max(0, a.expiresAt - this.now()) });
    await this.reschedule(); // pending mantém o expiresAt; o alarm continua no vencimento
  }

  /** Alarm ÚNICO: varre expirados (pending/connected-mortos), emite off idempotente (1->0), limpa storage, reprograma. */
  async alarm(): Promise<void> {
    const now = this.now();
    this.log("presence.alarm.fire", {});
    const events: PresenceEvent[] = this.agg.sweep(now); // remove expirados; 1->0 emite uma vez
    // limpa as sessões PENDING persistidas que expiraram
    const stored = await this.ctx.storage.list<StoredSession>({ prefix: "sess:" });
    for (const [key, s] of stored) {
      if (s.expiresAt <= now) { await this.ctx.storage.delete(key); this.log("presence.pending.expired", { userId: s.userId, deviceId: s.deviceId }); }
    }
    for (const ev of events) { await this.persistRev(ev.userId); this.broadcast(ev); this.log("presence.transition.offline", { userId: ev.userId, rev: ev.transitionRevision }); }
    // fecha sockets vivos cujo device expirou (raro: connected sem heartbeat) — webSocketClose depois é no-op
    for (const ws of this.ctx.getWebSockets()) {
      const a = this.readAtt(ws);
      if (a && a.expiresAt <= now) { try { ws.close(1001, "ttl"); } catch { /* */ } }
    }
    if (events.length === 0) this.log("presence.alarm.idempotent_skip", {}); // alarm repetido: sem nova saída
    await this.reschedule();
  }
}
