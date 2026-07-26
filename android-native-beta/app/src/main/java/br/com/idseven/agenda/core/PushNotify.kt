package br.com.idseven.agenda.core

import android.content.Context
import br.com.idseven.agenda.shared.DateUtil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// Dispara o push imediato ao RESPONSÁVEL via Worker (idseven-push), após salvar
// um evento/tarefa. O app envia APENAS { type, id } — sem token e sem segredo.
// Fire-and-forget num escopo de PROCESSO (sobrevive à navegação que fecha a tela)
// e PERSISTE o resultado (status/corpo/erro) em prefs "notifydiag" → visível em
// Perfil > Notificações ("Último push imediato").
object PushNotify {
    private const val ENDPOINT = "https://idseven-push.agidseven.workers.dev/notify-assignee"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun notifyAssignee(ctx: Context, type: String, id: String?) {
        val appCtx = ctx.applicationContext
        val stamp = DateUtil.hm(System.currentTimeMillis())
        if (id.isNullOrBlank()) { persist(appCtx, "$stamp · $type · sem id (nao chamado)"); return }
        scope.launch {
            try {
                val payload = JSONObject().put("type", type).put("id", id).toString()
                val conn = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 8000
                    readTimeout = 8000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                conn.outputStream.use { it.write(payload.toByteArray()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val resp = stream?.bufferedReader()?.use { it.readText() } ?: ""
                conn.disconnect()
                persist(appCtx, "$stamp · $type/$id · HTTP $code · ${resp.take(180)}")
                android.util.Log.d("PushNotify", "notify-assignee $type/$id -> HTTP $code $resp")
            } catch (t: Throwable) {
                persist(appCtx, "$stamp · $type/$id · ERRO ${t.message}")
                android.util.Log.w("PushNotify", "falha notify-assignee: ${t.message}")
            }
        }
    }

    private fun persist(ctx: Context, value: String) {
        try {
            ctx.getSharedPreferences("notifydiag", Context.MODE_PRIVATE).edit().putString("last_push", value).apply()
        } catch (_: Throwable) { }
    }
}
