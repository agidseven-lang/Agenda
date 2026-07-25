package br.com.idseven.agenda.data.auth

// F4.2C: mensagens objetivas ao usuario (sem detalhe interno/segredo). Anti-enumeracao no login.
object AuthMessages {
    fun of(failure: AuthFailure): String = when (failure) {
        AuthFailure.INVALID_CREDENTIALS -> "E-mail/WhatsApp ou senha incorretos."
        AuthFailure.USER_INACTIVE -> "Conta inativa ou aguardando aprovacao de um administrador."
        AuthFailure.UID_MISMATCH -> "Falha de verificacao de identidade. Entre novamente."
        AuthFailure.SESSION_EXPIRED -> "Sua sessao expirou. Entre novamente."
        AuthFailure.FIREBASE_FAILED -> "Nao foi possivel concluir a autenticacao. Tente novamente."
        AuthFailure.SERVICE_UNAVAILABLE -> "Servico de login indisponivel no momento. Tente mais tarde."
        AuthFailure.RATE_LIMITED -> "Muitas tentativas. Aguarde um instante e tente de novo."
        AuthFailure.NETWORK -> "Sem conexao. Verifique a internet e tente novamente."
        AuthFailure.NEEDS_LOGIN -> "Entre para continuar."
        AuthFailure.UNKNOWN -> "Nao foi possivel entrar agora. Tente novamente."
    }
}
