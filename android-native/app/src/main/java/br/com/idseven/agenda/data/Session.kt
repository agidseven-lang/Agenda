package br.com.idseven.agenda.data

import android.content.Context

// Sessão local (SharedPreferences). Igual à ideia do web: o "logado" é o ID do doc em users.
object Session {
    private const val PREF = "idseven_session"
    private const val KEY_UID = "uid"
    private const val KEY_NAME = "name"

    private fun prefs(ctx: Context) =
        ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)

    fun save(ctx: Context, uid: String, name: String?) {
        prefs(ctx).edit().putString(KEY_UID, uid).putString(KEY_NAME, name ?: "").apply()
    }

    fun uid(ctx: Context): String? = prefs(ctx).getString(KEY_UID, null)

    fun name(ctx: Context): String? = prefs(ctx).getString(KEY_NAME, null)

    fun isLoggedIn(ctx: Context): Boolean = !uid(ctx).isNullOrBlank()

    fun clear(ctx: Context) {
        prefs(ctx).edit().clear().apply()
    }
}
