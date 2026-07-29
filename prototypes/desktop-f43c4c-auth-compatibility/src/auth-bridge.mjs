// =====================================================================
// F4.3C4C — DesktopAuthBridge (CONTRATO da futura Desktop; NÃO implementado na
// Desktop oficial). Autenticação Firebase EXPLÍCITA pós-login:
//
//   login explícito -> sessão -> issueFirebaseAuthToken (Bearer) ->
//   signInWithCustomToken -> currentUid == session.uid -> Authenticated.
//
// ANTI-1.0.185 (por construção):
//  - NADA acontece no construtor (sem side effects; estado Idle);
//  - ensureAuthenticated() SÓ roda quando chamado explicitamente (nunca no load);
//  - NENHUM signInAnonymously; NENHUM fallback anônimo; NENHUM fallback para
//    Rules abertas; falha NUNCA abre o sistema parcialmente (fail-closed);
//  - logout() encerra Firebase Auth E todos os listeners registrados;
//  - troca de usuário limpa TODO o estado (novo ensure re-valida do zero).
//
// Estados explícitos: Idle | Authenticating | Authenticated | SessionMissing |
// SessionExpired | SessionRevoked | FirebaseTokenFailure | FirebaseAuthFailure |
// UidMismatch | Offline | LoggedOut.
//
// Logs: categorias fechadas apenas (estado/código). NUNCA token/secret/corpo.
// =====================================================================

export const AuthState = Object.freeze({
  Idle: "Idle",
  Authenticating: "Authenticating",
  Authenticated: "Authenticated",
  SessionMissing: "SessionMissing",
  SessionExpired: "SessionExpired",
  SessionRevoked: "SessionRevoked",
  FirebaseTokenFailure: "FirebaseTokenFailure",
  FirebaseAuthFailure: "FirebaseAuthFailure",
  UidMismatch: "UidMismatch",
  Offline: "Offline",
  LoggedOut: "LoggedOut",
});

export class DesktopAuthBridge {
  /**
   * @param {object} deps
   * @param {{load:()=>({uid:string,token:string,expiresAt:number}|null), clear:()=>void}} deps.sessionStore
   * @param {string} deps.backendUrl  backend sintético (emulador-only)
   * @param {{signInWithCustomToken:(t:string)=>Promise<string>, signOut:()=>Promise<void>, currentUid:()=>(string|null)}} deps.authAdapter
   * @param {(line:string)=>void} [deps.log]
   */
  constructor({ sessionStore, backendUrl, authAdapter, log }) {
    this._store = sessionStore;
    this._backendUrl = backendUrl;
    this._auth = authAdapter;
    this._log = log || (() => {});
    this._state = AuthState.Idle;      // construtor SEM side effects (prova anti-1.0.185)
    this._unsubs = new Set();
    this._disposed = false;
  }

  authState() { return this._state; }
  currentUid() { return this._state === AuthState.Authenticated ? this._auth.currentUid() : null; }

  /** Registra um unsubscribe de listener; encerrado no logout/dispose (nunca sobrevive à troca de usuário). */
  trackListener(unsub) {
    if (typeof unsub === "function") this._unsubs.add(unsub);
    return () => { try { unsub(); } finally { this._unsubs.delete(unsub); } };
  }
  activeListeners() { return this._unsubs.size; }

  _set(state) { this._state = state; this._log(`[AUTH_BRIDGE] state=${state}`); return state; }

  /**
   * EXPLÍCITO: valida sessão local -> troca por Custom Token -> signInWithCustomToken ->
   * confirma uid. Qualquer falha => estado de bloqueio (sem Firestore, sem fallback).
   */
  async ensureAuthenticated() {
    if (this._disposed) return this._set(AuthState.LoggedOut);
    const session = this._store.load();
    if (!session || !session.token) return this._set(AuthState.SessionMissing);
    if (typeof session.expiresAt === "number" && Date.now() >= session.expiresAt) {
      return this._set(AuthState.SessionExpired);
    }
    // Curto-circuito seguro: SDK já autenticado com o MESMO uid da sessão.
    if (this._auth.currentUid() === session.uid) return this._set(AuthState.Authenticated);

    this._set(AuthState.Authenticating);
    let reply;
    try {
      const res = await fetch(`${this._backendUrl}/issueFirebaseAuthToken`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
        body: "{}",
      });
      reply = { status: res.status, body: await res.json().catch(() => null) };
    } catch {
      return this._set(AuthState.Offline);   // rede indisponível NÃO libera acesso anônimo
    }
    if (reply.status === 401) return this._set(AuthState.SessionExpired);
    if (reply.status === 403) return this._set(AuthState.SessionRevoked);   // revogada OU usuário inativo
    if (reply.status !== 200 || !reply.body?.ok || typeof reply.body.firebaseToken !== "string") {
      return this._set(AuthState.FirebaseTokenFailure);
    }
    let firebaseUid;
    try {
      firebaseUid = await this._auth.signInWithCustomToken(reply.body.firebaseToken);
    } catch {
      await this._safeSignOut();
      return this._set(AuthState.FirebaseAuthFailure);
    }
    if (firebaseUid !== session.uid) {
      await this._safeSignOut();               // NUNCA opera com identidade divergente
      return this._set(AuthState.UidMismatch);
    }
    return this._set(AuthState.Authenticated);
  }

  /** Encerra TODOS os listeners + Firebase Auth + sessão local. Estado => LoggedOut. */
  async logout() {
    for (const unsub of [...this._unsubs]) { try { unsub(); } catch { /* fecha mesmo com erro */ } }
    this._unsubs.clear();
    await this._safeSignOut();
    this._store.clear();
    return this._set(AuthState.LoggedOut);
  }

  /** Igual ao logout, e a instância não pode ser reutilizada. */
  async dispose() {
    await this.logout();
    this._disposed = true;
  }

  async _safeSignOut() { try { await this._auth.signOut(); } catch { /* signOut nunca lança para fora */ } }
}
