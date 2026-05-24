package br.com.idseven.agenda

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.*
import com.google.firebase.firestore.ListenerRegistration

class EventDetailActivity : AppCompatActivity() {

    private var reg: ListenerRegistration? = null
    private lateinit var id: String
    private lateinit var box: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        id = intent.getStringExtra("id") ?: run { finish(); return }

        val scroll = ScrollView(this); scroll.setBackgroundColor(Color.parseColor("#0b0c0f"))
        box = LinearLayout(this); box.orientation = LinearLayout.VERTICAL; box.setPadding(dp(20), dp(20), dp(20), dp(28))
        scroll.addView(box); setContentView(scroll)
    }

    override fun onStart() {
        super.onStart()
        reg = EventRepo.listenOne(id) { e -> runOnUiThread { if (e == null) finish() else render(e) } }
    }

    override fun onStop() { super.onStop(); reg?.remove(); reg = null }

    private fun render(e: EventItem) {
        box.removeAllViews()
        val t = Types.of(e.type)
        val admin = Perm.canManage(Session.name(this))

        addTag(t.label, t.color)
        addTitle(e.title?.ifBlank { null } ?: e.client ?: "Sem título")

        addField("Cliente / Empresa", e.client)
        addField("Responsável", e.owner)
        addField("Data", e.date)
        addField("Horário", if (e.start != null) (if (e.end != null) "${e.start} — ${e.end}" else e.start) else null)
        EventStatus.status(e)?.let { addField("Situação", it.text) }
        if (e.startedAt != null && e.startedAt > 0) addField("Iniciada em", fmt(e.startedAt))
        if (e.done && e.doneAt != null) addField("Finalizada em", fmt(e.doneAt))
        addField("Local", e.location)
        addField("Observações", e.notes)

        // Ações de execução (todos)
        if (!e.done && (e.startedAt == null || e.startedAt <= 0)) {
            addButton("▶ Iniciar agora", Color.parseColor("#1e2330")) {
                EventRepo.start(id, Session.uid(this), { toast("Iniciado") }, { m -> toast(m) })
            }
        }
        if (!e.done) {
            addButton("✓ Finalizar agora", Color.parseColor("#5b6cff")) {
                EventRepo.finish(id, Session.uid(this), { toast("Finalizado") }, { m -> toast(m) })
            }
        } else {
            addButton("Reabrir", Color.parseColor("#16181d")) {
                EventRepo.reopen(id, { toast("Reaberto") }, { m -> toast(m) })
            }
        }

        // Edição/exclusão (apenas admin)
        if (admin) {
            addButton("Editar", Color.parseColor("#16181d")) {
                startActivity(Intent(this, EventFormActivity::class.java).putExtra("id", id))
            }
            addButton("Excluir", Color.parseColor("#7a1f1f")) {
                AlertDialog.Builder(this)
                    .setTitle("Excluir compromisso")
                    .setMessage("Excluir este compromisso para toda a equipe?")
                    .setNegativeButton("Cancelar", null)
                    .setPositiveButton("Excluir") { _, _ ->
                        EventRepo.delete(id, { toast("Excluído"); finish() }, { m -> toast(m) })
                    }.show()
            }
        }
    }

    private fun addTag(label: String, color: Int) {
        val tv = TextView(this); tv.text = label; tv.setTextColor(color); tv.textSize = 13f
        tv.setPadding(0, 0, 0, dp(6)); box.addView(tv)
    }
    private fun addTitle(s: String) {
        val tv = TextView(this); tv.text = s; tv.setTextColor(Color.WHITE); tv.textSize = 22f; tv.setPadding(0, 0, 0, dp(14)); box.addView(tv)
    }
    private fun addField(label: String, value: String?) {
        if (value.isNullOrBlank()) return
        val l = TextView(this); l.text = label; l.setTextColor(Color.parseColor("#6b7280")); l.textSize = 12f; l.setPadding(0, dp(8), 0, 0)
        val v = TextView(this); v.text = value; v.setTextColor(Color.WHITE); v.textSize = 15f
        box.addView(l); box.addView(v)
    }
    private fun addButton(text: String, color: Int, onClick: () -> Unit) {
        val b = Button(this); b.text = text; b.setTextColor(Color.WHITE); b.setBackgroundColor(color)
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        lp.topMargin = dp(10); b.layoutParams = lp; b.setOnClickListener { onClick() }; box.addView(b)
    }
    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()
    private fun fmt(ms: Long): String = android.text.format.DateFormat.format("dd/MM HH:mm", ms).toString()
    private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
}
