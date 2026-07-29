package br.com.idseven.agenda.data

import android.content.Context
import br.com.idseven.agenda.data.session.AuthenticatedFirestoreExecutor
import br.com.idseven.agenda.domain.UserLite
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * F4.3C4B — Diretório da equipe em tempo real via a projeção PÚBLICA `usersPublic`
 * (substitui o listener na coleção privada `users`, agora FECHADA nas Rules vivas).
 *
 * SESSION GATE OBRIGATÓRIO: o listener SÓ é armado após FirebaseSessionGate.ensure() == Ok E
 * FirebaseAuth.currentUser.uid == session.uid (via AuthenticatedFirestoreExecutor.resolve()).
 * Mesmo com o ruleset vivo permitindo leitura anônima de usersPublic, o Android NÃO depende de
 * acesso anônimo — compatível com as futuras Rules-alvo (request.auth obrigatório).
 *
 * FAIL-CLOSED: gate negado => o flow FALHA (UiList.Error na UI) SEM armar listener algum.
 * NUNCA há fallback para a coleção `users`, tentativa silenciosa, modo legado ou consulta anônima.
 * Logs SÓ com categorias fechadas (GateState/código de erro) — nunca payload/PII.
 */
class UsersPublicRepo(
    private val resolveGate: suspend () -> AuthenticatedFirestoreExecutor.GateState,
    private val firestore: () -> FirebaseFirestore = { FirebaseFirestore.getInstance() },
) {
    fun users(): Flow<List<UserLite>> = callbackFlow {
        val gate = resolveGate()
        if (gate !is AuthenticatedFirestoreExecutor.GateState.Authenticated) {
            android.util.Log.w("UsersPublicRepo", "[DIRECTORY_GATE_DENIED] gate=$gate — fail-closed, sem listener, sem fallback")
            close(SecurityException("Sessão não verificada — diretório indisponível"))
            return@callbackFlow
        }
        val reg = firestore().collection("usersPublic").addSnapshotListener { snap, e ->
            if (e != null) {
                // Categoria fechada apenas (code); nunca corpo/mensagem com dados.
                android.util.Log.w("UsersPublicRepo", "[DIRECTORY_LISTENER_ERROR] code=${e.code}")
                close(e); return@addSnapshotListener
            }
            val list = snap?.documents?.mapNotNull { d ->
                UserPublicMapper.fromDoc(d)?.let { UserPublicMapper.toUserLite(it) }
            } ?: emptyList()
            android.util.Log.d("UsersPublicRepo", "[DIRECTORY_SNAPSHOT] size=${list.size}")
            trySend(list)
        }
        awaitClose { reg.remove() }
    }

    companion object {
        /** Fábrica real: gate = AuthenticatedFirestoreExecutor oficial (Keystore + FirebaseAuth). */
        fun create(context: Context): UsersPublicRepo {
            val executor = AuthenticatedFirestoreExecutor.create(context.applicationContext)
            return UsersPublicRepo(resolveGate = { executor.resolve() })
        }
    }
}
