package br.com.idseven.agenda.nativebeta.data

import br.com.idseven.agenda.nativebeta.domain.EventItem
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import kotlin.coroutines.resume
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine

// Agenda em tempo real (coleção events do PWA). Leituras via listener; escritas suspensas.
object EventRepo {
    private val db get() = FirebaseFirestore.getInstance()

    private fun map(d: DocumentSnapshot): EventItem = EventItem(
        id = d.id,
        type = d.getString("type"),
        title = d.getString("title"),
        client = d.getString("client"),
        location = d.getString("location"),
        notes = d.getString("notes"),
        date = d.getString("date"),
        start = d.getString("start"),
        end = d.getString("end"),
        owner = d.getString("owner"),
        ownerId = d.getString("ownerId"),
        by = d.getString("by"),
        done = d.getBoolean("done") ?: false,
        startedAt = d.getLong("startedAt"),
        startedBy = d.getString("startedBy"),
        doneAt = d.getLong("doneAt"),
        doneBy = d.getString("doneBy"),
        status = d.getString("status"),
        cancelledAt = d.getLong("cancelledAt"),
        cancelledBy = d.getString("cancelledBy"),
    )

    fun events(): Flow<List<EventItem>> = callbackFlow {
        val reg = db.collection("events").addSnapshotListener { snap, e ->
            if (e != null) {
                android.util.Log.w("EventRepo", "events listener erro: ${e.message}", e)
                close(e); return@addSnapshotListener
            }
            val docs = snap?.documents ?: emptyList()
            android.util.Log.d("EventRepo", "events lidos do Firestore: ${docs.size}")
            trySend(docs.map { map(it) })
        }
        awaitClose { reg.remove() }
    }

    fun event(id: String): Flow<EventItem?> = callbackFlow {
        val reg = db.collection("events").document(id).addSnapshotListener { d, _ ->
            trySend(if (d != null && d.exists()) map(d) else null)
        }
        awaitClose { reg.remove() }
    }

    suspend fun create(data: Map<String, Any?>): Result<String> = suspendCancellableCoroutine { cont ->
        db.collection("events").add(data)
            .addOnSuccessListener { cont.resume(Result.success(it.id)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    suspend fun update(id: String, data: Map<String, Any?>): Result<Unit> = suspendCancellableCoroutine { cont ->
        db.collection("events").document(id).update(data)
            .addOnSuccessListener { cont.resume(Result.success(Unit)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    // F3.3.73I6C3 — exclusão LÓGICA (cancelamento). NUNCA apaga o documento (sem .delete()):
    // grava status:"cancelled" + cancelledAt/cancelledBy; o onEventUpdated (73I6C1) dispara o
    // fan-out "cancelou" e a Agenda ativa filtra cancelados. Histórico preservado no Firestore.
    suspend fun cancel(id: String, uid: String?) = update(id, EventContract.cancelPatch(uid, System.currentTimeMillis()))
    suspend fun start(id: String, uid: String?) = update(id, EventContract.startPatch(uid, System.currentTimeMillis()))
    suspend fun finish(id: String, uid: String?) = update(id, EventContract.finishPatch(uid, System.currentTimeMillis()))
    suspend fun reopen(id: String) = update(id, EventContract.reopenPatch())

    // F3.3.73I6C3A — EXCLUSÃO DEFINITIVA (hard delete), distinta do cancelamento lógico:
    // 1) grava deletedBy/deletedAt (deletePatch) ANTES do delete físico, para o onEventDeleted
    //    (73I6C3A) atribuir o ATOR na notificação de exclusão; 2) REMOVE o documento de events.
    // Só é chamado após confirmação FORTE na UI (admin + digitar "EXCLUIR"). Cancelar NÃO usa isto.
    suspend fun remove(id: String, uid: String?): Result<Unit> {
        update(id, EventContract.deletePatch(uid, System.currentTimeMillis()))
        return suspendCancellableCoroutine { cont ->
            db.collection("events").document(id).delete()
                .addOnSuccessListener { cont.resume(Result.success(Unit)) }
                .addOnFailureListener { cont.resume(Result.failure(it)) }
        }
    }
}
