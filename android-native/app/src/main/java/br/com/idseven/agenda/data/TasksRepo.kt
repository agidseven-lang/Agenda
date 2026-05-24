package br.com.idseven.agenda.data

import android.graphics.Color
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

data class TaskItem(
    val id: String,
    val title: String?,
    val client: String?,
    val assignee: String?,
    val status: String?,      // afazer | andamento | concluido
    val sector: String?,
    val dueDate: String?,
    val dueTime: String?,
    val due: String?,
    val startedAt: Long?,
    val prio: Boolean,
    val createdAt: Long?
) {
    fun dueMs(): Long? = when {
        !dueDate.isNullOrBlank() -> EventStatus.dtMs(dueDate, dueTime ?: "23:59")
        !due.isNullOrBlank() -> EventStatus.dtMs(due, "23:59")
        else -> null
    }
    fun isLate(): Boolean { val d = dueMs() ?: return false; return System.currentTimeMillis() > d && status != "concluido" }
}

object Sectors {
    data class S(val label: String, val color: Int)
    private val MAP = mapOf(
        "edicao_midia" to S("Edição de Mídia", Color.parseColor("#ef4444")),
        "design" to S("Cronograma", Color.parseColor("#a78bfa")),
        "copy" to S("Copywriter", Color.parseColor("#60a5fa")),
        "roteiro" to S("Roteiro", Color.parseColor("#9ca3af")),
        "postagem" to S("Programação de posts", Color.parseColor("#34d399"))
    )
    fun of(key: String?): S = MAP[key] ?: S("Outro", Color.parseColor("#9ca3af"))
}

object TasksRepo {
    private val db get() = FirebaseFirestore.getInstance()

    fun listen(onData: (List<TaskItem>) -> Unit): ListenerRegistration {
        return db.collection("tasks").addSnapshotListener { snap, e ->
            if (e != null) { onData(emptyList()); return@addSnapshotListener }
            onData(snap?.documents?.map { d ->
                TaskItem(
                    id = d.id,
                    title = d.getString("title"),
                    client = d.getString("client"),
                    assignee = d.getString("assignee"),
                    status = d.getString("status"),
                    sector = d.getString("sector"),
                    dueDate = d.getString("dueDate"),
                    dueTime = d.getString("dueTime"),
                    due = d.getString("due"),
                    startedAt = d.getLong("startedAt"),
                    prio = d.getBoolean("prio") ?: false,
                    createdAt = d.getLong("createdAt")
                )
            } ?: emptyList())
        }
    }

    fun start(id: String, onErr: (String) -> Unit) {
        db.collection("tasks").document(id)
            .update(mapOf("status" to "andamento", "startedAt" to System.currentTimeMillis()))
            .addOnFailureListener { onErr(it.message ?: "erro") }
    }

    fun done(id: String, onErr: (String) -> Unit) {
        db.collection("tasks").document(id)
            .update(mapOf("status" to "concluido", "doneAt" to System.currentTimeMillis()))
            .addOnFailureListener { onErr(it.message ?: "erro") }
    }
}
