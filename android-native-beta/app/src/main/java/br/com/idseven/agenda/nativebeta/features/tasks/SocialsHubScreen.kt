package br.com.idseven.agenda.nativebeta.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.components.EmptyState
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.TaskDeadline
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite

// "Social Medias": cada Social Media em um quadro próprio. Admin/Social monitoram cada uma,
// em tempo real. A tarefa enviada ao designer CONTINUA no quadro da Social dona (socialOwnerId).
@Composable
fun SocialsHubScreen(
    tasksState: UiList<TaskItem>,
    users: List<UserLite>,
    onOpenSocial: (String) -> Unit,
    onBack: () -> Unit,
    tabsBar: @Composable () -> Unit = {},
) {
    val tasks = tasksState.itemsOrEmpty()
    val counts = TaskVisibility.socialsWithFlow(tasks, users)
    val cyan = Color(0xFF22D3EE)
    val socials = counts.keys
        .map { id -> users.firstOrNull { it.id == id } to id }
        .sortedBy { (u, id) -> (u?.name ?: id).lowercase() }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        // 1.0.94 — título PRIMEIRO; chips ABAIXO do título (nunca acima / nunca soltos no topo).
        Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = 8.dp, end = 16.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(10.dp))
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(cyan.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Outlined.Group, contentDescription = null, tint = cyan, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Social Medias", color = Tokens.Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Cada Social Media em um quadro próprio — sem misturar", color = Tokens.Faint, fontSize = 11.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        // 1.0.96 — HUB (lista de social medias) NÃO mostra chips; eles pertencem ao Kanban.
        if (socials.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                EmptyState("Nenhuma Social Media ativa", "Cadastre Social Medias na equipe", Icons.Outlined.Group)
            }
            return
        }
        LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 16.dp), contentPadding = PaddingValues(top = 6.dp, bottom = 24.dp)) {
            items(socials, key = { it.second }) { (u, id) ->
                val mine = tasks.filter { TaskVisibility.socialOf(it, users) == id }
                val open = mine.count { TaskVisibility.operationalCol(it) != "concluido" }
                val withDesigner = mine.count { val oc = TaskVisibility.operationalCol(it); oc == "aguardando_designer" || oc == "aguardando_designer_iniciar" }
                val late = mine.count { TaskDeadline.of(it)?.late == true }
                val nm = u?.name ?: "Social Media"
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(15.dp))
                        .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(15.dp))
                        .clickable { onOpenSocial(id) }.padding(13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(u?.photo, UserColor.of(id, u?.color), nm, 44.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(nm, color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(u?.role?.ifBlank { null } ?: "Social Media", color = Tokens.Soft, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Spacer(Modifier.size(7.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.clip(RoundedCornerShape(999.dp)).background(cyan.copy(alpha = 0.16f)).padding(horizontal = 9.dp, vertical = 3.dp)) {
                                Text("$open aberta${if (open == 1) "" else "s"}", color = cyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            if (withDesigner > 0) {
                                Spacer(Modifier.width(8.dp))
                                Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Color(0xFFA78BFA).copy(alpha = 0.16f)).padding(horizontal = 9.dp, vertical = 3.dp)) {
                                    Text("$withDesigner c/ designer", color = Color(0xFFA78BFA), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            if (late > 0) {
                                Spacer(Modifier.width(8.dp))
                                Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Red.copy(alpha = 0.16f)).padding(horizontal = 9.dp, vertical = 3.dp)) {
                                    Text("$late em atraso", color = Tokens.Red, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}
