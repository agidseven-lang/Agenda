package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Notificações remotas (FCM). Token novo é cacheado; o registro no doc do usuário
// acontece no login via Fcm.register(uid). Mensagens viram notificação local.
class AppFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        try {
            getSharedPreferences("fcm", Context.MODE_PRIVATE).edit().putString("token", token).apply()
        } catch (_: Throwable) { }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        try {
            Notifications.ensure(this)
            val n = message.notification
            val title = n?.title ?: message.data["title"] ?: "ID Seven"
            val body = n?.body ?: message.data["body"] ?: ""
            Notifications.notify(this, System.currentTimeMillis().toInt(), Notifications.CH_GENERAL, title, body)
        } catch (_: Throwable) { }
    }
}
