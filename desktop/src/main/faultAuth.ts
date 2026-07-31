/**
 * F3.5.4N — faultAuth.ts — AUTORIZAÇÃO LOCAL do fault-injection (100% no MAIN, no dispositivo
 * autorizado; SEM chave externa, SEM ferramenta externa, SEM ação técnica do owner).
 * =====================================================================================
 * Modelo de defesa em profundidade (reforços do owner):
 *  - safeStorage protege APENAS o segredo em disco; NÃO é, sozinho, a autorização.
 *  - Segredo e TODA cripto vivem SÓ neste módulo (main process). O renderer/preload NUNCA
 *    recebem segredo, conteúdo descriptografado, chave, token, nonce, decrypt genérico ou caminho.
 *  - "Não confiar só em channel === f354n": a INSCRIÇÃO local (cifrada por safeStorage) carrega
 *    deviceId, canal, versão, issuedAt, expiresAt, nonce, estado de uso e admin (mascarado).
 *    Só é criada pelo fluxo administrativo do canal interno autorizado.
 *  - AUTORIZAÇÃO TEMPORÁRIA ("Preparar teste"): só em memória do main, exp ≤10min, uso único.
 *    "Executar teste" consome (uso único) e marca a inscrição como usada.
 *  - Invalidação: logout / troca de usuário / troca p/ Latest / expirar / fechar/reiniciar →
 *    autorização temporária cai (memória) e a inscrição pode ser removida (removeEnrollment()).
 *  - Fail-closed: sem safeStorage, sem inscrição válida (device+canal+versão+não expirada+não
 *    usada), ou sem autorização viva ⇒ tudo negado. Injetável (secure/store/now/rng) → testável.
 */
export type SecureStore = {
  isAvailable: () => boolean;         // safeStorage.isEncryptionAvailable()
  encrypt: (plain: string) => Buffer; // safeStorage.encryptString
  decrypt: (buf: Buffer) => string;   // safeStorage.decryptString
};
export type EnrollStore = {
  readB64: () => string | null;
  writeB64: (b64: string) => void;
  clear: () => void;
};
export type FaultAuthDeps = {
  secure: SecureStore;
  store: EnrollStore;
  now?: () => number;
  rng?: (n: number) => string;
  onLog?: (tag: string, data?: unknown) => void;
  prepareTtlMs?: number;    // autorização temporária (default 10min)
  enrollTtlMs?: number;     // validade da inscrição (default 30min)
  candidateVersion?: string; // versão da candidata que habilita a inscrição (default 1.0.204)
  internalChannel?: string;  // canal interno que habilita a inscrição (default f354n)
};

const DEFAULT_PREPARE_TTL = 10 * 60 * 1000;
const DEFAULT_ENROLL_TTL = 30 * 60 * 1000;

type Enrollment = { deviceId: string; channel: string; version: string; issuedAt: number; expiresAt: number; nonce: string; used: boolean; admin: string; secret: string };
type Prepared = { deviceId: string; channel: string; version: string; exp: number; nonce: string; used: boolean };

export function createFaultAuth(deps: FaultAuthDeps) {
  const now = deps.now || (() => Date.now());
  const prepareTtl = deps.prepareTtlMs || DEFAULT_PREPARE_TTL;
  const enrollTtl = deps.enrollTtlMs || DEFAULT_ENROLL_TTL;
  const CANDIDATE = deps.candidateVersion || "1.0.204";
  const CHANNEL = deps.internalChannel || "f354n";
  const log = deps.onLog || (() => { /* */ });
  const rng = deps.rng || ((n: number) => { try { return require("crypto").randomBytes(n).toString("hex"); } catch { return String(now()) + ":" + n; } });

  let prepared: Prepared | null = null; // SÓ em memória do main

  function isSupported(): boolean { try { return !!deps.secure.isAvailable(); } catch { return false; } }

  // Leitura/decrypt SÓ aqui (main). Nunca retornado ao renderer.
  function readEnrollment(): Enrollment | null {
    try {
      const b64 = deps.store.readB64(); if (!b64) return null;
      const o = JSON.parse(deps.secure.decrypt(Buffer.from(b64, "base64")));
      if (o && typeof o.deviceId === "string" && typeof o.secret === "string" && typeof o.channel === "string") return o as Enrollment;
    } catch { /* fail-closed */ }
    return null;
  }
  function writeEnrollment(e: Enrollment): boolean {
    try { deps.store.writeB64(deps.secure.encrypt(JSON.stringify(e)).toString("base64")); return true; } catch { return false; }
  }

  /** Inscrição válida p/ este device+canal+versão, não expirada e não usada? */
  function enrollmentValid(deviceId: string, channel: string, version: string): boolean {
    const e = readEnrollment();
    return !!(e && e.deviceId === deviceId && e.channel === channel && e.version === version
      && channel === CHANNEL && version === CANDIDATE && !e.used && now() < e.expiresAt);
  }

  return {
    isSupported,
    enrollmentValid,

    /** Fluxo admin do canal interno: cria a INSCRIÇÃO cifrada (device+canal+versão+expiração). */
    enroll(input: { deviceId: string; channel: string; version: string; admin: string }): { ok: boolean; reason?: string } {
      if (!isSupported()) return { ok: false, reason: "unsupported" };
      if (input.channel !== CHANNEL) return { ok: false, reason: "channel" };
      if (input.version !== CANDIDATE) return { ok: false, reason: "version" };
      if (!input.deviceId) return { ok: false, reason: "device" };
      const t = now();
      const e: Enrollment = { deviceId: input.deviceId, channel: input.channel, version: input.version, issuedAt: t, expiresAt: t + enrollTtl, nonce: rng(16), used: false, admin: String(input.admin || "").slice(0, 3) + "…", secret: rng(32) };
      if (!writeEnrollment(e)) return { ok: false, reason: "encrypt" };
      log("listener.faultauth.enrolled", { device: mask(input.deviceId), channel: input.channel, version: input.version });
      return { ok: true };
    },

    /** Remove a inscrição (troca p/ Latest, logout, troca de usuário, política de limpeza). */
    removeEnrollment(reason: string): void { try { deps.store.clear(); } catch { /* */ } prepared = null; log("listener.faultauth.enroll.removed", { reason }); },

    /** "Preparar teste": arma autorização temporária (memória) se a inscrição for válida. */
    prepare(deviceId: string, channel: string, version: string): { ok: boolean; reason?: string; exp?: number } {
      if (!isSupported()) return { ok: false, reason: "unsupported" };
      if (!enrollmentValid(deviceId, channel, version)) return { ok: false, reason: "not_enrolled" };
      prepared = { deviceId, channel, version, exp: now() + prepareTtl, nonce: rng(12), used: false };
      log("listener.faultauth.prepared", { device: mask(deviceId), ttlMs: prepareTtl });
      return { ok: true, exp: prepared.exp };
    },

    /** "Executar teste": consome (uso único) — exige inscrição válida + autorização viva. */
    consume(deviceId: string, channel: string, version: string): { ok: boolean; reason?: string; nonce?: string } {
      const p = prepared;
      if (!p) return { ok: false, reason: "no_auth" };
      if (p.used) return { ok: false, reason: "used" };
      if (now() >= p.exp) { prepared = null; return { ok: false, reason: "expired" }; }
      if (p.deviceId !== deviceId || p.channel !== channel || p.version !== version || !deviceId) return { ok: false, reason: "mismatch" };
      if (!enrollmentValid(deviceId, channel, version)) return { ok: false, reason: "not_enrolled" };
      p.used = true;
      const e = readEnrollment(); if (e) { e.used = true; writeEnrollment(e); } // uso único também na inscrição
      log("listener.faultauth.consumed", { device: mask(deviceId) });
      return { ok: true, nonce: p.nonce };
    },

    /** Cancela a autorização viva (botão Cancelar / troca de canal / teardown). */
    invalidate(reason: string): void { if (prepared) { prepared = null; log("listener.faultauth.invalidated", { reason }); } },

    /** Estado SANITIZADO p/ o main decidir UI/IPC — NUNCA segredo/nonce/decrypt/caminho. */
    status(deviceId: string, channel: string, version: string): { supported: boolean; enrolled: boolean; prepared: boolean; expiresAt: number } {
      const alive = !!(prepared && !prepared.used && now() < prepared.exp && prepared.deviceId === deviceId && prepared.channel === channel && prepared.version === version);
      return { supported: isSupported(), enrolled: enrollmentValid(deviceId, channel, version), prepared: alive, expiresAt: alive && prepared ? prepared.exp : 0 };
    },
  };
}

function mask(s: string): string { const v = String(s || ""); return v.length <= 6 ? "***" : v.slice(0, 3) + "…" + v.slice(-2); }
