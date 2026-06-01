package br.com.idseven.agenda.nativebeta.data

import com.google.firebase.firestore.FirebaseFirestore
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

// Login custom (sem Firebase Auth), FIEL ao PWA:
//  - aceita E-MAIL OU WHATSAPP;
//  - valida senha "s2:"+sha256(salt+"|"+senha) (com fallback legado);
//  - cadastro cria users{} com status "pendente".
// Reset de senha por ADMIN (sem e-mail): app cria solicitação em
// passwordResetRequests; admin define senha temporária e marca mustChangePassword=true;
// no próximo login o app obriga troca (changePassword) e zera a flag.
object AuthRepo {

    sealed class Result {
        // mustChangePassword: usuário entrou com senha temporária; precisa trocar antes
        // de receber sessão. O caller (VM) NÃO grava sessão até a troca concluir.
        data class Ok(val uid: String, val name: String?, val mustChangePassword: Boolean = false) : Result()
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
                val mustChange = doc.getBoolean("mustChangePassword") == true
                cont.resume(Result.Ok(doc.id, doc.getString("name"), mustChange))
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

    // Cria solicitação de redefinição (admin trata fora do app). NÃO revela existência:
    // sempre retorna sucesso para o caller (caller exibe mensagem genérica).
    // Aditivo: coleção passwordResetRequests; não toca users/* nem auth.
    suspend fun requestPasswordReset(idOrPhone: String): Result = suspendCancellableCoroutine { cont ->
        val raw = idOrPhone.trim()
        if (raw.isEmpty()) {
            cont.resume(Result.Err("Informe seu e-mail ou WhatsApp.")); return@suspendCancellableCoroutine
        }
        val id = raw.lowercase()
        val isEmail = id.contains("@")
        val data = hashMapOf<String, Any?>(
            // Guarda o identificador informado SEM checar existência (anti-enumeração).
            "identifier" to id,
            "kind" to (if (isEmail) "email" else "phone"),
            "phoneDigits" to (if (isEmail) "" else digits(id)),
            "createdAt" to System.currentTimeMillis(),
            "status" to "pending",
            "source" to "nativebeta",
            "handledBy" to null,
            "handledAt" to null,
        )
        db.collection("passwordResetRequests").add(data)
            .addOnSuccessListener { cont.resume(Result.Ok("", null)) }
            .addOnFailureListener {
                // NUNCA expor PERMISSION_DENIED / detalhes tecnicos ao usuario.
                // Mensagem amigavel unica para qualquer falha (rede, regras, etc).
                cont.resume(Result.Err("Não foi possível enviar sua solicitação agora. Tente novamente em instantes."))
            }
    }

    // Troca de senha após login com senha temporária. Re-autentica com a senha antiga
    // (defesa em profundidade), atualiza hash e zera mustChangePassword. Não cria sessão.
    suspend fun changePassword(uid: String, currentPassword: String, newPassword: String): Result =
        suspendCancellableCoroutine { cont ->
            if (newPassword.length < 6) {
                cont.resume(Result.Err("A nova senha precisa ter pelo menos 6 caracteres.")); return@suspendCancellableCoroutine
            }
            if (newPassword == currentPassword) {
                cont.resume(Result.Err("A nova senha deve ser diferente da atual.")); return@suspendCancellableCoroutine
            }
            val ref = db.collection("users").document(uid)
            ref.get().addOnSuccessListener { d ->
                if (d == null || !d.exists()) { cont.resume(Result.Err("Conta não encontrada.")); return@addOnSuccessListener }
                if (!Crypto.verify(d.getString("pass"), d.getString("salt"), currentPassword)) {
                    cont.resume(Result.Err("Senha atual incorreta.")); return@addOnSuccessListener
                }
                val salt = Crypto.randSalt()
                ref.update(
                    mapOf(
                        "pass" to Crypto.hashPw(newPassword, salt),
                        "salt" to salt,
                        "mustChangePassword" to false,
                        "passwordChangedAt" to System.currentTimeMillis(),
                    )
                ).addOnSuccessListener { cont.resume(Result.Ok(uid, d.getString("name"))) }
                    .addOnFailureListener { ex -> cont.resume(Result.Err("Não foi possível atualizar a senha. (${ex.message})")) }
            }.addOnFailureListener { ex ->
                cont.resume(Result.Err("Não foi possível verificar a conta. (${ex.message})"))
            }
        }
}
