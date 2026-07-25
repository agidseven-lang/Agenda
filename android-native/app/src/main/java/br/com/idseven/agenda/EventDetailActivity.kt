package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.ListenerRegistration
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Detalhes do compromisso fiel ao #detailSheet do PWA: tipo, título, lista de campos com
// ícones, foto do responsável, situação colorida e ações Iniciar/Finalizar/Reagendar/Excluir.
class EventDetailActivity : AppCompatActivity() {

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

    private val MO = listOf("janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro")
    private val DWF = listOf("domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado")

    private lateinit var id: String
    private lateinit var bodyCol: LinearLayout
    private var reg: ListenerRegistration? = null
    private var usReg: ListenerRegistration? = null
    private var users: Map<String, UserLite> = emptyMap()
    private var lastEvent: EventItem? = null
    private val admin get() = Perm.isAdmin(this)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        id = intent.getStringExtra("id") ?: run { finish(); return }

        val rootCol = LinearLayout(this); rootCol.orientation = LinearLayout.VERTICAL; rootCol.setBackgroundColor(Color.parseColor("#0a0b10"))
        rootCol.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)

        val head = LinearLayout(this); head.orientation = LinearLayout.HORIZONTAL; head.gravity = Gravity.CENTER_VERTICAL
        head.setPadding(dp(22), dp(18), dp(16), dp(16))
        val h2 = TextView(this); h2.text = "Detalhes"; h2.setTextColor(INK); h2.textSize = 22f; h2.setTypeface(h2.typeface, Typeface.BOLD); h2.letterSpacing = -0.028f
        h2.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); head.addView(h2)
        head.addView(iconBtn(R.drawable.ic_close, SOFT) { finish() })
        rootCol.addView(head)

        val scroll = ScrollView(this); scroll.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
        bodyCol = LinearLayout(this); bodyCol.orientation = LinearLayout.VERTICAL; bodyCol.setPadding(dp(22), dp(4), dp(22), dp(22))
        scroll.addView(bodyCol); rootCol.addView(scroll)

        if (admin) {
            val sep = View(this); sep.setBackgroundColor(LINE); rootCol.addView(sep, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)))
            val foot = LinearLayout(this); foot.orientation = LinearLayout.HORIZONTAL; foot.gravity = Gravity.CENTER_VERTICAL; foot.setPadding(dp(22), dp(14), dp(22), dp(18))
            val del = iconBtn(R.drawable.ic_trash, REV) { confirmDelete() }
            val dbg = GradientDrawable(); dbg.cornerRadius = dp(10).toFloat(); dbg.setColor(SURFACE); dbg.setStroke(dp(1), LINE); del.background = dbg
            del.layoutParams = LinearLayout.LayoutParams(dp(54), dp(48)).also { it.rightMargin = dp(10) }; foot.addView(del)
            val edit = TextView(this); edit.text = "Reagendar / Editar"; edit.gravity = Gravity.CENTER; edit.textSize = 14f
            edit.setTextColor(Color.WHITE); edit.setTypeface(edit.typeface, Typeface.BOLD)
            val ebg = GradientDrawable(); ebg.cornerRadius = dp(10).toFloat(); ebg.setColor(ACCENT); edit.background = ebg
            edit.layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f); edit.isClickable = true
            edit.setOnClickListener { startActivity(Intent(this, EventFormActivity::class.java).putExtra("id", id)) }
            foot.addView(edit); rootCol.addView(foot)
        }
        setContentView(rootCol)
    }

    override fun onStart() {
        super.onStart()
        usReg = UsersRepo.listen { list -> users = list.associateBy { it.id }; runOnUiThread { lastEvent?.let { render(it) } } }
        reg = EventRepo.listenOne(id) { e -> runOnUiThread { if (e == null) finish() else { lastEvent = e; render(e) } } }
    }
    override fun onStop() { super.onStop(); reg?.remove(); usReg?.remove(); reg = null; usReg = null }

    private fun render(e: EventItem) {
        bodyCol.removeAllViews()
        val ty = Types.of(e.type)

        // Tipo (pill com 2 bolinhas)
        val typePill = LinearLayout(this); typePill.orientation = LinearLayout.HORIZONTAL; typePill.gravity = Gravity.CENTER_VERTICAL
        typePill.setPadding(dp(14), dp(7), dp(14), dp(7))
        val tbg = GradientDrawable(); tbg.cornerRadius = dp(9).toFloat(); tbg.setColor(withAlpha(ty.color, 0.16f)); tbg.setStroke(dp(1), withAlpha(ty.color, 0.25f)); typePill.background = tbg
        val d1 = dot(ty.color, 6); (d1.layoutParams as LinearLayout.LayoutParams).rightMargin = dp(6); typePill.addView(d1)
        val d2 = dot(ty.color, 6); (d2.layoutParams as LinearLayout.LayoutParams).rightMargin = dp(8); typePill.addView(d2)
        val tl = TextView(this); tl.text = ty.label.uppercase(); tl.setTextColor(ty.color); tl.textSize = 11f; tl.setTypeface(tl.typeface, Typeface.BOLD); tl.letterSpacing = 0.05f; typePill.addView(tl)
        typePill.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).also { it.bottomMargin = dp(16) }
        bodyCol.addView(typePill)

        // Título
        val title = TextView(this); title.text = e.title?.ifBlank { null } ?: e.client ?: "Sem título"
        title.setTextColor(INK); title.textSize = 26f; title.setTypeface(title.typeface, Typeface.BOLD); title.letterSpacing = -0.032f
        title.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).also { it.bottomMargin = dp(22) }
        bodyCol.addView(title)

        // Lista
        val list = LinearLayout(this); list.orientation = LinearLayout.VERTICAL
        val lbg = GradientDrawable(); lbg.cornerRadius = dp(16).toFloat(); lbg.setColor(SURFACE); lbg.setStroke(dp(1), LINE); list.background = lbg
        val rows = ArrayList<View>()

        val owner = e.ownerId?.let { users[it] } ?: users.values.firstOrNull { (it.name ?: "").trim().equals((e.owner ?: "").trim(), ignoreCase = true) }
        val oc = if (owner != null) UserColor.of(owner.id, owner.color) else ty.color

        if (!e.client.isNullOrBlank()) rows.add(rowText(R.drawable.ic_person, "Cliente / Empresa", e.client!!))
        if (owner != null) rows.add(rowView(R.drawable.ic_clipboard, "Responsável", ownerValue(owner, oc)))
        else if (!e.owner.isNullOrBlank()) rows.add(rowText(R.drawable.ic_clipboard, "Responsável", e.owner!!))
        if (!e.date.isNullOrBlank()) rows.add(rowText(R.drawable.ic_cal_empty, "Data", dataLabel(e.date!!)))
        rows.add(rowText(R.drawable.ic_clock, "Horário", if (!e.start.isNullOrBlank()) (if (!e.end.isNullOrBlank()) "${e.start} — ${e.end}" else e.start!!) else "—"))
        EventStatus.dtMs(e.date, e.start ?: "00:00")?.let { rows.add(rowText(R.drawable.ic_plus_circle, "Início previsto", fmtMs(it))) }
        EventStatus.dueMs(e)?.let { rows.add(rowText(R.drawable.ic_cal_empty, "Término previsto", fmtMs(it))) }
        EventStatus.status(e)?.let { si ->
            val col = if (si.late) REV else if (si.kind == "run") AMBER else GREEN
            rows.add(rowView(R.drawable.ic_clock, "Situação", boldColored(si.text, col)))
        }
        if (e.startedAt != null && e.startedAt > 0) rows.add(rowText(R.drawable.ic_clock, "Iniciada em", fmtMs(e.startedAt)))
        if (e.done && e.doneAt != null) {
            val by = e.doneBy?.let { users[it]?.name }
            rows.add(rowText(R.drawable.ic_check, "Finalizada em", fmtMs(e.doneAt) + (if (!by.isNullOrBlank()) " · $by" else "")))
        }
        if (!e.location.isNullOrBlank()) rows.add(rowText(R.drawable.ic_pin, "Local", e.location!!))
        if (!e.notes.isNullOrBlank()) rows.add(rowText(R.drawable.ic_lines, "Observações", e.notes!!))
        rows.add(rowText(R.drawable.ic_person, "Criado por", e.by?.let { users[it]?.name } ?: "—"))

        for ((i, r) in rows.withIndex()) {
            list.addView(r)
            if (i < rows.size - 1) { val d = View(this); d.setBackgroundColor(Color.parseColor("#222633")); val dlp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)); dlp.leftMargin = dp(68); list.addView(d, dlp) }
        }
        bodyCol.addView(list)

        // Ações
        val notStarted = e.startedAt == null || e.startedAt <= 0
        if (!e.done && notStarted) {
            bodyCol.addView(actionToggle("Iniciar agora", R.drawable.ic_play, AMBER, withAlpha(AMBER, 0.12f), withAlpha(AMBER, 0.30f), topMarginDp = 16) {
                EventRepo.start(id, Session.uid(this), {}, { m -> toast(m) })
            })
        }
        if (!e.done) {
            bodyCol.addView(actionToggle("Finalizar agora", R.drawable.ic_check, INK, SURFACE, LINE, topMarginDp = if (notStarted) 11 else 16) {
                EventRepo.finish(id, Session.uid(this), {}, { m -> toast(m) })
            })
        } else {
            bodyCol.addView(actionToggle("Serviço finalizado ✓ (tocar para reabrir)", R.drawable.ic_check, GREEN, withAlpha(GREEN, 0.10f), withAlpha(GREEN, 0.35f), topMarginDp = 16) {
                EventRepo.reopen(id, {}, { m -> toast(m) })
            })
        }
    }

    private fun ownerValue(owner: UserLite, oc: Int): View {
        val row = LinearLayout(this); row.orientation = LinearLayout.HORIZONTAL; row.gravity = Gravity.CENTER_VERTICAL
        val av = Topbar.avatar(this, owner.photo, oc, owner.name, dp(28), dp(2))
        (av.layoutParams as LinearLayout.LayoutParams).rightMargin = dp(10); row.addView(av)
        val nm = TextView(this); nm.text = owner.name ?: "—"; nm.setTextColor(INK); nm.textSize = 14.5f; nm.setTypeface(nm.typeface, Typeface.BOLD); row.addView(nm)
        val d = dot(oc, 10); (d.layoutParams as LinearLayout.LayoutParams).leftMargin = dp(9); row.addView(d)
        return row
    }
    private fun boldColored(text: String, color: Int): View {
        val t = TextView(this); t.text = text; t.setTextColor(color); t.textSize = 14.5f; t.setTypeface(t.typeface, Typeface.BOLD); return t
    }

    private fun rowText(iconRes: Int, label: String, value: String): View {
        val v = TextView(this); v.text = value; v.setTextColor(INK); v.textSize = 14.5f; v.setTypeface(v.typeface, Typeface.BOLD); v.setLineSpacing(dp(3).toFloat(), 1f)
        return rowView(iconRes, label, v)
    }
    private fun rowView(iconRes: Int, label: String, valueView: View): View {
        val row = LinearLayout(this); row.orientation = LinearLayout.HORIZONTAL; row.gravity = Gravity.CENTER_VERTICAL
        row.setPadding(dp(15), dp(12), dp(15), dp(12)); row.minimumHeight = dp(66)
        val ic = FrameLayout(this)
        val ibg = GradientDrawable(); ibg.cornerRadius = dp(11).toFloat(); ibg.setColor(SURFACE2); ibg.setStroke(dp(1), LINE); ic.background = ibg
        ic.layoutParams = LinearLayout.LayoutParams(dp(40), dp(40)).also { it.rightMargin = dp(13) }
        val img = ImageView(this); img.setImageResource(iconRes); img.setColorFilter(ACCENT)
        img.layoutParams = FrameLayout.LayoutParams(dp(20), dp(20)).also { it.gravity = Gravity.CENTER }
        ic.addView(img); row.addView(ic)
        val tx = LinearLayout(this); tx.orientation = LinearLayout.VERTICAL; tx.gravity = Gravity.CENTER_VERTICAL
        tx.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        val l = TextView(this); l.text = label.uppercase(); l.setTextColor(FAINT); l.textSize = 10f; l.setTypeface(l.typeface, Typeface.BOLD); l.letterSpacing = 0.06f; l.maxLines = 1; l.setPadding(0, 0, 0, dp(4)); tx.addView(l)
        tx.addView(valueView); row.addView(tx)
        return row
    }

    private fun actionToggle(text: String, iconRes: Int, fg: Int, bgColor: Int, strokeColor: Int, topMarginDp: Int = 11, onClick: () -> Unit): View {
        val b = LinearLayout(this); b.orientation = LinearLayout.HORIZONTAL; b.gravity = Gravity.CENTER
        b.setPadding(dp(16), dp(16), dp(16), dp(16))
        val bg = GradientDrawable(); bg.cornerRadius = dp(14).toFloat(); bg.setColor(bgColor); bg.setStroke(dp(if (bgColor == SURFACE) 1 else 2), strokeColor); b.background = bg
        b.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).also { it.topMargin = dp(topMarginDp) }
        val img = ImageView(this); img.setImageResource(iconRes); img.setColorFilter(fg)
        img.layoutParams = LinearLayout.LayoutParams(dp(18), dp(18)).also { it.rightMargin = dp(10) }; b.addView(img)
        val t = TextView(this); t.text = text; t.setTextColor(fg); t.textSize = 14.5f; t.setTypeface(t.typeface, Typeface.BOLD); b.addView(t)
        b.isClickable = true; b.setOnClickListener { onClick() }
        return b
    }

    private fun confirmDelete() {
        AlertDialog.Builder(this).setTitle("Excluir compromisso").setMessage("Excluir este compromisso para toda a equipe?")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Excluir") { _, _ -> EventRepo.delete(id, { runOnUiThread { finish() } }, { m -> runOnUiThread { toast(m) } }) }.show()
    }

    private fun dot(color: Int, sizeDp: Int): View {
        val d = View(this); val g = GradientDrawable(); g.shape = GradientDrawable.OVAL; g.setColor(color); d.background = g
        d.layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)); return d
    }
    private fun iconBtn(res: Int, tint: Int, onClick: () -> Unit): ImageView {
        val img = ImageView(this); img.setImageResource(res); img.setColorFilter(tint); img.setPadding(dp(10), dp(10), dp(10), dp(10))
        val bg = GradientDrawable(); bg.cornerRadius = dp(12).toFloat(); bg.setColor(SURFACE); bg.setStroke(dp(1), LINE); img.background = bg
        img.layoutParams = LinearLayout.LayoutParams(dp(40), dp(40)); img.isClickable = true; img.setOnClickListener { onClick() }; return img
    }
    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()
    private fun withAlpha(color: Int, a: Float): Int = Color.argb((a * 255).toInt(), Color.red(color), Color.green(color), Color.blue(color))
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    private fun dataLabel(iso: String): String {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
        val c = Calendar.getInstance()
        return try {
            c.time = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(iso)!!
            val day = c.get(Calendar.DAY_OF_MONTH); val mo = MO[c.get(Calendar.MONTH)]; val yr = c.get(Calendar.YEAR)
            val tmr = Calendar.getInstance(); tmr.add(Calendar.DAY_OF_MONTH, 1)
            val ytd = Calendar.getInstance(); ytd.add(Calendar.DAY_OF_MONTH, -1)
            val label = when (iso) {
                today -> "Hoje"
                SimpleDateFormat("yyyy-MM-dd", Locale.US).format(tmr.time) -> "Amanhã"
                SimpleDateFormat("yyyy-MM-dd", Locale.US).format(ytd.time) -> "Ontem"
                else -> DWF[c.get(Calendar.DAY_OF_WEEK) - 1]
            }
            "$label · $day de $mo, $yr"
        } catch (_: Exception) { iso }
    }
    private fun fmtMs(ms: Long): String {
        val c = Calendar.getInstance(); c.timeInMillis = ms
        fun p(n: Int) = if (n < 10) "0$n" else "$n"
        return "${p(c.get(Calendar.DAY_OF_MONTH))}/${p(c.get(Calendar.MONTH) + 1)}/${c.get(Calendar.YEAR)} às ${p(c.get(Calendar.HOUR_OF_DAY))}:${p(c.get(Calendar.MINUTE))}"
    }
}
