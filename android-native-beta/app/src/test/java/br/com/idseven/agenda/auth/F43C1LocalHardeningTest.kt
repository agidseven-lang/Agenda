package br.com.idseven.agenda.auth

import br.com.idseven.agenda.data.AuthRepo
import br.com.idseven.agenda.data.auth.AuthError
import br.com.idseven.agenda.data.auth.AuthUser
import br.com.idseven.agenda.data.auth.FirebaseBridge
import br.com.idseven.agenda.data.auth.ServerAuthRepository
import br.com.idseven.agenda.data.session.AuthenticatedFirestoreExecutor
import br.com.idseven.agenda.data.session.FirebaseSessionGate
import br.com.idseven.agenda.data.session.LogoutFcmResult
import br.com.idseven.agenda.data.session.SecureSession
import br.com.idseven.agenda.data.session.SessionBootstrapper
import br.com.idseven.agenda.data.session.SessionManager
import br.com.idseven.agenda.data.session.SessionUiState
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.3C1 — TESTES UNITARIOS das correcoes locais de seguranca do Android (FIXTURES; JVM, sem SDK/rede
 * reais — NAO e prova fisica de producao). 35 asserts numerados, agrupados exatamente como na
 * autorizacao:
 *   LOGOUT E FCM ...... 1..10  (revogar o token FCM ANTES da limpeza; nunca travar o logout)
 *   REGISTRO .......... 11..16 (cadastro direto em /users DESABILITADO, fail-closed)
 *   SESSION GATE ...... 17..25 (AuthenticatedFirestoreExecutor fail-closed; sem fallback nao-auth)
 *   LOGS .............. 26..30 (resultados SANITIZADOS: categorias fechadas, sem token/uid/Bearer)
 *   SESSAO ............ 31..35 (limpeza integral: cofre + chave Keystore + cache FCM + estado)
 *
 * Reusa as fixtures da F4.2B/F4.2C (FakeAuthApi, FakeVault, FakeFirebaseBridge, FakeFcmRevoker) — o
 * removeMyFcmToken e as novas dependencias entram por injecao, sem tocar Keystore/FirebaseFirestore.
 */
class F43C1LocalHardeningTest {

    // ---- helpers ----------------------------------------------------------------------------

    private val future = System.currentTimeMillis() + 12L * 3600_000L
    private fun session(uid: String, token: String, exp: Long = future, status: String = "ativo") =
        SecureSession(uid, token, "sid-$uid", exp, AuthUser(id = uid, name = uid, role = "designer", status = status))

    /** SessionManager com o bridge alinhado a sessao (gate resolve Ok sem re-cunhar), timeout injetavel. */
    private fun manager(
        vault: FakeVault,
        api: FakeAuthApi,
        revoker: FakeFcmRevoker,
        bridge: FakeFirebaseBridge = FakeFirebaseBridge(current = vault.current?.uid, signInUid = vault.current?.uid),
        timeoutMs: Long = 3000L,
    ): SessionManager {
        val repo = ServerAuthRepository(api)
        val gate = FirebaseSessionGate(repo, bridge)
        return SessionManager(vault, repo, SessionBootstrapper(vault, repo), gate, revoker, timeoutMs)
    }

    /** Executor CENTRALIZADO de Firestore (Correcao 3/4). `now` real; sessoes usam `future` (validas). */
    private fun executor(vault: FakeVault, api: FakeAuthApi, bridge: FakeFirebaseBridge): AuthenticatedFirestoreExecutor {
        val repo = ServerAuthRepository(api)
        val gate = FirebaseSessionGate(repo, bridge)
        return AuthenticatedFirestoreExecutor(vault, gate, bridge)
    }

    private fun revoker(fcm: String = "fcm-abc", device: String = "dev-1") = FakeFcmRevoker(fcm to device)

    // ==================== LOGOUT E FCM (1..10) ====================

    // 1. logout REVOGA o token FCM ANTES da limpeza. Prova de ordem: removeMyFcmToken so consegue ver
    //    a sessao (Bearer == token do cofre) se ainda NAO foi limpa — Success => revoke-antes-de-clear.
    @Test
    fun t01_logout_revogaFcmAntesDaLimpeza() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val rev = revoker()
        val r = manager(vault, api, rev).logout()
        assertEquals(LogoutFcmResult.Success, r)          // revogou (com sessao viva)
        assertEquals(1, api.removeFcmCalls)               // chamou removeMyFcmToken exatamente 1x
        assertEquals("tok", api.lastRemoveSessionToken)   // com o Bearer da sessao => antes do clear
        assertNull(vault.current)                         // e a limpeza ocorreu depois
    }

    // 2. envia o token FCM e o deviceId CORRETOS (os do cache local do aparelho).
    @Test
    fun t02_logout_enviaTokenFcmEDeviceIdCorretos() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        manager(vault, api, FakeFcmRevoker("fcm-XYZ" to "device-42")).logout()
        assertEquals("fcm-XYZ", api.lastRemoveFcmToken)
        assertEquals("device-42", api.lastRemoveDeviceId)
    }

    // 3. NAO envia uid controlado pelo cliente: a identidade e o Bearer da sessao (uid derivado NO
    //    SERVIDOR). O contrato postRemoveFcm(token,fcmToken,deviceId,platform) nao possui campo uid;
    //    platform e fixo "android".
    @Test
    fun t03_logout_naoEnviaUidDoCliente_apenasBearerEPlatform() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        manager(vault, api, revoker()).logout()
        assertEquals("tok", api.lastRemoveSessionToken)   // identidade = Bearer da sessao
        assertEquals("android", api.lastRemovePlatform)   // sem canal de uid do cliente
    }

    // 4. SUCESSO na revogacao remove a sessao integralmente e volta ao login.
    @Test
    fun t04_logout_sucessoRemoveSessao() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val mgr = manager(vault, FakeAuthApi(FakeAuthApi.http(500)), revoker())
        assertEquals(LogoutFcmResult.Success, mgr.logout())
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
        assertTrue(vault.lastDeleteKey)
    }

    // 5. FALHA DE REDE na revogacao AINDA encerra o logout local (sessao limpa mesmo assim).
    @Test
    fun t05_logout_falhaDeRedeAindaEncerra() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setRemoveFcm(FakeAuthApi.transport(br.com.idseven.agenda.data.auth.AuthApi.Transport.NO_NETWORK))
        val mgr = manager(vault, api, revoker())
        assertEquals(LogoutFcmResult.NetworkFailure, mgr.logout())
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)  // NAO travou
        assertNull(vault.current)
    }

    // 6. 401 (sessao ja expirada no servidor) mapeia para Unauthorized, mas AINDA encerra o logout.
    @Test
    fun t06_logout_unauthorizedAindaEncerra() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setRemoveFcm(FakeAuthApi.http(401, JSONObject().put("ok", false)))
        val mgr = manager(vault, api, revoker())
        assertEquals(LogoutFcmResult.Unauthorized, mgr.logout())
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
    }

    // 7. TIMEOUT CURTO: se a revogacao demora mais que o teto, NAO trava o logout (NetworkFailure) e a
    //    sessao e limpa. Prova o withTimeoutOrNull com teto injetavel.
    @Test
    fun t07_logout_timeoutCurtoNaoTrava() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.removeDelayMs = 500L                                  // servidor "demora" 500ms
        val mgr = manager(vault, api, revoker(), timeoutMs = 50L) // teto CURTO de 50ms
        assertEquals(LogoutFcmResult.NetworkFailure, mgr.logout())
        assertEquals(1, api.removeFcmCalls)                       // tentou
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)   // mas nao travou
        assertNull(vault.current)
    }

    // 8. resposta INESPERADA do servidor (4xx != 401) mapeia para ServerFailure, mas AINDA encerra o
    //    logout. (Contrato: 5xx e transporte => Unavailable => NetworkFailure; 4xx/malformado =>
    //    Failure => ServerFailure — espelha registerFcmToken.)
    @Test
    fun t08_logout_serverFailureAindaEncerra() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setRemoveFcm(FakeAuthApi.http(400, JSONObject().put("ok", false)))
        val mgr = manager(vault, api, revoker())
        assertEquals(LogoutFcmResult.ServerFailure, mgr.logout())
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
    }

    // 9. SEM cache FCM local (nada a revogar): InvalidLocalState, NAO chama o endpoint, e AINDA encerra
    //    o logout (nao trava por ausencia de token local).
    @Test
    fun t09_logout_semCacheFcm_naoChamaEndpoint() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val mgr = manager(vault, api, FakeFcmRevoker(fcm = null))  // cache ausente
        assertEquals(LogoutFcmResult.InvalidLocalState, mgr.logout())
        assertEquals(0, api.removeFcmCalls)                        // nunca chamou removeMyFcmToken
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
        assertNull(vault.current)
    }

    // 10. logout SEMPRE faz Firebase signOut + limpa o cache local do FCM, MESMO com revogacao falha.
    @Test
    fun t10_logout_signOutEClearLocalMesmoComFalha() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setRemoveFcm(FakeAuthApi.http(503, JSONObject().put("ok", false)))  // revogacao falha
        val bridge = FakeFirebaseBridge(current = "U1")
        val rev = revoker()
        manager(vault, api, rev, bridge).logout()
        assertTrue(bridge.signOuts >= 1)   // identidade Firebase encerrada
        assertEquals(1, rev.clears)        // cache local do FCM apagado
    }

    // ==================== REGISTRO (11..16) ====================

    // 11. register NAO escreve em /users: retorna RegistrationUnavailable (sem Firestore, sem side-effect).
    @Test
    fun t11_register_naoEscreveEmUsers() = runBlocking {
        val r = AuthRepo.register("Ana", "designer", "11999999999", "ana@idseven.com", "senha123")
        assertTrue(r is AuthRepo.Result.RegistrationUnavailable)
    }

    // 12. register e DETERMINISTICO: nunca retorna Ok (nao ha caminho que crie usuario/simule sucesso).
    @Test
    fun t12_register_nuncaRetornaOk() = runBlocking {
        val r = AuthRepo.register("Qualquer", "coordenacao", "0", "x@y.z", "p")
        assertFalse(r is AuthRepo.Result.Ok)
    }

    // 13. register NAO confia em role/admin/status vindos do cliente: mesmo com "admin" forjado no
    //     input, o desfecho e o mesmo estado neutro (nenhuma escalada de privilegio possivel no cliente).
    @Test
    fun t13_register_ignoraRoleAdminForjados() = runBlocking {
        val comum = AuthRepo.register("A", "designer", "1", "a@a.a", "s")
        val forjado = AuthRepo.register("A", "admin", "1", "a@a.a", "s")
        assertTrue(comum is AuthRepo.Result.RegistrationUnavailable)
        assertTrue(forjado is AuthRepo.Result.RegistrationUnavailable)
        assertEquals(comum::class, forjado::class)   // desfecho identico, sem canal de privilegio
    }

    // 14. register nao produz erro de REDE (nao toca transporte): e um estado neutro, nao um Err transitorio.
    @Test
    fun t14_register_naoEhErroDeRede() = runBlocking {
        val r = AuthRepo.register("A", "designer", "1", "a@a.a", "s")
        assertFalse(r is AuthRepo.Result.Err)
        assertTrue(r is AuthRepo.Result.RegistrationUnavailable)
    }

    // 15. register e robusto a entradas vazias (nao lanca, nao cria nada): ainda RegistrationUnavailable.
    @Test
    fun t15_register_entradasVaziasSemCrash() = runBlocking {
        val r = AuthRepo.register("", "", "", "", "")
        assertTrue(r is AuthRepo.Result.RegistrationUnavailable)
    }

    // 16. o desfecho e um objeto SEM dados dinamicos: RegistrationUnavailable e um estado singleton
    //     (mesma instancia sempre) — nao carrega PII/uid/mensagem crua.
    @Test
    fun t16_register_desfechoSingletonSemDados() = runBlocking {
        val a = AuthRepo.register("A", "designer", "1", "a@a.a", "s")
        val b = AuthRepo.register("B", "coordenacao", "2", "b@b.b", "t")
        assertTrue(a === AuthRepo.Result.RegistrationUnavailable)  // data object => instancia unica
        assertTrue(a === b)
    }

    // ==================== SESSION GATE (17..25) ====================
    // (Estados negados retornam ANTES de qualquer FirebaseFirestore.getInstance() — seguro em JVM.)

    // 17. SEM sessao: SessionMissing e o bloco Firestore NUNCA executa (Denied, sem fallback nao-auth).
    @Test
    fun t17_gate_semSessao_sessionMissing_naoAcessaFirestore() = runBlocking {
        val exec = executor(FakeVault(), FakeAuthApi(FakeAuthApi.http(500)), FakeFirebaseBridge())
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.SessionMissing)
        var ran = false
        val out = exec.withAuthenticatedFirestore { _, _ -> ran = true }
        assertTrue(out is AuthenticatedFirestoreExecutor.Outcome.Denied)
        assertFalse("bloco Firestore nao pode rodar sem sessao", ran)
    }

    // 18. sessao EXPIRADA localmente: SessionExpired e o bloco nao executa.
    @Test
    fun t18_gate_sessaoExpirada_sessionExpired() = runBlocking {
        val past = System.currentTimeMillis() - 10_000L
        val vault = FakeVault(session("U1", "tok", exp = past))
        val exec = executor(vault, FakeAuthApi(FakeAuthApi.http(500)), FakeFirebaseBridge(current = "U1"))
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.SessionExpired)
        var ran = false
        exec.withAuthenticatedFirestore { _, _ -> ran = true }
        assertFalse(ran)
    }

    // 19. sessao valida + SDK ja com o uid correto: Authenticated SEM re-cunhar (issue nao chamado).
    @Test
    fun t19_gate_valida_sdkComUid_authenticated() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val exec = executor(vault, api, FakeFirebaseBridge(current = "U1"))
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.Authenticated)
        assertEquals(0, api.firebaseCalls)   // SDK ja tinha o usuario => sem issue
    }

    // 20. sessao valida + SDK nulo: re-cunha via issue, faz signIn com uid == sessao => Authenticated.
    @Test
    fun t20_gate_recunha_authenticated() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "U1")
        val exec = executor(vault, api, bridge)
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.Authenticated)
        assertEquals(1, api.firebaseCalls)
        assertEquals(1, bridge.signInCalls)
    }

    // 21. UID DIVERGENTE (Firebase assina outro uid): UidMismatch e o bloco nao executa.
    @Test
    fun t21_gate_uidDivergente_uidMismatch() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "INTRUSO")
        val exec = executor(vault, api, bridge)
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.UidMismatch)
        var ran = false
        exec.withAuthenticatedFirestore { _, _ -> ran = true }
        assertFalse(ran)
    }

    // 22. DEFESA EM PROFUNDIDADE: mesmo com o gate == Ok, se o uid do SDK diverge da sessao NA
    //     revalidacao do executor, o resultado e UidMismatch (nunca libera Firestore).
    @Test
    fun t22_gate_defesaEmProfundidade_uidMismatch() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        // bridge que devolve o uid correto na 1a leitura (gate => Ok) e um uid diferente na 2a
        // leitura (revalidacao do executor) — simula corrida/troca de identidade do SDK.
        val flip = object : FirebaseBridge {
            var calls = 0
            override suspend fun signInWithCustomToken(customToken: String): String = "U1"
            override fun currentUid(): String? { calls++; return if (calls == 1) "U1" else "OUTRO" }
            override fun signOut() {}
        }
        val repo = ServerAuthRepository(FakeAuthApi(FakeAuthApi.http(500)))
        val exec = AuthenticatedFirestoreExecutor(vault, FirebaseSessionGate(repo, flip), flip)
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.UidMismatch)
    }

    // 23. FALHA DE REDE no issue: NetworkFailure (transitorio) — Denied, sem Firestore.
    @Test
    fun t23_gate_redeFora_networkFailure() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.transport(br.com.idseven.agenda.data.auth.AuthApi.Transport.NO_NETWORK))
        val exec = executor(vault, api, FakeFirebaseBridge(current = null, signInUid = "U1"))
        val st = exec.resolve()
        assertTrue(st is AuthenticatedFirestoreExecutor.GateState.NetworkFailure)
        assertEquals(AuthError.NO_NETWORK, (st as AuthenticatedFirestoreExecutor.GateState.NetworkFailure).error)
    }

    // 24. FALHA DO FIREBASE (SDK rejeita o custom token): FirebaseAuthFailure — Denied, sem Firestore.
    @Test
    fun t24_gate_firebaseFalha_firebaseAuthFailure() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val bridge = FakeFirebaseBridge(current = null, signInUid = "U1", throwOnSignIn = true)
        val exec = executor(vault, api, bridge)
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.FirebaseAuthFailure)
        var ran = false
        val out = exec.withAuthenticatedFirestore { _, _ -> ran = true }
        assertTrue(out is AuthenticatedFirestoreExecutor.Outcome.Denied)
        assertFalse(ran)
    }

    // 25. usuario INATIVO no issue (403): fail-closed => SessionExpired (forca re-login), sem Firestore.
    @Test
    fun t25_gate_inativo403_sessionExpired_failClosed() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setFirebase(FakeAuthApi.http(403, JSONObject().put("ok", false)))
        val exec = executor(vault, api, FakeFirebaseBridge(current = null, signInUid = "U1"))
        assertTrue(exec.resolve() is AuthenticatedFirestoreExecutor.GateState.SessionExpired)
    }

    // ==================== LOGS (26..30) ====================
    // Prova de sanitizacao ao NIVEL DE TIPO: os valores que chegam ao Log (LogoutFcmResult em
    // AppRoot; GateState em ReminderAlarmActivity) sao categorias FECHADAS, sem token/uid/Bearer.
    // (A captura fisica de linhas de log fica nos testes instrumentados.)

    private val secretMarkers = listOf("tok", "fcm-", "Bearer", "U1", "device", "@")

    // 26. LogoutFcmResult (logado em AppRoot como fcmRevoke=$r) nunca imprime segredo: cada categoria
    //     renderiza so o proprio nome.
    @Test
    fun t26_log_logoutResultSemSegredo() {
        LogoutFcmResult.values().forEach { v ->
            val s = v.toString()
            assertEquals(v.name, s)
            secretMarkers.forEach { m -> assertFalse("LogoutFcmResult vazou '$m'", s.contains(m)) }
        }
    }

    // 27. GateState (logado em ReminderAlarmActivity como gate=$state) nunca imprime uid/token; o unico
    //     estado com payload (NetworkFailure) carrega SO o AuthError (enum), nao PII.
    @Test
    fun t27_log_gateStateSemUidNemToken() {
        val states = listOf(
            AuthenticatedFirestoreExecutor.GateState.SessionMissing,
            AuthenticatedFirestoreExecutor.GateState.SessionExpired,
            AuthenticatedFirestoreExecutor.GateState.FirebaseAuthFailure,
            AuthenticatedFirestoreExecutor.GateState.UidMismatch,
            AuthenticatedFirestoreExecutor.GateState.NetworkFailure(AuthError.NO_NETWORK),
        )
        states.forEach { st ->
            val s = st.toString()
            listOf("tok", "fcm-", "Bearer", "U1").forEach { m ->
                assertFalse("GateState vazou '$m'", s.contains(m))
            }
        }
        // NetworkFailure expoe apenas a categoria do erro (enum), nunca o corpo/PII.
        assertTrue(
            AuthenticatedFirestoreExecutor.GateState.NetworkFailure(AuthError.NO_NETWORK).toString().contains("NO_NETWORK"),
        )
    }

    // 28. o SEGREDO fica no transporte, o LOG fica na categoria: apos revogar, o Bearer foi visto pela
    //     API (transporte), mas o valor RETORNADO/LOGADO e apenas "Success" (sem token).
    @Test
    fun t28_log_segredoNoTransporte_categoriaNoLog() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val r = manager(vault, api, revoker()).logout()
        assertEquals("tok", api.lastRemoveSessionToken)   // segredo confinado ao transporte
        assertEquals("Success", r.toString())             // o que vai ao log e so a categoria
    }

    // 29. mensagem de cadastro indisponivel nao carrega dado dinamico: RegistrationUnavailable e um
    //     objeto sem campos (toString == nome do tipo). A copy neutra vive como constante fixa na UI.
    @Test
    fun t29_log_registrationUnavailableSemDados() {
        assertEquals("RegistrationUnavailable", AuthRepo.Result.RegistrationUnavailable.toString())
    }

    // 30. o conjunto de categorias sanitizadas e FECHADO e ESTAVEL (guarda contra uma futura variante
    //     que carregasse PII): exatamente estes 5 nomes.
    @Test
    fun t30_log_categoriasFechadasEEstaveis() {
        assertEquals(
            setOf("Success", "NetworkFailure", "Unauthorized", "ServerFailure", "InvalidLocalState"),
            LogoutFcmResult.values().map { it.name }.toSet(),
        )
    }

    // ==================== SESSAO (31..35) ====================

    // 31. logout limpa o cofre pedindo a REMOCAO DA CHAVE do Keystore (deleteKey=true), 1x.
    @Test
    fun t31_sessao_limpaCofreComDeleteKey() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        manager(vault, FakeAuthApi(FakeAuthApi.http(500)), revoker()).logout()
        assertEquals(1, vault.clears)
        assertTrue(vault.lastDeleteKey)
    }

    // 32. logout apaga o CACHE LOCAL do FCM (fcmRevoker.clearLocal), 1x.
    @Test
    fun t32_sessao_apagaCacheLocalFcm() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val rev = revoker()
        manager(vault, FakeAuthApi(FakeAuthApi.http(500)), rev).logout()
        assertEquals(1, rev.clears)
    }

    // 33. logout leva o estado unico a LoggedOut (fonte da verdade do AppRoot => backstack/telas zeradas).
    @Test
    fun t33_sessao_estadoLoggedOut() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val mgr = manager(vault, FakeAuthApi(FakeAuthApi.http(500)), revoker())
        mgr.logout()
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)
    }

    // 34. logout encerra a identidade Firebase (signOut).
    @Test
    fun t34_sessao_firebaseSignOut() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val bridge = FakeFirebaseBridge(current = "U1")
        manager(vault, FakeAuthApi(FakeAuthApi.http(500)), revoker(), bridge).logout()
        assertTrue(bridge.signOuts >= 1)
    }

    // 35. IDEMPOTENCIA da limpeza: mesmo com a revogacao FALHANDO (5xx => NetworkFailure, transitorio),
    //     a limpeza integral acontece igual ao sucesso (cofre + chave + cache + estado + signOut).
    @Test
    fun t35_sessao_limpezaIntegralMesmoComRevogacaoFalha() = runBlocking {
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setRemoveFcm(FakeAuthApi.http(500, JSONObject().put("ok", false)))
        val bridge = FakeFirebaseBridge(current = "U1")
        val rev = revoker()
        val mgr = manager(vault, api, rev, bridge)
        assertEquals(LogoutFcmResult.NetworkFailure, mgr.logout())
        assertNull(vault.current)                                  // cofre limpo
        assertTrue(vault.lastDeleteKey)                            // chave removida
        assertEquals(1, rev.clears)                                // cache FCM limpo
        assertTrue(mgr.state.value is SessionUiState.LoggedOut)    // estado zerado
        assertTrue(bridge.signOuts >= 1)                           // Firebase deslogado
        assertNotNull(mgr.state.value)
    }
}
