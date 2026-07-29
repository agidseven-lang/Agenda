package br.com.idseven.agenda.auth

import br.com.idseven.agenda.data.auth.AuthApi
import br.com.idseven.agenda.data.auth.FirebaseBridge
import br.com.idseven.agenda.data.session.FcmRevoker
import br.com.idseven.agenda.data.session.SessionCipher
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
    // F4.2C — respostas roteirizadas dos endpoints novos (default = sucesso).
    private var firebaseReply: AuthApi.HttpReply = ok(JSONObject().put("ok", true).put("uid", "").put("firebaseToken", "FBT").put("expiresInSec", 3600)),
    private var fcmReply: AuthApi.HttpReply = ok(JSONObject().put("ok", true).put("saved", true).put("count", 1)),
) : AuthApi {
    var lastIdentifier: String? = null
    var lastPasswordSeen: String? = null
    var lastSelfToken: String? = null
    var loginCalls = 0
    // F4.2C — instrumentacao dos endpoints novos (prova de Bearer/payload; nunca vaza segredo).
    var firebaseCalls = 0
    var lastFirebaseToken: String? = null
    var fcmCalls = 0
    var lastFcmSessionToken: String? = null
    var lastFcmToken: String? = null
    var lastFcmDeviceId: String? = null
    var lastFcmPlatform: String? = null

    fun setSelf(reply: AuthApi.HttpReply) { selfReply = reply }
    fun setFirebase(reply: AuthApi.HttpReply) { firebaseReply = reply }
    fun setFcm(reply: AuthApi.HttpReply) { fcmReply = reply }

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

    override suspend fun postFirebaseToken(token: String): AuthApi.HttpReply {
        firebaseCalls++
        lastFirebaseToken = token
        return firebaseReply
    }

    override suspend fun postRegisterFcm(token: String, fcmToken: String, deviceId: String, platform: String): AuthApi.HttpReply {
        fcmCalls++
        lastFcmSessionToken = token
        lastFcmToken = fcmToken
        lastFcmDeviceId = deviceId
        lastFcmPlatform = platform
        return fcmReply
    }

    // F4.3C1 — instrumentacao do removeMyFcmToken (prova de Bearer/payload no logout; nunca vaza segredo).
    var removeFcmCalls = 0
    var lastRemoveSessionToken: String? = null
    var lastRemoveFcmToken: String? = null
    var lastRemoveDeviceId: String? = null
    var lastRemovePlatform: String? = null
    private var removeReply: AuthApi.HttpReply = ok(JSONObject().put("ok", true).put("saved", true).put("removed", true).put("count", 0))
    var removeDelayMs: Long = 0L   // F4.3C1 — simula demora (para provar o timeout CURTO do logout)
    fun setRemoveFcm(reply: AuthApi.HttpReply) { removeReply = reply }

    override suspend fun postRemoveFcm(token: String, fcmToken: String, deviceId: String, platform: String): AuthApi.HttpReply {
        removeFcmCalls++
        lastRemoveSessionToken = token
        lastRemoveFcmToken = fcmToken
        lastRemoveDeviceId = deviceId
        lastRemovePlatform = platform
        if (removeDelayMs > 0) kotlinx.coroutines.delay(removeDelayMs)
        return removeReply
    }

    // F4.3C4B — instrumentacao do getUserContact (contato individual autorizado; nunca vaza segredo).
    var contactCalls = 0
    var lastContactSessionToken: String? = null
    var lastContactUid: String? = null
    private var contactReply: AuthApi.HttpReply = ok(
        JSONObject().put("ok", true).put("uid", "U1")
            .put("contact", JSONObject().put("phone", "").put("email", "")),
    )
    fun setContact(reply: AuthApi.HttpReply) { contactReply = reply }

    override suspend fun postContact(token: String, uid: String): AuthApi.HttpReply {
        contactCalls++
        lastContactSessionToken = token
        lastContactUid = uid
        return contactReply
    }

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

/**
 * F4.2C — Fake do FirebaseBridge (JVM; sem SDK Firebase). Simula:
 *  - `current`: uid do FirebaseUser ja restaurado pelo SDK (null = SDK sem usuario);
 *  - `signInUid`: uid que o signInWithCustomToken devolvera (para provar UID valido/divergente);
 *  - `throwOnSignIn`: falha do SDK (Custom Token rejeitado / erro de rede do Firebase).
 * Registra chamadas/signOut/custom token visto (para provar que so vive em memoria e nunca vaza).
 */
class FakeFirebaseBridge(
    var current: String? = null,
    var signInUid: String? = null,
    var throwOnSignIn: Boolean = false,
) : FirebaseBridge {
    var signInCalls = 0
    var signOuts = 0
    var lastCustomToken: String? = null

    override suspend fun signInWithCustomToken(customToken: String): String {
        signInCalls++
        lastCustomToken = customToken
        if (throwOnSignIn) throw RuntimeException("firebase_boom")
        current = signInUid
        return signInUid ?: throw IllegalStateException("firebase_no_user")
    }

    override fun currentUid(): String? = current

    override fun signOut() { signOuts++; current = null }
}

/**
 * F4.3C1 — Fake do FcmRevoker (JVM; sem Android). `fcm` = (fcmToken, deviceId) do cache local, ou
 * null (ausente). Registra read()/clearLocal() para provar a ORDEM (revoga antes de limpar) e a
 * limpeza do cache no logout.
 */
class FakeFcmRevoker(
    var fcm: Pair<String, String>? = null,
) : FcmRevoker {
    var reads = 0
    var clears = 0
    override fun read(): Pair<String, String>? { reads++; return fcm }
    override fun clearLocal() { clears++ }
}
