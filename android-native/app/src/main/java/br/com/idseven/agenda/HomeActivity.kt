package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import br.com.idseven.agenda.data.Perm
import br.com.idseven.agenda.data.Session

class HomeActivity : AppCompatActivity() {

    private var current = "hoje"
    private val WHITE = Color.parseColor("#f1f2f4")
    private val SOFT = Color.parseColor("#9ba0ab")

    private data class Tab(val container: Int, val ico: Int, val lbl: Int)
    private val tabDefs by lazy {
        linkedMapOf(
            "hoje" to Tab(R.id.navHoje, R.id.icoHoje, R.id.lblHoje),
            "agenda" to Tab(R.id.navAgenda, R.id.icoAgenda, R.id.lblAgenda),
            "board" to Tab(R.id.navQuadro, R.id.icoQuadro, R.id.lblQuadro),
            "team" to Tab(R.id.navEquipe, R.id.icoEquipe, R.id.lblEquipe),
            "chat" to Tab(R.id.navChat, R.id.icoChat, R.id.lblChat),
            "profile" to Tab(R.id.navPerfil, R.id.icoPerfil, R.id.lblPerfil)
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!Session.isLoggedIn(this)) { startActivity(Intent(this, MainActivity::class.java)); finish(); return }
        setContentView(R.layout.activity_home)

        tabDefs.forEach { (key, t) -> findViewById<LinearLayout>(t.container).setOnClickListener { select(key) } }
        findViewById<LinearLayout>(R.id.navNovo).setOnClickListener { onNovo() }

        select("hoje")
    }

    private fun onNovo() {
        if (!Perm.canManage(Session.name(this))) {
            Toast.makeText(this, "Apenas administradores criam compromissos. Você recebe e executa as demandas.", Toast.LENGTH_LONG).show()
            return
        }
        if (current == "board") Toast.makeText(this, "Novo no Quadro entra numa fase seguinte.", Toast.LENGTH_SHORT).show()
        else try {
            startActivity(Intent(this, EventFormActivity::class.java))
        } catch (e: Throwable) {
            Toast.makeText(this, "Não foi possível abrir o formulário: ${e.message ?: e.javaClass.simpleName}", Toast.LENGTH_LONG).show()
        }
    }

    fun selectTab(key: String) = select(key)

    private fun select(key: String) {        current = key
        tabDefs.forEach { (k, t) ->
            val color = if (k == key) WHITE else SOFT
            findViewById<ImageView>(t.ico).setColorFilter(color)
            findViewById<TextView>(t.lbl).setTextColor(color)
        }
        val frag: Fragment = when (key) {
            "hoje" -> HojeFragment()
            "agenda" -> AgendaFragment()
            "profile" -> PerfilFragment()
            "team" -> PlaceholderFragment.of("Equipe", "A tela de Equipe entra numa fase seguinte.")
            "board" -> PlaceholderFragment.of("Quadro", "O Quadro (tarefas) entra numa fase seguinte.")
            "chat" -> PlaceholderFragment.of("Chat", "O Chat entra numa fase seguinte.")
            else -> HojeFragment()
        }
        supportFragmentManager.beginTransaction().replace(R.id.content, frag).commit()
    }
}
