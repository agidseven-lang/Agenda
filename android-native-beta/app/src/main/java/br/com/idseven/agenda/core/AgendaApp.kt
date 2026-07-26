package br.com.idseven.agenda.core

import android.app.Application
import android.content.Intent
import android.util.Log
import kotlin.system.exitProcess

// Proteção global contra crash: captura exceções não tratadas e abre uma tela amigável
// em vez de deixar o sistema fechar o app sem aviso. (Critério: nenhum clique derruba o app.)
class AgendaApp : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            val previous = Thread.getDefaultUncaughtExceptionHandler()
            Thread.setDefaultUncaughtExceptionHandler { thread, ex ->
                Log.e(TAG, "Crash não tratado em ${thread.name}", ex)
                try {
                    startActivity(
                        Intent(this, CrashActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                            .putExtra(CrashActivity.EXTRA_MESSAGE, ex.message ?: ex.javaClass.simpleName)
                            .putExtra(CrashActivity.EXTRA_TRACE, Log.getStackTraceString(ex))
                    )
                } catch (inner: Throwable) {
                    Log.e(TAG, "Falha ao abrir CrashActivity", inner)
                }
                try { previous?.uncaughtException(thread, ex) } catch (_: Throwable) {}
                android.os.Process.killProcess(android.os.Process.myPid())
                exitProcess(2)
            }
        } catch (e: Throwable) {
            Log.e(TAG, "Falha ao instalar o crash handler", e)
        }
    }

    companion object { private const val TAG = "IDSevenBeta" }
}
