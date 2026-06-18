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

                // SLA do designer (Fase E): separa STATUS DE FLUXO de STATUS DE PRAZO/SLA.
                // Só aparece quando há prazo final de designer (designerSla.planDueAt).
                val sla = slaDeadline(t)
                if (sla != null) {
                    SectionLabel("SLA do designer")
                    Card {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Pill(flowLabelOf(t), Tokens.Soft)
                            Spacer(Modifier.width(8.dp))
                            Pill(sla.label, sla.color)
                        }
                        Divider()
                        InfoLine("Início", if (sla.startMs > 0) DateUtil.fmtMs(sla.startMs) else "Não definido")
                        Divider()
                        InfoLine("Prazo final", DateUtil.fmtMs(sla.dueMs))
                        Divider()
                        InfoLine(if (sla.state == "overdue") "Atraso" else "Restante", sla.rem)
                        Divider()
                        Text("PRÓXIMA AÇÃO", color = Tokens.Faint, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp, modifier = Modifier.padding(top = 10.dp, bottom = 2.dp))
                        Text(nextActionOf(t, sla.state), color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    }
                    Spacer(Modifier.height(16.dp))
                }

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

/* ── Fase E — SLA do designer (read-only): STATUS DE PRAZO/SLA por PRAZO FINAL,
 * separado do STATUS DE FLUXO. Espelha a regra do sino (designerSla.planDueAt). ── */
private data class SlaDeadlineInfo(
    val state: String, val label: String, val color: Color, val rem: String, val startMs: Long, val dueMs: Long,
)

private fun slaDeadline(t: TaskItem, now: Long = System.currentTimeMillis()): SlaDeadlineInfo? {
    val ds = t.designerSla ?: return null
    val pd = ds.planDueAt ?: return null
    if (pd <= 0L) return null
    val ps = ds.planStartAt ?: 0L
    val finished = ds.finishedAt ?: t.doneAt
    val delivered = (finished != null && finished > 0L) ||
        t.designerFlowStatus == "entregue" || t.designerFlowStatus == "concluido" || t.status == "concluido"
    val azul = Color(0xFF7FA6FF); val laranja = Color(0xFFF2A93B); val vermelho = Color(0xFFFF6B61); val verde = Color(0xFF37D196)
    return when {
        delivered -> SlaDeadlineInfo("completed", "Concluída", verde, "Entrega concluída", ps, pd)
        now > pd -> SlaDeadlineInfo("overdue", "Prazo encerrado", vermelho, "Atraso de " + fmtDur(now - pd), ps, pd)
        now >= pd - 30L * 60000L -> SlaDeadlineInfo("warning", "Prazo próximo", laranja, "Faltam " + fmtDur(pd - now), ps, pd)
        else -> SlaDeadlineInfo("normal", "Dentro do prazo", azul, "Faltam " + fmtDur(pd - now), ps, pd)
    }
}

private fun fmtDur(ms: Long): String {
    val mm = (if (ms < 0) 0 else ms) / 60000
    if (mm < 60) return "$mm min"
    val h = mm / 60; val r = mm % 60
    if (h < 24) return if (r > 0) "${h}h ${r}min" else "${h}h"
    val d = h / 24
    return "${d}d ${h % 24}h"
}

private fun flowLabelOf(t: TaskItem): String = when {
    t.status == "concluido" || t.designerFlowStatus == "concluido" -> "Concluída"
    t.designerFlowStatus == "entregue" -> "Entregue"
    t.designerFlowStatus == "revisao" -> "Em revisão"
    t.designerFlowStatus == "andamento" -> "Em produção"
    else -> "Aguardando iniciar"
}

private fun nextActionOf(t: TaskItem, slaState: String): String {
    if (slaState == "completed") return "Entrega concluída"
    if (slaState == "overdue") return "Concluir agora ou sinalizar atraso"
    return when (t.designerFlowStatus) {
        "andamento" -> "Concluir demanda"
        "revisao" -> "Revisar entrega"
        "entregue" -> "Aguardar cliente"
        else -> "Iniciar produção"
    }
}
