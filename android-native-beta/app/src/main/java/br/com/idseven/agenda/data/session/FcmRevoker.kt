package br.com.idseven.agenda.data.session

import android.content.Context
import br.com.idseven.agenda.core.Fcm

/**
 * F4.3C1 (MED-1 / Correcao 6) — Fonte LOCAL do token FCM + deviceId para a revogacao no logout, e
 * limpeza do cache local do FCM. Isolada e injetavel (SessionManager depende desta interface; os
 * testes unitarios usam um fake sem tocar Android/rede). NUNCA loga o token.
 */
interface FcmRevoker {
    /** Token FCM atualmente registrado (do cache local) + deviceId estavel; null se ausente. */
    fun read(): Pair<String, String>?

    /** Limpa o cache local do FCM (uid/token) no logout — parte da limpeza integral de sessao. */
    fun clearLocal()
}

/**
 * Implementacao real: le o ultimo token FCM sincronizado do SharedPreferences "fcm" (o MESMO que o
 * Fcm.register grava) + o deviceId estavel do aparelho. NAO faz rede aqui; a chamada de revogacao
 * fica no SessionManager (com timeout curto). clearLocal apaga o cache "fcm" no logout.
 */
class RealFcmRevoker(context: Context) : FcmRevoker {
    private val appCtx = context.applicationContext

    override fun read(): Pair<String, String>? {
        val token = runCatching {
            appCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", null)
        }.getOrNull()?.takeIf { it.isNotBlank() } ?: return null
        return token to Fcm.stableDeviceId(appCtx)
    }

    override fun clearLocal() {
        runCatching { appCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply() }
    }

    private companion object {
        const val PREFS = "fcm"
    }
}
