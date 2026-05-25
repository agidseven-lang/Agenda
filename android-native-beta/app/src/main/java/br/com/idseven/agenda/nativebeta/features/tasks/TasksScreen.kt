package br.com.idseven.agenda.nativebeta.features.tasks

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.designsystem.components.EmptyState
import br.com.idseven.agenda.nativebeta.designsystem.components.LoadingState
import br.com.idseven.agenda.nativebeta.designsystem.components.Pill
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.domain.UserLite

@Composable
fun TasksScreen(tasksState: UiList<TaskItem>, users: List<UserLite>) {
    if (tasksState.isLoading) { LoadingState(); return }
    val tasks = tasksState.itemsOrEmpty()
    if (tasks.isEmpty()) {
        EmptyState("Sem tarefas", "O gerenciador de tarefas aparece aqui em tempo real", Icons.Outlined.Checklist)
        return
    }
    val byStatus = TaskStatus.COLUMNS.associateWith { st -> tasks.filter { (it.status ?: "afazer") == st } }
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp),
    ) {
        TaskStatus.COLUMNS.forEach { st ->
            val list = byStatus[st] ?: emptyList()
            item(key = "h_$st") { StatusHeader(TaskStatus.label(st), TaskStatus.color(st), list.size) }
            items(list, key = { it.id }) { TaskCard(it) }
        }
    }
}

@Composable
private fun StatusHeader(label: String, color: Color, count: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 16.dp, bottom = 10.dp)) {
        Box(Modifier.size(9.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.width(6.dp))
        Text("($count)", color = Tokens.Faint, fontSize = 12.sp)
    }
}

@Composable
private fun TaskCard(task: TaskItem) {
    val sector = Sectors.of(task.sector)
    val checkDone = task.checklist.count { it.d }
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
            .clip(RoundedCornerShape(14.dp)).background(Tokens.Surface).padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (task.priority) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(Tokens.Red))
                Spacer(Modifier.width(8.dp))
            }
            Text(
                task.title?.ifBlank { null } ?: task.client ?: "Sem título",
                color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold,
                maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Pill(sector.label, sector.color)
            if (!task.client.isNullOrBlank()) {
                Spacer(Modifier.width(8.dp))
                Text(task.client, color = Tokens.Soft, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (task.checklist.isNotEmpty() || !task.assignee.isNullOrBlank() || !task.dueDate.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (task.checklist.isNotEmpty()) {
                    Text("✓ $checkDone/${task.checklist.size}", color = Tokens.Faint, fontSize = 12.sp)
                    Spacer(Modifier.width(10.dp))
                }
                if (!task.assignee.isNullOrBlank()) {
                    Text(task.assignee, color = Tokens.Faint, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                }
                if (!task.dueDate.isNullOrBlank()) {
                    Spacer(Modifier.width(10.dp))
                    Text(task.dueDate, color = Tokens.Faint, fontSize = 12.sp)
                }
            }
        }
    }
}
