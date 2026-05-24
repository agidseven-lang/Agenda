package br.com.idseven.agenda

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.AuthRepo
import br.com.idseven.agenda.data.Session

// Login REAL (Fase 2): valida em users{} no Firestore com o mesmo hash do web. Sem Firebase Auth.
class LoginActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val email = findViewById<EditText>(R.id.inEmail)
        val pass = findViewById<EditText>(R.id.inSenha)
        val btn = findViewById<Button>(R.id.btnEntrar)
        val err = findViewById<TextView>(R.id.txtErro)

        btn.setOnClickListener {
            err.text = ""
            btn.isEnabled = false
            btn.text = "Entrando..."
            AuthRepo.login(email.text.toString(), pass.text.toString()) { result ->
                runOnUiThread {
                    when (result) {
                        is AuthRepo.Result.Ok -> {
                            Session.save(this, result.uid, result.name)
                            startActivity(Intent(this, AgendaActivity::class.java))
                            finish()
                        }
                        is AuthRepo.Result.Err -> {
                            err.text = result.message
                            btn.isEnabled = true
                            btn.text = "Entrar"
                        }
                    }
                }
            }
        }
    }
}
