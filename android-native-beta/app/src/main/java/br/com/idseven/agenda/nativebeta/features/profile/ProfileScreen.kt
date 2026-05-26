package br.com.idseven.agenda.nativebeta.features.profile

import android.widget.Toast
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
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material3.rememberModalBottomSheetState
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
import br.com.idseven.agenda.nativebeta.shared.DateUtil

private const val BUILD = "1.0.11-beta-settings-emoji-fix"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(currentUser: UserLite?, session: UserSession, onLogout: () -> Unit) {
    val name = (currentUser?.name ?: session.name).ifBlank { "Usuário" }
    val color = UserColor.of(currentUser?.id ?: session.uid, currentUser?.color)
    val context = LocalContext.current
    var sheet by remember { mutableStateOf<String?>(null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
        ModalBottomSheet(onDismissRequest = { sheet = null }, sheetState = sheetState, containerColor = Tokens.Surface) {
            Column(Modifier.fillMaxWidth().heightIn(min = 160.dp).padding(horizontal = 22.dp).padding(bottom = 28.dp)) {
                when (sheet) {
                    "conta" -> {
                        SheetTitle("Conta")
                        InfoLine("Nome", name)
                        InfoLine("Função", currentUser?.role?.takeIf { it.isNotBlank() } ?: "—")
                        InfoLine("E-mail", currentUser?.email?.takeIf { it.isNotBlank() } ?: "—")
                        InfoLine("WhatsApp", currentUser?.phone?.takeIf { it.isNotBlank() } ?: "—")
                        InfoLine("Status", "Ativa")
                        InfoLine("Permissão", if (currentUser?.admin == true) "Administrador" else "Membro da equipe")
                        InfoLine("ID do usuário", session.uid)
                        currentUser?.createdAt?.takeIf { it > 0 }?.let { InfoLine("Criada em", DateUtil.fmtMs(it)) }
                        Spacer(Modifier.height(14.dp))
                        SheetButton("Editar conta", hint = "em breve", enabled = false) {}
                    }
                    "notif" -> {
                        SheetTitle("Notificações")
                        val notifOk = Notifications.hasPostPermission(context)
                        val hasToken = context.getSharedPreferences("fcm", android.content.Context.MODE_PRIVATE).getString("token", null) != null
                        InfoLine("Permissão", if (notifOk) "Permitidas" else "Pendentes")
                        InfoLine("Token FCM", if (hasToken) "Registrado" else "Não registrado")
                        InfoLine("Lembretes locais", "Ativos (AlarmManager)")
                        Spacer(Modifier.height(10.dp))
                        SheetText("Notificações reais ainda precisam de validação em aparelho. O push remoto depende do envio pelo backend.")
                        Spacer(Modifier.height(14.dp))
                        SheetButton("Testar notificação local", hint = if (notifOk) null else "permissão pendente", enabled = notifOk) {
                            Notifications.notify(context, 9001, Notifications.CH_GENERAL, "Teste de notificação", "Se você está vendo isto, as notificações locais funcionam.")
                            Toast.makeText(context, "Notificação enviada", Toast.LENGTH_SHORT).show()
                        }
                        Spacer(Modifier.height(8.dp))
                        SheetButton("Configurar notificações", hint = "em breve", enabled = false) {}
                    }
                    "aparencia" -> {
                        SheetTitle("Aparência")
                        InfoLine("Tema", "Escuro")
                        InfoLine("Modo escuro", "Ativo")
                        InfoLine("Identidade", "ID Seven")
                        Spacer(Modifier.height(10.dp))
                        SheetText("Tema escuro padrão, alinhado à identidade visual da ID Seven. A troca de tema (claro/automático) chega em uma próxima versão, sem afetar os dados.")
                        Spacer(Modifier.height(14.dp))
                        SheetButton("Trocar tema", hint = "em breve", enabled = false) {}
                    }
                    "seguranca" -> {
                        SheetTitle("Segurança")
                        InfoLine("Sessão", "Ativa neste aparelho")
                        InfoLine("Login", "Custom (hash s2 / SHA-256)")
                        InfoLine("UID", session.uid)
                        InfoLine("Sessão salva", "Local (DataStore)")
                        Spacer(Modifier.height(10.dp))
                        SheetText("Sem Firebase Auth — mesmo modelo do PWA. A sessão fica salva localmente via DataStore. Senha, hash e salt nunca são exibidos.")
                        Spacer(Modifier.height(14.dp))
                        SheetButton("Sair da conta", danger = true) { sheet = null; onLogout() }
                    }
                    "sobre" -> {
                        SheetTitle("Sobre o aplicativo")
                        InfoLine("App", "ID Seven Nativo Beta")
                        InfoLine("Build", BUILD)
                        InfoLine("Package", context.packageName)
                        InfoLine("Ambiente", "Beta interno")
                        InfoLine("Tecnologia", "Kotlin + Compose")
                        Spacer(Modifier.height(10.dp))
                        SheetText("O PWA atual permanece intacto e funcionando normalmente. Feito pela equipe ID Seven.")
                    }
                }
            }
        }
    }
}

@Composable
private fun SheetButton(label: String, hint: String? = null, enabled: Boolean = true, danger: Boolean = false, onClick: () -> Unit) {
    val tint = when {
        danger -> MaterialTheme.colorScheme.error
        enabled -> Tokens.Accent
        else -> Tokens.Faint
    }
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Tokens.Surface2)
            .then(if (enabled) Modifier.clickable { onClick() } else Modifier)
            .padding(horizontal = 15.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = tint, fontSize = 14.5.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        if (hint != null) Text(hint, color = Tokens.Faint, fontSize = 12.sp)
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
