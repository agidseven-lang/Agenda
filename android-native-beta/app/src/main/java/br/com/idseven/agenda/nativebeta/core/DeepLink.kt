package br.com.idseven.agenda.nativebeta.core

import android.content.Intent
import kotlinx.coroutines.flow.MutableStateFlow

// Ponte de deep-link entre a notificação (Intent) e a navegação Compose.
// A notificação de lembrete carrega o id do compromisso; ao tocar, abrimos o detalhe.
object DeepLink {
    const val EXTRA_EVENT_ID = "deeplink_event_id"

    val pendingEventId = MutableStateFlow<String?>(null)

    fun consumeIntent(intent: Intent?) {
        val id = intent?.getStringExtra(EXTRA_EVENT_ID)?.takeIf { it.isNotBlank() } ?: return
        pendingEventId.value = id
    }
}
