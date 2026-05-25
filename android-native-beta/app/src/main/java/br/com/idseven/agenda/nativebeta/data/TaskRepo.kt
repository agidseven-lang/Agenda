package br.com.idseven.agenda.nativebeta.data

import br.com.idseven.agenda.nativebeta.domain.ChecklistItem
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import kotlin.coroutines.resume
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine

// Gerenciador de tarefas em tempo real (coleção tasks do PWA).
object TaskRepo {
    private val db get() = FirebaseFirestore.getInstance()

    @Suppress("UNCHECKED_CAST")
    private fun map(d: DocumentSnapshot): TaskItem {
        val rawList = d.get("checklist") as? List<Map<String, Any?>> ?: emptyList()
        val checklist = rawList.map { ChecklistItem(t = (it["t"] as? String) ?: "", d = (it["d"] as? Boolean) ?: false) }
        return TaskItem(
            id = d.id,
            title = d.getString("title"),
            client = d.getString("client"),
            sector = d.getString("sector"),
            desc = d.getString("desc"),
            status = d.getString("status"),
            assignee = d.getString("assignee"),
            priority = d.getBoolean("priority") ?: false,
            dueDate = d.getString("dueDate"),
            dueTime = d.getString("dueTime"),
            by = d.getString("by"),
            createdAt = d.getLong("createdAt"),
            checklist = checklist,
        )
    }

    fun tasks(): Flow<List<TaskItem>> = callbackFlow {
        val reg = db.collection("tasks").addSnapshotListener { snap, e ->
            if (e != null) { trySend(emptyList()); return@addSnapshotListener }
            trySend(snap?.documents?.map { map(it) } ?: emptyList())
        }
        awaitClose { reg.remove() }
    }

    suspend fun updateStatus(id: String, status: String): Result<Unit> = suspendCancellableCoroutine { cont ->
        db.collection("tasks").document(id).update(mapOf("status" to status))
            .addOnSuccessListener { cont.resume(Result.success(Unit)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }
}
