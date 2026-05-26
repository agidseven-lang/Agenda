package br.com.idseven.agenda.data

import android.graphics.Color

// Cor do responsável — replica userColor() do PWA (paleta + hash do id).
object UserColor {
    private val PALETTE = listOf(
        "#f87171", "#60a5fa", "#34d399", "#a78bfa", "#f59e0b", "#f472b6",
        "#22d3ee", "#5b6cff", "#fb923c", "#a78bfa", "#5eead4", "#fca5f1"
    )

    fun of(id: String?, color: String?): Int {
        if (color != null && PALETTE.contains(color)) return Color.parseColor(color)
        if (id.isNullOrEmpty()) return Color.parseColor("#8a8a96")
        var h = 0
        for (c in id) h = ((h shl 5) - h) + c.code // hash com Int overflow == |0
        val idx = Math.abs(h) % PALETTE.size
        return Color.parseColor(PALETTE[idx])
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
