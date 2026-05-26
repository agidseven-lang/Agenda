package br.com.idseven.agenda.nativebeta.data

import br.com.idseven.agenda.nativebeta.domain.UserLite
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

// Equipe em tempo real (coleção users do PWA).
object UsersRepo {
    private val db get() = FirebaseFirestore.getInstance()

    fun users(): Flow<List<UserLite>> = callbackFlow {
        val reg = db.collection("users").addSnapshotListener { snap, e ->
            if (e != null) {
                android.util.Log.w("UsersRepo", "users listener erro: ${e.message}", e)
                close(e); return@addSnapshotListener
            }
            val list = snap?.documents?.map { d ->
                val photo = listOf("photo", "photoUrl", "avatar", "avatarUrl", "image", "imageUrl", "picture", "foto")
                    .firstNotNullOfOrNull { k -> d.getString(k)?.takeIf { it.isNotBlank() } }
                UserLite(
                    id = d.id,
                    name = d.getString("name"),
                    role = d.getString("role"),
                    color = d.getString("color"),
                    photo = photo,
                    status = d.getString("status"),
                    admin = d.getBoolean("admin") ?: false,
                    email = d.getString("email"),
                    phone = d.getString("phone"),
                )
            } ?: emptyList()
            android.util.Log.d("UsersRepo", "users lidos do Firestore: ${list.size}")
            trySend(list)
        }
        awaitClose { reg.remove() }
    }
}
