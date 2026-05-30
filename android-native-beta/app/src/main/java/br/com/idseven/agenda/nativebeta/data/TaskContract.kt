package br.com.idseven.agenda.nativebeta.data

import br.com.idseven.agenda.nativebeta.domain.ChecklistItem
import br.com.idseven.agenda.nativebeta.domain.TaskItem

// Contrato de escrita de TASKS — fiel ao PWA (campos base do gerenciador).
// Não inclui os fluxos avançados por setor (cronWeeks, roteiro, etc.) — base do gerenciador.
object TaskContract {

    data class Input(
        val client: String,
        val title: String,
        val sector: String,
        val desc: String,
        val assignee: String,
        val assigneeId: String?,
        val link: String,
        val dueDate: String,   // "YYYY-MM-DD" ou ""
        val dueTime: String,   // "HH:MM" ou ""
        val priority: Boolean,
        val status: String,    // afazer | andamento | concluido
        val checklist: List<ChecklistItem>,
    )

    private fun checklistMaps(items: List<ChecklistItem>): List<Map<String, Any?>> =
        items.map { mapOf("t" to it.t, "d" to it.d) }

    fun base(i: Input): LinkedHashMap<String, Any?> = linkedMapOf(
        "client" to i.client,
        "title" to i.title,
        "sector" to i.sector,
        "desc" to i.desc,
        "startDate" to "",
        "startTime" to "",
        "dueDate" to i.dueDate,
        "dueTime" to i.dueTime,
        "due" to i.dueDate,
        "assignee" to i.assignee,
        "assigneeId" to i.assigneeId,
        "link" to i.link,
        "status" to i.status,
        "priority" to i.priority,
        "checklist" to checklistMaps(i.checklist),
    )

    fun create(i: Input, byUid: String?, nowMs: Long): Map<String, Any?> =
        base(i).apply {
            put("by", byUid)
            put("createdAt", nowMs)
        }

    // Rastreio igual ao trackFields do PWA: startedAt ao sair de "afazer";
    // doneAt/doneBy ao concluir.
    fun statusPatch(newStatus: String, uid: String?, task: TaskItem, nowMs: Long): Map<String, Any?> {
        val m = hashMapOf<String, Any?>("status" to newStatus)
        if (newStatus != "afazer" && (task.startedAt == null || task.startedAt <= 0)) m["startedAt"] = nowMs
        if (newStatus == "concluido") { m["doneAt"] = nowMs; m["doneBy"] = uid }
        return m
    }

    fun checklistPatch(items: List<ChecklistItem>): Map<String, Any?> = mapOf("checklist" to checklistMaps(items))
}
