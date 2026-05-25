package br.com.idseven.agenda.nativebeta.features.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.designsystem.components.Avatar
import br.com.idseven.agenda.nativebeta.designsystem.components.Pill
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.UserColor
import br.com.idseven.agenda.nativebeta.domain.UserLite

@Composable
fun ProfileScreen(currentUser: UserLite?, session: UserSession, onLogout: () -> Unit) {
    val name = currentUser?.name ?: session.name
    val color = UserColor.of(currentUser?.id ?: session.uid, currentUser?.color)
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))
        Avatar(currentUser?.photo, color, name, 96.dp, ring = 3.dp)
        Spacer(Modifier.height(16.dp))
        Text(name.ifBlank { "Usuário" }, color = Tokens.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        if (!currentUser?.role.isNullOrBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(currentUser!!.role!!, color = Tokens.Soft, fontSize = 14.sp)
        }
        Spacer(Modifier.height(10.dp))
        if (currentUser?.admin == true) Pill("Administrador", Tokens.Accent) else Pill("Membro", Tokens.Green)

        Spacer(Modifier.height(40.dp))
        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().height(50.dp),
            shape = RoundedCornerShape(14.dp),
        ) { Text("Sair", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold) }

        Spacer(Modifier.height(1.dp).weight(1f))
        Text("build: 1.0.0-beta", color = Tokens.Faint, fontSize = 11.sp)
    }
}
