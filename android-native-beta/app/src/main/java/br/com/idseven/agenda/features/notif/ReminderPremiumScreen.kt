package br.com.idseven.agenda.features.notif

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.NotificationsActive
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.designsystem.components.Avatar
import br.com.idseven.agenda.designsystem.theme.Tokens

/** Linha rotulada do card (label fraco em cima, valor destacado embaixo). */
data class ReminderRow(val label: String, val value: String)

/**
 * Tela premium do LEMBRETE de 1h antes (full-screen intent / ReminderAlarmActivity).
 * Visual conforme referência: fundo escuro, ícone circular no topo, título forte,
 * card de informações, botão principal ("Abrir detalhe") e botão de dispensar.
 * Recebe campos JÁ resolvidos (strings) — independe de estado em memória.
 */
@Composable
fun ReminderPremiumScreen(
    type: String,            // "event" | "task"
    title: String,
    subtitle: String,
    rows: List<ReminderRow>,
    actionLabel: String,
    onAction: () -> Unit,
    onDismiss: () -> Unit,
    responsiblePhoto: String? = null,   // foto/avatar do responsável (url http ou base64)
    responsibleName: String? = null,    // nome do responsável (p/ iniciais quando sem foto)
) {
    val icon = when (type) {
        "task" -> Icons.Outlined.Checklist
        "event" -> Icons.Outlined.CalendarMonth
        else -> Icons.Outlined.NotificationsActive
    }
    val accent = Tokens.Accent

    Surface(color = Tokens.Bg, modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize()) {
            Box(
                Modifier.align(Alignment.TopEnd).padding(16.dp).size(36.dp)
                    .clip(CircleShape).background(Tokens.Surface2).clickable { onDismiss() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Close, contentDescription = "Dispensar", tint = Tokens.Faint, modifier = Modifier.size(20.dp))
            }

            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                    .padding(horizontal = 26.dp, vertical = 64.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                // Topo: foto/avatar do RESPONSÁVEL (premium, circular, sombra suave).
                //  - com foto: mostra a foto (Coil p/ http, bitmap p/ base64), sem distorcer;
                //  - sem foto mas com nome: iniciais (via Avatar);
                //  - sem nome e sem foto: fallback final no ícone de agenda/tarefa.
                val hasResponsible = !responsiblePhoto.isNullOrBlank() || !responsibleName.isNullOrBlank()
                if (hasResponsible) {
                    Box(
                        Modifier.size(84.dp).shadow(elevation = 12.dp, shape = CircleShape, clip = false),
                        contentAlignment = Alignment.Center,
                    ) {
                        Avatar(photo = responsiblePhoto, ringColor = accent, name = responsibleName, size = 84.dp, ring = 3.dp)
                    }
                } else {
                    Box(Modifier.size(78.dp).clip(CircleShape).background(accent), contentAlignment = Alignment.Center) {
                        Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(38.dp))
                    }
                }
                Spacer(Modifier.height(20.dp))
                Text(title, color = Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))
                Text(subtitle, color = Tokens.Faint, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())

                Spacer(Modifier.height(24.dp))

                Column(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Tokens.Surface2).padding(20.dp),
                ) {
                    rows.forEachIndexed { i, row ->
                        if (i > 0) Spacer(Modifier.height(16.dp))
                        Text(row.label, color = Tokens.Faint, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(3.dp))
                        Text(row.value, color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    }
                }

                Spacer(Modifier.height(28.dp))

                Box(
                    modifier = Modifier.fillMaxWidth().height(54.dp).clip(RoundedCornerShape(27.dp))
                        .background(accent).clickable { onAction() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(actionLabel, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(10.dp))
                Box(
                    modifier = Modifier.fillMaxWidth().height(46.dp).clip(RoundedCornerShape(23.dp)).clickable { onDismiss() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Dispensar", color = Tokens.Faint, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
