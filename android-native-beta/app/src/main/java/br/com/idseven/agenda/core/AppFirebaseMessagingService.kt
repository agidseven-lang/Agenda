package br.com.idseven.agenda.core

import android.content.Context
import br.com.idseven.agenda.data.auth.ServerAuthRepository
import br.com.idseven.agenda.data.session.SecureSessionStore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.runBlocking

// Notificações remotas (FCM). Quando o token rotaciona, F4.2C registra o novo token pelo ENDPOINT
// AUTENTICADO (registerFcmToken, Bearer da sessao real do Keystore) — substituindo o write direto em
// users/{uid}.fcmTokens. O UID e derivado da sessao NO SERVIDOR (impossivel registrar para outro UID).
// Assim o Worker de push alcança este aparelho, inclusive para o usuário RESPONSÁVEL pelo compromisso.
// Mensagens viram notificação local do sistema (funciona com o app fechado).
class AppFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        try {
            val prefs = getSharedPreferences("fcm", Context.MODE_PRIVATE)
            prefs.edit().putString("token", token).apply()
            // onNewToken roda em thread de background do SDK FCM — pode bloquear ate concluir o
            // registro. Sem sessao valida, adia (o proximo login/registro reenvia).
            val sessionToken = SecureSessionStore(applicationContext).load()?.token
            if (!sessionToken.isNullOrBlank()) {
                val deviceId = Fcm.stableDeviceId(applicationContext)
                runBlocking {
                    ServerAuthRepository().registerFcmToken(sessionToken, token, deviceId, "android")
                }
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
            // Rótulo amigável por tipo (deixa a notificação imediata mais rica/detalhada).
            val subText = when (data["type"]) {
                "task" -> "Tarefa"
                "chat" -> "Mensagem"
                "event" -> "Compromisso"
                else -> null
            }
            // Notificação IMEDIATA: heads-up normal no canal de imediatos; toque navega direto.
            Notifications.notify(
                this, System.currentTimeMillis().toInt(), Notifications.CH_IMMEDIATE,
                title, body, deepLink = deepLink, subText = subText,
            )

            // Este aparelho É o do responsável (a Function só envia ao responsável).
            // Agenda o lembrete premium de 1h aqui, cobrindo o caso de B não abrir o app
            // antes do lembrete. Idempotente com o sync (mesmo id). Não afeta o push imediato.
            val type = data["type"]
            if (type == "event" || type == "task") {
                val rawId = (if (type == "task") data["taskId"] else data["eventId"])?.takeIf { it.isNotBlank() }
                    ?: data["deepLink"]?.substringAfter(":", "")?.takeIf { it.isNotBlank() }
                val date = data["scheduledDate"]?.takeIf { it.isNotBlank() } ?: data["scheduledAt"]
                val timeStr = data["scheduledTime"]
                val responsibleId = data["responsibleId"]?.takeIf { it.isNotBlank() }
                if (rawId != null) {
                    ReminderScheduler.scheduleFromFcm(this, type, rawId, title, date, timeStr, responsibleId = responsibleId)
                }
            }
        } catch (_: Throwable) { }
    }
}
