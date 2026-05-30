package br.com.idseven.agenda.nativebeta.features.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.idseven.agenda.nativebeta.designsystem.components.AppTextField
import br.com.idseven.agenda.nativebeta.designsystem.components.BrandHeader
import br.com.idseven.agenda.nativebeta.designsystem.components.MessageBanner
import br.com.idseven.agenda.nativebeta.designsystem.components.PasswordField
import br.com.idseven.agenda.nativebeta.designsystem.components.PrimaryButton

@Composable
fun LoginScreen(vm: LoginViewModel = viewModel()) {
    val ui by vm.ui.collectAsState()
    val loading = ui is AuthUi.Loading

    var register by remember { mutableStateOf(false) }
    var idOrPhone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPw by remember { mutableStateOf(false) }
    // cadastro
    var name by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var regPw by remember { mutableStateOf("") }

    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 26.dp, vertical = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            BrandHeader()
            Spacer(Modifier.height(28.dp))
            Text(
                if (register) "Criar conta" else "Entrar",
                color = MaterialTheme.colorScheme.onBackground, fontSize = 22.sp, fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                if (register) "Cadastre-se para a equipe da ID Seven" else "Acesse sua agenda e tarefas da equipe",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp,
            )
            Spacer(Modifier.height(20.dp))

            when (val s = ui) {
                is AuthUi.Error -> { MessageBanner(s.message, isError = true); Spacer(Modifier.height(14.dp)) }
                is AuthUi.Info -> { MessageBanner(s.message, isError = false); Spacer(Modifier.height(14.dp)) }
                else -> {}
            }

            if (!register) {
                AppTextField(idOrPhone, { idOrPhone = it }, "E-mail ou WhatsApp", keyboardType = KeyboardType.Email)
                Spacer(Modifier.height(12.dp))
                PasswordField(password, { password = it }, showPw, { showPw = !showPw })
                Spacer(Modifier.height(22.dp))
                PrimaryButton("Entrar", loading = loading) { vm.login(idOrPhone, password) }
                Spacer(Modifier.height(6.dp))
                TextButton(onClick = { register = true; vm.resetMessage() }) {
                    Text("Não tem conta? Criar conta", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                }
            } else {
                AppTextField(name, { name = it }, "Nome completo")
                Spacer(Modifier.height(12.dp))
                AppTextField(role, { role = it }, "Função (ex.: Social Media)")
                Spacer(Modifier.height(12.dp))
                AppTextField(phone, { phone = it }, "WhatsApp", keyboardType = KeyboardType.Phone)
                Spacer(Modifier.height(12.dp))
                AppTextField(email, { email = it }, "E-mail", keyboardType = KeyboardType.Email)
                Spacer(Modifier.height(12.dp))
                PasswordField(regPw, { regPw = it }, showPw, { showPw = !showPw })
                Spacer(Modifier.height(22.dp))
                PrimaryButton("Criar conta", loading = loading) { vm.register(name, role, phone, email, regPw) }
                Spacer(Modifier.height(6.dp))
                TextButton(onClick = { register = false; vm.resetMessage() }) {
                    Text("Já tenho conta? Entrar", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                }
            }

            Spacer(Modifier.height(28.dp))
            Text(
                "build: 1.0.26-beta-notification-detail-modal",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, textAlign = TextAlign.Center,
            )
        }
    }
}
