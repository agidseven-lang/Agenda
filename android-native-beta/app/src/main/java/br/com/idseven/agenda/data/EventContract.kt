package br.com.idseven.agenda.data

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

    fun startPatch(uid: String?, nowMs: Long): Map<String, Any?> =
        mapOf("startedAt" to nowMs, "startedBy" to uid)

    fun finishPatch(uid: String?, nowMs: Long): Map<String, Any?> =
        mapOf("done" to true, "doneAt" to nowMs, "doneBy" to uid)

    fun reopenPatch(): Map<String, Any?> =
        mapOf("done" to false, "doneAt" to null, "doneBy" to null)
}
