package br.com.idseven.agenda.nativebeta.core

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import br.com.idseven.agenda.nativebeta.MainActivity
import br.com.idseven.agenda.nativebeta.R

// Canais e disparo de notificações (locais e remotas).
object Notifications {
    private const val TAG = "ReminderDiag"
    // Canal dos lembretes locais 1h antes (full-screen / heads-up). Mantido para compat
    // com a tela de diagnóstico; passa a representar o lembrete "call/alarme".
    const val CH_REMINDERS = "reminders"
    const val CH_GENERAL = "general"
    // NOVO: canal exclusivo das notificações IMEDIATAS (agenda/tarefa/chat) — heads-up normal.
    const val CH_IMMEDIATE = "immediate"
    // NOVO: canal do lembrete 1h antes como CHAMADA (full-screen intent / alarme).
    const val CH_ALARM = "reminder_call"

    fun ensure(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        // Imediatas (push de agenda/tarefa/chat): alta importância p/ heads-up, sem full-screen.
        nm.createNotificationChannel(
            NotificationChannel(CH_IMMEDIATE, "Notificações em tempo real", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Novos compromissos, tarefas e mensagens atribuídos a você"
                enableVibration(true)
                enableLights(true)
            }
        )
        // Lembrete 1h antes como chamada (full-screen quando permitido; senão heads-up).
        nm.createNotificationChannel(
            NotificationChannel(CH_ALARM, "Lembretes (chamada)", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Lembrete 1h antes do compromisso, em tela cheia quando permitido"
                enableVibration(true)
                enableLights(true)
                setBypassDnd(true)
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_REMINDERS, "Lembretes", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Lembretes locais antes dos compromissos"
                enableVibration(true)
                enableLights(true)
            }
        )
        nm.createNotificationChannel(
            NotificationChannel(CH_GENERAL, "Avisos e mensagens", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Atualizações da equipe, tarefas e chat"
            }
        )
    }

    // Android 14+ pode restringir full-screen intent por app. true = pode usar tela cheia.
    fun canUseFullScreen(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT < 34) return true
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return false
        return try { nm.canUseFullScreenIntent() } catch (_: Throwable) { false }
    }

    // Rótulo para o diagnóstico na tela de Notificações.
    fun fullScreenLabel(ctx: Context): String = when {
        Build.VERSION.SDK_INT < 34 -> "Permitido (Android < 14)"
        canUseFullScreen(ctx) -> "Permitido"
        else -> "Bloqueado (toque para permitir)"
    }

    // Abre a tela do Android 14+ para o usuário permitir alerta em tela cheia deste app.
    fun openFullScreenIntentSettings(ctx: Context) {
        if (Build.VERSION.SDK_INT < 34) { openNotificationSettings(ctx); return }
        try {
            ctx.startActivity(
                Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                    .setData(Uri.parse("package:${ctx.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Throwable) { openNotificationSettings(ctx) }
    }

    fun hasPostPermission(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    // Notificações do app habilitadas no sistema (master switch).
    fun areEnabled(ctx: Context): Boolean = NotificationManagerCompat.from(ctx).areNotificationsEnabled()

    // Estado do canal: "inexistente" | "bloqueado" | "ativo (importância N)".
    fun channelStatus(ctx: Context, channelId: String): String {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return "indisponível"
        val ch = nm.getNotificationChannel(channelId) ?: return "inexistente"
        return if (ch.importance == NotificationManager.IMPORTANCE_NONE) "bloqueado"
        else "ativo (imp. ${ch.importance})"
    }

    // Em Android 12+ (API 31) alarmes exatos podem exigir permissão do usuário.
    fun canExactAlarm(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT < 31) return true
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return false
        return am.canScheduleExactAlarms()
    }

    fun openNotificationSettings(ctx: Context) {
        try {
            ctx.startActivity(
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Throwable) { openAppDetails(ctx) }
    }

    fun openExactAlarmSettings(ctx: Context) {
        if (Build.VERSION.SDK_INT < 31) return
        try {
            ctx.startActivity(
                Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    .setData(Uri.parse("package:${ctx.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Throwable) { openAppDetails(ctx) }
    }

    // App isento da otimização de bateria? (Doze/App Standby cancelam alarmes de apps "dormindo".)
    fun isIgnoringBatteryOptimizations(ctx: Context): Boolean {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return pm.isIgnoringBatteryOptimizations(ctx.packageName)
    }

    // Abre o diálogo do sistema para isentar o app da otimização de bateria.
    // Decisivo para lembretes dispararem com o app fechado em OEMs agressivos (ex.: Samsung).
    fun openBatteryOptimizationSettings(ctx: Context) {
        try {
            ctx.startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.parse("package:${ctx.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Throwable) {
            try {
                ctx.startActivity(
                    Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            } catch (_: Throwable) { openAppDetails(ctx) }
        }
    }

    private fun openAppDetails(ctx: Context) {
        try {
            ctx.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:${ctx.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Throwable) { }
    }

    // Retorna true se a notificação foi postada sem erro. Registra falhas em NotifyDiag.lastError.
    fun notify(ctx: Context, id: Int, channel: String, title: String, text: String, eventId: String? = null, deepLink: String? = null, subText: String? = null): Boolean {
        return try {
            if (!hasPostPermission(ctx)) {
                NotifyDiag.lastError.value = "Permissão de notificações não concedida"
                return false
            }
            ensure(ctx) // garante o canal antes de postar
            val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            // Alvo do deep-link: explícito ("event:id"/"task:id"/"chat:senderId") ou derivado do eventId (lembrete local).
            val target = deepLink?.takeIf { it.isNotBlank() } ?: eventId?.takeIf { it.isNotBlank() }?.let { "event:$it" }
            if (target != null) open.putExtra(DeepLink.EXTRA_DEEPLINK, target)
            val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getActivity(ctx, id, open, flags)
            val b = NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
            subText?.takeIf { it.isNotBlank() }?.let { b.setSubText(it) }
            NotificationManagerCompat.from(ctx).notify(id, b.build())
            true
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
            android.util.Log.e("Notifications", "notify falhou", t)
            false
        }
    }

    // Lembrete 1h antes como CHAMADA: full-screen intent (ReminderAlarmActivity) quando
    // permitido; o Android faz fallback automático p/ heads-up quando não permitido.
    // Também define um contentIntent (toque) para a mesma tela premium.
    fun notifyReminderFullScreen(
        ctx: Context, id: Int, title: String, text: String,
        type: String, rawId: String, deepLink: String,
        date: String?, time: String?, responsible: String?, status: String?,
    ): Boolean {
        return try {
            if (!hasPostPermission(ctx)) {
                NotifyDiag.lastError.value = "Permissão de notificações não concedida"
                return false
            }
            ensure(ctx)
            val full = Intent(ctx, ReminderAlarmActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(ReminderAlarmActivity.EX_TITLE, title)
                .putExtra(ReminderAlarmActivity.EX_TEXT, text)
                .putExtra(ReminderAlarmActivity.EX_TYPE, type)
                .putExtra(ReminderAlarmActivity.EX_DEEPLINK, deepLink)
                .putExtra(ReminderAlarmActivity.EX_DATE, date ?: "")
                .putExtra(ReminderAlarmActivity.EX_TIME, time ?: "")
                .putExtra(ReminderAlarmActivity.EX_RESP, responsible ?: "")
                .putExtra(ReminderAlarmActivity.EX_STATUS, status ?: "")
            val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getActivity(ctx, id, full, flags)
            val allowed = canUseFullScreen(ctx)
            if (allowed) android.util.Log.i(TAG, "[REMINDER_FULLSCREEN_ALLOWED] id=$id type=$type")
            else android.util.Log.w(TAG, "[REMINDER_FULLSCREEN_BLOCKED] id=$id type=$type (fallback heads-up)")

            val b = NotificationCompat.Builder(ctx, CH_ALARM)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(false)
                .setFullScreenIntent(pi, true)   // tela cheia quando permitido; senão heads-up
            NotificationManagerCompat.from(ctx).notify(id, b.build())

            // Quando permitido, tentamos abrir a Activity full-screen diretamente também
            // (cobre OEMs que não disparam o fullScreenIntent de imediato). A Activity é
            // showWhenLocked/turnScreenOn, então acende a tela sobre o lockscreen.
            if (allowed) {
                try {
                    ctx.startActivity(full)
                    android.util.Log.i(TAG, "[REMINDER_ACTIVITY_OPENED] id=$id")
                } catch (e: Throwable) {
                    android.util.Log.w(TAG, "[REMINDER_FALLBACK_HEADSUP] startActivity falhou: ${e.message}")
                }
            } else {
                android.util.Log.i(TAG, "[REMINDER_FALLBACK_HEADSUP] id=$id (toque abre a tela premium)")
            }
            true
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
            android.util.Log.e("Notifications", "notifyReminderFullScreen falhou", t)
            false
        }
    }
}
