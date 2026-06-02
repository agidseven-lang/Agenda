package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import android.provider.Settings
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging

// Registra o token FCM no doc do usuário (users.fcmTokens) — mesmo campo do PWA/Worker.
// Guarda o uid em prefs para que o serviço de mensagens consiga atualizar o token
// no Firestore quando ele rotacionar (onNewToken), mesmo sem novo login.
//
// PÓS-REINSTALAÇÃO o token FCM ROTACIONA. Além de adicionar o novo em `fcmTokens`,
// gravamos `fcmTokenMeta[token] = { deviceId, lastSeenAt }` usando um deviceId estável
// do aparelho. O Worker/Functions deduplicam por deviceId pegando o token de maior
// lastSeenAt -> o token ANTIGO deste mesmo aparelho deixa de ser usado (substituído),
// sem precisar removê-lo manualmente. Logs claros para diagnóstico.
object Fcm {
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
                    val deviceId = stableDeviceId(ctx)
                    val meta = mapOf(
                        "deviceId" to deviceId,
                        "lastSeenAt" to System.currentTimeMillis(),
                        "platform" to "android-native",
                    )
                    FirebaseFirestore.getInstance().collection("users").document(uid)
                        .update(
                            "fcmTokens", FieldValue.arrayUnion(token),
                            FieldPath.of("fcmTokenMeta", token), meta,
                        )
                        .addOnSuccessListener {
                            android.util.Log.i("Fcm", "[FCM_TOKEN_SYNCED] uid=$uid device=$deviceId token=${token.take(12)}…")
                        }
                        .addOnFailureListener { e ->
                            android.util.Log.w("Fcm", "[FCM_TOKEN_SYNC_FAILED] uid=$uid err=${e.message}")
                        }
                }
                .addOnFailureListener { e ->
                    android.util.Log.w("Fcm", "[FCM_TOKEN_FETCH_FAILED] uid=$uid err=${e.message}")
                }
        } catch (_: Throwable) { }
    }

    // Identificador estável por aparelho (não muda na reinstalação) para agrupar tokens
    // do mesmo device e descartar o antigo. Não é PII sensível e fica só no doc do usuário.
    private fun stableDeviceId(ctx: Context): String = try {
        Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ANDROID_ID)?.takeIf { it.isNotBlank() } ?: "unknown"
    } catch (_: Throwable) { "unknown" }
}
