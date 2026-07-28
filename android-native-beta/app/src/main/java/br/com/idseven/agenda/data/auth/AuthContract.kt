package br.com.idseven.agenda.data.auth

/**
 * F4.2B — Contrato server-side REAL de autenticacao, FIEL ao cliente oficial da Desktop 1.0.181
 * (desktop/src/main/auth-core.ts @ e4692c93644bd4deb380b2ec5ecc486dfcb205ca). NAO cria um sistema
 * de identidade paralelo: reusa exatamente os endpoints Cloud Run loginUser/getUserSelf/changePassword.
 *
 * NENHUM campo aqui carrega hash, salt ou senha em repouso. O token de sessao vive somente:
 *  - em memoria durante a requisicao/uso;
 *  - criptografado no SecureSessionStore (Android Keystore).
 * NUNCA em log, Intent, deep link, notificacao, clipboard, SharedPreferences puro ou DataStore puro.
 */

/** Perfil publico do usuario (identico a AuthUser da Desktop: id,name,role,admin,status,photo,color). */
data class AuthUser(
    val id: String,
    val name: String = "",
    val role: String = "",
    val admin: Boolean = false,
    val status: String = "",
    val photo: String = "",
    val color: String = "",
)

/** Erros canonicos de autenticacao (mapeados para UI; nunca expoem corpo bruto/stack do servidor). */
enum class AuthError {
    INVALID_CREDENTIALS,   // e-mail/WhatsApp OU senha incorretos — INDISTINGUIVEL (anti-enumeracao)
    USER_DISABLED,         // conta removida/excluida/inativa (detectada por status no getUserSelf)
    SESSION_EXPIRED,       // 401 / sessao vencida
    FORBIDDEN,             // 403 — operacao bloqueada (NAO e erro de rede)
    TOO_MANY_REQUESTS,     // 429
    SERVER_ERROR,          // 500/5xx
    NO_NETWORK,            // sem conectividade
    TIMEOUT,               // estouro de tempo
    INVALID_RESPONSE,      // corpo malformado / contrato quebrado
    UNAVAILABLE,           // indisponibilidade transitoria (nao derruba sessao valida)
    BAD_REQUEST,           // campos vazios antes de enviar
    IDENTITY_MISMATCH,     // F4.2C — uid Firebase != uid da sessao (bloqueio total de seguranca)
}

/** Resultado de login: sucesso carrega token+expiracao+perfil; falha carrega SOMENTE o erro canonico. */
sealed class LoginOutcome {
    data class Success(val token: String, val expiresAtMs: Long, val user: AuthUser) : LoginOutcome()
    data class Failure(val error: AuthError) : LoginOutcome()
}

/** Resultado de getUserSelf (bootstrap/restore). */
sealed class SelfOutcome {
    data class Success(val user: AuthUser) : SelfOutcome()
    data object Expired : SelfOutcome()                 // 401 → limpar sessao, voltar ao login
    data class Blocked(val error: AuthError) : SelfOutcome()  // 403 → bloquear operacao (nao limpa sessao)
    data class Unavailable(val error: AuthError) : SelfOutcome()  // rede/timeout/5xx → NAO derruba sessao valida
    data class Failure(val error: AuthError) : SelfOutcome()
}

/** Resultado de troca de senha (sessao autenticada). */
sealed class ChangePasswordOutcome {
    data object Success : ChangePasswordOutcome()
    data object Expired : ChangePasswordOutcome()
    data class Failure(val error: AuthError) : ChangePasswordOutcome()
}

/**
 * F4.2C — Resultado de issueFirebaseAuthToken (endpoint oficial, Bearer da sessao). O Custom Token
 * e EFEMERO: fica confinado no Success, so em memoria, consumido imediatamente pelo FirebaseBridge e
 * NUNCA persistido/logado/enviado a analytics.
 */
sealed class FirebaseTokenOutcome {
    data class Success(val customToken: String) : FirebaseTokenOutcome()
    data object Expired : FirebaseTokenOutcome()                     // 401 → sessao vencida (limpar)
    data class Blocked(val error: AuthError) : FirebaseTokenOutcome()   // 403 → usuario inativo
    data class Unavailable(val error: AuthError) : FirebaseTokenOutcome()  // rede/timeout/5xx/dormant
    data class Failure(val error: AuthError) : FirebaseTokenOutcome()      // corpo malformado
}

/** F4.2C — Resultado de registerFcmToken (substitui o write direto em users/{uid}.fcmTokens). */
sealed class FcmRegisterOutcome {
    data class Success(val count: Int) : FcmRegisterOutcome()
    data object Expired : FcmRegisterOutcome()                        // 401 → sessao vencida
    data class Unavailable(val error: AuthError) : FcmRegisterOutcome()   // rede/timeout/5xx
    data class Failure(val error: AuthError) : FcmRegisterOutcome()
}

/**
 * F4.3C1 (MED-1) — Resultado de removeMyFcmToken: revoga o token FCM do PROPRIO usuario no logout.
 * O UID e derivado da sessao NO SERVIDOR (impossivel remover token de outro UID). Espelha o shape
 * de FcmRegisterOutcome. O token FCM/Bearer NUNCA sao logados.
 */
sealed class FcmRemoveOutcome {
    data class Success(val count: Int) : FcmRemoveOutcome()
    data object Expired : FcmRemoveOutcome()                        // 401 → sessao vencida
    data class Unavailable(val error: AuthError) : FcmRemoveOutcome()   // rede/timeout/5xx
    data class Failure(val error: AuthError) : FcmRemoveOutcome()
}
