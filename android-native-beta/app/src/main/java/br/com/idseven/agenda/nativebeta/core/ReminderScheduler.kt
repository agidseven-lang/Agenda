package br.com.idseven.agenda.nativebeta.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.EventStatus

// Lembretes locais exatos via AlarmManager. Agenda/cancela/reagenda com dedupe.
// Persiste o PAYLOAD completo de cada lembrete (id, horário, título, texto) para
// permitir RE-ARMAR todos os alarmes após reboot/atualização (BootReceiver), já que
// o AlarmManager perde os alarmes nesses casos. leadMinutes = antecedência.
object ReminderScheduler {
    private const val PREF = "reminders"
    private const val KEY = "scheduled"        // Set<String> de ids (compat)
    private const val KEY_PAYLOADS = "payloads" // Set<String> codificado com SEP
    private const val SEP = "\u0001"            // delimitador improvavel em texto de evento

    fun sync(ctx: Context, events: List<EventItem>, leadMinutes: Int = 30) {
        try {
            val now = System.currentTimeMillis()
            val targets = events.filter { !it.done }.mapNotNull { e ->
                // Com horário: lembra `leadMinutes` antes. Sem horário (evento de dia inteiro):
                // lembra às 09:00 do próprio dia, em vez de 30 min antes da meia-noite.
                val trigger = if (!e.start.isNullOrBlank()) {
                    val start = EventStatus.dtMs(e.date, e.start) ?: return@mapNotNull null
                    start - leadMinutes * 60_000L
                } else {
                    EventStatus.dtMs(e.date, "09:00") ?: return@mapNotNull null
                }
                if (trigger > now) Triple(e.id, trigger, e) else null
            }
            val prefs = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val old = prefs.getStringSet(KEY, emptySet()) ?: emptySet()
            val newIds = targets.map { it.first }.toSet()
            (old - newIds).forEach { cancel(ctx, it) }
            val payloads = LinkedHashSet<String>()
            targets.forEach { (id, trigger, e) ->
                val title = "Lembrete: " + (e.title?.ifBlank { null } ?: e.client ?: "Compromisso")
                val text = listOfNotNull(e.client, e.start?.let { "às $it" }, e.location).joinToString(" · ")
                schedule(ctx, id, trigger, title, text)
                payloads.add(encode(id, trigger, title, text))
            }
            prefs.edit().putStringSet(KEY, newIds).putStringSet(KEY_PAYLOADS, payloads).apply()
        } catch (_: Throwable) { }
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
