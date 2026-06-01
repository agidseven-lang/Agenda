package br.com.idseven.agenda.nativebeta.data

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
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
    private val fn get() = FirebaseFunctions.getInstance("us-central1")
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

    // Redefinicao AUTONOMA por codigo de e-mail (1.0.39+). Chama Cloud Function
    // `requestPasswordReset`: backend envia codigo de 6 digitos via Resend, salva
    // hash em passwordResetCodes (TTL 15min, 5 tentativas). Cliente NUNCA escreve
    // direto; sempre resposta generica (anti-enumeracao).
    suspend fun requestPasswordReset(email: String): Result = suspendCancellableCoroutine { cont ->
        val em = email.trim().lowercase()
        if (em.isEmpty() || !em.contains("@") || !em.contains(".")) {
            cont.resume(Result.Err("Informe um e-mail válido.")); return@suspendCancellableCoroutine
        }
        fn.getHttpsCallable("requestPasswordReset")
            .call(hashMapOf("email" to em))
            .addOnSuccessListener { cont.resume(Result.Ok("", null)) }
            .addOnFailureListener {
                // Sempre amigavel; nao expor detalhes tecnicos.
                cont.resume(Result.Err("Não foi possível enviar sua solicitação agora. Tente novamente em instantes."))
            }
    }

    // Conclui a redefinicao: envia codigo + nova senha; backend valida e atualiza
    // pass/salt (mesmo padrao do app). Em sucesso, o usuario pode logar com a
    // senha nova. Mensagens vem do servidor (codigo errado / expirado / etc.).
    suspend fun confirmPasswordReset(email: String, code: String, newPassword: String, confirmPassword: String): Result =
        suspendCancellableCoroutine { cont ->
            val em = email.trim().lowercase()
            val cd = code.trim()
            if (em.isEmpty() || !em.contains("@")) {
                cont.resume(Result.Err("Informe um e-mail válido.")); return@suspendCancellableCoroutine
            }
            if (!cd.matches(Regex("^\\d{6}$"))) {
                cont.resume(Result.Err("O código deve ter 6 dígitos.")); return@suspendCancellableCoroutine
            }
            if (newPassword.length < 6) {
                cont.resume(Result.Err("A nova senha precisa ter pelo menos 6 caracteres.")); return@suspendCancellableCoroutine
            }
            if (newPassword != confirmPassword) {
                cont.resume(Result.Err("As senhas não coincidem.")); return@suspendCancellableCoroutine
            }
            fn.getHttpsCallable("confirmPasswordReset")
                .call(hashMapOf("email" to em, "code" to cd, "newPassword" to newPassword))
                .addOnSuccessListener { cont.resume(Result.Ok("", null)) }
                .addOnFailureListener { ex ->
                    val msg = if (ex is FirebaseFunctionsException) {
                        // Servidor manda mensagem amigavel via HttpsError; usar.
                        when (ex.code) {
                            FirebaseFunctionsException.Code.INVALID_ARGUMENT,
                            FirebaseFunctionsException.Code.NOT_FOUND,
                            FirebaseFunctionsException.Code.FAILED_PRECONDITION,
                            FirebaseFunctionsException.Code.DEADLINE_EXCEEDED,
                            FirebaseFunctionsException.Code.RESOURCE_EXHAUSTED,
                            FirebaseFunctionsException.Code.PERMISSION_DENIED ->
                                ex.message ?: "Não foi possível redefinir a senha."
                            else -> "Não foi possível redefinir a senha agora. Tente novamente em instantes."
                        }
                    } else "Não foi possível redefinir a senha agora. Tente novamente em instantes."
                    cont.resume(Result.Err(msg))
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
