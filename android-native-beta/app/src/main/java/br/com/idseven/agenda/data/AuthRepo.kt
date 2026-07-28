package br.com.idseven.agenda.data

import android.util.Log
import br.com.idseven.agenda.BuildConfig
import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import kotlinx.coroutines.Dispatchers
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
        // F4.3C1 (HIGH-2) — cadastro INDISPONIVEL de forma explicita (sem write direto em /users; sem
        // endpoint server-side de cadastro nesta fase). Estado neutro p/ a UI (nao e erro temporario).
        data object RegistrationUnavailable : Result()
    }

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

    // F4.2B — REMOVIDO: login client-side (db.collection("users").get() + Crypto.verify no aparelho).
    // A autenticacao agora e SERVER-SIDE (ServerAuthRepository → loginUser/getUserSelf), fiel ao
    // contrato da Desktop 1.0.181. O login NUNCA baixa users nem le hash/salt no cliente.
    // Igualmente REMOVIDO o changePassword client-side por senha temporaria (users.get + Crypto.verify);
    // recuperacao de senha segue pelo fluxo server-side (requestPasswordReset/confirmPasswordReset).

    // F4.3C1 (HIGH-2 / CRIT-2 no cliente) — cadastro direto em /users pelo SDK Firestore DESABILITADO
    // (fail-closed). NAO escreve no Firestore, NAO cria usuario, NAO simula sucesso, e NAO confia em
    // admin/role/status/uid vindos do cliente (um cliente modificado poderia forjar admin:true sob as
    // Rules abertas). Sem endpoint server-side de cadastro autorizado nesta fase (F4.3C1), o cadastro
    // fica INDISPONIVEL de forma explicita — a UI orienta a procurar um administrador.
    @Suppress("UNUSED_PARAMETER")
    suspend fun register(name: String, role: String, phone: String, email: String, password: String): Result =
        Result.RegistrationUnavailable

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
        val (http, _, exc) = postJson(url, JSONObject().put("email", em))
        if (exc != null) {
            // F4.3C1 (LOG) — SANITIZADO: endpoint logico + classe do erro de transporte. NUNCA url
            // completa, exc.message, corpo de resposta ou PII.
            Log.w(TAG, "requestReset endpoint=requestPasswordReset kind=${classifyError(exc)}")
            return Result.Err("Não foi possível enviar sua solicitação agora. Verifique a internet e tente de novo.")
        }
        // F4.3C1 (LOG) — SANITIZADO: so o status HTTP. NUNCA o corpo (email/phone/code/token).
        Log.i(TAG, "requestReset endpoint=requestPasswordReset httpStatus=$http")
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
            // F4.3C1 (LOG) — SANITIZADO: endpoint logico + classe do erro de transporte (idem requestReset).
            Log.w(TAG, "confirmReset endpoint=confirmPasswordReset kind=${classifyError(exc)}")
            return Result.Err("Não foi possível redefinir a senha agora. Verifique a internet e tente de novo.")
        }
        // F4.3C1 (LOG) — SANITIZADO: so o status HTTP. NUNCA o corpo (email/code/token/mensagem crua).
        Log.i(TAG, "confirmReset endpoint=confirmPasswordReset httpStatus=$http")
        val json = runCatching { JSONObject(body) }.getOrNull()
        return when {
            http == 200 && json?.optBoolean("ok", false) == true -> Result.Ok("", null)
            json != null && json.has("message") ->
                Result.Err(json.optString("message", "Não foi possível redefinir a senha."))
            else -> Result.Err("Não foi possível redefinir a senha agora. Tente novamente em instantes.")
        }
    }

    // F4.2B — changePassword client-side (users.get + Crypto.verify) REMOVIDO. A troca de senha
    // autenticada e server-side (ServerAuthRepository.changePassword → endpoint changePassword com
    // Bearer). O fluxo de senha temporaria por aparelho deixou de existir.
}
