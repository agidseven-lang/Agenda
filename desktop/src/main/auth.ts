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

// F3.4.3 — PAPEL AUTENTICADO no MAIN (para o gate canSeeAll do operational_block do SLA).
// Fonte ÚNICA e confiável: as respostas SERVER-SIDE já existentes de loginUser/getUserSelf
// (o servidor deriva role/admin da sessão Bearer — NÃO é o role arbitrário do renderer, NÃO
// abre a coleção users, NÃO muda Rules/backend). Guardado só em memória do main; limpo no logout.
let _authUser: { id: string; role: string; admin: boolean } | null = null;
function _setAuthUser(u: any): void {
  try {
    if (u && u.id) _authUser = { id: String(u.id), role: String(u.role || ""), admin: !!u.admin };
  } catch { /* nunca quebrar o auth por causa do cache de papel */ }
}
/** Papel autenticado do usuário logado (server-verified), ou null. Usado pelo slaScheduler. */
export function getAuthUser(): { id: string; role: string; admin: boolean } | null { return _authUser; }

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
  ipcMain.handle("auth-login", async (_e, identifier: string, password: string) => { const r = await core.login(identifier, password); if (r && r.ok && r.user) _setAuthUser(r.user); return r; });
  ipcMain.handle("auth-self", async () => { const r = await core.self(); if (r && r.ok && r.self) _setAuthUser(r.self); diag("ipc.auth-self", { ok: r.ok, error: r.error, hasSelf: !!r.self }); return r; });
  ipcMain.handle("auth-change-password", (_e, oldPw: string, newPw: string) => core.changePassword(oldPw, newPw));
  // F3.3.71A — troca segura de e-mail de login (self + admin)
  ipcMain.handle("auth-change-email", (_e, currentPassword: string, newEmail: string) => core.changeEmail(currentPassword, newEmail));
  ipcMain.handle("auth-admin-change-user-email", (_e, targetId: string, newEmail: string, confirm: string, reason: string) => core.adminChangeUserEmail(targetId, newEmail, confirm, reason));
  ipcMain.handle("auth-logout", () => { diag("ipc.auth-logout"); _authUser = null; return core.logout(); });
  ipcMain.handle("auth-session-status", () => core.status());
}
