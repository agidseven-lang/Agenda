package br.com.idseven.agenda

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

// Tela de login (Fase 1: só a UI). O login real (Firestore + hash custom) entra na Fase 2.
class LoginActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val email = findViewById<EditText>(R.id.inEmail)
        val pass = findViewById<EditText>(R.id.inSenha)
        findViewById<Button>(R.id.btnEntrar).setOnClickListener {
            if (email.text.isNullOrBlank() || pass.text.isNullOrBlank()) {
                Toast.makeText(this, "Informe email e senha.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            // Fase 2: validar em users{} no Firestore com "s2:" + sha256(salt + "|" + senha).
            Toast.makeText(
                this,
                "Login real entra na Fase 2 (Firebase/Firestore).",
                Toast.LENGTH_LONG
            ).show()
        }
    }
}
