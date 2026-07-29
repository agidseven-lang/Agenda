package br.com.idseven.agenda.data

import br.com.idseven.agenda.domain.UserLite
import br.com.idseven.agenda.domain.UserPublic
import com.google.firebase.firestore.DocumentSnapshot

/**
 * F4.3C4B — Mapper explícito UserPublicDocument → UserPublic → UserLite (modelo visual existente).
 *
 * TOTAL-SAFE: documento malformado (campo com tipo errado, id vazio) NUNCA derruba o app — o campo
 * vira null (as? String) ou o documento inteiro é descartado (null). Campos ausentes geram valor
 * opcional/fallback visual neutro nas telas — NUNCA acesso à coleção privada `users`.
 *
 * O mapper LÊ SOMENTE os campos públicos comprovados. Chaves como pass/salt/fcmTokens/
 * sessionVersion/admin/email/phone são IGNORADAS mesmo se presentes no documento.
 */
object UserPublicMapper {

    // Mesmos aliases de foto usados historicamente pelo app (a projeção grava `photo`; os aliases
    // são tolerância de leitura, sem custo).
    private val PHOTO_KEYS = listOf("photo", "photoUrl", "avatar", "avatarUrl", "image", "imageUrl", "picture", "foto")

    /** Núcleo testável sem Firestore: id + acessor de campo → UserPublic? (null = doc inválido). */
    fun fromFields(id: String, get: (String) -> Any?): UserPublic? {
        if (id.isBlank()) return null
        return runCatching {
            val photo = PHOTO_KEYS.firstNotNullOfOrNull { k -> (get(k) as? String)?.takeIf { it.isNotBlank() } }
            UserPublic(
                id = id,
                name = get("name") as? String,
                role = get("role") as? String,
                status = get("status") as? String,
                photo = photo,
                color = get("color") as? String,
            )
        }.getOrNull()
    }

    /** Conversão a partir do DocumentSnapshot do Firestore (delegando ao núcleo total-safe). */
    fun fromDoc(d: DocumentSnapshot): UserPublic? = fromFields(d.id) { k -> runCatching { d.get(k) }.getOrNull() }

    /**
     * Ponte para o modelo VISUAL existente (UserLite) — preserva todas as telas sem redesenho.
     * Campos privados NUNCA são preenchidos com valores falsos: email/phone/createdAt/fcmTokens
     * ficam vazios (estado indisponível; as telas já têm fallback neutro "Não informado"), e
     * `admin` fica false para membros do diretório — o admin do PRÓPRIO usuário é sobreposto no
     * MainScaffold a partir do perfil verificado pelo servidor (getUserSelf), nunca daqui.
     */
    fun toUserLite(p: UserPublic): UserLite = UserLite(
        id = p.id,
        name = p.name,
        role = p.role,
        color = p.color,
        photo = p.photo,
        status = p.status,
        admin = false,
        email = null,
        phone = null,
        createdAt = null,
        fcmTokens = emptyList(),
    )
}
