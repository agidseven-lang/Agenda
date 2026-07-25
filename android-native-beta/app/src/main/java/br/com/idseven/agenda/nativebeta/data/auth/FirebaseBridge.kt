package br.com.idseven.agenda.nativebeta.data.auth

import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * F4.2C — Fina fronteira sobre o FirebaseAuth OFICIAL. Concentra a UNICA referencia a
 * `com.google.firebase.auth` no caminho de sessao, de modo que SessionManager/FirebaseSessionGate
 * permanecam TESTAVEIS sem o SDK (fake injetado nos testes JVM) e os arquivos BLINDADOS do login
 * (ServerAuthRepository/AuthApiClient/SessionManager/SessionBootstrapper) fiquem livres do SDK.
 *
 * O SDK oficial administra a renovacao do ID Token (auto-refresh). Aqui SO:
 *  - assinamos com o Custom Token (efemero, SOMENTE em memoria — nunca salvo/logado);
 *  - lemos o uid do FirebaseUser corrente (restaurado pelo SDK apos reabertura);
 *  - deslogamos (idempotente).
 * NENHUM token/credencial e persistido, logado, colocado em Intent, deep link ou notificacao.
 */
interface FirebaseBridge {
    /**
     * Assina no Firebase com o Custom Token e devolve o uid Firebase resultante. Lanca em falha.
     * Roda fora da main thread (a implementacao real bloqueia em Dispatchers.IO).
     */
    suspend fun signInWithCustomToken(customToken: String): String

    /** uid do FirebaseUser atual (restaurado pelo SDK apos reabertura), ou null. */
    fun currentUid(): String?

    /** Desloga o FirebaseAuth (idempotente; nunca lanca). */
    fun signOut()
}

/**
 * Implementacao real sobre FirebaseAuth.getInstance(). Instanciada SOMENTE em producao
 * (SessionManager.create); os testes injetam um fake e nunca tocam o SDK.
 */
class RealFirebaseBridge(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : FirebaseBridge {

    override suspend fun signInWithCustomToken(customToken: String): String = withContext(Dispatchers.IO) {
        val result = Tasks.await(auth.signInWithCustomToken(customToken))
        result.user?.uid
            ?: auth.currentUser?.uid
            ?: throw IllegalStateException("firebase_no_user")
    }

    override fun currentUid(): String? = auth.currentUser?.uid

    override fun signOut() {
        try { auth.signOut() } catch (_: Throwable) { /* idempotente */ }
    }
}
