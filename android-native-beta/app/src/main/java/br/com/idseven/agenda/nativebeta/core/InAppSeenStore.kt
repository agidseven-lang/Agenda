package br.com.idseven.agenda.nativebeta.core

import android.content.Context

// F3.3.6-C — dedup LOCAL do banner in-app (SharedPreferences). Separado do SlaReadStore do sino
// para não acoplar "banner já exibido" com "alerta lido no sino". Read-side puro; não grava Firestore.
object InAppSeenStore {
    private const val PREFS = "idseven_inapp_seen"
    private const val KEY = "seen"

    fun read(ctx: Context): Set<String> =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY, emptySet()) ?: emptySet()

    fun markSeen(ctx: Context, key: String) {
        val cur = HashSet(read(ctx)); cur.add(key)
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putStringSet(KEY, cur).apply()
    }
}
