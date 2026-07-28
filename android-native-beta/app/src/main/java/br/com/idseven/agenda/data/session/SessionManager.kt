package br.com.idseven.agenda.data.session

import android.content.Context
import br.com.idseven.agenda.data.auth.AuthError
import br.com.idseven.agenda.data.auth.FcmRemoveOutcome
import br.com.idseven.agenda.data.auth.LoginOutcome
import br.com.idseven.agenda.data.auth.RealFirebaseBridge
import br.com.idseven.agenda.data.auth.ServerAuthRepository
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withTimeoutOrNull

/** Estado unico de navegacao (fonte da verdade do AppRoot). */
sealed class SessionUiState {
    data object Loading : SessionUiState()
    data object LoggedOut : SessionUiState()
    data class Authenticated(val session: SecureSession) : SessionUiState()
    data class Unavailable(val error: AuthError) : SessionUiState()   // sessao presente, sem validacao (rede)
}

/**
 * F4.3C1 (MED-1) — Resultado SANITIZADO da tentativa de revogacao do token FCM no logout. NUNCA
 * carrega token/Bearer/uid — so a categoria do desfecho (para log tecnico/observabilidade e testes).
 */
enum class LogoutFcmResult { Success, NetworkFailure, Unauthorized, ServerFailure, InvalidLocalState }

/**
 * F4.2B — Gerenciador de sessao: orquestra login server-side, bootstrap e logout, expondo um
 * StateFlow unico. Testavel (repo/store/bootstrapper/clock injetados). Sem Hilt/Koin.
 */
class SessionManager(
    private val store: SessionVault,
    private val repo: ServerAuthRepository,
    private val bootstrapper: SessionBootstrapper,
    private val firebaseGate: FirebaseSessionGate,   // F4.2C — ponte de identidade Firebase
    private val fcmRevoker: FcmRevoker,              // F4.3C1 (MED-1) — revogacao do token FCM no logout
    private val logoutFcmTimeoutMs: Long = LOGOUT_FCM_TIMEOUT_MS,   // F4.3C1 — teto CURTO (injetavel p/ teste)
    private val now: () -> Long = { System.currentTimeMillis() },
) {
    private val _state = MutableStateFlow<SessionUiState>(SessionUiState.Loading)
    val state: StateFlow<SessionUiState> = _state.asStateFlow()

    // Single-flight: uma tentativa de login por vez (reforca o guard do ViewModel).
    private val inFlight = AtomicBoolean(false)

    /**
     * Arranque: valida a sessao existente por getUserSelf e SO libera as telas (listeners Firestore)
     * apos garantir a identidade Firebase (F4.2C). Rede fora no Firebase => Unavailable (mantem a
     * sessao). 401/inativo/UID divergente => wipe integral + volta ao login.
     */
    suspend fun bootstrap() {
        _state.value = SessionUiState.Loading
        _state.value = when (val r = bootstrapper.run()) {
            is BootstrapResult.Authenticated -> when (val g = firebaseGate.ensure(r.session)) {
                FirebaseSessionGate.Result.Ok -> SessionUiState.Authenticated(r.session)
                FirebaseSessionGate.Result.Expired -> { wipe(); SessionUiState.LoggedOut }
                FirebaseSessionGate.Result.Disabled -> { wipe(); SessionUiState.LoggedOut }
                FirebaseSessionGate.Result.UidMismatch -> { wipe(); SessionUiState.LoggedOut }
                is FirebaseSessionGate.Result.Unavailable -> SessionUiState.Unavailable(g.error) // transitorio: sessao preservada, sem listeners
            }
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
                    store.save(session)  // sessao precisa existir para o issue/bridge
                    // F4.2C — login novo e ATOMICO: estabelecer a identidade Firebase ANTES de
                    // liberar Authenticated (listeners Firestore). Qualquer falha limpa a sessao
                    // recem-salva (nao deixa meia-sessao sem Firebase).
                    when (val g = firebaseGate.ensure(session)) {
                        FirebaseSessionGate.Result.Ok -> {
                            _state.value = SessionUiState.Authenticated(session)
                            null
                        }
                        FirebaseSessionGate.Result.Expired -> { wipe(); AuthError.SESSION_EXPIRED }
                        FirebaseSessionGate.Result.Disabled -> { wipe(); AuthError.USER_DISABLED }
                        FirebaseSessionGate.Result.UidMismatch -> { wipe(); AuthError.IDENTITY_MISMATCH }
                        is FirebaseSessionGate.Result.Unavailable -> { wipe(); g.error }
                    }
                }
                is LoginOutcome.Failure -> r.error
            }
        } finally {
            inFlight.set(false)
        }
    }

    /** F4.2C — wipe integral: desloga o Firebase e limpa a sessao + a chave do Keystore. */
    private fun wipe() {
        firebaseGate.signOut()
        store.clear(deleteKey = true)
    }

    /**
     * Logout (F4.3C1). ORDEM OBRIGATORIA: (1) tenta REVOGAR o token FCM no servidor com a sessao
     * atual (timeout CURTO — NUNCA trava o logout); (2) limpeza INTEGRAL local SEMPRE (mesmo em falha
     * controlada de revogacao): Firebase signOut + cofre + chave do Keystore + cache local do FCM;
     * (3) volta ao login. Devolve o resultado SANITIZADO da revogacao (sem token/Bearer/uid) para
     * observabilidade/testes. NAO existe revogacao server-side da SESSAO HMAC (24h) — adiada p/ F4.3C2.
     */
    suspend fun logout(): LogoutFcmResult {
        val fcm = runCatching { revokeFcmBeforeLogout() }.getOrElse { LogoutFcmResult.InvalidLocalState }
        firebaseGate.signOut()               // encerra a identidade Firebase
        store.clear(deleteKey = true)        // apaga o cofre + a chave do Keystore
        runCatching { fcmRevoker.clearLocal() }   // apaga o cache local do FCM (uid/token)
        _state.value = SessionUiState.LoggedOut
        return fcm
    }

    /**
     * F4.3C1 (MED-1) — Revoga o token FCM ANTES da limpeza. uid vem SO da sessao no servidor. Timeout
     * curto (withTimeoutOrNull): se estourar/rede fora, NAO trava o logout — retorna falha controlada.
     * Visivel a testes (internal). NUNCA loga token/Bearer/uid.
     */
    internal suspend fun revokeFcmBeforeLogout(): LogoutFcmResult {
        val session = store.load() ?: return LogoutFcmResult.InvalidLocalState
        if (session.token.isBlank()) return LogoutFcmResult.InvalidLocalState
        val fcm = fcmRevoker.read() ?: return LogoutFcmResult.InvalidLocalState
        val (fcmToken, deviceId) = fcm
        if (fcmToken.isBlank()) return LogoutFcmResult.InvalidLocalState
        val outcome = withTimeoutOrNull(logoutFcmTimeoutMs) {
            repo.removeMyFcmToken(session.token, fcmToken, deviceId, "android")
        } ?: return LogoutFcmResult.NetworkFailure   // timeout curto => falha de rede (nao trava o logout)
        return when (outcome) {
            is FcmRemoveOutcome.Success -> LogoutFcmResult.Success
            FcmRemoveOutcome.Expired -> LogoutFcmResult.Unauthorized
            is FcmRemoveOutcome.Unavailable -> LogoutFcmResult.NetworkFailure
            is FcmRemoveOutcome.Failure -> LogoutFcmResult.ServerFailure
        }
    }

    /** Reavaliacao apos indisponibilidade (ex.: rede voltou). */
    suspend fun retry() = bootstrap()

    companion object {
        /** F4.3C1 — teto CURTO da revogacao FCM no logout (nunca trava a saida do usuario). */
        internal const val LOGOUT_FCM_TIMEOUT_MS = 3000L

        /** Fabrica com as dependencias reais (Keystore + endpoints + FirebaseAuth oficial). */
        fun create(context: Context): SessionManager {
            val store = SecureSessionStore(context.applicationContext)
            val repo = ServerAuthRepository()
            val gate = FirebaseSessionGate(repo, RealFirebaseBridge())
            return SessionManager(store, repo, SessionBootstrapper(store, repo), gate, RealFcmRevoker(context))
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
