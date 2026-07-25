package br.com.idseven.agenda.data.net

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import javax.net.ssl.SSLException

// F4.2C: camada de rede minima para os endpoints oficiais (loginUser / getUserSelf /
// issueFirebaseAuthToken / registerFcmToken). Sem OkHttp/Retrofit (nenhuma dependencia de
// rede nova; compativel minSdk 26). Fail-closed em HTTPS. O transporte NUNCA lanca: falhas
// viram enum. NADA de url/token/corpo e registrado em log (privacidade/seguranca).

/** Categoria da falha de transporte (colapsada; nunca uma excecao vazando). */
enum class Transport { OK, NO_NETWORK, TIMEOUT, TLS, IO, BAD_URL }

/** Resposta crua: status HTTP + corpo JSON (ou null se ausente/malformado) + transporte. */
data class HttpReply(val status: Int, val body: JSONObject?, val transport: Transport) {
    val is2xx: Boolean get() = transport == Transport.OK && status in 200..299
}

/** Seam de rede — os testes injetam um fake deterministico. */
interface HttpClient {
    fun send(method: String, url: String, bearer: String?, json: JSONObject?): HttpReply
}

/** Implementacao real com HttpURLConnection. */
class UrlHttpClient(
    private val connectTimeoutMs: Int = 15_000,
    private val readTimeoutMs: Int = 20_000,
) : HttpClient {

    override fun send(method: String, url: String, bearer: String?, json: JSONObject?): HttpReply {
        // Defesa em profundidade: recusa qualquer URL nao-HTTPS antes de abrir a conexao.
        if (!url.startsWith("https://")) return HttpReply(0, null, Transport.BAD_URL)
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = connectTimeoutMs
                readTimeout = readTimeoutMs
                useCaches = false
                setRequestProperty("Accept", "application/json")
                if (bearer != null) setRequestProperty("Authorization", "Bearer $bearer")
                if (json != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                }
            }
            if (json != null) {
                conn.outputStream.use { it.write(json.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else (conn.errorStream ?: conn.inputStream)
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            val obj = if (text.isBlank()) null else try { JSONObject(text) } catch (_: Throwable) { null }
            HttpReply(code, obj, Transport.OK)
        } catch (_: SocketTimeoutException) {
            HttpReply(0, null, Transport.TIMEOUT)
        } catch (_: UnknownHostException) {
            HttpReply(0, null, Transport.NO_NETWORK)
        } catch (_: SSLException) {
            HttpReply(0, null, Transport.TLS)
        } catch (_: Throwable) {
            HttpReply(0, null, Transport.IO)
        } finally {
            conn?.disconnect()
        }
    }
}
