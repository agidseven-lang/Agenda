/**
 * F3.3.77A-R4B — RELÓGIO CANÔNICO por cabeçalho HTTP `Date` (Cloud Run read-only).
 * ---------------------------------------------------------------------------------
 * Desktop-only, no PROCESSO MAIN. NÃO usa Firestore/Rules/Firebase Auth, NÃO cria endpoint,
 * NÃO toca Worker/Cloud Functions e NÃO altera backend.
 *
 * Deriva um OFFSET de relógio de servidor a partir do cabeçalho `Date` de um endpoint Cloud Run
 * JÁ EXISTENTE e read-only (getUserSelf). A SONDA é feita SEM autenticação de propósito: uma
 * requisição sem token é rejeitada (401/403) ANTES de qualquer lógica de negócio ⇒ ZERO mutação
 * de usuário / lastSeen — a propriedade read-only fica GARANTIDA POR CONSTRUÇÃO (não depende de
 * prova server-side, que não é verificável a partir do repositório do Desktop). O cabeçalho `Date`
 * (RFC 7231; sempre emitido pelo Google Front End) vem em TODA resposta, inclusive nas de erro.
 *
 * offset = serverDateMs − midpoint(t0Wall, t1Wall). O `Date` HTTP tem resolução de SEGUNDOS, então a
 * incerteza é rtt/2 + 1000ms; quality só é "synced" quando incerteza ≤ 2000ms. Escolhe a MEDIANA das
 * três amostras de menor RTT. Fallback: mantém o último offset dentro do TTL (stale) ou cai para o
 * relógio local (local_fallback), SEM afirmar sincronização entre máquinas.
 *
 * O estado canônico vive aqui (main); o renderer recebe APENAS {offsetMs, quality, syncedAt,
 * uncertaintyMs, source} por IPC e alimenta canonicalNowMs()/_slaClockOffsetMs.
 */
import { diag } from "./diag";

// URL do endpoint Cloud Run EXISTENTE (getUserSelf). Mesma fonte do auth-core; override p/ testes.
const SELF_URL = process.env.IDS_AUTH_SELF_URL || "https://getuserself-de36pi7vza-uc.a.run.app";
const HTTP_TIMEOUT_MS = 8000;
const RTT_LIMIT_MS = 4000;            // amostra com RTT acima disso é descartada
const UNCERTAINTY_SYNCED_MS = 2000;   // tolerância cross-machine comprovada (FASE 5)
const HTTP_DATE_RESOLUTION_MS = 1000; // cabeçalho Date é resolução de segundos
const OFFSET_TTL_MS = 30 * 60 * 1000; // 30min: além disso o offset vira local_fallback (FASE 13)
const PERIODIC_MS = 10 * 60 * 1000;   // ressync a cada 10min (FASE 10)
const JUMP_CHECK_MS = 30 * 1000;      // varredura de salto de relógio (FASE 11)
const JUMP_THRESHOLD_MS = 2000;       // |wallElapsed − monoElapsed| acima disso = salto detectado
const LOGIN_SAMPLES = 5;              // amostras no login (FASE 6)
const CYCLE_SAMPLES = 3;              // amostras em resume/unlock/periódico (FASE 6)
const SAMPLE_GAP_MS = 250;            // intervalo curto entre amostras (sem sobrepor requisições)

export type Quality = "synced" | "degraded" | "stale" | "local_fallback" | "error";

export type RawProbe = {
  ok: boolean;
  status: number;
  serverDateMs: number;   // epoch ms do cabeçalho Date (0 se ausente/inválido)
  t0Wall: number;         // Date.now() antes
  t1Wall: number;         // Date.now() depois
  t0Mono: number;         // performance.now() antes
  t1Mono: number;         // performance.now() depois
  ageSeconds: number;     // cabeçalho Age (>0 = resposta cacheada); -1 se ausente
  error?: string;
};

export type ClockState = {
  offsetMs: number;
  syncedAtSystemMs: number;
  syncedAtMonotonicMs: number;
  roundTripMs: number;
  uncertaintyMs: number;
  sampleCount: number;
  quality: Quality;
  source: string;         // "cloud_run_http_date"
  endpointId: string;     // host sanitizado (sem query/token)
  error?: string;
};

type Sample = { offsetMs: number; rttMs: number };

// ───────────────────────── PUROS (testáveis sem rede) ─────────────────────────

/** Valida UMA amostra e retorna {offsetMs, rttMs} ou null. Rejeita: erro, Date inválido, cache
 *  (Age>0), RTT negativo/excessivo, status inseguro. offset = serverDate − midpoint(wall). */
export function evalSample(p: RawProbe, rttLimitMs: number): Sample | null {
  if (!p || !p.ok) return null;
  if (!Number.isFinite(p.serverDateMs) || p.serverDateMs <= 0) return null;
  if (p.ageSeconds > 0) return null;                       // resposta servida de cache
  if (!(p.status >= 200 && p.status < 500)) return null;   // 5xx = servidor instável
  const rttMs = p.t1Mono - p.t0Mono;
  if (!(rttMs >= 0) || rttMs > rttLimitMs) return null;
  const midpointMs = (p.t0Wall + p.t1Wall) / 2;
  return { offsetMs: p.serverDateMs - midpointMs, rttMs };
}

/** Incerteza estimada: metade do RTT + a resolução de 1s do cabeçalho Date. */
export function uncertaintyOf(rttMs: number): number {
  return rttMs / 2 + HTTP_DATE_RESOLUTION_MS;
}

/** Mediana dos offsets das TRÊS amostras de MENOR RTT (não usa média de amostras díspares). */
export function chooseOffset(samples: Sample[]): Sample | null {
  const valid = samples.filter((s) => s && Number.isFinite(s.offsetMs));
  if (!valid.length) return null;
  const byRtt = valid.slice().sort((a, b) => a.rttMs - b.rttMs);
  const best = byRtt.slice(0, Math.min(3, byRtt.length));
  const offsets = best.map((s) => s.offsetMs).sort((a, b) => a - b);
  const medianOffset = offsets[Math.floor(offsets.length / 2)];
  // RTT representativo = o menor entre os escolhidos (define a incerteza mais justa)
  const rttMs = best[0].rttMs;
  return { offsetMs: medianOffset, rttMs };
}

/** synced quando a incerteza ≤ tolerância; senão degraded. */
export function qualityOf(uncertaintyMs: number): Quality {
  return uncertaintyMs <= UNCERTAINTY_SYNCED_MS ? "synced" : "degraded";
}

function sanitizeHost(url: string): string {
  try { return new URL(url).host; } catch { return "endpoint"; }
}

// ───────────────────────── SONDA REAL (unauth, zero mutação) ─────────────────────────

async function defaultProbe(): Promise<RawProbe> {
  const t0Wall = Date.now(), t0Mono = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), HTTP_TIMEOUT_MS);
  try {
    // SEM Authorization: rejeitada antes da lógica de negócio ⇒ nenhuma mutação/lastSeen.
    const r = await fetch(SELF_URL, {
      method: "GET",
      headers: { "Cache-Control": "no-store", "Pragma": "no-cache" },
      cache: "no-store",
      signal: ctl.signal,
    } as any);
    const t1Wall = Date.now(), t1Mono = performance.now();
    const dateHdr = r.headers.get("date") || "";
    const ageHdr = r.headers.get("age");
    const serverDateMs = dateHdr ? Date.parse(dateHdr) : NaN;
    try { await r.arrayBuffer(); } catch { /* drena o corpo sem inspecioná-lo */ }
    return {
      ok: Number.isFinite(serverDateMs) && serverDateMs > 0,
      status: r.status,
      serverDateMs: Number.isFinite(serverDateMs) ? serverDateMs : 0,
      t0Wall, t1Wall, t0Mono, t1Mono,
      ageSeconds: ageHdr != null ? Number(ageHdr) : -1,
    };
  } catch (e) {
    const t1Wall = Date.now(), t1Mono = performance.now();
    return { ok: false, status: 0, serverDateMs: 0, t0Wall, t1Wall, t0Mono, t1Mono, ageSeconds: -1, error: String((e as any)?.name || "network") };
  } finally { clearTimeout(timer); }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ClockSyncOpts = {
  probe?: () => Promise<RawProbe>;                 // injetável p/ testes
  emit?: (state: ClockState) => void;              // main -> renderer
  onLog?: (tag: string, data?: unknown) => void;   // diag sanitizado
};

export function createClockSync(opts?: ClockSyncOpts) {
  const probe = (opts && opts.probe) || defaultProbe;
  const emit = (opts && opts.emit) || (() => { /* */ });
  const log = (opts && opts.onLog) || ((t: string, d?: unknown) => { try { diag(t, d as any); } catch { /* */ } });
  const endpointId = sanitizeHost(SELF_URL);

  let state: ClockState = {
    offsetMs: 0, syncedAtSystemMs: 0, syncedAtMonotonicMs: 0, roundTripMs: 0,
    uncertaintyMs: 0, sampleCount: 0, quality: "local_fallback", source: "cloud_run_http_date",
    endpointId,
  };
  let periodicTimer: ReturnType<typeof setInterval> | null = null;
  let jumpTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let lastJumpWall = Date.now(), lastJumpMono = performance.now();

  function publish(): void { try { emit({ ...state }); } catch { /* */ } }

  /** Rebaixa para stale/local_fallback conforme a idade do último offset (FASE 13). */
  function ageDown(): void {
    if (state.syncedAtSystemMs <= 0) { state.quality = "local_fallback"; state.offsetMs = 0; return; }
    const ageMs = Date.now() - state.syncedAtSystemMs;
    if (ageMs > OFFSET_TTL_MS) {
      state.quality = "local_fallback"; state.offsetMs = 0;
      log("clock.fallback.local", { offsetAgeMs: ageMs, endpointId });
    } else if (state.quality === "synced" || state.quality === "degraded") {
      // mantém synced/degraded até a próxima sync; nada a fazer
    } else {
      state.quality = "stale";
    }
  }

  async function collect(n: number): Promise<Sample[]> {
    const out: Sample[] = [];
    for (let i = 0; i < n; i++) {
      let raw: RawProbe;
      try { raw = await probe(); } catch (e) { raw = { ok: false, status: 0, serverDateMs: 0, t0Wall: Date.now(), t1Wall: Date.now(), t0Mono: performance.now(), t1Mono: performance.now(), ageSeconds: -1, error: "throw" }; }
      const s = evalSample(raw, RTT_LIMIT_MS);
      log("clock.sync.sample", { sampleNumber: i + 1, accepted: !!s, status: raw.status, roundTripMs: Math.round(raw.t1Mono - raw.t0Mono), ageSeconds: raw.ageSeconds, hadDate: raw.serverDateMs > 0 });
      if (!raw.serverDateMs) log("clock.sync.reject.pending", { sampleNumber: i + 1 });
      if (raw.ageSeconds > 0) log("clock.sync.reject.cache", { sampleNumber: i + 1, ageSeconds: raw.ageSeconds });
      if (s) out.push(s);
      if (i < n - 1) await sleep(SAMPLE_GAP_MS);
    }
    return out;
  }

  async function sync(sampleCount: number, reason: string): Promise<ClockState> {
    if (inFlight) { log("clock.sync.skip", { reason: "in-flight" }); return { ...state }; }
    inFlight = true;
    log("clock.sync.start", { reason, sampleCount, endpointId });
    try {
      const samples = await collect(sampleCount);
      const chosen = chooseOffset(samples);
      if (!chosen) {
        // Nenhuma amostra válida — preserva offset anterior dentro do TTL, senão local_fallback.
        ageDown();
        state.error = "no_valid_sample";
        if (state.quality !== "local_fallback") state.quality = "stale";
        log("clock.sync.error", { reason, quality: state.quality, endpointId });
        publish();
        return { ...state };
      }
      const uncertaintyMs = uncertaintyOf(chosen.rttMs);
      const prevOffset = state.offsetMs;
      state = {
        offsetMs: Math.round(chosen.offsetMs),
        syncedAtSystemMs: Date.now(),
        syncedAtMonotonicMs: performance.now(),
        roundTripMs: Math.round(chosen.rttMs),
        uncertaintyMs: Math.round(uncertaintyMs),
        sampleCount: samples.length,
        quality: qualityOf(uncertaintyMs),
        source: "cloud_run_http_date",
        endpointId,
      };
      lastJumpWall = Date.now(); lastJumpMono = performance.now();
      log("clock.sync.complete", { offsetMs: state.offsetMs, roundTripMs: state.roundTripMs, uncertaintyMs: state.uncertaintyMs, quality: state.quality, sampleCount: state.sampleCount, endpointId });
      if (Math.abs(state.offsetMs - prevOffset) >= 1) log("clock.offset.changed", { fromMs: prevOffset, toMs: state.offsetMs, deltaMs: state.offsetMs - prevOffset });
      log("clock.offset.apply", { offsetMs: state.offsetMs, quality: state.quality });
      publish();
      return { ...state };
    } finally { inFlight = false; }
  }

  function checkJump(): void {
    const wall = Date.now(), mono = performance.now();
    const wallElapsed = wall - lastJumpWall, monoElapsed = mono - lastJumpMono;
    const jumpMs = wallElapsed - monoElapsed;
    lastJumpWall = wall; lastJumpMono = mono;
    if (Math.abs(jumpMs) > JUMP_THRESHOLD_MS) {
      log("clock.jump.detected", { clockJumpMs: Math.round(jumpMs) });
      // offset antigo é inválido: marca stale e ressincroniza (rearme acontece no renderer via novo estado)
      if (state.quality === "synced" || state.quality === "degraded") state.quality = "stale";
      publish();
      void sync(CYCLE_SAMPLES, "clock-jump");
    } else {
      ageDown();
    }
  }

  return {
    /** Inicia o ciclo: sync inicial (login) + timers periódico e de salto. */
    start(): void {
      void sync(LOGIN_SAMPLES, "login");
      if (!periodicTimer) periodicTimer = setInterval(() => { ageDown(); void sync(CYCLE_SAMPLES, "periodic"); }, PERIODIC_MS);
      if (!jumpTimer) jumpTimer = setInterval(checkJump, JUMP_CHECK_MS);
    },
    /** Ressync sob demanda (resume/unlock/reconnect/focus-stale). Coalescido por inFlight. */
    requestSync(reason?: string): Promise<ClockState> { return sync(CYCLE_SAMPLES, reason || "manual"); },
    getState(): ClockState { ageDown(); return { ...state }; },
    stop(): void {
      if (periodicTimer) { clearInterval(periodicTimer); periodicTimer = null; }
      if (jumpTimer) { clearInterval(jumpTimer); jumpTimer = null; }
    },
  };
}
