package br.com.idseven.agenda.nativebeta.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.EventStatus
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.shared.DateUtil

// Lembretes locais exatos via AlarmManager. Agenda/cancela/reagenda com dedupe.
// Persiste o PAYLOAD completo de cada lembrete (id, horário, título, texto) para
// permitir RE-ARMAR todos os alarmes após reboot/atualização (BootReceiver), já que
// o AlarmManager perde os alarmes nesses casos. leadMinutes = antecedência.
object ReminderScheduler {
    private const val TAG = "ReminderDiag"
    private const val PREF = "reminders"
    private const val KEY = "scheduled"        // Set<String> de ids (compat)
    private const val KEY_PAYLOADS = "payloads" // Set<String> codificado com SEP
    private const val SEP = "\u0001"            // delimitador improvavel em texto de evento

    // Campos estruturados p/ a tela premium do lembrete (full-screen).
    private data class Sched(
        val key: String, val at: Long, val title: String, val text: String,
        val type: String = "event", val date: String = "", val time: String = "",
        val resp: String = "", val status: String = "", val deepLink: String = "",
    )

    // Extras estruturados levados no alarme/persistência (toleram ausência).
    data class Extra(
        val type: String = "event", val date: String = "", val time: String = "",
        val resp: String = "", val status: String = "", val deepLink: String = "",
    )

    // Resolve o UID do RESPONSÁVEL por um item, com fallbacks seguros e log claro.
    //  - Compromisso: ownerId; se vazio, o item "sem responsável explícito" pertence a
    //    quem criou (by) -> o criador recebe o lembrete do próprio item.
    //  - Tarefa: assigneeId; se vazio, idem (by).
    // Regra resultante: A cria p/ B (ownerId=B) -> só B; A cria p/ si (ownerId vazio,
    // by=A) -> A; item de B -> B. NÃO assume nada sem o campo real existir.
    fun resolveReminderResponsibleUid(type: String, ownerOrAssigneeId: String?, createdBy: String?): String? {
        val explicit = ownerOrAssigneeId?.takeIf { it.isNotBlank() }
        if (explicit != null) {
            android.util.Log.i(TAG, "[REMINDER_RESPONSIBLE_FIELD_RESOLVED] type=$type field=${if (type == "task") "assigneeId" else "ownerId"} uid=$explicit")
            return explicit
        }
        val creator = createdBy?.takeIf { it.isNotBlank() }
        if (creator != null) {
            android.util.Log.i(TAG, "[REMINDER_RESPONSIBLE_FIELD_RESOLVED] type=$type field=by(creator-fallback) uid=$creator")
            return creator
        }
        android.util.Log.w(TAG, "[REMINDER_NO_RESPONSIBLE_UID_FOUND] type=$type (sem ownerId/assigneeId/by)")
        return null
    }

    // Agenda lembretes de EVENTOS e TAREFAS APENAS quando o usuário logado é o
    // RESPONSÁVEL (evento: ownerId; tarefa: assigneeId). Assim o lembrete premium de
    // 1h aparece só no aparelho do responsável — nunca no de quem criou para outra pessoa.
    // Itens não-elegíveis têm o alarme local cancelado no próximo sync.
    // Evento com horário: lembra `leadMinutes` antes; se a janela já passou mas o evento
    // ainda é futuro, dispara NO horário. Sem horário: 09:00. Tarefa: no vencimento.
    fun sync(ctx: Context, events: List<EventItem>, tasks: List<TaskItem> = emptyList(), currentUid: String? = null, leadMinutes: Int = 60) {
        try {
            val now = System.currentTimeMillis()
            val uid = currentUid?.takeIf { it.isNotBlank() }
            val targets = ArrayList<Sched>()

            events.forEach { e ->
                if (e.done) return@forEach
                // Elegibilidade por UID do responsável (ownerId; fallback criador `by`).
                val responsibleId = resolveReminderResponsibleUid("event", e.ownerId, e.by)
                android.util.Log.i(TAG, "[REMINDER_ELIGIBILITY_DEBUG] item=${e.id} type=event currentUid=$uid ownerId=${e.ownerId} by=${e.by} responsible=$responsibleId eligible=${uid != null && responsibleId == uid}")
                if (uid == null || responsibleId == null || responsibleId != uid) {
                    android.util.Log.i(TAG, "[REMINDER_SKIPPED_NOT_RESPONSIBLE] item=${e.id} type=event user=$uid responsible=$responsibleId")
                    return@forEach
                }
                val hasTime = !e.start.isNullOrBlank()
                val baseMs = if (hasTime) EventStatus.dtMs(e.date, e.start) else EventStatus.dtMs(e.date, "09:00")
                if (baseMs == null) return@forEach
                val desired = if (hasTime) baseMs - leadMinutes * 60_000L else baseMs
                val trigger = when {
                    desired > now -> desired      // 1h antes (ou 09:00 p/ dia inteiro)
                    baseMs > now -> baseMs        // janela de antecedência já passou -> dispara no horário
                    else -> return@forEach        // evento já passou
                }
                val nome = e.title?.ifBlank { null } ?: e.client ?: "Compromisso"
                val title = "Lembrete: $nome"
                val text = listOfNotNull(e.client, e.start?.let { "às $it" }, e.location).joinToString(" · ")
                val status = EventStatus.status(e)?.text ?: ""
                android.util.Log.i(TAG, "[REMINDER_ELIGIBLE] item=${e.id} type=event user=$uid responsible=$responsibleId")
                targets.add(Sched(
                    e.id, trigger, title, text,
                    type = "event", date = e.date ?: "", time = e.start ?: "",
                    resp = e.owner ?: "", status = status, deepLink = "event:${e.id}",
                ))
            }

            tasks.forEach { t ->
                if (t.status == "concluido") return@forEach
                if (t.dueDate.isNullOrBlank() || t.dueTime.isNullOrBlank()) return@forEach
                // Elegibilidade por UID do responsável (assigneeId; fallback criador `by`).
                val responsibleId = resolveReminderResponsibleUid("task", t.assigneeId, t.by)
                android.util.Log.i(TAG, "[REMINDER_ELIGIBILITY_DEBUG] item=${t.id} type=task currentUid=$uid assigneeId=${t.assigneeId} by=${t.by} responsible=$responsibleId eligible=${uid != null && responsibleId == uid}")
                if (uid == null || responsibleId == null || responsibleId != uid) {
                    android.util.Log.i(TAG, "[REMINDER_SKIPPED_NOT_RESPONSIBLE] item=${t.id} type=task user=$uid responsible=$responsibleId")
                    return@forEach
                }
                val at = EventStatus.dtMs(t.dueDate, t.dueTime) ?: return@forEach
                if (at <= now) return@forEach
                val nome = t.title?.ifBlank { null } ?: t.client ?: "Tarefa"
                val title = "Tarefa: $nome"
                val text = listOfNotNull(t.assignee?.takeIf { it.isNotBlank() }?.let { "para $it" }, "vence às ${t.dueTime}").joinToString(" · ")
                android.util.Log.i(TAG, "[REMINDER_ELIGIBLE] item=${t.id} type=task user=$uid responsible=$responsibleId")
                targets.add(Sched(
                    "task_" + t.id, at, title, text,
                    type = "task", date = t.dueDate ?: "", time = t.dueTime ?: "",
                    resp = t.assignee ?: "", status = TaskStatus.label(t.status), deepLink = "task:${t.id}",
                ))
            }

            val prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val old = prefs.getStringSet(KEY, emptySet()) ?: emptySet()
            val newIds = targets.map { it.key }.toSet()
            // Cancela alarmes que deixaram de ser elegíveis (ex.: A criou p/ B, ou mudou o responsável).
            (old - newIds).forEach {
                android.util.Log.i(TAG, "[REMINDER_CANCELLED_NOT_RESPONSIBLE] item=$it")
                cancel(ctx, it)
            }
            val payloads = LinkedHashSet<String>()
            targets.forEach { s ->
                val ex = Extra(s.type, s.date, s.time, s.resp, s.status, s.deepLink)
                schedule(ctx, s.key, s.at, s.title, s.text, ex)
                android.util.Log.i(TAG, "[REMINDER_SCHEDULED_FOR_RESPONSIBLE] item=${s.key} responsible=${s.resp}")
                android.util.Log.i(TAG, "[REMINDER_SCHEDULED_FROM_SYNC] item=${s.key} responsible=${s.resp}")
                payloads.add(encode(s.key, s.at, s.title, s.text, ex))
            }
            prefs.edit().putStringSet(KEY, newIds).putStringSet(KEY_PAYLOADS, payloads).apply()

            // Diagnóstico persistido: plano de lembretes (exibido na tela de Notificações).
            val next = targets.minByOrNull { it.at }
            val nextLabel = if (next == null) "nenhum"
                else DateUtil.fmtMs(next.at) + " (em ${(next.at - now) / 60_000L} min)"
            ctx.getSharedPreferences("notifydiag", Context.MODE_PRIVATE).edit()
                .putString("sched_count", targets.size.toString())
                .putString("sched_next", nextLabel)
                .apply()
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
        }
    }

    // Re-arma todos os lembretes futuros a partir do payload persistido.
    // Usado pelo BootReceiver (reboot / app atualizado), quando o AlarmManager é zerado.
    fun rearmAll(ctx: Context) {
        try {
            val prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val payloads = prefs.getStringSet(KEY_PAYLOADS, emptySet()) ?: return
            val now = System.currentTimeMillis()
            val kept = LinkedHashSet<String>()
            val keptIds = LinkedHashSet<String>()
            payloads.forEach { row ->
                val p = row.split(SEP)
                if (p.size >= 4) {
                    val id = p[0]
                    val at = p[1].toLongOrNull()
                    if (at != null && at > now) {
                        // Extras só existem em payloads novos (size >= 10); toleramos os antigos.
                        val ex = if (p.size >= 10) Extra(p[4], p[5], p[6], p[7], p[8], p[9]) else Extra()
                        schedule(ctx, id, at, p[2], p[3], ex)
                        kept.add(row); keptIds.add(id)
                    }
                }
            }
            prefs.edit().putStringSet(KEY_PAYLOADS, kept).putStringSet(KEY, keptIds).apply()
        } catch (_: Throwable) { }
    }

    // Remove um lembrete já disparado do armazenamento persistido (evita re-armar no boot).
    fun removeFired(ctx: Context, eventId: String?) {
        if (eventId.isNullOrBlank()) return
        try {
            val prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val payloads = prefs.getStringSet(KEY_PAYLOADS, emptySet())?.toMutableSet() ?: return
            val ids = prefs.getStringSet(KEY, emptySet())?.toMutableSet() ?: mutableSetOf()
            payloads.removeAll { it.substringBefore(SEP) == eventId }
            ids.remove(eventId)
            prefs.edit().putStringSet(KEY_PAYLOADS, payloads).putStringSet(KEY, ids).apply()
        } catch (_: Throwable) { }
    }

    private fun s(v: String) = v.replace(SEP, " ")

    private fun encode(id: String, at: Long, title: String, text: String, ex: Extra): String =
        listOf(
            id, at.toString(), s(title), s(text),
            s(ex.type), s(ex.date), s(ex.time), s(ex.resp), s(ex.status), s(ex.deepLink),
        ).joinToString(SEP)

    fun schedule(ctx: Context, eventId: String, triggerAt: Long, title: String, text: String, ex: Extra = Extra()) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val intent = Intent(ctx, ReminderReceiver::class.java)
            .putExtra("eventId", eventId).putExtra("title", title).putExtra("text", text)
            .putExtra("type", ex.type).putExtra("date", ex.date).putExtra("time", ex.time)
            .putExtra("resp", ex.resp).putExtra("status", ex.status).putExtra("deeplink", ex.deepLink)
        val pi = PendingIntent.getBroadcast(ctx, eventId.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
            android.util.Log.i("ReminderDiag", "[REMINDER_SCHEDULED] id=$eventId at=$triggerAt type=${ex.type}")
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            android.util.Log.w("ReminderDiag", "[REMINDER_SCHEDULED] (inexato) id=$eventId at=$triggerAt")
        }
    }

    // Agenda o lembrete premium de 1h a partir do PUSH IMEDIATO (no aparelho do
    // responsável B), cobrindo o caso de B não abrir o app antes do lembrete.
    // Persiste o payload p/ sobreviver a reboot. Idempotente: o próximo sync regenera
    // o mesmo id (event:<id> / task_<id>), sem duplicar. leadMinutes default 60.
    fun scheduleFromFcm(
        ctx: Context, type: String, rawId: String, title: String,
        scheduledDate: String?, scheduledTime: String?, leadMinutes: Int = 60,
    ): Boolean {
        return try {
            val id = rawId.takeIf { it.isNotBlank() } ?: return false
            if (scheduledDate.isNullOrBlank()) return false   // sem data não há quando lembrar
            val key = if (type == "task") "task_$id" else id
            val baseMs = EventStatus.dtMs(scheduledDate, scheduledTime?.ifBlank { null } ?: "09:00") ?: return false
            val now = System.currentTimeMillis()
            val hasTime = !scheduledTime.isNullOrBlank()
            val desired = if (hasTime) baseMs - leadMinutes * 60_000L else baseMs
            val trigger = when {
                desired > now -> desired
                baseMs > now -> baseMs        // <1h: dispara no horário do item (sem duplicar)
                else -> return false          // já passou
            }
            val nome = title.ifBlank { if (type == "task") "Tarefa" else "Compromisso" }
            val notifTitle = if (type == "task") "Tarefa: $nome" else "Lembrete: $nome"
            val text = (if (type == "task") "Vence" else "Começa") +
                listOfNotNull(scheduledDate, scheduledTime?.takeIf { it.isNotBlank() }?.let { "às $it" }).joinToString(" · ", prefix = " ")
            val ex = Extra(
                type = if (type == "task") "task" else "event",
                date = scheduledDate, time = scheduledTime ?: "",
                resp = "Você", status = if (type == "task") "Pendente" else "Agendado",
                deepLink = (if (type == "task") "task:" else "event:") + id,
            )
            schedule(ctx, key, trigger, notifTitle, text, ex)
            android.util.Log.i(TAG, "[REMINDER_SCHEDULED_FROM_FCM] item=$id type=$type at=$trigger")
            // Persiste p/ rearmar no boot (mesmo formato do sync).
            try {
                val prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
                val ids = (prefs.getStringSet(KEY, emptySet()) ?: emptySet()).toMutableSet().apply { add(key) }
                val payloads = (prefs.getStringSet(KEY_PAYLOADS, emptySet()) ?: emptySet()).toMutableSet()
                payloads.removeAll { it.substringBefore(SEP) == key }
                payloads.add(encode(key, trigger, notifTitle, text, ex))
                prefs.edit().putStringSet(KEY, ids).putStringSet(KEY_PAYLOADS, payloads).apply()
            } catch (_: Throwable) { }
            true
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
            false
        }
    }

    // TESTE como RESPONSÁVEL: passa pelo resolver de elegibilidade (responsável == uid
    // atual) e agenda pelo mesmo fluxo real. Isola o filtro: se isto abre a tela cheia,
    // o problema (quando houver) está nos dados do item, não no full-screen.
    fun scheduleResponsibleTestIn(ctx: Context, currentUid: String?, seconds: Int): Boolean {
        return try {
            val uid = currentUid?.takeIf { it.isNotBlank() }
            // Simula um item cujo responsável é o próprio usuário (ownerId = uid).
            val resp = resolveReminderResponsibleUid("event", uid, uid)
            android.util.Log.i(TAG, "[REMINDER_ELIGIBILITY_DEBUG] item=resp_test type=event currentUid=$uid ownerId=$uid by=$uid responsible=$resp eligible=${uid != null && resp == uid}")
            if (uid == null || resp != uid) {
                android.util.Log.w(TAG, "[REMINDER_SKIPPED_NOT_RESPONSIBLE] item=resp_test user=$uid responsible=$resp")
                NotifyDiag.lastError.value = "Sessão sem uid para o teste de responsável"
                return false
            }
            val at = System.currentTimeMillis() + seconds * 1000L
            val ex = Extra(
                type = "event", date = DateUtil.todayIso(), time = DateUtil.hm(at),
                resp = "Você (responsável)", status = "Agendado", deepLink = "",
            )
            schedule(ctx, "resp_test", at, "Lembrete (teste responsável): Reunião", "Compromisso em 1 hora · você é o responsável", ex)
            android.util.Log.i(TAG, "[REMINDER_SCHEDULED_FOR_RESPONSIBLE] item=resp_test responsible=$uid")
            true
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
            false
        }
    }

    // TESTE do alerta premium: usa EXATAMENTE o mesmo fluxo real (AlarmManager ->
    // ReminderReceiver -> ReminderAlarmActivity full-screen), com dados de exemplo,
    // para validar em ~segundos sem esperar 1h.
    fun scheduleFullScreenTestIn(ctx: Context, seconds: Int): Boolean {
        return try {
            val at = System.currentTimeMillis() + seconds * 1000L
            val ex = Extra(
                type = "event", date = DateUtil.todayIso(), time = DateUtil.hm(at),
                resp = "Você (teste)", status = "Agendado", deepLink = "",
            )
            schedule(
                ctx, "fs_test", at,
                "Lembrete (teste): Reunião de equipe",
                "Compromisso em 1 hora · teste do alerta premium",
                ex,
            )
            true
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
            false
        }
    }

    fun cancel(ctx: Context, eventId: String) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val intent = Intent(ctx, ReminderReceiver::class.java)
        val pi = PendingIntent.getBroadcast(ctx, eventId.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE)
        if (pi != null) am.cancel(pi)
    }

    // Teste de diagnóstico: agenda um alarme (sem eventId) para daqui a `seconds`.
    // Valida AlarmManager + BroadcastReceiver de ponta a ponta.
    fun scheduleTestIn(ctx: Context, seconds: Int): Boolean {
        return try {
            val am = ctx.getSystemService(AlarmManager::class.java) ?: return false
            val intent = Intent(ctx, ReminderReceiver::class.java)
                .putExtra("title", "Teste agendado")
                .putExtra("text", "Disparado pelo AlarmManager após ${seconds}s.")
            val pi = PendingIntent.getBroadcast(ctx, 99020, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val at = System.currentTimeMillis() + seconds * 1000L
            try {
                if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
                }
            } catch (_: SecurityException) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            }
            true
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
            false
        }
    }
}
