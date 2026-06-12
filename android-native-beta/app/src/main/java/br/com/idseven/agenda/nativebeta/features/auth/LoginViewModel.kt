package br.com.idseven.agenda.nativebeta.features.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.idseven.agenda.nativebeta.data.AuthRepo
import br.com.idseven.agenda.nativebeta.data.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthUi {
    data object Idle : AuthUi()
    data object Loading : AuthUi()
    data class Error(val message: String) : AuthUi()
    data class Info(val message: String) : AuthUi()
}

// Reset por admin (legado, mantido para compatibilidade): quando o usuario entra
// com senha temporaria (mustChangePassword=true), o VM NAO cria sessao; expoe
// `pendingChange` para a tela mostrar "Criar nova senha". So apos a troca a
// sessao e gravada.
data class PendingPasswordChange(
    val uid: String, val name: String?, val tempPassword: String,
)

// Self-service: redefinicao em 2 passos pelo proprio usuario (1.0.39+).
// Step 1 = informar e-mail; Step 2 = digitar codigo + nova senha.
sealed class ForgotState {
    data object Step1Email : ForgotState()
    data class Step2Code(val email: String) : ForgotState()
    data object Done : ForgotState() // exibe sucesso antes de voltar pro login
}

// MVVM: estados loading/erro/info. O sucesso do login salva a sessão (DataStore),
// e a navegação é reativa (AppRoot observa a sessão). Sem crash em nenhum caminho.
class LoginViewModel(app: Application) : AndroidViewModel(app) {
    private val sessionStore = SessionStore(app)

    private val _ui = MutableStateFlow<AuthUi>(AuthUi.Idle)
    val ui: StateFlow<AuthUi> = _ui.asStateFlow()

    // null = login normal; preenchido = exige troca antes de criar sessão.
    private val _pendingChange = MutableStateFlow<PendingPasswordChange?>(null)
    val pendingChange: StateFlow<PendingPasswordChange?> = _pendingChange.asStateFlow()

    // Estado do fluxo self-service de redefinicao por codigo (1.0.39+).
    private val _forgot = MutableStateFlow<ForgotState>(ForgotState.Step1Email)
    val forgot: StateFlow<ForgotState> = _forgot.asStateFlow()

    fun login(idOrPhone: String, password: String) {
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.login(idOrPhone, password)) {
                is AuthRepo.Result.Ok -> {
                    if (r.mustChangePassword) {
                        // Não cria sessão; manda a tela mostrar "Criar nova senha".
                        _pendingChange.value = PendingPasswordChange(r.uid, r.name, password)
                        _ui.value = AuthUi.Info("Sua senha é temporária. Defina uma nova senha para continuar.")
                    } else {
                        sessionStore.save(r.uid, r.name) // dispara navegação reativa
                        _ui.value = AuthUi.Idle // evita spinner travado ao voltar do logout (VM é da Activity)
                    }
                }
                is AuthRepo.Result.Err -> _ui.value = AuthUi.Error(r.message)
            }
        }
    }

    fun register(name: String, role: String, phone: String, email: String, password: String) {
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.register(name, role, phone, email, password)) {
                is AuthRepo.Result.Ok -> _ui.value = AuthUi.Info("Cadastro enviado! Aguarde a aprovação de um administrador para entrar.")
                is AuthRepo.Result.Err -> _ui.value = AuthUi.Error(r.message)
            }
        }
    }

    // Self-service step 1: solicita codigo por e-mail (envio real). Sempre
    // mensagem generica para nao revelar se o e-mail existe; avanca para step 2.
    fun requestReset(email: String) {
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.requestPasswordReset(email)) {
                is AuthRepo.Result.Ok -> {
                    _forgot.value = ForgotState.Step2Code(email.trim().lowercase())
                    _ui.value = AuthUi.Info("Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos. Confira sua caixa de entrada (e o spam).")
                }
                is AuthRepo.Result.Err -> _ui.value = AuthUi.Error(r.message)
            }
        }
    }

    // Self-service step 2: confirma codigo + nova senha. Em sucesso, exibe
    // estado Done para a tela mostrar "Senha redefinida com sucesso." e voltar
    // pro login.
    fun confirmReset(code: String, newPassword: String, confirmPassword: String) {
        val st = _forgot.value
        if (st !is ForgotState.Step2Code) {
            _ui.value = AuthUi.Error("Solicite um novo código.")
            return
        }
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.confirmPasswordReset(st.email, code, newPassword, confirmPassword)) {
                is AuthRepo.Result.Ok -> {
                    _forgot.value = ForgotState.Done
                    _ui.value = AuthUi.Info("Senha redefinida com sucesso. Entre com a nova senha.")
                }
                is AuthRepo.Result.Err -> _ui.value = AuthUi.Error(r.message)
            }
        }
    }

    fun resetForgot() {
        _forgot.value = ForgotState.Step1Email
        _ui.value = AuthUi.Idle
    }

    // Troca a senha após login com temporária. Só cria sessão se a troca for OK.
    fun changePassword(newPassword: String, confirmPassword: String) {
        val p = _pendingChange.value ?: return
        if (newPassword != confirmPassword) {
            _ui.value = AuthUi.Error("As senhas não coincidem.")
            return
        }
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.changePassword(p.uid, p.tempPassword, newPassword)) {
                is AuthRepo.Result.Ok -> {
                    sessionStore.save(r.uid, r.name)
                    _pendingChange.value = null
                    _ui.value = AuthUi.Idle
                }
                is AuthRepo.Result.Err -> _ui.value = AuthUi.Error(r.message)
            }
        }
    }

    fun cancelChange() {
        _pendingChange.value = null
        _ui.value = AuthUi.Idle
    }

    fun resetMessage() { _ui.value = AuthUi.Idle }
}
