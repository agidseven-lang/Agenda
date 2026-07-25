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
import br.com.idseven.agenda.data.auth.Auth
import br.com.idseven.agenda.data.auth.AuthMessages
import br.com.idseven.agenda.data.auth.AuthResult
import br.com.idseven.agenda.data.fcm.Fcm

// F4.2C: login SERVER-SIDE + bridge Firebase. O cadastro client-side (inseguro) foi REMOVIDO:
// contas de producao sao criadas somente pelo fluxo administrativo oficial.
class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val seg1 = findViewById<TextView>(R.id.segLogin)
        val seg2 = findViewById<TextView>(R.id.segReg)
        val loginForm = findViewById<LinearLayout>(R.id.loginForm)
        val regForm = findViewById<LinearLayout>(R.id.regForm)
        val err = findViewById<TextView>(R.id.errBox)

        // Some com o segmento/aba de cadastro: nao ha auto-cadastro no app.
        seg2.visibility = View.GONE
        regForm.visibility = View.GONE
        loginForm.visibility = View.VISIBLE
        err.visibility = View.GONE
        seg1.setBackgroundResource(R.drawable.seg_on)
        seg1.setTextColor(Color.parseColor("#f1f2f4"))

        val doLogin = findViewById<Button>(R.id.doLogin)
        doLogin.setOnClickListener {
            err.visibility = View.GONE
            val id = findViewById<EditText>(R.id.lUser).text.toString()
            val pass = findViewById<EditText>(R.id.lPass).text.toString()
            if (id.isBlank() || pass.isBlank()) {
                err.text = "Preencha e-mail/WhatsApp e senha."
                err.visibility = View.VISIBLE
                return@setOnClickListener
            }
            doLogin.isEnabled = false; doLogin.text = "Entrando…"
            Auth.manager(this).signIn(id, pass) { r ->
                runOnUiThread {
                    when (r) {
                        is AuthResult.Ok -> {
                            Fcm.register(this)
                            startActivity(Intent(this, HomeActivity::class.java))
                            finish()
                        }
                        is AuthResult.Err -> {
                            err.text = AuthMessages.of(r.failure)
                            err.visibility = View.VISIBLE
                            doLogin.isEnabled = true; doLogin.text = "Entrar"
                        }
                    }
                }
            }
        }
    }
}
