package br.com.idseven.agenda.nativebeta.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
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

private fun colDesc(st: String): String = when (st) {
    "andamento" -> "Em execução agora"
    "concluido" -> "Tarefas finalizadas"
    else -> "Aguardando início"
}

private fun moveOptions(status: String): List<Pair<String, String>> = when (status) {
    "afazer" -> listOf("Mover para Em andamento" to "andamento", "Mover para Concluído" to "concluido")
    "andamento" -> listOf("Voltar para A Fazer" to "afazer", "Mover para Concluído" to "concluido")
    else -> listOf("Reabrir tarefa (Em andamento)" to "andamento", "Voltar para A Fazer" to "afazer")
}

@OptIn(ExperimentalMaterial3Api::class)
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
    var moveTarget by remember { mutableStateOf<TaskItem?>(null) }

    val q = query.trim().lowercase()
    val tasks = all.filter { t ->
        val okQ = q.isEmpty() || listOf(t.title, t.client, t.assignee).any { (it ?: "").lowercase().contains(q) }
        val okS = sectorFilter == null || t.sector == sectorFilter
        okQ && okS
    }
    val pager = rememberPagerState(pageCount = { TaskStatus.COLUMNS.size })

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

        // Seletor de coluna (sincronizado com o swipe) — também serve de indicador de página
        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 6.dp)) {
            TaskStatus.COLUMNS.forEachIndexed { i, st ->
                val count = tasks.count { (it.status ?: "afazer") == st }
                val sel = pager.currentPage == i
                Box(
                    modifier = Modifier.weight(1f).padding(horizontal = 3.dp).clip(RoundedCornerShape(12.dp))
                        .background(if (sel) TaskStatus.color(st).copy(alpha = 0.18f) else Tokens.Surface)
                        .border(1.dp, if (sel) TaskStatus.color(st) else Tokens.Line, RoundedCornerShape(12.dp))
                        .clickable { scope.launch { pager.animateScrollToPage(i) } }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "${TaskStatus.label(st)} · $count",
                        color = if (sel) TaskStatus.color(st) else Tokens.Soft,
                        fontSize = 11.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }

        if (all.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth()) { EmptyState("Sem tarefas", "Toque em + para criar a primeira", Icons.Outlined.Checklist) }
            return
        }

        HorizontalPager(state = pager, modifier = Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(horizontal = 18.dp), pageSpacing = 12.dp) { page ->
            val st = TaskStatus.COLUMNS[page]
            val list = tasks.filter { (it.status ?: "afazer") == st }
            Column(Modifier.fillMaxHeight()) {
                Column(Modifier.padding(top = 6.dp, bottom = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(10.dp).clip(CircleShape).background(TaskStatus.color(st)))
                        Spacer(Modifier.width(8.dp))
                        Text(TaskStatus.label(st), color = Tokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(8.dp))
                        Text("(${list.size})", color = Tokens.Faint, fontSize = 13.sp)
                    }
                    Text(colDesc(st), color = Tokens.Faint, fontSize = 12.sp, modifier = Modifier.padding(start = 18.dp, top = 2.dp))
                }
                if (list.isEmpty()) {
                    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { Text("Nenhuma tarefa aqui", color = Tokens.Faint, fontSize = 13.sp) }
                } else {
                    LazyColumn(Modifier.fillMaxWidth()) {
                        items(list, key = { it.id }) { task ->
                            val owner = users.firstOrNull { (it.name ?: "").equals(task.assignee ?: "", ignoreCase = true) }
                            KanbanCard(task, owner, onClick = { onTaskClick(task.id) }, onMove = { moveTarget = task })
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }

    val target = moveTarget
    if (target != null) {
        ModalBottomSheet(onDismissRequest = { moveTarget = null }, containerColor = Tokens.Surface) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp)) {
                Text("Mover tarefa", color = Tokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(2.dp))
                Text(target.title?.ifBlank { null } ?: target.client ?: "Tarefa", color = Tokens.Soft, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(14.dp))
                moveOptions(target.status ?: "afazer").forEach { (label, st) ->
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(12.dp))
                            .background(TaskStatus.color(st).copy(alpha = 0.14f))
                            .clickable { scope.launch { TaskRepo.move(target, st, currentUid) }; moveTarget = null }
                            .padding(vertical = 15.dp, horizontal = 16.dp),
                    ) { Text(label, color = TaskStatus.color(st), fontSize = 14.sp, fontWeight = FontWeight.Bold) }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun KanbanCard(task: TaskItem, owner: UserLite?, onClick: () -> Unit, onMove: () -> Unit) {
    val sector = Sectors.of(task.sector)
    val total = task.checklist.size
    val done = task.checklist.count { it.d }
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(16.dp))
            .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp))
            .clickable { onClick() }.padding(16.dp),
    ) {
        Text(task.title?.ifBlank { null } ?: task.client ?: "Sem título", color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (!task.client.isNullOrBlank() && !task.title.isNullOrBlank()) {
            Spacer(Modifier.height(2.dp))
            Text(task.client, color = Tokens.Soft, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Pill(sector.label, sector.color)
            if (task.priority) {
                Spacer(Modifier.width(8.dp))
                Pill("Prioridade alta", Tokens.Red)
            }
        }
        if (total > 0) {
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(progress = { done.toFloat() / total.toFloat() }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = Tokens.Green, trackColor = Tokens.Surface2)
            Spacer(Modifier.height(4.dp))
            Text("$done de $total no checklist", color = Tokens.Faint, fontSize = 11.sp)
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
            if (!task.dueDate.isNullOrBlank()) {
                Icon(Icons.Outlined.Schedule, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(4.dp))
                Text(task.dueDate, color = Tokens.Faint, fontSize = 12.sp)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Accent.copy(alpha = 0.12f)).clickable { onMove() }.padding(vertical = 11.dp),
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.SwapHoriz, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Mover", color = Tokens.Accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}
