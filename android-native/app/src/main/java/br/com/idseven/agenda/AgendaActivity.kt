package br.com.idseven.agenda

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.Session

// Tela inicial da agenda (Fase 2: simples). A lista/criação de compromissos entra na Fase 3.
class AgendaActivity : AppCompatActivity() {
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

        findViewById<Button>(R.id.btnSair).setOnClickListener {
            Session.clear(this)
            val i = Intent(this, MainActivity::class.java)
            i.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(i)
            finish()
        }
    }
}
