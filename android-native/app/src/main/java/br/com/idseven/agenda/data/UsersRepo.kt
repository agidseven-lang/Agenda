package br.com.idseven.agenda.data

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration

data class UserLite(
    val id: String,
    val name: String?,
    val color: String?,
    val photo: String?,
    val status: String?
) {
    // Igual ao web: ativo = status não terminal (undefined conta como ativo).
    fun isActive(): Boolean = status != "pendente" && status != "removido" && status != "excluido"
}

object UsersRepo {
    private val db get() = FirebaseFirestore.getInstance()

    // F4.2C: le a projecao PUBLICA (PII-free) usersPublic {id,name,role,admin,status,photo,color},
    // mantida pela trigger/backfill do servidor. NAO le mais a colecao `users` (que expunha
    // pass/salt/phone/email de todos).
    fun listen(onData: (List<UserLite>) -> Unit): ListenerRegistration {
        return db.collection("usersPublic").addSnapshotListener { snap, e ->
            if (e != null) { onData(emptyList()); return@addSnapshotListener }
            onData(snap?.documents?.map {
                UserLite(
                    id = it.id,
                    name = it.getString("name"),
                    color = it.getString("color"),
                    photo = it.getString("photo"),
                    status = it.getString("status")
                )
            } ?: emptyList())
        }
    }
}
