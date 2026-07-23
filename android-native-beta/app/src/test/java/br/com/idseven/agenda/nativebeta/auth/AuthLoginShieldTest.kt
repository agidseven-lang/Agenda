package br.com.idseven.agenda.nativebeta.auth

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * F4.2B — GATE DE BLINDAGEM (source-scan): falha se o caminho de LOGIN voltar a acessar users,
 * verificar senha no aparelho, ou ler hash/salt; e prova que o token nunca vaza (log/Intent/deep
 * link). Cobre 14,15,24,25,26,30 e reforca 12. Se qualquer padrao proibido reaparecer no login,
 * este teste falha o build.
 */
class AuthLoginShieldTest {

    private fun locate(rel: String): String {
        // Working dir do testDebugUnitTest = modulo (android-native-beta/app). SRC resolve por "."; o
        // doc (android-native-beta/docs) resolve por ".." (pai do modulo).
        val bases = listOf(".", "..", "../..", "app", "android-native-beta/app", "android-native-beta", "../app")
        for (b in bases) {
            val f = File(b, rel)
            if (f.exists()) return f.readText()
        }
        error("arquivo nao encontrado no classpath de teste: $rel (cwd=${File(".").absolutePath})")
    }

    private val SRC = "src/main/java/br/com/idseven/agenda/nativebeta"

    // Arquivos do CAMINHO DE LOGIN ativo (nao pode tocar users/Crypto/hash/salt).
    private val loginPath by lazy {
        listOf(
            "$SRC/data/auth/ServerAuthRepository.kt",
            "$SRC/data/auth/AuthApiClient.kt",
            "$SRC/data/auth/AuthApi.kt",
            "$SRC/data/auth/AuthContract.kt",
            "$SRC/data/auth/AuthErrorMapper.kt",
            "$SRC/data/session/SessionManager.kt",
            "$SRC/data/session/SessionBootstrapper.kt",
            "$SRC/features/auth/LoginViewModel.kt",
        ).associateWith { locate(it) }
    }

    // 24. nenhuma leitura de users no login.
    @Test
    fun t24_semUsersNoLogin() {
        loginPath.forEach { (name, body) ->
            assertFalse("$name nao pode acessar a colecao users", body.contains("collection(\"users\")"))
        }
    }

    // 25. nenhum Crypto.verify (nem Crypto.) no login.
    @Test
    fun t25_semCryptoVerifyNoLogin() {
        loginPath.forEach { (name, body) ->
            assertFalse("$name nao pode chamar Crypto.verify", body.contains("Crypto.verify"))
            assertFalse("$name nao pode referenciar Crypto no login", body.contains("Crypto."))
        }
    }

    // 26. hash/salt ausentes do fluxo de login.
    @Test
    fun t26_semHashSaltNoLogin() {
        loginPath.forEach { (name, body) ->
            assertFalse("$name nao pode ler passwordHash", body.contains("passwordHash"))
            assertFalse("$name nao pode ler campo pass", body.contains("getString(\"pass\")"))
            assertFalse("$name nao pode ler campo salt", body.contains("getString(\"salt\")"))
        }
    }

    // 14. token nunca vai a log: as classes de auth/sessao nao usam android.util.Log.
    @Test
    fun t14_semLogDeToken() {
        val sensitive = listOf(
            "$SRC/data/auth/ServerAuthRepository.kt",
            "$SRC/data/auth/AuthApiClient.kt",
            "$SRC/data/session/SessionManager.kt",
            "$SRC/data/session/SecureSessionStore.kt",
            "$SRC/data/session/SessionCipher.kt",
        ).associateWith { locate(it) }
        sensitive.forEach { (name, body) ->
            assertFalse("$name nao pode logar (evita vazar token)", body.contains("android.util.Log"))
            assertFalse("$name nao pode chamar Log.", Regex("(^|[^A-Za-z])Log\\.").containsMatchIn(body))
        }
    }

    // 15. token nunca vai a Intent/deep link: as classes de auth/sessao nao montam Intent/putExtra/Uri.
    @Test
    fun t15_semTokenEmIntentOuDeepLink() {
        loginPath.plus(
            listOf("$SRC/data/session/SecureSessionStore.kt", "$SRC/data/session/SessionCipher.kt").associateWith { locate(it) },
        ).forEach { (name, body) ->
            assertFalse("$name nao pode usar Intent (evita token em Intent)", body.contains("Intent("))
            assertFalse("$name nao pode putExtra (evita token em Intent)", body.contains("putExtra"))
            assertFalse("$name nao pode montar deep link com dados", body.contains("Uri.parse"))
        }
    }

    // reforca: ServerAuthRepository usa os endpoints REAIS via BuildConfig (loginUser/getUserSelf).
    @Test
    fun tEndpoints_usaBuildConfigReal() {
        val repo = loginPath.entries.first { it.key.endsWith("ServerAuthRepository.kt") }.value
        assertTrue(repo.contains("BuildConfig.AUTH_LOGIN_URL"))
        assertTrue(repo.contains("BuildConfig.AUTH_SELF_URL"))
        val client = loginPath.entries.first { it.key.endsWith("AuthApiClient.kt") }.value
        assertTrue("HTTPS obrigatorio (fail-closed)", client.contains("startsWith(\"https://\")"))
    }

    // 30. estado do Firestore documentado como bloqueio (request.auth nulo + NO-GO ate F4.2C).
    @Test
    fun t30_firestoreDocumentadoComoBloqueio() {
        val doc = locate("docs/F4.2B-FIRESTORE-STATUS.md")
        assertTrue(doc.contains("request.auth"))
        assertTrue(doc.contains("NO-GO"))
        assertTrue(doc.contains("F4.2C"))
    }
}
