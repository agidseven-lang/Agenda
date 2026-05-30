package br.com.idseven.agenda.nativebeta.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// Dispara o push imediato ao RESPONSÁVEL via Worker (idseven-push), após salvar
// um evento/tarefa. O app envia APENAS { type, id } — sem token e sem segredo.
// O Worker re-lê o doc no Firestore, descobre o responsável e envia o FCM.
object PushNotify {
    // Endpoint público do Worker (não é segredo; a segurança está no lado do Worker).
    private const val ENDPOINT = "https://idseven-push.agidseven.workers.dev/notify-assignee"

    suspend fun notifyAssignee(type: String, id: String?) {
        if (id.isNullOrBlank()) return
        withContext(Dispatchers.IO) {
            try {
                val body = JSONObject().put("type", type).put("id", id).toString()
                val conn = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                conn.outputStream.use { it.write(body.toByteArray()) }
                val code = conn.responseCode
                android.util.Log.d("PushNotify", "notify-assignee $type/$id -> HTTP $code")
                conn.disconnect()
            } catch (t: Throwable) {
                android.util.Log.w("PushNotify", "falha notify-assignee: ${t.message}")
            }
        }
    }
}
