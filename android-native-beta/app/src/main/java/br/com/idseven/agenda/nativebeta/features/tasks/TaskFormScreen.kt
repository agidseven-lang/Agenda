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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.ui.text.style.TextOverflow
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

private val STEPS = listOf("Setor", "Dados", "Briefing", "Revisão")

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

    var step by remember { mutableStateOf(0) }
    var sector by remember { mutableStateOf("edicao_midia") }
    var subtype by remember { mutableStateOf("") }
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
    val extra = remember { mutableStateMapOf<String, String>() }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun setChecklist(items: List<String>) {
        checklist.clear(); checklist.addAll(items.map { ChecklistItem(it, false) })
    }

    // Aplica os defaults do setor: subtipo inicial + checklist correspondente (criação).
    fun applySectorDefaults(key: String) {
        val tpl = TaskTemplates.forSector(key)
        subtype = tpl?.subtypes?.firstOrNull()?.key ?: ""
        extra.clear()
        if (editId == null) setChecklist(tpl?.subtypeOf(subtype)?.checklist ?: tpl?.checklist.orEmpty())
    }
    // Troca o SUBFORMULÁRIO conforme a escolha (Semanal/Quinzenal/Mensal ou 4/6/12).
    fun applySubtype(key: String) {
        subtype = key; extra.clear()
        if (editId == null) setChecklist(TaskTemplates.forSector(sector)?.subtypeOf(key)?.checklist.orEmpty())
    }

    LaunchedEffect(editId) {
        if (editId != null) {
            val t = TaskRepo.task(editId).first()
            if (t != null) {
                sector = Sectors.of(t.sector).key; client = t.client ?: ""; title = t.title ?: ""
                assignee = t.assignee ?: ""; assigneeId = t.assigneeId; link = t.link ?: ""; desc = t.desc ?: ""
                dueDate = t.dueDate ?: ""; dueTime = t.dueTime ?: ""; priority = t.priority
                status = t.status ?: "afazer"
                subtype = TaskTemplates.forSector(sector)?.subtypes?.firstOrNull()?.key ?: ""
                checklist.clear(); checklist.addAll(t.checklist)
            }
        } else {
            applySectorDefaults(sector)
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

    // Serializa subtipo + campos + itens específicos no campo desc (sem schema novo).
    fun composedDesc(): String {
        val tpl = TaskTemplates.forSector(sector) ?: return desc.trim()
        val lines = mutableListOf<String>()
        val sub = tpl.subtypeOf(subtype)
        if (sub != null) {
            lines.add("Tipo: ${sub.formTitle}")
            sub.fields.forEach { f -> extra[f.key]?.trim()?.takeIf { it.isNotEmpty() }?.let { lines.add("${f.label}: $it") } }
            sub.itemLabels.forEach { lbl -> extra[lbl]?.trim()?.takeIf { it.isNotEmpty() }?.let { lines.add("$lbl: $it") } }
        } else {
            tpl.fields.forEach { f -> extra[f.key]?.trim()?.takeIf { it.isNotEmpty() }?.let { lines.add("${f.label}: $it") } }
        }
        return listOf(lines.joinToString("\n").trim(), desc.trim()).filter { it.isNotEmpty() }.joinToString("\n\n")
    }

    fun save() {
        error = null
        if (client.trim().isEmpty() && title.trim().isEmpty()) { error = "Informe ao menos cliente ou título"; step = 1; return }
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
    val sub = tpl?.subtypeOf(subtype)
    val sec = Sectors.of(sector)

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(modifier = Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 14.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (editId != null) "Editar tarefa" else "Nova tarefa", color = Tokens.Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(
                    if (client.isNotBlank()) "${sec.label} · ${client.trim()}" else "Quadro de ${sec.label}",
                    color = Tokens.Faint, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Close, contentDescription = "Fechar", tint = Tokens.Soft, modifier = Modifier.size(19.dp))
            }
        }

        Stepper(step)

        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 10.dp)) {
            error?.let { MessageBanner(it, isError = true); Spacer(Modifier.height(14.dp)) }

            when (step) {
                0 -> {
                    Label("Escolha o setor")
                    Sectors.ALL.forEach { s ->
                        SectorCardCompact(s.label, s.desc, s.icon, s.color, selected = sector == s.key) {
                            if (sector != s.key) { sector = s.key; applySectorDefaults(s.key) }
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                }
                1 -> {
                    Label(tpl?.titleLabel ?: "Título")
                    AppTextField(title, { title = it }, tpl?.titlePlaceholder ?: "Título da tarefa"); Spacer(Modifier.height(14.dp))
                    Label("Cliente / Empresa"); AppTextField(client, { client = it }, "Ex.: Hospital Visão"); Spacer(Modifier.height(14.dp))

                    Label("Responsável")
                    val selectedUser = activeUsers.firstOrNull { it.id == assigneeId }
                    Box {
                        AssigneePickerField(
                            selected = assigneeId != null, photo = selectedUser?.photo,
                            ringColor = UserColor.of(assigneeId, selectedUser?.color), name = assignee,
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
                    Label("Etapa"); StatusSelector(status) { status = it }; Spacer(Modifier.height(14.dp))
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
                }
                2 -> {
                    if (tpl?.subtypes?.isNotEmpty() == true) {
                        // Seletor de subtipo -> TROCA o subformulário exibido.
                        Label(tpl.subtypeLabel ?: "Tipo")
                        ChipRow(tpl.subtypes.map { it.key to it.label }, subtype) { applySubtype(it) }
                        Spacer(Modifier.height(14.dp))
                        sub?.let { s ->
                            // Título claro do subformulário (ex.: "Cronograma semanal").
                            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Tokens.Accent.copy(alpha = 0.12f)).padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Text(s.formTitle, color = Tokens.Accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                            Spacer(Modifier.height(12.dp))
                            s.fields.forEach { f -> TemplateField(f, extra[f.key] ?: "") { extra[f.key] = it }; Spacer(Modifier.height(12.dp)) }
                            if (s.itemLabels.isNotEmpty()) {
                                Label("Itens do pacote")
                                s.itemLabels.forEach { lbl ->
                                    CompactItem(lbl, extra[lbl] ?: "") { extra[lbl] = it }
                                    Spacer(Modifier.height(8.dp))
                                }
                                Spacer(Modifier.height(4.dp))
                            }
                        }
                    } else {
                        Label("Briefing · ${sec.label}")
                        tpl?.fields?.forEach { f -> TemplateField(f, extra[f.key] ?: "") { extra[f.key] = it }; Spacer(Modifier.height(12.dp)) }
                    }
                    Label("Link / anexo"); AppTextField(link, { link = it }, "URL (Drive, Figma, etc.)"); Spacer(Modifier.height(12.dp))
                    Label("Observações livres"); AppTextField(desc, { desc = it }, "Notas adicionais…"); Spacer(Modifier.height(14.dp))
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
                }
                else -> {
                    Label("Revisão")
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)).padding(16.dp)) {
                        ReviewRow("Setor", sec.label)
                        if (sub != null) ReviewRow("Subtipo", sub.formTitle)
                        ReviewRow("Cliente", client.ifBlank { "—" })
                        ReviewRow("Título", title.ifBlank { "—" })
                        ReviewRow("Responsável", assignee.ifBlank { "Ninguém" })
                        ReviewRow("Etapa", TaskStatus.label(status))
                        ReviewRow("Prazo", listOf(dueDate, dueTime).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "—" })
                        ReviewRow("Prioridade", if (priority) "Alta" else "Normal")
                        val brief = composedDesc()
                        if (brief.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text("BRIEFING", color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(4.dp))
                            Text(brief, color = Tokens.Soft, fontSize = 13.sp, maxLines = 8, overflow = TextOverflow.Ellipsis, lineHeight = 18.sp)
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        // Rodapé fixo (fora do scroll, safe area) — nunca cobre o conteúdo.
        Row(
            modifier = Modifier.fillMaxWidth().background(Tokens.Surface).border(1.dp, Tokens.Line)
                .navigationBarsPadding().imePadding().padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (step > 0) {
                Box(Modifier.weight(1f).height(50.dp).clip(RoundedCornerShape(25.dp)).border(1.dp, Tokens.Line, RoundedCornerShape(25.dp)).clickable { step-- }, contentAlignment = Alignment.Center) {
                    Text("Voltar", color = Tokens.Soft, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(12.dp))
            }
            if (step < STEPS.size - 1) {
                Box(Modifier.weight(1f).height(50.dp).clip(RoundedCornerShape(25.dp)).background(Tokens.Accent).clickable { step++ }, contentAlignment = Alignment.Center) {
                    Text("Próximo", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                Box(Modifier.weight(1f)) { PrimaryButton(if (editId != null) "Salvar alterações" else "Salvar tarefa", loading = busy) { save() } }
            }
        }
    }
}

@Composable
private fun Stepper(current: Int) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        STEPS.forEachIndexed { i, label ->
            val done = i < current
            val active = i == current
            val col = if (active || done) Tokens.Accent else Tokens.Line
            Box(Modifier.size(22.dp).clip(CircleShape).background(if (active || done) Tokens.Accent.copy(alpha = if (active) 1f else 0.5f) else Tokens.Surface).border(1.dp, col, CircleShape), contentAlignment = Alignment.Center) {
                if (done) Icon(Icons.Outlined.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(13.dp))
                else Text("${i + 1}", color = if (active) Color.White else Tokens.Faint, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(6.dp))
            Text(label, color = if (active) Tokens.Ink else Tokens.Faint, fontSize = 11.5.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Medium)
            if (i < STEPS.size - 1) {
                Spacer(Modifier.width(6.dp))
                Box(Modifier.weight(1f).height(1.5.dp).background(if (done) Tokens.Accent else Tokens.Line))
                Spacer(Modifier.width(6.dp))
            }
        }
    }
}

@Composable
private fun SectorCardCompact(label: String, desc: String, icon: ImageVector, color: Color, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp))
            .background(if (selected) color.copy(alpha = 0.12f) else Tokens.Surface)
            .border(if (selected) 1.5.dp else 1.dp, if (selected) color else Tokens.Line, RoundedCornerShape(13.dp))
            .clickable { onClick() }.padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(color.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(19.dp))
        }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(desc, color = Tokens.Faint, fontSize = 11.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (selected) {
            Spacer(Modifier.width(8.dp))
            Box(Modifier.size(22.dp).clip(CircleShape).background(color), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
            }
        }
    }
}

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
                    .clickable { onSelect(st) }.padding(horizontal = 13.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(col))
                Spacer(Modifier.width(7.dp))
                Text(TaskStatus.label(st), color = if (sel) col else Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// Chips genéricos (key -> label) com seleção; usado pelo seletor de SUBTIPO.
@Composable
private fun ChipRow(options: List<Pair<String, String>>, current: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
        options.forEach { (key, label) ->
            val sel = current == key
            Box(
                modifier = Modifier.padding(end = 8.dp).clip(RoundedCornerShape(999.dp))
                    .background(if (sel) Tokens.Accent.copy(alpha = 0.18f) else Tokens.Surface)
                    .border(1.dp, if (sel) Tokens.Accent else Tokens.Line, RoundedCornerShape(999.dp))
                    .clickable { onSelect(key) }.padding(horizontal = 14.dp, vertical = 9.dp),
            ) { Text(label, color = if (sel) Tokens.Accent else Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

@Composable
private fun TemplateField(f: TplField, value: String, onChange: (String) -> Unit) {
    Label(f.label)
    when (f.kind) {
        FieldKind.TEXT -> AppTextField(value, onChange, f.placeholder)
        FieldKind.BOOL -> Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (value == "Sim") "Sim" else "Não", color = Tokens.Ink, fontSize = 14.sp, modifier = Modifier.weight(1f))
            Switch(checked = value == "Sim", onCheckedChange = { onChange(if (it) "Sim" else "Não") })
        }
        FieldKind.CHOICE -> Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
            f.options.forEach { opt ->
                val sel = value == opt
                Box(
                    modifier = Modifier.padding(end = 8.dp).clip(RoundedCornerShape(999.dp))
                        .background(if (sel) Tokens.Accent.copy(alpha = 0.18f) else Tokens.Surface)
                        .border(1.dp, if (sel) Tokens.Accent else Tokens.Line, RoundedCornerShape(999.dp))
                        .clickable { onChange(if (sel) "" else opt) }.padding(horizontal = 13.dp, vertical = 8.dp),
                ) { Text(opt, color = if (sel) Tokens.Accent else Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }
}

// Item compacto da lista do pacote (ex.: "Vídeo/Roteiro 1") — 1 linha, sem bloco gigante.
@Composable
private fun CompactItem(label: String, value: String, onChange: (String) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Tokens.Faint, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(118.dp))
        Spacer(Modifier.width(8.dp))
        Box(Modifier.weight(1f)) { AppTextField(value, onChange, "Tema / título") }
    }
}

@Composable
private fun ReviewRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Text(label, color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.width(110.dp))
        Text(value, color = Tokens.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
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
