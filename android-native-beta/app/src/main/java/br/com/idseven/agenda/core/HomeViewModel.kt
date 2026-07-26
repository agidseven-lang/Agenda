package br.com.idseven.agenda.core

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import br.com.idseven.agenda.data.EventRepo
import br.com.idseven.agenda.data.TaskRepo
import br.com.idseven.agenda.data.UsersRepo
import br.com.idseven.agenda.domain.EventItem
import br.com.idseven.agenda.domain.TaskItem
import br.com.idseven.agenda.domain.UserLite
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

// Estado das listas em tempo real: Loading / Data / Error (erro NÃO é mais engolido).
sealed interface UiList<out T> {
    data object Loading : UiList<Nothing>
    data class Data<T>(val items: List<T>) : UiList<T>
    data class Error(val message: String) : UiList<Nothing>
}

class HomeViewModel(app: Application) : AndroidViewModel(app) {

    val events: StateFlow<UiList<EventItem>> =
        EventRepo.events().map { UiList.Data(it) as UiList<EventItem> }
            .catch { emit(UiList.Error(it.message ?: "Falha ao carregar a agenda")) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiList.Loading)

    val users: StateFlow<UiList<UserLite>> =
        UsersRepo.users().map { UiList.Data(it) as UiList<UserLite> }
            .catch { emit(UiList.Error(it.message ?: "Falha ao carregar a equipe")) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiList.Loading)

    val tasks: StateFlow<UiList<TaskItem>> =
        TaskRepo.tasks().map { UiList.Data(it) as UiList<TaskItem> }
            .catch { emit(UiList.Error(it.message ?: "Falha ao carregar as tarefas")) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), UiList.Loading)
}

fun <T> UiList<T>.itemsOrEmpty(): List<T> = when (this) {
    is UiList.Data -> items
    else -> emptyList()
}
val UiList<*>.isLoading: Boolean get() = this is UiList.Loading
fun UiList<*>.errorMessage(): String? = (this as? UiList.Error)?.message
