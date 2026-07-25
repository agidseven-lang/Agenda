package br.com.idseven.agenda.data.net

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BackendTest {

    private data class Sent(val method: String, val url: String, val bearer: String?, val json: JSONObject?)

    private class FakeHttp(val handler: (Sent) -> HttpReply) : HttpClient {
        var last: Sent? = null
        override fun send(method: String, url: String, bearer: String?, json: JSONObject?): HttpReply {
            val s = Sent(method, url, bearer, json); last = s; return handler(s)
        }
    }

    private val urls = BackendUrls.fromBase("https://us-central1-agenda-id-seven.cloudfunctions.net")
    private fun ok(json: String) = HttpReply(200, JSONObject(json), Transport.OK)
    private fun err(code: Int, error: String) = HttpReply(code, JSONObject().put("ok", false).put("error", error), Transport.OK)

    // ---------- loginUser ----------
    @Test fun loginUser_sucesso_extrai_sessao_e_usuario() {
        val http = FakeHttp { ok("""{"ok":true,"session":{"token":"T1","expiresAt":1699999999999},"user":{"id":"u1","name":"Ana","role":"designer","admin":true,"status":"ativo","photo":"p","color":"#fff"}}""") }
        val r = BackendClient(urls, http).loginUser("ana@x.com", "s3nha")
        assertTrue(r is ApiResult.Ok)
        val v = (r as ApiResult.Ok).value
        assertEquals("T1", v.token); assertEquals(1699999999999L, v.expiresAtMs)
        assertEquals("u1", v.user.id); assertTrue(v.user.admin)
        assertEquals("POST", http.last!!.method)
        assertEquals(urls.loginUser, http.last!!.url)
        assertNull(http.last!!.bearer) // login nao leva Bearer
        assertEquals("ana@x.com", http.last!!.json!!.getString("identifier"))
    }

    @Test fun loginUser_401_vira_credenciais_invalidas() {
        val r = BackendClient(urls, FakeHttp { err(401, "invalid_credentials") }).loginUser("a", "b")
        assertEquals(ApiError.INVALID_CREDENTIALS, (r as ApiResult.Fail).error)
    }

    @Test fun loginUser_403_vira_usuario_inativo() {
        val r = BackendClient(urls, FakeHttp { err(403, "user_inactive") }).loginUser("a", "b")
        assertEquals(ApiError.USER_INACTIVE, (r as ApiResult.Fail).error)
    }

    @Test fun loginUser_503_dormant_vira_endpoint_disabled() {
        val r = BackendClient(urls, FakeHttp { err(503, "endpoint_disabled") }).loginUser("a", "b")
        assertEquals(ApiError.ENDPOINT_DISABLED, (r as ApiResult.Fail).error)
    }

    @Test fun loginUser_sem_rede_vira_network() {
        val r = BackendClient(urls, FakeHttp { HttpReply(0, null, Transport.NO_NETWORK) }).loginUser("a", "b")
        assertEquals(ApiError.NETWORK, (r as ApiResult.Fail).error)
    }

    // ---------- issueFirebaseAuthToken ----------
    @Test fun issue_sucesso_devolve_firebaseToken_com_bearer_e_sem_ler_corpo() {
        val http = FakeHttp { ok("""{"ok":true,"uid":"u1","firebaseToken":"FBT","expiresInSec":3600}""") }
        val r = BackendClient(urls, http).issueFirebaseAuthToken("SESS")
        assertEquals("FBT", (r as ApiResult.Ok).value)
        assertEquals("POST", http.last!!.method)
        assertEquals("SESS", http.last!!.bearer)
        assertEquals(urls.issueFirebaseAuthToken, http.last!!.url)
    }

    @Test fun issue_401_vira_sessao_invalida() {
        val r = BackendClient(urls, FakeHttp { err(401, "invalid_session") }).issueFirebaseAuthToken("S")
        assertEquals(ApiError.INVALID_SESSION, (r as ApiResult.Fail).error)
    }

    @Test fun issue_403_vira_usuario_inativo() {
        val r = BackendClient(urls, FakeHttp { err(403, "user_inactive") }).issueFirebaseAuthToken("S")
        assertEquals(ApiError.USER_INACTIVE, (r as ApiResult.Fail).error)
    }

    // ---------- getUserSelf ----------
    @Test fun getUserSelf_sucesso_extrai_perfil() {
        val http = FakeHttp { ok("""{"ok":true,"uid":"u1","self":{"id":"u1","name":"Ana","role":"designer","admin":false,"status":"ativo","photo":"","color":"#fff","reminderMinutes":30,"hasFcmToken":true,"fcmTokensCount":2}}""") }
        val r = BackendClient(urls, http).getUserSelf("S")
        val v = (r as ApiResult.Ok).value
        assertEquals("u1", v.uid); assertEquals("designer", v.role); assertEquals(30, v.reminderMinutes); assertTrue(v.hasFcmToken)
        assertEquals("GET", http.last!!.method); assertEquals("S", http.last!!.bearer)
    }

    @Test fun getUserSelf_reminder_nulo_ok() {
        val http = FakeHttp { ok("""{"ok":true,"uid":"u1","self":{"id":"u1","name":"A","role":"r","admin":false,"status":"ativo","photo":"","color":"","reminderMinutes":null,"hasFcmToken":false,"fcmTokensCount":0}}""") }
        assertNull((BackendClient(urls, http).getUserSelf("S") as ApiResult.Ok).value.reminderMinutes)
    }

    @Test fun getUserSelf_401_vira_sessao_invalida() {
        val r = BackendClient(urls, FakeHttp { err(401, "invalid_session") }).getUserSelf("S")
        assertEquals(ApiError.INVALID_SESSION, (r as ApiResult.Fail).error)
    }

    // ---------- registerFcmToken ----------
    @Test fun registerFcm_envia_token_deviceId_platform_com_bearer() {
        val http = FakeHttp { ok("""{"ok":true,"saved":true,"tokenMasked":true,"hasToken":true,"count":3}""") }
        val r = BackendClient(urls, http).registerFcmToken("S", "FCMTOK", "dev-1", "android-native")
        assertEquals(3, (r as ApiResult.Ok).value)
        val body = http.last!!.json!!
        assertEquals("FCMTOK", body.getString("token"))
        assertEquals("dev-1", body.getString("deviceId"))
        assertEquals("android-native", body.getString("platform"))
        assertEquals("S", http.last!!.bearer)
        assertEquals(urls.registerFcmToken, http.last!!.url)
    }

    @Test fun urls_derivadas_da_base() {
        assertEquals("https://x/loginUser", BackendUrls.fromBase("https://x/").loginUser)
        assertEquals("https://x/registerFcmToken", BackendUrls.fromBase("https://x").registerFcmToken)
    }

    @Test fun status_inativos_reconhecidos() {
        assertTrue(isInactiveStatus("pendente"))
        assertTrue(isInactiveStatus("REMOVIDO"))
        assertTrue(isInactiveStatus("desativado"))
        assertNotNull(urls.getUserSelf)
        org.junit.Assert.assertFalse(isInactiveStatus("ativo"))
        org.junit.Assert.assertFalse(isInactiveStatus(null))
    }
}
