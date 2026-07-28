package br.com.idseven.agenda.features.auth

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.idseven.agenda.data.AuthRepo
import br.com.idseven.agenda.data.auth.AuthErrorMapper
import br.com.idseven.agenda.data.session.AppSession
import br.com.idseven.agenda.data.session.SessionManager
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

// F4.2B — a troca por senha temporaria (mustChangePassword) era client-side (users.get + Crypto.verify).
// Foi RETIRADA do fluxo ativo de login. `pendingChange` permanece como tipo/StateFlow por compatibilidade
// da tela, porem NUNCA e preenchido: quem entra com senha temporaria usa o fluxo de recuperacao (server-side).
data class PendingPasswordChange(
    val uid: String, val name: String?, val tempPassword: String,
)

sealed class ForgotState {
    data object Step1Email : ForgotState()
    data class Step2Code(val email: String) : ForgotState()
    data object Done : ForgotState()
}

/**
 * F4.2B — Login SERVER-SIDE. O login usa o SessionManager (loginUser → token → sessao criptografada
 * pelo Keystore; navegacao reativa via SessionManager.state, observado no AppRoot). NENHUM acesso a
 * colecao users, NENHUM Crypto.verify, NENHUM hash/salt no caminho de login. Senha so em memoria
 * durante a tentativa (parametro local), nunca persistida.
 *
 * Cadastro (register) e recuperacao (requestReset/confirmReset) seguem no AuthRepo — o cadastro por
 * nao existir endpoint server-side de criacao de conta (documentado; F4.2C), a recuperacao por JA ser
 * server-side (Cloud Functions). Nenhum deles verifica senha no aparelho.
 */
class LoginViewModel(app: Application) : AndroidViewModel(app) {
    private val session: SessionManager = AppSession.get(app)

    private val _ui = MutableStateFlow<AuthUi>(AuthUi.Idle)
    val ui: StateFlow<AuthUi> = _ui.asStateFlow()

    // Sempre null nesta fase (fluxo de senha temporaria client-side removido).
    private val _pendingChange = MutableStateFlow<PendingPasswordChange?>(null)
    val pendingChange: StateFlow<PendingPasswordChange?> = _pendingChange.asStateFlow()

    private val _forgot = MutableStateFlow<ForgotState>(ForgotState.Step1Email)
    val forgot: StateFlow<ForgotState> = _forgot.asStateFlow()

    // Single-flight: bloqueia envios simultaneos (evita multiplas requisicoes de login em paralelo).
    private var submitting = false

    fun login(idOrPhone: String, password: String) {
        if (submitting) return
        submitting = true
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            try {
                val err = session.login(idOrPhone, password) // senha so aqui; nao guardamos referencia
                _ui.value = if (err == null) AuthUi.Idle else AuthUi.Error(AuthErrorMapper.message(err))
            } finally {
                submitting = false
            }
        }
    }

    fun register(name: String, role: String, phone: String, email: String, password: String) {
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.register(name, role, phone, email, password)) {
                is AuthRepo.Result.Ok -> _ui.value = AuthUi.Info("Cadastro enviado! Aguarde a aprovação de um administrador para entrar.")
                is AuthRepo.Result.Err -> _ui.value = AuthUi.Error(r.message)
                // F4.3C1 (HIGH-2) — cadastro direto desabilitado (fail-closed). Mensagem NEUTRA e
                // orientadora (nao e erro temporario); a submissao nao cria nada no Firestore.
                is AuthRepo.Result.RegistrationUnavailable ->
                    _ui.value = AuthUi.Info("O cadastro de novos usuários é realizado pelo administrador do sistema.")
            }
        }
    }

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

    // F4.2B — fluxo de senha temporaria removido do caminho ativo (era client-side). Mantido como
    // no-op por compatibilidade da tela: pendingChange nunca e preenchido, entao nunca executa.
    fun changePassword(newPassword: String, confirmPassword: String) {
        _pendingChange.value ?: return
    }

    fun cancelChange() {
        _pendingChange.value = null
        _ui.value = AuthUi.Idle
    }

    fun resetMessage() { _ui.value = AuthUi.Idle }
}
