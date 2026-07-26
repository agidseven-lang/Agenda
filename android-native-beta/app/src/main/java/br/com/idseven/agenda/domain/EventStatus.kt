package br.com.idseven.agenda.domain

import java.util.Calendar

// Situação do compromisso — replica evStatus/evLate/humanDur do PWA.
object EventStatus {

    data class S(val kind: String, val text: String, val late: Boolean)

    fun humanDur(msIn: Long): String {
        val ms = if (msIn < 0) 0 else msIn
        val m = (ms / 60000).toInt()
        if (m < 60) return "$m min"
        val h = m / 60
        if (h < 24) return "${h}h" + (if (m % 60 != 0) " ${m % 60}min" else "")
        val d = h / 24
        return "${d}d" + (if (h % 24 != 0) " ${h % 24}h" else "")
    }

    fun dtMs(date: String?, time: String?): Long? {
        if (date.isNullOrBlank()) return null
        val dm = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(date) ?: return null
        var hh = 0; var mm = 0
        if (!time.isNullOrBlank()) {
            val tm = Regex("^(\\d{1,2}):(\\d{2})$").find(time)
            if (tm != null) { hh = tm.groupValues[1].toInt(); mm = tm.groupValues[2].toInt() }
        }
        val c = Calendar.getInstance()
        c.set(dm.groupValues[1].toInt(), dm.groupValues[2].toInt() - 1, dm.groupValues[3].toInt(), hh, mm, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    fun startMs(e: EventItem): Long? = dtMs(e.date, e.start ?: "00:00")
    fun dueMs(e: EventItem): Long? = dtMs(e.date, e.end ?: e.start ?: "23:59")

    fun status(e: EventItem): S? {
        val t = Types.of(e.type)
        if (e.done) return S("done", t.done, false)
        val now = System.currentTimeMillis()
        val d = dueMs(e)
        if (e.startedAt != null && e.startedAt > 0) {
            return S("run", t.run + " há " + humanDur(now - e.startedAt), d != null && now > d)
        }
        if (d != null) {
            val diff = d - now
            return if (diff > 0) S("wait", "Faltam " + humanDur(diff), false)
            else S("late", "Atrasada há " + humanDur(-diff), true)
        }
        return null
    }

    fun isLate(e: EventItem): Boolean {
        val d = dueMs(e) ?: return false
        return !e.done && System.currentTimeMillis() > d
    }
}
