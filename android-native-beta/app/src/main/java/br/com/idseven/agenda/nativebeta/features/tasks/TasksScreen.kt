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
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.Visibility
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
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
import br.com.idseven.agenda.nativebeta.designsystem.components.SearchField
import br.com.idseven.agenda.nativebeta.designsystem.components.SkeletonList
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.FlowEngine
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.SlaContract
import br.com.idseven.agenda.nativebeta.domain.TaskDeadline
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.TaskPhase
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
    currentUser: UserLite? = null,     // Fase B: visibilidade por função (client-side)
    lockedSector: String? = null,      // quando setado: quadro de UM setor (Fase A)
    onNew: () -> Unit = {},
    onBack: (() -> Unit)? = null,
) {
    tasksState.errorMessage()?.let { ErrorState("Tarefas — $it"); return }
    if (tasksState.isLoading) { SkeletonList(); return }
    val all = tasksState.itemsOrEmpty()
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf("") }
    var sectorFilter by remember { mutableStateOf<String?>(null) }
    var moveTarget by remember { mutableStateOf<TaskItem?>(null) }
    // "Minhas tarefas" = sou o responsavel (assigneeId) OU o solicitante (by).
    // So habilita o chip quando ha um currentUid; sem schema novo, sem repo novo.
    var mineOnly by remember { mutableStateOf(false) }

    val q = query.trim().lowercase()
    val tasks = all.filter { t ->
        val okQ = q.isEmpty() || listOf(t.title, t.client, t.assignee).any { (it ?: "").lowercase().contains(q) }
        // Quadro de setor (lockedSector) usa resolução por alias; senão, filtro livre.
        val okS = if (lockedSector != null) Sectors.of(t.sector).key == lockedSector
        else (sectorFilter == null || t.sector == sectorFilter)
        val okM = !mineOnly || currentUid == null ||
            (t.assigneeId == currentUid) || (t.by == currentUid)
        // Fase B: visibilidade por função (admin/social veem tudo; operacional só as próprias).
        val okVis = TaskVisibility.canSeeTask(currentUser, t)
        okQ && okS && okM && okVis
    }
    val pager = rememberPagerState(pageCount = { TaskStatus.COLUMNS.size })

    Column(Modifier.fillMaxSize()) {
        // Cabeçalho do quadro do setor (Fase A): voltar + nome do setor + "+ Novo".
        if (lockedSector != null) {
            val sec = Sectors.of(lockedSector)
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = 12.dp, end = 16.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (onBack != null) {
                    Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(22.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                }
                Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(sec.color.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                    Icon(sec.icon, contentDescription = null, tint = sec.color, modifier = Modifier.size(19.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("Quadro de ${sec.label}", color = Tokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(sec.desc, color = Tokens.Faint, fontSize = 11.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Accent).clickable { onNew() }.padding(horizontal = 14.dp, vertical = 9.dp)) {
                    Text("+ Novo", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        SearchField(query, { query = it }, "Buscar tarefa…")
        // Filtro "Minhas tarefas" (chip de escopo) + filtros de setor (ocultos no quadro de setor).
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 2.dp)) {
            if (currentUid != null) {
                SectorChip("Minhas tarefas", Tokens.Accent, mineOnly) { mineOnly = !mineOnly }
            }
            if (lockedSector == null) {
                SectorChip("Todos", null, sectorFilter == null) { sectorFilter = null }
                Sectors.ALL.forEach { s -> SectorChip(s.label, s.color, sectorFilter == s.key) { sectorFilter = s.key } }
            }
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

// ── PROD1.7 — paleta/medidas do card premium (paridade com o KANBANBOARDV2 BLACK PREMIUM do Desktop) ──
private val CardGradTop = Color(0xFF161D2E)
private val CardGradBot = Color(0xFF121726)
private val CardPresenceRing = Color(0xFF141A29)
private val RailFuture = Color(0xFF313A4D)
private val TierViolet = Color(0xFF9D8BFF)
private val BtnGradA = Color(0xFF6D5EFC)
private val BtnGradB = Color(0xFF4D7CFF)

// Estado visual derivado do MESMO Flow Engine canônico do Desktop (FlowState.kt).
// Cron / com designer → perspectiva Social (rótulos canônicos); demais → status simples.
private data class CardFlow(
    val statusLabel: String,
    val statusColor: Color,
    val actor: String,
    val next: String,
    val stage: Int,
    val completed: Boolean,
)

private fun computeCardFlow(task: TaskItem): CardFlow {
    val isFlow = (task.sector ?: "") == "cronograma" || task.designerAssignment?.designerId != null
    if (isFlow) {
        val fs = FlowEngine.derive(task)
        val p = fs.social
        val designerName = task.designerAssignment?.designerName?.let { UserColor.firstName(it) }
        val actor = when (fs.phase) {
            TaskPhase.PLANNING -> "Social"
            TaskPhase.AWAITING_DESIGNER, TaskPhase.DESIGNER_PRODUCING,
            TaskPhase.DESIGNER_REVISING, TaskPhase.DESIGNER_DELIVERED ->
                "Designer" + (designerName?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: "")
            TaskPhase.AWAITING_CLIENT_APPROVAL, TaskPhase.CLIENT_REQUESTED_CHANGES -> "Cliente"
            TaskPhase.COMPLETED -> "Concluído"
        }
        val stage = when (fs.phase) {
            TaskPhase.PLANNING, TaskPhase.AWAITING_DESIGNER -> 0
            TaskPhase.DESIGNER_PRODUCING, TaskPhase.DESIGNER_REVISING -> 1
            TaskPhase.DESIGNER_DELIVERED, TaskPhase.AWAITING_CLIENT_APPROVAL, TaskPhase.CLIENT_REQUESTED_CHANGES -> 2
            TaskPhase.COMPLETED -> 3
        }
        return CardFlow(p.label, p.color, actor, p.next, stage, fs.phase == TaskPhase.COMPLETED)
    }
    val s = task.status ?: "afazer"
    val next = when (s) {
        "afazer" -> "Iniciar a tarefa"
        "andamento" -> "Enviar para revisão"
        "revisao" -> "Concluir a tarefa"
        else -> "—"
    }
    val stage = when (s) { "andamento" -> 1; "revisao" -> 2; "concluido" -> 3; else -> 0 }
    return CardFlow(TaskStatus.label(s), TaskStatus.color(s), "Equipe", next, stage, s == "concluido")
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TaskCardPro(task: TaskItem, requester: UserLite?, assignee: UserLite?, onClick: () -> Unit, onMove: () -> Unit) {
    val sector = Sectors.of(task.sector)
    val total = task.checklist.size
    val done = task.checklist.count { it.d }
    val deadline = TaskDeadline.of(task)
    val flow = computeCardFlow(task)
    val accent = flow.statusColor
    val temas = task.cronContents.mapNotNull { it.tema?.takeIf { t -> t.isNotBlank() } }

    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp)
            .shadow(16.dp, RoundedCornerShape(20.dp), clip = false)
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.verticalGradient(listOf(CardGradTop, CardGradBot)))
            .border(1.dp, accent.copy(alpha = 0.30f), RoundedCornerShape(20.dp))
            .clickable { onClick() },
    ) {
        // acento superior (inset, rente ao topo) — espelha o ::before do card Desktop
        Box(
            Modifier.padding(start = 18.dp, end = 18.dp).fillMaxWidth().height(3.dp)
                .clip(RoundedCornerShape(bottomStart = 3.dp, bottomEnd = 3.dp))
                .background(accent.copy(alpha = 0.9f)),
        )
        Column(Modifier.padding(18.dp)) {
            // 1. TOP — status canônico + SLA + prazo (wrap responsivo)
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                CardChip(flow.statusLabel, accent, dot = true, strong = true, maxLines = 2)
                val sla = SlaContract.derive(task)
                if (sla.sev != "neutro" && sla.label.isNotBlank()) CardChip(sla.label, sla.color, dot = true, strong = false)
                if (deadline != null) CardChip(deadline.text, deadline.color, dot = false, strong = false)
            }
            // 2. PERFIL — responsável (avatar + presença) + nome + cargo
            Spacer(Modifier.height(13.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box {
                    Avatar(assignee?.photo, UserColor.of(assignee?.id, assignee?.color), task.assignee ?: "?", 52.dp)
                    Box(
                        Modifier.align(Alignment.BottomEnd).size(14.dp).clip(CircleShape)
                            .background(Tokens.Green).border(2.dp, CardPresenceRing, CircleShape),
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        task.assignee?.ifBlank { null } ?: "Sem responsável",
                        color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                        lineHeight = 20.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    )
                    val role = assignee?.role
                    Text(
                        if (!role.isNullOrBlank()) role else "Responsável",
                        color = Tokens.Soft, fontSize = 12.5.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 1.dp),
                    )
                }
            }
            // 3. ORIGEM — "Enviado por" + data (caixa sutil)
            if (requester != null || task.createdAt != null) {
                Spacer(Modifier.height(12.dp))
                OriginBox(UserColor.firstName(requester?.name).ifBlank { "—" }, task.createdAt?.let { DateUtil.fmtMs(it) })
            }
            // 4. CLIENTE (kicker) + TÍTULO
            Spacer(Modifier.height(13.dp))
            if (!task.client.isNullOrBlank()) {
                Text(
                    task.client.uppercase(), color = TierViolet, fontSize = 11.sp,
                    fontWeight = FontWeight.Bold, letterSpacing = 0.08.sp,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
            }
            Text(
                task.title?.ifBlank { null } ?: task.client ?: "Sem título",
                color = Tokens.Ink, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold,
                lineHeight = 24.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
            // 5. CHIPS — setor + prioridade
            Spacer(Modifier.height(11.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                CardChip(sector.label, sector.color, dot = true, strong = false)
                if (task.cronContents.isNotEmpty()) {
                    val nc = task.cronContents.size
                    CardChip(if (nc == 1) "1 conteúdo" else "$nc conteúdos", TierViolet, dot = false, strong = false)
                }
                if (task.priority) CardChip("Prioridade alta", Tokens.Red, dot = true, strong = false)
            }
            // 6. TRILHO de progresso (derivado da fase do Flow Engine)
            Spacer(Modifier.height(13.dp))
            FlowRail(flow.stage, accent, flow.completed)
            // 7. ETAPA / PRÓXIMA (painel sutil)
            Spacer(Modifier.height(12.dp))
            StagePanel(flow.actor, accent, flow.next)
            // 8. TEMAS (cronograma) — caixa com cabeçalho + itens numerados
            if (temas.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                ThemesBox(temas)
            }
            // 9. checklist (se houver)
            if (total > 0) {
                Spacer(Modifier.height(12.dp))
                LinearProgressIndicator(
                    progress = { done.toFloat() / total.toFloat() },
                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                    color = Tokens.Green, trackColor = Tokens.Surface2,
                )
                Spacer(Modifier.height(4.dp))
                Text("$done de $total no checklist", color = Tokens.Faint, fontSize = 11.sp)
            }
            // 10. DATA / PRAZO
            if (!task.dueDate.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Schedule, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(7.dp))
                    Text(DateUtil.prazo(task.dueDate, task.dueTime), color = Tokens.Ink, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                }
            }
            // 11. FOOTER — Detalhes (gradiente) + Mover (contorno)
            Spacer(Modifier.height(15.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                        .background(Brush.horizontalGradient(listOf(BtnGradA, BtnGradB)))
                        .clickable { onClick() }.padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Visibility, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Detalhes", color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                }
                Row(
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.05f))
                        .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(12.dp))
                        .clickable { onMove() }.padding(vertical = 14.dp),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.SwapHoriz, contentDescription = null, tint = Tokens.Ink, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Mover", color = Tokens.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// Chip premium: fundo translúcido da cor + borda sutil + ponto opcional (espelha .kbv2-status/.kbv2-chip).
@Composable
private fun CardChip(text: String, color: Color, dot: Boolean, strong: Boolean, maxLines: Int = 1) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(9.dp))
            .background(color.copy(alpha = if (strong) 0.18f else 0.14f))
            .border(1.dp, color.copy(alpha = if (strong) 0.46f else 0.34f), RoundedCornerShape(9.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (dot) {
            Box(Modifier.size(7.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(7.dp))
        }
        Text(text, color = color, fontSize = 12.sp, fontWeight = FontWeight.Bold, lineHeight = 14.sp, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
    }
}

// Trilho de progresso: 4 paradas, concluídas (verde) · atual (acento, com brilho) · futuras (cinza).
@Composable
private fun FlowRail(stage: Int, accent: Color, completed: Boolean) {
    val steps = 4
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        for (i in 0 until steps) {
            val isDone = completed || i < stage
            val isCur = !completed && i == stage
            val dotColor = when { isDone -> Tokens.Green; isCur -> accent; else -> RailFuture }
            Box(contentAlignment = Alignment.Center) {
                if (isCur) Box(Modifier.size(18.dp).clip(CircleShape).background(accent.copy(alpha = 0.20f)))
                Box(Modifier.size(if (isCur) 12.dp else 9.dp).clip(CircleShape).background(dotColor))
            }
            if (i < steps - 1) {
                Box(
                    Modifier.weight(1f).height(3.dp).padding(horizontal = 3.dp).clip(RoundedCornerShape(2.dp))
                        .background(if (completed || i < stage) Tokens.Green.copy(alpha = 0.7f) else RailFuture),
                )
            }
        }
    }
}

// Caixa "Enviado por <nome>" + data (espelha .kbv2-card-origin).
@Composable
private fun OriginBox(name: String, dateText: String?) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(11.dp))
            .background(Color.White.copy(alpha = 0.04f))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(11.dp))
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Outlined.Send, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(9.dp))
        Column(Modifier.weight(1f)) {
            Row {
                Text("Enviado por ", color = Tokens.Soft, fontSize = 12.5.sp)
                Text(name, color = Tokens.Ink, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            }
            if (dateText != null) Text(dateText, color = Tokens.Faint, fontSize = 11.5.sp, modifier = Modifier.padding(top = 1.dp))
        }
    }
}

// Painel ETAPA / PRÓXIMA (rótulos canônicos do Flow Engine).
@Composable
private fun StagePanel(actor: String, actorColor: Color, next: String) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.03f))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("ETAPA", color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp, modifier = Modifier.width(64.dp))
            Text(actor, color = actorColor, fontSize = 12.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        }
        Row(verticalAlignment = Alignment.Top) {
            Text("PRÓXIMA", color = Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp, modifier = Modifier.width(64.dp).padding(top = 1.dp))
            Text(next, color = Tokens.Soft, fontSize = 12.5.sp, lineHeight = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        }
    }
}

// Caixa de TEMAS com cabeçalho + itens numerados (espelha .kbv2-card-themes).
@Composable
private fun ThemesBox(themes: List<String>) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.025f))
            .border(1.dp, Color.White.copy(alpha = 0.07f), RoundedCornerShape(12.dp)),
    ) {
        Text(
            "TEMAS", color = Tokens.Soft, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.10.sp,
            modifier = Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.04f)).padding(horizontal = 12.dp, vertical = 8.dp),
        )
        val show = themes.take(3)
        show.forEachIndexed { i, t ->
            if (i > 0) Box(Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.06f)))
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp), verticalAlignment = Alignment.Top) {
                Box(Modifier.size(20.dp).clip(RoundedCornerShape(7.dp)).background(Tokens.Accent.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                    Text("${i + 1}", color = Tokens.Accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(10.dp))
                Text(t, color = Tokens.Soft, fontSize = 13.sp, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(top = 1.dp))
            }
        }
        if (themes.size > 3) {
            Text("+${themes.size - 3} tema(s)", color = Tokens.Faint, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
        }
    }
}
