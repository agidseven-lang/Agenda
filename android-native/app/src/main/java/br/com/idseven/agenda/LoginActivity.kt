package br.com.idseven.agenda

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.AuthRepo
import br.com.idseven.agenda.data.Session

// Tela de Login FIEL ao PWA: marca + segmento Entrar/Criar cadastro + e-mail OU WhatsApp.
class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val seg1 = findViewById<TextView>(R.id.segLogin)
        val seg2 = findViewById<TextView>(R.id.segReg)
        val loginForm = findViewById<LinearLayout>(R.id.loginForm)
        val regForm = findViewById<LinearLayout>(R.id.regForm)
        val err = findViewById<TextView>(R.id.errBox)

        fun showLogin(login: Boolean) {
            err.visibility = View.GONE
            loginForm.visibility = if (login) View.VISIBLE else View.GONE
            regForm.visibility = if (login) View.GONE else View.VISIBLE
            seg1.setBackgroundResource(if (login) R.drawable.seg_on else 0)
            seg2.setBackgroundResource(if (login) 0 else R.drawable.seg_on)
            seg1.setTextColor(if (login) Color.parseColor("#f1f2f4") else Color.parseColor("#9ba0ab"))
            seg2.setTextColor(if (login) Color.parseColor("#9ba0ab") else Color.parseColor("#f1f2f4"))
        }
        seg1.setOnClickListener { showLogin(true) }
        seg2.setOnClickListener { showLogin(false) }

        // LOGIN
        val doLogin = findViewById<Button>(R.id.doLogin)
        doLogin.setOnClickListener {
            err.visibility = View.GONE
            doLogin.isEnabled = false; doLogin.text = "Entrando…"
            AuthRepo.login(
                findViewById<EditText>(R.id.lUser).text.toString(),
                findViewById<EditText>(R.id.lPass).text.toString()
            ) { r ->
                runOnUiThread {
                    when (r) {
                        is AuthRepo.Result.Ok -> {
                            Session.save(this, r.uid, r.name)
                            startActivity(Intent(this, HomeActivity::class.java)); finish()
                        }
                        is AuthRepo.Result.Err -> {
                            err.text = r.message; err.visibility = View.VISIBLE
                            doLogin.isEnabled = true; doLogin.text = "Entrar"
                        }
                    }
                }
            }
        }

        // CADASTRO
        val doReg = findViewById<Button>(R.id.doReg)
        doReg.setOnClickListener {
            err.visibility = View.GONE
            val name = findViewById<EditText>(R.id.rName).text.toString().trim()
            val role = findViewById<EditText>(R.id.rRole).text.toString().trim()
            val phone = findViewById<EditText>(R.id.rPhone).text.toString().trim()
            val email = findViewById<EditText>(R.id.rEmail).text.toString().trim()
            val pass = findViewById<EditText>(R.id.rPass).text.toString()
            if (name.isEmpty() || role.isEmpty() || phone.isEmpty() || email.isEmpty() || pass.isEmpty()) {
                err.text = "Preencha todos os campos do cadastro."; err.visibility = View.VISIBLE; return@setOnClickListener
            }
            if (pass.length < 4) { err.text = "A senha deve ter pelo menos 4 caracteres."; err.visibility = View.VISIBLE; return@setOnClickListener }
            doReg.isEnabled = false; doReg.text = "Enviando…"
            AuthRepo.register(name, role, phone, email, pass) { r ->
                runOnUiThread {
                    doReg.isEnabled = true; doReg.text = "Enviar cadastro para aprovação"
                    when (r) {
                        is AuthRepo.Result.Ok -> {
                            err.setTextColor(Color.parseColor("#34d399"))
                            err.text = "Cadastro enviado! Aguarde a liberação por um administrador."
                            err.visibility = View.VISIBLE
                            showLogin(true)
                        }
                        is AuthRepo.Result.Err -> { err.text = r.message; err.visibility = View.VISIBLE }
                    }
                }
            }
        }

        showLogin(true)
    }
}
