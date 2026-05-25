package br.com.idseven.agenda.nativebeta.features.agenda

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.errorMessage
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.designsystem.components.EmptyState
import br.com.idseven.agenda.nativebeta.designsystem.components.ErrorState
import br.com.idseven.agenda.nativebeta.designsystem.components.EventCard
import br.com.idseven.agenda.nativebeta.designsystem.components.SearchField
import br.com.idseven.agenda.nativebeta.designsystem.components.SkeletonList
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.Types
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil
import java.time.LocalDate
import java.time.YearMonth

@Composable
fun AgendaScreen(eventsState: UiList<EventItem>, users: List<UserLite>, onEventClick: (String) -> Unit) {
    eventsState.errorMessage()?.let { ErrorState("Agenda — $it"); return }
    if (eventsState.isLoading) { SkeletonList(); return }
    val all = eventsState.itemsOrEmpty()

    var month by remember { mutableStateOf(YearMonth.now()) }
    var selected by remember { mutableStateOf(LocalDate.now()) }
    var query by remember { mutableStateOf("") }
    var typeFilter by remember { mutableStateOf<String?>(null) }
    var listMode by remember { mutableStateOf(false) }

    val q = query.trim().lowercase()
    val filtered = all.filter { e ->
        val okQ = q.isEmpty() || listOf(e.client, e.title, e.owner, e.location).any { (it ?: "").lowercase().contains(q) }
        val okT = typeFilter == null || e.type == typeFilter
        okQ && okT
    }
    val eventsByDay: Map<LocalDate, List<EventItem>> = filtered
        .mapNotNull { e -> parseDay(e.date)?.let { it to e } }
        .groupBy({ it.first }, { it.second })

    fun ownerOf(e: EventItem) = users.firstOrNull { it.id == e.ownerId }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(start = 18.dp, top = 12.dp, end = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Agenda", color = Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Toggle("Dia", !listMode) { listMode = false }
            Spacer(Modifier.width(8.dp))
            Toggle("Lista", listMode) { listMode = true }
        }
        SearchField(query, { query = it }, "Buscar compromisso…")
        TypeFilters(typeFilter) { typeFilter = it }

        if (!listMode) {
            Column(Modifier.padding(horizontal = 18.dp)) {
                CalendarCard(
                    month = month, selected = selected, eventsByDay = eventsByDay,
                    onPrev = { month = month.minusMonths(1) },
                    onNext = { month = month.plusMonths(1) },
                    onSelect = { selected = it },
                )
            }
            val dayEvents = (eventsByDay[selected] ?: emptyList()).sortedBy { it.start ?: "" }
            val iso = selected.toString()
            Row(Modifier.fillMaxWidth().padding(start = 18.dp, top = 16.dp, end = 18.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(DateUtil.dayLabel(iso), color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(8.dp))
                Text(DateUtil.dayShort(iso), color = Tokens.Faint, fontSize = 12.5.sp, modifier = Modifier.weight(1f))
                Text("${dayEvents.size} ${if (dayEvents.size == 1) "item" else "itens"}", color = Tokens.Faint, fontSize = 12.sp)
            }
            if (dayEvents.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth()) { EmptyState("Dia livre", "Nenhum compromisso neste dia", Icons.Outlined.CalendarMonth) }
            } else {
                LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 18.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
                    items(dayEvents, key = { it.id }) { ev -> EventCard(ev, ownerOf(ev)) { onEventClick(ev.id) } }
                }
            }
        } else {
            val ordered = filtered.sortedWith(compareBy({ it.date ?: "" }, { it.start ?: "" }))
            if (ordered.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    EmptyState(if (all.isEmpty()) "Nenhum compromisso" else "Nada encontrado", if (all.isEmpty()) "Lidos do Firestore: 0" else "Ajuste a busca ou os filtros", Icons.Outlined.CalendarMonth)
                }
            } else {
                val groups = ordered.groupBy { it.date ?: "" }
                LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 18.dp), contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp)) {
                    groups.forEach { (date, list) ->
                        item(key = "h_$date") {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 14.dp, bottom = 10.dp)) {
                                Text(DateUtil.dayLabel(date), color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.width(8.dp))
                                Text(DateUtil.dayShort(date), color = Tokens.Faint, fontSize = 12.sp)
                            }
                        }
                        items(list, key = { it.id }) { ev -> EventCard(ev, ownerOf(ev)) { onEventClick(ev.id) } }
                    }
                }
            }
        }
    }
}

private fun parseDay(date: String?): LocalDate? = runCatching { LocalDate.parse(date) }.getOrNull()

@Composable
private fun Toggle(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier.clip(RoundedCornerShape(999.dp))
            .background(if (selected) Tokens.Accent else Tokens.Surface2)
            .clickable { onClick() }.padding(horizontal = 14.dp, vertical = 7.dp),
    ) { Text(label, color = if (selected) androidx.compose.ui.graphics.Color.White else Tokens.Soft, fontSize = 12.5.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun TypeFilters(selected: String?, onSelect: (String?) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 6.dp)) {
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
