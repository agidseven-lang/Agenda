package br.com.idseven.agenda.data

import android.content.Context
import br.com.idseven.agenda.data.session.SecureSessionStore

// F4.2C: fachada de leitura da sessao segura (antes era SharedPreferences em texto puro).
// A ESCRITA da sessao passou a ser exclusiva do AuthManager (loginUser -> cofre cifrado).
// Mantem a API usada pelo resto do app (uid/name/isLoggedIn/clear) + role/admin reais.
object Session {

    private fun store(ctx: Context) = SecureSessionStore(ctx.applicationContext)

    fun uid(ctx: Context): String? = store(ctx).load()?.uid

    fun name(ctx: Context): String? = store(ctx).load()?.name

    fun role(ctx: Context): String? = store(ctx).load()?.role

    fun isAdmin(ctx: Context): Boolean = store(ctx).load()?.admin == true

    /** So considera logado uma sessao localmente valida (nao expirada). */
    fun isLoggedIn(ctx: Context): Boolean {
        val s = store(ctx).load() ?: return false
        return s.isLocallyValid(System.currentTimeMillis())
    }

    /** Logout local forte: apaga sessao + chave do Keystore. */
    fun clear(ctx: Context) = store(ctx).clear(deleteKey = true)
}
