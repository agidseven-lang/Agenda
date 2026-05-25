package br.com.idseven.agenda.nativebeta.data

import br.com.idseven.agenda.nativebeta.domain.Chat
import br.com.idseven.agenda.nativebeta.domain.Message
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlin.coroutines.resume
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine

// Chat em tempo real — coleção chats + subcoleção messages. Schema idêntico ao PWA.
object ChatRepo {
    private val db get() = FirebaseFirestore.getInstance()

    fun dmChatId(a: String, b: String): String {
        val s = listOf(a, b).sorted()
        return "dm_${s[0]}_${s[1]}"
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapChat(d: DocumentSnapshot): Chat {
        val last = d.get("lastMessage") as? Map<String, Any?>
        val unreadRaw = d.get("unreadCount") as? Map<String, Any?> ?: emptyMap()
        val unread = unreadRaw.mapValues { (it.value as? Number)?.toLong() ?: 0L }
        return Chat(
            id = d.id,
            participants = (d.get("participants") as? List<String>) ?: emptyList(),
            createdAt = d.getLong("createdAt"),
            lastText = last?.get("text") as? String,
            lastAt = (last?.get("at") as? Number)?.toLong(),
            lastBy = last?.get("by") as? String,
            unreadCount = unread,
            isGroup = d.getBoolean("isGroup") ?: false,
        )
    }

    fun chats(uid: String): Flow<List<Chat>> = callbackFlow {
        val reg = db.collection("chats").whereArrayContains("participants", uid)
            .addSnapshotListener { snap, e ->
                if (e != null) { trySend(emptyList()); return@addSnapshotListener }
                val list = (snap?.documents?.map { mapChat(it) } ?: emptyList())
                    .sortedByDescending { it.lastAt ?: it.createdAt ?: 0L }
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    fun messages(chatId: String): Flow<List<Message>> = callbackFlow {
        val reg = db.collection("chats").document(chatId).collection("messages")
            .orderBy("at", Query.Direction.ASCENDING)
            .addSnapshotListener { snap, e ->
                if (e != null) { trySend(emptyList()); return@addSnapshotListener }
                @Suppress("UNCHECKED_CAST")
                val list = snap?.documents?.map { d ->
                    val rb = (d.get("readBy") as? Map<String, Any?> ?: emptyMap()).mapValues { (it.value as? Number)?.toLong() ?: 0L }
                    Message(id = d.id, text = d.getString("text") ?: "", by = d.getString("by"), at = d.getLong("at"), readBy = rb)
                } ?: emptyList()
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    suspend fun openOrCreate(meId: String, otherId: String): Result<String> = suspendCancellableCoroutine { cont ->
        val id = dmChatId(meId, otherId)
        val ref = db.collection("chats").document(id)
        ref.get().addOnSuccessListener { snap ->
            if (snap != null && snap.exists()) {
                cont.resume(Result.success(id))
            } else {
                val unread = mapOf(meId to 0L, otherId to 0L)
                ref.set(
                    mapOf(
                        "participants" to listOf(meId, otherId),
                        "createdAt" to System.currentTimeMillis(),
                        "lastMessage" to null,
                        "unreadCount" to unread,
                        "isGroup" to false,
                    )
                ).addOnSuccessListener { cont.resume(Result.success(id)) }
                    .addOnFailureListener { cont.resume(Result.failure(it)) }
            }
        }.addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    fun markRead(chatId: String, meId: String) {
        db.collection("chats").document(chatId).update("unreadCount.$meId", 0L)
    }

    private suspend fun addMessage(chatId: String, msg: Map<String, Any?>): Result<Unit> = suspendCancellableCoroutine { cont ->
        db.collection("chats").document(chatId).collection("messages").add(msg)
            .addOnSuccessListener { cont.resume(Result.success(Unit)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    private suspend fun getChat(chatId: String): Chat? = suspendCancellableCoroutine { cont ->
        db.collection("chats").document(chatId).get()
            .addOnSuccessListener { cont.resume(if (it != null && it.exists()) mapChat(it) else null) }
            .addOnFailureListener { cont.resume(null) }
    }

    private suspend fun updateChat(chatId: String, data: Map<String, Any?>): Result<Unit> = suspendCancellableCoroutine { cont ->
        db.collection("chats").document(chatId).update(data)
            .addOnSuccessListener { cont.resume(Result.success(Unit)) }
            .addOnFailureListener { cont.resume(Result.failure(it)) }
    }

    suspend fun send(chatId: String, meId: String, otherId: String?, raw: String): Result<Unit> {
        val text = raw.trim().let { if (it.length > 2000) it.substring(0, 2000) else it }
        if (text.isEmpty()) return Result.success(Unit)
        val now = System.currentTimeMillis()
        val msg = hashMapOf<String, Any?>("text" to text, "by" to meId, "at" to now, "readBy" to mapOf(meId to now))
        val add = addMessage(chatId, msg)
        if (add.isFailure) return add
        val unread = (getChat(chatId)?.unreadCount ?: emptyMap()).toMutableMap()
        if (otherId != null) unread[otherId] = (unread[otherId] ?: 0L) + 1
        unread[meId] = 0L
        return updateChat(chatId, mapOf("lastMessage" to mapOf("text" to text.take(200), "at" to now, "by" to meId), "unreadCount" to unread))
    }
}
