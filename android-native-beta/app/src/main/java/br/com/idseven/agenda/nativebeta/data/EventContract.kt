package br.com.idseven.agenda.nativebeta.data

// Contrato de escrita de EVENTS — fiel ao PWA, fonte única (sem schema paralelo).
// Base (create + update): type, client, title, location, date, start, end, owner, ownerId, notes.
// Create adiciona: by, done=false, createdAt (epoch ms). Patches: start/finish/reopen.
object EventContract {

    data class Input(
        val type: String,
        val client: String,
        val title: String,
        val location: String,
        val date: String,     // "YYYY-MM-DD"
        val start: String,    // "HH:MM"
        val end: String,      // "HH:MM"
        val owner: String,
        val ownerId: String?,
        val notes: String,
    )

    fun base(i: Input): LinkedHashMap<String, Any?> = linkedMapOf(
        "type" to i.type,
        "client" to i.client,
        "title" to i.title,
        "location" to i.location,
        "date" to i.date,
        "start" to i.start,
        "end" to i.end,
        "owner" to i.owner,
        "ownerId" to i.ownerId,
        "notes" to i.notes,
    )

    fun create(i: Input, byUid: String?, nowMs: Long): Map<String, Any?> =
        base(i).apply {
            put("by", byUid)
            put("done", false)
            put("createdAt", nowMs)
            put("src", "nativebeta")
        }

    // F3.3.73I6C3 — edição: grava conteúdo + updatedAt/updatedBy (paridade contrato 73I6C1).
    // NÃO toca by/createdAt/src/done/startedAt (preservados). Dispara onEventUpdated ("editou").
    fun editPatch(i: Input, uid: String?, nowMs: Long): LinkedHashMap<String, Any?> =
        base(i).apply { put("updatedAt", nowMs); put("updatedBy", uid) }

    // F3.3.73I6C3 — cancelamento LÓGICO (status:"cancelled"). Sai da agenda ativa; sem delete físico.
    fun cancelPatch(uid: String?, nowMs: Long): Map<String, Any?> =
        mapOf("status" to "cancelled", "cancelledAt" to nowMs, "cancelledBy" to uid)

    // F3.3.73I6C3A — EXCLUSÃO DEFINITIVA: grava deletedBy/deletedAt ANTES do delete físico
    // (EventRepo.remove) para o gatilho onEventDeleted (73I6C3A) atribuir o ator na notificação.
    // Distinto de cancelPatch: aqui o documento será REMOVIDO de events logo em seguida.
    fun deletePatch(uid: String?, nowMs: Long): Map<String, Any?> =
        mapOf("deletedBy" to uid, "deletedAt" to nowMs)

    fun startPatch(uid: String?, nowMs: Long): Map<String, Any?> =
        mapOf("startedAt" to nowMs, "startedBy" to uid)

    fun finishPatch(uid: String?, nowMs: Long): Map<String, Any?> =
        mapOf("done" to true, "doneAt" to nowMs, "doneBy" to uid)

    fun reopenPatch(): Map<String, Any?> =
        mapOf("done" to false, "doneAt" to null, "doneBy" to null)
}
