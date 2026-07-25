package br.com.idseven.agenda.data.session

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SecureSessionTest {

    private fun sample(exp: Long, uid: String = "u1", token: String = "tok") =
        SecureSession(uid, token, exp, "Nome", "designer", false, "ativo", "", "#fff")

    @Test fun codec_roundtrip_preserva_tudo() {
        val s = sample(123_456_789L).copy(admin = true, role = "coordenacao")
        assertEquals(s, SessionCodec.decode(SessionCodec.encode(s)))
    }

    @Test fun decode_nulo_ou_malformado_retorna_null() {
        assertNull(SessionCodec.decode(null))
        assertNull(SessionCodec.decode(""))
        assertNull(SessionCodec.decode("{sem json"))
        assertNull(SessionCodec.decode("""{"v":1}""")) // sem uid/token
        assertNull(SessionCodec.decode("""{"v":1,"uid":"u","token":""}"""))
    }

    @Test fun decode_versao_incompativel_retorna_null() {
        assertNull(SessionCodec.decode("""{"v":99,"uid":"u","token":"t"}"""))
    }

    @Test fun valida_quando_futuro_alem_da_folga() {
        val now = 1_000_000L
        assertTrue(sample(now + SecureSession.SKEW_MS + 1).isLocallyValid(now))
    }

    @Test fun invalida_quando_expirada_ou_dentro_da_folga() {
        val now = 1_000_000L
        assertFalse(sample(now - 1).isLocallyValid(now))
        assertFalse(sample(now + SecureSession.SKEW_MS - 1).isLocallyValid(now))
    }

    @Test fun invalida_com_token_ou_uid_em_branco() {
        val now = 0L
        val far = now + 10_000_000L
        assertFalse(sample(far, token = "").isLocallyValid(now))
        assertFalse(sample(far, uid = "").isLocallyValid(now))
    }
}
