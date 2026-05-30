package br.com.idseven.agenda.nativebeta.core

import android.content.Intent
import kotlinx.coroutines.flow.MutableStateFlow

// Ponte entre a notificação (Intent) e a navegação Compose.
// Carrega o alvo ("event:<id>" | "task:<id>" | "chat:<senderId>") e os dados do push
// para abrir o MODAL premium de detalhe da notificação (NotificationDetailModal).
object DeepLink {
    const val EXTRA_DEEPLINK = "deeplink_target"     // "event:<id>" | "task:<id>" | "chat:<senderId>"
    const val EXTRA_EVENT_ID = "deeplink_event_id"   // compat (lembrete local de evento)
    const val EXTRA_TITLE = "notif_title"
    const val EXTRA_BODY = "notif_body"
    const val EXTRA_TYPE = "notif_type"              // "event" | "task" | "chat"
    const val EXTRA_SCHEDULED_AT = "notif_scheduled_at"
    const val EXTRA_SENT_AT = "notif_sent_at"

    // Dados da notificação tocada (suficientes para o modal renderizar de imediato;
    // o restante vem do estado em memória / Firestore).
    data class NotifPayload(
        val type: String,        // event | task | chat
        val id: String,          // eventId | taskId | senderId (o "outro" no chat)
        val deepLink: String,    // alvo de navegação para o botão de ação
        val title: String? = null,
        val body: String? = null,
        val scheduledAt: String? = null,
        val sentAt: String? = null,
    )

    // Notificação pendente para exibir no modal premium.
    val notif = MutableStateFlow<NotifPayload?>(null)

    fun consumeIntent(intent: Intent?) {
        if (intent == null) return
        val dl = intent.getStringExtra(EXTRA_DEEPLINK)?.takeIf { it.isNotBlank() }
            ?: intent.getStringExtra(EXTRA_EVENT_ID)?.takeIf { it.isNotBlank() }?.let { "event:$it" }
            ?: return
        val type = intent.getStringExtra(EXTRA_TYPE)?.takeIf { it.isNotBlank() } ?: when {
            dl.startsWith("task:") -> "task"
            dl.startsWith("chat:") -> "chat"
            else -> "event"
        }
        notif.value = NotifPayload(
            type = type,
            id = dl.substringAfter(":", ""),
            deepLink = dl,
            title = intent.getStringExtra(EXTRA_TITLE),
            body = intent.getStringExtra(EXTRA_BODY),
            scheduledAt = intent.getStringExtra(EXTRA_SCHEDULED_AT),
            sentAt = intent.getStringExtra(EXTRA_SENT_AT),
        )
    }
}
