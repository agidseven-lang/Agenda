package br.com.idseven.agenda.features.tasks

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
import br.com.idseven.agenda.core.itemsOrEmpty
import br.com.idseven.agenda.designsystem.components.Avatar
import br.com.idseven.agenda.designsystem.theme.Tokens
import br.com.idseven.agenda.domain.TaskItem
import br.com.idseven.agenda.domain.UserColor
import br.com.idseven.agenda.domain.UserLite

// ADITIVO — Visão ADMIN "Quadros por responsável": cada pessoa em um quadro próprio e isolado.
// Não altera a visibilidade de ninguém: apenas oferece ao admin um índice por responsável.
@Composable
fun RoleBoardsScreen(
    tasksState: UiList<TaskItem>,
    users: List<UserLite>,
    onOpenPerson: (String) -> Unit,
    onBack: () -> Unit,
) {
    val tasks = tasksState.itemsOrEmpty()
    val people = users
        .filter { it.isActive() }
        .sortedBy { (it.name ?: "").lowercase() }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = 16.dp, end = 16.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text("Quadros por responsável", color = Tokens.Ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Cada pessoa em um quadro isolado — sem misturar", color = Tokens.Faint, fontSize = 11.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        LazyColumn(Modifier.fillMaxWidth().padding(horizontal = 16.dp), contentPadding = PaddingValues(top = 6.dp, bottom = 24.dp)) {
            items(people, key = { it.id }) { u ->
                val mine = tasks.filter { it.assigneeId == u.id || it.by == u.id }
                val open = mine.count { (it.status ?: "afazer") != "concluido" }
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(15.dp))
                        .background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(15.dp))
                        .clickable { onOpenPerson(u.id) }.padding(13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(u.photo, UserColor.of(u.id, u.color), u.name, 44.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(u.name ?: "—", color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(u.role?.ifBlank { null } ?: "Equipe", color = Tokens.Soft, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Accent.copy(alpha = 0.16f)).padding(horizontal = 11.dp, vertical = 5.dp)) {
                        Text("$open aberta${if (open == 1) "" else "s"}", color = Tokens.Accent, fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}
