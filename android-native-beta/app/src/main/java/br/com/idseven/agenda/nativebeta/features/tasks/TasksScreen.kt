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
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.graphics.vector.ImageVector
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
import br.com.idseven.agenda.nativebeta.domain.TaskDeadline
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskSort
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil
import kotlinx.coroutines.launch

private data class MoveOpt(val label: String, val target: String, val desc: String, val icon: ImageVector)

private fun moveOptions(status: String): List<MoveOpt> = when (status) {
    "afazer" -> listOf(MoveOpt("Mover para Em andamento", "andamento", "Começar a executar", Icons.Filled.KeyboardArrowRight))
    "andamento" -> listOf(
        MoveOpt("Mover para Revisão", "revisao", "Enviar para revisão", Icons.Filled.KeyboardArrowRight),
        MoveOpt("Voltar para A Fazer", "afazer", "Pausar e retornar", Icons.Filled.KeyboardArrowLeft),
    )
    "revisao" -> listOf(
        MoveOpt("Mover para Concluído", "concluido", "Finalizar a tarefa", Icons.Filled.KeyboardArrowRight),
        MoveOpt("Voltar para Em andamento", "andamento", "Precisa de ajustes", Icons.Filled.KeyboardArrowLeft),
    )
    else -> listOf(MoveOpt("Reabrir tarefa", "andamento", "Voltar para Em andamento", Icons.Outlined.Refresh))
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
        // Filtro de setor
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 2.dp)) {
            SectorChip("Todos", null, sectorFilter == null) { sectorFilter = null }
            Sectors.ALL.forEach { s -> SectorChip(s.label, s.color, sectorFilter == s.key) { sectorFilter = s.key } }
        }
        // Seletor/indicador de coluna
        Row(Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 8.dp)) {
            TaskStatus.COLUMNS.forEachIndexed { i, st ->
                val count = tasks.count { (it.status ?: "afazer") == st }
                val sel = pager.currentPage == i
                Box(
                    modifier = Modifier.weight(1f).padding(horizontal = 3.dp).clip(RoundedCornerShape(10.dp))
                        .background(if (sel) TaskStatus.color(st).copy(alpha = 0.18f) else Tokens.Surface)
                        .border(1.dp, if (sel) TaskStatus.color(st) else Tokens.Line, RoundedCornerShape(10.dp))
                        .clickable { scope.launch { pager.animateScrollToPage(i) } }
                        .padding(vertical = 7.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    val sl = when (st) { "andamento" -> "Andam."; "revisao" -> "Revisão"; "concluido" -> "Concl."; else -> "A Fazer" }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(sl, color = if (sel) TaskStatus.color(st) else Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        Text("$count", color = if (sel) TaskStatus.color(st) else Tokens.Soft, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (all.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth()) { EmptyState("Sem tarefas", "Toque em + para criar a primeira", Icons.Outlined.Checklist) }
            return
        }

        HorizontalPager(state = pager, modifier = Modifier.weight(1f).fillMaxWidth()) { page ->
            val st = TaskStatus.COLUMNS[page]
            val list = TaskSort.order(tasks.filter { (it.status ?: "afazer") == st })
            Column(Modifier.fillMaxHeight().padding(horizontal = 18.dp)) {
                ColumnHeader(st, list.size)
                if (list.isEmpty()) {
                    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { Text("Nenhuma tarefa aqui", color = Tokens.Faint, fontSize = 13.sp) }
                } else {
                    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PaddingValues(bottom = 24.dp)) {
                        items(list, key = { it.id }) { task ->
                            val requester = users.firstOrNull { it.id == task.by }
                            val assignee = users.firstOrNull { (it.name ?: "").equals(task.assignee ?: "", ignoreCase = true) }
                            TaskCardPro(task, requester, assignee, onClick = { onTaskClick(task.id) }, onMove = { moveTarget = task })
                        }
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
                moveOptions(target.status ?: "afazer").forEach { opt ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(14.dp))
                            .background(TaskStatus.color(opt.target).copy(alpha = 0.12f))
                            .clickable { scope.launch { TaskRepo.move(target, opt.target, currentUid) }; moveTarget = null }
                            .padding(vertical = 13.dp, horizontal = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.size(34.dp).clip(RoundedCornerShape(11.dp)).background(TaskStatus.color(opt.target).copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                            Icon(opt.icon, contentDescription = null, tint = TaskStatus.color(opt.target), modifier = Modifier.size(20.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(opt.label, color = TaskStatus.color(opt.target), fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text(opt.desc, color = Tokens.Faint, fontSize = 11.5.sp)
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun SectorChip(label: String, color: Color?, selected: Boolean, onClick: () -> Unit) {
    val c = color ?: Tokens.Accent
    Box(
        modifier = Modifier.padding(end = 8.dp).clip(RoundedCornerShape(999.dp))
            .background(if (selected) c.copy(alpha = 0.18f) else Tokens.Surface)
            .border(1.dp, if (selected) c else Tokens.Line, RoundedCornerShape(999.dp))
            .clickable { onClick() }.padding(horizontal = 14.dp, vertical = 7.dp),
    ) { Text(label, color = if (selected) c else Tokens.Soft, fontSize = 12.5.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ColumnHeader(st: String, count: Int) {
    val color = TaskStatus.color(st)
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 14.dp).clip(RoundedCornerShape(16.dp))
            .background(Tokens.Surface).border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(16.dp)).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(TaskStatus.label(st), color = color, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(TaskStatus.desc(st), color = Tokens.Faint, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        }
        Box(Modifier.clip(RoundedCornerShape(999.dp)).background(color.copy(alpha = 0.16f)).padding(horizontal = 12.dp, vertical = 5.dp)) {
            Text("$count", color = color, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun TaskCardPro(task: TaskItem, requester: UserLite?, assignee: UserLite?, onClick: () -> Unit, onMove: () -> Unit) {
    val sector = Sectors.of(task.sector)
    val total = task.checklist.size
    val done = task.checklist.count { it.d }
    val deadline = TaskDeadline.of(task)
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(18.dp))
            .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(18.dp))
            .clickable { onClick() }.padding(15.dp),
    ) {
        // 1. metadata: status + indicador de prazo
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(TaskStatus.color(task.status)))
            Spacer(Modifier.width(7.dp))
            Text(TaskStatus.label(task.status), color = TaskStatus.color(task.status), fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            if (deadline != null) Pill(deadline.text, deadline.color)
        }
        // 2-4. solicitante + data de lançamento
        if (requester != null || task.createdAt != null) {
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(requester?.photo, UserColor.of(requester?.id, requester?.color), requester?.name ?: "?", 36.dp)
                Spacer(Modifier.width(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text("Solicitado por ${UserColor.firstName(requester?.name).ifBlank { "—" }}", color = Tokens.Soft, fontSize = 12.sp, fontWeight = FontWeight.Medium, lineHeight = 14.sp)
                    task.createdAt?.let { Text("lançada em ${DateUtil.fmtMs(it)}", color = Tokens.Faint, fontSize = 11.sp, lineHeight = 13.sp) }
                }
            }
        }
        // 5. cliente (kicker)
        if (!task.client.isNullOrBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(task.client.uppercase(), color = Tokens.Soft, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp)
        }
        // 6. título
        Spacer(Modifier.height(3.dp))
        Text(task.title?.ifBlank { null } ?: task.client ?: "Sem título", color = Tokens.Ink, fontSize = 16.5.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        // 7. setor + prioridade
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Pill(sector.label, sector.color)
            if (task.priority) { Spacer(Modifier.width(8.dp)); Pill("Prioridade alta", Tokens.Red) }
        }
        // 8-10. responsável + prazo
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (!task.assignee.isNullOrBlank()) {
                Avatar(assignee?.photo, UserColor.of(assignee?.id, assignee?.color), task.assignee, 36.dp)
                Spacer(Modifier.width(8.dp))
                Text(UserColor.firstName(task.assignee), color = Tokens.Soft, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            } else {
                Text("Sem responsável", color = Tokens.Faint, fontSize = 12.sp, modifier = Modifier.weight(1f, fill = false))
            }
            Spacer(Modifier.weight(1f))
            if (!task.dueDate.isNullOrBlank()) {
                Icon(Icons.Outlined.Schedule, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(DateUtil.prazo(task.dueDate, task.dueTime), color = Tokens.Faint, fontSize = 12.sp)
            }
        }
        // 12. checklist progress
        if (total > 0) {
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(progress = { done.toFloat() / total.toFloat() }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = Tokens.Green, trackColor = Tokens.Surface2)
            Spacer(Modifier.height(4.dp))
            Text("$done de $total no checklist", color = Tokens.Faint, fontSize = 11.sp)
        }
        // 13. mover
        Spacer(Modifier.height(14.dp))
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Accent.copy(alpha = 0.12f)).clickable { onMove() }.padding(vertical = 11.dp),
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.SwapHoriz, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("Mover status", color = Tokens.Accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}
