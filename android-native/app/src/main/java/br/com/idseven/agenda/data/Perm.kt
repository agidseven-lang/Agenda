package br.com.idseven.agenda.data

import java.text.Normalizer

// Mesma regra do PWA: só estes usuários criam/gerenciam compromissos e tarefas.
object Perm {
    private fun norm(s: String?): String {
        if (s == null) return ""
        val n = Normalizer.normalize(s, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return n.lowercase().trim()
    }

    fun canManage(name: String?): Boolean {
        val n = norm(name)
        return n.contains("miercohevisk") || n.contains("arydyjany") || n.contains("tatiana")
    }
}
