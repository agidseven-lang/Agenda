package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import android.provider.Settings
import br.com.idseven.agenda.nativebeta.data.auth.FcmRegisterOutcome
import br.com.idseven.agenda.nativebeta.data.auth.ServerAuthRepository
import br.com.idseven.agenda.nativebeta.data.session.SecureSessionStore
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

// F4.2C — Registro do token FCM pelo ENDPOINT AUTENTICADO (registerFcmToken), substituindo o write
// direto em users/{uid}.fcmTokens. O Bearer e a sessao server-side (Keystore) e o UID e derivado da
// sessao NO SERVIDOR — impossivel registrar token para outro UID. Guardamos uid/token em prefs para
// diagnostico e para o servico de mensagens reagir a rotacao (onNewToken), sempre via o mesmo endpoint.
//
// PÓS-REINSTALAÇÃO o token FCM ROTACIONA: enviamos o novo token + um deviceId estavel do aparelho;
// o backend deduplica por deviceId (mantendo o de maior lastSeenAt), aposentando o token antigo do
// MESMO aparelho sem precisar removê-lo manualmente. Nenhuma gravacao direta no Firestore.
object Fcm {
    // Escopo leve para a chamada de rede (o listener do token roda na main thread; a rede NAO pode).
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun register(ctx: Context, uid: String?) {
        if (uid.isNullOrBlank()) return
        try {
            val prefs = ctx.getSharedPreferences("fcm", Context.MODE_PRIVATE)
            prefs.edit().putString("uid", uid).apply()
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    if (token.isNullOrBlank()) {
                        android.util.Log.w("Fcm", "[FCM_TOKEN_EMPTY] uid=$uid")
                        return@addOnSuccessListener
                    }
                    prefs.edit().putString("token", token).apply()
                    // Sessao real (Keystore) → Bearer do endpoint. Sem sessao valida, NAO registra.
                    val sessionToken = SecureSessionStore(ctx.applicationContext).load()?.token
                    if (sessionToken.isNullOrBlank()) {
                        android.util.Log.w("Fcm", "[FCM_NO_SESSION] uid=$uid (sem sessao — registro adiado)")
                        return@addOnSuccessListener
                    }
                    val deviceId = stableDeviceId(ctx)
                    scope.launch {
                        when (val r = ServerAuthRepository().registerFcmToken(sessionToken, token, deviceId, "android")) {
                            is FcmRegisterOutcome.Success ->
                                android.util.Log.i("Fcm", "[FCM_TOKEN_SYNCED] device=$deviceId count=${r.count} token=${token.take(12)}…")
                            else ->
                                android.util.Log.w("Fcm", "[FCM_TOKEN_SYNC_FAILED] device=$deviceId result=$r")
                        }
                    }
                }
                .addOnFailureListener { e ->
                    android.util.Log.w("Fcm", "[FCM_TOKEN_FETCH_FAILED] uid=$uid err=${e.message}")
                }
        } catch (_: Throwable) { }
    }

    // Identificador estável por aparelho (nao muda na reinstalacao) para o backend agrupar tokens do
    // mesmo device e aposentar o antigo. Nao e PII sensivel. Reusado pelo AppFirebaseMessagingService.
    internal fun stableDeviceId(ctx: Context): String = try {
        Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID)?.takeIf { it.isNotBlank() } ?: "unknown"
    } catch (_: Throwable) { "unknown" }
}
