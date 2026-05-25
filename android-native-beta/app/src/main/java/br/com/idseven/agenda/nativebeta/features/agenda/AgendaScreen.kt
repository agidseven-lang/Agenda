package br.com.idseven.agenda.nativebeta.features.agenda

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.designsystem.components.EmptyState
import br.com.idseven.agenda.nativebeta.designsystem.components.EventCard
import br.com.idseven.agenda.nativebeta.designsystem.components.LoadingState
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil

@Composable
fun AgendaScreen(eventsState: UiList<EventItem>, users: List<UserLite>) {
    if (eventsState.isLoading) { LoadingState(); return }
    val events = eventsState.itemsOrEmpty().sortedWith(compareBy({ it.date ?: "" }, { it.start ?: "" }))
    if (events.isEmpty()) {
        EmptyState("Agenda da equipe vazia", "Os compromissos aparecem aqui em tempo real", Icons.Outlined.CalendarMonth)
        return
    }
    val groups = events.groupBy { it.date ?: "" }
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp),
    ) {
        groups.forEach { (date, list) ->
            item(key = "h_$date") { DateHeader(date) }
            items(list, key = { it.id }) { ev ->
                EventCard(ev, owner = users.firstOrNull { it.id == ev.ownerId })
            }
        }
    }
}

@Composable
private fun DateHeader(date: String) {
    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, modifier = Modifier.padding(top = 14.dp, bottom = 10.dp)) {
        Text(DateUtil.dayLabel(date), color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(8.dp))
        Text(DateUtil.dayShort(date), color = Tokens.Faint, fontSize = 12.sp)
    }
}
