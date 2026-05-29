package br.com.idseven.agenda.data

import com.google.firebase.firestore.FirebaseFirestore

// Login custom (sem Firebase Auth), FIEL ao web:
//  - aceita E-MAIL OU WHATSAPP (igual ao doLogin do PWA);
//  - valida senha "s2:"+sha256(salt+"|"+senha);
//  - cadastro cria users{} com status "pendente".
object AuthRepo {

    sealed class Result {
        data class Ok(val uid: String, val name: String?) : Result()
        data class Err(val message: String) : Result()
    }

    private val db get() = FirebaseFirestore.getInstance()
    private fun digits(s: String) = s.replace(Regex("\\D"), "")

    fun login(idOrPhone: String, password: String, cb: (Result) -> Unit) {
        val id = idOrPhone.trim().lowercase()
        if (id.isEmpty() || password.isEmpty()) { cb(Result.Err("Preencha e-mail/WhatsApp e senha.")); return }
        val idDigits = digits(id)
        db.collection("users").get()
            .addOnSuccessListener { snap ->
                val doc = snap.documents.firstOrNull { d ->
                    val email = (d.getString("email") ?: "").lowercase()
                    val phone = digits(d.getString("phone") ?: "")
                    email == id || (idDigits.isNotEmpty() && phone == idDigits)
                }
                if (doc == null) { cb(Result.Err("E-mail/WhatsApp ou senha incorretos.")); return@addOnSuccessListener }
                when (doc.getString("status")) {
                    "pendente" -> { cb(Result.Err("Cadastro aguardando aprovação.")); return@addOnSuccessListener }
                    "removido", "excluido" -> { cb(Result.Err("Conta inativa.")); return@addOnSuccessListener }
                }
                val pass = doc.getString("pass"); val salt = doc.getString("salt")
                if (!Crypto.verify(pass, salt, password)) { cb(Result.Err("E-mail/WhatsApp ou senha incorretos.")); return@addOnSuccessListener }
                cb(Result.Ok(doc.id, doc.getString("name")))
            }
            .addOnFailureListener { ex -> cb(Result.Err("Não foi possível entrar agora. Verifique a internet. (${ex.message})")) }
    }

    fun register(name: String, role: String, phone: String, email: String, password: String, cb: (Result) -> Unit) {
        val salt = Crypto.randSalt()
        val data = hashMapOf<String, Any?>(
            "name" to name.trim(),
            "role" to role.trim(),
            "phone" to phone.trim(),
            "email" to email.trim().lowercase(),
            "pass" to Crypto.hashPw(password, salt),
            "salt" to salt,
            "status" to "pendente",
            "admin" to false,
            "createdAt" to System.currentTimeMillis()
        )
        db.collection("users").add(data)
            .addOnSuccessListener { ref -> cb(Result.Ok(ref.id, name)) }
            .addOnFailureListener { ex -> cb(Result.Err("Erro ao enviar cadastro: ${ex.message ?: "tente novamente"}")) }
    }
}
