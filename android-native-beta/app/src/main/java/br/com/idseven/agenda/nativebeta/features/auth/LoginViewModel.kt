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

// Reset por admin (sem e-mail): quando o usuário entra com senha temporária
// (mustChangePassword=true), o VM NÃO cria sessão; expõe `pendingChange` para a
// tela mostrar "Criar nova senha". Só após a troca a sessão é gravada.
data class PendingPasswordChange(
    val uid: String, val name: String?, val tempPassword: String,
)

// MVVM: estados loading/erro/info. O sucesso do login salva a sessão (DataStore),
// e a navegação é reativa (AppRoot observa a sessão). Sem crash em nenhum caminho.
class LoginViewModel(app: Application) : AndroidViewModel(app) {
    private val sessionStore = SessionStore(app)

    private val _ui = MutableStateFlow<AuthUi>(AuthUi.Idle)
    val ui: StateFlow<AuthUi> = _ui.asStateFlow()

    // null = login normal; preenchido = exige troca antes de criar sessão.
    private val _pendingChange = MutableStateFlow<PendingPasswordChange?>(null)
    val pendingChange: StateFlow<PendingPasswordChange?> = _pendingChange.asStateFlow()

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

    // Solicitação de redefinição (admin trata fora do app). Sempre exibe mensagem
    // genérica — não revela se o e-mail/WhatsApp existe.
    fun requestReset(idOrPhone: String) {
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.requestPasswordReset(idOrPhone)) {
                is AuthRepo.Result.Ok ->
                    _ui.value = AuthUi.Info("Se os dados estiverem cadastrados, sua solicitação será analisada pela administração.")
                is AuthRepo.Result.Err -> _ui.value = AuthUi.Error(r.message)
            }
        }
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
