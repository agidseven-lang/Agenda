package br.com.idseven.agenda.nativebeta.domain

import androidx.compose.ui.graphics.Color

// F1 (1.0.147) — Designer SLA: derivação LOCAL (read-only). Espelha 1:1 o Desktop
// (kbv2SlaLocal em desktop/src/renderer/index.html). NÃO liga motor/Worker/push;
// apenas colore o card a partir da semente designerSla. Sem appConfig ainda (thresholds locais).
data class SlaLocal(val state: String, val sev: String, val label: String, val color: Color)

object SlaContract {
    const val warnStartMin = 30
    const val warnFinishMin = 30
    const val criticalAfterMin = 60

    // Cores por severidade (idênticas ao Desktop): azul/laranja/vermelho/verde; neutro = sem chip.
    private val AZUL = Color(0xFF7FA6FF)
    private val LARANJA = Color(0xFFF2A93B)
    private val VERMELHO = Color(0xFFFF6B61)
    private val VERDE = Color(0xFF37D196)
    private val NEUTRO = Color(0xFF8B94A6)

    fun derive(t: TaskItem, nowMs: Long = System.currentTimeMillis()): SlaLocal {
        val sla = t.designerSla
        val ps = sla?.planStartAt
        val pd = sla?.planDueAt
        val started = sla?.startedAt ?: t.startedAt
        val finished = sla?.finishedAt ?: t.doneAt
        val delivered = (finished != null && finished > 0L) ||
            t.designerFlowStatus == "entregue" || t.designerFlowStatus == "concluido"
        if (delivered) return SlaLocal("completed", "verde", "Concluído", VERDE)
        if (ps == null || pd == null || ps <= 0L || pd <= 0L)
            return SlaLocal("invalid_or_missing", "neutro", "", NEUTRO)
        val wS = warnStartMin * 60000L
        val wF = warnFinishMin * 60000L
        if (started == null || started <= 0L) {
            if (nowMs >= ps) return SlaLocal("overdue_start", "vermelho", "Início atrasado", VERMELHO)
            if (nowMs >= ps - wS) return SlaLocal("warning_start", "laranja", "Início próximo", LARANJA)
            return SlaLocal("not_started", "azul", "Agendado", AZUL)
        }
        if (nowMs >= pd) return SlaLocal("overdue_finish", "vermelho", "Entrega atrasada", VERMELHO)
        if (nowMs >= pd - wF) return SlaLocal("warning_finish", "laranja", "Entrega próxima", LARANJA)
        return SlaLocal("running", "azul", "Em prazo", AZUL)
    }
}
