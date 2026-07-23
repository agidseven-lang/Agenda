package br.com.idseven.agenda.nativebeta.data.auth

import org.json.JSONObject

/**
 * F4.2B — Costura de rede da autenticacao. ServerAuthRepository depende desta interface (nao da
 * implementacao concreta), de modo que os testes unitarios injetam um AuthApi falso com fixtures,
 * sem tocar a rede. A implementacao real e AuthApiClient (HttpURLConnection, HTTPS-only).
 */
interface AuthApi {
    suspend fun postLogin(identifier: String, password: String): HttpReply
    suspend fun postSelf(token: String): HttpReply
    suspend fun postChangePassword(token: String, oldPassword: String, newPassword: String): HttpReply

    data class HttpReply(val status: Int, val body: JSONObject?, val transport: Transport)
    enum class Transport { OK, NO_NETWORK, TIMEOUT, SSL_OR_IO, BAD_URL }
}
