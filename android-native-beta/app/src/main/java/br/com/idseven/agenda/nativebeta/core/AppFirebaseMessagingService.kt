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
            val data = message.data
            val title = n?.title ?: data["title"] ?: "ID Seven"
            val body = n?.body ?: data["body"] ?: ""
            // Deep-link: usa o campo data.deepLink ("event:id"/"task:id"/"chat:senderId")
            // ou monta a partir de eventId/taskId/senderId.
            val deepLink = data["deepLink"]?.takeIf { it.isNotBlank() }
                ?: data["taskId"]?.takeIf { it.isNotBlank() }?.let { "task:$it" }
                ?: data["eventId"]?.takeIf { it.isNotBlank() }?.let { "event:$it" }
                ?: data["senderId"]?.takeIf { it.isNotBlank() && data["type"] == "chat" }?.let { "chat:$it" }
            // Extras para o modal premium pós-clique (tipo + carimbos quando vierem no payload).
            val extras = HashMap<String, String>()
            data["type"]?.takeIf { it.isNotBlank() }?.let { extras[DeepLink.EXTRA_TYPE] = it }
            data["scheduledAt"]?.takeIf { it.isNotBlank() }?.let { extras[DeepLink.EXTRA_SCHEDULED_AT] = it }
            data["sentAt"]?.takeIf { it.isNotBlank() }?.let { extras[DeepLink.EXTRA_SENT_AT] = it }
            // Canal de ALTA importância (heads-up) para atribuições em tempo real.
            Notifications.notify(this, System.currentTimeMillis().toInt(), Notifications.CH_REMINDERS, title, body, deepLink = deepLink, extras = extras)
        } catch (_: Throwable) { }
    }
}
