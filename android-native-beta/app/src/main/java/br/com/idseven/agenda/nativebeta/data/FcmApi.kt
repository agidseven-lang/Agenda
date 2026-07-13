package br.com.idseven.agenda.nativebeta.data

import android.content.Context
import android.provider.Settings
import android.util.Log
import br.com.idseven.agenda.nativebeta.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

// F3.3.73G — Gestão SERVER-SIDE do token FCM (registerFcmToken / removeMyFcmToken /
// resetMyFcmTokens). Substitui a escrita direta em users/{uid} (as Rules fecharam
// write em users): quem grava fcmTokens/fcmTokenMeta agora é a Function, com dedup
// por deviceId no SERVIDOR, sempre no usuário da SESSÃO (bearer da 73C — o corpo
// nunca escolhe uid). Tudo best-effort: falha NUNCA quebra login/logout/UI.
// NUNCA loga token FCM completo (só prefixo) e NUNCA loga o token de sessão.
object FcmApi {
    private const val TAG = "FcmApi"
    private val FN_REGISTER_URL = BuildConfig.REGISTER_FCM_TOKEN_URL
    private val FN_REMOVE_URL = BuildConfig.REMOVE_MY_FCM_TOKEN_URL
    private val FN_RESET_URL = BuildConfig.RESET_MY_FCM_TOKENS_URL

    private fun mask(t: String?): String =
        if (t.isNullOrBlank()) "(vazio)" else t.take(12) + "…"

    // Identificador estável por aparelho (não muda na reinstalação): o servidor usa
    // para descartar o token ANTIGO deste mesmo device (dedup server-side).
    internal fun stableDeviceId(ctx: Context): String = try {
        Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID)
            ?.takeIf { it.isNotBlank() } ?: "unknown"
    } catch (_: Throwable) { "unknown" }

    // Registra o token FCM do PRÓPRIO usuário via endpoint. Payload {token, deviceId,
    // platform}; sessão no header. Sem sessão salva → skip silencioso (o próximo
    // login/resume registra). Retorna true só com {ok:true} do servidor.
    suspend fun register(ctx: Context, fcmToken: String): Boolean = withContext(Dispatchers.IO) {
        if (fcmToken.isBlank()) return@withContext false
        val session = SessionStore(ctx).token()
        if (session.isNullOrBlank()) { Log.w(TAG, "[FCM_REGISTER_SKIP] sem sessão"); return@withContext false }
        val payload = JSONObject()
            .put("token", fcmToken)
            .put("deviceId", stableDeviceId(ctx))
            .put("platform", "android-native")
        val (http, body, exc) = AuthRepo.postJson(FN_REGISTER_URL, payload, bearer = session)
        val ok = exc == null && http == 200 &&
            runCatching { JSONObject(body).optBoolean("ok", false) }.getOrDefault(false)
        if (ok) Log.i(TAG, "[FCM_TOKEN_SYNCED] server-side token=${mask(fcmToken)}")
        else Log.w(TAG, "[FCM_TOKEN_SYNC_FAILED] http=$http kind=${exc?.javaClass?.simpleName ?: "http"} token=${mask(fcmToken)}")
        ok
    }

    // Remove da conta o token FCM DESTE aparelho (logout). Exige sessão + token local;
    // sem qualquer um deles, no-op. Nunca lança: o clear() da sessão sempre prossegue.
    suspend fun removeCurrentToken(ctx: Context): Boolean = withContext(Dispatchers.IO) {
        val session = SessionStore(ctx).token()
        if (session.isNullOrBlank()) return@withContext false
        val fcmToken = try {
            ctx.getSharedPreferences("fcm", Context.MODE_PRIVATE).getString("token", null)
        } catch (_: Throwable) { null }
        if (fcmToken.isNullOrBlank()) return@withContext false
        val (http, body, exc) = AuthRepo.postJson(FN_REMOVE_URL, JSONObject().put("token", fcmToken), bearer = session)
        val ok = exc == null && http == 200 &&
            runCatching { JSONObject(body).optBoolean("ok", false) }.getOrDefault(false)
        if (ok) Log.i(TAG, "[FCM_TOKEN_REMOVED] token=${mask(fcmToken)}")
        else Log.w(TAG, "[FCM_TOKEN_REMOVE_FAILED] http=$http kind=${exc?.javaClass?.simpleName ?: "http"}")
        ok
    }

    // Reset TOTAL (fcmTokens=[] / fcmTokenMeta={}) do PRÓPRIO usuário — função
    // PREPARADA sem UI nova nesta fase (73G): o endpoint ignora o body e limpa
    // sempre o usuário da sessão. Uso futuro: diagnóstico "resetar aparelhos".
    suspend fun resetAll(ctx: Context): Boolean = withContext(Dispatchers.IO) {
        val session = SessionStore(ctx).token()
        if (session.isNullOrBlank()) return@withContext false
        val (http, body, exc) = AuthRepo.postJson(FN_RESET_URL, JSONObject(), bearer = session)
        val ok = exc == null && http == 200 &&
            runCatching { JSONObject(body).optBoolean("ok", false) }.getOrDefault(false)
        if (ok) Log.i(TAG, "[FCM_TOKENS_RESET] ok") else Log.w(TAG, "[FCM_TOKENS_RESET_FAILED] http=$http")
        ok
    }
}
