package br.com.idseven.agenda.nativebeta.core

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.idseven.agenda.nativebeta.data.EventRepo
import br.com.idseven.agenda.nativebeta.data.TaskRepo
import br.com.idseven.agenda.nativebeta.data.UsersRepo
import br.com.idseven.agenda.nativebeta.domain.EventItem
import br.com.idseven.agenda.nativebeta.domain.TaskItem
import br.com.idseven.agenda.nativebeta.domain.UserLite
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

// Estado de carregamento das listas em tempo real.
sealed interface UiList<out T> {
    data object Loading : UiList<Nothing>
    data class Data<T>(val items: List<T>) : UiList<T>
}

// ViewModel compartilhado do shell: mantém os listeners do Firestore (agenda/tarefas/equipe)
// em tempo real, vivos enquanto o app está em primeiro plano.
class HomeViewModel(app: Application) : AndroidViewModel(app) {

    val events: StateFlow<UiList<EventItem>> =
        EventRepo.events().map { UiList.Data(it) as UiList<EventItem> }
            .catch { emit(UiList.Data(emptyList())) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiList.Loading)

    val users: StateFlow<UiList<UserLite>> =
        UsersRepo.users().map { UiList.Data(it) as UiList<UserLite> }
            .catch { emit(UiList.Data(emptyList())) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiList.Loading)

    val tasks: StateFlow<UiList<TaskItem>> =
        TaskRepo.tasks().map { UiList.Data(it) as UiList<TaskItem> }
            .catch { emit(UiList.Data(emptyList())) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiList.Loading)
}

// Helpers para extrair a lista (ou vazio enquanto carrega).
fun <T> UiList<T>.itemsOrEmpty(): List<T> = (this as? UiList.Data)?.items ?: emptyList()
val UiList<*>.isLoading: Boolean get() = this is UiList.Loading
