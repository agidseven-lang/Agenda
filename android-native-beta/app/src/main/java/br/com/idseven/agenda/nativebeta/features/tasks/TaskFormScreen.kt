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
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.PushNotify
import br.com.idseven.agenda.nativebeta.data.TaskContract
import br.com.idseven.agenda.nativebeta.data.TaskRepo
import br.com.idseven.agenda.nativebeta.designsystem.components.AppTextField
import br.com.idseven.agenda.nativebeta.designsystem.components.AssigneeItemRow
import br.com.idseven.agenda.nativebeta.designsystem.components.AssigneePickerField
import br.com.idseven.agenda.nativebeta.designsystem.components.MessageBanner
import br.com.idseven.agenda.nativebeta.designsystem.components.PrimaryButton
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.ChecklistItem
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.Calendar

@Composable
fun TaskFormScreen(
    editId: String?,
    users: List<UserLite>,
    currentUid: String?,
    onDone: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var sector by remember { mutableStateOf("design") }
    var client by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var assignee by remember { mutableStateOf("") }
    var assigneeId by remember { mutableStateOf<String?>(null) }
    var assigneeMenu by remember { mutableStateOf(false) }
    var link by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf("") }
    var dueTime by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("afazer") }
    val checklist = remember { mutableStateListOf<ChecklistItem>() }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(editId) {
        if (editId != null) {
            val t = TaskRepo.task(editId).first()
            if (t != null) {
                sector = t.sector ?: "design"; client = t.client ?: ""; title = t.title ?: ""
                assignee = t.assignee ?: ""; assigneeId = t.assigneeId; link = t.link ?: ""; desc = t.desc ?: ""
                dueDate = t.dueDate ?: ""; dueTime = t.dueTime ?: ""; priority = t.priority
                status = t.status ?: "afazer"
                checklist.clear(); checklist.addAll(t.checklist)
            }
        }
    }

    fun showDate() {
        val c = Calendar.getInstance()
        Regex("^(\\d{4})-(\\d{2})-(\\d{2})$").find(dueDate)?.let { c.set(it.groupValues[1].toInt(), it.groupValues[2].toInt() - 1, it.groupValues[3].toInt()) }
        android.app.DatePickerDialog(context, { _, y, m, d -> dueDate = "%04d-%02d-%02d".format(y, m + 1, d) }, c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH)).show()
    }
    fun showTime() {
        var hh = 18; var mm = 0
        Regex("^(\\d{1,2}):(\\d{2})$").find(dueTime)?.let { hh = it.groupValues[1].toInt(); mm = it.groupValues[2].toInt() }
        android.app.TimePickerDialog(context, { _, h, m -> dueTime = "%02d:%02d".format(h, m) }, hh, mm, true).show()
    }

    fun save() {
        error = null
        if (client.trim().isEmpty() && title.trim().isEmpty()) { error = "Informe ao menos cliente ou título"; return }
        val input = TaskContract.Input(
            client = client.trim(), title = title.trim(), sector = sector, desc = desc.trim(),
            assignee = assignee.trim(), assigneeId = assigneeId, link = link.trim(), dueDate = dueDate, dueTime = dueTime,
            priority = priority, status = status,
            checklist = checklist.map { ChecklistItem(it.t.trim(), it.d) }.filter { it.t.isNotEmpty() },
        )
        busy = true
        scope.launch {
            val res: Result<Any?> = if (editId != null) TaskRepo.update(editId, TaskContract.base(input))
            else TaskRepo.create(TaskContract.create(input, currentUid, System.currentTimeMillis()))
            if (res.isSuccess) {
                val savedId = (res.getOrNull() as? String) ?: editId
                if (!assigneeId.isNullOrBlank()) PushNotify.notifyAssignee(context, "task", savedId)
                onDone()
            } else {
                error = res.exceptionOrNull()?.message ?: "Erro ao salvar"; busy = false
            }
        }
    }

    val activeUsers = users.filter { it.isActive() }.sortedBy { (it.name ?: "").lowercase() }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 14.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (editId != null) "Editar tarefa" else "Nova tarefa", color = Tokens.Ink, fontSize = 21.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Close, contentDescription = "Fechar", tint = Tokens.Soft, modifier = Modifier.size(20.dp))
            }
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp)) {
            error?.let { MessageBanner(it, isError = true); Spacer(Modifier.height(14.dp)) }

            Label("Setor")
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                Sectors.ALL.forEach { s ->
                    FilterChip(
                        selected = sector == s.key, onClick = { sector = s.key }, label = { Text(s.label) },
                        modifier = Modifier.padding(end = 8.dp),
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = s.color.copy(alpha = 0.18f), selectedLabelColor = s.color),
                    )
                }
            }
            Spacer(Modifier.height(16.dp))

            Label("Cliente / Empresa"); AppTextField(client, { client = it }, "Ex.: Hospital Visão"); Spacer(Modifier.height(14.dp))
            Label("Título"); AppTextField(title, { title = it }, "Ex.: Arte para feed"); Spacer(Modifier.height(14.dp))

            Label("Responsável")
            val selectedUser = activeUsers.firstOrNull { it.id == assigneeId }
            Box {
                AssigneePickerField(
                    selected = assigneeId != null,
                    photo = selectedUser?.photo,
                    ringColor = UserColor.of(assigneeId, selectedUser?.color),
                    name = assignee,
                ) { assigneeMenu = true }
                DropdownMenu(expanded = assigneeMenu, onDismissRequest = { assigneeMenu = false }) {
                    DropdownMenuItem(
                        text = { AssigneeItemRow(photo = null, ringColor = Tokens.Line, name = "Ninguém", neutral = true, selected = assigneeId == null) },
                        onClick = { assignee = ""; assigneeId = null; assigneeMenu = false },
                    )
                    activeUsers.forEach { u ->
                        DropdownMenuItem(
                            text = { AssigneeItemRow(photo = u.photo, ringColor = UserColor.of(u.id, u.color), name = u.name ?: "—", neutral = false, selected = u.id == assigneeId) },
                            onClick = { assignee = u.name ?: ""; assigneeId = u.id; assigneeMenu = false },
                        )
                    }
                }
            }
            Spacer(Modifier.height(14.dp))

            Row {
                Column(Modifier.weight(1f)) { Label("Prazo"); PickerField(dueDate.ifBlank { "Escolher" }) { showDate() } }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) { Label("Horário"); PickerField(dueTime.ifBlank { "--:--" }) { showTime() } }
            }
            Spacer(Modifier.height(14.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Prioridade alta", color = Tokens.Ink, fontSize = 14.sp, modifier = Modifier.weight(1f))
                Switch(checked = priority, onCheckedChange = { priority = it })
            }
            Spacer(Modifier.height(14.dp))

            Label("Link / anexo"); AppTextField(link, { link = it }, "URL (Drive, Figma, etc.)"); Spacer(Modifier.height(14.dp))
            Label("Descrição"); AppTextField(desc, { desc = it }, "Detalhes da tarefa…"); Spacer(Modifier.height(16.dp))

            Label("Checklist")
            checklist.forEachIndexed { idx, item ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
                    Box(Modifier.weight(1f)) { AppTextField(item.t, { checklist[idx] = item.copy(t = it) }, "Item ${idx + 1}") }
                    Spacer(Modifier.width(8.dp))
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(10.dp)).clickable { checklist.removeAt(idx) }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Close, contentDescription = "Remover", tint = Tokens.Red, modifier = Modifier.size(18.dp))
                    }
                }
            }
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { checklist.add(ChecklistItem("", false)) }.padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                Text("+ Adicionar item", color = Tokens.Accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(24.dp))

            PrimaryButton(if (editId != null) "Salvar alterações" else "Criar tarefa", loading = busy) { save() }
            Spacer(Modifier.height(28.dp))
        }
    }
}

@Composable
private fun Label(text: String) {
    Text(text.uppercase(), color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 6.dp))
}

@Composable
private fun PickerField(value: String, onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onClick() }.padding(horizontal = 14.dp, vertical = 15.dp)) {
        Text(value, color = Tokens.Ink, fontSize = 14.5.sp)
    }
}
