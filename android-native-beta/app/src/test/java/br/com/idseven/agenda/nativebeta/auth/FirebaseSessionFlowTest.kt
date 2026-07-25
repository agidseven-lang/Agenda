package br.com.idseven.agenda.nativebeta.auth

import br.com.idseven.agenda.nativebeta.data.auth.AuthError
import br.com.idseven.agenda.nativebeta.data.auth.AuthUser
import br.com.idseven.agenda.nativebeta.data.auth.ServerAuthRepository
import br.com.idseven.agenda.nativebeta.data.session.FirebaseSessionGate
import br.com.idseven.agenda.nativebeta.data.session.SecureSession
import br.com.idseven.agenda.nativebeta.data.session.SessionBootstrapper
import br.com.idseven.agenda.nativebeta.data.session.SessionManager
import br.com.idseven.agenda.nativebeta.data.session.SessionUiState
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.2C — Fluxo de identidade Firebase no SessionManager (FIXTURES; sem SDK/rede reais — NAO e prova
 * de producao). Cobre: Custom Token valido/invalido, currentUser nulo, UID divergente, inativo,
 * sessao expirada, recuperacao de sessao, perda/retorno de rede, logout com signOut.
 *
 * Fluxo canonico validado: loginUser → sessao (Keystore) → issueFirebaseAuthToken →
 * signInWithCustomToken → valida uid == sessao → SO entao Authenticated (listeners Firestore).
 */
class FirebaseSessionFlowTest {

    private val future = System.currentTimeMillis() + 12L * 3600_000L
    private fun session(uid: String, token: String, exp: Long = future, status: String = "ativo") =
        SecureSession(uid, token, "sid-$uid", exp, AuthUser(id = uid, name = uid, role = "designer", status = status))

    private fun mgr(vault: FakeVault, api: FakeAuthApi, bridge: FakeFirebaseBridge, now: Long = System.currentTimeMillis()): SessionManager {
        val repo = ServerAuthRepository(api)
        val gate = FirebaseSessionGate(repo, bridge)
        return SessionManager(vault, repo, SessionBootstrapper(vault, repo) { now }, gate) { now }
    }

    // ==================== LOGIN ====================

    // 9. Custom Token VALIDO + UID match → Authenticated (o custom token e usado, so em memoria).
    @Test
    fun login_customTokenValido_uidMatch_authentica() = runBlocking {
        val vault = FakeVault()
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U1", "Ana", "tok", 1_900_000_000L))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "U1")
        val m = mgr(vault, api, bridge)
        val err = m.login("ana@idseven.com", "senha")
        assertNull(err)
        assertTrue(m.state.value is SessionUiState.Authenticated)
        assertEquals("U1", vault.current!!.uid)
        assertEquals(1, api.firebaseCalls)          // issueFirebaseAuthToken chamado 1x
        assertEquals(1, bridge.signInCalls)
        assertEquals("FBT", bridge.lastCustomToken)  // custom token efemero em memoria
    }

    // 10. Custom Token INVALIDO (issue 401) → login novo ATOMICO: wipe integral + SESSION_EXPIRED.
    @Test
    fun login_issue401_wipe_e_sessaoExpirada() = runBlocking {
        val vault = FakeVault()
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U1", "Ana", "tok", 1_900_000_000L))
        api.setFirebase(FakeAuthApi.http(401, JSONObject().put("ok", false)))
        val bridge = FakeFirebaseBridge(signInUid = "U1")
        val m = mgr(vault, api, bridge)
        val err = m.login("ana@idseven.com", "senha")
        assertEquals(AuthError.SESSION_EXPIRED, err)
        assertNull(vault.current)                    // sessao recem-salva foi limpa (atomico)
        assertTrue(vault.lastDeleteKey)              // chave do Keystore removida
        assertTrue(bridge.signOuts >= 1)            // FirebaseAuth.signOut no wipe
        assertTrue(m.state.value !is SessionUiState.Authenticated)
    }

    // 11. Firebase currentUser NULO apos signIn (result.user == null) → wipe atomico (nao autentica).
    @Test
    fun login_currentUserNulo_wipe() = runBlocking {
        val vault = FakeVault()
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U1", "Ana", "tok", 1_900_000_000L))
        val bridge = FakeFirebaseBridge(current = null, signInUid = null) // signIn "sem usuario" → lanca
        val m = mgr(vault, api, bridge)
        val err = m.login("ana@idseven.com", "senha")
        assertTrue(err != null && err != AuthError.IDENTITY_MISMATCH) // falha transitoria, nao autentica
        assertNull(vault.current)
        assertTrue(bridge.signOuts >= 1)
    }

    // 12. UID DIVERGENTE (Firebase != sessao) → bloqueio total: wipe + Keystore + IDENTITY_MISMATCH.
    @Test
    fun login_uidDivergente_bloqueiaEwipe() = runBlocking {
        val vault = FakeVault()
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U1", "Ana", "tok", 1_900_000_000L))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "INTRUSO")
        val m = mgr(vault, api, bridge)
        val err = m.login("ana@idseven.com", "senha")
        assertEquals(AuthError.IDENTITY_MISMATCH, err)
        assertNull(vault.current)
        assertTrue(vault.lastDeleteKey)
        assertTrue(bridge.signOuts >= 1)
    }

    // 13. usuario inativo no loginUser → USER_DISABLED ANTES do issue (issue nunca chamado).
    @Test
    fun login_inativo_bloqueiaAntesDoIssue() = runBlocking {
        val vault = FakeVault()
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U1", "Ex", "tok", 1_900_000_000L, status = "removido"))
        val bridge = FakeFirebaseBridge(signInUid = "U1")
        val m = mgr(vault, api, bridge)
        assertEquals(AuthError.USER_DISABLED, m.login("ex@idseven.com", "senha"))
        assertEquals(0, api.firebaseCalls)  // nao emite custom token para inativo
        assertNull(vault.current)
    }

    // 5xx/dormant no issue durante login novo → wipe atomico (SERVER_ERROR).
    @Test
    fun login_issueDormant5xx_wipeAtomico() = runBlocking {
        val vault = FakeVault()
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U1", "Ana", "tok", 1_900_000_000L))
        api.setFirebase(FakeAuthApi.http(503, JSONObject().put("ok", false).put("error", "endpoint_disabled")))
        val bridge = FakeFirebaseBridge(signInUid = "U1")
        val m = mgr(vault, api, bridge)
        assertEquals(AuthError.SERVER_ERROR, m.login("ana@idseven.com", "senha"))
        assertNull(vault.current)
    }

    // ==================== BOOTSTRAP / RECUPERACAO ====================

    // 15. Recuperacao com Firebase JA ativo (SDK restaurou o uid) → Authenticated SEM re-cunhar.
    @Test
    fun bootstrap_firebaseJaAtivo_naoRecunha() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Ana", "coordenacao", "ativo"))
        val bridge = FakeFirebaseBridge(current = "U1")
        val m = mgr(vault, api, bridge)
        m.bootstrap()
        assertTrue(m.state.value is SessionUiState.Authenticated)
        assertEquals("coordenacao", (m.state.value as SessionUiState.Authenticated).session.profile.role)
        assertEquals(0, api.firebaseCalls)  // SDK ja tinha o usuario → sem issue
    }

    // Recuperacao com Firebase NULO → re-cunha via issue e autentica.
    @Test
    fun bootstrap_firebaseNulo_recunhaEautentica() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Ana", "designer", "ativo"))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "U1")
        val m = mgr(vault, api, bridge)
        m.bootstrap()
        assertTrue(m.state.value is SessionUiState.Authenticated)
        assertEquals(1, api.firebaseCalls)
        assertEquals(1, bridge.signInCalls)
    }

    // UID divergente no re-cunho do bootstrap → wipe + volta ao login (nao mostra cache de outro uid).
    @Test
    fun bootstrap_uidDivergente_wipeEvoltaAoLogin() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Ana", "designer", "ativo"))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "OUTRO")
        val m = mgr(vault, api, bridge)
        m.bootstrap()
        assertTrue(m.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
        assertTrue(vault.lastDeleteKey)
        assertTrue(bridge.signOuts >= 1)
    }

    // 16. Perda e retorno de rede no Firebase: 1o bootstrap sem rede no issue → Unavailable (sessao
    // preservada, sem listeners); apos a rede voltar, retry → Authenticated.
    @Test
    fun bootstrap_perdaERetornoDeRede() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Ana", "designer", "ativo"))
        api.setFirebase(FakeAuthApi.transport(br.com.idseven.agenda.nativebeta.data.auth.AuthApi.Transport.NO_NETWORK))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "U1")
        val m = mgr(vault, api, bridge)
        m.bootstrap()
        assertTrue(m.state.value is SessionUiState.Unavailable)  // nao autentica sem Firebase
        assertTrue(vault.current != null)                        // sessao preservada (offline-tolerante)

        // Rede volta: issue passa a responder e o gate estabelece a identidade.
        api.setFirebase(FakeAuthApi.ok(JSONObject().put("ok", true).put("firebaseToken", "FBT")))
        m.retry()
        assertTrue(m.state.value is SessionUiState.Authenticated)
        assertEquals("U1", vault.current!!.uid)
    }

    // ==================== LOGOUT ====================

    // logout encerra a identidade Firebase (signOut) + limpa sessao + chave do Keystore.
    @Test
    fun logout_signOutFirebase_eWipeIntegral() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val bridge = FakeFirebaseBridge(current = "U1")
        val m = mgr(vault, FakeAuthApi(FakeAuthApi.http(500)), bridge)
        m.logout()
        assertTrue(m.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
        assertTrue(vault.lastDeleteKey)
        assertTrue(bridge.signOuts >= 1)
    }
}
