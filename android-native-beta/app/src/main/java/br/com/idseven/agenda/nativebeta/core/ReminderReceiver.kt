package br.com.idseven.agenda.nativebeta.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import br.com.idseven.agenda.nativebeta.shared.DateUtil

// Recebe o alarme do AlarmManager e posta a notificação local do lembrete.
// Aceita lembretes de compromisso (com eventId) e o teste agendado (sem eventId).
// Roda em PROCESSO PRÓPRIO mesmo com o app fechado, por isso grava o resultado em
// SharedPreferences (cross-process) — o StateFlow em memória não sobrevive ao app fechado.
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            val id = intent.getStringExtra("eventId")?.takeIf { it.isNotBlank() }
            val title = intent.getStringExtra("title") ?: "Lembrete"
            val text = intent.getStringExtra("text") ?: ""
            val type = intent.getStringExtra("type")?.takeIf { it.isNotBlank() } ?: "event"
            val date = intent.getStringExtra("date")
            val time = intent.getStringExtra("time")
            val resp = intent.getStringExtra("resp")
            val status = intent.getStringExtra("status")
            val deeplink = intent.getStringExtra("deeplink")?.takeIf { it.isNotBlank() }
                ?: id?.let { "event:$it" } ?: ""
            Notifications.ensure(context)
            val notifId = id?.hashCode() ?: 99021
            // Lembrete 1h antes = experiência PREMIUM full-screen (heads-up se não permitido).
            val rawId = id?.removePrefix("task_") ?: ""
            val ok = Notifications.notifyReminderFullScreen(
                context, notifId, title, text,
                type = type, rawId = rawId, deepLink = deeplink,
                date = date, time = time, responsible = resp, status = status,
            )
            val stamp = (if (ok) "Disparado · " else "Falhou · ") + DateUtil.hm(System.currentTimeMillis()) +
                " · " + (id ?: "teste")
            // Em memória (útil quando o app está aberto)
            NotifyDiag.lastFired.value = stamp
            // Persistido (sobrevive ao app fechado; lido na tela de Notificações ao reabrir)
            try {
                context.getSharedPreferences("notifydiag", Context.MODE_PRIVATE)
                    .edit().putString("last_fired", stamp).apply()
            } catch (_: Throwable) { }
            // Lembrete de compromisso já disparado: tira do armazenamento para não re-armar no boot.
            ReminderScheduler.removeFired(context, id)
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
        }
    }
}
