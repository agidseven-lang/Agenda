package br.com.idseven.agenda.nativebeta.data

import br.com.idseven.agenda.nativebeta.domain.UserLite
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

// Equipe em tempo real. F3.3.73D — passou a ler a PROJEÇÃO PÚBLICA `usersPublic`
// (name/role/color/photo/status/admin), NUNCA mais a coleção privada `users`.
// Efeitos: (1) e-mail/telefone/fcmTokens NÃO trafegam mais no broadcast da equipe
// (usersPublic não tem esses campos — resolvem null/empty aqui); (2) leitura
// compatível com as Rules atuais (usersPublic é de leitura pública; `users` está
// fechado). O perfil do próprio usuário (com e-mail) vem de getUserSelf/selfProfile,
// não daqui. Filtro de segurança: só entram usuários ATIVOS e não-canário.
object UsersRepo {
    private val db get() = FirebaseFirestore.getInstance()

    private fun isActive(status: String?): Boolean =
        status != "pendente" && status != "removido" && status != "excluido"

    fun users(): Flow<List<UserLite>> = callbackFlow {
        val reg = db.collection("usersPublic").addSnapshotListener { snap, e ->
            if (e != null) {
                android.util.Log.w("UsersRepo", "users listener erro: ${e.message}", e)
                close(e); return@addSnapshotListener
            }
            val list = snap?.documents?.mapNotNull { d ->
                runCatching {
                    val photo = listOf("photo", "photoUrl", "avatar", "avatarUrl", "image", "imageUrl", "picture", "foto")
                        .firstNotNullOfOrNull { k -> d.getString(k)?.takeIf { it.isNotBlank() } }
                    // createdAt pode vir como Number (epoch ms do PWA), Timestamp, Date ou String — nunca usar
                    // getTimestamp direto (lança exceção quando o campo não é Timestamp).
                    val createdAt: Long? = when (val v = d.get("createdAt")) {
                        is com.google.firebase.Timestamp -> v.toDate().time
                        is java.util.Date -> v.time
                        is Number -> v.toLong()
                        is String -> v.toLongOrNull()
                        else -> null
                    }
                    val fcmTokens: List<String> = (d.get("fcmTokens") as? List<*>)
                        ?.mapNotNull { it as? String }?.filter { it.isNotBlank() } ?: emptyList()
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
                        createdAt = createdAt,
                        fcmTokens = fcmTokens,
                    )
                }.getOrElse { ex ->
                    android.util.Log.w("UsersRepo", "falha ao ler user ${d.id}: ${ex.message}", ex)
                    null
                }
            }
                // F3.3.73D — defesa em profundidade: remove inativos e canários mesmo
                // que a projeção traga algum (a UI já filtra por isActive(), mas o
                // stream não deve sequer expô-los).
                ?.filter { isActive(it.status) }
                ?.filterNot { u -> snap?.documents?.firstOrNull { it.id == u.id }?.getBoolean("canary") == true }
                ?: emptyList()
            android.util.Log.d("UsersRepo", "usersPublic lidos: ${list.size}")
            trySend(list)
        }
        awaitClose { reg.remove() }
    }
}
