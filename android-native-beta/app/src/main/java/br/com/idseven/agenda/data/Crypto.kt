package br.com.idseven.agenda.data

import java.security.MessageDigest
import java.security.SecureRandom

// Compatível com o PWA: pass = "s2:" + sha256Hex(salt + "|" + senha).
// Legado fraco (djb2) mantido só para VERIFICAR contas antigas. Não migramos o esquema.
object Crypto {

    fun sha256Hex(s: String): String {
        val md = MessageDigest.getInstance("SHA-256")
        val bytes = md.digest(s.toByteArray(Charsets.UTF_8))
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xFF
            sb.append("0123456789abcdef"[v ushr 4])
            sb.append("0123456789abcdef"[v and 0x0F])
        }
        return sb.toString()
    }

    fun hashPw(pw: String, salt: String): String = "s2:" + sha256Hex("$salt|$pw")

    fun randSalt(): String {
        val a = ByteArray(16)
        SecureRandom().nextBytes(a)
        val sb = StringBuilder(32)
        for (b in a) { val v = b.toInt() and 0xFF; sb.append("0123456789abcdef"[v ushr 4]); sb.append("0123456789abcdef"[v and 0x0F]) }
        return sb.toString()
    }

    // F4.2B — REMOVIDO: verify() e legacyHashPass(). Eram usados SOMENTE pela autenticacao
    // client-side (AuthRepo.login/changePassword), agora server-side. NENHUMA verificacao de senha
    // ocorre mais no aparelho. hashPw()/randSalt() permanecem apenas para o CADASTRO (register),
    // que cria a conta com o mesmo esquema do PWA por nao existir endpoint server-side de criacao
    // de conta (documentado; fora do fluxo de LOGIN).
}
