package br.com.idseven.agenda.nativebeta.domain

// Modelos de domínio — espelham EXATAMENTE o schema do PWA (sem campo inventado).

data class EventItem(
    val id: String,
    val type: String?,
    val title: String?,
    val client: String?,
    val location: String?,
    val notes: String?,
    val date: String?,      // "YYYY-MM-DD"
    val start: String?,     // "HH:MM"
    val end: String?,       // "HH:MM"
    val owner: String?,
    val ownerId: String?,
    val by: String?,
    val done: Boolean,
    val startedAt: Long?,
    val startedBy: String?,
    val doneAt: Long?,
    val doneBy: String?,
    // F3.3.73I6C3 — lifecycle: cancelamento LÓGICO (paridade contrato 73I6C1 / Desktop 1.0.161).
    val status: String? = null,
    val cancelledAt: Long? = null,
    val cancelledBy: String? = null,
)

// F3.3.73D — perfil canônico do próprio usuário (getUserSelf). Carrega e-mail/
// telefone do PRÓPRIO usuário (permitido); NUNCA vem de usersPublic.
data class SelfInfo(
    val id: String,
    val name: String? = null,
    val role: String? = null,
    val color: String? = null,
    val photo: String? = null,
    val admin: Boolean = false,
    val email: String? = null,
    val phone: String? = null,
    val fcmTokens: List<String> = emptyList(),
)

data class UserLite(
    val id: String,
    val name: String?,
    val role: String?,
    val color: String?,
    val photo: String?,
    val status: String?,
    val admin: Boolean,
    val email: String? = null,
    val phone: String? = null,
    val createdAt: Long? = null,
    val fcmTokens: List<String> = emptyList(),
) {
    fun isActive(): Boolean = status != "pendente" && status != "removido" && status != "excluido"
}

data class TaskItem(
    val id: String,
    val title: String?,
    val client: String?,
    val sector: String?,
    val desc: String?,
    val status: String?,        // afazer | andamento | concluido
    val assignee: String?,
    val assigneeId: String? = null,  // uid do responsável (aditivo; compatível com dados antigos)
    val link: String?,
    val priority: Boolean,
    val startDate: String?,
    val startTime: String?,
    val dueDate: String?,       // "YYYY-MM-DD"
    val dueTime: String?,       // "HH:MM"
    val by: String?,
    val createdAt: Long?,
    val startedAt: Long?,
    val doneAt: Long?,
    val doneBy: String?,
    val checklist: List<ChecklistItem>,
    val history: List<TaskHistory>,
    // F1 (1.0.147) — aditivos; compatíveis com dados antigos (null quando ausentes).
    val designerFlowStatus: String? = null,
    val designerSla: DesignerSla? = null,
    // F1.1 — paridade mobile: campos para o card mobile exibir o mesmo que o Desktop.
    val clientFlowStatus: String? = null,
    val designerAssignment: DesignerAssignment? = null,
    val cronContents: List<CronContent> = emptyList(),
    // F3.3.6-C — paridade de fluxo (LEITURA aditiva; default null = dados antigos não quebram).
    // Gravados por Desktop/Worker; o Android só LÊ (nunca grava).
    val cronStatus: String? = null,
    val operationalStatus: String? = null,
    val finalApprovalCompleted: Boolean? = null,
)

// F1.1 — semente do "Enviar ao designer" (Desktop grava). Aditivo.
data class DesignerAssignment(
    val designerId: String? = null,
    val designerName: String? = null,
    val designerAvatar: String? = null,
    val assignedAt: Long? = null,
    val assignedBy: String? = null,
)

// F1.1 — conteúdo de cronograma (tema + legenda). Aditivo; vazio em tarefas comuns.
data class CronContent(val tema: String? = null, val legenda: String? = null)

// F1 — semente de SLA do designer (gravada pelo Desktop ao "Enviar ao designer").
data class DesignerSla(
    val planStartAt: Long? = null,
    val planDueAt: Long? = null,
    // F3.3.2 — prazo final canônico do engine (paridade com a F3.3.1). Aditivo, nullable:
    // quando ausente, o painel/sino caem em planDueAt → dueDate/dueTime (compat total).
    val plannedFinishAt: Long? = null,
    val startedAt: Long? = null,
    val finishedAt: Long? = null,
    val seedAt: Long? = null,
    val seedBy: String? = null,
)

data class ChecklistItem(val t: String, val d: Boolean)

data class TaskHistory(val kind: String, val at: Long?, val byId: String?, val from: String?, val to: String?)
