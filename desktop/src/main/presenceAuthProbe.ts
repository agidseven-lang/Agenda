/**
 * Agenda ID Seven Desktop — Sonda de AUTENTICAÇÃO de presença (F3.4.2A, Escopo D mínimo)
 * ---------------------------------------------------------------------------
 * Cliente MÍNIMO do Worker canário isolado `idseven-presence-canary` (só /auth).
 * Prova, com a SESSÃO REAL do owner, que o Worker valida a identidade pelo
 * getUserSelf EXISTENTE — SEM ativar WebSocket, heartbeat, Durable Object,
 * presença on-line/off-line, nem a tela Equipe. É uma sonda de diagnóstico.
 *
 * REGRAS INEGOCIÁVEIS (mandato F3.4.2A):
 *   - O token de sessão vive SOMENTE no processo MAIN. Esta sonda lê o MESMO
 *     userData/session.json (mode 0600) que o auth-core escreve e usa o token
 *     apenas no header Authorization. NUNCA loga, NUNCA persiste em novo arquivo,
 *     NUNCA copia p/ clipboard, NUNCA envia ao renderer, NUNCA entra no diagnóstico.
 *   - O corpo do POST leva SOMENTE { deviceId }. NÃO envia userId/name/role/email/
 *     token — a identidade vem SOMENTE do getUserSelf (userId do body é IGNORADO
 *     pelo Worker). "Não confiar apenas no userId enviado pelo renderer".
 *   - deviceId = UUID aleatório (crypto.randomUUID) persistido em
 *     userData/presence-device.json (0600). NUNCA hostname/MAC/IP/serial.
 *   - O resultado ao renderer é SANITIZADO: só booleans/status/duração. NUNCA
 *     token/ticket/headers/corpo cru/UID aberto/e-mail/URL.
 *   - Sem polling: só dispara por chamada explícita (IPC) ou 1 sonda pós-login.
 *   - Guarda de concorrência: uma sonda por vez (a 2ª retorna errorCode=busy).
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

// URL do Worker canário (workers.dev público; sem segredo). Override só p/ teste.
const DEFAULT_ENDPOINT = process.env.IDS_PRESENCE_URL || "https://idseven-presence-canary.agidseven.workers.dev";
const SERVICE_LABEL = "idseven-presence-canary";
const DEFAULT_TIMEOUT_MS = 15000;

// Campos de identidade que a UI reporta como presentes/ausentes (SÓ presença, nunca valor).
export type RequiredFields = {
  id: boolean; name: boolean; role: boolean; admin: boolean; status: boolean; photo: boolean; color: boolean;
};
export type PresenceProbeResult = {
  validated: boolean;              // 200 + ok:true + identidade com id (identidade validada pelo getUserSelf)
  httpStatus: number;              // status HTTP do /auth (0 = rede/timeout)
  durationMs: number;              // latência da chamada
  requiredFieldsPresent: RequiredFields; // presença (boolean) de cada campo — NUNCA o valor
  testedAt: number;                // quando a sonda rodou (ms)
  errorCode: string | null;        // null no sucesso; código seguro caso contrário
  service: string;                 // rótulo do serviço (sem URL)
  wsEnabled: boolean;              // eco do server: confirma que o WS continua DESLIGADO (stage 1)
};

export type PresenceProbeDeps = {
  userDataDir: string;                 // app.getPath("userData")
  endpoint?: string;                   // override p/ teste
  fetchImpl?: typeof fetch;            // injetável p/ teste
  now?: () => number;                  // injetável p/ teste
  onLog?: (tag: string, data?: unknown) => void; // logger sanitizado (NUNCA recebe token)
  timeoutMs?: number;
};

const EMPTY_FIELDS: RequiredFields = { id: false, name: false, role: false, admin: false, status: false, photo: false, color: false };

// Campo "presente" = existe, não-nulo e não-vazio (string). Booleans tratados à parte (false conta).
function hasField(o: any, k: string): boolean {
  return !!o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null && o[k] !== "";
}
// Normaliza o código de erro do server p/ um token SEGURO (só [a-z0-9_], curto). Nunca vaza corpo.
function sanitizeErr(raw: unknown, status: number): string {
  const s = String(raw == null ? "" : raw).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
  if (s) return s;
  if (status === 401) return "unauthorized";
  if (status > 0) return "bad_status_" + status;
  return "unknown";
}
function countTrue(f: RequiredFields): number { return Object.values(f).filter(Boolean).length; }

export function createPresenceProbe(deps: PresenceProbeDeps) {
  const now = deps.now || (() => Date.now());
  const endpoint = String(deps.endpoint || DEFAULT_ENDPOINT).replace(/\/+$/, "");
  const fetchImpl = deps.fetchImpl || fetch;
  const log = (t: string, d?: unknown) => { try { if (deps.onLog) deps.onLog(t, d); } catch { /* log nunca quebra a sonda */ } };
  let inFlight = false;

  // Lê o token do MESMO session.json (0600) do auth-core. O token FICA no main.
  function readToken(): string | null {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(deps.userDataDir, "session.json"), "utf8"));
      if (j && typeof j.token === "string" && j.token) return j.token;
    } catch { /* sem sessão salva */ }
    return null;
  }
  // deviceId estável = UUID persistido (0600). NUNCA hostname/MAC/IP/serial.
  function getDeviceId(): string {
    const p = path.join(deps.userDataDir, "presence-device.json");
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j && typeof j.deviceId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(j.deviceId)) return j.deviceId;
    } catch { /* gerar abaixo */ }
    const id = randomUUID();
    try { fs.writeFileSync(p, JSON.stringify({ deviceId: id, createdAt: now() }), { mode: 0o600 }); } catch { /* persistência best-effort */ }
    return id;
  }

  async function probe(): Promise<PresenceProbeResult> {
    const testedAt = now();
    const base: PresenceProbeResult = {
      validated: false, httpStatus: 0, durationMs: 0, requiredFieldsPresent: { ...EMPTY_FIELDS },
      testedAt, errorCode: null, service: SERVICE_LABEL, wsEnabled: false,
    };
    if (inFlight) { log("presence.probe.busy"); return { ...base, errorCode: "busy" }; }
    const token = readToken();
    if (!token) { log("presence.probe.no_session"); return { ...base, errorCode: "no_session" }; }
    inFlight = true;
    const deviceId = getDeviceId();
    const t0 = now();
    const ctl = new AbortController();
    const timer = setTimeout(() => { try { ctl.abort(); } catch { /* */ } }, deps.timeoutMs || DEFAULT_TIMEOUT_MS);
    try {
      const r = await fetchImpl(endpoint + "/auth", {
        method: "POST",
        headers: { "content-type": "application/json", "authorization": "Bearer " + token },
        body: JSON.stringify({ deviceId }), // SÓ deviceId — NUNCA userId/name/role/email/token
        signal: ctl.signal,
      });
      const httpStatus = r.status;
      let j: any = null;
      try { j = await r.json(); } catch { /* corpo não-JSON */ }
      const durationMs = now() - t0;
      if (!j || typeof j !== "object") {
        const errorCode = httpStatus === 200 ? "invalid_json" : "bad_status_" + httpStatus;
        log("presence.probe.done", { httpStatus, durationMs, validated: false, fields: 0, errorCode });
        return { ...base, httpStatus, durationMs, errorCode };
      }
      const idn = (j.identity && typeof j.identity === "object") ? j.identity : {};
      const rfp: RequiredFields = {
        id: hasField(idn, "id"), name: hasField(idn, "name"), role: hasField(idn, "role"),
        admin: typeof idn.admin === "boolean", status: hasField(idn, "status"),
        photo: hasField(idn, "photo"), color: hasField(idn, "color"),
      };
      const validated = httpStatus === 200 && j.ok === true && rfp.id === true;
      const errorCode = validated ? null : sanitizeErr(j.error, httpStatus);
      const wsEnabled = j.wsEnabled === true;
      // LOG SANITIZADO: sem token, sem uid aberto, sem e-mail, sem corpo completo.
      log("presence.probe.done", { httpStatus, durationMs, validated, fields: countTrue(rfp), wsEnabled, errorCode });
      return { validated, httpStatus, durationMs, requiredFieldsPresent: rfp, testedAt, errorCode, service: SERVICE_LABEL, wsEnabled };
    } catch (e: any) {
      const durationMs = now() - t0;
      const aborted = !!(e && (e.name === "AbortError" || /abort/i.test(String((e && e.message) || ""))));
      const errorCode = aborted ? "timeout" : "network";
      log("presence.probe.error", { durationMs, errorCode });
      return { ...base, durationMs, errorCode };
    } finally {
      clearTimeout(timer);
      inFlight = false;
    }
  }

  return { probe, isBusy: () => inFlight };
}
