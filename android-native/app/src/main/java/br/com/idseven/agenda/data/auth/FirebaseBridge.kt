package br.com.idseven.agenda.data.auth

import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth

// F4.2C: fina fronteira sobre o FirebaseAuth oficial, para que o AuthManager seja testavel
// sem o SDK. O SDK oficial administra a renovacao do ID Token (auto-refresh); aqui so
// assinamos com o Custom Token (em memoria), lemos o uid atual e deslogamos.

interface FirebaseBridge {
    /** Assina com o Custom Token (BLOQUEANTE, roda no executor do AuthManager).
     *  Retorna o uid Firebase resultante. Lanca em falha. */
    fun signInWithCustomToken(customToken: String): String

    /** uid do FirebaseUser atual (restaurado pelo SDK apos reabertura), ou null. */
    fun currentUid(): String?

    fun signOut()
}

class RealFirebaseBridge(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) : FirebaseBridge {

    override fun signInWithCustomToken(customToken: String): String {
        val result = Tasks.await(auth.signInWithCustomToken(customToken))
        return result.user?.uid
            ?: auth.currentUser?.uid
            ?: throw IllegalStateException("firebase_no_user")
    }

    override fun currentUid(): String? = auth.currentUser?.uid

    override fun signOut() {
        try { auth.signOut() } catch (_: Throwable) { /* idempotente */ }
    }
}
