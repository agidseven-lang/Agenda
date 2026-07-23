package br.com.idseven.agenda.nativebeta.auth

import br.com.idseven.agenda.nativebeta.data.auth.AuthUser
import br.com.idseven.agenda.nativebeta.data.session.SecureSession
import br.com.idseven.agenda.nativebeta.data.session.SessionBootstrapper
import br.com.idseven.agenda.nativebeta.data.session.SessionManager
import br.com.idseven.agenda.nativebeta.data.session.SessionUiState
import br.com.idseven.agenda.nativebeta.data.auth.ServerAuthRepository
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.2B — Fluxo de sessao (SessionManager + SessionBootstrapper) com fakes. Cobre 16,17,18,19,20,21,
 * 22,23,28,29 (bootstrap valido/expirado/adulterado/restart/logout/limpeza/troca-usuario/desativado/
 * single-flight/rede-nao-derruba).
 */
class SessionFlowTest {

    private val future = System.currentTimeMillis() + 12L * 3600_000L
    private fun session(uid: String, token: String, exp: Long = future, status: String = "ativo") =
        SecureSession(uid, token, "sid-$uid", exp, AuthUser(id = uid, name = uid, role = "designer", status = status))

    private fun manager(vault: FakeVault, api: FakeAuthApi, now: Long = System.currentTimeMillis()): SessionManager {
        val repo = ServerAuthRepository(api)
        return SessionManager(vault, repo, SessionBootstrapper(vault, repo) { now }) { now }
    }

    // 16. bootstrap com sessao valida + getUserSelf OK → Authenticated e perfil atualizado.
    @Test
    fun t16_bootstrapSessaoValida() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Owner", "admin", "ativo"))
        val mgr = manager(vault, api)
        mgr.bootstrap()
        val st = mgr.state.value
        assertTrue(st is SessionUiState.Authenticated)
        assertEquals("admin", (st as SessionUiState.Authenticated).session.profile.role) // 27: papel atualizado
    }

    // 17. bootstrap com sessao expirada (local) → limpa e vai para login (sem chamar rede).
    @Test
    fun t17_bootstrapExpiradaLocal() = runBlocking {
        val now = 2_000_000_000_000L
        val vault = FakeVault(session("U1", "tok", exp = now - 1))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val mgr = manager(vault, api, now)
        mgr.bootstrap()
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
    }

    // 18. bootstrap com token adulterado/invalido no servidor (401) → limpa e volta ao login.
    @Test
    fun t18_bootstrapTokenInvalido401() = runBlocking {
        val vault = FakeVault(session("U1", "tok-adulterado"))
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.http(401))
        val mgr = manager(vault, api)
        mgr.bootstrap()
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
    }

    // 19. reinicio do app com sessao valida: novo bootstrap → Authenticated (persistencia sobrevive).
    @Test
    fun t19_reinicioMantemSessao() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Owner", "designer", "ativo"))
        // "reinicio" = novo SessionManager sobre o MESMO cofre.
        manager(vault, api).bootstrap()
        val mgr2 = manager(vault, api)
        mgr2.bootstrap()
        assertTrue(mgr2.state.value is SessionUiState.Authenticated)
    }

    // 28 + 29. desativado no servidor → login; rede fora NAO derruba sessao (Unavailable, cofre intacto).
    @Test
    fun t28_29_desativadoVsRede() = runBlocking {
        val vaultDis = FakeVault(session("U1", "tok"))
        manager(vaultDis, FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Ex", "designer", "removido"))).bootstrap().also {
            // desativado → login + limpa
        }
        assertNull(vaultDis.current)

        val vaultNet = FakeVault(session("U1", "tok"))
        val mgrNet = manager(vaultNet, FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.transport(br.com.idseven.agenda.nativebeta.data.auth.AuthApi.Transport.NO_NETWORK)))
        mgrNet.bootstrap()
        assertTrue(mgrNet.state.value is SessionUiState.Unavailable) // nao derruba
        assertTrue(vaultNet.current != null)                         // sessao preservada
    }

    // 20 + 21. logout limpa integralmente (token + chave) e volta ao login.
    @Test
    fun t20_21_logoutLimpaIntegral() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val mgr = manager(vault, FakeAuthApi(FakeAuthApi.http(500)))
        mgr.logout()
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
        assertEquals(1, vault.clears)
        assertTrue("logout deve pedir remocao da chave do Keystore", vault.lastDeleteKey)
    }

    // 22. troca de usuario: login U2 sobre sessao U1 substitui integralmente a sessao.
    @Test
    fun t22_trocaDeUsuario() = runBlocking {
        val vault = FakeVault(session("U1", "tok-1"))
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U2", "Tatiana", "tok-2", 1_900_000_000L))
        val mgr = manager(vault, api)
        val err = mgr.login("tatiana@idseven.com", "senha")
        assertNull(err)
        assertEquals("U2", vault.current!!.uid)
        assertEquals("tok-2", vault.current!!.token)
    }

    // 23. single-flight: enquanto um login esta em andamento, um segundo e ignorado (nao chama a API).
    @Test
    fun t23_singleFlight() = runBlocking {
        val gate = CompletableDeferred<Unit>()
        val slowApi = object : br.com.idseven.agenda.nativebeta.data.auth.AuthApi {
            var calls = 0
            override suspend fun postLogin(identifier: String, password: String): br.com.idseven.agenda.nativebeta.data.auth.AuthApi.HttpReply {
                calls++; gate.await(); return FakeAuthApi.loginSuccess("U1", "Owner", "tok", 1_900_000_000L)
            }
            override suspend fun postSelf(token: String) = FakeAuthApi.http(200)
            override suspend fun postChangePassword(token: String, oldPassword: String, newPassword: String) = FakeAuthApi.http(200)
        }
        val vault = FakeVault()
        val mgr = manager(vault, FakeAuthApi(FakeAuthApi.http(500)))
        val mgr2 = SessionManager(vault, ServerAuthRepository(slowApi), SessionBootstrapper(vault, ServerAuthRepository(slowApi)))
        val job = launch { mgr2.login("a@b.c", "x") }   // entra e suspende em gate.await()
        while (slowApi.calls < 1) yield()
        val second = mgr2.login("a@b.c", "x")            // in-flight → ignorado, NAO chama a API
        assertNull(second)
        assertEquals(1, slowApi.calls)
        gate.complete(Unit)
        job.join()
        assertEquals(1, slowApi.calls)
    }
}
