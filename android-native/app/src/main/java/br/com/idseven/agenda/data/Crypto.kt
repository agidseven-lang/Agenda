package br.com.idseven.agenda.data

import java.security.MessageDigest

// Compatível com o app WEB: pass = "s2:" + sha256Hex(salt + "|" + senha).
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

    // sal aleatório de 16 bytes em hex (igual ao randSalt do web).
    fun randSalt(): String {
        val a = ByteArray(16)
        java.security.SecureRandom().nextBytes(a)
        val sb = StringBuilder(32)
        for (b in a) { val v = b.toInt() and 0xFF; sb.append("0123456789abcdef"[v ushr 4]); sb.append("0123456789abcdef"[v and 0x0F]) }
        return sb.toString()
    }

    // djb2 idêntico ao web: h=5381; h=((h<<5)+h+code)|0 ; return "h"+(h>>>0)
    fun legacyHashPass(s: String): String {
        var h = 5381 // Int overflow no Kotlin == |0 do JS
        for (c in s) {
            h = (h shl 5) + h + c.code
        }
        val unsigned = h.toLong() and 0xFFFFFFFFL // == >>> 0
        return "h$unsigned"
    }

    fun verify(pass: String?, salt: String?, pw: String): Boolean {
        if (pass == null) return false
        return if (salt != null && pass.startsWith("s2:")) {
            pass == hashPw(pw, salt)
        } else {
            pass == legacyHashPass(pw)
        }
    }
}
