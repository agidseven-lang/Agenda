package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import br.com.idseven.agenda.nativebeta.data.FcmApi
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

// Notificações remotas (FCM). Quando o token rotaciona, re-registra SERVER-SIDE via
// registerFcmToken (F3.3.73G — sem Firestore direto; as Rules fecharam users) — assim
// o Worker de push sempre alcança este aparelho, inclusive para o usuário RESPONSÁVEL
// pelo compromisso. Mensagens viram notificação local do sistema (app fechado incluso).
class AppFirebaseMessagingService : FirebaseMessagingService() {

    private val io = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        try {
            val prefs = getSharedPreferences("fcm", Context.MODE_PRIVATE)
            prefs.edit().putString("token", token).apply()
            val uid = prefs.getString("uid", null)
            // F3.3.73G — rotação server-side (bearer da sessão 73C). Sem uid salvo
            // (nunca logou), o registro acontece no próximo login/resume.
            if (!uid.isNullOrBlank()) {
                io.launch { FcmApi.register(applicationContext, token) }
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
            // F3.3.6-C — sem duplicidade local+FCM: se o app está em FOREGROUND, o banner in-app
            // (derivado do snapshot local) cobre a tarefa, então suprimimos a notificação de SISTEMA
            // apenas para type=="task". Background/tela bloqueada mantêm a notificação de sistema.
            val suppressForeground = AppForeground.isForeground && data["type"] == "task"
            if (!suppressForeground) {
                Notifications.notify(
                    this, System.currentTimeMillis().toInt(), Notifications.CH_IMMEDIATE,
                    title, body, deepLink = deepLink, subText = subText,
                )
            }

            // Este aparelho É o do responsável (a Function só envia ao responsável).
            // Agenda o lembrete premium de 1h aqui, cobrindo o caso de B não abrir o app
            // antes do lembrete. Idempotente com o sync (mesmo id). Não afeta o push imediato.
            val type = data["type"]
            // F3.3.73I6C3 — pushes de LIFECYCLE (iniciar/finalizar/cancelar/editar do fan-out 73I6C1)
            // NÃO reagendam o lembrete de 1h (o payload de lifecycle nem traz scheduledDate). Só a
            // criação/atribuição agenda. Evita, p.ex., reagendar lembrete de um evento cancelado.
            val action = data["action"]
            val isLifecycle = action == "started" || action == "finished" || action == "cancelled" || action == "updated"
            if ((type == "event" || type == "task") && !isLifecycle) {
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
