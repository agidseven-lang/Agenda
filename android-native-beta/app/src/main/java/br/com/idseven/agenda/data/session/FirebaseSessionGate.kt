package br.com.idseven.agenda.data.session

import br.com.idseven.agenda.data.auth.AuthError
import br.com.idseven.agenda.data.auth.FirebaseBridge
import br.com.idseven.agenda.data.auth.FirebaseTokenOutcome
import br.com.idseven.agenda.data.auth.ServerAuthRepository

/**
 * F4.2C — Ponte entre a sessao server-side (F4.2B) e a identidade Firebase.
 *
 * Fluxo canonico (sobre o contrato REAL da Desktop/backend):
 *   sessao valida → issueFirebaseAuthToken(Bearer) → signInWithCustomToken → valida uid Firebase.
 *
 * INVARIANTES:
 *  - o uid do Custom Token vem SEMPRE da sessao no servidor (nunca do corpo/cliente);
 *  - divergencia de uid (Firebase != sessao) = bloqueio total de seguranca (UidMismatch);
 *  - o Custom Token vive SOMENTE em memoria (nunca salvo/logado — confinado ao FirebaseBridge);
 *  - se o SDK ja restaurou o MESMO uid, NAO re-cunha (evita chamada desnecessaria);
 *  - esta classe NAO mexe no cofre (SecureSessionStore): quem decide limpar a sessao e o caller
 *    (login novo e ATOMICO e limpa em qualquer falha; restore TOLERA rede e preserva a sessao).
 */
class FirebaseSessionGate(
    private val repo: ServerAuthRepository,
    private val bridge: FirebaseBridge,
) {
    /** Resultado de estabelecer a identidade Firebase para uma sessao. */
    sealed class Result {
        data object Ok : Result()                                  // FirebaseUser com uid == sessao
        data object Expired : Result()                             // 401 no issue → sessao vencida
        data object Disabled : Result()                            // 403 no issue → usuario inativo
        data object UidMismatch : Result()                         // uid Firebase != uid sessao (seguranca)
        data class Unavailable(val error: AuthError) : Result()    // rede/timeout/5xx/dormant/SDK — transitorio
    }

    /**
     * Garante um FirebaseUser com uid == session.uid, re-cunhando via issueFirebaseAuthToken quando
     * necessario. NAO limpa a sessao — devolve o status para o caller decidir. Faz signOut do
     * Firebase quando a identidade nao pode ser estabelecida (mismatch/falha do SDK).
     */
    suspend fun ensure(session: SecureSession): Result {
        if (bridge.currentUid() == session.uid) return Result.Ok  // SDK ja tinha o usuario correto

        return when (val issued = repo.issueFirebaseAuthToken(session.token)) {
            is FirebaseTokenOutcome.Success -> {
                val firebaseUid = try {
                    bridge.signInWithCustomToken(issued.customToken)  // custom token SO em memoria
                } catch (_: Throwable) {
                    bridge.signOut()
                    return Result.Unavailable(AuthError.UNAVAILABLE)
                }
                if (firebaseUid == session.uid) Result.Ok
                else { bridge.signOut(); Result.UidMismatch }
            }
            FirebaseTokenOutcome.Expired -> Result.Expired
            is FirebaseTokenOutcome.Blocked -> Result.Disabled
            is FirebaseTokenOutcome.Unavailable -> Result.Unavailable(issued.error)
            is FirebaseTokenOutcome.Failure -> Result.Unavailable(issued.error)  // malformado = transitorio (nao derruba)
        }
    }

    /** Desloga o Firebase (idempotente). Chamado no logout e no wipe do login novo. */
    fun signOut() = bridge.signOut()
}
