package br.com.idseven.agenda.nativebeta.core

import android.content.Intent
import kotlinx.coroutines.flow.MutableStateFlow

// Ponte de deep-link entre a notificação (Intent) e a navegação Compose.
// Carrega um alvo no formato "event:<id>" ou "task:<id>"; ao tocar, abre o detalhe certo.
object DeepLink {
    const val EXTRA_DEEPLINK = "deeplink_target"   // "event:<id>" | "task:<id>"
    const val EXTRA_EVENT_ID = "deeplink_event_id" // compat (lembrete local de evento)

    val pending = MutableStateFlow<String?>(null)

    fun consumeIntent(intent: Intent?) {
        if (intent == null) return
        val dl = intent.getStringExtra(EXTRA_DEEPLINK)?.takeIf { it.isNotBlank() }
        if (dl != null) { pending.value = dl; return }
        val ev = intent.getStringExtra(EXTRA_EVENT_ID)?.takeIf { it.isNotBlank() }
        if (ev != null) pending.value = "event:$ev"
    }
}
