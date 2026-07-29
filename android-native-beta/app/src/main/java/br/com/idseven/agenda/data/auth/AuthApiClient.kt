package br.com.idseven.agenda.data.auth

import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/**
 * F4.2B — Implementacao real do AuthApi.
 *
 * PILHA: HttpURLConnection — a MESMA ja usada pelo app (AuthRepo reset de senha / PushNotify);
 * nenhuma dependencia de rede nova (sem OkHttp/Retrofit duplicando pilha; compativel minSdk 26).
 *
 * SEGURANCA:
 *  - HTTPS OBRIGATORIO: URL nao-https e rejeitada ANTES de conectar (fail-closed; cleartext tambem
 *    bloqueado no manifest/network-security-config);
 *  - timeouts explicitos (connect 15s / read 20s — mesmos valores ja aprovados no app);
 *  - NUNCA loga Authorization, senha, token, corpo de requisicao ou corpo bruto de resposta;
 *  - o header Authorization e montado em memoria local e nao escapa deste arquivo;
 *  - respostas sao parseadas e reduzidas a status+JSONObject; falha de parse => body null.
 *
 * URLs vem de BuildConfig (config de build auditavel; default = endpoints reais da Desktop 1.0.181,
 * auth-core.ts @ e4692c9). NUNCA token/credencial em BuildConfig.
 */
class AuthApiClient(
    private val loginUrl: String,
    private val selfUrl: String,
    private val changePasswordUrl: String,
    private val firebaseTokenUrl: String,
    private val registerFcmUrl: String,
    private val removeFcmUrl: String,
    private val contactUrl: String,
) : AuthApi {

    override suspend fun postLogin(identifier: String, password: String): AuthApi.HttpReply {
        val payload = JSONObject().put("identifier", identifier).put("password", password)
        return post(loginUrl, payload, token = null)
    }

    override suspend fun postSelf(token: String): AuthApi.HttpReply =
        post(selfUrl, JSONObject(), token)

    override suspend fun postChangePassword(token: String, oldPassword: String, newPassword: String): AuthApi.HttpReply {
        val payload = JSONObject().put("oldPassword", oldPassword).put("newPassword", newPassword)
        return post(changePasswordUrl, payload, token)
    }

    // F4.2C — issueFirebaseAuthToken: POST vazio; o uid do Custom Token vem SEMPRE da sessao no
    // servidor (Bearer), nunca do corpo. A resposta e reduzida a status+JSONObject por post().
    override suspend fun postFirebaseToken(token: String): AuthApi.HttpReply =
        post(firebaseTokenUrl, JSONObject(), token)

    // F4.2C — registerFcmToken: substitui o write direto em users/{uid}.fcmTokens. Campo do token
    // do dispositivo = "token" (contrato do endpoint), com deviceId + platform. Bearer da sessao.
    override suspend fun postRegisterFcm(token: String, fcmToken: String, deviceId: String, platform: String): AuthApi.HttpReply {
        val payload = JSONObject()
            .put("token", fcmToken)
            .put("deviceId", deviceId)
            .put("platform", platform)
        return post(registerFcmUrl, payload, token)
    }

    // F4.3C1 — removeMyFcmToken: revoga o token FCM do proprio usuario no logout. Mesmo shape do
    // register {token,deviceId,platform}; o servidor remove pelo valor do token e deriva o uid da sessao.
    override suspend fun postRemoveFcm(token: String, fcmToken: String, deviceId: String, platform: String): AuthApi.HttpReply {
        val payload = JSONObject()
            .put("token", fcmToken)
            .put("deviceId", deviceId)
            .put("platform", platform)
        return post(removeFcmUrl, payload, token)
    }

    // F4.3C4B — getUserContact: POST {uid} + Bearer da sessao. Autorizacao (self-or-admin) e feita
    // NO SERVIDOR; a resposta e allowlist {phone,email}. NUNCA le a colecao `users` pelo SDK.
    override suspend fun postContact(token: String, uid: String): AuthApi.HttpReply =
        post(contactUrl, JSONObject().put("uid", uid), token)

    private suspend fun post(url: String, payload: JSONObject, token: String?): AuthApi.HttpReply =
        withContext(Dispatchers.IO) {
            if (!url.startsWith("https://")) {
                return@withContext AuthApi.HttpReply(0, null, AuthApi.Transport.BAD_URL)
            }
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15000
                    readTimeout = 20000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                    if (token != null) setRequestProperty("Authorization", "Bearer $token")
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
                val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                val body = runCatching { JSONObject(text) }.getOrNull()
                AuthApi.HttpReply(code, body, AuthApi.Transport.OK)
            } catch (_: SocketTimeoutException) {
                AuthApi.HttpReply(0, null, AuthApi.Transport.TIMEOUT)
            } catch (_: UnknownHostException) {
                AuthApi.HttpReply(0, null, AuthApi.Transport.NO_NETWORK)
            } catch (_: Throwable) {
                // SSL/IO/inesperado: NUNCA loga a exception com URL+token; reduz a categoria de transporte.
                AuthApi.HttpReply(0, null, AuthApi.Transport.SSL_OR_IO)
            } finally {
                conn?.disconnect()
            }
        }
}
