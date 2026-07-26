package br.com.idseven.agenda.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.core.UiList
import br.com.idseven.agenda.core.errorMessage
import br.com.idseven.agenda.core.isLoading
import br.com.idseven.agenda.core.itemsOrEmpty
import br.com.idseven.agenda.designsystem.components.ErrorState
import br.com.idseven.agenda.designsystem.components.SkeletonList
import br.com.idseven.agenda.designsystem.theme.Tokens
import br.com.idseven.agenda.domain.Sectors
import br.com.idseven.agenda.domain.TaskDeadline
import br.com.idseven.agenda.domain.TaskItem
import br.com.idseven.agenda.domain.UserLite

// Hub de QUADROS por setor (Fase A). Lista os setores como cards SaaS; cada card mostra
// total de tarefas e quantas estão em atraso. Toque abre o quadro Kanban daquele setor.
// Fase B: contadores respeitam a VISIBILIDADE por função (admin/social veem tudo;
// operacional vê só as próprias). Filtro client-side (sem schema/Rules).
@Composable
fun BoardsHubScreen(
    tasksState: UiList<TaskItem>,
    currentUser: UserLite?,
    users: List<UserLite> = emptyList(),  // para contar Social Medias por cargo
    onOpenSector: (String) -> Unit,
    onOpenRoleBoards: () -> Unit = {},   // ADITIVO: admin -> "Quadros por responsável"
    onOpenMyBoard: () -> Unit = {},      // ADITIVO: "Meu quadro / Minhas demandas"
    onOpenClientFlow: () -> Unit = {},   // P3: Social/Admin -> "Cliente"
    onOpenDesignersFlow: () -> Unit = {}, // P4: Social/Admin -> "Designers"
    onOpenSocialsFlow: () -> Unit = {},  // Social/Admin -> "Social Medias"
    tabsBar: @Composable () -> Unit = {}, // abas superiores (Meu quadro/Cliente/Designers/Setores)
) {
    tasksState.errorMessage()?.let { ErrorState("Quadros — $it"); return }
    if (tasksState.isLoading) { SkeletonList(); return }
    val all = TaskVisibility.visibleTasks(currentUser, tasksState.itemsOrEmpty())
    val isAdmin = TaskVisibility.roleCategory(currentUser) == TaskVisibility.Cat.ADMIN
    val seeAll = TaskVisibility.canSeeAllBoards(currentUser)  // admin + social/gestão
    val uid = currentUser?.id
    val myOpen = if (uid != null) tasksState.itemsOrEmpty().count {
        (it.assigneeId == uid || it.by == uid) && (it.status ?: "afazer") != "concluido"
    } else 0
    // P3/P4 — contadores dos fluxos (Social/Admin).
    val clientOpen = all.count { TaskVisibility.isClientFlow(it) && TaskVisibility.clientCol(it) != "concluido" }
    val designersCount = TaskVisibility.designersWithFlow(all).size
    val socialsCount = TaskVisibility.socialUsers(users).size
    val designersLate = all.count { TaskVisibility.isDesignerFlow(it) && TaskDeadline.of(it)?.late == true }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        // 1.0.94 — título PRIMEIRO; os chips vêm ABAIXO do título (nunca acima / nunca soltos no topo).
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, top = 10.dp, end = 18.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Quadros", color = Tokens.Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text("Gestão por setor da agência", color = Tokens.Faint, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
            }
            Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(999.dp)).padding(horizontal = 12.dp, vertical = 6.dp)) {
                Text("${all.size} tarefas", color = Tokens.Soft, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        // 1.0.96 — HUB "Quadros" NÃO mostra chips; eles pertencem ao Kanban (TasksScreen).
        LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp)) {
            // ADITIVO — "Meu quadro" (todos: minhas demandas/tarefas) — não remove a visão ampla.
            if (uid != null) {
                item {
                    BoardCard(
                        label = "Meu quadro", desc = "Minhas demandas e tarefas", color = Tokens.Accent,
                        icon = Icons.Outlined.Dashboard, total = myOpen, late = 0, onClick = onOpenMyBoard,
                    )
                    Spacer(Modifier.size(12.dp))
                }
            }
            // P3 — Social/Admin: "Fluxo do Cliente" (relacionamento, sem misturar com designer).
            if (seeAll) {
                item {
                    BoardCard(
                        label = "Cliente", desc = "Fica no fluxo do cliente até a aprovação final (mesmo no designer)",
                        color = androidx.compose.ui.graphics.Color(0xFF22D3B8),
                        icon = Icons.Outlined.Visibility, total = clientOpen, late = 0,
                        totalSuffix = "aberta", onClick = onOpenClientFlow,
                    )
                    Spacer(Modifier.size(12.dp))
                }
                // P4 — Social/Admin: "Designers" (um quadro Kanban por designer).
                item {
                    BoardCard(
                        label = "Designers", desc = "Um quadro Kanban por designer — monitore cada um",
                        color = androidx.compose.ui.graphics.Color(0xFFA78BFA),
                        icon = Icons.Outlined.Groups, total = designersCount, late = designersLate,
                        totalSuffix = "designer", onClick = onOpenDesignersFlow,
                    )
                    Spacer(Modifier.size(12.dp))
                }
                // Social/Admin: "Social Medias" (um quadro Kanban por Social Media).
                item {
                    BoardCard(
                        label = "Social Medias", desc = "Cada Social Media em um quadro próprio — sem misturar",
                        color = androidx.compose.ui.graphics.Color(0xFF22D3EE),
                        icon = Icons.Outlined.Groups, total = socialsCount, late = 0,
                        totalSuffix = "social", onClick = onOpenSocialsFlow,
                    )
                    Spacer(Modifier.size(12.dp))
                }
            }
            // ADITIVO — Admin: índice de "Quadros por responsável" (cada pessoa isolada).
            if (isAdmin) {
                item {
                    BoardCard(
                        label = "Quadros por responsável", desc = "Cada designer/social em um quadro isolado",
                        color = androidx.compose.ui.graphics.Color(0xFFA78BFA),
                        icon = Icons.Outlined.Groups, total = 0, late = 0, onClick = onOpenRoleBoards,
                    )
                    Spacer(Modifier.size(12.dp))
                }
            }
            items(Sectors.ALL, key = { it.key }) { s ->
                val list = all.filter { Sectors.of(it.sector).key == s.key }
                val total = list.size
                val late = list.count { TaskDeadline.of(it)?.late == true }
                BoardCard(
                    label = s.label, desc = s.desc, color = s.color, icon = s.icon,
                    total = total, late = late, onClick = { onOpenSector(s.key) },
                )
                Spacer(Modifier.size(12.dp))
            }
        }
    }
}

@Composable
private fun BoardCard(
    label: String, desc: String, color: androidx.compose.ui.graphics.Color, icon: androidx.compose.ui.graphics.vector.ImageVector,
    total: Int, late: Int, onClick: () -> Unit,
    totalSuffix: String = "tarefas",   // pluraliza automaticamente quando != "tarefas"
) {
    val totalLabel = when (totalSuffix) {
        "tarefas" -> "$total tarefas"
        else -> "$total $totalSuffix${if (total == 1) "" else "s"}"
    }
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface)
            .border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)).clickable { onClick() }.padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(46.dp).clip(RoundedCornerShape(13.dp)).background(color.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
        }
        Spacer(Modifier.size(14.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = Tokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(desc, color = Tokens.Faint, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.size(7.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.clip(RoundedCornerShape(999.dp)).background(color.copy(alpha = 0.16f)).padding(horizontal = 9.dp, vertical = 3.dp)) {
                    Text(totalLabel, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                if (late > 0) {
                    Spacer(Modifier.size(8.dp))
                    Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Red.copy(alpha = 0.16f)).padding(horizontal = 9.dp, vertical = 3.dp)) {
                        Text("$late em atraso", color = Tokens.Red, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(24.dp))
    }
}
