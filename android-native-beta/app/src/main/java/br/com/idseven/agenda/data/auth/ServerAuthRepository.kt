package br.com.idseven.agenda.data.auth

import br.com.idseven.agenda.BuildConfig
import org.json.JSONObject

/**
 * F4.2B — Repositorio de autenticacao SERVER-SIDE. Substitui o fluxo client-side (users.get +
 * Crypto.verify) pelo contrato REAL da Desktop 1.0.181:
 *   tela → loginUser → token server-side → getUserSelf → sessao autenticada.
 *
 * PARSING fiel ao auth-core.ts @ e4692c9:
 *   login OK   = HTTP 200 && ok==true && session.token nao-vazio && user.id presente;
 *   self OK    = HTTP 200 && ok==true && self.id presente; 401 => expirado;
 *   expiracao  = normExp(session.expiresAt) (segundos→ms) ou fallback 6h.
 *
 * GARANTIAS:
 *  - NUNCA baixa a colecao users para autenticar;
 *  - NUNCA le/retorna hash ou salt;
 *  - senha existe SOMENTE nos parametros locais desta chamada (o caller limpa apos a tentativa);
 *  - falhas de credencial sao INDISTINGUIVEIS (anti-enumeracao no AuthErrorMapper);
 *  - status desativado (removido/excluido/inativo) e detectado por getUserSelf, nunca no cliente.
 */
class ServerAuthRepository(
    private val api: AuthApi = AuthApiClient(
        loginUrl = BuildConfig.AUTH_LOGIN_URL,
        selfUrl = BuildConfig.AUTH_SELF_URL,
        changePasswordUrl = BuildConfig.AUTH_CHANGE_PASSWORD_URL,
        firebaseTokenUrl = BuildConfig.AUTH_FIREBASE_TOKEN_URL,
        registerFcmUrl = BuildConfig.AUTH_REGISTER_FCM_URL,
    ),
) {
    companion object {
        private const val FALLBACK_TTL_MS = 6L * 3600L * 1000L

        /** Espelha normExp da Desktop: exp em segundos (< 1e12) → ms; senao ja em ms. */
        fun normExpMs(raw: Double): Long {
            if (raw <= 0.0) return 0L
            return if (raw < 1e12) (raw * 1000.0).toLong() else raw.toLong()
        }

        private val DISABLED_STATUS = setOf("removido", "excluido", "excluído", "inativo", "desativado", "bloqueado")

        fun isDisabled(status: String): Boolean = status.trim().lowercase() in DISABLED_STATUS

        private fun parseUser(obj: JSONObject): AuthUser? {
            val id = obj.optString("id", "").ifBlank { obj.optString("uid", "") }
            if (id.isBlank()) return null
            return AuthUser(
                id = id,
                name = obj.optString("name", ""),
                role = obj.optString("role", ""),
                admin = obj.optBoolean("admin", false),
                status = obj.optString("status", ""),
                photo = obj.optString("photo", ""),
                color = obj.optString("color", ""),
            )
        }
    }

    /** loginUser. Envia SOMENTE {identifier,password}. Sucesso confina o token no retorno tipado. */
    suspend fun login(identifier: String, password: String): LoginOutcome {
        val id = identifier.trim()
        if (id.isEmpty() || password.isEmpty()) return LoginOutcome.Failure(AuthError.BAD_REQUEST)

        val reply = api.postLogin(id, password)
        if (reply.transport != AuthApi.Transport.OK) {
            return LoginOutcome.Failure(AuthErrorMapper.mapLoginFailure(reply))
        }
        val j = reply.body
        if (reply.status == 200 && j != null && j.optBoolean("ok", false)) {
            val session = j.optJSONObject("session")
            val userObj = j.optJSONObject("user")
            val token = session?.optString("token", "").orEmpty()
            val user = userObj?.let { parseUser(it) }
            if (token.isNotBlank() && user != null) {
                val exp = normExpMs(session.optDouble("expiresAt", 0.0))
                    .let { if (it > 0L) it else System.currentTimeMillis() + FALLBACK_TTL_MS }
                return LoginOutcome.Success(token = token, expiresAtMs = exp, user = user)
            }
        }
        return LoginOutcome.Failure(AuthErrorMapper.mapLoginFailure(reply))
    }

    /** getUserSelf. 401 => Expired (limpar sessao). Rede fora => Unavailable (NAO derruba sessao). */
    suspend fun self(token: String): SelfOutcome {
        val reply = api.postSelf(token)
        when (reply.transport) {
            AuthApi.Transport.NO_NETWORK -> return SelfOutcome.Unavailable(AuthError.NO_NETWORK)
            AuthApi.Transport.TIMEOUT -> return SelfOutcome.Unavailable(AuthError.TIMEOUT)
            AuthApi.Transport.SSL_OR_IO -> return SelfOutcome.Unavailable(AuthError.UNAVAILABLE)
            AuthApi.Transport.BAD_URL -> return SelfOutcome.Unavailable(AuthError.UNAVAILABLE)
            AuthApi.Transport.OK -> Unit
        }
        val j = reply.body
        if (reply.status == 200 && j != null && j.optBoolean("ok", false)) {
            val selfObj = j.optJSONObject("self")
            val user = selfObj?.let { parseUser(it) }
            if (user != null) {
                if (isDisabled(user.status)) return SelfOutcome.Blocked(AuthError.USER_DISABLED)
                return SelfOutcome.Success(user)
            }
            return SelfOutcome.Failure(AuthError.INVALID_RESPONSE)
        }
        if (reply.status == 401) return SelfOutcome.Expired
        if (reply.status == 403) return SelfOutcome.Blocked(AuthError.FORBIDDEN)
        if (reply.status in 500..599) return SelfOutcome.Unavailable(AuthError.SERVER_ERROR)
        return SelfOutcome.Failure(AuthErrorMapper.mapAuthedFailure(reply))
    }

    /**
     * F4.2C — issueFirebaseAuthToken. POST vazio + Bearer da sessao. Devolve o Custom Token EFEMERO
     * (so em memoria). 401 => Expired (limpar sessao); 403 => Blocked/inativo; rede/5xx/dormant =>
     * Unavailable (login novo trata como atomico; restore tolera). Espelha a estrutura de self().
     */
    suspend fun issueFirebaseAuthToken(token: String): FirebaseTokenOutcome {
        val reply = api.postFirebaseToken(token)
        when (reply.transport) {
            AuthApi.Transport.NO_NETWORK -> return FirebaseTokenOutcome.Unavailable(AuthError.NO_NETWORK)
            AuthApi.Transport.TIMEOUT -> return FirebaseTokenOutcome.Unavailable(AuthError.TIMEOUT)
            AuthApi.Transport.SSL_OR_IO -> return FirebaseTokenOutcome.Unavailable(AuthError.UNAVAILABLE)
            AuthApi.Transport.BAD_URL -> return FirebaseTokenOutcome.Unavailable(AuthError.UNAVAILABLE)
            AuthApi.Transport.OK -> Unit
        }
        val j = reply.body
        if (reply.status == 200 && j != null && j.optBoolean("ok", false)) {
            val fbToken = j.optString("firebaseToken", "")
            if (fbToken.isNotBlank()) return FirebaseTokenOutcome.Success(fbToken)
            return FirebaseTokenOutcome.Failure(AuthError.INVALID_RESPONSE)
        }
        if (reply.status == 401) return FirebaseTokenOutcome.Expired
        if (reply.status == 403) return FirebaseTokenOutcome.Blocked(AuthError.USER_DISABLED)
        if (reply.status in 500..599) return FirebaseTokenOutcome.Unavailable(AuthError.SERVER_ERROR)
        return FirebaseTokenOutcome.Failure(AuthErrorMapper.mapAuthedFailure(reply))
    }

    /**
     * F4.2C — registerFcmToken. Substitui o write direto em users/{uid}.fcmTokens. POST
     * {token,deviceId,platform} + Bearer. 401 => Expired; rede/5xx => Unavailable. O UID e derivado
     * da sessao no servidor (impossivel registrar token para outro UID).
     */
    suspend fun registerFcmToken(token: String, fcmToken: String, deviceId: String, platform: String): FcmRegisterOutcome {
        val reply = api.postRegisterFcm(token, fcmToken, deviceId, platform)
        when (reply.transport) {
            AuthApi.Transport.NO_NETWORK -> return FcmRegisterOutcome.Unavailable(AuthError.NO_NETWORK)
            AuthApi.Transport.TIMEOUT -> return FcmRegisterOutcome.Unavailable(AuthError.TIMEOUT)
            AuthApi.Transport.SSL_OR_IO -> return FcmRegisterOutcome.Unavailable(AuthError.UNAVAILABLE)
            AuthApi.Transport.BAD_URL -> return FcmRegisterOutcome.Unavailable(AuthError.UNAVAILABLE)
            AuthApi.Transport.OK -> Unit
        }
        val j = reply.body
        if (reply.status == 200 && j != null && j.optBoolean("ok", false)) {
            return FcmRegisterOutcome.Success(j.optInt("count", 0))
        }
        if (reply.status == 401) return FcmRegisterOutcome.Expired
        if (reply.status in 500..599) return FcmRegisterOutcome.Unavailable(AuthError.SERVER_ERROR)
        return FcmRegisterOutcome.Failure(AuthErrorMapper.mapAuthedFailure(reply))
    }

    /** changePassword (sessao autenticada; senha atual re-verificada NO SERVIDOR). */
    suspend fun changePassword(token: String, oldPassword: String, newPassword: String): ChangePasswordOutcome {
        val reply = api.postChangePassword(token, oldPassword, newPassword)
        if (reply.transport != AuthApi.Transport.OK) {
            return ChangePasswordOutcome.Failure(AuthErrorMapper.mapAuthedFailure(reply))
        }
        val j = reply.body
        if (reply.status == 200 && j != null && j.optBoolean("ok", false)) return ChangePasswordOutcome.Success
        if (reply.status == 401) return ChangePasswordOutcome.Expired
        return ChangePasswordOutcome.Failure(AuthErrorMapper.mapAuthedFailure(reply))
    }
}
