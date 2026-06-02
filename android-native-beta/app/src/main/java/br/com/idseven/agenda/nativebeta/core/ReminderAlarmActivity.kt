package br.com.idseven.agenda.nativebeta.core

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import br.com.idseven.agenda.nativebeta.MainActivity
import br.com.idseven.agenda.nativebeta.designsystem.theme.IDSevenBetaTheme
import br.com.idseven.agenda.nativebeta.features.notif.ReminderPremiumScreen
import br.com.idseven.agenda.nativebeta.features.notif.ReminderRow
import br.com.idseven.agenda.nativebeta.shared.DateUtil

// Tela PREMIUM do lembrete 1h antes, aberta como CHAMADA (full-screen intent).
// Aparece sobre a tela de bloqueio e liga a tela, sem o usuário precisar tocar.
// "Abrir detalhe" → MainActivity com deep-link; "Dispensar" → fecha.
class ReminderAlarmActivity : ComponentActivity() {

    companion object {
        const val EX_TITLE = "rem_title"
        const val EX_TEXT = "rem_text"
        const val EX_TYPE = "rem_type"          // event | task
        const val EX_DEEPLINK = "rem_deeplink"  // event:<id> | task:<id>
        const val EX_DATE = "rem_date"
        const val EX_TIME = "rem_time"
        const val EX_RESP = "rem_resp"
        const val EX_STATUS = "rem_status"
        const val EX_PHOTO = "rem_photo"   // foto/avatar do responsável (url http ou base64)
        const val EX_RESP_ID = "rem_resp_id" // UID do responsável (resolve foto/nome em tempo real)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        android.util.Log.i("ReminderDiag", "[REMINDER_ACTIVITY_OPENED] onCreate")
        // Mostrar sobre o lockscreen e acordar a tela.
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            (getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager)?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            )
        }

        val type = intent.getStringExtra(EX_TYPE)?.takeIf { it.isNotBlank() } ?: "event"
        val title = intent.getStringExtra(EX_TITLE)?.takeIf { it.isNotBlank() } ?: "Lembrete"
        val text = intent.getStringExtra(EX_TEXT) ?: ""
        val deepLink = intent.getStringExtra(EX_DEEPLINK) ?: ""
        val date = intent.getStringExtra(EX_DATE)?.takeIf { it.isNotBlank() }
        val time = intent.getStringExtra(EX_TIME)?.takeIf { it.isNotBlank() }
        val resp = intent.getStringExtra(EX_RESP)?.takeIf { it.isNotBlank() }
        val status = intent.getStringExtra(EX_STATUS)?.takeIf { it.isNotBlank() }
        val photo = intent.getStringExtra(EX_PHOTO)?.takeIf { it.isNotBlank() }
        val respId = intent.getStringExtra(EX_RESP_ID)?.takeIf { it.isNotBlank() }

        // Estado reativo: começa com o que veio no intent (foto/nome do payload) e é
        // ATUALIZADO em tempo real ao resolver o responsável por respId no Firestore.
        // Cobre payloads sem foto (ex.: agendados via FCM) e lembretes antigos/rearmados.
        val photoState = androidx.compose.runtime.mutableStateOf(photo)
        val nameState = androidx.compose.runtime.mutableStateOf(resp)
        if (respId != null) {
            android.util.Log.i("ReminderDiag", "[REMINDER_PHOTO_RESOLVE_START] respId=$respId intentPhoto=${!photo.isNullOrBlank()}")
            runCatching {
                com.google.firebase.firestore.FirebaseFirestore.getInstance()
                    .collection("users").document(respId).get()
                    .addOnSuccessListener { d ->
                        // Mesma lista de campos do UsersRepo (foto pode estar em qualquer um).
                        val p = listOf("photo", "photoUrl", "avatar", "avatarUrl", "image", "imageUrl", "picture", "foto")
                            .firstNotNullOfOrNull { k -> d.getString(k)?.takeIf { it.isNotBlank() } }
                        val nm = d.getString("name")?.takeIf { it.isNotBlank() }
                        if (!p.isNullOrBlank()) photoState.value = p   // foto ATUAL do responsável
                        if (!nm.isNullOrBlank()) nameState.value = nm
                        android.util.Log.i("ReminderDiag", "[REMINDER_PHOTO_RESOLVED] respId=$respId hasPhoto=${!p.isNullOrBlank()} name=$nm")
                    }
                    .addOnFailureListener { e ->
                        android.util.Log.w("ReminderDiag", "[REMINDER_PHOTO_RESOLVE_FAILED] respId=$respId err=${e.message}")
                    }
            }
        }

        val headline = if (type == "task") "Tarefa em 1 hora" else "Compromisso em 1 hora"
        val dateLabel = date?.let { runCatching { "${DateUtil.dayLabel(it)}, ${DateUtil.dayShort(it)}" }.getOrDefault(it) } ?: "—"

        setContent {
            IDSevenBetaTheme {
                val curName = nameState.value
                val rows = buildList {
                    add(ReminderRow(if (type == "task") "Tarefa" else "Compromisso", title))
                    add(ReminderRow("Responsável", curName ?: "—"))
                    add(ReminderRow("Data", dateLabel))
                    add(ReminderRow("Horário", time ?: "—"))
                    add(ReminderRow("Status", status ?: (if (type == "task") "Pendente" else "Agendado")))
                }
                ReminderPremiumScreen(
                    type = type,
                    title = headline,
                    subtitle = if (text.isNotBlank()) text else title,
                    responsiblePhoto = photoState.value,
                    responsibleName = curName,
                    rows = rows,
                    actionLabel = if (type == "task") "Abrir tarefa" else "Abrir compromisso",
                    onAction = {
                        runCatching {
                            val open = Intent(this, MainActivity::class.java)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            if (deepLink.isNotBlank()) open.putExtra(DeepLink.EXTRA_DEEPLINK, deepLink)
                            startActivity(open)
                        }
                        finish()
                    },
                    onDismiss = { finish() },
                )
            }
        }
    }
}
