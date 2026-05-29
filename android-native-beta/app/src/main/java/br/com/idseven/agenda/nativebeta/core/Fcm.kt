package br.com.idseven.agenda.nativebeta.core

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.messaging.FirebaseMessaging

// Registra o token FCM no doc do usuário (users.fcmTokens) — mesmo campo do PWA.
object Fcm {
    fun register(uid: String?) {
        if (uid.isNullOrBlank()) return
        try {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (!token.isNullOrBlank()) {
                    FirebaseFirestore.getInstance().collection("users").document(uid)
                        .update("fcmTokens", FieldValue.arrayUnion(token))
                }
            }
        } catch (_: Throwable) { }
    }
}
