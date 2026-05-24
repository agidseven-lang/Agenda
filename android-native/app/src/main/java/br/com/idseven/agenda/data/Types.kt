package br.com.idseven.agenda.data

import android.graphics.Color

// Tipos de compromisso — iguais ao PWA (5 tipos), com cor, label e frases de situação.
object Types {
    data class T(val key: String, val label: String, val color: Int, val run: String, val done: String)

    val ALL: List<T> = listOf(
        T("gravacao", "Gravação", Color.parseColor("#ef4444"), "Em gravação", "Gravação finalizada"),
        T("foto", "Fotografia", Color.parseColor("#f59e0b"), "Em fotografia", "Fotografia finalizada"),
        T("reuniao", "Reunião", Color.parseColor("#60a5fa"), "Em reunião", "Reunião finalizada"),
        T("edicao", "Edição", Color.parseColor("#a78bfa"), "Em edição", "Edição finalizada"),
        T("outro", "Outro", Color.parseColor("#9ca3af"), "Em andamento", "Concluída")
    )

    fun of(type: String?): T = ALL.firstOrNull { it.key == type } ?: ALL.last() // outro
}
