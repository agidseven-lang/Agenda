package br.com.idseven.agenda.nativebeta.domain

import androidx.compose.ui.graphics.Color

// =====================================================================
// FASE PRODUÇÃO 1 — FLOW ENGINE CANÔNICO (Android beta)
// Porte conceitual 1:1 do Desktop (FLOW_LABELS / deriveCanonicalTaskState em
// desktop/src/renderer/index.html). PURO / read-only / ADITIVO: NÃO grava
// campos, NÃO cria collection/índice, NÃO liga SLA_ENGINE/SLA_WRITE/FCM/push.
// Interpreta os campos que o TaskItem do Android JÁ expõe (designerFlowStatus,
// clientFlowStatus, designerAssignment.designerId, status, sector) numa máquina
// de 8 fases e deriva, por perspectiva (Social/Designer/Cliente),
// {col, label, color, next}. Mesma fonte ÚNICA de verdade do fluxo do Desktop.
//
// NOTA DE PARIDADE: o TaskItem do Android NÃO carrega cronStatus /
// finalApprovalCompleted / operationalStatus, então a distinção fina entre
// "designer entregou (Social ainda não reenviou)" e "Social reenviou ao
// cliente" é colapsada em AWAITING_CLIENT_APPROVAL (ambas têm
// clientFlowStatus = "reenviado"). As perspectivas Designer/Cliente continuam
// corretas (designer vê "Entregue"; cliente vê "Versão final disponível").
// =====================================================================

enum class TaskPhase {
    PLANNING,                  // Social planeja; designer não atribuído
    AWAITING_DESIGNER,         // designer atribuído, ainda não iniciou
    DESIGNER_PRODUCING,        // designerFlowStatus = "andamento"
    DESIGNER_REVISING,         // designerFlowStatus = "revisao"
    DESIGNER_DELIVERED,        // designer entregou; Social ainda não reenviou
    AWAITING_CLIENT_APPROVAL,  // Social reenviou ao cliente (aguardando aprovação final)
    CLIENT_REQUESTED_CHANGES,  // cliente pediu ajuste
    COMPLETED                  // aprovação FINAL do cliente — ÚNICA conclusão
}

data class FlowPerspective(
    val col: String,    // coluna do papel: afazer|andamento|revisao|concluido|entregue|enviado|analise|aprovado
    val label: String,  // chip principal / status visual
    val color: Color,
    val next: String    // próxima ação
)

data class FlowState(
    val phase: TaskPhase,
    val social: FlowPerspective,
    val designer: FlowPerspective,
    val client: FlowPerspective
)

object FlowEngine {
    // Paleta idêntica ao Desktop (BLACK PREMIUM).
    private val GREY = Color(0xFF9BA0AB)
    private val GREY2 = Color(0xFF6E7480)
    private val INDIGO = Color(0xFF7C83FF)
    private val CYAN = Color(0xFF22D3EE)
    private val PURPLE = Color(0xFFA78BFA)
    private val AMBER = Color(0xFFF59E0B)
    private val BLUE = Color(0xFF60A5FA)
    private val GREEN = Color(0xFF34D399)
    private val GREEN2 = Color(0xFF10B981)

    private fun isCron(t: TaskItem) = (t.sector ?: "") == "cronograma"
    private fun hasDesigner(t: TaskItem) = t.designerAssignment?.designerId != null

    // FONTE ÚNICA — fase canônica. Determinística e ORDENADA (terminal → cliente → designer).
    fun derivePhase(t: TaskItem): TaskPhase {
        if (!isCron(t)) {
            return when (t.status) {
                "concluido" -> TaskPhase.COMPLETED
                "revisao" -> TaskPhase.DESIGNER_REVISING
                "andamento" -> TaskPhase.DESIGNER_PRODUCING
                else -> TaskPhase.AWAITING_DESIGNER
            }
        }
        val cfs = t.clientFlowStatus ?: ""
        val dfs = t.designerFlowStatus ?: ""
        if (cfs == "concluido") return TaskPhase.COMPLETED
        if (cfs == "revisao") return TaskPhase.CLIENT_REQUESTED_CHANGES
        if (cfs == "reenviado") return TaskPhase.AWAITING_CLIENT_APPROVAL
        if (hasDesigner(t)) {
            return when (dfs) {
                "concluido", "entregue" -> TaskPhase.DESIGNER_DELIVERED
                "revisao" -> TaskPhase.DESIGNER_REVISING
                "andamento" -> TaskPhase.DESIGNER_PRODUCING
                else -> TaskPhase.AWAITING_DESIGNER
            }
        }
        return TaskPhase.PLANNING
    }

    fun derive(t: TaskItem): FlowState {
        val p = derivePhase(t)
        return FlowState(p, socialOf(p), designerOf(p), clientOf(p))
    }

    // Rótulos canônicos por (fase × papel) — espelham FLOW_LABELS do Desktop.
    fun socialOf(p: TaskPhase): FlowPerspective = when (p) {
        TaskPhase.PLANNING -> FlowPerspective("afazer", "Em planejamento", GREY, "Criar e enviar ao cliente")
        TaskPhase.AWAITING_DESIGNER -> FlowPerspective("andamento", "Aguardando designer iniciar", INDIGO, "Aguardar o designer iniciar")
        TaskPhase.DESIGNER_PRODUCING -> FlowPerspective("andamento", "Designer em produção", PURPLE, "Aguardar a entrega do designer")
        TaskPhase.DESIGNER_REVISING -> FlowPerspective("revisao", "Designer em revisão/ajuste", BLUE, "Aguardar a correção do designer")
        TaskPhase.DESIGNER_DELIVERED -> FlowPerspective("andamento", "Designer entregou — enviar ao cliente", GREEN, "Revisar e enviar ao cliente")
        TaskPhase.AWAITING_CLIENT_APPROVAL -> FlowPerspective("andamento", "Aguardando aprovação do cliente", GREEN, "Aguardar a aprovação do cliente")
        TaskPhase.CLIENT_REQUESTED_CHANGES -> FlowPerspective("revisao", "Cliente pediu ajuste", AMBER, "Corrigir e reenviar ao cliente")
        TaskPhase.COMPLETED -> FlowPerspective("concluido", "Concluído final", GREEN2, "Tarefa encerrada")
    }

    fun designerOf(p: TaskPhase): FlowPerspective = when (p) {
        TaskPhase.PLANNING -> FlowPerspective("afazer", "A Fazer", GREY, "Aguardando atribuição")
        TaskPhase.AWAITING_DESIGNER -> FlowPerspective("afazer", "A Fazer", GREY, "Iniciar a produção")
        TaskPhase.DESIGNER_PRODUCING -> FlowPerspective("andamento", "Em produção", AMBER, "Finalizar e entregar")
        TaskPhase.DESIGNER_REVISING -> FlowPerspective("revisao", "Revisão/Ajuste", BLUE, "Corrigir o ajuste e reenviar")
        TaskPhase.DESIGNER_DELIVERED -> FlowPerspective("entregue", "Entregue", GREEN, "Entregue — aguardando a Social")
        TaskPhase.AWAITING_CLIENT_APPROVAL -> FlowPerspective("entregue", "Entregue", GREEN, "Entregue — com o cliente")
        TaskPhase.CLIENT_REQUESTED_CHANGES -> FlowPerspective("entregue", "Entregue", GREEN, "Aguardando decisão da Social")
        TaskPhase.COMPLETED -> FlowPerspective("entregue", "Concluído", GREEN2, "Concluído")
    }

    fun clientOf(p: TaskPhase): FlowPerspective = when (p) {
        TaskPhase.PLANNING -> FlowPerspective("enviado", "Em preparação", GREY2, "Aguardar os temas")
        TaskPhase.AWAITING_DESIGNER -> FlowPerspective("analise", "Temas aprovados — produção será iniciada", CYAN, "Equipe inicia a produção")
        TaskPhase.DESIGNER_PRODUCING -> FlowPerspective("analise", "Equipe em produção", PURPLE, "Aguardar a produção das artes")
        TaskPhase.DESIGNER_REVISING -> FlowPerspective("analise", "A equipe está produzindo as artes", PURPLE, "Aguardar a produção das artes")
        TaskPhase.DESIGNER_DELIVERED -> FlowPerspective("analise", "A equipe está finalizando as artes", PURPLE, "Aguardar a versão final")
        TaskPhase.AWAITING_CLIENT_APPROVAL -> FlowPerspective("analise", "Versão final disponível para análise", GREEN, "Aprovar ou pedir ajuste")
        TaskPhase.CLIENT_REQUESTED_CHANGES -> FlowPerspective("revisao", "Ajuste solicitado — equipe corrigindo", AMBER, "Equipe corrige e reenvia")
        TaskPhase.COMPLETED -> FlowPerspective("aprovado", "Aprovado", GREEN, "Cronograma encerrado")
    }
}
