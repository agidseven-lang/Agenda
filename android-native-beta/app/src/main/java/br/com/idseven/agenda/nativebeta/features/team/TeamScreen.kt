package br.com.idseven.agenda.nativebeta.features.team

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.UiList
import br.com.idseven.agenda.nativebeta.core.isLoading
import br.com.idseven.agenda.nativebeta.core.itemsOrEmpty
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.components.EmptyState
import br.com.idseven.agenda.nativebeta.designsystem.components.LoadingState
import br.com.idseven.agenda.nativebeta.designsystem.components.Pill
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite

@Composable
fun TeamScreen(usersState: UiList<UserLite>) {
    if (usersState.isLoading) { LoadingState(); return }
    val users = usersState.itemsOrEmpty().filter { it.isActive() }.sortedBy { (it.name ?: "").lowercase() }
    if (users.isEmpty()) {
        EmptyState("Sem membros ativos", "A equipe aparece aqui em tempo real", Icons.Outlined.Group)
        return
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 18.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 24.dp),
    ) {
        items(users, key = { it.id }) { u -> TeamRow(u) }
    }
}

@Composable
private fun TeamRow(u: UserLite) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
            .clip(RoundedCornerShape(14.dp)).background(Tokens.Surface)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(u.photo, UserColor.of(u.id, u.color), u.name, 44.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(u.name ?: "—", color = Tokens.Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            if (!u.role.isNullOrBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(u.role, color = Tokens.Soft, fontSize = 12.5.sp)
            }
        }
        if (u.admin) Pill("Admin", Tokens.Accent)
    }
}
