package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.ListenerRegistration
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Tela "Hoje" fiel ao PWA: hero (saudação + data + stats) + cards de foco (Próxima ação / Depois disso).
class HojeFragment : Fragment() {

    private var evReg: ListenerRegistration? = null
    private var tkReg: ListenerRegistration? = null
    private var events: List<EventItem> = emptyList()
    private var tasks: List<TaskItem> = emptyList()
    private lateinit var root: LinearLayout

    private val MO = listOf("janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro")
    private val DW = listOf("domingo","segunda","terça","quarta","quinta","sexta","sábado")

    override fun onCreateView(i: LayoutInflater, c: ViewGroup?, s: Bundle?): View {
        val scroll = ScrollView(requireContext()); scroll.setBackgroundColor(Color.parseColor("#0a0b10"))
        root = LinearLayout(requireContext()); root.orientation = LinearLayout.VERTICAL; root.setPadding(dp(18), dp(20), dp(18), dp(20))
        scroll.addView(root); return scroll
    }

    override fun onStart() {
        super.onStart()
        evReg = EventRepo.listen({ events = it; ui { render() } }, { })
        tkReg = TasksRepo.listen { tasks = it; ui { render() } }
    }
    override fun onStop() { super.onStop(); evReg?.remove(); tkReg?.remove(); evReg = null; tkReg = null }
    private fun ui(b: () -> Unit) { if (isAdded) requireActivity().runOnUiThread(b) }

    private fun myName() = (Session.name(requireContext()) ?: "").trim().lowercase()
    private fun myUid() = Session.uid(requireContext())
    private fun isMyTask(t: TaskItem) = myName().isNotEmpty() && (t.assignee ?: "").trim().lowercase() == myName()
    private fun isMyEvent(e: EventItem) = e.ownerId == myUid() || (e.ownerId.isNullOrBlank() && e.owner.isNullOrBlank())

    private fun saudacao(): String {
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return when { h < 5 -> "Boa madrugada"; h < 12 -> "Bom dia"; h < 18 -> "Boa tarde"; else -> "Boa noite" }
    }
    private fun todayBounds(): Pair<Long, Long> {
        val c = Calendar.getInstance(); c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0)
        val start = c.timeInMillis; return start to (start + 86400000L)
    }

    private data class Focus(val kind: String, val task: TaskItem?, val event: EventItem?, val urgency: String)

    private fun pickFocus(): List<Focus> {
        val (t0, t1) = todayBounds()
        val out = ArrayList<Focus>()
        val mine = tasks.filter { isMyTask(it) && it.status != "concluido" }
        mine.filter { it.isLate() }.sortedBy { it.dueMs() ?: 0 }.forEach { out.add(Focus("task", it, null, "late")) }
        mine.filter { !it.isLate() && (it.dueMs()?.let { d -> d in t0 until t1 } == true) }.sortedBy { it.dueMs() ?: 0 }.forEach { out.add(Focus("task", it, null, "today")) }
        mine.filter { !it.isLate() && (it.dueMs()?.let { d -> d in t0 until t1 } != true) && (it.status == "andamento" || (it.startedAt != null && it.status != "concluido")) }
            .sortedByDescending { it.startedAt ?: 0 }.forEach { out.add(Focus("task", it, null, "running")) }
        events.filter { e -> !e.done && e.date != null && (EventStatus.dtMs(e.date, e.start ?: "00:00")?.let { it in t0 until t1 } == true) && isMyEvent(e) }
            .sortedBy { EventStatus.dtMs(it.date, it.start ?: "00:00") ?: 0 }
            .forEach { e -> val st = EventStatus.status(e); out.add(Focus("event", null, e, if (st?.late == true) "late" else if (st?.kind == "run") "running" else "today")) }
        if (out.size < 7) {
            mine.filter { !it.isLate() && it.status != "andamento" && it.startedAt == null && (it.dueMs()?.let { d -> d in t0 until t1 } != true) }
                .sortedWith(compareByDescending<TaskItem> { it.prio }.thenBy { it.dueMs() ?: Long.MAX_VALUE })
                .take(7 - out.size).forEach { out.add(Focus("task", it, null, "next")) }
        }
        return out.take(7)
    }

    private fun render() {
        root.removeAllViews()
        // Hero
        val firstName = (Session.name(requireContext()) ?: "").trim().split(Regex("\\s+")).firstOrNull() ?: ""
        val greet = TextView(requireContext()); greet.text = saudacao() + (if (firstName.isNotEmpty()) ", $firstName 👋" else " 👋")
        greet.setTextColor(Color.parseColor("#f1f2f4")); greet.textSize = 22f; greet.setTypeface(greet.typeface, android.graphics.Typeface.BOLD)
        root.addView(greet)
        val cal = Calendar.getInstance()
        val date = TextView(requireContext())
        date.text = (DW[cal.get(Calendar.DAY_OF_WEEK) - 1] + ", " + cal.get(Calendar.DAY_OF_MONTH) + " DE " + MO[cal.get(Calendar.MONTH)]).uppercase()
        date.setTextColor(Color.parseColor("#6e7480")); date.textSize = 11f; date.setPadding(0, dp(6), 0, 0)
        root.addView(date)

        val openMine = tasks.count { isMyTask(it) && it.status != "concluido" }
        val lateMine = tasks.count { isMyTask(it) && it.isLate() }
        val (t0, t1) = todayBounds()
        val evToday = events.count { !it.done && it.date != null && (EventStatus.dtMs(it.date, it.start ?: "00:00")?.let { ms -> ms in t0 until t1 } == true) && isMyEvent(it) }
        val parts = ArrayList<String>()
        if (openMine > 0) parts.add("$openMine tarefa${if (openMine != 1) "s" else ""} em aberto")
        if (lateMine > 0) parts.add("$lateMine atrasada${if (lateMine != 1) "s" else ""}")
        if (evToday > 0) parts.add("$evToday compromisso${if (evToday != 1) "s" else ""} hoje")
        if (parts.isEmpty()) parts.add("Tudo em dia")
        val stats = TextView(requireContext()); stats.text = parts.joinToString("  ·  "); stats.setTextColor(Color.parseColor("#9ba0ab")); stats.textSize = 13f; stats.setPadding(0, dp(8), 0, dp(6))
        root.addView(stats)

        val focus = pickFocus()
        if (focus.isEmpty()) {
            val box = LinearLayout(requireContext()); box.orientation = LinearLayout.VERTICAL; box.gravity = Gravity.CENTER; box.setPadding(0, dp(50), 0, 0)
            val h = TextView(requireContext()); h.text = "Tudo em dia! 🎉"; h.setTextColor(Color.parseColor("#f1f2f4")); h.textSize = 19f; h.gravity = Gravity.CENTER
            val p = TextView(requireContext()); p.text = "Você não tem nada urgente agora."; p.setTextColor(Color.parseColor("#9ba0ab")); p.gravity = Gravity.CENTER; p.setPadding(0, dp(10), 0, 0)
            box.addView(h); box.addView(p); root.addView(box); return
        }
        label("Próxima ação")
        root.addView(focusCard(focus[0], true))
        if (focus.size > 1) { label("Depois disso"); for (i in 1 until focus.size) root.addView(focusCard(focus[i], false)) }
    }

    private fun label(s: String) {
        val t = TextView(requireContext()); t.text = s.uppercase(); t.setTextColor(Color.parseColor("#6e7480")); t.textSize = 11f
        t.setTypeface(t.typeface, android.graphics.Typeface.BOLD); t.setPadding(0, dp(18), 0, dp(8)); root.addView(t)
    }

    private fun focusCard(f: Focus, spot: Boolean): View {
        val urgColor = when (f.urgency) { "late" -> Color.parseColor("#f87171"); "today", "running" -> Color.parseColor("#f59e0b"); else -> Color.parseColor("#5b6cff") }
        val card = LinearLayout(requireContext()); card.orientation = LinearLayout.HORIZONTAL
        val bg = GradientDrawable(); bg.cornerRadius = dp(14).toFloat(); bg.setColor(Color.parseColor("#15171f")); if (spot) bg.setStroke(dp(1), urgColor); card.background = bg
        val clp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); clp.bottomMargin = dp(10); card.layoutParams = clp
        val bar = View(requireContext()); bar.layoutParams = LinearLayout.LayoutParams(dp(4), LinearLayout.LayoutParams.MATCH_PARENT); bar.setBackgroundColor(urgColor); card.addView(bar)
        val body = LinearLayout(requireContext()); body.orientation = LinearLayout.VERTICAL; body.setPadding(dp(14), dp(13), dp(14), dp(13))
        body.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)

        val meta = LinearLayout(requireContext()); meta.orientation = LinearLayout.HORIZONTAL
        val urgLabel = when (f.urgency) { "late" -> "ATRASADA"; "today" -> "HOJE"; "running" -> "EM ANDAMENTO"; else -> "PRÓXIMA" }
        if (f.kind == "event") { meta.addView(pill("COMPROMISSO", urgColor)); meta.addView(pill(Types.of(f.event!!.type).label, Types.of(f.event.type).color)) }
        else { meta.addView(pill(urgLabel, urgColor)); val s = Sectors.of(f.task!!.sector); meta.addView(pill(s.label, s.color)) }
        body.addView(meta)

        val client = if (f.kind == "event") f.event!!.client else f.task!!.client
        if (!client.isNullOrBlank()) { val c = TextView(requireContext()); c.text = client; c.setTextColor(Color.parseColor("#9ba0ab")); c.textSize = 12f; c.setPadding(0, dp(8), 0, 0); body.addView(c) }
        val title = TextView(requireContext())
        title.text = if (f.kind == "event") (f.event!!.title?.ifBlank { null } ?: f.event.client ?: "Compromisso") else (f.task!!.title?.ifBlank { null } ?: "Sem título")
        title.setTextColor(Color.parseColor("#f1f2f4")); title.textSize = 16f; title.setPadding(0, dp(3), 0, 0); body.addView(title)

        val when0 = whenText(f)
        if (when0.isNotEmpty()) { val w = TextView(requireContext()); w.text = "🕒 $when0"; w.setTextColor(Color.parseColor("#9ba0ab")); w.textSize = 12f; w.setPadding(0, dp(6), 0, 0); body.addView(w) }

        // ações
        val act = LinearLayout(requireContext()); act.orientation = LinearLayout.HORIZONTAL; act.setPadding(0, dp(10), 0, 0)
        if (f.kind == "event") {
            act.addView(actionBtn("Ver detalhes", Color.parseColor("#1c1f29")) {
                startActivity(Intent(requireContext(), EventDetailActivity::class.java).putExtra("id", f.event!!.id))
            })
        } else {
            val t = f.task!!
            if (t.status == "afazer") act.addView(actionBtn("Iniciar agora", Color.parseColor("#5b6cff")) { TasksRepo.start(t.id) { m -> toast(m) } })
            else act.addView(actionBtn("Concluir", Color.parseColor("#5b6cff")) { TasksRepo.done(t.id) { m -> toast(m) } })
            act.addView(actionBtn("Abrir", Color.parseColor("#1c1f29")) { toast("Detalhe da tarefa entra no Quadro (fase seguinte).") })
        }
        body.addView(act)
        card.addView(body)
        return card
    }

    private fun whenText(f: Focus): String {
        val now = System.currentTimeMillis()
        return if (f.kind == "event") {
            val e = f.event!!
            if (e.startedAt != null && e.startedAt > 0 && !e.done) "Em andamento há " + EventStatus.humanDur(now - e.startedAt)
            else if (!e.start.isNullOrBlank()) "Começa às ${e.start}" else ""
        } else {
            val t = f.task!!; val d = t.dueMs()
            if (d != null) { val diff = d - now; if (diff < 0) "Atrasada há " + EventStatus.humanDur(-diff) else "Vence em " + EventStatus.humanDur(diff) }
            else if (t.startedAt != null) "Iniciada há " + EventStatus.humanDur(now - t.startedAt) else ""
        }
    }

    private fun pill(text: String, color: Int): TextView {
        val tv = TextView(requireContext()); tv.text = text; tv.setTextColor(color); tv.textSize = 10f; tv.setTypeface(tv.typeface, android.graphics.Typeface.BOLD)
        tv.setPadding(dp(8), dp(4), dp(8), dp(4))
        val bg = GradientDrawable(); bg.cornerRadius = dp(6).toFloat(); bg.setColor(withAlpha(color, 0.13f)); tv.background = bg
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.rightMargin = dp(6); tv.layoutParams = lp
        return tv
    }
    private fun actionBtn(text: String, color: Int, onClick: () -> Unit): TextView {
        val tv = TextView(requireContext()); tv.text = text; tv.setTextColor(Color.parseColor("#f1f2f4")); tv.textSize = 13f; tv.gravity = Gravity.CENTER
        tv.setPadding(dp(14), dp(9), dp(14), dp(9))
        val bg = GradientDrawable(); bg.cornerRadius = dp(10).toFloat(); bg.setColor(color); tv.background = bg
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.rightMargin = dp(8); tv.layoutParams = lp
        tv.isClickable = true; tv.setOnClickListener { onClick() }; return tv
    }
    private fun withAlpha(color: Int, a: Float): Int = Color.argb((a * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))
    private fun toast(s: String) { if (isAdded) Toast.makeText(requireContext(), s, Toast.LENGTH_SHORT).show() }
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
}
