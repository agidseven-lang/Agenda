package br.com.idseven.agenda.nativebeta.data.session

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * F4.2B — Envelope de cifra autenticada (AES-256-GCM) para a sessao em repouso.
 *
 * `blob` = IV(12 bytes) || ciphertext+tag(GCM). decrypt() retorna null em QUALQUER falha
 * (chave ausente, tag invalida, bytes truncados) — o chamador trata null como "sem sessao valida".
 */
interface SessionCipher {
    /** IV aleatorio por operacao; retorna IV||ciphertext. */
    fun encrypt(plain: ByteArray): ByteArray

    /** Retorna o plaintext ou null se nao for possivel decifrar/autenticar. */
    fun decrypt(blob: ByteArray): ByteArray?

    /** true quando a chave e do Android Keystore (nao-exportavel, atada ao aparelho/instalacao). */
    fun isDeviceBound(): Boolean
}

/**
 * Implementacao de PRODUCAO: chave AES-256 gerada NO Android Keystore (nao-exportavel), sem
 * exigencia de tela de bloqueio (setUserAuthenticationRequired(false) — mandato: sem lockscreen).
 *
 * ATADO AO APARELHO/INSTALACAO: a chave nunca sai do Keystore. Uma sessao criptografada restaurada
 * em OUTRO aparelho (ou apos reinstalacao) nao pode ser decifrada — a chave nao existe la — logo a
 * sessao e considerada INVALIDA. Combina com allowBackup=false (o blob nem sai por backup).
 *
 * NAO usa androidx.security-crypto (Jetpack Security esta em modo de manutencao/descontinuado):
 * o primitivo Keystore nativo e a via recomendada e sem dependencia nova (compativel minSdk 26).
 */
class KeystoreSessionCipher(
    private val alias: String = DEFAULT_ALIAS,
) : SessionCipher {

    companion object {
        const val DEFAULT_ALIAS = "idseven_session_key_v1"
        private const val KEYSTORE = "AndroidKeyStore"
        private const val TRANSFORM = "AES/GCM/NoPadding"
        private const val IV_LEN = 12
        private const val TAG_BITS = 128
    }

    private fun ks(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

    private fun getOrCreateKey(): SecretKey {
        val store = ks()
        (store.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)
            .setRandomizedEncryptionRequired(true)
            .build()
        gen.init(spec)
        return gen.generateKey()
    }

    override fun encrypt(plain: ByteArray): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val iv = cipher.iv // 12 bytes gerados pelo provider
        val ct = cipher.doFinal(plain)
        return ByteArray(iv.size + ct.size).also {
            System.arraycopy(iv, 0, it, 0, iv.size)
            System.arraycopy(ct, 0, it, iv.size, ct.size)
        }
    }

    override fun decrypt(blob: ByteArray): ByteArray? = try {
        if (blob.size <= IV_LEN) null
        else {
            val store = ks()
            val entry = store.getEntry(alias, null) as? KeyStore.SecretKeyEntry ?: return null
            val iv = blob.copyOfRange(0, IV_LEN)
            val ct = blob.copyOfRange(IV_LEN, blob.size)
            val cipher = Cipher.getInstance(TRANSFORM)
            cipher.init(Cipher.DECRYPT_MODE, entry.secretKey, GCMParameterSpec(TAG_BITS, iv))
            cipher.doFinal(ct)
        }
    } catch (_: Throwable) {
        // chave ausente (outro aparelho/reinstalacao) OU tag invalida (adulteracao) => sessao invalida.
        null
    }

    /** Remove a chave do Keystore (logout duro; a proxima sessao gera chave nova). */
    fun deleteKey() {
        try { ks().deleteEntry(alias) } catch (_: Throwable) { /* idempotente */ }
    }

    override fun isDeviceBound(): Boolean = true
}
