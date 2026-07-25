package br.com.idseven.agenda.data.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import br.com.idseven.agenda.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// F4.2C: recebe o token rotacionado (-> registerFcmToken) e as mensagens push reais.
class AgendaMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        Fcm.onNewToken(this, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val n = message.notification
        val title = n?.title ?: message.data["title"] ?: "Agenda ID Seven"
        val body = n?.body ?: message.data["body"] ?: ""
        Notifications.show(this, title, body)
    }

    companion object {
        const val CHANNEL_ID = "general"
    }
}

/** Canal + postagem local (heads-up). Sem PII em log. */
object Notifications {
    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (mgr.getNotificationChannel(AgendaMessagingService.CHANNEL_ID) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(
                        AgendaMessagingService.CHANNEL_ID,
                        "Notificacoes",
                        NotificationManager.IMPORTANCE_HIGH,
                    )
                )
            }
        }
    }

    fun show(ctx: Context, title: String, body: String) {
        ensureChannel(ctx)
        val builder = NotificationCompat.Builder(ctx, AgendaMessagingService.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
        try {
            NotificationManagerCompat.from(ctx).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), builder.build())
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS nao concedido (Android 13+): ignora silenciosamente.
        }
    }
}
