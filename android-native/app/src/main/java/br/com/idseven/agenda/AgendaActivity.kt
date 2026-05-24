package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.EventItem
import br.com.idseven.agenda.data.EventRepo
import br.com.idseven.agenda.data.Session
import com.google.firebase.firestore.ListenerRegistration

class AgendaActivity : AppCompatActivity() {

    private var registration: ListenerRegistration? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (!Session.isLoggedIn(this)) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_agenda)

        val nome = Session.name(this).takeUnless { it.isNullOrBlank() } ?: "usuário"
        findViewById<TextView>(R.id.txtOla).text = "Olá, $nome"

        findViewById<Button>(R.id.btnNovo).setOnClickListener {
            startActivity(Intent(this, EventFormActivity::class.java))
        }
        findViewById<Button>(R.id.btnSair).setOnClickListener {
            Session.clear(this)
            val i = Intent(this, MainActivity::class.java)
            i.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(i)
            finish()
        }
    }

    override fun onStart() {
        super.onStart()
        val erro = findViewById<TextView>(R.id.txtErro)
        registration = EventRepo.listen(
            onData = { events ->
                runOnUiThread {
                    erro.text = ""
                    render(events)
                }
            },
            onError = { msg -> runOnUiThread { erro.text = msg } }
        )
    }

    override fun onStop() {
        super.onStop()
        registration?.remove()
        registration = null
    }

    private fun render(events: List<EventItem>) {
        val container = findViewById<LinearLayout>(R.id.listaEventos)
        container.removeAllViews()
        if (events.isEmpty()) {
            container.addView(textRow("Nenhum compromisso encontrado.", Color.parseColor("#6b7280")))
            return
        }
        for (e in events) {
            val title = e.title?.takeUnless { it.isBlank() } ?: e.client ?: "Sem título"
            val when0 = listOfNotNull(e.date, e.start?.let { s -> e.end?.let { "$s–$it" } ?: s })
                .joinToString(" · ")
            val sub = listOfNotNull(
                e.client?.takeUnless { it.isBlank() },
                when0.takeUnless { it.isBlank() },
                e.statusLabel()
            ).joinToString("  •  ")
            container.addView(eventCard(title, sub))
        }
    }

    private fun eventCard(title: String, sub: String): LinearLayout {
        val card = LinearLayout(this)
        card.orientation = LinearLayout.VERTICAL
        card.setBackgroundColor(Color.parseColor("#16181d"))
        val lp = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        )
        lp.bottomMargin = dp(10)
        card.layoutParams = lp
        card.setPadding(dp(14), dp(12), dp(14), dp(12))

        val t = TextView(this)
        t.text = title
        t.setTextColor(Color.WHITE)
        t.textSize = 15f
        card.addView(t)

        val s = TextView(this)
        s.text = sub
        s.setTextColor(Color.parseColor("#9aa0ac"))
        s.textSize = 13f
        card.addView(s)
        return card
    }

    private fun textRow(text: String, color: Int): TextView {
        val tv = TextView(this)
        tv.text = text
        tv.setTextColor(color)
        tv.gravity = Gravity.CENTER
        tv.setPadding(0, dp(24), 0, 0)
        return tv
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()
}
