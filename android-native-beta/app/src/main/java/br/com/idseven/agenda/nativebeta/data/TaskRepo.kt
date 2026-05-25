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
            link = d.getString("link"),
            priority = d.getBoolean("priority") ?: false,
            startDate = d.getString("startDate"),
            startTime = d.getString("startTime"),
            dueDate = d.getString("dueDate"),
            dueTime = d.getString("dueTime"),
            by = d.getString("by"),
            createdAt = d.getLong("createdAt"),
            startedAt = d.getLong("startedAt"),
            doneAt = d.getLong("doneAt"),
            doneBy = d.getString("doneBy"),
            checklist = checklist,
        )
    }

    fun tasks(): Flow<List<TaskItem>> = callbackFlow {
        val reg = db.collection("tasks").addSnapshotListener { snap, e ->
            if (e != null) {
                android.util.Log.w("TaskRepo", "tasks listener erro: ${e.message}", e)
                close(e); return@addSnapshotListener
            }
            val docs = snap?.documents ?: emptyList()
            android.util.Log.d("TaskRepo", "tasks lidas do Firestore: ${docs.size}")
            trySend(docs.map { map(it) })
        }
        awaitClose { reg.remove() }
    }

    fun task(id: String): Flow<TaskItem?> = callbackFlow {
        val reg = db.collection("tasks").document(id).addSnapshotListener { d, _ ->
            trySend(if (d != null && d.exists()) map(d) else null)
        }
        awaitClose { reg.remove() }
    }

    suspend fun create(data: Map<String, Any?>): Result<String> = suspendCancellableCoroutine { cont ->
        db.collection("tasks").add(data)
            .addOnSuccessListener { cont.resume(Result.success(it.id)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    suspend fun update(id: String, data: Map<String, Any?>): Result<Unit> = suspendCancellableCoroutine { cont ->
        db.collection("tasks").document(id).update(data)
            .addOnSuccessListener { cont.resume(Result.success(Unit)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    suspend fun delete(id: String): Result<Unit> = suspendCancellableCoroutine { cont ->
        db.collection("tasks").document(id).delete()
            .addOnSuccessListener { cont.resume(Result.success(Unit)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    suspend fun move(task: TaskItem, newStatus: String, uid: String?) =
        update(task.id, TaskContract.statusPatch(newStatus, uid, task, System.currentTimeMillis()))

    suspend fun setChecklist(id: String, items: List<ChecklistItem>) =
        update(id, TaskContract.checklistPatch(items))
}
