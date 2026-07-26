package br.com.idseven.agenda.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

// Sessão local com DataStore. O "logado" é o ID do documento em users (igual ao PWA).
private val Context.sessionDataStore by preferencesDataStore(name = "idseven_session")

data class UserSession(val uid: String, val name: String)

class SessionStore(context: Context) {
    private val appCtx = context.applicationContext

    val session: Flow<UserSession?> = appCtx.sessionDataStore.data.map { p ->
        val uid = p[KEY_UID]
        if (uid.isNullOrBlank()) null else UserSession(uid, p[KEY_NAME] ?: "")
    }

    suspend fun save(uid: String, name: String?) {
        appCtx.sessionDataStore.edit { it[KEY_UID] = uid; it[KEY_NAME] = name ?: "" }
    }

    suspend fun clear() {
        appCtx.sessionDataStore.edit { it.clear() }
    }

    companion object {
        private val KEY_UID = stringPreferencesKey("uid")
        private val KEY_NAME = stringPreferencesKey("name")
    }
}
