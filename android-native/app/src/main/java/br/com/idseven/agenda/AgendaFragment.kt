package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.SpannableString
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.ListenerRegistration
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Tela "Agenda" fiel ao PWA: topbar, "Mês AAAA" + Hoje/setas, switch Mês/Agenda,
// filtros por tipo, calendário mensal com painel do dia, e vista lista (stat-strip + grupos).
class AgendaFragment : Fragment() {

    private var evReg: ListenerRegistration? = null
    private var usReg: ListenerRegistration? = null
    private var events: List<EventItem> = emptyList()
    private var users: Map<String, UserLite> = emptyMap()
    private var myPhoto: String? = null
    private var myColor: String? = null

    private var filter = "all"
    private var view0 = "month"
    private val cursor = Calendar.getInstance()
    private var selDay = todayIso()

    private lateinit var root: LinearLayout

    private val MO = listOf("janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro")
    private val DWA = listOf("DOM","SEG","TER","QUA","QUI","SEX","SÁB")
    private val DWF = listOf("domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado")

    private val INK = Color.parseColor("#f1f2f4")
    private val SOFT = Color.parseColor("#9ba0ab")
    private val FAINT = Color.parseColor("#6e7480")
    private val SURFACE = Color.parseColor("#15171f")
    private val SURFACE2 = Color.parseColor("#1c1f29")
    private val LINE = Color.parseColor("#262a36")
    private val ACCENT = Color.parseColor("#5b6cff")
    private val GREEN = Color.parseColor("#34d399")
    private val AMBER = Color.parseColor("#f59e0b")
    private val REV = Color.parseColor("#f87171")

    override fun onCreateView(i: LayoutInflater, c: ViewGroup?, s: Bundle?): View {
        val scroll = ScrollView(requireContext())
        val pageBg = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.parseColor("#13131d"), Color.parseColor("#0a0b10"), Color.parseColor("#0a0b10")))
        scroll.background = pageBg; scroll.isFillViewport = true
        root = LinearLayout(requireContext()); root.orientation = LinearLayout.VERTICAL; root.setPadding(dp(16), dp(16), dp(16), dp(28))
        scroll.addView(root); return scroll
    }

    override fun onStart() {
        super.onStart()
        evReg = EventRepo.listen({ events = it; ui { render() } }, { })
        usReg = UsersRepo.listen { list ->
            users = list.associateBy { it.id }
            val me = list.firstOrNull { it.id == Session.uid(requireContext()) }
            if (me != null) { myPhoto = me.photo; myColor = me.color }
            ui { render() }
        }
    }
    override fun onStop() { super.onStop(); evReg?.remove(); usReg?.remove(); evReg = null; usReg = null }
    private fun ui(b: () -> Unit) { if (isAdded) requireActivity().runOnUiThread(b) }

    private fun visible(): List<EventItem> = events.filter { filter == "all" || it.type == filter }

    private fun render() {
        if (!isAdded) return
        root.removeAllViews()
        root.addView(Topbar.build(this, myPhoto, myColor))
        root.addView(monthRow())
        root.addView(switchView())
        root.addView(filters())
        if (view0 == "month") renderMonth() else renderAgenda()
    }

    // ---------- Cabeçalho de mês + navegação ----------
    private fun monthRow(): View {
        val row = LinearLayout(requireContext()); row.orientation = LinearLayout.HORIZONTAL; row.gravity = Gravity.BOTTOM
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(4); row.layoutParams = lp

        val m = cursor.get(Calendar.MONTH); val y = cursor.get(Calendar.YEAR)
        val monthCap = MO[m].replaceFirstChar { it.uppercase() }
        val full = "$monthCap $y"
        val sb = SpannableString(full); sb.setSpan(ForegroundColorSpan(FAINT), monthCap.length + 1, full.length, 0)
        val title = TextView(requireContext()); title.text = sb; title.setTextColor(INK); title.textSize = 28f
        title.setTypeface(title.typeface, Typeface.BOLD); title.letterSpacing = -0.035f
        title.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        row.addView(title)

        val hoje = TextView(requireContext()); hoje.text = "Hoje"; hoje.setTextColor(SOFT); hoje.textSize = 12f
        hoje.setPadding(dp(14), dp(9), dp(14), dp(9))
        val hb = GradientDrawable(); hb.cornerRadius = dp(999).toFloat(); hb.setColor(SURFACE); hb.setStroke(dp(1), LINE); hoje.background = hb
        hoje.isClickable = true; hoje.setOnClickListener { cursor.time = Calendar.getInstance().time; selDay = todayIso(); render() }
        val hlp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); hlp.rightMargin = dp(8); hoje.layoutParams = hlp
        row.addView(hoje)

        val arrows = LinearLayout(requireContext()); arrows.orientation = LinearLayout.HORIZONTAL
        val ab = GradientDrawable(); ab.cornerRadius = dp(999).toFloat(); ab.setColor(SURFACE); ab.setStroke(dp(1), LINE); arrows.background = ab
        val prev = navBtn("‹"); prev.setOnClickListener { cursor.add(Calendar.MONTH, -1); render() }
        val div = View(requireContext()); div.layoutParams = LinearLayout.LayoutParams(dp(1), dp(22)); div.setBackgroundColor(LINE)
        val next = navBtn("›"); next.setOnClickListener { cursor.add(Calendar.MONTH, 1); render() }
        arrows.addView(prev); arrows.addView(div); arrows.addView(next)
        row.addView(arrows)
        return row
    }

    private fun navBtn(s: String): TextView {
        val t = TextView(requireContext()); t.text = s; t.setTextColor(SOFT); t.textSize = 18f; t.gravity = Gravity.CENTER
        t.layoutParams = LinearLayout.LayoutParams(dp(38), dp(34)); t.isClickable = true; return t
    }

    private fun switchView(): View {
        val box = LinearLayout(requireContext()); box.orientation = LinearLayout.HORIZONTAL
        val bg = GradientDrawable(); bg.cornerRadius = dp(13).toFloat(); bg.setColor(SURFACE); bg.setStroke(dp(1), LINE); box.background = bg
        box.setPadding(dp(5), dp(5), dp(5), dp(5))
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(16); box.layoutParams = lp
        box.addView(segBtn("Mês", view0 == "month") { view0 = "month"; render() })
        box.addView(segBtn("Agenda", view0 == "agenda") { view0 = "agenda"; render() })
        return box
    }
    private fun segBtn(label: String, on: Boolean, onClick: () -> Unit): TextView {
        val t = TextView(requireContext()); t.text = label; t.gravity = Gravity.CENTER; t.textSize = 12.5f
        t.setTextColor(if (on) INK else SOFT); t.setTypeface(t.typeface, if (on) Typeface.BOLD else Typeface.NORMAL)
        t.setPadding(0, dp(9), 0, dp(9))
        if (on) { val g = GradientDrawable(); g.cornerRadius = dp(9).toFloat(); g.setColor(SURFACE2); g.setStroke(dp(1), LINE); t.background = g }
        t.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        t.isClickable = true; t.setOnClickListener { onClick() }; return t
    }

    private fun filters(): View {
        val hs = HorizontalScrollView(requireContext()); hs.isHorizontalScrollBarEnabled = false; hs.overScrollMode = View.OVER_SCROLL_NEVER
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(14); lp.bottomMargin = dp(6); hs.layoutParams = lp
        val rowc = LinearLayout(requireContext()); rowc.orientation = LinearLayout.HORIZONTAL
        rowc.addView(chip("Todos", "all", null))
        for (t in Types.ALL) rowc.addView(chip(t.label, t.key, t.color))
        hs.addView(rowc); return hs
    }
    private fun chip(label: String, key: String, color: Int?): View {
        val on = filter == key
        val box = LinearLayout(requireContext()); box.orientation = LinearLayout.HORIZONTAL; box.gravity = Gravity.CENTER_VERTICAL
        box.setPadding(dp(14), dp(8), dp(14), dp(8))
        val bg = GradientDrawable(); bg.cornerRadius = dp(999).toFloat()
        if (on) { bg.setColor(ACCENT) } else { bg.setColor(SURFACE); bg.setStroke(dp(1), LINE) }
        box.background = bg
        if (color != null) {
            val d = View(requireContext()); val dlp = LinearLayout.LayoutParams(dp(7), dp(7)); dlp.rightMargin = dp(7); d.layoutParams = dlp
            val dg = GradientDrawable(); dg.shape = GradientDrawable.OVAL; dg.setColor(if (on) Color.WHITE else color); d.background = dg; box.addView(d)
        }
        val t = TextView(requireContext()); t.text = label; t.textSize = 12f
        t.setTextColor(if (on) Color.WHITE else SOFT); t.setTypeface(t.typeface, if (on) Typeface.BOLD else Typeface.NORMAL); box.addView(t)
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.rightMargin = dp(6); box.layoutParams = lp
        box.isClickable = true; box.setOnClickListener { filter = key; render() }
        return box
    }

    // ---------- Vista MÊS ----------
    private fun renderMonth() {
        val y = cursor.get(Calendar.YEAR); val m = cursor.get(Calendar.MONTH)
        val by = HashMap<String, MutableList<EventItem>>()
        for (e in visible()) e.date?.let { by.getOrPut(it) { mutableListOf() }.add(e) }

        val head = row(); head.layoutParams = marginLp(dp(8), dp(8))
        for (w in DWA) {
            val t = TextView(requireContext()); t.text = w; t.gravity = Gravity.CENTER; t.setTextColor(FAINT); t.textSize = 10f
            t.setTypeface(t.typeface, Typeface.BOLD); t.letterSpacing = 0.04f
            t.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); head.addView(t)
        }
        root.addView(head)

        val first = Calendar.getInstance(); first.set(y, m, 1, 0, 0, 0)
        val sd = first.get(Calendar.DAY_OF_WEEK) - 1
        val dn = first.getActualMaximum(Calendar.DAY_OF_MONTH)
        val prevMax = (first.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, -1) }.get(Calendar.DAY_OF_MONTH)

        var week = weekRow(); var col = 0
        for (i in 0 until sd) { week.addView(dimCell(prevMax - sd + i + 1)); col++ }
        for (d in 1..dn) {
            val ds = isoOf(y, m, d)
            week.addView(dayCell(d, ds, (by[ds] ?: emptyList()).sortedBy { it.start ?: "" }))
            col++; if (col == 7) { root.addView(week); week = weekRow(); col = 0 }
        }
        var tail = 1
        while (col in 1..6) { week.addView(dimCell(tail)); tail++; col++ }
        if (week.childCount > 0) root.addView(week)

        // Painel do dia selecionado
        val list = (by[selDay] ?: emptyList()).sortedBy { it.start ?: "" }
        val dph = LinearLayout(requireContext()); dph.orientation = LinearLayout.HORIZONTAL; dph.gravity = Gravity.CENTER_VERTICAL
        dph.layoutParams = marginLp(dp(28), dp(14))
        val h3 = TextView(requireContext()); h3.text = capitalize(dayLabel(selDay)) + " · " + dayShort(selDay)
        h3.setTextColor(INK); h3.textSize = 17f; h3.setTypeface(h3.typeface, Typeface.BOLD); h3.letterSpacing = -0.022f
        h3.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); dph.addView(h3)
        val cnt = TextView(requireContext()); cnt.text = list.size.toString() + (if (list.size == 1) " item" else " itens")
        cnt.setTextColor(FAINT); cnt.textSize = 11.5f; cnt.setPadding(dp(10), dp(4), dp(10), dp(4))
        val cb = GradientDrawable(); cb.cornerRadius = dp(999).toFloat(); cb.setColor(SURFACE); cb.setStroke(dp(1), LINE); cnt.background = cb
        dph.addView(cnt)
        root.addView(dph)

        if (list.isEmpty()) root.addView(emptyState("Dia livre", "Toque em “Novo” para agendar"))
        else for (e in list) root.addView(eventCard(e))
    }

    private fun weekRow(): LinearLayout { val l = row(); (l.layoutParams as LinearLayout.LayoutParams).bottomMargin = dp(6); return l }

    private fun dimCell(day: Int): View {
        val cell = cellBase()
        val num = TextView(requireContext()); num.text = day.toString(); num.setTextColor(SOFT); num.textSize = 13.5f
        num.setTypeface(num.typeface, Typeface.BOLD); num.gravity = Gravity.CENTER; num.alpha = 0.35f
        cell.addView(num); return cell
    }

    private fun dayCell(day: Int, ds: String, evs: List<EventItem>): View {
        val isToday = ds == todayIso(); val isSel = ds == selDay
        val cell = cellBase()
        val bg = GradientDrawable(); bg.cornerRadius = dp(12).toFloat()
        if (isToday) { bg.setColor(ACCENT) } else { bg.setColor(SURFACE); if (isSel) bg.setStroke(dp(2), INK) else bg.setStroke(dp(1), LINE) }
        cell.background = bg
        val num = TextView(requireContext()); num.text = day.toString(); num.gravity = Gravity.CENTER; num.textSize = 13.5f
        num.setTextColor(if (isToday) Color.WHITE else SOFT); num.setTypeface(num.typeface, Typeface.BOLD)
        cell.addView(num)
        val dots = row(); dots.gravity = Gravity.CENTER; (dots.layoutParams as LinearLayout.LayoutParams).topMargin = dp(5)
        evs.take(4).forEach { e ->
            val d = View(requireContext()); val lp = LinearLayout.LayoutParams(dp(5), dp(5)); lp.leftMargin = dp(1); lp.rightMargin = dp(1); d.layoutParams = lp
            val cd = GradientDrawable(); cd.shape = GradientDrawable.OVAL; cd.setColor(if (isToday) Color.WHITE else Types.of(e.type).color); d.background = cd; dots.addView(d)
        }
        cell.addView(dots)
        if (evs.size > 4) {
            val more = TextView(requireContext()); more.text = "+" + (evs.size - 4); more.textSize = 8.5f
            more.setTextColor(if (isToday) Color.WHITE else FAINT); more.setTypeface(more.typeface, Typeface.BOLD); more.gravity = Gravity.CENTER
            cell.addView(more)
        }
        cell.isClickable = true; cell.setOnClickListener { selDay = ds; render() }
        return cell
    }

    private fun cellBase(): LinearLayout {
        val cell = LinearLayout(requireContext()); cell.orientation = LinearLayout.VERTICAL; cell.gravity = Gravity.CENTER
        val lp = LinearLayout.LayoutParams(0, dp(50), 1f); lp.leftMargin = dp(3); lp.rightMargin = dp(3); cell.layoutParams = lp
        return cell
    }

    // ---------- Vista AGENDA (lista) ----------
    private fun renderAgenda() {
        val evs = visible().sortedWith(compareBy({ it.date ?: "" }, { it.start ?: "" }))
        val today = todayIso()
        val in7c = Calendar.getInstance(); in7c.add(Calendar.DAY_OF_MONTH, 7)
        val in7 = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(in7c.time)
        val wk = events.count { val d = it.date ?: ""; d.isNotEmpty() && d >= today && d <= in7 }
        val up = events.count { (it.date ?: "") >= today && !it.done }

        val strip = LinearLayout(requireContext()); strip.orientation = LinearLayout.HORIZONTAL; strip.layoutParams = marginLp(dp(18), 0)
        strip.addView(stat(wk.toString(), "Próx. 7 dias", true))
        strip.addView(stat(up.toString(), "Em aberto", false))
        strip.addView(stat(events.size.toString(), "Total", false))
        root.addView(strip)

        if (evs.isEmpty()) { root.addView(emptyState("Agenda da equipe vazia", "Crie o primeiro compromisso")); return }

        val g = LinkedHashMap<String, MutableList<EventItem>>()
        for (e in evs) g.getOrPut(e.date ?: "") { mutableListOf() }.add(e)
        for ((d, items) in g) {
            val isT = d == today
            val gl = LinearLayout(requireContext()); gl.orientation = LinearLayout.HORIZONTAL; gl.gravity = Gravity.CENTER_VERTICAL
            gl.layoutParams = marginLp(dp(26), dp(14))
            if (isT) {
                val dotv = View(requireContext()); val dlp = LinearLayout.LayoutParams(dp(6), dp(6)); dlp.rightMargin = dp(8); dotv.layoutParams = dlp
                val dg = GradientDrawable(); dg.shape = GradientDrawable.OVAL; dg.setColor(ACCENT); dotv.background = dg; gl.addView(dotv)
            }
            val dl = TextView(requireContext()); dl.text = capitalize(dayLabel(d)); dl.setTextColor(if (isT) ACCENT else INK); dl.textSize = 13.5f
            dl.setTypeface(dl.typeface, Typeface.BOLD); dl.letterSpacing = -0.012f; gl.addView(dl)
            val dd = TextView(requireContext()); dd.text = "  " + dayShort(d); dd.setTextColor(FAINT); dd.textSize = 11f; gl.addView(dd)
            val ln = View(requireContext()); val llp = LinearLayout.LayoutParams(0, dp(1), 1f); llp.leftMargin = dp(12); ln.layoutParams = llp; ln.setBackgroundColor(LINE); gl.addView(ln)
            root.addView(gl)
            for (e in items) root.addView(eventCard(e))
        }
    }

    private fun stat(n: String, l: String, acc: Boolean): View {
        val box = LinearLayout(requireContext()); box.orientation = LinearLayout.VERTICAL
        val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); lp.rightMargin = dp(10); box.layoutParams = lp
        box.setPadding(dp(16), dp(14), dp(16), dp(14))
        if (acc) {
            val g = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Color.parseColor("#7a87ff"), Color.parseColor("#4452e6")))
            g.cornerRadius = dp(16).toFloat(); box.background = g
        } else { val g = GradientDrawable(); g.cornerRadius = dp(16).toFloat(); g.setColor(SURFACE); g.setStroke(dp(1), LINE); box.background = g }
        val tn = TextView(requireContext()); tn.text = n; tn.setTextColor(if (acc) Color.WHITE else INK); tn.textSize = 26f
        tn.setTypeface(tn.typeface, Typeface.BOLD); tn.letterSpacing = -0.035f; box.addView(tn)
        val tl = TextView(requireContext()); tl.text = l.uppercase(); tl.setTextColor(if (acc) Color.parseColor("#e7eaff") else FAINT); tl.textSize = 10f
        tl.setTypeface(tl.typeface, Typeface.BOLD); tl.letterSpacing = 0.08f; tl.setPadding(0, dp(6), 0, 0); box.addView(tl)
        return box
    }

    // ---------- Card de evento ----------
    private fun eventCard(e: EventItem): View {
        val ty = Types.of(e.type)
        val owner = e.ownerId?.let { users[it] }
        val ownerColor = UserColor.of(e.ownerId, owner?.color)
        val ownerName = owner?.name ?: e.owner
        val late = EventStatus.isLate(e)

        val card = LinearLayout(requireContext()); card.orientation = LinearLayout.HORIZONTAL
        val bg = GradientDrawable(); bg.cornerRadius = dp(16).toFloat(); bg.setColor(SURFACE)
        bg.setStroke(dp(if (late) 2 else 1), if (late) withAlpha(REV, 0.55f) else withAlpha(ownerColor, 0.5f))
        card.background = bg
        val clp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); clp.bottomMargin = dp(12); card.layoutParams = clp
        card.setPadding(dp(14), dp(14), dp(16), dp(16))
        if (e.done) card.alpha = 0.55f

        // barra lateral na cor do usuário
        val bar = View(requireContext()); val barLp = LinearLayout.LayoutParams(dp(4), LinearLayout.LayoutParams.MATCH_PARENT); barLp.rightMargin = dp(14)
        bar.layoutParams = barLp; val barBg = GradientDrawable(); barBg.cornerRadius = dp(3).toFloat(); barBg.setColor(ownerColor); bar.background = barBg
        card.addView(bar)

        val body = LinearLayout(requireContext()); body.orientation = LinearLayout.VERTICAL
        body.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)

        // cabeçalho: avatar (topo-esquerda) + título/responsável + horário
        val head = LinearLayout(requireContext()); head.orientation = LinearLayout.HORIZONTAL; head.gravity = Gravity.CENTER_VERTICAL
        head.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        if (!ownerName.isNullOrBlank()) {
            val av = Topbar.avatar(this, owner?.photo, ownerColor, ownerName, dp(40), dp(2))
            (av.layoutParams as LinearLayout.LayoutParams).rightMargin = dp(12); head.addView(av)
        }
        val titleCol = LinearLayout(requireContext()); titleCol.orientation = LinearLayout.VERTICAL
        titleCol.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        val tt = TextView(requireContext()); tt.text = e.title?.ifBlank { null } ?: e.client ?: "Sem título"
        tt.setTextColor(INK); tt.textSize = 17f; tt.setTypeface(tt.typeface, Typeface.BOLD); tt.letterSpacing = -0.02f; tt.maxLines = 2; tt.ellipsize = android.text.TextUtils.TruncateAt.END
        if (e.done) tt.paintFlags = tt.paintFlags or android.graphics.Paint.STRIKE_THRU_TEXT_FLAG
        titleCol.addView(tt)
        if (!ownerName.isNullOrBlank()) {
            val nm = TextView(requireContext()); nm.text = UserColor.firstName(ownerName); nm.setTextColor(ownerColor); nm.textSize = 12.5f; nm.setTypeface(nm.typeface, Typeface.BOLD)
            nm.setPadding(0, dp(3), 0, 0); titleCol.addView(nm)
        }
        head.addView(titleCol)
        val timeCol = LinearLayout(requireContext()); timeCol.orientation = LinearLayout.VERTICAL; timeCol.gravity = Gravity.END
        val tlp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); tlp.leftMargin = dp(10); timeCol.layoutParams = tlp
        val t1 = TextView(requireContext()); t1.text = e.start ?: "--:--"; t1.setTextColor(INK); t1.textSize = 16.5f; t1.setTypeface(t1.typeface, Typeface.BOLD); t1.letterSpacing = -0.025f; timeCol.addView(t1)
        if (!e.end.isNullOrBlank()) { val t2 = TextView(requireContext()); t2.text = e.end; t2.setTextColor(FAINT); t2.textSize = 12f; t2.gravity = Gravity.END; t2.setPadding(0, dp(2), 0, 0); timeCol.addView(t2) }
        head.addView(timeCol)
        body.addView(head)

        // tag do tipo
        val tag = TextView(requireContext()); tag.text = ty.label.uppercase(); tag.setTextColor(ty.color); tag.textSize = 10.5f
        tag.setTypeface(tag.typeface, Typeface.BOLD); tag.letterSpacing = 0.03f; tag.setPadding(dp(10), dp(4), dp(10), dp(4))
        val tagBg = GradientDrawable(); tagBg.cornerRadius = dp(7).toFloat(); tagBg.setColor(withAlpha(ty.color, 0.16f)); tag.background = tagBg
        val taglp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); taglp.topMargin = dp(13); tag.layoutParams = taglp; body.addView(tag)

        // cliente e local empilhados à esquerda
        e.client?.ifBlank { null }?.let { body.addView(infoLine(R.drawable.ic_person, it, SOFT, 11)) }
        e.location?.ifBlank { null }?.let { body.addView(infoLine(R.drawable.ic_pin, it, SOFT, 7)) }

        // situação
        val si = EventStatus.status(e)
        if (si != null) {
            val col = when (si.kind) { "done", "wait" -> GREEN; "run" -> AMBER; "late" -> REV; else -> SOFT }
            val icon = if (si.kind == "done") R.drawable.ic_check else R.drawable.ic_clock
            body.addView(statusChip(icon, si.text, col))
        }

        card.addView(body)
        card.isClickable = true
        card.setOnClickListener { startActivity(Intent(requireContext(), EventDetailActivity::class.java).putExtra("id", e.id)) }
        return card
    }

    private fun infoLine(iconRes: Int, text: String, tint: Int, topMargin: Int): View {
        val row = LinearLayout(requireContext()); row.orientation = LinearLayout.HORIZONTAL; row.gravity = Gravity.CENTER_VERTICAL
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(topMargin); row.layoutParams = lp
        val iv = android.widget.ImageView(requireContext()); iv.setImageResource(iconRes); iv.setColorFilter(tint)
        val ilp = LinearLayout.LayoutParams(dp(16), dp(16)); ilp.rightMargin = dp(9); iv.layoutParams = ilp; row.addView(iv)
        val t = TextView(requireContext()); t.text = text; t.setTextColor(INK); t.textSize = 13.5f; t.maxLines = 1; t.ellipsize = android.text.TextUtils.TruncateAt.END; row.addView(t)
        return row
    }

    private fun statusChip(iconRes: Int, text: String, col: Int): View {
        val chip = LinearLayout(requireContext()); chip.orientation = LinearLayout.HORIZONTAL; chip.gravity = Gravity.CENTER_VERTICAL
        chip.setPadding(dp(9), dp(5), dp(11), dp(5))
        val cbg = GradientDrawable(); cbg.cornerRadius = dp(8).toFloat(); cbg.setColor(withAlpha(col, 0.12f)); chip.background = cbg
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(11); chip.layoutParams = lp
        val iv = android.widget.ImageView(requireContext()); iv.setImageResource(iconRes); iv.setColorFilter(col)
        val ilp = LinearLayout.LayoutParams(dp(15), dp(15)); ilp.rightMargin = dp(7); iv.layoutParams = ilp; chip.addView(iv)
        val t = TextView(requireContext()); t.text = text; t.setTextColor(col); t.textSize = 12.5f; t.setTypeface(t.typeface, Typeface.BOLD); chip.addView(t)
        return chip
    }

    private fun emptyState(title: String, sub: String): View {
        val box = LinearLayout(requireContext()); box.orientation = LinearLayout.VERTICAL; box.gravity = Gravity.CENTER
        box.setPadding(dp(20), dp(50), dp(20), dp(50))
        val icBox = FrameLayout(requireContext()); icBox.layoutParams = LinearLayout.LayoutParams(dp(64), dp(64))
        val ig = GradientDrawable(); ig.cornerRadius = dp(18).toFloat(); ig.setColor(SURFACE); ig.setStroke(dp(1), LINE); icBox.background = ig
        val iv = android.widget.ImageView(requireContext()); iv.setImageResource(R.drawable.ic_cal_empty); iv.setColorFilter(FAINT); iv.alpha = 0.7f
        val ilp = FrameLayout.LayoutParams(dp(26), dp(26)); ilp.gravity = Gravity.CENTER; iv.layoutParams = ilp
        icBox.addView(iv)
        box.addView(icBox)
        val p = TextView(requireContext()); p.text = title; p.setTextColor(SOFT); p.textSize = 15f; p.setTypeface(p.typeface, Typeface.BOLD); p.gravity = Gravity.CENTER; p.setPadding(0, dp(16), 0, 0); box.addView(p)
        val s = TextView(requireContext()); s.text = sub; s.setTextColor(FAINT); s.textSize = 12.5f; s.gravity = Gravity.CENTER; s.setPadding(0, dp(6), 0, 0); box.addView(s)
        return box
    }

    // ---------- utils ----------
    private fun row(): LinearLayout { val l = LinearLayout(requireContext()); l.orientation = LinearLayout.HORIZONTAL; l.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); return l }
    private fun marginLp(top: Int, bottom: Int): LinearLayout.LayoutParams { val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = top; lp.bottomMargin = bottom; return lp }
    private fun withAlpha(color: Int, a: Float): Int = Color.argb((a * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    private fun capitalize(s: String): String = s.replaceFirstChar { it.uppercase() }

    private fun todayIso(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
    private fun isoOf(y: Int, m: Int, d: Int): String { val c = Calendar.getInstance(); c.set(y, m, d, 0, 0, 0); return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.time) }
    private fun dayShort(iso: String): String = try {
        val d = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(iso)!!; val c = Calendar.getInstance(); c.time = d
        "${c.get(Calendar.DAY_OF_MONTH)} de ${MO[c.get(Calendar.MONTH)]}"
    } catch (_: Exception) { iso }
    private fun dayLabel(iso: String): String {
        val today = todayIso()
        if (iso == today) return "Hoje"
        val tmr = Calendar.getInstance(); tmr.add(Calendar.DAY_OF_MONTH, 1)
        if (iso == SimpleDateFormat("yyyy-MM-dd", Locale.US).format(tmr.time)) return "Amanhã"
        val ytd = Calendar.getInstance(); ytd.add(Calendar.DAY_OF_MONTH, -1)
        if (iso == SimpleDateFormat("yyyy-MM-dd", Locale.US).format(ytd.time)) return "Ontem"
        return try {
            val d = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(iso)!!; val c = Calendar.getInstance(); c.time = d
            DWF[c.get(Calendar.DAY_OF_WEEK) - 1]
        } catch (_: Exception) { iso }
    }
}
