package br.com.idseven.agenda.data.session

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// F4.2C: cifra da sessao com a chave no ANDROID KEYSTORE (AES-256-GCM). NAO usa
// androidx.security-crypto (Jetpack Security em modo de manutencao). Blob = IV(12) || ct+tag.
// decrypt() devolve null em QUALQUER falha (chave ausente apos reinstalar/trocar de aparelho,
// ou tag adulterada) -> tratado como "sem sessao valida". Fail-closed.

interface SessionCipher {
    fun encrypt(plain: ByteArray): ByteArray?
    fun decrypt(blob: ByteArray): ByteArray?
    fun deleteKey()
}

class KeystoreSessionCipher(
    private val alias: String = "idseven_session_key_v1",
) : SessionCipher {

    private val ksName = "AndroidKeyStore"
    private val transform = "AES/GCM/NoPadding"
    private val ivLen = 12
    private val tagBits = 128

    private fun ks(): KeyStore = KeyStore.getInstance(ksName).apply { load(null) }

    private fun getOrCreateKey(): SecretKey {
        (ks().getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ksName)
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)
            .setRandomizedEncryptionRequired(true)
            .build()
        kg.init(spec)
        return kg.generateKey()
    }

    override fun encrypt(plain: ByteArray): ByteArray? = try {
        val c = Cipher.getInstance(transform)
        c.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val iv = c.iv
        iv + c.doFinal(plain)
    } catch (_: Throwable) {
        null
    }

    override fun decrypt(blob: ByteArray): ByteArray? = try {
        if (blob.size <= ivLen) null
        else {
            val key = (ks().getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.secretKey
            if (key == null) null
            else {
                val iv = blob.copyOfRange(0, ivLen)
                val ct = blob.copyOfRange(ivLen, blob.size)
                val c = Cipher.getInstance(transform)
                c.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(tagBits, iv))
                c.doFinal(ct)
            }
        }
    } catch (_: Throwable) {
        null
    }

    override fun deleteKey() {
        try { ks().deleteEntry(alias) } catch (_: Throwable) { /* nada a limpar */ }
    }
}
