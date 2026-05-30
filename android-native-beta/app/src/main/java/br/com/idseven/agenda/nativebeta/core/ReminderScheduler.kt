package br.com.idseven.agenda.nativebeta.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.EventStatus
import br.com.idseven.agenda.nativebeta.domain.TaskItem
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

    private data class Sched(val key: String, val at: Long, val title: String, val text: String)

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
                val title = "Lembrete: " + (e.title?.ifBlank { null } ?: e.client ?: "Compromisso")
                val text = listOfNotNull(e.client, e.start?.let { "às $it" }, e.location).joinToString(" · ")
                targets.add(Sched(e.id, trigger, title, text))
            }

            tasks.forEach { t ->
                if (t.status == "concluido") return@forEach
                if (t.dueDate.isNullOrBlank() || t.dueTime.isNullOrBlank()) return@forEach
                val at = EventStatus.dtMs(t.dueDate, t.dueTime) ?: return@forEach
                if (at <= now) return@forEach
                val title = "Tarefa: " + (t.title?.ifBlank { null } ?: t.client ?: "Tarefa")
                val text = listOfNotNull(t.assignee?.takeIf { it.isNotBlank() }?.let { "para $it" }, "vence às ${t.dueTime}").joinToString(" · ")
                targets.add(Sched("task_" + t.id, at, title, text))
            }

            val prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val old = prefs.getStringSet(KEY, emptySet()) ?: emptySet()
            val newIds = targets.map { it.key }.toSet()
            (old - newIds).forEach { cancel(ctx, it) }
            val payloads = LinkedHashSet<String>()
            targets.forEach { s ->
                schedule(ctx, s.key, s.at, s.title, s.text)
                payloads.add(encode(s.key, s.at, s.title, s.text))
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
                        schedule(ctx, id, at, p[2], p[3])
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

    private fun encode(id: String, at: Long, title: String, text: String): String =
        listOf(id, at.toString(), title.replace(SEP, " "), text.replace(SEP, " ")).joinToString(SEP)

    fun schedule(ctx: Context, eventId: String, triggerAt: Long, title: String, text: String) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val intent = Intent(ctx, ReminderReceiver::class.java)
            .putExtra("eventId", eventId).putExtra("title", title).putExtra("text", text)
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
