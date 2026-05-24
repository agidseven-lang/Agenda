package br.com.idseven.agenda.data

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

// Compromisso lido da MESMA coleção/schema do PWA (events).
data class EventItem(
    val id: String,
    val type: String?,
    val title: String?,
    val client: String?,
    val location: String?,
    val notes: String?,
    val date: String?,
    val start: String?,
    val end: String?,
    val owner: String?,
    val ownerId: String?,
    val by: String?,
    val done: Boolean,
    val startedAt: Long?,
    val doneAt: Long?
)

object EventRepo {
    private val db get() = FirebaseFirestore.getInstance()

    private fun map(d: com.google.firebase.firestore.DocumentSnapshot): EventItem = EventItem(
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
        doneAt = d.getLong("doneAt")
    )

    fun listen(onData: (List<EventItem>) -> Unit, onError: (String) -> Unit): ListenerRegistration {
        return db.collection("events").addSnapshotListener { snap, e ->
            if (e != null) { onError("Erro ao carregar agenda: ${e.message ?: "tente novamente"}"); return@addSnapshotListener }
            onData(snap?.documents?.map { map(it) } ?: emptyList())
        }
    }

    fun listenOne(id: String, onData: (EventItem?) -> Unit): ListenerRegistration {
        return db.collection("events").document(id).addSnapshotListener { d, _ ->
            onData(if (d != null && d.exists()) map(d) else null)
        }
    }

    fun create(data: Map<String, Any?>, onOk: (String) -> Unit, onError: (String) -> Unit) {
        db.collection("events").add(data)
            .addOnSuccessListener { ref -> onOk(ref.id) }
            .addOnFailureListener { ex -> onError("Erro ao salvar compromisso: ${ex.message ?: "tente novamente"}") }
    }

    fun update(id: String, data: Map<String, Any?>, onOk: () -> Unit, onError: (String) -> Unit) {
        db.collection("events").document(id).update(data)
            .addOnSuccessListener { onOk() }
            .addOnFailureListener { ex -> onError("Erro ao salvar: ${ex.message ?: "tente novamente"}") }
    }

    fun start(id: String, uid: String?, onOk: () -> Unit, onError: (String) -> Unit) =
        update(id, mapOf("startedAt" to System.currentTimeMillis(), "startedBy" to uid), onOk, onError)

    fun finish(id: String, uid: String?, onOk: () -> Unit, onError: (String) -> Unit) =
        update(id, mapOf("done" to true, "doneAt" to System.currentTimeMillis(), "doneBy" to uid), onOk, onError)

    fun reopen(id: String, onOk: () -> Unit, onError: (String) -> Unit) =
        update(id, mapOf("done" to false, "doneAt" to null, "doneBy" to null), onOk, onError)

    fun delete(id: String, onOk: () -> Unit, onError: (String) -> Unit) {
        db.collection("events").document(id).delete()
            .addOnSuccessListener { onOk() }
            .addOnFailureListener { ex -> onError("Erro ao excluir: ${ex.message ?: "tente novamente"}") }
    }
}
