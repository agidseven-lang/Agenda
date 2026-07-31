/**
 * F3.5.4N — startupPrefs.ts — INICIAR COM O WINDOWS (default-ON idempotente + verificação real).
 * =====================================================================================
 * Autoridade das preferências de inicialização, sobre o mecanismo NATIVO do Electron
 * (app.setLoginItemSettings / getLoginItemSettings — SEM atalho improvisado, .bat, cópia p/ a
 * pasta Inicializar ou PowerShell). Duas preferências:
 *   - openAtLogin  : iniciar o Agenda automaticamente com o Windows;
 *   - hiddenStart  : iniciar minimizado na bandeja (registra o arg "--hidden" no login item).
 *
 * POLÍTICA 1.0.204: ambas ON por padrão, aplicadas UMA ÚNICA VEZ (defaultsApplied). Se o usuário
 * desligar (userOverride), uma atualização futura NUNCA reativa silenciosamente (reforço do
 * mandato). Persistência em JSON próprio; estado real do Windows verificável (verify()).
 *
 * Controlador injetável (sys + store) → testável sem Electron.
 */
export type LoginItemStatus = { openAtLogin?: boolean; executableWillLaunchAtLogin?: boolean; wasOpenedAtLogin?: boolean };
export type LoginItemSys = {
  platform: string;
  get: (opts?: { args?: string[] }) => LoginItemStatus;
  set: (opts: { openAtLogin: boolean; args?: string[] }) => void;
};
export type PrefsStore = { read: () => any; write: (o: any) => void };

export type StartupPrefs = { openAtLogin: boolean; hiddenStart: boolean; defaultsApplied: boolean; userOverride: boolean };

export type StartupPrefsDeps = {
  sys: LoginItemSys;
  store: PrefsStore;
  onLog?: (tag: string, data?: unknown) => void;
  argv?: () => string[];
};

const HIDDEN_ARG = "--hidden";

export function createStartupPrefs(deps: StartupPrefsDeps) {
  const log = deps.onLog || (() => { /* */ });
  const argv = deps.argv || (() => (typeof process !== "undefined" ? process.argv : []));

  function read(): StartupPrefs {
    let raw: any = {};
    try { raw = deps.store.read() || {}; } catch { raw = {}; }
    return {
      openAtLogin: raw.openAtLogin === true,
      hiddenStart: raw.hiddenStart === true,
      defaultsApplied: raw.defaultsApplied === true,
      userOverride: raw.userOverride === true,
    };
  }
  function persist(p: StartupPrefs): void { try { deps.store.write(p); } catch (e) { log("startup.setting.write.error", { err: String((e as any) && (e as any).message || e) }); } }

  /** Reflete a preferência no registro NATIVO do Windows (idempotente). */
  function applyToOs(p: StartupPrefs): void {
    if (deps.sys.platform !== "win32") return;
    try {
      deps.sys.set({ openAtLogin: p.openAtLogin, args: p.hiddenStart ? [HIDDEN_ARG] : [] });
      log("startup.setting.apply", { openAtLogin: p.openAtLogin, hiddenStart: p.hiddenStart });
    } catch (e) { log("startup.setting.apply.error", { err: String((e as any) && (e as any).message || e) }); }
  }

  return {
    read,

    /** Aplica os defaults ON UMA vez (nunca sobre o override do usuário). Chamado no whenReady. */
    applyDefaultsOnce(): StartupPrefs {
      const p = read();
      log("startup.setting.read", { openAtLogin: p.openAtLogin, hiddenStart: p.hiddenStart, defaultsApplied: p.defaultsApplied, userOverride: p.userOverride });
      if (deps.sys.platform !== "win32") return p;
      if (p.defaultsApplied || p.userOverride) { applyToOs(p); return p; } // já decidido: só reflete no SO
      const next: StartupPrefs = { openAtLogin: true, hiddenStart: true, defaultsApplied: true, userOverride: false };
      applyToOs(next); persist(next);
      log("startup.defaults.applied", { openAtLogin: true, hiddenStart: true });
      return next;
    },

    /** Usuário liga/desliga "iniciar com o Windows" (marca override; nunca mais reativa sozinho). */
    setOpenAtLogin(v: boolean): StartupPrefs {
      const p = read(); p.openAtLogin = !!v; p.userOverride = true; p.defaultsApplied = true;
      applyToOs(p); persist(p); return p;
    },
    /** Usuário liga/desliga "iniciar minimizado". */
    setHiddenStart(v: boolean): StartupPrefs {
      const p = read(); p.hiddenStart = !!v; p.userOverride = true; p.defaultsApplied = true;
      applyToOs(p); persist(p); return p;
    },

    /** Estado REAL do Windows (prova de que o registro foi efetivamente aplicado). */
    verify(): { platform: string; openAtLoginPref: boolean; hiddenStartPref: boolean; osOpenAtLogin: boolean; willLaunch: boolean; consistent: boolean } {
      const p = read();
      if (deps.sys.platform !== "win32") return { platform: deps.sys.platform, openAtLoginPref: p.openAtLogin, hiddenStartPref: p.hiddenStart, osOpenAtLogin: false, willLaunch: false, consistent: true };
      let s: LoginItemStatus = {};
      try { s = deps.sys.get({ args: p.hiddenStart ? [HIDDEN_ARG] : [] }) || {}; } catch { s = {}; }
      const osOpenAtLogin = !!s.openAtLogin;
      const willLaunch = s.executableWillLaunchAtLogin !== undefined ? !!s.executableWillLaunchAtLogin : osOpenAtLogin;
      const consistent = osOpenAtLogin === p.openAtLogin;
      log("startup.setting.verify", { osOpenAtLogin, willLaunch, consistent });
      return { platform: "win32", openAtLoginPref: p.openAtLogin, hiddenStartPref: p.hiddenStart, osOpenAtLogin, willLaunch, consistent };
    },

    /** O processo foi iniciado pelo Windows (login item)? arg --hidden OU wasOpenedAtLogin do SO. */
    wasOpenedAtLogin(): boolean {
      try {
        if ((argv() || []).includes(HIDDEN_ARG)) return true;
        if (deps.sys.platform === "win32") { const s = deps.sys.get(); if (s && s.wasOpenedAtLogin) return true; }
      } catch { /* */ }
      return false;
    },
  };
}
