package br.com.idseven.agenda.data.session

import android.content.Context
import java.io.File

// F4.2C: persiste a sessao cifrada em filesDir (escrita atomica via temp+rename, @Synchronized).
// allowBackup=false no manifest impede vazamento por backup.

class SecureSessionStore(
    context: Context,
    private val cipher: SessionCipher = KeystoreSessionCipher(),
) : SessionVault {

    private val appCtx = context.applicationContext
    private val file get() = File(appCtx.filesDir, FILE_NAME)
    private val tmp get() = File(appCtx.filesDir, "$FILE_NAME.tmp")

    @Synchronized
    override fun save(session: SecureSession) {
        val plain = SessionCodec.encode(session).toByteArray(Charsets.UTF_8)
        val blob = cipher.encrypt(plain) ?: return
        try {
            tmp.writeBytes(blob)
            if (!tmp.renameTo(file)) {
                file.writeBytes(blob)
                tmp.delete()
            }
        } catch (_: Throwable) {
            try { file.writeBytes(blob) } catch (_: Throwable) { /* melhor esforco */ }
        }
    }

    @Synchronized
    override fun load(): SecureSession? {
        val f = file
        if (!f.exists()) return null
        val blob = try { f.readBytes() } catch (_: Throwable) { return null }
        val plain = cipher.decrypt(blob) ?: return null
        return SessionCodec.decode(String(plain, Charsets.UTF_8))
    }

    @Synchronized
    override fun clear(deleteKey: Boolean) {
        try { if (file.exists()) file.delete() } catch (_: Throwable) {}
        try { if (tmp.exists()) tmp.delete() } catch (_: Throwable) {}
        if (deleteKey) cipher.deleteKey()
    }

    companion object {
        private const val FILE_NAME = "idseven_session_v1.bin"
    }
}
