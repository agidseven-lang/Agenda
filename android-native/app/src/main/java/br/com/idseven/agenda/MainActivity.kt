package br.com.idseven.agenda

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.Session

// Tela inicial. Se já há sessão salva, vai direto pra Agenda; senão mostra boas-vindas → Login.
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Session.isLoggedIn(this)) {
            startActivity(Intent(this, HomeActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        findViewById<Button>(R.id.btnContinuar).setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }
    }
}
