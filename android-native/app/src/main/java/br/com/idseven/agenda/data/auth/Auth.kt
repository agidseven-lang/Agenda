package br.com.idseven.agenda.data.auth

import android.content.Context
import br.com.idseven.agenda.BuildConfig
import br.com.idseven.agenda.data.net.Backend
import br.com.idseven.agenda.data.net.BackendClient
import br.com.idseven.agenda.data.net.BackendUrls
import br.com.idseven.agenda.data.net.UrlHttpClient
import br.com.idseven.agenda.data.session.SecureSessionStore
import br.com.idseven.agenda.data.session.SessionVault

// F4.2C: montagem (sem DI) do AuthManager de producao a partir do BuildConfig.
// URL base configuravel via buildConfigField/CI; padrao = Functions Gen2 do projeto.
object Auth {

    @Volatile private var mgr: AuthManager? = null

    fun manager(context: Context): AuthManager {
        val app = context.applicationContext
        return mgr ?: synchronized(this) {
            mgr ?: build(app).also { mgr = it }
        }
    }

    fun vault(context: Context): SessionVault = SecureSessionStore(context.applicationContext)

    /** Backend oficial (para FCM/registro fora do fluxo de login). */
    fun backend(): Backend = BackendClient(BackendUrls.fromBase(BuildConfig.BACKEND_BASE_URL), UrlHttpClient())

    private fun build(app: Context): AuthManager {
        val urls = BackendUrls.fromBase(BuildConfig.BACKEND_BASE_URL)
        val backend = BackendClient(urls, UrlHttpClient())
        val bridge = RealFirebaseBridge()
        val vault = SecureSessionStore(app)
        return AuthManager(backend, bridge, vault)
    }
}
