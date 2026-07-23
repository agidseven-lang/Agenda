package br.com.idseven.agenda.nativebeta.auth

import br.com.idseven.agenda.nativebeta.data.auth.AuthUser
import br.com.idseven.agenda.nativebeta.data.session.SecureSession
import br.com.idseven.agenda.nativebeta.data.session.SessionCodec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.2B — Envelope de sessao seguro (FIXTURES: cifra AES-GCM de chave fixa; o contrato e o mesmo do
 * KeystoreSessionCipher). Cobre 12 (senha nunca persistida), 13 (token cifrado em repouso), 26
 * (hash/salt ausentes), e a validacao de expiracao/adulteracao/outro-aparelho.
 */
class SecureSessionTest {

    private fun sample(token: String = "tok-SECRET-123", exp: Long = Long.MAX_VALUE) = SecureSession(
        uid = "U1",
        token = token,
        sessionId = "sid-1",
        expiresAtMs = exp,
        profile = AuthUser(id = "U1", name = "Owner", role = "admin", status = "ativo"),
    )

    // 13. token cifrado em repouso: os bytes gravados NAO contem o token em claro; round-trip ok.
    @Test
    fun t13_tokenCifradoEmRepouso() {
        val cipher = FixedKeyAesGcmCipher()
        val plain = SessionCodec.encode(sample())
        val blob = cipher.encrypt(plain)

        val blobStr = String(blob, Charsets.ISO_8859_1)
        assertFalse("token nao pode aparecer em claro no blob", blobStr.contains("tok-SECRET-123"))
        assertTrue("IV(12)+ciphertext+tag maior que o plaintext", blob.size > plain.size)

        val back = SessionCodec.decode(cipher.decrypt(blob)!!)
        assertNotNull(back)
        assertEquals("tok-SECRET-123", back!!.token)
        assertEquals("admin", back.profile.role)
    }

    // 13b. adulteracao do ciphertext → decrypt null (tag GCM); outro aparelho (chave diferente) → null.
    @Test
    fun t13b_adulteracaoEOutroAparelhoInvalidam() {
        val cipher = FixedKeyAesGcmCipher(seed = 7)
        val blob = cipher.encrypt(SessionCodec.encode(sample()))

        val tampered = blob.copyOf(); tampered[tampered.size - 1] = (tampered.last() + 1).toByte()
        assertNull("blob adulterado nao decifra", cipher.decrypt(tampered))

        val outroAparelho = FixedKeyAesGcmCipher(seed = 42) // chave diferente = outro Keystore
        assertNull("blob de outro aparelho nao decifra (chave ausente)", outroAparelho.decrypt(blob))
    }

    // 12 + 26. o blob serializado NAO carrega senha, hash (pass) nem salt — nunca existiram na sessao.
    @Test
    fun t12_26_semSenhaHashSalt() {
        val json = String(SessionCodec.encode(sample()), Charsets.UTF_8).lowercase()
        assertFalse(json.contains("\"pass\""))
        assertFalse(json.contains("\"salt\""))
        assertFalse(json.contains("password"))
        assertFalse(json.contains("senha"))
        // o codec so possui campos publicos + token:
        assertTrue(json.contains("\"token\""))
        assertTrue(json.contains("\"role\""))
    }

    // validacao de expiracao local (com skew de 60s).
    @Test
    fun tExp_isLocallyValid() {
        val now = 1_000_000_000_000L
        assertTrue(sample(exp = now + 10 * 60_000L).isLocallyValid(now))
        assertFalse(sample(exp = now + 30_000L).isLocallyValid(now))  // dentro do skew → invalido
        assertFalse(sample(exp = now - 1).isLocallyValid(now))
        assertFalse(sample(token = "", exp = Long.MAX_VALUE).isLocallyValid(now)) // sem token → invalido
    }

    // codec robusto: bytes invalidos → null (nunca crash).
    @Test
    fun tCodec_bytesInvalidos() {
        assertNull(SessionCodec.decode("nao-e-json".toByteArray()))
        assertNull(SessionCodec.decode(ByteArray(0)))
    }
}
