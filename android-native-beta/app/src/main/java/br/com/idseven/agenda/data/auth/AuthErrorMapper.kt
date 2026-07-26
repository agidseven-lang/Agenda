package br.com.idseven.agenda.data.auth

/**
 * F4.2B — Traducao de (transporte + status HTTP) para o erro canonico, e do erro canonico para a
 * mensagem de UI. Regras do mandato:
 *  - NUNCA revelar se um e-mail existe: qualquer falha de credencial vira INVALID_CREDENTIALS,
 *    com a MESMA mensagem para "senha invalida" e "usuario inexistente";
 *  - NUNCA exibir stack trace nem corpo bruto do servidor;
 *  - 403 NAO e erro de rede — bloqueia a operacao;
 *  - erro de rede NAO e 401 — nao derruba sessao.
 */
object AuthErrorMapper {

    /** Falhas de LOGIN: colapsa todas as credenciais em INVALID_CREDENTIALS (anti-enumeracao). */
    fun mapLoginFailure(reply: AuthApi.HttpReply): AuthError = when (reply.transport) {
        AuthApi.Transport.NO_NETWORK -> AuthError.NO_NETWORK
        AuthApi.Transport.TIMEOUT -> AuthError.TIMEOUT
        AuthApi.Transport.SSL_OR_IO -> AuthError.UNAVAILABLE
        AuthApi.Transport.BAD_URL -> AuthError.UNAVAILABLE
        AuthApi.Transport.OK -> when (reply.status) {
            // 400/401/403/404/409 no login = credencial/identificacao — INDISTINGUIVEL de proposito.
            in 400..404, 409 -> AuthError.INVALID_CREDENTIALS
            429 -> AuthError.TOO_MANY_REQUESTS
            in 500..599 -> AuthError.SERVER_ERROR
            else -> AuthError.INVALID_RESPONSE
        }
    }

    /** Falhas de getUserSelf/changePassword (sessao ja existente). */
    fun mapAuthedFailure(reply: AuthApi.HttpReply): AuthError = when (reply.transport) {
        AuthApi.Transport.NO_NETWORK -> AuthError.NO_NETWORK
        AuthApi.Transport.TIMEOUT -> AuthError.TIMEOUT
        AuthApi.Transport.SSL_OR_IO -> AuthError.UNAVAILABLE
        AuthApi.Transport.BAD_URL -> AuthError.UNAVAILABLE
        AuthApi.Transport.OK -> when (reply.status) {
            401 -> AuthError.SESSION_EXPIRED
            403 -> AuthError.FORBIDDEN
            429 -> AuthError.TOO_MANY_REQUESTS
            in 500..599 -> AuthError.SERVER_ERROR
            else -> AuthError.INVALID_RESPONSE
        }
    }

    /** Mensagem de UI canonica — generica, sem vazar existencia de conta nem detalhe do servidor. */
    fun message(error: AuthError): String = when (error) {
        AuthError.INVALID_CREDENTIALS -> "E-mail/WhatsApp ou senha incorretos."
        AuthError.USER_DISABLED -> "Sua conta está inativa. Fale com um administrador."
        AuthError.SESSION_EXPIRED -> "Sua sessão expirou. Entre novamente."
        AuthError.FORBIDDEN -> "Você não tem permissão para esta ação."
        AuthError.TOO_MANY_REQUESTS -> "Muitas tentativas. Aguarde um momento e tente de novo."
        AuthError.SERVER_ERROR -> "O servidor está indisponível no momento. Tente novamente em instantes."
        AuthError.NO_NETWORK -> "Sem conexão. Verifique sua internet e tente de novo."
        AuthError.TIMEOUT -> "A conexão demorou demais. Tente novamente."
        AuthError.INVALID_RESPONSE -> "Não foi possível concluir agora. Tente novamente em instantes."
        AuthError.UNAVAILABLE -> "Serviço indisponível no momento. Tente novamente."
        AuthError.BAD_REQUEST -> "Preencha e-mail/WhatsApp e senha."
        AuthError.IDENTITY_MISMATCH -> "Falha na verificação de identidade. Entre novamente."
    }
}
