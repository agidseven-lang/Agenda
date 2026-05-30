package br.com.idseven.agenda.nativebeta.features.notif

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.clickable
import br.com.idseven.agenda.nativebeta.core.DeepLink
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.EventStatus
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.domain.Types
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil

/* Linha rotulada do card (label fraco em cima, valor destacado embaixo). */
private data class DetailRow(val label: String, val value: String)

/* Conteúdo resolvido para o modal (instantâneo do payload + autoritativo do estado). */
private data class ModalContent(
    val icon: ImageVector,
    val title: String,
    val subtitle: String,
    val rows: List<DetailRow>,
    val actionLabel: String,
    val notice: String? = null,   // aviso amigável (item removido / ainda carregando)
)

private fun fmtDate(date: String?): String {
    val d = date?.takeIf { it.isNotBlank() } ?: return "—"
    return runCatching { "${DateUtil.dayLabel(d)}, ${DateUtil.dayShort(d)}" }.getOrDefault(d)
}

private fun userName(users: List<UserLite>, id: String?, fallback: String?): String =
    users.firstOrNull { it.id == id }?.name?.takeIf { it.isNotBlank() }
        ?: fallback?.takeIf { it.isNotBlank() } ?: "—"

private fun buildEvent(
    p: DeepLink.NotifPayload, ev: EventItem?, users: List<UserLite>, loading: Boolean,
): ModalContent {
    val title = ev?.title?.takeIf { it.isNotBlank() } ?: ev?.client?.takeIf { it.isNotBlank() }
        ?: p.title?.takeIf { it.isNotBlank() } ?: "Compromisso"
    val horario = listOfNotNull(ev?.start?.takeIf { it.isNotBlank() }, ev?.end?.takeIf { it.isNotBlank() })
        .joinToString(" – ").ifBlank { "—" }
    val status = ev?.let { EventStatus.status(it)?.text } ?: Types.of(ev?.type).label
    val notice = when {
        ev == null && loading -> "Carregando detalhes do compromisso…"
        ev == null -> "Este compromisso pode ter sido removido ou está indisponível."
        else -> null
    }
    return ModalContent(
        icon = Icons.Outlined.CalendarMonth,
        title = "Novo compromisso",
        subtitle = title,
        rows = listOf(
            DetailRow("Compromisso", title),
            DetailRow("Responsável", userName(users, ev?.ownerId, ev?.owner)),
            DetailRow("Data", fmtDate(ev?.date ?: p.scheduledAt)),
            DetailRow("Horário", horario),
            DetailRow("Status", status),
        ),
        actionLabel = "Abrir compromisso",
        notice = notice,
    )
}

private fun buildTask(
    p: DeepLink.NotifPayload, tk: TaskItem?, users: List<UserLite>, loading: Boolean,
): ModalContent {
    val title = tk?.title?.takeIf { it.isNotBlank() } ?: p.title?.takeIf { it.isNotBlank() } ?: "Tarefa"
    val prazo = listOfNotNull(
        (tk?.dueDate ?: p.scheduledAt)?.let { fmtDate(it) }?.takeIf { it != "—" },
        tk?.dueTime?.takeIf { it.isNotBlank() },
    ).joinToString(" · ").ifBlank { "—" }
    val notice = when {
        tk == null && loading -> "Carregando detalhes da tarefa…"
        tk == null -> "Esta tarefa pode ter sido removida ou está indisponível."
        else -> null
    }
    return ModalContent(
        icon = Icons.Outlined.Checklist,
        title = "Nova tarefa",
        subtitle = title,
        rows = listOf(
            DetailRow("Tarefa", title),
            DetailRow("Responsável", userName(users, tk?.assigneeId, tk?.assignee)),
            DetailRow("Prazo", prazo),
            DetailRow("Status", TaskStatus.label(tk?.status)),
        ),
        actionLabel = "Abrir tarefa",
        notice = notice,
    )
}

private fun buildChat(p: DeepLink.NotifPayload, users: List<UserLite>): ModalContent {
    val sender = p.title?.takeIf { it.isNotBlank() } ?: userName(users, p.id, null)
    val preview = p.body?.takeIf { it.isNotBlank() } ?: "Nova mensagem"
    val hora = p.sentAt?.toLongOrNull()?.let { DateUtil.hm(it) }?.takeIf { it.isNotBlank() } ?: "—"
    return ModalContent(
        icon = Icons.Outlined.ChatBubbleOutline,
        title = "Nova mensagem",
        subtitle = sender,
        rows = listOf(
            DetailRow("Remetente", sender),
            DetailRow("Mensagem", preview),
            DetailRow("Horário", hora),
        ),
        actionLabel = "Abrir conversa",
    )
}

/**
 * Modal premium exibido ao TOCAR na notificação (compromisso/tarefa/chat).
 * Visual: fundo escuro, ícone circular no topo, título, card de informações,
 * botão de ação e botão de fechar. Dados vêm do payload (instantâneo) + estado
 * em memória (autoritativo); fallback amigável quando o item não existe.
 */
@Composable
fun NotificationDetailModal(
    payload: DeepLink.NotifPayload,
    event: EventItem?,
    task: TaskItem?,
    users: List<UserLite>,
    loading: Boolean,
    onAction: () -> Unit,
    onClose: () -> Unit,
) {
    val c = when (payload.type) {
        "task" -> buildTask(payload, task, users, loading)
        "chat" -> buildChat(payload, users)
        else -> buildEvent(payload, event, users, loading)
    }
    val accent = Tokens.Accent

    Surface(color = Tokens.Bg, modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize()) {
            // Botão fechar (X) no topo direito
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp)
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Tokens.Surface2)
                    .clickable { onClose() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Close, contentDescription = "Fechar", tint = Tokens.Faint, modifier = Modifier.size(20.dp))
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 26.dp, vertical = 64.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                // Ícone circular no topo (estilo confirmação premium)
                Box(
                    Modifier.size(78.dp).clip(CircleShape).background(accent),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(c.icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(38.dp))
                }
                Spacer(Modifier.height(20.dp))
                Text(c.title, color = Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))
                Text(
                    c.subtitle, color = Tokens.Faint, fontSize = 14.sp, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )

                c.notice?.let {
                    Spacer(Modifier.height(14.dp))
                    Box(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Surface2).padding(12.dp),
                    ) {
                        Text(it, color = Tokens.Amber, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                    }
                }

                Spacer(Modifier.height(24.dp))

                // Card com informações principais
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(Tokens.Surface2)
                        .padding(20.dp),
                ) {
                    c.rows.forEachIndexed { i, row ->
                        if (i > 0) Spacer(Modifier.height(16.dp))
                        Text(row.label, color = Tokens.Faint, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(3.dp))
                        Text(row.value, color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    }
                }

                Spacer(Modifier.height(28.dp))

                // Botão de ação (pílula)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .clip(RoundedCornerShape(27.dp))
                        .background(accent)
                        .clickable { onAction() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(c.actionLabel, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(10.dp))
                Box(
                    modifier = Modifier.fillMaxWidth().height(46.dp).clip(RoundedCornerShape(23.dp)).clickable { onClose() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Fechar", color = Tokens.Faint, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
