package br.com.idseven.agenda.nativebeta.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.errorMessage
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.data.TaskRepo
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.components.EmptyState
import br.com.idseven.agenda.nativebeta.designsystem.components.ErrorState
import br.com.idseven.agenda.nativebeta.designsystem.components.Pill
import br.com.idseven.agenda.nativebeta.designsystem.components.SearchField
import br.com.idseven.agenda.nativebeta.designsystem.components.SkeletonList
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import kotlinx.coroutines.launch

@Composable
fun TasksScreen(
    tasksState: UiList<TaskItem>,
    users: List<UserLite>,
    currentUid: String?,
    onTaskClick: (String) -> Unit,
) {
    tasksState.errorMessage()?.let { ErrorState("Tarefas — $it"); return }
    if (tasksState.isLoading) { SkeletonList(); return }
    val all = tasksState.itemsOrEmpty()
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf("") }
    var sectorFilter by remember { mutableStateOf<String?>(null) }
    val q = query.trim().lowercase()
    val tasks = all.filter { t ->
        val okQ = q.isEmpty() || listOf(t.title, t.client, t.assignee).any { (it ?: "").lowercase().contains(q) }
        val okS = sectorFilter == null || t.sector == sectorFilter
        okQ && okS
    }

    Column(Modifier.fillMaxSize()) {
        SearchField(query, { query = it }, "Buscar tarefa…")
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 4.dp)) {
            FilterChip(selected = sectorFilter == null, onClick = { sectorFilter = null }, label = { Text("Todos") }, modifier = Modifier.padding(end = 8.dp))
            Sectors.ALL.forEach { s ->
                FilterChip(
                    selected = sectorFilter == s.key, onClick = { sectorFilter = s.key }, label = { Text(s.label) },
                    modifier = Modifier.padding(end = 8.dp),
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = s.color.copy(alpha = 0.18f), selectedLabelColor = s.color),
                )
            }
        }

        if (all.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                EmptyState("Sem tarefas", "Lidas do Firestore: 0 — toque em + para criar", Icons.Outlined.Checklist)
            }
            return
        }

        val pager = rememberPagerState(pageCount = { TaskStatus.COLUMNS.size })
        HorizontalPager(
            state = pager,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 22.dp),
            pageSpacing = 12.dp,
        ) { page ->
            val st = TaskStatus.COLUMNS[page]
            val list = tasks.filter { (it.status ?: "afazer") == st }
            Column(Modifier.fillMaxHeight().padding(vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 4.dp, bottom = 10.dp)) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(TaskStatus.color(st)))
                    Spacer(Modifier.width(8.dp))
                    Text(TaskStatus.label(st), color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.width(8.dp))
                    CountPill(list.size, TaskStatus.color(st))
                }
                if (list.isEmpty()) {
                    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                        Text("Nada aqui", color = Tokens.Faint, fontSize = 13.sp)
                    }
                } else {
                    LazyColumn(Modifier.fillMaxWidth()) {
                        items(list, key = { it.id }) { task ->
                            val owner = users.firstOrNull { (it.name ?: "").equals(task.assignee ?: "", ignoreCase = true) }
                            KanbanCard(
                                task = task, owner = owner,
                                onClick = { onTaskClick(task.id) },
                                onMove = { dir ->
                                    val idx = TaskStatus.COLUMNS.indexOf(st)
                                    val target = idx + dir
                                    if (target in TaskStatus.COLUMNS.indices) {
                                        scope.launch { TaskRepo.move(task, TaskStatus.COLUMNS[target], currentUid) }
                                    }
                                },
                                canPrev = TaskStatus.COLUMNS.indexOf(st) > 0,
                                canNext = TaskStatus.COLUMNS.indexOf(st) < TaskStatus.COLUMNS.size - 1,
                            )
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun CountPill(count: Int, color: Color) {
    Box(Modifier.clip(RoundedCornerShape(999.dp)).background(color.copy(alpha = 0.16f)).padding(horizontal = 9.dp, vertical = 2.dp)) {
        Text("$count", color = color, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun KanbanCard(
    task: TaskItem,
    owner: UserLite?,
    onClick: () -> Unit,
    onMove: (Int) -> Unit,
    canPrev: Boolean,
    canNext: Boolean,
) {
    val sector = Sectors.of(task.sector)
    val total = task.checklist.size
    val done = task.checklist.count { it.d }
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
            .clip(RoundedCornerShape(16.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)),
    ) {
        Box(Modifier.width(4.dp).fillMaxHeight().background(sector.color))
        Column(Modifier.weight(1f).clickable { onClick() }.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (task.priority) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(Tokens.Red)); Spacer(Modifier.width(8.dp))
                }
                Text(
                    task.title?.ifBlank { null } ?: task.client ?: "Sem título",
                    color = Tokens.Ink, fontSize = 15.5.sp, fontWeight = FontWeight.Bold,
                    maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Pill(sector.label, sector.color)
                if (!task.dueDate.isNullOrBlank()) {
                    Spacer(Modifier.width(8.dp))
                    Text(task.dueDate, color = Tokens.Soft, fontSize = 12.sp)
                }
            }
            if (total > 0) {
                Spacer(Modifier.height(10.dp))
                LinearProgressIndicator(
                    progress = { done.toFloat() / total.toFloat() },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                    color = Tokens.Green, trackColor = Tokens.Surface2,
                )
                Spacer(Modifier.height(4.dp))
                Text("$done/$total no checklist", color = Tokens.Faint, fontSize = 11.sp)
            }
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!task.assignee.isNullOrBlank()) {
                    Avatar(owner?.photo, UserColor.of(owner?.id, owner?.color), task.assignee, 24.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(UserColor.firstName(task.assignee), color = Tokens.Soft, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                } else {
                    Spacer(Modifier.weight(1f))
                }
                MoveBtn(Icons.Filled.KeyboardArrowLeft, canPrev) { onMove(-1) }
                Spacer(Modifier.width(8.dp))
                MoveBtn(Icons.Filled.KeyboardArrowRight, canNext) { onMove(1) }
            }
        }
    }
}

@Composable
private fun MoveBtn(icon: androidx.compose.ui.graphics.vector.ImageVector, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(34.dp).clip(RoundedCornerShape(10.dp))
            .background(if (enabled) Tokens.Accent.copy(alpha = 0.14f) else Tokens.Surface2)
            .clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = null, tint = if (enabled) Tokens.Accent else Tokens.Faint, modifier = Modifier.size(22.dp)) }
}
