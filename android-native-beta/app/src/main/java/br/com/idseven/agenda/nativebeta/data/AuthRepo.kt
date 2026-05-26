package br.com.idseven.agenda.nativebeta.data

import com.google.firebase.firestore.FirebaseFirestore
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

// Login custom (sem Firebase Auth), FIEL ao PWA:
//  - aceita E-MAIL OU WHATSAPP;
//  - valida senha "s2:"+sha256(salt+"|"+senha) (com fallback legado);
//  - cadastro cria users{} com status "pendente".
object AuthRepo {

    sealed class Result {
        data class Ok(val uid: String, val name: String?) : Result()
        data class Err(val message: String) : Result()
    }

    private val db get() = FirebaseFirestore.getInstance()
    private fun digits(s: String) = s.replace(Regex("\\D"), "")

    suspend fun login(idOrPhone: String, password: String): Result = suspendCancellableCoroutine { cont ->
        val id = idOrPhone.trim().lowercase()
        if (id.isEmpty() || password.isEmpty()) {
            cont.resume(Result.Err("Preencha e-mail/WhatsApp e senha.")); return@suspendCancellableCoroutine
        }
        val idDigits = digits(id)
        db.collection("users").get()
            .addOnSuccessListener { snap ->
                val doc = snap.documents.firstOrNull { d ->
                    val email = (d.getString("email") ?: "").lowercase()
                    val phone = digits(d.getString("phone") ?: "")
                    email == id || (idDigits.isNotEmpty() && phone == idDigits)
                }
                if (doc == null) { cont.resume(Result.Err("E-mail/WhatsApp ou senha incorretos.")); return@addOnSuccessListener }
                when (doc.getString("status")) {
                    "pendente" -> { cont.resume(Result.Err("Cadastro aguardando aprovação.")); return@addOnSuccessListener }
                    "removido", "excluido" -> { cont.resume(Result.Err("Conta inativa.")); return@addOnSuccessListener }
                }
                if (!Crypto.verify(doc.getString("pass"), doc.getString("salt"), password)) {
                    cont.resume(Result.Err("E-mail/WhatsApp ou senha incorretos.")); return@addOnSuccessListener
                }
                cont.resume(Result.Ok(doc.id, doc.getString("name")))
            }
            .addOnFailureListener { ex ->
                cont.resume(Result.Err("Não foi possível entrar agora. Verifique a internet. (${ex.message})"))
            }
    }

    suspend fun register(name: String, role: String, phone: String, email: String, password: String): Result =
        suspendCancellableCoroutine { cont ->
            val n = name.trim(); val em = email.trim().lowercase()
            if (n.isEmpty() || em.isEmpty() || password.isEmpty()) {
                cont.resume(Result.Err("Preencha nome, e-mail e senha.")); return@suspendCancellableCoroutine
            }
            val salt = Crypto.randSalt()
            val data = hashMapOf<String, Any?>(
                "name" to n,
                "role" to role.trim(),
                "phone" to phone.trim(),
                "email" to em,
                "pass" to Crypto.hashPw(password, salt),
                "salt" to salt,
                "status" to "pendente",
                "admin" to false,
                "createdAt" to System.currentTimeMillis()
            )
            db.collection("users").add(data)
                .addOnSuccessListener { ref -> cont.resume(Result.Ok(ref.id, n)) }
                .addOnFailureListener { ex -> cont.resume(Result.Err("Erro ao enviar cadastro: ${ex.message ?: "tente novamente"}")) }
        }
}
