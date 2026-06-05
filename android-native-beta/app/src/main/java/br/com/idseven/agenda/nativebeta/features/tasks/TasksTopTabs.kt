package br.com.idseven.agenda.nativebeta.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.UserLite

// Abas superiores da área de Tarefas: Meu quadro · Cliente · Designers · Setores.
// Cliente/Designers só para Social/Admin (canSeeAllBoards). Designer comum vê só Meu quadro.
@Composable
fun TasksTopTabs(
    active: String,                     // "mine" | "client" | "designers" | "sectors"
    currentUser: UserLite?,
    onMine: () -> Unit,
    onClient: () -> Unit,
    onDesigners: () -> Unit,
    onSectors: () -> Unit,
) {
    val see = TaskVisibility.canSeeAllBoards(currentUser)
    val tabs = buildList {
        add(Triple("mine", "Meu quadro", onMine))
        if (see) {
            add(Triple("client", "Cliente", onClient))
            add(Triple("designers", "Designers", onDesigners))
        }
        add(Triple("sectors", "Setores", onSectors))
    }
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
            .padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 4.dp),
    ) {
        tabs.forEach { (key, label, onClick) ->
            val on = key == active
            Row(
                Modifier.padding(end = 8.dp).clip(RoundedCornerShape(11.dp))
                    .background(if (on) Tokens.Accent else Tokens.Surface)
                    .border(1.dp, if (on) Color.Transparent else Tokens.Line, RoundedCornerShape(11.dp))
                    .clickable { onClick() }.padding(horizontal = 15.dp, vertical = 9.dp),
            ) {
                Text(label, color = if (on) Color.White else Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.width(4.dp))
    }
}
