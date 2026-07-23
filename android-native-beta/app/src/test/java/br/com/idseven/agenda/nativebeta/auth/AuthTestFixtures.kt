package br.com.idseven.agenda.nativebeta.auth

import br.com.idseven.agenda.nativebeta.data.auth.AuthApi
import br.com.idseven.agenda.nativebeta.data.session.SessionCipher
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject

/**
 * F4.2B — FIXTURES de teste (JVM). Marcadas como fixtures: NAO substituem prova fisica com contas
 * reais. Simulam o AuthApi (sem rede) e a cifra de sessao (chave fixa em memoria, AES-GCM real).
 */

/** Fake do AuthApi: devolve respostas roteirizadas por chamada; registra a senha vista (para provar
 *  que nao vaza) e o Authorization (para provar Bearer). */
class FakeAuthApi(
    private var loginReply: AuthApi.HttpReply,
    private var selfReply: AuthApi.HttpReply = ok(JSONObject().put("ok", true)),
    private var changeReply: AuthApi.HttpReply = ok(JSONObject().put("ok", true)),
) : AuthApi {
    var lastIdentifier: String? = null
    var lastPasswordSeen: String? = null
    var lastSelfToken: String? = null
    var loginCalls = 0

    fun setSelf(reply: AuthApi.HttpReply) { selfReply = reply }

    override suspend fun postLogin(identifier: String, password: String): AuthApi.HttpReply {
        loginCalls++
        lastIdentifier = identifier
        lastPasswordSeen = password
        return loginReply
    }

    override suspend fun postSelf(token: String): AuthApi.HttpReply {
        lastSelfToken = token
        return selfReply
    }

    override suspend fun postChangePassword(token: String, oldPassword: String, newPassword: String): AuthApi.HttpReply =
        changeReply

    companion object {
        fun ok(body: JSONObject) = AuthApi.HttpReply(200, body, AuthApi.Transport.OK)
        fun http(status: Int, body: JSONObject? = null) = AuthApi.HttpReply(status, body, AuthApi.Transport.OK)
        fun transport(t: AuthApi.Transport) = AuthApi.HttpReply(0, null, t)

        fun loginSuccess(uid: String, name: String, token: String, expiresAtSec: Long, status: String = "ativo", role: String = "designer") =
            ok(
                JSONObject()
                    .put("ok", true)
                    .put("session", JSONObject().put("token", token).put("expiresAt", expiresAtSec))
                    .put("user", JSONObject().put("id", uid).put("name", name).put("role", role).put("status", status).put("admin", false)),
            )

        fun selfSuccess(uid: String, name: String, role: String, status: String) =
            ok(JSONObject().put("ok", true).put("self", JSONObject().put("id", uid).put("name", name).put("role", role).put("status", status)))
    }
}

/**
 * Cifra de FIXTURE: AES-256-GCM com chave FIXA em memoria (nao usa Android Keystore — roda em JVM).
 * Prova o envelope (IV aleatorio, ciphertext != plaintext, round-trip, tag autenticada, chave errada
 * => null como "outro aparelho"). O contrato (AES-GCM, IV 12, tag 128) e o MESMO do KeystoreSessionCipher.
 */
class FixedKeyAesGcmCipher(seed: Byte = 7) : SessionCipher {
    private val key = SecretKeySpec(ByteArray(32) { (it + seed).toByte() }, "AES")
    private val rnd = SecureRandom()
    private val ivLen = 12
    private val tagBits = 128

    override fun encrypt(plain: ByteArray): ByteArray {
        val iv = ByteArray(ivLen).also { rnd.nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(tagBits, iv))
        val ct = c.doFinal(plain)
        return iv + ct
    }

    override fun decrypt(blob: ByteArray): ByteArray? = try {
        if (blob.size <= ivLen) null
        else {
            val iv = blob.copyOfRange(0, ivLen)
            val ct = blob.copyOfRange(ivLen, blob.size)
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(tagBits, iv))
            c.doFinal(ct)
        }
    } catch (_: Throwable) {
        null
    }

    override fun isDeviceBound(): Boolean = true
}
