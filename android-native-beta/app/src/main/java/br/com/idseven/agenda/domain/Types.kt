package br.com.idseven.agenda.domain

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector

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

// Setores de tarefas (Quadros) — cada setor tem ícone, cor e descrição (SaaS).
// Mantém alias de chaves legadas (design/copy/postagem) para não quebrar dados antigos:
// o campo `sector` continua sendo uma String no Firestore (sem mudança de schema).
object Sectors {
    data class Sec(val key: String, val label: String, val color: Color, val icon: ImageVector, val desc: String)
    val ALL = listOf(
        Sec("edicao_midia", "Edição de mídia", Color(0xFF60A5FA), Icons.Outlined.Movie, "Cortes, legendas e exportação"),
        Sec("cronograma", "Cronograma", Color(0xFF34D399), Icons.Outlined.CalendarMonth, "Planejamento de publicações"),
        Sec("copywriting", "Copywriting", Color(0xFF22D3EE), Icons.Outlined.EditNote, "Textos, legendas e anúncios"),
        Sec("roteiro", "Roteiro", Color(0xFFF59E0B), Icons.Outlined.Description, "Gancho, desenvolvimento e CTA"),
        Sec("programacao_posts", "Programação de posts", Color(0xFFA78BFA), Icons.Outlined.GridView, "Agendamento e publicação"),
    )
    // Aliases de chaves antigas -> setor atual (compatibilidade com tarefas já salvas).
    private val ALIAS = mapOf("design" to "edicao_midia", "copy" to "copywriting", "postagem" to "programacao_posts")
    fun of(key: String?): Sec {
        val k = ALIAS[key] ?: key
        return ALL.firstOrNull { it.key == k } ?: ALL.first()
    }
}

// Status de tarefa (Kanban) — 4 colunas compatíveis com o PWA (afazer/andamento/revisao/concluido).
object TaskStatus {
    val COLUMNS = listOf("afazer", "andamento", "revisao", "concluido")
    fun label(s: String?): String = when (s) {
        "andamento" -> "Em andamento"
        "revisao" -> "Revisão"
        "concluido" -> "Concluído"
        else -> "A Fazer"
    }
    fun color(s: String?): Color = when (s) {
        "andamento" -> Color(0xFFF59E0B)
        "revisao" -> Color(0xFF60A5FA)
        "concluido" -> Color(0xFF34D399)
        else -> Color(0xFF9BA0AB)
    }
    fun desc(s: String?): String = when (s) {
        "andamento" -> "Em execução agora"
        "revisao" -> "Aguardando revisão"
        "concluido" -> "Tarefas finalizadas"
        else -> "Aguardando início"
    }
}

// Indicador de prazo em tempo real da tarefa.
object TaskDeadline {
    data class D(val text: String, val color: Color, val late: Boolean)
    fun of(t: TaskItem): D? {
        if (t.status == "concluido") return D("Concluída", Color(0xFF34D399), false)
        if (t.dueDate.isNullOrBlank()) return null
        val due = EventStatus.dtMs(t.dueDate, t.dueTime?.ifBlank { null } ?: "23:59") ?: return null
        val now = System.currentTimeMillis()
        val today = java.time.LocalDate.now().toString()
        return when {
            now > due -> D("Atrasada", Color(0xFFF87171), true)
            t.dueDate == today -> D("Hoje", Color(0xFFF59E0B), false)
            else -> D("Faltam " + EventStatus.humanDur(due - now), Color(0xFF34D399), false)
        }
    }
}
