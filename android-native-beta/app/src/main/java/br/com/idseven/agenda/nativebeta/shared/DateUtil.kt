package br.com.idseven.agenda.nativebeta.shared

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object DateUtil {
    private val MO = listOf("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro")
    private val DOW = listOf("domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado")
    private val ISO = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    fun todayIso(): String = ISO.format(Calendar.getInstance().time)

    private fun parse(iso: String): Calendar? = try {
        Calendar.getInstance().apply { time = ISO.parse(iso)!! }
    } catch (_: Exception) { null }

    fun dayLabel(iso: String): String {
        val c = parse(iso) ?: return iso
        val today = Calendar.getInstance()
        val tmr = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, 1) }
        val ytd = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, -1) }
        return when (iso) {
            ISO.format(today.time) -> "Hoje"
            ISO.format(tmr.time) -> "Amanhã"
            ISO.format(ytd.time) -> "Ontem"
            else -> DOW[c.get(Calendar.DAY_OF_WEEK) - 1].replaceFirstChar { it.uppercase() }
        }
    }

    fun dayShort(iso: String): String {
        val c = parse(iso) ?: return iso
        return "${c.get(Calendar.DAY_OF_MONTH)} de ${MO[c.get(Calendar.MONTH)]}"
    }

    fun fmtMs(ms: Long?): String {
        if (ms == null || ms <= 0) return "—"
        val c = Calendar.getInstance().apply { timeInMillis = ms }
        fun p(n: Int) = if (n < 10) "0$n" else "$n"
        return "${p(c.get(Calendar.DAY_OF_MONTH))}/${p(c.get(Calendar.MONTH) + 1)}/${c.get(Calendar.YEAR)} às ${p(c.get(Calendar.HOUR_OF_DAY))}:${p(c.get(Calendar.MINUTE))}"
    }
}
