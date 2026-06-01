package br.com.idseven.agenda.nativebeta.data

import android.util.Log
import br.com.idseven.agenda.nativebeta.BuildConfig
import com.google.firebase.firestore.FirebaseFirestore
import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject

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

    // Endpoints HTTPS onRequest (1.0.43+). URLs sao as URIs REAIS resolvidas
    // no CI via `gcloud functions describe ... --format=value(serviceConfig.uri)`
    // e injetadas via buildConfigField. Nao ha URL presumida no codigo.
    private val FN_REQUEST_URL: String = BuildConfig.PASSWORD_RESET_REQUEST_URL
    private val FN_CONFIRM_URL: String = BuildConfig.PASSWORD_RESET_CONFIRM_URL
    private const val TAG = "AuthRepo"

    private fun classifyError(e: Throwable): String = when (e) {
        is SocketTimeoutException -> "TIMEOUT"
        is UnknownHostException -> "UNKNOWN_HOST"
        is SSLException -> "SSL"
        is IOException -> "NETWORK"
        else -> "OTHER"
    }

    // POST JSON via HttpURLConnection (sem lib externa). Retorna Triple(httpCode,
    // bodyString, exceptionOrNull). Em erro de rede/SSL/timeout, exception
    // preenchido; em resposta HTTP, code+body preenchidos. Roda em Dispatchers.IO.
    private suspend fun postJson(url: String, payload: JSONObject): Triple<Int, String, Throwable?> =
        withContext(Dispatchers.IO) {
            if (url.isBlank()) return@withContext Triple(0, "", IllegalStateException("URL vazia (build sem -PPASSWORD_RESET_*_URL)"))
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 15000
                    readTimeout = 20000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    setRequestProperty("Accept", "application/json")
                }
                conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
                val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                Triple(code, text, null)
            } catch (e: Throwable) {
                Triple(0, "", e)
            } finally {
                conn?.disconnect()
            }
        }

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

    // Redefinicao AUTONOMA por codigo de e-mail (1.0.43+, endpoint HTTPS
    // onRequest com URL real injetada por BuildConfig). Logs internos detalhados
    // (URL chamada, HTTP, body, classe e mensagem da exception) — usuario final
    // ve apenas mensagem amigavel.
    suspend fun requestPasswordReset(email: String): Result {
        val em = email.trim().lowercase()
        if (em.isEmpty() || !em.contains("@") || !em.contains(".")) {
            return Result.Err("Informe um e-mail válido.")
        }
        val url = FN_REQUEST_URL
        val (http, body, exc) = postJson(url, JSONObject().put("email", em))
        if (exc != null) {
            Log.w(TAG, "requestReset url=$url cls=${exc.javaClass.simpleName} kind=${classifyError(exc)} msg=${exc.message?.take(200)}")
            return Result.Err("Não foi possível enviar sua solicitação agora. Verifique a internet e tente de novo.")
        }
        Log.i(TAG, "requestReset url=$url http=$http body=${body.take(200)}")
        return if (http == 200) Result.Ok("", null)
        else Result.Err("Não foi possível enviar sua solicitação agora. Tente novamente em instantes.")
    }

    // Conclui a redefinicao: envia codigo + nova senha ao endpoint HTTPS; backend
    // valida e atualiza pass/salt (mesmo padrao do app). Respostas JSON com
    // {ok:false, code, message} viram mensagem amigavel vinda do servidor.
    suspend fun confirmPasswordReset(email: String, code: String, newPassword: String, confirmPassword: String): Result {
        val em = email.trim().lowercase()
        val cd = code.trim()
        if (em.isEmpty() || !em.contains("@")) return Result.Err("Informe um e-mail válido.")
        if (!cd.matches(Regex("^\\d{6}$"))) return Result.Err("O código deve ter 6 dígitos.")
        if (newPassword.length < 6) return Result.Err("A nova senha precisa ter pelo menos 6 caracteres.")
        if (newPassword != confirmPassword) return Result.Err("As senhas não coincidem.")
        val url = FN_CONFIRM_URL
        val payload = JSONObject().put("email", em).put("code", cd).put("newPassword", newPassword)
        val (http, body, exc) = postJson(url, payload)
        if (exc != null) {
            Log.w(TAG, "confirmReset url=$url cls=${exc.javaClass.simpleName} kind=${classifyError(exc)} msg=${exc.message?.take(200)}")
            return Result.Err("Não foi possível redefinir a senha agora. Verifique a internet e tente de novo.")
        }
        Log.i(TAG, "confirmReset url=$url http=$http body=${body.take(200)}")
        val json = runCatching { JSONObject(body) }.getOrNull()
        return when {
            http == 200 && json?.optBoolean("ok", false) == true -> Result.Ok("", null)
            json != null && json.has("message") ->
                Result.Err(json.optString("message", "Não foi possível redefinir a senha."))
            else -> Result.Err("Não foi possível redefinir a senha agora. Tente novamente em instantes.")
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
