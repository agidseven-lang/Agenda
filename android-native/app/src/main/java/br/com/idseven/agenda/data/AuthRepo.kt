package br.com.idseven.agenda.data

import com.google.firebase.firestore.FirebaseFirestore

// Login custom (sem Firebase Auth), igual ao web: busca em users{} por email e valida o hash.
object AuthRepo {

    sealed class Result {
        data class Ok(val uid: String, val name: String?) : Result()
        data class Err(val message: String) : Result()
    }

    private val db get() = FirebaseFirestore.getInstance()

    fun login(email: String, password: String, cb: (Result) -> Unit) {
        val e = email.trim().lowercase()
        if (e.isEmpty() || password.isEmpty()) {
            cb(Result.Err("Informe email e senha.")); return
        }
        db.collection("users")
            .whereEqualTo("email", e)
            .limit(1)
            .get()
            .addOnSuccessListener { snap ->
                if (snap.isEmpty) {
                    cb(Result.Err("Usuário não encontrado.")); return@addOnSuccessListener
                }
                val doc = snap.documents[0]
                when (doc.getString("status")) {
                    "pendente" -> { cb(Result.Err("Cadastro aguardando aprovação.")); return@addOnSuccessListener }
                    "removido", "excluido" -> { cb(Result.Err("Conta inativa.")); return@addOnSuccessListener }
                }
                val pass = doc.getString("pass")
                val salt = doc.getString("salt")
                if (pass.isNullOrBlank()) {
                    cb(Result.Err("Erro de schema: usuário sem senha cadastrada.")); return@addOnSuccessListener
                }
                if (!Crypto.verify(pass, salt, password)) {
                    cb(Result.Err("Senha incorreta.")); return@addOnSuccessListener
                }
                cb(Result.Ok(doc.id, doc.getString("name")))
            }
            .addOnFailureListener { ex ->
                cb(Result.Err("Erro de conexão: ${ex.message ?: "tente novamente"}"))
            }
    }
}
