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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
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
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
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

    var sector by remember { mutableStateOf("edicao_midia") }
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
    // Campos específicos do setor (serializados em `desc` no salvamento; sem schema novo).
    val extra = remember { mutableStateMapOf<String, String>() }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // Preenche o checklist padrão do setor (apenas na CRIAÇÃO ao trocar de setor).
    fun applySectorChecklist(key: String) {
        val tpl = TaskTemplates.forSector(key) ?: return
        checklist.clear()
        checklist.addAll(tpl.checklist.map { ChecklistItem(it, false) })
    }

    LaunchedEffect(editId) {
        if (editId != null) {
            val t = TaskRepo.task(editId).first()
            if (t != null) {
                sector = Sectors.of(t.sector).key; client = t.client ?: ""; title = t.title ?: ""
                assignee = t.assignee ?: ""; assigneeId = t.assigneeId; link = t.link ?: ""; desc = t.desc ?: ""
                dueDate = t.dueDate ?: ""; dueTime = t.dueTime ?: ""; priority = t.priority
                status = t.status ?: "afazer"
                checklist.clear(); checklist.addAll(t.checklist)
            }
        } else {
            // Criação: já entra com o checklist do setor inicial.
            applySectorChecklist(sector)
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

    // Serializa os campos específicos do setor + descrição livre num único bloco (campo desc).
    fun composedDesc(): String {
        val tpl = TaskTemplates.forSector(sector)
        val briefing = tpl?.fields.orEmpty().mapNotNull { f ->
            extra[f.key]?.trim()?.takeIf { it.isNotEmpty() }?.let { "${f.label}: $it" }
        }.joinToString("\n")
        return listOf(briefing.trim(), desc.trim()).filter { it.isNotEmpty() }.joinToString("\n\n")
    }

    fun save() {
        error = null
        if (client.trim().isEmpty() && title.trim().isEmpty()) { error = "Informe ao menos cliente ou título"; return }
        val input = TaskContract.Input(
            client = client.trim(), title = title.trim(), sector = sector, desc = composedDesc(),
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
    val tpl = TaskTemplates.forSector(sector)
    val sec = Sectors.of(sector)

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 14.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (editId != null) "Editar tarefa" else "Nova tarefa", color = Tokens.Ink, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                Text(
                    if (client.isNotBlank()) "${sec.label} · ${client.trim()}" else "Quadro de ${sec.label}",
                    color = Tokens.Faint, fontSize = 12.5.sp, fontWeight = FontWeight.Medium,
                )
            }
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Close, contentDescription = "Fechar", tint = Tokens.Soft, modifier = Modifier.size(20.dp))
            }
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 8.dp)) {
            error?.let { MessageBanner(it, isError = true); Spacer(Modifier.height(14.dp)) }

            // ---- Setor (cards profissionais com ícone + descrição) ----
            Label("Setor")
            Sectors.ALL.forEach { s ->
                SectorCard(s.label, s.desc, s.icon, s.color, selected = sector == s.key) {
                    if (sector != s.key) {
                        sector = s.key
                        extra.clear()
                        if (editId == null) applySectorChecklist(s.key)
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
            Spacer(Modifier.height(8.dp))

            // ---- Título específico do setor + cliente ----
            Label(tpl?.titleLabel ?: "Título")
            AppTextField(title, { title = it }, tpl?.titlePlaceholder ?: "Título da tarefa"); Spacer(Modifier.height(14.dp))
            Label("Cliente / Empresa"); AppTextField(client, { client = it }, "Ex.: Hospital Visão"); Spacer(Modifier.height(14.dp))

            // ---- Responsável (seletor aprovado, avatar + nome) ----
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

            // ---- Etapa (status do fluxo) ----
            Label("Etapa")
            StatusSelector(status) { status = it }
            Spacer(Modifier.height(14.dp))

            // ---- Prazo / horário ----
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
            Spacer(Modifier.height(16.dp))

            // ---- Campos ESPECÍFICOS do setor (dinâmicos) ----
            tpl?.fields?.let { fields ->
                if (fields.isNotEmpty()) {
                    Label("Detalhes de ${sec.label}")
                    fields.forEach { f ->
                        TemplateField(f, extra[f.key] ?: "") { extra[f.key] = it }
                        Spacer(Modifier.height(12.dp))
                    }
                    Spacer(Modifier.height(2.dp))
                }
            }

            Label("Link / anexo"); AppTextField(link, { link = it }, "URL (Drive, Figma, etc.)"); Spacer(Modifier.height(14.dp))
            Label("Observações livres"); AppTextField(desc, { desc = it }, "Notas adicionais…"); Spacer(Modifier.height(16.dp))

            // ---- Checklist (pré-preenchido pelo setor) ----
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

// Card de SETOR — ícone colorido + nome + descrição + estado selecionado (borda accent + check).
@Composable
private fun SectorCard(label: String, desc: String, icon: ImageVector, color: Color, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp))
            .background(if (selected) color.copy(alpha = 0.12f) else Tokens.Surface)
            .border(if (selected) 1.5.dp else 1.dp, if (selected) color else Tokens.Line, RoundedCornerShape(14.dp))
            .clickable { onClick() }.padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(11.dp)).background(color.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            Text(desc, color = Tokens.Faint, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        }
        if (selected) {
            Box(Modifier.size(24.dp).clip(CircleShape).background(color), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
            }
        }
    }
}

// Seletor de ETAPA (status do fluxo) — segmented chips: A fazer / Em andamento / Revisão / Concluído.
@Composable
private fun StatusSelector(current: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
        TaskStatus.COLUMNS.forEach { st ->
            val sel = current == st
            val col = TaskStatus.color(st)
            Row(
                modifier = Modifier.padding(end = 8.dp).clip(RoundedCornerShape(999.dp))
                    .background(if (sel) col.copy(alpha = 0.18f) else Tokens.Surface)
                    .border(1.dp, if (sel) col else Tokens.Line, RoundedCornerShape(999.dp))
                    .clickable { onSelect(st) }.padding(horizontal = 14.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(col))
                Spacer(Modifier.width(7.dp))
                Text(TaskStatus.label(st), color = if (sel) col else Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// Campo dinâmico de template: TEXT (input), CHOICE (chips) ou BOOL (switch Sim/Não).
@Composable
private fun TemplateField(f: TplField, value: String, onChange: (String) -> Unit) {
    Label(f.label)
    when (f.kind) {
        FieldKind.TEXT -> AppTextField(value, onChange, f.placeholder)
        FieldKind.BOOL -> {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (value == "Sim") "Sim" else "Não", color = Tokens.Ink, fontSize = 14.sp, modifier = Modifier.weight(1f))
                Switch(checked = value == "Sim", onCheckedChange = { onChange(if (it) "Sim" else "Não") })
            }
        }
        FieldKind.CHOICE -> {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
                f.options.forEach { opt ->
                    val sel = value == opt
                    Box(
                        modifier = Modifier.padding(end = 8.dp).clip(RoundedCornerShape(999.dp))
                            .background(if (sel) Tokens.Accent.copy(alpha = 0.18f) else Tokens.Surface)
                            .border(1.dp, if (sel) Tokens.Accent else Tokens.Line, RoundedCornerShape(999.dp))
                            .clickable { onChange(if (sel) "" else opt) }.padding(horizontal = 13.dp, vertical = 8.dp),
                    ) {
                        Text(opt, color = if (sel) Tokens.Accent else Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
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
