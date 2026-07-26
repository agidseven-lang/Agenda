package br.com.idseven.agenda.features.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.designsystem.theme.Tokens
import br.com.idseven.agenda.domain.UserLite

// 1.0.91 — Abas superiores em CHIPS PREMIUM COM ÍCONES: Meu quadro · Cliente · Designers ·
// Social Medias · Setores. Scroll horizontal elegante; estado ativo/inativo; paridade c/ Desktop.
// Cliente/Designers/Social Medias só para Social/Admin (canSeeAllBoards).
private fun tabIcon(key: String): ImageVector = when (key) {
    "mine" -> Icons.Outlined.Person
    "client" -> Icons.Outlined.Visibility
    "designers" -> Icons.Outlined.Image
    "socials" -> Icons.Outlined.Groups
    else -> Icons.Outlined.GridView
}

@Composable
fun TasksTopTabs(
    active: String,                     // "mine" | "client" | "designers" | "socials" | "sectors"
    currentUser: UserLite?,
    onMine: () -> Unit,
    onClient: () -> Unit,
    onDesigners: () -> Unit,
    onSocials: () -> Unit,
    onSectors: () -> Unit,
) {
    val see = TaskVisibility.canSeeAllBoards(currentUser)
    val tabs = buildList {
        add(Triple("mine", "Meu quadro", onMine))
        if (see) {
            add(Triple("client", "Cliente", onClient))
            add(Triple("designers", "Designers", onDesigners))
            add(Triple("socials", "Social Medias", onSocials))
        }
        add(Triple("sectors", "Setores", onSectors))
    }
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
            .padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        tabs.forEach { (key, label, onClick) ->
            val on = key == active
            // 1.0.95 — chips MENOS arredondados, no mesmo raio/borda do campo "Buscar tarefa…"
            // (SearchField = RoundedCornerShape(12.dp), borda Tokens.Line). Sem cápsula/pílula.
            Row(
                Modifier.clip(RoundedCornerShape(12.dp))
                    .background(if (on) Tokens.Accent else Tokens.Surface)
                    .border(1.dp, if (on) Tokens.Accent else Tokens.Line, RoundedCornerShape(12.dp))
                    .clickable { onClick() }.padding(horizontal = 12.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(7.dp),
            ) {
                Icon(tabIcon(key), contentDescription = null, tint = if (on) Color.White else Tokens.Soft, modifier = Modifier.size(15.dp))
                Text(label, color = if (on) Color.White else Tokens.Soft, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.width(4.dp))
    }
}
