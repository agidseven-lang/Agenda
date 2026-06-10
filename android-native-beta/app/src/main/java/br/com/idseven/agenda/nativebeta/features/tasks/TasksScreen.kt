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
import androidx.compose.foundation.layout.widthIn
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
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
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
import br.com.idseven.agenda.nativebeta.designsystem.components.StatusChip
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Cron
import br.com.idseven.agenda.nativebeta.domain.CronStatusUi
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

// role-aware (paridade Desktop f96aa2e) — opções de mover do QUADRO DO DESIGNER (4 colunas:
// A Fazer / Em andamento / Revisão-Ajuste / Entregue). Os alvos gravam designerFlowStatus
// (afazer/andamento/revisao/concluido) — fonte única do eixo do designer.
private fun designerMoveOptions(curCol: String): List<MoveOpt> = when (curCol) {
    "afazer" -> listOf(MoveOpt("Mover para Em andamento", "andamento", "Começar a produção", Icons.Filled.KeyboardArrowRight))
    "concluido", "entregue" -> listOf(MoveOpt("Reabrir (Em andamento)", "andamento", "Voltar a produzir", Icons.Outlined.Refresh))
    "revisao" -> listOf(
        MoveOpt("Mover para Em andamento", "andamento", "Corrigir o ajuste", Icons.Filled.KeyboardArrowRight),
        MoveOpt("Marcar como Entregue", "concluido", "Reentregar para a Social", Icons.Filled.KeyboardArrowRight),
    )
    else -> listOf( // andamento
        MoveOpt("Marcar como Entregue", "concluido", "Entrega para a Social finalizar", Icons.Filled.KeyboardArrowRight),
        MoveOpt("Mover para Revisão/Ajuste", "revisao", "Há ajuste a corrigir", Icons.Filled.KeyboardArrowLeft),
        MoveOpt("Voltar para A Fazer", "afazer", "Pausar e retornar", Icons.Filled.KeyboardArrowLeft),
    )
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
    personId: String? = null,          // ADITIVO: quadro por RESPONSÁVEL (admin/role-boards) — todos os setores
    personName: String? = null,
    flow: String? = null,              // "client" | "designer" | "social"
    designerId: String? = null,        // quando flow=="designer", o designer dono do quadro
    socialId: String? = null,          // quando flow=="social", a Social Media dona do quadro
    onNew: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    tabsBar: @Composable () -> Unit = {}, // abas superiores (Meu quadro/Cliente/Designers/Setores)
) {
    tasksState.errorMessage()?.let { ErrorState("Tarefas — $it"); return }
    if (tasksState.isLoading) { SkeletonList(); return }
    val all = tasksState.itemsOrEmpty()
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf("") }
    var sectorFilter by remember { mutableStateOf<String?>(null) }
    var moveTarget by remember { mutableStateOf<TaskItem?>(null) }
    var deleteTarget by remember { mutableStateOf<TaskItem?>(null) }
    // "Minhas tarefas" = sou o responsavel (assigneeId) OU o solicitante (by).
    // So habilita o chip quando ha um currentUid; sem schema novo, sem repo novo.
    var mineOnly by remember { mutableStateOf(false) }

    val q = query.trim().lowercase()
    val tasks = all.filter { t ->
        val okQ = q.isEmpty() || listOf(t.title, t.client, t.assignee).any { (it ?: "").lowercase().contains(q) }
        // Quadro por responsável (personId) ignora setor; quadro de setor (lockedSector) trava o setor.
        val okS = when {
            flow != null -> true
            personId != null -> true
            lockedSector != null -> Sectors.of(t.sector).key == lockedSector
            else -> (sectorFilter == null || t.sector == sectorFilter)
        }
        // P3/P4 — separação de fluxos: cliente (relacionamento) x designer (quadro de UM designer).
        val okFlow = when (flow) {
            "client" -> TaskVisibility.isClientFlow(t)
            "designer" -> TaskVisibility.isDesignerFlow(t) && (designerId == null || TaskVisibility.designerOf(t) == designerId)
            "social" -> socialId == null || TaskVisibility.socialOf(t, users) == socialId
            else -> true
        }
        // Fluxo da pessoa = o que ela executa (assigneeId) OU as demandas dela (by). Cobre designer e social.
        val okPerson = personId == null || t.assigneeId == personId || t.by == personId
        val okM = !mineOnly || currentUid == null ||
            (t.assigneeId == currentUid) || (t.by == currentUid)
        // Fase B: visibilidade por função (admin/social veem tudo; operacional só as próprias).
        val okVis = TaskVisibility.canSeeTask(currentUser, t)
        okQ && okS && okFlow && okPerson && okM && okVis
    }
    // 1.0.93 — COLUNAS POR CONTEXTO (espelha o Desktop 1.0.105): Cliente 4 / Social 4 /
    // Designer 3 / "Meu quadro"+Setor 4. Reduz o excesso de colunas do teste real.
    val isClientBoard = flow == "client"
    val isSocialBoard = flow == "social"
    val isDesignerBoard = flow == "designer"
    val wideBoard = false   // todos os quadros agora têm no máximo 4 colunas
    val cols: List<BoardCol> = when {
        isClientBoard -> TaskVisibility.CLIENT_COLS4.map { BoardCol(it.key, it.label, it.label, clientCol4Color(it.key)) }
        isSocialBoard -> TaskVisibility.SOCIAL_COLS4.map { BoardCol(it.key, it.label, statusColShort(it.key), TaskStatus.color(it.key)) }
        isDesignerBoard -> TaskVisibility.DESIGNER_COLS4.map { BoardCol(it.key, it.label, it.label, designerColViewColor(it.key)) }
        else -> TaskStatus.COLUMNS.map { BoardCol(it, TaskStatus.label(it), statusColShort(it), TaskStatus.color(it)) }
    }
    val colKeyOf: (TaskItem) -> String = { t ->
        when {
            isClientBoard -> TaskVisibility.clientCol4(t)
            isDesignerBoard -> TaskVisibility.designerColView(t)
            isSocialBoard -> TaskVisibility.boardCol4(t)
            // Role board / "Meu quadro": designer-aware — cronograma recém-enviado ao designer
            // aparece em "A Fazer" para o próprio designer (corrige o desync PC×Android).
            else -> TaskVisibility.boardCol4For(t, currentUid)
        }
    }
    val pager = rememberPagerState(pageCount = { cols.size })

    Column(Modifier.fillMaxSize()) {
        // 1.0.94 — chips NÃO ficam mais no topo global; vão JUNTO da busca (abaixo dela).
        // P3/P4 — Cabeçalho dos fluxos separados (Cliente / um Designer).
        if (flow != null) {
            val isClient = flow == "client"
            val isSocial = flow == "social"
            val person = users.firstOrNull { it.id == (if (isSocial) socialId else designerId) }
            val accent = when { isClient -> Color(0xFF22D3B8); isSocial -> Color(0xFF22D3EE); else -> Color(0xFFA78BFA) }
            val title = when {
                isClient -> "Cliente"
                isSocial -> "Social · ${UserColor.firstName(person?.name ?: "Social Media")}"
                person != null -> "Designer · ${UserColor.firstName(person.name ?: "Designer")}"
                else -> "Quadro do Designer"
            }
            val sub = when {
                isClient -> "Fica visível até a aprovação final — mesmo enviado ao designer"
                isSocial -> (person?.role?.ifBlank { null } ?: "Social Media") + " · inclui tarefas no designer"
                else -> (person?.role?.ifBlank { null } ?: "Designer") + " · monitorado em tempo real"
            }
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = 12.dp, end = 16.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (onBack != null) {
                    Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(22.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                }
                if (!isClient && person != null) {
                    Avatar(person.photo, UserColor.of(person.id, person.color), person.name, 38.dp)
                } else {
                    Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(accent.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                        Icon(if (isClient) Icons.Outlined.Visibility else Icons.Outlined.Person, contentDescription = null, tint = accent, modifier = Modifier.size(20.dp))
                    }
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(title, color = Tokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(sub, color = Tokens.Faint, fontSize = 11.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        } else
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
        } else if (personId != null) {
            // Cabeçalho do QUADRO POR RESPONSÁVEL (admin / "Meu quadro"): avatar + nome, todos os setores.
            val person = users.firstOrNull { it.id == personId }
            val nm = personName ?: person?.name ?: "Responsável"
            Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = 12.dp, end = 16.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                if (onBack != null) {
                    Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(22.dp))
                    }
                    Spacer(Modifier.width(10.dp))
                }
                Avatar(person?.photo, UserColor.of(person?.id ?: personId, person?.color), nm, 38.dp)
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("Quadro de ${UserColor.firstName(nm)}", color = Tokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(person?.role?.ifBlank { null } ?: "Fluxo individual", color = Tokens.Faint, fontSize = 11.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        SearchField(query, { query = it }, "Buscar tarefa…")
        // 1.0.94 — chips de navegação (Meu quadro/Cliente/Designers/Social/Setores) JUNTO da busca,
        // logo abaixo dela, no MESMO bloco — scroll horizontal elegante (nunca soltos no topo).
        tabsBar()
        // Filtro "Minhas tarefas" + filtros de setor (ocultos no quadro de setor, por responsável e nos fluxos).
        if (lockedSector == null && personId == null && flow == null) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 2.dp)) {
                if (currentUid != null) {
                    SectorChip("Minhas tarefas", Tokens.Accent, mineOnly) { mineOnly = !mineOnly }
                }
                SectorChip("Todos", null, sectorFilter == null) { sectorFilter = null }
                Sectors.ALL.forEach { s -> SectorChip(s.label, s.color, sectorFilter == s.key) { sectorFilter = s.key } }
            }
        }
        // Seletor/indicador de coluna. Cliente/Operacional = 7 colunas (rolável, largura fixa);
        // demais = 4 colunas (preenchem a largura com weight, sem scroll p/ não quebrar a medição).
        val selRowMod = if (wideBoard)
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 8.dp)
        else Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)
        Row(selRowMod) {
            cols.forEachIndexed { i, c ->
                val count = tasks.count { colKeyOf(it) == c.key }
                val sel = pager.currentPage == i
                Box(
                    modifier = (if (wideBoard) Modifier.widthIn(min = 92.dp) else Modifier.weight(1f))
                        .padding(horizontal = 3.dp).clip(RoundedCornerShape(10.dp))
                        .background(if (sel) c.color.copy(alpha = 0.18f) else Tokens.Surface)
                        .border(1.dp, if (sel) c.color else Tokens.Line, RoundedCornerShape(10.dp))
                        .clickable { scope.launch { pager.animateScrollToPage(i) } }
                        .padding(vertical = 7.dp, horizontal = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(c.short, color = if (sel) c.color else Tokens.Faint, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
                        Text("$count", color = if (sel) c.color else Tokens.Soft, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (all.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth()) { EmptyState("Sem tarefas", "Toque em + para criar a primeira", Icons.Outlined.Checklist) }
            return
        }

        HorizontalPager(state = pager, modifier = Modifier.weight(1f).fillMaxWidth()) { page ->
            val col = cols[page]
            val list = TaskSort.order(tasks.filter { colKeyOf(it) == col.key })
            Column(Modifier.fillMaxHeight().padding(horizontal = 18.dp)) {
                BoardColumnHeader(col, list.size)
                if (list.isEmpty()) {
                    Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) { Text("Nenhuma tarefa aqui", color = Tokens.Faint, fontSize = 13.sp) }
                } else {
                    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PaddingValues(bottom = 24.dp)) {
                        items(list, key = { it.id }) { task ->
                            val requester = users.firstOrNull { it.id == task.by }
                            // Responsável: resolve por assigneeId (preciso) e cai para nome (dados antigos).
                            val assignee = users.firstOrNull { it.id == task.assigneeId }
                                ?: users.firstOrNull { (it.name ?: "").equals(task.assignee ?: "", ignoreCase = true) }
                            // Mesma regra do Desktop canDelTask: admin/gestão, ou criador, ou responsável.
                            val canDel = TaskVisibility.canSeeAllBoards(currentUser) ||
                                (currentUid != null && (task.by == currentUid || task.assigneeId == currentUid))
                            // role-aware: card na perspectiva do designer no quadro do designer OU
                            // quando o usuário logado É o designer atribuído (paridade Desktop f96aa2e).
                            val designerView = TaskVisibility.isDesignerFlow(task) && (isDesignerBoard || TaskVisibility.designerOf(task) == currentUid)
                            TaskCardPro(
                                task, requester, assignee, canDel,
                                onClick = { onTaskClick(task.id) },
                                onMove = { moveTarget = task },
                                onDelete = { deleteTarget = task },
                                designerView = designerView,
                                clientView = isClientBoard,
                            )
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
                // 1.0.97 — se o card está no eixo do DESIGNER (quadro do designer OU eu sou o designer
                // atribuído), as opções e a gravação usam designerFlowStatus (move de verdade no PC e no celular).
                val designerAxis = TaskVisibility.isDesignerFlow(target) && (flow == "designer" || TaskVisibility.designerOf(target) == currentUid)
                val opts = if (designerAxis) designerMoveOptions(TaskVisibility.designerCol(target)) else moveOptions(target.status ?: "afazer")
                opts.forEach { opt ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(14.dp))
                            .background(TaskStatus.color(opt.target).copy(alpha = 0.12f))
                            .clickable { scope.launch { TaskRepo.move(target, opt.target, currentUid, designerAxis) }; moveTarget = null }
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

    // Confirmação de exclusão (mesma ação do Desktop: remove a tarefa da coleção).
    val del = deleteTarget
    if (del != null) {
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            containerColor = Tokens.Surface,
            titleContentColor = Tokens.Ink,
            textContentColor = Tokens.Soft,
            title = { Text("Excluir tarefa?", fontWeight = FontWeight.Bold) },
            text = { Text("Esta ação remove \"${del.title?.ifBlank { null } ?: del.client ?: "a tarefa"}\" para toda a equipe. Não dá para desfazer.") },
            confirmButton = {
                TextButton(onClick = { scope.launch { TaskRepo.delete(del.id) }; deleteTarget = null }) {
                    Text("Excluir", color = Tokens.Red, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text("Cancelar", color = Tokens.Soft) }
            },
        )
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

// Coluna genérica (cliente OU designer/status) — espelha BoardCol.
data class BoardCol(val key: String, val label: String, val short: String, val color: Color)

// Rótulos curtos + cores das colunas do fluxo do CLIENTE (7 colunas).
private fun clientColShort(k: String): String = when (k) {
    "enviado" -> "Enviado"; "aprovado" -> "Aprovado"; "producao" -> "Produção"
    "revisao" -> "Revisão"; "reenviado" -> "Reenviado"; "concluido" -> "Concl."; else -> "A Fazer"
}
private fun clientColColor(k: String): Color = when (k) {
    "enviado" -> Color(0xFF5B6CFF); "aprovado" -> Color(0xFF22D3EE); "producao" -> Color(0xFFA78BFA)
    "revisao" -> Color(0xFFF59E0B); "reenviado" -> Color(0xFF34D399); "concluido" -> Color(0xFF10B981)
    else -> Color(0xFF6E7480)
}
private fun statusColShort(k: String): String = when (k) { "andamento" -> "Andam."; "revisao" -> "Revisão"; "concluido" -> "Concl."; else -> "A Fazer" }
// 1.0.93 — cores das colunas reduzidas por contexto (Cliente 4 / Designer 3).
private fun clientCol4Color(k: String): Color = when (k) {
    "enviado" -> Color(0xFF5B6CFF); "analise" -> Color(0xFF22D3EE)
    "revisao" -> Color(0xFFF59E0B); "aprovado" -> Color(0xFF34D399); else -> Color(0xFF6E7480)
}
private fun designerColViewColor(k: String): Color = when (k) {
    "andamento" -> Color(0xFFF59E0B); "revisao" -> Color(0xFF60A5FA); "entregue" -> Color(0xFF34D399); else -> Color(0xFF9BA0AB)
}
// Rótulos curtos + cores das colunas do eixo OPERACIONAL (7).
private fun opColShort(k: String): String = when (k) {
    "producao" -> "Produção"; "aguardando_envio" -> "Enviar designer"
    "aguardando_designer_iniciar" -> "Aguard. designer"; "aguardando_designer" -> "Designer"
    "aguardando_designer_revisao" -> "Designer rev."; "aguardando_legenda" -> "Legenda/post"
    "aguardando_revisao" -> "Revisão"; "aguardando_final" -> "Aprov. final"; "concluido" -> "Concl."; else -> "A Fazer"
}
private fun opColColor(k: String): Color = when (k) {
    "producao" -> Color(0xFF22D3EE); "aguardando_envio" -> Color(0xFF22D3EE)
    "aguardando_designer_iniciar" -> Color(0xFF7C83FF); "aguardando_designer" -> Color(0xFFA78BFA)
    "aguardando_designer_revisao" -> Color(0xFF60A5FA); "aguardando_legenda" -> Color(0xFF5B6CFF)
    "aguardando_revisao" -> Color(0xFFF59E0B); "aguardando_final" -> Color(0xFF34D399); "concluido" -> Color(0xFF10B981)
    else -> Color(0xFF6E7480)
}

@Composable
private fun BoardColumnHeader(col: BoardCol, count: Int) {
    val color = col.color
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 14.dp).clip(RoundedCornerShape(16.dp))
            .background(Tokens.Surface).border(1.dp, color.copy(alpha = 0.4f), RoundedCornerShape(16.dp)).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(col.label, color = color, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
        Box(Modifier.clip(RoundedCornerShape(999.dp)).background(color.copy(alpha = 0.16f)).padding(horizontal = 12.dp, vertical = 5.dp)) {
            Text("$count", color = color, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// Chip de tag (NÃO maiúsculo — espelha os chips do card Desktop "Cronograma"/"Semanal").
@Composable
private fun TagChip(text: String, color: Color, soft: Boolean = false) {
    val bg = if (soft) Tokens.Surface2 else color.copy(alpha = 0.14f)
    val base = Modifier.clip(RoundedCornerShape(8.dp)).background(bg)
    val mod = if (soft) base.border(1.dp, Tokens.Line, RoundedCornerShape(8.dp)) else base
    Box(mod.padding(horizontal = 11.dp, vertical = 5.dp)) {
        Text(text, color = if (soft) Tokens.Soft else color, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

// CARD DE TAREFA — paridade 100% com o card premium do Desktop (renderer taskCard()),
// apenas empilhado para o celular. internal: acessível ao teste de screenshot (Roborazzi).
@Composable
internal fun TaskCardPro(
    task: TaskItem,
    requester: UserLite?,
    assignee: UserLite?,
    canDelete: Boolean,
    onClick: () -> Unit,
    onMove: () -> Unit,
    onDelete: () -> Unit,
    designerView: Boolean = false,
    clientView: Boolean = false,
) {
    // role-aware (paridade Desktop f96aa2e): no quadro do DESIGNER, o card mostra o status/próxima
    // ação DELE, sem o fluxo de aprovação do cliente como eixo principal.
    val isDesignerCard = designerView && Sectors.of(task.sector).key == "cronograma" && TaskVisibility.hasDesigner(task)
    // bug 1.0.133: no quadro CLIENTE o badge usa linguagem do cliente (clientFacingStatusView).
    val isClientCard = clientView && Sectors.of(task.sector).key == "cronograma"
    val sector = Sectors.of(task.sector)
    val total = task.checklist.size
    val done = task.checklist.count { it.d }
    val deadline = TaskDeadline.of(task)
    val cron = Cron.of(task)
    val asgName = (assignee?.name ?: task.assignee)?.trim().orEmpty()
    val reqName = (requester?.name ?: task.by?.let { "—" } ?: "").trim()
    Column(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(18.dp))
            .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(18.dp))
            .clickable { onClick() }.padding(16.dp),
    ) {
        // 1) META — chip de status (esq) + indicador de prazo (dir)
        // CORREÇÃO (status-consistency): para CRONOGRAMA o chip mostra o STATUS OPERACIONAL
        // (não o status bruto) — evita "Concluído" contraditório com o fluxo real.
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (isDesignerCard) {
                // bug 1.0.133: badge ESPECÍFICO do designer ("Em produção"; coluna segue "Em andamento").
                val dv = TaskVisibility.designerColView(task)
                StatusChip(TaskVisibility.designerCardLabel(task), designerColViewColor(dv))
            } else if (isClientCard) {
                val cf = TaskVisibility.clientFacingStatusView(task)
                StatusChip(cf.label, Color(cf.colorHex))
            } else if (sector.key == "cronograma") {
                val op = TaskVisibility.operationalCol(task)
                val opLbl = TaskVisibility.OPERATIONAL_COLS.firstOrNull { it.key == op }?.label ?: TaskStatus.label(task.status)
                StatusChip(opLbl, opColColor(op))
            } else {
                StatusChip(TaskStatus.label(task.status), TaskStatus.color(task.status))
            }
            Spacer(Modifier.weight(1f))
            if (deadline != null) Pill(deadline.text, deadline.color)
        }
        // 2) RESPONSÁVEL — avatar grande + nome (até 2 linhas) + cargo/função
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(assignee?.photo, UserColor.of(assignee?.id ?: task.assigneeId, assignee?.color), asgName.ifEmpty { "?" }, 52.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    asgName.ifEmpty { "Sem responsável" },
                    color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold,
                    lineHeight = 19.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
                )
                Text(
                    assignee?.role?.ifBlank { null } ?: "Responsável",
                    color = Tokens.Soft, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }
        // 3) ENVIADO POR — bloco com ícone + nome (negrito) + data/hora
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Bg)
                .border(1.dp, Tokens.LineSoft, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Person, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                text = buildAnnotatedString {
                    append("Enviado por ")
                    withStyle(SpanStyle(color = Tokens.Ink, fontWeight = FontWeight.Bold)) { append(reqName.ifEmpty { "—" }) }
                    task.createdAt?.takeIf { it > 0 }?.let { append(" · ${DateUtil.fmtMs(it)}") }
                },
                color = Tokens.Soft, fontSize = 12.sp, lineHeight = 16.sp,
            )
        }
        // 4) CORPO — cliente (kicker) + título + chip de fluxo + tags
        if (!task.client.isNullOrBlank()) {
            Spacer(Modifier.height(13.dp))
            Text(task.client.uppercase(), color = Tokens.Soft, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.06.sp)
        }
        Spacer(Modifier.height(3.dp))
        Text(
            task.title?.ifBlank { null } ?: task.client ?: "Sem título",
            color = Tokens.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold,
            lineHeight = 21.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
        )
        if (isDesignerCard) {
            // Perspectiva do DESIGNER: "Próxima" ação DELE (sem o status do fluxo do cliente).
            Spacer(Modifier.height(9.dp))
            val dc = designerColViewColor(TaskVisibility.designerColView(task))
            Row(
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(dc.copy(alpha = 0.14f))
                    .border(1.dp, dc.copy(alpha = 0.32f), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(dc))
                Spacer(Modifier.width(7.dp))
                Text("Próxima: " + TaskVisibility.designerNextShort(task), color = dc, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        } else if (!task.cronStatus.isNullOrBlank()) {
            Spacer(Modifier.height(9.dp))
            val cc = CronStatusUi.color(task.cronStatus)
            Row(
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(cc.copy(alpha = 0.14f))
                    .border(1.dp, cc.copy(alpha = 0.32f), RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 5.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(7.dp).clip(CircleShape).background(cc))
                Spacer(Modifier.width(7.dp))
                Text(CronStatusUi.label(task.cronStatus), color = cc, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            TagChip(sector.label, sector.color)
            if (cron != null) { Spacer(Modifier.width(8.dp)); TagChip(cron.label, Tokens.Soft, soft = true) }
            if (task.priority) { Spacer(Modifier.width(8.dp)); TagChip("Prioridade", Tokens.Red) }
        }
        // 5) TEMAS numerados (conteúdos do cronograma) OU briefing curto
        if (cron != null && cron.themes.isNotEmpty()) {
            Spacer(Modifier.height(13.dp))
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Tokens.Bg)
                    .border(1.dp, Tokens.LineSoft, RoundedCornerShape(14.dp)).padding(13.dp),
            ) {
                Text("TEMAS", color = Tokens.Faint, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.08.sp)
                cron.themes.take(3).forEach { th ->
                    Spacer(Modifier.height(9.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(26.dp).clip(RoundedCornerShape(8.dp)).background(Tokens.Accent.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                            Text("${th.n}", color = Tokens.Accent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(11.dp))
                        Text(th.tema, color = Tokens.Ink, fontSize = 13.5.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                val rest = cron.count - 3
                if (rest > 0) {
                    Spacer(Modifier.height(9.dp))
                    Text("+ $rest conteúdo${if (rest > 1) "s" else ""}", color = Tokens.Faint, fontSize = 11.5.sp)
                }
            }
        } else if (!task.desc.isNullOrBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(task.desc, color = Tokens.Faint, fontSize = 12.5.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 16.sp)
        }
        // 6) CHECKLIST — barra + contador
        // Reprovação 1.0.137: cronograma não exibe checklist (sem função no fluxo).
        if (total > 0 && sector.key != "cronograma") {
            Spacer(Modifier.height(13.dp))
            LinearProgressIndicator(progress = { done.toFloat() / total.toFloat() }, modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = Tokens.Green, trackColor = Tokens.Surface2)
            Spacer(Modifier.height(5.dp))
            Text("$done de $total no checklist", color = Tokens.Faint, fontSize = 11.sp)
        }
        // 7) PRAZO ou "Sem prazo"
        Spacer(Modifier.height(13.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Schedule, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                if (!task.dueDate.isNullOrBlank()) DateUtil.prazo(task.dueDate, task.dueTime) else "Sem prazo",
                color = Tokens.Faint, fontSize = 12.sp,
            )
        }
        // 8) AÇÕES — Detalhes / Mover / Excluir
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Row(
                modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Tokens.Accent)
                    .clickable { onClick() }.padding(vertical = 11.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Visibility, contentDescription = null, tint = Color.White, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(7.dp))
                Text("Detalhes", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(10.dp))
            Row(
                modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Tokens.Surface2)
                    .border(1.dp, Tokens.Line, RoundedCornerShape(12.dp)).clickable { onMove() }.padding(vertical = 11.dp),
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.SwapHoriz, contentDescription = null, tint = Tokens.Soft, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(7.dp))
                Text("Mover", color = Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            if (canDelete) {
                Spacer(Modifier.width(10.dp))
                Box(
                    modifier = Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).background(Tokens.Red.copy(alpha = 0.12f))
                        .border(1.dp, Tokens.Red.copy(alpha = 0.35f), RoundedCornerShape(12.dp)).clickable { onDelete() },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.DeleteOutline, contentDescription = "Excluir", tint = Tokens.Red, modifier = Modifier.size(19.dp))
                }
            }
        }
    }
}
