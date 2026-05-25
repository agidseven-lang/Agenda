package br.com.idseven.agenda.nativebeta.domain

// Modelos de domínio — espelham EXATAMENTE o schema do PWA (sem campo inventado).

data class EventItem(
    val id: String,
    val type: String?,
    val title: String?,
    val client: String?,
    val location: String?,
    val notes: String?,
    val date: String?,      // "YYYY-MM-DD"
    val start: String?,     // "HH:MM"
    val end: String?,       // "HH:MM"
    val owner: String?,
    val ownerId: String?,
    val by: String?,
    val done: Boolean,
    val startedAt: Long?,
    val startedBy: String?,
    val doneAt: Long?,
    val doneBy: String?,
)

data class UserLite(
    val id: String,
    val name: String?,
    val role: String?,
    val color: String?,
    val photo: String?,
    val status: String?,
    val admin: Boolean,
) {
    fun isActive(): Boolean = status != "pendente" && status != "removido" && status != "excluido"
}

data class TaskItem(
    val id: String,
    val title: String?,
    val client: String?,
    val sector: String?,
    val desc: String?,
    val status: String?,        // afazer | andamento | concluido
    val assignee: String?,
    val priority: Boolean,
    val dueDate: String?,       // "YYYY-MM-DD"
    val dueTime: String?,       // "HH:MM"
    val by: String?,
    val createdAt: Long?,
    val checklist: List<ChecklistItem>,
)

data class ChecklistItem(val t: String, val d: Boolean)
