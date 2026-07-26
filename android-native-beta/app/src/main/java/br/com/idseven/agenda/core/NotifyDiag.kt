package br.com.idseven.agenda.core

import kotlinx.coroutines.flow.MutableStateFlow

// Diagnóstico observável das notificações locais (exibido em Perfil > Notificações).
// Atualizado pelos testes (imediato/agendado) e pelo disparo real do receiver.
object NotifyDiag {
    val lastImmediate = MutableStateFlow<String?>(null)
    val lastScheduled = MutableStateFlow<String?>(null)
    val lastFired = MutableStateFlow<String?>(null)
    val lastError = MutableStateFlow<String?>(null)
}
