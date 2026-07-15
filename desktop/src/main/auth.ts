/**
 * F3.3.56-G2 — IPC de auth (processo main).
 * Registra os handlers auth-* consumidos pelo preload. O token de sessão fica
 * confinado ao auth-core (memória + userData/session.json); o renderer recebe
 * SOMENTE {ok, user/self/active/expiresAt/error}. Nenhum segredo em log.
 * Overrides de URL via env IDS_AUTH_*_URL existem só p/ testes herméticos.
 */
import { app, ipcMain } from "electron";
import { createAuthCore } from "./auth-core";
import { diag } from "./diag";

export function registerAuthIpc(): void {
  const core = createAuthCore({
    storeDir: app.getPath("userData"),
    urls: {
      login: process.env.IDS_AUTH_LOGIN_URL || "",
      self: process.env.IDS_AUTH_SELF_URL || "",
      changePassword: process.env.IDS_AUTH_CHPW_URL || "",
    },
    // F3.3.73I6C11 — diagnostico behavior-preserving do auth-core (nunca loga token).
    log: (tag: string, data?: unknown) => diag("authcore." + tag, data),
  });
  ipcMain.handle("auth-login", (_e, identifier: string, password: string) => core.login(identifier, password));
  ipcMain.handle("auth-self", async () => { const r = await core.self(); diag("ipc.auth-self", { ok: r.ok, error: r.error, hasSelf: !!r.self }); return r; });
  ipcMain.handle("auth-change-password", (_e, oldPw: string, newPw: string) => core.changePassword(oldPw, newPw));
  // F3.3.71A — troca segura de e-mail de login (self + admin)
  ipcMain.handle("auth-change-email", (_e, currentPassword: string, newEmail: string) => core.changeEmail(currentPassword, newEmail));
  ipcMain.handle("auth-admin-change-user-email", (_e, targetId: string, newEmail: string, confirm: string, reason: string) => core.adminChangeUserEmail(targetId, newEmail, confirm, reason));
  ipcMain.handle("auth-logout", () => { diag("ipc.auth-logout"); return core.logout(); });
  ipcMain.handle("auth-session-status", () => core.status());
}
