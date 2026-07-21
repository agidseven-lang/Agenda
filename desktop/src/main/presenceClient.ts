/**
 * Agenda ID Seven Desktop — Cliente de PRESENÇA em tempo real (F3.4.2A Stage-2A)
 * ---------------------------------------------------------------------------
 * Cliente WebSocket do Worker canário isolado `idseven-presence-canary` (Stage 2).
 * Fluxo (tudo no processo MAIN): token de sessão real -> POST /auth -> ticket
 * efêmero -> abre WSS /ws?ticket=… -> heartbeat -> reconexão com backoff.
 * O Durable Object mantém o estado agregado e envia BASELINE ao conectar; com
 * PRESENCE_BROADCAST_ENABLED=false NÃO há transições entrou/saiu (Stage 2A).
 *
 * REGRAS INEGOCIÁVEIS (mandato F3.4.2A):
 *   - O token de sessão vive SOMENTE no main. Usado só no header Authorization
 *     do /auth. NUNCA logado, NUNCA persistido em novo arquivo, NUNCA enviado ao
 *     renderer, NUNCA no estado sanitizado.
 *   - O ticket efêmero (não é o token) é usado só na URL do /ws e FICA no main;
 *     NUNCA vai ao renderer nem ao log; a URL com ticket NUNCA é exposta.
 *   - Identidade vem SOMENTE do getUserSelf (via ticket.sub no Worker). O cliente
 *     NUNCA afirma userId. O body do /auth leva SÓ { deviceId }.
 *   - deviceId = UUID aleatório persistente (userData/presence-device.json, 0600);
 *     NUNCA hostname/MAC/IP/serial.
 *   - Estado ao renderer é SANITIZADO (fases/flags/contagem/erros); NUNCA token/
 *     ticket/deviceId completo/IP/hostname/URL-com-ticket.
 *   - Sem tempestade ao reconectar (backoff exponencial + baseline substitui estado
 *     sem notificar). Nesta fase NENHUMA notificação entrou/saiu é gerada.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DEFAULT_AUTH = process.env.IDS_PRESENCE_URL || "https://idseven-presence-canary.agidseven.workers.dev";
const SERVICE_LABEL = "idseven-presence-canary";
const DEFAULT_HEARTBEAT_MS = 30000; // canário: heartbeat 30s (TTL server 90s)
const DEFAULT_TIMEOUT_MS = 15000;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30000;

// Estado SANITIZADO exposto ao renderer (diagnóstico). NUNCA token/ticket/deviceId/URL.
export type PresenceClientState = {
  phase: "idle" | "authenticating" | "connecting" | "connected" | "reconnecting" | "error";
  wsConnected: boolean;
  authValidated: boolean;
  service: string;
  lastConnectAt: number | null;
  lastMessageAt: number | null;
  heartbeatActive: boolean;
  baselineReceived: boolean;
  onlineCount: number;        // total de usuários on-line (do baseline agregado)
  wsEnabled: boolean;         // eco do /auth
  errorCode: string | null;   // sanitizado
  // F3.4.2A Stage-2A-X2 — DIAGNÓSTICO sanitizado (para comprovar fisicamente quem/quando fecha o socket).
  // Nenhum destes campos revela token/ticket/deviceId/UID/URL — só metadados de ciclo de vida.
  wantConnected: boolean;         // INTENÇÃO (login on / logout off) — distingue queda de "desligado"
  lastHeartbeatSentAt: number | null;  // último {t:"hb"} ENVIADO
  lastCloseCode: number | null;   // code do último fechamento de socket (ws)
  lastCloseReason: string | null; // reason sanitizado do último fechamento
  lastCloseWasClient: boolean;    // true = fechado por disconnect() (explícito); false = inesperado
  reconnectScheduled: number;     // nº de reconexões AGENDADAS
  reconnectExecuted: number;      // nº de reconexões EXECUTADAS (openOnce por reconnect)
  onlineDroppedAt: number | null; // instante em que onlineCount CAIU (para correlacionar com o log)
};

export type PresenceClientDeps = {
  userDataDir: string;
  authEndpoint?: string;                 // https://…workers.dev
  wsEndpoint?: string;                   // wss://…workers.dev/ws
  fetchImpl?: typeof fetch;              // injetável p/ teste
  WebSocketCtor?: any;                   // ctor do `ws` (main) OU stub (teste)
  now?: () => number;
  onLog?: (tag: string, data?: unknown) => void; // logger sanitizado (NUNCA recebe token)
  onState?: (state: PresenceClientState) => void; // empurra estado sanitizado ao renderer
  heartbeatMs?: number;
  timeoutMs?: number;
  setTimer?: (fn: () => void, ms: number) => any; // injetável p/ teste (default setTimeout)
  clearTimer?: (h: any) => void;
};

function wsUrlFrom(auth: string): string {
  // https://host -> wss://host/ws ; http://host -> ws://host/ws (só p/ teste local).
  const base = String(auth).replace(/\/+$/, "");
  if (base.startsWith("https://")) return "wss://" + base.slice("https://".length) + "/ws";
  if (base.startsWith("http://")) return "ws://" + base.slice("http://".length) + "/ws";
  return base + "/ws";
}
function sanitizeErr(raw: unknown, status: number): string {
  const s = String(raw == null ? "" : raw).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
  if (s) return s;
  if (status === 401) return "unauthorized";
  if (status > 0) return "bad_status_" + status;
  return "unknown";
}

export function createPresenceClient(deps: PresenceClientDeps) {
  const now = deps.now || (() => Date.now());
  const authEndpoint = String(deps.authEndpoint || DEFAULT_AUTH).replace(/\/+$/, "");
  const wsEndpoint = deps.wsEndpoint || wsUrlFrom(authEndpoint);
  const fetchImpl = deps.fetchImpl || fetch;
  const heartbeatMs = deps.heartbeatMs || DEFAULT_HEARTBEAT_MS;
  const setTimer = deps.setTimer || ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer || ((h: any) => clearTimeout(h));
  const log = (t: string, d?: unknown) => { try { if (deps.onLog) deps.onLog(t, d); } catch { /* log nunca quebra o cliente */ } };

  const st: PresenceClientState = {
    phase: "idle", wsConnected: false, authValidated: false, service: SERVICE_LABEL,
    lastConnectAt: null, lastMessageAt: null, heartbeatActive: false, baselineReceived: false,
    onlineCount: 0, wsEnabled: false, errorCode: null,
    // diagnóstico (Stage-2A-X2)
    wantConnected: false, lastHeartbeatSentAt: null, lastCloseCode: null, lastCloseReason: null,
    lastCloseWasClient: false, reconnectScheduled: 0, reconnectExecuted: 0, onlineDroppedAt: null,
  };

  let ws: any = null;
  let hbTimer: any = null;
  let reconnectTimer: any = null;
  let attempts = 0;      // p/ backoff
  let wantConnected = false; // intenção do usuário (login on / logout off)
  let generation = 0;    // invalida callbacks de conexões antigas

  // Sanitiza o "reason" do close (ws Buffer OU string): só [a-z0-9_ -], curto. NUNCA vaza dados privados.
  function sanitizeReason(raw: unknown): string | null {
    const s = (raw == null ? "" : (typeof raw === "string" ? raw : (raw as any).toString ? (raw as any).toString() : ""))
      .replace(/[^a-zA-Z0-9_ -]/g, "").trim().slice(0, 60);
    return s || null;
  }

  function pushState(): void {
    try { if (deps.onState) deps.onState(publicState()); } catch { /* emitir estado nunca quebra */ }
  }
  function publicState(): PresenceClientState { return { ...st }; }
  function set(patch: Partial<PresenceClientState>): void {
    // DIAGNÓSTICO: registra o INSTANTE em que a contagem CAIU (para correlacionar com fechamento/heartbeat).
    if (typeof patch.onlineCount === "number" && patch.onlineCount < st.onlineCount) {
      patch.onlineDroppedAt = now();
      log("presence.online.dropped", { from: st.onlineCount, to: patch.onlineCount, at: patch.onlineDroppedAt });
    }
    Object.assign(st, patch); pushState();
  }

  // ---- token + deviceId (mesmos arquivos 0600 do auth-core/probe) ----
  function readToken(): string | null {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(deps.userDataDir, "session.json"), "utf8"));
      if (j && typeof j.token === "string" && j.token) return j.token;
    } catch { /* sem sessão */ }
    return null;
  }
  function getDeviceId(): string {
    const p = path.join(deps.userDataDir, "presence-device.json");
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j && typeof j.deviceId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(j.deviceId)) return j.deviceId;
    } catch { /* gerar */ }
    const id = randomUUID();
    try { fs.writeFileSync(p, JSON.stringify({ deviceId: id, createdAt: now() }), { mode: 0o600 }); } catch { /* best-effort */ }
    return id;
  }

  function stopHeartbeat(): void {
    if (hbTimer) { try { clearTimer(hbTimer); } catch { /* */ } hbTimer = null; }
    if (st.heartbeatActive) set({ heartbeatActive: false });
  }
  function startHeartbeat(gen: number): void {
    stopHeartbeat();
    set({ heartbeatActive: true });
    const tick = () => {
      if (gen !== generation || !ws) return;
      try { ws.send(JSON.stringify({ t: "hb" })); set({ lastHeartbeatSentAt: now() }); } catch { /* socket morto: close cuidará */ }
      hbTimer = setTimer(tick, heartbeatMs);
    };
    hbTimer = setTimer(tick, heartbeatMs);
  }

  function scheduleReconnect(): void {
    if (!wantConnected) return;
    if (reconnectTimer) return; // já agendado
    const backoff = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * Math.pow(2, Math.min(attempts, 6)));
    // jitter determinístico leve (sem Math.random): varia pela tentativa.
    const jitter = (attempts % 5) * 137;
    attempts += 1;
    set({ phase: "reconnecting", wsConnected: false, reconnectScheduled: st.reconnectScheduled + 1 });
    // DIAGNÓSTICO: reconexão AGENDADA (independe da janela; roda no main mesmo oculto na bandeja).
    log("presence.reconnect.schedule", { attempts, backoffMs: backoff + jitter, wantConnected, scheduled: st.reconnectScheduled });
    reconnectTimer = setTimer(() => {
      reconnectTimer = null;
      set({ reconnectExecuted: st.reconnectExecuted + 1 });
      // DIAGNÓSTICO: reconexão EXECUTADA (o timer disparou) — prova que o main não estava suspenso.
      log("presence.reconnect.exec", { executed: st.reconnectExecuted, wantConnected });
      void openOnce();
    }, backoff + jitter);
  }

  async function openOnce(): Promise<void> {
    if (!wantConnected) return;
    const gen = ++generation; // invalida conexão anterior
    // fecha socket anterior, se houver
    if (ws) { try { ws.close(); } catch { /* */ } ws = null; }
    const token = readToken();
    if (!token) { set({ phase: "error", authValidated: false, wsConnected: false, errorCode: "no_session" }); log("presence.no_session"); return; }
    const deviceId = getDeviceId();
    set({ phase: "authenticating", errorCode: null });

    // 1) /auth -> ticket (token só aqui; nunca sai do main)
    let ticket = "", wsEnabled = false, authOk = false, errCode: string | null = null;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => { try { ctl.abort(); } catch { /* */ } }, deps.timeoutMs || DEFAULT_TIMEOUT_MS);
      try {
        const r = await fetchImpl(authEndpoint + "/auth", {
          method: "POST",
          headers: { "content-type": "application/json", "authorization": "Bearer " + token },
          body: JSON.stringify({ deviceId }), // SÓ deviceId — nunca userId/token
          signal: ctl.signal,
        });
        let j: any = null; try { j = await r.json(); } catch { /* */ }
        if (r.status === 200 && j && j.ok === true && typeof j.ticket === "string" && j.ticket) {
          ticket = j.ticket; wsEnabled = j.wsEnabled === true; authOk = true;
        } else {
          errCode = sanitizeErr(j && j.error, r.status);
        }
      } finally { clearTimeout(timer); }
    } catch (e: any) {
      errCode = (e && (e.name === "AbortError" || /abort/i.test(String((e && e.message) || "")))) ? "timeout" : "network";
    }
    if (gen !== generation) return; // conexão superada por outra
    if (!authOk) { set({ phase: "error", authValidated: false, wsConnected: false, errorCode: errCode || "auth_failed" }); log("presence.auth.fail", { errorCode: errCode }); scheduleReconnect(); return; }
    set({ authValidated: true, wsEnabled });
    if (!wsEnabled) { set({ phase: "error", errorCode: "ws_disabled" }); log("presence.ws_disabled"); return; }

    // 2) abre o WSS /ws?ticket=… (ticket na URL; nunca exposto)
    set({ phase: "connecting" });
    let sock: any;
    try { sock = new deps.WebSocketCtor(wsEndpoint + "?ticket=" + encodeURIComponent(ticket)); }
    catch (e: any) { set({ phase: "error", errorCode: "ws_open_failed" }); log("presence.ws.open.error"); scheduleReconnect(); return; }
    ws = sock;

    const onOpen = () => {
      if (gen !== generation) { try { sock.close(); } catch { /* */ } return; }
      attempts = 0; // sucesso: zera backoff
      set({ phase: "connected", wsConnected: true, lastConnectAt: now(), errorCode: null });
      log("presence.ws.open", {});
      startHeartbeat(gen);
    };
    const onMessage = (data: any) => {
      if (gen !== generation) return;
      set({ lastMessageAt: now() });
      let raw = data; try { if (data && typeof data === "object" && "data" in data) raw = (data as any).data; } catch { /* */ }
      let m: any = null;
      try { m = JSON.parse(typeof raw === "string" ? raw : (raw && raw.toString ? raw.toString() : "")); } catch { return; }
      if (m && m.type === "baseline") {
        // Baseline: substitui o estado local; NÃO notifica (entrou/saiu não existem no Stage 2A).
        const count = Array.isArray(m.users) ? m.users.length : 0;
        set({ baselineReceived: true, onlineCount: count });
        log("presence.baseline", { onlineCount: count });
      } else if (m && m.type === "presence") {
        // Broadcast=false no Stage 2A: não deveríamos receber isto. Se vier, NÃO notificamos
        // (mandato: STOP antes de entrou/saiu). Apenas ajustamos a contagem agregada.
        const delta = m.online ? 1 : -1;
        set({ onlineCount: Math.max(0, st.onlineCount + delta) });
        log("presence.transition.ignored_stage2a", { online: !!m.online });
      }
    };
    const onClose = (code?: any, reason?: any) => {
      if (gen !== generation) return;
      stopHeartbeat();
      // Aceita ws (.on close -> (code:number, reason:Buffer)) E DOM (.onclose -> (ev{code,reason})).
      const cc = typeof code === "number" ? code
        : (code && typeof code === "object" && typeof code.code === "number" ? code.code : null);
      const rr = sanitizeReason(typeof reason !== "undefined" ? reason : (code && typeof code === "object" ? code.reason : undefined));
      // onClose SÓ é atingido por fechamentos INESPERADOS: disconnect()/openOnce fazem generation++ antes de
      // fechar, invalidando o callback do socket antigo (gen !== generation acima). Logo byClient=false aqui.
      set({ wsConnected: false, lastCloseCode: cc, lastCloseReason: rr, lastCloseWasClient: false });
      // DIAGNÓSTICO: fechamento INESPERADO — código/motivo + intenção. Responde "quem fechou (não o cliente) /
      // código e motivo" e correlaciona com a queda da contagem.
      log("presence.ws.close", { code: cc, reason: rr, byClient: false, wantConnected });
      ws = null;
      scheduleReconnect();
    };
    const onError = (err?: any) => {
      if (gen !== generation) return;
      // erro SANITIZADO (só um código curto; nunca a mensagem crua que pode conter host/URL).
      const ec = sanitizeReason(err && (err.code || err.type || (err.message && String(err.message).split(/\s+/)[0]))) || "ws_error";
      set({ errorCode: ec });
      log("presence.ws.error", { errorCode: ec });
      try { sock.close(); } catch { /* onClose fará o reconnect */ }
    };

    // Suporta tanto a API `ws` (.on) quanto WebSocket DOM (.addEventListener/onX) — p/ testes.
    if (typeof sock.on === "function") {
      sock.on("open", onOpen);
      sock.on("message", (d: any) => onMessage(d));
      sock.on("close", (code: any, reason: any) => onClose(code, reason));
      sock.on("error", (err: any) => onError(err));
    } else {
      sock.onopen = onOpen;
      sock.onmessage = (ev: any) => onMessage(ev);
      sock.onclose = onClose;
      sock.onerror = onError;
    }
  }

  function connect(): void {
    const was = wantConnected;
    wantConnected = true;
    if (!was) { set({ wantConnected: true }); log("presence.intent.connect", {}); } // INTENÇÃO false->true
    if (st.phase === "connecting" || st.phase === "connected" || st.phase === "authenticating") return; // guarda (idempotente)
    if (reconnectTimer) { try { clearTimer(reconnectTimer); } catch { /* */ } reconnectTimer = null; }
    attempts = 0;
    void openOnce();
  }
  function disconnect(): void {
    const was = wantConnected;
    wantConnected = false;
    if (was) { set({ wantConnected: false }); log("presence.intent.disconnect", {}); } // INTENÇÃO true->false (EXPLÍCITO)
    generation++; // invalida callbacks pendentes
    if (reconnectTimer) { try { clearTimer(reconnectTimer); } catch { /* */ } reconnectTimer = null; }
    stopHeartbeat();
    // Fechamento EXPLÍCITO: generation++ (acima) já invalidou o onClose do socket; então gravamos o
    // diagnóstico do close aqui mesmo (byClient=true, code 1000). Distingue de queda inesperada.
    if (ws) { try { ws.close(1000, "logout"); } catch { /* */ } ws = null; }
    set({ phase: "idle", wsConnected: false, authValidated: false, baselineReceived: false, onlineCount: 0, errorCode: null,
      lastCloseCode: 1000, lastCloseReason: "logout", lastCloseWasClient: true });
    log("presence.disconnect", { code: 1000, reason: "logout", byClient: true });
  }

  return {
    connect,
    disconnect,
    getState: (): PresenceClientState => publicState(),
    isConnected: (): boolean => st.wsConnected,
  };
}
