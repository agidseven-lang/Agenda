package br.com.idseven.agenda.nativebeta.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.designsystem.components.EventCard
import br.com.idseven.agenda.nativebeta.designsystem.components.LoadingState
import br.com.idseven.agenda.nativebeta.designsystem.components.SectionTitle
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventItem
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
) {
    if (eventsState.isLoading) { LoadingState(); return }

    val today = DateUtil.todayIso()
    val events = eventsState.itemsOrEmpty()
    val tasks = tasksState.itemsOrEmpty()
    val todayEvents = events.filter { it.date == today }.sortedBy { it.start ?: "" }
    val openTasks = tasks.filter { it.status != "concluido" }
    val name = UserColor.firstName(session.name).ifBlank { "equipe" }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp),
    ) {
        item {
            Text("Olá, $name", color = Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text("Resumo de hoje · ${DateUtil.dayShort(today)}", color = Tokens.Soft, fontSize = 13.sp)
            Spacer(Modifier.height(16.dp))
            Row {
                StatCard("Hoje", todayEvents.size.toString(), Modifier.weight(1f), accent = true)
                Spacer(Modifier.width(10.dp))
                StatCard("Tarefas abertas", openTasks.size.toString(), Modifier.weight(1f))
                Spacer(Modifier.width(10.dp))
                StatCard("Equipe", users.count { it.isActive() }.toString(), Modifier.weight(1f))
            }
            Spacer(Modifier.height(22.dp))
            SectionTitle("Compromissos de hoje")
            Spacer(Modifier.height(12.dp))
        }
        if (todayEvents.isEmpty()) {
            item {
                Text("Nada agendado para hoje.", color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.padding(vertical = 8.dp))
            }
        } else {
            items(todayEvents, key = { it.id }) { ev ->  // beta 1.0.0
                EventCard(ev, owner = users.firstOrNull { it.id == ev.ownerId }, onClick = { onEventClick(ev.id) })
            }
        }
    }
}

@Composable
private fun RowScopeStat() {}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier, accent: Boolean = false) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(16.dp))
            .background(if (accent) Tokens.Accent else Tokens.Surface)
            .padding(horizontal = 14.dp, vertical = 16.dp),
    ) {
        Text(value, color = if (accent) Color.White else Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(2.dp))
        Text(label, color = if (accent) Color.White.copy(alpha = 0.85f) else Tokens.Soft, fontSize = 11.5.sp)
    }
}
