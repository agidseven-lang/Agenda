package br.com.idseven.agenda.data.auth

import br.com.idseven.agenda.data.net.ApiError
import br.com.idseven.agenda.data.net.ApiResult
import br.com.idseven.agenda.data.net.Backend
import br.com.idseven.agenda.data.net.PublicUser
import br.com.idseven.agenda.data.net.SelfProfile
import br.com.idseven.agenda.data.net.SessionData
import br.com.idseven.agenda.data.session.SecureSession
import br.com.idseven.agenda.data.session.SessionVault
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.Executor

class AuthManagerTest {

    private val NOW = 1_000_000_000_000L
    private val DAY = 24L * 60 * 60 * 1000

    private class FakeVault : SessionVault {
        var stored: SecureSession? = null
        var clears = 0
        var lastDeleteKey = false
        override fun save(session: SecureSession) { stored = session }
        override fun load(): SecureSession? = stored
        override fun clear(deleteKey: Boolean) { stored = null; clears++; lastDeleteKey = deleteKey }
    }

    private class FakeBridge(
        var current: String? = null,
        var signInUid: String? = null,
        var throwOnSignIn: Boolean = false,
    ) : FirebaseBridge {
        var signOuts = 0
        var lastToken: String? = null
        override fun signInWithCustomToken(customToken: String): String {
            lastToken = customToken
            if (throwOnSignIn) throw RuntimeException("boom")
            current = signInUid
            return signInUid ?: throw IllegalStateException("no_uid")
        }
        override fun currentUid(): String? = current
        override fun signOut() { signOuts++; current = null }
    }

    private class FakeBackend(
        var login: ApiResult<SessionData>,
        var issue: ApiResult<String> = ApiResult.Ok("FBT"),
        var self: ApiResult<SelfProfile> = ApiResult.Ok(profile()),
    ) : Backend {
        var loginCalls = 0; var issueCalls = 0; var selfCalls = 0; var fcmCalls = 0
        override fun loginUser(identifier: String, password: String): ApiResult<SessionData> { loginCalls++; return login }
        override fun getUserSelf(sessionToken: String): ApiResult<SelfProfile> { selfCalls++; return self }
        override fun issueFirebaseAuthToken(sessionToken: String): ApiResult<String> { issueCalls++; return issue }
        override fun registerFcmToken(sessionToken: String, fcmToken: String, deviceId: String, platform: String): ApiResult<Int> { fcmCalls++; return ApiResult.Ok(1) }
    }

    private fun mgr(be: FakeBackend, br: FakeBridge, v: FakeVault) =
        AuthManager(be, br, v, executor = Executor { it.run() }, clock = { NOW })

    private fun run(be: FakeBackend, br: FakeBridge, v: FakeVault, restore: Boolean = false): AuthResult {
        var out: AuthResult? = null
        val m = mgr(be, br, v)
        if (restore) m.restore { out = it } else m.signIn("id", "pw") { out = it }
        return out!!
    }

    companion object {
        fun sessionData(uid: String = "u1", status: String = "ativo") =
            SessionData("SESS", 0L, PublicUser(uid, "Ana", "designer", false, status, "", "#fff"))
        fun profile(uid: String = "u1", status: String = "ativo", admin: Boolean = true) =
            SelfProfile(uid, "Ana", "coordenacao", admin, status, "", "#fff", 30, false, 0)
    }

    // ---------------- signIn ----------------
    @Test fun signIn_feliz_valida_uid_salva_e_carrega_perfil_real() {
        val v = FakeVault(); val br = FakeBridge(signInUid = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData("u1")))
        val r = run(be, br, v)
        assertTrue(r is AuthResult.Ok)
        assertEquals("u1", (r as AuthResult.Ok).session.uid)
        assertEquals("coordenacao", r.session.role) // veio do getUserSelf
        assertTrue(r.session.admin)
        assertEquals("u1", v.stored!!.uid)
        assertEquals("FBT", br.lastToken) // custom token usado
        assertEquals(0, v.clears)
    }

    @Test fun signIn_credenciais_invalidas_nao_salva_nem_chama_issue() {
        val v = FakeVault(); val br = FakeBridge()
        val be = FakeBackend(ApiResult.Fail(ApiError.INVALID_CREDENTIALS, 401))
        val r = run(be, br, v)
        assertEquals(AuthFailure.INVALID_CREDENTIALS, (r as AuthResult.Err).failure)
        assertNull(v.stored); assertEquals(0, be.issueCalls)
    }

    @Test fun signIn_inativo_no_login_bloqueia() {
        val v = FakeVault(); val br = FakeBridge()
        val be = FakeBackend(ApiResult.Ok(sessionData(status = "removido")))
        val r = run(be, br, v)
        assertEquals(AuthFailure.USER_INACTIVE, (r as AuthResult.Err).failure)
        assertEquals(0, be.issueCalls); assertNull(v.stored)
    }

    @Test fun signIn_dormant_no_issue_e_atomico_limpa_sessao() {
        val v = FakeVault(); val br = FakeBridge(signInUid = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData("u1")), issue = ApiResult.Fail(ApiError.ENDPOINT_DISABLED, 401))
        val r = run(be, br, v)
        assertEquals(AuthFailure.SERVICE_UNAVAILABLE, (r as AuthResult.Err).failure)
        assertNull(v.stored) // wipe atomico do login novo
    }

    @Test fun signIn_firebase_falha_limpa_e_desloga() {
        val v = FakeVault(); val br = FakeBridge(throwOnSignIn = true)
        val be = FakeBackend(ApiResult.Ok(sessionData("u1")))
        val r = run(be, br, v)
        assertEquals(AuthFailure.FIREBASE_FAILED, (r as AuthResult.Err).failure)
        assertNull(v.stored); assertTrue(br.signOuts >= 1)
    }

    @Test fun signIn_uid_divergente_bloqueia_e_faz_wipe() {
        val v = FakeVault(); val br = FakeBridge(signInUid = "INTRUSO")
        val be = FakeBackend(ApiResult.Ok(sessionData("u1")))
        val r = run(be, br, v)
        assertEquals(AuthFailure.UID_MISMATCH, (r as AuthResult.Err).failure)
        assertNull(v.stored); assertTrue(br.signOuts >= 1); assertTrue(v.lastDeleteKey)
    }

    @Test fun signIn_self_inativo_bloqueia() {
        val v = FakeVault(); val br = FakeBridge(signInUid = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData("u1")), self = ApiResult.Ok(profile(status = "removido")))
        val r = run(be, br, v)
        assertEquals(AuthFailure.USER_INACTIVE, (r as AuthResult.Err).failure)
        assertNull(v.stored)
    }

    @Test fun signIn_self_com_rede_ruim_mantem_sessao_valida() {
        val v = FakeVault(); val br = FakeBridge(signInUid = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData("u1")), self = ApiResult.Fail(ApiError.NETWORK, 0))
        val r = run(be, br, v)
        assertTrue(r is AuthResult.Ok)
        assertEquals("u1", v.stored!!.uid)
    }

    // ---------------- restore ----------------
    private fun validStored(uid: String = "u1") =
        SecureSession(uid, "SESS", NOW + DAY, "Ana", "designer", false, "ativo", "", "#fff")

    @Test fun restore_sem_sessao_pede_login() {
        val v = FakeVault(); val br = FakeBridge()
        val be = FakeBackend(ApiResult.Ok(sessionData()))
        assertEquals(AuthFailure.NEEDS_LOGIN, (run(be, br, v, restore = true) as AuthResult.Err).failure)
    }

    @Test fun restore_sessao_expirada_pede_login() {
        val v = FakeVault().apply { stored = SecureSession("u1", "S", NOW - 1, "A", "r", false, "ativo", "", "") }
        val br = FakeBridge(); val be = FakeBackend(ApiResult.Ok(sessionData()))
        assertEquals(AuthFailure.NEEDS_LOGIN, (run(be, br, v, restore = true) as AuthResult.Err).failure)
    }

    @Test fun restore_com_firebase_ja_ativo_nao_recunha() {
        val v = FakeVault().apply { stored = validStored("u1") }
        val br = FakeBridge(current = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData()))
        val r = run(be, br, v, restore = true)
        assertTrue(r is AuthResult.Ok)
        assertEquals(0, be.issueCalls) // SDK ja tinha o usuario
        assertEquals("coordenacao", (r as AuthResult.Ok).session.role)
    }

    @Test fun restore_recunha_quando_firebase_nulo() {
        val v = FakeVault().apply { stored = validStored("u1") }
        val br = FakeBridge(current = null, signInUid = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData()))
        val r = run(be, br, v, restore = true)
        assertTrue(r is AuthResult.Ok)
        assertEquals(1, be.issueCalls); assertEquals("FBT", br.lastToken)
    }

    @Test fun restore_uid_divergente_no_remint_bloqueia() {
        val v = FakeVault().apply { stored = validStored("u1") }
        val br = FakeBridge(current = null, signInUid = "OUTRO")
        val be = FakeBackend(ApiResult.Ok(sessionData()))
        val r = run(be, br, v, restore = true)
        assertEquals(AuthFailure.UID_MISMATCH, (r as AuthResult.Err).failure)
        assertNull(v.stored)
    }

    @Test fun restore_sessao_invalida_no_servidor_expira() {
        val v = FakeVault().apply { stored = validStored("u1") }
        val br = FakeBridge(current = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData()), self = ApiResult.Fail(ApiError.INVALID_SESSION, 401))
        val r = run(be, br, v, restore = true)
        assertEquals(AuthFailure.SESSION_EXPIRED, (r as AuthResult.Err).failure)
        assertNull(v.stored)
    }

    @Test fun restore_offline_mantem_sessao() {
        val v = FakeVault().apply { stored = validStored("u1") }
        val br = FakeBridge(current = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData()), self = ApiResult.Fail(ApiError.NETWORK, 0))
        val r = run(be, br, v, restore = true)
        assertTrue(r is AuthResult.Ok)
        assertEquals("u1", v.stored!!.uid) // sessao preservada
    }

    // ---------------- signOut ----------------
    @Test fun signOut_limpa_sessao_e_keystore_e_desloga() {
        val v = FakeVault().apply { stored = validStored("u1") }
        val br = FakeBridge(current = "u1")
        val be = FakeBackend(ApiResult.Ok(sessionData()))
        var done = false
        mgr(be, br, v).signOut { done = true }
        assertTrue(done); assertNull(v.stored); assertTrue(v.lastDeleteKey); assertTrue(br.signOuts >= 1)
    }
}
