package br.com.idseven.agenda.domain

// Modelos de chat — fiéis ao schema do PWA (coleção chats + subcoleção messages).
data class Chat(
    val id: String,
    val participants: List<String>,
    val createdAt: Long?,
    val lastText: String?,
    val lastAt: Long?,
    val lastBy: String?,
    val unreadCount: Map<String, Long>,
    val isGroup: Boolean,
) {
    fun otherId(meId: String): String? = participants.firstOrNull { it != meId }
    fun unreadFor(meId: String): Long = unreadCount[meId] ?: 0L
}

data class Message(
    val id: String,
    val text: String,
    val by: String?,
    val at: Long?,
    val readBy: Map<String, Long>,
)
