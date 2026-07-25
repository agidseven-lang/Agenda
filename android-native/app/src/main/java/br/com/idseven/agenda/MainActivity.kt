package br.com.idseven.agenda

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import br.com.idseven.agenda.data.auth.Auth
import br.com.idseven.agenda.data.auth.AuthResult
import br.com.idseven.agenda.data.fcm.Fcm

// F4.2C: roteador de entrada com RECUPERACAO SEGURA da sessao. Antes de abrir a Home,
// valida a sessao server-side + FirebaseAuth.currentUser + UID igual + getUserSelf +
// usuario ativo. Sem senha quando a sessao valida pode ser restaurada com seguranca.
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Auth.manager(this).restore { r ->
            runOnUiThread {
                when (r) {
                    is AuthResult.Ok -> {
                        Fcm.register(this)
                        startActivity(Intent(this, HomeActivity::class.java))
                    }
                    is AuthResult.Err -> {
                        startActivity(Intent(this, LoginActivity::class.java))
                    }
                }
                finish()
            }
        }
    }
}
