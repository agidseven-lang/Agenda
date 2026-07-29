package br.com.idseven.agenda.domain

/**
 * F4.3C4B — Modelo PÚBLICO do diretório (projeção usersPublic mantida pela trigger syncUsersPublic).
 *
 * Contém SOMENTE os campos COMPROVADOS da projeção que o Android consome para exibição:
 *   { id, name, role, status, photo, color }.
 *
 * NÃO contém (por design, F4.3C4B):
 *  - pass / salt / fcmTokens / fcmTokenMeta / sessionVersion — nunca existem na projeção;
 *  - email / phone — PII fora da projeção (contato individual: SOMENTE getUserContact);
 *  - admin — o documento usersPublic até carrega `admin` informativo, mas o Android NÃO o consome:
 *    autorização por papel é SERVER-SIDE; o `admin` do PRÓPRIO usuário vem do perfil verificado
 *    pelo servidor (loginUser/getUserSelf → SecureSession.profile.admin), nunca do diretório.
 */
data class UserPublic(
    val id: String,
    val name: String?,
    val role: String?,
    val status: String?,
    val photo: String?,
    val color: String?,
) {
    /**
     * Visível no diretório? Mesma regra do PWA/UserLite: esconde pendente/removido/excluido.
     * NÃO usar filtro positivo (== "ativo"): docs legados têm status ausente e são ATIVOS.
     */
    fun isActive(): Boolean = status != "pendente" && status != "removido" && status != "excluido"
}
