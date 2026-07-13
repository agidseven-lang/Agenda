package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import br.com.idseven.agenda.nativebeta.data.FcmApi
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

// Registra o token FCM do usuário — F3.3.73G: SERVER-SIDE via registerFcmToken.
// A escrita direta em users/{uid} (fcmTokens/fcmTokenMeta) foi REMOVIDA: as Rules
// fecharam write em users, e quem grava agora é a Function (dedup por deviceId no
// servidor), sempre no usuário da SESSÃO (bearer da 73C).
//
// Guarda uid/token em prefs para: (a) o serviço de mensagens re-registrar o token
// quando ele ROTACIONAR (onNewToken), mesmo sem novo login; (b) o Perfil indicar
// "este aparelho na conta"; (c) o logout remover o token DESTE aparelho.
// Best-effort: nenhuma falha aqui quebra login/UI.
object Fcm {
    private val io = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun register(ctx: Context, uid: String?) {
        if (uid.isNullOrBlank()) return
        try {
            val app = ctx.applicationContext
            val prefs = app.getSharedPreferences("fcm", Context.MODE_PRIVATE)
            prefs.edit().putString("uid", uid).apply()
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    if (token.isNullOrBlank()) {
                        android.util.Log.w("Fcm", "[FCM_TOKEN_EMPTY] uid=$uid")
                        return@addOnSuccessListener
                    }
                    prefs.edit().putString("token", token).apply()
                    // F3.3.73G — endpoint server-side no lugar do Firestore direto.
                    io.launch { FcmApi.register(app, token) }
                }
                .addOnFailureListener { e ->
                    android.util.Log.w("Fcm", "[FCM_TOKEN_FETCH_FAILED] uid=$uid err=${e.message}")
                }
        } catch (_: Throwable) { }
    }
}
