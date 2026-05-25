package br.com.idseven.agenda.nativebeta.features.agenda

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
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
import br.com.idseven.agenda.nativebeta.designsystem.components.SearchField
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.Types
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil

@Composable
fun AgendaScreen(eventsState: UiList<EventItem>, users: List<UserLite>, onEventClick: (String) -> Unit) {
    if (eventsState.isLoading) { LoadingState(); return }
    val all = eventsState.itemsOrEmpty()

    var query by remember { mutableStateOf("") }
    var typeFilter by remember { mutableStateOf<String?>(null) }

    val q = query.trim().lowercase()
    val filtered = all.filter { e ->
        val okQ = q.isEmpty() || listOf(e.client, e.title, e.owner, e.location).any { (it ?: "").lowercase().contains(q) }
        val okT = typeFilter == null || e.type == typeFilter
        okQ && okT
    }.sortedWith(compareBy({ it.date ?: "" }, { it.start ?: "" }))

    Column(Modifier.fillMaxSize()) {
        SearchField(query, { query = it }, "Buscar por cliente, título, responsável…")
        TypeFilters(typeFilter) { typeFilter = it }

        if (filtered.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                EmptyState("Nada encontrado", "Ajuste a busca ou os filtros", Icons.Outlined.CalendarMonth)
            }
        } else {
            val groups = filtered.groupBy { it.date ?: "" }
            LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 18.dp), contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp)) {
                groups.forEach { (date, list) ->
                    item(key = "h_$date") { DateHeader(date) }
                    items(list, key = { it.id }) { ev ->
                        EventCard(ev, owner = users.firstOrNull { it.id == ev.ownerId }, onClick = { onEventClick(ev.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun TypeFilters(selected: String?, onSelect: (String?) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 4.dp)) {
        FilterChip(selected = selected == null, onClick = { onSelect(null) }, label = { Text("Todos") }, modifier = Modifier.padding(end = 8.dp))
        Types.ALL.forEach { t ->
            FilterChip(
                selected = selected == t.key, onClick = { onSelect(t.key) }, label = { Text(t.label) },
                modifier = Modifier.padding(end = 8.dp),
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = t.color.copy(alpha = 0.18f), selectedLabelColor = t.color),
            )
        }
    }
}

@Composable
private fun DateHeader(date: String) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 14.dp, bottom = 10.dp)) {
        Text(DateUtil.dayLabel(date), color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(8.dp))
        Text(DateUtil.dayShort(date), color = Tokens.Faint, fontSize = 12.sp)
    }
}
