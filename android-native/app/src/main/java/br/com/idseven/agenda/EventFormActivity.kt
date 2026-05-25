package br.com.idseven.agenda

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

// Form de compromisso fiel ao modal do PWA (#formSheet): grade de tipos, campos reais,
// data/hora nativos, chips de responsável com avatar, Salvar/Excluir. Grava no schema do PWA.
class EventFormActivity : AppCompatActivity() {

    private val INK = Color.parseColor("#f1f2f4")
    private val SOFT = Color.parseColor("#9ba0ab")
    private val FAINT = Color.parseColor("#6e7480")
    private val SURFACE = Color.parseColor("#15171f")
    private val SURFACE2 = Color.parseColor("#1c1f29")
    private val LINE = Color.parseColor("#262a36")
    private val ACCENT = Color.parseColor("#5b6cff")
    private val REV = Color.parseColor("#f87171")

    private var editId: String? = null
    private var selType = "gravacao"
    private var selDate = todayIso()
    private var selStart = "09:00"
    private var selEnd = ""
    private var team: List<UserLite> = emptyList()

    private var oldDate = ""; private var oldStart = ""; private var oldEnd = ""; private var oldOwnerId: String? = null

    private lateinit var clientIn: EditText
    private lateinit var titleIn: EditText
    private lateinit var locIn: EditText
    private lateinit var notesIn: EditText
    private lateinit var ownerIn: EditText
    private lateinit var dateView: TextView
    private lateinit var startView: TextView
    private lateinit var endView: TextView
    private lateinit var typeGrid: LinearLayout
    private lateinit var ownerWrap: LinearLayout
    private lateinit var errBox: TextView
    private lateinit var saveBtn: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Perm.canManage(Session.name(this))) { finish(); return }
        editId = intent.getStringExtra("id")
        try {
            setContentView(buildUi())
            if (Session.name(this) != null) ownerIn.setText(Session.name(this))
            renderTypeGrid()
            loadTeam()
            editId?.let { prefill(it) }
        } catch (e: Throwable) {
            setContentView(errorScreen(e))
        }
    }

    private fun errorScreen(e: Throwable): View {
        val col = LinearLayout(this); col.orientation = LinearLayout.VERTICAL; col.gravity = Gravity.CENTER
        col.setBackgroundColor(Color.parseColor("#0a0b10")); col.setPadding(dp(28), dp(28), dp(28), dp(28))
        col.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)
        val t = TextView(this); t.text = "Não foi possível abrir o formulário"; t.setTextColor(INK); t.textSize = 17f
        t.setTypeface(t.typeface, Typeface.BOLD); t.gravity = Gravity.CENTER; col.addView(t)
        val m = TextView(this); m.text = (e.message ?: e.javaClass.simpleName); m.setTextColor(SOFT); m.textSize = 12.5f
        m.gravity = Gravity.CENTER; m.setPadding(0, dp(12), 0, dp(22)); col.addView(m)
        val b = TextView(this); b.text = "Fechar"; b.setTextColor(Color.WHITE); b.textSize = 14f; b.gravity = Gravity.CENTER
        b.setTypeface(b.typeface, Typeface.BOLD); b.setPadding(dp(28), dp(13), dp(28), dp(13))
        val bg = GradientDrawable(); bg.cornerRadius = dp(10).toFloat(); bg.setColor(ACCENT); b.background = bg
        b.isClickable = true; b.setOnClickListener { finish() }; col.addView(b)
        return col
    }

    private fun buildUi(): View {
        val rootCol = LinearLayout(this); rootCol.orientation = LinearLayout.VERTICAL; rootCol.setBackgroundColor(Color.parseColor("#0a0b10"))
        rootCol.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT)

        // Header
        val head = LinearLayout(this); head.orientation = LinearLayout.HORIZONTAL; head.gravity = Gravity.CENTER_VERTICAL
        head.setPadding(dp(22), dp(18), dp(16), dp(16))
        val h2 = TextView(this); h2.text = if (editId != null) "Reagendar / Editar" else "Novo compromisso"
        h2.setTextColor(INK); h2.textSize = 22f; h2.setTypeface(h2.typeface, Typeface.BOLD); h2.letterSpacing = -0.028f
        h2.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); head.addView(h2)
        head.addView(iconBtn(R.drawable.ic_close) { finish() })
        rootCol.addView(head)

        // Body (scroll)
        val scroll = ScrollView(this); scroll.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f); scroll.isFillViewport = false
        val body = LinearLayout(this); body.orientation = LinearLayout.VERTICAL; body.setPadding(dp(22), 0, dp(22), dp(22))

        errBox = TextView(this); errBox.setTextColor(REV); errBox.textSize = 13f; errBox.visibility = View.GONE
        errBox.setPadding(dp(2), 0, dp(2), dp(12)); body.addView(errBox)

        body.addView(label("Tipo de serviço"))
        typeGrid = LinearLayout(this); typeGrid.orientation = LinearLayout.VERTICAL
        typeGrid.layoutParams = fld(); body.addView(typeGrid)

        body.addView(label("Nome do cliente / empresa"))
        clientIn = input("Ex.: Loja Aurora", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES); body.addView(clientIn)

        body.addView(label("Título / descrição do serviço"))
        titleIn = input("Ex.: Gravação de reels", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES); body.addView(titleIn)

        body.addView(label("Local do serviço"))
        locIn = input("Estúdio, endereço ou link", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES); body.addView(locIn)

        body.addView(label("Data"))
        dateView = pickerField(fmtDate(selDate)) { pickDate() }; body.addView(dateView)

        // Início / Término (2 colunas)
        val r2 = LinearLayout(this); r2.orientation = LinearLayout.HORIZONTAL; r2.layoutParams = fld()
        val cIni = LinearLayout(this); cIni.orientation = LinearLayout.VERTICAL
        cIni.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).also { it.rightMargin = dp(6) }
        cIni.addView(label("Início")); startView = pickerField(selStart) { pickTime(true) }; cIni.addView(startView)
        val cFim = LinearLayout(this); cFim.orientation = LinearLayout.VERTICAL
        cFim.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).also { it.leftMargin = dp(6) }
        cFim.addView(label("Término")); endView = pickerField(selEnd.ifBlank { "--:--" }) { pickTime(false) }; cFim.addView(endView)
        r2.addView(cIni); r2.addView(cFim); body.addView(r2)

        body.addView(label("Responsável pela agenda"))
        ownerWrap = LinearLayout(this); ownerWrap.orientation = LinearLayout.VERTICAL; body.addView(ownerWrap)
        ownerIn = input("ou digite outro nome", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
        ownerIn.textSize = 13f; ownerIn.alpha = 0.75f; (ownerIn.layoutParams as LinearLayout.LayoutParams).topMargin = dp(9)
        body.addView(ownerIn)

        body.addView(label("Observações"))
        notesIn = input("Roteiro, equipamentos, briefing…", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES)
        notesIn.minLines = 3; notesIn.gravity = Gravity.TOP; body.addView(notesIn)

        scroll.addView(body); rootCol.addView(scroll)

        // Footer
        val foot = LinearLayout(this); foot.orientation = LinearLayout.HORIZONTAL; foot.gravity = Gravity.CENTER_VERTICAL
        foot.setPadding(dp(22), dp(14), dp(22), dp(18))
        val sep = View(this); sep.setBackgroundColor(LINE)
        rootCol.addView(sep, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)))
        if (editId != null) {
            val del = iconBtn(R.drawable.ic_trash) { confirmDelete() }; del.setColorFilterTint(REV)
            (del.layoutParams as LinearLayout.LayoutParams).rightMargin = dp(10); foot.addView(del)
        }
        saveBtn = TextView(this); saveBtn.text = "Salvar"; saveBtn.gravity = Gravity.CENTER; saveBtn.textSize = 14f
        saveBtn.setTextColor(Color.WHITE); saveBtn.setTypeface(saveBtn.typeface, Typeface.BOLD)
        val sbg = GradientDrawable(); sbg.cornerRadius = dp(10).toFloat(); sbg.setColor(ACCENT); saveBtn.background = sbg
        saveBtn.layoutParams = LinearLayout.LayoutParams(0, dp(48), 1f)
        saveBtn.isClickable = true; saveBtn.setOnClickListener { save() }
        foot.addView(saveBtn)
        rootCol.addView(foot)
        return rootCol
    }

    // ---- Tipos ----
    private fun renderTypeGrid() {
        typeGrid.removeAllViews()
        val all = Types.ALL
        var i = 0
        while (i < all.size) {
            val rowv = LinearLayout(this); rowv.orientation = LinearLayout.HORIZONTAL
            rowv.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).also { if (i + 3 < all.size) it.bottomMargin = dp(10) else it.bottomMargin = 0 }
            for (j in 0 until 3) {
                if (i + j < all.size) rowv.addView(typeCard(all[i + j]))
                else { val sp = View(this); sp.layoutParams = LinearLayout.LayoutParams(0, 1, 1f); rowv.addView(sp) }
            }
            typeGrid.addView(rowv)
            i += 3
        }
        // espaço entre linhas internas
        for (k in 0 until typeGrid.childCount - 1) ((typeGrid.getChildAt(k)).layoutParams as LinearLayout.LayoutParams).bottomMargin = dp(10)
    }
    private fun typeCard(t: Types.T): View {
        val on = t.key == selType
        val card = TextView(this); card.text = t.label; card.gravity = Gravity.CENTER; card.textSize = 11.5f
        card.setTextColor(if (on) INK else SOFT); card.setTypeface(card.typeface, if (on) Typeface.BOLD else Typeface.NORMAL)
        card.setPadding(dp(8), dp(18), dp(8), dp(14))
        val bg = GradientDrawable(); bg.cornerRadius = dp(12).toFloat(); bg.setColor(if (on) SURFACE2 else SURFACE)
        bg.setStroke(dp(if (on) 2 else 1), if (on) t.color else LINE); card.background = bg
        card.layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).also { it.leftMargin = dp(5); it.rightMargin = dp(5) }
        card.isClickable = true; card.setOnClickListener { selType = t.key; renderTypeGrid() }
        return card
    }

    // ---- Responsável ----
    private fun loadTeam() {
        FirebaseFirestore.getInstance().collection("users").get()
            .addOnSuccessListener { snap ->
                try {
                    team = snap.documents.map { UserLite(it.id, it.getString("name"), it.getString("color"), it.getString("photo"), it.getString("status")) }
                        .filter { it.isActive() }
                    renderOwnerChips()
                } catch (_: Throwable) { }
            }
            .addOnFailureListener { renderOwnerChips() }
    }
    private fun renderOwnerChips() {
        if (!::ownerWrap.isInitialized || !::ownerIn.isInitialized) return
        ownerWrap.removeAllViews()
        val cur = ownerIn.text.toString().trim().lowercase()
        val chips = ArrayList<View>()
        val myUid = Session.uid(this); val myName = Session.name(this)
        if (!myName.isNullOrBlank()) chips.add(ownerChip(myUid, myName, myColorKey(), "Eu", cur == myName.trim().lowercase()))
        for (u in team) { if (u.id == myUid) continue; chips.add(ownerChip(u.id, u.name, u.color, UserColor.firstName(u.name).ifBlank { u.name ?: "?" }, cur == (u.name ?: "").trim().lowercase())) }
        flow(ownerWrap, chips)
    }
    private fun myColorKey(): String? = team.firstOrNull { it.id == Session.uid(this) }?.color
    private fun ownerChip(id: String?, fullName: String?, colorKey: String?, shortLabel: String, on: Boolean): View {
        val box = LinearLayout(this); box.orientation = LinearLayout.HORIZONTAL; box.gravity = Gravity.CENTER_VERTICAL
        box.setPadding(dp(4), dp(4), dp(12), dp(4))
        val bg = GradientDrawable(); bg.cornerRadius = dp(10).toFloat(); bg.setColor(if (on) SURFACE2 else SURFACE); bg.setStroke(dp(1), if (on) ACCENT else LINE); box.background = bg
        val av = Topbar.avatar(this, team.firstOrNull { it.id == id }?.photo, UserColor.of(id, colorKey), fullName, dp(24), dp(0))
        (av.layoutParams as LinearLayout.LayoutParams).rightMargin = dp(8); box.addView(av)
        val nm = TextView(this); nm.text = shortLabel; nm.setTextColor(if (on) INK else SOFT); nm.textSize = 13f; nm.setTypeface(nm.typeface, Typeface.BOLD); box.addView(nm)
        box.isClickable = true; box.setOnClickListener { ownerIn.setText(fullName ?: ""); renderOwnerChips() }
        return box
    }

    private fun prefill(id: String) {
        FirebaseFirestore.getInstance().collection("events").document(id).get().addOnSuccessListener { d ->
          try {
            if (!d.exists()) return@addOnSuccessListener
            selType = d.getString("type") ?: "gravacao"
            clientIn.setText(d.getString("client") ?: "")
            titleIn.setText(d.getString("title") ?: "")
            locIn.setText(d.getString("location") ?: "")
            selDate = d.getString("date") ?: selDate; dateView.text = fmtDate(selDate)
            selStart = d.getString("start") ?: ""; startView.text = selStart.ifBlank { "--:--" }
            selEnd = d.getString("end") ?: ""; endView.text = selEnd.ifBlank { "--:--" }
            notesIn.setText(d.getString("notes") ?: "")
            ownerIn.setText(d.getString("owner") ?: "")
            oldDate = selDate; oldStart = selStart; oldEnd = selEnd; oldOwnerId = d.getString("ownerId")
            renderTypeGrid(); renderOwnerChips()
          } catch (_: Throwable) { }
        }
    }

    private fun save() {
        errBox.visibility = View.GONE
        val client = clientIn.text.toString().trim()
        if (client.isEmpty()) { showErr("Informe o cliente / empresa"); return }
        if (!Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(selDate)) { showErr("Escolha a data"); return }

        val ownerName = ownerIn.text.toString().trim()
        val ownEl = team.firstOrNull { (it.name ?: "").trim().equals(ownerName, ignoreCase = true) }
        val ownerId = ownEl?.id ?: (if (ownerName.equals(Session.name(this)?.trim() ?: "", ignoreCase = true)) Session.uid(this) else null)

        val m = HashMap<String, Any?>()
        m["type"] = selType; m["client"] = client; m["title"] = titleIn.text.toString().trim()
        m["location"] = locIn.text.toString().trim(); m["date"] = selDate
        m["start"] = selStart; m["end"] = selEnd; m["owner"] = ownerName; m["ownerId"] = ownerId
        m["notes"] = notesIn.text.toString().trim(); m["updatedAt"] = System.currentTimeMillis()

        saveBtn.isEnabled = false; saveBtn.text = "Salvando…"
        if (editId != null) {
            val rescheduled = oldDate != selDate || oldStart != selStart || oldEnd != selEnd || (oldOwnerId ?: "") != (ownerId ?: "")
            if (rescheduled) {
                m["reminderSentAt"] = FieldValue.delete(); m["reminderSentStatus"] = FieldValue.delete()
                m["reminderError"] = FieldValue.delete(); m["reminderLastAttemptAt"] = FieldValue.delete()
            }
            EventRepo.update(editId!!, m, { runOnUiThread { finish() } }, { msg -> runOnUiThread { showErr(msg); saveBtn.isEnabled = true; saveBtn.text = "Salvar" } })
        } else {
            m["by"] = Session.uid(this); m["done"] = false; m["createdAt"] = System.currentTimeMillis()
            EventRepo.create(m, { runOnUiThread { finish() } }, { msg -> runOnUiThread { showErr(msg); saveBtn.isEnabled = true; saveBtn.text = "Salvar" } })
        }
    }

    private fun confirmDelete() {
        AlertDialog.Builder(this)
            .setTitle("Excluir compromisso")
            .setMessage("Excluir este compromisso para toda a equipe?")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Excluir") { _, _ ->
                editId?.let { id -> EventRepo.delete(id, { runOnUiThread { finish() } }, { msg -> runOnUiThread { showErr(msg) } }) }
            }.show()
    }

    // ---- Date / time pickers ----
    private fun pickDate() {
        val c = Calendar.getInstance()
        Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(selDate)?.let { c.set(it.groupValues[1].toInt(), it.groupValues[2].toInt() - 1, it.groupValues[3].toInt()) }
        DatePickerDialog(this, { _, y, mo, d -> selDate = "%04d-%02d-%02d".format(y, mo + 1, d); dateView.text = fmtDate(selDate); dateView.setTextColor(INK) },
            c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show()
    }
    private fun pickTime(start: Boolean) {
        val cur = if (start) selStart else selEnd
        var hh = 9; var mm = 0
        Regex("^(\\d{1,2}):(\\d{2})$").find(cur)?.let { hh = it.groupValues[1].toInt(); mm = it.groupValues[2].toInt() }
        TimePickerDialog(this, { _, h, m -> val v = "%02d:%02d".format(h, m); if (start) { selStart = v; startView.text = v; startView.setTextColor(INK) } else { selEnd = v; endView.text = v; endView.setTextColor(INK) } }, hh, mm, true).show()
    }

    // ---- UI helpers ----
    private fun label(text: String): TextView {
        val t = TextView(this); t.text = text.uppercase(); t.setTextColor(FAINT); t.textSize = 11f
        t.setTypeface(t.typeface, Typeface.BOLD); t.letterSpacing = 0.04f; t.setPadding(0, 0, 0, dp(8)); return t
    }
    private fun input(hint: String, type: Int): EditText {
        val e = EditText(this); e.hint = hint; e.setHintTextColor(FAINT); e.setTextColor(INK); e.textSize = 15f
        e.setPadding(dp(16), dp(14), dp(16), dp(14)); e.inputType = type
        val bg = GradientDrawable(); bg.cornerRadius = dp(13).toFloat(); bg.setColor(SURFACE); bg.setStroke(dp(1), LINE); e.background = bg
        e.layoutParams = fld(); return e
    }
    private fun pickerField(value: String, onClick: () -> Unit): TextView {
        val t = TextView(this); t.text = value; t.setTextColor(if (value == "--:--") FAINT else INK); t.textSize = 15f
        t.setPadding(dp(16), dp(14), dp(16), dp(14))
        val bg = GradientDrawable(); bg.cornerRadius = dp(13).toFloat(); bg.setColor(SURFACE); bg.setStroke(dp(1), LINE); t.background = bg
        t.layoutParams = fld(); t.isClickable = true; t.setOnClickListener { onClick() }; return t
    }
    private fun iconBtn(res: Int, onClick: () -> Unit): ImageView {
        val img = ImageView(this); img.setImageResource(res); img.setColorFilter(SOFT)
        img.setPadding(dp(10), dp(10), dp(10), dp(10))
        val bg = GradientDrawable(); bg.cornerRadius = dp(12).toFloat(); bg.setColor(SURFACE); bg.setStroke(dp(1), LINE); img.background = bg
        img.layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
        img.isClickable = true; img.setOnClickListener { onClick() }; return img
    }
    private fun ImageView.setColorFilterTint(c: Int) { this.setColorFilter(c) }

    private fun flow(container: LinearLayout, chips: List<View>) {
        val avail = resources.displayMetrics.widthPixels - dp(44)
        var rowv = newFlowRow(); var used = 0
        for (c in chips) {
            val sp = View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
            c.measure(sp, sp)
            val w = c.measuredWidth + dp(7)
            val mlp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            mlp.rightMargin = dp(7); c.layoutParams = mlp
            if (used + w > avail && rowv.childCount > 0) { container.addView(rowv); rowv = newFlowRow(); used = 0 }
            rowv.addView(c); used += w
        }
        if (rowv.childCount > 0) container.addView(rowv)
    }
    private fun newFlowRow(): LinearLayout {
        val l = LinearLayout(this); l.orientation = LinearLayout.HORIZONTAL
        l.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).also { it.bottomMargin = dp(7) }
        return l
    }

    private fun fld(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).also { it.bottomMargin = dp(18) }
    private fun showErr(msg: String) { errBox.text = msg; errBox.visibility = View.VISIBLE }
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    private fun todayIso(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
    private fun fmtDate(iso: String): String = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(iso)?.let { "${it.groupValues[3]}/${it.groupValues[2]}/${it.groupValues[1]}" } ?: iso
}
