package br.com.idseven.agenda.auth

import br.com.idseven.agenda.data.session.SecureSession
import br.com.idseven.agenda.data.session.SessionVault

/** F4.2B — Cofre de sessao em memoria (fixture) para testar SessionManager/SessionBootstrapper. */
class FakeVault(initial: SecureSession? = null) : SessionVault {
    var current: SecureSession? = initial
    var saves = 0
    var clears = 0
    var lastDeleteKey = false

    override fun save(session: SecureSession) { current = session; saves++ }
    override fun load(): SecureSession? = current
    override fun loadValid(nowMs: Long): SecureSession? = current?.takeIf { it.isLocallyValid(nowMs) }
    override fun clear(deleteKey: Boolean) { current = null; clears++; lastDeleteKey = deleteKey }
}
