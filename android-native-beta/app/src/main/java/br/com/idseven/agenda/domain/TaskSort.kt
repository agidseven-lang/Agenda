package br.com.idseven.agenda.domain

// Ordenação das tarefas dentro de cada coluna do Kanban:
// recém-movidas para o status atual primeiro (usa history; com fallbacks).
object TaskSort {
    fun statusChangedAt(t: TaskItem): Long {
        val st = t.status ?: "afazer"
        val fromHistory = t.history.filter { it.to == st }.mapNotNull { it.at }.maxOrNull()
        if (fromHistory != null) return fromHistory
        val fallback = when (st) {
            "concluido" -> t.doneAt
            "andamento", "revisao" -> t.startedAt
            else -> null
        }
        return fallback ?: t.createdAt ?: 0L
    }

    fun order(list: List<TaskItem>): List<TaskItem> =
        list.sortedByDescending { statusChangedAt(it) }
}
