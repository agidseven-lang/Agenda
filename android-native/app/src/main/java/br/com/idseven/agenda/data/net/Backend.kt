package br.com.idseven.agenda.data.net

import org.json.JSONObject

// F4.2C: cliente dos endpoints oficiais (Firebase Functions Gen2, projeto agenda-id-seven,
// regiao us-central1). Todos sao onRequest JSON (NAO callables). Auth por
// `Authorization: Bearer <session token>` (HMAC do loginUser). Contratos:
//   loginUser(POST {identifier,password})            -> {ok, session:{token,expiresAt}, user{...}}
//   getUserSelf(GET, Bearer)                         -> {ok, uid, self{...role,status,...}}
//   issueFirebaseAuthToken(POST vazio, Bearer)       -> {ok, uid, firebaseToken, expiresInSec}
//   registerFcmToken(POST {token,deviceId,platform}) -> {ok, saved, count, ...}
// O uid do custom token vem SEMPRE da sessao no servidor (nunca do corpo).

/** Erro canonico de API (mapeado de status+campo `error`). Anti-enumeracao no login. */
enum class ApiError {
    NETWORK, TIMEOUT, TLS, SERVER,
    INVALID_CREDENTIALS, USER_INACTIVE, INVALID_SESSION, RATE_LIMITED,
    ENDPOINT_DISABLED, NOT_FOUND, BAD_REQUEST, UNKNOWN
}

sealed class ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>()
    data class Fail(val error: ApiError, val status: Int) : ApiResult<Nothing>()
}

/** Usuario publico (PII-free) retornado por loginUser.user. */
data class PublicUser(
    val id: String, val name: String, val role: String, val admin: Boolean,
    val status: String, val photo: String, val color: String,
)

/** Sessao server-side: token HMAC + expiracao (epoch ms) + perfil publico. */
data class SessionData(val token: String, val expiresAtMs: Long, val user: PublicUser)

/** Perfil proprio (getUserSelf.self). Nunca traz pass/salt/phone/email/tokens. */
data class SelfProfile(
    val uid: String, val name: String, val role: String, val admin: Boolean,
    val status: String, val photo: String, val color: String,
    val reminderMinutes: Int?, val hasFcmToken: Boolean, val fcmTokensCount: Int,
)

/** URLs dos endpoints (derivadas de uma base; sobrepostas por BuildConfig/CI). */
data class BackendUrls(
    val loginUser: String,
    val getUserSelf: String,
    val issueFirebaseAuthToken: String,
    val registerFcmToken: String,
) {
    companion object {
        fun fromBase(base: String): BackendUrls {
            val b = base.trimEnd('/')
            return BackendUrls(
                loginUser = "$b/loginUser",
                getUserSelf = "$b/getUserSelf",
                issueFirebaseAuthToken = "$b/issueFirebaseAuthToken",
                registerFcmToken = "$b/registerFcmToken",
            )
        }
    }
}

/** Seam de backend — os testes injetam um fake. */
interface Backend {
    fun loginUser(identifier: String, password: String): ApiResult<SessionData>
    fun getUserSelf(sessionToken: String): ApiResult<SelfProfile>
    /** Retorna o Firebase Custom Token (campo `firebaseToken`). NUNCA deve ser persistido. */
    fun issueFirebaseAuthToken(sessionToken: String): ApiResult<String>
    /** Retorna a contagem de tokens salvos. */
    fun registerFcmToken(sessionToken: String, fcmToken: String, deviceId: String, platform: String): ApiResult<Int>
}

/** Status que indicam usuario inativo/desativado (fail-closed). */
private val INACTIVE_STATUS = setOf("pendente", "removido", "excluido", "inativo", "desativado", "bloqueado")

fun isInactiveStatus(status: String?): Boolean =
    status != null && INACTIVE_STATUS.contains(status.trim().lowercase())

class BackendClient(
    private val urls: BackendUrls,
    private val http: HttpClient,
) : Backend {

    override fun loginUser(identifier: String, password: String): ApiResult<SessionData> {
        val payload = JSONObject().put("identifier", identifier).put("password", password)
        val r = http.send("POST", urls.loginUser, null, payload)
        transportFail(r)?.let { return ApiResult.Fail(it, 0) }
        if (r.is2xx && r.body?.optBoolean("ok") == true) {
            val session = r.body.optJSONObject("session")
            val user = r.body.optJSONObject("user")
            val token = session?.optString("token").orEmpty()
            if (token.isBlank() || user == null) return ApiResult.Fail(ApiError.SERVER, r.status)
            return ApiResult.Ok(SessionData(token, session.optLong("expiresAt", 0L), parsePublicUser(user)))
        }
        return ApiResult.Fail(mapLoginError(r), r.status)
    }

    override fun getUserSelf(sessionToken: String): ApiResult<SelfProfile> {
        val r = http.send("GET", urls.getUserSelf, sessionToken, null)
        transportFail(r)?.let { return ApiResult.Fail(it, 0) }
        if (r.is2xx && r.body?.optBoolean("ok") == true) {
            val self = r.body.optJSONObject("self") ?: return ApiResult.Fail(ApiError.SERVER, r.status)
            val uid = r.body.optString("uid").ifBlank { self.optString("id") }
            if (uid.isBlank()) return ApiResult.Fail(ApiError.SERVER, r.status)
            return ApiResult.Ok(
                SelfProfile(
                    uid = uid,
                    name = self.optString("name"),
                    role = self.optString("role"),
                    admin = self.optBoolean("admin", false),
                    status = self.optString("status"),
                    photo = self.optString("photo"),
                    color = self.optString("color"),
                    reminderMinutes = if (self.isNull("reminderMinutes")) null else self.optInt("reminderMinutes"),
                    hasFcmToken = self.optBoolean("hasFcmToken", false),
                    fcmTokensCount = self.optInt("fcmTokensCount", 0),
                )
            )
        }
        return ApiResult.Fail(mapSessionError(r), r.status)
    }

    override fun issueFirebaseAuthToken(sessionToken: String): ApiResult<String> {
        // POST sem corpo — o uid vem exclusivamente da sessao no servidor.
        val r = http.send("POST", urls.issueFirebaseAuthToken, sessionToken, JSONObject())
        transportFail(r)?.let { return ApiResult.Fail(it, 0) }
        if (r.is2xx && r.body?.optBoolean("ok") == true) {
            val fbToken = r.body.optString("firebaseToken")
            if (fbToken.isBlank()) return ApiResult.Fail(ApiError.SERVER, r.status)
            return ApiResult.Ok(fbToken)
        }
        return ApiResult.Fail(mapSessionError(r), r.status)
    }

    override fun registerFcmToken(sessionToken: String, fcmToken: String, deviceId: String, platform: String): ApiResult<Int> {
        val payload = JSONObject()
            .put("token", fcmToken)
            .put("deviceId", deviceId)
            .put("platform", platform)
        val r = http.send("POST", urls.registerFcmToken, sessionToken, payload)
        transportFail(r)?.let { return ApiResult.Fail(it, 0) }
        if (r.is2xx && r.body?.optBoolean("ok") == true) {
            return ApiResult.Ok(r.body.optInt("count", 0))
        }
        return ApiResult.Fail(mapSessionError(r), r.status)
    }

    // ---- helpers de mapeamento ----

    private fun transportFail(r: HttpReply): ApiError? = when (r.transport) {
        Transport.OK -> null
        Transport.TIMEOUT -> ApiError.TIMEOUT
        Transport.TLS -> ApiError.TLS
        Transport.NO_NETWORK -> ApiError.NETWORK
        Transport.BAD_URL -> ApiError.TLS
        Transport.IO -> ApiError.NETWORK
    }

    private fun err(r: HttpReply): String = r.body?.optString("error").orEmpty()

    /** Login: colapsa qualquer falha de credencial em INVALID_CREDENTIALS (anti-enumeracao). */
    private fun mapLoginError(r: HttpReply): ApiError = when {
        r.status == 503 || err(r) == "endpoint_disabled" -> ApiError.ENDPOINT_DISABLED
        r.status == 403 || err(r) == "user_inactive" -> ApiError.USER_INACTIVE
        r.status == 429 || err(r) == "rate_limited" -> ApiError.RATE_LIMITED
        r.status == 401 -> ApiError.INVALID_CREDENTIALS
        r.status == 400 -> ApiError.INVALID_CREDENTIALS
        r.status >= 500 -> ApiError.SERVER
        else -> ApiError.UNKNOWN
    }

    /** Endpoints autenticados: 401 = sessao invalida/expirada; 403 = usuario inativo. */
    private fun mapSessionError(r: HttpReply): ApiError = when {
        r.status == 401 || err(r) == "invalid_session" -> ApiError.INVALID_SESSION
        r.status == 403 || err(r) == "user_inactive" -> ApiError.USER_INACTIVE
        r.status == 429 || err(r) == "rate_limited" -> ApiError.RATE_LIMITED
        r.status == 404 || err(r) == "not_found" -> ApiError.NOT_FOUND
        r.status in 400..499 -> ApiError.BAD_REQUEST
        r.status >= 500 -> ApiError.SERVER
        else -> ApiError.UNKNOWN
    }

    private fun parsePublicUser(u: JSONObject): PublicUser = PublicUser(
        id = u.optString("id"),
        name = u.optString("name"),
        role = u.optString("role"),
        admin = u.optBoolean("admin", false),
        status = u.optString("status"),
        photo = u.optString("photo"),
        color = u.optString("color"),
    )
}
