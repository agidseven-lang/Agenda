package br.com.idseven.agenda

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore

// Form fiel de compromisso (grade de tipos + responsável + campos reais). Grava no schema do PWA.
class EventFormActivity : AppCompatActivity() {

    private val dateRegex = Regex("^\\d{4}-\\d{2}-\\d{2}$")
    private val timeRegex = Regex("^\\d{1,2}:\\d{2}$")

    private var editId: String? = null
    private var selType = "outro"
    private var selOwnerId: String? = null
    private var selOwnerName: String? = null
    private var team: List<UserLite> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Perm.canManage(Session.name(this))) { finish(); return }
        setContentView(R.layout.activity_event_form)

        editId = intent.getStringExtra("id")
        selOwnerId = Session.uid(this)
        selOwnerName = Session.name(this)

        if (editId != null) {
            findViewById<TextView>(R.id.formTitle).text = "Editar compromisso"
        }

        buildTypeGrid()
        loadTeam()

        if (editId != null) prefill(editId!!)

        findViewById<Button>(R.id.btnSalvar).setOnClickListener { save() }
    }

    private fun buildTypeGrid() {
        val grid = findViewById<LinearLayout>(R.id.typeGrid)
        grid.removeAllViews()
        for (t in Types.ALL) {
            val tv = TextView(this)
            tv.text = t.label; tv.gravity = Gravity.CENTER; tv.textSize = 12f
            tv.setPadding(dp(6), dp(8), dp(6), dp(8))
            val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f); lp.rightMargin = dp(4)
            tv.layoutParams = lp
            val selected = t.key == selType
            val bg = GradientDrawable(); bg.cornerRadius = dp(8).toFloat()
            bg.setColor(if (selected) t.color else Color.parseColor("#16181d"))
            if (!selected) bg.setStroke(dp(1), t.color)
            tv.background = bg
            tv.setTextColor(if (selected) Color.WHITE else t.color)
            tv.setOnClickListener { selType = t.key; buildTypeGrid() }
            grid.addView(tv)
        }
    }

    private fun loadTeam() {
        FirebaseFirestore.getInstance().collection("users").get()
            .addOnSuccessListener { snap ->
                team = snap.documents.map {
                    UserLite(it.id, it.getString("name"), it.getString("color"), it.getString("photo"), it.getString("status"))
                }.filter { it.isActive() }
                buildOwnerChips()
            }
    }

    private fun buildOwnerChips() {
        val chips = findViewById<LinearLayout>(R.id.ownerChips)
        chips.removeAllViews()
        for (u in team) {
            val tv = TextView(this)
            tv.text = UserColor.firstName(u.name).ifBlank { u.name ?: "?" }
            tv.gravity = Gravity.CENTER; tv.textSize = 13f
            tv.setPadding(dp(14), dp(8), dp(14), dp(8))
            val selected = u.id == selOwnerId
            val bg = GradientDrawable(); bg.cornerRadius = dp(20).toFloat()
            bg.setColor(if (selected) UserColor.of(u.id, u.color) else Color.parseColor("#16181d"))
            tv.background = bg
            tv.setTextColor(if (selected) Color.WHITE else Color.parseColor("#9aa0ac"))
            val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT); lp.rightMargin = dp(8)
            tv.layoutParams = lp
            tv.setOnClickListener { selOwnerId = u.id; selOwnerName = u.name; buildOwnerChips() }
            chips.addView(tv)
        }
    }

    private fun prefill(id: String) {
        FirebaseFirestore.getInstance().collection("events").document(id).get()
            .addOnSuccessListener { d ->
                if (!d.exists()) return@addOnSuccessListener
                selType = d.getString("type") ?: "outro"
                selOwnerId = d.getString("ownerId") ?: selOwnerId
                selOwnerName = d.getString("owner") ?: selOwnerName
                findViewById<EditText>(R.id.inCliente).setText(d.getString("client") ?: "")
                findViewById<EditText>(R.id.inTitulo).setText(d.getString("title") ?: "")
                findViewById<EditText>(R.id.inLocal).setText(d.getString("location") ?: "")
                findViewById<EditText>(R.id.inData).setText(d.getString("date") ?: "")
                findViewById<EditText>(R.id.inInicio).setText(d.getString("start") ?: "")
                findViewById<EditText>(R.id.inFim).setText(d.getString("end") ?: "")
                findViewById<EditText>(R.id.inNotas).setText(d.getString("notes") ?: "")
                buildTypeGrid(); buildOwnerChips()
            }
    }

    private fun save() {
        val erro = findViewById<TextView>(R.id.txtErro); erro.text = ""
        val cliente = txt(R.id.inCliente); val titulo = txt(R.id.inTitulo)
        val local = txt(R.id.inLocal); val data = txt(R.id.inData)
        val inicio = txt(R.id.inInicio); val fim = txt(R.id.inFim); val notas = txt(R.id.inNotas)

        if (cliente.isEmpty() && titulo.isEmpty()) { erro.text = "Informe o cliente ou o título."; return }
        if (!dateRegex.matches(data)) { erro.text = "Data no formato AAAA-MM-DD."; return }
        if (inicio.isNotEmpty() && !timeRegex.matches(inicio)) { erro.text = "Hora inicial no formato HH:MM."; return }
        if (fim.isNotEmpty() && !timeRegex.matches(fim)) { erro.text = "Hora final no formato HH:MM."; return }

        val now = System.currentTimeMillis()
        val m = HashMap<String, Any?>()
        m["type"] = selType
        m["client"] = cliente
        m["title"] = titulo
        m["location"] = local
        m["date"] = data
        m["start"] = inicio
        m["end"] = fim
        m["notes"] = notas
        m["owner"] = selOwnerName ?: ""
        m["ownerId"] = selOwnerId
        m["updatedAt"] = now

        val btn = findViewById<Button>(R.id.btnSalvar); btn.isEnabled = false; btn.text = "Salvando..."

        if (editId != null) {
            // reagendou → limpa estado de lembrete (regra V64.5), o Worker reenvia no novo horário
            m["reminderSentAt"] = FieldValue.delete()
            EventRepo.update(editId!!, m,
                onOk = { runOnUiThread { finish() } },
                onError = { msg -> runOnUiThread { erro.text = msg; btn.isEnabled = true; btn.text = "Salvar" } })
        } else {
            m["by"] = Session.uid(this)
            m["done"] = false
            m["createdAt"] = now
            EventRepo.create(m,
                onOk = { runOnUiThread { finish() } },
                onError = { msg -> runOnUiThread { erro.text = msg; btn.isEnabled = true; btn.text = "Salvar" } })
        }
    }

    private fun txt(id: Int): String = findViewById<EditText>(id).text.toString().trim()
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
}
