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
    const val CH_REMINDERS = "reminders"
    const val CH_GENERAL = "general"

    fun ensure(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
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
    fun notify(ctx: Context, id: Int, channel: String, title: String, text: String, eventId: String? = null): Boolean {
        return try {
            if (!hasPostPermission(ctx)) {
                NotifyDiag.lastError.value = "Permissão de notificações não concedida"
                return false
            }
            ensure(ctx) // garante o canal antes de postar
            val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            if (!eventId.isNullOrBlank()) open.putExtra(DeepLink.EXTRA_EVENT_ID, eventId)
            val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getActivity(ctx, id, open, flags)
            val n = NotificationCompat.Builder(ctx, channel)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()
            NotificationManagerCompat.from(ctx).notify(id, n)
            true
        } catch (t: Throwable) {
            NotifyDiag.lastError.value = t.message ?: t.javaClass.simpleName
            android.util.Log.e("Notifications", "notify falhou", t)
            false
        }
    }
}
