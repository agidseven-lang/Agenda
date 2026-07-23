package br.com.idseven.agenda.nativebeta.data.session

import android.content.Context
import br.com.idseven.agenda.nativebeta.data.auth.AuthError
import br.com.idseven.agenda.nativebeta.data.auth.LoginOutcome
import br.com.idseven.agenda.nativebeta.data.auth.ServerAuthRepository
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Estado unico de navegacao (fonte da verdade do AppRoot). */
sealed class SessionUiState {
    data object Loading : SessionUiState()
    data object LoggedOut : SessionUiState()
    data class Authenticated(val session: SecureSession) : SessionUiState()
    data class Unavailable(val error: AuthError) : SessionUiState()   // sessao presente, sem validacao (rede)
}

/**
 * F4.2B — Gerenciador de sessao: orquestra login server-side, bootstrap e logout, expondo um
 * StateFlow unico. Testavel (repo/store/bootstrapper/clock injetados). Sem Hilt/Koin.
 */
class SessionManager(
    private val store: SessionVault,
    private val repo: ServerAuthRepository,
    private val bootstrapper: SessionBootstrapper,
    private val now: () -> Long = { System.currentTimeMillis() },
) {
    private val _state = MutableStateFlow<SessionUiState>(SessionUiState.Loading)
    val state: StateFlow<SessionUiState> = _state.asStateFlow()

    // Single-flight: uma tentativa de login por vez (reforca o guard do ViewModel).
    private val inFlight = AtomicBoolean(false)

    /** Arranque: valida a sessao existente por getUserSelf. */
    suspend fun bootstrap() {
        _state.value = SessionUiState.Loading
        _state.value = when (val r = bootstrapper.run()) {
            is BootstrapResult.Authenticated -> SessionUiState.Authenticated(r.session)
            BootstrapResult.NeedLogin -> SessionUiState.LoggedOut
            is BootstrapResult.Unavailable -> SessionUiState.Unavailable(r.error)
        }
    }

    /**
     * Login server-side. Retorna null em sucesso, ou o erro canonico para a UI.
     * A senha vive SOMENTE nos parametros locais; nao e guardada. O single-flight fica no ViewModel.
     */
    suspend fun login(identifier: String, password: String): AuthError? {
        if (!inFlight.compareAndSet(false, true)) return null  // ja existe login em andamento — ignora
        try {
            return when (val r = repo.login(identifier, password)) {
                is LoginOutcome.Success -> {
                    if (ServerAuthRepository.isDisabled(r.user.status)) return AuthError.USER_DISABLED
                    val session = SecureSession(
                        uid = r.user.id,
                        token = r.token,
                        sessionId = UUID.randomUUID().toString(),
                        expiresAtMs = r.expiresAtMs,
                        profile = r.user,
                    )
                    store.save(session)
                    _state.value = SessionUiState.Authenticated(session)
                    null
                }
                is LoginOutcome.Failure -> r.error
            }
        } finally {
            inFlight.set(false)
        }
    }

    /**
     * Logout: SEM endpoint de revogacao server-side no contrato auditado (F4.2A) — risco formalmente
     * documentado e adiado para F4.2C. Aqui: limpeza INTEGRAL local (token + sessionId + perfil +
     * chave do Keystore) e retorno ao login.
     */
    suspend fun logout() {
        store.clear(deleteKey = true)
        _state.value = SessionUiState.LoggedOut
    }

    /** Reavaliacao apos indisponibilidade (ex.: rede voltou). */
    suspend fun retry() = bootstrap()

    companion object {
        /** Fabrica com as dependencias reais (Keystore + endpoints da Desktop 1.0.181). */
        fun create(context: Context): SessionManager {
            val store = SecureSessionStore(context.applicationContext)
            val repo = ServerAuthRepository()
            return SessionManager(store, repo, SessionBootstrapper(store, repo))
        }
    }
}

/**
 * Holder de processo (mandato: sem framework de DI). Inicializado uma vez no arranque
 * (MainActivity) e observado pelo AppRoot / usado pelo LoginViewModel.
 */
object AppSession {
    @Volatile private var instance: SessionManager? = null

    fun get(context: Context): SessionManager =
        instance ?: synchronized(this) {
            instance ?: SessionManager.create(context).also { instance = it }
        }
}
