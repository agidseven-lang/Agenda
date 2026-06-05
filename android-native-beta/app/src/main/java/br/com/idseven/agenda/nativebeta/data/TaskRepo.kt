package br.com.idseven.agenda.nativebeta.data

import br.com.idseven.agenda.nativebeta.domain.ChecklistItem
import br.com.idseven.agenda.nativebeta.domain.ClientReview
import br.com.idseven.agenda.nativebeta.domain.CronContent
import br.com.idseven.agenda.nativebeta.domain.TaskHistory
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlin.coroutines.resume
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine

// Gerenciador de tarefas em tempo real (coleção tasks do PWA).
object TaskRepo {
    private val db get() = FirebaseFirestore.getInstance()

    private fun bool(v: Any?): Boolean = when (v) {
        is Boolean -> v
        is Number -> v.toInt() != 0
        is String -> v.equals("true", true) || v == "1"
        else -> false
    }

    private fun map(d: DocumentSnapshot): TaskItem {
        val rawCl = d.get("checklist") as? List<*> ?: emptyList<Any?>()
        val checklist = rawCl.mapNotNull { item ->
            val m = item as? Map<*, *> ?: return@mapNotNull null
            ChecklistItem(t = (m["t"] as? String) ?: "", d = bool(m["d"]))
        }
        // Conteúdos do cronograma: aceita `cronContents` (atual) e o alias legado `contents`.
        val rawCron = (d.get("cronContents") as? List<*>) ?: (d.get("contents") as? List<*>) ?: emptyList<Any?>()
        val cronContents = rawCron.mapNotNull { item ->
            val m = item as? Map<*, *> ?: return@mapNotNull null
            CronContent(
                tema = m["tema"] as? String,
                legenda = m["legenda"] as? String,
                feedImageUrl = m["feedImageUrl"] as? String,
                storyImageUrl = m["storyImageUrl"] as? String,
            )
        }
        val rawHist = d.get("history") as? List<*> ?: emptyList<Any?>()
        val history = rawHist.mapNotNull { h ->
            val m = h as? Map<*, *> ?: return@mapNotNull null
            TaskHistory(
                kind = (m["kind"] as? String) ?: "",
                at = (m["at"] as? Number)?.toLong(),
                byId = m["byId"] as? String,
                from = m["from"] as? String,
                to = m["to"] as? String,
            )
        }
        return TaskItem(
            id = d.id,
            title = d.getString("title"),
            client = d.getString("client"),
            sector = d.getString("sector"),
            desc = d.getString("desc"),
            status = d.getString("status"),
            assignee = d.getString("assignee"),
            assigneeId = d.getString("assigneeId"),
            link = d.getString("link"),
            priority = bool(d.get("priority")),
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
            history = history,
            cronStatus = d.getString("cronStatus"),
            clientReview = (d.get("clientReview") as? Map<*, *>)?.let { cr ->
                val st = cr["status"] as? String
                if (st.isNullOrBlank()) null
                else ClientReview(
                    status = st,
                    note = cr["note"] as? String,
                    at = (cr["at"] as? Number)?.toLong(),
                    byName = cr["byName"] as? String,
                )
            },
            clientSentBy = d.getString("clientSentBy"),
            cronContents = cronContents,
            assignedDesignerId = (d.get("designerAssignment") as? Map<*, *>)?.get("designerId") as? String,
            assignedDesignerName = (d.get("designerAssignment") as? Map<*, *>)?.get("designerName") as? String,
            clientFlowStatus = d.getString("clientFlowStatus"),
            designerFlowStatus = d.getString("designerFlowStatus"),
            socialOwnerId = d.getString("socialOwnerId"),
            socialOwnerName = d.getString("socialOwnerName"),
            socialFlowStatus = d.getString("socialFlowStatus"),
            designerEndDate = (d.get("designerAssignment") as? Map<*, *>)?.get("endDate") as? String ?: d.getString("endDate"),
            designerEndTime = (d.get("designerAssignment") as? Map<*, *>)?.get("endTime") as? String ?: d.getString("endTime"),
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

    suspend fun move(task: TaskItem, newStatus: String, uid: String?): Result<Unit> {
        val now = System.currentTimeMillis()
        val patch = TaskContract.statusPatch(newStatus, uid, task, now).toMutableMap()
        patch["history"] = FieldValue.arrayUnion(
            mapOf("kind" to "moved", "at" to now, "byId" to uid, "from" to (task.status ?: "afazer"), "to" to newStatus)
        )
        return update(task.id, patch)
    }

    suspend fun setChecklist(id: String, items: List<ChecklistItem>) =
        update(id, TaskContract.checklistPatch(items))
}
