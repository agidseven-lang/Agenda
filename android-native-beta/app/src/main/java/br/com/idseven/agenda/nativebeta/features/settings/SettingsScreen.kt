package br.com.idseven.agenda.nativebeta.features.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.ColorLens
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Speed
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.idseven.agenda.nativebeta.core.Notifications
import br.com.idseven.agenda.nativebeta.data.SettingsStore
import br.com.idseven.agenda.nativebeta.designsystem.theme.Tokens
import br.com.idseven.agenda.nativebeta.domain.UserLite
import java.io.File

// Menu Configurações premium. Ações REAIS onde seguro; o que não está pronto vira "Em breve"
// (sem botão morto). Aditivo: não toca login, push/cron, backend, schema.
@Composable
fun SettingsScreen(currentUser: UserLite?, onLogout: () -> Unit, onBack: () -> Unit) {
    val ctx = LocalContext.current
    var reminders by remember { mutableStateOf(SettingsStore.remindersEnabled(ctx)) }
    var cacheLabel by remember { mutableStateOf(dirSizeLabel(ctx.cacheDir)) }

    Column(Modifier.fillMaxSize().background(Tokens.Bg)) {
        Row(Modifier.fillMaxWidth().padding(start = 12.dp, top = 16.dp, end = 16.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(Tokens.Surface).border(1.dp, Tokens.Line, RoundedCornerShape(11.dp)).clickable { onBack() }, contentAlignment = Alignment.Center) {
                Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "Voltar", tint = Tokens.Soft, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(10.dp))
            Text("Configurações", color = Tokens.Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        }

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 28.dp)) {

            Section("Gerenciamento de Conta", Icons.Outlined.Person) {
                Item("Perfil e dados pessoais", currentUser?.name ?: "—")
                Soon("Atualizar dados pessoais")
                Soon("Assinatura / plano")
                ActionRow("Sair da conta", "Encerrar a sessão neste aparelho", Tokens.Red, Icons.Outlined.Logout) { onLogout() }
            }

            Section("Privacidade e Segurança", Icons.Outlined.Lock) {
                Soon("Autenticação em duas etapas (2FA)")
                Soon("Sessões e dispositivos conectados")
                Item("Dados coletados", "Apenas dados de uso da equipe (tarefas/agenda)")
            }

            Section("Preferências de Notificação", Icons.Outlined.Notifications) {
                ActionRow("Permitir notificações", "Abrir as configurações do sistema") { Notifications.openNotificationSettings(ctx) }
                ToggleRow("Lembretes locais", "Aviso 1h antes do compromisso", reminders) {
                    reminders = it; SettingsStore.setBool(ctx, SettingsStore.K_REMINDERS, it)
                }
                Soon("Notificações de tarefas")
                Soon("Notificações de chat")
                Soon("Apenas avisos dentro do app")
            }

            Section("Acessibilidade e Aparência", Icons.Outlined.ColorLens) {
                Item("Tema", "Escuro (premium)")
                Soon("Tema claro")
                Soon("Tamanho da fonte")
                Soon("Alto contraste")
            }

            Section("Desempenho e Dados", Icons.Outlined.Speed) {
                ActionRow("Limpar cache", "Em uso: $cacheLabel", trailing = Icons.Outlined.CleaningServices) {
                    runCatching { ctx.cacheDir.listFiles()?.forEach { it.deleteRecursively() } }
                    cacheLabel = dirSizeLabel(ctx.cacheDir)
                }
                Item("Uso de armazenamento (cache)", cacheLabel, Icons.Outlined.Storage)
                Soon("Otimizar uso de dados")
            }

            Section("Idioma e Região", Icons.Outlined.Language) {
                Item("Idioma", "Português (Brasil)")
                Item("Formato de data", "dd/MM/aaaa")
                Item("Formato de hora", "24h")
                Soon("Outros idiomas e moeda")
            }
        }
    }
}

private fun dirSizeLabel(dir: File): String {
    val bytes = runCatching { dir.walkBottomUp().filter { it.isFile }.map { it.length() }.sum() }.getOrDefault(0L)
    return when {
        bytes <= 0 -> "0 KB"
        bytes < 1024 * 1024 -> "${(bytes / 1024).coerceAtLeast(1)} KB"
        else -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
    }
}

@Composable
private fun Section(title: String, icon: ImageVector, content: @Composable () -> Unit) {
    Spacer(Modifier.height(18.dp))
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp, start = 2.dp)) {
        Icon(icon, contentDescription = null, tint = Tokens.Accent, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(title, color = Tokens.Soft, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Tokens.Surface)
            .border(1.dp, Tokens.Line, RoundedCornerShape(16.dp)),
    ) { content() }
}

@Composable
private fun Item(title: String, value: String, icon: ImageVector? = null) {
    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Medium)
            Text(value, color = Tokens.Faint, fontSize = 12.sp)
        }
        if (icon != null) Icon(icon, contentDescription = null, tint = Tokens.Faint, modifier = Modifier.size(18.dp))
    }
    Divider()
}

@Composable
private fun ActionRow(title: String, subtitle: String, color: Color = Tokens.Ink, trailing: ImageVector = Icons.Filled.KeyboardArrowRight, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onClick() }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = color, fontSize = 14.5.sp, fontWeight = FontWeight.Bold)
            Text(subtitle, color = Tokens.Faint, fontSize = 12.sp)
        }
        Icon(trailing, null, tint = if (color == Tokens.Red) Tokens.Red else Tokens.Soft, modifier = Modifier.size(18.dp))
    }
    Divider()
}

@Composable
private fun ToggleRow(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 8.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Tokens.Ink, fontSize = 14.5.sp, fontWeight = FontWeight.Medium)
            Text(subtitle, color = Tokens.Faint, fontSize = 12.sp)
        }
        Switch(
            checked = checked, onCheckedChange = onChange,
            colors = SwitchDefaults.colors(checkedTrackColor = Tokens.Accent, checkedThumbColor = Color.White),
        )
    }
    Divider()
}

@Composable
private fun Soon(title: String) {
    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Tokens.Soft, fontSize = 14.5.sp, modifier = Modifier.weight(1f))
        Box(Modifier.clip(RoundedCornerShape(999.dp)).background(Tokens.Surface2).border(1.dp, Tokens.Line, RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 4.dp)) {
            Text("Em breve", color = Tokens.Faint, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
        }
    }
    Divider()
}

@Composable
private fun Divider() {
    Box(Modifier.fillMaxWidth().height(1.dp).background(Tokens.Line.copy(alpha = 0.5f)))
}
