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

// MVVM: estados loading/erro/info. O sucesso do login salva a sessão (DataStore),
// e a navegação é reativa (AppRoot observa a sessão). Sem crash em nenhum caminho.
class LoginViewModel(app: Application) : AndroidViewModel(app) {
    private val sessionStore = SessionStore(app)

    private val _ui = MutableStateFlow<AuthUi>(AuthUi.Idle)
    val ui: StateFlow<AuthUi> = _ui.asStateFlow()

    fun login(idOrPhone: String, password: String) {
        _ui.value = AuthUi.Loading
        viewModelScope.launch {
            when (val r = AuthRepo.login(idOrPhone, password)) {
                is AuthRepo.Result.Ok -> {
                    sessionStore.save(r.uid, r.name) // dispara navegação reativa
                    _ui.value = AuthUi.Idle // evita spinner travado ao voltar do logout (VM é da Activity)
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

    fun resetMessage() { _ui.value = AuthUi.Idle }
}
