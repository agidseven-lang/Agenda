package br.com.idseven.agenda.nativebeta.core

import android.content.Context
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging

// Registra o token FCM no doc do usuário (users.fcmTokens) — mesmo campo do PWA/Worker.
// Guarda o uid em prefs para que o serviço de mensagens consiga atualizar o token
// no Firestore quando ele rotacionar (onNewToken), mesmo sem novo login.
object Fcm {
    fun register(ctx: Context, uid: String?) {
        if (uid.isNullOrBlank()) return
        try {
            val prefs = ctx.getSharedPreferences("fcm", Context.MODE_PRIVATE)
            prefs.edit().putString("uid", uid).apply()
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) {
                    prefs.edit().putString("token", token).apply()
                    FirebaseFirestore.getInstance().collection("users").document(uid)
                        .update("fcmTokens", FieldValue.arrayUnion(token))
                }
            }
        } catch (_: Throwable) { }
    }
}
