package br.com.idseven.agenda.nativebeta.core

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.EventStatus

// Lembretes locais exatos via AlarmManager. Agenda/cancela/reagenda com dedupe
// (requestCode estável por evento + conjunto persistido). leadMinutes = antecedência.
object ReminderScheduler {
    private const val PREF = "reminders"
    private const val KEY = "scheduled"

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
            targets.forEach { (id, trigger, e) ->
                val title = "Lembrete: " + (e.title?.ifBlank { null } ?: e.client ?: "Compromisso")
                val text = listOfNotNull(e.client, e.start?.let { "às $it" }, e.location).joinToString(" · ")
                schedule(ctx, id, trigger, title, text)
            }
            prefs.edit().putStringSet(KEY, newIds).apply()
        } catch (_: Throwable) { }
    }

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
}
