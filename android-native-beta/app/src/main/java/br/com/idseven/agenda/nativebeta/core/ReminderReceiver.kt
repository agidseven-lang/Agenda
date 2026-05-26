package br.com.idseven.agenda.nativebeta.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Recebe o alarme do AlarmManager e posta a notificação local do lembrete.
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            val id = intent.getStringExtra("eventId") ?: return
            val title = intent.getStringExtra("title") ?: "Lembrete"
            val text = intent.getStringExtra("text") ?: ""
            Notifications.ensure(context)
            Notifications.notify(context, id.hashCode(), Notifications.CH_REMINDERS, title, text, eventId = id)
        } catch (_: Throwable) { }
    }
}
