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
import androidx.compose.runtime.LaunchedEffect
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

private enum class AuthMode { Login, Register, Forgot }

@Composable
fun LoginScreen(vm: LoginViewModel = viewModel()) {
    val ui by vm.ui.collectAsState()
    val pendingChange by vm.pendingChange.collectAsState()
    val forgotState by vm.forgot.collectAsState()
    val loading = ui is AuthUi.Loading

    var mode by remember { mutableStateOf(AuthMode.Login) }
    var idOrPhone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPw by remember { mutableStateOf(false) }
    // cadastro
    var name by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var regPw by remember { mutableStateOf("") }
    // forgot step 1
    var forgotEmail by remember { mutableStateOf("") }
    // forgot step 2
    var resetCode by remember { mutableStateOf("") }
    var resetPw by remember { mutableStateOf("") }
    var resetPw2 by remember { mutableStateOf("") }
    var showResetPw by remember { mutableStateOf(false) }
    // criar nova senha apos login com temporaria (fluxo legado mustChangePassword)
    var newPw by remember { mutableStateOf("") }
    var newPw2 by remember { mutableStateOf("") }
    var showNewPw by remember { mutableStateOf(false) }

    // Quando o reset conclui (estado Done), volta automaticamente para login apos
    // alguns instantes (o banner de sucesso permanece visivel).
    LaunchedEffect(forgotState) {
        if (forgotState is ForgotState.Done) {
            // limpa campos locais
            resetCode = ""; resetPw = ""; resetPw2 = ""
            mode = AuthMode.Login
            // o VM mantem AuthUi.Info ate o usuario interagir; aqui voltamos pro Login
            // mas NAO chamamos vm.resetForgot() ainda, para preservar o estado Done
            // como sinal de "acabou de redefinir" se a tela for recriada.
        }
    }

    val titleText: String
    val subtitleText: String
    when {
        pendingChange != null -> {
            titleText = "Criar nova senha"
            subtitleText = "Defina uma nova senha para continuar — você entrou com uma senha temporária."
        }
        mode == AuthMode.Forgot && forgotState is ForgotState.Step2Code -> {
            titleText = "Confirmar código"
            subtitleText = "Informe o código de 6 dígitos enviado para ${(forgotState as ForgotState.Step2Code).email} e crie uma nova senha."
        }
        mode == AuthMode.Forgot -> {
            titleText = "Redefinir senha"
            subtitleText = "Informe o e-mail cadastrado e enviaremos um código de 6 dígitos para você criar uma nova senha."
        }
        mode == AuthMode.Register -> {
            titleText = "Criar conta"; subtitleText = "Cadastre-se para a equipe da ID Seven"
        }
        else -> {
            titleText = "Entrar"; subtitleText = "Acesse sua agenda e tarefas da equipe"
        }
    }

    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 26.dp, vertical = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            BrandHeader()
            Spacer(Modifier.height(28.dp))
            Text(titleText, color = MaterialTheme.colorScheme.onBackground, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(
                subtitleText,
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(20.dp))

            when (val s = ui) {
                is AuthUi.Error -> { MessageBanner(s.message, isError = true); Spacer(Modifier.height(14.dp)) }
                is AuthUi.Info -> { MessageBanner(s.message, isError = false); Spacer(Modifier.height(14.dp)) }
                else -> {}
            }

            // 1) Criar nova senha LEGADO (apos login com senha temporaria — admin reset).
            if (pendingChange != null) {
                PasswordField(newPw, { newPw = it }, showNewPw, { showNewPw = !showNewPw }, label = "Nova senha")
                Spacer(Modifier.height(12.dp))
                PasswordField(newPw2, { newPw2 = it }, showNewPw, { showNewPw = !showNewPw }, label = "Confirmar nova senha")
                Spacer(Modifier.height(22.dp))
                PrimaryButton("Salvar nova senha", loading = loading) { vm.changePassword(newPw, newPw2) }
                Spacer(Modifier.height(6.dp))
                TextButton(onClick = {
                    vm.cancelChange()
                    newPw = ""; newPw2 = ""; password = ""
                }) {
                    Text("Cancelar e voltar ao login", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                }
            } else when (mode) {
                AuthMode.Login -> {
                    AppTextField(idOrPhone, { idOrPhone = it }, "E-mail ou WhatsApp", keyboardType = KeyboardType.Email)
                    Spacer(Modifier.height(12.dp))
                    PasswordField(password, { password = it }, showPw, { showPw = !showPw })
                    Spacer(Modifier.height(22.dp))
                    PrimaryButton("Entrar", loading = loading) { vm.login(idOrPhone, password) }
                    Spacer(Modifier.height(2.dp))
                    TextButton(onClick = {
                        // pre-preenche e-mail se o usuario digitou um e-mail no campo de login
                        forgotEmail = if (idOrPhone.contains("@")) idOrPhone.trim() else ""
                        vm.resetForgot()
                        mode = AuthMode.Forgot
                    }) {
                        Text("Esqueci minha senha", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                    TextButton(onClick = { mode = AuthMode.Register; vm.resetMessage() }) {
                        Text("Não tem conta? Criar conta", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    }
                }
                AuthMode.Register -> {
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
                    TextButton(onClick = { mode = AuthMode.Login; vm.resetMessage() }) {
                        Text("Já tenho conta? Entrar", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                    }
                }
                AuthMode.Forgot -> when (val fs = forgotState) {
                    is ForgotState.Step1Email -> {
                        AppTextField(forgotEmail, { forgotEmail = it }, "E-mail cadastrado", keyboardType = KeyboardType.Email)
                        Spacer(Modifier.height(22.dp))
                        PrimaryButton("Enviar código", loading = loading) { vm.requestReset(forgotEmail) }
                        Spacer(Modifier.height(6.dp))
                        TextButton(onClick = { mode = AuthMode.Login; vm.resetForgot() }) {
                            Text("Voltar ao login", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        }
                    }
                    is ForgotState.Step2Code -> {
                        AppTextField(resetCode, { if (it.length <= 6) resetCode = it.filter { ch -> ch.isDigit() } }, "Código de 6 dígitos", keyboardType = KeyboardType.Number)
                        Spacer(Modifier.height(12.dp))
                        PasswordField(resetPw, { resetPw = it }, showResetPw, { showResetPw = !showResetPw }, label = "Nova senha")
                        Spacer(Modifier.height(12.dp))
                        PasswordField(resetPw2, { resetPw2 = it }, showResetPw, { showResetPw = !showResetPw }, label = "Confirmar nova senha")
                        Spacer(Modifier.height(22.dp))
                        PrimaryButton("Criar nova senha", loading = loading) { vm.confirmReset(resetCode, resetPw, resetPw2) }
                        Spacer(Modifier.height(2.dp))
                        TextButton(onClick = { vm.requestReset(fs.email) }) {
                            Text("Reenviar código", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp)
                        }
                        TextButton(onClick = { mode = AuthMode.Login; vm.resetForgot() }) {
                            Text("Voltar ao login", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        }
                    }
                    is ForgotState.Done -> {
                        // Estado terminal antes do LaunchedEffect alternar para Login;
                        // nao mostra campos para evitar duplo submit.
                        TextButton(onClick = { mode = AuthMode.Login; vm.resetForgot() }) {
                            Text("Voltar ao login", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(28.dp))
            Text(
                "build: 1.0.41-beta-password-reset-backend-fix",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, textAlign = TextAlign.Center,
            )
        }
    }
}
