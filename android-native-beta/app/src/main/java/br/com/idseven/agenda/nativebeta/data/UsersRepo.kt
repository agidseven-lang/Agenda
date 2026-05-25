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
            if (e != null) { trySend(emptyList()); return@addSnapshotListener }
            val list = snap?.documents?.map { d ->
                UserLite(
                    id = d.id,
                    name = d.getString("name"),
                    role = d.getString("role"),
                    color = d.getString("color"),
                    photo = d.getString("photo"),
                    status = d.getString("status"),
                    admin = d.getBoolean("admin") ?: false,
                )
            } ?: emptyList()
            trySend(list)
        }
        awaitClose { reg.remove() }
    }
}
