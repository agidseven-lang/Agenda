package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.ListenerRegistration
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar

// Tela "Hoje" fiel ao PWA: topbar (logo + ID Seven + sincronizado + sino/engrenagem/avatar),
// título grande "Hoje", hero de saudação e cards de foco (cliente-accent, badges, ações).
class HojeFragment : Fragment() {

    private var evReg: ListenerRegistration? = null
    private var tkReg: ListenerRegistration? = null
    private var usReg: ListenerRegistration? = null
    private var events: List<EventItem> = emptyList()
    private var tasks: List<TaskItem> = emptyList()
    private var myPhoto: String? = null
    private var myColor: String? = null
    private val snoozed = HashSet<String>()
    private lateinit var root: LinearLayout

    private val MO = listOf("janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro")
    private val DWA = listOf("DOM","SEG","TER","QUA","QUI","SEX","SÁB")

    private val INK = Color.parseColor("#f1f2f4")
    private val SOFT = Color.parseColor("#9ba0ab")
    private val FAINT = Color.parseColor("#6e7480")
    private val SURFACE = Color.parseColor("#15171f")
    private val SURFACE2 = Color.parseColor("#1c1f29")
    private val LINE = Color.parseColor("#262a36")
    private val ACCENT = Color.parseColor("#5b6cff")
    private val GREEN = Color.parseColor("#34d399")
    private val REV = Color.parseColor("#f87171")

    override fun onCreateView(i: LayoutInflater, c: ViewGroup?, s: Bundle?): View {
        val scroll = ScrollView(requireContext())
        val pageBg = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(Color.parseColor("#13131d"), Color.parseColor("#0a0b10"), Color.parseColor("#0a0b10")))
        scroll.background = pageBg
        scroll.isFillViewport = true
        root = LinearLayout(requireContext()); root.orientation = LinearLayout.VERTICAL; root.setPadding(dp(16), dp(16), dp(16), dp(28))
        scroll.addView(root); return scroll
    }

    override fun onStart() {
        super.onStart()
        evReg = EventRepo.listen({ events = it; ui { render() } }, { })
        tkReg = TasksRepo.listen { tasks = it; ui { render() } }
        usReg = UsersRepo.listen { list ->
            val me = list.firstOrNull { it.id == myUid() }
            if (me != null) { myPhoto = me.photo; myColor = me.color }
            ui { render() }
        }
    }
    override fun onStop() {
        super.onStop()
        evReg?.remove(); tkReg?.remove(); usReg?.remove(); evReg = null; tkReg = null; usReg = null
    }
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
        val s0 = c.timeInMillis; return s0 to (s0 + 86400000L)
    }

    private data class Focus(val kind: String, val task: TaskItem?, val event: EventItem?, val urgency: String)

    private fun pickFocus(): List<Focus> {
        val (t0, t1) = todayBounds()
        val out = ArrayList<Focus>()
        val mine = tasks.filter { isMyTask(it) && it.status != "concluido" && !snoozed.contains(it.id) }
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
        root.addView(header())
        root.addView(pageTitle())
        root.addView(hero())

        val focus = pickFocus()
        if (focus.isEmpty()) { root.addView(emptyCard()); return }
        root.addView(sectionLabel("Próxima ação"))
        root.addView(focusCard(focus[0], true))
        if (focus.size > 1) {
            root.addView(sectionLabel("Depois disso"))
            for (i in 1 until focus.size) root.addView(focusCard(focus[i], false))
        }
    }

    // ---- Topbar (presente no PWA em todas as telas) ----
    private fun header(): View {
        val row = LinearLayout(requireContext()); row.orientation = LinearLayout.HORIZONTAL; row.gravity = Gravity.CENTER_VERTICAL
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(4); lp.bottomMargin = dp(18); row.layoutParams = lp

        row.addView(logoBadge())

        val brand = LinearLayout(requireContext()); brand.orientation = LinearLayout.VERTICAL
        val blp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); blp.leftMargin = dp(11); blp.rightMargin = dp(8); brand.layoutParams = blp
        val name = TextView(requireContext()); name.text = "ID Seven"; name.setTextColor(ACCENT); name.textSize = 15.5f
        name.setTypeface(name.typeface, android.graphics.Typeface.BOLD); name.letterSpacing = -0.01f; brand.addView(name)
        val sub = TextView(requireContext()); sub.text = "Agenda e Gestor de Tarefas"; sub.setTextColor(SOFT); sub.textSize = 10.5f; brand.addView(sub)
        val sync = LinearLayout(requireContext()); sync.orientation = LinearLayout.HORIZONTAL; sync.gravity = Gravity.CENTER_VERTICAL; sync.setPadding(0, dp(3), 0, 0)
        val dot = View(requireContext()); val dlp = LinearLayout.LayoutParams(dp(7), dp(7)); dlp.rightMargin = dp(6); dot.layoutParams = dlp
        val dg = GradientDrawable(); dg.shape = GradientDrawable.OVAL; dg.setColor(GREEN); dot.background = dg; sync.addView(dot)
        val st = TextView(requireContext()); st.text = "sincronizado"; st.setTextColor(SOFT); st.textSize = 10.5f; sync.addView(st)
        brand.addView(sync)
        row.addView(brand)

        row.addView(iconCircle(R.drawable.ic_bell))
        row.addView(iconCircle(R.drawable.ic_gear))
        row.addView(avatarView())
        return row
    }

    private fun logoBadge(): View {
        val box = FrameLayout(requireContext())
        val ring = GradientDrawable(GradientDrawable.Orientation.TL_BR,
            intArrayOf(Color.parseColor("#22d3ee"), Color.parseColor("#5b6cff"), Color.parseColor("#f472b6")))
        ring.cornerRadius = dp(14).toFloat(); box.background = ring; box.setPadding(dp(2), dp(2), dp(2), dp(2))
        box.layoutParams = LinearLayout.LayoutParams(dp(46), dp(46))
        val img = ImageView(requireContext()); img.setImageResource(R.drawable.logo); img.scaleType = ImageView.ScaleType.CENTER_CROP
        val ibg = GradientDrawable(); ibg.cornerRadius = dp(12).toFloat(); ibg.setColor(Color.parseColor("#0c0d12")); img.background = ibg
        img.layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        roundClip(img, dp(12))
        box.addView(img)
        return box
    }

    private fun iconCircle(res: Int): View {
        val box = FrameLayout(requireContext())
        val bg = GradientDrawable(); bg.shape = GradientDrawable.OVAL; bg.setColor(Color.parseColor("#171922")); bg.setStroke(dp(1), LINE)
        box.background = bg
        val lp = LinearLayout.LayoutParams(dp(40), dp(40)); lp.leftMargin = dp(8); box.layoutParams = lp
        val img = ImageView(requireContext()); img.setImageResource(res); img.setColorFilter(SOFT)
        val ilp = FrameLayout.LayoutParams(dp(19), dp(19)); ilp.gravity = Gravity.CENTER; img.layoutParams = ilp
        box.addView(img)
        return box
    }

    private fun avatarView(): View {
        val size = dp(44)
        val box = FrameLayout(requireContext())
        val ring = GradientDrawable(); ring.shape = GradientDrawable.OVAL; ring.setColor(UserColor.of(myUid(), myColor)); box.background = ring
        box.setPadding(dp(2), dp(2), dp(2), dp(2))
        val lp = LinearLayout.LayoutParams(size, size); lp.leftMargin = dp(8); box.layoutParams = lp
        val img = ImageView(requireContext()); img.scaleType = ImageView.ScaleType.CENTER_CROP
        img.layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        box.addView(img)
        loadAvatar(img, myPhoto, dp(40))
        return box
    }

    private fun pageTitle(): View {
        val t = TextView(requireContext()); t.text = "Hoje"; t.setTextColor(INK); t.textSize = 34f
        t.setTypeface(t.typeface, android.graphics.Typeface.BOLD); t.letterSpacing = -0.03f
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.topMargin = dp(2); lp.bottomMargin = dp(16); t.layoutParams = lp
        return t
    }

    private fun hero(): View {
        val card = LinearLayout(requireContext()); card.orientation = LinearLayout.VERTICAL
        card.background = heroBg(); card.setPadding(dp(22), dp(24), dp(22), dp(22))
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.bottomMargin = dp(20); card.layoutParams = lp

        val first = UserColor.firstName(Session.name(requireContext()))
        val greet = TextView(requireContext()); greet.text = saudacao() + (if (first.isNotEmpty()) ", $first 👋" else " 👋")
        greet.setTextColor(INK); greet.textSize = 22f; greet.letterSpacing = -0.025f; greet.setTypeface(greet.typeface, android.graphics.Typeface.BOLD); card.addView(greet)

        val cal = Calendar.getInstance()
        val date = TextView(requireContext())
        date.text = DWA[cal.get(Calendar.DAY_OF_WEEK) - 1] + ", " + cal.get(Calendar.DAY_OF_MONTH) + " DE " + MO[cal.get(Calendar.MONTH)].uppercase()
        date.setTextColor(FAINT); date.textSize = 10.5f; date.setTypeface(date.typeface, android.graphics.Typeface.BOLD); date.letterSpacing = 0.1f; date.setPadding(0, dp(8), 0, 0); card.addView(date)

        val openMine = tasks.count { isMyTask(it) && it.status != "concluido" }
        val lateMine = tasks.count { isMyTask(it) && it.isLate() }
        val (t0, t1) = todayBounds()
        val evToday = events.count { !it.done && it.date != null && (EventStatus.dtMs(it.date, it.start ?: "00:00")?.let { ms -> ms in t0 until t1 } == true) && isMyEvent(it) }
        val parts = ArrayList<String>()
        if (openMine > 0) parts.add("$openMine tarefa${if (openMine != 1) "s" else ""} em aberto")
        if (lateMine > 0) parts.add("$lateMine atrasada${if (lateMine != 1) "s" else ""}")
        if (evToday > 0) parts.add("$evToday compromisso${if (evToday != 1) "s" else ""} hoje")
        if (parts.isEmpty()) parts.add("Tudo em dia")
        val stats = TextView(requireContext()); stats.text = parts.joinToString("   ·   "); stats.setTextColor(SOFT); stats.textSize = 13.5f
        stats.setPadding(0, dp(14), 0, 0); card.addView(stats)
        return card
    }

    private fun sectionLabel(s: String): TextView {
        val t = TextView(requireContext()); t.text = s.uppercase(); t.setTextColor(FAINT); t.textSize = 10.5f
        t.setTypeface(t.typeface, android.graphics.Typeface.BOLD); t.letterSpacing = 0.1f; t.setPadding(dp(2), dp(20), 0, dp(10)); return t
    }

    private fun focusCard(f: Focus, spot: Boolean): View {
        val urg = when (f.urgency) { "late" -> REV; "today", "running" -> Color.parseColor("#f59e0b"); else -> ACCENT }
        val card = LinearLayout(requireContext()); card.orientation = LinearLayout.HORIZONTAL
        card.background = rounded(SURFACE, dp(if (spot) 18 else 14), LINE)
        val clp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); clp.bottomMargin = dp(10); card.layoutParams = clp

        val bar = View(requireContext()); bar.layoutParams = LinearLayout.LayoutParams(dp(if (spot) 5 else 4), LinearLayout.LayoutParams.MATCH_PARENT); bar.setBackgroundColor(urg); card.addView(bar)

        val body = LinearLayout(requireContext()); body.orientation = LinearLayout.VERTICAL
        body.setPadding(dp(20), dp(if (spot) 18 else 14), dp(16), dp(if (spot) 18 else 14))
        body.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)

        val meta = LinearLayout(requireContext()); meta.orientation = LinearLayout.HORIZONTAL; meta.gravity = Gravity.CENTER_VERTICAL
        val urgLabel = when (f.urgency) { "late" -> "ATRASADA"; "today" -> "HOJE"; "running" -> "EM ANDAMENTO"; else -> "PRÓXIMA" }
        if (f.kind == "event") { meta.addView(badge("COMPROMISSO", urg)); meta.addView(badge(Types.of(f.event!!.type).label, Types.of(f.event.type).color)) }
        else { meta.addView(badge(urgLabel, urg)); val s = Sectors.of(f.task!!.sector); meta.addView(badge(s.label, s.color)) }
        val mlp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT); mlp.bottomMargin = dp(9); meta.layoutParams = mlp
        body.addView(meta)

        val client = if (f.kind == "event") f.event!!.client else f.task!!.client
        if (!client.isNullOrBlank()) {
            val c = TextView(requireContext()); c.text = client.uppercase(); c.setTextColor(ACCENT); c.textSize = 10f
            c.setTypeface(c.typeface, android.graphics.Typeface.BOLD); c.letterSpacing = 0.08f; c.setPadding(0, 0, 0, dp(4)); body.addView(c)
        }
        val title = TextView(requireContext())
        title.text = if (f.kind == "event") (f.event!!.title?.ifBlank { null } ?: f.event.client ?: "Compromisso") else (f.task!!.title?.ifBlank { null } ?: "Sem título")
        title.setTextColor(INK); title.textSize = if (spot) 18f else 14.5f; title.letterSpacing = -0.02f; title.setTypeface(title.typeface, android.graphics.Typeface.BOLD); body.addView(title)

        val w = whenText(f)
        if (w.isNotEmpty()) { val wt = TextView(requireContext()); wt.text = "🕒  $w"; wt.setTextColor(SOFT); wt.textSize = 11.5f; wt.setPadding(0, dp(8), 0, dp(13)); body.addView(wt) }
        else { val spc = View(requireContext()); spc.layoutParams = LinearLayout.LayoutParams(1, dp(8)); body.addView(spc) }

        val act = LinearLayout(requireContext()); act.orientation = LinearLayout.HORIZONTAL; act.gravity = Gravity.CENTER_VERTICAL
        if (f.kind == "event") {
            act.addView(actionBtn("Ver detalhes", SURFACE, SOFT, true, spot) {
                startActivity(Intent(requireContext(), EventDetailActivity::class.java).putExtra("id", f.event!!.id))
            })
        } else {
            val t = f.task!!
            if (t.status == "afazer") act.addView(actionBtn("▶  Iniciar agora", ACCENT, Color.WHITE, false, spot) { TasksRepo.start(t.id) {} })
            else act.addView(actionBtn("✓  Concluir", GREEN, Color.parseColor("#062514"), false, spot) { TasksRepo.done(t.id) {} })
            act.addView(actionBtn("✕", SURFACE, SOFT, true, spot) { snoozed.add(t.id); render() })
        }
        body.addView(act)
        card.addView(body)
        return card
    }

    private fun emptyCard(): View {
        val card = LinearLayout(requireContext()); card.orientation = LinearLayout.VERTICAL; card.gravity = Gravity.CENTER
        card.background = rounded(SURFACE, dp(18), LINE); card.setPadding(dp(24), dp(52), dp(24), dp(52))
        val ic = TextView(requireContext()); ic.text = "✓"; ic.setTextColor(GREEN); ic.textSize = 30f; ic.gravity = Gravity.CENTER
        ic.layoutParams = LinearLayout.LayoutParams(dp(72), dp(72))
        val g = GradientDrawable(); g.shape = GradientDrawable.OVAL; g.setColor(withAlpha(GREEN, 0.10f)); g.setStroke(dp(2), withAlpha(GREEN, 0.45f)); ic.background = g
        card.addView(ic)
        val h = TextView(requireContext()); h.text = "Tudo em dia! 🎉"; h.setTextColor(INK); h.textSize = 19f; h.gravity = Gravity.CENTER; h.setTypeface(h.typeface, android.graphics.Typeface.BOLD); h.letterSpacing = -0.02f; h.setPadding(0, dp(18), 0, 0); card.addView(h)
        val p = TextView(requireContext()); p.text = "Você não tem nada urgente agora.\nAproveite pra descansar ou pegar uma tarefa nova do Quadro."; p.setTextColor(SOFT); p.textSize = 13.5f; p.gravity = Gravity.CENTER; p.setPadding(0, dp(10), 0, dp(20)); card.addView(p)
        card.addView(actionBtn("Ver Quadro", SURFACE2, INK, true, false) { (activity as? HomeActivity)?.selectTab("board") })
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

    private fun badge(text: String, color: Int): TextView {
        val tv = TextView(requireContext()); tv.text = text.uppercase(); tv.setTextColor(color); tv.textSize = 9.5f
        tv.setTypeface(tv.typeface, android.graphics.Typeface.BOLD); tv.letterSpacing = 0.06f; tv.setPadding(dp(9), dp(4), dp(9), dp(4))
        val bg = GradientDrawable(); bg.cornerRadius = dp(6).toFloat(); bg.setColor(withAlpha(color, 0.13f)); bg.setStroke(dp(1), withAlpha(color, 0.30f)); tv.background = bg
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.rightMargin = dp(7); tv.layoutParams = lp
        return tv
    }
    private fun actionBtn(text: String, bgColor: Int, txtColor: Int, ghost: Boolean, spot: Boolean, onClick: () -> Unit): TextView {
        val tv = TextView(requireContext()); tv.text = text; tv.setTextColor(txtColor); tv.textSize = if (spot) 14f else 13f; tv.gravity = Gravity.CENTER
        tv.setTypeface(tv.typeface, android.graphics.Typeface.BOLD)
        tv.setPadding(dp(16), dp(if (spot) 13 else 11), dp(16), dp(if (spot) 13 else 11))
        val bg = GradientDrawable(); bg.cornerRadius = dp(11).toFloat(); bg.setColor(bgColor); if (ghost) bg.setStroke(dp(1), LINE); tv.background = bg
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.rightMargin = dp(8); tv.layoutParams = lp
        tv.isClickable = true; tv.setOnClickListener { onClick() }; return tv
    }
    private fun rounded(fill: Int, radius: Int, stroke: Int): GradientDrawable { val g = GradientDrawable(); g.cornerRadius = radius.toFloat(); g.setColor(fill); g.setStroke(dp(1), stroke); return g }
    private fun heroBg(): GradientDrawable {
        val g = GradientDrawable(GradientDrawable.Orientation.TL_BR,
            intArrayOf(blend(SURFACE, ACCENT, 0.09f), SURFACE, blend(SURFACE, Color.parseColor("#a855f7"), 0.05f)))
        g.cornerRadius = dp(18).toFloat(); g.setStroke(dp(1), LINE); return g
    }
    private fun blend(a: Int, b: Int, t: Float): Int = Color.rgb(
        (Color.red(a) * (1 - t) + Color.red(b) * t).toInt(),
        (Color.green(a) * (1 - t) + Color.green(b) * t).toInt(),
        (Color.blue(a) * (1 - t) + Color.blue(b) * t).toInt())
    private fun withAlpha(color: Int, a: Float): Int = Color.argb((a * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun roundClip(view: View, radiusPx: Int) {
        view.outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(v: View, o: Outline) { o.setRoundRect(0, 0, v.width, v.height, radiusPx.toFloat()) }
        }
        view.clipToOutline = true
    }

    // ---- Avatar: carrega foto remota (HttpURLConnection) com recorte circular e fallback de iniciais ----
    private fun loadAvatar(img: ImageView, url: String?, sizePx: Int) {
        val initials = UserColor.initials(Session.name(requireContext()))
        val ringColor = UserColor.of(myUid(), myColor)
        img.setImageBitmap(initialsBmp(sizePx, ringColor, initials))
        if (url.isNullOrBlank()) return
        avatarCache[url]?.let { img.setImageBitmap(it); return }
        Thread {
            try {
                val bmp: Bitmap? = if (url.startsWith("data:")) {
                    val b64 = url.substringAfter(",", "")
                    val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                } else {
                    val con = (URL(url).openConnection() as HttpURLConnection)
                    con.connectTimeout = 8000; con.readTimeout = 8000; con.doInput = true; con.instanceFollowRedirects = true; con.connect()
                    val b = BitmapFactory.decodeStream(con.inputStream); con.disconnect(); b
                }
                if (bmp != null) {
                    val circ = circleBmp(bmp, sizePx); avatarCache[url] = circ
                    ui { img.setImageBitmap(circ) }
                }
            } catch (_: Exception) { }
        }.start()
    }
    private fun circleBmp(src: Bitmap, size: Int): Bitmap {
        val s = minOf(src.width, src.height)
        val sq = Bitmap.createBitmap(src, (src.width - s) / 2, (src.height - s) / 2, s, s)
        val scaled = Bitmap.createScaledBitmap(sq, size, size, true)
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out); val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        paint.shader = BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
        return out
    }
    private fun initialsBmp(size: Int, color: Int, initials: String): Bitmap {
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val bg = Paint(Paint.ANTI_ALIAS_FLAG); bg.color = blend(color, Color.parseColor("#0a0b10"), 0.20f)
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, bg)
        val tp = Paint(Paint.ANTI_ALIAS_FLAG); tp.color = Color.WHITE; tp.textAlign = Paint.Align.CENTER
        tp.textSize = size * 0.40f; tp.isFakeBoldText = true
        val fm = tp.fontMetrics
        canvas.drawText(initials, size / 2f, size / 2f - (fm.ascent + fm.descent) / 2f, tp)
        return out
    }

    companion object { private val avatarCache = HashMap<String, Bitmap>() }
}
