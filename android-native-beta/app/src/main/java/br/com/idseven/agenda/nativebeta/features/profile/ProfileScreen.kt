package br.com.idseven.agenda.nativebeta.features.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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
    val name = (currentUser?.name ?: session.name).ifBlank { "Usuário" }
    val color = UserColor.of(currentUser?.id ?: session.uid, currentUser?.color)

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(20.dp))
        // Card de perfil
        Column(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(20.dp)).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Avatar(currentUser?.photo, color, name, 92.dp, ring = 3.dp)
            Spacer(Modifier.height(14.dp))
            Text(name, color = Tokens.Ink, fontSize = 21.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            if (!currentUser?.role.isNullOrBlank()) {
                Spacer(Modifier.height(3.dp))
                Text(currentUser!!.role!!, color = Tokens.Soft, fontSize = 14.sp)
            }
            Spacer(Modifier.height(12.dp))
            if (currentUser?.admin == true) Pill("Administrador", Tokens.Accent) else Pill("Membro da equipe", Tokens.Green)
        }

        Spacer(Modifier.height(16.dp))
        // Infos da conta
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)).padding(16.dp)) {
            InfoRow("Conta", "Ativa")
            Divider()
            InfoRow("Permissão", if (currentUser?.admin == true) "Administrador" else "Membro")
            if (!currentUser?.role.isNullOrBlank()) { Divider(); InfoRow("Função", currentUser!!.role!!) }
        }

        Spacer(Modifier.weight(1f))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp)) {
            Text("Sair da conta", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(14.dp))
        Text("ID Seven Nativo · build 1.0.8-beta-modules-polish", color = Tokens.Faint, fontSize = 11.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(14.dp))
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
        Text(label, color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(value, color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun Divider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0xFF222633)))
}
