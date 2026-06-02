package br.com.idseven.agenda.nativebeta.features.agenda

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

private const val ANCHOR = 1200
private fun monthsBetween(a: YearMonth, b: YearMonth) = (b.year - a.year) * 12 + (b.monthValue - a.monthValue)

@Composable
fun AgendaScreen(eventsState: UiList<EventItem>, users: List<UserLite>, onEventClick: (String) -> Unit) {
    eventsState.errorMessage()?.let { ErrorState("Agenda — $it"); return }
    if (eventsState.isLoading) { SkeletonList(); return }
    val all = eventsState.itemsOrEmpty()
    val scope = rememberCoroutineScope()

    val base = remember { YearMonth.now() }
    val pager = rememberPagerState(initialPage = ANCHOR, pageCount = { ANCHOR * 2 })
    val month = base.plusMonths((pager.currentPage - ANCHOR).toLong())
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
        Row(Modifier.fillMaxWidth().padding(start = 18.dp, top = 10.dp, end = 14.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            if (!listMode) {
                Text(monthLabel(month), color = Tokens.Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(6.dp))
                Text("${month.year}", color = Tokens.Soft, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(999.dp)).clickable { scope.launch { pager.animateScrollToPage(ANCHOR) }; selected = LocalDate.now() }.padding(horizontal = 14.dp, vertical = 8.dp)) {
                    Text("Hoje", color = Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(8.dp))
                NavBtn(Icons.Filled.KeyboardArrowLeft) { scope.launch { pager.animateScrollToPage(pager.currentPage - 1) } }
                Spacer(Modifier.width(6.dp))
                NavBtn(Icons.Filled.KeyboardArrowRight) { scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } }
            } else {
                Text("Agenda", color = Tokens.Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp).clip(RoundedCornerShape(14.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(14.dp)).padding(4.dp)) {
            Seg("Mês", !listMode, Modifier.weight(1f)) { listMode = false }
            Seg("Agenda", listMode, Modifier.weight(1f)) { listMode = true }
        }
        SearchField(query, { query = it }, "Buscar compromisso…")
        TypeFilters(typeFilter) { typeFilter = it }

        if (!listMode) {
            val dayEvents = (eventsByDay[selected] ?: emptyList()).sortedBy { it.start ?: "" }
            val iso = selected.toString()
            LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 18.dp), contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp)) {
                item("cal") {
                    HorizontalPager(state = pager, modifier = Modifier.fillMaxWidth().height(366.dp)) { page ->
                        val m = base.plusMonths((page - ANCHOR).toLong())
                        CalendarCard(m, selected, eventsByDay) { d ->
                            selected = d
                            if (YearMonth.from(d) != m) scope.launch { pager.animateScrollToPage(ANCHOR + monthsBetween(base, YearMonth.from(d))) }
                        }
                    }
                }
                item("dh") {
                    Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(DateUtil.dayLabel(iso), color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(8.dp))
                        Text(DateUtil.dayShort(iso), color = Tokens.Faint, fontSize = 12.5.sp, modifier = Modifier.weight(1f))
                        Text("${dayEvents.size} ${if (dayEvents.size == 1) "item" else "itens"}", color = Tokens.Faint, fontSize = 12.sp)
                    }
                }
                if (dayEvents.isEmpty()) {
                    // Estado vazio do modo Mês — premium (em vez de texto solto).
                    item("empty") {
                        EmptyState(
                            "Dia livre",
                            "Nenhum compromisso para esta data.",
                            Icons.Outlined.CalendarMonth,
                            modifier = Modifier.padding(vertical = 32.dp),
                        )
                    }
                } else {
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
                // Modo Lista premium: agrupa Atrasados / Hoje / Proximos (derivado da data,
                // sem mudar schema). Dentro de cada secao, mantem o sub-cabecalho por dia.
                val today = LocalDate.now()
                fun bucket(d: LocalDate?): Int = when {
                    d == null -> 2                            // sem data -> Proximos
                    d.isBefore(today) -> 0                    // Atrasados
                    d == today -> 1                           // Hoje
                    else -> 2                                  // Proximos
                }
                val grouped = ordered.groupBy { bucket(parseDay(it.date)) }
                val sections = listOf(
                    Triple(0, "Atrasados", Tokens.Red),
                    Triple(1, "Hoje", Tokens.Accent),
                    Triple(2, "Próximos", Tokens.Soft),
                )
                LazyColumn(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 18.dp), contentPadding = PaddingValues(top = 4.dp, bottom = 24.dp)) {
                    sections.forEach { (idx, sectionLabel, sectionColor) ->
                        val list = grouped[idx] ?: emptyList()
                        if (list.isNotEmpty()) {
                            item(key = "section_$idx") {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 18.dp, bottom = 6.dp)) {
                                    Box(Modifier.size(8.dp).clip(RoundedCornerShape(999.dp)).background(sectionColor))
                                    Spacer(Modifier.width(8.dp))
                                    Text(sectionLabel, color = sectionColor, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    Spacer(Modifier.width(8.dp))
                                    Box(Modifier.clip(RoundedCornerShape(999.dp)).background(sectionColor.copy(alpha = 0.14f)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                                        Text("${list.size}", color = sectionColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                            // Sub-cabecalho por dia dentro da secao
                            list.groupBy { it.date ?: "" }.forEach { (date, dayList) ->
                                item(key = "h_${idx}_$date") {
                                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 10.dp, bottom = 8.dp)) {
                                        Text(DateUtil.dayLabel(date), color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                        Spacer(Modifier.width(8.dp))
                                        Text(DateUtil.dayShort(date), color = Tokens.Faint, fontSize = 12.sp)
                                    }
                                }
                                items(dayList, key = { it.id }) { ev -> EventCard(ev, ownerOf(ev)) { onEventClick(ev.id) } }
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun parseDay(date: String?): LocalDate? = runCatching { LocalDate.parse(date) }.getOrNull()

@Composable
private fun Seg(label: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier.clip(RoundedCornerShape(11.dp)).background(if (selected) Tokens.Accent else Color.Transparent).clickable { onClick() }.padding(vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (selected) Color.White else Tokens.Soft, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun NavBtn(icon: ImageVector, onClick: () -> Unit) {
    Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onClick() }, contentAlignment = Alignment.Center) {
        Icon(icon, contentDescription = null, tint = Tokens.Soft, modifier = Modifier.size(22.dp))
    }
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
