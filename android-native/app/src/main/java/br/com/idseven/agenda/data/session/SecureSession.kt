package br.com.idseven.agenda.data.session

import org.json.JSONObject

// F4.2C: sessao server-side persistida CIFRADA (ver SessionCipher/SecureSessionStore).
// Guarda o token de sessao HMAC (do loginUser), a expiracao e o perfil publico (PII-free).
// NUNCA guarda: senha, hash, salt, Firebase Custom Token, Firebase ID Token.
// O Firebase ID Token e gerido pelo SDK oficial (auto-refresh); o Custom Token so vive em memoria.

data class SecureSession(
    val uid: String,
    val token: String,
    val expiresAtMs: Long,
    val name: String,
    val role: String,
    val admin: Boolean,
    val status: String,
    val photo: String,
    val color: String,
) {
    /** Valida localmente (com folga de relogio) antes de qualquer uso. */
    fun isLocallyValid(nowMs: Long): Boolean =
        uid.isNotBlank() && token.isNotBlank() && expiresAtMs > nowMs + SKEW_MS

    companion object {
        const val SKEW_MS = 60_000L
    }
}

/** Serializacao estavel e versionada (org.json). Sem lib externa. */
object SessionCodec {
    private const val VERSION = 1

    fun encode(s: SecureSession): String = JSONObject()
        .put("v", VERSION)
        .put("uid", s.uid)
        .put("token", s.token)
        .put("exp", s.expiresAtMs)
        .put("name", s.name)
        .put("role", s.role)
        .put("admin", s.admin)
        .put("status", s.status)
        .put("photo", s.photo)
        .put("color", s.color)
        .toString()

    fun decode(raw: String?): SecureSession? {
        if (raw.isNullOrBlank()) return null
        return try {
            val o = JSONObject(raw)
            if (o.optInt("v", -1) != VERSION) return null
            val uid = o.optString("uid")
            val token = o.optString("token")
            if (uid.isBlank() || token.isBlank()) return null
            SecureSession(
                uid = uid,
                token = token,
                expiresAtMs = o.optLong("exp", 0L),
                name = o.optString("name"),
                role = o.optString("role"),
                admin = o.optBoolean("admin", false),
                status = o.optString("status"),
                photo = o.optString("photo"),
                color = o.optString("color"),
            )
        } catch (_: Throwable) {
            null
        }
    }
}

/** Cofre de sessao — abstrai o armazenamento cifrado (fake nos testes). */
interface SessionVault {
    fun save(session: SecureSession)
    fun load(): SecureSession?
    fun loadValid(nowMs: Long): SecureSession? = load()?.takeIf { it.isLocallyValid(nowMs) }
    /** Limpa a sessao. deleteKey=true tambem apaga a chave do Keystore (logout forte). */
    fun clear(deleteKey: Boolean)
}
