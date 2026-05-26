package br.com.idseven.agenda.nativebeta.features.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import br.com.idseven.agenda.nativebeta.core.Notifications
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

private const val BUILD = "1.0.10-beta-chat-settings-pro"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(currentUser: UserLite?, session: UserSession, onLogout: () -> Unit) {
    val name = (currentUser?.name ?: session.name).ifBlank { "Usuário" }
    val color = UserColor.of(currentUser?.id ?: session.uid, currentUser?.color)
    val context = LocalContext.current
    var sheet by remember { mutableStateOf<String?>(null) }

    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(18.dp))
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
        // Configurações
        SectionLabel("Configurações")
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(16.dp))) {
            SettingsRow(Icons.Outlined.Person, "Conta", "Seus dados") { sheet = "conta" }
            RowDivider()
            SettingsRow(Icons.Outlined.Notifications, "Notificações", "Lembretes e avisos") { sheet = "notif" }
            RowDivider()
            SettingsRow(Icons.Outlined.DarkMode, "Aparência", "Tema escuro") { sheet = "aparencia" }
            RowDivider()
            SettingsRow(Icons.Outlined.Lock, "Segurança", "Sessão e acesso") { sheet = "seguranca" }
            RowDivider()
            SettingsRow(Icons.Outlined.Info, "Sobre o aplicativo", "Versão $BUILD") { sheet = "sobre" }
        }

        Spacer(Modifier.height(20.dp))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(14.dp)) {
            Text("Sair da conta", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(14.dp))
        Text("ID Seven Nativo · build $BUILD", color = Tokens.Faint, fontSize = 11.sp, textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))
    }

    if (sheet != null) {
        ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = Tokens.Surface) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 6.dp)) {
                when (sheet) {
                    "conta" -> {
                        SheetTitle("Conta")
                        InfoLine("Nome", name)
                        currentUser?.role?.takeIf { it.isNotBlank() }?.let { InfoLine("Função", it) }
                        currentUser?.email?.takeIf { it.isNotBlank() }?.let { InfoLine("E-mail", it) }
                        currentUser?.phone?.takeIf { it.isNotBlank() }?.let { InfoLine("WhatsApp", it) }
                        InfoLine("Status", "Ativa")
                        InfoLine("Permissão", if (currentUser?.admin == true) "Administrador" else "Membro")
                        InfoLine("ID", session.uid)
                    }
                    "notif" -> {
                        SheetTitle("Notificações")
                        val notifOk = Notifications.hasPostPermission(context)
                        val hasToken = context.getSharedPreferences("fcm", android.content.Context.MODE_PRIVATE).getString("token", null) != null
                        InfoLine("Permissão", if (notifOk) "Permitidas" else "Pendentes")
                        InfoLine("Token FCM", if (hasToken) "Registrado" else "Não registrado")
                        InfoLine("Lembretes", "Locais (AlarmManager)")
                        Spacer(Modifier.height(8.dp))
                        SheetText("Push remoto depende do envio pelo backend. As notificações ainda estão em fase de teste real.")
                    }
                    "aparencia" -> {
                        SheetTitle("Aparência")
                        InfoLine("Tema", "Escuro")
                        Spacer(Modifier.height(8.dp))
                        SheetText("Tema escuro padrão. Troca de tema (claro/automático) chega em uma próxima versão, sem afetar os dados.")
                    }
                    "seguranca" -> {
                        SheetTitle("Segurança")
                        InfoLine("Sessão", "Ativa neste aparelho")
                        InfoLine("Login", "Custom (hash s2 / SHA-256)")
                        InfoLine("ID da sessão", session.uid)
                        Spacer(Modifier.height(8.dp))
                        SheetText("Sem Firebase Auth — mesmo modelo do PWA. Para encerrar a sessão use \"Sair da conta\".")
                    }
                    "sobre" -> {
                        SheetTitle("Sobre o aplicativo")
                        InfoLine("App", "ID Seven Nativo Beta")
                        InfoLine("Build", BUILD)
                        InfoLine("Ambiente", "Beta interno")
                        InfoLine("Package", context.packageName)
                        InfoLine("Tecnologia", "Kotlin + Compose")
                        Spacer(Modifier.height(8.dp))
                        SheetText("O PWA atual segue intacto e funcionando normalmente.")
                    }
                }
                Spacer(Modifier.height(18.dp))
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text.uppercase(), color = Tokens.Faint, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp, start = 4.dp))
}

@Composable
private fun SettingsRow(icon: ImageVector, label: String, sub: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onClick() }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface2), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(13.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
            Text(sub, color = Tokens.Faint, fontSize = 12.sp)
        }
        Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(22.dp))
    }
}

@Composable
private fun RowDivider() {
    Box(Modifier.fillMaxWidth().padding(start = 65.dp).height(1.dp).background(Color(0xFF222633)))
}

@Composable
private fun SheetTitle(text: String) {
    Text(text, color = Tokens.Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 10.dp))
}

@Composable
private fun SheetText(text: String) {
    Text(text, color = Tokens.Soft, fontSize = 13.5.sp, lineHeight = 19.sp)
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(label, color = Tokens.Faint, fontSize = 13.sp, modifier = Modifier.width(110.dp))
        Text(value, color = Tokens.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
    }
}
