package br.com.idseven.agenda.core

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.idseven.agenda.data.UserSession
import br.com.idseven.agenda.data.session.AppSession
import br.com.idseven.agenda.data.session.SessionUiState
import br.com.idseven.agenda.features.auth.LoginScreen
import kotlinx.coroutines.launch

/**
 * F4.2B — Roteamento reativo pela SESSAO SERVER-VALIDADA (SessionManager):
 *  - Loading  → Splash (durante o bootstrap: getUserSelf);
 *  - LoggedOut → Login;
 *  - Authenticated → telas internas (so apos validacao server-side);
 *  - Unavailable → tela de indisponibilidade (sessao presente, sem validacao por rede — NAO derruba
 *    a sessao, NAO inventa modo offline; botao para tentar de novo).
 *
 * As telas internas continuam recebendo UserSession(uid,name) — o perfil server-verificado (papel/
 * status atualizados por getUserSelf) vive na sessao segura e e a fonte para futura migracao (F4.2C).
 */
@Composable
fun AppRoot() {
    val context = LocalContext.current
    val session = remember { AppSession.get(context) }
    val scope = rememberCoroutineScope()

    // Bootstrap no arranque: valida a sessao existente por getUserSelf.
    LaunchedEffect(Unit) { session.bootstrap() }

    val state by session.state.collectAsState()

    when (val s = state) {
        is SessionUiState.Loading -> Splash()
        is SessionUiState.LoggedOut -> LoginScreen()
        is SessionUiState.Authenticated -> MainScaffold(
            session = UserSession(s.session.uid, s.session.profile.name),
            onLogout = { scope.launch { session.logout() } },
        )
        is SessionUiState.Unavailable -> Unavailable(
            onRetry = { scope.launch { session.retry() } },
            onLogout = { scope.launch { session.logout() } },
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

@Composable
private fun Unavailable(onRetry: () -> Unit, onLogout: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Não foi possível validar sua sessão agora. Verifique a conexão e tente novamente.",
                    color = MaterialTheme.colorScheme.onBackground,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
                Button(onClick = onRetry) { Text("Tentar novamente") }
                TextButton(onClick = onLogout) { Text("Sair") }
            }
        }
    }
}
