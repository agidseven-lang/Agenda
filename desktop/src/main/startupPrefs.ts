/**
 * F3.5.4N — startupPrefs.ts — INICIAR COM O WINDOWS (default-ON de 1ª execução + verificação real).
 * =====================================================================================
 * Autoridade sobre o mecanismo NATIVO do Electron (app.setLoginItemSettings /
 * getLoginItemSettings — SEM atalho improvisado, .bat, cópia p/ a pasta Inicializar ou PowerShell).
 *
 * MODELO "O SO É A VERDADE" (evita duas autoridades brigando pelo mesmo item de login):
 *   - o ESTADO de "iniciar com o Windows" é lido SEMPRE do próprio SO (getLoginItemSettings),
 *     nunca de um espelho em JSON que poderia ficar velho;
 *   - o app SEMPRE registra com o argumento "--hidden" (sobe minimizado na bandeja — objetivo do
 *     F3.5.4N), EXATAMENTE como o autostart.ts usado pela bandeja (checkbox "Iniciar com o Windows").
 *     Assim a bandeja (congelada) e as Configurações escrevem o MESMO item de login, sem divergir;
 *   - o ÚNICO estado persistido em JSON é o marcador `defaultsApplied`: garante que o default-ON
 *     seja aplicado UMA ÚNICA VEZ (na 1ª execução em que ainda não foi aplicado). Depois disso, o
 *     módulo NUNCA reescreve o item de login por conta própria — respeita qualquer decisão posterior
 *     do usuário (pela bandeja OU pelas Configurações). O registro persiste sozinho no Windows.
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

export type StartupPrefsDeps = {
  sys: LoginItemSys;
  store: PrefsStore;
  onLog?: (tag: string, data?: unknown) => void;
  argv?: () => string[];
};

// Sobe minimizado na bandeja (objetivo F3.5.4N). MESMO arg do autostart.ts (consistência com a bandeja).
const HIDDEN_ARG = "--hidden";

export function createStartupPrefs(deps: StartupPrefsDeps) {
  const log = deps.onLog || (() => { /* */ });
  const argv = deps.argv || (() => (typeof process !== "undefined" ? process.argv : []));
  const isWin = () => deps.sys.platform === "win32";

  /** Marcador persistente: o default-ON já foi aplicado alguma vez? (única coisa em JSON) */
  function defaultsApplied(): boolean {
    try { const raw = deps.store.read() || {}; return raw.defaultsApplied === true; } catch { return false; }
  }
  function markDefaultsApplied(): void {
    try { const raw = deps.store.read() || {}; raw.defaultsApplied = true; deps.store.write(raw); }
    catch (e) { log("startup.mark.error", { err: String((e as any) && (e as any).message || e) }); }
  }

  /** Estado REAL do SO: o app está registrado para iniciar com o Windows (com --hidden)? */
  function osOpenAtLogin(): boolean {
    if (!isWin()) return false;
    try { const s = deps.sys.get({ args: [HIDDEN_ARG] }) || {}; return !!s.openAtLogin; } catch { return false; }
  }

  /** Escreve o item de login NATIVO (idempotente; sempre com --hidden). */
  function setOs(v: boolean): void {
    if (!isWin()) return;
    try { deps.sys.set({ openAtLogin: !!v, args: [HIDDEN_ARG] }); log("startup.setting.apply", { openAtLogin: !!v, hiddenStart: true }); }
    catch (e) { log("startup.setting.apply.error", { err: String((e as any) && (e as any).message || e) }); }
  }

  return {
    /** Estado atual (lido do SO). hiddenStart é sempre true (o registro usa --hidden). */
    read(): { openAtLogin: boolean; hiddenStart: boolean; defaultsApplied: boolean } {
      return { openAtLogin: osOpenAtLogin(), hiddenStart: true, defaultsApplied: defaultsApplied() };
    },

    /**
     * Aplica o default-ON UMA ÚNICA VEZ (1ª execução sem marcador). Nunca reescreve depois: se o
     * usuário já decidiu (bandeja/Configurações), o item de login do Windows persiste sozinho e este
     * método vira no-op. Chamado no whenReady. Fora do Windows: no-op.
     */
    applyDefaultsOnce(): { openAtLogin: boolean; hiddenStart: boolean; defaultsApplied: boolean; changed: boolean } {
      if (!isWin()) { log("startup.defaults.skip", { platform: deps.sys.platform }); return { openAtLogin: false, hiddenStart: true, defaultsApplied: defaultsApplied(), changed: false }; }
      if (defaultsApplied()) {
        const cur = osOpenAtLogin();
        log("startup.defaults.already", { openAtLogin: cur });
        return { openAtLogin: cur, hiddenStart: true, defaultsApplied: true, changed: false };
      }
      setOs(true);                 // 1ª execução: liga por padrão (minimizado na bandeja)
      markDefaultsApplied();
      log("startup.defaults.applied", { openAtLogin: true, hiddenStart: true });
      return { openAtLogin: true, hiddenStart: true, defaultsApplied: true, changed: true };
    },

    /** Usuário liga/desliga "iniciar com o Windows" (Configurações). Marca defaultsApplied p/ nunca reverter. */
    setOpenAtLogin(v: boolean): { openAtLogin: boolean; hiddenStart: boolean } {
      setOs(!!v);
      markDefaultsApplied(); // uma decisão explícita conta como default já resolvido
      log("startup.setting.user", { openAtLogin: !!v });
      return { openAtLogin: osOpenAtLogin(), hiddenStart: true };
    },

    /** Estado REAL do Windows (prova de que o registro foi efetivamente aplicado). */
    verify(): { platform: string; openAtLoginPref: boolean; hiddenStartPref: boolean; osOpenAtLogin: boolean; willLaunch: boolean; consistent: boolean } {
      if (!isWin()) return { platform: deps.sys.platform, openAtLoginPref: false, hiddenStartPref: true, osOpenAtLogin: false, willLaunch: false, consistent: true };
      let s: LoginItemStatus = {};
      try { s = deps.sys.get({ args: [HIDDEN_ARG] }) || {}; } catch { s = {}; }
      const os = !!s.openAtLogin;
      const willLaunch = s.executableWillLaunchAtLogin !== undefined ? !!s.executableWillLaunchAtLogin : os;
      // "consistent" = o SO reflete o que o usuário pediu (openAtLogin do SO == willLaunch efetivo).
      const consistent = willLaunch === os;
      log("startup.setting.verify", { osOpenAtLogin: os, willLaunch, consistent });
      return { platform: "win32", openAtLoginPref: os, hiddenStartPref: true, osOpenAtLogin: os, willLaunch, consistent };
    },

    /** O processo foi iniciado pelo Windows (login item)? arg --hidden OU wasOpenedAtLogin do SO. */
    wasOpenedAtLogin(): boolean {
      try {
        if ((argv() || []).includes(HIDDEN_ARG)) return true;
        if (isWin()) { const s = deps.sys.get(); if (s && s.wasOpenedAtLogin) return true; }
      } catch { /* */ }
      return false;
    },
  };
}
