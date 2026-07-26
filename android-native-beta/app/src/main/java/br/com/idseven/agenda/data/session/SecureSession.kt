package br.com.idseven.agenda.data.session

import br.com.idseven.agenda.data.auth.AuthUser
import org.json.JSONObject

/**
 * F4.2B — Sessao autenticada (perfil minimo + token confinado). Este objeto so existe em memoria
 * e, em repouso, SOMENTE criptografado (Android Keystore). NENHUM hash/salt/senha aqui.
 */
data class SecureSession(
    val uid: String,
    val token: String,        // token server-side — NUNCA em claro em disco/log/Intent/deep link
    val sessionId: String,    // identificador local da sessao (por instalacao/login)
    val expiresAtMs: Long,
    val profile: AuthUser,    // perfil publico atualizado pelo getUserSelf (papel/status server-side)
) {
    /** Skew de seguranca (60s) igual em espirito ao EXP_SAFETY_MS da Desktop. */
    fun isLocallyValid(nowMs: Long): Boolean = token.isNotBlank() && expiresAtMs > nowMs + SKEW_MS

    companion object {
        const val SKEW_MS = 60_000L
    }
}

/**
 * Cofre da sessao — interface para permitir teste (fake em memoria) sem Android/Keystore.
 * A implementacao real e SecureSessionStore (arquivo privado + Android Keystore).
 */
interface SessionVault {
    fun save(session: SecureSession)
    fun load(): SecureSession?
    fun loadValid(nowMs: Long): SecureSession?
    fun clear(deleteKey: Boolean = false)
}

/**
 * Serializacao pura (sem lib) do SecureSession para bytes UTF-8 e volta. Testavel em JVM sem
 * Android. O blob em claro so vive DENTRO do envelope de cifra (nunca tocado em disco).
 */
object SessionCodec {
    private const val VERSION = 2

    fun encode(s: SecureSession): ByteArray {
        val p = s.profile
        val json = JSONObject()
            .put("v", VERSION)
            .put("uid", s.uid)
            .put("token", s.token)
            .put("sid", s.sessionId)
            .put("exp", s.expiresAtMs)
            .put("name", p.name)
            .put("role", p.role)
            .put("admin", p.admin)
            .put("status", p.status)
            .put("photo", p.photo)
            .put("color", p.color)
        return json.toString().toByteArray(Charsets.UTF_8)
    }

    fun decode(bytes: ByteArray): SecureSession? = try {
        val j = JSONObject(String(bytes, Charsets.UTF_8))
        val uid = j.optString("uid", "")
        val token = j.optString("token", "")
        if (uid.isBlank() || token.isBlank()) null
        else SecureSession(
            uid = uid,
            token = token,
            sessionId = j.optString("sid", ""),
            expiresAtMs = j.optLong("exp", 0L),
            profile = AuthUser(
                id = uid,
                name = j.optString("name", ""),
                role = j.optString("role", ""),
                admin = j.optBoolean("admin", false),
                status = j.optString("status", ""),
                photo = j.optString("photo", ""),
                color = j.optString("color", ""),
            ),
        )
    } catch (_: Throwable) {
        null
    }
}
