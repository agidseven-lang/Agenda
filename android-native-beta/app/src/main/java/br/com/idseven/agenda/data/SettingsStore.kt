package br.com.idseven.agenda.data

import android.content.Context

// Preferências locais do app (SharedPreferences — leitura síncrona, segura no path do AlarmManager).
// Tudo ADITIVO; defaults preservam o comportamento atual (ON). Não toca FCM/backend.
object SettingsStore {
    private const val PREF = "app_settings"
    const val K_REMINDERS = "notif_reminders" // lembretes locais (1h antes)
    private fun p(ctx: Context) = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)

    fun getBool(ctx: Context, key: String, def: Boolean): Boolean = p(ctx).getBoolean(key, def)
    fun setBool(ctx: Context, key: String, value: Boolean) = p(ctx).edit().putBoolean(key, value).apply()

    fun remindersEnabled(ctx: Context): Boolean = getBool(ctx, K_REMINDERS, true)
}
