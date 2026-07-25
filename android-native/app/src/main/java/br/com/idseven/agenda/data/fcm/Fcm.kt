package br.com.idseven.agenda.data.fcm

import android.content.Context
import android.provider.Settings
import br.com.idseven.agenda.data.auth.Auth
import com.google.firebase.messaging.FirebaseMessaging
import java.util.concurrent.Executors

// F4.2C: registro do token FCM EXCLUSIVAMENTE pelo endpoint oficial registerFcmToken
// (Bearer da sessao). NUNCA escreve direto em users/{uid}.fcmTokens. Idempotente: o
// endpoint deduplica por deviceId. O token completo NUNCA e registrado em log/mensagem.
object Fcm {

    private val io = Executors.newSingleThreadExecutor()
    const val PLATFORM = "android-native"

    /** Busca o token atual e registra (se houver sessao valida). Chamar no login e no resume. */
    fun register(context: Context) {
        val app = context.applicationContext
        val sessionToken = validSessionToken(app) ?: return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            if (!token.isNullOrBlank()) submit(app, sessionToken, token)
        }
    }

    /** Chamado pelo FirebaseMessagingService quando o token e rotacionado. */
    fun onNewToken(context: Context, token: String) {
        val app = context.applicationContext
        if (token.isBlank()) return
        val sessionToken = validSessionToken(app) ?: return
        submit(app, sessionToken, token)
    }

    private fun validSessionToken(app: Context): String? =
        Auth.vault(app).loadValid(System.currentTimeMillis())?.token?.takeIf { it.isNotBlank() }

    private fun submit(app: Context, sessionToken: String, fcmToken: String) {
        io.execute {
            try {
                Auth.backend().registerFcmToken(sessionToken, fcmToken, deviceId(app), PLATFORM)
            } catch (_: Throwable) {
                // melhor esforco; sera reenviado no proximo resume/rotacao
            }
        }
    }

    /** Identificador estavel do aparelho (dedup no servidor). Nao e PII. */
    fun deviceId(context: Context): String = try {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)?.takeIf { it.isNotBlank() } ?: "unknown"
    } catch (_: Throwable) {
        "unknown"
    }
}
