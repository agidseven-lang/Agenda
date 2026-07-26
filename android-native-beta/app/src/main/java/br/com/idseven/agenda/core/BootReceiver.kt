package br.com.idseven.agenda.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Re-arma os lembretes locais após reboot / atualização do app, quando o Android
// zera todos os alarmes do AlarmManager. Lê o payload persistido e reagenda os futuros.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try {
            when (intent.action) {
                Intent.ACTION_BOOT_COMPLETED,
                Intent.ACTION_LOCKED_BOOT_COMPLETED,
                Intent.ACTION_MY_PACKAGE_REPLACED,
                "android.intent.action.QUICKBOOT_POWERON" -> {
                    Notifications.ensure(context)
                    ReminderScheduler.rearmAll(context)
                }
            }
        } catch (_: Throwable) { }
    }
}
