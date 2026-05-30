package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Notificações remotas (FCM). Quando o token rotaciona, atualiza users.fcmTokens no
// Firestore (lendo o uid salvo no login) — assim o Worker de push sempre alcança este
// aparelho, inclusive para o usuário RESPONSÁVEL pelo compromisso. Mensagens viram
// notificação local do sistema (funciona com o app fechado).
class AppFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        try {
            val prefs = getSharedPreferences("fcm", Context.MODE_PRIVATE)
            prefs.edit().putString("token", token).apply()
            val uid = prefs.getString("uid", null)
            if (!uid.isNullOrBlank()) {
                FirebaseFirestore.getInstance().collection("users").document(uid)
                    .update("fcmTokens", FieldValue.arrayUnion(token))
            }
        } catch (_: Throwable) { }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        try {
            Notifications.ensure(this)
            val n = message.notification
            val title = n?.title ?: message.data["title"] ?: "ID Seven"
            val body = n?.body ?: message.data["body"] ?: ""
            val eventId = message.data["eventId"]?.takeIf { it.isNotBlank() }
            Notifications.notify(this, System.currentTimeMillis().toInt(), Notifications.CH_GENERAL, title, body, eventId = eventId)
        } catch (_: Throwable) { }
    }
}
