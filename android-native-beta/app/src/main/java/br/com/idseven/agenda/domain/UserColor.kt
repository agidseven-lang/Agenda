package br.com.idseven.agenda.domain

import androidx.compose.ui.graphics.Color
import kotlin.math.abs

// Cor do responsável — replica userColor() do PWA (paleta + hash do id).
object UserColor {
    private val HEX = listOf(
        "#f87171", "#60a5fa", "#34d399", "#a78bfa", "#f59e0b", "#f472b6",
        "#22d3ee", "#5b6cff", "#fb923c", "#a78bfa", "#5eead4", "#fca5f1"
    )

    fun of(id: String?, colorHex: String?): Color {
        if (colorHex != null && HEX.contains(colorHex)) return Color(android.graphics.Color.parseColor(colorHex))
        if (id.isNullOrEmpty()) return Color(0xFF8A8A96)
        var h = 0
        for (c in id) h = ((h shl 5) - h) + c.code
        return Color(android.graphics.Color.parseColor(HEX[abs(h) % HEX.size]))
    }

    fun initials(name: String?): String {
        val parts = (name ?: "").trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return when {
            parts.isEmpty() -> "?"
            parts.size == 1 -> parts[0].take(1).uppercase()
            else -> (parts.first().take(1) + parts.last().take(1)).uppercase()
        }
    }

    fun firstName(name: String?): String =
        (name ?: "").trim().split(Regex("\\s+")).firstOrNull() ?: ""
}
