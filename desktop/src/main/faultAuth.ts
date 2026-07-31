/**
 * F3.5.4N — faultAuth.ts — AUTORIZAÇÃO LOCAL do fault-injection (100% dentro do Agenda, no
 * computador autorizado; SEM chave externa, SEM ferramenta externa, SEM ação técnica do owner).
 * =====================================================================================
 * Toda a autorização é criada DENTRO do app, no dispositivo autorizado, protegida pelo WINDOWS
 * (Electron safeStorage → DPAPI). Nenhum segredo é exportado, exibido, logado ou enviado; nada
 * entra em GitHub/app.asar/artifacts; não é compartilhável entre dispositivos.
 *
 * Duas camadas:
 *  (1) ENROLAMENTO do dispositivo — grava um segredo aleatório CIFRADO por safeStorage (DPAPI é
 *      atrelado ao usuário+máquina: o ciphertext não decifra em outro computador). É a prova de
 *      "dispositivo autorizado". Criado só quando o admin ativa o Diagnóstico administrativo no
 *      canal interno F3.5.4N.
 *  (2) AUTORIZAÇÃO TEMPORÁRIA — "Preparar teste" cria uma autorização só em MEMÓRIA do processo
 *      main: exp ≤10min, nonce, USO ÚNICO, vinculada ao deviceId. "Executar teste real" a CONSOME.
 *      Logout / troca de canal / fechar/reiniciar o app a invalidam (memória + invalidate()).
 *
 * Fail-closed: sem safeStorage disponível, sem enrolamento válido, ou sem autorização viva, tudo
 * é negado — nenhuma assinatura é interrompida. Injetável (secure/store/now/rng) → testável.
 */
export type SecureStore = {
  isAvailable: () => boolean;      // safeStorage.isEncryptionAvailable()
  encrypt: (plain: string) => Buffer;   // safeStorage.encryptString
  decrypt: (buf: Buffer) => string;     // safeStorage.decryptString
};
export type EnrollStore = {
  readB64: () => string | null;    // ciphertext (base64) do enrolamento, se houver
  writeB64: (b64: string) => void;
  clear: () => void;
};
export type FaultAuthDeps = {
  secure: SecureStore;
  store: EnrollStore;
  now?: () => number;
  rng?: (n: number) => string;     // hex aleatório (default crypto.randomBytes)
  onLog?: (tag: string, data?: unknown) => void;
  ttlMs?: number;                  // default 10min
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;

type PreparedAuth = { deviceId: string; exp: number; nonce: string; used: boolean };

export function createFaultAuth(deps: FaultAuthDeps) {
  const now = deps.now || (() => Date.now());
  const ttl = deps.ttlMs || DEFAULT_TTL_MS;
  const log = deps.onLog || (() => { /* */ });
  const rng = deps.rng || ((n: number) => { try { return require("crypto").randomBytes(n).toString("hex"); } catch { return String(now()) + ":" + n; } });

  let prepared: PreparedAuth | null = null;

  function isSupported(): boolean { try { return !!deps.secure.isAvailable(); } catch { return false; } }

  function readEnroll(): { deviceId: string; secret: string; at: number } | null {
    try {
      const b64 = deps.store.readB64(); if (!b64) return null;
      const plain = deps.secure.decrypt(Buffer.from(b64, "base64")); // só decifra na mesma máquina/usuário
      const o = JSON.parse(plain);
      if (o && typeof o.deviceId === "string" && typeof o.secret === "string") return o;
    } catch { /* fail-closed */ }
    return null;
  }

  function isDeviceEnrolled(deviceId: string): boolean {
    if (!deviceId) return false;
    const e = readEnroll();
    return !!(e && e.deviceId === deviceId);
  }

  return {
    isSupported,
    isDeviceEnrolled,

    /** Admin ativa o Diagnóstico administrativo neste dispositivo (grava enrolamento cifrado). */
    enroll(deviceId: string): { ok: boolean; reason?: string } {
      if (!isSupported()) { log("listener.faultauth.unsupported", {}); return { ok: false, reason: "unsupported" }; }
      if (!deviceId) return { ok: false, reason: "device" };
      try {
        const rec = JSON.stringify({ deviceId, secret: rng(32), at: now() });
        deps.store.writeB64(deps.secure.encrypt(rec).toString("base64"));
        log("listener.faultauth.enrolled", { device: mask(deviceId) });
        return { ok: true };
      } catch (e) { return { ok: false, reason: "encrypt" }; }
    },

    /** Admin desativa (limpa enrolamento e qualquer autorização viva). */
    unenroll(): void { try { deps.store.clear(); } catch { /* */ } prepared = null; log("listener.faultauth.unenrolled", {}); },

    /** "Preparar teste": cria autorização temporária (memória) se enrolado + suportado. */
    prepare(deviceId: string): { ok: boolean; reason?: string; exp?: number } {
      if (!isSupported()) return { ok: false, reason: "unsupported" };
      if (!isDeviceEnrolled(deviceId)) return { ok: false, reason: "not_enrolled" };
      prepared = { deviceId, exp: now() + ttl, nonce: rng(12), used: false };
      log("listener.faultauth.prepared", { device: mask(deviceId), ttlMs: ttl });
      return { ok: true, exp: prepared.exp };
    },

    /** "Executar teste real": consome a autorização (uso único). */
    consume(deviceId: string): { ok: boolean; reason?: string; nonce?: string } {
      const p = prepared;
      if (!p) return { ok: false, reason: "no_auth" };
      if (p.used) return { ok: false, reason: "used" };
      if (now() >= p.exp) { prepared = null; return { ok: false, reason: "expired" }; }
      if (p.deviceId !== deviceId || !deviceId) return { ok: false, reason: "device" };
      p.used = true;
      log("listener.faultauth.consumed", { device: mask(deviceId) });
      return { ok: true, nonce: p.nonce };
    },

    /** Invalida a autorização viva (logout / troca de canal / teardown). */
    invalidate(reason: string): void { if (prepared) { prepared = null; log("listener.faultauth.invalidated", { reason }); } },

    status(deviceId: string): { supported: boolean; enrolled: boolean; prepared: boolean; exp: number } {
      const alive = !!(prepared && !prepared.used && now() < prepared.exp && prepared.deviceId === deviceId);
      return { supported: isSupported(), enrolled: isDeviceEnrolled(deviceId), prepared: alive, exp: alive && prepared ? prepared.exp : 0 };
    },
  };
}

function mask(s: string): string { const v = String(s || ""); return v.length <= 6 ? "***" : v.slice(0, 3) + "…" + v.slice(-2); }
