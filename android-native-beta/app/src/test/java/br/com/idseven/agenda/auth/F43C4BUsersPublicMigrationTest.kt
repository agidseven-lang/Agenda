package br.com.idseven.agenda.auth

import br.com.idseven.agenda.data.AuthRepo
import br.com.idseven.agenda.data.UserPublicMapper
import br.com.idseven.agenda.data.UsersPublicRepo
import br.com.idseven.agenda.data.auth.AuthUser
import br.com.idseven.agenda.data.auth.ContactOutcome
import br.com.idseven.agenda.data.auth.ServerAuthRepository
import br.com.idseven.agenda.data.session.AuthenticatedFirestoreExecutor
import br.com.idseven.agenda.data.session.SecureSession
import br.com.idseven.agenda.domain.UserPublic
import java.io.File
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.3C4B — 30 testes OBRIGATORIOS da migracao users -> usersPublic (ordem da autorizacao):
 *  1-6   gate estatico: NENHUM codigo de producao le/escreve a colecao privada `users`;
 *  7-9   destinos corretos: diretorio=usersPublic, usuario atual=getUserSelf, contato=getUserContact;
 *  10-14 o usersPublic CONSUMIDO PELO ANDROID nao contem pass/salt/fcmTokens/sessionVersion/admin
 *        (modelo UserPublic sem esses campos; mapper ignora as chaves mesmo presentes no doc —
 *        obs.: o doc de producao carrega `admin` informativo, que o Android NAO consome);
 *  15-18 mapper total-safe + filtro de inativos;
 *  19-23 Session Gate fail-closed (sem fallback para `users`, sem acesso anonimo);
 *  24-26 preservacao F4.3C1 (register bloqueado, logout/FCM, ReminderAlarmActivity gated);
 *  27-28 logs sem dados privados/resposta completa;
 *  29-30 navegacao estavel + troca de usuario sem residuo no repositorio.
 */
class F43C4BUsersPublicMigrationTest {

    // ---- helpers de fonte (mesmo padrao do AuthLoginShieldTest) -------------------------------

    private fun locate(rel: String): String {
        val bases = listOf(".", "..", "../..", "app", "android-native-beta/app", "android-native-beta", "../app")
        for (b in bases) {
            val f = File(b, rel)
            if (f.exists()) return f.readText()
        }
        error("arquivo nao encontrado no classpath de teste: $rel (cwd=${File(".").absolutePath})")
    }

    private fun mainRoot(): File {
        val bases = listOf(".", "..", "../..", "app", "android-native-beta/app", "../app")
        for (b in bases) {
            val f = File(b, "src/main/java/br/com/idseven/agenda")
            if (f.isDirectory) return f
        }
        error("src/main nao encontrado (cwd=${File(".").absolutePath})")
    }

    /** Remove comentarios (bloco e linha) para varrer SOMENTE codigo. */
    private fun codeOnly(src: String): String {
        val noBlock = src.replace(Regex("/\\*.*?\\*/", RegexOption.DOT_MATCHES_ALL), " ")
        return noBlock.lines().joinToString("\n") { line ->
            val idx = line.indexOf("//")
            if (idx >= 0) line.substring(0, idx) else line
        }
    }

    private val FORBIDDEN = listOf("collection(\"users\")", ".collection(\"users\")", "collection(\"users\"", "document(\"users/")

    private fun scanCategory(predicate: (File) -> Boolean): List<String> {
        val bad = mutableListOf<String>()
        mainRoot().walkTopDown().filter { it.isFile && it.extension == "kt" && predicate(it) }.forEach { f ->
            val code = codeOnly(f.readText())
            FORBIDDEN.forEach { pat -> if (code.contains(pat)) bad += "${f.name}:$pat" }
        }
        return bad
    }

    private val SRC = "src/main/java/br/com/idseven/agenda"

    private val future = System.currentTimeMillis() + 12L * 3600_000L
    private fun session(uid: String, token: String) =
        SecureSession(uid, token, "sid-$uid", future, AuthUser(id = uid, name = uid, role = "designer", status = "ativo"))

    /** Repo do diretorio com gate roteirizado; `firestore` explode se o gate for negado e ainda assim tocar o Firestore. */
    private fun repo(gate: AuthenticatedFirestoreExecutor.GateState, onResolve: (() -> Unit)? = null) =
        UsersPublicRepo(
            resolveGate = { onResolve?.invoke(); gate },
            firestore = { throw AssertionError("Firestore NAO deve ser tocado com gate=$gate") },
        )

    private fun assertGateDenies(gate: AuthenticatedFirestoreExecutor.GateState) = runBlocking {
        var failed: Throwable? = null
        var emitted = false
        repo(gate).users()
            .catch { failed = it }
            .collect { emitted = true }
        assertNotNull("gate=$gate deveria falhar o flow (fail-closed)", failed)
        assertTrue("falha deve ser SecurityException", failed is SecurityException)
        assertFalse("gate=$gate nao pode emitir dados", emitted)
    }

    // ==================== 1-6: GATE ESTATICO (codigo de producao sem `users`) ====================

    @Test
    fun t01_nenhumRepositoryUsaCollectionUsers() {
        val bad = scanCategory { it.path.replace('\\', '/').contains("/data/") }
        assertTrue("repositories com collection(\"users\"): $bad", bad.isEmpty())
    }

    @Test
    fun t02_nenhumaActivityUsaCollectionUsers() {
        val bad = scanCategory { it.name.contains("Activity") }
        assertTrue("Activities com collection(\"users\"): $bad", bad.isEmpty())
    }

    @Test
    fun t03_nenhumServiceUsaCollectionUsers() {
        val bad = scanCategory { it.name.contains("Service") }
        assertTrue("Services com collection(\"users\"): $bad", bad.isEmpty())
    }

    @Test
    fun t04_nenhumReceiverUsaCollectionUsers() {
        val bad = scanCategory { it.name.contains("Receiver") }
        assertTrue("Receivers com collection(\"users\"): $bad", bad.isEmpty())
    }

    @Test
    fun t05_nenhumaViewModelUsaCollectionUsers() {
        val bad = scanCategory { it.name.contains("ViewModel") }
        assertTrue("ViewModels com collection(\"users\"): $bad", bad.isEmpty())
    }

    @Test
    fun t06_nenhumaEscritaOuLeituraDiretaEmUsers_todoOMain() {
        // Varredura TOTAL de app/src/main (cobre leitura E escrita; qualquer arquivo Kotlin).
        val bad = scanCategory { true }
        assertTrue("codigo de producao com acesso a colecao `users`: $bad", bad.isEmpty())
    }

    // ==================== 7-9: DESTINOS CORRETOS ====================

    @Test
    fun t07_diretorioUsaUsersPublic() {
        val repoSrc = codeOnly(locate("$SRC/data/UsersPublicRepo.kt"))
        assertTrue("UsersPublicRepo deve ouvir usersPublic", repoSrc.contains("collection(\"usersPublic\")"))
        val vmSrc = codeOnly(locate("$SRC/core/HomeViewModel.kt"))
        assertTrue("HomeViewModel deve usar UsersPublicRepo", vmSrc.contains("UsersPublicRepo"))
        assertFalse("HomeViewModel nao pode citar UsersRepo antigo", vmSrc.contains("UsersRepo."))
    }

    @Test
    fun t08_usuarioAtualUsaGetUserSelf() {
        // admin/nome do PROPRIO usuario vem do perfil server-verificado (loginUser/getUserSelf ->
        // SecureSession.profile), plumbado por AppRoot -> UserSession -> MainScaffold.
        val appRoot = codeOnly(locate("$SRC/core/AppRoot.kt"))
        assertTrue("AppRoot deve propagar profile.admin (getUserSelf)", appRoot.contains("profile.admin"))
        val scaffold = codeOnly(locate("$SRC/core/MainScaffold.kt"))
        assertTrue("canManage deve vir da sessao server-verificada", scaffold.contains("canManage = session.admin"))
    }

    @Test
    fun t09_contatoIndividualUsaGetUserContact() = runBlocking {
        // Wire real: ServerAuthRepository.getUserContact -> postContact (Bearer + uid), allowlist {phone,email}.
        val api = FakeAuthApi(FakeAuthApi.http(500))
        api.setContact(
            FakeAuthApi.ok(
                JSONObject().put("ok", true).put("uid", "U1")
                    .put("contact", JSONObject().put("phone", "+55 11 90000-0000").put("email", "a@b.c")),
            ),
        )
        val out = ServerAuthRepository(api).getUserContact("tok", "U1")
        assertTrue(out is ContactOutcome.Success)
        assertEquals("a@b.c", (out as ContactOutcome.Success).email)
        assertEquals("tok", api.lastContactSessionToken)
        assertEquals("U1", api.lastContactUid)
        // E a tela usa o endpoint (nunca o Firestore) para contato do proprio usuario:
        val profile = codeOnly(locate("$SRC/features/profile/ProfileScreen.kt"))
        assertTrue("ProfileScreen deve usar getUserContact", profile.contains("getUserContact"))
    }

    // ==================== 10-14: usersPublic consumido pelo Android SEM campos privados ==========

    // Reflexao JAVA (sem depender do artefato kotlin-reflect): campos da data class UserPublic.
    private fun modelHasProperty(name: String): Boolean =
        UserPublic::class.java.declaredFields.any { it.name == name }

    private fun fullDocFields(extra: Map<String, Any?> = emptyMap()): (String) -> Any? {
        val base = mapOf<String, Any?>(
            "name" to "Ana", "role" to "Designer", "status" to "ativo",
            "photo" to "https://x/p.png", "color" to "#123456",
        ) + extra
        return { k -> base[k] }
    }

    @Test
    fun t10_usersPublicNaoContemPass() {
        assertFalse(modelHasProperty("pass"))
        val p = UserPublicMapper.fromFields("U1", fullDocFields(mapOf("pass" to "s2:HASH")))
        assertNotNull(p) // presenca de chave proibida no doc NAO vaza para o modelo (nem quebra)
    }

    @Test
    fun t11_usersPublicNaoContemSalt() {
        assertFalse(modelHasProperty("salt"))
        assertNotNull(UserPublicMapper.fromFields("U1", fullDocFields(mapOf("salt" to "S"))))
    }

    @Test
    fun t12_usersPublicNaoContemFcmTokens() {
        assertFalse(modelHasProperty("fcmTokens"))
        val p = UserPublicMapper.fromFields("U1", fullDocFields(mapOf("fcmTokens" to listOf("t1", "t2"))))
        assertNotNull(p)
        // E a ponte visual entrega lista VAZIA (nunca tokens):
        assertTrue(UserPublicMapper.toUserLite(p!!).fcmTokens.isEmpty())
    }

    @Test
    fun t13_usersPublicNaoContemSessionVersion() {
        assertFalse(modelHasProperty("sessionVersion"))
        assertNotNull(UserPublicMapper.fromFields("U1", fullDocFields(mapOf("sessionVersion" to 7))))
    }

    @Test
    fun t14_usersPublicNaoContemAdmin() {
        // O doc de producao carrega `admin` informativo; o MODELO Android nao o consome — admin do
        // proprio usuario vem SEMPRE do getUserSelf (t08). Aqui: propriedade ausente e mapper ignora.
        assertFalse(modelHasProperty("admin"))
        val p = UserPublicMapper.fromFields("U1", fullDocFields(mapOf("admin" to true)))
        assertNotNull(p)
        assertFalse("ponte visual nunca marca admin a partir do diretorio", UserPublicMapper.toUserLite(p!!).admin)
    }

    // ==================== 15-18: mapper total-safe + inativos ====================

    @Test
    fun t15_documentoPublicoValidoEhConvertido() {
        val p = UserPublicMapper.fromFields("U1", fullDocFields())
        assertNotNull(p)
        assertEquals("U1", p!!.id)
        assertEquals("Ana", p.name)
        assertEquals("Designer", p.role)
        assertEquals("ativo", p.status)
        assertEquals("https://x/p.png", p.photo)
        assertEquals("#123456", p.color)
        val lite = UserPublicMapper.toUserLite(p)
        assertEquals("Ana", lite.name)
        assertNull(lite.email); assertNull(lite.phone); assertNull(lite.createdAt)
    }

    @Test
    fun t16_campoOpcionalAusenteNaoCausaCrash() {
        val p = UserPublicMapper.fromFields("U1") { null }   // só o id
        assertNotNull(p)
        assertNull(p!!.name); assertNull(p.role); assertNull(p.status); assertNull(p.photo); assertNull(p.color)
        assertTrue("status ausente (doc legado) = ATIVO, como no PWA", p.isActive())
        val lite = UserPublicMapper.toUserLite(p)
        assertEquals("U1", lite.id)
    }

    @Test
    fun t17_documentoMalformadoFalhaDeModoSeguro() {
        // Tipos errados nos campos => campos viram null (as? String); nunca lança.
        val p = UserPublicMapper.fromFields("U1", fullDocFields(mapOf("name" to 123, "photo" to mapOf("x" to 1), "status" to 9.9)))
        assertNotNull(p)
        assertNull(p!!.name); assertNull(p.status)
        // id vazio => documento descartado (null), sem crash.
        assertNull(UserPublicMapper.fromFields("", fullDocFields()))
    }

    @Test
    fun t18_usuarioInativoNaoAparece() {
        listOf("pendente", "removido", "excluido").forEach { st ->
            assertFalse("status=$st deve ficar oculto", UserPublic("U", null, null, st, null, null).isActive())
        }
        assertTrue(UserPublic("U", null, null, "ativo", null, null).isActive())
        assertTrue("legado sem status = ativo", UserPublic("U", null, null, null, null, null).isActive())
        // E o diretorio (tela Equipe) aplica o filtro isActive():
        val team = codeOnly(locate("$SRC/features/team/TeamScreen.kt"))
        assertTrue("TeamScreen deve filtrar por isActive()", team.contains("isActive()"))
    }

    // ==================== 19-23: SESSION GATE fail-closed ====================

    @Test
    fun t19_sessionGateAusenteBloqueiaConsulta() = assertGateDenies(AuthenticatedFirestoreExecutor.GateState.SessionMissing)

    @Test
    fun t20_sessaoExpiradaBloqueiaConsulta() = assertGateDenies(AuthenticatedFirestoreExecutor.GateState.SessionExpired)

    @Test
    fun t21_firebaseAuthAusenteBloqueiaConsulta() = assertGateDenies(AuthenticatedFirestoreExecutor.GateState.FirebaseAuthFailure)

    @Test
    fun t22_uidMismatchBloqueiaConsulta() = assertGateDenies(AuthenticatedFirestoreExecutor.GateState.UidMismatch)

    @Test
    fun t23_usersPublicIndisponivelNaoAcionaFallbackParaUsers() {
        // Prova estrutural: o repo do diretorio conhece UMA UNICA colecao (usersPublic) e nenhum
        // caminho de fallback/anonimo/legado; indisponibilidade => flow falha (UiList.Error na UI).
        val src = codeOnly(locate("$SRC/data/UsersPublicRepo.kt"))
        FORBIDDEN.forEach { pat -> assertFalse("fallback proibido no repo: $pat", src.contains(pat)) }
        assertEquals("exatamente 1 literal de colecao", 1, Regex("collection\\(\"").findAll(src).count())
        assertTrue(src.contains("collection(\"usersPublic\")"))
        assertTrue("erro do listener fecha o flow (fail-closed)", src.contains("close(e)"))
    }

    // ==================== 24-26: preservacao F4.3C1 ====================

    @Test
    fun t24_authRepoRegisterContinuaBloqueado() = runBlocking {
        val r = AuthRepo.register("n", "r", "p", "e", "s")
        assertTrue(r is AuthRepo.Result.RegistrationUnavailable)
    }

    @Test
    fun t25_logoutFcmPermaneceFuncionando() = runBlocking {
        // Espelha F43C1 t01: revoga ANTES de limpar (Bearer visto pelo endpoint = cofre ainda vivo).
        val vault = FakeVault(session("U1", "tok"))
        val api = FakeAuthApi(FakeAuthApi.http(500))
        val bridge = FakeFirebaseBridge(current = "U1", signInUid = "U1")
        val repo = ServerAuthRepository(api)
        val gate = br.com.idseven.agenda.data.session.FirebaseSessionGate(repo, bridge)
        val mgr = br.com.idseven.agenda.data.session.SessionManager(
            vault, repo, br.com.idseven.agenda.data.session.SessionBootstrapper(vault, repo), gate, FakeFcmRevoker("fcm-abc" to "dev-1"), 3000L,
        )
        val out = mgr.logout()
        assertEquals(br.com.idseven.agenda.data.session.LogoutFcmResult.Success, out)
        assertEquals(1, api.removeFcmCalls)
        assertEquals("tok", api.lastRemoveSessionToken)
        assertNull(vault.current)
    }

    @Test
    fun t26_reminderAlarmActivityPermaneceProtegida() {
        val src = codeOnly(locate("$SRC/core/ReminderAlarmActivity.kt"))
        assertTrue("resolucao segue no executor gated", src.contains("withAuthenticatedFirestore"))
        assertTrue("leitura migrada para usersPublic", src.contains("collection(\"usersPublic\")"))
        FORBIDDEN.forEach { pat -> assertFalse("acesso a `users` proibido: $pat", src.contains(pat)) }
    }

    // ==================== 27-28: logs sem dados privados ====================

    @Test
    fun t27_dadosPrivadosNaoAparecemEmLogs() {
        // Repos/mapper do diretorio: nenhum log de email/phone/pass/salt/token; categorias fechadas.
        listOf("$SRC/data/UsersPublicRepo.kt", "$SRC/data/UserPublicMapper.kt").forEach { rel ->
            val code = codeOnly(locate(rel))
            listOf("email", "phone", "pass", "salt", "fcmTokens").forEach { term ->
                code.lines().filter { it.contains("Log.") }.forEach { line ->
                    assertFalse("log com termo privado '$term' em $rel: $line", line.contains(term))
                }
            }
        }
        // Classes de auth continuam SEM android.util.Log (mesma regra do AuthLoginShieldTest t14).
        listOf("$SRC/data/auth/ServerAuthRepository.kt", "$SRC/data/auth/AuthApiClient.kt").forEach { rel ->
            val code = codeOnly(locate(rel))
            assertFalse("android.util.Log proibido em $rel", code.contains("android.util.Log"))
        }
    }

    @Test
    fun t28_respostaCompletaNaoApareceEmLogs() {
        // Nenhum caminho novo loga corpo/JSON de resposta: sem Log de reply/body/JSONObject.
        listOf("$SRC/data/UsersPublicRepo.kt", "$SRC/features/profile/ProfileScreen.kt").forEach { rel ->
            val code = codeOnly(locate(rel))
            code.lines().filter { it.contains("Log.") }.forEach { line ->
                listOf("reply", "body", "JSONObject", "contact", "toString()").forEach { term ->
                    assertFalse("log de resposta completa em $rel: $line", line.contains(term))
                }
            }
        }
    }

    // ==================== 29-30: navegacao + troca de usuario ====================

    @Test
    fun t29_navegacaoPermaneceEstavel() {
        val scaffold = codeOnly(locate("$SRC/core/MainScaffold.kt"))
        listOf("\"hoje\"", "\"agenda\"", "\"tarefas\"", "\"equipe\"", "\"chat\"", "\"perfil\"").forEach { route ->
            assertTrue("rota $route deve continuar existindo", scaffold.contains(route))
        }
    }

    @Test
    fun t30_trocaDeUsuarioLimpaODiretorioAnterior() = runBlocking {
        // O repo do diretorio e SEM ESTADO: cada assinatura re-resolve o gate do zero; apos logout
        // (gate=SessionMissing) NENHUM dado do usuario anterior e emitido (fail-closed).
        var resolves = 0
        var failures = 0
        val r = repo(AuthenticatedFirestoreExecutor.GateState.SessionMissing, onResolve = { resolves++ })
        repeat(2) {
            var emitted = false
            r.users().catch { failures++ }.collect { emitted = true }
            assertFalse(emitted)
        }
        assertEquals("gate re-resolvido a CADA assinatura (sem cache/residuo)", 2, resolves)
        assertEquals(2, failures)
        // E a classe nao guarda estado mutavel algum:
        val src = codeOnly(locate("$SRC/data/UsersPublicRepo.kt"))
        assertFalse("repo do diretorio deve ser sem estado (sem var)", Regex("\\bvar\\s").containsMatchIn(src))
    }
}
