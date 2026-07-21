/**
 * Agenda ID Seven Desktop — Atualizador nativo (F3.4.1A)
 * ---------------------------------------------------------------------------
 * Serviço ISOLADO no processo MAIN sobre electron-updater (NSIS/Windows).
 * Regras inegociáveis (mandato F3.4.1A / F3.4.2A):
 *   - FLAGS (ordem exigida): allowPrerelease(true) -> channel(canary) -> allowDowngrade(false),
 *     depois autoDownload/autoInstallOnAppQuit/forceDevUpdateConfig/fullChangelog (false).
 *     A ordem importa: allowPrerelease E channel podem ativar allowDowngrade no
 *     electron-updater, logo allowDowngrade=false vem POR ÚLTIMO. CANÁRIO consulta o canal
 *     canary (canary.yml); ESTÁVEL (FASE 16) usa allowPrerelease=false + channel latest e
 *     NUNCA vê prereleases (isolamento real de canal — a máquina estável ignora o canário).
 *   - Download só após ação do usuário. Instalação só após ação do usuário e
 *     com o renderer confirmando que não há trabalho não salvo. NUNCA silencioso
 *     sem confirmação.
 *   - Nada de token/URL/headers/caminho interno é exposto ao renderer nem aos
 *     logs (logger sanitizado; estado público sanitizado).
 * Integridade: o electron-updater valida o sha512 do latest.yml no download; a
 * integridade de RELEASE (sha256, target commit, não-draft, não-substituída) é
 * garantida no publish (workflow gated). Downgrade/prerelease-em-produção são
 * barrados por allowDowngrade=false; canal ISOLADO por channel canary (o estável usa latest).
 */
import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "update_available"
  | "up_to_date"
  | "downloading"
  | "downloaded"
  | "installing"
  | "deferred"
  | "error";

export type UpdaterProgress = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

export type UpdaterState = {
  status: UpdaterStatus;
  installedVersion: string;
  channel: string; // canal literal do updater: "latest" (estável) | "canary" (canário)
  allowPrerelease: boolean;
  availableVersion: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
  sizeBytes: number | null;
  progress: UpdaterProgress | null;
  downloaded: boolean;
  lastCheckAt: number | null;
  lastCheckReason: string | null;
  error: { message: string; code: string | null } | null;
};

export type UpdaterDeps = {
  getWindow: () => BrowserWindow | null;
  onLog: (tag: string, data?: unknown) => void;
  beforeInstall: () => void; // teardown antes do quitAndInstall (quitting=true + parar subsistemas + destroyTray)
  now?: () => number; // injetável p/ teste
  getVersion?: () => string; // injetável p/ teste
  // F3.4.2A (Escopo A) — gancho OPCIONAL para o HUB de notificação do main disparar a
  // notificação IMEDIATA de atualização (produtor ÚNICO no main). Recebe só o kind + o
  // ESTADO PÚBLICO já sanitizado (sem token/URL/headers). Ausência ⇒ comportamento 1.0.178.
  onNotify?: (kind: "available" | "downloaded", state: UpdaterState) => void;
  // F3.4.2A Stage-2C — "LEMBRAR MAIS TARDE" persistido (snooze). O main injeta a leitura/gravação
  // (arquivo em userData) e o relógio canônico (now). Ausência ⇒ sem snooze (comportamento anterior).
  readSnooze?: () => UpdaterSnooze | null;
  writeSnooze?: (s: UpdaterSnooze | null) => void;
  snoozeMs?: number; // duração do silêncio ao adiar (default SNOOZE_MS)
};

// Registro de snooze persistido: silencia a notificação de "disponível" desta versão/canal até `until`.
export type UpdaterSnooze = { version: string; channel: string; until: number };

// 6h entre verificações automáticas (impede tempestade de chamadas).
export const CHECK_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;
// "Lembrar mais tarde": silêncio padrão de 8h (persistido; sobrevive a reinício; relógio canônico).
export const SNOOZE_MS = 8 * 60 * 60 * 1000;

// Redige qualquer URL/segredo antes de logar (nunca token/URL nos logs).
export function redact(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/https?:\/\/[^\s"']+/gi, "<url>")
    .replace(/\b(token|bearer|authorization|apikey|api_key)\b\s*[=:]\s*[^\s"']+/gi, "$1=<redacted>");
}

// Estados a partir dos quais uma nova verificação/donwload não pode começar.
export function isBusyStatus(s: UpdaterStatus): boolean {
  return s === "checking" || s === "downloading" || s === "installing";
}

export function createUpdaterService(deps: UpdaterDeps) {
  const now = deps.now || (() => Date.now());
  const getVersion = deps.getVersion || (() => { try { return app.getVersion(); } catch { return "dev"; } });
  const installed = getVersion();

  // ---- FLAGS OBRIGATÓRIAS (mandato F3.4.2A — linha CANÁRIO, prerelease 1.0.179-canary.1) — ORDEM EXIGIDA:
  // allowPrerelease -> channel -> allowDowngrade. Motivo: allowPrerelease E channel podem
  // ativar allowDowngrade no electron-updater, então allowDowngrade=false vem POR ÚLTIMO.
  // CANÁRIO consulta SOMENTE o canal canary (canary.yml) e vê os prereleases da própria linha;
  // o bootstrap ESTÁVEL (FASE 16) usa allowPrerelease=false + channel latest (nunca vê canary).
  autoUpdater.allowPrerelease = true;
  autoUpdater.channel = "canary";
  autoUpdater.allowDowngrade = false;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.forceDevUpdateConfig = false;
  autoUpdater.fullChangelog = false;
  const allowPre = (autoUpdater.allowPrerelease as boolean) === true;
  const chan = String((autoUpdater.channel as string | null | undefined) || "latest");
  autoUpdater.logger = {
    info: (m: unknown) => deps.onLog("updater.lib.info", { m: redact(m) }),
    warn: (m: unknown) => deps.onLog("updater.lib.warn", { m: redact(m) }),
    error: (m: unknown) => deps.onLog("updater.lib.error", { m: redact(m) }),
    debug: (_m: unknown) => { /* silencioso: evita vazar URL/feed em logs verbosos */ },
  } as unknown as typeof autoUpdater.logger;

  const state: UpdaterState = {
    status: "idle",
    installedVersion: installed,
    channel: chan,
    allowPrerelease: allowPre,
    availableVersion: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    sizeBytes: null,
    progress: null,
    downloaded: false,
    lastCheckAt: null,
    lastCheckReason: null,
    error: null,
  };

  let inFlightCheck = false;
  let periodic: ReturnType<typeof setInterval> | null = null;

  // ---- LEMBRAR MAIS TARDE (snooze persistido) ----
  const readSnooze = deps.readSnooze || (() => null);
  const writeSnooze = deps.writeSnooze || (() => { /* sem persistência: sem snooze */ });
  const snoozeMs = typeof deps.snoozeMs === "number" && deps.snoozeMs > 0 ? deps.snoozeMs : SNOOZE_MS;
  // Snooze ATIVO para ESTA versão+canal disponível? (relógio canônico via now()). Versão/canal
  // diferentes ⇒ snooze não se aplica (nova versão sempre volta a notificar).
  function snoozeActiveFor(version: string): boolean {
    try {
      const s = readSnooze();
      if (!s || typeof s.until !== "number") return false;
      if (String(s.version) !== String(version) || String(s.channel) !== String(state.channel)) return false;
      return now() < s.until;
    } catch { return false; }
  }
  // Limpa o snooze quando: usuário baixa/instala, versão instalada, ou versão deixa de ser superior.
  function clearSnooze(why: string): void {
    try { if (readSnooze()) { writeSnooze(null); deps.onLog("updater.snooze.clear", { why }); } } catch { /* */ }
  }

  function publicState(): UpdaterState {
    // cópia sanitizada — NUNCA token/URL/headers/caminho de arquivo interno.
    return {
      ...state,
      progress: state.progress ? { ...state.progress } : null,
      error: state.error ? { ...state.error } : null,
    };
  }
  function emit() {
    try {
      const w = deps.getWindow();
      if (w && !w.isDestroyed()) w.webContents.send("updater-state", publicState());
    } catch { /* emitir estado nunca pode quebrar o app */ }
  }
  function set(patch: Partial<UpdaterState>) { Object.assign(state, patch); emit(); }

  function sizeOf(info: unknown): number | null {
    try {
      const files = (info as any) && (info as any).files;
      if (Array.isArray(files) && files.length) {
        const s = files.reduce((a: number, f: any) => a + (Number(f && f.size) || 0), 0);
        return s > 0 ? s : null;
      }
    } catch { /* */ }
    return null;
  }
  function notesOf(info: unknown): string | null {
    try {
      const n = (info as any) && (info as any).releaseNotes;
      if (typeof n === "string") return n;
      if (Array.isArray(n)) return n.map((x: any) => (x && x.note) || "").filter(Boolean).join("\n\n") || null;
    } catch { /* */ }
    return null;
  }
  const codeOf = (e: any): string | null => (e && (e.code || e.name)) ? String(e.code || e.name) : null;

  // ---- eventos electron-updater (fonte da verdade da máquina de estados) ----
  const EVENTS = ["checking-for-update", "update-available", "update-not-available", "download-progress", "update-downloaded", "error"];
  EVENTS.forEach((e) => { try { autoUpdater.removeAllListeners(e as any); } catch { /* */ } });

  autoUpdater.on("checking-for-update", () => { set({ status: "checking", error: null }); deps.onLog("updater.checking", {}); });
  autoUpdater.on("update-available", (info: any) => {
    const ver = String((info && info.version) || "");
    set({
      status: "update_available",
      availableVersion: ver || null,
      releaseName: (info && info.releaseName) || null,
      releaseNotes: notesOf(info),
      releaseDate: (info && info.releaseDate) || null,
      sizeBytes: sizeOf(info),
      progress: null,
      error: null,
    });
    deps.onLog("updater.available", { version: ver });
    // F3.4.2A — produtor ÚNICO da notificação imediata: o main monta o NotifPayload e roteia
    // pelo HUB (deliverNotification). Nunca pode quebrar a máquina de estados do updater.
    // Stage-2C — "LEMBRAR MAIS TARDE": se houver snooze ATIVO para esta versão, o estado/UI seguem
    // atualizados, mas a NOTIFICAÇÃO é suprimida (não repete a cada verificação automática).
    if (ver && snoozeActiveFor(ver)) {
      deps.onLog("updater.snooze.suppress", { version: ver });
    } else {
      try { if (deps.onNotify) deps.onNotify("available", publicState()); } catch { /* notificar nunca derruba o updater */ }
    }
  });
  autoUpdater.on("update-not-available", (info: any) => {
    set({ status: "up_to_date", availableVersion: null, progress: null, error: null });
    clearSnooze("up_to_date"); // versão deixou de ser superior (instalada/superada): limpa o snooze
    deps.onLog("updater.up_to_date", { version: String((info && info.version) || "") });
  });
  autoUpdater.on("download-progress", (p: any) => {
    set({
      status: "downloading",
      progress: {
        percent: Math.max(0, Math.min(100, Number(p && p.percent) || 0)),
        transferred: Number(p && p.transferred) || 0,
        total: Number(p && p.total) || 0,
        bytesPerSecond: Number(p && p.bytesPerSecond) || 0,
      },
    });
  });
  autoUpdater.on("update-downloaded", (info: any) => {
    set({
      status: "downloaded",
      downloaded: true,
      availableVersion: String((info && info.version) || state.availableVersion || "") || null,
    });
    deps.onLog("updater.downloaded", { version: String((info && info.version) || "") });
    try { if (deps.onNotify) deps.onNotify("downloaded", publicState()); } catch { /* notificar nunca derruba o updater */ }
  });
  autoUpdater.on("error", (err: any) => {
    inFlightCheck = false;
    set({ status: "error", error: { message: redact((err && err.message) || err || "erro desconhecido"), code: codeOf(err) } });
    deps.onLog("updater.error", { code: codeOf(err), message: redact((err && err.message) || err) });
  });

  // ---- API pública (chamada via IPC restrito) ----
  async function check(reason: string, manual: boolean): Promise<{ ok: boolean; reason?: string }> {
    // Bloqueia verificações concorrentes (inFlightCheck) e verificações durante download/instalação.
    // NÃO bloqueia por status "checking" residual (o inFlightCheck é a verdade do que está em curso).
    if (inFlightCheck || state.status === "downloading" || state.status === "installing") { deps.onLog("updater.check.skip", { reason, why: "busy" }); return { ok: false, reason: "busy" }; }
    if (!manual && state.lastCheckAt != null && (now() - state.lastCheckAt) < CHECK_MIN_INTERVAL_MS) {
      deps.onLog("updater.check.skip", { reason, why: "interval" });
      return { ok: false, reason: "interval" };
    }
    inFlightCheck = true;
    set({ status: "checking", lastCheckAt: now(), lastCheckReason: reason, error: null });
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (e: any) {
      // normalmente o evento 'error' já ajustou o estado; garante consistência.
      set({ status: "error", error: { message: redact((e && e.message) || e), code: codeOf(e) } });
      return { ok: false, reason: "error" };
    } finally {
      inFlightCheck = false;
    }
  }

  async function download(): Promise<{ ok: boolean; reason?: string }> {
    if (state.status === "downloading") return { ok: false, reason: "already_downloading" };
    if (state.status === "installing") return { ok: false, reason: "installing" };
    if (state.status === "downloaded") return { ok: true, reason: "already_downloaded" };
    if ((state.status !== "update_available" && state.status !== "deferred") || !state.availableVersion) {
      return { ok: false, reason: "no_update" };
    }
    clearSnooze("download"); // usuário iniciou o download: não faz mais sentido adiar
    set({ status: "downloading", progress: null, error: null });
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e: any) {
      set({ status: "error", error: { message: redact((e && e.message) || e), code: codeOf(e) } });
      return { ok: false, reason: "error" };
    }
  }

  async function installAndRestart(): Promise<{ ok: boolean; reason?: string; detail?: string }> {
    if (state.status === "installing") return { ok: false, reason: "already_installing" };
    if (!state.downloaded || state.status !== "downloaded") return { ok: false, reason: "no_update_downloaded" };
    // O MAIN consulta o renderer sobre trabalho não salvo (wizard/formulário/modal/gravação).
    let guard: any = { safe: true };
    try {
      const w = deps.getWindow();
      if (w && !w.isDestroyed()) {
        guard = await w.webContents.executeJavaScript(
          "(function(){try{return (window.__updaterInstallGuard&&window.__updaterInstallGuard())||{safe:true};}catch(e){return {safe:true};}})()"
        );
      }
    } catch { guard = { safe: true }; }
    if (guard && guard.safe === false) {
      deps.onLog("updater.install.blocked", { reason: String((guard && guard.reason) || "busy") });
      emit(); // permanece 'downloaded'; a UI mostra instrução clara
      return { ok: false, reason: "busy", detail: String((guard && guard.reason) || "busy") };
    }
    clearSnooze("install"); // usuário está instalando: limpa qualquer adiamento
    set({ status: "installing" });
    deps.onLog("updater.install.begin", { version: state.availableVersion });
    try {
      deps.beforeInstall(); // quitting=true + parar notifier/reminder/clockSync/bgNotify + destroyTray
    } catch (e: any) {
      deps.onLog("updater.install.teardown.error", { message: redact((e && e.message) || e) });
    }
    try {
      // isSilent=false → instalador assistido VISÍVEL (nunca silencioso sem confirmação);
      // isForceRunAfter=true → reabre o app após instalar.
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (e: any) {
      set({ status: "error", error: { message: redact((e && e.message) || e), code: codeOf(e) } });
      return { ok: false, reason: "error", detail: redact((e && e.message) || e) };
    }
  }

  function defer(): { ok: boolean } {
    if (state.status === "update_available" || state.status === "downloaded" || state.status === "downloading" || state.status === "error") {
      set({ status: "deferred" });
    }
    // LEMBRAR MAIS TARDE: persiste o snooze SÓ quando há uma versão disponível concreta (senão não há
    // o que lembrar). Relógio canônico via now(). Enquanto ativo, a verificação automática NÃO renotifica.
    if (state.availableVersion) {
      try { const until = now() + snoozeMs; writeSnooze({ version: String(state.availableVersion), channel: String(state.channel), until }); deps.onLog("updater.snooze.set", { until }); } catch { /* snooze é best-effort */ }
    }
    deps.onLog("updater.deferred", {});
    return { ok: true };
  }

  function getState(): UpdaterState { return publicState(); }

  function start() {
    if (periodic) return;
    periodic = setInterval(() => { void check("periodic", false); }, CHECK_MIN_INTERVAL_MS);
    deps.onLog("updater.start", { installed, channel: state.channel, allowPrerelease: state.allowPrerelease });
  }
  function stop() {
    if (periodic) { clearInterval(periodic); periodic = null; }
    EVENTS.forEach((e) => { try { autoUpdater.removeAllListeners(e as any); } catch { /* */ } });
    deps.onLog("updater.stop", {});
  }
  function checkAuto(reason: string) { void check(reason, false); }
  function maybeCheckOnResume() {
    if (state.lastCheckAt == null || (now() - state.lastCheckAt) >= CHECK_MIN_INTERVAL_MS) void check("resume", false);
  }

  return {
    start,
    stop,
    getState,
    check: (reason = "manual") => check(reason, true),
    checkAuto,
    maybeCheckOnResume,
    download,
    installAndRestart,
    defer,
  };
}
