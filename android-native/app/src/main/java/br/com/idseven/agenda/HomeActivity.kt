package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.Perm
import br.com.idseven.agenda.data.Session

class HomeActivity : AppCompatActivity() {

    private var current = "agenda"
    private val tabs by lazy {
        mapOf(
            "hoje" to findViewById<TextView>(R.id.tabHoje),
            "agenda" to findViewById<TextView>(R.id.tabAgenda),
            "board" to findViewById<TextView>(R.id.tabQuadro),
            "team" to findViewById<TextView>(R.id.tabEquipe),
            "chat" to findViewById<TextView>(R.id.tabChat),
            "profile" to findViewById<TextView>(R.id.tabPerfil)
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Session.isLoggedIn(this)) {
            startActivity(Intent(this, MainActivity::class.java)); finish(); return
        }
        setContentView(R.layout.activity_home)

        tabs.forEach { (key, view) -> view.setOnClickListener { select(key) } }
        findViewById<TextView>(R.id.tabNovo).setOnClickListener { onNovo() }

        select("agenda")
    }

    private fun onNovo() {
        if (!Perm.canManage(Session.name(this))) {
            Toast.makeText(
                this,
                "Apenas administradores criam compromissos. Você recebe e executa as demandas.",
                Toast.LENGTH_LONG
            ).show()
            return
        }
        if (current == "board") {
            Toast.makeText(this, "Novo no Quadro entra numa fase seguinte.", Toast.LENGTH_SHORT).show()
        } else {
            startActivity(Intent(this, EventFormActivity::class.java))
        }
    }

    private fun select(key: String) {
        current = key
        tabs.forEach { (k, v) ->
            v.setTextColor(if (k == key) Color.WHITE else Color.parseColor("#9aa0ac"))
        }
        val frag: Fragment = when (key) {
            "agenda" -> AgendaFragment()
            "profile" -> PerfilFragment()
            "team" -> PlaceholderFragment.of("Equipe", "A tela de Equipe entra numa fase seguinte.")
            "board" -> PlaceholderFragment.of("Quadro", "O Quadro (tarefas) entra numa fase seguinte.")
            "chat" -> PlaceholderFragment.of("Chat", "O Chat entra numa fase seguinte.")
            else -> PlaceholderFragment.of("Hoje", "A tela Hoje entra numa fase seguinte.")
        }
        supportFragmentManager.beginTransaction().replace(R.id.content, frag).commit()
    }
}
