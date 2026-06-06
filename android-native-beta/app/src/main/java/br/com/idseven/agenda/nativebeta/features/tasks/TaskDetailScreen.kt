package br.com.idseven.agenda.nativebeta.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.data.TaskRepo
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.components.LoadingState
import br.com.idseven.agenda.nativebeta.designsystem.components.Pill
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.CronStatusUi
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.TaskDeadline
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskStatus
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite
import br.com.idseven.agenda.nativebeta.shared.DateUtil
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
        // Cabeçalho
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 14.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
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
            val requester = t.by?.let { b -> users.firstOrNull { it.id == b } }
            val assignee = users.firstOrNull { (it.name ?: "").equals(t.assignee ?: "", ignoreCase = true) }
            val deadline = TaskDeadline.of(t)
            val total = t.checklist.size
            val done = t.checklist.count { it.d }

            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                // Solicitação
                SectionLabel("Solicitação")
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(requester?.photo, UserColor.of(requester?.id, requester?.color), requester?.name ?: "?", 44.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                            Text("Solicitado por", color = Tokens.Faint, fontSize = 11.sp, lineHeight = 13.sp)
                            Text(requester?.name ?: "—", color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, lineHeight = 17.sp)
                            t.createdAt?.let { Text("Lançada em ${DateUtil.fmtMs(it)}", color = Tokens.Soft, fontSize = 11.5.sp, lineHeight = 14.sp) }
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))

                // Cliente e demanda
                SectionLabel("Cliente e demanda")
                if (!t.client.isNullOrBlank()) Text(t.client.uppercase(), color = Tokens.Soft, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp)
                Spacer(Modifier.height(3.dp))
                Text(t.title?.ifBlank { null } ?: t.client ?: "Sem título", color = Tokens.Ink, fontSize = 23.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Pill(sector.label, sector.color)
                    if (t.priority) { Spacer(Modifier.width(8.dp)); Pill("Prioridade alta", Tokens.Red) }
                    if (deadline != null) { Spacer(Modifier.width(8.dp)); Pill(deadline.text, deadline.color) }
                }
                Spacer(Modifier.height(16.dp))

                // Operação (eixo operacional: próxima ação + linha do tempo) — só cronograma.
                if (Sectors.of(t.sector).key == "cronograma") {
                    OperationalPanel(t)
                    Spacer(Modifier.height(16.dp))
                }

                // Responsável e prazo
                SectionLabel("Responsável e prazo")
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(assignee?.photo, UserColor.of(assignee?.id, assignee?.color), t.assignee ?: "—", 44.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Responsável", color = Tokens.Faint, fontSize = 11.sp)
                            Text(t.assignee?.ifBlank { null } ?: "Não atribuído", color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    if (!t.dueDate.isNullOrBlank()) { Divider(); InfoLine("Prazo", t.dueDate + (t.dueTime?.let { if (it.isNotBlank()) " às $it" else "" } ?: "")) }
                    if (!t.link.isNullOrBlank()) { Divider(); InfoLine("Link", t.link) }
                }
                Spacer(Modifier.height(16.dp))

                // Status e prioridade
                SectionLabel("Status")
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    TaskStatus.COLUMNS.forEach { st ->
                        FilterChip(
                            selected = (t.status ?: "afazer") == st,
                            onClick = { scope.launch { TaskRepo.move(t, st, currentUid) } },
                            label = { Text(TaskStatus.label(st)) },
                            modifier = Modifier.padding(end = 8.dp),
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = TaskStatus.color(st).copy(alpha = 0.18f), selectedLabelColor = TaskStatus.color(st)),
                        )
                    }
                }

                Spacer(Modifier.height(18.dp))
                SectionLabel(if (total > 0) "Checklist · $done/$total concluídos" else "Checklist")
                Card {
                    if (total == 0) {
                        Text("Nenhum checklist cadastrado", color = Tokens.Faint, fontSize = 13.sp)
                    } else {
                        LinearProgressIndicator(progress = { done.toFloat() / total.toFloat() }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = Tokens.Green, trackColor = Tokens.Surface2)
                        Spacer(Modifier.height(10.dp))
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
                                Icon(if (item.d) Icons.Outlined.CheckCircle else Icons.Outlined.RadioButtonUnchecked, contentDescription = null, tint = if (item.d) Tokens.Green else Tokens.Faint, modifier = Modifier.size(20.dp))
                                Spacer(Modifier.width(10.dp))
                                Text(item.t, color = if (item.d) Tokens.Faint else Tokens.Ink, fontSize = 14.sp, textDecoration = if (item.d) TextDecoration.LineThrough else TextDecoration.None)
                            }
                        }
                    }
                }

                if (!t.desc.isNullOrBlank()) {
                    Spacer(Modifier.height(16.dp))
                    SectionLabel("Descrição")
                    Card { Text(t.desc, color = Tokens.Ink, fontSize = 14.sp) }
                }

                // Fluxo Cronograma -> Cliente (somente leitura; compat com Desktop 1.0.78)
                if (!t.cronStatus.isNullOrBlank() || t.clientReview != null) {
                    Spacer(Modifier.height(16.dp))
                    SectionLabel("Cronograma · cliente")
                    Card {
                        t.cronStatus?.takeIf { it.isNotBlank() }?.let { cs ->
                            val c = CronStatusUi.color(cs)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(8.dp).clip(RoundedCornerShape(999.dp)).background(c))
                                Spacer(Modifier.width(10.dp))
                                Text(CronStatusUi.label(cs), color = c, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            }
                            t.clientSentBy?.let { sb ->
                                val who = users.firstOrNull { it.id == sb }?.name
                                if (!who.isNullOrBlank()) {
                                    Spacer(Modifier.height(4.dp))
                                    Text("Enviado por $who", color = Tokens.Soft, fontSize = 12.sp)
                                }
                            }
                        }
                        t.clientReview?.let { cr ->
                            val rc = CronStatusUi.reviewColor(cr.status)
                            Spacer(Modifier.height(12.dp))
                            Column(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
                                    .background(rc.copy(alpha = 0.10f))
                                    .border(1.dp, rc.copy(alpha = 0.40f), RoundedCornerShape(12.dp))
                                    .padding(13.dp)
                            ) {
                                Text(CronStatusUi.reviewLabel(cr.status), color = rc, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                                if (!cr.note.isNullOrBlank()) {
                                    Spacer(Modifier.height(4.dp))
                                    Text("\"${cr.note}\"", color = Tokens.Ink, fontSize = 13.sp)
                                }
                                cr.at?.let {
                                    Spacer(Modifier.height(5.dp))
                                    Text(DateUtil.fmtMs(it) + (cr.byName?.let { n -> " · $n" } ?: ""), color = Tokens.Faint, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }

                if (t.history.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    SectionLabel("Histórico")
                    Card {
                        t.history.takeLast(12).reversed().forEachIndexed { i, h ->
                            if (i > 0) Spacer(Modifier.height(10.dp))
                            val who = h.byId?.let { b -> users.firstOrNull { it.id == b }?.name } ?: "Alguém"
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(Modifier.size(7.dp).clip(RoundedCornerShape(999.dp)).background(TaskStatus.color(h.to)))
                                Spacer(Modifier.width(10.dp))
                                Column {
                                    Text("$who moveu para ${TaskStatus.label(h.to)}", color = Tokens.Ink, fontSize = 13.sp)
                                    Text(DateUtil.fmtMs(h.at), color = Tokens.Faint, fontSize = 11.sp)
                                }
                            }
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
            confirmButton = { TextButton(onClick = { confirmDelete = false; scope.launch { TaskRepo.delete(id).onSuccess { onBack() } } }) { Text("Excluir", color = Tokens.Red) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancelar") } },
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text.uppercase(), color = Tokens.Faint, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp, modifier = Modifier.padding(bottom = 8.dp))
}

// O fluxo de status (cronStatus + clientReview) agora vive em domain/CronStatusUi.kt
// (fonte única compartilhada com o card de tarefa). Mantido o mesmo comportamento.

@Composable
private fun Card(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)).padding(16.dp), content = content)
}

@Composable
private fun Divider() {
    Box(Modifier.fillMaxWidth().padding(vertical = 10.dp).height(1.dp).background(Color(0xFF222633)))
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth()) {
        Text(label, color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.width(96.dp))
        Text(value, color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun IconBtn(icon: ImageVector, tint: Color, onClick: () -> Unit) {
    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onClick() }, contentAlignment = Alignment.Center) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
    }
}

private data class Step(val l: String, val done: Boolean, val cur: Boolean = false, val opt: Boolean = false)

// Painel operacional: status REAL + "Próxima ação" + "Linha do tempo operacional" (10 etapas).
@Composable
private fun OperationalPanel(t: TaskItem) {
    val opKey = TaskVisibility.operationalCol(t)
    val opLabel = TaskVisibility.OPERATIONAL_COLS.firstOrNull { it.key == opKey }?.label ?: "Em produção"
    val accent = when (opKey) {
        "producao" -> Color(0xFF22D3EE); "aguardando_designer" -> Color(0xFFA78BFA); "aguardando_legenda" -> Color(0xFF5B6CFF)
        "aguardando_revisao" -> Color(0xFFF59E0B); "aguardando_final" -> Color(0xFF34D399); "concluido" -> Color(0xFF10B981)
        else -> Color(0xFF6E7480)
    }
    val cf = TaskVisibility.clientCol(t)
    val hasD = TaskVisibility.hasDesigner(t)
    val delivered = hasD && TaskVisibility.designerCol(t) == "concluido"
    val themesOk = cf in listOf("aprovado", "producao", "revisao", "reenviado", "concluido") || t.clientReview?.status == "aprovado"
    val finalOk = t.finalApprovalCompleted || cf == "concluido"
    val resent = cf == "reenviado" || cf == "concluido"
    val steps = listOf(
        Step("Cliente aprovou os temas", themesOk),
        Step("Enviado ao designer", hasD),
        Step("Designer em produção", delivered, cur = hasD && !delivered),
        Step("Designer entregou", delivered),
        Step("Legenda final pronta", !TaskVisibility.pendingLegend(t)),
        Step("Feed (1080×1440) anexado", !TaskVisibility.pendingFeed(t)),
        Step("Story (1080×1920) anexado", false, opt = true),
        Step("Reenviado ao cliente", resent),
        Step("Aprovação final do cliente", finalOk),
        Step("Conclusão operacional", opKey == "concluido"),
    )
    SectionLabel("Operação")
    // Fase do cliente (themes/production/final) — fica claro o que o cliente está aprovando agora.
    val phase = TaskVisibility.clientApprovalPhase(t)
    val phaseColor = when (phase) {
        "final" -> Color(0xFF34D399); "production" -> Color(0xFFF59E0B); else -> Color(0xFF5B6CFF)
    }
    Row(
        Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(11.dp))
            .background(phaseColor.copy(alpha = 0.10f)).border(1.dp, phaseColor.copy(alpha = 0.35f), RoundedCornerShape(11.dp))
            .padding(horizontal = 13.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(9.dp).clip(androidx.compose.foundation.shape.CircleShape).background(phaseColor))
        Spacer(Modifier.width(9.dp))
        Text("Fase do cliente · ${TaskVisibility.clientApprovalPhaseLabel(phase)}", color = phaseColor, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
    }
    // Próxima ação
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp)).background(Tokens.Surface)
            .border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(13.dp)).padding(13.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(accent.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(11.dp))
        Column(Modifier.weight(1f)) {
            Text("PRÓXIMA AÇÃO · $opLabel", color = accent, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(3.dp))
            Text(TaskVisibility.nextActionText(t), color = Tokens.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.Medium, lineHeight = 18.sp)
        }
    }
    Spacer(Modifier.height(10.dp))
    // Linha do tempo
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(13.dp)).padding(horizontal = 12.dp, vertical = 6.dp)) {
        steps.forEachIndexed { i, s ->
            val c = if (s.done) Tokens.Green else if (s.cur) Tokens.Accent else Tokens.Faint
            Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(22.dp).clip(RoundedCornerShape(50)).background(if (s.done) Tokens.Green.copy(alpha = 0.18f) else if (s.cur) Tokens.Accent.copy(alpha = 0.18f) else Tokens.Surface2), contentAlignment = Alignment.Center) {
                    if (s.done) Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = Tokens.Green, modifier = Modifier.size(14.dp))
                    else Text("${i + 1}", color = c, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(10.dp))
                Text(s.l + (if (s.opt) " (quando aplicável)" else ""), color = if (s.done || s.cur) Tokens.Ink else Tokens.Soft, fontSize = 13.sp, fontWeight = if (s.cur) FontWeight.Bold else FontWeight.Normal, modifier = Modifier.weight(1f))
                Text(if (s.done) "OK" else if (s.cur) "Em andamento" else "Pendente", color = c, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
