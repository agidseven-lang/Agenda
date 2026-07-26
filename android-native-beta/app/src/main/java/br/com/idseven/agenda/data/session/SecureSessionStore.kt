package br.com.idseven.agenda.data.session

import android.content.Context
import java.io.File

/**
 * F4.2B — Armazenamento seguro da sessao. O token/sessionId/expiracao/perfil ficam SOMENTE
 * criptografados (Android Keystore, via SessionCipher) num arquivo privado do app.
 *
 * NUNCA em: SharedPreferences puro, DataStore puro, log, Intent, deep link, notificacao, clipboard.
 * load() retorna null (sessao invalida) se o blob nao decifrar — inclusive quando restaurado em
 * outro aparelho (chave do Keystore ausente) — satisfazendo "sessao restaurada nao vale".
 */
class SecureSessionStore(
    context: Context,
    private val cipher: SessionCipher = KeystoreSessionCipher(),
) : SessionVault {
    private val appCtx = context.applicationContext
    private val file: File get() = File(appCtx.filesDir, FILE_NAME)

    /** Grava a sessao criptografada (sobrescreve). */
    @Synchronized
    override fun save(session: SecureSession) {
        val blob = cipher.encrypt(SessionCodec.encode(session))
        val tmp = File(appCtx.filesDir, "$FILE_NAME.tmp")
        tmp.writeBytes(blob)
        if (!tmp.renameTo(file)) { file.writeBytes(blob); tmp.delete() }
    }

    /** Le e decifra; null se ausente/adulterada/de-outro-aparelho. */
    @Synchronized
    override fun load(): SecureSession? {
        val f = file
        if (!f.exists()) return null
        val blob = runCatching { f.readBytes() }.getOrNull() ?: return null
        val plain = cipher.decrypt(blob) ?: return null
        return SessionCodec.decode(plain)
    }

    /** Sessao valida = existe E ainda dentro do prazo local (com skew). */
    override fun loadValid(nowMs: Long): SecureSession? = load()?.takeIf { it.isLocallyValid(nowMs) }

    /** Limpeza integral: apaga o arquivo e, no logout duro, a propria chave do Keystore. */
    @Synchronized
    override fun clear(deleteKey: Boolean) {
        runCatching { if (file.exists()) file.delete() }
        runCatching { File(appCtx.filesDir, "$FILE_NAME.tmp").delete() }
        if (deleteKey && cipher is KeystoreSessionCipher) cipher.deleteKey()
    }

    companion object {
        private const val FILE_NAME = "idseven_session_v2.bin"
    }
}
