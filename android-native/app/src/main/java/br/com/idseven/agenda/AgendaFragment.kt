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
import android.widget.TextView
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.ListenerRegistration
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class AgendaFragment : Fragment() {

    private var evReg: ListenerRegistration? = null
    private var usReg: ListenerRegistration? = null
    private var events: List<EventItem> = emptyList()
    private var users: Map<String, UserLite> = emptyMap()

    private var filter = "all"
    private var view0 = "month"
    private val cursor = Calendar.getInstance()
    private var selDay = todayIso()

    private val MONTHS = listOf("janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro")
    private val WD = listOf("DOM","SEG","TER","QUA","QUI","SEX","SÁB")

    override fun onCreateView(i: LayoutInflater, c: ViewGroup?, s: Bundle?): View =
        i.inflate(R.layout.fragment_agenda, c, false)

    override fun onViewCreated(v: View, s: Bundle?) {
        buildChips()
        v.findViewById<TextView>(R.id.btnMes).setOnClickListener { view0 = "month"; syncToggle(); render() }
        v.findViewById<TextView>(R.id.btnLista).setOnClickListener { view0 = "list"; syncToggle(); render() }
        syncToggle()

        evReg = EventRepo.listen(
            onData = { list -> events = list; if (isAdded) requireActivity().runOnUiThread { err(""); render() } },
            onError = { msg -> if (isAdded) requireActivity().runOnUiThread { err(msg) } }
        )
        usReg = UsersRepo.listen { list ->
            users = list.associateBy { it.id }
            if (isAdded) requireActivity().runOnUiThread { render() }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView(); evReg?.remove(); usReg?.remove(); evReg = null; usReg = null
    }

    private fun err(m: String) { view?.findViewById<TextView>(R.id.txtErro)?.text = m }

    private fun syncToggle() {
        view?.findViewById<TextView>(R.id.btnMes)?.setTextColor(if (view0 == "month") Color.WHITE else Color.parseColor("#9aa0ac"))
        view?.findViewById<TextView>(R.id.btnLista)?.setTextColor(if (view0 == "list") Color.WHITE else Color.parseColor("#9aa0ac"))
    }

    private fun buildChips() {
        val chips = view?.findViewById<LinearLayout>(R.id.chips) ?: return
        chips.removeAllViews()
        chips.addView(chip("Todos", "all", null))
        for (t in Types.ALL) chips.addView(chip(t.label, t.key, t.color))
    }

    private fun chip(label: String, key: String, color: Int?): TextView {
        val tv = TextView(requireContext())
        tv.text = (if (color != null) "● " else "") + label
        tv.setTextColor(if (filter == key) Color.WHITE else Color.parseColor("#9aa0ac"))
        if (color != null && filter == key) tv.setTextColor(color)
        tv.textSize = 13f
        tv.setPadding(dp(12), dp(7), dp(12), dp(7))
        val bg = GradientDrawable(); bg.cornerRadius = dp(20).toFloat()
        bg.setColor(if (filter == key) Color.parseColor("#23262d") else Color.parseColor("#16181d"))
        tv.background = bg
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        lp.rightMargin = dp(8); tv.layoutParams = lp
        tv.setOnClickListener { filter = key; buildChips(); render() }
        return tv
    }

    private fun visible(): List<EventItem> =
        events.filter { filter == "all" || it.type == filter }

    private fun render() {
        val content = view?.findViewById<LinearLayout>(R.id.content) ?: return
        content.removeAllViews()
        if (view0 == "month") renderMonth(content) else renderList(content)
    }

    // ---------- MÊS ----------
    private fun renderMonth(root: LinearLayout) {
        val y = cursor.get(Calendar.YEAR); val m = cursor.get(Calendar.MONTH)

        // header com navegação
        val head = row()
        val prev = navBtn("‹"); prev.setOnClickListener { cursor.add(Calendar.MONTH, -1); render() }
        val next = navBtn("›"); next.setOnClickListener { cursor.add(Calendar.MONTH, 1); render() }
        val title = TextView(requireContext())
        title.text = "${MONTHS[m]} $y"; title.setTextColor(Color.WHITE); title.textSize = 17f
        title.gravity = Gravity.CENTER
        title.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        head.addView(prev); head.addView(title); head.addView(next)
        root.addView(head)

        // cabeçalho de dias da semana
        val wdRow = row()
        for (w in WD) {
            val t = TextView(requireContext()); t.text = w; t.gravity = Gravity.CENTER
            t.setTextColor(Color.parseColor("#6b7280")); t.textSize = 10f
            t.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            wdRow.addView(t)
        }
        root.addView(wdRow)

        val byDay = HashMap<String, MutableList<EventItem>>()
        for (e in visible()) e.date?.let { byDay.getOrPut(it) { mutableListOf() }.add(e) }

        val first = Calendar.getInstance(); first.set(y, m, 1, 0, 0, 0)
        val startBlanks = first.get(Calendar.DAY_OF_WEEK) - 1 // 0=Dom
        val dim = first.getActualMaximum(Calendar.DAY_OF_MONTH)

        var dayNum = 1
        var weekRow = row()
        var col = 0
        // blanks iniciais
        while (col < startBlanks) { weekRow.addView(emptyCell()); col++ }
        while (dayNum <= dim) {
            val ds = isoOf(y, m, dayNum)
            weekRow.addView(dayCell(dayNum, ds, byDay[ds] ?: emptyList()))
            col++
            if (col == 7) { root.addView(weekRow); weekRow = row(); col = 0 }
            dayNum++
        }
        if (col > 0) { while (col < 7) { weekRow.addView(emptyCell()); col++ }; root.addView(weekRow) }

        // painel do dia selecionado
        val list = (byDay[selDay] ?: emptyList()).sortedBy { it.start ?: "" }
        val ph = TextView(requireContext())
        ph.text = dayLabel(selDay) + " · " + list.size + (if (list.size == 1) " item" else " itens")
        ph.setTextColor(Color.WHITE); ph.textSize = 15f; ph.setPadding(0, dp(16), 0, dp(8))
        root.addView(ph)
        if (list.isEmpty()) root.addView(emptyText("Dia livre. Toque em ＋ Novo para agendar."))
        else for (e in list) root.addView(eventCard(e))
    }

    private fun dayCell(day: Int, ds: String, evs: List<EventItem>): LinearLayout {
        val cell = LinearLayout(requireContext()); cell.orientation = LinearLayout.VERTICAL
        cell.gravity = Gravity.CENTER_HORIZONTAL
        cell.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        cell.setPadding(0, dp(6), 0, dp(6))
        val isToday = ds == todayIso(); val isSel = ds == selDay
        if (isToday || isSel) {
            val bg = GradientDrawable(); bg.cornerRadius = dp(8).toFloat()
            bg.setColor(if (isToday) Color.parseColor("#1e2330") else Color.parseColor("#16181d"))
            if (isSel) { bg.setStroke(dp(1), Color.parseColor("#5b6cff")) }
            cell.background = bg
        }
        val num = TextView(requireContext()); num.text = day.toString()
        num.setTextColor(if (isToday) Color.parseColor("#5b6cff") else Color.WHITE)
        num.textSize = 13f; num.gravity = Gravity.CENTER
        cell.addView(num)
        // dots por tipo (até 4)
        val dots = row(); dots.gravity = Gravity.CENTER
        evs.sortedBy { it.start ?: "" }.take(4).forEach { e ->
            val d = View(requireContext())
            val lp = LinearLayout.LayoutParams(dp(5), dp(5)); lp.leftMargin = dp(1); lp.rightMargin = dp(1); lp.topMargin = dp(3)
            d.layoutParams = lp
            val cd = GradientDrawable(); cd.shape = GradientDrawable.OVAL; cd.setColor(Types.of(e.type).color)
            d.background = cd; dots.addView(d)
        }
        cell.addView(dots)
        cell.setOnClickListener { selDay = ds; render() }
        return cell
    }

    private fun emptyCell(): LinearLayout {
        val c = LinearLayout(requireContext())
        c.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        return c
    }

    // ---------- LISTA ----------
    private fun renderList(root: LinearLayout) {
        val evs = visible().sortedWith(compareBy({ it.date ?: "" }, { it.start ?: "" }))
        // stat strip
        val today = todayIso()
        val cal = Calendar.getInstance(); cal.add(Calendar.DAY_OF_MONTH, 7)
        val in7 = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
        val prox = events.count { (it.date ?: "") in today..in7 }
        val aberto = events.count { (it.date ?: "") >= today && !it.done }
        val strip = row()
        strip.addView(stat(prox.toString(), "Próx. 7 dias"))
        strip.addView(stat(aberto.toString(), "Em aberto"))
        strip.addView(stat(events.size.toString(), "Total"))
        root.addView(strip)

        if (evs.isEmpty()) { root.addView(emptyText("Agenda da equipe vazia. Crie o primeiro compromisso.")); return }

        var lastDate = ""
        for (e in evs) {
            val d = e.date ?: ""
            if (d != lastDate) {
                lastDate = d
                val g = TextView(requireContext())
                g.text = dayLabel(d); g.setTextColor(if (d == today) Color.parseColor("#5b6cff") else Color.parseColor("#9aa0ac"))
                g.textSize = 13f; g.setPadding(0, dp(16), 0, dp(8)); g.text = g.text.toString().uppercase()
                root.addView(g)
            }
            root.addView(eventCard(e))
        }
    }

    private fun stat(n: String, l: String): LinearLayout {
        val box = LinearLayout(requireContext()); box.orientation = LinearLayout.VERTICAL; box.gravity = Gravity.CENTER
        val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); lp.rightMargin = dp(8)
        box.layoutParams = lp
        box.setPadding(dp(10), dp(12), dp(10), dp(12))
        val bg = GradientDrawable(); bg.cornerRadius = dp(12).toFloat(); bg.setColor(Color.parseColor("#16181d")); box.background = bg
        val tn = TextView(requireContext()); tn.text = n; tn.setTextColor(Color.WHITE); tn.textSize = 20f; tn.gravity = Gravity.CENTER
        val tl = TextView(requireContext()); tl.text = l; tl.setTextColor(Color.parseColor("#9aa0ac")); tl.textSize = 11f; tl.gravity = Gravity.CENTER
        box.addView(tn); box.addView(tl); return box
    }

    // ---------- CARD ----------
    private fun eventCard(e: EventItem): View {
        val t = Types.of(e.type)
        val owner = e.ownerId?.let { users[it] }
        val ownerColor = UserColor.of(e.ownerId, owner?.color)
        val card = row(); card.gravity = Gravity.CENTER_VERTICAL
        val bg = GradientDrawable(); bg.cornerRadius = dp(12).toFloat(); bg.setColor(Color.parseColor("#16181d")); card.background = bg
        val clp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        clp.bottomMargin = dp(8); card.layoutParams = clp
        card.setPadding(0, 0, dp(12), 0)

        // barra de cor (responsável)
        val bar = View(requireContext())
        bar.layoutParams = LinearLayout.LayoutParams(dp(4), dp(56)); bar.setBackgroundColor(ownerColor)
        card.addView(bar)

        // horário
        val time = LinearLayout(requireContext()); time.orientation = LinearLayout.VERTICAL; time.gravity = Gravity.CENTER
        time.setPadding(dp(10), dp(10), dp(10), dp(10))
        val t1 = TextView(requireContext()); t1.text = e.start ?: "--:--"; t1.setTextColor(Color.WHITE); t1.textSize = 15f
        time.addView(t1)
        if (!e.end.isNullOrBlank()) { val t2 = TextView(requireContext()); t2.text = e.end; t2.setTextColor(Color.parseColor("#6b7280")); t2.textSize = 11f; time.addView(t2) }
        card.addView(time)

        // corpo
        val body = LinearLayout(requireContext()); body.orientation = LinearLayout.VERTICAL
        body.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        body.setPadding(0, dp(10), 0, dp(10))
        val tt = TextView(requireContext()); tt.text = e.title?.ifBlank { null } ?: e.client ?: "Sem título"
        tt.setTextColor(Color.WHITE); tt.textSize = 15f; if (e.done) tt.alpha = 0.6f
        body.addView(tt)

        val sub = TextView(requireContext())
        val parts = ArrayList<String>()
        parts.add(t.label)
        e.client?.ifBlank { null }?.let { parts.add(it) }
        e.location?.ifBlank { null }?.let { parts.add(it) }
        sub.text = parts.joinToString("  •  "); sub.setTextColor(t.color); sub.textSize = 12f; sub.setPadding(0, dp(3), 0, 0)
        body.addView(sub)

        val st = EventStatus.status(e)
        if (st != null) {
            val s = TextView(requireContext()); s.text = st.text; s.textSize = 12f
            s.setTextColor(if (st.late) Color.parseColor("#f87171") else if (st.kind == "done") Color.parseColor("#34d399") else Color.parseColor("#9aa0ac"))
            s.setPadding(0, dp(3), 0, 0); body.addView(s)
        }
        card.addView(body)

        // responsável (avatar de iniciais + 1º nome)
        if (owner != null || !e.owner.isNullOrBlank()) {
            val who = LinearLayout(requireContext()); who.orientation = LinearLayout.VERTICAL; who.gravity = Gravity.CENTER
            who.addView(avatar(owner?.name ?: e.owner, ownerColor))
            val nm = TextView(requireContext()); nm.text = UserColor.firstName(owner?.name ?: e.owner)
            nm.setTextColor(Color.parseColor("#9aa0ac")); nm.textSize = 10f; nm.gravity = Gravity.CENTER; nm.setPadding(0, dp(3), 0, 0)
            who.addView(nm); card.addView(who)
        }

        card.setOnClickListener {
            startActivity(Intent(requireContext(), EventDetailActivity::class.java).putExtra("id", e.id))
        }
        return card
    }

    private fun avatar(name: String?, color: Int): TextView {
        val tv = TextView(requireContext()); tv.text = UserColor.initials(name)
        tv.setTextColor(Color.WHITE); tv.textSize = 12f; tv.gravity = Gravity.CENTER
        tv.layoutParams = LinearLayout.LayoutParams(dp(34), dp(34))
        val bg = GradientDrawable(); bg.shape = GradientDrawable.OVAL; bg.setColor(color); tv.background = bg
        return tv
    }

    // ---------- utils ----------
    private fun row(): LinearLayout { val l = LinearLayout(requireContext()); l.orientation = LinearLayout.HORIZONTAL; l.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); return l }
    private fun navBtn(s: String): TextView { val t = TextView(requireContext()); t.text = s; t.setTextColor(Color.WHITE); t.textSize = 22f; t.setPadding(dp(16), 0, dp(16), 0); t.gravity = Gravity.CENTER; t.isClickable = true; return t }
    private fun emptyText(s: String): TextView { val t = TextView(requireContext()); t.text = s; t.setTextColor(Color.parseColor("#6b7280")); t.gravity = Gravity.CENTER; t.setPadding(0, dp(24), 0, dp(24)); return t }
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun todayIso(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
    private fun isoOf(y: Int, m: Int, d: Int): String { val c = Calendar.getInstance(); c.set(y, m, d, 0, 0, 0); return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.time) }
    private fun dayLabel(iso: String): String {
        val today = todayIso()
        if (iso == today) return "Hoje"
        val cal = Calendar.getInstance(); cal.add(Calendar.DAY_OF_MONTH, 1)
        if (iso == SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)) return "Amanhã"
        return try {
            val d = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(iso)
            SimpleDateFormat("EEE, dd/MM", Locale("pt", "BR")).format(d!!)
        } catch (_: Exception) { iso }
    }
}
