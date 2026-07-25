package br.com.idseven.agenda.nativebeta.auth

import br.com.idseven.agenda.nativebeta.data.auth.AuthApi
import br.com.idseven.agenda.nativebeta.data.auth.AuthError
import br.com.idseven.agenda.nativebeta.data.auth.FcmRegisterOutcome
import br.com.idseven.agenda.nativebeta.data.auth.FirebaseTokenOutcome
import br.com.idseven.agenda.nativebeta.data.auth.ServerAuthRepository
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.2C — Contrato dos endpoints novos (FIXTURES; sem rede real — nao e prova de producao):
 *   issueFirebaseAuthToken (Custom Token) e registerFcmToken (FCM por endpoint).
 * Fiel ao contrato REAL (Backend do commit 11bcb6d, CI-verde):
 *   issue  POST vazio + Bearer → {ok,uid,firebaseToken,expiresInSec}; 401=sessao, 403=inativo.
 *   fcm    POST {token,deviceId,platform} + Bearer → {ok,...,count}.
 */
class FirebaseTokenFcmContractTest {

    private fun repoWith(api: FakeAuthApi) = ServerAuthRepository(api)

    // ---------- issueFirebaseAuthToken ----------

    // Custom Token VALIDO: devolve firebaseToken com Bearer da sessao (o custom token nunca vaza).
    @Test
    fun issue_sucesso_devolve_firebaseToken_com_bearer() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.ok(JSONObject().put("ok", true).put("uid", "U1").put("firebaseToken", "FBT-XYZ").put("expiresInSec", 3600)))
        val r = repoWith(api).issueFirebaseAuthToken("SESS")
        assertTrue(r is FirebaseTokenOutcome.Success)
        assertEquals("FBT-XYZ", (r as FirebaseTokenOutcome.Success).customToken)
        assertEquals("SESS", api.lastFirebaseToken)  // Bearer com o token da sessao
    }

    // 401 no issue → Expired (o caller deve limpar a sessao).
    @Test
    fun issue_401_vira_expired() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.http(401, JSONObject().put("ok", false).put("error", "invalid_session")))
        assertTrue(repoWith(api).issueFirebaseAuthToken("S") is FirebaseTokenOutcome.Expired)
    }

    // 403 no issue → Blocked/USER_DISABLED (usuario inativo detectado no servidor).
    @Test
    fun issue_403_vira_blocked_inativo() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.http(403, JSONObject().put("ok", false).put("error", "user_inactive")))
        val r = repoWith(api).issueFirebaseAuthToken("S")
        assertTrue(r is FirebaseTokenOutcome.Blocked && (r as FirebaseTokenOutcome.Blocked).error == AuthError.USER_DISABLED)
    }

    // Sem rede → Unavailable(NO_NETWORK) (nao derruba sessao no restore).
    @Test
    fun issue_sem_rede_vira_unavailable() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.transport(AuthApi.Transport.NO_NETWORK))
        val r = repoWith(api).issueFirebaseAuthToken("S")
        assertTrue(r is FirebaseTokenOutcome.Unavailable && (r as FirebaseTokenOutcome.Unavailable).error == AuthError.NO_NETWORK)
    }

    // 5xx (inclui dormant/503) → Unavailable(SERVER_ERROR).
    @Test
    fun issue_5xx_vira_unavailable() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.http(503, JSONObject().put("ok", false).put("error", "endpoint_disabled")))
        val r = repoWith(api).issueFirebaseAuthToken("S")
        assertTrue(r is FirebaseTokenOutcome.Unavailable && (r as FirebaseTokenOutcome.Unavailable).error == AuthError.SERVER_ERROR)
    }

    // ok=true porem firebaseToken vazio → Failure(INVALID_RESPONSE), nunca crash.
    @Test
    fun issue_ok_sem_token_vira_failure() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.ok(JSONObject().put("ok", true).put("uid", "U1")))
        val r = repoWith(api).issueFirebaseAuthToken("S")
        assertTrue(r is FirebaseTokenOutcome.Failure && (r as FirebaseTokenOutcome.Failure).error == AuthError.INVALID_RESPONSE)
    }

    // ---------- registerFcmToken ----------

    // Envia token+deviceId+platform com Bearer; devolve count. UID vem da sessao (servidor).
    @Test
    fun fcm_sucesso_envia_payload_e_bearer() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFcm(FakeAuthApi.ok(JSONObject().put("ok", true).put("saved", true).put("count", 3)))
        val r = repoWith(api).registerFcmToken("SESS", "FCMTOK", "dev-1", "android")
        assertTrue(r is FcmRegisterOutcome.Success)
        assertEquals(3, (r as FcmRegisterOutcome.Success).count)
        assertEquals("SESS", api.lastFcmSessionToken)  // Bearer da sessao
        assertEquals("FCMTOK", api.lastFcmToken)
        assertEquals("dev-1", api.lastFcmDeviceId)
        assertEquals("android", api.lastFcmPlatform)
    }

    // 401 no registro FCM → Expired.
    @Test
    fun fcm_401_vira_expired() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFcm(FakeAuthApi.http(401, JSONObject().put("ok", false)))
        assertTrue(repoWith(api).registerFcmToken("S", "T", "d", "android") is FcmRegisterOutcome.Expired)
    }

    // Sem rede / 5xx no registro FCM → Unavailable (best-effort; o proximo login/rotacao reenvia).
    @Test
    fun fcm_rede_e_5xx_viram_unavailable() = runBlocking {
        val net = FakeAuthApi(FakeAuthApi.http(500)).also { it.setFcm(FakeAuthApi.transport(AuthApi.Transport.NO_NETWORK)) }
        assertTrue(repoWith(net).registerFcmToken("S", "T", "d", "android") is FcmRegisterOutcome.Unavailable)
        val srv = FakeAuthApi(FakeAuthApi.http(500)).also { it.setFcm(FakeAuthApi.http(500)) }
        assertTrue(repoWith(srv).registerFcmToken("S", "T", "d", "android") is FcmRegisterOutcome.Unavailable)
    }
}
