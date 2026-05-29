package br.com.idseven.agenda.nativebeta.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Recebe o alarme do AlarmManager e posta a notificação local do lembrete.
// Aceita lembretes de compromisso (com eventId) e o teste agendado (sem eventId).
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            val id = intent.getStringExtra("eventId")?.takeIf { it.isNotBlank() }
            val title = intent.getStringExtra("title") ?: "Lembrete"
            val text = intent.getStringExtra("text") ?: ""
            Notifications.ensure(context)
            val notifId = id?.hashCode() ?: 99021
            val ok = Notifications.notify(context, notifId, Notifications.CH_REMINDERS, title, text, eventId = id)
            NotifyDiag.lastFired.value = (if (ok) "Disparado · " else "Falhou · ") + br.com.idseven.agenda.nativebeta.shared.DateUtil.hm(System.currentTimeMillis())
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
        }
    }
}
