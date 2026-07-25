package br.com.idseven.agenda.data

import android.content.Context
import java.text.Normalizer

// F4.2C: papel/permissao. O papel REAL agora vem do getUserSelf (Session.isAdmin, campo `admin`
// do servidor). Mantemos o fallback por nome (legado do PWA) como rede de seguranca ate a base
// de usuarios ter o flag `admin` coerente para todos.
object Perm {
    private fun norm(s: String?): String {
        if (s == null) return ""
        val n = Normalizer.normalize(s, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return n.lowercase().trim()
    }

    // Legado (nome). Preferir isAdmin(ctx) sempre que houver Context.
    fun canManage(name: String?): Boolean {
        val n = norm(name)
        return n.contains("miercohevisk") || n.contains("arydyjany") || n.contains("tatiana")
    }

    /** Admin real: flag do getUserSelf (Session.isAdmin), com fallback no nome. */
    fun isAdmin(ctx: Context): Boolean =
        Session.isAdmin(ctx) || canManage(Session.name(ctx))
}
