package br.com.idseven.agenda.nativebeta.features.tasks

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
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.errorMessage
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.designsystem.components.ErrorState
import br.com.idseven.agenda.nativebeta.designsystem.components.SkeletonList
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.Sectors
import br.com.idseven.agenda.nativebeta.domain.TaskDeadline
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserLite

// Hub de QUADROS por setor (Fase A). Lista os setores como cards SaaS; cada card mostra
// total de tarefas e quantas estão em atraso. Toque abre o quadro Kanban daquele setor.
// Fase B: contadores respeitam a VISIBILIDADE por função (admin/social veem tudo;
// operacional vê só as próprias). Filtro client-side (sem schema/Rules).
@Composable
fun BoardsHubScreen(
    tasksState: UiList<TaskItem>,
    currentUser: UserLite?,
    onOpenSector: (String) -> Unit,
) {
    tasksState.errorMessage()?.let { ErrorState("Quadros — $it"); return }
    if (tasksState.isLoading) { SkeletonList(); return }
    val all = TaskVisibility.visibleTasks(currentUser, tasksState.itemsOrEmpty())
    // F3.3.73I1 — decisão do owner: setor DESCONTINUADO sai do fluxo visual do hub
    // (cards E contagem da pílula). NADA é apagado/migrado: as tarefas históricas
    // seguem no banco e Sectors.of()/alias continuam resolvendo-as em detalhe/edição.
    val shown = all.filter { !Sectors.of(it.sector).descontinuado }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, top = 16.dp, end = 18.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Quadros", color = Tokens.Ink, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text("Gestão por setor da agência", color = Tokens.Faint, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
            }
            Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(999.dp)).padding(horizontal = 12.dp, vertical = 6.dp)) {
                Text("${shown.size} tarefas", color = Tokens.Soft, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp)) {
            items(Sectors.ALL.filter { !it.descontinuado }, key = { it.key }) { s ->
                val list = shown.filter { Sectors.of(it.sector).key == s.key }
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
) {
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
                    Text("$total tarefas", color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
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
