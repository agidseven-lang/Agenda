/**
 * F3.3.56-G2 — IPC de auth (processo main).
 * Registra os handlers auth-* consumidos pelo preload. O token de sessão fica
 * confinado ao auth-core (memória + userData/session.json); o renderer recebe
 * SOMENTE {ok, user/self/active/expiresAt/error}. Nenhum segredo em log.
 * Overrides de URL via env IDS_AUTH_*_URL existem só p/ testes herméticos.
 */
import { app, ipcMain } from "electron";
import { createAuthCore } from "./auth-core";

export function registerAuthIpc(): void {
  const core = createAuthCore({
    storeDir: app.getPath("userData"),
    urls: {
      login: process.env.IDS_AUTH_LOGIN_URL || "",
      self: process.env.IDS_AUTH_SELF_URL || "",
      changePassword: process.env.IDS_AUTH_CHPW_URL || "",
    },
  });
  ipcMain.handle("auth-login", (_e, identifier: string, password: string) => core.login(identifier, password));
  ipcMain.handle("auth-self", () => core.self());
  ipcMain.handle("auth-change-password", (_e, oldPw: string, newPw: string) => core.changePassword(oldPw, newPw));
  ipcMain.handle("auth-logout", () => core.logout());
  ipcMain.handle("auth-session-status", () => core.status());
}
