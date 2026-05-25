package br.com.idseven.agenda.nativebeta.core

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.idseven.agenda.nativebeta.MainActivity
import br.com.idseven.agenda.nativebeta.R

// Canais e disparo de notificações (locais e remotas).
object Notifications {
    const val CH_REMINDERS = "reminders"
    const val CH_GENERAL = "general"

    fun ensure(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(
            NotificationChannel(CH_REMINDERS, "Lembretes de compromissos", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Lembretes locais antes dos compromissos"
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_GENERAL, "Avisos e mensagens", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Atualizações da equipe, tarefas e chat"
            }
        )
    }

    fun hasPostPermission(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun notify(ctx: Context, id: Int, channel: String, title: String, text: String) {
        if (!hasPostPermission(ctx)) return
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        val pi = PendingIntent.getActivity(ctx, id, open, flags)
        val n = NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(id, n)
        } catch (_: SecurityException) { }
    }
}
