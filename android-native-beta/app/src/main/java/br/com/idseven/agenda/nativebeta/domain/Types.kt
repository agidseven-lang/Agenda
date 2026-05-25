package br.com.idseven.agenda.nativebeta.domain

import androidx.compose.ui.graphics.Color

// Tipos de compromisso — iguais ao PWA (5 tipos), com cor, label e frases de situação.
object Types {
    data class T(val key: String, val label: String, val color: Color, val run: String, val done: String)

    val ALL: List<T> = listOf(
        T("gravacao", "Gravação", Color(0xFFEF4444), "Em gravação", "Gravação finalizada"),
        T("foto", "Fotografia", Color(0xFFF59E0B), "Em fotografia", "Fotografia finalizada"),
        T("reuniao", "Reunião", Color(0xFF60A5FA), "Em reunião", "Reunião finalizada"),
        T("edicao", "Edição", Color(0xFFA78BFA), "Em edição", "Edição finalizada"),
        T("outro", "Outro", Color(0xFF9CA3AF), "Em andamento", "Concluída"),
    )

    fun of(type: String?): T = ALL.firstOrNull { it.key == type } ?: ALL.last()
}

// Setores de tarefas (gerenciador) — base inicial, alinhada ao PWA.
object Sectors {
    data class Sec(val key: String, val label: String, val color: Color)
    val ALL = listOf(
        Sec("design", "Design", Color(0xFFA78BFA)),
        Sec("copy", "Copy", Color(0xFF22D3EE)),
        Sec("roteiro", "Roteiro", Color(0xFFF59E0B)),
        Sec("postagem", "Postagem", Color(0xFF34D399)),
        Sec("edicao_midia", "Edição de Mídia", Color(0xFF60A5FA)),
    )
    fun of(key: String?): Sec = ALL.firstOrNull { it.key == key } ?: ALL.first()
}

// Status de tarefa (Kanban).
object TaskStatus {
    val COLUMNS = listOf("afazer", "andamento", "concluido")
    fun label(s: String?): String = when (s) {
        "andamento" -> "Em andamento"
        "concluido" -> "Concluído"
        else -> "A fazer"
    }
    fun color(s: String?): Color = when (s) {
        "andamento" -> Color(0xFFF59E0B)
        "concluido" -> Color(0xFF34D399)
        else -> Color(0xFF9BA0AB)
    }
}
