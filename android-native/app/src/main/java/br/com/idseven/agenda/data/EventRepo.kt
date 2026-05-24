package br.com.idseven.agenda.data

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

// Compromisso lido da MESMA coleção/schema do PWA (events).
data class EventItem(
    val id: String,
    val type: String?,
    val title: String?,
    val client: String?,
    val date: String?,
    val start: String?,
    val end: String?,
    val owner: String?,
    val ownerId: String?,
    val done: Boolean,
    val startedAt: Long?
) {
    fun statusLabel(): String = when {
        done -> "finalizado"
        startedAt != null && startedAt > 0 -> "em andamento"
        else -> "agendado"
    }
}

// Acesso aos compromissos no Firestore (coleção `events`), compatível com o PWA.
object EventRepo {
    private val db get() = FirebaseFirestore.getInstance()

    fun listen(
        onData: (List<EventItem>) -> Unit,
        onError: (String) -> Unit
    ): ListenerRegistration {
        return db.collection("events").addSnapshotListener { snap, e ->
            if (e != null) {
                onError("Erro ao carregar agenda: ${e.message ?: "tente novamente"}")
                return@addSnapshotListener
            }
            val list = snap?.documents?.map { d ->
                EventItem(
                    id = d.id,
                    type = d.getString("type"),
                    title = d.getString("title"),
                    client = d.getString("client"),
                    date = d.getString("date"),
                    start = d.getString("start"),
                    end = d.getString("end"),
                    owner = d.getString("owner"),
                    ownerId = d.getString("ownerId"),
                    done = d.getBoolean("done") ?: false,
                    startedAt = d.getLong("startedAt")
                )
            } ?: emptyList()
            // ordena por data + hora (igual ao web)
            onData(list.sortedWith(compareBy({ it.date ?: "" }, { it.start ?: "" })))
        }
    }

    fun create(
        data: Map<String, Any?>,
        onOk: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        db.collection("events").add(data)
            .addOnSuccessListener { ref -> onOk(ref.id) }
            .addOnFailureListener { ex ->
                onError("Erro ao salvar compromisso: ${ex.message ?: "tente novamente"}")
            }
    }
}
