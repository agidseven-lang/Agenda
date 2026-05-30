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

    // Agenda lembretes de EVENTOS e TAREFAS (marcar alguém por horário).
    // Evento com horário: lembra `leadMinutes` antes; se essa janela já passou mas o evento
    // ainda é futuro, dispara NO horário do evento (não fica sem alarme). Sem horário: 09:00.
    // Tarefa com data+hora de vencimento: dispara no horário de vencimento.
    fun sync(ctx: Context, events: List<EventItem>, tasks: List<TaskItem> = emptyList(), leadMinutes: Int = 30) {
        try {
            val now = System.currentTimeMillis()
            val targets = ArrayList<Sched>()

            events.forEach { e ->
                if (e.done) return@forEach
                val hasTime = !e.start.isNullOrBlank()
                val baseMs = if (hasTime) EventStatus.dtMs(e.date, e.start) else EventStatus.dtMs(e.date, "09:00")
                if (baseMs == null) return@forEach
                val desired = if (hasTime) baseMs - leadMinutes * 60_000L else baseMs
                val trigger = when {
                    desired > now -> desired      // 30 min antes (ou 09:00 p/ dia inteiro)
                    baseMs > now -> baseMs        // janela de antecedência já passou -> dispara no horário
                    else -> return@forEach        // evento já passou
                }
                val nome = e.title?.ifBlank { null } ?: e.client ?: "Compromisso"
                val title = "Lembrete: $nome"
                val text = listOfNotNull(e.client, e.start?.let { "às $it" }, e.location).joinToString(" · ")
                val status = EventStatus.status(e)?.text ?: ""
                targets.add(Sched(
                    e.id, trigger, title, text,
                    type = "event", date = e.date ?: "", time = e.start ?: "",
                    resp = e.owner ?: "", status = status, deepLink = "event:${e.id}",
                ))
            }

            tasks.forEach { t ->
                if (t.status == "concluido") return@forEach
                if (t.dueDate.isNullOrBlank() || t.dueTime.isNullOrBlank()) return@forEach
                val at = EventStatus.dtMs(t.dueDate, t.dueTime) ?: return@forEach
                if (at <= now) return@forEach
                val nome = t.title?.ifBlank { null } ?: t.client ?: "Tarefa"
                val title = "Tarefa: $nome"
                val text = listOfNotNull(t.assignee?.takeIf { it.isNotBlank() }?.let { "para $it" }, "vence às ${t.dueTime}").joinToString(" · ")
                targets.add(Sched(
                    "task_" + t.id, at, title, text,
                    type = "task", date = t.dueDate ?: "", time = t.dueTime ?: "",
                    resp = t.assignee ?: "", status = TaskStatus.label(t.status), deepLink = "task:${t.id}",
                ))
            }

            val prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val old = prefs.getStringSet(KEY, emptySet()) ?: emptySet()
            val newIds = targets.map { it.key }.toSet()
            (old - newIds).forEach { cancel(ctx, it) }
            val payloads = LinkedHashSet<String>()
            targets.forEach { s ->
                val ex = Extra(s.type, s.date, s.time, s.resp, s.status, s.deepLink)
                schedule(ctx, s.key, s.at, s.title, s.text, ex)
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
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
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
