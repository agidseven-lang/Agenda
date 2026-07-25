package br.com.idseven.agenda.data.auth

import br.com.idseven.agenda.data.net.ApiError
import br.com.idseven.agenda.data.net.ApiResult
import br.com.idseven.agenda.data.net.Backend
import br.com.idseven.agenda.data.net.SelfProfile
import br.com.idseven.agenda.data.net.isInactiveStatus
import br.com.idseven.agenda.data.session.SecureSession
import br.com.idseven.agenda.data.session.SessionVault
import java.util.concurrent.Executor
import java.util.concurrent.Executors

// F4.2C: orquestrador do login em producao. Fluxo obrigatorio:
//   loginUser -> sessao server-side -> issueFirebaseAuthToken -> signInWithCustomToken ->
//   validar FirebaseAuth.currentUser -> validar UID Firebase == UID da sessao -> getUserSelf ->
//   carregar perfil/funcao reais -> inicializar.
// Qualquer divergencia de UID: signOut + limpa sessao + limpa Keystore + bloqueia + mensagem.
// Sem fallback para Firestore sem autenticacao Firebase. O Custom Token so vive em memoria
// (nunca salvo/logado). Sem coroutines: roda no executor e chama o callback.

enum class AuthFailure {
    INVALID_CREDENTIALS,
    USER_INACTIVE,
    UID_MISMATCH,
    SESSION_EXPIRED,
    FIREBASE_FAILED,
    SERVICE_UNAVAILABLE,
    RATE_LIMITED,
    NETWORK,
    NEEDS_LOGIN,
    UNKNOWN,
}

sealed class AuthResult {
    data class Ok(val session: SecureSession) : AuthResult()
    data class Err(val failure: AuthFailure) : AuthResult()
}

class AuthManager(
    private val backend: Backend,
    private val firebase: FirebaseBridge,
    private val vault: SessionVault,
    private val executor: Executor = Executors.newSingleThreadExecutor(),
    private val clock: () -> Long = { System.currentTimeMillis() },
) {

    fun signIn(identifier: String, password: String, cb: (AuthResult) -> Unit) {
        executor.execute { cb(doSignIn(identifier, password)) }
    }

    fun restore(cb: (AuthResult) -> Unit) {
        executor.execute { cb(doRestore()) }
    }

    fun signOut(after: (() -> Unit)? = null) {
        executor.execute {
            hardWipe()
            after?.invoke()
        }
    }

    // ---- Login novo (com senha) ----
    private fun doSignIn(identifier: String, password: String): AuthResult {
        val login = backend.loginUser(identifier.trim(), password)
        val sd = when (login) {
            is ApiResult.Ok -> login.value
            is ApiResult.Fail -> return AuthResult.Err(mapLogin(login.error))
        }
        if (sd.user.id.isBlank() || sd.token.isBlank()) return AuthResult.Err(AuthFailure.UNKNOWN)
        if (isInactiveStatus(sd.user.status)) { hardWipe(); return AuthResult.Err(AuthFailure.USER_INACTIVE) }

        var session = SecureSession(
            uid = sd.user.id, token = sd.token, expiresAtMs = normExp(sd.expiresAtMs),
            name = sd.user.name, role = sd.user.role, admin = sd.user.admin,
            status = sd.user.status, photo = sd.user.photo, color = sd.user.color,
        )
        vault.save(session) // sessao precisa existir para issue/self

        // Login novo e ATOMICO: qualquer falha do bridge limpa a sessao recem-salva.
        val bridged = bridgeFirebase(session)
        if (bridged == null) { hardWipe(); return AuthResult.Err(lastBridgeFailure) }
        session = bridged

        return when (val self = backend.getUserSelf(session.token)) {
            is ApiResult.Ok -> {
                if (isInactiveStatus(self.value.status)) { hardWipe(); AuthResult.Err(AuthFailure.USER_INACTIVE) }
                else { session = merge(session, self.value); vault.save(session); AuthResult.Ok(session) }
            }
            is ApiResult.Fail -> when (self.error) {
                ApiError.USER_INACTIVE, ApiError.NOT_FOUND -> { hardWipe(); AuthResult.Err(AuthFailure.USER_INACTIVE) }
                ApiError.INVALID_SESSION -> { hardWipe(); AuthResult.Err(AuthFailure.SESSION_EXPIRED) }
                // rede/5xx no getUserSelf: login+firebase ja validos; segue com o perfil do loginUser.
                else -> AuthResult.Ok(session)
            }
        }
    }

    // ---- Recuperacao de sessao (sem senha) ----
    private fun doRestore(): AuthResult {
        val existing = vault.loadValid(clock())
            ?: run { vault.clear(false); return AuthResult.Err(AuthFailure.NEEDS_LOGIN) }

        // Garante um FirebaseUser com o MESMO uid; se o SDK nao restaurou, re-cunha via sessao.
        val session = if (firebase.currentUid() == existing.uid) existing
        else (bridgeFirebase(existing) ?: return AuthResult.Err(lastBridgeFailure))

        return when (val self = backend.getUserSelf(session.token)) {
            is ApiResult.Ok -> {
                if (isInactiveStatus(self.value.status)) { hardWipe(); AuthResult.Err(AuthFailure.USER_INACTIVE) }
                else { val s = merge(session, self.value); vault.save(s); AuthResult.Ok(s) }
            }
            is ApiResult.Fail -> when (self.error) {
                ApiError.USER_INACTIVE, ApiError.NOT_FOUND -> { hardWipe(); AuthResult.Err(AuthFailure.USER_INACTIVE) }
                ApiError.INVALID_SESSION -> { hardWipe(); AuthResult.Err(AuthFailure.SESSION_EXPIRED) }
                // Offline com sessao local valida: recupera a operacao (tolerante a rede).
                else -> AuthResult.Ok(session)
            }
        }
    }

    // Cunha o custom token, assina no Firebase e valida UID == sessao. Em falha faz wipe e
    // devolve null (a causa fica em lastBridgeFailure). O custom token NUNCA e salvo.
    private var lastBridgeFailure: AuthFailure = AuthFailure.UNKNOWN
    private fun bridgeFirebase(session: SecureSession): SecureSession? {
        when (val issued = backend.issueFirebaseAuthToken(session.token)) {
            is ApiResult.Fail -> {
                lastBridgeFailure = when (issued.error) {
                    ApiError.INVALID_SESSION -> { hardWipe(); AuthFailure.SESSION_EXPIRED }
                    ApiError.USER_INACTIVE, ApiError.NOT_FOUND -> { hardWipe(); AuthFailure.USER_INACTIVE }
                    ApiError.ENDPOINT_DISABLED, ApiError.SERVER -> AuthFailure.SERVICE_UNAVAILABLE
                    ApiError.RATE_LIMITED -> AuthFailure.RATE_LIMITED
                    ApiError.NETWORK, ApiError.TIMEOUT, ApiError.TLS -> AuthFailure.NETWORK
                    else -> AuthFailure.FIREBASE_FAILED
                }
                return null
            }
            is ApiResult.Ok -> {
                val firebaseUid = try {
                    firebase.signInWithCustomToken(issued.value) // custom token so em memoria
                } catch (_: Throwable) {
                    lastBridgeFailure = AuthFailure.FIREBASE_FAILED
                    firebase.signOut()
                    return null
                }
                if (firebaseUid != session.uid) {
                    // Divergencia de identidade: bloqueio total.
                    hardWipe()
                    lastBridgeFailure = AuthFailure.UID_MISMATCH
                    return null
                }
                return session
            }
        }
    }

    private fun hardWipe() {
        firebase.signOut()
        vault.clear(deleteKey = true)
    }

    private fun merge(s: SecureSession, self: SelfProfile): SecureSession = s.copy(
        uid = self.uid.ifBlank { s.uid },
        name = self.name.ifBlank { s.name },
        role = self.role.ifBlank { s.role },
        admin = self.admin,
        status = self.status.ifBlank { s.status },
        photo = self.photo.ifBlank { s.photo },
        color = self.color.ifBlank { s.color },
    )

    private fun mapLogin(e: ApiError): AuthFailure = when (e) {
        ApiError.INVALID_CREDENTIALS -> AuthFailure.INVALID_CREDENTIALS
        ApiError.USER_INACTIVE -> AuthFailure.USER_INACTIVE
        ApiError.RATE_LIMITED -> AuthFailure.RATE_LIMITED
        ApiError.ENDPOINT_DISABLED, ApiError.SERVER -> AuthFailure.SERVICE_UNAVAILABLE
        ApiError.NETWORK, ApiError.TIMEOUT, ApiError.TLS -> AuthFailure.NETWORK
        ApiError.INVALID_SESSION -> AuthFailure.SESSION_EXPIRED
        ApiError.NOT_FOUND -> AuthFailure.INVALID_CREDENTIALS
        else -> AuthFailure.UNKNOWN
    }

    // expiresAt em ms; se vier em segundos (< ~ano 2001 em ms), converte; se 0, assume +24h.
    private fun normExp(raw: Long): Long = when {
        raw <= 0L -> clock() + 24L * 60 * 60 * 1000
        raw < 1_000_000_000_000L -> raw * 1000
        else -> raw
    }
}
