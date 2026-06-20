package br.com.idseven.agenda.nativebeta.core

import android.app.Activity
import android.app.Application
import android.os.Bundle

// F3.3.6-C — rastreio LOCAL de foreground (sem libs extras, via ActivityLifecycleCallbacks).
// Usado para decidir, sem duplicidade: app ABERTO → banner in-app; app em BACKGROUND/tela
// bloqueada → notificação de SISTEMA (comportamento atual preservado). NÃO envia nada, NÃO
// toca FCM/Worker/Firestore. Apenas um booleano em memória.
object AppForeground {
    @Volatile
    var isForeground: Boolean = false
        private set

    private var started = 0

    fun register(app: Application) {
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStarted(activity: Activity) { started++; isForeground = started > 0 }
            override fun onActivityStopped(activity: Activity) { started = (started - 1).coerceAtLeast(0); isForeground = started > 0 }
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityResumed(activity: Activity) {}
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }
}
