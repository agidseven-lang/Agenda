package br.com.idseven.agenda.nativebeta.data.session

import br.com.idseven.agenda.nativebeta.data.auth.AuthError
import br.com.idseven.agenda.nativebeta.data.auth.SelfOutcome
import br.com.idseven.agenda.nativebeta.data.auth.ServerAuthRepository

/**
 * F4.2B — Bootstrap autenticado no arranque:
 *   1) le a sessao criptografada;
 *   2) verifica a expiracao local conhecida;
 *   3) chama getUserSelf;
 *   4) so libera as telas internas apos validacao server-side;
 *   5) atualiza perfil/papel/status com a resposta;
 *   6) desativado/excluido OU 401 => limpa sessao + volta ao login;
 *   7) 403 => bloqueia (nao trata como rede, nao limpa sessao);
 *   8) erro de rede => NAO apaga sessao valida; estado de indisponibilidade (sem modo offline).
 */
sealed class BootstrapResult {
    data class Authenticated(val session: SecureSession) : BootstrapResult()
    data object NeedLogin : BootstrapResult()
    data class Unavailable(val error: AuthError) : BootstrapResult()
}

class SessionBootstrapper(
    private val store: SessionVault,
    private val repo: ServerAuthRepository,
    private val now: () -> Long = { System.currentTimeMillis() },
) {
    suspend fun run(): BootstrapResult {
        val s = store.load() ?: return BootstrapResult.NeedLogin
        if (!s.isLocallyValid(now())) {           // expiracao local conhecida
            store.clear()
            return BootstrapResult.NeedLogin
        }
        return when (val r = repo.self(s.token)) {
            is SelfOutcome.Success -> {
                val updated = s.copy(profile = r.user)   // papel/status server-side atualizados
                store.save(updated)
                BootstrapResult.Authenticated(updated)
            }
            SelfOutcome.Expired -> {                 // 401 => sessao vencida
                store.clear()
                BootstrapResult.NeedLogin
            }
            is SelfOutcome.Blocked -> {
                if (r.error == AuthError.USER_DISABLED) {  // desativado/excluido => login
                    store.clear()
                    BootstrapResult.NeedLogin
                } else {
                    BootstrapResult.Unavailable(r.error)   // 403 => bloqueia, NAO limpa sessao
                }
            }
            is SelfOutcome.Unavailable -> BootstrapResult.Unavailable(r.error)  // rede/timeout/5xx: mantem sessao
            is SelfOutcome.Failure -> BootstrapResult.Unavailable(r.error)      // desconhecido: nao derruba sessao
        }
    }
}
