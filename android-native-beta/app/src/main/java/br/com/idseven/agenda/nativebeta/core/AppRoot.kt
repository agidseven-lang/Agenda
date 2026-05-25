package br.com.idseven.agenda.nativebeta.core

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import br.com.idseven.agenda.nativebeta.data.SessionStore
import br.com.idseven.agenda.nativebeta.data.UserSession
import br.com.idseven.agenda.nativebeta.features.auth.LoginScreen
import kotlinx.coroutines.launch

private sealed class SessionState {
    data object Loading : SessionState()
    data object LoggedOut : SessionState()
    data class LoggedIn(val session: UserSession) : SessionState()
}

// Roteamento reativo pela sessão: login salva a sessão e cai no Dashboard;
// logout limpa a sessão e volta ao Login. Fonte única de verdade (DataStore).
@Composable
fun AppRoot() {
    val context = LocalContext.current
    val sessionStore = remember { SessionStore(context) }
    val scope = rememberCoroutineScope()

    val state by produceState<SessionState>(SessionState.Loading, sessionStore) {
        sessionStore.session.collect { s ->
            value = if (s == null) SessionState.LoggedOut else SessionState.LoggedIn(s)
        }
    }

    when (val s = state) {
        is SessionState.Loading -> Splash()
        is SessionState.LoggedOut -> LoginScreen()
        is SessionState.LoggedIn -> MainScaffold(
            session = s.session,
            onLogout = { scope.launch { sessionStore.clear() } },
        )
    }
}

@Composable
private fun Splash() {
    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
    }
}
