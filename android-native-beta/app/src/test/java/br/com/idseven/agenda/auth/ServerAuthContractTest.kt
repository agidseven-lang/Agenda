package br.com.idseven.agenda.auth

import br.com.idseven.agenda.data.auth.AuthApi
import br.com.idseven.agenda.data.auth.AuthError
import br.com.idseven.agenda.data.auth.AuthErrorMapper
import br.com.idseven.agenda.data.auth.LoginOutcome
import br.com.idseven.agenda.data.auth.SelfOutcome
import br.com.idseven.agenda.data.auth.ServerAuthRepository
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.2B — Contrato do login/self SERVER-SIDE (FIXTURES; sem rede real — nao e prova de producao).
 * Cobre os itens 1,2,3,4,5,6,7,8,9,10,11,27,29 da lista do mandato.
 */
class ServerAuthContractTest {

    private fun repoWith(api: FakeAuthApi) = ServerAuthRepository(api)

    // 1. login valido (token + perfil + expiracao normalizada segundos→ms, fiel ao normExp da Desktop)
    @Test
    fun t01_loginValido() = runBlocking {
        val expSec = 1_900_000_000L
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U1", "Owner", "tok-abc", expSec))
        val r = repoWith(api).login("owner@idseven.com", "senha-correta")
        assertTrue(r is LoginOutcome.Success)
        r as LoginOutcome.Success
        assertEquals("tok-abc", r.token)
        assertEquals("U1", r.user.id)
        assertEquals(expSec * 1000L, r.expiresAtMs)
        assertEquals("owner@idseven.com", api.lastIdentifier)
    }

    // 2+3. senha invalida E usuario inexistente → MESMO erro e MESMA mensagem (anti-enumeracao)
    @Test
    fun t02_03_senhaInvalidaEUsuarioInexistenteIndistinguiveis() = runBlocking {
        val badPw = repoWith(FakeAuthApi(FakeAuthApi.http(401, JSONObject().put("ok", false).put("error", "invalid_credentials"))))
            .login("owner@idseven.com", "senha-errada")
        val noUser = repoWith(FakeAuthApi(FakeAuthApi.http(404, JSONObject().put("ok", false).put("error", "not_found"))))
            .login("naoexiste@idseven.com", "qualquer")
        assertTrue(badPw is LoginOutcome.Failure && noUser is LoginOutcome.Failure)
        val e1 = (badPw as LoginOutcome.Failure).error
        val e2 = (noUser as LoginOutcome.Failure).error
        assertEquals(AuthError.INVALID_CREDENTIALS, e1)
        assertEquals(e1, e2)
        assertEquals(AuthErrorMapper.message(e1), AuthErrorMapper.message(e2))
    }

    // 4. usuario desativado detectado por STATUS server-side (login e self)
    @Test
    fun t04_usuarioDesativado() = runBlocking {
        assertTrue(ServerAuthRepository.isDisabled("removido"))
        assertTrue(ServerAuthRepository.isDisabled("Excluido"))
        val api = FakeAuthApi(FakeAuthApi.loginSuccess("U9", "Ex", "t", 1_900_000_000L))
        api.setSelf(FakeAuthApi.selfSuccess("U9", "Ex", "designer", "removido"))
        val self = repoWith(api).self("t")
        assertTrue(self is SelfOutcome.Blocked && (self as SelfOutcome.Blocked).error == AuthError.USER_DISABLED)
    }

    // 5. 401 em getUserSelf → Expired (sessao deve ser limpa pelo caller)
    @Test
    fun t05_selfRespode401() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.http(401, JSONObject().put("ok", false)))
        val r = repoWith(api).self("tok")
        assertTrue(r is SelfOutcome.Expired)
    }

    // 6. 403 → Blocked/FORBIDDEN (NAO e rede; NAO e Expired)
    @Test
    fun t06_selfResponde403() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.http(403, JSONObject().put("ok", false)))
        val r = repoWith(api).self("tok")
        assertTrue(r is SelfOutcome.Blocked && (r as SelfOutcome.Blocked).error == AuthError.FORBIDDEN)
    }

    // 7. 429 → TOO_MANY_REQUESTS no login
    @Test
    fun t07_login429() = runBlocking {
        val r = repoWith(FakeAuthApi(FakeAuthApi.http(429))).login("a@b.c", "x")
        assertTrue(r is LoginOutcome.Failure && (r as LoginOutcome.Failure).error == AuthError.TOO_MANY_REQUESTS)
    }

    // 8. 500 → SERVER_ERROR no login; em self → Unavailable (nao derruba sessao)
    @Test
    fun t08_erro500() = runBlocking {
        val login = repoWith(FakeAuthApi(FakeAuthApi.http(500))).login("a@b.c", "x")
        assertTrue(login is LoginOutcome.Failure && (login as LoginOutcome.Failure).error == AuthError.SERVER_ERROR)
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.http(500))
        assertTrue(repoWith(api).self("tok") is SelfOutcome.Unavailable)
    }

    // 9. timeout → TIMEOUT no login; em self → Unavailable
    @Test
    fun t09_timeout() = runBlocking {
        val login = repoWith(FakeAuthApi(FakeAuthApi.transport(AuthApi.Transport.TIMEOUT))).login("a@b.c", "x")
        assertTrue(login is LoginOutcome.Failure && (login as LoginOutcome.Failure).error == AuthError.TIMEOUT)
        val api = FakeAuthApi(FakeAuthApi.http(200), FakeAuthApi.transport(AuthApi.Transport.TIMEOUT))
        assertTrue(repoWith(api).self("tok") is SelfOutcome.Unavailable)
    }

    // 10. sem rede → NO_NETWORK no login; em self → Unavailable
    @Test
    fun t10_semRede() = runBlocking {
        val login = repoWith(FakeAuthApi(FakeAuthApi.transport(AuthApi.Transport.NO_NETWORK))).login("a@b.c", "x")
        assertTrue(login is LoginOutcome.Failure && (login as LoginOutcome.Failure).error == AuthError.NO_NETWORK)
        val api = FakeAuthApi(FakeAuthApi.http(200), FakeAuthApi.transport(AuthApi.Transport.NO_NETWORK))
        val r = repoWith(api).self("tok")
        assertTrue(r is SelfOutcome.Unavailable && (r as SelfOutcome.Unavailable).error == AuthError.NO_NETWORK)
    }

    // 11. resposta malformada (ok=true sem token/self) → falha canonica, nunca crash
    @Test
    fun t11_respostaMalformada() = runBlocking {
        val semToken = FakeAuthApi(FakeAuthApi.ok(JSONObject().put("ok", true).put("user", JSONObject().put("id", "U1"))))
        val r1 = repoWith(semToken).login("a@b.c", "x")
        assertTrue(r1 is LoginOutcome.Failure)
        val api = FakeAuthApi(FakeAuthApi.http(200), FakeAuthApi.ok(JSONObject().put("ok", true)))
        val r2 = repoWith(api).self("tok")
        assertTrue(r2 is SelfOutcome.Failure && (r2 as SelfOutcome.Failure).error == AuthError.INVALID_RESPONSE)
    }

    // 27. getUserSelf atualiza papel/status (perfil vem da resposta server-side)
    @Test
    fun t27_selfAtualizaPapelStatus() = runBlocking {
        val api = FakeAuthApi(FakeAuthApi.http(500), FakeAuthApi.selfSuccess("U1", "Owner", "admin", "ativo"))
        val r = repoWith(api).self("tok")
        assertTrue(r is SelfOutcome.Success)
        r as SelfOutcome.Success
        assertEquals("admin", r.user.role)
        assertEquals("ativo", r.user.status)
        assertEquals("tok", api.lastSelfToken)   // Bearer com o token da sessao
    }

    // 29. erro de rede NAO e tratado como 401 (categorias distintas no mapper)
    @Test
    fun t29_redeNaoE401() {
        val rede = AuthErrorMapper.mapAuthedFailure(FakeAuthApi.transport(AuthApi.Transport.NO_NETWORK))
        val expirada = AuthErrorMapper.mapAuthedFailure(FakeAuthApi.http(401))
        assertEquals(AuthError.NO_NETWORK, rede)
        assertEquals(AuthError.SESSION_EXPIRED, expirada)
        assertTrue(rede != expirada)
    }

    // extra: normExp identico ao da Desktop (segundos→ms; ms mantidos; <=0 → 0)
    @Test
    fun tExtra_normExp() {
        assertEquals(1_900_000_000_000L, ServerAuthRepository.normExpMs(1_900_000_000.0))     // segundos → ms
        assertEquals(1_900_000_000_000L, ServerAuthRepository.normExpMs(1_900_000_000_000.0)) // ja em ms
        assertEquals(0L, ServerAuthRepository.normExpMs(0.0))
    }
}
