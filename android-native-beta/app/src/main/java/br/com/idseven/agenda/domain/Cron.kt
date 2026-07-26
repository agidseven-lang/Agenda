package br.com.idseven.agenda.domain

import androidx.compose.ui.graphics.Color

// Helpers do fluxo de Cronograma — espelham EXATAMENTE o Desktop (renderer index.html):
//  - frequência derivada da quantidade de conteúdos (cronOf);
//  - label/cor do status do fluxo (CRON_STATES) e da resposta do cliente.
// Compartilhado pelo card (TasksScreen) e pelos Detalhes — fonte única de verdade.

// Tema numerado do cronograma (índice 1-based + texto). `more` = quantos ficaram fora do preview.
data class CronTheme(val n: Int, val tema: String)

data class CronInfo(
    val themes: List<CronTheme>,  // somente conteúdos com tema/legenda preenchidos
    val count: Int,               // total de conteúdos (inclui vazios) — define a frequência
    val label: String,            // "Semanal" | "Quinzenal" | "Mensal" | "Cronograma"
)

object Cron {
    // Mesmo critério do Desktop cronOf(): >=12 Mensal, >=6 Quinzenal, >=3 Semanal, senão "Cronograma".
    fun freqLabel(count: Int): String = when {
        count >= 12 -> "Mensal"
        count >= 6 -> "Quinzenal"
        count >= 3 -> "Semanal"
        else -> "Cronograma"
    }

    fun of(task: TaskItem): CronInfo? {
        val arr = task.cronContents
        if (arr.isEmpty()) return null
        val themes = arr.mapIndexedNotNull { i, c ->
            val tema = c.tema?.trim().orEmpty()
            val hasContent = tema.isNotEmpty() || !c.legenda.isNullOrBlank()
            if (hasContent) CronTheme(i + 1, tema.ifEmpty { "(sem tema)" }) else null
        }
        return CronInfo(themes = themes, count = arr.size, label = freqLabel(arr.size))
    }
}

// Status do fluxo cronograma->cliente->designer (cronStatus + clientReview).
// Espelha CRON_STATES + clientReview do Desktop. Fonte única (card + Detalhes).
object CronStatusUi {
    fun label(s: String?): String = when (s) {
        "rascunho_social" -> "Em rascunho (Social)"
        "pronto_cliente" -> "Pronto para envio"
        "enviado_cliente" -> "Enviado ao cliente"
        "cliente_visualizou" -> "Cliente visualizou"
        "em_revisao_cliente" -> "Em revisão (cliente)"
        "aprovado_cliente", "client_approved" -> "Aprovado pelo cliente"
        "editado_cliente" -> "Editado pelo cliente"
        "ready_for_final_client_review" -> "Pronto p/ revisão final"
        "sent_to_designer", "enviado_design" -> "Enviado ao designer"
        else -> s ?: "—"
    }

    fun color(s: String?): Color = when (s) {
        "enviado_cliente" -> Color(0xFF22D3EE)
        "em_revisao_cliente" -> Color(0xFFF59E0B)
        "aprovado_cliente", "client_approved" -> Color(0xFF34D399)
        "editado_cliente" -> Color(0xFFA78BFA)
        "pronto_cliente", "ready_for_final_client_review" -> Color(0xFF60A5FA)
        "sent_to_designer", "enviado_design" -> Color(0xFF5B6CFF)
        else -> Color(0xFF9BA0AB)
    }

    fun reviewLabel(s: String?): String = when (s) {
        "aprovado" -> "Aprovado pelo cliente"
        "revisao" -> "Revisão solicitada pelo cliente"
        "editado" -> "Edição solicitada pelo cliente"
        else -> "Resposta do cliente"
    }

    fun reviewColor(s: String?): Color = when (s) {
        "aprovado" -> Color(0xFF34D399)
        "revisao" -> Color(0xFFF59E0B)
        "editado" -> Color(0xFFA78BFA)
        else -> Color(0xFF9BA0AB)
    }
}
