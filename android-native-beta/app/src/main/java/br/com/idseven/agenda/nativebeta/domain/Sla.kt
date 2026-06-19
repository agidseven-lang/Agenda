package br.com.idseven.agenda.nativebeta.domain

import androidx.compose.ui.graphics.Color

// F1 (1.0.147) — Designer SLA: derivação LOCAL (read-only). Espelha 1:1 o Desktop
// (kbv2SlaLocal em desktop/src/renderer/index.html). NÃO liga motor/Worker/push;
// apenas colore o card a partir da semente designerSla. Sem appConfig ainda (thresholds locais).
data class SlaLocal(val state: String, val sev: String, val label: String, val color: Color)

// F3.3.2 — FONTE ÚNICA DE VERDADE do estado SLA exibido (paridade com o Desktop
// resolveTaskDisplayState do PANEL-CORE). Todos os consumidores (chip do card =
// SlaContract.derive · painel/sino = SlaInApp · detalhe = slaDeadline) derivam DESTE
// estado, garantindo status/prazo coerentes entre todas as telas. Sempre por PRAZO
// FINAL — nunca por início (sem "Início atrasado").
data class TaskDisplayState(
    val state: String,        // completed | overdue | warning | running | none
    val sev: String,          // verde | vermelho | laranja | azul | neutro
    val label: String,
    val finishMs: Long,
    val remainingMin: Long,
    val overdueMin: Long,
    val hasSla: Boolean,
    val inPanel: Boolean,     // true só p/ vermelho/laranja (entram no painel/sino)
)

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

    // FONTE ÚNICA do prazo final (paridade c/ Desktop slaPanelFinishMs e F3.3.1):
    // plannedFinishAt → planDueAt → dueDate/dueTime. (Android não tem assignment.endDate.)
    fun finishMs(t: TaskItem): Long {
        val sla = t.designerSla
        sla?.plannedFinishAt?.let { if (it > 0L) return it }
        sla?.planDueAt?.let { if (it > 0L) return it }
        val due = EventStatus.dtMs(t.dueDate, (t.dueTime?.ifBlank { null }) ?: "23:59")
        return if (due != null && due > 0L) due else 0L
    }

    // Entregue/concluída/cancelada/removida ⇒ SLA encerrado (verde, fora do painel/sino).
    fun delivered(t: TaskItem): Boolean {
        val finished = t.designerSla?.finishedAt ?: t.doneAt
        if (finished != null && finished > 0L) return true
        val fs = t.designerFlowStatus; val st = t.status
        return fs == "entregue" || fs == "concluido" || fs == "cancelado" ||
            st == "concluido" || st == "cancelado" || st == "removido"
    }

    // FONTE ÚNICA — estado canônico de exibição por PRAZO FINAL. Determinístico/read-only.
    fun resolve(t: TaskItem, nowMs: Long = System.currentTimeMillis()): TaskDisplayState {
        val hasSla = t.designerSla != null
        val finish = finishMs(t)
        if (delivered(t)) return TaskDisplayState("completed", "verde", "Concluído", finish, 0L, 0L, hasSla, false)
        if (!hasSla || finish <= 0L) return TaskDisplayState("none", "neutro", "", finish, 0L, 0L, hasSla, false)
        val wF = warnFinishMin * 60000L
        if (nowMs >= finish) {
            val over = kotlin.math.max(1L, Math.round((nowMs - finish) / 60000.0))
            return TaskDisplayState("overdue", "vermelho", "Prazo encerrado", finish, 0L, over, true, true)
        }
        if (nowMs >= finish - wF) {
            val left = kotlin.math.max(1L, Math.round((finish - nowMs) / 60000.0))
            return TaskDisplayState("warning", "laranja", "Prazo próximo", finish, left, 0L, true, true)
        }
        val rem = kotlin.math.max(1L, Math.round((finish - nowMs) / 60000.0))
        return TaskDisplayState("running", "azul", "Em prazo", finish, rem, 0L, true, false)
    }

    // Chip SLA do card = mapeamento da FONTE ÚNICA (resolve) p/ os rótulos do card.
    // Por PRAZO FINAL — nunca "Início atrasado" enquanto o prazo final está em dia.
    fun derive(t: TaskItem, nowMs: Long = System.currentTimeMillis()): SlaLocal {
        val d = resolve(t, nowMs)
        return when (d.state) {
            "completed" -> SlaLocal("completed", "verde", "Concluído", VERDE)
            "none" -> SlaLocal("invalid_or_missing", "neutro", "", NEUTRO)
            "overdue" -> SlaLocal("overdue_finish", "vermelho", "Prazo encerrado", VERMELHO)
            "warning" -> SlaLocal("warning_finish", "laranja", "Prazo próximo", LARANJA)
            else -> SlaLocal("running", "azul", "Em prazo", AZUL)
        }
    }
}
