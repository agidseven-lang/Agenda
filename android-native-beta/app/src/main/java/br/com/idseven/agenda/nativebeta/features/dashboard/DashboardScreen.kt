package br.com.idseven.agenda.nativebeta.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.errorMessage
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.designsystem.components.ErrorState
import br.com.idseven.agenda.nativebeta.designsystem.components.EventCard
import br.com.idseven.agenda.nativebeta.designsystem.components.Pill
import br.com.idseven.agenda.nativebeta.designsystem.components.SectionTitle
import br.com.idseven.agenda.nativebeta.designsystem.components.SkeletonList
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.EventStatus
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.TaskDeadline
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil

@Composable
fun DashboardScreen(
    eventsState: UiList<EventItem>,
    tasksState: UiList<TaskItem>,
    users: List<UserLite>,
    session: UserSession,
    onEventClick: (String) -> Unit,
    onTaskClick: (String) -> Unit,
) {
    eventsState.errorMessage()?.let { ErrorState("Hoje — $it"); return }
    if (eventsState.isLoading) { SkeletonList(); return }

    val today = DateUtil.todayIso()
    val events = eventsState.itemsOrEmpty()
    val tasks = tasksState.itemsOrEmpty()
    val todayEvents = events.filter { it.date == today }.sortedBy { it.start ?: "" }
    val upcoming = events.filter { (it.date ?: "") > today && !it.done }.sortedWith(compareBy({ it.date ?: "" }, { it.start ?: "" })).take(3)
    val urgent = tasks.filter { it.status != "concluido" }
        .sortedWith(compareBy(nullsLast()) { EventStatus.dtMs(it.dueDate, it.dueTime ?: "23:59") })
        .take(4)
    val name = UserColor.firstName(session.name).ifBlank { "equipe" }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp),
        contentPadding = PaddingValues(top = 10.dp, bottom = 24.dp),
    ) {
        item {
            Text("Olá, $name 👋", color = Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text("Resumo de hoje · ${DateUtil.dayShort(today)}", color = Tokens.Soft, fontSize = 13.sp)
            Spacer(Modifier.height(18.dp))
            Row {
                StatCard("Hoje", todayEvents.size.toString(), Icons.Outlined.Today, Modifier.weight(1f), accent = true)
                Spacer(Modifier.width(10.dp))
                StatCard("Tarefas", tasks.count { it.status != "concluido" }.toString(), Icons.Outlined.Checklist, Modifier.weight(1f))
                Spacer(Modifier.width(10.dp))
                StatCard("Equipe", users.count { it.isActive() }.toString(), Icons.Outlined.Group, Modifier.weight(1f))
            }
            Spacer(Modifier.height(24.dp))
            SectionTitle("Compromissos de hoje")
            Spacer(Modifier.height(12.dp))
        }
        if (todayEvents.isEmpty()) {
            item { EmptyLine("Nada agendado para hoje.") }
        } else {
            items(todayEvents, key = { "ev_${it.id}" }) { ev ->
                EventCard(ev, owner = users.firstOrNull { it.id == ev.ownerId }, onClick = { onEventClick(ev.id) })
            }
        }

        item {
            Spacer(Modifier.height(14.dp))
            SectionTitle("Tarefas urgentes")
            Spacer(Modifier.height(12.dp))
        }
        if (urgent.isEmpty()) {
            item { EmptyLine("Nenhuma tarefa pendente. 🎉") }
        } else {
            items(urgent, key = { "tk_${it.id}" }) { t -> UrgentTaskRow(t) { onTaskClick(t.id) } }
        }

        if (upcoming.isNotEmpty()) {
            item {
                Spacer(Modifier.height(14.dp))
                SectionTitle("Próximos compromissos")
                Spacer(Modifier.height(12.dp))
            }
            items(upcoming, key = { "up_${it.id}" }) { ev ->
                EventCard(ev, owner = users.firstOrNull { it.id == ev.ownerId }, onClick = { onEventClick(ev.id) })
            }
        }
    }
}

@Composable
private fun EmptyLine(text: String) {
    Text(text, color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
}

@Composable
private fun StatCard(label: String, value: String, icon: ImageVector, modifier: Modifier = Modifier, accent: Boolean = false) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(16.dp))
            .background(if (accent) Tokens.Accent else Tokens.Surface)
            .then(if (accent) Modifier else Modifier.border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)))
            .padding(14.dp),
    ) {
        Icon(icon, contentDescription = null, tint = if (accent) Color.White else Tokens.Accent, modifier = Modifier.size(20.dp))
        Spacer(Modifier.height(8.dp))
        Text(value, color = if (accent) Color.White else Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Text(label, color = if (accent) Color.White.copy(alpha = 0.85f) else Tokens.Soft, fontSize = 11.5.sp)
    }
}

@Composable
private fun UrgentTaskRow(task: TaskItem, onClick: () -> Unit) {
    val sector = Sectors.of(task.sector)
    val deadline = TaskDeadline.of(task)
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(14.dp))
            .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(14.dp)).clickable { onClick() }.padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(999.dp)).background(sector.color))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(task.title?.ifBlank { null } ?: task.client ?: "Sem título", color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(3.dp))
            Text(sector.label + (task.client?.let { " · $it" } ?: ""), color = Tokens.Faint, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (deadline != null) { Spacer(Modifier.width(8.dp)); Pill(deadline.text, deadline.color) }
    }
}
