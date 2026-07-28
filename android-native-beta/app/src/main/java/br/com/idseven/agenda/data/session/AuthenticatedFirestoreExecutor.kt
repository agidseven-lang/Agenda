package br.com.idseven.agenda.data.session

import android.content.Context
import br.com.idseven.agenda.data.auth.AuthError
import br.com.idseven.agenda.data.auth.FirebaseBridge
import br.com.idseven.agenda.data.auth.RealFirebaseBridge
import br.com.idseven.agenda.data.auth.ServerAuthRepository
import com.google.firebase.firestore.FirebaseFirestore

/**
 * F4.3C1 (Correcao 3 + 4) — Executor CENTRALIZADO de acesso ao Firestore SOMENTE apos a identidade
 * Firebase estabelecida (FirebaseSessionGate.ensure() == Ok E uid do SDK == uid da sessao).
 *
 * FAIL-CLOSED: QUALQUER estado != Authenticated NAO executa a operacao Firestore — NUNCA ha fallback
 * nao-autenticado (request.auth == null). Destinado aos acessos comprovadamente FORA do gate nesta
 * fase (ex.: ReminderAlarmActivity). NAO reescreve os repositorios ja gated (Event/Task/Chat/Users),
 * que rodam dentro do MainScaffold, ou seja, DEPOIS do gate no fluxo normal.
 */
class AuthenticatedFirestoreExecutor(
    private val store: SessionVault,
    private val gate: FirebaseSessionGate,
    private val bridge: FirebaseBridge,
    private val now: () -> Long = { System.currentTimeMillis() },
) {
    /** Estados possiveis do gate (exatamente os exigidos pela F4.3C1). */
    sealed class GateState {
        data object Authenticated : GateState()
        data object SessionMissing : GateState()
        data object SessionExpired : GateState()
        data object FirebaseAuthFailure : GateState()
        data object UidMismatch : GateState()
        data class NetworkFailure(val error: AuthError) : GateState()
    }

    /** Resultado do acesso: Ok(valor) SOMENTE quando Authenticated; senao Denied(estado), sem Firestore. */
    sealed class Outcome<out T> {
        data class Ok<T>(val value: T) : Outcome<T>()
        data class Denied(val state: GateState) : Outcome<Nothing>()
    }

    /** Resolve o estado do gate SEM executar Firestore. Visivel a testes. */
    suspend fun resolve(): GateState {
        val session = store.load() ?: return GateState.SessionMissing
        if (!session.isLocallyValid(now())) return GateState.SessionExpired
        return when (val g = gate.ensure(session)) {
            FirebaseSessionGate.Result.Ok ->
                // Defesa extra: o uid do SDK precisa casar com a sessao antes de liberar Firestore.
                if (bridge.currentUid() == session.uid) GateState.Authenticated else GateState.UidMismatch
            FirebaseSessionGate.Result.Expired -> GateState.SessionExpired
            FirebaseSessionGate.Result.Disabled -> GateState.SessionExpired   // inativo => re-login (fail-closed)
            FirebaseSessionGate.Result.UidMismatch -> GateState.UidMismatch
            is FirebaseSessionGate.Result.Unavailable -> when (g.error) {
                AuthError.NO_NETWORK, AuthError.TIMEOUT -> GateState.NetworkFailure(g.error)
                else -> GateState.FirebaseAuthFailure
            }
        }
    }

    /**
     * Executa `block(db, uid)` SOMENTE se o estado for Authenticated; caso contrario devolve
     * Denied(estado) e NAO toca o Firestore. NUNCA faz fallback nao-autenticado.
     */
    suspend fun <T> withAuthenticatedFirestore(block: suspend (FirebaseFirestore, String) -> T): Outcome<T> {
        val state = resolve()
        if (state !is GateState.Authenticated) return Outcome.Denied(state)
        val uid = store.load()?.uid ?: return Outcome.Denied(GateState.SessionMissing)
        return Outcome.Ok(block(FirebaseFirestore.getInstance(), uid))
    }

    companion object {
        /** Fabrica real (Keystore + endpoints + FirebaseAuth oficial). */
        fun create(context: Context): AuthenticatedFirestoreExecutor {
            val store = SecureSessionStore(context.applicationContext)
            val bridge = RealFirebaseBridge()
            val gate = FirebaseSessionGate(ServerAuthRepository(), bridge)
            return AuthenticatedFirestoreExecutor(store, gate, bridge)
        }
    }
}
