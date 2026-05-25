package br.com.idseven.agenda.nativebeta.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.RadioButtonUnchecked
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.data.TaskRepo
import br.com.idseven.agenda.nativebeta.designsystem.components.LoadingState
import br.com.idseven.agenda.nativebeta.designsystem.components.Pill
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.domain.UserLite
import kotlinx.coroutines.launch

@Composable
fun TaskDetailScreen(
    id: String,
    users: List<UserLite>,
    canManage: Boolean,
    currentUid: String?,
    onBack: () -> Unit,
    onEdit: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val flow = remember(id) { TaskRepo.task(id) }
    val task by flow.collectAsState(initial = null)
    var confirmDelete by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 14.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Tarefa", color = Tokens.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (canManage) {
                IconBtn(Icons.Outlined.Edit, Tokens.Soft) { task?.let { onEdit(it.id) } }
                Spacer(Modifier.width(6.dp))
                IconBtn(Icons.Outlined.Delete, Tokens.Red) { confirmDelete = true }
                Spacer(Modifier.width(6.dp))
            }
            IconBtn(Icons.Outlined.Close, Tokens.Soft) { onBack() }
        }

        val t = task
        if (t == null) {
            LoadingState()
        } else {
            val sector = Sectors.of(t.sector)
            val creator = t.by?.let { b -> users.firstOrNull { it.id == b } }
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                Box(Modifier.padding(bottom = 12.dp)) { Pill(sector.label, sector.color) }
                Text(t.title?.ifBlank { null } ?: t.client ?: "Sem título", color = Tokens.Ink, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(18.dp))

                // Status (mudança com rastreio)
                Text("STATUS", color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    TaskStatus.COLUMNS.forEach { st ->
                        FilterChip(
                            selected = (t.status ?: "afazer") == st,
                            onClick = { scope.launch { TaskRepo.move(t, st, currentUid) } },
                            label = { Text(TaskStatus.label(st)) },
                            modifier = Modifier.padding(end = 8.dp),
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TaskStatus.color(st).copy(alpha = 0.18f),
                                selectedLabelColor = TaskStatus.color(st),
                            ),
                        )
                    }
                }
                Spacer(Modifier.height(18.dp))

                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)).padding(16.dp)) {
                    if (!t.client.isNullOrBlank()) InfoRow("Cliente", t.client)
                    if (!t.assignee.isNullOrBlank()) InfoRow("Responsável", t.assignee)
                    if (!t.dueDate.isNullOrBlank()) InfoRow("Prazo", t.dueDate + (t.dueTime?.let { if (it.isNotBlank()) " às $it" else "" } ?: ""))
                    if (t.priority) InfoRow("Prioridade", "Alta")
                    if (!t.link.isNullOrBlank()) InfoRow("Link", t.link)
                    InfoRow("Criado por", creator?.name ?: "—", last = true)
                }

                if (!t.desc.isNullOrBlank()) {
                    Spacer(Modifier.height(16.dp))
                    Text("DESCRIÇÃO", color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp)
                    Spacer(Modifier.height(6.dp))
                    Text(t.desc, color = Tokens.Ink, fontSize = 14.sp)
                }

                if (t.checklist.isNotEmpty()) {
                    Spacer(Modifier.height(18.dp))
                    val done = t.checklist.count { it.d }
                    Text("CHECKLIST ($done/${t.checklist.size})", color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp)
                    Spacer(Modifier.height(8.dp))
                    t.checklist.forEachIndexed { idx, item ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable {
                                scope.launch {
                                    val nl = t.checklist.toMutableList()
                                    nl[idx] = item.copy(d = !item.d)
                                    TaskRepo.setChecklist(t.id, nl)
                                }
                            }.padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                if (item.d) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked,
                                contentDescription = null,
                                tint = if (item.d) Tokens.Green else Tokens.Faint,
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                item.t, color = if (item.d) Tokens.Faint else Tokens.Ink, fontSize = 14.sp,
                                textDecoration = if (item.d) TextDecoration.LineThrough else TextDecoration.None,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(28.dp))
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Excluir tarefa") },
            text = { Text("Excluir esta tarefa para toda a equipe?") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    scope.launch { TaskRepo.delete(id).onSuccess { onBack() } }
                }) { Text("Excluir", color = Tokens.Red) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String, last: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
        Text(label, color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.width(110.dp))
        Text(value, color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
    }
    if (!last) Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFF222633)))
}

@Composable
private fun IconBtn(icon: ImageVector, tint: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) { Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp)) }
}
