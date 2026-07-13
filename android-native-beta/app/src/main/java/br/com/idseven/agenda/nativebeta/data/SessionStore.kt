package br.com.idseven.agenda.nativebeta.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

// Sessão local: uid/name em DataStore (observável, dirige a navegação reativa).
// F3.3.73C — o TOKEN de sessão server-side vive SEPARADO, cifrado em repouso via
// EncryptedSharedPreferences (Android Keystore). O token NUNCA vai para o DataStore
// (texto), NUNCA é logado e é limpo junto com a sessão no logout.
private val Context.sessionDataStore by preferencesDataStore(name = "idseven_session")

data class UserSession(val uid: String, val name: String)

class SessionStore(context: Context) {
    private val appCtx = context.applicationContext

    // Storage cifrado do token (chave mestra no Android Keystore). Lazy: só cria
    // o keystore quando há token para ler/gravar.
    private val securePrefs by lazy {
        val master = MasterKey.Builder(appCtx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            appCtx,
            "idseven_secure_session",
            master,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    val session: Flow<UserSession?> = appCtx.sessionDataStore.data.map { p ->
        val uid = p[KEY_UID]
        if (uid.isNullOrBlank()) null else UserSession(uid, p[KEY_NAME] ?: "")
    }

    // token opcional: quando presente, grava cifrado; ausência NÃO apaga o token
    // (preserva chamadas legadas que só atualizam uid/name).
    suspend fun save(uid: String, name: String?, token: String? = null) {
        appCtx.sessionDataStore.edit { it[KEY_UID] = uid; it[KEY_NAME] = name ?: "" }
        if (!token.isNullOrBlank()) securePrefs.edit().putString(KEY_TOKEN, token).apply()
    }

    // Token de sessão server-side (para getUserSelf e demais chamadas autenticadas).
    fun token(): String? = securePrefs.getString(KEY_TOKEN, null)

    suspend fun clear() {
        appCtx.sessionDataStore.edit { it.clear() }
        securePrefs.edit().clear().apply()
    }

    companion object {
        private val KEY_UID = stringPreferencesKey("uid")
        private val KEY_NAME = stringPreferencesKey("name")
        private const val KEY_TOKEN = "session_token"
    }
}
